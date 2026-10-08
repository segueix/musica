import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const {
    restrictionReason,
    updateRegistry,
    loadRegistry,
    saveRegistry,
} = require('../scripts/lib/restriccions_youtube');

const video = (id, { edat = false, incrustable = true } = {}) => ({
    id,
    contentDetails: edat ? { contentRating: { ytRating: 'ytAgeRestricted' } } : { contentRating: {} },
    status: { embeddable: incrustable, privacyStatus: 'public' },
});

describe('Vídeos amb restricció d’edat o no incrustables', () => {
    it('detecta la restricció d’edat i els vídeos que no es poden incrustar', () => {
        expect(restrictionReason(video('a', { edat: true }))).toBe('edat');
        expect(restrictionReason(video('b', { incrustable: false }))).toBe('no-incrustable');
        expect(restrictionReason(video('c'))).toBe('');
        // Sense la part status (no se sap): no es marca
        expect(restrictionReason({ id: 'd', contentDetails: {} })).toBe('');
    });

    it('el registre afegeix els nous, conserva la data i treu els que ja no estan restringits', () => {
        const first = updateRegistry({}, [video('a', { edat: true }), video('c')], '2026-10-08');
        expect(first.added).toEqual(['a']);
        expect(first.registry.videos).toEqual({ a: { motiu: 'edat', detectat: '2026-10-08' } });
        // Una altra comprovació: «a» continua restringit (mateixa data), «b» és nou
        const second = updateRegistry(
            first.registry,
            [video('a', { edat: true }), video('b', { incrustable: false })],
            '2026-10-11'
        );
        expect(second.added).toEqual(['b']);
        expect(second.registry.videos.a.detectat).toBe('2026-10-08');
        // YouTube treu la restricció d'«a»: surt del registre. «b» no s'ha consultat: es queda.
        const third = updateRegistry(second.registry, [video('a')], '2026-10-15');
        expect(third.removed).toEqual(['a']);
        expect(Object.keys(third.registry.videos)).toEqual(['b']);
        // Sense canvis
        expect(updateRegistry(third.registry, [video('z')], '2026-10-16').changed).toBe(false);
    });

    it('es desa i es torna a llegir igual', () => {
        const file = join(mkdtempSync(join(tmpdir(), 'restr-')), 'r.json');
        const { registry } = updateRegistry({}, [video('a', { edat: true })], '2026-10-08');
        saveRegistry(registry, file);
        expect(loadRegistry(file)).toEqual(registry);
        expect(loadRegistry(join(tmpdir(), 'no-existeix.json')).videos).toEqual({});
    });

    it('el generador diari, l’actualització setmanal i el client el fan servir', () => {
        const feed = readFileSync('scripts/update_music_feed.js', 'utf8');
        expect(feed).toContain("require('./lib/restriccions_youtube')");
        expect(feed).toMatch(/restrictedIds\.forEach\(id=>detailsById\.delete\(id\)\)/);
        expect(feed).toContain("part:'snippet,contentDetails,statistics,status'");
        const views = readFileSync('scripts/update_music_history_views.js', 'utf8');
        expect(views).toContain("url.searchParams.set('part', 'statistics,contentDetails,status');");
        const wf = readFileSync('.github/workflows/actualitzar-visualitzacions-historial.yml', 'utf8');
        expect(wf).toContain('data/videos-restringits.json');
        const client = readFileSync('js/youtube.js', 'utf8');
        expect(client).toContain("const RESTRICTED_VIDEOS_URL = 'data/videos-restringits.json';");
        expect(readFileSync('sw.js', 'utf8')).toContain("path.endsWith('/data/videos-restringits.json')");
    });
});
