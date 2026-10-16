import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const model = createRequire(import.meta.url)('../js/admin-changes.js');
const source = readFileSync('admin-musica.html', 'utf8');
async function boot() {
    const original = { artists: [{ name: 'Grup', genres: ['Rock'], reviewStatus: 'pendent', active: false }] };
    const elements = new Map();
    const element = id => {
        if (!elements.has(id)) elements.set(id, { value: '', textContent: '', innerHTML: '', appendChild() {}, addEventListener() {}, click() {} });
        return elements.get(id);
    };
    const stored = new Map();
    const localStorage = { getItem: key => stored.get(key), setItem: vi.fn((key, value) => stored.set(key, value)), removeItem: key => stored.delete(key) };
    const ctx = { window: { SegueixAdminChanges: model }, document: { getElementById: element, createElement: () => element('new') },
        fetch: vi.fn(async url => ({ ok: true, json: async () => url.includes('genres') ? { categories: [{ label: 'Rock' }] } : original })),
        localStorage, sessionStorage: { removeItem() {} }, confirm: vi.fn(() => true), setTimeout: () => {}, Blob,
        URL: { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL() {} } };
    vm.createContext(ctx);
    vm.runInContext(source.match(/<script>([\s\S]*?)<\/script>/)[1] + '\nthis.current = () => db;', ctx);
    await vi.waitFor(() => expect(ctx.current()?.artists).toHaveLength(1));
    const edited = model.editor(original); edited.artists[0].reviewStatus = 'aprovat'; edited.artists[0].active = true;
    const patch = model.create(original, edited);
    const file = { size: 100, text: async () => JSON.stringify(patch) };
    return { ctx, original, file, element };
}
describe('panell editorial estàtic', () => {
    it('ofereix JSON sense credencials, CSV ni peticions d’escriptura', () => {
        expect(source).toContain('Descarrega canvis .json');
        expect(source).toContain('Importa canvis .json');
        expect(source).not.toMatch(/id="adminToken"|saveGithub|\/api\/|exportCsv|method:\s*['"]POST/);
        expect(source).toContain('name="robots" content="noindex,nofollow"');
        expect(() => new vm.Script(source.match(/<script>([\s\S]*?)<\/script>/)[1])).not.toThrow();
    });
    it('manté edició, confirmació i validació de la importació abans de substituir l’esborrany', () => {
        expect(source).toContain('function editYoutube(index)');
        expect(source).toContain('function deleteArtist(index)');
        const flow = source.slice(source.indexOf('async function importChanges'), source.indexOf('function esc'));
        expect(flow.indexOf('changesModel.apply')).toBeLessThan(flow.indexOf('confirm('));
        expect(flow.indexOf('confirm(')).toBeLessThan(flow.indexOf('localStorage.setItem'));
        expect(flow.indexOf('localStorage.setItem')).toBeLessThan(flow.indexOf('db=next'));
    });
    it('importa i exporta un esborrany sense cap petició d’escriptura', async () => {
        const { ctx, file } = await boot();
        await ctx.importChanges(file);
        expect(ctx.current().artists[0].reviewStatus).toBe('aprovat');
        ctx.exportChanges();
        const blob = ctx.URL.createObjectURL.mock.calls[0][0];
        expect(JSON.parse(await blob.text()).product).toBe(model.PRODUCT);
        expect(ctx.fetch).toHaveBeenCalledTimes(2);
        expect(ctx.fetch.mock.calls.every(([, options]) => !options.method)).toBe(true);
    });
    it('cancel·lar o importar un JSON invàlid conserva l’esborrany', async () => {
        const { ctx, file } = await boot(); ctx.confirm.mockReturnValue(false);
        await ctx.importChanges(file);
        expect(ctx.current().artists[0].reviewStatus).toBe('pendent');
        await ctx.importChanges({ size: 2, text: async () => '{}' });
        expect(ctx.localStorage.setItem).not.toHaveBeenCalled();
        expect(ctx.current().artists[0].reviewStatus).toBe('pendent');
    });
    it('si falta espai no substitueix la vista importada', async () => {
        const { ctx, file, element } = await boot();
        ctx.localStorage.setItem.mockImplementation(() => { throw new Error('Sense espai'); });
        await ctx.importChanges(file);
        expect(ctx.current().artists[0].reviewStatus).toBe('pendent');
        expect(element('adminMessage').textContent).toContain('Sense espai');
    });
});
