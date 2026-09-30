import { describe, it, expect } from 'vitest';
import { loadScript } from './setup.js';

const helpers = loadScript('js/utils/helpers.js', { YouTubeAPI: undefined });
const ctx = loadScript('js/features/home-sections.js', {
    SegueixApp: { features: {}, state: {} },
    getVideoArtistKey: helpers.getVideoArtistKey,
    spreadVideosByArtist: helpers.spreadVideosByArtist,
    limitClassicFrequency: helpers.limitClassicFrequency,
});
const sections = (ctx.SegueixApp || ctx.window?.SegueixApp).features.homeSections;

describe('files de la portada amb varietat', () => {
    it('dóna oportunitat a cada artista i no repeteix consecutivament', () => {
        const now = Date.now();
        const videos = [];
        // Un artista molt prolífic amb els vídeos més nous, i cinc artistes més.
        for (let i = 0; i < 6; i++)
            videos.push({ id: `a${i}`, channelId: 'A', publishedAt: new Date(now - i * 1000).toISOString() });
        ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'].forEach((ch, i) =>
            videos.push({ id: ch, channelId: ch, publishedAt: new Date(now - (10 + i) * 1000).toISOString() })
        );
        const latest = sections
            .buildSections(videos, { channels: [] }, videos)
            .find(s => s.title === 'Últimes novetats');
        const channels = latest.videos.map(v => v.channelId);
        expect(new Set(channels).size).toBe(13);
        for (let i = 1; i < channels.length; i++) expect(channels[i]).not.toBe(channels[i - 1]);
        expect(latest.videos[0].id).toBe('a0');
    });

    it("Novetats és cronològic i gran; les files d'estil s'ordenen per actualitat + escoltes", () => {
        const now = Date.now();
        const day = 86400000;
        const cats = { channels: [{ id: 'P', categories: ['Pop'] }] };
        // Cinc artistes: el més nou té poques escoltes, el més antic en té moltíssimes.
        const videos = [
            {
                id: 'nou',
                channelId: 'N',
                channelTitle: 'N',
                publishedAt: new Date(now - 1 * day).toISOString(),
                viewCount: 10,
            },
            {
                id: 'mig',
                channelId: 'M',
                channelTitle: 'M',
                publishedAt: new Date(now - 10 * day).toISOString(),
                viewCount: 100,
            },
            {
                id: 'vell',
                channelId: 'V',
                channelTitle: 'V',
                publishedAt: new Date(now - 25 * day).toISOString(),
                viewCount: 5000000,
            },
            {
                id: 'v2',
                channelId: 'W',
                channelTitle: 'W',
                publishedAt: new Date(now - 30 * day).toISOString(),
                viewCount: 50,
            },
            {
                id: 'v3',
                channelId: 'X',
                channelTitle: 'X',
                publishedAt: new Date(now - 40 * day).toISOString(),
                viewCount: 50,
            },
        ].map(v => ({ ...v, channelId: 'P' + v.channelId }));
        cats.channels = videos.map(v => ({ id: v.channelId, categories: ['Pop'] }));
        const built = sections.buildSections(videos, cats, videos);
        const latest = built.find(s => s.title === 'Últimes novetats');
        expect(latest.large).toBe(true);
        expect(latest.videos.map(v => v.id).slice(0, 3)).toEqual(['nou', 'mig', 'vell']);
        const pop = built.find(s => s.title === 'Pop / Rock');
        // A l'estil, la molt escoltada de fa 25 dies supera la nova amb 10 escoltes.
        expect(pop.videos.findIndex(v => v.id === 'vell')).toBeLessThan(pop.videos.findIndex(v => v.id === 'nou'));
    });
});
