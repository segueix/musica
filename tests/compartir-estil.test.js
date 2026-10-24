import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadScript } from './setup.js';

// Compartir un estil (2026-10-24): enllaç curt escolta/<slug> (escolta/<slug>.html) amb «Escolta Pop a Segueix!»; en obrir-lo,
// l'app hi engega la ràdio de l'estil amb «Els meus de sempre» de qui l'obre. L'enllaç no porta cap cançó.
const codecs = loadScript('js/utils/share-codecs.js').SegueixApp.utils.shareCodecs;
const { renderStyle } = require('../scripts/generar_pagines_compartir.js');
const app = readFileSync('js/app.js', 'utf8');
const shell = readFileSync('js/features/shell-nav.js', 'utf8');

describe('compartir un estil', () => {
    it('el text és «Escolta <estil> a Segueix!» i l’enllaç, curt', () => {
        expect(codecs.styleShareTitle('Pop')).toBe('Escolta Pop a Segueix!');
        expect(codecs.styleShareTitle("Cançó d'autor")).toBe("Escolta Cançó d'autor a Segueix!");
        expect(codecs.buildStyleShareUrl('Pop')).toBe('https://musica.segueix.cat/escolta/pop');
        expect(codecs.buildStyleShareUrl('Rap / Hip-hop')).toBe(
            'https://musica.segueix.cat/escolta/rap-hip-hop'
        );
        expect(codecs.buildStyleShareUrl('Pop')).not.toContain('importData');
    });

    it('la pàgina de l’estil té el títol per a WhatsApp i porta a ?escolta=', () => {
        const html = renderStyle({
            slug: 'canco-d-autor',
            style: "Cançó d'autor",
            title: "Escolta Cançó d'autor a Segueix!",
        });
        expect(html).toContain('<meta property="og:title" content="Escolta Cançó d&#39;autor a Segueix!">');
        expect(html).toContain('location.replace("https://musica.segueix.cat/?escolta=Can%C3%A7%C3%B3%20d\'autor")');
        expect(html).toContain('og:url" content="https://musica.segueix.cat/escolta/canco-d-autor"');
        expect(readFileSync('compartir/estil/pop.html', 'utf8')).toContain('?escolta=Pop');
        // L'adreça curta: GitHub Pages serveix escolta/pop.html a musica.segueix.cat/escolta/pop
        expect(readFileSync('escolta/pop.html', 'utf8')).toContain('?escolta=Pop');
        expect(readFileSync('escolta/rap-hip-hop.html', 'utf8')).toContain('og:title" content="Escolta Rap / Hip-hop a Segueix!"');
    });

    it('la vista d’un estil porta «Comparteix» al costat de «Ràdio»', () => {
        expect(app).toMatch(/data-style-radio=[\s\S]{0,300}data-style-share/);
        expect(app).toContain(
            "pageTitle.querySelector('[data-style-share]')?.addEventListener('click', () => shareStyleRadio(category));"
        );
        expect(app).toContain('await navigator.share({ title: text, text, url });');
    });

    it('en obrir l’enllaç s’engega la ràdio de l’estil amb «Els meus de sempre»', () => {
        expect(shell).toContain("const listen = params.get('escolta');");
        expect(shell).toContain("params.delete('escolta');");
        expect(shell).toContain("startStyleRadio?.([style], { mode: 'home' })");
    });
});
