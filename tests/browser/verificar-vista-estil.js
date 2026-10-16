// Verificació en un navegador real de la vista d'un estil (Pop, Rock…), 2026-10-16.
//
// NO forma part de `npm test`: és una eina opt-in, com verificar-fitxa-artista.js.
// Requisits (no són dependències del projecte):
//   npm i --no-save playwright-core
//   Un binari de Chromium (CHROMIUM_PATH=/ruta/al/chrome si no és a la ubicació per defecte)
//
// Ús:  node tests/browser/verificar-vista-estil.js
//      ESTIL_SHOTS=/ruta/captures ESTIL=Rock node tests/browser/verificar-vista-estil.js
//
// Comprova, a 390 px i a 1280 px:
//   1) El selector «Estil» ja no té «Música TV» (herència de Segueix youtubers).
//   2) La cançó destacada té la caràtula de fons a tot el requadre i el nom del grup just sota el títol.
//   3) La filera d'artistes continua abans de les cançons.
//   4) Les cançons: caràtules quadrades plenes amb la imatge i el marc blanc, quatre columnes a l'ordinador i dues al
//      mòbil, amb el títol a baix i el play; a l'ordinador s'amplien una mica en passar-hi el ratolí.
//   5) Tocar una caràtula fa sonar la cançó; Inici i la cerca no porten l'estil nou.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
let chromium;
try {
    ({ chromium } = require('playwright-core'));
} catch (_) {
    console.log('⏭️  playwright-core no instal·lat: verificació omesa.');
    process.exit(0);
}
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.ESTIL_TEST_PORT || 8152);
const OUT = process.env.ESTIL_SHOTS || '';
const STYLE = process.env.ESTIL || 'Pop';
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
// Caràtules i fotos: el navegador de prova rep 429/ORB de YouTube; es baixen amb curl (en paral·lel)
const images = new Map();
const curl = url =>
    new Promise((resolve, reject) =>
        execFile('curl', ['-sS', '--max-time', '15', url], { maxBuffer: 8e6, encoding: 'buffer' }, (error, out) =>
            error ? reject(error) : resolve(out)
        )
    );
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
        if (OUT && /^https:\/\/(i\.ytimg\.com|yt3\.ggpht\.com)\//.test(url)) {
            if (!images.has(url)) images.set(url, curl(url));
            return images
                .get(url)
                .then(body => route.fulfill({ status: 200, contentType: 'image/jpeg', body }))
                .catch(() => route.abort());
        }
        return route.abort();
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
    await page.evaluate(() => document.getElementById('intro-splash')?.remove());
    return { ctx, page, errors };
}

