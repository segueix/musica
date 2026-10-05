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

    it('en navegar amb una cançó al reproductor, passa a la finestra flotant (només ordinador)', () => {
        expect(app).toMatch(
            /if \(shouldFloatPlayerOnNavigation\(\)\) \{\s*setMiniPlayerState\(true, \{ trigger: 'navigation' \}\);/
        );
        expect(app).toMatch(
            /function shouldFloatPlayerOnNavigation\(\) \{[\s\S]*?isMobileView\(\)[\s\S]*?visibilityState === 'hidden'/
        );
    });
});
