import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { loadScript } from './setup.js';

const catalog = JSON.parse(readFileSync('data/albums-musica.json', 'utf8'));
const artists = JSON.parse(readFileSync('data/artistes-musica.json', 'utf8'));
const source = 'UCdezTX23syEeAJJAb2oOkKA';
const sessions = [
    ['Al·lèrgiques al Pol·len', 'QkKPvNot94g'],
    ['Gavina.mp3', 'vf0BFDzgpmo'],
    ['Maria Jaume', 'z5CG34bAwmA'],
    ['La Ludwig Band', 'ysKfbZElXaY'],
    ['Ginestà', 'wJUlrv73K2Y'],
    ['Joan Dausà', 'vvBfCHNvQe0'],
    ['Alosa', 'dpGrzBf6iKM'],
];
const guests = sessions.map(([artist, id]) => ({
    id,
    channelId: source,
    channelTitle: 'Club Social Carme',
    title: artist + ' · Club Social Carme',
    contentType: 'live_song',
    publishedAt: '2026-01-01',
}));
const SegueixCatalogPolicy = loadScript('js/catalog-policy.js').SegueixCatalogPolicy;
const page = loadScript('js/features/artist-page.js', { SegueixCatalogPolicy }).SegueixApp.features.artistPage;

function apiWithCatalog(data = catalog) {
    const fetch = vi.fn(async () => ({ ok: data !== null, json: async () => data }));
    const api = runInNewContext(readFileSync('js/youtube.js', 'utf8') + '\nYouTubeAPI;', {
        window: {},
        fetch,
        console,
        localStorage: {},
        setTimeout,
        clearTimeout,
    });
    api.feedVideos = [...guests, { id: 'unrelated', channelId: source, contentType: 'live_song' }];
    api.hasKnownChannel = () => true;
    api.loadChannelArchiveVideos = async () => [];
    api.loadLegacyArchiveVideosByChannel = async () => [];
    api.getArtistGroupForChannel = id => ({
        channelIds: artists.artists
            .find(artist => artist.youtube.channels.some(channel => channel.id === id))
            ?.youtube.channels.map(channel => channel.id) || [id],
    });
    return { api, fetch };
}

describe('sessions de Club Social Carme dins la discografia de cada artista', () => {
    it('cada canal oficial i Topic veu només la seva sessió, amb el canal publicador original', async () => {
        const { api, fetch } = apiWithCatalog();
        for (const [artist, id] of sessions) {
            const record = artists.artists.find(item => item.name === artist);
            for (const channel of record.youtube.channels) {
                const videos = await api.getArtistVideosWithHistory(channel.id);
                expect(videos.map(video => video.id)).toEqual([id]);
                expect(videos[0]).toMatchObject({ channelId: source, contentType: 'live_song' });
                // A la fitxa surt amb la resta de cançons de l'artista (sense discos ni «Directes» des del 2026-10-16)
                expect(page.songsModel(videos).best.id).toBe(id);
            }
        }
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('no mostra una sessió amagada', async () => {
        const { api } = apiWithCatalog();
        api.hiddenVideoIds.add(sessions[0][1]);
        const channel = artists.artists.find(item => item.name === sessions[0][0]).youtube.channels[0].id;
        expect(await api.getArtistVideosWithHistory(channel)).toEqual([]);
    });

    it('manté les cançons pròpies si el catàleg de discos no està disponible', async () => {
        const { api } = apiWithCatalog(null);
        const channel = artists.artists.find(item => item.name === sessions[0][0]).youtube.channels[0].id;
        api.feedVideos.push({ id: 'own', channelId: channel, contentType: 'song' });
        expect((await api.getArtistVideosWithHistory(channel)).map(video => video.id)).toEqual(['own']);
    });
});

describe('els estils actuals prevalen sobre les etiquetes antigues', () => {
    it('Maria Jaume queda a Pop als dos canals, als vídeos i al perfil', async () => {
        const music = loadScript('js/music-categories.js', {
            fetch: async url => ({
                ok: true,
                json: async () => (String(url).includes('artistes-musica') ? artists : { artistes: [] }),
            }),
        }).SegueixMusicCategories;
        await music.init();
        const record = artists.artists.find(artist => artist.name === 'Maria Jaume');
        expect(record.genres).toEqual(['Pop']);
        for (const channel of record.youtube.channels) {
            expect(music.categoriesForChannel(channel.id)).toEqual(['Pop']);
            expect(
                music.decorateVideo({
                    id: 'old',
                    channelId: channel.id,
                    categories: ["Cançó d'autor", 'Pop', 'Favorits'],
                }).categories
            ).toEqual(['Favorits', 'Pop']);
            expect(
                music.decorateChannel({
                    id: channel.id,
                    categories: ["Cançó d'autor", 'Pop'],
                }).categories
            ).toEqual(['Pop']);
        }
        expect(music.decorateVideo({ channelId: 'unknown', categories: ["Cançó d'autor"] }).categories).toEqual([
            "Cançó d'autor",
        ]);
    });
});
