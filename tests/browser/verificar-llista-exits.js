// Verificació en un navegador real de la «Llista d'èxits» setmanal d'Inici (2026-10-22).
//
// NO forma part de `npm test`: és una eina opt-in. Requisits: npm i --no-save playwright-core i un Chromium
// (CHROMIUM_PATH=/ruta/al/chrome si no és a la ubicació per defecte).
//
// Ús:  node tests/browser/verificar-llista-exits.js
//      EXITS_SHOTS=/ruta/captures node tests/browser/verificar-llista-exits.js
//
// A 1280 px i a 390 px: la secció surt després d'«Acabades de sortir» amb deu files (dues columnes a l'ordinador,
// una al mòbil, sense desbordar la pantalla), «Mostra les 40» la desplega i tocar una fila engega la selecció
// «Llista d'èxits» a partir d'aquella cançó.

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
const PORT = Number(process.env.EXITS_TEST_PORT || 8167);
const OUT = process.env.EXITS_SHOTS || '';
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
    });
    await ctx.addInitScript(() => {
        // També s'executa a l'iframe de YouTube (bloquejat, sense localStorage)
        try {
            localStorage.setItem(
                'segueix_cookie_consent_v2',
                JSON.stringify({ version: 1, status: 'accepted', source: 'test', updatedAt: new Date().toISOString() })
            );
        } catch (_) {
            /* iframe sense origen */
        }
    });
    const page = await ctx.newPage();
    await page.route(/^https?:\/\/(?!localhost)/, route => route.abort());
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('[data-pt-section="chart"]:not([hidden]) .hc-row', { timeout: 30000 });
    await page.waitForTimeout(500);

    const info = await page.evaluate(() => {
        const sections = [...document.querySelectorAll('#homePage [data-pt-section]')].map(s => s.dataset.ptSection);
        const section = document.querySelector('[data-pt-section="chart"]');
        const rows = [...section.querySelectorAll('.hc-row__btn')].map(b => b.getBoundingClientRect());
        const columns = new Set(rows.map(r => Math.round(r.left))).size;
        const box = section.getBoundingClientRect();
        return {
            sections,
            rows: rows.length,
            columns,
            right: Math.round(box.right),
            width: document.documentElement.clientWidth,
            scroll: document.documentElement.scrollWidth,
            first: section.querySelector('.hc-row__title')?.textContent,
            eyebrow: section.querySelector('.hc__eyebrow')?.textContent.trim(),
            minHeight: Math.min(...rows.map(r => r.height)),
        };
    });
    ok(
        `${label}: va just després d'«Acabades de sortir»`,
        info.sections.indexOf('chart') === info.sections.indexOf('fresh') + 1,
        info.sections
    );
    ok(`${label}: deu files`, info.rows === 10, info.rows);
    ok(`${label}: ${mobile ? 'una columna' : 'dues columnes'}`, info.columns === (mobile ? 1 : 2), info.columns);
    ok(`${label}: no desborda la pantalla`, info.right <= info.width && info.scroll <= info.width, info);
    ok(`${label}: files d'almenys 44 px`, info.minHeight >= 44, info.minHeight);
    ok(`${label}: diu la setmana`, /^Setmana del? /.test(info.eyebrow || ''), info.eyebrow);
    if (OUT) {
        const section = await page.$('[data-pt-section="chart"]');
        await section.scrollIntoViewIfNeeded();
        await section.screenshot({ path: path.join(OUT, `llista-exits-${width}.png`) });
    }

    await page.click('[data-hc-more]');
    const open = await page.evaluate(() => ({
        rows: document.querySelectorAll('[data-pt-section="chart"] .hc-row').length,
        expanded: document.querySelector('[data-hc-more]')?.getAttribute('aria-expanded'),
        text: document.querySelector('[data-hc-more]')?.textContent,
    }));
    ok(`${label}: «Mostra les 40» les desplega`, open.rows > 10 && open.expanded === 'true', open);
    await page.click('[data-hc-more]');

    await page.click('[data-pt-section="chart"] [data-hc-play="2"]');
    await page.waitForTimeout(800);
    const queue = await page.evaluate(() => ({
        name: window.SegueixApp.features.musicQueue?.playlistName?.(),
        first: typeof activePlaylistQueue !== 'undefined' ? activePlaylistQueue[0]?.id : null,
        third: document.querySelectorAll('[data-pt-section="chart"] [data-hc-play]').length,
    }));
    const expected = await page.evaluate(() =>
        fetch('data/llista-exits.json')
            .then(r => r.json())
            .then(chart => chart.entries[2].video.id)
    );
    ok(
        `${label}: tocar la tercera engega «Llista d'èxits» des d'aquella cançó`,
        queue.name === "Llista d'èxits" && queue.first === expected,
        { ...queue, expected }
    );
    ok(`${label}: sense errors de JS`, errors.length === 0, errors);
    await ctx.close();
}

(async () => {
    await new Promise(resolve => server.listen(PORT, resolve));
    if (OUT) fs.mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
    try {
        await check(browser, 1280, 860);
        await check(browser, 390, 844);
    } finally {
        await browser.close();
        server.close();
    }
    process.exit(correcte ? 0 : 1);
})();
