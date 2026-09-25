import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadScript } from './setup.js';

const syncSource = readFileSync(new URL('../js/features/config-sync.js', import.meta.url), 'utf8');

describe('Continua mirant és local al dispositiu', () => {
    it('queda exclòs de la sincronització i de la importació/exportació de configuració', () => {
        expect(syncSource).toContain("LOCAL_ONLY_STORAGE_KEYS = new Set(['catube_continue_watching_v1'])");
        expect(syncSource).toContain('if (LOCAL_ONLY_STORAGE_KEYS.has(key)) continue;');
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
