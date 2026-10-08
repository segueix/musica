import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it, expect, vi } from 'vitest';
const source = readFileSync('js/app.js', 'utf8');
const fn = name => { const start = source.indexOf(`function ${name}(`); return source.slice(start, source.indexOf('\n}\n', start) + 3); };
function setup(extra = {}) {
    const iframe = { contentWindow: { postMessage: vi.fn() }, src: 'https://www.youtube.com/embed/test?autoplay=0', addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const ctx = { videoPlayer: { dataset: { awaitingNativePlay: 'true' }, querySelector: () => iframe }, pendingPlayerState: null, PLAYER_STATE_PENDING_MS: 1500, Date, JSON, setTimeout: vi.fn(), getDefaultVideoQuality: () => 'medium', ...extra };
    runInNewContext(['isAwaitingNativePlay', 'sendMainPlayerCommand', 'playMainPlayer', 'pauseMainPlayer', 'requestPlayerState', 'applyReportedPlayerState', 'isYouTubeEmbed', 'setupYouTubeIframeMessaging'].map(fn).join('\n'), ctx);
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
