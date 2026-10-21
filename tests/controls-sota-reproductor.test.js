import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';

// Fitxa de la cançó a l'ordinador (2026-10-21, a petició de l'usuari): els controls del reproductor (anterior ·
// play/pausa · següent · finestra flotant · m'agrada) tornen a anar en una fila just a sota del vídeo. Del 2026-10-19
// al 2026-10-21 anaven en una columna a la dreta del reproductor (tres columnes a .watch-main).
const css = readFileSync('css/portada.css', 'utf8');

describe('fitxa de la cançó: controls del reproductor a sota del vídeo', () => {
    it('ja no hi ha el bloc dels controls en vertical a la dreta del reproductor', () => {
        expect(css).not.toContain("Fitxa de la cançó a l'ordinador: controls en vertical");
        expect(css).not.toMatch(/grid-template-columns: minmax\(320px, 520px\) auto minmax\(0, 1fr\)/);
    });

    it('la barra de controls no es posa en columna fora de la finestra flotant', () => {
        expect(css).not.toMatch(/\.player-external-controls:not\(\.is-docked\) \{[^}]*flex-direction: column/);
    });
});
