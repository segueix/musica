// Verificació en navegador real (mòbil, 390 px): play, anterior i següent no es queden bloquejats (2026-10-18).
// El succedani de l'embed es comporta com YouTube: no envia res fins que rep «listening», amb autoplay=0 es queda
// aturat fins que es toca el vídeo, i pot «arribar tard» (ignora les salutacions dels primers mil·lisegons), com un
// mòbil lent. Abans, si les dues salutacions es perdien, els botons quedaven desactivats per sempre i la ràdio no
// avançava en acabar la cançó.
//
// NO forma part de `npm test`: és una eina opt-in. Requisits: playwright-core i un Chromium (CHROMIUM_PATH).
// Ús:  node tests/browser/verificar-botons-mobil.js
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
const PORT = Number(process.env.MUSICA_TEST_PORT || 8163);
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

const estat = page =>
    page.evaluate(() => {
        const vp = document.getElementById('videoPlayer');
        const btn = id => {
            const b = document.getElementById(id);
            if (!b) return null;
            const r = b.getBoundingClientRect();
            const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return {
                disabled: b.disabled,
                hidden: b.closest('[hidden]') !== null,
                tapa: top && !b.contains(top) && top !== b ? top.id || top.className || top.tagName : null,
            };
        };
        return {
            id: vp?.dataset.playingVideoId,
            estat: vp?.dataset.playerState,
            esperant: vp?.dataset.awaitingNativePlay,
            index: currentPlaylistIndex,
            prev: btn('playerPrevBtn'),
            toggle: btn('playerPlayPauseBtn'),
            next: btn('playerNextBtn'),
            loading: document.getElementById('loading')?.classList.contains('active'),
        };
    });

let correcte = true;
const comprovar = (etiqueta, condicio, detall) => {
    console.log(`${condicio ? '✅' : '❌'} ${etiqueta} ${detall !== undefined ? JSON.stringify(detall) : ''}`);
    if (!condicio) correcte = false;
};

async function obrir(browser, lateMs, errors) {
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
        r.fulfill({ status: 200, contentType: 'text/html', body: stub(lateMs) })
    );
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
    await ambGustRecent(page);
    await page.click('#ptPlayBtn');
    await page.waitForSelector('#videoPlayer iframe', { timeout: 20000 });
    await page.waitForTimeout(2500);
    return { context, page };
}

const tocar = async (page, selector) => {
    const box = await page.locator(selector).boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
};
const acabar = page =>
    page.evaluate(() =>
        document.querySelector('#videoPlayer iframe').contentWindow.postMessage(JSON.stringify({ event: '__end' }), '*')
    );

async function main() {
    const server = await serve();
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] });
    const errors = [];
    try {
        for (const [lateMs, nom] of [
            [0, 'YouTube respon de seguida'],
            [1500, 'YouTube no escoltava les primeres salutacions (mòbil lent)'],
        ]) {
            const { context, page } = await obrir(browser, lateMs, errors);
            const abans = await estat(page);
            comprovar(
                `${nom}: abans del primer ▶, «següent» ja es pot tocar i el play no és desactivat`,
                abans.esperant === 'true' &&
                    abans.next &&
                    !abans.next.disabled &&
                    abans.toggle &&
                    !abans.toggle.disabled,
                abans
            );
            await tocar(page, '#videoPlayer iframe');
            await page.waitForTimeout(800);
            const sona = await estat(page);
            comprovar(
                `${nom}: després de tocar ▶ dins del vídeo, l'app sap que sona`,
                sona.estat === '1' && sona.esperant === 'false',
                sona
            );
            await tocar(page, '#playerNextBtn');
            await page.waitForTimeout(3000);
            const seguent = await estat(page);
            comprovar(
                `${nom}: «següent» passa a la cançó següent`,
                seguent.index === sona.index + 1 && seguent.id !== sona.id,
                seguent
            );
            await acabar(page);
            await page.waitForTimeout(1500);
            const final = await estat(page);
            comprovar(`${nom}: en acabar la cançó, la ràdio avança sola`, final.index === seguent.index + 1, final);
            await context.close();
        }

        // «Següent» abans de fer sonar res: la cançó nova també queda preparada (aturada)
        {
            const { context, page } = await obrir(browser, 0, errors);
            const abans = await estat(page);
            await tocar(page, '#playerNextBtn');
            await page.waitForTimeout(2500);
            const despres = await estat(page);
            comprovar(
                '«següent» abans del primer ▶ salta la cançó i la nova queda preparada',
                despres.index === abans.index + 1 && despres.esperant === 'true',
                despres
            );
            await tocar(page, '#playerPlayPauseBtn');
            await page.waitForTimeout(400);
            const avis = await page.evaluate(() => document.querySelector('.pt-toast.is-visible')?.textContent || '');
            comprovar('el play abans del primer ▶ respon amb un avís', /Prem ▶ dins del vídeo/.test(avis), avis);
            await context.close();
        }

        // YouTube no respon mai: al cap de 15 s els controls deixen d'esperar
        {
            const { context, page } = await obrir(browser, 10 ** 9, errors);
            await page.waitForTimeout(14000);
            const fi = await estat(page);
            comprovar(
                'si YouTube no respon mai, al cap de 15 s els controls tornen a funcionar',
                fi.esperant === 'false',
                fi
            );
            await context.close();
        }

        comprovar('sense errors de JavaScript', errors.length === 0, errors.slice(0, 3));
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\n✅ Botons del reproductor al mòbil verificats' : '\n❌ Hi ha comprovacions fallides');
    process.exit(correcte ? 0 : 1);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
