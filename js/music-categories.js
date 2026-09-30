(function (root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.SegueixMusicCategories = api;
})(typeof window !== 'undefined' ? window : null, function (root) {
    'use strict';

    const DATA_URL = 'data/artistes-musica.json';
    const CLASSIC_URL = 'data/musica-classica.json';
    const CATEGORY_GROUPS = [
        { label: 'Pop', genres: ['Pop'] },
        { label: 'Rock', genres: ['Rock'] },
        { label: 'Indie', genres: ['Indie / Alternativa'] },
        { label: 'Urbana', genres: ['Urbana'] },
        { label: 'Rap / Hip-hop', genres: ['Rap / Hip-hop'] },
        { label: 'Folk i arrel', genres: ['Folk i arrel'] },
        { label: "Cançó d'autor", genres: ["Cançó d'autor"] },
        { label: 'Electrònica', genres: ['Electrònica'] },
        { label: 'Ska / Reggae', genres: ['Ska / Reggae'] },
        { label: 'Rumba / Mestissatge', genres: ['Rumba / Mestissatge'] },
        { label: 'Punk / Metal', genres: ['Punk', 'Metal'] },
        { label: 'Jazz / Blues', genres: ['Jazz / Blues'] },
        { label: 'Clàssica', genres: ['Clàssica i contemporània', 'Coral / Vocal'] },
        { label: 'Infantil', genres: ['Infantil'] },
        { label: 'Altres estils', genres: ['Funk / Soul / R&B', 'Experimental / Avantguarda', 'Altres'] }
    ];

    const byChannel = new Map();
    const artistByChannel = new Map();
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

    function unique(values) {
        return [...new Set((values || []).map(v => String(v || '').trim()).filter(Boolean))];
    }

    function navigationCategoriesForGenres(genres) {
        const source = new Set(unique(genres));
        return CATEGORY_GROUPS
            .filter(group => group.genres.some(genre => source.has(genre)))
            .map(group => group.label);
    }

    const MIN_SONG_SECONDS = 60;

    function isCategoryEligibleVideo(video) {
        const raw = String(video?.contentType || '').trim().toLowerCase().replace(/-/g, '_');
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
            byChannel.set(id, unique([...(byChannel.get(id) || []), ...categories]));
            artistByChannel.set(id, {
                name: artist.name || channel.name || '',
                genres: unique(artist.genres || []),
                categories: unique([...(byChannel.get(id) || [])])
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
                artistByChannel.clear();
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

    function decorateChannel(channel) {
        if (!channel) return channel;
        return {
            ...channel,
            categories: unique([
                ...(Array.isArray(channel.categories) ? channel.categories : (channel.category ? [channel.category] : [])),
                ...categoriesForChannel(channel.id || channel.channelId)
            ])
        };
    }

    function decorateVideo(video) {
        if (!video) return video;
        return {
            ...video,
            categories: unique([
                ...(Array.isArray(video.categories) ? video.categories : (video.category ? [video.category] : [])),
                ...categoriesForChannel(video.channelId || video.sourceChannelId || video.snippet?.channelId)
            ])
        };
    }

    return {
        CATEGORY_GROUPS,
        init,
        isReady: () => ready,
        categoriesForChannel,
        navigationCategoriesForGenres,
        isCategoryEligibleVideo,
        isMusicChannel,
        isClassicChannel,
        isClassicVideo,
        decorateChannel,
        decorateVideo
    };
});
