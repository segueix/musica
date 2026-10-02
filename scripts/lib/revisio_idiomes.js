'use strict';

// Revisió d'idioma de les cançons noves. Cada generació del feed (update_music_feed.js) afegeix a
// data/revisio-idiomes.json les cançons que hi entren per primera vegada («pendents»). Quan l'usuari ho demana, un
// agent (Claude) les revisa, li ensenya quines no són en català i, amb el seu vistiplau,
// scripts/aplicar_revisio_idiomes.js amaga aquestes (data/hidden-videos.json) i passa totes les pendents a
// «revisades», de manera que la llista torna a quedar buida fins que n'entrin de noves.

const { cleanTitle } = require('../../js/song-title.js');

const SONG_TYPES = new Set(['song', 'live_song']);

// Marques que el català no fa servir mai: el títol que en té es descarta sol (va a «descartades», on es pot
// recuperar si ha estat un error).
const MARKERS = [
    [/[ñÑ]/, 'ñ (castellà)'],
    [/[¿¡]/, '¿ ¡ (castellà)'],
    [/[áÁ]/, 'á (castellà)'],
    [/\p{L}ción(?:es)?(?![\p{L}])/iu, '-ción (castellà)'],
    [/[ãõâêôÃÕÂÊÔ]/, 'ã õ â ê ô (portuguès)'],
    [
        /[\u0370-\u03FF\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u0E00-\u0E7F\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]{2,}/u,
        'alfabet no llatí',
    ],
];

function escapeRegExp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Part del títol que és la cançó: sense l'artista ni els noms d'altres artistes (col·laboracions: «ft. Miki Núñez»),
// sense parèntesis ni claudàtors (context: «(Operación Triunfo 2018)», «(Sábado Noche, TVE-1)»).
function songPart(title, names = []) {
    let text = cleanTitle(String(title || ''), { artists: names });
    text = text
        .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
        .replace(/(?:^|[\s_])(?:feat\.?|ft\.?|featuring)\s?.*$/i, ' ')
        .replace(/\s(?:amb|with|con|x|&)\s.*$/i, ' ');
    for (const name of names) {
        if (String(name || '').trim().length < 3) continue;
        text = text.replace(new RegExp(`(^|[^\\p{L}])${escapeRegExp(name)}(?=$|[^\\p{L}])`, 'giu'), '$1 ');
    }
    return text.replace(/\s+/g, ' ').trim();
}

// Motiu pel qual el títol no és en català (o '' si no n'hi ha cap marca segura).
function detectNonCatalan(title, names = []) {
    const text = songPart(title, names);
    for (const [pattern, reason] of MARKERS) if (pattern.test(text)) return reason;
    return '';
}
const DESCRIPTION_EXCERPT = 160;

function emptyState() {
    return { updatedAt: null, pendents: [], descartades: [], revisades: [] };
}

function normalizeState(state) {
    return {
        updatedAt: state?.updatedAt || null,
        pendents: Array.isArray(state?.pendents) ? state.pendents.filter(item => item?.id) : [],
        descartades: Array.isArray(state?.descartades) ? state.descartades.filter(item => item?.id) : [],
        revisades: Array.isArray(state?.revisades) ? state.revisades.map(String) : [],
    };
}

function isReviewable(video) {
    return Boolean(video?.id) && SONG_TYPES.has(video.contentType) && video.isShort !== true;
}

function excerpt(text) {
    // Pistes «Provided to YouTube»: el que ajuda a decidir és el disc (la primera línia és la distribuïdora i la
    // segona repeteix el títol i l'artista).
    const lines = String(text || '')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
    if (/^provided to youtube/i.test(lines[0] || '') && lines[2])
        return `Disc: ${lines[2]}`.slice(0, DESCRIPTION_EXCERPT);
    const clean = String(text || '')
        .replace(/\s+/g, ' ')
        .trim();
    return clean.length > DESCRIPTION_EXCERPT ? `${clean.slice(0, DESCRIPTION_EXCERPT).trimEnd()}…` : clean;
}

function pendingEntry(video, addedAt) {
    return {
        id: String(video.id),
        artista: String(video.channelTitle || ''),
        titol: String(video.title || ''),
        descripcio: excerpt(video.description),
        publicada: String(video.publishedAt || '').slice(0, 10),
        afegida: addedAt,
    };
}

