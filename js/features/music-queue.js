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
    // Disponibilitat observada en aquesta sessió, mai una baixa permanent del catàleg.
    const unavailableVideos = new Map();

    function handleUnavailableVideo(code, iframe) {
        // 5 (HTML5) i 153 (configuració del reproductor) no demostren que la cançó no estigui disponible.
        if (![100, 101, 150].includes(Number(code)) || !iframe || iframe._musicUnavailableHandled) return false;
        if (!isPlaylistMode || activePlaylistId !== QUEUE_ID) return false;
        const queue = activePlaylistQueue;
        const index = currentPlaylistIndex;
        const video = queue[index];
        if (!video || String(video.id) !== String(currentVideoId) ||
            String(videoPlayer?.dataset?.playingVideoId) !== String(video.id)) return false;

        iframe._musicUnavailableHandled = true;
        unavailableVideos.set(String(video.id), Number(code));
        cancelLiveSwapFallback();
        if (autoplayBlockTimer) clearTimeout(autoplayBlockTimer);
        autoplayBlockTimer = null;
        setAutoplayBlockedHint(false);
        renderPlaylistQueue();
        // Deixa llegir l'avís. Si l'usuari navega mentrestant, no li canviem la nova cançó.
        setTimeout(() => {
            if (!isPlaylistMode || activePlaylistId !== QUEUE_ID || activePlaylistQueue !== queue ||
                currentPlaylistIndex !== index || String(currentVideoId) !== String(video.id) ||
                videoPlayer?.querySelector('iframe') !== iframe) return;
            let next = index + 1;
            while (next < queue.length && unavailableVideos.has(String(queue[next].id))) next += 1;
            if (next >= queue.length) {
                // Conserva la cua i l'avís si no queda cap cançó, sense bucles ni regeneració automàtica.
                renderPlaylistQueue();
                return;
            }
            currentPlaylistIndex = next;
            loadVideoInSequence();
        }, 800);
        return true;
    }

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
    let radioLiveOnly = false;
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
    let radioSeedTitle = '';
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
    const isLiveSong = video => String(video?.contentType || '').toLowerCase().replace(/-/g, '_') === 'live_song';
    const isClassicSong = video => Boolean(window.SegueixMusicCategories?.isClassicVideo?.(video));
    // La ràdio només ha de portar cançons (fora concerts complets, pel·lícules, entrevistes...).
    const isSong = video => {
        const music = window.SegueixMusicCategories;
        return !music?.isCategoryEligibleVideo || music.isCategoryEligibleVideo(video);
    };

    function findVideo(videoId) {
        const id = String(videoId);
        const pools = [window.currentFeedVideos, window.cachedAPIVideos, window.YouTubeAPI?.historyPoolVideos];
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
            .flatMap(item => item === 'Punk / Metal' ? ['Punk', 'Heavy / Metal'] : [item])
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
    function getCandidates(exclude, category = '', options = {}) {
        const categories = asCategories(category);
        let pool =
            window.YouTubeAPI?.getRadioPoolVideos?.() || (Array.isArray(currentFeedVideos) ? currentFeedVideos : []);
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
                (!options.liveOnly || isLiveSong(item)) &&
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
        const candidates = getCandidates(video, category, options);
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
        const candidates = getCandidates(video, category, options);
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
        const waiting = pendingQueue.filter(item =>
            String(item?.id) !== String(video.id) && (!options.liveOnly || isLiveSong(item))
        );
        const withWaiting = { ...options, liveOnly: options.liveOnly === true, preceding: [video, ...waiting] };
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
        radioLiveOnly = withWaiting.liveOnly;
        stylePickerOpen = false;
        radioLabel = '';
        radioSeedTitle = String(options.seedTitle || '').trim();
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
        loadVideoInSequence(playbackOptions(options.playback));
        return true;
    }

    // Com ha de començar la primera cançó d'una cua: en pausa (selecció explícita) llevat que qui l'obre demani
    // reproduir-la; un enllaç o una sessió recuperada hi porten el segon (`startAt`) i no afegeixen entrades a
    // l'historial (`replaceHistory`).
    function playbackOptions(playback = {}) {
        const startAt = Math.max(0, Math.floor(Number(playback?.startAt) || 0));
        return {
            autoPlay: playback?.autoPlay === true,
            ...(playback?.replaceHistory ? { replaceHistory: true } : {}),
            ...(startAt > 0 ? { startAt } : {}),
        };
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
                    liveOnly: radioLiveOnly,
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
                ? { id: raw.id, title: raw.title, category: raw.category || '', liveOnly: raw.liveOnly === true, at: raw.at }
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
                .filter(Boolean),
            { liveOnly: last.liveOnly }
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
        radioLiveOnly = false;
        stylePickerOpen = false;
        radioMeta = { mode: 'none', requested: '', note: '' };
        radioSeedTitle = '';
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
        loadVideoInSequence({ autoPlay: false });
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
        radioLiveOnly = false;
        stylePickerOpen = false;
        radioMeta = { mode: 'none', requested: '', note: '' };
        const query = String(info.query || '').trim();
        const artist = String(info.artist || '').trim();
        // `title`: nom fix de la ràdio (la d'una categoria pròpia és «Ràdio <categoria>», no «Ràdio de …»).
        const title = String(info.title || '').trim();
        searchRadio = { videos: pool, query, artist, title, channelId: String(info.channelId || '') };
        savedListId = '';
        radioSeedTitle = '';
        radioLabel = title || (artist ? `Ràdio de ${artist}` : query ? `Cerca «${query}»` : 'Cerca');
        queuedIds = waitingIds;
        pendingQueue = [];
        clearEmbeddedYouTubeSession();
        isPlaylistMode = true;
        activePlaylistId = QUEUE_ID;
        activePlaylistName = QUEUE_NAME;
        activePlaylistQueue = queue;
        currentPlaylistIndex = 0;
        loadVideoInSequence({ autoPlay: false });
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

    // Cançó inicial triada per l'usuari (el play d'una cançó de la fitxa d'artista): la busca al conjunt i, si el
    // motor l'hagués deixat fora del límit, l'hi afegeix al davant. Sense `seedId`, la tria el motor.
    function poolWithSeed(pool, videos, options = {}) {
        const id = String(options.seedId || '');
        if (!id) return { pool, seed: pickPoolSeed(pool, options) };
        const found = pool.find(item => String(item.id) === id);
        if (found) return { pool, seed: found };
        const extra = searchPool((Array.isArray(videos) ? videos : []).filter(item => String(item?.id) === id), 1)[0];
        return extra ? { pool: [extra, ...pool], seed: extra } : { pool, seed: pickPoolSeed(pool, options) };
    }

    // Ràdio només amb cançons d'un artista: `videos` són les seves cançons (el motor les ordena segons el gust i
    // permet cançons seguides del mateix artista, com a una ràdio de cerca) i «Barreja» es queda dins d'elles.
    // `seedId`: comença per aquesta cançó (el play de cada cançó de la fitxa); `title`: nom fix de la ràdio
    // («Videoclips de …»). Retorna true si ha començat (calen almenys dues cançons).
    function startArtistRadio(videos, options = {}) {
        if (typeof loadVideoInSequence !== 'function' || document.body.classList.contains('segueix-tv-active')) {
            return false;
        }
        const base = searchPool(videos, ARTIST_RADIO_POOL);
        const name = String(options.name || '').trim() || String(base[0]?.channelTitle || '').trim();
        if (base.length < 2 || !name) return false;
        const { pool, seed } = poolWithSeed(base, videos, options);
        return launchPoolRadio(
            pool,
            seed,
            { artist: name, title: String(options.title || '').trim(), channelId: options.channelId },
            options
        );
    }

    // ---------- Grans èxits d'un artista ----------

    // Clau d'una cançó per no repetir-la (el videoclip i la del «Tema», o la versió en directe): el títol sense el que
    // va entre parèntesis o claudàtors, sense accents ni signes.
    function hitKey(video) {
        return String(video?.title || '')
            .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    // Les cançons d'un artista de la més escoltada a la menys escoltada (`viewCount`), sense repetir la mateixa cançó
    // ni cap Short. Pura (tests/music-queue-selection.test.js).
    function greatestHits(videos, limit = MAX_QUEUE_LENGTH) {
        const seenIds = new Set();
        const seenKeys = new Set();
        return (Array.isArray(videos) ? videos : [])
            .filter(video => video?.id && !video.isShort && video.source !== 'static')
            .map((video, index) => ({ video, index, views: Number(video.viewCount) || 0 }))
            .sort((a, b) => b.views - a.views || a.index - b.index)
            .map(item => item.video)
            .filter(video => {
                const id = String(video.id);
                const key = hitKey(video) || id;
                if (seenIds.has(id) || seenKeys.has(key)) return false;
                seenIds.add(id);
                seenKeys.add(key);
                return true;
            })
            .slice(0, limit);
    }

    // Ràdio de grans èxits (llista d'«Artistes i grups»): les cançons de l'artista per ordre de visualitzacions, en
    // aquest ordre i sense el motor. Nom «Grans èxits de <artista>». Retorna true si ha començat (calen dues cançons).
    function startHitsRadio(videos, options = {}) {
        const name = String(options.name || '').trim();
        const hits = greatestHits(searchPool(videos, ARTIST_RADIO_POOL));
        if (hits.length < 2 || !name) return false;
        return playSelection(hits, `Grans èxits de ${name}`);
    }

    // Ràdio d'una categoria pròpia (user-categories.js): només cançons dels grups que l'usuari hi ha posat, ordenades
    // pel motor segons el gust i el mode de descoberta (com una ràdio d'artista), amb el nom «Ràdio <categoria>».
    // Retorna true si ha començat (calen almenys dues cançons).
    function startCategoryRadio(videos, options = {}) {
        if (typeof loadVideoInSequence !== 'function' || document.body.classList.contains('segueix-tv-active')) {
            return false;
        }
        const pool = searchPool(videos, ARTIST_RADIO_POOL);
        const name = String(options.name || '').trim();
        if (pool.length < 2 || !name) return false;
        return launchPoolRadio(pool, pickPoolSeed(pool, options), { artist: name, title: `Ràdio ${name}` }, options);
    }

    // Ràdio de l'estil (o de la combinació d'estils) d'un artista: la mateixa ràdio d'estil de la resta de l'app
    // (estils barrejats a parts iguals, antiguitat, límit d'artista, descans i mode de descoberta), amb el nom
    // de la cançó inicial quan rep seedVideos de la fitxa; altrament, el de l’estil.
    function startStyleRadio(categories, options = {}) {
        if (typeof loadVideoInSequence !== 'function' || document.body.classList.contains('segueix-tv-active')) {
            return false;
        }
        const styles = asCategories(categories);
        if (!styles.length) return false;
        const candidates = getCandidates(null, styles).filter(item => !isRejected(item));
        if (candidates.length < 2) return false;
        // Des de la fitxa, la primera sempre pertany a l'artista (també pot venir de l'arxiu).
        const fromArtist = Array.isArray(options.seedVideos);
        const seeds = fromArtist ? searchPool(options.seedVideos, ARTIST_RADIO_POOL) : candidates;
        const seed = pickPoolSeed(seeds, options);
        if (!seed) return false;
        const seedTitle = fromArtist
            ? window.SegueixSongTitle?.cleanTitle?.(seed.title, { artists: [seed.channelTitle] }) || seed.title
            : '';
        clickCategory = null;
        return launch(seed, styles, { ...options, seedTitle });
    }

    // Retorna true si ha engegat la reproducció amb cua (si no, l'app segueix el camí normal).
    // `playback` (opcional): `{ video, startAt, replaceHistory, autoPlay }` quan no és un clic sinó un vídeo que
    // s'obre sol (enllaç ?v=, historial del navegador, sessió recuperada): `video` és el vídeo ja resolt (arxiu,
    // historial) si no és al feed.
    function startFrom(videoId, source, playback = {}) {
        if (source === 'static' || document.body.classList.contains('segueix-tv-active')) return false;
        if (typeof loadVideoInSequence !== 'function') return false;

        const sameId = item => String(item?.id) === String(videoId);
        const video =
            findVideo(videoId) ||
            activePlaylistQueue.find(sameId) ||
            (playback?.video && sameId(playback.video) ? playback.video : null);
        if (!video || video.isShort) return false;

        // Una cançó de la ràdio, o de la llista pròpia que sona, es reprodueix dins de la cua
        const inQueue =
            isPlaylistMode &&
            ((activePlaylistId === QUEUE_ID && (!isLiveSong(video) || radioLiveOnly)) ||
                (activePlaylistId && !isEphemeral(activePlaylistId)));
        if (inQueue) {
            const index = activePlaylistQueue.findIndex(sameId);
            if (index >= 0) {
                currentPlaylistIndex = index;
                clearEmbeddedYouTubeSession();
                loadVideoInSequence(playbackOptions(playback));
                return true;
            }
        }
        // Una cançó de fora de la llista que sona engega una ràdio nova (abans s'obria la fitxa antiga d'un vídeo
        // sol, amb relacionats i els vídeos de l'artista).

        // Categoria de la ràdio: la de la fila de la portada on s'ha clicat (Cançó d'autor, Jazz...) o,
        // a la pàgina d'una categoria, la categoria seleccionada. A Novetats/Tot/... és una ràdio general.
        const fromRow = clickCategory;
        clickCategory = null;
        const selected = String(typeof selectedCategory === 'string' ? selectedCategory : '').trim();
        let category = fromRow !== null ? fromRow : selected;
        // Sense categoria clara (Novetats, Tot, una fitxa d'artista...) la ràdio és de la categoria principal
        // assignada a l'artista de la cançó: una ràdio d'un artista o d'una categoria sempre respecta l'estil.
        if (!category || GENERAL_VIEWS.has(category.toLowerCase())) category = primaryCategoryOf(video);
        return launch(video, category, { liveOnly: isLiveSong(video), playback });
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
        else if (mode === 'new') {
            // «Fora del meu radar»: artistes que no coneixes, els del teu estil primer; el motor encara filtra el que has
            // deixat rastre, així que amb pocs candidats es pot ampliar a tots els que no coneixes.
            const fresh = candidates.filter(item => !known(item));
            const styledFresh = styled.filter(item => !known(item));
            return styledFresh.length >= MIN_SEED_POOL ? styledFresh : fresh.length ? fresh : candidates;
        }
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
        // La descoberta geogràfica conserva l'ordre i els artistes; es renova des d’«A prop teu».
        if (radioLabel.startsWith('A prop teu ·')) return;
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
                liveOnly: radioLiveOnly,
                preceding: [...played, ...kept],
                playedIds: played.map(item => String(item.id)),
            }).filter(item => !playedIds.has(String(item.id)) && !keptIds.has(String(item.id)));
        }
        const maxLength = searchRadio ? SEARCH_RADIO_MAX : MAX_QUEUE_LENGTH;
        activePlaylistQueue = [...played, ...kept, ...fresh].slice(0, maxLength + played.length + kept.length);
        refresh();
    }

    // ---------- La ràdio no s'acaba mai ----------

    // Quan queden poques cançons per sonar (`minAhead`), s'hi afegeixen més (2026-10-18): en acabar la cua el
    // reproductor de YouTube es quedava amb la graella de recomanacions al damunt. Ràdio d'estil: més del mateix estil;
    // ràdio de cerca o d'artista: el mateix conjunt (torna a començar si ja han sonat totes); una selecció («Acabades de
    // sortir», «Grans èxits…»), «A prop teu» o una llista pròpia continuen com a ràdio de l'estil de la cançó que sona.
    // Retorna true si n'ha afegit.
    const EXTEND_KEEP_PLAYED = 60;
    const EXTEND_RECENT = 12;

    function extend({ minAhead = 3 } = {}) {
        if (!isPlaylistMode || !activePlaylistQueue.length || activePlaylistId === TV_ID) return false;
        const ahead = activePlaylistQueue.length - 1 - currentPlaylistIndex;
        if (ahead >= minAhead) return false;
        const current = activePlaylistQueue[Math.min(currentPlaylistIndex, activePlaylistQueue.length - 1)];
        if (!current) return false;
        const ownList = Boolean(activePlaylistId && !isEphemeral(activePlaylistId));
        const closedSet = Boolean(searchRadio) && !ownList;
        const ids = activePlaylistQueue.map(item => String(item?.id));
        const inQueue = new Set(ids);
        const recentIds = new Set(ids.slice(-EXTEND_RECENT));
        const preceding = activePlaylistQueue.slice(-EXTEND_RECENT);
        let styles = ownList || radioLabel ? [] : radioStyles();
        let more = [];
        if (closedSet) {
            more = buildSearchTail(searchRadio.videos, current, { preceding, playedIds: ids }).filter(
                item => !inQueue.has(String(item?.id))
            );
            // Ja han sonat totes: torna a començar el conjunt (sense les darreres)
            if (!more.length) {
                more = buildSearchTail(searchRadio.videos, current, { preceding }).filter(
                    item => !recentIds.has(String(item?.id))
                );
            }
        } else {
            if (!styles.length) styles = asCategories(primaryCategoryOf(current));
            const liveOnly = radioLiveOnly && !ownList;
            more = buildQueue(current, styles, { liveOnly, preceding, playedIds: ids }).filter(
                item => !inQueue.has(String(item?.id))
            );
            // Catàleg petit: poden tornar cançons d'abans, però no les darreres
            if (!more.length) {
                more = buildQueue(current, styles, { liveOnly, preceding }).filter(
                    item => !recentIds.has(String(item?.id))
                );
            }
        }
        if (!more.length) return false;

        if (ownList || (radioLabel && !closedSet)) {
            // La llista o la selecció s'ha acabat: continua com a ràdio de l'estil
            radioCategory = styles[0] || '';
            radioExtra = styles.slice(1);
            radioLabel = '';
            radioSeedTitle = '';
            if (ownList) {
                radioLiveOnly = false;
                searchRadio = null;
                savedListId = '';
                queuedIds = new Set();
                activePlaylistId = QUEUE_ID;
                activePlaylistName = QUEUE_NAME;
            }
        }
        let queue = [...activePlaylistQueue, ...more];
        // No deixa créixer la cua sense límit: només es guarden les darreres cançons ja sonades
        const drop = Math.max(0, currentPlaylistIndex - EXTEND_KEEP_PLAYED);
        if (drop) {
            queue = queue.slice(drop);
            currentPlaylistIndex -= drop;
        }
        activePlaylistQueue = queue;
        refresh();
        notifyQueueChanged();
        return true;
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
        if (searchRadio.title) return searchRadio.title;
        if (searchRadio.artist) return `Ràdio de ${searchRadio.artist}`;
        return searchRadio.query ? `Cerca: ${searchRadio.query}` : '';
    }

    // Estat de la cua per a la interfície (portada): què sona, què ve després i què espera.
    // La cua és local a aquesta pestanya: només serveix per recuperar una recàrrega,
    // inclosa la que aplica els canvis de Drive. No forma part de les dades sincronitzades.
    function captureSession() {
        if (!isPlaylistMode || !activePlaylistQueue.length || activePlaylistId === '__segueix_tv_discovery__') return null;
        return {
            v: 1,
            queue: activePlaylistQueue,
            index: currentPlaylistIndex,
            id: activePlaylistId,
            name: activePlaylistName,
            radioCategory,
            radioExtra,
            radioLiveOnly,
            radioMeta,
            radioLabel,
            radioSeedTitle,
            searchRadio,
            savedListId,
            queuedIds: [...queuedIds],
        };
    }

    function restoreSession(saved, videoId) {
        if (!saved || saved.v !== 1 || saved.id === '__segueix_tv_discovery__' ||
            !Array.isArray(saved.queue) || !saved.queue.length || saved.queue.length > 15000 ||
            !Number.isInteger(saved.index) || saved.index < 0 || saved.index >= saved.queue.length ||
            !saved.queue.every(video => video && typeof video === 'object' && video.id && !video.isShort) ||
            String(saved.queue[saved.index].id) !== String(videoId)) return false;
        activePlaylistQueue = saved.queue.map(video => ({ ...video }));
        currentPlaylistIndex = saved.index;
        activePlaylistId = typeof saved.id === 'string' ? saved.id : null;
        activePlaylistName = typeof saved.name === 'string' ? saved.name : 'Llista';
        radioCategory = typeof saved.radioCategory === 'string' ? saved.radioCategory : '';
        radioExtra = Array.isArray(saved.radioExtra) ? saved.radioExtra.filter(style => typeof style === 'string') : [];
        const restoredStyles = asCategories([radioCategory, ...radioExtra]);
        radioCategory = restoredStyles[0] || '';
        radioExtra = restoredStyles.slice(1);
        radioLiveOnly = saved.radioLiveOnly === true;
        radioMeta = saved.radioMeta && typeof saved.radioMeta === 'object' ? saved.radioMeta : null;
        radioLabel = typeof saved.radioLabel === 'string' ? saved.radioLabel : '';
        radioSeedTitle = typeof saved.radioSeedTitle === 'string' ? saved.radioSeedTitle : '';
        searchRadio = saved.searchRadio && typeof saved.searchRadio === 'object' ? saved.searchRadio : null;
        savedListId = typeof saved.savedListId === 'string' ? saved.savedListId : '';
        queuedIds = new Set(Array.isArray(saved.queuedIds) ? saved.queuedIds : []);
        isPlaylistMode = true;
        return true;
    }

    function getState() {
        const active = isPlaylistMode && activePlaylistQueue.length > 0;
        return {
            active,
            isRadio: active && activePlaylistId === QUEUE_ID,
            current: active ? activePlaylistQueue[currentPlaylistIndex] || null : null,
            next: active ? activePlaylistQueue[currentPlaylistIndex + 1] || null : null,
            pending: pendingQueue.length,
            categories: radioStyles(),
            liveOnly: activePlaylistId === QUEUE_ID && radioLiveOnly,
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
        if (activePlaylistId === QUEUE_ID && radioLiveOnly) return `Llista de directes${radioStyles().length ? ' · ' + radioStyles().join(' + ') : ''}`;
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

    // «A prop teu»: primer la distància (i el lloc), després el títol i el grup. Les cues desades abans només
    // porten `nearbyLocation` («Vic · 12 km aprox.»).
    function nearbyLine(video) {
        if (video.nearbyKm) {
            const place = video.nearbyPlace ? ` · ${escapeText(video.nearbyPlace)}` : '';
            return `<span class="mq-near"><strong>${escapeText(video.nearbyKm)}</strong>${place}</span>`;
        }
        return video.nearbyLocation ? `<span class="mq-near">${escapeText(video.nearbyLocation)}</span>` : '';
    }

    function renderItem(video, index, { active = false, draggable = true } = {}) {
        const unavailable = unavailableVideos.has(String(video.id));
        const duration = typeof getVideoDisplayDuration === 'function' ? getVideoDisplayDuration(video) : '';
        return `
            <div class="mq-item${active ? ' is-active' : ''}" data-index="${index}" role="listitem">
                ${draggable ? `<span class="mq-handle" aria-hidden="true" title="Arrossega per reordenar">${ICONS.grip}</span>` : '<span class="mq-handle mq-handle--placeholder" aria-hidden="true"></span>'}
                <button type="button" class="mq-play" data-mq-play="${index}" ${unavailable ? 'disabled' : ''} aria-label="${unavailable ? 'No disponible:' : 'Reprodueix'} ${escapeText(video.title)}">
                    <span class="mq-cover">
                        <img src="${escapeText(video.thumbnail || 'img/icon-192.png')}" alt="" loading="lazy" decoding="async">
                        ${active && !unavailable ? '<span class="mq-eq" aria-hidden="true"><i></i><i></i><i></i></span>' : ''}
                    </span>
                    <span class="mq-text">
                        ${nearbyLine(video)}
                        <span class="mq-title">${escapeText(video.title)}</span>
                        ${unavailable ? '<span class="mq-unavailable">No disponible</span>' : ''}
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
        if (radioSeedTitle) return `Ràdio ${radioSeedTitle}`;
        if (radioLiveOnly) return radioStyles().length ? `Ràdio de directes · ${radioStyles().join(' + ')}` : 'Ràdio de directes';
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
        if (radioSeedTitle || radioLiveOnly) return playlistName();
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
        const songs = changed === 1 ? '1 cançó nova' : `${changed} cançons noves`;
        // Confirmem l'acció, sense avisos sobre quants artistes coneix l'usuari o quant historial té.
        setModeStatus(
            changed
                ? `Ràdio adaptada a «${label}»: ${songs} a la llista.`
                : `La llista ja encaixava amb «${label}».`
        );
        notifyQueueChanged();
        return { changed, mode };
    }

    // Símbol de barrejar («Genera de nou la ràdio»): sense text, dins el grup de símbols del nom de la ràdio, perquè
    // mai quedi sol a una fila del capçal. Només les ràdios es poden regenerar.
    function regenerateButtonHtml() {
        if (activePlaylistId !== QUEUE_ID || radioLabel.startsWith('A prop teu ·')) return '';
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
            return `<span class="mq-source mq-styles" role="group" aria-label="Origen de la ràdio"><span class="mq-style">${escapeText(searchRadio.title || `Ràdio de ${searchRadio.artist}`)}</span><span class="mq-tools">${regenerateButtonHtml()}${saveButtonHtml()}${shareButtonHtml()}</span></span>`;
        }
        if (searchRadio) {
            return `<span class="mq-source mq-styles" role="group" aria-label="Origen de la ràdio"><span class="mq-style">Cerca: ${escapeText(searchRadio.query)} · estils barrejats</span><span class="mq-tools">${regenerateButtonHtml()}${saveButtonHtml()}${shareButtonHtml()}</span></span>`;
        }
        if (radioLabel) {
            return `<span class="mq-source mq-styles" role="group" aria-label="Origen de la ràdio"><span class="mq-style">${escapeText(radioLabel)}</span><span class="mq-tools">${regenerateButtonHtml()}${saveButtonHtml()}${shareButtonHtml()}</span></span>`;
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
        return `<span class="mq-source mq-styles" role="group" aria-label="Estil de la ràdio">${radioLiveOnly ? '<span class="mq-style">Directes</span>' : ''}${radioSeedTitle ? `<span class="mq-style">${escapeText(playlistName())}</span>` : ''}${chips}<span class="mq-tools">${add}${regenerateButtonHtml()}${saveButtonHtml()}${shareButtonHtml()}</span></span>`;
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
        if (stylePickerOpen) pickerScrollBase = currentScroll();
        refresh();
        if (stylePickerOpen && window.matchMedia?.('(max-width: 768px)').matches) {
            // Espera que les categories estiguin pintades abans de portar-les a la vista.
            window.requestAnimationFrame(() => {
                if (!stylePickerOpen) return;
                const picker = lastContainer?.querySelector?.('.mq-style-picker');
                picker?.scrollIntoView?.({
                    behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                    block: 'center',
                });
            });
        }
    }

    // ---------- Ordinador: el selector d'estils es tanca sol en fer scroll cap avall ----------
    // A l'ordinador, si el selector «Afegeix un estil» és obert i l'usuari baixa per veure les cançons de la ràdio, es
    // tanca sol. La cua fa scroll a dins seu (≥ 1025 px) o amb la pàgina (769–1024 px): es miren tots dos. Al mòbil no.
    const PICKER_CLOSE_SCROLL_PX = 24;
    const PICKER_DESKTOP_QUERY = '(min-width: 769px)';
    let pickerScrollBase = { queue: 0, page: 0 };

    function currentScroll() {
        return { queue: Number(lastContainer?.scrollTop) || 0, page: Number(window.scrollY) || 0 };
    }

    // Pur: tanca si s'ha baixat prou des del punt més alt (des que s'ha obert) a la cua o a la pàgina.
    function shouldClosePickerOnScroll({ open, desktop, base, current, threshold = PICKER_CLOSE_SCROLL_PX }) {
        if (!open || !desktop || !base || !current) return false;
        return current.queue - base.queue > threshold || current.page - base.page > threshold;
    }

    // Treu el selector sense repintar la cua i sense que les cançons que es veuen facin cap salt.
    function closePickerKeepingScroll(container) {
        const picker = container.querySelector?.('.mq-style-picker');
        const anchor = container.querySelector?.('.mq-section');
        const before = anchor?.getBoundingClientRect?.().top;
        const hadFocus = Boolean(picker?.contains?.(document.activeElement));
        stylePickerOpen = false;
        picker?.remove?.();
        const add = container.querySelector?.('[data-mq-add-style]');
        add?.setAttribute?.('aria-expanded', 'false');
        if (hadFocus) add?.focus?.({ preventScroll: true });
        const after = anchor?.getBoundingClientRect?.().top;
        const delta = Number.isFinite(before) && Number.isFinite(after) ? before - after : 0;
        if (delta > 0) {
            if (container.scrollHeight > container.clientHeight && container.scrollTop > 0) {
                container.scrollTop = Math.max(0, container.scrollTop - delta);
            } else {
                window.scrollBy?.(0, -delta);
            }
        }
    }

    function onQueueScroll() {
        const container = lastContainer;
        if (!stylePickerOpen || !container || !container.getClientRects?.().length) return;
        const current = currentScroll();
        // El punt de partida és el més alt on s'ha estat: pujar una mica i tornar a baixar també compta
        pickerScrollBase = {
            queue: Math.min(pickerScrollBase.queue, current.queue),
            page: Math.min(pickerScrollBase.page, current.page),
        };
        const desktop = Boolean(window.matchMedia?.(PICKER_DESKTOP_QUERY)?.matches);
        if (shouldClosePickerOnScroll({ open: stylePickerOpen, desktop, base: pickerScrollBase, current })) {
            closePickerKeepingScroll(container);
        }
    }

    let pageScrollBound = false;
    function bindPickerScroll(container) {
        container.addEventListener('scroll', onQueueScroll, { passive: true });
        if (!pageScrollBound) {
            pageScrollBound = true;
            window.addEventListener?.('scroll', onQueueScroll, { passive: true });
        }
    }

    // Retorna true si s'ha encarregat de pintar la cua.
    function render(container) {
        // La TV té la seva pròpia programació adaptativa (tv-live-queue / tv-programming).
        if (!container || !isPlaylistMode || !activePlaylistQueue.length || activePlaylistId === TV_ID) return false;
        const current = activePlaylistQueue[currentPlaylistIndex];
        if (!current) return false;

        const upcoming = activePlaylistQueue.slice(currentPlaylistIndex + 1);
        const unavailablePast = activePlaylistQueue.slice(0, currentPlaylistIndex)
            .map((video, index) => ({ video, index }))
            .filter(({ video }) => unavailableVideos.has(String(video.id)));
        const canRegenerate = activePlaylistId === QUEUE_ID;

        // La caràtula de la cançó que sona fa de fons de la capçalera (portada.css, «Ràdio amb el llenguatge de caràtules»)
        const art = String(current?.thumbnail || '').replace(/["'()\\\s]/g, '');
        container.innerHTML = `
            <div class="mq${activePlaylistId === QUEUE_ID ? ' mq--radio' : ''}"${art ? ` style="--mq-art: url('${escapeText(art)}')"` : ''}>
                <div class="mq-head">
                    <h2 class="mq-heading">${activePlaylistId === QUEUE_ID ? 'Ràdio' : 'Llista'}</h2>
                    ${radioNameHtml()}
                    ${canRegenerate || activePlaylistQueue.length > 1 ? `<button type="button" class="mq-regenerate mq-open-ytm" data-mq-open-ytm title="Obre aquesta cua, en el mateix ordre, a YouTube (pots desar-la i tornar-la a trobar a YouTube Music)">${ICONS.external}<span>Obre a YouTube</span></button>` : ''}
                    ${modeSelectorHtml()}
                </div>
                ${stylePickerHtml()}
                ${unavailableVideos.has(String(current.id)) ? `<p class="mq-note" role="status">${upcoming.some(video => !unavailableVideos.has(String(video.id))) ? 'Cançó no disponible. Passem a la següent.' : 'No queden cançons disponibles en aquesta ràdio.'}</p>` : ''}
                <div class="mq-section">${unavailableVideos.has(String(current.id)) ? 'Cançó no disponible' : 'Ara sona'}</div>
                ${renderItem(current, currentPlaylistIndex, { active: true, draggable: false })}
                ${unavailablePast.length ? `<div class="mq-section">No disponibles</div><div role="list">${unavailablePast.map(({ video, index }) => renderItem(video, index, { draggable: false })).join('')}</div>` : ''}
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
        bindPickerScroll(container);
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
        handleUnavailableVideo,
        captureSession,
        restoreSession,
        startFrom,
        startDiscovery,
        extend,
        getLastRadio,
        resumeLast,
        playSelection,
        greatestHits,
        startHitsRadio,
        nearbyPool: videos => searchPool(videos, Infinity).filter(video => !unavailableVideos.has(String(video.id))),
        startFromSearch,
        startArtistRadio,
        startCategoryRadio,
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
        toggleStylePicker,
        shouldClosePickerOnScroll,
        getStyles: radioStyles,
        buildQueue,
        buildYouTubeMusicUrl,
        buildListName,
        updateTransport,
        QUEUE_ID,
    };
})(window);
