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
function render({ kind, id, title, description, image, baseUrl = BASE }) {
    const url = `${baseUrl}compartir/${kind}/${id}.html`;
    const target = `${baseUrl}?${kind === 'canco' ? 'v' : 'channel'}=${encodeURIComponent(id)}`;
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
// Mateix títol i slug que fa servir l'app en compartir (js/utils/share-codecs.js).
function shareCodecs() {
    const vm = require('node:vm');
    const ctx = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js/utils/share-codecs.js'), 'utf8'), ctx);
    return ctx.window.SegueixApp.utils.shareCodecs;
}
// Pàgina d'una ràdio: el títol «Ràdio <nom>» és el que surt a la previsualització de WhatsApp. Redirigeix a l'app
// amb el mateix ?importData= (la ràdio compartida) que porta l'enllaç.
function renderRadio({ slug, title, description, baseUrl = BASE }) {
    const url = `${baseUrl}compartir/radio/${slug}.html`;
    const image = `${baseUrl}img/compartir.png`;
    return `<!doctype html>
<html lang="ca"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} · Segueix Música</title>
<meta name="description" content="${escape(description)}">
<meta property="og:type" content="music.radio_station">
<meta property="og:site_name" content="Segueix Música">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${escape(url)}">
<meta property="og:image" content="${escape(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escape(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escape(title)}">
<meta name="twitter:description" content="${escape(description)}">
<meta name="twitter:image" content="${escape(image)}">
<meta name="robots" content="noindex">
</head><body><h1>${escape(title)}</h1>
<p><a href="${escape(baseUrl)}">Obre Segueix Música</a></p>
<script>const target=new URL(${JSON.stringify(baseUrl)});target.search=location.search;target.hash=location.hash;location.replace(target.href);</script>
</body></html>\n`;
}
function generateRadios(root, out, channels, baseUrl = BASE) {
    const read = file => {
        try { return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); } catch { return null; }
    };
    const codecs = shareCodecs();
    const pages = new Map();
    const add = (name, description) => {
        const title = codecs.radioShareTitle(name);
        const slug = codecs.radioShareSlug(title);
        if (slug && !pages.has(slug)) pages.set(slug, { slug, title, description });
    };
    // Estils (els noms de la barra d'estils) i les ràdios generals
    let styles = [];
    try { styles = require(path.join(__dirname, '..', 'js/music-categories.js')).CATEGORY_GROUPS.map(group => group.label); } catch { /* sense estils */ }
    for (const style of styles) add(style, `Ràdio ${style} de música en català a Segueix Música.`);
    add('La teva ràdio', 'Una ràdio de música en català feta al teu gust, a Segueix Música.');
    add('Ràdio de directes', 'Actuacions en directe de música en català, a Segueix Música.');
    // «A prop teu»: tots els municipis dels cinc territoris i els llocs dels orígens dels artistes
    const places = new Set(read('data/municipis-radio.json')?.noms || []);
    for (const file of ['data/origens-artistes.json', 'data/proximitat-musical.json']) {
        for (const place of Object.values(read(file)?.places || {})) if (place?.name) places.add(place.name);
    }
    for (const place of places) add(`A prop de ${place}`, `Els artistes de prop de ${place}, a Segueix Música.`);
    // Ràdio de cada artista
    for (const channel of Object.values(channels || {})) {
        const artist = channel?.artists?.join(', ') || channel?.name;
        if (artist && !/ - topic$/i.test(artist)) add(`Ràdio de ${artist}`, `Les cançons de ${artist} a Segueix Música.`);
    }
    const dir = path.join(out, 'radio');
    fs.mkdirSync(dir, { recursive: true });
    for (const page of pages.values()) fs.writeFileSync(path.join(dir, `${page.slug}.html`), renderRadio({ ...page, baseUrl }));
    // Pàgina genèrica (ràdios sense nom conegut: cerques, categories pròpies…) i la llista que llegeix l'app
    fs.writeFileSync(path.join(dir, 'index.html'), renderRadio({ baseUrl, slug: 'index', title: 'Ràdio de Segueix Música', description: 'Escolta aquesta ràdio de música en català a Segueix Música.' }));
    fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify([...pages.keys()].sort()));
    return pages.size;
}
function generate(root, options = {}) {
    const baseUrl = options.baseUrl || BASE;
    const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    const feed = read('data/feed.json');
    const hidden = new Set(read('data/hidden-videos.json').videoIds);
    const channels = options.channels || feed.channels || {};
    const videos = new Map();
    const archiveDir = path.join(root, 'data/archive/channels');
    if (fs.existsSync(archiveDir)) for (const file of fs.readdirSync(archiveDir).filter(f => f.endsWith('.json'))) {
        const archive = read(`data/archive/channels/${file}`);
        for (const video of archive.videos || []) videos.set(video.id, video);
    }
    for (const video of feed.videos || []) videos.set(video.id, video);
    if (options.videos) {
        videos.clear();
        for (const video of options.videos) videos.set(video.id, video);
    }
    const out = options.outputDir || path.join(root, 'compartir');
    // Només se suprimeix la carpeta generada per aquest script.
    fs.rmSync(out, { recursive: true, force: true });
    for (const kind of ['artista', 'canco']) fs.mkdirSync(path.join(out, kind), { recursive: true });
    const write = data => fs.writeFileSync(path.join(out, data.kind, `${data.id}.html`), (options.renderEntity || render)({ ...data, baseUrl }));
    let songs = 0;
    for (const [id, channel] of Object.entries(channels)) {
        if (!validId(id)) continue;
        const title = channel.artists?.join(', ') || channel.name;
        write({ kind: 'artista', id, title, description: `Escolta ${title} a Segueix Música.`, image: imageUrl(channel.avatar, `${baseUrl}img/compartir.png`) });
    }
    for (const [id, video] of videos) {
        if (!validId(id) || hidden.has(id) || !channels[video.channelId]) continue;
        const channel = channels[video.channelId];
        const artist = channel.artists?.join(', ') || channel.name || video.channelTitle || '';
        const title = cleanTitle(video.title, { artists: [artist, video.channelTitle, channel.name].filter(Boolean) });
        write({ kind: 'canco', id, title: `${title} · ${artist}`, description: `Escolta «${title}» de ${artist} a Segueix Música.`, image: imageUrl(video.thumbnail, `https://i.ytimg.com/vi/${id}/hqdefault.jpg`) });
        songs++;
    }
    const radios = generateRadios(root, out, channels, baseUrl);
    return { artists: Object.keys(channels).length, songs, radios };
}
module.exports = { render, renderRadio, generate };
if (require.main === module) console.log(generate(path.resolve(__dirname, '..')));

