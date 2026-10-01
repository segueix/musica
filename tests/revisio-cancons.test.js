import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const rev = require('../js/revisio-cancons.js');
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const eligible = video => ['song', 'live_song'].includes(video.contentType);
const decorate = video => ({
    ...video,
    originalTitle: video.title,
    title: video.title.replace(/^.* - /, ''),
    channelTitle: 'Artista X',
});
const videos = [
    { id: 'a1', title: 'Artista X - Zeta', channelTitle: 'artistax', contentType: 'song' },
    { id: 'a2', title: 'Artista X - Àlbum', channelTitle: 'artistax', contentType: 'song' },
    { id: 'a3', title: 'Un short', contentType: 'song', isShort: true },
    { id: 'a4', title: 'Entrevista', contentType: 'interview' },
    { id: 'a5', title: 'Ocultada', contentType: 'song' },
    { id: 'a1', title: 'Duplicada', contentType: 'song' },
];
const build = () => rev.buildRows({ videos, hiddenIds: new Set(['a5']), isEligible: eligible, decorate });

describe('revisió de cançons', () => {
    it('només hi surten les cançons publicades (sense Shorts, ocultes, entrevistes ni duplicats)', () => {
        expect(build().map(row => row.id)).toEqual(['a1', 'a2']);
    });

    it('el títol és el que es veu a l’app i es conserva el de YouTube', () => {
        const [row] = build();
        expect(row.title).toBe('Zeta');
        expect(row.currentTitle).toBe('Zeta');
        expect(row.originalTitle).toBe('Artista X - Zeta');
        expect(row.artist).toBe('Artista X');
    });

    it('només exporta les cançons editades i un títol igual a l’actual no és un canvi', () => {
        const rows = rev.withDrafts(build(), { a1: 'Zeta (en directe)', a2: ' Àlbum ' });
        expect(rev.summarize(rows)).toEqual({ total: 2, changed: 1, ok: 0, pending: 2 });
        const doc = rev.buildExport(rows, { now: '2026-10-01T00:00:00Z' });
        expect(doc.type).toBe('revisio-cancons');
        expect(doc.songs).toEqual([
            {
                id: 'a1',
                artist: 'Artista X',
                originalTitle: 'Artista X - Zeta',
                currentTitle: 'Zeta',
                title: 'Zeta (en directe)',
                ok: false,
            },
        ]);
    });

    it('cerca sense accents, filtra les editades i ordena per títol', () => {
        const rows = rev.withDrafts(build(), { a1: 'Zeta 2' });
        expect(rev.filterRows(rows, {}).map(row => row.id)).toEqual(['a2', 'a1']);
        expect(rev.filterRows(rows, { query: 'album' }).map(row => row.id)).toEqual(['a2']);
        expect(rev.filterRows(rows, { filter: 'changed' }).map(row => row.id)).toEqual(['a1']);
    });

    it('la pàgina carrega els mateixos scripts que l’app i la d’artistes hi redirigeix', () => {
        const page = read('revisio-cancons.html');
        expect(page).toContain('js/song-title.js');
        expect(page).toContain('js/music-categories.js');
        expect(page).toContain('Descarrega els canvis');
        expect(read('revisio-artistes.html')).toContain('url=revisio-cancons.html');
    });

    it('una cançó marcada OK surt dels pendents però la seva edició es continua exportant', () => {
        const rows = rev.withDrafts(build(), { a1: 'Zeta nova' }, new Set(['a1']));
        expect(rev.summarize(rows)).toEqual({ total: 2, changed: 1, ok: 1, pending: 1 });
        expect(rev.filterRows(rows, { filter: 'pending' }).map(row => row.id)).toEqual(['a2']);
        expect(rev.filterRows(rows, { filter: 'ok' }).map(row => row.id)).toEqual(['a1']);
        const doc = rev.buildExport(rows);
        expect(doc.ok).toBe(1);
        expect(doc.songs).toHaveLength(1);
        expect(doc.songs[0]).toMatchObject({ id: 'a1', title: 'Zeta nova', ok: true });
    });

    it('treure la marca OK la torna als pendents', () => {
        const marked = rev.withDrafts(build(), {}, ['a1']);
        const unmarked = rev.withDrafts(marked, {}, []);
        expect(rev.filterRows(unmarked, { filter: 'pending' })).toHaveLength(2);
    });

    it('la pàgina té la casella OK i el filtre de pendents per defecte', () => {
        const page = read('revisio-cancons.html');
        expect(page).toContain('data-ok=');
        expect(page).toMatch(/<select id="filter"[^>]*>\s*<option value="pending">Pendents<\/option>/);
        expect(page).toContain('Marca aquesta pàgina com a OK');
    });
});
