import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const learning = readFileSync(new URL('../js/features/tv-learning.js', import.meta.url), 'utf8');
const liveQueue = readFileSync(new URL('../js/features/tv-live-queue.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

describe('TV viva durant la sessió', () => {
    it('crea una intenció temporal reactiva i amb decaïment', () => {
        expect(learning).toContain('SESSION_LEARNING_RATE = 0.55');
        expect(learning).toContain('SESSION_HALF_LIFE_MS = 45 * 60 * 1000');
        expect(learning).toContain('liveProfile = emptyLiveProfile()');
        expect(learning).toContain('function sessionAffinityForVideo(video)');
        expect(learning).toContain('function sessionDecay()');
        expect(learning).toContain("segueix:tv-learning-update");
    });

    it('només considera temps realment visible com a temps vist', () => {
        expect(learning).toContain('activeWatchedSeconds');
        expect(learning).toContain('!document.hidden && delta > 0 && delta <= 5.5');
        expect(learning).toContain('activeWatchedSeconds ?? item?.maxPosition');
    });

    it('protegeix sempre el vídeo actual i A continuació', () => {
        expect(liveQueue).toContain('const PROTECTED_AHEAD = 1');
        expect(liveQueue).toContain('const startIndex = index + PROTECTED_AHEAD + 1');
        expect(liveQueue).toContain('const currentId = videoId(queue[index])');
        expect(liveQueue).toContain('const nextId = videoId(queue[index + 1])');
        expect(liveQueue).toContain('videoId(queue[index]) !== currentId');
        expect(liveQueue).toContain('videoId(queue[index + 1]) !== nextId');
    });

    it('reordena només la cua futura segons la intenció de la sessió', () => {
        expect(liveQueue).toContain('sessionAffinityForVideo');
        expect(liveQueue).toContain('function reorderTail(queue, startIndex)');
        expect(liveQueue).toContain('activePlaylistQueue.splice(startIndex');
        expect(liveQueue).toContain("window.addEventListener('segueix:tv-learning-update'");
        expect(liveQueue).toContain("if (typeof renderPlaylistQueue === 'function') renderPlaylistQueue()");
    });

    it('manté descoberta i diversitat en la reordenació viva', () => {
        expect(liveQueue).toContain('const EXPLORATION_EVERY = 4');
        expect(liveQueue).toContain('(absolutePosition + 1) % EXPLORATION_EVERY === 0');
        expect(liveQueue).toContain('if (sharesCategory(item.video, recent)) score -= 0.75');
        expect(liveQueue).toContain('if (similarity > 0.42)');
        expect(liveQueue).toContain('rhythmAdjustment(previous, item.video)');
    });

    it('explica la TV viva i carrega el mòdul nou', () => {
        expect(app).toContain('<strong>5. TV viva.</strong>');
        expect(app).toContain('Mai canvia el vídeo actual ni “A continuació”');
        expect(index).toContain('js/features/tv-live-queue.js?v=20260924-live-session-v1');
        expect(sw).toContain("'./js/features/tv-live-queue.js'");
        expect(sw).toMatch(/const CACHE_VERSION = '[a-z0-9_-]+'/i);
    });
});
