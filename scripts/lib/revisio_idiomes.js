'use strict';

// Només els artistes vigilats entren a la cua; la confiança editorial queda separada de les revisions.
const { cleanTitle } = require('../../js/song-title.js');
const { createPolicy, recordingKey } = require('./politica_idiomes');
const SONG_TYPES = new Set(['song', 'live_song']);

// Pistes per orientar la revisió. MAI són un motiu d'exclusió automàtica.
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

// Indici al títol, sense inferir l’idioma de la lletra.
function detectNonCatalan(title, names = []) {
    const text = songPart(title, names);
    for (const [pattern, reason] of MARKERS) if (pattern.test(text)) return reason;
    return '';
}
const DESCRIPTION_EXCERPT = 160;

function emptyState() {
    return {
        updatedAt: null,
        pendents: [],
        descartades: [],
        revisades: [],
        acceptadesPerArtista: [],
        artistesPendents: [],
        decisions: [],
    };
}

function normalizeState(state) {
    return {
        updatedAt: state?.updatedAt || null,
        pendents: Array.isArray(state?.pendents) ? state.pendents.filter((item) => item?.id) : [],
        descartades: Array.isArray(state?.descartades) ? state.descartades.filter((item) => item?.id) : [],
        revisades: Array.isArray(state?.revisades) ? state.revisades.map(String) : [],
        acceptadesPerArtista: (state?.acceptadesPerArtista || []).filter((item) => item?.id),
        artistesPendents: state?.artistesPendents || [],
        decisions: (state?.decisions || []).filter((item) => item?.id),
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
        .map((line) => line.trim())
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
        canalId: String(video.channelId || ''),
        titol: String(video.title || ''),
        descripcio: excerpt(video.description),
        publicada: String(video.publishedAt || '').slice(0, 10),
        afegida: addedAt,
    };
}

function loadPolicy() {
    return createPolicy(
        require('../../data/artistes-vigilats-idioma.json'),
        require('../../data/artistes-musica.json')
    );
}

function videoFromEntry(item) {
    return {
        id: item.id,
        channelId: item.canalId,
        channelTitle: item.artista,
        title: item.titol,
        contentType: item.tipus || 'song',
        publishedAt: item.publicada,
        description: item.descripcio,
    };
}

// Conserva també els dubtes fora del feed actiu (arxiu, torns Topic, descartaments antics).
// Una generació parcial no és una revisió i no ha d'esborrar dubtes sense resoldre.
function updatePending(
    state,
    videos,
    { now = new Date().toISOString(), hiddenIds = new Set(), namesOf, policy = loadPolicy() } = {}
) {
    const current = normalizeState(state);
    const reviewed = new Set(current.revisades);
    const previous = new Map(
        [...current.pendents, ...current.descartades, ...current.acceptadesPerArtista].map((item) => [
            String(item.id),
            item,
        ])
    );
    const candidates = new Map([...previous].map(([id, item]) => [id, videoFromEntry(item)]));
    for (const video of videos || []) {
        if (isReviewable(video)) candidates.set(String(video.id), video);
        else if (video?.id) candidates.delete(String(video.id));
    }
    const decisions = new Map(current.decisions.map((item) => [item.id, item]));
    const workDecisions = new Map();
    for (const decision of current.decisions) {
        if (!decision.reutilitza || !decision.obra) continue;
        const prior = workDecisions.get(decision.obra);
        workDecisions.set(decision.obra, prior && prior.accio !== decision.accio ? { conflicte: true } : decision);
    }
    const pendents = [];
    const accepted = new Map();
    const onboarding = new Map();
    for (const item of current.artistesPendents) {
        const artist = policy.resolve({ channelId: item.canals?.[0], channelTitle: item.artista });
        if (artist.mode !== 'nou') continue;
        const old = onboarding.get(artist.key);
        onboarding.set(artist.key, {
            ...item,
            key: artist.key,
            artista: artist.artista,
            canals: [...new Set([...(old?.canals || []), ...(item.canals || [])])],
        });
    }
    const discardedIds = new Set();
    const previousPendingIds = new Set(current.pendents.map((item) => item.id));
    let added = 0;
    let trusted = 0;
    let reused = 0;
    for (const [id, video] of candidates) {
        accepted.delete(id);
        if (hiddenIds.has(id)) continue;
        const artist = policy.resolve(video);
        const obra = recordingKey(video, artist);
        const saved = decisions.get(id) || workDecisions.get(obra);
        const disc = policy.discs.find(
            (item) => item.artista === artist.artista && item.videoIds?.includes(id) && item.font
        );
        const decision = saved && !saved.conflicte ? saved : disc;
        if (decision && ['conserva', 'amaga'].includes(decision.accio)) {
            if (decision.accio === 'amaga') discardedIds.add(id);
            if (!decisions.has(id)) {
                decisions.set(id, {
                    id,
                    accio: decision.accio,
                    artista: artist.artista,
                    titol: video.title,
                    ...(decision.font ? { font: decision.font } : {}),
                    origen: decision.id ? `decisio:${decision.id}` : `disc:${disc.titol}`,
                    data: now,
                });
                reused++;
            }
            reviewed.add(id);
            continue;
        }
        if (reviewed.has(id)) continue;
        const old = previous.get(id);
        const entry = {
            ...pendingEntry(video, old?.afegida || now),
            descripcio: video.description ? excerpt(video.description) : old?.descripcio || '',
            artistaId: artist.key,
            tipus: video.contentType,
            ...(obra ? { obra } : {}),
        };
        if (artist.mode === 'confianca') {
            accepted.set(id, {
                ...entry,
                criteri: 'confianca-artista',
                acceptada: old?.acceptada || now,
            });
            if (!old?.acceptada) trusted++;
        } else if (artist.mode === 'vigilats') {
            const names = [video.channelTitle, ...(typeof namesOf === 'function' ? namesOf(video) || [] : [])];
            const indici = detectNonCatalan(video.title, names.filter(Boolean));
            pendents.push({
                ...entry,
                ...(indici ? { indici } : {}),
                ...(old?.motiu
                    ? { motiuAnterior: old.motiu }
                    : old?.motiuAnterior
                      ? { motiuAnterior: old.motiuAnterior }
                      : {}),
            });
            if (!previousPendingIds.has(id)) added++;
        } else {
            const item = onboarding.get(artist.key) || {
                key: artist.key,
                artista: artist.artista,
                canals: [],
                primeraDeteccio: now,
            };
            if (video.channelId && !item.canals.includes(video.channelId)) item.canals.push(video.channelId);
            onboarding.set(artist.key, item);
        }
    }
    const byArtist = (a, b) =>
        a.artista.localeCompare(b.artista, 'ca') || String(a.titol || '').localeCompare(String(b.titol || ''), 'ca');
    return {
        state: {
            ...current,
            updatedAt: now,
            pendents: pendents.sort(byArtist),
            descartades: [],
            revisades: [...reviewed].sort(),
            acceptadesPerArtista: [...accepted.values()].sort(byArtist),
            artistesPendents: [...onboarding.values()].sort(byArtist),
            decisions: [...decisions.values()].sort((a, b) => a.id.localeCompare(b.id)),
        },
        added,
        trusted,
        reused,
        discarded: discardedIds.size,
        discardedIds,
    };
}

