'use strict';

// Porta de publicació sense xarxa ni dependències: comprova el paquet que es pujarà.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function validate(outDir, options = {}) {
    const root = path.resolve(outDir);
    const fail = message => { throw new Error(`Paquet estàtic: ${message}`); };
    const file = relative => {
        const target = path.resolve(root, relative);
        if (!target.startsWith(root + path.sep)) fail(`ruta fora del paquet: ${relative}`);
        if (!fs.existsSync(target) || !fs.statSync(target).isFile()) fail(`falta ${relative}`);
        return target;
    };
    const read = relative => fs.readFileSync(file(relative), 'utf8');
    const json = relative => JSON.parse(read(relative));
    file('.segueix-static-output');
    const report = json('static-build.json');
    const base = new URL(report.baseUrl);
    if (base.protocol !== 'https:' || base.href !== report.baseUrl || !base.pathname.endsWith('/') || base.search || base.hash || base.username || base.password) fail('URL pública invàlida');
    const expectedUrl = options.siteUrl || process.env.SITE_URL;
    if (expectedUrl && new URL(expectedUrl.replace(/\/+$/, '') + '/').href !== base.href) fail('URL diferent de la destinació');
    const expectedCommit = options.sourceCommit || process.env.SOURCE_COMMIT;
    if (expectedCommit && report.sourceCommit !== expectedCommit) fail('commit diferent del checkout');
    if (report.sourceCommit !== null && !/^[a-f0-9]{40}$/.test(report.sourceCommit)) fail('commit invàlid');

    let files = 0, bytes = 0;
    const forbidden = /^(?:\.git|\.github|\.agents|node_modules|functions|scripts|tests|docs|_worker\.js|\.env(?:\..*)?)$/;
    function walk(folder) {
        for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
            if (forbidden.test(entry.name)) fail(`fitxer de desenvolupament o servidor: ${entry.name}`);
            const target = path.join(folder, entry.name);
            const stat = fs.lstatSync(target);
            if (stat.isSymbolicLink() || stat.nlink > 1 && stat.isFile()) fail(`enllaç no publicable: ${target}`);
            if (stat.isDirectory()) walk(target);
            else if (stat.isFile()) { files++; bytes += stat.size; }
            else fail(`tipus de fitxer no publicable: ${target}`);
        }
    }
    walk(root);
    for (const required of ['index.html', '404.html', 'sw.js', 'css/static-seo.css', 'js/static-seo.js',
        'data/feed.json', 'data/historial-musical.json', 'data/hidden-videos.json', 'js/channels-ca.json',
        'data/music-taxonomy.json', 'js/vendor/lucide.js', 'js/vendor/lz-string.js',
        'js/vendor/sortable.js', 'js/vendor/qr-code-styling.js']) file(required);

    const localUrlFile = value => {
        const url = new URL(value, base);
        if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) fail(`URL fora de la destinació: ${value}`);
        const relative = decodeURIComponent(url.pathname.slice(base.pathname.length));
        return file(relative + (!relative || relative.endsWith('/') ? 'index.html' : ''));
    };
    const routes = json('data/static-routes.json');
    const channels = json('data/video-channels.json');
    if (routes.base !== base.pathname) fail('base del mapa de rutes incorrecta');
    for (const group of ['artists', 'videos', 'sections']) {
        for (const route of Object.values(routes[group])) localUrlFile(route);
    }
    const songs = Object.keys(routes.videos).sort();
    if (!songs.length || songs.length !== report.songs || JSON.stringify(songs) !== JSON.stringify(Object.keys(channels).sort())) fail('índex de cançons incoherent');
    if (Object.keys(routes.artists).filter(id => /^UC[A-Za-z0-9_-]{22}$/.test(id)).length !== report.channels || new Set(Object.values(routes.artists)).size !== report.artists) fail('índex d’artistes incoherent');
    for (const channel of Object.values(channels)) if (!routes.artists[channel]) fail(`canal sense artista: ${channel}`);

    const selection = json('data/hidden-videos.json').catalogSelection;
    if (selection?.version !== 1 || selection.popularLimit !== 21) fail('falta la política de selecció del catàleg');
    const selectedIds = new Set([...(selection.popularIds || []), ...Object.keys(selection.recentExpiry || {})]);
    if (selectedIds.size !== songs.length || songs.some(id => !selectedIds.has(id))) fail('selecció i rutes de cançons diferents');
    const published = new Set();
    for (const name of ['feed.json', 'historial-musical.json', 'history-pool.json']) {
        for (const video of json('data/' + name).videos || []) {
            if (!selectedIds.has(video.id)) fail(`cançó fora del límit a ${name}: ${video.id}`);
            if (name !== 'history-pool.json') published.add(video.id);
        }
    }
    if (published.size !== songs.length) fail('cançons seleccionades absents del feed i historial');
    for (const bucket of json('data/search_index_manifest.json').buckets || []) {
        for (const video of json('data/' + bucket.file)) {
            if (!selectedIds.has(video.i)) fail(`cançó fora del límit a la cerca: ${video.i}`);
        }
    }

    // Els sitemaps només poden anunciar fitxers d’aquest mateix paquet i domini.
    let pageCount = 0;
    for (const index of ['sitemap.xml', 'video-sitemap.xml']) {
        for (const match of read(index).matchAll(/<loc>(.*?)<\/loc>/g)) {
            const xml = fs.readFileSync(localUrlFile(match[1]), 'utf8');
            const locations = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)];
            for (const location of locations) localUrlFile(location[1]);
            if (index === 'sitemap.xml') pageCount += locations.length;
        }
    }
    if (pageCount !== report.pages) fail('recompte del sitemap incorrecte');
    const robots = read('robots.txt');
    for (const name of ['sitemap.xml', 'video-sitemap.xml']) if (!robots.includes(`Sitemap: ${base.href}${name}`)) fail('robots apunta a un altre domini');

    // Els assets de l’HTML no poden quedar silenciosament fora del precache.
    const index = read('index.html');
    if (!index.includes('SEGUEIX_STATIC_SITE=true')) fail('falta el mode estàtic');
    for (const tag of index.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
        const value = tag[0].match(/(?:src|href)\s*=\s*["']([^"']+)["']/i)?.[1];
        if (!value || /^(?:https?:)?\/\//.test(value) || value.startsWith('data:')) continue;
        localUrlFile(value);
    }
    const sw = read('sw.js');
    const block = sw.match(/const STATIC_ASSETS = \[([\s\S]*?)\];/)?.[1];
    if (!block) fail('falta el precache');
    const assets = [...block.matchAll(/'([^']+)'/g)].map(match => match[1]);
    if (!assets.includes('./') || !assets.includes('./index.html')) fail('falta la portada al precache');
    const paths = [...new Set(assets.map(asset => localUrlFile(asset)))].sort();
    const hash = crypto.createHash('sha256');
    for (const target of paths) hash.update(path.relative(root, target)).update('\0').update(fs.readFileSync(target)).update('\0');
    if (sw.match(/const CACHE_VERSION = '([^']+)'/)?.[1] !== hash.digest('hex').slice(0, 12)) fail('hash del Service Worker desfasat');
    return { ...report, files, bytes };
}

module.exports = { validate };
if (require.main === module) {
    const out = process.argv.find(arg => arg.startsWith('--out='))?.slice(6) || path.join(__dirname, '../_site');
    console.log(validate(out));
}
