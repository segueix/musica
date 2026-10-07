import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createMockLocalStorage } from './setup.js';

const song = (n) => ({
    id: `song${String(n).padStart(7, '0')}`,
    title: `Cançó ${n}`,
    viewedAt: '2026-10-07T08:00:00.000Z',
});
const channel = 'UC' + 'a'.repeat(22);
function setup(fetch = vi.fn(), extra = {}) {
    const elements = new Map();
    const el = (id) => {
        if (!elements.has(id))
            elements.set(id, { textContent: '', hidden: false, disabled: false, addEventListener: vi.fn() });
        return elements.get(id);
    };
    const timers = new Map();
    const ctx = createContext({
        console,
        Date,
        URLSearchParams,
        AbortController,
        TypeError,
        localStorage: createMockLocalStorage(),
        SegueixApp: { utils: {}, features: {} },
        document: { getElementById: el },
        navigator: { onLine: true, locks: { request: async (_name, _options, cb) => cb({ name: 'lock' }) } },
        crypto: { randomUUID },
        location: { reload: vi.fn() },
        addEventListener: vi.fn(),
        setTimeout: (fn) => {
            const id = randomUUID();
            timers.set(id, fn);
            return id;
        },
        clearTimeout: (id) => timers.delete(id),
        SEGUEIX_GOOGLE_DRIVE_CLIENT_ID: 'test.apps.googleusercontent.com',
        fetch,
        google: {
            accounts: {
                oauth2: {
                    initTokenClient: (options) => ({
                        requestAccessToken: () => options.callback({ access_token: 'secret-token', expires_in: 3600 }),
                    }),
                    hasGrantedAllScopes: () => true,
                },
            },
        },
        ...extra,
    });
    ctx.window = ctx;
    for (const path of ['js/utils/music-data.js', 'js/utils/drive-sync-model.js', 'js/features/google-drive-sync.js'])
        runInContext(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), ctx);
    return {
        ctx,
        el,
        data: ctx.SegueixApp.utils.musicData,
        model: ctx.SegueixApp.utils.driveSyncModel,
        api: ctx.SegueixApp.features.googleDriveSync,
        storage: ctx.localStorage,
    };
}

function server() {
    const files = new Map();
    const state = {
        account: 'user1',
        failWrite: false,
        corrupt: false,
        onWrite: null,
        paginated: false,
        failStatus: 0,
        versioned: false,
    };
    const response = (body, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });
    const fetch = vi.fn(async (url, options) => {
        const u = new URL(url);
        if (state.failStatus) return response({}, state.failStatus);
        if (u.pathname.endsWith('/about'))
            return response({ user: { permissionId: state.account, emailAddress: `${state.account}@example.test` } });
        if (u.searchParams.get('alt') === 'media')
            return response(state.corrupt ? { wrong: true } : files.get(u.pathname.split('/').pop()).doc);
        if (options.method === 'POST' || options.method === 'PATCH') {
            if (state.failWrite) return response({}, 503);
            if (state.onWrite) state.onWrite();
            if (options.method === 'POST') {
                const parts = options.body.split('\r\n\r\n');
                const meta = JSON.parse(parts[1].split('\r\n--')[0]);
                const doc = JSON.parse(parts[2].split('\r\n--')[0]);
                expect(meta.parents).toEqual(['appDataFolder']);
                const id = randomUUID();
                files.set(id, { id, appProperties: meta.appProperties, doc, ...(state.versioned ? { version: '1' } : {}) });
                return response({ id, ...(state.versioned ? { version: '1' } : {}) });
            }
            const id = u.pathname.split('/').pop();
            files.get(id).doc = JSON.parse(options.body);
            if (state.versioned) files.get(id).version = String(Number(files.get(id).version || 0) + 1);
            return response({ id, ...(state.versioned ? { version: files.get(id).version } : {}) });
        }
        expect(u.searchParams.get('spaces')).toBe('appDataFolder');
        expect(u.searchParams.get('q')).toContain('segueix-musica-drive-v1');
        const items = [...files.values()].map(({ doc: _doc, ...file }) => file);
        if (state.paginated && !u.searchParams.has('pageToken')) return response({ files: [], nextPageToken: 'page2' });
        return response({ files: items });
    });
    return { fetch, files, state };
}

