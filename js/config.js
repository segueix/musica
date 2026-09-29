// Arrel de l'app per a les peticions de dades.
//
// Mentre es mira un vídeo, l'app canvia l'URL a la ruta llegible (/video/<slug>-<id>).
// Això mou document.baseURI, i qualsevol ruta relativa —data/feed.json, els arxius de
// canal, els índexs de cerca, data/support.json— es demanaria dins de /video/ i
// respondria 404. L'arrel es dedueix de l'script que carrega aquest fitxer (js/config.js),
// de manera que continua sent correcta si algun dia l'app es torna a servir des d'un
// subdirectori.
(function (window) {
    const currentScript = window.document?.currentScript;
    let root = '/';
    try {
        const src = currentScript?.src;
        root = src ? new URL('../', src).href : new URL('/', window.location.origin).href;
    } catch (_) {
        root = '/';
    }
    window.SEGUEIX_APP_ROOT = root;
    window.appDataUrl = function appDataUrl(path) {
        const relative = String(path || '').replace(/^\.?\//, '');
        try {
            return new URL(relative, window.SEGUEIX_APP_ROOT).href;
        } catch (_) {
            return relative;
        }
    };
})(window);

// Configuració de l'aplicació
const CONFIG = {
    branding: {
        name: "Segueix!",
        tagline: "La teva plataforma de vídeos personalitzada"
    },
    
    theme: {
        primaryColor: "#FF0000",
        secondaryColor: "#282828",
        backgroundColor: "#121212",
        textColor: "#FFFFFF"
    },
    
    features: {
        comments: true,
        likes: true,
        subscriptions: true,
        search: true,
        recommendations: true,
        categories: true
    },
    
    layout: {
        showSidebar: true,
        videosPerPage: 12
    },
    
    // Categories personalitzades
    categories: [
        { id: "pop", name: "Pop", icon: "music" },
        { id: "rock", name: "Rock", icon: "guitar" },
        { id: "indie", name: "Indie", icon: "sparkles" },
        { id: "urbana", name: "Urbana", icon: "audio-waveform" },
        { id: "rap-hip-hop", name: "Rap / Hip-hop", icon: "mic-2" },
        { id: "folk-arrel", name: "Folk i arrel", icon: "trees" },
        { id: "canco-autor", name: "Cançó d'autor", icon: "pen-line" },
        { id: "electronica", name: "Electrònica", icon: "radio" },
        { id: "ska-reggae", name: "Ska / Reggae", icon: "waves" },
        { id: "rumba-mestissatge", name: "Rumba / Mestissatge", icon: "drum" },
        { id: "punk-metal", name: "Punk / Metal", icon: "zap" },
        { id: "jazz-blues", name: "Jazz / Blues", icon: "music-2" },
        { id: "classica", name: "Clàssica", icon: "music" },
        { id: "infantil", name: "Infantil", icon: "baby" },
        { id: "altres-estils", name: "Altres estils", icon: "disc-3" }
    ],
    
    navigation: {
        showHome: true,
        showTrending: true,
        showSubscriptions: true,
        showLibrary: true,
        showHistory: true
    },

    forms: {
        suggestYoutuberUrl: "https://docs.google.com/forms/d/e/1FAIpQLSdIZCIqIpjYH9Xq5t9anTNfnQ2t53jkEtYqA6D8NMnRdIlxWQ/viewform"
    }
};

// Cada nova entrada a l'app comença a Novetats. Durant la sessió l'usuari
// pot navegar lliurement per qualsevol categoria; només es reinicia el punt
// d'entrada quan es torna a carregar/obrir l'experiència.
try {
    localStorage.setItem('catube_last_category', 'Novetats');
} catch (_) {}

// Aplicar tema personalitzat
function applyTheme() {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', CONFIG.theme.primaryColor);
    root.style.setProperty('--color-secondary', CONFIG.theme.secondaryColor);
    root.style.setProperty('--color-background', CONFIG.theme.backgroundColor);
    root.style.setProperty('--color-text', CONFIG.theme.textColor);
    
    document.title = CONFIG.branding.name;
    
    const logoText = document.querySelector('.logo-text');
    if (logoText) {
        logoText.textContent = CONFIG.branding.name;
    }
}

// Aplicar tema quan es carrega la pàgina
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyTheme);
} else {
    applyTheme();
}

// SEGUEIX_API_URL eliminat — dependència de Google Sheets suprimida (Fase 1 QR)
