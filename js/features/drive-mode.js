// Mode conducció (mòbil): pantalla negra amb només el reproductor de YouTube, petit, a dalt, i un sol botó per
// tancar-lo. La pantalla no s'apaga (Screen Wake Lock) i, com que l'app continua en primer pla, la música no
// s'atura. El reproductor no es tapa ni es mou de lloc al DOM (YouTube el recarregaria): només canvia el CSS
// (`body.drive-mode`, a css/portada.css). Les normes de YouTube demanen que el reproductor es vegi (mínim 200×200).
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;
    const document = window.document;

    const EXIT_ID = 'driveModeExit';
    let active = false;
    let wakeLock = null;

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

    function exitButton() {
        let button = document.getElementById(EXIT_ID);
        if (button) return button;
        button = document.createElement('button');
        button.id = EXIT_ID;
        button.type = 'button';
        button.className = 'dm-exit';
        button.textContent = 'Tanca el mode conducció';
        button.addEventListener('click', () => exit());
        document.body.appendChild(button);
        return button;
    }

    function hasPlayer() {
        return Boolean(document.querySelector('#videoPlayer iframe'));
    }

    function enter() {
        if (active || !hasPlayer()) return false;
        active = true;
        exitButton().hidden = false;
        document.body.classList.add('drive-mode');
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
    document.addEventListener('click', event => {
        if (event.target?.closest?.('#driveModeBtn')) enter();
    });

    app.features.driveMode = { enter, exit, isActive };
})(window);
