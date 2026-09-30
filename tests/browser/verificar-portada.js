// Verificació end-to-end de la portada «La teva plaça musical» en un navegador real (Chromium).
//
// NO forma part de `npm test` (Vitest, sense navegador): és una eina opt-in, com verificar-sw.js.
// Comprova el que només es veu amb layout real: desbordaments, zones tàctils, superposicions,
// reproductor únic, teclat i estats d'error.
//
// Requisits (no són dependències del projecte):
//   npm i -D playwright-core      # client de Playwright (no baixa navegadors)
//   Un binari de Chromium; si no és a la ubicació per defecte, indica'l amb CHROMIUM_PATH=/ruta/al/chrome
//
// Ús:  node tests/browser/verificar-portada.js
//      PORTADA_SHOTS=/ruta/captures node tests/browser/verificar-portada.js   # desa captures de cada amplada
//
// Comprova a 360, 390, 768 i 1440 px, amb i sense historial:
//   1) La portada es pinta amb les seccions esperades i no hi ha desplaçament lateral de la pàgina.
//   2) Els controls tàctils fan almenys 44 × 44 px (mòbil) i la navegació inferior no se solapa amb res.
//   3) A la primera pantalla ja es veu música per explorar.
//   4) En carregar no sona res (cap iframe del reproductor).
//   I un recorregut complet (escriptori i mòbil):
//   5) «Fes-la sonar» engega la ràdio; hi ha un sol reproductor i canviar de secció no el recrea.
//   6) Canviar el mode de descoberta no interromp la cançó; «Ara sona» surt a Inici.
//   7) Teclat: fletxes al selector de mode, anell de focus visible, activar amb Enter.
//   8) Sense catàleg: missatge d'error i «Torna-ho a provar» recupera la portada.

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.PORTADA_TEST_PORT || 8142);
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.PORTADA_SHOTS || '';

let chromium;
try {
    ({ chromium } = require('playwright-core'));
} catch (_) {
    console.log('⏭️  playwright-core no instal·lat: verificació omesa.');
    console.log('    Per executar-la: npm i -D playwright-core  (i tenir un Chromium disponible).');
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
    '.webp': 'image/webp',
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

// Historial de proves amb vídeos reals del feed (cançons d'artistes Indie).
function buildHistory() {
    const feed = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feed.json'), 'utf8'));
    const songs = feed.videos.filter(
        v => v.contentType === 'song' && !v.isShort && (v.categories || []).includes('Indie')
    );
    return songs.slice(0, 8).map((video, i) => ({
        ...video,
        viewedAt: new Date(Date.now() - i * 3600e3).toISOString(),
        historySource: 'api',
    }));
}

let correcte = true;
const comprovar = (etiqueta, condicio, detall) => {
    console.log(`${condicio ? '✅' : '❌'} ${etiqueta} ${detall !== undefined ? JSON.stringify(detall) : ''}`);
    if (!condicio) correcte = false;
};

async function novaPagina(browser, { width, height, history, consent = 'accepted', reducedMotion = 'no-preference' }) {
    const mobile = width <= 768;
    const context = await browser.newContext({
        viewport: { width, height },
        isMobile: mobile,
        hasTouch: mobile,
        reducedMotion,
        serviceWorkers: 'block',
    });
    await context.addInitScript(
        ({ consent: state, items }) => {
            if (localStorage.getItem('__portada_seed')) return;
            localStorage.setItem(
                'segueix_cookie_consent_v2',
                JSON.stringify({ version: 1, status: state, source: 'test', updatedAt: new Date().toISOString() })
            );
            if (items) localStorage.setItem('catube_history', JSON.stringify(items));
            localStorage.setItem('__portada_seed', '1');
        },
        { consent, items: history ? buildHistory() : null }
    );
    const page = await context.newPage();
    // Cap contingut extern: els iframes de YouTube es buiden (la verificació no en depèn) i la resta s'avorta.
    await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, route =>
        /youtube(-nocookie)?\.com/.test(route.request().url())
            ? route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>embed</title>' })
            : route.abort()
    );
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    return { context, page, errors };
}

async function obrir(page) {
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
    await page.waitForTimeout(800);
}

