import { buildCreatorRecords, creatorUrl } from './_lib/creator-slugs.js';
import { VIDEO_ID_PATTERN, videoUrl } from './_lib/video-slugs.js';
import { SEO_SECTIONS } from './_lib/section-seo.js';

const SITE_URL = 'https://segueix.cat';
const MAX_SITEMAP_URLS = 49000;

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function fetchJsonAsset(context, pathname) {
  const assetUrl = new URL(pathname, context.request.url);
  const response = await context.env.ASSETS.fetch(
    new Request(assetUrl.toString(), {
      method: 'GET',
      headers: { accept: 'application/json' },
    })
  );
  if (!response.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function loadArchiveIndexVideos(context, limit) {
  if (limit <= 0) return [];
  const manifest = await fetchJsonAsset(context, '/data/search_index_manifest.json');
  const buckets = Array.isArray(manifest?.buckets) ? manifest.buckets : [];
  const videos = [];

  for (const bucket of buckets) {
    if (videos.length >= limit) break;
    const file = String(bucket?.file || '').trim();
    if (!file) continue;
    const data = await fetchJsonAsset(context, `/data/${file}`);
    if (!Array.isArray(data)) continue;

    for (const item of data) {
      const id = String(item?.i || '').trim();
      if (!VIDEO_ID_PATTERN.test(id)) continue;
      videos.push({
        id,
        title: String(item?.t || '').trim() || 'Vídeo',
        publishedAt: String(item?.d || '').trim(),
      });
      if (videos.length >= limit) break;
    }
  }

  return videos;
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}/.test(String(value || '')) ? String(value).slice(0, 10) : '';
}

function normalizeFeedVideos(feedData) {
  if (Array.isArray(feedData)) return feedData;
  return Array.isArray(feedData?.videos) ? feedData.videos : [];
}

export async function onRequestGet(context) {
  const [channelsData, feedData] = await Promise.all([
    fetchJsonAsset(context, '/js/channels-ca.json'),
    fetchJsonAsset(context, '/data/feed.json'),
  ]);

  const channels = Array.isArray(channelsData?.channels) ? channelsData.channels : [];
  const creatorsLastmod = validDate(channelsData?.updatedAt);
  const feedLastmod = validDate(feedData?.generatedAt || feedData?.updatedAt) || creatorsLastmod;
  const creatorUrls = buildCreatorRecords(channels)
    .sort((a, b) => a.slug.localeCompare(b.slug, 'ca'))
    .map((creator) => ({ url: creatorUrl(creator, SITE_URL), lastmod: creatorsLastmod }));

  const baseUrls = [
    { url: `${SITE_URL}/`, lastmod: feedLastmod || creatorsLastmod },
    { url: `${SITE_URL}/creadors`, lastmod: creatorsLastmod },
    ...Object.values(SEO_SECTIONS).map((section) => ({
      url: `${SITE_URL}${section.path}`,
      lastmod: feedLastmod,
    })),
  ];

  const seenVideoIds = new Set();
  const maxVideos = Math.max(0, MAX_SITEMAP_URLS - baseUrls.length - creatorUrls.length);
  const recentVideos = normalizeFeedVideos(feedData)
    .filter((video) => VIDEO_ID_PATTERN.test(String(video?.id || '')))
    .sort((a, b) => (Date.parse(b?.publishedAt || '') || 0) - (Date.parse(a?.publishedAt || '') || 0));

  const archiveVideos = await loadArchiveIndexVideos(context, maxVideos);
  const allVideos = [...recentVideos, ...archiveVideos];

  const videoUrls = allVideos
    .filter((video) => {
      const id = String(video.id);
      if (seenVideoIds.has(id)) return false;
      seenVideoIds.add(id);
      return true;
    })
    .slice(0, maxVideos)
    .map((video) => ({
      url: videoUrl(video, SITE_URL),
      lastmod: validDate(video?.publishedAt),
    }))
    .filter((entry) => entry.url);

  const entries = [...baseUrls, ...creatorUrls, ...videoUrls];
  const body = entries
    .map(
      ({ url, lastmod }) =>
        `  <url>\n    <loc>${escapeXml(url)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

  return new Response(xml, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=900, s-maxage=21600, stale-while-revalidate=86400',
    },
  });
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