async function check(browser, width, height, label) {
    const { ctx, page, errors } = await open(browser, width, height);
    await page.waitForTimeout(600);
    ok(
        `${label}: Inici no porta l'estil de la vista d'un estil`,
        !(await page.evaluate(() => document.getElementById('homePage').classList.contains('is-style-view')))
    );
    const options = await page.evaluate(() =>
        [...document.querySelectorAll('.chips-bar .chip')].map(c => c.textContent)
    );
    ok(`${label}: sense «Música TV» ni «Segueix TV»`, !options.some(text => /TV/.test(text)), options.slice(0, 4));
    await page.evaluate(style => window.SegueixApp.features.shellNav.openStyle(style), STYLE);
    await page.waitForSelector('#homePage.is-style-view #videosGrid .video-card', { timeout: 20000 });
    await page.waitForTimeout(800);
    const info = await page.evaluate(() => {
        const rect = el => el.getBoundingClientRect();
        const hero = document.getElementById('heroSection');
        const img = document.getElementById('heroImage');
        const title = document.getElementById('heroTitle');
        const channel = document.getElementById('heroChannel');
        const artists = document.getElementById('categoryArtists');
        const grid = document.getElementById('videosGrid');
        const cards = [...grid.querySelectorAll('.video-card')].slice(0, 8);
        const first = cards[0];
        return {
            heroCover:
                Math.abs(rect(img).width - (rect(hero).width - 4)) < 3 &&
                Math.abs(rect(img).height - (rect(hero).height - 4)) < 3,
            heroFrame: getComputedStyle(hero).borderTopColor === 'rgb(255, 255, 255)',
            titleInside: rect(title).top > rect(hero).top && rect(title).bottom < rect(hero).bottom,
            channelUnderTitle: rect(channel).top >= rect(title).bottom - 2 && rect(channel).left - rect(title).left < 4,
            channelSize: parseFloat(getComputedStyle(channel).fontSize),
            artistsBefore: !artists.classList.contains('hidden') && rect(artists).bottom <= rect(grid).top + 1,
            columns: new Set(cards.map(card => Math.round(rect(card).left))).size,
            square: cards.every(card => Math.abs(rect(card).width - rect(card).height) < 2),
            framed: cards.every(card => getComputedStyle(card).borderTopColor === 'rgb(255, 255, 255)'),
            fill: (() => {
                const thumb = first.querySelector('.video-thumbnail img');
                return Math.abs(rect(thumb).width - (rect(first).width - 4)) < 2;
            })(),
            titleLow: rect(first.querySelector('.video-card-title')).top > rect(first).top + rect(first).height / 2,
            gap: Math.round(rect(cards[1]).left - rect(cards[0]).right),
            pageWidth: document.documentElement.scrollWidth,
            viewport: window.innerWidth,
        };
    });
    ok(`${label}: la caràtula omple la cançó destacada, amb el marc blanc`, info.heroCover && info.heroFrame);
    ok(
        `${label}: títol i grup damunt la caràtula, el grup just sota el títol`,
        info.titleInside && info.channelUnderTitle
    );
    ok(`${label}: el nom del grup es veu gran (≥ 18 px)`, info.channelSize >= 18, info.channelSize);
    ok(`${label}: la filera d'artistes abans de les cançons`, info.artistsBefore);
    ok(
        `${label}: ${width >= 1025 ? 'quatre' : 'dues'} columnes amb el mínim espai`,
        info.columns === (width >= 1025 ? 4 : 2) && info.gap <= 6,
        [info.columns, info.gap]
    );
    ok(`${label}: caràtules quadrades, plenes i amb el marc blanc`, info.square && info.framed && info.fill);
    ok(`${label}: el títol a baix de la caràtula`, info.titleLow);
    ok(`${label}: la pàgina no es desborda`, info.pageWidth <= info.viewport, [info.pageWidth, info.viewport]);
    if (OUT) {
        await page.screenshot({ path: path.join(OUT, `estil-${width}.png`) });
        await page.evaluate(() => {
            const g = document.getElementById('categoryArtists');
            window.scrollTo(0, g.getBoundingClientRect().top + window.scrollY - 70);
        });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(OUT, `estil-${width}-cancons.png`) });
    }
    if (width >= 1025) {
        const sel = '#videosGrid .video-card:nth-child(2)';
        await page.locator(sel).scrollIntoViewIfNeeded();
        const before = await page.$eval(sel, el => el.getBoundingClientRect().width);
        await page.hover(sel);
        await page.waitForTimeout(350);
        const after = await page.$eval(sel, el => el.getBoundingClientRect().width);
        ok(`${label}: en passar-hi el ratolí, la caràtula s'amplia una mica`, after > before * 1.02, [before, after]);
        await page.mouse.move(0, 0);
    }
    // Tocar una caràtula fa sonar la cançó
    const id = await page.$eval('#videosGrid .video-card:nth-child(3)', el => el.dataset.videoId);
    await page.click('#videosGrid .video-card:nth-child(3) .video-thumbnail');
    await page.waitForTimeout(1200);
    const playing = await page.evaluate(() => String(currentVideoId || ''));
    ok(`${label}: tocar una caràtula fa sonar la cançó`, playing === id, [playing, id]);
    // La cerca no porta l'estil de la vista d'un estil
    await page.evaluate(() => navigateToSearchResults('pop'));
    await page.waitForTimeout(600);
    ok(
        `${label}: la cerca no porta l'estil de la vista d'un estil`,
        !(await page.evaluate(() => document.getElementById('homePage').classList.contains('is-style-view')))
    );
    const own = errors.filter(message => !/localStorage.*Access is denied/.test(message));
    ok(`${label}: sense errors`, own.length === 0, own);
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
