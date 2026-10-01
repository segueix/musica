import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const { esCastella } = createRequire(import.meta.url)('../scripts/ocultar_titols_castella.js');
const song = (channelTitle, title) => ({ channelTitle, title, contentType: 'song' });

describe('ocultar cançons amb títol en castellà', () => {
    it('detecta títols en castellà revisats a mà', () => {
        expect(esCastella(song('MARLENA', 'MARLENA - Nadie Se Muere De Amor'))).toBe(true);
        expect(esCastella(song('Ceaxe', 'POR PRIMERA VEZ - CEAXE'))).toBe(true);
        expect(esCastella(song('Judit Neddermann', 'Llévame Contigo'))).toBe(true);
        expect(esCastella(song('Judit Neddermann', 'Mendien Artean'))).toBe(true);
        expect(esCastella(song('SUU', 'Suu - Eres un temazo (Video Oficial)'))).toBe(true);
        expect(esCastella(song('SUU', 'Suu - Tranqüilo'))).toBe(true);
        expect(esCastella(song('Miki Nuñez', 'Miki Núñez - Viento Y Vida'))).toBe(true);
        expect(esCastella(song('31 FAM', 'NO LE DURA - 31FAM (Audio)'))).toBe(true);
        expect(esCastella(song('Julieta', 'Julieta - Si tienes frío (Audio Oficial)'))).toBe(true);
        expect(esCastella(song('Sexenni', 'Sexenni - Antipánico (Lyric Video)'))).toBe(true);
        expect(esCastella(song('Joan Manuel Serrat', 'Joan Manuel Serrat - Vencidos'))).toBe(true);
        expect(esCastella(song('Joan Manuel Serrat', 'Joan Manuel Serrat - Tarres (Actuación TVE)'))).toBe(true);
    });

    it('conserva els títols en català del mateix canal o artista', () => {
        expect(esCastella(song('Ceaxe', 'AQUELLA NIT - CEAXE'))).toBe(false);
        expect(esCastella(song('Judit Neddermann', 'Els Teus Ulls'))).toBe(false);
        expect(esCastella(song('Judit Neddermann', 'Primavera'))).toBe(false);
        expect(esCastella(song('SUU', 'Suu - Tant de bo (Video Oficial)'))).toBe(false);
        expect(esCastella(song('SUU', 'Suu - Parlant de tu'))).toBe(false);
        expect(esCastella(song('31 FAM', 'PER LA BONA GENT - 31FAM (Audio)'))).toBe(false);
        expect(esCastella(song('Julieta', 'Julieta - Ni llum ni lluna (Audio Oficial)'))).toBe(false);
        expect(esCastella(song('Sexenni', 'Sexenni - Mòbil, claus i cartera (Videoclip Oficial)'))).toBe(false);
        expect(esCastella(song('miquel', "miquel - L'amor en tu (Videolyric)"))).toBe(false);
        expect(
            esCastella(song('Joan Manuel Serrat', 'Joan Manuel Serrat - Per al Meu Amic (Concierto (Actuación TVE))'))
        ).toBe(false);
        expect(esCastella(song('Joan Manuel Serrat', "Joan Manuel Serrat - Paraules D'Amor (Cover Audio)"))).toBe(
            false
        );
    });

    it('només afecta cançons i canals de la llista', () => {
        expect(esCastella({ channelTitle: 'MARLENA', title: 'entrevista', contentType: 'review' })).toBe(false);
        expect(esCastella(song('Altre canal', 'Nadie Se Muere De Amor'))).toBe(false);
    });
});
