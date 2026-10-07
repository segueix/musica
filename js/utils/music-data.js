// Dades musicals per a la sincronització: llista explícita, sense credencials ni memòria cau.
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
            throw new Error('Les dades de sincronització no són compatibles amb Música.');
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

    function read(storage, key, fallback) {
        try {
            return JSON.parse(storage.getItem(key)) ?? fallback;
        } catch (_) {
            throw new Error('Hi ha dades locals que no es poden llegir. No s’ha modificat cap còpia de Drive.');
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
                throw new Error('Les dades locals no tenen el format esperat. No s’ha modificat cap còpia de Drive.');
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

    function apply(data, storage = window.localStorage) {
        const clean = validate({ product: 'segueix-musica', v: 1, data }).data;
        const decorate = (list) =>
            list.map((v) => ({ ...v, thumbnail: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`, source: 'api' }));
        clean.history = decorate(clean.history)
            .sort((a, b) => (Date.parse(b.viewedAt) || 0) - (Date.parse(a.viewedAt) || 0))
            .slice(0, 50);
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
            writes.forEach(([key, value]) => (value === null ? storage.removeItem(key) : storage.setItem(key, value)));
        } catch (error) {
            old.forEach(([key, value]) => (value === null ? storage.removeItem(key) : storage.setItem(key, value)));
            throw error;
        }
        return clean;
    }
    app.utils.musicData = { KEYS, collect, validate, apply };
})(window);
