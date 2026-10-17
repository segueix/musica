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
    // El Tema només mana si hi és la majoria de cançons del canal propi: si no, la discografia hi és incompleta
    // (molts artistes només hi tenen els discos recents) i en trauria cançons bones.
    minCoverage: 0.75,
    // Pistes del Tema que entren al feed: les més escoltades i totes les publicades fa poc (novetats).
    topicKeep: 40,
    recentDays: 366, // Reserva d’ingesta per cobrir 12 mesos, també en anys de traspàs.
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
    return normalizeKey(stripNumbers(normalizeKey(text)));
}

const SEPARATORS = /\s*[|·•+]\s*|\s*\/\/\s*|\s+\/\s*|\s*\/\s+|\s+[-–—]\s*|\s*[-–—]\s+|:\s+|\s@\s/;
const QUOTED = /['"‘’“”«»]([^'"‘’“”«»]{2,})['"‘’“”«»]/g;
const COLLAB = /\s(?:amb|feat\.?|ft\.?|featuring|with|con|x|vs\.?|&|prod\.?)\s.*$/;

function normalizeKey(text) {
    return String(text || '')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function stripNumbers(text) {
    return text.replace(/^\d{1,2}\s*[.)-]?\s+(?=\p{L})/u, '').replace(/(\p{L})\s+\d{1,2}$/u, '$1');
}

