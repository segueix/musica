'use strict';

// Aplica als fitxers ja generats (feed.json i channels-ca.json) el nom real del canal
// quan el nom guardat és només el handle. Idempotent; no necessita l'API de YouTube.
const fs = require('fs');
const path = require('path');
const { resolveChannelDisplayName } = require('./lib/nom_canal');

const FEED_FILE = path.join(process.cwd(), 'data', 'feed.json');
const CHANNELS_FILE = path.join(process.cwd(), 'js', 'channels-ca.json');

function main() {
  const feed = JSON.parse(fs.readFileSync(FEED_FILE, 'utf8'));
  const index = JSON.parse(fs.readFileSync(CHANNELS_FILE, 'utf8'));
  const renamed = new Map();

  for (const channel of index.channels || []) {
    const fixed = resolveChannelDisplayName(channel.name, channel.handle, channel.artists);
    if (fixed !== channel.name) {
      renamed.set(channel.id, fixed);
      console.log(`✏️  ${channel.name} → ${fixed}`);
      channel.name = fixed;
    }
  }
  for (const [id, channel] of Object.entries(feed.channels || {})) {
    const fixed = renamed.get(id) || resolveChannelDisplayName(channel.name, channel.handle, channel.artists);
    if (fixed !== channel.name) {
      renamed.set(id, fixed);
      channel.name = fixed;
    }
  }
  for (const video of feed.videos || []) {
    if (renamed.has(video.channelId)) video.channelTitle = renamed.get(video.channelId);
  }
  if (!renamed.size) return console.log('✅ Cap nom per corregir.');

  fs.writeFileSync(FEED_FILE, JSON.stringify(feed, null, 2) + '\n');
  fs.writeFileSync(CHANNELS_FILE, JSON.stringify(index, null, 2) + '\n');
  console.log(`✅ ${renamed.size} canals corregits.`);
}

main();
