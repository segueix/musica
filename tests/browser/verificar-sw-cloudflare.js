// Verificació en un navegador real del service worker amb un servidor que fa com Cloudflare Pages (2026-10-24).
//
// NO forma part de `npm test`: és una eina opt-in, com verificar-copia-json.js.
// Requisits (no són dependències del projecte):
//   npm i --no-save playwright-core
//   Un binari de Chromium (CHROMIUM_PATH=/ruta/al/chrome si no és a la ubicació per defecte)
//
// Ús:  node tests/browser/verificar-sw-cloudflare.js
//
// A musica.segueix.cat (Cloudflare Pages) /index.html respon amb un 308 cap a / i el codi es serveix amb
// `max-age=14400` (4 hores). El service worker desava la portada redirigida i, en obrir l'app sense xarxa (o amb
// la xarxa que falla un moment), el navegador la rebutjava: pantalla negra a l'app instal·lada. Comprova:
//   1) Després de la primera visita, cap còpia de la portada del service worker no és redirigida.
//   2) Sense xarxa, l'app s'obre amb la portada.

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
// SW_CF_ROOT=<carpeta> serveix un paquet construït (npm run build:static -- --out=<carpeta>) en lloc del repositori
const ROOT = process.env.SW_CF_ROOT ? path.resolve(process.env.SW_CF_ROOT) : path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.SW_CF_PORT || 8163);
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
};
// Com Cloudflare Pages: /index.html → 308 → /, i el codi amb «Browser Cache TTL» de 4 hores
const server = http.createServer((req, res) => {
    const [pathname, query = ''] = req.url.split('?');
    const u = decodeURIComponent(pathname);
    if (u === '/index.html') {
        res.writeHead(308, { location: `/${query ? `?${query}` : ''}` });
        return res.end();
    }
    const f = path.join(ROOT, u === '/' ? '/index.html' : u);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        res.writeHead(404);
        return res.end();
    }
    const ext = path.extname(f);
    res.writeHead(200, {
        'content-type': MIME[ext] || 'application/octet-stream',
        'cache-control': ['.js', '.css'].includes(ext) ? 'public, max-age=14400, must-revalidate' : 'public, max-age=0, must-revalidate',
    });
    fs.createReadStream(f).pipe(res);
});
let correcte = true;
const ok = (label, condition, detail) => {
    if (!condition) correcte = false;
    console.log(`${condition ? '✅' : '❌'} ${label}`, detail !== undefined ? JSON.stringify(detail) : '');
};

server.listen(PORT, async () => {
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
    try {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
        await ctx.addInitScript(() => {
            localStorage.setItem(
                'segueix_cookie_consent_v2',
                JSON.stringify({ version: 1, status: 'accepted', source: 'test', updatedAt: new Date().toISOString() })
            );
        });
        const page = await ctx.newPage();
        await page.route(/^https?:\/\/(?!localhost)/, route => route.abort());
        await page.goto(`http://localhost:${PORT}/`);
        await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 60000 });
        await page.waitForTimeout(3000);
        const shell = await page.evaluate(async () => {
            const out = [];
            for (const name of await caches.keys()) {
                const cache = await caches.open(name);
                for (const request of await cache.keys()) {
                    if (/\/(index\.html)?$/.test(new URL(request.url).pathname)) {
                        out.push({ cache: name, url: request.url, redirected: (await cache.match(request)).redirected });
                    }
                }
            }
            return out;
        });
        ok(
            'cap còpia de la portada del service worker no és redirigida',
            shell.length >= 2 && shell.every(entry => !entry.redirected),
            shell
        );
        // Sense xarxa (o amb la xarxa que falla en obrir l'app): el service worker obre l'app amb la seva còpia
        await ctx.setOffline(true);
        let error = '';
        await page.goto(`http://localhost:${PORT}/`, { timeout: 30000 }).catch(e => (error = e.message.split('\n')[0]));
        await page.waitForSelector('#homePage', { timeout: 10000 }).catch(() => {});
        const offline = await page.evaluate(() => ({
            url: location.href,
            app: Boolean(document.getElementById('homePage')),
        }));
        ok('sense xarxa, l’app s’obre amb la seva còpia', !error && offline.app, { error, ...offline });
        await ctx.close();
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\nTot correcte.' : '\nHi ha errors.');
    process.exit(correcte ? 0 : 1);
});
