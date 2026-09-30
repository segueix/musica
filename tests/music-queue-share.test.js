import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadScript } from './setup.js';

// Compartir una ràdio o la llista que sona: dades que es comparteixen i botó a la capçalera.

const ids = Array.from({ length: 45 }, (_, i) => `abcdefghi${String(i).padStart(2, '0')}`);
const queue = ids.map(id => ({ id, title: `Cançó ${id}`, channelTitle: 'Artista' }));

// escapeText() fa servir un element per escapar el text: n'hi ha prou amb aquest doble
const fakeElement = () => ({
    _text: '',
    set textContent(value) {
        this._text = String(value ?? '');
    },
    get innerHTML() {
        return this._text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
});

const load = (extra = {}, library = null) => {
    const ctx = loadScript('js/features/music-queue.js', {
        SegueixApp: { features: library ? { library } : {}, state: {}, utils: {} },
        isPlaylistMode: true,
        activePlaylistQueue: queue,
        currentPlaylistIndex: 3,
        activePlaylistId: '__music_queue__',
        activePlaylistName: 'Ràdio',
        SegueixMusicCategories: { CATEGORY_GROUPS: [{ label: 'Pop' }, { label: 'Rock' }] },
        ...extra,
        document: { readyState: 'loading', addEventListener() {}, createElement: () => fakeElement() },
    });
    return (ctx.SegueixApp || ctx.window?.SegueixApp).features.musicQueue;
};

const render = mq => {
    const container = {
        innerHTML: '',
        querySelector: () => null,
        addEventListener() {},
    };
    mq.render(container);
    return container.innerHTML;
};

describe('què es comparteix', () => {
    it('una ràdio comparteix la cua des de la cançó que sona, amb el nom «La teva ràdio»', () => {
        const share = load().getShareData();
        expect(share.type).toBe('radio');
        expect(share.name).toBe('La teva ràdio');
        expect(share.ids[0]).toBe(ids[3]);
        expect(share.ids).toHaveLength(ids.length - 3);
        expect(share.playlistId).toBe('');
    });

    it('una llista en reproducció es comparteix sencera i per ID', () => {
        const share = load({ activePlaylistId: 'pl_7', activePlaylistName: 'Música d’estiu' }).getShareData();
        expect(share.type).toBe('playlist');
        expect(share.name).toBe('Música d’estiu');
        expect(share.playlistId).toBe('pl_7');
        expect(share.ids).toHaveLength(ids.length);
    });

    it('ignora els IDs que no són de YouTube i no comparteix una cua buida ni la TV', () => {
        expect(
            load({ activePlaylistQueue: [{ id: 'curt' }, { id: ids[0] }], currentPlaylistIndex: 0 }).getShareData().ids
        ).toEqual([ids[0]]);
        expect(load({ isPlaylistMode: false }).getShareData()).toBeNull();
        expect(load({ activePlaylistQueue: [] }).getShareData()).toBeNull();
        expect(load({ activePlaylistId: '__segueix_tv_discovery__' }).getShareData()).toBeNull();
    });
});

describe('botó de compartir a la capçalera', () => {
    it('la ràdio té el botó de compartir, junt amb el «+» i el desar, dins el mateix grup', () => {
        const html = render(load());
        expect(html).toContain('data-mq-share');
        expect(html).toContain('aria-label="Comparteix aquesta ràdio"');
        const tools = html.match(/<span class="mq-tools">([\s\S]*?)<\/span><\/span>/);
        expect(tools).not.toBeNull();
        expect(tools[1]).toContain('data-mq-add-style');
        expect(tools[1]).toContain('data-mq-save-list');
        expect(tools[1]).toContain('data-mq-share');
        expect(html).toContain('<h2 class="mq-heading">Ràdio</h2>');
    });

    it('una llista desada en reproducció es titula «Llista» i també es pot compartir', () => {
        const library = { getPlaylists: () => [{ id: 'pl_7', name: 'Música d’estiu', videos: queue }] };
        const html = render(load({ activePlaylistId: 'pl_7', activePlaylistName: 'Música d’estiu' }, library));
        expect(html).toContain('<h2 class="mq-heading">Llista</h2>');
        expect(html).toContain('aria-label="Comparteix aquesta llista"');
        expect(html).toContain('Música d’estiu');
    });

    it('una cua que no és una llista de la biblioteca no mostra el botó', () => {
        const html = render(
            load({ activePlaylistId: 'pl_fantasma', activePlaylistName: 'X' }, { getPlaylists: () => [] })
        );
        expect(html).not.toContain('data-mq-share');
        expect(html).toContain('<span class="mq-source">X</span>');
    });

    it('el clic només delega a shareSegueixRadio (no comparteix res per compte propi)', () => {
        const source = readFileSync(new URL('../js/features/music-queue.js', import.meta.url), 'utf8');
        expect(source).toContain("if (event.target.closest('[data-mq-share]'))");
        expect(source).toContain("shareSegueixRadio === 'function'");
    });
});

describe('capçalera de la ràdio ben alineada (CSS)', () => {
    const css = readFileSync(new URL('../css/portada.css', import.meta.url), 'utf8');

    it('el títol i els botons s’alineen a la primera fila (no centrats respecte a un nom de dues files)', () => {
        expect(css).toMatch(/\.mq-head \{\s*align-items: flex-start;/);
        expect(css).toMatch(/\.mq-heading \{\s*margin: 0;\s*line-height: 44px;/);
    });

    it('el panell mesura el seu propi ample: amb poc espai el nom passa sencer a la fila de sota', () => {
        expect(css).toMatch(/\.mq \{\s*container: mq \/ inline-size;/);
        expect(css).toMatch(/@container mq \(max-width: 639px\)[\s\S]*?\.mq-source \{\s*order: 3;\s*flex: 1 0 100%;/);
    });

    it('els símbols (afegir, desar, compartir) fan 44 px i no se separen', () => {
        expect(css).toMatch(/\.mq-tools \{\s*display: inline-flex;\s*flex: none;/);
        expect(css).toMatch(/\.mq-add-style,\s*\.mq-save-list,\s*\.mq-share \{[^}]*width: 44px;[^}]*height: 44px;/);
    });
});
