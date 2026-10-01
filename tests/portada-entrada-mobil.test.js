import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const css = fs.readFileSync('css/portada.css', 'utf8');

// Bloc mòbil de l'entrada de la portada: el que hi ha entre el comentari «Mòbil: l'entrada…» i «Seccions».
const start = css.indexOf("Mòbil: l'entrada ocupava");
const block = css.slice(start, css.indexOf('/* ---------- Seccions ---------- */', start));

describe('entrada de la portada al mòbil (≤ 768 px)', () => {
    it('té un bloc propi de mòbil', () => {
        expect(start).toBeGreaterThan(-1);
        expect(block).toContain('@media (max-width: 768px)');
    });

    it("el títol no queda limitat a 16 caràcters i el botó principal ocupa tota l'amplada", () => {
        expect(block).toMatch(/\.pt-entry__title\s*{[^}]*max-width:\s*none/);
        expect(block).toMatch(/\.pt-entry__cta \.pt-btn\s*{[^}]*width:\s*100%/);
    });

    it("les opcions del selector de mode mantenen mides tàctils de 44 px (no es redueix l'alçada)", () => {
        expect(block).not.toMatch(/\.pt-mode__opt span\s*{[^}]*min-height/);
        expect(css).toMatch(/\.pt-mode__opt span\s*{[^}]*min-height:\s*44px/);
    });

    it("les eines d'una secció que baixen de fila s'alineen a l'esquerra amb prou especificitat", () => {
        expect(block).toMatch(/\.pt-head \.pt-head__tools\s*{[^}]*margin-left:\s*0/);
    });
});
