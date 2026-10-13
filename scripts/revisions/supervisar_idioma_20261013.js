'use strict';
// Decisions documentals per ID. No infereix llengua del títol ni aprova la resta del catàleg.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../..');
const PREFIX = 'docs/revisions/2026-10-13-supervisio-idioma';
const BASELINE = '/tmp/supervisio-idioma-baseline.json';
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const write = (file, value, pretty = true) => fs.writeFileSync(path.join(ROOT, file), JSON.stringify(value, null, pretty ? 2 : undefined) + '\n');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const unique = values => [...new Set(values)];
const manifest = read(PREFIX + '-decisions.json');
const removed = new Set(manifest.remove.flatMap(group => group.ids));
const kept = new Set(manifest.keep.flatMap(group => group.ids));
const decided = new Set([...removed, ...kept]);
const source = id => 'https://www.youtube.com/watch?v=' + id;
const canonicalFiles = ['data/artistes-musica.json', 'data/origens-artistes.json', 'js/channels-ca.json', 'data/artistes-vigilats-idioma.json'];
function videoFiles() {
    return ['data/feed.json', 'data/history-pool.json', 'data/historial-musical.json',
        ...fs.readdirSync(path.join(ROOT, 'data/archive/channels')).filter(f => f.endsWith('.json')).sort().map(f => 'data/archive/channels/' + f)];
}
function inventory() {
    const feed = read('data/feed.json');
    const videos = new Map();
    for (const file of videoFiles().filter(f => f.startsWith('data/archive/'))) for (const v of read(file).videos) videos.set(v.id, v);
    for (const v of feed.videos) videos.set(v.id, v);
    return {feed, videos};
}
function visibleCount() {
    const {feed, videos} = inventory();
    const hidden = new Set(read('data/hidden-videos.json').videoIds);
    return [...videos.values()].filter(v => feed.channels[v.channelId] && !hidden.has(v.id) && v.isShort !== true && ['song', 'live_song'].includes(v.contentType)).length;
}
function preservation() {
    return {
        canonical: Object.fromEntries(canonicalFiles.map(f => [f, digest(fs.readFileSync(path.join(ROOT, f)))])),
        feedChannels: digest(JSON.stringify(read('data/feed.json').channels)),
        otherVideos: Object.fromEntries(videoFiles().map(f => [f, digest(JSON.stringify(read(f).videos.filter(v => !removed.has(v.id))))]))
    };
}
function validateManifest() {
    assert.equal(removed.size, 44); assert.equal(kept.size, 8);
    assert.equal(manifest.remove.flatMap(g => g.ids).length, removed.size);
    for (const id of decided) assert(/^[A-Za-z0-9_-]{11}$/.test(id), 'ID no vàlid: ' + id);
    for (const id of kept) assert(!removed.has(id), 'Decisió contradictòria: ' + id);
    for (const g of [...manifest.remove, ...manifest.keep]) {
        assert(g.reason && g.method && g.language);
        for (const url of g.sources) assert(/^https:\/\//.test(url));
    }
}
function apply() {
    process.chdir(ROOT); validateManifest();
    const now = new Date().toISOString();
    const {feed, videos} = inventory();
    const hidden = read('data/hidden-videos.json');
    const previousHidden = new Set(hidden.videoIds);
    const language = read('data/revisio-idiomes.json');
    const beforePending = [...(language.pendents || [])];
    const beforeVisible = visibleCount();
    const entries = [];
    for (const [action, groups] of [['amaga', manifest.remove], ['conserva', manifest.keep]]) for (const group of groups) for (const id of group.ids) {
        const video = videos.get(id);
        assert(video && feed.channels[video.channelId], 'Enregistrament no publicat: ' + id);
        if (group.channelIds) assert(group.channelIds.includes(video.channelId), 'Editor diferent: ' + id);
        const prior = (language.decisions || []).find(d => d.id === id);
        if (action === 'conserva') assert(!previousHidden.has(id) && prior?.accio !== 'amaga', 'No es recupera cap exclusió anterior: ' + id);
        const artist = group.artist || feed.channels[video.channelId].artists?.join(', ') || feed.channels[video.channelId].name;
        entries.push({id, action, artist, title:video.title, channelId:video.channelId, language:group.language,
            method:group.method, reason:group.reason, sources:unique([source(id), ...group.sources]),
            alreadyHidden:previousHidden.has(id), priorDecision:prior || null});
    }
    fs.writeFileSync(BASELINE, JSON.stringify({preservation:preservation(), previousHidden:[...previousHidden],
        undecidedPending:beforePending.filter(v => !decided.has(v.id)), visibleBefore:beforeVisible}));
    hidden.videoIds = unique([...hidden.videoIds, ...removed]); hidden.updatedAt = now;
    write('data/hidden-videos.json', hidden);
    language.decisions = (language.decisions || []).filter(d => !decided.has(d.id));
    for (const e of entries) language.decisions.push({id:e.id, accio:e.action, artista:e.artist, titol:e.title,
        font:e.method === 'lletra-oficial' ? source(e.id) : e.sources[1] || source(e.id), fonts:e.sources,
        llengua:e.language, metode:e.method, nota:e.reason, reutilitza:false, origen:PREFIX + '-resultat.json', data:now});
    language.revisades = unique([...(language.revisades || []), ...decided]).sort();
    for (const key of ['pendents', 'descartades', 'acceptadesPerArtista']) language[key] = (language[key] || []).filter(v => !decided.has(v.id));
    language.updatedAt = now; write('data/revisio-idiomes.json', language);
    // La llista global d'IDs ocults i les decisions persisteixen a cada generació.
    // Només es retallen les llistes blanques existents; no es creen filtres de títol.
    const allow = read('data/music-channel-video-allowlist.json'); let allowChanged = false;
    for (const rule of Object.values(allow.channels)) if (Array.isArray(rule.allowedVideoIds)) {
        const next = rule.allowedVideoIds.filter(id => !removed.has(id));
        if (next.length !== rule.allowedVideoIds.length) {rule.allowedVideoIds = next; allowChanged = true;}
    }
    if (allowChanged) {allow.updatedAt = now; write('data/music-channel-video-allowlist.json', allow);}
    const removedByFile = {};
    for (const file of videoFiles()) {
        const value = read(file), next = value.videos.filter(v => !removed.has(v.id));
        const count = value.videos.length - next.length;
        if (!count) continue;
        removedByFile[file] = count; value.videos = next;
        if ('generatedAt' in value) value.generatedAt = now;
        if ('updatedAt' in value) value.updatedAt = now;
        write(file, value, false);
    }
    const albums = read('data/albums-musica.json'); let albumsChanged = false;
    for (const artist of Object.values(albums.artists)) {
        for (const album of artist.albums || []) {
            const tracks = album.trackIds || [];
            if (!tracks.some(id => removed.has(id))) continue;
            albumsChanged = true;
            if (album.keys?.length === tracks.length) album.keys = album.keys.filter((_, i) => !removed.has(tracks[i]));
            album.trackIds = tracks.filter(id => !removed.has(id));
            if (album.trackGroups) album.trackGroups = album.trackGroups.map(g => ({...g, videoIds:g.videoIds.filter(id => !removed.has(id))})).filter(g => g.videoIds.length);
            if (removed.has(album.coverVideoId)) album.coverVideoId = album.trackIds[0] || '';
        }
        artist.albums = (artist.albums || []).filter(a => (a.trackIds || []).length);
    }
    if (albumsChanged) {albums.generatedAt = now; write('data/albums-musica.json', albums, false);}
    const topic = read('data/music-topic-catalog.json'); let topicChanged = false;
    for (const c of Object.values(topic.channels)) {
        const next = c.tracks.filter(track => !removed.has(track[0]));
        if (next.length !== c.tracks.length) {c.tracks = next; topicChanged = true;}
    }
    if (topicChanged) {topic.updatedAt = now; write('data/music-topic-catalog.json', topic, false);}
    const publishedFeed = read('data/feed.json');
    for (const file of ['data/music-feed-audit.json', 'data/music-content-audit.json']) {
        const audit = read(file); audit.publishedFeedVideoCount = publishedFeed.videos.length; write(file, audit);
    }
    const byArtist = {};
    for (const e of entries.filter(e => e.action === 'amaga')) byArtist[e.artist] = (byArtist[e.artist] || 0) + 1;
    const report = {reviewedOn:manifest.reviewedOn, appliedAt:now, criterion:manifest.criterion, scope:manifest.scope,
        visibleBefore:beforeVisible, visibleAfter:visibleCount(), removedRecordings:removed.size,
        newlyHidden:[...removed].filter(id => !previousHidden.has(id)).length, byArtist, removedByFile,
        excluded:entries.filter(e => e.action === 'amaga'), explicitlyKept:entries.filter(e => e.action === 'conserva'),
        pendingBefore:beforePending.length, pendingAfter:language.pendents.length,
        focusedPending:manifest.pendingFocusedChecks.flatMap(g => g.ids.map(id => ({id, artist:g.artist, title:videos.get(id)?.title || '', reason:g.reason, source:source(id)}))),
        limits:'No s’han escoltat totes les gravacions ni verificat totes les lletres. 17 baixes contrastades amb lletres oficials i 27 amb documentació de les edicions. Els casos no resolts no s’aproven ni s’oculten automàticament.'};
    write(PREFIX + '-resultat.json', report);
    console.log(JSON.stringify({removed:removed.size, byArtist, visibleAfter:report.visibleAfter, pendingAfter:report.pendingAfter}));
}
function verify() {
    process.chdir(ROOT); validateManifest();
    const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
    assert.deepEqual(preservation(), baseline.preservation, 'Ha canviat contingut aliè a les exclusions');
    const hidden = new Set(read('data/hidden-videos.json').videoIds);
    for (const id of baseline.previousHidden) assert(hidden.has(id), 'S’ha recuperat una baixa anterior');
    for (const id of removed) assert(hidden.has(id));
    const language = read('data/revisio-idiomes.json');
    assert.deepEqual(language.pendents, baseline.undecidedPending, 'S’ha alterat la cua no revisada');
    for (const file of videoFiles()) for (const video of read(file).videos) assert(!removed.has(video.id), file + ': ' + video.id);
    const additional = fs.readdirSync(path.join(ROOT, 'data')).filter(f => /^search_index_.*\.json$/.test(f)).map(f => 'data/' + f);
    additional.push('data/albums-musica.json', 'data/music-topic-catalog.json', 'data/llancaments-musicals.json');
    for (const file of additional) {
        const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
        for (const id of removed) assert(!text.includes(id), 'ID exclòs a ' + file);
    }
    for (const id of removed) assert(!fs.existsSync(path.join(ROOT, 'compartir/canco/' + id + '.html')));
    const {videos} = inventory();
    for (const id of kept) assert(videos.has(id) && !hidden.has(id), 'No s’ha conservat ' + id);
    const report = read(PREFIX + '-resultat.json');
    assert.equal(report.visibleBefore - report.visibleAfter, report.newlyHidden);
    report.verification = {status:'passed', checkedAt:new Date().toISOString(), nonTargetRecordingsUnchanged:true,
        artistCatalogUnchanged:true, previousExclusionsPreserved:true, playbackIndexesClean:true};
    write(PREFIX + '-resultat.json', report);
    const lines = ['# Supervisió general de Segueix Música — 13 d’octubre de 2026', '', report.criterion, '',
        '## Abast i resultat', '',
        'Cribratge de metadades: ' + report.scope.visibleRecordings + ' enregistraments musicals visibles, ' + report.scope.publishedChannels + ' canals. No equival a una escolta ni revisió íntegra de totes les lletres.', '',
        report.removedRecordings + ' enregistraments retirats de ' + Object.keys(report.byArtist).length + ' artistes. Queden ' + report.visibleAfter + ' enregistraments musicals visibles, sense donar-los tots per verificats.', '',
        ...Object.entries(report.byArtist).map(([name, n]) => '- ' + name + ': ' + n), '',
        '## Enregistraments retirats', '', ...report.excluded.map(e => '- ' + e.artist + ' — ' + e.title + ' — ' + e.language + ' — ' + e.id + '. Fonts: ' + e.sources.join(' ; ')), '',
        '## Casos contrastats que es conserven', '', ...report.explicitlyKept.map(e => '- ' + e.artist + ' — ' + e.title + ': ' + e.reason), '',
        '## Límits i pendents', '', report.limits, '',
        'La cua anterior tenia ' + report.pendingBefore + ' entrades pendents i ara en conserva ' + report.pendingAfter + '. Només se n’han tret els IDs decidits en aquesta revisió.', '',
        'S’han assenyalat ' + report.focusedPending.length + ' enregistraments per aprofundir, incloses possibles confusions d’homònims a Tesa i Still Ill. No són l’únic treball pendent del catàleg.', '',
        '## Verificació', '', 'Feed, arxiu, ràdios, cerca, discos i pàgines compartides nets dels 44 IDs. Fitxes d’artistes, canals, mapa, baixes anteriors i enregistraments no afectats preservats.'];
    fs.writeFileSync(path.join(ROOT, PREFIX + '-resultat.md'), lines.join('\n') + '\n');
    console.log('Supervisió verificada: 44 exclusions; resta del catàleg preservada.');
}
if (require.main === module) (process.argv.includes('--verify') ? verify : apply)();
module.exports = {manifest, removed, kept, PREFIX, validateManifest};
