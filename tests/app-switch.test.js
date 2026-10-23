import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

// Pas a Segueix! dels youtubers (2026-10-23): només la icona de la capçalera. El gest de lliscar el dit pel mig de la
// pantalla (mòbil) i l'avís de la mà es van treure el mateix dia, a petició de l'usuari.
const html = readFileSync('index.html', 'utf8');
const css = readFileSync('css/portada.css', 'utf8');

describe('pas a Segueix! dels youtubers', () => {
    it('sense gest de lliscar el dit ni avís de la mà', () => {
        expect(existsSync('js/features/app-switch.js')).toBe(false);
        expect(html).not.toContain('app-switch.js');
        expect(css).not.toMatch(/\.app-switch(-hint)?\s*\{/);
        expect(readFileSync('sw.js', 'utf8')).not.toContain('app-switch.js');
    });

    it('la icona de YouTuber és a dalt de tot a la dreta, també al mòbil', () => {
        const header = html.slice(
            html.indexOf('<nav class="actions" id="headerActions"'),
            html.indexOf('</nav>', html.indexOf('id="headerActions"'))
        );
        expect(header.indexOf('id="appSwitchLink"')).toBeGreaterThan(header.indexOf('id="backgroundBtn"'));
        expect(header).toMatch(/id="appSwitchLink" href="https:\/\/segueix\.cat\/"/);
        expect(header).toContain('title="Segueix! · Els nostres YouTubers"');
        expect(css).not.toMatch(/\.app-header #appSwitchLink \{\s*display: none;/);
    });

    it('mòbil: «Música» sota «Segueix!» i «en / català» al costat, petit i en blanc (opció C)', () => {
        const block = css.slice(css.indexOf('/* ---------- Mòbil: «Segueix!» i «Música» en dues línies'));
        expect(block).toMatch(/\.app-header \.brand-name \.brand-music \{\s*display: block;/);
        expect(block).toMatch(
            /\.brand-music::after \{\s*content: 'en\\A català';[^}]*color: #fff;[^}]*font-size: 0\.47em;[^}]*white-space: pre;/
        );
        expect(block).toMatch(/font-size: min\(1\.0625rem, calc\(\(100cqi - 40px\) \/ 4\.8\)\);/);
        expect(block).toMatch(/\.app-header \.brand-tag \{\s*display: none;/);
        // Ja no hi ha el núvol de sobre «Segueix!»
        expect(html).not.toContain('brand-cloud');
        expect(css).not.toContain('brand-cloud');
    });

});
