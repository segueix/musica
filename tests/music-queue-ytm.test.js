import { describe, expect, it } from 'vitest';
import { loadScript } from './setup.js';

const load = (queue, index, extra = {}) => {
    const ctx = loadScript('js/features/music-queue.js', {
        SegueixApp: { features: {}, state: {} },
        activePlaylistQueue: queue,
        currentPlaylistIndex: index,
        activePlaylistId: '__music_queue__',
        activePlaylistName: 'Ràdio',
        ...extra,
        document: { readyState: 'loading', addEventListener() {}, createElement: () => ({}) },
    });
    return (ctx.SegueixApp || ctx.window?.SegueixApp).features.musicQueue;
};
const build = (queue, index) => load(queue, index).buildYouTubeMusicUrl();

describe('enllaç de la ràdio a YouTube Music', () => {
    const ids = Array.from({ length: 60 }, (_, i) => `abcdefghi${String(i).padStart(2, '0')}`);
    const queue = ids.map(id => ({ id }));

    it("conserva l'ordre exacte des de la cançó que sona", () => {
        const url = build(queue.slice(0, 5), 2);
        expect(
            url.startsWith('https://www.youtube.com/watch_videos?video_ids=' + ids.slice(2, 5).join(',') + '&title=')
        ).toBe(true);
    });

    it('limita a 50 vídeos i ignora IDs que no són de YouTube', () => {
        const url = build([{ id: 'curt' }, ...queue], 0);
        const list = url.split('video_ids=')[1].split('&')[0].split(',');
        expect(list).toHaveLength(50);
        expect(list[0]).toBe(ids[0]);
    });

    it('nomena la llista «Llista <primer grup>» i la posa a la URL', () => {
        const q = [
            { id: ids[0], channelTitle: 'Els Pets' },
            { id: ids[1], channelTitle: 'Txarango' },
        ];
        const mq = load(q, 0);
        expect(mq.buildListName()).toBe('Llista Els Pets');
        expect(mq.buildYouTubeMusicUrl()).toContain('&title=' + encodeURIComponent('Llista Els Pets'));
        // el primer grup és el de la cançó que sona
        expect(load(q, 1).buildListName()).toBe('Llista Txarango');
    });

    it('en una llista pròpia usa el seu nom', () => {
        const mq = load([{ id: ids[0], channelTitle: 'X' }], 0, {
            activePlaylistId: 'p1',
            activePlaylistName: 'Estiu',
        });
        expect(mq.buildListName()).toBe('Llista Estiu');
    });
});