describe('Model de sincronització amb eliminacions', () => {
    it('esborrar l’historial no fa tornar les cançons antigues que ja no hi cabien', () => {
        const { model: m } = setup();
        const history = Array.from({ length: 60 }, (_, i) => song(i));
        const original = m.update(m.empty(), {}, { history }, 'a', 10);
        const limited = m.limitHistory(original, 'a', 20);
        expect(m.materialize(limited).history).toHaveLength(50);
        const cleared = m.update(limited, m.materialize(limited), {}, 'a', 30);
        expect(m.materialize(m.merge(cleared, original)).history).toEqual([]);
    });
    it('conserva les claus reals d’artista (Wikidata, MusicBrainz i noms amb espais)', () => {
        const { model: m, data, storage } = setup();
        const artists = { 'wd:q123': { q: 7 }, 'mb:abc-def': { f: 3 }, 'n:els amics de les arts': { r: 2 } };
        const stats = { artists, songs: { [song(1).id]: { a: 'n:els amics de les arts', q: 2 } } };
        storage.setItem('catube_music_signals_v1', JSON.stringify(stats));
        const doc = m.update(m.empty(), {}, data.collect().data, 'a', 10);
        expect(m.materialize(m.merge(doc)).stats.artists).toEqual(artists);
        expect(m.materialize(doc).stats.songs[song(1).id].a).toBe('n:els amics de les arts');
    });
    it('no interpreta JSON local malmès com una eliminació', () => {
        const { data, storage } = setup();
        storage.setItem('catube_history', '{bad');
        expect(() => data.collect()).toThrow();
        storage.setItem('catube_history', '{}');
        expect(() => data.collect()).toThrow();
    });
    it('combina aparells, respecta eliminacions i és idempotent', () => {
        const { model: m } = setup();
        const a = m.update(m.empty(), {}, { likes: [song(1)], follows: [channel] }, 'a', 10);
        const b = m.update(m.empty(), {}, { likes: [song(2)] }, 'b', 10);
        const merged = m.merge(a, b);
        expect(m.materialize(merged).likes).toHaveLength(2);
        const before = m.materialize(merged);
        const deleted = m.update(merged, before, { ...before, likes: [song(2)], follows: [] }, 'a', 20);
        const result = m.merge(b, a, deleted, a);
        expect(m.materialize(result).likes.map((v) => v.id)).toEqual([song(2).id]);
        expect(m.materialize(result).follows).toEqual([]);
        expect(m.merge(result, result)).toEqual(result);
    });
    it('conserva addicions simultànies a una llista i no recupera cançons esborrades', () => {
        const { model: m } = setup();
        const data = { playlists: [{ id: 'list1', name: 'Estiu', videos: [song(1)] }] };
        const base = m.update(m.empty(), {}, data, 'a', 10);
        const a = m.update(base, data, { playlists: [{ ...data.playlists[0], videos: [song(2)] }] }, 'a', 20);
        const b = m.update(base, data, { playlists: [{ ...data.playlists[0], videos: [song(1), song(3)] }] }, 'b', 20);
        const merged = m.merge(a, b);
        expect(
            m
                .materialize(merged)
                .playlists[0].videos.map((v) => v.id)
                .sort()
        ).toEqual([song(2).id, song(3).id]);
        expect(m.merge(b, a)).toEqual(merged);
    });
    it('no duplica estadístiques, conserva preferències i resol conflictes', () => {
        const { model: m } = setup();
        const a = m.update(
            m.empty(),
            {},
            {
                stats: { songs: { [song(1).id]: { q: 4 } } },
                prefs: { blocked: { [channel]: { on: true, at: 10 } } },
                mode: 'home',
            },
            'a',
            10
        );
        const b = m.update(m.empty(), {}, { stats: { songs: { [song(1).id]: { q: 5 } } }, mode: 'mix' }, 'b', 20);
        const merged = m.merge(a, b, a);
        expect(m.materialize(merged).stats.songs[song(1).id].q).toBe(5);
        expect(m.materialize(merged).prefs.blocked[channel].on).toBe(true);
        expect(m.materialize(merged).mode).toBe('mix');
        expect(m.merge(a, b)).toEqual(m.merge(b, a));
    });
    it('rebutja versions futures i claus alienes a Música', () => {
        const { model: m } = setup();
        expect(() => m.validate({ ...m.empty(), v: 2 })).toThrow();
        expect(() =>
            m.validate({
                ...m.empty(),
                records: { 'settings/__proto__': { at: 1, device: 'a', deleted: false, value: {} } },
            })
        ).toThrow();
        expect(() =>
            m.validate({
                ...m.empty(),
                records: { adminToken: { at: 1, device: 'a', deleted: false, value: 'secret' } },
            })
        ).toThrow();
    });
    it('només recull dades musicals i preferències permeses, i restaura miniatures', () => {
        const { data, storage } = setup();
        for (const key of [
            'adminToken',
            'catube_continue_watching_v1',
            'sync_device_id',
            'catube_anonymous_analytics_enabled',
        ])
            storage.setItem(key, 'private');
        storage.setItem('catube_font_size', '18');
        storage.setItem('catube_background_color', '#123456');
        storage.setItem('catube_history', JSON.stringify([song(1)]));
        const snapshot = data.collect();
        expect(JSON.stringify(snapshot)).not.toContain('private');
        expect(snapshot.data.settings.font).toBe('18');
        data.apply(snapshot.data);
        expect(JSON.parse(storage.getItem('catube_history'))[0].thumbnail).toContain(song(1).id);
        expect(storage.getItem('adminToken')).toBe('private');
    });
});

