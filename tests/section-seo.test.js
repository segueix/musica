import { describe, expect, it, vi } from 'vitest';
import { renderSeoSection, SEO_SECTIONS } from '../functions/_lib/section-seo.js';
import { onRequestGet as sitemap } from '../functions/sitemap.xml.js';
import { readFileSync } from 'node:fs';

const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const videos = [
  {
    id: 'abc123XYZ_1',
    title: 'Cultura en català',
    thumbnail: 'https://i.ytimg.com/vi/abc123XYZ_1/maxresdefault.jpg',
    channelId: 'UC_cultura',
    channelTitle: 'Canal Cultura',
    publishedAt: '2026-09-25T08:00:00Z',
    categories: ['cultura'],
  },
  {
    id: 'gam123XYZ_2',
    title: 'Gaming en català',
    thumbnail: 'https://i.ytimg.com/vi/gam123XYZ_2/maxresdefault.jpg',
    channelId: 'UC_gaming',
    channelTitle: 'Canal Gaming',
    publishedAt: '2026-09-24T08:00:00Z',
    categories: ['gaming'],
  },
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
            { id: 'UC_cultura', name: 'Canal Cultura', categories: ['cultura'] },
            { id: 'UC_gaming', name: 'Canal Gaming', categories: ['gaming'] },
          ],
        }), { status: 200, headers: { 'content-type': 'application/json' } });
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
      '/novetats',
      '/vida',
      '/cultura',
      '/diversio',
      '/el-mon',
      '/gaming',
      '/segueix-tv',
    ]);
  });

  it('renderitza Cultura amb canonical, breadcrumbs, vídeos i creadors propis', async () => {
    const response = await renderSeoSection({
      request: new Request('https://segueix.cat/cultura'),
      env: { ASSETS: assets() },
    }, 'cultura');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('x-robots-tag')).toContain('index');
    expect(html).toContain('<h1>Vídeos de cultura en català</h1>');
    expect(html).toContain('rel="canonical" href="https://segueix.cat/cultura"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('/video/cultura-en-catala-abc123XYZ_1');
    expect(html).toContain('/creador/canal-cultura');
    expect(html).not.toContain('gam123XYZ_2');
    expect(html).toContain('href="/gaming"');
    expect(html).toContain('href="/segueix-tv"');
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
    expect(indexSource).toContain('"name": "Segueix!"');
    expect(indexSource).toContain('"alternateName": ["Segueix.cat", "segueix.cat"]');
    expect(indexSource).toContain('class="seo-footer-nav"');
    for (const href of ['/creadors', '/novetats', '/vida', '/cultura', '/diversio', '/el-mon', '/gaming', '/segueix-tv']) {
      expect(indexSource).toContain(`href="${href}"`);
    }
  });
});
