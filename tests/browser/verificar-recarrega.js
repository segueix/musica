// Verificació en navegador real: recarregar l'app mentre sona una cançó torna a obrir l'app (i la cançó), no
// segueix.github.io (404). Simula GitHub Pages: l'app és a /musica/, una adreça que no existeix dins /musica/ rep el
// 404.html del repositori i la resta del domini dona 404.
//
// NO forma part de `npm test`: és una eina opt-in. Requisits: playwright-core i un Chromium (CHROMIUM_PATH).
// Ús:  node tests/browser/verificar-recarrega.js
//
// Comprova:
//   1) https://segueix.github.io/musica/: en engegar una ràdio la URL és /musica/?v=<id> (mai /video/… a l'arrel) i,
//      en recarregar, l'app torna a obrir-se amb la mateixa cançó.
//   2) Una ruta llegible /musica/video/<títol>-<id> (de segueix.cat o d'un enllaç antic) passa pel 404.html i torna a
//      l'app amb la cançó.
//   3) En sortir del reproductor (Inici), la URL torna a /musica/ sense ?v=.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ORIGIN = 'https://segueix.github.io';
const BASE = '/musica/';

let chromium;
try {
    ({ chromium } = require('playwright-core'));
} catch (_) {
    console.log('⏭️  playwright-core no instal·lat: verificació omesa.');
    process.exit(0);
}

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
};

let correcte = true;
const comprovar = (etiqueta, condicio, detall) => {
    console.log(`${condicio ? '✅' : '❌'} ${etiqueta} ${detall !== undefined ? JSON.stringify(detall) : ''}`);
    if (!condicio) correcte = false;
};

// Com GitHub Pages: fitxers de /musica/, el 404.html del repositori per a /musica/<no existeix> i 404 a la resta
function githubPages(route) {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith(BASE)) {
        return route.fulfill({ status: 404, contentType: 'text/html', body: '<!doctype html><title>404</title>404' });
    }
    let rel = decodeURIComponent(url.pathname.slice(BASE.length)) || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(ROOT, rel);
    if (file.startsWith(ROOT) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        return route.fulfill({
            status: 200,
            contentType: MIME[path.extname(file)] || 'application/octet-stream',
            body: fs.readFileSync(file),
        });
    }
    return route.fulfill({
        status: 404,
        contentType: 'text/html; charset=utf-8',
        body: fs.readFileSync(path.join(ROOT, '404.html')),
    });
}

async function novaPagina(browser, errors) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    await context.addInitScript(() => {
        localStorage.setItem(
            'segueix_cookie_consent_v2',
            JSON.stringify({ version: 1, status: 'accepted', source: 'test', updatedAt: new Date().toISOString() })
        );
    });
    await context.route('**/*', route => {
        const url = route.request().url();
        if (url.startsWith(ORIGIN)) return githubPages(route);
        if (/youtube(-nocookie)?\.com\/embed\//.test(url)) {
            return route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: '<!doctype html><title>embed</title>',
            });
        }
        return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    return { context, page };
}

const estat = page =>
    page.evaluate(() => ({
        url: location.pathname + location.search,
        video: typeof currentVideoId === 'undefined' ? null : currentVideoId,
        watch: !document.getElementById('watchPage')?.classList.contains('hidden'),
        app: Boolean(window.SegueixApp?.features?.musicQueue),
    }));

async function main() {
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
    const errors = [];
    try {
        const { context, page } = await novaPagina(browser, errors);
        await page.goto(`${ORIGIN}${BASE}`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
        await page.evaluate(() => document.getElementById('intro-splash')?.remove());
        comprovar(
            'la carpeta de l’app és /musica/',
            (await page.evaluate(() => SegueixApp.utils.appBasePath())) === BASE
        );

        // 1) Engegar una ràdio i recarregar
        await page.evaluate(() => SegueixApp.features.musicQueue.startStyleRadio(['Pop']));
        await page.waitForFunction(() => /[?&]v=/.test(location.search), null, { timeout: 20000 });
        await page.waitForTimeout(800);
        const abans = await estat(page);
        comprovar(
            'en reproduir, la URL es queda a /musica/?v=<id>',
            abans.url.startsWith(`${BASE}?v=`) && abans.url.includes(abans.video),
            abans
        );
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof currentVideoId !== 'undefined' && currentVideoId, null, {
            timeout: 30000,
        });
        await page.waitForTimeout(800);
        const despres = await estat(page);
        comprovar(
            'en recarregar, s’obre l’app amb la mateixa cançó',
            despres.app && despres.video === abans.video && despres.url.startsWith(BASE),
            despres
        );

        // 3) Sortir del reproductor: la URL torna a la carpeta de l'app
        await page.click('.nav-item[data-pt-nav="home"]');
        await page.waitForTimeout(1200);
        const inici = await estat(page);
        comprovar('a Inici la URL és /musica/ sense ?v=', inici.url === BASE, inici);

        // 2) Ruta llegible antiga dins /musica/ → 404.html → l'app amb la cançó
        await page.goto(`${ORIGIN}${BASE}video/una-canco-${abans.video}`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof currentVideoId !== 'undefined' && currentVideoId, null, {
            timeout: 30000,
        });
        await page.waitForTimeout(800);
        const antiga = await estat(page);
        comprovar(
            'una adreça /musica/video/<títol>-<id> torna a l’app amb la cançó',
            antiga.app && antiga.video === abans.video && antiga.url.startsWith(`${BASE}?v=`),
            antiga
        );

        comprovar('sense errors de JavaScript', errors.length === 0, errors);
        await context.close();
    } finally {
        await browser.close();
    }
    console.log(correcte ? '\nTot correcte.' : '\nHi ha errors.');
    process.exit(correcte ? 0 : 1);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
