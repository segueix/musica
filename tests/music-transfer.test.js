import { describe, it, expect } from 'vitest';
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
        encodeImportPayload: (p) => Buffer.from(JSON.stringify(p)).toString('base64url'),
        decodeImportPayload: (s) => {
            try {
                return JSON.parse(Buffer.from(s, 'base64url').toString());
            } catch {
                return null;
            }
        },
    };
    const out = loadScript('js/features/music-transfer.js', {
        SegueixApp: ctx.SegueixApp,
        localStorage: storage,
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

    it('crea un enllaç al GitHub Pages actual, amb les dades al fragment', () => {
        const { api } = setup();
        const url = new URL(api.buildUrl(payload({ history: [{ id: A, title: 'L’amor i tu' }] })));
        expect(url.origin + url.pathname).toBe('https://segueix.github.io/musica/');
        expect(url.search).toBe('');
        expect(api.parseLink(url.hash).data.history[0].title).toBe('L’amor i tu');
    });

    it('rebutja una còpia d’un altre producte, versions desconegudes i enllaços corruptes', () => {
        const { api } = setup();
        expect(() => api.validate({ ...payload({}), product: 'segueix' })).toThrow();
        expect(() => api.validate({ ...payload({}), v: 2 })).toThrow();
        expect(() => api.parseLink('#music-transfer=trencat')).toThrow();
        expect(() => api.parseLink('#music-transfer=' + 'a'.repeat(8000))).toThrow();
    });

    it('una còpia gran es deriva al fitxer sense retallar llistes ni historial', () => {
        const { api } = setup();
        const input = payload({
            playlists: Array.from({ length: 100 }, (_, i) => ({
                id: `p${i}`,
                name: 'Llista ' + i,
                videos: [{ id: A, title: 't'.repeat(300) }],
            })),
        });
        expect(api.validate(input).data.playlists).toHaveLength(100);
        expect(() => api.buildUrl(input)).toThrow(/fitxer/);
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
            ])
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
            JSON.stringify([{ id: 'local', name: 'Favorits', artists: [CH] }])
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
});
