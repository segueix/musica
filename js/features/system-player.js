// Controls del sistema i finestra flotant del sistema (implementació directa, patró 2).
//
// 1) Media Session: pantalla de bloqueig, notificació d'Android, tecles multimèdia, auriculars i Chromebook. Diu quina
//    cançó sona (títol, artista, ràdio i caràtula), la posició dins la cançó i quines accions hi ha: play, pausa, atura,
//    anterior i següent (només si n'hi ha a la cua), endavant/enrere 10 s i saltar a un punt.
// 2) Finestra flotant del sistema (Document Picture-in-Picture: Chrome i Edge d'escriptori i Chromebook): mostra
//    caràtula, cançó, barra de temps i controls mentre la pàgina de Segueix Música és visible. El reproductor de
//    YouTube es queda a la pestanya. Si la pestanya queda amagada o Chrome es minimitza, app.js pausa YouTube i tanca
//    aquesta finestra; aquest mòdul tampoc permet reprendre ni saltar cançons des de Media Session en segon pla.
//
// No depèn d'app.js en carregar-se: les funcions globals (playMainPlayer, advanceQueueFromOverlay…) només es fan servir
// en temps d'execució.
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;

    const SEEK_STEP = 10;
    const PIP_SIZE = { width: 360, height: 520 };

    // Globals d'app.js (let/const de nivell superior): es llegeixen en temps d'execució, mai en carregar-se el mòdul
    const g = {
        queue: () => (typeof activePlaylistQueue !== 'undefined' ? activePlaylistQueue : null),
        index: () => (typeof currentPlaylistIndex !== 'undefined' ? currentPlaylistIndex : -1),
        playlistMode: () => (typeof isPlaylistMode !== 'undefined' ? Boolean(isPlaylistMode) : false),
        playlistName: () => (typeof activePlaylistName !== 'undefined' ? activePlaylistName : ''),
        currentId: () => (typeof currentVideoId !== 'undefined' ? currentVideoId : ''),
        time: () => (typeof lastKnownPlayerTime !== 'undefined' ? lastKnownPlayerTime : 0),
        setTime: value => {
            if (typeof lastKnownPlayerTime !== 'undefined') lastKnownPlayerTime = value;
        },
        lists: () => [
            typeof YouTubeAPI !== 'undefined' ? YouTubeAPI?.feedVideos : null,
            typeof cachedAPIVideos !== 'undefined' ? cachedAPIVideos : null,
            typeof currentFeedVideos !== 'undefined' ? currentFeedVideos : null,
        ],
    };
    const call = (fn, ...args) => (typeof fn === 'function' ? fn(...args) : undefined);
    const fns = {
        play: () => (typeof playMainPlayer === 'function' ? playMainPlayer : null),
        pause: () => (typeof pauseMainPlayer === 'function' ? pauseMainPlayer : null),
        next: () => (typeof advanceQueueFromOverlay === 'function' ? advanceQueueFromOverlay : null),
        previous: () => (typeof goToPreviousFromOverlay === 'function' ? goToPreviousFromOverlay : null),
        hasNext: () => (typeof hasQueueNextVideo === 'function' ? hasQueueNextVideo : null),
        hasPrevious: () => (typeof hasQueuePrevVideo === 'function' ? hasQueuePrevVideo : null),
        miniActive: () => (typeof isMiniPlayerActive === 'function' ? isMiniPlayerActive : null),
    };

    // ---------- Què sona ----------

    function playerElement() {
        return window.document?.getElementById?.('videoPlayer') || null;
    }

    function playerState() {
        return String(playerElement()?.dataset?.playerState ?? '');
    }

    function isPlaying() {
        const state = playerState();
        return state === '1' || state === '3';
    }

    function findVideo(id) {
        if (!id) return null;
        for (const list of g.lists()) {
            const found = Array.isArray(list) ? list.find(video => String(video?.id) === id) : null;
            if (found) return found;
        }
        return null;
    }

    function nowPlaying() {
        const queue = g.queue();
        const index = g.index();
        if (g.playlistMode() && Array.isArray(queue) && queue[index]) return queue[index];
        const id = String(playerElement()?.dataset?.playingVideoId || g.currentId() || '');
        return findVideo(id);
    }

    function nextUp() {
        const queue = g.queue();
        const index = g.index();
        if (!g.playlistMode() || !Array.isArray(queue)) return null;
        return queue[index + 1] || null;
    }

    function queueName() {
        if (!g.playlistMode()) return '';
        // El nom de la ràdio («La teva ràdio», «Ràdio Pop»…) o el de la llista que sona
        let name = '';
        try {
            const queue = app.features.musicQueue;
            if (queue?.getState?.().isRadio) name = queue.playlistName?.() || '';
        } catch (error) {
            name = '';
        }
        return String(name || g.playlistName() || '');
    }

    function hasNext() {
        return Boolean(call(fns.hasNext()));
    }

    function hasPrevious() {
        return Boolean(call(fns.hasPrevious()));
    }

    function position() {
        return Math.max(0, Number(g.time()) || 0);
    }

    function durationOf(video) {
        return Math.max(0, Number(video?.durationSeconds) || 0);
    }

    function artworkOf(video) {
        const id = String(video?.id || '');
        if (!id) return [];
        const list = [
            {
                src: `https://i.ytimg.com/vi/${encodeURIComponent(id)}/mqdefault.jpg`,
                sizes: '320x180',
                type: 'image/jpeg',
            },
            {
                src: `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`,
                sizes: '480x360',
                type: 'image/jpeg',
            },
        ];
        if (video.thumbnail && !list.some(item => item.src === video.thumbnail)) {
            list.push({ src: video.thumbnail, sizes: '1280x720', type: 'image/jpeg' });
        }
        return list;
    }

    function formatTime(seconds) {
        const total = Math.max(0, Math.floor(Number(seconds) || 0));
        const minutes = Math.floor(total / 60);
        return `${minutes}:${String(total % 60).padStart(2, '0')}`;
    }

    // ---------- Accions ----------

    function sendCommand(func, args = []) {
        const iframe = playerElement()?.querySelector?.('iframe');
        if (!iframe?.contentWindow) return false;
        iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
        return true;
    }

    function canControlPlayback() {
        return window.document?.visibilityState !== 'hidden';
    }

    const actions = {
        play: () => (canControlPlayback() ? (fns.play() ? fns.play()() : sendCommand('playVideo')) : false),
        pause: () => (fns.pause() ? fns.pause()() : sendCommand('pauseVideo')),
        toggle: () => (isPlaying() ? actions.pause() : actions.play()),
        next: () => (canControlPlayback() && hasNext() ? call(fns.next()) : undefined),
        previous: () => (canControlPlayback() && hasPrevious() ? call(fns.previous()) : undefined),
        seekTo: seconds => {
            const duration = durationOf(nowPlaying());
            const target = Math.max(0, duration ? Math.min(seconds, duration - 1) : seconds);
            sendCommand('seekTo', [target, true]);
            // Que la barra i la Media Session no esperin el proper avís de l'iframe
            g.setTime(target);
            scheduleUpdate();
        },
        seekBy: delta => actions.seekTo(position() + delta),
        preference: direction => {
            const video = nowPlaying();
            if (video) app.features.musicQueue?.applyPreference?.(video, direction);
            scheduleUpdate();
        },
    };

    // ---------- Media Session ----------

    function setHandler(action, handler) {
        try {
            window.navigator.mediaSession.setActionHandler(action, handler);
        } catch (error) {
            // Acció no suportada en aquest navegador
        }
    }

    function initMediaSession() {
        if (!('mediaSession' in (window.navigator || {}))) return;
        // Ordres explícites: la pantalla de bloqueig diu què vol, no depenen de l'estat que l'iframe hagi reportat
        setHandler('play', () => actions.play());
        setHandler('pause', () => actions.pause());
        setHandler('stop', () => actions.pause());
        setHandler('seekbackward', details => actions.seekBy(-(details?.seekOffset || SEEK_STEP)));
        setHandler('seekforward', details => actions.seekBy(details?.seekOffset || SEEK_STEP));
        setHandler('seekto', details => {
            if (Number.isFinite(details?.seekTime)) actions.seekTo(details.seekTime);
        });
    }

    let lastMetadataKey = '';

    function updateMediaSession() {
        const navigator = window.navigator;
        if (!('mediaSession' in (navigator || {}))) return;
        const video = nowPlaying();
        try {
            if (!video) {
                navigator.mediaSession.playbackState = 'none';
                return;
            }
            const album = queueName() || 'Segueix Música';
            const key = `${video.id}|${video.title}|${video.channelTitle}|${album}`;
            if (key !== lastMetadataKey && typeof window.MediaMetadata === 'function') {
                navigator.mediaSession.metadata = new window.MediaMetadata({
                    title: video.title || '',
                    artist: video.channelTitle || '',
                    album,
                    artwork: artworkOf(video),
                });
                lastMetadataKey = key;
            }
            navigator.mediaSession.playbackState = isPlaying() ? 'playing' : 'paused';
            // Anterior i següent només quan n'hi ha: sense gestor, el sistema amaga el botó
            setHandler('previoustrack', hasPrevious() ? () => actions.previous() : null);
            setHandler('nexttrack', hasNext() ? () => actions.next() : null);
            const duration = durationOf(video);
            if (duration && typeof navigator.mediaSession.setPositionState === 'function') {
                navigator.mediaSession.setPositionState({
                    duration,
                    playbackRate: 1,
                    position: Math.min(position(), duration),
                });
            }
        } catch (error) {
            // Navegador sense suport complet: la reproducció no en depèn
        }
    }

    // ---------- Finestra flotant del sistema ----------

    let pipWindow = null;
    let pipTimer = 0;

    function isPipSupported() {
        return Boolean(window.documentPictureInPicture?.requestWindow) && window.isSecureContext !== false;
    }

    function isPipOpen() {
        return Boolean(pipWindow && !pipWindow.closed);
    }

    const ICONS = {
        prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 5h2v14H6zM20 5v14L9.5 12z"/></svg>',
        next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16 5h2v14h-2zM4 5v14l10.5-7z"/></svg>',
        play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
        pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
        plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>',
        minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M5 12h14"/></svg>',
    };

    const PIP_CSS = `
        :root { color-scheme: dark; --bg: #141615; --surface: #202421; --surface-2: #2a2f2b; --text: #f4f0e8;
            --muted: #b9b5ac; --accent: #d6ed84; --on-accent: #141615; --line: rgba(244, 240, 232, 0.14); }
        * { box-sizing: border-box; }
        html, body { margin: 0; height: 100%; background: var(--bg); color: var(--text);
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
        .sp { display: flex; flex-direction: column; gap: 12px; height: 100%; max-width: 520px; margin: 0 auto;
            padding: 16px; }
        .sp-cover { width: 100%; max-height: 34vh; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 14px;
            background: var(--surface); }
        .sp-label { margin: 0; color: var(--accent); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em;
            text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sp-title { margin: 2px 0 0; font-family: Fraunces, Georgia, serif; font-size: 1.25rem; line-height: 1.2;
            display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
        .sp-artist { margin: 4px 0 0; color: var(--muted); font-weight: 600; }
        .sp-progress { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center;
            color: var(--muted); font-size: 0.75rem; font-variant-numeric: tabular-nums; }
        .sp-bar { position: relative; height: 6px; border-radius: 999px; background: var(--surface-2); cursor: pointer; }
        .sp-bar i { position: absolute; inset: 0 auto 0 0; width: 0; border-radius: 999px; background: var(--accent); }
        .sp-controls { display: flex; justify-content: center; align-items: center; gap: 14px; }
        button { font: inherit; color: inherit; cursor: pointer; }
        .sp-btn { display: inline-grid; place-items: center; width: 48px; height: 48px; padding: 0;
            border: 1px solid var(--line); border-radius: 50%; background: var(--surface-2); color: var(--text); }
        .sp-btn svg { width: 22px; height: 22px; }
        .sp-btn:hover:not(:disabled), .sp-btn:focus-visible { border-color: var(--accent); color: var(--accent); }
        .sp-btn:disabled { opacity: 0.35; cursor: default; }
        .sp-btn--main { width: 64px; height: 64px; border-color: var(--accent); background: var(--accent);
            color: var(--on-accent); }
        .sp-btn--main:hover, .sp-btn--main:focus-visible { color: var(--on-accent); background: #e4f59d; }
        .sp-btn--main svg { width: 28px; height: 28px; }
        .sp-prefs { display: flex; justify-content: center; align-items: center; gap: 10px; color: var(--muted);
            font-size: 0.8125rem; }
        .sp-prefs .sp-btn { width: 40px; height: 40px; }
        .sp-prefs .sp-btn[aria-pressed='true'] { border-color: var(--accent); background: rgba(214, 237, 132, 0.14);
            color: var(--accent); }
        .sp-next { margin: auto 0 0; padding-top: 10px; border-top: 1px solid var(--line); color: var(--muted);
            font-size: 0.8125rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sp-next b { color: var(--text); }
        .sp-empty { margin: auto; color: var(--muted); text-align: center; }
        :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    `;

    const PIP_HTML = `
        <main class="sp" aria-label="Segueix Música">
            <img class="sp-cover" alt="" data-sp="cover">
            <div>
                <p class="sp-label" data-sp="label"></p>
                <h1 class="sp-title" data-sp="title"></h1>
                <p class="sp-artist" data-sp="artist"></p>
            </div>
            <div class="sp-progress">
                <span data-sp="time">0:00</span>
                <div class="sp-bar" data-sp="bar" role="slider" tabindex="0" aria-label="Posició de la cançó" aria-valuemin="0">
                    <i data-sp="fill"></i>
                </div>
                <span data-sp="duration">0:00</span>
            </div>
            <div class="sp-controls" role="group" aria-label="Controls">
                <button class="sp-btn" type="button" data-sp-action="previous" aria-label="Cançó anterior" title="Cançó anterior">${ICONS.prev}</button>
                <button class="sp-btn sp-btn--main" type="button" data-sp-action="toggle" aria-label="Reprodueix" title="Reprodueix">${ICONS.play}</button>
                <button class="sp-btn" type="button" data-sp-action="next" aria-label="Cançó següent" title="Cançó següent">${ICONS.next}</button>
            </div>
            <div class="sp-prefs" role="group" aria-label="Com aquesta cançó" data-sp="prefs">
                <button class="sp-btn" type="button" data-sp-action="less" aria-pressed="false" aria-label="Menys com aquesta" title="Menys com aquesta">${ICONS.minus}</button>
                <span>com aquesta</span>
                <button class="sp-btn" type="button" data-sp-action="more" aria-pressed="false" aria-label="Més com aquesta" title="Més com aquesta">${ICONS.plus}</button>
            </div>
            <p class="sp-next" data-sp="next"></p>
        </main>
    `;

    function renderPip() {
        if (!isPipOpen()) return;
        const doc = pipWindow.document;
        const el = name => doc.querySelector(`[data-sp="${name}"]`);
        const video = nowPlaying();
        const playing = isPlaying();
        const duration = durationOf(video);
        const time = Math.min(position(), duration || Infinity);
        const label = queueName();
        el('label').textContent = label || 'Ara sona';
        el('title').textContent = video?.title || 'No sona res';
        el('artist').textContent = video?.channelTitle || '';
        const cover = artworkOf(video)[1]?.src || '';
        if (el('cover').getAttribute('src') !== cover) {
            if (cover) el('cover').setAttribute('src', cover);
            else el('cover').removeAttribute('src');
        }
        el('time').textContent = formatTime(time);
        el('duration').textContent = duration ? formatTime(duration) : '–:––';
        el('fill').style.width = duration ? `${Math.min(100, (time / duration) * 100)}%` : '0%';
        el('bar').setAttribute('aria-valuemax', String(Math.round(duration)));
        el('bar').setAttribute('aria-valuenow', String(Math.round(time)));
        el('bar').setAttribute('aria-valuetext', `${formatTime(time)} de ${formatTime(duration)}`);
        const toggle = doc.querySelector('[data-sp-action="toggle"]');
        toggle.innerHTML = playing ? ICONS.pause : ICONS.play;
        toggle.setAttribute('aria-label', playing ? 'Pausa' : 'Reprodueix');
        toggle.title = playing ? 'Pausa' : 'Reprodueix';
        doc.querySelector('[data-sp-action="previous"]').disabled = !hasPrevious();
        doc.querySelector('[data-sp-action="next"]').disabled = !hasNext();
        const queue = app.features.musicQueue;
        const preference = video && queue?.getPreference ? queue.getPreference(video) : '';
        el('prefs').hidden = !video || !queue?.applyPreference;
        doc.querySelector('[data-sp-action="more"]').setAttribute('aria-pressed', String(preference === 'more'));
        doc.querySelector('[data-sp-action="less"]').setAttribute('aria-pressed', String(preference === 'less'));
        const upcoming = nextUp();
        el('next').hidden = !upcoming;
        el('next').innerHTML = upcoming
            ? `A continuació: <b></b>${upcoming.channelTitle ? ' · <span></span>' : ''}`
            : '';
        if (upcoming) {
            el('next').querySelector('b').textContent = upcoming.title || '';
            const artist = el('next').querySelector('span');
            if (artist) artist.textContent = upcoming.channelTitle;
        }
        doc.title = video ? `${video.title} · ${video.channelTitle || 'Segueix Música'}` : 'Segueix Música';
    }

    function onPipClick(event) {
        const button = event.target.closest?.('[data-sp-action]');
        if (button && !button.disabled) {
            const action = button.dataset.spAction;
            if (action === 'more' || action === 'less') actions.preference(action);
            else actions[action]?.();
            scheduleUpdate();
            return;
        }
        const bar = event.target.closest?.('[data-sp="bar"]');
        if (bar) {
            const duration = durationOf(nowPlaying());
            const rect = bar.getBoundingClientRect();
            if (duration && rect.width) actions.seekTo(((event.clientX - rect.left) / rect.width) * duration);
        }
    }

    function onPipKey(event) {
        if (event.target.closest?.('button')) return;
        if (event.key === ' ' || event.key === 'k') {
            event.preventDefault();
            actions.toggle();
        } else if (event.key === 'ArrowRight') {
            actions.seekBy(SEEK_STEP);
        } else if (event.key === 'ArrowLeft') {
            actions.seekBy(-SEEK_STEP);
        }
        scheduleUpdate();
    }

    async function openPip() {
        if (!isPipSupported() || !canControlPlayback()) return false;
        if (isPipOpen()) {
            pipWindow.focus?.();
            return true;
        }
        if (!nowPlaying()) {
            app.features.shellNav?.toast?.('Posa una cançó o una ràdio per obrir la finestra flotant.');
            return false;
        }
        try {
            pipWindow = await window.documentPictureInPicture.requestWindow(PIP_SIZE);
        } catch (error) {
            pipWindow = null;
            return false;
        }
        const doc = pipWindow.document;
        const style = doc.createElement('style');
        style.textContent = PIP_CSS;
        doc.head.appendChild(style);
        doc.documentElement.lang = 'ca';
        doc.body.innerHTML = PIP_HTML;
        doc.addEventListener('click', onPipClick);
        doc.addEventListener('keydown', onPipKey);
        pipWindow.addEventListener('pagehide', () => {
            window.clearInterval(pipTimer);
            pipTimer = 0;
            pipWindow = null;
            window.document?.body?.classList.remove('is-system-pip');
        });
        window.document?.body?.classList.add('is-system-pip');
        renderPip();
        // La barra de temps avança cada segon (la posició ve dels avisos del reproductor)
        pipTimer = window.setInterval(renderPip, 1000);
        return true;
    }

    function closePip() {
        if (isPipOpen()) pipWindow.close();
    }

    // El botó «Finestra flotant» de la barra de controls de sota el reproductor (#playerMiniBtn; el de la fila de sota el
    // títol, #miniPlayerToggle, s'ha tret perquè era repetit) obre la finestra del sistema on n'hi ha; si la finestra
    // flotant de dins la pàgina ja és oberta, el botó la torna a lloc («restaura») com sempre.
    function onDocumentClick(event) {
        const trigger = event.target.closest?.('#playerMiniBtn, .queue-mini-button');
        if (!trigger || !isPipSupported() || call(fns.miniActive())) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        openPip();
    }

    // ---------- Actualitzacions ----------

    let updateFrame = 0;
    let lastPositionUpdate = 0;

    function update() {
        updateFrame = 0;
        updateMediaSession();
        renderPip();
    }

    function scheduleUpdate() {
        if (updateFrame) return;
        updateFrame = window.requestAnimationFrame
            ? window.requestAnimationFrame(update)
            : window.setTimeout(update, 16);
    }

    // Avisos del reproductor: la posició arriba sovint (infoDelivery); la Media Session només cal posar-la al dia de
    // tant en tant (el sistema fa avançar la barra sol).
    function onPlayerMessage(event) {
        if (!/youtube(-nocookie)?\.com/.test(String(event.origin || ''))) return;
        const now = Date.now();
        if (now - lastPositionUpdate < 5000) return;
        lastPositionUpdate = now;
        updateMediaSession();
    }

    function init() {
        initMediaSession();
        const player = playerElement();
        if (player && typeof window.MutationObserver === 'function') {
            new window.MutationObserver(scheduleUpdate).observe(player, {
                attributes: true,
                attributeFilter: ['data-player-state', 'data-playing-video-id'],
            });
        }
        window.addEventListener('message', onPlayerMessage);
        window.document.addEventListener('click', onDocumentClick, true);
        window.addEventListener('pagehide', closePip);
        scheduleUpdate();
    }

    if (window.document?.readyState === 'loading') {
        window.document.addEventListener('DOMContentLoaded', init);
    } else if (window.document) {
        init();
    }

    app.features.systemPlayer = {
        update: scheduleUpdate,
        updateMediaSession,
        isPipSupported,
        isPipOpen,
        openPip,
        closePip,
        actions,
        nowPlaying,
        formatTime,
        artworkOf,
    };
})(window);
