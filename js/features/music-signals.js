// Senyals d'escolta i preferències de la música (ràdio, TV i reproducció normal).
// Implementació directa (patró 2). Un únic observador del reproductor per a tots els modes:
//  - Compta PROGRÉS EFECTIU (temps que avança de debò amb el reproductor en marxa). Obrir una pàgina,
//    cercar, fer seek, pausar, una fallada de xarxa o un autoplay bloquejat no són escoltes ni rebuig.
//  - Escolta qualificada: 30 s (o el 50 % si la peça és més curta). Finalització: 85 % de la durada.
//  - Una escolta triada voluntàriament que repeteix una cançó ja escoltada compta com a «repetició» (més
//    fort que una escolta automàtica). El bucle automàtic i tornar a pintar la interfície no amplifiquen
//    res: una mateixa cançó no suma dues vegades dins la finestra de repetició (30 min).
//  - Salt manual ràpid (abans de 20 s o del 25 %): senyal negatiu temporal; el motor el fa decaure.
//  - Estadístiques compactes per cançó i artista, agregades per mes i amb límit de mida, a
//    `catube_music_signals_v1`; preferències explícites («menys com aquesta», «no em recomanis aquest
//    artista») a `catube_music_prefs_v1`. Tot viatja amb la còpia/sincronització de configuració; en
//    importar-lo es fusiona (màxim per comptador) perquè importar dues vegades no ho dupliqui.
//  - Les escoltes de YouTube fora de Segueix Música no es poden inferir de les dades locals.
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;

    const STATS_KEY = 'catube_music_signals_v1';
    const PREFS_KEY = 'catube_music_prefs_v1';
    const CHANGED_EVENT = 'segueix:music-prefs-changed';
    const SIGNALS_EVENT = 'segueix:music-signals-updated';

    const RULES = Object.freeze({
        qualifiedSeconds: 30,
        qualifiedRatio: 0.5,
        finishRatio: 0.85,
        quickSkipSeconds: 20,
        quickSkipRatio: 0.25,
        repeatWindowMs: 30 * 60000,
        // Un avanç més gran entre dos missatges és un seek o una pestanya adormida, no reproducció.
        maxDelta: 3.5,
        // Si una cançó comença poc després que l'anterior acabi/salti, l'ha triat la ràdio, no l'usuari.
        autoWindowMs: 8000,
    });
    const LIMITS = Object.freeze({ songs: 1200, artists: 400, recent: 60, months: 12 });
    const COUNTERS = ['q', 'f', 'r', 's', 'h', 'll'];

    const toArray = value => (Array.isArray(value) ? value : []);
    const lower = value =>
        String(value || '')
            .trim()
            .toLowerCase();

    // ---------- Emmagatzematge ----------

    function readJson(key, fallback) {
        try {
            const raw = window.localStorage?.getItem?.(key);
            const parsed = raw ? JSON.parse(raw) : null;
            return parsed && typeof parsed === 'object' ? parsed : fallback;
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

    const emptyStats = () => ({ v: 1, songs: {}, artists: {}, recent: [] });
    const emptyPrefs = () => ({ v: 1, lessLike: {}, moreLike: {}, blocked: {} });

    function normalizeStats(raw) {
        const base = emptyStats();
        if (!raw || typeof raw !== 'object') return base;
        return {
            v: 1,
            songs: raw.songs && typeof raw.songs === 'object' ? raw.songs : base.songs,
            artists: raw.artists && typeof raw.artists === 'object' ? raw.artists : base.artists,
            recent: toArray(raw.recent).slice(0, LIMITS.recent),
        };
    }

    // Manté la mida acotada: fora les cançons/artistes menys valuosos (menys escoltes, més antics).
    function trimStats(stats, now = Date.now()) {
        const trim = (map, max) => {
            const keys = Object.keys(map);
            if (keys.length <= max) return;
            const value = key => {
                const e = map[key] || {};
                return (
                    (e.r || 0) * 4 +
                    (e.f || 0) * 2 +
                    (e.q || 0) +
                    Math.max(0, 1 - (now - (e.l || 0)) / (365 * 86400000))
                );
            };
            keys.sort((a, b) => value(b) - value(a))
                .slice(max)
                .forEach(key => delete map[key]);
        };
        trim(stats.songs, LIMITS.songs);
        trim(stats.artists, LIMITS.artists);
        Object.values(stats.artists).forEach(entry => {
            const months = entry.m && typeof entry.m === 'object' ? entry.m : null;
            if (!months) return;
            const keys = Object.keys(months).sort();
            keys.slice(0, Math.max(0, keys.length - LIMITS.months)).forEach(key => delete months[key]);
        });
        stats.recent = toArray(stats.recent).slice(0, LIMITS.recent);
        return stats;
    }

    // Fusió idempotent (màxim per comptador i per data): importar el mateix fitxer dues vegades no suma.
    function mergeStats(local, incoming) {
        const a = normalizeStats(local);
        const b = normalizeStats(incoming);
        const mergeMap = (target, source) => {
            Object.keys(source).forEach(key => {
                const src = source[key] || {};
                const dst = target[key] || {};
                COUNTERS.forEach(counter => {
                    const value = Math.max(Number(dst[counter]) || 0, Number(src[counter]) || 0);
                    if (value) dst[counter] = value;
                });
                ['l', 'sl', 'lq'].forEach(field => {
                    const value = Math.max(Number(dst[field]) || 0, Number(src[field]) || 0);
                    if (value) dst[field] = value;
                });
                if (src.a && !dst.a) dst.a = src.a;
                if (src.m || dst.m) {
                    dst.m = { ...(dst.m || {}) };
                    Object.keys(src.m || {}).forEach(month => {
                        dst.m[month] = Math.max(Number(dst.m[month]) || 0, Number(src.m[month]) || 0);
                    });
                }
                target[key] = dst;
            });
        };
        mergeMap(a.songs, b.songs);
        mergeMap(a.artists, b.artists);
        const seen = new Set();
        a.recent = [...a.recent, ...b.recent]
            .filter(entry => entry?.id && !seen.has(entry.id + '|' + entry.at) && seen.add(entry.id + '|' + entry.at))
            .sort((x, y) => (y.at || 0) - (x.at || 0))
            .slice(0, LIMITS.recent);
        return trimStats(a);
    }

    // Preferències explícites: cada entrada {at, on}; guanya la més recent (permet desfer i sincronitzar-ho).
    function mergePrefs(local, incoming) {
        const out = emptyPrefs();
        ['lessLike', 'moreLike', 'blocked'].forEach(kind => {
            const keys = new Set([...Object.keys(local?.[kind] || {}), ...Object.keys(incoming?.[kind] || {})]);
            keys.forEach(key => {
                const x = local?.[kind]?.[key];
                const y = incoming?.[kind]?.[key];
                out[kind][key] = !y || (x && x.at >= y.at) ? x : y;
            });
        });
        return out;
    }

    // ---------- Model de sessió (pur) ----------

    // Una sessió és una reproducció d'una cançó. Retorna els comptatges que s'han de sumar.
    function newSession({ id, artist, origin, now, duration = 0, seq = 0 }) {
        return {
            sid: `${seq}:${id}:${now}`,
            id,
            artist: artist || '',
            origin,
            startedAt: now,
            played: 0,
            lastPosition: null,
            duration: Number(duration) || 0,
            state: -1,
            credited: { q: false, f: false, counted: false },
            manualSkip: false,
            ended: false,
        };
    }

    // Suma progrés efectiu: només amb el reproductor en marxa i avanços petits i positius.
    function addProgress(session, position, state) {
        if (!Number.isFinite(position) || position < 0) return 0;
        const previous = session.lastPosition;
        session.lastPosition = position;
        if (previous === null) return 0;
        const delta = position - previous;
        if (state !== 1 || delta <= 0 || delta > RULES.maxDelta) return 0;
        session.played += delta;
        return delta;
    }

    const qualifiedNeeded = duration =>
        duration > 0 ? Math.min(RULES.qualifiedSeconds, duration * RULES.qualifiedRatio) : RULES.qualifiedSeconds;

    // Quins senyals ha assolit la sessió (sense efectes secundaris).
    function reached(session) {
        const duration = session.duration;
        return {
            qualified: session.played >= qualifiedNeeded(duration),
            finished: duration > 0 && session.played >= duration * RULES.finishRatio,
            quickSkip:
                session.manualSkip &&
                session.played <
                    Math.min(RULES.quickSkipSeconds, duration > 0 ? duration * RULES.quickSkipRatio : Infinity),
        };
    }

    // ---------- Seguiment (estat + efectes) ----------

    // deps: { load, save, now, resolveVideo, artistKeyOf, onCredit }
    function createTracker(deps = {}) {
        const now = deps.now || (() => Date.now());
        const artistKeyOf = deps.artistKeyOf || (video => lower(video?.channelId || ''));
        let stats = normalizeStats(deps.load ? deps.load() : null);
        let session = null;
        let seq = 0;
        let lastEndAt = 0;
        let lastAutoActionAt = 0;
        let saveTimer = null;
        const sessionStyles = {};

        function persist(immediate = false) {
            if (!deps.save) return;
            const run = () => {
                saveTimer = null;
                deps.save(trimStats(stats, now()));
            };
            if (immediate || deps.saveDelay === 0) {
                if (saveTimer) clearTimeout(saveTimer);
                run();
            } else if (!saveTimer) {
                saveTimer = setTimeout(run, deps.saveDelay ?? 2000);
            }
        }

        function entry(map, key, extra) {
            if (!map[key]) map[key] = { ...extra };
            return map[key];
        }
        const monthKey = at => new Date(at).toISOString().slice(0, 7);

        function credit(kind, sess) {
            if (sess.statsOff) return;
            const at = now();
            const song = entry(stats.songs, sess.id, { a: sess.artist });
            const artist = sess.artist ? entry(stats.artists, sess.artist, {}) : null;
            if (kind === 'q') {
                const recent = song.lq && at - song.lq < RULES.repeatWindowMs;
                song.l = at;
                if (artist) artist.l = at;
                if (recent) return;
                const returning = (song.q || 0) >= 1;
                song.q = (song.q || 0) + 1;
                song.lq = at;
                if (artist) {
                    artist.q = (artist.q || 0) + 1;
                    artist.m = artist.m || {};
                    artist.m[monthKey(at)] = (artist.m[monthKey(at)] || 0) + 1;
                }
                if (sess.origin === 'user' && returning) {
                    song.r = (song.r || 0) + 1;
                    if (artist) artist.r = (artist.r || 0) + 1;
                }
                sess.credited.counted = true;
                deps.onCredit?.({ type: 'qualified', session: sess, returning: sess.origin === 'user' && returning });
            } else if (kind === 'f' && sess.credited.counted) {
                song.f = (song.f || 0) + 1;
                if (artist) artist.f = (artist.f || 0) + 1;
                deps.onCredit?.({ type: 'finished', session: sess });
            } else if (kind === 's') {
                song.s = (song.s || 0) + 1;
                song.sl = at;
                if (artist) {
                    artist.s = (artist.s || 0) + 1;
                    artist.sl = at;
                }
                deps.onCredit?.({ type: 'skip', session: sess });
            }
        }

        function evaluate() {
            if (!session) return;
            const now0 = reached(session);
            if (now0.qualified && !session.credited.q) {
                session.credited.q = true;
                credit('q', session);
                persist();
            }
            if (now0.finished && session.credited.q && !session.credited.f) {
                session.credited.f = true;
                credit('f', session);
                persist();
            }
        }

        // Tanca la sessió actual: només aquí es pot decidir un salt manual ràpid.
        function finish(reason) {
            if (!session) return;
            evaluate();
            const flags = reached(session);
            if (flags.quickSkip && !session.credited.q && !session.credited.skip) {
                session.credited.skip = true;
                credit('s', session);
                persist();
            }
            lastEndAt = now();
            const closed = session;
            session = null;
            deps.onSessionEnd?.(closed, reason);
            return reason;
        }

        function noteRecent(id) {
            stats.recent = [{ id, at: now() }, ...stats.recent.filter(item => item.id !== id)].slice(0, LIMITS.recent);
        }

        return {
            RULES,
            get session() {
                return session;
            },
            getStats: () => stats,
            setStats(next) {
                stats = normalizeStats(next);
            },
            getSessionStyles: () => sessionStyles,
            // Missatge del reproductor: { videoId, state?, position?, duration? }.
            onPlayerEvent(event) {
                const videoId = String(event?.videoId || '');
                if (!videoId) return;
                const at = now();
                if (session && session.id !== videoId) finish('changed');
                if (!session) {
                    // Només comença una sessió quan el reproductor realment reprodueix (o avança).
                    if (event.state !== 1 && event.position === undefined) return;
                    const video = deps.resolveVideo ? deps.resolveVideo(videoId) : null;
                    const tvOnly = Boolean(video && deps.isSong && !deps.isSong(video));
                    if (tvOnly && !deps.allowNonSong?.()) return;
                    const auto = at - lastEndAt <= RULES.autoWindowMs || at - lastAutoActionAt <= RULES.autoWindowMs;
                    seq += 1;
                    session = newSession({
                        id: videoId,
                        artist: video ? artistKeyOf(video) : '',
                        origin: auto ? 'auto' : 'user',
                        now: at,
                        duration: event.duration || video?.durationSeconds || 0,
                        seq,
                    });
                    session.video = video || null;
                    // Contingut que no és una cançó (només hi és si una TV el reprodueix): no toca les estadístiques.
                    session.statsOff = tvOnly;
                    if (!tvOnly) noteRecent(videoId);
                }
                if (Number(event.duration) > 0) session.duration = Number(event.duration);
                if (event.state !== undefined) {
                    session.state = event.state;
                    // En acabar es tanca la sessió; si la mateixa cançó torna a sonar (bucle) s'obre una sessió nova
                    // com a automàtica i la finestra de repetició impedeix que amplifiqui el gust.
                    if (event.state === 0) {
                        session.ended = true;
                        evaluate();
                        finish('ended');
                        lastEndAt = at;
                    }
                }
                if (event.position !== undefined && session) {
                    addProgress(session, Number(event.position), session.state);
                    evaluate();
                }
            },
            // Acció de l'usuari sobre el reproductor: 'next' / 'prev' (la tria la ràdio) o 'pick' (tria voluntària).
            onUserAction(kind) {
                if (kind === 'next' || kind === 'prev') {
                    if (session) session.manualSkip = true;
                    lastAutoActionAt = now();
                } else if (kind === 'pick' && session) {
                    // Triar una altra cançó de la cua també abandona l'actual, però l'elecció és voluntària.
                    session.manualSkip = true;
                }
            },
            flush() {
                finish('flush');
                persist(true);
            },
            persist,
        };
    }

    // ---------- Preferències explícites ----------

    let prefs = normalizePrefs(readJson(PREFS_KEY, null));
    function normalizePrefs(raw) {
        const base = emptyPrefs();
        if (!raw || typeof raw !== 'object') return base;
        return {
            v: 1,
            lessLike: raw.lessLike && typeof raw.lessLike === 'object' ? raw.lessLike : base.lessLike,
            moreLike: raw.moreLike && typeof raw.moreLike === 'object' ? raw.moreLike : base.moreLike,
            blocked: raw.blocked && typeof raw.blocked === 'object' ? raw.blocked : base.blocked,
        };
    }

    function notifyPrefs(detail) {
        try {
            window.dispatchEvent(new window.CustomEvent(CHANGED_EVENT, { detail }));
        } catch (error) {
            // Entorn sense esdeveniments (proves)
        }
    }

    function setPref(kind, key, on, detail = {}) {
        if (!key) return false;
        const at = Date.now();
        // «+ com aquesta» i «− com aquesta» són excloents: activar-ne una desactiva l'altra.
        if (on && (kind === 'lessLike' || kind === 'moreLike')) {
            const other = kind === 'lessLike' ? 'moreLike' : 'lessLike';
            if (prefs[other][key]?.on) prefs[other][key] = { at, on: false };
        }
        prefs[kind][key] = { at, on: Boolean(on) };
        writeJson(PREFS_KEY, prefs);
        notifyPrefs({ type: kind, key, on: Boolean(on), ...detail });
        return true;
    }

    // ---------- Adaptador al navegador ----------

    const safe = fn => {
        try {
            return fn();
        } catch (error) {
            return undefined;
        }
    };

    function artistKeyOfVideo(video) {
        if (typeof window.getVideoArtistKey === 'function') return window.getVideoArtistKey(video);
        return lower(video?.channelId || video?.channelTitle || '');
    }

    function appVideos() {
        return safe(() => (Array.isArray(currentFeedVideos) ? currentFeedVideos : [])) || [];
    }

    let byIdCache = { source: null, size: 0, map: new Map() };
    function videoById(id) {
        const list = appVideos();
        if (byIdCache.source !== list || byIdCache.size !== list.length) {
            byIdCache = {
                source: list,
                size: list.length,
                map: new Map(list.map(video => [String(video?.id), video])),
            };
        }
        const key = String(id);
        const queue = safe(() => (Array.isArray(activePlaylistQueue) ? activePlaylistQueue : []));
        const queued = toArray(queue).find(video => String(video?.id) === key);
        return (
            queued ||
            byIdCache.map.get(key) ||
            safe(() => (typeof getHistoryVideoById === 'function' ? getHistoryVideoById(key) : null)) ||
            null
        );
    }

    function isSongVideo(video) {
        if (video?.isShort) return false;
        const kind = lower(video?.contentType).replace(/-/g, '_');
        return !kind || kind === 'song' || kind === 'live_song';
    }

    let tracker = null;

    function ensureTracker() {
        if (tracker) return tracker;
        tracker = createTracker({
            load: () => readJson(STATS_KEY, null),
            save: stats => writeJson(STATS_KEY, stats),
            resolveVideo: videoById,
            isSong: isSongVideo,
            // Una TV pot reproduir contingut que no és una cançó: es deixa passar només per a l'aprenentatge de la TV.
            allowNonSong: () => sessionSinks.length > 0 && document.body?.classList?.contains('segueix-tv-playback'),
            onSessionEnd(session) {
                if (!session || !sessionSinks.length) return;
                const summary = {
                    video: session.video,
                    duration: session.duration,
                    activeWatchedSeconds: session.played,
                    maxPosition: session.lastPosition || 0,
                    manualSkip: session.manualSkip,
                };
                sessionSinks.forEach(sink => safe(() => sink(summary)));
            },
            artistKeyOf: artistKeyOfVideo,
            onCredit(event) {
                if (event.type === 'qualified') {
                    const video = event.session.video;
                    const stylesFn = app.features.discovery?.stylesOf;
                    if (video && stylesFn) {
                        toArray(safe(() => stylesFn(video, null))).forEach(style => {
                            const styles = tracker.getSessionStyles();
                            const name = String(style).toLowerCase();
                            styles[name] = (styles[name] || 0) + 1;
                        });
                    }
                }
                snapshotCache.rev += 1;
                try {
                    window.dispatchEvent(new window.CustomEvent(SIGNALS_EVENT, { detail: { type: event.type } }));
                } catch (error) {
                    // Entorn sense esdeveniments (proves)
                }
            },
        });
        return tracker;
    }

    // Snapshot per al motor de selecció (només lectura). Es reconstrueix quan canvia alguna font.
    const snapshotCache = { rev: 0, key: '', value: null };

    function snapshot() {
        const history = safe(() => (typeof getHistoryItems === 'function' ? getHistoryItems() : [])) || [];
        const likedVideos = safe(() => (typeof getLikedVideos === 'function' ? getLikedVideos() : [])) || [];
        const followedIds =
            safe(() => (typeof getFollowedChannelIds === 'function' ? getFollowedChannelIds() : [])) || [];
        const stats = ensureTracker().getStats();
        const key = [
            snapshotCache.rev,
            history.length,
            history[0]?.id || '',
            likedVideos.length,
            likedVideos[0]?.id || '',
            followedIds.length,
            Object.keys(prefs.lessLike).length,
            Object.keys(prefs.moreLike).length,
            Object.values(prefs.moreLike).filter(entry => entry?.on).length,
            Object.values(prefs.lessLike).filter(entry => entry?.on).length,
            Object.keys(prefs.blocked).length,
            stats.recent.length,
        ].join('|');
        if (snapshotCache.key === key && snapshotCache.value) return snapshotCache.value;

        const value = buildSnapshot({
            stats,
            prefs,
            history,
            liked: likedVideos,
            followedIds,
            artistKeyOf: artistKeyOfVideo,
            sessionStyles: tracker?.getSessionStyles?.() || {},
            stylesOf: app.features.discovery?.stylesOf ? video => app.features.discovery.stylesOf(video, null) : null,
            videoById,
        });
        snapshotCache.key = key;
        snapshotCache.value = value;
        return value;
    }

    // Construcció pura del snapshot (per a proves): historial = informació feble, sense inventar escoltes.
    function buildSnapshot({
        stats,
        prefs: p,
        history,
        liked,
        followedIds,
        artistKeyOf: keyOf,
        sessionStyles,
        stylesOf,
        videoById: lookup,
    }) {
        const songs = { ...(stats?.songs || {}) };
        const artists = {};
        Object.keys(stats?.artists || {}).forEach(key => {
            artists[key] = { ...stats.artists[key] };
        });
        const weakArtist = key => {
            if (!key) return;
            if (!artists[key]) artists[key] = {};
            artists[key].h = (artists[key].h || 0) + 1;
        };
        toArray(history).forEach(video => {
            if (!video?.id || video.isShort) return;
            const id = String(video.id);
            const at = new Date(video.viewedAt || 0).getTime() || 0;
            if (!songs[id]) songs[id] = { h: 1, l: at };
            else if (!songs[id].h) songs[id] = { ...songs[id], h: 1 };
            weakArtist(keyOf(video));
        });
        const likedIdsSet = new Set();
        const likedArtists = {};
        toArray(liked).forEach(video => {
            if (!video?.id) return;
            likedIdsSet.add(String(video.id));
            const key = keyOf(video);
            if (key) likedArtists[key] = (likedArtists[key] || 0) + 1;
        });
        const followed = new Set(
            toArray(followedIds)
                .map(id => keyOf({ channelId: id }))
                .filter(Boolean)
        );
        const lessLike = new Set(Object.keys(p?.lessLike || {}).filter(id => p.lessLike[id]?.on));
        const moreLike = new Set(Object.keys(p?.moreLike || {}).filter(id => p.moreLike[id]?.on));
        const blocked = new Set(Object.keys(p?.blocked || {}).filter(key => p.blocked[key]?.on));
        // «Menys com aquesta»: reforç negatiu lleu per a l'artista (el motor l'aplica com a penalització).
        lessLike.forEach(id => {
            const artistKey = songs[id]?.a || keyOf(lookup?.(id) || {});
            if (artistKey) {
                artists[artistKey] = { ...(artists[artistKey] || {}), ll: (artists[artistKey]?.ll || 0) + 1 };
            }
        });
        // «+ com aquesta»: reforç lleu per a l'artista i punts d'estil (com un cor, però menys).
        moreLike.forEach(id => {
            const artistKey = songs[id]?.a || keyOf(lookup?.(id) || {});
            if (artistKey) {
                artists[artistKey] = { ...(artists[artistKey] || {}), ml: (artists[artistKey]?.ml || 0) + 1 };
            }
        });
        // Punts d'estil: artistes seguits, cors, «+ com aquesta» i escoltes qualificades.
        const styles = {};
        const addStyles = (video, points) => {
            const list = stylesOf && video ? safe(() => stylesOf(video)) : null;
            toArray(list).forEach(style => {
                const name = String(style).toLowerCase();
                styles[name] = (styles[name] || 0) + points;
            });
        };
        toArray(liked).forEach(video => addStyles(lookup?.(video?.id) || video, 2));
        moreLike.forEach(id => addStyles(lookup?.(id), 2));
        Object.keys(songs).forEach(id => {
            const q = songs[id]?.q || 0;
            if (q) addStyles(lookup?.(id), Math.min(q, 3));
        });
        return {
            songs,
            artists,
            liked: likedIdsSet,
            likedArtists,
            followed,
            lessLike,
            moreLike,
            blockedArtists: blocked,
            recent: toArray(stats?.recent),
            sessionStyles: sessionStyles || {},
            styles,
        };
    }

    // ---------- Observador únic del reproductor ----------

    function parseData(raw) {
        if (raw && typeof raw === 'object') return raw;
        if (typeof raw !== 'string') return null;
        try {
            return JSON.parse(raw);
        } catch (error) {
            return null;
        }
    }

    // El reproductor pot ser a la finestra flotant del sistema: es busca amb app.utils.playerElement()
    function playerHost() {
        return app.utils?.playerElement?.() || document.getElementById?.('videoPlayer') || null;
    }

    function playerFrame() {
        return playerHost()?.querySelector?.('iframe') || document.querySelector('#videoPlayer iframe');
    }

    function currentVideoId() {
        return String(playerHost()?.dataset?.playingVideoId || '');
    }

    let sinkRegistered = false;
    const sessionSinks = [];

    function onMessage(event) {
        const frame = playerFrame();
        // Només el reproductor principal (no els Shorts ni altres iframes).
        if (!frame || (event.source && event.source !== frame.contentWindow)) return;
        const payload = parseData(event.data);
        if (!payload) return;
        const videoId = currentVideoId();
        if (!videoId) return;
        const t = ensureTracker();
        if (payload.event === 'onStateChange') {
            t.onPlayerEvent({ videoId, state: Number(payload.info) });
        } else if (payload.event === 'infoDelivery') {
            const info = payload.info || {};
            const position = Number(info.currentTime);
            const state = info.playerState !== undefined ? Number(info.playerState) : undefined;
            const update = { videoId, duration: Number(info.duration) || undefined };
            if (state !== undefined) update.state = state;
            if (Number.isFinite(position)) update.position = position;
            t.onPlayerEvent(update);
        }
    }

    // Botons que abandonen la cançó actual: següent/anterior (tria la ràdio) o una altra cançó de la cua (voluntari).
    function onClickCapture(event) {
        if (!tracker?.session) return;
        const target = event.target;
        if (
            target?.closest?.(
                '.queue-next-button, .queue-prev-button, [data-tv-programming-next], [data-tv-overlay-next], .mq-next, .mq-prev'
            )
        ) {
            tracker.onUserAction('next');
            return;
        }
        const item = target?.closest?.('#playlistQueueContainer .playlist-queue-item');
        if (item && !item.classList.contains('is-active')) tracker.onUserAction('pick');
    }

    function init() {
        ensureTracker();
        window.addEventListener('message', onMessage);
        document.addEventListener('click', onClickCapture, true);
        window.addEventListener('pagehide', () => tracker?.flush());
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') tracker?.persist(true);
        });
    }

    // La TV aprèn amb el mateix observador: tv-learning s'hi subscriu en comptes de crear-ne un altre.
    function registerSessionSink(sink) {
        if (typeof sink === 'function') {
            sessionSinks.push(sink);
            sinkRegistered = true;
        }
        return sinkRegistered;
    }

    // ---------- API pública ----------

    function importMerged(raw) {
        try {
            const incoming = typeof raw === 'string' ? JSON.parse(raw) : raw;
            const merged = mergeStats(ensureTracker().getStats(), incoming);
            ensureTracker().setStats(merged);
            writeJson(STATS_KEY, merged);
            snapshotCache.rev += 1;
            return true;
        } catch (error) {
            return false;
        }
    }

    function importPrefs(raw) {
        try {
            const incoming = typeof raw === 'string' ? JSON.parse(raw) : raw;
            prefs = mergePrefs(prefs, normalizePrefs(incoming));
            writeJson(PREFS_KEY, prefs);
            snapshotCache.rev += 1;
            return true;
        } catch (error) {
            return false;
        }
    }

    app.features.musicSignals = {
        STATS_KEY,
        PREFS_KEY,
        CHANGED_EVENT,
        SIGNALS_EVENT,
        RULES,
        LIMITS,
        // pur
        createTracker,
        newSession,
        addProgress,
        reached,
        mergeStats,
        mergePrefs,
        trimStats,
        buildSnapshot,
        // navegador
        init,
        snapshot,
        registerSessionSink,
        importMerged,
        importPrefs,
        getStats: () => ensureTracker().getStats(),
        getPrefs: () => prefs,
        lessLikeThis: video =>
            setPref('lessLike', String(video?.id || ''), true, { artist: artistKeyOfVideo(video || {}) }),
        undoLessLike: id => setPref('lessLike', String(id || ''), false),
        moreLikeThis: video =>
            setPref('moreLike', String(video?.id || ''), true, { artist: artistKeyOfVideo(video || {}) }),
        undoMoreLike: id => setPref('moreLike', String(id || ''), false),
        isMoreLike: id => Boolean(prefs.moreLike[String(id)]?.on),
        blockArtist: video =>
            setPref('blocked', artistKeyOfVideo(video || {}), true, { name: video?.channelTitle || '' }),
        unblockArtist: key => setPref('blocked', lower(key), false),
        isLessLike: id => Boolean(prefs.lessLike[String(id)]?.on),
        isArtistBlocked: key => Boolean(prefs.blocked[lower(key)]?.on),
        reset() {
            prefs = emptyPrefs();
            writeJson(PREFS_KEY, prefs);
            ensureTracker().setStats(emptyStats());
            writeJson(STATS_KEY, emptyStats());
            snapshotCache.rev += 1;
        },
    };

    if (typeof document !== 'undefined' && document.readyState) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
        else init();
    }
})(window);
