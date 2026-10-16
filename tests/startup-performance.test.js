import { describe, it, expect, vi } from 'vitest';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function lazyDiscovery() {
    const scripts = [];
    const container = () => {
        const classes = new Set(['hidden']);
        return { children: [], textContent: '', classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) }, appendChild(child) { this.children.push(child); } };
    };
    const window = { SegueixApp: { features: {} }, appDataUrl: p => '/musica/' + p, document: {
        createElement: () => ({ remove: vi.fn(), addEventListener: vi.fn() }), head: { appendChild: script => scripts.push(script) },
    } };
    vm.runInNewContext(readFileSync('js/features/discover-loader.js', 'utf8'), { window });
    return { window, scripts, container };
}

describe('Descobreix sota demanda', () => {
    it.each(['artistMap', 'affinity'])('no baixa %s a Inici, deduplica show i respecta la navegació durant la baixada', async name => {
        const { window, scripts, container } = lazyDiscovery();
        const proxy = window.SegueixApp.features[name], target = container();
        proxy.hide(target);
        expect(scripts).toHaveLength(0);
        const first = proxy.show(target), second = proxy.show(target);
        expect(scripts).toHaveLength(1);
        expect(scripts[0].src).toMatch(/^\/musica\/js\/features\//);
        proxy.hide(target);
        const real = { show: vi.fn() };
        window.SegueixApp.features[name] = real;
        scripts[0].onload();
        await Promise.all([first, second]);
        expect(real.show).not.toHaveBeenCalled();
        expect(target.classList.contains('hidden')).toBe(true);
    });
    it('recupera un error de xarxa i mostra la vista una sola vegada amb el retorn pendent', async () => {
        const { window, scripts, container } = lazyDiscovery();
        const proxy = window.SegueixApp.features.artistMap, target = container();
        const failed = proxy.show(target);
        scripts[0].onerror();
        await failed;
        expect(target.textContent).toContain('No s’ha pogut');
        expect(target.children[0].textContent).toBe('Torna-ho a provar');
        proxy.restoreReturn();
        const first = proxy.show(target), second = proxy.show(target);
        expect(scripts).toHaveLength(2);
        const real = { show: vi.fn(), restoreReturn: vi.fn() };
        window.SegueixApp.features.artistMap = real;
        scripts[1].onload();
        await Promise.all([first, second]);
        expect(real.show).toHaveBeenCalledTimes(1);
        expect(real.restoreReturn).toHaveBeenCalledTimes(1);
    });
});

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

// L’avís inicial no depèn dels scripts grans ni de la resposta del feed.
const earlyNotice = readFileSync('index.html', 'utf8').match(/<script id="earlyCookieNotice">([\s\S]*?)<\/script>/)[1];
function earlyConsent(raw, blocked = false) {
    const classes = new Set(['hidden']);
    const handlers = new Map();
    const banner = {
        classList: { remove: key => classes.delete(key) },
        addEventListener: (key, fn) => handlers.set(key, fn),
        removeEventListener: key => handlers.delete(key),
    };
    let ready;
    vm.runInNewContext(earlyNotice, {
        document: { getElementById: () => banner },
        localStorage: { getItem: () => { if (blocked) throw Error('blocked'); return raw; } },
        window: { addEventListener: (_key, fn) => { ready = fn; } },
    });
    return { classes, handlers, ready: () => ready() };
}

describe('consentiment abans del catàleg', () => {
    it.each([null, '{malformat', JSON.stringify({ status: 'unknown' })])('mostra l’avís sense un consentiment vàlid: %s', raw => {
        expect(earlyConsent(raw).classes.has('hidden')).toBe(false);
    });
    it.each(['accepted', 'rejected', '"accepted"', '{"version":1,"status":"rejected","updatedAt":"2026-10-16"}'])('respecta la decisió anterior: %s', raw => {
        expect(earlyConsent(raw).classes.has('hidden')).toBe(true);
    });
    it('mostra l’avís quan localStorage no és accessible', () => {
        expect(earlyConsent(null, true).classes.has('hidden')).toBe(false);
    });
    it('conserva l’últim toc fins que el controlador estigui preparat i retira la captura', () => {
        const state = earlyConsent(null);
        const first = { click: vi.fn() }, last = { click: vi.fn() };
        for (const button of [first, last]) state.handlers.get('click')({ target: { closest: () => button }, stopImmediatePropagation() {} });
        expect(last.click).not.toHaveBeenCalled();
        state.ready();
        expect(first.click).not.toHaveBeenCalled();
        expect(last.click).toHaveBeenCalledOnce();
        expect(state.handlers.has('click')).toBe(false);
    });
    it('no injecta el complement antic de Shorts encara que en quedi HTML ocult', () => {
        const fetch = vi.fn(), addEventListener = vi.fn();
        const appendChild = vi.fn();
        const document = { readyState: 'complete', getElementById: id => id === 'short-iframe' ? {} : null, createElement: vi.fn(() => ({})), head: { appendChild } };
        const window = { document, SegueixApp: { features: {} }, fetch, addEventListener };
        vm.runInNewContext(readFileSync('js/core/segueix-app.js', 'utf8'), { window });
        expect(appendChild).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
        expect(addEventListener).not.toHaveBeenCalled();
    });
});

describe('feed anticipat i fresc', () => {
    it.each([false, true])('reutilitza la resposta una sola vegada i recupera una fallada inicial: %s', async failed => {
        const response = { ok: true, json: async () => ({ videos: [], channels: {} }) };
        const fetch = vi.fn().mockImplementationOnce(() => failed ? Promise.reject(Error('offline')) : Promise.resolve(response))
            .mockResolvedValue(response);
        const window = { appDataUrl: file => '/musica/' + file };
        const ctx = { window, fetch, console, setTimeout };
        const early = readFileSync('index.html', 'utf8').match(/<script id="earlyMusicFeed">([\s\S]*?)<\/script>/)[1];
        vm.runInNewContext(early, ctx);
        expect(fetch).toHaveBeenCalledWith('data/feed.json', { cache: 'no-store', priority: 'low' });
        vm.runInNewContext(readFileSync('js/youtube.js', 'utf8') + '\nthis.api = YouTubeAPI;', ctx);
        ctx.api.loadHiddenVideos = async () => {};
        ctx.api.restoreFeedSnapshot = () => false;
        ctx.api.applyFeedPayload = vi.fn(() => true);
        await ctx.api.loadFeed();
        expect(ctx.api.applyFeedPayload).toHaveBeenCalledOnce();
        expect(fetch).toHaveBeenCalledTimes(failed ? 2 : 1);
        expect(window).not.toHaveProperty('__segueixInitialFeed');
        await ctx.api.loadFeed();
        expect(fetch).toHaveBeenLastCalledWith('/musica/data/feed.json', { cache: 'no-store' });
        expect(fetch).toHaveBeenCalledTimes(failed ? 3 : 2);
    });
});
