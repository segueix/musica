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
        },
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
    function createContext(options = {}) {
        const cfg = options.config || getConfig();
        const now = options.now ?? Date.now();
        const artistKeyOf = options.artistKeyOf || defaultArtistKey;
        const isClassicArtist = options.isClassicArtist || null;
        const stylesOf = options.stylesOf || (video => toArray(video?.categories).map(lower).filter(Boolean));
        const features = new Map();
        const tierViews = { recent: [], mid: [], historic: [] };
        const channelViews = new Map();

        toArray(options.videos).forEach(video => {
            const id = idOf(video);
            if (!id || features.has(id)) return;
            // Només les cançons compten per a les cohorts de popularitat (Shorts, entrevistes... es calculen sota demanda).
            const kind = lower(video.contentType).replace(/-/g, '_');
            if (kind && kind !== 'song' && kind !== 'live_song') return;
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
        });
        Object.values(tierViews).forEach(list => list.sort((a, b) => a - b));
        channelViews.forEach(list => list.sort((a, b) => a - b));

        // Popularitat normalitzada: percentil logarítmic dins del seu contingent d'antiguitat (i, en part,
        // dins del canal). Sense visualitzacions o amb una novetat de pocs dies no és «poc popular».
        features.forEach(f => {
            if (f.views <= 0) {
                f.popularity = NEUTRAL_POPULARITY;
                return;
            }
            const inTier = percentile(tierViews[f.tier], f.logViews);
            const inChannel =
                channelViews.get(f.artist)?.length > 2 ? percentile(channelViews.get(f.artist), f.logViews) : inTier;
            // Un clàssic popular ho és dins del seu catàleg: per als artistes antics confirmats pesa més el canal.
            const curated = f.tier === 'historic' && f.curated;
            f.popularity = curated ? 0.15 * inTier + 0.85 * inChannel : 0.65 * inTier + 0.35 * inChannel;
            if (f.ageDays !== null && f.ageDays < 30) f.popularity = Math.max(f.popularity, 0.5);
        });
        return { config: cfg, now, features, artistKeyOf, isClassicArtist, stylesOf };
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
            artist: featuresOf(options.ctx, video).artist,
            tier: featuresOf(options.ctx, video).tier,
            style: featuresOf(options.ctx, video).primaryStyle,
            fam: 'known',
        }));
        const usedIds = new Set(sequence.map(item => item.id));
        const usedRecordings = preceding.map(video => featuresOf(options.ctx, video).keys);
        const usedWork = new Set(usedRecordings.map(keys => keys.work));
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

        while (picked.length < count && remaining.length) {
            const win = windowOf();
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
                const limit = Math.min(remaining.length, lookahead);
                for (let i = 0; i < limit; i++) {
                    const c = remaining[i];
                    if (usedIds.has(c.f.id)) continue;
                    if (c.f.artist && lastArtists.includes(c.f.artist)) continue;
                    if (c.f.artist && win.filter(item => item.artist === c.f.artist).length >= perArtist) continue;
                    if (c.f.tier === 'historic') {
                        if (histInWindow >= histMax) continue;
                        if (!allowConsecutive && !level.consecutive && last?.tier === 'historic') continue;
                    }
                    if (level.work && usedWork.has(c.f.keys.work)) continue;
                    if (usedRecordings.some(keys => isSameRecording(keys, c.f.keys))) continue;
                    if (useCooldown) {
                        if (cool.has(c.f.id)) continue;
                        const at = recentTimes.get(c.f.id) || 0;
                        if (level.cool > 0 && at && now - at < cfg.cooldown.minutes * 60000 * level.cool) continue;
                    }
                    let s = c.base;
                    if (eraTargets) {
                        s += cfg.gain.era * (eraTargets[c.f.tier] - eraCount[c.f.tier] / total);
                    }
                    if (famTargets) {
                        const used = famCount.known + famCount.affine + famCount.surprise || 1;
                        // El repartiment coneguda/descoberta orienta però no domina la puntuació (marge acotat).
                        s += cfg.gain.familiarity * clamp(famTargets[c.fam] - famCount[c.fam] / used, -0.25, 0.25);
                    }
                    if (mix) s += cfg.gain.style * clamp(mixDeficit(c), -0.4, 0.4);
                    if (c.f.artist) s -= 0.05 * win.filter(item => item.artist === c.f.artist).length;
                    if (
                        c.f.primaryStyle &&
                        sequence.slice(-3).filter(item => item.style === c.f.primaryStyle).length >= 3
                    ) {
                        s -= 0.05;
                    }
                    // En reordenacions de llistes mana l'ordre original: s'agafa el primer que encaixa.
                    if (keepAll) s = c.base;
                    if (s > bestScore) {
                        bestScore = s;
                        chosen = i;
                        chosenLevel = li;
                    }
                }
            }
            if (chosen < 0) break;
            const [c] = remaining.splice(chosen, 1);
            maxLevel = Math.max(maxLevel, chosenLevel);
            picked.push(c);
            usedIds.add(c.f.id);
            usedWork.add(c.f.keys.work);
            usedRecordings.push(c.f.keys);
            sequence.push({ id: c.f.id, artist: c.f.artist, tier: c.f.tier, style: c.f.primaryStyle, fam: c.fam });
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

    // Ràdio: retorna la part automàtica de la cua (sense la cançó inicial).
    // options: { ctx, candidates, seed, signals, mode, policy, count, preceding, now, rng, category }
    function selectRadio(options = {}) {
        const ctx = options.ctx;
        const cfg = ctx.config;
        const rng = options.rng || Math.random;
        const signals = normalizeSignals(options.signals);
        const mode = options.mode && cfg.familiarity[options.mode] ? options.mode : 'mix';
        const policy = options.policy || 'general';
        const count = Math.max(1, options.count || cfg.queue.max - 1);
        const seed = options.seed || null;
        const preceding = toArray(options.preceding).length ? options.preceding : seed ? [seed] : [];
        const notes = [];

        const hasEnough = knownArtistCount(signals) >= 3;
        // `mix`: { labels, tagOf } perquè la ràdio barregi diversos estils a parts iguals.
        const mix = options.mix && toArray(options.mix.labels).length > 1 ? options.mix : null;
        const built = buildItems(toArray(options.candidates), ctx, signals, seed, rng);
        if (mix) built.forEach(item => (item.tags = mix.tagOf(item.video)));
        const items = trimPool(built, cfg.queue.pool);
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
        let maxHistoric = policy === 'historic' ? 999 : pref.maxHistoricTop;
        const supply = { recent: 0, mid: 0, historic: 0 };
        const supplyArtists = { recent: new Set(), mid: new Set(), historic: new Set() };
        items.forEach(item => {
            supply[item.f.tier] += 1;
            supplyArtists[item.f.tier].add(item.f.artist);
        });
        if (policy !== 'historic') {
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

        const famTargets = hasEnough ? cfg.familiarity[mode] : null;
        const useFam = Boolean(famTargets);
        if (!hasEnough) {
            notes.push(signals.followed.size || Object.keys(signals.artists).length ? NOTE_VARIETY : NOTE_NONE);
        }

        // Les 12 últimes cançons compten només dins d'una mateixa sessió (3 h); passat això només mana el temps.
        const sessionMs = cfg.cooldown.minutes * 3 * 60000;
        const recentIds = signals.recent
            .filter(entry => ctx.now - (Number(entry?.at) || 0) < sessionMs)
            .map(entry => String(entry?.id || ''));
        const result = runSelection(items, {
            cfg,
            ctx,
            count,
            preceding,
            eraTargets: policy === 'historic' ? null : eraTargets,
            famTargets: useFam ? famTargets : null,
            maxHistoric,
            allowConsecutive: pref.allowConsecutive || policy === 'historic',
            recentIds,
            recentTimes: recentTimesFrom(signals),
            now: ctx.now,
            signals,
            useCooldown: options.useCooldown !== false,
            mix,
            artistOf: ctx.artistKeyOf,
        });
        if (result.level >= 4) {
            notes.push('Aquesta selecció té molt pocs artistes: hi poden sonar cançons seguides del mateix artista.');
        } else if (result.level >= 2) {
            notes.push('Hem relaxat els límits de repetició d’artista perquè el catàleg disponible és petit.');
        }

        const stats = shares(result.picked);
        return {
            queue: result.picked.map(c => c.video),
            meta: {
                mode: hasEnough ? mode : 'variety',
                requested: mode,
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
        const mode = options.mode && cfg.familiarity[options.mode] ? options.mode : 'mix';
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
        const rest = items.filter(
            item => !pickedIds.has(item.f.id) && !result.picked.some(p => isSameRecording(p.f.keys, item.f.keys))
        );
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
        const rest = result.leftover
            .filter(c => !result.picked.some(p => isSameRecording(p.f.keys, c.f.keys)))
            .map(c => c.video);
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
    function getAppContext(videos, now = Date.now()) {
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
        const music = window.SegueixMusicCategories;
        // El mapa de canals es construeix una sola vegada (no per vídeo).
        const channels = appChannels();
        const ctx = createContext({
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
        });
        contextCache.videos = videos;
        contextCache.size = toArray(videos).length;
        contextCache.day = day;
        contextCache.cfgKey = cfgKey;
        contextCache.ctx = ctx;
        return ctx;
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
        getAppContext,
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
        knownArtistCount,
    };
})(window);
