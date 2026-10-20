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

// Catàleg amb estils i visualitzacions: A (Pop) i B (Rock) són els artistes propis; la resta, per omplir.
function personalCatalog({ ownSongs = 3 } = {}) {
    const list = [];
    for (let i = 0; i < ownSongs; i++) list.push(song('A', 2 + i, { categories: ['Pop'], viewCount: 100 + i }));
    for (let i = 0; i < ownSongs; i++) list.push(song('B', 3 + i, { categories: ['Rock'], viewCount: 100 + i }));
    'CDEFGHIJ'.split('').forEach((id, a) => {
        for (let i = 0; i < 4; i++) list.push(song(id, 4 + i, { categories: ['Pop'], viewCount: 10000 * (a + 1) + i }));
    });
    'MNOP'.split('').forEach((id, a) => {
        for (let i = 0; i < 4; i++) list.push(song(id, 4 + i, { categories: ['Rock'], viewCount: 5000 * (a + 1) + i }));
    });
    'XYZ'.split('').forEach(id => {
        for (let i = 0; i < 4; i++) list.push(song(id, 4 + i, { categories: ['Jazz / Blues'], viewCount: 9e9 + i }));
    });
    return list;
}

describe('«La teva ràdio»: només el que t’agrada i segueixes', () => {
    it('amb prou cançons dels teus artistes, la ràdio és només seva (el mode no hi compta)', () => {
        for (const mode of ['home', 'mix', 'surprise', 'new']) {
            const list = personalCatalog({ ownSongs: 25 });
            const liked = [list.find(v => v.channelId === 'B')];
            const env = setup({ followed: ['A'], liked, mode });
            env.ctx.currentFeedVideos = list;
            const result = env.queue.startDiscovery();
            expect(result.started).toBe(true);
            expect(result.note).toBe('');
            const artists = new Set(artistsOf(env.ctx.activePlaylistQueue));
            expect([...artists].sort()).toEqual(['A', 'B']);
        }
    });

    it('si no n’hi ha prou, s’omple amb les més escoltades dels seus estils (mai d’un altre estil)', () => {
        const list = personalCatalog();
        const env = setup({ followed: ['A'], liked: [list.find(v => v.channelId === 'B')] });
        env.ctx.currentFeedVideos = list;
        const result = env.queue.startDiscovery();
        expect(result.started).toBe(true);
        expect(result.note).toMatch(/més escoltades/);
        const queue = env.ctx.activePlaylistQueue;
        // La primera és d'un artista propi i totes les cançons pròpies hi són
        expect(['A', 'B']).toContain(queue[0].channelId);
        const own = list.filter(v => v.channelId === 'A' || v.channelId === 'B').map(v => v.id);
        expect(own.every(id => queue.some(v => v.id === id))).toBe(true);
        // Les altres són de Pop o Rock (els estils d'A i B), cap de Jazz encara que tinguin més visualitzacions
        const others = queue.filter(v => !['A', 'B'].includes(v.channelId));
        expect(others.length).toBeGreaterThan(0);
        expect(others.every(v => ['Pop', 'Rock'].includes(v.categories[0]))).toBe(true);
    });

    it('no té selector de modes: es diu «La teva ràdio» i en surt el «Barreja», desar i compartir', () => {
        const list = personalCatalog();
        const env = setup({ followed: ['A', 'B'] });
        env.ctx.currentFeedVideos = list;
        env.queue.startDiscovery();
        const container = { innerHTML: '', _mqBound: true, addEventListener() {}, querySelector: () => null };
        env.queue.render(container);
        expect(env.queue.playlistName()).toBe('La teva ràdio');
        expect(container.innerHTML).not.toContain('data-mq-mode');
        expect(container.innerHTML).not.toContain('mq-mode');
        expect(container.innerHTML).toContain('data-mq-regenerate');
        expect(container.innerHTML).toContain('data-mq-save-list');
        expect(env.queue.setDiscoveryMode('surprise')).toBeNull();
    });

    it('«Continua la ràdio» torna a fer «La teva ràdio» des de la mateixa cançó', () => {
        const list = personalCatalog({ ownSongs: 25 });
        const env = setup({ followed: ['A', 'B'] });
        env.ctx.currentFeedVideos = list;
        const first = env.queue.startDiscovery().seed;
        expect(env.queue.getLastRadio()).toMatchObject({ id: first.id, personal: true });
        env.ctx.activePlaylistQueue = [];
        expect(env.queue.resumeLast()).toBe(true);
        expect(env.ctx.activePlaylistQueue[0].id).toBe(first.id);
        expect(new Set(artistsOf(env.ctx.activePlaylistQueue))).toEqual(new Set(['A', 'B']));
    });

    it('sense m’agrades ni seguits engega les més escoltades i ho explica', () => {
        const { ctx, queue, calls } = setup();
        ctx.currentFeedVideos = personalCatalog();
        const result = queue.startDiscovery();
        expect(result.started).toBe(true);
        expect(result.note).toMatch(/més escoltades/);
        expect(calls.loaded).toBe(1);
        expect(ctx.activePlaylistId).toBe('__music_queue__');
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

describe('personalRadioPool (pura)', () => {
    const { queue } = setup();
    const keyOf = v => v.channelId;
    const stylesOf = v => v.categories || [];

    it('les cançons amb m’agrada, i totes les dels seus artistes i dels seguits', () => {
        const list = personalCatalog({ ownSongs: 25 });
        const liked = [list.find(v => v.channelId === 'B')];
        const plan = queue.personalRadioPool({ candidates: list, liked, followedKeys: ['A'], keyOf, stylesOf });
        expect(plan.own).toHaveLength(50);
        expect(plan.filler).toEqual([]);
        expect(plan.styles.sort()).toEqual(['Pop', 'Rock']);
    });

    it('omple fins a la mida amb les més escoltades dels estils propis, com a molt dues per artista', () => {
        const list = personalCatalog();
        const plan = queue.personalRadioPool({ candidates: list, followedKeys: ['A'], keyOf, stylesOf, size: 10 });
        expect(plan.own).toHaveLength(3);
        expect(plan.filler).toHaveLength(7);
        expect(plan.filler.every(v => v.categories[0] === 'Pop' && v.channelId !== 'A')).toBe(true);
        // De més a menys visualitzacions, i dues per artista: J, J, I, I, H, H, G
        expect(plan.filler.map(v => v.channelId)).toEqual(['J', 'J', 'I', 'I', 'H', 'H', 'G']);
    });

    it('sense res propi: els estils triats la primera vegada o, si no, les més escoltades de tot', () => {
        const list = personalCatalog();
        const chosen = queue.personalRadioPool({
            candidates: list,
            keyOf,
            stylesOf,
            fallbackStyles: ['Rock'],
            size: 4,
        });
        expect(chosen.own).toEqual([]);
        expect(chosen.filler.map(v => v.channelId)).toEqual(['P', 'P', 'O', 'O']);
        const all = queue.personalRadioPool({ candidates: list, keyOf, stylesOf, size: 4 });
        // (empat de visualitzacions entre X, Y i Z: mana l'ordre del catàleg)
        expect(all.filler.map(v => v.channelId)).toEqual(['X', 'Y', 'Z', 'X']);
    });

    it('no repeteix una cançó que ja és pròpia (el mateix títol d’un altre canal)', () => {
        const list = personalCatalog();
        const copy = { ...list.find(v => v.channelId === 'J'), id: 'copia000001', title: list[0].title };
        const plan = queue.personalRadioPool({
            candidates: [...list, copy],
            followedKeys: ['A'],
            keyOf,
            stylesOf,
        });
        expect(plan.filler.some(v => v.id === copy.id)).toBe(false);
    });
});

describe('canviar el mode no interromp la cançó actual', () => {
    it('la cua i la cançó queden intactes fins que es regenera', () => {
        const { ctx, queue, calls, discovery } = setup({ history: knownHistory, mode: 'home' });
        queue.startFrom(catalog[0].id, 'api');
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
        queue.startFrom(catalog[0].id, 'api');
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

describe('«La teva ràdio»: primera vegada', () => {
    it('amb estils triats i res més, sonen les més escoltades d’aquells estils', () => {
        const env = setup({ mode: 'home' });
        env.ctx.currentFeedVideos = personalCatalog();
        env.discovery.setFirstStyles(['Rock']);
        const result = env.queue.startDiscovery();
        expect(result.started).toBe(true);
        expect(result.note).toMatch(/més escoltades de Rock/);
        expect(env.ctx.activePlaylistQueue.every(v => v.categories[0] === 'Rock')).toBe(true);
    });

    it('amb m’agrades o seguits, els estils triats la primera vegada ja no manen', () => {
        const env = setup({ followed: ['A', 'B'], mode: 'home' });
        env.ctx.currentFeedVideos = personalCatalog({ ownSongs: 25 });
        env.discovery.setFirstStyles(['Jazz / Blues']);
        env.queue.startDiscovery();
        expect(new Set(artistsOf(env.ctx.activePlaylistQueue))).toEqual(new Set(['A', 'B']));
    });
});
