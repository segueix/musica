// Motor de selecció musical compartit (ràdio, feed personalitzat, files de la portada).
// Implementació directa (patró 2): totes les funcions són pures. El rellotge (`now`) i el generador
// aleatori (`rng`) s'injecten, de manera que les proves i les simulacions són reproduïbles.
//
// Principis (veure docs/MUSICA_SELECCIO.md):
//  - Una sola puntuació: gust 45 % · actualitat 20 % · popularitat 15 % · rotació 10 % · afinitat 10 %,
//    amb penalitzacions per saturació, exposició recent i salts manuals.
//  - Una sola selecció sota restriccions conjuntes (antiguitat, artista, descans, versions duplicades)
//    que s'apliquen al RESULTAT FINAL: cap ordenació posterior no les desfà.
//  - Res d'inventat: l'any original només surt d'evidència (camps `originalYear*` del feed); la resta
//    d'antiguitat s'aproxima amb la data de pujada o la llista d'artistes antics, amb la confiança
//    corresponent. Les mètriques absents no són «zero interès».
//  - Configurable i reversible: `CONFIG.musicSelection` o `setConfigOverrides()` canvien els llindars;
//    `engine: 'legacy'` (o `catube_selection_engine=legacy` al localStorage) torna a la política anterior.
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;

    const DAY = 86400000;
    const YEAR = 365.25 * DAY;
    const ENGINE_KEY = 'catube_selection_engine';

    // ---------- Configuració ----------

    const DEFAULTS = Object.freeze({
        engine: 'v1',
        // Antiguitat real de la música (no de la pujada): recent ≤ 24 mesos; mitjana fins a 8 anys; històrica.
        era: {
            recentMonths: 24,
            midYears: 8,
            target: { recent: 0.65, mid: 0.25, historic: 0.1 },
            // «Estrena»: pujada fa poc, sense evidència d'una gravació antiga i sense ser una reedició.
            newReleaseDays: 90,
            // Catàleg històric confirmat (llista d'artistes antics): bonus perquè, dins del petit cupo d'antigues, surtin
            // les peces representatives d'aquests artistes i no qualsevol reedició automàtica.
            curatedBonus: 0.12,
        },
        general: {
            // Finestra sobre la qual es compleixen els límits (les primeres 20 recomanacions).
            top: 20,
            maxHistoricTop: 2,
            noConsecutiveHistoric: true,
            maxPerArtistTop: 2,
            // Cançons d'altres artistes entre dues d'un mateix artista.
            artistGap: 3,
        },
        // Una cançó no es reprograma automàticament abans de 12 cançons ni de 60 minuts.
        cooldown: { songs: 12, minutes: 60 },
        weights: { taste: 0.45, actuality: 0.2, popularity: 0.15, rotation: 0.1, affinity: 0.1 },
        // Repartiment coneguda/preferida · descoberta afí · sorpresa segons el mode.
        familiarity: {
            home: { known: 0.75, affine: 0.2, surprise: 0.05 },
            mix: { known: 0.6, affine: 0.3, surprise: 0.1 },
            surprise: { known: 0.25, affine: 0.45, surprise: 0.3 },
            // «Fora del meu radar»: res de conegut (filtre dur a selectRadio); entre els nous, els d'estils afins una mica més.
            new: { known: 0, affine: 0.5, surprise: 0.5 },
        },
        // «Fora del meu radar»: artistes diferents a procurar i quant es redueix el pes de la popularitat (els èxits ja
        // són coneguts; es vol que surtin grups que potser l'usuari no sap que existeixen).
        discovery: { minArtists: 12, popularityDamping: 0.5, secondSongPenalty: 0.25, weakKnownPenalty: 0.5 },
        // Reforços limitats (logarítmics) i decaïment temporal.
        taste: {
            halfLifeDays: 120,
            likedBonus: 0.7,
            // «+ com aquesta»: reforç explícit a la cançó (menor que el cor) i lleu a l'artista.
            moreLikeBonus: 0.5,
            moreLikeArtist: 0.12,
            followedArtist: 0.6,
            savedSongCount: 5,
            artistCount: 12,
            skipHalfLifeDays: 7,
            skipsToPenalize: 2,
            artistSkipsToPenalize: 3,
        },
        // Preferència explícita per música antiga: només amb prou senyals forts (no amb un sol clic).
        preference: { minWeight: 6, priorWeight: 8, maxHistoricShare: 0.6 },
        queue: { min: 12, max: 40, pool: 260 },
        // Força amb què els objectius d'antiguitat i familiaritat corregeixen la puntuació base.
        // `style`: força del repartiment igual entre els estils sumats a una ràdio («Pop + Rock»).
        gain: { era: 1.6, familiarity: 0.5, style: 1.4 },
        noise: 0.06,
        historicNoiseFactor: 3,
    });

    let overrides = {};

    function merge(base, extra) {
        const out = Array.isArray(base) ? base.slice() : { ...base };
        Object.keys(extra || {}).forEach(key => {
            const value = extra[key];
            out[key] =
                value && typeof value === 'object' && !Array.isArray(value) && base && typeof base[key] === 'object'
                    ? merge(base[key], value)
                    : value;
        });
        return out;
    }

    function storedEngine() {
        try {
            return window.localStorage?.getItem?.(ENGINE_KEY) || '';
        } catch (error) {
            return '';
        }
    }

    function getConfig() {
        let cfg = merge(DEFAULTS, window.CONFIG?.musicSelection || {});
        cfg = merge(cfg, overrides);
        const stored = storedEngine();
        if (stored === 'legacy' || stored === 'v1') cfg.engine = stored;
        return cfg;
    }

    function setConfigOverrides(next) {
        overrides = next && typeof next === 'object' ? next : {};
        return getConfig();
    }

    const isEnabled = () => getConfig().engine !== 'legacy';

    // ---------- Utilitats ----------

    const toArray = value => (Array.isArray(value) ? value : []);
    const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
    const addOnce = (list, value) => {
        if (!list.includes(value)) list.push(value);
    };
    // Mateix ordre que String#localeCompare, però amb un sol col·lador: localeCompare el tornava a preparar a cada
    // comparació i ordenar els grups d'artistes a cada cançó triada feia lenta la ràdio al mòbil.
    const KEY_COLLATOR = typeof Intl !== 'undefined' && Intl.Collator ? new Intl.Collator() : null;
    const compareKeys = (a, b) => (KEY_COLLATOR ? KEY_COLLATOR.compare(a, b) : String(a).localeCompare(String(b)));
    const idOf = video => String(video?.id || '');
    const lower = value =>
        String(value || '')
            .trim()
            .toLowerCase();
    // Saturació logarítmica: 0 amb x = 0 i 1 amb x ≥ k.
    const sat = (x, k) => (x > 0 ? clamp(Math.log1p(x) / Math.log1p(k)) : 0);

    function timestampOf(video) {
        const time = new Date(video?.publishedAt || video?.uploadDate || 0).getTime();
        return Number.isFinite(time) ? time : 0;
    }

    function defaultArtistKey(video) {
        return lower(video?.channelId || video?.snippet?.channelId || video?.channelTitle || '');
    }

    // ---------- Antiguitat real ----------

    // Data original: `originalDate` (AAAA-MM-DD) o mitjan d'any (AAAA-07-01) quan només se'n sap l'any.
    function originalTime(video) {
        const year = Number(video?.originalYear);
        if (!Number.isInteger(year) || year < 1900) return 0;
        const full = video?.originalDate ? new Date(String(video.originalDate) + 'T12:00:00Z').getTime() : NaN;
        return Number.isFinite(full) ? full : Date.UTC(year, 6, 1);
    }

    // Retorna { tier, ageYears, year, basis, confidence, isReissue }.
    //  basis: 'original' (evidència d'any) · 'upload' (data de pujada) · 'artist-list' (llista d'artistes antics).
    function eraOf(video, { now = Date.now(), isClassicArtist = null, config = null } = {}) {
        const cfg = config || getConfig();
        const uploaded = timestampOf(video);
        const uploadAge = uploaded ? Math.max(0, now - uploaded) / YEAR : null;
        const evidence = originalTime(video);
        let ageYears;
        let basis;
        let confidence;
        if (evidence) {
            ageYears = Math.max(0, now - evidence) / YEAR;
            basis = 'original';
            confidence = video.originalYearConfidence || 'mitjana';
        } else if (typeof isClassicArtist === 'function' && isClassicArtist(video)) {
            // Aproximació conservadora: obra d'un artista de la llista d'antics sense any verificat.
            return {
                tier: 'historic',
                ageYears: uploadAge === null ? cfg.era.midYears + 1 : Math.max(uploadAge, cfg.era.midYears + 1),
                year: null,
                basis: 'artist-list',
                confidence: 'baixa',
                isReissue: false,
            };
        } else if (uploadAge !== null) {
            ageYears = uploadAge;
            basis = 'upload';
            confidence = 'mitjana';
        } else {
            return { tier: 'mid', ageYears: null, year: null, basis: 'unknown', confidence: 'nula', isReissue: false };
        }
        const tier =
            ageYears <= cfg.era.recentMonths / 12 ? 'recent' : ageYears <= cfg.era.midYears ? 'mid' : 'historic';
        // Reedició: pujada més de 2 anys després de la data original.
        const isReissue = basis === 'original' && uploadAge !== null && ageYears - uploadAge > 2;
        const year = evidence ? Number(video.originalYear) : uploaded ? new Date(uploaded).getUTCFullYear() : null;
        return { tier, ageYears, year, basis, confidence, isReissue };
    }

    // «Estrena»: recent de debò. Una reedició o un arxiu d'un artista antic pujat ahir NO ho és.
    function isNewRelease(video, { now = Date.now(), isClassicArtist = null, config = null } = {}) {
        const cfg = config || getConfig();
        const era = eraOf(video, { now, isClassicArtist, config: cfg });
        if (era.basis === 'artist-list' || era.basis === 'unknown' || era.isReissue) return false;
        const uploaded = timestampOf(video);
        if (!uploaded || now - uploaded > cfg.era.newReleaseDays * DAY) return false;
        if (era.basis === 'original' && era.ageYears > 1) return false;
        return true;
    }

    // Actualitat 0..1: la música dels darrers 24 mesos puntua alt; la històrica, poc (però no zero).
    function actualityScore(era, cfg) {
        if (era.ageYears === null) return 0.3;
        const recentYears = cfg.era.recentMonths / 12;
        if (era.tier === 'recent') return 1 - 0.3 * clamp(era.ageYears / recentYears);
        if (era.tier === 'mid') {
            return 0.6 - 0.35 * clamp((era.ageYears - recentYears) / (cfg.era.midYears - recentYears));
        }
        return 0.15;
    }

    // ---------- Identitat de gravació i d'obra ----------

    const VERSION_MARKERS = [
        ['live', /\b(live|en directe|en directo|en viu|concert)\b/],
        ['acoustic', /\b(acoustic|acustic|acustica|acustico|unplugged)\b/],
        ['remix', /\b(remix|mix|rework|edit)\b/],
        ['version', /\b(versio|version|cover|reversio)\b/],
        ['demo', /\b(demo|maqueta)\b/],
        ['instrumental', /\b(instrumental|karaoke|karaoke)\b/],
        ['session', /\b(sessio|session|estudi|studio session)\b/],
        ['remaster', /\b(remaster|remasteritzat|remasterizado)\b/],
    ];
    // Etiquetes de format que no canvien la gravació.
    const FORMAT_NOISE =
        /\b(official|oficial|video|videoclip|clip|audio|lyric|lyrics|lletra|letra|visualizer|visualiser|hd|4k|topic|full|nou|nova|new|single|version original)\b/g;

    function foldText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .replace(/[’']/g, "'");
    }

    // Retorna { work, markers, recording } per a un títol i un artista.
    function titleKeys(title, artistKey, durationSeconds) {
        let text = foldText(title);
        // Treu «Artista - » del davant i les parts entre parèntesis/claudàtors, guardant-ne els marcadors.
        const markers = [];
        VERSION_MARKERS.forEach(([name, pattern]) => {
            if (pattern.test(text)) markers.push(name);
        });
        text = text
            .replace(/[([{][^)\]}]*[)\]}]/g, ' ')
            .replace(/[-–—|:]\s*(official|oficial|audio|video|lyric).*$/g, ' ');
        const dash = text.split(/\s[-–—]\s/);
        if (dash.length > 1) text = dash[dash.length - 1];
        text = text
            .replace(FORMAT_NOISE, ' ')
            .replace(/\b(feat|ft|amb|with|con)\b.*$/g, ' ')
            .replace(/[^a-z0-9' ]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        markers.sort();
        const work = `${artistKey}|${text}`;
        return { work, markers, recording: `${work}|${markers.join('+')}`, duration: Number(durationSeconds) || 0 };
    }

    // Duplicats fiables: mateix artista, mateix títol base, mateixos marcadors de versió i durada gairebé igual.
    function isSameRecording(a, b) {
        if (!a || !b || a.recording !== b.recording || !a.work.split('|')[1]) return false;
        if (!a.duration || !b.duration) return false;
        return Math.abs(a.duration - b.duration) <= Math.max(4, Math.round(Math.min(a.duration, b.duration) * 0.03));
    }

    // Gravacions ja triades, agrupades per `recording`: isSameRecording() només pot ser cert entre claus amb el mateix
    // `recording`, i així cada comprovació mira 0–2 claus en lloc de totes les triades (abans, ordenar una categoria de
    // 1.500 cançons feia ~10⁸ comparacions i trigava ~0,8 s a l'ordinador i diversos segons al mòbil).
    function recordingIndex(initial = []) {
        const byRecording = new Map();
        const add = keys => {
            if (!keys) return;
            const list = byRecording.get(keys.recording);
            if (list) list.push(keys);
            else byRecording.set(keys.recording, [keys]);
        };
        toArray(initial).forEach(add);
        const has = keys =>
            Boolean(keys) && (byRecording.get(keys.recording) || []).some(used => isSameRecording(used, keys));
        return { add, has };
    }

    // ---------- Context (es calcula una vegada per feed) ----------

    const NEUTRAL_POPULARITY = 0.4;

    function percentile(sorted, value) {
        if (!sorted.length) return NEUTRAL_POPULARITY;
        let lo = 0;
        let hi = sorted.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (sorted[mid] < value) lo = mid + 1;
            else hi = mid;
        }
        return sorted.length === 1 ? 0.5 : lo / (sorted.length - 1);
    }

    // options: { videos, now, artistKeyOf, isClassicArtist, stylesOf, config }
    function* createContextSteps(options = {}) {
        const cfg = options.config || getConfig();
        const now = options.now ?? Date.now();
        const artistKeyOf = options.artistKeyOf || defaultArtistKey;
        const isClassicArtist = options.isClassicArtist || null;
        const stylesOf = options.stylesOf || (video => toArray(video?.categories).map(lower).filter(Boolean));
        const features = new Map();
        const tierViews = { recent: [], mid: [], historic: [] };
        const channelViews = new Map();

        let processed = 0;
        for (const video of toArray(options.videos)) {
            if (processed && processed % 40 === 0) yield;
            processed += 1;
            const id = idOf(video);
            if (!id || features.has(id)) continue;
            // Només les cançons compten per a les cohorts de popularitat (Shorts, entrevistes... es calculen sota demanda).
            const kind = lower(video.contentType).replace(/-/g, '_');
            if (kind && kind !== 'song' && kind !== 'live_song') continue;
            const era = eraOf(video, { now, isClassicArtist, config: cfg });
            const artist = artistKeyOf(video);
            const views = Number(video.viewCount) || 0;
            const styles = stylesOf(video);
            const uploaded = timestampOf(video);
            // Les claus de gravació (regex sobre el títol) es calculen només per a les candidates que arriben a la selecció.
            let keys = null;
            features.set(id, {
                id,
                artist,
                era,
                tier: era.tier,
                styles,
                primaryStyle: styles[0] || '',
                views,
                logViews: views > 0 ? Math.log10(views + 1) : 0,
                ageDays: uploaded ? Math.max(0, now - uploaded) / DAY : null,
                get keys() {
                    if (!keys) keys = titleKeys(video.title, artist, video.durationSeconds);
                    return keys;
                },
                curated: Boolean(isClassicArtist && isClassicArtist(video)),
                popularity: NEUTRAL_POPULARITY,
            });
            if (views > 0) {
                tierViews[era.tier].push(Math.log10(views + 1));
                if (!channelViews.has(artist)) channelViews.set(artist, []);
                channelViews.get(artist).push(Math.log10(views + 1));
            }
        }
        yield;
        Object.values(tierViews).forEach(list => list.sort((a, b) => a - b));
        channelViews.forEach(list => list.sort((a, b) => a - b));

        // Popularitat normalitzada: percentil logarítmic dins del seu contingent d'antiguitat (i, en part,
        // dins del canal). Sense visualitzacions o amb una novetat de pocs dies no és «poc popular».
        processed = 0;
        for (const f of features.values()) {
            if (processed && processed % 40 === 0) yield;
            processed += 1;
            if (f.views <= 0) {
                f.popularity = NEUTRAL_POPULARITY;
                continue;
            }
            const inTier = percentile(tierViews[f.tier], f.logViews);
            const inChannel =
                channelViews.get(f.artist)?.length > 2 ? percentile(channelViews.get(f.artist), f.logViews) : inTier;
            // Un clàssic popular ho és dins del seu catàleg: per als artistes antics confirmats pesa més el canal.
            const curated = f.tier === 'historic' && f.curated;
            f.popularity = curated ? 0.15 * inTier + 0.85 * inChannel : 0.65 * inTier + 0.35 * inChannel;
            if (f.ageDays !== null && f.ageDays < 30) f.popularity = Math.max(f.popularity, 0.5);
        }
        return { config: cfg, now, features, artistKeyOf, isClassicArtist, stylesOf };
    }

    // Mateix càlcul i ordre per a ràdios síncrones i arrencada cooperativa.
    function createContext(options = {}) {
        const steps = createContextSteps(options);
        let step = steps.next();
        while (!step.done) step = steps.next();
        return step.value;
    }

    async function createContextAsync(options = {}) {
        const steps = createContextSteps(options);
        let step = steps.next();
        while (!step.done) {
            if (window.scheduler?.yield) await window.scheduler.yield();
            else await new Promise(resolve => window.setTimeout(resolve, 0));
            step = steps.next();
        }
        return step.value;
    }

    function featuresOf(ctx, video) {
        const id = idOf(video);
        let f = ctx.features.get(id);
        if (!f) {
            const one = createContext({
                videos: [video],
                now: ctx.now,
                artistKeyOf: ctx.artistKeyOf,
                isClassicArtist: ctx.isClassicArtist,
                stylesOf: ctx.stylesOf,
                config: ctx.config,
            });
            f = one.features.get(id) || {
                id,
                artist: ctx.artistKeyOf(video),
                era: { tier: 'mid', ageYears: null, basis: 'unknown' },
                tier: 'mid',
                styles: [],
                primaryStyle: '',
                views: 0,
                logViews: 0,
                ageDays: null,
                keys: titleKeys(video?.title, ctx.artistKeyOf(video), video?.durationSeconds),
                curated: false,
                popularity: NEUTRAL_POPULARITY,
            };
            ctx.features.set(id, f);
        }
        return f;
    }

    // ---------- Senyals de l'usuari ----------

    function emptySignals() {
        return {
            songs: {},
            artists: {},
            liked: new Set(),
            likedArtists: {},
            followed: new Set(),
            lessLike: new Set(),
            moreLike: new Set(),
            blockedArtists: new Set(),
            recent: [],
            sessionStyles: {},
            styles: {},
        };
    }

    // (sense instanceof: el Set pot venir d'un altre context d'execució, com en les proves)
    const asSet = value =>
        value && typeof value.has === 'function' && typeof value.forEach === 'function'
            ? value
            : new Set(toArray(value));

    function normalizeSignals(input) {
        const base = emptySignals();
        const s = input && typeof input === 'object' ? input : {};
        return {
            songs: s.songs || base.songs,
            artists: s.artists || base.artists,
            liked: asSet(s.liked),
            likedArtists: s.likedArtists || base.likedArtists,
            followed: asSet(s.followed),
            lessLike: asSet(s.lessLike),
            moreLike: asSet(s.moreLike),
            blockedArtists: asSet(s.blockedArtists),
            recent: toArray(s.recent),
            sessionStyles: s.sessionStyles || base.sessionStyles,
            styles: s.styles || base.styles,
        };
    }

    const decay = (now, at, halfLifeDays) => (at ? Math.pow(0.5, Math.max(0, now - at) / (halfLifeDays * DAY)) : 1);

    // Senyal de gust per a una cançó concreta (0..1). Cors i escoltes voluntàries pesen més que les automàtiques.
    function songTaste(id, signals, now, cfg) {
        const entry = signals.songs[id];
        let value = 0;
        if (entry) {
            const raw =
                0.25 * sat(entry.q || 0, cfg.taste.savedSongCount) +
                0.25 * sat(entry.f || 0, cfg.taste.savedSongCount) +
                0.5 * sat(entry.r || 0, cfg.taste.savedSongCount - 1);
            value = raw * decay(now, entry.l, cfg.taste.halfLifeDays);
        }
        if (signals.liked.has(id)) value = Math.min(1, value + cfg.taste.likedBonus);
        if (signals.moreLike?.has(id)) value = Math.min(1, value + cfg.taste.moreLikeBonus);
        return value;
    }

    // Senyal per a l'artista: seguir-lo, escoltar-lo i els cors a altres cançons seves (reforç menor).
    function artistTaste(artist, signals, now, cfg) {
        if (!artist) return 0;
        const entry = signals.artists[artist];
        let value = signals.followed.has(artist) ? cfg.taste.followedArtist : 0;
        if (entry) {
            const listened =
                0.5 * sat(entry.q || 0, cfg.taste.artistCount) +
                0.3 * sat(entry.f || 0, cfg.taste.artistCount) +
                0.2 * sat(entry.r || 0, cfg.taste.artistCount / 2);
            value += 0.4 * listened * decay(now, entry.l, cfg.taste.halfLifeDays);
            // Una visita antiga migrada (sense durada ni nombre d'escoltes) és informació feble.
            if (!entry.q && entry.h) value += 0.04;
        }
        const hearts = signals.likedArtists[artist] || 0;
        if (hearts) value += 0.15 * sat(hearts, 3);
        const more = entry?.ml || 0;
        if (more) value += cfg.taste.moreLikeArtist * sat(more, 3);
        return clamp(value);
    }

    // Penalització temporal per salts manuals ràpids i reiterats.
    function skipPenalty(entry, threshold, now, cfg) {
        if (!entry || !entry.s) return 0;
        const effective = entry.s * decay(now, entry.sl, cfg.taste.skipHalfLifeDays);
        if (effective < threshold - 0.5) return 0;
        return clamp(0.15 * effective, 0, 0.5);
    }

    function styleAffinityOf(f, signals) {
        let points = 0;
        f.styles.forEach(style => {
            points += signals.styles[style] || 0;
        });
        return points / (points + 6);
    }

    function isKnownArtist(artist, signals) {
        if (!artist) return false;
        const entry = signals.artists[artist];
        return (
            signals.followed.has(artist) ||
            Boolean(signals.likedArtists[artist]) ||
            Boolean(entry && (entry.q || entry.h || entry.f))
        );
    }

    function knownArtistCount(signals) {
        const keys = new Set([
            ...Object.keys(signals.artists),
            ...signals.followed,
            ...Object.keys(signals.likedArtists),
        ]);
        let count = 0;
        keys.forEach(key => {
            if (isKnownArtist(key, signals)) count += 1;
        });
        return count;
    }

    // Preferència per música antiga a partir de senyals FORTS. Un sol clic no la canvia (a priori 10 %).
    function eraPreference(ctx, signals, options = {}) {
        const cfg = ctx.config;
        const sig = normalizeSignals(signals);
        const weights = { recent: 0, mid: 0, historic: 0 };
        const add = (tier, points) => {
            weights[tier] = (weights[tier] || 0) + points;
        };
        const tierOfSong = id => ctx.features.get(id)?.tier;
        sig.liked.forEach(id => {
            const tier = tierOfSong(id);
            if (tier) add(tier, 3);
        });
        sig.moreLike.forEach(id => {
            const tier = tierOfSong(id);
            if (tier) add(tier, 2);
        });
        Object.keys(sig.songs).forEach(id => {
            const tier = tierOfSong(id);
            const entry = sig.songs[id];
            if (!tier) return;
            add(tier, 2 * (entry.r || 0) + 0.5 * (entry.q || 0));
        });
        // Artistes seguits: es pesen segons la seva obra al catàleg (aproximada pels vídeos carregats).
        const byArtist = new Map();
        ctx.features.forEach(f => {
            if (!sig.followed.has(f.artist)) return;
            const entry = byArtist.get(f.artist) || { recent: 0, mid: 0, historic: 0, total: 0 };
            entry[f.tier] += 1;
            entry.total += 1;
            byArtist.set(f.artist, entry);
        });
        byArtist.forEach(entry => {
            ['recent', 'mid', 'historic'].forEach(tier => add(tier, (3 * entry[tier]) / entry.total));
        });
        const total = weights.recent + weights.mid + weights.historic;
        const base = cfg.era.target.historic;
        let historic = base;
        let strong = false;
        if (total >= cfg.preference.minWeight) {
            historic = clamp(
                (weights.historic + base * cfg.preference.priorWeight) / (total + cfg.preference.priorWeight),
                base,
                cfg.preference.maxHistoricShare
            );
            // «Forta»: hi ha prou senyals i, a més, apunten de debò cap a música antiga.
            strong = historic > base + 0.02;
        }
        const top = cfg.general.top;
        const maxHistoricTop = Math.max(cfg.general.maxHistoricTop, Math.round(top * historic));
        return {
            historic,
            strong,
            weights,
            maxHistoricTop,
            allowConsecutive: historic > 0.35,
            override: options.policy === 'historic',
        };
    }

    // ---------- Puntuació ----------

    // Retorna un objecte amb la puntuació base (0..1 aprox.) i les parts.
    function scoreOne(video, ctx, signals, seed, options = {}) {
        const cfg = ctx.config;
        const now = ctx.now;
        const f = featuresOf(ctx, video);
        const id = f.id;
        const w = cfg.weights;

        const taste = clamp(
            0.45 * songTaste(id, signals, now, cfg) +
                0.4 * artistTaste(f.artist, signals, now, cfg) +
                0.15 * styleAffinityOf(f, signals)
        );
        const actuality = actualityScore(f.era, cfg);
        const popularity = f.popularity;

        const heard = signals.songs[id];
        const lastAt = heard?.l || 0;
        const days = lastAt ? (now - lastAt) / DAY : Infinity;
        // Rotació: una cançó reposada torna; no reposada, cau. Sense escoltar és mitjanament alta.
        let rotation = lastAt ? 1 - Math.exp(-days / 7) : 0.8;
        const artistLast = signals.artists[f.artist]?.l || 0;
        if (artistLast && now - artistLast < DAY) rotation *= 0.7;

        // Afinitat amb la cançó inicial i amb el que s'ha escoltat en aquesta sessió.
        let affinity = 0;
        const seedF = seed ? featuresOf(ctx, seed) : null;
        if (seedF && seedF.styles.length && f.styles.length) {
            const overlap = f.styles.filter(style => seedF.styles.includes(style)).length;
            affinity += 0.6 * (overlap / Math.max(seedF.styles.length, f.styles.length));
        }
        let session = 0;
        f.styles.forEach(style => {
            session += signals.sessionStyles[style] || 0;
        });
        affinity += 0.4 * (session / (session + 2));
        affinity = clamp(affinity);

        let score =
            w.taste * taste +
            w.actuality * actuality +
            w.popularity * popularity +
            w.rotation * rotation +
            w.affinity * affinity;

        if (f.tier === 'historic' && f.curated) score += cfg.era.curatedBonus;

        // Penalitzacions: salts manuals recents (cançó i artista) i «menys com aquesta».
        let penalty = skipPenalty(heard, cfg.taste.skipsToPenalize, now, cfg);
        penalty += skipPenalty(signals.artists[f.artist], cfg.taste.artistSkipsToPenalize, now, cfg) * 0.6;
        if (lastAt && now - lastAt < DAY) penalty += 0.08 * (1 - (now - lastAt) / DAY);
        score -= penalty;

        // Més varietat entre les peces antigues: totes les de la llista d'antics han de poder sortir de tant en tant.
        const spread = f.tier === 'historic' ? cfg.noise * cfg.historicNoiseFactor : cfg.noise;
        const noise = options.rng ? (options.rng() - 0.5) * spread * 2 : 0;
        return { score: score + noise, parts: { taste, actuality, popularity, rotation, affinity, penalty }, f };
    }

    function familiarityClass(f, signals) {
        // Una visita antiga a l'historial (informació feble) no fa «coneguda» una cançó: cal cor o escoltes reals.
        if (
            isKnownArtist(f.artist, signals) ||
            signals.songs[f.id]?.q ||
            signals.liked.has(f.id) ||
            signals.moreLike.has(f.id)
        ) {
            return 'known';
        }
        return styleAffinityOf(f, signals) > 0.15 ? 'affine' : 'surprise';
    }

    // ---------- Selecció sota restriccions ----------

    const LEVELS = [
        { gap: 3, perArtist: 0, hist: 0, work: true, consecutive: false, cool: 1 },
        { gap: 2, perArtist: 1, hist: 1, work: true, consecutive: false, cool: 1 },
        { gap: 1, perArtist: 2, hist: 2, work: false, consecutive: false, cool: 0.5 },
        { gap: 1, perArtist: 99, hist: 3, work: false, consecutive: true, cool: 0 },
        // Últim recurs (categoria amb un sol artista o molt pocs): es permeten cançons seguides del mateix artista.
        { gap: 0, perArtist: 99, hist: 99, work: false, consecutive: true, cool: 0 },
    ];

    // «Fora del meu radar»: un artista és nou si l'usuari no hi ha deixat cap rastre (ni escoltes, ni historial feble, ni cor,
    // ni «+/−», ni salts, ni seguit). Un artista que només ha saltat també queda fora: ja l'ha vist i no l'ha volgut.
    function isNewArtist(artist, signals) {
        if (!artist || isKnownArtist(artist, signals)) return false;
        const entry = signals.artists[artist];
        return !entry || Object.keys(entry).length === 0;
    }

    // Conjunt de treball de la ràdio de descoberta. Per ordre: (1) una cançó per cada artista nou (com més grups
    // diferents, millor); (2) la resta de cançons d'artistes nous; (3) només si no n'hi ha prou, artistes poc coneguts
    // (ni seguits, ni amb cor, ni amb cançons escoltades). Cada nivell més avall puntua menys, de manera que només hi
    // entren quan fa falta. Retorna { items, relaxed }.
    function discoveryPool(items, signals, count, cfg) {
        const d = cfg.discovery;
        const first = [];
        const second = [];
        const seen = new Set();
        items.forEach(item => {
            if (!isNewArtist(item.f.artist, signals)) return;
            if (signals.songs[item.f.id] || signals.liked.has(item.f.id)) return;
            if (seen.has(item.f.artist)) second.push(item);
            else {
                seen.add(item.f.artist);
                first.push(item);
            }
        });
        // Els èxits ja són coneguts: es resta part del pes de la popularitat perquè surtin també grups petits.
        const damp = item => {
            item.base -= d.popularityDamping * cfg.weights.popularity * (item.f.popularity || 0);
        };
        first.forEach(damp);
        second.forEach(item => {
            damp(item);
            item.base -= d.secondSongPenalty;
        });
        let pool = first;
        if (first.length < Math.min(count, d.minArtists) || first.length + second.length < count) {
            pool = [...first, ...second];
        }
        let relaxed = false;
        if (pool.length < count) {
            const used = new Set(pool);
            const weak = items.filter(item => {
                if (used.has(item) || !item.f.artist || signals.followed.has(item.f.artist)) return false;
                if (signals.likedArtists[item.f.artist]) return false;
                return (
                    !signals.songs[item.f.id]?.q && !signals.liked.has(item.f.id) && !signals.moreLike.has(item.f.id)
                );
            });
            weak.forEach(item => {
                damp(item);
                item.base -= d.weakKnownPenalty;
            });
            if (weak.length) relaxed = true;
            pool = [...pool, ...weak];
        }
        return { items: pool.sort((a, b) => b.base - a.base), relaxed };
    }

    // Bucle comú: tria `count` elements de `items` (cadascun amb {video, f, base, fam}) respectant els límits.
    // Retorna { picked, level } o, amb `keepAll`, afegeix la resta en el seu ordre quan res no encaixa.
    function runSelection(items, options) {
        const {
            cfg,
            count,
            preceding = [],
            eraTargets = null,
            famTargets = null,
            maxHistoric,
            allowConsecutive = false,
            recentIds = [],
            recentTimes = new Map(),
            now,
            keepAll = false,
            useCooldown = true,
            lookahead = Infinity,
            mix = null,
        } = options;
        const top = cfg.general.top;
        const sequence = preceding.map(video => ({
            id: idOf(video),
            video,
            artist: featuresOf(options.ctx, video).artist,
            tier: featuresOf(options.ctx, video).tier,
            style: featuresOf(options.ctx, video).primaryStyle,
            fam: 'known',
        }));
        const usedIds = new Set(sequence.map(item => item.id));
        const usedRecordings = preceding.map(video => featuresOf(options.ctx, video).keys);
        const usedWork = new Set(usedRecordings.map(keys => keys.work));
        const usedIndex = recordingIndex(usedRecordings);
        const eraCount = { recent: 0, mid: 0, historic: 0 };
        const famCount = { known: 0, affine: 0, surprise: 0 };
        sequence.forEach(item => {
            eraCount[item.tier] += 1;
        });
        // Ràdio amb diversos estils: es reparteixen a parts iguals (el que ja hi ha a la cua també compta).
        const mixCount = {};
        let mixTotal = 0;
        const mixTarget = mix ? 1 / mix.labels.length : 0;
        if (mix) {
            mix.labels.forEach(label => {
                mixCount[label] = 0;
            });
            preceding.forEach(video => {
                const tags = mix.tagOf(video);
                if (!tags.length) return;
                const tag = tags.reduce((best, t) => (mixCount[t] < mixCount[best] ? t : best), tags[0]);
                mixCount[tag] += 1;
                mixTotal += 1;
            });
        }
        const mixDeficit = c =>
            c.tags && c.tags.length ? Math.max(...c.tags.map(tag => mixTarget - mixCount[tag] / (mixTotal || 1))) : 0;
        const remaining = items.slice();
        const picked = [];
        let maxLevel = 0;

        const windowOf = () => sequence.slice(-top);
        const recentSet = level => new Set(recentIds.slice(0, Math.round(cfg.cooldown.songs * (level.cool || 0))));
        // «Artista primer»: les candidates s'agrupen per artista una sola vegada (ordenades pel nom i, dins de cada
        // artista, en l'ordre de `items`). Abans es tornaven a agrupar i ordenar a cada cançó triada: ~3.500
        // candidates × 40 cançons, i entrar a una ràdio trigava mig segon a l'ordinador i segons al mòbil.
        // Les triades surten de `remaining` i el seu id és a `usedIds`, així que el filtre les descarta igual.
        const staticGroups =
            options.artistFirst && !keepAll && lookahead === Infinity
                ? (() => {
                      const byKey = new Map();
                      // El descans (cançons i minuts) no canvia durant la tria: es calcula una vegada per nivell.
                      const coolSets = LEVELS.map(recentSet);
                      for (const c of items) {
                          const key = c.f.artist || c.f.id;
                          // version: canvia quan alguna cançó del grup queda descartada; cache: el grup de l'última tria
                          if (!byKey.has(key)) byKey.set(key, { key, artist: c.f.artist, members: [], version: 0, cache: null });
                          const sg = byKey.get(key);
                          const at = recentTimes.get(c.f.id) || 0;
                          sg.members.push({
                              sg,
                              item: c,
                              index: -1,
                              historic: c.f.tier === 'historic',
                              // Ja triada o la mateixa gravació (dead) / la mateixa obra (deadWork): es marca en triar.
                              dead: false,
                              deadWork: false,
                              cooled: LEVELS.map(
                                  (level, li) =>
                                      useCooldown &&
                                      (coolSets[li].has(c.f.id) ||
                                          (level.cool > 0 && at && now - at < cfg.cooldown.minutes * 60000 * level.cool))
                              ),
                          });
                      }
                      return [...byKey.values()].sort((a, b) => compareKeys(a.key, b.key));
                  })()
                : null;
        const markUsed = (() => {
            if (!staticGroups) return () => {};
            const byId = new Map();
            const byWork = new Map();
            const byRecording = new Map();
            const index = (map, key, member) => {
                if (!map.has(key)) map.set(key, []);
                map.get(key).push(member);
            };
            for (const sg of staticGroups) {
                for (const member of sg.members) {
                    const f = member.item.f;
                    index(byId, f.id, member);
                    index(byWork, f.keys.work, member);
                    if (f.keys) index(byRecording, f.keys.recording, member);
                }
            }
            // Mateixes regles que usedIds / usedWork / usedIndex.has()
            const kill = (member, field) => {
                if (member[field]) return;
                member[field] = true;
                member.sg.version += 1;
            };
            return (id, keys) => {
                (byId.get(id) || []).forEach(member => kill(member, 'dead'));
                if (!keys) return;
                (byWork.get(keys.work) || []).forEach(member => kill(member, 'deadWork'));
                (byRecording.get(keys.recording) || []).forEach(member => {
                    if (isSameRecording(keys, member.item.f.keys)) kill(member, 'dead');
                });
            };
        })();
        sequence.forEach(item => markUsed(item.id, featuresOf(options.ctx, item.video).keys));

        while (picked.length < count && remaining.length) {
            const win = windowOf();
            const windowArtists = new Map();
            win.forEach(item => windowArtists.set(item.artist, (windowArtists.get(item.artist) || 0) + 1));
            const histInWindow = win.filter(item => item.tier === 'historic').length;
            const last = sequence[sequence.length - 1];
            const total = sequence.length || 1;
            let chosen = -1;
            let chosenLevel = 0;
            for (let li = 0; li < LEVELS.length && chosen < 0; li++) {
                const level = LEVELS[li];
                const gap = level.gap;
                const perArtist = cfg.general.maxPerArtistTop + level.perArtist;
                const histMax = maxHistoric + level.hist;
                const cool = recentSet(level);
                const lastArtists = gap > 0 ? sequence.slice(-gap).map(item => item.artist) : [];
                let bestScore = -Infinity;
                const artistGroups = new Map();
                // Si una candidata pot sonar ara (límits d'artista, antigues, obra/gravació repetida i descans).
                const allowed = c => {
                    if (usedIds.has(c.f.id)) return false;
                    if (c.f.artist && lastArtists.includes(c.f.artist)) return false;
                    if (c.f.artist && (windowArtists.get(c.f.artist) || 0) >= perArtist) return false;
                    if (c.f.tier === 'historic') {
                        if (histInWindow >= histMax) return false;
                        if (!allowConsecutive && !level.consecutive && last?.tier === 'historic') return false;
                    }
                    if (level.work && usedWork.has(c.f.keys.work)) return false;
                    if (usedIndex.has(c.f.keys)) return false;
                    if (useCooldown) {
                        if (cool.has(c.f.id)) return false;
                        const at = recentTimes.get(c.f.id) || 0;
                        if (level.cool > 0 && at && now - at < cfg.cooldown.minutes * 60000 * level.cool) return false;
                    }
                    return true;
                };
                if (staticGroups) {
                    const historicAllowed =
                        histInWindow < histMax && (allowConsecutive || level.consecutive || last?.tier !== 'historic');
                    for (const sg of staticGroups) {
                        if (sg.artist && (lastArtists.includes(sg.artist) || (windowArtists.get(sg.artist) || 0) >= perArtist)) {
                            continue;
                        }
                        // Si res del grup no ha canviat des de l'última tria, es reutilitza (no es modifica després).
                        const cached = sg.cache;
                        if (cached && cached.li === li && cached.hist === historicAllowed && cached.version === sg.version) {
                            if (cached.group) artistGroups.set(sg.key, cached.group);
                            continue;
                        }
                        let group = null;
                        for (const member of sg.members) {
                            if (member.dead || (level.work && member.deadWork) || member.cooled[li]) continue;
                            if (member.historic && !historicAllowed) continue;
                            const c = member.item;
                            if (!group) group = { key: sg.key, candidates: [], eras: [], familiarities: [], tags: [] };
                            group.candidates.push(member);
                            addOnce(group.eras, c.f.tier);
                            addOnce(group.familiarities, c.fam);
                            if (c.tags) c.tags.forEach(tag => addOnce(group.tags, tag));
                        }
                        sg.cache = { li, hist: historicAllowed, version: sg.version, group };
                        if (group) artistGroups.set(sg.key, group);
                    }
                }
                const limit = staticGroups ? 0 : Math.min(remaining.length, lookahead);
                for (let i = 0; i < limit; i++) {
                    const c = remaining[i];
                    if (!allowed(c)) continue;
                    // En reordenacions de llistes mana l'ordre original: `remaining` conserva l'ordre i `base` hi
                    // decreix, així que la primera candidata que encaixa és la triada (no cal puntuar la resta).
                    if (keepAll) {
                        chosen = i;
                        chosenLevel = li;
                        break;
                    }
                    if (options.artistFirst) {
                        const key = c.f.artist || c.f.id;
                        if (!artistGroups.has(key)) {artistGroups.set(key, {
                            key, candidates: [], eras: [], familiarities: [], tags: [],
                        });}
                        const group = artistGroups.get(key);
                        group.candidates.push({ item: c, index: i });
                        addOnce(group.eras, c.f.tier);
                        addOnce(group.familiarities, c.fam);
                        if (c.tags) c.tags.forEach(tag => addOnce(group.tags, tag));
                        continue;
                    }
                    let s = c.base;
                    if (options.flow) s += options.flow.transition(c.video, last?.video, options.seed);
                    if (eraTargets) {
                        s += cfg.gain.era * (eraTargets[c.f.tier] - eraCount[c.f.tier] / total);
                    }
                    if (famTargets) {
                        const used = famCount.known + famCount.affine + famCount.surprise || 1;
                        // El repartiment coneguda/descoberta orienta però no domina la puntuació (marge acotat).
                        s += cfg.gain.familiarity * clamp(famTargets[c.fam] - famCount[c.fam] / used, -0.25, 0.25);
                    }
                    if (mix) s += cfg.gain.style * clamp(mixDeficit(c), -0.4, 0.4);
                    if (c.f.artist) s -= 0.05 * (windowArtists.get(c.f.artist) || 0);
                    if (
                        c.f.primaryStyle &&
                        sequence.slice(-3).filter(item => item.style === c.f.primaryStyle).length >= 3
                    ) {
                        s -= 0.05;
                    }
                    if (s > bestScore) {
                        bestScore = s;
                        chosen = i;
                        chosenLevel = li;
                    }
                }
                if (options.artistFirst && artistGroups.size) {
                    const groups = staticGroups
                        ? [...artistGroups.values()]
                        : [...artistGroups.values()].sort((a, b) => compareKeys(a.key, b.key));
                    let bestTier = Infinity;
                    groups.forEach(group => {
                        // El perfil és del grup; el nombre de cançons no dona cap bitllet addicional.
                        const representative = group.candidates.find(c => options.flow?.profileOf(c.item.video))
                            || group.candidates[0];
                        group.video = representative.item.video;
                        group.f = representative.item.f;
                        group.tier = options.subcategoryFlow?.tier(group.video, last?.video) ?? 0;
                        if (options.discover) {
                            const fresh = isNewArtist(group.key, options.signals);
                            const heardHere = sequence.some(item => item.artist === group.key);
                            // Descoberta pura: primer artistes nous diferents, després repeticions,
                            // i només al final els poc coneguts que completen una cua escassa.
                            group.tier += (fresh ? heardHere ? 1 : 0 : 2) * 3;
                        }
                        bestTier = Math.min(bestTier, group.tier);
                    });
                    let winner = null;
                    const leastPlayed = Math.min(...groups.filter(g => g.tier === bestTier)
                        .map(g => windowArtists.get(g.key) || 0));
                    for (const group of groups) {
                        if (group.tier !== bestTier) continue;
                        if (li > 0 && (windowArtists.get(group.key) || 0) > leastPlayed) continue;
                        let score = cfg.weights.taste * (options.artistPreferences.get(group.key) || 0);
                        score -= 0.6 * skipPenalty(options.signals.artists[group.key], cfg.taste.artistSkipsToPenalize, now, cfg);
                        if (options.flow) score += options.flow.transition(group.video, last?.video, options.seed);
                        if (eraTargets) {score += cfg.gain.era * group.eras.reduce((sum, tier) =>
                            sum + eraTargets[tier] - eraCount[tier] / total, 0) / group.eras.length;}
                        if (famTargets) {
                            const used = famCount.known + famCount.affine + famCount.surprise || 1;
                            score += cfg.gain.familiarity * group.familiarities.reduce((sum, fam) =>
                                sum + clamp(famTargets[fam] - famCount[fam] / used, -0.25, 0.25), 0)
                                / group.familiarities.length;
                        }
                        if (mix) score += cfg.gain.style * clamp(mixDeficit({ tags: group.tags }), -0.4, 0.4);
                        score -= 0.15 * (windowArtists.get(group.key) || 0);
                        // Sorteig ponderat amb UNA oportunitat per artista. Cap suma/màxim de pistes.
                        const weight = Math.exp(clamp(score / 0.2, -20, 20));
                        const race = -Math.log(Math.max(1e-12, Math.min(1 - 1e-12, options.rng()))) / weight;
                        if (!winner || race < winner.race) winner = { group, race };
                    }
                    // Només després de triar l'artista es valoren les cançons (gust, actualitat, popularitat...).
                    let songScore = -Infinity;
                    for (const c of winner.group.candidates) {
                        let score = c.item.base;
                        if (eraTargets) score += cfg.gain.era * (eraTargets[c.item.f.tier] - eraCount[c.item.f.tier] / total);
                        if (score > songScore) {
                            songScore = score;
                            chosen = c.index >= 0 ? c.index : remaining.indexOf(c.item);
                        }
                    }
                    chosenLevel = li;
                }
            }
            if (chosen < 0) break;
            const [c] = remaining.splice(chosen, 1);
            maxLevel = Math.max(maxLevel, chosenLevel);
            picked.push(c);
            usedIds.add(c.f.id);
            usedWork.add(c.f.keys.work);
            usedRecordings.push(c.f.keys);
            usedIndex.add(c.f.keys);
            markUsed(c.f.id, c.f.keys);
            sequence.push({ video: c.video, id: c.f.id, artist: c.f.artist, tier: c.f.tier, style: c.f.primaryStyle, fam: c.fam });
            eraCount[c.f.tier] += 1;
            famCount[c.fam] += 1;
            if (mix && c.tags && c.tags.length) {
                const tag = c.tags.reduce(
                    (best, t) => (mixCount[t] / (mixTotal || 1) < mixCount[best] / (mixTotal || 1) ? t : best),
                    c.tags[0]
                );
                mixCount[tag] += 1;
                mixTotal += 1;
            }
        }
        return { picked, level: maxLevel, leftover: remaining, mixCount };
    }
    function shares(picked) {
        const count = { recent: 0, mid: 0, historic: 0 };
        picked.forEach(c => {
            count[c.f.tier] += 1;
        });
        const total = picked.length || 1;
        return {
            counts: count,
            shares: { recent: count.recent / total, mid: count.mid / total, historic: count.historic / total },
        };
    }

    function buildItems(candidates, ctx, signals, seed, rng) {
        const blocked = signals.blockedArtists;
        const items = [];
        candidates.forEach(video => {
            const id = idOf(video);
            if (!id) return;
            const f = featuresOf(ctx, video);
            if (signals.lessLike.has(id) || (f.artist && blocked.has(f.artist))) return;
            const scored = scoreOne(video, ctx, signals, seed, { rng });
            items.push({ video, f, base: scored.score, parts: scored.parts, fam: familiarityClass(f, signals) });
        });
        // Dins d'un artista, una altra cançó adequada que encara no has escoltat va abans de repetir sempre
        // el mateix èxit (no afecta les preferides amb cor ni les repetides voluntàriament).
        const bestFresh = new Map();
        items.forEach(item => {
            const entry = signals.songs[item.f.id];
            if (!signals.liked.has(item.f.id) && !(entry && entry.q)) {
                bestFresh.set(item.f.artist, Math.max(bestFresh.get(item.f.artist) ?? -Infinity, item.base));
            }
        });
        items.forEach(item => {
            const entry = signals.songs[item.f.id];
            const heard = entry && entry.q;
            if (!heard || signals.liked.has(item.f.id) || entry.r > 0) return;
            const alternative = bestFresh.get(item.f.artist);
            if (alternative !== undefined && alternative >= item.base - 0.15) item.base -= 0.08;
        });
        items.sort((a, b) => b.base - a.base);
        return items;
    }

    // Retalla el conjunt de treball però manté representació de cada antiguitat i familiaritat.
    function trimPool(items, size) {
        if (items.length <= size) return items;
        const keep = new Set(items.slice(0, size));
        const perGroup = Math.max(20, Math.floor(size / 6));
        ['tier', 'fam', 'tag'].forEach(key => {
            const groups = new Map();
            items.forEach(item => {
                // Amb estils barrejats cada estil ha de tenir candidates al conjunt de treball.
                const names = key === 'tag' ? item.tags || [] : [key === 'tier' ? item.f.tier : item.fam];
                names.forEach(name => {
                    if (!groups.has(name)) groups.set(name, []);
                    if (groups.get(name).length < perGroup) groups.get(name).push(item);
                });
            });
            groups.forEach(list => list.forEach(item => keep.add(item)));
        });
        return items.filter(item => keep.has(item));
    }

    // Mateix pressupost de pistes per artista, amb representació d'antiguitat/familiaritat.
    // Si les restriccions esgoten aquesta mostra, selectRadio reintenta amb tot el catàleg.
    function trimArtistPool(items, count) {
        const artists = new Map();
        for (const item of items) {
            const key = item.f.artist || item.f.id;
            if (!artists.has(key)) artists.set(key, []);
            artists.get(key).push(item);
        }
        const limit = Math.max(6, Math.ceil(count / Math.max(1, artists.size)) * 2);
        const keep = new Set();
        for (const list of artists.values()) {
            const works = new Set();
            const cells = new Map();
            for (const item of list) {
                if (works.size < limit && !works.has(item.f.keys.work)) {
                    keep.add(item); works.add(item.f.keys.work);
                }
                const cell = item.f.tier + ':' + item.fam + ':' + (item.tags || []).join('|');
                const n = cells.get(cell) || 0;
                if (n < 2) { keep.add(item); cells.set(cell, n + 1); }
            }
        }
        return items.filter(item => keep.has(item));
    }

    function recentTimesFrom(signals) {
        const map = new Map();
        signals.recent.forEach(entry => {
            if (entry?.id && !map.has(String(entry.id))) map.set(String(entry.id), Number(entry.at) || 0);
        });
        Object.keys(signals.songs).forEach(id => {
            const at = signals.songs[id]?.l;
            if (at && !(map.get(id) >= at)) map.set(id, at);
        });
        return map;
    }

    const NOTE_LITTLE_RECENT =
        'Aquesta selecció té poca música dels darrers anys: hi hem afegit peces més antigues del catàleg.';
    const NOTE_VARIETY = 'Encara tenim poc historial per afinar-ho: et proposem una selecció variada.';
    const NOTE_NONE = 'Encara no tens historial d’escolta: et proposem una selecció variada.';
    const NOTE_NEW_FEW =
        'Ja coneixes gairebé tots els artistes d’aquesta selecció: hem completat la ràdio amb artistes que has escoltat poc.';
    const discoveryNote = n =>
        n === 1
            ? 'Ràdio de descoberta: 1 artista que encara no has escoltat.'
            : `Ràdio de descoberta: ${n} artistes que encara no has escoltat.`;

    // Ràdio personal: sorteig ponderat amb places 60/40 i memòria entre arrencades.
    // Les restriccions només s'afluixen quan no queda cap candidata compatible.
    function selectPersonalRadio(options, signals) {
        const { ctx } = options;
        const rng = options.rng || Math.random;
        const count = Math.max(1, options.count || ctx.config.queue.max - 1);
        const preceding = toArray(options.preceding).length ? options.preceding : options.seed ? [options.seed] : [];
        const known = item => signals.liked.has(item.f.id) || signals.moreLike.has(item.f.id) || isKnownArtist(item.f.artist, signals);
        const previous = new Set(toArray(options.previousIds).map(String));
        const recent = new Set(toArray(signals.recent).slice(0, 20).map(entry => String(entry.id)));
        const starts = new Set(toArray(options.avoidStarts).slice(0, 5).map(String));
        const sequence = preceding.map(video => ({ video, f: featuresOf(ctx, video) }));
        const used = new Set(sequence.map(item => item.f.id));
        const recordings = recordingIndex(sequence.map(item => item.f.keys));
        const remaining = buildItems(toArray(options.candidates), ctx, signals, options.seed, null);
        const maxOld = Math.floor((count + preceding.length) * 0.3);
        let oldCount = sequence.filter(item => previous.has(item.f.id)).length;
        let knownCount = sequence.filter(known).length;
        let extraTurn = 0;
        let relaxedLevel = 0;
        const picked = [];
        const extras = toArray(options.extraCategories);
        const tags = item => options.extraTags?.(item.video) || [];
        while (picked.length < count) {
            let pool = [];
            let level = 0;
            for (; level < 6 && !pool.length; level++) {
                const gap = level < 2 ? 4 : level < 4 ? 1 : 0;
                const lastArtists = new Set(sequence.slice(-gap || sequence.length).map(item => item.f.artist));
                pool = remaining.filter(item => !used.has(item.f.id) && !recordings.has(item.f.keys)
                    && (!gap || !lastArtists.has(item.f.artist))
                    && (level >= 3 || !previous.has(item.f.id) || oldCount < maxOld)
                    && (level >= 4 || !recent.has(item.f.id))
                    && (level >= 5 || !starts.has(item.f.id)));
                if (pool.length) relaxedLevel = Math.max(relaxedLevel, level);
            }
            if (!pool.length) break;
            // Distribució acumulada: 3 conegudes i 2 d'altres grups per cada cinc.
            const wantKnown = options.firstPersonal || knownCount < Math.round((sequence.length + 1) * 0.6);
            const lane = pool.filter(item => known(item) === Boolean(wantKnown));
            if (lane.length) pool = lane;
            // Les categories explícites tenen places dins del 40 %, sense una postbarreja que trenqui el descans.
            if (!wantKnown && extras.length) {
                const label = extras[extraTurn % extras.length];
                const categoryPool = pool.filter(item => tags(item).includes(label));
                if (categoryPool.length) pool = categoryPool;
                extraTurn += 1;
            }
            // Cursa exponencial: més vistes i més gust donen més probabilitat, mai una ordenació fixa.
            let winner = null, best = Infinity;
            for (const item of pool) {
                const taste = Math.max(songTaste(item.f.id, signals, ctx.now, ctx.config),
                    artistTaste(item.f.artist, signals, ctx.now, ctx.config));
                const views = Math.max(0, Number(item.video.viewCount) || 0);
                const weight = Math.pow(1 + Math.log1p(views), 2) * (1 + 3 * taste)
                    / (1 + 4 * item.parts.penalty);
                const key = -Math.log(Math.max(1e-9, Math.min(1 - 1e-9, rng()))) / weight;
                if (key < best) { best = key; winner = item; }
            }
            if (!winner) break;
            picked.push(winner); sequence.push(winner); used.add(winner.f.id); recordings.add(winner.f.keys);
            if (known(winner)) knownCount += 1;
            if (previous.has(winner.f.id)) oldCount += 1;
        }
        return { queue: picked.map(item => item.video), meta: {
            mode: 'mix', requested: 'mix', personal: true, note: '', relaxedLevel,
            era: shares(picked), fam: { known: picked.filter(known).length, affine: picked.filter(item => !known(item)).length, surprise: 0 },
            renewal: { previous: oldCount, limit: maxOld },
        } };
    }

    // Ràdio: retorna la part automàtica de la cua (sense la cançó inicial).
    // options: { ctx, candidates, seed, signals, mode, policy, count, preceding, now, rng, category }
    function selectRadio(options = {}) {
        const ctx = options.ctx;
        const cfg = ctx.config;
        const rng = options.rng || Math.random;
        const signals = normalizeSignals(options.signals);
        const requestedMode = options.mode && cfg.familiarity[options.mode] ? options.mode : 'mix';
        const policy = options.policy || 'general';
        if (policy === 'personal') return selectPersonalRadio(options, signals);
        // «Fora del meu radar» només té sentit en una ràdio general o d'estil. En una cerca, o en la ràdio d'un artista, el
        // conjunt el tria l'usuari: allà el mode s'aplica com a «Sorprèn-me» i no s'exclou res.
        const discover = requestedMode === 'new' && policy === 'general';
        const mode = requestedMode === 'new' && !discover ? 'surprise' : requestedMode;
        const count = Math.max(1, options.count || cfg.queue.max - 1);
        const seed = options.seed || null;
        const preceding = toArray(options.preceding).length ? options.preceding : seed ? [seed] : [];
        const notes = [];

        // «historic»: només música antiga. «search»: ràdio d'una cerca; usa les cançons trobades tal com són
        // (sense mescla d'antiguitat), només ordenades pel gust de l'usuari i sense repetir artista seguit.
        const eraFree = policy === 'historic' || policy === 'search';
        const hasEnough = knownArtistCount(signals) >= 3;
        // `mix`: { labels, tagOf } perquè la ràdio barregi diversos estils a parts iguals.
        const mix = options.mix && toArray(options.mix.labels).length > 1 ? options.mix : null;
        const artistFirst = options.artistFirst !== false;
        // El soroll per cançó donaria més oportunitats als catàlegs grans abans del sorteig d'artista.
        let built = buildItems(toArray(options.candidates), ctx, signals, seed, artistFirst ? null : rng);
        let relaxedDiscovery = false;
        if (discover) {
            const found = discoveryPool(built, signals, count, cfg);
            built = found.items;
            relaxedDiscovery = found.relaxed;
        }
        if (mix) built.forEach(item => (item.tags = mix.tagOf(item.video)));
        // No retallem per puntuació de cançó: podria eliminar artistes amb un catàleg petit.
        const items = artistFirst ? trimArtistPool(built, count) : trimPool(built, cfg.queue.pool);
        // Un cor o una escolta explícita també compta si el resum d'artista encara no s'ha sincronitzat.
        // Es pren el senyal més fort: tenir més pistes indexades no suma cap preferència.
        const artistPreferences = new Map();
        if (artistFirst) {for (const item of built) {
            const key = item.f.artist || item.f.id;
            artistPreferences.set(key, Math.max(artistPreferences.get(key) || 0,
                artistTaste(key, signals, ctx.now, cfg), songTaste(item.f.id, signals, ctx.now, cfg)));
        }}
        const flow = options.affinities !== false && app.features.musicAffinities?.isActive(options.category, policy, mix)
            ? app.features.musicAffinities : null;
        const subcategoryFlow = flow?.radioContext?.(items.map(item => item.video), seed) || null;
        const pref = eraPreference(ctx, signals, { policy });

        // Objectius d'antiguitat: 65/25/10 per defecte, adaptats a una preferència forta i al que hi ha.
        const historicTarget = policy === 'historic' ? 1 : pref.historic;
        const restTarget = 1 - historicTarget;
        let eraTargets =
            policy === 'historic'
                ? { recent: 0, mid: 0, historic: 1 }
                : {
                      recent: restTarget * (cfg.era.target.recent / (cfg.era.target.recent + cfg.era.target.mid)),
                      mid: restTarget * (cfg.era.target.mid / (cfg.era.target.recent + cfg.era.target.mid)),
                      historic: historicTarget,
                  };
        let maxHistoric = eraFree ? 999 : pref.maxHistoricTop;
        const supply = { recent: 0, mid: 0, historic: 0 };
        const supplyArtists = { recent: new Set(), mid: new Set(), historic: new Set() };
        items.forEach(item => {
            supply[item.f.tier] += 1;
            supplyArtists[item.f.tier].add(item.f.artist);
        });
        if (!eraFree) {
            // Categoria amb poca música actual: es conserva la categoria i s'amplia amb catàleg històric.
            const modernSupport = Math.min(
                supply.recent + supply.mid,
                supplyArtists.recent.size * 2 + supplyArtists.mid.size * 2
            );
            const needed = Math.min(count, cfg.general.top);
            if (modernSupport < needed * (1 - historicTarget) && supply.historic > 0) {
                const extra = Math.min(needed - modernSupport, supply.historic);
                maxHistoric = Math.max(maxHistoric, Math.ceil(extra));
                const share = clamp(extra / needed, historicTarget, 1);
                eraTargets = {
                    recent: (1 - share) * 0.72,
                    mid: (1 - share) * 0.28,
                    historic: share,
                };
                notes.push(NOTE_LITTLE_RECENT);
            }
        }

        const famTargets = discover ? cfg.familiarity.new : hasEnough ? cfg.familiarity[mode] : null;
        const useFam = Boolean(famTargets);
        if (!hasEnough && !discover) {
            notes.push(signals.followed.size || Object.keys(signals.artists).length ? NOTE_VARIETY : NOTE_NONE);
        }

        // Les 12 últimes cançons compten només dins d'una mateixa sessió (3 h); passat això només mana el temps.
        const sessionMs = cfg.cooldown.minutes * 3 * 60000;
        const recentIds = signals.recent
            .filter(entry => ctx.now - (Number(entry?.at) || 0) < sessionMs)
            .map(entry => String(entry?.id || ''));
        const selectionOptions = {
            cfg,
            ctx,
            count,
            preceding,
            eraTargets: eraFree ? null : eraTargets,
            famTargets: useFam ? famTargets : null,
            maxHistoric,
            allowConsecutive: pref.allowConsecutive || eraFree,
            recentIds,
            recentTimes: recentTimesFrom(signals),
            now: ctx.now,
            signals,
            useCooldown: options.useCooldown !== false,
            mix,
            artistOf: ctx.artistKeyOf,
            seed,
            flow,
            subcategoryFlow,
            artistFirst,
            artistPreferences,
            discover,
            rng,
        };
        let result = runSelection(items, selectionOptions);
        if (artistFirst && result.picked.length < count && items.length < built.length) {
            result = runSelection(built, selectionOptions);
        }
        const stats = shares(result.picked);
        const newArtists = discover
            ? new Set(result.picked.filter(c => isNewArtist(c.f.artist, signals)).map(c => c.f.artist)).size
            : 0;
        if (discover) notes.push(relaxedDiscovery ? NOTE_NEW_FEW : discoveryNote(newArtists));
        return {
            queue: result.picked.map(c => c.video),
            meta: {
                mode: discover ? 'new' : hasEnough ? mode : 'variety',
                requested: requestedMode,
                discover: discover ? { artists: newArtists, relaxed: relaxedDiscovery } : null,
                artistFirst,
                subcategory: subcategoryFlow ? { id: subcategoryFlow.seedSubcategory,
                    artists: subcategoryFlow.seedArtists, minimumArtists: subcategoryFlow.minimumArtists } : null,
                // La nota que s'ensenya: primer el que explica una degradació (poca música actual, pocs artistes).
                note: notes.find(n => n !== NOTE_VARIETY && n !== NOTE_NONE) || notes[0] || '',
                notes,
                relaxedLevel: result.level,
                era: stats,
                eraTargets,
                historicCap: maxHistoric,
                pref,
                supply,
                mix: mix ? result.mixCount : null,
                artists: new Set(result.picked.map(c => c.f.artist)).size,
                fam: result.picked.reduce(
                    (acc, c) => {
                        acc[c.fam] += 1;
                        return acc;
                    },
                    { known: 0, affine: 0, surprise: 0 }
                ),
            },
        };
    }

    // Feed personalitzat («Recomanat per a tu»): mateixa puntuació i mateixes restriccions que la ràdio, però
    // sense descans dur (una cançó pot tornar a un feed que l'usuari recorre) i conservant tota la llista.
    function rankFeed(videos, options = {}) {
        const list = toArray(videos).filter(video => video && video.id);
        if (list.length < 2) return list;
        const ctx = options.ctx || createContext({ videos: list, now: options.now });
        const cfg = ctx.config;
        const signals = normalizeSignals(options.signals);
        const rng = options.rng || Math.random;
        const items = buildItems(list, ctx, signals, null, rng);
        const pool = trimPool(items, cfg.queue.pool);
        const pref = eraPreference(ctx, signals, {});
        // «Fora del meu radar» és d'una ràdio: un feed personalitzat no exclou res i el tracta com «Sorprèn-me».
        const picked = options.mode && cfg.familiarity[options.mode] ? options.mode : 'mix';
        const mode = picked === 'new' ? 'surprise' : picked;
        const hasEnough = knownArtistCount(signals) >= 3;
        const restTarget = 1 - pref.historic;
        const targetSum = cfg.era.target.recent + cfg.era.target.mid;
        const result = runSelection(pool, {
            cfg,
            ctx,
            count: pool.length,
            preceding: [],
            eraTargets: {
                recent: (restTarget * cfg.era.target.recent) / targetSum,
                mid: (restTarget * cfg.era.target.mid) / targetSum,
                historic: pref.historic,
            },
            famTargets: hasEnough ? cfg.familiarity[mode] : null,
            maxHistoric: pref.maxHistoricTop,
            allowConsecutive: pref.allowConsecutive,
            recentIds: [],
            recentTimes: new Map(),
            now: ctx.now,
            signals,
            useCooldown: false,
            artistOf: ctx.artistKeyOf,
        });
        const pickedIds = new Set(result.picked.map(c => c.f.id));
        const pickedIndex = recordingIndex(result.picked.map(c => c.f.keys));
        const rest = items.filter(item => !pickedIds.has(item.f.id) && !pickedIndex.has(item.f.keys));
        return [...result.picked, ...rest].map(item => item.video);
    }

    // Llista ja ordenada (per una altra lògica: feed personalitzat, files de la portada): aplica els límits
    // d'antiguitat i d'artista AL RESULTAT FINAL, mantenint l'ordre tant com és possible.
    // options: { ctx, preceding, maxHistoric, signals, lookahead }
    function arrange(list, options = {}) {
        const videos = toArray(list).filter(video => video && video.id);
        if (videos.length < 2) return videos;
        const ctx = options.ctx || createContext({ videos, now: options.now });
        const cfg = ctx.config;
        const signals = normalizeSignals(options.signals);
        const pref = eraPreference(ctx, signals, {});
        const n = videos.length;
        const items = videos.map((video, index) => ({
            video,
            f: featuresOf(ctx, video),
            base: 1 - index / n,
            fam: 'known',
        }));
        const result = runSelection(items, {
            cfg,
            ctx,
            count: n,
            preceding: toArray(options.preceding),
            maxHistoric: options.maxHistoric ?? pref.maxHistoricTop,
            allowConsecutive: pref.allowConsecutive,
            now: ctx.now,
            signals,
            keepAll: true,
            useCooldown: false,
            lookahead: options.lookahead || 80,
            artistOf: ctx.artistKeyOf,
        });
        // Les gravacions duplicades es descarten; la resta d'elements que no encaixen van al final, en el seu ordre.
        const picked = result.picked.map(c => c.video);
        const pickedIndex = recordingIndex(result.picked.map(c => c.f.keys));
        const rest = result.leftover.filter(c => !pickedIndex.has(c.f.keys)).map(c => c.video);
        return [...picked, ...rest];
    }

    // ---------- Torna-hi: preferides i repeticions reals ----------

    // Retorna [{ video, reason, score }] amb una cançó per artista i varietat d'antiguitat.
    function pickReturn(options = {}) {
        const ctx = options.ctx;
        const cfg = ctx.config;
        const rng = options.rng || Math.random;
        const signals = normalizeSignals(options.signals);
        const limit = options.limit || 4;
        const minRestMs = (options.minRestHours ?? 3) * 3600000;
        const pref = eraPreference(ctx, signals, {});
        const scored = [];
        toArray(options.candidates).forEach(video => {
            const id = idOf(video);
            const f = featuresOf(ctx, video);
            if (!id || signals.lessLike.has(id) || (f.artist && signals.blockedArtists.has(f.artist))) return;
            const entry = signals.songs[id];
            const liked = signals.liked.has(id);
            const asked = signals.moreLike.has(id);
            // Només amb evidència real: cor, «+ com aquesta», escoltes qualificades/finalitzades o repeticions voluntàries.
            const evidence = liked || asked || (entry && (entry.r > 0 || entry.f > 0 || entry.q >= 2));
            if (!evidence) return;
            if (entry?.l && ctx.now - entry.l < minRestMs) return;
            const taste = songTaste(id, signals, ctx.now, cfg);
            const rest = entry?.l ? 1 - Math.exp(-(ctx.now - entry.l) / (5 * DAY)) : 0.7;
            const s =
                taste * 0.75 +
                rest * 0.25 -
                skipPenalty(entry, cfg.taste.skipsToPenalize, ctx.now, cfg) +
                (rng() - 0.5) * 0.05;
            scored.push({ video, f, s, liked, asked, entry });
        });
        scored.sort((a, b) => b.s - a.s);
        const chosen = [];
        const artists = new Set();
        let historic = 0;
        const histMax = Math.max(1, Math.round(limit * pref.historic));
        scored.forEach(item => {
            if (chosen.length >= limit) return;
            if (item.f.artist && artists.has(item.f.artist)) return;
            if (item.f.tier === 'historic' && historic >= histMax) return;
            if (item.f.tier === 'historic') historic += 1;
            if (item.f.artist) artists.add(item.f.artist);
            chosen.push({
                video: item.video,
                score: item.s,
                reason: item.liked
                    ? 'Una de les teves preferides'
                    : item.asked
                      ? 'Has demanat més com aquesta'
                      : item.entry?.r > 0
                        ? 'L’has tornat a triar'
                        : 'Perquè l’escoltes',
            });
        });
        return chosen;
    }

    // Explicació breu per a una cançó (només diu el que és cert segons els senyals).
    function reasonFor(video, ctx, signalsInput) {
        const signals = normalizeSignals(signalsInput);
        const f = featuresOf(ctx, video);
        const name = video?.channelTitle || '';
        if (signals.liked.has(f.id)) return 'Una de les teves preferides';
        if (signals.moreLike.has(f.id)) return 'Has demanat més com aquesta';
        if (signals.followed.has(f.artist) && name) return `Perquè segueixes ${name}`;
        if (isKnownArtist(f.artist, signals) && name) return `Perquè escoltes ${name}`;
        return '';
    }

    // Resum d'una cua per a informes i proves.
    function summarize(videos, ctx) {
        const list = toArray(videos);
        const top = list.slice(0, ctx.config.general.top);
        const eraCounts = { recent: 0, mid: 0, historic: 0 };
        const artists = new Map();
        let consecutiveHistoric = 0;
        let maxSameArtistTop = 0;
        let previous = null;
        top.forEach(video => {
            const f = featuresOf(ctx, video);
            eraCounts[f.tier] += 1;
            artists.set(f.artist, (artists.get(f.artist) || 0) + 1);
            maxSameArtistTop = Math.max(maxSameArtistTop, artists.get(f.artist));
            if (previous === 'historic' && f.tier === 'historic') consecutiveHistoric += 1;
            previous = f.tier;
        });
        let minArtistGap = Infinity;
        const lastAt = new Map();
        list.forEach((video, index) => {
            const key = featuresOf(ctx, video).artist;
            if (lastAt.has(key)) minArtistGap = Math.min(minArtistGap, index - lastAt.get(key) - 1);
            lastAt.set(key, index);
        });
        return {
            length: list.length,
            topEra: eraCounts,
            historicTop: eraCounts.historic,
            consecutiveHistoric,
            maxSameArtistTop,
            distinctArtists: new Set(list.map(video => featuresOf(ctx, video).artist)).size,
            minArtistGap: Number.isFinite(minArtistGap) ? minArtistGap : null,
        };
    }

    // ---------- Adaptador al navegador ----------

    const contextCache = { videos: null, size: 0, day: 0, ctx: null, cfgKey: '' };

    // Context de l'app real (identitat d'artista, llista d'antics, estils). S'invalida quan canvia el feed.
    function getAppContext(videos, now = Date.now(), prepared = null) {
        const cfg = getConfig();
        const day = Math.floor(now / DAY);
        const cfgKey = JSON.stringify(cfg);
        if (
            contextCache.ctx &&
            contextCache.videos === videos &&
            contextCache.size === toArray(videos).length &&
            contextCache.day === day &&
            contextCache.cfgKey === cfgKey
        ) {
            return contextCache.ctx;
        }
        const ctx = prepared && JSON.stringify(prepared.config) === cfgKey
            ? prepared
            : createContext(appContextOptions(videos, now, cfg));
        contextCache.videos = videos;
        contextCache.size = toArray(videos).length;
        contextCache.day = day;
        contextCache.cfgKey = cfgKey;
        contextCache.ctx = ctx;
        return ctx;
    }

    function appContextOptions(videos, now, cfg) {
        const music = window.SegueixMusicCategories;
        // El mapa de canals es construeix una sola vegada (no per vídeo).
        const channels = appChannels();
        return {
            videos,
            now,
            config: cfg,
            artistKeyOf:
                typeof window.getVideoArtistKey === 'function'
                    ? video => window.getVideoArtistKey(video)
                    : app.features.discovery?.artistKeyOf || defaultArtistKey,
            isClassicArtist: music?.isClassicArtistVideo ? video => music.isClassicArtistVideo(video) : null,
            stylesOf: app.features.discovery?.stylesOf
                ? video => app.features.discovery.stylesOf(video, channels).map(lower)
                : null,
        };
    }

    async function prepareAppContext(videos, now = Date.now()) {
        const cfg = getConfig();
        const ctx = await createContextAsync(appContextOptions(videos, now, cfg));
        return getAppContext(videos, now, ctx);
    }

    function appChannels() {
        try {
            const feed = (typeof getFeedDataForFilter === 'function' && getFeedDataForFilter()) || currentFeedData;
            return app.features.discovery?.normalizeChannels?.(feed?.channels);
        } catch (error) {
            return null;
        }
    }

    app.features.musicSelection = {
        DEFAULTS,
        getConfig,
        setConfigOverrides,
        isEnabled,
        eraOf,
        isNewRelease,
        actualityScore,
        titleKeys,
        isSameRecording,
        createContext,
        createContextAsync,
        getAppContext,
        prepareAppContext,
        emptySignals,
        normalizeSignals,
        songTaste,
        artistTaste,
        eraPreference,
        scoreOne,
        selectRadio,
        rankFeed,
        arrange,
        pickReturn,
        reasonFor,
        summarize,
        isKnownArtist,
        isNewArtist,
        knownArtistCount,
    };
})(window);




