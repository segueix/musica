import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

// Capçalera i barra lateral integrades (2026-10-17): mateix fons que la pàgina, sense línies, barra com un panell,
// secció activa en llima i cerca en càpsula de vidre.
const css = fs.readFileSync('css/portada.css', 'utf8');
const block = css.slice(css.indexOf('Capçalera i barra lateral integrades (ordinador i tauleta, 2026-10-17)'));

describe('capçalera i barra lateral integrades', () => {
    it('fan servir el fons de la pàgina, sense línies de separació', () => {
        expect(block).toMatch(
            /body \.app-header \{[^}]*color-mix\(in srgb, var\(--color-background, var\(--pt-bg\)\) 86%, transparent\);[^}]*border-bottom-color: transparent;/
        );
        expect(block).toMatch(
            /body \.sidebar#sidebar \{[^}]*background: var\(--color-background, var\(--pt-bg\)\);[^}]*border-right: 0;/
        );
    });

    it('la barra és un panell i la secció activa va en llima', () => {
        expect(block).toMatch(/\.sidebar-nav \{[^}]*border-radius: var\(--pt-radius-player\);/);
        expect(block).toMatch(
            /\.pt-nav-item\.is-current,[^{]*\{\s*background: var\(--pt-accent\);\s*color: var\(--pt-on-accent\);/
        );
    });

    it('la cerca és una càpsula de vidre i el botó, rodó', () => {
        expect(block).toMatch(/\.search-input \{[^}]*border-radius: var\(--pt-radius-pill\);/);
        expect(block).toMatch(/\.search-btn \{[^}]*border-radius: 50%;/);
    });

    it('el botó de tres ratlles conserva el requadre blanc', () => {
        expect(block).not.toMatch(/\.sidebar-toggle/);
    });
});
