'use strict';

function normalizeVideoTitle(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'&]+/g, ' ')
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

      const parsedRule = {
        exactTitles,
        titleContains,
        acceptedMusicOnly: rule?.acceptedMusicOnly === true,
        avatarFromFirstAllowedVideo: rule?.avatarFromFirstAllowedVideo === true,
      };
      parsedRule.hasTitleFilter = exactTitles.size > 0 || titleContains.length > 0;

      if (
        parsedRule.hasTitleFilter ||
        parsedRule.acceptedMusicOnly ||
        parsedRule.avatarFromFirstAllowedVideo
      ) {
        map.set(channelId, parsedRule);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

function isChannelVideoAllowed(allowlist, channelId, title) {
  const rule = allowlist.get(String(channelId || ''));
  if (!rule) return true;
  if (!rule.hasTitleFilter) return true;

  const normalized = normalizeVideoTitle(title);
  if (rule.exactTitles.has(normalized)) return true;

  const compact = normalized.replace(/\s+/g, '');
  return rule.titleContains.some(fragment =>
    normalized.includes(fragment.normalized) || compact.includes(fragment.compact)
  );
}

module.exports = {
  normalizeVideoTitle,
  loadChannelVideoAllowlist,
  isChannelVideoAllowed
};
