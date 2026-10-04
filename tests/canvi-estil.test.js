import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadScript } from './setup.js';

// Entrar a un estil al mòbil: abans es veia la portada sense el seu estil («Torna-hi» amb l'historial, llistes…)
// durant 1–4 s, perquè l'ordenació final de la llista (musicSelection.arrange) era quadràtica i la graella no es
// buidava fins que acabava. Vegeu docs/PROBLEMES_I_SOLUCIONS.md (2026-10-04, «Salt visual en entrar a un estil»).

const E = loadScript('js/features/music-selection.js').SegueixApp.features.musicSelection;
const feed = JSON.parse(readFileSync('data/feed.json', 'utf8'));
const songs = feed.videos.filter(video => !video.isShort);
const app = readFileSync('js/app.js', 'utf8');
const css = readFileSync('css/portada.css', 'utf8');

describe('ordenar la llista d’un estil és ràpid', () => {
    it('ordena tot el catàleg sense comparar cada cançó amb totes les ja triades', () => {
        const ctx = E.createContext({ videos: songs, now: Date.parse('2026-10-04T12:00:00Z') });
        const start = performance.now();
        const out = E.arrange(songs, { ctx });
        const elapsed = performance.now() - start;
        // Tot el catàleg (~3.500 cançons): abans ~1,6 s aquí (≈10⁸ comparacions; diversos segons al mòbil), ara ~0,2 s.
        expect(elapsed).toBeLessThan(800);
        expect(new Set(out.map(video => video.id)).size).toBe(out.length);
        expect(out.length).toBeGreaterThan(songs.length * 0.9);
    });

    it('continua traient la mateixa gravació repetida amb un altre ID', () => {
        const base = { channelId: 'UCa', channelTitle: 'Grup', durationSeconds: 200, publishedAt: '2026-01-01' };
        const list = [
            { ...base, id: 'a1', title: 'La cançó' },
            { ...base, id: 'b1', channelId: 'UCb', channelTitle: 'Altre', title: 'Una altra' },
            { ...base, id: 'a2', title: 'La cançó', durationSeconds: 202 },
            { ...base, id: 'c1', channelId: 'UCc', channelTitle: 'Tercer', title: 'Tercera' },
        ];
        const ctx = E.createContext({ videos: list, now: Date.parse('2026-10-04T12:00:00Z') });
        const ids = E.arrange(list, { ctx }).map(video => video.id);
        expect(ids).toContain('a1');
        expect(ids).not.toContain('a2');
    });
});

describe('en tocar un estil no es veu la vista anterior', () => {
    it('els dos camins del clic posen l’esquelet i el treuen quan la llista és a punt', () => {
        expect(app.match(/showCategoryLoading\(\);/g)?.length).toBeGreaterThanOrEqual(2);
        expect(app.match(/renderFeedAfterCategoryChange\(\);/g)?.length).toBeGreaterThanOrEqual(2);
        expect(app).toMatch(
            /function renderFeedAfterCategoryChange\(\) \{\s*try \{\s*renderFeed\(\);\s*\} finally \{\s*hideCategoryLoading\(\);/
        );
        // El render per lots de la vista anterior no hi pot afegir targetes
        expect(app).toMatch(/function showCategoryLoading\(\) \{[\s\S]*?_batchRenderAbort\.aborted = true/);
    });

    it('l’esquelet ocupa la graella i la capçalera de l’estil anterior no es veu', () => {
        expect(css).toContain('#homePage.is-loading-category .hero > *');
        expect(css).toMatch(/\.cat-skeleton \{[\s\S]*?display: grid/);
        expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s*#homePage\.is-loading-category \.hero/);
    });
});
