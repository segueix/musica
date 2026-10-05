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

describe('ràdio generada amb els resultats d’una cerca', () => {
    // Resultats que barregen estils i artistes, com els d'una cerca
    function found(catalog) {
        const pick = prefix => catalog.filter(v => v.channelId.startsWith(prefix)).slice(0, 6);
        return [...pick('pop'), ...pick('rock'), ...pick('jazz')].filter((v, i, list) => list.indexOf(v) === i);
    }
    function searchRadio(options = {}) {
        const catalog = styledCatalog();
        const env = setup({ catalog, music: musicStub, ...options });
        const results = options.results ? options.results(catalog) : found(catalog);
        const started = env.queue.startFromSearch(results, { query: 'nit' });
        return { ...env, catalog, results, started };
    }
    const ids = list => list.map(v => v.id);

    it('engega una ràdio només amb les cançons trobades, encara que barregin estils', () => {
        const { started, results, ctx, calls } = searchRadio();
        expect(started).toBe(true);
        expect(calls.loaded).toBe(1);
        expect(ctx.activePlaylistId).toBe('__music_queue__');
        expect(new Set(ids(ctx.activePlaylistQueue))).toEqual(new Set(ids(results)));
        expect(new Set(ctx.activePlaylistQueue.map(v => v.categories[0]))).toEqual(
            new Set(['Pop', 'Rock', 'Jazz / Blues'])
        );
    });

    it('la primera cançó és la millor coincidència i cap cançó es repeteix', () => {
        const { results, ctx } = searchRadio();
        expect(ctx.activePlaylistQueue[0].id).toBe(results[0].id);
        expect(new Set(ids(ctx.activePlaylistQueue)).size).toBe(ctx.activePlaylistQueue.length);
    });

    it('no la restringeix a la categoria seleccionada ni li assigna un estil', () => {
        const { queue, ctx } = searchRadio({ extra: { selectedCategory: 'Jazz / Blues' } });
        expect(queue.getStyles()).toEqual([]);
        expect(queue.getState()).toMatchObject({ search: 'nit', isRadio: true, categories: [] });
        expect(new Set(ctx.activePlaylistQueue.map(v => v.categories[0])).size).toBe(3);
    });

    it('no té «+» d’estils: el nom és el de la cerca i addStyle no la canvia', () => {
        const { queue, ctx } = searchRadio();
        expect(queue.addStyle('Rock')).toBe(false);
        expect(queue.getStyles()).toEqual([]);
        expect(queue.buildListName()).toBe('Llista nit');
        expect(ctx.activePlaylistQueue.length).toBeGreaterThan(2);
    });

    it('regenerar («Barreja») manté el que sona i el ja sonat, i només fa servir els resultats', () => {
        const { queue, ctx, results } = searchRadio();
        ctx.currentPlaylistIndex = 2;
        const played = ids(ctx.activePlaylistQueue.slice(0, 3));
        queue.regenerate();
        expect(ids(ctx.activePlaylistQueue.slice(0, 3))).toEqual(played);
        expect(ids(ctx.activePlaylistQueue).every(id => ids(results).includes(id))).toBe(true);
        expect(queue.getState().search).toBe('nit');
        expect(new Set(ids(ctx.activePlaylistQueue)).size).toBe(ctx.activePlaylistQueue.length);
    });

    it('si ja han sonat totes les cançons trobades, «Barreja» no deixa la cua buida', () => {
        const { queue, ctx } = searchRadio();
        ctx.currentPlaylistIndex = ctx.activePlaylistQueue.length - 1;
        queue.regenerate();
        expect(ctx.activePlaylistQueue.length).toBeGreaterThan(ctx.currentPlaylistIndex + 1);
    });

    it('amb el motor antic (legacy) també entren totes i no hi ha dos artistes seguits si es pot evitar', () => {
        const catalog = styledCatalog();
        const env = setup({ catalog, music: musicStub });
        env.selection.setConfigOverrides({ engine: 'legacy' });
        const results = found(catalog);
        expect(env.queue.startFromSearch(results, { query: 'nit' })).toBe(true);
        const queue = env.ctx.activePlaylistQueue;
        expect(new Set(ids(queue))).toEqual(new Set(ids(results)));
        queue.forEach((v, i) => {
            if (i > 0) expect(v.channelId).not.toBe(queue[i - 1].channelId);
        });
    });

    it('deixa fora els artistes amagats i el que l’usuari ha rebutjat', () => {
        const catalog = styledCatalog();
        const results = found(catalog);
        const hiddenChannel = results[0].channelId;
        const env = setup({ catalog, music: musicStub, extra: { getHiddenChannelIds: () => [hiddenChannel] } });
        env.signals.lessLikeThis(results[10]);
        expect(env.queue.startFromSearch(results, { query: 'nit' })).toBe(true);
        const queued = env.ctx.activePlaylistQueue;
        expect(queued.some(v => v.channelId === hiddenChannel)).toBe(false);
        expect(queued.some(v => v.id === results[10].id)).toBe(false);
    });

    it('amb menys de 2 cançons reproduïbles no engega res', () => {
        const catalog = styledCatalog();
        const env = setup({ catalog, music: musicStub });
        expect(env.queue.startFromSearch([catalog[0]], { query: 'nit' })).toBe(false);
        expect(env.queue.startFromSearch([{ ...catalog[1], isShort: true }, catalog[2]], { query: 'nit' })).toBe(false);
        expect(env.queue.startFromSearch([], { query: 'nit' })).toBe(false);
        expect(env.calls.loaded).toBe(0);
    });

    it('les cançons afegides abans a la cua sonen just després de la primera', () => {
        const catalog = styledCatalog();
        const env = setup({ catalog, music: musicStub });
        const extra = catalog[catalog.length - 1];
        env.queue.enqueue(extra);
        const results = found(catalog);
        env.queue.startFromSearch(results, { query: 'nit' });
        expect(env.ctx.activePlaylistQueue[1].id).toBe(extra.id);
    });

    it('obrir una cançó després (clic normal) torna a una ràdio d’estil i esborra la cerca', () => {
        const { queue, ctx, catalog } = searchRadio();
        queue.startFrom(catalog[catalog.length - 1].id, 'api');
        expect(queue.getState().search).toBe('');
        expect(queue.getState().categories.length).toBe(1);
        expect(ctx.activePlaylistQueue.length).toBeGreaterThan(2);
    });

    it('un «+ com aquesta» durant la ràdio de cerca continua dins dels resultats', () => {
        const { queue, signals, ctx, results, bus } = searchRadio();
        signals.moreLikeThis(ctx.activePlaylistQueue[0]);
        bus.dispatchEvent(
            new bus.CustomEvent('segueix:music-prefs-changed', { detail: { type: 'moreLike', on: true } })
        );
        queue.regenerate({ keepNext: true });
        expect(ids(ctx.activePlaylistQueue).every(id => ids(results).includes(id))).toBe(true);
    });
});

