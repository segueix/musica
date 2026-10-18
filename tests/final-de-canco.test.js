import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

// Final de cançó (2026-10-18): YouTube no deixa treure la graella de recomanacions del final d'un vídeo incrustat.
// Dins d'una cua es passa a la següent uns segons abans d'acabar, i la ràdio no s'acaba mai (musicQueue.extend).

const source = readFileSync('js/app.js', 'utf8');
const fn = name => {
    const start = source.indexOf(`function ${name}(`);
    return source.slice(start, source.indexOf('\n}\n', start) + 3);
};

function setup({ state = '1', awaiting = 'false', queue, index = 0, saved = null, tv = false } = {}) {
    const videoPlayer = {
        dataset: { playingVideoId: queue[index].id, playerState: state, awaitingNativePlay: awaiting },
    };
    const ctx = {
        videoPlayer,
        isPlaylistMode: true,
        activePlaylistQueue: queue,
        currentPlaylistIndex: index,
        QUEUE_END_TRIM_SECONDS: 3,
        QUEUE_END_TRIM_MIN_DURATION: 60,
        queueEndTrack: { videoId: '', duration: 0, done: false },
        window: { localStorage: { getItem: () => saved } },
        isTVPlaybackMode: () => tv,
        isAwaitingNativePlay: () => videoPlayer.dataset.awaitingNativePlay === 'true',
        handlePlaylistVideoEnded: vi.fn(),
        Number,
        Math,
        String,
    };
    runInNewContext(
        ['queueEndTrimSeconds', 'shouldAdvanceBeforeEnd', 'maybeAdvanceBeforeEnd'].map(fn).join('\n') +
            '\nthis.track = () => queueEndTrack;',
        ctx
    );
    return ctx;
}

const queue = [
    { id: 'a', durationSeconds: 200 },
    { id: 'b', durationSeconds: 180 },
];

describe('passa a la cançó següent abans de les recomanacions de YouTube', () => {
    it('a 3 s del final, una sola vegada per cançó', () => {
        const ctx = setup({ queue });
        ctx.maybeAdvanceBeforeEnd({ currentTime: 150, duration: 200 });
        expect(ctx.handlePlaylistVideoEnded).not.toHaveBeenCalled();
        ctx.maybeAdvanceBeforeEnd({ currentTime: 197.5 });
        expect(ctx.handlePlaylistVideoEnded).toHaveBeenCalledTimes(1);
        ctx.maybeAdvanceBeforeEnd({ currentTime: 198.5 });
        expect(ctx.handlePlaylistVideoEnded).toHaveBeenCalledTimes(1);
    });

    it('sense la durada de YouTube, fa servir la del catàleg', () => {
        const ctx = setup({ queue });
        ctx.maybeAdvanceBeforeEnd({ currentTime: 198 });
        expect(ctx.handlePlaylistVideoEnded).toHaveBeenCalledTimes(1);
    });

    it('no ho fa en pausa, esperant el primer ▶, a la TV, fora de la cua ni amb cançons curtes', () => {
        for (const options of [{ state: '2' }, { awaiting: 'true' }, { tv: true }]) {
            const ctx = setup({ queue, ...options });
            ctx.maybeAdvanceBeforeEnd({ currentTime: 198, duration: 200 });
            expect(ctx.handlePlaylistVideoEnded).not.toHaveBeenCalled();
        }
        const fora = setup({ queue });
        fora.videoPlayer.dataset.playingVideoId = 'una-altra';
        fora.maybeAdvanceBeforeEnd({ currentTime: 198, duration: 200 });
        expect(fora.handlePlaylistVideoEnded).not.toHaveBeenCalled();
        const curta = setup({ queue: [{ id: 'a', durationSeconds: 40 }, queue[1]] });
        curta.maybeAdvanceBeforeEnd({ currentTime: 38, duration: 40 });
        expect(curta.handlePlaylistVideoEnded).not.toHaveBeenCalled();
    });

    it('els segons es poden canviar o desactivar (localStorage.catube_queue_end_trim)', () => {
        const mes = setup({ queue, saved: '8' });
        mes.maybeAdvanceBeforeEnd({ currentTime: 193, duration: 200 });
        expect(mes.handlePlaylistVideoEnded).toHaveBeenCalledTimes(1);
        const off = setup({ queue, saved: '0' });
        off.maybeAdvanceBeforeEnd({ currentTime: 199.5, duration: 200 });
        expect(off.handlePlaylistVideoEnded).not.toHaveBeenCalled();
    });

    it('es crida amb cada infoDelivery del reproductor principal', () => {
        expect(source).toMatch(
            /if \(payload\?\.event === 'infoDelivery' && fromMainPlayer\) maybeAdvanceBeforeEnd\(payload\.info\);/
        );
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
