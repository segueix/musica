// Verificació en un navegador real de la llista «Artistes i grups» (#followPage, 2026-10-16).
//
// NO forma part de `npm test`: és una eina opt-in, com verificar-fitxa-artista.js.
// Requisits (no són dependències del projecte):
//   npm i --no-save playwright-core
//   Un binari de Chromium (CHROMIUM_PATH=/ruta/al/chrome si no és a la ubicació per defecte)
//
// Ús:  node tests/browser/verificar-llista-artistes.js
//      ARTISTES_SHOTS=/ruta/captures node tests/browser/verificar-llista-artistes.js
//
// Comprova, a 390 px i a 1280 px: cada artista és un requadre quadrat ple amb la foto del grup, amb marc blanc, i a
// dins hi ha el nom, «Segueix» i amagar; 2 columnes al mòbil; l'índex alfabètic continua; a l'ordinador, en passar-hi
// el ratolí, el requadre s'amplia sense sortir de la pàgina (no perd el marc); tocar-lo obre la fitxa.

const http = require('http');
const { execFileSync } = require('child_process');
const photoCache = new Map();
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
const PORT = Number(process.env.ARTISTES_LLISTA_PORT || 8151);
const OUT = process.env.ARTISTES_SHOTS || '';
const CHANNEL = process.env.FITXA_CANAL || 'UC--8TyZ2PM0NFHWXCzQrUqw'; // The Tyets
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
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
const readLib = file => {
    try {
        return fs.readFileSync(path.join(ROOT, 'node_modules', file), 'utf8');
    } catch (_) {
        return null;
    }
};
const sortable = readLib('sortablejs/Sortable.min.js');
const lz = readLib('lz-string/libs/lz-string.min.js');
let correcte = true;
const ok = (label, condition, detail) => {
    if (!condition) correcte = false;
    console.log(`${condition ? '✅' : '❌'} ${label}`, detail !== undefined ? JSON.stringify(detail) : '');
};

