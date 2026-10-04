import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import archiveModule from '../scripts/lib/arxiu_musical.js';

// Vista d'un estil: les cançons de l'historial es barregen amb les del feed (mateixa targeta, amb visualitzacions)
// i les ordena el motor de selecció. Vegeu docs/PROBLEMES_I_SOLUCIONS.md (2026-10-04, «historial dins dels estils»).

const { buildStyleHistory, serializeStyleHistory } = archiveModule;
const app = readFileSync('js/app.js', 'utf8');
const youtube = readFileSync('js/youtube.js', 'utf8');

const song = (id, extra = {}) => ({
    id,
    title: `Cançó ${id}`,
    channelId: 'UC1',
    channelTitle: 'Artista',
    publishedAt: '2019-05-01T10:00:00Z',
    viewCount: 1234,
    contentType: 'song',
    durationSeconds: 200,
    categories: ['Pop'],
    ...extra,
});

describe('data/historial-musical.json', () => {
    it('només porta cançons publicades, compactes i amb les visualitzacions', () => {
        const out = buildStyleHistory([
            song('a'),
            song('b', { contentType: 'live_song', originalYear: 1998, topicTrack: true }),
            song('c', { contentType: 'other' }),
            song('d', { isShort: true }),
            song('e', { durationSeconds: 0 }),
            song('f', { channelId: '' }),
            song('a'),
        ]);
        expect(out.map(video => video.id)).toEqual(['a', 'b']);
        expect(out[0]).toEqual({
            id: 'a',
            title: 'Cançó a',
            channelId: 'UC1',
            publishedAt: '2019-05-01',
            viewCount: 1234,
            durationSeconds: 200,
        });
        expect(out[1]).toMatchObject({ contentType: 'live_song', originalYear: 1998, topicTrack: true });
    });

    it('es pot llegir com a JSON (una cançó per línia)', () => {
        const text = serializeStyleHistory(buildStyleHistory([song('a'), song('b')]), '2026-10-04T00:00:00.000Z');
        expect(JSON.parse(text).videos).toHaveLength(2);
        expect(text.split('\n').length).toBeGreaterThan(3);
    });

    it('el fitxer publicat existeix i té visualitzacions a cada cançó', () => {
        const data = JSON.parse(readFileSync('data/historial-musical.json', 'utf8'));
        expect(data.videos.length).toBeGreaterThan(1000);
        expect(data.videos.every(video => Number.isFinite(video.viewCount))).toBe(true);
    });
});

describe('vista d’un estil', () => {
    it('barreja l’historial abans de filtrar i l’ordena amb el motor', () => {
        expect(app).toMatch(
            /if \(isStyleHistoryView\(selectedCategory\)\) \{\s*videosToFilter = mergeStyleHistory\(videosToFilter\);/
        );
        expect(app).toMatch(
            /isStyleHistoryView\(selectedCategory\) && SegueixApp\.features\.musicSelection\?\.isEnabled\?\.\(\)[\s\S]{0,120}rankRecommendedWithEngine\(filtered\)/
        );
        // La llista es pinta una sola vegada, amb l'historial ja carregat
        expect(app).toMatch(/async function renderFeedAfterCategoryChange\(\) \{[\s\S]*?await waitForStyleHistory\(\)/);
        expect(youtube).toContain("const STYLE_HISTORY_URL = 'data/historial-musical.json'");
    });

    it('ja no hi ha la secció separada d’arxiu amb la icona d’historial', () => {
        expect(app).not.toContain('renderCategoryHistorySection');
        expect(app).not.toContain('createArchiveVideoCard');
        expect(app).not.toContain('archive-history-badge');
    });
});
