// Verificació en navegador real del mode conducció (mòbil): pantalla negra, reproductor YouTube de 200×200,
// Wake Lock i controls de reproducció grans però discrets que desapareixen als 3,5 s i reapareixen tocant el fons.
// En tancar, tot torna a ser com abans. El reproductor no es recrea (és el mateix iframe).
//
// YouTube no es pot carregar aquí: se serveix un succedani local a la URL d'embed.
// NO forma part de `npm test`: és una eina opt-in. Ús:  node tests/browser/verificar-mode-conduccio.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const { ambGustRecent } = require('./gust-recent');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.MUSICA_TEST_PORT || 8153);
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

const STUB_PLAYER = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#123}</style></head><body><script>
function send(info) { parent.postMessage(JSON.stringify({ event: 'onStateChange', info, id: 'catube-player' }), '*'); }
setTimeout(() => send(1), 150);
window.addEventListener('message', event => {
    let d = event.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (_) { return; } }
    if (!d || d.event !== 'command') return;
    parent.postMessage(JSON.stringify({ event: '__driveTestCommand', func: d.func, args: d.args || [] }), '*');
    if (d.func === '__emitState') { send(Number(d.args?.[0])); return; }
    if (d.func === 'pauseVideo') send(2);
    if (d.func === 'playVideo') send(1);
    if (d.func === 'loadVideoById') { send(3); setTimeout(() => send(1), 120); }
});
</script></body></html>`;

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

(async () => {
    const server = await serve();
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] });
    const errors = [];
    try {
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
            // Wake Lock simulat: es compta quantes vegades es demana i s'allibera
            window.__wake = { requests: 0, released: 0 };
            Object.defineProperty(navigator, 'wakeLock', {
                configurable: true,
                value: {
                    request: async () => {
                        window.__wake.requests += 1;
                        return { release: async () => (window.__wake.released += 1), addEventListener() {} };
                    },
                },
            });
        });
        const page = await context.newPage();
        await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, route => route.abort());
        await page.route('**://*.youtube*.com/embed/**', route =>
            route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: STUB_PLAYER })
        );
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
        await ambGustRecent(page);
        await page.click('#ptPlayBtn');
        await page.waitForSelector('#videoPlayer iframe', { timeout: 20000 });
        await page.waitForSelector('#driveModeBtn', { timeout: 10000 });
        await page.waitForSelector('#playlistModeBadge', { timeout: 10000 });
        const ubicacioBoto = await page.evaluate(() => {
            const button = document.getElementById('driveModeBtn');
            const badge = document.getElementById('playlistModeBadge');
            return {
                dinsBadge: Boolean(button && badge?.contains(button)),
                label: badge?.querySelector('.playlist-mode-badge-label')?.textContent || '',
            };
        });
        comprovar(
            'el botó Conducció és al costat de «Mode llista · …» sota el reproductor',
            ubicacioBoto.dinsBadge && ubicacioBoto.label.startsWith('Mode llista ·'),
            ubicacioBoto
        );
        await page.evaluate(() => (window.__iframe = document.querySelector('#videoPlayer iframe')));

        await page.click('#driveModeBtn');
        await page.waitForTimeout(500);
        const dins = await page.evaluate(() => {
            const iframe = document.querySelector('#videoPlayer iframe');
            const box = iframe.getBoundingClientRect();
            const exit = document.getElementById('driveModeExit');
            const exitBox = exit?.getBoundingClientRect();
            const controls = document.getElementById('driveModeControls');
            const controlButtons = [...(controls?.querySelectorAll('.dm-control') || [])];
            const controlBoxes = controlButtons.map(button => {
                const r = button.getBoundingClientRect();
                return { w: Math.round(r.width), h: Math.round(r.height), label: button.getAttribute('aria-label') };
            });
            // Què es veu en uns quants punts de la pantalla (fora del reproductor i del botó)
            const punts = [
                [195, 400],
                [40, 600],
                [350, 700],
                [195, 300],
            ].map(([x, y]) => {
                const el = document.elementFromPoint(x, y);
                if (!el || el === document.body || el === document.documentElement) return 'fons';
                return `${el.tagName}.${el.className}:${getComputedStyle(el).visibility}`;
            });
            const visibles = [...document.querySelectorAll('body *')].filter(el => {
                if (
                    el === exit ||
                    el === controls ||
                    el.closest?.('#driveModeControls') ||
                    el.closest?.('#videoPlayer')
                ) return false;
                const style = getComputedStyle(el);
                const r = el.getBoundingClientRect();
                return style.visibility === 'visible' && style.display !== 'none' && r.width > 0 && r.height > 0;
            });
            return {
                actiu: SegueixApp.features.driveMode.isActive(),
                classe: document.body.classList.contains('drive-mode'),
                box: { top: Math.round(box.top), left: Math.round(box.left), width: Math.round(box.width), height: Math.round(box.height) },
                visibleIframe: getComputedStyle(iframe).visibility,
                exit: exit && {
                    text: exit.textContent,
                    label: exit.getAttribute('aria-label'),
                    h: Math.round(exitBox.height),
                    visible: getComputedStyle(exit).visibility,
                },
                controls: {
                    count: controlButtons.length,
                    boxes: controlBoxes,
                    visible: controls ? getComputedStyle(controls).display !== 'none' && !controls.hidden : false,
                },
                fons: getComputedStyle(document.body).backgroundColor,
                punts,
                altresVisibles: visibles.length,
                mateixIframe: iframe === window.__iframe,
                wake: window.__wake,
                placeholder: (() => {
                    const p = document.querySelector('#videoPlayer > :not(iframe)');
                    return p ? getComputedStyle(p).visibility : 'cap';
                })(),
            };
        });
        comprovar('entra al mode conducció', dins.actiu && dins.classe, dins);
        comprovar(
            'el reproductor es veu a dalt i fa 200×200',
            dins.visibleIframe === 'visible' &&
                dins.box.top >= 0 &&
                dins.box.top < 80 &&
                Math.abs(dins.box.width - 200) <= 1 &&
                Math.abs(dins.box.height - 200) <= 1,
            dins.box
        );
        comprovar('és el mateix reproductor (no s’ha recreat)', dins.mateixIframe);
        comprovar('fons negre', dins.fons === 'rgb(0, 0, 0)', dins.fons);
        comprovar('no es veu cap altre element de l’app', dins.altresVisibles === 0, dins.altresVisibles);
        comprovar(
            'la resta de la pantalla és buida',
            dins.punts.every(v => v === 'fons'),
            dins.punts
        );
        comprovar(
            'el botó de sortida és compacte i només mostra una ×',
            dins.exit?.text === '×' && dins.exit?.label === 'Tanca el mode conducció' && dins.exit.h >= 48,
            dins.exit
        );
        comprovar(
            'hi ha 4 controls grans: anterior, −10 s, +10 s i següent',
            dins.controls.count === 4 &&
                dins.controls.visible &&
                dins.controls.boxes.every(box => box.w >= 60 && box.h >= 60),
            dins.controls
        );
        comprovar('la pantalla no s’apaga (Wake Lock)', dins.wake.requests >= 1, dins.wake);

        // Recuperació conservadora: una pausa normal no es toca; un buffering→pausa encallat es reprèn una sola vegada.
        await page.evaluate(() => {
            window.__driveCommands = [];
            if (!window.__driveCommandListener) {
                window.__driveCommandListener = true;
                window.addEventListener('message', event => {
                    let payload = event.data;
                    if (typeof payload === 'string') {
                        try {
                            payload = JSON.parse(payload);
                        } catch (_) {
                            return;
                        }
                    }
                    if (payload?.event === '__driveTestCommand') window.__driveCommands.push(payload.func);
                });
            }
        });
        const emitState = async state =>
            page.evaluate(value => {
                const iframe = document.querySelector('#videoPlayer iframe');
                iframe?.contentWindow?.postMessage(
                    JSON.stringify({ event: 'command', func: '__emitState', args: [value] }),
                    '*'
                );
            }, state);

        await emitState(2);
        await page.waitForTimeout(2700);
        let recovery = await page.evaluate(() => window.__driveCommands.filter(command => command === 'playVideo').length);
        comprovar('una pausa normal no es reprèn automàticament', recovery === 0, recovery);

        await emitState(1);
        await page.waitForTimeout(100);
        await emitState(3);
        await page.waitForTimeout(80);
        await emitState(2);
        await page.waitForTimeout(2700);
        recovery = await page.evaluate(() => window.__driveCommands.filter(command => command === 'playVideo').length);
        comprovar('un buffering→pausa encallat es reprèn una vegada', recovery === 1, recovery);

        await emitState(3);
        await page.waitForTimeout(80);
        await emitState(2);
        await page.waitForTimeout(2700);
        const recoveryFinal = await page.evaluate(
            () => window.__driveCommands.filter(command => command === 'playVideo').length
        );
        comprovar('la recuperació no entra en bucle: màxim un intent per cançó', recoveryFinal === 1, recoveryFinal);

        await page.waitForTimeout(3700);
        const uiAmagada = await page.evaluate(() => {
            const e = document.getElementById('driveModeExit');
            const controls = document.getElementById('driveModeControls');
            const hidden = el => Boolean(el?.hidden) || getComputedStyle(el).display === 'none';
            return hidden(e) && hidden(controls);
        });
        comprovar('els controls desapareixen automàticament als 3,5 s', uiAmagada);

        await page.mouse.click(40, 600);
        await page.waitForTimeout(100);
        const uiRecuperada = await page.evaluate(() => {
            const e = document.getElementById('driveModeExit');
            const controls = document.getElementById('driveModeControls');
            const visible = el => Boolean(el) && !el.hidden && getComputedStyle(el).display !== 'none';
            return visible(e) && visible(controls);
        });
        comprovar('un toc a la zona negra recupera temporalment els controls', uiRecuperada);

        await page.click('#driveModeExit');
        await page.waitForTimeout(400);
        const fora = await page.evaluate(() => ({
            actiu: SegueixApp.features.driveMode.isActive(),
            classe: document.body.classList.contains('drive-mode'),
            exitVisible: (() => {
                const e = document.getElementById('driveModeExit');
                return e ? getComputedStyle(e).display !== 'none' && !e.hidden : false;
            })(),
            wake: window.__wake,
            titol: getComputedStyle(document.getElementById('videoTitle') || document.body).visibility,
            mateixIframe: document.querySelector('#videoPlayer iframe') === window.__iframe,
        }));
        comprovar('en tancar, tot torna a ser com abans', !fora.actiu && !fora.classe && !fora.exitVisible && fora.titol === 'visible', fora);
        comprovar('i allibera la pantalla', fora.wake.released >= 1, fora.wake);
        comprovar('el reproductor continua sent el mateix', fora.mateixIframe);

        // A l'ordinador no hi ha botó
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.waitForTimeout(200);
        const escriptori = await page.evaluate(() => getComputedStyle(document.getElementById('driveModeBtn')).display);
        comprovar('a l’ordinador no surt el botó', escriptori === 'none', escriptori);

        if (process.env.MUSICA_TEST_SHOTS) {
            await page.setViewportSize({ width: 390, height: 844 });
            await page.click('#driveModeBtn').catch(() => {});
            await page.waitForTimeout(400);
            await page.screenshot({ path: path.join(process.env.MUSICA_TEST_SHOTS, 'mode-conduccio.png') });
        }
        comprovar('cap error de JavaScript', errors.length === 0, errors);
        await context.close();
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\n✅ Mode conducció correcte' : '\n❌ Hi ha errors');
    process.exit(correcte ? 0 : 1);
})();
