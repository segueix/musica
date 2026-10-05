// Verificació en un navegador real dels artistes d'una categoria (js/features/category-artists.js).
//
// NO forma part de `npm test`: és una eina opt-in, com verificar-categories.js.
// Requisits (no són dependències del projecte):
//   npm i --no-save playwright-core sortablejs@1.15.6 lz-string@1.5.0
//   Un binari de Chromium (CHROMIUM_PATH=/ruta/al/chrome si no és a la ubicació per defecte)
//
// Ús:  node tests/browser/verificar-artistes-categoria.js
//      ARTISTES_SHOTS=/ruta/captures node tests/browser/verificar-artistes-categoria.js
//
// Comprova, a l'estil Pop:
//   1) Mòbil (390 px): la filera és just després de la cançó destacada, té una sola fila i es desplaça en horitzontal;
//      no hi ha botó de desplegar.
//   2) Ordinador (1280 px): una sola fila plegada, el botó «Mostra'ls tots (N)» la desplega (totes les files) i la torna
//      a plegar; tocar un artista obre la seva fitxa.
//   3) A Inici no hi ha la filera.

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
const PORT = Number(process.env.ARTISTES_TEST_PORT || 8147);
const OUT = process.env.ARTISTES_SHOTS || '';
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

async function openStyle(browser, width, height, style = 'Pop') {
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
        return route.abort();
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
    await page.evaluate(() => document.getElementById('intro-splash')?.remove());
    ok(`${width} px: a Inici no hi ha artistes`, await page.isHidden('#categoryArtists'));
    await page.goto(`http://localhost:${PORT}/?estil=${encodeURIComponent(style)}`);
    await page.waitForSelector('#categoryArtists:not(.hidden) .ca__artist', { timeout: 30000 });
    await page.evaluate(() => document.getElementById('intro-splash')?.remove());
    await page.waitForTimeout(800);
    return { ctx, page, errors };
}

const layout = page =>
    page.evaluate(() => {
        const list = document.querySelector('#caList');
        const tops = new Set([...list.querySelectorAll('.ca__artist')].map(item => item.offsetTop));
        const hero = document.getElementById('heroSection');
        const section = document.getElementById('categoryArtists');
        const toggle = document.querySelector('[data-ca-toggle]');
        return {
            artists: list.children.length,
            rows: tops.size,
            visibleHeight: list.clientHeight,
            scrollWidth: list.scrollWidth,
            clientWidth: list.clientWidth,
            afterHero: Boolean(hero.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING),
            heroVisible: !hero.classList.contains('hidden'),
            toggleVisible: Boolean(toggle && !toggle.hidden),
            toggleText: toggle?.textContent.trim(),
            pageWidth: document.documentElement.scrollWidth,
            viewport: window.innerWidth,
        };
    });

server.listen(PORT, async () => {
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
    try {
        // 1. Mòbil
        const mobile = await openStyle(browser, 390, 844);
        let info = await layout(mobile.page);
        ok('mòbil: després de la cançó destacada', info.afterHero && info.heroVisible, info);
        ok('mòbil: una sola fila', info.rows === 1 && info.artists > 3, info.rows);
        ok('mòbil: scroll lateral', info.scrollWidth > info.clientWidth, [info.scrollWidth, info.clientWidth]);
        ok('mòbil: sense botó de desplegar', !info.toggleVisible);
        ok('mòbil: la pàgina no es desborda', info.pageWidth <= info.viewport, [info.pageWidth, info.viewport]);
        const before = await mobile.page.$eval('#caList', list => list.scrollLeft);
        await mobile.page.$eval('#caList', list => list.scrollBy({ left: 300 }));
        await mobile.page.waitForTimeout(200);
        ok('mòbil: es pot desplaçar', (await mobile.page.$eval('#caList', list => list.scrollLeft)) > before);
        if (OUT) {
            await mobile.page.$eval('#caList', list => list.scrollTo({ left: 0 }));
            await mobile.page.locator('#heroSection').scrollIntoViewIfNeeded();
            await mobile.page.screenshot({ path: path.join(OUT, 'artistes-mobil.png') });
        }
        ok('mòbil: sense errors', mobile.errors.length === 0, mobile.errors);
        await mobile.ctx.close();

        // 2. Ordinador
        const desktop = await openStyle(browser, 1280, 900);
        info = await layout(desktop.page);
        ok('ordinador: després de la cançó destacada', info.afterHero && info.heroVisible);
        const rowHeight = info.visibleHeight;
        ok('ordinador: plegada mostra una fila', info.rows > 1 && rowHeight < 160, info);
        ok(
            'ordinador: botó «Mostra’ls tots»',
            info.toggleVisible && /Mostra’ls tots \(\d+\)/.test(info.toggleText),
            info
        );
        if (OUT) await desktop.page.screenshot({ path: path.join(OUT, 'artistes-ordinador-plegat.png') });
        await desktop.page.click('[data-ca-toggle]');
        await desktop.page.waitForTimeout(200);
        info = await layout(desktop.page);
        ok('ordinador: desplegada mostra totes les files', info.visibleHeight > rowHeight * (info.rows - 0.5), info);
        ok('ordinador: el botó diu «Mostra’n menys»', info.toggleText === 'Mostra’n menys', info.toggleText);
        ok(
            'ordinador: aria-expanded',
            (await desktop.page.getAttribute('[data-ca-toggle]', 'aria-expanded')) === 'true'
        );
        if (OUT) await desktop.page.screenshot({ path: path.join(OUT, 'artistes-ordinador-desplegat.png') });
        await desktop.page.click('[data-ca-toggle]');
        await desktop.page.waitForTimeout(200);
        info = await layout(desktop.page);
        ok('ordinador: es torna a plegar', info.visibleHeight === rowHeight, [info.visibleHeight, rowHeight]);
        const name = (await desktop.page.textContent('.ca__artist .ca__name')).trim();
        await desktop.page.click('.ca__artist');
        await desktop.page.waitForSelector('#channelPage:not(.hidden)', { timeout: 10000 });
        await desktop.page.waitForTimeout(500);
        const profile = await desktop.page.textContent('#channelPage');
        ok('ordinador: tocar un artista obre la seva fitxa', profile.includes(name), name);
        ok('ordinador: sense errors', desktop.errors.length === 0, desktop.errors);
        await desktop.ctx.close();
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\nTot correcte.' : '\nHi ha errors.');
    process.exit(correcte ? 0 : 1);
});
