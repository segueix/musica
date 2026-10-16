(function (window) {
    const app = window.SegueixApp || (window.SegueixApp = {});
    app.features = app.features || {};

    const runtime = { hooks: {} };
    const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
    const VIDEO_PATH_PATTERN = /^\/video\/[^/]+$/;
    const APP_SECTION_HASHES = new Set(['#historial', '#llistes', '#segueix']);
    // Respecte a la carpeta de l'app (appBasePath()), mai relativa: la URL canvia en reproduir
    const DEFAULT_VIDEO_THUMBNAIL_FILE = 'img/caratula.webp';
    const CONTINUE_SECTION_ID = 'continueWatchingSection';
    const CONTINUE_LIST_ID = 'continueWatchingList';
    const PROGRESS_WRITE_INTERVAL_MS = 10000;
    const PLAYER_SWITCH_GRACE_MS = 1500;
    const MAX_EXPLICIT_START_SECONDS = 24 * 60 * 60;
    const dismissedProgressIds = new Set();
    let activeProgress = null;

    function registerRuntime(hooks = {}) {
        runtime.hooks = hooks || {};
    }

    function getContinueStorage() {
        return app.utils?.continueWatchingStorage || null;
    }

    function getActiveVideoId() {
        return String(app.state?.player?.currentVideoId || app.state?.currentVideoId || '').trim();
    }

    function getExplicitUrlStartAt(videoId) {
        try {
            const params = new window.URLSearchParams(window.location.search || '');
            if (!params.has('t')) return null;
            const id = String(videoId || '').trim();
            const queryVideoId = String(params.get('v') || '').trim();
            const pathname = decodeURIComponent(window.location.pathname || '');
            if (queryVideoId !== id && !pathname.includes(id)) return null;
            const seconds = Number(params.get('t'));
            if (!Number.isFinite(seconds) || seconds < 0 || seconds > MAX_EXPLICIT_START_SECONDS) return null;
            return Math.floor(seconds);
        } catch {
            return null;
        }
    }

    function resolvePlaybackOptions(videoId, options = {}) {
        const id = String(videoId || '').trim();
        const nextOptions = { ...options };
        const storage = getContinueStorage();
        const saved = storage?.get?.(id) || null;

        if (nextOptions.skipSavedProgress === true) {
            nextOptions.startAt = Math.max(0, Math.floor(Number(nextOptions.startAt) || 0));
            return { options: nextOptions, saved, resumed: false, explicit: true };
        }

        const explicitUrlStart = getExplicitUrlStartAt(id);
        if (explicitUrlStart !== null) {
            nextOptions.startAt = explicitUrlStart;
            return { options: nextOptions, saved, resumed: false, explicit: true };
        }

        const requestedStart = Number(nextOptions.startAt);
        if (Number.isFinite(requestedStart) && requestedStart > 0) {
            nextOptions.startAt = Math.floor(requestedStart);
            return { options: nextOptions, saved, resumed: false, explicit: true };
        }

        // Una cançó sempre comença de zero (portada, historial, ràdio…): el progrés desat ja no la fa represa.
        nextOptions.startAt = Math.max(0, Math.floor(Number(nextOptions.startAt) || 0));
        return { options: nextOptions, saved, resumed: false, explicit: false };
    }

    // Carpeta de l'app (segueix-app.js): «/musica/» a segueix.github.io/musica/, «/» a l'arrel d'un domini. Abans les
    // URL es posaven des de «/» i, a GitHub Pages, la URL del vídeo quedava a segueix.github.io/video/…: en recarregar
    // s'obria segueix.github.io (404) en lloc de l'app.
    function appBasePath() {
        const fromApp = app.utils?.appBasePath?.();
        if (fromApp) return fromApp;
        const path = String(window.location?.pathname || '/');
        return path.replace(/\/video\/[^/]*$/, '/').replace(/[^/]*$/, '') || '/';
    }

    function isReadableVideoPath(pathname) {
        const base = appBasePath();
        const path = String(pathname || '');
        return path.startsWith(base) && VIDEO_PATH_PATTERN.test(`/${path.slice(base.length)}`);
    }

    function isVideoThumbnailImage(img) {
        if (!img || img.tagName !== 'IMG') return false;
        const imageClasses = [
            'archive-video-thumb',
            'search-result-thumb',
            'sidebar-video-thumb',
            'playlist-video-thumb',
            'short-thumb',
            'continue-watching-thumb',
            'mm-row__thumb',
        ];
        if (imageClasses.some(className => img.classList?.contains?.(className))) return true;
        return Boolean(
            img.closest?.('.video-thumbnail') ||
            img.closest?.('.hero-thumbnail') ||
            img.closest?.('.video-placeholder') ||
            img.closest?.('.related-thumbnail') ||
            img.closest?.('.archive-video-thumb-wrap') ||
            img.closest?.('.playlist-card-thumb') ||
            img.closest?.('.mm-card__thumb') ||
            img.closest?.('.continue-watching-thumb-wrap') ||
            img.closest?.('.pt-card__media') ||
            img.closest?.('.pt-feature__media') ||
            img.closest?.('.pt-quick__thumb:not(.pt-quick__thumb--round)')
        );
    }

    function applyDefaultVideoThumbnailFallback(img) {
        if (!img || img.dataset?.defaultThumbnailFallback === 'applied') return;
        const currentSrc = String(img.getAttribute?.('src') || img.src || '');
        if (currentSrc.endsWith(DEFAULT_VIDEO_THUMBNAIL_FILE)) return;
        if (img.dataset) img.dataset.defaultThumbnailFallback = 'applied';
        img.src = `${appBasePath()}${DEFAULT_VIDEO_THUMBNAIL_FILE}`;
        if (img.style) img.style.visibility = '';
    }

    function installVideoThumbnailFallback() {
        const document = window.document;
        if (!document || document.documentElement?.dataset?.videoThumbnailFallbackGuard === '1') return;
        if (document.documentElement?.dataset) {
            document.documentElement.dataset.videoThumbnailFallbackGuard = '1';
        }

        document.addEventListener?.(
            'error',
            event => {
                const img = event.target;
                if (!isVideoThumbnailImage(img)) return;
                applyDefaultVideoThumbnailFallback(img);
            },
            true
        );

        document.addEventListener?.(
            'load',
            event => {
                const img = event.target;
                if (!isVideoThumbnailImage(img)) return;
                const src = String(img.currentSrc || img.src || '');
                if (!src.includes('ytimg.com')) return;
                if (img.naturalWidth === 120 && img.naturalHeight === 90) {
                    applyDefaultVideoThumbnailFallback(img);
                }
            },
            true
        );
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function installContinueWatchingStyles() {
        const document = window.document;
        if (!document?.head || document.getElementById?.('continueWatchingStyles')) return;
        const style = document.createElement('style');
        style.id = 'continueWatchingStyles';
        style.textContent = `
            .continue-watching-section{margin:0 0 24px;min-width:0}
            .continue-watching-header{display:flex;align-items:center;justify-content:space-between;margin:0 0 12px}
            .continue-watching-title{margin:0;font-size:1.15rem;font-weight:700;line-height:1.25}
            .continue-watching-list{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(240px,290px);gap:12px;overflow-x:auto;overscroll-behavior-inline:contain;scroll-snap-type:x proximity;padding:2px 2px 10px;scrollbar-width:thin}
            .continue-watching-card{position:relative;scroll-snap-align:start;min-width:0}
            .continue-watching-open{display:block;width:100%;padding:0;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer;border-radius:12px}
            .continue-watching-open:focus-visible,.continue-watching-remove:focus-visible{outline:3px solid var(--color-button-accent);outline-offset:3px}
            .continue-watching-thumb-wrap{position:relative;overflow:hidden;border-radius:12px;aspect-ratio:16/9;background:rgba(0,0,0,.28)}
            .continue-watching-thumb{display:block;width:100%;height:100%;object-fit:cover}
            .continue-watching-progress{position:absolute;left:0;right:0;bottom:0;height:5px;background:rgba(255,255,255,.25)}
            .continue-watching-progress-fill{display:block;height:100%;background:var(--color-button-accent);border-radius:0 999px 999px 0}
            .continue-watching-copy{padding:9px 2px 0}
            .continue-watching-name{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;font-size:.95rem;font-weight:600;line-height:1.3}
            .continue-watching-channel{display:block;margin-top:4px;color:rgba(255,255,255,.65);font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            .continue-watching-remove{position:absolute;top:8px;right:8px;display:grid;place-items:center;width:44px;height:44px;border:0;border-radius:999px;background:rgba(15,15,15,.82);color:#fff;font-size:25px;line-height:1;cursor:pointer;backdrop-filter:blur(6px)}
            .continue-watching-remove:hover{background:rgba(15,15,15,.96)}
            @media(max-width:768px){.continue-watching-section{margin-bottom:20px}.continue-watching-list{grid-auto-columns:minmax(218px,76vw);gap:12px}.continue-watching-title{font-size:1.05rem}}
        `;
        document.head.appendChild(style);
    }

    function ensureContinueWatchingSection() {
        const section = window.document?.getElementById?.(CONTINUE_SECTION_ID);
        section?.remove?.();
        return null;
    }

    function renderContinueWatching() {
        const storage = getContinueStorage();
        const section = ensureContinueWatchingSection();
        const list = window.document?.getElementById?.(CONTINUE_LIST_ID);
        if (!storage || !section || !list) return;

        const entries = storage.load?.() || [];
        section.classList?.toggle?.('hidden', entries.length === 0);
        if (entries.length === 0) {
            list.innerHTML = '';
            return;
        }

        list.innerHTML = entries
            .map(entry => {
                const duration = Math.max(0, Number(entry.duration) || 0);
                const position = Math.max(0, Number(entry.position) || 0);
                const progress = duration > 0 ? Math.min(100, Math.max(0, Math.round((position / duration) * 100))) : 0;
                const title = entry.title || 'Vídeo pendent';
                const thumbnail =
                    entry.thumbnail || `https://i.ytimg.com/vi/${encodeURIComponent(entry.id)}/hqdefault.jpg`;
                return `
                    <article class="continue-watching-card">
                        <button class="continue-watching-open" type="button" data-continue-open="${escapeHtml(entry.id)}" aria-label="Continua mirant ${escapeHtml(title)}">
                            <div class="continue-watching-thumb-wrap">
                                <img class="continue-watching-thumb" src="${escapeHtml(thumbnail)}" alt="" loading="lazy" decoding="async">
                                <div class="continue-watching-progress" role="progressbar" aria-label="Progrés de reproducció" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}">
                                    <span class="continue-watching-progress-fill" style="width:${progress}%"></span>
                                </div>
                            </div>
                            <div class="continue-watching-copy">
                                <span class="continue-watching-name">${escapeHtml(title)}</span>
                                <span class="continue-watching-channel">${escapeHtml(entry.channel || '')}</span>
                            </div>
                        </button>
                        <button class="continue-watching-remove" type="button" data-continue-remove="${escapeHtml(entry.id)}" aria-label="Treu ${escapeHtml(title)} de Continua mirant" title="Treu de Continua mirant">×</button>
                    </article>
                `;
            })
            .join('');
    }

    function currentProgressMetadata(videoId) {
        const document = window.document;
        const title = String(document?.getElementById?.('videoTitle')?.textContent || '').trim();
        const channelContainer = document?.getElementById?.('channelInfo');
        const channelNode = channelContainer?.querySelector?.(
            '.channel-name-modern, .channel-name, .channel-title, .channel-info-name, [data-channel-name]'
        );
        const channel = String(channelNode?.textContent || '').trim();
        const placeholder = document?.getElementById?.('placeholderImage');
        const thumbnail = String(placeholder?.currentSrc || placeholder?.src || '').trim();
        return {
            title,
            channel,
            thumbnail: thumbnail || `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`,
        };
    }

    function isTrackingComplete(progress) {
        const ratio = Number(getContinueStorage()?.completeRatio || 0.95);
        return progress?.duration > 0 && progress.position / progress.duration >= ratio;
    }

    function persistActiveProgress({ force = false } = {}) {
        const progress = activeProgress;
        const storage = getContinueStorage();
        if (
            !progress ||
            !storage ||
            progress.completed ||
            progress.isLive ||
            dismissedProgressIds.has(progress.videoId)
        ) {
            return false;
        }

        const now = Date.now();
        if (!force && now - progress.lastPersistAt < PROGRESS_WRITE_INTERVAL_MS) return false;
        if (isTrackingComplete(progress)) {
            storage.remove?.(progress.videoId);
            progress.completed = true;
            renderContinueWatching();
            return true;
        }
        if (progress.position < Number(storage.minSeconds || 30)) return false;

        const metadata = currentProgressMetadata(progress.videoId);
        const saved = storage.upsert?.({
            id: progress.videoId,
            position: progress.position,
            duration: progress.duration,
            updatedAt: now,
            title: metadata.title || progress.title,
            channel: metadata.channel || progress.channel,
            thumbnail: metadata.thumbnail || progress.thumbnail,
            source: progress.source,
        });
        if (saved) {
            progress.lastPersistAt = now;
            progress.title = metadata.title || progress.title;
            progress.channel = metadata.channel || progress.channel;
            progress.thumbnail = metadata.thumbnail || progress.thumbnail;
            renderContinueWatching();
        }
        return Boolean(saved);
    }

    function beginProgressTracking(videoId, source, resolved) {
        const id = String(videoId || '').trim();
        if (!VIDEO_ID_PATTERN.test(id)) {
            activeProgress = null;
            return null;
        }
        dismissedProgressIds.delete(id);
        const saved = resolved?.saved || getContinueStorage()?.get?.(id) || null;
        const startAt = Math.max(0, Math.floor(Number(resolved?.options?.startAt) || 0));
        activeProgress = {
            videoId: id,
            source: source === 'static' ? 'static' : 'api',
            position: startAt,
            duration: Math.max(0, Number(saved?.duration) || 0),
            lastPersistAt: 0,
            acceptAfter: Date.now() + PLAYER_SWITCH_GRACE_MS,
            playing: false,
            completed: false,
            isLive: false,
            title: saved?.title || '',
            channel: saved?.channel || '',
            thumbnail: saved?.thumbnail || '',
        };
        return activeProgress;
    }

    function stopProgressTrackingForSwitch(videoId, options = {}) {
        const id = String(videoId || '').trim();
        const restartingSameVideo = options.skipSavedProgress === true && activeProgress?.videoId === id;
        if (!restartingSameVideo) persistActiveProgress({ force: true });
        activeProgress = null;
    }

    function markCurrentProgressComplete() {
        if (!activeProgress) return;
        getContinueStorage()?.remove?.(activeProgress.videoId);
        activeProgress.completed = true;
        activeProgress.playing = false;
        renderContinueWatching();
    }

    function extractPayloadVideoId(payload) {
        const videoData = payload?.info?.videoData;
        return String(videoData?.video_id || videoData?.videoId || '').trim();
    }

    function updateLiveStateFromPayload(payload) {
        if (!activeProgress) return;
        const videoData = payload?.info?.videoData;
        if (
            videoData?.isLive === true ||
            videoData?.isLiveBroadcast === true ||
            videoData?.liveBroadcastContent === 'live'
        ) {
            activeProgress.isLive = true;
            getContinueStorage()?.remove?.(activeProgress.videoId);
            renderContinueWatching();
        }
    }

    function processContinueWatchingPayload(payload, { now = Date.now(), videoIdHint = '' } = {}) {
        const progress = activeProgress;
        if (!progress || (videoIdHint && videoIdHint !== progress.videoId)) return false;

        updateLiveStateFromPayload(payload);
        if (progress.isLive) return true;

        if (payload?.event === 'onStateChange') {
            const state = Number(payload.info);
            if (state === 1) progress.playing = true;
            if (state === 2) {
                progress.playing = false;
                persistActiveProgress({ force: true });
            }
            if (state === 0) markCurrentProgressComplete();
            return true;
        }

        if (payload?.event !== 'infoDelivery' || payload?.info?.currentTime == null) return false;
        const position = Number(payload.info.currentTime);
        const duration = Number(payload.info.duration);
        if (Number.isFinite(position) && position >= 0) progress.position = position;
        if (Number.isFinite(duration) && duration > 0) progress.duration = duration;

        if (isTrackingComplete(progress)) {
            markCurrentProgressComplete();
            return true;
        }
        if (progress.playing && now - progress.lastPersistAt >= PROGRESS_WRITE_INTERVAL_MS) {
            persistActiveProgress();
        }
        return true;
    }

    function parseYouTubeMessagePayload(event) {
        if (!event?.origin || !/youtube\.com|youtube-nocookie\.com/.test(event.origin)) return null;
        let payload = event.data;
        if (typeof payload === 'string') {
            try {
                payload = JSON.parse(payload);
            } catch {
                return null;
            }
        }
        return payload && typeof payload === 'object' ? payload : null;
    }

    function handleContinueWatchingYouTubeMessage(event) {
        const payload = parseYouTubeMessagePayload(event);
        const progress = activeProgress;
        if (!payload || !progress) return;
        const player = window.document?.getElementById?.('videoPlayer');
        const iframe = player?.querySelector?.('iframe');
        if (!iframe || (event.source && iframe.contentWindow && event.source !== iframe.contentWindow)) return;
        const playingVideoId = String(player?.dataset?.playingVideoId || getActiveVideoId()).trim();
        if (playingVideoId && playingVideoId !== progress.videoId) return;

        const payloadVideoId = extractPayloadVideoId(payload);
        if (payloadVideoId && payloadVideoId !== progress.videoId) return;
        const inSwitchGrace = !payloadVideoId && Date.now() < progress.acceptAfter;
        const isPlayingState = payload?.event === 'onStateChange' && Number(payload.info) === 1;
        if (inSwitchGrace && !isPlayingState) return;
        processContinueWatchingPayload(payload, { videoIdHint: progress.videoId });
    }

    function dismissContinueWatching(videoId) {
        const id = String(videoId || '').trim();
        if (!id) return;
        dismissedProgressIds.add(id);
        getContinueStorage()?.remove?.(id);
        renderContinueWatching();
    }

    function openContinueWatching(videoId) {
        const id = String(videoId || '').trim();
        const entry = getContinueStorage()?.get?.(id);
        if (!entry) return;
        if (entry.source === 'static') showVideo(id);
        else showVideoFromAPI(id);
    }

    function installContinueWatching() {
        installContinueWatchingStyles();
        ensureContinueWatchingSection();
        renderContinueWatching();
        window.document?.addEventListener?.('visibilitychange', () => {
            if (window.document.visibilityState === 'hidden') persistActiveProgress({ force: true });
        });
        window.addEventListener?.('pagehide', () => persistActiveProgress({ force: true }));
        window.addEventListener?.('storage', event => {
            if (!event.key || event.key === getContinueStorage()?.key) renderContinueWatching();
        });
    }

    function isWatchViewActive() {
        const document = window.document;
        const mainContent = document?.getElementById?.('mainContent');
        const watchPage = document?.getElementById?.('watchPage');
        if (!watchPage) return false;
        const watchVisible = !watchPage.classList?.contains?.('hidden');
        const mainVisible = !mainContent || !mainContent.classList?.contains?.('hidden');
        return watchVisible && mainVisible;
    }

    function normalizeUrlAfterLeavingWatch() {
        if (isWatchViewActive()) return;
        persistActiveProgress({ force: true });
        // Fora del reproductor la URL torna a la carpeta de l'app, sense el vídeo: ni /video/<slug>-<id> ni ?v=<id>
        // (si no, en recarregar s'obriria el vídeo i no la secció on és l'usuari)
        const params = new window.URLSearchParams(window.location.search || '');
        if (!isReadableVideoPath(window.location.pathname) && !params.has('v')) return;
        params.delete('v');
        params.delete('t');
        const query = params.toString();
        const hash = APP_SECTION_HASHES.has(window.location.hash) ? window.location.hash : '';
        try {
            window.history.replaceState(
                window.history.state || {},
                '',
                `${appBasePath()}${query ? `?${query}` : ''}${hash}`
            );
        } catch {}
    }

    function scheduleNavigationUrlNormalization() {
        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(normalizeUrlAfterLeavingWatch);
        } else if (typeof window.setTimeout === 'function') {
            window.setTimeout(normalizeUrlAfterLeavingWatch, 0);
        }
    }

    function installReadableVideoNavigationGuard() {
        const document = window.document;
        if (!document || document.documentElement?.dataset?.readableVideoNavigationGuard === '1') return;
        if (document.documentElement?.dataset) {
            document.documentElement.dataset.readableVideoNavigationGuard = '1';
        }
        document.addEventListener?.('click', scheduleNavigationUrlNormalization, true);
        window.addEventListener?.('popstate', scheduleNavigationUrlNormalization);
        if (typeof window.MutationObserver === 'function') {
            const observer = new window.MutationObserver(scheduleNavigationUrlNormalization);
            ['mainContent', 'watchPage', 'historyPage', 'playlistsPage', 'followPage', 'channelPage']
                .map(id => document.getElementById?.(id))
                .filter(Boolean)
                .forEach(element => observer.observe(element, { attributes: true, attributeFilter: ['class'] }));
        }
    }

    function installPlayerGuards() {
        installVideoThumbnailFallback();
        installReadableVideoNavigationGuard();
        installContinueWatching();
    }

    if (window.document?.readyState === 'loading') {
        window.document.addEventListener?.('DOMContentLoaded', installPlayerGuards, { once: true });
    } else {
        installPlayerGuards();
    }

    function queuePlayback(payload) {
        return runtime.hooks.queuePlaybackImpl?.(payload);
    }
    function initYouTubeMessageListener() {
        return runtime.hooks.initYouTubeMessageListenerImpl?.();
    }
    function handleYouTubeMessage(event) {
        handleContinueWatchingYouTubeMessage(event);
        return runtime.hooks.handleYouTubeMessageImpl?.(event);
    }
    function updatePlayerIframe(payload) {
        return runtime.hooks.updatePlayerIframeImpl?.(payload);
    }
    function preparePlayerForPlayback(payload) {
        return runtime.hooks.preparePlayerForPlaybackImpl?.(payload);
    }
    function showVideo(videoId, options = {}) {
        stopProgressTrackingForSwitch(videoId, options);
        const resolved = resolvePlaybackOptions(videoId, options);
        const result = runtime.hooks.showVideoImpl?.(videoId, resolved.options);
        beginProgressTracking(videoId, 'static', resolved);
        return result;
    }
    async function showVideoFromAPI(videoId, options = {}) {
        stopProgressTrackingForSwitch(videoId, options);
        const resolved = resolvePlaybackOptions(videoId, options);
        const tracker = beginProgressTracking(videoId, 'api', resolved);
        let result;
        try {
            result = await runtime.hooks.showVideoFromAPIImpl?.(videoId, resolved.options);
        } catch (error) {
            if (activeProgress === tracker) activeProgress = null;
            throw error;
        }
        if (activeProgress !== tracker) return result;
        const activeId = getActiveVideoId();
        if (activeId && activeId !== String(videoId || '').trim()) return result;
        return result;
    }
    function playThenNavigate(videoId, source) {
        return runtime.hooks.playThenNavigateImpl?.(videoId, source);
    }
    function loadRelatedVideos(currentVideoId) {
        return runtime.hooks.loadRelatedVideosImpl?.(currentVideoId);
    }
    function renderCategoryVideosBelow(currentChannelId, currentVideoId) {
        return runtime.hooks.renderCategoryVideosBelowImpl?.(currentChannelId, currentVideoId);
    }
    async function renderPlaylistRelatedVideos(playlistName) {
        return runtime.hooks.renderPlaylistRelatedVideosImpl?.(playlistName);
    }

    app.features.continueWatching = {
        render: renderContinueWatching,
        remove: dismissContinueWatching,
        _test: {
            resolvePlaybackOptions,
            beginProgressTracking,
            persistActiveProgress,
            processContinueWatchingPayload,
            stopProgressTrackingForSwitch,
            getActiveProgress: () => activeProgress,
        },
    };

    app.features.player = {
        registerRuntime,
        queuePlayback,
        initYouTubeMessageListener,
        handleYouTubeMessage,
        updatePlayerIframe,
        preparePlayerForPlayback,
        showVideo,
        showVideoFromAPI,
        playThenNavigate,
        loadRelatedVideos,
        renderCategoryVideosBelow,
        renderPlaylistRelatedVideos,
    };
})(window);

