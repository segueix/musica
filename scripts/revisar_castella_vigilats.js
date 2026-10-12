'use strict';

// Llista les cançons visibles dels artistes de data/artistes-vigilats-idioma.json (oficial + Topic), per repassar-les a mà
// i amagar-ne les que siguin en castellà o basc (vegeu el document: com es fa servir).
// Només llegeix: no modifica res. Ús:
//   node scripts/revisar_castella_vigilats.js [--since=YYYY-MM-DD] [--artista="Nom"]

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const { loadPolicy } = require('./lib/revisio_idiomes');
const FEED_FILE = path.join(ROOT, 'data', 'feed.json');
const HIDDEN_FILE = path.join(ROOT, 'data', 'hidden-videos.json');

// Compatibilitat amb informes històrics; NO és la font operativa. Artistes de la taula del document: la primera cel·la de cada fila és **Nom exacte al feed**.
function parseArtists(markdown) {
    const names = [];
    String(markdown || '')
        .split('\n')
        .forEach((line) => {
            const match = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|/);
            if (match && !names.includes(match[1])) names.push(match[1]);
        });
    return names;
}

// Cançons visibles (no ocultes) d'un artista, les més noves primer.
function visibleSongs(feed, hiddenIds, artist, since = '', policy) {
    return (feed?.videos || [])
        .filter((video) => (policy ? policy.resolve(video).artista === artist : video.channelTitle === artist))
        .filter((video) => ['song', 'live_song'].includes(video.contentType))
        .filter((video) => !hiddenIds.has(String(video.id)))
        .filter((video) => !since || String(video.publishedAt || '').slice(0, 10) >= since)
        .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
}

function argValue(name) {
    const prefix = `--${name}=`;
    const arg = process.argv.find((item) => item.startsWith(prefix));
    return arg ? arg.slice(prefix.length) : '';
}

function main() {
    const since = argValue('since');
    const only = argValue('artista');
    const feed = JSON.parse(fs.readFileSync(FEED_FILE, 'utf8'));
    const hiddenIds = new Set((JSON.parse(fs.readFileSync(HIDDEN_FILE, 'utf8')).videoIds || []).map(String));
    const policy = loadPolicy();
    const artists = policy.entries
        .filter((entry) => entry.mode === 'vigilats')
        .filter((entry) => !only || [entry.artista, ...(entry.aliases || [])].includes(only))
        .map((entry) => entry.artista);
    if (!artists.length) {
        console.log(`Cap artista${only ? ` «${only}»` : ''} al registre data/artistes-vigilats-idioma.json.`);
        return;
    }
    let total = 0;
    artists.forEach((artist) => {
        const songs = visibleSongs(feed, hiddenIds, artist, since, policy);
        if (!songs.length) return;
        total += songs.length;
        console.log(`\n== ${artist} (${songs.length})`);
        songs.forEach((video) =>
            console.log(`${video.id}  ${String(video.publishedAt || '').slice(0, 10)}  ${video.title}`)
        );
    });
    console.log(
        `\n${total} cançons visibles de ${artists.length} artistes vigilats${since ? ` des de ${since}` : ''}.`
    );
}

if (require.main === module) main();
module.exports = { parseArtists, visibleSongs };
