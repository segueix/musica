#!/usr/bin/env node
'use strict';

// Ràdios de temporada d'Inici (docs/RADIOS_TEMPORADA.md): «Ràdio de tardor», i més endavant la de Nadal. La selecció
// de cançons de data/radios-temporada.json (`songs`) és manual; aquest script hi escriu `videos` amb les dades que
// l'app necessita per fer-les sonar (de les cançons del catàleg públic, `loadCatalog()`), perquè l'app no hagi de
// baixar l'arxiu de cada artista. No consulta YouTube.
//
//   node scripts/generar_radios_temporada.js            escriu els vídeos
//   node scripts/generar_radios_temporada.js --check    només comprova que totes les cançons hi són
//
// Una ràdio amb `outsideCatalog` (la de tardor) també pot portar cançons de fora del catàleg públic: vegeu topicSongs().

const fs = require('node:fs');
const path = require('node:path');
const { loadCatalog } = require('./generar_web_estatica.cjs');
const { publicVideo } = require('./lib/llista_exits.js');
const { cleanTitle } = require('../js/song-title.js');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'data/radios-temporada.json');
// La música infantil no hi entra (se sent en bucle i no és per a tothom), llevat dels artistes de `allowInfantil`
const INFANTIL = 'Infantil';
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));

// Excepció (`outsideCatalog`, petició de l'usuari del 24/10/2026 per a la ràdio de tardor): a més del catàleg públic,
// 1) les cançons que passen tots els filtres però queden fora pel límit de 21 per artista (`loadCatalog(unlimited)`) i
// 2) les pistes de les discografies «Tema» (data/music-topic-catalog.json) d'artistes de l'app, no amagades ni
// restringides, només si l'artista és de confiança de llengua (data/artistes-vigilats-idioma.json) o és a
// `outsideCatalog.languageOk` amb el motiu.
function topicSongs(radio, catalog, root = ROOT) {
    const ok = new Set((radio.outsideCatalog?.languageOk || []).map(item => String(item.channelId || item)));
    const trusted = new Set();
    for (const artist of read('data/artistes-vigilats-idioma.json').confianca || []) {
        for (const id of artist.canals || []) trusted.add(String(id));
    }
    const hidden = new Set(read('data/hidden-videos.json').videoIds || []);
    const restrictedFile = path.join(root, 'data/videos-restringits.json');
    if (fs.existsSync(restrictedFile)) Object.keys(read('data/videos-restringits.json').videos || {}).forEach(id => hidden.add(id));
    const songs = new Map();
    for (const [channelId, channel] of Object.entries(read('data/music-topic-catalog.json').channels || {})) {
        const artist = catalog.artistByChannel.get(channelId);
        if (!artist || !(trusted.has(channelId) || ok.has(channelId))) continue;
        for (const [id, title] of channel.tracks || []) {
            if (!id || hidden.has(id) || /\(instrumental\)/i.test(title)) continue;
            songs.set(id, {
                id,
                title: cleanTitle(title, { artists: [artist.name, channel.name].filter(Boolean) }),
                channelId,
                artist: artist.name,
                categories: artist.categories || [],
                contentType: 'song',
            });
        }
    }
    return songs;
}

function buildVideos(radio, catalog, wide = null) {
    const byId = new Map(catalog.songs.map(song => [song.id, song]));
    if (wide) {
        for (const [id, song] of wide.topic) if (!byId.has(id)) byId.set(id, song);
        for (const song of wide.songs) byId.set(song.id, song);
    }
    const allowed = new Set((radio.allowInfantil || []).map(String));
    const videos = [];
    const missing = [];
    const seen = new Set();
    for (const entry of radio.songs || []) {
        const id = String(entry?.id || entry || '');
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const song = byId.get(id);
        if (!song) {
            missing.push(entry?.cancó || id);
            continue;
        }
        if ((song.categories || []).includes(INFANTIL) && !allowed.has(String(song.channelId))) {
            missing.push(`${entry?.cancó || id} (infantil)`);
            continue;
        }
        const artist = (wide?.artistByChannel || catalog.artistByChannel).get(song.channelId);
        videos.push(publicVideo({ ...song, artist: artist?.name || song.artist }));
    }
    return { videos, missing };
}

function main() {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    const catalog = loadCatalog(ROOT, { now: Date.now() });
    let unlimited = null;
    let missingTotal = 0;
    for (const radio of data.radios || []) {
        let wide = null;
        if (radio.outsideCatalog) {
            unlimited = unlimited || loadCatalog(ROOT, { unlimited: true });
            wide = { songs: unlimited.songs, artistByChannel: unlimited.artistByChannel, topic: topicSongs(radio, unlimited) };
        }
        const { videos, missing } = buildVideos(radio, catalog, wide);
        radio.videos = videos;
        missingTotal += missing.length;
        console.log(`📻 ${radio.name}: ${videos.length} cançons de ${new Set(videos.map(v => v.channelId)).size} artistes`);
        missing.forEach(item => console.log(`   ⚠️  fora del catàleg públic: ${item}`));
    }
    if (process.argv.includes('--check')) {
        process.exitCode = missingTotal ? 1 : 0;
        return;
    }
    data.generatedAt = new Date().toISOString();
    fs.writeFileSync(FILE, `${JSON.stringify(data, null, 2)}\n`);
}

if (require.main === module) main();

module.exports = { buildVideos, topicSongs };
