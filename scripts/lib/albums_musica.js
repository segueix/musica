'use strict';

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
      'Metadades Topic locals; discos amb >=2 cançons. Videoclips hereten disc només amb coincidència única de títol+artista.',
    channels: { ...(previous?.channels || {}) },
    artists: {},
  };

  for (const [artist, entry] of Object.entries(previous?.artists || {})) {
    catalog.artists[artist] = {
      albums: (entry?.albums || []).map(cleanAlbum),
    };
  }

  const byArtistTitle = new Map();
  const byArtistKey = new Map();

  function indexAlbum(artist, album) {
    const titleKey = artist + '\u0000' + String(album.title || '');
    byArtistTitle.set(titleKey, album);
    for (const key of album.keys || []) {
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
    const meta = extractAlbum(video?.description);
    if (!meta) continue;
    const artist = canonicalArtist(video, channels);
    const key = normalizeTitle(video?.title);
    if (!artist || !key) continue;

    const lookup = artist + '\u0000' + meta.title;
    let album = byArtistTitle.get(lookup);
    if (!album) {
      album = {
        id: 'alb_' + hash32(lookup),
        title: meta.title,
        coverVideoId: '',
        trackIds: [],
        keys: [],
      };
      if (meta.year) album.year = meta.year;
      (catalog.artists[artist] ||= { albums: [] }).albums.push(album);
      byArtistTitle.set(lookup, album);
    }

    if (!album.year && meta.year) album.year = meta.year;
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
    const artist = canonicalArtist(video, channels);
    const key = normalizeTitle(video?.title);
    if (!id || !artist || !key) continue;
    const matches = [...(byArtistKey.get(artist + '\u0000' + key) || [])];
    if (matches.length !== 1) continue;
    const album = matches[0];
    if (!album.trackIds.includes(id)) album.trackIds.push(id);
  }

  // Un llançament nou d'una sola pista és un single: no es presenta com a disc.
  for (const [artist, entry] of Object.entries(catalog.artists)) {
    entry.albums = entry.albums
      .filter(album => {
        const existed = (previous?.artists?.[artist]?.albums || []).some(old => String(old.id) === String(album.id));
        const knownKeys = new Set(album.keys || []);
        return existed || knownKeys.size >= 2 || (newKeysByAlbum.get(album.id)?.size || 0) >= 2;
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

module.exports = {
  normalizeTitle,
  extractAlbum,
  canonicalArtist,
  mergeAlbumCatalog,
};

