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
    });

    it('restaurar i tancar no van damunt del vídeo (normes de YouTube): són a la barra de sota', () => {
        const html = read('index.html');
        for (const source of [app, css, portada]) {
            expect(source).not.toMatch(/close-mini-player-btn|expand-mini-player-btn|mini-player-controls-overlay/);
        }
        expect(html).toContain('id="playerMiniBtn"');
        expect(html).toMatch(/id="playerCloseBtn"[^>]*hidden/);
        const controls = fn(app, 'initExternalPlayerControls');
        expect(controls).toContain('expandMiniPlayer()');
        expect(controls).toContain('closeMiniPlayer()');
        expect(controls).toContain('close.hidden = !miniActive');
        // Al mòbil la barra s'enganxa sota la finestra; a l'escriptori la segueix
        expect(controls).toContain('place(miniActive, miniActive && !mobileQuery.matches)');
        expect(portada).toMatch(/\.player-external-controls\.is-docked\.is-floating \{/);
        expect(fn(app, 'positionMiniPlayerBottomRight')).toContain('EXTERNAL_CONTROLS_DOCK_HEIGHT');
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

    it('play i pausa canvien l’estat de seguida, sense esperar l’avís de YouTube (que es pot perdre)', () => {
        expect(fn(app, 'playMainPlayer')).toContain("videoPlayer.dataset.playerState = '1'");
        expect(fn(app, 'pauseMainPlayer')).toContain("videoPlayer.dataset.playerState = '2'");
        // i l'estat també es llegeix de infoDelivery / initialDelivery
        const handler = fn(app, 'handleYouTubeMessageLegacyImpl');
        expect(handler).toMatch(/infoDelivery' \|\| payload\?\.event === 'initialDelivery'/);
        expect(handler).toContain('videoPlayer.dataset.playerState = payload.info.playerState');
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

describe('ràdio o llista que sona: etiqueta a la línia de data, sense línia pròpia', () => {
    it('fora de les TV no es crea la línia «Mode llista» sinó una etiqueta dins .meta-left', () => {
        const chip = fn(app, 'updatePlaylistModeChip');
        expect(chip).toContain("querySelector('#watchPage .video-meta-row .meta-left')");
        expect(chip).toContain("chip.id = 'playlistModeChip'");
        expect(chip).toContain("isRadio ? 'Ràdio' : 'Llista'");
        const badge = fn(app, 'updatePlaylistModeBadge');
        expect(badge).toContain('updatePlaylistModeChip(isTVPlaying)');
        expect(badge).toContain('if (!isPlaylistMode || !isTVPlaying)');
        expect(portada).toMatch(/\.queue-mode-chip \{[^}]*color: var\(--pt-accent\)/);
        expect(portada).toMatch(/#watchPage \.video-meta-row \.meta-left \{[^}]*flex-wrap: nowrap/);
    });
});
