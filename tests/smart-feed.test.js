import { readFileSync } from 'node:fs';
import * as vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const smartFeedSource = readFileSync(new URL('../js/features/smart-feed.js', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const swSource = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

function bootSmartFeed(storageValues = {}) {
    const store = new Map(Object.entries(storageValues));
    const localStorage = {
        getItem(key) { return store.has(key) ? store.get(key) : null; },
        setItem(key, value) { store.set(key, String(value)); },
        removeItem(key) { store.delete(key); },
    };
    const window = {
        SegueixApp: {
            features: {
                tvLearning: {
                    affinityForVideo: () => 0,
                    sessionAffinityForVideo: () => 0,
                },
            },
        },
    };
    const context = vm.createContext({
        window,
        localStorage,
        console,
        Date,
        Math,
        Set,
        Map,
        JSON,
        Number,
        String,
        Array,
    });
    vm.runInContext(smartFeedSource, context);
    return window.SegueixApp.features.smartFeed;
}

function video(id, channelId, title, views, daysAgo = 5) {
    return {
        id,
        channelId,
        title,
        viewCount: views,
        likeCount: Math.max(1, Math.round(views * 0.04)),
        commentCount: Math.max(1, Math.round(views * 0.003)),
        publishedAt: new Date(Date.now() - daysAgo * 86400000).toISOString(),
        durationSeconds: 900,
        categories: ['Cultura'],
    };
}

describe('feed intel·ligent', () => {
    it('barreja afinitat, seguits, descoberta i sorpresa', () => {
        expect(smartFeedSource).toContain("'affinity', 'affinity', 'followed', 'discovery', 'affinity'");
        expect(smartFeedSource).toContain("'discovery', 'affinity', 'followed', 'surprise', 'affinity'");
        expect(smartFeedSource).toContain('profileAffinity(video, profile)');
        expect(smartFeedSource).toContain('qualityScore(video, baselines.get(id))');
    });

    it('aprèn de follows, cors, historial i progrés normal', () => {
        expect(smartFeedSource).toContain("'catube_follows'");
        expect(smartFeedSource).toContain("'catube_liked_videos'");
        expect(smartFeedSource).toContain("'catube_history'");
        expect(smartFeedSource).toContain("'catube_continue_watching_v1'");
        expect(smartFeedSource).toContain('ratio >= 0.6');
        expect(smartFeedSource).toContain('ratio < 0.2');
    });

    it('reutilitza els perfils històric i temporal de la TV sense dependre’n', () => {
        expect(smartFeedSource).toContain('tvLearning?.affinityForVideo?.(video)');
        expect(smartFeedSource).toContain('tvLearning?.sessionAffinityForVideo?.(video)');
        expect(smartFeedSource).toContain('if (source.length < 2) return source');
    });

    it('evita dominar els primers resultats amb un únic creador', () => {
        const api = bootSmartFeed({
            catube_follows: JSON.stringify(['followed']),
            catube_liked_videos: JSON.stringify([]),
            catube_history: JSON.stringify([]),
        });
        const videos = [
            video('a0000000001', 'dominant', 'Cultura alfa', 900000),
            video('a0000000002', 'dominant', 'Cultura beta', 850000),
            video('a0000000003', 'dominant', 'Cultura gamma', 800000),
            video('a0000000004', 'dominant', 'Cultura delta', 750000),
            video('b0000000001', 'followed', 'Cultura seguida', 10000),
            video('c0000000001', 'c', 'Cultura c', 12000),
            video('d0000000001', 'd', 'Cultura d', 11000),
            video('e0000000001', 'e', 'Cultura e', 9000),
            video('f0000000001', 'f', 'Cultura f', 8000),
            video('g0000000001', 'g', 'Cultura g', 7000),
        ];
        const ranked = api.rank(videos);
        const top = ranked.slice(0, 8);
        const counts = top.reduce((map, item) => {
            map[item.channelId] = (map[item.channelId] || 0) + 1;
            return map;
        }, {});
        expect(counts.dominant || 0).toBeLessThanOrEqual(2);
        expect(top.some(item => item.channelId === 'followed')).toBe(true);
    });

    it('s’aplica només a Recomanat per a tu i també governa el Hero', () => {
        expect(appSource).toContain("SegueixApp.features.smartFeed?.rank?.(filtered");
        expect(appSource).toContain("reason: 'home-recommended'");
        expect(appSource).toContain("normalizedSection === 'Recomanat per a tu' && available[0]");
    });

    it('carrega i precacheja el nou mòdul', () => {
        expect(indexSource).toContain('js/features/smart-feed.js?v=20260924-smart-feed-v1');
        expect(swSource).toContain("'./js/features/smart-feed.js'");
        expect(swSource).toMatch(/const CACHE_VERSION = '[a-z0-9_-]+'/i);
    });
});
