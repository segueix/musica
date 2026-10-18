import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadScript } from './setup.js';

// «Acabades de sortir»: una cançó per artista a la fila i, si el mateix dia n'ha publicat més, el «+N» de la seva
// targeta les desplega al costat (2026-10-17). També: la primera caràtula s'amplia cap a dins (no perd el marc).

const HOUR = 3600000;
const DAY = 24 * HOUR;
const NOW = Date.parse('2026-09-30T18:00:00Z');

const app = { features: {}, state: {}, utils: {} };
loadScript('js/features/discovery.js', { SegueixApp: app });
loadScript('js/features/portada.js', { SegueixApp: app });
const { discovery, portada } = app.features;
const portadaSource = readFileSync('js/features/portada.js', 'utf8');
const css = readFileSync('css/portada.css', 'utf8');

const channels = Array.from({ length: 10 }, (_, i) => ({ id: `C${i}`, name: `Artista ${i}`, categories: ['Pop'] }));
let counter = 0;
const video = (channelId, hoursAgo) => {
    counter += 1;
    return {
        id: `g${String(counter).padStart(3, '0')}`,
        title: `Cançó ${counter}`,
        channelId,
        channelTitle: `Artista ${channelId.slice(1)}`,
        thumbnail: `https://i.ytimg.com/vi/g${counter}/maxresdefault.jpg`,
        contentType: 'song',
        durationSeconds: 200,
        publishedAt: new Date(NOW - hoursAgo * HOUR).toISOString(),
        categories: ['Pop'],
    };
};

// C0 en treu tres alhora avui (i una altra fa dos dies); la resta, una cada un.
const lead = video('C0', 1);
const same1 = video('C0', 2);
const same2 = video('C0', 3);
const otherDay = video('C0', 50);
const rest = channels.slice(1).map((c, i) => video(c.id, 5 + i * 30));
const all = [lead, same1, same2, otherDay, ...rest];

const model = portada.buildModel({
    discovery,
    recent: all,
    all,
    channels,
    history: [],
    liked: [],
    followedIds: [],
    playlists: [],
    hiddenIds: new Set(),
    now: NOW,
    rng: () => 0.5,
});

// Com «Veure-ho tot», el grup no repeteix les cançons que ja surten en una altra fila d'Inici.
const elsewhere = new Set([
    ...(model.radar?.items || []).map(item => item.video.id),
    ...(model.live?.videos || []).map(v => v.id),
    ...(model.lead?.kind === 'start' ? model.lead.items.map(item => item.id) : []),
]);
const expected = [same1, same2].filter(v => !elsewhere.has(v.id)).map(v => v.id);
const n = expected.length;

