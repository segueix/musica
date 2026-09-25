import { describe, it, expect } from 'vitest';
import genreModule from '../scripts/enriquir_generes_musica.js';
import taxonomy from '../data/music-genres.json' with { type: 'json' };

const { mapRawGenres } = genreModule;

describe('normalització de gèneres', () => {
    it('permet diverses categories per una mateixa etiqueta', () => {
        const result = mapRawGenres(['indie rock'], taxonomy);
        expect(result.labels).toContain('Rock');
        expect(result.labels).toContain('Indie / Alternativa');
    });

    it('classifica trap com urbana i rap/hip-hop', () => {
        const result = mapRawGenres(['latin trap'], taxonomy);
        expect(result.labels).toContain('Urbana');
        expect(result.labels).toContain('Rap / Hip-hop');
    });

    it('no força Altres quan no coneix una etiqueta', () => {
        const result = mapRawGenres(['genre inventat desconegut'], taxonomy);
        expect(result.labels).not.toContain('Altres');
        expect(result.unmappedRaw).toEqual(['genre inventat desconegut']);
    });

    it('classifica nova cançó com cançó d’autor', () => {
        const result = mapRawGenres(['Nova Cançó'], taxonomy);
        expect(result.labels).toContain("Cançó d'autor");
    });
});
