import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const portada = fs.readFileSync('js/features/portada.js', 'utf8');

// Al mòbil, tocar qualsevol part d'una targeta de cançó (també el nom de l'artista) la reprodueix.
describe('tocs a les targetes de cançó al mòbil', () => {
    it("bindChannelLinks reprodueix la cançó en comptes d'obrir l'artista (targetes i files de llista)", () => {
        const start = app.indexOf('function bindChannelLinks');
        const body = app.slice(start, start + 2500);
        expect(body).toContain('isMobileView()');
        expect(body).toContain('.video-card, .archive-video-card, .playlist-video-row');
        expect(body).toContain('playThenNavigate(songId');
        // la prova mòbil va abans de l'obertura del perfil
        expect(body.indexOf('isMobileView()')).toBeLessThan(body.indexOf('openChannelProfile(channelId)'));
    });

    it("les files d'una llista desada comencen la reproducció des de la cançó tocada", () => {
        expect(app).toContain('async function startPlaylistPlayback(playlistId, startIndex = 0)');
        expect(app).toContain('startPlaylistPlayback(row.dataset.playlistId, Number(row.dataset.videoIndex))');
    });

    it("la portada reprodueix tota la targeta (no només la imatge i el títol) abans d'obrir l'artista", () => {
        const onClick = portada.slice(portada.indexOf('function onClick'));
        const guard = onClick.indexOf('.pt-card[data-video-id], .pt-feature[data-video-id]');
        expect(guard).toBeGreaterThan(-1);
        expect(onClick.indexOf('[data-pt-queue]')).toBeLessThan(guard);
        expect(onClick.indexOf('[data-pt-save]')).toBeLessThan(guard);
        expect(guard).toBeLessThan(onClick.indexOf("pick('[data-pt-artist]')"));
    });
});
