import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Pantalla d'espera amb «Música», marca amb «Música en català» sota el nom i rajoles de «Tria el teu so» iguals.

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('css/portada.css', 'utf8');

describe('marca i rajoles de la portada', () => {
    it('la pantalla d’espera porta «Música» sota «Segueix!»', () => {
        const splash = html.slice(html.indexOf('id="intro-splash"'), html.indexOf('</header>'));
        expect(splash.indexOf('intro-splash-title')).toBeLessThan(
            splash.indexOf('<p class="intro-splash-brand">Música</p>')
        );
        expect(css).toMatch(/\.intro-splash-brand \{[\s\S]*?color: var\(--pt-accent\);/);
    });

    it('la marca és un sol bloc: logo, «Segueix!» i «Música en català» a sota (al mòbil, «Música CAT» si no hi cap)', () => {
        const brand = html.slice(
            html.indexOf('<a class="brand"'),
            html.indexOf('</a>', html.indexOf('<a class="brand"'))
        );
        expect(brand).toMatch(/<img class="brand-logo"[^>]*>\s*<span class="brand-copy">/);
        expect(brand).toContain('<span class="brand-tag__long">Música en català</span>');
        expect(brand).toContain('<span class="brand-tag__short">Música CAT</span>');
        expect(brand).not.toContain('brand-mark');
        const block = css.slice(css.indexOf('Marca: logo + «Segueix!» + «Música en català»'));
        expect(block).toMatch(/\.brand-tag \{[\s\S]*?text-transform: uppercase;/);
        expect(block).toMatch(/\.app-header \.brand \{\s*container-type: inline-size;/);
        expect(block).toMatch(/@container \(max-width: 139px\) \{\s*\.brand-tag__long \{\s*display: none;/);
        // el nom no desapareix mai (abans, a 320 px només quedava el logo amb «Música» retallat)
        expect(css).not.toMatch(/\.brand-name \{\s*display: none;/);
        expect(css).not.toContain('brand-mark__tag');
    });

    it('totes les rajoles de «Tria el teu so» fan la mateixa alçada', () => {
        const block = css.slice(css.indexOf('«Tria el teu so»: totes les rajoles fan el mateix'));
        expect(block).toMatch(/\.pt-styles \{\s*grid-auto-rows: 1fr;/);
        expect(block).toMatch(/\.pt-style \{\s*height: 100%;/);
        expect(block).toMatch(/-webkit-line-clamp: 2;/);
        expect(block).toMatch(/\.pt-style__count \{[\s\S]*?white-space: nowrap;/);
    });
});
