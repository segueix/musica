import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadScript } from './setup.js';

// Motor de selecció musical: proves amb rellotge i generador aleatori injectats, sobre un catàleg sintètic
// i sobre el catàleg real (data/feed.json). El comportament deliberadament variable es comprova amb
// mostres reproduïbles (llavors fixes), no amb un ordre únic.

const DAY = 86400000;
const YEAR = 365.25 * DAY;
const NOW = Date.parse('2026-09-30T12:00:00Z');

const E = loadScript('js/features/music-selection.js').SegueixApp.features.musicSelection;

function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ---------- Catàleg sintètic ----------

let counter = 0;
function song(
    channel,
    { years = 0.3, original = null, views = 5000, title = null, duration = 200, style = 'Pop', extra = {} } = {}
) {
    counter += 1;
    return {
        id: `s${String(counter).padStart(10, '0')}`,
        title: title || `Cançó ${counter}`,
        channelId: channel,
        channelTitle: `Artista ${channel}`,
        contentType: 'song',
        durationSeconds: duration,
        viewCount: views,
        categories: [style],
        publishedAt: new Date(NOW - years * YEAR).toISOString(),
        ...(original
            ? { originalYear: original, originalYearSource: 'released-on', originalYearConfidence: 'alta' }
            : {}),
        ...extra,
    };
}

function syntheticCatalog() {
    const videos = [];
    // 30 artistes actuals (3 cançons de fa <2 anys, 2 de 3-6 anys), 6 antics amb 6 cançons cadascun
    for (let a = 0; a < 30; a++) {
        const style = ['Pop', 'Rock', 'Indie', 'Urbana'][a % 4];
        for (let i = 0; i < 3; i++)
            videos.push(song(`cur${a}`, { years: 0.1 + i * 0.5, views: 1000 + a * 300 + i * 50, style }));
        for (let i = 0; i < 2; i++) videos.push(song(`mid${a}`, { years: 3 + i * 2, views: 20000 + a * 900, style }));
    }
    for (let a = 0; a < 6; a++) {
        for (let i = 0; i < 6; i++)
            videos.push(
                song(`old${a}`, { years: 30 + i, views: 400000 - i * 30000 - a * 1000, style: "Cançó d'autor" })
            );
    }
    return videos;
}

const classicIds = new Set(['old0', 'old1', 'old2', 'old3', 'old4', 'old5']);
const isClassicArtist = video => classicIds.has(video.channelId);
const makeCtx = (videos, extra = {}) =>
    E.createContext({
        videos,
        now: NOW,
        isClassicArtist,
        stylesOf: v => (v.categories || []).map(x => x.toLowerCase()),
        ...extra,
    });

function radio(ctx, videos, { seed, signals, mode = 'mix', rng, category = null, ...rest } = {}) {
    const base = seed || videos[0];
    const candidates = videos.filter(v => v.id !== base.id && (!category || v.categories.includes(category)));
    const result = E.selectRadio({
        ctx,
        candidates,
        seed: base,
        signals: signals || E.emptySignals(),
        mode,
        rng,
        ...rest,
    });
    return { queue: [base, ...result.queue], meta: result.meta };
}

// ---------- Antiguitat real ----------

describe('antiguitat real de la música', () => {
    it('distingeix la data de pujada de l’any original', () => {
        const old = song('x', { years: 0.01, original: 2009 });
        const era = E.eraOf(old, { now: NOW });
        expect(era.tier).toBe('historic');
        expect(era.isReissue).toBe(true);
        expect(era.basis).toBe('original');
        // Una gravació antiga pujada avui no és una estrena
        expect(E.isNewRelease(old, { now: NOW })).toBe(false);
    });

    it('una cançó nova verificada d’un artista veterà és música actual i estrena', () => {
        const fresh = song('old0', { years: 0.05, original: 2026 });
        const era = E.eraOf(fresh, { now: NOW, isClassicArtist });
        expect(era.tier).toBe('recent');
        expect(E.isNewRelease(fresh, { now: NOW, isClassicArtist })).toBe(true);
    });

    it('sense any original, la llista d’artistes antics és una aproximació conservadora', () => {
        const upload = song('old1', { years: 0.02 });
        const era = E.eraOf(upload, { now: NOW, isClassicArtist });
        expect(era).toMatchObject({ tier: 'historic', basis: 'artist-list', confidence: 'baixa' });
        expect(E.isNewRelease(upload, { now: NOW, isClassicArtist })).toBe(false);
    });

    it('sense evidència ni llista, la data de pujada mana i no s’inventa cap any', () => {
        const era = E.eraOf(song('n', { years: 0.5 }), { now: NOW, isClassicArtist });
        expect(era).toMatchObject({
            tier: 'recent',
            basis: 'upload',
            year: new Date(NOW - 0.5 * YEAR).getUTCFullYear(),
        });
        expect(E.eraOf(song('n', { years: 5 }), { now: NOW }).tier).toBe('mid');
        expect(E.eraOf(song('n', { years: 9 }), { now: NOW }).tier).toBe('historic');
        const unknown = E.eraOf({ id: 'z', title: 'x' }, { now: NOW });
        expect(unknown).toMatchObject({ basis: 'unknown', year: null });
    });

    it('el gènere «Clàssica» no és antiguitat del repertori', () => {
        const modern = song('n', { years: 0.4, style: 'Clàssica' });
        expect(E.eraOf(modern, { now: NOW }).tier).toBe('recent');
    });

    it('una estrena requereix data de pujada recent i cap evidència d’una gravació antiga', () => {
        expect(E.isNewRelease(song('n', { years: 0.1 }), { now: NOW })).toBe(true);
        expect(E.isNewRelease(song('n', { years: 0.5 }), { now: NOW })).toBe(false);
        expect(E.isNewRelease(song('n', { years: 0.1, original: 2015 }), { now: NOW })).toBe(false);
    });
});

// ---------- Identitat de gravació ----------

