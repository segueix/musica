// Verificació en navegador real dels controls del sistema i de la finestra flotant del sistema (Document
// Picture-in-Picture, Chrome/Edge d'escriptori i Chromebook): el botó «Mini reproductor» obre una finestra del sistema
// amb la cançó, la ràdio i els controls; el reproductor de YouTube es queda a la pàgina; anterior / play-pausa /
// següent i «com aquesta» funcionen des de la finestra; la Media Session diu què sona.
//
// YouTube no es pot carregar aquí: se serveix un succedani local a la URL d'embed que parla el mateix protocol de
// postMessage (onStateChange, playVideo/pauseVideo) i avisa la pàgina de cada toc rebut.
//
// NO forma part de `npm test`: és una eina opt-in. Requisits: playwright-core i un Chromium (CHROMIUM_PATH).
// Ús:  node tests/browser/verificar-finestra-sistema.js

const http = require('http');
const { ambGustRecent } = require('./gust-recent');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.MUSICA_TEST_PORT || 8152);
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

const pip = page =>
    page.evaluate(() => {
        const win = window.documentPictureInPicture?.window;
        if (!win) return null;
        const doc = win.document;
        const text = name => doc.querySelector(`[data-sp="${name}"]`)?.textContent?.trim() || '';
        return {
            title: text('title'),
            artist: text('artist'),
            label: text('label'),
            next: text('next'),
            toggle: doc.querySelector('[data-sp-action="toggle"]')?.getAttribute('aria-label'),
            prevDisabled: doc.querySelector('[data-sp-action="previous"]')?.disabled,
        };
    });

const sona = page =>
    page.evaluate(() => {
        const queue = typeof activePlaylistQueue !== 'undefined' ? activePlaylistQueue : [];
        const video = queue[currentPlaylistIndex] || {};
        return { index: currentPlaylistIndex, title: video.title, artist: video.channelTitle };
    });

const clicPip = (page, action) =>
    page.evaluate(selector => {
        window.documentPictureInPicture.window.document.querySelector(selector).click();
    }, `[data-sp-action="${action}"]`);

