import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// «Artistes i grups» (#followPage, 2026-10-16): requadres plens amb la foto del grup, com les caràtules de la fitxa.
const app = readFileSync('js/app.js', 'utf8');
const css = readFileSync('css/portada.css', 'utf8');
const render = app.slice(
    app.indexOf('async function renderFollowPage'),
    app.indexOf('function renderFollowEmptyState')
);

describe('llista d’artistes: requadres plens amb la foto del grup', () => {
    it('la foto omple el requadre i a dins hi ha el nom, «Segueix» i amagar', () => {
        expect(render).toContain('<img class="follow-avatar"');
        expect(render).not.toContain('follow-avatar-wrap');
        const info = render.slice(render.indexOf('follow-card__info'));
        expect(info.indexOf('follow-name')).toBeGreaterThan(-1);
        expect(info.indexOf('${followButtonHtml}')).toBeGreaterThan(info.indexOf('follow-name'));
        expect(render).toContain('data-hide-channel=');
        // És un enllaç a la fitxa, també des del teclat
        expect(render).toContain('role="link" tabindex="0"');
        expect(app).toMatch(/followGrid\.addEventListener\('keydown'/);
        // Foto a 400 px (els avatars de YouTube porten «=s88» o «=s240»)
        expect(app).toMatch(/function followCardImage[\s\S]*=s400/);
    });

    it('quadrats, amb marc blanc, mínim espai i 2 columnes al mòbil', () => {
        expect(css).toMatch(
            /#followPage \.follow-grid\s*{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);[^}]*gap:\s*4px/
        );
        expect(css).toMatch(/#followPage \.follow-card\s*{[^}]*aspect-ratio:\s*1;[^}]*border:\s*2px solid #fff/);
        expect(css).toMatch(/#followPage \.follow-avatar\s*{[^}]*position:\s*absolute;[^}]*object-fit:\s*cover/);
        expect(css).toMatch(/#followPage \.follow-hide-btn\s*{[^}]*width:\s*44px;[^}]*height:\s*44px/);
    });

    it('a l’ordinador s’amplien en passar-hi el ratolí, sense sortir de la pàgina', () => {
        expect(css).toMatch(
            /@media \(hover: hover\) and \(pointer: fine\)\s*{[^@]*#followPage \.follow-card:hover[^{]*{[^}]*transform:\s*scale\(1\.04\)/
        );
        // Marge de la graella perquè el requadre ampliat no surti del contenidor que retalla
        expect(css).toMatch(/#followPage \.follow-grid\s*{[^}]*padding:\s*6px/);
    });
});

describe('fitxa d’artista: les caràtules de les vores s’amplien cap a dins', () => {
    it('primera columna des de l’esquerra, tercera des de la dreta, darrera fila des de baix i la #1 des de dalt', () => {
        expect(css).toMatch(/#channelPage \.ap-card\s*{[^}]*transform-origin:\s*var\(--ap-ox\) var\(--ap-oy\)/);
        expect(css).toMatch(/\.ap-grid \.ap-card:nth-child\(3n \+ 1\)\s*{[^}]*--ap-ox:\s*left/);
        expect(css).toMatch(/\.ap-grid \.ap-card:nth-child\(3n\)\s*{[^}]*--ap-ox:\s*right/);
        expect(css).toMatch(/\.ap-grid \.ap-card:nth-last-child\(-n \+ 3\)\s*{[^}]*--ap-oy:\s*bottom/);
        expect(css).toMatch(/#channelPage \.ap-best \.ap-card\s*{[^}]*--ap-ox:\s*right;[^}]*--ap-oy:\s*top/);
    });
});
