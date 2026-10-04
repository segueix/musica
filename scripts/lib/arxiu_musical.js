'use strict';

const DAY = 86400000;
const DEFAULTS = Object.freeze({
  hotDays: 365,
  oldKeepPerChannel: 12,
  historyPoolPerChannel: 6,
});

function timestamp(value) {
  const t = Date.parse(String(value || ''));
  return Number.isFinite(t) ? t : 0;
}

function isSong(video) {
  return video?.contentType === 'song' || video?.contentType === 'live_song';
}

function byViewsDesc(a, b) {
  return (Number(b?.viewCount) || 0) - (Number(a?.viewCount) || 0)
    || timestamp(b?.publishedAt) - timestamp(a?.publishedAt)
    || String(a?.id || '').localeCompare(String(b?.id || ''));
}

function uniqueVideos(videos) {
  const out = [];
  const seen = new Set();
  for (const video of videos || []) {
    const id = String(video?.id || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(video);
  }
  return out;
}

function splitChannelVideos(videos, options = {}) {
  const now = Number(options.now || Date.now());
  const hotDays = Number(options.hotDays || DEFAULTS.hotDays);
  const oldKeepPerChannel = Number(options.oldKeepPerChannel || DEFAULTS.oldKeepPerChannel);
  const cutoff = now - Math.max(1, hotDays) * DAY;
  const all = uniqueVideos(videos);
  const recent = [];
  const old = [];

  for (const video of all) {
    if (timestamp(video?.publishedAt) >= cutoff) recent.push(video);
    else old.push(video);
  }

  const representativeOld = old
    .filter(isSong)
    .sort(byViewsDesc)
    .slice(0, Math.max(0, oldKeepPerChannel));

  const hotIds = new Set([...recent, ...representativeOld].map(video => String(video.id)));
  return {
    hot: all.filter(video => hotIds.has(String(video.id))),
    archive: all.filter(video => !hotIds.has(String(video.id))),
    representativeOld,
  };
}

function compactArchiveVideo(video) {
  if (!video?.id || !video?.title) return null;
  const compact = {
    id: String(video.id),
    title: String(video.title),
    channelId: String(video.channelId || video.sourceChannelId || ''),
    channelTitle: String(video.channelTitle || ''),
    publishedAt: String(video.publishedAt || ''),
    viewCount: Number(video.viewCount || 0),
    categories: Array.isArray(video.categories) ? video.categories : [],
    contentType: String(video.contentType || 'song'),
    durationSeconds: Number(video.durationSeconds || 0),
  };
  if (video.isShort) compact.isShort = true;
  if (video.originalYear) compact.originalYear = Number(video.originalYear);
  if (video.topicTrack) compact.topicTrack = true;
  return compact;
}

function selectHistoryPool(videos, limit = DEFAULTS.historyPoolPerChannel) {
  return uniqueVideos(videos)
    .filter(video => isSong(video) && !video?.isShort)
    .sort(byViewsDesc)
    .slice(0, Math.max(0, Number(limit) || 0))
    .map(compactArchiveVideo)
    .filter(Boolean);
}

// data/historial-musical.json: totes les cançons de l'arxiu en un sol fitxer compacte perquè la vista d'un estil
// les barregi amb les del feed (el client ordena el conjunt amb el motor de selecció). Només cançons publicades
// (song / live_song, no Shorts, amb durada); sense el nom del canal ni l'hora (el client els treu del canal i del dia).
function buildStyleHistory(videos) {
  return uniqueVideos(videos)
    .filter(video => isSong(video) && !video?.isShort && Number(video?.durationSeconds) > 0 && video?.channelId)
    .map(video => {
      const out = {
        id: String(video.id),
        title: String(video.title || ''),
        channelId: String(video.channelId),
        publishedAt: String(video.publishedAt || '').slice(0, 10),
        viewCount: Number(video.viewCount || 0),
        durationSeconds: Number(video.durationSeconds),
      };
      if (video.contentType === 'live_song') out.contentType = 'live_song';
      if (video.originalYear) out.originalYear = Number(video.originalYear);
      if (video.topicTrack) out.topicTrack = true;
      return out;
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id));
}

// Una cançó per línia: els canvis setmanals de visualitzacions fan diffs petits.
function serializeStyleHistory(videos, updatedAt = new Date().toISOString()) {
  const list = Array.isArray(videos) ? videos : [];
  return `{"updatedAt":${JSON.stringify(updatedAt)},"videos":[\n${list.map(video => JSON.stringify(video)).join(',\n')}\n]}\n`;
}

module.exports = {
  DEFAULTS,
  buildStyleHistory,
  serializeStyleHistory,
  splitChannelVideos,
  compactArchiveVideo,
  selectHistoryPool,
  uniqueVideos,
};
