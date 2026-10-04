(function (window) {
    window.SegueixApp = window.SegueixApp || {};
    const app = window.SegueixApp;

    app.state = app.state || {
        selectedCategory: null,
        currentVideoId: null,
        currentChannelId: null,
        currentShortIndex: 0,
        activePlaylistId: null
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