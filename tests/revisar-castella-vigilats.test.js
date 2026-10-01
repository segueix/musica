import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseArtists, visibleSongs } = require('../scripts/revisar_castella_vigilats.js');
const { REGLES } = require('../scripts/ocultar_titols_castella.js');

describe("llista d'artistes vigilats (docs/ARTISTES_CASTELLA.md)", () => {
    const doc = fs.readFileSync('docs/ARTISTES_CASTELLA.md', 'utf8');
    const artists = parseArtists(doc);

    it('llegeix el nom exacte de la primera columna de cada taula', () => {
        expect(parseArtists('| **Sisa** | 3 | x |\n| --- | --- | --- |\n| text | 1 | **no** |')).toEqual(['Sisa']);
        expect(artists).toContain('Joan Manuel Serrat');
        expect(artists).toContain('Judit Neddermann');
        expect(new Set(artists).size).toBe(artists.length);
    });

    it('inclou tots els artistes amb regla per canal a ocultar_titols_castella.js', () => {
        Object.keys(REGLES).forEach(name => expect(artists, `falta «${name}» a la taula`).toContain(name));
    });

    it("només retorna cançons visibles de l'artista, les més noves primer", () => {
        const feed = {
            videos: [
                { id: 'a', channelTitle: 'Sisa', contentType: 'song', publishedAt: '2020-01-01', title: 'A' },
                { id: 'b', channelTitle: 'Sisa', contentType: 'song', publishedAt: '2024-01-01', title: 'B' },
                { id: 'c', channelTitle: 'Sisa', contentType: 'song', publishedAt: '2025-01-01', title: 'C' },
                { id: 'd', channelTitle: 'Sisa', contentType: 'album', publishedAt: '2025-01-01', title: 'D' },
                { id: 'e', channelTitle: 'Altre', contentType: 'song', publishedAt: '2025-01-01', title: 'E' },
            ],
        };
        const hidden = new Set(['c']);
        expect(visibleSongs(feed, hidden, 'Sisa').map(video => video.id)).toEqual(['b', 'a']);
        expect(visibleSongs(feed, hidden, 'Sisa', '2023-01-01').map(video => video.id)).toEqual(['b']);
    });
});
