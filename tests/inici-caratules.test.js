import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { loadScript } from './setup.js';

// Inici amb el llenguatge de caràtules (2026-10-16): imatge plena, marc blanc, text en blanc al damunt.
// Verificació en un navegador: node tests/browser/verificar-inici-caratules.js
const css = fs.readFileSync('css/portada.css', 'utf8');
const fase1 = css.slice(css.indexOf('/* ---------- Inici amb el llenguatge de caràtules (2026-10-16)'));
const portada = loadScript('js/features/portada.js').SegueixApp.features.portada;

describe('Inici: caràtules plenes amb marc blanc', () => {
    it('cançons, artistes «fora del radar», «Torna-hi», estils i llistes porten el marc blanc i les cantonades', () => {
        for (const selector of [
            '#homePage.is-portada .pt-card,',
            '#homePage.is-portada .pt-portrait {',
            '#homePage.is-portada .pt-quick {',
            '#homePage.is-portada .pt-style:not(.pt-style--add):not(.pt-style--more) {',
            '#homePlaylists .hp-item > .hp-card {',
        ]) {
            const start = fase1.indexOf(selector);
            expect(start, selector).toBeGreaterThan(-1);
            const rule = fase1.slice(start, fase1.indexOf('}', start));
            expect(rule, selector).toMatch(/border: 2px solid #fff;/);
            expect(rule, selector).toMatch(/border-radius: var\(--pt-radius-cover\);/);
        }
    });

    it('la imatge omple la caràtula i el text hi va al damunt', () => {
        expect(fase1).toMatch(/#homePage\.is-portada \.pt-card__media \{[^}]*position: absolute;[^}]*inset: 0;/);
        expect(fase1).toMatch(/#homePage\.is-portada \.pt-card__body \{[^}]*position: absolute;[^}]*inset: 0;/);
        expect(fase1).toMatch(/#homePage\.is-portada \.pt-portrait__img \{[^}]*position: absolute;[^}]*inset: 0;/);
        expect(fase1).toMatch(/#homePage\.is-portada \.pt-style__faces \{[^}]*position: absolute;[^}]*inset: 0;/);
        expect(fase1).toMatch(/#homePage\.is-portada #ptRadio \.pt-radio__covers \{[^}]*display: grid;/);
        expect(fase1).toMatch(/#homePage\.is-portada \.pt-near\.has-place \.pt-near__covers \{[^}]*display: grid;/);
    });

    it('sense subtítols explicatius visibles (continuen per als lectors de pantalla)', () => {
        expect(fase1).toMatch(/#homePage\.is-portada \.pt-head__sub \{[^}]*clip: rect\(0 0 0 0\);/);
        expect(fase1).toMatch(/#homePlaylists \.home-section-subtitle \{[^}]*clip: rect\(0 0 0 0\);/);
    });

    it('les caràtules de «La teva ràdio» van cadascuna en el seu requadre (per retallar-ne les franges)', () => {
        const source = fs.readFileSync('js/features/portada.js', 'utf8');
        expect(source).toMatch(
            /<span class="pt-radio__cover"><img src="\$\{esc\(cardThumbnail\(video\.thumbnail\)\)\}"/
        );
        const video = id => ({ id, thumbnail: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, channelId: id });
        expect(portada.radioCovers([video('a'), video('b')]).length).toBe(2);
    });
    it("«Les teves llistes»: totes plenes d'imatge i de la mateixa mida, sigui quin sigui el nom", () => {
        const css = fs.readFileSync('css/portada.css', 'utf8');
        const start = css.indexOf('/* «Les teves llistes»: totes les targetes plenes');
        expect(start).toBeGreaterThan(-1);
        const block = css.slice(start);
        expect(block).toMatch(
            /#homePlaylists \.hp-item \{[^}]*flex: 0 0 var\(--hp-size\);[^}]*width: var\(--hp-size\);[^}]*min-width: 0;[^}]*align-self: flex-start;/
        );
        expect(block).toMatch(/#homePlaylists \.hp-card \.hp-cover \{[^}]*aspect-ratio: auto;/);
        expect(block).toMatch(
            /#homePlaylists \.hp-card \.hp-name \{[^}]*white-space: normal;[^}]*-webkit-line-clamp: 2;/
        );
        expect(block).toMatch(/#homePlaylists \.hp-add \{[^}]*width: var\(--hp-size\);[^}]*aspect-ratio: 1;/);
        const source = fs.readFileSync('js/features/home-playlists.js', 'utf8');
        expect(source).toMatch(/<span class="hp-tile"><img src=/);
    });
});
