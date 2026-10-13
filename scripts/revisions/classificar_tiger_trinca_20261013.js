'use strict';

// Canvi editorial de categories, sense consultar YouTube ni modificar enregistraments.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
process.chdir(path.resolve(__dirname, '../..'));
const { CATEGORY_GROUPS } = require('../../js/music-categories.js');
const { serializeFeed } = require('../lib/aprimar_feed');
const REPORT = 'docs/revisions/2026-10-13-tiger-trinca-categories.json';
const SUMMARY = 'docs/revisions/2026-10-13-tiger-trinca-categories.md';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const clone = value => JSON.parse(JSON.stringify(value));
const norm = value => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const unique = values => [...new Set(values)];
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const categories = genres => CATEGORY_GROUPS.filter(group => group.genres.some(genre => genres.includes(genre))).map(group => group.label);
const META = ['genres', 'categories', 'category', 'primaryCategory', 'primaryGenre'];

function transform(payload, channelMap, check = false) {
    let matched = 0;
    function visit(value, key = '') {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) { value.forEach(item => visit(item)); return; }
        const channelId = value.channelId || (channelMap.has(value.id) ? value.id : '') || (channelMap.has(key) ? key : '');
        const artist = channelMap.get(channelId);
        if (artist && META.some(field => Object.hasOwn(value, field))) {
            matched++;
            const expected = {genres:artist.genres, categories:artist.categories, category:artist.primaryCategory,
                primaryCategory:artist.primaryCategory, primaryGenre:artist.genres[0]};
            for (const field of META) if (Object.hasOwn(value, field)) {
                if (check) assert.deepEqual(value[field], expected[field], channelId + ': ' + field);
                else value[field] = clone(expected[field]);
            }
        }
        for (const [childKey, child] of Object.entries(value)) if (!META.includes(childKey)) visit(child, childKey);
    }
    visit(payload);
    return matched;
}

function apply() {
    const baseFile = 'data/artistes-musica.json';
    const original = read(baseFile);
    const base = clone(original);
    const taxonomy = new Set(read('data/music-genres.json').categories.map(category => category.label));
    assert(taxonomy.has('Electrònica') && taxonomy.has('Altres'), 'Taxonomia inesperada');
    const artists = [];
    const targetIndexes = [];
    for (const name of ['Tiger Menja Zebra', 'La Trinca']) {
        const hits = base.artists.map((artist, index) => ({artist,index})).filter(({artist}) =>
            [artist.name,artist.displayName,...(artist.aliases || [])].some(alias => norm(alias) === norm(name)));
        assert.equal(hits.length, 1, 'Identitat única: ' + name);
        const {artist,index} = hits[0];
        assert.notEqual(artist.reviewStatus, 'rebutjat', 'Artista rebutjat: ' + name);
        const channels = (artist.youtube?.channels || []).map(channel => channel.id);
        assert(channels.length && channels.every(id => /^UC[A-Za-z0-9_-]{22}$/.test(id)), 'Canals invàlids: ' + name);
        const before = clone(artist.genres || []);
        // Només La Trinca té petició expressa d'exclusivitat. Electrònica passa a ser el principal de Tiger.
        artist.genres = name === 'La Trinca' ? ['Altres'] : unique(['Electrònica', ...before]);
        artist.sources = unique([...(artist.sources || []), 'genre:manual', 'manual-user-2026-10-13-categories']);
        artists.push({name, canonicalName:artist.name, before, genres:clone(artist.genres), categories:categories(artist.genres),
            primaryCategory:categories(artist.genres.slice(0, 1))[0], channels});
        targetIndexes.push(index);
    }
    const channelMap = new Map();
    for (const artist of artists) for (const id of artist.channels) {
        assert(!channelMap.has(id), 'Canal compartit entre les dues identitats');
        channelMap.set(id, artist);
    }
    base.artists.forEach((artist,index) => {
        if (targetIndexes.includes(index)) {
            const restored = {...artist, genres:original.artists[index].genres, sources:original.artists[index].sources};
            assert.deepEqual(restored, original.artists[index], 'Canvi no autoritzat a la identitat');
        } else {
            assert(!(artist.youtube?.channels || []).some(channel => channelMap.has(channel.id)), 'Canal amb una segona identitat');
            assert.deepEqual(artist, original.artists[index], 'Artista aliè modificat');
        }
    });
    assert.equal(base.artists.length, original.artists.length);
    base.updatedAt = new Date().toISOString();
    const paths = ['js/channels-ca.json', 'data/feed.json', 'data/history-pool.json', 'data/historial-musical.json',
        ...[...channelMap.keys()].map(id => 'data/archive/channels/' + id + '.json')].filter(file => fs.existsSync(file));
    const prepared = [];
    const files = [];
    for (const file of paths) {
        const previous = read(file);
        const next = clone(previous);
        const matched = transform(next, channelMap);
        const changed = JSON.stringify(previous) !== JSON.stringify(next);
        // La transformació substitueix exclusivament camps de gènere/categoria dels canals seleccionats.
        transform(next, channelMap, true);
        files.push({file, matched, changed, expectedHash:digest(next)});
        if (changed) prepared.push({file, next});
    }
    const published = read('js/channels-ca.json').channels;
    for (const id of channelMap.keys()) assert(published.some(channel => channel.id === id), 'Canal no publicat: ' + id);
    write(baseFile, base);
    for (const {file,next} of prepared) {
        if (file === 'data/feed.json') fs.writeFileSync(file, serializeFeed(next));
        else write(file,next);
    }
    const report = {reviewedOn:'2026-10-13', status:'applied', artists,
        method:'Assignació editorial explícita. Electrònica principal a Tiger Menja Zebra, conservant els altres gèneres previs; La Trinca exclusivament a Altres estils. Marques manuals persistents.',
        youtubeRequests:0, unrelatedArtistsPreserved:base.artists.length - 2,
        recordingsAdded:0, recordingsRemoved:0,
        canonicalHash:digest(base), files,
        protectedFiles:Object.fromEntries(['data/hidden-videos.json','data/music-channel-video-allowlist.json','data/origens-artistes.json'].map(file => [file,digest(read(file))]))};
    write(REPORT,report);
    console.log(JSON.stringify({artists, changedFiles:prepared.map(item => item.file)}));
}

