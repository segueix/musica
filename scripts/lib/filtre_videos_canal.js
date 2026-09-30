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

function loadChannelVideoAllowlist(filePath, fsModule = require('fs')) {
  try {
    const payload = JSON.parse(fsModule.readFileSync(filePath, 'utf8'));
    const map = new Map();
    for (const [channelId, rule] of Object.entries(payload?.channels || {})) {
      const titles = new Set(
        (Array.isArray(rule?.allowedTitles) ? rule.allowedTitles : [])
          .map(normalizeVideoTitle)
          .filter(Boolean)
      );
      if (titles.size) map.set(channelId, titles);
    }
    return map;
  } catch {
    return new Map();
  }
}

function isChannelVideoAllowed(allowlist, channelId, title) {
  const allowed = allowlist.get(String(channelId || ''));
  if (!allowed) return true;
  return allowed.has(normalizeVideoTitle(title));
}

module.exports = {
  normalizeVideoTitle,
  loadChannelVideoAllowlist,
  isChannelVideoAllowed
};
