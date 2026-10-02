import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadScript } from './setup.js';

// Títols de cançó nets: sense el nom de l'artista i sense cap referència a «videoclip», «vídeo» o «oficial».

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const loaded = loadScript('js/song-title.js');
const titles = loaded.SegueixSongTitle;
const clean = (title, ...artists) => titles.cleanTitle(title, { artists });

describe('referències a videoclip, vídeo i oficial', () => {
    it.each([
        ['Celobert - Ulls bruns (Videoclip oficial)', 'Celobert', 'Ulls bruns'],
        ['Al·lèrgiques al Pol·len - PPP (Videoclip Oficial)', 'Al·lèrgiques al pol·len', 'PPP'],
        ['Suu -  No eres tan especial (Videolyric Oficial)', 'Suu', 'No eres tan especial'],
        ['Ouineta - DMs (Official Video)', 'Ouineta', 'DMs'],
        ['Renaldo & Clara - Globus [videoclip oficial]', 'Renaldo & Clara', 'Globus'],
        ['CRIM - Ésser de Llum (VideoLyric)', 'Crim', 'Ésser de Llum'],
        ['Triquell - NPC (Lyric Video)', 'Triquell', 'NPC'],
        ['Maig - És prohibida (Audio - Lyric video)', 'Maig', 'És prohibida'],
        ['Julieta - En mi coche (Audio Oficial)', 'Julieta', 'En mi coche'],
        ['OKDW - Brama [Official Audio]', 'okdw', 'Brama'],
        ['Manel - Amb un ram de clamídies al Teatre Grec (oficial)', 'Manel', 'Amb un ram de clamídies al Teatre Grec'],
        ['Mushkaa - habibi (Videoclip)', 'Mushkaa', 'habibi'],
        ['Sexenni - Klk quieren las chicas ( [videoclip oficial] )', 'Sexenni', 'Klk quieren las chicas'],
        [
            'SMOKING SOULS - Adéu feat. MAFALDA (lyricvideo) Translúcid, 2019',
            'Smoking Souls',
            'Adéu feat. MAFALDA Translúcid, 2019',
        ],
    ])('%s', (title, artist, expected) => {
        expect(clean(title, artist)).toBe(expected);
    });

    it('treu el final «| Official Music Video», «- Official Video» i «videoclip oficial» sense claudàtors', () => {
        expect(clean('La Fúmiga - LA PENÚLTIMA | Official Music Video', 'La Fúmiga')).toBe('LA PENÚLTIMA');
        expect(clean('Nova cançó - Official Video', 'Altres')).toBe('Nova cançó');
        expect(clean('Tipus suite videoclip oficial', 'Manel')).toBe('Tipus suite');
        expect(clean('VIDEOCLIP | Títol', 'X')).toBe('Títol');
    });

    it('treu un fragment de soroll enmig («… | VIDEOCLIP | EP …»)', () => {
        expect(
            clean('LA FÚMIGA - Cap. 2: HAVIA DE PASSAR feat. The Tyets | VIDEOCLIP | EP Pròxima Parada', 'La Fúmiga')
        ).toBe('Cap. 2: HAVIA DE PASSAR feat. The Tyets | EP Pròxima Parada');
    });

    it('no toca res més: paraules soltes enmig d’una frase, versions, any i convidats', () => {
        expect(clean('Video Killed the Radio Star', 'Buggles')).toBe('Video Killed the Radio Star');
        expect(clean('Un oficial i un cavaller', 'Altres')).toBe('Un oficial i un cavaller');
        expect(clean('Nit d’estiu (en directe) (2019)', 'Manel')).toBe('Nit d’estiu (en directe) (2019)');
        expect(clean('Sa Madona (Featuring Tarta Relena)', 'Júlia Colom')).toBe('Sa Madona (Featuring Tarta Relena)');
        expect(clean('Per cada u (Audio)', 'Mar Pujol')).toBe('Per cada u (Audio)');
    });

    it('si el títol només és soroll es conserva (mai queda buit)', () => {
        expect(clean('(Videoclip oficial)', 'X')).toBe('(Videoclip oficial)');
        expect(clean('Manel - (Videoclip)', 'Manel')).toBe('Manel');
        expect(clean('', 'X')).toBe('');
    });
});

