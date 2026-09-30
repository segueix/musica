(function (window) {
    const app = window.SegueixApp || (window.SegueixApp = {});
    const existingState = app.state && typeof app.state === 'object' ? app.state : {};

    function withDefaults(current, defaults) {
        const base = current && typeof current === 'object' ? current : {};
        const next = { ...base };
        Object.keys(defaults).forEach((key) => {
            const defaultValue = defaults[key];
            const currentValue = base[key];
            if (
                defaultValue
                && typeof defaultValue === 'object'
                && !Array.isArray(defaultValue)
            ) {
                next[key] = withDefaults(currentValue, defaultValue);
            } else if (typeof currentValue === 'undefined') {
                next[key] = defaultValue;
            }
        });
        return next;
    }

    const stateDefaults = {
        navigation: {
            selectedCategory: null,
            activeFollowTab: 'all',
            currentPage: 'home'
        },
        feed: {
            currentVideos: [],
            lastRenderedList: [],
            currentData: null,
            renderer: null,
            useYouTubeAPI: false
        },
        channel: {
            currentChannelId: null,
            currentChannelName: '',
            currentVideos: [],
            currentShorts: [],
            currentLongVideos: []
        },
        playlists: {
            activePlaylistId: null,
            activePlaylistName: '',
            activeQueue: [],
            currentPlaylistIndex: 0,
            isPlaylistMode: false,
            activePlaylistVideo: null
        },
        history: {
            selectedCategory: 'Novetats',
            filterLiked: false
        },
        search: {
            dropdownItems: [],
            activeIndex: -1,
            archiveIndexCache: [],
            archiveIndexPromise: null,
            activeRequestId: 0
        },
        player: {
            currentVideoId: null,
            currentVideoSource: null,
            isAutoPlayNavigating: false,
            lastKnownPlayerTime: 0
        },
        shorts: {
            currentShortIndex: 0,
            currentShortsQueue: [],
            isNavigatingShort: false,
            shortModalScrollY: 0
        }
    };

    app.state = withDefaults(existingState, stateDefaults);
})(window);
