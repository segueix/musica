// Verificació en un navegador real de «Per afinitat» (js/features/affinity.js) a Descobreix i de la goma del mapa.
//
// NO forma part de `npm test`: és una eina opt-in, com verificar-mapa.js.
// Ús:  node tests/browser/verificar-afinitat.js   (AFINITAT_SHOTS=/ruta/captures per a les captures)
//
// Comprova: a Descobreix no hi ha la cançó destacada ni «Recomanat per a tu»; sense historial surten els estils;
// amb historial, targetes «Si t'agrada X, prova Y» amb el perquè («Perquè escoltes…»), d'artistes que no són a
// l'historial; tocar-ne una obre la fitxa; al mapa, la goma surt quan hi ha un lloc triat i l'esborra.

const http = require('http');
const { execFileSync } = require('child_process');
const photoCache = new Map();
const fs = require('fs');
const path = require('path');
let chromium;
try {
    ({ chromium } = require('playwright-core'));
} catch (_) {
    try {
        ({ chromium } = require('playwright'));
    } catch (_e) {
        chromium = null;
    }
}
if (!chromium) {
    console.log('⏭️  playwright no instal·lat: verificació omesa.');
    process.exit(0);
}
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.AFINITAT_TEST_PORT || 8151);
const OUT = process.env.AFINITAT_SHOTS || '';
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

