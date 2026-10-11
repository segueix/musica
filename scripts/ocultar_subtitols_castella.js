'use strict';

// Oculta les cançons que ofereixen subtítols en castellà/espanyol (segons el títol o la descripció, vegeu
// scripts/lib/subtitols_castella.js): n'afegeix els IDs a data/hidden-videos.json, que el client aplica a tot
// (feed, cerques, ràdio) i que update_music_feed.js respecta en regenerar.
//
// Idempotent. A més, update_music_feed.js ja descarta aquestes cançons cada vegada que genera el feed (el workflow
// «Actualitzar feed musical» corre cada dia), de manera que les cançons noves no hi entren. Aquest script serveix per
// amagar de seguida les que ja són al feed actual, sense esperar a la regeneració.
// Ús: node scripts/ocultar_subtitols_castella.js [--dry-run]

const fs = require('fs');
const path = require('path');
const { declaracio } = require('./lib/subtitols_castella');
const { loadChannelVideoAllowlist, allowsSpanishSubtitles } = require('./lib/filtre_videos_canal');

const FEED_FILE = path.join(process.cwd(), 'data', 'feed.json');
const HIDDEN_FILE = path.join(process.cwd(), 'data', 'hidden-videos.json');

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const feed = JSON.parse(fs.readFileSync(FEED_FILE, 'utf8'));
  const hidden = JSON.parse(fs.readFileSync(HIDDEN_FILE, 'utf8'));
  const ids = new Set((hidden.videoIds || []).map(String));
  const nous = [];
  const selections = loadChannelVideoAllowlist(path.join(process.cwd(), 'data', 'music-channel-video-allowlist.json'));
  for (const video of feed.videos || []) {
    const frase = declaracio(video);
    if (frase && !allowsSpanishSubtitles(selections, video) && !ids.has(String(video.id))) nous.push({ video, frase });
  }

  nous.forEach(({ video, frase }) => console.log(`- ${video.id} · ${video.channelTitle} · ${video.title} · «${frase}»`));
  console.log(`${dryRun ? '🔎' : '🙈'} ${nous.length} cançons amb subtítols en castellà${dryRun ? ' (simulació)' : ' ocultades'}.`);
  if (dryRun || nous.length === 0) return;

  hidden.videoIds = [...ids, ...nous.map(({ video }) => String(video.id))];
  fs.writeFileSync(HIDDEN_FILE, `${JSON.stringify(hidden, null, 2)}\n`);
}

if (require.main === module) main();
module.exports = { main };
