import { describe, expect, it } from 'vitest';
import { loadScript } from './setup.js';

const build = (queue, index) => {
    const ctx = loadScript('js/features/music-queue.js', {
        SegueixApp: { features: {}, state: {} },
        activePlaylistQueue: queue,
        currentPlaylistIndex: index,
        document: { readyState: 'loading', addEventListener() {}, createElement: () => ({}) },
    });
    return (ctx.SegueixApp || ctx.window?.SegueixApp).features.musicQueue.buildYouTubeMusicUrl();
};

describe('enllaç de la ràdio a YouTube Music', () => {
    const ids = Array.from({ length: 60 }, (_, i) => `abcdefghi${String(i).padStart(2, '0')}`);
    const queue = ids.map(id => ({ id }));

    it('conserva l\'ordre exacte des de la cançó que sona', () => {
        const url = build(queue.slice(0, 5), 2);
        expect(url).toBe('https://music.youtube.com/watch_videos?video_ids=' + ids.slice(2, 5).join(','));
    });

    it('limita a 50 vídeos i ignora IDs que no són de YouTube', () => {
        const url = build([{ id: 'curt' }, ...queue], 0);
        const list = url.split('video_ids=')[1].split(',');
        expect(list).toHaveLength(50);
        expect(list[0]).toBe(ids[0]);
    });
});
