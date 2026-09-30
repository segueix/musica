'use strict';

const fs = require('fs');

// Tipus que una persona pot assignar. `review` no hi és: la revisió manual existeix
// precisament per sortir-ne.
const MANUAL_CONTENT_TYPES = new Set(['song', 'live_song', 'album', 'other']);
const ELIGIBLE_TYPES = new Set(['song', 'live_song']);

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

// Llegeix data/music-content-overrides.json i retorna Map(videoId → { contentType, note }).
// Les entrades invàlides s'ignoren amb un avís (mai no trenquen la generació del feed).
function parseContentOverrides(payload) {
  const overrides = new Map();
  const list = Array.isArray(payload?.videos) ? payload.videos : [];
  for (const entry of list) {
    const id = String(entry?.id || '').trim();
    const contentType = String(entry?.contentType || '').trim();
    if (!id || !MANUAL_CONTENT_TYPES.has(contentType)) {
      console.warn('⚠️ Revisió manual ignorada (id o contentType invàlid):', JSON.stringify(entry));
      continue;
    }
    overrides.set(id, { contentType, note: String(entry?.note || '').trim() });
  }
  return overrides;
}

function loadContentOverrides(file) {
  if (!fs.existsSync(file)) return new Map();
  return parseContentOverrides(readJson(file, {}));
}

// Substitueix el resultat del classificador automàtic per la decisió manual.
function applyContentOverride(classification, override) {
  if (!override) return classification;
  return {
    accepted: override.contentType !== 'other',
    contentType: override.contentType,
    confidence: 1,
    reason: 'revisat manualment' + (override.note ? ': ' + override.note : '')
  };
}

function bump(counts, key, delta) {
  if (!counts || typeof counts !== 'object') return;
  counts[key] = Math.max(0, (Number(counts[key]) || 0) + delta);
}

// Aplica les revisions manuals a un feed ja generat (feed.json + fitxer de revisió + auditories),
// sense YouTube API. Deixa el mateix resultat que la propera execució d'update_music_feed.js.
// És idempotent. Retorna la llista de vídeos canviats.
function applyOverridesToSnapshot({ feed, review, contentAudit, feedAudit, falseShortIds }, overrides) {
  const changes = [];
  const touchedChannels = new Set();

  for (const video of feed?.videos || []) {
    const override = overrides.get(video.id);
    if (!override) continue;
    const next = applyContentOverride(null, override);
    const from = video.contentType || '';
    if (from === next.contentType && video.musicReason === next.reason) continue;
    if (from !== next.contentType) changes.push({ id: video.id, title: video.title, from, to: next.contentType });
    video.contentType = next.contentType;
    video.musicConfidence = next.confidence;
    video.musicReason = next.reason;
    touchedChannels.add(video.channelId);
  }

  if (falseShortIds && falseShortIds.size) {
    for (const video of feed?.videos || []) {
      if (video.isShort === true && falseShortIds.has(video.id)) video.isShort = false;
    }
  }

  if (review && Array.isArray(review.videos)) {
    review.videos = review.videos.filter(video => !overrides.has(video.id));
    review.count = review.videos.length;
  }

  const shortCount = (feed?.videos || []).filter(video => video.isShort === true).length;
  for (const audit of [contentAudit, feedAudit]) {
    if (!audit) continue;
    const counts = audit.typeCounts || audit.contentTypeCounts;
    for (const change of changes) {
      bump(counts, change.from || 'song', -1);
      bump(counts, change.to, 1);
      const wasAccepted = change.from !== '' && change.from !== 'other' && change.from !== 'review';
      const isAccepted = change.to !== 'other';
      if (isAccepted && !wasAccepted) audit.acceptedMusicCount = (Number(audit.acceptedMusicCount) || 0) + 1;
      if (!isAccepted && wasAccepted) audit.acceptedMusicCount = Math.max(0, (Number(audit.acceptedMusicCount) || 0) - 1);
      const wasEligible = ELIGIBLE_TYPES.has(change.from);
      const isEligible = ELIGIBLE_TYPES.has(change.to);
      if (isEligible && !wasEligible) audit.categoryEligibleVideoCount = (Number(audit.categoryEligibleVideoCount) || 0) + 1;
      if (!isEligible && wasEligible) audit.categoryEligibleVideoCount = Math.max(0, (Number(audit.categoryEligibleVideoCount) || 0) - 1);
    }
    if (review && Array.isArray(review.videos)) {
      if ('reviewCount' in audit) audit.reviewCount = review.videos.length;
      if ('contentReviewCount' in audit) audit.contentReviewCount = review.videos.length;
    }
    if ('rejectedOrReviewCount' in audit) {
      audit.rejectedOrReviewCount = (Number(audit.rawPublicVideoCount) || 0) - (Number(audit.acceptedMusicCount) || 0);
    }
    if ('shortVideoCount' in audit) audit.shortVideoCount = shortCount;
    if (Array.isArray(audit.channelsWithoutAcceptedMusic)) {
      const accepted = new Set();
      for (const video of feed?.videos || []) {
        if (touchedChannels.has(video.channelId) && video.contentType && video.contentType !== 'other' && video.contentType !== 'review') {
          accepted.add(video.channelId);
        }
      }
      audit.channelsWithoutAcceptedMusic = audit.channelsWithoutAcceptedMusic.filter(id => !accepted.has(id));
    }
  }

  return changes;
}

module.exports = {
  MANUAL_CONTENT_TYPES,
  parseContentOverrides,
  loadContentOverrides,
  applyContentOverride,
  applyOverridesToSnapshot
};
