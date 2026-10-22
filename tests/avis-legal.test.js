import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Avís legal (2026-10-22): secció de drets d'autor dins «Privacitat i Avís Legal» (#legalModal d'index.html).
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const modal = html.slice(html.indexOf('id="legalModal"'), html.indexOf('id="siteCreditFooter"'));

describe('Avís legal: drets d’autor', () => {
    it('explica que la música sona amb el reproductor oficial de YouTube i que no s’allotja res', () => {
        expect(modal).toContain("8. Drets d'autor i continguts musicals");
        expect(modal).toContain('sense ànim de lucre');
        expect(modal).toContain('reproductor oficial de YouTube');
        expect(modal).toMatch(/No allotgem, no copiem ni deixem descarregar/);
    });

    it('diu que no hi ha vídeos no incrustables, lletres ni publicitat amagada', () => {
        expect(modal).toContain('no deixa incrustar');
        expect(modal).toContain('No hi publiquem lletres');
        expect(modal).toMatch(/no separem el so de la imatge/i);
    });

    it('dona una via de retirada als titulars de drets', () => {
        expect(modal).toContain('mailto:info.segueix@gmail.com');
        expect(modal).toContain('https://t.me/segueix');
        expect(modal).toContain('info-youtubers.html#contacte');
    });
});
