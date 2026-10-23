import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadScript } from './setup.js';

// Pas a Segueix! dels youtubers (2026-10-23): icona a la capçalera (ordinador) i lliscar el dit pel mig de la pantalla
// (mòbil). La conducta real del gest es comprova a tests/browser/verificar-pas-youtubers.js.
const ctx = loadScript('js/features/app-switch.js');
const sw = ctx.SegueixApp.features.appSwitch;
const html = readFileSync('index.html', 'utf8');
const css = readFileSync('css/portada.css', 'utf8');

describe('pas a Segueix! dels youtubers', () => {
    it('va a segueix.cat', () => {
        expect(sw.TARGET_URL).toBe('https://segueix.cat/');
    });

    it('el gest comença al mig de la pantalla, mai a les vores', () => {
        const screen = { width: 390, height: 844 };
        expect(sw.startAllowed({ ...screen, x: 195, y: 420 })).toBe(true);
        expect(sw.startAllowed({ ...screen, x: 10, y: 420 })).toBe(false);
        expect(sw.startAllowed({ ...screen, x: 385, y: 420 })).toBe(false);
        expect(sw.startAllowed({ ...screen, x: 195, y: 40 })).toBe(false);
        expect(sw.startAllowed({ ...screen, x: 195, y: 830 })).toBe(false);
    });

    it('només compta un moviment sobretot horitzontal', () => {
        expect(sw.lockAxis(5, 3)).toBe('');
        expect(sw.lockAxis(-60, 10)).toBe('h');
        expect(sw.lockAxis(40, 30)).toBe('v');
        expect(sw.lockAxis(5, 40)).toBe('v');
    });

    it('cal arrossegar un tros (35 % de l’ample, mínim 110 px) per anar-hi', () => {
        expect(sw.commitDistance(390)).toBeCloseTo(136.5);
        expect(sw.commitDistance(280)).toBe(110);
        expect(sw.shouldCommit({ dx: -140, dy: 10, width: 390 })).toBe(true);
        expect(sw.shouldCommit({ dx: 140, dy: 10, width: 390 })).toBe(true);
        expect(sw.shouldCommit({ dx: -100, dy: 0, width: 390 })).toBe(false);
        expect(sw.shouldCommit({ dx: -150, dy: 120, width: 390 })).toBe(false);
        expect(sw.progress(-68, 390)).toBeCloseTo(68 / 136.5);
        expect(sw.progress(-500, 390)).toBe(1);
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
        expect(html).toMatch(
            /js\/features\/youtube-subscribe\.js[^"]*"><\/script>\s*<script defer src="js\/features\/app-switch\.js/
        );
    });

    it('el panell del gest diu «Els nostres YouTubers»', () => {
        const source = readFileSync('js/features/app-switch.js', 'utf8');
        expect(source).toContain('<span>Els nostres YouTubers</span>');
        expect(source).not.toContain('Els youtubers en català');
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
