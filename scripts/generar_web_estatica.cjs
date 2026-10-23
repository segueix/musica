// Generació local: no consulta YouTube ni necessita Functions, KV o credencials.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { selectCatalog, writePublicCatalog } = require('./lib/cataleg_public.js');
const { cleanTitle } = require('../js/song-title.js');
const { CATEGORY_GROUPS } = require('../js/music-categories.js');
const { generate: generateSharing } = require('./generar_pagines_compartir.js');
const { loadChannelVideoAllowlist, isChannelVideoAllowed } = require('./lib/filtre_videos_canal.js');
const { videoRoute, videoRewrite, collectionRewrites } = require('./lib/rutes_publiques.js');
const DEFAULT_URL = 'https://musica.segueix.cat/';
const MARKER = '.segueix-static-output';
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const json = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const slug = value => normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const STYLES = ['urbana', 'pop', 'rock', 'canco-autor', 'indie', 'rap-hip-hop', 'folk-arrel', 'electronica', 'ska-reggae', 'rumba-mestissatge', 'punk', 'heavy-metal', 'jazz-blues', 'infantil', 'altres-estils'];

function siteBase(value) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
        throw new Error('SITE_URL ha de ser una URL pública HTTPS sense credencials, consulta ni fragment.');
    }
    url.pathname = url.pathname.replace(/\/+$/, '') + '/';
    return url.href;
}

function read(root, file) {
    return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

function channelRecords(channels) {
    // Reutilitza exactament els slugs del client, incloses les col·lisions de noms.
    const ctx = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/features/channel.js'), 'utf8'), ctx);
    return ctx.window.SegueixApp.features.channel.buildCreatorRecords(channels);
}

function loadCatalog(root, options = {}) {
    const feed = read(root, 'data/feed.json');
    const listed = read(root, 'js/channels-ca.json').channels;
    const hiddenData = read(root, 'data/hidden-videos.json');
    const rules = read(root, 'data/music-channel-video-allowlist.json');
    const history = read(root, 'data/historial-musical.json');
    const identities = read(root, 'data/artistes-musica.json').artists;
    if (!feed.channels || !Array.isArray(feed.videos) || !Array.isArray(listed) ||
        !Array.isArray(hiddenData.videoIds) || !rules.channels || !Array.isArray(history.videos) || !Array.isArray(identities)) {
        throw new Error('Catàleg incomplet: no es publica una web parcial.');
    }
    const allowlist = loadChannelVideoAllowlist(path.join(root, 'data/music-channel-video-allowlist.json'));
    const restrictedFile = path.join(root, 'data/videos-restringits.json');
    const restricted = fs.existsSync(restrictedFile) ? read(root, 'data/videos-restringits.json') : {};
    const hidden = new Set([...hiddenData.videoIds, ...Object.keys(restricted.videos || {})]);
    const records = channelRecords(listed);
    const identityByChannel = new Map();
    identities.forEach((artist, index) => {
        for (const channel of artist.youtube?.channels || []) {
            if (!identityByChannel.has(channel.id)) identityByChannel.set(channel.id, { key: index, artist, channel });
        }
    });
    const channels = new Map();
    for (const record of records) {
        const current = feed.channels[record.id];
        if (!current || allowlist.get(record.id)?.blocked) continue;
        const identity = identityByChannel.get(record.id);
        // El catàleg públic el delimiten els canals del feed, no el camp active dels candidats.
        if (identity?.artist.reviewStatus === 'rebutjat') continue;
        const source = listed.find(item => item.id === record.id);
        const name = identity?.artist.displayName || identity?.artist.name || current.artists?.join(', ') || current.name || record.name;
        channels.set(record.id, { ...source, ...current, ...record, ...identity?.channel, slug: record.slug, name,
            identityKey: identity ? `artist:${identity.key}` : `channel:${record.id}` });
    }
    const videos = new Map(history.videos.map(video => [video.id, video]));
    const archives = path.join(root, 'data/archive/channels');
    if (fs.existsSync(archives)) {
        for (const file of fs.readdirSync(archives).filter(file => file.endsWith('.json')).sort()) {
            const data = read(archives, file);
            if (!Array.isArray(data.videos)) throw new Error(`Arxiu invàlid: ${file}`);
            for (const video of data.videos) videos.set(video.id, video);
        }
    }
    for (const video of feed.videos) videos.set(video.id, video);
    const songs = [...videos.values()].filter(video => VIDEO_ID.test(video.id) && !hidden.has(video.id) &&
        channels.has(video.channelId) && !video.isShort &&
        isChannelVideoAllowed(allowlist, video.channelId, video.title, video.id)).map(video => {
        const artist = channels.get(video.channelId);
        return { ...video, title: cleanTitle(video.title, { artists: [artist.name, video.channelTitle].filter(Boolean) }),
            artist: artist.name, categories: [...new Set([...(video.categories || []), ...(artist.categories || [])])] };
    }).sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0) || a.id.localeCompare(b.id));
    const groups = new Map();
    for (const channel of channels.values()) {
        // Només fusiona canals vinculats al mateix artista editorial, mai homònims.
        const key = channel.identityKey;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(channel);
    }
    const artists = [];
    const artistByChannel = new Map();
    for (const group of groups.values()) {
        group.sort((a, b) => Number(Boolean(b.primary)) - Number(Boolean(a.primary)) ||
            Number(b.type === 'official') - Number(a.type === 'official') || a.id.localeCompare(b.id));
        const artist = { ...group[0], channelIds: group.map(c => c.id) };
        artists.push(artist);
        for (const channel of group) artistByChannel.set(channel.id, artist);
    }
    artists.sort((a, b) => a.name.localeCompare(b.name, 'ca'));
    const albumFile = path.join(root, 'data/albums-musica.json');
    return selectCatalog({ channels, artists, artistByChannel, songs }, {
        now: options.now ?? Date.now(), albums: fs.existsSync(albumFile) ? read(root, 'data/albums-musica.json') : null,
    });
}

