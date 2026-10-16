import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { loadScript } from './setup.js';

const page = loadScript('js/features/artist-page.js', { SegueixApp: { features: {}, state: {}, utils: {} } }).SegueixApp
    .features.artistPage;
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/portada.css', 'utf8');

describe('fitxa d’artista: estils per a la ràdio', () => {
    const labels = ['Pop', 'Folk i arrel', 'Jazz / Blues', 'Altres estils'];

    it('posa l’estil principal primer, amb el nom canònic i sense repetits', () => {
        expect(
            page.artistStyles({ categories: ['jazz / blues', 'pop', 'Folk i arrel'], primary: 'Folk i arrel', labels })
        ).toEqual(['Folk i arrel', 'Jazz / Blues', 'Pop']);
    });

    it('descarta les vistes generals i «Altres estils», i no passa de tres', () => {
        expect(page.artistStyles({ categories: ['Altres estils', 'Novetats', 'Seguint', 'Pop'], labels })).toEqual([
            'Pop',
        ]);
        expect(page.artistStyles({ categories: ['A', 'B', 'C', 'D', 'E'] })).toHaveLength(3);
        expect(page.artistStyles({})).toEqual([]);
    });
});

describe('fitxa d’artista: ràdios i presentació', () => {
    it('la ràdio de l’artista necessita almenys dues cançons i la d’estil, algun estil', () => {
        const ok = page.radiosModel({ name: 'Judit', styles: ['Pop'], songCount: 5 });
        expect(ok.artist.enabled).toBe(true);
        expect(ok.style.enabled).toBe(true);
        expect(ok.style.label).toContain('Pop');
        const few = page.radiosModel({ name: 'Judit', styles: [], songCount: 1 });
        expect(few.artist.enabled).toBe(false);
        expect(few.style.enabled).toBe(false);
        expect(page.radiosModel({ name: 'Judit', styles: ['Pop'], songCount: 9, loading: true }).artist.enabled).toBe(
            false
        );
    });

    it('la presentació conserva els paràgrafs però no els salts de línia buits seguits', () => {
        expect(page.bioModel('  Hola\r\n\r\n\r\n\r\nAdéu  ')).toEqual({ text: 'Hola\n\nAdéu', hasText: true });
        expect(page.bioModel('   ').hasText).toBe(false);
        expect(page.bioModel(null).hasText).toBe(false);
    });

    it('les cançons de la ràdio no inclouen Shorts', () => {
        expect(page.songsOf([{ id: 'a' }, { id: 'b', isShort: true }, null, {}]).map(v => v.id)).toEqual(['a']);
    });

    it('mostra el recompte com a cançons disponibles', () => {
        expect(page.availableSongsLabel(1)).toBe('1 cançó disponible');
        expect(page.availableSongsLabel(2)).toBe('2 cançons disponibles');
        expect(page.availableSongsLabel(0)).toBe('0 cançons disponibles');
    });

    it('relaciona només els discos que tenen cançons visibles a la fitxa', () => {
        const catalog = {
            channels: { UC1: 'Artista' },
            artists: {
                Artista: {
                    albums: [
                        { id: 'a1', title: 'Disc A', coverVideoId: 'x', trackIds: ['1', '2'] },
                        { id: 'a2', title: 'Disc B', coverVideoId: 'y', trackIds: ['9'] },
                    ],
                },
            },
        };
        const model = page.albumsModel(catalog, {
            channelId: 'UC1',
            videos: [{ id: '1' }, { id: '2' }, { id: '3' }],
        });
        expect(model.artist).toBe('Artista');
        expect(model.albums).toHaveLength(1);
        expect(model.albums[0].visibleTrackIds).toEqual(['1', '2']);
        expect(model.otherIds).toEqual(['3']);
        expect(model.hasAlbums).toBe(true);
    });

    it('«Ràdio del disc» només amb un disc triat de dues cançons o més', () => {
        expect(page.albumRadioModel({ title: 'Disc A' }, 4)).toEqual({
            title: 'Disc A',
            label: 'Ràdio del disc',
            meta: '4 cançons disponibles',
        });
        expect(page.albumRadioModel({ title: 'Disc A' }, 1)).toBeNull();
        expect(page.albumRadioModel(null, 5)).toBeNull();
        expect(html).toContain('id="apAlbumRadio"');
    });

    it('manté un disc verificat pendent i indica una disponibilitat parcial sense inventar pistes', () => {
        const catalog = {
            channels: { UC1: 'Artista' },
            artists: {
                Artista: {
                    albums: [
                        {
                            id: 'verified',
                            title: 'Disc pendent',
                            sourceType: 'release',
                            trackIds: ['a', 'b'],
                            trackGroups: [{ videoIds: ['a'] }, { videoIds: ['b'] }],
                        },
                        { id: 'inferred', title: 'Inferit buit', trackIds: ['c'] },
                    ],
                },
            },
        };
        const empty = page.albumsModel(catalog, { channelId: 'UC1', videos: [] });
        expect(empty.albums.map(a => a.id)).toEqual(['verified']);
        expect(page.albumAvailabilityLabel(empty.albums[0])).toBe('Pistes pendents d’incorporar');
        const partial = page.albumsModel(catalog, { channelId: 'UC1', videos: [{ id: 'b' }] });
        expect(page.albumAvailabilityLabel(partial.albums[0])).toBe('1 de 2 cançons disponibles');
    });

    it('per defecte mostra totes les cançons; un disc filtra la llista i es conserva quan arriba més historial', async () => {
        const catalog = {
            channels: { UC1: 'Artista' },
            artists: { Artista: { albums: [{ id: 'disc', title: 'Disc', trackIds: ['a', 'b'] }] } },
        };
        const ctx = loadScript('js/features/artist-page.js', {
            document: { getElementById: () => null },
            YouTubeAPI: { loadAlbumsCatalog: async () => catalog },
        });
        const feature = ctx.SegueixApp.features.artistPage;
        feature.showProfile({ channelId: 'UC1', name: 'Artista' });
        feature.setSongs([{ id: 'a' }, { id: 'other' }], 'UC1');
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(feature.isAlbumFilterActive()).toBe(false);
        expect(feature.filterSongs([{ id: 'other' }, { id: 'a' }], 'UC1')).toHaveLength(2);
        feature.selectAlbum('disc');
        expect(feature.filterSongs([{ id: 'other' }, { id: 'a' }], 'UC1')).toEqual([{ id: 'a' }]);
        feature.setSongs([{ id: 'a' }, { id: 'b' }], 'UC1');
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(feature.isAlbumFilterActive()).toBe(true);
        expect(feature.filterSongs([{ id: 'b' }, { id: 'a' }], 'UC1').map(v => v.id)).toEqual(['a', 'b']);
        feature.selectAlbum('');
        expect(feature.isAlbumFilterActive()).toBe(false);
    });

    it('pinta els discos (també un de pendent, desactivat) i «Totes les cançons» només amb un disc triat', async () => {
        const nodes = new Map(
            ['apAlbums', 'apAlbumsGrid', 'apAlbumsAll'].map(id => [id, { innerHTML: '', hidden: true }])
        );
        const catalog = {
            channels: { UC1: 'Artista' },
            artists: {
                Artista: {
                    albums: [
                        { id: 'pending', title: 'Disc pendent', sourceType: 'release', trackIds: ['a', 'b'] },
                        { id: 'ok', title: 'Disc', trackIds: ['c', 'd'] },
                    ],
                },
            },
        };
        const ctx = loadScript('js/features/artist-page.js', {
            document: { getElementById: id => nodes.get(id) || null },
            YouTubeAPI: { loadAlbumsCatalog: async () => catalog },
        });
        const feature = ctx.SegueixApp.features.artistPage;
        feature.showProfile({ channelId: 'UC1', name: 'Artista' });
        feature.setSongs([{ id: 'c' }, { id: 'd' }], 'UC1');
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(nodes.get('apAlbums').hidden).toBe(false);
        expect(nodes.get('apAlbumsGrid').innerHTML).toContain('disabled');
        expect(nodes.get('apAlbumsGrid').innerHTML).toContain('Pistes pendents d’incorporar');
        expect(nodes.get('apAlbumsAll').hidden).toBe(true);
        feature.selectAlbum('ok');
        expect(nodes.get('apAlbumsAll').hidden).toBe(false);
        // Tornar a tocar el disc triat el desfà
        expect(nodes.get('apAlbumsGrid').innerHTML).toMatch(/data-ap-album=""[^>]*aria-pressed="true"/);
    });
});

