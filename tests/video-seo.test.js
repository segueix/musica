import { describe, expect, it, vi } from 'vitest';
import { slugifyVideoTitle, videoUrl } from '../functions/_lib/video-slugs.js';
import { onRequestGet as videoPage } from '../functions/video/[videoKey].js';
import { onRequestGet as sitemap } from '../functions/sitemap.xml.js';

const CHANNEL_ID = 'UCH5ACoCmY5JrwwZXfpEJ5GA';
const CURRENT_ID = 'tDWTIndhClU';
const RELATED_ID = 'abc123XYZ_1';
const ARCHIVED_ID = 'OLDvid12345';

const currentVideo = {
  id: CURRENT_ID,
  title: 'Nou Canal! Som Atents!',
  description: 'Primer vídeo del nou canal, Som Atents, on parlem de muntanya i supervivència.\n\n00:00 Presentació\n01:00 Material bàsic\n02:15 Consells finals',
  thumbnail: `https://i.ytimg.com/vi/${CURRENT_ID}/maxresdefault.jpg`,
  channelId: CHANNEL_ID,
  channelTitle: 'Som Atents',
  publishedAt: '2026-09-14T18:20:42Z',
  categories: ['vida'],
  duration: 'PT3M11S',
  durationSeconds: 191,
  isShort: false,
  viewCount: 174,
  defaultAudioLanguage: 'ca',
  tags: ['català', 'muntanya'],
};

const relatedVideo = {
  id: RELATED_ID,
  title: 'Material bàsic de muntanya',
  description: 'Repàs del material bàsic.',
  thumbnail: `https://i.ytimg.com/vi/${RELATED_ID}/hqdefault.jpg`,
  channelId: CHANNEL_ID,
  channelTitle: 'Som Atents',
  publishedAt: '2026-09-13T10:00:00Z',
  categories: ['vida'],
  duration: 'PT4M',
  durationSeconds: 240,
};

const archivedVideo = {
  id: ARCHIVED_ID,
  title: 'Vídeo antic de muntanya',
  description: 'Un vídeo que ja no forma part del feed actual.',
  thumbnail: `https://i.ytimg.com/vi/${ARCHIVED_ID}/hqdefault.jpg`,
  channelId: CHANNEL_ID,
  channelTitle: 'Som Atents',
  publishedAt: '2025-10-24T18:20:42Z',
  categories: ['vida'],
  duration: 'PT2M10S',
  durationSeconds: 130,
};

