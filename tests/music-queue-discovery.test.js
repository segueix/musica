import { describe, expect, it } from 'vitest';
import { createMockLocalStorage, loadScript } from './setup.js';

const DAY = 86400000;
const NOW = Date.now();
const helpers = loadScript('js/utils/helpers.js', { YouTubeAPI: undefined });

let counter = 0;
const song = (channelId, daysAgo = 5, extra = {}) => {
    counter += 1;
    return {
        id: `q${String(counter).padStart(9, '0')}`.slice(0, 11),
        title: `Cançó ${counter}`,
        channelId,
        channelTitle: `Artista ${channelId}`,
        thumbnail: `t${counter}.jpg`,
        contentType: 'song',
        durationSeconds: 200,
        publishedAt: new Date(NOW - daysAgo * DAY).toISOString(),
        categories: ['Pop'],
        ...extra,
    };
};

// 12 artistes amb 2 cançons cadascun
const ARTISTS = 'ABCDEFGHIJKL'.split('');
const catalog = ARTISTS.flatMap((id, i) => [song(id, 3 + i), song(id, 40 + i)]);

// Munta discovery + music-queue en el mateix espai d'aplicació i simula els globals d'app.js.
function setup({ history = [], liked = [], followed = [], mode } = {}) {
    const app = { features: {}, state: {}, utils: {} };
    const localStorage = createMockLocalStorage();
    if (mode) localStorage.setItem('catube_discovery_mode', mode);
    loadScript('js/features/discovery.js', {
        SegueixApp: app,
        localStorage,
        getHistoryItems: () => history,
        getLikedVideos: () => liked,
        getFollowedChannelIds: () => followed,
        getHiddenChannelIds: () => [],
    });
    const calls = { loaded: 0, refreshed: 0 };
    const globals = {
        SegueixApp: app,
        localStorage,
        document: {
            readyState: 'loading',
            addEventListener() {},
            createElement: () => ({}),
            body: { classList: { contains: () => false } },
        },
        getVideoArtistKey: helpers.getVideoArtistKey,
        spreadVideosByArtist: helpers.spreadVideosByArtist,
        limitClassicFrequency: helpers.limitClassicFrequency,
        currentFeedVideos: catalog,
        cachedAPIVideos: [],
        currentFeedData: { channels: ARTISTS.map(id => ({ id, name: `Artista ${id}`, categories: ['Pop'] })) },
        filterOutWatchedVideos: list => list.filter(v => !history.some(h => h.id === v.id)),
        getHiddenChannelIds: () => [],
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
        activePlaylistQueue: [],
        currentPlaylistIndex: 0,
        selectedCategory: 'Novetats',
    };
    const ctx = loadScript('js/features/music-queue.js', globals);
    return { ctx, calls, queue: app.features.musicQueue, discovery: app.features.discovery, localStorage };
}

const known = ['A', 'B', 'C', 'D'];
const knownHistory = known.map(id => ({
    ...catalog.find(v => v.channelId === id),
    viewedAt: new Date().toISOString(),
}));
const artistsOf = list => list.map(v => v.channelId);

describe('«Fes-la sonar» (startDiscovery)', () => {
    it('sense historial engega una ràdio variada i ho explica', () => {
        const { ctx, queue, calls } = setup({ mode: 'home' });
        const result = queue.startDiscovery();
        expect(result.started).toBe(true);
        expect(result.mode).toBe('variety');
        expect(result.note).toMatch(/historial/);
        expect(calls.loaded).toBe(1);
        expect(ctx.isPlaylistMode).toBe(true);
        expect(ctx.activePlaylistId).toBe('__music_queue__');
        expect(ctx.activePlaylistQueue.length).toBeGreaterThanOrEqual(12);
        // Una sola cançó per artista a la cua
        const artists = artistsOf(ctx.activePlaylistQueue);
        expect(new Set(artists).size).toBe(artists.length);
        expect(queue.getState().meta.note).toMatch(/historial/);
    });

    it('«A casa» comença per un artista que ja ha escoltat', () => {
        const { ctx, queue } = setup({ history: knownHistory, mode: 'home' });
        const result = queue.startDiscovery();
        expect(result.started).toBe(true);
        expect(result.mode).toBe('home');
        expect(known).toContain(ctx.activePlaylistQueue[0].channelId);
        const firstFour = artistsOf(ctx.activePlaylistQueue.slice(0, 4));
        expect(firstFour.every(id => known.includes(id))).toBe(true);
    });

    it('«Sorprèn-me» dona més pes als artistes encara no escoltats', () => {
        const { ctx, queue } = setup({ history: knownHistory, mode: 'surprise' });
        queue.startDiscovery();
        expect(known).not.toContain(ctx.activePlaylistQueue[0].channelId);
        const firstFour = artistsOf(ctx.activePlaylistQueue.slice(0, 4));
        expect(firstFour.every(id => !known.includes(id))).toBe(true);
    });

    it('«Una mica de tot» alterna coneguts i descoberta', () => {
        const { ctx, queue } = setup({ history: knownHistory, mode: 'mix' });
        queue.startDiscovery();
        const kinds = artistsOf(ctx.activePlaylistQueue.slice(0, 6)).map(id => (known.includes(id) ? 'K' : 'F'));
        expect(kinds).toEqual(['K', 'F', 'K', 'F', 'K', 'F']);
    });

    it('no engega res si no hi ha música al feed', () => {
        const { ctx, queue, calls } = setup();
        ctx.currentFeedVideos = [];
        expect(queue.startDiscovery().started).toBe(false);
        expect(calls.loaded).toBe(0);
    });

    it('no engega res per si sol: només quan es crida', () => {
        const { ctx, calls } = setup();
        expect(calls.loaded).toBe(0);
        expect(ctx.isPlaylistMode).toBe(false);
    });
});

