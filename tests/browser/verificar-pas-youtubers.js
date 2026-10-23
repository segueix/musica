// Verificació en navegador real del pas a Segueix! dels youtubers (2026-10-23, js/features/app-switch.js):
// - mòbil (390 px): la icona de YouTuber és a dalt de tot a la dreta; lliscar el dit cap a l'esquerra o la dreta pel mig de la pantalla obre segueix.cat; un gest curt,
//   vertical, des de la vora o damunt d'una filera amb scroll lateral no fa res;
// - ordinador (1280 px): la icona de YouTuber és la de més a la dreta de la capçalera i obre segueix.cat;
// - l'avís de la mà que llisca («Segueix! YouTubers») surt les tres primeres vegades al mòbil, uns 3 s, i mai a l'ordinador.
// segueix.cat se substitueix per una pàgina local (no es surt a la xarxa).
//
// NO forma part de `npm test`: és una eina opt-in. Requisits: playwright-core i un Chromium (CHROMIUM_PATH).
// Ús:  node tests/browser/verificar-pas-youtubers.js   (amb PAS_SHOTS=carpeta desa captures del panell i de la icona)

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.MUSICA_TEST_PORT || 8163);
const SHOTS = process.env.PAS_SHOTS || '';
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
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
};

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

async function obre(browser, width, errors) {
    const mobile = width <= 768;
    const context = await browser.newContext({
        viewport: { width, height: mobile ? 844 : 800 },
        isMobile: mobile,
        hasTouch: mobile,
        serviceWorkers: 'block',
    });
    await context.addInitScript(() => {
        try {
            localStorage.setItem(
                'segueix_cookie_consent_v2',
                JSON.stringify({ version: 1, status: 'accepted', source: 'test', updatedAt: new Date().toISOString() })
            );
        } catch (_) {}
    });
    const page = await context.newPage();
    await page.route('https://segueix.cat/**', route =>
        route.fulfill({
            status: 200,
            contentType: 'text/html; charset=utf-8',
            body: '<title>YOUTUBERS</title>youtubers',
        })
    );
    await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|segueix\.cat)/, route => route.abort());
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
    await page.waitForTimeout(3500); // la pantalla d'obertura
    return { context, page };
}

// Un dit real (CDP): de (x0, y0) a (x1, y1) en uns quants passos
async function llisca(page, cdp, [x0, y0], [x1, y1], steps = 8) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let i = 1; i <= steps; i += 1) {
        const x = x0 + ((x1 - x0) * i) / steps;
        const y = y0 + ((y1 - y0) * i) / steps;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
        await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(700);
}

const aYoutubers = page => page.url().startsWith('https://segueix.cat/');

