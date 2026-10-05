import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadScript } from './setup.js';

const feature = loadScript('js/features/category-artists.js', {
    SegueixApp: { features: {}, utils: {}, state: {} },
}).SegueixApp.features.categoryArtists;
const css = readFileSync('css/portada.css', 'utf8');
const html = readFileSync('index.html', 'utf8');
const app = readFileSync('js/app.js', 'utf8');

const groups = [
    { id: 'a', name: 'Zoo', avatar: 'zoo.jpg', categories: ['Rock', 'Pop'], channelIds: ['a', 'a2'] },
    { id: 'b', name: 'Els Amics', avatar: '', categories: ['Pop'], channelIds: ['b'] },
    { id: 'c', name: 'Brams', categories: ['Rock'], channelIds: ['c'] },
    { id: 'd', name: 'Amagat', categories: ['Rock'], channelIds: ['d'] },
    { id: 'e', name: 'Sense cançons', categories: ['Rock'], channelIds: ['e'] },
];
const videos = [
    { id: '1', channelId: 'a' },
    { id: '2', channelId: 'a2' },
    { id: '3', channelId: 'c' },
    { id: '4', channelId: 'c' },
    { id: '5', channelId: 'c' },
    { id: '6', channelId: 'c', isShort: true },
    { id: '7', channelId: 'd' },
    { id: '8', channelId: 'b' },
];

describe('artistes d’una categoria', () => {
    it('un estil agrupa els artistes que hi tenen la categoria, més cançons primer', () => {
        const model = feature.buildModel(groups, { category: 'rock', videos, hiddenIds: ['d'] });
        expect(model.artists.map(artist => artist.id)).toEqual(['c', 'a']);
        expect(model.total).toBe(2);
        expect(model.artists[1].count).toBe(2);
    });

    it('els artistes de l’estil com a categoria principal passen al davant', () => {
        const primaryOf = id => (id === 'a' ? 'Rock' : 'Pop');
        const model = feature.buildModel(groups, { category: 'Rock', videos, primaryOf });
        expect(model.artists[0].id).toBe('a');
    });

    it('un artista sense cap cançó (Short no compta) o amb tots els canals amagats no hi surt', () => {
        const model = feature.buildModel(groups, { category: 'Rock', videos, hiddenIds: ['a', 'a2'] });
        expect(model.artists.map(artist => artist.id)).toEqual(['c', 'd']);
    });

    it('una categoria pròpia usa els canals dels seus grups, també els del grup', () => {
        const model = feature.buildModel(groups, { category: 'Els meus', userChannelIds: ['a2', 'b'], videos });
        expect(model.artists.map(artist => artist.id)).toEqual(['a', 'b']);
    });

    it('sense llista de cançons no es filtra ni s’ordena per cançons', () => {
        const model = feature.buildModel(groups, { category: 'Pop' });
        expect(model.artists.map(artist => artist.name)).toEqual(['Els Amics', 'Zoo']);
    });

    it('l’HTML escapa els noms, usa la icona si no hi ha foto i amaga el botó fins que cal', () => {
        const model = feature.buildModel([{ id: 'x"', name: '<b>Els</b>', categories: ['Pop'], channelIds: ['x"'] }], {
            category: 'Pop',
        });
        const markup = feature.html(model);
        expect(markup).not.toContain('<b>');
        expect(markup).toContain('data-ca-artist="x&quot;"');
        expect(markup).toContain('img/icon-192.png');
        expect(markup).toMatch(/data-ca-toggle[^>]*hidden/);
        expect(feature.html({ artists: [], total: 0 })).toBe('');
    });

    it('el botó diu quants artistes hi ha i es plega', () => {
        const model = feature.buildModel(groups, { category: 'Rock', videos });
        expect(feature.html(model)).toContain('Mostra’ls tots (3)');
        expect(feature.html(model, { expanded: true })).toContain('Mostra’n menys');
    });
});

describe('artistes d’una categoria: integració', () => {
    it('la filera és entre el destacat i la graella, i el mòdul es carrega abans d’app.js', () => {
        expect(html.indexOf('id="heroSection"')).toBeLessThan(html.indexOf('id="categoryArtists"'));
        expect(html.indexOf('id="categoryArtists"')).toBeLessThan(html.indexOf('id="videosGrid"'));
        expect(html.indexOf('js/features/category-artists.js')).toBeLessThan(html.indexOf('js/app.js'));
        expect(readFileSync('sw.js', 'utf8')).toContain("'./js/features/category-artists.js'");
    });

    it('app.js la pinta després del destacat i l’amaga a la cerca i a les vistes buides', () => {
        expect(app).toMatch(/updateHero\(featured, 'api'\);\s+syncCategoryArtists\(\);/);
        expect(app.match(/categoryArtists\?\.hide\?\.\(\)/g)?.length).toBeGreaterThanOrEqual(2);
    });

    it('mòbil: una filera amb scroll lateral; ordinador: filera plegada que es desplega', () => {
        expect(css).toMatch(/\.ca__list \{[\s\S]*?overflow-x: auto;/);
        expect(css).toMatch(
            /@media \(min-width: 769px\) \{\s+\.ca__list \{[\s\S]*?flex-wrap: wrap;[\s\S]*?max-height: var\(--ca-row-h/
        );
        expect(css).toMatch(/\.ca__list\.is-expanded \{\s+max-height: none;/);
    });
});