describe('fitxa d’artista: cançons per visualitzacions', () => {
    const songs = [
        { id: 'a', title: 'Poc', viewCount: 10, contentType: 'song' },
        { id: 'b', title: 'La més', viewCount: 5000, contentType: 'song', originalYear: 1998 },
        { id: 'c', title: 'Clip 1', viewCount: 800, contentType: 'song', clip: true },
        { id: 'd', title: 'Clip 2', viewCount: 900, contentType: 'song', clip: true },
        { id: 'e', title: 'Viu 1', viewCount: 300, contentType: 'live_song' },
        { id: 'f', title: 'Cançó (En directe)', viewCount: 200, contentType: 'song' },
        { id: 'g', title: 'Mitjana', viewCount: 400, contentType: 'song' },
        { id: 'h', title: 'Short', viewCount: 9999, isShort: true },
        { id: 'b', title: 'La més (repetida)', viewCount: 5000 },
    ];
    const isClip = video => Boolean(video.clip);

    it('la més escoltada a part i la resta per visualitzacions, sense Shorts ni repetides', () => {
        const model = page.songsModel(songs, { isClip });
        expect(model.best.id).toBe('b');
        expect(model.total).toBe(7);
        expect(model.all.map(v => v.id)).toEqual(['b', 'd', 'c', 'g', 'e', 'f', 'a']);
    });

    it('separa videoclips i directes (també pel títol) i no els repeteix a la llista', () => {
        const model = page.songsModel(songs, { isClip });
        expect(model.clips.map(v => v.id)).toEqual(['d', 'c']);
        expect(model.lives.map(v => v.id)).toEqual(['e', 'f']);
        expect(model.rest.map(v => v.id)).toEqual(['g', 'a']);
    });

    it('una fila amb una sola cançó no és una secció: va a la llista', () => {
        const model = page.songsModel(
            songs.filter(v => v.id !== 'd'),
            { isClip }
        );
        expect(model.clips).toEqual([]);
        expect(model.rest.map(v => v.id)).toContain('c');
    });

    it('formata les xifres en català', () => {
        expect(page.formatCount(856)).toBe('856');
        expect(page.formatCount(1234)).toBe('1,2 k');
        expect(page.formatCount(15300)).toBe('15 k');
        expect(page.formatCount(2500000)).toBe('2,5 M');
        expect(page.viewsLabel(1)).toBe('1 visualització');
        expect(page.viewsLabel(0)).toBe('');
        expect(page.subscribersLabel(12000)).toBe('12 k subscriptors');
        expect(page.formatDuration(225)).toBe('3:45');
        expect(page.formatDuration(3725)).toBe('1:02:05');
        expect(page.formatDuration(0)).toBe('');
    });

    it('l’any és l’original si se sap; si no, el de publicació', () => {
        expect(page.songYear({ originalYear: 1979, publishedAt: '2024-01-01' })).toBe(1979);
        expect(page.songYear({ publishedAt: '2024-05-01T00:00:00Z' })).toBe(2024);
        expect(page.songYear({})).toBe(0);
    });

    it('la foto de la capçalera és la gran i sempre per https', () => {
        expect(page.heroImage('http://yt3.ggpht.com/abc=s88-c-k-c0x00ffffff-no-rj')).toBe(
            'https://yt3.ggpht.com/abc=s800-c-k-c0x00ffffff-no-rj'
        );
        expect(page.heroImage('https://i.ytimg.com/vi/x/maxresdefault.jpg')).toBe(
            'https://i.ytimg.com/vi/x/maxresdefault.jpg'
        );
        expect(page.heroImage('javascript:alert(1)')).toBe('');
        expect(page.heroImage('img/icon-192.png')).toBe('img/icon-192.png');
    });

    it('cada cançó té el play que engega la ràdio i el botó de la cua; el text s’escapa', () => {
        const html = page.songRowsHtml([{ id: 'x"1', title: '<b>Hola</b>', viewCount: 1500, durationSeconds: 200 }]);
        expect(html).toContain('data-ap-play="x&quot;1"');
        expect(html).toContain('data-ap-queue="x&quot;1"');
        expect(html).toContain('&lt;b&gt;Hola&lt;/b&gt;');
        expect(html).not.toContain('<b>Hola');
        expect(html).toContain('1,5 k visualitzacions');
        expect(html).toContain('3:20');
        expect(html).toContain('class="ap-play ap-play--sm"');
    });

    it('la més escoltada porta la caràtula amb el play i el botó de ràdio', () => {
        const html = page.bestHtml(
            { id: 'b', title: 'La més', viewCount: 5000, originalYear: 1998 },
            { artist: 'Txarango' }
        );
        expect(html).toContain('La més escoltada');
        expect(html.match(/data-ap-play="b"/g)).toHaveLength(2);
        expect(html).toContain('5 k visualitzacions · 1998');
        expect(html).toContain('Ràdio de Txarango a partir de «La més»');
        expect(page.bestHtml(null)).toBe('');
    });

    it('les files de videoclips i directes porten la seva ràdio', () => {
        const model = page.songsModel(songs, { isClip });
        const html = page.shelvesHtml(model, { artist: 'Txarango' });
        expect(html).toContain('data-ap-shelf-radio="clips"');
        expect(html).toContain('data-ap-shelf-radio="lives"');
        expect(html).toContain('>Videoclips <span class="ap-count">2</span>');
        expect(page.shelvesHtml({ clips: [], lives: [] })).toBe('');
    });

    it('la cerca mira el títol i el de YouTube, sense accents', () => {
        expect(page.matchesQuery({ title: 'Cançó', originalTitle: 'X - Cançó (Videoclip)' }, 'canco')).toBe(true);
        expect(page.matchesQuery({ title: 'Cançó', originalTitle: 'X - Cançó (Videoclip)' }, 'videoclip')).toBe(true);
        expect(page.matchesQuery({ title: 'Cançó', description: 'amor' }, 'amor')).toBe(false);
    });

    it('el play d’una cançó engega la ràdio de l’artista que hi comença', () => {
        const calls = [];
        const ctx = loadScript('js/features/artist-page.js', {
            document: { getElementById: () => null },
            SegueixApp: {
                state: {},
                utils: {},
                features: {
                    musicQueue: { startArtistRadio: (videos, options) => calls.push({ videos, options }) || true },
                },
            },
        });
        const feature = ctx.SegueixApp.features.artistPage;
        feature.showProfile({ channelId: 'UC1', name: 'Txarango' });
        feature.setSongs([{ id: 'a' }, { id: 'b' }], 'UC1');
        expect(feature.playFrom('b', 'list')).toBe(true);
        expect(calls[0].options).toMatchObject({ name: 'Txarango', channelId: 'UC1', seedId: 'b' });
        expect(calls[0].videos.map(v => v.id)).toEqual(['a', 'b']);
    });
});

