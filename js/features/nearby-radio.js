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
    function remotePlace(item) {
        if (!/^PPL/.test(item.feature_code || '')) return null;
        const territory = item.country_code === 'AD' ? 'Andorra' : item.country_code === 'FR' && item.admin2_id === 2984885 ? 'Catalunya Nord' :
            item.country_code === 'ES' ? ({ 3336901: 'Catalunya', 2593113: 'País Valencià', 2521383: 'Illes Balears' })[item.admin1_id] : null;
        const coordinates = { latitude: item.latitude, longitude: item.longitude };
        if (!territory || !validPoint(coordinates)) return null;
        return { id: `geonames:${item.id}`, name: item.name, territory, detail: item.admin3 || item.admin2 || '', coordinates, type: 'municipality' };
    }
    const state = { catalog: null, references: null, videos: [], origin: null, rows: [], offset: 0, version: 0, searchVersion: 0, dialog: null };
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
        const history = await youtube.ensureStyleHistory();
        const pool = youtube.filterHiddenVideos([...(youtube.feedVideos || []), ...(history || [])]);
        state.videos = app.features.musicQueue.nearbyPool(pool);
    }
    function localPlaces(query) {
        return Object.entries({ ...state.catalog?.places, ...state.references?.places })
            .filter(([, p]) => p.type === 'municipality' && territories.has(p.territory) && validPoint(p.coordinates) && fold(p.name).includes(fold(query)))
            .map(([id, p]) => ({ ...p, id }));
    }
    const $ = selector => state.dialog.querySelector(selector);
    function status(message) { $('[data-near-status]').textContent = message; }
    function renderRows() {
        const batch = state.rows.slice(state.offset, state.offset + 20);
        $('[data-near-results]').innerHTML = batch.length ? `<p><strong>${esc(state.origin.name)}</strong> · ${batch.length} artistes, del més proper al més llunyà</p><ol start="${state.offset + 1}">${batch.map(row => `<li><strong>${esc(row.artist)}</strong><span>${esc(row.video.title)}</span><small>${row.relation === 'associated' ? 'Vinculat a ' : ''}${esc(row.location.name)} · ${row.location.distance < 1 ? 'menys d’1' : Math.round(row.location.distance)} km aprox.${row.location.approximate ? ` · referència: ${esc(row.location.reference)}` : ''}</small></li>`).join('')}</ol>` : '<p>No hem trobat artistes amb cançons disponibles i localització revisada.</p>';
        $('[data-near-play]').disabled = !batch.length;
        $('[data-near-more]').disabled = state.offset + 20 >= state.rows.length;
        $('[data-near-other]').disabled = !batch.length;
    }
    function rebuild(avoidIds = new Set()) {
        const selection = app.features.musicSelection;
        const signals = app.features.musicSignals?.snapshot?.();
        state.rows = buildRows({ videos: state.videos, origin: state.origin.coordinates, catalog: state.catalog, references: state.references, avoidIds,
            rank: tracks => selection?.isEnabled?.() ? selection.rankFeed(tracks, { ctx: selection.getAppContext(state.videos), signals }) : tracks });
        renderRows();
    }
    function selectPlace(place, manual = true) {
        state.version++; state.searchVersion++;
        state.origin = place; state.offset = 0;
        $('[data-near-locations]').replaceChildren();
        if (manual) {
            try { localStorage.setItem(storageKey, JSON.stringify({ id: place.id, name: place.name, territory: place.territory, coordinates: place.coordinates })); } catch (_) { /* Opcional */ }
        }
        rebuild(); status('Distàncies en línia recta. Per a comarques i illes fem servir la capital o referència indicada.');
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
            $('[data-near-locations]').innerHTML = unique.map((p, i) => `<button type="button" data-near-place="${i}">${esc(p.name)}<small>${esc(p.detail ? p.detail + ' · ' : '')}${esc(p.territory)}</small></button>`).join('');
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
        const dialog = document.createElement('dialog'); dialog.className = 'near-dialog';
        dialog.setAttribute('aria-labelledby', 'nearTitle');
        dialog.innerHTML = `<div class="near-heading"><h2 id="nearTitle">A prop teu</h2><button type="button" data-near-close aria-label="Tanca">×</button></div>
            <p>20 artistes, una cançó de cadascun, per ordre de proximitat.</p>
            <button type="button" data-near-gps>Utilitza la meva ubicació</button>
            <form data-near-form><label for="nearQuery">O tria una localitat</label><div class="near-search"><input id="nearQuery" data-near-query type="search" placeholder="Població" autocomplete="off"><button type="submit">Cerca</button></div></form>
            <p class="near-help">Catalunya, Catalunya Nord, Andorra, País Valencià i Illes Balears. La ubicació es consulta només quan ho demanes i no es desa.</p>
            <div data-near-locations class="near-locations"></div><p data-near-status role="status" aria-live="polite"></p>
            <div class="near-actions"><button type="button" data-near-play disabled>Engega la ràdio</button><button type="button" data-near-other disabled>Altres cançons</button><button type="button" data-near-more disabled>20 artistes més</button></div>
            <div data-near-results></div><p class="near-help">Localitats: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> / GeoNames. La localitat triada manualment es recorda en aquest dispositiu.</p>`;
        document.body.append(dialog); state.dialog = dialog;
        $('[data-near-close]').addEventListener('click', () => dialog.close());
        dialog.addEventListener('close', () => { state.version++; state.searchVersion++; state.opener?.focus(); });
        $('[data-near-form]').addEventListener('submit', search);
        $('[data-near-query]').addEventListener('input', () => { state.searchVersion++; $('[data-near-locations]').replaceChildren(); });
        $('[data-near-gps]').addEventListener('click', locate);
        $('[data-near-more]').addEventListener('click', () => { state.offset += 20; renderRows(); status('Els següents artistes per proximitat. Prem «Engega la ràdio» per escoltar-los.'); });
        $('[data-near-other]').addEventListener('click', () => { rebuild(new Set(state.rows.map(r => String(r.video.id)))); status('Selecció renovada: canviem la cançó quan l’artista té alternatives disponibles.'); });
        $('[data-near-play]').addEventListener('click', () => {
            const videos = state.rows.slice(state.offset, state.offset + 20).map(r => ({ ...r.video, nearbyLocation: `${r.location.name} · ${Math.round(r.location.distance)} km aprox.${r.location.approximate ? ' · ref. ' + r.location.reference : ''}` }));
            if (app.features.musicQueue.playSelection(videos, `A prop teu · ${state.origin.name}`)) dialog.close();
            else status('No s’ha pogut iniciar la ràdio. Surt del mode TV i torna-ho a provar.');
        });
    }
    async function open(opener) {
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
            if (state.origin) rebuild();
            else {
                try { const saved = JSON.parse(localStorage.getItem(storageKey)); if (saved?.name && territories.has(saved.territory) && validPoint(saved.coordinates)) selectPlace(saved, false); } catch (_) { /* Sense preferència */ }
            }
            status(state.origin ? 'Pots escoltar la selecció o canviar la ubicació.' : 'Utilitza la ubicació o cerca una localitat.');
        } catch (_) { if (version === state.version) status('No s’han pogut carregar les dades. Tanca i torna-ho a provar.'); }
    }
    function cardHtml() {
        return '<section class="pt-near" aria-label="Descoberta per proximitat"><div><h2>A prop teu</h2><p>Descobreix 20 artistes, del més proper al més llunyà.</p></div><button type="button" data-near-open>Tria una ubicació</button></section>';
    }
    document.addEventListener('click', event => { const button = event.target.closest?.('[data-near-open]'); if (button) open(button); });
    app.features.nearbyRadio = { distance, artistLocation, buildRows, remotePlace, cardHtml, open };
})(window);
