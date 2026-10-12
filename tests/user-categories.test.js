import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import { loadScript } from './setup.js';

function createMockLocalStorage() {
    const store = new Map();
    return {
        getItem: key => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: key => store.delete(key),
        clear: () => store.clear(),
    };
}

let storage;
let uc;

beforeEach(() => {
    storage = createMockLocalStorage();
    uc = loadScript('js/features/user-categories.js', {
        SegueixApp: { features: {}, state: {}, utils: {} },
        localStorage: storage,
    }).SegueixApp.features.userCategories;
});

describe('les teves categories: dades', () => {
    it('les rajoles compten artistes únics sense modificar els canals desats', () => {
        const api = loadScript('js/features/user-categories.js', {
            SegueixMusicCategories: {
                artistKeyForChannel: id => ['UC1', 'UCtopic'].includes(id) ? 'artist:one' : '',
            },
        }).SegueixApp.features.userCategories;
        const list = [{ id: 'a', name: 'Favorits', artists: ['UCtopic', 'UC1', 'UC2'] }];
        const tiles = api.tilesFor(list, { channels: [
            { id: 'UCtopic' }, { id: 'UC1', avatar: 'one.jpg' }, { id: 'UC2', avatar: 'two.jpg' },
        ] });
        expect(tiles[0].artists).toBe(2);
        expect(tiles[0].avatars).toEqual(['one.jpg', 'two.jpg']);
        expect(list[0].artists).toHaveLength(3);
    });

    it('crea una categoria amb el nom net i rebutja noms buits, repetits o d’estils', () => {
        const first = uc.addCategory([], '  Festa   «major» ', { reserved: ['Pop'], id: 'a' });
        expect(first.error).toBe('');
        expect(first.category).toEqual({ id: 'a', name: 'Festa major', artists: [] });
        expect(uc.addCategory(first.list, '   ').error).toMatch(/Escriu un nom/);
        expect(uc.addCategory(first.list, 'festa MAJOR').error).toMatch(/Ja tens una categoria/);
        expect(uc.addCategory(first.list, 'pop', { reserved: ['Pop'] }).error).toMatch(/ja és un estil/);
        expect(uc.addCategory(first.list, 'Novetats').error).toMatch(/ja és un estil/);
        expect(uc.addCategory([], 'x'.repeat(80)).category.name).toHaveLength(uc.MAX_NAME);
    });

    it('afegeix i treu grups i sap a quines categories és cada grup', () => {
        let list = uc.addCategory([], 'Per córrer', { id: 'a' }).list;
        list = uc.addCategory(list, 'Festa', { id: 'b' }).list;
        let result = uc.toggleArtist(list, 'a', 'UC1');
        expect(result.added).toBe(true);
        result = uc.toggleArtist(result.list, 'b', 'UC1');
        expect(uc.categoriesOfArtist(result.list, 'UC1').map(item => item.id)).toEqual(['a', 'b']);
        result = uc.toggleArtist(result.list, 'a', 'UC1');
        expect(result.added).toBe(false);
        expect(uc.categoriesOfArtist(result.list, 'UC1').map(item => item.id)).toEqual(['b']);
        expect(uc.removeCategory(result.list, 'b').map(item => item.id)).toEqual(['a']);
    });

    it('neteja dades desades malmeses', () => {
        expect(
            uc.sanitize([
                { id: 'a', name: 'Rock català', artists: ['UC1', 'UC1', '', null] },
                { id: 'b', name: 'rock CATALÀ', artists: [] },
                { id: '', name: 'Sense id' },
                null,
                'text',
            ])
        ).toEqual([{ id: 'a', name: 'Rock català', artists: ['UC1'] }]);
    });

    it('importa una categoria compartida sense duplicar-la i amb un nom lliure', () => {
        const mine = [{ id: 'a', name: 'Festa', artists: ['UC1', 'UC2'] }];
        expect(uc.importCategory(mine, { name: 'Festa', artists: ['UC2', 'UC1'] }).status).toBe('exists');
        const other = uc.importCategory(mine, { name: 'Festa', artists: ['UC3'] }, { id: 'b' });
        expect(other.status).toBe('added');
        expect(other.category).toEqual({ id: 'b', name: 'Festa (2)', artists: ['UC3'] });
        expect(uc.importCategory([], { name: 'Pop', artists: ['UC3'] }, { reserved: ['Pop'] }).category.name).toBe(
            'Pop (2)'
        );
    });

    it('desa, llegeix i esborra al localStorage', () => {
        const created = uc.create('Festa major', { channelId: 'UC9' });
        expect(created.error).toBe('');
        expect(JSON.parse(storage.getItem(uc.STORAGE_KEY))).toEqual([created.category]);
        expect(uc.isUserCategory('festa major')).toBe(true);
        expect(uc.get('Festa major').artists).toEqual(['UC9']);
        expect(uc.toggle(created.category.id, 'UC9')).toBe(false);
        expect(uc.get(created.category.id).artists).toEqual([]);
        uc.setHomeOrder(['Festa major', 'Pop']);
        expect(uc.remove(created.category.id)).toBe(true);
        expect(uc.list()).toEqual([]);
        expect(uc.getHomeOrder()).toEqual(['Pop']);
    });
});

