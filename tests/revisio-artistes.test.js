import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const R = require('../js/revisio-artistes.js');

const taxonomy = ['Pop', 'Rock', 'Indie / Alternativa', 'Folk i arrel', 'Metal'];

const artist = (name, extra = {}) => ({
    name,
    aliases: [],
    genres: ['Pop'],
    wikidataId: `Q${name.length}${name.charCodeAt(0)}`,
    youtube: { channels: [{ id: `UC${name.padEnd(22, 'x')}`.slice(0, 24), type: 'official', primary: true }] },
    reviewStatus: 'pendent',
    active: false,
    sources: ['wikidata:x'],
    ...extra,
});

const db = () => ({
    schemaVersion: 1,
    updatedAt: 'abans',
    artists: [
        artist('Bruixa'),
        artist('Alosa', { genres: ['Folk i arrel', 'Pop'] }),
        artist('Sense Canal', { youtube: { channels: [] } }),
        artist('Rebutjat', { reviewStatus: 'rebutjat' }),
    ],
});

describe('revisió d’artistes: quins surten', () => {
    it('només els ben indexats (amb canal de YouTube i no rebutjats), en ordre alfabètic', () => {
        const rows = R.buildRows(db(), {}, taxonomy);
        expect(rows.map(row => row.originalName)).toEqual(['Alosa', 'Bruixa']);
        expect(R.isIndexed({ youtube: { channels: [] } })).toBe(false);
        expect(R.isIndexed(null)).toBe(false);
    });

    it('les categories es mostren en l’ordre de la taxonomia i només les que hi són', () => {
        const rows = R.buildRows(db(), {}, taxonomy);
        expect(rows[0].genres).toEqual(['Pop', 'Folk i arrel']);
        expect(R.normalizeGenres(['Metal', 'inventada', 'Pop'], taxonomy)).toEqual(['Pop', 'Metal']);
    });

    it('aplica l’esborrany (només els canvis) i el resum ho compta', () => {
        const base = db();
        const key = R.artistKey(base.artists[0]);
        const rows = R.buildRows(base, { [key]: { name: '  Bruixa   Nova ', genres: ['Rock'], ok: true } }, taxonomy);
        const row = rows.find(item => item.key === key);
        expect(row).toMatchObject({ name: 'Bruixa Nova', genres: ['Rock'], ok: true, originalName: 'Bruixa' });
        expect(R.summarize(rows)).toMatchObject({ total: 2, ok: 1, renamed: 1, recategorized: 1 });
        expect(R.draftOf(row)).toEqual({ name: 'Bruixa Nova', genres: ['Rock'], ok: true });
        expect(R.draftOf(rows.find(item => item.key !== key))).toBeNull();
    });
});

