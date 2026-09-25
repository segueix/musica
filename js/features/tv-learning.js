(function (window) {
    'use strict';

    const app = window.SegueixApp || (window.SegueixApp = {});
    app.features = app.features || {};

    const STORAGE_KEY = 'segueix_tv_learning_v1';
    const MAX_FEATURE_COUNT = 80;
    const LEARNING_RATE = 0.2;
    const SESSION_LEARNING_RATE = 0.55;
    const SESSION_HALF_LIFE_MS = 45 * 60 * 1000;
    const STOPWORDS = new Set([
        'amb', 'aquest', 'aquesta', 'aquests', 'aquestes', 'avui', 'com', 'dels', 'del', 'des', 'els', 'les',
        'una', 'unes', 'uns', 'per', 'pel', 'pels', 'que', 'qui', 'molt', 'mes', 'més', 'tot', 'tots', 'totes',
        'the', 'and', 'for', 'with', 'from', 'you', 'your', 'video', 'videos'
    ]);

    let profile = loadProfile();
    let liveProfile = emptyLiveProfile();
    let session = null;
    let manualSkipPending = false;
    let syncTimer = null;

    function emptyProfile() {
        return {
            version: 1,
            samples: 0,
            completed: 0,
            skippedEarly: 0,
            topics: {},
            categories: {},
            durations: {},
            updatedAt: 0,
        };
    }

    function emptyLiveProfile() {
        return {
            samples: 0,
            topics: {},
            categories: {},
            durations: {},
            revision: 0,
            lastSignalAt: 0,
        };
    }

    function loadProfile() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (!parsed || parsed.version !== 1) return emptyProfile();
            return {
                ...emptyProfile(),
                ...parsed,
                topics: parsed.topics && typeof parsed.topics === 'object' ? parsed.topics : {},
                categories: parsed.categories && typeof parsed.categories === 'object' ? parsed.categories : {},
                durations: parsed.durations && typeof parsed.durations === 'object' ? parsed.durations : {},
            };
        } catch {
            return emptyProfile();
        }
    }

    function saveProfile() {
        profile.updatedAt = Date.now();
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
        } catch {}
    }

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }

    function tokensForVideo(video) {
        const tokens = new Set();
        const add = value => {
            normalizeText(value)
                .split(/[^a-z0-9à-ÿ]+/i)
                .map(token => token.trim())
                .filter(token => token.length > 2 && !STOPWORDS.has(token))
                .slice(0, 28)
                .forEach(token => tokens.add(token));
        };
        add(video?.title || video?.snippet?.title);
        const tags = video?.tags || video?.snippet?.tags;
        if (Array.isArray(tags)) tags.slice(0, 12).forEach(add);
        add(String(video?.description || video?.snippet?.description || '').slice(0, 260));
        return [...tokens].slice(0, 14);
    }

    function categoriesForVideo(video) {
        const values = [
            ...(Array.isArray(video?.categories) ? video.categories : []),
            ...(Array.isArray(video?.customCategories) ? video.customCategories : []),
            ...(Array.isArray(video?.snippet?.categories) ? video.snippet.categories : []),
            video?.category,
            video?.snippet?.category,
        ];
        return [...new Set(values.map(value => normalizeText(value).trim()).filter(Boolean))].slice(0, 4);
    }

    function durationSeconds(video) {
        const direct = Number(video?.durationSeconds);
        if (Number.isFinite(direct) && direct > 0) return direct;
        const raw = String(video?.duration || video?.contentDetails?.duration || '');
        const match = raw.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
        if (!match) return 0;
        return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
    }

    function durationBucket(seconds) {
        const value = Number(seconds) || 0;
        if (value <= 0) return '';
        if (value < 600) return 'curt';
        if (value < 1500) return 'mitja';
        if (value < 3000) return 'llarg';
        return 'molt-llarg';
    }

    function featureValue(entry) {
        const value = Number(entry?.value);
        return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
    }

    function updateFeature(collection, key, signal, rate = LEARNING_RATE) {
        if (!key) return;
        const current = collection[key] || { value: 0, count: 0 };
        const count = Math.min(MAX_FEATURE_COUNT, Math.max(0, Number(current.count) || 0) + 1);
        const adaptiveRate = current.count ? rate : 1;
        const value = featureValue(current) * (1 - adaptiveRate) + signal * adaptiveRate;
        collection[key] = {
            value: Math.max(-1, Math.min(1, value)),
            count,
        };
    }

    function signalFromSession(item) {
        const duration = Number(item?.duration) || durationSeconds(item?.video);
        const position = Math.max(0, Number(item?.activeWatchedSeconds ?? item?.maxPosition) || 0);
        if (duration <= 0 || position < 8) return null;

        const ratio = Math.max(0, Math.min(1, position / duration));
        if (ratio >= 0.85) return { signal: 1, ratio, completed: true, skippedEarly: false };
        if (ratio >= 0.60) return { signal: 0.65, ratio, completed: false, skippedEarly: false };
        if (ratio >= 0.35) return { signal: 0.25, ratio, completed: false, skippedEarly: false };
        if (item?.manualSkip && (ratio < 0.15 || position < 45)) {
            return { signal: -1, ratio, completed: false, skippedEarly: true };
        }
        if (ratio < 0.20) return { signal: -0.7, ratio, completed: false, skippedEarly: true };
        return { signal: -0.2, ratio, completed: false, skippedEarly: false };
    }

    function recordSession(item) {
        if (!item?.video) return false;
        const result = signalFromSession(item);
        if (!result) return false;

        const signal = result.signal;
        const tokens = tokensForVideo(item.video);
        const categories = categoriesForVideo(item.video);
        const bucket = durationBucket(item.duration || durationSeconds(item.video));

        tokens.forEach(token => updateFeature(profile.topics, token, signal));
        categories.forEach(category => updateFeature(profile.categories, category, signal));
        if (bucket) updateFeature(profile.durations, bucket, signal);

        // Perfil temporal de la sessió: reacciona molt més ràpid que l'històric
        // i només viu mentre la pàgina continua oberta.
        tokens.forEach(token => updateFeature(liveProfile.topics, token, signal, SESSION_LEARNING_RATE));
        categories.forEach(category => updateFeature(liveProfile.categories, category, signal, SESSION_LEARNING_RATE));
        if (bucket) updateFeature(liveProfile.durations, bucket, signal, SESSION_LEARNING_RATE);
        liveProfile.samples = Math.min(10000, liveProfile.samples + 1);
        liveProfile.revision += 1;
        liveProfile.lastSignalAt = Date.now();

        profile.samples = Math.min(100000, (Number(profile.samples) || 0) + 1);
        if (result.completed) profile.completed = Math.min(100000, (Number(profile.completed) || 0) + 1);
        if (result.skippedEarly) profile.skippedEarly = Math.min(100000, (Number(profile.skippedEarly) || 0) + 1);
        saveProfile();

        try {
            window.dispatchEvent(new CustomEvent('segueix:tv-learning-update', {
                detail: {
                    revision: liveProfile.revision,
                    signal,
                    ratio: result.ratio,
                    videoId: videoId(item.video),
                },
            }));
        } catch {}
        return true;
    }

    function isTVPlayback() {
        try {
            return document.body.classList.contains('segueix-tv-playback')
                && typeof isPlaylistMode !== 'undefined'
                && Boolean(isPlaylistMode);
        } catch {
            return false;
        }
    }

    function currentQueueVideo() {
        try {
            if (!Array.isArray(activePlaylistQueue) || !activePlaylistQueue.length) return null;
            const index = Math.max(0, Math.min(activePlaylistQueue.length - 1, Number(currentPlaylistIndex) || 0));
            return activePlaylistQueue[index] || null;
        } catch {
            return null;
        }
    }

    function videoId(video) {
        return String(video?.id || video?.videoId || video?.snippet?.resourceId?.videoId || '').trim();
    }

    function beginOrSyncSession() {
        if (!isTVPlayback()) {
            if (session) recordSession(session);
            session = null;
            manualSkipPending = false;
            return;
        }

        const video = currentQueueVideo();
        const id = videoId(video);
        if (!video || !id) return;

        if (!session || session.id !== id) {
            if (session) {
                if (manualSkipPending) session.manualSkip = true;
                recordSession(session);
            }
            session = {
                id,
                video,
                startedAt: Date.now(),
                maxPosition: 0,
                activeWatchedSeconds: 0,
                lastObservedPosition: null,
                lastObservedAt: 0,
                duration: durationSeconds(video),
                manualSkip: false,
            };
            manualSkipPending = false;
        } else {
            session.video = video;
            if (!session.duration) session.duration = durationSeconds(video);
        }
    }

    function parseMessageData(raw) {
        if (raw && typeof raw === 'object') return raw;
        if (typeof raw !== 'string') return null;
        try { return JSON.parse(raw); } catch { return null; }
    }

    function onPlayerMessage(event) {
        if (!isTVPlayback()) return;
        const payload = parseMessageData(event.data);
        if (payload?.event !== 'infoDelivery') return;
        beginOrSyncSession();
        if (!session) return;

        const position = Number(payload?.info?.currentTime);
        const duration = Number(payload?.info?.duration);
        if (Number.isFinite(position) && position >= 0) {
            session.maxPosition = Math.max(session.maxPosition || 0, position);

            const previous = Number(session.lastObservedPosition);
            const delta = Number.isFinite(previous) ? position - previous : 0;
            // Només compta reproducció realment visible. Salts grans (seek, retorn
            // d'una pestanya en segon pla...) no es converteixen en temps vist.
            if (!document.hidden && delta > 0 && delta <= 5.5) {
                session.activeWatchedSeconds = Math.min(
                    Number(session.duration || duration) || Infinity,
                    (Number(session.activeWatchedSeconds) || 0) + delta
                );
            }
            session.lastObservedPosition = position;
            session.lastObservedAt = Date.now();
        }
        if (Number.isFinite(duration) && duration > 0) session.duration = duration;
    }

    function markManualSkip(event) {
        if (!isTVPlayback()) return;
        const queueItem = event.target?.closest?.('#playlistQueueContainer .playlist-queue-item');
        const explicitNext = event.target?.closest?.(
            '.queue-next-button, [data-tv-programming-next], [data-tv-overlay-next]'
        );
        if (!explicitNext && (!queueItem || queueItem.classList.contains('is-active'))) return;
        if (session) session.manualSkip = true;
        manualSkipPending = true;
    }

    function scoreFeature(collection, keys, weight) {
        const entries = keys
            .map(key => collection[key])
            .filter(entry => entry && Number(entry.count) >= 1)
            .map(featureValue);
        if (!entries.length) return 0;
        const average = entries.reduce((sum, value) => sum + value, 0) / entries.length;
        return average * weight;
    }

    function affinityForVideo(video) {
        if (!video || Number(profile.samples) < 3) return 0;

        const topicScore = scoreFeature(profile.topics, tokensForVideo(video), 2.4);
        const categoryScore = scoreFeature(profile.categories, categoriesForVideo(video), 1.45);
        const bucket = durationBucket(durationSeconds(video));
        const durationScore = bucket ? scoreFeature(profile.durations, [bucket], 1.15) : 0;

        return Math.max(-4.2, Math.min(4.2, topicScore + categoryScore + durationScore));
    }

    function sessionDecay() {
        if (!liveProfile.lastSignalAt) return 0;
        const age = Math.max(0, Date.now() - liveProfile.lastSignalAt);
        return Math.pow(0.5, age / SESSION_HALF_LIFE_MS);
    }

    function sessionAffinityForVideo(video) {
        if (!video || liveProfile.samples < 1) return 0;

        const topicScore = scoreFeature(liveProfile.topics, tokensForVideo(video), 3.6);
        const categoryScore = scoreFeature(liveProfile.categories, categoriesForVideo(video), 2.05);
        const bucket = durationBucket(durationSeconds(video));
        const durationScore = bucket ? scoreFeature(liveProfile.durations, [bucket], 1.3) : 0;
        const raw = Math.max(-5.5, Math.min(5.5, topicScore + categoryScore + durationScore));
        return raw * sessionDecay();
    }

    function getSessionSummary() {
        return {
            samples: liveProfile.samples,
            revision: liveProfile.revision,
            lastSignalAt: liveProfile.lastSignalAt,
            decay: sessionDecay(),
        };
    }

    function getSummary() {
        const samples = Number(profile.samples) || 0;
        const completed = Number(profile.completed) || 0;
        const skippedEarly = Number(profile.skippedEarly) || 0;
        return {
            samples,
            completed,
            skippedEarly,
            ready: samples >= 3,
            storageKey: STORAGE_KEY,
        };
    }

    function reset() {
        profile = emptyProfile();
        liveProfile = emptyLiveProfile();
        session = null;
        manualSkipPending = false;
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
    }

    function init() {
        window.addEventListener('message', onPlayerMessage);
        document.addEventListener('click', markManualSkip, true);
        window.addEventListener('pagehide', () => {
            if (session) recordSession(session);
            session = null;
        });
        syncTimer = window.setInterval(beginOrSyncSession, 800);
        beginOrSyncSession();
    }

    app.features.tvLearning = {
        affinityForVideo,
        sessionAffinityForVideo,
        getSummary,
        getSessionSummary,
        reset,
        recordSession,
        durationBucket,
        tokensForVideo,
        categoriesForVideo,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})(window);
