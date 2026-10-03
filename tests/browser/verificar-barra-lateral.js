// Verificació en navegador real de la navegació lateral plegable: botó de tres ratlles a la capçalera, la barra
// llisca cap a fora i el contingut ocupa l'espai (escriptori 1280 px i tauleta 900 px), la preferència es recorda,
// la barra plegada no es pot focalitzar amb el teclat i al mòbil (390 px) no hi ha botó ni barra.
//
// NO forma part de `npm test`: és una eina opt-in. Requisits: playwright-core i un Chromium (CHROMIUM_PATH).
// Ús:  node tests/browser/verificar-barra-lateral.js

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.MUSICA_TEST_PORT || 8157);
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

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

let correcte = true;
const comprovar = (etiqueta, condicio, detall) => {
    console.log(`${condicio ? '✅' : '❌'} ${etiqueta} ${detall !== undefined ? JSON.stringify(detall) : ''}`);
    if (!condicio) correcte = false;
};

async function obre(browser, width, errors, { collapsed } = {}) {
    const context = await browser.newContext({
        viewport: { width, height: 800 },
        isMobile: width <= 768,
        hasTouch: width <= 768,
        serviceWorkers: 'block',
    });
    await context.addInitScript(
        collapsedSaved => {
            try {
                // Només la primera vegada: una recàrrega no ha de desfer la preferència que s'acaba de desar
                if (localStorage.getItem('__musica_seed')) return;
                localStorage.setItem('__musica_seed', '1');
                localStorage.setItem(
                    'segueix_cookie_consent_v2',
                    JSON.stringify({
                        version: 1,
                        status: 'accepted',
                        source: 'test',
                        updatedAt: new Date().toISOString(),
                    })
                );
                if (collapsedSaved !== null)
                    localStorage.setItem('segueix_music_desktop_sidebar_collapsed', collapsedSaved);
            } catch (_) {}
        },
        collapsed === undefined ? null : collapsed ? '1' : '0'
    );
    const page = await context.newPage();
    await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, route => route.abort());
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
    await page.waitForFunction(() => document.body.classList.contains('sidebar-ready'), null, { timeout: 10000 });
    await page.waitForTimeout(3500); // la pantalla d'obertura
    return { context, page };
}

const mesura = page =>
    page.evaluate(() => {
        const box = el => {
            const r = el.getBoundingClientRect();
            return {
                left: Math.round(r.left),
                right: Math.round(r.right),
                width: Math.round(r.width),
                top: Math.round(r.top),
            };
        };
        const toggle = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');
        return {
            toggle: box(toggle),
            toggleDisplay: getComputedStyle(toggle).display,
            brand: box(document.querySelector('.brand')),
            sidebar: box(sidebar),
            visibility: getComputedStyle(sidebar).visibility,
            main: box(document.getElementById('videosGrid')),
            expanded: toggle.getAttribute('aria-expanded'),
            label: toggle.getAttribute('aria-label'),
            collapsed: document.body.classList.contains('sidebar-collapsed'),
            overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
    });

async function escriptori(browser, width, ample, errors) {
    const etiqueta = width >= 1200 ? `escriptori (${width} px)` : `tauleta (${width} px)`;
    const { context, page } = await obre(browser, width, errors, { collapsed: false });
    const obert = await mesura(page);
    comprovar(
        `${etiqueta}: el botó de tres ratlles és a l'esquerra de la capçalera, abans del logo, i la barra és oberta`,
        obert.toggleDisplay !== 'none' &&
            obert.toggle.left < obert.brand.left &&
            obert.toggle.width >= 44 &&
            obert.expanded === 'true' &&
            obert.sidebar.left === 0 &&
            obert.sidebar.width === ample &&
            obert.main.left >= ample,
        obert
    );

    await page.click('#sidebarToggle');
    await page.waitForTimeout(700);
    const plegat = await mesura(page);
    comprovar(
        `${etiqueta}: plegada, la barra surt de la pantalla, no és focalitzable i el contingut ocupa tot l'ample`,
        plegat.collapsed &&
            plegat.sidebar.right <= 0 &&
            plegat.visibility === 'hidden' &&
            plegat.main.left < ample &&
            plegat.main.width > obert.main.width &&
            plegat.expanded === 'false' &&
            /Desplega/.test(plegat.label) &&
            plegat.overflowX <= 0,
        plegat
    );
    const focus = await page.evaluate(() => {
        document.getElementById('sidebarToggle').focus();
        return null;
    });
    await page.keyboard.press('Tab');
    const focusDins = await page.evaluate(() => Boolean(document.activeElement?.closest('#sidebar')));
    comprovar(
        `${etiqueta}: amb la barra plegada, el tabulador no entra a la navegació amagada`,
        !focusDins && focus === null
    );

    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
    const reobert = await mesura(page);
    comprovar(
        `${etiqueta}: el botó també funciona amb el teclat i la barra torna al seu lloc`,
        !reobert.collapsed &&
            reobert.sidebar.left === 0 &&
            reobert.visibility === 'visible' &&
            reobert.main.left === obert.main.left,
        reobert
    );

    await page.click('#sidebarToggle');
    await page.waitForTimeout(500);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
    await page.waitForTimeout(500);
    const recordat = await mesura(page);
    comprovar(
        `${etiqueta}: la preferència es recorda en tornar a obrir l'app (plegada des del primer moment)`,
        recordat.collapsed && recordat.sidebar.right <= 0 && recordat.expanded === 'false',
        recordat
    );
    await context.close();
}

async function mobil(browser, errors) {
    // Amb la preferència «plegada» desada, al mòbil no hi ha botó ni barra lateral ni cap classe que la toqui
    const { context, page } = await obre(browser, 390, errors, { collapsed: true });
    const m = await mesura(page);
    comprovar(
        'mòbil (390 px): no hi ha botó de tres ratlles ni espai reservat a l’esquerra, i el contingut ocupa l’ample',
        m.toggleDisplay === 'none' && !m.collapsed && m.main.left < 40 && m.overflowX <= 0,
        m
    );
    await context.close();
}

async function main() {
    const server = await serve();
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] });
    const errors = [];
    try {
        await escriptori(browser, 1280, 236, errors);
        await escriptori(browser, 900, 84, errors);
        await mobil(browser, errors);
        comprovar('cap error de JavaScript', errors.length === 0, errors.slice(0, 3));
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\n✅ Barra lateral plegable verificada' : '\n❌ Hi ha comprovacions fallides');
    process.exit(correcte ? 0 : 1);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
