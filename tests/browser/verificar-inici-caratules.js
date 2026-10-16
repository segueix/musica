// Verificació en un navegador real d'Inici amb el llenguatge de caràtules (2026-10-16).
//
// NO forma part de `npm test`: és una eina opt-in. Requisits: npm i --no-save playwright-core i un Chromium
// (CHROMIUM_PATH=/ruta/al/chrome si no és a la ubicació per defecte).
//
// Ús:  node tests/browser/verificar-inici-caratules.js
//      INICI_SHOTS=/ruta/captures node tests/browser/verificar-inici-caratules.js
//
// A 390 i a 1280 px, amb historial, una llista desada i una zona d'«A prop teu»: «Torna-hi», «Acabades de sortir»,
// «Fora del teu radar», «En directe» i «Les teves llistes» són caràtules quadrades, plenes amb la imatge i amb marc
// blanc, i el text hi va a dins; els estils tenen les fotos de fons; «La teva ràdio» i «A prop teu» tenen les
// caràtules de fons; no es veu cap subtítol explicatiu; tocar una caràtula fa sonar la cançó.

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
const PORT = Number(process.env.INICI_TEST_PORT || 8154);
const OUT = process.env.INICI_SHOTS || '';
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
        localStorage.setItem(
            'segueix_nearby_manual_v1',
            JSON.stringify({ name: 'Vic', territory: 'Catalunya', coordinates: { latitude: 41.93, longitude: 2.255 } })
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
    // Historial i una llista desada, i torna a pintar Inici
    await page.evaluate(() => {
        document.getElementById('intro-splash')?.remove();
        const vids = YouTubeAPI.feedVideos;
        const pick = name => vids.filter(v => (v.channelTitle || '').toLowerCase().includes(name)).slice(0, 3);
        const history = [...pick('catarres'), ...pick('sopa de cabra')].map((v, i) => ({
            ...v,
            viewedAt: new Date(Date.now() - i * 3600e3).toISOString(),
        }));
        localStorage.setItem('catube_history', JSON.stringify(history));
        localStorage.setItem(
            'catube_playlists',
            JSON.stringify([
                {
                    id: 'pl1',
                    name: 'Per córrer',
                    videos: vids
                        .slice(0, 6)
                        .map(v => ({ id: v.id, title: v.title, thumbnail: v.thumbnail, channelId: v.channelId })),
                },
            ])
        );
        _historyItemsCache = null;
        window.SegueixApp.features.shellNav.ACTIONS.home();
    });
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => {
        const square = selector => {
            const items = [...document.querySelectorAll(selector)].slice(0, 4);
            return {
                n: items.length,
                ok: items.every(el => {
                    const r = el.getBoundingClientRect();
                    const s = getComputedStyle(el);
                    return (
                        Math.abs(r.width - r.height) < 2 &&
                        s.borderTopColor === 'rgb(255, 255, 255)' &&
                        parseFloat(s.borderTopWidth) >= 2
                    );
                }),
            };
        };
        const filled = (item, img) => {
            const el = document.querySelector(item);
            const image = el?.querySelector(img);
            if (!el || !image) return false;
            const a = el.getBoundingClientRect();
            const b = image.getBoundingClientRect();
            return b.width >= a.width - 6 && b.height >= a.height - 6;
        };
        const inside = (item, text) => {
            const el = document.querySelector(item);
            const t = el?.querySelector(text);
            if (!el || !t) return false;
            const a = el.getBoundingClientRect();
            const b = t.getBoundingClientRect();
            return b.top >= a.top && b.bottom <= a.bottom + 1 && b.left >= a.left - 1;
        };
        const visibleSubs = [
            ...document.querySelectorAll('#homePage .pt-head__sub, #homePlaylists .home-section-subtitle'),
        ].filter(el => el.getBoundingClientRect().width > 2).length;
        return {
            cards: square('#homePage .pt-card'),
            portraits: square('#homePage .pt-portrait'),
            quick: square('#homePage .pt-quick'),
            lists: square('#homePlaylists .hp-item > .hp-card'),
            cardFill: filled('.pt-card', '.pt-card__media img'),
            cardText: inside('.pt-card', '.pt-card__title'),
            portraitFill: filled('.pt-portrait', '.pt-portrait__img'),
            portraitText: inside('.pt-portrait', '.pt-portrait__name'),
            quickFill: filled('.pt-quick', '.pt-quick__thumb'),
            styleFill: filled('.pt-style:not(.pt-style--add):not(.pt-style--more)', '.pt-style__faces'),
            radioFill: filled('#ptRadio', '.pt-radio__covers'),
            nearFill: filled('.pt-near.has-place', '.pt-near__covers'),
            visibleSubs,
            pageWidth: document.documentElement.scrollWidth,
            viewport: window.innerWidth,
        };
    });
    for (const [key, name] of [
        ['cards', 'cançons («Acabades de sortir», «En directe»)'],
        ['portraits', '«Fora del teu radar»'],
        ['quick', '«Torna-hi»'],
        ['lists', '«Les teves llistes»'],
    ]) {
        ok(`${label}: ${name}: caràtules quadrades amb marc blanc`, info[key].n > 0 && info[key].ok, info[key]);
    }
    ok(
        `${label}: la imatge omple les caràtules i el text hi va a dins`,
        info.cardFill && info.cardText && info.portraitFill && info.portraitText && info.quickFill
    );
    ok(`${label}: els estils tenen les fotos dels artistes de fons`, info.styleFill);
    ok(`${label}: «La teva ràdio» i «A prop teu» tenen les caràtules de fons`, info.radioFill && info.nearFill, [
        info.radioFill,
        info.nearFill,
    ]);
    ok(`${label}: cap subtítol explicatiu visible`, info.visibleSubs === 0, info.visibleSubs);
    ok(`${label}: la pàgina no es desborda`, info.pageWidth <= info.viewport, [info.pageWidth, info.viewport]);
    if (OUT) await page.screenshot({ path: path.join(OUT, `inici-${width}.png`), fullPage: true });
    // Tocar una caràtula d'«Acabades de sortir» fa sonar la cançó
    const id = await page.$eval('.pt-section--fresh .pt-card', el => el.dataset.videoId);
    await page.click('.pt-section--fresh .pt-card .pt-card__media');
    await page.waitForTimeout(1200);
    const playing = await page.evaluate(() => String(currentVideoId || ''));
    ok(`${label}: tocar una caràtula fa sonar la cançó`, playing === id, [playing, id]);
    const own = errors.filter(message => !/localStorage.*Access is denied/.test(message));
    ok(`${label}: sense errors`, own.length === 0, own);
    await ctx.close();
}

server.listen(PORT, async () => {
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
    try {
        await check(browser, 390, 844);
        await check(browser, 1280, 900);
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\nTot correcte.' : '\nHi ha errors.');
    process.exit(correcte ? 0 : 1);
});
