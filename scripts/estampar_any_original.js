'use strict';

// Estampa l'any original (originalYear...) als vídeos de data/feed.json sense YouTube API.
// La generació del feed (update_music_feed.js) ho fa sola; aquest script serveix per aplicar-ho al
// feed actual i és idempotent.  Ús: node scripts/estampar_any_original.js

const fs = require('fs');
const path = require('path');
const { parseManualDates, stampOriginalYear } = require('./lib/any_original_musical');
const { serializeFeed } = require('./lib/aprimar_feed');

const FEED = path.join(process.cwd(), 'data', 'feed.json');
const DATES = path.join(process.cwd(), 'data', 'musica-dates.json');

const manual = fs.existsSync(DATES) ? parseManualDates(JSON.parse(fs.readFileSync(DATES, 'utf8'))) : new Map();
const feed = JSON.parse(fs.readFileSync(FEED, 'utf8'));
let changed = 0;
let withYear = 0;
for (const video of feed.videos || []) {
  if (stampOriginalYear(video, manual)) changed++;
  if (video.originalYear) withYear++;
}
if (changed) fs.writeFileSync(FEED, serializeFeed(feed));
console.log(`✅ ${withYear}/${feed.videos.length} vídeos amb any original (${changed} actualitzats).`);
