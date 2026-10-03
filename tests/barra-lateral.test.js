import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Navegació lateral plegable: botó de tres ratlles a la capçalera. La conducta real (la barra surt, el contingut
// s'estén, es recorda, teclat, mòbil) es verifica a tests/browser/verificar-barra-lateral.js.

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('index.html');
const portada = read('css/portada.css');
const styles = read('css/styles.css');
const app = read('js/app.js');

describe('navegació lateral plegable', () => {
    it('el botó és a la capçalera, abans del logo, amb tres ratlles i estat accessible', () => {
        const header = html.slice(html.indexOf('<header class="app-header">'), html.indexOf('<form class="search"'));
        expect(header.indexOf('id="sidebarToggle"')).toBeGreaterThan(-1);
        expect(header.indexOf('id="sidebarToggle"')).toBeLessThan(header.indexOf('class="brand"'));
        expect(header).toContain('aria-controls="sidebar"');
        expect(header).toContain('aria-expanded="true"');
        // tres ratlles consecutives (una sola línia de camí amb tres segments horitzontals)
        expect(header).toMatch(/d="M4 6\.5h16M4 12h16M4 17\.5h16"/);
        // el control antic dins la barra (fletxa ‹ › amb vista prèvia) ja no hi és
        expect(html).not.toContain('sidebarPinToggle');
        expect(html).not.toContain('sidebar-pin-toggle');
        expect(styles).not.toMatch(/sidebar-pin-toggle|sidebar-peek/);
    });

    it('el botó és un requadre blanc de vora fina amb cantonades arrodonides, com el de GitHub', () => {
        const block = portada.slice(portada.indexOf('.sidebar-toggle {\n        grid-area: toggle;'));
        const rule = block.slice(0, block.indexOf('}'));
        expect(rule).toMatch(/border: 1px solid rgba\(244, 240, 232, 0\.55\)/);
        expect(rule).toMatch(/border-radius: 8px/);
        expect(rule).toMatch(/width: 40px/);
        expect(portada).toMatch(/body\.sidebar-collapsed \.sidebar-toggle \{\s*border-color: var\(--pt-accent\)/);
    });

    it('plegada, l’espai de la barra és 0 i tot el que en depèn s’hi adapta', () => {
        expect(portada).toMatch(/@property --pt-side-w \{[^}]*syntax: '<length>'[^}]*inherits: true/);
        expect(portada).toMatch(/--pt-side-w: var\(--pt-side-open\)/);
        expect(portada).toMatch(/body\.sidebar-collapsed \{\s*--pt-side-w: 0px;/);
        // la barra té l'ample desplegat (no s'arronsa) i llisca cap a fora, sense ser focalitzable
        expect(portada).toMatch(/width: var\(--pt-side-open\)/);
        expect(portada).toMatch(
            /body\.sidebar-collapsed \.sidebar#sidebar \{\s*transform: translateX\(-100%\);\s*visibility: hidden;/
        );
        // l'animació només s'activa un cop pintat l'estat desat, i respecta «menys moviment»
        expect(portada).toMatch(/body\.sidebar-ready \{\s*transition: --pt-side-w/);
        expect(portada).toMatch(/prefers-reduced-motion: reduce\) \{\s*body\.sidebar-ready/);
        // el botó només existeix on la barra és una columna
        expect(portada).toMatch(/\.sidebar-toggle \{\s*display: none;\s*\}/);
        expect(portada).toMatch(/@media \(min-width: 769px\) \{\s*\.app-header \{\s*grid-template-columns: auto auto/);
    });

    it('el JS recorda la preferència i només l’aplica a partir de 769 px', () => {
        const start = app.indexOf('function initDesktopSidebarPreference()');
        const block = app.slice(start, app.indexOf('// ==================== EVENT BINDING', start));
        expect(block).toContain("'segueix_music_desktop_sidebar_collapsed'");
        expect(block).toContain("getElementById('sidebarToggle')");
        expect(block).toContain("matchMedia('(min-width: 769px)')");
        expect(block).toContain("document.body.classList.add('sidebar-ready')");
        expect(block).toContain("setAttribute('aria-expanded'");
        expect(block).not.toContain('sidebar-peek');
        expect(block).not.toContain("sidebar.classList.toggle('collapsed'");
    });
});
