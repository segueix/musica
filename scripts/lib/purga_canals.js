'use strict';

// Baixes de canals sense cap crida a l'API de YouTube.
//
// Abans, quan un canal desapareixia de data/artistes-musica.json (artista retirat o rebutjat, ID corregit…), el
// workflow «Actualitzar feed musical» tornava a llegir TOTS els canals per regenerar el feed (≈ 1.200 unitats de
// quota) només per treure'n un. Treure un canal no necessita YouTube: n'hi ha prou d'esborrar-ne les dades de tots
// els fitxers generats. Aquí hi ha les peces pures; scripts/purgar_canals_feed.js les aplica als fitxers.

const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;

// Canals actius de la base d'artistes (els mateixos que fa servir el workflow per decidir altes i baixes).
function activeChannelIds(db) {
    const ids = new Set();
    for (const artist of db?.artists || []) {
        if (artist?.reviewStatus === 'rebutjat') continue;
        for (const channel of artist?.youtube?.channels || []) {
            const id = String(channel?.id || '').trim();
            if (CHANNEL_ID_RE.test(id)) ids.add(id);
        }
    }
    return ids;
}

// Canals que són al feed (o que encara tenen arxiu a data/archive/channels) però ja no a la base: les baixes.
// L'arxiu compta a part perquè un canal pot haver sortit del feed i continuar alimentant l'historial dels estils
// i el pool de ràdio (p. ex. un ID antic d'un artista que s'ha corregit).
function removedChannelIds(feed, active, archiveIds = []) {
    const ids = new Set([...Object.keys(feed?.channels || {}), ...archiveIds]);
    return [...ids].filter(id => CHANNEL_ID_RE.test(id) && !active.has(id)).sort();
}

const notIn = removed => item => !removed.has(String(item?.channelId || ''));
const withoutKeys = (object, removed) =>
    Object.fromEntries(Object.entries(object || {}).filter(([id]) => !removed.has(id)));

// Treu els canals `removed` de cada fitxer generat. Rep i retorna objectes (no toca el disc). Els fitxers que no
// hi són (null/undefined) es retornen tal qual.
function purgeChannels(data, removedIds) {
    const removed = removedIds instanceof Set ? removedIds : new Set(removedIds || []);
    const out = { ...data };
    if (!removed.size) return out;

    if (data.feed) {
        out.feed = {
            ...data.feed,
            channels: withoutKeys(data.feed.channels, removed),
            videos: (data.feed.videos || []).filter(notIn(removed)),
        };
    }
    if (data.channelIndex) {
        out.channelIndex = {
            ...data.channelIndex,
            channels: (data.channelIndex.channels || []).filter(channel => !removed.has(String(channel?.id || ''))),
        };
    }
    if (data.review) {
        const videos = (data.review.videos || []).filter(notIn(removed));
        out.review = { ...data.review, count: videos.length, videos };
    }
    if (data.topicReview) {
        // La revisió del Tema identifica el canal pel nom (channelTitle), no per l'ID
        // (si un canal que es queda té el mateix nom, p. ex. el Tema del mateix artista, no se'n treu res)
        const nameOf = id => String(data.feed?.channels?.[id]?.name || '').trim();
        const kept = new Set(
            Object.keys(data.feed?.channels || {})
                .filter(id => !removed.has(id))
                .map(nameOf)
        );
        const names = new Set([...removed].map(nameOf).filter(name => name && !kept.has(name)));
        out.topicReview = {
            ...data.topicReview,
            videos: (data.topicReview.videos || []).filter(
                video => notIn(removed)(video) && !names.has(String(video?.channelTitle || '').trim())
            ),
        };
    }
    if (data.topicCatalog) {
        out.topicCatalog = { ...data.topicCatalog, channels: withoutKeys(data.topicCatalog.channels, removed) };
    }
    if (data.catalogState) {
        out.catalogState = { ...data.catalogState, channels: withoutKeys(data.catalogState.channels, removed) };
    }
    if (data.albums?.channels) {
        out.albums = { ...data.albums, channels: withoutKeys(data.albums.channels, removed) };
    }
    if (data.audit) {
        const keep = entry => !removed.has(String(entry?.id || ''));
        const channelCount = out.feed ? Object.keys(out.feed.channels || {}).length : data.audit.feedChannelCount;
        out.audit = {
            ...data.audit,
            topicCoverage: (data.audit.topicCoverage || []).filter(keep),
            topicChannels: (data.audit.topicChannels || []).filter(keep),
            unresolvedChannelIds: (data.audit.unresolvedChannelIds || []).filter(id => !removed.has(id)),
            channelsWithoutUploads: (data.audit.channelsWithoutUploads || []).filter(id => !removed.has(id)),
            resolvedChannelCount: channelCount,
            feedChannelCount: channelCount,
        };
    }
    return out;
}

module.exports = {
    activeChannelIds,
    removedChannelIds,
    purgeChannels,
};
