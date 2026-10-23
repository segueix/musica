// ========== PAS A SEGUEIX! (ELS YOUTUBERS) ==========
// Segueix! Música (musica.segueix.cat) i Segueix! dels youtubers (segueix.cat) són dues apps germanes (2026-10-23).
// - Totes les mides: la icona de YouTuber de dalt de tot a la dreta de la capçalera (#appSwitchLink, un enllaç normal).
// - Mòbil, a més: lliscar el dit cap a l'esquerra o la dreta pel mig de la pantalla fa entrar un panell «Segueix!» des del
//   costat que segueix el dit; si es deixa anar passat el llindar, s'obre segueix.cat (a la mateixa pestanya).
// El gest no s'activa des de les vores (hi ha l'enrere del sistema), ni damunt de fileres amb scroll lateral, el
// mapa, camps de text o finestres obertes, ni si el moviment és sobretot vertical (fer scroll de la pàgina).
// Patró 2 (implementació directa). La lògica de decisió és pura (zona d'inici, direcció, llindar) i es prova.
(function (window) {
    const app = window.SegueixApp || (window.SegueixApp = { features: {} });
    app.features = app.features || {};

    const TARGET_URL = 'https://segueix.cat/';
    // Zona central on ha de començar el gest (fraccions de la pantalla): fora de les vores del sistema
    const START_ZONE = { left: 0.12, right: 0.88, top: 0.15, bottom: 0.88 };
    const LOCK_DISTANCE = 12; // px abans de decidir si el gest és horitzontal o vertical
    const HORIZONTAL_RATIO = 1.8; // |dx| ha de ser 1,8 vegades |dy| perquè compti com a horitzontal
    const COMMIT_FRACTION = 0.35; // cal arrossegar el 35 % de l'ample de la pantalla
    const MIN_COMMIT_PX = 110;
    // Damunt d'aquests elements el gest no fa res (tenen gestos propis o s'hi escriu)
    const BLOCKED = [
        'input',
        'textarea',
        'select',
        '[contenteditable]',
        '[data-no-app-swipe]',
        '#artistMap',
        '.artist-map',
        '.sortable-chosen',
        '.sortable-ghost',
        '[role="dialog"]',
        'dialog',
        '.modal',
        '.near-dialog',
        '.mobile-search-overlay',
        '.search-dropdown',
        '#playerExternalControls',
        '#videoPlayer',
    ].join(',');

    // ---------- Lògica pura ----------

    function startAllowed({ x, y, width, height }) {
        if (!(width > 0) || !(height > 0)) return false;
        return (
            x >= width * START_ZONE.left &&
            x <= width * START_ZONE.right &&
            y >= height * START_ZONE.top &&
            y <= height * START_ZONE.bottom
        );
    }

    // 'h' (horitzontal), 'v' (vertical) o '' (encara no se sap)
    function lockAxis(dx, dy) {
        const ax = Math.abs(dx);
        const ay = Math.abs(dy);
        if (ax < LOCK_DISTANCE && ay < LOCK_DISTANCE) return '';
        return ax > ay * HORIZONTAL_RATIO ? 'h' : 'v';
    }

    function commitDistance(width) {
        return Math.max(MIN_COMMIT_PX, width * COMMIT_FRACTION);
    }

    // Fins on ha entrat el panell (0–1)
    function progress(dx, width) {
        return Math.max(0, Math.min(1, Math.abs(dx) / commitDistance(width)));
    }

    function shouldCommit({ dx, dy, width }) {
        return Math.abs(dx) >= commitDistance(width) && Math.abs(dx) > Math.abs(dy) * HORIZONTAL_RATIO;
    }

    // ---------- DOM ----------

    const state = { tracking: false, axis: '', x0: 0, y0: 0, dx: 0, dy: 0, panel: null, leaving: false };

    function isMobile() {
        return Boolean(window.matchMedia?.('(max-width: 768px)').matches);
    }

    // Un element (o un pare) que ja fa scroll lateral: el dit és per a ell, no per canviar d'app
    function insideHorizontalScroller(target) {
        for (let node = target; node && node !== window.document.body; node = node.parentElement) {
            if (node.nodeType !== 1) continue;
            const overflowX = window.getComputedStyle(node).overflowX;
            if ((overflowX === 'auto' || overflowX === 'scroll') && node.scrollWidth > node.clientWidth + 2)
                return true;
        }
        return false;
    }

    function blocked(target) {
        if (!target || typeof target.closest !== 'function') return true;
        if (target.closest(BLOCKED)) return true;
        const body = window.document.body;
        // Finestres i estats que ocupen la pantalla
        if (body.classList.contains('drive-mode') || body.classList.contains('modal-open')) return true;
        if (window.document.querySelector('.artist-map.is-full, dialog[open]')) return true;
        return insideHorizontalScroller(target);
    }

    const ICON =
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="9" cy="7.5" r="3.5"/><path d="M2.5 20v-1.5A5.5 5.5 0 0 1 8 13h2"/><rect x="12.5" y="12" width="9.5" height="8" rx="2.2"/><path class="app-switch-fill" d="m16 14.4 3.4 1.6-3.4 1.6v-3.2Z"/></svg>';

    function ensurePanel() {
        if (state.panel?.isConnected) return state.panel;
        const doc = window.document;
        const panel = doc.createElement('div');
        panel.className = 'app-switch';
        panel.setAttribute('aria-hidden', 'true');
        panel.innerHTML = `<div class="app-switch__card">${ICON}<strong>Segueix!</strong><span>Els nostres YouTubers</span><em class="app-switch__go">Deixa anar per anar-hi</em></div>`;
        doc.body.appendChild(panel);
        state.panel = panel;
        return panel;
    }

    function paint(dx) {
        const panel = ensurePanel();
        const width = window.innerWidth;
        const p = progress(dx, width);
        // Lliscant cap a l'esquerra el panell entra per la dreta, i a l'inrevés
        const from = dx < 0 ? 1 : -1;
        panel.classList.add('is-active');
        panel.classList.toggle('is-ready', p >= 1);
        panel.style.transition = 'none';
        panel.style.transform = `translateX(${from * (1 - p) * 100}%)`;
    }

    function reset({ animate = true } = {}) {
        const panel = state.panel;
        state.tracking = false;
        state.axis = '';
        if (!panel) return;
        const from = state.dx < 0 ? 1 : -1;
        panel.style.transition = animate ? '' : 'none';
        panel.style.transform = `translateX(${from * 100}%)`;
        panel.classList.remove('is-ready');
        window.setTimeout(() => panel.classList.remove('is-active'), animate ? 260 : 0);
    }

    function leave() {
        const panel = ensurePanel();
        state.leaving = true;
        panel.classList.add('is-active', 'is-ready', 'is-leaving');
        panel.style.transition = '';
        panel.style.transform = 'translateX(0)';
        window.setTimeout(() => window.location.assign(TARGET_URL), 180);
    }

    function onStart(event) {
        if (state.leaving || !isMobile() || event.touches.length !== 1) return;
        const touch = event.touches[0];
        if (!startAllowed({ x: touch.clientX, y: touch.clientY, width: window.innerWidth, height: window.innerHeight }))
            return;
        if (blocked(event.target)) return;
        state.tracking = true;
        state.axis = '';
        state.x0 = touch.clientX;
        state.y0 = touch.clientY;
        state.dx = 0;
        state.dy = 0;
    }

    function onMove(event) {
        if (!state.tracking) return;
        if (event.touches.length !== 1) {
            reset();
            return;
        }
        const touch = event.touches[0];
        state.dx = touch.clientX - state.x0;
        state.dy = touch.clientY - state.y0;
        if (!state.axis) state.axis = lockAxis(state.dx, state.dy);
        if (state.axis === 'v') {
            state.tracking = false;
            return;
        }
        if (state.axis === 'h') paint(state.dx);
    }

    function onEnd() {
        if (!state.tracking) return;
        if (state.axis === 'h' && shouldCommit({ dx: state.dx, dy: state.dy, width: window.innerWidth })) {
            state.tracking = false;
            leave();
            return;
        }
        reset();
    }

    // ---------- Avís de les primeres vegades (mòbil) ----------
    // Les tres primeres vegades que s'obre l'app al mòbil, a Inici i un cop ha marxat la pantalla d'espera, una mà
    // blanca amb el dit estirat llisca cap als costats amb «Segueix! YouTubers» a sota durant uns 3 s, per explicar que
    // lliscant el dit es canvia d'app. No bloqueja res (pointer-events: none). Només compta si s'ha arribat a mostrar.
    const HINT_KEY = 'catube_app_switch_hint_v1';
    const HINT_TIMES = 3;
    const HINT_MS = 3000;
    const HINT_WAIT_MS = 20000; // si en 20 s no s'arriba a Inici (p. ex. s'ha obert una cançó), aquesta vegada no surt

    function shouldShowHint(count) {
        const n = Number(count);
        return !Number.isFinite(n) || n < HINT_TIMES;
    }

    function readHintCount() {
        try {
            return Number(window.localStorage.getItem(HINT_KEY)) || 0;
        } catch (error) {
            return HINT_TIMES; // sense emmagatzematge no es pot comptar: millor no repetir-lo a cada obertura
        }
    }

    function saveHintCount(count) {
        try {
            window.localStorage.setItem(HINT_KEY, String(count));
        } catch (error) {
            // sense emmagatzematge
        }
    }

    // Una mà amb el dit índex estirat (traç blanc; forma de la icona «pointer» de Lucide, ISC)
    const HAND =
        '<svg class="app-switch-hint__hand" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M22 14a8 8 0 0 1-8 8"/><path d="M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1"/><path d="M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10"/><path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>';

    function homeReady() {
        const doc = window.document;
        const home = doc.getElementById('homePage');
        if (!home || home.classList.contains('hidden') || home.classList.contains('is-booting')) return false;
        if (!home.classList.contains('is-portada') || !home.offsetHeight) return false;
        const splash = doc.getElementById('intro-splash');
        return !splash || splash.classList.contains('splash-hidden');
    }

    function showHint() {
        const doc = window.document;
        const hint = doc.createElement('div');
        hint.className = 'app-switch-hint';
        hint.setAttribute('role', 'status');
        hint.innerHTML = `<div class="app-switch-hint__stage" aria-hidden="true"><span class="app-switch-hint__arrow app-switch-hint__arrow--left">‹</span>${HAND}<span class="app-switch-hint__arrow app-switch-hint__arrow--right">›</span></div><strong>Segueix! YouTubers</strong><span class="app-switch-hint__sr">Llisca el dit cap a un costat per anar a Segueix! dels YouTubers</span>`;
        doc.body.appendChild(hint);
        // Res damunt del reproductor de YouTube (la finestra flotant del mòbil): si hi tocaria, aquesta vegada no surt
        const player = doc.getElementById('videoPlayer');
        const box = hint.getBoundingClientRect();
        const playerBox = player?.querySelector('iframe') ? player.getBoundingClientRect() : null;
        if (
            playerBox &&
            playerBox.width > 0 &&
            !(
                playerBox.bottom <= box.top ||
                playerBox.top >= box.bottom ||
                playerBox.right <= box.left ||
                playerBox.left >= box.right
            )
        ) {
            hint.remove();
            return false;
        }
        window.requestAnimationFrame(() => hint.classList.add('is-visible'));
        window.setTimeout(() => hint.classList.remove('is-visible'), HINT_MS - 300);
        window.setTimeout(() => hint.remove(), HINT_MS);
        return true;
    }

    function scheduleHint() {
        if (!isMobile() || !shouldShowHint(readHintCount())) return;
        const started = Date.now();
        const tick = () => {
            if (state.leaving || !isMobile()) return;
            if (homeReady()) {
                // Mig segon després que Inici sigui a punt, perquè es vegi la pantalla abans
                window.setTimeout(() => {
                    if (homeReady() && showHint()) saveHintCount(readHintCount() + 1);
                }, 500);
                return;
            }
            if (Date.now() - started < HINT_WAIT_MS) window.setTimeout(tick, 300);
        };
        tick();
    }

    function init() {
        const doc = window.document;
        if (!doc?.addEventListener || doc.documentElement.dataset.appSwitch === 'on') return;
        doc.documentElement.dataset.appSwitch = 'on';
        doc.addEventListener('touchstart', onStart, { passive: true });
        doc.addEventListener('touchmove', onMove, { passive: true });
        doc.addEventListener('touchend', onEnd, { passive: true });
        doc.addEventListener('touchcancel', () => reset(), { passive: true });
        // En tornar enrere des de segueix.cat el navegador pot restaurar la pàgina tal com era: sense el panell
        window.addEventListener('pageshow', () => {
            state.leaving = false;
            if (state.panel) {
                state.panel.classList.remove('is-leaving');
                reset({ animate: false });
            }
        });
        scheduleHint();
    }

    app.features.appSwitch = {
        TARGET_URL,
        startAllowed,
        lockAxis,
        commitDistance,
        progress,
        shouldCommit,
        shouldShowHint,
        HINT_KEY,
        HINT_TIMES,
        init,
    };

    if (window.document?.readyState === 'loading') {
        window.document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})(window);
