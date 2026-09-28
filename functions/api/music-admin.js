const REPO = 'segueix/musica';
const DATA_PATH = 'data/artistes-musica.json';
const GENRES_PATH = 'data/music-genres.json';
const BRANCH = 'main';
const MAX_CHANGES = 500;
const VALID_REVIEW = new Set(['pendent', 'aprovat', 'rebutjat']);

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

function sameSiteRequest(request) {
  const secFetchSite = request.headers.get('sec-fetch-site');
  if (secFetchSite && !['same-origin', 'same-site', 'none'].includes(secFetchSite)) return false;
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const requestUrl = new URL(request.url);
    const originUrl = new URL(origin);
    return originUrl.hostname === requestUrl.hostname
      || originUrl.hostname === 'segueix.cat'
      || originUrl.hostname.endsWith('.segueix.pages.dev');
  } catch {
    return false;
  }
}

function authorized(request, env) {
  const configured = String(env?.ANALYTICS_ADMIN_TOKEN || '').trim();
  if (!configured) return { ok: false, status: 503, error: 'Admin token is not configured' };
  const header = request.headers.get('authorization') || '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!supplied || supplied !== configured) return { ok: false, status: 401, error: 'Unauthorized' };
  return { ok: true };
}

function bytesToBase64(bytes) {
  let binary = '';
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + size, bytes.length)));
  }
  return btoa(binary);
}

function utf8ToBase64(text) {
  return bytesToBase64(new TextEncoder().encode(text));
}

function base64ToUtf8(value) {
  const binary = atob(String(value || '').replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function normalizeKey(value) {
  return String(value || '').trim().toLocaleLowerCase('ca');
}

function artistKeys(artist) {
  const keys = [];
  if (artist?.wikidataId) keys.push('wikidata:' + artist.wikidataId);
  for (const channel of artist?.youtube?.channels || []) {
    if (channel?.id) keys.push('youtube:' + channel.id);
  }
  if (artist?.name) keys.push('name:' + normalizeKey(artist.name));
  return keys;
}

function findArtist(db, change) {
  const wanted = String(change?.key || '');
  const byKey = db.artists.find(artist => artistKeys(artist).includes(wanted));
  if (byKey) return byKey;
  const name = normalizeKey(change?.name);
  return name ? db.artists.find(artist => normalizeKey(artist.name) === name) : null;
}

function validChannel(channel) {
  return channel && /^UC[A-Za-z0-9_-]{22}$/.test(String(channel.id || ''))
    && ['official', 'topic', 'label', 'other'].includes(String(channel.type || 'official'));
}

async function githubJson(path, token) {
  const response = await fetch('https://api.github.com/repos/' + REPO + '/contents/' + path + '?ref=' + BRANCH, {
    headers: {
      authorization: 'Bearer ' + token,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'Segueix-Music-Admin',
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || ('GitHub HTTP ' + response.status));
  return body;
}

export async function onRequestPost({ request, env }) {
  if (!sameSiteRequest(request)) return jsonResponse({ error: 'Origin not allowed' }, 403);

  const auth = authorized(request, env);
  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status, auth.status === 401 ? { 'www-authenticate': 'Bearer' } : {});
  }

  const githubToken = String(env?.GITHUB_MUSIC_ADMIN_TOKEN || '').trim();
  if (!githubToken) return jsonResponse({ error: 'GITHUB_MUSIC_ADMIN_TOKEN is not configured' }, 503);

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 1024 * 1024) return jsonResponse({ error: 'Payload too large' }, 413);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const changes = Array.isArray(payload?.changes) ? payload.changes : [];
  if (!changes.length || changes.length > MAX_CHANGES) return jsonResponse({ error: 'Invalid changes' }, 400);

  let dataFile;
  let taxonomyFile;
  try {
    [dataFile, taxonomyFile] = await Promise.all([
      githubJson(DATA_PATH, githubToken),
      githubJson(GENRES_PATH, githubToken),
    ]);
  } catch (error) {
    return jsonResponse({ error: 'GitHub read failed: ' + error.message }, 502);
  }

  let db;
  let taxonomy;
  try {
    db = JSON.parse(base64ToUtf8(dataFile.content));
    taxonomy = JSON.parse(base64ToUtf8(taxonomyFile.content));
  } catch {
    return jsonResponse({ error: 'Repository data is invalid JSON' }, 502);
  }

  const allowedGenres = new Set((taxonomy.categories || []).map(item => item.label));
  let applied = 0;
  const missing = [];

  for (const change of changes) {
    const artist = findArtist(db, change);
    if (!artist) {
      missing.push(change?.name || change?.key || 'unknown');
      continue;
    }

    if ('genres' in change) {
      if (!Array.isArray(change.genres) || change.genres.some(value => !allowedGenres.has(value))) {
        return jsonResponse({ error: 'Invalid genre for ' + artist.name }, 400);
      }
      artist.genres = [...new Set(change.genres)];
    }

    if ('reviewStatus' in change) {
      if (!VALID_REVIEW.has(change.reviewStatus)) return jsonResponse({ error: 'Invalid reviewStatus' }, 400);
      artist.reviewStatus = change.reviewStatus;
    }

    if ('active' in change) artist.active = Boolean(change.active);

    if ('youtubeChannels' in change) {
      if (!Array.isArray(change.youtubeChannels) || change.youtubeChannels.some(channel => !validChannel(channel))) {
        return jsonResponse({ error: 'Invalid YouTube channel for ' + artist.name }, 400);
      }
      artist.youtube ||= {};
      artist.youtube.channels = change.youtubeChannels.map((channel, index) => ({
        id: String(channel.id),
        handle: channel.handle ? String(channel.handle) : null,
        name: channel.name ? String(channel.name) : null,
        type: String(channel.type || 'official'),
        primary: index === 0 ? true : Boolean(channel.primary),
      }));
    }

    applied += 1;
  }

  if (!applied) return jsonResponse({ error: 'No matching artists found', missing }, 409);

  db.updatedAt = new Date().toISOString();
  const content = utf8ToBase64(JSON.stringify(db, null, 2) + '\n');

  const response = await fetch('https://api.github.com/repos/' + REPO + '/contents/' + DATA_PATH, {
    method: 'PUT',
    headers: {
      authorization: 'Bearer ' + githubToken,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'Segueix-Music-Admin',
    },
    body: JSON.stringify({
      message: 'data: actualitza revisió editorial des de l’admin',
      content,
      sha: dataFile.sha,
      branch: BRANCH,
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    return jsonResponse({
      error: response.status === 409
        ? 'La base ha canviat mentre desaves. Torna a provar-ho.'
        : 'GitHub write failed: ' + (result?.message || response.status),
    }, response.status === 409 ? 409 : 502);
  }

  return jsonResponse({
    ok: true,
    applied,
    missing,
    commit: result?.commit?.sha || null,
    updatedAt: db.updatedAt,
  });
}
