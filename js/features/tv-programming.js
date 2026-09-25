(function (window) {
    'use strict';

    const app = window.SegueixApp || (window.SegueixApp = {});
    app.features = app.features || {};

    const WARNING_SECONDS = 15;
    let lastPosition = 0;
    let lastDuration = 0;
    let lastQueueVideoId = '';
    let queueObserver = null;
    let bodyObserver = null;
    let syncTimer = null;

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
            const index = Number(currentPlaylistIndex);
            return Number.isInteger(index) && index >= 0 ? index : 0;
        } catch {
            return 0;
        }
    }

    function videoId(video) {
        return String(video?.id || video?.videoId || video?.snippet?.resourceId?.videoId || '').trim();
    }

    function titleOf(video) {
        return String(video?.title || video?.snippet?.title || '').trim();
    }

    function channelOf(video) {
        return String(video?.channelTitle || video?.channel || video?.snippet?.channelTitle || '').trim();
    }

    function thumbnailOf(video) {
        const id = videoId(video);
        return String(
            video?.thumbnail ||
            video?.thumbnailUrl ||
            video?.thumbnails?.medium?.url ||
            video?.thumbnails?.high?.url ||
            video?.snippet?.thumbnails?.medium?.url ||
            video?.snippet?.thumbnails?.high?.url ||
            (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '')
        );
    }

    function secondsFromDuration(value) {
        if (Number.isFinite(Number(value)) && Number(value) > 0) return Number(value);
        const raw = String(value || '').trim();
        if (!raw) return 0;
        if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(raw)) {
            return raw.split(':').reduce((total, part) => total * 60 + Number(part), 0);
        }
        const match = raw.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
        if (!match) return 0;
        return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
    }

    function durationOf(video) {
        return secondsFromDuration(
            video?.durationSeconds ??
            video?.duration ??
            video?.contentDetails?.duration ??
            video?.snippet?.duration
        );
    }

    function formatTime(seconds) {
        const safe = Math.max(0, Math.floor(Number(seconds) || 0));
        const hours = Math.floor(safe / 3600);
        const minutes = Math.floor((safe % 3600) / 60);
        const secs = safe % 60;
        if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        return `${minutes}:${String(secs).padStart(2, '0')}`;
    }

    function currentAndNext() {
        const queue = getQueue();
        if (!queue.length) return { queue, current: null, next: null, index: 0 };
        const index = Math.min(getIndex(), queue.length - 1);
        const current = queue[index] || null;
        const next = queue.length > 1 ? queue[(index + 1) % queue.length] : null;
        return { queue, current, next, index };
    }

    function ensurePanelMarkup() {
        const panel = document.getElementById('tvProgrammingPanel');
        if (!panel) return null;
        if (panel.dataset.ready === 'true') return panel;
        panel.dataset.ready = 'true';
        panel.innerHTML = `
            <section class="tv-programming-now" aria-label="Ara">
                <div class="tv-programming-label">ARA</div>
                <div class="tv-programming-media">
                    <img class="tv-programming-thumb" data-tv-now-thumb alt="">
                    <div class="tv-programming-copy">
                        <strong class="tv-programming-title" data-tv-now-title></strong>
                        <span class="tv-programming-channel" data-tv-now-channel></span>
                        <div class="tv-programming-progress-row">
                            <div class="tv-programming-progress" aria-hidden="true"><span data-tv-progress-bar></span></div>
                            <span class="tv-programming-time" data-tv-progress-time></span>
                        </div>
                    </div>
                </div>
            </section>
            <button class="tv-programming-next" type="button" data-tv-programming-next aria-label="Reprodueix el vídeo següent">
                <div class="tv-programming-label">A CONTINUACIÓ</div>
                <div class="tv-programming-media">
                    <img class="tv-programming-thumb" data-tv-next-thumb alt="">
                    <div class="tv-programming-copy">
                        <strong class="tv-programming-title" data-tv-next-title></strong>
                        <span class="tv-programming-channel" data-tv-next-channel></span>
                        <span class="tv-programming-duration" data-tv-next-duration></span>
                    </div>
                    <span class="tv-programming-arrow" aria-hidden="true">→</span>
                </div>
            </button>
        `;
        panel.querySelector('[data-tv-programming-next]')?.addEventListener('click', advanceToNext);
        return panel;
    }

    function ensureStyles() {
        if (document.getElementById('tvProgrammingStyles')) return;
        const style = document.createElement('style');
        style.id = 'tvProgrammingStyles';
        style.textContent = `
            .tv-programming-panel{display:none;margin:10px 0 0;border:1px solid rgba(255,255,255,.09);border-radius:14px;overflow:hidden;background:rgba(255,255,255,.035)}
            body.segueix-tv-playback #watchPage .tv-programming-panel{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr)}
            body.segueix-tv-playback #watchPage .video-info::before{display:none!important}
            .tv-programming-now,.tv-programming-next{min-width:0;padding:12px 14px}
            .tv-programming-next{appearance:none;border:0;border-left:1px solid rgba(255,255,255,.08);background:transparent;color:inherit;text-align:left;cursor:pointer;font:inherit}
            .tv-programming-next:hover,.tv-programming-next:focus-visible{background:rgba(255,255,255,.055);outline:none}
            .tv-programming-label{margin-bottom:7px;font-size:.68rem;font-weight:800;letter-spacing:.11em;color:rgba(255,255,255,.56)}
            .tv-programming-media{display:grid;grid-template-columns:88px minmax(0,1fr) auto;gap:10px;align-items:center;min-width:0}
            .tv-programming-thumb{display:block;width:88px;aspect-ratio:16/9;object-fit:cover;border-radius:8px;background:rgba(255,255,255,.06)}
            .tv-programming-copy{display:flex;flex-direction:column;gap:3px;min-width:0}
            .tv-programming-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.92rem;line-height:1.25}
            .tv-programming-channel,.tv-programming-duration{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.76rem;color:rgba(255,255,255,.58)}
            .tv-programming-progress-row{display:flex;align-items:center;gap:8px;margin-top:4px;min-width:0}
            .tv-programming-progress{height:4px;flex:1;min-width:34px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.14)}
            .tv-programming-progress>span{display:block;width:0;height:100%;border-radius:inherit;background:currentColor;transition:width .35s linear}
            .tv-programming-time{flex:0 0 auto;font-size:.7rem;color:rgba(255,255,255,.58);font-variant-numeric:tabular-nums}
            .tv-programming-arrow{font-size:1.25rem;color:rgba(255,255,255,.62)}
            body.segueix-tv-playback #watchPage .playlist-queue-item.tv-programming-duplicate{display:none!important}
            .tv-next-up-overlay{position:absolute;right:14px;bottom:14px;z-index:40;display:grid;grid-template-columns:88px minmax(0,1fr) auto;gap:10px;align-items:center;width:min(420px,calc(100% - 28px));padding:9px 10px;border:1px solid rgba(255,255,255,.22);border-radius:12px;background:rgba(8,8,8,.92);box-shadow:0 8px 24px rgba(0,0,0,.35);color:#fff;opacity:0;transform:translateY(8px);pointer-events:none;transition:opacity .18s ease,transform .18s ease}
            .tv-next-up-overlay.is-visible{opacity:1;transform:translateY(0);pointer-events:auto}
            .tv-next-up-overlay img{display:block;width:88px;aspect-ratio:16/9;object-fit:cover;border-radius:7px}
            .tv-next-up-copy{display:flex;min-width:0;flex-direction:column;gap:2px}
            .tv-next-up-kicker{font-size:.62rem;font-weight:800;letter-spacing:.1em;color:rgba(255,255,255,.62)}
            .tv-next-up-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.83rem}
            .tv-next-up-channel{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.7rem;color:rgba(255,255,255,.62)}
            .tv-next-up-button{display:grid;place-items:center;width:34px;height:34px;border:1px solid rgba(255,255,255,.3);border-radius:999px;background:rgba(255,255,255,.1);color:#fff;cursor:pointer;font-size:1.15rem}
            .tv-next-up-button:hover,.tv-next-up-button:focus-visible{background:rgba(255,255,255,.2);outline:none}
            @media(max-width:700px){
                body.segueix-tv-playback #watchPage .tv-programming-panel{grid-template-columns:1fr}
                .tv-programming-next{border-left:0;border-top:1px solid rgba(255,255,255,.08)}
                .tv-programming-media{grid-template-columns:76px minmax(0,1fr) auto}
                .tv-programming-thumb{width:76px}
                .tv-next-up-overlay{right:8px;bottom:8px;width:calc(100% - 16px);grid-template-columns:72px minmax(0,1fr) auto}
                .tv-next-up-overlay img{width:72px}
            }
            @media(prefers-reduced-motion:reduce){
                .tv-programming-progress>span,.tv-next-up-overlay{transition:none}
            }
        `;
        document.head.appendChild(style);
    }

    function setImage(img, video) {
        if (!img) return;
        const src = thumbnailOf(video);
        if (src) {
            img.src = src;
            img.hidden = false;
        } else {
            img.removeAttribute('src');
            img.hidden = true;
        }
    }

    function renderPanel() {
        const panel = ensurePanelMarkup();
        if (!panel) return;
        if (!isTVPlayback()) {
            panel.classList.add('hidden');
            clearDuplicateQueueItems();
            hideNextOverlay();
            return;
        }
        const { current, next } = currentAndNext();
        if (!current) {
            panel.classList.add('hidden');
            return;
        }
        panel.classList.remove('hidden');

        const currentId = videoId(current);
        if (currentId && currentId !== lastQueueVideoId) {
            lastQueueVideoId = currentId;
            lastPosition = 0;
            lastDuration = 0;
            hideNextOverlay();
        }

        setImage(panel.querySelector('[data-tv-now-thumb]'), current);
        panel.querySelector('[data-tv-now-title]').textContent =
            document.getElementById('videoTitle')?.textContent?.trim() || titleOf(current) || 'Vídeo actual';
        panel.querySelector('[data-tv-now-channel]').textContent = channelOf(current);

        const currentDuration = lastDuration > 0 ? lastDuration : durationOf(current);
        const position = Math.min(lastPosition, currentDuration || lastPosition);
        const ratio = currentDuration > 0 ? Math.max(0, Math.min(1, position / currentDuration)) : 0;
        panel.querySelector('[data-tv-progress-bar]').style.width = `${Math.round(ratio * 1000) / 10}%`;
        panel.querySelector('[data-tv-progress-time]').textContent =
            currentDuration > 0 ? `${formatTime(position)} / ${formatTime(currentDuration)}` : formatTime(position);

        const nextButton = panel.querySelector('[data-tv-programming-next]');
        if (next) {
            nextButton.hidden = false;
            setImage(panel.querySelector('[data-tv-next-thumb]'), next);
            panel.querySelector('[data-tv-next-title]').textContent = titleOf(next) || 'Vídeo següent';
            panel.querySelector('[data-tv-next-channel]').textContent = channelOf(next);
            const duration = durationOf(next);
            panel.querySelector('[data-tv-next-duration]').textContent = duration > 0 ? formatTime(duration) : '';
        } else {
            nextButton.hidden = true;
        }
        markDuplicateQueueItems();
    }

    function clearDuplicateQueueItems() {
        document.querySelectorAll('#playlistQueueContainer .tv-programming-duplicate')
            .forEach(item => item.classList.remove('tv-programming-duplicate'));
    }

    function markDuplicateQueueItems() {
        const container = document.getElementById('playlistQueueContainer');
        if (!container || !isTVPlayback()) return;
        const items = Array.from(container.querySelectorAll('.playlist-queue-item'));
        const active = container.querySelector('.playlist-queue-item.is-active');
        let next = active?.nextElementSibling || null;
        while (next && !next.classList.contains('playlist-queue-item')) next = next.nextElementSibling;
        if (!next && active && items.length > 1) next = items[0];
        items.forEach(item => {
            const duplicated = item === active || (next && next !== active && item === next);
            item.classList.toggle('tv-programming-duplicate', Boolean(duplicated));
        });
    }

    function ensureNextOverlay() {
        const player = document.getElementById('videoPlayer');
        if (!player) return null;
        let overlay = player.querySelector('.tv-next-up-overlay');
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.className = 'tv-next-up-overlay';
        overlay.setAttribute('role', 'status');
        overlay.innerHTML = `
            <img data-tv-overlay-thumb alt="">
            <span class="tv-next-up-copy">
                <span class="tv-next-up-kicker">A CONTINUACIÓ</span>
                <strong class="tv-next-up-title" data-tv-overlay-title></strong>
                <span class="tv-next-up-channel" data-tv-overlay-channel></span>
            </span>
            <button class="tv-next-up-button" type="button" data-tv-overlay-next aria-label="Reprodueix ara el vídeo següent">→</button>
        `;
        overlay.querySelector('[data-tv-overlay-next]')?.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            advanceToNext();
        });
        player.appendChild(overlay);
        return overlay;
    }

    function hideNextOverlay() {
        document.querySelector('.tv-next-up-overlay')?.classList.remove('is-visible');
    }

    function renderNextOverlay() {
        if (!isTVPlayback() || lastDuration <= 20 || lastPosition <= 0) {
            hideNextOverlay();
            return;
        }
        const remaining = lastDuration - lastPosition;
        const { next } = currentAndNext();
        if (!next || remaining > WARNING_SECONDS || remaining < -1) {
            hideNextOverlay();
            return;
        }
        const overlay = ensureNextOverlay();
        if (!overlay) return;
        setImage(overlay.querySelector('[data-tv-overlay-thumb]'), next);
        overlay.querySelector('[data-tv-overlay-title]').textContent = titleOf(next) || 'Vídeo següent';
        overlay.querySelector('[data-tv-overlay-channel]').textContent = channelOf(next);
        overlay.classList.add('is-visible');
    }

    function advanceToNext() {
        if (!isTVPlayback()) return false;
        const queue = getQueue();
        if (queue.length < 2) return false;
        try {
            currentPlaylistIndex = (getIndex() + 1) % queue.length;
            lastPosition = 0;
            lastDuration = 0;
            hideNextOverlay();
            if (typeof loadVideoInSequence === 'function') {
                loadVideoInSequence();
                window.setTimeout(sync, 0);
                return true;
            }
        } catch {}
        return false;
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
        const position = Number(payload?.info?.currentTime);
        const duration = Number(payload?.info?.duration);
        if (Number.isFinite(position) && position >= 0) lastPosition = position;
        if (Number.isFinite(duration) && duration > 0) lastDuration = duration;
        renderPanel();
        renderNextOverlay();
    }

    function sync() {
        renderPanel();
        renderNextOverlay();
    }

    function initObservers() {
        const queue = document.getElementById('playlistQueueContainer');
        if (queue && !queueObserver) {
            queueObserver = new MutationObserver(() => window.requestAnimationFrame(markDuplicateQueueItems));
            queueObserver.observe(queue, { childList: true, subtree: true });
        }
        if (!bodyObserver && document.body) {
            bodyObserver = new MutationObserver(sync);
            bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        }
    }

    function init() {
        ensureStyles();
        ensurePanelMarkup();
        initObservers();
        window.addEventListener('message', onPlayerMessage);
        document.addEventListener('click', event => {
            if (event.target.closest('.playlist-queue-item')) window.setTimeout(sync, 0);
        }, true);
        syncTimer = window.setInterval(sync, 1000);
        sync();
    }

    app.features.tvProgramming = {
        sync,
        advanceToNext,
        renderPanel,
        renderNextOverlay,
        getQueue,
        getIndex,
        destroy() {
            window.removeEventListener('message', onPlayerMessage);
            queueObserver?.disconnect();
            bodyObserver?.disconnect();
            if (syncTimer) window.clearInterval(syncTimer);
        },
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})(window);
