// Verificació en navegador real (mòbil, 390 px): si sona una ràdio i vas a Inici (o a una altra secció), la música
// continua a la finestra flotant ancorada a baix, amb els controls a sota, en lloc d'aturar-se (2026-10-22). Si la
// cançó és en pausa, s'atura com abans. Fa servir el succedani de l'embed de verificar-botons-mobil.js.
//
// NO forma part de `npm test`: és una eina opt-in. Requisits: playwright-core i un Chromium (CHROMIUM_PATH).
// Ús:  node tests/browser/verificar-mobil-segueix-sonant.js
//      MOBIL_SHOTS=/ruta/captures node tests/browser/verificar-mobil-segueix-sonant.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { ambGustRecent } = require('./gust-recent');
let chromium;
try {
    ({ chromium } = require('playwright-core'));
} catch (_) {
    console.log('⏭️  playwright-core no instal·lat: verificació omesa.');
    process.exit(0);
}
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.MUSICA_TEST_PORT || 8169);
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
};

const stub = lateMs => `<!doctype html><html><body style="margin:0;background:#123;color:#fff;height:100%">stub<script>
const born = Date.now();
const auto = /[?&]autoplay=1/.test(location.search);
let connected = false, state = auto ? 1 : 5;
function out(obj) { if (connected) parent.postMessage(JSON.stringify(obj), '*'); }
function set(s) { state = s; out({ event: 'onStateChange', info: s }); out({ event: 'infoDelivery', info: { playerState: s, currentTime: 1 } }); }
document.addEventListener('pointerdown', () => { parent.postMessage(JSON.stringify({ event: '__tap' }), '*'); set(1); });
window.addEventListener('message', e => {
  let d = e.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (_) { return; } }
  if (!d) return;
  if (d.event === 'listening') {
    if (Date.now() - born < ${lateMs}) { parent.postMessage(JSON.stringify({ event: '__lost' }), '*'); return; }
    if (!connected) { connected = true; out({ event: 'initialDelivery', info: { playerState: state } }); out({ event: 'onReady' }); }
    return;
  }
  if (d.event === '__end') { set(0); return; }
  if (d.event === '__time') { out({ event: 'infoDelivery', info: { currentTime: d.t, duration: d.d, playerState: state } }); return; }
  if (d.event !== 'command') return;
  if (d.func === 'pauseVideo') set(2);
  if (d.func === 'playVideo' && auto) set(1);
  if (d.func === 'playVideo' && !auto && state !== 5 && state !== -1) set(1);
  if (d.func === 'loadVideoById') { set(3); setTimeout(() => set(1), 150); }
});
</script></body></html>`;

function serve() {
    return new Promise(r => {
        const s = http.createServer((req, res) => {
            const u = decodeURIComponent(req.url.split('?')[0]);
            const f = path.join(ROOT, u === '/' ? '/index.html' : u);
            if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
                res.writeHead(404);
                return res.end();
            }
            res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
            fs.createReadStream(f).pipe(res);
        });
        s.listen(PORT, () => r(s));
    });
}

const OUT = process.env.MOBIL_SHOTS || '';

let correcte = true;
const comprovar = (etiqueta, condicio, detall) => {
    console.log(`${condicio ? '✅' : '❌'} ${etiqueta} ${detall !== undefined ? JSON.stringify(detall) : ''}`);
    if (!condicio) correcte = false;
};

const estat = page =>
    page.evaluate(() => {
        const vp = document.getElementById('videoPlayer');
        const iframe = vp?.querySelector('iframe');
        const box = el => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) };
        };
        const controls = document.getElementById('playerExternalControls');
        const nav = document.getElementById('ptBottomNav');
        const next = document.getElementById('playerNextBtn');
        const nr = next?.getBoundingClientRect();
        const atNext = nr && document.elementFromPoint(nr.left + nr.width / 2, nr.top + nr.height / 2);
        return {
            id: vp?.dataset.playingVideoId,
            estat: vp?.dataset.playerState,
            mini: vp?.classList.contains('mini-player-active'),
            iframe: Boolean(iframe),
            marca: iframe?.dataset.provaMarca || null,
            visible: vp ? getComputedStyle(vp).display !== 'none' && vp.getBoundingClientRect().height > 0 : false,
            player: box(vp),
            controls: box(controls),
            docked: Boolean(controls?.classList.contains('is-docked')),
            nav: box(nav),
            nextLliure: Boolean(atNext && next.contains(atNext)),
            inici: !document.getElementById('homePage')?.classList.contains('hidden'),
            fitxa: !document.getElementById('watchPage')?.classList.contains('hidden'),
            llista: typeof isPlaylistMode !== 'undefined' && isPlaylistMode,
            index: typeof currentPlaylistIndex !== 'undefined' ? currentPlaylistIndex : null,
            cua: typeof activePlaylistQueue !== 'undefined' ? activePlaylistQueue.length : 0,
        };
    });

