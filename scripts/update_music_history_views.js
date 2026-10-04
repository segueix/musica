'use strict';

// Actualitza només viewCount de l'historial. No regenera el feed ni consulta canals.
// Cost: 1 unitat de videos.list per cada bloc de fins a 50 IDs, un cop per setmana.

const fs = require('fs');
const path = require('path');
const { buildStyleHistory, serializeStyleHistory } = require('./lib/arxiu_musical');

const ROOT = path.resolve(__dirname, '..');
const ARCHIVE_DIR = path.join(ROOT, 'data', 'archive', 'channels');
const HISTORY_POOL = path.join(ROOT, 'data', 'history-pool.json');
const STYLE_HISTORY = path.join(ROOT, 'data', 'historial-musical.json');
const API = 'https://www.googleapis.com/youtube/v3/videos';

function chunks(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main() {
  const key = process.env.YOUTUBE_API_KEY_SERVER;
  if (!key) throw new Error('Falta YOUTUBE_API_KEY_SERVER.');
  if (!fs.existsSync(ARCHIVE_DIR)) {
    console.log('ℹ️ Encara no hi ha historial musical.');
    return;
  }

  const files = fs.readdirSync(ARCHIVE_DIR).filter(file => file.endsWith('.json'));
  const archives = new Map();
  const ids = [];

  for (const file of files) {
    const full = path.join(ARCHIVE_DIR, file);
    const data = JSON.parse(fs.readFileSync(full, 'utf8'));
    archives.set(full, data);
    for (const video of data.videos || []) if (video?.id) ids.push(String(video.id));
  }

  const views = new Map();
  for (const batch of chunks([...new Set(ids)], 50)) {
    const url = new URL(API);
    url.searchParams.set('part', 'statistics');
    url.searchParams.set('id', batch.join(','));
    url.searchParams.set('key', key);
    const response = await fetch(url);
    const body = await response.json();
    if (!response.ok || body.error) throw new Error('YouTube API: ' + (body.error?.message || response.status));
    for (const item of body.items || []) views.set(item.id, Number(item.statistics?.viewCount || 0));
  }

  const at = new Date().toISOString();
  let changed = 0;
  for (const [file, data] of archives) {
    for (const video of data.videos || []) {
      if (!views.has(String(video.id))) continue;
      const next = views.get(String(video.id));
      if (Number(video.viewCount || 0) !== next) {
        video.viewCount = next;
        changed++;
      }
    }
    data.statsUpdatedAt = at;
    fs.writeFileSync(file, JSON.stringify(data));
  }

  if (fs.existsSync(HISTORY_POOL)) {
    const pool = JSON.parse(fs.readFileSync(HISTORY_POOL, 'utf8'));
    for (const video of pool.videos || []) {
      if (views.has(String(video.id))) video.viewCount = views.get(String(video.id));
    }
    pool.statsUpdatedAt = at;
    fs.writeFileSync(HISTORY_POOL, JSON.stringify(pool));
  }

  // Les cançons de l'historial que es barregen als estils porten les mateixes visualitzacions
  const styleHistory = buildStyleHistory([...archives.values()].flatMap(data => data.videos || []));
  fs.writeFileSync(STYLE_HISTORY, serializeStyleHistory(styleHistory, at));

  console.log(`✅ Historial: ${views.size} vídeos verificats; ${changed} comptadors actualitzats.`);
}

main().catch(error => {
  console.error('❌', error.stack || error.message);
  process.exit(1);
});
