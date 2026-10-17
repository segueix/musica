import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const {
    emptyState,
    updatePending,
    seedReviewed,
    applyReview,
    serializeState,
    detectNonCatalan,
    loadPolicy,
} = require('../scripts/lib/revisio_idiomes.js');
const { createPolicy, recordingKey } = require('../scripts/lib/politica_idiomes.js');
const registry = {
    schemaVersion: 1,
    vigilats: [
        {
            artista: 'Vigilat',
            aliases: ['Vigilat oficial'],
            canals: ['watch', 'watch-topic'],
        },
    ],
    confianca: [{ artista: 'Habitual', aliases: [], canals: ['trusted', 'trusted-topic'] }],
    discsVerificats: [],
};
const policy = createPolicy(registry);
const now = '2026-10-12T12:00:00Z';
const update = (state, videos, extra = {}) => updatePending(state, videos, { policy, now, ...extra });
const song = (id, extra = {}) => ({
    id,
    channelId: 'watch',
    channelTitle: 'Vigilat',
    title: `Cançó ${id}`,
    contentType: 'song',
    publishedAt: '2026-10-01T10:00:00Z',
    ...extra,
});
const entry = (id, extra = {}) => ({
    id,
    artista: 'Vigilat',
    titol: `Cançó ${id}`,
    ...extra,
});

describe('filtre d’idioma per artista', () => {
    it('revisa oficial i Topic del vigilat i registra la confiança sense verificar lletres', () => {
        const { state } = update(emptyState(), [
            song('a'),
            song('b', { channelId: 'watch-topic', channelTitle: 'Un nom canviat' }),
            song('c', { channelId: 'trusted', channelTitle: 'Habitual' }),
            song('d', {
                channelId: 'trusted-topic',
                channelTitle: 'Habitual - Topic',
            }),
        ]);
        expect(state.pendents.map((x) => x.id).sort()).toEqual(['a', 'b']);
        expect(state.acceptadesPerArtista.map((x) => x.id).sort()).toEqual(['c', 'd']);
        expect(state.acceptadesPerArtista.every((x) => x.criteri === 'confianca-artista')).toBe(true);
        expect(state.revisades).toEqual([]);
        expect(state.decisions).toEqual([]);
    });

    it('només crea una alta per artista nou, sense confiar en un homònim', () => {
        const { state } = update(emptyState(), [
            song('a', { channelId: 'unknown', channelTitle: 'Habitual' }),
            song('b', { channelId: 'unknown', channelTitle: 'Habitual' }),
        ]);
        expect(state.pendents).toEqual([]);
        expect(state.acceptadesPerArtista).toEqual([]);
        expect(state.artistesPendents).toHaveLength(1);
        expect(state.artistesPendents[0].canals).toEqual(['unknown']);
    });

    it('dos canals assignats al mateix artista nou generen una sola classificació', () => {
        const p = createPolicy(registry, {
            artists: [
                {
                    name: 'Nou',
                    youtube: { channels: [{ id: 'nou-oficial' }, { id: 'nou-topic' }] },
                },
            ],
        });
        const result = update(
            emptyState(),
            [song('a', { channelId: 'nou-oficial' }), song('b', { channelId: 'nou-topic' })],
            { policy: p }
        );
        expect(result.state.artistesPendents).toHaveLength(1);
        expect(result.state.artistesPendents[0].canals).toEqual(['nou-oficial', 'nou-topic']);
    });

    it('comparteix política amb un Topic assignat després i resol les altes classificades', () => {
        const db = {
            artists: [
                {
                    name: 'Habitual',
                    youtube: {
                        channels: [{ id: 'new-topic', name: 'Habitual - Topic' }],
                    },
                },
            ],
        };
        const p = createPolicy(registry, db);
        expect(p.resolve(song('a', { channelId: 'new-topic' })).mode).toBe('confianca');
        const before = update(emptyState(), [song('a', { channelId: 'new-topic', channelTitle: 'Habitual' })]).state;
        const after = update(before, [song('a', { channelId: 'new-topic' })], {
            policy: p,
        }).state;
        expect(after.artistesPendents).toEqual([]);
        expect(after.acceptadesPerArtista).toHaveLength(1);
    });

    it('una absència o corrupció del registre no aprova tot el catàleg', () => {
        expect(() => createPolicy(null)).toThrow();
        expect(() => createPolicy({ schemaVersion: 1 })).toThrow();
    });

    it('un títol sospitós només aporta un indici, fins i tot en un artista vigilat', () => {
        const { state, discardedIds } = update(emptyState(), [
            song('a', { title: 'La Revolución' }),
            song('b', { channelId: 'trusted', title: 'Al Viñarock' }),
        ]);
        expect(state.pendents[0]).toMatchObject({
            id: 'a',
            indici: '-ción (castellà)',
        });
        expect(state.acceptadesPerArtista[0].id).toBe('b');
        expect(state.descartades).toEqual([]);
        expect(discardedIds.size).toBe(0);
        expect(detectNonCatalan('Doraemon No Uta (ドラえもんのうた)')).toBe('');
        expect(detectNonCatalan('Tot és més fàcil - Sara Roy ft.Miki Núñez (A)MAR', ['Sara Roy'])).toBe('');
    });

    it('migra els descartaments antics sense excloure’ls i preserva les exclusions/decisions', () => {
        const before = {
            ...emptyState(),
            pendents: [entry('a'), entry('hidden'), entry('done')],
            descartades: [
                entry('b', {
                    artista: 'Habitual',
                    titol: 'Ballarines Mecániques',
                    motiu: 'á',
                }),
                entry('c', { titol: 'Demá', motiu: 'á' }),
            ],
            revisades: ['done'],
        };
        const { state, discardedIds } = update(before, [], {
            hiddenIds: new Set(['hidden']),
        });
        expect(state.pendents.map((x) => x.id).sort()).toEqual(['a', 'c']);
        expect(state.acceptadesPerArtista.map((x) => x.id)).toEqual(['b']);
        expect(state.revisades).toEqual(['done']);
        expect(state.pendents.find((x) => x.id === 'c').motiuAnterior).toBe('á');
        expect(discardedIds.size).toBe(0);
        expect(update(state, [], { hiddenIds: new Set(['hidden']) }).state).toEqual(state);
        expect(JSON.parse(serializeState(state))).toEqual(state);
    });

    it('la confiança és revocable sense esborrar revisions explícites', () => {
        const first = update(emptyState(), [song('a', { channelId: 'trusted', channelTitle: 'Habitual' })]).state;
        const p = createPolicy({
            ...registry,
            vigilats: [...registry.vigilats, ...registry.confianca],
            confianca: [],
        });
        const next = update(first, [], { policy: p }).state;
        expect(next.acceptadesPerArtista).toEqual([]);
        expect(next.pendents.map((x) => x.id)).toEqual(['a']);
        const reviewed = applyReview(next, { videoIds: [] }, [], {
            keepIds: ['a'],
            now,
        }).state;
        expect(update(reviewed, [song('a', { channelId: 'trusted' })], { policy: p }).state.pendents).toEqual([]);
    });

    it('no torna a posar revisades, ocultes, Shorts ni contingut no musical a la cua', () => {
        const before = seedReviewed(emptyState(), [song('done')]);
        const { state } = update(
            before,
            [
                song('done'),
                song('hidden'),
                song('short', { isShort: true }),
                song('other', { contentType: 'other' }),
                song('live', { contentType: 'live_song' }),
            ],
            { hiddenIds: new Set(['hidden']) }
        );
        expect(state.pendents.map((x) => x.id)).toEqual(['live']);
    });

    it('guarda el disc de la descripció i no perd dubtes en actualitzacions parcials', () => {
        const first = update(emptyState(), [
            song('a', {
                description: 'Provided to YouTube by RGB\n\nBon dia · Vigilat\n\nBrillant\n\n℗ 1997 RGB',
            }),
        ]).state;
        expect(first.pendents[0].descripcio).toBe('Disc: Brillant');
        expect(update(first, []).state).toEqual(first);
    });
});