async function verificarAmplada(browser, width, height, history) {
    const etiqueta = `${width}px ${history ? 'amb historial' : 'sense historial'}`;
    const { context, page, errors } = await novaPagina(browser, { width, height, history });
    await obrir(page);

    const mesures = await page.evaluate(() => {
        const visible = el => {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
        };
        const petits = [];
        document
            .querySelectorAll(
                '#portadaEntry button, #portadaEntry label, .pt-section button, #homePlaylists button, .app-header button, .app-header a.icon-btn, .pt-bottom-nav button, #sidebar a'
            )
            .forEach(el => {
                if (!visible(el)) return;
                const r = el.getBoundingClientRect();
                if (r.width < 43.5 || r.height < 43.5)
                    petits.push(`${el.className.split(' ')[0]} ${Math.round(r.width)}x${Math.round(r.height)}`);
            });
        const nav = document.getElementById('ptBottomNav');
        const navVisible = nav && getComputedStyle(nav).display !== 'none';
        const primera = document.querySelector('.pt-section');
        return {
            seccions: [...document.querySelectorAll('.pt-section')].map(s => s.dataset.ptSection),
            desbordament: document.documentElement.scrollWidth - window.innerWidth,
            petits: [...new Set(petits)],
            navVisible: Boolean(navVisible),
            navTop: navVisible ? nav.getBoundingClientRect().top : null,
            alturaPantalla: window.innerHeight,
            primeraSeccioTop: primera ? primera.getBoundingClientRect().top : null,
            iframes: document.querySelectorAll('#videoPlayer iframe').length,
        };
    });

    comprovar(
        `${etiqueta}: seccions`,
        mesures.seccions.includes('fresh') && mesures.seccions.includes('styles'),
        mesures.seccions
    );
    comprovar(
        `${etiqueta}: «${history ? 'Torna-hi' : 'Comença per aquí'}» a la seva posició`,
        mesures.seccions[0] === 'lead'
    );
    comprovar(`${etiqueta}: sense desplaçament lateral de la pàgina`, mesures.desbordament <= 0, mesures.desbordament);
    comprovar(`${etiqueta}: controls tàctils ≥ 44 × 44 px`, mesures.petits.length === 0, mesures.petits);
    comprovar(
        `${etiqueta}: a la primera pantalla ja es veu música`,
        mesures.primeraSeccioTop !== null && mesures.primeraSeccioTop < (mesures.navTop || mesures.alturaPantalla),
        { top: Math.round(mesures.primeraSeccioTop), nav: mesures.navTop && Math.round(mesures.navTop) }
    );
    comprovar(
        `${etiqueta}: navegació ${width <= 768 ? 'inferior visible' : 'inferior amagada'}`,
        mesures.navVisible === width <= 768
    );
    comprovar(`${etiqueta}: no sona res en carregar`, mesures.iframes === 0, mesures.iframes);
    comprovar(`${etiqueta}: sense errors de JavaScript`, errors.length === 0, errors);

    if (SHOTS) {
        fs.mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: path.join(SHOTS, `portada-${width}-${history ? 'historial' : 'nou'}.png`) });
    }
    await context.close();
}

async function recorregut(browser, width, height) {
    const mobile = width <= 768;
    const nom = mobile ? 'mòbil' : 'escriptori';
    const { context, page, errors } = await novaPagina(browser, { width, height, history: true });
    await obrir(page);
    const nav = clau => page.click(`${mobile ? '.pt-bottom-nav' : '#sidebar'} [data-pt-nav="${clau}"]`);

    // 5) «Fes-la sonar»: una ràdio, un sol reproductor
    comprovar(
        `${nom}: «Fes-la sonar» està actiu`,
        await page.evaluate(() => !document.getElementById('ptPlayBtn').disabled)
    );
    await page.click('#ptPlayBtn');
    await page.waitForFunction(() => document.querySelectorAll('#videoPlayer iframe').length === 1, null, {
        timeout: 15000,
    });
    const cua = await page.evaluate(() => {
        const q = SegueixApp.features.musicQueue.getState();
        return { radio: q.isRadio, longitud: activePlaylistQueue.length, id: q.current && q.current.id };
    });
    comprovar(`${nom}: engega una ràdio amb cua`, cua.radio && cua.longitud >= 2, cua);

    // 6) Canviar de secció amb la finestreta: el mateix reproductor
    await page.evaluate(() => document.getElementById('miniPlayerToggle')?.click());
    await page.waitForTimeout(400);
    await page.evaluate(() => {
        const frame = document.querySelector('#videoPlayer iframe');
        window.__frame = frame;
        window.__src = frame.src;
        document.getElementById('videoPlayer').dataset.playerState = '1';
    });
    for (const clau of ['home', 'discover', 'library', 'home']) {
        await nav(clau);
        await page.waitForTimeout(900);
        const estat = await page.evaluate(() => {
            const frame = document.querySelector('#videoPlayer iframe');
            return {
                mateix: frame === window.__frame && frame.src === window.__src,
                reproductors: document.querySelectorAll('#videoPlayer iframe').length,
                shorts: Boolean(document.getElementById('short-iframe')?.getAttribute('src')),
            };
        });
        comprovar(
            `${nom}: en anar a «${clau}» el reproductor no es recrea ni es duplica`,
            estat.mateix && estat.reproductors === 1 && !estat.shorts,
            estat
        );
    }
    comprovar(
        `${nom}: «Ara sona» surt a Inici`,
        await page.evaluate(() => Boolean(document.querySelector('.pt-feature--now')))
    );

    // Canviar el mode: no interromp la cançó
    await page.click('label:has(input[value="surprise"])');
    const igual = await page.evaluate(
        id =>
            SegueixApp.features.musicQueue.getState().current.id === id &&
            localStorage.getItem('catube_discovery_mode') === 'surprise',
        cua.id
    );
    comprovar(`${nom}: canviar el mode desa la preferència sense interrompre la cançó`, igual);

    // La cua respecta les afegides a mà
    await page.click('.pt-section--fresh .pt-cell:nth-child(2) [data-pt-queue]');
    comprovar(
        `${nom}: «Afegeix a la cua» posa la cançó després de la que sona`,
        await page.evaluate(
            () =>
                activePlaylistQueue[1].id ===
                document.querySelectorAll('.pt-section--fresh .pt-cell')[1].querySelector('[data-pt-queue]').dataset
                    .ptQueue
        )
    );

    // Reproducció contínua: en acabar la cançó, la següent
    await page.evaluate(() => {
        const frame = document.querySelector('#videoPlayer iframe');
        window.dispatchEvent(
            new MessageEvent('message', {
                data: JSON.stringify({ event: 'onStateChange', info: 0 }),
                origin: 'https://www.youtube.com',
                source: frame && frame.contentWindow,
            })
        );
    });
    await page.waitForTimeout(1200);
    comprovar(
        `${nom}: en acabar la cançó, la ràdio continua amb la següent`,
        await page.evaluate(
            () =>
                currentPlaylistIndex === 1 &&
                document.getElementById('videoPlayer').dataset.playingVideoId === activePlaylistQueue[1].id
        )
    );
    comprovar(`${nom}: sense errors de JavaScript`, errors.length === 0, errors);
    await context.close();
}

