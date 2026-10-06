// Còpia musical en un fitxer compartible, sense API ni vinculació permanent.
// Es manté la lectura dels enllaços antics.
(function (window) {
    'use strict';
    const app = window.SegueixApp || (window.SegueixApp = { features: {}, utils: {} });
    const MAX_URL = 8000; // Només per llegir els enllaços antics; no afecta els fitxers.
    const MAX_FILE = 2 * 1024 * 1024;
    const PREFIX = '#music-transfer=';
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

    function parseLink(hash) {
        if (!hash.startsWith(PREFIX) || hash.length > MAX_URL) {
            throw new Error('L’enllaç és incomplet o massa llarg. Demana una còpia nova.');
        }
        const raw = app.utils.shareCodecs?.decodeImportPayload(hash.slice(PREFIX.length));
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
        return `${d.history.length} cançons a l’historial · ${d.likes.length} cors · ${d.follows.length} artistes · ${d.playlists.length} llistes · ${d.categories.length} categories`;
    }

    let pending = null;
    const byId = (id) => window.document.getElementById(id);
    function feedback(message) {
        const el = byId('musicTransferFeedback');
        el.textContent = message;
        el.classList.remove('hidden');
    }
    function showImport(payload, error) {
        pending = payload;
        const dialog = byId('musicTransferDialog');
        byId('musicTransferSummary').textContent = error || summary(payload);
        byId('musicTransferConfirm').disabled = !payload;
        dialog.showModal();
    }
    function requestImport(payload) {
        showImport(validate(payload));
    }
    let generatedFile = null;
    const FILE_NAME = 'copia.segueixmusica';

    // Extensió pròpia per associar-la amb la PWA sense registrar tots els JSON del dispositiu.
    function createFile(payload) {
        return new window.File([JSON.stringify(validate(payload))], FILE_NAME, {
            type: 'application/vnd.segueix-musica+json',
        });
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
        // Web Share pot rebutjar extensions pròpies. Mateixes dades JSON, embolcall de text compartible.
        const textFile = new window.File([file], file.name + '.txt', {
            type: 'text/plain',
        });
        return supportsFileSharing(textFile) ? textFile : file;
    }

    function listPayload(name, items) {
        const songs = videos(items);
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
            '<p>Genera un fitxer amb les cançons i comparteix-lo com a document.</p>' +
            '<div class="config-sync-row"><button type="button" class="config-sync-btn" data-create>Genera el fitxer</button>' +
            '<button type="button" class="config-sync-btn" data-share disabled>Comparteix</button></div>' +
            '<p data-feedback role="status" aria-live="polite"></p>' +
            '<p>Obre el fitxer amb Segueix Música instal·lada en un ordinador compatible. Al mòbil, obre Configuració → Importa un fitxer.</p>' +
            '<button type="button" class="config-sync-btn" data-close>Tanca</button>';
        dialog.querySelector('.music-file-name').textContent = str(name);
        let file = null;
        const share = dialog.querySelector('[data-share]');
        const status = dialog.querySelector('[data-feedback]');
        dialog.querySelector('[data-create]').addEventListener('click', () => {
            try {
                file = shareableFile(createFile(payload));
                if (!supportsFileSharing(file)) saveGeneratedFile(file);
                share.disabled = false;
                status.textContent = 'Fitxer generat: ' + file.name + '. Prem «Comparteix».';
            } catch (_) {
                file = null;
                share.disabled = true;
                status.textContent = 'No s’ha pogut generar el fitxer. Torna-ho a provar.';
            }
        });
        share.addEventListener('click', async () => {
            if (!file) return;
            if (!supportsFileSharing(file)) {
                window.open('https://web.whatsapp.com/', '_blank', 'noopener,noreferrer');
                status.textContent = 'Adjunta ' + file.name + ' a WhatsApp Web com a document.';
                return;
            }
            share.disabled = true;
            try {
                await window.navigator.share({
                    files: [file],
                    title: 'Segueix Música',
                });
                status.textContent = 'Fitxer compartit.';
            } catch (error) {
                if (error.name !== 'AbortError') status.textContent = 'No s’ha pogut compartir. Torna-ho a provar.';
            } finally {
                share.disabled = false;
            }
        });
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

    function prepare() {
        generatedFile = null;
        byId('musicTransferShare').disabled = true;
        byId('musicTransferWhatsAppFallback').classList.add('hidden');
        try {
            const payload = collect();
            generatedFile = shareableFile(createFile(payload));
            byId('musicTransferShare').disabled = false;
            if (supportsFileSharing(generatedFile)) {
                feedback(
                    'Fitxer generat. Prem «Comparteix» i tria WhatsApp o l’aplicació que vulguis. ' + summary(payload),
                );
            } else {
                // Sense Web Share de fitxers, WhatsApp Web necessita que l'usuari l'adjunti.
                saveGeneratedFile(generatedFile);
                feedback(
                    'Fitxer generat: ' +
                        generatedFile.name +
                        '. Prem «Comparteix» i adjunta’l a WhatsApp Web com a document.',
                );
            }
        } catch (error) {
            generatedFile = null;
            byId('musicTransferShare').disabled = true;
            feedback(error.message || 'No s’ha pogut generar el fitxer. Torna-ho a provar.');
        }
    }

    async function shareFile() {
        if (!generatedFile) {
            feedback('Primer prem «Genera el fitxer».');
            return;
        }
        if (!supportsFileSharing(generatedFile)) {
            byId('musicTransferWhatsAppFallback').classList.remove('hidden');
            window.open('https://web.whatsapp.com/', '_blank', 'noopener,noreferrer');
            feedback(
                'A WhatsApp Web, tria el teu xat i adjunta ' +
                    generatedFile.name +
                    ' com a document. El navegador no el pot adjuntar automàticament.',
            );
            return;
        }
        byId('musicTransferShare').disabled = true;
        try {
            // Sense text ni URL: només es comparteix el fitxer que s'acaba de generar.
            await window.navigator.share({
                files: [generatedFile],
                title: 'La meva música',
            });
            feedback('Fitxer lliurat a l’aplicació de compartir.');
        } catch (error) {
            if (error.name !== 'AbortError') {
                feedback('No s’ha pogut obrir el menú de compartir. Torna-ho a provar.');
            }
        } finally {
            byId('musicTransferShare').disabled = false;
        }
    }

    async function readFile(file) {
        return validate(JSON.parse((await file.text()).replace(/^\uFEFF/, '')));
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
        if (!byId('musicTransferCreate')) return;
        window.launchQueue?.setConsumer?.((launch) => openFiles(launch.files));
        byId('musicTransferCreate').addEventListener('click', prepare);
        byId('musicTransferShare').addEventListener('click', shareFile);
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
        byId('musicTransferConfirm').addEventListener('click', () => {
            if (!pending) return;
            try {
                importData(pending);
                pending = null;
                byId('musicTransferConfirm').disabled = true;
                byId('musicTransferSummary').textContent = 'Música importada. Recarregant…';
                // Recarregar reinicialitza els caches i els observadors amb les dades fusionades.
                window.location.replace(app.utils.shareCodecs.SHARE_BASE_URL + '?musicImported=1');
            } catch (error) {
                byId('musicTransferSummary').textContent = error.message;
            }
        });
        if (initialHash) {
            try {
                showImport(parseLink(initialHash));
            } catch (error) {
                showImport(null, error.message);
            }
        }
        if (new URLSearchParams(window.location.search).has('musicImported')) {
            window.history.replaceState(null, '', window.location.pathname);
            app.features.shellNav?.toast?.('La teva música s’ha importat correctament.');
        }
    }

    // Captura abans que l'arrencada canviï la ruta; treu les dades de l'URL i de l'historial del navegador.
    const initialHash = window.location?.hash?.startsWith(PREFIX) ? window.location.hash : '';
    if (initialHash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
    app.features.musicTransfer = {
        collect,
        createFile,
        shareableFile,
        listPayload,
        showListExport,
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
        KEYS,
    };
    window.document?.addEventListener('DOMContentLoaded', init);
})(window);
