import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadScript } from './setup.js';

function element() {
    const classes = new Set();
    const listeners = new Map();
    return {
        dataset: {},
        style: { setProperty(name, value) { this[name] = value; } },
        clientHeight: 700,
        offsetWidth: 390,
        classList: {
            add: (...names) => names.forEach(name => classes.add(name)),
            remove: (...names) => names.forEach(name => classes.delete(name)),
            contains: name => classes.has(name),
        },
        addEventListener(name, callback) {
            if (!listeners.has(name)) listeners.set(name, new Set());
            listeners.get(name).add(callback);
        },
        removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
        emit(name, extra = {}) {
            for (const callback of [...(listeners.get(name) || [])]) callback({ type: name, target: this, ...extra });
        },
        getAttribute(name) { return this[name]; },
        setAttribute(name, value) { this[name] = value; },
        removeAttribute(name) { delete this[name]; },
        querySelector: () => null,
    };
}

function setup({ reducedMotion = false, playlist = false } = {}) {
    const elements = Object.fromEntries([
        'short-modal', 'shortPlayerWrap', 'shortGestureOverlay', 'shortStrip',
        'shortPosterPrev', 'shortPosterCurrent', 'shortPosterNext', 'short-iframe',
        'shortTitle', 'shortChannel', 'short-modal-close-btn',
    ].map(id => [id, element()]));
    elements['short-modal'].classList.add('hidden');
    const commands = [];
    elements['short-iframe'].contentWindow = { postMessage: value => commands.push(JSON.parse(value)) };
    let frameId = 0;
    const frames = new Map();
    const queue = ['a', 'b', 'c'].map(id => ({ id, isShort: true, title: id, thumbnail: id + '.jpg' }));
    const ctx = loadScript('js/features/shorts.js', {
        Date,
        setTimeout,
        clearTimeout,
        requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
        cancelAnimationFrame: id => frames.delete(id),
        matchMedia: () => ({ matches: reducedMotion }),
        addEventListener: vi.fn(),
        document: {
            getElementById: id => elements[id] || null,
            querySelector: () => null,
            body: { contains: () => true },
        },
        forcedShortsQueue: queue,
        currentShortsQueue: [],
        currentShortIndex: 0,
        currentPlaylistIndex: 0,
        activePlaylistQueue: [],
        isPlaylistMode: playlist,
        isNavigatingShort: false,
        shortScrollHintTimer: null,
        lockBodyScroll: vi.fn(),
        unlockBodyScroll: vi.fn(),
        addToHistory: vi.fn(),
        refreshIcons: vi.fn(),
        applyYouTubeIframePolicy: vi.fn(),
        buildYoutubeEmbedUrl: id => 'https://www.youtube.com/embed/' + id,
        getPreferredThumbnail: video => video.thumbnail,
        loadVideoInSequence: vi.fn(),
    });
    const api = ctx.SegueixApp.features.shorts;
    api.openShortModal('a');
    elements['short-iframe'].emit('load');
    commands.length = 0;
    const overlay = elements.shortGestureOverlay;
    const touch = (y, x = 190, identifier = 1) => ({ clientY: y, clientX: x, identifier });
    const start = (y = 550, x = 190) => overlay.emit('touchstart', { touches: [touch(y, x)] });
    const move = (y, x = 190) => overlay.emit('touchmove', { touches: [touch(y, x)] });
    const end = (y, x = 190) => overlay.emit('touchend', { changedTouches: [touch(y, x)], touches: [] });
    const finish = () => elements.shortStrip.emit('transitionend', { propertyName: 'transform' });
    const flushFrame = () => {
        const batch = [...frames.values()];
        frames.clear();
        batch.forEach(callback => callback());
    };
    return { ctx, api, elements, commands, frames, start, move, end, finish, flushFrame, touch };
}