function buildAssets() {
  return {
    fetch: vi.fn(async (request) => {
      const url = new URL(request.url);

      if (url.pathname === '/data/feed.json') {
        return new Response(JSON.stringify({ videos: [currentVideo, relatedVideo] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      if (url.pathname === '/js/channels-ca.json') {
        return new Response(
          JSON.stringify({
            updatedAt: '2026-09-15T08:00:00Z',
            channels: [
              {
                id: CHANNEL_ID,
                name: 'Som Atents',
                categories: ['vida'],
                category: 'vida',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      if (url.pathname === `/data/archive/channels/${CHANNEL_ID}.json`) {
        return new Response(
          JSON.stringify({ channelId: CHANNEL_ID, videos: [relatedVideo, archivedVideo] }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      if (url.pathname === '/data/search_index_manifest.json') {
        return new Response(
          JSON.stringify({
            buckets: [
              {
                key: '2025_10',
                file: 'search_index_2025_10.json',
                itemCount: 1,
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      if (url.pathname === '/data/search_index_2025_10.json') {
        return new Response(
          JSON.stringify([
            { i: ARCHIVED_ID, t: archivedVideo.title, c: CHANNEL_ID, d: archivedVideo.publishedAt, s: 130 },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      return new Response('Not found', { status: 404 });
    }),
  };
}

function videoContext(videoKey, search = '') {
  return {
    request: new Request(`https://segueix.cat/video/${videoKey}${search}`),
    params: { videoKey },
    env: { ASSETS: buildAssets() },
  };
}

describe('slugs SEO de vídeo', () => {
  it('normalitza el títol i conserva un ID estable al final', () => {
    expect(slugifyVideoTitle('Ànima, muntanya & país!')).toBe('anima-muntanya-pais');
    expect(videoUrl(currentVideo)).toBe(
      `https://segueix.cat/video/nou-canal-som-atents-${CURRENT_ID}`
    );
  });
});

describe('fitxes SEO de vídeo', () => {
  it('publica una pàgina indexable amb reproductor, canonical i VideoObject', async () => {
    const key = `nou-canal-som-atents-${CURRENT_ID}`;
    const response = await videoPage(videoContext(key));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('x-robots-tag')).toContain('index');
    expect(response.headers.get('x-robots-tag')).toContain('max-video-preview:-1');
    expect(html).toContain('<h1>Nou Canal! Som Atents!</h1>');
    expect(html).toContain(`rel="canonical" href="https://segueix.cat/video/${key}"`);
    expect(html).toContain('"@type":"VideoObject"');
    expect(html).toContain(`https://www.youtube-nocookie.com/embed/${CURRENT_ID}`);
    expect(html).toContain('https://segueix.cat/creador/som-atents');
    expect(html).toContain(`/?v=${CURRENT_ID}#segueix`);
    expect(html).toContain(`material-basic-de-muntanya-${RELATED_ID}`);
    expect(html).toContain('"creator":{"@type":"Organization"');
    expect(html).toContain('"@type":"Clip"');
    expect(html).toContain('"name":"Presentació","startOffset":0,"endOffset":60');
    expect(html).toContain(`https://segueix.cat/video/${key}?t=60`);
    expect(html).toContain('<h2 id="video-chapters-title">Capítols</h2>');
    expect(html).toContain('>1:00</time><span>Material bàsic</span>');
  });

  it('fa deep link al segon exacte dels Key Moments sense canviar el canonical', async () => {
    const key = `nou-canal-som-atents-${CURRENT_ID}`;
    const response = await videoPage(videoContext(key, '?t=60'));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain(`rel="canonical" href="https://segueix.cat/video/${key}"`);
    expect(html).toContain(`https://www.youtube-nocookie.com/embed/${CURRENT_ID}?start=60`);
  });

  it('redirecciona l ID nu i els slugs antics cap al canonical actual', async () => {
    const legacy = await videoPage(videoContext(CURRENT_ID));
    expect(legacy.status).toBe(301);
    expect(legacy.headers.get('location')).toBe(
      `https://segueix.cat/video/nou-canal-som-atents-${CURRENT_ID}`
    );

    const staleSlug = await videoPage(videoContext(`titol-antic-${CURRENT_ID}`));
    expect(staleSlug.status).toBe(301);
    expect(staleSlug.headers.get('location')).toBe(
      `https://segueix.cat/video/nou-canal-som-atents-${CURRENT_ID}`
    );
  });

  it('també resol vídeos que només són a l arxiu', async () => {
    const key = `video-antic-de-muntanya-${ARCHIVED_ID}`;
    const response = await videoPage(videoContext(key));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<h1>Vídeo antic de muntanya</h1>');
    expect(html).toContain(`rel="canonical" href="https://segueix.cat/video/${key}"`);
    expect(html).toContain(`https://www.youtube-nocookie.com/embed/${ARCHIVED_ID}`);
  });

  it('retorna 404 noindex per identificadors que no existeixen', async () => {
    const response = await videoPage(videoContext('no-es-un-video'));
    const html = await response.text();

    expect(response.status).toBe(404);
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
    expect(html).toContain('name="robots" content="noindex,follow"');
  });
});

describe('sitemap de vídeos', () => {
  it('afegeix els vídeos del feed i de l arxiu amb URL canònica', async () => {
    const response = await sitemap({
      request: new Request('https://segueix.cat/sitemap.xml'),
      env: { ASSETS: buildAssets() },
    });
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(xml).toContain(
      `<loc>https://segueix.cat/video/nou-canal-som-atents-${CURRENT_ID}</loc>`
    );
    expect(xml).toContain(
      `<loc>https://segueix.cat/video/material-basic-de-muntanya-${RELATED_ID}</loc>`
    );
    expect(xml).toContain(
      `<loc>https://segueix.cat/video/video-antic-de-muntanya-${ARCHIVED_ID}</loc>`
    );
    expect(xml).not.toContain('?v=');
  });
});
