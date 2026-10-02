import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
    emptyState,
    updatePending,
    seedReviewed,
    applyReview,
    serializeState,
    detectNonCatalan,
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

    it('descarta sol el títol amb marques que el català no fa servir', () => {
        expect(detectNonCatalan('La Revolución')).toMatch(/castellà/);
        expect(detectNonCatalan('Son tus ojos dos puñales - Anna Ferrer', ['Anna Ferrer'])).toMatch(/ñ/);
        expect(detectNonCatalan('¡Bomba a Bomba!')).toMatch(/¿/);
        expect(detectNonCatalan('Tres lágrimas')).toMatch(/á/);
        expect(detectNonCatalan('Grândola, vila morena')).toMatch(/portuguès/);
        expect(detectNonCatalan('Doraemon No Uta (ドラえもんのうた)')).toBe('');
        expect(detectNonCatalan('ドラえもんのうた')).toMatch(/alfabet/);
        // Català (també amb accents oberts i tancats, ela geminada i ce trencada)
        for (const title of ['Què és el que vols', 'Sóc de la terra', 'La cançó del lladre', 'Col·lecció', 'Així']) {
            expect(detectNonCatalan(title), title).toBe('');
        }
        // No es miren els artistes, les col·laboracions ni el context entre parèntesis
        expect(detectNonCatalan('PAULA MONTALBÁN - 3. ERRORS', ['Paula Montalbán'])).toBe('');
        expect(detectNonCatalan('Tot és més fàcil - Sara Roy ft.Miki Núñez (A)MAR', ['Sara Roy'])).toBe('');
        expect(detectNonCatalan("Txarango - 17 Com una lluna a l'aigua_feat. Iñaki Marquiegui", ['Txarango'])).toBe('');
        expect(detectNonCatalan("Una Lluna A L'Aigua (Operación Triunfo 2018)")).toBe('');
        expect(detectNonCatalan('EL CAMÍ - Lildami, Miki Núñez', ['Lildami', 'Miki Núñez'])).toBe('');
    });

    it('les descartades surten del feed però queden al document per si cal recuperar-les', () => {
        const videos = [song('ca', { title: 'Bon dia' }), song('es', { title: 'La Revolución' })];
        const { state, added, discarded, discardedIds } = updatePending(emptyState(), videos);
        expect(added).toBe(1);
        expect(discarded).toBe(1);
        expect([...discardedIds]).toEqual(['es']);
        expect(state.descartades[0]).toMatchObject({ id: 'es', motiu: '-ción (castellà)' });
        // A la generació següent la descartada ja no és al feed, però continua al document
        const next = updatePending(state, [videos[0]]);
        expect(next.state.descartades.map(item => item.id)).toEqual(['es']);
        expect(next.discarded).toBe(0);
    });

    it('en revisar, les descartades s’amaguen menys les recuperades', () => {
        const { state } = updatePending(emptyState(), [
            song('ca', { title: 'Bon dia' }),
            song('es', { title: 'La Revolución' }),
            song('viñarock', { title: 'Al Viñarock 2014' }),
        ]);
        const result = applyReview(state, { videoIds: [] }, [], { rescueIds: ['viñarock'] });
        expect(result.unknown).toEqual([]);
        expect(result.hidden.videoIds).toEqual(['es']);
        expect(result.rescuedCount).toBe(1);
        expect(result.state.descartades).toEqual([]);
        expect(result.state.revisades).toEqual(['ca', 'es', 'viñarock']);
        // La recuperada torna al feed i ja no es descarta
        expect(updatePending(result.state, [song('viñarock', { title: 'Al Viñarock 2014' })]).discarded).toBe(0);
        expect(applyReview(state, { videoIds: [] }, [], { rescueIds: ['ca'] }).unknown).toEqual(['ca']);
    });
});
