import { SITE_URL, escapeXml, fetchJsonAsset, videoSitemapHeaders } from './_lib/video-sitemap.js';

function lastmod(value) {
  const time = Date.parse(String(value || ''));
  return Number.isFinite(time) ? new Date(time).toISOString() : '';
}

export async function onRequestGet(context) {
  const [manifest, feed] = await Promise.all([
    fetchJsonAsset(context, '/data/search_index_manifest.json'),
    fetchJsonAsset(context, '/data/feed.json'),
  ]);

  const buckets = Array.isArray(manifest?.buckets) ? manifest.buckets : [];
  const entries = [
    {
      loc: `${SITE_URL}/video-sitemap/recent.xml`,
      lastmod: lastmod(feed?.generatedAt || feed?.updatedAt),
    },
    ...buckets
      .map((bucket) => String(bucket?.key || '').trim())
      .filter((key) => /^[0-9]{4}(?:_[0-9]{2})?$/.test(key))
      .map((key) => ({
        loc: `${SITE_URL}/video-sitemap/${key}.xml`,
        lastmod: lastmod(manifest?.generatedAt),
      })),
  ];

  const body = entries.map(({ loc, lastmod: modified }) =>
    `  <sitemap>
    <loc>${escapeXml(loc)}</loc>${modified ? `\n    <lastmod>${escapeXml(modified)}</lastmod>` : ''}
  </sitemap>`
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</sitemapindex>
`;

  return new Response(xml, { status: 200, headers: videoSitemapHeaders() });
}

export async function onRequestHead(context) {
  const response = await onRequestGet(context);
  return new Response(null, { status: response.status, headers: response.headers });
}

export function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  if (context.request.method === 'HEAD') return onRequestHead(context);
  return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
}
