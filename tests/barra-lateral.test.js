import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Sense navegació lateral a l'ordinador i a la tauleta (2026-10-23, a petició de l'usuari): Inici, Descobreix, Artistes
// i grups i La teva música (sense repetir-la) són icones a dalt a la dreta; ja no hi ha el botó de tres ratlles.
// Abans (2026-10-03) la barra es plegava amb aquell botó.

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('index.html');
const portada = read('css/portada.css');
const app = read('js/app.js');
const shellNav = read('js/features/shell-nav.js');
const header = html.slice(html.indexOf('<header class="app-header">'), html.indexOf('</header>'));

describe('sense navegació lateral a l’ordinador', () => {
    it('ja no hi ha el botó de tres ratlles', () => {
        expect(html).not.toContain('id="sidebarToggle"');
        expect(portada).toMatch(/\.sidebar-toggle \{\s*display: none;\s*\}/);
    });

    it('a ≥ 769 px la barra lateral no es mostra i no ocupa espai', () => {
        expect(portada).toMatch(/body \.sidebar#sidebar \{\s*\/\*[^*]*\*\/\s*display: none !important;/);
        expect(portada).toMatch(/body,\s*body\.sidebar-collapsed \{\s*--pt-side-w: 0px;/);
        expect(portada).toMatch(
            /grid-template-columns: auto minmax\(220px, 1fr\) auto;\s*grid-template-areas: 'brand search actions';/
        );
    });

    it('a la capçalera: Inici, Descobreix, Artistes i La teva música, una sola vegada cadascuna', () => {
        const order = [
            'data-pt-head="home"',
            'data-pt-head="discover"',
            'data-pt-head="artists"',
            'data-pt-head="library"',
        ];
        const at = order.map(item => header.indexOf(item));
        expect(at.every(index => index > -1)).toBe(true);
        expect([...at].sort((a, b) => a - b)).toEqual(at);
        expect(header.match(/data-page="llistes"/g)).toHaveLength(1);
        expect(header).toMatch(/class="icon-btn pt-head-discover" href="#" data-pt-nav="discover"/);
        // Al mòbil la navegació és a baix: Inici, Descobreix i La teva música no es repeteixen a dalt
        expect(portada).toMatch(
            /:is\(\.nav-trigger\[data-page='llistes'\], \.nav-trigger\[data-page='home'\], \.pt-head-discover\) \{\s*display: none;/
        );
    });

    it('la secció activa de la capçalera va en llima', () => {
        expect(shellNav).toContain("doc.querySelectorAll('.app-header [data-pt-head]')");
        expect(portada).toMatch(
            /#headerActions \.icon-btn\[data-pt-head\]\.is-current \{[^}]*color: var\(--pt-accent\);/
        );
    });

    it('el JS deixa sempre l’estat «plegat» a ≥ 769 px i oblida la preferència antiga', () => {
        const block = app.slice(
            app.indexOf('function initDesktopSidebarPreference'),
            app.indexOf('// ==================== EVENT BINDING')
        );
        expect(block).toContain("matchMedia('(min-width: 769px)')");
        expect(block).toContain("classList.toggle('sidebar-collapsed', wide.matches)");
        expect(block).toContain("localStorage.removeItem('segueix_music_desktop_sidebar_collapsed')");
        expect(block).not.toContain('sidebarToggle');
    });

    it('les caràtules de «La teva ràdio» continuen centrades a l’espai lliure de pantalla ampla', () => {
        const block = portada.slice(portada.indexOf('«La teva ràdio» amb la barra lateral plegada'));
        expect(block).toContain('@container (min-width: 900px)');
        expect(block).toMatch(/body\.sidebar-collapsed \.pt-radio__covers \{[^}]*left: 75%;/);
    });
});
