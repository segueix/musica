import { describe, it, expect } from 'vitest';
import { loadScript, createMockLocalStorage } from './setup.js';

describe('backup-codecs', () => {
    function loadBackupCodecs(storageData = {}) {
        const localStorage = createMockLocalStorage();
        for (const key in storageData) {
            localStorage.setItem(key, JSON.stringify(storageData[key]));
        }
        const ctx = loadScript('js/utils/backup-codecs.js', { localStorage, Date });
        return ctx.SegueixApp.utils.backupCodecs;
    }

    // ==================== PLAYLISTS ====================

    describe('buildPlaylistsBackup', () => {
        it('retorna estructura correcta amb metadades', () => {
            const codecs = loadBackupCodecs({
                catube_playlists: [
                    {
                        id: 'pl_123',
                        name: 'La meva llista',
                        videos: [
                            { id: 'v1', title: 'Vídeo 1', thumbnail: 'thumb1.jpg', channelTitle: 'Canal 1', channelId: 'UC1', duration: 'PT5M' },
                        ],
                    },
                ],
            });
            const result = codecs.buildPlaylistsBackup();

            expect(result.type).toBe('playlists');
            expect(result.version).toBe(1);
            expect(result.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
            expect(result.items).toHaveLength(1);
            expect(result.items[0].id).toBe('pl_123');
            expect(result.items[0].name).toBe('La meva llista');
            expect(result.items[0].videos).toHaveLength(1);
            expect(result.items[0].videos[0].id).toBe('v1');
            expect(result.items[0].videos[0].channelId).toBe('UC1');
        });

        it('retorna items buits si no hi ha playlists', () => {
            const codecs = loadBackupCodecs({});
            const result = codecs.buildPlaylistsBackup();

            expect(result.type).toBe('playlists');
            expect(result.items).toHaveLength(0);
        });
    });

    // ==================== CATEGORIES ====================

    describe('buildCategoriesBackup', () => {
        it('distingeix categories custom i smart', () => {
            const codecs = loadBackupCodecs({
                catube_custom_tags: ['Música', 'Cuina', 'Tech'],
                catube_channel_custom_categories: {
                    UC1: ['Música', 'Tech'],
                    UC2: ['Música'],
                },
            });
            const result = codecs.buildCategoriesBackup();

            expect(result.type).toBe('categories');
            expect(result.version).toBe(1);
            expect(result.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
            expect(result.items).toHaveLength(3);

            // Música → smart (2 canals)
            const musica = result.items.find(i => i.name === 'Música');
            expect(musica.kind).toBe('smart');
            expect(musica.channels).toEqual(['UC1', 'UC2']);

            // Cuina → custom (0 canals)
            const cuina = result.items.find(i => i.name === 'Cuina');
            expect(cuina.kind).toBe('custom');
            expect(cuina.channels).toEqual([]);

            // Tech → smart (1 canal)
            const tech = result.items.find(i => i.name === 'Tech');
            expect(tech.kind).toBe('smart');
            expect(tech.channels).toEqual(['UC1']);
        });

        it('cada item té camp rules buit', () => {
            const codecs = loadBackupCodecs({ catube_custom_tags: ['Test'] });
            const result = codecs.buildCategoriesBackup();

            expect(result.items[0].rules).toEqual({});
        });

        it('retorna items buits si no hi ha categories', () => {
            const codecs = loadBackupCodecs({});
            const result = codecs.buildCategoriesBackup();

            expect(result.type).toBe('categories');
            expect(result.items).toHaveLength(0);
        });
    });

    // ==================== HISTORIAL ====================

    describe('buildHistoryBackup', () => {
        it('retorna estructura correcta amb metadades', () => {
            const codecs = loadBackupCodecs({
                catube_history: [
                    {
                        id: 'v1',
                        title: 'Vídeo vist',
                        thumbnail: 'thumb.jpg',
                        channelId: 'UC1',
                        channelTitle: 'Canal 1',
                        viewedAt: '2026-03-18T10:00:00.000Z',
                        duration: 'PT10M',
                    },
                ],
            });
            const result = codecs.buildHistoryBackup();

            expect(result.type).toBe('history');
            expect(result.version).toBe(1);
            expect(result.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
            expect(result.items).toHaveLength(1);
            expect(result.items[0].id).toBe('v1');
            expect(result.items[0].viewedAt).toBe('2026-03-18T10:00:00.000Z');
        });

        it('retorna items buits si no hi ha historial', () => {
            const codecs = loadBackupCodecs({});
            const result = codecs.buildHistoryBackup();

            expect(result.type).toBe('history');
            expect(result.items).toHaveLength(0);
        });
    });

    // ==================== VALIDACIÓ ====================

    describe('validateBackup', () => {
        it('accepta un backup vàlid', () => {
            const codecs = loadBackupCodecs({});
            expect(codecs.validateBackup({ type: 'playlists', version: 1, items: [] }).valid).toBe(true);
            expect(codecs.validateBackup({ type: 'categories', version: 1, items: [] }).valid).toBe(true);
            expect(codecs.validateBackup({ type: 'history', version: 1, items: [] }).valid).toBe(true);
        });

        it('rebutja objectes invàlids', () => {
            const codecs = loadBackupCodecs({});
            expect(codecs.validateBackup(null).valid).toBe(false);
            expect(codecs.validateBackup({}).valid).toBe(false);
            expect(codecs.validateBackup({ type: 'unknown', version: 1, items: [] }).valid).toBe(false);
            expect(codecs.validateBackup({ type: 'playlists' }).valid).toBe(false);
            expect(codecs.validateBackup({ type: 'playlists', version: 1 }).valid).toBe(false);
        });
    });
});
