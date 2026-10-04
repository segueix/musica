import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadScript } from './setup.js';

const az = loadScript('js/features/alphabet-index.js', { SegueixApp: { features: {}, utils: {}, state: {} } })
    .SegueixApp.features.alphabetIndex;
const css = readFileSync('css/portada.css', 'utf8');

describe('índex alfabètic dels artistes', () => {
    it('la inicial no té accents i els números o símbols van a «#»', () => {
        expect(az.letterOf('Àlex Torío')).toBe('A');
        expect(az.letterOf('Ça va')).toBe('C');
        expect(az.letterOf('  «Els Catarres»')).toBe('E');
        expect(az.letterOf('31 FAM')).toBe('#');
        expect(az.letterOf('')).toBe('#');
        expect(az.letterOf('òscar')).toBe('O');
    });

    it('la lletra activa és la més gran i les veïnes es fan més petites', () => {
        expect(az.scaleFor(0)).toBe(2);
        expect(az.scaleFor(-1)).toBe(1.5);
        expect(az.scaleFor(2)).toBe(1.2);
        expect(az.scaleFor(5)).toBe(1);
    });

    it('la posició del dit dins de la columna dona una lletra vàlida', () => {
        const count = az.LETTERS.length;
        expect(az.indexFromOffset(0, 540, count)).toBe(0);
        expect(az.indexFromOffset(539, 540, count)).toBe(count - 1);
        expect(az.indexFromOffset(-30, 540, count)).toBe(0);
        expect(az.indexFromOffset(9999, 540, count)).toBe(count - 1);
        expect(az.LETTERS[az.indexFromOffset(270, 540, count)]).toBe('M');
    });

    it('la columna és fixa, tàctil i només a la pàgina d’artistes', () => {
        expect(css).toMatch(/\.az-index \{[\s\S]*?position: fixed;[\s\S]*?touch-action: none;/);
        expect(css).toContain('body:has(#followPage.hidden) .az-index');
        expect(readFileSync('js/app.js', 'utf8')).toContain('SegueixApp.features.alphabetIndex?.attach?.(followGrid);');
        expect(readFileSync('sw.js', 'utf8')).toContain("'./js/features/alphabet-index.js'");
    });

    it('el botó d’artistes de la capçalera (mòbil) no té marc', () => {
        expect(css).toContain(
            ":is(.icon-btn[data-page='llistes'], .icon-btn[data-page='segueix'], #backgroundBtn, #addYoutuberBtn)"
        );
    });
});