async function mobil(browser, errors) {
    let { context, page } = await obre(browser, 390, errors);
    let cdp = await context.newCDPSession(page);

    const icona = await page.evaluate(() => {
        const link = document.getElementById('appSwitchLink');
        const box = link.getBoundingClientRect();
        const others = [...document.querySelectorAll('.app-header .actions .icon-btn, .mobile-search-toggle')]
            .filter(el => el !== link && getComputedStyle(el).display !== 'none')
            .map(el => el.getBoundingClientRect().right);
        const brand = document.querySelector('.app-header .brand').getBoundingClientRect();
        return {
            visible: box.width >= 40 && box.height >= 40,
            mesALaDreta: others.every(right => right <= box.left + 1),
            marcaNoToca: Math.min(...others, box.left) >= brand.right,
            sobreix: document.documentElement.scrollWidth - innerWidth,
        };
    });
    comprovar(
        'mòbil: la icona de YouTuber és a dalt de tot a la dreta i la marca no toca les icones',
        icona.visible && icona.mesALaDreta && icona.marcaNoToca && icona.sobreix <= 0,
        icona
    );

    await llisca(page, cdp, [260, 420], [220, 420]);
    comprovar('mòbil: un gest curt no fa res', !aYoutubers(page), page.url());

    await llisca(page, cdp, [200, 600], [215, 300]);
    comprovar('mòbil: fer scroll vertical no fa res', !aYoutubers(page), page.url());

    await llisca(page, cdp, [8, 420], [300, 420]);
    comprovar('mòbil: des de la vora (enrere del sistema) no fa res', !aYoutubers(page), page.url());

    // Una filera amb scroll lateral (Acabades de sortir, Torna-hi…): el dit és per a ella
    const filera = await page.evaluate(async () => {
        const el = [...document.querySelectorAll('#homePage *')].find(node => {
            const style = getComputedStyle(node);
            return (
                ['auto', 'scroll'].includes(style.overflowX) &&
                node.scrollWidth > node.clientWidth + 2 &&
                node.getBoundingClientRect().height > 60
            );
        });
        if (!el) return null;
        el.scrollIntoView({ block: 'center' });
        el.scrollLeft = 0;
        await new Promise(resolve => setTimeout(resolve, 300));
        const box = el.getBoundingClientRect();
        return { y: Math.round(box.top + box.height / 2), classe: String(el.className) };
    });
    if (filera) {
        await llisca(page, cdp, [300, filera.y], [80, filera.y]);
        comprovar('mòbil: damunt d’una filera amb scroll lateral no canvia d’app', !aYoutubers(page), filera);
    } else {
        comprovar('mòbil: hi ha una filera amb scroll lateral per provar-ho', false, null);
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);

    // Un gest a mitges mostra el panell; en deixar-lo anar abans del llindar, torna enrere
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: 420 }] });
    for (const x of [290, 270, 250, 235]) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: 422 }] });
        await page.waitForTimeout(16);
    }
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'pas-mobil-mitges.png') });
    const mitges = await page.evaluate(() => {
        const panel = document.querySelector('.app-switch');
        return panel ? { actiu: panel.classList.contains('is-active'), transform: panel.style.transform } : null;
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(600);
    const despres = await page.evaluate(() => document.querySelector('.app-switch')?.classList.contains('is-active'));
    comprovar(
        'mòbil: a mitges el panell entra des de la dreta i, si no s’arriba al llindar, se’n torna',
        mitges?.actiu && /translateX\(\d/.test(mitges.transform) && !despres && !aYoutubers(page),
        { mitges, despres }
    );

    await llisca(page, cdp, [320, 420], [90, 430]);
    comprovar('mòbil: lliscar cap a l’esquerra pel mig obre segueix.cat', aYoutubers(page), page.url());
    await context.close();

    ({ context, page } = await obre(browser, 390, errors));
    cdp = await context.newCDPSession(page);
    await llisca(page, cdp, [70, 400], [310, 395]);
    comprovar('mòbil: lliscar cap a la dreta pel mig també obre segueix.cat', aYoutubers(page), page.url());
    await context.close();
}

// L'avís de les primeres vegades: una mà que llisca i «Segueix! YouTubers», uns 3 s, només les tres primeres obertures
async function esperaAvis(page, timeout = 9000) {
    return page
        .waitForSelector('.app-switch-hint.is-visible', { timeout })
        .then(() => true)
        .catch(() => false);
}

async function avis(browser, errors) {
    const { context, page } = await obre(browser, 390, errors);
    // obre() ja espera 3,5 s: l'avís pot haver sortit; es torna a obrir la pàgina per mesurar-lo des del principi
    await page.evaluate(() => localStorage.removeItem('catube_app_switch_hint_v1'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    const t0 = Date.now();
    const surt = await esperaAvis(page);
    const quan = Date.now() - t0;
    if (SHOTS) {
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(SHOTS, 'pas-avis.png') });
    }
    const contingut = await page.evaluate(() => {
        const hint = document.querySelector('.app-switch-hint');
        const hand = hint?.querySelector('.app-switch-hint__hand');
        return {
            text: hint?.querySelector('strong')?.textContent,
            ma: Boolean(hand),
            traçBlanc: hand ? getComputedStyle(hand).stroke : '',
            esTocable: hint ? getComputedStyle(hint).pointerEvents : '',
            animacio: hand ? getComputedStyle(hand).animationName : '',
        };
    });
    const t1 = Date.now();
    await page
        .waitForFunction(() => !document.querySelector('.app-switch-hint'), null, { timeout: 6000 })
        .catch(() => null);
    const dura = Date.now() - t1 + 500;
    comprovar(
        'avís (mòbil): a la primera obertura surt la mà blanca que llisca amb «Segueix! YouTubers» i marxa al cap d’uns 3 s',
        surt &&
            contingut.text === 'Segueix! YouTubers' &&
            contingut.ma &&
            contingut.traçBlanc === 'rgb(255, 255, 255)' &&
            contingut.esTocable === 'none' &&
            contingut.animacio === 'app-switch-hint-swipe' &&
            dura >= 2000 &&
            dura <= 4200,
        { quan, dura, ...contingut }
    );
    const vegades = [];
    for (let i = 0; i < 3; i += 1) {
        await page.reload({ waitUntil: 'domcontentloaded' });
        vegades.push(await esperaAvis(page));
        await page
            .waitForFunction(() => !document.querySelector('.app-switch-hint'), null, { timeout: 6000 })
            .catch(() => null);
    }
    const compte = await page.evaluate(() => localStorage.getItem('catube_app_switch_hint_v1'));
    comprovar(
        'avís (mòbil): només les tres primeres vegades que s’obre l’app',
        vegades.join() === 'true,true,false' && compte === '3',
        { vegades, compte }
    );
    await context.close();

    const ordinador = await obre(browser, 1280, errors);
    await ordinador.page.evaluate(() => localStorage.removeItem('catube_app_switch_hint_v1'));
    await ordinador.page.reload({ waitUntil: 'domcontentloaded' });
    const aOrdinador = await esperaAvis(ordinador.page, 7000);
    comprovar('avís: a l’ordinador no surt', !aOrdinador, aOrdinador);
    await ordinador.context.close();
}

async function escriptori(browser, errors) {
    const { context, page } = await obre(browser, 1280, errors);
    const info = await page.evaluate(() => {
        const link = document.getElementById('appSwitchLink');
        const box = link.getBoundingClientRect();
        const others = [...document.querySelectorAll('#headerActions .icon-btn')]
            .filter(el => el !== link && getComputedStyle(el).display !== 'none')
            .map(el => el.getBoundingClientRect().right);
        return {
            visible: box.width >= 40 && box.height >= 40,
            mesALaDreta: others.every(right => right <= box.left + 1),
            href: link.getAttribute('href'),
            vora: getComputedStyle(link).borderTopWidth,
        };
    });
    comprovar(
        'ordinador: la icona de YouTuber és a dalt de tot a la dreta, sense vora, i porta a segueix.cat',
        info.visible && info.mesALaDreta && info.href === 'https://segueix.cat/' && info.vora === '0px',
        info
    );
    if (SHOTS)
        await page.screenshot({
            path: path.join(SHOTS, 'pas-ordinador.png'),
            clip: { x: 0, y: 0, width: 1280, height: 70 },
        });
    await Promise.all([
        page.waitForURL('https://segueix.cat/**', { timeout: 10000 }).catch(() => null),
        page.click('#appSwitchLink'),
    ]);
    comprovar('ordinador: clicar-la obre segueix.cat', aYoutubers(page), page.url());
    await context.close();
}

async function main() {
    const server = await serve();
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] });
    const errors = [];
    try {
        await mobil(browser, errors);
        await escriptori(browser, errors);
        await avis(browser, errors);
        comprovar('cap error de JavaScript', errors.length === 0, errors.slice(0, 3));
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\n✅ Pas a Segueix! dels youtubers verificat' : '\n❌ Hi ha comprovacions fallides');
    process.exit(correcte ? 0 : 1);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
