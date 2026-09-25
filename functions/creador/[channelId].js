import { creatorUrl, resolveCreatorParam } from '../_lib/creator-slugs.js';
import { videoUrl } from '../_lib/video-slugs.js';

const SITE_URL = 'https://segueix.cat';
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{6,24}$/;
const FALLBACK_IMAGE = `${SITE_URL}/img/icon-192.png`;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeHttpUrl(value, fallback = '') {
  try {
    const parsed = new URL(String(value || ''));
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : fallback;
  } catch {
    return fallback;
  }
}

function jsonLd(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

function channelCategories(channel) {
  const values = Array.isArray(channel?.categories)
    ? channel.categories
    : channel?.category
      ? [channel.category]
      : [];
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function normalizeCategories(channel, videos) {
  const configured = channelCategories(channel);
  const fromVideos = videos.flatMap((video) => (Array.isArray(video?.categories) ? video.categories : []));
  return [...new Set([...configured, ...fromVideos].map((item) => String(item || '').trim()).filter(Boolean))].slice(0, 6);
}

function sortVideos(videos) {
  return [...videos].sort((a, b) => {
    const timeA = Date.parse(a?.publishedAt || '') || 0;
    const timeB = Date.parse(b?.publishedAt || '') || 0;
    return timeB - timeA;
  });
}

function formatDate(value) {
  const parsed = Date.parse(value || '');
  if (!parsed) return '';
  try {
    return new Intl.DateTimeFormat('ca-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(parsed));
  } catch {
    return new Date(parsed).toISOString().slice(0, 10);
  }
}

async function fetchJsonAsset(context, pathname) {
  const assetUrl = new URL(pathname, context.request.url);
  const response = await context.env.ASSETS.fetch(new Request(assetUrl.toString(), context.request));
  if (!response.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function notFound(value) {
  const safeValue = escapeHtml(value);
  return new Response(
    `<!doctype html><html lang="ca"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Creador no trobat - Segueix.cat</title></head><body><main><h1>Creador no trobat</h1><p>No hem trobat cap creador amb l'identificador <code>${safeValue}</code>.</p><p><a href="/creadors">Veure tots els creadors</a></p></main></body></html>`,
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

function redirectToCanonical(creator) {
  return new Response(null, {
    status: 301,
    headers: {
      location: creatorUrl(creator, SITE_URL),
      'cache-control': 'public, max-age=86400, s-maxage=604800',
    },
  });
}

function relatedCreators(current, creators, limit = 8) {
  const currentCategories = new Set(channelCategories(current));
  return creators
    .filter((creator) => creator.id !== current.id)
    .map((creator) => {
      const overlap = channelCategories(creator).filter((category) => currentCategories.has(category)).length;
      return { creator, overlap };
    })
    .sort((a, b) => b.overlap - a.overlap || a.creator.name.localeCompare(b.creator.name, 'ca'))
    .slice(0, limit)
    .map(({ creator }) => creator);
}

export async function onRequestGet(context) {
  const requestedParam = String(context.params?.channelId || '').trim();
  const channelsData = await fetchJsonAsset(context, '/js/channels-ca.json');
  const configuredChannels = Array.isArray(channelsData?.channels) ? channelsData.channels : [];
  const { creator, legacyId, creators } = resolveCreatorParam(requestedParam, configuredChannels);

  if (!creator) return notFound(requestedParam);
  if (legacyId) return redirectToCanonical(creator);

  const archiveData = await fetchJsonAsset(
    context,
    `/data/archive/channels/${encodeURIComponent(creator.id)}.json`
  );
  const archiveVideos = Array.isArray(archiveData?.videos) ? archiveData.videos : [];
  const videos = sortVideos(archiveVideos.filter((video) => VIDEO_ID_PATTERN.test(String(video?.id || ''))));
  const firstVideo = videos[0] || null;

  const channelName = creator.name;
  const categories = normalizeCategories(creator, videos);
  const canonical = creatorUrl(creator, SITE_URL);
  const youtubeUrl = `https://www.youtube.com/channel/${encodeURIComponent(creator.id)}`;
  const appUrl = `/?channel=${encodeURIComponent(creator.id)}#segueix`;
  const videoCount = videos.length;
  const description = videoCount
    ? `Mira ${videoCount} vídeos en català de ${channelName} a Segueix.cat, amb els continguts més recents del canal.`
    : `Descobreix els vídeos en català de ${channelName} a Segueix.cat.`;
  const image = safeHttpUrl(firstVideo?.thumbnail, FALLBACK_IMAGE) || FALLBACK_IMAGE;
  const recentVideos = videos.slice(0, 12);
  const related = relatedCreators(creator, creators);

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: `${channelName} - Segueix.cat`,
        description,
        inLanguage: 'ca',
        isPartOf: {
          '@type': 'WebSite',
          '@id': `${SITE_URL}/#website`,
          name: 'Segueix.cat',
          url: `${SITE_URL}/`,
          inLanguage: 'ca',
        },
        breadcrumb: { '@id': `${canonical}#breadcrumb` },
        about: {
          '@type': 'Thing',
          '@id': `${canonical}#creator`,
          name: channelName,
          sameAs: youtubeUrl,
        },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: recentVideos.length,
          itemListElement: recentVideos.map((video, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: videoUrl(video, SITE_URL),
            item: {
              '@type': 'VideoObject',
              name: String(video.title || 'Vídeo'),
              thumbnailUrl: [safeHttpUrl(video.thumbnail, image) || image],
              uploadDate: video.publishedAt || undefined,
              description: String(video.description || '').replace(/\s+/g, ' ').trim().slice(0, 240) || undefined,
            },
          })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Segueix.cat', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Creadors', item: `${SITE_URL}/creadors` },
          { '@type': 'ListItem', position: 3, name: channelName, item: canonical },
        ],
      },
    ],
  };

  const tagsHtml = categories
    .map((category) => `<span class="tag">${escapeHtml(category)}</span>`)
    .join('');

  const videosHtml = recentVideos.length
    ? recentVideos
        .map((video) => {
          const title = escapeHtml(video.title || 'Vídeo');
          const thumb = escapeHtml(safeHttpUrl(video.thumbnail, FALLBACK_IMAGE) || FALLBACK_IMAGE);
          const href = videoUrl(video, SITE_URL);
          const dateLabel = formatDate(video.publishedAt);
          const timeHtml = dateLabel
            ? `<time datetime="${escapeHtml(video.publishedAt || '')}">${escapeHtml(dateLabel)}</time>`
            : '';
          return `<article class="video-card"><a href="${href}"><img src="${thumb}" alt="${title}" loading="lazy" width="480" height="270"><div class="video-copy"><h2>${title}</h2>${timeHtml}</div></a></article>`;
        })
        .join('')
    : '<p class="empty">Encara no hi ha vídeos arxivats d’aquest canal.</p>';

  const relatedHtml = related
    .map(
      (item) =>
        `<a class="creator-card" href="/creador/${encodeURIComponent(item.slug)}"><strong>${escapeHtml(item.name)}</strong>${channelCategories(item)[0] ? `<span>${escapeHtml(channelCategories(item)[0])}</span>` : ''}</a>`
    )
    .join('');

  const html = `<!doctype html>
<html lang="ca">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(channelName)} - vídeos en català | Segueix.cat</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:locale" content="ca_ES">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Segueix.cat">
  <meta property="og:title" content="${escapeHtml(channelName)} - Segueix.cat">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(channelName)} - Segueix.cat">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <script type="application/ld+json">${jsonLd(structuredData)}</script>
  <style>
    :root { color-scheme: light dark; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #0f1115; color: #f5f7fa; }
    a { color: inherit; }
    .shell { width: min(1180px, calc(100% - 32px)); margin: 0 auto; }
    header { border-bottom: 1px solid #2a2f38; background: #151922; }
    header .shell { min-height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .brand { font-size: 1.2rem; font-weight: 800; text-decoration: none; }
    .top-links { display: flex; gap: 16px; align-items: center; }
    .profile { padding: 48px 0 28px; }
    .eyebrow { margin: 0 0 8px; color: #aab4c3; font-size: .92rem; }
    h1 { margin: 0; font-size: clamp(2rem, 6vw, 4rem); line-height: 1.02; }
    .summary { max-width: 760px; margin: 16px 0 0; color: #cbd3df; font-size: 1.05rem; line-height: 1.6; }
    .tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
    .tag { padding: 6px 10px; border-radius: 999px; background: #232a35; color: #dbe3ee; font-size: .85rem; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
    .button { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 16px; border-radius: 10px; background: #f5f7fa; color: #11151c; font-weight: 750; text-decoration: none; }
    .button.secondary { background: #222934; color: #f5f7fa; }
    .section-title { margin: 28px 0 16px; font-size: 1.35rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 18px; }
    .video-card { overflow: hidden; border: 1px solid #2a2f38; border-radius: 14px; background: #171c24; }
    .video-card a { display: block; text-decoration: none; }
    .video-card img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; background: #222; }
    .video-copy { padding: 13px 14px 15px; }
    .video-copy h2 { margin: 0; font-size: 1rem; line-height: 1.35; }
    .video-copy time { display: block; margin-top: 8px; color: #99a4b4; font-size: .82rem; }
    .creator-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; padding-bottom: 56px; }
    .creator-card { display: flex; flex-direction: column; gap: 6px; padding: 15px; border: 1px solid #2a2f38; border-radius: 12px; background: #171c24; text-decoration: none; }
    .creator-card span { color: #99a4b4; font-size: .82rem; }
    .empty { color: #aab4c3; }
    footer { border-top: 1px solid #2a2f38; padding: 24px 0 36px; color: #96a1b1; }
    @media (prefers-color-scheme: light) {
      body { background: #f6f7f9; color: #11151c; }
      header { background: #fff; border-color: #e1e5ea; }
      .summary, .eyebrow { color: #536070; }
      .tag, .button.secondary { background: #e8edf3; color: #11151c; }
      .video-card, .creator-card { background: #fff; border-color: #e1e5ea; }
      .video-copy time, .creator-card span, footer, .empty { color: #647082; }
      footer { border-color: #e1e5ea; }
    }
  </style>
</head>
<body>
  <header><div class="shell"><a class="brand" href="/">Segueix.cat</a><nav class="top-links"><a href="/creadors">Creadors</a><a href="${escapeHtml(appUrl)}">Obre l'app</a></nav></div></header>
  <main class="shell">
    <section class="profile">
      <p class="eyebrow"><a href="/creadors">Creadors</a> · Contingut en català</p>
      <h1>${escapeHtml(channelName)}</h1>
      <p class="summary">${escapeHtml(description)}</p>
      ${tagsHtml ? `<div class="tags" aria-label="Categories">${tagsHtml}</div>` : ''}
      <div class="actions">
        <a class="button" href="${escapeHtml(appUrl)}">Veure la fitxa interactiva</a>
        <a class="button secondary" href="${escapeHtml(youtubeUrl)}" rel="noopener noreferrer">Canal de YouTube</a>
      </div>
    </section>
    <section aria-labelledby="latest-videos">
      <h2 class="section-title" id="latest-videos">Vídeos recents${videoCount ? ` · ${videoCount} arxivats` : ''}</h2>
      <div class="grid">${videosHtml}</div>
    </section>
    ${relatedHtml ? `<section aria-labelledby="related-creators"><h2 class="section-title" id="related-creators">Altres creadors en català</h2><div class="creator-grid">${relatedHtml}</div></section>` : ''}
  </main>
  <footer><div class="shell"><a href="/creadors">Tots els creadors</a> · Segueix.cat · Continguts en català</div></footer>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=900, s-maxage=21600, stale-while-revalidate=86400',
      'x-robots-tag': 'index, follow, max-image-preview:large',
    },
  });
}

export function onRequest(context) {
  if (context.request.method === 'GET' || context.request.method === 'HEAD') {
    return onRequestGet(context);
  }
  return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
}
