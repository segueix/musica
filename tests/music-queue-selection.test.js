import { describe, expect, it } from 'vitest';
import { createMockLocalStorage, loadScript } from './setup.js';

// Ràdio real (music-queue.js) amb el motor de selecció i els senyals carregats, en un sandbox sense DOM.

const DAY = 86400000;
const YEAR = 365.25 * DAY;
const NOW = Date.now();
const helpers = loadScript('js/utils/helpers.js', { YouTubeAPI: undefined });

let counter = 0;
const song = (channelId, years, extra = {}) => {
    counter += 1;
    return {
        id: `m${String(counter).padStart(10, '0')}`,
        title: `Cançó ${counter}`,
        channelId,
        channelTitle: `Artista ${channelId}`,
        thumbnail: `t${counter}.jpg`,
        contentType: 'song',
        durationSeconds: 200,
        viewCount: 1000 + counter * 37,
        publishedAt: new Date(NOW - years * YEAR).toISOString(),
        categories: ['Pop'],
        ...extra,
    };
};

function catalogWithClassics() {
    const list = [];
    for (let a = 0; a < 24; a++) for (let i = 0; i < 3; i++) list.push(song(`c${a}`, 0.2 + i * 0.6));
    for (let a = 0; a < 8; a++)
        for (let i = 0; i < 4; i++) list.push(song(`k${a}`, 25 + i, { originalYear: 1990 + i }));
    return list;
}

function makeBus() {
    const listeners = {};
    return {
        addEventListener: (type, fn) => (listeners[type] = [...(listeners[type] || []), fn]),
        dispatchEvent: event => {
            (listeners[event.type] || []).forEach(fn => fn(event));
            return true;
        },
        CustomEvent: class {
            constructor(type, init = {}) {
                this.type = type;
                this.detail = init.detail;
            }
        },
    };
}

function setup({ catalog, history = [], liked = [], followed = [], mode = 'mix' } = {}) {
    const app = { features: {}, state: {}, utils: {} };
    const localStorage = createMockLocalStorage();
    localStorage.setItem('catube_discovery_mode', mode);
    const bus = makeBus();
    const shared = {
        SegueixApp: app,
        localStorage,
        ...bus,
        getHistoryItems: () => history,
        getLikedVideos: () => liked,
        getFollowedChannelIds: () => followed,
        getHiddenChannelIds: () => [],
        getVideoArtistKey: helpers.getVideoArtistKey,
        currentFeedVideos: catalog,
        cachedAPIVideos: [],
        activePlaylistQueue: [],
        currentFeedData: {
            channels: [...new Set(catalog.map(v => v.channelId))].map(id => ({ id, categories: ['Pop'] })),
        },
        document: {
            readyState: 'loading',
            addEventListener() {},
            querySelector: () => null,
            createElement: () => ({}),
            body: { classList: { contains: () => false } },
        },
    };
    loadScript('js/features/discovery.js', shared);
    loadScript('js/features/music-selection.js', shared);
    loadScript('js/features/music-signals.js', shared);
    const calls = { loaded: 0, refreshed: 0 };
    const queueCtx = loadScript('js/features/music-queue.js', {
        ...shared,
        spreadVideosByArtist: helpers.spreadVideosByArtist,
        limitClassicFrequency: helpers.limitClassicFrequency,
        filterOutWatchedVideos: list => list.filter(v => !history.some(h => h.id === v.id)),
        loadVideoInSequence: () => {
            calls.loaded += 1;
        },
        clearEmbeddedYouTubeSession: () => {},
        updatePlaylistModeBadge: () => {},
        syncQueueNextOverlay: () => {},
        renderPlaylistQueue: () => {
            calls.refreshed += 1;
        },
        isPlaylistMode: false,
        activePlaylistId: null,
        activePlaylistName: '',
        currentPlaylistIndex: 0,
        selectedCategory: 'Novetats',
    });
    return {
        app,
        queue: app.features.musicQueue,
        signals: app.features.musicSignals,
        selection: app.features.musicSelection,
        ctx: queueCtx,
        calls,
        bus,
        localStorage,
    };
}

const eraOf = (selection, video) => selection.eraOf(video, {}).tier;

