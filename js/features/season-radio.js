// Ràdios de temporada (2026-10-24): a Inici, al davant del bloc «ara mateix», la targeta de la ràdio de l'època de
// l'any («Ràdio de tardor» del 23 de setembre al 30 de novembre; més endavant, la de Nadal). Les cançons les tria a
// mà data/radios-temporada.json (scripts/generar_radios_temporada.js hi posa les dades de cada vídeo). En tocar
// «Engega la ràdio» sona una ràdio tancada amb aquelles cançons (`musicQueue.startCategoryRadio`, com la d'una
// categoria pròpia): el motor les ordena, «Barreja» es queda dins seu i no s'acaba mai. Model i HTML purs; la secció
// es pinta buida i s'omple quan arriben les dades (com la «Llista d'èxits»). Detall: docs/RADIOS_TEMPORADA.md.
(function (window) {
    const app = window.SegueixApp;
    if (!app?.features) return;

    const DATA_URL = 'data/radios-temporada.json';
    const TIME_ZONE = 'Europe/Madrid';
    const COVERS = 4;
    const ICONS = {
        play: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 5.6v12.8a1 1 0 0 0 1.5.86l10.4-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6Z"/></svg>',
        leaf: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>',
    };
    const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ESCAPES[char]);

    const state = { data: null, loading: null, failed: false };

    // ---------- Utilitats pures ----------

    // Dia de l'any a Madrid com a «MM-DD».
    function monthDay(now = Date.now()) {
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, month: '2-digit', day: '2-digit' })
            .formatToParts(new Date(now))
            .reduce((out, part) => ({ ...out, [part.type]: part.value }), {});
        return `${parts.month}-${parts.day}`;
    }

    // `from` i `to` en «MM-DD»; un període pot passar de l'any (Nadal: del 12-01 al 01-06).
    function inSeason(radio, now = Date.now()) {
        const from = String(radio?.from || '');
        const to = String(radio?.to || '');
        if (!/^\d{2}-\d{2}$/.test(from) || !/^\d{2}-\d{2}$/.test(to)) return false;
        const today = monthDay(now);
        return from <= to ? today >= from && today <= to : today >= from || today <= to;
    }

    function activeRadio(data, now = Date.now()) {
        return (Array.isArray(data?.radios) ? data.radios : []).find(
            radio => inSeason(radio, now) && Array.isArray(radio.videos) && radio.videos.length >= 2
        );
    }

    // Les cançons que es poden fer sonar (sense els artistes amagats) i les caràtules del fons: les més escoltades,
    // d'artistes diferents.
    function buildModel(radio, { hiddenChannels = [] } = {}) {
        if (!radio) return null;
        const hidden = new Set(hiddenChannels.map(String));
        const videos = (radio.videos || []).filter(video => video?.id && !hidden.has(String(video.channelId)));
        if (videos.length < 2) return null;
        const artists = new Set(videos.map(video => String(video.channelId)));
        const covers = [];
        const used = new Set();
        for (const video of [...videos].sort((a, b) => (Number(b.viewCount) || 0) - (Number(a.viewCount) || 0))) {
            if (used.has(String(video.channelId))) continue;
            used.add(String(video.channelId));
            // hqdefault sempre hi és (maxresdefault no: hi sortia un forat negre)
            covers.push(`https://i.ytimg.com/vi/${encodeURIComponent(video.id)}/hqdefault.jpg`);
            if (covers.length === COVERS) break;
        }
        return {
            id: String(radio.id || ''),
            name: String(radio.name || 'Ràdio de temporada'),
            // Nom curt de l'època («Tardor»): el de la llista a YouTube i el de l'origen de la ràdio
            short: String(radio.short || radio.name || ''),
            eyebrow: String(radio.eyebrow || 'Ràdio de temporada'),
            text: String(radio.text || ''),
            count: videos.length,
            artists: artists.size,
            covers,
            videos,
        };
    }

    function sectionHtml(model) {
        if (!model) return placeholder();
        const titleId = `ptH-season-${esc(model.id)}`;
        return `<section class="pt-section pt-season" data-pt-section="season" data-season="${esc(model.id)}" aria-labelledby="${titleId}">
            <ul class="pt-season__covers" aria-hidden="true">
                ${model.covers.map(src => `<li><img src="${esc(src)}" alt="" loading="lazy" decoding="async" width="480" height="360"></li>`).join('')}
            </ul>
            <div class="pt-season__body">
                <p class="pt-eyebrow pt-season__eyebrow">${ICONS.leaf}<span>${esc(model.eyebrow)}</span></p>
                <h2 class="pt-season__title" id="${titleId}">${esc(model.name)}</h2>
                ${model.text ? `<p class="pt-season__text">${esc(model.text)}</p>` : ''}
                <p class="pt-season__count">${model.count} cançons · ${model.artists} artistes</p>
                <div class="pt-season__actions">
                    <button type="button" class="pt-btn pt-btn--primary" data-season-play="${esc(model.id)}">${ICONS.play}<span>Engega la ràdio</span></button>
                </div>
            </div>
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

    function currentModel(now = Date.now()) {
        return state.data ? buildModel(activeRadio(state.data, now), { hiddenChannels: hiddenChannels() }) : null;
    }

    async function load() {
        if (state.data || state.failed) return state.data;
        if (typeof fetch !== 'function') {
            state.failed = true;
            return null;
        }
        if (!state.loading) {
            state.loading = fetch(DATA_URL)
                .then(response => (response.ok ? response.json() : null))
                .then(data => {
                    state.data = data && Array.isArray(data.radios) ? data : null;
                    state.failed = !state.data;
                    return state.data;
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
        return '<section class="pt-section pt-season is-empty" data-pt-section="season" hidden></section>';
    }

    // Pintada de la portada: la targeta si ja hi ha dades; si no, un espai buit que s'omple en arribar. Fora de
    // temporada no hi ha res.
    function cardHtml() {
        if (state.data) return currentModel() ? sectionHtml(currentModel()) : '';
        if (!state.failed && typeof setTimeout === 'function') setTimeout(hydrate, 0);
        return state.failed ? '' : placeholder();
    }

    function hydrate() {
        load().then(() => {
            const old = window.document?.querySelector?.('[data-pt-section="season"]');
            if (!old) return;
            const model = currentModel();
            if (!model) {
                old.remove();
                return;
            }
            const template = window.document.createElement('template');
            template.innerHTML = sectionHtml(model).trim();
            if (template.content.firstElementChild) old.replaceWith(template.content.firstElementChild);
        });
    }

    // La versió del feed de l'app si hi és (amb el títol i l'artista decorats); si no, la de la llista.
    function resolveVideos(videos) {
        let byId = new Map();
        try {
            const pools = [
                typeof currentFeedVideos !== 'undefined' ? currentFeedVideos : [],
                typeof cachedAPIVideos !== 'undefined' ? cachedAPIVideos : [],
            ];
            byId = new Map(
                pools.flatMap(pool => (Array.isArray(pool) ? pool : [])).map(item => [String(item?.id), item])
            );
        } catch {
            /* sense feed: les de la llista */
        }
        const resolved = videos.map(video => byId.get(String(video.id)) || video);
        try {
            if (typeof YouTubeAPI !== 'undefined' && typeof YouTubeAPI.filterHiddenVideos === 'function') {
                return YouTubeAPI.filterHiddenVideos(resolved);
            }
        } catch {
            /* sense filtre: totes */
        }
        return resolved;
    }

    function play(id = '') {
        const model = currentModel();
        const queue = app.features.musicQueue;
        if (!model || (id && id !== model.id) || !queue?.startCategoryRadio) return false;
        const ok = queue.startCategoryRadio(resolveVideos(model.videos), { name: model.short, title: model.name });
        if (!ok) app.features.shellNav?.toast?.('No s’ha pogut engegar la ràdio ara mateix.');
        return ok;
    }

    function onClick(event) {
        const button = event.target?.closest?.('[data-season-play]');
        if (!button) return;
        event.preventDefault();
        play(button.dataset.seasonPlay || '');
    }

    if (typeof window.document?.addEventListener === 'function') {
        window.document.addEventListener('click', onClick);
    }

    app.features.seasonRadio = {
        monthDay,
        inSeason,
        activeRadio,
        buildModel,
        sectionHtml,
        cardHtml,
        load,
        play,
    };
})(window);
