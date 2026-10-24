import { describe, it, expect } from 'vitest';
import { loadScript } from './setup.js';
import { expectMovedByUser } from './afinitats-cataleg.js';
const app = loadScript('js/features/music-affinities.js').SegueixApp;
const A = app.features.musicAffinities;
const E = loadScript('js/features/music-selection.js', { SegueixApp: app }).SegueixApp.features.musicSelection;
const profiles = A.profilesFor('Punk');
const song = (name, n = 0) => {
    const p = profiles.find(p => p.artist === name);
    const channelId = p.channelIds[0];
    return {
        id: p.allowedVideoIdsByChannel?.[channelId]?.[n] || `${name}-${n}`,
        channelId,
        channelTitle: name,
        title: `Peça ${n}`,
        contentType: 'song',
        categories: ['Punk'],
        durationSeconds: 210,
        publishedAt: '2026-03-01T12:00:00Z',
        viewCount: 5000,
    };
};
const select = (videos, extra = {}) =>
    E.selectRadio({
        ctx: E.createContext({ videos, now: Date.parse('2026-10-13T12:00:00Z') }),
        seed: videos[0],
        candidates: videos.slice(1),
        signals: E.emptySignals(),
        category: 'Punk',
        count: videos.length - 1,
        rng: () => 0.5,
        ...extra,
    }).queue;
describe('afinitats Punk', () => {
    it('conserva els 53 perfils detallats i 70 canals sense duplicar Bestiari', () => {
        expect(profiles).toHaveLength(53);
        const ids = profiles.flatMap(p => p.channelIds);
        expect(ids).toHaveLength(70);
        // Ebri Knight (a Folk i arrel) i Vicky l’Arròs (a Electrònica) ja no són a Punk: decisions de l'usuari
        expectMovedByUser(expect, profiles, 'Punk');
        const all = A.profiles.flatMap(p => p.channelIds);
        expect(new Set(all).size).toBe(all.length);
        expect(A.profiles.filter(p => p.artist === 'Bestiari')).toHaveLength(1);
        for (const p of profiles) expect(p.sources.length).toBeGreaterThan(0);
    });
    it('distingeix pop punk, Oi!, hardcore, folk i post-hardcore', () => {
        for (const [seed, near, far] of [
            ['Panellet', 'Les Buch', 'Sota Terra'],
            ['Lladruc', 'Opció K-95', 'Tano!'],
            ['Bonestorm', 'En Brut', 'Panellet'],
            ['Ebri Knight', 'X-Fanekaes', "L'Odi Social"],
            ['Mendra', 'Tano!', 'Ebri Knight'],
        ]) {
            expect(A.similarity(song(seed), song(near))).toBeGreaterThan(A.similarity(song(seed), song(far)));
            expect(A.similarity(song(seed), song(near))).toBe(A.similarity(song(near), song(seed)));
        }
    });
    it('manté compatible el pilot per facets amb el selector anterior', () => {
        const videos = ['Lladruc', 'Tano!', 'Opció K-95'].map(n => song(n));
        expect(select(videos, { count: 1, artistFirst: false })[0].id).toBe(videos[2].id);
        expect(select(videos, { count: 1, affinities: false, artistFirst: false })[0].id).toBe(videos[1].id);
    });
    it('no propaga perfils a vídeos no revisats dels canals compartits', () => {
        for (const name of ['ASSAC!', 'Budellam', 'Mendra', 'Vàlius']) {
            const v = song(name);
            expect(A.profileOf(v)?.artist).toBe(name);
            expect(A.profileOf({ ...v, id: 'unreviewed' })).toBeNull();
            expect(A.profileOf({ ...v, channelId: 'wrong' })).toBeNull();
            expect(A.profileOf({ ...v, title: 'Tema (remix)' })).toBeNull();
        }
    });
    it('manté neutres els subestils pendents, versions i desconeguts', () => {
        const seed = song('Panellet');
        for (const v of [
            song('Coça'),
            song('Vàlius'),
            { channelId: 'unknown' },
            { ...song('Les Buch'), contentType: 'live_song' },
            { ...song('Les Buch'), title: 'Tema acústic' },
        ]) {
            expect(A.similarity(seed, v)).toBe(0.5);
            expect(A.transition(v, seed, seed)).toBe(0);
        }
    });
    it('conserva els candidats, la varietat i la separació', () => {
        const videos = profiles.flatMap(p => [song(p.artist), song(p.artist, 1)]);
        const q = [videos[0], ...select(videos)];
        expect(q).toHaveLength(videos.length);
        expect(new Set(q.map(v => v.id)).size).toBe(videos.length);
        expect(new Set(q.map(v => v.channelId)).size).toBe(53);
        for (let i = 1; i < 20; i++)
            expect(q.slice(Math.max(0, i - 3), i).map(v => v.channelId)).not.toContain(q[i].channelId);
    });
    it('només activa Punk en ràdios de categoria única', () => {
        expect(A.isActive('Punk')).toBe(true);
        expect(A.isActive(['Punk'])).toBe(true);
        const videos = ['Lladruc', 'Tano!', 'Opció K-95'].map(n => song(n));
        for (const opts of [
            { category: 'Pop' },
            { category: ['Punk', 'Heavy / Metal'] },
            { policy: 'search' },
            { policy: 'historic' },
            { mix: { labels: ['Punk', 'Pop'], tagOf: () => ['Punk'] } },
        ]) {
            expect(select(videos, opts)).toEqual(select(videos, { ...opts, affinities: false }));
        }
    });
});

