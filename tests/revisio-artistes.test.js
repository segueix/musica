import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { loadScript } from './setup.js';

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

const channelNames = new Map();
const base = () => {
    const data = db();
    data.artists.forEach(item => channelNames.set(item.youtube.channels[0]?.id, `canal-${item.name.toLowerCase()}`));
    return data;
};

describe('revisió d’artistes: quins surten i quin nom es veu', () => {
    it('només els ben indexats (amb canal de YouTube i no rebutjats), en ordre alfabètic', () => {
        const rows = R.buildRows(base(), {}, taxonomy, channelNames);
        expect(rows.map(row => row.currentName)).toEqual(['canal-alosa', 'canal-bruixa']);
        expect(R.isIndexed({ youtube: { channels: [] } })).toBe(false);
        expect(R.isIndexed(null)).toBe(false);
    });

    it('el nom editable és el que es veu a l’app: el del canal de YouTube o el nom a mostrar ja editat', () => {
        const data = base();
        data.artists[1].displayName = 'Alosa (oficial)';
        const rows = R.buildRows(data, {}, taxonomy, channelNames);
        const alosa = rows.find(row => row.originalName === 'canal-alosa');
        expect(alosa).toMatchObject({
            currentName: 'Alosa (oficial)',
            name: 'Alosa (oficial)',
            originalName: 'canal-alosa',
        });
        expect(rows.find(row => row.originalName === 'canal-bruixa')).toMatchObject({ currentName: 'canal-bruixa' });
        // sense dades del canal, cau al nom de la base d'artistes
        expect(R.buildRows(base(), {}, taxonomy)[0].originalName).toBe('Alosa');
    });

    it('les categories es mostren en l’ordre de la taxonomia i només les que hi són', () => {
        const rows = R.buildRows(base(), {}, taxonomy, channelNames);
        expect(rows[0].genres).toEqual(['Pop', 'Folk i arrel']);
        expect(R.normalizeGenres(['Metal', 'inventada', 'Pop'], taxonomy)).toEqual(['Pop', 'Metal']);
    });

    it('aplica l’esborrany (només els canvis) i el resum ho compta', () => {
        const data = base();
        const key = R.artistKey(data.artists[0]);
        const rows = R.buildRows(
            data,
            { [key]: { name: '  Bruixa   Nova ', genres: ['Rock'], ok: true } },
            taxonomy,
            channelNames
        );
        const row = rows.find(item => item.key === key);
        expect(row).toMatchObject({ name: 'Bruixa Nova', genres: ['Rock'], ok: true, currentName: 'canal-bruixa' });
        expect(R.summarize(rows)).toMatchObject({ total: 2, ok: 1, renamed: 1, recategorized: 1 });
        expect(R.draftOf(row)).toEqual({ name: 'Bruixa Nova', genres: ['Rock'], ok: true });
        expect(R.draftOf(rows.find(item => item.key !== key))).toBeNull();
    });
});

