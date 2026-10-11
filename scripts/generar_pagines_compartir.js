// HTML estàtic per als robots de WhatsApp, Telegram i altres xarxes a GitHub Pages.
const fs = require('node:fs');
const path = require('node:path');
const { cleanTitle } = require('../js/song-title.js');
const BASE = 'https://segueix.github.io/musica/';
const escape = value => String(value || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const validId = id => /^[A-Za-z0-9_-]+$/.test(id);
function imageUrl(value, fallback) {
    if (typeof value !== 'string' || !value.trim()) return fallback;
    try {
        const url = new URL(value, BASE);
        return url.protocol === 'https:' ? url.href : fallback;
    } catch { return fallback; }
}
function render({ kind, id, title, description, image }) {
    const url = `${BASE}compartir/${kind}/${id}.html`;
    const target = `${BASE}?${kind === 'canco' ? 'v' : 'channel'}=${encodeURIComponent(id)}`;
    const safeTarget = JSON.stringify(target).replace(/</g, '\\u003c');
    return `<!doctype html>
<html lang="ca"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} · Segueix Música</title>
<meta name="description" content="${escape(description)}">
<meta property="og:type" content="${kind === 'canco' ? 'music.song' : 'profile'}">
<meta property="og:site_name" content="Segueix Música">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${escape(url)}">
<meta property="og:image" content="${escape(image)}">
<meta property="og:image:alt" content="${escape(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escape(title)}">
<meta name="twitter:description" content="${escape(description)}">
<meta name="twitter:image" content="${escape(image)}">
<link rel="canonical" href="${escape(url)}">
</head><body><h1>${escape(title)}</h1><img src="${escape(image)}" alt="${escape(title)}" width="320">
<p><a href="${escape(target)}">Obre a Segueix Música</a></p>
<script>const target=new URL(${safeTarget});const t=new URLSearchParams(location.search).get('t');if(t && Number(t)>0 && Number(t)<=86400)target.searchParams.set('t',t);target.hash=location.hash;location.replace(target.href);</script>
</body></html>\n`;
}
function generate(root) {
    const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    const feed = read('data/feed.json');
    const hidden = new Set(read('data/hidden-videos.json').videoIds);
    const channels = feed.channels || {};
    const videos = new Map();
    const archiveDir = path.join(root, 'data/archive/channels');
    if (fs.existsSync(archiveDir)) for (const file of fs.readdirSync(archiveDir).filter(f => f.endsWith('.json'))) {
        const archive = read(`data/archive/channels/${file}`);
        for (const video of archive.videos || []) videos.set(video.id, video);
    }
    for (const video of feed.videos || []) videos.set(video.id, video);
    const out = path.join(root, 'compartir');
    // Només se suprimeix la carpeta generada per aquest script.
    fs.rmSync(out, { recursive: true, force: true });
    for (const kind of ['artista', 'canco']) fs.mkdirSync(path.join(out, kind), { recursive: true });
    const write = data => fs.writeFileSync(path.join(out, data.kind, `${data.id}.html`), render(data));
    let songs = 0;
    for (const [id, channel] of Object.entries(channels)) {
        if (!validId(id)) continue;
        const title = channel.artists?.join(', ') || channel.name;
        write({ kind: 'artista', id, title, description: `Escolta ${title} a Segueix Música.`, image: imageUrl(channel.avatar, `${BASE}img/compartir.png`) });
    }
    for (const [id, video] of videos) {
        if (!validId(id) || hidden.has(id) || !channels[video.channelId]) continue;
        const channel = channels[video.channelId];
        const artist = channel.artists?.join(', ') || channel.name || video.channelTitle || '';
        const title = cleanTitle(video.title, { artists: [artist, video.channelTitle, channel.name].filter(Boolean) });
        write({ kind: 'canco', id, title: `${title} · ${artist}`, description: `Escolta «${title}» de ${artist} a Segueix Música.`, image: imageUrl(video.thumbnail, `https://i.ytimg.com/vi/${id}/hqdefault.jpg`) });
        songs++;
    }
    return { artists: Object.keys(channels).length, songs };
}
module.exports = { render, generate };
if (require.main === module) console.log(generate(path.resolve(__dirname, '..')));