describe('desar la ràdio com a llista de reproducció', () => {
    // Biblioteca i avisos simulats: les llistes viuen a «store» i cada desat avisa com el real
    function withLibrary(env) {
        const store = { playlists: [], saves: 0, toasts: [] };
        env.app.features.library = {
            getPlaylists: () => JSON.parse(JSON.stringify(store.playlists)),
            savePlaylists: playlists => {
                store.playlists = JSON.parse(JSON.stringify(playlists));
                store.saves += 1;
            },
            getPlaylistVideoData: video => ({
                id: video.id,
                title: video.title,
                thumbnail: video.thumbnail,
                channelTitle: video.channelTitle,
                channelId: video.channelId,
                source: 'api',
            }),
        };
        env.app.features.shellNav = { toast: (message, options) => store.toasts.push({ message, options }) };
        return store;
    }
    function radio(style = 'pop1') {
        const catalog = styledCatalog();
        const env = setup({ catalog, music: musicStub });
        const store = withLibrary(env);
        env.queue.startFrom(catalog.find(v => v.channelId === style).id, 'api');
        return { ...env, catalog, store };
    }
    const ids = list => list.map(v => v.id);

    it('el nom de la ràdio ja no porta el text del mode («· Sorprèn-me»): hi ha el símbol de desar com a llista', () => {
        for (const mode of ['home', 'mix', 'surprise']) {
            const catalog = styledCatalog();
            const history = catalog.slice(0, 30).map(v => ({ ...v, viewedAt: new Date().toISOString() }));
            const env = setup({ catalog, music: musicStub, mode, history, liked: catalog.slice(40, 46) });
            env.queue.startDiscovery();
            const container = fakeContainer();
            env.queue.render(container);
            const html = container.innerHTML;
            // El mode surt només al selector propi (després del nom), mai enganxat al nom de la ràdio
            const name = html.slice(html.indexOf('<span class="mq-source'), html.indexOf('<div class="mq-mode">'));
            expect(name).not.toContain('Sorprèn-me');
            expect(name).not.toContain('Una mica de tot');
            expect(name).not.toContain('Els meus de sempre');
            expect(html).toContain('data-mq-save-list');
        }
    });

    it('el símbol és un botó accessible, amb nom i sense text visible', () => {
        const env = radio();
        const container = fakeContainer();
        env.queue.render(container);
        const button = container.innerHTML.match(/<button[^>]*data-mq-save-list[^>]*>([\s\S]*?)<\/button>/);
        expect(button[0]).toContain('aria-label="Desa la ràdio com a llista de reproducció"');
        expect(button[1]).toContain('<svg');
        expect(button[1].replace(/<svg[\s\S]*<\/svg>/, '').trim()).toBe('');
    });

    it('desa tota la ràdio (ja sonat, sona i ve) a les llistes amb el nom de l’estil', () => {
        const env = radio('rock1');
        env.ctx.currentPlaylistIndex = 3;
        const queue = ids(env.ctx.activePlaylistQueue);
        const result = env.queue.saveAsPlaylist();
        expect(result).toMatchObject({ status: 'saved', name: 'Ràdio Rock', count: queue.length });
        expect(env.store.playlists).toHaveLength(1);
        const list = env.store.playlists[0];
        expect(list.name).toBe('Ràdio Rock');
        expect(list.id).toMatch(/^pl_/);
        expect(ids(list.videos)).toEqual(queue);
        expect(list.videos[0]).toMatchObject({ title: expect.any(String), source: 'api' });
        expect(env.store.toasts[0].message).toBe('Llista «Ràdio Rock» desada a les teves llistes.');
        expect(env.store.toasts[0].options.action.label).toBe('Obre');
    });

    it('el nom és el de la ràdio: estils barrejats, general, cerca i selecció', () => {
        const a = radio('pop1');
        a.queue.addStyle('Rock');
        expect(a.queue.playlistName()).toBe('Ràdio Pop + Rock');

        const catalog = styledCatalog();
        const b = setup({ catalog, music: musicStub });
        withLibrary(b);
        b.queue.startDiscovery();
        expect(b.queue.playlistName()).toBe('La teva ràdio');

        b.queue.startFromSearch(catalog.slice(0, 12), { query: 'nit' });
        expect(b.queue.playlistName()).toBe('Cerca: nit');

        b.queue.playSelection(catalog.slice(0, 12), 'Acabades de sortir');
        expect(b.queue.playlistName()).toBe('Acabades de sortir');
    });

    it('tornar a prémer actualitza la mateixa llista en lloc de crear-ne una altra', () => {
        const env = radio();
        env.queue.saveAsPlaylist();
        const extra = env.catalog.find(v => !env.ctx.activePlaylistQueue.some(q => q.id === v.id));
        env.queue.enqueue(extra);
        const result = env.queue.saveAsPlaylist();
        expect(result.status).toBe('updated');
        expect(env.store.playlists).toHaveLength(1);
        expect(ids(env.store.playlists[0].videos)).toContain(extra.id);
        expect(env.store.toasts[1].message).toBe('Llista «Ràdio Pop» actualitzada.');
        expect(env.queue.getState().savedListId).toBe(env.store.playlists[0].id);
    });

    it('si l’usuari esborra la llista desada, el botó en crea una de nova', () => {
        const env = radio();
        env.queue.saveAsPlaylist();
        env.store.playlists = [];
        const container = fakeContainer();
        env.queue.render(container);
        expect(container.innerHTML).not.toContain('is-saved');
        expect(env.queue.saveAsPlaylist().status).toBe('saved');
        expect(env.store.playlists).toHaveLength(1);
    });

    it('una altra ràdio amb el mateix nom rep un número, sense trepitjar la llista de l’usuari', () => {
        const env = radio();
        env.store.playlists = [{ id: 'pl_a', name: 'Ràdio Pop', videos: [] }];
        expect(env.queue.saveAsPlaylist().name).toBe('Ràdio Pop (2)');
        // Una ràdio nova (la d'abans s'ha parat) de Pop: mateix nom, número següent
        env.ctx.isPlaylistMode = false;
        env.ctx.activePlaylistId = null;
        env.queue.startFrom(env.catalog.find(v => v.channelId === 'pop3').id, 'api');
        expect(env.queue.saveAsPlaylist().name).toBe('Ràdio Pop (3)');
        expect(env.store.playlists.map(l => l.name)).toEqual(['Ràdio Pop', 'Ràdio Pop (2)', 'Ràdio Pop (3)']);
        // La llista que ja hi era continua intacta
        expect(env.store.playlists[0]).toEqual({ id: 'pl_a', name: 'Ràdio Pop', videos: [] });
    });

    it('el símbol canvia a «desada» (accent) quan la ràdio ja és una llista, i torna a no desada en una ràdio nova', () => {
        const env = radio();
        const html = () => {
            const container = fakeContainer();
            env.queue.render(container);
            return container.innerHTML;
        };
        expect(html()).not.toContain('is-saved');
        env.queue.saveAsPlaylist();
        expect(html()).toContain('is-saved');
        expect(html()).toContain('Ràdio desada com a llista');
        env.queue.startFrom(env.catalog.find(v => v.channelId === 'rock2').id, 'api');
        expect(html()).not.toContain('is-saved');
        expect(env.queue.getState().savedListId).toBe('');
    });

    it('la ràdio d’una cerca i una selecció també es poden desar, amb el seu nom', () => {
        const catalog = styledCatalog();
        const env = setup({ catalog, music: musicStub });
        const store = withLibrary(env);
        env.queue.startFromSearch(catalog.slice(0, 15), { query: 'nit' });
        const container = fakeContainer();
        env.queue.render(container);
        expect(container.innerHTML).toContain('data-mq-save-list');
        expect(env.queue.saveAsPlaylist()).toMatchObject({ status: 'saved', name: 'Cerca: nit' });
        expect(store.playlists[0].videos.length).toBeGreaterThan(2);
        env.queue.playSelection(catalog.slice(20, 30), 'Acabades de sortir');
        expect(env.queue.saveAsPlaylist()).toMatchObject({ status: 'saved', name: 'Acabades de sortir' });
    });

    it('no desa Shorts ni repetits i no fa res si no sona cap ràdio', () => {
        const catalog = styledCatalog();
        const env = setup({ catalog, music: musicStub });
        const store = withLibrary(env);
        expect(env.queue.saveAsPlaylist().status).toBe('unsupported');
        expect(store.saves).toBe(0);
        env.queue.playSelection([catalog[0], catalog[0], { ...catalog[1], isShort: true }, catalog[2]], 'Prova');
        env.queue.saveAsPlaylist();
        expect(ids(store.playlists[0].videos)).toEqual([catalog[0].id, catalog[2].id]);
    });

    it('una llista de l’usuari (no ràdio) no mostra el símbol ni es desa', () => {
        const env = radio();
        env.ctx.activePlaylistId = 'pl_meva';
        const container = fakeContainer();
        env.queue.render(container);
        expect(container.innerHTML).not.toContain('data-mq-save-list');
        expect(env.queue.saveAsPlaylist().status).toBe('unsupported');
    });
});

