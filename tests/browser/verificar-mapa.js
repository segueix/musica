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
// Gestos: mòbil, pessic amb dos dits (CDP), pantalla completa i un dit que mou el mapa, i dibuixar una zona amb el
// dit engega la ràdio de la zona; ordinador, arrossegar amb el ratolí, roda amunt/avall amb zoom i Ctrl + roda.

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

const viewBox = page => page.getAttribute('#artistMap .am-svg', 'viewBox');
const touch = (cdp, type, points) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
async function svgCenter(page) {
    const box = await page.locator('#artistMap .am-svg').boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

async function mobileGestures(browser) {
    const { ctx, page, errors } = await open(browser, 390, 844);
    const cdp = await ctx.newCDPSession(page);
    await page.locator('#artistMap .am-stage').scrollIntoViewIfNeeded();
    let c = await svgCenter(page);
    const before = await viewBox(page);
    // Pessic amb dos dits: els dits s'allunyen
    await touch(cdp, 'touchStart', [
        [c.x - 20, c.y],
        [c.x + 20, c.y],
    ]);
    for (let i = 1; i <= 8; i++)
        await touch(cdp, 'touchMove', [
            [c.x - 20 - i * 10, c.y],
            [c.x + 20 + i * 10, c.y],
        ]);
    await touch(cdp, 'touchEnd', []);
    const pinched = await viewBox(page);
    ok('mòbil: el pessic apropa el mapa', Number(pinched.split(' ')[2]) < Number(before.split(' ')[2]), [
        before,
        pinched,
    ]);
    // Dos dits cap amunt: el mapa es mou
    await touch(cdp, 'touchStart', [
        [c.x - 30, c.y + 60],
        [c.x + 30, c.y + 60],
    ]);
    for (let i = 1; i <= 6; i++)
        await touch(cdp, 'touchMove', [
            [c.x - 30, c.y + 60 - i * 15],
            [c.x + 30, c.y + 60 - i * 15],
        ]);
    await touch(cdp, 'touchEnd', []);
    const moved = await viewBox(page);
    ok('mòbil: dos dits mouen el mapa', moved.split(' ')[1] !== pinched.split(' ')[1], [pinched, moved]);
    // Pantalla completa (amb el mapa sencer, per a la captura)
    await page.click('[data-am-zoom="0"]');
    await page.click('[data-am-full]');
    await page.waitForTimeout(200);
    const full = await page.evaluate(() => {
        const r = document.getElementById('artistMap').getBoundingClientRect();
        return { cls: document.getElementById('artistMap').className, w: r.width, h: r.height, top: r.top };
    });
    ok(
        'mòbil: pantalla completa',
        /is-full/.test(full.cls) && full.w === 390 && full.h === 844 && full.top === 0,
        full
    );
    c = await svgCenter(page);
    if (OUT) await page.screenshot({ path: path.join(OUT, 'mapa-mobil-complet.png') });
    await page.click('[data-am-zoom="1"]');
    const fullBefore = await viewBox(page);
    await touch(cdp, 'touchStart', [[c.x, c.y]]);
    for (let i = 1; i <= 6; i++) await touch(cdp, 'touchMove', [[c.x + i * 12, c.y + i * 12]]);
    await touch(cdp, 'touchEnd', []);
    ok('mòbil: a pantalla completa un dit mou el mapa', (await viewBox(page)) !== fullBefore);
    // Mapa sencer i dibuix d'una zona al voltant de Barcelona
    await page.click('[data-am-zoom="0"]');
    await page.click('[data-am-draw]');
    ok('mòbil: mode dibuix', (await page.getAttribute('[data-am-draw]', 'aria-pressed')) === 'true');
    if (OUT) await page.screenshot({ path: path.join(OUT, 'mapa-mobil-dibuix.png') });
    const bcn = await page.evaluate(() => {
        const dot = document.querySelector('#artistMap .am-dot[aria-label^="Barcelona:"] .am-mark');
        const r = dot.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const ring = [];
    for (let a = 0; a <= 360; a += 15)
        ring.push([bcn.x + 40 * Math.cos((a * Math.PI) / 180), bcn.y + 40 * Math.sin((a * Math.PI) / 180)]);
    await touch(cdp, 'touchStart', [ring[0]]);
    for (const p of ring.slice(1)) await touch(cdp, 'touchMove', [p]);
    if (OUT) await page.screenshot({ path: path.join(OUT, 'mapa-mobil-zona.png') });
    await touch(cdp, 'touchEnd', []);
    await page.waitForTimeout(1500);
    const radio = await page.evaluate(() => ({
        name: window.SegueixApp.features.musicQueue?.playlistName?.(),
        full: document.getElementById('artistMap').classList.contains('is-full'),
    }));
    ok(
        'mòbil: dibuixar una zona engega la seva ràdio',
        /^Ràdio Barcelona/.test(radio.name || '') && !radio.full,
        radio
    );
    // Engegar qualsevol ràdio aquí (YouTube bloquejat) dona aquest error de l'iframe buit: no és del mapa
    const own = errors.filter(message => !/localStorage.*Access is denied/.test(message));
    ok('mòbil (gestos): sense errors', own.length === 0, own);
    await ctx.close();
}

async function desktopGestures(browser) {
    const { ctx, page, errors } = await open(browser, 1280, 900);
    await page.locator('#artistMap .am-stage').scrollIntoViewIfNeeded();
    const c = await svgCenter(page);
    const before = await viewBox(page);
    await page.mouse.move(c.x, c.y);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -300);
    await page.keyboard.up('Control');
    await page.waitForTimeout(100);
    const zoomed = await viewBox(page);
    ok('ordinador: Ctrl + roda apropa', Number(zoomed.split(' ')[2]) < Number(before.split(' ')[2]), [before, zoomed]);
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 60, c.y + 80, { steps: 6 });
    await page.mouse.up();
    const dragged = await viewBox(page);
    ok('ordinador: arrossegar amb el ratolí mou el mapa', dragged !== zoomed, [zoomed, dragged]);
    const scrollY = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(100);
    const wheeled = await viewBox(page);
    ok('ordinador: la roda mou el mapa amunt i avall', wheeled.split(' ')[1] !== dragged.split(' ')[1], [
        dragged,
        wheeled,
    ]);
    ok('ordinador: i no fa scroll de la pàgina', (await page.evaluate(() => window.scrollY)) === scrollY);
    await page.click('[data-am-zoom="0"]');
    await page.click('[data-am-full]');
    await page.waitForTimeout(200);
    await page.evaluate(() =>
        document
            .querySelector('#artistMap .am-dot[aria-label^="Girona:"]')
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    );
    await page.waitForTimeout(200);
    if (OUT) await page.screenshot({ path: path.join(OUT, 'mapa-ordinador-complet.png') });
    await page.keyboard.press('Escape');
    ok(
        'ordinador: Esc tanca la pantalla completa',
        !(await page.getAttribute('#artistMap', 'class')).includes('is-full')
    );
    ok('ordinador (gestos): sense errors', errors.length === 0, errors);
    await ctx.close();
}

server.listen(PORT, async () => {
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
    try {
        await check(browser, 390, 844, 'mobil');
        await check(browser, 1280, 900, 'ordinador');
        await mobileGestures(browser);
        await desktopGestures(browser);
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\nTot correcte.' : '\nHi ha errors.');
    process.exit(correcte ? 0 : 1);
});
