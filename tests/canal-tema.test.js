import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
    DEFAULTS,
    songKey,
    songKeys,
    topicKeys,
    matchedKey,
    keysOf,
    hasSongMarker,
    governClassification,
    selectTopicTracks,
} = require('../scripts/lib/canal_tema.js');

const song = { accepted: true, contentType: 'song', confidence: 0.9, reason: 'marcador explícit de cançó/videoclip' };
const review = { accepted: false, contentType: 'review', confidence: 0.5, reason: 'dubtós' };
const other = { accepted: false, contentType: 'other', confidence: 0.9, reason: 'entrevista' };

describe('mana el canal Tema', () => {
    it('la mateixa cançó té la mateixa clau al videoclip, al directe i a la pista del Tema', () => {
        const artists = ['Els Pets'];
        const key = songKey('Bon dia', artists);
        expect(key).toBe('bon dia');
        for (const title of [
            'Els Pets - Bon dia (Videoclip Oficial)',
            'Bon Dia - Els Pets',
            'Els Pets - Bon dia (Vic 1997)',
            'Bon dia - Remastered 2015',
            'Bon dia (feat. Algú)',
            'Els Pets - Bon dia.m4v',
        ]) {
            expect(songKey(title, artists), title).toBe(key);
        }
        expect(songKey('Corrandes de l’exili', [])).toBe(songKey("Corrandes de l'exili", []));
        expect(songKey('Els Pets - Entrevistes Això és espectacle', artists)).not.toBe(key);
    });

    it('del canal propi només queden les cançons que són al Tema', () => {
        const keys = keysOf([{ title: 'Bon dia' }, { title: 'Pa amb oli i sal' }], ['Els Pets']);
        const govern = (cls, title, extra = {}) =>
            governClassification(cls, { key: songKey(title, ['Els Pets']), keys, ...extra });
        expect(govern(song, 'Els Pets - Bon dia (Videoclip Oficial)')).toBe(song);
        expect(govern(review, 'Els Pets - Pa amb oli i sal').contentType).toBe('song');
        const outside = govern(song, 'Els Pets - Discussió lletra El meu veí de sota');
        expect(outside.contentType).toBe('other');
        expect(outside.accepted).toBe(false);
        expect(outside.reason).toMatch(/Tema/);
        expect(govern(other, 'Els Pets - Bon dia')).toBe(other);
    });

    it('no toca les decisions manuals, els Shorts, els àlbums ni els artistes sense Tema', () => {
        const keys = new Set(['bon dia']);
        expect(governClassification(song, { key: 'entrevista', keys, overridden: true })).toBe(song);
        expect(governClassification(song, { key: 'entrevista', keys, isShort: true })).toBe(song);
        const album = { ...song, contentType: 'album' };
        expect(governClassification(album, { key: 'disc sencer', keys })).toBe(album);
        expect(governClassification(song, { key: 'entrevista', keys: null })).toBe(song);
    });

    it('tria una pista per cançó, sense les que ja tenen videoclip, les més escoltades i les novetats', () => {
        const now = Date.parse('2026-10-02T00:00:00Z');
        const old = '2015-01-01T00:00:00Z';
        const tracks = [
            { id: 'a1', key: 'bon dia', viewCount: 100, publishedAt: old },
            { id: 'a2', key: 'bon dia', viewCount: 900, publishedAt: old },
            { id: 'b', key: 'pa amb oli', viewCount: 500, publishedAt: old },
            { id: 'c', key: 'videoclip', viewCount: 9999, publishedAt: old },
            { id: 'd', key: 'poc escoltada', viewCount: 1, publishedAt: old },
            { id: 'e', key: 'novetat', viewCount: 0, publishedAt: '2026-09-20T00:00:00Z' },
        ];
        const ids = selectTopicTracks(tracks, { coveredKeys: new Set(['videoclip']), now, keep: 2 });
        expect(ids).toEqual(['a2', 'b', 'e']);
        expect(selectTopicTracks([], {})).toEqual([]);
        expect(DEFAULTS.topicKeep).toBeGreaterThan(0);
    });

    it('troba la cançó dins dels títols reals dels canals oficials', () => {
        const cases = [
            ['Aina - Dan Peralbo i El Comboi', ['Dan Peralbo i El Comboi'], 'Aina'],
            ['AUXILI - 02. Si tu vols (Tresors, 2018)', ['AUXILI'], 'Si tu vols'],
            ["'El Calvari' d'Anna Andreu", ['Anna Andreu'], 'El Calvari'],
            [
                'La Fúmiga - FOTOSÍNTESI amb ZOO (Fotosíntesi, 2021) | Lyric Video Oficial |',
                ['La Fúmiga'],
                'Fotosíntesi',
            ],
            ['Asusena- Sandra Monfort (video lyric)', ['Sandra Monfort'], 'Asusena'],
            ['Mishima - El tobogan (Ara i res) 10', ['Mishima'], 'El tobogan'],
            ['SODI Temps Afegit - Nou Single', ['SODI'], 'Temps afegit'],
            ['SMOKING SOULS - Ara (videoclip) Translúcid', ['Smoking Souls'], 'Ara'],
            [
                'Maria Jaume - Tan a poc a poc que me dorm [audio oficial]',
                ['Maria Jaume'],
                'Tan a poc a poc (que me dorm)',
            ],
            ['OQUES GRASSES - GOSSEJAR & AL·LÈRGIQUES AL POL·LEN', ['Oques Grasses'], 'Gossejar'],
            ['12. arròs covat prod. Jan Aygua, bby bdass', ['Pol Bordas'], 'arròs covat'],
        ];
        for (const [title, artists, topicTitle] of cases) {
            const keys = new Set(topicKeys(topicTitle, artists));
            expect(matchedKey(title, artists, keys), title).not.toBe('');
        }
        const keys = keysOf([{ title: 'Bon dia' }], ['Els Pets']);
        expect(matchedKey('Els Pets - Entrevistes Això és espectacle', ['Els Pets'], keys)).toBe('');
        expect(matchedKey('AUXILI - GIRA TRESORS 2018 (Vídeo-resum)', ['AUXILI'], keysOf([{ title: 'Tresors' }]))).toBe(
            ''
        );
        expect(songKeys('Els Pets', ['Els Pets'])).not.toContain('els pets');
    });

    it('conserva el que el títol diu que és una cançó publicada', () => {
        for (const title of [
            "Cabells Mullats - Ven'nus (Videoclip Oficial)",
            'CRIM - Alerta, Alerta! (Video Lyric)',
            'Mar Pujol - Princesa de sal (Audio)',
            'AYRYN-Apropar-me (Visualizer)',
            'Anna Andreu - Mentresant (Audio oficial)',
        ]) {
            expect(hasSongMarker(title), title).toBe(true);
        }
        for (const title of ['AUXILI - GIRA TRESORS 2018 (Vídeo-resum)', 'Els Pets - Entrevistes Això és espectacle']) {
            expect(hasSongMarker(title), title).toBe(false);
        }
        const keys = new Set(['bon dia']);
        expect(governClassification(song, { key: ['neptu'], keys, marked: true })).toBe(song);
        expect(governClassification(song, { key: ['neptu'], keys }).contentType).toBe('other');
        expect(DEFAULTS.minCoverage).toBeGreaterThan(0.5);
    });

    it('una pista del Tema amb videoclip no hi entra encara que la coincidència sigui amb el parèntesi desfet', () => {
        const ids = selectTopicTracks(
            [{ id: 't', key: 'tan a poc a poc', keys: topicKeys('Tan a poc a poc (que me dorm)'), viewCount: 9 }],
            { coveredKeys: new Set(['tan a poc a poc que me dorm']) }
        );
        expect(ids).toEqual([]);
    });
});