async function open(browser, width, height) {
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
    await page.route(/^https?:\/\/(?!localhost)/, route => {
        const url = route.request().url();
        if (/sortablejs/.test(url) && sortable)
            return route.fulfill({ status: 200, contentType: 'application/javascript', body: sortable });
        if (/lz-string/.test(url) && lz)
            return route.fulfill({ status: 200, contentType: 'application/javascript', body: lz });
        // Fotos dels grups de les targetes (=s400): el navegador de prova rep 429 de yt3; es baixen amb curl
        if (/^https:\/\/yt3\.(ggpht|googleusercontent)\.com\/.*=s400/.test(url)) {
            try {
                if (!photoCache.has(url)) {
                    photoCache.set(url, execFileSync('curl', ['-sS', '--max-time', '15', url], { maxBuffer: 8e6 }));
                }
                return route.fulfill({ status: 200, contentType: 'image/jpeg', body: photoCache.get(url) });
            } catch (_) {
                return route.abort();
            }
        }
        return route.abort();
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
    await page.evaluate(() => document.getElementById('intro-splash')?.remove());
    ok(`${width} px: a Inici no hi ha el mapa`, await page.isHidden('#artistMap'));
    await page.evaluate(() => window.SegueixApp.features.shellNav.ACTIONS.discover());
    await page.waitForSelector('#artistMap:not(.hidden) .am-dot', { timeout: 30000 });
    await page.waitForTimeout(500);
    return { ctx, page, errors };
}

async function withTaste(page) {
    return page.evaluate(() => {
        const vids = YouTubeAPI.feedVideos;
        const pick = name => vids.filter(v => (v.channelTitle || '').toLowerCase().includes(name)).slice(0, 3);
        const hist = [...pick('catarres'), ...pick('sopa de cabra'), ...pick('oques grasses')].map((v, i) => ({
            ...v,
            viewedAt: new Date(Date.now() - i * 3600e3).toISOString(),
        }));
        localStorage.setItem('catube_history', JSON.stringify(hist));
        _historyItemsCache = null;
        window.SegueixApp.features.shellNav.ACTIONS.home();
        return [...new Set(hist.map(v => v.channelTitle))];
    });
}

const readInfo = page =>
    page.evaluate(() => ({
        title: document.getElementById('pageTitle').textContent,
        hero: !document.getElementById('heroSection').classList.contains('hidden'),
        cards: [...document.querySelectorAll('.af-card')].map(c => ({
            lead: c.querySelector('.af-card__lead').textContent,
            name: c.querySelector('.af-card__name').textContent,
            why: c.querySelector('.af-card__why').textContent,
            chips: c.querySelector('.af-card__chips').textContent,
            // La foto del grup omple tot el fons i la targeta porta el marc blanc
            photo: (() => {
                const img = c.querySelector('.af-card__photo');
                const a = img?.getBoundingClientRect();
                const b = c.getBoundingClientRect();
                const style = getComputedStyle(c);
                return Boolean(
                    a &&
                    Math.abs(a.width - (b.width - 4)) < 2 &&
                    Math.abs(a.height - (b.height - 4)) < 2 &&
                    getComputedStyle(img).objectFit === 'cover' &&
                    style.borderTopColor === 'rgb(255, 255, 255)'
                );
            })(),
            textInside: (() => {
                const name = c.querySelector('.af-card__name').getBoundingClientRect();
                const play = c.querySelector('.af-card__play').getBoundingClientRect();
                const b = c.getBoundingClientRect();
                return name.top >= b.top && play.bottom <= b.bottom + 0.5 && play.left >= b.left;
            })(),
        })),
        styles: document.querySelectorAll('.af-style').length,
        pageW: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
    }));

async function run(browser, width, height, taste) {
    const { ctx, page, errors } = await open(browser, width, height);
    const tag = `${width} px${taste ? ' amb historial' : ' sense historial'}`;
    let known = [];
    if (taste) {
        known = await withTaste(page);
        await page.waitForTimeout(400);
        await page.evaluate(() => window.SegueixApp.features.shellNav.ACTIONS.discover());
        await page.waitForSelector('#affinitySection .af-card', { timeout: 20000 });
    } else {
        await page.waitForSelector('#affinitySection:not(.hidden) .af-style', { timeout: 20000 });
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const info = await readInfo(page);
    ok(`${tag}: sense cançó destacada`, !info.hero);
    ok(`${tag}: sense «Recomanat per a tu»`, info.title !== 'Recomanat per a tu', info.title);
    ok(`${tag}: la pàgina no es desborda`, info.pageW <= info.viewport, [info.pageW, info.viewport]);
    if (OUT) await page.screenshot({ path: path.join(OUT, `afinitat-${width}-${taste ? 'gust' : 'nou'}.png`) });
    if (!taste) {
        ok(`${tag}: mostra els estils`, info.styles > 3 && info.cards.length === 0, info.styles);
    } else {
        console.log(info.cards.map(c => `   ${c.lead} ${c.name} — ${c.why} [${c.chips}]`).join('\n'));
        ok(
            `${tag}: targetes «Si t’agrada X, prova Y»`,
            info.cards.length >= 4 && info.cards.every(c => /^Si t’agrada .+, prova$/.test(c.lead))
        );
        ok(
            `${tag}: la foto del grup omple la targeta, amb el marc blanc`,
            info.cards.every(c => c.photo)
        );
        ok(
            `${tag}: el nom i «Escolta» van dins la foto`,
            info.cards.every(c => c.textInside)
        );
        ok(
            `${tag}: amb el perquè`,
            info.cards.every(c => /^Perquè escoltes /.test(c.why))
        );
        ok(
            `${tag}: artistes que no coneix`,
            info.cards.every(c => !known.includes(c.name)),
            known
        );
        if (width <= 768) {
            // Mòbil: la primera targeta (i l'última, en arribar al final) es veu sencera, amb tot el marc blanc
            // (#homePage té `contain: content` i retalla el que en surt)
            const visible = await page.evaluate(async () => {
                const clip = document.getElementById('homePage').getBoundingClientRect();
                const list = document.querySelector('.af-list');
                const inside = card => {
                    const r = card.getBoundingClientRect();
                    return r.left >= clip.left - 0.5 && r.right <= clip.right + 0.5;
                };
                const first = inside(list.querySelector('.af-card'));
                list.scrollLeft = list.scrollWidth;
                await new Promise(resolve => setTimeout(resolve, 400));
                const last = inside(list.querySelector('.af-card:last-child'));
                list.scrollLeft = 0;
                return { first, last };
            });
            ok(
                `${tag}: la primera i l'última targeta es veuen senceres, amb el marc blanc`,
                visible.first && visible.last,
                visible
            );
        }
        const name = info.cards[0].name.trim();
        await page.click('.af-card__main');
        await page.waitForSelector('#channelPage:not(.hidden)', { timeout: 10000 });
        await page.waitForTimeout(400);
        ok(`${tag}: tocar una targeta obre la fitxa`, (await page.textContent('#channelPage')).includes(name), name);
    }
    ok(`${tag}: sense errors`, errors.length === 0, errors);
    await ctx.close();
}

async function eraser(browser) {
    const { ctx, page, errors } = await open(browser, 1280, 900);
    await page.waitForSelector('#artistMap .am-dot', { timeout: 20000 });
    await page.locator('#artistMap .am-stage').scrollIntoViewIfNeeded();
    ok(
        'mapa: sense res triat, no hi ha goma',
        await page.evaluate(() => document.querySelector('[data-am-clear]').hidden)
    );
    await page.evaluate(() =>
        document.querySelector('#artistMap .am-dot').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    );
    await page.waitForTimeout(200);
    ok(
        'mapa: amb un lloc triat surt la goma',
        await page.evaluate(() => !document.querySelector('[data-am-clear]').hidden)
    );
    if (OUT) await page.screenshot({ path: path.join(OUT, 'mapa-goma.png') });
    await page.click('[data-am-clear]');
    const after = await page.evaluate(() => ({
        hidden: document.querySelector('[data-am-clear]').hidden,
        active: document.querySelectorAll('.am-dot.is-active').length,
        hint: Boolean(document.querySelector('.am-panel__hint')),
    }));
    ok('mapa: la goma esborra la selecció', after.hidden && !after.active && after.hint, after);
    ok('mapa: el lateral no té «Esborra la zona»', !(await page.textContent('#artistMap')).includes('Esborra la zona'));
    ok('mapa: sense errors', errors.length === 0, errors);
    await ctx.close();
}

server.listen(PORT, async () => {
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
    try {
        await run(browser, 390, 844, false);
        await run(browser, 390, 844, true);
        await run(browser, 1280, 900, true);
        await eraser(browser);
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\nTot correcte.' : '\nHi ha errors.');
    process.exit(correcte ? 0 : 1);
});
