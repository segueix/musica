import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function worker(base = 'https://example.test/musica/') {
    const events = {}, stores = new Map();
    const key = request => typeof request === 'string' ? request : request.url;
    const open = async name => {
        if (!stores.has(name)) stores.set(name, new Map());
        const store = stores.get(name);
        return { put: async (request, response) => store.set(key(request), response), match: async request => store.get(key(request)), addAll: vi.fn() };
    };
    const fetch = vi.fn();
    const self = { location: new URL('sw.js', base), addEventListener: (name, callback) => { events[name] = callback; }, skipWaiting: vi.fn(), clients: { claim: vi.fn() } };
    const caches = { open, match: async request => { for (const store of stores.values()) if (store.has(key(request))) return store.get(key(request)); }, keys: async () => [...stores.keys()], delete: async name => stores.delete(name) };
    class WorkerRequest { constructor(request, options) { Object.assign(this, typeof request === 'string' ? { url: request } : request, options); } }
    vm.runInNewContext(readFileSync('sw.js', 'utf8'), { self, caches, fetch, URL, Request: WorkerRequest, Response, console });
    const response = text => ({ status: 200, type: 'basic', text, clone() { return this; } });
    async function get(relative, mode = 'navigate') {
        let result;
        const pending = [];
        events.fetch({ request: { url: new URL(relative, base).href, method: 'GET', mode }, respondWith: value => { result = value; }, waitUntil: promise => pending.push(promise) });
        const value = await result;
        await Promise.all(pending);
        return value;
    }
    return { get, fetch, response, caches, events, self };
}

describe('cache de la web estàtica', () => {
    it.each(['https://example.test/', 'https://example.test/musica/'])('una fitxa o el panell no substitueixen la portada: %s', async base => {
        const w = worker(base);
        for (const [url, text] of [['?v=primera', 'app'], ['creador/grup/', 'artista'], ['admin-musica.html', 'admin'], ['compartir/canco/canco.html', 'cançó']]) {
            w.fetch.mockResolvedValueOnce(w.response(text));
            expect((await w.get(url)).text).toBe(text);
        }
        w.fetch.mockRejectedValue(new Error('offline'));
        expect((await w.get('?v=segona')).text).toBe('app');
        expect((await w.get('index.html?v=tercera')).text).toBe('app');
        expect((await w.get('creador/grup/')).text).toBe('artista');
        expect((await w.get('admin-musica.html')).text).toBe('admin');
        expect((await w.get('compartir/canco/canco.html')).text).toBe('cançó');
        expect((await w.get('creador/desconegut/')).type).toBe('error');
    });
    it('no desa un 404 ni una redirecció sobre la portada bona', async () => {
        const w = worker();
        w.fetch.mockResolvedValueOnce(w.response('app')); await w.get('');
        w.fetch.mockResolvedValueOnce({ ...w.response('404'), status: 404 }); await w.get('');
        w.fetch.mockResolvedValueOnce({ ...w.response('altre lloc'), redirected: true }); await w.get('');
        w.fetch.mockRejectedValue(new Error('offline'));
        expect((await w.get('?v=id')).text).toBe('app');
    });
    it.each(['feed.json', 'static-routes.json', 'video-channels.json', 'origens-artistes.json'])('refresca %s abans de servir la còpia antiga', async name => {
        const w = worker();
        w.fetch.mockResolvedValueOnce(w.response('antic')); await w.get(`data/${name}`, 'cors');
        w.fetch.mockResolvedValueOnce(w.response('nou'));
        expect((await w.get(`data/${name}`, 'cors')).text).toBe('nou');
        w.fetch.mockRejectedValue(new Error('offline'));
        expect((await w.get(`data/${name}`, 'cors')).text).toBe('nou');
    });
    it('retira el cache antic i espera l’activació demanada', async () => {
        const w = worker();
        await w.caches.open('static-antic');
        w.fetch.mockResolvedValue(w.response('codi'));
        let pending;
        w.events.install({ waitUntil: promise => { pending = promise; } }); await pending;
        expect(w.self.skipWaiting).not.toHaveBeenCalled();
        w.events.activate({ waitUntil: promise => { pending = promise; } }); await pending;
        expect(await w.caches.keys()).not.toContain('static-antic');
        w.events.message({ data: { type: 'SKIP_WAITING' } });
        expect(w.self.skipWaiting).toHaveBeenCalledOnce();
    });

    // 2026-10-24: a musica.segueix.cat (Cloudflare Pages) /index.html respon amb un 308 cap a /. La còpia de la portada
    // es desava redirigida i, en obrir l'app sense xarxa, el navegador la rebutjava: pantalla negra a l'iPhone.
    describe('la portada no es desa ni se serveix redirigida (Cloudflare)', () => {
        const redirected = text => ({
            status: 200,
            type: 'basic',
            redirected: true,
            statusText: 'OK',
            headers: { 'content-type': 'text/html' },
            blob: async () => new Blob([text]),
            clone() { return this; },
        });
        const install = async w => {
            let pending;
            w.events.install({ waitUntil: promise => { pending = promise; } });
            await pending;
        };
        const textOf = async response => (typeof response.text === 'function' ? response.text() : response.text);
        const STATIC = `static-v4-${readFileSync('sw.js', 'utf8').match(/CACHE_VERSION = '([^']+)'/)[1]}`;

        it('la precàrrega en desa una còpia neta i sense xarxa obre l’app', async () => {
            const w = worker('https://musica.example/');
            w.fetch.mockImplementation(async request => (/index\.html$/.test(request.url) ? redirected('app') : w.response('codi')));
            await install(w);
            // Es baixa de la xarxa, no de la memòria cau del navegador (Cloudflare la guarda 4 hores)
            expect(w.fetch.mock.calls.every(([request]) => request.cache === 'reload')).toBe(true);
            w.fetch.mockReset();
            w.fetch.mockRejectedValue(new Error('offline'));
            const page = await w.get('');
            expect(page.redirected).toBe(false);
            expect(await textOf(page)).toBe('app');
        });

        it('una còpia redirigida d’una versió anterior se serveix neta', async () => {
            const w = worker('https://musica.example/');
            const cache = await w.caches.open(STATIC);
            await cache.put('https://musica.example/index.html', redirected('app antiga'));
            w.fetch.mockRejectedValue(new Error('offline'));
            const page = await w.get('?v=canco');
            expect(page.redirected).toBe(false);
            expect(await textOf(page)).toBe('app antiga');
        });

        it('sense la còpia de la portada, l’arrel de l’app; i el codi que falta es revalida', async () => {
            const w = worker('https://musica.example/');
            const cache = await w.caches.open(STATIC);
            await cache.put('https://musica.example/', w.response('arrel'));
            w.fetch.mockRejectedValue(new Error('offline'));
            expect((await w.get('index.html')).text).toBe('arrel');
            w.fetch.mockReset();
            w.fetch.mockResolvedValue(w.response('codi'));
            await w.get('js/nou.js?v=1', 'no-cors');
            expect(w.fetch.mock.calls[0][0].cache).toBe('no-cache');
        });
    });
});
