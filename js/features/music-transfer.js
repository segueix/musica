// Còpia musical en un enllaç (o un fitxer, si és massa gran), sense API ni vinculació permanent.
// L'enllaç s'obre d'un toc des de WhatsApp Web; es mantenen els enllaços antics.
(function (window) {
    'use strict';
    const app = window.SegueixApp || (window.SegueixApp = { features: {}, utils: {} });
    // Un missatge de WhatsApp admet 65.536 caràcters: hi ha de cabre l'enllaç i la frase que el presenta.
    const MAX_LINK = 60000;
    const MAX_URL = MAX_LINK + 100;
    // web.whatsapp.com/send?text= passa pel servidor: per sobre d'això l'enllaç es copia i s'enganxa.
    const MAX_PREFILL = 7000;
    const MAX_FILE = 2 * 1024 * 1024;
    // Una llista o ràdio s'envia amb les seves primeres cançons.
    const MAX_SHARE_SONGS = 50;
    const PREFIX = '#music-transfer=';
    const LINK_PREFIX = '#musica=';
    const WHATSAPP_WEB = 'https://web.whatsapp.com/';
    const WHATSAPP_MOBILE = 'https://api.whatsapp.com/';
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
    const arr = (value) => (Array.isArray(value) ? value : []);
    const str = (value, max = 300) => (typeof value === 'string' ? value.slice(0, max) : '');
    const id = (value) => (/^[A-Za-z0-9_-]{1,100}$/.test(String(value || '')) ? String(value) : '');
    const videoId = (value) => (/^[A-Za-z0-9_-]{11}$/.test(String(value || '')) ? String(value) : '');
    const channelId = (value) => (/^UC[A-Za-z0-9_-]{22}$/.test(String(value || '')) ? String(value) : '');
    const num = (value) => (Number.isFinite(Number(value)) ? Math.max(0, Math.min(Number(value), 1e15)) : 0);
    const date = (value) => (typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : '');
    const unique = (values) => [...new Set(values.filter(Boolean))];
    const badKeys = new Set(['__proto__', 'constructor', 'prototype']);
    const safeKey = (value) => id(value) && !badKeys.has(value);

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
            throw new Error('Aquest enllaç o fitxer no és una còpia compatible de Música.');
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
        };
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
            return fallback;
        }
    }

    function collect(storage = window.localStorage) {
        const data = {};
        for (const [field, key] of Object.entries(KEYS)) data[field] = read(storage, key, null);
        // El mode es desa com a text; la resta són estructures JSON.
        data.mode = storage.getItem(KEYS.mode) || '';
        data.likes = [...arr(data.likes), ...arr(read(storage, 'user_liked_videos', []))];
        return validate({
            product: 'segueix-musica',
            v: 1,
            createdAt: new Date().toISOString(),
            data,
        });
    }

    function isLink(hash) {
        return typeof hash === 'string' && (hash.startsWith(LINK_PREFIX) || hash.startsWith(PREFIX));
    }

    function parseLink(hash) {
        if (!isLink(hash) || hash.length > MAX_URL) {
            throw new Error('L’enllaç és incomplet o massa llarg. Demana una còpia nova.');
        }
        let encoded = hash.slice(hash.startsWith(LINK_PREFIX) ? LINK_PREFIX.length : PREFIX.length);
        try {
            encoded = decodeURIComponent(encoded);
        } catch (_) {
            // Un «%» solt: es prova tal com ha arribat.
        }
        // «~» i «_» són dels primers enllaços #musica= (LZString no els fa servir mai).
        encoded = encoded.replace(/~/g, '+').replace(/_/g, '$');
        const raw = app.utils.shareCodecs?.decodeImportPayload(encoded);
        if (!raw || JSON.stringify(raw).length > MAX_FILE) {
            throw new Error('No s’ha pogut llegir l’enllaç. Demana una còpia nova.');
        }
        return validate(raw);
    }

    function mergeVideos(local, incoming, history = false) {
        const map = new Map(
            arr(local)
                .filter((v) => v && videoId(v.id))
                .map((v) => [v.id, v]),
        );
        incoming.forEach((v) => {
            const old = map.get(v.id);
            const incomingNewer = (Date.parse(v.viewedAt) || 0) > (Date.parse(old?.viewedAt) || 0);
            const merged = old
                ? { ...v, ...old }
                : {
                      ...v,
                      thumbnail: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
                      source: 'api',
                  };
            if (incomingNewer) merged.viewedAt = v.viewedAt;
            map.set(v.id, merged);
        });
        const result = [...map.values()];
        return history ? result.sort((a, b) => (Date.parse(b.viewedAt) || 0) - (Date.parse(a.viewedAt) || 0)) : result;
    }

    function mergeLists(local, incoming, field) {
        const result = arr(local).map((p) => ({ ...p }));
        incoming.forEach((p) => {
            let match = result.find((x) => String(x.id) === p.id && x.name === p.name);
            if (field === 'artists') {
                match = match || result.find((x) => String(x.name).toLowerCase() === p.name.toLowerCase());
            }
            if (match) {
                match[field] =
                    field === 'videos'
                        ? mergeVideos(match[field], p[field])
                        : unique([...arr(match[field]), ...p[field]]);
            } else {
                // Un ID antic generat per data pot coincidir amb el d'una altra llista. ID estable en reimportar.
                let nextId = p.id;
                if (result.some((x) => String(x.id) === nextId)) {
                    let hash = 2166136261;
                    for (const c of p.name) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
                    nextId = `${p.id}_import_${(hash >>> 0).toString(36)}`;
                    match = result.find((x) => x.id === nextId && x.name === p.name);
                }
                if (match) {
                    match[field] =
                        field === 'videos'
                            ? mergeVideos(match[field], p[field])
                            : unique([...arr(match[field]), ...p[field]]);
                } else {
                    result.push({
                        ...p,
                        id: nextId,
                        [field]: field === 'videos' ? mergeVideos([], p[field]) : p[field],
                    });
                }
            }
        });
        return result;
    }

    function importData(payload, storage = window.localStorage) {
        const d = validate(payload).data;
        const signals = app.features.musicSignals;
        if (!signals?.mergeStats || !signals?.mergePrefs) {
            throw new Error('Música encara s’està carregant. Torna-ho a provar.');
        }
        const merged = {
            history: mergeVideos(read(storage, KEYS.history, []), d.history, true),
            likes: mergeVideos(read(storage, KEYS.likes, []), d.likes),
            follows: unique([...arr(read(storage, KEYS.follows, [])), ...d.follows]),
            playlists: mergeLists(read(storage, KEYS.playlists, []), d.playlists, 'videos'),
            categories: mergeLists(read(storage, KEYS.categories, []), d.categories, 'artists'),
            prefs: signals.mergePrefs(read(storage, KEYS.prefs, {}), d.prefs),
            stats: signals.mergeStats(read(storage, KEYS.stats, {}), d.stats),
            styles: unique([...arr(read(storage, KEYS.styles, [])), ...d.styles]).slice(0, 3),
        };
        const updates = Object.entries(merged).map(([field, value]) => [KEYS[field], JSON.stringify(value)]);
        updates.push([
            'user_liked_videos',
            JSON.stringify(unique([...arr(read(storage, 'user_liked_videos', [])), ...merged.likes.map((v) => v.id)])),
        ]);
        if (!storage.getItem(KEYS.mode) && d.mode) updates.push([KEYS.mode, d.mode]);
        const previous = updates.map(([key]) => [key, storage.getItem(key)]);
        try {
            updates.forEach(([key, value]) => storage.setItem(key, value));
        } catch (_) {
            previous.forEach(([key, value]) => {
                if (value === null) storage.removeItem(key);
                else storage.setItem(key, value);
            });
            throw new Error('No hi ha prou espai per importar la còpia. Les dades anteriors s’han conservat.');
        }
        return merged;
    }

    function summary(payload) {
        const d = payload.data;
        const parts = [];
        if (d.playlists.length === 1) {
            parts.push(`llista «${d.playlists[0].name}» (${d.playlists[0].videos.length} cançons)`);
        } else if (d.playlists.length) parts.push(`${d.playlists.length} llistes`);
        if (d.follows.length) parts.push(`${d.follows.length} artistes`);
        if (d.history.length) parts.push(`${d.history.length} cançons a l’historial`);
        if (d.likes.length) parts.push(`${d.likes.length} m’agrada`);
        if (d.categories.length) parts.push(`${d.categories.length} categories`);
        return parts.join(' · ') || 'La còpia és buida.';
    }

    // Només identificadors: els títols els treu l'altre aparell del catàleg (hydrate()). Així l'enllaç és curt.
    // Cançons del catàleg públic que té carregat aquest aparell (feed, pool i historial dels estils).
    function knownIds() {
        const api = typeof YouTubeAPI !== 'undefined' ? YouTubeAPI : window.YouTubeAPI;
        const known = new Set();
        [api?.feedVideos, api?.historyPoolVideos, api?.styleHistoryVideos].forEach((list) => {
            arr(list).forEach((v) => v?.id && known.add(String(v.id)));
        });
        return known;
    }

    // Una cançó del catàleg viatja només amb l'ID (l'altre aparell en treu el títol). Una que ja no hi és (una
    // pista d'un canal «Tema» que ha sortit del feed, una d'amagada) porta el títol i l'artista desats.
    function compact(payload, known = knownIds()) {
        const d = validate(payload).data;
        const song = (v) => {
            if (known.has(v.id) || !v.title) return v.id;
            const artist = v.artistName || v.channelTitle;
            return artist ? { id: v.id, title: v.title, channelTitle: artist } : { id: v.id, title: v.title };
        };
        const ids = (list) => list.map(song);
        const data = {};
        if (d.playlists.length) {
            data.playlists = d.playlists.map((p) => ({ id: p.id, name: p.name, videos: ids(p.videos) }));
        }
        if (d.follows.length) data.follows = d.follows;
        if (d.history.length) data.history = d.history.map((v) => v.id);
        if (d.likes.length) data.likes = d.likes.map((v) => v.id);
        if (d.categories.length) data.categories = d.categories;
        return { product: 'segueix-musica', v: 1, data };
    }

    // Completa títol, artista i durada de les cançons que han arribat només amb l'identificador.
    function hydrate(payload, catalog) {
        const fill = (v) => {
            const known = catalog.get(v.id);
            return known && !v.title ? { ...video(known), ...v } : v;
        };
        const d = payload.data;
        return {
            ...payload,
            data: {
                ...d,
                history: d.history.map(fill),
                likes: d.likes.map(fill),
                playlists: d.playlists.map((p) => ({ ...p, videos: p.videos.map(fill) })),
            },
        };
    }

    async function catalogMap() {
        const api = typeof YouTubeAPI !== 'undefined' ? YouTubeAPI : window.YouTubeAPI;
        const map = new Map();
        if (!api) return map;
        // L'enllaç es pot obrir abans que el feed hagi carregat: s'espera una mica (l'historial dels estils
        // necessita els canals del feed i, demanat abans d'hora, quedaria buit tota la sessió).
        for (let i = 0; i < 50 && !(api.feedVideos || []).length; i++) {
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
        let archive = [];
        if ((api.feedVideos || []).length) {
            archive = await Promise.race([
                api.ensureStyleHistory?.() || [],
                new Promise((resolve) => setTimeout(() => resolve([]), 8000)),
            ]);
        }
        [...arr(archive), ...arr(api.historyPoolVideos), ...arr(api.feedVideos)].forEach((v) => {
            if (v?.id) map.set(String(v.id), v);
        });
        return map;
    }

    let pending = null;
    const byId = (id) => window.document.getElementById(id);
    function feedback(message, id = 'musicTransferFeedback') {
        const el = byId(id);
        el.textContent = message;
        el.classList.remove('hidden');
    }
    function showImport(payload, error) {
        pending = payload;
        const dialog = byId('musicTransferDialog');
        byId('musicTransferSummary').textContent = error || summary(payload);
        byId('musicTransferConfirm').disabled = !payload;
        if (!dialog.open) dialog.showModal();
    }
    function requestImport(payload) {
        showImport(validate(payload));
    }
    // Còpia de tota la música en un fitxer JSON: «segueix-musica-AAAA-MM-DD.json».
    function fileName(date = new Date()) {
        return `segueix-musica-${date.toISOString().slice(0, 10)}.json`;
    }

    function createFile(payload) {
        return new window.File([JSON.stringify(validate(payload))], fileName(), { type: 'application/json' });
    }

    function supportsFileSharing(file, navigator = window.navigator) {
        try {
            return typeof navigator.share === 'function' && Boolean(navigator.canShare?.({ files: [file] }));
        } catch (_) {
            return false;
        }
    }

    function shareableFile(file) {
        if (supportsFileSharing(file)) return file;
        // Web Share (Chrome per a Android) no accepta .json: mateixes dades, embolcall de text compartible.
        const textFile = new window.File([file], file.name + '.txt', {
            type: 'text/plain',
        });
        return supportsFileSharing(textFile) ? textFile : file;
    }

    // L'enllaç és el que s'obre d'un toc a WhatsApp Web (un fitxer adjunt només es descarrega).
    // «+» i «$» de LZString van codificats (%2B, %24): alguns xats tallen l'enllaç en aquests caràcters.
    // Mai «_», «~», «*» ni «`»: WhatsApp els pren com a format (cursiva, ratllat…) i els esborra.
    function buildLink(payload) {
        const encoded = app.utils.shareCodecs?.encodeImportPayload(compact(payload));
        if (!encoded) return '';
        const link =
            app.utils.shareCodecs.SHARE_BASE_URL +
            LINK_PREFIX +
            encoded.replace(/\+/g, '%2B').replace(/\$/g, '%24');
        return link.length <= MAX_LINK ? link : '';
    }

    function shareMessage(payload, link) {
        return (
            'Segueix Música: ' +
            summary(payload) +
            '.\nObre l’enllaç per afegir-ho a la teva Música:\n' +
            link
        );
    }

    function isTouchDevice() {
        try {
            return Boolean(window.matchMedia?.('(pointer: coarse)').matches);
        } catch (_) {
            return false;
        }
    }

    async function copyText(text) {
        try {
            await window.navigator.clipboard.writeText(text);
            return true;
        } catch (_) {
            return false;
        }
    }

    function openWhatsApp(url) {
        const fallback = byId('musicTransferWhatsAppFallback');
        if (fallback) {
            fallback.href = url;
            fallback.classList.remove('hidden');
        }
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    // Envia l'enllaç per WhatsApp. Retorna el missatge per a l'usuari.
    async function sendLink(payload, link) {
        const text = shareMessage(payload, link);
        const navigator = window.navigator;
        if (isTouchDevice() && typeof navigator.share === 'function') {
            // Al mòbil, el menú natiu deixa triar WhatsApp; l'enllaç va dins el text perquè no es perdi.
            await navigator.share({ title: 'Segueix Música', text });
            return 'Enllaç enviat. Qui el rebi només l’ha d’obrir, també des de WhatsApp Web.';
        }
        const base = isTouchDevice() ? WHATSAPP_MOBILE : WHATSAPP_WEB;
        const prefilled = base + 'send?text=' + encodeURIComponent(text);
        if (prefilled.length <= MAX_PREFILL) {
            openWhatsApp(prefilled);
            return 'S’ha obert WhatsApp amb l’enllaç escrit: tria el xat i envia’l.';
        }
        // Massa llarg per passar-lo a WhatsApp per l'adreça: es copia i l'usuari l'enganxa.
        const copied = await copyText(text);
        openWhatsApp(base);
        return copied
            ? 'Enllaç copiat. A WhatsApp, obre el xat i enganxa’l (Ctrl+V o mantén premut) i envia’l.'
            : 'No s’ha pogut copiar l’enllaç. Prem «Copia l’enllaç» i enganxa’l a WhatsApp.';
    }

    // Còpia massa gran per a un enllaç: es comparteix com a fitxer.
    async function sendFile(payload) {
        const file = shareableFile(createFile(payload));
        if (supportsFileSharing(file)) {
            await window.navigator.share({ files: [file], title: 'Segueix Música' });
            return 'La còpia és massa gran per a un enllaç: s’ha compartit com a fitxer.';
        }
        saveGeneratedFile(file);
        openWhatsApp(WHATSAPP_WEB);
        return (
            'La còpia és massa gran per a un enllaç. S’ha desat ' +
            file.name +
            ': adjunta’l a WhatsApp Web com a document.'
        );
    }

    async function sendToWhatsApp(payload) {
        const link = buildLink(payload);
        try {
            return await (link ? sendLink(payload, link) : sendFile(payload));
        } catch (error) {
            if (error?.name === 'AbortError') return '';
            return 'No s’ha pogut compartir. Torna-ho a provar.';
        }
    }

    async function copyLink(payload) {
        const link = buildLink(payload);
        if (!link) return 'L’enllaç seria massa llarg. Tria una llista més curta.';
        return (await copyText(shareMessage(payload, link)))
            ? 'Enllaç copiat. Enganxa’l on vulguis: en obrir-lo, Música et demanarà si vols afegir-ho.'
            : 'El navegador no ha deixat copiar l’enllaç.';
    }

    function listPayload(name, items) {
        const songs = videos(items).slice(0, MAX_SHARE_SONGS);
        if (!songs.length) throw new Error('Aquesta llista o ràdio és buida.');
        let hash = 2166136261;
        for (const c of String(name) + songs.map((v) => v.id).join(',')) {
            hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
        }
        return validate({
            product: 'segueix-musica',
            v: 1,
            createdAt: new Date().toISOString(),
            data: {
                playlists: [
                    {
                        id: 'compartida_' + (hash >>> 0).toString(36),
                        name,
                        videos: songs,
                    },
                ],
            },
        });
    }

    function showListExport(name, items) {
        const payload = listPayload(name, items);
        const dialog = window.document.createElement('dialog');
        dialog.className = 'music-transfer-dialog';
        dialog.innerHTML =
            '<h2>Comparteix la música</h2><p class="music-file-name"></p>' +
            '<p>Envia un enllaç: qui el rebi l’obre (també des de WhatsApp Web) ' +
            'i la llista s’afegeix a la seva Música. S’hi envien les ' + MAX_SHARE_SONGS + ' primeres cançons.</p>' +
            '<div class="config-sync-row">' +
            '<button type="button" class="config-sync-btn music-transfer-primary" data-whatsapp>Envia per WhatsApp</button>' +
            '<button type="button" class="config-sync-btn" data-copy>Copia l’enllaç</button></div>' +
            '<p data-feedback role="status" aria-live="polite"></p>' +
            '<button type="button" class="config-sync-btn" data-close>Tanca</button>';
        dialog.querySelector('.music-file-name').textContent = str(name);
        const status = dialog.querySelector('[data-feedback]');
        const run = (button, action) =>
            button.addEventListener('click', async () => {
                button.disabled = true;
                try {
                    const message = await action(payload);
                    if (message) status.textContent = message;
                } finally {
                    button.disabled = false;
                }
            });
        run(dialog.querySelector('[data-whatsapp]'), sendToWhatsApp);
        run(dialog.querySelector('[data-copy]'), copyLink);
        dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
        dialog.addEventListener('close', () => dialog.remove());
        window.document.body.appendChild(dialog);
        dialog.showModal();
    }

    function saveGeneratedFile(file) {
        const url = URL.createObjectURL(file);
        const link = window.document.createElement('a');
        link.href = url;
        link.download = file.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    // «Envia el fitxer»: menú de compartir del sistema (WhatsApp, correu…) amb el fitxer. Si el navegador no pot
    // compartir fitxers (ordinador), es desa i s'obre WhatsApp Web perquè s'hi adjunti com a document.
    async function shareCopy(payload) {
        const file = shareableFile(createFile(payload));
        if (supportsFileSharing(file)) {
            await window.navigator.share({ files: [file], title: 'Segueix Música' });
            return 'Fitxer enviat. A l’altre aparell, desa’l i prem «Importa un fitxer».';
        }
        saveGeneratedFile(file);
        openWhatsApp(WHATSAPP_WEB);
        return 'S’ha desat ' + file.name + '. A WhatsApp Web, tria el xat i adjunta’l com a document.';
    }

    function saveCopy(payload) {
        const file = createFile(payload);
        saveGeneratedFile(file);
        return 'S’ha desat ' + file.name + '. A l’altre aparell, prem «Importa un fitxer» i tria’l.';
    }

    // Cada botó fa la còpia del moment (historial, m'agrades, artistes, llistes…): cap pas previ de «generar».
    function bindFileAction(buttonId, action) {
        const button = byId(buttonId);
        button.addEventListener('click', async () => {
            byId('musicTransferWhatsAppFallback').classList.add('hidden');
            button.disabled = true;
            try {
                const payload = collect();
                const message = await action(payload);
                if (message) feedback(message + ' ' + summary(payload) + '.');
            } catch (error) {
                if (error?.name !== 'AbortError') {
                    feedback(error.message || 'No s’ha pogut preparar el fitxer. Torna-ho a provar.');
                }
            } finally {
                button.disabled = false;
            }
        });
    }

    async function readFile(file) {
        return validate(JSON.parse((await file.text()).replace(/^\uFEFF/, '')));
    }

    function openLink(hash) {
        try {
            showImport(parseLink(hash));
        } catch (error) {
            showImport(null, error.message);
        }
    }

    async function openFiles(files) {
        if (!files?.length) return;
        if (files.length !== 1) {
            showImport(null, 'Obre un fitxer de Música cada vegada.');
            return;
        }
        try {
            showImport(await readFile(await files[0].getFile()));
        } catch (_) {
            showImport(null, 'No s’ha pogut obrir una còpia vàlida de Música.');
        }
    }

    function init() {
        if (!byId('musicTransferShareFile')) return;
        // L'app instal·lada rep aquí els fitxers associats i, si ja era oberta, l'adreça d'un enllaç.
        window.launchQueue?.setConsumer?.((launch) => {
            if (launch.files?.length) return openFiles(launch.files);
            const hash = String(launch.targetURL || '').replace(/^[^#]*/, '');
            if (isLink(hash) && hash !== initialHash) openLink(hash);
        });
        bindFileAction('musicTransferShareFile', shareCopy);
        bindFileAction('musicTransferSaveFile', saveCopy);
        byId('musicTransferImport').addEventListener('click', () => byId('musicTransferFile').click());
        byId('musicTransferFile').addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            try {
                showImport(await readFile(file));
            } catch (error) {
                showImport(null, error.message || 'El fitxer no és vàlid.');
            }
        });
        byId('musicTransferCancel').addEventListener('click', () => {
            pending = null;
            byId('musicTransferDialog').close();
        });
        byId('musicTransferDialog').addEventListener('cancel', () => {
            pending = null;
        });
        byId('musicTransferConfirm').addEventListener('click', async () => {
            if (!pending) return;
            const payload = pending;
            byId('musicTransferConfirm').disabled = true;
            byId('musicTransferSummary').textContent = 'Important…';
            try {
                importData(hydrate(payload, await catalogMap()));
                pending = null;
                byId('musicTransferSummary').textContent = 'Música importada. Recarregant…';
                // Recarregar reinicialitza els caches i els observadors amb les dades fusionades.
                // Mateixa app on s'ha obert l'enllaç (github.io, l'app instal·lada o una prova local).
                const base = app.utils.appBasePath?.() || app.utils.shareCodecs.SHARE_BASE_URL;
                window.location.replace(base + '?musicImported=1');
            } catch (error) {
                byId('musicTransferConfirm').disabled = false;
                byId('musicTransferSummary').textContent = error.message;
            }
        });
        if (initialHash) openLink(initialHash);
        // Amb l'app ja oberta, un enllaç nou només canvia el fragment: la pàgina no es recarrega.
        window.addEventListener?.('hashchange', () => {
            const hash = window.location.hash;
            if (!isLink(hash)) return;
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
            openLink(hash);
        });
        if (new URLSearchParams(window.location.search).has('musicImported')) {
            window.history.replaceState(null, '', window.location.pathname);
            app.features.shellNav?.toast?.('La teva música s’ha importat correctament.');
        }
    }

    // Captura abans que l'arrencada canviï la ruta; treu les dades de l'URL i de l'historial del navegador.
    const initialHash = isLink(window.location?.hash) ? window.location.hash : '';
    if (initialHash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
    app.features.musicTransfer = {
        collect,
        createFile,
        shareableFile,
        listPayload,
        showListExport,
        buildLink,
        shareMessage,
        sendToWhatsApp,
        copyLink,
        compact,
        hydrate,
        shareCopy,
        saveCopy,
        fileName,
        supportsFileSharing,
        readFile,
        requestImport,
        validate,
        parseLink,
        importData,
        mergeVideos,
        mergeLists,
        summary,
        MAX_URL,
        MAX_LINK,
        MAX_SHARE_SONGS,
        knownIds,
        KEYS,
    };
    window.document?.addEventListener('DOMContentLoaded', init);
})(window);
