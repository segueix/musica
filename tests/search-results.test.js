import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadScript } from './setup.js';

// Cerca de Segueix Música: model (artistes primer, després cançons), coincidències sense soroll,
// HTML del menú i de la pàgina, i absència de l'herència de Segueix youtubers.

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const shared = loadScript('js/features/music-selection.js');
const selection = shared.SegueixApp.features.musicSelection;
const search = loadScript('js/features/search-results.js').SegueixApp.features.searchResults;

let counter = 0;
const song = (channelId, channelTitle, title, extra = {}) => {
    counter += 1;
    return {
        id: `v${String(counter).padStart(10, '0')}`,
        title,
        channelId,
        channelTitle,
        thumbnail: `t${counter}.jpg`,
        contentType: 'song',
        durationSeconds: 200,
        viewCount: 1000,
        publishedAt: '2025-01-01T00:00:00Z',
        description: '',
        ...extra,
    };
};

const channel = (id, name, extra = {}) => ({ id, name, avatar: `${id}.jpg`, categories: ['Pop'], ...extra });

const channels = [
    channel('c-judit', 'Judit Neddermann', { categories: ["Cançó d'autor"] }),
    channel('c-alfred', 'alfredgarcia', { artists: ['Alfred Garcia'], handle: '@alfredgarcia' }),
    channel('c-manel', 'Manel'),
    channel('c-guineu', 'GUINEU POP'),
    channel('c-topic', 'Judit Neddermann - Topic'),
];

const videos = [
    song('c-judit', 'Judit Neddermann', 'Mou-te', {
        description: 'Provided to YouTube by Virgin\n\nMou-te · Judit Neddermann · Momi Maiga\n\n℗ 2026',
        viewCount: 900,
    }),
    song('c-judit', 'Judit Neddermann', 'Els ocells', { viewCount: 5000 }),
    song('c-manel', 'Manel', 'Al·lèrgiques al pol·len'),
    song('c-manel', 'Manel', "L'ovella negra"),
    song('c-manel', 'Manel', 'Tipus suite', { description: 'Una peça de pop per a totes les ovelles' }),
    song('c-guineu', 'GUINEU POP', 'Sa Marina'),
    song('c-alfred', 'alfredgarcia', 'Si algun dia', { viewCount: 300 }),
    song('c-manel', 'Moustaki i Marina', 'Barca del temps'),
    song('c-manel', 'Manel', 'Entrevista completa', { contentType: 'interview' }),
    song('c-manel', 'Manel', 'Fragment curt', { isShort: true }),
];

const music = {
    isCategoryEligibleVideo: video => !video.contentType || ['song', 'live_song'].includes(video.contentType),
};

function model(query, extra = {}) {
    return search.buildModel(query, {
        channels,
        videos,
        isEligible: music.isCategoryEligibleVideo,
        artistKeyOf: id => (id === 'c-judit' || id === 'c-topic' ? 'wd:judit' : ''),
        primaryCategoryOf: id => (id === 'c-judit' ? "Cançó d'autor" : ''),
        ...extra,
    });
}

describe('text de la cerca', () => {
    it('ignora accents, majúscules, ela geminada, apòstrofs i guions', () => {
        expect(search.normalize('Al·lèrgiques  al POL·LEN!')).toBe('allergiques al pollen');
        expect(search.normalize("L'ovella Negra")).toBe('l ovella negra');
        expect(search.normalize('Mou-te')).toBe('mou te');
        expect(search.normalize('Ça va')).toBe('ca va');
    });

    it('una cerca de menys de 2 lletres no dona resultats', () => {
        expect(search.parseQuery('a').valid).toBe(false);
        expect(model('a').hasResults).toBe(false);
        expect(model('  ').hasResults).toBe(false);
    });

    it('les paraules han de ser senceres (l’última pot ser un principi): «mou te» no troba «Moustaki … temps»', () => {
        const query = search.parseQuery('mou te');
        expect(search.scoreField(search.normalize('Barca del temps Moustaki'), query)).toBe(0);
        expect(search.scoreField(search.normalize('Mou-te'), query)).toBe(1);
        // Mentre escrius: l'última paraula pot estar incompleta
        expect(
            search.scoreField(search.normalize('Els ocells de Judit'), search.parseQuery('ocells ju'))
        ).toBeGreaterThan(0);
    });

    it('la puntuació ordena: igual > comença > paraula sencera > principi de paraula > dins la paraula', () => {
        const q = search.parseQuery('pop');
        const s = text => search.scoreField(search.normalize(text), q);
        expect(s('Pop')).toBeGreaterThan(s('Pop Rock'));
        expect(s('Pop Rock')).toBeGreaterThan(s('Grup de Pop'));
        expect(s('Grup de Pop')).toBeGreaterThan(s('Veus Populars'));
        expect(s('Veus Populars')).toBeGreaterThan(0);
        expect(s('Rock i Roll')).toBe(0);
    });
});

