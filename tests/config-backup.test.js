import { readFileSync, existsSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, it, expect, vi } from 'vitest';

const song = { id: 'song0000001', title: 'Cançó', viewedAt: '2026-10-16T09:00:00Z' };
const channel = 'UC' + 'a'.repeat(22);
function setup() {
    const values = new Map();
    const storage = {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key),
        key: i => [...values.keys()][i],
        get length() { return values.size; },
    };
    const elements = new Map();
    const element = id => {
        if (!elements.has(id)) elements.set(id, { addEventListener: vi.fn(), click: vi.fn() });
        return elements.get(id);
    };
    const signals = { persistForSync: vi.fn(), replaceSynchronizedData: vi.fn() };
    const feedback = vi.fn();
    const ctx = createContext({
        console, Blob, Date, setTimeout: fn => fn(), confirm: vi.fn(() => true),
        location: { reload: vi.fn() }, localStorage: storage, fetch: vi.fn(),
        URL: { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() },
        document: { getElementById: element, body: { appendChild: vi.fn() },
            createElement: () => ({ click: vi.fn(), remove: vi.fn() }) },
        SegueixApp: { features: { musicSignals: signals }, utils: { configFeedback: { showConfigFeedback: feedback } } },
    });
    ctx.window = ctx;
    for (const path of ['js/utils/music-data.js', 'js/features/config-backup.js']) {
        runInContext(readFileSync(path, 'utf8'), ctx);
    }
    const data = ctx.SegueixApp.utils.musicData;
    const api = ctx.SegueixApp.features.configBackup;
    const importRaw = raw => api.handleFileImport({ target: { value: 'file', files: [
        { size: JSON.stringify(raw).length, text: async () => JSON.stringify(raw) },
    ] } });
    return { ctx, api, data, values, storage, feedback, signals, element, importRaw };
}

