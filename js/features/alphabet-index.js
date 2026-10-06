// Índex alfabètic de la pàgina d'artistes (#followPage): una columna de lletres a la dreta de la llista.
//  - Tocar una lletra, o arrossegar-hi el dit, porta als artistes que comencen per aquella lletra; mentre s'arrossega,
//    les lletres del costat del dit es fan grans (efecte lupa) i una bombolla mostra la lletra.
//  - En fer scroll per la llista, la lletra dels artistes que es veuen a dalt es fa gran (i les veïnes, una mica).
// Implementació directa (patró 2). Les funcions pures (letterOf, scaleFor, indexFromOffset) es proven a
// tests/alphabet-index.test.js. La crida renderFollowPage() (app.js) després de pintar les targetes.
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;

    const LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
    // Mida de cada lletra segons la distància a la lletra activa (0 = l'activa).
    const SCALES = [2, 1.5, 1.2];
    const MIN_LETTERS = 3;

    // ---------- Funcions pures ----------

    // El nom visible es conserva; només ignorem l'article català inicial per ordenar i indexar.
    function sortKey(name) {
        const fullName = String(name ?? '')
            .trim()
            .replace(/^[^\p{L}\p{N}]+/u, '');
        return fullName.replace(/^(?:(?:el|els|la|les)\s+|l['’ʼ]\s*)/iu, '').trim() || fullName;
    }

    // Inicial d'un nom per a l'índex: sense article ni accents; números i símbols → «#».
    function letterOf(name) {
        const first = sortKey(name)
            .charAt(0)
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .toUpperCase();
        return /^[A-Z]$/.test(first) ? first : '#';
    }

    function compareNames(a, b) {
        const group = LETTERS.indexOf(letterOf(a)) - LETTERS.indexOf(letterOf(b));
        return (
            group ||
            sortKey(a).localeCompare(sortKey(b), 'ca', { sensitivity: 'base' }) ||
            String(a ?? '').localeCompare(String(b ?? ''), 'ca', { sensitivity: 'base' })
        );
    }

    // Escala d'una lletra a `distance` posicions de l'activa (lluny: 1).
    function scaleFor(distance) {
        const d = Math.abs(Number(distance));
        return Number.isFinite(d) && d < SCALES.length ? SCALES[d] : 1;
    }

    // Lletra sota el dit: posició vertical dins de la columna → índex (sempre dins de la llista).
    function indexFromOffset(offset, height, count) {
        if (!(height > 0) || !(count > 0)) return 0;
        const index = Math.floor((Number(offset) / height) * count);
        return Math.min(count - 1, Math.max(0, index));
    }

    // ---------- DOM ----------

    const state = {
        grid: null,
        nav: null,
        bubble: null,
        firstCardOf: new Map(),
        active: '',
        dragging: false,
        raf: 0,
        bound: false,
    };

    const prefersReducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

    function headerOffset() {
        const header = window.document.querySelector('.app-header');
        return (header ? header.getBoundingClientRect().height : 0) + 8;
    }

    function letterButtons() {
        return state.nav ? Array.from(state.nav.querySelectorAll('.az-index__letter')) : [];
    }

    // Engrandeix la lletra `letter` i les veïnes (només les que tenen artistes compten com a veïnes visibles).
    function highlight(letter) {
        const buttons = letterButtons();
        const center = LETTERS.indexOf(letter);
        buttons.forEach((button, index) => {
            const scale = center < 0 ? 1 : scaleFor(index - center);
            button.style.setProperty('--az-scale', String(scale));
            button.classList.toggle('is-active', index === center);
        });
        state.active = letter;
    }

    function showBubble(letter) {
        if (!state.bubble) return;
        state.bubble.textContent = letter;
        state.bubble.hidden = false;
    }

    function hideBubble() {
        if (state.bubble) state.bubble.hidden = true;
    }

    // Porta a la primera targeta de la lletra (o de la següent que en tingui).
    function jumpTo(letter) {
        let index = LETTERS.indexOf(letter);
        let card = null;
        while (index >= 0 && index < LETTERS.length && !card) {
            card = state.firstCardOf.get(LETTERS[index]) || null;
            index += 1;
        }
        if (!card) return false;
        const top = card.getBoundingClientRect().top + window.scrollY - headerOffset();
        window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
        return true;
    }

    // Lletra dels artistes que es veuen a dalt de tot de la llista.
    function letterInView() {
        const limit = headerOffset() + 12;
        let current = '';
        for (const card of state.grid?.querySelectorAll?.('.follow-card[data-letter]') || []) {
            // La primera targeta que es veu almenys a mitges (no la de dalt que només en treu un tros)
            const rect = card.getBoundingClientRect();
            if (rect.top + rect.height / 2 > limit) {
                current = card.dataset.letter;
                break;
            }
        }
        return current;
    }

    function onScroll() {
        if (state.dragging || state.raf || !state.nav || state.nav.hidden) return;
        state.raf = window.requestAnimationFrame(() => {
            state.raf = 0;
            const letter = letterInView();
            if (letter && letter !== state.active) highlight(letter);
        });
    }

    function letterAtPointer(event) {
        const list = state.nav.querySelector('.az-index__letters');
        const rect = list.getBoundingClientRect();
        return LETTERS[indexFromOffset(event.clientY - rect.top, rect.height, LETTERS.length)];
    }

    function follow(event) {
        const letter = letterAtPointer(event);
        if (letter === state.active && state.dragging) return;
        highlight(letter);
        showBubble(letter);
        jumpTo(letter);
    }

    function onPointerDown(event) {
        if (event.button !== undefined && event.button !== 0) return;
        event.preventDefault();
        state.dragging = true;
        state.nav.classList.add('is-dragging');
        state.nav.setPointerCapture?.(event.pointerId);
        follow(event);
    }

    function onPointerMove(event) {
        if (!state.dragging) return;
        event.preventDefault();
        follow(event);
    }

    function onPointerUp() {
        if (!state.dragging) return;
        state.dragging = false;
        state.nav.classList.remove('is-dragging');
        window.setTimeout(hideBubble, prefersReducedMotion() ? 0 : 350);
    }

    // Teclat: Intro/espai en una lletra porta als seus artistes.
    function onClick(event) {
        const button = event.target.closest?.('.az-index__letter');
        if (!button || event.detail > 0) return;
        highlight(button.dataset.letter);
        jumpTo(button.dataset.letter);
    }

    function build(container) {
        const nav = window.document.createElement('nav');
        nav.className = 'az-index';
        nav.id = 'artistsAzIndex';
        nav.setAttribute('aria-label', 'Índex alfabètic dels artistes');
        nav.innerHTML = `
            <ol class="az-index__letters">${LETTERS.map(
                letter =>
                    `<li><button type="button" class="az-index__letter" data-letter="${letter}" aria-label="${letter === '#' ? 'Artistes que comencen per un número o un símbol' : `Artistes per la ${letter}`}">${letter}</button></li>`
            ).join('')}</ol>
            <span class="az-index__bubble" aria-hidden="true" hidden></span>`;
        container.appendChild(nav);
        nav.addEventListener('pointerdown', onPointerDown);
        nav.addEventListener('pointermove', onPointerMove);
        nav.addEventListener('pointerup', onPointerUp);
        nav.addEventListener('pointercancel', onPointerUp);
        nav.addEventListener('lostpointercapture', onPointerUp);
        nav.addEventListener('click', onClick);
        state.nav = nav;
        state.bubble = nav.querySelector('.az-index__bubble');
    }

    // Després de pintar la llista: marca la lletra de cada targeta i actualitza l'índex.
    function attach(grid) {
        if (!grid) return;
        state.grid = grid;
        // A <body>: un contenidor pare amb transformació faria que «position: fixed» es mogués amb la pàgina.
        // Fora de la pàgina d'artistes l'amaga el CSS (body:has(#followPage.hidden)).
        if (!state.nav || !state.nav.isConnected) build(window.document.body);
        state.firstCardOf = new Map();
        grid.querySelectorAll('.follow-card').forEach(card => {
            const name = card.querySelector('.follow-name')?.textContent || '';
            const letter = letterOf(name);
            card.dataset.letter = letter;
            if (!state.firstCardOf.has(letter)) state.firstCardOf.set(letter, card);
        });
        letterButtons().forEach(button => {
            const has = state.firstCardOf.has(button.dataset.letter);
            button.disabled = !has;
            button.classList.toggle('is-empty', !has);
        });
        const enough = state.firstCardOf.size >= MIN_LETTERS;
        state.nav.hidden = !enough;
        grid.classList.toggle('has-az-index', enough);
        state.active = '';
        if (enough) highlight(letterInView() || [...state.firstCardOf.keys()][0]);
        if (!state.bound) {
            state.bound = true;
            window.addEventListener('scroll', onScroll, { passive: true });
            window.addEventListener('resize', onScroll, { passive: true });
        }
    }

    function detach() {
        if (state.nav) state.nav.hidden = true;
        state.grid?.classList.remove('has-az-index');
    }

    app.features.alphabetIndex = {
        LETTERS, sortKey, compareNames, letterOf, scaleFor, indexFromOffset, attach, detach, highlight, jumpTo,
    };
})(window);
