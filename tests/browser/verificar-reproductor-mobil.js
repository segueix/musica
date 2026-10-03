// Verificació en navegador real del reproductor quadrat a mòbil: en pantalles de diferents alçades, el quadrat s'adapta
// (mai menys de 200 px, el mínim que demana YouTube; mai més ample que la pantalla) perquè la fila de botons de sota
// (afegir a llista, compartir, finestra flotant, comentar, canal) quedi sencera damunt de la navegació inferior.
//
// YouTube no es pot carregar aquí: se serveix un succedani local a la URL d'embed.
// NO forma part de `npm test`: és una eina opt-in. Ús:  node tests/browser/verificar-reproductor-mobil.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const { ambGustRecent } = require('./gust-recent');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.MUSICA_TEST_PORT || 8158);
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

const STUB_PLAYER = `<!doctype html><html><body style="margin:0;background:#345"><script>
function send(info) { parent.postMessage(JSON.stringify({ event: 'onStateChange', info, id: 'catube-player' }), '*'); }
setTimeout(() => send(1), 150);
</script></body></html>`;

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

async function prova(browser, width, height, errors) {
    const context = await browser.newContext({
        viewport: { width, height },
        isMobile: true,
        hasTouch: true,
        serviceWorkers: 'block',
    });
    await context.addInitScript(() => {
        try {
            localStorage.setItem(
                'segueix_cookie_consent_v2',
                JSON.stringify({ version: 1, status: 'accepted', source: 'test', updatedAt: new Date().toISOString() })
            );
        } catch (_) {}
    });
    const page = await context.newPage();
    await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, route => route.abort());
    await page.route('**://*.youtube*.com/embed/**', route =>
        route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: STUB_PLAYER })
    );
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
    await page.waitForTimeout(3500); // la pantalla d'obertura
    await ambGustRecent(page);
    await page.click('#ptPlayBtn');
    await page.waitForSelector('#videoPlayer iframe', { timeout: 20000 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
        const box = selector => {
            const r = document.querySelector(selector).getBoundingClientRect();
            return {
                left: Math.round(r.left),
                right: Math.round(r.right),
                top: Math.round(r.top),
                bottom: Math.round(r.bottom),
                width: Math.round(r.width),
                height: Math.round(r.height),
            };
        };
        return {
            holder: box('#videoPlaceholder'),
            player: box('#videoPlayer'),
            actions: box('.video-metadata-bar'),
            nav: box('#ptBottomNav'),
        };
    });
    const etiqueta = `${width}×${height}`;
    const centrat = Math.abs(m.holder.left + m.holder.width / 2 - width / 2) <= 1;
    comprovar(
        `${etiqueta}: el quadrat fa entre 200 px i l'ample de la pantalla, queda centrat i el reproductor se li posa a sobre`,
        m.holder.width >= 200 &&
            m.holder.width <= width &&
            m.holder.width === m.holder.height &&
            centrat &&
            Math.abs(m.player.left - m.holder.left) <= 1 &&
            Math.abs(m.player.width - m.holder.width) <= 1,
        m
    );
    comprovar(
        `${etiqueta}: la fila de botons (afegir a llista, compartir…) acaba damunt de la navegació inferior`,
        m.actions.bottom <= m.nav.top,
        { files: m.actions.bottom, navegacio: m.nav.top }
    );
    await context.close();
}

async function main() {
    const server = await serve();
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] });
    const errors = [];
    try {
        // 738: un mòbil de 360 px amb la zona del sistema a dalt; 640: pantalla molt baixa (el quadrat toca el mínim)
        for (const [w, h] of [
            [360, 738],
            [360, 808],
            [390, 844],
            [412, 915],
            [360, 640],
        ])
            await prova(browser, w, h, errors);
        comprovar('cap error de JavaScript', errors.length === 0, errors.slice(0, 3));
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\n✅ Reproductor quadrat a mòbil verificat' : '\n❌ Hi ha comprovacions fallides');
    process.exit(correcte ? 0 : 1);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