function build(root, options = {}) {
    root = path.resolve(root);
    const base = siteBase(options.siteUrl || process.env.SITE_URL || DEFAULT_URL);
    const basePath = new URL(base).pathname;
    const sourceCommit = options.sourceCommit || process.env.SOURCE_COMMIT || null;
    if (sourceCommit && !/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error('SOURCE_COMMIT invàlid.');
    const out = path.resolve(options.outDir || path.join(root, '_site'));
    if (out === root || root.startsWith(out + path.sep) ||
        (fs.existsSync(out) && fs.readdirSync(out).length && !fs.existsSync(path.join(out, MARKER)))) {
        throw new Error('La sortida ha de ser una carpeta buida o generada per aquest script.');
    }
    const catalog = loadCatalog(root, options);
    const { channels, artists, artistByChannel, songs } = catalog;
    const staging = `${out}.tmp-${process.pid}`;
    if (fs.existsSync(staging)) throw new Error('Ja existeix una generació temporal.');
    fs.mkdirSync(staging, { recursive: true });
    const write = (file, content) => {
        const target = path.join(staging, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content);
    };
    const url = file => base + file;
    const artistPath = artist => `creador/${artist.slug}/`;
    // GitHub Pages no interpreta _redirects; conserva les pàgines físiques en aquell allotjament.
    const readableVideos = !new URL(base).hostname.endsWith('.github.io');
    const songPath = song => readableVideos ? videoRoute(song) : `compartir/canco/${song.id}.html`;
    const routes = { base: basePath, artists: {}, videos: {}, sections: {} };
    const pages = [base];
    const image = (value, fallback) => {
        try { const u = new URL(value); return u.protocol === 'https:' ? u.href : fallback; } catch { return fallback; }
    };
    const layout = ({ title, description, canonical, body, schema, picture, type = 'website', noindex = false }) => `<!doctype html>
<html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} · Segueix Música</title><meta name="description" content="${escape(description)}">
<meta name="robots" content="${noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large'}">
<link rel="canonical" href="${escape(canonical)}">
<meta property="og:type" content="${type}"><meta property="og:site_name" content="Segueix Música"><meta property="og:locale" content="ca_ES">
<meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(canonical)}">
<meta property="og:image" content="${escape(picture || url('img/compartir.png'))}"><meta property="og:image:alt" content="${escape(title)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${escape(picture || url('img/compartir.png'))}">
<link rel="stylesheet" href="${basePath}css/static-seo.css"><script defer src="${basePath}js/static-seo.js?v=20261023-readable-routes-1"></script>
${schema ? `<script type="application/ld+json">${json(schema)}</script>` : ''}</head>
<body><header><a class="brand" href="${basePath}">Segueix <span>Música</span></a><nav aria-label="Principal"><a href="${basePath}creadors/">Artistes</a><a href="${basePath}novetats/">Novetats</a><a href="${basePath}descobreix/">Estils</a></nav></header>
<main><p class="eyebrow">La teva plaça musical en català</p><h1>${escape(title)}</h1><p class="lead">${escape(description)}</p>${body}</main>
<footer><a href="${basePath}">Obre Música</a> · <a href="${basePath}privacitat.html">Privacitat</a></footer></body></html>\n`;
    const cards = items => `<ul class="songs">${items.map(song => `<li><a href="${basePath}${songPath(song)}"><img loading="lazy" width="320" height="180" src="${escape(image(song.thumbnail, `https://i.ytimg.com/vi/${song.id}/hqdefault.jpg`))}" alt=""><strong>${escape(song.title)}</strong><span>${escape(song.artist)}</span></a></li>`).join('')}</ul>`;
    const artistLinks = items => `<ul class="artists">${items.map(artist => `<li><a href="${basePath}${artistPath(artist)}">${escape(artist.name)}</a></li>`).join('')}</ul>`;
    const collectionSchema = (title, canonical, items) => ({ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: canonical, inLanguage: 'ca',
        mainEntity: { '@type': 'ItemList', itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name || item.title, url: url(item.id && VIDEO_ID.test(item.id) ? songPath(item) : artistPath(item)) })) } });
    const aliases = (file, target, title) => write(file, layout({ title, description: 'Continua a la pàgina de Música.', canonical: url(target), noindex: true,
        body: `<p><a class="button" data-static-redirect href="${basePath}${target}">Continua a ${escape(title)}</a></p>` }));

    try {
        for (const folder of ['js', 'css', 'img', 'data']) {
            fs.cpSync(path.join(root, folder), path.join(staging, folder), { recursive: true,
                filter: source => !source.endsWith('.b64') });
        }
        for (const file of ['index.html', 'manifest.json', 'privacitat.html', 'info-youtubers.html', 'admin-musica.html', 'revisio-artistes.html', 'revisio-cancons.html', 'revisio-noms-artistes.html', 'sw.js']) {
            if (fs.existsSync(path.join(root, file))) fs.copyFileSync(path.join(root, file), path.join(staging, file));
        }
        // Associació amb segueix.cat (scope_extensions del manifest): l'app de Música s'hi pot obrir sense la franja
        // «fora de l'app» de Chrome a l'ordinador. Cal la carpeta .well-known a l'arrel publicada.
        if (fs.existsSync(path.join(root, '.well-known'))) {
            fs.cpSync(path.join(root, '.well-known'), path.join(staging, '.well-known'), { recursive: true });
            write('_headers', '/.well-known/web-app-origin-association\n  Content-Type: application/json\n  Access-Control-Allow-Origin: *\n\n/.well-known/assetlinks.json\n  Content-Type: application/json\n  Cache-Control: public, max-age=300\n');
        }
        const publicData = writePublicCatalog(root, staging, catalog);
        let index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
        // Només canvia les metadades del capçal; els enllaços editorials a Segueix es conserven.
        const headEnd = index.indexOf('</head>');
        index = index.slice(0, headEnd).replaceAll(DEFAULT_URL, base).replaceAll('https://segueix.github.io/musica/', base).replaceAll('https://segueix.cat/', base) + index.slice(headEnd);
        index = index.replace('<head>', `<head><base href="${basePath}">`);
        index = index.replace('</head>', `<script>window.SEGUEIX_STATIC_SITE=true;window.SEGUEIX_CATALOG_POLICY=1;window.SEGUEIX_PUBLIC_URL=${json(base)};</script></head>`);
        write('index.html', index);

        for (const artist of artists) {
            const relative = artistPath(artist);
            const model = catalog.models.get(artist.id);
            const selected = [...(model.best ? [model.best] : []), ...model.recent, ...model.rest];
            const description = `Escolta ${artist.name}: cançons i vídeos a Segueix Música.`;
            write(relative + 'index.html', layout({ title: artist.name, description, canonical: url(relative), type: 'profile',
                picture: image(artist.avatar, url('img/compartir.png')),
                body: `<a class="button" href="${basePath}?channel=${encodeURIComponent(artist.id)}">Obre l’artista a Música</a>${model.best ? `<h2>La més escoltada</h2>${cards([model.best])}` : ''}${model.recent.length ? `<h2>Novetats</h2>${cards(model.recent)}` : ''}${model.rest.length ? `<h2>Més escoltades</h2>${cards(model.rest)}` : ''}`,
                schema: collectionSchema(artist.name, url(relative), selected) }));
            pages.push(url(relative));
        }
        for (const channel of channels.values()) {
            const target = artistPath(artistByChannel.get(channel.id));
            routes.artists[channel.slug] = target;
            routes.artists[channel.id] = target;
            if (channel.slug !== artistByChannel.get(channel.id).slug) aliases(`creador/${channel.slug}/index.html`, target, channel.name);
            aliases(`creador/${channel.id}/index.html`, target, channel.name);
        }
        const songById = new Map(songs.map(song => [song.id, song]));
        const shared = generateSharing(root, { baseUrl: base, outputDir: path.join(staging, 'compartir'),
            channels: Object.fromEntries(channels), videos: songs,
            renderEntity(data) {
                if (data.kind === 'artista') {
                    const artist = artistByChannel.get(data.id);
                    return layout({ title: artist.name, description: data.description, canonical: url(artistPath(artist)), picture: data.image, noindex: true,
                        body: `<a class="button" data-static-redirect href="${basePath}${artistPath(artist)}">Obre l’artista</a>` });
                }
                const song = songById.get(data.id);
                const canonical = url(songPath(song));
                const artist = artistByChannel.get(song.channelId);
                const description = `Escolta «${song.title}» de ${song.artist} a Segueix Música.`;
                const published = Date.parse(song.publishedAt);
                const schema = Number.isFinite(published) ? { '@context': 'https://schema.org', '@type': 'VideoObject', name: song.title, description,
                    thumbnailUrl: data.image, uploadDate: new Date(published).toISOString(), url: canonical,
                    embedUrl: `https://www.youtube-nocookie.com/embed/${song.id}` } : null;
                routes.videos[song.id] = songPath(song);
                pages.push(canonical);
                return layout({ title: song.title, description, canonical, picture: data.image, type: 'music.song', schema,
                    body: `<p><a href="${basePath}${artistPath(artist)}">${escape(song.artist)}</a></p>
<div class="player" data-static-player><img width="1280" height="720" src="${escape(data.image)}" alt="${escape(song.title)}"></div>
<p><button class="button" data-video-id="${song.id}" type="button">Accepta YouTube i reprodueix</button> <a class="button secondary" data-app-video href="${basePath}?v=${song.id}">Obre a Música</a></p>
<p class="notice">El reproductor de YouTube només es carrega quan ho demanes. S’hi apliquen les condicions i la privacitat de Google/YouTube.</p>` });
            } });

        const sections = [
            { key: 'novetats', label: 'Novetats', title: 'Novetats de música en català', songs: [...new Map([...catalog.models.values()].flatMap(model => model.recent).map(song => [song.id, song])).values()].sort((a, b) => Date.parse(b.originalDate || b.publishedAt) - Date.parse(a.originalDate || a.publishedAt)).slice(0, 60) },
            { key: 'descobreix', label: 'Descobreix', title: 'Descobreix música en català', songs: songs.slice(0, 24) },
            ...CATEGORY_GROUPS.map((group, i) => ({ key: STYLES[i], label: group.label, title: `${group.label} · música en català`,
                songs: songs.filter(song => song.categories.some(category => [group.label, ...group.genres].map(normalize).includes(normalize(category)))).slice(0, 60) })),
        ];
        for (const section of sections) {
            const relative = section.key + '/';
            routes.sections[section.key] = relative;
            const description = `Artistes i cançons de ${section.label} a Segueix Música.`;
            const relatedIds = new Set(section.songs.map(song => artistByChannel.get(song.channelId).id));
            const related = artists.filter(artist => relatedIds.has(artist.id));
            const styles = `<nav class="styles" aria-label="Estils">${CATEGORY_GROUPS.map((group, i) => `<a href="${basePath}${STYLES[i]}/">${escape(group.label)}</a>`).join('')}</nav>`;
            write(relative + 'index.html', layout({ title: section.title, description, canonical: url(relative),
                body: `<a class="button" href="${basePath}?style=${encodeURIComponent(section.label)}">Obre a Música</a>${styles}<h2>Cançons</h2>${cards(section.songs)}<h2>Artistes</h2>${artistLinks(related)}`,
                schema: collectionSchema(section.title, url(relative), section.songs) }));
            pages.push(url(relative));
        }
        const artistsUrl = url('creadors/');
        write('creadors/index.html', layout({ title: 'Artistes i grups', description: 'Explora els artistes i grups de Segueix Música.', canonical: artistsUrl,
            body: artistLinks(artists), schema: collectionSchema('Artistes i grups', artistsUrl, artists) }));
        pages.push(artistsUrl);
        for (const [old, target] of Object.entries({ 'punk-metal': 'punk/', classica: 'descobreix/', 'musica-tv': 'descobreix/', 'segueix-tv': 'descobreix/' })) {
            aliases(old + '/index.html', target, 'Segueix Música'); routes.sections[old] = target;
        }
        write('data/static-routes.json', JSON.stringify(routes));
        if (readableVideos) write('_redirects', videoRewrite(basePath) + '\n' + collectionRewrites(basePath) + '\n');
        write('data/video-channels.json', JSON.stringify(Object.fromEntries(songs.map(song => [song.id, song.channelId]))));
        write('404.html', layout({ title: 'Aquesta pàgina no està disponible', description: 'Pots tornar a Música o explorar els artistes.', canonical: base, noindex: true,
            body: `<div data-static-recovery data-base="${basePath}"><a class="button" href="${basePath}">Torna a Música</a></div>` }));

        const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n';
        const xmlIndex = files => xmlHeader + '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + files.map(file => `<sitemap><loc>${escape(url(file))}</loc></sitemap>`).join('') + '</sitemapindex>\n';
        const sitemapFiles = [];
        for (let i = 0; i < pages.length; i += 5000) {
            const file = `sitemaps/pages-${Math.floor(i / 5000) + 1}.xml`;
            write(file, xmlHeader + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + pages.slice(i, i + 5000).map(page => `<url><loc>${escape(page)}</loc></url>`).join('') + '</urlset>\n');
            sitemapFiles.push(file);
        }
        const videoFiles = [];
        for (let i = 0; i < songs.length; i += 1000) {
            const file = `video-sitemap/${Math.floor(i / 1000) + 1}.xml`;
            write(file, xmlHeader + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">' + songs.slice(i, i + 1000).map(song => `<url><loc>${escape(url(songPath(song)))}</loc><video:video><video:thumbnail_loc>${escape(image(song.thumbnail, `https://i.ytimg.com/vi/${song.id}/hqdefault.jpg`))}</video:thumbnail_loc><video:title>${escape(song.title)}</video:title><video:description>${escape(`Escolta ${song.title} de ${song.artist}.`)}</video:description><video:player_loc>${escape(`https://www.youtube-nocookie.com/embed/${song.id}`)}</video:player_loc></video:video></url>`).join('') + '</urlset>\n');
            videoFiles.push(file);
        }
        write('sitemap.xml', xmlIndex(sitemapFiles));
        write('video-sitemap.xml', xmlIndex(videoFiles));
        write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${url('sitemap.xml')}\nSitemap: ${url('video-sitemap.xml')}\n`);
        const optimization = require('./optimitzar_web_estatica.cjs').optimize(root, staging);
        // El hash ha de correspondre a l’HTML de sortida, amb el domini i el mode estàtic.
        fs.mkdirSync(path.join(staging, 'scripts'), { recursive: true });
        fs.copyFileSync(path.join(root, 'scripts/actualitzar_versio_sw.js'), path.join(staging, 'scripts/actualitzar_versio_sw.js'));
        require('node:child_process').execFileSync(process.execPath, [path.join(staging, 'scripts/actualitzar_versio_sw.js')], { stdio: 'pipe' });
        fs.rmSync(path.join(staging, 'scripts'), { recursive: true });
        const report = { artists: artists.length, channels: channels.size, songs: songs.length, styles: CATEGORY_GROUPS.length,
            pages: pages.length, radios: shared.radios, baseUrl: base, sourceCommit,
            builtAt: new Date(options.now ?? Date.now()).toISOString(), catalog: catalog.counts, publicData, optimization };
        write(MARKER, 'Generated by generar_web_estatica.cjs\n');
        write('static-build.json', JSON.stringify(report, null, 2) + '\n');
        fs.rmSync(out, { recursive: true, force: true });
        fs.renameSync(staging, out);
        return report;
    } catch (error) {
        fs.rmSync(staging, { recursive: true, force: true });
        throw error;
    }
}

module.exports = { build, loadCatalog, siteBase };
if (require.main === module) {
    const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
    console.log(build(path.resolve(__dirname, '..'), { siteUrl: arg('site-url'), outDir: arg('out') }));
}
