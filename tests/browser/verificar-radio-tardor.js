// Verificació en un navegador real de la «Ràdio de tardor» d'Inici (2026-10-24).
//
// NO forma part de `npm test`: és una eina opt-in, com verificar-vista-estil.js.
// Requisits (no són dependències del projecte):
//   npm i --no-save playwright-core
//   Un binari de Chromium (CHROMIUM_PATH=/ruta/al/chrome si no és a la ubicació per defecte)
//
// Ús:  node tests/browser/verificar-radio-tardor.js   (amb TARDOR_SHOTS=<carpeta> fa captures)
//
// Comprova, al mòbil i a l'ordinador, amb el rellotge de l'app al 24/10/2026:
//   1) A Inici hi ha la targeta «Ràdio de tardor», al davant d'«Acabades de sortir», amb el dibuix de fulles de fons.
//   2) «Engega la ràdio» engega «Ràdio de tardor» amb cançons de la selecció.

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
const PORT = Number(process.env.TARDOR_PORT || 8158);
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

async function open(browser, { width, height, query = '' }) {
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
        // Dins de la temporada: el 24 d'octubre de 2026 a migdia
        const fixed = Date.parse('2026-10-24T10:00:00Z');
        const RealDate = Date;
        const offset = fixed - RealDate.now();
        // eslint-disable-next-line no-global-assign
        Date = class extends RealDate {
            constructor(...args) {
                super(...(args.length ? args : [RealDate.now() + offset]));
            }
            static now() {
                return RealDate.now() + offset;
            }
        };
    });
    const page = await ctx.newPage();
    await page.route(/^https?:\/\/(?!localhost)/, route => route.abort());
    const errors = [];
    // L'iframe de YouTube (bloquejat a la prova) no pot llegir localStorage: no és un error de l'app
    page.on('pageerror', error => !/localStorage.*Access is denied/.test(error.message) && errors.push(error.message));
    await page.goto(`http://localhost:${PORT}/${query}`);
    await page.evaluate(() => document.getElementById('intro-splash')?.remove());
    return { ctx, page, errors };
}

const fs2 = require('fs');
const SHOTS = process.env.TARDOR_SHOTS || '';

async function check(browser, width, height, label) {
    const { ctx, page, errors } = await open(browser, { width, height });
    await page.waitForSelector('#homePage .pt-season[data-season="tardor"]', { timeout: 30000 });
    await page.waitForTimeout(800);
    const card = await page.evaluate(() => {
        const section = document.querySelector('.pt-season[data-season="tardor"]');
        const fresh = document.querySelector('[data-pt-section="fresh"]');
        const box = section.getBoundingClientRect();
        const style = getComputedStyle(section);
        const button = section.querySelector('[data-season-play]').getBoundingClientRect();
        return {
            title: section.querySelector('.pt-season__title')?.textContent,
            count: section.querySelector('.pt-season__count')?.textContent,
            beforeFresh: !fresh || Boolean(section.compareDocumentPosition(fresh) & Node.DOCUMENT_POSITION_FOLLOWING),
            images: section.querySelectorAll('img').length,
            leaves: /fulles-tardor\.svg/.test(style.backgroundImage),
            repeat: style.backgroundRepeat,
            color: style.backgroundColor,
            inside: box.left >= 0 && box.right <= window.innerWidth + 1,
            button: [Math.round(button.width), Math.round(button.height)],
            top: Math.round(box.top + window.scrollY),
        };
    });
    ok(
        `${label}: la targeta «Ràdio de tardor» és a Inici`,
        card.title === 'Ràdio de tardor' && /cançons/.test(card.count),
        card
    );
    ok(`${label}: al davant d'«Acabades de sortir»`, card.beforeFresh, card);
    ok(
        `${label}: fons de fulles de tardor sobre marró clar, repetit per tota la caixa, sense caràtules`,
        card.leaves &&
            /repeat/.test(card.repeat.split(',').pop()) &&
            card.color === 'rgb(220, 192, 154)' &&
            card.images === 0 &&
            card.inside,
        card
    );
    ok(`${label}: botó tàctil`, card.button[1] >= 44, card.button);
    if (SHOTS) {
        fs2.mkdirSync(SHOTS, { recursive: true });
        const el = await page.$('.pt-season');
        await el.screenshot({ path: path.join(SHOTS, `tardor-${width}.png`) });
    }
    await page.click('[data-season-play="tardor"]');
    await page
        .waitForFunction(() => /tardor/.test(window.SegueixApp.features.musicQueue?.playlistName?.() || ''), null, {
            timeout: 15000,
        })
        .catch(() => {});
    const radio = await page.evaluate(async () => {
        const data = await (await fetch('data/radios-temporada.json')).json();
        const ids = new Set(data.radios[0].videos.map(v => v.id));
        const queue = Array.isArray(activePlaylistQueue) ? activePlaylistQueue : [];
        return {
            name: window.SegueixApp.features.musicQueue?.playlistName?.() || '',
            watch: !document.getElementById('watchPage').classList.contains('hidden'),
            length: queue.length,
            allFromList: queue.every(v => ids.has(String(v.id))),
            header: document.querySelector('.mq .mq-style')?.textContent || '',
        };
    });
    ok(
        `${label}: engega «Ràdio de tardor» amb cançons de la selecció`,
        /Ràdio de tardor/.test(radio.name) && radio.watch && radio.length >= 10 && radio.allFromList,
        radio
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