describe('gravacions duplicades i versions', () => {
    const a = E.titleKeys('Alegria (Official Video)', 'art', 230);
    const b = E.titleKeys('Alegria (Audio)', 'art', 231);
    const live = E.titleKeys('Alegria (En directe)', 'art', 260);
    const other = E.titleKeys('Alegria', 'art2', 230);

    it('deduplica només amb evidència fiable: mateix artista, títol i durada', () => {
        expect(E.isSameRecording(a, b)).toBe(true);
        expect(E.isSameRecording(a, other)).toBe(false);
    });

    it('conserva directes i versions diferents, però comparteixen obra', () => {
        expect(E.isSameRecording(a, live)).toBe(false);
        expect(a.work).toBe(live.work);
    });

    it('no fusiona només perquè el títol coincideix (durada molt diferent)', () => {
        expect(E.isSameRecording(a, E.titleKeys('Alegria', 'art', 400))).toBe(false);
    });

    it('la ràdio no encadena dues gravacions equivalents', () => {
        const videos = syntheticCatalog();
        const official = song('cur0', { years: 0.1, title: 'Aire (Official Video)', duration: 200, views: 900000 });
        const topic = song('cur0', {
            years: 0.1,
            title: 'Aire',
            duration: 201,
            views: 10,
            extra: { channelId: 'cur0' },
        });
        const all = [...videos, official, topic];
        const ctx = makeCtx(all);
        for (let i = 0; i < 20; i++) {
            const { queue } = radio(ctx, all, { seed: videos[70 + (i % 30)], rng: mulberry(i + 1) });
            const both = queue.filter(v => v.id === official.id || v.id === topic.id);
            expect(both.length).toBeLessThanOrEqual(1);
        }
    });
});

// ---------- Ràdio general: usuari nou ----------

describe('ràdio general per a un usuari nou', () => {
    const catalog = syntheticCatalog();
    const ctx = makeCtx(catalog);

    it('predomina la música actual i el catàleg històric és ocasional (màx. 2 de 20, mai seguides)', () => {
        const totals = { recent: 0, mid: 0, historic: 0 };
        let samples = 0;
        for (let i = 0; i < 40; i++) {
            const rng = mulberry(100 + i);
            const seed = catalog[Math.floor(rng() * catalog.length)];
            const { queue } = radio(ctx, catalog, { seed, rng });
            const summary = E.summarize(queue, ctx);
            expect(summary.historicTop).toBeLessThanOrEqual(2);
            expect(summary.consecutiveHistoric).toBe(0);
            expect(summary.maxSameArtistTop).toBeLessThanOrEqual(2);
            Object.keys(totals).forEach(k => (totals[k] += summary.topEra[k]));
            samples += Math.min(20, queue.length);
        }
        const share = k => totals[k] / samples;
        expect(share('recent')).toBeGreaterThan(0.55);
        expect(share('historic')).toBeGreaterThan(0.04);
        expect(share('historic')).toBeLessThanOrEqual(0.1);
        expect(share('mid')).toBeGreaterThan(0.15);
    });

    it('deixa almenys 3 cançons d’altres artistes entre dues d’un mateix artista quan hi ha alternatives', () => {
        for (let i = 0; i < 20; i++) {
            const { queue } = radio(ctx, catalog, { seed: catalog[i * 3], rng: mulberry(500 + i) });
            expect(E.summarize(queue, ctx).minArtistGap === null || E.summarize(queue, ctx).minArtistGap >= 3).toBe(
                true
            );
        }
    });

    it('és reproduïble amb la mateixa llavor i varia amb una altra', () => {
        const run = seed =>
            radio(ctx, catalog, { seed: catalog[5], rng: mulberry(seed) })
                .queue.map(v => v.id)
                .join();
        expect(run(7)).toBe(run(7));
        expect(run(7)).not.toBe(run(8));
    });

    it('explica que no hi ha historial i no promet personalització', () => {
        const { meta } = radio(ctx, catalog, { rng: mulberry(1) });
        expect(meta.mode).toBe('variety');
        expect(meta.note).toMatch(/historial/);
    });
});

// ---------- Personalització ----------

