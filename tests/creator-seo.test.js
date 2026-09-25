import { describe, expect, it, vi } from 'vitest';
import { buildCreatorRecords, slugifyCreatorName } from '../functions/_lib/creator-slugs.js';
import { onRequestGet as creatorPage } from '../functions/creador/[channelId].js';
import { onRequestGet as creatorsDirectory } from '../functions/creadors.js';
import { onRequestGet as sitemap } from '../functions/sitemap.xml.js';

const CHANNEL_ID = 'UC_test_creator';
const SECOND_CHANNEL_ID = 'UC_alt_creator';
const CREATOR_SLUG = 'canal-de-prova';

function buildAssets({ includeCreator = true } = {}) {
  return {
    fetch: vi.fn(async (request) => {
      const url = new URL(request.url);
      if (url.pathname === '/js/channels-ca.json') {
        return new Response(
          JSON.stringify({
            updatedAt: '2026-09-14T14:54:58.414Z',
            channels: includeCreator
              ? [
                  {
                    id: CHANNEL_ID,
                    name: 'Canal de prova',
                    categories: ['cultura'],
                    category: 'cultura',
                  },
                  {
                    id: SECOND_CHANNEL_ID,
                    name: 'À Punt Mèdia',
                    categories: ['mitjans'],
                    category: 'mitjans',
                  },
                ]
              : [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      if (url.pathname === `/data/archive/channels/${CHANNEL_ID}.json` && includeCreator) {
        return new Response(
          JSON.stringify({
            channelId: CHANNEL_ID,
            generatedAt: '2026-09-14T12:00:00Z',
            videos: [
              {
                id: 'abc123XYZ_1',
                title: 'Vídeo de prova',
                description: 'Una descripció del vídeo.',
                thumbnail: 'https://i.ytimg.com/vi/abc123XYZ_1/maxresdefault.jpg',
                channelId: CHANNEL_ID,
                channelTitle: 'Canal de prova',
                publishedAt: '2026-09-13T12:00:00Z',
                categories: ['cultura'],
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      return new Response('Not found', { status: 404 });
    }),
  };
}

function creatorContext({ includeCreator = true, channelId = CREATOR_SLUG } = {}) {
  return {
    request: new Request(`https://segueix.cat/creador/${channelId}`),
    params: { channelId },
    env: { ASSETS: buildAssets({ includeCreator }) },
  };
}

describe('slugs de creador', () => {
  it('normalitza accents i signes a una URL llegible', () => {
    expect(slugifyCreatorName('À Punt Mèdia')).toBe('a-punt-media');
    expect(slugifyCreatorName('abril 🐞')).toBe('abril');
  });

  it('resol col·lisions de noms sense duplicar URL', () => {
    const creators = buildCreatorRecords([
      { id: 'UC_same_name_1', name: 'Nom Igual' },
      { id: 'UC_same_name_2', name: 'Nom Igual' },
    ]);
    expect(creators[0].slug).not.toBe(creators[1].slug);
    expect(creators.every((creator) => creator.slug.startsWith('nom-igual-'))).toBe(true);
  });
});

describe('fitxes SEO de creador', () => {
  it('retorna una pàgina indexable amb canonical llegible, JSON-LD i vídeos', async () => {
    const response = await creatorPage(creatorContext());
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('x-robots-tag')).toContain('index');
    expect(html).toContain('<h1>Canal de prova</h1>');
    expect(html).toContain('rel="canonical" href="https://segueix.cat/creador/canal-de-prova"');
    expect(html).toContain('application/ld+json');
    expect(html).toContain('Vídeo de prova');
    expect(html).toContain(`/?channel=${CHANNEL_ID}#segueix`);
    expect(html).toContain(`https://www.youtube.com/channel/${CHANNEL_ID}`);
    expect(html).toContain('/creador/a-punt-media');
    expect(html).toContain('/video/video-de-prova-abc123XYZ_1');
    expect(html).not.toContain('/?v=abc123XYZ_1');
  });

  it('redirecciona l URL antiga amb ID cap al slug canònic', async () => {
    const response = await creatorPage(creatorContext({ channelId: CHANNEL_ID }));
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://segueix.cat/creador/canal-de-prova');
  });

  it('retorna 404 i noindex si el creador no existeix', async () => {
    const response = await creatorPage(creatorContext({ includeCreator: false, channelId: 'no-existeix' }));
    const html = await response.text();

    expect(response.status).toBe(404);
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
    expect(html).toContain('name="robots" content="noindex"');
  });
});

describe('directori de creadors', () => {
  it('publica enllaços HTML rastrejables a les fitxes llegibles', async () => {
    const response = await creatorsDirectory({
      request: new Request('https://segueix.cat/creadors'),
      env: { ASSETS: buildAssets() },
    });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('rel="canonical" href="https://segueix.cat/creadors"');
    expect(html).toContain('href="/creador/canal-de-prova"');
    expect(html).toContain('href="/creador/a-punt-media"');
    expect(html).toContain('Canal de prova');
    expect(html).toContain('À Punt Mèdia');
  });
});

describe('sitemap de creadors', () => {
  it('publica el directori i les URL canòniques llegibles', async () => {
    const response = await sitemap({
      request: new Request('https://segueix.cat/sitemap.xml'),
      env: { ASSETS: buildAssets() },
    });
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(xml).toContain('<loc>https://segueix.cat/</loc>');
    expect(xml).toContain('<loc>https://segueix.cat/creadors</loc>');
    expect(xml).toContain('<loc>https://segueix.cat/creador/canal-de-prova</loc>');
    expect(xml).toContain('<loc>https://segueix.cat/creador/a-punt-media</loc>');
    expect(xml).not.toContain(`<loc>https://segueix.cat/creador/${CHANNEL_ID}</loc>`);
    expect(xml).toContain('<lastmod>2026-09-14</lastmod>');
  });
});
