import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Ordinador (2026-10-05): el botó de finestra flotant fa la finestra de dins la pàgina amb els controls a sota (com al
// mòbil), i en canviar de secció amb una cançó al reproductor, aquesta passa a la finestra flotant en lloc d'aturar-se.
const app = readFileSync('js/app.js', 'utf8');
const systemPlayer = readFileSync('js/features/system-player.js', 'utf8');

describe('finestra flotant a l’ordinador', () => {
    it('el botó de finestra flotant ja no obre la finestra del sistema', () => {
        const handler = systemPlayer.slice(systemPlayer.indexOf('function onDocumentClick'));
        const body = handler.slice(0, handler.indexOf('\n    }\n'));
        expect(body).not.toContain('openPip()');
        expect(body).toContain('closePip()');
    });

    it('en navegar amb una cançó al reproductor, passa a la finestra flotant', () => {
        expect(app).toMatch(
            /if \(shouldFloatPlayerOnNavigation\(\)\) \{\s*setMiniPlayerState\(true, \{ trigger: 'navigation' \}\);/
        );
        expect(app).toMatch(/function shouldFloatPlayerOnNavigation\(\) \{[\s\S]*?visibilityState === 'hidden'/);
    });

    // Mòbil (2026-10-22): si sona i vas a Inici o a una altra secció, la música continua a la finestra flotant
    // ancorada a baix; en pausa s'atura com abans. Opt-in: tests/browser/verificar-mobil-segueix-sonant.js
    it('al mòbil també, però només si sona (no en pausa)', () => {
        const fn = app.slice(app.indexOf('function shouldFloatPlayerOnNavigation'));
        const body = fn.slice(0, fn.indexOf('\n}\n'));
        expect(body).not.toMatch(/\|\| isMobileView\(\)/);
        expect(body).toMatch(/isMobileView\(\) \? \[1, 3\] : \[1, 2, 3\]/);
    });
});
