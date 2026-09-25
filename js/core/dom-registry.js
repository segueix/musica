(function (window) {
    const app = window.SegueixApp || (window.SegueixApp = {});
    app.dom = app.dom || {};

    function query(id) {
        return document.getElementById(id);
    }

    function init() {
        if (app.dom.__initialized) {
            return app.dom;
        }

        app.dom.pages = {
            home: query('homePage'),
            watch: query('watchPage'),
            channel: query('channelPage'),
            playlists: query('playlistsPage'),
            history: query('historyPage'),
            follow: query('followPage')
        };

        app.dom.grids = {
            main: query('videosGrid'),
            channel: query('channelVideosGrid'),
            history: query('historyGrid')
        };

        app.dom.layout = {
            sidebar: query('sidebar'),
            pageTitle: query('pageTitle'),
            chipsBar: document.querySelector('.chips-bar')
        };

        app.dom.sections = {
            watchPage: query('watchPage'),
            channelPage: query('channelPage'),
            library: query('playlistsPage'),
            history: query('historyPage')
        };

        app.dom.library = {
            tabs: query('libraryTabs'),
            playlistsList: query('playlistsList'),
            smartCategoriesList: query('smartCategoriesList')
        };

        app.dom.history = {
            page: query('historyPage'),
            grid: query('historyGrid'),
            filters: query('historyFilters')
        };

        app.dom.modals = {
            background: query('backgroundModal'),
            customCategory: query('customCategoryModal'),
            playlist: query('playlistModal'),
            addYoutuber: query('addYoutuberModal')
        };

        app.dom.__initialized = true;
        return app.dom;
    }

    app.dom.init = init;
})(window);
