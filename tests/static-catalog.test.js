import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it, expect, vi } from 'vitest';
const source = readFileSync('js/youtube.js', 'utf8');
function boot(files = {}) {
    const fetch = vi.fn(async url => {
        const key = String(url).replace(/^\/musica\//, '').split('?')[0];
        if (!(key in files)) return { ok: false, status: 404 };
        return { ok: true, json: async () => files[key] };
    });
    const localStorage = { getItem: vi.fn(() => 'old-credential'), removeItem: vi.fn() };
    const ctx = { window: { appDataUrl: file => '/musica/' + file }, localStorage, fetch, console: { log() {} }, setTimeout };
    vm.runInNewContext(source + '\nthis.api = YouTubeAPI;', ctx);
    ctx.api.feedChannels = [{ id: 'UCknown', name: 'Grup', handle: '@grup', categories: ['Rock'] }];
    return { api: ctx.api, fetch, localStorage };
}
const song = (id, more = {}) => ({ id, channelId: 'UCknown', title: 'Cançó', categories: ['Rock'], ...more });
describe('catàleg sense API de servidor', () => {
    it('no conté Functions ni consultes al servei de dades de YouTube', () => {
        expect(existsSync('functions')).toBe(false);
        expect(source).not.toMatch(/googleapis\.com\/youtube|\bgetApiKey\(|\bverifyApiKey\(/);
    });
    it('consulta feed, canals i cerca sense xarxa ni llegir credencials antigues', async () => {
        const { api, fetch, localStorage } = boot(); api.feedVideos = [song('song0000001')]; api.feedLoaded = true;
        expect((await api.getVideoDetails('song0000001')).video.title).toBe('Cançó');
        expect((await api.getChannelDetails('@grup')).channel.title).toBe('Grup');
        expect((await api.searchVideos('cançó')).items).toHaveLength(1);
        expect((await api.getPopularVideos()).items).toHaveLength(1);
        expect(fetch).not.toHaveBeenCalled(); expect(localStorage.getItem).not.toHaveBeenCalled();
    });
    it('recupera una cançó antiga compartida només amb JSON locals', async () => {
        const { api, fetch } = boot({ 'data/historial-musical.json': { videos: [song('song0000002')] } });
        expect((await api.getVideoDetails('song0000002')).video.id).toBe('song0000002');
        expect(fetch).toHaveBeenCalledWith('/musica/data/historial-musical.json');
    });
    it('resol una cançó només d’arxiu amb l’índex generat', async () => {
        const { api, fetch } = boot({ 'data/historial-musical.json': { videos: [] },
            'data/video-channels.json': { song0000003: 'UCknown' },
            'data/archive/channels/UCknown.json': { videos: [song('song0000003')] } });
        expect((await api.getVideoDetails('song0000003')).video.id).toBe('song0000003');
        expect(fetch.mock.calls.every(([url]) => url.startsWith('/musica/data/'))).toBe(true);
    });
    it('exclou ocults, Shorts i canals retirats, i gestiona fallades de càrrega', async () => {
        const { api, fetch } = boot(); api.feedVideos = [song('song0000001', { isShort: true }), song('song0000002', { channelId: 'removed' })];
        api.hiddenVideoIds.add('song0000003');
        expect((await api.getVideoDetails('song0000003')).video).toBeNull(); expect(fetch).not.toHaveBeenCalled();
        for (const id of ['song0000001', 'song0000002', 'unknown0001']) expect((await api.getVideoDetails(id)).video).toBeNull();
        expect((await api.getPopularVideos()).error).not.toMatch(/API key/);
    });
});
