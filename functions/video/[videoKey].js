import { buildCreatorRecords, creatorUrl } from '../_lib/creator-slugs.js';
import { VIDEO_ID_PATTERN, resolveVideoParam, videoKey, videoUrl } from '../_lib/video-slugs.js';

const SITE_URL = 'https://segueix.cat';
const FALLBACK_IMAGE = `${SITE_URL}/img/icon-192.png`;
const MAX_VISIBLE_DESCRIPTION = 1200;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function jsonLd(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

function safeHttpUrl(value, fallback = '') {
  try {
    const parsed = new URL(String(value || ''));
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : fallback;
  } catch {
    return fallback;
  }
}

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value, max) {
  const text = cleanText(value);
  if (!text || text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

function formatDate(value) {
  const parsed = Date.parse(value || '');
  if (!parsed) return '';
  try {
    return new Intl.DateTimeFormat('ca-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(parsed));
  } catch {
    return new Date(parsed).toISOString().slice(0, 10);
  }
}

function formatDuration(seconds) {
  const total = Math.max(0, Number.parseInt(seconds || 0, 10) || 0);
  if (!total) return '';
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours) return `${hours} h ${minutes} min`;
  if (minutes) return `${minutes} min ${secs ? `${secs} s` : ''}`.trim();
  return `${secs} s`;
}

function isoDurationSeconds(value) {
  const match = String(value || '').match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

function videoDurationSeconds(video) {
  const direct = Number(video?.durationSeconds || 0);
  if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);
  return isoDurationSeconds(video?.duration);
}

function timestampSeconds(value) {
  const parts = String(value || '').trim().split(':').map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !Number.isFinite(part) || part < 0)) {
    return -1;
  }
  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    if (seconds >= 60) return -1;
    return minutes * 60 + seconds;
  }
  const [hours, minutes, seconds] = parts;
  if (minutes >= 60 || seconds >= 60) return -1;
  return hours * 3600 + minutes * 60 + seconds;
}