describe('gust, seguiments, cors i escoltes', () => {
    const catalog = syntheticCatalog();
    const ctx = makeCtx(catalog);
    const frequency = (signals, predicate, runs = 60) => {
        let hits = 0;
        for (let i = 0; i < runs; i++) {
            const rng = mulberry(900 + i);
            const seed = catalog[Math.floor(rng() * catalog.length)];
            const { queue } = radio(ctx, catalog, { seed, signals, rng });
            if (queue.slice(1, 21).some(predicate)) hits += 1;
        }
        return hits / runs;
    };

    it('seguir un artista n’augmenta la presència sense monopolitzar la ràdio', () => {
        const target = 'cur7';
        const sigs = E.emptySignals();
        // 3 artistes coneguts perquè hi hagi personalització
        ['cur1', 'cur2', 'cur3'].forEach(key => sigs.followed.add(key));
        const before = frequency(sigs, v => v.channelId === target);
        sigs.followed.add(target);
        const after = frequency(sigs, v => v.channelId === target);
        expect(after).toBeGreaterThan(before);
        // Mai més de 2 peces del mateix artista a les 20 primeres
        for (let i = 0; i < 20; i++) {
            const { queue } = radio(ctx, catalog, { seed: catalog[i], signals: sigs, rng: mulberry(i) });
            expect(queue.slice(0, 20).filter(v => v.channelId === target).length).toBeLessThanOrEqual(2);
        }
    });

    it('seguir un grup mai el deixa fora de la ràdio general sense preferències cap a ell', () => {
        const sigs = E.emptySignals();
        ['cur1', 'cur2', 'cur3', 'cur4'].forEach(key => sigs.followed.add(key));
        // Un artista no seguit continua sortint
        expect(frequency(sigs, v => v.channelId === 'cur20')).toBeGreaterThan(0.05);
    });

    it('un cor augmenta el retorn d’una cançó concreta encara que sigui a l’historial', () => {
        const sigs = E.emptySignals();
        ['cur1', 'cur2', 'cur3'].forEach(key => sigs.followed.add(key));
        // Una cançó amb poques opcions de sortir per si sola: de les pitjor puntuades i d'un artista no seguit
        const target = catalog
            .filter(v => v.channelId.startsWith('cur') && !sigs.followed.has(v.channelId))
            .map(v => ({ v, s: E.scoreOne(v, ctx, sigs, null, {}).score }))
            .sort((a, b) => a.s - b.s)[3].v;
        // A l’historial (visita antiga) però sense cor: l’historial ja no l’exclou però tampoc no la porta
        sigs.songs[target.id] = { h: 1, l: NOW - 30 * DAY };
        const without = frequency(sigs, v => v.id === target.id, 120);
        sigs.liked.add(target.id);
        sigs.likedArtists[target.channelId] = 1;
        const withHeart = frequency(sigs, v => v.id === target.id, 120);
        expect(withHeart).toBeGreaterThan(without);
        expect(withHeart).toBeGreaterThan(0.2);
        // El reforç per a la cançó és més fort que per a la resta de l’artista
        const sibling = catalog.find(v => v.channelId === target.channelId && v.id !== target.id);
        expect(E.songTaste(target.id, sigs, NOW, ctx.config)).toBeGreaterThan(
            E.songTaste(sibling.id, sigs, NOW, ctx.config)
        );
        expect(E.artistTaste(target.channelId, sigs, NOW, ctx.config)).toBeGreaterThan(0);
        expect(E.artistTaste(target.channelId, sigs, NOW, ctx.config)).toBeLessThan(
            E.songTaste(target.id, sigs, NOW, ctx.config)
        );
    });

    it('cinc escoltes voluntàries aporten més reforç que una, amb límit', () => {
        const cfg = ctx.config;
        const one = { songs: { a: { q: 1, f: 1, r: 0, l: NOW } }, liked: new Set() };
        const five = { songs: { a: { q: 5, f: 5, r: 4, l: NOW } }, liked: new Set() };
        const fifty = { songs: { a: { q: 50, f: 50, r: 49, l: NOW } }, liked: new Set() };
        const t1 = E.songTaste('a', one, NOW, cfg);
        const t5 = E.songTaste('a', five, NOW, cfg);
        const t50 = E.songTaste('a', fifty, NOW, cfg);
        expect(t5).toBeGreaterThan(t1 * 2);
        expect(t50).toBeLessThanOrEqual(1);
        expect(t50 - t5).toBeLessThan(0.05);
        // Una repetició voluntària pesa més que una escolta automàtica
        const auto = { songs: { a: { q: 2, f: 0, r: 0, l: NOW } }, liked: new Set() };
        const voluntary = { songs: { a: { q: 2, f: 0, r: 1, l: NOW } }, liked: new Set() };
        expect(E.songTaste('a', voluntary, NOW, cfg)).toBeGreaterThan(E.songTaste('a', auto, NOW, cfg));
    });

    it('el gust decau amb el temps (excepte els cors)', () => {
        const cfg = ctx.config;
        const recent = { songs: { a: { q: 3, f: 3, r: 2, l: NOW } }, liked: new Set() };
        const stale = { songs: { a: { q: 3, f: 3, r: 2, l: NOW - 400 * DAY } }, liked: new Set() };
        expect(E.songTaste('a', stale, NOW, cfg)).toBeLessThan(E.songTaste('a', recent, NOW, cfg) * 0.3);
    });

    it('una cançó que acaba de sonar descansa: 12 cançons i 60 minuts', () => {
        const target = catalog.find(v => v.channelId === 'cur4');
        const pool = [target, ...catalog.filter(v => v.channelId !== 'cur4' && v.channelId !== 'cur12')];
        const seed = catalog.find(v => v.channelId === 'cur12');
        const selects = signals =>
            E.selectRadio({ ctx, candidates: pool, seed, signals, rng: mulberry(3) }).queue.some(
                v => v.id === target.id
            );
        const sigs = E.emptySignals();
        sigs.liked.add(target.id); // ni tan sols un cor la porta abans del descans
        expect(selects(sigs)).toBe(true);
        sigs.recent = [{ id: target.id, at: NOW - 10 * 60000 }];
        expect(selects(sigs)).toBe(false);
        // Fora de la sessió (3 h) només mana el temps; dins la sessió, també les 12 cançons: 90 min però només 5 cançons després
        sigs.recent = [{ id: target.id, at: NOW - 3 * 3600000 }];
        expect(selects(sigs)).toBe(true);
        sigs.recent = [
            ...Array.from({ length: 5 }, (_, i) => ({ id: `x${i}`, at: NOW - i * 1000 })),
            { id: target.id, at: NOW - 90 * 60000 },
        ];
        expect(selects(sigs)).toBe(false);
    });

    it('dins d’un artista, una altra cançó adequada va abans de repetir sempre el mateix èxit', () => {
        const hit = song('twoSongs', { years: 0.3, views: 900000 });
        const other = song('twoSongs', { years: 0.4, views: 20000, title: 'Una altra cançó' });
        const rest = catalog.filter(v => v.channelId.startsWith('cur')).slice(0, 12);
        const all = [hit, other, ...rest];
        const local = makeCtx(all);
        const sigs = E.emptySignals();
        sigs.songs[hit.id] = { q: 2, f: 1, r: 0, l: NOW - 3 * DAY };
        // Sense la regla, l'èxit (molt popular) guanyaria; amb ella, la que encara no has escoltat surt primer
        let otherFirst = 0;
        for (let i = 0; i < 30; i++) {
            const queue = E.selectRadio({
                ctx: local,
                candidates: [hit, other],
                seed: rest[0],
                signals: sigs,
                rng: mulberry(i + 3),
                count: 1,
            }).queue;
            if (queue[0].id === other.id) otherFirst += 1;
        }
        expect(otherFirst).toBeGreaterThan(20);
        // Una preferida amb cor sí que torna
        sigs.liked.add(hit.id);
        const queue = E.selectRadio({
            ctx: local,
            candidates: [hit, other],
            seed: rest[0],
            signals: sigs,
            rng: mulberry(1),
            count: 1,
        }).queue;
        expect(queue[0].id).toBe(hit.id);
    });

    it('els salts manuals reiterats penalitzen temporalment; un de sol no', () => {
        const target = catalog.find(v => v.channelId === 'cur5');
        const sigs = E.emptySignals();
        const base = E.scoreOne(target, ctx, sigs, null, {}).score;
        sigs.songs[target.id] = { s: 1, sl: NOW };
        expect(E.scoreOne(target, ctx, sigs, null, {}).score).toBeCloseTo(base, 5);
        sigs.songs[target.id] = { s: 3, sl: NOW };
        expect(E.scoreOne(target, ctx, sigs, null, {}).score).toBeLessThan(base - 0.1);
        // Amb el temps la penalització desapareix
        sigs.songs[target.id] = { s: 3, sl: NOW - 60 * DAY };
        expect(E.scoreOne(target, ctx, sigs, null, {}).score).toBeGreaterThan(base - 0.05);
    });

    it('«Menys com aquesta» i «No em recomanis aquest artista» exclouen de la selecció automàtica', () => {
        const sigs = E.emptySignals();
        const target = catalog.find(v => v.channelId === 'cur6');
        sigs.lessLike.add(target.id);
        sigs.blockedArtists.add('cur8');
        for (let i = 0; i < 25; i++) {
            const { queue } = radio(ctx, catalog, { seed: catalog[i], signals: sigs, rng: mulberry(i) });
            expect(queue.slice(1).some(v => v.id === target.id)).toBe(false);
            expect(queue.slice(1).some(v => v.channelId === 'cur8')).toBe(false);
        }
    });

    it('«+ com aquesta» puja el gust de la cançó (menys que un cor) i l’artista lleument', () => {
        const target = catalog.find(v => v.channelId === 'cur3');
        const sigs = E.emptySignals();
        const base = E.songTaste(target.id, sigs, NOW, ctx.config);
        sigs.moreLike.add(target.id);
        const more = E.songTaste(target.id, sigs, NOW, ctx.config);
        sigs.liked.add(target.id);
        const both = E.songTaste(target.id, sigs, NOW, ctx.config);
        expect(more).toBeGreaterThan(base);
        expect(both).toBeGreaterThanOrEqual(more);
        const heartOnly = E.emptySignals();
        heartOnly.liked.add(target.id);
        expect(E.songTaste(target.id, heartOnly, NOW, ctx.config)).toBeGreaterThan(more);
        sigs.artists.cur3 = { ml: 2 };
        expect(E.artistTaste('cur3', sigs, NOW, ctx.config)).toBeGreaterThan(0);
        expect(E.reasonFor(target, ctx, { moreLike: new Set([target.id]) })).toBe('Has demanat més com aquesta');
    });

    it('«Els meus de sempre» potencia preferides i «Sorprèn-me» la descoberta', () => {
        const sigs = E.emptySignals();
        const known = Array.from({ length: 14 }, (_, i) => `cur${i + 1}`);
        known.forEach(key => sigs.followed.add(key));
        const knownShare = mode => {
            let known2 = 0;
            let total = 0;
            for (let i = 0; i < 30; i++) {
                const { queue } = radio(ctx, catalog, {
                    seed: catalog[10 + i],
                    signals: sigs,
                    mode,
                    rng: mulberry(i + 40),
                });
                queue.slice(1, 21).forEach(v => {
                    total += 1;
                    if (known.includes(v.channelId)) known2 += 1;
                });
            }
            return known2 / total;
        };
        expect(knownShare('home')).toBeGreaterThan(knownShare('mix'));
        expect(knownShare('mix')).toBeGreaterThan(knownShare('surprise'));
    });
});

