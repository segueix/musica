// Verificació en un navegador real de l'enllaç curt d'un estil (2026-10-24).
//
// NO forma part de `npm test`: és una eina opt-in, com verificar-vista-estil.js.
// Requisits (no són dependències del projecte):
//   npm i --no-save playwright-core
//   Un binari de Chromium (CHROMIUM_PATH=/ruta/al/chrome si no és a la ubicació per defecte)
//
// Ús:  node tests/browser/verificar-compartir-estil.js
//
// Comprova:
//   1) A la vista de Pop, al costat de «Ràdio», hi ha «Comparteix»: envia «Escolta Pop a Segueix!» i l'enllaç curt
//      https://musica.segueix.cat/compartir/estil/pop.html (sense cap cançó). Sense Web Share, el copia.
//   2) Obrir l'app amb ?escolta=Pop (on porta la pàgina de l'estil) engega la ràdio de Pop amb «Els meus de sempre»,
//      treu el paràmetre de l'adreça i no canvia el mode desat de qui l'obre.

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
const PORT = Number(process.env.COMPARTIR_ESTIL_PORT || 8157);
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

async function open(browser, { width, height, query = '', share = true }) {
    const mobile = width <= 768;
    const ctx = await browser.newContext({
        viewport: { width, height },
        isMobile: mobile,
        hasTouch: mobile,
        serviceWorkers: 'block',
    });
    await ctx.addInitScript(withShare => {
        localStorage.setItem(
            'segueix_cookie_consent_v2',
            JSON.stringify({ version: 1, status: 'accepted', source: 'test', updatedAt: new Date().toISOString() })
        );
        if (!sessionStorage.getItem('mode-set')) {
            localStorage.setItem('catube_discovery_mode', 'surprise');
            sessionStorage.setItem('mode-set', '1');
        }
        window.__shared = [];
        window.__copied = [];
        Object.defineProperty(navigator, 'share', {
            configurable: true,
            value: withShare ? data => (window.__shared.push(data), Promise.resolve()) : undefined,
        });
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: text => (window.__copied.push(text), Promise.resolve()) },
        });
    }, share);
    const page = await ctx.newPage();
    await page.route(/^https?:\/\/(?!localhost)/, route => route.abort());
    const errors = [];
    // L'iframe de YouTube (bloquejat a la prova) no pot llegir localStorage: no és un error de l'app
    page.on('pageerror', error => !/localStorage.*Access is denied/.test(error.message) && errors.push(error.message));
    await page.goto(`http://localhost:${PORT}/${query}`);
    await page.waitForSelector('.chips-bar .chip[data-cat]', { timeout: 30000, state: 'attached' });
    await page.evaluate(() => document.getElementById('intro-splash')?.remove());
    return { ctx, page, errors };
}

async function shareButton(browser, width, height, label, share) {
    const { ctx, page, errors } = await open(browser, { width, height, share });
    await page.waitForTimeout(600);
    await page.evaluate(() => window.SegueixApp.features.shellNav.openStyle('Pop'));
    await page.waitForSelector('#pageTitle [data-style-share]', { timeout: 20000 });
    const place = await page.evaluate(() => {
        const radio = document.querySelector('#pageTitle [data-style-radio]').getBoundingClientRect();
        const button = document.querySelector('#pageTitle [data-style-share]').getBoundingClientRect();
        return {
            sameRow: Math.abs(radio.top + radio.height / 2 - (button.top + button.height / 2)) < 4,
            right: button.left >= radio.right,
            size: [Math.round(button.width), Math.round(button.height)],
        };
    });
    ok(`${label}: «Comparteix» al costat de «Ràdio»`, place.sameRow && place.right && place.size[0] >= 44, place);
    await page.click('#pageTitle [data-style-share]');
    await page.waitForTimeout(300);
    const sent = await page.evaluate(() => ({
        shared: window.__shared,
        copied: window.__copied,
        toast: document.getElementById('ptToast')?.textContent || '',
    }));
    if (share) {
        ok(
            `${label}: comparteix «Escolta Pop a Segueix!» amb l'enllaç curt`,
            sent.shared.length === 1 &&
                sent.shared[0].text === 'Escolta Pop a Segueix!' &&
                sent.shared[0].url === 'https://musica.segueix.cat/compartir/estil/pop.html',
            sent.shared
        );
    } else {
        ok(
            `${label}: sense Web Share, copia el text i l'enllaç`,
            sent.copied[0] === 'Escolta Pop a Segueix! https://musica.segueix.cat/compartir/estil/pop.html' &&
                /copiat/.test(sent.toast),
            sent
        );
    }
    ok(`${label}: sense errors`, errors.length === 0, errors);
    await ctx.close();
}

async function openLink(browser, width, height, label) {
    const { ctx, page, errors } = await open(browser, { width, height, query: '?escolta=pop' });
    await page
        .waitForFunction(() => /Ràdio Pop/.test(window.SegueixApp.features.musicQueue?.playlistName?.() || ''), null, {
            timeout: 20000,
        })
        .catch(() => {});
    await page.waitForTimeout(600);
    const state = await page.evaluate(() => ({
        name: window.SegueixApp.features.musicQueue?.playlistName?.() || '',
        watch: !document.getElementById('watchPage').classList.contains('hidden'),
        mode: document.querySelector('.mq [data-mq-mode][aria-checked="true"]')?.dataset.mqMode || '',
        saved: localStorage.getItem('catube_discovery_mode'),
        search: location.search,
    }));
    ok(`${label}: l'enllaç engega la ràdio de Pop`, /Ràdio Pop/.test(state.name) && state.watch, state);
    ok(`${label}: amb «Els meus de sempre»`, state.mode === 'home', state.mode);
    ok(`${label}: no canvia el mode desat de qui l'obre`, state.saved === 'surprise', state.saved);
    ok(`${label}: treu ?escolta de l'adreça`, !/escolta/.test(state.search), state.search);
    ok(`${label}: sense errors`, errors.length === 0, errors);
    await ctx.close();
}

server.listen(PORT, async () => {
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
    try {
        await shareButton(browser, 390, 844, 'mòbil', true);
        await shareButton(browser, 1280, 900, 'ordinador', false);
        await openLink(browser, 390, 844, 'mòbil');
        await openLink(browser, 1280, 900, 'ordinador');
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\nTot correcte.' : '\nHi ha errors.');
    process.exit(correcte ? 0 : 1);
});
