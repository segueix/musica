import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it, expect, vi } from 'vitest';

const source = readFileSync(new URL('../js/static-seo.js', import.meta.url), 'utf8');
function boot({ pathname = '/musica/', search = '', recovery = false, redirect = '', routes = {} } = {}) {
    const location = { origin: 'https://music.example', pathname, search, hash: '#punt', replace: vi.fn() };
    const button = { dataset: { videoId: 'song0000001' }, addEventListener: vi.fn() };
    const frame = { focus: vi.fn() };
    const container = { replaceChildren: vi.fn() };
    const appLink = { href: 'https://music.example/musica/?v=song0000001' };
    const elements = { '[data-video-id]': button, '[data-static-player]': container, '[data-app-video]': appLink,
        h1: { textContent: 'Cançó' }, '[data-static-recovery]': recovery ? { dataset: { base: '/musica/' } } : null,
        '[data-static-redirect]': redirect ? { href: redirect } : null };
    const document = { querySelector: selector => elements[selector], createElement: vi.fn(() => frame) };
    const fetch = vi.fn(async () => ({ ok: true, json: async () => routes }));
    vm.runInNewContext(source, { window: { location }, location, document, fetch, URL, URLSearchParams });
    return { location, document, fetch, button, frame, container, appLink };
}

describe('comportament de les pàgines estàtiques', () => {
    it('només crea el reproductor després del clic i conserva el segon inicial', () => {
        const app = boot({ search: '?t=73' });
        expect(app.document.createElement).not.toHaveBeenCalled();
        expect(app.appLink.href).toContain('&t=73');
        app.button.addEventListener.mock.calls[0][1]({ currentTarget: app.button });
        expect(app.frame.src).toBe('https://www.youtube-nocookie.com/embed/song0000001?autoplay=1&start=73');
        expect(app.container.replaceChildren).toHaveBeenCalledWith(app.frame);
        expect(app.button.hidden).toBe(true);
    });

    it('descarta segons inicials invàlids', () => {
        const app = boot({ search: '?t=-10' });
        app.button.addEventListener.mock.calls[0][1]({ currentTarget: app.button });
        expect(app.frame.src).not.toContain('start=');
        expect(app.appLink.href).not.toContain('&t=');
    });

    it('recupera una URL antiga coneguda dins la subcarpeta amb temps i fragment', async () => {
        const app = boot({ pathname: '/musica/video/titol-song0000001', search: '?t=73', recovery: true,
            routes: { videos: { song0000001: 'compartir/canco/song0000001.html' } } });
        await vi.waitFor(() => expect(app.location.replace).toHaveBeenCalledWith('https://music.example/musica/compartir/canco/song0000001.html?t=73#punt'));
        expect(app.fetch).toHaveBeenCalledWith('/musica/data/static-routes.json', { cache: 'no-cache' });
    });

    it('manté la 404 per a IDs desconeguts', async () => {
        const app = boot({ pathname: '/musica/video/song0000002', recovery: true });
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(app.location.replace).not.toHaveBeenCalled();
    });

    it('no segueix redireccions a un altre domini', () => {
        const app = boot({ redirect: 'https://outside.example/' });
        expect(app.location.replace).not.toHaveBeenCalled();
    });
});
