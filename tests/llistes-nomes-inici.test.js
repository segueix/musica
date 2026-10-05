import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadScript } from './setup.js';

// «Les teves llistes» (#homePlaylists) només és a Inici: no surt a baix dels estils, les categories ni la cerca.

function fakeContainer() {
    const classes = new Set(['hidden']);
    return {
        innerHTML: '',
        classList: {
            add: name => classes.add(name),
            remove: name => classes.delete(name),
            contains: name => classes.has(name),
        },
        addEventListener() {},
        querySelector: () => null,
    };
}

function load(selectedCategory) {
    const container = fakeContainer();
    const ctx = loadScript('js/features/home-playlists.js', {
        SegueixApp: { features: { library: { getPlaylists: () => [{ id: 'a', name: 'Estiu', videos: [] }] } } },
        selectedCategory,
        document: {
            readyState: 'loading',
            addEventListener() {},
            getElementById: id => (id === 'homePlaylists' ? container : null),
            // escapeText() fa servir un element per escapar el text
            createElement: () => ({
                set textContent(value) {
                    this.innerHTML = String(value ?? '');
                },
            }),
        },
    });
    ctx.SegueixApp.features.homePlaylists.render();
    return container;
}

describe('«Les teves llistes» només a Inici', () => {
    it('a Inici es mostra', () => {
        const container = load('Novetats');
        expect(container.classList.contains('hidden')).toBe(false);
        expect(container.innerHTML).toContain('Les teves llistes');
    });

    it.each(['Pop', 'Rock', 'Seguint', null])('a «%s» no hi és', category => {
        const container = load(category);
        expect(container.classList.contains('hidden')).toBe(true);
        expect(container.innerHTML).toBe('');
    });

    it('el CSS tampoc no la mostra fora de la portada mentre es canvia de vista', () => {
        const css = readFileSync('css/portada.css', 'utf8');
        expect(css).toMatch(/#homePage:not\(\.is-portada\) > \.home-playlists \{\s+display: none;/);
    });
});
