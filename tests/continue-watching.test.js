import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { loadScript } from './setup.js';

const playerSource = readFileSync(new URL('../js/features/player.js', import.meta.url), 'utf8');

function createClassList() {
    const values = new Set();
    return {
        add: value => values.add(value),
        remove: value => values.delete(value),
        contains: value => values.has(value),
        toggle: (value, force) => {
            if (force === true) values.add(value);
            else if (force === false) values.delete(value);
            else if (values.has(value)) values.delete(value);
            else values.add(value);
        },
    };
}

function bootPlayer({ search = '', pathname = '/' } = {}) {
    const entries = new Map();
    const storage = {
        key: 'catube_continue_watching_v1',
        minSeconds: 30,
        completeRatio: 0.95,
        load: vi.fn(() => Array.from(entries.values())),
        get: vi.fn(id => entries.get(id) || null),
        upsert: vi.fn(entry => {
            entries.set(entry.id, { ...entry });
            return true;
        }),
        remove: vi.fn(id => {
            entries.delete(id);
            return true;
        }),
    };

    const elements = {
        videoTitle: { textContent: 'Vídeo de prova' },
        placeholderImage: { src: 'https://i.ytimg.com/vi/AbCdEf12345/hqdefault.jpg', currentSrc: '' },
        channelInfo: {
            querySelector: () => ({ textContent: 'Canal de prova' }),
        },
        mainContent: { classList: createClassList() },
        watchPage: { classList: createClassList() },
    };

    const document = {
        readyState: 'complete',
        visibilityState: 'visible',
        documentElement: { dataset: {} },
        head: { appendChild: vi.fn() },
        getElementById: vi.fn(id => elements[id] || null),
        querySelector: vi.fn(() => null),
        createElement: vi.fn(() => ({
            id: '',
            className: '',
            type: '',
            textContent: '',
            style: {},
            dataset: {},
            classList: createClassList(),
            setAttribute: vi.fn(),
            appendChild: vi.fn(),
            addEventListener: vi.fn(),
        })),
        addEventListener: vi.fn(),
    };

    const location = { pathname, search, hash: '' };
    const history = { state: null, replaceState: vi.fn(), pushState: vi.fn() };
    const app = {
        state: { player: {} },
        features: {},
        utils: { continueWatchingStorage: storage },
    };
    const window = {
        SegueixApp: app,
        document,
        location,
        history,
        URLSearchParams,
        setTimeout,
        requestAnimationFrame: fn => fn(),
        addEventListener: vi.fn(),
    };

    vm.runInNewContext(playerSource, { window, URLSearchParams, Date, JSON, Number, String, Math, RegExp, Set });
    return { window, storage, entries };
}

describe('emmagatzematge de Continua mirant', () => {
    it('respecta el llindar, elimina al 95% i tolera dades corruptes', () => {
        const ctx = loadScript('js/utils/storage.js');
        const storage = ctx.SegueixApp.utils.continueWatchingStorage;

        expect(storage.upsert({ id: 'AbCdEf12345', position: 29, duration: 100, updatedAt: 1 })).toBe(false);
        expect(storage.load()).toHaveLength(0);

        expect(storage.upsert({ id: 'AbCdEf12345', position: 30, duration: 100, updatedAt: 2 })).toBe(true);
        expect(storage.get('AbCdEf12345')?.position).toBe(30);

        expect(storage.upsert({ id: 'AbCdEf12345', position: 95, duration: 100, updatedAt: 3 })).toBe(true);
        expect(storage.get('AbCdEf12345')).toBeNull();

        ctx.localStorage.setItem(storage.key, '{corrupt');
        expect(storage.load()).toEqual([]);
    });

    it('recupera metadades de l’historial i eliminar progrés no elimina historial', () => {
        const ctx = loadScript('js/utils/storage.js');
        const storage = ctx.SegueixApp.utils.continueWatchingStorage;
        const history = [
            {
                id: 'AbCdEf12345',
                title: 'Títol des de l’historial',
                channelTitle: 'Canal des de l’historial',
                thumbnail: 'https://example.com/thumb.jpg',
                historySource: 'api',
            },
        ];
        ctx.localStorage.setItem('catube_history', JSON.stringify(history));

        expect(storage.upsert({ id: 'AbCdEf12345', position: 40, duration: 100, updatedAt: 10 })).toBe(true);
        expect(storage.get('AbCdEf12345')).toMatchObject({
            title: 'Títol des de l’historial',
            channel: 'Canal des de l’historial',
            thumbnail: 'https://example.com/thumb.jpg',
        });

        expect(storage.remove('AbCdEf12345')).toBe(true);
        expect(JSON.parse(ctx.localStorage.getItem('catube_history'))).toEqual(history);
    });

    it('conserva com a màxim 30 entrades ordenades per activitat recent', () => {
        const ctx = loadScript('js/utils/storage.js');
        const storage = ctx.SegueixApp.utils.continueWatchingStorage;
        for (let i = 0; i < 35; i += 1) {
            storage.upsert({
                id: `video-${String(i).padStart(2, '0')}`,
                position: 40,
                duration: 100,
                updatedAt: i + 1,
            });
        }
        const items = storage.load();
        expect(items).toHaveLength(30);
        expect(items[0].id).toBe('video-34');
        expect(items.at(-1).id).toBe('video-05');
    });
});

