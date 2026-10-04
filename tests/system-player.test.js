import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadScript } from './setup.js';

// Controls del sistema (Media Session) i finestra flotant del sistema (Document Picture-in-Picture).

function setup({ queue, index = 0, playlist = true, state = '1', time = 30, pip = false, hidden = false } = {}) {
    const handlers = {};
    const posted = [];
    const calls = [];
    const mediaSession = {
        metadata: null,
        playbackState: 'none',
        position: null,
        setActionHandler(action, handler) {
            handlers[action] = handler;
        },
        setPositionState(value) {
            this.position = value;
        },
    };
    const iframe = { contentWindow: { postMessage: message => posted.push(JSON.parse(message)) } };
    const player = {
        dataset: { playerState: state, playingVideoId: queue?.[index]?.id || '' },
        querySelector: () => iframe,
    };
    const songs = queue || [
        { id: 'a', title: 'Primera', channelTitle: 'Artista A', durationSeconds: 200 },
        { id: 'b', title: 'Segona', channelTitle: 'Artista B', durationSeconds: 180 },
        { id: 'c', title: 'Tercera', channelTitle: 'Artista C', durationSeconds: 240 },
    ];
    const ctx = loadScript('js/features/system-player.js', {
        navigator: { userAgent: '', mediaSession },
        MediaMetadata: class {
            constructor(data) {
                Object.assign(this, data);
            }
        },
        document: {
            readyState: 'complete',
            visibilityState: hidden ? 'hidden' : 'visible',
            getElementById: id => (id === 'videoPlayer' ? player : null),
            addEventListener() {},
            body: { classList: { add() {}, remove() {} } },
        },
        addEventListener() {},
        isSecureContext: true,
        documentPictureInPicture: pip ? { requestWindow: async () => ({}) } : undefined,
        activePlaylistQueue: songs,
        currentPlaylistIndex: index,
        isPlaylistMode: playlist,
        activePlaylistName: 'Ràdio Pop',
        currentVideoId: songs[index]?.id,
        lastKnownPlayerTime: time,
        playMainPlayer: () => calls.push('play'),
        pauseMainPlayer: () => calls.push('pause'),
        hasQueueNextVideo: () => playlist && index < songs.length - 1,
        hasQueuePrevVideo: () => playlist && index > 0,
        advanceQueueFromOverlay: () => calls.push('next'),
        goToPreviousFromOverlay: () => calls.push('previous'),
    });
    const api = ctx.SegueixApp.features.systemPlayer;
    api.updateMediaSession();
    return { ctx, api, handlers, mediaSession, posted, calls };
}

describe('controls del sistema (Media Session)', () => {
    it('diu què sona: títol, artista, ràdio, caràtula i posició', () => {
        const { mediaSession } = setup({ index: 1, time: 45 });
        expect(mediaSession.metadata).toMatchObject({ title: 'Segona', artist: 'Artista B', album: 'Ràdio Pop' });
        expect(mediaSession.metadata.artwork[0].src).toContain('/vi/b/');
        expect(mediaSession.playbackState).toBe('playing');
        expect(mediaSession.position).toEqual({ duration: 180, playbackRate: 1, position: 45 });
    });

    it('play, pausa i atura envien l’ordre que demanen, sense mirar l’estat desat', () => {
        const { handlers, calls } = setup({ state: '2' });
        handlers.play();
        handlers.pause();
        handlers.stop();
        expect(calls).toEqual(['play', 'pause', 'pause']);
    });

    it('amb la pestanya amagada no permet reprendre ni avançar des de Media Session', async () => {
        const { handlers, calls, api } = setup({ state: '2', hidden: true, pip: true });
        handlers.play();
        handlers.nexttrack();
        handlers.pause();
        expect(calls).toEqual(['pause']);
        await expect(api.openPip()).resolves.toBe(false);
    });

    it('anterior i següent només hi són quan la cua en té', () => {
        const first = setup({ index: 0 });
        expect(first.handlers.previoustrack).toBeNull();
        expect(typeof first.handlers.nexttrack).toBe('function');
        first.handlers.nexttrack();
        expect(first.calls).toEqual(['next']);
        const last = setup({ index: 2 });
        expect(last.handlers.nexttrack).toBeNull();
        last.handlers.previoustrack();
        expect(last.calls).toEqual(['previous']);
    });

    it('endavant, enrere i saltar mouen el reproductor (sense passar del final)', () => {
        const { handlers, posted } = setup({ index: 0, time: 30 });
        handlers.seekforward({});
        handlers.seekbackward({ seekOffset: 5 });
        handlers.seekto({ seekTime: 999 });
        expect(posted.map(message => [message.func, message.args[0]])).toEqual([
            ['seekTo', 40],
            ['seekTo', 35],
            ['seekTo', 199],
        ]);
    });

    it('sense cap cançó, el sistema no mostra res', () => {
        const { mediaSession } = setup({ queue: [], playlist: false });
        expect(mediaSession.playbackState).toBe('none');
    });
});

