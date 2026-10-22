// Llista d'èxits setmanal (2026-10-22): secció d'Inici, després d'«Acabades de sortir». Les dades les fa cada
// divendres scripts/generar_llista_exits.js (data/llista-exits.json): les cançons en català que més visualitzacions
// han guanyat a YouTube aquella setmana. Model i HTML purs; la secció es pinta buida i s'omple quan arriben les dades
// (com la targeta d'«A prop teu»). Detall: docs/LLISTA_EXITS.md.
(function (window) {
    const app = window.SegueixApp;
    if (!app?.features) return;

    const DATA_URL = 'data/llista-exits.json';
    const VISIBLE = 10;
    const QUEUE_LABEL = "Llista d'èxits";
    const MONTHS = [
        'gener',
        'febrer',
        'març',
        'abril',
        'maig',
        'juny',
        'juliol',
        'agost',
        'setembre',
        'octubre',
        'novembre',
        'desembre',
    ];
    const ICONS = {
        play: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 5.6v12.8a1 1 0 0 0 1.5.86l10.4-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6Z"/></svg>',
        up: '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 2 11 9H1z"/></svg>',
        down: '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 10 1 3h10z"/></svg>',
        trophy: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3"/></svg>',
    };

    const state = { chart: null, loading: null, failed: false, expanded: false, infoOpen: false };
    const INFO_TEXT = [
        'Cada divendres comparem les visualitzacions de YouTube de les cançons de Segueix amb les de la setmana anterior: puja qui n’ha guanyat més.',
        'El videoclip i la pista d’àudio d’una mateixa cançó sumen junts, cada artista hi pot tenir tres cançons com a màxim i la música infantil no hi entra.',
    ];

    // ---------- Utilitats pures ----------

    const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ESCAPES[char]);

    function parseDay(value) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
        return match ? { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) } : null;
    }

    const monthOf = month => (/^[aeiou]/.test(MONTHS[month]) ? `d'${MONTHS[month]}` : `de ${MONTHS[month]}`);

    // «Del 15 al 22 d'octubre», «Del 29 de setembre al 6 d'octubre», «De l'1 a l'8 de novembre».
    function periodLabel(from, to) {
        const a = parseDay(from);
        const b = parseDay(to);
        if (!a || !b) return '';
        const article = day => (day === 1 || day === 11 ? "l'" : 'el ');
        const start = `${article(a.day) === "l'" ? "De l'" : 'Del '}${a.day}`;
        const end = `${article(b.day) === "l'" ? "a l'" : 'al '}${b.day}`;
        const sameMonth = a.month === b.month && a.year === b.year;
        return sameMonth
            ? `${start} ${end} ${monthOf(b.month)}`
            : `${start} ${monthOf(a.month)} ${end} ${monthOf(b.month)}`;
    }

    // «+950», «+12,3 k», «+150 k», «+1,2 M».
    function growthLabel(value) {
        const n = Math.max(0, Math.round(Number(value) || 0));
        const decimal = number => number.toFixed(1).replace(/\.0$/, '').replace('.', ',');
        if (n < 1000) return `+${n}`;
        if (n < 1e6) return `+${n < 100000 ? decimal(n / 1000) : Math.round(n / 1000)} k`;
        return `+${decimal(n / 1e6)} M`;
    }

    function movement(entry, first) {
        if (first) return null;
        const steps = Math.abs((Number(entry.previous) || 0) - Number(entry.rank));
        switch (entry.status) {
            case 'new':
                return { kind: 'new', text: 'Nova', label: 'Nova a la llista' };
            case 'back':
                return { kind: 'back', text: 'Torna', label: 'Torna a la llista' };
            case 'up':
                return { kind: 'up', text: String(steps), label: `Puja ${steps} ${steps === 1 ? 'lloc' : 'llocs'}` };
            case 'down':
                return { kind: 'down', text: String(steps), label: `Baixa ${steps} ${steps === 1 ? 'lloc' : 'llocs'}` };
            default:
                return { kind: 'same', text: '=', label: 'Es manté' };
        }
    }

    // Model de la secció: entrades vàlides (sense artistes amagats), període i moviments.
    function buildModel(chart, { hiddenChannels = [] } = {}) {
        const hidden = new Set((hiddenChannels || []).map(String));
        const entries = (Array.isArray(chart?.entries) ? chart.entries : [])
            .filter(entry => entry?.video?.id && !hidden.has(String(entry.video.channelId)))
            .map(entry => ({ ...entry, move: movement(entry, chart.first === true) }));
        if (!entries.length) return null;
        return { period: periodLabel(chart.from, chart.to), entries, first: chart.first === true };
    }

    function coverUrl(video) {
        return /^[A-Za-z0-9_-]{11}$/.test(String(video?.id || ''))
            ? `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`
            : String(video?.thumbnail || '');
    }

    function rowHtml(entry, index) {
        const video = entry.video;
        const move = entry.move;
        const moveHtml = move
            ? `<span class="hc-move hc-move--${move.kind}" title="${esc(move.label)}">${move.kind === 'up' ? ICONS.up : move.kind === 'down' ? ICONS.down : ''}<span aria-hidden="true">${esc(move.text)}</span></span>`
            : '';
        const weeks = Number(entry.weeks) > 1 ? ` · ${entry.weeks} setmanes` : '';
        const label = `Escolta la número ${entry.rank}: ${video.title}, de ${video.channelTitle}. ${growthLabel(entry.growth)} visualitzacions aquesta setmana${move ? `. ${move.label}` : ''}`;
        return `<li class="hc-row hc-row--${move?.kind || 'plain'}${entry.rank <= 3 ? ' is-top' : ''}">
            <button type="button" class="hc-row__btn" data-hc-play="${index}" aria-label="${esc(label)}">
                <span class="hc-row__rank"><span class="hc-row__num">${entry.rank}</span>${moveHtml}</span>
                <img class="hc-row__cover" src="${esc(coverUrl(video))}" alt="" loading="lazy" decoding="async" width="56" height="56">
                <span class="hc-row__text">
                    <span class="hc-row__title">${esc(video.title)}</span>
                    <span class="hc-row__artist">${esc(video.channelTitle)}${esc(weeks)}</span>
                </span>
                <span class="hc-row__growth" title="Visualitzacions guanyades aquesta setmana">${esc(growthLabel(entry.growth))}</span>
            </button>
        </li>`;
    }

    function sectionHtml(model, { expanded = false } = {}) {
        const shown = expanded ? model.entries : model.entries.slice(0, VISIBLE);
        const more =
            model.entries.length > VISIBLE
                ? `<button type="button" class="pt-btn pt-btn--ghost pt-btn--sm hc__more" data-hc-more aria-expanded="${expanded}">${expanded ? "Mostra'n menys" : `Mostra les ${model.entries.length}`}</button>`
                : '';
        return `<section class="pt-section hc" aria-labelledby="ptH-chart" data-pt-section="chart">
            <header class="pt-head">
                <div class="pt-head__text">
                    <p class="hc__eyebrow">${ICONS.trophy}<span>${esc(model.period ? `Setmana ${model.period.charAt(0).toLowerCase()}${model.period.slice(1)}` : 'Aquesta setmana')}</span></p>
                    <div class="hc__title-row">
                        <h2 class="pt-head__title" id="ptH-chart">Llista d'èxits</h2>
                        <button type="button" class="hc__info" data-hc-info aria-expanded="false" aria-controls="hcInfo" aria-label="Com es fa la llista d'èxits"><span aria-hidden="true">i</span></button>
                        <div class="hc__pop" id="hcInfo" role="dialog" aria-labelledby="hcInfoTitle" tabindex="-1" hidden>
                            <div class="hc__pop-head">
                                <p class="hc__pop-title" id="hcInfoTitle">Com es fa</p>
                                <button type="button" class="hc__pop-close" data-hc-info-close aria-label="Tanca">×</button>
                            </div>
                            ${INFO_TEXT.map(text => `<p>${esc(text)}</p>`).join('')}
                        </div>
                    </div>
                    <p class="pt-head__sub">Les cançons en català que més visualitzacions han guanyat aquesta setmana a YouTube.</p>
                </div>
                <div class="pt-head__tools">
                    <button type="button" class="pt-tool pt-tool--play" data-hc-play-all aria-label="Escolta la llista d'èxits">${ICONS.play}<span>Escolta-la</span></button>
                </div>
            </header>
            <ol class="hc__list" style="--hc-rows: ${Math.ceil(shown.length / 2)}">
                ${shown.map((entry, index) => rowHtml(entry, index)).join('')}
            </ol>
            ${more ? `<div class="hc__foot">${more}</div>` : ''}
        </section>`;
    }

    // ---------- Dades i DOM ----------

    function hiddenChannels() {
        try {
            return typeof getHiddenChannelIds === 'function' ? getHiddenChannelIds() : [];
        } catch {
            return [];
        }
    }

    function currentModel() {
        return state.chart ? buildModel(state.chart, { hiddenChannels: hiddenChannels() }) : null;
    }

    async function load() {
        if (state.chart || state.failed) return state.chart;
        if (typeof fetch !== 'function') {
            state.failed = true;
            return null;
        }
        if (!state.loading) {
            state.loading = fetch(DATA_URL)
                .then(response => (response.ok ? response.json() : null))
                .then(chart => {
                    state.chart = chart && Array.isArray(chart.entries) ? chart : null;
                    state.failed = !state.chart;
                    return state.chart;
                })
                .catch(() => {
                    state.failed = true;
                    return null;
                })
                .finally(() => {
                    state.loading = null;
                });
        }
        return state.loading;
    }

    function placeholder() {
        return '<section class="pt-section hc is-empty" data-pt-section="chart" hidden></section>';
    }

    // Pintada de la portada: la secció si ja hi ha dades; si no, un espai buit que s'omple en arribar.
    function cardHtml() {
        // Una pintada nova de la portada porta el quadre «Com es fa» tancat
        state.infoOpen = false;
        const model = currentModel();
        if (model) return sectionHtml(model, { expanded: state.expanded });
        if (!state.failed && typeof setTimeout === 'function') setTimeout(hydrate, 0);
        return placeholder();
    }

    function replaceSection(html) {
        const old = window.document?.querySelector?.('[data-pt-section="chart"]');
        if (!old) return false;
        const template = window.document.createElement('template');
        template.innerHTML = html.trim();
        const next = template.content.firstElementChild;
        if (!next) return false;
        old.replaceWith(next);
        return true;
    }

    function hydrate() {
        load().then(() => {
            const model = currentModel();
            state.infoOpen = false;
            if (model) replaceSection(sectionHtml(model, { expanded: state.expanded }));
        });
    }

    // La versió del feed de l'app si hi és (amb el títol i l'artista decorats); si no, la de la llista.
    function resolveVideo(video) {
        const id = String(video?.id || '');
        try {
            const pools = [
                typeof currentFeedVideos !== 'undefined' ? currentFeedVideos : [],
                typeof cachedAPIVideos !== 'undefined' ? cachedAPIVideos : [],
            ];
            for (const pool of pools) {
                const found = Array.isArray(pool) ? pool.find(item => String(item?.id) === id) : null;
                if (found) return found;
            }
        } catch {
            /* sense feed: la de la llista */
        }
        return video;
    }

    function play(index = 0) {
        const model = currentModel();
        const queue = app.features.musicQueue;
        if (!model || !queue?.playSelection) return false;
        const videos = model.entries.slice(Math.max(0, index)).map(entry => resolveVideo(entry.video));
        const ok = queue.playSelection(videos, QUEUE_LABEL);
        if (!ok) app.features.shellNav?.toast?.('No s’ha pogut engegar la llista ara mateix.');
        return ok;
    }

    // Quadre flotant «Com es fa»: s'obre i es tanca amb el botó «i», la ×, Esc o un clic fora.
    function setInfo(open, { focus = true } = {}) {
        const doc = window.document;
        const pop = doc?.getElementById?.('hcInfo');
        const button = doc?.querySelector?.('[data-hc-info]');
        if (!pop || !button) return false;
        state.infoOpen = Boolean(open);
        pop.hidden = !state.infoOpen;
        button.setAttribute('aria-expanded', String(state.infoOpen));
        if (focus) (state.infoOpen ? pop : button).focus?.({ preventScroll: true });
        return true;
    }

    function onClick(event) {
        const target = event.target;
        if (state.infoOpen && !target?.closest?.('#hcInfo, [data-hc-info]')) setInfo(false, { focus: false });
        if (!target?.closest?.('[data-pt-section="chart"]')) return;
        if (target.closest('[data-hc-info]')) {
            event.preventDefault();
            setInfo(!state.infoOpen);
            return;
        }
        if (target.closest('[data-hc-info-close]')) {
            event.preventDefault();
            setInfo(false);
            return;
        }
        const row = target.closest('[data-hc-play]');
        if (row) {
            event.preventDefault();
            play(Number(row.dataset.hcPlay) || 0);
            return;
        }
        if (target.closest('[data-hc-play-all]')) {
            event.preventDefault();
            play(0);
            return;
        }
        if (target.closest('[data-hc-more]')) {
            event.preventDefault();
            state.expanded = !state.expanded;
            state.infoOpen = false;
            const model = currentModel();
            if (model) replaceSection(sectionHtml(model, { expanded: state.expanded }));
            window.document.querySelector('[data-hc-more]')?.focus?.({ preventScroll: true });
        }
    }

    function onKeydown(event) {
        if (event.key === 'Escape' && state.infoOpen) setInfo(false);
    }

    if (typeof window.document?.addEventListener === 'function') {
        window.document.addEventListener('click', onClick);
        window.document.addEventListener('keydown', onKeydown);
    }

    app.features.hitsChart = {
        periodLabel,
        growthLabel,
        movement,
        buildModel,
        sectionHtml,
        cardHtml,
        load,
        play,
    };
})(window);
