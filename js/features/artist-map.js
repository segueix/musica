// «Música d'arreu»: mapa dels Països Catalans amb els artistes al seu municipi (vista Descobreix).
// Implementació directa (patró 2). El model (buildModel, project) i l'HTML són purs i es proven a
// tests/artist-map.test.js; app.js (syncArtistMap) el mostra només a Descobreix.
//
// Els artistes NO són al mapa de base: es posen cada vegada a partir de data/origens-artistes.json i dels artistes
// que l'app coneix (YouTubeAPI.getArtistGroups()). Quan s'hi validen grups nous (o arriben canals nous al feed),
// surten sols al mapa, sense tornar a generar res. El dibuix (data/mapa-base.json) porta la projecció.
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;

    const URLS = {
        base: 'data/mapa-base.json',
        catalog: 'data/origens-artistes.json',
        references: 'data/proximitat-musical.json',
    };
    const FALLBACK_AVATAR = 'img/icon-192.png';
    const MAX_ZOOM = 6;

    const esc = value =>
        String(value ?? '').replace(
            /[&<>"']/g,
            c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
        );
    const validPoint = p =>
        Number.isFinite(p?.latitude) &&
        Number.isFinite(p?.longitude) &&
        Math.abs(p.latitude) <= 90 &&
        Math.abs(p.longitude) <= 180;

    // ---------- Model (pur) ----------

    // Coordenada → punt de l'SVG del mapa (marc principal o requadre de l'Alguer). null si cau fora del mapa.
    function project(base, point) {
        if (!base?.projection || !validPoint(point)) return null;
        const { lonMin, lonMax, latMin, latMax, kx, scale } = base.projection;
        const { latitude: lat, longitude: lon } = point;
        if (lon >= lonMin && lon <= lonMax && lat >= latMin && lat <= latMax) {
            return { x: (lon - lonMin) * kx * scale, y: (latMax - lat) * scale, frame: 'main' };
        }
        const inset = base.inset;
        if (inset && lon >= inset.lonMin && lon <= inset.lonMax && lat >= inset.latMin && lat <= inset.latMax) {
            return {
                x: inset.x + (lon - inset.lonMin) * kx * scale,
                y: inset.y + (inset.latMax - lat) * scale,
                frame: 'inset',
            };
        }
        return null;
    }

    // Lloc d'un artista: el municipi si té coordenades; una comarca o illa, a la seva capital de referència
    // (data/proximitat-musical.json), marcada com a aproximada.
    function resolvePlace(placeId, catalog, references) {
        const place = catalog?.places?.[placeId] || references?.places?.[placeId];
        if (!place) return null;
        if (validPoint(place.coordinates)) {
            return {
                id: placeId,
                name: place.name,
                territory: place.territory || '',
                coordinates: place.coordinates,
                approximate: false,
            };
        }
        const refId = references?.references?.[placeId]?.placeIds?.[0];
        const ref = refId ? catalog?.places?.[refId] || references?.places?.[refId] : null;
        if (!ref || !validPoint(ref.coordinates)) return null;
        return {
            id: placeId,
            name: place.name,
            territory: place.territory || ref.territory || '',
            coordinates: ref.coordinates,
            approximate: true,
            reference: ref.name,
        };
    }

    // groups: artistes de l'app (id, name, avatar, categories, channelIds). Només surten els artistes validats que
    // l'app té (es poden obrir); un artista amb diversos llocs (origen i vincles) surt a cadascun.
    // options.style: només els artistes d'aquest estil. options.hiddenIds: canals amagats per l'usuari.
    function buildModel({ base, catalog, references, groups = [], style = '', hiddenIds = [] } = {}) {
        const hidden = new Set((Array.isArray(hiddenIds) ? hiddenIds : []).map(String));
        const groupByChannel = new Map();
        (Array.isArray(groups) ? groups : []).forEach(group => {
            const ids = Array.isArray(group?.channelIds) && group.channelIds.length ? group.channelIds : [group?.id];
            ids.filter(Boolean).forEach(id => groupByChannel.set(String(id), group));
        });
        // Artista del catàleg d'orígens → grup de l'app (per qualsevol dels seus canals)
        const groupOfArtist = new Map();
        Object.entries(catalog?.channels || {}).forEach(([channelId, artistId]) => {
            const group = groupByChannel.get(String(channelId));
            if (group && !groupOfArtist.has(artistId)) groupOfArtist.set(artistId, group);
        });

        const points = new Map();
        const outside = new Map();
        const artistIds = new Set();
        const territories = new Map();
        const styles = new Map();
        Object.entries(catalog?.artists || {}).forEach(([artistId, artist]) => {
            if (artist?.status !== 'validated') return;
            const group = groupOfArtist.get(artistId);
            if (!group) return;
            const ids = Array.isArray(group.channelIds) && group.channelIds.length ? group.channelIds : [group.id];
            if (ids.every(id => hidden.has(String(id)))) return;
            const categories = Array.isArray(group.categories) ? group.categories : [];
            categories.forEach(cat => styles.set(cat, (styles.get(cat) || 0) + 1));
            if (style && !categories.includes(style)) return;
            const entry = {
                artistId,
                name: group.name || artist.name,
                channelId: String(group.id),
                avatar: group.avatar || group.thumbnail || '',
                styles: categories,
                relation: artist.relation || 'origin',
            };
            let placed = false;
            (artist.placeIds || []).forEach(placeId => {
                const place = resolvePlace(placeId, catalog, references);
                if (!place) return;
                const at = project(base, place.coordinates);
                if (!at) {
                    const key = place.territory || place.name;
                    if (!outside.has(key)) outside.set(key, { territory: key, artists: [] });
                    if (!outside.get(key).artists.some(a => a.artistId === artistId))
                        outside.get(key).artists.push(entry);
                    placed = true;
                    return;
                }
                if (!points.has(place.id)) points.set(place.id, { ...place, ...at, artists: [] });
                const point = points.get(place.id);
                if (!point.artists.some(a => a.artistId === artistId)) point.artists.push(entry);
                placed = true;
            });
            if (placed) {
                artistIds.add(artistId);
                const territory = resolvePlace(artist.placeIds?.[0], catalog, references)?.territory || '';
                if (territory) territories.set(territory, (territories.get(territory) || 0) + 1);
            }
        });
        const byName = (a, b) => a.name.localeCompare(b.name, 'ca');
        const list = [...points.values()].map(point => ({ ...point, artists: point.artists.sort(byName) }));
        return {
            // Els punts grans primer: els petits queden a sobre i es poden tocar
            points: list.sort((a, b) => b.artists.length - a.artists.length || a.name.localeCompare(b.name, 'ca')),
            outside: [...outside.values()].map(group => ({ ...group, artists: group.artists.sort(byName) })),
            artistCount: artistIds.size,
            placeCount: list.length,
            territories: [...territories.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => ({ name, count })),
            styles: [...styles.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
        };
    }

    // Els gèneres dels artistes van en minúscula («folk i arrel»): al xip, amb majúscula inicial
    const styleLabel = name => String(name).charAt(0).toLocaleUpperCase('ca') + String(name).slice(1);
    const radiusOf = count => Math.round((5 + 3.2 * Math.sqrt(Math.max(1, count))) * 10) / 10;
    const artistsLabel = n => (n === 1 ? '1 artista' : `${n} artistes`);

    function mapSvg(base, model, selectedId = '') {
        const [x0, y0, w, h] = base.viewBox;
        const shapes = base.shapes
            .map(shape => `<path class="am-shape am-shape--${shape.kind}" d="${shape.d}"></path>`)
            .join('');
        const inset = base.inset;
        const insetHtml = inset?.d
            ? `<g class="am-inset"><rect x="${inset.x}" y="${inset.y}" width="${inset.width}" height="${inset.height}" rx="10"></rect>
               <path class="am-shape am-shape--pc" d="${inset.d}"></path>
               <text x="${inset.x + 10}" y="${inset.y + inset.height - 10}">${esc(inset.label)}</text></g>`
            : '';
        const dots = model.points
            .map(point => {
                const label = `${point.name}: ${artistsLabel(point.artists.length)}`;
                return `<g class="am-dot${point.id === selectedId ? ' is-active' : ''}${point.approximate ? ' is-approx' : ''}" data-am-place="${esc(point.id)}"
                    role="button" tabindex="0" aria-label="${esc(label)}">
                    <title>${esc(label)}</title>
                    <circle cx="${Math.round(point.x * 10) / 10}" cy="${Math.round(point.y * 10) / 10}" r="${radiusOf(point.artists.length)}"></circle>
                </g>`;
            })
            .join('');
        return `<svg class="am-svg" viewBox="${x0} ${y0} ${w} ${h}" role="img" aria-label="Mapa dels Països Catalans amb els artistes">
            <g class="am-layer">${shapes}${insetHtml}<g class="am-dots">${dots}</g></g></svg>`;
    }

    function panelHtml(point) {
        if (!point) {
            return `<p class="am-panel__hint">Toca un punt del mapa per veure els artistes d'aquell lloc i escoltar-ne la ràdio.</p>`;
        }
        const where = point.approximate
            ? `${esc(point.territory)} · ubicació aproximada (${esc(point.reference)})`
            : esc(point.territory);
        const artists = point.artists
            .map(
                artist => `<li><button type="button" class="am-artist" data-am-artist="${esc(artist.channelId)}">
                    <img src="${esc(artist.avatar || FALLBACK_AVATAR)}" alt="" loading="lazy" decoding="async" width="40" height="40">
                    <span><strong>${esc(artist.name)}</strong>${artist.relation === 'associated' ? '<small>Vinculat</small>' : ''}</span></button></li>`
            )
            .join('');
        return `<div class="am-panel__head"><div><h3>${esc(point.name)}</h3><p>${where} · ${artistsLabel(point.artists.length)}</p></div>
                <button type="button" class="am-radio" data-am-radio="${esc(point.id)}">Ràdio d'aquí</button></div>
            <ul class="am-artists">${artists}</ul>`;
    }

    function html(base, model, { selectedId = '', style = '' } = {}) {
        const selected = model.points.find(point => point.id === selectedId) || null;
        const territories = model.territories.map(t => `<li><strong>${t.count}</strong> ${esc(t.name)}</li>`).join('');
        const styleChips = [
            `<button type="button" class="am-chip${style ? '' : ' is-active'}" data-am-style="">Tots</button>`,
        ]
            .concat(
                model.styles
                    .slice(0, 10)
                    .map(
                        s =>
                            `<button type="button" class="am-chip${s.name === style ? ' is-active' : ''}" data-am-style="${esc(s.name)}">${esc(styleLabel(s.name))}</button>`
                    )
            )
            .join('');
        const outside = model.outside.length
            ? `<details class="am-outside"><summary>Des de fora (${model.outside.reduce((n, g) => n + g.artists.length, 0)})</summary>
                ${model.outside
                    .map(
                        group =>
                            `<p><strong>${esc(group.territory)}</strong>: ${group.artists
                                .map(
                                    a =>
                                        `<button type="button" class="am-link" data-am-artist="${esc(a.channelId)}">${esc(a.name)}</button>`
                                )
                                .join(', ')}</p>`
                    )
                    .join('')}</details>`
            : '';
        // Alternativa al mapa: la mateixa informació en una llista per territori
        const byTerritory = new Map();
        model.points.forEach(point => {
            if (!byTerritory.has(point.territory)) byTerritory.set(point.territory, []);
            byTerritory.get(point.territory).push(point);
        });
        const list = [...byTerritory.entries()]
            .map(
                ([territory, points]) =>
                    `<h4>${esc(territory)}</h4><ul>${points
                        .sort((a, b) => a.name.localeCompare(b.name, 'ca'))
                        .map(
                            point =>
                                `<li><button type="button" class="am-link" data-am-place="${esc(point.id)}">${esc(point.name)}</button> · ${artistsLabel(point.artists.length)}</li>`
                        )
                        .join('')}</ul>`
            )
            .join('');
        return `
            <div class="am-head">
                <div><p class="pt-eyebrow">Descobreix</p><h2 class="am-title">Música d'arreu</h2>
                <p class="am-sub">${artistsLabel(model.artistCount)} en ${model.placeCount} llocs dels Països Catalans</p></div>
                <ul class="am-territories">${territories}</ul>
            </div>
            <div class="am-styles" role="group" aria-label="Filtra per estil">${styleChips}</div>
            <div class="am-body">
                <div class="am-stage">
                    ${mapSvg(base, model, selectedId)}
                    <div class="am-zoom"><button type="button" data-am-zoom="1" aria-label="Apropa">+</button><button type="button" data-am-zoom="-1" aria-label="Allunya">−</button><button type="button" data-am-zoom="0" aria-label="Mapa sencer">⤢</button></div>
                </div>
                <div class="am-panel" aria-live="polite">${panelHtml(selected)}</div>
            </div>
            ${outside}
            <details class="am-list"><summary>Llista per territoris</summary>${list}</details>`;
    }

    // ---------- DOM ----------

    const state = {
        data: null,
        loading: null,
        container: null,
        selectedId: '',
        style: '',
        model: null,
        view: null,
        bound: false,
    };

    async function json(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    }

    function loadData() {
        if (state.data) return Promise.resolve(state.data);
        if (!state.loading) {
            state.loading = Promise.all([json(URLS.base), json(URLS.catalog), json(URLS.references).catch(() => ({}))])
                .then(([base, catalog, references]) => (state.data = { base, catalog, references }))
                .finally(() => {
                    state.loading = null;
                });
        }
        return state.loading;
    }

    function artistGroups() {
        const youtube = typeof YouTubeAPI !== 'undefined' ? YouTubeAPI : window.YouTubeAPI;
        return youtube?.getArtistGroups?.() || [];
    }

    function hiddenChannels() {
        return typeof getHiddenChannelIds === 'function' ? getHiddenChannelIds() : [];
    }

    function paint() {
        const container = state.container;
        if (!container || !state.data) return;
        state.model = buildModel({
            ...state.data,
            groups: artistGroups(),
            style: state.style,
            hiddenIds: hiddenChannels(),
        });
        if (state.selectedId && !state.model.points.some(p => p.id === state.selectedId)) state.selectedId = '';
        container.innerHTML = html(state.data.base, state.model, { selectedId: state.selectedId, style: state.style });
        state.view = null;
        applyView();
    }

    // Zoom i desplaçament: es canvia el viewBox de l'SVG (sense llibreries)
    function fullView() {
        return [...state.data.base.viewBox];
    }
    function applyView() {
        const svg = state.container?.querySelector('.am-svg');
        if (!svg) return;
        if (!state.view) state.view = fullView();
        const [x, y, w, h] = state.view;
        svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
        const zoom = state.data.base.viewBox[2] / w;
        svg.style.setProperty('--am-zoom', String(zoom));
    }
    function clampView(view) {
        const [bx, by, bw, bh] = state.data.base.viewBox;
        let [x, y, w, h] = view;
        w = Math.min(bw, Math.max(bw / MAX_ZOOM, w));
        h = w * (bh / bw);
        x = Math.min(bx + bw - w, Math.max(bx, x));
        y = Math.min(by + bh - h, Math.max(by, y));
        return [x, y, w, h];
    }
    function zoomBy(factor, cx, cy) {
        const [x, y, w, h] = state.view || fullView();
        const nw = w / factor;
        const nh = h / factor;
        const px = cx ?? x + w / 2;
        const py = cy ?? y + h / 2;
        state.view = clampView([px - ((px - x) * nw) / w, py - ((py - y) * nh) / h, nw, nh]);
        applyView();
    }
    function svgPoint(svg, clientX, clientY) {
        const rect = svg.getBoundingClientRect();
        const [x, y, w, h] = state.view || fullView();
        return [x + ((clientX - rect.left) / rect.width) * w, y + ((clientY - rect.top) / rect.height) * h];
    }

    function selectPlace(id, { focusPanel = false } = {}) {
        state.selectedId = state.selectedId === id ? '' : id;
        const point = state.model?.points.find(p => p.id === state.selectedId) || null;
        state.container
            .querySelectorAll('.am-dot')
            .forEach(dot => dot.classList.toggle('is-active', dot.dataset.amPlace === state.selectedId));
        const panel = state.container.querySelector('.am-panel');
        if (panel) panel.innerHTML = panelHtml(point);
        if (point && focusPanel) panel?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    }

    function openRadio(placeId) {
        const point = state.model?.points.find(p => p.id === placeId);
        if (!point) return;
        const opening = app.features.nearbyRadio?.openPlace?.({
            name: point.approximate ? point.reference : point.name,
            territory: point.territory,
            coordinates: point.coordinates,
        });
        Promise.resolve(opening).then(ok => {
            if (!ok) app.features.shellNav?.toast?.('No s’ha pogut obrir la ràdio d’aquest lloc.');
        });
    }

    function onClick(event) {
        const target = event.target;
        const zoom = target.closest?.('[data-am-zoom]');
        if (zoom) {
            const step = Number(zoom.dataset.amZoom);
            if (step === 0) {
                state.view = null;
                applyView();
            } else zoomBy(step > 0 ? 1.6 : 1 / 1.6);
            return;
        }
        const style = target.closest?.('[data-am-style]');
        if (style) {
            state.style = style.dataset.amStyle || '';
            return paint();
        }
        const radio = target.closest?.('[data-am-radio]');
        if (radio) return openRadio(radio.dataset.amRadio);
        const artist = target.closest?.('[data-am-artist]');
        if (artist) {
            if (typeof openChannelProfile === 'function') openChannelProfile(artist.dataset.amArtist);
            return;
        }
        const place = target.closest?.('[data-am-place]');
        if (place)
            selectPlace(place.dataset.amPlace, {
                focusPanel: !place.closest('svg') ? false : window.innerWidth <= 768,
            });
    }

    function onKey(event) {
        const place = event.target.closest?.('.am-dot[data-am-place]');
        if (place && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            selectPlace(place.dataset.amPlace);
        }
    }

    // Arrossegar per moure el mapa (quan hi ha zoom) i la rodeta del ratolí per apropar
    function bindStage(container) {
        let drag = null;
        container.addEventListener('pointerdown', event => {
            const svg = event.target.closest?.('.am-svg');
            if (!svg || !state.view || state.view[2] >= state.data.base.viewBox[2]) return;
            drag = {
                id: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                view: [...state.view],
                moved: false,
                svg,
            };
        });
        container.addEventListener('pointermove', event => {
            if (!drag || drag.id !== event.pointerId) return;
            const rect = drag.svg.getBoundingClientRect();
            const dx = ((event.clientX - drag.x) / rect.width) * drag.view[2];
            const dy = ((event.clientY - drag.y) / rect.height) * drag.view[3];
            if (Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 6) drag.moved = true;
            if (!drag.moved) return;
            state.view = clampView([drag.view[0] - dx, drag.view[1] - dy, drag.view[2], drag.view[3]]);
            applyView();
        });
        const end = event => {
            if (drag?.moved) {
                // Un arrossegament no és un toc: no s'ha de triar el punt on s'acaba
                const swallow = e => {
                    e.stopPropagation();
                    e.preventDefault();
                };
                container.addEventListener('click', swallow, { capture: true, once: true });
                setTimeout(() => container.removeEventListener('click', swallow, { capture: true }), 0);
            }
            if (!event || drag?.id === event.pointerId) drag = null;
        };
        container.addEventListener('pointerup', end);
        container.addEventListener('pointercancel', end);
        container.addEventListener(
            'wheel',
            event => {
                const svg = event.target.closest?.('.am-svg');
                if (!svg || (!event.ctrlKey && !event.metaKey && Math.abs(event.deltaY) < 1)) return;
                if (!event.ctrlKey && !event.metaKey && !state.view) return; // sense zoom, la rodeta fa scroll de la pàgina
                event.preventDefault();
                const [cx, cy] = svgPoint(svg, event.clientX, event.clientY);
                zoomBy(event.deltaY < 0 ? 1.25 : 1 / 1.25, cx, cy);
            },
            { passive: false }
        );
    }

    async function show(container) {
        if (!container) return;
        state.container = container;
        container.classList.remove('hidden');
        if (!state.bound) {
            state.bound = true;
            container.addEventListener('click', onClick);
            container.addEventListener('keydown', onKey);
            bindStage(container);
        }
        if (!state.data) container.innerHTML = '<p class="am-loading">Carregant el mapa…</p>';
        try {
            await loadData();
            if (container.classList.contains('hidden')) return;
            // Es repinta només si han canviat els artistes de l'app (feed nou, canals amagats): no es perd el zoom
            const signature = `${artistGroups().length}|${hiddenChannels().length}`;
            if (state.signature === signature && container.querySelector('.am-svg')) return;
            state.signature = signature;
            paint();
        } catch (_error) {
            container.innerHTML =
                '<p class="am-loading">No s’ha pogut carregar el mapa. Torna-ho a provar més tard.</p>';
        }
    }

    function hide(container) {
        const target = container || state.container;
        if (target) target.classList.add('hidden');
    }

    app.features.artistMap = { project, resolvePlace, buildModel, html, panelHtml, radiusOf, show, hide };
})(window);
