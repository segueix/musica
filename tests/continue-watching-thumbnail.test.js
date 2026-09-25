import { describe, expect, it } from 'vitest';
import { loadScript } from './setup.js';

describe('miniatures de Continua mirant', () => {
    it('repara una URL de pàgina guardada com a miniatura amb la caràtula de l’historial', () => {
        const ctx = loadScript('js/utils/storage.js');
        const storage = ctx.SegueixApp.utils.continueWatchingStorage;
        const id = 'AbCdEf12345';
        const thumbnail = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

        ctx.localStorage.setItem(
            'catube_history',
            JSON.stringify([{ id, title: 'Vídeo de prova', channelTitle: 'Canal de prova', thumbnail }])
        );
        ctx.localStorage.setItem(
            'catube_continue_watching_v1',
            JSON.stringify([{
                id,
                position: 42,
                duration: 180,
                updatedAt: 123,
                thumbnail: `https://feature-continue-watching.segueix.pages.dev/video/video-de-prova-${id}`,
            }])
        );

        const entry = storage.get(id);
        expect(entry?.thumbnail).toBe(thumbnail);
        expect(entry?.title).toBe('Vídeo de prova');
        expect(entry?.channel).toBe('Canal de prova');
    });

    it('prioritza la miniatura real de l’historial quan un nou desament rep una URL no vàlida', () => {
        const ctx = loadScript('js/utils/storage.js');
        const storage = ctx.SegueixApp.utils.continueWatchingStorage;
        const id = 'ZyXwVu98765';
        const thumbnail = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;

        ctx.localStorage.setItem('catube_history', JSON.stringify([{ id, thumbnail }]));
        expect(storage.upsert({
            id,
            position: 55,
            duration: 240,
            updatedAt: 456,
            thumbnail: `https://feature-continue-watching.segueix.pages.dev/video/prova-${id}`,
        })).toBe(true);

        expect(storage.get(id)?.thumbnail).toBe(thumbnail);
    });
});
