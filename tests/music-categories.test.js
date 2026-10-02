import { describe, expect, it, vi } from 'vitest';
import music from '../js/music-categories.js';

describe('taxonomia de navegació musical', () => {
    it('agrupa Punk i Metal en una sola secció', () => {
        expect(music.navigationCategoriesForGenres(['Punk', 'Metal'])).toContain('Punk / Metal');
    });
    it('agrupa clàssica i coral', () => {
        expect(music.navigationCategoriesForGenres(['Coral / Vocal'])).toContain('Clàssica');
    });
    it('manté els estils principals separats', () => {
        expect(music.navigationCategoriesForGenres(['Pop', 'Rock', 'Indie / Alternativa'])).toEqual([
            'Pop',
            'Rock',
            'Indie',
        ]);
    });
    it('només considera song i live_song elegibles dins les categories musicals', () => {
        expect(music.isCategoryEligibleVideo({ contentType: 'song' })).toBe(true);
        expect(music.isCategoryEligibleVideo({ contentType: 'live_song' })).toBe(true);
        expect(music.isCategoryEligibleVideo({ contentType: 'live-song' })).toBe(true);
        expect(music.isCategoryEligibleVideo({ contentType: 'album' })).toBe(false);
        expect(music.isCategoryEligibleVideo({ contentType: 'other' })).toBe(false);
        expect(music.isCategoryEligibleVideo({ contentType: 'review' })).toBe(false);
    });

    it('manté compatibles els vídeos antics sense contentType fins regenerar el feed', () => {
        expect(music.isCategoryEligibleVideo({})).toBe(true);
    });

    it('comparteix identitat i nom canònic entre canal oficial i Topic', async () => {
        const official = 'UC' + 'D'.repeat(22);
        const topic = 'UC' + 'E'.repeat(22);
        const artists = {
            artists: [{
                name: 'Grup Exemple',
                displayName: 'Grup exemple',
                genres: ['Pop'],
                youtube: { channels: [
                    { id: official, type: 'official', primary: true },
                    { id: topic, type: 'topic', primary: false },
                ] },
            }],
        };
        vi.stubGlobal('fetch', vi.fn(async url => ({
            ok: !String(url).includes('musica-classica'),
            json: async () => artists,
        })));
        try {
            await music.init();
        } finally {
            vi.unstubAllGlobals();
        }
        expect(music.artistKeyForChannel(official)).toBe(music.artistKeyForChannel(topic));
        expect(music.artistDisplayNameForChannel(official)).toBe('Grup exemple');
        expect(music.artistDisplayNameForChannel(topic)).toBe('Grup exemple');
        expect(music.artistChannelMeta(official)).toMatchObject({ type: 'official', primary: true });
        expect(music.artistChannelMeta(topic)).toMatchObject({ type: 'topic', primary: false });
    });

    it('la categoria principal d’un canal és la del primer gènere de l’artista (no l’ordre de la taxonomia)', async () => {
        const artists = {
            artists: [
                { name: 'Grup A', genres: ['Rock', 'Pop'], youtube: { channels: [{ id: 'UC' + 'A'.repeat(22) }] } },
                {
                    name: 'Grup B',
                    genres: ["Cançó d'autor", 'Folk i arrel'],
                    youtube: { channels: [{ id: 'UC' + 'B'.repeat(22) }] },
                },
                { name: 'Grup C', genres: ['Altres'], youtube: { channels: [{ id: 'UC' + 'C'.repeat(22) }] } },
            ],
        };
        const fetchMock = vi.fn(async url => ({
            ok: !String(url).includes('musica-classica'),
            json: async () => artists,
        }));
        vi.stubGlobal('fetch', fetchMock);
        try {
            await music.init();
        } finally {
            vi.unstubAllGlobals();
        }
        // Amb l'ordre de la taxonomia Pop passaria davant de Rock
        expect(music.categoriesForChannel('UC' + 'A'.repeat(22))).toEqual(['Pop', 'Rock']);
        expect(music.primaryCategoryForChannel('UC' + 'A'.repeat(22))).toBe('Rock');
        expect(music.primaryCategoryForChannel('UC' + 'B'.repeat(22))).toBe("Cançó d'autor");
        expect(music.primaryCategoryForChannel('UC' + 'C'.repeat(22))).toBe('Altres estils');
        expect(music.primaryCategoryForChannel('desconegut')).toBe('');
    });
});
