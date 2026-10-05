import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Normes de YouTube a la finestreta flotant: vídeo de 200 × 200 px com a mínim i res al davant del reproductor.
// La verificació en navegador és a tests/browser/verificar-play-pausa.js.

const app = readFileSync('js/app.js', 'utf8');
const css = readFileSync('css/portada.css', 'utf8');
const block = css.slice(css.indexOf('Finestreta flotant: normes de YouTube'));

describe('finestreta flotant: normes de YouTube', () => {
    it('l’ordinador no la deixa més petita de 356 px d’ample (200 px d’alçada en 16:9)', () => {
        expect(app).toContain('const MINI_PLAYER_MIN_WIDTH = 356;');
        expect(Math.round((356 * 9) / 16)).toBeGreaterThanOrEqual(200);
        expect(app).toMatch(/Math\.max\(MINI_PLAYER_MIN_WIDTH, startWidth \+ \(event\.clientX - startX\)\)/);
        expect(app).toMatch(/Math\.max\(MINI_PLAYER_MIN_WIDTH, Math\.min\(360, window\.innerWidth - 32\)\)/);
        expect(block).toMatch(/min-width: 356px;/);
    });

    it('el mànec i la cantonada van en una franja a sobre del vídeo, no al damunt', () => {
        expect(block).toMatch(/box-sizing: content-box;[\s\S]*?padding-top: 36px;/);
        expect(block).toMatch(
            /\.video-embed-wrap \{[\s\S]*?inset: 36px 0 0 0 !important;[\s\S]*?height: auto !important;/
        );
        expect(app).toContain('const MINI_PLAYER_BAR_HEIGHT = 36;');
        expect(app).toMatch(/\+ MINI_PLAYER_BAR_HEIGHT;/);
    });

    it('al mòbil el vídeo flotant fa com a mínim 200 px d’alçada', () => {
        expect(block).toMatch(/height: max\(200px, 56\.25vw\) !important;/);
        // Els espais reservats sota el contingut fan servir la mateixa alçada
        expect(css).not.toMatch(/\+ 56\.25vw/);
    });
});
