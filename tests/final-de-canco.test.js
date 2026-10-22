import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

// La cua espera el final real de YouTube, també amb una preferència antiga de retall.

const source = readFileSync('js/app.js', 'utf8');
const fn = name => {
    const start = source.indexOf(`function ${name}(`);
    return source.slice(start, source.indexOf('\n}\n', start) + 3);
};

function setup(saved = null) {
    const iframe = { contentWindow: {} };
    const ctx = {
        videoPlayer: {
            dataset: { playingVideoId: 'a', playerState: '1' },
            querySelector: () => iframe,
        },
        window: { localStorage: { getItem: () => saved } },
        handlePlaylistVideoEnded: vi.fn(),
        applyReportedPlayerState: vi.fn(),
        shouldIgnoreDuplicateTVEnded: () => false,
        hasQueueNavigation: () => true,
        lastKnownPlayerTime: 0,
    };
    runInNewContext(fn('handleYouTubeMessageLegacyImpl'), ctx);
    const send = (event, info, source = iframe.contentWindow) =>
        ctx.handleYouTubeMessageLegacyImpl({ origin: 'https://www.youtube.com', source, data: { event, info } });
    return { ctx, send };
}

describe('la cançó es reprodueix fins al final real', () => {
    it.each([null, '1', '3', '8', '20'])('no anticipa el final amb el retall antic %s', saved => {
        const { ctx, send } = setup(saved);
        for (const currentTime of [150, 197, 198, 199, 199.9, 200]) {
            send('infoDelivery', { currentTime, duration: 200, playerState: 1 });
        }
        expect(ctx.lastKnownPlayerTime).toBe(200);
        expect(ctx.handlePlaylistVideoEnded).not.toHaveBeenCalled();
        send('onStateChange', 0);
        expect(ctx.handlePlaylistVideoEnded).toHaveBeenCalledTimes(1);
    });

    it('ignora el final d’un altre iframe i els finals duplicats després d’un canvi', () => {
        const { ctx, send } = setup();
        send('onStateChange', 0, {});
        expect(ctx.handlePlaylistVideoEnded).not.toHaveBeenCalled();
        ctx.shouldIgnoreDuplicateTVEnded = () => true;
        send('onStateChange', 0);
        expect(ctx.handlePlaylistVideoEnded).not.toHaveBeenCalled();
    });
});

describe('la cua no s’acaba mai', () => {
    it('a l’última cançó, s’allarga abans de decidir si surt de la cua', () => {
        const extend = vi.fn(() => {
            ctx.activePlaylistQueue.push({ id: 'c' });
            return true;
        });
        const ctx = {
            isAwaitingNativePlay: () => false,
            document: { visibilityState: 'visible' },
            isVideoPipOpen: () => false,
            isPlaylistMode: true,
            activePlaylistQueue: [{ id: 'a' }, { id: 'b' }],
            currentPlaylistIndex: 1,
            loadVideoInSequence: vi.fn(),
            exitPlaylistMode: vi.fn(),
            SegueixApp: { features: { musicQueue: { extend } } },
        };
        runInNewContext(fn('handlePlaylistVideoEnded'), ctx);
        ctx.handlePlaylistVideoEnded();
        expect(extend).toHaveBeenCalledWith({ minAhead: 1 });
        expect(ctx.currentPlaylistIndex).toBe(2);
        expect(ctx.loadVideoInSequence).toHaveBeenCalled();
        expect(ctx.exitPlaylistMode).not.toHaveBeenCalled();
    });

    it('cada cançó nova de la cua programa un allargament', () => {
        expect(fn('loadVideoInSequence')).toMatch(/scheduleQueueExtend\(\);/);
        expect(fn('scheduleQueueExtend')).toMatch(/musicQueue\?\.extend\?\.\(\)/);
    });
});