// Quota realista: l'error persisteix fins que s'allibera espai, com al navegador.
function quotaStorage(limit = 12000) {
    const values = new Map();
    let failures = 0;
    const used = () => [...values].reduce((n, [k, v]) => n + k.length + v.length, 0);
    return {
        getItem: (key) => values.get(key) ?? null,
        key: (index) => [...values.keys()][index] ?? null,
        get length() { return values.size; },
        get failures() { return failures; },
        used,
        setItem(key, raw) {
            const value = String(raw);
            const previous = values.has(key) ? key.length + values.get(key).length : 0;
            if (used() - previous + key.length + value.length > limit) {
                failures++;
                throw Object.assign(new Error('Storage full'), { name: 'QuotaExceededError' });
            }
            values.set(key, value);
        },
        removeItem: (key) => values.delete(key),
        fillCache(key = 'iutube_cache_feed_json') {
            values.delete(key);
            this.setItem(key, 'x'.repeat(Math.max(0, limit - used() - key.length - 1)));
        },
    };
}

describe('Quota local durant la sincronització', () => {
    it.each(['device', 'journal', 'apply'])('recupera espai al pas %s sense tocar dades personals', async (stage) => {
        const s = server();
        const remote = setup(s.fetch);
        remote.storage.setItem('catube_liked_videos', JSON.stringify([song(2)]));
        await remote.api.connect();
        const storage = quotaStorage();
        const a = setup(s.fetch, { localStorage: storage });
        const protectedKeys = ['catube_continue_watching_v1', 'catube_anonymous_analytics_enabled',
            'unrelated_app_data', 'catube_drive_state_v1_other', 'catube_last_radio'];
        for (const key of protectedKeys) storage.setItem(key, 'preserve');
        storage.setItem('catube_history', JSON.stringify([song(1)]));
        if (stage !== 'device') storage.setItem('catube_drive_device_v1', randomUUID());
        if (stage === 'apply') s.state.onWrite = () => storage.fillCache('catube_cat_Pop');
        else storage.fillCache();
        await a.api.connect();
        expect(storage.failures).toBeGreaterThan(0);
        expect(a.el('googleDriveFeedback').textContent).toContain('completada');
        expect(a.data.collect().data.history.map(v => v.id)).toEqual([song(1).id]);
        expect(a.data.collect().data.likes.map(v => v.id)).toEqual([song(2).id]);
        for (const key of protectedKeys) expect(storage.getItem(key)).toBe('preserve');
        expect(storage.getItem('iutube_cache_feed_json')).toBeNull();
        expect(storage.getItem('catube_cat_Pop')).toBeNull();
        const saved = JSON.parse(storage.getItem('catube_drive_state_v1_user1'));
        expect(saved.baseline.likes.map(v => v.id)).toEqual([song(2).id]);
    });
    it('restaura tot si les dades soles no hi caben, fins i tot després de reduir una clau i ampliar-ne una altra', () => {
        const storage = quotaStorage(2000);
        const a = setup(vi.fn(), { localStorage: storage });
        storage.setItem('catube_history', JSON.stringify(Array.from({ length: 8 }, (_, i) => song(i))));
        storage.setItem('other_app', 'x'.repeat(500));
        const previous = storage.getItem('catube_history');
        expect(() => a.data.apply({ history: [], likes: [song(20), song(21)],
            playlists: [{ id: 'list1', name: 'Gran', videos: Array.from({ length: 10 }, (_, i) => song(i)) }] }))
            .toThrow('Storage full');
        expect(storage.getItem('catube_history')).toBe(previous);
        expect(storage.getItem('catube_liked_videos')).toBeNull();
        expect(storage.getItem('catube_playlists')).toBeNull();
        expect(storage.getItem('other_app')).toBe('x'.repeat(500));
    });
    it('si falla el diari final restaura les dades i la base pendent, i el reintent recupera la fusió', async () => {
        const s = server(); const remote = setup(s.fetch); const a = setup(s.fetch);
        remote.storage.setItem('catube_liked_videos', JSON.stringify([song(2)]));
        await remote.api.connect();
        a.storage.setItem('catube_history', JSON.stringify([song(1)]));
        const originalHistory = a.storage.getItem('catube_history');
        const write = a.storage.setItem.bind(a.storage);
        let blockFinal = true;
        a.storage.setItem = (key, value) => {
            if (blockFinal && key === 'catube_drive_state_v1_user1' && JSON.parse(value).baseline.likes.length) {
                throw Object.assign(new Error('Storage full'), { name: 'QuotaExceededError' });
            }
            write(key, value);
        };
        await a.api.connect();
        expect(a.el('googleDriveFeedback').textContent).toContain('prou espai');
        expect(a.storage.getItem('catube_history')).toBe(originalHistory);
        expect(a.storage.getItem('catube_liked_videos')).toBeNull();
        expect(JSON.parse(a.storage.getItem('catube_drive_state_v1_user1')).baseline.likes).toEqual([]);
        expect(JSON.parse(a.storage.getItem('catube_drive_account_v1')).lastSync).toBeNull();
        blockFinal = false;
        await a.api.connect();
        expect(a.el('googleDriveFeedback').textContent).toContain('completada');
        expect(a.data.collect().data.likes.map(v => v.id)).toEqual([song(2).id]);
    });
    it('un error aliè a la quota no elimina cap memòria cau', () => {
        const a = setup();
        a.storage.setItem('iutube_feed_snapshot_v1', 'cached');
        a.storage.setItem = () => { throw Object.assign(new Error('blocked'), { name: 'SecurityError' }); };
        expect(() => a.data.writeStorage('catube_drive_device_v1', 'id')).toThrow('blocked');
        expect(a.storage.getItem('iutube_feed_snapshot_v1')).toBe('cached');
    });
});