// ---------- «Fora del meu radar»: descoberta pura ----------

describe('mode «Fora del meu radar»', () => {
    const catalog = syntheticCatalog();
    const ctx = makeCtx(catalog);
    // L'usuari ha seguit/escoltat 14 artistes actuals (cur1..cur14) i ha deixat rastre amb un altre (cur20: va saltar-lo)
    const knownKeys = Array.from({ length: 14 }, (_, i) => `cur${i + 1}`);
    const signals = () => {
        const sigs = E.emptySignals();
        knownKeys.forEach(key => sigs.followed.add(key));
        sigs.artists.cur20 = { s: 2 };
        sigs.artists.cur21 = { h: 1 };
        return sigs;
    };
    const run = (extra = {}) =>
        radio(ctx, catalog, { seed: catalog[200], signals: signals(), mode: 'new', rng: mulberry(5), ...extra });

    it('només hi surten artistes sense cap rastre: ni seguits, ni escoltats, ni saltats, ni de l’historial', () => {
        for (let i = 0; i < 10; i++) {
            const { queue } = run({ rng: mulberry(i + 1) });
            const artists = queue.slice(1).map(v => v.channelId);
            expect(artists.length).toBeGreaterThan(20);
            artists.forEach(artist => {
                expect(knownKeys).not.toContain(artist);
                expect(['cur20', 'cur21']).not.toContain(artist);
            });
        }
    });

    it('prefereix molts grups diferents: un sol tema per artista mentre n’hi hagi prou', () => {
        const { queue } = run();
        const artists = queue.slice(1).map(v => v.channelId);
        expect(new Set(artists).size).toBe(artists.length);
    });

    it('explica quants artistes nous hi ha i demana el mode tal com és', () => {
        const { meta } = run();
        expect(meta.requested).toBe('new');
        expect(meta.mode).toBe('new');
        expect(meta.discover.artists).toBeGreaterThan(20);
        expect(meta.discover.relaxed).toBe(false);
        expect(meta.note).toMatch(/Ràdio de descoberta: \d+ artistes que encara no has escoltat\./);
    });

    it('funciona també sense historial (tot és nou) sense dir que «falta historial»', () => {
        const { meta, queue } = radio(ctx, catalog, { seed: catalog[0], signals: E.emptySignals(), mode: 'new' });
        expect(queue.length).toBeGreaterThan(20);
        expect(meta.mode).toBe('new');
        expect(meta.note).not.toMatch(/historial/);
    });

    it('si gairebé tot és conegut, ho diu i completa amb artistes poc escoltats (mai amb els seguits)', () => {
        const sigs = E.emptySignals();
        for (let a = 0; a < 30; a++) {
            // 26 artistes de 30 seguits; la resta, només escoltats una mica
            if (a < 26) sigs.followed.add(`cur${a}`);
            else sigs.artists[`cur${a}`] = { q: 1 };
        }
        const { queue, meta } = radio(ctx, catalog, {
            seed: catalog[200],
            signals: sigs,
            mode: 'new',
            rng: mulberry(9),
        });
        expect(meta.discover.relaxed).toBe(true);
        expect(meta.note).toMatch(/Ja coneixes gairebé tots/);
        queue.slice(1).forEach(v => {
            const a = Number(v.channelId.replace(/\D/g, ''));
            const isCurrent = v.channelId.startsWith('cur');
            if (isCurrent) expect(a).toBeGreaterThanOrEqual(26);
        });
    });

    it('una ràdio de cerca o d’artista no exclou res: el mode s’hi aplica com «Sorprèn-me»', () => {
        const { queue, meta } = run({ policy: 'search' });
        const artists = queue.slice(1).map(v => v.channelId);
        expect(artists.some(artist => knownKeys.includes(artist))).toBe(true);
        expect(meta.discover).toBeNull();
        expect(meta.requested).toBe('new');
    });

    it('el feed «Recomanat per a tu» no exclou res amb «Fora del meu radar»', () => {
        const list = catalog.slice(0, 60);
        const ranked = E.rankFeed(list, { ctx, signals: signals(), mode: 'new', rng: mulberry(3), now: NOW });
        expect(ranked.length).toBe(list.length);
    });

    it('isNewArtist: seguit, cor, escoltat o amb rastre no són nous', () => {
        const sigs = E.emptySignals();
        sigs.followed.add('a');
        sigs.likedArtists.b = 1;
        sigs.artists.c = { q: 1 };
        sigs.artists.d = { s: 1 };
        expect(['a', 'b', 'c', 'd', 'e', ''].map(x => E.isNewArtist(x, sigs))).toEqual([
            false,
            false,
            false,
            false,
            true,
            false,
        ]);
    });
});

