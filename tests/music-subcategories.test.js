import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadScript } from './setup.js';
const catalog = loadScript('js/features/music-affinity-catalog.js').SegueixMusicAffinityCatalog;
const app = loadScript('js/features/music-affinities.js', { SegueixMusicAffinityCatalog: catalog }).SegueixApp;
const A = app.features.musicAffinities;
const E = loadScript('js/features/music-selection.js', { SegueixApp: app }).SegueixApp.features.musicSelection;
const rng = n => () => {
    let t = n += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
const song = (artist, id = artist) => ({ id, channelId: artist, title: id, contentType: 'song',
    categories: ['Rock'], originalYear: 2026, publishedAt: '2026-08-01', durationSeconds: 180, viewCount: 100 });
const now = Date.parse('2026-10-13');
function queue(videos, seed, count = 1, options = {}) {
    return E.selectRadio({ ctx: E.createContext({ videos, now }), candidates: videos, count,
        rng: rng(seed), signals: E.emptySignals(), ...options }).queue;
}

describe('una subcategoria per artista', () => {
    it('cobreix tots els artistes amb una sola etiqueta vàlida i una categoria principal', () => {
        expect(catalog.schemaVersion).toBe(2);
        const ids = new Set(catalog.subcategories.map(s => s.id));
        for (const p of A.profiles) {
            expect(typeof p.subcategory, p.artist).toBe('string');
            expect(ids.has(p.subcategory), p.artist).toBe(true);
            expect(catalog.subcategories.find(s => s.id === p.subcategory).category).toBe(p.primaryCategory);
        }
        for (const sub of catalog.subcategories) {
            const artists = A.profiles.filter(p => p.subcategory === sub.id);
            expect(sub.artistCount).toBe(artists.length);
            expect(sub.nucleus).toBe(artists.length >= 5);
            expect(new Set(sub.artists).size).toBe(sub.artistCount);
            for (const other of sub.neighbours) expect(catalog.subcategories.find(s => s.id === other).neighbours).toContain(sub.id);
        }
    });
    it('la quantitat de facets o la confiança documental no donen avantatge musical', () => {
        const p = A.profiles.find(p => p.subcategory === 'rock-general');
        const q = A.profiles.find(q => q !== p && q.subcategory === p.subcategory);
        const before = A.subcategorySimilarity(p, q);
        expect(A.subcategorySimilarity({ ...p, facets: ['cent', 'etiquetes'], confidence: .1 }, q)).toBe(before);
        expect(before).toBe(.9);
    });
    it('connecta Moto Clua amb el rock psicodèlic i el folk-rock sense assignar segones etiquetes', () => {
        const p = name => A.profiles.find(p => p.artist === name);
        expect(p('Moto Clua').subcategory).toBe('rock-progressiu');
        expect(p('La Iaia').subcategory).toBe('folk-rock');
        expect(p('Remei de Ca la Fresca').subcategory).toBe('rock-psicodelic');
        expect(A.subcategorySimilarity(p('Moto Clua'), p('La Iaia'))).toBe(.7);
        expect(A.subcategorySimilarity(p('Moto Clua'), p('Remei de Ca la Fresca'))).toBe(.7);
    });
    it('el mínim de cinc compta artistes, no pistes ni canals, i obre els veïns quan cal', () => {
        const custom = { schemaVersion: 2, minimumArtists: 5, relations: [],
            subcategories: [{ id: 'a', neighbours: ['b'] }, { id: 'b', neighbours: ['a'] }],
            profiles: Array.from({ length: 5 }, (_, i) => ({ artist: 'group' + i,
                channelIds: ['channel' + i, 'topic' + i], categories: ['Rock'], primaryCategory: 'Rock',
                subcategory: 'a', facets: [], places: [] })).concat([{ artist: 'neighbour',
                channelIds: ['other'], categories: ['Rock'], primaryCategory: 'Rock', subcategory: 'b', facets: [], places: [] }]) };
        const a = loadScript('js/features/music-affinities.js', { SegueixMusicAffinityCatalog: custom }).SegueixApp.features.musicAffinities;
        const seed = song('channel0'); const other = song('other');
        const duplicates = Array.from({ length: 30 }, (_, i) => song(i % 2 ? 'channel0' : 'topic0', 'id' + i));
        expect(a.radioContext(duplicates, seed).seedArtists).toBe(1);
        expect(a.radioContext(duplicates, seed).tier(other)).toBe(0);
        expect(a.radioContext(Array.from({ length: 5 }, (_, i) => song('channel' + i)), seed).tier(other)).toBe(1);
    });
    it('la geografia és simètrica, limitada a 50 km i no s’inventa quan falta', () => {
        const a = { places: [{ id: 'vic', latitude: 41.93, longitude: 2.25 }] };
        const b = { places: [{ id: 'barcelona', latitude: 41.38, longitude: 2.17 }] };
        expect(A.proximity(a, a)).toBe(1);
        expect(A.proximity(a, b)).toBe(0);
        expect(A.proximity(a, {})).toBe(0);
        expect(A.proximity(a, b)).toBe(A.proximity(b, a));
    });
    it('el selector real prioritza el nucli i amplia quan els seus artistes estan bloquejats', () => {
        const sub = catalog.subcategories.find(s => s.artistCount >= 5 && s.id === 'punk-oi');
        const ps = A.profiles.filter(p => p.subcategory === sub.id);
        const video = p => {
            const id = p.channelIds[0];
            return { ...song(id, p.allowedVideoIdsByChannel?.[id]?.[0] || p.artist), categories: ['Punk'] };
        };
        const close = ps.map(video);
        const far = video(A.profiles.find(p => p.subcategory === 'punk-post'));
        const videos = [...close, far];
        const ctx = E.createContext({ videos, now });
        const signals = E.emptySignals(); signals.followed.add(far.channelId.toLowerCase());
        const select = () => E.selectRadio({ ctx, seed: close[0], candidates: videos.slice(1),
            signals, category: 'Punk', count: 1, rng: rng(5) });
        expect(close.slice(1).map(v => v.id)).toContain(select().queue[0].id);
        close.slice(1).forEach(v => signals.blockedArtists.add(v.channelId.toLowerCase()));
        expect(select().queue[0].id).toBe(far.id);
    });
});

describe('igualtat entre catàlegs', () => {
    it('un artista amb 50 pistes no guanya oportunitats davant d’un amb una', () => {
        const small = [song('A'), song('B')];
        const large = [song('A'), ...Array.from({ length: 50 }, (_, i) => song('B', 'B' + i))];
        let b = 0;
        for (let i = 1; i <= 400; i++) {
            const x = queue(small, i)[0].channelId;
            const y = queue(large, i)[0].channelId;
            expect(y).toBe(x);
            if (y === 'B') b++;
        }
        expect(b).toBeGreaterThan(150);
        expect(b).toBeLessThan(250);
    });
    it('no exclou artistes petits pel límit global de pistes', () => {
        const videos = [song('A'), ...Array.from({ length: 400 }, (_, i) => song('B', 'B' + i))];
        const selected = new Set(Array.from({ length: 30 }, (_, i) => queue(videos, i + 1)[0].channelId));
        expect([...selected].sort()).toEqual(['A', 'B']);
    });
    it('oficial i Topic compten com un sol artista, i les preferències de cançó continuen actives', () => {
        const videos = [song('official', 'normal'), song('topic', 'preferida')];
        const ctx = E.createContext({ videos, now, artistKeyOf: () => 'grup' });
        const signals = E.emptySignals(); signals.liked.add('preferida');
        const result = E.selectRadio({ ctx, candidates: videos, signals, count: 1, rng: rng(3) });
        expect(result.queue[0].id).toBe('preferida');
        expect(result.meta.artists).toBe(1);
    });
    it('no modifica el repertori publicat ni les exclusions de la ràdio', () => {
        const videos = [song('A'), song('B'), song('C')];
        const signals = E.emptySignals(); signals.blockedArtists.add('b'); signals.lessLike.add('C');
        expect(queue(videos, 1, 10, { signals }).map(v => v.id)).toEqual(['A']);
        const report = JSON.parse(readFileSync('data/music-subcategory-coverage.json', 'utf8'));
        expect(report.assignments.length).toBe(A.profiles.length);
    });
});