describe('«Acabades de sortir»: cançons del mateix dia', () => {
    it('la fila porta una cançó per artista i el grup recull les altres del mateix dia', () => {
        expect(model.fresh.videos.filter(v => v.channelId === 'C0').map(v => v.id)).toEqual([lead.id]);
        expect(n).toBeGreaterThan(0);
        expect(model.fresh.groups[lead.id].map(v => v.id)).toEqual(expected);
        // la d'un altre dia no hi és; els artistes amb una sola cançó no tenen grup
        expect(model.fresh.groups[lead.id].some(v => v.id === otherDay.id)).toBe(false);
        expect(Object.keys(model.fresh.groups)).toEqual([lead.id]);
    });

    it('la targeta porta el «+N» amb el text que explica què fa', () => {
        const html = portada.freshHtml(model.fresh, false, NOW, null, new Set());
        expect(html).toMatch(new RegExp(`data-pt-group="${lead.id}" aria-expanded="false"`));
        expect(html).toContain(`<span class="pt-card__more-n" aria-hidden="true">+${n}</span>`);
        expect(html).toContain(n === 1 ? '<span>cançó</span>' : '<span>cançons</span>');
        expect(html).toContain(
            n === 1
                ? 'aria-label="Mostra una altra cançó nova de Artista 0, publicada el mateix dia"'
                : `aria-label="Mostra ${n} cançons noves més de Artista 0, publicades el mateix dia"`
        );
        expect(html).not.toContain('data-pt-group-of');
    });

    it('desplegat, les altres cançons surten just al costat i el botó fa d’«Amaga-les»', () => {
        const html = portada.freshHtml(model.fresh, false, NOW, null, new Set([lead.id]));
        const leadAt = html.indexOf(`data-pt-group="${lead.id}"`);
        const first = html.indexOf(`data-pt-group-of="${lead.id}"`);
        expect(first).toBeGreaterThan(leadAt);
        expect(html.match(new RegExp(`data-pt-group-of="${lead.id}"`, 'g'))).toHaveLength(n);
        expect(html).toContain('aria-expanded="true"');
        expect(html).toContain('Amaga-les');
        expect(html).toContain('<span class="pt-card__badge">Del mateix dia</span>');
        // l'ordre de la fila no canvia: després del grup, el següent artista
        const next = model.fresh.videos[1].id;
        expect(html.indexOf(`data-video-id="${next}"`)).toBeGreaterThan(
            html.lastIndexOf(`data-pt-group-of="${lead.id}"`)
        );
    });

    it('amb «Veure-ho tot» ja hi són totes: sense «+N»', () => {
        const html = portada.freshHtml(model.fresh, true, NOW, null, new Set([lead.id]));
        expect(html).not.toContain('data-pt-group');
        expect(html).toContain(`data-video-id="${expected[0]}"`);
    });

    it('al mòbil, el «+N» desplega (no reprodueix la targeta)', () => {
        const onClick = portadaSource.slice(portadaSource.indexOf('function onClick'));
        expect(onClick.indexOf("pick('[data-pt-group]')")).toBeGreaterThan(-1);
        expect(onClick.indexOf("pick('[data-pt-group]')")).toBeLessThan(onClick.indexOf('.pt-card[data-video-id]'));
    });

    it('la caràtula és la primera d’una pila: una capa per cançó de més (fins a dues), cap a dalt i a la dreta', () => {
        const html = portada.freshHtml(model.fresh, false, NOW, null, new Set());
        expect(html).toContain(n > 1 ? 'pt-cell pt-cell--group pt-cell--stack-2' : 'pt-cell pt-cell--group"');
        expect(css).toMatch(
            /#homePage\.is-portada \.pt-cell--group \{[^}]*padding: var\(--pt-stack\) var\(--pt-stack\) 0 0;/
        );
        expect(css).toMatch(
            /\.pt-cell--group > \.pt-card \{\s*width: calc\(var\(--pt-cover-w\) - var\(--pt-stack\)\);/
        );
        expect(css).toMatch(
            /\.pt-cell--group\.pt-cell--stack-2::after \{[^}]*left: calc\(2 \* var\(--pt-stack-step\)\);/
        );
        // les capes de la pila porten un marc blanc fi (1 px), no llima
        expect(css).toMatch(/\.pt-cell--group\.pt-cell--stack-2::after \{\s*content: '';[^}]*border: 1px solid #fff;/);
        expect(css).not.toMatch(/\.pt-cell--stack-2::after \{[^}]*border-color: rgba\(214, 237, 132/);
        // desplegat, sense pila
        expect(css).toMatch(/\.pt-cell--group\.is-open \{\s*--pt-stack: 0px;/);
    });

    it('el «+N» és una càpsula llima i la fila es desplaça fins a la primera desplegada', () => {
        expect(css).toMatch(/#homePage\.is-portada \.pt-card__more \{[^}]*background: var\(--pt-accent\);/);
        expect(portadaSource).toMatch(/function toggleGroup\(id\)[\s\S]*row\.scrollTo\(/);
    });
});

describe('«Acabades de sortir»: el marc de la primera caràtula', () => {
    it('la primera s’amplia cap a dins (des de l’esquerra) i la darrera des de la dreta', () => {
        expect(css).toMatch(
            /\.pt-row > \.pt-cell:first-child > :is\(\.pt-card, \.pt-portrait\) \{\s*transform-origin: left center;/
        );
        expect(css).toMatch(
            /\.pt-row > \.pt-cell:last-child > :is\(\.pt-card, \.pt-portrait\) \{\s*transform-origin: right center;/
        );
    });
});

describe('«Reprodueix les novetats»: el darrer mes, fins a 40, amb els grups intercalats (2026-10-18)', () => {
    const ids = [];
    const make = (channelId, hoursAgo) => {
        const v = video(channelId, hoursAgo);
        ids.push(v.id);
        return v;
    };
    // C0 en treu vuit el mateix dia (les més noves); 14 artistes més, una cançó cadascun durant el mes; i cançons
    // de fa més d'un mes, que no hi han d'entrar
    const many = Array.from({ length: 14 }, (_, i) => ({ id: `M${i}`, name: `Altre ${i}`, categories: ['Pop'] }));
    const burst = Array.from({ length: 8 }, (_, i) => make('C0', 1 + i * 0.1));
    const monthSongs = many.map((c, i) => make(c.id, 10 + i * 40));
    const old = Array.from({ length: 5 }, (_, i) => make(`M${i}`, 32 * 24 + i));
    const songs = [...burst, ...monthSongs, ...old];
    const big = portada.buildModel({
        discovery,
        recent: songs,
        all: songs,
        channels: [...channels, ...many],
        history: [],
        liked: [],
        followedIds: [],
        playlists: [],
        hiddenIds: new Set(),
        now: NOW,
        rng: () => 0.5,
    });
    const radio = big.fresh.radio;
    const keyOf = v => discovery.artistKeyOf(v);

    it('porta totes les estrenes del darrer mes (no només les 12 de la fila) i cap de més antiga', () => {
        expect(radio.length).toBe(burst.length + monthSongs.length);
        expect(radio.some(v => old.includes(v))).toBe(false);
    });

    it('el grup que n’ha tret vuit no omple el principi: queden repartides i mai seguides', () => {
        expect(radio.slice(0, 12).filter(v => v.channelId === 'C0').length).toBeLessThanOrEqual(4);
        for (let i = 1; i < radio.length; i++) expect(keyOf(radio[i])).not.toBe(keyOf(radio[i - 1]));
        const positions = radio.map((v, i) => (v.channelId === 'C0' ? i : -1)).filter(i => i >= 0);
        expect(positions).toHaveLength(8);
        expect(positions[positions.length - 1]).toBeGreaterThan(radio.length / 2);
    });

    it('com a màxim 40 cançons, les més noves', () => {
        const lots = Array.from({ length: 60 }, (_, i) => ({ ...video(`M${i % 14}`, 2 + i * 5) }));
        const m = portada.buildModel({
            discovery,
            recent: lots,
            all: lots,
            channels: many,
            history: [],
            liked: [],
            followedIds: [],
            playlists: [],
            hiddenIds: new Set(),
            now: NOW,
            rng: () => 0.5,
        });
        expect(m.fresh.radio).toHaveLength(40);
        const newest40 = new Set(lots.slice(0, 40).map(v => v.id));
        expect(m.fresh.radio.every(v => newest40.has(v.id))).toBe(true);
    });

    it('«Reprodueix les novetats» fa sonar aquesta llista', () => {
        expect(portadaSource).toMatch(/fresh: \{\s*videos: model\.fresh\?\.radio \|\|/);
    });

    it('interleaveByArtist (pura): conserva l’ordre quan no hi ha repetits i reparteix els que hi són', () => {
        const k = v => v.a;
        const plain = ['a', 'b', 'c'].map(a => ({ a }));
        expect(portada.interleaveByArtist(plain, k)).toEqual(plain);
        const list = [...'AAAA'].map((a, i) => ({ a, i })).concat([...'BCDEFGH'].map(a => ({ a })));
        const out = portada
            .interleaveByArtist(list, k)
            .map(v => v.a)
            .join('');
        expect(out.length).toBe(11);
        expect(out).not.toMatch(/AA/);
        expect(out[0]).toBe('A');
    });
});
