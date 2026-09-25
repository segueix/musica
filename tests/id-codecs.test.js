import { describe, it, expect } from 'vitest';
import { loadScript } from './setup.js';

const ctx = loadScript('js/utils/id-codecs.js');
const codecs = ctx.SegueixApp.utils.idCodecs;

// ==================== Playlist IDs ====================
describe('Playlist ID codecs', () => {
    it('encode → decode retorna el número original', () => {
        for (const n of [1, 5, 42, 100, 9999, 123456]) {
            const encoded = codecs.encodePlaylistId(n);
            expect(codecs.decodePlaylistId(encoded)).toBe(n);
        }
    });

    it('decode retorna null per inputs invàlids', () => {
        expect(codecs.decodePlaylistId(null)).toBeNull();
        expect(codecs.decodePlaylistId('')).toBeNull();
        expect(codecs.decodePlaylistId('a')).toBeNull();
    });

    it('encode genera un string amb lletres i dígits', () => {
        const encoded = codecs.encodePlaylistId(42);
        expect(typeof encoded).toBe('string');
        expect(encoded.length).toBeGreaterThanOrEqual(3);
        // Primer caràcter ha de ser lletra
        expect(encoded[0]).toMatch(/[a-z]/);
    });
});

// ==================== Category IDs ====================
describe('Category ID codecs', () => {
    it('encode → decode retorna el número original', () => {
        for (const n of [1, 7, 50, 200, 10000]) {
            const encoded = codecs.encodeCategoryId(n);
            expect(codecs.decodeCategoryId(encoded)).toBe(n);
        }
    });

    it('decode retorna null per inputs invàlids', () => {
        expect(codecs.decodeCategoryId(null)).toBeNull();
        expect(codecs.decodeCategoryId('')).toBeNull();
        expect(codecs.decodeCategoryId('abc')).toBeNull();
    });

    it('encode genera un string més llarg que playlist', () => {
        const playlistEncoded = codecs.encodePlaylistId(42);
        const categoryEncoded = codecs.encodeCategoryId(42);
        expect(categoryEncoded.length).toBeGreaterThan(playlistEncoded.length);
    });
});

// ==================== Config IDs ====================
describe('Config ID codecs', () => {
    it('encode → decode retorna el número original', () => {
        for (const n of [1, 3, 88, 500, 99999]) {
            const encoded = codecs.encodeConfigId(n);
            expect(codecs.decodeConfigId(encoded)).toBe(n);
        }
    });

    it('decode retorna null per inputs invàlids', () => {
        expect(codecs.decodeConfigId(null)).toBeNull();
        expect(codecs.decodeConfigId('')).toBeNull();
        expect(codecs.decodeConfigId('ab')).toBeNull();
    });

    it('el resultat codificat sempre té el dígit principal a posició 2', () => {
        const encoded = codecs.encodeConfigId(7);
        expect(encoded[2]).toBe('7');
    });
});

// ==================== Roundtrip amb valors extrems ====================
describe('Roundtrip amb valors extrems', () => {
    it('funciona amb números d\'un sol dígit', () => {
        for (let n = 0; n <= 9; n++) {
            expect(codecs.decodePlaylistId(codecs.encodePlaylistId(n))).toBe(n);
            expect(codecs.decodeCategoryId(codecs.encodeCategoryId(n))).toBe(n);
            expect(codecs.decodeConfigId(codecs.encodeConfigId(n))).toBe(n);
        }
    });

    it('funciona amb números grans', () => {
        const big = 1234567890;
        expect(codecs.decodePlaylistId(codecs.encodePlaylistId(big))).toBe(big);
        expect(codecs.decodeCategoryId(codecs.encodeCategoryId(big))).toBe(big);
        expect(codecs.decodeConfigId(codecs.encodeConfigId(big))).toBe(big);
    });
});
