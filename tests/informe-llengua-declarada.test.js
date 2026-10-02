import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isOk, isDistributed, buildReport, toCsv } = require('../scripts/informe_llengua_declarada.js');

const song = (id, channelId, channelTitle, audio, meta, extra = {}) => ({
    id,
    channelId,
    channelTitle,
    title: `Cançó ${id}`,
    contentType: 'song',
    durationSeconds: 200,
    defaultAudioLanguage: audio,
    defaultLanguage: meta,
    ...extra,
});

describe('informe de llengua declarada', () => {
    it('català, aranès i instrumental estan bé; la resta (o res) cal corregir-ho', () => {
        expect(isOk('ca')).toBe(true);
        expect(isOk('ca-ES')).toBe(true);
        expect(isOk('oc')).toBe(true);
        expect(isOk('zxx')).toBe(true);
        for (const value of ['', undefined, 'und', 'es', 'es-ES', 'en']) expect(isOk(value)).toBe(false);
    });

    it('els temes de distribuïdora es corregeixen a la distribuïdora, no a YouTube Studio', () => {
        expect(isDistributed({ description: 'Provided to YouTube by The Orchard\n\nCançó · Artista' })).toBe(true);
        expect(isDistributed({ channelTitle: 'Artista - Topic' })).toBe(true);
        expect(isDistributed({ channelTitle: 'Artista', description: 'Videoclip oficial' })).toBe(false);
    });

    it('agrupa els canals d’un mateix artista, compta només cançons publicades i fa el CSV', () => {
        const feed = {
            videos: [
                song('a', 'c1', 'Els Pets', '', 'ca'),
                song('b', 'c2', 'Els Pets - Topic', 'ca', 'ca'),
                song('c', 'c2', 'Els Pets - Topic', 'und', 'es'),
                song('d', 'c3', 'Altre', 'ca', 'ca'),
                song('e', 'c3', 'Altre', 'es', 'es', { isShort: true }),
                song('f', 'c3', 'Altre', 'es', 'es', { contentType: 'interview' }),
                song('g', 'c3', 'Altre', 'es', 'es'),
            ],
        };
        const names = new Map([
            ['c1', 'Els Pets'],
            ['c2', 'Els Pets'],
        ]);
        const report = buildReport(feed, new Set(['g']), names);
        expect(report.songs).toHaveLength(4);
        expect(report.artists).toHaveLength(1);
        expect(report.artists[0]).toMatchObject({ artist: 'Els Pets', total: 3, audio: 2, meta: 1, distributed: 1 });
        const csv = toCsv(report).trim().split('\n');
        expect(csv).toHaveLength(3);
        expect(csv[1]).toContain('https://studio.youtube.com/video/a/edit');
    });
});