// ---------- Preferència per música antiga ----------

describe('música antiga: només amb gust explícit', () => {
    const catalog = syntheticCatalog();
    const ctx = makeCtx(catalog);
    const historicShare = signals => {
        let hist = 0;
        let total = 0;
        for (let i = 0; i < 30; i++) {
            const { queue } = radio(ctx, catalog, { seed: catalog[i * 2], signals, rng: mulberry(i + 7) });
            queue.slice(0, 20).forEach(v => {
                total += 1;
                if (ctx.features.get(v.id).tier === 'historic') hist += 1;
            });
        }
        return hist / total;
    };

    it('un únic clic en una peça antiga no canvia la proporció', () => {
        const old = catalog.find(v => v.channelId === 'old1');
        const sigs = E.emptySignals();
        sigs.songs[old.id] = { h: 1, l: NOW - DAY };
        sigs.artists.old1 = { h: 1 };
        const pref = E.eraPreference(ctx, sigs, {});
        expect(pref.strong).toBe(false);
        expect(pref.maxHistoricTop).toBe(2);
        expect(historicShare(sigs)).toBeLessThanOrEqual(0.11);
    });

    it('seguir, cors i escoltes voluntàries d’antics adapten la selecció, sense ser tota la ràdio', () => {
        const sigs = E.emptySignals();
        sigs.followed.add('old1');
        sigs.followed.add('old2');
        catalog
            .filter(v => v.channelId === 'old1')
            .slice(0, 3)
            .forEach(v => {
                sigs.liked.add(v.id);
                sigs.songs[v.id] = { q: 4, f: 3, r: 3, l: NOW - 2 * DAY };
            });
        const pref = E.eraPreference(ctx, sigs, {});
        expect(pref.strong).toBe(true);
        expect(pref.maxHistoricTop).toBeGreaterThan(2);
        const share = historicShare(sigs);
        expect(share).toBeGreaterThan(0.2);
        expect(share).toBeLessThanOrEqual(0.61);
    });

    it('la política de catàleg històric explícit no aplica els límits', () => {
        const candidates = catalog.filter(v => v.channelId.startsWith('old'));
        const result = E.selectRadio({
            ctx,
            candidates,
            seed: candidates[0],
            signals: E.emptySignals(),
            policy: 'historic',
            rng: mulberry(3),
        });
        expect(result.queue.length).toBeGreaterThan(10);
        expect(result.queue.every(v => ctx.features.get(v.id).tier === 'historic')).toBe(true);
    });

    it('la política de cerca no aplica la mescla d’antiguitat: entren totes les cançons trobades', () => {
        // Resultats d'una cerca: només cançons antigues, de pocs artistes (la política general en deixaria molt fora)
        const candidates = catalog.filter(v => v.channelId.startsWith('old'));
        const general = E.selectRadio({
            ctx,
            candidates,
            seed: candidates[0],
            signals: E.emptySignals(),
            count: candidates.length,
            rng: mulberry(4),
        });
        const search = E.selectRadio({
            ctx,
            candidates,
            seed: candidates[0],
            signals: E.emptySignals(),
            policy: 'search',
            count: candidates.length,
            rng: mulberry(4),
        });
        // La general ha de compensar la manca de música actual (i ho avisa); la de cerca usa el que hi ha, tal qual
        const littleRecent = note => note.includes('poca música dels darrers anys');
        expect(general.meta.notes.some(littleRecent)).toBe(true);
        expect(search.meta.notes.some(littleRecent)).toBe(false);
        expect(search.queue.length).toBeGreaterThanOrEqual(candidates.length - 1);
        expect(new Set(search.queue.map(v => v.id)).size).toBe(search.queue.length);
        expect(search.queue.every(v => ctx.features.get(v.id).tier === 'historic')).toBe(true);
    });
});

// ---------- Ràdio amb diversos estils ----------