describe('model: primer artistes, després cançons', () => {
    it('retorna artistes i cançons, cadascun al seu grup', () => {
        const result = model('judit');
        expect(result.artists.map(item => item.name)).toContain('Judit Neddermann');
        expect(result.songs.map(item => item.title)).toContain('Mou-te');
        expect(result.hasResults).toBe(true);
    });

    it('els canals oficial i «Topic» d’un mateix artista surten com un sol artista', () => {
        const result = model('judit');
        expect(result.artists).toHaveLength(1);
        expect(result.artists[0].channelIds.sort()).toEqual(['c-judit', 'c-topic']);
        // El canal principal és el que té cançons al feed
        expect(result.artists[0].id).toBe('c-judit');
        expect(result.artists[0].style).toBe("Cançó d'autor");
    });

    it('troba un artista pel nom de la base d’artistes i per l’identificador', () => {
        expect(model('alfred garcia').artists.map(item => item.id)).toEqual(['c-alfred']);
        expect(model('alfredgarcia').artists.map(item => item.id)).toEqual(['c-alfred']);
        // ...i les seves cançons, encara que el títol no contingui el nom
        expect(model('alfred garcia').songs.map(item => item.title)).toContain('Si algun dia');
    });

    it('les cançons d’un artista trobat hi són, per popularitat', () => {
        const titles = model('judit neddermann').songs.map(item => item.title);
        expect(titles).toEqual(['Els ocells', 'Mou-te']);
    });

    it('una cançó es troba pel títol exacte primer, i pels crèdits («col·laborador»)', () => {
        expect(model('mou-te').songs[0].title).toBe('Mou-te');
        expect(model('momi maiga').songs.map(item => item.title)).toEqual(['Mou-te']);
    });

    it('no coincideix per la descripció ni per les etiquetes (abans «pop» trobava tot)', () => {
        const titles = model('ovelles').songs.map(item => item.title);
        expect(titles).not.toContain('Tipus suite');
        const pop = model('pop');
        expect(pop.songs.map(item => item.title)).toContain('Sa Marina'); // canal «GUINEU POP»
        expect(pop.songs.map(item => item.title)).not.toContain('Tipus suite');
    });

    it('no inclou Shorts, entrevistes ni contingut estàtic', () => {
        const titles = model('manel').songs.map(item => item.title);
        expect(titles).not.toContain('Fragment curt');
        expect(titles).not.toContain('Entrevista completa');
        const stat = [...videos, { ...song('c-manel', 'Manel', 'Cançó estàtica'), source: 'static' }];
        expect(
            search
                .buildModel('manel', { channels, videos: stat, isEligible: music.isCategoryEligibleVideo })
                .songs.map(item => item.title)
        ).not.toContain('Cançó estàtica');
    });

    it('elimina duplicats de la mateixa gravació però no les versions diferents', () => {
        const dupes = [
            song('c-manel', 'Manel', 'Tipus suite (Videoclip Oficial)', { durationSeconds: 210, viewCount: 9 }),
            song('c-manel', 'Manel', 'Tipus suite - Lyric Video', { durationSeconds: 211, viewCount: 8 }),
            song('c-manel', 'Manel', 'Tipus suite (en directe)', { durationSeconds: 300, viewCount: 7 }),
        ];
        const keys = video => selection.titleKeys(video.title, video.channelId, video.durationSeconds);
        const result = search.buildModel('tipus suite', {
            channels,
            videos: dupes,
            recordingKeysOf: keys,
            sameRecording: selection.isSameRecording,
        });
        expect(result.songs.map(item => item.title)).toEqual([
            'Tipus suite (Videoclip Oficial)',
            'Tipus suite (en directe)',
        ]);
    });

    it('limita les cançons i marca la ràdio com a disponible amb 2 o més', () => {
        const many = Array.from({ length: 90 }, (_, index) =>
            song(`k${index}`, `Grup ${index}`, `Cançó rock ${index}`, { viewCount: index })
        );
        const big = search.buildModel('rock', { videos: many, channels: [] });
        expect(big.songs).toHaveLength(search.MAX_SONGS);
        expect(big.radio).toMatchObject({ available: true, count: search.MAX_SONGS });
        expect(model('els ocells').radio.available).toBe(false);
        expect(model('judit').radio.available).toBe(true);
    });

    it('ordre estable: puntuació, popularitat, actualitat', () => {
        const list = [
            song('x', 'Grup A', 'Nit blava', { viewCount: 10, publishedAt: '2020-01-01T00:00:00Z' }),
            song('x', 'Grup B', 'Nit blava tour', { viewCount: 500 }),
            song('x', 'Grup C', 'Blava nit', { viewCount: 500, publishedAt: '2024-01-01T00:00:00Z' }),
        ];
        const titles = search.buildModel('nit blava', { videos: list, channels: [] }).songs.map(item => item.title);
        expect(titles).toEqual(['Nit blava', 'Nit blava tour', 'Blava nit']);
    });
});

