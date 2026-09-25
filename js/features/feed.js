(function (window) {
    const app = window.SegueixApp || (window.SegueixApp = {});
    app.features = app.features || {};

    const runtime = { hooks: {} };
    const CONTINUE_WATCHING_ENABLED_KEY = 'catube_continue_watching_enabled';
    const CONTINUE_WATCHING_SECTION_LIMIT = 3;
    let continueWatchingCategoryOverride = '';
    let continueWatchingSyncRaf = 0;

    function registerRuntime(hooks = {}) {
        runtime.hooks = hooks || {};
    }

    function normalizeCategory(value) {
        return String(value || '')
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();
    }

    function isContinueWatchingEnabled() {
        try {
            return window.localStorage?.getItem?.(CONTINUE_WATCHING_ENABLED_KEY) !== '0';
        } catch {
            return true;
        }
    }

    function setContinueWatchingEnabled(enabled) {
        try {
            window.localStorage?.setItem?.(CONTINUE_WATCHING_ENABLED_KEY, enabled ? '1' : '0');
        } catch {}
        app.features.continueWatching?.render?.();
        renderContinueWatchingSettingButton();
        scheduleContinueWatchingContextSync();
    }

    function installContinueWatchingPreferenceAdapter() {
        const storage = app.utils?.continueWatchingStorage;
        if (!storage || storage.__preferenceAdapterInstalled) return;

        const rawLoad = typeof storage.load === 'function' ? storage.load.bind(storage) : null;
        const rawSave = typeof storage.save === 'function' ? storage.save.bind(storage) : null;
        const rawGet = typeof storage.get === 'function' ? storage.get.bind(storage) : null;
        const rawUpsert = typeof storage.upsert === 'function' ? storage.upsert.bind(storage) : null;

        storage.enabledKey = CONTINUE_WATCHING_ENABLED_KEY;
        storage.isEnabled = isContinueWatchingEnabled;
        storage.setEnabled = setContinueWatchingEnabled;
        if (rawLoad) storage.load = () => (isContinueWatchingEnabled() ? rawLoad() : []);
        if (rawSave) storage.save = entries => (isContinueWatchingEnabled() ? rawSave(entries) : false);
        if (rawGet) storage.get = videoId => (isContinueWatchingEnabled() ? rawGet(videoId) : null);
        if (rawUpsert) storage.upsert = entry => (isContinueWatchingEnabled() ? rawUpsert(entry) : false);
        storage.__preferenceAdapterInstalled = true;
    }

    function getActiveContinueWatchingCategory() {
        if (continueWatchingCategoryOverride) return continueWatchingCategoryOverride;
        const activeChip = window.document?.querySelector?.('.chips-bar .chip.is-active[data-cat]');
        return String(activeChip?.dataset?.cat || '').trim();
    }

    function getHistoryVideo(videoId) {
        try {
            const history = JSON.parse(window.localStorage?.getItem?.('catube_history') || '[]');
            if (!Array.isArray(history)) return null;
            const id = String(videoId || '').trim();
            return history.find(video => String(video?.id || '') === id) || null;
        } catch {
            return null;
        }
    }

    function getKnownVideo(videoId) {
        const id = String(videoId || '').trim();
        if (!id) return null;
        const sources = [
            app.state?.feed?.currentVideos,
            window.YouTubeAPI?.feedVideos,
            window.cachedAPIVideos,
            window.VIDEOS,
        ];
        for (const source of sources) {
            if (!Array.isArray(source)) continue;
            const video = source.find(item => String(item?.id || '') === id);
            if (video) return video;
        }
        return getHistoryVideo(id);
    }

    function collectVideoCategories(video) {
        const categories = new Set();
        const add = value => {
            const normalized = normalizeCategory(value);
            if (normalized) categories.add(normalized);
        };
        const addMany = values => {
            if (Array.isArray(values)) values.forEach(add);
        };

        if (!video) return categories;
        add(video.category);
        addMany(video.categories);
        addMany(video.customCategories);
        addMany(video.channelCategories);
        add(video.snippet?.category);
        addMany(video.snippet?.categories);

        const channelId = video.channelId || video.snippet?.channelId || '';
        if (channelId) {
            try {
                addMany(window.getChannelCustomCategories?.(channelId));
            } catch {}
            try {
                add(window.getEffectiveCategory?.(channelId));
            } catch {}
            try {
                const channels = window.YouTubeAPI?.getAllChannels?.();
                const channel = Array.isArray(channels)
                    ? channels.find(item => String(item?.id || '') === String(channelId))
                    : null;
                add(channel?.category);
                addMany(channel?.categories);
                addMany(channel?.customCategories);
            } catch {}
        }

        return categories;
    }

    function continueWatchingEntryMatchesCategory(videoId, category) {
        const normalizedCategory = normalizeCategory(category);
        if (!normalizedCategory || normalizedCategory === 'novetats') return false;
        if (normalizedCategory === 'tot') return true;
        return collectVideoCategories(getKnownVideo(videoId)).has(normalizedCategory);
    }

    function openContinueWatchingSettings() {
        const document = window.document;
        installContinueWatchingSettingsControl();
        document?.getElementById?.('backgroundBtn')?.click?.();

        const centerSection = () => {
            const section = document?.getElementById?.('continueWatchingSettingsSection');
            const toggle = document?.getElementById?.('toggleContinueWatchingBtn');
            if (!section) return;
            try {
                section.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            } catch {
                section.scrollIntoView?.();
            }
            section.classList?.remove?.('continue-watching-settings-target');
            void section.offsetWidth;
            section.classList?.add?.('continue-watching-settings-target');
            try {
                toggle?.focus?.({ preventScroll: true });
            } catch {
                toggle?.focus?.();
            }
        };

        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => window.setTimeout?.(centerSection, 40));
        } else {
            window.setTimeout?.(centerSection, 40);
        }
    }

    function ensureContinueWatchingSettingsShortcut(section) {
        const document = window.document;
        const header = section?.querySelector?.('.continue-watching-header');
        if (!header || header.querySelector?.('[data-continue-settings]')) return;

        const button = document.createElement?.('button');
        if (!button) return;
        button.type = 'button';
        button.className = 'continue-watching-settings-shortcut';
        button.dataset.continueSettings = 'true';
        button.setAttribute('aria-label', 'Configura Continua mirant');
        button.setAttribute('title', 'Configura Continua mirant');
        button.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"></path>
                <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.14.37.35.7.6 1 .3.3.69.47 1.1.5H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51.5Z"></path>
            </svg>
        `;
        button.addEventListener?.('click', event => {
            event.preventDefault();
            event.stopPropagation();
            openContinueWatchingSettings();
        });
        header.appendChild(button);
    }

    function syncContinueWatchingTVShortcut(section, category, visible) {
        const header = section?.querySelector?.('.continue-watching-header');
        if (!header) return;

        let button = header.querySelector?.('[data-continue-tv]');
        const canShow = Boolean(visible && category && category !== 'Segueix TV');
        if (!canShow) {
            button?.remove?.();
            return;
        }

        const label = `Veure ${category} com a TV`;
        if (!button) {
            button = window.document?.createElement?.('button');
            if (!button) return;
            button.type = 'button';
            button.className = 'context-tv-btn continue-watching-tv-shortcut';
            button.dataset.continueTv = 'true';
            button.dataset.contextTv = 'category';
            header.appendChild(button);
        }
        button.dataset.contextValue = category;
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
        button.innerHTML = '<span aria-hidden="true">TV</span>';
    }

    function syncContinueWatchingHomeContext() {
        const document = window.document;
        const section = document?.getElementById?.('continueWatchingSection');
        const list = document?.getElementById?.('continueWatchingList');
        if (!section || !list) return;

        ensureContinueWatchingSettingsShortcut(section);

        const enabled = isContinueWatchingEnabled();
        const category = getActiveContinueWatchingCategory();
        let visibleCards = 0;
        const buttons = Array.from(list.querySelectorAll?.('[data-continue-open]') || []);
        buttons.forEach(button => {
            const card = button.closest?.('.continue-watching-card');
            const categoryMatches = enabled && continueWatchingEntryMatchesCategory(button.dataset?.continueOpen, category);
            const visible = categoryMatches && visibleCards < CONTINUE_WATCHING_SECTION_LIMIT;
            card?.classList?.toggle?.('continue-watching-category-hidden', !visible);
            if (visible) visibleCards += 1;
        });

        const hasVisiblePending =
            enabled &&
            Boolean(category) &&
            visibleCards > 0 &&
            !section.classList?.contains?.('hidden');

        section.classList?.toggle?.('continue-watching-context-hidden', !hasVisiblePending);
        syncContinueWatchingTVShortcut(section, category, hasVisiblePending);
        // «Continua mirant» no ha d'amagar mai la capçalera de categoria:
        // aquí també hi viu l'accés a la TV contextual.
        document.getElementById?.('pageTitle')?.classList?.remove?.(
            'continue-watching-page-title-hidden'
        );
    }

    function scheduleContinueWatchingContextSync() {
        if (continueWatchingSyncRaf) return;
        const run = () => {
            continueWatchingSyncRaf = 0;
            syncContinueWatchingHomeContext();
        };
        if (typeof window.requestAnimationFrame === 'function') {
            continueWatchingSyncRaf = window.requestAnimationFrame(run);
        } else {
            continueWatchingSyncRaf = window.setTimeout?.(run, 0) || 0;
        }
    }

    function renderContinueWatchingSettingButton() {
        const toggle = window.document?.getElementById?.('toggleContinueWatchingBtn');
        if (!toggle) return;
        toggle.checked = isContinueWatchingEnabled();
        toggle.setAttribute?.('aria-checked', toggle.checked ? 'true' : 'false');
    }

    function installContinueWatchingSettingsControl() {
        const document = window.document;
        if (!document || document.getElementById?.('continueWatchingSettingsSection')) {
            renderContinueWatchingSettingButton();
            return;
        }

        const clearButton = document.getElementById?.('clearAllDataBtn');
        const dataSection = clearButton?.closest?.('.settings-section');
        if (!dataSection || typeof document.createElement !== 'function') return;

        const section = document.createElement('div');
        section.id = 'continueWatchingSettingsSection';
        section.className = 'settings-section';
        section.innerHTML = `
            <div class="lucky-row continue-watching-toggle-row">
                <span class="setting-label lucky-label">Continua mirant</span>
                <label class="toggle-switch" for="toggleContinueWatchingBtn">
                    <input type="checkbox" id="toggleContinueWatchingBtn" aria-describedby="continueWatchingSettingsDescription">
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <p class="modal-description" id="continueWatchingSettingsDescription">Desa localment el punt dels vídeos pendents i els mostra a les categories corresponents.</p>
        `;
        dataSection.before(section);

        section.addEventListener?.('click', () => {
            section.classList?.remove?.('continue-watching-settings-target');
        });

        const toggle = section.querySelector?.('#toggleContinueWatchingBtn');
        toggle?.addEventListener?.('change', event => {
            section.classList?.remove?.('continue-watching-settings-target');
            setContinueWatchingEnabled(Boolean(event.currentTarget?.checked));
        });
        renderContinueWatchingSettingButton();
    }

    function installContinueWatchingHomeContext() {
        const document = window.document;
        if (!document?.head || document.documentElement?.dataset?.continueWatchingHomeContext === '1') return;
        if (document.documentElement?.dataset) {
            document.documentElement.dataset.continueWatchingHomeContext = '1';
        }

        installContinueWatchingPreferenceAdapter();
        installContinueWatchingSettingsControl();

        if (!document.getElementById?.('continueWatchingContextStyles')) {
            const style = document.createElement('style');
            style.id = 'continueWatchingContextStyles';
            style.textContent = `
                .continue-watching-category-hidden,
                .continue-watching-context-hidden{display:none!important}
                #continueWatchingSection .continue-watching-header{justify-content:flex-start}
                .continue-watching-settings-shortcut{display:grid;place-items:center;flex:0 0 auto;width:30px;height:30px;margin-left:6px;padding:0;border:0;border-radius:999px;background:transparent;color:#fff;cursor:pointer;transition:background .16s ease,transform .16s ease}
                .continue-watching-settings-shortcut:hover{background:rgba(255,255,255,.12)}
                .continue-watching-settings-shortcut:active{transform:scale(.94)}
                .continue-watching-settings-shortcut:focus-visible{outline:2px solid #fff;outline-offset:2px}
                .continue-watching-settings-shortcut svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
                .continue-watching-tv-shortcut{margin-left:4px!important;min-width:34px;height:26px}
                .continue-watching-settings-target{scroll-margin-block:24px;border-radius:12px;animation:continueWatchingTargetBlink .72s ease-in-out infinite alternate}
                @keyframes continueWatchingTargetBlink{
                    from{box-shadow:0 0 0 1px rgba(255,255,255,.3),0 0 0 rgba(255,255,255,0)}
                    to{box-shadow:0 0 0 3px rgba(255,255,255,1),0 0 18px rgba(255,255,255,.35)}
                }
                @media(prefers-reduced-motion:reduce){.continue-watching-settings-target{animation:none;box-shadow:0 0 0 3px #fff}}
                @media(max-width:768px){.continue-watching-settings-shortcut{width:34px;height:34px;margin-left:5px}.continue-watching-settings-shortcut svg{width:18px;height:18px}}
            `;
            document.head.appendChild(style);
        }

        const chipsBar = document.querySelector?.('.chips-bar');
        const homePage = document.getElementById?.('homePage');
        const activeChip = chipsBar?.querySelector?.('.chip.is-active[data-cat]');
        continueWatchingCategoryOverride = String(activeChip?.dataset?.cat || '').trim();

        chipsBar?.addEventListener?.(
            'click',
            event => {
                const chip = event.target?.closest?.('.chip[data-cat]');
                if (!chip || chip.closest?.('#historyPage')) return;
                continueWatchingCategoryOverride = String(chip.dataset?.cat || '').trim();
                scheduleContinueWatchingContextSync();
            },
            true
        );

        if (typeof window.MutationObserver === 'function' && chipsBar) {
            const chipObserver = new window.MutationObserver(() => {
                const current = chipsBar.querySelector?.('.chip.is-active[data-cat]');
                continueWatchingCategoryOverride = String(current?.dataset?.cat || '').trim();
                scheduleContinueWatchingContextSync();
            });
            chipObserver.observe(chipsBar, {
                subtree: true,
                attributes: true,
                attributeFilter: ['class'],
            });
        }

        if (typeof window.MutationObserver === 'function' && homePage) {
            const homeObserver = new window.MutationObserver(scheduleContinueWatchingContextSync);
            homeObserver.observe(homePage, { childList: true, subtree: true });
        }

        window.addEventListener?.('storage', event => {
            if (event.key === CONTINUE_WATCHING_ENABLED_KEY) {
                app.features.continueWatching?.render?.();
                renderContinueWatchingSettingButton();
                scheduleContinueWatchingContextSync();
            }
        });

        scheduleContinueWatchingContextSync();
    }

    if (window.document?.readyState === 'loading') {
        window.document.addEventListener?.('DOMContentLoaded', installContinueWatchingHomeContext, { once: true });
    } else {
        installContinueWatchingHomeContext();
    }

    function showHomeNovetats() {
        return runtime.hooks.showHomeNovetatsImpl?.();
    }

    function getFeedDataForFilter() {
        return runtime.hooks.getFeedDataForFilterImpl?.();
    }

    function setFeedContext(videos, feedData, renderer) {
        return runtime.hooks.setFeedContextImpl?.(videos, feedData, renderer);
    }

    function renderFeed() {
        const result = runtime.hooks.renderFeedImpl?.();
        scheduleContinueWatchingContextSync();
        return result;
    }

    function renderCategories() {
        const result = runtime.hooks.renderCategoriesImpl?.();
        scheduleContinueWatchingContextSync();
        return result;
    }

    async function loadVideosFromAPI() {
        return runtime.hooks.loadVideosFromAPIImpl?.();
    }

    function loadVideos() {
        return runtime.hooks.loadVideosImpl?.();
    }

    app.features.feed = {
        registerRuntime,
        showHomeNovetats,
        getFeedDataForFilter,
        setFeedContext,
        renderFeed,
        renderCategories,
        loadVideosFromAPI,
        loadVideos,
        openContinueWatchingSettings,
        _test: {
            normalizeCategory,
            isContinueWatchingEnabled,
            collectVideoCategories,
            continueWatchingEntryMatchesCategory,
            syncContinueWatchingHomeContext,
            sectionLimit: CONTINUE_WATCHING_SECTION_LIMIT,
        },
    };
})(window);