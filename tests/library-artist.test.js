import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { loadScript } from './setup.js';

const library = loadScript('js/features/library.js').SegueixApp.features.library;

describe("resolveArtistName (artista de cada cançó d'una llista)", () => {
    const names = new Map([['UC1', 'Els Catarres']]);

    it("fa servir el nom del canal registrat (fitxa d'artista)", () => {
        expect(library.resolveArtistName({ channelId: 'UC1', channelTitle: 'ElsCatarresVEVO' }, names)).toBe(
            'Els Catarres'
        );
    });

    it('cau al títol del canal quan no hi ha canal registrat', () => {
        expect(library.resolveArtistName({ channelId: 'UC9', channelTitle: 'Sense registre' }, names)).toBe(
            'Sense registre'
        );
        expect(library.resolveArtistName({ snippet: { channelTitle: 'Del snippet' } }, names)).toBe('Del snippet');
    });

    it("conserva l'artista ja desat i no falla sense dades", () => {
        expect(library.resolveArtistName({ artistName: 'Desat' })).toBe('Desat');
        expect(library.resolveArtistName({})).toBe('');
        expect(library.resolveArtistName(null)).toBe('');
    });
});

describe("llista desada: l'artista surt a cada cançó amb enllaç a la fitxa", () => {
    const app = fs.readFileSync('js/app.js', 'utf8');

    it('desa artistName a cada cançó i el mostra com a enllaç de canal', () => {
        expect(app).toContain('artistName: SegueixApp.features.library?.resolveArtistName');
        expect(app).toContain('${renderPlaylistVideoArtist(video)}');
        expect(app).toMatch(/playlist-video-artist channel-link" data-channel-id=/);
    });
});
