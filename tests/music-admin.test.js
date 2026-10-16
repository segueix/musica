import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const model = require('../js/admin-changes.js');
const { applyFile } = require('../scripts/aplicar_canvis_admin.cjs');
const taxonomy = { categories: [{ label: 'Pop' }, { label: 'Rock' }] };
const base = () => ({ schemaVersion: 1, artists: [
    { name: 'Grup', wikidataId: 'Q1', genres: ['Rock'], reviewStatus: 'pendent', active: false,
        youtube: { channels: [], candidates: [{ handle: '@grup' }] }, enrichment: { keep: true } },
    { name: 'Grup', wikidataId: 'Q2', genres: ['Pop'], reviewStatus: 'pendent', active: false },
] });
const dirs = [];
afterEach(() => dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })));
function changed() {
    const db = base(), edit = model.editor(db);
    edit.artists[0].genres = ['Pop']; edit.artists[0].reviewStatus = 'aprovat'; edit.artists[0].active = true;
    return { db, edit, patch: model.create(db, edit) };
}
describe('administració musical amb JSON', () => {
    it('conserva metadades i homònims i protegeix les categories manuals', () => {
        const { db, patch } = changed();
        const result = model.clean(model.apply(db, patch, taxonomy));
        expect(result.artists[0]).toMatchObject({ genres: ['Pop'], reviewStatus: 'aprovat', active: true, enrichment: { keep: true } });
        expect(result.artists[0].sources).toContain('genre:manual');
        expect(result.artists[0].youtube).toEqual(db.artists[0].youtube);
        expect(result.artists[1]).toEqual(db.artists[1]);
        expect(db).toEqual(base());
        expect(JSON.stringify(result)).not.toContain('__adminIndex');
    });
    it('elimina només la identitat triada encara que el nom es repeteixi', () => {
        const db = base(), edit = model.editor(db); edit.artists.splice(0, 1);
        const result = model.apply(db, model.create(db, edit), taxonomy);
        expect(result.artists.map(a => a.wikidataId)).toEqual(['Q2']);
    });
    it('permet substituir canals amb ID vàlid', () => {
        const { db, edit } = changed();
        edit.artists[0].youtube.channels = [{ id: 'UC1234567890123456789012', type: 'topic', primary: true }];
        expect(model.apply(db, model.create(db, edit), taxonomy).artists[0].youtube.channels).toEqual(edit.artists[0].youtube.channels);
    });
    it.each([{ genres: ['Inventat'] }, { active: 'false' }, { reviewStatus: 'publicat' },
        { name: 'Canvi no permès' }, { youtubeChannels: [{ id: 'bad' }] }])('rebutja camps invàlids: %j', fields => {
        const { db, patch } = changed(); patch.changes[0].fields = fields;
        expect(() => model.apply(db, patch, taxonomy)).toThrow(); expect(db).toEqual(base());
    });
    it('no sobreescriu una fitxa canviada, però conserva altres canvis independents', () => {
        const { db, patch } = changed(); db.artists[1].name = 'Nom nou';
        expect(model.apply(db, patch, taxonomy).artists[1].name).toBe('Nom nou');
        db.artists[0].genres = ['Pop'];
        expect(() => model.apply(db, patch, taxonomy)).toThrow(/Conflicte/);
    });
    it('rebutja identitats ambigües, operacions repetides i fitxers aliens', () => {
        const { db, patch } = changed();
        expect(() => model.apply({ ...db, artists: [db.artists[0], db.artists[0]] }, patch, taxonomy)).toThrow(/Conflicte/);
        expect(() => model.apply(db, { ...patch, changes: [...patch.changes, ...patch.changes] }, taxonomy)).toThrow(/Conflicte/);
        expect(() => model.apply(db, { ...patch, product: 'segueix-musica' }, taxonomy)).toThrow();
    });
    it('pot reprendre el JSON sense perdre la identitat dels artistes', () => {
        const { db, patch } = changed(); const resumed = model.apply(db, JSON.parse(JSON.stringify(patch)), taxonomy);
        expect(model.create(db, resumed)).toEqual(patch);
    });
    it('el CLI comprova abans d’escriure i no modifica res si hi ha conflictes', () => {
        const root = mkdtempSync(join(tmpdir(), 'admin-static-')); dirs.push(root); mkdirSync(join(root, 'data'));
        const { db, patch } = changed(); const file = join(root, 'data/artistes-musica.json');
        const patchFile = join(root, 'changes.json'); const original = JSON.stringify(db);
        writeFileSync(file, original); writeFileSync(patchFile, JSON.stringify(patch));
        writeFileSync(join(root, 'data/music-genres.json'), JSON.stringify(taxonomy));
        expect(applyFile(root, patchFile)).toEqual({ changes: 1, dryRun: true });
        expect(readFileSync(file, 'utf8')).toBe(original);
        applyFile(root, patchFile, { dryRun: false });
        const applied = readFileSync(file, 'utf8'); expect(JSON.parse(applied).artists[0].genres).toEqual(['Pop']);
        expect(() => applyFile(root, patchFile, { dryRun: false })).toThrow(/Conflicte/);
        expect(readFileSync(file, 'utf8')).toBe(applied);
    });
});
