import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Play/pausa del reproductor: és el de YouTube (cap botó propi) i res no cobreix el vídeo. La conducta real (tocs que
// arriben a l'iframe, mànec d'arrossegar, ancorada al mòbil) es verifica a tests/browser/verificar-play-pausa.js.

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('js/app.js');
const css = read('css/styles.css');
const portada = read('css/portada.css');
const queue = read('js/features/music-queue.js');

const fn = (source, name) => {
    const start = source.indexOf(`function ${name}(`);
    if (start < 0) throw new Error(`No hi ha la funció ${name}`);
    return source.slice(start, source.indexOf('\n}\n', start) + 3);
};

describe('sense botó de play/pausa propi ni capa que cobreixi el vídeo', () => {
    it('la capa de controls de la cua només té anterior, següent i finestra flotant', () => {
        const overlay = fn(app, 'createQueueNextOverlay');
        expect(overlay).toContain('queue-prev-button');
        expect(overlay).toContain('queue-next-button');
        expect(overlay).toContain('queue-mini-button');
        expect(overlay).not.toContain('queue-toggle-button');
        expect(overlay).not.toContain('touch-layer');
        for (const source of [app, css, portada]) {
            expect(source).not.toMatch(/queue-toggle-button|queue-next-touch-layer|updateQueueToggleIcon/);
        }
    });

    it('la finestra flotant ja no emula un play/pausa amb un toc: només s’arrossega', () => {
        const drag = fn(app, 'makeDraggable');
        expect(drag).not.toContain('toggleMainPlayerPlayback');
        expect(drag).not.toContain("addEventListener('click'");
        // Al mòbil (ancorada a baix) no té cap gestor
        expect(drag).toMatch(/window\.innerWidth <= 768\) \{[\s\S]*?return;/);
    });

    it('la capa d’arrossegament és un mànec de 36 px a dalt (mai tot el vídeo) i s’amaga al mòbil', () => {
        expect(css).toMatch(/\.drag-handle-container \{\s*position: absolute;\s*inset: 0 0 auto 0;\s*height: 36px;/);
        expect(css).toMatch(/@media \(max-width: 768px\) \{[\s\S]*?\.drag-handle-container \{\s*display: none;/);
        expect(portada).not.toMatch(/clip-path/);
        // I la barra de dalt (restaurar/tancar) no enfosqueix el vídeo: és un degradat, i al mòbil és sempre visible
        expect(app).toContain('position: absolute; inset: 0 0 auto 0; height: 56px;');
        expect(css).toMatch(/\.mini-player-controls-overlay \{\s*opacity: 1;[\s\S]*?linear-gradient/);
    });

    it('restaurar i tancar tenen àrees tàctils de 44 px i no depenen de cap llibreria d’icones', () => {
        expect(css).toMatch(/\.close-mini-player-btn \{[^}]*min-width: 44px;[^}]*min-height: 44px;/);
        expect(css).toMatch(/\.expand-mini-player-btn \{[^}]*min-width: 44px;[^}]*min-height: 44px;/);
        const template = app.slice(
            app.indexOf('class="close-mini-player-btn"'),
            app.indexOf('class="video-embed-wrap"')
        );
        expect(template).not.toContain('data-lucide');
        expect(template).toContain('<svg');
    });
});

describe('ordres de play/pausa robustes', () => {
    it('hi ha ordres explícites i el canvi té en compte el buffering', () => {
        expect(fn(app, 'playMainPlayer')).toContain("sendMainPlayerCommand('playVideo')");
        expect(fn(app, 'pauseMainPlayer')).toContain("sendMainPlayerCommand('pauseVideo')");
        expect(fn(app, 'isMainPlayerPlaying')).toContain("state === '1' || state === '3'");
        expect(fn(app, 'toggleMainPlayerPlayback')).toContain(
            'isMainPlayerPlaying() ? pauseMainPlayer() : playMainPlayer()'
        );
    });

    it('la pantalla de bloqueig (Media Session) envia l’ordre que demana, sense mirar l’estat desat', () => {
        const system = read('js/features/system-player.js');
        expect(system).toContain("setHandler('play', () => actions.play());");
        expect(system).toContain("setHandler('pause', () => actions.pause());");
    });
});

describe('controls de la cua sense cobrir el vídeo', () => {
    it('el centre queda lliure per al botó de YouTube i els controls flanquegen', () => {
        expect(css).toMatch(/\.queue-controls \{[^}]*grid-template-columns: 1fr var\(--qc-main\) 1fr;/);
        expect(css).toMatch(/\.queue-controls \.queue-prev-button \{\s*grid-column: 1;/);
        expect(css).toMatch(/\.queue-controls \.queue-next-button \{\s*grid-column: 3;/);
        expect(css).toMatch(
            /#videoPlayer\.mini-player-active \.queue-controls \{\s*--qc-side: 34px;\s*--qc-main: 60px;/
        );
    });

    it('en tàctil, un toc al vídeo mostra els controls detectant el focus de l’iframe (sense menjar-se el toc)', () => {
        const init = fn(app, 'initQueueNextOverlay');
        expect(init).toContain("window.matchMedia?.('(pointer: coarse)')?.matches");
        expect(init).toContain("window.addEventListener('blur'");
        expect(init).toContain("active.tagName !== 'IFRAME'");
        expect(init).toContain('window.focus();');
    });
});
