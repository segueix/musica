'use strict';

// Fonts revisades: llançaments > llistes oficials > discografia contrastada.
// Les noves pistes trobades a YouTube es registren per revisar, mai no amplien una selecció editorial soles.
const priority = { release: 0, official_playlist: 1, discography: 2 };
const key = value => String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
const unique = values => [...new Set(values)];

function entries(registry) {
  return (registry?.releases || []).filter(r => r.status === 'validated' && r.artist && r.title &&
    ['album', 'ep', 'single', 'live'].includes(r.type) && Array.isArray(r.tracks));
}

function trackVideos(registry) {
  return entries(registry).flatMap(r => r.tracks.flatMap(t => (t.videos || []).map(v => ({ ...v, title: t.title }))));
}

function idsByChannel(registry, activeIds) {
  const map = new Map();
  for (const v of trackVideos(registry)) {
    if (!activeIds.has(v.channelId) || !/^[\w-]{11}$/.test(v.id)) continue;
    map.set(v.channelId, unique([...(map.get(v.channelId) || []), v.id]));
  }
  return map;
}

function applyReleaseCatalog(catalog, registry, { channels = {}, hiddenIds = new Set() } = {}) {
  for (const release of entries(registry).sort((a,b) => (priority[b.sourceType] ?? 3) - (priority[a.sourceType] ?? 3))) {
    const active = (release.channelIds || []).filter(id => channels[id]);
    if (!active.length) continue;
    const tracks = release.tracks.map(t => ({ title: t.title,
      videoIds: unique((t.videos || []).filter(v => active.includes(v.channelId) && !hiddenIds.has(v.id)).map(v => v.id)),
    })).filter(t => t.videoIds.length);
    const trackIds = unique(tracks.flatMap(t => t.videoIds));
    if (!trackIds.length) continue;
    const artist = catalog.artists[release.artist] ||= { albums: [] };
    const old = artist.albums.find(a => key(a.title) === key(release.title));
    const album = { id: old?.id || release.id, title: release.title, year: release.year,
      type: release.type, sourceType: release.sourceType, sourceUrl: release.sourceUrl,
      coverVideoId: hiddenIds.has(release.coverVideoId) ? trackIds[0] : release.coverVideoId || trackIds[0],
      coverUrl: /^https:\/\//.test(release.coverUrl || '') ? release.coverUrl : undefined,
      trackIds, trackGroups: tracks, keys: tracks.map(t => key(t.title)),
    };
    artist.albums = artist.albums.filter(a => a.id !== album.id && key(a.title) !== key(album.title));
    artist.albums.push(album);
    artist.albums.sort((a,b) => (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title, 'ca'));
    for (const id of active) catalog.channels[id] = release.artist;
  }
  return catalog;
}

// Revalidació setmanal amb l'API oficial. Conserva l'última lectura si falla la xarxa;
// la foto de la llista serveix per detectar canvis, no per acceptar vídeos sense revisar.
async function refreshSources(registry, previous, api, { activeIds, now = new Date().toISOString() } = {}) {
  const state = JSON.parse(JSON.stringify(previous || { playlists: {}, discoveries: {} }));
  state.playlists ||= {};
  state.discoveries ||= {};
  const due = record => !record?.checkedAt || Date.parse(now) - Date.parse(record.checkedAt) >= 7 * 86400000;
  for (const r of entries(registry)) {
    if (!(r.channelIds || []).some(id => activeIds.has(id))) continue;
    for (const source of r.playlists || []) {
      const old = state.playlists[source.id];
      if (!due(old)) continue;
      try {
        const meta = await api('playlists', { part: 'snippet', id: source.id });
        if (meta.items?.[0]?.snippet?.channelId !== source.ownerChannelId) throw new Error('Propietari inesperat');
        const ids = []; let pageToken = '';
        for (let page = 0; page < 20; page++) {
          const data = await api('playlistItems', { part: 'snippet,contentDetails', playlistId: source.id, maxResults: 50, pageToken });
          ids.push(...(data.items || []).map(v => v.contentDetails?.videoId).filter(Boolean));
          pageToken = data.nextPageToken || '';
          if (!pageToken) break;
        }
        if (pageToken) throw new Error('Llista incompleta');
        const reviewed = new Set([...(r.tracks || []).flatMap(t => (t.videos || []).map(v => v.id)), ...(r.ignoredVideoIds || [])]);
        state.playlists[source.id] = { checkedAt: now, videoIds: unique(ids),
          pendingVideoIds: unique(ids).filter(id => !reviewed.has(id)),
          missingVideoIds: (r.tracks || []).flatMap(t => (t.videos || []).map(v => v.id)).filter(id => !ids.includes(id)),
        };
      } catch (error) {
        state.playlists[source.id] = { ...old, lastError: String(error.message), failedAt: now };
      }
    }
  }
  for (const channelId of unique(entries(registry).flatMap(r => (r.playlists || []).map(p => p.ownerChannelId)))) {
    if (!activeIds.has(channelId) || !due(state.discoveries[channelId])) continue;
    try {
      const lists = []; let pageToken = '';
      for (let page = 0; page < 10; page++) {
        const data = await api('playlists', { part: 'snippet', channelId, maxResults: 50, pageToken });
        lists.push(...(data.items || []).map(p => ({ id: p.id, title: p.snippet?.title || '' })));
        pageToken = data.nextPageToken || '';
        if (!pageToken) break;
      }
      if (pageToken) throw new Error('Descoberta incompleta');
      const known = new Set(entries(registry).flatMap(r => (r.playlists || []).map(p => p.id)));
      state.discoveries[channelId] = { checkedAt: now, candidates: lists.filter(p => !known.has(p.id)) };
    } catch (error) {
      state.discoveries[channelId] = { ...state.discoveries[channelId], lastError: String(error.message), failedAt: now };
    }
  }
  return state;
}

module.exports = { entries, trackVideos, idsByChannel, applyReleaseCatalog, refreshSources };
