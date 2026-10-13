import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Pantalla d'espera amb «Música», marca «Segueix! Música» amb «En català» a sota i rajoles de «Tria el teu so» iguals.

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

    it('la marca és «Segueix! Música» amb «En català» a sota, a l’ordinador i al mòbil', () => {
        const brand = html.slice(
            html.indexOf('<a class="brand"'),
            html.indexOf('</a>', html.indexOf('<a class="brand"'))
        );
        expect(brand).toMatch(/<img class="brand-logo"[^>]*>\s*<span class="brand-copy">/);
        expect(brand).toContain('<span class="brand-music">Música</span>');
        expect(brand).toContain('<span class="brand-tag">En català</span>');
        expect(brand).not.toContain('brand-tag__');
        const block = css.slice(css.indexOf('Marca: logo + «Segueix! Música» + «En català»'));
        // els mateixos colors que la pantalla d'espera: «Música» llima i «En català» terracota
        expect(block).toMatch(/\.brand-music \{[\s\S]*?color: var\(--pt-accent\);/);
        expect(block).toMatch(/\.brand-tag \{[\s\S]*?color: var\(--pt-terracotta\);[\s\S]*?text-transform: uppercase;/);
        // el nom no desapareix mai
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

    it('la barra de càrrega inicial és llima, no vermella', () => {
        const portadaCss = readFileSync('css/portada.css', 'utf8');
        expect(portadaCss).toMatch(/\.bootstrap-progress-bar \{[^}]*background: var\(--pt-accent\)/);
        expect(readFileSync('js/app.js', 'utf8')).toContain(
            'Preparant Segueix <span class="bootstrap-progress-brand">Música</span>'
        );
        expect(portadaCss).toMatch(/\.bootstrap-progress-brand \{[^}]*color: var\(--pt-accent\);[^}]*text-transform: uppercase/);
    });
});
