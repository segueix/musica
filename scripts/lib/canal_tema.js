'use strict';

// «Mana el canal Tema». Els canals «Artista - Tema» (Topic) de YouTube tenen la discografia editada de l'artista,
// cançó per cançó i ordenada per discos, sense entrevistes, teasers ni assajos. Quan un artista en té:
//   - la discografia del Tema és la llista de cançons de l'artista;
//   - del canal propi de l'artista només hi entren les cançons que també són al Tema (el videoclip o el directe
//     d'una cançó editada), els Shorts i el que s'hagi decidit a mà (data/music-content-overrides.json); la resta
//     queda com a «other» (no surt a la ràdio, ni a les categories, ni a la fitxa);
//   - si el videoclip d'una cançó ja hi és, la pista d'àudio del Tema no hi entra (no surt repetida);
//   - si una cançó de l'artista està amagada (castellà...), la mateixa cançó del Tema també.
// Funcions pures: scripts/update_music_feed.js hi posa les dades de l'API.

const { cleanTitle } = require('../../js/song-title.js');

const DEFAULTS = Object.freeze({
    // Un Tema amb menys cançons no mana (pot ser un senzill solt o una col·laboració).
    minTopicTracks: 5,
    // Pistes del Tema que entren al feed: les més escoltades i totes les publicades fa poc (novetats).
    topicKeep: 40,
    recentDays: 180,
});

const SONG_TYPES = new Set(['song', 'live_song']);

function fold(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase();
}

// Clau d'una cançó per comparar títols de canals diferents: sense l'artista, sense «videoclip / oficial»,
// sense parèntesis («(En directe)», «(Remastered 2015)»), sense «feat.» i sense el que va després d'un « - ».
function songKey(title, artists = []) {
    const clean = cleanTitle(String(title || ''), { artists });
    let text = fold(clean)
        .replace(/\.(?:m4v|mp4|mov|avi|wmv|mkv)\b/g, ' ')
        .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
        .replace(/\s(?:feat\.?|ft\.?|featuring)\s.*$/, ' ');
    const dash = text.split(/\s[-–—|]\s/);
    if (dash.length > 1 && dash[0].trim()) text = dash[0];
    return text
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function keysOf(tracks, artists) {
    const keys = new Set();
    for (const track of tracks || []) {
        const key = songKey(track.title, artists);
        if (key) keys.add(key);
    }
    return keys;
}

// Classificació d'un vídeo del canal propi d'un artista que té Tema.
// keys: claus de la discografia del Tema (null si l'artista no en té prou: no mana).
function governClassification(classification, { key, keys, overridden = false, isShort = false } = {}) {
    if (!keys || overridden || isShort || !classification) return classification;
    const type = classification.contentType;
    if (type === 'album') return classification;
    const matched = Boolean(key) && keys.has(key);
    if (matched) {
        if (SONG_TYPES.has(type)) return classification;
        if (type === 'review') {
            return {
                ...classification,
                accepted: true,
                contentType: 'song',
                reason: 'cançó de la discografia del canal Tema',
            };
        }
        return classification;
    }
    if (SONG_TYPES.has(type) || type === 'review') {
        return {
            ...classification,
            accepted: false,
            contentType: 'other',
            reason: 'no és a la discografia del canal Tema',
        };
    }
    return classification;
}

// Pistes del Tema que entren al feed. tracks: [{ id, key, viewCount, publishedAt }]
// Una pista per cançó (la més escoltada), cap de les que ja tenen videoclip (coveredKeys) i, d'entre la resta,
// les publicades fa menys de recentDays més les topicKeep més escoltades.
function selectTopicTracks(tracks, { coveredKeys = new Set(), now = Date.now(), keep, recentDays } = {}) {
    const limit = keep ?? DEFAULTS.topicKeep;
    const recentMs = (recentDays ?? DEFAULTS.recentDays) * 86400000;
    const best = new Map();
    for (const track of tracks || []) {
        if (!track?.id) continue;
        const key = track.key || `id:${track.id}`;
        const previous = best.get(key);
        if (!previous || (Number(track.viewCount) || 0) > (Number(previous.viewCount) || 0))
            best.set(key, { ...track, key });
    }
    const candidates = [...best.values()].filter(track => !coveredKeys.has(track.key));
    const byViews = [...candidates].sort(
        (a, b) => (Number(b.viewCount) || 0) - (Number(a.viewCount) || 0) || String(a.id).localeCompare(String(b.id))
    );
    const chosen = new Set(byViews.slice(0, limit).map(track => track.id));
    for (const track of candidates) {
        const time = Date.parse(track.publishedAt || '') || 0;
        if (time && now - time <= recentMs) chosen.add(track.id);
    }
    return byViews.filter(track => chosen.has(track.id)).map(track => track.id);
}

module.exports = { DEFAULTS, songKey, keysOf, governClassification, selectTopicTracks };