describe('ràdio amb el motor de selecció', () => {
    it('una cançó de l’historial ja no queda exclosa per sempre', () => {
        const catalog = catalogWithClassics();
        const history = catalog.slice(0, 40).map(v => ({ ...v, viewedAt: new Date().toISOString() }));
        const { queue } = setup({ catalog, history });
        const seed = catalog[100];
        const built = queue.buildQueue(seed, '');
        const ids = new Set(history.map(h => h.id));
        expect(built.some(v => ids.has(v.id))).toBe(true);
    });

    it('la cua complix els límits d’antiguitat i d’artista després de totes les reordenacions', () => {
        const catalog = catalogWithClassics();
        const { queue, selection } = setup({ catalog });
        for (let i = 0; i < 12; i++) {
            const built = queue.buildQueue(catalog[i * 5], '');
            const top = built.slice(0, 20);
            expect(top.filter(v => eraOf(selection, v) === 'historic').length).toBeLessThanOrEqual(2);
            top.forEach((v, index) => {
                if (index > 0) expect(v.channelId).not.toBe(top[index - 1].channelId);
            });
            const counts = {};
            top.forEach(v => (counts[v.channelId] = (counts[v.channelId] || 0) + 1));
            expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(2);
            expect(new Set(built.map(v => v.id)).size).toBe(built.length);
        }
    });

    it('la ràdio la fa servir de veritat: les notes i el mode surten del motor', () => {
        const catalog = catalogWithClassics();
        const { queue } = setup({ catalog });
        queue.buildQueue(catalog[3], '');
        expect(queue.getState().meta).toMatchObject({ engine: 'v1' });
    });

    it('amb engine «legacy» torna la política anterior (l’historial exclou)', () => {
        const catalog = catalogWithClassics();
        const history = catalog.slice(0, 40).map(v => ({ ...v, viewedAt: new Date().toISOString() }));
        const { queue, selection } = setup({ catalog, history });
        selection.setConfigOverrides({ engine: 'legacy' });
        const built = queue.buildQueue(catalog[100], '');
        const ids = new Set(history.map(h => h.id));
        expect(built.slice(1).some(v => ids.has(v.id))).toBe(false);
    });

    it('«La teva ràdio» engega la cua i el motor tria la primera cançó', () => {
        const catalog = catalogWithClassics();
        const { queue, ctx, calls } = setup({ catalog });
        const result = queue.startDiscovery();
        expect(result.started).toBe(true);
        expect(calls.loaded).toBe(1);
        expect(ctx.activePlaylistQueue.length).toBeGreaterThanOrEqual(12);
        expect(ctx.activePlaylistId).toBe('__music_queue__');
    });
});

describe('cua, regeneració i preferències', () => {
    function started() {
        const catalog = catalogWithClassics();
        const env = setup({ catalog });
        env.queue.startDiscovery();
        return { ...env, catalog };
    }

    it('regenerar conserva el que sona, el ja sonat i els afegits a mà', () => {
        const { queue, ctx, catalog } = started();
        const manual = catalog.find(v => !ctx.activePlaylistQueue.some(q => q.id === v.id));
        queue.enqueue(manual);
        const current = ctx.activePlaylistQueue[0];
        const before = ctx.activePlaylistQueue.map(v => v.id);
        queue.regenerate();
        const after = ctx.activePlaylistQueue.map(v => v.id);
        expect(after[0]).toBe(current.id);
        expect(after[1]).toBe(manual.id);
        expect(after).not.toEqual(before);
        expect(new Set(after).size).toBe(after.length);
    });

    it('un recàlcul silenciós conserva la següent ja anunciada', () => {
        const { queue, ctx } = started();
        const announced = ctx.activePlaylistQueue[1];
        queue.regenerate({ keepNext: true });
        expect(ctx.activePlaylistQueue[1].id).toBe(announced.id);
    });

    it('«Menys com aquesta» treu la cançó de la part pendent però no la que sona', () => {
        const { queue, ctx, signals, bus } = started();
        const upcoming = ctx.activePlaylistQueue[3];
        const playing = ctx.activePlaylistQueue[0];
        queue.applyPreference(upcoming, false);
        expect(signals.isLessLike(upcoming.id)).toBe(true);
        expect(ctx.activePlaylistQueue.some(v => v.id === upcoming.id)).toBe(false);
        queue.applyPreference(playing, false);
        expect(ctx.activePlaylistQueue[0].id).toBe(playing.id);
        expect(bus).toBeTruthy();
    });

    it('«No em recomanis aquest artista» treu tot l’artista de la part pendent i és reversible', () => {
        const { queue, ctx, signals } = started();
        const target = ctx.activePlaylistQueue[5];
        queue.applyPreference(target, true);
        expect(ctx.activePlaylistQueue.slice(1).some(v => v.channelId === target.channelId)).toBe(false);
        signals.unblockArtist(target.channelId);
        expect(signals.isArtistBlocked(target.channelId)).toBe(false);
    });

    it('un cor o un seguiment compta ja per a les cues següents (snapshot)', () => {
        const catalog = catalogWithClassics();
        const liked = [];
        const env = setup({ catalog, liked });
        const target = catalog[7];
        expect(env.signals.snapshot().liked.has(target.id)).toBe(false);
        liked.push({ id: target.id, channelId: target.channelId });
        expect(env.signals.snapshot().liked.has(target.id)).toBe(true);
    });
});
