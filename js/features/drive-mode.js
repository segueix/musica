// Mode conducció (mòbil): mode d'ultraestalvi amb fons negre, reproductor de YouTube de 200×200 i Wake Lock.
// El botó de sortida s'amaga al cap de 5 segons i reapareix tocant la zona negra. El reproductor no es tapa ni
// es mou de lloc al DOM (YouTube el recarregaria): només canvia el CSS (`body.drive-mode`, a css/portada.css).
// Les normes de YouTube demanen que el reproductor es vegi i faci com a mínim 200×200.
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;
    const document = window.document;

    const EXIT_ID = 'driveModeExit';
    const EXIT_HIDE_DELAY = 5000;
    let active = false;
    let wakeLock = null;
    let exitHideTimer = null;

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

    function clearExitHideTimer() {
        if (exitHideTimer !== null) {
            window.clearTimeout(exitHideTimer);
            exitHideTimer = null;
        }
    }

    function scheduleExitHide() {
        clearExitHideTimer();
        exitHideTimer = window.setTimeout(() => {
            exitHideTimer = null;
            const button = document.getElementById(EXIT_ID);
            if (active && button) button.hidden = true;
        }, EXIT_HIDE_DELAY);
    }

    function showExitTemporarily() {
        if (!active) return;
        const button = exitButton();
        button.hidden = false;
        scheduleExitHide();
    }

    function exitButton() {
        let button = document.getElementById(EXIT_ID);
        if (button) return button;
        button = document.createElement('button');
        button.id = EXIT_ID;
        button.type = 'button';
        button.className = 'dm-exit';
        button.textContent = 'Tanca el mode conducció';
        button.addEventListener('click', event => {
            event.stopPropagation();
            exit();
        });
        document.body.appendChild(button);
        return button;
    }

    function hasPlayer() {
        return Boolean(document.querySelector('#videoPlayer iframe'));
    }

    function enter() {
        if (active || !hasPlayer()) return false;
        active = true;
        document.body.classList.add('drive-mode');
        showExitTemporarily();
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
        const button = document.getElementById(EXIT_ID);
        if (button) button.hidden = true;
        clearExitHideTimer();
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
        if (active && event.key === 'Escape') exit();
    });
    // El botó de sota el reproductor es torna a pintar a cada vídeo: el clic s'escolta al document.
    // En mode conducció, tocar la zona negra recupera temporalment el botó de sortida.
    document.addEventListener('click', event => {
        if (event.target?.closest?.('#driveModeBtn')) {
            enter();
            return;
        }
        if (active && !event.target?.closest?.('#videoPlayer, .dm-exit')) {
            showExitTemporarily();
        }
    });

    app.features.driveMode = { enter, exit, isActive };
})(window);
