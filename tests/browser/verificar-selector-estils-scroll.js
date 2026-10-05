// Verificació en un navegador real: a l'ordinador, el selector «Afegeix un estil» de la ràdio es tanca sol quan
// l'usuari fa scroll cap avall per veure les cançons (js/features/music-queue.js, onQueueScroll()).
//
// NO forma part de `npm test`: és una eina opt-in. Requisits: playwright-core i un Chromium (CHROMIUM_PATH).
// Ús:  node tests/browser/verificar-selector-estils-scroll.js     (MUSICA_TEST_SHOTS=/ruta per desar captures)
//
// Comprova:
//   1) 1440 px (la cua fa scroll a dins seu): roda del ratolí sobre la cua → el selector es tanca, el botó torna a
//      aria-expanded="false" i les cançons que es veuen no fan cap salt (només es mouen el que s'ha fet scroll).
//   2) 900 px (la cua és sota el reproductor i fa scroll la pàgina): el mateix amb l'scroll de la pàgina.
//   3) Un scroll petit (< 24 px) no el tanca.
//   4) Mòbil (390 px): fer scroll no el tanca.

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.MUSICA_TEST_PORT || 8149);
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.MUSICA_TEST_SHOTS || '';

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
};

function serve() {
    return new Promise(resolve => {
        const server = http.createServer((req, res) => {
            const urlPath = decodeURIComponent(req.url.split('?')[0]);
            const file = path.join(ROOT, urlPath === '/' ? '/index.html' : urlPath);
            if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
                res.writeHead(404);
                res.end('no trobat');
                return;
            }
            res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
            fs.createReadStream(file).pipe(res);
        });
        server.listen(PORT, () => resolve(server));
    });
}

// Prou més llarg que el selector perquè la cua no topi amb el capdamunt en compensar-ne l'alçada
const RODA = 600;

let correcte = true;
const comprovar = (etiqueta, condicio, detall) => {
    console.log(`${condicio ? '✅' : '❌'} ${etiqueta} ${detall !== undefined ? JSON.stringify(detall) : ''}`);
    if (!condicio) correcte = false;
};

async function radioAmbSelector(browser, width, errors) {
    const mobile = width <= 768;
    const context = await browser.newContext({
        viewport: { width, height: 900 },
        isMobile: mobile,
        hasTouch: mobile,
        serviceWorkers: 'block',
    });
    await context.addInitScript(() => {
        localStorage.setItem(
            'segueix_cookie_consent_v2',
            JSON.stringify({ version: 1, status: 'accepted', source: 'test', updatedAt: new Date().toISOString() })
        );
    });
    const page = await context.newPage();
    await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, route =>
        /youtube(-nocookie)?\.com/.test(route.request().url())
            ? route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>embed</title>' })
            : route.abort()
    );
    page.on('pageerror', error => errors.push(`${width}: ${error.message}`));
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
    await page.evaluate(() => document.getElementById('intro-splash')?.remove());
    await page.evaluate(() => SegueixApp.features.musicQueue.startStyleRadio(['Pop']));
    await page.waitForSelector('.mq--radio [data-mq-add-style]', { timeout: 20000 });
    await page.waitForTimeout(600);
    await page.click('.mq--radio [data-mq-add-style]');
    await page.waitForSelector('.mq-style-picker', { timeout: 5000 });
    return { context, page };
}

const estat = page =>
    page.evaluate(() => {
        const queue = document.getElementById('playlistQueueContainer');
        const item = queue.querySelectorAll('.mq-list .mq-item')[4];
        return {
            obert: Boolean(queue.querySelector('.mq-style-picker')),
            expanded: queue.querySelector('[data-mq-add-style]')?.getAttribute('aria-expanded'),
            itemTop: Math.round(item.getBoundingClientRect().top),
            cua: Math.round(queue.scrollTop),
            pagina: Math.round(window.scrollY),
        };
    });

async function rodaSobreLaCua(page, dy) {
    const box = await page.locator('#playlistQueueContainer .mq-list').boundingBox();
    await page.mouse.move(box.x + box.width / 2, Math.min(box.y + 40, 860));
    await page.mouse.wheel(0, dy);
    await page.waitForTimeout(400);
}

async function main() {
    const server = await serve();
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] });
    const errors = [];
    try {
        for (const width of [1440, 900]) {
            const { context, page } = await radioAmbSelector(browser, width, errors);
            if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `selector-${width}-obert.png`) });
            await rodaSobreLaCua(page, 10);
            const petit = await estat(page);
            comprovar(`${width} px: un scroll petit no el tanca`, petit.obert, petit);
            await page.evaluate(() => {
                // Es torna a dalt per mesurar bé el salt
                document.getElementById('playlistQueueContainer').scrollTop = 0;
                window.scrollTo(0, 0);
            });
            await page.waitForTimeout(200);
            const abans = await estat(page);
            await rodaSobreLaCua(page, RODA);
            const despres = await estat(page);
            comprovar(`${width} px: es tanca en fer scroll avall`, !despres.obert && despres.expanded === 'false', {
                abans,
                despres,
            });
            // Les cançons es mouen exactament el que s'ha fet rodar: treure el selector no les fa saltar
            const moviment = abans.itemTop - despres.itemTop;
            comprovar(`${width} px: les cançons no fan cap salt`, Math.abs(moviment - RODA) <= 2, {
                moviment,
                roda: RODA,
                onFaScroll: despres.cua > 0 ? 'cua' : 'pàgina',
            });
            if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `selector-${width}-tancat.png`) });
            await context.close();
        }

        const { context, page } = await radioAmbSelector(browser, 390, errors);
        await page.evaluate(() => window.scrollBy(0, 300));
        await page.waitForTimeout(400);
        const mobil = await estat(page);
        comprovar('390 px: al mòbil fer scroll no el tanca', mobil.obert, mobil);
        await context.close();

        comprovar('sense errors de JavaScript', errors.length === 0, errors);
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\nTot correcte.' : '\nHi ha errors.');
    process.exit(correcte ? 0 : 1);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
