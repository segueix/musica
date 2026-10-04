// Verificació en navegador real dels controls del sistema i de la finestra flotant del sistema (Document
// Picture-in-Picture, Chrome/Edge d'escriptori i Chromebook): el botó «Reproductor flotant» obre una finestra del
// sistema que porta el VÍDEO de YouTube a dins (el node #videoPlayer s'hi trasllada) amb la cançó, la ràdio i els
// controls; amb el vídeo allà la reproducció continua encara que la pestanya quedi amagada; en tancar-la, el
// reproductor torna a la pàgina des del segon on era. Sense la finestra, una pestanya amagada pausa YouTube.
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
let st = -1;
function send(info) { st = info; parent.postMessage(JSON.stringify({ event: 'onStateChange', info, id: 'catube-player' }), '*'); }
document.addEventListener('pointerdown', () => parent.postMessage(JSON.stringify({ event: '__tap' }), '*'));
// El temps actual arriba cada 200 ms (com infoDelivery de YouTube) i la URL diu d'on s'ha arrencat (start=)
const start = Number(new URLSearchParams(location.search).get('start')) || 0;
const autoplay = new URLSearchParams(location.search).get('autoplay') !== '0';
setTimeout(() => { if (autoplay) send(1); else send(5); }, 150);
setInterval(() => parent.postMessage(JSON.stringify({ event: 'infoDelivery', info: { currentTime: start + 42, playerState: st } }), '*'), 200);
window.addEventListener('message', event => {
    let dades = event.data;
    if (typeof dades === 'string') { try { dades = JSON.parse(dades); } catch (_) { return; } }
    if (!dades || dades.event !== 'command') return;
    parent.postMessage(JSON.stringify({ event: '__command', func: dades.func, start }), '*');
    if (dades.func === 'pauseVideo') send(2);
    if (dades.func === 'playVideo') send(1);
    if (dades.func === '__end') send(0);
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
    // Les rutes van al context (no a la pàgina): l'iframe que viu dins la finestra flotant del sistema és d'una altra
    // pàgina del navegador i també ha de rebre el succedani de YouTube
    await context.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, route => route.abort());
    // Es registra després del bloqueig general perquè hi passi al davant
    await context.route('**://*.youtube*.com/embed/**', route =>
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

        // Obrir la finestra del sistema amb el botó «Reproductor flotant» de sota el vídeo
        await page.click('#playerMiniBtn');
        await page.waitForFunction(() => Boolean(window.documentPictureInPicture?.window), null, { timeout: 5000 });
        await page.waitForTimeout(600);
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
            if (finestra)
                await finestra.screenshot({ path: path.join(process.env.MUSICA_TEST_SHOTS, 'finestra-sistema.png') });
        }
        comprovar('la finestra diu què ve després', /^A continuació:/.test(estat?.next || ''), estat?.next);
        comprovar('a la primera cançó no hi ha «anterior»', estat?.prevDisabled === true);

        // El vídeo viu a la finestra flotant, no a la pàgina
        const dins = await page.evaluate(() => {
            const win = window.documentPictureInPicture.window;
            const player = win.document.getElementById('videoPlayer');
            const caixa = win.document.querySelector('[data-sp="video"]');
            const rect = player?.getBoundingClientRect();
            return {
                aLaFinestra: Boolean(player && caixa && caixa.contains(player)),
                iframe: Boolean(player?.querySelector('iframe')),
                aLaPagina: Boolean(document.getElementById('videoPlayer')),
                utils: SegueixApp.utils.playerElement() === player,
                visible: Boolean(rect && rect.width > 200 && rect.height > 100),
                amplada: Math.round(rect?.width || 0),
                alcada: Math.round(rect?.height || 0),
                classe: document.body.classList.contains('is-video-pip'),
                obert: SegueixApp.features.systemPlayer.isVideoPipOpen(),
                mini: player?.classList.contains('mini-player-active') === true,
                avis: getComputedStyle(document.getElementById('videoPipNotice')).display,
                srcPausa: player?.querySelector('iframe')?.src.includes('autoplay=1'),
            };
        });
        comprovar(
            'el vídeo de YouTube és dins la finestra flotant (visible, ≥ 200 px)',
            dins.aLaFinestra && dins.iframe && dins.visible,
            dins
        );
        comprovar(
            'i ja no és a la pàgina, però l’app el troba (app.utils.playerElement)',
            !dins.aLaPagina && dins.utils,
            dins
        );
        comprovar(
            'l’app ho sap i no obre també la finestreta de dins la pàgina',
            dins.classe && dins.obert && !dins.mini,
            dins
        );
        comprovar('l’iframe es reprèn amb autoplay (sonava)', dins.srcPausa === true, dins);

        // El reproductor reenviat arriba a l'app com sempre: l'estat i el temps (infoDelivery) s'hi actualitzen
        await page.waitForFunction(() => document.body.classList.contains('is-video-pip'), null, { timeout: 3000 });
        await page.waitForTimeout(800);
        const rebut = await page.evaluate(() => ({
            estat: SegueixApp.utils.playerElement().dataset.playerState,
            temps: lastKnownPlayerTime,
        }));
        comprovar(
            'els avisos de l’iframe de la finestra arriben a la pàgina (estat «sona» i temps)',
            rebut.estat === '1' && rebut.temps >= 42,
            rebut
        );

        // A la pàgina, el forat avisa i dona un botó per tornar-lo
        await page.evaluate(() => showVideoFromAPI?.call && 0);
        const avis = await page.evaluate(() => {
            const notice = document.getElementById('videoPipNotice');
            const placeholder = document.getElementById('videoPlaceholder');
            return {
                text: notice?.innerText?.trim(),
                visible:
                    getComputedStyle(notice).display !== 'none' &&
                    getComputedStyle(placeholder).visibility !== 'hidden',
                boto: Boolean(document.getElementById('videoPipRestore')),
                miniBtn: document.getElementById('playerMiniBtn').getAttribute('aria-label'),
                pressed: document.getElementById('playerMiniBtn').getAttribute('aria-pressed'),
            };
        });
        comprovar(
            'la pàgina diu que el vídeo és a la finestra i el botó de sota fa de «torna»',
            /finestra flotant/.test(avis.text) && avis.boto && avis.pressed === 'true' && /Torna/.test(avis.miniBtn),
            avis
        );

        // Següent des de la finestra: la cançó canvia amb el camí normal i el nou vídeo sona dins la mateixa finestra
        await page.evaluate(() => (window.__ordres = []));
        await clicPip(page, 'next');
        await page.waitForFunction(i => currentPlaylistIndex === i + 1, ara.index, { timeout: 5000 });
        await page.waitForTimeout(1500);
        const segona = await sona(page);
        estat = await pip(page);
        comprovar('«següent» passa a la cançó següent i la finestra s’hi posa al dia', estat?.title === segona.title, {
            sona: segona.title,
            finestra: estat?.title,
        });
        comprovar('ara sí que hi ha «anterior»', estat?.prevDisabled === false);
        const continua = await page.evaluate(() => {
            const win = window.documentPictureInPicture.window;
            const player = win.document.getElementById('videoPlayer');
            return {
                aLaFinestra: Boolean(player?.querySelector('iframe')),
                aLaPagina: Boolean(document.getElementById('videoPlayer')),
                sona: SegueixApp.utils.playerElement().dataset.playingVideoId,
                id: String(activePlaylistQueue[currentPlaylistIndex]?.id || ''),
                estat: SegueixApp.utils.playerElement().dataset.playerState,
            };
        });
        comprovar(
            'la cançó nova sona dins la mateixa finestra (el vídeo no torna a la pàgina)',
            continua.aLaFinestra && !continua.aLaPagina && continua.sona === continua.id && continua.estat === '1',
            continua
        );

        // Pausa i play des de la finestra
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

        // «Com aquesta»
        await clicPip(page, 'more');
        await page.waitForTimeout(400);
        const preferencia = await page.evaluate(() =>
            window.documentPictureInPicture.window.document
                .querySelector('[data-sp-action="more"]')
                .getAttribute('aria-pressed')
        );
        comprovar('«+ com aquesta» queda marcat', preferencia === 'true', preferencia);

        const obrir = async () => {
            await page.click('#playerMiniBtn');
            await page.waitForFunction(() => Boolean(window.documentPictureInPicture?.window), null, { timeout: 5000 });
            await page.waitForTimeout(700);
        };
        const estatPagina = () =>
            page.evaluate(() => {
                const player = document.getElementById('videoPlayer');
                const iframe = player?.querySelector('iframe');
                return {
                    obert: SegueixApp.features.systemPlayer.isPipOpen(),
                    classe:
                        document.body.classList.contains('is-system-pip') ||
                        document.body.classList.contains('is-video-pip'),
                    aLaPagina: Boolean(player && player.isConnected),
                    iframe: Boolean(iframe),
                    start: /[?&]start=\d+/.test(iframe?.src || ''),
                    utils: SegueixApp.utils.playerElement() === player,
                    boto: document.getElementById('playerMiniBtn').getAttribute('aria-pressed'),
                    mini: Boolean(player?.classList.contains('mini-player-active')),
                    estat: player?.dataset?.playerState,
                };
            });

        // El botó de sota (que amb la finestra oberta fa de «torna») tanca la finestra: el reproductor torna a la pàgina
        // i es reprèn al segon on era (start=…)
        await page.click('#playerMiniBtn');
        await page.waitForTimeout(1200);
        let tornat = await estatPagina();
        comprovar(
            'el botó de finestra flotant, amb la finestra oberta, la tanca («torna») i el vídeo torna a la pàgina',
            !tornat.obert &&
                !tornat.classe &&
                tornat.aLaPagina &&
                tornat.iframe &&
                tornat.utils &&
                tornat.boto === 'false',
            tornat
        );
        comprovar(
            'l’iframe es reprèn al segon on era (start=…), sona i no queda la finestreta de dins la pàgina',
            tornat.start && tornat.estat === '1' && !tornat.mini,
            tornat
        );

        // «Torna el vídeo aquí» (a la pàgina) fa el mateix
        await obrir();
        await page.click('#videoPipRestore');
        await page.waitForTimeout(1000);
        tornat = await estatPagina();
        comprovar(
            '«Torna el vídeo aquí» tanca la finestra i el vídeo torna a la pàgina',
            !tornat.obert && tornat.aLaPagina && tornat.iframe,
            tornat
        );

        // Navegar per l'app amb la finestra oberta: el vídeo no s'atura i la cua es manté
        await obrir();
        const abansNavegar = await sona(page);
        await page.evaluate(() => showHistory());
        await page.waitForTimeout(800);
        const navegat = await page.evaluate(() => ({
            obert: SegueixApp.features.systemPlayer.isVideoPipOpen(),
            iframe: Boolean(SegueixApp.utils.playerElement()?.querySelector('iframe')),
            estat: SegueixApp.utils.playerElement()?.dataset?.playerState,
            index: currentPlaylistIndex,
            cua: activePlaylistQueue.length,
        }));
        comprovar(
            'navegar a Historial amb la finestra oberta no atura el vídeo ni buida la cua',
            navegat.obert &&
                navegat.iframe &&
                navegat.estat === '1' &&
                navegat.index === abansNavegar.index &&
                navegat.cua > 1,
            navegat
        );

        // Pestanya amagada AMB la finestra oberta: el vídeo és visible allà, no es pausa res i la cua avança sola
        await page.evaluate(() => {
            window.__ordres = [];
            Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
        });
        await page.waitForTimeout(600);
        let amagada = await page.evaluate(() => ({
            ordres: window.__ordres.slice(),
            estat: SegueixApp.utils.playerElement()?.dataset?.playerState,
            obert: SegueixApp.features.systemPlayer.isVideoPipOpen(),
        }));
        comprovar(
            'amb la pestanya amagada i la finestra oberta, el vídeo continua (cap pausa) i la finestra no es tanca',
            !amagada.ordres.includes('pauseVideo') && amagada.estat === '1' && amagada.obert,
            amagada
        );
        const indexAmagada = await page.evaluate(() => currentPlaylistIndex);
        await page.evaluate(() => {
            const frame = SegueixApp.utils.playerElement().querySelector('iframe');
            frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: '__end', args: [] }), '*');
        });
        await page
            .waitForFunction(i => currentPlaylistIndex === i + 1, indexAmagada, { timeout: 6000 })
            .catch(() => {});
        await page.waitForTimeout(1500);
        amagada = await page.evaluate(
            i => ({
                avancada: currentPlaylistIndex === i + 1,
                estat: SegueixApp.utils.playerElement()?.dataset?.playerState,
                aLaFinestra: Boolean(
                    window.documentPictureInPicture?.window?.document
                        .getElementById('videoPlayer')
                        ?.querySelector('iframe')
                ),
            }),
            indexAmagada
        );
        comprovar(
            'amb la finestra oberta, en acabar la cançó la cua avança i la nova sona també amb la pestanya amagada',
            amagada.avancada && amagada.estat === '1' && amagada.aLaFinestra,
            amagada
        );
        await page.evaluate(() => {
            delete document.visibilityState;
            document.dispatchEvent(new Event('visibilitychange'));
        });

        // Tancar la finestra des d'una altra pàgina de l'app (Historial; en avançar la cua l'app havia tornat a la
        // fitxa de la cançó): el vídeo no té forat a la pàgina i es queda visible a la finestreta de dins, sonant
        await page.evaluate(() => showHistory());
        await page.waitForTimeout(600);
        await page.evaluate(() => window.documentPictureInPicture.window.close());
        await page.waitForTimeout(1200);
        const dinsPagina = await estatPagina();
        comprovar(
            'en tancar-la des d’Historial, el reproductor torna a la pàgina i es queda visible a la finestreta de dins',
            !dinsPagina.obert &&
                !dinsPagina.classe &&
                dinsPagina.aLaPagina &&
                dinsPagina.iframe &&
                dinsPagina.mini &&
                dinsPagina.start &&
                dinsPagina.estat === '1',
            dinsPagina
        );

        // Pàgina amagada/minimitzada SENSE finestra flotant: Segueix Música no facilita reproducció en segon pla
        await page.evaluate(() => {
            window.__ordres = [];
            Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
        });
        await page.waitForTimeout(500);
        const sensePip = await page.evaluate(() => ({
            ordres: window.__ordres.slice(),
            state: document.getElementById('videoPlayer')?.dataset?.playerState,
            pip: SegueixApp.features.systemPlayer.isPipOpen(),
        }));
        comprovar(
            'sense finestra flotant, amb Chrome minimitzat o la pestanya amagada, el reproductor rep pausa',
            sensePip.ordres.includes('pauseVideo') && sensePip.state === '2',
            sensePip
        );
        await page.evaluate(() => {
            delete document.visibilityState;
        });

        comprovar('cap error de JavaScript', errors.length === 0, errors);
        await context.close();
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\n✅ Tot correcte' : '\n❌ Hi ha errors');
    process.exit(correcte ? 0 : 1);
})();
