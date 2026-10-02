// Cua de reproducció estil Spotify / YouTube Music.
// - En obrir una cançó des del feed es crea una cua amb l'ordenació de Música TV.
// - La cua (també la de llistes i la de TV) es mostra amb "Ara sona" + "A continuació"
//   i es pot reordenar arrossegant (Sortable.js: ratolí i tàctil).
// - Barra de controls simplificada (anterior / play-pausa / següent) sota el reproductor.
// Implementació directa: es recolza en l'estat de cua d'app.js (activePlaylistQueue...).
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;

    const QUEUE_ID = '__music_queue__';
    const TV_ID = '__segueix_tv_discovery__';
    const QUEUE_NAME = 'Ràdio';
    const MIN_QUEUE_LENGTH = 12;
    const MAX_QUEUE_LENGTH = 40;
    // Una ràdio de cerca pot portar totes les cançons trobades (la pàgina de resultats en mostra com a màxim 60).
    const SEARCH_RADIO_MAX = 60;
    // Cançons d'un artista que el motor pot ordenar per a la seva ràdio (la cua en porta les primeres).
    const ARTIST_RADIO_POOL = 500;
    // YouTube crea una cua temporal amb els vídeos de l'enllaç, en l'ordre indicat (màx. ~50).
    // Ha de ser www.youtube.com: music.youtube.com obre l'app però ignora `watch_videos`
    // (no importa la llista). Un cop oberta a YouTube, «Desa» la deixa a la biblioteca de YouTube Music.
    const YTM_QUEUE_URL = 'https://www.youtube.com/watch_videos?video_ids=';
    const YTM_MAX_VIDEOS = 50;

    const ICONS = {
        shuffle:
            '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
        grip: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M9 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm9-12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/></svg>',
        external:
            '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M14 4h6v6M20 4 10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
        close: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/></svg>',
        // Afegir un estil a la ràdio: dos cercles que es barregen (el «+» és per afegir cançons a una llista)
        blend: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="9" cy="9" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="15" cy="15" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
        plus: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>',
        minus: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M5 12h14"/></svg>',
        // Llista amb un «+» (desa la ràdio com a llista) i llista amb una marca (ja desada)
        saveList:
            '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M11 12H3M16 6H3M11 18H3M18 9v6M21 12h-6"/></svg>',
        savedList:
            '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M11 18H3M15 18l2 2 4-4M16 12H3M16 6H3"/></svg>',
        share: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
        more: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M5 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/></svg>',
    };

    // Categories que no són una "categoria" a efectes del nom de la llista (són vistes generals).
    const GENERAL_VIEWS = new Set(['novetats', 'tot', 'descobreix', 'seguint', 'radar', 'recomanat per a tu']);
    // Estil principal de la ràdio (buit = ràdio general, «La teva ràdio») i estils sumats amb el «+».
    // El nom de la ràdio és sempre aquest/s estil/s: no canvia a cada cançó.
    let radioCategory = '';
    let radioExtra = [];
    // Selector d'estils obert (es conserva en repintar la cua) i element que ha de recuperar el focus.
    let stylePickerOpen = false;
    let pendingFocus = '';
    // Canvi de mode des de la ràdio: la llista pendent es pinta amb una animació breu i un avís de quantes cançons han
    // canviat (el text es manté uns segons i després torna a l'explicació del mode).
    let animateNextRender = false;
    let modeStatus = { text: '', until: 0 };
    let modeStatusTimer = null;
    // Contenidor on s'ha pintat la cua per última vegada (per actualitzar-hi l'avís del mode sense repintar-ho tot)
    let lastContainer = null;
    const MODE_STATUS_MS = 7000;
    // Pla de descoberta aplicat a l'última cua generada: { mode, requested, note } (veure discovery.js).
    let radioMeta = null;
    // Nom de la selecció que s'ha engegat tal com és (p. ex. «Acabades de sortir»); buit en una ràdio normal.
    let radioLabel = '';
    // Ràdio generada amb els resultats d'una cerca: { videos, query }. Les cançons trobades són el conjunt de la
    // ràdio (mai s'hi filtra per estil) i «Barreja» el torna a ordenar sense sortir-ne.
    let searchRadio = null;
    // Id de la llista de reproducció on s'ha desat la ràdio actual (buit = encara no desada). Tornar a prémer el
    // botó actualitza aquella llista en lloc de crear-ne una altra.
    let savedListId = '';
    // Cançons afegides a la cua quan encara no sona cap ràdio: sonen just després de la primera que s'engegui.
    let pendingQueue = [];
    // Ids de la cua activa que l'usuari ha afegit a mà (es conserven en regenerar la ràdio).
    let queuedIds = new Set();
    // Categoria de la fila de la portada on l'usuari ha clicat una cançó (null = fora de files).
    let clickCategory = null;
    document.addEventListener(
        'click',
        event => {
            const row = event.target?.closest?.('.home-section[data-category]');
            clickCategory = row ? row.dataset.category || '' : null;
        },
        true
    );

    let sortable = null;

    function escapeText(value) {
        const div = document.createElement('div');
        div.textContent = String(value ?? '');
        return div.innerHTML;
    }

    const isEphemeral = id => id === QUEUE_ID || id === TV_ID;
    const channelOf = video => String(video?.channelId || '');
    const artistOf = video => getVideoArtistKey(video);
    const isClassicSong = video => Boolean(window.SegueixMusicCategories?.isClassicVideo?.(video));
    // La ràdio només ha de portar cançons (fora concerts complets, pel·lícules, entrevistes...).
    const isSong = video => {
        const music = window.SegueixMusicCategories;
        return !music?.isCategoryEligibleVideo || music.isCategoryEligibleVideo(video);
    };

    function findVideo(videoId) {
        const id = String(videoId);
        const pools = [window.currentFeedVideos, window.cachedAPIVideos];
        try {
            pools.unshift(currentFeedVideos, cachedAPIVideos);
        } catch (error) {
            // Globals d'app.js encara no disponibles
        }
        for (const pool of pools) {
            const found = (Array.isArray(pool) ? pool : []).find(video => String(video?.id) === id);
            if (found) return found;
        }
        return null;
    }

    // Cua = vídeo inicial + ordenació de Música TV; si TV en dona pocs (només descobreix
    // canals no seguits, un vídeo per canal) s'ompl amb els vídeos més recents restants.
    // Categories que agrupen diverses (com la fila «Pop / Rock» de la portada).
    const COMBINED_CATEGORIES = { 'pop / rock': ['pop', 'rock'] };

    const asCategories = value =>
        (Array.isArray(value) ? value : [value])
            .map(item => String(item || '').trim())
            .filter(
                (item, index, list) =>
                    item && list.findIndex(other => other.toLowerCase() === item.toLowerCase()) === index
            );
    const radioStyles = () => asCategories([radioCategory, ...radioExtra]);

    // Categoria d'estil del vídeo: les del vídeo/canal al feed (com filterVideosByCategory).
    function matchesCategory(video, category) {
        const wanted = COMBINED_CATEGORIES[category.toLowerCase()] || [category.toLowerCase()];
        try {
            if (typeof isCustomCategory === 'function' && isCustomCategory(category)) {
                return typeof matchesCustomCategory === 'function' ? matchesCustomCategory(video, category) : true;
            }
        } catch (error) {
            return true;
        }
        let own = Array.isArray(video?.categories) ? video.categories : [];
        if (!own.length) {
            const feed = (typeof getFeedDataForFilter === 'function' && getFeedDataForFilter()) || currentFeedData;
            const channel = (Array.isArray(feed?.channels) ? feed.channels : []).find(
                item => String(item?.id) === channelOf(video)
            );
            own = Array.isArray(channel?.categories) ? channel.categories : [];
        }
        return own.some(name => wanted.includes(String(name).toLowerCase()));
    }

    // Categoria principal assignada a l'artista d'una cançó: la del seu primer gènere a la base d'artistes
    // (o, sense dades, la primera categoria del vídeo/canal al feed).
    function primaryCategoryOf(video) {
        const channelId = String(video?.channelId || video?.sourceChannelId || '');
        const primary = window.SegueixMusicCategories?.primaryCategoryForChannel?.(channelId);
        if (primary) return primary;
        const own = Array.isArray(video?.categories) ? video.categories : [];
        if (own[0]) return String(own[0]);
        try {
            const feed = (typeof getFeedDataForFilter === 'function' && getFeedDataForFilter()) || currentFeedData;
            const channel = (Array.isArray(feed?.channels) ? feed.channels : []).find(
                item => String(item?.id) === channelId
            );
            return String(channel?.categories?.[0] || '');
        } catch (error) {
            return '';
        }
    }

    // Candidates de la ràdio: només cançons del feed, sense vistes, ni amagades, ni de l'artista excloent-se.
    function getCandidates(exclude, category = '') {
        const categories = asCategories(category);
        let pool = Array.isArray(currentFeedVideos) ? currentFeedVideos : [];
        // Política anterior: una cançó de l'historial quedava fora per sempre. El motor de selecció la deixa
        // tornar (amb descans, cors i repeticions voluntàries), així que només s'exclou amb `engine: 'legacy'`.
        if (!engineOn()) {
            try {
                if (typeof filterOutWatchedVideos === 'function') pool = filterOutWatchedVideos(pool) || pool;
            } catch (error) {
                // Sense historial: seguim amb el feed sencer
            }
        }
        const hidden = new Set(
            (typeof getHiddenChannelIds === 'function' ? getHiddenChannelIds() : []).map(id => String(id))
        );
        return pool.filter(
            item =>
                item?.id &&
                (!exclude || String(item.id) !== String(exclude.id)) &&
                !item.isShort &&
                isSong(item) &&
                item.source !== 'static' &&
                !hidden.has(channelOf(item)) &&
                // Ràdio d'una o diverses categories: només cançons d'algun d'aquells estils
                (!categories.length || categories.some(name => matchesCategory(item, name)))
        );
    }

    // Perfil d'escolta de l'usuari (historial, m'agrada, seguits) per al mode de descoberta.
    function getDiscoveryProfile() {
        const discovery = app.features.discovery;
        if (!discovery) return null;
        try {
            const feed = (typeof getFeedDataForFilter === 'function' && getFeedDataForFilter()) || currentFeedData;
            return discovery.getProfile(feed?.channels);
        } catch (error) {
            return null;
        }
    }

    // Base de qualsevol cua: ordre de Música TV i, si falla, el més recent.
    function rankCandidates(candidates, avoidChannel = '') {
        const tv = app.features.segueixTV;
        let ordered = [];
        try {
            ordered = tv?.rank?.(candidates, { avoidChannels: new Set(avoidChannel ? [avoidChannel] : []) }) || [];
        } catch (error) {
            ordered = [];
        }
        const byRecency = [...candidates].sort(
            (a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()
        );
        return [...ordered, ...byRecency];
    }

    // Aplica el mode de descoberta (Els meus de sempre / Una mica de tot / Sorprèn-me) a una llista ja ordenada.
    // Sense el mòdul de descoberta la llista queda com és.
    function applyDiscoveryMode(list, options = {}) {
        const discovery = app.features.discovery;
        if (!discovery) return { ordered: list, mode: 'none', requested: '', note: '' };
        const requested = options.mode || discovery.getMode();
        return discovery.orderForMode(list, options.profile || getDiscoveryProfile(), requested, {
            after: options.after || null,
        });
    }

    // ---------- Motor de selecció compartit (music-selection.js + music-signals.js) ----------

    const engine = () => app.features.musicSelection;
    const engineOn = () => Boolean(engine()?.isEnabled?.());

    // Senyals de l'usuari + el que ja ha sonat en aquesta cua (per al descans d'una cançó).
    function selectionSignals(playedIds = []) {
        const base = app.features.musicSignals?.snapshot?.() || engine().emptySignals();
        if (!playedIds.length) return base;
        const at = Date.now();
        return { ...base, recent: [...playedIds.map(id => ({ id: String(id), at })), ...base.recent] };
    }

    // Cua del motor: la part automàtica es tria sota restriccions conjuntes (antiguitat, artista, descans,
    // versions) tenint en compte el que ja hi ha a la cua (`preceding`: cançó inicial, sonades i afegits a mà).
    function buildQueueEngine(video, category = '', options = {}) {
        const sel = engine();
        const discovery = app.features.discovery;
        const candidates = getCandidates(video, category);
        const preceding = options.preceding?.length ? options.preceding : [video];
        const mode = options.mode || discovery?.getMode?.() || 'mix';
        const ctx = sel.getAppContext(Array.isArray(currentFeedVideos) ? currentFeedVideos : candidates);
        const played = (options.playedIds || []).slice().reverse();
        const result = sel.selectRadio({
            ctx,
            candidates,
            seed: video,
            signals: selectionSignals(played),
            mode,
            policy: options.policy || 'general',
            preceding,
            count: MAX_QUEUE_LENGTH - 1,
            now: Date.now(),
            rng: options.rng || Math.random,
            category,
            // Amb diversos estils la ràdio els barreja a parts iguals
            mix:
                asCategories(category).length > 1
                    ? {
                          labels: asCategories(category),
                          tagOf: item => asCategories(category).filter(name => matchesCategory(item, name)),
                      }
                    : null,
        });
        radioMeta = {
            mode: result.meta.mode,
            requested: result.meta.requested,
            note: result.meta.note || '',
            engine: 'v1',
            era: result.meta.era,
            relaxedLevel: result.meta.relaxedLevel,
        };
        return [video, ...result.queue];
    }

    // Cua = vídeo inicial + ordenació de Música TV, repartida segons el mode de descoberta.
    // Una sola cançó per artista (i cap del mateix artista que la que sona); si no arriba al mínim,
    // es completa amb repeticions, però mai dues seguides.
    function buildQueue(video, category = '', options = {}) {
        if (engineOn()) return buildQueueEngine(video, category, options);
        const candidates = getCandidates(video, category);
        const seenArtists = new Set([artistOf(video)]);
        const unique = [];
        const repeated = [];
        const used = new Set([String(video.id)]);
        rankCandidates(candidates, channelOf(video)).forEach(item => {
            const id = String(item?.id || '');
            if (!id || used.has(id)) return;
            used.add(id);
            const artist = artistOf(item);
            if (artist && seenArtists.has(artist)) {
                repeated.push(item);
            } else {
                if (artist) seenArtists.add(artist);
                unique.push(item);
            }
        });

        // Mode de descoberta: reordena els artistes; les notes expliquen si no hi ha historial suficient.
        const plan = applyDiscoveryMode(unique, { ...options, after: video });
        radioMeta = { mode: plan.mode, requested: plan.requested, note: plan.note || '' };

        // La música realment antiga surt amb menys freqüència (1 de cada 5; 1 de cada 2 si la cançó
        // que sona ja és antiga: qui escolta clàssics vol clàssics).
        let upcoming = limitClassicFrequency(plan.ordered, { every: isClassicSong(video) ? 2 : 5 });
        if (upcoming.length + 1 < MIN_QUEUE_LENGTH) {
            const missing = MIN_QUEUE_LENGTH - 1 - upcoming.length;
            upcoming = spreadVideosByArtist([...upcoming, ...repeated.slice(0, missing)], {
                previousArtist: artistOf(video),
            });
        }
        return [video, ...upcoming].slice(0, MAX_QUEUE_LENGTH);
    }

    // Engega la ràdio amb `video` de primera cançó. Retorna true si ha començat (si no, l'app segueix el camí normal).
    function launch(video, category = '', options = {}) {
        // Les cançons afegides a la cua abans d'engegar sonen just després de la primera (manen sobre els límits).
        const waiting = pendingQueue.filter(item => String(item?.id) !== String(video.id));
        const withWaiting = { ...options, preceding: [video, ...waiting] };
        let categories = asCategories(category);
        let queue = buildQueue(video, categories, withWaiting);
        let widened = false;
        if (categories.length && queue.length < 2) {
            // Categoria amb massa poques cançons: ràdio general perquè la reproducció no s'aturi
            categories = [];
            widened = true;
            queue = buildQueue(video, '', withWaiting);
        }
        if (queue.length < 2) return false;
        if (widened && radioMeta) {
            radioMeta.note = 'Aquesta categoria té massa poques cançons: hem passat a una ràdio general.';
        }
        radioCategory = categories[0] || '';
        radioExtra = categories.slice(1);
        stylePickerOpen = false;
        radioLabel = '';
        searchRadio = null;
        savedListId = '';
        pendingQueue = [];
        queuedIds = new Set(waiting.map(item => String(item.id)));
        if (waiting.length) {
            const rest = queue.slice(1).filter(item => !queuedIds.has(String(item?.id)));
            queue = [video, ...waiting, ...rest].slice(0, MAX_QUEUE_LENGTH + waiting.length);
        }

        clearEmbeddedYouTubeSession();
        isPlaylistMode = true;
        activePlaylistId = QUEUE_ID;
        activePlaylistName = QUEUE_NAME;
        activePlaylistQueue = queue;
        currentPlaylistIndex = 0;
        rememberLastRadio(video, categories.join('|'));
        loadVideoInSequence();
        return true;
    }

    // ---------- Continuar la ràdio en tornar ----------

    // Només es recorda la cançó inicial i la categoria (no la cua, que es torna a generar amb el que ja saps).
    // Quan l'usuari torna, la portada ofereix continuar-la o començar una selecció nova; mai sona sola.
    const LAST_RADIO_KEY = 'catube_last_radio';
    const LAST_RADIO_MAX_AGE = 14 * 24 * 3600 * 1000;

    function rememberLastRadio(video, category) {
        try {
            window.localStorage?.setItem?.(
                LAST_RADIO_KEY,
                JSON.stringify({
                    id: String(video.id),
                    title: video.title || '',
                    category: category || '',
                    at: Date.now(),
                })
            );
        } catch (error) {
            // Sense emmagatzematge: simplement no es pot continuar
        }
    }

    function getLastRadio() {
        try {
            const raw = JSON.parse(window.localStorage?.getItem?.(LAST_RADIO_KEY) || 'null');
            if (!raw?.id || Date.now() - Number(raw.at) > LAST_RADIO_MAX_AGE) return null;
            return findVideo(raw.id)
                ? { id: raw.id, title: raw.title, category: raw.category || '', at: raw.at }
                : null;
        } catch (error) {
            return null;
        }
    }

    // Continua la darrera ràdio amb una cua nova (mateixa cançó inicial i categoria). Només des d'un gest de l'usuari.
    function resumeLast() {
        const last = getLastRadio();
        const video = last ? findVideo(last.id) : null;
        if (
            !video ||
            document.body.classList.contains('segueix-tv-active') ||
            typeof loadVideoInSequence !== 'function'
        ) {
            return false;
        }
        clickCategory = null;
        return launch(
            video,
            String(last.category || '')
                .split('|')
                .filter(Boolean)
        );
    }

    // Reprodueix una selecció (p. ex. «Acabades de sortir») tal com és, en el seu ordre, com a cua.
    // Després, «Regenera la cua» la converteix en una ràdio normal.
    function playSelection(videos, label = '') {
        if (typeof loadVideoInSequence !== 'function' || document.body.classList.contains('segueix-tv-active')) {
            return false;
        }
        const seen = new Set();
        const queue = (Array.isArray(videos) ? videos : [])
            .filter(item => {
                const id = String(item?.id || '');
                if (!id || seen.has(id) || item.isShort || item.source === 'static') return false;
                seen.add(id);
                return true;
            })
            .slice(0, MAX_QUEUE_LENGTH);
        if (!queue.length) return false;

        radioCategory = '';
        radioExtra = [];
        stylePickerOpen = false;
        radioMeta = { mode: 'none', requested: '', note: '' };
        radioLabel = String(label || '');
        searchRadio = null;
        savedListId = '';
        queuedIds = new Set();
        pendingQueue = [];
        clearEmbeddedYouTubeSession();
        isPlaylistMode = true;
        activePlaylistId = QUEUE_ID;
        activePlaylistName = QUEUE_NAME;
        activePlaylistQueue = queue;
        currentPlaylistIndex = 0;
        loadVideoInSequence();
        return true;
    }

    // ---------- Ràdio d'una cerca ----------

    // Cançons trobades que poden sonar: sense repetits, Shorts, contingut estàtic, artistes amagats ni el que
    // l'usuari ha rebutjat («− com aquesta», artista bloquejat).
    function searchPool(videos, limit = SEARCH_RADIO_MAX) {
        const hidden = new Set(
            (typeof getHiddenChannelIds === 'function' ? getHiddenChannelIds() : []).map(id => String(id))
        );
        const seen = new Set();
        return (Array.isArray(videos) ? videos : [])
            .filter(item => {
                const id = String(item?.id || '');
                if (!id || seen.has(id) || item.isShort || item.source === 'static') return false;
                if (hidden.has(channelOf(item)) || !isSong(item) || isRejected(item)) return false;
                seen.add(id);
                return true;
            })
            .slice(0, limit);
    }

    // Part automàtica d'una ràdio de cerca: les cançons trobades que no sonen ni han sonat, ordenades pel motor
    // (gust de l'usuari i artistes no seguits, SENSE mescla d'antiguitat ni restricció d'estil: els estils es
    // barregen tal com surten als resultats) o, sense motor, en ordre de rellevància repartint els artistes.
    // Totes les cançons trobades hi entren, encara que el motor en deixi alguna fora.
    function buildSearchTail(pool, seed, options = {}) {
        const preceding = options.preceding?.length ? options.preceding : [seed];
        const taken = new Set(preceding.map(item => String(item?.id)));
        const candidates = pool.filter(item => !taken.has(String(item.id)));
        if (!candidates.length) return [];
        let ordered = [];
        if (engineOn()) {
            const sel = engine();
            const played = (options.playedIds || []).slice().reverse();
            ordered = sel.selectRadio({
                ctx: sel.getAppContext(Array.isArray(currentFeedVideos) ? currentFeedVideos : pool),
                candidates,
                seed,
                signals: selectionSignals(played),
                mode: app.features.discovery?.getMode?.() || 'mix',
                policy: 'search',
                preceding,
                count: Math.min(candidates.length, SEARCH_RADIO_MAX),
                now: Date.now(),
                rng: options.rng || Math.random,
            }).queue;
        } else {
            ordered = spreadVideosByArtist(candidates, { previousArtist: artistOf(seed) });
        }
        const picked = new Set(ordered.map(item => String(item.id)));
        return [...ordered, ...candidates.filter(item => !picked.has(String(item.id)))];
    }

    // Engega una ràdio amb un conjunt tancat de cançons (cerca o artista): la primera és `seed`, després les afegides a
    // mà abans d'engegar i, al final, la resta del conjunt ordenada pel motor. `info`: { query, artist, channelId }.
    function launchPoolRadio(pool, seed, info = {}, options = {}) {
        const waiting = pendingQueue.filter(item => String(item?.id) !== String(seed.id));
        const waitingIds = new Set(waiting.map(item => String(item.id)));
        const tail = buildSearchTail(pool, seed, { ...options, preceding: [seed, ...waiting] }).filter(
            item => !waitingIds.has(String(item.id))
        );
        // El motor ordena tot el conjunt (un artista pot tenir centenars de cançons); la cua en porta les primeres.
        const queue = [seed, ...waiting, ...tail].slice(0, SEARCH_RADIO_MAX + 1 + waiting.length);

        clickCategory = null;
        radioCategory = '';
        radioExtra = [];
        stylePickerOpen = false;
        radioMeta = { mode: 'none', requested: '', note: '' };
        const query = String(info.query || '').trim();
        const artist = String(info.artist || '').trim();
        searchRadio = { videos: pool, query, artist, channelId: String(info.channelId || '') };
        savedListId = '';
        radioLabel = artist ? `Ràdio de ${artist}` : query ? `Cerca «${query}»` : 'Cerca';
        queuedIds = waitingIds;
        pendingQueue = [];
        clearEmbeddedYouTubeSession();
        isPlaylistMode = true;
        activePlaylistId = QUEUE_ID;
        activePlaylistName = QUEUE_NAME;
        activePlaylistQueue = queue;
        currentPlaylistIndex = 0;
        loadVideoInSequence();
        notifyQueueChanged();
        return true;
    }

    // «Genera una ràdio amb aquests resultats»: la primera cançó és la millor coincidència i la resta són les
    // altres cançons trobades. Només s'invoca des d'un gest de l'usuari. Retorna true si ha començat.
    function startFromSearch(videos, options = {}) {
        if (typeof loadVideoInSequence !== 'function' || document.body.classList.contains('segueix-tv-active')) {
            return false;
        }
        const pool = searchPool(videos);
        if (pool.length < 2) return false;
        return launchPoolRadio(pool, pool[0], { query: options.query }, options);
    }

    // ---------- Ràdios de la fitxa d'artista ----------

    // Primera cançó d'una ràdio d'artista: la tria el motor amb el gust de l'usuari i el mode de descoberta (com la
    // de «La teva ràdio»); sense motor, la més recent.
    function pickPoolSeed(pool, options = {}) {
        if (engineOn()) {
            const sel = engine();
            const first = sel.selectRadio({
                ctx: sel.getAppContext(Array.isArray(currentFeedVideos) ? currentFeedVideos : pool),
                candidates: pool,
                signals: selectionSignals(),
                mode: options.mode || app.features.discovery?.getMode?.() || 'mix',
                policy: 'search',
                count: 1,
                now: Date.now(),
                rng: options.rng || Math.random,
            }).queue[0];
            if (first) return first;
        }
        return rankCandidates(pool)[0] || pool[0];
    }

    // Ràdio només amb cançons d'un artista: `videos` són les seves cançons (el motor les ordena segons el gust i
    // permet cançons seguides del mateix artista, com a una ràdio de cerca) i «Barreja» es queda dins d'elles.
    // Retorna true si ha començat (calen almenys dues cançons).
    function startArtistRadio(videos, options = {}) {
        if (typeof loadVideoInSequence !== 'function' || document.body.classList.contains('segueix-tv-active')) {
            return false;
        }
        const pool = searchPool(videos, ARTIST_RADIO_POOL);
        const name = String(options.name || '').trim() || String(pool[0]?.channelTitle || '').trim();
        if (pool.length < 2 || !name) return false;
        return launchPoolRadio(
            pool,
            pickPoolSeed(pool, options),
            { artist: name, channelId: options.channelId },
            options
        );
    }

    // Ràdio de l'estil (o de la combinació d'estils) d'un artista: la mateixa ràdio d'estil de la resta de l'app
    // (estils barrejats a parts iguals, antiguitat, límit d'artista, descans i mode de descoberta), amb el nom
    // fix de l'estil. Retorna true si ha començat.
    function startStyleRadio(categories, options = {}) {
        if (typeof loadVideoInSequence !== 'function' || document.body.classList.contains('segueix-tv-active')) {
            return false;
        }
        const styles = asCategories(categories);
        if (!styles.length) return false;
        const candidates = getCandidates(null, styles).filter(item => !isRejected(item));
        if (candidates.length < 2) return false;
        const seed = pickPoolSeed(candidates, options);
        if (!seed) return false;
        clickCategory = null;
        return launch(seed, styles, options);
    }

    // Retorna true si ha engegat la reproducció amb cua (si no, l'app segueix el camí normal).
    function startFrom(videoId, source) {
        if (source === 'static' || document.body.classList.contains('segueix-tv-active')) return false;
        if (typeof loadVideoInSequence !== 'function') return false;

        if (isPlaylistMode && activePlaylistId === QUEUE_ID) {
            const index = activePlaylistQueue.findIndex(item => String(item?.id) === String(videoId));
            if (index >= 0) {
                currentPlaylistIndex = index;
                clearEmbeddedYouTubeSession();
                loadVideoInSequence();
                return true;
            }
        }
        if (isPlaylistMode && activePlaylistId && !isEphemeral(activePlaylistId)) return false;

        const video = findVideo(videoId);
        if (!video || video.isShort) return false;

        // Categoria de la ràdio: la de la fila de la portada on s'ha clicat (Cançó d'autor, Jazz...) o,
        // a la pàgina d'una categoria, la categoria seleccionada. A Novetats/Tot/... és una ràdio general.
        const fromRow = clickCategory;
        clickCategory = null;
        const selected = String(typeof selectedCategory === 'string' ? selectedCategory : '').trim();
        let category = fromRow !== null ? fromRow : selected;
        // Sense categoria clara (Novetats, Tot, una fitxa d'artista...) la ràdio és de la categoria principal
        // assignada a l'artista de la cançó: una ràdio d'un artista o d'una categoria sempre respecta l'estil.
        if (!category || GENERAL_VIEWS.has(category.toLowerCase())) category = primaryCategoryOf(video);
        return launch(video, category);
    }

    // Gust recent de l'usuari (la darrera setmana o dies d'historial + m'agrades + seguits), o null sense el mòdul.
    function feedChannels() {
        try {
            const feed = (typeof getFeedDataForFilter === 'function' && getFeedDataForFilter()) || currentFeedData;
            return feed?.channels;
        } catch (error) {
            return undefined;
        }
    }

    function recentTasteNow() {
        const discovery = app.features.discovery;
        if (!discovery?.recentTaste) return null;
        try {
            return discovery.recentTaste({ ...discovery.readAppContext(), channels: feedChannels() });
        } catch (error) {
            return null;
        }
    }

    // Cançons d'on surt la PRIMERA cançó de «La teva ràdio», segons el mode: «Els meus de sempre» → artistes que has
    // escoltat/agradat/seguit; «Una mica de tot» → aquests més els del seu estil; «Sorprèn-me» → el seu estil, però
    // d'altres artistes. Amb poques cançons (< 5) es torna a un conjunt més ampli. La resta de la cua la fa el motor.
    const MIN_SEED_POOL = 5;
    function recentSeedPool(candidates, mode, taste) {
        const discovery = app.features.discovery;
        if (!taste?.hasAny || !taste.artistKeys?.size || !discovery?.artistKeyOf) return candidates;
        const channels = discovery.normalizeChannels?.(feedChannels());
        const known = item => taste.artistKeys.has(discovery.artistKeyOf(item));
        const own = candidates.filter(known);
        const styled = taste.styles.length
            ? candidates.filter(item => discovery.stylesOf(item, channels).some(style => taste.styles.includes(style)))
            : [];
        let pool = own;
        if (mode === 'mix') pool = [...new Set([...own, ...styled])];
        else if (mode === 'surprise') pool = styled.filter(item => !known(item));
        if (pool.length >= MIN_SEED_POOL) return pool;
        return own.length >= MIN_SEED_POOL ? own : candidates;
    }

    // «La teva ràdio»: tria la primera cançó segons el que has escoltat aquests dies, el que t'agrada i segueixes
    // (i el mode de descoberta) i engega la ràdio. La PRIMERA vegada —sense historial, m'agrades ni seguits— es fa
    // amb els estils que l'usuari va triar (`catube_first_styles`).
    // No canvia res mentre l'usuari no ho demana: només s'invoca des d'un gest de l'usuari.
    // Retorna { started, note, mode } perquè la interfície pugui explicar què s'ha fet.
    function startDiscovery(options = {}) {
        const none = { started: false, note: '', mode: 'none', seed: null };
        if (document.body.classList.contains('segueix-tv-active')) return none;
        if (typeof loadVideoInSequence !== 'function') return none;
        const candidates = getCandidates(null, '');
        if (!candidates.length) return none;

        const taste = recentTasteNow();
        // Amb molt poques dades (menys de 3 artistes coneguts) manen els estils que va triar la primera vegada.
        if (taste && taste.artistKeys.size < (app.features.discovery.MIN_KNOWN_ARTISTS || 3)) {
            const chosen = app.features.discovery.getFirstStyles?.() || [];
            if (chosen.length) {
                const started = startStyleRadio(chosen, options);
                return {
                    started,
                    note: started ? 'Ràdio amb els estils que vas triar: s’adaptarà a tu quan escoltis música.' : '',
                    mode: 'none',
                    seed: started ? activePlaylistQueue[0] || null : null,
                };
            }
        }

        if (engineOn()) {
            // «La teva ràdio»: la primera cançó també la tria el motor (gust, actualitat, rotació i mode),
            // entre les cançons del gust recent.
            const sel = engine();
            const ctx = sel.getAppContext(Array.isArray(currentFeedVideos) ? currentFeedVideos : candidates);
            const mode = options.mode || app.features.discovery?.getMode?.() || 'mix';
            const first = sel.selectRadio({
                ctx,
                candidates: recentSeedPool(candidates, mode, taste),
                signals: selectionSignals(),
                mode,
                count: 1,
                now: Date.now(),
                rng: options.rng || Math.random,
            }).queue[0];
            if (!first) return none;
            clickCategory = null;
            const started = launch(first, '', options);
            return { started, note: started ? radioMeta?.note || '' : '', mode: radioMeta?.mode || 'mix', seed: first };
        }

        const unique = [];
        const seen = new Set();
        rankCandidates(candidates).forEach(item => {
            const artist = artistOf(item);
            if (artist && seen.has(artist)) return;
            if (artist) seen.add(artist);
            unique.push(item);
        });
        const plan = applyDiscoveryMode(unique, options);
        const seed = plan.ordered[0];
        if (!seed) return none;
        clickCategory = null;
        const started = launch(seed, '', options);
        return { started, note: started ? radioMeta?.note || '' : '', mode: radioMeta?.mode || plan.mode, seed };
    }

    // Torna a generar la part pendent de la cua amb l'ordenació de TV i el mode de descoberta actual
    // (manté el que sona i el que l'usuari hi ha afegit a mà).
    // `keepNext`: no toca la cançó que ja s'ha anunciat com a següent (recàlcul silenciós després d'un cor,
    // un seguiment o un control de preferència: només es renova el que encara no s'ha anunciat).
    function regenerate({ keepNext = false } = {}) {
        if (!isPlaylistMode || activePlaylistId !== QUEUE_ID) return;
        const current = activePlaylistQueue[currentPlaylistIndex];
        if (!current) return;
        if (!keepNext && !searchRadio) {
            // Una selecció (p. ex. «Acabades de sortir») es converteix en una ràdio de l'estil de la cançó que sona
            if (radioLabel && !radioStyles().length) radioCategory = primaryCategoryOf(current);
            radioLabel = '';
        }
        const played = activePlaylistQueue.slice(0, currentPlaylistIndex + 1);
        const playedIds = new Set(played.map(item => String(item.id)));
        const kept = activePlaylistQueue
            .slice(currentPlaylistIndex + 1)
            .filter((item, index) => queuedIds.has(String(item?.id)) || (keepNext && index === 0 && !isRejected(item)));
        const keptIds = new Set(kept.map(item => String(item.id)));
        let fresh = [];
        if (searchRadio) {
            // Ràdio de cerca: sempre amb les cançons trobades. Si ja han sonat totes, torna a començar-les
            // (sense la que sona ni les afegides a mà) perquè «Barreja» no deixi la cua buida.
            const options = { preceding: [...played, ...kept], playedIds: played.map(item => String(item.id)) };
            fresh = buildSearchTail(searchRadio.videos, current, options);
            if (!fresh.length) {
                fresh = buildSearchTail(searchRadio.videos, current, { preceding: [current, ...kept] });
            }
            fresh = fresh.filter(item => !keptIds.has(String(item.id)));
        } else {
            fresh = buildQueue(current, radioStyles(), {
                preceding: [...played, ...kept],
                playedIds: played.map(item => String(item.id)),
            }).filter(item => !playedIds.has(String(item.id)) && !keptIds.has(String(item.id)));
        }
        const maxLength = searchRadio ? SEARCH_RADIO_MAX : MAX_QUEUE_LENGTH;
        activePlaylistQueue = [...played, ...kept, ...fresh].slice(0, maxLength + played.length + kept.length);
        refresh();
    }

    // ---------- Preferències explícites i canvis de gust ----------

    const signalsApi = () => app.features.musicSignals;
    const isRejected = video =>
        Boolean(video && (signalsApi()?.isLessLike?.(video.id) || signalsApi()?.isArtistBlocked?.(artistOf(video))));

    // Treu de la part pendent el que l'usuari acaba de rebutjar (mai la cançó que sona).
    function dropRejectedUpcoming() {
        if (!isPlaylistMode || activePlaylistId !== QUEUE_ID) return false;
        const before = activePlaylistQueue.length;
        activePlaylistQueue = activePlaylistQueue.filter(
            (item, index) => index <= currentPlaylistIndex || !isRejected(item)
        );
        return activePlaylistQueue.length !== before;
    }

    let tailTimer = 0;
    // Punt segur: es recalcula la part automàtica sense interrompre un arrossegament en curs.
    function scheduleTailRefresh() {
        if (!engineOn() || typeof window.setTimeout !== 'function') return;
        window.clearTimeout(tailTimer);
        tailTimer = window.setTimeout(function run() {
            if (document.querySelector('.mq-item.is-chosen')) {
                tailTimer = window.setTimeout(run, 800);
                return;
            }
            regenerate({ keepNext: true });
        }, 600);
    }

    window.addEventListener?.('segueix:music-prefs-changed', event => {
        // Repinta la cua perquè l'estat dels cercles (+/−) es vegi; treu el que s'acaba de rebutjar.
        const dropped = dropRejectedUpcoming();
        if (dropped || event?.detail?.type === 'lessLike' || event?.detail?.type === 'moreLike') {
            if (!document.querySelector('.mq-item.is-chosen')) refresh();
        }
        // Cor, seguiment i controls: la preferència compta ja per a les decisions següents.
        if (event?.detail?.on !== false) scheduleTailRefresh();
    });

    // «Afegeix a la cua». Si la ràdio sona, la cançó entra després de la que sona (i de les que l'usuari
    // ja hi havia afegit); si encara no sona res, espera i sonarà just després de la primera que s'engegui.
    // Retorna { status: 'queued' | 'pending' | 'exists' | 'unsupported', position }.
    function enqueue(video) {
        if (!video?.id || video.isShort) return { status: 'unsupported', position: 0 };
        const id = String(video.id);
        if (isPlaylistMode && activePlaylistId === QUEUE_ID && activePlaylistQueue.length) {
            const upcomingIndex = activePlaylistQueue.findIndex(
                (item, index) => index > currentPlaylistIndex && String(item?.id) === id
            );
            if (String(activePlaylistQueue[currentPlaylistIndex]?.id) === id || upcomingIndex >= 0) {
                return { status: 'exists', position: Math.max(1, upcomingIndex - currentPlaylistIndex) };
            }
            let insertAt = currentPlaylistIndex + 1;
            while (insertAt < activePlaylistQueue.length && queuedIds.has(String(activePlaylistQueue[insertAt]?.id))) {
                insertAt += 1;
            }
            const list = [...activePlaylistQueue];
            list.splice(insertAt, 0, video);
            activePlaylistQueue = list;
            queuedIds.add(id);
            refresh();
            notifyQueueChanged();
            return { status: 'queued', position: insertAt - currentPlaylistIndex };
        }
        if (isPlaylistMode && activePlaylistId && !isEphemeral(activePlaylistId)) {
            // Una llista de l'usuari no es modifica sense que ho demani: cal desar-la a una llista.
            return { status: 'unsupported', position: 0 };
        }
        if (pendingQueue.some(item => String(item?.id) === id)) {
            return { status: 'exists', position: pendingQueue.findIndex(item => String(item?.id) === id) + 1 };
        }
        pendingQueue = [...pendingQueue, video];
        notifyQueueChanged();
        return { status: 'pending', position: pendingQueue.length };
    }

    function notifyQueueChanged() {
        try {
            window.dispatchEvent(new CustomEvent('segueix:queue-changed'));
        } catch (error) {
            // Entorn sense esdeveniments (proves)
        }
    }

    // Nom de la ràdio d'un conjunt tancat: «Ràdio de <artista>» o «Cerca: <text>» (buit si no n'és cap).
    function searchRadioName() {
        if (!searchRadio) return '';
        if (searchRadio.artist) return `Ràdio de ${searchRadio.artist}`;
        return searchRadio.query ? `Cerca: ${searchRadio.query}` : '';
    }

    // Estat de la cua per a la interfície (portada): què sona, què ve després i què espera.
    function getState() {
        const active = isPlaylistMode && activePlaylistQueue.length > 0;
        return {
            active,
            isRadio: active && activePlaylistId === QUEUE_ID,
            current: active ? activePlaylistQueue[currentPlaylistIndex] || null : null,
            next: active ? activePlaylistQueue[currentPlaylistIndex + 1] || null : null,
            pending: pendingQueue.length,
            categories: radioStyles(),
            meta: radioMeta,
            search: searchRadio && activePlaylistId === QUEUE_ID ? searchRadio.query : '',
            artist: searchRadio && activePlaylistId === QUEUE_ID ? searchRadio.artist : '',
            savedListId: activePlaylistId === QUEUE_ID ? savedListId : '',
        };
    }

    // Enllaç a YouTube Music amb la cua tal com és ara: des de la cançó que sona fins al final,
    // en el mateix ordre (inclou els canvis fets arrossegant). Només vídeos amb ID de YouTube.
    // Nom de la llista a YouTube: «Llista <categoria>» si la ràdio ve d'una categoria; si no,
    // «Llista <primer grup de la llista>» (el canal de la cançó que sona / primera de la cua).
    function buildListName() {
        if (activePlaylistId !== QUEUE_ID) {
            const own = String(activePlaylistName || '').trim();
            if (own) return `Llista ${own}`;
        }
        if (activePlaylistId === QUEUE_ID && searchRadio?.artist) return `Llista ${searchRadio.artist}`;
        if (activePlaylistId === QUEUE_ID && searchRadio?.query) return `Llista ${searchRadio.query}`;
        if (activePlaylistId === QUEUE_ID && radioStyles().length) return `Llista ${radioStyles().join(' + ')}`;
        const first = activePlaylistQueue[Math.max(0, currentPlaylistIndex)];
        const group = String(first?.channelTitle || '').trim();
        return group ? `Llista ${group}` : 'Llista';
    }

    function buildYouTubeMusicUrl() {
        const ids = activePlaylistQueue
            .slice(Math.max(0, currentPlaylistIndex))
            .map(item => String(item?.id || ''))
            .filter(id => /^[A-Za-z0-9_-]{11}$/.test(id))
            .slice(0, YTM_MAX_VIDEOS);
        if (!ids.length) return '';
        // `title` posa nom a la llista (si YouTube l'ignora, el nom es copia al porta-retalls).
        return `${YTM_QUEUE_URL}${ids.join(',')}&title=${encodeURIComponent(buildListName())}`;
    }

    function openInYouTubeMusic() {
        const url = buildYouTubeMusicUrl();
        if (!url) return;
        // Còpia del nom: si en desar la llista YouTube la deixa sense títol, només cal enganxar-lo.
        try {
            navigator.clipboard?.writeText?.(buildListName());
        } catch (error) {
            // Sense porta-retalls: no és imprescindible
        }
        // Enllaç temporal amb target=_blank: obre pestanya nova dins del gest de l'usuari i no
        // mou l'app (window.open amb 'noopener' retorna sempre null i no permet detectar bloquejos).
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    function refresh() {
        updatePlaylistModeBadge?.();
        syncQueueNextOverlay?.();
        renderPlaylistQueue();
    }

    function moveNext(from, to) {
        if (from === to) return;
        if (isEphemeral(activePlaylistId)) {
            const list = [...activePlaylistQueue];
            const [moved] = list.splice(from, 1);
            list.splice(to, 0, moved);
            activePlaylistQueue = list;
            refresh();
        } else if (typeof reorderPlaylistVideos === 'function') {
            reorderPlaylistVideos(activePlaylistId, from, to);
        }
    }

    function removeAt(index) {
        const video = activePlaylistQueue[index];
        if (!video || index <= currentPlaylistIndex) return;
        if (isEphemeral(activePlaylistId)) {
            activePlaylistQueue = activePlaylistQueue.filter((_, i) => i !== index);
            refresh();
        } else if (typeof removeVideoFromPlaylist === 'function') {
            removeVideoFromPlaylist(activePlaylistId, video.id);
        }
    }

    function renderItem(video, index, { active = false, draggable = true } = {}) {
        const duration = typeof getVideoDisplayDuration === 'function' ? getVideoDisplayDuration(video) : '';
        return `
            <div class="mq-item${active ? ' is-active' : ''}" data-index="${index}" role="listitem">
                ${draggable ? `<span class="mq-handle" aria-hidden="true" title="Arrossega per reordenar">${ICONS.grip}</span>` : '<span class="mq-handle mq-handle--placeholder" aria-hidden="true"></span>'}
                <button type="button" class="mq-play" data-mq-play="${index}" aria-label="Reprodueix ${escapeText(video.title)}">
                    <span class="mq-cover">
                        <img src="${escapeText(video.thumbnail || 'img/icon-192.png')}" alt="" loading="lazy" decoding="async">
                        ${active ? '<span class="mq-eq" aria-hidden="true"><i></i><i></i><i></i></span>' : ''}
                    </span>
                    <span class="mq-text">
                        <span class="mq-title">${escapeText(video.title)}</span>
                        <span class="mq-artist">${escapeText(video.channelTitle || '')}${queuedIds.has(String(video.id)) && !active ? ' · <span class="mq-added">Afegida per tu</span>' : ''}</span>
                    </span>
                    <span class="mq-duration">${escapeText(duration || '')}</span>
                </button>
                ${draggable ? `<button type="button" class="mq-remove" data-mq-remove="${index}" aria-label="Treu de la ràdio">${ICONS.close}</button>` : ''}
                ${
                    signalsApi()
                        ? `<button type="button" class="mq-more" data-mq-more aria-expanded="${active ? 'true' : 'false'}" aria-label="Preferències d’aquesta cançó" title="Preferències">${ICONS.more}</button>
                <div class="mq-prefs" role="group" aria-label="Com aquesta cançó">
                    <button type="button" class="mq-circle mq-circle--plus" data-mq-plus="${index}" aria-pressed="${signalsApi().isMoreLike(video.id)}" aria-label="Més com aquesta" title="Més com aquesta">${ICONS.plus}</button>
                    <span class="mq-prefs__label" aria-hidden="true">com aquesta</span>
                    <button type="button" class="mq-circle mq-circle--minus" data-mq-minus="${index}" aria-pressed="${signalsApi().isLessLike(video.id)}" aria-label="Menys com aquesta" title="Menys com aquesta">${ICONS.minus}</button>
                </div>`
                        : ''
                }
            </div>
        `;
    }

    // ---------- Desar la ràdio com a llista de reproducció ----------

    const PLAYLIST_NAME_MAX = 60;

    // Nom de la llista desada: el de la ràdio (estil/estils, cerca o selecció), mai el de la cançó que sona.
    function playlistName() {
        if (searchRadioName()) return searchRadioName();
        if (radioLabel) return radioLabel;
        const styles = radioStyles();
        return styles.length ? `Ràdio ${styles.join(' + ')}` : 'La teva ràdio';
    }

    // Si ja hi ha una llista amb aquest nom (d'una altra ràdio), s'hi afegeix un número: «Ràdio Pop (2)».
    function uniquePlaylistName(base, playlists) {
        const taken = new Set(
            playlists.map(list =>
                String(list?.name || '')
                    .trim()
                    .toLowerCase()
            )
        );
        const root = base.slice(0, PLAYLIST_NAME_MAX).trim();
        if (!taken.has(root.toLowerCase())) return root;
        for (let n = 2; n < 1000; n++) {
            const suffix = ` (${n})`;
            const name = `${root.slice(0, PLAYLIST_NAME_MAX - suffix.length).trim()}${suffix}`;
            if (!taken.has(name.toLowerCase())) return name;
        }
        return root;
    }

    const isSavedList = () => {
        if (!savedListId) return false;
        try {
            return Boolean(app.features.library?.getPlaylists?.().some(list => list?.id === savedListId));
        } catch (error) {
            return false;
        }
    };

    // Cançons de la cua tal com s'emmagatzemen a les llistes (mateix format que «Afegeix a una llista»).
    function queueSnapshot() {
        const library = app.features.library;
        const seen = new Set();
        return activePlaylistQueue
            .filter(item => {
                const id = String(item?.id || '');
                if (!id || item.isShort || item.source === 'static' || seen.has(id)) return false;
                seen.add(id);
                return true;
            })
            .map(item => (library?.getPlaylistVideoData ? library.getPlaylistVideoData(item) : item));
    }

    function openLibrary() {
        document.querySelector?.('.nav-trigger[data-page="llistes"]')?.click();
    }

    // Desa tota la ràdio (el que ja ha sonat, el que sona i el que ve) a «La teva música» com a llista de
    // reproducció. Tornar-hi a prémer, amb la ràdio ja desada, actualitza aquella mateixa llista.
    // Retorna { status: 'saved' | 'updated' | 'unsupported', id, name, count }.
    function saveAsPlaylist() {
        const library = app.features.library;
        const toast = app.features.shellNav?.toast;
        const none = { status: 'unsupported', id: '', name: '', count: 0 };
        if (
            !isPlaylistMode ||
            activePlaylistId !== QUEUE_ID ||
            !activePlaylistQueue.length ||
            typeof library?.getPlaylists !== 'function' ||
            typeof library?.savePlaylists !== 'function'
        ) {
            return none;
        }
        const videos = queueSnapshot();
        if (!videos.length) return none;
        const playlists = library.getPlaylists();
        const existing = savedListId ? playlists.find(list => list?.id === savedListId) : null;
        let result;
        if (existing) {
            existing.videos = videos;
            library.savePlaylists(playlists);
            result = { status: 'updated', id: existing.id, name: existing.name, count: videos.length };
            toast?.(`Llista «${existing.name}» actualitzada.`, { action: { label: 'Obre', onClick: openLibrary } });
        } else {
            const name = uniquePlaylistName(playlistName(), playlists);
            let id = `pl_${Date.now()}`;
            while (playlists.some(list => list?.id === id)) id += '_';
            playlists.push({ id, name, videos });
            library.savePlaylists(playlists);
            savedListId = id;
            result = { status: 'saved', id, name, count: videos.length };
            toast?.(`Llista «${name}» desada a les teves llistes.`, {
                action: { label: 'Obre', onClick: openLibrary },
            });
        }
        pendingFocus = '[data-mq-save-list]';
        refresh();
        return result;
    }

    // Símbol de desar com a llista (antigament aquí hi havia el text del mode de descoberta).
    function saveButtonHtml() {
        if (activePlaylistId !== QUEUE_ID) return '';
        const saved = isSavedList();
        const label = saved
            ? 'Ràdio desada com a llista. Torna-hi a prémer per actualitzar-la'
            : 'Desa la ràdio com a llista de reproducció';
        return `<button type="button" class="mq-save-list${saved ? ' is-saved' : ''}" data-mq-save-list aria-label="${label}" title="${label}">${saved ? ICONS.savedList : ICONS.saveList}</button>`;
    }

    // Què es comparteix: una ràdio (la cua tal com és ara, amb el seu nom) o la llista de reproducció que sona.
    // La llista desa es comparteix per ID (així s'hi enganxa l'estat real de la biblioteca).
    function radioShareName() {
        if (activePlaylistId !== QUEUE_ID) return String(activePlaylistName || '').trim();
        if (searchRadioName()) return searchRadioName();
        if (radioLabel) return radioLabel;
        const styles = radioStyles();
        return styles.length ? styles.join(' + ') : 'La teva ràdio';
    }

    function getShareData() {
        if (!isPlaylistMode || !activePlaylistQueue.length || activePlaylistId === TV_ID) return null;
        const isRadio = activePlaylistId === QUEUE_ID;
        const ids = activePlaylistQueue
            .slice(isRadio ? Math.max(0, currentPlaylistIndex) : 0)
            .map(item => String(item?.id || ''))
            .filter(id => /^[A-Za-z0-9_-]{11}$/.test(id));
        return {
            type: isRadio ? 'radio' : 'playlist',
            name: radioShareName(),
            ids,
            playlistId: isRadio ? '' : String(activePlaylistId || ''),
        };
    }

    function canShare() {
        const data = getShareData();
        if (!data || !data.ids.length) return false;
        if (data.type === 'radio') return true;
        // Només llistes reals de la biblioteca (no cues temporals)
        const playlists = app.features.library?.getPlaylists?.() || [];
        return playlists.some(list => list?.id === data.playlistId);
    }

    function shareButtonHtml() {
        if (!canShare()) return '';
        const label = activePlaylistId === QUEUE_ID ? 'Comparteix aquesta ràdio' : 'Comparteix aquesta llista';
        return `<button type="button" class="mq-share" data-mq-share aria-label="${label}" title="${label}">${ICONS.share}</button>`;
    }

    // ---------- Mode de descoberta a cada ràdio ----------

    // El mode s'aplica a les ràdios generades (general, d'estil i de cerca; `radioLabel` també porta el nom de la
    // cerca). Una selecció («Acabades de sortir»…) es reprodueix tal com és i no el té.
    function modeApplies() {
        return Boolean(
            isPlaylistMode &&
            activePlaylistId === QUEUE_ID &&
            (!radioLabel || searchRadio) &&
            activePlaylistQueue.length &&
            app.features.discovery?.MODES
        );
    }

    // El mode amb què s'ha generat la cua que es veu (no necessàriament el de la portada, que s'aplica a la ràdio
    // següent): així el selector mai diu una cosa i la llista una altra.
    function appliedMode() {
        const discovery = app.features.discovery;
        const requested = radioMeta?.requested;
        return discovery?.MODES?.some(mode => mode.id === requested) ? requested : discovery?.getMode?.() || 'mix';
    }

    function modeSelectorHtml() {
        if (!modeApplies()) return '';
        const discovery = app.features.discovery;
        const current = appliedMode();
        const hint = discovery.MODES.find(mode => mode.id === current)?.hint || '';
        const status = Date.now() < modeStatus.until && modeStatus.text ? modeStatus.text : hint;
        const options = discovery.MODES.map(
            mode =>
                `<button type="button" role="radio" class="mq-mode__opt${mode.id === current ? ' is-active' : ''}" data-mq-mode="${mode.id}" aria-checked="${mode.id === current}" title="${escapeText(mode.hint)}">${escapeText(mode.label)}</button>`
        ).join('');
        return `<div class="mq-mode">
                        <div class="mq-mode__options" role="radiogroup" aria-label="Quant vols descobrir?">${options}</div>
                        <p class="mq-mode__hint" role="status" aria-live="polite">${escapeText(status)}</p>
                    </div>`;
    }

    // Ids de la part pendent que no són afegits a mà (la que el motor torna a triar en canviar de mode).
    function pendingAutoIds() {
        return activePlaylistQueue
            .slice(currentPlaylistIndex + 1)
            .filter(item => !queuedIds.has(String(item?.id)))
            .map(item => String(item?.id));
    }

    function setModeStatus(text) {
        modeStatus = { text, until: Date.now() + MODE_STATUS_MS };
        const hint = (lastContainer || document.getElementById?.('playlistQueueContainer'))?.querySelector?.(
            '.mq-mode__hint'
        );
        if (hint) hint.textContent = text;
        clearTimeout(modeStatusTimer);
        modeStatusTimer = setTimeout(() => {
            modeStatus = { text: '', until: 0 };
            const node = (lastContainer || document.getElementById?.('playlistQueueContainer'))?.querySelector?.(
                '.mq-mode__hint'
            );
            const label = app.features.discovery?.MODES?.find(mode => mode.id === appliedMode())?.hint;
            if (node && label) node.textContent = label;
        }, MODE_STATUS_MS);
    }

    // Canvia el mode de descoberta des de la ràdio: es desa (la portada s'hi sincronitza), la part pendent de la cua es
    // torna a triar d'immediat amb el mode nou —sense tocar la cançó que sona ni el que s'hi ha afegit a mà— i es veu què
    // ha canviat. Retorna { changed, mode } o null si no s'ha fet res.
    function setDiscoveryMode(value) {
        const discovery = app.features.discovery;
        const mode = discovery?.MODES?.find(item => item.id === value)?.id;
        if (!mode || !modeApplies()) return null;
        if (appliedMode() === mode) return null;
        discovery.setMode(mode);
        const before = new Set(pendingAutoIds());
        animateNextRender = true;
        pendingFocus = `[data-mq-mode="${mode}"]`;
        regenerate();
        animateNextRender = false;
        const after = pendingAutoIds();
        const changed = after.filter(id => !before.has(id)).length;
        const label = discovery.MODES.find(item => item.id === mode)?.label || '';
        // Sense prou historial (< 3 artistes coneguts) el mode no pot afinar res: la ràdio queda variada i ho diem
        let variety = radioMeta?.mode === 'variety';
        try {
            if (engineOn() && engine().knownArtistCount(selectionSignals()) < 3) variety = true;
        } catch (error) {
            // Sense motor (proves): es fa servir el que diu la ràdio
        }
        const songs = changed === 1 ? '1 cançó nova' : `${changed} cançons noves`;
        setModeStatus(
            variety
                ? `«${label}» desat. Amb tan poc historial la ràdio es manté variada (${songs} a la llista).`
                : changed
                  ? `Ràdio adaptada a «${label}»: ${songs} a la llista.`
                  : `La llista ja encaixava amb «${label}».`
        );
        notifyQueueChanged();
        return { changed, mode };
    }

    // Símbol de barrejar («Genera de nou la ràdio»): sense text, dins el grup de símbols del nom de la ràdio, perquè
    // mai quedi sol a una fila del capçal. Només les ràdios es poden regenerar.
    function regenerateButtonHtml() {
        if (activePlaylistId !== QUEUE_ID) return '';
        const label = 'Barreja la ràdio: genera’n una de nova';
        return `<button type="button" class="mq-shuffle" data-mq-regenerate aria-label="${label}" title="${label}">${ICONS.shuffle}</button>`;
    }

    // ---------- Nom de la ràdio: l'estil (o estils) i el «+» per barrejar-ne un altre ----------

    function availableStyles() {
        const groups = window.SegueixMusicCategories?.CATEGORY_GROUPS;
        const labels =
            Array.isArray(groups) && groups.length
                ? groups.map(group => group.label)
                : app.features.discovery?.PRIMARY_STYLES || [];
        const taken = new Set(radioStyles().map(name => name.toLowerCase()));
        return labels.filter(label => !taken.has(String(label).toLowerCase()));
    }

    // Capçalera: mai «Basada en <artista>» (canviava a cada cançó). Una ràdio d'estil porta el nom de l'estil
    // (o «Pop + Rock»); la general, «La teva ràdio»; una selecció, el seu nom.
    function radioNameHtml() {
        if (activePlaylistId !== QUEUE_ID) {
            const share = shareButtonHtml();
            if (!share) return `<span class="mq-source">${escapeText(activePlaylistName || '')}</span>`;
            return `<span class="mq-source mq-styles" role="group" aria-label="Llista de reproducció"><span class="mq-style mq-style--list">${escapeText(activePlaylistName || '')}</span><span class="mq-tools">${share}</span></span>`;
        }
        if (searchRadio?.artist) {
            return `<span class="mq-source mq-styles" role="group" aria-label="Origen de la ràdio"><span class="mq-style">Ràdio de ${escapeText(searchRadio.artist)}</span><span class="mq-tools">${regenerateButtonHtml()}${saveButtonHtml()}${shareButtonHtml()}</span></span>`;
        }
        if (searchRadio) {
            return `<span class="mq-source mq-styles" role="group" aria-label="Origen de la ràdio"><span class="mq-style">Cerca: ${escapeText(searchRadio.query)} · estils barrejats</span><span class="mq-tools">${regenerateButtonHtml()}${saveButtonHtml()}${shareButtonHtml()}</span></span>`;
        }
        if (radioLabel) {
            return `<span class="mq-source mq-styles" role="group" aria-label="Origen de la ràdio"><span class="mq-style">Selecció: ${escapeText(radioLabel)}</span><span class="mq-tools">${regenerateButtonHtml()}${saveButtonHtml()}${shareButtonHtml()}</span></span>`;
        }
        const styles = radioStyles();
        const chips = styles.length
            ? styles
                  .map(
                      (name, index) =>
                          `<span class="mq-style${index ? ' mq-style--extra' : ''}">${escapeText(name)}${
                              styles.length > 1
                                  ? `<button type="button" class="mq-style__remove" data-mq-remove-style="${escapeText(name)}" aria-label="Treu ${escapeText(name)} de la ràdio" title="Treu ${escapeText(name)}">${ICONS.close}</button>`
                                  : ''
                          }</span>`
                  )
                  .join('')
            : '<span class="mq-style">La teva ràdio</span>';
        const add = availableStyles().length
            ? `<button type="button" class="mq-add-style" data-mq-add-style aria-haspopup="true" aria-expanded="${stylePickerOpen}" aria-label="Afegeix un estil a la ràdio" title="Afegeix un estil a la ràdio">${ICONS.blend}</button>`
            : '';
        return `<span class="mq-source mq-styles" role="group" aria-label="Estil de la ràdio">${chips}<span class="mq-tools">${add}${regenerateButtonHtml()}${saveButtonHtml()}${shareButtonHtml()}</span></span>`;
    }

    function stylePickerHtml() {
        if (!stylePickerOpen || activePlaylistId !== QUEUE_ID || radioLabel) return '';
        const options = availableStyles();
        if (!options.length) return '';
        return `<div class="mq-style-picker" role="group" aria-label="Estil que vols sumar a la ràdio">
            <p class="mq-style-picker__title">Suma un estil a la ràdio: es barrejaran a parts iguals</p>
            <div class="mq-style-picker__options">${options
                .map(
                    label =>
                        `<button type="button" class="mq-style-option" data-mq-pick-style="${escapeText(label)}">${escapeText(label)}</button>`
                )
                .join('')}</div>
        </div>`;
    }

    // Suma un estil a la ràdio i la regenera barrejant-los. Sense cap estil (ràdio general) la fa d'aquest estil.
    function addStyle(label) {
        const name = String(label || '').trim();
        if (!name || !isPlaylistMode || activePlaylistId !== QUEUE_ID || radioLabel) return false;
        if (radioStyles().some(item => item.toLowerCase() === name.toLowerCase())) return false;
        if (radioCategory) radioExtra = [...radioExtra, name];
        else radioCategory = name;
        stylePickerOpen = false;
        pendingFocus = '[data-mq-add-style]';
        regenerate();
        notifyQueueChanged();
        return true;
    }

    // Treu un estil (sempre en queda com a mínim un) i regenera la ràdio amb els que queden.
    function removeStyle(label) {
        const styles = radioStyles();
        const name = String(label || '')
            .trim()
            .toLowerCase();
        if (styles.length < 2 || !styles.some(item => item.toLowerCase() === name)) return false;
        const rest = styles.filter(item => item.toLowerCase() !== name);
        radioCategory = rest[0];
        radioExtra = rest.slice(1);
        pendingFocus = '[data-mq-add-style]';
        regenerate();
        notifyQueueChanged();
        return true;
    }

    function toggleStylePicker(force) {
        stylePickerOpen = typeof force === 'boolean' ? force : !stylePickerOpen;
        pendingFocus = stylePickerOpen ? '[data-mq-pick-style]' : '[data-mq-add-style]';
        refresh();
    }

    // Retorna true si s'ha encarregat de pintar la cua.
    function render(container) {
        // La TV té la seva pròpia programació adaptativa (tv-live-queue / tv-programming).
        if (!container || !isPlaylistMode || !activePlaylistQueue.length || activePlaylistId === TV_ID) return false;
        const current = activePlaylistQueue[currentPlaylistIndex];
        if (!current) return false;

        const upcoming = activePlaylistQueue.slice(currentPlaylistIndex + 1);
        const canRegenerate = activePlaylistId === QUEUE_ID;
        // L'explicació del mode de descoberta (p. ex. si no hi havia historial suficient); el nom del mode ja no es mostra.
        const applied = canRegenerate ? radioMeta : null;
        const modeNote = applied?.note ? `<p class="mq-note" role="status">${escapeText(applied.note)}</p>` : '';

        container.innerHTML = `
            <div class="mq${activePlaylistId === QUEUE_ID ? ' mq--radio' : ''}">
                <div class="mq-head">
                    <h2 class="mq-heading">${activePlaylistId === QUEUE_ID ? 'Ràdio' : 'Llista'}</h2>
                    ${radioNameHtml()}
                    ${canRegenerate || activePlaylistQueue.length > 1 ? `<button type="button" class="mq-regenerate mq-open-ytm" data-mq-open-ytm title="Obre aquesta cua, en el mateix ordre, a YouTube (pots desar-la i tornar-la a trobar a YouTube Music)">${ICONS.external}<span>Obre a YouTube</span></button>` : ''}
                    ${modeSelectorHtml()}
                </div>
                ${stylePickerHtml()}
                ${modeNote}
                <div class="mq-section">Ara sona</div>
                ${renderItem(current, currentPlaylistIndex, { active: true, draggable: false })}
                <div class="mq-section">A continuació${upcoming.length ? ` · ${upcoming.length}` : ''}</div>
                <div class="mq-list${animateNextRender ? ' is-renewed' : ''}" role="list">
                    ${upcoming.map((video, i) => renderItem(video, currentPlaylistIndex + 1 + i)).join('') || '<div class="mq-empty">No hi ha més cançons a la ràdio.</div>'}
                </div>
            </div>
        `;
        lastContainer = container;
        bindContainer(container);
        setupSortable(container);
        updateTransport();
        if (animateNextRender) {
            // L'animació escalona les cançons noves: es veu com la llista es renova de dalt a baix
            container.querySelectorAll?.('.mq-list .mq-item').forEach((item, index) => {
                item.style?.setProperty?.('--i', String(Math.min(index, 14)));
            });
        }
        if (pendingFocus) {
            const target = container.querySelector(pendingFocus);
            pendingFocus = '';
            target?.focus?.({ preventScroll: true });
        }
        return true;
    }

    // «+ com aquesta» / «− com aquesta»: persistents, excloents i reversibles (tornar-hi a prémer, o Desfés).
    // Compten per a l'algorisme: la cançó i, més lleugerament, l'artista i l'estil.
    function getPreference(video) {
        const signals = signalsApi();
        if (!video || !signals) return '';
        if (signals.isMoreLike(video.id)) return 'more';
        return signals.isLessLike(video.id) ? 'less' : '';
    }

    function applyPreference(video, direction) {
        const signals = signalsApi();
        if (!video || !signals) return;
        const toast = app.features.shellNav?.toast;
        const id = String(video.id);
        const more = direction === 'more';
        const wasOn = getPreference(video) === (more ? 'more' : 'less');
        const undo = () => (more ? signals.undoMoreLike(id) : signals.undoLessLike(id));
        if (wasOn) {
            undo();
            toast?.('Preferència desfeta.');
            return;
        }
        if (more) signals.moreLikeThis(video);
        else signals.lessLikeThis(video);
        toast?.(
            more
                ? `Et recomanarem més cançons com «${video.title}».`
                : `Et recomanarem menys cançons com «${video.title}».`,
            { action: { label: 'Desfés', onClick: undo } }
        );
    }

    function bindContainer(container) {
        if (container._mqBound) return;
        container._mqBound = true;
        container.addEventListener('keydown', event => {
            if (event.key === 'Escape' && stylePickerOpen) {
                event.stopPropagation();
                toggleStylePicker(false);
            }
        });
        container.addEventListener('click', event => {
            if (event.target.closest('[data-mq-add-style]')) {
                event.stopPropagation();
                toggleStylePicker();
                return;
            }
            const pick = event.target.closest('[data-mq-pick-style]');
            if (pick) {
                event.stopPropagation();
                addStyle(pick.dataset.mqPickStyle);
                return;
            }
            const dropStyle = event.target.closest('[data-mq-remove-style]');
            if (dropStyle) {
                event.stopPropagation();
                removeStyle(dropStyle.dataset.mqRemoveStyle);
                return;
            }
            const more = event.target.closest('[data-mq-more]');
            if (more) {
                event.stopPropagation();
                const item = more.closest('.mq-item');
                const open = !item.classList.contains('is-open');
                item.classList.toggle('is-open', open);
                more.setAttribute('aria-expanded', String(open));
                return;
            }
            const plus = event.target.closest('[data-mq-plus]');
            const minus = event.target.closest('[data-mq-minus]');
            if (plus || minus) {
                event.stopPropagation();
                const index = Number((plus || minus).dataset.mqPlus ?? (plus || minus).dataset.mqMinus);
                applyPreference(activePlaylistQueue[index], plus ? 'more' : 'less');
                return;
            }
            const remove = event.target.closest('[data-mq-remove]');
            if (remove) {
                event.stopPropagation();
                removeAt(Number(remove.dataset.mqRemove));
                return;
            }
            const modeButton = event.target.closest('[data-mq-mode]');
            if (modeButton) {
                event.stopPropagation();
                setDiscoveryMode(modeButton.dataset.mqMode);
                return;
            }
            if (event.target.closest('[data-mq-share]')) {
                event.stopPropagation();
                if (typeof shareSegueixRadio === 'function') shareSegueixRadio();
                return;
            }
            if (event.target.closest('[data-mq-save-list]')) {
                event.stopPropagation();
                saveAsPlaylist();
                return;
            }
            if (event.target.closest('[data-mq-open-ytm]')) {
                openInYouTubeMusic();
                return;
            }
            if (event.target.closest('[data-mq-regenerate]')) {
                regenerate();
                return;
            }
            const play = event.target.closest('[data-mq-play]');
            if (play) {
                const index = Number(play.dataset.mqPlay);
                if (index !== currentPlaylistIndex && typeof playVideoFromPlaylistIndex === 'function') {
                    playVideoFromPlaylistIndex(index);
                }
            }
        });
    }

    function setupSortable(container) {
        if (sortable) {
            sortable.destroy();
            sortable = null;
        }
        const list = container.querySelector('.mq-list');
        if (!list || typeof window.Sortable !== 'function') return;
        sortable = window.Sortable.create(list, {
            animation: 150,
            handle: '.mq-handle',
            draggable: '.mq-item',
            ghostClass: 'is-ghost',
            chosenClass: 'is-chosen',
            forceFallback: false,
            delay: 120,
            delayOnTouchOnly: true,
            touchStartThreshold: 4,
            onEnd(evt) {
                if (evt.oldIndex == null || evt.newIndex == null || evt.oldIndex === evt.newIndex) return;
                const offset = currentPlaylistIndex + 1;
                // Repintar després que Sortable acabi de tocar el DOM.
                setTimeout(() => moveNext(offset + evt.oldIndex, offset + evt.newIndex), 0);
            },
        });
    }

    // ---------- Media Session ----------
    // Els controls del sistema (pantalla de bloqueig, notificació, tecles multimèdia) i la finestra flotant del sistema
    // són a js/features/system-player.js.
    function updateMediaSession() {
        app.features.systemPlayer?.update?.();
    }

    // ---------- Estat de reproducció ----------
    // Els controls (anterior / play-pausa / següent) ja són dins del reproductor: no hi ha barra
    // pròpia sota el vídeo. Només mantenim els controls del sistema (Media Session).
    function updateTransport() {
        updateMediaSession();
    }

    function initTransport() {
        updateTransport();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTransport);
    } else {
        initTransport();
    }

    app.features.musicQueue = {
        startFrom,
        startDiscovery,
        getLastRadio,
        resumeLast,
        playSelection,
        startFromSearch,
        startArtistRadio,
        startStyleRadio,
        saveAsPlaylist,
        playlistName,
        getShareData,
        setDiscoveryMode,
        getAppliedMode: appliedMode,
        enqueue,
        getState,
        render,
        regenerate,
        applyPreference,
        getPreference,
        addStyle,
        removeStyle,
        getStyles: radioStyles,
        buildQueue,
        buildYouTubeMusicUrl,
        buildListName,
        updateTransport,
        QUEUE_ID,
    };
})(window);
