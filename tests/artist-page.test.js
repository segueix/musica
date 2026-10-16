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

    it('cada cançó és una caràtula quadrada amb les dades al damunt, el play i la cua; el text s’escapa', () => {
        const html = page.cardHtml(
            { id: 'x"1', title: '<b>Hola</b>', viewCount: 1500, durationSeconds: 200, originalYear: 2001 },
            { rank: 7, size: 'l' }
        );
        expect(html).toContain('class="ap-card ap-card--l"');
        expect(html).toContain('data-ap-play="x&quot;1"');
        expect(html).toContain('data-ap-queue="x&quot;1"');
        expect(html).toContain('&lt;b&gt;Hola&lt;/b&gt;');
        expect(html).not.toContain('<b>Hola');
        expect(html).toContain('>#7<');
        expect(html).toContain('1,5 k</span>');
        expect(html).toContain('2001 · 3:20');
        expect(html).toContain('aria-label="Ràdio a partir de «&lt;b&gt;Hola&lt;/b&gt;», 1,5 k visualitzacions, 2001"');
        // hqdefault (4:3 amb franges) s'amplia per omplir el quadrat; la maxresdefault del feed és la més nítida
        expect(html).toContain('/hqdefault.jpg" alt="" loading="lazy" decoding="async" class="is-letterboxed"');
        expect(page.cardHtml({ id: 'y', thumbnail: 'https://i.ytimg.com/vi/y/maxresdefault.jpg' })).toContain(
            'maxresdefault.jpg'
        );
        expect(page.cardHtml({ id: 'y' }, { size: 'enorme' })).toContain('ap-card--s');
    });

    it('la mida de cada caràtula depèn de les visualitzacions', () => {
        const views = [1000, 900, 700, 500, 300, 290, 100, 50, 10].map((viewCount, i) => ({
            id: String(i),
            viewCount,
        }));
        expect(page.sizeTiers(views)).toEqual(['xl', 'xl', 'xl', 'l', 'l', 'l', 's', 's', 's']);
        // Com a molt tres de grans, encara que n'hi hagi més d'acostades a la primera
        expect(page.sizeTiers([9, 9, 9, 9, 9].map((viewCount, i) => ({ id: String(i), viewCount })))).toEqual([
            'xl',
            'xl',
            'xl',
            'l',
            'l',
        ]);
        expect(page.sizeTiers([])).toEqual([]);
        // A la graella, les mides es calculen sobre tota la llista (no canvien amb «Mostra'n més»)
        const html = page.songCardsHtml(views.slice(0, 7), { all: views });
        expect(html.match(/ap-card--xl/g)).toHaveLength(3);
        expect(html.match(/ap-card--l"/g)).toHaveLength(3);
        expect(html.match(/ap-card--s"/g)).toHaveLength(1);
    });

    it('un directe porta l’adhesiu «Directe» a la graella però no dins la fila de directes', () => {
        const live = { id: 'z', title: 'Viu', contentType: 'live_song', viewCount: 10 };
        expect(page.cardHtml(live, { from: 'list' })).toContain('ap-card__live');
        expect(page.cardHtml(live, { from: 'lives' })).not.toContain('ap-card__live');
    });

    it('la més escoltada és la primera caràtula punk (#1), amb la cinta i les dades al damunt', () => {
        const html = page.bestHtml({
            id: 'b',
            title: 'La més',
            viewCount: 5000,
            originalYear: 1998,
            durationSeconds: 90,
        });
        expect(html).toContain('class="ap-card ap-card--xl"');
        expect(html).toContain('>#1<');
        expect(html).toContain('<span class="ap-card__tag">La més escoltada</span>');
        expect(html).toContain('data-ap-play="b"');
        expect(html).toContain('5 k</span>');
        expect(html).toContain('1998 · 1:30');
        expect(page.bestHtml(null)).toBe('');
    });

    it('les files de videoclips i directes porten la seva ràdio i el títol en lletres retallades', () => {
        const model = page.songsModel(songs, { isClip });
        const html = page.shelvesHtml(model, { artist: 'Txarango' });
        expect(html).toContain('data-ap-shelf-radio="clips"');
        expect(html).toContain('data-ap-shelf-radio="lives"');
        expect(html).toContain('<span class="pt-sr-only">Videoclips (2)</span>');
        expect(page.shelvesHtml({ clips: [], lives: [] })).toBe('');
    });

    it('el títol punk: una lletra per peça, el text sencer per als lectors de pantalla i escapat', () => {
        const html = page.punkTitleHtml('A<b', 3);
        expect(html.match(/class="ap-punk__l"/g)).toHaveLength(3);
        expect(html).toContain('>&lt;<');
        expect(html).toContain('<span class="ap-punk__count" aria-hidden="true">3</span>');
        expect(html).toContain('<span class="pt-sr-only">A&lt;b (3)</span>');
        expect(page.punkTitleHtml('Dos mots')).toContain('ap-punk__gap');
        expect(page.punkTitleHtml('Cançons')).not.toContain('ap-punk__count');
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
        expect(feature.playFrom('b')).toBe(true);
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

    it('al costat de la capçalera, la més escoltada; després videoclips/directes i la graella de cançons', () => {
        const order = ['id="apHero"', 'id="apBest"', 'id="apShelves"', 'id="apSongs"'].map(item =>
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
            'apBio',
            'apUserCats',
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

    it('fora de la capçalera i de les caràtules només hi ha els títols: sense cerca ni text d’ajuda', () => {
        const hero = channelPage.slice(channelPage.indexOf('id="apHero"'), channelPage.indexOf('id="apBest"'));
        expect(hero).toContain('id="apBio"');
        expect(hero).toContain('id="apUserCats"');
        expect(channelPage).not.toContain('type="search"');
        expect(channelPage).not.toContain('ap-songs-hint');
        const after = channelPage.slice(channelPage.indexOf('id="apShelves"'));
        expect(after).not.toMatch(/<p(?![^>]*ap-songs-empty)[^>]*>/);
        expect(css).toMatch(/\.ap-hero__chips \.uc-artist__head\s*{[^}]*display:\s*none/);
        expect(css).toMatch(/#channelPage \.ap-punk__l\s*{[^}]*transform:/);
    });

    it('no hi ha discos i les cançons són un mosaic de caràtules quadrades de mides diferents', () => {
        expect(channelPage).not.toContain('apAlbums');
        expect(channelPage).not.toContain('>Discos<');
        expect(css).not.toContain('.ap-album');
        expect(channelPage).toMatch(/<ul class="ap-grid" id="apSongs"/);
        expect(css).toMatch(/#channelPage \.ap-card\s*{[^}]*aspect-ratio:\s*1;/);
        expect(css).toMatch(/#channelPage \.ap-grid\s*{[^}]*grid-auto-flow:\s*dense/);
        expect(css).toMatch(
            /#channelPage \.ap-grid \.ap-card--xl\s*{[^}]*grid-column:\s*span 3;[^}]*grid-row:\s*span 3/
        );
        expect(css).toMatch(
            /#channelPage \.ap-grid \.ap-card--l\s*{[^}]*grid-column:\s*span 2;[^}]*grid-row:\s*span 2/
        );
        expect(css).toMatch(/#channelPage \.ap-shelf__row\s*{[^}]*overflow-x:\s*auto/);
        expect(css).toMatch(/#channelPage \.ap-card__queue\s*{[^}]*width:\s*44px/);
    });

    it('les icones de la fitxa no depenen de lucide (CDN) i el botó d’enrere és tàctil', () => {
        expect(channelPage).not.toContain('data-lucide');
        expect(css).toMatch(/#channelPage \.ap-top \.channel-back-btn[^{]*{[^}]*width:\s*44px/);
        expect(css).toMatch(/\.ap-radio\s*{[^}]*min-height:\s*48px/);
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