describe('Desplaçament tàctil dels Shorts', () => {
    beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(10000); });
    afterEach(() => vi.useRealTimers());

    it('agrupa touchmove en un frame i pinta només la darrera posició', () => {
        const h = setup();
        h.start();
        h.move(510);
        h.move(480);
        h.move(450);
        expect(h.frames.size).toBe(1);
        h.flushFrame();
        expect(h.elements.shortStrip.style.transform).toBe('translate3d(0, -100px, 0)');
    });

    it('inicia el vídeo dins del gest i el frame pendent no sobreescriu l’aterratge', () => {
        const h = setup();
        h.start();
        vi.advanceTimersByTime(80);
        h.move(400);
        h.end(400);
        expect(h.commands.some(command => command.func === 'loadVideoById' && command.args[0] === 'b')).toBe(true);
        expect(h.frames.size).toBe(0);
        h.flushFrame();
        expect(h.elements.shortStrip.style.transform).toBe('translate3d(0, -100%, 0)');
        h.finish();
        expect(h.ctx.currentShortIndex).toBe(1);
        h.api.navigateShort(1);
        expect(h.ctx.isNavigatingShort).toBe(true);
        h.finish();
        expect(h.ctx.currentShortIndex).toBe(2);
    });

    it('detecta un impuls ràpid al final d’un gest llarg', () => {
        const h = setup();
        h.start();
        vi.advanceTimersByTime(500);
        h.move(545);
        vi.advanceTimersByTime(30);
        h.move(500);
        h.end(500);
        h.finish();
        expect(h.ctx.currentShortIndex).toBe(1);
    });

    it('no confon un arrossegament lent i curt amb un impuls', () => {
        const h = setup();
        h.start();
        vi.advanceTimersByTime(500);
        h.move(500);
        vi.advanceTimersByTime(200);
        h.end(500);
        h.finish();
        expect(h.ctx.currentShortIndex).toBe(0);
        expect(h.commands).toHaveLength(0);
    });

    it('anima també els gestos ràpids que no tenen cap touchmove', () => {
        const h = setup();
        h.start();
        h.end(450);
        expect(h.ctx.isNavigatingShort).toBe(true);
        h.finish();
        expect(h.ctx.currentShortIndex).toBe(1);
    });

    it('ignora els gestos horitzontals encara que no hi hagi touchmove', () => {
        const h = setup();
        h.start();
        h.end(450, 350);
        h.finish();
        expect(h.ctx.currentShortIndex).toBe(0);
        expect(h.commands).toHaveLength(0);
    });

    it('manté la resistència al primer Short i limita el panell a una pantalla', () => {
        const h = setup();
        h.start();
        h.move(750);
        h.flushFrame();
        expect(parseFloat(h.elements.shortStrip.style.transform.split(',')[1])).toBeCloseTo(56);
        h.end(750);
        h.finish();
        expect(h.ctx.currentShortIndex).toBe(0);
        h.start();
        h.move(-1200);
        h.flushFrame();
        expect(h.elements.shortStrip.style.transform).toBe('translate3d(0, -700px, 0)');
    });

    it('cancel·la un gest sense navegar ni pausar', () => {
        const h = setup();
        h.start();
        h.move(400);
        h.elements.shortGestureOverlay.emit('touchcancel');
        expect(h.frames.size).toBe(0);
        h.finish();
        h.end(400);
        expect(h.ctx.currentShortIndex).toBe(0);
        expect(h.commands).toHaveLength(0);
    });

    it('un segon dit durant l’aterratge no cancel·la la navegació', () => {
        const h = setup();
        h.start();
        h.move(400);
        h.end(400);
        h.elements.shortGestureOverlay.emit('touchstart', { touches: [h.touch(400), h.touch(410, 200, 2)] });
        h.finish();
        expect(h.ctx.currentShortIndex).toBe(1);
        expect(h.ctx.isNavigatingShort).toBe(false);
    });

    it('un toc pausa una sola vegada encara que Android emeti ratolí', () => {
        const h = setup();
        h.start();
        h.end(550);
        h.elements.shortGestureOverlay.emit('mousedown', { clientY: 550, clientX: 190 });
        h.elements.shortGestureOverlay.emit('mouseup', { clientY: 550, clientX: 190 });
        expect(h.commands.filter(command => command.func === 'pauseVideo')).toHaveLength(1);
    });

    it('tancar i reobrir anul·la callbacks i frames de la sessió anterior', () => {
        const h = setup();
        h.api.navigateShort(1);
        h.api.closeShortModal();
        h.ctx.forcedShortsQueue = [{ id: 'x', isShort: true, title: 'x' }];
        h.api.openShortModal('x');
        vi.advanceTimersByTime(1500);
        h.finish();
        expect(h.ctx.currentShortIndex).toBe(0);
        expect(h.elements.shortTitle.textContent).toBe('x');
        expect(h.ctx.isNavigatingShort).toBe(false);
    });

    it('respecta moviment reduït sense esperar la durada normal', () => {
        const h = setup({ reducedMotion: true });
        h.api.navigateShort(1);
        vi.advanceTimersByTime(51);
        expect(h.ctx.currentShortIndex).toBe(1);
        expect(h.ctx.isNavigatingShort).toBe(false);
    });

    it('continua una llista mixta al reproductor normal', () => {
        const h = setup({ playlist: true });
        h.ctx.currentShortsQueue[1].isShort = false;
        h.api.navigateShort(1);
        expect(h.ctx.currentPlaylistIndex).toBe(1);
        expect(h.elements['short-modal'].classList.contains('hidden')).toBe(true);
        expect(h.ctx.loadVideoInSequence).toHaveBeenCalledOnce();
    });
});