describe('estils barrejats', () => {
    const videos = [];
    for (let a = 0; a < 12; a++)
        for (let i = 0; i < 3; i++)
            videos.push(song(`p${a}`, { years: 0.3 + i * 0.4, style: 'Pop', views: 9000 - a * 300 }));
    for (let a = 0; a < 12; a++)
        for (let i = 0; i < 3; i++)
            videos.push(song(`r${a}`, { years: 0.3 + i * 0.4, style: 'Rock', views: 900 + a * 10 }));
    const ctx = makeCtx(videos);
    const mix = { labels: ['Pop', 'Rock'], tagOf: v => (v.categories || []).filter(x => ['Pop', 'Rock'].includes(x)) };

    it('reparteix els estils a parts iguals encara que un sigui molt més popular', () => {
        for (let i = 0; i < 10; i++) {
            const rng = mulberry(30 + i);
            const seed = videos[i];
            const result = E.selectRadio({
                ctx,
                candidates: videos.filter(v => v.id !== seed.id),
                seed,
                signals: E.emptySignals(),
                rng,
                mix,
            });
            const queue = [seed, ...result.queue].slice(0, 20);
            const rock = queue.filter(v => v.categories[0] === 'Rock').length / queue.length;
            expect(rock).toBeGreaterThanOrEqual(0.4);
            expect(rock).toBeLessThanOrEqual(0.6);
        }
    });

    it('sense «mix» la popularitat mana i no hi ha repartiment', () => {
        const seed = videos[0];
        const result = E.selectRadio({
            ctx,
            candidates: videos.filter(v => v.id !== seed.id),
            seed,
            signals: E.emptySignals(),
            rng: mulberry(1),
        });
        const queue = [seed, ...result.queue].slice(0, 20);
        expect(queue.filter(v => v.categories[0] === 'Rock').length / queue.length).toBeLessThan(0.4);
    });

    it('el que ja hi ha a la cua compta per al repartiment', () => {
        const pops = videos.filter(v => v.categories[0] === 'Pop').slice(0, 6);
        const rest = videos.filter(v => !pops.includes(v));
        const result = E.selectRadio({
            ctx,
            candidates: rest,
            seed: pops[0],
            preceding: pops,
            signals: E.emptySignals(),
            rng: mulberry(2),
            mix,
            count: 12,
        });
        // Ja hi ha 6 de Pop: els nous s'han d'inclinar cap a Rock
        expect(result.queue.filter(v => v.categories[0] === 'Rock').length).toBeGreaterThan(result.queue.length / 2);
        expect(result.meta.mix).toBeTruthy();
    });
});

// ---------- Categories petites ----------

describe('categories amb poca música actual', () => {
    it('conserven la categoria, ho comuniquen i mantenen els límits d’artista', () => {
        const videos = [];
        for (let a = 0; a < 3; a++) videos.push(song(`cs${a}`, { years: 0.4, style: 'Jazz / Blues' }));
        for (let a = 0; a < 10; a++) {
            for (let i = 0; i < 3; i++) videos.push(song(`old${a % 6}`, { years: 30 + i + a, style: 'Jazz / Blues' }));
        }
        const ctx = makeCtx(videos);
        const { queue, meta } = radio(ctx, videos, { seed: videos[0], rng: mulberry(4), category: 'Jazz / Blues' });
        expect(queue.every(v => v.categories.includes('Jazz / Blues'))).toBe(true);
        expect(meta.notes.join(' ')).toMatch(/poca música dels darrers anys/);
        expect(queue.filter(v => ctx.features.get(v.id).tier === 'historic').length).toBeGreaterThan(2);
        expect(E.summarize(queue, ctx).maxSameArtistTop).toBeLessThanOrEqual(3);
    });

    it('no omple la cua amb peces inadequades per arribar a 40', () => {
        const videos = [song('one', { years: 0.2 }), song('two', { years: 0.3 }), song('three', { years: 0.4 })];
        const ctx = makeCtx(videos);
        const { queue } = radio(ctx, videos, { seed: videos[0], rng: mulberry(1) });
        expect(queue.length).toBe(3);
    });
});

// ---------- Límits sobre el resultat final ----------

describe('límits aplicats al resultat final', () => {
    it('arrange manté els límits d’antiguitat i d’artista després d’altres ordenacions', () => {
        // 20 actuals d'un mateix canal i 80 antigues de canals diferents (el cas que un pas posterior desfeia)
        const videos = [];
        for (let i = 0; i < 20; i++) videos.push(song('single-current', { years: 0.2 + i * 0.01 }));
        for (let i = 0; i < 80; i++) videos.push(song(`arch${i}`, { years: 20 + (i % 9), original: 1990 + (i % 9) }));
        // Ordre "dolent": antigues i actuals intercalades a partir de 1/2
        const shuffled = [];
        for (let i = 0; i < 80; i++) {
            shuffled.push(videos[20 + i]);
            if (i % 4 === 0 && videos[Math.floor(i / 4)]) shuffled.push(videos[Math.floor(i / 4)]);
        }
        const ctx = makeCtx(videos);
        const out = E.arrange(shuffled, { ctx });
        const summary = E.summarize(out, ctx);
        // Amb només un canal actual, els límits s'han de relaxar gradualment, però no desaparèixer: mai dues antigues seguides
        // mentre quedi una actual i un mateix artista mai seguit de si mateix.
        expect(summary.consecutiveHistoric).toBeLessThanOrEqual(summary.historicTop);
        expect(out.length).toBeGreaterThanOrEqual(shuffled.length - 5);
    });

    it('amb prou alternatives, arrange compleix els límits estrictes', () => {
        const catalog = syntheticCatalog();
        const ctx = makeCtx(catalog);
        for (let i = 0; i < 10; i++) {
            const rng = mulberry(i + 60);
            // Ordre inicial aleatori (com si ve d'una altra ordenació)
            const order = catalog.slice().sort(() => rng() - 0.5);
            const out = E.arrange(order, { ctx });
            const summary = E.summarize(out.slice(0, 60), ctx);
            expect(summary.historicTop).toBeLessThanOrEqual(2);
            expect(summary.consecutiveHistoric).toBe(0);
            expect(summary.maxSameArtistTop).toBeLessThanOrEqual(2);
        }
    });

    it('rankFeed conserva tot el catàleg i aplica els límits de dalt', () => {
        const catalog = syntheticCatalog();
        const ctx = makeCtx(catalog);
        const ranked = E.rankFeed(catalog, { ctx, signals: E.emptySignals(), rng: mulberry(9) });
        const summary = E.summarize(ranked, ctx);
        expect(ranked.length).toBe(catalog.length);
        expect(summary.historicTop).toBeLessThanOrEqual(2);
        expect(summary.maxSameArtistTop).toBeLessThanOrEqual(2);
    });
});

// ---------- Torna-hi ----------

