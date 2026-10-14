'use strict';

// Reconstrucció local, sense YouTube ni Actions. Reutilitza el mateix motor que el torn diari.
const fs = require('fs');
const path = require('path');
const { mergeAlbumCatalog } = require('./lib/albums_musica');
const { applyReleaseCatalog } = require('./lib/llancaments_musicals');

function rebuild(root = process.cwd(), { evidence = [], generatedAt = new Date().toISOString() } = {}) {
  const read = (file, fallback) => {
    const name = path.join(root, file);
    return fs.existsSync(name) ? JSON.parse(fs.readFileSync(name, 'utf8')) : fallback;
  };
  const feed = read('data/feed.json', { channels: {}, videos: [] });
  const hiddenIds = new Set(read('data/hidden-videos.json', {}).videoIds || []);
  for (const id of Object.keys(read('data/videos-restringits.json', {}).videos || {})) hiddenIds.add(id);
  const videos = new Map();
  for (const video of [...read('data/historial-musical.json', {}).videos || [], ...feed.videos]) {
    if (feed.channels[video.channelId]) videos.set(video.id, video);
  }
  // Les evidències només enriqueixen vídeos existents del mateix canal. No incorporen cançons.
  for (const row of evidence) {
    const video = videos.get(row.id);
    if (video && video.channelId === row.channelId && row.sourceUrl === `https://www.youtube.com/watch?v=${row.id}`) {
      videos.set(row.id, { ...video, description: row.description });
    }
  }
  const previous = read('data/albums-musica.json', {});
  const catalog = mergeAlbumCatalog(previous, [...videos.values()], feed.channels, { hiddenIds, generatedAt });
  applyReleaseCatalog(catalog, read('data/llancaments-musicals.json', {}), { channels: feed.channels, hiddenIds });
  return catalog;
}

if (require.main === module) {
  const evidenceFile = process.argv.find(arg => arg.startsWith('--evidence='))?.slice('--evidence='.length);
  const evidence = evidenceFile ? JSON.parse(fs.readFileSync(evidenceFile, 'utf8')).evidence : [];
  const catalog = rebuild(process.cwd(), { evidence });
  if (!process.argv.includes('--dry-run')) fs.writeFileSync('data/albums-musica.json', JSON.stringify(catalog));
  console.log(JSON.stringify({ artists: Object.keys(catalog.artists).length,
    albums: Object.values(catalog.artists).reduce((n, a) => n + a.albums.length, 0),
    pendingArtists: Object.keys(catalog.pendingAlbums).length }));
}

module.exports = { rebuild };
