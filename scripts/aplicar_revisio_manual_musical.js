'use strict';

// Aplica data/music-content-overrides.json i data/falsos-shorts.json al feed ja generat
// (data/feed.json, music-content-review.json i les dues auditories), sense YouTube API.
// Deixa el resultat que donaria la propera execució d'update_music_feed.js, així que els
// canvis són visibles a l'instant sense esperar el workflow. És idempotent.
//
// Ús: node scripts/aplicar_revisio_manual_musical.js

const fs = require('fs');
const path = require('path');
const { loadContentOverrides, applyOverridesToSnapshot } = require('./lib/revisio_manual_musical');

const DATA = path.join(process.cwd(), 'data');
const FILES = {
  feed: path.join(DATA, 'feed.json'),
  review: path.join(DATA, 'music-content-review.json'),
  contentAudit: path.join(DATA, 'music-content-audit.json'),
  feedAudit: path.join(DATA, 'music-feed-audit.json'),
  overrides: path.join(DATA, 'music-content-overrides.json'),
  falseShorts: path.join(DATA, 'falsos-shorts.json')
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

const overrides = loadContentOverrides(FILES.overrides);
const registry = fs.existsSync(FILES.falseShorts) ? readJson(FILES.falseShorts) : {};
const snapshot = {
  feed: readJson(FILES.feed),
  review: readJson(FILES.review),
  contentAudit: readJson(FILES.contentAudit),
  feedAudit: readJson(FILES.feedAudit),
  falseShortIds: new Set(Array.isArray(registry.falseShorts) ? registry.falseShorts : [])
};

const feedIds = new Set(snapshot.feed.videos.map(video => video.id));
const missing = [...overrides.keys()].filter(id => !feedIds.has(id));
if (missing.length) {
  console.warn('⚠️ Revisions sense vídeo al feed (ocults o esborrats):', missing.join(', '));
}

const before = JSON.stringify(snapshot.feed) + JSON.stringify(snapshot.review);
const changes = applyOverridesToSnapshot(snapshot, overrides);
const changed = before !== JSON.stringify(snapshot.feed) + JSON.stringify(snapshot.review);

if (!changed) {
  console.log('✅ Res a canviar: el feed ja reflecteix les revisions manuals.');
  process.exit(0);
}

writeJson(FILES.feed, snapshot.feed);
writeJson(FILES.review, snapshot.review);
writeJson(FILES.contentAudit, snapshot.contentAudit);
writeJson(FILES.feedAudit, snapshot.feedAudit);

for (const change of changes) console.log(`  ${change.from || '—'} → ${change.to}  ${change.id}  ${change.title}`);
console.log(`✅ ${changes.length} vídeos revisats; pendents de revisió: ${snapshot.review.count}.`);
