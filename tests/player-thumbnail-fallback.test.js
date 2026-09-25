import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const playerSource = readFileSync(new URL('../js/features/player.js', import.meta.url), 'utf8');

function bootPlayer() {
    const listeners = new Map();
    const document = {
        readyState: 'complete',
        documentElement: { dataset: {} },
        getElementById: vi.fn(() => null),
        addEventListener: vi.fn((type, handler) => {
            listeners.set(type, handler);
        }),
    };

    const window = {
        SegueixApp: { state: { player: {} }, features: {} },
        document,
        location: { pathname: '/', search: '', hash: '' },
        history: { state: null, replaceState: vi.fn() },
        URLSearchParams,
        setTimeout: fn => fn(),
        requestAnimationFrame: fn => fn(),
        addEventListener: vi.fn(),
    };

    vm.runInNewContext(playerSource, { window });
    return { listeners };
}

function makeVideoImage({ src, width = 480, height = 360 } = {}) {
    return {
        tagName: 'IMG',
        src,
        currentSrc: src,
        naturalWidth: width,
        naturalHeight: height,
        dataset: {},
        style: { visibility: 'hidden' },
        classList: { contains: () => false },
        closest: selector => selector === '.video-thumbnail' ? {} : null,
        getAttribute: name => name === 'src' ? src : null,
    };
}

describe('fallback de caràtules de vídeo', () => {
    it('substitueix una miniatura trencada per la caràtula absoluta de Segueix', () => {
        const { listeners } = bootPlayer();
        const img = makeVideoImage({ src: 'https://i.ytimg.com/vi/AbCdEf12345/maxresdefault.jpg' });

        listeners.get('error')({ target: img });

        expect(img.src).toBe('/img/caratula.png');
        expect(img.dataset.defaultThumbnailFallback).toBe('applied');
        expect(img.style.visibility).toBe('');
    });

    it('detecta el placeholder 120x90 de YouTube encara que respongui HTTP 200', () => {
        const { listeners } = bootPlayer();
        const img = makeVideoImage({
            src: 'https://i.ytimg.com/vi/AbCdEf12345/hqdefault.jpg',
            width: 120,
            height: 90,
        });

        listeners.get('load')({ target: img });

        expect(img.src).toBe('/img/caratula.png');
        expect(img.dataset.defaultThumbnailFallback).toBe('applied');
    });

    it('no substitueix una miniatura de YouTube vàlida', () => {
        const { listeners } = bootPlayer();
        const original = 'https://i.ytimg.com/vi/AbCdEf12345/hqdefault.jpg';
        const img = makeVideoImage({ src: original, width: 480, height: 360 });

        listeners.get('load')({ target: img });

        expect(img.src).toBe(original);
        expect(img.dataset.defaultThumbnailFallback).toBeUndefined();
    });
});
