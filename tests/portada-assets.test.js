import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('index.html');
const css = read('css/portada.css');
const sw = read('sw.js');
const manifest = JSON.parse(read('manifest.json'));

// ---------- Contrast (WCAG 2.x) amb els valors reals del full d'estils ----------
function token(name) {
    const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'));
    if (!match) throw new Error(`Falta el token --${name}`);
    return match[1];
}
function luminance(hex) {
    const channel = value => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

describe('paleta de Segueix Música', () => {
    it('usa exactament els colors del disseny', () => {
        expect(token('pt-bg').toLowerCase()).toBe('#141615');
        expect(token('pt-surface').toLowerCase()).toBe('#202421');
        expect(token('pt-text').toLowerCase()).toBe('#f4f0e8');
        expect(token('pt-accent').toLowerCase()).toBe('#d6ed84');
        expect(token('pt-terracotta').toLowerCase()).toBe('#d98a70');
    });

    // Parells reals text/fons que apareixen a la portada
    const pairs = [
        ['pt-text', 'pt-bg', 'títols i text principal sobre el fons'],
        ['pt-text', 'pt-surface', 'text sobre targetes i superfícies'],
        ['pt-text', 'pt-surface-2', 'text sobre superfícies elevades (hover, mode actiu)'],
        ['pt-text', 'pt-surface-3', 'avís breu'],
        ['pt-muted', 'pt-bg', 'text secundari sobre el fons'],
        ['pt-muted', 'pt-surface', 'text secundari sobre targetes'],
        ['pt-muted', 'pt-surface-2', 'text secundari a l’estat hover'],
        ['pt-accent', 'pt-bg', 'llima com a text sobre el fons (Ara sona, enllaços)'],
        ['pt-accent', 'pt-surface', 'llima com a text sobre targetes'],
        ['pt-accent', 'pt-surface-2', 'llima com a text sobre superfícies elevades'],
        ['pt-on-accent', 'pt-accent', 'text sobre botons llima'],
        ['pt-terracotta', 'pt-bg', 'terracota com a text sobre el fons'],
        ['pt-terracotta', 'pt-surface', 'terracota com a text sobre targetes («Fora del teu radar», cançó)'],
        ['pt-on-accent', 'pt-terracotta', 'text sobre la insígnia terracota «Gravat en directe»'],
    ];

    it.each(pairs)('%s sobre %s compleix el contrast AA (≥ 4,5:1): %s', (fg, bg) => {
        expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
    });

    it('el text principal i el llima superen el 7:1 (AAA) sobre el fons', () => {
        expect(contrast(token('pt-text'), token('pt-bg'))).toBeGreaterThanOrEqual(7);
        expect(contrast(token('pt-accent'), token('pt-bg'))).toBeGreaterThanOrEqual(7);
    });
});

describe('forma i moviment', () => {
    it('les cantonades estan entre 12 i 16 px', () => {
        for (const name of ['pt-radius-sm', 'pt-radius', 'pt-radius-lg']) {
            const value = Number(css.match(new RegExp(`--${name}:\\s*(\\d+)px`))[1]);
            expect(value).toBeGreaterThanOrEqual(12);
            expect(value).toBeLessThanOrEqual(16);
        }
    });

    it('cap radi fix de la portada surt de l’interval (llevat de cercles i insígnies petites)', () => {
        const radii = [...css.matchAll(/border-radius:\s*(\d+)px/g)].map(match => Number(match[1]));
        // Els únics valors literals permesos són 2/4 (barres de l’ecualitzador), 8 (etiquetes petites) i 12–16
        for (const value of radii) expect([2, 8, 10].includes(value) || (value >= 12 && value <= 16)).toBe(true);
    });

    it('respecta el moviment reduït', () => {
        expect(css).toContain('@media (prefers-reduced-motion: reduce)');
        expect(css).toMatch(/prefers-reduced-motion: reduce\)[\s\S]*animation: none !important/);
    });
});

describe('controls tàctils de 44 × 44 px', () => {
    const ruleOf = selector => {
        const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const match = css.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm'));
        if (!match) throw new Error(`No trobo la regla ${selector}`);
        return match[1];
    };
    const size = (rule, prop) => Number((rule.match(new RegExp(`${prop}:\\s*(\\d+)px`)) || [])[1] || 0);

    it.each(['.pt-act', '.pt-arrow', '.search-btn,\n.mobile-search-toggle'])('%s fa 44 px o més', selector => {
        const rule = ruleOf(selector);
        expect(size(rule, 'width')).toBeGreaterThanOrEqual(44);
        expect(size(rule, 'height')).toBeGreaterThanOrEqual(44);
    });

    it.each(['.pt-btn', '.pt-tool', '.pt-artist', '.pt-style', '.pt-quick__main'])(
        '%s té una alçada mínima ≥ 44 px',
        selector => {
            expect(size(ruleOf(selector), 'min-height')).toBeGreaterThanOrEqual(44);
        }
    );

    it('els segments del selector de descoberta fan 44 px', () => {
        expect(size(ruleOf('.pt-mode__opt span'), 'min-height')).toBeGreaterThanOrEqual(44);
    });

    it('la navegació inferior té elements de 48 px i respecta l’àrea segura', () => {
        expect(css).toMatch(/\.pt-bottom-nav \.pt-nav-item\s*\{[^}]*min-height:\s*52px/);
        expect(css).toContain('var(--safe-bottom)');
    });
});

