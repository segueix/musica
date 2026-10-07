import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { createMockLocalStorage, loadScript } from './setup.js';

const appSource = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const fn = name => {
    const start = appSource.indexOf(`function ${name}(`);
    return appSource.slice(start, appSource.indexOf('\n}\n', start) + 3);
};
const songs = [1, 2, 3].map(n => ({ id: `song000000${n}`, title: `Cançó ${n}`, source: 'api' }));
function setup(storage = createMockLocalStorage(), type = 'reload') {
    const ctx = loadScript('js/features/music-queue.js', {
        document: { readyState: 'loading', addEventListener() {} },
        sessionStorage: storage,
        performance: { getEntriesByType: () => [{ type }] },
        isPlaylistMode: true,
        activePlaylistQueue: songs,
        currentPlaylistIndex: 1,
        activePlaylistId: 'llista-local',
        activePlaylistName: 'La meva llista',
        currentVideoId: songs[1].id,
        currentVideoSource: 'api',
        lastKnownPlayerTime: 43.8,
        cachedAPIVideos: [],
        selectedCategory: 'Novetats',
        historySelectedCategory: 'Tot',
        historyFilterLiked: false,
        activeFollowTab: 'all',
        VIEW_STATE_STORAGE_KEY: 'view',
        getCurrentVisiblePage: () => 'watch',
        loadVideoInSequence: vi.fn(),
    });
    runInNewContext(['saveViewState', 'loadSavedViewState', 'restoreReloadedQueue'].map(fn).join('\n') +
        '\nconst reloadedViewState = loadSavedViewState();', ctx);
    return ctx;
}

describe('recàrrega del reproductor després de sincronitzar', () => {
    it('l’arrencada amb ?v= recupera la ràdio abans del camí de vídeo individual i només una vegada', async () => {
        const old = setup();
        old.saveViewState();
        const next = setup(old.sessionStorage);
        next.pendingDeepLinkVideo = { id: songs[1].id, startAt: 0 };
        next.deepLinkVideoHandled = false;
        next.showVideoFromAPI = vi.fn();
        runInNewContext('async ' + fn('openPendingDeepLinkVideo'), next);
        await next.openPendingDeepLinkVideo();
        await next.openPendingDeepLinkVideo();
        expect(next.loadVideoInSequence).toHaveBeenCalledTimes(1);
        expect(next.showVideoFromAPI).not.toHaveBeenCalled();
    });
    it('recupera la mateixa cua, índex, títols i segon en una sessió nova, preparada en pausa', () => {
        const old = setup();
        old.saveViewState();
        const next = setup(old.sessionStorage);
        next.isPlaylistMode = false;
        next.activePlaylistQueue = [];
        // Una vista provisional durant l’arrencada no ha de perdre la còpia anterior.
        next.sessionStorage.setItem('view', JSON.stringify({ page: 'home' }));
        expect(next.restoreReloadedQueue(songs[1].id)).toBe(true);
        expect(next.activePlaylistQueue).toEqual(songs);
        expect(next.activePlaylistName).toBe('La meva llista');
        expect(next.currentPlaylistIndex).toBe(1);
        expect(next.cachedAPIVideos).toEqual(songs);
        expect(next.loadVideoInSequence).toHaveBeenCalledWith({ autoPlay: false, replaceHistory: true, startAt: 43 });
    });
    it('recupera també el nom i el context d’una ràdio d’artista', () => {
        const old = setup();
        const queue = old.SegueixApp.features.musicQueue;
        const snapshot = { ...queue.captureSession(), radioCategory: 'Pop', radioExtra: ['Rock'],
            radioMeta: { requested: 'surprise' }, radioLabel: 'Ràdio Au Rora', searchRadio: { artist: 'Au Rora' } };
        expect(queue.restoreSession(snapshot, songs[1].id)).toBe(true);
        old.saveViewState();
        const next = setup(old.sessionStorage);
        expect(next.restoreReloadedQueue(songs[1].id)).toBe(true);
        expect(next.SegueixApp.features.musicQueue.captureSession()).toEqual(snapshot);
    });
    it('un enllaç nou no recupera la cua anterior encara que apunti a la mateixa cançó', () => {
        const old = setup();
        old.saveViewState();
        const next = setup(old.sessionStorage, 'navigate');
        expect(next.restoreReloadedQueue(songs[1].id)).toBe(false);
        expect(next.loadVideoInSequence).not.toHaveBeenCalled();
        expect(old.restoreReloadedQueue(songs[2].id)).toBe(false);
    });
    it('sense ràdio activa no guarda una cua antiga ni recupera dades malmeses', () => {
        const ctx = setup();
        ctx.isPlaylistMode = false;
        ctx.saveViewState();
        expect(ctx.restoreReloadedQueue(songs[1].id)).toBe(false);
        ctx.sessionStorage.setItem('view', '{bad');
        expect(ctx.restoreReloadedQueue(songs[1].id)).toBe(false);
        expect(ctx.SegueixApp.features.musicQueue.restoreSession({ v: 1, queue: songs, index: 99 }, songs[1].id)).toBe(false);
        ctx.activePlaylistId = '__segueix_tv_discovery__';
        ctx.isPlaylistMode = true;
        expect(ctx.SegueixApp.features.musicQueue.captureSession()).toBeNull();
    });
});
