// Navegació de Segueix Música: barra lateral (escriptori), navegació inferior (mòbil) i avisos breus.
// Implementació directa (patró 2). No duplica cap vista: cada accés delega al que ja existeix
// (els botons .nav-trigger de la capçalera, els xips d'estil, el cercador mòbil), de manera que el
// reproductor, la mini-finestra i l'historial del navegador es comporten exactament igual que abans.
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;

    const PAGE_IDS = ['homePage', 'watchPage', 'historyPage', 'playlistsPage', 'followPage', 'channelPage'];
    let lastSection = 'home';
    let toastTimer = 0;
    let syncFrame = 0;

    const $ = id => window.document?.getElementById?.(id) || null;
    const visible = id => {
        const element = $(id);
        return Boolean(element && !element.classList.contains('hidden'));
    };

    // ---------- Avisos breus (role=status, no interrompen ni prenen el focus) ----------

    // `action`: { label, onClick } opcional (p. ex. «Desfés»); el botó és accessible amb teclat.
    function toast(message, { duration = 4200, action = null } = {}) {
        const doc = window.document;
        if (!doc?.body || !message) return;
        let element = $('ptToast');
        if (!element) {
            element = doc.createElement('div');
            element.id = 'ptToast';
            element.className = 'pt-toast';
            element.setAttribute('role', 'status');
            element.setAttribute('aria-live', 'polite');
            doc.body.appendChild(element);
        }
        // Buidar i tornar a escriure perquè els lectors de pantalla el tornin a anunciar
        element.textContent = '';
        window.setTimeout(() => {
            element.textContent = message;
            if (action?.label && typeof action.onClick === 'function') {
                const button = doc.createElement('button');
                button.type = 'button';
                button.className = 'pt-toast__action';
                button.textContent = action.label;
                button.addEventListener('click', () => {
                    action.onClick();
                    element.classList.remove('is-visible');
                });
                element.appendChild(button);
            }
            element.classList.add('is-visible');
        }, 30);
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => element.classList.remove('is-visible'), duration);
    }

    // ---------- Accions de navegació ----------

    const clickIn = selector => window.document.querySelector(selector)?.click();
    const isMobile = () => Boolean(window.matchMedia?.('(max-width: 768px)')?.matches);

    const ACTIONS = {
        home: () => clickIn('.nav-trigger[data-page="home"]'),
        // «Descobreix» és la vista existent d'artistes que encara no segueixes.
        discover: () => {
            const chip = Array.from(window.document.querySelectorAll('.chips-bar .chip[data-cat]')).find(
                item => item.dataset.cat === 'Descobreix'
            );
            chip?.click();
            window.scrollTo?.({ top: 0 });
        },
        artists: () => clickIn('.nav-trigger[data-page="segueix"]'),
        library: () => clickIn('.nav-trigger[data-page="llistes"]'),
        history: () => clickIn('.nav-trigger[data-page="historial"]'),
        suggest: () => clickIn('#addYoutuberBtn'),
        search: () => {
            if (isMobile()) {
                // app.js tanca la cerca amb qualsevol clic fora del formulari: s'obre en acabar aquest clic
                window.setTimeout(() => clickIn('.mobile-search-toggle'), 0);
            } else {
                const input = window.document.querySelector('.search-input');
                input?.focus();
                input?.select?.();
            }
        },
    };

    // Obre un estil (els xips de la barra d'estils de la portada): si no som a Inici, primer s'hi torna.
    function openStyle(label) {
        const doc = window.document;
        const findChip = () =>
            Array.from(doc.querySelectorAll('.chips-bar .chip[data-cat]')).find(chip => chip.dataset.cat === label);
        const go = () => {
            const chip = findChip();
            if (!chip) return false;
            chip.click();
            window.scrollTo?.({ top: 0 });
            return true;
        };
        if (visible('homePage') && go()) return true;
        ACTIONS.home();
        window.setTimeout(go, 60);
        return true;
    }

    // Enllaços del peu amb URL pròpia (?estil=Pop, ?seccio=artistes): també funcionen en obrir-los en una pestanya nova.
    function openFromUrl() {
        let params;
        try {
            params = new window.URLSearchParams(window.location.search || '');
        } catch (error) {
            return;
        }
        const style = params.get('estil');
        const section = params.get('seccio');
        if (!style && section !== 'artistes') return;
        params.delete('estil');
        params.delete('seccio');
        const query = params.toString();
        window.history?.replaceState?.(
            window.history.state,
            '',
            `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash || ''}`
        );
        // Els xips i la navegació es pinten quan el feed ja és a punt: s'espera (fins a 10 s)
        let tries = 0;
        const timer = window.setInterval(() => {
            tries += 1;
            const ready = window.document.querySelector('.chips-bar .chip[data-cat]');
            if (!ready && tries < 50) return;
            window.clearInterval(timer);
            // Un moment més: l'app acaba de restaurar la vista inicial just després de pintar els xips
            window.setTimeout(() => (section === 'artistes' ? ACTIONS.artists() : openStyle(style)), 400);
        }, 200);
    }

    function onClick(event) {
        // Botó «Tanca la cerca» de la cerca mòbil: reutilitza el tancament existent (l'overlay)
        if (event.target.closest?.('.pt-search-close')) {
            window.document.querySelector('.mobile-search-overlay')?.click();
            return;
        }
        const styleLink = event.target.closest?.('[data-pt-style]');
        if (styleLink) {
            event.preventDefault();
            openStyle(styleLink.dataset.ptStyle);
            return;
        }
        const item = event.target.closest?.('[data-pt-nav]');
        if (!item) return;
        const action = ACTIONS[item.dataset.ptNav];
        if (!action) return;
        // Els .nav-item de la barra lateral (Inici, Artistes, La teva música) ja els gestiona app.js
        if (item.classList.contains('nav-item')) return;
        event.preventDefault();
        action();
    }

    // ---------- Secció activa ----------

    function currentSection() {
        if (visible('followPage') || visible('channelPage')) return 'artists';
        if (visible('playlistsPage') || visible('historyPage')) return 'library';
        if (visible('homePage')) {
            let category = 'Novetats';
            try {
                category = selectedCategory;
            } catch (error) {
                // app.js encara no ha carregat
            }
            return category === 'Descobreix' ? 'discover' : 'home';
        }
        // A la pàgina del reproductor es manté la secció d'on venim
        return lastSection;
    }

    function sync() {
        syncFrame = 0;
        const section = currentSection();
        lastSection = section;
        const doc = window.document;
        if (doc.body) doc.body.dataset.ptSection = section;
        doc.querySelectorAll('.pt-nav-item[data-pt-nav]').forEach(item => {
            const current = item.dataset.ptNav === section;
            item.classList.toggle('is-current', current);
            if (current) item.setAttribute('aria-current', 'page');
            else item.removeAttribute('aria-current');
        });
    }

    function scheduleSync() {
        if (syncFrame) return;
        syncFrame = window.requestAnimationFrame ? window.requestAnimationFrame(sync) : window.setTimeout(sync, 16);
    }

    function init() {
        const doc = window.document;
        doc.addEventListener('click', onClick);
        if (typeof window.MutationObserver === 'function') {
            const observer = new window.MutationObserver(scheduleSync);
            PAGE_IDS.forEach(id => {
                const element = $(id);
                if (element) observer.observe(element, { attributes: true, attributeFilter: ['class'] });
            });
            const chips = doc.querySelector('.chips-bar');
            if (chips) {
                observer.observe(chips, {
                    subtree: true,
                    childList: true,
                    attributes: true,
                    attributeFilter: ['class'],
                });
            }
        }
        window.addEventListener('popstate', scheduleSync);
        sync();
        openFromUrl();
    }

    if (window.document?.readyState === 'loading') {
        window.document.addEventListener('DOMContentLoaded', init);
    } else if (window.document) {
        init();
    }

    app.features.shellNav = { toast, sync, currentSection, openStyle, ACTIONS };
})(window);