describe('canviar el mode no interromp la cançó actual', () => {
    it('la cua i la cançó queden intactes fins que es regenera', () => {
        const { ctx, queue, calls, discovery } = setup({ history: knownHistory, mode: 'home' });
        queue.startDiscovery();
        const before = ctx.activePlaylistQueue;
        const beforeIds = before.map(v => v.id);
        const loaded = calls.loaded;
        discovery.setMode('surprise');
        expect(ctx.activePlaylistQueue).toBe(before);
        expect(ctx.activePlaylistQueue.map(v => v.id)).toEqual(beforeIds);
        expect(ctx.currentPlaylistIndex).toBe(0);
        expect(calls.loaded).toBe(loaded); // no s'ha tornat a carregar cap vídeo
    });

    it('en regenerar s’aplica el mode nou i es manté el que sona', () => {
        const { ctx, queue, discovery } = setup({ history: knownHistory, mode: 'home' });
        queue.startDiscovery();
        const current = ctx.activePlaylistQueue[0];
        discovery.setMode('surprise');
        queue.regenerate();
        expect(ctx.activePlaylistQueue[0].id).toBe(current.id);
        expect(ctx.currentPlaylistIndex).toBe(0);
        const upcoming = artistsOf(ctx.activePlaylistQueue.slice(1, 5));
        expect(upcoming.every(id => !known.includes(id))).toBe(true);
        expect(queue.getState().meta.mode).toBe('surprise');
    });
});

describe('«Afegeix a la cua»', () => {
    const extra = () => song('Z', 1);

    it('amb la ràdio sonant, entra després de la que sona i respecta l’ordre d’afegit', () => {
        const { ctx, queue } = setup();
        queue.startDiscovery();
        const first = extra();
        const second = extra();
        expect(queue.enqueue(first).status).toBe('queued');
        expect(queue.enqueue(second).status).toBe('queued');
        expect(ctx.activePlaylistQueue[1].id).toBe(first.id);
        expect(ctx.activePlaylistQueue[2].id).toBe(second.id);
        expect(ctx.currentPlaylistIndex).toBe(0);
        expect(queue.enqueue(first).status).toBe('exists');
    });

    it('les afegides a mà se salven en regenerar la cua', () => {
        const { ctx, queue } = setup();
        queue.startDiscovery();
        const mine = extra();
        queue.enqueue(mine);
        queue.regenerate();
        expect(ctx.activePlaylistQueue[1].id).toBe(mine.id);
    });

    it('si encara no sona res, espera i sona just després de la primera cançó', () => {
        const { ctx, queue } = setup();
        const mine = extra();
        expect(queue.enqueue(mine).status).toBe('pending');
        expect(queue.getState().pending).toBe(1);
        expect(queue.enqueue(mine).status).toBe('exists');
        queue.startDiscovery();
        expect(ctx.activePlaylistQueue[1].id).toBe(mine.id);
        expect(queue.getState().pending).toBe(0);
    });

    it('no modifica una llista de l’usuari ni accepta Shorts', () => {
        const { ctx, queue } = setup();
        ctx.isPlaylistMode = true;
        ctx.activePlaylistId = 'pl_1';
        ctx.activePlaylistQueue = [song('A')];
        expect(queue.enqueue(extra()).status).toBe('unsupported');
        expect(ctx.activePlaylistQueue).toHaveLength(1);
        expect(queue.enqueue(song('B', 1, { isShort: true })).status).toBe('unsupported');
    });
});

describe('reproduir una selecció', () => {
    it('la cua és la selecció tal com és, sense duplicats ni Shorts', () => {
        const { ctx, queue, calls } = setup();
        const picked = [catalog[0], catalog[2], catalog[0], song('Y', 1, { isShort: true }), catalog[4]];
        expect(queue.playSelection(picked, 'Acabades de sortir')).toBe(true);
        expect(ctx.activePlaylistQueue.map(v => v.id)).toEqual([catalog[0].id, catalog[2].id, catalog[4].id]);
        expect(ctx.currentPlaylistIndex).toBe(0);
        expect(calls.loaded).toBe(1);
        expect(queue.playSelection([], 'Res')).toBe(false);
    });

    it('en regenerar deixa de ser una selecció i torna a ser una ràdio', () => {
        const { ctx, queue } = setup();
        queue.playSelection(catalog.slice(0, 6), 'En directe');
        queue.regenerate();
        expect(ctx.activePlaylistQueue.length).toBeGreaterThan(6);
        expect(ctx.activePlaylistQueue[0].id).toBe(catalog[0].id);
    });
});