(async () => {
    const server = await serve();
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] });
    try {
        const errors = [];
        const { context, page } = await novaPagina(browser, 1280, errors);

        const suport = await page.evaluate(() => SegueixApp.features.systemPlayer.isPipSupported());
        comprovar('el navegador té finestra flotant del sistema', suport);

        // Media Session: què sona i quines accions hi ha
        const media = await page.evaluate(() => ({
            title: navigator.mediaSession.metadata?.title,
            artist: navigator.mediaSession.metadata?.artist,
            album: navigator.mediaSession.metadata?.album,
            state: navigator.mediaSession.playbackState,
        }));
        const ara = await sona(page);
        comprovar(
            'la Media Session diu la cançó i l’artista que sonen',
            media.title === ara.title && media.artist === ara.artist,
            media
        );
        comprovar('la Media Session sap que sona', media.state === 'playing', media.state);

        // Obrir la finestra del sistema amb el botó «Mini reproductor» de sota el vídeo
        await page.click('#playerMiniBtn');
        await page.waitForFunction(() => Boolean(window.documentPictureInPicture?.window), null, { timeout: 5000 });
        await page.waitForTimeout(400);
        let estat = await pip(page);
        comprovar(
            'la finestra mostra la cançó i l’artista',
            estat?.title === ara.title && estat?.artist === ara.artist,
            estat
        );
        comprovar(
            'la finestra diu de quina ràdio es tracta',
            /ràdio/i.test(estat?.label || '') && estat?.label !== 'Ràdio',
            estat?.label
        );
        if (process.env.MUSICA_TEST_SHOTS) {
            const finestra = context.pages().find(item => item !== page);
            if (finestra) await finestra.setViewportSize({ width: 360, height: 520 });
            if (finestra)
                await finestra.screenshot({ path: path.join(process.env.MUSICA_TEST_SHOTS, 'finestra-sistema.png') });
        }
        comprovar('la finestra diu què ve després', /^A continuació:/.test(estat?.next || ''), estat?.next);
        comprovar('a la primera cançó no hi ha «anterior»', estat?.prevDisabled === true);
        const alLloc = await page.evaluate(() => ({
            aLaPagina: document.getElementById('videoPlayer')?.isConnected === true,
            iframe: Boolean(document.querySelector('#videoPlayer iframe')),
            mini: document.getElementById('videoPlayer')?.classList.contains('mini-player-active'),
        }));
        comprovar(
            'el reproductor de YouTube es queda a la pàgina (no s’hi mou)',
            alLloc.aLaPagina && alLloc.iframe,
            alLloc
        );
        comprovar('no s’obre també la finestra flotant de dins la pàgina', !alLloc.mini, alLloc);

        // Següent des de la finestra: el reproductor no es recrea (un iframe nou en una finestra minimitzada no
        // sonaria fins que es tornés a veure la pàgina), se li demana la cançó nova (loadVideoById).
        await page.evaluate(() => {
            window.__iframe = document.querySelector('#videoPlayer iframe');
            window.__ordres = [];
        });
        await clicPip(page, 'next');
        await page.waitForFunction(i => currentPlaylistIndex === i + 1, ara.index, { timeout: 5000 });
        await page.waitForTimeout(1300);
        const segona = await sona(page);
        estat = await pip(page);
        comprovar('«següent» passa a la cançó següent i la finestra s’hi posa al dia', estat?.title === segona.title, {
            sona: segona.title,
            finestra: estat?.title,
        });
        comprovar('ara sí que hi ha «anterior»', estat?.prevDisabled === false);
        const encadenat = await page.evaluate(() => ({
            mateix: document.querySelector('#videoPlayer iframe') === window.__iframe,
            ordres: window.__ordres.slice(),
            sona: document.getElementById('videoPlayer')?.dataset?.playingVideoId,
            id: String(activePlaylistQueue[currentPlaylistIndex]?.id || ''),
        }));
        comprovar(
            'amb la finestra del sistema oberta, la cançó canvia dins del mateix reproductor',
            encadenat.mateix && encadenat.ordres.includes('loadVideoById') && encadenat.sona === encadenat.id,
            encadenat
        );

        // Pausa i play des de la finestra
        await page.waitForFunction(() => document.getElementById('videoPlayer')?.dataset?.playerState === '1', null, {
            timeout: 8000,
        });
        await page.evaluate(() => (window.__ordres = []));
        await clicPip(page, 'toggle');
        await page.waitForTimeout(1300);
        estat = await pip(page);
        let ordres = await page.evaluate(() => window.__ordres.slice());
        comprovar('el botó central pausa (envia pauseVideo al reproductor)', ordres.includes('pauseVideo'), ordres);
        comprovar('i passa a dir «Reprodueix»', estat?.toggle === 'Reprodueix', estat?.toggle);
        await clicPip(page, 'toggle');
        await page.waitForTimeout(1300);
        ordres = await page.evaluate(() => window.__ordres.slice());
        estat = await pip(page);
        comprovar('i torna a sonar (playVideo)', ordres.includes('playVideo') && estat?.toggle === 'Pausa', {
            ordres,
            toggle: estat?.toggle,
        });

        // Anterior
        await clicPip(page, 'previous');
        await page.waitForFunction(i => currentPlaylistIndex === i, ara.index, { timeout: 5000 });
        comprovar('«anterior» torna a la primera cançó', true);

        // «Com aquesta»
        await clicPip(page, 'more');
        await page.waitForTimeout(400);
        const preferencia = await page.evaluate(() =>
            window.documentPictureInPicture.window.document
                .querySelector('[data-sp-action="more"]')
                .getAttribute('aria-pressed')
        );
        comprovar('«+ com aquesta» queda marcat', preferencia === 'true', preferencia);

        // Tancar
        await page.evaluate(() => window.documentPictureInPicture.window.close());
        await page.waitForTimeout(400);
        const tancada = await page.evaluate(() => ({
            obert: SegueixApp.features.systemPlayer.isPipOpen(),
            classe: document.body.classList.contains('is-system-pip'),
        }));
        comprovar('en tancar-la, l’app ho sap', !tancada.obert && !tancada.classe, tancada);

        // Finestra minimitzada (pàgina amagada): quan una cançó s'acaba, la següent es demana al mateix reproductor
        const reproductor = () => page.frames().find(frame => /youtube/.test(frame.url()));
        const acaba = () => reproductor()?.evaluate(() => send(0));
        await page.waitForFunction(() => document.getElementById('videoPlayer')?.dataset?.playerState === '1', null, {
            timeout: 8000,
        });
        await page.evaluate(() => {
            Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
            window.__iframe = document.querySelector('#videoPlayer iframe');
            window.__ordres = [];
        });
        // Fora de la guarda de 2 s de l'últim canvi (l'«anterior» de fa un moment)
        await page.waitForTimeout(2200);
        const abans = await sona(page);
        await acaba();
        await page.waitForFunction(i => currentPlaylistIndex === i + 1, abans.index, { timeout: 5000 });
        await acaba(); // l'«ended» endarrerit de la cançó anterior no ha de saltar-ne una altra
        await page.waitForTimeout(800);
        const amagada = await page.evaluate(() => ({
            mateix: document.querySelector('#videoPlayer iframe') === window.__iframe,
            ordres: window.__ordres.slice(),
            index: currentPlaylistIndex,
        }));
        comprovar(
            'amb la pàgina amagada, la cançó següent sona al mateix reproductor',
            amagada.mateix && amagada.ordres.includes('loadVideoById'),
            amagada
        );
        comprovar('l’«ended» repetit no salta una cançó', amagada.index === abans.index + 1, amagada.index);

        // Pàgina visible: el camí de sempre (reproductor nou amb la caràtula mentre carrega)
        await page.evaluate(() => {
            delete document.visibilityState;
            window.__iframe = document.querySelector('#videoPlayer iframe');
        });
        await page.waitForTimeout(2200);
        await acaba();
        await page.waitForFunction(i => currentPlaylistIndex === i + 2, abans.index, { timeout: 5000 });
        await page.waitForTimeout(400);
        const visible = await page.evaluate(() => document.querySelector('#videoPlayer iframe') !== window.__iframe);
        comprovar('amb la pàgina visible, es manté el camí de sempre', visible);

        comprovar('cap error de JavaScript', errors.length === 0, errors);
        await context.close();
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\n✅ Tot correcte' : '\n❌ Hi ha errors');
    process.exit(correcte ? 0 : 1);
})();
