import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const { esCastella } = createRequire(import.meta.url)('../scripts/ocultar_titols_castella.js');
const song = (channelTitle, title) => ({ channelTitle, title, contentType: 'song' });

describe('ocultar cançons amb títol en castellà', () => {
    it('detecta títols en castellà revisats a mà', () => {
        expect(esCastella(song('MARLENA', 'MARLENA - Nadie Se Muere De Amor'))).toBe(true);
        expect(esCastella(song('Ceaxe', 'POR PRIMERA VEZ - CEAXE'))).toBe(true);
        expect(esCastella(song('Joan Manuel Serrat', 'Joan Manuel Serrat - Vencidos'))).toBe(true);
    });

    it('conserva els títols en català del mateix canal o artista', () => {
        expect(esCastella(song('Ceaxe', 'AQUELLA NIT - CEAXE'))).toBe(false);
        expect(esCastella(song('miquel', "miquel - L'amor en tu (Videolyric)"))).toBe(false);
        expect(esCastella(song('Joan Manuel Serrat', 'Joan Manuel Serrat - Per al Meu Amic (Concierto (Actuación TVE))'))).toBe(false);
    });

    it('només afecta cançons i canals de la llista', () => {
        expect(esCastella({ channelTitle: 'MARLENA', title: 'entrevista', contentType: 'review' })).toBe(false);
        expect(esCastella(song('Altre canal', 'Nadie Se Muere De Amor'))).toBe(false);
    });
});
