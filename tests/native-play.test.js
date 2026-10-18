import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it, expect, vi } from 'vitest';
const source = readFileSync('js/app.js', 'utf8');
const fn = name => { const start = source.indexOf(`function ${name}(`); return source.slice(start, source.indexOf('\n}\n', start) + 3); };
function setup(extra = {}) {
    const iframe = { contentWindow: { postMessage: vi.fn() }, src: 'https://www.youtube.com/embed/test?autoplay=0', addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const ctx = { videoPlayer: { dataset: { awaitingNativePlay: 'true' }, querySelector: () => iframe }, pendingPlayerState: null, PLAYER_STATE_PENDING_MS: 1500, YT_GREETING_INTERVAL_MS: 250, YT_GREETING_MAX_MS: 15000, Date, JSON, setTimeout: vi.fn(), setInterval: vi.fn(() => 1), clearInterval: vi.fn(), getDefaultVideoQuality: () => 'medium', ...extra };
    runInNewContext(['isAwaitingNativePlay', 'sendMainPlayerCommand', 'playMainPlayer', 'pauseMainPlayer', 'requestPlayerState', 'applyReportedPlayerState', 'isYouTubeEmbed', 'setupYouTubeIframeMessaging', 'keepGreetingYouTube', 'releaseNativePlayWait'].map(fn).join('\n'), ctx);
    return { ctx, iframe };
}
describe('primer inici dins del reproductor de YouTube', () => {
    it('bloqueja play propi i només desbloqueja quan YouTube confirma playing, no buffering', () => {
        const { ctx, iframe } = setup();
        expect(ctx.playMainPlayer()).toBe(false);
        ctx.applyReportedPlayerState(3);
        expect(ctx.playMainPlayer()).toBe(false);
        expect(iframe.contentWindow.postMessage).not.toHaveBeenCalled();
        ctx.applyReportedPlayerState(1);
        expect(ctx.pauseMainPlayer()).toBe(true);
        expect(ctx.playMainPlayer()).toBe(true);
    });
    it('la inicialització de l’iframe no força play abans del toc natiu', () => {
        const { ctx, iframe } = setup();
        ctx.setupYouTubeIframeMessaging(iframe);
        iframe._ytListener();
        const commands = iframe.contentWindow.postMessage.mock.calls.map(([s]) => JSON.parse(s).func);
        expect(commands).toContain('addEventListener');
        expect(commands).not.toContain('playVideo');
        ctx.applyReportedPlayerState(1);
        iframe._ytListener();
        expect(iframe.contentWindow.postMessage.mock.calls.map(([s]) => JSON.parse(s).func)).toContain('playVideo');
    });
    it('ignora les inicialitzacions pendents d’un iframe substituït', () => {
        const { ctx, iframe } = setup();
        ctx.setupYouTubeIframeMessaging(iframe);
        ctx.videoPlayer.querySelector = () => null;
        iframe._ytListener();
        expect(iframe.contentWindow.postMessage).not.toHaveBeenCalled();
    });
    it('triar una fila de la cua demana inici manual', () => {
        const ctx = { activePlaylistQueue: [{}, {}], currentPlaylistIndex: 0, loadVideoInSequence: vi.fn() };
        runInNewContext(fn('playVideoFromPlaylistIndex'), ctx);
        ctx.playVideoFromPlaylistIndex(1);
        expect(ctx.currentPlaylistIndex).toBe(1);
        expect(ctx.loadVideoInSequence).toHaveBeenCalledWith({ autoPlay: false });
    });
    it('el final de cançó continua automàticament després del primer inici', () => {
        const { ctx } = setup({ document: { visibilityState: 'visible' }, isPlaylistMode: true, activePlaylistQueue: [{}, {}], currentPlaylistIndex: 0, loadVideoInSequence: vi.fn() });
        runInNewContext(fn('handlePlaylistVideoEnded'), ctx);
        ctx.handlePlaylistVideoEnded();
        expect(ctx.loadVideoInSequence).not.toHaveBeenCalled();
        ctx.applyReportedPlayerState(1);
        ctx.handlePlaylistVideoEnded();
        expect(ctx.currentPlaylistIndex).toBe(1);
        expect(ctx.loadVideoInSequence).toHaveBeenCalledWith();
    });
    it('seleccionar una caràtula pel camí sense ràdio no activa autoplay', () => {
        const ctx = { clearEmbeddedYouTubeSession: vi.fn(), isAutoPlayNavigating: true, showVideoFromAPI: vi.fn() };
        runInNewContext(fn('playThenNavigateLegacyImpl'), ctx);
        ctx.playThenNavigateLegacyImpl('test', 'api');
        expect(ctx.isAutoPlayNavigating).toBe(false);
        expect(ctx.showVideoFromAPI).toHaveBeenCalledWith('test');
    });
});

for (const autoPlay of [false, true]) {
    it(`carrega l’iframe amb autoplay=${Number(autoPlay)} i controls natius`, () => {
        const frame = { contentWindow: {}, src: '', addEventListener() {} };
        const ctx = { videoPlayer: { dataset: {}, querySelector: () => frame }, pendingPlayerState: null,
            hasAcceptedYouTubeCookies: () => true, navigator: { userAgent: '' }, window: { matchMedia: () => ({ matches: false }), location: { href: 'https://segueix.github.io/musica/' } },
            buildYoutubeEmbedUrl: () => 'https://www.youtube.com/embed/test?autoplay=1', URL,
            applyYouTubeIframePolicy: vi.fn(), setupYouTubeIframeMessaging: vi.fn(), setupDragHandle: vi.fn(), refreshIcons: vi.fn(), setupVideoCardActionButtons: vi.fn() };
        runInNewContext(fn('isYouTubeEmbed') + fn('updatePlayerIframeLegacyImpl'), ctx);
        ctx.updatePlayerIframeLegacyImpl({ source: 'api', videoId: 'test', autoPlay });
        const rendered = autoPlay ? frame.src : ctx.videoPlayer.innerHTML;
        expect(rendered).toContain(`autoplay=${Number(autoPlay)}`);
        expect(rendered).toContain('controls=1');
        expect(ctx.videoPlayer.dataset.awaitingNativePlay).toBe(String(!autoPlay));
    });
}


describe('seleccions des de la cerca', () => {
    it('un suggeriment obre la cançó sense heretar autoplay', () => {
        const startFrom = vi.fn(() => true);
        const ctx = { SegueixApp: { features: { musicQueue: { startFrom } } },
            isAutoPlayNavigating: true, hideSearchDropdown: vi.fn(), isMobileView: () => false };
        runInNewContext(['handleSearchResultSelection', 'openVideoFromUserGesture', 'playThenNavigate'].map(fn).join('\n'), ctx);
        ctx.handleSearchResultSelection({ dataset: { resultType: 'video', videoId: 'song', videoSource: 'api' } });
        expect(startFrom).toHaveBeenCalledWith('song', 'api');
        expect(ctx.isAutoPlayNavigating).toBe(false);
    });
    for (const autoPlay of [false, true]) {
        it(`la cua transmet explícitament autoPlay=${autoPlay}`, () => {
            const ctx = { activePlaylistQueue: [{ id: 'song', source: 'api' }], currentPlaylistIndex: 0,
                focusTVPlayerViewport: vi.fn(), isTVPlaybackMode: () => false, canKeepQueuePlayer: () => false,
                document: { visibilityState: 'visible' }, updatePlaylistModeBadge: vi.fn(), syncQueueNextOverlay: vi.fn(),
                showVideoFromAPI: vi.fn(), scheduleQueueExtend: vi.fn() };
            runInNewContext(fn('loadVideoInSequence'), ctx);
            ctx.loadVideoInSequence({ autoPlay });
            expect(ctx.showVideoFromAPI).toHaveBeenCalledWith('song', { autoPlay, startAt: 0 });
            expect(ctx.scheduleQueueExtend).toHaveBeenCalled();
        });
    }
});

describe('mòbil: els botons no es queden bloquejats si es perd la salutació a YouTube (2026-10-18)', () => {
    const tick = ctx => ctx.setInterval.mock.calls.at(-1)[0];
    const sentEvents = iframe => iframe.contentWindow.postMessage.mock.calls.map(([s]) => JSON.parse(s).event);

    it('repeteix «listening» cada 250 ms fins al primer avís de l’iframe', () => {
        const { ctx, iframe } = setup();
        ctx.setupYouTubeIframeMessaging(iframe);
        expect(ctx.setInterval.mock.calls.at(-1)[1]).toBe(250);
        expect(iframe._ytConnected).toBe(false);
        tick(ctx)();
        tick(ctx)();
        expect(sentEvents(iframe).filter(e => e === 'listening')).toHaveLength(2);
        iframe._ytConnected = true; // ho posa handleYouTubeMessage en rebre qualsevol avís
        tick(ctx)();
        expect(sentEvents(iframe).filter(e => e === 'listening')).toHaveLength(2);
        expect(ctx.clearInterval).toHaveBeenCalled();
    });

    it('si YouTube no respon mai (15 s), deixa d’esperar el primer ▶ i els controls tornen a funcionar', () => {
        let now = 1000;
        const { ctx, iframe } = setup({ Date: { now: () => now } });
        ctx.setupYouTubeIframeMessaging(iframe);
        now += 16000;
        tick(ctx)();
        expect(ctx.videoPlayer.dataset.awaitingNativePlay).toBe('false');
        expect(ctx.playMainPlayer()).toBe(true);
    });

    it('handleYouTubeMessage marca l’iframe com a connectat amb qualsevol avís seu', () => {
        expect(source).toMatch(/if \(fromMainPlayer && mainIframe && isPlayerEvent\.test\(String\(payload\?\.event \|\| ''\)\)\) mainIframe\._ytConnected = true;/);
        expect(source).toMatch(/const isPlayerEvent = \/\^\(onReady\|initialDelivery\|infoDelivery/);
    });

    it('tocar el vídeo (el focus passa a l’iframe) desbloqueja els controls', () => {
        const iframe = {};
        const listeners = {};
        const ctx = {
            videoPlayer: { dataset: { awaitingNativePlay: 'true' }, querySelector: () => iframe },
            window: { addEventListener: (type, fn) => (listeners[type] = fn) },
            document: { activeElement: null },
            setTimeout: fn => fn(),
        };
        runInNewContext(['isAwaitingNativePlay', 'releaseNativePlayWait', 'initNativePlayTapDetection'].map(fn).join('\n'), ctx);
        ctx.initNativePlayTapDetection();
        listeners.blur();
        expect(ctx.videoPlayer.dataset.awaitingNativePlay).toBe('true'); // el focus ha anat a una altra finestra
        ctx.document.activeElement = iframe;
        listeners.blur();
        expect(ctx.videoPlayer.dataset.awaitingNativePlay).toBe('false');
        expect(source).toMatch(/initExternalPlayerControls\(\);\s*initNativePlayTapDetection\(\);/);
    });

    for (const awaiting of [true, false]) {
        it(`anterior / següent funcionen ${awaiting ? 'abans' : 'després'} del primer ▶ (autoPlay=${!awaiting})`, () => {
            const ctx = {
                videoPlayer: { dataset: { awaitingNativePlay: String(awaiting) } },
                currentPlaylistIndex: 1,
                hasQueueNextVideo: () => true,
                hasQueuePrevVideo: () => true,
                hideQueueNextOverlay: vi.fn(),
                syncQueueNextOverlay: vi.fn(),
                loadVideoInSequence: vi.fn(),
            };
            runInNewContext(['isAwaitingNativePlay', 'advanceQueueFromOverlay', 'goToPreviousFromOverlay'].map(fn).join('\n'), ctx);
            ctx.advanceQueueFromOverlay();
            expect(ctx.currentPlaylistIndex).toBe(2);
            expect(ctx.loadVideoInSequence).toHaveBeenLastCalledWith({ autoPlay: !awaiting });
            ctx.goToPreviousFromOverlay();
            expect(ctx.currentPlaylistIndex).toBe(1);
        });
    }

    it('el play/pausa no queda desactivat esperant el primer ▶: respon amb un avís', () => {
        const start = source.indexOf('function initExternalPlayerControls(');
        const body = source.slice(start, source.indexOf('\nfunction ', start + 10));
        expect(body).toMatch(/toggle\.disabled = false;/);
        expect(body).not.toMatch(/toggle\.disabled = awaiting/);
        expect(body).toMatch(/prev\.disabled = !hasQueuePrevVideo\(\);/);
        expect(body).toMatch(/next\.disabled = !hasQueueNextVideo\(\);/);
        expect(body).toMatch(/if \(isAwaitingNativePlay\(\)\) \{\s*window\.SegueixApp\?\.features\?\.shellNav\?\.toast\?\.\('Prem ▶ dins del vídeo de YouTube per començar\.'\);/);
    });
});
