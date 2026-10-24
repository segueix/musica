// Dades musicals per a les còpies JSON: llista explícita, sense credencials ni memòria cau.
(function (window) {
    'use strict';
    const app = window.SegueixApp;
    const KEYS = {
        history: 'catube_history',
        likes: 'catube_liked_videos',
        follows: 'catube_follows',
        playlists: 'catube_playlists',
        categories: 'catube_music_user_categories',
        prefs: 'catube_music_prefs_v1',
        stats: 'catube_music_signals_v1',
        styles: 'catube_first_styles',
        mode: 'catube_discovery_mode',
    };
    const SETTINGS = {
        background: 'catube_background_color',
        font: 'catube_font_size',
        styleOrder: 'catube_music_home_style_order',
    };
    const arr = (value) => (Array.isArray(value) ? value : []);
    const str = (value, max = 300) => (typeof value === 'string' ? value.slice(0, max) : '');
    const id = (value) => (/^[A-Za-z0-9_-]{1,100}$/.test(String(value || '')) ? String(value) : '');
    const videoId = (value) => (/^[A-Za-z0-9_-]{11}$/.test(String(value || '')) ? String(value) : '');
    const channelId = (value) => (/^UC[A-Za-z0-9_-]{22}$/.test(String(value || '')) ? String(value) : '');
    const num = (value) => (Number.isFinite(Number(value)) ? Math.max(0, Math.min(Number(value), 1e15)) : 0);
    const date = (value) => (typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : '');
    const unique = (values) => [...new Set(values.filter(Boolean))];
    const badKeys = new Set(['__proto__', 'constructor', 'prototype']);
    const safeKey = (value) =>
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= 300 &&
        [...value].every((char) => char.charCodeAt(0) >= 32) &&
        !badKeys.has(value);

    function video(raw) {
        if (typeof raw === 'string') raw = { id: raw };
        if (!raw || !videoId(raw.id)) return null;
        const out = { id: raw.id };
        for (const field of ['title', 'channelTitle', 'artistName']) {
            const value = str(raw[field] || raw.snippet?.[field]);
            if (value) out[field] = value;
        }
        const channel = channelId(raw.channelId || raw.snippet?.channelId);
        if (channel) out.channelId = channel;
        for (const field of ['viewedAt', 'publishedAt']) if (date(raw[field])) out[field] = raw[field];
        if (num(raw.durationSeconds)) out.durationSeconds = num(raw.durationSeconds);
        const categories = unique(arr(raw.categories).map((v) => str(v, 70)));
        if (categories.length) out.categories = categories.slice(0, 12);
        if (str(raw.category, 70)) out.category = str(raw.category, 70);
        return out;
    }

    function videos(raw) {
        if (arr(raw).length > 15000) throw new Error('La còpia conté massa cançons.');
        const map = new Map();
        arr(raw)
            .map(video)
            .filter(Boolean)
            .forEach((v) => {
                const old = map.get(v.id);
                if (!old || (Date.parse(v.viewedAt) || 0) > (Date.parse(old.viewedAt) || 0)) map.set(v.id, v);
            });
        return [...map.values()];
    }

    function preferences(raw) {
        const out = { v: 1, lessLike: {}, moreLike: {}, blocked: {} };
        for (const kind of ['lessLike', 'moreLike', 'blocked']) {
            for (const [key, entry] of Object.entries(raw?.[kind] || {})) {
                if (safeKey(key) && entry && typeof entry.on === 'boolean') {
                    out[kind][key] = { at: num(entry.at), on: entry.on };
                }
            }
        }
        return out;
    }

    function statistics(raw) {
        const out = { v: 1, songs: {}, artists: {}, recent: [] };
        for (const kind of ['songs', 'artists']) {
            const entries = Object.entries(raw?.[kind] || {});
            if (entries.length > 10000) throw new Error('La còpia conté massa estadístiques.');
            for (const [key, entry] of entries) {
                if (!safeKey(key) || !entry) continue;
                const clean = {};
                for (const field of ['q', 'f', 'r', 's', 'h', 'll', 'l', 'sl', 'lq']) {
                    if (num(entry[field])) clean[field] = num(entry[field]);
                }
                if (safeKey(entry.a)) clean.a = entry.a;
                if (entry.m) {
                    clean.m = {};
                    Object.entries(entry.m).forEach(([month, n]) => {
                        if (/^\d{4}-\d{2}$/.test(month)) clean.m[month] = num(n);
                    });
                }
                out[kind][key] = clean;
            }
        }
        out.recent = arr(raw?.recent)
            .filter((v) => videoId(v?.id))
            .slice(0, 60)
            .map((v) => ({ id: v.id, at: num(v.at) }));
        return out;
    }

    function validate(raw) {
        if (!raw || raw.product !== 'segueix-musica' || raw.v !== 1 || !raw.data || typeof raw.data !== 'object') {
            throw new Error('La còpia JSON no és compatible amb Música.');
        }
        const d = raw.data;
        if (arr(d.playlists).length > 500 || arr(d.categories).length > 500) throw new Error('La còpia és massa gran.');
        const data = {
            history: videos(d.history),
            likes: videos(d.likes),
            follows: unique(arr(d.follows).map(channelId)),
            playlists: arr(d.playlists)
                .filter((p) => p && id(p.id) && str(p.name))
                .map((p) => ({
                    id: id(p.id),
                    name: str(p.name, 120),
                    videos: videos(p.videos),
                    ...(date(p.createdAt) ? { createdAt: p.createdAt } : {}),
                })),
            categories: arr(d.categories)
                .filter((c) => c && id(c.id) && str(c.name))
                .map((c) => ({
                    id: id(c.id),
                    name: str(c.name, 48),
                    artists: unique(arr(c.artists).map(channelId)),
                })),
            prefs: preferences(d.prefs),
            stats: statistics(d.stats),
            styles: unique(arr(d.styles).map((s) => str(s, 70))).slice(0, 3),
            mode: ['home', 'mix', 'surprise', 'new'].includes(d.mode) ? d.mode : '',
            settings: {},
        };
        if (/^#[0-9a-f]{6}$/i.test(d.settings?.background || '')) data.settings.background = d.settings.background;
        if (/^\d{2}$/.test(d.settings?.font || '') && Number(d.settings.font) >= 12 && Number(d.settings.font) <= 28) {
            data.settings.font = d.settings.font;
        }
        if (Array.isArray(d.settings?.styleOrder)) {
            data.settings.styleOrder = d.settings.styleOrder
                .filter((v) => typeof v === 'string' && v.length < 120)
                .slice(0, 1000);
        }
        return {
            product: 'segueix-musica',
            v: 1,
            createdAt: date(raw.createdAt),
            data,
        };
    }

    // Importar una còpia la SUMA a les dades de l'aparell (2026-10-24, a petició de l'usuari): no s'hi esborra res
    // i, després, l'exportació ho porta tot. Cada cançó de l'historial es queda amb l'escolta més recent; les
    // llistes i les categories amb el mateix identificador o el mateix nom s'ajunten; en l'aspecte (fons, lletra,
    // ordre dels estils), el mode i els estils de la primera vegada mana l'aparell. Les preferències i les
    // estadístiques es fusionen amb les regles de musicSignals (`mergePrefs`, `mergeStats`: importar dues vegades
    // el mateix fitxer no suma res); sense aquestes funcions, unió simple amb l'aparell al davant.
    // Mateix límit que l'historial de l'app (HISTORY_LIMIT, js/utils/storage.js); fora de l'app, 500.
    const historyLimit = () => (typeof HISTORY_LIMIT === 'number' && HISTORY_LIMIT > 0 ? HISTORY_LIMIT : 500);
    const viewedTime = (v) => Date.parse(v?.viewedAt) || 0;
    const sameName = (a, b) => str(a).trim().toLowerCase() === str(b).trim().toLowerCase();

    function unionVideos(local, incoming) {
        const seen = new Set(local.map((v) => v.id));
        return [...local, ...incoming.filter((v) => !seen.has(v.id) && seen.add(v.id))];
    }

    function mergeHistory(local, incoming) {
        const byId = new Map();
        [...local, ...incoming].forEach((v) => {
            const old = byId.get(v.id);
            if (!old || viewedTime(v) > viewedTime(old)) byId.set(v.id, v);
        });
        return [...byId.values()].sort((a, b) => viewedTime(b) - viewedTime(a)).slice(0, historyLimit());
    }

    // Llistes (cançons) i categories (grups): mateix identificador o mateix nom → una sola, amb tot.
    function mergeGroups(local, incoming, field, join) {
        const out = local.map((item) => ({ ...item, [field]: [...item[field]] }));
        incoming.forEach((item) => {
            const same = out.find((o) => o.id === item.id) || out.find((o) => sameName(o.name, item.name));
            if (same) same[field] = join(same[field], item[field]);
            else out.push({ ...item, [field]: [...item[field]] });
        });
        return out;
    }

    const unionPrefs = (a, b) => ({
        v: 1,
        lessLike: { ...b.lessLike, ...a.lessLike },
        moreLike: { ...b.moreLike, ...a.moreLike },
        blocked: { ...b.blocked, ...a.blocked },
    });
    const unionStats = (a, b) => ({
        v: 1,
        songs: { ...b.songs, ...a.songs },
        artists: { ...b.artists, ...a.artists },
        recent: a.recent.length ? a.recent : b.recent,
    });

    function merge(local, incoming, { mergePrefs = unionPrefs, mergeStats = unionStats } = {}) {
        const a = validate({ product: 'segueix-musica', v: 1, data: local }).data;
        const b = validate({ product: 'segueix-musica', v: 1, data: incoming }).data;
        return {
            history: mergeHistory(a.history, b.history),
            likes: unionVideos(a.likes, b.likes),
            follows: unique([...a.follows, ...b.follows]),
            playlists: mergeGroups(a.playlists, b.playlists, 'videos', unionVideos),
            categories: mergeGroups(a.categories, b.categories, 'artists', (x, y) => unique([...x, ...y])),
            prefs: mergePrefs(a.prefs, b.prefs),
            stats: mergeStats(a.stats, b.stats),
            styles: a.styles.length ? a.styles : b.styles,
            mode: a.mode || b.mode,
            settings: { ...b.settings, ...a.settings },
        };
    }

    function read(storage, key, fallback) {
        try {
            return JSON.parse(storage.getItem(key)) ?? fallback;
        } catch (_) {
            throw new Error('Hi ha dades locals que no es poden llegir. No s’han modificat les dades.');
        }
    }

    function collect(storage = window.localStorage) {
        const data = {};
        for (const [field, key] of Object.entries(KEYS)) {
            if (field === 'mode') continue;
            data[field] = read(storage, key, null);
            if (
                data[field] !== null &&
                (['prefs', 'stats'].includes(field)
                    ? typeof data[field] !== 'object' || Array.isArray(data[field])
                    : !Array.isArray(data[field]))
            ) {
                throw new Error('Les dades locals no tenen el format esperat. No s’han modificat les dades.');
            }
        }
        // El mode es desa com a text; la resta són estructures JSON.
        data.mode = storage.getItem(KEYS.mode) || '';
        data.settings = {
            background: storage.getItem(SETTINGS.background),
            font: storage.getItem(SETTINGS.font),
            styleOrder: read(storage, SETTINGS.styleOrder, null),
        };
        data.likes = [...arr(data.likes), ...arr(read(storage, 'user_liked_videos', []))];
        return validate({
            product: 'segueix-musica',
            v: 1,
            createdAt: new Date().toISOString(),
            data,
        });
    }

    // Només dades regenerables: mai historial, llistes, gustos, consentiments ni dades personals.
    function releaseCache(storage) {
        const keys = new Set([
            'catube_feed_v1',
            'catube_archive_idx_v1',
            'catube_chips_html_cache',
            'iutube_feed_snapshot_v1',
        ]);
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key?.(i);
            if (key?.startsWith('iutube_cache_') || key?.startsWith('catube_cat_')) keys.add(key);
        }
        for (const key of keys) storage.removeItem(key);
    }

    function writeStorage(key, value, storage = window.localStorage) {
        try {
            storage.setItem(key, value);
        } catch (error) {
            if (error.name !== 'QuotaExceededError') throw error;
            releaseCache(storage);
            // Un únic reintent; si les dades personals soles no hi caben, es conserva l'error.
            storage.setItem(key, value);
        }
    }

    function apply(data, storage = window.localStorage) {
        const clean = validate({ product: 'segueix-musica', v: 1, data }).data;
        const decorate = (list) =>
            list.map((v) => ({ ...v, thumbnail: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`, source: 'api' }));
        clean.history = decorate(clean.history)
            .sort((a, b) => viewedTime(b) - viewedTime(a))
            .slice(0, historyLimit());
        clean.likes = decorate(clean.likes);
        clean.playlists.forEach((p) => {
            p.videos = decorate(p.videos);
        });
        const writes = Object.entries(KEYS).map(([field, key]) => [
            key,
            field === 'mode' ? clean[field] : JSON.stringify(clean[field]),
        ]);
        Object.entries(SETTINGS).forEach(([field, key]) =>
            writes.push([
                key,
                clean.settings[field] === undefined
                    ? null
                    : field === 'styleOrder'
                      ? JSON.stringify(clean.settings[field])
                      : clean.settings[field],
            ])
        );
        writes.push(['user_liked_videos', JSON.stringify(clean.likes.map((v) => v.id))]);
        const old = writes.map(([key]) => [key, storage.getItem(key)]);
        try {
            writes.forEach(([key, value]) => (value === null ? storage.removeItem(key) : writeStorage(key, value, storage)));
        } catch (error) {
            // Primer allibera totes les escriptures parcials, perquè la còpia anterior hi cabia.
            writes.forEach(([key]) => storage.removeItem(key));
            old.forEach(([key, value]) => (value === null ? storage.removeItem(key) : storage.setItem(key, value)));
            throw error;
        }
        return clean;
    }
    app.utils.musicData = { KEYS, collect, validate, merge, apply, writeStorage };
})(window);