describe('les teves categories: portada i ordre', () => {
    const styles = [
        ...['Urban', 'Pop', 'Rock', "Cançó d'autor", 'Indie', 'Rap / Hip-hop', 'Folk i arrel', 'Electrònica'].map(
            label => ({ label, artists: 3, avatars: [], primary: true })
        ),
        { label: 'Clàssica', artists: 2, avatars: [], primary: false },
        { label: 'Infantil', artists: 2, avatars: [], primary: false },
    ];
    const channels = [
        { id: 'UC1', name: 'Txarango', avatar: 'a1' },
        { id: 'UC2', name: 'Oques Grasses', avatar: 'a2' },
    ];
    const userTiles = uc =>
        uc.tilesFor(
            [
                { id: 'a', name: 'Festa major', artists: ['UC1', 'UC2', 'UC404'] },
                { id: 'b', name: 'Per córrer', artists: [] },
            ],
            { channels }
        );

    it('fa rajoles de les categories pròpies amb el recompte i les cares dels grups', () => {
        expect(userTiles(uc)[0]).toEqual({
            label: 'Festa major',
            id: 'a',
            user: true,
            artists: 3,
            avatars: ['a1', 'a2'],
        });
    });

    it('sense ordre desat: estils principals, categories pròpies (visibles) i la resta', () => {
        const tiles = uc.arrangeTiles(styles, userTiles(uc), null);
        expect(tiles.map(tile => tile.label)).toEqual([
            'Urban',
            'Pop',
            'Rock',
            "Cançó d'autor",
            'Indie',
            'Rap / Hip-hop',
            'Folk i arrel',
            'Electrònica',
            'Festa major',
            'Per córrer',
            'Clàssica',
            'Infantil',
        ]);
        expect(tiles.filter(tile => tile.primary)).toHaveLength(10);
    });

    it('respecta l’ordre arrossegat i hi posa visibles les categories noves', () => {
        const order = ['Festa major', 'Clàssica', 'Urban', 'Pop'];
        const tiles = uc.arrangeTiles(styles, userTiles(uc), order);
        expect(tiles.slice(0, 4).map(tile => tile.label)).toEqual(['Festa major', 'Clàssica', 'Urban', 'Pop']);
        // «Per córrer» no és a l'ordre desat: entra a l'última posició visible
        const visible = tiles.filter(tile => tile.primary).map(tile => tile.label);
        expect(visible).toHaveLength(10);
        expect(visible).toContain('Per córrer');
        expect(visible).toContain('Clàssica');
    });

    it('porta l’ordre de la portada a la barra d’estils sense moure la resta', () => {
        const chips = ['Novetats', 'Música TV', 'Descobreix', 'Urban', 'Pop', 'Rock', 'Seguint'];
        expect(uc.mergeOrder(chips, ['Rock', 'Festa', 'Urban', 'Pop'])).toEqual([
            'Novetats',
            'Música TV',
            'Descobreix',
            'Rock',
            'Festa',
            'Urban',
            'Seguint',
            'Pop',
        ]);
    });
});

