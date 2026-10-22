'use strict';

const { cleanTitle } = require('../../js/song-title');

// Catàleg local de discos. No fa cap crida de xarxa: aprofita les descripcions que update_music_feed.js
// ja ha rebut de YouTube i les converteix en metadades persistents abans que l'aprimador les elimini.

function normalizeTitle(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractAlbum(description) {
  const lines = String(description || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  if (!/^provided to youtube by/i.test(lines[0] || '')) return null;
  const title = String(lines[2] || '').trim();
  if (!title || /^(?:℗|©|released on:|auto-generated|provided to youtube)/i.test(title)) return null;
  const released = lines.find(line => /^released on:\s*\d{4}-\d{2}-\d{2}/i.test(line)) || '';
  const year = Number((released.match(/(\d{4})/) || [])[1] || 0) || 0;
  return { title, year };
}

// Només una declaració explícita del disc; no caràtules, hashtags ni llistes genèriques.
function extractOfficialAlbum(description, artist = '') {
  const lines = String(description || '').split(/\r?\n/).map(line => line.trim());
  const titles = new Set();
  const artistPattern = String(artist).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const owner = artistPattern ? `(?:(?:de\\s+|d[’'])${artistPattern}\\s*[,:]?\\s*)?` : '';
  const quotedTitle = '(?:"([^"\\n]{2,120})"|«([^»\\n]{2,120})»|“([^”\\n]{2,120})”|\'([^\'\\n]{2,120})\')';
  const explicit = new RegExp(`(?:disc|disco|àlbum|album)\\s+${owner}${quotedTitle}`, 'iu');
  for (const line of lines) {
    const field = line.match(/^(?:àlbum|album|disc|disco)\s*:\s*(.{2,120})$/iu);
    const sentence = /(?:cançó|canción|tema|forma part|extret[ao]?)/iu.test(line)
      ? line.match(explicit)
      : null;
    const title = (field?.[1] || sentence?.slice(1).find(Boolean) || '').trim();
    if (title && !/https?:|www\./i.test(title)) titles.add(title);
  }
  return titles.size === 1 ? { title: [...titles][0], year: 0 } : null;
}

function songKey(video, artist) {
  // Neteja conservadora: «07 Cançó - Artista \"Disc\"» no es pot convertir en «Disc».
  // Els marcadors de directe, remix i col·laboració es conserven.
  let title = cleanTitle(video.originalTitle || video.title, { artists: [] });
  for (const name of new Set([artist, video.channelTitle].filter(Boolean))) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    title = title.replace(new RegExp(`^${escaped}\\s+[-–—:]\\s+`, 'iu'), '')
      .replace(new RegExp(`\\s+[-–—]\\s+${escaped}(?:\\s+["«“].*["»”])?$`, 'iu'), '');
  }
  title = title.replace(/^\d{1,2}[.)]\s+|^0\d\s+/, '');
  return normalizeTitle(title);
}

