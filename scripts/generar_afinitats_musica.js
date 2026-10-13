'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { CATEGORY_GROUPS } = require('../js/music-categories');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const save = (p, value) => fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n');
const norm = value => String(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const uniq = list => [...new Set(list)];
const db = read('data/artistes-musica.json');
const channels = read('js/channels-ca.json');
const reviews = read('data/music-affinity-review.json');
const allow = read('data/music-channel-video-allowlist.json').channels;
const indexed = new Set(channels.channels.map(c => c.id));
for (const [id, decision] of Object.entries(reviews.channelOwners || {})) {
    assert(db.artists.some(a => a.name === decision.artist && a.youtube?.channels?.some(c => c.id === id)), 'Titular editorial absent: ' + id);
    for (const a of db.artists) if (a.name !== decision.artist) a.youtube.channels = a.youtube.channels.filter(c => c.id !== id);
}
const artists = db.artists.filter(a => a.youtube?.channels?.some(c => indexed.has(c.id)));
const programNames = new Set(['Club Social Carme']);
const categoryOf = genres => CATEGORY_GROUPS.filter(c => c.genres.some(g => genres.includes(g))).map(c => c.label);
const reviewed = new Map(reviews.artists.map(a => [a.artist, a]));
const repaired = new Set([...reviewed.keys(), ...Object.values(reviews.channelOwners || {}).map(d => d.artist)]);
const restored = [];
for (const a of artists) {
    const review = reviewed.get(a.name);
    if (review) {
        if (!a.genres.length) restored.push(a.name);
        a.genres = review.genres;
        a.sources = uniq([...a.sources, ...review.sources, 'genre:manual']);
        a.genreReview = { reviewedAt: review.reviewedAt, method: review.method, sources: review.sources };
    }
    assert(programNames.has(a.name) || a.genres.length, 'Artista sense gènere: ' + a.name);
}
const canonical = new Map();
for (const a of artists) for (const c of a.youtube.channels.filter(c => indexed.has(c.id))) {
    assert(!canonical.has(c.id), 'Canal atribuït a dos artistes: ' + c.id);
    canonical.set(c.id, a);
}
// Refresca només metadades de gènere: no incorpora ni elimina cap vídeo.
let changedSongs = 0;
function refresh(item) {
    const a = canonical.get(item.channelId || item.id);
    if (!a || !repaired.has(a.name)) return;
    const categories = categoryOf(a.genres);
    if (JSON.stringify(item.categories) !== JSON.stringify(categories)) changedSongs++;
    item.categories = categories;
    item.genres = a.genres;
    if (reviews.channelOwners?.[item.channelId || item.id] && Array.isArray(item.artists)) item.artists = [a.name];
}
for (const c of channels.channels) refresh(c);
if (process.argv.includes('--repair-catalog')) {
    save('data/artistes-musica.json', db);
    save('js/channels-ca.json', channels);
    const files = ['data/feed.json', 'data/history-pool.json', 'data/historial-musical.json'];
    if (fs.existsSync('data/archive/channels')) files.push(...fs.readdirSync('data/archive/channels').filter(n => n.endsWith('.json')).map(n => 'data/archive/channels/' + n));
    for (const p of files.filter(p => fs.existsSync(p))) {
        const value = read(p), before = JSON.stringify(value);
        const walk = node => {
            if (!node || typeof node !== 'object') return;
            if (node.channelId) refresh(node);
            if (node.channels && !Array.isArray(node.channels)) for (const [id, c] of Object.entries(node.channels)) if (canonical.has(id) && repaired.has(canonical.get(id).name)) {
                c.categories = categoryOf(canonical.get(id).genres); c.genres = canonical.get(id).genres;
                if (reviews.channelOwners?.[id] && Array.isArray(c.artists)) c.artists = [canonical.get(id).name];
            }
            if (Array.isArray(node.channels)) node.channels.forEach(refresh);
            for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v);
        };
        walk(value);
        if (before !== JSON.stringify(value)) {
            if (p === 'data/feed.json') {
                const { slimFeed, serializeFeed } = require('./lib/aprimar_feed');
                fs.writeFileSync(p, serializeFeed(slimFeed(value)));
            } else save(p, value);
        }
    }
}
const family = {
    'Pop': ['pop'], 'Rock': ['rock'], 'Indie / Alternativa': ['indie'],
    'Urbana': ['urban'], 'Rap / Hip-hop': ['rap'], 'Folk i arrel': ['folk'],
    "Cançó d'autor": ['singer-songwriter'], 'Electrònica': ['electronic'],
    'Ska / Reggae': ['ska-reggae'], 'Rumba / Mestissatge': ['mestissatge'],
    'Punk': ['punk'], 'Metal': ['heavy-metal'], 'Jazz / Blues': ['jazz-blues'],
    'Infantil': ['children'], 'Funk / Soul / R&B': ['funk-soul-r-and-b'],
    'Experimental / Avantguarda': ['experimental'], 'Coral / Vocal': ['vocal'],
    'Altres': ['other'],
};
const aliases = {
    'pop-rock': ['pop','rock'], 'indie-pop': ['indie-pop','pop'], 'indie-rock': ['indie-rock','rock'],
    'musica-urbana': ['urban'], 'musica-electronica': ['electronic'], 'hip-hop': ['rap'],
    'rapejar': ['rap'], 'trap-llati': ['trap'], 'musica-de-cantautor': ['singer-songwriter'],
    'canco-d-autor': ['singer-songwriter'], 'musica-d-autor': ['singer-songwriter'],
    'musica-tradicional': ['traditional'], 'musica-tradicional-dels-paisos-catalans': ['traditional'],
    'rumba-catalana': ['rumba'], 'rumba-flamenca': ['rumba'], 'hardcore-punk': ['hardcore'],
    'oi': ['oi'], 'ska-rock': ['ska','rock'], 'ska-punk': ['ska','punk'],
    'rock-psicodelic': ['psychedelic-rock'], 'rock-progressiu': ['progressive-rock'],
    'musica-infantil': ['children'], 'musica-vocal': ['vocal'], 'r-b-contemporani': ['r-and-b'],
};
const knownRaw = new Set(read('data/music-genres.json').categories.flatMap(c => c.match.map(norm)));
const publishedVideos = read('data/feed.json').videos;
const profiles = artists.filter(a => !programNames.has(a.name)).map(a => {
    const review = reviewed.get(a.name);
    const raw = (a.genresRaw || []).map(norm).filter(x => knownRaw.has(x) || aliases[x]);
    const facets = review?.facets || (raw.length ? uniq(raw.flatMap(x => aliases[x] || [x])) : uniq(a.genres.flatMap(g => family[g] || [])));
    assert(facets.length, 'Sense afinitats: ' + a.name);
    const channelIds = a.youtube.channels.map(c => c.id).filter(id => indexed.has(id));
    const restrictions = Object.fromEntries(channelIds.filter(id => allow[id]).map(id => [id, Array.isArray(allow[id].allowedVideoIds) ? allow[id].allowedVideoIds : publishedVideos.filter(v => v.channelId === id).map(v => v.id)]));
    const sources = review?.sources || (a.sources || []).filter(s => /^https?:/.test(s));
    return { artist: a.name, channelIds, categories: categoryOf(a.genres), facets,
        confidence: review?.confidence || (raw.length ? 0.55 : 0.3),
        evidenceLevel: review ? 'reviewed' : raw.length ? 'catalog-genres' : 'category-only',
        sources: sources.length ? sources : ['data/artistes-musica.json'],
        reviewedAt: review?.reviewedAt || null,
        ...(Object.keys(restrictions).length ? { allowedVideoIdsByChannel: restrictions } : {}) };
});
const catalog = { schemaVersion: 1, profiles, relations: reviews.relations };
fs.writeFileSync('js/features/music-affinity-catalog.js', '/* eslint-disable */\n// Generat per scripts/generar_afinitats_musica.js. No editar a mà.\nwindow.SegueixMusicAffinityCatalog = ' + JSON.stringify(catalog) + ';\n');
const vm = require('node:vm');
const sandbox = { SegueixApp: { features: {} }, SegueixMusicAffinityCatalog: catalog };
sandbox.window = sandbox;
vm.runInNewContext(fs.readFileSync('js/features/music-affinities.js', 'utf8'), sandbox);
const runtimeProfiles = sandbox.SegueixApp.features.musicAffinities.profiles;
const { classifyProfiles } = require('./lib/subcategories_musicals');
const single = classifyProfiles(runtimeProfiles, artists, read('data/music-subcategories.json'),
    read('data/origens-artistes.json'), CATEGORY_GROUPS);
