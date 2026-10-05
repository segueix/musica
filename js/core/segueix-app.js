(function (window) {
    window.SegueixApp = window.SegueixApp || {};
    const app = window.SegueixApp;

    app.state = app.state || {
        selectedCategory: null,
        currentVideoId: null,
        currentChannelId: null,
        currentShortIndex: 0,
        activePlaylistId: null,
    };
    app.dom = app.dom || {};
    app.features = app.features || {};
    app.utils = app.utils || {};

    // El reproductor de YouTube (#videoPlayer) viu a la pàgina o, mentre és oberta la finestra flotant del sistema,
    // dins d'aquesta finestra (system-player.js hi deixa el node a `app.state.playerHost`): ja no el troba
    // `document.getElementById`. Qui necessiti l'element o el seu iframe ha de passar per aquí.
    app.utils.playerElement =
        app.utils.playerElement ||
        function playerElement() {
            return app.state.playerHost || window.document?.getElementById?.('videoPlayer') || null;
        };

    // Carpeta on viu l'app: «/musica/» a segueix.github.io/musica/, «/» a l'arrel d'un domini. Es treu de la ruta
    // d'aquest mateix script (js/core/segueix-app.js), que no canvia encara que l'app canviï la URL en reproduir.
    // Qualsevol URL que l'app escrigui amb history.pushState/replaceState ha de partir d'aquí, mai de «/».
    const APP_BASE_PATH = (() => {
        try {
            const src = window.document?.currentScript?.src;
            if (src) return new URL('../../', src).pathname;
        } catch (error) {
            // Sense URL (entorn de proves): es dedueix de la ruta actual
        }
        const path = String(window.location?.pathname || '/');
        return path.replace(/\/video\/[^/]*$/, '/').replace(/[^/]*$/, '') || '/';
    })();
    app.utils.appBasePath = app.utils.appBasePath || (() => APP_BASE_PATH);

    // Complement visual dels Shorts. Es carrega de forma independent per mantenir
    // el mòdul base lleuger i permetre ajustar la UI nativa de l'iframe sense tocar
    // la lògica sensible de navegació/reproducció.
    if (window.document?.head && !window.document.getElementById('shortsPolishScript')) {
        const script = window.document.createElement('script');
        script.id = 'shortsPolishScript';
        script.src = '/js/features/shorts-polish.js';
        script.async = true;
        window.document.head.appendChild(script);
    }
})(window);
