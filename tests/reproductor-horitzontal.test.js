import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// El vídeo a pantalla completa en horitzontal és només per a un mòbil girat. Abans (`max-width: 1024px`) també
// s'aplicava a una finestra d'ordinador apaïsada de 769–1024 px: el reproductor tapava la barra lateral («Descobreix»
// no responia) i tota l'app (2026-10-16). Verificació: node tests/browser/verificar-descobreix-barra.js
const css = fs.readFileSync('css/styles.css', 'utf8');

describe('reproductor en horitzontal', () => {
    it('només un mòbil girat (tàctil i poca alçada) posa el vídeo a tota la pantalla', () => {
        const start = css.indexOf('/* Forçar pantalla completa real en mode horitzontal');
        const media = css.slice(css.indexOf('@media', start), css.indexOf('{', css.indexOf('@media', start)));
        expect(media).toMatch(/orientation: landscape/);
        expect(media).toMatch(/max-height: 500px/);
        expect(media).toMatch(/pointer: coarse/);
        expect(media).not.toMatch(/max-width: 1024px/);
        expect(css).not.toMatch(/@media \(orientation: landscape\) and \(max-width: 1024px\)/);
    });
});
