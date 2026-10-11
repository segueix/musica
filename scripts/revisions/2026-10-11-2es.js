'use strict';

// Aprovació editorial de les 9 cançons de 2ES; dues exclusions explícites.
// Reaplica decisions persistents i recupera el catàleg arxivat sense crides a l'API.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { parseContentOverrides, applyOverridesToSnapshot } = require('../lib/revisio_manual_musical');
const { slimFeedVideo, serializeFeed } = require('../lib/aprimar_feed');
const { splitChannelVideos } = require('../lib/arxiu_musical');
const root = path.resolve(__dirname, '../..');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const write = (p, d) => fs.writeFileSync(path.join(root, p), JSON.stringify(d, null, 2) + '\n');
const channelId = 'UCjEehp73GI2mh9Rkv31QT9w';
const excluded = new Set(['lGT_JGeoULk', 'GtDCepBTk7o']);
const songs = {
    xZVbSeDtMCE: '2ES - AFROCAT Part.1 (Passa Tira)',
    neHwOZZ9p5I: '2ES - AL TERRAT',
    iwfzjc4tM2I: "2ES - A L'HOTEL",
    cW_PdTIx0hs: '2ES - AFROCAT Part.2 (Bota Bota)',
    btp8ZTRxuE0: '2ES FT. SELOP - BAILALO 💃🕺',
    _5JAMcVudu0: '2ES - AFROCAT Part. 3 (Falta Personal)',
    'SGxoz-PItYs': '2ES - #LOOKATME X #VÍCTIMES⚡',
    S4LkxDs6Sho: '2ES & SELOP - COSAS MALAS',
    AZhrKRDrTEc: 'ROSALÍA & Travis Scott - TKN (Catalan UNOFFICIAL RMX by Edu Esteve) ⚡',
};
const titles = { ...songs, lGT_JGeoULk: '2ES & SELOP - BYE BYE', GtDCepBTk7o: "2ES feat. Selop - It's my time" };
const ids = new Set(Object.keys(titles));
const note = 'Petició editorial explícita del 2026-10-11: incorporar les cançons de 2ES excepte BYE BYE i It’s my time.';
const overrides = read('data/music-content-overrides.json');
const previousOverrides = JSON.stringify(overrides.videos);
const decisions = Object.entries(titles).map(([id, title]) => ({ id, title, contentType: excluded.has(id) ? 'other' : 'song', note }));
overrides.videos = [...overrides.videos.filter(v => !ids.has(v.id)), ...decisions];
if (JSON.stringify(overrides.videos) !== previousOverrides) {
    overrides.updatedAt = '2026-10-11T21:00:00.000Z';
    write('data/music-content-overrides.json', overrides);
}
const hidden = read('data/hidden-videos.json');
hidden.videoIds = [...new Set([...hidden.videoIds, ...excluded])].sort();
write('data/hidden-videos.json', hidden);
assert(Object.keys(songs).every(id => !hidden.videoIds.includes(id)), 'Una cançó aprovada té una exclusió anterior que cal revisar');

const catalog = read('data/artistes-musica.json');
const artist = catalog.artists.find(a => a.name === '2ES');
assert(artist && artist.youtube.channels.some(c => c.id === channelId));
if (!artist.genres.includes('Urbana')) {
    artist.genres.push('Urbana');
    artist.sources = [...new Set([...artist.sources, 'genre:manual', 'manual-user-2026-10-11'])];
    artist.notes += ' ' + note + ' Gènere Urbana segons la presentació del canal (catalan urban music).';
    catalog.updatedAt = '2026-10-11T21:00:00.000Z';
    write('data/artistes-musica.json', catalog);
}
const feed = read('data/feed.json');
const archivePath = 'data/archive/channels/' + channelId + '.json';
const archive = read(archivePath);
const existing = new Map([...archive.videos, ...feed.videos.filter(v => v.channelId === channelId)].map(v => [v.id, v]));
assert(Object.keys(songs).every(id => existing.has(id)), 'Falten metadades verificades');
assert([...existing.values()].every(v => v.channelId === channelId));
const snapshot = { feed: { videos: [...existing.values()] }, review: read('data/music-content-review.json'), contentAudit: read('data/music-content-audit.json'), feedAudit: read('data/music-feed-audit.json'), falseShortIds: new Set() };
const changes = applyOverridesToSnapshot(snapshot, parseContentOverrides({ videos: decisions }));
const approved = snapshot.feed.videos.filter(v => Object.hasOwn(songs, v.id)).map(v => slimFeedVideo({ ...v, genres: ['Urbana'], categories: ['Urban'], isShort: false, thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` }));
assert.equal(splitChannelVideos(approved).hot.length, 9, 'Les 9 cançons han de cabre al feed calent');
const before = JSON.stringify(feed);
feed.videos = [...feed.videos.filter(v => v.channelId !== channelId), ...approved].sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0));
feed.channels[channelId].genres = ['Urbana'];
feed.channels[channelId].categories = ['Urban'];
if (JSON.stringify(feed) !== before) {
    feed.generatedAt = '2026-10-11T21:00:00.000Z';
    fs.writeFileSync(path.join(root, 'data/feed.json'), serializeFeed(feed));
}
// Cap d'aquestes cançons ha de quedar duplicada com a pendent a l'arxiu.
archive.videos = archive.videos.filter(v => !ids.has(v.id));
archive.updatedAt = '2026-10-11T21:00:00.000Z';
fs.writeFileSync(path.join(root, archivePath), JSON.stringify(archive));
for (const [p, audit] of [['data/music-content-audit.json', snapshot.contentAudit], ['data/music-feed-audit.json', snapshot.feedAudit]]) {
    audit.publishedFeedVideoCount = feed.videos.length;
    write(p, audit);
}
write('data/music-content-review.json', snapshot.review);
write('docs/revisions/2026-10-11-2es.json', {
    reviewedOn: '2026-10-11', artist: '2ES', channelId,
    basis: note, source: 'https://www.youtube.com/@twoeazzy2/videos',
    publishedSongs: Object.entries(songs).map(([id, title]) => ({ id, title })),
    excluded: [...excluded].map(id => ({ id, title: titles[id] })),
    metadata: 'Metadades de l’arxiu del pipeline, contrastades amb els 11 vídeos públics del canal. Dates de pujada conservades. No s’infereix l’idioma només pel títol; s’aplica la selecció expressa de l’editor.',
});
console.log(`2ES: ${approved.length} cançons publicades, ${excluded.size} exclusions persistents; ${changes.length} classificacions actualitzades.`);
