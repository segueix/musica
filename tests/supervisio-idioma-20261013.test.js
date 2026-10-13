import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { manifest, removed, kept, PREFIX, validateManifest } = require('../scripts/revisions/supervisar_idioma_20261013.js');
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const files = ['data/feed.json', 'data/history-pool.json', 'data/historial-musical.json',
    ...readdirSync('data/archive/channels').filter(f => f.endsWith('.json')).map(f => 'data/archive/channels/' + f)];
const records = files.flatMap(file => read(file).videos);
const hidden = new Set(read('data/hidden-videos.json').videoIds);

describe('Supervisió documental de la llengua principal', () => {
    it('delimita 44 baixes, 8 conservacions i 9 artistes sense decisions contradictòries', () => {
        expect(() => validateManifest()).not.toThrow();
        expect(removed.size).toBe(44);
        expect(kept.size).toBe(8);
        expect(new Set(manifest.remove.map(g => g.artist)).size).toBe(9);
        expect(manifest.pendingFocusedChecks.flatMap(g => g.ids)).toHaveLength(53);
    });
    it('no presenta les dues cançons mixtes com a absència total de català', () => {
        for (const id of ['35KkoU2cVvg', 'lsavBF_i_oc']) {
            const group = manifest.remove.find(g => g.ids.includes(id));
            expect(group.language).toContain('principal');
            expect(group.language).toContain('català');
        }
        expect(manifest.scope.method).toContain('No és una escolta');
    });
    it('cada baixa queda bloquejada per ID i té decisió amb una font explícita', () => {
        const decisions = read('data/revisio-idiomes.json').decisions;
        for (const id of removed) {
            expect(hidden.has(id), id).toBe(true);
            const d = decisions.find(d => d.id === id);
            expect(d?.accio, id).toBe('amaga');
            expect(d?.font, id).toMatch(/^https:\/\//);
            expect(d?.reutilitza, id).toBe(false);
        }
    });
    it('conserva Covards, Antònia Font, originals catalans amb traduccions i instrumentals', () => {
        const ids = new Set(records.map(v => v.id));
        for (const id of kept) {
            expect(ids.has(id), id).toBe(true);
            expect(hidden.has(id), id).toBe(false);
        }
        expect(kept.has('0_VCqryfoZM')).toBe(true);
        expect(removed.has('t_x2uYnYpEU')).toBe(true);
        expect(kept.has('VIItW5YC9mY')).toBe(true);
        expect(kept.has('3Ije1SL9--E')).toBe(true);
    });
    it('els enregistraments exclosos no són al feed, arxiu ni ràdios', () => {
        expect(records.filter(v => removed.has(v.id)).map(v => v.id)).toEqual([]);
    });
    it('la cerca, els discos i les pàgines compartides no reintrodueixen les baixes', () => {
        const derived = readdirSync('data').filter(f => /^search_index_.*\.json$/.test(f)).map(f => 'data/' + f);
        derived.push('data/albums-musica.json', 'data/music-topic-catalog.json');
        for (const file of derived) {
            const value = readFileSync(file, 'utf8');
            for (const id of removed) expect(value.includes(id), file + ' · ' + id).toBe(false);
        }
        for (const id of removed) expect(existsSync('compartir/canco/' + id + '.html'), id).toBe(false);
    });
    it('es mantenen tots els canals dels artistes afectats i les exclusions anteriors d’Animal', () => {
        const channels = read('data/feed.json').channels;
        for (const group of manifest.remove) for (const id of group.channelIds) expect(channels[id], id).toBeDefined();
        for (const id of ['2fCmI1lebgI', 'OfNF7ynrPmI', 'O8pDDoHLjJ8', 'nCfN97003hQ', 'Bk__T96E5Qg', 'rFHcSgEDjLs']) expect(hidden.has(id), id).toBe(true);
        const report = read(PREFIX + '-resultat.json');
        expect(report.removedRecordings).toBe(44);
        expect(report.focusedPending).toHaveLength(53);
    });
});
