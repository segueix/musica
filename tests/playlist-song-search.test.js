import { describe, it, expect, vi } from 'vitest';
import { loadScript } from './setup.js';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const api = () => loadScript('js/features/library.js').SegueixApp.features.library;
describe('cerca de cançons dins les llistes', () => {
    it('cerca per artista i títol sense accents, deduplica i exclou altres continguts', () => {
        const videos = [
            { id: 'a', title: 'La força', channelTitle: 'Anna Andreu', contentType: 'song' },
            { id: 'a', title: 'La força', channelTitle: 'Anna Andreu' },
            { id: 'b', title: 'La força', channelTitle: 'Anna Andreu', isShort: true },
            { id: 'c', title: 'La força', channelTitle: 'Anna Andreu', contentType: 'interview' },
            { id: 'd', title: 'La força en directe', channelTitle: 'Anna Andreu', contentType: 'live_song' },
        ];
        expect(api().searchSongs(videos, 'anna forca').map(v => v.id)).toEqual(['a', 'd']);
        expect(api().searchSongs(videos, '   ')).toEqual([]);
        expect(api().searchSongs(videos, 'inexistent')).toEqual([]);
    });
    it('no recarrega automàticament mentre hi ha vídeo flotant visible', () => {
        const source = readFileSync('js/app.js', 'utf8');
        const start = source.indexOf('function canAutoApplyAppUpdate(');
        const fn = source.slice(start, source.indexOf('\n}\n', start) + 3);
        const ctx = { document: { visibilityState: 'hidden' }, isVideoPipOpen: vi.fn(() => true) };
        runInNewContext(fn, ctx);
        expect(ctx.canAutoApplyAppUpdate()).toBe(false);
        ctx.isVideoPipOpen.mockReturnValue(false);
        expect(ctx.canAutoApplyAppUpdate()).toBe(true);
        ctx.document.visibilityState = 'visible';
        expect(ctx.canAutoApplyAppUpdate()).toBe(false);
    });
});

function element() {
    return { children: [], listeners: {}, value: '', textContent: '', disabled: false,
        append(...nodes) { this.children.push(...nodes); },
        replaceChildren() { this.children = []; },
        setAttribute() {}, focus() {},
        addEventListener(event, handler) { this.listeners[event] = handler; },
    };
}
it('ajout persistent, indicació de duplicat i resposta tardana cancel·lada', async () => {
    const input = element(), status = element(), results = element();
    const body = { innerHTML: '', querySelector: selector => selector === 'input' ? input : selector === '[role="status"]' ? status : results };
    const ctx = loadScript('js/features/library.js', { document: { createElement: element } });
    const library = ctx.SegueixApp.features.library;
    const list = { videos: [] };
    let resolveHistory;
    const add = vi.fn(video => list.videos.push(video));
    library.openSongPicker({ body, getList: () => list, initialVideos: [{ id: 'a', title: 'La força', channelTitle: 'Anna' }], loadVideos: () => new Promise(resolve => { resolveHistory = resolve; }), add });
    input.value = 'anna'; input.listeners.input();
    const button = results.children[0].children[1];
    button.listeners.click();
    expect(list.videos.map(v => v.id)).toEqual(['a']);
    expect(button.disabled).toBe(true);
    input.listeners.input();
    expect(results.children[0].children[1].disabled).toBe(true);
    await Promise.resolve();
    library.cancelSongPicker();
    status.textContent = 'Un altre modal';
    resolveHistory([{ id: 'b', title: 'Anna' }]);
    await Promise.resolve(); await Promise.resolve();
    expect(status.textContent).toBe('Un altre modal');
});
