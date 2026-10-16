import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
// Les rutes generades es comproven a static-site.test.js.
describe('portada estàtica', () => {
  it('reforça portada amb canonical, WebSite i navegació rastrejable', () => {
    expect(indexSource).toContain('<link rel="canonical" href="https://segueix.cat/">');
    expect(indexSource).toContain('"@type": "WebSite"');
    expect(indexSource).toContain('"name": "Segueix Música"');
    expect(indexSource).toContain('"alternateName": ["Segueix!", "Segueix.cat", "segueix.cat"]');
    expect(indexSource).toContain('class="seo-footer-nav"');
    // L'app es publica a segueix.github.io/musica/: el peu enllaça dins l'app (rutes relatives), sense Novetats ni
    // Música TV (no existeixen com a pàgina).
    for (const href of ['./?seccio=artistes', './?estil=Pop', './?estil=Rock', './?estil=Indie', './?estil=Urban']) {
      expect(indexSource).toContain(`href="${href}"`);
    }
    const footer = indexSource.slice(indexSource.indexOf('class="seo-footer-nav"'), indexSource.indexOf('</nav>', indexSource.indexOf('class="seo-footer-nav"')));
    expect(footer).not.toMatch(/Novetats|Música TV|href="\//);
  });
});

