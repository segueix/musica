'use strict';

// Revisió d'idioma de les cançons noves. Cada generació del feed (update_music_feed.js) afegeix a
// data/revisio-idiomes.json les cançons que hi entren per primera vegada («pendents»). Quan l'usuari ho demana, un
// agent (Claude) les revisa, li ensenya quines no són en català i, amb el seu vistiplau,
// scripts/aplicar_revisio_idiomes.js amaga aquestes (data/hidden-videos.json) i passa totes les pendents a
// «revisades», de manera que la llista torna a quedar buida fins que n'entrin de noves.

const SONG_TYPES = new Set(['song', 'live_song']);
const DESCRIPTION_EXCERPT = 160;

function emptyState() {
    return { updatedAt: null, pendents: [], revisades: [] };
}

function normalizeState(state) {
    return {
        updatedAt: state?.updatedAt || null,
        pendents: Array.isArray(state?.pendents) ? state.pendents.filter(item => item?.id) : [],
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

// Afegeix a «pendents» les cançons del feed que no s'han revisat mai ni són pendents. Treu de «pendents» les que ja
// no són al feed (ocultes o retirades). `hiddenIds`: les ja amagades no s'hi tornen a posar.
function updatePending(state, videos, { now = new Date().toISOString(), hiddenIds = new Set() } = {}) {
    const current = normalizeState(state);
    const reviewed = new Set(current.revisades);
    const inFeed = new Map();
    for (const video of videos || []) {
        if (isReviewable(video) && !hiddenIds.has(String(video.id))) inFeed.set(String(video.id), video);
    }
    const pendents = current.pendents.filter(item => inFeed.has(String(item.id)));
    const pendingIds = new Set(pendents.map(item => String(item.id)));
    let added = 0;
    for (const [id, video] of inFeed) {
        if (reviewed.has(id) || pendingIds.has(id)) continue;
        pendents.push(pendingEntry(video, now));
        pendingIds.add(id);
        added++;
    }
    pendents.sort((a, b) => a.artista.localeCompare(b.artista, 'ca') || a.titol.localeCompare(b.titol, 'ca'));
    return { state: { updatedAt: now, pendents, revisades: current.revisades }, added };
}

// Totes les cançons del feed com a revisades (punt de partida: el repertori actual ja s'ha revisat).
function seedReviewed(state, videos) {
    const current = normalizeState(state);
    const reviewed = new Set(current.revisades);
    for (const video of videos || []) if (isReviewable(video)) reviewed.add(String(video.id));
    return { ...current, revisades: [...reviewed].sort() };
}

// Aplica la revisió: les `hideIds` s'amaguen i totes les pendents passen a revisades.
function applyReview(state, hiddenPayload, hideIds = [], { now = new Date().toISOString() } = {}) {
    const current = normalizeState(state);
    const pendingIds = new Set(current.pendents.map(item => String(item.id)));
    const unknown = hideIds.map(String).filter(id => !pendingIds.has(id));
    const hide = hideIds.map(String).filter(id => pendingIds.has(id));
    const hidden = new Set((hiddenPayload?.videoIds || []).map(String));
    const newlyHidden = hide.filter(id => !hidden.has(id));
    const reviewed = new Set(current.revisades);
    pendingIds.forEach(id => reviewed.add(id));
    return {
        state: { updatedAt: now, pendents: [], revisades: [...reviewed].sort() },
        hidden: { ...hiddenPayload, videoIds: [...(hiddenPayload?.videoIds || []), ...newlyHidden] },
        hiddenCount: newlyHidden.length,
        keptCount: pendingIds.size - hide.length,
        unknown,
    };
}

// JSON llegible: una cançó pendent per línia i un identificador revisat per línia (diffs de git petits).
function serializeState(state) {
    const current = normalizeState(state);
    const pendents = current.pendents.map(item => `    ${JSON.stringify(item)}`).join(',\n');
    const revisades = current.revisades.map(id => `    ${JSON.stringify(id)}`).join(',\n');
    return [
        '{',
        `  "updatedAt": ${JSON.stringify(current.updatedAt)},`,
        `  "pendents": [${pendents ? `\n${pendents}\n  ` : ''}],`,
        `  "revisades": [${revisades ? `\n${revisades}\n  ` : ''}]`,
        '}',
        '',
    ].join('\n');
}

module.exports = { emptyState, updatePending, seedReviewed, applyReview, serializeState, isReviewable };
