import { buildCreatorRecords, creatorUrl } from './creator-slugs.js';
import { VIDEO_ID_PATTERN, videoUrl } from './video-slugs.js';

const SITE_URL = 'https://segueix.cat';
const FALLBACK_IMAGE = `${SITE_URL}/img/caratula.png`;
const VIDEO_LIMIT = 24;
const CREATOR_LIMIT = 18;

export const SEO_SECTIONS = {
  novetats: { path:'/novetats', label:'Novetats', shortTitle:'Novetats', title:'Novetats de música en català', description:'Les últimes cançons, videoclips, directes i sessions dels artistes de Segueix Música.', category:'' },
  descobreix: { path:'/descobreix', label:'Descobreix', shortTitle:'Descobreix', title:'Descobreix música en català', description:'Descobreix artistes i música en català de diferents estils.', category:'' },
  pop: { path:'/pop', label:'Pop', shortTitle:'Pop', title:'Pop en català', description:'Artistes, cançons i videoclips de pop en català.', category:'Pop' },
  rock: { path:'/rock', label:'Rock', shortTitle:'Rock', title:'Rock en català', description:'Rock en català: grups, cançons, videoclips i directes.', category:'Rock' },
  indie: { path:'/indie', label:'Indie', shortTitle:'Indie', title:'Indie en català', description:'Música indie i alternativa en català.', category:'Indie' },
  urbana: { path:'/urbana', label:'Urbana', shortTitle:'Urbana', title:'Música urbana en català', description:'Música urbana en català i artistes de l’escena actual.', category:'Urbana' },
  'rap-hip-hop': { path:'/rap-hip-hop', label:'Rap / Hip-hop', shortTitle:'Rap / Hip-hop', title:'Rap i hip-hop en català', description:'Rap i hip-hop en català.', category:'Rap / Hip-hop' },
  'folk-arrel': { path:'/folk-arrel', label:'Folk i arrel', shortTitle:'Folk i arrel', title:'Folk i música d’arrel en català', description:'Folk, música tradicional i música d’arrel en català.', category:'Folk i arrel' },
  'canco-autor': { path:'/canco-autor', label:"Cançó d'autor", shortTitle:"Cançó d'autor", title:"Cançó d'autor en català", description:"Cantautors i cançó d'autor en català.", category:"Cançó d'autor" },
  electronica: { path:'/electronica', label:'Electrònica', shortTitle:'Electrònica', title:'Música electrònica en català', description:'Electrònica, sessions i producció musical en català.', category:'Electrònica' },
  'ska-reggae': { path:'/ska-reggae', label:'Ska / Reggae', shortTitle:'Ska / Reggae', title:'Ska i reggae en català', description:'Ska i reggae en català.', category:'Ska / Reggae' },
  'rumba-mestissatge': { path:'/rumba-mestissatge', label:'Rumba / Mestissatge', shortTitle:'Rumba / Mestissatge', title:'Rumba i mestissatge en català', description:'Rumba i mestissatge de l’escena catalana.', category:'Rumba / Mestissatge' },
  punk: { path:'/punk', label:'Punk', shortTitle:'Punk', title:'Punk en català', description:'Grups i cançons de punk en català.', category:'Punk' },
  'heavy-metal': { path:'/heavy-metal', label:'Heavy / Metal', shortTitle:'Heavy / Metal', title:'Heavy i metal en català', description:'Grups i cançons de heavy i metal en català.', category:'Heavy / Metal' },
  'jazz-blues': { path:'/jazz-blues', label:'Jazz / Blues', shortTitle:'Jazz / Blues', title:'Jazz i blues en català', description:'Jazz i blues de l’escena musical catalana.', category:'Jazz / Blues' },
  classica: { path:'/classica', label:'Clàssica', shortTitle:'Clàssica', title:'Música clàssica catalana', description:'Música clàssica, contemporània, coral i vocal.', category:'Clàssica' },
  infantil: { path:'/infantil', label:'Infantil', shortTitle:'Infantil', title:'Música infantil en català', description:'Cançons i artistes de música infantil en català.', category:'Infantil' },
  'altres-estils': { path:'/altres-estils', label:'Altres estils', shortTitle:'Altres estils', title:'Altres estils de música en català', description:'Funk, soul, R&B, experimental i altres estils.', category:'Altres estils' },
  'musica-tv': { path:'/musica-tv', label:'Música TV', shortTitle:'Música TV', title:'Música TV · música en català en reproducció contínua', description:'Una selecció contínua de música en català per descobrir artistes i cançons.', category:'', tv:true }
};

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

