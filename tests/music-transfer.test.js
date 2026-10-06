import { describe, it, expect, vi } from 'vitest';
import { File } from 'node:buffer';
import { loadScript, createMockLocalStorage } from './setup.js';

const A = 'abcdefghijk',
    B = 'lmnopqrstuv',
    C = '12345678901';
const CH = 'UCabcdefghijklmnopqrstuv';
const payload = (data) => ({
    product: 'segueix-musica',
    v: 1,
    createdAt: '2026-10-06T17:00:00Z',
    data,
});
function setup(storage = createMockLocalStorage(), options = {}) {
    const ctx = loadScript('js/features/music-signals.js', {
        localStorage: storage,
    });
    ctx.SegueixApp.utils.shareCodecs = {
        SHARE_BASE_URL: 'https://segueix.github.io/musica/',
        // Com LZString: l'alfabet porta «+» i «$».
        encodeImportPayload: (p) =>
            Buffer.from(JSON.stringify(p)).toString('base64').replace(/\//g, '$').replace(/=+$/, ''),
        decodeImportPayload: (s) => {
            try {
                return JSON.parse(Buffer.from(s.replace(/\$/g, '/'), 'base64').toString());
            } catch {
                return null;
            }
        },
    };
    const out = loadScript('js/features/music-transfer.js', {
        SegueixApp: ctx.SegueixApp,
        localStorage: storage,
        File,
        document: { addEventListener() {} },
        ...options,
    });
    return { api: out.SegueixApp.features.musicTransfer, storage };
}

describe('Transferència musical sense servidor', () => {
    it('exporta només música i mai tokens, consentiment, identificadors ni caches', () => {
        const { api, storage } = setup();
        storage.setItem('catube_history', JSON.stringify([{ id: A, title: 'Cançó', viewedAt: '2026-10-06' }]));
        storage.setItem('catube_liked_videos', JSON.stringify([{ id: A, title: 'Cançó' }]));
        storage.setItem('user_liked_videos', JSON.stringify([A, B]));
        for (const key of [
            'sync_device_id',
            'admin_token',
            'catube_anonymous_analytics_client_v1',
            'youtubeConsent',
            'feed_cache',
        ])
            storage.setItem(key, 'SECRET');
        const copy = api.collect();
        expect(copy.data.likes.map((v) => v.id)).toEqual([A, B]);
        expect(copy.data.history[0].viewedAt).toBe('2026-10-06');
        expect(JSON.stringify(copy)).not.toContain('SECRET');
    });

    it('continua llegint els enllaços antics de GitHub Pages', () => {
        const { api } = setup();
        const original = payload({ history: [{ id: A, title: 'L’amor i tu' }] });
        const hash = '#music-transfer=' + Buffer.from(JSON.stringify(original)).toString('base64url');
        expect(api.parseLink(hash).data.history[0].title).toBe('L’amor i tu');
    });

    it('rebutja una còpia d’un altre producte, versions desconegudes i enllaços corruptes', () => {
        const { api } = setup();
        expect(() => api.validate({ ...payload({}), product: 'segueix' })).toThrow();
        expect(() => api.validate({ ...payload({}), v: 2 })).toThrow();
        expect(() => api.parseLink('#music-transfer=trencat')).toThrow();
        expect(() => api.parseLink('#music-transfer=' + 'a'.repeat(8000))).toThrow();
    });

    it('genera i importa un fitxer superior a 42 kB sense aplicar el límit dels enllaços', async () => {
        const { api } = setup();
        const input = payload({
            playlists: Array.from({ length: 150 }, (_, i) => ({
                id: `p${i}`,
                name: 'Llista ' + i,
                videos: [{ id: A, title: 't'.repeat(300) }],
            })),
        });
        const file = api.createFile(input);
        expect(file.size).toBeGreaterThan(42 * 1024);
        expect(file.name).toBe('copia.segueixmusica');
        expect(file.type).toBe('application/vnd.segueix-musica+json');
        expect((await api.readFile(file)).data.playlists).toHaveLength(150);
    });

    it('reconeix els JSON anteriors i els fitxers de text amb BOM', async () => {
        const { api } = setup();
        const original = payload({ history: [{ id: A }] });
        const old = new File([JSON.stringify(original)], 'copia.json', {
            type: 'application/json',
        });
        const txt = new File(['\ufeff' + JSON.stringify(original)], 'copia.txt', {
            type: 'text/plain',
        });
        expect((await api.readFile(old)).data.history).toEqual((await api.readFile(txt)).data.history);
        await expect(api.readFile(new File(['No és una còpia'], 'error.txt'))).rejects.toThrow();
    });

    it('fusiona historial, cors i seguits sense perdre informació local ni duplicar-los', () => {
        const { api, storage } = setup();
        storage.setItem(
            'catube_history',
            JSON.stringify([
                {
                    id: A,
                    title: 'Títol local',
                    viewedAt: '2026-10-01',
                    originalYear: 1995,
                },
                { id: C },
            ]),
        );
        storage.setItem('catube_liked_videos', JSON.stringify([{ id: C }]));
        storage.setItem('catube_follows', JSON.stringify([CH]));
        const copy = payload({
            history: [{ id: A, viewedAt: '2026-10-06' }, { id: B }],
            likes: [{ id: B }],
            follows: [CH],
        });
        api.importData(copy);
        const once = storage.getItem('catube_history');
        api.importData(copy);
        expect(storage.getItem('catube_history')).toBe(once);
        const history = JSON.parse(once);
        expect(history).toHaveLength(3);
        expect(history[0]).toMatchObject({
            id: A,
            title: 'Títol local',
            originalYear: 1995,
            viewedAt: '2026-10-06',
        });
        expect(JSON.parse(storage.getItem('catube_liked_videos')).map((v) => v.id)).toEqual([C, B]);
        expect(JSON.parse(storage.getItem('catube_follows'))).toEqual([CH]);
    });

    it('resol col·lisions de llistes i reimporta sense crear còpies noves', () => {
        const { api, storage } = setup();
        storage.setItem('catube_playlists', JSON.stringify([{ id: '123', name: 'Rock', videos: [{ id: A }] }]));
        const copy = payload({
            playlists: [{ id: '123', name: 'Pop', videos: [{ id: B }] }],
        });
        api.importData(copy);
        api.importData(copy);
        expect(JSON.parse(storage.getItem('catube_playlists'))).toHaveLength(2);
        expect(JSON.parse(storage.getItem('catube_playlists'))[0].videos[0].id).toBe(A);
    });

    it('fusiona categories pel nom i estadístiques pel màxim; prefereix la preferència més recent', () => {
        const { api, storage } = setup();
        storage.setItem(
            'catube_music_user_categories',
            JSON.stringify([{ id: 'local', name: 'Favorits', artists: [CH] }]),
        );
        storage.setItem('catube_music_signals_v1', JSON.stringify({ songs: { [A]: { q: 3 } } }));
        storage.setItem('catube_music_prefs_v1', JSON.stringify({ moreLike: { [A]: { at: 20, on: false } } }));
        const copy = payload({
            categories: [{ id: 'incoming', name: 'Favorits', artists: [CH] }],
            stats: { songs: { [A]: { q: 5 } } },
            prefs: { moreLike: { [A]: { at: 10, on: true } } },
        });
        api.importData(copy);
        api.importData(copy);
        expect(JSON.parse(storage.getItem('catube_music_user_categories'))).toHaveLength(1);
        expect(JSON.parse(storage.getItem('catube_music_signals_v1')).songs[A].q).toBe(5);
        expect(JSON.parse(storage.getItem('catube_music_prefs_v1')).moreLike[A].on).toBe(false);
    });

    it('restaura els valors anteriors si falla una escriptura per manca d’espai', () => {
        const { api, storage } = setup();
        storage.setItem('catube_history', JSON.stringify([{ id: A }]));
        const before = storage.getItem('catube_history');
        const realSet = storage.setItem;
        let n = 0;
        storage.setItem = (k, v) => {
            if (++n === 3) throw new Error('QuotaExceeded');
            realSet(k, v);
        };
        expect(() => api.importData(payload({ history: [{ id: B }] }))).toThrow(/espai/);
        expect(storage.getItem('catube_history')).toBe(before);
        expect(storage.getItem('catube_liked_videos')).toBeNull();
    });

    it('ignora propietats desconegudes, URL externes i claus de prototype pollution', () => {
        const { api } = setup();
        const copy = payload({
            history: [{ id: A, thumbnail: 'javascript:alert(1)', arbitrary: 'secret' }, { id: '<img>' }],
            stats: JSON.parse('{"songs":{"__proto__":{"q":12},"constructor":{"q":1}}}'),
        });
        const valid = api.validate(copy);
        expect(valid.data.history).toEqual([{ id: A }]);
        expect(Object.keys(valid.data.stats.songs)).toEqual([]);
    });

    it('retira el fragment de l’URL abans de l’arrencada sense importar automàticament', () => {
        let replaced;
        const storage = createMockLocalStorage();
        setup(storage, {
            location: {
                hash: '#music-transfer=abc',
                pathname: '/musica/',
                search: '',
            },
            history: {
                replaceState: (...args) => {
                    replaced = args[2];
                },
            },
        });
        expect(replaced).toBe('/musica/');
        expect(storage.length).toBe(0);
    });

    it('també retira el fragment dels enllaços nous', () => {
        let replaced;
        setup(createMockLocalStorage(), {
            location: { hash: '#musica=abc', pathname: '/musica/', search: '?x=1' },
            history: {
                replaceState: (...args) => {
                    replaced = args[2];
                },
            },
        });
        expect(replaced).toBe('/musica/?x=1');
    });
});

function ui(navigator, options = {}, custom = {}) {
    const storage = createMockLocalStorage();
    const elements = new Map(Object.entries(custom));
    const el = (name) => {
        if (!elements.has(name))
            elements.set(name, {
                disabled: false,
                textContent: '',
                hidden: false,
                classList: { add: vi.fn(), remove: vi.fn() },
                handlers: {},
                addEventListener(event, handler) {
                    this.handlers[event] = handler;
                },
                click: vi.fn(),
                showModal: vi.fn(),
                close: vi.fn(),
            });
        return elements.get(name);
    };
    const link = { click: vi.fn() };
    let init;
    const doc = {
        getElementById: el,
        createElement: (tag) => (tag === 'option' ? {} : link),
        addEventListener: (_, handler) => {
            init = handler;
        },
    };
    const open = vi.fn();
    const revokeObjectURL = vi.fn();
    const { api } = setup(storage, {
        document: doc,
        navigator,
        location: { hash: '', search: '' },
        open,
        URL: { createObjectURL: vi.fn(() => 'blob:copy'), revokeObjectURL },
        setTimeout: (fn) => fn(),
        ...options,
    });
    init();
    return { api, el, link, open, revokeObjectURL, storage };
}

describe('Envia una llista i els artistes per WhatsApp', () => {
    const ids = (n, pad = 'q') => Array.from({ length: n }, (_, i) => String(i).padStart(11, pad));
    const withList = (storage, n = 20, extra = '') => {
        storage.setItem(
            'catube_playlists',
            JSON.stringify([
                {
                    id: 'p1',
                    name: 'Estiu',
                    videos: ids(n).map((id, i) => ({
                        id,
                        title: 'Cançó ' + i + extra,
                        channelTitle: 'Els Catarres',
                        thumbnail: 'https://i.ytimg.com/x.jpg',
                    })),
                },
                { id: 'p2', name: 'Buida', videos: [] },
            ]),
        );
        storage.setItem('catube_follows', JSON.stringify([CH]));
        storage.setItem('catube_history', JSON.stringify([{ id: A, title: 'Privada', viewedAt: '2026-10-06' }]));
    };
    const pick = (el, list) => {
        el('musicTransferList').value = list;
    };

    it('envia només la llista triada, sense artistes, historial ni títols del catàleg', () => {
        const { api, storage } = setup(createMockLocalStorage(), {
            YouTubeAPI: { feedVideos: ids(20).map((id) => ({ id })) },
        });
        withList(storage);
        const copy = api.selection('p1', false);
        expect(copy.data.playlists[0].videos).toHaveLength(20);
        expect(copy.data.follows).toEqual([]);
        expect(copy.data.history).toEqual([]);
        const link = api.buildLink(copy);
        expect(link).not.toContain('Cançó');
        expect(link).not.toMatch(/[+$_~*`]/);
        const back = api.parseLink(link.slice(link.indexOf('#')));
        expect(back.data.playlists[0].videos.map((v) => v.id)).toEqual(ids(20));
        expect(back.data.history).toEqual([]);
        expect(api.summary(back)).toBe('llista «Estiu» (20 cançons)');
    });

    it('els artistes s’envien a part, sense cap llista; sense llista o buida dona un avís', () => {
        const { api, storage } = setup();
        withList(storage);
        const artists = api.selection('', true);
        expect(artists.data.playlists).toEqual([]);
        expect(artists.data.follows).toEqual([CH]);
        expect(api.summary(artists)).toBe('1 artistes');
        expect(() => api.selection('', false)).toThrow('No tens cap llista');
        expect(() => api.selection('p2', false)).toThrow('buida');
        storage.setItem('catube_follows', '[]');
        expect(() => api.selection('', true)).toThrow('Encara no segueixes');
    });

    it('l’altre aparell recupera els títols del catàleg', () => {
        const { api } = setup();
        const copy = api.parseLink(
            (() => {
                const link = api.buildLink(payload({ playlists: [{ id: 'p', name: 'L', videos: [A, B] }] }));
                return link.slice(link.indexOf('#'));
            })(),
        );
        const catalog = new Map([[A, { id: A, title: 'Fins que arribi l’alba', channelTitle: 'Txarango', channelId: CH }]]);
        const full = api.hydrate(copy, catalog);
        expect(full.data.playlists[0].videos[0]).toMatchObject({ title: 'Fins que arribi l’alba', channelId: CH });
        expect(full.data.playlists[0].videos[1]).toEqual({ id: B });
    });

    it('el desplegable mostra les llistes i tria la primera', () => {
        const options = [];
        const select = {
            dataset: {},
            value: '',
            set textContent(_) {
                options.length = 0;
            },
            appendChild: (o) => options.push(o),
            addEventListener() {},
            get options() {
                return options;
            },
        };
        const { api, storage } = ui({}, {}, { musicTransferList: select });
        withList(storage);
        api.refreshListPicker(storage);
        expect(options.map((o) => o.textContent)).toEqual(['Estiu (20)', 'Buida (0)']);
        expect(select.value).toBe('p1');
    });

    it('a l’ordinador obre WhatsApp Web amb el missatge i l’enllaç escrits', async () => {
        // Cançons del catàleg: només viatgen els identificadors.
        const { el, open, storage } = ui({}, { YouTubeAPI: { feedVideos: ids(20).map((id) => ({ id })) } });
        withList(storage);
        pick(el, 'p1');
        await el('musicTransferWhatsApp').handlers.click();
        const url = open.mock.calls[0][0];
        expect(url.startsWith('https://web.whatsapp.com/send?text=')).toBe(true);
        const text = decodeURIComponent(url.split('text=')[1]);
        expect(text).toContain('llista «Estiu» (20 cançons)');
        expect(text).not.toContain('artistes');
        expect(text).toMatch(/https:\/\/segueix\.github\.io\/musica\/#musica=\S+$/);
        expect(text.length).toBeLessThan(1000);
        expect(el('musicTransferFeedback').textContent).toContain('tria el xat');
        expect(el('musicTransferWhatsApp').disabled).toBe(false);
    });

    it('si l’enllaç és massa llarg per a l’adreça de WhatsApp, el copia i obre WhatsApp Web', async () => {
        const writeText = vi.fn(async () => {});
        const { el, open, storage } = ui({ clipboard: { writeText } });
        // Cançons que no són al catàleg: viatgen amb títols llargs.
        withList(storage, 50, ' ' + 'una cançó amb un títol molt llarg '.repeat(5));
        pick(el, 'p1');
        await el('musicTransferWhatsApp').handlers.click();
        expect(writeText.mock.calls[0][0]).toMatch(/#musica=/);
        expect(open).toHaveBeenCalledWith('https://web.whatsapp.com/', '_blank', 'noopener,noreferrer');
        expect(el('musicTransferFeedback').textContent).toContain('Enllaç copiat');
    });

    it('al mòbil envia el text amb l’enllaç pel menú natiu, sense fitxer', async () => {
        const navigator = { share: vi.fn(async () => {}), canShare: () => true };
        const { el, open, storage } = ui(navigator, { matchMedia: () => ({ matches: true }) });
        withList(storage);
        pick(el, 'p1');
        await el('musicTransferWhatsApp').handlers.click();
        const data = navigator.share.mock.calls[0][0];
        expect(data.files).toBeUndefined();
        expect(data.text).toMatch(/#musica=/);
        expect(open).not.toHaveBeenCalled();
    });

    it('no fa res més quan es cancel·la el menú natiu', async () => {
        const navigator = {
            share: vi.fn(async () => {
                throw Object.assign(new Error(), { name: 'AbortError' });
            }),
        };
        const { el, link, open, storage } = ui(navigator, { matchMedia: () => ({ matches: true }) });
        withList(storage);
        pick(el, 'p1');
        await el('musicTransferWhatsApp').handlers.click();
        expect(link.click).not.toHaveBeenCalled();
        expect(open).not.toHaveBeenCalled();
        expect(el('musicTransferWhatsApp').disabled).toBe(false);
    });

    it('el bloc dels artistes envia només els artistes, amb el seu avís', async () => {
        const { el, open, storage } = ui({});
        withList(storage);
        await el('musicTransferArtistsWhatsApp').handlers.click();
        const text = decodeURIComponent(open.mock.calls[0][0].split('text=')[1]);
        expect(text).toContain('Segueix Música: 1 artistes.');
        expect(text).not.toContain('llista');
        expect(el('musicTransferArtistsFeedback').textContent).toContain('tria el xat');
        expect(el('musicTransferFeedback').textContent).toBe('');
    });

    it('sense llistes o sense artistes, avisa i no obre WhatsApp', async () => {
        const { el, open } = ui({});
        pick(el, '');
        await el('musicTransferWhatsApp').handlers.click();
        await el('musicTransferArtistsWhatsApp').handlers.click();
        expect(open).not.toHaveBeenCalled();
        expect(el('musicTransferFeedback').textContent).toContain('No tens cap llista');
        expect(el('musicTransferArtistsFeedback').textContent).toContain('Encara no segueixes');
    });

    it('«Copia l’enllaç» copia el missatge amb l’enllaç', async () => {
        const writeText = vi.fn(async () => {});
        const { el, storage } = ui({ clipboard: { writeText } });
        withList(storage);
        pick(el, 'p1');
        await el('musicTransferCopy').handlers.click();
        expect(writeText.mock.calls[0][0]).toMatch(/Estiu[\s\S]*#musica=/);
    });
});

describe('Cançons que ja no són al catàleg i límit de cançons', () => {
    it('les del catàleg van només amb l’ID; les que no hi són porten títol i artista', () => {
        const { api } = setup(createMockLocalStorage(), { YouTubeAPI: { feedVideos: [{ id: A }] } });
        const copy = payload({
            playlists: [
                {
                    id: 'p',
                    name: 'Ràdio Cançó d’autor',
                    videos: [
                        { id: A, title: 'Al catàleg', channelTitle: 'Txarango' },
                        { id: B, title: 'Pista Tema', channelTitle: 'Joan Dausà - Tema' },
                    ],
                },
            ],
        });
        const link = api.buildLink(copy);
        expect(link).not.toContain('Al%20cat');
        const back = api.parseLink(link.slice(link.indexOf('#')));
        expect(back.data.playlists[0].videos).toEqual([
            { id: A },
            { id: B, title: 'Pista Tema', channelTitle: 'Joan Dausà - Tema' },
        ]);
        // L'altre aparell no sobreescriu el títol que ha arribat amb l'enllaç.
        const full = api.hydrate(back, new Map([[A, { id: A, title: 'Al catàleg' }]]));
        expect(full.data.playlists[0].videos.map((v) => v.title)).toEqual(['Al catàleg', 'Pista Tema']);
    });

    it('envia només les 50 primeres cançons d’una llista o d’una ràdio', () => {
        const { api, storage } = setup();
        const many = Array.from({ length: 80 }, (_, i) => ({ id: String(i).padStart(11, 'm'), title: 'C' + i }));
        storage.setItem('catube_playlists', JSON.stringify([{ id: 'p', name: 'Ràdio', videos: many }]));
        const songs = api.selection('p', false).data.playlists[0].videos;
        expect(songs).toHaveLength(50);
        expect(songs[0].id).toBe(many[0].id);
        expect(api.listPayload('Ràdio', many).data.playlists[0].videos).toHaveLength(50);
    });
});

describe('Obrir un enllaç amb l’app ja oberta', () => {
    const linkHash = (api) => {
        const link = api.buildLink(payload({ playlists: [{ id: 'p', name: 'Estiu', videos: [A, B] }], follows: [CH] }));
        return link.slice(link.indexOf('#'));
    };

    it('un enllaç nou a la mateixa pestanya (només canvia el fragment) obre la confirmació', () => {
        const listeners = {};
        const location = { hash: '', search: '', pathname: '/musica/' };
        const replaced = [];
        const { api, el, storage } = ui(
            {},
            {
                location,
                addEventListener: (type, fn) => {
                    listeners[type] = fn;
                },
                history: { replaceState: (...args) => replaced.push(args[2]) },
            },
        );
        location.hash = linkHash(api);
        listeners.hashchange();
        expect(el('musicTransferDialog').showModal).toHaveBeenCalledOnce();
        expect(el('musicTransferSummary').textContent).toBe('llista «Estiu» (2 cançons) · 1 artistes');
        expect(replaced).toEqual(['/musica/']);
        expect(storage.getItem('catube_playlists')).toBeNull();
    });

    it('l’app instal·lada ja oberta rep l’enllaç per launchQueue', () => {
        let consumer;
        const { api, el } = ui(
            {},
            {
                launchQueue: {
                    setConsumer(fn) {
                        consumer = fn;
                    },
                },
            },
        );
        consumer({ files: [], targetURL: 'https://segueix.github.io/musica/' + linkHash(api) });
        expect(el('musicTransferDialog').showModal).toHaveBeenCalledOnce();
        expect(el('musicTransferConfirm').disabled).toBe(false);
    });
});

describe('Fitxer propi i compatibilitat amb les còpies ja generades', () => {
    it('comparteix el mateix JSON com a text quan el navegador rebutja l’extensió pròpia', async () => {
        const navigator = {
            canShare: ({ files }) => files[0].name.endsWith('.txt'),
            share: vi.fn(async () => {}),
        };
        const { api } = ui(navigator);
        const file = api.shareableFile(api.createFile(payload({ history: [{ id: A }] })));
        expect(file.name).toBe('copia.segueixmusica.txt');
        expect(JSON.parse(await file.text()).product).toBe('segueix-musica');
    });

    it('obre un fitxer associat amb confirmació, sense escriure les dades automàticament', async () => {
        let consumer;
        const { api, el, storage } = ui(
            {},
            {
                launchQueue: {
                    setConsumer(fn) {
                        consumer = fn;
                    },
                },
            },
        );
        const file = api.createFile(payload({ history: [{ id: A }] }));
        await consumer({ files: [{ getFile: async () => file }] });
        expect(el('musicTransferDialog').showModal).toHaveBeenCalledOnce();
        expect(el('musicTransferConfirm').disabled).toBe(false);
        expect(el('musicTransferSummary').textContent).toContain('1 cançons');
        expect(storage.length).toBe(0);
        await consumer({
            files: [{ getFile: async () => new File(['wrong'], 'wrong.segueixmusica') }],
        });
        expect(el('musicTransferConfirm').disabled).toBe(true);
        expect(storage.length).toBe(0);
    });

    it('no ignora fitxers en una obertura múltiple', async () => {
        let consumer;
        const { el } = ui(
            {},
            {
                launchQueue: {
                    setConsumer(fn) {
                        consumer = fn;
                    },
                },
            },
        );
        await consumer({ files: [{}, {}] });
        expect(el('musicTransferConfirm').disabled).toBe(true);
        expect(el('musicTransferSummary').textContent).toContain('cada vegada');
    });

    it('exporta totes les cançons d’una ràdio sense afegir historial ni dades privades', () => {
        const { api } = setup();
        const ids = Array.from({ length: 75 }, (_, i) => String(i).padStart(11, '0'));
        const result = api.listPayload('La meva ràdio', ids);
        expect(result.data.playlists[0].videos).toHaveLength(50);
        expect(result.data.history).toEqual([]);
        expect(result.data.follows).toEqual([]);
        expect(api.listPayload('La meva ràdio', ids)).toMatchObject({
            data: result.data,
        });
    });
});