async function teclat(browser) {
    const { context, page } = await novaPagina(browser, {
        width: 1440,
        height: 900,
        history: false,
        consent: 'rejected',
    });
    await obrir(page);
    await page.focus('input[value="mix"]');
    await page.keyboard.press('ArrowRight');
    comprovar(
        'teclat: les fletxes canvien el mode de descoberta',
        await page.evaluate(() => localStorage.getItem('catube_discovery_mode') === 'surprise')
    );
    await page.focus('#ptPlayBtn');
    const focus = await page.evaluate(() => {
        const s = getComputedStyle(document.activeElement);
        return { estil: s.outlineStyle, gruix: s.outlineWidth };
    });
    comprovar(
        'teclat: anell de focus visible als botons',
        focus.estil !== 'none' && parseFloat(focus.gruix) >= 2,
        focus
    );
    await page.focus('[data-pt-more="fresh"]');
    await page.keyboard.press('Enter');
    comprovar(
        'teclat: «Veure-ho tot» s’activa amb Enter i manté el focus',
        await page.evaluate(
            () =>
                document.activeElement.dataset.ptMore === 'fresh' &&
                document.querySelector('.pt-section--fresh').classList.contains('is-expanded')
        )
    );
    await context.close();

    // Moviment reduït: cap animació contínua
    const reduit = await novaPagina(browser, {
        width: 390,
        height: 844,
        history: false,
        consent: 'rejected',
        reducedMotion: 'reduce',
    });
    await obrir(reduit.page);
    const anim = await reduit.page.evaluate(
        () => getComputedStyle(document.querySelector('.pt-card__play')).transitionDuration
    );
    comprovar('moviment reduït: sense transicions a les targetes', parseFloat(anim) === 0, anim);
    await reduit.context.close();
}

async function estatError(browser) {
    const { context, page } = await novaPagina(browser, {
        width: 390,
        height: 844,
        history: false,
        consent: 'rejected',
    });
    let bloquejat = true;
    await page.route('**/data/feed.json', route =>
        bloquejat ? route.fulfill({ status: 500, body: 'error' }) : route.continue()
    );
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pt-state', { timeout: 30000 });
    comprovar(
        'error: missatge en català amb «Torna-ho a provar»',
        await page.evaluate(() => /Torna-ho a provar/.test(document.querySelector('.pt-state').innerText))
    );
    comprovar(
        'error: «Fes-la sonar» no s’activa sense música',
        await page.evaluate(() => document.getElementById('ptPlayBtn').disabled)
    );
    bloquejat = false;
    await page.click('[data-pt-retry]');
    await page.waitForSelector('.pt-section', { timeout: 30000 });
    comprovar(
        'error: «Torna-ho a provar» recupera la portada',
        await page.evaluate(() => !document.getElementById('ptPlayBtn').disabled)
    );
    await context.close();
}

(async () => {
    const server = await serve();
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
    try {
        for (const [width, height] of [
            [360, 740],
            [390, 844],
            [768, 1024],
            [1440, 900],
        ]) {
            for (const history of [false, true]) await verificarAmplada(browser, width, height, history);
        }
        await recorregut(browser, 1440, 900);
        await recorregut(browser, 390, 844);
        await teclat(browser);
        await estatError(browser);
    } catch (error) {
        console.log(`❌ La verificació ha fallat: ${error.message}`);
        correcte = false;
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\n✅ Portada correcta' : '\n❌ Hi ha comprovacions que fallen');
    process.exit(correcte ? 0 : 1);
})();
