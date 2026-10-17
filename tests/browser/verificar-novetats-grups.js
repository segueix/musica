// Verificació en un navegador real d'«Acabades de sortir» a Inici (2026-10-17).
//
// NO forma part de `npm test`: és una eina opt-in. Requisits: npm i --no-save playwright-core i un Chromium
// (CHROMIUM_PATH=/ruta/al/chrome si no és a la ubicació per defecte).
//
// Ús:  node tests/browser/verificar-novetats-grups.js
//      NOVETATS_SHOTS=/ruta/captures node tests/browser/verificar-novetats-grups.js
//
// A 1280 px (ratolí) i a 390 px (tàctil): si un grup ha publicat més cançons el mateix dia, la seva targeta porta el
// «+N» (càpsula llima); tocar-lo hi desplega les altres cançons just al costat i tornar-lo a tocar les amaga. A
// l'ordinador, en passar el ratolí per la primera caràtula, s'amplia cap a dins i el marc de l'esquerra no es retalla.

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
const PORT = Number(process.env.NOVETATS_TEST_PORT || 8161);
const OUT = process.env.NOVETATS_SHOTS || '';
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
    await page.waitForSelector('[data-pt-section="fresh"] .pt-card', { timeout: 30000 });
    await page.waitForTimeout(800);

    const groups = await page.evaluate(() => {
        const model = window.SegueixApp.features.portada.getModel();
        return Object.entries(model.fresh?.groups || {}).map(([id, others]) => ({ id, n: others.length }));
    });
    ok(`${label}: hi ha algun grup amb diverses cançons del mateix dia al feed`, groups.length > 0, groups.slice(0, 5));
    if (!groups.length) return ctx.close();
    const first = groups[0];

    const badge = await page.evaluate(id => {
        const button = document.querySelector(`[data-pt-group="${id}"]`);
        const card = button?.closest('.pt-card');
        if (!button || !card) return null;
        const b = button.getBoundingClientRect();
        const c = card.getBoundingClientRect();
        const style = getComputedStyle(button);
        return {
            text: button.textContent.replace(/\s+/g, ' ').trim(),
            inside: b.left >= c.left && b.top >= c.top && b.right <= c.right,
            background: style.backgroundColor,
            height: Math.round(b.height),
            expanded: button.getAttribute('aria-expanded'),
        };
    }, first.id);
    ok(
        `${label}: la targeta porta el «+${first.n}» llima i ben visible`,
        badge &&
            badge.text.startsWith(`+${first.n}`) &&
            badge.inside &&
            badge.height >= 32 &&
            badge.background === 'rgb(214, 237, 132)',
        badge
    );
    await page.evaluate(
        id => document.querySelector(`[data-pt-group="${id}"]`).scrollIntoView({ block: 'center', inline: 'center' }),
        first.id
    );
    await page.waitForTimeout(300);
    if (OUT) await page.screenshot({ path: path.join(OUT, `novetats-grup-${width}.png`) });

    await page.click(`[data-pt-group="${first.id}"]`);
    await page.waitForTimeout(1200);
    const open = await page.evaluate(id => {
        const siblings = [...document.querySelectorAll(`[data-pt-group-of="${id}"]`)];
        const lead = document.querySelector(`[data-pt-group="${id}"]`)?.closest('.pt-cell');
        return {
            siblings: siblings.length,
            nextToLead: siblings.length ? lead?.nextElementSibling === siblings[0] : false,
            expanded: document.querySelector(`[data-pt-group="${id}"]`)?.getAttribute('aria-expanded'),
            text: document.querySelector(`[data-pt-group="${id}"]`)?.textContent.replace(/\s+/g, ' ').trim(),
            visible: siblings.length
                ? (() => {
                      const r = siblings[0].getBoundingClientRect();
                      return r.right <= window.innerWidth + 2 && r.left >= -2;
                  })()
                : false,
        };
    }, first.id);
    ok(
        `${label}: tocar-lo hi desplega les ${first.n} cançons del mateix dia, just al costat`,
        open.siblings === first.n && open.nextToLead && open.expanded === 'true',
        open
    );
    ok(`${label}: la fila es desplaça fins a la primera cançó desplegada`, open.visible, open);
    if (OUT) await page.screenshot({ path: path.join(OUT, `novetats-grup-obert-${width}.png`) });

    await page.click(`[data-pt-group="${first.id}"]`);
    await page.waitForTimeout(300);
    const closed = await page.evaluate(id => document.querySelectorAll(`[data-pt-group-of="${id}"]`).length, first.id);
    ok(`${label}: tornar-lo a tocar les amaga`, closed === 0, closed);

    if (!mobile) {
        await page.evaluate(() => document.querySelector('[data-pt-section="fresh"] .pt-row').scrollTo({ left: 0 }));
        await page.evaluate(() =>
            document.querySelector('[data-pt-section="fresh"]').scrollIntoView({ block: 'center' })
        );
        await page.waitForTimeout(300);
        const card = await page.$('[data-pt-section="fresh"] .pt-row > .pt-cell:first-child .pt-card');
        await card.hover({ position: { x: 60, y: 160 } });
        await page.waitForTimeout(400);
        const edge = await page.evaluate(() => {
            const card = document.querySelector('[data-pt-section="fresh"] .pt-row > .pt-cell:first-child .pt-card');
            const home = document.getElementById('homePage');
            const c = card.getBoundingClientRect();
            const h = home.getBoundingClientRect();
            const style = getComputedStyle(card);
            return {
                scaled: style.transform !== 'none',
                origin: style.transformOrigin,
                border: style.borderLeftColor,
                left: Math.round(c.left),
                homeLeft: Math.round(h.left),
            };
        });
        ok(
            `${label}: la primera caràtula ampliada no surt per l'esquerra (es veu el marc)`,
            edge.scaled && edge.left >= edge.homeLeft && edge.border === 'rgb(255, 255, 255)',
            edge
        );
        if (OUT) {
            const box = await card.boundingBox();
            await page.screenshot({
                path: path.join(OUT, `novetats-primera-hover-${width}.png`),
                clip: {
                    x: Math.max(0, box.x - 40),
                    y: Math.max(0, box.y - 30),
                    width: box.width + 120,
                    height: box.height + 60,
                },
            });
        }
    }
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