describe('Flux OAuth i Drive simulat', () => {
    it('envia el cor acabat de prémer encara que el mòbil no tingui cap moment inactiu', async () => {
        const s = server();
        const idle = vi.fn();
        const mobile = setup(s.fetch, { requestIdleCallback: idle });
        const desktop = setup(s.fetch);
        runInContext(readFileSync(new URL('../js/features/likes.js', import.meta.url), 'utf8'), mobile.ctx);
        const likes = mobile.ctx.SegueixApp.features.likes;
        likes.toggleLikeVideo(song(1));
        await mobile.api.connect();
        await desktop.api.connect();
        expect(desktop.data.collect().data.likes.map(v => v.id)).toEqual([song(1).id]);
        expect(desktop.el('googleDriveAccount').textContent).toContain('2 aparells · 1 m’agrada');
        const reopened = setup(s.fetch, { localStorage: desktop.storage });
        reopened.api.register();
        expect(reopened.el('googleDriveAccount').textContent).toContain('2 aparells · 1 m’agrada');
        likes.toggleLikeVideo(song(1));
        await mobile.api.connect();
        await desktop.api.connect();
        expect(desktop.data.collect().data.likes).toEqual([]);
    });
    it('conserva dos cors premuts seguits i permet desfer-los abans de sincronitzar', () => {
        const a = setup(vi.fn(), { requestIdleCallback: vi.fn() });
        runInContext(readFileSync(new URL('../js/features/likes.js', import.meta.url), 'utf8'), a.ctx);
        const likes = a.ctx.SegueixApp.features.likes;
        likes.toggleLikeVideo(song(1));
        likes.toggleLikeVideo(song(2));
        likes.toggleLikeVideo(song(1));
        expect(a.data.collect().data.likes.map(v => v.id)).toEqual([song(2).id]);
    });
    it('dos enviaments simultanis no es trepitgen i convergeixen després', async () => {
        const s = server(); const a = setup(s.fetch); const b = setup(s.fetch);
        a.storage.setItem('catube_liked_videos', JSON.stringify([song(1)]));
        b.storage.setItem('catube_liked_videos', JSON.stringify([song(2)]));
        await Promise.all([a.api.connect(), b.api.connect()]);
        expect(s.files.size).toBe(2);
        await Promise.all([a.api.connect(), b.api.connect()]);
        expect(a.data.collect().data.likes).toHaveLength(2);
        expect(b.data.collect().data.likes).toHaveLength(2);
    });
    it('una fallada d’espai en aplicar dades restaura les claus locals anteriors', () => {
        const { data, storage } = setup();
        storage.setItem('catube_history', JSON.stringify([song(1)]));
        const before = storage.getItem('catube_history');
        const realSet = storage.setItem.bind(storage);
        let failed = false;
        storage.setItem = (key, value) => {
            if (key === 'catube_playlists' && !failed) { failed = true; throw new Error('QuotaExceededError'); }
            realSet(key, value);
        };
        expect(() => data.apply({ history: [song(2)], likes: [song(3)] })).toThrow();
        expect(storage.getItem('catube_history')).toBe(before);
        expect(storage.getItem('catube_liked_videos')).toBeNull();
    });
    it('sincronitza dos aparells, elimina un favorit i mai desa el token', async () => {
        const s = server();
        const a = setup(s.fetch);
        const b = setup(s.fetch);
        a.storage.setItem('catube_liked_videos', JSON.stringify([song(1)]));
        b.storage.setItem('catube_history', JSON.stringify([song(2)]));
        await a.api.connect();
        await b.api.connect();
        await a.api.connect();
        expect(a.data.collect().data.history).toHaveLength(1);
        expect(b.data.collect().data.likes).toHaveLength(1);
        expect(s.files.size).toBe(2);
        a.storage.setItem('catube_liked_videos', '[]');
        a.storage.setItem('user_liked_videos', '[]');
        await a.api.connect();
        await b.api.connect();
        await a.api.connect();
        expect(b.data.collect().data.likes).toEqual([]);
        expect(a.el('googleDriveFeedback').textContent).toContain('completada');
        expect(a.storage.getItem('catube_drive_state_v1_user1')).not.toContain('secret-token');
        expect(s.fetch.mock.calls.every(([, options]) => options.headers.Authorization === 'Bearer secret-token')).toBe(
            true
        );
    });
    it('no perd dades locals ni remotes si falla una escriptura; es recupera en reintentar', async () => {
        const s = server();
        const a = setup(s.fetch);
        const b = setup(s.fetch);
        a.storage.setItem('catube_liked_videos', JSON.stringify([song(1)]));
        await a.api.connect();
        b.storage.setItem('catube_liked_videos', JSON.stringify([song(2)]));
        s.state.failWrite = true;
        await b.api.connect();
        expect(b.data.collect().data.likes.map((v) => v.id)).toEqual([song(2).id]);
        s.state.failWrite = false;
        await b.api.connect();
        expect(b.data.collect().data.likes).toHaveLength(2);
    });
    it('conserva canvis fets durant la petició i els envia a la següent sincronització', async () => {
        const s = server();
        const a = setup(s.fetch);
        a.storage.setItem('catube_liked_videos', JSON.stringify([song(1)]));
        s.state.onWrite = () => a.storage.setItem('catube_liked_videos', JSON.stringify([song(1), song(2)]));
        await a.api.connect();
        expect(a.data.collect().data.likes).toHaveLength(2);
        s.state.onWrite = null;
        await a.api.connect();
        const b = setup(s.fetch);
        await b.api.connect();
        expect(b.data.collect().data.likes).toHaveLength(2);
    });
    it('bloqueja un canvi accidental de compte i conserva les dades en desconnectar', async () => {
        const s = server();
        const a = setup(s.fetch);
        a.storage.setItem('catube_liked_videos', JSON.stringify([song(1)]));
        await a.api.connect();
        s.state.account = 'other';
        await a.api.connect();
        expect(a.el('googleDriveFeedback').textContent).toContain('altre compte');
        a.api.disconnect();
        expect(a.storage.getItem('catube_drive_account_v1')).toBeNull();
        expect(a.data.collect().data.likes).toHaveLength(1);
    });
    it('llegeix totes les pàgines i atura una còpia malmesa abans d’escriure', async () => {
        const s = server();
        const a = setup(s.fetch);
        const b = setup(s.fetch);
        a.storage.setItem('catube_liked_videos', JSON.stringify([song(1)]));
        await a.api.connect();
        s.state.paginated = true;
        await b.api.connect();
        expect(b.data.collect().data.likes).toHaveLength(1);
        s.state.corrupt = true;
        await b.api.connect();
        expect(b.el('googleDriveFeedback').textContent).toContain('no és compatible');
        expect(b.data.collect().data.likes).toHaveLength(1);
    });
    it('tracta permís denegat, finestra cancel·lada, sessió caducada i quota', async () => {
        const s = server();
        const a = setup(s.fetch);
        const oauth = a.ctx.google.accounts.oauth2;
        oauth.initTokenClient = (opts) => ({ requestAccessToken: () => opts.callback({ error: 'access_denied' }) });
        await a.api.connect();
        expect(s.fetch).not.toHaveBeenCalled();
        oauth.initTokenClient = (opts) => ({ requestAccessToken: () => opts.error_callback({ type: 'popup_closed' }) });
        await a.api.connect();
        expect(a.el('googleDriveFeedback').textContent).toContain('cancel·lat');
        const b = setup(s.fetch);
        s.state.failStatus = 401;
        await b.api.connect();
        expect(b.el('googleDriveFeedback').textContent).toContain('caducat');
        s.state.failStatus = 429;
        await b.api.connect();
        expect(b.el('googleDriveFeedback').textContent).toContain('limitant');
    });
    it('mostra l’estat activat en obrir Configuració abans de connectar', () => {
        const a = setup();
        a.el('googleDriveFeedback').textContent = 'La sincronització amb Google Drive està pendent d’activació.';
        a.api.register();
        expect(a.el('googleDriveFeedback').textContent).toContain('Connecta amb Google Drive');
        expect(a.el('googleDriveSync').disabled).toBe(false);
        expect(a.ctx.fetch).not.toHaveBeenCalled();
    });
    it('recupera el compte i la data després de sincronitzar i recarregar', async () => {
        const s = server();
        const a = setup(s.fetch);
        a.api.register();
        await a.api.connect();
        expect(a.el('googleDriveFeedback').textContent).toContain('completada');
        s.fetch.mockClear();

        const b = setup(s.fetch, { localStorage: a.storage });
        b.el('googleDriveFeedback').textContent = 'La sincronització amb Google Drive està pendent d’activació.';
        b.api.register();
        expect(b.el('googleDriveFeedback').textContent).toContain('Compte connectat');
        expect(b.el('googleDriveAccount').textContent).toContain('user1@example.test');
        expect(b.el('googleDriveAccount').textContent).toContain('Última sincronització:');
        expect(b.el('googleDriveSync').textContent).toBe('Sincronitza');
        expect(b.el('googleDriveSync').disabled).toBe(false);
        expect(b.el('googleDriveDisconnect').hidden).toBe(false);
        expect(s.fetch).not.toHaveBeenCalled();

        s.state.failStatus = 429;
        await b.api.connect();
        expect(b.el('googleDriveFeedback').textContent).toContain('limitant');
    });
    it('actualitza el panell si una altra pestanya desconnecta el compte', () => {
        const a = setup();
        a.storage.setItem('catube_drive_account_v1', JSON.stringify({ id: 'user1', label: 'user1@example.test' }));
        a.api.register();
        expect(a.el('googleDriveFeedback').textContent).toContain('Compte connectat');
        expect(a.el('googleDriveAccount').textContent).not.toContain('Última sincronització:');
        a.storage.removeItem('catube_drive_account_v1');
        const handler = a.ctx.addEventListener.mock.calls.find(([event]) => event === 'storage')[1];
        handler({ key: 'catube_drive_account_v1' });
        expect(a.el('googleDriveFeedback').textContent).toContain('Connecta amb Google Drive');
        expect(a.el('googleDriveAccount').textContent).toBe('');
        expect(a.el('googleDriveDisconnect').hidden).toBe(true);
    });
    it('no fa peticions abans de l’activació ni sense connexió', async () => {
        const s = server();
        const a = setup(s.fetch, { SEGUEIX_GOOGLE_DRIVE_CLIENT_ID: '' });
        a.api.register();
        await a.api.connect();
        expect(s.fetch).not.toHaveBeenCalled();
        expect(a.el('googleDriveSync').disabled).toBe(true);
        expect(a.el('googleDriveFeedback').textContent).toContain('pendent d’activació');
        const b = setup(s.fetch);
        b.ctx.navigator.onLine = false;
        await b.api.connect();
        expect(s.fetch).not.toHaveBeenCalled();
        expect(b.el('googleDriveFeedback').textContent).toContain('Internet');
    });
});

