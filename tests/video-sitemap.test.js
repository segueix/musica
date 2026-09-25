import { describe, expect, it, vi } from 'vitest';
import { onRequestGet as videoSitemapIndex } from '../functions/video-sitemap.xml.js';
import { onRequestGet as videoSitemapGroup } from '../functions/video-sitemap/[bucket].xml.js';
import { readFileSync } from 'node:fs';

const robots = readFileSync(new URL('../robots.txt', import.meta.url), 'utf8');

function assets() {
  return {
    fetch: vi.fn(async (request) => {
      const url = new URL(request.url);

      if (url.pathname === '/data/search_index_manifest.json') {
        return new Response(JSON.stringify({
          generatedAt: '2026-09-25T10:00:00Z',
          buckets: [
            { key: '2026_09', file: 'search_index_2026_09.json', itemCount: 1 },
            { key: '2025', file: 'search_index_2025.json', itemCount: 1 },
          ],
        }), { status: 200 });
      }

      if (url.pathname === '/data/feed.json') {
        return new Response(JSON.stringify({
          generatedAt: '2026-09-25T11:00:00Z',
          videos: [{
            id: 'RECENT12345',
            title: 'Vídeo recent en català',
            description: 'Una descripció real del vídeo recent.',
            thumbnail: 'https://i.ytimg.com/vi/RECENT12345/maxresdefault.jpg',
            channelId: 'UC_recent',
            channelTitle: 'Canal Recent',
            publishedAt: '2026-09-25T09:30:00Z',
            durationSeconds: 315,
          }],
        }), { status: 200 });
      }

      if (url.pathname === '/js/channels-ca.json') {
        return new Response(JSON.stringify({
          channels: [
            { id: 'UC_recent', name: 'Canal Recent' },
            { id: 'UC_archive', name: 'Canal Arxiu' },
          ],
        }), { status: 200 });
      }

      if (url.pathname === '/data/search_index_2026_09.json') {
        return new Response(JSON.stringify([{
          i: 'ARCHIV12345',
          t: 'Vídeo antic en català',
          c: 'UC_archive',
          d: '2026-09-10T08:00:00Z',
          s: 181,
        }]), { status: 200 });
      }

      if (url.pathname === '/data/search_index_2025.json') {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      return new Response('Not found', { status: 404 });
    }),
  };
}

describe('video sitemap', () => {
  it('publica un índex separat per recent i períodes de l arxiu', async () => {
    const response = await videoSitemapIndex({
      request: new Request('https://segueix.cat/video-sitemap.xml'),
      env: { ASSETS: assets() },
    });
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(xml).toContain('<sitemapindex');
    expect(xml).toContain('<loc>https://segueix.cat/video-sitemap/recent.xml</loc>');
    expect(xml).toContain('<loc>https://segueix.cat/video-sitemap/2026_09.xml</loc>');
    expect(xml).toContain('<loc>https://segueix.cat/video-sitemap/2025.xml</loc>');
  });

  it('publica metadades de vídeo completes per al feed recent', async () => {
    const response = await videoSitemapGroup({
      request: new Request('https://segueix.cat/video-sitemap/recent.xml'),
      params: { bucket: 'recent' },
      env: { ASSETS: assets() },
    });
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(xml).toContain('xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"');
    expect(xml).toContain('<loc>https://segueix.cat/video/video-recent-en-catala-RECENT12345</loc>');
    expect(xml).toContain('<video:thumbnail_loc>https://i.ytimg.com/vi/RECENT12345/maxresdefault.jpg</video:thumbnail_loc>');
    expect(xml).toContain('<video:title>Vídeo recent en català</video:title>');
    expect(xml).toContain('<video:description>Una descripció real del vídeo recent.</video:description>');
    expect(xml).toContain('<video:player_loc allow_embed="yes">https://www.youtube-nocookie.com/embed/RECENT12345</video:player_loc>');
    expect(xml).toContain('<video:duration>315</video:duration>');
    expect(xml).toContain('<video:publication_date>2026-09-25T09:30:00.000Z</video:publication_date>');
    expect(xml).toContain('<video:uploader>Canal Recent</video:uploader>');
  });

  it('genera descripció i miniatura vàlides per als vídeos compactes de l arxiu', async () => {
    const response = await videoSitemapGroup({
      request: new Request('https://segueix.cat/video-sitemap/2026_09.xml'),
      params: { bucket: '2026_09' },
      env: { ASSETS: assets() },
    });
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(xml).toContain('<loc>https://segueix.cat/video/video-antic-en-catala-ARCHIV12345</loc>');
    expect(xml).toContain('<video:thumbnail_loc>https://i.ytimg.com/vi/ARCHIV12345/hqdefault.jpg</video:thumbnail_loc>');
    expect(xml).toContain('un vídeo en català de Canal Arxiu, a Segueix.cat.');
    expect(xml).toContain('<video:duration>181</video:duration>');
    expect(xml).toContain('<video:uploader>Canal Arxiu</video:uploader>');
  });

  it('rebutja fragments inexistents', async () => {
    const response = await videoSitemapGroup({
      request: new Request('https://segueix.cat/video-sitemap/2030_01.xml'),
      params: { bucket: '2030_01' },
      env: { ASSETS: assets() },
    });
    expect(response.status).toBe(404);
  });

  it('robots.txt anuncia els dos sitemaps', () => {
    expect(robots).toContain('Sitemap: https://segueix.cat/sitemap.xml');
    expect(robots).toContain('Sitemap: https://segueix.cat/video-sitemap.xml');
  });
});