describe('decisions explícites i memòria', () => {
    it('una revisió parcial deixa els altres dubtes pendents i no amaga descartaments automàtics antics', () => {
        const before = update(emptyState(), [song('ca'), song('es'), song('dubte')]).state;
        before.descartades = [entry('antic', { motiu: 'ñ' })];
        const result = applyReview(before, { videoIds: ['preexistent'] }, ['es'], {
            keepIds: ['ca'],
            now,
        });
        expect(result.unknown).toEqual([]);
        expect(result.hidden.videoIds).toEqual(['preexistent', 'es']);
        expect(result.state.pendents.map((x) => x.id)).toEqual(['dubte']);
        expect(result.state.descartades.map((x) => x.id)).toEqual(['antic']);
        expect(result.state.revisades).toEqual(['ca', 'es']);
        expect(result.state.decisions).toHaveLength(2);
        expect(applyReview(before, { videoIds: [] }, ['inexistent']).unknown).toEqual(['inexistent']);
        expect(applyReview(before, { videoIds: [] }, ['ca'], { keepIds: ['ca'] }).unknown).toEqual(['ca']);
    });

    it('reutilitza només decisions autoritzades amb font i sense marques de versió', () => {
        const first = update(emptyState(), [song('a', { title: 'Llum' })]).state;
        const reviewed = applyReview(first, { videoIds: [] }, [], {
            keepIds: ['a'],
            source: 'https://artist.example/lletra',
            reuseWorks: true,
            now,
        }).state;
        const result = update(reviewed, [
            song('topic', { channelId: 'watch-topic', title: 'Llum' }),
            song('remix', { title: 'Llum (Remix)' }),
            song('live', { title: 'Llum', contentType: 'live_song' }),
            song('feat', { title: 'Llum feat. Una altra veu' }),
        ]);
        expect(result.state.pendents.map((x) => x.id).sort()).toEqual(['feat', 'live', 'remix']);
        expect(result.state.revisades).toContain('topic');
        expect(result.reused).toBe(1);
        const unshared = applyReview(first, { videoIds: [] }, [], {
            keepIds: ['a'],
            now,
        }).state;
        expect(update(unshared, [song('topic', { title: 'Llum' })]).state.pendents).toHaveLength(1);
    });

    it('una exclusió contrastada es reaplica al duplicat però no a un altre artista', () => {
        const first = update(emptyState(), [song('a', { title: 'Obra' })]).state;
        const reviewed = applyReview(first, { videoIds: ['old'] }, ['a'], {
            source: 'https://artist.example/lletra',
            reuseWorks: true,
            now,
        }).state;
        const result = update(reviewed, [
            song('copy', { title: 'Obra' }),
            song('other', { channelId: 'trusted', title: 'Obra' }),
        ]);
        expect([...result.discardedIds]).toEqual(['copy']);
        expect(result.state.acceptadesPerArtista.map((x) => x.id)).toEqual(['other']);
    });

    it('un disc verificat només resol els IDs comprovats i l’artista exacte', () => {
        const p = createPolicy({
            ...registry,
            discsVerificats: [
                {
                    artista: 'Vigilat',
                    titol: 'Un disc',
                    accio: 'conserva',
                    font: 'https://artist.example/disc',
                    videoIds: ['a'],
                },
            ],
        });
        const result = update(emptyState(), [song('a'), song('b')], { policy: p });
        expect(result.state.pendents.map((x) => x.id)).toEqual(['b']);
        expect(result.state.revisades).toEqual(['a']);
    });

    it('no reutilitza títols de canals compartits ni homònims', () => {
        expect(
            recordingKey(song('a'), {
                key: 'compartit',
                artista: 'Compartit',
                canalCompartit: true,
            })
        ).toBe('');
        expect(recordingKey(song('a'), { key: 'nou', artista: 'Nou', mode: 'nou' })).toBe('');
    });
});