describe('nom de l’artista', () => {
    it('al davant: «Artista - Cançó» i amb convidats', () => {
        expect(clean('Derbi Junior - El vi que alimenta', 'Derbi Junior')).toBe('El vi que alimenta');
        expect(
            clean('Sara Roy, Judit Neddermann, Pau Figueres  - L’error més bonic (Lyric Video)', 'Judit Neddermann')
        ).toBe('L’error més bonic');
        expect(
            clean(
                'Marina Rossell, Lluís Llach and Maria del Mar Bonet - Cant de l’enyor (Camp Nou, 1985)',
                'Marina Rossell'
            )
        ).toBe('Cant de l’enyor (Camp Nou, 1985)');
        expect(
            clean('Sopa de Cabra +Judit Nethermann+Mishima - Podré tornar enrere (Palau, 2022)', 'Sopa de Cabra')
        ).toBe('Podré tornar enrere (Palau, 2022)');
    });

    it('al final: «Cançó - Artista» i «Cançó - Artista (2026)»', () => {
        expect(clean('JUDIT - JOAN DAUSÀ', 'Joan Dausà')).toBe('JUDIT');
        expect(clean('Seguirament t’estimo - Els Amics de les Arts (2026)', 'Els Amics de les Arts')).toBe(
            'Seguirament t’estimo (2026)'
        );
        expect(clean('SANT HILARI - FLASHY ICE CREAM', 'Flashy Ice Cream')).toBe('SANT HILARI');
        expect(clean('Diumenge - Dan Peralbo i El Comboi (Videoclip Oficial)', 'Dan Peralbo i El Comboi')).toBe(
            'Diumenge'
        );
    });

    it('amb dos punts, barra, punt volat o el títol entre cometes', () => {
        expect(clean('Georges Moustaki + Marina Rossell: Rodamón (Palau, 2007)', 'Marina Rossell')).toBe(
            'Rodamón (Palau, 2007)'
        );
        expect(clean('SODI · HAVIA DE SER AIXÍ · (Full Album)', 'SODI')).toBe('HAVIA DE SER AIXÍ · (Full Album)');
        expect(clean('Anna Ferrer "Los panes los hijos" [Official Video]', 'Anna Ferrer')).toBe('Los panes los hijos');
        expect(clean('Júlia Colom “T’he cercat” [Official Audio]', 'Júlia Colom')).toBe('T’he cercat');
        expect(clean('Júlia Colom "Sa Madona" (Featuring Tarta Relena) [Official Audio]', 'Júlia Colom')).toBe(
            'Sa Madona (Featuring Tarta Relena)'
        );
    });

    it('«Artista 1991 - Cançó» (artista amb l’any) també perd l’artista', () => {
        expect(clean('Kitsch 1991 - Oració (Manel Huerga)', 'Kitsch')).toBe('Oració (Manel Huerga)');
        // ...però una versió («Live») o text descriptiu amb l'any no és un crèdit
        expect(clean('Kitsch 2008 Live - Autoviolació a l’Insomni Festival', 'Kitsch')).toBe(
            'Kitsch 2008 Live - Autoviolació a l’Insomni Festival'
        );
    });

    it('reconeix el nom escrit junt, amb accents o en un altre ordre de majúscules', () => {
        expect(
            clean(
                'Alfred García, Albert Pla, Judit Farrés - Si Algún Día (Lyric Video)',
                'alfredgarcia',
                'Alfred Garcia'
            )
        ).toBe('Si Algún Día');
        expect(clean('SVETLANA - Felixità (Àudio Oficial)', 'Svetlana')).toBe('Felixità');
        expect(clean('31 FAM - Unplugged (al Palau de la Música)', '31 FAM')).toBe('Unplugged (al Palau de la Música)');
    });

    it('els canals «Topic» i «VEVO» compten com l’artista', () => {
        expect(clean('Manel - Tipus suite', 'Manel - Topic')).toBe('Tipus suite');
        expect(clean('Manel - Tipus suite', 'ManelVEVO')).toBe('Tipus suite');
        // «Utopic» no és un canal «Topic»
        expect(clean('Utopic - Cançó', 'Utopic')).toBe('Cançó');
    });

    it('si l’artista és el títol (o el títol és un altre nom) no es treu res important', () => {
        expect(clean('Manel - Manel', 'Manel')).toBe('Manel');
        expect(clean('Mou-te', 'Judit Neddermann')).toBe('Mou-te');
        expect(clean('Nit d’estiu - Altre grup', 'Manel')).toBe('Nit d’estiu - Altre grup');
    });

    it('no confon crèdits amb text descriptiu, versions o esdeveniments', () => {
        // «dirigit per X» no és un crèdit; «Live» fa que sigui una versió; una data/any és descripció
        expect(
            clean('Pablo Maestres & Ferran Palau - PLORA AQUÍ | Escrit i dirigit per Pablo Maestres', 'Ferran Palau')
        ).toBe('PLORA AQUÍ | Escrit i dirigit per Pablo Maestres');
        expect(clean('Nit d’estiu - Manel Live', 'Manel')).toBe('Nit d’estiu - Manel Live');
        expect(clean('Xavier de Bétera a la Fira Mediterrània 2017 - SABA!', 'Xavier de Bétera')).toBe(
            'Xavier de Bétera a la Fira Mediterrània 2017 - SABA!'
        );
        expect(clean('6. Imperio - Mushkaa (Visualizer) | SexySensible', 'Mushkaa')).toBe(
            '6. Imperio - Mushkaa (Visualizer) | SexySensible'
        );
        expect(clean('La iaia de la mar (La Maria Rubio) - L’Assumpció 2023', 'La Maria')).toBe(
            'La iaia de la mar (La Maria Rubio) - L’Assumpció 2023'
        );
        expect(clean('PAU VALLVÉ @ Barcelona (07/03/2025)', 'Pau Vallvé')).toBe('PAU VALLVÉ @ Barcelona (07/03/2025)');
    });

    it('un convidat amb «ft.» després de l’artista surt amb el crèdit', () => {
        expect(clean('LA GAVINA (MAMBO REMIX) - 31FAM ft. Magalí Sare [Visualizer]', '31 FAM')).toBe(
            'LA GAVINA (MAMBO REMIX) [Visualizer]'
        );
    });
});

