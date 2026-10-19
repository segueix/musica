// Les teves categories: l'usuari crea categories pròpies (p. ex. «Festa major», «Per córrer»), hi afegeix grups des de
// la fitxa de l'artista, les troba a la portada amb els estils («Tria el teu so») i les pot compartir (l'enllaç porta
// el nom i els grups). Implementació directa (patró 2). El que no toca el DOM és pur i testable
// (tests/user-categories.test.js):
//  - sanitize(), validateName(), addCategory(), removeCategory(), toggleArtist(), importCategory();
//  - tilesFor() i arrangeTiles(): rajoles de la portada i ordre manual (estils + categories pròpies);
//  - mergeOrder(): porta l'ordre de la portada a la barra d'estils (selector de les vistes d'estil);
//  - songsOf(), shareMessage().
// Dades: localStorage `catube_music_user_categories` ([{ id, name, artists: [channelId] }]) i l'ordre de la portada a
// `catube_music_home_style_order` (noms dels estils i de les categories, en l'ordre en què es veuen).
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;

    const STORAGE_KEY = 'catube_music_user_categories';
    const ORDER_KEY = 'catube_music_home_style_order';
    const CHANGED_EVENT = 'segueix:user-categories-changed';
    const MAX_NAME = 40;
    // Rajoles visibles de «Tria el teu so» sense desplegar: els estils principals més les categories pròpies.
    const PRIMARY_VISIBLE = 8;
    const AVATARS = 3;
    // Noms de vistes de l'app que no poden ser una categoria (a més dels estils).
    const RESERVED = ['inici', 'novetats', 'descobreix', 'seguint', 'tot', 'música tv', 'radar', 'artistes'];

    const text = value => String(value ?? '').trim();
    const toArray = value => (Array.isArray(value) ? value : []);
    const lower = value => text(value).toLocaleLowerCase('ca');
    const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ESCAPES[char]);

    // ---------- Funcions pures ----------

    function cleanName(value) {
        return String(value ?? '')
            .replace(/["«»]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, MAX_NAME)
            .trim();
    }

    function newId(now = Date.now(), rng = Math.random) {
        return `uc_${now.toString(36)}${Math.floor(rng() * 1e6).toString(36)}`;
    }

    // Llista desada → llista vàlida: nom net i únic (sense distingir majúscules), grups sense repetir.
    function sanitize(raw) {
        const seen = new Set();
        return toArray(raw)
            .map(item => {
                const name = cleanName(item?.name);
                const id = text(item?.id);
                if (!name || !id || seen.has(lower(name))) return null;
                seen.add(lower(name));
                const artists = [...new Set(toArray(item.artists).map(text).filter(Boolean))];
                return { id, name, artists };
            })
            .filter(Boolean);
    }

    const findByName = (list, name) => toArray(list).find(item => lower(item.name) === lower(cleanName(name))) || null;
    const findById = (list, id) => toArray(list).find(item => item.id === text(id)) || null;

    // Un nom vàlid no és buit, no és d'una altra categoria teva i no és un estil o una vista de l'app.
    function validateName(name, { list = [], reserved = [], exceptId = '' } = {}) {
        const clean = cleanName(name);
        if (!clean) return { ok: false, name: clean, error: 'Escriu un nom per a la categoria.' };
        const blocked = new Set([...RESERVED, ...toArray(reserved).map(lower)]);
        if (blocked.has(lower(clean))) {
            return { ok: false, name: clean, error: `«${clean}» ja és un estil de Segueix: tria un altre nom.` };
        }
        const other = findByName(list, clean);
        if (other && other.id !== exceptId) {
            return { ok: false, name: clean, error: `Ja tens una categoria que es diu «${other.name}».` };
        }
        return { ok: true, name: clean, error: '' };
    }

    function addCategory(list, name, { reserved = [], id = newId(), artists = [] } = {}) {
        const current = sanitize(list);
        const check = validateName(name, { list: current, reserved });
        if (!check.ok) return { list: current, category: null, error: check.error };
        const category = { id, name: check.name, artists: [...new Set(toArray(artists).map(text).filter(Boolean))] };
        return { list: [...current, category], category, error: '' };
    }

    function removeCategory(list, id) {
        return sanitize(list).filter(item => item.id !== text(id));
    }

    // Afegeix el grup a la categoria o el treu si ja hi era. → { list, added }
    function toggleArtist(list, id, channelId) {
        const artist = text(channelId);
        let added = false;
        const next = sanitize(list).map(item => {
            if (item.id !== text(id) || !artist) return item;
            if (item.artists.includes(artist)) return { ...item, artists: item.artists.filter(a => a !== artist) };
            added = true;
            return { ...item, artists: [...item.artists, artist] };
        });
        return { list: next, added };
    }

    const categoriesOfArtist = (list, channelId) =>
        sanitize(list).filter(item => item.artists.includes(text(channelId)));

    // «Nom», «Nom (2)», «Nom (3)»… el primer que encara no és de cap categoria ni estil.
    function uniqueName(list, name, reserved = []) {
        const base = cleanName(name) || 'Categoria compartida';
        for (let n = 1; n < 100; n += 1) {
            const candidate = n === 1 ? base : cleanName(`${base.slice(0, MAX_NAME - 5)} (${n})`);
            if (validateName(candidate, { list, reserved }).ok) return candidate;
        }
        return cleanName(`${base.slice(0, MAX_NAME - 8)} (${Date.now() % 1000})`);
    }

    // Categoria rebuda per un enllaç. Si ja la tens igual (mateix nom i mateixos grups) no es duplica; si el nom ja
    // és d'una altra, es desa com a «Nom (2)». → { list, category, status: 'added' | 'exists' }
    function importCategory(list, { name, artists } = {}, { reserved = [], id = newId() } = {}) {
        const current = sanitize(list);
        const wanted = [...new Set(toArray(artists).map(text).filter(Boolean))];
        const same = findByName(current, name);
        if (same && same.artists.length === wanted.length && wanted.every(artist => same.artists.includes(artist))) {
            return { list: current, category: same, status: 'exists' };
        }
        const category = { id, name: uniqueName(current, name, reserved), artists: wanted };
        return { list: [...current, category], category, status: 'added' };
    }

    const channelKey = id => text(id).toLowerCase();

    function channelMap(channels) {
        if (channels instanceof Map) return channels;
        const map = new Map();
        const add = (id, channel) => {
            const key = channelKey(id || channel?.id);
            if (key && channel && typeof channel === 'object') map.set(key, channel);
        };
        if (Array.isArray(channels)) channels.forEach(channel => add(channel?.id, channel));
        else if (channels && typeof channels === 'object') Object.keys(channels).forEach(id => add(id, channels[id]));
        return map;
    }

    const artistNameOf = (channel, id) =>
        text(channel?.displayName || channel?.name || channel?.title || channel?.channelTitle) || text(id);

    // Noms dels grups d'una categoria (en l'ordre en què s'hi han afegit).
    function artistNames(category, channels) {
        const map = channelMap(channels);
        return toArray(category?.artists).map(id => artistNameOf(map.get(channelKey(id)), id));
    }

    // Rajoles de la portada per a les categories pròpies (mateixa forma que discovery.summarizeStyles()).
    function tilesFor(list, { channels } = {}) {
        const map = channelMap(channels);
        return sanitize(list).map(item => {
            const artists = new Map();
            item.artists.forEach(id => {
                const key = window.SegueixMusicCategories?.artistKeyForChannel?.(id) || channelKey(id);
                const channel = map.get(channelKey(id));
                const avatar = text(channel?.avatar || channel?.thumbnail);
                if (!artists.has(key) || !artists.get(key)) artists.set(key, avatar);
            });
            return {
                label: item.name,
                id: item.id,
                user: true,
                artists: artists.size,
                avatars: [...artists.values()].filter(Boolean).slice(0, AVATARS),
                // Candidats a fer de fons, per no repetir el grup d'una altra rajola (discovery.assignUniqueAvatars)
                faces: [...artists.entries()].filter(([, avatar]) => avatar).map(([key, avatar]) => ({ key, avatar })),
            };
        });
    }

    // Ordre de «Tria el teu so»: el que ha triat l'usuari arrossegant (`order`, noms) i, si no, estils principals →
    // categories pròpies → la resta d'estils. Les categories noves que encara no són a l'ordre desat entren a l'última
    // posició visible. `primary` = visible sense «Tots els estils» (les primeres PRIMARY_VISIBLE + categories pròpies).
    function arrangeTiles(styles, userTiles, order = null) {
        const styleList = toArray(styles);
        const users = toArray(userTiles);
        const visible = Math.min(styleList.length + users.length, PRIMARY_VISIBLE + users.length);
        let tiles;
        const saved = toArray(order).map(lower);
        if (!saved.length) {
            tiles = [...styleList.filter(tile => tile.primary), ...users, ...styleList.filter(tile => !tile.primary)];
        } else {
            const all = [...styleList, ...users];
            const rank = new Map(saved.map((label, index) => [label, index]));
            const known = all
                .filter(tile => rank.has(lower(tile.label)))
                .sort((a, b) => rank.get(lower(a.label)) - rank.get(lower(b.label)));
            const newUsers = users.filter(tile => !rank.has(lower(tile.label)));
            const newStyles = styleList.filter(tile => !rank.has(lower(tile.label)));
            tiles = [...known];
            const at = Math.max(0, Math.min(tiles.length, visible - newUsers.length));
            tiles.splice(at, 0, ...newUsers);
            tiles.push(...newStyles);
        }
        return tiles.map((tile, index) => ({ ...tile, primary: index < visible }));
    }

    // Porta l'ordre de la portada a l'ordre desat de la barra d'estils: els elements que surten a la portada ocupen,
    // en el nou ordre, els llocs que ja tenien a la barra; els que no hi eren s'afegeixen al final.
    function mergeOrder(chipOrder, homeOrder) {
        const home = toArray(homeOrder).map(text).filter(Boolean);
        const inHome = new Set(home.map(lower));
        const chips = toArray(chipOrder).map(text).filter(Boolean);
        const queue = [...home];
        const merged = chips.map(value => (inHome.has(lower(value)) ? queue.shift() : value));
        const placed = new Set(merged.map(lower));
        return [...merged, ...home.filter(value => !placed.has(lower(value)))];
    }

    // Cançons dels grups de la categoria (sense Shorts ni repetides). `expand(id)`: tots els canals d'un artista (el
    // propi i el «Tema» són una sola fitxa, i la categoria en desa l'ID de la fitxa).
    function songsOf(category, videos, expand = id => [id]) {
        const artists = new Set(
            toArray(category?.artists)
                .flatMap(id => toArray(expand(id)))
                .map(channelKey)
        );
        const seen = new Set();
        return toArray(videos).filter(video => {
            const id = text(video?.id);
            if (!id || video.isShort || seen.has(id) || !artists.has(channelKey(video.channelId))) return false;
            seen.add(id);
            return true;
        });
    }

    // Text del missatge de compartir: sempre porta el nom de la categoria i, si n'hi ha, els grups.
    function shareMessage(name, names = [], maxNames = 6) {
        const clean = cleanName(name) || 'Categoria';
        const list = toArray(names).map(text).filter(Boolean);
        if (!list.length) return `Et passo la meva categoria «${clean}» de Segueix Música.`;
        const shown = list.slice(0, maxNames);
        const rest = list.length - shown.length;
        const joined =
            rest > 0
                ? `${shown.join(', ')} i ${rest === 1 ? '1 grup més' : `${rest} grups més`}`
                : shown.length > 1
                  ? `${shown.slice(0, -1).join(', ')} i ${shown[shown.length - 1]}`
                  : shown[0];
        return `Et passo la meva categoria «${clean}» de Segueix Música: ${joined}.`;
    }

    const artistsLabel = count => (Number(count) === 1 ? '1 artista' : `${Number(count) || 0} artistes`);

    // ---------- Emmagatzematge ----------

    function readJson(key, fallback) {
        try {
            const raw = window.localStorage?.getItem?.(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function writeJson(key, value) {
        try {
            window.localStorage?.setItem?.(key, JSON.stringify(value));
            return true;
        } catch (error) {
            return false;
        }
    }

    const list = () => sanitize(readJson(STORAGE_KEY, []));

    function notify(detail = {}) {
        try {
            window.dispatchEvent(new window.CustomEvent(CHANGED_EVENT, { detail }));
        } catch (error) {
            // Entorn sense esdeveniments (proves)
        }
    }

    // Estils i vistes de l'app (els noms que no pot tenir una categoria pròpia).
    function reservedNames() {
        const names = [];
        try {
            if (typeof getStandardChipLabels === 'function') names.push(...getStandardChipLabels());
        } catch (error) {
            // app.js encara no ha carregat
        }
        toArray(window.SegueixMusicCategories?.CATEGORY_GROUPS).forEach(group => names.push(group?.label));
        toArray(window.CONFIG?.categories).forEach(cat => names.push(cat?.name));
        return names.filter(Boolean);
    }

    // Desa i avisa la resta de l'app (barra d'estils, portada, fitxa d'artista).
    function save(next, detail = {}) {
        const ok = writeJson(STORAGE_KEY, sanitize(next));
        if (ok) {
            refreshChips();
            notify(detail);
        }
        return ok;
    }

    function create(name, { channelId = '' } = {}) {
        const result = addCategory(list(), name, { reserved: reservedNames(), artists: channelId ? [channelId] : [] });
        if (result.error) return result;
        if (!save(result.list, { type: 'create', id: result.category.id })) {
            return { ...result, category: null, error: 'No s’ha pogut desar la categoria en aquest navegador.' };
        }
        return result;
    }

    function remove(id) {
        const target = findById(list(), id);
        if (!target) return false;
        save(removeCategory(list(), id), { type: 'remove', id, name: target.name });
        const order = readJson(ORDER_KEY, null);
        if (Array.isArray(order)) {
            writeJson(
                ORDER_KEY,
                order.filter(label => lower(label) !== lower(target.name))
            );
        }
        return true;
    }

    function toggle(id, channelId) {
        const result = toggleArtist(list(), id, channelId);
        save(result.list, { type: 'artists', id, channelId: text(channelId), added: result.added });
        return result.added;
    }

    function importShared(payload = {}) {
        const result = importCategory(
            list(),
            { name: payload.name, artists: payload.items || payload.artists },
            { reserved: reservedNames() }
        );
        if (result.status === 'added') save(result.list, { type: 'import', id: result.category.id });
        return result;
    }

    const get = idOrName => findById(list(), idOrName) || findByName(list(), idOrName);
    const isUserCategory = name => Boolean(findByName(list(), name));

    // ---------- Ordre de la portada ----------

    const getHomeOrder = () => {
        const order = readJson(ORDER_KEY, null);
        return Array.isArray(order) ? order.map(text).filter(Boolean) : null;
    };

    // Desa l'ordre de la portada i el porta també a la barra d'estils (el selector «Estil» de les vistes d'estil).
    function setHomeOrder(labels) {
        const order = toArray(labels).map(text).filter(Boolean);
        writeJson(ORDER_KEY, order);
        try {
            if (typeof getStoredChipOrder === 'function' && typeof saveChipOrder === 'function') {
                const chips =
                    getStoredChipOrder() || (typeof getChipOrderFromDom === 'function' ? getChipOrderFromDom() : []);
                saveChipOrder(mergeOrder(chips, order));
            }
        } catch (error) {
            // Sense barra d'estils (proves)
        }
        refreshChips();
        return order;
    }

    function refreshChips() {
        try {
            if (typeof setupChipsBarOrdering === 'function') setupChipsBarOrdering();
        } catch (error) {
            // app.js encara no ha carregat
        }
    }

    // ---------- Dades de l'app ----------

    function knownChannels() {
        const map = new Map();
        const add = channel => {
            const key = channelKey(channel?.id);
            if (key && !map.has(key)) map.set(key, channel);
        };
        toArray(window.YouTubeAPI?.feedChannels).forEach(add);
        try {
            if (typeof cachedChannels !== 'undefined' && cachedChannels) {
                Object.entries(cachedChannels).forEach(([id, channel]) => add({ ...channel, id }));
            }
        } catch (error) {
            // Sense canals a la memòria cau
        }
        return map;
    }

    // Canals d'un artista: els del seu grup (canal propi + «Tema») si n'hi ha.
    function channelIdsOf(id) {
        const group = window.YouTubeAPI?.getArtistGroupForChannel?.(id);
        const ids = toArray(group?.channelIds).map(text).filter(Boolean);
        return ids.length ? [...new Set([text(id), ...ids])] : [text(id)];
    }

    // Tots els canals (ID) dels grups d'una categoria.
    const categoryChannelIds = category => [...new Set(toArray(category?.artists).flatMap(channelIdsOf))];

    function knownVideos() {
        const sources = [window.YouTubeAPI?.feedVideos, window.YouTubeAPI?.historyPoolVideos];
        try {
            if (typeof currentFeedVideos !== 'undefined') sources.push(currentFeedVideos);
        } catch (error) {
            // Sense feed
        }
        return sources.flatMap(toArray);
    }

    // ---------- Accions (DOM) ----------

    function toast(message) {
        const fn = app.features.shellNav?.toast;
        if (typeof fn === 'function') fn(message);
    }

    function startRadio(idOrName) {
        const category = get(idOrName);
        if (!category) return false;
        if (!category.artists.length) {
            toast('Afegeix-hi grups des de la fitxa de cada artista per poder-ne fer una ràdio.');
            return false;
        }
        const songs = songsOf(category, knownVideos(), channelIdsOf);
        const started = app.features.musicQueue?.startCategoryRadio?.(songs, { name: category.name });
        if (!started) toast('Aquesta categoria encara té massa poques cançons per fer una ràdio.');
        return Boolean(started);
    }

    function share(idOrName) {
        const category = get(idOrName);
        if (!category) return false;
        if (!category.artists.length) {
            toast('Afegeix-hi algun grup abans de compartir-la.');
            return false;
        }
        const names = artistNames(category, knownChannels());
        if (typeof shareUserCategory === 'function') {
            shareUserCategory(category.name, category.artists, shareMessage(category.name, names));
            return true;
        }
        return false;
    }

    function confirmRemove(idOrName) {
        const category = get(idOrName);
        if (!category) return false;
        const ok =
            typeof window.confirm !== 'function' ||
            window.confirm(`Vols esborrar la categoria «${category.name}»? Els grups no s’esborren.`);
        if (!ok) return false;
        let wasOpen = false;
        try {
            wasOpen = typeof selectedCategory !== 'undefined' && lower(selectedCategory) === lower(category.name);
        } catch (error) {
            wasOpen = false;
        }
        remove(category.id);
        toast(`Has esborrat la categoria «${category.name}».`);
        if (wasOpen) window.document.querySelector('.chips-bar.home-categories .chip[data-cat="Novetats"]')?.click();
        return true;
    }

    // Finestra per crear una categoria (des de la portada, la barra d'estils o la fitxa d'un artista).
    function openCreateDialog({ channelId = '', artistName = '' } = {}) {
        const doc = window.document;
        if (!doc?.body) return null;
        doc.getElementById('ucCreateDialog')?.remove();
        const overlay = doc.createElement('div');
        overlay.className = 'modal-overlay active uc-overlay';
        overlay.id = 'ucCreateDialog';
        overlay.innerHTML = `
            <form class="modal modal-small uc-dialog" role="dialog" aria-modal="true" aria-labelledby="ucCreateTitle" novalidate>
                <h2 class="uc-dialog__title" id="ucCreateTitle">Crea una categoria</h2>
                <p class="uc-dialog__text">${
                    artistName
                        ? `Hi afegirem <strong>${esc(artistName)}</strong>. Després hi pots sumar altres grups des de la fitxa de cada artista.`
                        : 'Posa-li un nom i afegeix-hi grups des de la fitxa de cada artista («Les teves categories»).'
                }</p>
                <label class="uc-dialog__label" for="ucCreateName">Nom de la categoria</label>
                <input class="uc-dialog__input" id="ucCreateName" name="name" type="text" maxlength="${MAX_NAME}" autocomplete="off" placeholder="Per exemple: Festa major" required>
                <p class="uc-dialog__error" id="ucCreateError" role="alert" hidden></p>
                <div class="uc-dialog__actions">
                    <button type="button" class="pt-btn pt-btn--ghost" data-uc-cancel>Cancel·la</button>
                    <button type="submit" class="pt-btn pt-btn--primary">Crea-la</button>
                </div>
            </form>`;
        doc.body.appendChild(overlay);
        const form = overlay.querySelector('form');
        const input = overlay.querySelector('input');
        const error = overlay.querySelector('#ucCreateError');
        const previous = doc.activeElement;
        const close = () => {
            overlay.remove();
            doc.removeEventListener('keydown', onKey, true);
            previous?.focus?.({ preventScroll: true });
        };
        const onKey = event => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                close();
            }
        };
        doc.addEventListener('keydown', onKey, true);
        overlay.addEventListener('click', event => {
            if (event.target === overlay || event.target.closest('[data-uc-cancel]')) close();
        });
        input.addEventListener('input', () => {
            error.hidden = true;
        });
        form.addEventListener('submit', event => {
            event.preventDefault();
            const result = create(input.value, { channelId });
            if (result.error) {
                error.textContent = result.error;
                error.hidden = false;
                input.focus();
                return;
            }
            close();
            toast(
                channelId
                    ? `Has creat «${result.category.name}» amb ${artistName || 'aquest grup'}. La trobaràs a Inici.`
                    : `Has creat «${result.category.name}». Afegeix-hi grups des de la fitxa de cada artista.`
            );
        });
        window.setTimeout(() => input.focus(), 30);
        return overlay;
    }

    // ---------- Fitxa d'artista ----------

    const artistState = { channelId: '', name: '', hidden: false };

    function artistSectionHtml(categories, channelId) {
        const mine = new Set(categoriesOfArtist(categories, channelId).map(item => item.id));
        const pills = categories
            .map(item => {
                const on = mine.has(item.id);
                return `<button type="button" class="uc-pill${on ? ' is-on' : ''}" data-uc-toggle="${esc(item.id)}" aria-pressed="${on}">
                    <span class="uc-pill__mark" aria-hidden="true">${on ? '✓' : ''}</span><span>${esc(item.name)}</span>
                </button>`;
            })
            .join('');
        return `
            <div class="uc-artist__head">
                <h2 class="uc-artist__title" id="ucArtistTitle">Les teves categories</h2>
                <p class="uc-artist__hint">${
                    categories.length
                        ? 'Toca una categoria per afegir-hi o treure’n aquest grup.'
                        : 'Crea una categoria pròpia i posa-hi els grups que vulguis. Sortirà a Inici, amb els estils.'
                }</p>
            </div>
            <div class="uc-pills" role="group" aria-labelledby="ucArtistTitle">
                ${pills}
                <button type="button" class="uc-pill uc-pill--new" data-uc-new>
                    <span class="uc-pill__mark" aria-hidden="true">+</span><span>Nova categoria</span>
                </button>
            </div>`;
    }

    function renderArtistSection() {
        const section = window.document?.getElementById?.('apUserCats');
        if (!section) return;
        section.hidden = artistState.hidden || !artistState.channelId;
        if (section.hidden) {
            section.innerHTML = '';
            return;
        }
        section.innerHTML = artistSectionHtml(list(), artistState.channelId);
    }

    // La crida artist-page.showProfile(): els programes (no són grups de música) no tenen categories.
    function showForArtist({ channelId = '', name = '', program = false } = {}) {
        artistState.channelId = text(channelId);
        artistState.name = text(name);
        artistState.hidden = Boolean(program);
        renderArtistSection();
    }

    function onArtistClick(event) {
        const target = event.target;
        const pill = target?.closest?.('[data-uc-toggle]');
        if (pill) {
            const category = get(pill.dataset.ucToggle);
            if (!category) return;
            const added = toggle(category.id, artistState.channelId);
            toast(
                added
                    ? `Has afegit ${artistState.name || 'el grup'} a «${category.name}».`
                    : `Has tret ${artistState.name || 'el grup'} de «${category.name}».`
            );
            window.document.querySelector(`[data-uc-toggle="${CSS.escape(category.id)}"]`)?.focus?.();
            return;
        }
        if (target?.closest?.('[data-uc-new]')) {
            openCreateDialog({ channelId: artistState.channelId, artistName: artistState.name });
        }
    }

    // ---------- Capçalera de la vista d'una categoria pròpia ----------

    const ICONS = {
        radio: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4.9 19.1a10 10 0 0 1 0-14.2M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4M19.1 4.9a10 10 0 0 1 0 14.2M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/></svg>',
        share: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
        trash: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>',
    };

    // Títol de la vista d'una categoria pròpia: nom, grups i accions (ràdio, compartir, esborrar).
    function pageTitleHtml(name) {
        const category = get(name);
        if (!category) return '';
        const names = artistNames(category, knownChannels());
        const who = names.length
            ? `${artistsLabel(names.length)}: ${names.slice(0, 8).join(', ')}${names.length > 8 ? '…' : ''}`
            : 'Encara no hi has afegit cap grup. Obre la fitxa d’un artista i toca «Nova categoria» o el nom d’aquesta.';
        return `
            <span class="uc-page">
                <span class="uc-page__eyebrow pt-eyebrow">La teva categoria</span>
                <span class="page-title__query uc-page__name">${esc(category.name)}</span>
                <span class="uc-page__who">${esc(who)}</span>
                <span class="uc-page__actions">
                    <button type="button" class="pt-btn pt-btn--primary uc-page__radio" data-uc-radio="${esc(category.id)}"${category.artists.length ? '' : ' disabled'}>${ICONS.radio}<span>Ràdio</span></button>
                    <button type="button" class="uc-icon-btn" data-uc-share="${esc(category.id)}" aria-label="Comparteix la categoria ${esc(category.name)}" title="Comparteix-la"${category.artists.length ? '' : ' disabled'}>${ICONS.share}</button>
                    <button type="button" class="uc-icon-btn" data-uc-remove="${esc(category.id)}" aria-label="Esborra la categoria ${esc(category.name)}" title="Esborra-la">${ICONS.trash}</button>
                </span>
            </span>`;
    }

    function onDocumentClick(event) {
        const target = event.target;
        let el;
        if ((el = target?.closest?.('[data-uc-radio]'))) return startRadio(el.dataset.ucRadio);
        if ((el = target?.closest?.('[data-uc-share]'))) return share(el.dataset.ucShare);
        if ((el = target?.closest?.('[data-uc-remove]'))) return confirmRemove(el.dataset.ucRemove);
        if (target?.closest?.('[data-uc-create]')) return openCreateDialog();
        return undefined;
    }

    function init() {
        const doc = window.document;
        if (typeof doc?.addEventListener !== 'function') return;
        doc.addEventListener('click', onDocumentClick);
        doc.getElementById('apUserCats')?.addEventListener('click', onArtistClick);
        window.addEventListener(CHANGED_EVENT, renderArtistSection);
    }

    if (window.document?.readyState === 'loading') {
        window.document.addEventListener('DOMContentLoaded', init);
    } else if (window.document) {
        init();
    }

    app.features.userCategories = {
        STORAGE_KEY,
        ORDER_KEY,
        CHANGED_EVENT,
        PRIMARY_VISIBLE,
        MAX_NAME,
        // pures
        cleanName,
        sanitize,
        validateName,
        addCategory,
        removeCategory,
        toggleArtist,
        categoriesOfArtist,
        uniqueName,
        importCategory,
        artistNames,
        tilesFor,
        arrangeTiles,
        mergeOrder,
        songsOf,
        shareMessage,
        artistsLabel,
        artistSectionHtml,
        // estat
        list,
        get,
        isUserCategory,
        create,
        remove,
        toggle,
        importShared,
        getHomeOrder,
        setHomeOrder,
        // DOM
        openCreateDialog,
        showForArtist,
        pageTitleHtml,
        startRadio,
        share,
        confirmRemove,
        knownChannels,
        channelIdsOf,
        categoryChannelIds,
    };
})(window);
