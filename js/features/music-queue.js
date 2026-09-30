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
        plus: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>',
        minus: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M5 12h14"/></svg>',
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
    // Pla de descoberta aplicat a l'última cua generada: { mode, requested, note } (veure discovery.js).
    let radioMeta = null;
    // Nom de la selecció que s'ha engegat tal com és (p. ex. «Acabades de sortir»); buit en una ràdio normal.
    let radioLabel = '';
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

    // Aplica el mode de descoberta (A casa / Una mica de tot / Sorprèn-me) a una llista ja ordenada.
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

    // «La teva ràdio»: tria la primera cançó segons el mode de descoberta i engega la ràdio.
    // No canvia res mentre l'usuari no ho demana: només s'invoca des d'un gest de l'usuari.
    // Retorna { started, note, mode } perquè la interfície pugui explicar què s'ha fet.
    function startDiscovery(options = {}) {
        const none = { started: false, note: '', mode: 'none', seed: null };
        if (document.body.classList.contains('segueix-tv-active')) return none;
        if (typeof loadVideoInSequence !== 'function') return none;
        const candidates = getCandidates(null, '');
        if (!candidates.length) return none;

        if (engineOn()) {
            // «La teva ràdio»: la primera cançó també la tria el motor (gust, actualitat, rotació i mode).
            const sel = engine();
            const ctx = sel.getAppContext(Array.isArray(currentFeedVideos) ? currentFeedVideos : candidates);
            const first = sel.selectRadio({
                ctx,
                candidates,
                signals: selectionSignals(),
                mode: options.mode || app.features.discovery?.getMode?.() || 'mix',
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
        if (!keepNext) {
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
        const fresh = buildQueue(current, radioStyles(), {
            preceding: [...played, ...kept],
            playedIds: played.map(item => String(item.id)),
        }).filter(item => !playedIds.has(String(item.id)) && !keptIds.has(String(item.id)));
        activePlaylistQueue = [...played, ...kept, ...fresh].slice(0, MAX_QUEUE_LENGTH + played.length + kept.length);
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
    function radioNameHtml(modeLabel) {
        if (activePlaylistId !== QUEUE_ID) {
            return `<span class="mq-source">${escapeText(activePlaylistName || '')}</span>`;
        }
        if (radioLabel) return `<span class="mq-source">Selecció: ${escapeText(radioLabel)}</span>`;
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
            ? `<button type="button" class="mq-add-style" data-mq-add-style aria-haspopup="true" aria-expanded="${stylePickerOpen}" aria-label="Afegeix un estil a la ràdio" title="Afegeix un estil a la ràdio">${ICONS.plus}</button>`
            : '';
        return `<span class="mq-source mq-styles" role="group" aria-label="Estil de la ràdio">${chips}${add}${modeLabel ? `<span class="mq-mode">· ${escapeText(modeLabel)}</span>` : ''}</span>`;
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
        // Mode de descoberta aplicat a aquesta ràdio (o l'explicació si no hi havia historial suficient).
        const discovery = app.features.discovery;
        const applied = canRegenerate ? radioMeta : null;
        const modeLabel =
            applied && applied.mode !== 'variety' && applied.mode !== 'none'
                ? discovery?.MODES?.find(item => item.id === applied.mode)?.label || ''
                : '';
        const modeNote = applied?.note ? `<p class="mq-note" role="status">${escapeText(applied.note)}</p>` : '';

        container.innerHTML = `
            <div class="mq${activePlaylistId === QUEUE_ID ? ' mq--radio' : ''}">
                <div class="mq-head">
                    <h2 class="mq-heading">Ràdio</h2>
                    ${radioNameHtml(modeLabel)}
                    ${canRegenerate || activePlaylistQueue.length > 1 ? `<button type="button" class="mq-regenerate mq-open-ytm" data-mq-open-ytm title="Obre aquesta cua, en el mateix ordre, a YouTube (pots desar-la i tornar-la a trobar a YouTube Music)">${ICONS.external}<span>Obre a YouTube</span></button>` : ''}
                    ${canRegenerate ? `<button type="button" class="mq-regenerate" data-mq-regenerate title="Genera de nou la ràdio">${ICONS.shuffle}<span>Barreja</span></button>` : ''}
                </div>
                ${stylePickerHtml()}
                ${modeNote}
                <div class="mq-section">Ara sona</div>
                ${renderItem(current, currentPlaylistIndex, { active: true, draggable: false })}
                <div class="mq-section">A continuació${upcoming.length ? ` · ${upcoming.length}` : ''}</div>
                <div class="mq-list" role="list">
                    ${upcoming.map((video, i) => renderItem(video, currentPlaylistIndex + 1 + i)).join('') || '<div class="mq-empty">No hi ha més cançons a la ràdio.</div>'}
                </div>
            </div>
        `;
        bindContainer(container);
        setupSortable(container);
        updateTransport();
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

    // ---------- Media Session (controls del sistema: pantalla de bloqueig, auriculars, notificació) ----------
    function updateMediaSession() {
        if (!('mediaSession' in navigator) || typeof MediaMetadata !== 'function') return;
        const video = isPlaylistMode ? activePlaylistQueue[currentPlaylistIndex] : null;
        if (!video) return;
        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: video.title || '',
                artist: video.channelTitle || '',
                album: activePlaylistName || 'Segueix!',
                artwork: video.thumbnail ? [{ src: video.thumbnail, sizes: '480x360', type: 'image/jpeg' }] : [],
            });
            navigator.mediaSession.playbackState = isPlaying() ? 'playing' : 'paused';
        } catch (error) {
            // Navegador sense suport complet: la reproducció no en depèn
        }
    }

    function initMediaSession() {
        if (!('mediaSession' in navigator)) return;
        const set = (action, handler) => {
            try {
                navigator.mediaSession.setActionHandler(action, handler);
            } catch (error) {
                // Acció no suportada en aquest navegador
            }
        };
        set('play', () => !isPlaying() && toggleMainPlayerPlayback?.());
        set('pause', () => isPlaying() && toggleMainPlayerPlayback?.());
        set('previoustrack', () => {
            if (isPlaylistMode && currentPlaylistIndex > 0) {
                currentPlaylistIndex -= 1;
                loadVideoInSequence();
            }
        });
        set('nexttrack', () => {
            if (isPlaylistMode && currentPlaylistIndex < activePlaylistQueue.length - 1) {
                currentPlaylistIndex += 1;
                loadVideoInSequence();
            }
        });
    }

    // ---------- Estat de reproducció ----------
    // Els controls (anterior / play-pausa / següent) ja són dins del reproductor: no hi ha barra
    // pròpia sota el vídeo. Només mantenim els controls del sistema (Media Session).
    function isPlaying() {
        return document.getElementById('videoPlayer')?.dataset?.playerState === '1';
    }

    function updateTransport() {
        updateMediaSession();
    }

    function initTransport() {
        initMediaSession();
        const player = document.getElementById('videoPlayer');
        if (player && typeof MutationObserver === 'function') {
            new MutationObserver(updateTransport).observe(player, {
                attributes: true,
                attributeFilter: ['data-player-state'],
            });
        }
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
