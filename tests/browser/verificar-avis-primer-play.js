// Verificació en navegador real de l'avís «Prem ▶ al reproductor per començar» (2026-10-21): en obrir el reproductor i
// mentre s'espera el primer ▶ dins del vídeo, s'obre a sobre del títol amb una animació (el títol baixa una mica i el text
// hi apareix a sobre); quan es toca el vídeo i comença a sonar, es torna a plegar. A l'ordinador i al mòbil.
//
// NO forma part de `npm test`: és una eina opt-in. Requisits: playwright-core i un Chromium (CHROMIUM_PATH).
// Ús:  node tests/browser/verificar-avis-primer-play.js     (AVIS_SHOTS=/ruta per desar captures de l'animació)
// El succedani de YouTube és el de verificar-botons-mobil.js: només respon després de «listening», no sona sol i
// comença a sonar quan es toca.

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.MUSICA_TEST_PORT || 8162);
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.AVIS_SHOTS || '';

let chromium;
try {
    ({ chromium } = require('playwright-core'));
} catch (_) {
    console.log('⏭️  playwright-core no instal·lat: verificació omesa.');
    process.exit(0);
}

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

let correcte = true;
const comprovar = (etiqueta, condicio, detall) => {
    console.log(`${condicio ? '✅' : '❌'} ${etiqueta} ${detall !== undefined ? JSON.stringify(detall) : ''}`);
    if (!condicio) correcte = false;
};

const mesura = page =>
    page.evaluate(() => {
        const cue = document.getElementById('nativePlayCue');
        const title = document.getElementById('videoTitle').getBoundingClientRect();
        const bar = document.getElementById('playerExternalControls').getBoundingClientRect();
        const pill = cue.querySelector('.native-play-cue__pill');
        const hint = document.getElementById('playerNativePlayHint').getBoundingClientRect();
        return {
            esperant: document.getElementById('videoPlayer').dataset.awaitingNativePlay,
            obert: cue.classList.contains('is-visible'),
            alcada: Math.round(cue.getBoundingClientRect().height),
            opacitat: Number(getComputedStyle(pill).opacity),
            titolSotaControls: Math.round(title.top - bar.bottom),
            sotaControls: Math.round(cue.getBoundingClientRect().top - bar.bottom),
            avisAnticMida: Math.round(hint.width * hint.height),
        };
    });

async function prova(browser, width, errors) {
    const mobile = width <= 768;
    const nom = mobile ? `mòbil (${width} px)` : `ordinador (${width} px)`;
    const context = await browser.newContext({
        viewport: { width, height: mobile ? 844 : 1000 },
        isMobile: mobile,
        hasTouch: mobile,
        serviceWorkers: 'block',
    });
    await context.addInitScript(() => {
        if (localStorage.getItem('__seed')) return;
        localStorage.setItem(
            'segueix_cookie_consent_v2',
            JSON.stringify({ version: 1, status: 'accepted', source: 'test', updatedAt: new Date().toISOString() })
        );
        localStorage.setItem('__seed', '1');
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, route => route.abort());
    await page.route('**://*.youtube*.com/embed/**', route =>
        route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: stub(0) })
    );
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
    // Artistes seguits perquè «La teva ràdio» es pugui engegar, com un usuari que hi toca
    await page.evaluate(() => {
        const follows = [
            ...new Set(
                currentFeedVideos
                    .filter(v => v.contentType === 'song')
                    .slice(0, 4)
                    .map(v => v.channelId)
            ),
        ];
        localStorage.setItem('catube_follows', JSON.stringify(follows));
        SegueixApp.features.portada.updateEntry();
    });
    await page.click('#ptPlayBtn');
    await page.waitForSelector('#videoPlayer iframe', { timeout: 20000 });

    const inici = await mesura(page);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `avis-${width}-inici.png`) });
    await page.waitForTimeout(1200);
    const obert = await mesura(page);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `avis-${width}-obert.png`) });
    comprovar(
        `${nom}: esperant el primer ▶, l'avís s'obre a sobre del títol (que baixa) i el text hi apareix`,
        obert.esperant === 'true' &&
            obert.obert &&
            obert.alcada >= 40 &&
            obert.opacitat === 1 &&
            obert.sotaControls >= 0 &&
            obert.titolSotaControls >= inici.titolSotaControls + 30,
        { inici, obert }
    );
    comprovar(`${nom}: el text antic de la barra de controls ja no es veu`, obert.avisAnticMida <= 1, obert);

    // Tocar el vídeo: comença a sonar i l'avís es plega
    const centre = await page.evaluate(() => {
        const r = document.querySelector('#videoPlayer iframe').getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (mobile) await page.touchscreen.tap(centre.x, centre.y);
    else await page.mouse.click(centre.x, centre.y);
    await page.waitForTimeout(900);
    const sona = await mesura(page);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `avis-${width}-sona.png`) });
    comprovar(
        `${nom}: quan comença a sonar, l'avís es plega i el títol torna amunt`,
        sona.esperant === 'false' &&
            !sona.obert &&
            sona.alcada === 0 &&
            sona.titolSotaControls <= inici.titolSotaControls,
        sona
    );
    await context.close();
}

async function main() {
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    const server = await serve();
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] });
    const errors = [];
    try {
        for (const width of [1280, 390]) await prova(browser, width, errors);
        comprovar('cap error de pàgina', errors.length === 0, errors);
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\n✅ Avís «Prem ▶ al reproductor» verificat' : '\n❌ Hi ha comprovacions que fallen');
    process.exit(correcte ? 0 : 1);
}

main().catch(error => {
    console.error('❌ La verificació ha fallat:', error.message);
    process.exit(1);
});