function parseKeyMoments(description, canonical, durationSeconds) {
  if (durationSeconds > 0 && durationSeconds < 30) return [];

  const seen = new Set();
  const moments = String(description || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => {
      const match = line.match(/^(\d{1,4}:\d{2}(?::\d{2})?)\s*(?:[-–—|:.]\s*)?(.+)$/);
      if (!match) return null;
      const startOffset = timestampSeconds(match[1]);
      const name = cleanText(match[2]).replace(/^[-–—|:.\s]+/, '').trim();
      if (startOffset < 0 || !name || name.length > 120 || /^https?:\/\//i.test(name)) return null;
      if (durationSeconds > 0 && startOffset >= durationSeconds) return null;
      if (seen.has(startOffset)) return null;
      seen.add(startOffset);
      return { name, startOffset };
    })
    .filter(Boolean)
    .sort((a, b) => a.startOffset - b.startOffset);

  if (moments.length < 2) return [];

  return moments.map((moment, index) => {
    const nextStart = moments[index + 1]?.startOffset;
    const endOffset = Number.isFinite(nextStart)
      ? nextStart
      : durationSeconds > moment.startOffset
        ? durationSeconds
        : undefined;
    return {
      '@type': 'Clip',
      name: moment.name,
      startOffset: moment.startOffset,
      endOffset,
      url: `${canonical}?t=${moment.startOffset}`,
    };
  });
}

function formatCount(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return '';
  try {
    return new Intl.NumberFormat('ca-ES', { notation: 'compact', maximumFractionDigits: 1 }).format(number);
  } catch {
    return String(Math.round(number));
  }
}

async function fetchAsset(context, pathname) {
  const assetUrl = new URL(pathname, context.request.url);
  return context.env.ASSETS.fetch(
    new Request(assetUrl.toString(), {
      method: 'GET',
      headers: { accept: 'application/json' },
    })
  );
}

async function fetchJsonAsset(context, pathname) {
  const response = await fetchAsset(context, pathname);
  if (!response.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchArchive(context, channelId) {
  const safeChannelId = String(channelId || '').trim();
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(safeChannelId)) return null;
  return fetchJsonAsset(context, `/data/archive/channels/${encodeURIComponent(safeChannelId)}.json`);
}

function feedVideos(feedData) {
  if (Array.isArray(feedData)) return feedData;
  return Array.isArray(feedData?.videos) ? feedData.videos : [];
}

async function lookupArchivedVideo(context, videoId) {
  const manifest = await fetchJsonAsset(context, '/data/search_index_manifest.json');
  const buckets = Array.isArray(manifest?.buckets) ? manifest.buckets : [];

  let channelId = '';
  for (const bucket of buckets) {
    const file = String(bucket?.file || '').trim();
    if (!/^search_index_[A-Za-z0-9_-]+\.json$/.test(file)) continue;

    const response = await fetchAsset(context, `/data/${file}`);
    if (!response.ok) continue;
    const raw = await response.text();
    if (!raw.includes(videoId)) continue;

    try {
      const entries = JSON.parse(raw);
      const entry = Array.isArray(entries)
        ? entries.find((item) => String(item?.i || '') === videoId)
        : null;
      if (entry?.c) {
        channelId = String(entry.c);
        break;
      }
    } catch {
      // Fragment invàlid: continuem amb el següent.
    }
  }

  if (!channelId) return null;
  const archive = await fetchArchive(context, channelId);
  const videos = Array.isArray(archive?.videos) ? archive.videos : [];
  const video = videos.find((item) => String(item?.id || '') === videoId) || null;
  return video ? { video, archiveVideos: videos } : null;
}

async function resolveVideo(context, videoId) {
  const feed = await fetchJsonAsset(context, '/data/feed.json');
  const recentVideos = feedVideos(feed);
  const current = recentVideos.find((item) => String(item?.id || '') === videoId) || null;

  if (current) {
    const archive = await fetchArchive(context, current.channelId);
    return {
      video: current,
      feedVideos: recentVideos,
      archiveVideos: Array.isArray(archive?.videos) ? archive.videos : [],
    };
  }

  const archived = await lookupArchivedVideo(context, videoId);
  if (!archived) return null;
  return {
    video: archived.video,
    feedVideos: recentVideos,
    archiveVideos: archived.archiveVideos,
  };
}

function relatedVideos(video, recentVideos, archiveVideos, limit = 6) {
  const channelId = String(video?.channelId || '');
  const targetId = String(video?.id || '');
  const seen = new Set([targetId]);
  const combined = [...recentVideos, ...archiveVideos]
    .filter((item) => String(item?.channelId || '') === channelId)
    .filter((item) => VIDEO_ID_PATTERN.test(String(item?.id || '')))
    .filter((item) => {
      const id = String(item.id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort((a, b) => (Date.parse(b?.publishedAt || '') || 0) - (Date.parse(a?.publishedAt || '') || 0));
  return combined.slice(0, limit);
}

function notFound(value) {
  return new Response(
    `<!doctype html><html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>Vídeo no trobat - Segueix.cat</title></head><body><main><h1>Vídeo no trobat</h1><p>No hem trobat el vídeo <code>${escapeHtml(value)}</code>.</p><p><a href="/">Torna a Segueix.cat</a></p></main></body></html>`,
    {
      status: 404,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300',
        'x-robots-tag': 'noindex, follow',
      },
    }
  );
}

function redirectToCanonical(video) {
  return new Response(null, {
    status: 301,
    headers: {
      location: videoUrl(video, SITE_URL),
      'cache-control': 'public, max-age=86400, s-maxage=604800',
    },
  });
}

export async function onRequestGet(context) {
  const requested = String(context.params?.videoKey || '').trim();
  const resolvedParam = resolveVideoParam(requested);
  if (!resolvedParam.videoId) return notFound(requested);

  const resolved = await resolveVideo(context, resolvedParam.videoId);
  if (!resolved?.video) return notFound(requested);

  const video = resolved.video;
  const canonicalKey = videoKey(video);
  if (!canonicalKey) return notFound(requested);
  if (resolvedParam.raw !== canonicalKey) return redirectToCanonical(video);

  const channelsData = await fetchJsonAsset(context, '/js/channels-ca.json');
  const creators = buildCreatorRecords(Array.isArray(channelsData?.channels) ? channelsData.channels : []);
  const creator = creators.find((item) => item.id === String(video.channelId || '')) || null;
  const creatorHref = creator ? creatorUrl(creator, SITE_URL) : '';

  const id = String(video.id);
  const title = cleanText(video.title) || 'Vídeo en català';
  const channelTitle = cleanText(video.channelTitle) || creator?.name || 'Creador en català';
  const canonical = videoUrl(video, SITE_URL);
  const youtubeUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  const youtubeChannelUrl = video.channelId
    ? `https://www.youtube.com/channel/${encodeURIComponent(video.channelId)}`
    : '';
  const appUrl = `/?v=${encodeURIComponent(id)}#segueix`;
  const requestUrl = new URL(context.request.url);
  const requestedStart = Math.max(0, Number.parseInt(requestUrl.searchParams.get('t') || '0', 10) || 0);
  const embedUrl = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}${requestedStart ? `?start=${requestedStart}` : ''}`;
  const thumbnail =
    safeHttpUrl(video.thumbnail) || `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
  const sourceDescription = String(video.description || '');
  const rawDescription = cleanText(sourceDescription);
  const metaDescription = truncate(
    rawDescription || `Mira ${title}, un vídeo en català de ${channelTitle}, a Segueix.cat.`,
    158
  );
  const visibleDescription = truncate(rawDescription, MAX_VISIBLE_DESCRIPTION);
  const publishedAt = String(video.publishedAt || '');
  const dateLabel = formatDate(publishedAt);
  const totalDurationSeconds = videoDurationSeconds(video);
  const durationLabel = formatDuration(totalDurationSeconds);
  const viewLabel = formatCount(video.viewCount);
  const categories = [...new Set((Array.isArray(video.categories) ? video.categories : []).map((item) => cleanText(item)).filter(Boolean))].slice(0, 8);
  const tags = [...new Set((Array.isArray(video.tags) ? video.tags : []).map((item) => cleanText(item)).filter(Boolean))].slice(0, 12);
  const related = relatedVideos(video, resolved.feedVideos, resolved.archiveVideos);
  const language = cleanText(video.defaultAudioLanguage || video.defaultLanguage) || 'ca';
  const keyMoments = parseKeyMoments(sourceDescription, canonical, totalDurationSeconds);

  const creatorUrlForSchema = creatorHref || youtubeChannelUrl || undefined;
  const videoObject = {
    '@type': 'VideoObject',
    '@id': `${canonical}#video`,
    name: title,
    description: truncate(rawDescription || metaDescription, 500),
    thumbnailUrl: [thumbnail],
    uploadDate: Date.parse(publishedAt) ? publishedAt : undefined,
    duration: /^PT[0-9HMS]+$/i.test(String(video.duration || '')) ? String(video.duration) : undefined,
    embedUrl,
    url: canonical,
    inLanguage: language,
    creator: channelTitle
      ? {
          '@type': 'Organization',
          name: channelTitle,
          url: creatorUrlForSchema,
        }
      : undefined,
    hasPart: keyMoments.length ? keyMoments : undefined,
    interactionStatistic:
      Number(video.viewCount || 0) > 0
        ? {
            '@type': 'InteractionCounter',
            interactionType: { '@type': 'WatchAction' },
            userInteractionCount: Number(video.viewCount),
          }
        : undefined,
  };

  const breadcrumbItems = [
    { '@type': 'ListItem', position: 1, name: 'Segueix.cat', item: `${SITE_URL}/` },
  ];
  if (creator) {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 2,
      name: creator.name,
      item: creatorHref,
    });
  }
  breadcrumbItems.push({
    '@type': 'ListItem',
    position: breadcrumbItems.length + 1,
    name: title,
    item: canonical,
  });

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: `${title} - Segueix.cat`,
        description: metaDescription,
        inLanguage: 'ca',
        isPartOf: {
          '@type': 'WebSite',
          '@id': `${SITE_URL}/#website`,
          name: 'Segueix.cat',
          url: `${SITE_URL}/`,
          inLanguage: 'ca',
        },
        breadcrumb: { '@id': `${canonical}#breadcrumb` },
        mainEntity: { '@id': `${canonical}#video` },
      },
      videoObject,
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: breadcrumbItems,
      },
    ],
  };

  const metaBits = [
    creatorHref
      ? `<a href="${escapeHtml(creatorHref)}">${escapeHtml(channelTitle)}</a>`
      : escapeHtml(channelTitle),
    dateLabel && Date.parse(publishedAt)
      ? `<time datetime="${escapeHtml(publishedAt)}">${escapeHtml(dateLabel)}</time>`
      : '',
    durationLabel ? escapeHtml(durationLabel) : '',
    viewLabel ? `${escapeHtml(viewLabel)} visualitzacions` : '',
  ].filter(Boolean);

  const categoriesHtml = categories.length
    ? `<div class="tags">${categories.map((category) => `<span>${escapeHtml(category)}</span>`).join('')}</div>`
    : '';

  const keywordHtml = tags.length
    ? `<p class="keywords"><strong>Etiquetes:</strong> ${tags.map((tag) => escapeHtml(tag)).join(', ')}</p>`
    : '';

  const chaptersHtml = keyMoments.length
    ? `<section class="chapters" aria-labelledby="video-chapters-title"><h2 id="video-chapters-title">Capítols</h2><ol>${keyMoments
        .map((clip) => {
          const minutes = Math.floor(clip.startOffset / 60);
          const seconds = String(clip.startOffset % 60).padStart(2, '0');
          const hours = Math.floor(minutes / 60);
          const minutePart = hours ? String(minutes % 60).padStart(2, '0') : String(minutes);
          const timestamp = hours ? `${hours}:${minutePart}:${seconds}` : `${minutePart}:${seconds}`;
          return `<li><a href="${escapeHtml(clip.url)}"><time datetime="PT${clip.startOffset}S">${escapeHtml(timestamp)}</time><span>${escapeHtml(clip.name)}</span></a></li>`;
        })
        .join('')}</ol></section>`
    : '';

  const relatedHtml = related.length
    ? `<section class="related"><h2>Més vídeos de ${escapeHtml(channelTitle)}</h2><div class="grid">${related
        .map((item) => {
          const href = videoUrl(item, SITE_URL);
          const itemThumb =
            safeHttpUrl(item.thumbnail) ||
            `https://i.ytimg.com/vi/${encodeURIComponent(item.id)}/hqdefault.jpg`;
          const itemDate = formatDate(item.publishedAt);
          return `<article class="card"><a href="${escapeHtml(href)}"><img src="${escapeHtml(itemThumb)}" alt="${escapeHtml(item.title || 'Vídeo')}" loading="lazy" width="480" height="270"><div><h3>${escapeHtml(item.title || 'Vídeo')}</h3>${itemDate ? `<time datetime="${escapeHtml(item.publishedAt || '')}">${escapeHtml(itemDate)}</time>` : ''}</div></a></article>`;
        })
        .join('')}</div></section>`
    : '';

  const creatorAction = creatorHref
    ? `<a class="button secondary" href="${escapeHtml(creatorHref)}">Més de ${escapeHtml(channelTitle)}</a>`
    : '';

  const playerClass = video.isShort ? 'player short' : 'player';

  const html = `<!doctype html>
