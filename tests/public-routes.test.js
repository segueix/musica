import { describe, it, expect, vi } from 'vitest';
import { loadScript } from './setup.js';

function boot({ base = '/', delayed = false, ok = true } = {}) {
    const location = { pathname: base, search: '' };
    const pages = { watchPage: false, channelPage: false };
    const apply = (state, _, url) => {
        history.state = state;
        const parsed = new URL(url, 'https://musica.segueix.cat');
        location.pathname = parsed.pathname; location.search = parsed.search;
    };
    const history = { state: null, pushState: vi.fn(apply), replaceState: vi.fn(apply) };
    const routes = { videos: { song0000001: 'video/llum/song0000001/', song0000002: 'video/llum/song0000002/' },
        artists: { UC1: 'creador/grup/', UC2: 'creador/grup-altre/' } };
    let release;
    const response = { ok, json: async () => routes };
    const fetch = vi.fn(() => delayed ? new Promise(resolve => { release = () => resolve(response); }) : Promise.resolve(response));
    const ctx = loadScript('js/utils/public-routes.js', { SEGUEIX_STATIC_SITE: true, fetch, location, history,
        SegueixApp: { utils: { appBasePath: () => base } },
        document: { getElementById: id => ({ classList: { contains: () => pages[id] } }) } });
    return { api: ctx.SegueixApp.utils.publicRoutes, location, history, routes, pages, fetch, release: () => release() };
}

describe('navegació amb les adreces del catàleg publicat', () => {
    it.each(['/', '/musica/'])('mostra cançó i artista, conserva el temps i reemplaça en tornar enrere: %s', async base => {
        const b = boot({ base }); await b.api.load();
        b.api.open('videos', 'song0000001', { startAt: 73 });
        expect(b.location.pathname).toBe(base + 'video/llum/song0000001/');
        expect(b.location.search).toBe('?t=73');
        expect(b.history.state).toEqual({ videoId: 'song0000001' });
        b.api.open('artists', 'UC1');
        expect(b.location.pathname).toBe(base + 'creador/grup/');
        expect(b.location.search).toBe('');
        expect(b.history.state).toEqual({ channelId: 'UC1' });
        b.api.open('videos', 'song0000001', { replaceHistory: true });
        expect(b.history.pushState).toHaveBeenCalledTimes(2);
        expect(b.history.replaceState).toHaveBeenCalled();
        expect(b.fetch).toHaveBeenCalledTimes(1);
        expect(b.fetch).toHaveBeenCalledWith(base + 'data/static-routes.json', { cache: 'no-cache' });
    });
    it('el mapa tardà només reemplaça la cançó que encara està oberta', async () => {
        const b = boot({ delayed: true });
        b.api.open('videos', 'song0000001');
        b.api.open('videos', 'song0000002');
        expect(b.location.search).toBe('?v=song0000002');
        b.release();
        await vi.waitFor(() => expect(b.location.pathname).toBe('/video/llum/song0000002/'));
        expect(b.history.pushState).toHaveBeenCalledTimes(2);
        expect(b.history.replaceState).toHaveBeenCalledTimes(1);
    });
    it('si es tanca la fitxa abans de rebre el mapa no reobre la seva adreça', async () => {
        const b = boot({ delayed: true });
        b.api.open('artists', 'UC1'); b.pages.channelPage = true;
        b.release(); await b.api.load();
        expect(b.history.replaceState).not.toHaveBeenCalled();
    });
    it('conserva una adreça funcional per a vídeos o artistes fora del mapa', async () => {
        const b = boot(); await b.api.load();
        b.api.open('artists', 'unknown'); expect(b.location.search).toBe('?channel=unknown');
        b.api.open('videos', 'unknown', { startAt: 12 }); expect(b.location.search).toBe('?v=unknown&t=12');
        expect(b.location.pathname).toBe('/');
    });
    it('una fallada de xarxa no bloqueja la navegació', async () => {
        const b = boot({ ok: false }); await b.api.load();
        b.api.open('videos', 'song0000001'); await b.api.load();
        expect(b.location.search).toBe('?v=song0000001');
    });
});
