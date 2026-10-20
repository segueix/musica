import { describe, expect, it } from 'vitest';
import music from '../js/music-categories.js';

// El nom de l'artista que es mostra (reproductor, cua, controls del sistema) mai no porta « - Topic» / « - Tema».
describe("nom de l'artista sense « - Topic» / « - Tema»", () => {
    it('treu el sufix dels canals automàtics de YouTube Music', () => {
        expect(music.cleanArtistName('31 FAM - Topic')).toBe('31 FAM');
        expect(music.cleanArtistName('Els Pets – Tema')).toBe('Els Pets');
        expect(music.cleanArtistName('Manel - tòpic')).toBe('Manel');
    });
    it('no toca noms que només acaben igual', () => {
        expect(music.cleanArtistName("Pirat's Sound Sistema")).toBe("Pirat's Sound Sistema");
        expect(music.cleanArtistName('Tema')).toBe('Tema');
        expect(music.cleanArtistName('')).toBe('');
    });
    it('un vídeo amb channelTitle «Artista - Topic» es mostra amb el nom net', () => {
        const video = music.decorateVideo({
            id: 'x',
            title: 'Cançó',
            channelId: 'desconegut',
            channelTitle: 'Txarango - Topic',
        });
        expect(video.channelTitle).toBe('Txarango');
        expect(video.originalChannelTitle).toBe('Txarango - Topic');
        expect(music.decorateChannel({ id: 'desconegut', name: 'Txarango - Tema' }).name).toBe('Txarango');
    });
});
