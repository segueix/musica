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

function setup({ catalog, history = [], liked = [], followed = [], mode = 'mix', music = null, extra = {} } = {}) {
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
        ...(music ? { SegueixMusicCategories: music } : {}),
        currentFeedData: {
            channels: [...new Set(catalog.map(v => v.channelId))].map(id => ({ id, categories: ['Pop'] })),
        },
        document: {
            readyState: 'loading',
            addEventListener() {},
            querySelector: () => null,
            createElement: () => ({
                set textContent(value) {
                    this.text = String(value ?? '');
                },
                get innerHTML() {
                    return (this.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                },
            }),
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
        ...extra,
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

    it('«−» treu la cançó de la part pendent però no la que sona i es pot desfer prement-lo de nou', () => {
        const { queue, ctx, signals } = started();
        const upcoming = ctx.activePlaylistQueue[3];
        const playing = ctx.activePlaylistQueue[0];
        queue.applyPreference(upcoming, 'less');
        expect(signals.isLessLike(upcoming.id)).toBe(true);
        expect(queue.getPreference(upcoming)).toBe('less');
        expect(ctx.activePlaylistQueue.some(v => v.id === upcoming.id)).toBe(false);
        queue.applyPreference(playing, 'less');
        expect(ctx.activePlaylistQueue[0].id).toBe(playing.id);
        queue.applyPreference(upcoming, 'less');
        expect(signals.isLessLike(upcoming.id)).toBe(false);
    });

    it('«+» compta per a l’algorisme i és excloent amb «−»', () => {
        const { queue, ctx, signals, selection } = started();
        const target = ctx.activePlaylistQueue[5];
        const before = selection.songTaste(String(target.id), signals.snapshot(), Date.now(), selection.getConfig());
        queue.applyPreference(target, 'more');
        expect(queue.getPreference(target)).toBe('more');
        expect(signals.isMoreLike(target.id)).toBe(true);
        expect(
            selection.songTaste(String(target.id), signals.snapshot(), Date.now(), selection.getConfig())
        ).toBeGreaterThan(before);
        queue.applyPreference(target, 'less');
        expect(signals.isMoreLike(target.id)).toBe(false);
        expect(signals.isLessLike(target.id)).toBe(true);
        queue.applyPreference(target, 'more');
        expect(signals.isLessLike(target.id)).toBe(false);
        expect(signals.isMoreLike(target.id)).toBe(true);
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

// ---------- Ràdios d'estil: categoria respectada, nom fix i «+» per barrejar estils ----------

function styledCatalog() {
    const list = [];
    const add = (prefix, count, style, extra = {}) => {
        for (let a = 0; a < count; a++) {
            for (let i = 0; i < 3; i++)
                list.push(song(`${prefix}${a}`, 0.2 + i * 0.7, { categories: [style], ...extra }));
        }
    };
    add('pop', 10, 'Pop');
    add('rock', 10, 'Rock');
    add('jazz', 8, 'Jazz / Blues');
    return list;
}

const GROUPS = ['Pop', 'Rock', 'Indie', 'Jazz / Blues'].map(label => ({ label }));
const musicStub = {
    CATEGORY_GROUPS: GROUPS,
    // L'artista «mixed» té Rock com a categoria principal (però també Pop)
    primaryCategoryForChannel: id =>
        id.startsWith('rock') || id === 'mixed' ? 'Rock' : id.startsWith('jazz') ? 'Jazz / Blues' : 'Pop',
    isCategoryEligibleVideo: () => true,
};

const fakeContainer = () => ({
    innerHTML: '',
    _mqBound: true,
    addEventListener() {},
    querySelector: () => null,
});

const stylesOf = list => list.map(v => v.categories[0]);
const share = (list, style) => list.filter(v => v.categories[0] === style).length / list.length;

describe('ràdio d’un artista o d’una categoria', () => {
    it('sense categoria clara (Novetats, fitxa d’artista) la ràdio és de la categoria principal de l’artista', () => {
        const catalog = styledCatalog();
        const env = setup({ catalog, music: musicStub });
        const rockSong = catalog.find(v => v.channelId === 'rock3');
        expect(env.queue.startFrom(rockSong.id, 'api')).toBe(true);
        expect(env.queue.getState().categories).toEqual(['Rock']);
        expect(new Set(stylesOf(env.ctx.activePlaylistQueue))).toEqual(new Set(['Rock']));
    });

    it('la categoria de la pàgina o de la fila clicada mana sobre la de l’artista', () => {
        const catalog = styledCatalog();
        const env = setup({ catalog, music: musicStub, extra: { selectedCategory: 'Jazz / Blues' } });
        const popSong = catalog.find(v => v.channelId === 'pop2');
        env.queue.startFrom(popSong.id, 'api');
        expect(env.queue.getState().categories).toEqual(['Jazz / Blues']);
    });

    it('una ràdio d’estil no barreja altres estils encara que regeneris', () => {
        const catalog = styledCatalog();
        const env = setup({ catalog, music: musicStub });
        env.queue.startFrom(catalog.find(v => v.channelId === 'pop1').id, 'api');
        for (let i = 0; i < 4; i++) {
            env.queue.regenerate();
            expect(new Set(stylesOf(env.ctx.activePlaylistQueue))).toEqual(new Set(['Pop']));
        }
    });

    it('«La teva ràdio» (general) continua sense categoria', () => {
        const env = setup({ catalog: styledCatalog(), music: musicStub });
        env.queue.startDiscovery();
        expect(env.queue.getState().categories).toEqual([]);
    });
});

describe('nom fix de la ràdio', () => {
    it('porta el nom de l’estil i no canvia amb la cançó que sona', () => {
        const catalog = styledCatalog();
        const env = setup({ catalog, music: musicStub });
        env.queue.startFrom(catalog.find(v => v.channelId === 'rock0').id, 'api');
        const nameOf = () => {
            const container = fakeContainer();
            env.queue.render(container);
            const html = container.innerHTML;
            const from = html.indexOf('<span class="mq-source');
            return html.slice(from, html.indexOf('<button type="button" class="mq-regenerate', from));
        };
        const first = nameOf();
        expect(first).toContain('mq-style');
        expect(first).toContain('Rock');
        expect(first).not.toContain('Basada en');
        // Avança per tres cançons d'artistes diferents: el nom és exactament el mateix
        for (let i = 0; i < 3; i++) {
            env.ctx.currentPlaylistIndex += 1;
            expect(nameOf()).toBe(first);
        }
    });

    it('la ràdio general es diu «La teva ràdio»', () => {
        const env = setup({ catalog: styledCatalog(), music: musicStub });
        env.queue.startDiscovery();
        const container = fakeContainer();
        env.queue.render(container);
        expect(container.innerHTML).toContain('La teva ràdio');
        expect(container.innerHTML).not.toContain('Basada en');
    });
});

describe('«+»: sumar un estil a la ràdio', () => {
    function radioOf(style = 'pop1') {
        const catalog = styledCatalog();
        const env = setup({ catalog, music: musicStub });
        env.queue.startFrom(catalog.find(v => v.channelId === style).id, 'api');
        return { ...env, catalog };
    }

    it('el selector ofereix els estils que encara no hi són i mostra el «+» al costat del nom', () => {
        const env = radioOf();
        const container = fakeContainer();
        env.queue.render(container);
        expect(container.innerHTML).toContain('data-mq-add-style');
        expect(container.innerHTML).toContain('aria-expanded="false"');
        expect(container.innerHTML).not.toContain('data-mq-pick-style');
    });

    it('en sumar un estil la ràdio es regenera barrejant els dos a parts iguals i el nom porta els dos estils', () => {
        const env = radioOf();
        const current = env.ctx.activePlaylistQueue[0];
        const manual = env.catalog.find(v => v.categories[0] === 'Jazz / Blues');
        env.queue.enqueue(manual);
        expect(env.queue.addStyle('Rock')).toBe(true);
        expect(env.queue.getState().categories).toEqual(['Pop', 'Rock']);
        const queue = env.ctx.activePlaylistQueue;
        // Es conserva el que sona i el que l'usuari havia afegit
        expect(queue[0].id).toBe(current.id);
        expect(queue[1].id).toBe(manual.id);
        const auto = queue.slice(2, 22);
        expect(new Set(stylesOf(auto))).toEqual(new Set(['Pop', 'Rock']));
        expect(share(auto, 'Rock')).toBeGreaterThanOrEqual(0.35);
        expect(share(auto, 'Rock')).toBeLessThanOrEqual(0.65);
        expect(auto.some(v => v.categories[0] === 'Jazz / Blues')).toBe(false);
        const container = fakeContainer();
        env.queue.render(container);
        expect(container.innerHTML).toContain('Pop');
        expect(container.innerHTML).toContain('Rock');
        expect(container.innerHTML).toContain('data-mq-remove-style');
    });

    it('«Barreja» manté els dos estils; es pot sumar-ne un tercer i treure’n un', () => {
        const env = radioOf();
        env.queue.addStyle('Rock');
        env.queue.regenerate();
        expect(new Set(stylesOf(env.ctx.activePlaylistQueue.slice(1)))).toEqual(new Set(['Pop', 'Rock']));
        env.queue.addStyle('Jazz / Blues');
        expect(env.queue.getState().categories).toEqual(['Pop', 'Rock', 'Jazz / Blues']);
        expect(new Set(stylesOf(env.ctx.activePlaylistQueue.slice(1, 25)))).toEqual(
            new Set(['Pop', 'Rock', 'Jazz / Blues'])
        );
        expect(env.queue.removeStyle('Rock')).toBe(true);
        expect(env.queue.getState().categories).toEqual(['Pop', 'Jazz / Blues']);
        expect(env.ctx.activePlaylistQueue.slice(1).some(v => v.categories[0] === 'Rock')).toBe(false);
    });

    it('no es pot sumar dues vegades el mateix estil ni treure l’últim que queda', () => {
        const env = radioOf();
        expect(env.queue.addStyle('Pop')).toBe(false);
        expect(env.queue.removeStyle('Pop')).toBe(false);
        expect(env.queue.getState().categories).toEqual(['Pop']);
    });

    it('el nom de la llista de YouTube porta els dos estils', () => {
        const env = radioOf();
        env.queue.addStyle('Rock');
        expect(env.queue.buildListName()).toBe('Llista Pop + Rock');
    });

    it('sumar un estil a la ràdio general la converteix en una ràdio d’aquell estil', () => {
        const env = setup({ catalog: styledCatalog(), music: musicStub });
        env.queue.startDiscovery();
        env.queue.addStyle('Jazz / Blues');
        expect(env.queue.getState().categories).toEqual(['Jazz / Blues']);
        expect(new Set(stylesOf(env.ctx.activePlaylistQueue.slice(1)))).toEqual(new Set(['Jazz / Blues']));
    });

    it('una selecció (Acabades de sortir...) que es regenera passa a ser una ràdio de l’estil de la cançó que sona', () => {
        const catalog = styledCatalog();
        const env = setup({ catalog, music: musicStub });
        const selection = catalog.filter(v => v.channelId === 'rock2');
        env.queue.playSelection(selection, 'Acabades de sortir');
        expect(env.queue.getState().categories).toEqual([]);
        env.queue.regenerate();
        expect(env.queue.getState().categories).toEqual(['Rock']);
    });
});