describe('revisió d’artistes: document i aplicació', () => {
    it('el document porta totes les files amb el nom actual, el del canal i què ha canviat', () => {
        const data = base();
        const key = R.artistKey(data.artists[0]);
        const rows = R.buildRows(data, { [key]: { ok: true } }, taxonomy, channelNames);
        const doc = R.buildExport(rows, { baseUpdatedAt: 'abans', now: '2026-10-01T10:00:00.000Z' });
        expect(doc).toMatchObject({ type: 'revisio-artistes', version: 1, baseUpdatedAt: 'abans' });
        expect(doc.artists).toHaveLength(2);
        expect(doc.artists.find(item => item.key === key)).toMatchObject({
            ok: true,
            okChanged: true,
            nameChanged: false,
            originalName: 'canal-bruixa',
            currentName: 'canal-bruixa',
        });
    });

    it('desa el nom a mostrar (displayName) sense tocar name ni àlies; categories manuals; OK', () => {
        const data = base();
        const before = JSON.stringify(data);
        const keyA = R.artistKey(data.artists[1]);
        const keyB = R.artistKey(data.artists[0]);
        const doc = {
            type: 'revisio-artistes',
            version: 1,
            artists: [
                {
                    key: keyA,
                    originalName: 'canal-alosa',
                    currentName: 'canal-alosa',
                    name: 'Alosa Band',
                    genres: ['Rock'],
                    ok: true,
                    nameChanged: true,
                    genresChanged: true,
                },
                {
                    key: keyB,
                    originalName: 'canal-bruixa',
                    currentName: 'canal-bruixa',
                    name: 'canal-bruixa',
                    genres: ['Pop'],
                    ok: true,
                    nameChanged: false,
                    genresChanged: false,
                },
            ],
        };
        const { db: next, report } = R.applyExport(data, doc, taxonomy, '2026-10-01T10:00:00.000Z');
        expect(JSON.stringify(data)).toBe(before);
        const alosa = next.artists[1];
        expect(alosa).toMatchObject({ name: 'Alosa', displayName: 'Alosa Band', aliases: [], genres: ['Rock'] });
        expect(alosa.sources).toContain('genre:manual');
        expect(alosa.revisioEditorial).toEqual({ ok: true, at: '2026-10-01T10:00:00.000Z' });
        expect(next.artists[0].displayName).toBeUndefined();
        expect(next.artists[0].revisioEditorial.ok).toBe(true);
        expect(next.artists[0].sources).not.toContain('genre:manual');
        expect(next.updatedAt).toBe('2026-10-01T10:00:00.000Z');
        expect(report.renamed).toEqual(['canal-alosa → Alosa Band']);
        expect(report.marked).toBe(2);
    });

    it('tornar al nom del canal de YouTube treu el nom editat', () => {
        const data = base();
        data.artists[0].displayName = 'Bruixa Nova';
        const doc = {
            type: 'revisio-artistes',
            version: 1,
            artists: [
                {
                    key: R.artistKey(data.artists[0]),
                    originalName: 'canal-bruixa',
                    currentName: 'Bruixa Nova',
                    name: 'canal-bruixa',
                    genres: ['Pop'],
                    ok: false,
                    nameChanged: true,
                },
            ],
        };
        const { db: next, report } = R.applyExport(data, doc, taxonomy);
        expect(next.artists[0].displayName).toBeUndefined();
        expect(report.renamed).toEqual(['Bruixa Nova → canal-bruixa']);
    });

    it('treu la marca OK si es desmarca i informa dels artistes no trobats i de les categories desconegudes', () => {
        const data = base();
        data.artists[0].revisioEditorial = { ok: true, at: 'x' };
        const doc = {
            type: 'revisio-artistes',
            version: 1,
            artists: [
                {
                    key: R.artistKey(data.artists[0]),
                    originalName: 'Bruixa',
                    name: 'Bruixa',
                    genres: ['Pop', 'Inventada'],
                    ok: false,
                    genresChanged: true,
                },
                { key: 'wikidata:Q0', originalName: 'Ningú', name: 'Ningú', genres: [], ok: true },
            ],
        };
        const { db: next, report } = R.applyExport(data, doc, taxonomy);
        expect(next.artists[0].revisioEditorial).toBeUndefined();
        expect(report.missing).toEqual(['Ningú']);
        expect(report.invalid.join(' ')).toMatch(/Inventada/);
    });

    it('un document que no és de revisió no toca res', () => {
        const data = base();
        const { db: next, report } = R.applyExport(data, { type: 'altre' }, taxonomy);
        expect(next).toBe(data);
        expect(report.invalid).toHaveLength(1);
    });
});

describe('el nom editat es veu a l’app', () => {
    const load = extra =>
        loadScript('js/music-categories.js', { fetch: undefined, ...extra }).SegueixMusicCategories || null;

    it('music-categories substitueix channelTitle i el nom del canal, i conserva el de YouTube', async () => {
        const data = {
            artists: [
                {
                    name: 'Alfred Garcia',
                    genres: ['Pop'],
                    displayName: 'Alfred García',
                    youtube: { channels: [{ id: 'UCabc', name: null }] },
                    reviewStatus: 'pendent',
                },
            ],
        };
        const ctx = loadScript('js/music-categories.js', {
            SegueixSongTitle: loadScript('js/song-title.js').SegueixSongTitle,
            fetch: async url => ({
                ok: true,
                json: async () => (String(url).includes('musica-classica') ? { artists: [] } : data),
            }),
        });
        const music = ctx.SegueixMusicCategories;
        await music.init();
        expect(music.displayNameForChannel('UCabc')).toBe('Alfred García');
        const video = music.decorateVideo({
            id: 'v1',
            channelId: 'UCabc',
            channelTitle: 'alfredgarcia',
            title: 'alfredgarcia - Cançó (Videoclip)',
        });
        expect(video.channelTitle).toBe('Alfred García');
        expect(video.originalChannelTitle).toBe('alfredgarcia');
        expect(video.title).toBe('Cançó');
        const channel = music.decorateChannel({ id: 'UCabc', name: 'alfredgarcia' });
        expect(channel).toMatchObject({ name: 'Alfred García', originalName: 'alfredgarcia' });
        // sense nom editat no es toca res
        expect(music.decorateVideo({ id: 'v2', channelId: 'UCaltre', channelTitle: 'X' }).channelTitle).toBe('X');
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
