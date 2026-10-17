// Instal·la l'app: botó a dalt a la dreta d'Inici (#ptInstallBtn), «Comparteix» al costat (#ptInstallShare) i finestra
// amb els passos de cada aparell.
// Android, Windows, Chromebook (i Linux / Mac amb Chrome o Edge) ofereixen «beforeinstallprompt»: el botó instal·la
// directament. iPhone, iPad i Safari de Mac no deixen instal·lar des de la pàgina: s'hi mostren els passos.
// Patró 2 (implementació directa): app.js només crida init() des d'initInstallPrompt().
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;

    const state = { prompt: null, installed: false, bound: false, dialog: null, lastFocus: null };

    const ICONS = {
        download:
            '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14"/></svg>',
        android:
            '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6.2 10.6a5.8 5.8 0 0 1 11.6 0ZM6.2 11.8h11.6v6.4c0 .8-.6 1.4-1.4 1.4H7.6c-.8 0-1.4-.6-1.4-1.4Z"/><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="m8.4 3.7.9 1.6m6.3-1.6-.9 1.6"/><circle cx="9.5" cy="8.4" r=".9" fill="var(--pt-bg, #141615)"/><circle cx="14.5" cy="8.4" r=".9" fill="var(--pt-bg, #141615)"/></svg>',
        apple: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.8ZM14.1 5.9c.6-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.5 2.8-1.3Z"/></svg>',
        windows:
            '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 5.6 10.4 4.5v7H3Zm8.6-1.3L21 3v8.5h-9.4ZM3 12.5h7.4v7L3 18.4Zm8.6 0H21V21l-9.4-1.3Z"/></svg>',
        chromebook:
            '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4" y="4.5" width="16" height="11.5" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M2 19.5h20"/><circle cx="12" cy="10.25" r="3.1" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10.25" r="1" fill="currentColor"/></svg>',
        share: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="18" cy="5" r="2.6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="19" r="2.6" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" d="m8.3 13.3 7.4 4.4m0-11.4-7.4 4.4"/></svg>',
        close: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/></svg>',
    };

    // Aparells de la finestra, en aquest ordre. Linux comparteix la fila de Windows (mateixos navegadors).
    const DEVICES = [
        { id: 'android', name: 'Android', icon: 'android', browser: 'chrome' },
        { id: 'ios', name: 'iPhone i iPad', icon: 'apple', browser: 'safari' },
        { id: 'windows', name: 'Windows', icon: 'windows', browser: 'chrome' },
        { id: 'chromeos', name: 'Chromebook', icon: 'chromebook', browser: 'chrome' },
        { id: 'mac', name: 'Mac', icon: 'apple', browser: 'safari' },
    ];

    function escapeHtml(value) {
        return String(value ?? '').replace(
            /[&<>"']/g,
            char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
        );
    }

    // ---------- Lògica pura ----------
    // Sistema i navegador a partir del navigator. L'iPad modern diu que és un Mac: el delata la pantalla tàctil.
    function detectDevice(nav = {}) {
        const ua = String(nav.userAgent || '');
        const touch = Number(nav.maxTouchPoints) || 0;
        let os = 'other';
        if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touch > 1)) os = 'ios';
        else if (/Android/i.test(ua)) os = 'android';
        else if (/CrOS/i.test(ua)) os = 'chromeos';
        else if (/Windows/i.test(ua)) os = 'windows';
        else if (/Macintosh|Mac OS X/i.test(ua)) os = 'mac';
        else if (/Linux/i.test(ua)) os = 'linux';

        let browser = 'other';
        if (/EdgA?\/|EdgiOS\/|Edg\//.test(ua)) browser = 'edge';
        else if (/SamsungBrowser\//.test(ua)) browser = 'samsung';
        else if (/Firefox\/|FxiOS\//.test(ua)) browser = 'firefox';
        else if (/OPR\/|Opera/.test(ua)) browser = 'opera';
        else if (/CriOS\/|Chrome\//.test(ua)) browser = 'chrome';
        else if (/Safari\//.test(ua)) browser = 'safari';
        return { os, browser };
    }

    // Fila de la finestra que correspon al sistema (Linux → Windows); null si no el coneixem.
    function deviceRow(os) {
        const id = os === 'linux' ? 'windows' : os;
        return DEVICES.find(device => device.id === id) || null;
    }

    // Passos per instal·lar-la a mà en cada sistema i navegador (quan el navegador no ho fa directament).
    function stepsFor(os, browser) {
        const desktopChromium = place => {
            if (browser === 'edge') {
                return [
                    "Prem la icona d'instal·lar de la barra d'adreces, a la dreta (una pantalla amb un «+»).",
                    'O bé obre el menú (…) → «Aplicacions» → «Instal·la aquest lloc com a aplicació».',
                    `Confirma amb «Instal·la»: la trobaràs ${place}.`,
                ];
            }
            return [
                "Prem la icona d'instal·lar de la barra d'adreces, a la dreta (una pantalla amb una fletxa).",
                'O bé obre el menú (⋮) → «Desa i comparteix» → «Instal·la la pàgina com a aplicació».',
                `Confirma amb «Instal·la»: la trobaràs ${place}.`,
            ];
        };
        const firefoxNote = 'Si el teu Firefox no ofereix instal·lar-la, obre aquesta pàgina amb Chrome o Edge.';

        switch (os) {
            case 'ios':
                return {
                    steps: [
                        'Toca el botó Compartir (el quadrat amb una fletxa cap amunt).',
                        "Tria «Afegeix a la pantalla d'inici» (si no hi és, llisca la llista cap avall).",
                        'Toca «Afegeix»: Segueix Música sortirà amb les altres apps.',
                    ],
                    note:
                        browser === 'safari'
                            ? ''
                            : 'Amb Chrome o Edge cal iOS 16.4 o posterior. Si no hi surt, obre aquesta pàgina amb Safari.',
                };
            case 'android':
                if (browser === 'samsung') {
                    return {
                        steps: [
                            'Toca el menú (≡) de la barra de baix.',
                            "Tria «Afegeix la pàgina a» → «Pantalla d'inici».",
                            'Confirma amb «Afegeix».',
                        ],
                        note: '',
                    };
                }
                return {
                    steps: [
                        'Toca el menú (⋮) de dalt a la dreta del navegador.',
                        "Tria «Instal·la l'aplicació» o «Afegeix a la pantalla d'inici».",
                        'Confirma amb «Instal·la»: Segueix Música sortirà amb les altres apps.',
                    ],
                    note: browser === 'firefox' ? 'Amb Chrome s’instal·la directament amb el botó.' : '',
                };
            case 'chromeos':
                return { steps: desktopChromium("al menú d'aplicacions i a la prestatgeria"), note: '' };
            case 'windows':
            case 'linux':
                return {
                    steps: desktopChromium(
                        os === 'linux' ? "al menú d'aplicacions" : 'al menú Inici i la pots fixar a la barra de tasques'
                    ),
                    note: browser === 'firefox' ? firefoxNote : '',
                };
            case 'mac':
                if (browser === 'safari' || browser === 'other') {
                    return {
                        steps: [
                            'Al menú Fitxer de Safari, tria «Afegeix al Dock».',
                            'Confirma amb «Afegeix».',
                            "S'obrirà com una app des del Dock i el Launchpad.",
                        ],
                        note: 'Cal Safari 17 o posterior (macOS Sonoma). També funciona amb Chrome o Edge.',
                    };
                }
                return {
                    steps: desktopChromium('al Launchpad i al Dock'),
                    note: browser === 'firefox' ? firefoxNote : '',
                };
            default:
                return { steps: [], note: '' };
        }
    }

    // Ja s'obre com a app (instal·lada): no cal el botó.
    function isStandalone(win = window) {
        try {
            if (win.navigator?.standalone === true) return true;
            const media = query => Boolean(win.matchMedia?.(query)?.matches);
            return (
                media('(display-mode: standalone)') ||
                media('(display-mode: window-controls-overlay)') ||
                media('(display-mode: minimal-ui)')
            );
        } catch (error) {
            return false;
        }
    }

    // ---------- HTML ----------
    function stepsHtml({ steps, note }) {
        const list = steps.map(step => `<li>${escapeHtml(step)}</li>`).join('');
        return `<ol class="ai-steps">${list}</ol>${note ? `<p class="ai-note">${escapeHtml(note)}</p>` : ''}`;
    }

    function dialogHtml({ os, browser, canPrompt }) {
        const mine = deviceRow(os);
        const others = DEVICES.filter(device => device !== mine);
        const mineHtml = mine
            ? `<section class="ai-mine" aria-labelledby="aiMineTitle">
                    <h3 class="ai-device-title" id="aiMineTitle">
                        <span class="ai-device-icon">${ICONS[mine.icon]}</span>
                        <span>Al teu aparell <small>${escapeHtml(os === 'linux' ? 'Linux' : mine.name)}</small></span>
                    </h3>
                    ${stepsHtml(stepsFor(os, browser))}
               </section>`
            : '';
        const othersHtml = others
            .map(
                device => `<li class="ai-other">
                    <h4 class="ai-device-title"><span class="ai-device-icon">${ICONS[device.icon]}</span><span>${escapeHtml(
                        device.name
                    )}</span></h4>
                    ${stepsHtml(stepsFor(device.id, device.browser))}
                </li>`
            )
            .join('');
        return `<div class="ai-dialog" role="dialog" aria-modal="true" aria-labelledby="aiTitle" aria-describedby="aiLead">
                <header class="ai-head">
                    <img class="ai-logo" src="img/icon-192.png" alt="" width="56" height="56">
                    <div class="ai-head__copy">
                        <h2 class="ai-title" id="aiTitle">Instal·la Segueix Música</h2>
                        <p class="ai-lead" id="aiLead">S'instal·la directament i s'obre com una app, amb la seva icona i a pantalla completa. També la pots compartir.</p>
                    </div>
                    <button class="ai-close" type="button" data-ai-close aria-label="Tanca">${ICONS.close}</button>
                </header>
                <ul class="ai-devices" aria-label="Funciona a Android, iPhone i iPad, Windows, Chromebook i Mac">
                    ${DEVICES.map(
                        device =>
                            `<li class="ai-chip${device === mine ? ' is-mine' : ''}">${ICONS[device.icon]}<span>${escapeHtml(
                                device.name
                            )}</span></li>`
                    ).join('')}
                </ul>
                <div class="ai-body">
                    ${canPrompt ? `<button class="ai-now" type="button" data-ai-now>${ICONS.download}<span>Instal·la ara</span></button>` : ''}
                    ${mineHtml}
                    <details class="ai-others"${mine ? '' : ' open'}>
                        <summary>${mine ? 'Altres aparells' : 'Tria el teu aparell'}</summary>
                        <ul class="ai-other-list">${othersHtml}</ul>
                    </details>
                </div>
                <footer class="ai-foot">
                    <button class="ai-share" type="button" data-ai-share>${ICONS.share}<span>Comparteix l'app</span></button>
                    <p class="ai-foot__note">Si ja la tens instal·lada, obre-la des de la icona de Segueix Música.</p>
                </footer>
            </div>`;
    }

    // ---------- DOM ----------
    function $(id) {
        return window.document?.getElementById(id) || null;
    }

    function toast(message) {
        app.features.shellNav?.toast?.(message);
    }

    function appUrl() {
        const base = app.utils.appBasePath?.() || '/';
        try {
            return new URL(base, window.location.href).href;
        } catch (error) {
            return 'https://segueix.github.io/musica/';
        }
    }

    // Ja instal·lada (o oberta com a app): «Instal·la l'app» no cal, però «Comparteix» sí, amb el seu text.
    function syncButton() {
        const wrap = $('ptInstall');
        if (!wrap) return;
        const installed = state.installed || isStandalone();
        wrap.hidden = false;
        wrap.classList.toggle('is-installed', installed);
        const install = $('ptInstallBtn');
        if (install) install.hidden = installed;
        wrap.classList.toggle('is-direct', Boolean(state.prompt));
    }

    // Finestra d'instal·lació del navegador. true = acceptada, false = rebutjada, null = no n'hi ha.
    async function promptInstall() {
        const event = state.prompt;
        if (!event) return null;
        state.prompt = null;
        syncButton();
        try {
            await event.prompt();
            const choice = await event.userChoice;
            if (choice?.outcome === 'accepted') {
                toast("S'està instal·lant Segueix Música");
                return true;
            }
            return false;
        } catch (error) {
            return null;
        }
    }

    async function onInstallClick() {
        const result = await promptInstall();
        if (result === null) openDialog();
    }

    async function shareApp() {
        const url = appUrl();
        const nav = window.navigator || {};
        if (typeof nav.share === 'function') {
            try {
                await nav.share({
                    title: 'Segueix Música',
                    text: "Música en català: instal·la Segueix Música com una app al mòbil o a l'ordinador.",
                    url,
                });
                return;
            } catch (error) {
                if (error?.name === 'AbortError') return;
            }
        }
        try {
            await nav.clipboard.writeText(url);
            toast("Enllaç de l'app copiat");
        } catch (error) {
            toast(url);
        }
    }

    function onDialogKey(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeDialog();
            return;
        }
        if (event.key !== 'Tab' || !state.dialog) return;
        const focusables = [...state.dialog.querySelectorAll('button, summary, [href]')].filter(
            element => element.offsetParent !== null
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && window.document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && window.document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function openDialog() {
        const document = window.document;
        if (!document?.body) return;
        closeDialog({ restoreFocus: false });
        const { os, browser } = detectDevice(window.navigator);
        const overlay = document.createElement('div');
        overlay.className = 'ai-overlay';
        overlay.id = 'appInstallDialog';
        overlay.innerHTML = dialogHtml({ os, browser, canPrompt: Boolean(state.prompt) });
        overlay.addEventListener('click', async event => {
            if (event.target === overlay || event.target.closest('[data-ai-close]')) {
                closeDialog();
                return;
            }
            if (event.target.closest('[data-ai-now]')) {
                const accepted = await promptInstall();
                if (accepted !== false) closeDialog();
                return;
            }
            if (event.target.closest('[data-ai-share]')) shareApp();
        });
        overlay.addEventListener('keydown', onDialogKey);
        state.lastFocus = document.activeElement;
        state.dialog = overlay;
        document.body.appendChild(overlay);
        document.body.classList.add('ai-open');
        window.requestAnimationFrame?.(() => overlay.classList.add('is-open'));
        overlay.querySelector('[data-ai-now], [data-ai-close]')?.focus();
    }

    function closeDialog({ restoreFocus = true } = {}) {
        const overlay = state.dialog;
        if (!overlay) return;
        state.dialog = null;
        overlay.remove();
        window.document?.body?.classList.remove('ai-open');
        if (restoreFocus) state.lastFocus?.focus?.();
        state.lastFocus = null;
    }

    function init() {
        if (state.bound) {
            syncButton();
            return;
        }
        state.bound = true;
        $('ptInstallBtn')?.addEventListener('click', onInstallClick);
        $('ptInstallShare')?.addEventListener('click', shareApp);
        try {
            window.matchMedia?.('(display-mode: standalone)')?.addEventListener?.('change', syncButton);
        } catch (error) {
            // navegadors antics
        }
        syncButton();
    }

    // El navegador pot oferir la instal·lació abans que app.js cridi init(): es guarda des del primer moment.
    if (typeof window.addEventListener === 'function') {
        window.addEventListener('beforeinstallprompt', event => {
            event.preventDefault();
            state.prompt = event;
            syncButton();
        });
        window.addEventListener('appinstalled', () => {
            state.prompt = null;
            state.installed = true;
            closeDialog();
            syncButton();
            toast('Segueix Música ja és instal·lada');
        });
    }

    app.features.appInstall = {
        init,
        openDialog,
        closeDialog,
        shareApp,
        detectDevice,
        deviceRow,
        stepsFor,
        isStandalone,
        dialogHtml,
        DEVICES,
    };
})(window);
