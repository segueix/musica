'use strict';

// Mou repertori antic fora de data/feed.json sense fer cap crida a YouTube.
// El feed calent conserva 12 mesos complets + les 12 cançons antigues més fortes de cada canal.
// La resta va a data/archive/channels/<channelId>.json. Un pool molt petit de clàssics alimenta les ràdios.

const fs = require('fs');
const path = require('path');
const {
  DEFAULTS,
  splitChannelVideos,
  compactArchiveVideo,
  selectHistoryPool,
  uniqueVideos,
} = require('./lib/arxiu_musical');
const { serializeFeed } = require('./lib/aprimar_feed');

const ROOT = path.resolve(__dirname, '..');
const FEED = path.join(ROOT, 'data', 'feed.json');
const ARCHIVE_DIR = path.join(ROOT, 'data', 'archive', 'channels');
const HISTORY_POOL = path.join(ROOT, 'data', 'history-pool.json');

const HOT_DAYS = Number.parseInt(process.env.MUSIC_HOT_DAYS || String(DEFAULTS.hotDays), 10);
const OLD_KEEP = Number.parseInt(process.env.MUSIC_OLD_KEEP_PER_CHANNEL || String(DEFAULTS.oldKeepPerChannel), 10);
const POOL_KEEP = Number.parseInt(process.env.MUSIC_HISTORY_POOL_PER_CHANNEL || String(DEFAULTS.historyPoolPerChannel), 10);

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

function archivePath(channelId) {
  return path.join(ARCHIVE_DIR, String(channelId) + '.json');
}

function hydrateForHot(video) {
  if (!video?.id) return video;
  return {
    ...video,
    thumbnail: video.thumbnail || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
  };
}

function main() {
  const feed = readJson(FEED, { channels: {}, videos: [] });
  const videos = Array.isArray(feed.videos) ? feed.videos : [];
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

  const byChannel = new Map();
  for (const video of videos) {
    const channelId = String(video?.channelId || '');
    if (!channelId) continue;
    if (!byChannel.has(channelId)) byChannel.set(channelId, []);
    byChannel.get(channelId).push(video);
  }

  // Inclou l'arxiu existent perquè una execució posterior no perdi repertori ja mogut.
  for (const file of fs.readdirSync(ARCHIVE_DIR).filter(name => name.endsWith('.json'))) {
    const channelId = path.basename(file, '.json');
    const archive = readJson(path.join(ARCHIVE_DIR, file), { videos: [] });
    if (!byChannel.has(channelId)) byChannel.set(channelId, []);
    byChannel.set(channelId, uniqueVideos([
      ...byChannel.get(channelId),
      ...(Array.isArray(archive.videos) ? archive.videos : []),
    ]));
  }

  const hot = [];
  const pool = [];
  let archiveCount = 0;

  for (const [channelId, channelVideos] of byChannel) {
    const split = splitChannelVideos(channelVideos, {
      hotDays: HOT_DAYS,
      oldKeepPerChannel: OLD_KEEP,
    });

    hot.push(...split.hot.map(hydrateForHot));

    const archived = split.archive
      .map(compactArchiveVideo)
      .filter(Boolean)
      .sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0));

    const file = archivePath(channelId);
    if (archived.length) {
      const payload = {
        channelId,
        updatedAt: new Date().toISOString(),
        videos: archived,
      };
      fs.writeFileSync(file, JSON.stringify(payload));
      archiveCount += archived.length;
      pool.push(...selectHistoryPool(archived, POOL_KEEP));
    } else if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }

  hot.sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0));
  feed.videos = uniqueVideos(hot);
  feed.generatedAt = new Date().toISOString();
  fs.writeFileSync(FEED, serializeFeed(feed));

  const poolPayload = {
    updatedAt: new Date().toISOString(),
    perChannel: POOL_KEEP,
    videos: uniqueVideos(pool),
  };
  fs.writeFileSync(HISTORY_POOL, JSON.stringify(poolPayload));

  console.log(
    `✅ Arxiu musical: feed calent ${videos.length} → ${feed.videos.length} vídeos; `
    + `${archiveCount} a l'historial; pool de ràdio ${poolPayload.videos.length}.`
  );
}

main();
