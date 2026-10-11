'use strict';

function normalizeVideoTitle(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'&+=]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactNormalizedTitle(value) {
  return normalizeVideoTitle(value).replace(/\s+/g, '');
}

function loadChannelVideoAllowlist(filePath, fsModule = require('fs')) {
  try {
    const payload = JSON.parse(fsModule.readFileSync(filePath, 'utf8'));
    const map = new Map();
    for (const [channelId, rule] of Object.entries(payload?.channels || {})) {
      const exactTitles = new Set(
        (Array.isArray(rule?.allowedTitles) ? rule.allowedTitles : [])
          .map(normalizeVideoTitle)
          .filter(Boolean)
      );
      const titleContains = (Array.isArray(rule?.allowedTitleContains) ? rule.allowedTitleContains : [])
        .map(value => ({
          normalized: normalizeVideoTitle(value),
          compact: compactNormalizedTitle(value),
        }))
        .filter(value => value.normalized);
      const deniedTitleContains = (Array.isArray(rule?.deniedTitleContains) ? rule.deniedTitleContains : [])
        .map(value => ({
          normalized: normalizeVideoTitle(value),
          compact: compactNormalizedTitle(value),
        }))
        .filter(value => value.normalized);

      const parsedRule = {
        blocked: rule?.blocked === true,
        exactTitles,
        allowedVideoIds: Array.isArray(rule?.allowedVideoIds)
          ? new Set(rule.allowedVideoIds.map(String).filter(id => /^[A-Za-z0-9_-]{11}$/.test(id)))
          : null,
        titleContains,
        deniedTitleContains,
        allowedSpanishSubtitleVideoIds: new Set(
          (Array.isArray(rule?.allowedSpanishSubtitleVideoIds) ? rule.allowedSpanishSubtitleVideoIds : [])
            .map(String).filter(id => /^[A-Za-z0-9_-]{11}$/.test(id))
        ),
        allowedExternalVideos: new Map(
          Object.entries(rule?.allowedExternalVideos || {})
            .filter(([id, uploader]) => /^[A-Za-z0-9_-]{11}$/.test(id) && /^UC[A-Za-z0-9_-]{22}$/.test(uploader))
        ),
        acceptedMusicOnly: rule?.acceptedMusicOnly === true,
        allowedContentTypes: new Set(
          (Array.isArray(rule?.allowedContentTypes) ? rule.allowedContentTypes : [])
            .map(value => String(value || '').trim())
            .filter(Boolean)
        ),
        avatarFromFirstAllowedVideo: rule?.avatarFromFirstAllowedVideo === true,
        avatarFromAllowedTitle: normalizeVideoTitle(rule?.avatarFromAllowedTitle || ''),
      };
      parsedRule.hasTitleFilter = exactTitles.size > 0 || titleContains.length > 0;

      if (
        parsedRule.allowedVideoIds !== null ||
        parsedRule.blocked ||
        parsedRule.hasTitleFilter ||
        parsedRule.deniedTitleContains.length > 0 ||
        parsedRule.acceptedMusicOnly ||
        parsedRule.allowedContentTypes.size > 0 ||
        parsedRule.avatarFromFirstAllowedVideo ||
        parsedRule.avatarFromAllowedTitle
      ) {
        map.set(channelId, parsedRule);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

function isChannelVideoAllowed(allowlist, channelId, title, videoId) {
  const rule = allowlist.get(String(channelId || ''));
  if (!rule) return true;
  if (rule.blocked) return false;
  // Els resolutors comproven títols; el generador també exigeix la gravació exacta.
  if (videoId !== undefined && rule.allowedVideoIds && !rule.allowedVideoIds.has(String(videoId))) return false;

  const normalized = normalizeVideoTitle(title);
  const compact = normalized.replace(/\s+/g, '');

  if (
    rule.deniedTitleContains.some(fragment =>
      normalized.includes(fragment.normalized) || compact.includes(fragment.compact)
    )
  ) return false;

  if (!rule.hasTitleFilter) return true;
  if (rule.exactTitles.has(normalized)) return true;

  return rule.titleContains.some(fragment =>
    normalized.includes(fragment.normalized) || compact.includes(fragment.compact)
  );
}

// Excepcions editorials per gravació: mai no obren tot el canal ni una llista de títols.
function allowsSpanishSubtitles(allowlist, video) {
  const rule = allowlist.get(String(video?.channelId || ''));
  const id = String(video?.id || '');
  return Boolean(rule?.allowedVideoIds?.has(id) && rule.allowedSpanishSubtitleVideoIds.has(id) &&
    isChannelVideoAllowed(allowlist, video.channelId, video.title, id));
}

function isChannelVideoUploaderAllowed(allowlist, channelId, videoId, uploaderId) {
  if (channelId === uploaderId) return true;
  const rule = allowlist.get(channelId);
  return Boolean(!rule?.blocked && rule?.allowedVideoIds?.has(videoId) &&
    rule.allowedExternalVideos.get(videoId) === uploaderId);
}

module.exports = {
  normalizeVideoTitle,
  loadChannelVideoAllowlist,
  isChannelVideoAllowed,
  allowsSpanishSubtitles,
  isChannelVideoUploaderAllowed
};
