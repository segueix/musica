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

function ui(navigator, options = {}) {
    const storage = createMockLocalStorage();
    const elements = new Map();
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
        createElement: () => link,
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

describe('Envia per WhatsApp: un enllaç que s’obre des de WhatsApp Web', () => {
    const withHistory = (storage) =>
        storage.setItem('catube_history', JSON.stringify([{ id: A, title: 'Cançó', viewedAt: '2026-10-06' }]));

    it('genera un enllaç sense «+» ni «$» que es torna a llegir igual', () => {
        const { api } = setup();
        const copy = payload({ history: [{ id: A, title: 'L’amor i tu' }], follows: [CH] });
        const link = api.buildLink(copy);
        expect(link.startsWith('https://segueix.github.io/musica/#musica=')).toBe(true);
        expect(link).not.toMatch(/[+$_~*`]/);
        const hash = link.slice(link.indexOf('#'));
        expect(api.parseLink(hash).data).toEqual(api.validate(copy).data);
    });

    it('continua llegint els primers enllaços #musica= amb «~» i «_»', () => {
        const { api } = setup();
        const copy = payload({ history: [{ id: A, title: 'Cançó' }] });
        const link = api.buildLink(copy);
        const old = link.slice(link.indexOf('#')).replace(/%2B/g, '~').replace(/%24/g, '_');
        expect(api.parseLink(old).data.history[0].id).toBe(A);
    });

    it('a l’ordinador obre WhatsApp Web amb el missatge i l’enllaç escrits', async () => {
        const { el, open, storage } = ui({});
        withHistory(storage);
        await el('musicTransferWhatsApp').handlers.click();
        const url = open.mock.calls[0][0];
        expect(url.startsWith('https://web.whatsapp.com/send?text=')).toBe(true);
        const text = decodeURIComponent(url.split('text=')[1]);
        expect(text).toContain('1 cançons a l’historial');
        expect(text).toMatch(/https:\/\/segueix\.github\.io\/musica\/#musica=\S+$/);
        expect(el('musicTransferFeedback').textContent).toContain('tria el xat');
        expect(el('musicTransferWhatsApp').disabled).toBe(false);
    });

    it('si l’enllaç és massa llarg per a l’adreça de WhatsApp, el copia i obre WhatsApp Web', async () => {
        const writeText = vi.fn(async () => {});
        const { el, open, storage } = ui({ clipboard: { writeText } });
        storage.setItem(
            'catube_history',
            JSON.stringify(
                Array.from({ length: 400 }, (_, i) => ({
                    id: String(i).padStart(11, 'h'),
                    title: 'Cançó llarga ' + i,
                    viewedAt: '2026-10-06',
                })),
            ),
        );
        await el('musicTransferWhatsApp').handlers.click();
        expect(writeText.mock.calls[0][0]).toMatch(/#musica=/);
        expect(open).toHaveBeenCalledWith('https://web.whatsapp.com/', '_blank', 'noopener,noreferrer');
        expect(el('musicTransferFeedback').textContent).toContain('Enllaç copiat');
    });

    it('al mòbil envia el text amb l’enllaç pel menú natiu, sense fitxer', async () => {
        const navigator = { share: vi.fn(async () => {}), canShare: () => true };
        const { el, open, storage } = ui(navigator, {
            matchMedia: () => ({ matches: true }),
        });
        withHistory(storage);
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
        const { el, link, open } = ui(navigator, { matchMedia: () => ({ matches: true }) });
        await el('musicTransferWhatsApp').handlers.click();
        expect(link.click).not.toHaveBeenCalled();
        expect(open).not.toHaveBeenCalled();
        expect(el('musicTransferWhatsApp').disabled).toBe(false);
    });

    it('una còpia massa gran per a un enllaç es comparteix com a fitxer', async () => {
        const navigator = { canShare: vi.fn(() => true), share: vi.fn(async () => {}) };
        const { api, el, storage } = ui(navigator);
        const huge = Array.from({ length: 3000 }, (_, i) => ({
            id: String(i).padStart(11, 'z'),
            title: 'Cançó ' + i + ' ' + 'x'.repeat(40),
            viewedAt: '2026-10-06',
        }));
        storage.setItem('catube_history', JSON.stringify(huge));
        expect(api.buildLink(api.collect())).toBe('');
        await el('musicTransferWhatsApp').handlers.click();
        expect(navigator.share.mock.calls[0][0].files[0].name).toBe('copia.segueixmusica');
        expect(el('musicTransferFeedback').textContent).toContain('massa gran');
    });

    it('«Copia l’enllaç» i «Desa el fitxer» funcionen sense cap pas previ', async () => {
        const writeText = vi.fn(async () => {});
        const { el, link, storage } = ui({ clipboard: { writeText } });
        withHistory(storage);
        await el('musicTransferCopy').handlers.click();
        expect(writeText.mock.calls[0][0]).toMatch(/#musica=/);
        await el('musicTransferSave').handlers.click();
        expect(link.download).toBe('copia.segueixmusica');
        expect(link.click).toHaveBeenCalledOnce();
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
        expect(result.data.playlists[0].videos).toHaveLength(75);
        expect(result.data.history).toEqual([]);
        expect(result.data.follows).toEqual([]);
        expect(api.listPayload('La meva ràdio', ids)).toMatchObject({
            data: result.data,
        });
    });
});
