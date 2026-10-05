(function (root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.SegueixMusicCategories = api;
})(typeof window !== 'undefined' ? window : null, function (root) {
    'use strict';

    const DATA_URL = 'data/artistes-musica.json';
    const CLASSIC_URL = 'data/musica-classica.json';
    // Ordre dels estils a tota l'app (xips, files, selectors). «Urban» agrupa el gènere «Urbana» de la base d'artistes.
    const CATEGORY_GROUPS = [
        { label: 'Urban', genres: ['Urbana'] },
        { label: 'Pop', genres: ['Pop'] },
        { label: 'Rock', genres: ['Rock'] },
        { label: "Cançó d'autor", genres: ["Cançó d'autor"] },
        { label: 'Indie', genres: ['Indie / Alternativa'] },
        { label: 'Rap / Hip-hop', genres: ['Rap / Hip-hop'] },
        { label: 'Folk i arrel', genres: ['Folk i arrel'] },
        { label: 'Electrònica', genres: ['Electrònica'] },
        { label: 'Ska / Reggae', genres: ['Ska / Reggae'] },
        { label: 'Rumba / Mestissatge', genres: ['Rumba / Mestissatge'] },
        { label: 'Punk / Metal', genres: ['Punk', 'Metal'] },
        { label: 'Jazz / Blues', genres: ['Jazz / Blues'] },
        { label: 'Infantil', genres: ['Infantil'] },
        { label: 'Altres estils', genres: ['Funk / Soul / R&B', 'Experimental / Avantguarda', 'Coral / Vocal', 'Altres'] },
    ];

    const byChannel = new Map();
    const artistByChannel = new Map();
    // Metadades del canal dins de la identitat d'artista: permet triar un únic representant visual
    // (primary > official > Topic) sense perdre cap canal intern.
    const artistChannelMetaByChannel = new Map();
    // Identitat persistent de l'artista per canal: canals oficials i Topic d'un mateix artista comparteixen clau.
    const artistKeyByChannel = new Map();
    // Categoria principal de l'artista per canal: la del PRIMER gènere de la base d'artistes (l'ordre de
    // `categories` és el de CATEGORY_GROUPS, no el de prioritat de l'artista).
    const primaryByChannel = new Map();
    // Noms de l'artista per canal (nom de la base d'artistes i àlies): per treure'l dels títols de les cançons.
    const namesByChannel = new Map();
    // Nom que es mostra a l'app per canal (`displayName` de l'artista, editat a revisio-artistes.html): substitueix el nom
    // del canal de YouTube («alfredgarcia» → «Alfred García»). El del canal es conserva a `originalChannelTitle`.
    const displayByChannel = new Map();
    let ready = false;
    let initPromise = null;

    // Música «realment antiga»: artistes de data/musica-classica.json + vídeos de fa `classicYears` anys o més.
    const classicNames = new Set();
    const classicChannels = new Set();
    let classicYears = 8;

    function normalizeName(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    async function loadClassic() {
        classicNames.clear();
        classicChannels.clear();
        try {
            const response = await fetch(root?.appDataUrl?.(CLASSIC_URL) || CLASSIC_URL, { cache: 'no-store' });
            if (!response.ok) return;
            const data = await response.json();
            (Array.isArray(data?.artistes) ? data.artistes : []).forEach(name => classicNames.add(normalizeName(name)));
            const years = Number(data?.anysAntic);
            if (Number.isFinite(years) && years > 0) classicYears = years;
        } catch (error) {
            // Sense la llista simplement no hi ha artistes clàssics (l'edat del vídeo continua comptant)
        }
    }

    // Noms antics d'una categoria que encara poden venir del feed o de dades desades: «Urbana» ara és «Urban».
    const CATEGORY_ALIASES = { urbana: 'Urban' };

    function canonicalCategory(value) {
        const text = String(value || '').trim();
        return CATEGORY_ALIASES[text.toLowerCase()] || text;
    }

    function unique(values) {
        return [...new Set((values || []).map(v => String(v || '').trim()).filter(Boolean))];
    }

    function navigationCategoriesForGenres(genres) {
        const source = new Set(unique(genres));
        return CATEGORY_GROUPS.filter(group => group.genres.some(genre => source.has(genre))).map(group => group.label);
    }

    const MIN_SONG_SECONDS = 60;

    function isCategoryEligibleVideo(video) {
        const raw = String(video?.contentType || '')
            .trim()
            .toLowerCase()
            .replace(/-/g, '_');
        // Compatibilitat amb snapshots antics: abans el feed només contenia música acceptada.
        if (!raw) return true;
        if (raw !== 'song' && raw !== 'live_song') return false;
        // Una cançó de menys d'un minut és un teaser/fragment mal classificat.
        const seconds = Number(video?.durationSeconds) || 0;
        return !(seconds > 0 && seconds < MIN_SONG_SECONDS);
    }

    function registerArtist(artist) {
        if (!artist || artist.reviewStatus === 'rebutjat') return;
        const categories = navigationCategoriesForGenres(artist.genres || []);
        for (const channel of artist.youtube?.channels || []) {
            const id = String(channel?.id || '').trim();
            if (!id) continue;
            if (classicNames.has(normalizeName(artist.name))) classicChannels.add(id);
            // Clau estable: Wikidata > MusicBrainz > nom normalitzat (mai el canal, que pot canviar o duplicar-se).
            if (!artistKeyByChannel.has(id)) {
                const stable = artist.wikidataId
                    ? 'wd:' + artist.wikidataId
                    : artist.musicbrainzId
                      ? 'mb:' + artist.musicbrainzId
                      : 'n:' + normalizeName(artist.name);
                artistKeyByChannel.set(id, stable.toLowerCase());
            }
            if (!primaryByChannel.has(id)) {
                const primary =
                    navigationCategoriesForGenres((artist.genres || []).slice(0, 1))[0] || categories[0] || '';
                if (primary) primaryByChannel.set(id, primary);
            }
            byChannel.set(id, unique([...(byChannel.get(id) || []), ...categories]));
            namesByChannel.set(
                id,
                unique([artist.name, channel.name, ...(Array.isArray(artist.aliases) ? artist.aliases : [])])
            );
            const display = String(artist.displayName || '').trim();
            if (display) displayByChannel.set(id, display);
            const artistName = artist.name || channel.name || '';
            artistByChannel.set(id, {
                name: artistName,
                genres: unique(artist.genres || []),
                categories: unique([...(byChannel.get(id) || [])]),
            });
            artistChannelMetaByChannel.set(id, {
                artistName,
                displayName: display || artistName,
                type: String(channel?.type || ''),
                primary: Boolean(channel?.primary),
            });
        }
    }

    async function init() {
        if (ready) return true;
        if (initPromise) return initPromise;
        initPromise = (async () => {
            try {
                const url = root?.appDataUrl?.(DATA_URL) || DATA_URL;
                const response = await fetch(url, { cache: 'no-store' });
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const data = await response.json();
                await loadClassic();
                byChannel.clear();
                artistKeyByChannel.clear();
                primaryByChannel.clear();
                artistByChannel.clear();
                artistChannelMetaByChannel.clear();
                namesByChannel.clear();
                displayByChannel.clear();
                for (const artist of data.artists || []) registerArtist(artist);
                ready = true;
                return true;
            } catch (error) {
                console.warn('Segueix Música: no s’ha pogut carregar la taxonomia musical:', error.message);
                ready = false;
                return false;
            }
        })();
        return initPromise;
    }

    function categoriesForChannel(channelId) {
        return [...(byChannel.get(String(channelId || '')) || [])];
    }

    function isClassicChannel(channelId) {
        return classicChannels.has(String(channelId || ''));
    }

    // Categoria principal assignada a l'artista d'un canal (buit si el canal no és a la base d'artistes).
    function primaryCategoryForChannel(channelId) {
        return primaryByChannel.get(String(channelId || '')) || '';
    }

    // Clau d'artista persistent d'un canal (buit si el canal no és a la base d'artistes).
    function artistKeyForChannel(channelId) {
        return artistKeyByChannel.get(String(channelId || '')) || '';
    }

    // Vídeo d'un artista de la llista d'antics (aproximació conservadora quan no se'n sap l'any original).
    function isClassicArtistVideo(video) {
        return isClassicChannel(video?.channelId || video?.sourceChannelId);
    }

    // Antic = artista clàssic o vídeo publicat fa `classicYears` anys o més.
    function isClassicVideo(video) {
        if (isClassicChannel(video?.channelId || video?.sourceChannelId)) return true;
        const published = new Date(video?.publishedAt || video?.uploadDate || '').getTime();
        if (!Number.isFinite(published) || published <= 0) return false;
        return Date.now() - published >= classicYears * 365.25 * 24 * 3600 * 1000;
    }

    function isMusicChannel(channelId) {
        return artistByChannel.has(String(channelId || ''));
    }

    // Nom a mostrar d'un canal (buit si no n'hi ha cap d'editat).
    function displayNameForChannel(channelId) {
        return displayByChannel.get(String(channelId || '')) || '';
    }

    // Nom canònic de l'artista, compartit per tots els seus canals.
    function artistDisplayNameForChannel(channelId) {
        const id = String(channelId || '');
        return displayNameForChannel(id) || artistChannelMetaByChannel.get(id)?.artistName || '';
    }

    function artistChannelMeta(channelId) {
        const meta = artistChannelMetaByChannel.get(String(channelId || ''));
        return meta ? { ...meta } : null;
    }

    function decorateChannel(channel) {
        if (!channel) return channel;
        const id = channel.id || channel.channelId;
        const display = displayNameForChannel(id);
        return {
            ...channel,
            ...(display && channel.name !== display
                ? { name: display, originalName: channel.originalName || channel.name }
                : {}),
            categories: unique([
                ...(Array.isArray(channel.categories)
                    ? channel.categories
                    : channel.category
                      ? [channel.category]
                      : []
                ).map(canonicalCategory),
                ...categoriesForChannel(id),
            ]),
        };
    }

    // Posa a un vídeo el nom a mostrar de l'artista (`channelTitle`); el de YouTube queda a `originalChannelTitle`.
    function applyDisplayName(video) {
        if (!video) return video;
        const id = String(video.channelId || video.sourceChannelId || video.snippet?.channelId || '');
        const display = displayNameForChannel(id);
        if (!display || video.channelTitle === display) return video;
        return {
            ...video,
            channelTitle: display,
            originalChannelTitle: video.originalChannelTitle || video.channelTitle || video.snippet?.channelTitle || '',
            ...(video.snippet ? { snippet: { ...video.snippet, channelTitle: display } } : {}),
        };
    }

    // Títol net: sense el nom de l'artista ni «videoclip / vídeo / oficial» (l'original queda a `originalTitle`).
    // `extraNames`: altres noms de l'artista (p. ex. els del canal al feed).
    function cleanVideoTitle(video, extraNames = []) {
        const cleaner = root?.SegueixSongTitle;
        if (!video) return video;
        if (!cleaner?.cleanVideo) return applyDisplayName(video);
        const id = String(video.channelId || video.sourceChannelId || video.snippet?.channelId || '');
        // El títol es neteja amb el nom de YouTube i, després, el nom de l'artista passa al nom a mostrar
        return applyDisplayName(
            cleaner.cleanVideo(video, [
                ...(namesByChannel.get(id) || []),
                ...(Array.isArray(extraNames) ? extraNames : []),
            ])
        );
    }

    function decorateVideo(rawVideo, extraNames = []) {
        if (!rawVideo) return rawVideo;
        const video = cleanVideoTitle(rawVideo, extraNames);
        return {
            ...video,
            categories: unique([
                ...(Array.isArray(video.categories) ? video.categories : video.category ? [video.category] : []).map(
                    canonicalCategory
                ),
                ...categoriesForChannel(video.channelId || video.sourceChannelId || video.snippet?.channelId),
            ]),
        };
    }

    return {
        CATEGORY_GROUPS,
        canonicalCategory,
        init,
        isReady: () => ready,
        categoriesForChannel,
        navigationCategoriesForGenres,
        isCategoryEligibleVideo,
        isMusicChannel,
        isClassicChannel,
        isClassicVideo,
        isClassicArtistVideo,
        artistKeyForChannel,
        primaryCategoryForChannel,
        displayNameForChannel,
        artistDisplayNameForChannel,
        artistChannelMeta,
        decorateChannel,
        decorateVideo,
        cleanVideoTitle,
    };
});

