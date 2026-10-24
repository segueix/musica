import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseArtists, visibleSongs } = require('../scripts/revisar_castella_vigilats.js');
const { loadPolicy } = require('../scripts/lib/revisio_idiomes.js');
const { REGLES } = require('../scripts/ocultar_titols_castella.js');

describe("llista d'artistes vigilats (registre únic)", () => {
    const doc = fs.readFileSync('docs/ARTISTES_CASTELLA.md', 'utf8');
    const artists = parseArtists(doc);

    it('llegeix el nom exacte de la primera columna de cada taula', () => {
        expect(parseArtists('| **Sisa** | 3 | x |\n| --- | --- | --- |\n| text | 1 | **no** |')).toEqual(['Sisa']);
        expect(artists).toContain('Joan Manuel Serrat');
        expect(artists).toContain('Judit Neddermann');
        expect(new Set(artists).size).toBe(artists.length);
    });

    it('inclou tots els artistes amb regla per canal a ocultar_titols_castella.js', () => {
        const policy = loadPolicy();
        Object.keys(REGLES).forEach((name) =>
            expect(policy.resolve({ channelTitle: name }).mode, `falta «${name}» al registre`).toBe('vigilats')
        );
    });

    it('agrupa el canal oficial i Topic mitjançant el registre', () => {
        const policy = loadPolicy();
        const feed = {
            videos: [
                {
                    id: 'a',
                    channelId: 'UChYQSBa6bIG2yArpLA4ykvA',
                    channelTitle: 'Nom nou',
                    contentType: 'song',
                },
                {
                    id: 'b',
                    channelId: 'UCvqTGNjxbWceoaz4pkBSEzg',
                    channelTitle: 'Gertrudis - Topic',
                    contentType: 'song',
                },
            ],
        };
        expect(visibleSongs(feed, new Set(), 'Gertrudis', '', policy).map((x) => x.id)).toEqual(['a', 'b']);
    });

    it('aplica les exclusions de Miki a oficial i Tema sense confondre Celebrem', () => {
        for (const name of ['Miki Nuñez', 'Miki Núñez', 'Miki Núñez - Topic', 'Miki Nuñez - Topic']) {
            for (const title of ['Celébrate', 'Me Vale', '10 Minutos', 'Suerte', 'La Mitad', 'Encender Las Calles', 'Cucu-pido', 'Cucu-pido (Setlist - Gira 121)']) {
                expect(REGLES[name].titols.test(title), `${name}: ${title}`).toBe(true);
            }
            for (const title of ['Celebrem', 'Escriurem', 'Per Tu', 'Electricitat', 'Gelat']) {
                expect(REGLES[name].titols.test(title), `${name}: ${title}`).toBe(false);
            }
        }
    });

    it("només retorna cançons visibles de l'artista, les més noves primer", () => {
        const feed = {
            videos: [
                {
                    id: 'a',
                    channelTitle: 'Sisa',
                    contentType: 'song',
                    publishedAt: '2020-01-01',
                    title: 'A',
                },
                {
                    id: 'b',
                    channelTitle: 'Sisa',
                    contentType: 'song',
                    publishedAt: '2024-01-01',
                    title: 'B',
                },
                {
                    id: 'c',
                    channelTitle: 'Sisa',
                    contentType: 'song',
                    publishedAt: '2025-01-01',
                    title: 'C',
                },
                {
                    id: 'd',
                    channelTitle: 'Sisa',
                    contentType: 'album',
                    publishedAt: '2025-01-01',
                    title: 'D',
                },
                {
                    id: 'e',
                    channelTitle: 'Altre',
                    contentType: 'song',
                    publishedAt: '2025-01-01',
                    title: 'E',
                },
            ],
        };
        const hidden = new Set(['c']);
        expect(visibleSongs(feed, hidden, 'Sisa').map((video) => video.id)).toEqual(['b', 'a']);
        expect(visibleSongs(feed, hidden, 'Sisa', '2023-01-01').map((video) => video.id)).toEqual(['b']);
    });
});
