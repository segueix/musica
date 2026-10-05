// Descoberta musical de la portada de Segueix Música.
// Implementació directa (patró 2): totes les funcions són pures i reben el context de dades de manera
// explícita (historial, m'agrada, seguits, catàleg). Només getMode/setMode toquen localStorage: la clau
// `catube_discovery_mode` viatja amb l'exportació i la sincronització de configuració perquè aquestes
// copien tot el localStorage.
//
// Principis:
//  - Res d'inventat: només es fa servir el que l'usuari ha fet (historial, m'agrada, artistes seguits)
//    i les dades reals del catàleg (estils, dates de publicació, canals).
//  - Sense historial suficient no hi ha personalització: es genera una selecció variada i s'explica.
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;

    const STORAGE_KEY = 'catube_discovery_mode';
    const MODE_EVENT = 'segueix:discovery-mode-changed';
    const DEFAULT_MODE = 'mix';

    // Preferència explícita de descoberta (no és un estat d'ànim).
    const MODES = Object.freeze([
        {
            id: 'home',
            label: 'Els meus de sempre',
            hint: 'Dona prioritat als artistes que segueixes o ja has escoltat.',
        },
        { id: 'mix', label: 'Una mica de tot', hint: 'Combina música coneguda i descoberta.' },
        { id: 'surprise', label: 'Sorprèn-me', hint: 'Dona més pes als artistes que encara no has escoltat.' },
        {
            id: 'new',
            label: 'Fora del meu radar',
            hint: 'Només artistes que encara no has escoltat: grups que potser ni sabies que existien.',
        },
    ]);

    // Proporció coneguda (K) / per descobrir (F) de cada mode, repetida cíclicament.
    const PATTERNS = Object.freeze({
        home: ['K', 'K', 'K', 'K', 'K', 'F'],
        mix: ['K', 'F'],
        surprise: ['F', 'F', 'F', 'F', 'K'],
        // Només descoberta: el conegut queda al final i només surt si no n'hi ha prou de nou.
        new: ['F'],
    });

    // Mateixes etiquetes que SegueixMusicCategories.CATEGORY_GROUPS (es fa servir aquell si és carregat).
    const FALLBACK_STYLES = Object.freeze([
        'Urban',
        'Pop',
        'Rock',
        "Cançó d'autor",
        'Indie',
        'Rap / Hip-hop',
        'Folk i arrel',
        'Electrònica',
        'Ska / Reggae',
        'Rumba / Mestissatge',
        'Punk / Metal',
        'Jazz / Blues',
        'Infantil',
        'Altres estils',
    ]);
    // Els més accessibles, en aquest ordre; la resta queden darrere «Tots els estils».
    const PRIMARY_STYLES = Object.freeze([
        'Urban',
        'Pop',
        'Rock',
        "Cançó d'autor",
        'Indie',
        'Rap / Hip-hop',
        'Folk i arrel',
        'Electrònica',
    ]);

    // Estils amplis: en cas d'empat, l'explicació d'«Fora del teu radar» prefereix un estil més concret.
    const BROAD_STYLES = Object.freeze(['Pop', 'Rock']);
    // Amb menys artistes coneguts no hi ha base per afinar res.
    const MIN_KNOWN_ARTISTS = 3;
    // Un artista amb una familiaritat igual o superior ja no és «poc escoltat».
    const LOW_FAMILIARITY = 2;
    // Punts d'estil (1 per escolta, 2 per m'agrada o artista seguit) que justifiquen una explicació.
    const STYLE_REASON_MIN_POINTS = 2;
    const MIN_SONG_SECONDS = 60;
    const DAY_MS = 86400000;

    const toArray = value => (Array.isArray(value) ? value : []);
    const unique = list => [...new Set(list)];

    // ---------- Dades bàsiques del catàleg ----------

    // Mateixa clau d'artista que getVideoArtistKey() (helpers.js): el canal que publica el vídeo.
    function artistKeyOf(video) {
        const key =
            video?.channelId || video?.snippet?.channelId || video?.channelTitle || video?.snippet?.channelTitle;
        return String(key || '')
            .trim()
            .toLowerCase();
    }

    // Tipus de contingut ('song', 'live_song', ...). Sense contentType (snapshots antics) és una cançó.
    function contentKind(video) {
        const raw = String(video?.contentType || '')
            .trim()
            .toLowerCase()
            .replace(/-/g, '_');
        return raw || 'song';
    }

    function isPlayable(video) {
        if (!video?.id || video.isShort) return false;
        const kind = contentKind(video);
        if (kind !== 'song' && kind !== 'live_song') return false;
        const seconds = Number(video.durationSeconds) || 0;
        return !(seconds > 0 && seconds < MIN_SONG_SECONDS);
    }
    const isStudioSong = video => isPlayable(video) && contentKind(video) === 'song';
    const isLiveSong = video => isPlayable(video) && contentKind(video) === 'live_song';

    function timestampOf(video) {
        const time = new Date(video?.publishedAt || video?.uploadDate || 0).getTime();
        return Number.isFinite(time) ? time : 0;
    }

    function styleLabels() {
        const groups = window.SegueixMusicCategories?.CATEGORY_GROUPS;
        return Array.isArray(groups) && groups.length ? groups.map(group => group.label) : FALLBACK_STYLES;
    }

    function canonicalStyle(name) {
        const lower = String(name || '')
            .trim()
            .toLowerCase();
        return styleLabels().find(label => label.toLowerCase() === lower) || null;
    }

    // `feed.channels` pot ser una llista (app) o un diccionari (feed.json): tots dos es normalitzen a Map.
    function normalizeChannels(source) {
        if (source instanceof Map) return source;
        const map = new Map();
        const add = (id, channel) => {
            const key = String(id || channel?.id || '')
                .trim()
                .toLowerCase();
            if (key && channel && typeof channel === 'object') {
                map.set(key, { ...channel, id: String(id || channel.id) });
            }
        };
        if (Array.isArray(source)) source.forEach(channel => add(channel?.id, channel));
        else if (source && typeof source === 'object') Object.keys(source).forEach(id => add(id, source[id]));
        return map;
    }

    // Estils reals del projecte d'un vídeo: els del vídeo més els del canal (assignacions múltiples).
    function stylesOf(video, channels) {
        const own = toArray(video?.categories).map(canonicalStyle).filter(Boolean);
        const channel = channels?.get?.(artistKeyOf(video));
        const fromChannel = toArray(channel?.categories).map(canonicalStyle).filter(Boolean);
        return unique([...own, ...fromChannel]);
    }
    const primaryStyleOf = (video, channels) => stylesOf(video, channels)[0] || 'Altres estils';

    // ---------- Mode de descoberta (persistència) ----------

    function normalizeMode(value) {
        return MODES.some(mode => mode.id === value) ? value : DEFAULT_MODE;
    }

    function getMode() {
        try {
            return normalizeMode(window.localStorage?.getItem?.(STORAGE_KEY));
        } catch (error) {
            return DEFAULT_MODE;
        }
    }

    function setMode(value) {
        const mode = normalizeMode(value);
        try {
            window.localStorage?.setItem?.(STORAGE_KEY, mode);
        } catch (error) {
            // Sense emmagatzematge: la preferència només val per a aquesta sessió
        }
        try {
            if (typeof window.dispatchEvent === 'function' && typeof window.CustomEvent === 'function') {
                window.dispatchEvent(new window.CustomEvent(MODE_EVENT, { detail: { mode } }));
            }
        } catch (error) {
            // Entorn sense esdeveniments (proves)
        }
        return mode;
    }

    // ---------- Perfil de l'usuari ----------

    const familiarityOfEntry = entry => (entry ? entry.plays + entry.likes * 2 + (entry.followed ? 3 : 0) : 0);

    // Historial (1 punt), m'agrada (2) i artistes seguits (3) → familiaritat per artista i punts per estil.
    function buildProfile({ history, liked, followedIds, channels } = {}) {
        const channelMap = normalizeChannels(channels);
        const artists = new Map();
        const styles = new Map();
        const entryFor = key => {
            if (!artists.has(key)) artists.set(key, { key, plays: 0, likes: 0, followed: false, lastAt: 0 });
            return artists.get(key);
        };
        const addStyles = (list, points) => list.forEach(style => styles.set(style, (styles.get(style) || 0) + points));

        const played = toArray(history).filter(video => video && !video.isShort);
        played.forEach(video => {
            const key = artistKeyOf(video);
            if (!key) return;
            const entry = entryFor(key);
            entry.plays += 1;
            entry.lastAt = Math.max(entry.lastAt, new Date(video.viewedAt || 0).getTime() || 0);
            addStyles(stylesOf(video, channelMap), 1);
        });
        const likedVideos = toArray(liked).filter(video => video && !video.isShort);
        likedVideos.forEach(video => {
            const key = artistKeyOf(video);
            if (!key) return;
            entryFor(key).likes += 1;
            addStyles(stylesOf(video, channelMap), 2);
        });
        const followed = toArray(followedIds)
            .map(id =>
                String(id || '')
                    .trim()
                    .toLowerCase()
            )
            .filter(Boolean);
        followed.forEach(key => {
            entryFor(key).followed = true;
            addStyles(toArray(channelMap.get(key)?.categories).map(canonicalStyle).filter(Boolean), 2);
        });

        let knownArtistCount = 0;
        artists.forEach(entry => {
            if (familiarityOfEntry(entry) > 0) knownArtistCount += 1;
        });
        return {
            artists,
            styles,
            channels: channelMap,
            playedCount: played.length,
            knownArtistCount,
            hasHistory: played.length > 0 || likedVideos.length > 0 || followed.length > 0,
            hasEnough: knownArtistCount >= MIN_KNOWN_ARTISTS,
        };
    }

    // Accepta un vídeo o directament la clau d'artista.
    function familiarity(profile, videoOrKey) {
        if (!profile?.artists) return 0;
        const key = typeof videoOrKey === 'string' ? videoOrKey.trim().toLowerCase() : artistKeyOf(videoOrKey);
        return familiarityOfEntry(profile.artists.get(key));
    }

    function styleAffinity(profile, video) {
        if (!profile?.styles) return 0;
        return stylesOf(video, profile.channels).reduce((sum, style) => sum + (profile.styles.get(style) || 0), 0);
    }

    // ---------- Ordenació per mode (cua de «La teva ràdio») ----------

    function noteFor(reason) {
        return reason === 'none'
            ? 'Encara no tens historial d’escolta: et proposem una selecció variada.'
            : 'Encara tenim poc historial per afinar-ho: et proposem una selecció variada.';
    }

    // Barreja lleu: conserva l'ordre base (que ja té criteri) però evita que cada cua sigui idèntica.
    function jitter(list, rng, strength) {
        if (!strength || list.length < 2) return list;
        return list
            .map((item, index) => ({ item, score: index / list.length + rng() * strength }))
            .sort((a, b) => a.score - b.score)
            .map(entry => entry.item);
    }

    function shuffle(list, rng) {
        const copy = list.slice();
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    // Selecció variada: torn rotatiu entre estils, mantenint l'ordre base dins de cada estil.
    function diversify(list, { rng = Math.random, profile = null } = {}) {
        const groups = new Map();
        toArray(list).forEach(video => {
            const style = primaryStyleOf(video, profile?.channels);
            if (!groups.has(style)) groups.set(style, []);
            groups.get(style).push(video);
        });
        const order = shuffle([...groups.keys()], rng);
        const result = [];
        let progressed = true;
        while (progressed) {
            progressed = false;
            order.forEach(style => {
                const group = groups.get(style);
                if (group.length) {
                    result.push(group.shift());
                    progressed = true;
                }
            });
        }
        return result;
    }

    function interleave(known, fresh, pattern, startStep = 0) {
        const result = [];
        let k = 0;
        let f = 0;
        let step = startStep;
        while (k < known.length || f < fresh.length) {
            const wanted = pattern[step % pattern.length];
            step += 1;
            if (wanted === 'K' && k < known.length) result.push(known[k++]);
            else if (wanted === 'F' && f < fresh.length) result.push(fresh[f++]);
            else if (k < known.length) result.push(known[k++]);
            else result.push(fresh[f++]);
        }
        return result;
    }

    // Reordena `candidates` (ja ordenats pel criteri base: Música TV, actualitat...) segons el mode.
    // Retorna { ordered, mode, requested, note }: `mode` és el que s'ha aplicat de veritat
    // ('variety' si no hi ha historial suficient) i `note` explica breument per què.
    // `after`: vídeo que ja ocupa la primera posició (la cançó que sona); compta com a primer pas del patró.
    function orderForMode(
        candidates,
        profile,
        requestedMode,
        { rng = Math.random, jitterStrength = 0.3, after = null } = {}
    ) {
        const list = toArray(candidates).filter(Boolean);
        const requested = normalizeMode(requestedMode);
        if (!profile || !profile.hasEnough) {
            return {
                ordered: diversify(list, { rng, profile }),
                mode: 'variety',
                requested,
                note: noteFor(profile?.hasHistory ? 'little' : 'none'),
            };
        }
        let known = [];
        let fresh = [];
        list.forEach(video => (familiarity(profile, video) > 0 ? known : fresh).push(video));
        if (requested === 'home') {
            known = known
                .map((video, index) => ({ video, index, score: familiarity(profile, video) }))
                .sort((a, b) => b.score - a.score || a.index - b.index)
                .map(entry => entry.video);
        }
        // Entre els artistes per descobrir, primer els d'estils que l'usuari ja ha explorat.
        fresh = fresh
            .map((video, index) => ({ video, index, score: styleAffinity(profile, video) }))
            .sort((a, b) => b.score - a.score || a.index - b.index)
            .map(entry => entry.video);
        known = requested === 'home' ? known : jitter(known, rng, jitterStrength);
        fresh = jitter(fresh, rng, jitterStrength);
        const pattern = PATTERNS[requested];
        const firstClass = after && familiarity(profile, after) > 0 ? 'K' : 'F';
        const startStep = after && pattern[0] === firstClass ? 1 : 0;
        return { ordered: interleave(known, fresh, pattern, startStep), mode: requested, requested, note: '' };
    }

    // ---------- Portada: seccions ----------

    // Repartiment de la portada: una cançó no surt dues vegades i cap artista n'ocupa gairebé tota.
    function createPlacement({ maxPerArtist = 2 } = {}) {
        const ids = new Set();
        const counts = new Map();
        return {
            has: id => ids.has(String(id)),
            can(video) {
                const key = artistKeyOf(video);
                return !ids.has(String(video?.id)) && (!key || (counts.get(key) || 0) < maxPerArtist);
            },
            take(video) {
                if (!this.can(video)) return false;
                ids.add(String(video.id));
                const key = artistKeyOf(video);
                if (key) counts.set(key, (counts.get(key) || 0) + 1);
                return true;
            },
            count: key => counts.get(String(key || '').toLowerCase()) || 0,
        };
    }

    // Novetat destacada de l'entrada: cançó recent amb bona imatge; si el seu artista és conegut ho diu.
    function pickFeatured({ videos, profile, exclude, isClip, isNew, now = Date.now() } = {}) {
        const blocked = exclude instanceof Set ? exclude : new Set();
        const pool = toArray(videos).filter(
            video => isStudioSong(video) && video.thumbnail && !blocked.has(String(video.id))
        );
        if (!pool.length) return null;
        const recentMs = 21 * DAY_MS;
        const scored = pool.map(video => {
            const age = Math.max(0, now - timestampOf(video));
            const known = familiarity(profile, video) > 0;
            let score = -age / DAY_MS;
            if (age <= recentMs) score += 30;
            if (typeof isClip === 'function' && isClip(video)) score += 8;
            if (known) score += 12;
            return { video, score, known };
        });
        scored.sort((a, b) => b.score - a.score);
        const best = scored[0];
        const entry = profile?.artists?.get(artistKeyOf(best.video));
        let eyebrow = 'Novetat';
        // Una reedició o un arxiu pujat fa poc no és una estrena (només es diu «Novetat» amb base).
        const genuinelyNew = typeof isNew === 'function' ? Boolean(isNew(best.video)) : true;
        if (!genuinelyNew) {
            eyebrow = best.known
                ? entry?.followed
                    ? 'Un artista que segueixes'
                    : 'Un artista que has escoltat'
                : 'Per començar';
        } else if (best.known) {
            eyebrow = entry?.followed ? 'Novetat d’un artista que segueixes' : 'Novetat d’un artista que has escoltat';
        } else if (now - timestampOf(best.video) > 90 * DAY_MS) {
            eyebrow = 'Per començar';
        }
        return { video: best.video, eyebrow, known: best.known };
    }

    // «Fora del teu radar» / «Per descobrir»: artistes poc escoltats amb afinitat amb els estils explorats.
    function pickRadar({ videos, profile, limit = 10, rng = Math.random, exclude } = {}) {
        const blocked = exclude instanceof Set ? exclude : new Set();
        const newestByArtist = new Map();
        toArray(videos).forEach(video => {
            if (!isStudioSong(video) || !video.thumbnail) return;
            const key = artistKeyOf(video);
            if (!key || blocked.has(key)) return;
            const current = newestByArtist.get(key);
            if (!current || timestampOf(video) > timestampOf(current)) newestByArtist.set(key, video);
        });

        const candidates = [];
        newestByArtist.forEach((video, key) => {
            if (familiarity(profile, key) >= LOW_FAMILIARITY) return;
            candidates.push({
                key,
                video,
                channel: profile?.channels?.get?.(key) || null,
                styles: stylesOf(video, profile?.channels),
                affinity: styleAffinity(profile, video),
                familiarity: familiarity(profile, key),
            });
        });

        const justified = profile?.hasHistory ? candidates.filter(c => c.affinity >= STYLE_REASON_MIN_POINTS) : [];
        const items = [];
        const used = new Set();
        const perStyle = new Map();
        const push = (candidate, reason) => {
            used.add(candidate.key);
            items.push({
                key: candidate.key,
                channelId: candidate.video.channelId || candidate.channel?.id || candidate.key,
                name: candidate.channel?.name || candidate.channel?.title || candidate.video.channelTitle || '',
                avatar: candidate.channel?.avatar || candidate.channel?.thumbnail || '',
                video: candidate.video,
                styles: candidate.styles,
                reason,
            });
        };

        // Amb dades que ho justifiquen: més afinitat primer, els menys escoltats abans, i els més nous.
        justified
            .sort(
                (a, b) =>
                    b.affinity - a.affinity ||
                    a.familiarity - b.familiarity ||
                    timestampOf(b.video) - timestampOf(a.video)
            )
            .forEach(candidate => {
                if (items.length >= limit) return;
                // La millor coincidència d'estil amb el que l'usuari ha explorat és la que s'explica.
                // Amb els mateixos punts, s'explica l'estil més concret (Indie abans que Pop, per exemple).
                const best = candidate.styles
                    .filter(style => style !== 'Altres estils')
                    .map(style => ({
                        style,
                        points: profile.styles.get(style) || 0,
                        broad: BROAD_STYLES.includes(style),
                    }))
                    .filter(entry => entry.points >= STYLE_REASON_MIN_POINTS)
                    .sort((a, b) => b.points - a.points || Number(a.broad) - Number(b.broad))[0];
                if (!best) return;
                // Que un sol estil no ompli tota la fila.
                if ((perStyle.get(best.style) || 0) >= Math.max(3, Math.ceil(limit / 2))) return;
                perStyle.set(best.style, (perStyle.get(best.style) || 0) + 1);
                push(candidate, `Més ${best.style.toLowerCase()} per descobrir`);
            });

        // La resta de la fila (o tota, sense historial): varietat d'estils, sense cap explicació inventada.
        if (items.length < limit) {
            const rest = candidates.filter(c => !used.has(c.key));
            diversify(
                rest.map(c => c.video),
                { rng, profile }
            ).forEach(video => {
                if (items.length >= limit) return;
                const candidate = rest.find(c => c.video === video);
                if (candidate) push(candidate, '');
            });
        }

        const personalized = items.some(item => item.reason);
        return {
            title: personalized ? 'Fora del teu radar' : 'Per descobrir',
            subtitle: personalized ? 'Artistes que encara no has escoltat' : 'Una mica de tot el catàleg',
            personalized,
            items,
        };
    }

    // «Torna-hi»: cançons, artistes i llistes recents. Només si hi ha historial.
    function pickReturnItems({ history, playlists, channels, limit = 6, preferred = [] } = {}) {
        const channelMap = normalizeChannels(channels);
        const recent = toArray(history).filter(video => video?.id && !video.isShort);
        if (!recent.length && !toArray(preferred).length) return [];

        const songs = [];
        const songIds = new Set();
        // Preferides i repeticions reals (motor de selecció): van primer, amb la seva explicació.
        toArray(preferred).forEach(entry => {
            const video = entry?.video;
            const id = String(video?.id || '');
            if (!id || songIds.has(id) || !isPlayable(video)) return;
            songIds.add(id);
            songs.push({
                type: 'song',
                id,
                video,
                title: video.title || '',
                subtitle: video.channelTitle || channelMap.get(artistKeyOf(video))?.name || '',
                image: video.thumbnail || '',
                reason: entry.reason || '',
            });
        });
        recent.forEach(video => {
            const id = String(video.id);
            if (songIds.has(id) || !isPlayable(video)) return;
            songIds.add(id);
            songs.push({
                type: 'song',
                id,
                video,
                title: video.title || '',
                subtitle: video.channelTitle || channelMap.get(artistKeyOf(video))?.name || '',
                image: video.thumbnail || '',
            });
        });

        const artists = [];
        const shownArtists = new Set(songs.slice(0, 3).map(item => artistKeyOf(item.video)));
        recent.forEach(video => {
            const key = artistKeyOf(video);
            if (!key || shownArtists.has(key)) return;
            shownArtists.add(key);
            const channel = channelMap.get(key);
            artists.push({
                type: 'artist',
                id: String(video.channelId || key),
                key,
                title: channel?.name || channel?.title || video.channelTitle || '',
                subtitle: 'Artista',
                image: channel?.avatar || channel?.thumbnail || '',
            });
        });

        const lists = toArray(playlists)
            .filter(list => list?.id && toArray(list.videos).length > 0)
            .reverse()
            .map(list => ({
                type: 'list',
                id: String(list.id),
                title: list.name || 'Llista',
                subtitle: `${list.videos.length} ${list.videos.length === 1 ? 'cançó' : 'cançons'}`,
                images: list.videos
                    .map(video => video?.thumbnail)
                    .filter(Boolean)
                    .slice(0, 4),
            }));

        // Alternança cançó · artista · cançó · llista... perquè la fila no sigui monòtona.
        const buckets = [songs.slice(0, 4), artists.slice(0, 2), lists.slice(0, 2)];
        const result = [];
        for (let round = 0; result.length < limit && round < limit; round++) {
            buckets.forEach(bucket => {
                if (result.length < limit && bucket[round] !== undefined) result.push(bucket[round]);
            });
        }
        return result;
    }

    // «Comença per aquí»: primera visita. Una cançó per artista, repartida entre estils.
    function pickStartHere({ videos, profile, limit = 6, rng = Math.random, exclude, isClassic } = {}) {
        const blocked = exclude instanceof Set ? exclude : new Set();
        const seen = new Set();
        const pool = toArray(videos)
            .filter(video => isStudioSong(video) && video.thumbnail && !blocked.has(String(video.id)))
            .sort((a, b) => timestampOf(b) - timestampOf(a))
            .filter(video => {
                const key = artistKeyOf(video);
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        const maxClassic = Math.max(1, Math.ceil(limit / 5));
        let classics = 0;
        return diversify(pool, { rng, profile })
            .filter(video => {
                if (typeof isClassic === 'function' && isClassic(video)) {
                    if (classics >= maxClassic) return false;
                    classics += 1;
                }
                return true;
            })
            .slice(0, limit);
    }

    // «Tria el teu so»: estils reals amb artistes al catàleg carregat (un artista compta a cada estil que té).
    function summarizeStyles({ videos, channels, avatarsPerStyle = 3 } = {}) {
        const channelMap = normalizeChannels(channels);
        const stats = new Map();
        toArray(videos).forEach(video => {
            if (!isPlayable(video)) return;
            const key = artistKeyOf(video);
            if (!key) return;
            stylesOf(video, channelMap).forEach(style => {
                if (!stats.has(style)) stats.set(style, { artists: new Map() });
                const artists = stats.get(style).artists;
                const at = timestampOf(video);
                if (!artists.has(key) || at > artists.get(key)) artists.set(key, at);
            });
        });
        return styleLabels()
            .filter(label => stats.has(label))
            .map(label => {
                const artists = stats.get(label).artists;
                const avatars = [...artists.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .map(([key]) => channelMap.get(key)?.avatar || channelMap.get(key)?.thumbnail || '')
                    .filter(Boolean)
                    .slice(0, avatarsPerStyle);
                return { label, artists: artists.size, avatars, primary: PRIMARY_STYLES.includes(label) };
            })
            .sort((a, b) => {
                if (a.primary !== b.primary) return a.primary ? -1 : 1;
                if (a.primary) return PRIMARY_STYLES.indexOf(a.label) - PRIMARY_STYLES.indexOf(b.label);
                return 0;
            });
    }

    // ---------- Adaptador: context real de l'app (només ús en navegador) ----------

    // Les funcions d'app.js són globals lèxics, no propietats de window: s'hi accedeix amb typeof.
    function readAppContext() {
        const safe = fn => {
            try {
                return fn();
            } catch (error) {
                return undefined;
            }
        };
        const history = safe(() => (typeof getHistoryItems === 'function' ? getHistoryItems() : [])) || [];
        const liked = safe(() => (typeof getLikedVideos === 'function' ? getLikedVideos() : [])) || [];
        const followedIds =
            safe(() => (typeof getFollowedChannelIds === 'function' ? getFollowedChannelIds() : [])) || [];
        const hidden = safe(() => (typeof getHiddenChannelIds === 'function' ? getHiddenChannelIds() : [])) || [];
        return { history, liked, followedIds, hiddenIds: new Set(hidden.map(id => String(id))) };
    }

    // ---------- Gust recent: de què es fa «La teva ràdio» ----------

    // Estils que tria l'usuari la PRIMERA vegada (quan encara no hi ha historial, m'agrades ni seguits). Es desen
    // (viatgen amb l'exportació) i només s'usen mentre no hi hagi cap altra dada.
    const FIRST_STYLES_KEY = 'catube_first_styles';
    const MAX_FIRST_STYLES = 3;
    // Finestra de l'historial per a la ràdio: la darrera setmana; si hi ha poca cosa, l'últim mes; si encara
    // n'hi ha menys, tot l'historial. Els m'agrades i els artistes seguits no tenen data: sempre compten.
    const RECENT_DAYS = 7;
    const WIDE_DAYS = 30;
    const MIN_RECENT_PLAYS = 3;

    // Estils que es poden triar (sense «Altres estils», que és un calaix).
    const choosableStyles = () => styleLabels().filter(label => label !== 'Altres estils');

    function getFirstStyles() {
        try {
            const raw = JSON.parse(window.localStorage?.getItem?.(FIRST_STYLES_KEY) || '[]');
            return unique(toArray(raw).map(canonicalStyle).filter(Boolean)).slice(0, MAX_FIRST_STYLES);
        } catch (error) {
            return [];
        }
    }

    function setFirstStyles(list) {
        const styles = unique(toArray(list).map(canonicalStyle).filter(Boolean)).slice(0, MAX_FIRST_STYLES);
        try {
            if (styles.length) window.localStorage?.setItem?.(FIRST_STYLES_KEY, JSON.stringify(styles));
            else window.localStorage?.removeItem?.(FIRST_STYLES_KEY);
        } catch (error) {
            // Sense emmagatzematge: només val per a aquesta sessió
        }
        return styles;
    }

    // Què ha escoltat, agradat i seguit l'usuari «aquests dies». Pur (el temps entra per `now`).
    // → { windowDays (7 | 30 | 0 = tot), plays, liked, followed, artistKeys, styles, topArtists, hasAny, hasRecent }
    function recentTaste({ history, liked, followedIds, channels, now = Date.now() } = {}) {
        const channelMap = normalizeChannels(channels);
        const played = toArray(history).filter(video => video && !video.isShort);
        const timeOf = video => new Date(video.viewedAt || 0).getTime() || 0;
        const within = days => played.filter(video => timeOf(video) > 0 && now - timeOf(video) <= days * DAY_MS);
        let windowDays = RECENT_DAYS;
        let recent = within(RECENT_DAYS);
        if (recent.length < MIN_RECENT_PLAYS) {
            windowDays = WIDE_DAYS;
            recent = within(WIDE_DAYS);
        }
        if (recent.length < MIN_RECENT_PLAYS) {
            windowDays = 0;
            recent = played;
        }
        const likedVideos = toArray(liked).filter(video => video && !video.isShort);
        const followed = unique(
            toArray(followedIds)
                .map(id =>
                    String(id || '')
                        .trim()
                        .toLowerCase()
                )
                .filter(Boolean)
        );

        const weight = new Map();
        const names = new Map();
        const addArtist = (key, points, name) => {
            if (!key) return;
            weight.set(key, (weight.get(key) || 0) + points);
            if (name && !names.has(key)) names.set(key, String(name));
        };
        const stylePoints = new Map();
        const addStyles = (list, points) =>
            list.forEach(style => stylePoints.set(style, (stylePoints.get(style) || 0) + points));
        recent.forEach(video => {
            addArtist(artistKeyOf(video), 1, video.channelTitle || video.snippet?.channelTitle);
            addStyles(stylesOf(video, channelMap), 1);
        });
        likedVideos.forEach(video => {
            addArtist(artistKeyOf(video), 2, video.channelTitle || video.snippet?.channelTitle);
            addStyles(stylesOf(video, channelMap), 2);
        });
        followed.forEach(key => {
            const channel = channelMap.get(key);
            addArtist(key, 3, channel?.name || channel?.title);
            addStyles(toArray(channel?.categories).map(canonicalStyle).filter(Boolean), 2);
        });

        const byWeight = list => [...list].sort((a, b) => b[1] - a[1]);
        return {
            windowDays,
            plays: recent.length,
            liked: likedVideos.length,
            followed: followed.length,
            artistKeys: new Set(weight.keys()),
            styles: byWeight(stylePoints)
                .slice(0, 3)
                .map(([style]) => style),
            topArtists: byWeight(weight)
                .map(([key]) => names.get(key))
                .filter(Boolean)
                .slice(0, 3),
            hasAny: recent.length > 0 || likedVideos.length > 0 || followed.length > 0,
            hasRecent: recent.length > 0,
        };
    }

    // Text de la targeta «La teva ràdio»: de què està feta (en català, amb els recomptes reals).
    function tasteSummary(taste) {
        if (!taste?.hasAny) return '';
        const parts = [];
        if (taste.plays > 0) {
            const count = taste.plays === 1 ? '1 cançó' : `${taste.plays} cançons`;
            const when = taste.windowDays === 7 ? ' aquesta setmana' : taste.windowDays === 30 ? ' aquest mes' : '';
            parts.push(`el que has escoltat${when} (${count})`);
        }
        if (taste.liked > 0) parts.push(`els teus m’agrades (${taste.liked})`);
        if (taste.followed > 0) parts.push(`els artistes que segueixes (${taste.followed})`);
        const joined = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} i ${parts[parts.length - 1]}` : parts[0];
        return `Feta amb ${joined}.`;
    }

    // Perfil de l'usuari a partir del que hi ha desat al dispositiu.
    function getProfile(channels) {
        const context = readAppContext();
        return buildProfile({ ...context, channels });
    }

    app.features.discovery = {
        MODES,
        DEFAULT_MODE,
        STORAGE_KEY,
        MODE_EVENT,
        PRIMARY_STYLES,
        MIN_KNOWN_ARTISTS,
        getMode,
        setMode,
        normalizeMode,
        normalizeChannels,
        artistKeyOf,
        contentKind,
        isPlayable,
        isStudioSong,
        isLiveSong,
        stylesOf,
        buildProfile,
        getProfile,
        readAppContext,
        recentTaste,
        tasteSummary,
        choosableStyles,
        getFirstStyles,
        setFirstStyles,
        FIRST_STYLES_KEY,
        MAX_FIRST_STYLES,
        familiarity,
        styleAffinity,
        orderForMode,
        diversify,
        createPlacement,
        pickFeatured,
        pickRadar,
        pickReturnItems,
        pickStartHere,
        summarizeStyles,
    };
})(window);