describe('còpia JSON local de Música', () => {
    it('transporta totes les dades musicals sense credencials ni dades alienes', async () => {
        const a = setup();
        const records = {
            catube_history: [song], catube_liked_videos: [song], catube_follows: [channel],
            catube_playlists: [{ id: 'pl_1', name: 'La meva ràdio', videos: [song] }],
            catube_music_user_categories: [{ id: 'cat_1', name: 'Preferits', artists: [channel] }],
            catube_music_prefs_v1: { blocked: { 'wd:q1': { on: true, at: 123 } } },
            catube_music_signals_v1: { songs: { [song.id]: { q: 4 } }, artists: {}, recent: [] },
            catube_first_styles: ['Rock'], catube_music_home_style_order: ['Rock', 'Pop'],
        };
        for (const [key, value] of Object.entries(records)) a.storage.setItem(key, JSON.stringify(value));
        a.storage.setItem('catube_discovery_mode', 'mix');
        a.storage.setItem('catube_background_color', '#112233');
        a.storage.setItem('catube_font_size', '18');
        a.storage.setItem('catube_drive_account', 'secret');
        a.storage.setItem('foreign-token', 'secret');
        const backup = a.data.collect();
        expect(JSON.stringify(backup)).not.toContain('secret');
        const b = setup();
        b.storage.setItem('foreign-token', 'keep');
        b.storage.setItem('segueix_cookie_consent_v2', 'keep');
        const refresh = vi.fn();
        b.api.registerRuntime({ refreshView: refresh });
        await b.importRaw(backup);
        expect(b.data.collect().data).toEqual(backup.data);
        expect(b.storage.getItem('foreign-token')).toBe('keep');
        expect(b.storage.getItem('segueix_cookie_consent_v2')).toBe('keep');
        expect(b.signals.replaceSynchronizedData).toHaveBeenCalledOnce();
        expect(refresh).toHaveBeenCalledOnce();
        expect(b.ctx.fetch).not.toHaveBeenCalled();
        expect(b.ctx.location.reload).not.toHaveBeenCalled();
    });

    it.each([{}, { product: 'segueix-musica', v: 1, data: {} },
        { product: 'segueix-musica', v: 1, data: { history: 'invalid' } }])('rebutja una còpia incompleta sense escriptures', async raw => {
        const b = setup();
        b.storage.setItem('catube_history', JSON.stringify([song]));
        const before = [...b.values];
        await b.importRaw(raw);
        expect([...b.values]).toEqual(before);
        expect(b.ctx.confirm).not.toHaveBeenCalled();
        expect(b.feedback).toHaveBeenLastCalledWith('configManualFeedback', expect.any(String), 'error');
    });

    it('rebutja productes i versions diferents i un JSON trencat', async () => {
        const b = setup();
        for (const patch of [{ product: 'segueix' }, { v: 2 }]) {
            await b.importRaw({ ...b.data.collect(), ...patch });
            expect(b.ctx.confirm).not.toHaveBeenCalled();
        }
        await b.api.handleFileImport({ target: { files: [{ size: 1, text: async () => '{' }] } });
        expect(b.values.size).toBe(0);
        expect(b.feedback).toHaveBeenLastCalledWith('configManualFeedback', expect.any(String), 'error');
    });

    it('cancel·lar la importació conserva les dades', async () => {
        const b = setup();
        const backup = b.data.collect();
        b.storage.setItem('catube_history', JSON.stringify([song]));
        b.ctx.confirm.mockReturnValue(false);
        await b.importRaw(backup);
        expect(JSON.parse(b.storage.getItem('catube_history'))).toEqual([song]);
        expect(b.signals.replaceSynchronizedData).not.toHaveBeenCalled();
    });

    it('restaura les dades si una escriptura falla per falta d’espai', async () => {
        const b = setup();
        const backup = b.data.collect();
        b.storage.setItem('catube_history', JSON.stringify([song]));
        b.storage.setItem('unrelated', 'keep');
        const before = new Map(b.values);
        const write = b.storage.setItem;
        b.storage.setItem = (key, value) => {
            if (key === 'catube_follows') throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
            write(key, value);
        };
        await b.importRaw(backup);
        expect(b.values).toEqual(before);
        expect(b.signals.replaceSynchronizedData).not.toHaveBeenCalled();
        expect(b.feedback).toHaveBeenLastCalledWith('configManualFeedback', expect.stringContaining('conservat'), 'error');
    });

    it('rebutja fitxers grans abans de llegir-los i permet tornar-ho a provar', async () => {
        const b = setup();
        const file = { size: 9 * 1024 * 1024, text: vi.fn() };
        const target = { files: [file], value: 'file' };
        await b.api.handleFileImport({ target });
        expect(file.text).not.toHaveBeenCalled();
        expect(target.value).toBe('');
        await b.importRaw(b.data.collect());
        expect(b.signals.replaceSynchronizedData).toHaveBeenCalledOnce();
    });

    it('descarrega un JSON sense peticions de xarxa', async () => {
        const b = setup();
        b.api.exportManual();
        const blob = b.ctx.URL.createObjectURL.mock.calls[0][0];
        expect(JSON.parse(await blob.text()).product).toBe('segueix-musica');
        expect(b.signals.persistForSync).toHaveBeenCalledOnce();
        expect(b.ctx.fetch).not.toHaveBeenCalled();
        expect(b.ctx.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    });

    it('retira metadades antigues i registra cada botó una sola vegada', () => {
        const b = setup();
        for (const key of ['catube_drive_account', 'catube_music_anonymous_analytics_client_v1', 'sync_device_id']) b.storage.setItem(key, 'old');
        b.storage.setItem('catube_history', JSON.stringify([song]));
        b.api.register(); b.api.register();
        expect([...b.values.keys()]).toEqual(['catube_history']);
        expect(b.element('exportConfigManualBtn').addEventListener).toHaveBeenCalledOnce();
        expect(b.ctx.fetch).not.toHaveBeenCalled();
    });

    it('la pàgina i el precache no carreguen serveis retirats', () => {
        for (const path of ['index.html', 'sw.js']) {
            const source = readFileSync(path, 'utf8');
            expect(source).not.toMatch(/google-drive|drive-sync-model|features\/analytics|features\/config-sync/);
            expect(source).toContain('js/features/config-backup.js');
        }
        expect(existsSync('functions/api/analytics.js')).toBe(false);
    });
});
