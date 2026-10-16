import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
const source = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const start = source.indexOf('async function refreshImportedMusic(');
const refresh = source.slice(start, source.indexOf('\n}\n', start) + 3);
function setup(page = 'watch', editing = false) {
    const heart = { id: 'likeToggle', dataset: {}, classList: { toggle: vi.fn() } };
    const follow = { dataset: { followChannel: 'artist' } };
    const ctx = {
        document: { querySelectorAll: selector => selector === '[data-follow-channel]' ? [follow] : [heart],
            activeElement: { matches: () => editing } },
        currentVideoId: 'song0000001',
        SegueixApp: { features: { likes: { isLiked: () => true, updateLikeButtonState: vi.fn() } } },
        updateFollowButtonState: vi.fn(), invalidateHistoryCache: vi.fn(),
        CustomEvent: class { constructor(type) { this.type = type; } },
        dispatchEvent: vi.fn(), getCurrentVisiblePage: () => page,
        renderCategories: vi.fn(), renderFeed: vi.fn(), renderHistory: vi.fn(),
        renderMyMusic: vi.fn(), renderFollowPage: vi.fn(),
        activePlaylistQueue: ['playing', 'next'], currentPlaylistIndex: 0,
        location: { reload: vi.fn() },
    };
    ctx.window = ctx;
    runInNewContext(refresh, ctx);
    return { ctx, heart, follow };
}
describe('importació JSON sense recarregar el reproductor', () => {
    it('repinta el cor i els seguits mentre conserva la cua i la posició', async () => {
        const { ctx, heart, follow } = setup();
        const queue = ctx.activePlaylistQueue;
        await ctx.refreshImportedMusic({ settings: {}, likes: ['song0000001'] }, { settings: {}, likes: [] });
        expect(ctx.SegueixApp.features.likes.updateLikeButtonState).toHaveBeenCalledWith(heart, true);
        expect(ctx.updateFollowButtonState).toHaveBeenCalledWith(follow, 'artist');
        expect(ctx.activePlaylistQueue).toBe(queue);
        expect(ctx.currentPlaylistIndex).toBe(0);
        expect(ctx.location.reload).not.toHaveBeenCalled();
        expect(ctx.invalidateHistoryCache).toHaveBeenCalledTimes(1);
        expect(ctx.renderFeed).not.toHaveBeenCalled();
    });
    it('actualitza La teva música sense canviar de secció', async () => {
        const { ctx } = setup('llistes');
        await ctx.refreshImportedMusic({ settings: {}, playlists: ['new'] }, { settings: {}, playlists: [] });
        expect(ctx.renderMyMusic).toHaveBeenCalledTimes(1);
        expect(ctx.renderFeed).not.toHaveBeenCalled();
    });
    it('no refà un formulari que s’està editant', async () => {
        const { ctx } = setup('llistes', true);
        await ctx.refreshImportedMusic({ settings: {} }, { settings: {} });
        expect(ctx.renderMyMusic).not.toHaveBeenCalled();
    });
});

