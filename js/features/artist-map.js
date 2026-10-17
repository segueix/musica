// «Música d'arreu»: mapa dels llocs on es parla en català amb els artistes al seu municipi (vista Descobreix).
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
        base: 'data/mapa-base.json?v=20261017-alguer-cantonada',
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
            // Si el requadre porta escala i origen propis (x0, y0, scale), es fan servir; si no, la del mapa principal
            const s = inset.scale || scale;
            return {
                x: (inset.x0 ?? inset.x) + (lon - inset.lonMin) * kx * s,
                y: (inset.y0 ?? inset.y) + (inset.latMax - lat) * s,
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
                channelIds: ids.map(String),
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
    const placesLabel = n => (n === 1 ? '1 lloc' : `${n} llocs`);

    // ---------- Zona dibuixada (pur) ----------

    // Raig horitzontal: el punt és dins si travessa un nombre senar de costats del polígon.
    function pointInPolygon([x, y], polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const [xi, yi] = polygon[i];
            const [xj, yj] = polygon[j];
            if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
    }

    // Llocs i artistes (sense repetir) que queden dins la zona; els llocs amb més artistes primer.
    function zoneModel(points, polygon) {
        if (!Array.isArray(polygon) || polygon.length < 3) return null;
        const places = (Array.isArray(points) ? points : []).filter(point =>
            pointInPolygon([point.x, point.y], polygon)
        );
        const artists = new Map();
        places.forEach(place =>
            place.artists.forEach(artist => {
                if (!artists.has(artist.channelId)) artists.set(artist.channelId, { ...artist, place: place.name });
            })
        );
        const sorted = [...places].sort((a, b) => b.artists.length - a.artists.length);
        return {
            polygon,
            places: sorted,
            artists: [...artists.values()].sort((a, b) => a.name.localeCompare(b.name, 'ca')),
            channelIds: [...new Set([...artists.values()].flatMap(a => a.channelIds || [a.channelId]))],
            name: !sorted.length ? '' : sorted.length === 1 ? sorted[0].name : `${sorted[0].name} i voltants`,
        };
    }

    // Cançons de la zona: les més escoltades de cada canal (perArtist), perquè cap artista no s'emporti la ràdio.
    function zoneSongs(videos, channelIds, perArtist = 8) {
        const wanted = new Set((channelIds || []).map(String));
        const byChannel = new Map();
        const seen = new Set();
        (Array.isArray(videos) ? videos : []).forEach(video => {
            const channelId = String(video?.channelId || '');
            if (!wanted.has(channelId) || !video.id || seen.has(video.id)) return;
            seen.add(video.id);
            if (!byChannel.has(channelId)) byChannel.set(channelId, []);
            byChannel.get(channelId).push(video);
        });
        return [...byChannel.values()].flatMap(list =>
            list.sort((a, b) => (Number(b.viewCount) || 0) - (Number(a.viewCount) || 0)).slice(0, perArtist)
        );
    }

    // ---------- Vista (pur): viewBox, zoom i el punt que queda sota el dit ----------

    function clampView(view, baseBox, maxZoom = MAX_ZOOM) {
        const [bx, by, bw, bh] = baseBox;
        let [x, y, w] = view;
        w = Math.min(bw, Math.max(bw / maxZoom, w));
        const h = w * (bh / bw);
        x = Math.min(bx + bw - w, Math.max(bx, x));
        y = Math.min(by + bh - h, Math.max(by, y));
        return [x, y, w, h];
    }
    // L'SVG es dibuixa amb «meet»: pot quedar una franja buida (pantalla completa). rect = mida a la pantalla.
    function fit(rect, w, h) {
        const s = Math.min(rect.width / w, rect.height / h);
        return { s, offX: (rect.width - w * s) / 2, offY: (rect.height - h * s) / 2 };
    }
    function clientToSvg(view, rect, clientX, clientY) {
        const [x, y, w, h] = view;
        const { s, offX, offY } = fit(rect, w, h);
        return [x + (clientX - rect.left - offX) / s, y + (clientY - rect.top - offY) / s];
    }
    // ViewBox d'amplada `width` que deixa el punt `point` de l'SVG sota (clientX, clientY).
    function viewKeeping(point, rect, clientX, clientY, width, baseBox) {
        const h = width * (baseBox[3] / baseBox[2]);
        const { s, offX, offY } = fit(rect, width, h);
        return [point[0] - (clientX - rect.left - offX) / s, point[1] - (clientY - rect.top - offY) / s, width, h];
    }

    // ---------- HTML (pur) ----------

    const ICON = {
        full: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        close: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        erase: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L12 20.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 21h14M5.5 12.5l6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        draw: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 14c-1.5 2.5.5 5 3.5 4.5 2.5-.4 2.7-3 5.2-3.4 2.3-.4 3.8 1.1 5.3 2.9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="m13.5 4.5 4 4L10 16l-4.5 1 1-4.5 7-8Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
        play: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor"/></svg>',
    };
    const polygonPath = polygon =>
        polygon?.length
            ? `M${polygon.map(([x, y]) => `${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`).join('L')}Z`
            : '';

    function mapSvg(base, model, selectedId = '', zone = null) {
        const [x0, y0, w, h] = base.viewBox;
        const inZone = new Set((zone?.places || []).map(place => place.id));
        const shapes = base.shapes
            .map(shape => `<path class="am-shape am-shape--${shape.kind}" d="${shape.d}"></path>`)
            .join('');
        const inset = base.inset;
        // Requadre de l'Alguer a la cantonada de baix a la dreta: arriba a les vores del mapa, només es dibuixen les
        // línies de dalt i de l'esquerra, i l'illa es retalla al requadre. El nom va a dalt a l'esquerra (al mar).
        // A l'ordinador el mapa es veu més ample que el dibuix (viewBox): el requadre continua 300 unitats més enllà
        // de la vora dreta i la de baix perquè arribi sempre a la vora visible.
        const insetW = inset ? inset.width + 300 : 0;
        const insetH = inset ? inset.height + 300 : 0;
        const insetRight = inset ? inset.x + insetW : 0;
        const insetBottom = inset ? inset.y + insetH : 0;
        const insetHtml = inset?.d
            ? `<g class="am-inset"><clipPath id="amInsetClip"><rect x="${inset.x}" y="${inset.y}" width="${insetW}" height="${insetH}"></rect></clipPath>
               <rect class="am-inset__bg" x="${inset.x}" y="${inset.y}" width="${insetW}" height="${insetH}"></rect>
               <path class="am-shape am-shape--pc" clip-path="url(#amInsetClip)" d="${inset.d}"></path>
               <path class="am-inset__edge" d="M${inset.x} ${insetBottom}V${inset.y}H${insetRight}"></path>
               <text x="${inset.x + 12}" y="${inset.y + 28}">${esc(inset.label)}</text></g>`
            : '';
        const dots = model.points
            .map(point => {
                const label = `${point.name}: ${artistsLabel(point.artists.length)}`;
                const classes = `am-dot${point.id === selectedId ? ' is-active' : ''}${point.approximate ? ' is-approx' : ''}${inZone.has(point.id) ? ' is-in-zone' : ''}`;
                return `<g class="${classes}" data-am-place="${esc(point.id)}" role="button" tabindex="0" aria-label="${esc(label)}">
                    <title>${esc(label)}</title>
                    <circle class="am-hit" cx="${Math.round(point.x * 10) / 10}" cy="${Math.round(point.y * 10) / 10}" r="${radiusOf(point.artists.length) + 9}"></circle>
                    <circle class="am-mark" cx="${Math.round(point.x * 10) / 10}" cy="${Math.round(point.y * 10) / 10}" r="${radiusOf(point.artists.length)}"></circle>
                </g>`;
            })
            .join('');
        return `<svg class="am-svg" viewBox="${x0} ${y0} ${w} ${h}" role="img" aria-label="Mapa: les nostres terres, els nostres músics">
            <g class="am-layer">${shapes}${insetHtml}<path class="am-lasso" d="${polygonPath(zone?.polygon)}"></path><g class="am-dots">${dots}</g></g></svg>`;
    }

    function artistItems(artists, withPlace = false) {
        return artists
            .map(
                artist => `<li><button type="button" class="am-artist" data-am-artist="${esc(artist.channelId)}">
                    <img src="${esc(artist.avatar || FALLBACK_AVATAR)}" alt="" loading="lazy" decoding="async" width="40" height="40">
                    <span><strong>${esc(artist.name)}</strong>${withPlace && artist.place ? `<small class="am-artist__place">${esc(artist.place)}</small>` : ''}${artist.relation === 'associated' ? '<small>Vinculat</small>' : ''}</span></button></li>`
            )
            .join('');
    }

    // ---------- La teva zona (pur) ----------

    const HOME_LIMIT = 12;
    function distanceKm(a, b) {
        if (!validPoint(a) || !validPoint(b)) return Infinity;
        const rad = n => (n * Math.PI) / 180;
        const h =
            Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
            Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
        return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
    }
    const kmLabel = km => (km < 1 ? '< 1 km' : `${Math.round(km)} km`);

    // Els artistes més propers a la zona desada a Inici («A prop teu»): els llocs del mapa per distància i, dins de
    // cada lloc, per nom; cada artista una vegada. Sense zona desada, null.
    function homeModel(points, origin, limit = HOME_LIMIT) {
        if (!origin?.name || !validPoint(origin.coordinates)) return null;
        const seen = new Set();
        const artists = [];
        (Array.isArray(points) ? points : [])
            .map(point => ({ point, km: distanceKm(origin.coordinates, point.coordinates) }))
            .filter(item => Number.isFinite(item.km))
            .sort((a, b) => a.km - b.km || a.point.name.localeCompare(b.point.name, 'ca'))
            .forEach(({ point, km }) =>
                point.artists.forEach(artist => {
                    if (artists.length >= limit || seen.has(artist.artistId)) return;
                    seen.add(artist.artistId);
                    artists.push({ ...artist, km, place: `${point.name} · ${kmLabel(km)}` });
                })
            );
        return artists.length ? { name: origin.name, artists } : null;
    }

    function homePanelHtml(home) {
        return `<div class="am-panel__head"><div><p class="am-panel__eyebrow">La teva zona</p><h3>A prop de ${esc(home.name)}</h3>
                <p>${home.artists.length === 1 ? 'L’artista més proper' : `Els ${home.artists.length} artistes més propers`}</p></div>
                <button type="button" class="am-radio" data-am-home-radio>Ràdio d'aquí</button></div>
            <ul class="am-artists">${artistItems(home.artists, true)}</ul>
            <p class="am-panel__hint am-panel__hint--after">Toca un punt del mapa o <strong>dibuixa una zona</strong> per veure’n uns altres.</p>`;
    }

    function panelHtml(point, home = null) {
        if (!point && home) return homePanelHtml(home);
        if (!point) {
            return `<p class="am-panel__hint">Toca un punt del mapa per veure els artistes d'aquell lloc i escoltar-ne la ràdio, o <strong>dibuixa una zona</strong> i sonarà la seva música.</p>`;
        }
        const where = point.approximate
            ? `${esc(point.territory)} · ubicació aproximada (${esc(point.reference)})`
            : esc(point.territory);
        return `<div class="am-panel__head"><div><h3>${esc(point.name)}</h3><p>${where} · ${artistsLabel(point.artists.length)}</p></div>
                <button type="button" class="am-radio" data-am-radio="${esc(point.id)}">Ràdio d'aquí</button></div>
            <ul class="am-artists">${artistItems(point.artists)}</ul>`;
    }

    function zonePanelHtml(zone, home = null) {
        if (!zone?.artists.length) return panelHtml(null, home);
        return `<div class="am-panel__head"><div><p class="am-panel__eyebrow">Zona dibuixada</p><h3>${esc(zone.name)}</h3>
                <p>${placesLabel(zone.places.length)} · ${artistsLabel(zone.artists.length)}</p></div>
                <div class="am-panel__actions"><button type="button" class="am-radio" data-am-zone-play>${ICON.play}<span>Escolta la zona</span></button></div></div>
            <ul class="am-artists">${artistItems(zone.artists, true)}</ul>`;
    }

    function html(base, model, { selectedId = '', style = '', zone = null, home = null } = {}) {
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
                <p class="am-sub">Les nostres terres, els nostres músics <span class="am-count">· ${artistsLabel(model.artistCount)} en ${placesLabel(model.placeCount)}</span></p></div>
                <ul class="am-territories">${territories}</ul>
            </div>
            <div class="am-styles" role="group" aria-label="Filtra per estil">${styleChips}</div>
            <div class="am-body">
                <div class="am-stage">
                    ${mapSvg(base, model, selectedId, zone)}
                    <!-- Dibuixa una zona (i la goma) a dalt a l'esquerra, on el mapa és buit: a la dreta tapava la
                         Catalunya del Nord. La pantalla completa es queda a dalt a la dreta. -->
                    <div class="am-tools am-tools--start">
                        <button type="button" class="am-tool am-tool--draw" data-am-draw aria-pressed="false">${ICON.draw}<span>Dibuixa una zona</span></button>
                        <button type="button" class="am-tool am-tool--erase" data-am-clear aria-label="Esborra la selecció" title="Esborra la selecció"${zone || selectedId ? '' : ' hidden'}>${ICON.erase}</button>
                    </div>
                    <div class="am-tools">
                        <button type="button" class="am-tool am-tool--full" data-am-full aria-label="Mapa a pantalla completa"><span class="am-ico-full">${ICON.full}</span><span class="am-ico-close">${ICON.close}</span></button>
                    </div>
                    <p class="am-hint" aria-live="polite">
                        <span class="am-hint__touch">Mou o apropa el mapa amb dos dits</span>
                        <span class="am-hint__full-touch">Un dit per moure't, dos per apropar</span>
                        <span class="am-hint__mouse">Arrossega per moure't · Ctrl + roda per apropar</span>
                        <span class="am-hint__full-mouse">Arrossega per moure't · roda per apropar</span>
                        <span class="am-hint__draw">Dibuixa una zona amb el dit o el ratolí: sonarà la música dels seus artistes</span>
                    </p>
                    <div class="am-zoom"><button type="button" data-am-zoom="1" aria-label="Apropa">+</button><button type="button" data-am-zoom="-1" aria-label="Allunya">−</button></div>
                </div>
                <div class="am-panel" aria-live="polite">${zone && !selected ? zonePanelHtml(zone, home) : panelHtml(selected, home)}</div>
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
        full: false,
        drawing: false,
        zone: null,
        songs: null,
        songsLoading: null,
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

    function youtubeApi() {
        return typeof YouTubeAPI !== 'undefined' ? YouTubeAPI : window.YouTubeAPI;
    }

    function artistGroups() {
        return youtubeApi()?.getArtistGroups?.() || [];
    }

    function hiddenChannels() {
        return typeof getHiddenChannelIds === 'function' ? getHiddenChannelIds() : [];
    }

    // Cançons per a la ràdio d'una zona (feed + historial dels estils), com «A prop teu». Es demanen en entrar al
    // mode de dibuix: en acabar el traç la ràdio comença de seguida (dins del gest de l'usuari, per l'autoplay).
    function loadSongs() {
        if (state.songs) return Promise.resolve(state.songs);
        if (!state.songsLoading) {
            const youtube = youtubeApi();
            state.songsLoading = Promise.resolve(youtube?.ensureStyleHistory?.())
                .then(history => {
                    const all = [...(youtube?.feedVideos || []), ...(history || [])];
                    state.songs = youtube?.filterHiddenVideos ? youtube.filterHiddenVideos(all) : all;
                    return state.songs;
                })
                .catch(() => (state.songs = youtube?.feedVideos || []))
                .finally(() => {
                    state.songsLoading = null;
                });
        }
        return state.songsLoading;
    }

    function toast(message) {
        app.features.shellNav?.toast?.(message);
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
        if (state.zone) state.zone = zoneModel(state.model.points, state.zone.polygon);
        state.home = homeModel(state.model.points, homeOrigin());
        container.innerHTML = html(state.data.base, state.model, {
            selectedId: state.selectedId,
            style: state.style,
            zone: state.zone,
            home: state.home,
        });
        syncModes();
        applyView();
    }

    function syncModes() {
        const container = state.container;
        if (!container) return;
        container.classList.toggle('is-full', state.full);
        container.classList.toggle('is-drawing', state.drawing);
        document.body.classList.toggle('am-full-open', state.full);
        const draw = container.querySelector('[data-am-draw]');
        if (draw) draw.setAttribute('aria-pressed', String(state.drawing));
        // La goma només surt quan hi ha alguna cosa triada (una zona dibuixada o un lloc)
        const erase = container.querySelector('[data-am-clear]');
        if (erase) erase.hidden = !(state.zone || state.selectedId);
        const full = container.querySelector('[data-am-full]');
        if (full)
            full.setAttribute('aria-label', state.full ? 'Tanca la pantalla completa' : 'Mapa a pantalla completa');
    }

    // ---------- Zoom i desplaçament: es canvia el viewBox de l'SVG (sense llibreries) ----------

    const baseBox = () => state.data.base.viewBox;
    const svgEl = () => state.container?.querySelector('.am-svg');
    function currentView() {
        if (!state.view) state.view = [...baseBox()];
        return state.view;
    }
    function applyView() {
        const svg = svgEl();
        if (!svg) return;
        const [x, y, w, h] = currentView();
        svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
        svg.style.setProperty('--am-zoom', String(baseBox()[2] / w));
        state.container.classList.toggle('is-zoomed', w < baseBox()[2] - 0.5);
    }
    function setView(view) {
        const before = currentView().join(',');
        state.view = clampView(view, baseBox());
        applyView();
        return state.view.join(',') !== before;
    }
    // Zoom al voltant d'un punt de la pantalla (el centre del mapa si no se'n dona cap)
    function zoomBy(factor, clientX, clientY) {
        const svg = svgEl();
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const cx = clientX ?? rect.left + rect.width / 2;
        const cy = clientY ?? rect.top + rect.height / 2;
        const view = currentView();
        const point = clientToSvg(view, rect, cx, cy);
        const width = clampView([0, 0, view[2] / factor], baseBox())[2];
        setView(viewKeeping(point, rect, cx, cy, width, baseBox()));
    }

    function selectPlace(id, { focusPanel = false } = {}) {
        state.selectedId = state.selectedId === id ? '' : id;
        const point = state.model?.points.find(p => p.id === state.selectedId) || null;
        state.container
            .querySelectorAll('.am-dot')
            .forEach(dot => dot.classList.toggle('is-active', dot.dataset.amPlace === state.selectedId));
        const panel = state.container.querySelector('.am-panel');
        if (panel)
            panel.innerHTML = point
                ? panelHtml(point)
                : state.zone
                  ? zonePanelHtml(state.zone, state.home)
                  : panelHtml(null, state.home);
        if (point && focusPanel && !state.full) panel?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
        syncModes();
    }

    function openRadio(placeId) {
        const point = state.model?.points.find(p => p.id === placeId);
        if (!point) return;
        setFull(false);
        rememberReturn();
        const opening = app.features.nearbyRadio?.openPlace?.({
            name: point.approximate ? point.reference : point.name,
            territory: point.territory,
            coordinates: point.coordinates,
        });
        Promise.resolve(opening).then(ok => {
            if (!ok) toast('No s’ha pogut obrir la ràdio d’aquest lloc.');
        });
    }

    // Un pare amb transformació trenca el «position: fixed»: a pantalla completa el mapa penja de <body> i, en
    // tancar-la, torna al seu lloc (els gestors són del mateix element i continuen funcionant).
    // ---------- Tornar al mapa ----------
    // En obrir un artista (o una ràdio) des del mapa es recorda on era el mapa a la pàgina. Amb `push` s'afegeix una
    // entrada a l'historial (la fitxa d'artista no en fa cap): «enrere» —el del sistema, el de la fitxa o el de
    // després d'una ràdio— torna a Descobreix i restoreReturn() (cridat per syncArtistMap() d'app.js) hi fa scroll.
    const RETURN_TTL = 30 * 60 * 1000;
    function rememberReturn({ push = false } = {}) {
        const container = state.container;
        if (!container) return;
        const top = container.getBoundingClientRect().top + window.scrollY;
        app.state.mapReturn = { offset: window.scrollY - top, at: Date.now(), pushed: push };
        if (!push) return;
        try {
            const current = window.history.state || {};
            window.history.pushState(
                { ...current, appPage: 'home', category: 'Descobreix', mapReturn: true },
                '',
                window.location.href
            );
        } catch (_error) {
            /* Sense historial: el botó de la fitxa farà el de sempre */
        }
    }
    function restoreReturn() {
        const target = app.state.mapReturn;
        app.state.mapReturn = null;
        const container = state.container;
        if (!target || !container || Date.now() - target.at > RETURN_TTL) return false;
        let tries = 0;
        const go = () => {
            if (container.classList.contains('hidden')) return;
            const top = container.getBoundingClientRect().top + window.scrollY;
            const y = Math.max(0, top + target.offset);
            window.scrollTo(0, y);
            // La pàgina encara s'està pintant (cançons, «Per afinitat»): es torna a provar uns quants cops
            if (Math.abs(window.scrollY - y) > 2 && ++tries < 12) setTimeout(go, 80);
        };
        requestAnimationFrame(() => requestAnimationFrame(go));
        return true;
    }

    function setFull(on) {
        if (state.full === Boolean(on)) return;
        state.full = Boolean(on);
        const container = state.container;
        if (state.full && container && container.parentNode !== document.body) {
            state.placeholder = document.createComment('artistMap');
            container.before(state.placeholder);
            document.body.appendChild(container);
        } else if (!state.full && state.placeholder) {
            state.placeholder.replaceWith(container);
            state.placeholder = null;
        }
        syncModes();
        // La mida de l'SVG canvia: el viewBox continua sent el mateix
        applyView();
    }

    function setDrawing(on) {
        state.drawing = Boolean(on);
        syncModes();
        if (state.drawing) loadSongs();
    }

    // ---------- Ràdio d'una zona ----------

    function startZoneRadio(zone) {
        const start = songs => {
            const pool = zoneSongs(songs, zone.channelIds);
            setFull(false);
            rememberReturn();
            const ok = app.features.musicQueue?.startCategoryRadio?.(pool, { name: zone.name });
            if (!ok) toast('No hi ha prou cançons d’aquesta zona per fer-ne una ràdio.');
            return Boolean(ok);
        };
        if (state.songs) return start(state.songs);
        return loadSongs().then(start);
    }

    function showZone(zone) {
        state.zone = zone;
        state.selectedId = '';
        const inZone = new Set(zone.places.map(place => place.id));
        state.container.querySelectorAll('.am-dot').forEach(dot => {
            dot.classList.toggle('is-in-zone', inZone.has(dot.dataset.amPlace));
            dot.classList.remove('is-active');
        });
        const lasso = state.container.querySelector('.am-lasso');
        if (lasso) lasso.setAttribute('d', polygonPath(zone.polygon));
        const panel = state.container.querySelector('.am-panel');
        if (panel) panel.innerHTML = zonePanelHtml(zone, state.home);
        syncModes();
    }

    // La goma: treu la zona dibuixada i el lloc triat
    function clearSelection() {
        state.zone = null;
        state.selectedId = '';
        state.container
            .querySelectorAll('.am-dot.is-in-zone, .am-dot.is-active')
            .forEach(dot => dot.classList.remove('is-in-zone', 'is-active'));
        state.container.querySelector('.am-lasso')?.setAttribute('d', '');
        const panel = state.container.querySelector('.am-panel');
        if (panel) panel.innerHTML = panelHtml(null, state.home);
        syncModes();
    }

    // La zona desada a Inici («A prop teu»); sense, cap
    function homeOrigin() {
        return app.features.nearbyRadio?.savedPlace?.() || null;
    }

    // En tornar a Descobreix la zona pot haver canviat a Inici: es refà el panell sense repintar el mapa (no es perd
    // el zoom) si no hi ha cap lloc ni zona triats
    function refreshHome() {
        if (!state.model) return;
        state.home = homeModel(state.model.points, homeOrigin());
        if (state.selectedId || state.zone) return;
        const panel = state.container?.querySelector('.am-panel');
        if (panel) panel.innerHTML = panelHtml(null, state.home);
    }

    function openHomeRadio() {
        const origin = homeOrigin();
        if (!origin) return;
        setFull(false);
        rememberReturn();
        Promise.resolve(app.features.nearbyRadio?.openPlace?.(origin)).then(ok => {
            if (!ok) toast('No s’ha pogut obrir la ràdio de la teva zona.');
        });
    }

    // Traç a mà alçada: punts de l'SVG; en acabar es tanca i es busquen els artistes de dins
    const lasso = {
        points: null,
        length: 0,
        last: null,
        start(clientX, clientY) {
            const svg = svgEl();
            if (!svg) return;
            this.rect = svg.getBoundingClientRect();
            this.points = [clientToSvg(currentView(), this.rect, clientX, clientY)];
            this.length = 0;
            this.last = [clientX, clientY];
        },
        add(clientX, clientY) {
            if (!this.points) return;
            const step = Math.hypot(clientX - this.last[0], clientY - this.last[1]);
            if (step < 3) return;
            this.length += step;
            this.last = [clientX, clientY];
            this.points.push(clientToSvg(currentView(), this.rect, clientX, clientY));
            state.container.querySelector('.am-lasso')?.setAttribute('d', polygonPath(this.points));
        },
        cancel() {
            this.points = null;
            state.container?.querySelector('.am-lasso')?.setAttribute('d', polygonPath(state.zone?.polygon));
        },
        // Retorna true si era un traç (no un toc)
        finish() {
            const points = this.points;
            this.points = null;
            if (!points || points.length < 3 || this.length < 40) {
                state.container.querySelector('.am-lasso')?.setAttribute('d', polygonPath(state.zone?.polygon));
                return false;
            }
            const zone = zoneModel(state.model.points, points);
            if (!zone?.artists.length) {
                state.container.querySelector('.am-lasso')?.setAttribute('d', polygonPath(state.zone?.polygon));
                toast('No hi ha cap artista dins d’aquesta zona. Prova-ho amb una zona més gran.');
                return true;
            }
            // Primer els artistes de la zona al panell; la ràdio, quan la persona prem «Escolta la zona»
            showZone(zone);
            setDrawing(false);
            toast(`${zone.name}: ${artistsLabel(zone.artists.length)}`);
            if (!state.full && window.innerWidth <= 768)
                state.container.querySelector('.am-panel')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
            return true;
        },
    };

    // ---------- Esdeveniments ----------

    // Després d'arrossegar, pessigar o dibuixar, el «click» que el navegador envia no ha de triar cap punt
    function swallowNextClick(container) {
        const swallow = e => {
            if (!e.target.closest?.('.am-svg')) return; // un botó de fora del mapa (pantalla completa…) sí que val
            e.stopPropagation();
            e.preventDefault();
        };
        container.addEventListener('click', swallow, { capture: true });
        setTimeout(() => container.removeEventListener('click', swallow, { capture: true }), 350);
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
        if (target.closest?.('[data-am-full]')) return setFull(!state.full);
        if (target.closest?.('[data-am-draw]')) return setDrawing(!state.drawing);
        if (target.closest?.('[data-am-zone-play]')) return state.zone && startZoneRadio(state.zone);
        if (target.closest?.('[data-am-clear]')) return clearSelection();
        if (target.closest?.('[data-am-home-radio]')) return openHomeRadio();
        const style = target.closest?.('[data-am-style]');
        if (style) {
            state.style = style.dataset.amStyle || '';
            return paint();
        }
        const radio = target.closest?.('[data-am-radio]');
        if (radio) return openRadio(radio.dataset.amRadio);
        const artist = target.closest?.('[data-am-artist]');
        if (artist) {
            setFull(false);
            rememberReturn({ push: true });
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

    function onDocumentKey(event) {
        if (event.key !== 'Escape' || state.container?.classList.contains('hidden')) return;
        if (state.drawing) {
            lasso.cancel();
            setDrawing(false);
        } else if (state.full) setFull(false);
    }

    // Ratolí (i llapis): arrossegar mou el mapa; en mode dibuix, dibuixa. Els dits van per bindTouch().
    function bindMouse(container) {
        let drag = null;
        container.addEventListener('pointerdown', event => {
            if (event.pointerType === 'touch' || event.button !== 0) return;
            const svg = event.target.closest?.('.am-svg');
            if (!svg) return;
            if (state.drawing) {
                event.preventDefault();
                svg.setPointerCapture?.(event.pointerId);
                lasso.start(event.clientX, event.clientY);
                drag = { id: event.pointerId, draw: true };
                return;
            }
            const rect = svg.getBoundingClientRect();
            drag = {
                id: event.pointerId,
                rect,
                x: event.clientX,
                y: event.clientY,
                grab: clientToSvg(currentView(), rect, event.clientX, event.clientY),
                moved: false,
            };
        });
        container.addEventListener('pointermove', event => {
            if (!drag || drag.id !== event.pointerId) return;
            if (drag.draw) return lasso.add(event.clientX, event.clientY);
            if (!drag.moved && Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) < 5) return;
            if (!drag.moved) {
                drag.moved = true;
                container.classList.add('is-dragging');
            }
            setView(viewKeeping(drag.grab, drag.rect, event.clientX, event.clientY, currentView()[2], baseBox()));
        });
        const end = event => {
            if (!drag || drag.id !== event.pointerId) return;
            if (drag.draw) {
                if (event.type === 'pointercancel') lasso.cancel();
                else if (lasso.finish()) swallowNextClick(container);
            } else if (drag.moved) swallowNextClick(container);
            container.classList.remove('is-dragging');
            drag = null;
        };
        container.addEventListener('pointerup', end);
        container.addEventListener('pointercancel', end);
        container.addEventListener(
            'wheel',
            event => {
                const svg = event.target.closest?.('.am-svg');
                if (!svg) return;
                const rect = svg.getBoundingClientRect();
                // Ctrl/⌘ + roda (i el pessic del trackpad) o pantalla completa: zoom on hi ha el ratolí
                if (event.ctrlKey || event.metaKey || state.full) {
                    event.preventDefault();
                    zoomBy(Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0025)), event.clientX, event.clientY);
                    return;
                }
                // Amb zoom, la roda mou el mapa amunt i avall; a la vora (o sense zoom) fa scroll de la pàgina
                if (!state.container.classList.contains('is-zoomed')) return;
                const [x, y, w, h] = currentView();
                const { s } = fit(rect, w, h);
                if (setView([x + event.deltaX / s, y + event.deltaY / s, w, h])) event.preventDefault();
            },
            { passive: false }
        );
    }

    // Dits: dos dits mouen i apropen el mapa (un dit fa scroll de la pàgina, tret de la pantalla completa, on un
    // dit també mou el mapa); en mode dibuix, un dit dibuixa la zona.
    function bindTouch(container) {
        let touch = null;
        const centroid = touches => {
            const a = touches[0];
            const b = touches[1];
            return {
                x: (a.clientX + b.clientX) / 2,
                y: (a.clientY + b.clientY) / 2,
                d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
            };
        };
        const startPinch = (svg, touches) => {
            const rect = svg.getBoundingClientRect();
            const c = centroid(touches);
            return {
                mode: 'pinch',
                rect,
                d0: Math.max(c.d, 1),
                w0: currentView()[2],
                grab: clientToSvg(currentView(), rect, c.x, c.y),
                moved: true,
            };
        };
        const startPan = (svg, t) => {
            const rect = svg.getBoundingClientRect();
            return {
                mode: 'pan',
                rect,
                x: t.clientX,
                y: t.clientY,
                grab: clientToSvg(currentView(), rect, t.clientX, t.clientY),
                moved: false,
            };
        };
        container.addEventListener(
            'touchstart',
            event => {
                const svg = event.target.closest?.('.am-svg');
                if (!svg) return;
                if (event.touches.length >= 2) {
                    lasso.cancel();
                    touch = startPinch(svg, event.touches);
                    event.preventDefault();
                    return;
                }
                const t = event.touches[0];
                if (state.drawing) {
                    lasso.start(t.clientX, t.clientY);
                    touch = { mode: 'draw' };
                } else if (state.full) touch = startPan(svg, t);
                else touch = null;
            },
            { passive: false }
        );
        container.addEventListener(
            'touchmove',
            event => {
                const svg = event.target.closest?.('.am-svg') || svgEl();
                if (event.touches.length >= 2 && svg) {
                    if (touch?.mode !== 'pinch') {
                        if (touch?.mode === 'draw') lasso.cancel();
                        touch = startPinch(svg, event.touches);
                    }
                    if (event.cancelable) event.preventDefault();
                    const c = centroid(event.touches);
                    const width = clampView([0, 0, touch.w0 / (c.d / touch.d0)], baseBox())[2];
                    setView(viewKeeping(touch.grab, touch.rect, c.x, c.y, width, baseBox()));
                    return;
                }
                if (!touch) return;
                const t = event.touches[0];
                if (touch.mode === 'draw') {
                    if (event.cancelable) event.preventDefault();
                    lasso.add(t.clientX, t.clientY);
                } else if (touch.mode === 'pan') {
                    if (event.cancelable) event.preventDefault();
                    if (!touch.moved && Math.abs(t.clientX - touch.x) + Math.abs(t.clientY - touch.y) < 6) return;
                    touch.moved = true;
                    setView(viewKeeping(touch.grab, touch.rect, t.clientX, t.clientY, currentView()[2], baseBox()));
                }
            },
            { passive: false }
        );
        const end = event => {
            if (!touch) return;
            if (touch.mode === 'draw' && event.touches.length === 0) {
                if (event.type === 'touchcancel') lasso.cancel();
                else if (lasso.finish()) swallowNextClick(container);
            }
            if (touch.moved) swallowNextClick(container);
            const svg = svgEl();
            // D'un pessic a un sol dit: a pantalla completa es continua movent; a la pàgina, s'acaba
            touch =
                event.touches.length === 1 && touch.mode === 'pinch' && state.full && svg
                    ? { ...startPan(svg, event.touches[0]), moved: true }
                    : null;
        };
        container.addEventListener('touchend', end);
        container.addEventListener('touchcancel', end);
        // Safari: que el pessic sobre el mapa no faci zoom de tota la pàgina
        container.addEventListener('gesturestart', event => {
            if (event.target.closest?.('.am-svg')) event.preventDefault();
        });
    }

    async function show(container) {
        if (!container) return;
        state.container = container;
        container.classList.remove('hidden');
        if (!state.bound) {
            state.bound = true;
            container.addEventListener('click', onClick);
            container.addEventListener('keydown', onKey);
            document.addEventListener('keydown', onDocumentKey);
            bindMouse(container);
            bindTouch(container);
        }
        if (!state.data) container.innerHTML = '<p class="am-loading">Carregant el mapa…</p>';
        try {
            await loadData();
            if (container.classList.contains('hidden')) return;
            // Es repinta només si han canviat els artistes de l'app (feed nou, canals amagats): no es perd el zoom
            const signature = `${artistGroups().length}|${hiddenChannels().length}`;
            if (state.signature === signature && container.querySelector('.am-svg')) return refreshHome();
            state.signature = signature;
            state.songs = null; // les cançons de la zona es tornen a llegir amb el feed nou
            paint();
        } catch (_error) {
            container.innerHTML =
                '<p class="am-loading">No s’ha pogut carregar el mapa. Torna-ho a provar més tard.</p>';
        }
    }

    function hide(container) {
        const target = container || state.container;
        if (!target) return;
        target.classList.add('hidden');
        if (target === state.container) {
            lasso.cancel();
            state.drawing = false;
            setFull(false);
            syncModes();
        }
    }

    app.features.artistMap = {
        restoreReturn,
        project,
        resolvePlace,
        buildModel,
        html,
        panelHtml,
        homeModel,
        zonePanelHtml,
        radiusOf,
        pointInPolygon,
        zoneModel,
        zoneSongs,
        clampView,
        clientToSvg,
        viewKeeping,
        show,
        hide,
    };
})(window);
