import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
    emptyState,
    updatePending,
    seedReviewed,
    applyReview,
    serializeState,
} = require('../scripts/lib/revisio_idiomes.js');

const song = (id, extra = {}) => ({
    id,
    channelTitle: 'Artista',
    title: `Cançó ${id}`,
    contentType: 'song',
    publishedAt: '2026-10-01T10:00:00Z',
    ...extra,
});

describe("revisió d'idioma de les cançons noves", () => {
    it('afegeix només les cançons que no s’han revisat mai', () => {
        const state = seedReviewed(emptyState(), [song('a'), song('b')]);
        const { state: next, added } = updatePending(state, [song('a'), song('b'), song('c'), song('d')], {
            now: '2026-10-02T00:00:00Z',
        });
        expect(added).toBe(2);
        expect(next.pendents.map(item => item.id)).toEqual(['c', 'd']);
        expect(next.pendents[0]).toMatchObject({ artista: 'Artista', titol: 'Cançó c', publicada: '2026-10-01' });
        // Una segona generació no les repeteix
        expect(updatePending(next, [song('c'), song('d')]).added).toBe(0);
    });

    it('no hi posa Shorts, vídeos que no són cançons ni cançons ja amagades', () => {
        const { state } = updatePending(
            emptyState(),
            [
                song('short', { isShort: true }),
                song('entrevista', { contentType: 'other' }),
                song('amagada'),
                song('directe', { contentType: 'live_song' }),
            ],
            { hiddenIds: new Set(['amagada']) }
        );
        expect(state.pendents.map(item => item.id)).toEqual(['directe']);
    });

    it('de les pistes «Provided to YouTube» en guarda el disc', () => {
        const description = 'Provided to YouTube by RGB\n\nBon dia · Els Pets\n\nBrillant\n\n℗ 1997 RGB';
        const { state } = updatePending(emptyState(), [song('t', { description })]);
        expect(state.pendents[0].descripcio).toBe('Disc: Brillant');
    });

    it('treu de les pendents les que ja no són al feed', () => {
        const { state } = updatePending(emptyState(), [song('a'), song('b')]);
        expect(updatePending(state, [song('a')]).state.pendents.map(item => item.id)).toEqual(['a']);
    });

    it('en aplicar la revisió amaga les triades i buida les pendents', () => {
        const { state } = updatePending(emptyState(), [song('ca'), song('es'), song('en')]);
        const result = applyReview(state, { videoIds: ['vella'] }, ['es', 'en']);
        expect(result.unknown).toEqual([]);
        expect(result.hidden.videoIds).toEqual(['vella', 'es', 'en']);
        expect(result.hiddenCount).toBe(2);
        expect(result.keptCount).toBe(1);
        expect(result.state.pendents).toEqual([]);
        expect(result.state.revisades).toEqual(['ca', 'en', 'es']);
        // La que es queda (en català) no torna a sortir
        expect(updatePending(result.state, [song('ca')]).added).toBe(0);
        expect(applyReview(state, { videoIds: [] }, ['no-hi-és']).unknown).toEqual(['no-hi-és']);
    });

    it('es desa en un JSON que es torna a llegir igual', () => {
        const { state } = updatePending(seedReviewed(emptyState(), [song('a')]), [song('a'), song('b')], {
            now: '2026-10-02T00:00:00Z',
        });
        expect(JSON.parse(serializeState(state))).toEqual(state);
        expect(JSON.parse(serializeState(emptyState()))).toEqual(emptyState());
    });
});
