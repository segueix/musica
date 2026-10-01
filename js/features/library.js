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

    app.features.library = {
        registerRuntime,
        getPlaylists,
        savePlaylists,
        getPlaylistVideoData,
        resolveArtistName,
        renderPlaylistsPage
    };
})(window);
