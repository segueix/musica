(function (window) {
    const app = window.SegueixApp || (window.SegueixApp = {});
    app.features = app.features || {};

    const runtime = {
        hooks: {},
        playlistStorageKey: 'catube_playlists'
    };

    function registerRuntime(options = {}) {
        runtime.hooks = options.hooks || {};
        if (typeof options.playlistStorageKey === 'string' && options.playlistStorageKey) {
            runtime.playlistStorageKey = options.playlistStorageKey;
        }
    }

    function getPlaylists() {
        const stored = localStorage.getItem(runtime.playlistStorageKey);
        if (!stored) return [];
        try {
            const parsed = JSON.parse(stored);
            if (!Array.isArray(parsed)) return [];
            // Les cançons desades abans de netejar els títols es mostren amb el títol net
            const clean = video => window.SegueixMusicCategories?.cleanVideoTitle?.(video) || video;
            return parsed.map(list => (Array.isArray(list?.videos) ? { ...list, videos: list.videos.map(clean) } : list));
        } catch (error) {
            console.warn('No es pot llegir playlists', error);
            return [];
        }
    }

    function savePlaylists(playlists) {
        localStorage.setItem(runtime.playlistStorageKey, JSON.stringify(playlists));
        window.dispatchEvent(new CustomEvent('segueix:playlists-changed'));
    }

    // Nom de l'artista d'una cançó desada: el nom del canal registrat (la fitxa d'artista) i, si no hi és, el
    // títol del canal del vídeo. channelNames: Map(channelId → nom).
    function resolveArtistName(video, channelNames) {
        const channelId = String(video?.channelId || video?.snippet?.channelId || '').trim();
        const registered = channelId && channelNames?.get ? channelNames.get(channelId) : '';
        const name = registered || video?.artistName || video?.channelTitle || video?.snippet?.channelTitle || '';
        return String(name).trim();
    }

    function getPlaylistVideoData(video) {
        if (typeof runtime.hooks.getPlaylistVideoDataImpl === 'function') {
            return runtime.hooks.getPlaylistVideoDataImpl(video);
        }
        return {
            id: video?.id,
            title: video?.title || 'Vídeo',
            thumbnail: video?.thumbnail || '',
            channelTitle: video?.channelTitle || '',
            source: video?.source || 'api'
        };
    }

    async function renderPlaylistsPage() {
        if (typeof runtime.hooks.renderPlaylistsPageImpl === 'function') {
            return runtime.hooks.renderPlaylistsPageImpl();
        }
    }

    const fold = value => String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    function searchSongs(videos, query) {
        const terms = fold(query).trim().split(/\s+/).filter(Boolean);
        if (!terms.length) return [];
        const seen = new Set();
        return videos.filter(video => {
            if (!video?.id || seen.has(String(video.id)) || video.isShort ||
                (video.contentType && !['song', 'live_song'].includes(video.contentType))) return false;
            const searchable = fold(`${video.title || ''} ${video.channelTitle || ''} ${video.artistName || ''}`);
            if (!terms.every(term => searchable.includes(term))) return false;
            seen.add(String(video.id));
            return true;
        });
    }

    let pickerVersion = 0;
    function cancelSongPicker() { pickerVersion++; }
    function openSongPicker({ body, getList, initialVideos = [], loadVideos, add }) {
        const version = ++pickerVersion;
        let videos = initialVideos;
        let loading = true;
        let failed = false;
        body.innerHTML = '<label for="playlistSongSearch">Cerca una cançó o un artista</label>' +
            '<input id="playlistSongSearch" class="playlist-song-search" type="search" autocomplete="off" placeholder="Nom de la cançó o de l’artista">' +
            '<p class="playlist-song-status" role="status" aria-live="polite"></p><div class="playlist-song-results"></div>';
        const input = body.querySelector('input');
        const status = body.querySelector('[role="status"]');
        const results = body.querySelector('.playlist-song-results');
        const render = () => {
            if (version !== pickerVersion) return;
            const list = getList();
            if (!list) { results.replaceChildren(); status.textContent = 'Aquesta llista ja no existeix.'; return; }
            const matches = searchSongs(videos, input.value);
            const selected = new Set(list.videos.map(v => String(v.id)));
            status.textContent = !input.value.trim() ? 'Escriu per trobar cançons.' :
                `${matches.length} resultats${matches.length > 60 ? ' · Mostrem els primers 60; concreta la cerca.' : ''}`;
            if (loading) status.textContent += ' Carregant la resta del catàleg…';
            if (failed) status.textContent += ' No s’ha pogut carregar l’historial. Pots cercar les cançons disponibles.';
            results.replaceChildren();
            for (const video of matches.slice(0, 60)) {
                const row = document.createElement('div'); row.className = 'playlist-song-result';
                const copy = document.createElement('div'); copy.className = 'song-copy'; copy.textContent = video.title;
                const artist = document.createElement('small'); artist.textContent = video.channelTitle || video.artistName || '';
                copy.append(artist);
                const button = document.createElement('button'); button.type = 'button';
                const update = () => { button.disabled = true; button.textContent = 'Afegida ✓'; button.setAttribute('aria-label', `${video.title}: ja és a la llista`); };
                if (selected.has(String(video.id))) update();
                else { button.textContent = '+ Afegeix'; button.setAttribute('aria-label', `Afegeix ${video.title}`); }
                button.addEventListener('click', () => {
                    if (!getList()) return render();
                    try { add(video); update(); status.textContent = `«${video.title}» afegida a la llista.`; }
                    catch (_) { status.textContent = 'No s’ha pogut desar la cançó. Torna-ho a provar.'; }
                });
                row.append(copy, button); results.append(row);
            }
        };
        input.addEventListener('input', render);
        render(); input.focus();
        Promise.resolve().then(loadVideos).then(history => {
            if (version !== pickerVersion) return;
            videos = [...initialVideos, ...(history || [])]; loading = false; render();
        }).catch(() => { if (version === pickerVersion) { loading = false; failed = true; render(); } });
    }

    app.features.library = {
        searchSongs,
        openSongPicker,
        cancelSongPicker,
        registerRuntime,
        getPlaylists,
        savePlaylists,
        getPlaylistVideoData,
        resolveArtistName,
        renderPlaylistsPage
    };
})(window);

