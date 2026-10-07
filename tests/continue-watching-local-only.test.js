import { describe, expect, it } from 'vitest';
import { loadScript } from './setup.js';



describe('Continua mirant és local al dispositiu', () => {
    it('queda exclòs de la sincronització amb Google Drive', () => {
        const ctx = loadScript('js/utils/music-data.js');
        ctx.localStorage.setItem('catube_continue_watching_v1', 'PRIVATE_PROGRESS');
        ctx.localStorage.setItem('catube_anonymous_analytics_enabled', 'PRIVATE_CONSENT');
        const snapshot = ctx.SegueixApp.utils.musicData.collect();
        expect(JSON.stringify(snapshot)).not.toContain('PRIVATE');
        ctx.SegueixApp.utils.musicData.apply(snapshot.data);
        expect(ctx.localStorage.getItem('catube_continue_watching_v1')).toBe('PRIVATE_PROGRESS');
    });

    it('no desa Shorts ni directes coneguts a l’historial', () => {
        const ctx = loadScript('js/utils/storage.js');
        const storage = ctx.SegueixApp.utils.continueWatchingStorage;

        ctx.localStorage.setItem(
            'catube_history',
            JSON.stringify([{ id: 'Short123456', isShort: true, title: 'Short' }])
        );
        expect(storage.upsert({ id: 'Short123456', position: 40, duration: 100, updatedAt: 1 })).toBe(false);
        expect(storage.get('Short123456')).toBeNull();

        ctx.localStorage.setItem(
            'catube_history',
            JSON.stringify([{ id: 'Live1234567', isLive: true, title: 'Directe' }])
        );
        expect(storage.upsert({ id: 'Live1234567', position: 40, duration: 100, updatedAt: 2 })).toBe(false);
        expect(storage.get('Live1234567')).toBeNull();
    });
});

