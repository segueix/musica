// Verificació en navegador real del play/pausa del reproductor (normal i flotant): res no cobreix el reproductor de
// YouTube (tots els tocs hi arriben) i els controls de l'app (anterior · play/pausa · següent · flotant · m'agrada) són a
// la barra de sota (#playerExternalControls); la finestra flotant només s'arrossega pel mànec de dalt (escriptori) i al
// mòbil va ancorada a baix. Restaurar i tancar no van damunt del vídeo (normes de YouTube): són a la barra de controls,
// que va enganxada sota la finestra flotant (al mòbil, petita i ancorada; a l'escriptori, la segueix).
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

// Abans hi havia controls de la cua damunt del vídeo: ja no se'n crea cap (syncQueueNextOverlay), però s'amaguen per
// si de cas abans de cada toc
const amagarControls = page => page.evaluate(() => hideQueueNextOverlay());

async function proves(browser, width, errors) {
    const etiqueta = width <= 768 ? `mòbil (${width} px)` : `escriptori (${width} px)`;
    const { context, page, mobile } = await novaPagina(browser, width, errors);

    // 1) Res damunt del vídeo (ni play/pausa propi, ni capa tàctil, ni controls de la cua): els controls són a la barra
    //    de sota (#playerExternalControls), sota el reproductor i sense tocar-lo
    const estructura = await page.evaluate(() => {
        const player = document.getElementById('videoPlayer').getBoundingClientRect();
        const bar = document.getElementById('playerExternalControls');
        const barBox = bar.getBoundingClientRect();
        return {
            damunt: document.querySelectorAll(
                '#videoPlayer :is(.queue-toggle-button, .queue-next-touch-layer, .queue-next-overlay)'
            ).length,
            visible: !bar.hidden && barBox.height > 0,
            sota: Math.round(barBox.top - player.bottom),
            botons: [...bar.querySelectorAll('button')].filter(button => !button.hidden).map(button => button.id),
        };
    });
    comprovar(
        `${etiqueta}: res damunt del vídeo; anterior · play/pausa · següent · flotant · m'agrada a la barra de sota`,
        estructura.damunt === 0 &&
            estructura.visible &&
            estructura.sota >= 0 &&
            estructura.botons.join() === 'playerPrevBtn,playerPlayPauseBtn,playerNextBtn,playerMiniBtn,playerLikeBtn',
        estructura
    );

    // 1b) La ràdio es diu amb una etiqueta dins la línia de data i visualitzacions (no amb una línia pròpia)
    const etiquetaRadio = await page.evaluate(() => {
        const chip = document.getElementById('playlistModeChip');
        const row = document.querySelector('#watchPage .video-meta-row');
        return {
            liniaAntiga: Boolean(document.getElementById('playlistModeBadge')),
            dinsLinia: Boolean(chip && row?.contains(chip)),
            text: chip?.textContent.trim() || '',
            unaLinia: row ? Math.round(row.getBoundingClientRect().height) <= 26 : false,
        };
    });
    comprovar(
        `${etiqueta}: «Ràdio · 1/N» és una etiqueta a la línia de data i visualitzacions, sense línia pròpia`,
        !etiquetaRadio.liniaAntiga &&
            etiquetaRadio.dinsLinia &&
            /^Ràdio · 1\/\d+$/.test(etiquetaRadio.text) &&
            etiquetaRadio.unaLinia,
        etiquetaRadio
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

    // 4) El centre és del botó de YouTube; els botons de la barra fan ≥ 44 px
    const centre = await page.evaluate(() => {
        const box = document.getElementById('videoPlayer').getBoundingClientRect();
        const el = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        const buttons = [...document.querySelectorAll('#playerExternalControls button:not([hidden])')].map(button => {
            const r = button.getBoundingClientRect();
            return { nom: button.id, w: Math.round(r.width), h: Math.round(r.height) };
        });
        return { alCentre: el?.tagName?.toLowerCase(), buttons };
    });
    comprovar(
        `${etiqueta}: al centre hi ha el reproductor (no cap botó nostre) i els botons de sota fan ≥ 44 px`,
        centre.alCentre === 'iframe' && centre.buttons.every(item => item.w >= 44 && item.h >= 44),
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
        boto: document.getElementById('playerPlayPauseBtn').getAttribute('aria-label'),
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
            enPausa.boto === 'Reprodueix' &&
            enBuffering.join() === 'pauseVideo' &&
            senseEstat.join() === 'playVideo',
        { enPausa, enBuffering, senseEstat }
    );

    // 5b) El botó de play/pausa de la barra envia l'ordre i canvia de símbol
    await page.evaluate(() => {
        window.__ordres.length = 0;
    });
    await page.click('#playerPlayPauseBtn');
    await page.waitForFunction(() => document.getElementById('videoPlayer').dataset.playerState === '2');
    const botoPausa = await page.evaluate(() => ({
        ordres: window.__ordres.slice(),
        boto: document.getElementById('playerPlayPauseBtn').getAttribute('aria-label'),
    }));
    await page.click('#playerPlayPauseBtn');
    await page.waitForFunction(() => document.getElementById('videoPlayer').dataset.playerState === '1');
    const botoPlay = await page.evaluate(() =>
        document.getElementById('playerPlayPauseBtn').getAttribute('aria-label')
    );
    comprovar(
        `${etiqueta}: el play/pausa de la barra pausa i reprèn`,
        botoPausa.ordres.join() === 'pauseVideo' && botoPausa.boto === 'Reprodueix' && botoPlay === 'Pausa',
        { botoPausa, botoPlay }
    );

    // 5c) Si YouTube no envia l'avís d'estat (o arriba tard), el botó canvia igualment en tocar-lo i el toc següent fa
    //     el contrari: pausa → play → pausa, amb les ordres pauseVideo, playVideo, pauseVideo
    await page.evaluate(() => {
        // Tots els avisos del reproductor entren per SegueixApp.features.player.handleYouTubeMessage: s'hi descarten els
        // d'estat (onStateChange, infoDelivery) com si YouTube no els enviés
        const player = SegueixApp.features.player;
        window.__handleOriginal = player.handleYouTubeMessage;
        player.handleYouTubeMessage = event => {
            let dades = event.data;
            if (typeof dades === 'string') {
                try {
                    dades = JSON.parse(dades);
                } catch (_) {
                    dades = null;
                }
            }
            if (dades?.event === 'onStateChange' || dades?.event === 'infoDelivery') return undefined;
            return window.__handleOriginal(event);
        };
        window.__ordres.length = 0;
    });
    const senseAvis = [];
    for (let i = 0; i < 3; i += 1) {
        await page.click('#playerPlayPauseBtn');
        await page.waitForTimeout(250);
        senseAvis.push(
            await page.evaluate(() => {
                const button = document.getElementById('playerPlayPauseBtn');
                const visible = [...button.querySelectorAll('svg')].find(
                    svg => getComputedStyle(svg).display !== 'none'
                );
                return `${button.getAttribute('aria-label')}:${visible?.classList.contains('pec-icon--play') ? 'play' : 'pausa'}`;
            })
        );
    }
    const ordresSenseAvis = await page.evaluate(() => {
        SegueixApp.features.player.handleYouTubeMessage = window.__handleOriginal;
        return window.__ordres.filter(ordre => ordre === 'playVideo' || ordre === 'pauseVideo');
    });
    comprovar(
        `${etiqueta}: sense avís d'estat de YouTube, el botó canvia a cada toc (pausa → play → pausa) i torna a fer sonar`,
        senseAvis.join() === 'Reprodueix:play,Pausa:pausa,Reprodueix:play' &&
            ordresSenseAvis.join() === 'pauseVideo,playVideo,pauseVideo',
        { senseAvis, ordresSenseAvis }
    );
    // Torna a sonar per a la resta de proves
    await page.evaluate(() => playMainPlayer());
    await page.waitForFunction(() => document.getElementById('videoPlayer').dataset.playerState === '1');

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
        return {
            ancorada: window.innerWidth <= 768,
            box: [Math.round(box.left), Math.round(box.top), Math.round(box.width), Math.round(box.height)],
            video: [at(0.5, 0.5), at(0.2, 0.9), at(0.8, 0.6), at(0.5, 0.35)],
            dalt: at(0.5, 0.06),
            mànec: getComputedStyle(handle).display === 'none' ? null : Math.round(handleBox.height),
            // Restaurar i tancar ja no van damunt del vídeo (normes de YouTube): cap botó dins del reproductor
            botonsDamunt: player.querySelectorAll('button').length,
            controls: (() => {
                const bar = document.getElementById('playerExternalControls');
                const r = bar.getBoundingClientRect();
                const nav = document.getElementById('ptBottomNav')?.getBoundingClientRect();
                return {
                    docked: bar.classList.contains('is-docked'),
                    floating: bar.classList.contains('is-floating'),
                    left: Math.round(r.left - box.left),
                    sota: Math.round(r.top - box.bottom),
                    sobreNav: nav && nav.height ? Math.round(nav.top - r.bottom) : null,
                    w: Math.round(r.width),
                    ids: [...bar.querySelectorAll('button:not([hidden])')].map(b => b.id),
                    botons: [...bar.querySelectorAll('button:not([hidden])')].map(b =>
                        Math.round(b.getBoundingClientRect().width)
                    ),
                };
            })(),
        };
    });
    comprovar(
        `${etiqueta}: a la finestra flotant el vídeo (centre, baix, dreta) és del reproductor de YouTube`,
        mini.video.every(id => id === 'iframe.'),
        mini.video
    );
    if (mobile) {
        comprovar(
            `${etiqueta}: la finestra va ancorada a baix, sense mànec ni cap botó damunt del vídeo`,
            mini.mànec === null &&
                mini.dalt === 'iframe.' &&
                mini.botonsDamunt === 0 &&
                mini.box[0] === 0 &&
                mini.box[2] === width,
            mini
        );
        comprovar(
            `${etiqueta}: els controls van petits enganxats sota la finestra flotant, damunt de la navegació`,
            mini.controls.docked &&
                Math.abs(mini.controls.sota) <= 1 &&
                Math.abs(mini.controls.sobreNav) <= 1 &&
                mini.controls.w === width &&
                mini.controls.ids.join() ===
                    'playerPrevBtn,playerPlayPauseBtn,playerNextBtn,playerMiniBtn,playerLikeBtn,playerCloseBtn' &&
                mini.controls.botons.every(w => w >= 40 && w < 52),
            mini.controls
        );
    } else {
        comprovar(
            `${etiqueta}: només hi ha un mànec de 36 px a dalt per arrossegar i cap botó damunt del vídeo`,
            mini.mànec === 36 && /drag-surface/.test(mini.dalt) && mini.botonsDamunt === 0,
            { mànec: mini.mànec, dalt: mini.dalt, botonsDamunt: mini.botonsDamunt }
        );
        comprovar(
            `${etiqueta}: els controls (amb restaura i tanca) van enganxats sota la finestra flotant, amb la seva amplada`,
            mini.controls.docked &&
                mini.controls.floating &&
                mini.controls.left === 0 &&
                Math.abs(mini.controls.sota) <= 1 &&
                Math.abs(mini.controls.w - mini.box[2]) <= 1 &&
                mini.controls.ids.includes('playerCloseBtn'),
            mini.controls
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
        await page.waitForTimeout(300);
        const barra = await page.evaluate(() => {
            const r = document.getElementById('playerExternalControls').getBoundingClientRect();
            const p = document.getElementById('videoPlayer').getBoundingClientRect();
            return { left: Math.round(r.left - p.left), sota: Math.round(r.top - p.bottom) };
        });
        comprovar(
            `${etiqueta}: en arrossegar la finestra, la barra de controls la segueix`,
            barra.left === 0 && Math.abs(barra.sota) <= 1,
            barra
        );
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

    // 6d) Escriptori: amb la finestra estreta (redimensionada) contra la vora dreta, la barra no s'encongeix i «restaura» i
    //     «tanca» queden dins la pantalla
    if (!mobile) {
        await page.evaluate(() => {
            const player = document.getElementById('videoPlayer');
            player.style.transition = 'none';
            player.style.width = '210px';
            player.style.height = '118px';
            player.style.left = `${window.innerWidth - 210}px`;
            player.style.top = '200px';
        });
        await page.waitForTimeout(300);
        const estreta = await page.evaluate(() => {
            const bar = document.getElementById('playerExternalControls').getBoundingClientRect();
            const dins = id => {
                const r = document.getElementById(id).getBoundingClientRect();
                return r.left >= 0 && r.right <= window.innerWidth;
            };
            return {
                barra: [Math.round(bar.left), Math.round(bar.right), window.innerWidth],
                restaura: dins('playerMiniBtn'),
                tanca: dins('playerCloseBtn'),
            };
        });
        comprovar(
            `${etiqueta}: amb la finestra estreta a la vora, la barra cap a la pantalla amb «restaura» i «tanca»`,
            estreta.barra[1] <= estreta.barra[2] && estreta.barra[0] >= 0 && estreta.restaura && estreta.tanca,
            estreta
        );
    }

    // 7) «Següent» de la barra funciona amb la finestra flotant (al mòbil, la barra enganxada a sota)
    await page.evaluate(() => pauseMainPlayer());
    await page.waitForFunction(() => document.getElementById('videoPlayer').dataset.playerState === '2');
    await page.waitForTimeout(400);
    const abansIndex = await page.evaluate(() => currentPlaylistIndex);
    await page.click('#playerNextBtn');
    await page.waitForTimeout(500);
    const despresIndex = await page.evaluate(() => currentPlaylistIndex);
    comprovar(`${etiqueta}: «següent» de la barra funciona amb la finestra flotant`, despresIndex === abansIndex + 1, {
        abansIndex,
        despresIndex,
    });

    // 8) Restaurar des de la barra: la finestra torna al seu lloc i la barra, sota el reproductor
    {
        await page.click('#playerMiniBtn');
        await page.waitForTimeout(700);
        const restaurat = await page.evaluate(() => {
            const bar = document.getElementById('playerExternalControls');
            return {
                mini: isMiniPlayerActive(),
                docked: bar.classList.contains('is-docked'),
                aLaFitxa: Boolean(bar.closest('#watchPage .watch-main')),
                tanca: !document.getElementById('playerCloseBtn').hidden,
            };
        });
        comprovar(
            `${etiqueta}: «restaura» de la barra torna el reproductor i la barra al seu lloc (sense «tanca»)`,
            !restaurat.mini && !restaurat.docked && restaurat.aLaFitxa && !restaurat.tanca,
            restaurat
        );
    }

    // 9) «Tanca» de la barra tanca la finestra flotant
    await page.evaluate(() => setMiniPlayerState(true, { trigger: 'test' }));
    await page.waitForTimeout(500);
    await page.click('#playerCloseBtn');
    await page.waitForTimeout(600);
    const tancat = await page.evaluate(() => ({
        mini: isMiniPlayerActive(),
        iframe: Boolean(document.querySelector('#videoPlayer iframe')),
        barra: document.getElementById('playerExternalControls').hidden,
    }));
    comprovar(
        `${etiqueta}: «tanca» de la barra tanca la finestra flotant i amaga la barra`,
        !tancat.mini && !tancat.iframe && tancat.barra,
        tancat
    );

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
