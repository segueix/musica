import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../css/portada.css', import.meta.url), 'utf8');
const start = css.indexOf("Fitxa de la cançó a l'ordinador: controls en vertical");
const block = css.slice(start);

describe("Fitxa de la cançó a l'ordinador: controls en vertical a la dreta del reproductor", () => {
    it('existeix el bloc i només s’aplica a ≥ 1025 px', () => {
        expect(start).toBeGreaterThan(0);
        expect(block).toMatch(/@media \(min-width: 1025px\)/);
    });

    it('tres columnes: reproductor, controls (en columna) i cua; el títol i el canal ocupen les dues primeres', () => {
        expect(block).toMatch(/grid-template-columns: minmax\(320px, 520px\) auto minmax\(0, 1fr\)/);
        expect(block).toMatch(/\.player-external-controls:not\(\.is-docked\) \{[^}]*grid-column: 2;[^}]*flex-direction: column;/s);
        expect(block).toMatch(/> \.video-info,\s*#watchPage \.watch-main > \.channel-info,[^{]*\{\s*grid-column: 1 \/ span 2;/);
        expect(block).toMatch(/#playlistQueueContainer \{\s*grid-column: 3;/);
    });

    it('la finestra flotant (.is-docked) no hi queda afectada i els avisos no van damunt del vídeo', () => {
        expect(block).not.toMatch(/\.is-docked\s*\{/);
        expect(block).toMatch(/:is\(\.player-autoplay-hint, \.player-native-play-hint\) \{[^}]*top: calc\(100% \+ 14px\);/s);
    });
});
