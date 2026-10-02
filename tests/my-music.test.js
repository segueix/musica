import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadScript } from './setup.js';

// «La teva música»: historial (tres últimes cançons + expansió per dates), artistes seguits i llistes.
// Sense categories intel·ligents ni programes.

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const mm = loadScript('js/features/my-music.js').SegueixApp.features.myMusic;

const MIN = 60000;
const HOUR = 3600000;
const DAY = 86400000;
// 30/09/2026 15:00 (hora local): els «ahir», «fa 3 dies»… es calculen per dies de calendari
const NOW = new Date(2026, 8, 30, 15, 0, 0).getTime();
const at = (daysAgo, hour = 12) => new Date(2026, 8, 30 - daysAgo, hour, 0, 0).toISOString();

let counter = 0;
const song = (viewedAt, extra = {}) => {
    counter += 1;
    return {
        id: `h${String(counter).padStart(10, '0')}`,
        title: `Cançó ${counter}`,
        channelId: 'c1',
        channelTitle: 'Artista',
        thumbnail: `t${counter}.jpg`,
        viewedAt,
        ...extra,
    };
};

describe('quan s’ha escoltat', () => {
    it('ara mateix, minuts i hores el mateix dia', () => {
        expect(mm.formatWhen(NOW - 20000, NOW)).toBe('Ara mateix');
        expect(mm.formatWhen(NOW - 12 * MIN, NOW)).toBe('Fa 12 min');
        expect(mm.formatWhen(NOW - 3 * HOUR, NOW)).toBe('Fa 3 h');
        expect(mm.formatWhen(NOW + 5 * MIN, NOW)).toBe('Ara mateix');
    });

    it('ahir (per dia de calendari, encara que faci menys de 24 h), fa N dies i la data', () => {
        expect(mm.formatWhen(new Date(2026, 8, 29, 23, 0).getTime(), NOW)).toBe('Ahir');
        expect(mm.formatWhen(new Date(2026, 8, 27, 10, 0).getTime(), NOW)).toBe('Fa 3 dies');
        expect(mm.formatWhen(new Date(2026, 8, 20, 10, 0).getTime(), NOW)).toBe('20 de setembre');
    });

    it('la data porta l’any si no és l’actual i usa «d’» davant vocal', () => {
        expect(mm.formatWhen(new Date(2026, 3, 4, 10, 0).getTime(), NOW)).toBe('4 d’abril');
        expect(mm.formatWhen(new Date(2025, 11, 25, 10, 0).getTime(), NOW)).toBe('25 de desembre de 2025');
        expect(mm.formatWhen(new Date(2025, 7, 1, 10, 0).getTime(), NOW)).toBe('1 d’agost de 2025');
    });

    it('sense data no diu res', () => {
        expect(mm.formatWhen(NaN, NOW)).toBe('');
        expect(mm.formatWhen(0, NOW)).toBe('');
    });

    it('capçaleres de dia: Avui, Ahir, el dia de la setmana i la data', () => {
        expect(mm.dayLabel(NOW - HOUR, NOW)).toBe('Avui');
        expect(mm.dayLabel(new Date(2026, 8, 29, 9, 0).getTime(), NOW)).toBe('Ahir');
        expect(mm.dayLabel(new Date(2026, 8, 27, 9, 0).getTime(), NOW)).toBe('diumenge');
        expect(mm.dayLabel(new Date(2026, 8, 28, 9, 0).getTime(), NOW)).toBe('dilluns');
        expect(mm.dayLabel(new Date(2026, 8, 10, 9, 0).getTime(), NOW)).toBe('10 de setembre');
    });
});

