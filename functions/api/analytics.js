const EVENT_TTL_SECONDS = 60 * 60 * 24 * 90;
const MAX_SUMMARY_DAYS = 90;

const ALLOWED_EVENTS = new Set([
  'app_open',
  'video_open',
  'search_used',
  'follow_toggle',
  'like_toggle',
  'category_open',
  'smart_feed_rendered',
  'tv_start',
  'tv_next',
  'tv_regenerate',
  'continue_watching_open',
]);

const ALLOWED_CONTEXT_VALUES = {
  surface: new Set(['home', 'watch', 'tv', 'search', 'follow', 'library', 'history', 'channel', 'other']),
  device: new Set(['mobile', 'desktop']),
  category: new Set(['novetats', 'vida', 'cultura', 'diversio', 'el_mon', 'gaming', 'seguint', 'radar', 'tot', 'custom', 'other']),
  tvMode: new Set(['segueix', 'category', 'channel', 'program', 'playlist', 'other']),
  state: new Set(['on', 'off']),
};

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

function emptyResponse(status = 204) {
  return new Response(null, {
    status,
    headers: {
      'cache-control': 'no-store',
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
    if (originUrl.hostname === requestUrl.hostname) return true;
    if (originUrl.hostname === 'segueix.cat') return true;
    if (originUrl.hostname.endsWith('.segueix.pages.dev')) return true;
    return false;
  } catch {
    return false;
  }
}

function sanitizeContext(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const clean = {};

  for (const [key, allowed] of Object.entries(ALLOWED_CONTEXT_VALUES)) {
    const value = String(raw[key] || '').trim();
    if (allowed.has(value)) clean[key] = value;
  }

  return clean;
}

function utcBuckets(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');
  return {
    day: `${year}-${month}-${day}`,
    hour,
  };
}

function randomSuffix() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

function validClientId(value) {
  return /^[a-f0-9]{32}$/.test(String(value || '').trim());
}

async function hashClientId(clientId) {
  if (!validClientId(clientId)) return '';
  const bytes = new TextEncoder().encode(String(clientId).trim());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

async function writeEvent(env, eventName, context, clientHash = '') {
  const buckets = utcBuckets();

  if (env?.SEGUEIX_ANALYTICS?.writeDataPoint) {
    env.SEGUEIX_ANALYTICS.writeDataPoint({
      blobs: [
        eventName,
        context.surface || 'other',
        context.device || 'desktop',
        context.category || 'other',
        context.tvMode || 'other',
        context.state || 'off',
        clientHash || 'anonymous',
      ],
      doubles: [1],
      indexes: [buckets.day],
    });
    return 'analytics-engine';
  }

  if (!env?.SEGUEIX_SYNC) {
    throw new Error('No analytics storage configured');
  }

  const dims = [
    `d-${context.device || 'desktop'}`,
    `s-${context.surface || 'other'}`,
    `c-${context.category || 'other'}`,
    `t-${context.tvMode || 'other'}`,
    `x-${context.state || 'off'}`,
    ...(clientHash ? [`u-${clientHash}`] : []),
  ];
  const key = `analytics:v1:${buckets.day}:${eventName}:${buckets.hour}:${dims.join(':')}:${randomSuffix()}`;
  await env.SEGUEIX_SYNC.put(
    key,
    JSON.stringify({
      event: eventName,
      day: buckets.day,
      hour: buckets.hour,
      context,
    }),
    { expirationTtl: EVENT_TTL_SECONDS }
  );
  return 'kv';
}

function parseDays(url) {
  const requested = Number(url.searchParams.get('days') || 30);
  if (!Number.isFinite(requested)) return 30;
  return Math.max(1, Math.min(MAX_SUMMARY_DAYS, Math.floor(requested)));
}

function parseIsoDay(value) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || utcBuckets(date).day !== raw) return null;
  return date;
}

function resolveDateRange(url) {
  const fromRaw = url.searchParams.get('from');
  const toRaw = url.searchParams.get('to');

  if (fromRaw || toRaw) {
    const fromDate = parseIsoDay(fromRaw);
    const toDate = parseIsoDay(toRaw);
    if (!fromDate || !toDate) {
      return { error: 'Invalid date range' };
    }
    if (fromDate.getTime() > toDate.getTime()) {
      return { error: 'Start date must not be after end date' };
    }

    const today = parseIsoDay(utcBuckets().day);
    if (toDate.getTime() > today.getTime()) {
      return { error: 'End date must not be in the future' };
    }

    const days = Math.floor((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
    if (days > MAX_SUMMARY_DAYS) {
      return { error: `Date range cannot exceed ${MAX_SUMMARY_DAYS} days` };
    }

    return {
      from: utcBuckets(fromDate).day,
      to: utcBuckets(toDate).day,
      days,
    };
  }

  const days = parseDays(url);
  const toDate = parseIsoDay(utcBuckets().day);
  const fromDate = new Date(toDate.getTime() - (days - 1) * 86400000);
  return {
    from: utcBuckets(fromDate).day,
    to: utcBuckets(toDate).day,
    days,
  };
}

function enumerateDays(from, to) {
  const days = [];
  const start = parseIsoDay(from);
  const end = parseIsoDay(to);
  for (let time = start.getTime(); time <= end.getTime(); time += 86400000) {
    days.push(utcBuckets(new Date(time)).day);
  }
  return days;
}

async function listAllByPrefix(kv, prefix) {
  const keys = [];
  let cursor;
  do {
    const page = await kv.list({ prefix, cursor, limit: 1000 });
    keys.push(...(page.keys || []));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return keys;
}

function bump(target, key) {
  if (!key) return;
  target[key] = (target[key] || 0) + 1;
}

function parseDimension(parts, prefix) {
  const hit = parts.find(part => part.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : '';
}

async function buildKvSummary(kv, range) {
  const daily = [];
  const totals = {};
  const dimensions = {
    device: {},
    surface: {},
    category: {},
    tvMode: {},
    state: {},
  };
  const uniqueBrowsers = new Set();
  const browserDays = new Map();
  const eventUsers = {
    video_open: new Set(),
    tv_start: new Set(),
    smart_feed_rendered: new Set(),
    follow_on: new Set(),
  };

  for (const day of enumerateDays(range.from, range.to)) {
    const keys = await listAllByPrefix(kv, `analytics:v1:${day}:`);
    const counts = {};
    const dailyUnique = new Set();

    for (const item of keys) {
      const parts = String(item.name || '').split(':');
      const event = parts[3] || '';
      if (!ALLOWED_EVENTS.has(event)) continue;

      bump(counts, event);
      bump(totals, event);

      // Les claus antigues només tenien el sufix aleatori. Les noves inclouen
      // dimensions genèriques; si no hi són, simplement no entren al desglossament.
      const device = parseDimension(parts, 'd-');
      const surface = parseDimension(parts, 's-');
      const category = parseDimension(parts, 'c-');
      const tvMode = parseDimension(parts, 't-');
      const state = parseDimension(parts, 'x-');
      const browserHash = parseDimension(parts, 'u-');

      if (browserHash) {
        uniqueBrowsers.add(browserHash);
        dailyUnique.add(browserHash);
        if (!browserDays.has(browserHash)) browserDays.set(browserHash, new Set());
        browserDays.get(browserHash).add(day);
        if (event === 'video_open') eventUsers.video_open.add(browserHash);
        if (event === 'tv_start') eventUsers.tv_start.add(browserHash);
        if (event === 'smart_feed_rendered') eventUsers.smart_feed_rendered.add(browserHash);
        if (event === 'follow_toggle' && state === 'on') eventUsers.follow_on.add(browserHash);
      }

      if (device) bump(dimensions.device, device);
      if (surface) bump(dimensions.surface, surface);
      if (category) bump(dimensions.category, category);
      if (tvMode && tvMode !== 'other') bump(dimensions.tvMode, tvMode);
      if (state && (event === 'follow_toggle' || event === 'like_toggle')) {
        bump(dimensions.state, `${event}:${state}`);
      }
    }

    daily.push({ day, unique_browsers: dailyUnique.size, ...counts });
  }

  const recurrentBrowsers = Array.from(browserDays.values())
    .filter(days => days.size >= 2)
    .length;
  const uniqueCount = uniqueBrowsers.size;

  return {
    from: range.from,
    to: range.to,
    days: range.days,
    totals,
    daily,
    dimensions,
    audience: {
      uniqueBrowsers: uniqueCount,
      recurrentBrowsers,
      singleDayBrowsers: Math.max(0, uniqueCount - recurrentBrowsers),
      videoUsers: eventUsers.video_open.size,
      tvUsers: eventUsers.tv_start.size,
      smartFeedUsers: eventUsers.smart_feed_rendered.size,
      followUsers: eventUsers.follow_on.size,
      videosPerBrowser: uniqueCount ? (Number(totals.video_open) || 0) / uniqueCount : 0,
    },
    note: 'Anonymous product analytics. A rotating browser identifier is hashed before storage; no IPs, user-agent, search text, video IDs or channel IDs are stored.',
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!sameSiteRequest(request)) {
    return jsonResponse({ error: 'Origin not allowed' }, 403);
  }

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 4096) {
    return jsonResponse({ error: 'Payload too large' }, 413);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const eventName = String(payload?.event || '').trim();
  if (!ALLOWED_EVENTS.has(eventName)) {
    return jsonResponse({ error: 'Unknown event' }, 400);
  }

  const contextData = sanitizeContext(payload?.context);
  const clientHash = await hashClientId(payload?.clientId);

  try {
    await writeEvent(env, eventName, contextData, clientHash);
    return emptyResponse(204);
  } catch {
    return jsonResponse({ error: 'Analytics storage unavailable' }, 503);
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const configuredToken = String(env?.ANALYTICS_ADMIN_TOKEN || '').trim();

  if (!configuredToken) {
    return jsonResponse({ error: 'Analytics summary is not configured' }, 503);
  }

  const authorization = request.headers.get('authorization') || '';
  const suppliedToken = authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : '';

  if (!suppliedToken || suppliedToken !== configuredToken) {
    return jsonResponse({ error: 'Unauthorized' }, 401, {
      'www-authenticate': 'Bearer',
    });
  }

  if (env?.SEGUEIX_ANALYTICS?.writeDataPoint) {
    return jsonResponse({
      error: 'Events are stored in Cloudflare Analytics Engine; query that dataset from Cloudflare.',
    }, 503);
  }

  if (!env?.SEGUEIX_SYNC) {
    return jsonResponse({ error: 'KV summary unavailable' }, 503);
  }

  const url = new URL(request.url);
  const range = resolveDateRange(url);
  if (range.error) {
    return jsonResponse({ error: range.error }, 400);
  }

  const summary = await buildKvSummary(env.SEGUEIX_SYNC, range);
  return jsonResponse(summary);
}
