import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { loadScript } from './setup.js';

const require = createRequire(import.meta.url);
const SegueixSongTitle = require('../js/song-title.js');
const SegueixCatalogPolicy = require('../js/catalog-policy.js');

const page = loadScript('js/features/artist-page.js', {
    SegueixCatalogPolicy,
    SegueixApp: { features: {}, state: {}, utils: {} },
}).SegueixApp.features.artistPage;
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
        { id: 'c', title: 'Clip', viewCount: 800, contentType: 'song' },
        { id: 'e', title: 'Viu', viewCount: 300, contentType: 'live_song' },
        { id: 'h', title: 'Short', viewCount: 9999, isShort: true },
        { id: 'b', title: 'La més (repetida)', viewCount: 5000 },
    ];

    it('la més escoltada a part i la resta per visualitzacions (també directes), sense Shorts ni repetides', () => {
        const model = page.songsModel(songs);
        expect(model.best.id).toBe('b');
        expect(model.total).toBe(4);
        expect(model.all.map(v => v.id)).toEqual(['b', 'c', 'e', 'a']);
        expect(model.rest.map(v => v.id)).toEqual(['c', 'e', 'a']);
        expect(page.songsModel([]).best).toBeNull();
    });

    it('treu el nom del grup del títol (davant, darrere o entre parèntesis) però mai el deixa buit', () => {
        const withCleaner = loadScript('js/features/artist-page.js', {
            SegueixCatalogPolicy,
            SegueixApp: { features: {}, state: {}, utils: {} },
            SegueixSongTitle,
        }).SegueixApp.features.artistPage;
        const title = (raw, names = ['The Tyets']) => withCleaner.songTitle({ title: raw, originalTitle: raw }, names);
        expect(title('The Tyets - Olívia')).toBe('Olívia');
        expect(title('Coti x Coti - The Tyets')).toBe('Coti x Coti');
        expect(title('Olívia (The Tyets)')).toBe('Olívia');
        expect(title('Olívia [the tyets]')).toBe('Olívia');
        expect(title('The Tyets, Cobla Sant Jordi - Coti x Coti (En Directe)')).toBe('Coti x Coti (En Directe)');
        expect(title('The Tyets')).toBe('The Tyets');
        // També el nom del canal del vídeo
        expect(withCleaner.songTitle({ title: 'Txarango - Som Riu', channelTitle: 'Txarango' })).toBe('Som Riu');
        // Sense song-title.js, el títol net que ja porta el vídeo
        expect(page.songTitle({ title: 'Olívia', originalTitle: 'The Tyets - Olívia (Videoclip)' })).toBe('Olívia');
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
            { rank: 7 }
        );
        expect(html).toContain('class="ap-card"');
        expect(html).toContain('data-ap-play="x&quot;1"');
        expect(html).toContain('data-ap-queue="x&quot;1"');
        expect(html).toContain('&lt;b&gt;Hola&lt;/b&gt;');
        expect(html).not.toContain('<b>Hola');
        expect(html).toContain('<span class="ap-card__rank" aria-hidden="true">#7</span>');
        expect(html).toContain('1,5 k</span>');
        expect(html).toContain('2001 · 3:20');
        expect(html).toContain('aria-label="Ràdio a partir de «&lt;b&gt;Hola&lt;/b&gt;», 1,5 k visualitzacions, 2001"');
        // hqdefault (4:3 amb franges) s'amplia per omplir el quadrat; la maxresdefault del feed és la més nítida
        expect(html).toContain('/hqdefault.jpg" alt="" loading="lazy" decoding="async" class="is-letterboxed"');
        expect(page.cardHtml({ id: 'y', thumbnail: 'https://i.ytimg.com/vi/y/maxresdefault.jpg' })).toContain(
            'maxresdefault.jpg'
        );
        // Ja no hi ha adhesius de «Directe» ni mides diferents
        expect(page.cardHtml({ id: 'z', contentType: 'live_song', title: 'Viu' })).not.toMatch(/Directe|ap-card--/);
    });

    it('la resta de cançons segueixen la numeració a partir del #2', () => {
        const html = page.songCardsHtml([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
        expect(html.match(/#\d+</g)).toEqual(['#2<', '#3<', '#4<']);
        expect(page.songCardsHtml([{ id: 'a' }], { start: 20 })).toContain('>#20<');
    });

    it('la més escoltada és la caràtula #1, amb «La més escoltada» i les dades al damunt', () => {
        const html = page.bestHtml({
            id: 'b',
            title: 'La més',
            viewCount: 5000,
            originalYear: 1998,
            durationSeconds: 90,
        });
        expect(html).toContain('>#1<');
        expect(html).toContain('<span class="ap-card__tag">La més escoltada</span>');
        // a dalt, al costat del #1 (no a baix sobre el títol) i més gran (2026-10-18)
        expect(html).toMatch(
            /<span class="ap-card__head" aria-hidden="true"><span class="ap-card__rank" aria-hidden="true">#1<\/span><span class="ap-card__tag">La més escoltada<\/span><\/span>/
        );
        expect(html.slice(html.indexOf('ap-card__info'))).not.toContain('ap-card__tag');
        expect(css).toMatch(
            /#channelPage \.ap-card__tag \{\s*font-size: max\(0\.85rem, calc\(var\(--ap-t\) \* 0\.8\)\);/
        );
        expect(html).toContain('data-ap-play="b"');
        expect(html).toContain('5 k</span>');
        expect(html).toContain('1998 · 1:30');
        expect(page.bestHtml(null)).toBe('');
    });

    it('el play d’una cançó engega la ràdio de l’artista que hi comença', () => {
        const calls = [];
        const ctx = loadScript('js/features/artist-page.js', {
            SegueixCatalogPolicy,
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

    it('la capçalera no es pot desplaçar per dins (la foto i els botons de dalt no pugen)', () => {
        // La foto desenfocada en sobresurt (inset -40px): amb overflow hidden, un scrollIntoView la desplaçava 40 px
        const rule = css.slice(css.indexOf('#channelPage .ap-hero {'), css.indexOf('#channelPage .ap-hero__photo {'));
        expect(rule).toMatch(/overflow:\s*clip;/);
    });

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
            'id="apYoutubeBtn"',
            'id="apOrigin"',
            'data-ap-radio="artist"',
            'data-ap-radio="style"',
            'id="channelProfileFollowBtn"',
        ].forEach(item => expect(hero, item).toContain(item));
        expect(css).toMatch(/#channelPage \.ap-hero__img\.channel-profile-avatar\s*{[^}]*object-fit:\s*cover/);
        expect(css).toMatch(/#channelPage \.ap-hero__img\.channel-profile-avatar\s*{[^}]*position:\s*absolute/);
    });

    it('al costat de la capçalera (a sota al mòbil), la més escoltada; després la graella de cançons', () => {
        const order = ['id="apHero"', 'id="apBest"', 'id="apRecent"', 'id="apSongs"'].map(item =>
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
            'apSongs',
        ].forEach(id => expect(channelPage, id).toContain(`id="${id}"`));
    });

    it('la presentació és una línia amb punts suspensius que es desplega tocant-la', () => {
        expect(channelPage).toMatch(/id="channelProfileDescription"[^>]*>/);
        expect(channelPage).toContain('is-collapsed');
        expect(channelPage).not.toContain('apBioToggle');
        expect(css).toMatch(
            /#channelPage \.channel-profile-description\.is-collapsed\s*{[^}]*white-space:\s*nowrap;[^}]*text-overflow:\s*ellipsis/
        );
        expect(css).toMatch(/\.channel-profile-description\.is-expandable\s*{[^}]*cursor:\s*pointer/);
    });

    it('de les novetats a les més escoltades: capçaleres i separador', () => {
        const api = page;
        const both = api.sectionsModel({ recent: 3, rest: 20 });
        expect(both.recent).toEqual({ show: true, sub: '3 cançons dels últims 12 mesos' });
        expect(both.hits).toEqual({ show: true, sub: 'De la #2 a la #21, per visualitzacions' });
        expect(api.sectionsModel({ recent: 1, rest: 1 }).recent.sub).toBe('1 cançó dels últims 12 mesos');
        expect(api.sectionsModel({ recent: 1, rest: 1 }).hits.sub).toBe('La #2, per visualitzacions');
        // Sense novetats no cal separador: la graella continua la #1
        expect(api.sectionsModel({ recent: 0, rest: 20 }).hits.show).toBe(false);
        expect(api.sectionsModel({ recent: 4, rest: 0 }).hits.show).toBe(false);
        const order = ['id="apRecentTitle"', 'id="apRecentSongs"', 'id="apHitsHead"', 'id="apSongs"'].map(id =>
            channelPage.indexOf(id)
        );
        expect(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1]))).toBe(true);
        expect(css).toMatch(/\.ap-section-head--hits \{[^}]*border-top: 1px solid/);
        expect(css).toMatch(/\.ap-section-head--new \.ap-section-head__icon \{[^}]*background: var\(--pt-accent\)/);
    });

    it('fora de les caràtules només hi ha les capçaleres de Novetats i «Les més escoltades», sense cerca ni ajuda', () => {
        const hero = channelPage.slice(channelPage.indexOf('id="apHero"'), channelPage.indexOf('id="apBest"'));
        expect(hero).toContain('id="apBio"');
        expect(hero).toContain('id="apUserCats"');
        const after = channelPage.slice(channelPage.indexOf('id="apBest"'));
        expect(after.match(/<h2\b/g)).toHaveLength(2);
        expect(after).toContain('id="apRecentTitle">Novetats</h2>');
        expect(after).toContain('id="apHitsTitle">Les més escoltades</h2>');
        expect(after).not.toMatch(/<p\b(?![^>]*ap-songs-empty)[^>]*>/);
        expect(channelPage).not.toContain('type="search"');
        expect(channelPage).not.toMatch(/apShelves|apAlbums|>Discos</);
        expect(css).not.toMatch(/\.ap-album|\.ap-punk|\.ap-shelf/);
        expect(css).toMatch(/\.ap-hero__chips \.uc-artist__head\s*{[^}]*display:\s*none/);
    });

    it('la resta de cançons: una columna al mòbil i tres a l’ordinador, quadrades, amb el mínim espai i en blanc', () => {
        expect(channelPage).toMatch(/<ul class="ap-grid" id="apSongs"/);
        expect(css).toMatch(/#channelPage \.ap-grid\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);[^}]*gap:\s*4px/);
        expect(css).toMatch(
            /@media \(min-width: 769px\)\s*{\s*#channelPage \.ap-grid\s*{\s*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/
        );
        expect(css).toMatch(/#channelPage \.ap-card\s*{[^}]*aspect-ratio:\s*1;/);
        expect(css).toMatch(/#channelPage \.ap-card__rank\s*{[^}]*color:\s*#fff/);
        // Les visualitzacions, sense fons
        expect(css).not.toMatch(/#channelPage \.ap-card__views\s*{[^}]*background/);
        // Totes les caràtules porten un marc blanc fi i res no gira
        expect(css).toMatch(/#channelPage \.ap-card__art\s*{[^}]*border:\s*2px solid #fff/);
        expect(css).not.toMatch(/#channelPage[^{]*\.ap-card[^{]*{[^}]*rotate\(/);
        expect(css).toMatch(/#channelPage \.ap-card__queue\s*{[^}]*width:\s*44px/);
    });

    it('enrere, YouTube i compartir van fixats dins la foto; a l’ordinador, la caràtula s’amplia en passar-hi', () => {
        expect(css).toMatch(/#channelPage \.ap-top\s*{[^}]*position:\s*absolute;[^}]*top:\s*var\(--ap-edge\)/);
        expect(css).toMatch(/#channelPage \.ap-hero\s*{[^}]*padding-top:\s*calc\(var\(--ap-edge\)/);
        expect(css).toMatch(
            /@media \(hover: hover\) and \(pointer: fine\)\s*{[^@]*#channelPage \.ap-card:hover[^{]*{[^}]*transform:\s*scale\(1\.04\)/
        );
    });

    it('el botó «YouTube» només accepta enllaços de canals de youtube.com', () => {
        expect(page.youtubeLink('https://www.youtube.com/@thetyets')).toBe('https://www.youtube.com/@thetyets');
        expect(page.youtubeLink('https://www.youtube.com/channel/UC--8TyZ2PM0NFHWXCzQrUqw')).toBe(
            'https://www.youtube.com/channel/UC--8TyZ2PM0NFHWXCzQrUqw'
        );
        expect(page.youtubeLink('javascript:alert(1)')).toBe('');
        expect(page.youtubeLink('https://example.com/@x')).toBe('');
        expect(page.youtubeLink('')).toBe('');
    });

    it('les icones de la fitxa no depenen de lucide (CDN) i el botó d’enrere és tàctil', () => {
        expect(channelPage).not.toContain('data-lucide');
        expect(css).toMatch(/#channelPage \.ap-top \.channel-back-btn[^{]*{[^}]*width:\s*44px;[^}]*height:\s*44px/);
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

describe('fitxa al mòbil: la capçalera i la #1 no surten de la pantalla (2026-10-18)', () => {
    it('la graella de dalt té una columna minmax(0, 1fr), no la implícita (auto)', () => {
        expect(css).toMatch(/#channelPage \.ap-head \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\);/);
    });

    it('al mòbil la #1 és un rectangle vertical (4:5), destacada sobre les altres (quadrades)', () => {
        expect(css).toMatch(
            /@media \(max-width: 768px\) \{\s*#channelPage \.ap-best \.ap-card \{\s*aspect-ratio: 4 \/ 5;/
        );
    });
});