describe('Torna-hi', () => {
    const catalog = syntheticCatalog();
    const ctx = makeCtx(catalog);

    it('només proposa cançons amb evidència real i no repeteix artista', () => {
        const sigs = E.emptySignals();
        const [a, b, c] = ['cur1', 'cur2', 'cur3'].map(ch => catalog.find(v => v.channelId === ch));
        sigs.liked.add(a.id);
        sigs.songs[b.id] = { q: 3, f: 2, r: 2, l: NOW - 2 * DAY };
        sigs.songs[c.id] = { h: 1, l: NOW - DAY }; // només una visita antiga: no és evidència
        const items = E.pickReturn({ ctx, candidates: catalog, signals: sigs, limit: 4, now: NOW, rng: mulberry(1) });
        const ids = items.map(item => item.video.id);
        expect(ids).toContain(a.id);
        expect(ids).toContain(b.id);
        expect(ids).not.toContain(c.id);
        expect(new Set(items.map(item => item.video.channelId)).size).toBe(items.length);
        expect(items.find(item => item.video.id === a.id).reason).toBe('Una de les teves preferides');
    });

    it('una cançó escoltada fa un moment descansa abans de tornar', () => {
        const sigs = E.emptySignals();
        const a = catalog.find(v => v.channelId === 'cur1');
        sigs.liked.add(a.id);
        sigs.songs[a.id] = { q: 2, l: NOW - 30 * 60000 };
        expect(E.pickReturn({ ctx, candidates: catalog, signals: sigs, limit: 4, rng: mulberry(1) })).toHaveLength(0);
    });

    it('les explicacions només diuen el que és cert', () => {
        const sigs = E.emptySignals();
        const v = catalog.find(x => x.channelId === 'cur2');
        expect(E.reasonFor(v, ctx, sigs)).toBe('');
        sigs.followed.add('cur2');
        expect(E.reasonFor(v, ctx, sigs)).toBe(`Perquè segueixes ${v.channelTitle}`);
        sigs.liked.add(v.id);
        expect(E.reasonFor(v, ctx, sigs)).toBe('Una de les teves preferides');
    });
});

// ---------- Configuració ----------

describe('configuració i reversibilitat', () => {
    it('els llindars són configurables i es pot tornar a la política anterior', () => {
        const sel = loadScript('js/features/music-selection.js').SegueixApp.features.musicSelection;
        expect(sel.getConfig().general.maxHistoricTop).toBe(2);
        expect(sel.setConfigOverrides({ general: { maxHistoricTop: 4 } }).general.maxHistoricTop).toBe(4);
        expect(sel.isEnabled()).toBe(true);
        sel.setConfigOverrides({ engine: 'legacy' });
        expect(sel.isEnabled()).toBe(false);
        sel.setConfigOverrides({});
        expect(sel.isEnabled()).toBe(true);
    });

    it('els pesos sumen 1', () => {
        const w = E.getConfig().weights;
        expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
        const t = E.getConfig().era.target;
        expect(t.recent + t.mid + t.historic).toBeCloseTo(1, 10);
    });
});

// ---------- Catàleg real (simulació) ----------

describe('simulació sobre el catàleg real', () => {
    const feed = JSON.parse(readFileSync(new URL('../data/feed.json', import.meta.url), 'utf8'));
    const classicNames = new Set(
        JSON.parse(readFileSync(new URL('../data/musica-classica.json', import.meta.url), 'utf8')).artistes.map(n =>
            n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        )
    );
    const artists = JSON.parse(readFileSync(new URL('../data/artistes-musica.json', import.meta.url), 'utf8')).artists;
    const classicChannels = new Set();
    artists.forEach(artist => {
        const name = artist.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        if (classicNames.has(name)) (artist.youtube?.channels || []).forEach(c => classicChannels.add(c.id));
    });
    const songs = feed.videos.filter(
        v => ['song', 'live_song'].includes(v.contentType) && !v.isShort && (v.durationSeconds || 0) >= 60
    );
    const ctx = E.createContext({
        videos: songs,
        now: NOW,
        isClassicArtist: v => classicChannels.has(v.channelId),
        stylesOf: v => (v.categories || []).map(x => x.toLowerCase()),
    });
    const QUICO = 'UCerj0bWFVJdAmPWVti9Uhlw';
    const TYETS = 'UC--8TyZ2PM0NFHWXCzQrUqw';

    const runs = (signals, count = 40, extra = {}) =>
        Array.from({ length: count }, (_, i) => {
            const rng = mulberry(2000 + i);
            const seed = songs[Math.floor(rng() * songs.length)];
            const result = E.selectRadio({
                ctx,
                candidates: songs.filter(v => v.id !== seed.id),
                seed,
                signals: signals || E.emptySignals(),
                mode: 'mix',
                rng,
                ...extra,
            });
            return [seed, ...result.queue];
        });
    const presence = (queues, channel) =>
        queues.filter(q => q.slice(0, 20).some(v => v.channelId.toLowerCase() === channel.toLowerCase())).length /
        queues.length;

    it('usuari nou: 65 / 25 / 10 orientatiu, límits complerts i descoberta variada', { timeout: 20000 }, () => {
        const queues = runs(null, 60);
        const totals = { recent: 0, mid: 0, historic: 0 };
        let n = 0;
        queues.forEach(queue => {
            const s = E.summarize(queue, ctx);
            expect(s.historicTop).toBeLessThanOrEqual(2);
            expect(s.consecutiveHistoric).toBe(0);
            expect(s.maxSameArtistTop).toBeLessThanOrEqual(2);
            expect(s.distinctArtists).toBeGreaterThanOrEqual(15);
            expect(s.minArtistGap === null || s.minArtistGap >= 3).toBe(true);
            Object.keys(totals).forEach(k => (totals[k] += s.topEra[k]));
            n += Math.min(20, queue.length);
        });
        expect(totals.recent / n).toBeGreaterThan(0.58);
        expect(totals.recent / n).toBeLessThan(0.72);
        expect(totals.historic / n).toBeGreaterThan(0.06);
        expect(totals.historic / n).toBeLessThanOrEqual(0.1);
    });

    it('cap cua té cançons repetides ni una mateixa gravació dues vegades', () => {
        runs(null, 20).forEach(queue => {
            expect(new Set(queue.map(v => v.id)).size).toBe(queue.length);
            const keys = queue.map(v => ctx.features.get(v.id).keys);
            for (let i = 0; i < keys.length; i++) {
                for (let j = i + 1; j < keys.length; j++) expect(E.isSameRecording(keys[i], keys[j])).toBe(false);
            }
        });
    });

    it('Quico Pi de la Serra: presència ocasional sense gust; s’adapta amb gust explícit', { timeout: 120000 }, () => {
        const general = runs(null, 250);
        const generalPresence = presence(general, QUICO);
        general.forEach(q => expect(q.slice(0, 20).filter(v => v.channelId === QUICO).length).toBeLessThanOrEqual(2));
        expect(generalPresence).toBeGreaterThan(0);
        expect(generalPresence).toBeLessThan(0.2);

        const sigs = E.emptySignals();
        sigs.followed.add(QUICO);
        const quico = songs.filter(v => v.channelId === QUICO).slice(0, 4);
        quico.forEach(v => {
            sigs.liked.add(v.id);
            sigs.songs[v.id] = { q: 4, f: 3, r: 3, l: NOW - 3 * DAY };
        });
        const pref = E.eraPreference(ctx, sigs, {});
        expect(pref.strong).toBe(true);
        const personalised = runs(sigs, 100);
        expect(presence(personalised, QUICO)).toBeGreaterThan(generalPresence * 3);
        // Tampoc s'hi converteix tota la ràdio: mai més de 2 peces seves cada 20
        personalised.forEach(q =>
            expect(q.slice(0, 20).filter(v => v.channelId === QUICO).length).toBeLessThanOrEqual(2)
        );
    });

    it('seguir The Tyets n’augmenta l’afinitat sense monopolitzar la ràdio', { timeout: 120000 }, () => {
        const base = E.emptySignals();
        ['UC57d8FV0O8sOiK6-K-gWNHA', 'UCerj0bWFVJdAmPWVti9Uhlw', 'UCRorZVV2oAZON-OvXaQQD2g'].forEach(k =>
            base.followed.add(k.toLowerCase())
        );
        const before = presence(runs(base, 100), TYETS.toLowerCase());
        const withFollow = E.emptySignals();
        base.followed.forEach(k => withFollow.followed.add(k));
        withFollow.followed.add(TYETS.toLowerCase());
        const queues = runs(withFollow, 100);
        expect(presence(queues, TYETS.toLowerCase())).toBeGreaterThan(before);
        queues.forEach(q =>
            expect(
                q.slice(0, 20).filter(v => v.channelId.toLowerCase() === TYETS.toLowerCase()).length
            ).toBeLessThanOrEqual(2)
        );
    });

    it('les cançons amb any original antic pujades fa poc no són novetats', () => {
        const reissues = songs.filter(v => E.eraOf(v, { now: NOW }).isReissue);
        expect(reissues.length).toBeGreaterThan(100);
        reissues.slice(0, 200).forEach(v => expect(E.isNewRelease(v, { now: NOW })).toBe(false));
    });

    it('el temps de selecció és compatible amb el mòbil (context una vegada, cua < 250 ms)', () => {
        const start = Date.now();
        runs(null, 5);
        const perQueue = (Date.now() - start) / 5;
        expect(perQueue).toBeLessThan(250);
    });
});



