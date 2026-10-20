import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';

// Fitxa de la cançó a l'ordinador (2026-10-20): la fila de botons de sota l'artista va tota junta a l'esquerra, amb una
// ratlla que separa el que porta a YouTube del que fa l'app (abans, dos grups separats per un forat al mig).
const css = readFileSync('css/portada.css', 'utf8');
const app = readFileSync('js/app.js', 'utf8');
const block = css.slice(css.indexOf('/* ---------- Fitxa de la cançó: la fila de botons, tota junta a l'));

describe('fitxa de la cançó: fila de botons junta a l’esquerra', () => {
    it('a partir de 769 px els botons van seguits, sense el forat del mig', () => {
        expect(block).toMatch(/@media \(min-width: 769px\) \{/);
        expect(block).toMatch(
            /#watchPage \.video-info-modern \.video-metadata-bar \{\s*justify-content: flex-start;\s*gap: 8px;/
        );
    });

    it('una ratlla fina separa YouTube (canal, comentar) de les accions de l’app (desar, compartir)', () => {
        expect(block).toMatch(
            /\.video-metadata-bar > \.action-group:not\(\.action-group-left\)::before \{[^}]*width: 1px;[^}]*height: 28px;/
        );
    });

    it('l’ordre és canal i comentar, després desar a una llista i compartir', () => {
        const row = app.slice(app.indexOf('<div class="video-metadata-bar">'), app.indexOf('id="shareBtn"') + 20);
        const pos = text => row.indexOf(text);
        expect(pos('Canal YouTube')).toBeGreaterThan(-1);
        expect(pos('Canal YouTube')).toBeLessThan(pos('btn-comment-youtube--desktop'));
        expect(pos('btn-comment-youtube--desktop')).toBeLessThan(pos('id="playlistBtn"'));
        expect(pos('id="playlistBtn"')).toBeLessThan(pos('id="shareBtn"'));
    });

    it('«Canal YouTube» porta el logotip de YouTube (decoratiu) davant del text', () => {
        expect(app).toMatch(/class="btn-pill-red">\s*<svg[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/svg>\s*Canal YouTube/);
    });
});
