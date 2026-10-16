import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// Vista d'un estil (Pop, Rock…) i d'una categoria pròpia (2026-10-16): sense «Música TV», la cançó destacada amb la
// caràtula de fons i el nom del grup sota el títol, i les cançons en caràtules quadrades amb marc blanc.
// Verificació en un navegador: node tests/browser/verificar-vista-estil.js
const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');
const navigation = fs.readFileSync('js/features/navigation.js', 'utf8');
const swList = fs.readFileSync('scripts/actualitzar_versio_sw.js', 'utf8');
const css = fs.readFileSync('css/portada.css', 'utf8');
const block = css.slice(css.indexOf("/* ---------- Vista d'un estil (Pop, Rock…)"));

describe('caràtules amb marc blanc: cantonades', () => {
    it('totes fan servir el mateix arrodoniment, el mínim que es nota (8 px)', () => {
        expect(css).toMatch(/--pt-radius-cover: 8px;/);
        for (const selector of [
            '#channelPage .ap-card {',
            '#channelPage .ap-card__art {',
            '\n.af-card {',
            ':is(#followPage, .search-results) .follow-card {',
            '#homePage.is-style-view .hero {',
            ':is(#homePage.is-style-view #videosGrid, #homePage .search-results .videos-grid) .video-card {',
        ]) {
            const rule = css.slice(css.indexOf(selector), css.indexOf('}', css.indexOf(selector)));
            expect(rule, selector).toMatch(/border-radius: var\(--pt-radius-cover\);/);
        }
    });
});

describe('vista d’un estil', () => {
    it('no carrega «Música TV» (segueix-tv.js, herència de Segueix youtubers)', () => {
        expect(navigation).not.toMatch(/segueix-tv\.js/);
        expect(navigation).not.toMatch(/installSegueixTVFeature/);
        expect(swList).not.toMatch(/segueix-tv\.js/);
    });

    it('el nom del grup va just sota el títol de la cançó destacada', () => {
        const hero = html.slice(html.indexOf('id="heroSection"'), html.indexOf('id="categoryArtists"'));
        expect(hero.indexOf('id="heroChannel"')).toBeGreaterThan(hero.indexOf('id="heroTitle"'));
        expect(hero.indexOf('id="heroChannel"')).toBeLessThan(hero.indexOf('class="hero-actions"'));
    });

    it('la vista d’un estil o d’una categoria pròpia porta #homePage.is-style-view (la cerca el treu)', () => {
        expect(app).toMatch(/homePage\?\.classList\.toggle\('is-style-view', styleView\)/);
        expect(app).toMatch(
            /const styleView = Boolean\(category\) && \(isUser \|\| isStyleRadioCategory\(category\)\)/
        );
        expect(app).toMatch(/homePage\?\.classList\.remove\('is-discover', 'is-style-view'\)/);
    });

    it('la caràtula omple la cançó destacada; les cançons, en quatre columnes de caràtules amb marc blanc', () => {
        // La cançó destacada no porta el marc blanc de les caràtules
        expect(block).toMatch(/#homePage\.is-style-view \.hero \{[^}]*border: 1px solid var\(--pt-line\);/);
        expect(block).not.toMatch(/#homePage\.is-style-view \.hero \{[^}]*#fff/);
        expect(block).toMatch(/#homePage\.is-style-view \.hero-thumbnail \{[^}]*position: absolute;[^}]*inset: 0;/);
        expect(block).toMatch(
            /:is\(#homePage\.is-style-view #videosGrid, #homePage \.search-results \.videos-grid\) \{[^}]*repeat\(4, minmax\(0, 1fr\)\)/
        );
        expect(block).toMatch(
            /:is\(#homePage\.is-style-view #videosGrid, #homePage \.search-results \.videos-grid\) \.video-card \{[^}]*aspect-ratio: 1;[^}]*border: 2px solid #fff;/
        );
        expect(block).toMatch(/\.video-card:hover,[^{]*\{[^}]*transform: scale\(1\.04\)/);
        expect(block).toMatch(/#homePage\.is-style-view \.grid-layout-controls \{\s*display: none;/);
        // Mòbil: una caràtula sota l'altra
        expect(block).toMatch(
            /@media \(max-width: 768px\) \{\s*:is\(#homePage\.is-style-view #videosGrid, #homePage \.search-results \.videos-grid\) \{\s*grid-template-columns: minmax\(0, 1fr\);/
        );
    });
});
