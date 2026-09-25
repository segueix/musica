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
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.warn('No es pot llegir playlists', error);
            return [];
        }
    }

    function savePlaylists(playlists) {
        localStorage.setItem(runtime.playlistStorageKey, JSON.stringify(playlists));
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
        renderPlaylistsPage
    };
})(window);