describe('cleanVideo', () => {
    const video = {
        id: 'abc',
        title: 'Celobert - Ulls bruns (Videoclip oficial)',
        channelId: 'c1',
        channelTitle: 'Celobert',
    };

    it('posa el títol net i guarda l’original sense tocar l’objecte d’entrada', () => {
        const result = titles.cleanVideo(video);
        expect(result.title).toBe('Ulls bruns');
        expect(result.originalTitle).toBe('Celobert - Ulls bruns (Videoclip oficial)');
        expect(video.title).toBe('Celobert - Ulls bruns (Videoclip oficial)');
        expect(result.id).toBe('abc');
    });

    it('és idempotent i retorna el mateix objecte si no hi ha res a canviar', () => {
        const once = titles.cleanVideo(video);
        expect(titles.cleanVideo(once)).toBe(once);
        const plain = { id: 'x', title: 'Mou-te', channelTitle: 'Judit Neddermann' };
        expect(titles.cleanVideo(plain)).toBe(plain);
        expect(titles.cleanVideo(null)).toBe(null);
    });

    it('fa servir els altres noms de l’artista (base d’artistes) i el canal de la instantània', () => {
        const alias = { id: 'y', title: 'Alfred García - Contigo (Lyric Video)', channelTitle: 'alfredgarcia' };
        expect(titles.cleanVideo(alias, ['Alfred Garcia']).title).toBe('Contigo');
        const snapshot = { id: 'z', title: 'Manel - Tipus suite', snippet: { channelTitle: 'Manel' } };
        expect(titles.cleanVideo(snapshot).title).toBe('Tipus suite');
    });
});

describe('sobre el feed real', () => {
    const feed = JSON.parse(read('data/feed.json'));
    const base = JSON.parse(read('data/artistes-musica.json')).artists;
    const namesByChannel = new Map();
    base.forEach(artist =>
        (artist.youtube?.channels || []).forEach(channel =>
            namesByChannel.set(String(channel.id), [artist.name, ...(artist.aliases || [])])
        )
    );
    const namesOf = video => {
        const channel = feed.channels[video.channelId] || {};
        return [
            video.channelTitle,
            channel.name,
            ...(channel.artists || []),
            ...(namesByChannel.get(String(video.channelId)) || []),
        ];
    };
    const results = feed.videos.map(video => ({
        video,
        cleaned: titles.cleanTitle(video.title, { artists: namesOf(video) }),
    }));

    it('cap títol queda buit ni més llarg que l’original', () => {
        expect(results.filter(({ cleaned }) => !cleaned.trim())).toHaveLength(0);
        expect(results.filter(({ video, cleaned }) => cleaned.length > video.title.trim().length)).toHaveLength(0);
    });

    it('és idempotent a tot el feed', () => {
        const again = results.filter(
            ({ video, cleaned }) => titles.cleanTitle(cleaned, { artists: namesOf(video) }) !== cleaned
        );
        expect(again.map(({ video }) => video.title)).toEqual([]);
    });

    it('no queda cap parèntesi ni claudàtor amb «videoclip», «vídeo» o «oficial»', () => {
        const left = results.filter(({ cleaned }) =>
            /[([{][^()[\]{}]*(video|vídeo|oficial|official)[^()[\]{}]*[)\]}]/i.test(cleaned)
        );
        expect(left.map(({ cleaned }) => cleaned)).toEqual([]);
    });

    it('els títols típics perden l’artista i la marca: «Artista - Cançó (Videoclip Oficial)» → «Cançó»', () => {
        const typical = results.filter(
            ({ video }) =>
                /^.+ - .+\((videoclip )?oficial\)$/i.test(video.title.trim()) ||
                /\(Videoclip Oficial\)/i.test(video.title)
        );
        expect(typical.length).toBeGreaterThan(100);
        const dirty = typical.filter(({ cleaned }) => /videoclip|oficial/i.test(cleaned));
        expect(dirty).toHaveLength(0);
        // I a la gran majoria se'n va també l'artista del davant
        const withArtist = typical.filter(({ video, cleaned }) => {
            const artist = titles.words(video.channelTitle).join(' ');
            return artist.length >= 4 && titles.words(cleaned).join(' ').startsWith(`${artist} `);
        });
        expect(withArtist.length / typical.length).toBeLessThan(0.03);
    });

    it('canvia una part important del feed i la resta queda igual', () => {
        // Les pistes dels canals Tema («Provided to YouTube») ja tenen el títol net: no compten.
        const own = results.filter(({ video }) => !/^provided to youtube/i.test(String(video.description || '')));
        const changed = own.filter(({ video, cleaned }) => cleaned !== video.title).length;
        expect(changed).toBeGreaterThan(own.length * 0.3);
        expect(changed).toBeLessThan(own.length * 0.7);
    });
});

