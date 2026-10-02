// Mode conducció (mòbil): mode d'ultraestalvi amb fons negre, reproductor de YouTube de 200×200 i Wake Lock.
// Els controls externs són grans però de contrast baix i només es mostren uns segons: desapareixen sols i
// reapareixen tocant la zona negra. El reproductor no es tapa ni es mou de lloc al DOM (YouTube el recarregaria).
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;
    const document = window.document;

    const EXIT_ID = 'driveModeExit';
    const CONTROLS_ID = 'driveModeControls';
    const UI_HIDE_DELAY = 3500;
    const RECOVERY_DELAY = 2500;
    const RECENT_INTERACTION_MS = 5000;
    let active = false;
    let wakeLock = null;
    let uiHideTimer = null;
    let recoveryTimer = null;
    let recoveryVideoId = '';
    let recoveryAttempted = false;
    let hasPlayedCurrentVideo = false;
    let lastPlayerState = null;
    let pausedAfterBuffering = false;
    let lastInteractionAt = 0;

    async function requestWakeLock() {
        if (!active || !window.navigator?.wakeLock?.request) return;
        try {
            wakeLock = await window.navigator.wakeLock.request('screen');
            wakeLock.addEventListener?.('release', () => {
                wakeLock = null;
            });
        } catch (_) {
            wakeLock = null;
        }
    }

    function releaseWakeLock() {
        const lock = wakeLock;
        wakeLock = null;
        try {
            lock?.release?.();
        } catch (_) {
            // ja alliberat
        }
    }

    function clearUiHideTimer() {
        if (uiHideTimer !== null) {
            window.clearTimeout(uiHideTimer);
            uiHideTimer = null;
        }
    }

    function clearRecoveryTimer() {
        if (recoveryTimer !== null) {
            window.clearTimeout(recoveryTimer);
            recoveryTimer = null;
        }
    }

    function currentVideoId() {
        return String(document.getElementById('videoPlayer')?.dataset?.playingVideoId || '');
    }

    function syncRecoveryVideo() {
        const videoId = currentVideoId();
        if (videoId === recoveryVideoId) return;
        recoveryVideoId = videoId;
        recoveryAttempted = false;
        hasPlayedCurrentVideo = false;
        lastPlayerState = null;
        pausedAfterBuffering = false;
        clearRecoveryTimer();
    }

    function primeRecoveryState() {
        const state = Number(document.getElementById('videoPlayer')?.dataset?.playerState);
        if (!Number.isFinite(state)) return;
        lastPlayerState = state;
        if (state === 1 || state === 3) hasPlayedCurrentVideo = true;
    }

    function noteInteraction() {
        lastInteractionAt = Date.now();
        clearRecoveryTimer();
    }

    function recentlyInteracted() {
        return Date.now() - lastInteractionAt < RECENT_INTERACTION_MS;
    }

    function shouldRecoverState(state) {
        if (!active || recoveryAttempted || !hasPlayedCurrentVideo || recentlyInteracted()) return false;
        if (state === -1 || state === 5) return true;
        return state === 2 && pausedAfterBuffering;
    }

    function schedulePlaybackRecovery(state) {
        if (!shouldRecoverState(state) || recoveryTimer !== null) return;
        recoveryTimer = window.setTimeout(() => {
            recoveryTimer = null;
            syncRecoveryVideo();
            if (!shouldRecoverState(lastPlayerState)) return;
            recoveryAttempted = true;
            runPlayerAction('play');
        }, RECOVERY_DELAY);
    }

    function parseYouTubePayload(event) {
        if (!/youtube(-nocookie)?\\.com/.test(String(event.origin || ''))) return null;
        const iframe = document.querySelector('#videoPlayer iframe');
        if (!iframe || (event.source && iframe.contentWindow && event.source !== iframe.contentWindow)) return null;
        let payload = event.data;
        if (typeof payload === 'string') {
            try {
                payload = JSON.parse(payload);
            } catch (_) {
                return null;
            }
        }
        return payload && typeof payload === 'object' ? payload : null;
    }

    function handlePlayerStateForRecovery(event) {
        if (!active) return;
        const payload = parseYouTubePayload(event);
        if (payload?.event !== 'onStateChange') return;

        syncRecoveryVideo();
        const state = Number(payload.info);
        const previousState = lastPlayerState;
        lastPlayerState = state;

        if (state === 1) {
            hasPlayedCurrentVideo = true;
            pausedAfterBuffering = false;
            clearRecoveryTimer();
            return;
        }
        if (state === 0) {
            pausedAfterBuffering = false;
            clearRecoveryTimer();
            return;
        }

        pausedAfterBuffering = state === 2 && previousState === 3;
        schedulePlaybackRecovery(state);
    }

    function hideDriveUi() {
        const exit = document.getElementById(EXIT_ID);
        const controls = document.getElementById(CONTROLS_ID);
        if (exit) exit.hidden = true;
        if (controls) controls.hidden = true;
    }

    function scheduleUiHide() {
        clearUiHideTimer();
        uiHideTimer = window.setTimeout(() => {
            uiHideTimer = null;
            if (active) hideDriveUi();
        }, UI_HIDE_DELAY);
    }

    function showUiTemporarily() {
        if (!active) return;
        exitButton().hidden = false;
        controlsElement().hidden = false;
        scheduleUiHide();
    }

    function exitButton() {
        let button = document.getElementById(EXIT_ID);
        if (button) return button;
        button = document.createElement('button');
        button.id = EXIT_ID;
        button.type = 'button';
        button.className = 'dm-exit';
        button.textContent = '×';
        button.setAttribute('aria-label', 'Tanca el mode conducció');
        button.title = 'Tanca el mode conducció';
        button.addEventListener('click', event => {
            event.stopPropagation();
            exit();
        });
        document.body.appendChild(button);
        return button;
    }

    function runPlayerAction(name, ...args) {
        const action = app.features.systemPlayer?.actions?.[name];
        if (typeof action === 'function') action(...args);
    }

    function controlsElement() {
        let controls = document.getElementById(CONTROLS_ID);
        if (controls) return controls;

        controls = document.createElement('div');
        controls.id = CONTROLS_ID;
        controls.className = 'dm-controls';
        controls.setAttribute('role', 'group');
        controls.setAttribute('aria-label', 'Controls de reproducció');
        controls.innerHTML = `
            <button type="button" class="dm-control" data-dm-action="previous" aria-label="Cançó anterior" title="Cançó anterior">⏮</button>
            <button type="button" class="dm-control" data-dm-action="back" aria-label="Enrere 10 segons" title="Enrere 10 segons">↶<span>10</span></button>
            <button type="button" class="dm-control" data-dm-action="forward" aria-label="Endavant 10 segons" title="Endavant 10 segons"><span>10</span>↷</button>
            <button type="button" class="dm-control" data-dm-action="next" aria-label="Cançó següent" title="Cançó següent">⏭</button>
        `;
        controls.addEventListener('click', event => {
            const button = event.target?.closest?.('[data-dm-action]');
            if (!button) return;
            event.stopPropagation();
            const action = button.dataset.dmAction;
            if (action === 'previous') runPlayerAction('previous');
            else if (action === 'next') runPlayerAction('next');
            else if (action === 'back') runPlayerAction('seekBy', -10);
            else if (action === 'forward') runPlayerAction('seekBy', 10);
            showUiTemporarily();
        });
        document.body.appendChild(controls);
        return controls;
    }

    function hasPlayer() {
        return Boolean(document.querySelector('#videoPlayer iframe'));
    }

    function enter() {
        if (active || !hasPlayer()) return false;
        active = true;
        syncRecoveryVideo();
        primeRecoveryState();
        lastInteractionAt = 0;
        document.body.classList.add('drive-mode');
        showUiTemporarily();
        requestWakeLock();
        // Pantalla completa (amaga la barra del navegador). A l'iPhone no hi és per a pàgines: no passa res.
        const root = document.documentElement;
        if (!document.fullscreenElement && typeof root.requestFullscreen === 'function') {
            Promise.resolve(root.requestFullscreen({ navigationUI: 'hide' })).catch(() => {});
        }
        return true;
    }

    function exit() {
        if (!active) return false;
        active = false;
        document.body.classList.remove('drive-mode');
        hideDriveUi();
        clearUiHideTimer();
        clearRecoveryTimer();
        releaseWakeLock();
        if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
            Promise.resolve(document.exitFullscreen()).catch(() => {});
        }
        return true;
    }

    function isActive() {
        return active;
    }

    // El navegador allibera el bloqueig quan la pàgina deixa de veure's: es torna a demanar en tornar-hi.
    document.addEventListener('visibilitychange', () => {
        if (active && document.visibilityState === 'visible') requestWakeLock();
    });
    document.addEventListener('keydown', event => {
        if (!active) return;
        noteInteraction();
        if (event.key === 'Escape') exit();
    });
    // Un toc dins l'iframe de YouTube no propaga el clic al document, però en mòbil acostuma a fer perdre el focus
    // a la finestra. Es tracta com una interacció recent per no desfer una pausa voluntària.
    window.addEventListener('blur', () => {
        if (active) noteInteraction();
    });
    window.addEventListener('message', handlePlayerStateForRecovery);
    // El botó de sota el reproductor es torna a pintar a cada vídeo: el clic s'escolta al document.
    // En mode conducció, tocar la zona negra recupera temporalment els controls.
    document.addEventListener('click', event => {
        if (event.target?.closest?.('#driveModeBtn')) {
            enter();
            return;
        }
        if (!active) return;
        noteInteraction();
        if (!event.target?.closest?.('#videoPlayer, .dm-exit, .dm-controls')) {
            showUiTemporarily();
        }
    });

    app.features.driveMode = { enter, exit, isActive };
})(window);