describe('catàleg real', () => {
    it('vigila Dusminguet, Troba, Gertrudis, Vademecum i els homònims detectats', () => {
        const p = loadPolicy();
        for (const id of [
            'UCOXyxBFPQ97GO6PQqiJSvkw',
            'UC63BTrp525uyzMd-YTMAt_w',
            'UChYQSBa6bIG2yArpLA4ykvA',
            'UCvqTGNjxbWceoaz4pkBSEzg',
            'UC_X_KBioMYCrmZyI7hbL8Pw',
            'UCIBWCquq4qqhRWKD6nOdR4w',
            'UCx82VgJTTf_cKHahlakKfFg',
        ]) {
            expect(p.resolve({ channelId: id }).mode, id).toBe('vigilats');
        }
    });

    it('tots els casos que queden a la cua són vigilats i una segona passada és estable', () => {
        const state = JSON.parse(fs.readFileSync('data/revisio-idiomes.json'));
        const feed = JSON.parse(fs.readFileSync('data/feed.json'));
        const hiddenIds = new Set(JSON.parse(fs.readFileSync('data/hidden-videos.json')).videoIds);
        const p = loadPolicy();
        const first = updatePending(state, feed.videos, {
            policy: p,
            hiddenIds,
            now,
        });
        expect(first.state.pendents.every((x) => p.resolve(x).mode === 'vigilats')).toBe(true);
        expect(first.discardedIds.size).toBe(0);
        expect(updatePending(first.state, feed.videos, { policy: p, hiddenIds, now }).state).toEqual(first.state);
        // El catàleg viu pot tenir altes pendents: no són una fallada del sistema ni una aprovació lingüística.
        // Han de continuar a la cua d'incorporació fins a la revisió editorial.
        for (const artist of first.state.artistesPendents) {
            expect(artist.canals.length).toBeGreaterThan(0);
            for (const channelId of artist.canals) {
                expect(p.resolve({ channelId, channelTitle: artist.artista }).mode).toBe('nou');
            }
        }
        for (const artist of state.artistesPendents || []) {
            if (artist.canals.some(channelId => p.resolve({ channelId, channelTitle: artist.artista }).mode === 'nou')) {
                expect(first.state.artistesPendents.map(item => item.key)).toContain(artist.key);
            }
        }
        expect(first.state.revisades).toEqual(state.revisades);
        expect(first.state.pendents.some((x) => ['Tesa', 'Still Ill'].includes(x.artista))).toBe(true);
        expect(first.state.pendents.every((x) => !hiddenIds.has(x.id))).toBe(true);
    });
});