describe('integració: feed, historial, llistes i m’agrades', () => {
    const music = loadScript('js/music-categories.js', { SegueixSongTitle: titles });
    const api = music.SegueixMusicCategories;

    it('decorateVideo neteja el títol del feed i conserva les categories', () => {
        const decorated = api.decorateVideo(
            {
                id: 'a',
                title: 'Manel - Tipus suite (Videoclip Oficial)',
                channelId: 'c',
                channelTitle: 'Manel',
                categories: ['Pop'],
            },
            ['Manel']
        );
        expect(decorated.title).toBe('Tipus suite');
        expect(decorated.originalTitle).toBe('Manel - Tipus suite (Videoclip Oficial)');
        expect(decorated.categories).toEqual(['Pop']);
    });

    it('cleanVideoTitle usa els noms del canal que li passen (p. ex. els del feed)', () => {
        const video = {
            id: 'b',
            title: 'Alfred García - Contigo (Lyric Video)',
            channelId: 'c',
            channelTitle: 'alfredgarcia',
        };
        expect(api.cleanVideoTitle(video, ['Alfred Garcia']).title).toBe('Contigo');
        expect(api.cleanVideoTitle(video).title).toBe('Contigo');
    });

    it('sense el netejador carregat no canvia res (el títol original es manté)', () => {
        const bare = loadScript('js/music-categories.js').SegueixMusicCategories;
        const video = { id: 'c', title: 'Manel - Tipus suite (Videoclip Oficial)', channelTitle: 'Manel' };
        expect(bare.cleanVideoTitle(video)).toBe(video);
    });

    it('la lectura de l’historial, de les llistes i dels m’agrades neteja els títols desats', () => {
        expect(read('js/app.js')).toMatch(/cleanVideoTitle\?\.\(video\) \|\| video[\s\S]{0,120}_historyItemsCache = /);
        expect(read('js/features/library.js')).toContain('cleanVideoTitle');
        expect(read('js/features/likes.js')).toContain('cleanVideoTitle');
    });

    it('el feed (i el seu snapshot) es neteja amb els noms del canal, i el netejador es carrega abans', () => {
        const youtube = read('js/youtube.js');
        expect(youtube).toContain('decorateVideo?.(video, this.artistNamesOf(');
        expect(youtube).toContain('cleanVideoTitle?.(video');
        const html = read('index.html');
        expect(html.indexOf('js/song-title.js')).toBeGreaterThan(-1);
        expect(html.indexOf('js/song-title.js')).toBeLessThan(html.indexOf('js/music-categories.js'));
        expect(read('sw.js')).toContain("'./js/song-title.js'");
    });

    it('els videoclips oficials de la portada es detecten pel títol original de YouTube', () => {
        const home = loadScript('js/features/home-sections.js').SegueixApp.features.homeSections;
        const cleaned = titles.cleanVideo({
            id: 'v',
            title: 'Manel - Tipus suite (Videoclip Oficial)',
            channelTitle: 'Manel',
            contentType: 'song',
            durationSeconds: 210,
        });
        expect(cleaned.title).toBe('Tipus suite');
        expect(home.isOfficialClip(cleaned)).toBe(true);
        expect(home.isOfficialClip({ ...cleaned, originalTitle: 'Manel - Tipus suite (Lyric Video)' })).toBe(false);
    });
});