// Compatibilitat amb la inicialització històrica. El CLI actual usa confiança, no aquesta aprovació massiva.
function seedReviewed(state, videos) {
    const current = normalizeState(state);
    const reviewed = new Set(current.revisades);
    for (const video of videos || []) if (isReviewable(video)) reviewed.add(String(video.id));
    return { ...current, revisades: [...reviewed].sort() };
}

// Només resol els IDs explícits; no converteix els dubtes restants en aprovats ni amaga títols automàticament.
function applyReview(
    state,
    hiddenPayload,
    hideIds = [],
    { now = new Date().toISOString(), rescueIds = [], keepIds = [], source = '', reuseWorks = false } = {}
) {
    const current = normalizeState(state);
    const entries = new Map([...current.pendents, ...current.descartades].map((item) => [String(item.id), item]));
    const hide = new Set(hideIds.map(String));
    const keep = new Set([...keepIds, ...rescueIds].map(String));
    const selected = new Set([...hide, ...keep]);
    const unknown = [...selected].filter((id) => !entries.has(id) || (hide.has(id) && keep.has(id)));
    if (unknown.length)
        return {
            state: current,
            hidden: hiddenPayload,
            unknown,
            hiddenCount: 0,
            keptCount: 0,
            rescuedCount: 0,
        };
    const hidden = new Set((hiddenPayload?.videoIds || []).map(String));
    const newlyHidden = [...hide].filter((id) => !hidden.has(id));
    const decisions = new Map(current.decisions.map((item) => [item.id, item]));
    for (const id of selected) {
        const entry = entries.get(id);
        decisions.set(id, {
            id,
            accio: hide.has(id) ? 'amaga' : 'conserva',
            data: now,
            artista: entry.artista,
            titol: entry.titol,
            ...(source ? { font: source } : {}),
            ...(entry.obra && reuseWorks && source ? { obra: entry.obra, reutilitza: true } : {}),
        });
    }
    return {
        state: {
            ...current,
            updatedAt: now,
            pendents: current.pendents.filter((item) => !selected.has(item.id)),
            descartades: current.descartades.filter((item) => !selected.has(item.id)),
            revisades: [...new Set([...current.revisades, ...selected])].sort(),
            decisions: [...decisions.values()],
        },
        hidden: {
            ...hiddenPayload,
            videoIds: [...(hiddenPayload?.videoIds || []), ...newlyHidden],
        },
        hiddenCount: newlyHidden.length,
        keptCount: keep.size,
        rescuedCount: rescueIds.length,
        unknown,
    };
}

// Una entrada per línia: conserva explícitament la confiança i la memòria de decisions.
function serializeState(state) {
    const current = normalizeState(state);
    return (
        '{\n' +
        Object.entries(current)
            .map(([key, value]) => {
                const content = Array.isArray(value)
                    ? '[' +
                      (value.length
                          ? '\n' + value.map((item) => `    ${JSON.stringify(item)}`).join(',\n') + '\n  '
                          : '') +
                      ']'
                    : JSON.stringify(value);
                return `  ${JSON.stringify(key)}: ${content}`;
            })
            .join(',\n') +
        '\n}\n'
    );
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
    loadPolicy,
};