function verify() {
    const report = read(REPORT);
    const base = read('data/artistes-musica.json');
    assert.equal(digest(base), report.canonicalHash, 'La base ha canviat després de la revisió');
    const channelMap = new Map(report.artists.flatMap(artist => artist.channels.map(id => [id,artist])));
    for (const file of report.files) {
        const data = read(file.file);
        assert.equal(digest(data),file.expectedHash,'Canvi no previst: '+file.file);
        transform(data,channelMap,true);
    }
    for (const [file,hash] of Object.entries(report.protectedFiles)) assert.equal(digest(read(file)),hash,'Fitxer protegit modificat: '+file);
    for (const artist of report.artists) {
        const actual = base.artists.find(item => item.name === artist.canonicalName);
        assert.deepEqual(actual.genres,artist.genres);
        assert(actual.sources.includes('genre:manual'));
        if (artist.name === 'La Trinca') assert.deepEqual(artist.categories,['Altres estils']);
        else assert.equal(artist.primaryCategory,'Electrònica');
    }
    report.status = 'verified'; report.verifiedAt = new Date().toISOString();
    write(REPORT,report);
    fs.writeFileSync(SUMMARY, '# Categories de Tiger Menja Zebra i La Trinca\n\n' +
        report.artists.map(artist => '- '+artist.name+': '+artist.categories.join(', ')+'. Principal: '+artist.primaryCategory+'. Gèneres anteriors: '+artist.before.join(', ')+'. Canals: '+artist.channels.length+'.').join('\n')+
        '\n\nClassificació manual persistent. Cap cançó afegida ni eliminada; cap consulta a YouTube. Catàleg, feed i arxius contrastats. La resta d’artistes, els filtres d’idioma i els orígens es mantenen.\n');
    console.log('Classificacions i conservació del catàleg verificades.');
}
if (require.main === module) {
    try { process.argv.includes('--verify') ? verify() : apply(); }
    catch (error) { console.error(error.stack); process.exitCode = 1; }
}
module.exports = {transform, categories};
