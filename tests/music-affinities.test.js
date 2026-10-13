import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadScript } from './setup.js';

const app = loadScript('js/features/music-affinities.js').SegueixApp;
const A = app.features.musicAffinities;
const E = loadScript('js/features/music-selection.js', { SegueixApp: app }).SegueixApp.features.musicSelection;
const profiles = A.profilesFor(A.category);
const NOW = Date.parse('2026-10-13T12:00:00Z');
const song = (profile, i = 0) => ({
    id: `test-${profile.artist}-${i}`, channelId: profile.channelIds[0], channelTitle: profile.artist,
    title: `Peça ${profile.artist} ${i}`, contentType: 'song', categories: [A.category],
    publishedAt: '2026-01-01T12:00:00Z', durationSeconds: 200, viewCount: 5000,
});
const find = name => song(profiles.find(p => p.artist === name));
function select(videos, extra = {}) {
    return E.selectRadio({
        ctx: E.createContext({ videos, now: NOW }), candidates: videos.slice(1), seed: videos[0],
        count: 18, category: A.category, signals: E.emptySignals(), rng: () => 0.5, ...extra,
    }).queue;
}

describe('pilot editorial Ska / Reggae', () => {
    it('conserva els 14 perfils històrics i respecta el trasllat de Txarango a Mestissatge', () => {
        const channels = JSON.parse(readFileSync('js/channels-ca.json', 'utf8')).channels;
        const ids = profiles.flatMap(p => p.channelIds);
        expect(profiles).toHaveLength(14);
        expect(new Set(ids).size).toBe(22);
        for (const p of profiles) {
            expect(p.facets.length).toBeGreaterThan(0);
            expect(p.sources.every(url => url.startsWith('https://'))).toBe(true);
            expect(p.reviewedAt).toBe('2026-10-13');
            for (const id of p.channelIds) {
                const categories = channels.find(c => c.id === id)?.categories;
                if (p.artist === 'Txarango') {
                    expect(categories).toEqual(['Rumba / Mestissatge']);
                } else expect(categories).toContain(A.category);
            }
        }
        expect(A.profileOf({ channelId: 'UC-N1gUYe6UmwHOSQAUPH2-A' })).toBeNull();
    });
    it('distingeix afinitats documentades i és simètric', () => {
        const seed = find('Les Testarudes');
        expect(A.similarity(seed, find('Mr. Freak Ska'))).toBeGreaterThan(A.similarity(seed, find('La Pegatina')));
        expect(A.similarity(seed, find('Dr. Calypso'))).toBe(A.similarity(find('Dr. Calypso'), seed));
    });
    it('deixa neutrals els desconeguts i els arranjaments no revisats', () => {
        const seed = find('Les Testarudes');
        expect(A.similarity(seed, { channelId: 'unknown' })).toBe(0.5);
        for (const title of ['Tema Live', 'Tema (directe)', 'Tema acústic', 'Tema acoustic', 'Tema en vivo', 'Tema Remix']) {
            expect(A.profileOf({ ...seed, title })).toBeNull();
        }
        expect(A.profileOf({ ...seed, contentType: 'live_song' })).toBeNull();
        expect(A.transition({ channelId: 'unknown' }, seed, seed)).toBe(0);
    });
    it('manté compatible el pilot per facets amb el selector anterior', () => {
        const seed = find('La Pegatina');
        const previous = find('Les Testarudes');
        const options = { count: 1, preceding: [seed, previous], artistFirst: false };
        const videos = [seed, find('Brams'), find('Mr. Freak Ska')];
        expect(select(videos, options)[0].channelId).toBe(find('Mr. Freak Ska').channelId);
        expect(select(videos, { ...options, affinities: false })[0].channelId).toBe(find('Brams').channelId);
        expect(A.transition(find('Mr. Freak Ska'), previous, seed)).toBeGreaterThan(A.transition(find('Mr. Freak Ska'), seed, seed));
    });
    it('deixa exactament igual les altres categories, mescles i polítiques', () => {
        const videos = profiles.map(p => song(p));
        for (const options of [
            { category: 'Rock' }, { category: '' }, { category: ['Ska / Reggae', 'Pop'] },
            { policy: 'search' }, { policy: 'artist' }, { policy: 'historic' },
            { mix: { labels: ['Ska / Reggae', 'Pop'], tagOf: () => ['Ska / Reggae'] } },
        ]) {
            expect(select(videos, options)).toEqual(select(videos, { ...options, affinities: false }));
        }
    });
    it('conserva diversitat, separació, elegibilitat i artistes sense perfil', () => {
        const videos = profiles.flatMap(p => [song(p), song(p, 1)]);
        videos.push(song({ artist: 'Sense perfil', channelIds: ['unknown'] }));
        const queue = select(videos, { count: videos.length - 1 });
        expect(queue).toHaveLength(videos.length - 1);
        expect(queue.some(v => v.channelId === 'unknown')).toBe(true);
        const sequence = [videos[0], ...queue];
        expect(new Set(sequence.map(v => v.id)).size).toBe(sequence.length);
        expect(new Set(sequence.map(v => v.channelId)).size).toBe(15);
        for (let i = 1; i < sequence.length; i++) {
            expect(sequence[i].categories).toContain(A.category);
            expect(sequence[i].channelId).not.toBe(sequence[i - 1].channelId);
        }
        // Finestra prou poblada: el pilot no força cap relaxació de l'espaiat.
        const short = [videos[0], ...select(videos, { count: 15 })];
        for (let i = 1; i < short.length; i++) {
            expect(short.slice(Math.max(0, i - 3), i).map(v => v.channelId)).not.toContain(short[i].channelId);
        }
    });
    it('acota l’ajust i permet desactivar-lo sense dependències de xarxa', () => {
        for (const a of profiles) for (const b of profiles) {
            expect(Math.abs(A.transition(song(a), song(b), song(b)))).toBeLessThanOrEqual(0.06000001);
        }
        const bare = loadScript('js/features/music-selection.js').SegueixApp.features.musicSelection;
        const videos = profiles.map(p => song(p));
        const options = { ctx: bare.createContext({ videos, now: NOW }), candidates: videos.slice(1), seed: videos[0],
            category: A.category, signals: bare.emptySignals(), rng: () => 0.5, count: 18 };
        expect(bare.selectRadio(options).queue).toEqual(select(videos, { affinities: false }));
    });
});