describe('model de l’historial', () => {
    const history = [
        song(at(0, 14)),
        song(at(0, 9)),
        song(at(1)),
        song(at(3)),
        song(at(6)),
        song(at(12)),
        song(at(25)),
        song(at(50)),
        song(at(100)),
        song(at(400)),
    ];

    it('les cançons surten de la més recent a la més antiga encara que l’historial no vingui ordenat', () => {
        const shuffled = [history[5], history[0], history[9], history[2]];
        expect(mm.songsOf(shuffled).map(s => s.id)).toEqual([
            history[0].id,
            history[2].id,
            history[5].id,
            history[9].id,
        ]);
    });

    it('no compta Shorts ni repetits i posa al final el que no té data', () => {
        const undated = song('');
        const short = song(at(0), { isShort: true });
        const list = mm.songsOf([undated, short, history[1], history[1]]);
        expect(list.map(s => s.id)).toEqual([history[1].id, undated.id]);
    });

    it('les tres últimes cançons porten quan s’han escoltat', () => {
        const model = mm.buildHistoryModel(history, { now: NOW });
        expect(model.latest).toHaveLength(3);
        expect(model.latest.map(s => s.id)).toEqual(history.slice(0, 3).map(s => s.id));
        expect(model.latest.map(s => s.when)).toEqual(['Fa 1 h', 'Fa 6 h', 'Ahir']);
        expect(model.hasMore).toBe(true);
        expect(model.total).toBe(10);
    });

    it('els períodes només hi són si afegeixen cançons, i comptem bé', () => {
        const model = mm.buildHistoryModel(history, { now: NOW, expanded: true });
        expect(model.ranges.map(r => [r.id, r.count])).toEqual([
            ['week', 5],
            ['month', 7],
            ['quarter', 8],
            ['all', 10],
        ]);
        const few = mm.buildHistoryModel([history[0], history[1], history[2], history[3], history[7]], { now: NOW });
        // La setmana en té 4 i el mes també (la resta és de fa 50 dies): el mes no afegeix res i no es mostra;
        // «Tot l'historial» tampoc afegeix res respecte dels 3 mesos
        expect(few.ranges.map(r => r.id)).toEqual(['week', 'quarter']);
    });

    it('per defecte s’obre el primer període amb cançons i es pot triar un de més ample', () => {
        const old = [song(at(40)), song(at(41)), song(at(42)), song(at(80))];
        const model = mm.buildHistoryModel(old, { now: NOW, expanded: true });
        expect(model.range).toBe('quarter');
        expect(mm.buildHistoryModel(history, { now: NOW, expanded: true }).range).toBe('week');
        const month = mm.buildHistoryModel(history, { now: NOW, expanded: true, range: 'month' });
        expect(month.rows).toHaveLength(7);
        const all = mm.buildHistoryModel(history, { now: NOW, expanded: true, range: 'all' });
        expect(all.rows).toHaveLength(10);
    });

    it('amb tres cançons o menys no hi ha res per expandir', () => {
        const model = mm.buildHistoryModel(history.slice(0, 3), { now: NOW, expanded: true });
        expect(model.hasMore).toBe(false);
        expect(model.expanded).toBe(false);
    });

    it('la llista expandida té un màxim i avisa de les que falten', () => {
        const many = Array.from({ length: 80 }, (_, i) => song(at(0, 14) && new Date(NOW - i * MIN).toISOString()));
        const model = mm.buildHistoryModel(many, { now: NOW, expanded: true, range: 'all' });
        expect(model.rows).toHaveLength(mm.MAX_LIST);
        expect(model.hidden).toBe(80 - mm.MAX_LIST);
    });
});

describe('HTML de l’historial', () => {
    const songs = Array.from({ length: 6 }, (_, i) => song(at(i, 13)));

    it('tres targetes de costat i, al final, el símbol d’expandir (accessible, sense text visible)', () => {
        const html = mm.historyHtml(mm.buildHistoryModel(songs, { now: NOW }));
        expect((html.match(/class="mm-card"/g) || []).length).toBe(3);
        expect(html.indexOf('mm-expand')).toBeGreaterThan(html.lastIndexOf('class="mm-card"'));
        const button = html.match(/<button[^>]*data-mm-expand[^>]*>([\s\S]*?)<\/button>/);
        expect(button[0]).toContain('aria-expanded="false"');
        expect(button[0]).toContain('aria-label="Mostra més de l’historial"');
        expect(button[1].replace(/<svg[\s\S]*<\/svg>/, '').trim()).toBe('');
        expect(html).toContain('mm-card__when');
    });

    it('expandit: períodes clicables, cançons agrupades per dia i accés a tot l’historial', () => {
        const html = mm.historyHtml(mm.buildHistoryModel(songs, { now: NOW, expanded: true }));
        expect(html).toContain('aria-expanded="true"');
        expect(html).toContain('data-mm-range="week"');
        expect(html).toContain('aria-pressed="true"');
        expect(html).toContain('>Avui<');
        expect(html).toContain('>Ahir<');
        expect(html).toContain('data-mm-open-history');
        expect(html).toContain('Obre tot l’historial');
    });

    it('no surt el símbol si no hi ha res més a mostrar, i sense historial hi ha un missatge', () => {
        expect(mm.historyHtml(mm.buildHistoryModel(songs.slice(0, 3), { now: NOW }))).not.toContain('data-mm-expand');
        const empty = mm.historyHtml(mm.buildHistoryModel([], { now: NOW }));
        expect(empty).toContain('Encara no has escoltat cap cançó');
        expect(empty).not.toContain('mm-card');
    });

    it('escapa els títols i els artistes', () => {
        const html = mm.historyHtml(
            mm.buildHistoryModel([song(at(0), { title: '<b>"Nit"</b> & dia', channelTitle: 'A <i>B</i>' })], {
                now: NOW,
            })
        );
        expect(html).not.toContain('<b>');
        expect(html).toContain('&lt;b&gt;&quot;Nit&quot;&lt;/b&gt; &amp; dia');
        expect(html).toContain('A &lt;i&gt;B&lt;/i&gt;');
    });
});

