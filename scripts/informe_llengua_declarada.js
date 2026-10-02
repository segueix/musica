'use strict';

// Informe de la llengua declarada a YouTube de les cançons publicades a Segueix Música: quines no tenen el català
// com a llengua de l'àudio o del títol i la descripció. Serveix per demanar als artistes que ho corregeixin a
// YouTube Studio (vegeu docs/LLENGUA_DECLARADA.md). Només llegeix el feed: no modifica res de l'app.
// Ús: node scripts/informe_llengua_declarada.js
// Genera docs/informes/llengua-declarada.csv (una fila per cançó) i actualitza la taula de docs/LLENGUA_DECLARADA.md.

const fs = require('fs');
const path = require('path');
const { isCategoryEligibleVideo } = require('../js/music-categories.js');

const ROOT = path.join(__dirname, '..');
const FEED_FILE = path.join(ROOT, 'data', 'feed.json');
const HIDDEN_FILE = path.join(ROOT, 'data', 'hidden-videos.json');
const ARTISTS_FILE = path.join(ROOT, 'data', 'artistes-musica.json');
const CSV_FILE = path.join(ROOT, 'docs', 'informes', 'llengua-declarada.csv');
const DOC_FILE = path.join(ROOT, 'docs', 'LLENGUA_DECLARADA.md');
const TABLE_START = '<!-- TAULA:INICI -->';
const TABLE_END = '<!-- TAULA:FI -->';

// Llengües que ja estan bé: català, aranès (occità) i «sense llengua» (instrumental).
const OK_LANGUAGES = new Set(['ca', 'oc', 'zxx']);

const base = value =>
    String(value || '')
        .trim()
        .toLowerCase()
        .split('-')[0];
const isOk = value => OK_LANGUAGES.has(base(value));
// Temes publicats per una distribuïdora («Provided to YouTube by…», canals «- Topic»): la llengua no es canvia a
// YouTube Studio sinó a la distribuïdora (DistroKid, CD Baby, The Orchard…).
const isDistributed = video =>
    /^provided to youtube/i.test(String(video.description || '')) || / - Topic$/.test(String(video.channelTitle || ''));

function displayNames() {
    const names = new Map();
    try {
        const db = JSON.parse(fs.readFileSync(ARTISTS_FILE, 'utf8'));
        (db.artists || []).forEach(artist => {
            const name = artist.displayName || artist.name;
            (artist.youtube?.channels || []).forEach(channel => channel?.id && names.set(channel.id, name));
        });
    } catch (error) {
        // Sense base d'artistes: es fa servir el nom del canal
    }
    return names;
}

function csvCell(value) {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildReport(feed, hiddenIds, names) {
    const songs = (feed.videos || []).filter(
        video => video?.id && !video.isShort && !hiddenIds.has(String(video.id)) && isCategoryEligibleVideo(video)
    );
    const pending = songs.filter(video => !isOk(video.defaultAudioLanguage) || !isOk(video.defaultLanguage));
    // Un artista pot tenir diversos canals (oficial, «- Topic»…): s'agrupen pel nom que es veu a l'app
    const artistOf = video => names.get(video.channelId) || video.channelTitle;
    const totals = new Map();
    songs.forEach(video => totals.set(artistOf(video), (totals.get(artistOf(video)) || 0) + 1));
    const byArtist = new Map();
    pending.forEach(video => {
        const key = artistOf(video);
        const row = byArtist.get(key) || {
            artist: key,
            total: totals.get(key) || 0,
            audio: 0,
            meta: 0,
            distributed: 0,
            videos: [],
        };
        if (!isOk(video.defaultAudioLanguage)) row.audio += 1;
        if (!isOk(video.defaultLanguage)) row.meta += 1;
        if (isDistributed(video)) row.distributed += 1;
        row.videos.push(video);
        byArtist.set(key, row);
    });
    const artists = [...byArtist.values()].sort(
        (a, b) => b.videos.length - a.videos.length || a.artist.localeCompare(b.artist, 'ca')
    );
    return { songs, pending, artists };
}

function toCsv(report) {
    const header = [
        'artista',
        'canal_youtube',
        'video_id',
        'titol',
        'llengua_audio',
        'llengua_titol_descripcio',
        'via',
        'editar_a_youtube_studio',
    ];
    const lines = [header.join(',')];
    report.artists.forEach(row =>
        row.videos.forEach(video =>
            lines.push(
                [
                    row.artist,
                    video.channelTitle,
                    video.id,
                    video.title,
                    video.defaultAudioLanguage || '(cap)',
                    video.defaultLanguage || '(cap)',
                    isDistributed(video) ? 'distribuïdora' : 'YouTube Studio',
                    `https://studio.youtube.com/video/${video.id}/edit`,
                ]
                    .map(csvCell)
                    .join(',')
            )
        )
    );
    return `${lines.join('\n')}\n`;
}

function toTable(report, generatedAt) {
    const rows = report.artists.map(
        row =>
            `| ${row.artist} | ${row.videos.length} de ${row.total} | ${row.audio} | ${row.meta} | ${row.distributed} |`
    );
    return [
        TABLE_START,
        `_Generat el ${generatedAt} amb \`node scripts/informe_llengua_declarada.js\`: ${report.pending.length} de ${report.songs.length} cançons publicades tenen alguna llengua per corregir, de ${report.artists.length} artistes. Detall per cançó (amb l'enllaç a YouTube Studio): \`docs/informes/llengua-declarada.csv\`._`,
        '',
        "| Artista | Cançons per corregir | Sense català a l'àudio | Sense català al títol i la descripció | Via distribuïdora |",
        '| --- | ---: | ---: | ---: | ---: |',
        ...rows,
        TABLE_END,
    ].join('\n');
}

function main() {
    const feed = JSON.parse(fs.readFileSync(FEED_FILE, 'utf8'));
    const hiddenIds = new Set((JSON.parse(fs.readFileSync(HIDDEN_FILE, 'utf8')).videoIds || []).map(String));
    const report = buildReport(feed, hiddenIds, displayNames());
    fs.mkdirSync(path.dirname(CSV_FILE), { recursive: true });
    fs.writeFileSync(CSV_FILE, toCsv(report));
    const doc = fs.readFileSync(DOC_FILE, 'utf8');
    const start = doc.indexOf(TABLE_START);
    const end = doc.indexOf(TABLE_END);
    if (start < 0 || end < 0) throw new Error(`Falten les marques ${TABLE_START} / ${TABLE_END} a ${DOC_FILE}`);
    const generatedAt = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(DOC_FILE, doc.slice(0, start) + toTable(report, generatedAt) + doc.slice(end + TABLE_END.length));
    console.log(
        `✅ ${report.pending.length} de ${report.songs.length} cançons per corregir (${report.artists.length} artistes).`
    );
    console.log('   docs/informes/llengua-declarada.csv i la taula de docs/LLENGUA_DECLARADA.md actualitzats.');
}

if (require.main === module) main();

module.exports = { isOk, isDistributed, buildReport, toCsv };
