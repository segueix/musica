// Verificació en un navegador real de «Música d'arreu» (js/features/artist-map.js), el mapa de Descobreix.
//
// NO forma part de `npm test`: és una eina opt-in, com verificar-artistes-categoria.js.
// Requisits: npm i --no-save playwright-core sortablejs@1.15.6 lz-string@1.5.0 (i Chromium, CHROMIUM_PATH)
//
// Ús:  node tests/browser/verificar-mapa.js
//      MAPA_SHOTS=/ruta/captures node tests/browser/verificar-mapa.js
//
// Comprova, a mòbil (390 px) i ordinador (1280 px): el mapa surt a Descobreix i no a Inici, té punts, tocar-ne un
// mostra els artistes al panell, el zoom canvia el viewBox, la pàgina no es desborda i tocar un artista obre la fitxa.

const http = require('http');
const fs = require('fs');
const path = require('path');
let chromium;
try {
    ({ chromium } = require('playwright-core'));
} catch (_) {
    try {
        ({ chromium } = require('playwright'));
    } catch (_e) {
        chromium = null;
    }
}
if (!chromium) {
    console.log('⏭️  playwright no instal·lat: verificació omesa.');
    process.exit(0);
}
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.MAPA_TEST_PORT || 8149);
const OUT = process.env.MAPA_SHOTS || '';
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

async function open(browser, width, height) {
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
    ok(`${width} px: a Inici no hi ha el mapa`, await page.isHidden('#artistMap'));
    await page.evaluate(() => window.SegueixApp.features.shellNav.ACTIONS.discover());
    await page.waitForSelector('#artistMap:not(.hidden) .am-dot', { timeout: 30000 });
    await page.waitForTimeout(500);
    return { ctx, page, errors };
}

async function check(browser, width, height, tag) {
    const { ctx, page, errors } = await open(browser, width, height);
    const info = await page.evaluate(() => ({
        dots: document.querySelectorAll('#artistMap .am-dot').length,
        sub: document.querySelector('.am-sub')?.textContent,
        pageWidth: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
    }));
    ok(`${tag}: punts al mapa`, info.dots > 50, info);
    ok(`${tag}: la pàgina no es desborda`, info.pageWidth <= info.viewport, [info.pageWidth, info.viewport]);
    await page.locator('#artistMap .am-stage').scrollIntoViewIfNeeded();
    if (OUT) await page.screenshot({ path: path.join(OUT, `mapa-${tag}.png`) });
    // El punt més gran (el primer) és el que té més artistes
    await page.evaluate(() =>
        document.querySelector('#artistMap .am-dot').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    );
    await page.waitForTimeout(300);
    const panel = await page.evaluate(() => ({
        title: document.querySelector('.am-panel h3')?.textContent,
        artists: document.querySelectorAll('.am-panel .am-artist').length,
        radio: Boolean(document.querySelector('.am-panel [data-am-radio]')),
    }));
    ok(`${tag}: el panell mostra els artistes del lloc`, panel.artists > 0 && panel.radio, panel);
    await page.locator('.am-panel').scrollIntoViewIfNeeded();
    if (OUT) await page.screenshot({ path: path.join(OUT, `mapa-${tag}-panell.png`) });
    const before = await page.getAttribute('.am-svg', 'viewBox');
    await page.click('[data-am-zoom="1"]');
    ok(`${tag}: el zoom apropa`, (await page.getAttribute('.am-svg', 'viewBox')) !== before);
    await page.click('[data-am-zoom="0"]');
    ok(`${tag}: el mapa sencer torna`, (await page.getAttribute('.am-svg', 'viewBox')) === before);
    const name = (await page.textContent('.am-panel .am-artist strong')).trim();
    await page.click('.am-panel .am-artist');
    await page.waitForSelector('#channelPage:not(.hidden)', { timeout: 10000 });
    await page.waitForTimeout(500);
    ok(`${tag}: tocar un artista obre la fitxa`, (await page.textContent('#channelPage')).includes(name), name);
    ok(`${tag}: sense errors`, errors.length === 0, errors);
    await ctx.close();
}

server.listen(PORT, async () => {
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
    try {
        await check(browser, 390, 844, 'mobil');
        await check(browser, 1280, 900, 'ordinador');
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\nTot correcte.' : '\nHi ha errors.');
    process.exit(correcte ? 0 : 1);
});
