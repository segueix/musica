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
    const QUEUE_NAME = 'Ràdio';
    const MIN_QUEUE_LENGTH = 12;
    const MAX_QUEUE_LENGTH = 40;
    // YouTube crea una cua temporal amb els vídeos de l'enllaç, en l'ordre indicat (màx. ~50).
    // Ha de ser www.youtube.com: music.youtube.com obre l'app però ignora `watch_videos`
    // (no importa la llista). Un cop oberta a YouTube, «Desa» la deixa a la biblioteca de YouTube Music.
    const YTM_QUEUE_URL = 'https://www.youtube.com/watch_videos?video_ids=';
    const YTM_MAX_VIDEOS = 50;

    const ICONS = {
        prev: '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M6 5h2v14H6zM20 5v14L9.5 12z"/></svg>',
        next: '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M16 5h2v14h-2zM4 5v14l10.5-7z"/></svg>',
        play: '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13l11-6.5z"/></svg>',
        pause: '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
        shuffle:
            '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
        grip: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M9 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm9-12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/></svg>',
        external:
            '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M14 4h6v6M20 4 10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
        close: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/></svg>',
    };

    // Categories que no són una "categoria" a efectes del nom de la llista (són vistes generals).
    const GENERAL_VIEWS = new Set(['novetats', 'tot', 'descobreix', 'seguint', 'radar', 'recomanat per a tu']);
    let radioCategory = '';
    // Categoria de la fila de la portada on l'usuari ha clicat una cançó (null = fora de files).
    let clickCategory = null;
    document.addEventListener(
        'click',
        event => {
            const row = event.target?.closest?.('.home-section[data-category]');
            clickCategory = row ? row.dataset.category || '' : null;
        },
        true
    );

    let sortable = null;
    let bar = null;

    function escapeText(value) {
        const div = document.createElement('div');
        div.textContent = String(value ?? '');
        return div.innerHTML;
    }

    const isEphemeral = id => id === QUEUE_ID || id === TV_ID;
    const channelOf = video => String(video?.channelId || '');
    const artistOf = video => getVideoArtistKey(video);
    // La ràdio només ha de portar cançons (fora concerts complets, pel·lícules, entrevistes...).
    const isSong = video => {
        const music = window.SegueixMusicCategories;
        return !music?.isCategoryEligibleVideo || music.isCategoryEligibleVideo(video);
    };

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
    // Categories que agrupen diverses (com la fila «Pop / Rock» de la portada).
    const COMBINED_CATEGORIES = { 'pop / rock': ['pop', 'rock'] };

    // Categoria d'estil del vídeo: les del vídeo/canal al feed (com filterVideosByCategory).
    function matchesCategory(video, category) {
        const wanted = COMBINED_CATEGORIES[category.toLowerCase()] || [category.toLowerCase()];
        try {
            if (typeof isCustomCategory === 'function' && isCustomCategory(category)) {
                return typeof matchesCustomCategory === 'function' ? matchesCustomCategory(video, category) : true;
            }
        } catch (error) {
            return true;
        }
        let own = Array.isArray(video?.categories) ? video.categories : [];
        if (!own.length) {
            const feed = (typeof getFeedDataForFilter === 'function' && getFeedDataForFilter()) || currentFeedData;
            const channel = (Array.isArray(feed?.channels) ? feed.channels : []).find(
                item => String(item?.id) === channelOf(video)
            );
            own = Array.isArray(channel?.categories) ? channel.categories : [];
        }
        return own.some(name => wanted.includes(String(name).toLowerCase()));
    }

    function buildQueue(video, category = '') {
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
                isSong(item) &&
                item.source !== 'static' &&
                !hidden.has(channelOf(item)) &&
                // Ràdio d'una categoria: només cançons d'aquella categoria
                (!category || matchesCategory(item, category))
        );

        const tv = app.features.segueixTV;
        let ordered = [];
        try {
            ordered = tv?.rank?.(candidates, { avoidChannels: new Set([channelOf(video)]) }) || [];
        } catch (error) {
            ordered = [];
        }

        // Ràdio: una sola cançó per artista (i cap del mateix artista que la que sona).
        // Si no arriba al mínim, es completa amb repeticions, però mai dues seguides.
        const seenArtists = new Set([artistOf(video)]);
        const unique = [];
        const repeated = [];
        const used = new Set([String(video.id)]);
        const byRecency = [...candidates].sort(
            (a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()
        );
        [...ordered, ...byRecency].forEach(item => {
            const id = String(item?.id || '');
            if (!id || used.has(id)) return;
            used.add(id);
            const artist = artistOf(item);
            if (artist && seenArtists.has(artist)) {
                repeated.push(item);
            } else {
                if (artist) seenArtists.add(artist);
                unique.push(item);
            }
        });

        let upcoming = unique;
        if (upcoming.length + 1 < MIN_QUEUE_LENGTH) {
            const missing = MIN_QUEUE_LENGTH - 1 - upcoming.length;
            upcoming = spreadVideosByArtist([...upcoming, ...repeated.slice(0, missing)], {
                previousArtist: artistOf(video),
            });
        }
        return [video, ...upcoming].slice(0, MAX_QUEUE_LENGTH);
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

        // Categoria de la ràdio: la de la fila de la portada on s'ha clicat (Cançó d'autor, Jazz...) o,
        // a la pàgina d'una categoria, la categoria seleccionada. A Novetats/Tot/... és una ràdio general.
        const fromRow = clickCategory;
        clickCategory = null;
        const selected = String(typeof selectedCategory === 'string' ? selectedCategory : '').trim();
        let category = fromRow !== null ? fromRow : selected;
        if (!category || GENERAL_VIEWS.has(category.toLowerCase())) category = '';

        let queue = buildQueue(video, category);
        if (category && queue.length < 2) {
            // Categoria amb massa poques cançons: ràdio general perquè la reproducció no s'aturi
            category = '';
            queue = buildQueue(video);
        }
        if (queue.length < 2) return false;
        radioCategory = category;

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
        const fresh = buildQueue(current, radioCategory).filter(item => !playedIds.has(String(item.id)));
        activePlaylistQueue = [...played, ...fresh].slice(0, MAX_QUEUE_LENGTH + played.length);
        refresh();
    }

    // Enllaç a YouTube Music amb la cua tal com és ara: des de la cançó que sona fins al final,
    // en el mateix ordre (inclou els canvis fets arrossegant). Només vídeos amb ID de YouTube.
    // Nom de la llista a YouTube: «Llista <categoria>» si la ràdio ve d'una categoria; si no,
    // «Llista <primer grup de la llista>» (el canal de la cançó que sona / primera de la cua).
    function buildListName() {
        if (activePlaylistId !== QUEUE_ID) {
            const own = String(activePlaylistName || '').trim();
            if (own) return `Llista ${own}`;
        }
        if (activePlaylistId === QUEUE_ID && radioCategory) return `Llista ${radioCategory}`;
        const first = activePlaylistQueue[Math.max(0, currentPlaylistIndex)];
        const group = String(first?.channelTitle || '').trim();
        return group ? `Llista ${group}` : 'Llista';
    }

    function buildYouTubeMusicUrl() {
        const ids = activePlaylistQueue
            .slice(Math.max(0, currentPlaylistIndex))
            .map(item => String(item?.id || ''))
            .filter(id => /^[A-Za-z0-9_-]{11}$/.test(id))
            .slice(0, YTM_MAX_VIDEOS);
        if (!ids.length) return '';
        // `title` posa nom a la llista (si YouTube l'ignora, el nom es copia al porta-retalls).
        return `${YTM_QUEUE_URL}${ids.join(',')}&title=${encodeURIComponent(buildListName())}`;
    }

    function openInYouTubeMusic() {
        const url = buildYouTubeMusicUrl();
        if (!url) return;
        // Còpia del nom: si en desar la llista YouTube la deixa sense títol, només cal enganxar-lo.
        try {
            navigator.clipboard?.writeText?.(buildListName());
        } catch (error) {
            // Sense porta-retalls: no és imprescindible
        }
        // Enllaç temporal amb target=_blank: obre pestanya nova dins del gest de l'usuari i no
        // mou l'app (window.open amb 'noopener' retorna sempre null i no permet detectar bloquejos).
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        link.remove();
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
                ${draggable ? `<button type="button" class="mq-remove" data-mq-remove="${index}" aria-label="Treu de la ràdio">${ICONS.close}</button>` : ''}
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
            <div class="mq${activePlaylistId === QUEUE_ID ? ' mq--radio' : ''}">
                <div class="mq-head">
                    <h2 class="mq-heading">Ràdio</h2>
                    <span class="mq-source">${activePlaylistId === QUEUE_ID ? `Basada en ${escapeText(current.channelTitle || 'aquesta cançó')}` : escapeText(activePlaylistName || '')}</span>
                    ${canRegenerate || activePlaylistQueue.length > 1 ? `<button type="button" class="mq-regenerate mq-open-ytm" data-mq-open-ytm title="Obre aquesta cua, en el mateix ordre, a YouTube (pots desar-la i tornar-la a trobar a YouTube Music)">${ICONS.external}<span>Obre a YouTube</span></button>` : ''}
                    ${canRegenerate ? `<button type="button" class="mq-regenerate" data-mq-regenerate title="Genera de nou la ràdio">${ICONS.shuffle}<span>Barreja</span></button>` : ''}
                </div>
                <div class="mq-section">Ara sona</div>
                ${renderItem(current, currentPlaylistIndex, { active: true, draggable: false })}
                <div class="mq-section">A continuació${upcoming.length ? ` · ${upcoming.length}` : ''}</div>
                <div class="mq-list" role="list">
                    ${upcoming.map((video, i) => renderItem(video, currentPlaylistIndex + 1 + i)).join('') || '<div class="mq-empty">No hi ha més cançons a la ràdio.</div>'}
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
            if (event.target.closest('[data-mq-open-ytm]')) {
                openInYouTubeMusic();
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

    // ---------- Media Session (controls del sistema: pantalla de bloqueig, auriculars, notificació) ----------
    function updateMediaSession() {
        if (!('mediaSession' in navigator) || typeof MediaMetadata !== 'function') return;
        const video = isPlaylistMode ? activePlaylistQueue[currentPlaylistIndex] : null;
        if (!video) return;
        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: video.title || '',
                artist: video.channelTitle || '',
                album: activePlaylistName || 'Segueix!',
                artwork: video.thumbnail ? [{ src: video.thumbnail, sizes: '480x360', type: 'image/jpeg' }] : [],
            });
            navigator.mediaSession.playbackState = isPlaying() ? 'playing' : 'paused';
        } catch (error) {
            // Navegador sense suport complet: la reproducció no en depèn
        }
    }

    function initMediaSession() {
        if (!('mediaSession' in navigator)) return;
        const set = (action, handler) => {
            try {
                navigator.mediaSession.setActionHandler(action, handler);
            } catch (error) {
                // Acció no suportada en aquest navegador
            }
        };
        set('play', () => !isPlaying() && toggleMainPlayerPlayback?.());
        set('pause', () => isPlaying() && toggleMainPlayerPlayback?.());
        set('previoustrack', () => {
            if (isPlaylistMode && currentPlaylistIndex > 0) {
                currentPlaylistIndex -= 1;
                loadVideoInSequence();
            }
        });
        set('nexttrack', () => {
            if (isPlaylistMode && currentPlaylistIndex < activePlaylistQueue.length - 1) {
                currentPlaylistIndex += 1;
                loadVideoInSequence();
            }
        });
    }

    // ---------- Barra de controls simplificada ----------
    function isPlaying() {
        return document.getElementById('videoPlayer')?.dataset?.playerState === '1';
    }

    function updateTransport() {
        updateMediaSession();
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
        initMediaSession();
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

    app.features.musicQueue = {
        startFrom,
        render,
        regenerate,
        buildQueue,
        buildYouTubeMusicUrl,
        buildListName,
        updateTransport,
        QUEUE_ID,
    };
})(window);
