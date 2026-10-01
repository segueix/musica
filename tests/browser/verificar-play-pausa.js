// Verificació en navegador real del play/pausa del reproductor (normal i flotant): el botó de play/pausa propi ja no
// existeix i tots els tocs arriben al reproductor de YouTube (cap capa no el cobreix); la finestra flotant només
// s'arrossega pel mànec de dalt (escriptori) i al mòbil va ancorada amb la barra de dalt sempre visible.
//
// YouTube no es pot carregar aquí: se serveix un succedani local a la URL d'embed que parla el mateix protocol de
// postMessage (onStateChange, playVideo/pauseVideo) i avisa la pàgina de cada toc rebut.
//
// NO forma part de `npm test`: és una eina opt-in. Requisits: playwright-core i un Chromium (CHROMIUM_PATH).
// Ús:  node tests/browser/verificar-play-pausa.js

const http = require('http');
const { ambGustRecent } = require('./gust-recent');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.MUSICA_TEST_PORT || 8149);
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

const STUB_PLAYER = `<!doctype html><html lang="ca"><head><meta charset="utf-8"><title>stub</title>
<style>html,body{margin:0;height:100%;background:#123;color:#fff;font:16px sans-serif}</style></head><body><p>stub</p><script>
function send(info) { parent.postMessage(JSON.stringify({ event: 'onStateChange', info, id: 'catube-player' }), '*'); }
document.addEventListener('pointerdown', () => parent.postMessage(JSON.stringify({ event: '__tap' }), '*'));
setTimeout(() => send(1), 150);
window.addEventListener('message', event => {
    let dades = event.data;
    if (typeof dades === 'string') { try { dades = JSON.parse(dades); } catch (_) { return; } }
    if (!dades || dades.event !== 'command') return;
    parent.postMessage(JSON.stringify({ event: '__command', func: dades.func }), '*');
    if (dades.func === 'pauseVideo') send(2);
    if (dades.func === 'playVideo') send(1);
    if (dades.func === 'loadVideoById') { send(3); setTimeout(() => send(1), 120); }
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

async function novaPagina(browser, width, errors) {
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
    await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, route => route.abort());
    // Es registra després del bloqueig general perquè hi passi al davant
    await page.route('**://*.youtube*.com/embed/**', route =>
        route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: STUB_PLAYER })
    );
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
        window.__tocs = 0;
        window.__ordres = [];
        window.addEventListener('message', event => {
            let dades = event.data;
            if (typeof dades === 'string') {
                try {
                    dades = JSON.parse(dades);
                } catch (_) {
                    return;
                }
            }
            if (dades?.event === '__tap') window.__tocs += 1;
            if (dades?.event === '__command') window.__ordres.push(dades.func);
        });
    });
    await ambGustRecent(page);
    await page.click('#ptPlayBtn');
    await page.waitForSelector('#videoPlayer iframe', { timeout: 20000 });
    await page.waitForFunction(() => document.getElementById('videoPlayer')?.dataset?.playerState === '1', null, {
        timeout: 10000,
    });
    return { context, page, mobile };
}

const punts = page =>
    page.evaluate(() => {
        const box = document.getElementById('videoPlayer').getBoundingClientRect();
        return { l: box.left, t: box.top, w: box.width, h: box.height };
    });

const toc = async (page, mobile, x, y) => {
    if (mobile) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
    await page.waitForTimeout(350);
};

const tocsRebuts = page => page.evaluate(() => window.__tocs);
const estat = page => page.evaluate(() => document.getElementById('videoPlayer').dataset.playerState);

// Amaga els controls de la cua (com passa passats uns segons sense tocar res)
const amagarControls = page => page.evaluate(() => hideQueueNextOverlay());

async function proves(browser, width, errors) {
    const etiqueta = width <= 768 ? `mòbil (${width} px)` : `escriptori (${width} px)`;
    const { context, page, mobile } = await novaPagina(browser, width, errors);

    // 1) El play/pausa propi i la capa tàctil ja no hi són; queden anterior / següent / finestra flotant
    const estructura = await page.evaluate(() => ({
        toggle: document.querySelectorAll('.queue-toggle-button').length,
        capaTactil: document.querySelectorAll('.queue-next-touch-layer').length,
        botons: [...document.querySelectorAll('.queue-controls button')].map(button => button.className.split(' ')[0]),
    }));
    comprovar(
        `${etiqueta}: no hi ha botó de play/pausa propi ni capa tàctil sobre el vídeo`,
        estructura.toggle === 0 &&
            estructura.capaTactil === 0 &&
            estructura.botons.join() === 'queue-prev-button,queue-next-button,queue-mini-button',
        estructura
    );

    // 2) Reproductor normal, controls amagats: tots els tocs arriben al reproductor de YouTube
    await amagarControls(page);
    await page.waitForTimeout(300);
    const normal = await punts(page);
    const mostres = {
        centre: [normal.l + normal.w / 2, normal.t + normal.h / 2],
        'baix-esquerra': [normal.l + 40, normal.t + normal.h - 40],
        'dalt-dreta': [normal.l + normal.w - 60, normal.t + 50],
    };
    const rebuts = {};
    for (const [nom, [x, y]] of Object.entries(mostres)) {
        const abans = await tocsRebuts(page);
        await amagarControls(page);
        await toc(page, mobile, x, y);
        rebuts[nom] = (await tocsRebuts(page)) - abans;
    }
    comprovar(
        `${etiqueta}: amb els controls amagats, un toc al vídeo (centre, baix, dalt) arriba al reproductor a la primera`,
        Object.values(rebuts).every(n => n === 1),
        rebuts
    );

    // 3) Tàctil: el toc mostra els controls de la cua (sense cobrir el vídeo) i el segon toc també es detecta
    if (mobile) {
        await amagarControls(page);
        await toc(page, true, normal.l + 40, normal.t + normal.h - 40);
        const primer = await page.evaluate(() => !!document.querySelector('.queue-next-overlay.is-visible'));
        await amagarControls(page);
        await toc(page, true, normal.l + 60, normal.t + normal.h - 60);
        const segon = await page.evaluate(() => !!document.querySelector('.queue-next-overlay.is-visible'));
        comprovar(`${etiqueta}: un toc al vídeo mostra els controls de la cua, també el segon`, primer && segon, {
            primer,
            segon,
        });
    }

    // 4) El centre queda lliure per al botó de YouTube, també amb els controls visibles
    await page.evaluate(() => showQueueNextOverlay({ sticky: true }));
    await page.waitForTimeout(300);
    const centre = await page.evaluate(() => {
        const box = document.getElementById('videoPlayer').getBoundingClientRect();
        const el = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        const buttons = [...document.querySelectorAll('.queue-controls button')].map(button => {
            const r = button.getBoundingClientRect();
            return { nom: button.className.split(' ')[0], w: Math.round(r.width), h: Math.round(r.height) };
        });
        return { alCentre: el?.tagName?.toLowerCase(), buttons };
    });
    comprovar(
        `${etiqueta}: al centre hi ha el reproductor (no cap botó nostre) i «següent» fa ≥ 44 px`,
        centre.alCentre === 'iframe' && centre.buttons.find(item => item.nom === 'queue-next-button').w >= 44,
        centre
    );

    // 5) Ordres explícites: pausa i play no depenen de l'estat desat; en buffering (3) el canvi pausa
    await page.evaluate(() => {
        window.__ordres.length = 0;
        pauseMainPlayer();
    });
    await page.waitForFunction(() => document.getElementById('videoPlayer').dataset.playerState === '2');
    const enPausa = await page.evaluate(() => ({
        ordres: window.__ordres.slice(),
        visibles: getComputedStyle(document.querySelector('.queue-controls')).opacity,
    }));
    await page.evaluate(() => {
        window.__ordres.length = 0;
        playMainPlayer();
    });
    await page.waitForFunction(() => document.getElementById('videoPlayer').dataset.playerState === '1');
    await page.evaluate(() => {
        document.getElementById('videoPlayer').dataset.playerState = '3';
        window.__ordres.length = 0;
        toggleMainPlayerPlayback();
    });
    await page.waitForFunction(() => document.getElementById('videoPlayer').dataset.playerState === '2');
    const enBuffering = await page.evaluate(() => window.__ordres.slice());
    await page.evaluate(() => {
        document.getElementById('videoPlayer').dataset.playerState = '';
        window.__ordres.length = 0;
        toggleMainPlayerPlayback();
    });
    await page.waitForFunction(() => document.getElementById('videoPlayer').dataset.playerState === '1');
    // (en començar a sonar, l'app suggereix la qualitat: no és un play/pausa)
    const senseEstat = (await page.evaluate(() => window.__ordres.slice())).filter(
        ordre => ordre !== 'setPlaybackQuality'
    );
    comprovar(
        `${etiqueta}: pauseMainPlayer/playMainPlayer envien l'ordre explícita; amb estat 3 (buffering) el canvi pausa; sense estat reprodueix`,
        enPausa.ordres.join() === 'pauseVideo' &&
            Number(enPausa.visibles) === 1 &&
            enBuffering.join() === 'pauseVideo' &&
            senseEstat.join() === 'playVideo',
        { enPausa, enBuffering, senseEstat }
    );
    await page.evaluate(() => hideQueueNextOverlay());

    // 6) Finestra flotant
    await page.evaluate(() => setMiniPlayerState(true, { trigger: 'test' }));
    await page.waitForFunction(() => document.getElementById('videoPlayer').classList.contains('mini-player-active'));
    await page.waitForTimeout(700);
    const mini = await page.evaluate(() => {
        const player = document.getElementById('videoPlayer');
        const box = player.getBoundingClientRect();
        const at = (fx, fy) => {
            const el = document.elementFromPoint(box.left + box.width * fx, box.top + box.height * fy);
            return el ? el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] : null;
        };
        const handle = document.querySelector('.drag-handle-container');
        const handleBox = handle.getBoundingClientRect();
        const overlay = document.querySelector('.mini-player-controls-overlay');
        const buttons = ['.expand-mini-player-btn', '.close-mini-player-btn'].map(selector => {
            const r = document.querySelector(selector).getBoundingClientRect();
            return [Math.round(r.width), Math.round(r.height)];
        });
        return {
            ancorada: window.innerWidth <= 768,
            box: [Math.round(box.left), Math.round(box.top), Math.round(box.width), Math.round(box.height)],
            video: [at(0.5, 0.5), at(0.2, 0.9), at(0.8, 0.6), at(0.5, 0.35)],
            dalt: at(0.5, 0.06),
            mànec: getComputedStyle(handle).display === 'none' ? null : Math.round(handleBox.height),
            barra: getComputedStyle(overlay).opacity,
            buttons,
        };
    });
    comprovar(
        `${etiqueta}: a la finestra flotant el vídeo (centre, baix, dreta) és del reproductor de YouTube`,
        mini.video.every(id => id === 'iframe.'),
        mini.video
    );
    if (mobile) {
        comprovar(
            `${etiqueta}: la finestra va ancorada a baix, sense mànec, amb la barra de dalt (restaurar/tancar) sempre visible i de ≥ 44 px`,
            mini.mànec === null &&
                mini.dalt === 'iframe.' &&
                Number(mini.barra) === 1 &&
                mini.buttons.every(([w, h]) => w >= 44 && h >= 44) &&
                mini.box[0] === 0 &&
                mini.box[2] === width,
            mini
        );
    } else {
        comprovar(
            `${etiqueta}: només hi ha un mànec de 36 px a dalt per arrossegar`,
            mini.mànec === 36 && /drag-surface/.test(mini.dalt),
            { mànec: mini.mànec, dalt: mini.dalt }
        );
    }

    // 6b) Toc al centre de la finestra flotant: arriba al reproductor i no canvia res per compte nostre
    await page.evaluate(() => {
        window.__ordres.length = 0;
    });
    const abans = await tocsRebuts(page);
    const caixa = await punts(page);
    await toc(page, mobile, caixa.l + caixa.w / 2, caixa.t + caixa.h / 2 + 20);
    await toc(page, mobile, caixa.l + caixa.w * 0.25, caixa.t + caixa.h * 0.8);
    const flotant = {
        tocs: (await tocsRebuts(page)) - abans,
        ordres: await page.evaluate(() => window.__ordres.slice()),
        estat: await estat(page),
    };
    comprovar(
        `${etiqueta}: els tocs a la finestra flotant arriben al reproductor i l'app no hi envia cap ordre pròpia`,
        flotant.tocs === 2 && flotant.ordres.length === 0 && flotant.estat === '1',
        flotant
    );

    // 6c) Escriptori: arrossegar pel mànec mou la finestra, sense pausar res
    if (!mobile) {
        const abansBox = await punts(page);
        await page.mouse.move(abansBox.l + abansBox.w / 2, abansBox.t + 18);
        await page.mouse.down();
        await page.mouse.move(abansBox.l + abansBox.w / 2 - 120, abansBox.t + 18 - 90, { steps: 6 });
        await page.mouse.up();
        await page.waitForTimeout(400);
        const despres = await punts(page);
        comprovar(
            `${etiqueta}: arrossegar pel mànec de dalt mou la finestra i no pausa el vídeo`,
            Math.abs(despres.l - (abansBox.l - 120)) < 3 &&
                Math.abs(despres.t - (abansBox.t - 90)) < 3 &&
                (await estat(page)) === '1' &&
                (await page.evaluate(() => window.__ordres.length)) === 0,
            {
                abans: [Math.round(abansBox.l), Math.round(abansBox.t)],
                despres: [Math.round(despres.l), Math.round(despres.t)],
            }
        );
    }

    // 7) «Següent» de la cua continua funcionant (en pausa els controls són sempre visibles)
    await page.evaluate(() => pauseMainPlayer());
    await page.waitForFunction(() => document.getElementById('videoPlayer').dataset.playerState === '2');
    await page.waitForTimeout(400);
    const abansIndex = await page.evaluate(() => currentPlaylistIndex);
    const next = await page.evaluate(() => {
        const r = document.querySelector('.queue-next-button').getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
    });
    await toc(page, mobile, next.x, next.y);
    await page.waitForTimeout(500);
    const despresIndex = await page.evaluate(() => currentPlaylistIndex);
    comprovar(`${etiqueta}: «següent» de la cua funciona a la finestra flotant`, despresIndex === abansIndex + 1, {
        abansIndex,
        despresIndex,
        mida: Math.round(next.w),
    });

    await context.close();
}

async function main() {
    const server = await serve();
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] });
    const errors = [];
    try {
        for (const width of [390, 1280]) await proves(browser, width, errors);
        comprovar('cap error de pàgina', errors.length === 0, errors.slice(0, 3));
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\n✅ Play/pausa del reproductor verificat' : '\n❌ Hi ha comprovacions fallides');
    process.exit(correcte ? 0 : 1);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
