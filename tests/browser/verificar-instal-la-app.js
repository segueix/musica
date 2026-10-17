// Verificació en un navegador real del botó «Instal·la l'app» d'Inici (2026-10-17).
//
// NO forma part de `npm test`: és una eina opt-in. Requisits: npm i --no-save playwright-core i un Chromium
// (CHROMIUM_PATH=/ruta/al/chrome si no és a la ubicació per defecte).
//
// Ús:  node tests/browser/verificar-instal-la-app.js
//      INSTALL_SHOTS=/ruta/captures node tests/browser/verificar-instal-la-app.js
//
// A 360, 390 i 1280 px: el botó és a dalt de tot d'Inici, a la dreta, abans de l'entrada, i cap sencer; sense
// «beforeinstallprompt» obre la finestra amb els passos de l'aparell; amb «beforeinstallprompt» (simulat) instal·la
// directament sense finestra; a la vista d'un estil no hi és.

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
const PORT = Number(process.env.INSTALL_TEST_PORT || 8157);
const OUT = process.env.INSTALL_SHOTS || '';
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

async function check(browser, width, height) {
    const mobile = width <= 768;
    const label = `${width} px`;
    const ctx = await browser.newContext({
        viewport: { width, height },
        isMobile: mobile,
        hasTouch: mobile,
        serviceWorkers: 'block',
        userAgent: mobile
            ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
            : undefined,
    });
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
    await page.waitForFunction(() => !document.getElementById('homePage')?.classList.contains('is-booting'), null, {
        timeout: 30000,
    });
    await page.evaluate(() => document.getElementById('intro-splash')?.remove());
    await page.waitForTimeout(600);

    const box = await page.evaluate(() => {
        const btn = document.getElementById('ptInstallBtn');
        const entry = document.getElementById('portadaEntry');
        const home = document.getElementById('homePage');
        const r = btn.getBoundingClientRect();
        const h = home.getBoundingClientRect();
        return {
            visible: r.width > 0 && getComputedStyle(btn).visibility === 'visible',
            right: Math.round(h.right - r.right),
            left: Math.round(r.left),
            width: Math.round(r.width),
            vw: window.innerWidth,
            aboveEntry: r.bottom <= entry.getBoundingClientRect().top + 1,
            overflow: btn.scrollWidth > btn.clientWidth + 1,
        };
    });
    ok(`${label}: el botó es veu`, box.visible, box);
    ok(`${label}: és a la dreta`, box.right <= 32 && box.left > 0, box);
    ok(`${label}: és a dalt, abans de l'entrada`, box.aboveEntry);
    ok(`${label}: el text i les icones hi caben`, !box.overflow && box.left >= 8, box);
    if (OUT) await page.screenshot({ path: path.join(OUT, `instal-la-${width}.png`) });

    // Sense «beforeinstallprompt»: finestra amb els passos
    await page.click('#ptInstallBtn');
    await page.waitForSelector('#appInstallDialog.is-open');
    await page.waitForTimeout(300);
    const dialog = await page.evaluate(() => ({
        mine: document.querySelector('#appInstallDialog .ai-chip.is-mine')?.textContent.trim(),
        steps: document.querySelectorAll('#appInstallDialog .ai-mine .ai-steps li').length,
        now: Boolean(document.querySelector('#appInstallDialog [data-ai-now]')),
        focus: document.activeElement?.matches('[data-ai-close]'),
    }));
    ok(`${label}: la finestra marca l'aparell i en dona els passos`, dialog.mine && dialog.steps >= 2, dialog);
    ok(`${label}: sense permís del navegador no ofereix «Instal·la ara»`, !dialog.now);
    ok(`${label}: el focus va a «Tanca»`, dialog.focus);
    if (OUT) await page.screenshot({ path: path.join(OUT, `instal-la-finestra-${width}.png`) });
    await page.keyboard.press('Escape');
    ok(`${label}: Esc tanca la finestra`, !(await page.$('#appInstallDialog')));

    // Amb «beforeinstallprompt» (simulat): instal·la directament
    await page.evaluate(() => {
        const event = new Event('beforeinstallprompt', { cancelable: true });
        window.__prompted = 0;
        event.prompt = () => {
            window.__prompted += 1;
            return Promise.resolve();
        };
        event.userChoice = Promise.resolve({ outcome: 'accepted' });
        window.dispatchEvent(event);
    });
    await page.click('#ptInstallBtn');
    await page.waitForTimeout(300);
    const direct = await page.evaluate(() => ({
        prompted: window.__prompted,
        dialog: Boolean(document.getElementById('appInstallDialog')),
    }));
    ok(`${label}: amb el permís del navegador instal·la directament`, direct.prompted === 1 && !direct.dialog, direct);

    // Vista d'un estil: no hi és
    await page.evaluate(() => document.querySelector('.chips-bar .chip[data-cat="Pop"]')?.click());
    await page.waitForTimeout(1200);
    const inStyle = await page.evaluate(() => document.getElementById('ptInstallBtn').getBoundingClientRect().width);
    ok(`${label}: a la vista d'un estil no hi és`, inStyle === 0, inStyle);

    ok(`${label}: sense errors de JS`, errors.length === 0, errors);
    await ctx.close();
}

(async () => {
    await new Promise(resolve => server.listen(PORT, resolve));
    if (OUT) fs.mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
    try {
        await check(browser, 360, 740);
        await check(browser, 390, 844);
        await check(browser, 1280, 800);
    } finally {
        await browser.close();
        server.close();
    }
    process.exit(correcte ? 0 : 1);
})();
