#!/usr/bin/env node
'use strict';

// Ràdios de temporada d'Inici (docs/RADIOS_TEMPORADA.md): «Ràdio de tardor», i més endavant la de Nadal. La selecció
// de cançons de data/radios-temporada.json (`songs`) és manual; aquest script hi escriu `videos` amb les dades que
// l'app necessita per fer-les sonar (de les cançons del catàleg públic, `loadCatalog()`), perquè l'app no hagi de
// baixar l'arxiu de cada artista. No consulta YouTube.
//
//   node scripts/generar_radios_temporada.js            escriu els vídeos
//   node scripts/generar_radios_temporada.js --check    només comprova que totes les cançons hi són

const fs = require('node:fs');
const path = require('node:path');
const { loadCatalog } = require('./generar_web_estatica.cjs');
const { publicVideo } = require('./lib/llista_exits.js');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'data/radios-temporada.json');
// La música infantil no hi entra (se sent en bucle i no és per a tothom), llevat dels artistes de `allowInfantil`
const INFANTIL = 'Infantil';

function buildVideos(radio, catalog) {
    const byId = new Map(catalog.songs.map(song => [song.id, song]));
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
        const artist = catalog.artistByChannel.get(song.channelId);
        videos.push(publicVideo({ ...song, artist: artist?.name || song.artist }));
    }
    return { videos, missing };
}

function main() {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    const catalog = loadCatalog(ROOT, { now: Date.now() });
    let missingTotal = 0;
    for (const radio of data.radios || []) {
        const { videos, missing } = buildVideos(radio, catalog);
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

module.exports = { buildVideos };
