// Canvis editorials locals: el mateix contracte al navegador i al repositori.
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.SegueixAdminChanges = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    const PRODUCT = 'segueix-musica-admin';
    const clone = value => JSON.parse(JSON.stringify(value));
    const stable = value => JSON.stringify(value, function (_key, item) {
        return item && typeof item === 'object' && !Array.isArray(item)
            ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item;
    });
    const equal = (a, b) => stable(a ?? null) === stable(b ?? null);
    function editable(artist) {
        return { genres: artist.genres || [], reviewStatus: artist.reviewStatus,
            active: Boolean(artist.active), youtubeChannels: artist.youtube?.channels || [] };
    }
    function editor(db) {
        return { ...clone(db), artists: db.artists.map((a, index) => ({ ...clone(a), __adminIndex: index })) };
    }
    function create(base, edited) {
        if (!Array.isArray(base?.artists) || !Array.isArray(edited?.artists)) throw new Error('Base no vàlida.');
        const byIndex = new Map();
        for (const artist of edited.artists) {
            const index = artist.__adminIndex;
            if (!Number.isInteger(index) || index < 0 || index >= base.artists.length || byIndex.has(index)) {
                throw new Error('Identitat editorial no vàlida.');
            }
            byIndex.set(index, artist);
        }
        const changes = [];
        base.artists.forEach((before, index) => {
            const after = byIndex.get(index);
            if (!after) { changes.push({ before: clone(before), delete: true }); return; }
            const fields = {};
            const previous = editable(before);
            for (const [key, value] of Object.entries(editable(after))) {
                if (!equal(previous[key], value)) fields[key] = clone(value);
            }
            if (Object.keys(fields).length) changes.push({ before: clone(before), fields });
        });
        return { product: PRODUCT, version: 1, changes };
    }
    function validateFields(fields, taxonomy) {
        if (!fields || typeof fields !== 'object' || Array.isArray(fields) || !Object.keys(fields).length) throw new Error('Canvi buit.');
        const allowed = new Set((taxonomy.categories || []).map(g => g.label));
        for (const [key, value] of Object.entries(fields)) {
            if (key === 'genres') {
                if (!Array.isArray(value) || value.some(g => !allowed.has(g))) throw new Error('Categoria no vàlida.');
            } else if (key === 'reviewStatus') {
                if (!['pendent', 'aprovat', 'rebutjat'].includes(value)) throw new Error('Estat no vàlid.');
            } else if (key === 'active') {
                if (typeof value !== 'boolean') throw new Error('Activació no vàlida.');
            } else if (key === 'youtubeChannels') {
                if (!Array.isArray(value) || value.some(c => !c || !/^UC[A-Za-z0-9_-]{22}$/.test(c.id || '') ||
                    !['official', 'topic', 'label', 'other'].includes(c.type || 'official') ||
                    (c.primary !== undefined && typeof c.primary !== 'boolean') ||
                    ['name', 'handle'].some(k => c[k] !== null && c[k] !== undefined && typeof c[k] !== 'string') ||
                    Object.keys(c).some(k => !['id', 'type', 'primary', 'name', 'handle'].includes(k))) ||
                    new Set(value.map(c => c.id)).size !== value.length) throw new Error('Canals de YouTube no vàlids.');
            } else throw new Error('Camp editorial no permès: ' + key);
        }
    }
    function apply(db, patch, taxonomy) {
        if (patch?.product !== PRODUCT || patch.version !== 1 || !Array.isArray(patch.changes) || patch.changes.length > 500) {
            throw new Error('Fitxer de canvis no vàlid (màxim 500 artistes).');
        }
        if (!Array.isArray(db?.artists) || !Array.isArray(taxonomy?.categories)) throw new Error('Base o taxonomia no vàlida.');
        const result = editor(db);
        const targets = new Set();
        for (const change of patch.changes) {
            if (!change?.before || Object.keys(change).some(k => !['before', 'delete', 'fields'].includes(k)) ||
                (change.delete !== undefined && change.delete !== true) || (change.delete && change.fields)) throw new Error('Operació no vàlida.');
            const matches = db.artists.map((a, i) => equal(a, change.before) ? i : -1).filter(i => i >= 0);
            if (matches.length !== 1 || targets.has(matches[0])) {
                throw new Error('Conflicte: la fitxa ha canviat, és ambigua o està repetida: ' + (change.before.name || 'artista'));
            }
            const index = matches[0]; targets.add(index);
            const artist = result.artists[index];
            if (change.delete) { result.artists[index] = null; continue; }
            validateFields(change.fields, taxonomy);
            for (const [key, value] of Object.entries(change.fields)) {
                if (key === 'youtubeChannels') { artist.youtube ||= {}; artist.youtube.channels = clone(value); }
                else artist[key] = clone(value);
            }
            if ('genres' in change.fields) artist.sources = [...new Set([...(artist.sources || []), 'genre:manual'])];
        }
        result.artists = result.artists.filter(Boolean);
        return result;
    }
    function clean(db) {
        const result = clone(db);
        result.artists.forEach(a => { delete a.__adminIndex; });
        return result;
    }
    return { PRODUCT, editor, create, apply, clean };
});
