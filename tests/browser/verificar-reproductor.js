// Verificació end-to-end del reproductor al mòbil en un navegador real (Chromium).
//
// NO forma part de `npm test` (que és Vitest, sense navegador). És una eina opt-in,
// com verificar-sw.js: el bug que cobreix només es veu amb layout real, perquè depèn
// de la transició CSS que col·lapsa la filera d'icones del header en obrir un vídeo.
//
// Requisits (no són dependències del projecte):
//   npm i -D playwright-core      # client de Playwright (no baixa navegadors)
//   Un binari de Chromium accessible; si no és a la ubicació per defecte de Playwright,
//   indica'l amb CHROMIUM_PATH=/ruta/al/chrome
//
// Ús:  node tests/browser/verificar-reproductor.js
//
// Comprova, amb viewport i user-agent d'Android:
//   1) En obrir un vídeo des del llistat, el reproductor queda alineat amb el seu forat
//      (#videoPlaceholder) i no tapa el títol.
//   2) En fer scroll cap avall es transforma en la finestreta flotant (comportament
//      volgut) i la filera d'icones del header queda amagada.
//   3) En fer scroll cap amunt, la filera d'icones torna a aparèixer.
//   4) En obrir un altre vídeo amb la finestreta flotant activa, el reproductor torna
//      al seu lloc en comptes de quedar-se flotant.

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.PLAYER_TEST_PORT || 8141);
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

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

// Mesura la relació entre el reproductor, el seu forat i el títol del vídeo.
function llegirEstat(page) {
    return page.evaluate(() => {
        const player = document.getElementById('videoPlayer');
        const holder = document.getElementById('videoPlaceholder');
        const title = document.getElementById('videoTitle');
        if (!player || !holder) return null;
        const p = player.getBoundingClientRect();
        const h = holder.getBoundingClientRect();
        const t = title ? title.getBoundingClientRect() : null;
        const visible = getComputedStyle(player).display !== 'none' && p.width > 0;
        return {
            visible,
            flotant: player.classList.contains('mini-player-active'),
            // Píxels que el reproductor està desplaçat respecte del seu forat.
            desfase: visible ? Math.round(p.top - h.top) : null,
            // Positiu = el reproductor trepitja el títol.
            solapaTitol: visible && t ? Math.round(Math.min(p.bottom, t.bottom) - Math.max(p.top, t.top)) : null,
            iconesAmagades: document.querySelector('.app-header')?.classList.contains('nav-hidden') ?? null,
        };
    });
}

async function reproduir(page) {
    for (let intent = 0; intent < 6; intent += 1) {
        await page.evaluate(() => document.querySelector('.play-overlay')?.click());
        await page.waitForTimeout(500);
        const estat = await llegirEstat(page);
        if (estat?.visible) return true;
    }
    return false;
}

(async () => {
    const server = await serve();
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
    const context = await browser.newContext({
        viewport: { width: 412, height: 915 },
        deviceScaleFactor: 2.6,
        isMobile: true,
        hasTouch: true,
        userAgent:
            'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/536.36',
    });
    // Consentiment acceptat: el reproductor es carrega sense passar pel modal.
    await context.addInitScript(() => {
        localStorage.setItem(
            'segueix_cookie_consent_v2',
            JSON.stringify({ version: 1, status: 'accepted', source: 'test', updatedAt: new Date().toISOString() })
        );
    });

    const page = await context.newPage();
    // Els iframes i les miniatures de YouTube no es poden carregar aquí.
    await page.route('**://*.youtube*.com/**', route => route.abort());
    await page.route('**://*.ytimg.com/**', route => route.abort());

    const errors = [];
    let correcte = true;
    const comprovar = (etiqueta, condicio, detall) => {
        console.log(`${condicio ? '✅' : '❌'} ${etiqueta} ${detall ? JSON.stringify(detall) : ''}`);
        if (!condicio) correcte = false;
    };

    try {
        await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#videosGrid .video-card', { timeout: 30000 });
        await page.waitForTimeout(1200);

        // 1) Obrir un vídeo des del llistat i reproduir-lo.
        await page.evaluate(() => document.querySelector('#videosGrid .video-card')?.click());
        await page.waitForFunction(() => !document.getElementById('watchPage')?.classList.contains('hidden'), {
            timeout: 20000,
        });
        await page.waitForTimeout(800);
        await reproduir(page);
        await page.waitForTimeout(1200);

        const obert = await llegirEstat(page);
        comprovar(
            "El reproductor queda al seu lloc en obrir el vídeo (no tapa el títol)",
            Boolean(obert?.visible) && !obert.flotant && Math.abs(obert.desfase) <= 2 && obert.solapaTitol <= 0,
            obert
        );
        comprovar("La filera d'icones del header queda amagada", obert?.iconesAmagades === true);

        // 2) Scroll cap avall: la finestreta flotant és el comportament volgut.
        await page.evaluate(() => window.scrollTo(0, 1400));
        await page.waitForTimeout(900);
        const avall = await llegirEstat(page);
        comprovar('Amb scroll avall es transforma en finestreta flotant', avall?.flotant === true, avall);

        // 3) Scroll cap amunt: tornen les icones del header.
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(1200);
        const amunt = await llegirEstat(page);
        comprovar("Amb scroll amunt tornen les icones del header", amunt?.iconesAmagades === false, {
            iconesAmagades: amunt?.iconesAmagades,
        });

        // 4) Amb la finestreta flotant activa, obrir un altre vídeo del llistat.
        await page.evaluate(() => window.scrollTo(0, 1400));
        await page.waitForTimeout(900);
        await page.evaluate(() => document.querySelector('.nav-item')?.click());
        await page.waitForTimeout(1200);
        await page.evaluate(() => document.querySelectorAll('#videosGrid .video-card')[2]?.click());
        await page.waitForTimeout(2000);

        const seguent = await llegirEstat(page);
        comprovar(
            "En obrir un altre vídeo el reproductor torna al seu lloc",
            Boolean(seguent?.visible) && !seguent.flotant && Math.abs(seguent.desfase) <= 2 && seguent.solapaTitol <= 0,
            seguent
        );
    } catch (error) {
        console.log('❌ La verificació ha fallat:', error.message);
        correcte = false;
    }

    if (errors.length) console.log('   errors JS:', errors.slice(0, 3));
    console.log(correcte ? '\n✅ Reproductor correcte' : '\n❌ Hi ha comprovacions que fallen');

    await browser.close();
    server.close();
    process.exit(correcte ? 0 : 1);
})();
