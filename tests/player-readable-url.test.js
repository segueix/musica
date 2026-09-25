import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const playerSource = readFileSync(new URL('../js/features/player.js', import.meta.url), 'utf8');

function bootPlayer({ title = 'À Punt Mèdia: vídeo de prova' } = {}) {
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
        pathname: '/',
        search: '',
        hash: '',
    };

    function applyUrl(rawUrl) {
        const parsed = new URL(rawUrl, 'https://segueix.cat/');
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
        SegueixApp: { state: { player: {} }, features: {} },
        document,
        location,
        history,
        URLSearchParams,
        setTimeout: fn => fn(),
        requestAnimationFrame: fn => fn(),
        addEventListener: vi.fn(),
    };

    vm.runInNewContext(playerSource, { window });
    return { window, history, elements };
}

describe('URL llegible del vídeo dins la PWA', () => {
    it('substitueix ?v= per /video/<slug>-<id> sense crear una entrada extra', () => {
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
        expect(history.replaceState).toHaveBeenCalledTimes(1);
        expect(window.location.pathname).toBe('/video/a-punt-media-video-de-prova-AbCdEf12345');
        expect(window.location.search).toBe('');
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

        expect(window.location.pathname).toBe('/video/historia-de-catalunya-ZyXwVu98765');
        expect(window.location.search).toBe('?t=73');
        expect(history.state.videoId).toBe(videoId);
    });
});