// ---------- Mode de descoberta dins de cada ràdio ----------

describe('mode de descoberta dins de cada ràdio', () => {
    // 12 artistes escoltats: n'hi ha prou (≥ 3) perquè el mode es pugui aplicar
    function withHistory() {
        const catalog = catalogWithClassics();
        const history = [];
        for (let a = 0; a < 12; a++) {
            history.push({ ...catalog.find(v => v.channelId === `c${a}`), viewedAt: new Date().toISOString() });
        }
        return { catalog, history };
    }

    function radioWithMode(options = {}) {
        const { catalog, history } = withHistory();
        const container = fakeContainer();
        const holder = {};
        const env = setup({
            catalog,
            history: options.noHistory ? [] : history,
            mode: options.mode || 'mix',
            extra: { renderPlaylistQueue: () => holder.env?.queue.render(container) },
        });
        holder.env = env;
        env.queue.startDiscovery();
        return { ...env, catalog, container };
    }

    const modeButtons = html =>
        [...html.matchAll(/data-mq-mode="(\w+)" aria-checked="(true|false)"/g)].map(m => [m[1], m[2]]);

    it('cada ràdio mostra el selector amb les quatre opcions i el mode amb què s’ha generat', () => {
        const env = radioWithMode({ mode: 'surprise' });
        env.queue.render(env.container);
        expect(modeButtons(env.container.innerHTML)).toEqual([
            ['home', 'false'],
            ['mix', 'false'],
            ['surprise', 'true'],
            ['new', 'false'],
        ]);
        expect(env.container.innerHTML).toContain('role="radiogroup" aria-label="Quant vols descobrir?"');
        expect(env.container.innerHTML).toContain('Els meus de sempre');
        expect(env.container.innerHTML).not.toContain('A casa');
        // És dins del capçal (a escriptori el capçal es queda fix)
        const head = env.container.innerHTML.slice(
            env.container.innerHTML.indexOf('<div class="mq-head">'),
            env.container.innerHTML.indexOf('<div class="mq-section">')
        );
        expect(head).toContain('mq-mode');
    });

    it('en canviar el mode la part pendent es renova d’immediat sense tocar la cançó que sona', () => {
        const env = radioWithMode();
        const current = env.ctx.activePlaylistQueue[0].id;
        const before = env.ctx.activePlaylistQueue.slice(1).map(v => v.id);
        const result = env.queue.setDiscoveryMode('surprise');
        const after = env.ctx.activePlaylistQueue.slice(1).map(v => v.id);
        expect(result.mode).toBe('surprise');
        expect(result.changed).toBeGreaterThan(5);
        expect(after.filter(id => !before.includes(id)).length).toBe(result.changed);
        expect(env.ctx.activePlaylistQueue[0].id).toBe(current);
        expect(env.queue.getAppliedMode()).toBe('surprise');
        expect(env.localStorage.getItem('catube_discovery_mode')).toBe('surprise');
        expect(new Set(env.ctx.activePlaylistQueue.map(v => v.id)).size).toBe(env.ctx.activePlaylistQueue.length);
    });

    it('es veu: la llista es repinta amb l’animació i un avís diu quantes cançons han canviat', () => {
        const env = radioWithMode();
        env.queue.render(env.container);
        expect(env.container.innerHTML).not.toContain('is-renewed');
        const result = env.queue.setDiscoveryMode('home');
        const html = env.container.innerHTML;
        expect(html).toContain('class="mq-list is-renewed"');
        expect(html).toContain('data-mq-mode="home" aria-checked="true"');
        // L'avís es posa just després (sense repintar-ho tot) i es conserva en repintar la cua uns segons
        env.queue.render(env.container);
        expect(env.container.innerHTML).toMatch(
            new RegExp(`Ràdio adaptada a «Els meus de sempre»: ${result.changed} cançons noves a la llista\\.`)
        );
        // L'animació només es fa en canviar de mode: un repintat posterior ja no la porta
        expect(env.container.innerHTML).not.toContain('is-renewed');
    });

    it('«Fora del meu radar»: la part pendent només porta artistes que no coneixes i un avís diu quants', () => {
        const env = radioWithMode();
        const result = env.queue.setDiscoveryMode('new');
        expect(result.mode).toBe('new');
        expect(env.queue.getAppliedMode()).toBe('new');
        expect(env.localStorage.getItem('catube_discovery_mode')).toBe('new');
        const pending = env.ctx.activePlaylistQueue.slice(1);
        expect(pending.length).toBeGreaterThan(5);
        // Aquest catàleg només té uns 15 artistes sense escoltar (els 12 de l'historial són c0..c11): tots hi surten
        // i, com que no n'hi ha prou per omplir la cua, es completa amb els de l'historial i ho diu.
        const fresh = new Set(pending.map(v => v.channelId).filter(id => !/^c(\d|1[01])$/.test(id)));
        expect(fresh.size).toBeGreaterThanOrEqual(12);
        expect(env.ctx.activePlaylistQueue.slice(1, 6).some(v => /^c(\d|1[01])$/.test(v.channelId))).toBe(false);
        expect(env.queue.getState().meta.note).toMatch(/Ja coneixes gairebé tots els artistes/);
        env.queue.render(env.container);
        expect(env.container.innerHTML).toContain('data-mq-mode="new" aria-checked="true"');
        expect(env.container.innerHTML).toContain('Ja coneixes gairebé tots els artistes');
    });

    it('el mode és un event: la portada s’hi sincronitza', () => {
        const env = radioWithMode();
        const seen = [];
        env.bus.addEventListener('segueix:discovery-mode-changed', event => seen.push(event.detail.mode));
        env.queue.setDiscoveryMode('home');
        expect(seen).toEqual(['home']);
    });

    it('conserva el que l’usuari ha afegit a mà', () => {
        const env = radioWithMode();
        const manual = env.catalog.find(v => !env.ctx.activePlaylistQueue.some(q => q.id === v.id));
        env.queue.enqueue(manual);
        env.queue.setDiscoveryMode('surprise');
        expect(env.ctx.activePlaylistQueue.some(v => v.id === manual.id)).toBe(true);
    });

    it('prémer el mode que ja s’aplica, o un mode inventat, no fa res', () => {
        const env = radioWithMode();
        const before = env.ctx.activePlaylistQueue.map(v => v.id);
        const refreshed = env.calls.refreshed;
        expect(env.queue.setDiscoveryMode('mix')).toBeNull();
        expect(env.queue.setDiscoveryMode('a-casa')).toBeNull();
        expect(env.ctx.activePlaylistQueue.map(v => v.id)).toEqual(before);
        expect(env.calls.refreshed).toBe(refreshed);
    });

    it('el selector diu el mode de la llista que es veu, no el de la portada (que s’aplica a la ràdio següent)', () => {
        const env = radioWithMode();
        env.app.features.discovery.setMode('home');
        env.queue.render(env.container);
        expect(modeButtons(env.container.innerHTML).find(([, checked]) => checked === 'true')[0]).toBe('mix');
        // I el botó del mode de la portada sí que l’aplica, encara que ja fos el mode desat
        expect(env.queue.setDiscoveryMode('home').mode).toBe('home');
    });

    it('amb poc historial el mode no pot afinar res: ho diu', () => {
        const env = radioWithMode({ noHistory: true });
        env.queue.setDiscoveryMode('surprise');
        env.queue.render(env.container);
        expect(env.container.innerHTML).toMatch(/«Sorprèn-me» desat\. Amb tan poc historial la ràdio es manté variada/);
    });

    it('una ràdio de cerca té el selector; una selecció o una llista, no', () => {
        const env = radioWithMode();
        env.queue.startFromSearch(env.catalog.slice(0, 20), { query: 'nit' });
        env.queue.render(env.container);
        expect(env.container.innerHTML).toContain('data-mq-mode="surprise"');
        const before = env.ctx.activePlaylistQueue.slice(1).map(v => v.id);
        expect(env.queue.setDiscoveryMode('surprise').mode).toBe('surprise');
        const after = env.ctx.activePlaylistQueue.slice(1).map(v => v.id);
        expect([...after].sort()).toEqual([...before].sort());

        env.queue.playSelection(env.catalog.slice(30, 40), 'Acabades de sortir');
        env.queue.render(env.container);
        expect(env.container.innerHTML).not.toContain('data-mq-mode');
        expect(env.queue.setDiscoveryMode('home')).toBeNull();

        env.ctx.activePlaylistId = 'pl_meva';
        env.queue.render(env.container);
        expect(env.container.innerHTML).not.toContain('data-mq-mode');
    });
});

