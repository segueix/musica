// Revisió de títols de cançons (revisio-cancons.html): llistat de totes les cançons publicades a l'app, amb el títol tal
// com es veu, per editar-lo i baixar només els canvis. Funcions pures (UMD): s'usen a la pàgina i als tests.
//
// «Publicada» vol dir que l'app la mostra: no és al registre d'ocults (data/hidden-videos.json), no és un Short ni
// contingut estàtic, i és una cançó (o una cançó en directe) d'un minut o més (`isCategoryEligibleVideo`).
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.SegueixRevisioCancons = api;
})(typeof window !== 'undefined' ? window : null, function () {
    'use strict';

    const DOC_TYPE = 'revisio-cancons';
    const DOC_VERSION = 1;

    function cleanTitle(value) {
        return String(value ?? '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Sense accents, majúscules ni signes: per cercar dins la llista.
    function normalize(value) {
        return String(value ?? '')
            .normalize('NFD')
            .replace(/\p{M}+/gu, '')
            .toLowerCase()
            .replace(/[^\p{L}\p{N}]+/gu, ' ')
            .trim();
    }

    function isPublished(video, hiddenIds, isEligible) {
        if (!video?.id || video.isShort || video.source === 'static') return false;
        if (hiddenIds?.has?.(String(video.id))) return false;
        return typeof isEligible === 'function' ? Boolean(isEligible(video)) : true;
    }

    // `videos`: les del feed; `decorate(video)`: el mateix que fa l'app en carregar-les (títol net i nom de l'artista).
    // Cada fila: { id, artist, originalTitle (el de YouTube), currentTitle (el que es veu ara), title (editable) }.
    function buildRows({ videos, hiddenIds, isEligible, decorate }) {
        const rows = [];
        const seen = new Set();
        (Array.isArray(videos) ? videos : []).forEach(raw => {
            if (!isPublished(raw, hiddenIds, isEligible) || seen.has(String(raw.id))) return;
            seen.add(String(raw.id));
            const video = typeof decorate === 'function' ? decorate(raw) || raw : raw;
            const shown = cleanTitle(video.title);
            rows.push({
                id: String(raw.id),
                artist: cleanTitle(video.channelTitle || raw.channelTitle),
                originalTitle: cleanTitle(video.originalTitle || raw.title),
                currentTitle: shown,
                title: shown,
            });
        });
        return rows;
    }

    // Aplica els canvis desats ({ id: títol }) i les marques «OK» (Set o llista d'IDs) a les files. Un títol igual al
    // de l'app no compta com a canvi.
    function withDrafts(rows, drafts, okIds) {
        const ok = okIds instanceof Set ? okIds : new Set(Array.isArray(okIds) ? okIds.map(String) : []);
        return rows.map(row => {
            const draft = drafts && Object.prototype.hasOwnProperty.call(drafts, row.id) ? drafts[row.id] : undefined;
            const next = draft === undefined ? row : { ...row, title: String(draft) };
            return ok.has(row.id) ? { ...next, ok: true } : next.ok ? { ...next, ok: false } : next;
        });
    }

    function isChanged(row) {
        return cleanTitle(row.title) !== row.currentTitle;
    }

    function summarize(rows) {
        const ok = rows.filter(row => row.ok).length;
        return { total: rows.length, changed: rows.filter(isChanged).length, ok, pending: rows.length - ok };
    }

    // Només les files editades: el que s'ha de rectificar.
    function buildExport(rows, meta = {}) {
        return {
            type: DOC_TYPE,
            version: DOC_VERSION,
            exportedAt: meta.now || new Date().toISOString(),
            total: rows.length,
            ok: rows.filter(row => row.ok).length,
            songs: rows.filter(isChanged).map(row => ({
                id: row.id,
                artist: row.artist,
                originalTitle: row.originalTitle,
                currentTitle: row.currentTitle,
                title: cleanTitle(row.title),
                ok: Boolean(row.ok),
            })),
        };
    }

    // filter: 'pending' (sense «OK») | 'all' | 'changed' | 'ok'; query: text lliure (títol, artista i títol de YouTube); sort: 'title' | 'artist'.
    function filterRows(rows, { query = '', filter = 'all', sort = 'title' } = {}) {
        const text = normalize(query);
        const tokens = text ? text.split(' ') : [];
        const list = rows.filter(row => {
            if (filter === 'changed' && !isChanged(row)) return false;
            if (filter === 'pending' && row.ok) return false;
            if (filter === 'ok' && !row.ok) return false;
            if (!tokens.length) return true;
            const hay = normalize(`${row.title} ${row.currentTitle} ${row.artist} ${row.originalTitle}`);
            return tokens.every(token => hay.includes(token));
        });
        const collator = new Intl.Collator('ca', { sensitivity: 'base', numeric: true });
        const key = sort === 'artist' ? row => `${row.artist} ${row.currentTitle}` : row => row.currentTitle;
        return list.sort((a, b) => collator.compare(key(a), key(b)));
    }

    return {
        DOC_TYPE,
        DOC_VERSION,
        cleanTitle,
        normalize,
        isPublished,
        buildRows,
        withDrafts,
        isChanged,
        summarize,
        buildExport,
        filterRows,
    };
});