describe('represa del reproductor', () => {
    it('prioritza un temps explícit de l’enllaç per sobre del progrés desat', () => {
        const videoId = 'AbCdEf12345';
        const { window, entries } = bootPlayer({ search: `?v=${videoId}&t=41` });
        entries.set(videoId, { id: videoId, position: 120, duration: 300, updatedAt: 1 });

        const resolved = window.SegueixApp.features.continueWatching._test.resolvePlaybackOptions(videoId, {});
        expect(resolved.options.startAt).toBe(41);
        expect(resolved.resumed).toBe(false);
    });

    it('comença de zero encara que hi hagi progrés desat i no hi hagi temps explícit', () => {
        const videoId = 'AbCdEf12345';
        const { window, entries } = bootPlayer();
        entries.set(videoId, { id: videoId, position: 120, duration: 300, updatedAt: 1 });

        const resolved = window.SegueixApp.features.continueWatching._test.resolvePlaybackOptions(videoId, {});
        expect(resolved.options.startAt).toBe(0);
        expect(resolved.resumed).toBe(false);
    });

    it('desa en reproducció, desa en canvi de vídeo i elimina en finalitzar', () => {
        const videoId = 'AbCdEf12345';
        const { window, storage } = bootPlayer();
        const testApi = window.SegueixApp.features.continueWatching._test;

        testApi.beginProgressTracking(videoId, 'api', { options: { startAt: 0 }, saved: null });
        testApi.processContinueWatchingPayload({ event: 'onStateChange', info: 1 }, { videoIdHint: videoId });
        testApi.processContinueWatchingPayload(
            { event: 'infoDelivery', info: { currentTime: 35, duration: 100 } },
            { videoIdHint: videoId }
        );
        expect(storage.upsert).toHaveBeenCalled();

        storage.upsert.mockClear();
        testApi.processContinueWatchingPayload(
            { event: 'infoDelivery', info: { currentTime: 52, duration: 100 } },
            { videoIdHint: videoId }
        );
        testApi.stopProgressTrackingForSwitch('ZyXwVu98765', {});
        expect(storage.upsert).toHaveBeenCalled();

        testApi.beginProgressTracking(videoId, 'api', { options: { startAt: 60 }, saved: null });
        storage.remove.mockClear();
        testApi.processContinueWatchingPayload({ event: 'onStateChange', info: 0 }, { videoIdHint: videoId });
        expect(storage.remove).toHaveBeenCalledWith(videoId);
    });

    it('elimina al 95% i exclou directes detectats pel reproductor', () => {
        const videoId = 'AbCdEf12345';
        const { window, storage } = bootPlayer();
        const testApi = window.SegueixApp.features.continueWatching._test;

        testApi.beginProgressTracking(videoId, 'api', { options: { startAt: 0 }, saved: null });
        testApi.processContinueWatchingPayload(
            { event: 'infoDelivery', info: { currentTime: 95, duration: 100 } },
            { videoIdHint: videoId }
        );
        expect(storage.remove).toHaveBeenCalledWith(videoId);

        storage.remove.mockClear();
        storage.upsert.mockClear();
        testApi.beginProgressTracking(videoId, 'api', { options: { startAt: 0 }, saved: null });
        testApi.processContinueWatchingPayload(
            { event: 'infoDelivery', info: { currentTime: 60, duration: 100, videoData: { isLive: true } } },
            { videoIdHint: videoId }
        );
        expect(storage.remove).toHaveBeenCalledWith(videoId);
        expect(storage.upsert).not.toHaveBeenCalled();
    });
});