function normalize(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function safeHttpUrl(value, fallback = '') {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

function feedVideos(data) {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.videos) ? data.videos : [];
}

function channelCategories(channel) {
  const values = Array.isArray(channel?.categories)
    ? channel.categories
    : channel?.category
      ? [channel.category]
      : [];
  return values.map(normalize).filter(Boolean);
}

function videoCategories(video) {
  const values = [
    ...(Array.isArray(video?.categories) ? video.categories : []),
    ...(video?.category ? [video.category] : []),
  ];
  return values.map(normalize).filter(Boolean);
}

function matchesSection(video, section, channelsById) {
  if (!section.category) return true;
  const category = normalize(section.category);
  if (videoCategories(video).includes(category)) return true;
  const channel = channelsById.get(String(video?.channelId || ''));
  return channel ? channelCategories(channel).includes(category) : false;
}

function sortVideos(videos) {
  return [...videos].sort((a, b) => {
    const aTime = Date.parse(a?.publishedAt || '') || 0;
    const bTime = Date.parse(b?.publishedAt || '') || 0;
    return bTime - aTime;
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

function relatedCreators(creators, videos, section) {
  const videoChannelIds = new Set(videos.map((video) => String(video?.channelId || '')).filter(Boolean));
  const category = normalize(section.category);
  const filtered = creators.filter((creator) => {
    if (videoChannelIds.has(String(creator.id))) return true;
    return category ? channelCategories(creator).includes(category) : false;
  });
  return filtered
    .sort((a, b) => {
      const aInVideos = videoChannelIds.has(String(a.id)) ? 1 : 0;
      const bInVideos = videoChannelIds.has(String(b.id)) ? 1 : 0;
      return bInVideos - aInVideos || a.name.localeCompare(b.name, 'ca', { sensitivity: 'base' });
    })
    .slice(0, CREATOR_LIMIT);
}

function sectionNavigation(activeKey) {
  const links = [
    ['creadors', '/creadors', 'Creadors'],
    ...Object.entries(SEO_SECTIONS).map(([key, section]) => [key, section.path, section.shortTitle]),
  ];
  return links
    .map(([key, href, label]) =>
      `<a href="${href}"${key === activeKey ? ' aria-current="page"' : ''}>${escapeHtml(label)}</a>`
    )
    .join('');
}

function videoCards(videos) {
  if (!videos.length) {
    return '<p class="empty">Encara no hi ha vídeos disponibles en aquesta secció.</p>';
  }
  return videos.map((video) => {
    const href = videoUrl(video, SITE_URL);
    if (!href) return '';
    const title = escapeHtml(video.title || 'Vídeo');
    const thumbnail = escapeHtml(
      safeHttpUrl(video.thumbnail, `https://i.ytimg.com/vi/${encodeURIComponent(video.id)}/hqdefault.jpg`)
    );
    const channel = escapeHtml(video.channelTitle || '');
    const date = formatDate(video.publishedAt);
    const meta = [channel, date].filter(Boolean).join(' · ');
    return `<article class="video-card"><a href="${escapeHtml(href)}"><img src="${thumbnail}" alt="${title}" loading="lazy" width="480" height="270"><div class="video-copy"><h2>${title}</h2>${meta ? `<p>${escapeHtml(meta)}</p>` : ''}</div></a></article>`;
  }).join('');
}

function creatorCards(creators) {
  if (!creators.length) return '';
  return creators.map((creator) => {
    const category = channelCategories(creator)[0] || '';
    return `<article class="creator-card"><a href="${escapeHtml(creatorUrl(creator, SITE_URL))}"><strong>${escapeHtml(creator.name)}</strong>${category ? `<span>${escapeHtml(category)}</span>` : ''}</a></article>`;
  }).join('');
}

export async function renderSeoSection(context, key) {
  const section = SEO_SECTIONS[key];
  if (!section) return new Response('Not Found', { status: 404 });

  const [feedData, channelsData, artistsData] = await Promise.all([
    fetchJsonAsset(context, '/data/feed.json'),
    fetchJsonAsset(context, '/js/channels-ca.json'),
    fetchJsonAsset(context, '/data/artistes-musica.json'),
  ]);

  const rawChannels = Array.isArray(channelsData?.channels) ? channelsData.channels : [];
  const artistCategoriesByChannel = new Map();
  const genreGroups = {
    'Pop':['Pop'], 'Rock':['Rock'], 'Indie':['Indie / Alternativa'], 'Urbana':['Urbana'],
    'Rap / Hip-hop':['Rap / Hip-hop'], 'Folk i arrel':['Folk i arrel'], "Cançó d'autor":["Cançó d'autor"],
    'Electrònica':['Electrònica'], 'Ska / Reggae':['Ska / Reggae'], 'Rumba / Mestissatge':['Rumba / Mestissatge'],
    'Punk':['Punk'], 'Heavy / Metal':['Metal'], 'Jazz / Blues':['Jazz / Blues'],
    'Clàssica':['Clàssica i contemporània','Coral / Vocal'], 'Infantil':['Infantil'],
    'Altres estils':['Funk / Soul / R&B','Experimental / Avantguarda','Altres']
  };
  for (const artist of artistsData?.artists || []) {
    const genres = new Set(artist.genres || []);
    const categories = Object.entries(genreGroups).filter(([,source]) => source.some(genre => genres.has(genre))).map(([label]) => label);
    for (const channel of artist.youtube?.channels || []) {
      artistCategoriesByChannel.set(String(channel.id || ''), categories);
    }
  }
  const enrichedChannels = rawChannels.map(channel => ({
    ...channel,
    categories: [...new Set([...(Array.isArray(channel.categories) ? channel.categories : []), ...(artistCategoriesByChannel.get(String(channel.id || '')) || [])])]
  }));
  const channelsById = new Map(enrichedChannels.map((channel) => [String(channel?.id || ''), channel]));
  const allVideos = feedVideos(feedData)
    .filter((video) => VIDEO_ID_PATTERN.test(String(video?.id || '')))
    .filter((video) => matchesSection(video, section, channelsById));
  const videos = sortVideos(allVideos).slice(0, VIDEO_LIMIT);
  const creators = relatedCreators(
    buildCreatorRecords(enrichedChannels),
    videos,
    section
  );

  const canonical = `${SITE_URL}${section.path}`;
  const image = safeHttpUrl(videos[0]?.thumbnail, FALLBACK_IMAGE) || FALLBACK_IMAGE;
  const appHref = section.tv ? '/#segueix' : '/#segueix';
  const description = section.description;
  const itemList = videos
    .map((video, index) => {
      const url = videoUrl(video, SITE_URL);
      if (!url) return null;
      return {
        '@type': 'ListItem',
        position: index + 1,
        name: String(video.title || 'Vídeo'),
        url,
      };
    })
    .filter(Boolean);

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: section.title,
        description,
        inLanguage: 'ca',
        isPartOf: {
          '@type': 'WebSite',
          '@id': `${SITE_URL}/#website`,
          name: 'Segueix!',
          alternateName: 'Segueix.cat',
          url: `${SITE_URL}/`,
          inLanguage: 'ca',
        },
        breadcrumb: { '@id': `${canonical}#breadcrumb` },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: itemList.length,
          itemListElement: itemList,
        },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Segueix.cat', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: section.shortTitle, item: canonical },
        ],
      },
    ],
  };

  const html = `<!doctype html>
<html lang="ca">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(section.title)} | Segueix.cat</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index,follow,max-image-preview:large,max-video-preview:-1">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:locale" content="ca_ES">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Segueix!">
  <meta property="og:title" content="${escapeHtml(section.title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(section.title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <script type="application/ld+json">${jsonLd(structuredData)}</script>
  <style>
    :root{color-scheme:light dark;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    *{box-sizing:border-box}body{margin:0;background:#0f1115;color:#f5f7fa}a{color:inherit}
    .shell{width:min(1180px,calc(100% - 32px));margin:0 auto}
    header{border-bottom:1px solid #2a2f38;background:#151922;position:sticky;top:0;z-index:5}
    header .shell{min-height:64px;display:flex;align-items:center;justify-content:space-between;gap:18px}
    .brand{font-size:1.2rem;font-weight:850;text-decoration:none}.top{display:flex;gap:14px;align-items:center;flex-wrap:wrap}
    .top a{font-size:.9rem}.intro{padding:48px 0 24px}.eyebrow{margin:0 0 8px;color:#98a4b5;font-weight:750}
    h1{margin:0;font-size:clamp(2rem,5vw,3.5rem);line-height:1.04}.intro p{max-width:820px;color:#cbd3df;line-height:1.65}
    .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.button{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:10px;background:#f5f7fa;color:#11151c;text-decoration:none;font-weight:800}
    .section-title{margin:28px 0 15px;font-size:1.45rem}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}
    .video-card,.creator-card{border:1px solid #2a2f38;border-radius:14px;background:#171c24;overflow:hidden}.video-card a,.creator-card a{display:block;text-decoration:none}
    .video-card img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:#222}.video-copy{padding:12px 13px 14px}
    .video-copy h2{margin:0;font-size:1rem;line-height:1.35}.video-copy p{margin:8px 0 0;color:#99a4b4;font-size:.82rem}
    .creator-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px;margin-bottom:42px}.creator-card a{padding:14px;min-height:78px;display:flex;flex-direction:column;justify-content:center;gap:6px}
    .creator-card span{color:#99a4b4;font-size:.8rem}.explore{display:flex;gap:8px;flex-wrap:wrap;padding:32px 0 48px}.explore a{padding:8px 11px;border:1px solid #2a2f38;border-radius:999px;text-decoration:none;font-size:.88rem}
    .explore a[aria-current="page"]{background:#f5f7fa;color:#11151c}.empty{color:#99a4b4}
    footer{border-top:1px solid #2a2f38;padding:24px 0 36px;color:#96a1b1}
    @media(prefers-color-scheme:light){body{background:#f6f7f9;color:#11151c}header{background:#fff;border-color:#e1e5ea}.intro p{color:#536070}.video-card,.creator-card{background:#fff;border-color:#e1e5ea}.video-copy p,.creator-card span,footer{color:#647082}.explore a{border-color:#d9dee6}.explore a[aria-current="page"]{background:#11151c;color:#fff}}
  </style>
</head>
<body>
  <header><div class="shell"><a class="brand" href="/">Segueix!</a><nav class="top"><a href="/creadors">Artistes</a><a href="/novetats">Novetats</a><a href="/pop">Pop</a><a href="/rock">Rock</a></nav></div></header>
  <main class="shell">
    <section class="intro">
      <p class="eyebrow">Vídeos i creadors en català</p>
      <h1>${escapeHtml(section.title)}</h1>
      <p>${escapeHtml(description)}</p>
      <div class="actions"><a class="button" href="${appHref}">Obre Segueix!</a><a class="button" href="/creadors">Explora creadors</a></div>
    </section>
    <section aria-labelledby="latest-videos">
      <h2 class="section-title" id="latest-videos">${section.tv ? 'Vídeos per descobrir' : 'Vídeos recents'}</h2>
      <div class="grid">${videoCards(videos)}</div>
    </section>
    ${creators.length ? `<section aria-labelledby="section-creators"><h2 class="section-title" id="section-creators">Creadors relacionats</h2><div class="creator-grid">${creatorCards(creators)}</div></section>` : ''}
    <nav class="explore" aria-label="Explora les seccions de Segueix">${sectionNavigation(key)}</nav>
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

export function handleSeoSectionRequest(context, key) {
  if (context.request.method === 'GET' || context.request.method === 'HEAD') {
    return renderSeoSection(context, key);
  }
  return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
}
