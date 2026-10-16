// Verificació en un navegador real: «Descobreix» de la barra lateral de l'ordinador (2026-10-16).
//
// NO forma part de `npm test`: és una eina opt-in. Requisits: npm i --no-save playwright-core i un Chromium
// (CHROMIUM_PATH=/ruta/al/chrome si no és a la ubicació per defecte).
//
// Ús:  node tests/browser/verificar-descobreix-barra.js
//
// Comprova a 1280 i a 900 px d'amplada (finestra apaïsada d'ordinador) que «Descobreix» de la barra lateral obre
// Descobreix des d'Inici, d'un estil, d'«Artistes i grups», de la fitxa d'una cançó que sona i d'una fitxa d'artista;
// que el reproductor no tapa la barra lateral (abans, a 769–1024 px, es posava a tota la pantalla), i que un mòbil
// girat sí que posa el vídeo a tota la pantalla.

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
const PORT = Number(process.env.DESCOBREIX_TEST_PORT || 8153);
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
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
let correcte = true;
const ok = (label, condition, detail) => {
    if (!condition) correcte = false;
    console.log(`${condition ? '✅' : '❌'} ${label}`, detail !== undefined ? JSON.stringify(detail) : '');
};

async function open(browser, viewport, mobile = false) {
    const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
    await ctx.addInitScript(() => {
        localStorage.setItem(
            'segueix_cookie_consent_v2',
            JSON.stringify({ version: 1, status: 'accepted', source: 'test', updatedAt: new Date().toISOString() })
        );
    });
    const page = await ctx.newPage();
    await page.route(/^https?:\/\/(?!localhost)/, route => route.abort());
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
    await page.evaluate(() => document.getElementById('intro-splash')?.remove());
    return { ctx, page, errors };
}

const isDiscover = page =>
    page.evaluate(
        () =>
            selectedCategory === 'Descobreix' &&
            !document.getElementById('homePage').classList.contains('hidden') &&
            document.getElementById('homePage').classList.contains('is-discover') &&
            !document.getElementById('artistMap').classList.contains('hidden') &&
            document.querySelector('.pt-sidebar .is-current, aside .is-current')?.dataset.ptNav === 'discover'
    );

async function check(browser, width) {
    const { ctx, page, errors } = await open(browser, { width, height: 800 });
    const label = `${width} px`;
    const discover = async from => {
        await page.locator('[data-pt-nav="discover"]:visible').first().click({ timeout: 5000 });
        await page.waitForTimeout(1200);
        ok(`${label}: «Descobreix» des de ${from}`, await isDiscover(page));
    };
    await discover('Inici');
    await page.evaluate(() => window.SegueixApp.features.shellNav.openStyle('Rock'));
    await page.waitForTimeout(1200);
    await discover('un estil');
    await page.locator('[data-pt-nav="artists"]:visible').first().click();
    await page.waitForTimeout(1000);
    await discover('«Artistes i grups»');
    await page.evaluate(() => openVideoFromUserGesture(YouTubeAPI.feedVideos[3].id));
    await page.waitForTimeout(1500);
    const covered = await page.evaluate(() => {
        const item = [...document.querySelectorAll('[data-pt-nav="discover"]')].find(el => el.offsetParent);
        const r = item.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return {
            sidebarFree: Boolean(hit && item.contains(hit)),
            player: getComputedStyle(document.getElementById('videoPlayer')).position,
        };
    });
    ok(`${label}: amb una cançó oberta, el reproductor no tapa la barra lateral`, covered.sidebarFree, covered);
    await discover('la fitxa d’una cançó que sona');
    await page.evaluate(() => openChannelProfile(YouTubeAPI.feedVideos[5].channelId));
    await page.waitForTimeout(1200);
    await discover('una fitxa d’artista');
    const own = errors.filter(message => !/localStorage.*Access is denied/.test(message));
    ok(`${label}: sense errors`, own.length === 0, own);
    await ctx.close();
}

async function phoneLandscape(browser) {
    const { ctx, page } = await open(browser, { width: 844, height: 390 }, true);
    await page.evaluate(() => openVideoFromUserGesture(YouTubeAPI.feedVideos[3].id));
    await page.waitForTimeout(1500);
    const box = await page.evaluate(() => {
        const r = document.getElementById('videoPlayer').getBoundingClientRect();
        return [Math.round(r.width), Math.round(r.height)];
    });
    ok('mòbil girat: el vídeo ocupa tota la pantalla', box[0] === 844 && box[1] === 390, box);
    await ctx.close();
}

server.listen(PORT, async () => {
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
    try {
        await check(browser, 1280);
        await check(browser, 900);
        await phoneLandscape(browser);
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\nTot correcte.' : '\nHi ha errors.');
    process.exit(correcte ? 0 : 1);
});
