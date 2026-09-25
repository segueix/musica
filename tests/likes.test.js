import { describe, it, expect, beforeEach } from 'vitest';
import { loadScript, createMockLocalStorage } from './setup.js';

function createLikesContext(initialStorage = {}) {
    const localStorage = createMockLocalStorage();
    for (const [key, value] of Object.entries(initialStorage)) {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    }

    const ctx = loadScript('js/features/likes.js', { localStorage });
    return { likes: ctx.SegueixApp.features.likes, localStorage };
}

// ==================== normalizeLikedVideo ====================
describe('normalizeLikedVideo', () => {
    const { likes } = createLikesContext();

    it('retorna null per input null/undefined', () => {
        expect(likes.normalizeLikedVideo(null)).toBeNull();
        expect(likes.normalizeLikedVideo(undefined)).toBeNull();
    });

    it('normalitza un vídeo amb camps directes', () => {
        const video = {
            id: 'abc123',
            title: 'Test Video',
            thumbnail: 'thumb.jpg',
            channelId: 'ch1',
            channelTitle: 'Channel One',
            publishedAt: '2024-01-01',
            viewCount: 1000,
        };
        const result = likes.normalizeLikedVideo(video);
        expect(result).toEqual({
            id: 'abc123',
            title: 'Test Video',
            thumbnail: 'thumb.jpg',
            channelId: 'ch1',
            channelTitle: 'Channel One',
            publishedAt: '2024-01-01',
            viewCount: 1000,
        });
    });

    it('fa fallback a camps de snippet', () => {
        const video = {
            id: 'xyz',
            snippet: {
                title: 'Snippet Title',
                thumbnails: { medium: { url: 'snippet-thumb.jpg' } },
                channelId: 'ch2',
                channelTitle: 'Snippet Channel',
            },
        };
        const result = likes.normalizeLikedVideo(video);
        expect(result.title).toBe('Snippet Title');
        expect(result.thumbnail).toBe('snippet-thumb.jpg');
        expect(result.channelId).toBe('ch2');
        expect(result.channelTitle).toBe('Snippet Channel');
    });

    it('usa valors per defecte si no hi ha res', () => {
        const result = likes.normalizeLikedVideo({ id: 'bare' });
        expect(result.title).toBe('');
        expect(result.thumbnail).toBe('');
        expect(result.channelId).toBe('');
        expect(result.channelTitle).toBe('');
        expect(result.publishedAt).toBe('');
        expect(result.viewCount).toBe(0);
    });
});

// ==================== getLikedVideos / setLikedVideos ====================
describe('getLikedVideos / setLikedVideos', () => {
    it('retorna array buit si no hi ha res guardat', () => {
        const { likes } = createLikesContext();
        expect(likes.getLikedVideos()).toEqual([]);
    });

    it('retorna els vídeos guardats', () => {
        const videos = [{ id: '1', title: 'Video 1' }, { id: '2', title: 'Video 2' }];
        const { likes } = createLikesContext({ catube_liked_videos: videos });
        expect(likes.getLikedVideos()).toEqual(videos);
    });

    it('retorna array buit si el JSON és invàlid', () => {
        const { likes } = createLikesContext({ catube_liked_videos: 'not-json{{{' });
        expect(likes.getLikedVideos()).toEqual([]);
    });

    it('setLikedVideos guarda i getLikedVideos recupera', () => {
        const { likes } = createLikesContext();
        const videos = [{ id: 'a' }, { id: 'b' }];
        likes.setLikedVideos(videos);
        expect(likes.getLikedVideos()).toEqual(videos);
    });
});

// ==================== isLiked ====================
describe('isLiked', () => {
    it('retorna false si videoId és falsy', () => {
        const { likes } = createLikesContext();
        expect(likes.isLiked(null)).toBe(false);
        expect(likes.isLiked('')).toBe(false);
        expect(likes.isLiked(undefined)).toBe(false);
    });

    it('retorna true si el vídeo està als liked', () => {
        const { likes } = createLikesContext({
            catube_liked_videos: [{ id: 'abc' }, { id: 'def' }],
        });
        expect(likes.isLiked('abc')).toBe(true);
        expect(likes.isLiked('def')).toBe(true);
    });

    it('retorna false si el vídeo no hi és', () => {
        const { likes } = createLikesContext({
            catube_liked_videos: [{ id: 'abc' }],
        });
        expect(likes.isLiked('xyz')).toBe(false);
    });

    it('normalitza numèric a string per comparar', () => {
        const { likes } = createLikesContext({
            catube_liked_videos: [{ id: 123 }],
        });
        expect(likes.isLiked('123')).toBe(true);
        expect(likes.isLiked(123)).toBe(true);
    });
});

// ==================== getLikedVideoIds ====================
describe('getLikedVideoIds', () => {
    it('retorna IDs des de catube_liked_videos', () => {
        const { likes } = createLikesContext({
            catube_liked_videos: [{ id: 'a' }, { id: 'b' }],
        });
        expect(likes.getLikedVideoIds()).toContain('a');
        expect(likes.getLikedVideoIds()).toContain('b');
    });

    it('fusiona IDs legacy de user_liked_videos', () => {
        const { likes } = createLikesContext({
            catube_liked_videos: [{ id: 'a' }],
            user_liked_videos: JSON.stringify(['b', 'c']),
        });
        const ids = likes.getLikedVideoIds();
        expect(ids).toContain('a');
        expect(ids).toContain('b');
        expect(ids).toContain('c');
    });

    it('deduplicat IDs repetits', () => {
        const { likes } = createLikesContext({
            catube_liked_videos: [{ id: 'a' }],
            user_liked_videos: JSON.stringify(['a', 'b']),
        });
        const ids = likes.getLikedVideoIds();
        const countA = ids.filter(id => id === 'a').length;
        expect(countA).toBe(1);
    });
});