describe('finestra flotant del sistema', () => {
    it('només s’ofereix on el navegador la té (Chrome i Edge d’escriptori, Chromebook)', () => {
        expect(setup({ pip: false }).api.isPipSupported()).toBe(false);
        expect(setup({ pip: true }).api.isPipSupported()).toBe(true);
    });

    it('els botons de finestra flotant obren la del sistema; amb la finestra oberta fan de «torna»', () => {
        const source = readFileSync(new URL('../js/features/system-player.js', import.meta.url), 'utf8');
        expect(source).toContain("closest?.('#playerMiniBtn, .queue-mini-button')");
        expect(source).toContain("closest?.('#videoPipRestore')");
        expect(source).toMatch(/if \(isVideoPipOpen\(\)\) \{[\s\S]*?closePip\(\);/);
    });

    it('el vídeo de YouTube viu a la finestra mentre és oberta i torna a la pàgina en tancar-la', () => {
        const source = readFileSync(new URL('../js/features/system-player.js', import.meta.url), 'utf8');
        // Es trasllada el node #videoPlayer sencer (l'iframe es recarrega des del segon on era i amb el mateix estat)
        expect(source).toContain('host.appendChild(player);');
        expect(source).toContain('app.state.playerHost = player;');
        expect(source).toContain("url.searchParams.set('start'");
        expect(source).toContain("url.searchParams.set('autoplay', autoplay ? '1' : '0')");
        // Els avisos de l'iframe arriben a la finestra: es reenvien a la pàgina amb la mateixa font
        expect(source).toContain("pipWindow.addEventListener('message', forwardMessage)");
        expect(source).toMatch(/new window\.MessageEvent\('message', \{[\s\S]*?source: event\.source/);
        // En tancar-la (incloent «torna a la pestanya»), el reproductor torna a lloc
        expect(source).toMatch(/pagehide[\s\S]*?returnVideo\(\)/);
        // Res no va damunt de l'iframe de YouTube dins la finestra
        expect(source).toContain('.sp-video #videoPlayer > :not(.video-embed-wrap) { display: none !important; }');
    });

    it('només amb el vídeo dins la finestra es pot controlar la reproducció amb la pestanya amagada', async () => {
        const hiddenNoPip = setup({ state: '2', hidden: true, pip: true });
        expect(hiddenNoPip.api.isVideoPipOpen()).toBe(false);
        hiddenNoPip.handlers.play();
        expect(hiddenNoPip.calls).toEqual([]);
        const visible = setup({ state: '2', pip: true });
        visible.handlers.play();
        expect(visible.calls).toEqual(['play']);
    });

    it('app.utils.playerElement troba el reproductor a la pàgina o dins la finestra (no document.getElementById)', () => {
        const core = readFileSync(new URL('../js/core/segueix-app.js', import.meta.url), 'utf8');
        expect(core).toContain('app.state.playerHost ||');
        for (const file of ['js/features/music-signals.js', 'js/features/drive-mode.js']) {
            const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
            expect(source).toContain('app.utils?.playerElement?.()');
        }
    });

    it('el mòdul es carrega després de music-queue.js, i music-queue hi delega la Media Session', () => {
        const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
        expect(html.indexOf('js/features/system-player.js')).toBeGreaterThan(
            html.indexOf('js/features/music-queue.js')
        );
        expect(html.indexOf('js/features/system-player.js')).toBeLessThan(html.indexOf('js/app.js'));
        const queue = readFileSync(new URL('../js/features/music-queue.js', import.meta.url), 'utf8');
        expect(queue).not.toContain('setActionHandler');
        expect(queue).toContain('app.features.systemPlayer?.update?.()');
    });
});
