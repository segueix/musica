// Fitxa d'artista: les dues ràdios de dalt de tot, la foto gran amb el nom i la presentació curta que es pot
// expandir. Implementació directa (patró 2); el que no toca el DOM és pur i testable:
//  - artistStyles(): estils de l'artista (el principal primer) per a la «ràdio de l'estil»;
//  - radiosModel(): quines ràdios es poden engegar i amb quin text;
//  - bioModel(): presentació neta (sense text de farciment).
// La fitxa la pinta openChannelProfileLegacyImpl() (app.js), que crida showProfile() i setSongs().
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;

    // Vistes generals o «calaix» que no són un estil per a una ràdio.
    const EXCLUDED_STYLES = new Set(['altres estils', 'novetats', 'descobreix', 'seguint', 'tot']);
    // Una combinació de tres estils ja és una barreja prou àmplia; més la diluiria.
    const MAX_STYLES = 3;
    const MIN_SONGS = 2;
    const ALBUMS_URL = 'data/albums-musica.json';
    const OTHER_ALBUM_ID = '__other';

    const text = value => String(value ?? '').trim();
    const escapeHtml = value =>
        String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

    // Estils de l'artista per a la ràdio d'estil: el principal (base d'artistes) primer, sense repetits ni vistes
    // generals, com a màxim MAX_STYLES. `labels`: noms canònics de les categories (el feed els pot dur en minúscules).
    function artistStyles({ categories = [], primary = '', labels = [] } = {}) {
        const canonical = new Map(
            (Array.isArray(labels) ? labels : []).map(label => [text(label).toLowerCase(), text(label)])
        );
        const seen = new Set();
        return [primary, ...(Array.isArray(categories) ? categories : [])]
            .map(text)
            .filter(Boolean)
            .map(name => canonical.get(name.toLowerCase()) || name)
            .filter(name => {
                const key = name.toLowerCase();
                if (EXCLUDED_STYLES.has(key) || seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .slice(0, MAX_STYLES);
    }

    // Cançons de l'artista que poden sonar en una ràdio (sense Shorts).
    function songsOf(videos) {
        return (Array.isArray(videos) ? videos : []).filter(video => video && video.id && !video.isShort);
    }

    // Estat de les dues ràdios: `loading` mentre encara no han arribat les cançons del canal.
    function radiosModel({ name = '', styles = [], songCount = 0, loading = false } = {}) {
        const artist = text(name) || 'l’artista';
        const list = Array.isArray(styles) ? styles : [];
        const artistReady = !loading && songCount >= MIN_SONGS;
        const styleReady = !loading && list.length > 0;
        return {
            artist: {
                enabled: artistReady,
                label: `Ràdio de ${artist}: només les seves cançons`,
                hint: artistReady
                    ? `Només cançons de ${artist}`
                    : loading
                      ? 'Carregant les cançons…'
                      : 'Calen almenys dues cançons per fer una ràdio',
            },
            style: {
                enabled: styleReady,
                styles: list,
                label: list.length ? `Ràdio de l’estil: ${list.join(', ')}` : 'Ràdio de l’estil',
                hint: styleReady
                    ? `Estil: ${list.join(' · ')}`
                    : loading
                      ? 'Carregant els estils…'
                      : 'Aquest artista encara no té cap estil assignat',
            },
        };
    }

    // Discos visibles en aquesta fitxa. El catàleg es carrega només en obrir un artista.
    // Un mateix disc pot tenir pistes Topic i videoclips oficials; només compten els IDs que existeixen a la fitxa.
    function albumsModel(catalog, { channelId = '', videos = [] } = {}) {
        const id = text(channelId);
        const artist = text(catalog?.channels?.[id]);
        const entry = artist ? catalog?.artists?.[artist] : null;
        const songs = songsOf(videos);
        const songIds = new Set(songs.map(video => String(video.id)));
        const albums = (Array.isArray(entry?.albums) ? entry.albums : [])
            .map(album => ({
                ...album,
                visibleTrackIds: (Array.isArray(album?.trackGroups)
                    ? album.trackGroups.map(track => (track.videoIds || []).find(id => songIds.has(String(id)))).filter(Boolean)
                    : Array.isArray(album?.trackIds) ? album.trackIds : [])
                    .map(String)
                    .filter(trackId => songIds.has(trackId)),
            }))
            .filter(album => album.visibleTrackIds.length > 0);
        const assigned = new Set(albums.flatMap(album => album.trackIds || album.visibleTrackIds));
        const otherIds = songs.map(video => String(video.id)).filter(videoId => !assigned.has(videoId));
        return { artist, albums, otherIds, hasAlbums: albums.length > 0 };
    }

    // Presentació: el text net (en conserva els salts de línia, però no més d'un de buit seguit).
    function bioModel(description) {
        const clean = text(description)
            .replace(/\r\n?/g, '\n')
            .replace(/\n{3,}/g, '\n\n');
        return { text: clean, hasText: clean.length > 0 };
    }

    // ---------- DOM ----------

    const state = {
        channelId: '',
        name: '',
        styles: [],
        songs: [],
        loading: false,
        program: false,
        albums: { artist: '', albums: [], otherIds: [], hasAlbums: false },
        selectedAlbumId: '',
    };
    let bound = false;
    let albumsPromise = null;
    let originsPromise = null;
    let originRequest = 0;

    const $ = id => window.document?.getElementById?.(id) || null;

    // Només les assignacions revisades; els canals oficials i Topic comparteixen artista.
    function originModel(catalog, channelId) {
        if (catalog?.schemaVersion !== 1) return null;
        const key = catalog?.channels?.[text(channelId)];
        const entry = key ? catalog?.artists?.[key] : null;
        if (entry?.status !== 'validated' || !Array.isArray(entry.placeIds)) return null;
        const places = entry.placeIds.map(id => catalog.places?.[id]).filter(place => text(place?.name));
        if (!places.length || places.length !== entry.placeIds.length) return null;
        const label = entry.relation === 'origin' ? 'Origen' : entry.relation === 'associated' ? 'Vinculat a' : '';
        if (!label) return null;
        const sources = (Array.isArray(entry.sources) ? entry.sources : []).filter(url => /^https:\/\//i.test(url));
        if (!sources.length) return null;
        return {
            label,
            places,
            basis: text(entry.basis),
            sources,
        };
    }

    function originHtml(model) {
        if (!model) return '';
        const names = model.places.map(place => escapeHtml(place.name)).join(' · ');
        return `<summary>${escapeHtml(model.label)}: ${names}</summary>
            <div class="ap-origin__details"><p>${escapeHtml(model.basis)}</p>
            <ul>${model.sources.map((url, index) => `<li><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Font ${index + 1}</a></li>`).join('')}</ul></div>`;
    }

    async function loadOrigins() {
        if (!originsPromise) {
            originsPromise = (async () => {
                try {
                    const path = 'data/origens-artistes.json';
                    const response = await window.fetch(window.appDataUrl?.(path) || path, { cache: 'no-store' });
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    return await response.json();
                } catch (_error) {
                    return null;
                }
            })();
        }
        const result = await originsPromise;
        // Una fallada temporal no ha d'amagar l'origen durant tota la sessió.
        if (!result) originsPromise = null;
        return result;
    }

    async function showOrigin(channelId, program) {
        const request = ++originRequest;
        const section = $('apOrigin');
        if (!section) return;
        section.hidden = true;
        section.open = false;
        section.innerHTML = '';
        if (program || !channelId) return;
        const catalog = await loadOrigins();
        if (request !== originRequest || state.channelId !== channelId) return;
        const model = originModel(catalog, channelId);
        section.innerHTML = originHtml(model);
        section.hidden = !model;
    }

    function toast(message) {
        const fn = app.features.shellNav?.toast;
        if (typeof fn === 'function') fn(message);
    }

    function hideAlbums() {
        const section = $('apAlbums');
        if (section) section.hidden = true;
        const grid = $('apAlbumsGrid');
        if (grid) grid.innerHTML = '';
        state.albums = { artist: '', albums: [], otherIds: [], hasAlbums: false };
        state.selectedAlbumId = '';
    }

    async function loadAlbumsCatalog() {
        const api = typeof YouTubeAPI !== 'undefined' ? YouTubeAPI : window.YouTubeAPI;
        if (typeof api?.loadAlbumsCatalog === 'function') return api.loadAlbumsCatalog();
        if (albumsPromise) return albumsPromise;
        albumsPromise = (async () => {
            try {
                const url = typeof window.appDataUrl === 'function' ? window.appDataUrl(ALBUMS_URL) : ALBUMS_URL;
                const response = await window.fetch(url, { cache: 'no-store' });
                if (!response.ok) return null;
                return await response.json();
            } catch (error) {
                console.warn('Discos no disponibles:', error);
                return null;
            }
        })();
        return albumsPromise;
    }

    function albumCover(videoId) {
        return videoId ? `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg` : '';
    }

    function availableSongsLabel(count) {
        const total = Math.max(0, Number(count) || 0);
        return total === 1 ? '1 cançó disponible' : `${total} cançons disponibles`;
    }

    function renderAlbums() {
        const section = $('apAlbums');
        const grid = $('apAlbumsGrid');
        const all = $('apAlbumsAll');
        if (!section || !grid || state.program || !state.albums.hasAlbums) {
            if (section) section.hidden = true;
            return;
        }

        const selected = state.selectedAlbumId;
        if (all) all.classList.toggle('is-active', !selected);
        grid.innerHTML = [
            ...state.albums.albums.map(album => {
                const count = album.visibleTrackIds.length;
                const kind = { album: 'Àlbum', ep: 'EP', single: 'Senzill', live: 'Directe' }[album.type] || '';
                const meta = [kind, album.year || '', availableSongsLabel(count)].filter(Boolean).join(' · ');
                return `
                    <button class="ap-album-card ${selected === album.id ? 'is-active' : ''}" type="button"
                        data-ap-album="${escapeHtml(album.id)}" aria-pressed="${selected === album.id}">
                        <img class="ap-album-cover" src="${escapeHtml(/^https:\/\//.test(album.coverUrl || '') ? album.coverUrl : albumCover(album.coverVideoId))}"
                            alt="Caràtula de ${escapeHtml(album.title)}" loading="lazy">
                        <span class="ap-album-title">${escapeHtml(album.title)}</span>
                        <span class="ap-album-meta">${escapeHtml(meta)}</span>
                    </button>`;
            }),
            state.albums.otherIds.length
                ? `<button class="ap-album-card ap-album-card--other ${selected === OTHER_ALBUM_ID ? 'is-active' : ''}"
                        type="button" data-ap-album="${OTHER_ALBUM_ID}" aria-pressed="${selected === OTHER_ALBUM_ID}">
                        <span class="ap-album-other-icon" aria-hidden="true">♪</span>
                        <span class="ap-album-title">Singles i altres</span>
                        <span class="ap-album-meta">${availableSongsLabel(state.albums.otherIds.length)}</span>
                   </button>`
                : '',
        ].join('');
        section.hidden = false;
    }

    async function loadAndRenderAlbums(channelId, videos) {
        if (state.program) return hideAlbums();
        const expected = text(channelId);
        const catalog = await loadAlbumsCatalog();
        if (expected !== state.channelId) return;
        state.albums = albumsModel(catalog, { channelId: expected, videos });
        state.selectedAlbumId = '';
        renderAlbums();
    }

    function selectAlbum(albumId = '') {
        const next = text(albumId);
        const valid =
            !next ||
            next === OTHER_ALBUM_ID ||
            state.albums.albums.some(album => String(album.id) === next);
        if (!valid) return false;
        state.selectedAlbumId = next;
        renderAlbums();
        const query =
            text($('channelSearchInputDesktop')?.value) ||
            text($('channelSearchInputMobile')?.value);
        if (typeof window.renderChannelVideos === 'function') window.renderChannelVideos(query);
        return true;
    }

    function filterSongs(videos, channelId = '') {
        const list = Array.isArray(videos) ? videos : [];
        if (channelId && text(channelId) !== state.channelId) return list;
        const selected = state.selectedAlbumId;
        if (!selected) return list;
        const ids =
            selected === OTHER_ALBUM_ID
                ? new Set(state.albums.otherIds)
                : new Set(
                      state.albums.albums.find(album => String(album.id) === selected)?.visibleTrackIds || []
                  );
        const filtered = list.filter(video => ids.has(String(video?.id || '')));
        if (selected === OTHER_ALBUM_ID) return filtered;
        const order = new Map([...ids].map((id, index) => [id, index]));
        return filtered.sort((a, b) => order.get(String(a.id)) - order.get(String(b.id)));
    }

    const isAlbumFilterActive = () => Boolean(state.selectedAlbumId);

    function renderRadios() {
        const wrap = $('apRadios');
        if (!wrap) return;
        wrap.hidden = state.program;
        const model = radiosModel({
            name: state.name,
            styles: state.styles,
            songCount: state.songs.length,
            loading: state.loading,
        });
        [
            ['apRadioArtist', model.artist],
            ['apRadioStyle', model.style],
        ].forEach(([id, item]) => {
            const button = $(id);
            if (!button) return;
            button.disabled = !item.enabled;
            button.title = item.hint;
            button.setAttribute('aria-label', item.label);
        });
    }

    // Tres línies de presentació; el botó només hi és si el text no hi cap.
    function measureBio() {
        const desc = $('channelProfileDescription');
        const toggle = $('apBioToggle');
        if (!desc || !toggle) return;
        if (desc.classList.contains('is-collapsed')) {
            toggle.hidden = !(desc.scrollHeight - desc.clientHeight > 1);
        }
    }

    function setBio(description) {
        const section = $('apBio');
        const desc = $('channelProfileDescription');
        const toggle = $('apBioToggle');
        if (!section || !desc || !toggle) return;
        const bio = bioModel(description);
        desc.textContent = bio.text;
        desc.classList.add('is-collapsed');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = 'Llegeix-ne més';
        toggle.hidden = true;
        section.hidden = !bio.hasText;
        if (bio.hasText) window.requestAnimationFrame?.(measureBio);
    }

    function toggleBio() {
        const desc = $('channelProfileDescription');
        const toggle = $('apBioToggle');
        if (!desc || !toggle) return;
        const expanded = desc.classList.toggle('is-collapsed') === false;
        toggle.setAttribute('aria-expanded', String(expanded));
        toggle.textContent = expanded ? 'Mostra’n menys' : 'Llegeix-ne més';
        if (!expanded) measureBio();
    }

    // Obre la fitxa: presentació, estils i ràdios (encara sense cançons: s’habiliten amb setSongs()).
    function showProfile({ channelId = '', name = '', description = '', categories = [], program = false } = {}) {
        state.channelId = text(channelId);
        state.name = text(name);
        state.program = Boolean(program);
        state.songs = [];
        state.loading = true;
        hideAlbums();
        const music = window.SegueixMusicCategories;
        state.styles = artistStyles({
            categories: [...(music?.categoriesForChannel?.(state.channelId) || []), ...categories],
            primary: music?.primaryCategoryForChannel?.(state.channelId) || '',
            labels: (music?.CATEGORY_GROUPS || []).map(group => group.label),
        });
        setBio(description);
        void showOrigin(state.channelId, state.program);
        renderRadios();
        // «Les teves categories»: afegir o treure aquest grup de les categories pròpies (user-categories.js)
        app.features.userCategories?.showForArtist?.({ channelId: state.channelId, name: state.name, program });
        bindOnce();
    }

    // Cançons ja carregades del canal: habilita la ràdio de l'artista.
    function setSongs(videos, channelId = '') {
        if (channelId && text(channelId) !== state.channelId) return;
        state.songs = songsOf(videos);
        state.loading = false;
        renderRadios();
        void loadAndRenderAlbums(state.channelId, state.songs);
    }

    function startArtistRadio() {
        const started = app.features.musicQueue?.startArtistRadio?.(state.songs, {
            name: state.name,
            channelId: state.channelId,
        });
        if (!started) toast('No s’ha pogut engegar la ràdio ara mateix.');
        return Boolean(started);
    }

    function startStyleRadio() {
        const started = app.features.musicQueue?.startStyleRadio?.(state.styles);
        if (!started) toast('Aquest estil té massa poques cançons per fer una ràdio.');
        return Boolean(started);
    }

    function onClick(event) {
        const target = event.target;
        const radio = target?.closest?.('[data-ap-radio]');
        if (radio && !radio.disabled) {
            return radio.dataset.apRadio === 'style' ? startStyleRadio() : startArtistRadio();
        }
        const album = target?.closest?.('[data-ap-album]');
        if (album) return selectAlbum(album.dataset.apAlbum || '');
        if (target?.closest?.('#apBioToggle')) return toggleBio();
        return undefined;
    }

    function bindOnce() {
        if (bound) return;
        const page = $('channelPage');
        if (!page) return;
        bound = true;
        page.addEventListener('click', onClick);
        window.addEventListener('resize', measureBio, { passive: true });
    }

    app.features.artistPage = {
        artistStyles,
        songsOf,
        radiosModel,
        bioModel,
        originModel,
        originHtml,
        albumsModel,
        availableSongsLabel,
        showProfile,
        setSongs,
        selectAlbum,
        filterSongs,
        isAlbumFilterActive,
        startArtistRadio,
        startStyleRadio,
        measureBio,
    };
})(window);
