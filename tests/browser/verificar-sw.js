// Verificació end-to-end del Service Worker en un navegador real (Chromium).
//
// NO forma part de `npm test` (que és Vitest, ràpid i sense navegador). És una eina
// opt-in per re-verificar el SW després de tocar-lo, ja que el seu comportament
// (migració de caches, offline, avís d'actualització) NOMÉS es pot comprovar de debò
// en un navegador amb l'API de service workers.
//
// Requisits (no són dependències del projecte):
//   npm i -D playwright-core      # client de Playwright (no baixa navegadors)
//   Un binari de Chromium accessible. Si no és a la ubicació per defecte de
//   Playwright, indica'l amb CHROMIUM_PATH=/ruta/al/chrome
//
// Ús:  node tests/browser/verificar-sw.js
//
// Comprova, en un context de navegador net:
//   1) Visita neta: s'instal·la el SW, caches static-<hash> + data-v1 (amb feed.json).
//   1b) El cache estàtic conté TOTS els scripts d'index.html (offline complet).
//   2) Offline: amb la xarxa tallada, l'app arrenca sencera des del cache.
//   3) Migració: un cache antic (mytube-v417) i l'static vell s'eliminen a l'activate.
//   4) Stale-while-revalidate: 1r load serveix stale, 2n load ja serveix fresc.
//   5) Actualització de codi: NO recarrega mentre la pàgina és visible; s'aplica en segon pla amb una sola recàrrega.
//   6) El feed es carrega i renderitza.

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.SW_TEST_PORT || 8123);
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let chromium;
try {
    ({ chromium } = require('playwright-core'));
} catch (_) {
    console.log('⏭️  playwright-core no instal·lat: verificació omesa.');
    console.log('    Per executar-la: npm i -D playwright-core  (i tenir un Chromium disponible).');
    process.exit(0);
}

// ==================== SERVIDOR ESTÀTIC AMB HOOKS DE TEST ====================
const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp',
    '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8',
};

