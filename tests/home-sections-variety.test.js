import { describe, it, expect } from 'vitest';
import { loadScript } from './setup.js';

const helpers = loadScript('js/utils/helpers.js', { YouTubeAPI: undefined });
const ctx = loadScript('js/features/home-sections.js', {
    SegueixApp: { features: {}, state: {} },
    getVideoArtistKey: helpers.getVideoArtistKey,
    spreadVideosByArtist: helpers.spreadVideosByArtist,
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
});
