import { describe, it, expect, vi } from 'vitest';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

describe('arrencada lleugera', () => {
    it('la TV només observa el mode del body i no l’arbre de targetes', () => {
        const observers = [], frames = [];
        let active = false;
        const body = { classList: { contains: () => active } };
        const player = { classList: { contains: () => false } };
        const document = { body, readyState: 'complete', querySelector: () => null, getElementById: id => id === 'videoPlayer' ? player : null };
        class Observer { constructor(callback) { this.callback = callback; observers.push(this); } observe(target, options) { this.target = target; this.options = options; } }
        const window = { document, matchMedia: () => ({ matches: false, addEventListener() {} }), requestAnimationFrame: fn => { frames.push(fn); return frames.length; }, addEventListener() {}, get scrollY() { throw new Error('No cal mesurar scroll a la portada'); } };
        vm.runInNewContext(readFileSync('js/features/tv-scroll-ui.js', 'utf8'), { window, MutationObserver: Observer });
        while (frames.length) frames.shift()();
        const observer = observers.find(o => o.target === body);
        expect(observer.options.subtree).not.toBe(true);
        expect(observer.options.childList).not.toBe(true);
        for (let i = 0; i < 1000; i++) observer.callback();
        expect(frames).toHaveLength(0);
        active = true; observer.callback(); observer.callback();
        expect(frames).toHaveLength(1);
    });

    it('el refresc d’icones respecta el contenidor i no recrea SVG anteriors', () => {
        const pending = [{ tagName: 'I' }], createIcons = vi.fn();
        const scope = { querySelectorAll: vi.fn(() => pending) };
        const ctx = { lucide: { createIcons }, document: {}, window: {} };
        vm.runInNewContext(readFileSync('js/utils/helpers.js', 'utf8'), ctx);
        ctx.refreshIcons(scope);
        expect(scope.querySelectorAll).toHaveBeenCalledWith('i[data-lucide]');
        const root = createIcons.mock.calls[0][0].root;
        expect(root.querySelectorAll('[data-lucide]')).toEqual(pending);
        expect(root.querySelectorAll('[icon-name]')).toEqual([]);
        ctx.refreshIcons({ querySelectorAll: () => [] });
        expect(createIcons).toHaveBeenCalledTimes(1);
    });

    it('cedeix el fil durant un catàleg llarg, conservant ordre i resultats', async () => {
        const yieldFn = vi.fn(async () => {});
        const ctx = { window: { scheduler: { yield: yieldFn } }, console, setTimeout };
        vm.runInNewContext(readFileSync('js/youtube.js', 'utf8'), ctx);
        const values = Array.from({ length: 125 }, (_, i) => i);
        expect(await ctx.mapMusicBatch(values, n => n * 2)).toEqual(values.map(n => n * 2));
        expect(yieldFn).toHaveBeenCalledTimes(3);
    });

    it('el QR es carrega una vegada quan es demana, amb reintent després d’un error', async () => {
        const scripts = [];
        const window = { document: { createElement: () => ({ remove: vi.fn() }), head: { appendChild: script => scripts.push(script) } }, appDataUrl: file => '/musica/' + file };
        vm.runInNewContext(readFileSync('js/utils/share-card.js', 'utf8'), { window, console });
        const card = window.SegueixApp.utils.shareCard;
        expect(scripts).toHaveLength(0);
        const first = card.ensureQrLibrary();
        expect(card.ensureQrLibrary()).toBe(first);
        expect(scripts[0].src).toBe('/musica/js/vendor/qr-code-styling.js');
        scripts[0].onerror(); await expect(first).rejects.toThrow();
        const next = card.ensureQrLibrary();
        window.QRCodeStyling = function () {};
        scripts[1].onload(); await next;
        await card.ensureQrLibrary();
        expect(scripts).toHaveLength(2);
    });
});
