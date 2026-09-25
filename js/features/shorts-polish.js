(function (window) {
    const document = window.document;
    const app = window.SegueixApp || (window.SegueixApp = {});
    const NAVIGATION_GESTURE_WINDOW_MS = 1400;
    const NATIVE_CONTROLS_SETTLE_MS = 450;
    const COVER_SAFETY_MS = 1800;
    const FEED_CACHE_KEY = 'catube_feed_v1';
    let lastNavigationGestureAt = 0;
    let lastPlayingAt = 0;
    let currentShortVideoId = '';
    let coverReleaseTimer = null;
    let coverSafetyTimer = null;
    let touchStart = null;
    let remoteFeedPromise = null;
    let remoteFeedVideos = [];

    function installStyles() {
        if (!document?.head || document.getElementById('shortsPolishStyles')) return;
        const style = document.createElement('style');
        style.id = 'shortsPolishStyles';
        style.textContent = `
            #shortPosterCurrent.short-native-controls-cover {
                opacity: 1 !important;
                transition: none !important;
            }
            .short-views {
                display: block;
                margin-top: 3px;
                font-size: 0.8rem;
                line-height: 1.25;
                color: rgba(255,255,255,.82);
                text-shadow: 0 1px 2px rgba(0,0,0,.6);
            }
            .short-views.hidden { display: none !important; }
        `;
        document.head.appendChild(style);
    }

    function clearCoverTimers() {
        if (coverReleaseTimer) {
            window.clearTimeout(coverReleaseTimer);
            coverReleaseTimer = null;
        }
        if (coverSafetyTimer) {
            window.clearTimeout(coverSafetyTimer);
            coverSafetyTimer = null;
        }
    }

    function releaseNativeControlsCover() {
        clearCoverTimers();
        document.getElementById('shortPosterCurrent')?.classList.remove('short-native-controls-cover');
    }

    function holdNativeControlsCover() {
        const poster = document.getElementById('shortPosterCurrent');
        if (!poster) return;
        clearCoverTimers();
        poster.classList.add('short-native-controls-cover');
        coverSafetyTimer = window.setTimeout(releaseNativeControlsCover, COVER_SAFETY_MS);
    }

    function scheduleCoverRelease() {
        const poster = document.getElementById('shortPosterCurrent');
        if (!poster?.classList.contains('short-native-controls-cover')) return;
        if (coverReleaseTimer) window.clearTimeout(coverReleaseTimer);
        const elapsed = Date.now() - lastPlayingAt;
        const delay = Math.max(0, NATIVE_CONTROLS_SETTLE_MS - elapsed);
        coverReleaseTimer = window.setTimeout(releaseNativeControlsCover, delay);
    }

    function markNavigationGesture() {
        lastNavigationGestureAt = Date.now();
    }

    function navigationGestureIsRecent() {
        return Date.now() - lastNavigationGestureAt <= NAVIGATION_GESTURE_WINDOW_MS;
    }

    function getNumericViewCount(video) {
        const candidates = [
            video?.viewCount,
            video?.views,
            video?.statistics?.viewCount,
            video?.snippet?.statistics?.viewCount,
        ];
        for (const candidate of candidates) {
            if (candidate === null || candidate === undefined || candidate === '') continue;
            const value = Number(candidate);
            if (Number.isFinite(value) && value >= 0) return value;
        }
        return null;
    }

    function getStoredHistoryVideos() {
        try {
            const parsed = JSON.parse(window.localStorage?.getItem?.('catube_history') || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function getStoredFeedVideos() {
        try {
            const parsed = JSON.parse(window.localStorage?.getItem?.(FEED_CACHE_KEY) || '{}');
            return Array.isArray(parsed?.videos) ? parsed.videos : [];
        } catch {
            return [];
        }
    }

    function getKnownShortVideos() {
        const sources = [
            app.state?.shorts?.currentShortsQueue,
            app.state?.feed?.currentVideos,
            window.YouTubeAPI?.feedVideos,
            window.cachedAPIVideos,
            window.VIDEOS,
            getStoredFeedVideos(),
            getStoredHistoryVideos(),
            remoteFeedVideos,
        ];
        const byId = new Map();
        sources.forEach(source => {
            if (!Array.isArray(source)) return;
            source.forEach(video => {
                const id = String(video?.id || video?.videoId || '').trim();
                if (!id) return;
                const previous = byId.get(id) || {};
                byId.set(id, { ...previous, ...video });
            });
        });
        return Array.from(byId.values());
    }

    function normalizeText(value) {
        return String(value || '').trim().replace(/\s+/g, ' ');
    }

    function findCurrentShortVideo() {
        const title = normalizeText(document.getElementById('shortTitle')?.textContent);
        const channel = normalizeText(document.getElementById('shortChannel')?.textContent);
        const videos = getKnownShortVideos();

        if (currentShortVideoId) {
            const byId = videos.find(video => String(video?.id || video?.videoId || '') === currentShortVideoId);
            if (byId) {
                const candidateTitle = normalizeText(byId?.title || byId?.snippet?.title);
                if (!title || !candidateTitle || candidateTitle === title) return byId;
            }
        }

        if (!title && !channel) return null;
        const exact = videos.find(video =>
            normalizeText(video?.title || video?.snippet?.title) === title &&
            (!channel || normalizeText(video?.channelTitle || video?.snippet?.channelTitle) === channel)
        );
        if (exact) return exact;
        return videos.find(video => normalizeText(video?.title || video?.snippet?.title) === title) || null;
    }

    function formatViews(value) {
        const count = Number(value);
        if (!Number.isFinite(count) || count < 0) return '';
        try {
            return new Intl.NumberFormat('ca', {
                notation: count >= 1000 ? 'compact' : 'standard',
                maximumFractionDigits: count >= 1000 ? 1 : 0,
            }).format(count);
        } catch {
            return Math.round(count).toLocaleString?.('ca') || String(Math.round(count));
        }
    }

    function ensureViewsElement() {
        let element = document.getElementById('shortViews');
        if (element) return element;
        const channel = document.getElementById('shortChannel');
        if (!channel || !channel.parentNode) return null;
        element = document.createElement('span');
        element.id = 'shortViews';
        element.className = 'short-views hidden';
        element.setAttribute('aria-live', 'polite');
        channel.insertAdjacentElement?.('afterend', element);
        if (!element.parentNode) channel.parentNode.appendChild(element);
        return element;
    }

    function renderShortViews(video) {
        const element = ensureViewsElement();
        if (!element) return false;
        const viewCount = getNumericViewCount(video);
        if (viewCount === null) {
            element.textContent = '';
            element.classList.add('hidden');
            return false;
        }
        element.textContent = `${formatViews(viewCount)} visualitzacions`;
        element.classList.remove('hidden');
        return true;
    }

    async function loadRemoteFeedOnce() {
        if (remoteFeedPromise) return remoteFeedPromise;
        if (typeof window.fetch !== 'function') return [];
        remoteFeedPromise = window.fetch('/data/feed.json', { cache: 'force-cache' })
            .then(response => response.ok ? response.json() : null)
            .then(data => {
                if (Array.isArray(data)) remoteFeedVideos = data;
                else if (Array.isArray(data?.videos)) remoteFeedVideos = data.videos;
                else if (Array.isArray(data?.items)) remoteFeedVideos = data.items;
                return remoteFeedVideos;
            })
            .catch(() => []);
        return remoteFeedPromise;
    }

    function refreshShortViews() {
        const video = findCurrentShortVideo();
        if (renderShortViews(video)) return;
        loadRemoteFeedOnce().then(() => {
            renderShortViews(findCurrentShortVideo());
        });
    }

    function handleShortMetaChange() {
        if (navigationGestureIsRecent()) {
            holdNativeControlsCover();
            if (lastPlayingAt) scheduleCoverRelease();
        }
        refreshShortViews();
    }

    function installMetaObserver() {
        const title = document.getElementById('shortTitle');
        const channel = document.getElementById('shortChannel');
        if (typeof window.MutationObserver !== 'function') {
            refreshShortViews();
            return;
        }
        const observer = new window.MutationObserver(handleShortMetaChange);
        [title, channel].filter(Boolean).forEach(element => observer.observe(element, {
            childList: true,
            characterData: true,
            subtree: true,
        }));
        refreshShortViews();
    }

    function installGestureTracking() {
        const overlay = document.getElementById('shortGestureOverlay');
        const wrap = document.getElementById('shortPlayerWrap');
        if (!overlay || overlay.dataset.shortsPolishBound === '1') return;
        overlay.dataset.shortsPolishBound = '1';

        overlay.addEventListener('wheel', event => {
            if (Math.abs(Number(event.deltaY) || 0) < 1) return;
            markNavigationGesture();
        }, { passive: true, capture: true });

        overlay.addEventListener('touchstart', event => {
            const touch = event.touches?.[0];
            touchStart = touch ? { x: touch.clientX, y: touch.clientY, at: Date.now() } : null;
        }, { passive: true, capture: true });

        overlay.addEventListener('touchend', event => {
            if (!touchStart) return;
            const touch = event.changedTouches?.[0];
            if (!touch) {
                touchStart = null;
                return;
            }
            const dy = touch.clientY - touchStart.y;
            const dx = touch.clientX - touchStart.x;
            const elapsed = Date.now() - touchStart.at;
            const distance = Math.abs(dy);
            const commitDistance = Math.max(60, (wrap?.clientHeight || 0) * 0.16);
            const isVertical = Math.abs(dy) >= Math.abs(dx);
            const isFlick = elapsed < 320 && distance > 40;
            if (isVertical && (distance >= commitDistance || isFlick)) markNavigationGesture();
            touchStart = null;
        }, { passive: true, capture: true });

        overlay.addEventListener('touchcancel', () => {
            touchStart = null;
        }, { passive: true, capture: true });
    }

    function extractVideoId(payload) {
        const info = payload?.info;
        const id =
            info?.videoData?.video_id ||
            info?.videoData?.videoId ||
            info?.video_id ||
            info?.videoId ||
            '';
        return String(id || '').trim();
    }

    function subscribeToShortInfoDelivery() {
        const iframe = document.getElementById('short-iframe');
        if (!iframe?.contentWindow) return;
        try {
            iframe.contentWindow.postMessage(JSON.stringify({
                event: 'listening',
                id: 'short-iframe-polish'
            }), '*');
            iframe.contentWindow.postMessage(JSON.stringify({
                event: 'command',
                func: 'addEventListener',
                args: ['infoDelivery']
            }), '*');
        } catch {}
    }

    function installPlaybackListener() {
        const iframe = document.getElementById('short-iframe');
        iframe?.addEventListener?.('load', () => {
            window.setTimeout(subscribeToShortInfoDelivery, 0);
        });
        window.setTimeout(subscribeToShortInfoDelivery, 500);

        window.addEventListener('message', event => {
            let originHost = '';
            try {
                originHost = new URL(event.origin).hostname;
            } catch {
                return;
            }
            if (!/(^|\.)youtube(-nocookie)?\.com$/i.test(originHost)) return;
            const currentIframe = document.getElementById('short-iframe');
            if (!currentIframe?.contentWindow || event.source !== currentIframe.contentWindow) return;
            let payload = event.data;
            if (typeof payload === 'string') {
                try {
                    payload = JSON.parse(payload);
                } catch {
                    return;
                }
            }

            if (payload?.event === 'infoDelivery') {
                const videoId = extractVideoId(payload);
                if (videoId && videoId !== currentShortVideoId) {
                    currentShortVideoId = videoId;
                    refreshShortViews();
                }
            }

            if (payload?.event === 'onStateChange' && Number(payload.info) === 1) {
                lastPlayingAt = Date.now();
                scheduleCoverRelease();
                subscribeToShortInfoDelivery();
            }
        });
    }

    function install() {
        installStyles();
        installGestureTracking();
        installMetaObserver();
        installPlaybackListener();
        loadRemoteFeedOnce().then(refreshShortViews);
    }

    if (document?.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install, { once: true });
    } else {
        install();
    }

    app.features.shortsPolish = {
        refreshViews: refreshShortViews,
        holdNativeControlsCover,
        releaseNativeControlsCover,
        _test: {
            getNumericViewCount,
            formatViews,
            normalizeText,
            extractVideoId,
            getStoredFeedVideos,
        },
    };
})(window);