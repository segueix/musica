// Fitxa d'artista: la foto de perfil de fons amb el nom, els subscriptors, l'origen, les ràdios i compartir al damunt;
// al costat, la cançó més escoltada; a sota, caràtules de vídeo grans: els videoclips i els directes (si en té) i
// totes les cançons per visualitzacions. Cada play engega una ràdio de l'artista que comença per aquella cançó.
// La fitxa ja no mostra discos (2026-10-16).
// Implementació directa (patró 2); el que no toca el DOM és pur i testable:
//  - artistStyles(): estils de l'artista (el principal primer) per a la «ràdio de l'estil»;
//  - radiosModel(): quines ràdios es poden engegar i amb quin text;
//  - bioModel(): presentació neta (sense text de farciment);
//  - songsModel(): la més escoltada, videoclips, directes i la resta, per visualitzacions;
//  - bestHtml(), shelvesHtml(), songCardsHtml(): HTML de cada bloc.
// La fitxa la pinta openChannelProfileLegacyImpl() (app.js), que crida showProfile(), setSongs() i renderSongs().
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;

    // Vistes generals o «calaix» que no són un estil per a una ràdio.
    const EXCLUDED_STYLES = new Set(['altres estils', 'novetats', 'descobreix', 'seguint', 'tot']);
    // Una combinació de tres estils ja és una barreja prou àmplia; més la diluiria.
    const MAX_STYLES = 3;
    const MIN_SONGS = 2;
    // Cançons de la llista que es veuen d'entrada i quantes més se n'hi afegeixen amb «Mostra'n més».
    const LIST_FIRST = 18;
    const LIST_STEP = 24;
    // Videoclips i directes: una fila amb scroll lateral; més enllà d'aquest nombre van a la llista.
    const SHELF_MAX = 24;
    const PLAY_ICON =
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 5.6v12.8a1 1 0 0 0 1.5.86l10.2-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6Z"/></svg>';
    // El mateix símbol que «Afegeix a la cua» de la portada (el «+» sol és «afegeix a una llista»)
    const QUEUE_ICON =
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 6h11M4 12h7M4 18h7M15 13v7M11.5 16.5h7"/></svg>';
    const PIN_ICON =
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

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
        const styleReady = !loading && list.length > 0 && songCount > 0;
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

    // Presentació: el text net (en conserva els salts de línia, però no més d'un de buit seguit).
    function bioModel(description) {
        const clean = text(description)
            .replace(/\r\n?/g, '\n')
            .replace(/\n{3,}/g, '\n\n');
        return { text: clean, hasText: clean.length > 0 };
    }

    // ---------- Cançons: la més escoltada, videoclips, directes i la resta ----------

    const viewsOf = video => Math.max(0, Number(video?.viewCount ?? video?.views) || 0);

    // 1234 → «1,2 k»; 2500000 → «2,5 M» (amb coma decimal, com en català).
    function formatCount(value) {
        const n = Math.max(0, Math.round(Number(value) || 0));
        const short = (num, unit) => `${(Math.round(num * 10) / 10).toString().replace('.', ',')} ${unit}`;
        if (n >= 1e6) return short(n / 1e6, 'M');
        if (n >= 1e4) return `${Math.round(n / 1e3)} k`;
        if (n >= 1e3) return short(n / 1e3, 'k');
        return String(n);
    }

    function viewsLabel(value) {
        const n = Math.max(0, Math.round(Number(value) || 0));
        if (!n) return '';
        return n === 1 ? '1 visualització' : `${formatCount(n)} visualitzacions`;
    }

    function subscribersLabel(value) {
        const n = Math.max(0, Math.round(Number(value) || 0));
        if (!n) return '';
        return n === 1 ? '1 subscriptor' : `${formatCount(n)} subscriptors`;
    }

    function formatDuration(seconds) {
        const total = Math.round(Number(seconds) || 0);
        if (total <= 0) return '';
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const sec = String(total % 60).padStart(2, '0');
        return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
    }

    // Any de la cançó: l'original si se sap (un disc antic pujat ara és del seu any), si no el de publicació.
    function songYear(video) {
        const original = Number(video?.originalYear);
        if (original > 1800) return original;
        const published = Number(String(video?.publishedAt || video?.uploadDate || '').slice(0, 4));
        return published > 1900 ? published : 0;
    }

    // Foto de perfil a la mida gran (els avatars de YouTube porten «=s88…» o «=s240…») i sempre per https.
    function heroImage(url) {
        const src = text(url).replace(/^http:\/\//i, 'https://');
        if (!/^(https:\/\/|img\/|\.\/)/i.test(src)) return '';
        return /\/\/yt3\.(ggpht|googleusercontent)\.com\//i.test(src) ? src.replace(/=s\d+(?=-|$)/, '=s800') : src;
    }

    // Imatge d'una cançó. `square`: caràtula quadrada; `mqdefault` (16:9 sense franges negres) en retalla el centre,
    // que en una pista «Tema» és la caràtula sencera.
    function artOf(video, { square = false, large = false } = {}) {
        const id = encodeURIComponent(text(video?.id));
        const own = text(video?.thumbnail);
        // La maxresdefault del feed és la més nítida (YouTube la dona en desar el vídeo al feed, així que existeix).
        if (large && /^https:\/\/i\.ytimg\.com\/vi\/[^/]+\/maxresdefault\.jpg$/i.test(own)) return own;
        if (!id) return '';
        return `https://i.ytimg.com/vi/${id}/${square && !large ? 'mqdefault' : 'hqdefault'}.jpg`;
    }

    // `hqdefault` és 4:3 amb franges negres a dalt i a baix: en un requadre quadrat s'amplia per treure-les.
    const isLetterboxed = src => /\/hqdefault\.jpg$/i.test(src);

    const LIVE_RE = /(\ben\s+directe\b|\(directe\)|\[directe\]|\blive\b|\ben\s+viu\b|\bconcert\b)/i;

    function isLive(video) {
        const type = text(video?.contentType).toLowerCase().replace(/-/g, '_');
        if (type === 'live_song') return true;
        return LIVE_RE.test(text(video?.originalTitle) || text(video?.title));
    }

    // Separa les cançons per visualitzacions: la més escoltada, els videoclips (`isClip`, el mateix criteri que
    // «Videoclips oficials» de la portada), els directes i la resta. Cap cançó no surt dues vegades.
    function songsModel(videos, { isClip = () => false, shelfMax = SHELF_MAX } = {}) {
        const seen = new Set();
        const list = (Array.isArray(videos) ? videos : [])
            .filter(video => {
                const id = text(video?.id);
                if (!id || video.isShort || seen.has(id)) return false;
                seen.add(id);
                return true;
            })
            .map((video, index) => ({ video, index }))
            .sort((a, b) => viewsOf(b.video) - viewsOf(a.video) || a.index - b.index)
            .map(item => item.video);
        const best = list[0] || null;
        const others = list.slice(1);
        const lives = [];
        const clips = [];
        const rest = [];
        others.forEach(video => {
            if (isLive(video)) lives.push(video);
            else if (isClip(video)) clips.push(video);
            else rest.push(video);
        });
        // Una fila amb una sola cançó no és una secció: va a la llista.
        const shelf = items => (items.length >= 2 ? items.slice(0, shelfMax) : []);
        const shown = new Set([...shelf(clips), ...shelf(lives)].map(video => text(video.id)));
        return {
            best,
            clips: shelf(clips),
            lives: shelf(lives),
            rest: others.filter(video => !shown.has(text(video.id))),
            all: list,
            total: list.length,
        };
    }

    function metaLine(video, extra = []) {
        const year = songYear(video);
        return [...extra, viewsLabel(viewsOf(video)), year ? String(year) : ''].filter(Boolean).join(' · ');
    }

    // «La més escoltada»: caràtula gran amb el play (ràdio de l'artista que hi comença), títol i visualitzacions.
    function bestHtml(video, { artist = '' } = {}) {
        if (!video?.id) return '';
        const id = escapeHtml(video.id);
        const title = escapeHtml(text(video.title) || 'Cançó');
        const kind = isLive(video) ? 'Directe' : '';
        const art = artOf(video, { square: true, large: true });
        const label = `Ràdio de ${text(artist) || 'l’artista'} a partir de «${text(video.title) || 'la cançó'}»`;
        return `
            <p class="pt-eyebrow ap-best__eyebrow" id="apBestTitle">La més escoltada</p>
            <button class="ap-best__art" type="button" data-ap-play="${id}" data-ap-from="best" aria-label="${escapeHtml(label)}">
                <img src="${escapeHtml(art)}" alt="" decoding="async"${isLetterboxed(art) ? ' class="is-letterboxed"' : ''}>
                <span class="ap-play ap-play--lg" aria-hidden="true">${PLAY_ICON}</span>
            </button>
            <div class="ap-best__text">
                <h2 class="ap-best__title">${title}</h2>
                <p class="ap-best__meta">${escapeHtml(metaLine(video, kind ? [kind] : []))}</p>
            </div>
            <button class="ap-radio ap-radio--artist ap-best__btn" type="button" data-ap-play="${id}" data-ap-from="best"
                aria-label="${escapeHtml(label)}">${PLAY_ICON}<span>Ràdio a partir d’aquesta</span></button>`;
    }

    const EYE_ICON =
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M1.5 12S5 5 12 5s10.5 7 10.5 7S19 19 12 19 1.5 12 1.5 12Z"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

    // Mida de cada caràtula segons les visualitzacions (relatives a la més escoltada del conjunt): 'xl' (3 × 3) les
    // que en tenen almenys el 60 %, 'l' (2 × 2) les que en tenen almenys el 28 % i 's' (1 × 1) la resta. La primera
    // sempre és 'xl'; com a molt MAX_XL grans i un terç de mitjanes, perquè el mosaic no sigui tot igual.
    const MAX_XL = 3;
    function sizeTiers(videos) {
        const list = Array.isArray(videos) ? videos : [];
        const max = Math.max(1, ...list.map(viewsOf));
        const maxL = Math.max(1, Math.ceil(list.length / 3));
        let xl = 0;
        let l = 0;
        return list.map((video, index) => {
            const ratio = viewsOf(video) / max;
            if (index === 0 || (ratio >= 0.6 && xl < MAX_XL)) {
                xl += 1;
                return 'xl';
            }
            if (ratio >= 0.28 && l < maxL) {
                l += 1;
                return 'l';
            }
            return 's';
        });
    }

    // Caràtula quadrada amb les dades al damunt (estil fanzín punk): el número (posició per visualitzacions), les
    // visualitzacions en un adhesiu, el títol en cinta, l'any i la durada, «Afegeix a la cua» i el play. Tota la
    // caràtula engega la ràdio que comença per la cançó. `size`: 'xl' | 'l' | 's' (sizeTiers()).
    function cardHtml(video, { from = 'list', rank = 0, size = 's' } = {}) {
        const id = escapeHtml(video.id);
        const title = text(video.title) || 'Cançó';
        const duration = formatDuration(video.durationSeconds);
        const views = viewsOf(video);
        const year = songYear(video);
        const art = artOf(video, { square: true, large: true });
        const live = isLive(video) && from !== 'lives';
        const facts = [year ? String(year) : '', duration].filter(Boolean).join(' · ');
        const label = [`Ràdio a partir de «${title}»`, viewsLabel(views), year ? String(year) : '']
            .filter(Boolean)
            .join(', ');
        const tier = ['xl', 'l', 's'].includes(size) ? size : 's';
        return `
            <li class="ap-card ap-card--${tier}">
                <button class="ap-card__art" type="button" data-ap-play="${id}" data-ap-from="${from}"
                    aria-label="${escapeHtml(label)}">
                    <img src="${escapeHtml(art)}" alt="" loading="lazy" decoding="async"${isLetterboxed(art) ? ' class="is-letterboxed"' : ''}>
                    <span class="ap-card__ink" aria-hidden="true"></span>
                    ${rank ? `<span class="ap-card__rank" aria-hidden="true">#${rank}</span>` : ''}
                    <span class="ap-card__info" aria-hidden="true">
                        ${views ? `<span class="ap-card__views">${EYE_ICON}${formatCount(views)}</span>` : ''}
                        ${live ? '<span class="ap-card__live">Directe</span>' : ''}
                        <span class="ap-card__title"><span>${escapeHtml(title)}</span></span>
                        ${facts ? `<span class="ap-card__facts">${escapeHtml(facts)}</span>` : ''}
                    </span>
                    <span class="ap-play" aria-hidden="true">${PLAY_ICON}</span>
                </button>
                <button class="ap-card__queue" type="button" data-ap-queue="${id}" aria-label="${escapeHtml(`Afegeix a la cua: ${title}`)}" title="Afegeix a la cua">${QUEUE_ICON}</button>
            </li>`;
    }

    // Posició de cada cançó entre totes les de l'artista (per visualitzacions): «#1» és la més escoltada.
    function rankFor(model) {
        const ranks = new Map((model?.all || []).map((video, index) => [text(video.id), index + 1]));
        return video => ranks.get(text(video?.id)) || 0;
    }

    function cardsHtml(videos, { from = 'list', rankOf = () => 0, tiers = null } = {}) {
        const list = Array.isArray(videos) ? videos : [];
        const sizes = tiers || sizeTiers(list);
        return list.map((video, index) => cardHtml(video, { from, rank: rankOf(video), size: sizes[index] })).join('');
    }

    // Videoclips i directes: una fila de caràtules quadrades cadascun (només si n'hi ha almenys dos), de mida segons
    // les visualitzacions, amb la ràdio només d'aquell tipus.
    function shelvesHtml(model, { artist = '' } = {}) {
        const who = text(artist) || 'l’artista';
        const rankOf = rankFor(model);
        return [
            ['clips', 'Videoclips', model?.clips || [], `Ràdio dels videoclips de ${who}`],
            ['lives', 'Directes', model?.lives || [], `Ràdio dels directes de ${who}`],
        ]
            .filter(([, , items]) => items.length)
            .map(
                ([key, title, items, radio]) => `
            <section class="ap-shelf ap-shelf--${key}" aria-labelledby="apShelf-${key}">
                <div class="ap-section-head">
                    <h2 class="ap-section-title" id="apShelf-${key}">${title} <span class="ap-count">${items.length}</span></h2>
                    <button class="ap-chip-btn" type="button" data-ap-shelf-radio="${key}" aria-label="${escapeHtml(radio)}">${PLAY_ICON}<span>Ràdio</span></button>
                </div>
                <ul class="ap-shelf__row">${cardsHtml(items, { from: key, rankOf })}</ul>
            </section>`
            )
            .join('');
    }

    // Totes les cançons: mosaic de caràtules en l'ordre que rep (per visualitzacions). Les mides es calculen sobre
    // tota la llista (no només la pàgina que es veu) perquè no canviïn en prémer «Mostra'n més».
    function songCardsHtml(videos, { model = null, all = null, from = 'list' } = {}) {
        const list = Array.isArray(videos) ? videos : [];
        const full = Array.isArray(all) ? all : list;
        const tiers = sizeTiers(full).slice(0, list.length);
        return cardsHtml(list, { from, rankOf: rankFor(model), tiers });
    }

    // ---------- DOM ----------

    const state = {
        channelId: '',
        name: '',
        styles: [],
        songs: [],
        loading: false,
        program: false,
        origin: null,
        // Llista de cançons que es veu ara (per al play i la cua) i quantes se'n mostren.
        model: null,
        list: [],
        listKey: '',
        listLimit: LIST_FIRST,
    };
    let bound = false;
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

    const hasPoint = place =>
        Number.isFinite(place?.coordinates?.latitude) && Number.isFinite(place?.coordinates?.longitude);

    // Xip amb el lloc (es desplega amb el perquè i les fonts) i, per a cada lloc amb coordenades, «Ràdio d'aquí»:
    // la ràdio «A prop teu» d'aquell lloc (nearby-radio.js openPlace(), que no desa la zona de l'usuari).
    function originHtml(model) {
        if (!model) return '';
        const names = model.places.map(place => escapeHtml(place.name)).join(' · ');
        const radios = model.places
            .map((place, index) =>
                hasPoint(place)
                    ? `<button class="ap-chip-btn ap-origin__radio" type="button" data-ap-place="${index}">${PIN_ICON}<span>Ràdio d’aquí · ${escapeHtml(place.name)}</span></button>`
                    : ''
            )
            .join('');
        return `<summary>${PIN_ICON}<span>${escapeHtml(model.label)}: ${names}</span></summary>
            <div class="ap-origin__details">${model.basis ? `<p>${escapeHtml(model.basis)}</p>` : ''}
            ${radios ? `<div class="ap-origin__radios">${radios}</div>` : ''}
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
        state.origin = null;
        if (program || !channelId) return;
        const catalog = await loadOrigins();
        if (request !== originRequest || state.channelId !== channelId) return;
        const model = originModel(catalog, channelId);
        state.origin = model;
        section.innerHTML = originHtml(model);
        section.hidden = !model;
    }

    function startPlaceRadio(index) {
        const place = state.origin?.places?.[Number(index)];
        const open = app.features.nearbyRadio?.openPlace;
        if (!place || typeof open !== 'function') return false;
        open({ name: place.name, territory: place.territory, coordinates: place.coordinates });
        return true;
    }

    function toast(message) {
        const fn = app.features.shellNav?.toast;
        if (typeof fn === 'function') fn(message);
    }

    // ---------- Cançons de la fitxa ----------

    // Videoclips: el mateix criteri que «Videoclips oficials» de la portada (home-sections.js).
    function isClip(video) {
        const fn = app.features.homeSections?.isOfficialClip;
        return typeof fn === 'function' ? Boolean(fn(video)) : false;
    }

    const fold = value =>
        text(value)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

    // Cerca dins l'artista: pel títol que es veu i pel de YouTube (mai per la descripció).
    function matchesQuery(video, query) {
        const q = fold(query);
        if (!q) return true;
        return fold(video?.title).includes(q) || fold(video?.originalTitle).includes(q);
    }

    function setHtml(node, html) {
        if (!node) return;
        // No es repinta si no canvia: les imatges no tornen a carregar quan arriba més historial.
        if (node._apHtml !== html) {
            node.innerHTML = html;
            node._apHtml = html;
        }
        node.hidden = !html;
    }

    function renderList() {
        const list = $('apSongs');
        const more = $('apSongsMore');
        if (!list) return;
        const shown = state.list.slice(0, state.listLimit);
        list.innerHTML = songCardsHtml(shown, { model: state.model, all: state.list });
        list.hidden = !shown.length;
        if (more) {
            const remaining = state.list.length - shown.length;
            more.hidden = remaining <= 0;
            more.textContent = remaining > 0 ? `Mostra’n més (${remaining})` : '';
        }
    }

    // Pinta la més escoltada, els videoclips i directes, i la graella de cançons. `videos`: les cançons de
    // l'artista (app.js ja n'ha tret el que no és música); `query`: cerca dins l'artista; `hidden`: artista amagat.
    function renderSongs({ videos = [], query = '', hidden = false } = {}) {
        const q = text(query);
        const model = songsModel(videos, { isClip });
        state.model = model;

        setHtml($('apBest'), hidden ? '' : bestHtml(model.best, { artist: state.name }));
        setHtml($('apShelves'), hidden || q ? '' : shelvesHtml(model, { artist: state.name }));

        const stats = $('apStats');
        if (stats) {
            const total = model.total;
            const views = model.all.reduce((sum, video) => sum + viewsOf(video), 0);
            stats.textContent = total
                ? [total === 1 ? '1 cançó' : `${total} cançons`, viewsLabel(views)].filter(Boolean).join(' · ')
                : '';
            stats.hidden = !total;
        }

        let items;
        let heading = 'Cançons';
        if (hidden) items = [];
        else if (q) {
            // Cercant, totes les cançons que coincideixen (també videoclips i directes), per visualitzacions.
            items = model.all.filter(video => matchesQuery(video, q));
            heading = 'Resultats';
        } else {
            items = model.rest;
            if (model.clips.length || model.lives.length) heading = 'Totes les cançons';
        }

        const title = $('apSongsTitle');
        if (title) title.textContent = heading;
        const count = $('apSongsCount');
        if (count) {
            count.textContent = items.length ? String(items.length) : '';
            count.hidden = !items.length;
        }
        const empty = $('apSongsEmpty');
        if (empty) {
            const message = hidden
                ? 'Has amagat aquest artista del feed.'
                : !model.total
                  ? 'Encara no hi ha cançons d’aquest artista.'
                  : !items.length && q
                    ? `No hi ha cap cançó amb «${q}».`
                    : '';
            empty.textContent = message;
            empty.hidden = !message;
        }

        const key = [state.channelId, q].join('|');
        if (key !== state.listKey) {
            state.listKey = key;
            state.listLimit = LIST_FIRST;
        }
        state.list = items;
        renderList();
    }

    function showMore() {
        state.listLimit += LIST_STEP;
        renderList();
    }

    function findSong(id) {
        const key = text(id);
        return (
            state.model?.all.find(video => text(video.id) === key) ||
            state.songs.find(video => text(video.id) === key) ||
            null
        );
    }

    // Play d'una cançó: ràdio de l'artista que comença per aquella cançó. Si l'artista només té una cançó, la fa
    // sonar sola.
    function playFrom(id) {
        const seedId = text(id);
        if (!seedId) return false;
        const started = app.features.musicQueue?.startArtistRadio?.(state.songs, {
            name: state.name,
            channelId: state.channelId,
            seedId,
        });
        if (started) return true;
        if (typeof window.openVideoFromUserGesture === 'function') {
            window.openVideoFromUserGesture(seedId, 'api');
            return true;
        }
        toast('No s’ha pogut engegar la ràdio ara mateix.');
        return false;
    }

    // «Ràdio» d'una fila: només els videoclips o només els directes de l'artista.
    function startShelfRadio(key) {
        const items = key === 'lives' ? state.model?.lives : state.model?.clips;
        const label = key === 'lives' ? 'Directes' : 'Videoclips';
        const started = app.features.musicQueue?.startArtistRadio?.(items || [], {
            name: state.name,
            channelId: state.channelId,
            title: `${label} de ${state.name}`,
        });
        if (!started) toast('No s’ha pogut engegar la ràdio ara mateix.');
        return Boolean(started);
    }

    function enqueueSong(id) {
        const video = findSong(id);
        const queue = app.features.musicQueue;
        if (!video || !queue?.enqueue) return false;
        const result = queue.enqueue(video);
        const title = text(video.title) || 'La cançó';
        const messages = {
            queued: `«${title}» sonarà després de la que sona`,
            pending: `«${title}» és a la cua i sonarà quan facis sonar una cançó`,
            exists: `«${title}» ja és a la cua`,
            unsupported: 'Ara sona una llista: desa la cançó en una llista per afegir-la-hi',
        };
        toast(messages[result?.status] || messages.unsupported);
        return true;
    }

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

    // Foto de perfil de fons de la capçalera (gran) i, desenfocada, per omplir els costats a l'ordinador.
    function showPhoto(avatar) {
        const img = $('channelProfileAvatar');
        const hero = $('apHero');
        const src = heroImage(avatar || img?.getAttribute?.('src') || '');
        if (img && src && img.getAttribute?.('src') !== src) img.src = src;
        if (hero?.style?.setProperty) {
            if (src) hero.style.setProperty('--ap-photo', `url("${src.replace(/["\\\n\r]/g, '')}")`);
            else hero.style.removeProperty?.('--ap-photo');
        }
    }

    // Obre la fitxa: presentació, estils i ràdios (encara sense cançons: s’habiliten amb setSongs()).
    function showProfile({
        channelId = '',
        name = '',
        description = '',
        categories = [],
        program = false,
        avatar = '',
    } = {}) {
        state.channelId = text(channelId);
        state.name = text(name);
        state.program = Boolean(program);
        state.songs = [];
        state.loading = true;
        state.model = null;
        state.list = [];
        state.listKey = '';
        showPhoto(avatar);
        // Mentre arriben les cançons, cap bloc de la fitxa anterior.
        ['apBest', 'apShelves'].forEach(id => setHtml($(id), ''));
        renderList();
        const stats = $('apStats');
        if (stats) stats.hidden = true;
        const title = $('apSongsTitle');
        if (title) title.textContent = 'Cançons';
        ['apSongsCount', 'apSongsEmpty'].forEach(id => {
            const node = $(id);
            if (node) node.hidden = true;
        });
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
        const started = app.features.musicQueue?.startStyleRadio?.(state.styles, { seedVideos: state.songs });
        if (!started) toast('Aquest estil té massa poques cançons per fer una ràdio.');
        return Boolean(started);
    }

    function onClick(event) {
        const target = event.target;
        const queueBtn = target?.closest?.('[data-ap-queue]');
        if (queueBtn) return enqueueSong(queueBtn.dataset.apQueue);
        const play = target?.closest?.('[data-ap-play]');
        if (play) return playFrom(play.dataset.apPlay);
        const shelf = target?.closest?.('[data-ap-shelf-radio]');
        if (shelf) return startShelfRadio(shelf.dataset.apShelfRadio);
        if (target?.closest?.('#apSongsMore')) return showMore();
        const place = target?.closest?.('[data-ap-place]');
        if (place) return startPlaceRadio(place.dataset.apPlace);
        const radio = target?.closest?.('[data-ap-radio]');
        if (radio && !radio.disabled) {
            return radio.dataset.apRadio === 'style' ? startStyleRadio() : startArtistRadio();
        }
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
        formatCount,
        viewsLabel,
        subscribersLabel,
        formatDuration,
        songYear,
        heroImage,
        artOf,
        isLive,
        songsModel,
        bestHtml,
        shelvesHtml,
        sizeTiers,
        cardHtml,
        songCardsHtml,
        matchesQuery,
        showProfile,
        renderSongs,
        playFrom,
        setSongs,
        startArtistRadio,
        startStyleRadio,
        measureBio,
    };
})(window);
