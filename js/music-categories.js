(function (root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.SegueixMusicCategories = api;
})(typeof window !== 'undefined' ? window : null, function (root) {
    'use strict';

    const DATA_URL = 'data/artistes-musica.json';
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

    function unique(values) {
        return [...new Set((values || []).map(v => String(v || '').trim()).filter(Boolean))];
    }

    function navigationCategoriesForGenres(genres) {
        const source = new Set(unique(genres));
        return CATEGORY_GROUPS
            .filter(group => group.genres.some(genre => source.has(genre)))
            .map(group => group.label);
    }

    function isCategoryEligibleVideo(video) {
        const raw = String(video?.contentType || '').trim().toLowerCase().replace(/-/g, '_');
        // Compatibilitat amb snapshots antics: abans el feed només contenia música acceptada.
        if (!raw) return true;
        return raw === 'song' || raw === 'live_song';
    }

    function registerArtist(artist) {
        if (!artist || artist.reviewStatus === 'rebutjat') return;
        const categories = navigationCategoriesForGenres(artist.genres || []);
        for (const channel of artist.youtube?.channels || []) {
            const id = String(channel?.id || '').trim();
            if (!id) continue;
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
        decorateChannel,
        decorateVideo
    };
});