describe('revisió d’artistes: document i aplicació', () => {
    it('el document porta totes les files amb què ha canviat cadascuna', () => {
        const base = db();
        const key = R.artistKey(base.artists[0]);
        const rows = R.buildRows(base, { [key]: { ok: true } }, taxonomy);
        const doc = R.buildExport(rows, { baseUpdatedAt: 'abans', now: '2026-10-01T10:00:00.000Z' });
        expect(doc).toMatchObject({ type: 'revisio-artistes', version: 1, baseUpdatedAt: 'abans' });
        expect(doc.artists).toHaveLength(2);
        expect(doc.artists.find(item => item.key === key)).toMatchObject({
            ok: true,
            okChanged: true,
            nameChanged: false,
        });
    });

    it('aplica noms (l’anterior passa a àlies), categories (manuals) i OK, sense tocar la resta ni l’original', () => {
        const base = db();
        const before = JSON.stringify(base);
        const keyA = R.artistKey(base.artists[1]);
        const keyB = R.artistKey(base.artists[0]);
        const doc = {
            type: 'revisio-artistes',
            version: 1,
            artists: [
                {
                    key: keyA,
                    originalName: 'Alosa',
                    name: 'Alosa Band',
                    genres: ['Rock'],
                    ok: true,
                    nameChanged: true,
                    genresChanged: true,
                },
                {
                    key: keyB,
                    originalName: 'Bruixa',
                    name: 'Bruixa',
                    genres: ['Pop'],
                    ok: true,
                    nameChanged: false,
                    genresChanged: false,
                },
            ],
        };
        const { db: next, report } = R.applyExport(base, doc, taxonomy, '2026-10-01T10:00:00.000Z');
        expect(JSON.stringify(base)).toBe(before);
        const alosa = next.artists[1];
        expect(alosa).toMatchObject({ name: 'Alosa Band', aliases: ['Alosa'], genres: ['Rock'] });
        expect(alosa.sources).toContain('genre:manual');
        expect(alosa.revisioEditorial).toEqual({ ok: true, at: '2026-10-01T10:00:00.000Z' });
        expect(next.artists[0].revisioEditorial.ok).toBe(true);
        expect(next.artists[0].genres).toEqual(['Pop']);
        expect(next.artists[0].sources).not.toContain('genre:manual');
        expect(next.updatedAt).toBe('2026-10-01T10:00:00.000Z');
        expect(report.renamed).toEqual(['Alosa → Alosa Band']);
        expect(report.marked).toBe(2);
    });

    it('treu la marca OK si es desmarca i informa dels artistes no trobats i de les categories desconegudes', () => {
        const base = db();
        base.artists[0].revisioEditorial = { ok: true, at: 'x' };
        const doc = {
            type: 'revisio-artistes',
            version: 1,
            artists: [
                {
                    key: R.artistKey(base.artists[0]),
                    originalName: 'Bruixa',
                    name: 'Bruixa',
                    genres: ['Pop', 'Inventada'],
                    ok: false,
                    genresChanged: true,
                },
                { key: 'wikidata:Q0', originalName: 'Ningú', name: 'Ningú', genres: [], ok: true },
            ],
        };
        const { db: next, report } = R.applyExport(base, doc, taxonomy);
        expect(next.artists[0].revisioEditorial).toBeUndefined();
        expect(report.missing).toEqual(['Ningú']);
        expect(report.invalid.join(' ')).toMatch(/Inventada/);
    });

    it('un document que no és de revisió no toca res', () => {
        const base = db();
        const { db: next, report } = R.applyExport(base, { type: 'altre' }, taxonomy);
        expect(next).toBe(base);
        expect(report.invalid).toHaveLength(1);
    });

    it('si el nom nou torna a ser un àlies existent no el duplica ni afegeix el nom actual com a àlies', () => {
        const base = db();
        base.artists[0].aliases = ['Bruixeta'];
        const doc = {
            type: 'revisio-artistes',
            version: 1,
            artists: [
                {
                    key: R.artistKey(base.artists[0]),
                    originalName: 'Bruixa',
                    name: 'Bruixeta',
                    genres: ['Pop'],
                    ok: false,
                    nameChanged: true,
                },
            ],
        };
        const { db: next } = R.applyExport(base, doc, taxonomy);
        expect(next.artists[0].name).toBe('Bruixeta');
        expect(next.artists[0].aliases).toEqual(['Bruixa']);
    });
});

describe('revisió d’artistes: pàgina i dades reals', () => {
    const html = fs.readFileSync('revisio-artistes.html', 'utf8');
    const real = JSON.parse(fs.readFileSync('data/artistes-musica.json', 'utf8'));
    const genres = JSON.parse(fs.readFileSync('data/music-genres.json', 'utf8')).categories.map(
        category => category.label
    );

    it('té el nom editable, les categories, la columna OK i el botó de baixar el document', () => {
        expect(html).toContain('class="name"');
        expect(html).toContain('edit-genres');
        expect(html).toContain('class="ok"');
        expect(html).toContain('id="download"');
        expect(html).toContain('js/revisio-artistes.js');
        expect(html).toContain('name="robots"');
    });

    it('amb les dades reals surten tots els artistes amb canal i només ells', () => {
        const rows = R.buildRows(real, {}, genres);
        const withChannel = real.artists.filter(
            item => item.reviewStatus !== 'rebutjat' && item.youtube?.channels?.length
        );
        expect(rows).toHaveLength(withChannel.length);
        expect(rows.length).toBeGreaterThan(100);
    });

    it('aplicar un document buit de canvis sobre les dades reals no en modifica res', () => {
        const rows = R.buildRows(real, {}, genres);
        const { db: next, report } = R.applyExport(real, R.buildExport(rows), genres);
        expect(JSON.stringify(next.artists)).toBe(JSON.stringify(real.artists));
        expect(report.renamed).toEqual([]);
        expect(report.recategorized).toEqual([]);
    });
});
