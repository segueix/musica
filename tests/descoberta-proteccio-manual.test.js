import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { shouldKeepArtist } = require('../scripts/descobrir_artistes_musica.js');
const emptyExclusions = () => ({ qids: new Set(), names: new Set() });
const pending = (name, sources = []) => ({
    name, sources, wikidataId: null, musicbrainzId: null,
    reviewStatus: 'pendent', active: false, notes: '',
});

describe('la descoberta conserva les incorporacions manuals', () => {
    it.each(['Anna Andreu', 'Guillem Ramisa', 'Paul Fuster'])(
        'conserva %s en l’estat pendent que tenia abans de la baixa accidental', (name) => {
            const artist = pending(name, ['manual-user-2026-09-29', 'genre:manual', 'youtube:manual-verified']);
            expect(shouldKeepArtist(artist, emptyExclusions())).toBe(true);
        }
    );

    it('protegeix tant una alta manual com una verificació manual de canal', () => {
        for (const source of ['manual-user-2026-10-12', 'youtube:manual-verified']) {
            expect(shouldKeepArtist(pending('Artista', [source]), emptyExclusions())).toBe(true);
        }
    });

    it('respecta una retirada explícita encara que la fitxa sigui manual', () => {
        const artist = pending('Artista retirat', ['youtube:manual-verified']);
        const exclusions = emptyExclusions();
        exclusions.names.add('artista retirat');
        expect(shouldKeepArtist(artist, exclusions)).toBe(false);
        artist.wikidataId = 'Q123';
        exclusions.names.clear();
        exclusions.qids.add('Q123');
        expect(shouldKeepArtist(artist, exclusions)).toBe(false);
    });

    it('continua descartant candidats automàtics febles i preservant els fonamentats', () => {
        expect(shouldKeepArtist(pending('Feble', ['wikidata:other']), emptyExclusions())).toBe(false);
        expect(shouldKeepArtist(pending('Sense fonts'), emptyExclusions())).toBe(false);
        expect(shouldKeepArtist(pending('Fonamentat', ['wikidata:performed-catalan-work']), emptyExclusions())).toBe(true);
    });
});
