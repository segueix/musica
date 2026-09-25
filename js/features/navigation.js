(function (window) {
    const app = window.SegueixApp || (window.SegueixApp = {});
    app.features = app.features || {};

    const runtime = {
        hooks: {}
    };

    function installCategoryChipStylesheet() {
        const document = window.document;
        if (!document?.head || typeof document.createElement !== 'function') return;
        if (document.getElementById?.('categoryChipStylesheet')) return;
        const link = document.createElement('link');
        link.id = 'categoryChipStylesheet';
        link.rel = 'stylesheet';
        link.href = '/css/category-chips.css';
        document.head.appendChild(link);
    }

    function installTypographyPolish() {
        const document = window.document;
        if (!document?.head || typeof document.createElement !== 'function') return;

        if (!document.getElementById?.('robotoTypographyWeights')) {
            const fontLink = document.createElement('link');
            fontLink.id = 'robotoTypographyWeights';
            fontLink.rel = 'stylesheet';
            fontLink.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700;900&display=swap';
            document.head.appendChild(fontLink);
        }

        if (!document.getElementById?.('typographyPolishStylesheet')) {
            const typographyLink = document.createElement('link');
            typographyLink.id = 'typographyPolishStylesheet';
            typographyLink.rel = 'stylesheet';
            typographyLink.href = '/css/typography-polish.css';
            document.head.appendChild(typographyLink);
        }
    }

    function installSpacingPolish() {
        const document = window.document;
        if (!document?.head || typeof document.createElement !== 'function') return;
        if (document.getElementById?.('spacingPolishStylesheet')) return;
        const spacingLink = document.createElement('link');
        spacingLink.id = 'spacingPolishStylesheet';
        spacingLink.rel = 'stylesheet';
        spacingLink.href = '/css/spacing-polish.css';
        document.head.appendChild(spacingLink);
    }

    function installSegueixTVFeature() {
        const document = window.document;
        if (!document?.head || typeof document.createElement !== 'function') return;
        if (document.getElementById?.('segueixTVFeatureScript')) return;
        const script = document.createElement('script');
        script.id = 'segueixTVFeatureScript';
        script.src = '/js/features/segueix-tv.js?v=20260919-segueix-tv-label-final-1';
        script.defer = true;
        document.head.appendChild(script);
    }

    function installContextTVFeature() {
        const document = window.document;
        if (!document?.head || typeof document.createElement !== 'function') return;
        if (document.getElementById?.('contextTVFeatureScript')) return;
        const script = document.createElement('script');
        script.id = 'contextTVFeatureScript';
        script.src = '/js/features/context-tv.js?v=20260919-tv-loop-regenerate-1';
        script.defer = true;
        document.head.appendChild(script);
    }

    function installTVScrollUIFeature() {
        const document = window.document;
        if (!document?.head || typeof document.createElement !== 'function') return;
        if (document.getElementById?.('tvScrollUIFeatureScript')) return;
        const script = document.createElement('script');
        script.id = 'tvScrollUIFeatureScript';
        script.src = '/js/features/tv-scroll-ui.js?v=20260919-tv-loop-regenerate-1';
        script.defer = true;
        document.head.appendChild(script);
    }

    installCategoryChipStylesheet();
    installTypographyPolish();
    installSpacingPolish();
    installSegueixTVFeature();
    installContextTVFeature();
    installTVScrollUIFeature();

    function registerRuntime(hooks = {}) {
        runtime.hooks = hooks || {};
    }

    function getPageElements() {
        return {
            mainContent: document.getElementById('mainContent'),
            homePage: document.getElementById('homePage'),
            watchPage: document.getElementById('watchPage'),
            historyPage: document.getElementById('historyPage'),
            playlistsPage: document.getElementById('playlistsPage'),
            followPage: document.getElementById('followPage'),
            channelPage: document.getElementById('channelPage'),
            chipsBar: document.querySelector('.chips-bar'),
            siteCreditFooter: document.getElementById('siteCreditFooter')
        };
    }

    function setSiteCreditHidden(hidden) {
        const { siteCreditFooter } = getPageElements();
        siteCreditFooter?.classList.toggle('hidden', Boolean(hidden));
    }


    function normalizePage(page) {
        if (page === 'library' || page === 'playlists') return 'llistes';
        if (page === 'history') return 'historial';
        if (page === 'follow') return 'segueix';
        return page;
    }

    function setActiveNavItem(page) {
        const normalizedPage = normalizePage(page);
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        let matchingNav = document.querySelector(`.nav-item[data-page="${normalizedPage}"]`);
        if (!matchingNav && normalizedPage === "llistes") {
            matchingNav = document.querySelector('.nav-item[data-page="library"]');
        }
        if (matchingNav) matchingNav.classList.add('active');
        // Actualitzar nav-trigger actiu al header (si no està en animació de càrrega)
        let matchingTrigger = document.querySelector(`.nav-trigger[data-page="${normalizedPage}"]`);
        if (!matchingTrigger && normalizedPage === "llistes") {
            matchingTrigger = document.querySelector('.nav-trigger[data-page="library"]');
        }
        if (matchingTrigger && !matchingTrigger.classList.contains('nav-loading')) {
            document.querySelectorAll('.nav-trigger.active').forEach(t => t.classList.remove('active'));
            if (matchingTrigger) matchingTrigger.classList.add('active');
        }
    }

    function updatePageTitle(title) {
        if (!title) return;
        const pageTitle = document.getElementById('pageTitle');
        if (!pageTitle) return;
        pageTitle.classList.remove('page-title--with-actions');
        pageTitle.dataset.title = title;
        pageTitle.textContent = title;
    }

    function showHome(options) {
        runtime.hooks.handlePlayerVisibilityOnNavigation?.();
        runtime.hooks.exitPlaylistMode?.();

        const { mainContent, historyPage, playlistsPage, followPage, channelPage, chipsBar, homePage, watchPage } = getPageElements();
        if (mainContent) mainContent.classList.remove('hidden');
        if (historyPage) historyPage.classList.add('hidden');
        if (playlistsPage) playlistsPage.classList.add('hidden');
        if (followPage) followPage.classList.add('hidden');
        if (channelPage) channelPage.classList.add('hidden');
        document.body.classList.remove('mobile-search-active');
        if (chipsBar) chipsBar.classList.remove('hidden');
        if (homePage) homePage.classList.remove('hidden');
        if (watchPage) watchPage.classList.add('hidden');
        setSiteCreditHidden(false);

        if (!runtime.hooks.isMiniPlayerActive?.()) {
            runtime.hooks.resetCurrentVideoState?.();
        }

        runtime.hooks.saveViewState?.();
        if (!options || !options.skipPushState) {
            history.pushState({ ...(history.state || {}), appPage: 'home' }, '', window.location.pathname);
        }
        window.scrollTo(0, 0);
    }

    function showHistory() {
        runtime.hooks.handlePlayerVisibilityOnNavigation?.();
        runtime.hooks.exitPlaylistMode?.();
        runtime.hooks.beforeShowHistory?.();

        const { mainContent, historyPage, playlistsPage, followPage, channelPage, chipsBar } = getPageElements();
        if (mainContent) mainContent.classList.add('hidden');
        if (historyPage) historyPage.classList.remove('hidden');
        if (playlistsPage) playlistsPage.classList.add('hidden');
        if (followPage) followPage.classList.add('hidden');
        if (channelPage) channelPage.classList.add('hidden');
        if (chipsBar) chipsBar.classList.add('hidden');
        setSiteCreditHidden(true);

        runtime.hooks.updateHistoryFilterUI?.();
        runtime.hooks.renderHistory?.();
        history.pushState({ ...(history.state || {}), appPage: 'historial' }, '', '#historial');
        window.scrollTo(0, 0);
    }

    function showPlaylists() {
        runtime.hooks.handlePlayerVisibilityOnNavigation?.();
        runtime.hooks.exitPlaylistMode?.();

        const { mainContent, historyPage, playlistsPage, followPage, channelPage, chipsBar } = getPageElements();
        if (mainContent) mainContent.classList.add('hidden');
        if (historyPage) historyPage.classList.add('hidden');
        if (playlistsPage) playlistsPage.classList.remove('hidden');
        if (followPage) followPage.classList.add('hidden');
        if (channelPage) channelPage.classList.add('hidden');
        if (chipsBar) chipsBar.classList.add('hidden');
        setSiteCreditHidden(true);

        runtime.hooks.setActiveLibraryTab?.(runtime.hooks.getActiveLibraryTab?.() || 'playlists');
        history.pushState({ ...(history.state || {}), appPage: 'llistes' }, '', '#llistes');
        window.scrollTo(0, 0);
    }

    function showFollow(tab = 'all', options = {}) {
        runtime.hooks.handlePlayerVisibilityOnNavigation?.();
        runtime.hooks.exitPlaylistMode?.();

        const { mainContent, historyPage, playlistsPage, followPage, channelPage, chipsBar } = getPageElements();
        if (mainContent) mainContent.classList.add('hidden');
        if (historyPage) historyPage.classList.add('hidden');
        if (playlistsPage) playlistsPage.classList.add('hidden');
        if (followPage) followPage.classList.remove('hidden');
        if (channelPage) channelPage.classList.add('hidden');
        if (chipsBar) chipsBar.classList.add('hidden');
        setSiteCreditHidden(false);

        runtime.hooks.setActiveFollowTab?.(tab);
        history.pushState({ ...(history.state || {}), appPage: 'segueix' }, '', '#segueix');
        window.scrollTo(0, options.scrollY !== undefined && options.scrollY !== null ? options.scrollY : 0);
    }

    function navigateToPage(page) {
        const normalizedPage = normalizePage(page);
        setActiveNavItem(normalizedPage);
        requestAnimationFrame(() => {
            if (normalizedPage === 'home') runtime.hooks.showHomeNovetats?.();
            else if (normalizedPage === 'historial') showHistory();
            else if (normalizedPage === 'llistes') showPlaylists();
            else if (normalizedPage === 'segueix') showFollow();
            else showHome();
        });
    }

    app.features.navigation = {
        registerRuntime,
        setActiveNavItem,
        updatePageTitle,
        navigateToPage,
        showHome,
        showHistory,
        showPlaylists,
        showFollow
    };
})(window);
