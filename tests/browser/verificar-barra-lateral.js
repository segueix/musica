// Verificació en navegador real: sense navegació lateral a l'ordinador i a la tauleta (2026-10-23). La barra no es
// veu ni ocupa espai, no hi ha el botó de tres ratlles, Inici · Descobreix · Artistes i grups · La teva música són a dalt
// a la dreta (una sola vegada) i porten a la seva secció amb la icona activa en llima; al mòbil (390 px) a dalt només
// hi ha Artistes (la resta és a la navegació inferior).
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

async function obre(browser, width, errors) {
    const context = await browser.newContext({
        viewport: { width, height: 800 },
        isMobile: width <= 768,
        hasTouch: width <= 768,
        serviceWorkers: 'block',
    });
    await context.addInitScript(() => {
        try {
            localStorage.setItem(
                'segueix_cookie_consent_v2',
                JSON.stringify({ version: 1, status: 'accepted', source: 'test', updatedAt: new Date().toISOString() })
            );
            // Preferència antiga: ja no ha de fer res
            localStorage.setItem('segueix_music_desktop_sidebar_collapsed', '0');
        } catch (_) {}
    });
    const page = await context.newPage();
    await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, route => route.abort());
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
    await page.waitForTimeout(3500); // la pantalla d'obertura
    return { context, page };
}

const visibles = page =>
    page.evaluate(() =>
        [...document.querySelectorAll('.app-header .actions .icon-btn')]
            .filter(el => getComputedStyle(el).display !== 'none')
            .map(el => el.dataset.ptHead || el.dataset.page || el.id)
    );

async function escriptori(browser, width, errors) {
    const etiqueta = `${width} px`;
    const { context, page } = await obre(browser, width, errors);
    const m = await page.evaluate(() => {
        const sidebar = document.getElementById('sidebar');
        const main = document.getElementById('mainContent').getBoundingClientRect();
        return {
            barra: getComputedStyle(sidebar).display,
            boto: Boolean(document.getElementById('sidebarToggle')),
            main: Math.round(main.left),
            overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
    });
    comprovar(
        `${etiqueta}: no hi ha barra lateral ni botó de tres ratlles i el contingut comença a l'esquerra`,
        m.barra === 'none' && !m.boto && m.main < 40 && m.overflowX <= 0,
        m
    );
    const icones = await visibles(page);
    comprovar(
        `${etiqueta}: a dalt a la dreta, Inici · Descobreix · Artistes i grups · La teva música (una vegada) · contacte · configuració`,
        icones.join() === 'home,discover,artists,library,contactBtn,backgroundBtn',
        icones
    );
    const seccions = {};
    for (const section of ['discover', 'artists', 'library', 'home']) {
        await page.click(`#headerActions [data-pt-head="${section}"]`);
        await page.waitForTimeout(1200);
        seccions[section] = await page.evaluate(() => ({
            actiu: document.querySelector('#headerActions .is-current')?.dataset.ptHead,
            pagina: ['followPage', 'playlistsPage', 'homePage'].find(id => {
                const el = document.getElementById(id);
                return el && !el.classList.contains('hidden') && el.offsetHeight > 0;
            }),
            color: getComputedStyle(document.querySelector('#headerActions .is-current')).color,
        }));
    }
    const pagines = { discover: 'homePage', artists: 'followPage', library: 'playlistsPage', home: 'homePage' };
    comprovar(
        `${etiqueta}: cada icona porta a la seva secció i queda activa en llima`,
        Object.entries(seccions).every(
            ([section, r]) => r.actiu === section && r.pagina === pagines[section] && r.color === 'rgb(214, 237, 132)'
        ),
        seccions
    );
    await context.close();
}

async function mobil(browser, errors) {
    const { context, page } = await obre(browser, 390, errors);
    const icones = await visibles(page);
    const nav = await page.evaluate(() => getComputedStyle(document.getElementById('ptBottomNav')).display);
    comprovar(
        'mòbil (390 px): a dalt només Artistes, contacte i configuració; la navegació inferior hi és',
        icones.join() === 'artists,contactBtn,backgroundBtn' && nav !== 'none',
        { icones, nav }
    );
    await context.close();
}

async function main() {
    const server = await serve();
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] });
    const errors = [];
    try {
        await escriptori(browser, 1280, errors);
        await escriptori(browser, 900, errors);
        await mobil(browser, errors);
        comprovar('cap error de JavaScript', errors.length === 0, errors.slice(0, 3));
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\n✅ Navegació de la capçalera verificada' : '\n❌ Hi ha comprovacions fallides');
    process.exit(correcte ? 0 : 1);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
