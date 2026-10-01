'use strict';

// Llista les cançons visibles al feed dels artistes de docs/ARTISTES_CASTELLA.md, per repassar-les a mà
// i amagar-ne les que siguin en castellà o basc (vegeu el document: com es fa servir).
// Només llegeix: no modifica res. Ús:
//   node scripts/revisar_castella_vigilats.js [--since=YYYY-MM-DD] [--artista="Nom"]

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DOC_FILE = path.join(ROOT, 'docs', 'ARTISTES_CASTELLA.md');
const FEED_FILE = path.join(ROOT, 'data', 'feed.json');
const HIDDEN_FILE = path.join(ROOT, 'data', 'hidden-videos.json');

// Artistes de la taula del document: la primera cel·la de cada fila és **Nom exacte al feed**.
function parseArtists(markdown) {
    const names = [];
    String(markdown || '')
        .split('\n')
        .forEach(line => {
            const match = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|/);
            if (match && !names.includes(match[1])) names.push(match[1]);
        });
    return names;
}

// Cançons visibles (no ocultes) d'un artista, les més noves primer.
function visibleSongs(feed, hiddenIds, artist, since = '') {
    return (feed?.videos || [])
        .filter(video => video.channelTitle === artist)
        .filter(video => ['song', 'live_song'].includes(video.contentType))
        .filter(video => !hiddenIds.has(String(video.id)))
        .filter(video => !since || String(video.publishedAt || '').slice(0, 10) >= since)
        .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
}

function argValue(name) {
    const prefix = `--${name}=`;
    const arg = process.argv.find(item => item.startsWith(prefix));
    return arg ? arg.slice(prefix.length) : '';
}

function main() {
    const since = argValue('since');
    const only = argValue('artista');
    const feed = JSON.parse(fs.readFileSync(FEED_FILE, 'utf8'));
    const hiddenIds = new Set((JSON.parse(fs.readFileSync(HIDDEN_FILE, 'utf8')).videoIds || []).map(String));
    const artists = parseArtists(fs.readFileSync(DOC_FILE, 'utf8')).filter(name => !only || name === only);
    if (!artists.length) {
        console.log(`Cap artista${only ? ` «${only}»` : ''} a docs/ARTISTES_CASTELLA.md.`);
        return;
    }
    let total = 0;
    artists.forEach(artist => {
        const songs = visibleSongs(feed, hiddenIds, artist, since);
        if (!songs.length) return;
        total += songs.length;
        console.log(`\n== ${artist} (${songs.length})`);
        songs.forEach(video =>
            console.log(`${video.id}  ${String(video.publishedAt || '').slice(0, 10)}  ${video.title}`)
        );
    });
    console.log(
        `\n${total} cançons visibles de ${artists.length} artistes vigilats${since ? ` des de ${since}` : ''}.`
    );
}

if (require.main === module) main();
module.exports = { parseArtists, visibleSongs };
