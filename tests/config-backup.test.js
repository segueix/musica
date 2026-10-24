import { readFileSync, existsSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, it, expect, vi } from 'vitest';
import { createMockLocalStorage, loadScript } from './setup.js';

const song = { id: 'song0000001', title: 'Cançó', viewedAt: '2026-10-16T09:00:00Z' };
const channel = 'UC' + 'a'.repeat(22);
// Les regles de fusió de les preferències i les estadístiques són les de musicSignals
const realSignals = loadScript('js/features/music-signals.js', { localStorage: createMockLocalStorage() }).SegueixApp
    .features.musicSignals;
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
    const signals = {
        persistForSync: vi.fn(),
        replaceSynchronizedData: vi.fn(),
        mergeStats: realSignals.mergeStats,
        mergePrefs: realSignals.mergePrefs,
    };
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

describe('importar suma la còpia a les dades de l’aparell (2026-10-24)', () => {
    const songB = { id: 'song0000002', title: 'Una altra', viewedAt: '2026-10-20T10:00:00Z' };
    const songC = { id: 'song0000003', title: 'La tercera', viewedAt: '2026-10-18T10:00:00Z' };
    const channel2 = 'UC' + 'b'.repeat(22);
    const device = records => {
        const d = setup();
        for (const [key, value] of Object.entries(records)) {
            d.storage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        }
        return d;
    };
    const here = () =>
        device({
            catube_history: [song],
            catube_liked_videos: [song],
            catube_follows: [channel],
            catube_playlists: [{ id: 'pl_1', name: 'Estiu', videos: [song] }],
            catube_music_user_categories: [{ id: 'uc_1', name: 'Preferits', artists: [channel] }],
            catube_music_prefs_v1: { v: 1, lessLike: {}, moreLike: {}, blocked: { 'wd:q1': { on: true, at: 100 } } },
            catube_music_signals_v1: { v: 1, songs: { [song.id]: { q: 2, l: 100 } }, artists: {}, recent: [] },
            catube_background_color: '#112233',
        });
    // La còpia d'un altre aparell: hi torna a sonar la primera cançó, més tard
    const otherBackup = () =>
        device({
            catube_history: [{ ...song, viewedAt: '2026-10-21T10:00:00Z' }, songB],
            catube_liked_videos: [songB],
            catube_follows: [channel2],
            catube_playlists: [
                { id: 'pl_1', name: 'Estiu', videos: [songB] },
                { id: 'pl_2', name: 'estiu ', videos: [songC] },
                { id: 'pl_3', name: 'Hivern', videos: [songC] },
            ],
            catube_music_user_categories: [
                { id: 'uc_2', name: 'preferits', artists: [channel2] },
                { id: 'uc_3', name: 'Rock català', artists: [channel2] },
            ],
            catube_music_prefs_v1: { v: 1, lessLike: {}, moreLike: { [songB.id]: { on: true, at: 200 } }, blocked: {} },
            catube_music_signals_v1: {
                v: 1,
                songs: { [song.id]: { q: 5, l: 300 }, [songB.id]: { q: 1, l: 300 } },
                artists: {},
                recent: [],
            },
            catube_background_color: '#445566',
        }).data.collect();

    it('no esborra res i una exportació posterior porta el que hi havia més l’importat', async () => {
        const b = here();
        await b.importRaw(otherBackup());
        expect(b.ctx.confirm.mock.calls[0][0]).toMatch(/s’afegiran.*No s’esborrarà res/);
        // El que exportaria ara aquest aparell
        const data = b.data.collect().data;
        expect(data.history.map(v => [v.id, v.viewedAt])).toEqual([
            [song.id, '2026-10-21T10:00:00Z'],
            [songB.id, songB.viewedAt],
        ]);
        expect(data.likes.map(v => v.id)).toEqual([song.id, songB.id]);
        expect(data.follows).toEqual([channel, channel2]);
        // Mateix identificador o mateix nom: una sola llista, amb totes les cançons
        expect(data.playlists.map(p => [p.id, p.name, p.videos.map(v => v.id)])).toEqual([
            ['pl_1', 'Estiu', [song.id, songB.id, songC.id]],
            ['pl_3', 'Hivern', [songC.id]],
        ]);
        expect(data.categories.map(c => [c.id, c.name, c.artists])).toEqual([
            ['uc_1', 'Preferits', [channel, channel2]],
            ['uc_3', 'Rock català', [channel2]],
        ]);
        expect(data.prefs.blocked['wd:q1'].on).toBe(true);
        expect(data.prefs.moreLike[songB.id].on).toBe(true);
        // Estadístiques: el màxim de cada comptador (importar dues vegades no suma)
        expect(data.stats.songs[song.id].q).toBe(5);
        expect(data.stats.songs[songB.id].q).toBe(1);
        // L'aspecte d'aquest aparell es conserva
        expect(data.settings.background).toBe('#112233');
        expect(b.signals.replaceSynchronizedData).toHaveBeenCalledWith(
            expect.objectContaining({ follows: [channel, channel2] })
        );
        expect(b.feedback).toHaveBeenLastCalledWith(
            'configManualFeedback',
            '✓ Còpia sumada a aquest aparell: 1 cançó més a l’historial, 1 m’agrada, 1 artista seguit, 1 llista i 1 categoria.',
            'success'
        );
    });

    it('importar dues vegades la mateixa còpia no duplica res', async () => {
        const b = here();
        const backup = otherBackup();
        await b.importRaw(backup);
        const once = b.data.collect().data;
        await b.importRaw(backup);
        expect(b.data.collect().data).toEqual(once);
        expect(b.feedback).toHaveBeenLastCalledWith('configManualFeedback', '✓ Còpia sumada a aquest aparell.', 'success');
    });

    it('l’historial sumat no es retalla a 50 cançons', async () => {
        const songs = (letter, n) =>
            Array.from({ length: n }, (_, i) => ({
                id: letter + String(i).padStart(10, '0'),
                title: `Cançó ${i}`,
                viewedAt: new Date(Date.UTC(2026, 9, letter === 'a' ? 1 : 2) + i * 60000).toISOString(),
            }));
        const b = device({ catube_history: songs('a', 50) });
        await b.importRaw(device({ catube_history: songs('b', 50) }).data.collect());
        const history = b.data.collect().data.history;
        expect(history).toHaveLength(100);
        expect(history[0].id).toBe('b0000000049');
        expect(b.data.merge({ history: [...songs('a', 300), ...songs('b', 300)] }, {}).history).toHaveLength(500);
    });

    it('sense les regles de musicSignals, unió simple amb l’aparell al davant', () => {
        const b = setup();
        const merged = b.data.merge(
            { prefs: { blocked: { x: { on: true, at: 1 } } }, stats: { songs: { [song.id]: { q: 2 } } } },
            { prefs: { blocked: { x: { on: false, at: 9 }, y: { on: true, at: 2 } } }, stats: { songs: { [song.id]: { q: 7 } } } }
        );
        expect(merged.prefs.blocked).toEqual({ x: { on: true, at: 1 }, y: { on: true, at: 2 } });
        expect(merged.stats.songs[song.id].q).toBe(2);
    });

    it('l’historial guarda 500 cançons i les vistes només n’amaguen les 50 darreres', () => {
        const storage = readFileSync('js/utils/storage.js', 'utf8');
        expect(storage).toMatch(/const HISTORY_LIMIT = 500;/);
        expect(storage).toMatch(/const HISTORY_HIDE_RECENT = 50;/);
        expect(readFileSync('js/app.js', 'utf8')).toMatch(/getHistoryItems\(\)\.slice\(0, HISTORY_HIDE_RECENT\)/);
        const html = readFileSync('index.html', 'utf8');
        expect(html).toContain('Importar suma la còpia a les dades d’aquest aparell');
        expect(html).not.toContain('Importar substitueix');
        expect(html).toMatch(/js\/utils\/storage\.js\?v=/);
    });
});