describe('sincronització automàtica sense interrompre la música', () => {
    afterEach(() => vi.useRealTimers());
    const automatic = s => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-07T12:00:00Z'));
        const a = setup(s.fetch, { setTimeout, clearTimeout });
        a.ctx.document.visibilityState = 'visible';
        a.ctx.google.accounts.oauth2.initTokenClient = vi.fn(a.ctx.google.accounts.oauth2.initTokenClient);
        a.api.register();
        return a;
    };
    it('comprova cada minut sense una altra finestra Google i no transfereix còpies inalterades', async () => {
        const s = server(); s.state.versioned = true;
        const a = automatic(s);
        await a.api.connect();
        s.fetch.mockClear();
        await vi.advanceTimersByTimeAsync(60000);
        expect(s.fetch).toHaveBeenCalledTimes(2); // compte + versions; cap descàrrega ni pujada
        expect(a.ctx.google.accounts.oauth2.initTokenClient).toHaveBeenCalledTimes(1);
        expect(a.ctx.location.reload).not.toHaveBeenCalled();
    });
    it('agrupa diversos cors i els envia deu segons després de l’últim canvi', async () => {
        const s = server(); s.state.versioned = true;
        const a = automatic(s);
        await a.api.connect(); s.fetch.mockClear();
        const onChange = a.ctx.addEventListener.mock.calls.find(([type]) => type === 'segueix:music-prefs-changed')[1];
        for (let n = 1; n <= 5; n++) {
            a.storage.setItem('catube_liked_videos', JSON.stringify(Array.from({ length: n }, (_, i) => song(i + 1))));
            onChange();
            await vi.advanceTimersByTimeAsync(1000);
        }
        expect(s.fetch).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(10000);
        const writes = s.fetch.mock.calls.filter(([, options]) => options.method === 'PATCH');
        expect(writes).toHaveLength(1);
        expect(a.model.materialize([...s.files.values()][0].doc).likes).toHaveLength(5);
    });
    it('aplica els canvis entrants amb el hook de vista i conserva la reproducció', async () => {
        const s = server(); s.state.versioned = true;
        const a = automatic(s);
        const refreshView = vi.fn();
        a.api.registerRuntime({ refreshView });
        await a.api.connect();
        const b = setup(s.fetch);
        b.storage.setItem('catube_liked_videos', JSON.stringify([song(1)]));
        await b.api.connect();
        await vi.advanceTimersByTimeAsync(60000);
        expect(a.data.collect().data.likes.map(v => v.id)).toEqual([song(1).id]);
        expect(refreshView).toHaveBeenCalledTimes(1);
        expect(a.ctx.location.reload).not.toHaveBeenCalled();
    });
    it('l’historial espera el cicle d’un minut en lloc d’enviar cada escolta', async () => {
        const s = server(); s.state.versioned = true;
        const a = automatic(s);
        await a.api.connect(); s.fetch.mockClear();
        a.storage.setItem('catube_history', JSON.stringify([song(1)]));
        await vi.advanceTimersByTimeAsync(15000);
        expect(s.fetch).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(45000);
        expect(s.fetch.mock.calls.filter(([, options]) => options.method === 'PATCH')).toHaveLength(1);
        expect(a.model.materialize([...s.files.values()][0].doc).history.map(v => v.id)).toEqual([song(1).id]);
    });
    it('atura les peticions en segon pla, sense xarxa o desconnectat, i les reprèn en tornar', async () => {
        const s = server(); s.state.versioned = true;
        const a = automatic(s);
        await a.api.connect(); s.fetch.mockClear();
        a.ctx.document.visibilityState = 'hidden';
        await vi.advanceTimersByTimeAsync(70000);
        expect(s.fetch).not.toHaveBeenCalled();
        a.ctx.document.visibilityState = 'visible';
        a.ctx.navigator.onLine = false;
        await vi.advanceTimersByTimeAsync(10000);
        expect(s.fetch).not.toHaveBeenCalled();
        a.ctx.navigator.onLine = true;
        await vi.advanceTimersByTimeAsync(5000);
        expect(s.fetch).toHaveBeenCalledTimes(2);
        a.api.disconnect(); s.fetch.mockClear();
        await vi.advanceTimersByTimeAsync(70000);
        expect(s.fetch).not.toHaveBeenCalled();
    });
    it('quan caduca l’accés avisa sense obrir Google automàticament', async () => {
        const s = server();
        const a = automatic(s);
        const oauth = a.ctx.google.accounts.oauth2;
        oauth.initTokenClient = vi.fn(options => ({
            requestAccessToken: () => options.callback({ access_token: 'short-lived', expires_in: 90 }),
        }));
        await a.api.connect(); s.fetch.mockClear();
        await vi.advanceTimersByTimeAsync(70000);
        expect(s.fetch).not.toHaveBeenCalled();
        expect(oauth.initTokenClient).toHaveBeenCalledTimes(1);
        expect(a.el('googleDriveFeedback').textContent).toContain('renovar');
        await a.api.connect();
        expect(oauth.initTokenClient).toHaveBeenCalledTimes(2);
    });
    it('espacia els reintents quan Drive limita les peticions', async () => {
        const s = server();
        const a = automatic(s);
        await a.api.connect(); s.fetch.mockClear();
        s.state.failStatus = 429;
        await vi.advanceTimersByTimeAsync(60000);
        expect(s.fetch).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(60000);
        expect(s.fetch).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(60000);
        expect(s.fetch).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(60000);
        expect(s.fetch).toHaveBeenCalledTimes(3);
    });
});
