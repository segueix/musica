import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../js/features/player.js', import.meta.url), 'utf8');

describe('regressions de Continua mirant', () => {
    it('inicia el seguiment API abans d’esperar l’enriquiment asíncron', () => {
        const start = source.indexOf("const tracker = beginProgressTracking(videoId, 'api', resolved);");
        const awaitHook = source.indexOf('await runtime.hooks.showVideoFromAPIImpl?.(videoId, resolved.options);');
        expect(start).toBeGreaterThan(-1);
        expect(awaitHook).toBeGreaterThan(start);
        expect(source).toContain('if (activeProgress !== tracker) return result;');
    });

    it('no descarta el primer estat playing durant la finestra de canvi', () => {
        expect(source).toContain(
            "const isPlayingState = payload?.event === 'onStateChange' && Number(payload.info) === 1;"
        );
        expect(source).toContain('if (inSwitchGrace && !isPlayingState) return;');
    });

    it('força el desament quan la SPA abandona la vista del reproductor', () => {
        const fnStart = source.indexOf('function normalizeUrlAfterLeavingWatch()');
        const persist = source.indexOf('persistActiveProgress({ force: true });', fnStart);
        const pathGuard = source.indexOf(
            "if (!isReadableVideoPath(window.location.pathname) && !params.has('v')) return;",
            fnStart
        );
        expect(fnStart).toBeGreaterThan(-1);
        expect(persist).toBeGreaterThan(fnStart);
        expect(pathGuard).toBeGreaterThan(persist);
    });
});