const singleCatalog = { schemaVersion: 2, ...single, relations: reviews.relations };
fs.writeFileSync('js/features/music-affinity-catalog.js', '/* eslint-disable */\n// Generat per scripts/generar_afinitats_musica.js. No editar a mà.\nwindow.SegueixMusicAffinityCatalog = ' + JSON.stringify(singleCatalog) + ';\n');
save('data/music-subcategory-coverage.json', {
    musicalArtists: single.profiles.length,
    minimumArtists: single.minimumArtists,
    subcategories: single.subcategories,
    assignments: single.profiles.map(p => ({ artist: p.artist, category: p.primaryCategory,
        subcategory: p.subcategory, basis: p.subcategoryBasis, sources: p.subcategorySources })),
});
const missingProfiles = artists.filter(a => !programNames.has(a.name) && !runtimeProfiles.some(p => p.artist === a.name && p.facets.length));
assert.equal(missingProfiles.length, 0, 'Cobertura incompleta');
const report = { indexedArtists: artists.length, musicalArtists: profiles.length, channels: indexed.size,
    withoutGenre: artists.filter(a => !programNames.has(a.name) && !a.genres.length).map(a=>a.name),
    withoutAffinity: missingProfiles.map(a => a.name), programs: [...programNames], restored, changedMetadata: changedSongs,
    evidenceLevels: Object.fromEntries(['detailed','reviewed','catalog-genres','category-only'].map(level => [level,runtimeProfiles.filter(p => p.evidenceLevel===level).length])),
    caveat: 'La cobertura bàsica per gènere no equival a revisió acústica ni a subestils verificats. Els perfils editorials detallats prevalen en carregar el motor.' };
save('data/music-affinity-coverage.json', report);
console.log(JSON.stringify(report));