describe('artistes: només els que se segueixen', () => {
    const channels = [
        { id: 'a', name: 'Zebra', avatar: 'z.jpg' },
        { id: 'b', name: 'àlbum blau', avatar: 'b.jpg' },
        { id: 'c', name: 'Manel', avatar: 'm.jpg' },
        { id: 'd', name: 'No seguit' },
    ];

    it('només surten els seguits, per ordre alfabètic, sense repetits ni canals desconeguts', () => {
        const model = mm.buildArtistsModel(channels, ['c', 'a', 'b', 'a', 'fantasma']);
        expect(model.artists.map(a => a.id)).toEqual(['b', 'c', 'a']);
        expect(model.artists.some(a => a.id === 'd')).toBe(false);
    });

    it('un artista agrupat surt una sola vegada encara que el canal seguit sigui el Topic', () => {
        const grouped = [
            { id: 'official', name: 'Artista', avatar: 'a.jpg', channelIds: ['official', 'topic'] },
            { id: 'solo', name: 'Solista', avatar: 's.jpg', channelIds: ['solo'] },
        ];
        const model = mm.buildArtistsModel(grouped, ['topic', 'solo']);
        expect(model.artists.map(a => a.id)).toEqual(['official', 'solo']);
        expect(model.followed).toBe(2);
    });

    it('la secció és «Artistes», sense programes, i cada artista obre el seu perfil', () => {
        const html = mm.artistsHtml(mm.buildArtistsModel(channels, ['a', 'c']));
        expect(html).toContain('>Artistes<');
        expect(html).toContain('data-mm-artist="a"');
        expect(html).toContain('data-mm-artist="c"');
        expect(html).not.toContain('data-mm-artist="d"');
        expect(html).not.toMatch(/rograma/);
    });

    it('sense artistes seguits convida a descobrir-ne', () => {
        const html = mm.artistsHtml(mm.buildArtistsModel(channels, []));
        expect(html).toContain('Encara no segueixes cap artista');
        expect(html).toContain('data-mm-all-artists');
        expect(html).toContain('Descobreix artistes');
    });
});

describe('la pàgina: historial, artistes i llistes (i res més)', () => {
    const html = read('index.html');
    const app = read('js/app.js');
    const page = html.slice(html.indexOf('id="playlistsPage"'), html.indexOf('id="followPage"'));

    it('l’ordre és Historial i Artistes (my-music) i, a sota, les llistes de reproducció', () => {
        expect(page.indexOf('id="myMusic"')).toBeGreaterThan(-1);
        expect(page.indexOf('id="myMusic"')).toBeLessThan(page.indexOf('id="myMusicPlaylists"'));
        expect(page).toContain('Llistes de reproducció');
        expect(page).toContain('id="playlistsList"');
        expect(page).toContain('id="createPlaylistBtn"');
    });

    it('ja no hi ha pestanyes, categories intel·ligents ni enllaços a part', () => {
        expect(page).not.toContain('libraryTabs');
        expect(page).not.toContain('library-tab');
        expect(page).not.toMatch(/ntel·ligent/);
        expect(page).not.toContain('smartCategoriesList');
        expect(page).not.toContain('pt-page-links');
    });

    it('Artistes no té la pestanya Programes ni el modal de crear-ne', () => {
        const follow = html.slice(html.indexOf('id="followPage"'), html.indexOf('id="short-modal"'));
        expect(follow).toContain('data-follow-tab="all"');
        expect(follow).toContain('data-follow-tab="following"');
        expect(follow).not.toMatch(/rograme/);
        expect(html).not.toContain('createProgramModal');
        expect(html).not.toContain('programCreatorSearch');
    });

    it('el codi no conserva les categories intel·ligents ni la pestanya de programes', () => {
        for (const name of [
            'renderSmartCategoriesTab',
            'setActiveLibraryTab',
            'isExactCategory',
            'markExactCategory',
            'isQuotedChannelQuery',
            'renderProgramesTab',
            'openCreateProgramModal',
            'initCreateProgramModal',
        ])
            expect(app).not.toContain(name);
        expect(read('js/utils/storage.js')).not.toContain('EXACT_CATEGORIES_STORAGE_KEY');
    });

    it('una pestanya desada de «programes» torna a «tots»', () => {
        expect(app).toContain("const FOLLOW_TABS = ['all', 'following'];");
        expect(app).toContain("activeFollowTab = FOLLOW_TABS.includes(tabId) ? tabId : 'all';");
    });

    it('my-music.js es carrega abans d’app.js i es precacheja', () => {
        expect(html.indexOf('js/features/my-music.js')).toBeGreaterThan(-1);
        expect(html.indexOf('js/features/my-music.js')).toBeLessThan(html.indexOf('js/app.js'));
        expect(read('sw.js')).toContain("'./js/features/my-music.js'");
    });

    it('en mostrar la pàgina es pinta el que és nou i les llistes (hook renderMyMusic)', () => {
        expect(read('js/features/navigation.js')).toContain('runtime.hooks.renderMyMusic?.()');
        expect(app).toContain('renderMyMusic,');
        expect(app).toMatch(
            /function renderMyMusic\(\) \{\s*SegueixApp\.features\.myMusic\?\.render\?\.\(\);\s*renderPlaylistsPage\(\);/
        );
    });
});
