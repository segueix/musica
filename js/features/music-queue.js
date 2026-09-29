// Cua de reproducció estil Spotify / YouTube Music.
// - En obrir una cançó des del feed es crea una cua amb l'ordenació de Música TV.
// - La cua (també la de llistes i la de TV) es mostra amb "Ara sona" + "A continuació"
//   i es pot reordenar arrossegant (Sortable.js: ratolí i tàctil).
// - Barra de controls simplificada (anterior / play-pausa / següent) sota el reproductor.
// Implementació directa: es recolza en l'estat de cua d'app.js (activePlaylistQueue...).
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;

    const QUEUE_ID = '__music_queue__';
    const TV_ID = '__segueix_tv_discovery__';
    const QUEUE_NAME = 'Cua';
    const MIN_QUEUE_LENGTH = 12;
    const MAX_QUEUE_LENGTH = 40;

    const ICONS = {
        prev: '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M6 5h2v14H6zM20 5v14L9.5 12z"/></svg>',
        next: '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M16 5h2v14h-2zM4 5v14l10.5-7z"/></svg>',
        play: '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13l11-6.5z"/></svg>',
        pause: '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
        shuffle:
            '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
        grip: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M9 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm9-12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/></svg>',
        close: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/></svg>',
    };

    let sortable = null;
    let bar = null;

    function escapeText(value) {
        const div = document.createElement('div');
        div.textContent = String(value ?? '');
        return div.innerHTML;
    }

    const isEphemeral = id => id === QUEUE_ID || id === TV_ID;
    const channelOf = video => String(video?.channelId || '');

    function findVideo(videoId) {
        const id = String(videoId);
        const pools = [window.currentFeedVideos, window.cachedAPIVideos];
        try {
            pools.unshift(currentFeedVideos, cachedAPIVideos);
        } catch (error) {
            // Globals d'app.js encara no disponibles
        }
        for (const pool of pools) {
            const found = (Array.isArray(pool) ? pool : []).find(video => String(video?.id) === id);
            if (found) return found;
        }
        return null;
    }

    // Cua = vídeo inicial + ordenació de Música TV; si TV en dona pocs (només descobreix
    // canals no seguits, un vídeo per canal) s'ompl amb els vídeos més recents restants.
    function buildQueue(video) {
        let pool = Array.isArray(currentFeedVideos) ? currentFeedVideos : [];
        try {
            if (typeof filterOutWatchedVideos === 'function') pool = filterOutWatchedVideos(pool) || pool;
        } catch (error) {
            // Sense historial: seguim amb el feed sencer
        }
        const hidden = new Set(
            (typeof getHiddenChannelIds === 'function' ? getHiddenChannelIds() : []).map(id => String(id))
        );
        const candidates = pool.filter(
            item =>
                item?.id &&
                String(item.id) !== String(video.id) &&
                !item.isShort &&
                item.source !== 'static' &&
                !hidden.has(channelOf(item))
        );

        const tv = app.features.segueixTV;
        let ordered = [];
        try {
            ordered = tv?.rank?.(candidates, { avoidChannels: new Set([channelOf(video)]) }) || [];
        } catch (error) {
            ordered = [];
        }

        const queue = [video, ...ordered];
        if (queue.length < MIN_QUEUE_LENGTH) {
            const used = new Set(queue.map(item => String(item.id)));
            const usedChannels = new Set(queue.map(channelOf));
            const rest = candidates
                .filter(item => !used.has(String(item.id)))
                .sort(
                    (a, b) =>
                        new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()
                );
            // Primer canals nous, després la resta.
            const fresh = rest.filter(item => !usedChannels.has(channelOf(item)));
            const others = rest.filter(item => usedChannels.has(channelOf(item)));
            [...fresh, ...others].forEach(item => {
                if (queue.length < MIN_QUEUE_LENGTH) queue.push(item);
            });
        }
        return queue.slice(0, MAX_QUEUE_LENGTH);
    }

    // Retorna true si ha engegat la reproducció amb cua (si no, l'app segueix el camí normal).
    function startFrom(videoId, source) {
        if (source === 'static' || document.body.classList.contains('segueix-tv-active')) return false;
        if (typeof loadVideoInSequence !== 'function') return false;

        if (isPlaylistMode && activePlaylistId === QUEUE_ID) {
            const index = activePlaylistQueue.findIndex(item => String(item?.id) === String(videoId));
            if (index >= 0) {
                currentPlaylistIndex = index;
                clearEmbeddedYouTubeSession();
                loadVideoInSequence();
                return true;
            }
        }
        if (isPlaylistMode && activePlaylistId && !isEphemeral(activePlaylistId)) return false;

        const video = findVideo(videoId);
        if (!video || video.isShort) return false;

        const queue = buildQueue(video);
        if (queue.length < 2) return false;

        clearEmbeddedYouTubeSession();
        isPlaylistMode = true;
        activePlaylistId = QUEUE_ID;
        activePlaylistName = QUEUE_NAME;
        activePlaylistQueue = queue;
        currentPlaylistIndex = 0;
        loadVideoInSequence();
        return true;
    }

    // Torna a generar la part pendent de la cua amb l'ordenació de TV (manté el que sona).
    function regenerate() {
        if (!isPlaylistMode || activePlaylistId !== QUEUE_ID) return;
        const current = activePlaylistQueue[currentPlaylistIndex];
        if (!current) return;
        const played = activePlaylistQueue.slice(0, currentPlaylistIndex + 1);
        const playedIds = new Set(played.map(item => String(item.id)));
        const fresh = buildQueue(current).filter(item => !playedIds.has(String(item.id)));
        activePlaylistQueue = [...played, ...fresh].slice(0, MAX_QUEUE_LENGTH + played.length);
        refresh();
    }

    function refresh() {
        updatePlaylistModeBadge?.();
        syncQueueNextOverlay?.();
        renderPlaylistQueue();
    }

    function moveNext(from, to) {
        if (from === to) return;
        if (isEphemeral(activePlaylistId)) {
            const list = [...activePlaylistQueue];
            const [moved] = list.splice(from, 1);
            list.splice(to, 0, moved);
            activePlaylistQueue = list;
            refresh();
        } else if (typeof reorderPlaylistVideos === 'function') {
            reorderPlaylistVideos(activePlaylistId, from, to);
        }
    }

    function removeAt(index) {
        const video = activePlaylistQueue[index];
        if (!video || index <= currentPlaylistIndex) return;
        if (isEphemeral(activePlaylistId)) {
            activePlaylistQueue = activePlaylistQueue.filter((_, i) => i !== index);
            refresh();
        } else if (typeof removeVideoFromPlaylist === 'function') {
            removeVideoFromPlaylist(activePlaylistId, video.id);
        }
    }

    function renderItem(video, index, { active = false, draggable = true } = {}) {
        const duration = typeof getVideoDisplayDuration === 'function' ? getVideoDisplayDuration(video) : '';
        return `
            <div class="mq-item${active ? ' is-active' : ''}" data-index="${index}" role="listitem">
                ${draggable ? `<span class="mq-handle" aria-hidden="true" title="Arrossega per reordenar">${ICONS.grip}</span>` : '<span class="mq-handle mq-handle--placeholder" aria-hidden="true"></span>'}
                <button type="button" class="mq-play" data-mq-play="${index}" aria-label="Reprodueix ${escapeText(video.title)}">
                    <span class="mq-cover">
                        <img src="${escapeText(video.thumbnail || 'img/icon-192.png')}" alt="" loading="lazy" decoding="async">
                        ${active ? '<span class="mq-eq" aria-hidden="true"><i></i><i></i><i></i></span>' : ''}
                    </span>
                    <span class="mq-text">
                        <span class="mq-title">${escapeText(video.title)}</span>
                        <span class="mq-artist">${escapeText(video.channelTitle || '')}</span>
                    </span>
                    <span class="mq-duration">${escapeText(duration || '')}</span>
                </button>
                ${draggable ? `<button type="button" class="mq-remove" data-mq-remove="${index}" aria-label="Treu de la cua">${ICONS.close}</button>` : ''}
            </div>
        `;
    }

    // Retorna true si s'ha encarregat de pintar la cua.
    function render(container) {
        // La TV té la seva pròpia programació adaptativa (tv-live-queue / tv-programming).
        if (!container || !isPlaylistMode || !activePlaylistQueue.length || activePlaylistId === TV_ID) return false;
        const current = activePlaylistQueue[currentPlaylistIndex];
        if (!current) return false;

        const upcoming = activePlaylistQueue.slice(currentPlaylistIndex + 1);
        const canRegenerate = activePlaylistId === QUEUE_ID;

        container.innerHTML = `
            <div class="mq">
                <div class="mq-head">
                    <h2 class="mq-heading">Cua</h2>
                    <span class="mq-source">${activePlaylistId === QUEUE_ID ? 'Segons Música TV' : escapeText(activePlaylistName || '')}</span>
                    ${canRegenerate ? `<button type="button" class="mq-regenerate" data-mq-regenerate title="Genera de nou la cua amb l'ordenació de Música TV">${ICONS.shuffle}<span>Barreja</span></button>` : ''}
                </div>
                <div class="mq-section">Ara sona</div>
                ${renderItem(current, currentPlaylistIndex, { active: true, draggable: false })}
                <div class="mq-section">A continuació${upcoming.length ? ` · ${upcoming.length}` : ''}</div>
                <div class="mq-list" role="list">
                    ${upcoming.map((video, i) => renderItem(video, currentPlaylistIndex + 1 + i)).join('') || '<div class="mq-empty">No hi ha més cançons a la cua.</div>'}
                </div>
            </div>
        `;
        bindContainer(container);
        setupSortable(container);
        updateTransport();
        return true;
    }

    function bindContainer(container) {
        if (container._mqBound) return;
        container._mqBound = true;
        container.addEventListener('click', event => {
            const remove = event.target.closest('[data-mq-remove]');
            if (remove) {
                event.stopPropagation();
                removeAt(Number(remove.dataset.mqRemove));
                return;
            }
            if (event.target.closest('[data-mq-regenerate]')) {
                regenerate();
                return;
            }
            const play = event.target.closest('[data-mq-play]');
            if (play) {
                const index = Number(play.dataset.mqPlay);
                if (index !== currentPlaylistIndex && typeof playVideoFromPlaylistIndex === 'function') {
                    playVideoFromPlaylistIndex(index);
                }
            }
        });
    }

    function setupSortable(container) {
        if (sortable) {
            sortable.destroy();
            sortable = null;
        }
        const list = container.querySelector('.mq-list');
        if (!list || typeof window.Sortable !== 'function') return;
        sortable = window.Sortable.create(list, {
            animation: 150,
            handle: '.mq-handle',
            draggable: '.mq-item',
            ghostClass: 'is-ghost',
            chosenClass: 'is-chosen',
            forceFallback: false,
            delay: 120,
            delayOnTouchOnly: true,
            touchStartThreshold: 4,
            onEnd(evt) {
                if (evt.oldIndex == null || evt.newIndex == null || evt.oldIndex === evt.newIndex) return;
                const offset = currentPlaylistIndex + 1;
                // Repintar després que Sortable acabi de tocar el DOM.
                setTimeout(() => moveNext(offset + evt.oldIndex, offset + evt.newIndex), 0);
            },
        });
    }

    // ---------- Barra de controls simplificada ----------
    function isPlaying() {
        return document.getElementById('videoPlayer')?.dataset?.playerState === '1';
    }

    function updateTransport() {
        if (!bar) return;
        const inQueue = isPlaylistMode && activePlaylistQueue.length > 0;
        const prev = bar.querySelector('[data-np="prev"]');
        const next = bar.querySelector('[data-np="next"]');
        const toggle = bar.querySelector('[data-np="toggle"]');
        prev.disabled = !inQueue || currentPlaylistIndex <= 0;
        next.disabled = !inQueue || currentPlaylistIndex >= activePlaylistQueue.length - 1;
        toggle.innerHTML = isPlaying() ? ICONS.pause : ICONS.play;
        toggle.setAttribute('aria-label', isPlaying() ? 'Pausa' : 'Reprodueix');
    }

    function onTransportClick(event) {
        const button = event.target.closest('[data-np]');
        if (!button || button.disabled) return;
        const action = button.dataset.np;
        if (action === 'toggle') {
            toggleMainPlayerPlayback?.();
        } else if (action === 'prev' && currentPlaylistIndex > 0) {
            currentPlaylistIndex -= 1;
            loadVideoInSequence();
        } else if (action === 'next' && currentPlaylistIndex < activePlaylistQueue.length - 1) {
            currentPlaylistIndex += 1;
            loadVideoInSequence();
        }
        setTimeout(updateTransport, 250);
    }

    function initTransport() {
        const info = document.querySelector('#watchPage .video-info');
        if (!info || document.getElementById('nowPlayingBar')) return;
        bar = document.createElement('div');
        bar.id = 'nowPlayingBar';
        bar.className = 'now-playing-bar';
        bar.setAttribute('role', 'group');
        bar.setAttribute('aria-label', 'Controls de reproducció');
        bar.innerHTML = `
            <button type="button" class="np-btn" data-np="prev" aria-label="Anterior">${ICONS.prev}</button>
            <button type="button" class="np-btn np-btn--main" data-np="toggle" aria-label="Reprodueix">${ICONS.play}</button>
            <button type="button" class="np-btn" data-np="next" aria-label="Següent">${ICONS.next}</button>
        `;
        info.after(bar);
        bar.addEventListener('click', onTransportClick);

        const player = document.getElementById('videoPlayer');
        if (player && typeof MutationObserver === 'function') {
            new MutationObserver(updateTransport).observe(player, {
                attributes: true,
                attributeFilter: ['data-player-state'],
            });
        }
        updateTransport();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTransport);
    } else {
        initTransport();
    }

    app.features.musicQueue = { startFrom, render, regenerate, buildQueue, updateTransport, QUEUE_ID };
})(window);
