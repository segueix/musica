// Les adreces de la barra coincideixen amb les pàgines i els canònics del paquet publicat.
(function (window) {
    const app = window.SegueixApp;
    let routes = null;
    let pending = null;
    const base = () => app.utils.appBasePath();

    function load() {
        if (!window.SEGUEIX_STATIC_SITE) return Promise.resolve(null);
        if (routes) return Promise.resolve(routes);
        if (!pending) {
            pending = window.fetch(base() + 'data/static-routes.json', { cache: 'no-cache' })
                .then(response => {
                    if (!response.ok) throw new Error('Rutes no disponibles');
                    return response.json();
                })
                .then(data => { routes = data; return routes; })
                .catch(() => null)
                .finally(() => { pending = null; });
        }
        return pending;
    }

    function href(kind, id) {
        const route = routes?.[kind]?.[id];
        if (typeof route !== 'string' || route.startsWith('/') || route.includes('..') || /[?#:\\]/.test(route)) return '';
        return base() + route;
    }

    function open(kind, id, { startAt = 0, replaceHistory = false } = {}) {
        const video = kind === 'videos';
        const key = video ? 'videoId' : 'channelId';
        const fallback = `${base()}?${video ? 'v' : 'channel'}=${encodeURIComponent(id)}`;
        const time = video && startAt > 0 ? Math.floor(startAt) : 0;
        const withTime = url => url + (time ? `${url.includes('?') ? '&' : '?'}t=${time}` : '');
        const target = withTime(href(kind, id) || fallback);
        const state = { [key]: id };
        const same = window.location.pathname + window.location.search === target;
        window.history[replaceHistory || same ? 'replaceState' : 'pushState'](state, '', target);
        // Si el mapa arriba tard, només actualitzem la mateixa vista: mai la cançó següent ni la portada.
        void load().then(() => {
            const page = window.document.getElementById(video ? 'watchPage' : 'channelPage');
            if (!page || page.classList.contains('hidden') || window.history.state?.[key] !== id) return;
            const url = href(kind, id);
            if (url) window.history.replaceState(state, '', withTime(url));
        });
    }

    app.utils.publicRoutes = { load, href, open };
    void load();
})(window);
