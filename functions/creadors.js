import { buildCreatorRecords, creatorUrl } from './_lib/creator-slugs.js';

const SITE_URL = 'https://segueix.cat';

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

function firstCategory(channel) {
  const categories = Array.isArray(channel?.categories)
    ? channel.categories
    : channel?.category
      ? [channel.category]
      : [];
  return String(categories.find(Boolean) || '').trim();
}

async function fetchChannels(context) {
  const assetUrl = new URL('/js/channels-ca.json', context.request.url);
  const response = await context.env.ASSETS.fetch(new Request(assetUrl.toString(), context.request));
  if (!response.ok) return [];
  try {
    const data = await response.json();
    return Array.isArray(data?.channels) ? data.channels : [];
  } catch {
    return [];
  }
}

export async function onRequestGet(context) {
  const creators = buildCreatorRecords(await fetchChannels(context)).sort((a, b) =>
    a.name.localeCompare(b.name, 'ca', { sensitivity: 'base' })
  );
  const canonical = `${SITE_URL}/creadors`;
  const description = `Directori de ${creators.length} creadors i canals de contingut en català a Segueix.cat.`;

  const cards = creators
    .map((creator) => {
      const category = firstCategory(creator);
      return `<article class="creator-card"><a href="/creador/${encodeURIComponent(creator.slug)}"><strong>${escapeHtml(creator.name)}</strong>${category ? `<span>${escapeHtml(category)}</span>` : ''}</a></article>`;
    })
    .join('');

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${canonical}#webpage`,
    url: canonical,
    name: 'Creadors de contingut en català - Segueix.cat',
    description,
    inLanguage: 'ca',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: creators.length,
      itemListElement: creators.map((creator, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: creator.name,
        url: creatorUrl(creator, SITE_URL),
      })),
    },
  };

  const html = `<!doctype html>
<html lang="ca">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Creadors de contingut en català | Segueix.cat</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <link rel="canonical" href="${canonical}">
  <meta property="og:locale" content="ca_ES">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Segueix.cat">
  <meta property="og:title" content="Creadors de contingut en català - Segueix.cat">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${SITE_URL}/img/caratula.png">
  <meta name="twitter:card" content="summary_large_image">
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
    .intro { padding: 48px 0 28px; }
    h1 { margin: 0; font-size: clamp(2rem, 5vw, 3.5rem); }
    .intro p { max-width: 760px; color: #cbd3df; line-height: 1.6; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; padding-bottom: 56px; }
    .creator-card { min-width: 0; }
    .creator-card a { min-height: 82px; display: flex; flex-direction: column; justify-content: center; gap: 7px; padding: 15px; border: 1px solid #2a2f38; border-radius: 12px; background: #171c24; text-decoration: none; }
    .creator-card a:hover, .creator-card a:focus-visible { border-color: #7e8998; }
    .creator-card strong { overflow-wrap: anywhere; }
    .creator-card span { color: #99a4b4; font-size: .84rem; }
    footer { border-top: 1px solid #2a2f38; padding: 24px 0 36px; color: #96a1b1; }
    @media (prefers-color-scheme: light) {
      body { background: #f6f7f9; color: #11151c; }
      header { background: #fff; border-color: #e1e5ea; }
      .intro p { color: #536070; }
      .creator-card a { background: #fff; border-color: #e1e5ea; }
      .creator-card span, footer { color: #647082; }
      footer { border-color: #e1e5ea; }
    }
  </style>
</head>
<body>
  <header><div class="shell"><a class="brand" href="/">Segueix.cat</a><a href="/#segueix">Obre l'app</a></div></header>
  <main class="shell">
    <section class="intro">
      <h1>Creadors de contingut en català</h1>
      <p>${escapeHtml(description)} Cada creador disposa d'una fitxa pròpia amb els seus vídeos més recents.</p>
    </section>
    <section class="grid" aria-label="Directori de creadors">${cards}</section>
  </main>
  <footer><div class="shell"><a href="/">Segueix.cat</a> · Continguts en català</div></footer>
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