// Totes les claus possibles del títol d'un vídeo del canal propi («Aina - Dan Peralbo i El Comboi»,
// «AUXILI - 02. Si tu vols (Tresors, 2018)», «'El Calvari' d'Anna Andreu», «FOTOSÍNTESI amb ZOO»): cada tros
// separat per « - », «|», «:»…, el text entre cometes, sense número de pista i sense col·laboracions. N'hi ha
// prou que una sigui al Tema.
function songKeys(title, artists = []) {
    const artistKeys = new Set(artists.map(name => normalizeKey(fold(name))).filter(Boolean));
    const stripExtension = text => text.replace(/\.(?:m4v|mp4|mov|avi|wmv|mkv)\b/g, ' ');
    const clean = stripExtension(fold(cleanTitle(String(title || ''), { artists })));
    // El títol de YouTube sense el nom de l'artista (cleanTitle de vegades s'emporta la cançó: «SODI Temps Afegit»).
    let raw = ` ${stripExtension(fold(title))} `;
    for (const name of artistKeys)
        raw = raw.split(new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(name)}(?=$|[^\\p{L}\\p{N}])`, 'gu')).join(' ');
    const texts = [clean, raw];
    for (const text of [clean, raw]) {
        for (const match of text.matchAll(QUOTED)) texts.push(match[1]);
        // El que hi ha abans d'un parèntesi («Ara (videoclip) Translúcid») i el parèntesi desfet
        // («Tan a poc a poc (que me dorm)»).
        texts.push(text.split(/[([]/)[0], text.replace(/[()[\]]/g, ' '));
    }
    const keys = new Set();
    const add = text => {
        const key = normalizeKey(stripNumbers(normalizeKey(text)));
        if (key.length >= 2 && !artistKeys.has(key) && !/^\d{1,2}$/.test(key)) keys.add(key);
    };
    for (const text of texts) {
        const plain = text.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ');
        for (const part of [plain, ...plain.split(SEPARATORS)]) {
            add(part);
            add(part.replace(COLLAB, ' '));
            add(part.replace(/\s(?:d|de)\s?['’]?\s*\p{L}.*$/u, ' '));
        }
    }
    const main = songKey(title, artists);
    if (main && !artistKeys.has(main)) keys.add(main);
    return [...keys];
}

function escapeRegExp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Claus d'una pista del Tema: la principal i la del títol amb el parèntesi desfet («Tan a poc a poc (que me dorm)»).
function topicKeys(title, artists = []) {
    const keys = new Set([songKey(title, artists)]);
    keys.add(normalizeKey(stripNumbers(normalizeKey(fold(String(title || '')).replace(/[()[\]]/g, ' ')))));
    keys.delete('');
    return [...keys];
}

function keysOf(tracks, artists) {
    const keys = new Set();
    for (const track of tracks || []) for (const key of topicKeys(track.title, artists)) keys.add(key);
    return keys;
}

// El títol diu que és una cançó publicada (videoclip, lyric, àudio oficial, visualizer): es conserva encara que
// no sigui al Tema (molts Tema no tenen els senzills ni els discos antics).
const SONG_MARKER =
    /video\s*-?\s*clip|v[ií]deo\s+oficial|official\s+(?:music\s+)?video|music\s+video|lyrics?\b|l[ií]ric|visuali[sz]er|videomood|(?:audio|àudio)\s+oficial|official\s+audio|\((?:audio|àudio)\)|\[(?:audio|àudio)\]/i;
function hasSongMarker(title) {
    return SONG_MARKER.test(String(title || ''));
}

// La clau del Tema amb què coincideix el títol (o '' si no n'hi ha cap).
function matchedKey(title, artists, keys) {
    if (!keys) return '';
    return songKeys(title, artists).find(key => keys.has(key)) || '';
}

// Classificació d'un vídeo del canal propi d'un artista que té Tema.
// keys: claus de la discografia del Tema (null si l'artista no en té prou: no mana).
// key: una clau o una llista de claus possibles (songKeys); n'hi ha prou que una sigui al Tema.
function governClassification(classification, { key, keys, overridden = false, isShort = false, marked = false } = {}) {
    if (!keys || overridden || isShort || !classification) return classification;
    const type = classification.contentType;
    if (type === 'album') return classification;
    const matched = (Array.isArray(key) ? key : [key]).some(candidate => Boolean(candidate) && keys.has(candidate));
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
    if (marked && SONG_TYPES.has(type)) return classification;
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

// Pistes del Tema que entren al feed. tracks: [{ id, key, keys?, viewCount, publishedAt }] (keys: topicKeys)
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
    const candidates = [...best.values()].filter(
        track => !coveredKeys.has(track.key) && !(track.keys || []).some(key => coveredKeys.has(key))
    );
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

// ---------- Lectura per torns de les discografies Tema (quota de l'API) ----------
// Llegir cada dia les ~220 discografies senceres (≈ 19.000 pistes) costava unes 800 unitats de quota. Cada dia
// només es llegeix la primera pàgina (les 50 pistes més noves: hi surten les estrenes) i la discografia sencera
// d'una setena part dels canals, de manera que cada canal es llegeix sencer un cop per setmana.
const DAY_MS = 86400000;

function hash32(value) {
    let hash = 2166136261;
    for (const char of String(value || '')) {
        hash ^= char.codePointAt(0);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
}

// Torn d'un canal (0…days-1), estable: depèn només de l'ID.
function topicReadTurn(channelId, days = 7) {
    return hash32(channelId) % Math.max(1, days);
}

// Cal llegir avui la discografia sencera? Sí si li toca el torn, si encara no la tenim desada o si es força.
function shouldReadFullTopic(channelId, { date = new Date(), days = 7, hasCatalog = true, force = false } = {}) {
    if (force || !hasCatalog) return true;
    const day = Math.floor(new Date(date).getTime() / DAY_MS);
    return topicReadTurn(channelId, days) === ((day % days) + days) % days;
}

// Discografia d'un dia sense lectura sencera: les pistes de la primera pàgina (noves primer) i, darrere, les que
// ja teníem desades (sense repetir-les). tracks: [{ id, title }]; previous: [[id, title]] (music-topic-catalog.json)
function mergeTopicTracks(firstPage, previous) {
    const seen = new Set();
    const out = [];
    for (const track of firstPage || []) {
        if (!track?.id || seen.has(track.id)) continue;
        seen.add(track.id);
        out.push({ id: track.id, title: track.title || '' });
    }
    for (const entry of previous || []) {
        const [id, title] = Array.isArray(entry) ? entry : [entry?.id, entry?.title];
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push({ id, title: title || '' });
    }
    return out;
}

module.exports = {
    DEFAULTS,
    topicReadTurn,
    shouldReadFullTopic,
    mergeTopicTracks,
    songKey,
    songKeys,
    topicKeys,
    matchedKey,
    keysOf,
    hasSongMarker,
    governClassification,
    selectTopicTracks,
};
