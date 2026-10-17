import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

// Peu de pàgina condensat (2026-10-17): enllaços, «Privacitat i Avís Legal» i crèdit en una sola fila a l'ordinador,
// i menys aire abans del peu.
const css = fs.readFileSync('css/portada.css', 'utf8');
const block = css.slice(css.indexOf('Peu de pàgina condensat (2026-10-17)'));

describe('peu de pàgina condensat', () => {
    it('els elements del peu van en una fila que es parteix només si no hi caben', () => {
        expect(block).toMatch(
            /\.site-credit-footer \.project-credit--page-end \{\s*display: flex;\s*flex-wrap: wrap;\s*align-items: center;/
        );
        expect(block).toMatch(/\.site-credit-footer \.seo-footer-nav \{[^}]*flex: 1 1 auto;[^}]*margin: 0;/);
        expect(block).toMatch(/\.site-credit-footer \.project-credit-legal-btn \{\s*margin: 0 0 0 auto;/);
    });

    it('al mòbil, centrat i els enllaços en una fila pròpia', () => {
        expect(block).toMatch(/@media \(max-width: 768px\) \{[\s\S]*?\.seo-footer-nav \{\s*flex-basis: 100%;/);
    });

    it('menys aire abans del peu a l’ordinador', () => {
        expect(block).toMatch(/@media \(min-width: 769px\) \{\s*#mainContent \{\s*padding-bottom: 8px;/);
        expect(block).toMatch(
            /#watchPage \.watch-main > :is\(\.channel-info, #playlistQueueContainer\) \{\s*margin-bottom: 8px;/
        );
    });
});