function hash32(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function canonicalArtist(video, channels = {}) {
  const channel = channels?.[video?.channelId] || {};
  return String(
    (Array.isArray(channel?.artists) && channel.artists[0]) ||
    video?.channelTitle ||
    channel?.name ||
    ''
  ).trim();
}

function cleanAlbum(album) {
  const out = {
    id: String(album.id || ''),
    title: String(album.title || ''),
    coverVideoId: String(album.coverVideoId || ''),
    trackIds: [...new Set((album.trackIds || []).map(String).filter(Boolean))],
    keys: [...new Set((album.keys || []).map(String).filter(Boolean))],
  };
  if (album.sourceChannelId) out.sourceChannelId = String(album.sourceChannelId);
  for (const field of ['type', 'sourceType', 'sourceUrl', 'coverUrl']) {
    if (album[field]) out[field] = String(album[field]);
  }
  if (Array.isArray(album.trackGroups)) out.trackGroups = album.trackGroups.map(t => ({
    title: String(t.title || ''), videoIds: [...new Set((t.videoIds || []).map(String))],
  }));
  const year = Number(album.year || 0);
  if (year) out.year = year;
  return out;
}

function mergeAlbumCatalog(previous, videos, channels, { hiddenIds = new Set(), generatedAt = new Date().toISOString() } = {}) {
  const catalog = {
    version: 1,
    generatedFrom: previous?.generatedFrom || 'metadades Topic rebudes pel generador',
    generatedAt,
    strategy:
      'Llançaments verificats prioritaris; metadades explícites Topic/oficials amb >=2 cançons. Coincidències úniques per artista; pistes parcials conservades entre actualitzacions.',
    channels: { ...(previous?.channels || {}) },
    artists: {},
    pendingAlbums: {},
  };

  for (const [artist, entry] of Object.entries(previous?.artists || {})) {
    catalog.artists[artist] = {
      albums: (entry?.albums || []).map(cleanAlbum),
    };
  }
  // Una primera pista queda pendent: dues actualitzacions parcials poden completar el mateix disc.
  for (const [artist, albums] of Object.entries(previous?.pendingAlbums || {})) {
    if (!Object.values(channels).some(c => c.artists?.includes(artist) || c.name === artist)) continue;
    const entry = catalog.artists[artist] ||= { albums: [] };
    for (const album of albums) {
      if (!entry.albums.some(a => a.id === album.id)) entry.albums.push(cleanAlbum(album));
    }
  }

  const byArtistTitle = new Map();
  const byArtistKey = new Map();

  function indexAlbum(artist, album) {
    const titleKey = artist + '\u0000' + normalizeTitle(album.title);
    byArtistTitle.set(titleKey, album);
    for (const rawKey of album.keys || []) {
      const key = normalizeTitle(rawKey);
      const lookup = artist + '\u0000' + key;
      if (!byArtistKey.has(lookup)) byArtistKey.set(lookup, new Set());
      byArtistKey.get(lookup).add(album);
    }
  }

  for (const [artist, entry] of Object.entries(catalog.artists)) {
    for (const album of entry.albums) indexAlbum(artist, album);
  }

  const newKeysByAlbum = new Map();
  const coverViews = new Map();

  for (const video of videos || []) {
    if (hiddenIds.has(String(video?.id)) || video?.isShort ||
        (video?.contentType && !['song', 'live_song'].includes(video.contentType))) continue;
    const topicMeta = extractAlbum(video?.description);
    // Un directe/remix no hereta el disc d'estudi esmentat al text promocional.
    const isVariant = /\b(?:live|directe|directo|ac[uú]stic[ao]?|acoustic|remix|cover)\b/i.test(video?.originalTitle || video?.title || '');
    const artist = canonicalArtist(video, channels);
    const meta = topicMeta || (!isVariant && extractOfficialAlbum(video?.description, artist));
    if (!meta) continue;
    // Una reedició digital no canvia l'any original verificat del disc.
    const manualYear = video.originalYearSource === 'manual' ? Number(video.originalYear) : 0;
    const albumYear = manualYear || meta.year;
    const key = songKey(video, artist);
    if (!artist || !key) continue;

    const lookup = artist + '\u0000' + normalizeTitle(meta.title);
    let album = byArtistTitle.get(lookup);
    if (!album) {
      album = {
        id: 'alb_' + hash32(lookup),
        title: meta.title,
        coverVideoId: '',
        trackIds: [],
        keys: [],
        sourceType: topicMeta ? 'topic_metadata' : 'channel_metadata',
        sourceUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`,
      };
      if (albumYear) album.year = albumYear;
      (catalog.artists[artist] ||= { albums: [] }).albums.push(album);
      byArtistTitle.set(lookup, album);
    }

    if (manualYear || (!album.year && albumYear)) album.year = albumYear;
    if (!album.trackIds.includes(String(video.id))) album.trackIds.push(String(video.id));
    if (!album.keys.includes(key)) album.keys.push(key);
    if (!newKeysByAlbum.has(album.id)) newKeysByAlbum.set(album.id, new Set());
    newKeysByAlbum.get(album.id).add(key);

    const views = Number(video?.viewCount || 0);
    const priorViews = coverViews.get(album.id) ?? -1;
    if (!hiddenIds.has(String(video.id)) && (!album.coverVideoId || views > priorViews)) {
      album.coverVideoId = String(video.id);
      coverViews.set(album.id, views);
    }

    const keyLookup = artist + '\u0000' + key;
    if (!byArtistKey.has(keyLookup)) byArtistKey.set(keyLookup, new Set());
    byArtistKey.get(keyLookup).add(album);
  }

  // Propaga disc a videoclips/àudios oficials només quan la mateixa cançó apunta a un únic disc.
  for (const video of videos || []) {
    const id = String(video?.id || '');
    if (hiddenIds.has(id) || video?.isShort ||
        (video?.contentType && !['song', 'live_song'].includes(video.contentType))) continue;
    const artist = canonicalArtist(video, channels);
    const key = songKey(video, artist);
    if (!id || !artist || !key) continue;
    const matches = [...(byArtistKey.get(artist + '\u0000' + key) || [])];
    if (matches.length !== 1) continue;
    const album = matches[0];
    if (!album.trackIds.includes(id)) album.trackIds.push(id);
  }

  // Un llançament nou d'una sola pista és un single: no es presenta com a disc.
  for (const [artist, entry] of Object.entries(catalog.artists)) {
    entry.albums = entry.albums
      .map(album => {
        album.trackIds = (album.trackIds || []).filter(id => !hiddenIds.has(id));
        if (hiddenIds.has(album.coverVideoId)) album.coverVideoId = album.trackIds[0] || '';
        return album;
      })
      .filter(album => {
        if (!album.trackIds.length) return false;
        const existed = (previous?.artists?.[artist]?.albums || []).some(old => String(old.id) === String(album.id));
        const knownKeys = new Set(album.keys || []);
        const ready = existed || knownKeys.size >= 2 || (newKeysByAlbum.get(album.id)?.size || 0) >= 2;
        if (!ready) (catalog.pendingAlbums[artist] ||= []).push(cleanAlbum(album));
        return ready;
      })
      .map(cleanAlbum)
      .sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0) || a.title.localeCompare(b.title, 'ca'));
    if (!entry.albums.length) delete catalog.artists[artist];
  }

  // Associa tots els canals coneguts amb el nom canònic de l'artista si aquest ja té discos.
  for (const [channelId, channel] of Object.entries(channels || {})) {
    const artist = String(
      (Array.isArray(channel?.artists) && channel.artists[0]) ||
      channel?.name ||
      ''
    ).trim();
    if (artist && catalog.artists[artist]) catalog.channels[channelId] = artist;
  }

  return catalog;
}

// Sessions en directe d'un cicle publicades al seu canal («ARTISTA - SESSIÓ #08 - CLUB SOCIAL CARME»): cada sessió
// es posa a la fitxa de l'artista que la protagonitza, si és a la base (el client la llegeix amb sourceChannelId).
// Un títol que no segueix el patró o un artista desconegut no s'assigna: no s'inventa cap relació.
const SESSION_TITLE = /^\s*(.+?)\s+[-–]\s+sessi[óo]\s*#?\s*(\d+)\b/i;

function addGuestSessions(catalog, videos, channels, { sourceChannelIds = [], hiddenIds = new Set() } = {}) {
  const sources = new Set(sourceChannelIds.map(String));
  if (!sources.size) return catalog;
  const artistOf = channel => String((Array.isArray(channel?.artists) && channel.artists[0]) || channel?.name || '').trim();
  const byName = new Map();
  for (const [channelId, channel] of Object.entries(channels || {})) {
    if (sources.has(channelId)) continue;
    const artist = artistOf(channel);
    for (const name of [artist, channel?.name, ...(channel?.artists || [])]) {
      const key = normalizeTitle(name);
      if (key && artist && !byName.has(key)) byName.set(key, artist);
    }
  }
  for (const video of videos || []) {
    const id = String(video?.id || '');
    if (!id || !sources.has(String(video.channelId)) || hiddenIds.has(id) || video.isShort ||
        video.contentType !== 'live_song') continue;
    const match = String(video.originalTitle || video.title || '').match(SESSION_TITLE);
    const artist = match && byName.get(normalizeTitle(match[1]));
    if (!artist) continue;
    const entry = (catalog.artists[artist] ||= { albums: [] });
    if (entry.albums.some(album => (album.trackIds || []).includes(id))) continue;
    const source = channels?.[video.channelId]?.name || 'Sessió';
    entry.albums.push({
      id: 'live_session_' + id,
      title: `${source} · Sessió #${String(Number(match[2])).padStart(2, '0')} (en directe)`,
      coverVideoId: id,
      trackIds: [id],
      keys: [],
      sourceChannelId: String(video.channelId),
    });
    for (const [channelId, channel] of Object.entries(channels || {})) {
      if (!sources.has(channelId) && artistOf(channel) === artist) catalog.channels[channelId] = artist;
    }
  }
  return catalog;
}

module.exports = {
  normalizeTitle,
  extractAlbum,
  extractOfficialAlbum,
  canonicalArtist,
  mergeAlbumCatalog,
  addGuestSessions,
};
