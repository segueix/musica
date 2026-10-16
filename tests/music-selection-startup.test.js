import { describe, it, expect, vi } from 'vitest';
import { loadScript } from './setup.js';

const now = Date.parse('2026-10-16T12:00:00Z');
const videos = Array.from({ length: 125 }, (_, i) => ({
    id: `song${i}`, channelId: `artist${i % 7}`, title: `Cançó ${i}`,
    categories: ['Pop'], contentType: i % 17 ? 'song' : 'other',
    publishedAt: '2026-10-01', durationSeconds: 180, viewCount: i * 100,
    ...(i % 3 === 0 ? { originalYear: 1980, originalYearSource: 'manual' } : {}),
}));
const snapshot = ctx => JSON.parse(JSON.stringify([...ctx.features]));

function load(extra = {}) {
    return loadScript('js/features/music-selection.js', extra).SegueixApp.features.musicSelection;
}

describe('catàleg cooperatiu durant l’arrencada', () => {
    it('cedeix el fil abans d’acabar i conserva cohorts, duplicats, gravacions i ordre', async () => {
        let release;
        const yielding = vi.fn(() => yielding.mock.calls.length === 1 ? new Promise(resolve => { release = resolve; }) : Promise.resolve());
        const selection = load({ scheduler: { yield: yielding } });
        const input = [...videos, videos[1], { title: 'Sense ID' }];
        let completed = false;
        const pending = selection.createContextAsync({ videos: input, now }).then(ctx => { completed = true; return ctx; });
        expect(yielding).toHaveBeenCalledTimes(1);
        expect(completed).toBe(false);
        release();
        const actual = await pending;
        const expected = selection.createContext({ videos: input, now });
        expect(snapshot(actual)).toEqual(snapshot(expected));
        expect(actual.features.size).toBe(117);
        expect(selection.arrange(videos, { ctx: actual })).toEqual(selection.arrange(videos, { ctx: expected }));
        expect(yielding.mock.calls.length).toBeGreaterThan(3);
    });

    it('també cedeix amb temporitzadors quan scheduler.yield no existeix', async () => {
        const timer = vi.fn(callback => { callback(); return 1; });
        const selection = load({ setTimeout: timer });
        const ctx = await selection.createContextAsync({ videos, now });
        expect(timer.mock.calls.length).toBeGreaterThan(3);
        expect(snapshot(ctx)).toEqual(snapshot(selection.createContext({ videos, now })));
    });

    it('el render reutilitza el context preparat i l’invalida amb un catàleg o configuració nous', async () => {
        const selection = load({ scheduler: { yield: async () => {} } });
        const prepared = await selection.prepareAppContext(videos, now);
        expect(selection.getAppContext(videos, now)).toBe(prepared);
        expect(selection.getAppContext(videos.slice(), now)).not.toBe(prepared);
        selection.setConfigOverrides({ noise: 0.2 });
        const changed = selection.getAppContext(videos, now);
        expect(changed).not.toBe(prepared);
        expect(changed.config.noise).toBe(0.2);
    });
});