describe('ràdios de la fitxa d’artista', () => {
    function artistCatalog() {
        const list = catalogWithClassics();
        // Un artista amb vuit cançons, de Pop i Folk i arrel
        for (let i = 0; i < 8; i++) {
            list.push(
                song('art', 0.3 + i * 0.5, {
                    channelTitle: 'Artista Fitxa',
                    categories: i % 2 ? ['Pop'] : ['Folk i arrel'],
                })
            );
        }
        for (let a = 0; a < 6; a++) {
            for (let i = 0; i < 3; i++) list.push(song(`f${a}`, 1 + i, { categories: ['Folk i arrel'] }));
        }
        return list;
    }

    it('la ràdio de l’artista només porta cançons seves, seguides i sense límit d’un per artista', () => {
        const catalog = artistCatalog();
        const { queue, ctx, calls } = setup({ catalog });
        const own = catalog.filter(v => v.channelId === 'art');
        expect(queue.startArtistRadio(own, { name: 'Artista Fitxa', channelId: 'art' })).toBe(true);
        expect(calls.loaded).toBe(1);
        expect(ctx.activePlaylistId).toBe('__music_queue__');
        expect(ctx.activePlaylistQueue).toHaveLength(own.length);
        expect(ctx.activePlaylistQueue.every(v => v.channelId === 'art')).toBe(true);
        expect(new Set(ctx.activePlaylistQueue.map(v => v.id)).size).toBe(own.length);
        expect(queue.getState()).toMatchObject({ isRadio: true, artist: 'Artista Fitxa', search: '' });
        expect(queue.playlistName()).toBe('Ràdio de Artista Fitxa');
        expect(queue.getShareData().name).toBe('Ràdio de Artista Fitxa');
    });

    it('«Barreja» d’una ràdio d’artista es queda dins les seves cançons', () => {
        const catalog = artistCatalog();
        const { queue, ctx } = setup({ catalog });
        const own = catalog.filter(v => v.channelId === 'art');
        queue.startArtistRadio(own, { name: 'Artista Fitxa', channelId: 'art' });
        queue.regenerate();
        expect(ctx.activePlaylistQueue.length).toBeGreaterThan(1);
        expect(ctx.activePlaylistQueue.every(v => v.channelId === 'art')).toBe(true);
    });

    it('no engega una ràdio d’artista amb una sola cançó ni sense nom', () => {
        const catalog = artistCatalog();
        const { queue, calls } = setup({ catalog });
        const own = catalog.filter(v => v.channelId === 'art');
        expect(queue.startArtistRadio(own.slice(0, 1), { name: 'Artista Fitxa' })).toBe(false);
        expect(queue.startArtistRadio([], { name: 'Artista Fitxa' })).toBe(false);
        expect(calls.loaded).toBe(0);
    });

    it('la ràdio de l’estil porta els estils de l’artista, barrejats, amb el nom fix i el límit d’artista', () => {
        const catalog = artistCatalog();
        const { queue, ctx, calls, selection } = setup({ catalog });
        expect(queue.startStyleRadio(['Pop', 'Folk i arrel'])).toBe(true);
        expect(calls.loaded).toBe(1);
        expect(queue.getState().categories).toEqual(['Pop', 'Folk i arrel']);
        expect(queue.getState().artist).toBe('');
        const top = ctx.activePlaylistQueue.slice(0, 20);
        expect(top.every(v => v.categories.some(name => ['Pop', 'Folk i arrel'].includes(name)))).toBe(true);
        top.forEach((v, index) => {
            if (index > 0) expect(v.channelId).not.toBe(top[index - 1].channelId);
        });
        expect(top.filter(v => eraOf(selection, v) === 'historic').length).toBeLessThanOrEqual(2);
        expect(queue.playlistName()).toBe('Ràdio Pop + Folk i arrel');
    });

    it('la ràdio de l’estil no s’engega sense estils o sense prou cançons', () => {
        const catalog = artistCatalog();
        const { queue, calls } = setup({ catalog });
        expect(queue.startStyleRadio([])).toBe(false);
        expect(queue.startStyleRadio(['Estil inexistent'])).toBe(false);
        expect(calls.loaded).toBe(0);
    });
});
