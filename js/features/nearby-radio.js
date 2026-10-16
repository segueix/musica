// Ràdio geogràfica: una pista per artista; ordre independent de la popularitat.
(function (window) {
    'use strict';
    const app = window.SegueixApp;
    if (!app) return;
    const territories = new Set(['Catalunya', 'Catalunya Nord', 'Andorra', 'País Valencià', 'Illes Balears']);
    const storageKey = 'segueix_nearby_manual_v1';
    const fold = value => String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const validPoint = p => Number.isFinite(p?.latitude) && Number.isFinite(p?.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;
    function distance(a, b) {
        if (!validPoint(a) || !validPoint(b)) return Infinity;
        const rad = n => n * Math.PI / 180;
        const h = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
        return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
    }
    function artistLocation(artist, origin, catalog, references) {
        const places = { ...catalog.places, ...references.places };
        const candidates = (artist.placeIds || []).flatMap(id => {
            const place = places[id];
            if (!place) return [];
            const refIds = place.type === 'municipality' ? [id] : references.references?.[id]?.placeIds || [];
            return refIds.map(refId => {
                const ref = places[refId];
                if (!ref || !territories.has(ref.territory) || !validPoint(ref.coordinates)) return null;
                return { name: place.name, reference: ref.name, approximate: place.type !== 'municipality', distance: distance(origin, ref.coordinates) };
            }).filter(Boolean);
        });
        return candidates.sort((a, b) => a.distance - b.distance)[0] || null;
    }
    function buildRows({ videos, origin, catalog, references, rank = items => items, avoidIds = new Set() }) {
        if (!validPoint(origin)) return [];
        const groups = new Map();
        for (const video of videos) {
            if (!video?.id || video.isShort || !['song', 'live_song'].includes(video.contentType || 'song')) continue;
            const artistId = catalog.channels?.[video.channelId];
            const artist = catalog.artists?.[artistId];
            if (!artist || artist.status !== 'validated') continue;
            if (!groups.has(artistId)) groups.set(artistId, { artistId, artist, videos: new Map() });
            groups.get(artistId).videos.set(String(video.id), video);
        }
        return [...groups.values()].map(group => {
            const location = artistLocation(group.artist, origin, catalog, references);
            if (!location) return null;
            const tracks = [...group.videos.values()];
            const alternatives = tracks.filter(v => !avoidIds.has(String(v.id)));
            const candidates = alternatives.length ? alternatives : tracks;
            const video = rank(candidates)[0] || candidates[0];
            return { artistId: group.artistId, artist: group.artist.name, relation: group.artist.relation, location, video };
        }).filter(Boolean).sort((a, b) => a.location.distance - b.location.distance || a.artist.localeCompare(b.artist, 'ca'));
    }
    // Tipus de ràdio: quina cançó de cada artista hi posem (els artistes i l'ordre per distància no canvien).
    const TYPES = [
        { id: 'popular', label: 'Les més escoltades', hint: 'De cada artista, la cançó amb més visualitzacions.' },
        { id: 'mix', label: 'Equilibrada', hint: 'De cada artista, la cançó que tria el motor segons el teu gust.' },
        { id: 'hidden', label: 'Joies amagades', hint: 'De cada artista, una cançó menys escoltada.' },
    ];
    const typeKey = 'segueix_nearby_type_v1';
    const views = video => (Number.isFinite(Number(video?.viewCount)) ? Number(video.viewCount) : null);
    function rankByType(tracks, type, engineRank = items => items) {
        if (type !== 'popular' && type !== 'hidden') return engineRank(tracks);
        const known = tracks.filter(v => views(v) !== null);
        if (!known.length) return engineRank(tracks);
        // Joies amagades: les menys escoltades, però amb alguna escolta (un vídeo a 0 sol ser un error o una pujada fallida)
        const pool = type === 'hidden' && known.some(v => views(v) > 0) ? known.filter(v => views(v) > 0) : known;
        return [...pool].sort((a, b) => (type === 'popular' ? views(b) - views(a) : views(a) - views(b)));
    }
    function remotePlace(item) {
        if (!/^PPL/.test(item.feature_code || '')) return null;
        const territory = item.country_code === 'AD' ? 'Andorra' : item.country_code === 'FR' && item.admin2_id === 2984885 ? 'Catalunya Nord' :
            item.country_code === 'ES' ? ({ 3336901: 'Catalunya', 2593113: 'País Valencià', 2521383: 'Illes Balears' })[item.admin1_id] : null;
        const coordinates = { latitude: item.latitude, longitude: item.longitude };
        if (!territory || !validPoint(coordinates)) return null;
        return { id: `geonames:${item.id}`, name: item.name, territory, detail: item.admin3 || item.admin2 || '', coordinates, type: 'municipality' };
    }
    const state = { catalog: null, references: null, videos: [], origin: null, rows: [], offset: 0, version: 0, searchVersion: 0, dialog: null, type: null, card: null, cardLoading: null };
    async function json(url) {
        const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    }
    async function load() {
        if (!state.catalog) {
            const [catalog, references] = await Promise.all([json('data/origens-artistes.json'), json('data/proximitat-musical.json')]);
            state.catalog = catalog; state.references = references;
        }
        // youtube.js declara un const global lexical, no una propietat de window.
        const youtube = typeof YouTubeAPI !== 'undefined' ? YouTubeAPI : window.YouTubeAPI;
        // Un enllaç compartit s'obre en arrencar, abans que el feed hagi carregat: s'espera (fins a 20 s).
        for (let i = 0; i < 80 && youtube.feedLoaded === false; i++) await new Promise(resolve => setTimeout(resolve, 250));
        const history = await youtube.ensureStyleHistory();
        const pool = youtube.filterHiddenVideos([...(youtube.feedVideos || []), ...(history || [])]);
        state.videos = app.features.musicQueue.nearbyPool(pool);
    }
    function localPlaces(query) {
        return Object.entries({ ...state.catalog?.places, ...state.references?.places })
            .filter(([, p]) => p.type === 'municipality' && territories.has(p.territory) && validPoint(p.coordinates) && fold(p.name).includes(fold(query)))
            .map(([id, p]) => ({ ...p, id }));
    }
    const $ = selector => state.dialog?.querySelector(selector);
    const PIN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="9.5" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor"/></svg>';
    const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    const SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="18" cy="5" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="19" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    const PAGE = 20;
    function status(message) { const el = $('[data-near-status]'); if (el) el.textContent = message; }
    function km(value) { return value < 1 ? '< 1 km' : `${Math.round(value)} km`; }
    function savedPlace() {
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey));
            return saved?.name && territories.has(saved.territory) && validPoint(saved.coordinates) ? saved : null;
        } catch (_) { return null; }
    }
    function batchRows() { return state.rows.slice(state.offset, state.offset + PAGE); }
    function currentType() {
        if (!state.type) {
            try { state.type = localStorage.getItem(typeKey); } catch (_) { /* Sense preferència */ }
            if (!TYPES.some(t => t.id === state.type)) state.type = 'mix';
        }
        return state.type;
    }
    function cover(video) {
        const own = typeof getPreferredThumbnail === 'function' ? getPreferredThumbnail(video) : video?.thumbnail;
        return own || `https://i.ytimg.com/vi/${encodeURIComponent(String(video?.id || ''))}/mqdefault.jpg`;
    }
    function viewsLabel(video) {
        const n = views(video);
        if (n === null) return '';
        const short = typeof formatViews === 'function' ? formatViews(n) : n;
        return `${short} visualitzacions`;
    }
    function typeHtml(name) {
        const type = currentType();
        return `<fieldset class="pt-mode near-type"><legend class="pt-mode__legend">Quina ràdio vols?</legend>
            <div class="pt-mode__options near-type__options">${TYPES.map(t => `<label class="pt-mode__opt"><input type="radio" name="${name}" value="${t.id}"${t.id === type ? ' checked' : ''}><span>${t.label}</span></label>`).join('')}</div>
            <p class="pt-mode__hint" data-near-type-hint>${esc(TYPES.find(t => t.id === type).hint)}</p></fieldset>`;
    }
    function rowHtml(row, index) {
        const where = `${row.relation === 'associated' ? 'Vinculat a ' : ''}${esc(row.location.name)}${row.location.approximate ? ` · ref. ${esc(row.location.reference)}` : ''}`;
        const seen = viewsLabel(row.video);
        return `<li class="near-row"><span class="near-row__cover"><img src="${esc(cover(row.video))}" alt="" loading="lazy" decoding="async" width="64" height="64"><span class="near-row__rank" aria-hidden="true">${state.offset + index + 1}</span></span>
            <span class="near-row__text"><span class="near-row__km">${km(row.location.distance)}<span class="pt-sr-only"> aprox.</span></span><strong>${esc(row.video.title)}</strong><span>${esc(row.artist)}</span><small>${where}${seen ? ` · ${seen}` : ''}</small></span></li>`;
    }
    function renderRows() {
        if (!state.dialog) return;
        const batch = batchRows();
        const has = Boolean(state.origin);
        state.dialog.classList.toggle('has-origin', has);
        $('[data-near-current-name]').textContent = has ? state.origin.name : '';
        // Només es comparteix una localitat triada (amb nom i territori), mai la posició del GPS
        $('[data-near-share]').hidden = !shareablePlace(state.origin);
        const from = state.offset + 1, to = state.offset + batch.length;
        $('[data-near-results]').innerHTML = !has ? '' : batch.length
            ? `<div class="near-results__head"><h3>A prop de ${esc(state.origin.name)}</h3><p>${esc(TYPES.find(t => t.id === currentType()).label)} · artistes ${from}–${to} de ${state.rows.length}, del més proper al més llunyà</p></div><ol class="near-list">${batch.map(rowHtml).join('')}</ol>`
            : '<p class="near-empty">No hem trobat artistes amb cançons disponibles i localització revisada.</p>';
        $('[data-near-play]').disabled = !batch.length;
        $('[data-near-more]').disabled = state.offset + PAGE >= state.rows.length;
        $('[data-near-other]').disabled = !batch.length;
        state.dialog.querySelector('.near-actions').hidden = !has;
    }
    function computeRows(avoidIds = new Set()) {
        const selection = app.features.musicSelection;
        const signals = app.features.musicSignals?.snapshot?.();
        state.rows = buildRows({ videos: state.videos, origin: state.origin.coordinates, catalog: state.catalog, references: state.references, avoidIds,
            rank: tracks => rankByType(tracks, currentType(), items => selection?.isEnabled?.() ? selection.rankFeed(items, { ctx: selection.getAppContext(state.videos), signals }) : items) });
    }
    function rebuild(avoidIds = new Set()) {
        computeRows(avoidIds);
        renderRows();
    }
    function playRows() {
        const videos = batchRows().map(r => ({
            ...r.video,
            nearbyKm: km(r.location.distance),
            nearbyPlace: `${r.relation === 'associated' ? 'vinculat a ' : ''}${r.location.name}${r.location.approximate ? ` · ref. ${r.location.reference}` : ''}`,
            nearbyLocation: `${r.location.name} · ${Math.round(r.location.distance)} km aprox.${r.location.approximate ? ' · ref. ' + r.location.reference : ''}`,
        }));
        return videos.length > 0 && app.features.musicQueue.playSelection(videos, `A prop teu · ${state.origin.name}${currentType() === 'mix' ? '' : ` · ${TYPES.find(t => t.id === currentType()).label}`}`);
    }
    function setEditing(editing) {
        state.dialog.classList.toggle('is-editing', editing);
        if (editing) setTimeout(() => $('[data-near-query]')?.focus(), 0);
    }
    function selectPlace(place, manual = true) {
        state.version++; state.searchVersion++;
        state.origin = place; state.offset = 0;
        $('[data-near-locations]').replaceChildren();
        if (manual) {
            try { localStorage.setItem(storageKey, JSON.stringify({ id: place.id, name: place.name, territory: place.territory, coordinates: place.coordinates })); } catch (_) { /* Opcional */ }
        }
        rebuild(); setEditing(false);
        status('Distàncies en línia recta. Per a comarques i illes fem servir la capital o la referència indicada.');
    }
    async function search(event) {
        event.preventDefault();
        const query = $('[data-near-query]').value.trim();
        if (query.length < 2) return status('Escriu almenys dues lletres.');
        const version = ++state.searchVersion;
        const local = localPlaces(query);
        const paint = places => {
            if (version !== state.searchVersion || !state.dialog.open) return;
            const unique = [...new Map(places.map(p => [p.id, p])).values()].slice(0, 30);
            $('[data-near-locations]').innerHTML = unique.map((p, i) => `<button type="button" class="near-place" data-near-place="${i}">${PIN}<span><strong>${esc(p.name)}</strong><small>${esc(p.detail ? p.detail + ' · ' : '')}${esc(p.territory)}</small></span></button>`).join('');
            $('[data-near-locations]').querySelectorAll('button').forEach((button, i) => button.addEventListener('click', () => selectPlace(unique[i])));
            return unique.length;
        };
        paint(local); status('Cercant localitats…');
        const results = await Promise.allSettled(['ES', 'FR', 'AD'].map(country => json(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=50&language=ca&countryCode=${country}`)));
        if (version !== state.searchVersion || !state.dialog.open) return;
        const places = results.filter(r => r.status === 'fulfilled').flatMap(r => (r.value.results || []).map(remotePlace).filter(Boolean));
        const count = paint([...local, ...places]);
        status(results.some(r => r.status === 'rejected') ? 'La cerca externa no s’ha completat. Mostrem les localitats disponibles; pots tornar-ho a provar.' : count ? 'Tria la localitat.' : 'No s’ha trobat la localitat. Prova un altre nom.');
    }
    function locate() {
        if (!navigator.geolocation) return status('Aquest navegador no ofereix ubicació. Tria una localitat.');
        const version = ++state.version;
        status('Esperant la ubicació…');
        navigator.geolocation.getCurrentPosition(position => {
            if (version !== state.version || !state.dialog.open) return;
            if (!Number.isFinite(position.coords.accuracy) || position.coords.accuracy > 10000) return status('La ubicació és massa imprecisa. Tria una localitat manualment.');
            selectPlace({ name: 'La teva ubicació', coordinates: { latitude: position.coords.latitude, longitude: position.coords.longitude } }, false);
        }, () => { if (version === state.version && state.dialog.open) status('No hem pogut obtenir la ubicació. Pots triar una localitat sense donar permís.'); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    }
    function createDialog() {
        const dialog = document.createElement('dialog'); dialog.className = 'near-dialog is-editing';
        dialog.setAttribute('aria-labelledby', 'nearTitle');
        dialog.innerHTML = `<header class="near-head"><span class="near-head__icon">${PIN}</span>
                <div class="near-head__text"><p class="near-eyebrow">Ràdio de proximitat</p><h2 id="nearTitle">A prop teu</h2></div>
                <button type="button" class="near-close" data-near-close aria-label="Tanca">${CROSS}</button></header>
            <div class="near-body">
                <p class="near-intro">20 artistes del teu voltant, una cançó de cadascun, del més proper al més llunyà.</p>
                <div class="near-current"><span class="near-current__label">${PIN}<span>Ubicació: <strong data-near-current-name></strong></span></span>
                    <span class="near-current__tools"><button type="button" class="near-link near-share" data-near-share aria-label="Comparteix aquesta ràdio">${SHARE}<span>Comparteix</span></button>
                    <button type="button" class="near-link" data-near-change>Canvia</button></span></div>
                <section class="near-where" aria-label="Tria la ubicació">
                    <button type="button" class="near-gps" data-near-gps>${PIN}<span>Utilitza la meva ubicació</span></button>
                    <p class="near-or"><span>o cerca una localitat</span></p>
                    <form data-near-form><label for="nearQuery" class="pt-sr-only">Cerca una localitat</label>
                        <div class="near-search"><input id="nearQuery" data-near-query type="search" placeholder="Vic, Gandia, Manacor…" autocomplete="off" enterkeyhint="search"><button type="submit">Cerca</button></div></form>
                    <div data-near-locations class="near-locations"></div>
                </section>
                <div class="near-type-wrap">${typeHtml('nearType')}</div>
                <p data-near-status class="near-status" role="status" aria-live="polite"></p>
                <section data-near-results class="near-results" aria-live="polite"></section>
                <p class="near-help">Catalunya, Catalunya Nord, Andorra, País Valencià i Illes Balears. La ubicació es consulta només quan ho demanes i no es desa; la localitat triada a mà es recorda en aquest dispositiu. Localitats: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> / GeoNames.</p>
            </div>
            <footer class="near-actions" hidden><button type="button" class="near-play" data-near-play disabled>${PLAY}<span>Engega la ràdio</span></button>
                <button type="button" data-near-other disabled>Altres cançons</button><button type="button" data-near-more disabled>20 artistes més</button></footer>`;
        document.body.append(dialog); state.dialog = dialog;
        $('[data-near-close]').addEventListener('click', () => dialog.close());
        // Clic fora (al fons) tanca, com els altres diàlegs de l'app.
        dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
        dialog.addEventListener('close', () => {
            state.version++; state.searchVersion++;
            // Una ràdio compartida no substitueix la zona ni el tipus de l'usuari: en tancar, es tornen a llegir els seus
            if (state.origin?.shared) { state.origin = null; state.rows = []; state.type = null; }
            // La targeta de la portada mostra la zona i les caràtules de la localitat triada ara
            const card = document.querySelector('.pt-near');
            if (card) card.outerHTML = cardHtml();
            (document.contains(state.opener) ? state.opener : document.querySelector('.pt-near [data-near-quick], .pt-near [data-near-open]'))?.focus?.();
        });
        $('[data-near-form]').addEventListener('submit', search);
        $('[data-near-query]').addEventListener('input', () => { state.searchVersion++; $('[data-near-locations]').replaceChildren(); });
        $('[data-near-gps]').addEventListener('click', locate);
        $('[data-near-share]').addEventListener('click', () => share(state.origin));
        $('[data-near-change]').addEventListener('click', () => setEditing(!dialog.classList.contains('is-editing')));
        $('[data-near-more]').addEventListener('click', () => { state.offset += PAGE; renderRows(); $('.near-body').scrollTop = 0; status('Els següents artistes per proximitat. Prem «Engega la ràdio» per escoltar-los.'); });
        $('[data-near-other]').addEventListener('click', () => { rebuild(new Set(state.rows.map(r => String(r.video.id)))); status('Selecció renovada: canviem la cançó quan l’artista en té d’altres.'); });
        $('[data-near-play]').addEventListener('click', () => {
            if (playRows()) dialog.close();
            else status('No s’ha pogut iniciar la ràdio. Surt del mode TV i torna-ho a provar.');
        });
    }
    // action: 'gps' demana la ubicació de seguida; 'search' obre el cercador de localitats.
    async function open(opener, action = '') {
        if (!state.dialog) createDialog();
        state.opener = opener; state.dialog.showModal();
        $('[data-near-gps]').disabled = true; $('[data-near-query]').disabled = true;
        $('[data-near-form] button').disabled = true;
        for (const button of state.dialog.querySelectorAll('.near-actions button')) button.disabled = true;
        const version = ++state.version;
        status('Carregant artistes i localitats…');
        try {
            await load();
            if (version !== state.version || !state.dialog.open) return;
            $('[data-near-gps]').disabled = false; $('[data-near-query]').disabled = false;
            $('[data-near-form] button').disabled = false;
            if (!state.origin) { const saved = savedPlace(); if (saved) selectPlace(saved, false); }
            else rebuild();
            setEditing(!state.origin || action === 'search');
            status(state.origin ? 'Pots escoltar la selecció o canviar la ubicació.' : 'Utilitza la teva ubicació o cerca una localitat.');
            if (action === 'gps') locate();
        } catch (_) { if (version === state.version) status('No s’han pogut carregar les dades. Tanca i torna-ho a provar.'); }
    }
    // Un toc des de la portada: engega directament la ràdio de la localitat desada.
    async function quickPlay(button) {
        const saved = savedPlace();
        if (!saved) return open(button);
        button.disabled = true;
        const label = button.querySelector('span');
        const text = label?.textContent;
        if (label) label.textContent = 'Preparant…';
        try {
            await load();
            state.origin = saved; state.offset = 0;
            computeRows();
            renderRows();
            if (!playRows()) open(button);
        } catch (_) { open(button); }
        finally { button.disabled = false; if (label) label.textContent = text; }
    }
    function shareablePlace(place) {
        return Boolean(place?.name && territories.has(place.territory) && validPoint(place.coordinates));
    }
    function shareName(place) {
        const type = currentType();
        return `A prop de ${place.name}${type === 'mix' ? '' : ` · ${TYPES.find(t => t.id === type).label}`}`;
    }
    // Comparteix la ràdio amb la localitat triada (nom + coordenades del municipi) i el tipus de ràdio.
    function share(place) {
        const codecs = app.utils?.shareCodecs;
        if (!shareablePlace(place) || !codecs) {
            status('Per compartir-la, tria una localitat (la ubicació del GPS no es comparteix).');
            return null;
        }
        const name = shareName(place);
        const url = codecs.buildImportUrl(codecs.buildImportPayload({ type: 'nearby', name, place, kind: currentType() }));
        if (!url) return null;
        // El diàleg és modal (capa superior): la finestra de compartir quedaria a sota i no es podria tocar
        if (state.dialog?.open) state.dialog.close();
        if (typeof _showShareOptionsModal === 'function') {
            // La pàgina compartir/radio/radio-<municipi>.html fa que WhatsApp digui «Ràdio Vic»
            const show = extra => _showShareOptionsModal('Ràdio', name, url, { type: 'radio', count: PAGE, ...extra });
            if (typeof radioLinkOptions === 'function') radioLinkOptions(name, url).then(show, () => show({}));
            else show({});
        }
        return url;
    }
    // Llegeix el lloc d'un enllaç compartit; null si no és d'un dels cinc territoris o les coordenades no valen.
    function placeFromPayload(payload) {
        const p = payload?.place || {};
        const place = { name: String(p.n || '').slice(0, 80), territory: String(p.t || ''), coordinates: { latitude: Number(p.lat), longitude: Number(p.lon) }, shared: true };
        return shareablePlace(place) ? place : null;
    }
    async function openShared(payload) {
        const place = placeFromPayload(payload);
        if (!place) return false;
        if (TYPES.some(t => t.id === payload.kind)) state.type = payload.kind; // només per a aquesta ràdio: no es desa
        state.origin = place; state.offset = 0;
        await open(null);
        if (state.dialog?.open && state.origin === place) status(`Ràdio compartida: artistes de prop de ${place.name}. Prem «Engega la ràdio» per escoltar-la.`);
        return true;
    }
    // Obre la ràdio d'un lloc del mapa «Música d'arreu» (no es desa com a zona de l'usuari).
    async function openPlace(point) {
        const place = { name: String(point?.name || ''), territory: String(point?.territory || ''), coordinates: point?.coordinates, shared: true };
        if (!place.name || !validPoint(place.coordinates)) return false;
        state.origin = place; state.offset = 0;
        await open(null);
        if (state.dialog?.open && state.origin === place) status(`Artistes de prop de ${place.name}. Prem «Engega la ràdio» per escoltar-la.`);
        return true;
    }
    function cardArtHtml(saved) {
        const rows = saved && state.card?.place === saved.name && state.card?.type === currentType() ? state.card.rows : null;
        if (!rows?.length) {
            return `<div class="pt-near__radar" aria-hidden="true"><span class="pt-near__pin">${PIN}</span><span class="pt-near__dot pt-near__dot--1"></span><span class="pt-near__dot pt-near__dot--2"></span><span class="pt-near__dot pt-near__dot--3"></span></div>`;
        }
        return `<ul class="pt-near__covers" aria-label="Els més propers">${rows.map(r => `<li><img src="${esc(cover(r.video))}" alt="" loading="lazy" decoding="async" width="96" height="96"><span class="pt-near__km">${km(r.location.distance)}</span><span class="pt-sr-only">${esc(r.artist)}</span></li>`).join('')}</ul>`;
    }
    // Les caràtules dels tres artistes més propers es calculen en segon pla i es pinten quan hi són.
    function hydrateCard() {
        const saved = savedPlace();
        if (!saved || typeof document.querySelector !== 'function') return;
        const type = currentType();
        if (state.card?.place === saved.name && state.card?.type === type) return paintCardArt();
        if (state.cardLoading) return;
        state.cardLoading = load().then(() => {
            const keep = { origin: state.origin, rows: state.rows, offset: state.offset };
            state.origin = saved; computeRows();
            state.card = { place: saved.name, type, rows: state.rows.slice(0, 3) };
            if (state.dialog?.open) Object.assign(state, keep); // no trepitgem el que es veu al diàleg
            paintCardArt();
        }).catch(() => {}).finally(() => { state.cardLoading = null; });
    }
    function paintCardArt() {
        const art = document.querySelector('.pt-near [data-near-art]');
        if (art) art.innerHTML = cardArtHtml(savedPlace());
    }
    function cardHtml() {
        const saved = savedPlace();
        const actions = saved
            ? `<button type="button" class="pt-btn pt-btn--primary pt-near__play" data-near-quick>${PLAY}<span>Engega la ràdio</span></button>
               <button type="button" class="pt-btn pt-btn--ghost pt-btn--sm" data-near-open="search">${PIN}<span>Canvia la ubicació</span></button>
               <button type="button" class="pt-btn pt-btn--ghost pt-btn--sm pt-near__share" data-near-share-card aria-label="Comparteix la ràdio de ${esc(saved.name)}">${SHARE}<span>Comparteix</span></button>`
            : `<button type="button" class="pt-btn pt-btn--primary" data-near-open="gps">${PIN}<span>Utilitza la meva ubicació</span></button>
               <button type="button" class="pt-btn pt-btn--ghost pt-btn--sm" data-near-open="search"><span>Tria una localitat</span></button>`;
        if (saved && typeof setTimeout === 'function') setTimeout(hydrateCard, 0);
        return `<section class="pt-section pt-near${saved ? ' has-place' : ''}" aria-labelledby="ptH-near" data-pt-section="near">
            <div class="pt-near__art" data-near-art>${cardArtHtml(saved)}</div>
            <div class="pt-near__body">
                <p class="pt-eyebrow">Ràdio de proximitat</p>
                <h2 class="pt-near__title" id="ptH-near">A prop teu</h2>
                <p class="pt-near__text">Escolta 20 artistes del teu voltant, del més proper al més llunyà: una cançó de cadascun.</p>
                ${saved ? `<p class="pt-near__place">${PIN}<span>La teva zona: <strong>${esc(saved.name)}</strong></span></p>` : ''}
                ${typeHtml('ptNearType')}
                <div class="pt-near__actions">${actions}</div>
            </div>
        </section>`;
    }
    function setType(type) {
        if (!TYPES.some(t => t.id === type) || type === currentType()) return;
        state.type = type;
        try { localStorage.setItem(typeKey, type); } catch (_) { /* Opcional */ }
        const hint = TYPES.find(t => t.id === type).hint;
        document.querySelectorAll('input[name="ptNearType"], input[name="nearType"]').forEach(input => { input.checked = input.value === type; });
        document.querySelectorAll('[data-near-type-hint]').forEach(el => { el.textContent = hint; });
        if (state.dialog?.open && state.origin) { state.offset = 0; rebuild(); status(''); }
        hydrateCard();
    }
    document.addEventListener('change', event => {
        const input = event.target;
        if (input?.matches?.('input[name="ptNearType"], input[name="nearType"]')) setType(input.value);
    });
    document.addEventListener('click', event => {
        if (event.target.closest?.('[data-near-share-card]')) return share(savedPlace());
        const quick = event.target.closest?.('[data-near-quick]');
        if (quick) return quickPlay(quick);
        const button = event.target.closest?.('[data-near-open]');
        if (button) open(button, button.dataset.nearOpen || '');
    });
    app.features.nearbyRadio = { savedPlace, distance, artistLocation, buildRows, remotePlace, rankByType, TYPES, cardHtml, open, quickPlay, share, openShared, openPlace, placeFromPayload };
})(window);
