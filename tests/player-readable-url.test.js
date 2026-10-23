import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const playerSource = readFileSync(new URL('../js/features/player.js', import.meta.url), 'utf8');

function bootPlayer({ title = 'À Punt Mèdia: vídeo de prova', hostname = '', pathname = '/', base = '', staticSite = false } = {}) {
    const elements = {
        videoTitle: { textContent: title },
        mainContent: { classList: { contains: () => false } },
        watchPage: { classList: { contains: () => false } },
    };

    const document = {
        readyState: 'complete',
        documentElement: { dataset: {} },
        getElementById: vi.fn(id => elements[id] || null),
        addEventListener: vi.fn(),
    };

    const location = {
        hostname,
        pathname,
        search: '',
        hash: '',
    };

    function applyUrl(rawUrl) {
        const parsed = new URL(rawUrl, `https://segueix.cat${location.pathname}${location.search}`);
        location.pathname = parsed.pathname;
        location.search = parsed.search;
        location.hash = parsed.hash;
    }

    const history = {
        state: null,
        pushState: vi.fn((state, _title, url) => {
            history.state = state;
            applyUrl(url);
        }),
        replaceState: vi.fn((state, _title, url) => {
            history.state = state;
            applyUrl(url);
        }),
    };

    const window = {
        SEGUEIX_STATIC_SITE: staticSite,
        fetch: vi.fn(async () => ({ ok: true, json: async () => ({ videos: { song0000001: 'video/canco-de-prova/song0000001/' } }) })),
        SegueixApp: { state: { player: {} }, features: {}, utils: base ? { appBasePath: () => base } : {} },
        document,
        location,
        history,
        URLSearchParams,
        setTimeout: fn => fn(),
        requestAnimationFrame: fn => fn(),
        addEventListener: vi.fn(),
    };

    if (staticSite) vm.runInNewContext(readFileSync(new URL('../js/utils/public-routes.js', import.meta.url), 'utf8'), { window });
    vm.runInNewContext(playerSource, { window });
    return { window, history, elements };
}

describe('URL llegible del vídeo dins la PWA', () => {
    it('conserva ?v= al domini propi sense crear una entrada extra', () => {
        const { window, history } = bootPlayer();
        const videoId = 'AbCdEf12345';

        window.SegueixApp.features.player.registerRuntime({
            showVideoImpl(id) {
                window.SegueixApp.state.player.currentVideoId = id;
                history.pushState({ videoId: id }, '', `?v=${id}`);
            },
        });

        window.SegueixApp.features.player.showVideo(videoId);

        expect(history.pushState).toHaveBeenCalledTimes(1);
        expect(history.replaceState).not.toHaveBeenCalled();
        expect(window.location.pathname).toBe('/');
        expect(window.location.search).toBe('?v=AbCdEf12345');
        expect(history.state.videoId).toBe(videoId);
    });

    it('conserva el segon inicial en vídeos carregats via API', async () => {
        const { window, history, elements } = bootPlayer({ title: '' });
        const videoId = 'ZyXwVu98765';

        window.SegueixApp.features.player.registerRuntime({
            async showVideoFromAPIImpl(id) {
                window.SegueixApp.state.player.currentVideoId = id;
                history.pushState({ videoId: id }, '', `?v=${id}&t=73`);
                elements.videoTitle.textContent = 'Història de Catalunya';
            },
        });

        await window.SegueixApp.features.player.showVideoFromAPI(videoId, { startAt: 73 });

        expect(window.location.pathname).toBe('/');
        expect(window.location.search).toBe('?v=ZyXwVu98765&t=73');
        expect(history.state.videoId).toBe(videoId);
    });

    it("a GitHub Pages (segueix.github.io/musica/) la URL es queda a /musica/?v=<id>: en recarregar s'obre l'app", () => {
        const { window, history } = bootPlayer({
            hostname: 'segueix.github.io',
            pathname: '/musica/',
            base: '/musica/',
        });
        const videoId = 'AbCdEf12345';

        window.SegueixApp.features.player.registerRuntime({
            showVideoImpl(id) {
                window.SegueixApp.state.player.currentVideoId = id;
                history.pushState({ videoId: id }, '', `?v=${id}`);
            },
        });

        window.SegueixApp.features.player.showVideo(videoId);

        expect(history.replaceState).not.toHaveBeenCalled();
        expect(window.location.pathname).toBe('/musica/');
        expect(window.location.search).toBe(`?v=${videoId}`);
    });

    it('en una web estàtica mostra la ruta publicada del vídeo i la retira en sortir del reproductor', async () => {
        const { window, history } = bootPlayer({ hostname: 'musica.example', pathname: '/musica/', base: '/musica/', staticSite: true });
        await window.SegueixApp.utils.publicRoutes.load();
        window.SegueixApp.features.player.registerRuntime({ showVideoImpl(id) {
            window.SegueixApp.state.player.currentVideoId = id;
            window.SegueixApp.utils.publicRoutes.open('videos', id);
        } });
        window.SegueixApp.features.player.showVideo('song0000001');
        expect(history.pushState).toHaveBeenCalledTimes(1);
        expect(window.location.pathname).toBe('/musica/video/canco-de-prova/song0000001/');
        expect(window.location.search).toBe('');
        window.document.getElementById('watchPage').classList.contains = () => true;
        window.addEventListener.mock.calls.find(([event]) => event === 'popstate')[1]();
        expect(window.location.pathname).toBe('/musica/');
    });

    it("conserva la carpeta de l'app en reproduir", () => {
        const { window, history } = bootPlayer({ pathname: '/musica/', base: '/musica/' });
        const videoId = 'AbCdEf12345';

        window.SegueixApp.features.player.registerRuntime({
            showVideoImpl(id) {
                window.SegueixApp.state.player.currentVideoId = id;
                history.pushState({ videoId: id }, '', `?v=${id}`);
            },
        });

        window.SegueixApp.features.player.showVideo(videoId);

        expect(window.location.pathname).toBe('/musica/');
    });
});

