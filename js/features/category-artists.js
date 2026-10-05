// Artistes d'una categoria: sota la cançó destacada d'un estil (Pop, Rock…) o d'una categoria pròpia hi ha una filera
// amb els perfils dels artistes que hi pertanyen.
//  - Mòbil (≤ 768 px): una sola filera amb scroll lateral.
//  - Ordinador: una filera i, si hi ha més artistes dels que hi caben, un botó per desplegar-los tots.
// Implementació directa (patró 2). El model (buildModel) i l'HTML són purs i es proven a tests/category-artists.test.js;
// app.js (renderVideos) crida render() després de pintar la cançó destacada i hide() quan la vista no és una categoria.
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;

    const FALLBACK_AVATAR = 'img/icon-192.png';
    const DESKTOP_QUERY = '(min-width: 769px)';

    // Estat de la interfície (sobreviu als repintats): el desplegat es recorda entre categories.
    const state = { expanded: false, container: null, bound: false, resizeBound: false, raf: 0 };

    // ---------- Model (pur) ----------

    const lower = value =>
        String(value ?? '')
            .trim()
            .toLowerCase();

    function memberIdsOf(group) {
        const ids = Array.isArray(group?.channelIds) && group.channelIds.length ? group.channelIds : [group?.id];
        return ids.map(id => String(id ?? '')).filter(Boolean);
    }

    // groups: artistes (YouTubeAPI.getArtistGroups(): id, name, avatar, categories, channelIds).
    // options:
    //   category        nom de l'estil (Pop…) o de la categoria pròpia
    //   userChannelIds  ID de canal dels artistes de la categoria pròpia (null = és un estil: es mira `categories`)
    //   hiddenIds       canals amagats per l'usuari
    //   videos          cançons del feed, per ordenar els artistes pel nombre de cançons (opcional)
    //   isSong          decideix si un vídeo és una cançó (per defecte, qualsevol que no sigui un Short)
    //   primaryOf       categoria principal d'un canal (els artistes que són d'aquest estil per sobre)
    function buildModel(groups, options = {}) {
        const category = String(options.category ?? '').trim();
        const wanted = lower(category);
        const userIds = Array.isArray(options.userChannelIds) ? new Set(options.userChannelIds.map(String)) : null;
        const hidden = new Set((Array.isArray(options.hiddenIds) ? options.hiddenIds : []).map(String));
        const isSong = typeof options.isSong === 'function' ? options.isSong : video => !video?.isShort;
        const primaryOf = typeof options.primaryOf === 'function' ? options.primaryOf : () => '';

        const songsByChannel = new Map();
        const hasVideos = Array.isArray(options.videos);
        if (hasVideos) {
            options.videos.forEach(video => {
                const id = String(video?.channelId ?? '');
                if (id && isSong(video)) songsByChannel.set(id, (songsByChannel.get(id) || 0) + 1);
            });
        }

        const seen = new Set();
        const artists = [];
        (Array.isArray(groups) ? groups : []).forEach(group => {
            const ids = memberIdsOf(group);
            if (!ids.length || ids.every(id => hidden.has(id))) return;
            const belongs = userIds
                ? ids.some(id => userIds.has(id))
                : (Array.isArray(group.categories) ? group.categories : []).some(item => lower(item) === wanted);
            if (!belongs) return;
            const id = String(group.id ?? ids[0]);
            if (!id || seen.has(id)) return;
            const count = ids.reduce((total, channelId) => total + (songsByChannel.get(channelId) || 0), 0);
            // Amb la llista de cançons, un artista sense cap cançó no té res a mostrar a la seva fitxa
            if (hasVideos && count === 0) return;
            seen.add(id);
            artists.push({
                id,
                name: String(group.name || group.title || '').trim() || 'Artista',
                avatar: group.avatar || group.thumbnail || '',
                count,
                primary: !userIds && ids.some(channelId => lower(primaryOf(channelId)) === wanted),
            });
        });

        artists.sort(
            (a, b) =>
                Number(b.primary) - Number(a.primary) ||
                b.count - a.count ||
                a.name.localeCompare(b.name, 'ca', { sensitivity: 'base' })
        );
        return { category, artists, total: artists.length };
    }

    // ---------- HTML (pur) ----------

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function toggleLabel(model, expanded) {
        return expanded ? 'Mostra’n menys' : `Mostra’ls tots (${model.total})`;
    }

    function html(model, { expanded = false } = {}) {
        if (!model || !model.artists.length) return '';
        return `
            <div class="ca__head">
                <h2 class="ca__title" id="caTitle">Artistes <span class="ca__count">${model.total}</span></h2>
                <button type="button" class="ca__toggle" data-ca-toggle aria-expanded="${expanded ? 'true' : 'false'}" aria-controls="caList" hidden>${escapeHtml(toggleLabel(model, expanded))}</button>
            </div>
            <div class="ca__list${expanded ? ' is-expanded' : ''}" id="caList" role="list" aria-labelledby="caTitle">
                ${model.artists
                    .map(
                        artist => `
                <button type="button" class="ca__artist" role="listitem" data-ca-artist="${escapeHtml(artist.id)}">
                    <span class="ca__avatar"><img src="${escapeHtml(artist.avatar || FALLBACK_AVATAR)}" alt="" loading="lazy" decoding="async"></span>
                    <span class="ca__name">${escapeHtml(artist.name)}</span>
                </button>`
                    )
                    .join('')}
            </div>`;
    }

    // ---------- DOM ----------

    const isDesktop = () => Boolean(window.matchMedia?.(DESKTOP_QUERY)?.matches);

    function containerEl() {
        return state.container || (state.container = window.document.getElementById('categoryArtists'));
    }

    // Al mòbil la filera es desplaça sola. A l'ordinador la filera plegada fa l'alçada d'una fila d'artistes i el botó
    // només es mostra si n'hi ha més dels que hi caben (o si ja està desplegada, per poder-la plegar).
    function sync() {
        const target = containerEl();
        const list = target?.querySelector('.ca__list');
        const toggle = target?.querySelector('[data-ca-toggle]');
        if (!list || !toggle) return;
        if (!isDesktop()) {
            list.style.removeProperty('--ca-row-h');
            toggle.hidden = true;
            return;
        }
        const first = list.querySelector('.ca__artist');
        if (first) list.style.setProperty('--ca-row-h', `${first.offsetHeight + 4}px`);
        const overflows = list.scrollHeight > list.clientHeight + 2;
        toggle.hidden = !(state.expanded || overflows);
    }

    function scheduleSync() {
        if (state.raf) return;
        const frame = window.requestAnimationFrame || (callback => setTimeout(callback, 16));
        state.raf = frame(() => {
            state.raf = 0;
            sync();
        });
    }

    function setExpanded(value, model) {
        state.expanded = Boolean(value);
        const target = containerEl();
        const list = target?.querySelector('.ca__list');
        const toggle = target?.querySelector('[data-ca-toggle]');
        list?.classList.toggle('is-expanded', state.expanded);
        if (toggle) {
            toggle.setAttribute('aria-expanded', state.expanded ? 'true' : 'false');
            toggle.textContent = toggleLabel(model || { total: list?.children.length || 0 }, state.expanded);
        }
        sync();
    }

    const call = (name, ...args) => (typeof window[name] === 'function' ? window[name](...args) : undefined);

    function bind(target) {
        if (state.bound) return;
        state.bound = true;
        target.addEventListener('click', event => {
            const artist = event.target.closest('[data-ca-artist]');
            if (artist) {
                call('openChannelProfile', artist.dataset.caArtist);
                return;
            }
            if (event.target.closest('[data-ca-toggle]')) {
                const total = target.querySelectorAll('.ca__artist').length;
                setExpanded(!state.expanded, { total });
            }
        });
    }

    function hide() {
        const target = containerEl();
        if (!target) return false;
        target.innerHTML = '';
        target.classList.add('hidden');
        return false;
    }

    // Pinta la filera a #categoryArtists (entre la cançó destacada i la llista). Retorna si hi ha artistes.
    function render(category, options = {}) {
        const target = containerEl();
        if (!target) return false;
        const model = buildModel(options.groups, { ...options, category });
        if (!model.artists.length) return hide();
        target.innerHTML = html(model, { expanded: state.expanded });
        target.classList.remove('hidden');
        target.setAttribute('aria-label', `Artistes de ${category}`);
        bind(target);
        if (!state.resizeBound) {
            state.resizeBound = true;
            window.addEventListener('resize', scheduleSync);
        }
        sync();
        // Les imatges i les tipografies acaben de determinar l'alçada de la fila
        scheduleSync();
        return true;
    }

    app.features.categoryArtists = {
        buildModel,
        html,
        render,
        hide,
        sync,
        state,
    };
})(window);