describe('ràdio personal: varietat entre arrencades', () => {
    const videos = Array.from({ length: 160 }, (_, a) =>
        Array.from({ length: 5 }, (_, i) => song(`var${a}`, { views: 1000000 / (i + 1), title: `Peça ${a} ${i}` }))).flat();
    const ctx = makeCtx(videos);
    const signals = E.emptySignals();
    signals.followed = new Set(Array.from({ length: 80 }, (_, i) => `var${i}`));
    const isOwn = v => signals.followed.has(v.channelId);
    const make = (seed, opts = {}) => E.selectRadio({ ctx, candidates: videos, signals, policy: 'personal', count: 40, rng: mulberry(seed), ...opts });
    it('reparteix 24 preferides i 16 afins, varia la cua i separa quatre cançons entre artistes', () => {
        const orders = new Set();
        for (let i = 0; i < 10; i++) {
            const result = make(i);
            expect(result.queue).toHaveLength(40);
            expect(result.queue.filter(isOwn)).toHaveLength(24);
            result.queue.forEach((v, at, list) => expect(list.slice(Math.max(0, at - 4), at).map(x => x.channelId)).not.toContain(v.channelId));
            orders.add(result.queue.map(v => v.id).join(','));
        }
        expect(orders.size).toBe(10);
    });
    it('renova almenys el 70 % i no repeteix les últimes 20 escoltades ni les cinc arrencades', () => {
        let previousIds = [], starts = [];
        const recent = videos.slice(50, 70).map(v => ({ id: v.id, at: NOW }));
        for (let i = 0; i < 10; i++) {
            const first = make(100 + i, { count: 1, firstPersonal: true, avoidStarts: starts, previousIds, signals: { ...signals, recent } }).queue[0];
            expect(starts).not.toContain(first.id);
            const tail = make(200 + i, { count: 39, seed: first, preceding: [first], previousIds, signals: { ...signals, recent } }).queue;
            const queue = [first, ...tail];
            expect(queue.filter(v => previousIds.includes(v.id)).length).toBeLessThanOrEqual(12);
            expect(queue.some(v => recent.some(r => r.id === v.id))).toBe(false);
            expect(queue.filter(isOwn)).toHaveLength(24);
            previousIds = queue.map(v => v.id); starts = [first.id, ...starts].slice(0, 5);
        }
    });
    it('els èxits tenen més probabilitat, però no monopolitzen el sorteig', () => {
        const pair = [song('popular', { views: 1000000 }), song('minor', { views: 100 })];
        const pairCtx = makeCtx(pair);
        let popular = 0;
        for (let i = 0; i < 200; i++) {
            const result = E.selectRadio({ ctx: pairCtx, candidates: pair, signals: E.emptySignals(), policy: 'personal', count: 1, rng: mulberry(i) });
            if (result.queue[0].id === pair[0].id) popular++;
        }
        expect(popular).toBeGreaterThan(140); expect(popular).toBeLessThan(200);
    });
    it('amb un catàleg petit relaxa la varietat, però no duplica ni recupera descartats', () => {
        const small = videos.slice(0, 5), sig = E.emptySignals(); sig.lessLike.add(small[0].id);
        const result = E.selectRadio({ ctx, candidates: small, signals: { ...sig, recent: small.map(v => ({ id: v.id, at: NOW })) }, policy: 'personal', previousIds: small.map(v => v.id), count: 40, rng: mulberry(1) });
        expect(result.queue).toHaveLength(4);
        expect(new Set(result.queue.map(v => v.id)).size).toBe(4);
        expect(result.queue.some(v => v.id === small[0].id)).toBe(false);
        expect(result.meta.relaxedLevel).toBeGreaterThan(0);
    });
});
