// Registres versionats i marques d'esborrat: convergència entre còpies de cada aparell.
(function (window) {
    'use strict';
    const app = window.SegueixApp;
    const dataApi = app.utils.musicData;
    const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
    const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const empty = () => ({ product: 'segueix-musica-drive', v: 1, records: {} });
    const stampCompare = (a, b) => a.at - b.at || a.device.localeCompare(b.device);
    const safe = (value) =>
        /^[A-Za-z0-9_-]{1,100}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);

    function flatten(data) {
        const d = dataApi.validate({ product: 'segueix-musica', v: 1, data }).data;
        const out = {};
        for (const field of ['history', 'likes']) {
            d[field].forEach((v) => {
                out[`${field}/${v.id}`] = v;
            });
        }
        d.follows.forEach((id) => {
            out[`follows/${id}`] = id;
        });
        for (const field of ['playlists', 'categories']) {
            const member = field === 'playlists' ? 'videos' : 'artists';
            d[field].forEach((list) => {
                const { [member]: items, ...head } = list;
                out[`${field}/${list.id}`] = head;
                items.forEach((value, pos) => {
                    out[`${field}/${list.id}/${typeof value === 'string' ? value : value.id}`] = { value, pos };
                });
            });
        }
        for (const kind of ['lessLike', 'moreLike', 'blocked']) {
            Object.entries(d.prefs[kind]).forEach(([id, value]) => {
                out[`prefs/${kind}/${encodeURIComponent(id)}`] = value;
            });
        }
        for (const kind of ['songs', 'artists']) {
            Object.entries(d.stats[kind]).forEach(([id, value]) => {
                out[`stats/${kind}/${encodeURIComponent(id)}`] = value;
            });
        }
        d.stats.recent.forEach((v) => {
            out[`recent/${v.id}`] = v;
        });
        if (d.styles.length) out.styles = d.styles;
        if (d.mode) out.mode = d.mode;
        Object.entries(d.settings).forEach(([key, value]) => {
            out[`settings/${key}`] = value;
        });
        return out;
    }

    function materialize(doc) {
        const data = {
            settings: {},
            history: [],
            likes: [],
            follows: [],
            playlists: [],
            categories: [],
            prefs: { v: 1, lessLike: {}, moreLike: {}, blocked: {} },
            stats: { v: 1, songs: {}, artists: {}, recent: [] },
        };
        for (const [path, record] of Object.entries(doc.records)) {
            if (record.deleted) continue;
            const [field, id, child] = path.split('/');
            const value = record.value;
            if (['history', 'likes', 'follows'].includes(field)) data[field].push(value);
            else if (['playlists', 'categories'].includes(field) && !child) {
                const member = field === 'playlists' ? 'videos' : 'artists';
                const items = Object.entries(doc.records)
                    .filter(([p, r]) => p.startsWith(`${field}/${id}/`) && !r.deleted)
                    .sort(([pa, a], [pb, b]) => a.value.pos - b.value.pos || pa.localeCompare(pb))
                    .map(([, r]) => r.value.value);
                data[field].push({ ...value, [member]: items });
            } else if (field === 'prefs' && own(data.prefs, id)) data.prefs[id][decodeURIComponent(child)] = value;
            else if (field === 'stats' && own(data.stats, id)) data.stats[id][decodeURIComponent(child)] = value;
            else if (field === 'recent') data.stats.recent.push(value);
            else if (field === 'settings') data.settings[id] = value;
            else if (field === 'styles' || field === 'mode') data[field] = value;
        }
        data.history.sort((a, b) => (Date.parse(b.viewedAt) || 0) - (Date.parse(a.viewedAt) || 0));
        data.history = data.history.slice(0, 50);
        data.stats.recent.sort((a, b) => b.at - a.at);
        return dataApi.validate({ product: 'segueix-musica', v: 1, data }).data;
    }

    function safeEncodedKey(value) {
        try {
            const key = decodeURIComponent(value || '');
            return (
                key.length > 0 &&
                key.length <= 300 &&
                [...key].every((char) => char.charCodeAt(0) >= 32) &&
                !['__proto__', 'constructor', 'prototype'].includes(key) &&
                encodeURIComponent(key) === value
            );
        } catch (_) {
            return false;
        }
    }

    function validate(doc) {
        if (
            !doc ||
            doc.product !== 'segueix-musica-drive' ||
            doc.v !== 1 ||
            !doc.records ||
            Array.isArray(doc.records) ||
            typeof doc.records !== 'object'
        ) {
            throw new Error('La còpia de Drive no és compatible. No s’han modificat les dades.');
        }
        if (Object.keys(doc.records).length > 100000) throw new Error('La còpia de Drive és massa gran.');
        for (const [path, r] of Object.entries(doc.records)) {
            const bits = path.split('/');
            const [field, id, child] = bits;
            const collection = ['history', 'likes', 'follows', 'recent', 'playlists', 'categories'].includes(field);
            const nested =
                (field === 'prefs' && ['lessLike', 'moreLike', 'blocked'].includes(id)) ||
                (field === 'stats' && ['songs', 'artists'].includes(id));
            const validPath =
                ((field === 'styles' || field === 'mode') && bits.length === 1) ||
                (collection &&
                    safe(id || '') &&
                    (bits.length === 2 ||
                        (['playlists', 'categories'].includes(field) && bits.length === 3 && safe(child || '')))) ||
                (field === 'settings' && bits.length === 2 && ['background', 'font', 'styleOrder'].includes(id)) ||
                (nested && bits.length === 3 && safeEncodedKey(child));
            if (
                !validPath ||
                !r ||
                !Number.isSafeInteger(r.at) ||
                r.at < 0 ||
                !safe(r.device || '') ||
                typeof r.deleted !== 'boolean' ||
                (!r.deleted && !own(r, 'value'))
            ) {
                throw new Error('La còpia de Drive conté dades incorrectes.');
            }
        }
        // També comprova les estructures dels valors abans d'escriure res al navegador.
        materialize(doc);
        return doc;
    }

    function update(doc, before, after, device, now = Date.now()) {
        const next = { ...doc, records: { ...doc.records } };
        const old = flatten(before);
        const current = flatten(after);
        const at = Object.values(doc.records).reduce((max, r) => Math.max(max, r.at + 1), Math.max(1, now));
        for (const path of new Set([...Object.keys(old), ...Object.keys(current)])) {
            if (equal(old[path], current[path])) continue;
            next.records[path] = own(current, path)
                ? { at, device, deleted: false, value: current[path] }
                : { at, device, deleted: true };
        }
        return next;
    }

    function mergeStats(a, b) {
        const out = { ...a, ...b };
        for (const key of ['q', 'f', 'r', 's', 'h', 'll', 'l', 'sl', 'lq']) {
            out[key] = Math.max(Number(a[key]) || 0, Number(b[key]) || 0);
        }
        out.m = { ...a.m };
        for (const [month, value] of Object.entries(b.m || {})) out.m[month] = Math.max(out.m[month] || 0, value);
        return out;
    }

    function merge(...docs) {
        const result = empty();
        for (const doc of docs) {
            validate(doc);
            for (const [path, record] of Object.entries(doc.records)) {
                const old = result.records[path];
                let winner = !old || stampCompare(record, old) > 0 ? record : old;
                if (old && !old.deleted && !record.deleted && path.startsWith('stats/')) {
                    winner = {
                        ...winner,
                        value:
                            winner === record
                                ? mergeStats(old.value, record.value)
                                : mergeStats(record.value, old.value),
                    };
                }
                result.records[path] = winner;
            }
        }
        return result;
    }
    function limitHistory(doc, device, now = Date.now()) {
        const keep = new Set(materialize(doc).history.map(video => `history/${video.id}`));
        const at = Object.values(doc.records).reduce((max, record) => Math.max(max, record.at + 1), now);
        const records = { ...doc.records };
        for (const [path, record] of Object.entries(records)) {
            if (path.startsWith('history/') && !record.deleted && !keep.has(path)) {
                records[path] = { at, device, deleted: true };
            }
        }
        return { ...doc, records };
    }

    app.utils.driveSyncModel = { empty, flatten, materialize, validate, update, merge, limitHistory };
})(window);
