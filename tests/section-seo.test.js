import { describe, expect, it, vi } from 'vitest';
import { renderSeoSection, SEO_SECTIONS } from '../functions/_lib/section-seo.js';
import { onRequestGet as sitemap } from '../functions/sitemap.xml.js';
import { readFileSync } from 'node:fs';

const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const videos = [
  { id:'abc123XYZ_1', title:'Rock en català', thumbnail:'https://i.ytimg.com/vi/abc123XYZ_1/maxresdefault.jpg', channelId:'UC_rock', channelTitle:'Grup Rock', publishedAt:'2026-09-25T08:00:00Z', categories:['Rock'] },
  { id:'pop123XYZ_2', title:'Pop en català', thumbnail:'https://i.ytimg.com/vi/pop123XYZ_2/maxresdefault.jpg', channelId:'UC_pop', channelTitle:'Grup Pop', publishedAt:'2026-09-24T08:00:00Z', categories:['Pop'] },
];

function assets() {
  return {
    fetch: vi.fn(async (request) => {
      const url = new URL(request.url);
      if (url.pathname === '/data/feed.json') {
        return new Response(JSON.stringify({ generatedAt: '2026-09-25T09:00:00Z', videos }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.pathname === '/js/channels-ca.json') {
        return new Response(JSON.stringify({
          updatedAt: '2026-09-25T09:00:00Z',
          channels: [
                        { id: 'UC_rock', name: 'Grup Rock', categories: ['Rock'] },
            { id: 'UC_pop', name: 'Grup Pop', categories: ['Pop'] },
          ],
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.pathname === '/data/artistes-musica.json') {
        return new Response(JSON.stringify({ artists: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.pathname === '/data/search_index_manifest.json') {
        return new Response(JSON.stringify({ buckets: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('Not found', { status: 404 });
    }),
  };
}

describe('seccions SEO', () => {
  it('publica les seccions principals amb URL estable', () => {
    expect(Object.values(SEO_SECTIONS).map((section) => section.path)).toEqual([
      '/novetats','/descobreix','/pop','/rock','/indie','/urbana','/rap-hip-hop','/folk-arrel','/canco-autor',
      '/electronica','/ska-reggae','/rumba-mestissatge','/punk-metal','/jazz-blues','/classica','/infantil','/altres-estils','/musica-tv'
    ]);
  });

  it('renderitza Rock amb canonical, vídeos i navegació musical', async () => {
    const response = await renderSeoSection({
      request: new Request('https://segueix.cat/rock'),
      env: { ASSETS: assets() },
    }, 'rock');
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain('<h1>Rock en català</h1>');
    expect(html).toContain('rel="canonical" href="https://segueix.cat/rock"');
    expect(html).toContain('/video/rock-en-catala-abc123XYZ_1');
    expect(html).not.toContain('pop123XYZ_2');
    expect(html).toContain('href="/pop"');
    expect(html).toContain('href="/musica-tv"');
  });

  it('publica les seccions al sitemap', async () => {
    const response = await sitemap({
      request: new Request('https://segueix.cat/sitemap.xml'),
      env: { ASSETS: assets() },
    });
    const xml = await response.text();

    for (const section of Object.values(SEO_SECTIONS)) {
      expect(xml).toContain(`<loc>https://segueix.cat${section.path}</loc>`);
    }
  });

  it('reforça portada amb canonical, WebSite i navegació rastrejable', () => {
    expect(indexSource).toContain('<link rel="canonical" href="https://segueix.cat/">');
    expect(indexSource).toContain('"@type": "WebSite"');
    expect(indexSource).toContain('"name": "Segueix Música"');
    expect(indexSource).toContain('"alternateName": ["Segueix!", "Segueix.cat", "segueix.cat"]');
    expect(indexSource).toContain('class="seo-footer-nav"');
    // L'app es publica a segueix.github.io/musica/: el peu enllaça dins l'app (rutes relatives), sense Novetats ni
    // Música TV (no existeixen com a pàgina).
    for (const href of ['./?seccio=artistes', './?estil=Pop', './?estil=Rock', './?estil=Indie', './?estil=Urbana']) {
      expect(indexSource).toContain(`href="${href}"`);
    }
    const footer = indexSource.slice(indexSource.indexOf('class="seo-footer-nav"'), indexSource.indexOf('</nav>', indexSource.indexOf('class="seo-footer-nav"')));
    expect(footer).not.toMatch(/Novetats|Música TV|href="\//);
  });
});