<html lang="ca">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} | ${escapeHtml(channelTitle)} | Segueix.cat</title>
  <meta name="description" content="${escapeHtml(metaDescription)}">
  <meta name="robots" content="index,follow,max-image-preview:large,max-video-preview:-1">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:locale" content="ca_ES">
  <meta property="og:type" content="video.other">
  <meta property="og:site_name" content="Segueix.cat">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(metaDescription)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(thumbnail)}">
  <meta property="og:video" content="${escapeHtml(embedUrl)}">
  <meta property="og:video:type" content="text/html">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(metaDescription)}">
  <meta name="twitter:image" content="${escapeHtml(thumbnail)}">
  <script type="application/ld+json">${jsonLd(structuredData)}</script>
  <style>
    :root { color-scheme: light dark; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #0f1115; color: #f5f7fa; }
    a { color: inherit; }
    .shell { width: min(1120px, calc(100% - 32px)); margin: 0 auto; }
    header { border-bottom: 1px solid #2a2f38; background: #151922; }
    header .shell { min-height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 18px; }
    .brand { font-size: 1.2rem; font-weight: 800; text-decoration: none; }
    nav { display: flex; gap: 16px; align-items: center; }
    main { padding: 36px 0 56px; }
    .player { width: min(100%, 960px); margin: 0 auto; aspect-ratio: 16 / 9; border-radius: 16px; overflow: hidden; background: #000; box-shadow: 0 18px 50px rgba(0,0,0,.28); }
    .player.short { width: min(100%, 430px); aspect-ratio: 9 / 16; }
    .player iframe { width: 100%; height: 100%; border: 0; display: block; }
    .content { width: min(960px, 100%); margin: 28px auto 0; }
    h1 { margin: 0; font-size: clamp(1.8rem, 5vw, 3.2rem); line-height: 1.08; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 14px; color: #aeb8c6; }
    .meta a { font-weight: 700; color: #f5f7fa; }
    .description { margin: 24px 0 0; max-width: 820px; color: #d1d8e2; line-height: 1.65; }
    .tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
    .tags span { padding: 6px 10px; border-radius: 999px; background: #232a35; font-size: .85rem; }
    .keywords { margin-top: 16px; color: #9faaba; font-size: .9rem; line-height: 1.5; }
    .chapters { margin-top: 28px; max-width: 820px; }
    .chapters h2 { margin: 0 0 12px; font-size: 1.2rem; }
    .chapters ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 7px; }
    .chapters a { display: flex; gap: 12px; align-items: baseline; padding: 9px 11px; border-radius: 9px; background: #171c24; text-decoration: none; }
    .chapters time { flex: 0 0 auto; font-variant-numeric: tabular-nums; font-weight: 800; color: #f5f7fa; }
    .chapters span { color: #cbd3df; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
    .button { display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border-radius: 10px; background: #f5f7fa; color: #11151c; font-weight: 750; text-decoration: none; }
    .button.secondary { background: #222934; color: #f5f7fa; }
    .related { width: min(960px, 100%); margin: 46px auto 0; }
    .related h2 { margin: 0 0 16px; font-size: 1.4rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 16px; }
    .card { overflow: hidden; border: 1px solid #2a2f38; border-radius: 14px; background: #171c24; }
    .card a { display: block; text-decoration: none; }
    .card img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; background: #222; }
    .card div { padding: 12px 13px 14px; }
    .card h3 { margin: 0; font-size: .98rem; line-height: 1.35; }
    .card time { display: block; margin-top: 7px; color: #99a4b4; font-size: .8rem; }
    footer { border-top: 1px solid #2a2f38; padding: 24px 0 36px; color: #96a1b1; }
    @media (prefers-color-scheme: light) {
      body { background: #f6f7f9; color: #11151c; }
      header { background: #fff; border-color: #e1e5ea; }
      .meta, .keywords, footer { color: #647082; }
      .meta a { color: #11151c; }
      .description { color: #3f4b5b; }
      .tags span, .button.secondary { background: #e8edf3; color: #11151c; }
      .chapters a { background: #fff; border: 1px solid #e1e5ea; }
      .chapters time { color: #11151c; }
      .chapters span { color: #536070; }
      .card { background: #fff; border-color: #e1e5ea; }
      .card time { color: #647082; }
      footer { border-color: #e1e5ea; }
    }
  </style>
</head>
<body>
  <header><div class="shell"><a class="brand" href="/">Segueix.cat</a><nav><a href="/creadors">Creadors</a><a href="${escapeHtml(appUrl)}">Obre l'app</a></nav></div></header>
  <main class="shell">
    <div class="${playerClass}"><iframe src="${escapeHtml(embedUrl)}" title="${escapeHtml(title)}" loading="eager" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>
    <article class="content">
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">${metaBits.map((item) => `<span>${item}</span>`).join('')}</div>
      ${visibleDescription ? `<p class="description">${escapeHtml(visibleDescription)}</p>` : ''}
      ${categoriesHtml}
      ${keywordHtml}
      ${chaptersHtml}
      <div class="actions"><a class="button" href="${escapeHtml(appUrl)}">Veure a Segueix</a>${creatorAction}<a class="button secondary" href="${escapeHtml(youtubeUrl)}" rel="nofollow external">Veure a YouTube</a></div>
    </article>
    ${relatedHtml}
  </main>
  <footer><div class="shell">Segueix.cat · Vídeos i creadors en català</div></footer>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=900, s-maxage=21600, stale-while-revalidate=86400',
      'x-robots-tag': 'index, follow, max-image-preview:large, max-video-preview:-1',
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