describe('les teves categories: cançons i compartir', () => {
    it('agafa les cançons dels grups (i dels canals del mateix artista) sense Shorts', () => {
        const videos = [
            { id: 'v1', channelId: 'UC1' },
            { id: 'v2', channelId: 'UC1', isShort: true },
            { id: 'v3', channelId: 'UCtema' },
            { id: 'v4', channelId: 'UC9' },
            { id: 'v1', channelId: 'UC1' },
        ];
        const category = { artists: ['UC1'] };
        expect(uc.songsOf(category, videos).map(video => video.id)).toEqual(['v1']);
        const expand = id => (id === 'UC1' ? ['UC1', 'UCtema'] : [id]);
        expect(uc.songsOf(category, videos, expand).map(video => video.id)).toEqual(['v1', 'v3']);
    });

    it('el missatge de compartir porta el nom de la categoria i els grups', () => {
        expect(uc.shareMessage('Festa major', ['Txarango'])).toBe(
            'Et passo la meva categoria «Festa major» de Segueix Música: Txarango.'
        );
        expect(uc.shareMessage('Festa major', ['A', 'B', 'C'])).toBe(
            'Et passo la meva categoria «Festa major» de Segueix Música: A, B i C.'
        );
        expect(uc.shareMessage('Festa', ['A', 'B', 'C', 'D'], 2)).toBe(
            'Et passo la meva categoria «Festa» de Segueix Música: A, B i 2 grups més.'
        );
        expect(uc.shareMessage('Festa', [])).toContain('«Festa»');
    });

    it('els noms dels grups surten del catàleg (i, si no hi són, per l’ID)', () => {
        expect(uc.artistNames({ artists: ['UC1', 'UCx'] }, [{ id: 'uc1', displayName: 'Txarango' }])).toEqual([
            'Txarango',
            'UCx',
        ]);
    });

    it('la fitxa d’artista marca les categories on ja és el grup', () => {
        const html = uc.artistSectionHtml(
            [
                { id: 'a', name: 'Festa <major>', artists: ['UC1'] },
                { id: 'b', name: 'Per córrer', artists: [] },
            ],
            'UC1'
        );
        expect(html).toContain('data-uc-toggle="a" aria-pressed="true"');
        expect(html).toContain('data-uc-toggle="b" aria-pressed="false"');
        expect(html).toContain('Festa &lt;major&gt;');
        expect(html).toContain('data-uc-new');
    });
});

describe('les teves categories: integració', () => {
    const index = fs.readFileSync('index.html', 'utf8');
    const sw = fs.readFileSync('sw.js', 'utf8');

    it('el script es carrega després de la fitxa d’artista i abans d’app.js, i és al precache', () => {
        const at = name => index.indexOf(`js/features/${name}`);
        expect(at('user-categories.js')).toBeGreaterThan(at('artist-page.js'));
        expect(at('user-categories.js')).toBeLessThan(index.indexOf('js/app.js'));
        expect(sw).toContain("'./js/features/user-categories.js'");
        expect(index).toContain('id="apUserCats"');
    });

    it('la targeta del QR d’una categoria compta artistes', () => {
        const card = loadScript('js/utils/share-card.js', { SegueixApp: { utils: {} } }).SegueixApp.utils.shareCard;
        const model = card.buildShareModel({ type: 'category', name: 'Festa major', count: 3 });
        expect(model.caption).toBe('Categoria · Festa major');
        expect(model.countText).toBe('3 artistes');
    });
});
