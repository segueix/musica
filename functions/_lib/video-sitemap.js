import { VIDEO_ID_PATTERN, videoUrl } from './video-slugs.js';

export const SITE_URL = 'https://segueix.cat';
const MAX_TITLE = 100;
const MAX_DESCRIPTION = 2048;
const MAX_VIDEO_DURATION = 28800;

export function escapeXml(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function truncate(value, max) {
  const text = cleanText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

export async function fetchJsonAsset(context, pathname) {
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

function validHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function publicationDate(value) {
  const raw = String(value || '').trim();
  const time = Date.parse(raw);
  if (!Number.isFinite(time)) return '';
  return new Date(time).toISOString();
}

function durationSeconds(value) {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_VIDEO_DURATION) return 0;
  return Math.floor(seconds);
}

function channelMap(channelsData) {
  const channels = Array.isArray(channelsData?.channels) ? channelsData.channels : [];
  return new Map(
    channels
      .map((channel) => [String(channel?.id || '').trim(), cleanText(channel?.name || channel?.title || '')])
      .filter(([id]) => id)
  );
}

function feedVideos(feedData) {
  if (Array.isArray(feedData)) return feedData;
  return Array.isArray(feedData?.videos) ? feedData.videos : [];
}

function compactVideos(bucketData) {
  return (Array.isArray(bucketData) ? bucketData : [])
    .map((item) => ({
      id: String(item?.i || '').trim(),
      title: String(item?.t || '').trim(),
      channelId: String(item?.c || '').trim(),
      publishedAt: String(item?.d || '').trim(),
      durationSeconds: Number(item?.s || 0),
    }))
    .filter((video) => VIDEO_ID_PATTERN.test(video.id) && video.title);
}

export function normalizeVideoSitemapEntries(videos, channelsData) {
  const channels = channelMap(channelsData);
  const seen = new Set();

  return (Array.isArray(videos) ? videos : [])
    .filter((video) => VIDEO_ID_PATTERN.test(String(video?.id || '').trim()))
    .filter((video) => {
      const id = String(video.id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((video) => {
      const id = String(video.id);
      const title = truncate(video.title || 'Vídeo en català', MAX_TITLE);
      const uploader = cleanText(video.channelTitle) || channels.get(String(video.channelId || '')) || '';
      const fallbackDescription = uploader
        ? `Mira ${title}, un vídeo en català de ${uploader}, a Segueix.cat.`
        : `Mira ${title}, un vídeo en català, a Segueix.cat.`;
      return {
        id,
        pageUrl: videoUrl(video, SITE_URL),
        title,
        description: truncate(video.description || fallbackDescription, MAX_DESCRIPTION),
        thumbnail: validHttpUrl(video.thumbnail) || `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`,
        player: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`,
        publishedAt: publicationDate(video.publishedAt),
        duration: durationSeconds(video.durationSeconds),
        uploader: truncate(uploader, 255),
      };
    })
    .filter((video) => video.pageUrl);
}

export function renderVideoUrlset(entries) {
  const rows = entries.map((video) => {
    const optional = [
      video.duration ? `      <video:duration>${video.duration}</video:duration>` : '',
      video.publishedAt ? `      <video:publication_date>${escapeXml(video.publishedAt)}</video:publication_date>` : '',
      video.uploader ? `      <video:uploader>${escapeXml(video.uploader)}</video:uploader>` : '',
    ].filter(Boolean).join('\n');

    return `  <url>
    <loc>${escapeXml(video.pageUrl)}</loc>
    <video:video>
      <video:thumbnail_loc>${escapeXml(video.thumbnail)}</video:thumbnail_loc>
      <video:title>${escapeXml(video.title)}</video:title>
      <video:description>${escapeXml(video.description)}</video:description>
      <video:player_loc allow_embed="yes">${escapeXml(video.player)}</video:player_loc>
${optional ? `${optional}\n` : ''}    </video:video>
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${rows}
</urlset>
`;
}

export async function loadVideoSitemapGroup(context, group) {
  const [manifest, channelsData] = await Promise.all([
    fetchJsonAsset(context, '/data/search_index_manifest.json'),
    fetchJsonAsset(context, '/js/channels-ca.json'),
  ]);

  if (group === 'recent') {
    const feedData = await fetchJsonAsset(context, '/data/feed.json');
    return normalizeVideoSitemapEntries(feedVideos(feedData), channelsData);
  }

  const bucket = (Array.isArray(manifest?.buckets) ? manifest.buckets : [])
    .find((item) => String(item?.key || '') === group);
  const file = String(bucket?.file || '').trim();
  if (!file || !/^search_index_[A-Za-z0-9_-]+\.json$/.test(file)) return null;

  const data = await fetchJsonAsset(context, `/data/${file}`);
  return normalizeVideoSitemapEntries(compactVideos(data), channelsData);
}

export function videoSitemapHeaders() {
  return {
    'content-type': 'application/xml; charset=utf-8',
    'cache-control': 'public, max-age=900, s-maxage=21600, stale-while-revalidate=86400',
    'x-robots-tag': 'noindex, follow',
  };
}
