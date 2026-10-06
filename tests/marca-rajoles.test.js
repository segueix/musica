import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Pantalla d'espera amb «Música», «Música» petit damunt del logo al mòbil i rajoles de «Tria el teu so» iguals.

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

    it('al mòbil «Música» va sota «Segueix!» (o damunt del logo si no hi cap el nom); a l’ordinador, al costat', () => {
        expect(html).toMatch(
            /<span class="brand-mark">\s*<img class="brand-logo"[^>]*>\s*<span class="brand-mark__tag"/
        );
        expect(css).toMatch(/\.brand-mark__tag \{\s*display: none;/);
        expect(css).toMatch(
            /@container \(max-width: 130px\) \{[\s\S]*?\.app-header \.brand-mark__tag \{\s*display: block;/
        );
        expect(css).toMatch(/\.brand-mark__tag \{\s*position: absolute;\s*right: -\d+px;\s*bottom: -\d+px;/);
    });

    it('totes les rajoles de «Tria el teu so» fan la mateixa alçada', () => {
        const block = css.slice(css.indexOf('«Tria el teu so»: totes les rajoles fan el mateix'));
        expect(block).toMatch(/\.pt-styles \{\s*grid-auto-rows: 1fr;/);
        expect(block).toMatch(/\.pt-style \{\s*height: 100%;/);
        expect(block).toMatch(/-webkit-line-clamp: 2;/);
        expect(block).toMatch(/\.pt-style__count \{[\s\S]*?white-space: nowrap;/);
    });
});
