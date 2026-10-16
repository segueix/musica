import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadScript } from './setup.js';

const feature = loadScript('js/features/affinity.js', {
    SegueixApp: { features: {}, utils: {}, state: {} },
}).SegueixApp.features.affinity;
const html = readFileSync('index.html', 'utf8');
const app = readFileSync('js/app.js', 'utf8');
const css = readFileSync('css/portada.css', 'utf8');

const artist = (id, name, styles, year, extra = {}) => ({
    id,
    name,
    avatar: `${id}.jpg`,
    channelIds: [id],
    styles,
    primary: styles[0],
    genres: [],
    year,
    views: 100,
    ...extra,
});
const artists = [
    artist('catarres', 'Els Catarres', ['Pop', 'Folk i arrel'], 2011),
    artist('txarango', 'Txarango', ['Pop', 'Folk i arrel'], 2012, { views: 900 }),
    artist('lax', "Lax'n'Busto", ['Pop', 'Rock'], 1992),
    artist('sopa', 'Sopa de Cabra', ['Rock'], 1988),
    artist('brams', 'Brams', ['Rock'], 1990),
    artist('rap', 'Pirat’s Sound Sistema', ['Rap / Hip-hop'], 2008),
    artist('amagat', 'Amagat', ['Pop', 'Folk i arrel'], 2012, { views: 99999 }),
];

