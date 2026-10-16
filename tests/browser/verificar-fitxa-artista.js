// Verificació en un navegador real de la fitxa d'artista (js/features/artist-page.js, redisseny 2026-10-16).
//
// NO forma part de `npm test`: és una eina opt-in, com verificar-artistes-categoria.js.
// Requisits (no són dependències del projecte):
//   npm i --no-save playwright-core sortablejs@1.15.6 lz-string@1.5.0
//   Un binari de Chromium (CHROMIUM_PATH=/ruta/al/chrome si no és a la ubicació per defecte)
//
// Ús:  node tests/browser/verificar-fitxa-artista.js
//      FITXA_SHOTS=/ruta/captures FITXA_CANAL=UC... node tests/browser/verificar-fitxa-artista.js
//
// Comprova, a 390 px i a 1280 px:
//   1) La foto de perfil ocupa tota la capçalera i el nom, les ràdios i compartir hi són al damunt.
//   2) La més escoltada és la cançó amb més visualitzacions; a l'ordinador va al costat de la capçalera.
//   3) La llista de cançons va per visualitzacions (de més a menys) i cada fila té el play i la cua.
//   4) El play d'una cançó engega una ràdio de l'artista que comença per aquella cançó.
//   5) La pàgina no es desborda i no hi ha errors de JavaScript.
// Les imatges de YouTube (i.ytimg.com, yt3.ggpht.com) es deixen carregar si hi ha xarxa (per a les captures).

const http = require('http');
const fs = require('fs');
const path = require('path');
let chromium;
try {
    ({ chromium } = require('playwright-core'));
} catch (_) {
    console.log('⏭️  playwright-core no instal·lat: verificació omesa.');
    process.exit(0);
}
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.FITXA_TEST_PORT || 8149);
const OUT = process.env.FITXA_SHOTS || '';
const CHANNEL = process.env.FITXA_CANAL || 'UC--8TyZ2PM0NFHWXCzQrUqw'; // The Tyets
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
};
const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const f = path.join(ROOT, u === '/' ? '/index.html' : u);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        res.writeHead(404);
        return res.end();
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
});
const readLib = file => {
    try {
        return fs.readFileSync(path.join(ROOT, 'node_modules', file), 'utf8');
    } catch (_) {
        return null;
    }
};
const sortable = readLib('sortablejs/Sortable.min.js');
const lz = readLib('lz-string/libs/lz-string.min.js');
let correcte = true;
const ok = (label, condition, detail) => {
    if (!condition) correcte = false;
    console.log(`${condition ? '✅' : '❌'} ${label}`, detail !== undefined ? JSON.stringify(detail) : '');
};

