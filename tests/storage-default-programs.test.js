import { describe, it, expect } from 'vitest';
import { loadScript } from './setup.js';

describe('mergeDefaultPrograms', () => {
    it('afegeix els programes base quan no hi ha dades prèvies', () => {
        const ctx = loadScript('js/utils/storage.js');

        const merged = ctx.mergeDefaultPrograms(null);

        expect(merged).toHaveLength(3);
        expect(merged.map(program => program.id)).toEqual([
            'prog_mn0tv3bw_mlop',
            'prog_mn0txcn8_yc55',
            'prog_mn0ty7em_jmtc'
        ]);
    });

    it('preserva programes existents i evita duplicats per id', () => {
        const ctx = loadScript('js/utils/storage.js');
        const existingPrograms = [
            {
                id: 'user_program_1',
                channelId: 'custom-channel',
                name: 'Programa meu',
                description: 'Creat per l’usuari',
                createdAt: 123,
                customCategories: ['Opinió']
            },
            {
                id: 'prog_mn0txcn8_yc55',
                channelId: 'override-channel',
                name: 'Versió personalitzada',
                description: 'S’ha de conservar',
                createdAt: 456,
                customCategories: ['Actualitat']
            }
        ];

        const merged = ctx.mergeDefaultPrograms(existingPrograms);

        expect(merged).toHaveLength(4);
        expect(merged[0]).toBe(existingPrograms[0]);
        expect(merged[1]).toBe(existingPrograms[1]);
        expect(merged.filter(program => program.id === 'prog_mn0txcn8_yc55')).toHaveLength(1);
        expect(merged.some(program => program.id === 'prog_mn0tv3bw_mlop')).toBe(true);
        expect(merged.some(program => program.id === 'prog_mn0ty7em_jmtc')).toBe(true);
    });

    it('retorna només els defaults si el valor guardat no és un array vàlid', () => {
        const ctx = loadScript('js/utils/storage.js');

        const merged = ctx.mergeDefaultPrograms('{"broken":true}');

        expect(merged).toHaveLength(3);
        expect(merged.every(program => typeof program.id === 'string')).toBe(true);
    });
});