describe('HTML del menú i de la pàgina', () => {
    it('el menú posa primer la ràdio, després els artistes i després els vídeos', () => {
        const html = search.dropdownHtml(model('judit'));
        const at = text => html.indexOf(text);
        expect(at('data-result-type="radio"')).toBeGreaterThan(-1);
        expect(at('data-result-type="radio"')).toBeLessThan(at('data-result-type="artist"'));
        expect(at('data-result-type="artist"')).toBeLessThan(at('data-result-type="video"'));
        expect(html).toContain('Genera una ràdio amb aquests resultats');
        expect(html).toContain('<h4>Artistes</h4>');
        expect(html).toContain('<h4>Vídeos</h4>');
    });

    it('la pàgina posa la ràdio a dalt de tot, després Artistes i després Vídeos', () => {
        const html = search.pageHtml(model('judit'), {
            cardHtml: video => `<div class="video-card" data-video-id="${video.id}"></div>`,
        });
        const at = text => html.indexOf(text);
        expect(at('data-search-radio')).toBeGreaterThan(-1);
        expect(at('data-search-radio')).toBeLessThan(at('>Artistes<'));
        expect(at('>Artistes<')).toBeLessThan(at('>Vídeos<'));
        expect(html).toContain('data-follow-channel="c-judit"');
        expect((html.match(/class="video-card"/g) || []).length).toBe(model('judit').songs.length);
    });

    it('sense ràdio possible (menys de 2 cançons) no hi ha botó de ràdio', () => {
        expect(search.pageHtml(model('els ocells'))).not.toContain('data-search-radio');
        expect(search.dropdownHtml(model('els ocells'))).not.toContain('data-result-type="radio"');
    });

    it('«Veure tots els resultats» només hi és si el menú n’amaga', () => {
        expect(search.dropdownHtml(model('mou-te'))).not.toContain('data-result-type="all"');
        const many = Array.from({ length: 20 }, (_, index) =>
            song(`k${index}`, `Grup ${index}`, `Cançó rock ${index}`)
        );
        expect(search.dropdownHtml(search.buildModel('rock', { videos: many, channels: [] }))).toContain(
            'data-result-type="all"'
        );
    });

    it('escapa la cerca i els noms', () => {
        const evil = search.buildModel('<img src=x onerror=alert(1)>', { videos: [], channels: [] });
        const html = search.pageHtml(evil);
        expect(html).not.toContain('<img src=x');
        expect(html).toContain('&lt;img');
        const list = [song('c1', 'A <b>B</b>', 'Títol "cita" & més')];
        const dropdown = search.dropdownHtml(search.buildModel('titol cita', { videos: list, channels: [] }));
        expect(dropdown).toContain('A &lt;b&gt;B&lt;/b&gt;');
        expect(dropdown).toContain('Títol &quot;cita&quot; &amp; més');
    });

    it('sense resultats explica què cal provar', () => {
        const html = search.pageHtml(model('zzzzzz'));
        expect(html).toContain('No hem trobat cap artista ni cançó per «zzzzzz»');
        expect(search.dropdownHtml(model('zzzzzz'))).toContain('No hem trobat cap artista ni cançó');
    });
});

describe('sense herència de Segueix youtubers', () => {
    const app = read('js/app.js');
    const results = read('js/features/search-results.js');
    const styles = read('css/styles.css');

    it('el mòdul de cerca no parla de programes, històric ni vistos, i la interfície diu «Artistes», no «Canals»', () => {
        for (const word of ['Històric', 'Ja vistos', 'youtuber', 'Programa'])
            expect(results.toLowerCase()).not.toContain(word.toLowerCase());
        const html = `${search.dropdownHtml(model('judit'))}${search.pageHtml(model('judit'))}`;
        for (const word of ['Canals', 'Canal', 'Subscriptors', 'subscriptors', 'Històric', 'Mitjans'])
            expect(html).not.toContain(word);
    });

    it('app.js ja no té la cerca de l’API, la de l’arxiu a la interfície ni les accions de categoria', () => {
        for (const name of [
            'renderSearchCategoryActions',
            'searchVideosLegacyImpl',
            'fetchVideoDetails',
            'renderSearchResults(',
            'toggle-search-category',
            'search-info',
        ])
            expect(app).not.toContain(name);
        expect(styles).not.toContain('.search-info-');
    });

    it('la pàgina de resultats no acumula un listener per cerca a #videosGrid', () => {
        const start = app.indexOf('async function navigateToSearchResults');
        const end = app.indexOf("// Renderitzar vídeos de l'API", start);
        const block = app.slice(start, end);
        expect(block).not.toMatch(/videosGrid\.addEventListener/);
        expect(block).toContain('bindSearchResults(container)');
    });

    it('la cerca ja no espera cap índex d’arxiu: el menú s’omple de manera síncrona', () => {
        const start = app.indexOf("searchInput.addEventListener('input'");
        const block = app.slice(start, app.indexOf("searchInput.addEventListener('keydown'", start));
        expect(block).not.toContain('performDualSearch');
        expect(block).toContain('buildSearchModel(query)');
    });
});