// Afegeix al document les cançons del feed que no s'han revisat mai: a «descartades» si el títol té una marca segura
// d'una altra llengua (la generació les treu del feed) i a «pendents» la resta. Treu de «pendents» les que ja no
// són al feed (ocultes o retirades); les descartades s'hi queden fins a la revisió. `hiddenIds`: les ja amagades
// no s'hi tornen a posar. `namesOf(video)`: noms d'artistes que no s'han de mirar (l'artista i els col·laboradors).
function updatePending(state, videos, { now = new Date().toISOString(), hiddenIds = new Set(), namesOf } = {}) {
    const current = normalizeState(state);
    const reviewed = new Set(current.revisades);
    const inFeed = new Map();
    for (const video of videos || []) {
        if (isReviewable(video) && !hiddenIds.has(String(video.id))) inFeed.set(String(video.id), video);
    }
    const pendents = current.pendents.filter(item => inFeed.has(String(item.id)));
    const descartades = current.descartades.filter(item => !hiddenIds.has(String(item.id)));
    const known = new Set([...pendents, ...descartades].map(item => String(item.id)));
    let added = 0;
    let discarded = 0;
    for (const [id, video] of inFeed) {
        if (reviewed.has(id) || known.has(id)) continue;
        const names = [video.channelTitle, ...(typeof namesOf === 'function' ? namesOf(video) || [] : [])];
        const motiu = detectNonCatalan(video.title, names.filter(Boolean));
        if (motiu) {
            descartades.push({ ...pendingEntry(video, now), motiu });
            discarded++;
        } else {
            pendents.push(pendingEntry(video, now));
            added++;
        }
        known.add(id);
    }
    const byArtist = (a, b) => a.artista.localeCompare(b.artista, 'ca') || a.titol.localeCompare(b.titol, 'ca');
    pendents.sort(byArtist);
    descartades.sort(byArtist);
    return {
        state: { updatedAt: now, pendents, descartades, revisades: current.revisades },
        added,
        discarded,
        discardedIds: new Set(descartades.map(item => String(item.id))),
    };
}

// Totes les cançons del feed com a revisades (punt de partida: el repertori actual ja s'ha revisat).
function seedReviewed(state, videos) {
    const current = normalizeState(state);
    const reviewed = new Set(current.revisades);
    for (const video of videos || []) if (isReviewable(video)) reviewed.add(String(video.id));
    return { ...current, revisades: [...reviewed].sort() };
}

// Aplica la revisió. De les pendents s'amaguen les `hideIds`; de les descartades s'amaguen totes menys les
// `rescueIds` (recuperades: eren en català i tornen al feed a la propera generació). Totes passen a revisades.
function applyReview(state, hiddenPayload, hideIds = [], { now = new Date().toISOString(), rescueIds = [] } = {}) {
    const current = normalizeState(state);
    const pendingIds = new Set(current.pendents.map(item => String(item.id)));
    const discardedIds = new Set(current.descartades.map(item => String(item.id)));
    const unknown = [
        ...hideIds.map(String).filter(id => !pendingIds.has(id)),
        ...rescueIds.map(String).filter(id => !discardedIds.has(id)),
    ];
    const rescue = new Set(rescueIds.map(String).filter(id => discardedIds.has(id)));
    const hide = [
        ...hideIds.map(String).filter(id => pendingIds.has(id)),
        ...[...discardedIds].filter(id => !rescue.has(id)),
    ];
    const hidden = new Set((hiddenPayload?.videoIds || []).map(String));
    const newlyHidden = [...new Set(hide)].filter(id => !hidden.has(id));
    const reviewed = new Set(current.revisades);
    pendingIds.forEach(id => reviewed.add(id));
    discardedIds.forEach(id => reviewed.add(id));
    return {
        state: { updatedAt: now, pendents: [], descartades: [], revisades: [...reviewed].sort() },
        hidden: { ...hiddenPayload, videoIds: [...(hiddenPayload?.videoIds || []), ...newlyHidden] },
        hiddenCount: newlyHidden.length,
        keptCount: pendingIds.size - hideIds.filter(id => pendingIds.has(String(id))).length,
        rescuedCount: rescue.size,
        unknown,
    };
}

// JSON llegible: una cançó pendent per línia i un identificador revisat per línia (diffs de git petits).
function serializeState(state) {
    const current = normalizeState(state);
    const pendents = current.pendents.map(item => `    ${JSON.stringify(item)}`).join(',\n');
    const revisades = current.revisades.map(id => `    ${JSON.stringify(id)}`).join(',\n');
    const descartades = current.descartades.map(item => `    ${JSON.stringify(item)}`).join(',\n');
    return [
        '{',
        `  "updatedAt": ${JSON.stringify(current.updatedAt)},`,
        `  "pendents": [${pendents ? `\n${pendents}\n  ` : ''}],`,
        `  "descartades": [${descartades ? `\n${descartades}\n  ` : ''}],`,
        `  "revisades": [${revisades ? `\n${revisades}\n  ` : ''}]`,
        '}',
        '',
    ].join('\n');
}

module.exports = {
    emptyState,
    updatePending,
    seedReviewed,
    applyReview,
    serializeState,
    isReviewable,
    detectNonCatalan,
    songPart,
};
