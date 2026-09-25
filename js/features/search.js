(function (window) {
    const app = window.SegueixApp || (window.SegueixApp = {});
    app.features = app.features || {};

    const runtime = { hooks: {} };

    function registerRuntime(hooks = {}) {
        runtime.hooks = hooks || {};
    }

    function ensureSearchDropdown() {
        return runtime.hooks.ensureSearchDropdownImpl?.();
    }

    async function loadSearchArchiveIndex() {
        return runtime.hooks.loadSearchArchiveIndexImpl?.();
    }

    function searchArchiveVideos(query) {
        return runtime.hooks.searchArchiveVideosImpl?.(query);
    }

    function showSearchDropdown(results) {
        return runtime.hooks.showSearchDropdownImpl?.(results);
    }

    function hideSearchDropdown() {
        return runtime.hooks.hideSearchDropdownImpl?.();
    }

    async function searchVideos(query) {
        return runtime.hooks.searchVideosImpl?.(query);
    }

    app.features.search = {
        registerRuntime,
        ensureSearchDropdown,
        loadSearchArchiveIndex,
        searchArchiveVideos,
        showSearchDropdown,
        hideSearchDropdown,
        searchVideos
    };
})(window);