describe('fitxa d’artista: HTML i CSS', () => {
    const channelPage = html.slice(html.indexOf('id="channelPage"'), html.indexOf('id="channelVideosGrid"') + 30);

    it('la foto de perfil fa de fons de la capçalera i al damunt hi ha el nom, l’origen, les ràdios i compartir', () => {
        const hero = channelPage.slice(channelPage.indexOf('id="apHero"'), channelPage.indexOf('id="apBest"'));
        const photo = hero.indexOf('id="channelProfileAvatar"');
        expect(photo).toBeGreaterThan(-1);
        expect(hero.indexOf('id="channelProfileName"')).toBeGreaterThan(photo);
        [
            'id="channelBackBtn"',
            'id="channelProfileShareBtn"',
            'id="channelProfileSubscribers"',
            'id="apStats"',
            'id="apOrigin"',
            'data-ap-radio="artist"',
            'data-ap-radio="style"',
            'id="channelProfileFollowBtn"',
        ].forEach(item => expect(hero, item).toContain(item));
        expect(css).toMatch(/#channelPage \.ap-hero__img\.channel-profile-avatar\s*{[^}]*object-fit:\s*cover/);
        expect(css).toMatch(/#channelPage \.ap-hero__img\.channel-profile-avatar\s*{[^}]*position:\s*absolute/);
    });

    it('al costat de la capçalera, la més escoltada; després videoclips/directes, discos i cançons', () => {
        const order = ['id="apHero"', 'id="apBest"', 'id="apShelves"', 'id="apAlbums"', 'id="apSongs"'].map(item =>
            channelPage.indexOf(item)
        );
        order.forEach(index => expect(index).toBeGreaterThan(-1));
        expect([...order].sort((a, b) => a - b)).toEqual(order);
        expect(css).toMatch(/#channelPage \.ap-head\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
    });

    it('conserva els ids que fa servir app.js', () => {
        [
            'channelProfileAvatar',
            'channelProfileName',
            'channelProfileHandle',
            'channelProfileSubscribers',
            'channelProfileDescription',
            'channelProfileTags',
            'channelProfileFollowBtn',
            'channelProfileHideBtn',
            'channelProfileShareBtn',
            'channelSupportBtn',
            'channelSearchInputDesktop',
            'channelSearchInputMobile',
            'apAlbums',
            'apAlbumsGrid',
            'apAlbumsAll',
            'apSongsTitle',
        ].forEach(id => expect(channelPage, id).toContain(`id="${id}"`));
    });

    it('la presentació comença plegada, amb botó per expandir-la', () => {
        expect(channelPage).toMatch(/id="channelProfileDescription"[^>]*>/);
        expect(channelPage).toContain('is-collapsed');
        expect(channelPage).toContain('id="apBioToggle"');
        expect(channelPage).toContain('aria-expanded="false"');
        expect(css).toMatch(/\.channel-profile-description\.is-collapsed\s*{[^}]*-webkit-line-clamp:\s*3/);
    });

    it('mostra els discos només dins la fitxa, amb caràtules quadrades i scroll horitzontal', () => {
        expect(channelPage).toContain('id="apAlbums"');
        expect(channelPage).toContain('>Discos</h2>');
        expect(css).toMatch(/\.ap-album-cover[\s\S]*aspect-ratio:\s*1/);
        expect(css).toMatch(/\.ap-albums-grid[\s\S]*overflow-x:\s*auto/);
    });

    it('les icones de la fitxa no depenen de lucide (CDN) i el botó d’enrere és tàctil', () => {
        expect(channelPage).not.toContain('data-lucide');
        expect(css).toMatch(/#channelPage \.ap-top \.channel-back-btn[^{]*{[^}]*width:\s*44px/);
        expect(css).toMatch(/\.ap-radio\s*{[^}]*min-height:\s*48px/);
        expect(css).toMatch(/#channelPage \.ap-song__queue\s*{[^}]*width:\s*44px/);
    });

    it('carrega el mòdul després de music-queue.js i abans d’app.js', () => {
        const order = name => html.indexOf(`src="js/features/${name}.js`);
        expect(order('artist-page')).toBeGreaterThan(order('music-queue'));
        expect(html.indexOf('js/app.js')).toBeGreaterThan(order('artist-page'));
    });
});

describe('fitxa d’artista: sense categories personalitzades', () => {
    const app = fs.readFileSync('js/app.js', 'utf8');
    const styles = fs.readFileSync('css/styles.css', 'utf8');

    it('no hi ha el «+» per sumar categories ni el seu selector (a l’artista ni al programa)', () => {
        expect(app).not.toContain('add-channel-category');
        expect(app).not.toContain('add-program-category');
        expect(app).not.toContain('data-channel-category-picker');
        expect(app).not.toContain('channelCategoryPickerCleanup');
        expect(css).not.toContain('.channel-category-add');
        expect(styles).not.toContain('.channel-category-add');
        expect(styles).not.toContain('.channel-category-picker');
    });

    it('els estils de l’artista es mostren com a etiquetes sense botó', () => {
        const fn = app.slice(
            app.indexOf('function renderChannelProfileCategories'),
            app.indexOf('function isCustomCategoryTag')
        );
        expect(fn).toContain('<span class="channel-category-btn">');
        expect(fn).not.toContain('<button');
    });
});