function startServer() {
    const state = { swVersion: null, supportTag: null };
    const server = http.createServer((req, res) => {
        const url = new URL(req.url, `http://localhost:${PORT}`);
        let pathname = decodeURIComponent(url.pathname);
        res.setHeader('Cache-Control', 'no-store');

        if (pathname.startsWith('/__ctl')) {
            if (url.searchParams.has('swver')) state.swVersion = url.searchParams.get('swver') || null;
            if (url.searchParams.has('support')) state.supportTag = url.searchParams.get('support') || null;
            if (url.searchParams.has('reset')) { state.swVersion = null; state.supportTag = null; }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(state));
        }
        if (pathname === '/') pathname = '/index.html';
        if (pathname === '/data/support.json' && state.supportTag) {
            res.writeHead(200, { 'Content-Type': MIME['.json'] });
            return res.end(JSON.stringify({ _testTag: state.supportTag, channels: {} }));
        }
        const filePath = path.join(ROOT, pathname);
        if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
        fs.readFile(filePath, (err, data) => {
            if (err) { res.writeHead(404); return res.end('not found'); }
            let body = data;
            if (pathname === '/sw.js' && state.swVersion) {
                body = Buffer.from(data.toString('utf8').replace(/const CACHE_VERSION = '[^']*';/, `const CACHE_VERSION = '${state.swVersion}';`));
            }
            res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
            res.end(body);
        });
    });
    return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

// ==================== COMPROVACIONS ====================
const BASE = `http://localhost:${PORT}`;
const results = [];
function check(name, pass, detail = '') {
    results.push(pass);
    console.log(`${pass ? '✅ PASS' : '❌ FAIL'} | ${name}${detail ? ' — ' + detail : ''}`);
}

const EXPECTED_SCRIPTS = [
    '/js/config.js', '/js/youtube.js', '/js/data.js', '/js/core/segueix-app.js',
    '/js/core/state.js', '/js/core/dom-registry.js', '/js/utils/helpers.js',
    '/js/utils/storage.js', '/js/features/navigation.js', '/js/features/feed.js',
    '/js/features/likes.js', '/js/features/shorts.js', '/js/app.js',
];

(async () => {
    const server = await startServer();
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext();
    await context.addInitScript(() => {
        try {
            if (window.top !== window) return; // només la frame principal (els iframes no són recàrregues)
            const n = Number(sessionStorage.getItem('__loadCount') || '0') + 1;
            sessionStorage.setItem('__loadCount', String(n));
        } catch (_) {}
    });
    const page = await context.newPage();
    page.on('console', (m) => {
        if (m.type() !== 'error') return;
        if (/ERR_CONNECTION|ERR_INTERNET|ERR_NAME|unpkg|jsdelivr|gstatic|googleapis|youtube/i.test(m.text())) return;
        console.log('   [browser error]', m.text().slice(0, 160));
    });
    const loadCount = () => page.evaluate(() => Number(sessionStorage.getItem('__loadCount') || '0'));

    try {
        // 1) Visita neta
        await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 20000 });
        await page.waitForFunction(() => document.querySelector('#videosGrid')?.children.length > 0, null, { timeout: 20000 });
        // A la 1a càrrega feed.json es baixa abans que el SW controli; forcem una
        // petició de dades a través del SW (igual que a la 2a visita) per omplir data-v1.
        await page.evaluate(async () => { try { await fetch('/data/feed.json', { cache: 'no-store' }); } catch (_) {} });
        await page.waitForTimeout(400);

        const info = await page.evaluate(async () => {
            const keys = await caches.keys();
            const staticName = keys.find((k) => k.startsWith('static-'));
            const staticEntries = staticName ? (await (await caches.open(staticName)).keys()).map((r) => new URL(r.url).pathname) : [];
            const dataEntries = keys.includes('data-v1') ? (await (await caches.open('data-v1')).keys()).map((r) => new URL(r.url).pathname) : [];
            return { keys, staticName, staticEntries, dataEntries };
        });
        const dataHasFeed = info.dataEntries.some((p) => p.endsWith('/data/feed.json'));
        check('1. Visita neta: static-<hash> + data-v1 (amb feed.json)', Boolean(info.staticName) && info.keys.includes('data-v1') && dataHasFeed, `keys=${JSON.stringify(info.keys)}`);
        const missing = EXPECTED_SCRIPTS.filter((s) => !info.staticEntries.some((p) => p.endsWith(s)));
        const jsCount = info.staticEntries.filter((p) => p.endsWith('.js')).length;
        check('1b. Cache estàtic amb tots els scripts', missing.length === 0 && jsCount >= 25, `${jsCount} scripts, falten: ${JSON.stringify(missing)}`);

        // 6) Feed renderitza
        const feedCount = await page.evaluate(() => document.querySelector('#videosGrid')?.children.length || 0);
        check('6. El feed es carrega i renderitza', feedCount > 0, `${feedCount} targetes`);

        // 4) Stale-while-revalidate
        await page.evaluate(async () => { await (await fetch('/data/support.json')).json(); });
        await page.evaluate((b) => fetch(b + '/__ctl?support=V2TAG'), BASE);
        const first = await page.evaluate(async () => (await (await fetch('/data/support.json')).json()));
        await page.waitForTimeout(700);
        const second = await page.evaluate(async () => (await (await fetch('/data/support.json')).json()));
        check('4. SWR: 1r load stale, 2n fresc', first._testTag !== 'V2TAG' && second._testTag === 'V2TAG', `first=${first._testTag}, second=${second._testTag}`);
        await page.evaluate((b) => fetch(b + '/__ctl?support='), BASE);

        // 2) Offline
        await context.setOffline(true);
        await page.reload({ waitUntil: 'domcontentloaded' });
        let offlineOk = false;
        try { await page.waitForFunction(() => document.querySelector('#videosGrid')?.children.length > 0, null, { timeout: 15000 }); offlineOk = true; } catch (_) {}
        check('2. Offline: l\'app arrenca des del cache', offlineOk);
        await context.setOffline(false);

        // 3 + 5) Migració + actualització de codi sense refresc mentre l'usuari mira/toca l'app
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 20000 });
        await page.evaluate(async () => { await (await caches.open('mytube-v417')).put('/dummy-old', new Response('old')); });

        const NEWVER = 'testupdate99';
        const countA = await loadCount();
        await page.evaluate((b) => fetch(b + '/__ctl?swver=testupdate99'), BASE);
        await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });

        // Mentre la pàgina és visible, la versió nova ha de quedar waiting i NO pot recarregar,
        // encara que l'usuari faci scroll o interaccioni.
        await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting), null, { timeout: 10000 });
        await page.mouse.wheel(0, 500);
        await page.mouse.click(40, 300);
        await page.waitForTimeout(1800);
        const countVisible = await loadCount();
        const waitingVisible = await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting));
        check('5a. Visible: l\'actualització queda preparada i no recarrega', waitingVisible && countVisible === countA, `recàrregues=${countVisible - countA}`);

        // En passar a segon pla, app.js envia SKIP_WAITING. Simulem la visibilitat
        // directament perquè Chromium headless no sempre emet visibilitychange amb bringToFront.
        await page.evaluate(async () => {
            const r = await navigator.serviceWorker.getRegistration();
            r?.waiting?.postMessage({ type: 'SKIP_WAITING' });
        });
        await page.waitForTimeout(4500);
        const countB = await loadCount();
        await page.waitForTimeout(1500);
        const countC = await loadCount();
        const applied = await page.evaluate(async () => {
            const r = await navigator.serviceWorker.getRegistration();
            return !r.waiting && !!r.active;
        });
        check('5b. En aplicar-la, el SW nou pren el control', applied);
        check('5c. Una sola recàrrega, sense bucle', countB - countA === 1 && countC === countB, `recàrregues=${countB - countA}, extra=${countC - countB}`);

        const afterKeys = await page.evaluate(() => caches.keys());
        const migrated = !afterKeys.includes('mytube-v417') && afterKeys.includes('static-' + NEWVER)
            && afterKeys.includes('data-v1') && !afterKeys.some((k) => k.startsWith('static-') && k !== 'static-' + NEWVER);
        check('3. Migració: caches antics eliminats', migrated, `després=${JSON.stringify(afterKeys)}`);
    } catch (err) {
        console.log('💥 ERROR inesperat:', err.message);
        results.push(false);
    } finally {
        await browser.close();
        server.close();
    }

    const passed = results.filter(Boolean).length;
    console.log(`\n=== ${passed}/${results.length} PASS ===`);
    process.exit(passed === results.length ? 0 : 1);
})();
