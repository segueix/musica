// Verificació en navegador real: amb una ràdio sonant, els botons «enrere» / «endavant» del navegador (o del mòbil) no
// trenquen la vista. Abans, tornar a la cançó (amb la ràdio a la finestra flotant, o al mòbil després de sortir-ne)
// la carregava com un vídeo sol: sense la ràdio, amb el reproductor buit i «Altres vídeos relacionats».
//
// YouTube no es pot carregar aquí: se serveix el mateix succedani d'embed que verificar-play-pausa.js.
// NO forma part de `npm test`: és una eina opt-in. Requisits: playwright-core i un Chromium (CHROMIUM_PATH).
// Ús:  node tests/browser/verificar-enrere-radio.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const { ambGustRecent } = require('./gust-recent');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.MUSICA_TEST_PORT || 8151);
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let chromium;
try {
    ({ chromium } = require('playwright-core'));
} catch (_) {
    console.log('⏭️  playwright-core no instal·lat: verificació omesa.');
    process.exit(0);
}

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
};

// El mateix succedani d'embed de YouTube que verificar-play-pausa.js
const STUB_PLAYER = fs
    .readFileSync(path.join(__dirname, 'verificar-play-pausa.js'), 'utf8')
    .match(/const STUB_PLAYER = `([\s\S]*?)`;/)[1];

function serve() {
    return new Promise(resolve => {
        const server = http.createServer((req, res) => {
            const urlPath = decodeURIComponent(req.url.split('?')[0]);
            const file = path.join(ROOT, urlPath === '/' ? '/index.html' : urlPath);
            if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
                res.writeHead(404);
                res.end('no trobat');
                return;
            }
            res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
            fs.createReadStream(file).pipe(res);
        });
        server.listen(PORT, () => resolve(server));
    });
}

let correcte = true;
const comprovar = (etiqueta, condicio, detall) => {
    console.log(`${condicio ? '✅' : '❌'} ${etiqueta} ${detall !== undefined ? JSON.stringify(detall) : ''}`);
    if (!condicio) correcte = false;
};

const estat = page =>
    page.evaluate(() => {
        const visible = selector => {
            const el = document.querySelector(selector);
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        };
        return {
            fitxa: visible('#watchPage'),
            radio: visible('.mq'),
            relacionats: visible('#relatedVideos'),
            reproductor: Boolean(document.querySelector('#videoPlayer iframe')),
            cua: (window.activePlaylistQueue || (typeof activePlaylistQueue !== 'undefined' ? activePlaylistQueue : []))
                .length,
        };
    });

async function escenari(browser, width, nom, passos) {
    const mobile = width <= 768;
    const context = await browser.newContext({
        viewport: { width, height: mobile ? 844 : 800 },
        isMobile: mobile,
        hasTouch: mobile,
        serviceWorkers: 'block',
    });
    await context.addInitScript(() => {
        try {
            if (localStorage.getItem('__musica_seed')) return;
            localStorage.setItem(
                'segueix_cookie_consent_v2',
                JSON.stringify({ version: 1, status: 'accepted', source: 'test', updatedAt: new Date().toISOString() })
            );
            localStorage.setItem('__musica_seed', '1');
        } catch (_) {}
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, route => route.abort());
    await page.route('**://*.youtube*.com/embed/**', route =>
        route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: STUB_PLAYER })
    );
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
    await page.waitForTimeout(500);
    await ambGustRecent(page);
    await page.click('#ptPlayBtn');
    await page.waitForSelector('#videoPlayer iframe', { timeout: 20000 });
    await page.waitForTimeout(1200);
    for (const pas of passos) {
        await pas(page);
        await page.waitForTimeout(1200);
    }
    const final = await estat(page);
    const etiqueta = `${nom} (${width} px)`;
    comprovar(`${etiqueta}: es veu la fitxa amb la ràdio`, final.fitxa && final.radio && final.cua > 0, final);
    comprovar(`${etiqueta}: hi ha el reproductor i no els relacionats`, final.reproductor && !final.relacionats, final);
    comprovar(`${etiqueta}: sense errors de JavaScript`, errors.length === 0, errors.slice(0, 3));
    await context.close();
}

const clica = selector => page => page.evaluate(sel => document.querySelector(sel)?.click(), selector);
const enrere = page => page.goBack();
const endavant = page => page.goForward();

(async () => {
    const server = await serve();
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
    try {
        for (const width of [1280, 390]) {
            await escenari(browser, width, 'finestra flotant → enrere → endavant', [
                clica('#playerMiniBtn'),
                enrere,
                endavant,
            ]);
            await escenari(browser, width, 'enrere → endavant', [enrere, endavant]);
            await escenari(browser, width, 'següent → enrere → endavant', [clica('#playerNextBtn'), enrere, endavant]);
        }
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\nTot correcte.' : '\nHi ha errors.');
    process.exit(correcte ? 0 : 1);
})();