async function openArtist(browser, width, height) {
    const mobile = width <= 768;
    const ctx = await browser.newContext({
        viewport: { width, height },
        isMobile: mobile,
        hasTouch: mobile,
        serviceWorkers: 'block',
    });
    await ctx.addInitScript(() => {
        localStorage.setItem(
            'segueix_cookie_consent_v2',
            JSON.stringify({ version: 1, status: 'accepted', source: 'test', updatedAt: new Date().toISOString() })
        );
    });
    const page = await ctx.newPage();
    await page.route(/^https?:\/\/(?!localhost)/, route => {
        const url = route.request().url();
        if (/sortablejs/.test(url) && sortable)
            return route.fulfill({ status: 200, contentType: 'application/javascript', body: sortable });
        if (/lz-string/.test(url) && lz)
            return route.fulfill({ status: 200, contentType: 'application/javascript', body: lz });
        if (/^https:\/\/(i\.ytimg\.com|yt3\.(ggpht|googleusercontent)\.com)\//.test(url)) return route.continue();
        return route.abort();
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on(
        'console',
        message => message.type() === 'error' && console.log('   consola:', message.text().slice(0, 160))
    );
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
    await page.evaluate(() => document.getElementById('intro-splash')?.remove());
    await page.evaluate(id => window.openChannelProfile(id), CHANNEL);
    await page.waitForSelector('#apSongs:not([hidden]) .ap-song', { timeout: 20000 });
    await page.waitForTimeout(1200);
    return { ctx, page, errors };
}

const layout = page =>
    page.evaluate(() => {
        const rect = el => (el ? el.getBoundingClientRect().toJSON() : null);
        const hero = document.getElementById('apHero');
        const img = document.getElementById('channelProfileAvatar');
        const best = document.getElementById('apBest');
        const songs = [...document.querySelectorAll('#apSongs .ap-song')];
        const views = id => {
            const all = currentChannelLongVideos || [];
            return Number(all.find(video => String(video.id) === id)?.viewCount) || 0;
        };
        const ids = songs.map(row => row.querySelector('[data-ap-play]').dataset.apPlay);
        const maxViews = Math.max(
            ...(currentChannelLongVideos || []).filter(isSongVideo).map(v => Number(v.viewCount) || 0)
        );
        return {
            hero: rect(hero),
            img: rect(img),
            name: rect(document.getElementById('channelProfileName')),
            radio: rect(document.getElementById('apRadioArtist')),
            share: rect(document.getElementById('channelProfileShareBtn')),
            best: rect(best),
            bestId: best.querySelector('[data-ap-play]')?.dataset.apPlay || '',
            bestViews: views(best.querySelector('[data-ap-play]')?.dataset.apPlay || ''),
            maxViews,
            songViews: ids.map(views),
            rowsWithPlay: songs.every(row => row.querySelector('.ap-play') && row.querySelector('[data-ap-queue]')),
            shelves: [...document.querySelectorAll('#apShelves .ap-section-title')].map(el => el.textContent.trim()),
            stats: document.getElementById('apStats').textContent,
            pageWidth: document.documentElement.scrollWidth,
            viewport: window.innerWidth,
        };
    });

const inside = (inner, outer) =>
    inner &&
    outer &&
    inner.left >= outer.left - 1 &&
    inner.right <= outer.right + 1 &&
    inner.top >= outer.top - 1 &&
    inner.bottom <= outer.bottom + 1;

async function check(browser, width, height, label) {
    const { ctx, page, errors } = await openArtist(browser, width, height);
    const info = await layout(page);
    ok(
        `${label}: la foto omple la capçalera`,
        Math.abs(info.img.width - info.hero.width) < 3 && Math.abs(info.img.height - info.hero.height) < 3,
        [info.img, info.hero]
    );
    ok(
        `${label}: nom, ràdio i compartir damunt la foto`,
        inside(info.name, info.hero) && inside(info.radio, info.hero) && inside(info.share, info.hero)
    );
    ok(
        `${label}: la més escoltada és la de més visualitzacions`,
        info.bestViews === info.maxViews && info.maxViews > 0,
        [info.bestViews, info.maxViews]
    );
    if (width >= 960)
        ok(
            `${label}: la més escoltada al costat de la capçalera`,
            info.best.left >= info.hero.right && Math.abs(info.best.top - info.hero.top) < 2,
            [info.best, info.hero]
        );
    else ok(`${label}: la més escoltada sota la capçalera`, info.best.top >= info.hero.bottom);
    ok(
        `${label}: cançons per visualitzacions`,
        info.songViews.every((v, i, list) => i === 0 || list[i - 1] >= v),
        info.songViews.slice(0, 8)
    );
    ok(`${label}: cada cançó té play i cua`, info.rowsWithPlay);
    ok(`${label}: la pàgina no es desborda`, info.pageWidth <= info.viewport, [info.pageWidth, info.viewport]);
    console.log(`   ${label}: ${info.stats} · seccions: ${info.shelves.join(', ') || 'cap'}`);
    if (OUT) {
        await page.screenshot({ path: path.join(OUT, `fitxa-${width}.png`) });
        await page.screenshot({ path: path.join(OUT, `fitxa-${width}-sencera.png`), fullPage: true });
    }
    ok(`${label}: sense errors en obrir la fitxa`, errors.length === 0, errors);
    // Origen: el xip es desplega i porta «Ràdio d'aquí», que obre la ràdio «A prop teu» d'aquell lloc
    if (await page.isVisible('#apOrigin summary')) {
        await page.click('#apOrigin summary');
        const place = await page.$('#apOrigin [data-ap-place]');
        ok(`${label}: l'origen porta «Ràdio d'aquí»`, Boolean(place));
        if (place) {
            await place.click();
            await page.waitForSelector('dialog.near-dialog[open]', { timeout: 15000 }).catch(() => null);
            ok(`${label}: «Ràdio d'aquí» obre la ràdio del lloc`, await page.isVisible('dialog.near-dialog[open]'));
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }
    }
    // El play d'una cançó de la llista engega la ràdio de l'artista que hi comença
    const target = await page.$eval('#apSongs .ap-song:nth-child(3) [data-ap-play]', el => el.dataset.apPlay);
    await page.click('#apSongs .ap-song:nth-child(3) .ap-song__main');
    await page.waitForTimeout(800);
    const radio = await page.evaluate(() => ({
        first: String(activePlaylistQueue?.[0]?.id || ''),
        name: window.SegueixApp.features.musicQueue?.playlistName?.() || '',
        length: activePlaylistQueue?.length || 0,
    }));
    ok(
        `${label}: el play engega la ràdio per aquella cançó`,
        radio.first === target && radio.length > 1 && /^Ràdio de /.test(radio.name),
        radio
    );
    // A l'entorn de prova YouTube és bloquejat: l'iframe buit del reproductor dona «localStorage… Access is denied»
    // en engegar qualsevol ràdio (docs/PROBLEMES_I_SOLUCIONS.md; verificar-mapa.js també el filtra).
    const own = errors.filter(message => !/localStorage.*Access is denied/.test(message));
    ok(`${label}: sense errors`, own.length === 0, own);
    await ctx.close();
}

server.listen(PORT, async () => {
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
    try {
        await check(browser, 390, 844, 'mòbil');
        await check(browser, 1280, 900, 'ordinador');
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\nTot correcte.' : '\nHi ha errors.');
    process.exit(correcte ? 0 : 1);
});
