// Verificació en un navegador real de «Tria el teu so» (2026-10-22): «Tots els estils» és sempre la cel·la que
// segueix la darrera rajola (estil o categoria pròpia), plegat i desplegat, al mòbil i a l'ordinador.
//
// NO forma part de `npm test`: és una eina opt-in. Requisits: npm i --no-save playwright-core i un Chromium
// (CHROMIUM_PATH=/ruta/al/chrome si no és a la ubicació per defecte).
//
// Ús:  node tests/browser/verificar-tots-els-estils.js
//      ESTILS_SHOTS=/ruta/captures node tests/browser/verificar-tots-els-estils.js

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
const PORT = Number(process.env.ESTILS_TEST_PORT || 8168);
const OUT = process.env.ESTILS_SHOTS || '';
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

// Canals del feed per fer categories pròpies
const feed = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/feed.json'), 'utf8'));
const channelIds = [...new Set((feed.videos || []).map(video => video.channelId).filter(Boolean))];

// Posició a la graella de la darrera rajola visible i de «Tots els estils»
const layout = () => {
    const list = document.getElementById('ptStyles');
    const cells = [...list.querySelectorAll('.pt-style-cell:not(.pt-style-cell--actions)')].filter(
        cell => !cell.hidden && cell.getBoundingClientRect().height > 0
    );
    const last = cells[cells.length - 1].getBoundingClientRect();
    const more = list.querySelector('[data-pt-all-styles]')?.getBoundingClientRect();
    const create = list.querySelector('[data-uc-create]').getBoundingClientRect();
    const columns = getComputedStyle(list).gridTemplateColumns.split(' ').length;
    const left = list.getBoundingClientRect().left;
    return {
        tiles: cells.length,
        users: list.querySelectorAll('.pt-style-cell--user').length,
        columns,
        last: { x: Math.round(last.left - left), y: Math.round(last.top), w: Math.round(last.width) },
        more: more && { x: Math.round(more.left - left), y: Math.round(more.top), w: Math.round(more.width) },
        create: { x: Math.round(create.left - left), y: Math.round(create.top) },
        right: Math.round(list.getBoundingClientRect().right),
        width: document.documentElement.clientWidth,
    };
};

// «Tots els estils» és la cel·la següent: a la dreta a la mateixa fila o, si la fila és plena, a la primera columna
function follows(info) {
    if (!info.more) return false;
    const sameRow = Math.abs(info.more.y - info.last.y) < 2 && info.more.x > info.last.x;
    const step = info.more.x - info.last.x;
    const nextRow = info.more.y > info.last.y + 2 && info.more.x < 2 && info.last.x + info.last.w * 1.5 > info.right;
    return (
        (sameRow && step < info.last.w * 1.5) ||
        nextRow ||
        (info.more.y > info.last.y + 2 && info.more.x < 2 && info.tiles % info.columns === 0)
    );
}

async function check(browser, width, height, users) {
    const mobile = width <= 768;
    const label = `${width} px, ${users} categori${users === 1 ? 'a pròpia' : 'es pròpies'}`;
    const ctx = await browser.newContext({
        viewport: { width, height },
        isMobile: mobile,
        hasTouch: mobile,
        serviceWorkers: 'block',
    });
    const categories = Array.from({ length: users }, (_, index) => ({
        id: `uc-prova-${index}`,
        name: `Proves ${index + 1}`,
        artists: channelIds.slice(index * 2, index * 2 + 2),
    }));
    await ctx.addInitScript(list => {
        try {
            localStorage.setItem(
                'segueix_cookie_consent_v2',
                JSON.stringify({ version: 1, status: 'accepted', source: 'test', updatedAt: new Date().toISOString() })
            );
            localStorage.setItem('catube_music_user_categories', JSON.stringify(list));
        } catch (_) {
            /* iframe sense origen */
        }
    }, categories);
    const page = await ctx.newPage();
    await page.route(/^https?:\/\/(?!localhost)/, route => route.abort());
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('#ptStyles [data-pt-all-styles]', { timeout: 30000 });
    await page.waitForTimeout(400);

    const closed = await page.evaluate(layout);
    ok(`${label}: hi ha les categories pròpies`, closed.users === users, closed.users);
    ok(`${label}: plegat, «Tots els estils» just després de la darrera rajola`, follows(closed), closed);
    ok(
        `${label}: «Crea una categoria» just després de «Tots els estils»`,
        closed.create.y > closed.more.y + 2 || closed.create.x > closed.more.x,
        closed
    );
    ok(`${label}: no desborda la pantalla`, closed.right <= closed.width, closed);
    if (OUT) {
        const section = await page.$('[data-pt-section="styles"]');
        await section.scrollIntoViewIfNeeded();
        await section.screenshot({ path: path.join(OUT, `tots-els-estils-${width}-${users}.png`) });
    }
    await page.click('#ptStyles [data-pt-all-styles]');
    await page.waitForTimeout(300);
    const open = await page.evaluate(layout);
    ok(
        `${label}: desplegat, «Menys estils» just després de la darrera rajola`,
        open.tiles > closed.tiles && follows(open),
        open
    );
    ok(`${label}: sense errors de JS`, errors.length === 0, errors);
    await ctx.close();
}

(async () => {
    await new Promise(resolve => server.listen(PORT, resolve));
    if (OUT) fs.mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
    try {
        for (const [width, height] of [
            [390, 844],
            [1280, 860],
        ]) {
            for (const users of [0, 1, 2]) await check(browser, width, height, users);
        }
    } finally {
        await browser.close();
        server.close();
    }
    process.exit(correcte ? 0 : 1);
})();