describe('index.html de Segueix Música', () => {
    it('identifica el producte com a Segueix Música', () => {
        expect(html).toContain('<title>Segueix Música · La teva plaça musical en català</title>');
        expect(html).toContain('<meta name="theme-color" content="#141615">');
        expect(html).toContain('<span class="brand-tag">Música</span>');
        expect(manifest.name).toMatch(/Segueix Música/);
        expect(manifest.theme_color).toBe('#141615');
        expect(manifest.background_color).toBe('#141615');
    });

    it('té el cercador, l’entrada directa i el selector de tres opcions', () => {
        expect(html).toContain('placeholder="Què vols escoltar?"');
        expect(html).toContain('La teva ràdio');
        for (const label of ['Els meus de sempre', 'Una mica de tot', 'Sorprèn-me'])
            expect(html).toContain(`<span>${label}</span>`);
        expect(html).toContain('type="radio" name="ptMode"');
        expect(html).toContain('Quant vols descobrir?');
    });

    it('la navegació té les vistes demanades a escriptori i a mòbil', () => {
        const side = html.slice(html.indexOf('id="sidebar"'), html.indexOf('<!-- Main Content -->'));
        for (const label of ['Inici', 'Descobreix', 'Artistes', 'La teva música'])
            expect(side).toContain(`<span>${label}</span>`);
        const bottom = html.slice(html.indexOf('id="ptBottomNav"'), html.indexOf('<!-- Scripts -->'));
        for (const label of ['Inici', 'Descobreix', 'Cerca', 'La teva música'])
            expect(bottom).toContain(`<span>${label}</span>`);
        expect((bottom.match(/<button /g) || []).length).toBe(4);
    });

    it('no conserva textos de la web general de vídeos', () => {
        expect(html).not.toMatch(
            /Els nostres YouTubers|Vídeos i creadors|Recomanat per a tu<\/h1>[\s\S]{0,5}<div class="category-keywords/
        );
        expect(html).not.toContain('Afegeix un YouTuber');
        expect(html).not.toContain('Ets YouTuber');
    });

    it('carrega els scripts nous en un ordre segur i abans d’app.js', () => {
        const order = name => html.indexOf(`js/features/${name}.js`);
        expect(order('discovery')).toBeGreaterThan(order('home-sections'));
        expect(order('discovery')).toBeLessThan(order('music-queue'));
        expect(order('portada')).toBeGreaterThan(order('music-queue'));
        expect(order('shell-nav')).toBeGreaterThan(order('music-queue'));
        expect(html.indexOf('js/app.js')).toBeGreaterThan(order('portada'));
        expect(html.indexOf('js/app.js')).toBeGreaterThan(order('shell-nav'));
        // El full nou va després de l'antic perquè el pugui redefinir
        expect(html.indexOf('css/portada.css')).toBeGreaterThan(html.indexOf('css/styles.css'));
    });

    it('manté un únic reproductor', () => {
        expect((html.match(/id="videoPlayer"/g) || []).length).toBe(1);
        expect(html).not.toContain('id="portadaPlayer"');
    });
});

describe('PWA: el service worker precacheja els recursos nous', () => {
    it.each([
        './css/portada.css',
        './js/features/discovery.js',
        './js/features/portada.js',
        './js/features/shell-nav.js',
    ])('inclou %s', asset => {
        expect(sw).toContain(`'${asset}'`);
    });

    it('la versió de la memòria cau és un hash de contingut', () => {
        expect(sw).toMatch(/const CACHE_VERSION = '[a-z0-9]{12}'/);
    });
});

describe('«La teva ràdio»: caràtules grans i centrades a la versió web', () => {
    const block = css.slice(css.indexOf('/* ---------- «La teva ràdio»: caràtules més grans i centrades'));

    it('creixen amb l’ample de la targeta, queden centrades en vertical i el text els reserva lloc', () => {
        expect(block).toContain('container-type: inline-size');
        expect(block).toMatch(/--pt-cover: clamp\(120px, 14cqw, 215px\)/);
        expect(block).toMatch(/\.pt-radio__covers \{\s*top: 50%;[\s\S]*?transform: translateY\(-50%\)/);
        // 3 caràtules solapades = 2,28 mides; el cos de la targeta reserva aquest espai més la separació de la vora
        expect(block).toMatch(/padding-right: calc\(var\(--pt-cover\) \* 2\.28 \+ var\(--pt-cover-right\) \+ 28px\)/);
    });

    it('només a partir de 769 px (al mòbil no canvia res) i amb alternativa si no hi ha unitats de contenidor', () => {
        expect(block).toMatch(/@supports \(width: 1cqw\) \{\s*@media \(min-width: 769px\)/);
    });
});