describe('Per afinitat: «Si t’agrada X, prova Y»', () => {
    it('proposa artistes que no coneixes, del mateix estil i època, amb el perquè', () => {
        const model = feature.buildModel({
            artists,
            taste: { history: [{ channelId: 'catarres' }, { channelId: 'catarres' }], liked: [], followedIds: [] },
            hiddenIds: ['amagat'],
        });
        expect(model.hasTaste).toBe(true);
        const first = model.cards[0];
        expect(first.seed.name).toBe('Els Catarres');
        expect(first.artist.name).toBe('Txarango'); // mateix estil principal i mateixa època
        expect(first.reason).toBe('Perquè escoltes Els Catarres');
        expect(first.style).toBe('Pop');
        expect(first.era).toBe('Dels 10');
        // No proposa l'artista que ja escolta, ni un amagat, ni un d'un altre estil
        const names = model.cards.map(card => card.artist.name);
        expect(names).not.toContain('Els Catarres');
        expect(names).not.toContain('Amagat');
        expect(names).not.toContain('Pirat’s Sound Sistema');
    });

    it('la frase diu si el segueixes o t’agrada, i no repeteix propostes', () => {
        const model = feature.buildModel({
            artists,
            taste: { history: [], liked: [{ channelId: 'lax' }], followedIds: ['sopa'] },
        });
        expect(model.cards.find(card => card.seed.name === 'Sopa de Cabra').reason).toBe(
            'Perquè segueixes Sopa de Cabra'
        );
        expect(model.cards.find(card => card.seed.name === "Lax'n'Busto").reason).toBe("Perquè t’agrada Lax'n'Busto");
        const ids = model.cards.map(card => card.artist.id);
        expect(new Set(ids).size).toBe(ids.length);
        // Sopa de Cabra (Rock, 1988) → Brams (Rock, 1990) abans que un grup de Pop actual
        expect(model.cards.find(card => card.seed.name === 'Sopa de Cabra').artist.name).toBe('Brams');
    });

    it('sense historial, m’agrades ni seguits mostra els estils', () => {
        const model = feature.buildModel({ artists, taste: {} });
        expect(model).toEqual({ hasTaste: false, cards: [] });
        const out = feature.html(model, {
            styles: [
                { name: 'Pop', count: 3 },
                { name: 'Rock', count: 2 },
            ],
        });
        expect(out).toContain('Per afinitat');
        expect(out).toContain('data-af-style="Pop"');
        expect(out).toContain('tria un estil');
    });

    it('l’any de cada artista és el dels seus primers temes (any original si se sap)', () => {
        const groups = new Map([
            ['a', 'A'],
            ['b', 'B'],
        ]);
        const years = feature.artistYears(
            [
                { channelId: 'a', originalYear: 1995, publishedAt: '2020-01-01' },
                { channelId: 'a', publishedAt: '2021-05-01' },
                { channelId: 'a', publishedAt: '2022-05-01' },
                { channelId: 'b', publishedAt: '2024-05-01' },
            ],
            groups
        );
        expect(years.get('A')).toEqual({ year: 1995, sure: true });
        expect(years.get('B')).toEqual({ year: 2024, sure: true });
        // Només pujades antigues sense any original: serveix per comparar, però no es mostra l'època
        const old = feature.artistYears([{ channelId: 'a', publishedAt: '2008-01-01' }], groups);
        expect(old.get('A')).toEqual({ year: 2008, sure: false });
        const model = feature.buildModel({
            artists: [
                { id: 'x', name: 'X', channelIds: ['x'], styles: ['Rock'], primary: 'Rock', genres: [], year: 2008 },
                {
                    id: 'y',
                    name: 'Y',
                    channelIds: ['y'],
                    styles: ['Rock'],
                    primary: 'Rock',
                    genres: [],
                    year: 2009,
                    yearSure: false,
                },
            ],
            taste: { history: [{ channelId: 'x' }] },
        });
        expect(model.cards[0].era).toBe('');
        expect(feature.decadeLabel(1995)).toBe('Dels 90');
        expect(feature.decadeLabel(2024)).toBe('D’ara');
    });

    it('pinta les targetes escapant els noms', () => {
        const model = feature.buildModel({
            artists: [artist('x', '<b>X</b>', ['Pop'], 2010), artist('y', 'Y & Co', ['Pop'], 2011)],
            taste: { history: [{ channelId: 'x' }] },
        });
        const out = feature.html(model);
        expect(out).toContain('Si t’agrada <strong>&lt;b&gt;X&lt;/b&gt;</strong>, prova');
        expect(out).toContain('Y &amp; Co');
        expect(out).toContain('data-af-play="y"');
    });

    it('la foto del grup omple el fons de la targeta, amb el marc blanc (com «Artistes i grups»)', () => {
        const model = feature.buildModel({
            artists: [
                artist('x', 'X', ['Pop'], 2010),
                { ...artist('y', 'Y', ['Pop'], 2011), avatar: 'http://yt3.ggpht.com/abc=s88-c-k-c0x00ffffff-no-rj' },
            ],
            taste: { history: [{ channelId: 'x' }] },
        });
        const out = feature.html(model);
        expect(out).toContain('class="af-card__photo" src="https://yt3.ggpht.com/abc=s400-c-k-c0x00ffffff-no-rj"');
        expect(out.indexOf('af-card__photo')).toBeLessThan(out.indexOf('af-card__main'));
        expect(out).not.toContain('af-card__avatar');
        const card = css.slice(css.indexOf('.af-card {'), css.indexOf('.af-card__main {'));
        expect(card).toMatch(/border: 2px solid #fff;/);
        expect(card).toMatch(/\.af-card__photo \{[^}]*position: absolute;[^}]*inset: 0;[^}]*object-fit: cover;/);
    });

    it('al mòbil la filera queda dins dels marges: #homePage (contain: content) no talla el marc de la primera', () => {
        const mobile = css.slice(
            css.indexOf('/* Mòbil: una filera amb scroll lateral, com els artistes de les categories')
        );
        const list = mobile.slice(mobile.indexOf('.af-list {'), mobile.indexOf('}', mobile.indexOf('.af-list {')));
        expect(list).toMatch(/margin: 0;/);
        expect(list).not.toMatch(/-16px/);
        expect(list).toMatch(/scroll-padding-inline: 0;/);
    });

    it('substitueix la cançó destacada i «Recomanat per a tu» a Descobreix', () => {
        expect(html.indexOf('id="affinitySection"')).toBeLessThan(html.indexOf('id="artistMap"'));
        expect(html.indexOf('js/features/affinity.js')).toBeLessThan(html.indexOf('js/app.js'));
        expect(app).toContain('Descobreix no té cançó destacada');
        expect(app).toMatch(/title === 'Recomanat per a tu' && selectedCategory === 'Descobreix'/);
        expect(css).toContain('.af-card__why');
    });

    it('a Descobreix no hi ha cançons sota el mapa', () => {
        expect(app).toMatch(/homePage\?\.classList\.toggle\('is-discover', discover\)/);
        expect(app).toMatch(/function skipDiscoverGrid\(\)/);
        expect((app.match(/if \(skipDiscoverGrid\(\)\) return;/g) || []).length).toBe(2);
        expect(css).toMatch(/#homePage\.is-discover #videosGrid,[^{]*\{\s*display: none;/);
    });
});
