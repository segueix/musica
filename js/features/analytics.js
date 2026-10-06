(function (window) {
    'use strict';

    const app = window.SegueixApp || (window.SegueixApp = {});
    app.features = app.features || {};

    const ENABLED_KEY = 'catube_anonymous_analytics_enabled';
    const ENDPOINT = 'https://segueix.cat/api/music-analytics';
    const CLIENT_ID_KEY = 'catube_music_anonymous_analytics_client_v1';
    const CLIENT_ID_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
    const DEDUPE_MS = 900;
    const BUILTIN_CATEGORIES = new Map([
        ['novetats', 'novetats'],
        ['descobreix', 'descobreix'],
        ['pop', 'pop'],
        ['rock', 'rock'],
        ['indie', 'indie'],
        ['urbana', 'urbana'],
        ['urban', 'urbana'],
        ['rap / hip-hop', 'rap_hiphop'],
        ['folk i arrel', 'folk_arrel'],
        ["cançó d'autor", 'canco_autor'],
        ["canco d'autor", 'canco_autor'],
        ['electrònica', 'electronica'],
        ['electronica', 'electronica'],
        ['ska / reggae', 'ska_reggae'],
        ['ska punk', 'ska_reggae'],
        ['rumba / mestissatge', 'rumba_mestissatge'],
        ['mestissatge / rumba', 'rumba_mestissatge'],
        ['punk / metal', 'punk_metal'],
        ['jazz / blues', 'jazz_blues'],
        ['clàssica', 'classica'],
        ['classica', 'classica'],
        ['infantil', 'infantil'],
        ['altres estils', 'altres_estils'],
        ['seguint', 'seguint'],
        ['tot', 'tot'],
        ['recomanat per a tu', 'tot'],
    ]);

    for (const value of [...BUILTIN_CATEGORIES.values()]) BUILTIN_CATEGORIES.set(value, value);

    let lastSignature = '';
    let lastSentAt = 0;
    let initialized = false;

    function isAdminView() {
        try {
            return new URLSearchParams(window.location.search || '').get('analytics') === '1';
        } catch {
            return false;
        }
    }

    function enabled() {
        try {
            return localStorage.getItem(ENABLED_KEY) !== '0';
        } catch {
            return true;
        }
    }

    function randomHex(bytes = 16) {
        try {
            const data = new Uint8Array(bytes);
            window.crypto?.getRandomValues?.(data);
            if (data.some(value => value !== 0)) {
                return Array.from(data, value => value.toString(16).padStart(2, '0')).join('');
            }
        } catch {}
        let fallback = '';
        for (let i = 0; i < bytes * 2; i += 1) {
            fallback += Math.floor(Math.random() * 16).toString(16);
        }
        return fallback;
    }

    function analyticsClientId() {
        if (!enabled()) return '';

        const now = Date.now();
        try {
            const saved = JSON.parse(localStorage.getItem(CLIENT_ID_KEY) || 'null');
            const id = String(saved?.id || '');
            const createdAt = Number(saved?.createdAt) || 0;
            if (/^[a-f0-9]{32}$/.test(id) && createdAt > 0 && now - createdAt < CLIENT_ID_MAX_AGE_MS) {
                return id;
            }
        } catch {}

        const record = { id: randomHex(16), createdAt: now };
        try {
            localStorage.setItem(CLIENT_ID_KEY, JSON.stringify(record));
        } catch {}
        return record.id;
    }

    function setEnabled(value) {
        try {
            localStorage.setItem(ENABLED_KEY, value ? '1' : '0');
            if (!value) localStorage.removeItem(CLIENT_ID_KEY);
        } catch {}
        renderSetting();
    }

    function deviceClass() {
        try {
            return window.matchMedia?.('(max-width: 768px)')?.matches ? 'mobile' : 'desktop';
        } catch {
            return 'desktop';
        }
    }

    function currentSurface() {
        const body = document.body;
        if (body?.classList.contains('segueix-tv-playback')) return 'tv';
        if (!document.getElementById('watchPage')?.classList.contains('hidden')) return 'watch';
        if (!document.getElementById('followPage')?.classList.contains('hidden')) return 'follow';
        if (!document.getElementById('playlistsPage')?.classList.contains('hidden')) return 'library';
        if (!document.getElementById('historyPage')?.classList.contains('hidden')) return 'history';
        if (!document.getElementById('channelPage')?.classList.contains('hidden')) return 'channel';
        return 'home';
    }

    function normalizeCategory(value) {
        const raw = String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();

        if (!raw) return 'other';
        if (raw === 'segueix tv' || raw === 'música tv' || raw === 'musica tv') return 'other';
        if (BUILTIN_CATEGORIES.has(raw)) return BUILTIN_CATEGORIES.get(raw);

        const original = String(value || '').trim().toLowerCase();
        if (BUILTIN_CATEGORIES.has(original)) return BUILTIN_CATEGORIES.get(original);
        return 'custom';
    }

    function currentCategory() {
        const activeChip = document.querySelector('.chips-bar .chip.is-active[data-cat]');
        const value =
            activeChip?.dataset?.cat ||
            document.getElementById('pageTitle')?.dataset?.title ||
            document.getElementById('pageTitle')?.textContent ||
            '';
        return normalizeCategory(value);
    }

    function sanitizeContext(raw = {}) {
        const context = {
            surface: raw.surface || currentSurface(),
            device: raw.device || deviceClass(),
        };
        if (raw.category) context.category = normalizeCategory(raw.category);
        if (raw.tvMode) context.tvMode = String(raw.tvMode);
        if (raw.state === 'on' || raw.state === 'off') context.state = raw.state;
        return context;
    }

    function send(payload) {
        const clientId = analyticsClientId();
        const json = JSON.stringify({
            ...payload,
            ...(clientId ? { clientId } : {}),
        });

        try {
            if (navigator.sendBeacon && new URL(ENDPOINT).origin === window.location.origin) {
                const blob = new Blob([json], { type: 'application/json' });
                if (navigator.sendBeacon(ENDPOINT, blob)) return true;
            }
        } catch {}

        try {
            fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: json,
                keepalive: true,
                credentials: 'omit',
            }).catch(() => {});
            return true;
        } catch {
            return false;
        }
    }

    function track(eventName, rawContext = {}) {
        if (isAdminView() || !enabled()) return false;

        const context = sanitizeContext(rawContext);
        const signature = JSON.stringify([eventName, context]);
        const now = Date.now();
        if (signature === lastSignature && now - lastSentAt < DEDUPE_MS) return false;

        lastSignature = signature;
        lastSentAt = now;
        return send({ event: eventName, context });
    }

    function tvModeFromElement(element) {
        if (element?.classList?.contains('segueix-tv-chip')) return 'segueix';
        const explicit = String(element?.dataset?.contextTv || '').trim();
        if (['category', 'channel', 'program'].includes(explicit)) return explicit;
        if (document.body?.classList.contains('segueix-tv-active')) return 'segueix';
        if (document.body?.classList.contains('segueix-tv-playback')) return 'other';
        return 'playlist';
    }

    function handleDocumentClick(event) {
        const target = event.target;
        if (!target?.closest) return;

        const tvStart = target.closest('.context-tv-btn');
        if (tvStart) {
            track('tv_start', {
                surface: 'home',
                tvMode: tvModeFromElement(tvStart),
                category: currentCategory(),
            });
            return;
        }

        const next = target.closest('.queue-next-button, [data-mq-next], [data-tv-programming-next], [data-tv-overlay-next]');
        if (next) {
            track('tv_next', { surface: 'tv', tvMode: tvModeFromElement(next) });
            return;
        }

        const regenerate = target.closest('.tv-regenerate-button, [data-mq-regenerate], [data-action="segueix-tv-refresh"]');
        if (regenerate) {
            track('tv_regenerate', { surface: currentSurface(), tvMode: tvModeFromElement(regenerate) });
            return;
        }

        const follow = target.closest('[data-follow-channel]');
        if (follow) {
            const currentlyPressed = follow.getAttribute('aria-pressed') === 'true';
            track('follow_toggle', {
                surface: currentSurface(),
                state: currentlyPressed ? 'off' : 'on',
            });
            return;
        }

        const like = target.closest('#likeToggle, #playerLikeBtn, [data-like-video], .like-toggle, .like-button');
        if (like) {
            const currentlyPressed = like.getAttribute('aria-pressed') === 'true' || like.classList.contains('is-liked');
            track('like_toggle', {
                surface: currentSurface(),
                state: currentlyPressed ? 'off' : 'on',
            });
            return;
        }

        const continueWatching = target.closest('[data-continue-open]');
        if (continueWatching) {
            track('continue_watching_open', {
                surface: 'home',
                category: currentCategory(),
            });
            return;
        }

        const category = target.closest('.chip[data-cat]');
        if (category && !category.classList.contains('segueix-tv-chip')) {
            track('category_open', {
                surface: 'home',
                category: category.dataset.cat,
            });
            return;
        }

        const video =
            target.closest('.video-card[data-video-id], .archive-video-card[data-video-id], #heroSection[data-video-id]');
        if (video && !target.closest('button, a.channel-link, .video-action-btn, .playlist-action')) {
            track('video_open', {
                surface: currentSurface(),
                category: currentCategory(),
            });
        }
    }

    function handleSearchSubmit(event) {
        if (!event.target?.matches?.('form.search, .search')) return;
        track('search_used', { surface: 'search' });
    }

    function instrumentMusicRadios() {
        const queue = app.features.musicQueue;
        if (!queue) return;
        for (const [name, tvMode] of Object.entries({
            startDiscovery: 'segueix',
            startArtistRadio: 'channel',
            startStyleRadio: 'category',
            startCategoryRadio: 'category',
            startFromSearch: 'other',
        })) {
            const original = queue[name];
            if (typeof original !== 'function') continue;
            queue[name] = function (...args) {
                const result = original.apply(this, args);
                if (result === true || result?.started === true) {
                    track('tv_start', { surface: currentSurface(), tvMode });
                }
                return result;
            };
        }
    }

    function installSetting() {
        if (document.getElementById('anonymousAnalyticsSettingsSection')) {
            renderSetting();
            return;
        }

        const youtubeSection = document.getElementById('youtubeConsentSettingsSection');
        const settingsContainer = youtubeSection?.parentElement;
        if (!youtubeSection || !settingsContainer) return;

        const section = document.createElement('div');
        section.className = 'settings-section';
        section.id = 'anonymousAnalyticsSettingsSection';
        section.innerHTML = `
            <p class="setting-label">Analítica anònima</p>
            <div class="lucky-row">
                <span class="modal-description" id="anonymousAnalyticsDescription">
                    Envia comptadors d'ús i un identificador aleatori del navegador que rota cada 90 dies per calcular usuaris únics. No envia IP, vídeos, canals, cerques ni historial.
                </span>
                <label class="toggle-switch" for="toggleAnonymousAnalyticsBtn">
                    <input type="checkbox" id="toggleAnonymousAnalyticsBtn" aria-describedby="anonymousAnalyticsDescription">
                    <span class="toggle-slider"></span>
                </label>
            </div>
        `;
        settingsContainer.insertBefore(section, youtubeSection);

        section.querySelector('#toggleAnonymousAnalyticsBtn')?.addEventListener('change', event => {
            const nextEnabled = Boolean(event.currentTarget?.checked);
            setEnabled(nextEnabled);
            if (nextEnabled) {
                track('app_open', { surface: currentSurface() });
            }
        });

        renderSetting();
    }

    function renderSetting() {
        const toggle = document.getElementById('toggleAnonymousAnalyticsBtn');
        if (!toggle) return;
        toggle.checked = enabled();
        toggle.setAttribute('aria-checked', toggle.checked ? 'true' : 'false');
    }

    function init() {
        if (initialized) return;
        initialized = true;
        instrumentMusicRadios();
        installSetting();

        document.addEventListener('click', handleDocumentClick, true);
        document.addEventListener('submit', handleSearchSubmit, true);

        // Deixem que els handlers d'inicialització de l'app resolguin primer
        // una entrada directa a vídeo, historial, biblioteca, etc.
        window.setTimeout(() => {
            track('app_open', {
                surface: currentSurface(),
                category: currentCategory(),
            });
        }, 0);
    }

    app.features.analytics = {
        track,
        enabled,
        setEnabled,
        currentSurface,
        currentCategory,
        installSetting,
        analyticsClientId,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})(window);