async function openList(browser, width, height) {
    const mobile = width <= 768;
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
    // Fotos de perfil: l'entorn de prova respon 429 si se'n demanen moltes; es baixen amb curl (amb memòria).
    await page.route(/^https?:\/\/(?!localhost)/, route => {
        const url = route.request().url();
        if (/^https:\/\/yt3\.(ggpht|googleusercontent)\.com\//.test(url)) {
            try {
                if (!photoCache.has(url))
                    photoCache.set(url, execFileSync('curl', ['-sS', '--max-time', '15', url], { maxBuffer: 8e6 }));
                return route.fulfill({ status: 200, contentType: 'image/jpeg', body: photoCache.get(url) });
            } catch (_) {
                return route.abort();
            }
        }
        return route.abort();
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://localhost:${PORT}/?seccio=artistes`);
    await page.waitForSelector('#followPage:not(.hidden) .follow-card', { timeout: 30000 });
    await page.evaluate(() => document.getElementById('intro-splash')?.remove());
    await page.waitForTimeout(1200);
    return { ctx, page, errors };
}

const layout = page =>
    page.evaluate(() => {
        const cards = [...document.querySelectorAll('#followPage .follow-card')];
        const rect = el => el.getBoundingClientRect();
        const first = cards[0];
        const inside = (inner, outer) =>
            inner.left >= outer.left - 1 &&
            inner.right <= outer.right + 1 &&
            inner.top >= outer.top - 1 &&
            inner.bottom <= outer.bottom + 1;
        const r = rect(first);
        const style = getComputedStyle(first);
        return {
            count: cards.length,
            ratio: Math.round((r.width / r.height) * 100) / 100,
            columns: new Set(cards.slice(0, 12).map(card => Math.round(rect(card).left))).size,
            filled: cards.slice(0, 6).every(card => {
                const img = card.querySelector('.follow-avatar').getBoundingClientRect();
                const box = card.getBoundingClientRect();
                return Math.abs(img.width - (box.width - 4)) < 3 && Math.abs(img.height - (box.height - 4)) < 3;
            }),
            // Sense marc blanc en repòs (2026-10-16): només en passar-hi el ratolí o en enfocar-lo
            framed: style.borderTopColor !== 'rgb(255, 255, 255)',
            dataInside: cards.slice(0, 6).every(card =>
                ['.follow-name', '.follow-hits-btn', '.follow-toggle-btn'].every(sel => {
                    const el = card.querySelector(sel);
                    return !el || inside(rect(el), rect(card));
                })
            ),
            hasFollow: Boolean(first.querySelector('.follow-toggle-btn')),
            azIndex:
                Boolean(document.querySelector('.az-index')) &&
                Boolean(document.querySelector('.follow-grid.has-az-index')),
            pageWidth: document.documentElement.scrollWidth,
            viewport: window.innerWidth,
        };
    });

async function check(browser, width, height, label) {
    const { ctx, page, errors } = await openList(browser, width, height);
    const info = await layout(page);
    ok(`${label}: requadres quadrats`, Math.abs(info.ratio - 1) < 0.03, info.ratio);
    ok(`${label}: la foto omple el requadre`, info.filled);
    ok(`${label}: sense marc blanc en repòs`, info.framed);
    ok(`${label}: nom, «Segueix» i amagar dins el requadre`, info.dataInside && info.hasFollow);
    ok(`${label}: índex alfabètic`, info.azIndex);
    if (width < 560) ok(`${label}: dues columnes`, info.columns === 2, info.columns);
    else ok(`${label}: diverses columnes`, info.columns >= 3, info.columns);
    ok(`${label}: la pàgina no es desborda`, info.pageWidth <= info.viewport, [info.pageWidth, info.viewport]);
    if (OUT) await page.screenshot({ path: path.join(OUT, `artistes-${width}.png`) });
    if (width >= 769) {
        // Els requadres de les vores, ampliats, no han de sortir del contenidor que retalla (perdrien el marc)
        const edge = await page.evaluate(() => {
            const cards = [...document.querySelectorAll('#followPage .follow-card')];
            const lefts = cards.map(card => card.getBoundingClientRect().left);
            const maxLeft = Math.max(...lefts.slice(0, 20));
            return cards.findIndex(card => card.getBoundingClientRect().left === maxLeft);
        });
        for (const index of [0, edge]) {
            const sel = `#followPage .follow-card:nth-child(${index + 1})`;
            await page.hover(sel);
            await page.waitForTimeout(350);
            const res = await page.evaluate(sel => {
                const card = document.querySelector(sel);
                const box = card.getBoundingClientRect();
                let clipper = card.parentElement;
                while (clipper && clipper !== document.body) {
                    const cs = getComputedStyle(clipper);
                    if (cs.overflow !== 'visible' || /paint|content|strict/.test(cs.contain)) break;
                    clipper = clipper.parentElement;
                }
                const clip = clipper.getBoundingClientRect();
                return {
                    scaled: Math.round(box.width) > card.offsetWidth,
                    inside: box.left >= clip.left - 0.5 && box.right <= clip.right + 0.5 && box.top >= clip.top - 0.5,
                    box: [Math.round(box.left), Math.round(box.right)],
                    clip: [Math.round(clip.left), Math.round(clip.right)],
                };
            }, sel);
            ok(`${label}: requadre ${index + 1} s'amplia sense perdre el marc`, res.scaled && res.inside, res);
        }
        await page.mouse.move(0, 0);
    }
    const name = (await page.textContent('#followPage .follow-card .follow-name')).trim();
    await page.click('#followPage .follow-card .follow-avatar');
    await page.waitForSelector('#channelPage:not(.hidden)', { timeout: 10000 });
    ok(
        `${label}: tocar el requadre obre la fitxa`,
        (await page.textContent('#channelProfileName')).trim() === name,
        name
    );
    ok(`${label}: sense errors`, errors.length === 0, errors);
    await ctx.close();
}

server.listen(PORT, async () => {
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
    try {
        await check(browser, 390, 844, 'mòbil');
        await check(browser, 1280, 900, 'ordinador');
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\nTot correcte.' : '\nHi ha errors.');
    process.exit(correcte ? 0 : 1);
});