const tocar = async (page, selector) => {
    const box = await page.locator(selector).first().boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
};

async function obrir(browser, errors) {
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
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
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, r => r.abort());
    await page.route('**://*.youtube*.com/embed/**', r =>
        r.fulfill({ status: 200, contentType: 'text/html', body: stub(0) })
    );
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
    await ambGustRecent(page);
    await page.click('#ptPlayBtn');
    await page.waitForSelector('#videoPlayer iframe', { timeout: 20000 });
    await page.waitForTimeout(2500);
    await tocar(page, '#videoPlayer iframe');
    await page.waitForTimeout(800);
    // Marca l'iframe: si després de navegar és el mateix element, el vídeo no s'ha recarregat
    await page.evaluate(() => {
        document.querySelector('#videoPlayer iframe').dataset.provaMarca = 'original';
    });
    return { context, page };
}

async function main() {
    const server = await serve();
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] });
    if (OUT) fs.mkdirSync(OUT, { recursive: true });
    const errors = [];
    try {
        // 1. Sona una ràdio i es toca «Inici»: continua a la finestra flotant
        {
            const { context, page } = await obrir(browser, errors);
            const abans = await estat(page);
            comprovar(
                'la ràdio sona a la fitxa de la cançó',
                abans.estat === '1' && abans.fitxa && abans.llista,
                abans
            );
            await tocar(page, '#ptBottomNav [data-pt-nav="home"]');
            await page.waitForTimeout(1200);
            const inici = await estat(page);
            comprovar(
                'a Inici la música continua: mateix vídeo, sense recarregar, sonant',
                inici.inici &&
                    !inici.fitxa &&
                    inici.id === abans.id &&
                    inici.marca === 'original' &&
                    inici.estat === '1',
                inici
            );
            comprovar('el reproductor és a la finestra flotant i es veu', inici.mini && inici.visible, inici);
            comprovar(
                'la ràdio es conserva (mateixa cua i posició)',
                inici.llista && inici.cua === abans.cua && inici.index === abans.index,
                inici
            );
            comprovar(
                'els controls van enganxats sota la finestra, per damunt de la navegació inferior',
                inici.docked &&
                    inici.controls.top >= inici.player.bottom - 2 &&
                    inici.controls.bottom <= inici.nav.top + 2 &&
                    inici.nextLliure,
                inici
            );
            if (OUT) await page.screenshot({ path: path.join(OUT, 'mobil-inici-sonant.png') });

            // Una altra secció: continua igual
            await tocar(page, '#ptBottomNav [data-pt-nav="library"]');
            await page.waitForTimeout(1000);
            const musica = await estat(page);
            comprovar(
                'a «La teva música» també continua',
                musica.mini && musica.marca === 'original' && musica.estat === '1' && musica.llista,
                musica
            );

            // «Següent» des de la barra flotant: avança dins la ràdio
            await tocar(page, '#playerNextBtn');
            await page.waitForTimeout(2500);
            const seguent = await estat(page);
            comprovar(
                '«següent» a la barra flotant passa a la cançó següent de la ràdio',
                seguent.index === abans.index + 1 && seguent.id !== abans.id && seguent.mini,
                seguent
            );

            // Restaurar: torna a la fitxa de la cançó amb la ràdio
            await tocar(page, '#playerMiniBtn');
            await page.waitForTimeout(1000);
            const restaurat = await estat(page);
            comprovar(
                'restaurar torna a la fitxa de la cançó amb la ràdio',
                restaurat.fitxa && !restaurat.mini && restaurat.llista && restaurat.id === seguent.id,
                restaurat
            );
            await context.close();
        }

        // 2. En pausa: en anar a Inici s'atura com abans (no queda una finestreta aturada)
        {
            const { context, page } = await obrir(browser, errors);
            await tocar(page, '#playerPlayPauseBtn');
            await page.waitForTimeout(800);
            const pausa = await estat(page);
            await tocar(page, '#ptBottomNav [data-pt-nav="home"]');
            await page.waitForTimeout(1200);
            const inici = await estat(page);
            comprovar(
                'en pausa, a Inici no queda cap finestra flotant',
                pausa.estat === '2' && inici.inici && !inici.mini && !inici.iframe,
                { pausa: pausa.estat, inici }
            );
            await context.close();
        }
        comprovar('sense errors de JS', errors.length === 0, errors);
    } finally {
        await browser.close();
        server.close();
    }
    process.exit(correcte ? 0 : 1);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
