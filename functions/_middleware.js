const FALLBACK_YOUTUBER_AVATAR =
  'https://yt3.ggpht.com/EQRzSLoNFI8gFQT0FkJuAQ1SA7_Rh-3lrSsTazDQ2DwadIb-ti2TxgjERc7es6gKLZufHfhkUw=s800-c-k-c0x00ffffff-no-rj';

// Els valors acaben dins d'HTML injectat amb { html: true }: cal escapar-ho tot, no
// només les cometes. Alguns venen de la query (?programName=...) i podrien tancar
// l'atribut o obrir una etiqueta.
function escapeMeta(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function normalizeFeed(feedData) {
  const videos = Array.isArray(feedData)
    ? feedData
    : Array.isArray(feedData?.videos)
      ? feedData.videos
      : [];
  const channelsMap = feedData?.channels && typeof feedData.channels === 'object' ? feedData.channels : {};
  return { videos, channelsMap };
}

function parseJsonSafe(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// Implementació lleugera compatible amb LZString.decompressFromEncodedURIComponent
function decompressFromEncodedURIComponent(input) {
  if (input == null) return '';
  if (input === '') return null;
  const keyStrUriSafe = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$';

  const getBaseValue = (alphabet, character) => alphabet.indexOf(character);

  return _decompress(input.length, 32, (index) => getBaseValue(keyStrUriSafe, input.charAt(index)));
}

function _decompress(length, resetValue, getNextValue) {
  const dictionary = [];
  let next;
  let enlargeIn = 4;
  let dictSize = 4;
  let numBits = 3;
  let entry = '';
  const result = [];
  let i;
  let w;
  let bits;
  let resb;
  let maxpower;
  let power;
  let c;
  const data = { val: getNextValue(0), position: resetValue, index: 1 };

  for (i = 0; i < 3; i += 1) {
    dictionary[i] = i;
  }

  bits = 0;
  maxpower = 2 ** 2;
  power = 1;
  while (power !== maxpower) {
    resb = data.val & data.position;
    data.position >>= 1;
    if (data.position === 0) {
      data.position = resetValue;
      data.val = getNextValue(data.index++);
    }
    bits |= (resb > 0 ? 1 : 0) * power;
    power <<= 1;
  }

  switch (bits) {
    case 0:
      bits = 0;
      maxpower = 2 ** 8;
      power = 1;
      while (power !== maxpower) {
        resb = data.val & data.position;
        data.position >>= 1;
        if (data.position === 0) {
          data.position = resetValue;
          data.val = getNextValue(data.index++);
        }
        bits |= (resb > 0 ? 1 : 0) * power;
        power <<= 1;
      }
      c = String.fromCharCode(bits);
      break;
    case 1:
      bits = 0;
      maxpower = 2 ** 16;
      power = 1;
      while (power !== maxpower) {
        resb = data.val & data.position;
        data.position >>= 1;
        if (data.position === 0) {
          data.position = resetValue;
          data.val = getNextValue(data.index++);
        }
        bits |= (resb > 0 ? 1 : 0) * power;
        power <<= 1;
      }
      c = String.fromCharCode(bits);
      break;
    case 2:
      return '';
    default:
      c = '';
      break;
  }

  dictionary[3] = c;
  w = c;
  result.push(c);

  while (true) {
    if (data.index > length) {
      return '';
    }

    bits = 0;
    maxpower = 2 ** numBits;
    power = 1;
    while (power !== maxpower) {
      resb = data.val & data.position;
      data.position >>= 1;
      if (data.position === 0) {
        data.position = resetValue;
        data.val = getNextValue(data.index++);
      }
      bits |= (resb > 0 ? 1 : 0) * power;
      power <<= 1;
    }

    switch ((next = bits)) {
      case 0:
        bits = 0;
        maxpower = 2 ** 8;
        power = 1;
        while (power !== maxpower) {
          resb = data.val & data.position;
          data.position >>= 1;
          if (data.position === 0) {
            data.position = resetValue;
            data.val = getNextValue(data.index++);
          }
          bits |= (resb > 0 ? 1 : 0) * power;
          power <<= 1;
        }
        dictionary[dictSize++] = String.fromCharCode(bits);
        next = dictSize - 1;
        enlargeIn -= 1;
        break;
      case 1:
        bits = 0;
        maxpower = 2 ** 16;
        power = 1;
        while (power !== maxpower) {
          resb = data.val & data.position;
          data.position >>= 1;
          if (data.position === 0) {
            data.position = resetValue;
            data.val = getNextValue(data.index++);
          }
          bits |= (resb > 0 ? 1 : 0) * power;
          power <<= 1;
        }
        dictionary[dictSize++] = String.fromCharCode(bits);
        next = dictSize - 1;
        enlargeIn -= 1;
        break;
      case 2:
        return result.join('');
      default:
        break;
    }

    if (enlargeIn === 0) {
      enlargeIn = 2 ** numBits;
      numBits += 1;
    }

    if (dictionary[next]) {
      entry = dictionary[next];
    } else if (next === dictSize) {
      entry = w + w.charAt(0);
    } else {
      return null;
    }
    result.push(entry);

    dictionary[dictSize++] = w + entry.charAt(0);
    enlargeIn -= 1;

    w = entry;

    if (enlargeIn === 0) {
      enlargeIn = 2 ** numBits;
      numBits += 1;
    }
  }
}

function decodeImportPayload(importDataParam) {
  if (!importDataParam) return null;
  const decompressed = decompressFromEncodedURIComponent(importDataParam);
  if (!decompressed) return null;
  return parseJsonSafe(decompressed);
}

function resolveFirstVideoIdFromPayload(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : [];

  if (payload?.type === 'playlist') {
    const first = items.find((item) => typeof item === 'string' || typeof item === 'number');
    return first ? String(first) : null;
  }

  if (payload?.type === 'history') {
    const first = items.find((item) => item && typeof item === 'object' && item.id);
    return first?.id ? String(first.id) : null;
  }

  return null;
}

function resolveAvatarForChannel(channelId, channelsMap) {
  const channel = channelsMap?.[channelId];
  return channel?.avatar || null;
}

const YOUTUBE_ID_PATTERN = /^[\w-]{6,24}$/;

// Vídeos d'arxiu (els que ja no són a data/feed.json) no tenen metadades locals. En
// comptes de deixar-los amb les meta genèriques de l'index.html — que apunten
// og:url a la portada i fan que Android obri la pàgina general — demanem el títol
// real a l'oEmbed públic de YouTube (sense clau d'API).
async function fetchYoutubeOembed(videoId) {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`
    )}&format=json`;
    const response = await fetch(oembedUrl, {
      cf: { cacheTtl: 86400, cacheEverything: true },
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.title) return null;
    return {
      title: String(data.title),
      author: data.author_name ? String(data.author_name) : '',
      thumbnail: data.thumbnail_url ? String(data.thumbnail_url) : '',
      thumbnailWidth: data.thumbnail_width ? String(data.thumbnail_width) : '',
      thumbnailHeight: data.thumbnail_height ? String(data.thumbnail_height) : '',
    };
  } catch {
    return null;
  }
}

// La caràtula original del vídeo, de més resolució a menys. YouTube respon 404 a les
// mides que un vídeo no té (els antics sovint només tenen hqdefault), així que es
// comproven per ordre; hqdefault existeix sempre i fa d'últim recurs sense comprovar.
const THUMBNAIL_SIZES = [
  { file: 'maxresdefault.jpg', width: '1280', height: '720' },
  { file: 'sddefault.jpg', width: '640', height: '480' },
  { file: 'hqdefault.jpg', width: '480', height: '360' },
];

function buildThumbnailUrl(videoId, file) {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/${file}`;
}

async function thumbnailExists(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

function thumbnailSizeFromUrl(url) {
  const file = String(url || '')
    .split('?')[0]
    .split('/')
    .pop();
  return THUMBNAIL_SIZES.find((size) => size.file === file) || null;
}

// Els resultats es guarden a la cache del datacenter: resoldre un vídeo val una o dues
// subpeticions i, per als vídeos d'arxiu, llegir l'índex de cerca. Sense això es pagaria
// a cada visita de l'enllaç compartit.
function shareCacheKey(prefix, videoId) {
  return new Request(`https://segueix.cat/__${prefix}/${encodeURIComponent(videoId)}`);
}

async function readShareCache(prefix, videoId) {
  try {
    if (typeof caches === 'undefined' || !caches.default) return null;
    const hit = await caches.default.match(shareCacheKey(prefix, videoId));
    return hit ? await hit.json() : null;
  } catch {
    return null;
  }
}

function writeShareCache(prefix, videoId, value, waitUntil) {
  try {
    if (typeof caches === 'undefined' || !caches.default) return;
    const stored = caches.default.put(
      shareCacheKey(prefix, videoId),
      new Response(JSON.stringify(value), {
        headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=604800' },
      })
    );
    if (typeof waitUntil === 'function') waitUntil(stored);
  } catch {
    /* la cache és un extra: si falla, seguim */
  }
}

// Retorna la millor caràtula que el vídeo tingui de debò, sigui al feed o a l'arxiu.
// `preferida` és la miniatura que el feed o l'arxiu van desar: si ja és hqdefault vol dir
// que YouTube no en tenia cap de més gran i ens estalviem les comprovacions.
async function resolveOriginalThumbnail(videoId, waitUntil, preferida = '') {
  const cached = await readShareCache('caratula', videoId);
  if (cached?.image) return cached;

  const ultima = THUMBNAIL_SIZES[THUMBNAIL_SIZES.length - 1];
  const pista = thumbnailSizeFromUrl(preferida);
  const candidates = pista
    ? [pista, ...THUMBNAIL_SIZES.filter((size) => size.file !== pista.file)]
    : THUMBNAIL_SIZES;

  let resolved = {
    image: buildThumbnailUrl(videoId, ultima.file),
    width: ultima.width,
    height: ultima.height,
  };

  for (const size of candidates) {
    // hqdefault existeix sempre: si li toca el torn, ja no cal comprovar res més.
    if (size.file === ultima.file) {
      resolved = { image: buildThumbnailUrl(videoId, size.file), width: size.width, height: size.height };
      break;
    }
    const candidate = buildThumbnailUrl(videoId, size.file);
    if (await thumbnailExists(candidate)) {
      resolved = { image: candidate, width: size.width, height: size.height };
      break;
    }
  }

  writeShareCache('caratula', videoId, resolved, waitUntil);
  return resolved;
}

async function fetchAsset(env, request, assetPath) {
  const assetUrl = new URL(assetPath, request.url);
  const response = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
  return response.ok ? response : null;
}

// Els vídeos que ja no són al feed viuen a data/archive/channels/<canal>.json amb el
// títol, la descripció i la caràtula reals. Per saber de quin canal són es fa servir
// l'índex de cerca, que mapa id → canal: es recorren els fragments del més nou al més
// antic i es descarten sense parsejar si el text ni tan sols conté l'id.
async function lookupArchiveVideo(videoId, env, request, waitUntil) {
  const cached = await readShareCache('arxiu', videoId);
  if (cached) return cached.trobat ? cached : null;

  let resultat = { trobat: false };
  try {
    const manifestResponse = await fetchAsset(env, request, '/data/search_index_manifest.json');
    const manifest = manifestResponse ? await manifestResponse.json() : null;
    const buckets = Array.isArray(manifest?.buckets) ? manifest.buckets : [];

    let channelId = '';
    for (const bucket of buckets) {
      const file = String(bucket?.file || '').trim();
      if (!file || !/^search_index_[\w-]+\.json$/.test(file)) continue;

      const bucketResponse = await fetchAsset(env, request, `/data/${file}`);
      if (!bucketResponse) continue;
      const raw = await bucketResponse.text();
      if (!raw.includes(videoId)) continue;

      const entrades = parseJsonSafe(raw);
      const entrada = Array.isArray(entrades) ? entrades.find((item) => String(item?.i || '') === videoId) : null;
      if (entrada?.c) {
        channelId = String(entrada.c);
        break;
      }
    }

    if (channelId && /^[\w-]+$/.test(channelId)) {
      const archiveResponse = await fetchAsset(env, request, `/data/archive/channels/${channelId}.json`);
      const archive = archiveResponse ? await archiveResponse.json() : null;
      const videos = Array.isArray(archive?.videos) ? archive.videos : [];
      const video = videos.find((item) => String(item?.id || '') === videoId);
      if (video) {
        resultat = {
          trobat: true,
          title: String(video.title || ''),
          description: String(video.description || ''),
          thumbnail: String(video.thumbnail || ''),
          channelId: String(video.channelId || channelId),
          channelTitle: String(video.channelTitle || ''),
          isShort: Boolean(video.isShort),
        };
      }
    }
  } catch {
    resultat = { trobat: false };
  }

  writeShareCache('arxiu', videoId, resultat, waitUntil);
  return resultat.trobat ? resultat : null;
}

// Mateix tractament que al feed: una línia neta i retallada a 150 caràcters.
function buildShareDescription(rawDescription, author) {
  const net = String(rawDescription || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (net) {
    return net.length > 150 ? `${net.substring(0, 149)}…` : net;
  }
  return author ? `Vídeo ${catalanDe(author)} · Mira'l a Segueix.cat` : 'Mira aquest vídeo a Segueix.cat';
}

// "Can Nyero (I) - Segueix.cat [CAT]" ja porta la marca al títol de YouTube: evitem
// el "... - Segueix.cat - Segueix.cat".
function withSiteSuffix(title) {
  const clean = String(title || '').trim();
  if (!clean) return 'Segueix.cat';
  return /segueix\.cat/i.test(clean) ? clean : `${clean} - Segueix.cat`;
}

// "de Aleix" → "d'Aleix" (apostrofació catalana davant de vocal o hac).
function catalanDe(name) {
  const clean = String(name || '').trim();
  if (!clean) return '';
  return /^[aeiouàáèéíòóúüh]/i.test(clean) ? `d'${clean}` : `de ${clean}`;
}

function buildMetaTags({ title, description, image, imageWidth = '800', imageHeight = '800', url, type }) {
  return {
    'og:title': title,
    'og:description': description,
    'og:image': image,
    'og:image:width': imageWidth,
    'og:image:height': imageHeight,
    'og:url': url,
    'og:type': type,
    'twitter:title': title,
    'twitter:description': description,
    'twitter:image': image,
    'twitter:card': 'summary_large_image',
    description,
  };
}

function injectMetaTags(response, tags) {
  const documentTitle = tags['og:title'];
  return new HTMLRewriter()
    .on('meta', {
      element(element) {
        const key = element.getAttribute('property') || element.getAttribute('name');
        if (key && (key.startsWith('og:') || key.startsWith('twitter:') || key === 'description')) {
          element.remove();
        }
      },
    })
    // El <title> també s'ha de correspondre amb el que es comparteix: hi ha clients
    // (i el full de compartició d'Android) que l'usen en comptes de l'og:title.
    .on('title', {
      element(element) {
        if (documentTitle) {
          element.setInnerContent(documentTitle);
        }
      },
    })
    .on('head', {
      element(element) {
        for (const [key, value] of Object.entries(tags)) {
          const attr = key.startsWith('og:') ? 'property' : 'name';
          element.prepend(`<meta ${attr}="${key}" content="${escapeMeta(value)}" />`, { html: true });
        }
      },
    })
    .transform(response);
}

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const videoId = url.searchParams.get('v');
  const importDataParam = url.searchParams.get('importData');
  const channelId = url.searchParams.get('channel');
  const programId = url.searchParams.get('program');
  const programName = url.searchParams.get('programName');

  const response = await next();
  const res = new Response(response.body, response);
  const contentType = res.headers.get('content-type') || '';

  if (!contentType.includes('text/html')) {
    return res;
  }

  // Sense cap paràmetre de compartició no cal llegir el feed (7 MB): les meta
  // estàtiques de l'index.html ja són les correctes per a la portada.
  if (!videoId && !importDataParam && !channelId && !programId) {
    return res;
  }

  try {
    const feedUrl = new URL('/data/feed.json', request.url);
    const feedResponse = await env.ASSETS.fetch(new Request(feedUrl.toString(), request));
    const feedData = feedResponse.ok ? await feedResponse.json() : null;
    const { videos, channelsMap } = normalizeFeed(feedData);

    // Cas 1: vídeo individual (?v=)
    if (videoId) {
      const targetVideo = videos.find((item) => String(item?.id || '') === String(videoId));

      // Vídeo fora del feed (arxiu, resultats de cerca antics...): mai el deixem caure
      // a les meta genèriques, perquè l'og:url de l'index.html apunta a la portada i
      // Android acaba obrint la pàgina general en comptes del vídeo compartit.
      if (!targetVideo) {
        if (!YOUTUBE_ID_PATTERN.test(String(videoId))) return res;

        const waitUntil = context.waitUntil?.bind(context);

        // L'arxiu té el títol, la descripció i la caràtula reals. Només si el vídeo
        // tampoc no hi és (per exemple, un enllaç a un vídeo que no hem indexat mai) es
        // recorre a l'oEmbed de YouTube, que dona títol i canal però no descripció.
        const archived = await lookupArchiveVideo(videoId, env, request, waitUntil);
        const oembed = archived ? null : await fetchYoutubeOembed(videoId);

        const rawTitle = archived?.title || oembed?.title || '';
        const fallbackTitle = rawTitle ? withSiteSuffix(rawTitle) : 'Vídeo a Segueix.cat';
        const fallbackDesc = buildShareDescription(
          archived?.description,
          archived?.channelTitle || oembed?.author || ''
        );

        // L'oEmbed només retorna hqdefault (480x360, amb bandes negres): busquem la
        // caràtula original perquè el vídeo d'arxiu es comparteixi igual de bé que un
        // del feed.
        const archiveThumb = archived?.isShort
          ? { image: buildThumbnailUrl(videoId, 'oar2.jpg'), width: '1080', height: '1920' }
          : await resolveOriginalThumbnail(videoId, waitUntil, archived?.thumbnail || '');

        const fallbackTags = buildMetaTags({
          title: fallbackTitle,
          description: fallbackDesc,
          image: archiveThumb.image,
          imageWidth: archiveThumb.width,
          imageHeight: archiveThumb.height,
          url: url.toString(),
          type: 'video.other',
        });
        return injectMetaTags(res, fallbackTags);
      }

      const isShort = Boolean(targetVideo.isShort);
      const baseTitle = targetVideo.title || 'Vídeo';
      const title = withSiteSuffix(`${isShort ? '⚡ Short - ' : ''}${baseTitle}`);
      const desc = buildShareDescription(targetVideo.description, targetVideo.channelTitle);

      // El feed guarda la miniatura en el moment de sincronitzar i no totes les mides
      // existeixen a tots els vídeos: si hi apuntéssim a cegues, un maxresdefault
      // inexistent deixaria la previsualització sense imatge i un hqdefault s'anunciaria
      // amb mides que no són les seves. Per això es resol igual que als vídeos d'arxiu.
      // Els Shorts mantenen la caràtula vertical.
      const customThumbnail =
        targetVideo.thumbnail && !/(^|\/\/)i\.ytimg\.com\//.test(targetVideo.thumbnail)
          ? String(targetVideo.thumbnail)
          : '';
      let image = `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/oar2.jpg`;
      let imageWidth = '1080';
      let imageHeight = '1920';

      if (!isShort) {
        if (customThumbnail) {
          image = customThumbnail;
          imageWidth = '1280';
          imageHeight = '720';
        } else {
          const resolved = await resolveOriginalThumbnail(
            videoId,
            context.waitUntil?.bind(context),
            targetVideo.thumbnail || ''
          );
          image = resolved.image;
          imageWidth = resolved.width;
          imageHeight = resolved.height;
        }
      }

      const tags = buildMetaTags({
        title,
        description: desc,
        image,
        imageWidth,
        imageHeight,
        url: url.toString(),
        type: 'video.other',
      });
      return injectMetaTags(res, tags);
    }

    // Cas 2: compartició ràpida (?importData=...)
    if (importDataParam) {
      const payload = decodeImportPayload(importDataParam);
      if (!payload) return res;

      const typeLabels = {
        playlist: 'Llista',
        category: 'Categoria',
        history: 'Visualitzacions',
      };
      const typeLabel = typeLabels[payload.type] || 'Col·lecció';
      const name = String(payload.name || 'Sense nom').trim();
      const title = `${typeLabel}: ${name || 'Sense nom'} - Segueix.cat`;

      const firstVideo =
        payload?.type === 'category'
          ? null
          : (() => {
              const firstVideoId = resolveFirstVideoIdFromPayload(payload);
              return firstVideoId
                ? videos.find((item) => String(item?.id || '') === firstVideoId) || null
                : null;
            })();

      // Si el primer vídeo de la llista o de l'historial ja no és al feed (cas habitual
      // a l'historial, que guarda vídeos vells), es busca a l'arxiu per poder resoldre'n
      // el canal; si no, la previsualització queia sempre a l'avatar genèric.
      let resolvedChannelId =
        payload?.type === 'category'
          ? Array.isArray(payload?.items) && payload.items.length > 0
            ? String(payload.items[0])
            : ''
          : String(firstVideo?.channelId || '');

      if (!resolvedChannelId && payload?.type !== 'category') {
        const firstVideoId = resolveFirstVideoIdFromPayload(payload);
        if (firstVideoId && YOUTUBE_ID_PATTERN.test(firstVideoId)) {
          const archivedFirst = await lookupArchiveVideo(
            firstVideoId,
            env,
            request,
            context.waitUntil?.bind(context)
          );
          resolvedChannelId = String(archivedFirst?.channelId || '');
        }
      }

      const avatar = resolveAvatarForChannel(resolvedChannelId, channelsMap) || FALLBACK_YOUTUBER_AVATAR;
      const itemCount = Array.isArray(payload?.items) ? payload.items.length : 0;
      const desc = `${typeLabel} compartida a Segueix.cat · ${itemCount} elements`;

      const tags = buildMetaTags({
        title,
        description: desc,
        image: avatar,
        imageWidth: '800',
        imageHeight: '800',
        url: url.toString(),
        type: 'profile',
      });
      return injectMetaTags(res, tags);
    }

    // Cas 3: compartició de canal o programa (?channel=... o ?program=...)
    if (channelId || programId) {
      const channel = channelsMap?.[channelId] || null;
      const channelName = channel?.name || 'Canal';

      let title = `Canal: ${channelName} - Segueix.cat`;
      let desc = channel?.description
        ? channel.description.replace(/\s+/g, ' ').trim().slice(0, 155)
        : `Descobreix el canal ${channelName} a Segueix.cat`;

      if (programId) {
          const progName = programName || 'Programa';
          title = `Programa: ${progName} - Segueix.cat`;
          desc = `Programa del canal ${channelName} a Segueix.cat`;
      }

      const avatar = channel?.avatar || FALLBACK_YOUTUBER_AVATAR;

      const tags = buildMetaTags({
        title,
        description: desc,
        image: avatar,
        imageWidth: '800',
        imageHeight: '800',
        url: url.toString(),
        type: 'profile',
      });
      return injectMetaTags(res, tags);
    }

    return res;
  } catch {
    return res;
  }
}
