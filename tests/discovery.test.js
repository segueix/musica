import { describe, expect, it } from 'vitest';
import { createMockLocalStorage, loadScript } from './setup.js';

// Generador pseudoaleatori determinista perquè les proves siguin reproduïbles.
function seeded(seed = 7) {
    let a = seed;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const DAY = 86400000;
const NOW = Date.parse('2026-09-30T12:00:00Z');

function load(extra = {}) {
    const localStorage = extra.localStorage || createMockLocalStorage();
    const ctx = loadScript('js/features/discovery.js', {
        SegueixApp: { features: {}, state: {} },
        localStorage,
        ...extra,
    });
    return { discovery: (ctx.SegueixApp || ctx.window.SegueixApp).features.discovery, localStorage };
}

const channels = [
    { id: 'A', name: 'Artista A', avatar: 'a.jpg', categories: ['Indie', 'Pop'] },
    { id: 'B', name: 'Artista B', avatar: 'b.jpg', categories: ['Indie'] },
    { id: 'C', name: 'Artista C', avatar: 'c.jpg', categories: ['Rock'] },
    { id: 'D', name: 'Artista D', avatar: 'd.jpg', categories: ['Urban'] },
    { id: 'E', name: 'Artista E', avatar: 'e.jpg', categories: ['Indie'] },
    { id: 'F', name: 'Artista F', avatar: 'f.jpg', categories: ['Rock'] },
    { id: 'G', name: 'Artista G', avatar: 'g.jpg', categories: ['Mitjans'] },
];

let counter = 0;
const song = (channelId, daysAgo = 5, extra = {}) => {
    counter += 1;
    return {
        id: `v${counter}`,
        title: `Cançó ${counter}`,
        channelId,
        channelTitle: `Artista ${channelId}`,
        thumbnail: `t${counter}.jpg`,
        contentType: 'song',
        durationSeconds: 210,
        publishedAt: new Date(NOW - daysAgo * DAY).toISOString(),
        ...extra,
    };
};

describe('preferència del mode de descoberta', () => {
    it('per defecte és «Una mica de tot»', () => {
        const { discovery } = load();
        expect(discovery.getMode()).toBe('mix');
        expect(discovery.MODES.map(mode => mode.label)).toEqual([
            'Els meus de sempre',
            'Una mica de tot',
            'Sorprèn-me',
        ]);
    });

    it('es desa a localStorage amb el prefix catube_ (així viatja amb la configuració)', () => {
        const { discovery, localStorage } = load();
        expect(discovery.setMode('surprise')).toBe('surprise');
        expect(localStorage.getItem('catube_discovery_mode')).toBe('surprise');
        expect(discovery.getMode()).toBe('surprise');
    });

    it('ignora valors desconeguts', () => {
        const { discovery, localStorage } = load();
        localStorage.setItem('catube_discovery_mode', 'caos');
        expect(discovery.getMode()).toBe('mix');
        expect(discovery.setMode('res')).toBe('mix');
    });
});

describe('perfil d’escolta', () => {
    it('sense res no hi ha historial ni base per personalitzar', () => {
        const { discovery } = load();
        const profile = discovery.buildProfile({ channels });
        expect(profile.hasHistory).toBe(false);
        expect(profile.hasEnough).toBe(false);
        expect(profile.knownArtistCount).toBe(0);
    });

    it('compta escoltes, m’agrada i seguits, i ignora els Shorts', () => {
        const { discovery } = load();
        const profile = discovery.buildProfile({
            channels,
            history: [song('A'), song('A'), song('B', 5, { isShort: true })],
            liked: [song('C')],
            followedIds: ['D'],
        });
        expect(discovery.familiarity(profile, 'A')).toBe(2);
        expect(discovery.familiarity(profile, 'B')).toBe(0);
        expect(discovery.familiarity(profile, 'C')).toBe(2);
        expect(discovery.familiarity(profile, 'D')).toBe(3);
        expect(profile.knownArtistCount).toBe(3);
        expect(profile.hasEnough).toBe(true);
        // Els estils reals (i les assignacions múltiples) sumen punts; les categories administratives no
        expect(profile.styles.get('Indie')).toBe(2);
        expect(profile.styles.get('Pop')).toBe(2);
        expect(profile.styles.has('Mitjans')).toBe(false);
    });

    it('accepta els canals com a llista o com a diccionari (feed.json)', () => {
        const { discovery } = load();
        const dict = Object.fromEntries(channels.map(channel => [channel.id, channel]));
        const a = discovery.buildProfile({ channels, followedIds: ['A'] });
        const b = discovery.buildProfile({ channels: dict, followedIds: ['A'] });
        expect([...b.styles.entries()]).toEqual([...a.styles.entries()]);
    });
});

describe('ordenació de la cua segons el mode', () => {
    const known = ['A', 'B', 'C'];
    const fresh = ['D', 'E', 'F', 'G'];
    const candidates = [...fresh, ...known].map(id => song(id));
    const withHistory = discovery =>
        discovery.buildProfile({
            channels,
            history: known.map(id => song(id)),
        });
    const ids = list => list.map(video => video.channelId);

    it('sense historial suficient genera una selecció variada i ho explica', () => {
        const { discovery } = load();
        const profile = discovery.buildProfile({ channels });
        const plan = discovery.orderForMode(candidates, profile, 'home', { rng: seeded() });
        expect(plan.mode).toBe('variety');
        expect(plan.requested).toBe('home');
        expect(plan.note).toMatch(/historial/);
        expect(plan.ordered).toHaveLength(candidates.length);
    });

    it('amb poc historial la nota canvia però tampoc es finge personalització', () => {
        const { discovery } = load();
        const profile = discovery.buildProfile({ channels, history: [song('A')] });
        const plan = discovery.orderForMode(candidates, profile, 'surprise', { rng: seeded() });
        expect(plan.mode).toBe('variety');
        expect(plan.note).toMatch(/poc historial/);
    });

    it('«Els meus de sempre» comença per artistes escoltats', () => {
        const { discovery } = load();
        const plan = discovery.orderForMode(candidates, withHistory(discovery), 'home', { rng: seeded() });
        expect(plan.mode).toBe('home');
        expect(plan.note).toBe('');
        const firstFive = ids(plan.ordered).slice(0, 3);
        expect(firstFive.every(id => known.includes(id))).toBe(true);
    });

    it('«Sorprèn-me» dona més pes als artistes que encara no ha escoltat', () => {
        const { discovery } = load();
        const plan = discovery.orderForMode(candidates, withHistory(discovery), 'surprise', { rng: seeded() });
        const firstFour = ids(plan.ordered).slice(0, 4);
        expect(firstFour.every(id => fresh.includes(id))).toBe(true);
    });

    it('«Una mica de tot» alterna coneguts i descoberta', () => {
        const { discovery } = load();
        const profile = withHistory(discovery);
        const plan = discovery.orderForMode(candidates, profile, 'mix', { rng: seeded() });
        const kinds = plan.ordered.slice(0, 6).map(video => (discovery.familiarity(profile, video) > 0 ? 'K' : 'F'));
        expect(kinds).toEqual(['K', 'F', 'K', 'F', 'K', 'F']);
    });

    it('no perd cap cançó i s’omple amb l’altre grup quan un s’acaba', () => {
        const { discovery } = load();
        const profile = withHistory(discovery);
        const onlyKnown = known.map(id => song(id));
        const plan = discovery.orderForMode(onlyKnown, profile, 'surprise', { rng: seeded() });
        expect(plan.ordered).toHaveLength(3);
        expect(plan.mode).toBe('surprise');
    });

    it('entre els desconeguts, primer els d’estils que ja ha explorat', () => {
        const { discovery } = load();
        const profile = discovery.buildProfile({
            channels,
            history: [song('A'), song('B'), song('A'), song('B')],
            liked: [song('C')],
        });
        // E és Indie (estil escoltat); D és Urban (no); F és Rock (m'agrada de C)
        const pool = [song('D'), song('E')];
        const plan = discovery.orderForMode(pool, profile, 'surprise', { rng: seeded(), jitterStrength: 0 });
        expect(ids(plan.ordered)).toEqual(['E', 'D']);
    });
});

describe('«Fora del teu radar»', () => {
    const videos = channels.slice(0, 6).flatMap(channel => [song(channel.id, 3), song(channel.id, 40)]);

    it('sense historial es diu «Per descobrir», és variada i no inventa explicacions', () => {
        const { discovery } = load();
        const profile = discovery.buildProfile({ channels });
        const radar = discovery.pickRadar({ videos, profile, rng: seeded() });
        expect(radar.title).toBe('Per descobrir');
        expect(radar.personalized).toBe(false);
        expect(radar.items.length).toBe(6);
        expect(radar.items.every(item => item.reason === '')).toBe(true);
        // Un sol artista per targeta i cap repetit
        expect(new Set(radar.items.map(item => item.key)).size).toBe(radar.items.length);
    });

    it('amb historial exclou els artistes ja escoltats i explica el motiu real', () => {
        const { discovery } = load();
        const profile = discovery.buildProfile({
            channels,
            history: [song('A'), song('A'), song('C'), song('C'), song('D')],
        });
        const radar = discovery.pickRadar({ videos, profile, rng: seeded() });
        const keys = radar.items.map(item => item.key);
        expect(keys).not.toContain('a');
        expect(keys).not.toContain('c');
        expect(radar.title).toBe('Fora del teu radar');
        const b = radar.items.find(item => item.key === 'b');
        // B és Indie i l'usuari ha escoltat Indie (A) dues vegades
        expect(b.reason).toBe('Més indie per descobrir');
        // Un artista de l'estil explorat va abans que un estil no explorat
        expect(keys.indexOf('b')).toBeLessThan(keys.indexOf('e') + 1);
    });

    it('no explica res si l’estil no té prou punts', () => {
        const { discovery } = load();
        const profile = discovery.buildProfile({ channels, history: [song('C')] });
        const radar = discovery.pickRadar({ videos, profile, rng: seeded() });
        // Només 1 punt de Rock: no arriba al mínim per justificar una explicació
        expect(radar.items.every(item => item.reason === '')).toBe(true);
        expect(radar.title).toBe('Per descobrir');
    });

    it('només fa servir cançons: ignora directes, Shorts i altres tipus', () => {
        const { discovery } = load();
        const profile = discovery.buildProfile({ channels });
        const mixed = [
            song('A', 3, { contentType: 'live_song' }),
            song('B', 3, { isShort: true }),
            song('C', 3, { contentType: 'review' }),
            song('D', 3),
        ];
        const radar = discovery.pickRadar({ videos: mixed, profile, rng: seeded() });
        expect(radar.items.map(item => item.key)).toEqual(['d']);
    });

    it('agafa la cançó més recent de cada artista i porta el seu retrat', () => {
        const { discovery } = load();
        const profile = discovery.buildProfile({ channels });
        const old = song('A', 200);
        const recent = song('A', 2);
        const radar = discovery.pickRadar({ videos: [old, recent], profile, rng: seeded() });
        expect(radar.items[0].video.id).toBe(recent.id);
        expect(radar.items[0].avatar).toBe('a.jpg');
        expect(radar.items[0].name).toBe('Artista A');
    });
});

describe('«Torna-hi» i «Comença per aquí»', () => {
    it('sense historial no hi ha «Torna-hi»', () => {
        const { discovery } = load();
        expect(discovery.pickReturnItems({ history: [], playlists: [], channels })).toEqual([]);
    });

    it('barreja cançons, artistes i llistes recents sense repetir', () => {
        const { discovery } = load();
        const history = [song('A'), song('B'), song('C'), song('D'), song('E')];
        const playlists = [
            { id: 'pl_1', name: 'Vella', videos: [song('F')] },
            { id: 'pl_2', name: 'Nova', videos: [song('A'), song('B')] },
            { id: 'pl_3', name: 'Buida', videos: [] },
        ];
        const items = discovery.pickReturnItems({ history, playlists, channels, limit: 6 });
        expect(items).toHaveLength(6);
        expect(items[0].type).toBe('song');
        expect(items.some(item => item.type === 'artist')).toBe(true);
        expect(items.some(item => item.type === 'list')).toBe(true);
        // La llista més nova va primer i les buides no surten
        const lists = items.filter(item => item.type === 'list');
        expect(lists[0].title).toBe('Nova');
        expect(lists.map(item => item.title)).not.toContain('Buida');
        // Els artistes no repeteixen els de les cançons mostrades
        const artist = items.find(item => item.type === 'artist');
        expect(['a', 'b', 'c']).not.toContain(artist.key);
        const songIds = items.filter(item => item.type === 'song').map(item => item.id);
        expect(new Set(songIds).size).toBe(songIds.length);
    });

    it('«Comença per aquí» dona una cançó per artista i barreja estils', () => {
        const { discovery } = load();
        const profile = discovery.buildProfile({ channels });
        const videos = channels.flatMap(channel => [song(channel.id, 4), song(channel.id, 60)]);
        const picks = discovery.pickStartHere({ videos, profile, rng: seeded(), limit: 5 });
        expect(picks).toHaveLength(5);
        expect(new Set(picks.map(video => video.channelId)).size).toBe(5);
        const styles = new Set(picks.map(video => discovery.stylesOf(video, profile.channels)[0]));
        expect(styles.size).toBeGreaterThanOrEqual(3);
    });
});

describe('repartiment de la portada', () => {
    it('no repeteix cançons i limita els artistes', () => {
        const { discovery } = load();
        const placement = discovery.createPlacement({ maxPerArtist: 2 });
        const a = [song('A'), song('A'), song('A')];
        expect(placement.take(a[0])).toBe(true);
        expect(placement.take(a[0])).toBe(false);
        expect(placement.take(a[1])).toBe(true);
        expect(placement.take(a[2])).toBe(false);
        expect(placement.has(a[0].id)).toBe(true);
        expect(placement.count('A')).toBe(2);
    });
});

describe('novetat destacada', () => {
    it('prefereix la novetat recent d’un artista conegut i ho explica', () => {
        const { discovery } = load();
        const profile = discovery.buildProfile({ channels, followedIds: ['B'] });
        const desconegut = song('D', 1);
        const seguit = song('B', 6);
        const picked = discovery.pickFeatured({ videos: [desconegut, seguit], profile, now: NOW });
        expect(picked.video.id).toBe(seguit.id);
        expect(picked.eyebrow).toBe('Novetat d’un artista que segueixes');
    });

    it('sense historial és senzillament la novetat més recent', () => {
        const { discovery } = load();
        const profile = discovery.buildProfile({ channels });
        const picked = discovery.pickFeatured({
            videos: [song('A', 9), song('B', 2), song('C', 4)],
            profile,
            now: NOW,
        });
        expect(picked.video.channelId).toBe('B');
        expect(picked.eyebrow).toBe('Novetat');
    });

    it('no proposa Shorts, directes ni vídeos que ja s’han col·locat', () => {
        const { discovery } = load();
        const profile = discovery.buildProfile({ channels });
        const live = song('A', 1, { contentType: 'live_song' });
        const shortVideo = song('B', 1, { isShort: true });
        const ok = song('C', 3);
        expect(discovery.pickFeatured({ videos: [live, shortVideo, ok], profile, now: NOW }).video.id).toBe(ok.id);
        expect(discovery.pickFeatured({ videos: [ok], profile, exclude: new Set([ok.id]), now: NOW })).toBeNull();
    });
});

describe('«Tria el teu so»', () => {
    it('resumeix els estils reals amb assignacions múltiples i els accessibles primer', () => {
        const { discovery } = load();
        const videos = channels.map(channel => song(channel.id, 4));
        const styles = discovery.summarizeStyles({ videos, channels });
        const labels = styles.map(style => style.label);
        expect(labels).toEqual(['Urban', 'Pop', 'Rock', 'Indie']);
        const indie = styles.find(style => style.label === 'Indie');
        // A, B i E són Indie: un artista compta a cada estil que té (A és també Pop)
        expect(indie.artists).toBe(3);
        expect(styles.find(style => style.label === 'Pop').artists).toBe(1);
        expect(indie.avatars.length).toBe(3);
        // Les categories administratives no són un estil
        expect(labels).not.toContain('Mitjans');
    });

    it('els estils secundaris queden darrere dels accessibles', () => {
        const { discovery } = load();
        const extra = [
            { id: 'X', name: 'X', categories: ['Jazz / Blues'] },
            { id: 'Y', name: 'Y', categories: ['Pop'] },
        ];
        const styles = discovery.summarizeStyles({
            videos: [song('X'), song('Y')],
            channels: extra,
        });
        expect(styles.map(style => style.label)).toEqual(['Pop', 'Jazz / Blues']);
        expect(styles[1].primary).toBe(false);
    });
});

describe('gust recent (La teva ràdio)', () => {
    const played = (channelId, daysAgo) =>
        song(channelId, 5, { viewedAt: new Date(NOW - daysAgo * DAY).toISOString() });

    it('fa servir la darrera setmana i compta escoltes, m’agrades i seguits', () => {
        const { discovery } = load();
        const history = [played('A', 1), played('B', 2), played('C', 3), played('D', 20)];
        const taste = discovery.recentTaste({
            history,
            liked: [song('E')],
            followedIds: ['F'],
            channels,
            now: NOW,
        });
        expect(taste.windowDays).toBe(7);
        expect(taste.plays).toBe(3);
        expect(taste.liked).toBe(1);
        expect(taste.followed).toBe(1);
        expect([...taste.artistKeys].sort()).toEqual(['a', 'b', 'c', 'e', 'f']);
        expect(taste.hasAny).toBe(true);
        expect(taste.styles.length).toBeGreaterThan(0);
    });

    it('amplia la finestra a un mes i, si encara hi ha poca cosa, a tot l’historial', () => {
        const { discovery } = load();
        const month = discovery.recentTaste({
            history: [played('A', 10), played('B', 15), played('C', 25)],
            channels,
            now: NOW,
        });
        expect(month.windowDays).toBe(30);
        expect(month.plays).toBe(3);
        const all = discovery.recentTaste({ history: [played('A', 90), played('B', 120)], channels, now: NOW });
        expect(all.windowDays).toBe(0);
        expect(all.plays).toBe(2);
    });

    it('sense res (primera vegada) no hi ha gust', () => {
        const { discovery } = load();
        const taste = discovery.recentTaste({ history: [], liked: [], followedIds: [], channels, now: NOW });
        expect(taste.hasAny).toBe(false);
        expect(taste.artistKeys.size).toBe(0);
        expect(discovery.tasteSummary(taste)).toBe('');
    });

    it('el resum diu de què està feta la ràdio, amb els recomptes reals', () => {
        const { discovery } = load();
        const text = discovery.tasteSummary({ hasAny: true, windowDays: 7, plays: 14, liked: 5, followed: 3 });
        expect(text).toBe(
            'Feta amb el que has escoltat aquesta setmana (14 cançons), els teus m’agrades (5) i els artistes que segueixes (3).'
        );
        expect(discovery.tasteSummary({ hasAny: true, windowDays: 30, plays: 1, liked: 0, followed: 0 })).toBe(
            'Feta amb el que has escoltat aquest mes (1 cançó).'
        );
        expect(discovery.tasteSummary({ hasAny: true, windowDays: 0, plays: 0, liked: 2, followed: 1 })).toBe(
            'Feta amb els teus m’agrades (2) i els artistes que segueixes (1).'
        );
    });

    it('els estils de la primera vegada es desen, es normalitzen i no passen de tres', () => {
        const { discovery, localStorage } = load();
        expect(discovery.getFirstStyles()).toEqual([]);
        expect(discovery.setFirstStyles(['pop', 'Rock', 'inventat', 'Indie', 'Urbana'])).toEqual([
            'Pop',
            'Rock',
            'Indie',
        ]);
        expect(JSON.parse(localStorage.getItem('catube_first_styles'))).toEqual(['Pop', 'Rock', 'Indie']);
        expect(discovery.getFirstStyles()).toEqual(['Pop', 'Rock', 'Indie']);
        expect(discovery.setFirstStyles([])).toEqual([]);
        expect(localStorage.getItem('catube_first_styles')).toBeNull();
        expect(discovery.choosableStyles()).not.toContain('Altres estils');
        expect(discovery.choosableStyles()).toContain('Pop');
    });
});
