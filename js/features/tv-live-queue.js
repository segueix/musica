(function (window) {
    'use strict';

    const app = window.SegueixApp || (window.SegueixApp = {});
    app.features = app.features || {};

    const PROTECTED_AHEAD = 1; // vídeo actual + A continuació
    const EXPLORATION_EVERY = 4;
    const MIN_REORDERABLE = 3;
    const REORDER_DEBOUNCE_MS = 180;

    let rerankTimer = null;
    let lastRevision = 0;

    function isTVPlayback() {
        try {
            return document.body.classList.contains('segueix-tv-playback')
                && typeof isPlaylistMode !== 'undefined'
                && Boolean(isPlaylistMode);
        } catch {
            return false;
        }
    }

    function getQueue() {
        try {
            return Array.isArray(activePlaylistQueue) ? activePlaylistQueue : [];
        } catch {
            return [];
        }
    }

    function getIndex() {
        try {
            const value = Number(currentPlaylistIndex);
            return Number.isInteger(value) && value >= 0 ? value : 0;
        } catch {
            return 0;
        }
    }

    function videoId(video) {
        return String(video?.id || video?.videoId || video?.snippet?.resourceId?.videoId || '').trim();
    }

    function channelId(video) {
        return String(video?.channelId || video?.snippet?.channelId || '').trim();
    }

    function durationSeconds(video) {
        const direct = Number(video?.durationSeconds);
        if (Number.isFinite(direct) && direct > 0) return direct;
        const raw = String(video?.duration || video?.contentDetails?.duration || '');
        const match = raw.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
        if (!match) return 0;
        return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
    }

    function sessionAffinity(video) {
        try {
            const value = Number(app.features.tvLearning?.sessionAffinityForVideo?.(video));
            return Number.isFinite(value) ? Math.max(-5.5, Math.min(5.5, value)) : 0;
        } catch {
            return 0;
        }
    }

    function categories(video) {
        try {
            const values = app.features.tvLearning?.categoriesForVideo?.(video);
            return Array.isArray(values) ? values : [];
        } catch {
            return [];
        }
    }

    function tokens(video) {
        try {
            const values = app.features.tvLearning?.tokensForVideo?.(video);
            return new Set(Array.isArray(values) ? values : []);
        } catch {
            return new Set();
        }
    }

    function topicSimilarity(a, b) {
        if (!a || !b) return 0;
        const left = tokens(a);
        const right = tokens(b);
        if (!left.size || !right.size) return 0;
        let overlap = 0;
        left.forEach(token => {
            if (right.has(token)) overlap += 1;
        });
        return overlap / Math.sqrt(left.size * right.size);
    }

    function sharesCategory(video, recent) {
        const own = categories(video);
        if (!own.length || !recent.length) return false;
        const recentSet = new Set(recent.flatMap(categories));
        return own.some(category => recentSet.has(category));
    }

    function rhythmAdjustment(previous, candidate) {
        if (!previous || !candidate) return 0;
        const a = durationSeconds(previous);
        const b = durationSeconds(candidate);
        if (!a || !b) return 0;
        if (a >= 2400 && b >= 2400) return -1.25;
        if (a >= 2400 && b >= 300 && b <= 1200) return 0.8;
        if (a <= 600 && b >= 3600) return -0.55;
        return 0;
    }

    function candidateScore(item, placed, originalPosition, multipleChannels) {
        const previous = placed[placed.length - 1] || null;
        const recent = placed.slice(-2);
        let score = sessionAffinity(item.video);

        if (sharesCategory(item.video, recent)) score -= 0.75;
        const similarity = topicSimilarity(previous, item.video);
        if (similarity > 0.42) score -= Math.min(1.35, similarity * 1.7);
        score += rhythmAdjustment(previous, item.video);

        if (multipleChannels) {
            const recentChannels = new Set(recent.map(channelId).filter(Boolean));
            if (recentChannels.has(channelId(item.video))) score -= 1.0;
        }

        // Una mica d'inèrcia evita que una sola mostra capgiri tota la cua.
        score -= Math.min(0.75, Math.max(0, originalPosition) * 0.045);
        return score;
    }

    function sameOrder(a, b) {
        if (a.length !== b.length) return false;
        return a.every((video, index) => videoId(video) === videoId(b[index]));
    }

    function reorderTail(queue, startIndex) {
        const tail = queue.slice(startIndex);
        if (tail.length < MIN_REORDERABLE) return tail;

        const multipleChannels = new Set(tail.map(channelId).filter(Boolean)).size > 2;
        const remaining = tail.map((video, originalPosition) => ({ video, originalPosition }));
        const placed = queue.slice(Math.max(0, startIndex - 2), startIndex);

        while (remaining.length) {
            const absolutePosition = startIndex + (placed.length - Math.min(2, startIndex));
            const explorationSlot = (absolutePosition + 1) % EXPLORATION_EVERY === 0;

            let selectedIndex = 0;
            if (!explorationSlot) {
                let bestScore = -Infinity;
                remaining.forEach((item, index) => {
                    const score = candidateScore(item, placed, item.originalPosition, multipleChannels);
                    if (score > bestScore) {
                        bestScore = score;
                        selectedIndex = index;
                    }
                });
            } else {
                // Slot de descoberta: manté l'ordre de qualitat original i no usa
                // l'afinitat temporal de la sessió.
                selectedIndex = remaining.reduce((best, item, index) => (
                    item.originalPosition < remaining[best].originalPosition ? index : best
                ), 0);
            }

            const [selected] = remaining.splice(selectedIndex, 1);
            placed.push(selected.video);
        }

        return placed.slice(Math.min(2, startIndex));
    }

    function rerankRemainingQueue({ force = false } = {}) {
        if (!isTVPlayback()) return false;

        const summary = app.features.tvLearning?.getSessionSummary?.();
        const revision = Number(summary?.revision) || 0;
        if (!force && (!revision || revision === lastRevision)) return false;

        const queue = getQueue();
        const index = getIndex();
        const startIndex = index + PROTECTED_AHEAD + 1;
        if (startIndex >= queue.length || queue.length - startIndex < MIN_REORDERABLE) {
            lastRevision = revision;
            return false;
        }

        const currentId = videoId(queue[index]);
        const nextId = videoId(queue[index + 1]);
        const oldTail = queue.slice(startIndex);
        const newTail = reorderTail(queue, startIndex);
        lastRevision = revision;

        if (sameOrder(oldTail, newTail)) return false;

        try {
            activePlaylistQueue.splice(startIndex, oldTail.length, ...newTail);
        } catch {
            return false;
        }

        // Garantia de seguretat: la TV viva no pot tocar mai el que sona ni
        // el vídeo anunciat com «A continuació».
        if (videoId(queue[index]) !== currentId || videoId(queue[index + 1]) !== nextId) {
            activePlaylistQueue.splice(startIndex, newTail.length, ...oldTail);
            return false;
        }

        try {
            if (typeof renderPlaylistQueue === 'function') renderPlaylistQueue();
        } catch {}
        try { app.features.tvProgramming?.sync?.(); } catch {}

        try {
            window.dispatchEvent(new CustomEvent('segueix:tv-live-queue-updated', {
                detail: {
                    revision,
                    currentIndex: index,
                    protectedThrough: index + 1,
                    changed: oldTail.reduce((count, video, position) => (
                        videoId(video) !== videoId(newTail[position]) ? count + 1 : count
                    ), 0),
                },
            }));
        } catch {}

        return true;
    }

    function scheduleRerank() {
        clearTimeout(rerankTimer);
        rerankTimer = window.setTimeout(() => rerankRemainingQueue(), REORDER_DEBOUNCE_MS);
    }

    function onLearningUpdate() {
        scheduleRerank();
    }

    function init() {
        window.addEventListener('segueix:tv-learning-update', onLearningUpdate);
    }

    app.features.tvLiveQueue = {
        rerankRemainingQueue,
        reorderTail,
        sessionAffinity,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})(window);
