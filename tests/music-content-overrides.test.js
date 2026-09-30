import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { classifyMusicContent } = require('../scripts/lib/classificar_contingut_musical.js');
const { parseContentOverrides, applyContentOverride, applyOverridesToSnapshot } = require('../scripts/lib/revisio_manual_musical.js');

const readData = (name) => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), 'utf8'));

describe('revisió manual del tipus de contingut', () => {
    it('el classificador automàtic deixa en revisió un vídeo ambigu sense marcadors', () => {
        const result = classifyMusicContent({
            item: { snippet: { title: 'Una cosa qualsevol', description: '', categoryId: '22', tags: [] }, durationSeconds: 249 },
            channelMeta: { types: ['official'], artistNames: ['Mar Pujol'], channelTitle: 'Mar Pujol' },
        });
        expect(result.contentType).toBe('review');
        expect(result.accepted).toBe(false);
    });

    it('la decisió manual substitueix el resultat automàtic', () => {
        const auto = { accepted: false, contentType: 'review', confidence: 0.6, reason: 'x' };
        const song = applyContentOverride(auto, { contentType: 'song', note: 'cançó de la banda' });
        expect(song).toMatchObject({ accepted: true, contentType: 'song', confidence: 1 });
        expect(song.reason).toBe('revisat manualment: cançó de la banda');
        expect(applyContentOverride(auto, { contentType: 'other', note: '' }).accepted).toBe(false);
        expect(applyContentOverride(auto, undefined)).toBe(auto);
    });

    it('ignora entrades invàlides i no deixa assignar «review»', () => {
        const warn = console.warn;
        console.warn = () => {};
        try {
            const overrides = parseContentOverrides({
                videos: [
                    { id: 'aaa', contentType: 'song', note: 'ok' },
                    { id: 'bbb', contentType: 'review' },
                    { id: '', contentType: 'song' },
                    { id: 'ccc', contentType: 'inventat' },
                ],
            });
            expect([...overrides.keys()]).toEqual(['aaa']);
        } finally {
            console.warn = warn;
        }
    });

    it('aplica les revisions a un feed generat i és idempotent', () => {
        const snapshot = () => ({
            feed: {
                videos: [
                    { id: 'a', channelId: 'c1', contentType: 'review', isShort: true, musicReason: 'r' },
                    { id: 'b', channelId: 'c1', contentType: 'review', isShort: false, musicReason: 'r' },
                    { id: 'c', channelId: 'c2', contentType: 'other', isShort: false, musicReason: 'r' },
                ],
            },
            review: { count: 2, videos: [{ id: 'a' }, { id: 'b' }] },
            contentAudit: {
                typeCounts: { song: 0, live_song: 0, album: 0, other: 1, review: 2 },
                rawPublicVideoCount: 3,
                acceptedMusicCount: 0,
                categoryEligibleVideoCount: 0,
                rejectedOrReviewCount: 3,
                reviewCount: 2,
                shortVideoCount: 1,
                channelsWithoutAcceptedMusic: ['c1', 'c2'],
            },
            feedAudit: {
                contentTypeCounts: { song: 0, live_song: 0, album: 0, other: 1, review: 2 },
                rawPublicVideoCount: 3,
                acceptedMusicCount: 0,
                categoryEligibleVideoCount: 0,
                shortVideoCount: 1,
                contentReviewCount: 2,
                channelsWithoutAcceptedMusic: ['c1', 'c2'],
            },
            falseShortIds: new Set(['a']),
        });
        const overrides = parseContentOverrides({
            videos: [
                { id: 'a', contentType: 'song', note: 'n' },
                { id: 'b', contentType: 'album', note: 'n' },
            ],
        });
        const state = snapshot();
        const changes = applyOverridesToSnapshot(state, overrides);

        expect(changes.map((c) => `${c.id}:${c.from}>${c.to}`)).toEqual(['a:review>song', 'b:review>album']);
        expect(state.feed.videos.map((v) => v.contentType)).toEqual(['song', 'album', 'other']);
        expect(state.feed.videos[0].isShort).toBe(false);
        expect(state.review).toEqual({ count: 0, videos: [] });
        expect(state.contentAudit).toMatchObject({
            typeCounts: { song: 1, live_song: 0, album: 1, other: 1, review: 0 },
            acceptedMusicCount: 2,
            categoryEligibleVideoCount: 1,
            rejectedOrReviewCount: 1,
            reviewCount: 0,
            shortVideoCount: 0,
            channelsWithoutAcceptedMusic: ['c2'],
        });
        expect(state.feedAudit).toMatchObject({
            contentTypeCounts: { song: 1, live_song: 0, album: 1, other: 1, review: 0 },
            acceptedMusicCount: 2,
            contentReviewCount: 0,
            channelsWithoutAcceptedMusic: ['c2'],
        });

        const again = JSON.stringify(state);
        expect(applyOverridesToSnapshot(state, overrides)).toEqual([]);
        expect(JSON.stringify(state)).toBe(again);
    });
});

describe('dades revisades manualment', () => {
    const overrides = parseContentOverrides(readData('music-content-overrides.json'));
    const feed = readData('feed.json');
    const review = readData('music-content-review.json');
    const contentAudit = readData('music-content-audit.json');
    const byId = new Map(feed.videos.map((video) => [video.id, video]));

    it('l\'arxiu d\'overrides és vàlid i no repeteix vídeos', () => {
        const raw = readData('music-content-overrides.json');
        expect(overrides.size).toBe(raw.videos.length);
        expect(overrides.size).toBeGreaterThan(0);
    });

    it('cap vídeo revisat manualment és al feed com a «review» ni al fitxer de revisió', () => {
        const reviewIds = new Set(review.videos.map((video) => video.id));
        for (const [id, override] of overrides) {
            expect(reviewIds.has(id), `${id} continua a la llista de revisió`).toBe(false);
            const video = byId.get(id);
            if (video) expect(video.contentType, id).toBe(override.contentType);
        }
    });

    it('les cançons revisades curtes que no són Shorts reals no surten marcades com a Short', () => {
        const falseShorts = new Set(readData('falsos-shorts.json').falseShorts);
        for (const id of ['nXEXHnY7gnU', 'a2vY2W3yMRw']) {
            expect(overrides.get(id)?.contentType).toBe('song');
            if (byId.has(id)) expect(byId.get(id).isShort, id).toBe(false);
            if (byId.has(id)) expect(falseShorts.has(id), id).toBe(true);
        }
    });

    it('l\'auditoria de contingut és coherent amb el feed i el fitxer de revisió', () => {
        expect(contentAudit.reviewCount).toBe(review.videos.length);
        expect(review.count).toBe(review.videos.length);
        expect(contentAudit.typeCounts.review).toBe(review.videos.length);
        const total = Object.values(contentAudit.typeCounts).reduce((sum, n) => sum + n, 0);
        expect(total).toBe(contentAudit.rawPublicVideoCount);
        expect(contentAudit.shortVideoCount).toBe(feed.videos.filter((video) => video.isShort === true).length);
    });
});
