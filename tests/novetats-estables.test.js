import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// «Acabades de sortir» no pot dependre de per on s'ha carregat la portada: el camí de getPopularVideos()
// (loadVideosFromAPI, el de cada dia) ha de conservar els camps del feed que fan servir les estrenes.
const source = readFileSync('js/youtube.js', 'utf8');
const start = source.indexOf('async getPopularVideos(');
const end = source.indexOf('// Obtenir vídeos per categoria', start);
const method = source.slice(start, end).trim().replace(/,\s*$/, '');

describe('novetats estables', () => {
    it('getPopularVideos conserva l’any original, la pista Tema i el títol original', async () => {
        const ctx = { console: { log() {} }, FEED_URL: 'data/feed.json' };
        runInNewContext(
            `api = { feedLoaded: true, feedVideos: [], parseDuration: d => d, parseDurationSeconds: () => 0, getApiKey: () => '', ${method} };`,
            ctx
        );
        ctx.api.feedVideos = [
            {
                id: 'r1',
                title: 'Cançó',
                publishedAt: '2026-10-10T10:00:00Z',
                originalYear: 1978,
                originalYearConfidence: 'alta',
                topicTrack: true,
                originalTitle: 'Artista - Cançó (Videoclip oficial)',
                contentType: 'song',
            },
        ];
        const { items } = await ctx.api.getPopularVideos();
        expect(items[0]).toMatchObject({
            originalYear: 1978,
            originalYearConfidence: 'alta',
            topicTrack: true,
            originalTitle: 'Artista - Cançó (Videoclip oficial)',
            contentType: 'song',
        });
    });
});
