// Verificació end-to-end de l'experiència TV en un navegador real (Chromium).
//
// NO forma part de `npm test` (que és Vitest, sense navegador). És una eina opt-in,
// com verificar-reproductor.js: el comportament que cobreix depèn del layout real
// (el reproductor es col·loca damunt del seu forat, el header es col·lapsa amb una
// transició, la cua es torna a pintar a cada canvi de vídeo).
//
// Requisits (no són dependències del projecte):
//   npm i -D playwright-core      # client de Playwright (no baixa navegadors)
//   Un binari de Chromium accessible; si no és a la ubicació per defecte de Playwright,
//   indica'l amb CHROMIUM_PATH=/ruta/al/chrome
//
// Ús:  node tests/browser/verificar-tv.js          (mòbil)
//      TV_TEST_DESKTOP=1 node tests/browser/verificar-tv.js
//
// Comprova, en engegar una TV i en cada canvi automàtic de vídeo:
//   1) La vista salta a la part superior i el vídeo es veu de seguida al seu lloc,
//      sense surar per damunt del header mentre el layout s'assenta.
//   2) El reproductor no queda mai en finestreta flotant.
//   3) En acabar un vídeo, la vista es manté a la part superior mentre s'espera que
//      el vídeo nou comenci.
//   4) Un gest d'scroll de l'usuari mana per damunt de l'ancoratge.
//   5) Si s'està mirant en pantalla completa, el vídeo següent hi continua: el reproductor
//      no es recrea, se li demana el vídeo nou. I si no respon, la xarxa de seguretat el
//      recarrega sense sortir tampoc de la pantalla completa.
//   6) Els programes creats per l'usuari tenen botó TV i generen la seva televisió encara
//      que el canal sigui un mitjà, un digital o una entitat.
//
// Per a (5) cal un reproductor que respongui: YouTube no es pot carregar en aquest entorn,
// així que se serveix un succedani local a la mateixa URL d'embed que parla el mateix
// protocol de postMessage (handshake `listening`, `onStateChange`, `loadVideoById`).

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.TV_TEST_PORT || 8142);
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const DESKTOP = process.env.TV_TEST_DESKTOP === '1';

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

// Succedani del reproductor de YouTube: parla el mateix protocol de postMessage que
// escolta `handleYouTubeMessage()`. Admet dos senyals del test: `__end__` (el vídeo
// s'acaba) i `__mute__` (deixa d'atendre `loadVideoById`, per provar la xarxa de seguretat).
const STUB_PLAYER = `<!doctype html><html lang="ca"><head><meta charset="utf-8"><title>stub</title>
<style>html,body{margin:0;height:100%;background:#123;color:#fff;font:16px sans-serif}
#stage{height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px}
button{font-size:22px;padding:10px 16px}</style></head><body>
<div id="stage"><p id="vid"></p><button id="fsbtn" type="button">pantalla completa</button></div>
<script>
let videoId = decodeURIComponent(location.pathname.split('/').pop() || '');
let sord = false;
window.__carregats = [];
function enviarEstat(info) {
    parent.postMessage(JSON.stringify({ event: 'onStateChange', info, id: 'catube-player' }), '*');
}
function pintar() { document.getElementById('vid').textContent = videoId; }
pintar();
setTimeout(() => enviarEstat(1), 150);
window.addEventListener('message', event => {
    if (event.data === '__end__') { enviarEstat(0); return; }
    if (event.data === '__mute__') { sord = true; return; }
    let dades = event.data;
    if (typeof dades === 'string') { try { dades = JSON.parse(dades); } catch (_) { return; } }
    if (dades && dades.event === 'command' && dades.func === 'loadVideoById' && !sord) {
        videoId = String((dades.args || [])[0] || '');
        window.__carregats.push(videoId);
        pintar();
        enviarEstat(3);
        setTimeout(() => enviarEstat(1), 120);
    }
});
document.getElementById('fsbtn').addEventListener('click', () => {
    // Com fa YouTube: el reproductor demana la pantalla completa del seu propi contingut.
    document.getElementById('stage').requestFullscreen();
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

// Relació entre el reproductor, el seu forat i la posició de la pàgina.
function llegirEstat(page) {
    return page.evaluate(() => {
        const player = document.getElementById('videoPlayer');
        const holder = document.getElementById('videoPlaceholder');
        const p = player?.getBoundingClientRect();
        const h = holder?.getBoundingClientRect();
        return {
            scrollY: Math.round(window.scrollY || 0),
            modeTV: document.body.classList.contains('segueix-tv-playback'),
            flotant: player?.classList.contains('mini-player-active') ?? null,
            visible: Boolean(player) && getComputedStyle(player).display !== 'none' && p.width > 0,
            // Píxels que el reproductor està desplaçat respecte del seu forat.
            desfase: p && h ? Math.round(p.top - h.top) : null,
            titol: (document.getElementById('videoTitle')?.textContent || '').trim(),
        };
    });
}

// Mostreja la transició sencera: el desfase només es veu mentre el layout s'assenta.
async function seguirTransicio(page, mostres = 22, pas = 60) {
    let pitjorDesfase = 0;
    let pitjorScroll = 0;
    let flotantEnCapMoment = false;
    for (let i = 0; i < mostres; i += 1) {
        await page.waitForTimeout(pas);
        const estat = await llegirEstat(page);
        if (Math.abs(estat.desfase ?? 0) > Math.abs(pitjorDesfase)) pitjorDesfase = estat.desfase;
        if ((estat.scrollY ?? 0) > pitjorScroll) pitjorScroll = estat.scrollY;
        if (estat.flotant) flotantEnCapMoment = true;
    }
    return { pitjorDesfase, pitjorScroll, flotantEnCapMoment };
}

async function engegarTVdeCategoria(page) {
    const teBoto = await page.evaluate(() => Boolean(document.querySelector('[data-context-tv="category"]')));
    if (!teBoto) return false;
    await page.evaluate(() => document.querySelector('[data-context-tv="category"]').click());
    return true;
}

(async () => {
    const server = await serve();
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
    const context = await browser.newContext(
        DESKTOP
            ? { viewport: { width: 1440, height: 900 } }
            : {
                  viewport: { width: 412, height: 915 },
                  deviceScaleFactor: 2.6,
                  isMobile: true,
                  hasTouch: true,
                  userAgent:
                      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/536.36',
              }
    );
    // Consentiment acceptat: el reproductor es carrega sense passar pel modal. I un
    // programa de prova d'Esports IB3, que al feed és de categoria "mitjans": és el cas
    // que la descoberta exclou i que, en canvi, sí que ha de tenir la seva TV.
    await context.addInitScript(() => {
        localStorage.setItem(
            'segueix_cookie_consent_v2',
            JSON.stringify({ version: 1, status: 'accepted', source: 'test', updatedAt: new Date().toISOString() })
        );
        localStorage.setItem(
            'catube_programs',
            JSON.stringify([
                {
                    id: 'prog_test_pinyol',
                    channelId: 'UCOmWJETLyAlFrHkmccOQ-3w',
                    name: 'De pinyol vermell',
                    description: 'Programa de prova',
                    createdAt: Date.now(),
                    customCategories: [],
                },
            ])
        );
    });

    const page = await context.newPage();
    // Els iframes i les miniatures de YouTube no es poden carregar aquí.
    await page.route('**://*.youtube*.com/**', route => route.abort());
    await page.route('**://*.ytimg.com/**', route => route.abort());

    let correcte = true;
    const comprovar = (etiqueta, condicio, detall) => {
        console.log(`${condicio ? '✅' : '❌'} ${etiqueta} ${detall ? JSON.stringify(detall) : ''}`);
        if (!condicio) correcte = false;
    };

    try {
        await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#videosGrid .video-card', { timeout: 30000 });
        await page.waitForTimeout(1500);

        // 1) L'usuari ha baixat pel feed i engega la TV de la categoria activa.
        await page.evaluate(() => window.scrollTo(0, 1200));
        await page.waitForTimeout(400);
        const engegada = await engegarTVdeCategoria(page);
        comprovar('El botó TV de la categoria és a la pàgina', engegada);

        const obertura = await seguirTransicio(page);
        comprovar(
            'En engegar la TV el vídeo es veu de seguida al seu lloc, sense surar',
            Math.abs(obertura.pitjorDesfase) <= 4 && !obertura.flotantEnCapMoment,
            obertura
        );
        comprovar('La vista queda a la part superior', obertura.pitjorScroll === 0, {
            pitjorScroll: obertura.pitjorScroll,
        });

        const primer = await llegirEstat(page);
        comprovar('El mode TV és actiu amb el vídeo visible', primer.modeTV && primer.visible, {
            modeTV: primer.modeTV,
            visible: primer.visible,
            titol: primer.titol.slice(0, 40),
        });

        // 2) El vídeo s'acaba: la vista no s'ha de moure de la part superior mentre
        //    s'espera que arrenqui el següent.
        await page.evaluate(() => handlePlaylistVideoEnded());
        const avanc = await seguirTransicio(page, 20);
        const seguent = await llegirEstat(page);
        comprovar(
            'En acabar el vídeo la vista es manté a la part superior',
            avanc.pitjorScroll === 0 && Math.abs(avanc.pitjorDesfase) <= 4 && !avanc.flotantEnCapMoment,
            avanc
        );
        comprovar('El vídeo nou ocupa el reproductor', seguent.titol !== primer.titol && seguent.visible, {
            abans: primer.titol.slice(0, 30),
            ara: seguent.titol.slice(0, 30),
        });

        // 3) Un gest d'scroll de l'usuari mana per damunt de l'ancoratge.
        await page.evaluate(() => handlePlaylistVideoEnded());
        await page.waitForTimeout(200);
        const objectiu = await page.evaluate(() => {
            const maxim = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
            const desti = Math.min(400, maxim);
            window.dispatchEvent(new WheelEvent('wheel', { deltaY: 200, bubbles: true }));
            window.scrollTo(0, desti);
            return desti;
        });
        await page.waitForTimeout(1200);
        const desprésDelGest = await llegirEstat(page);
        comprovar(
            "Un gest d'scroll de l'usuari es respecta durant l'espera",
            objectiu === 0 || desprésDelGest.scrollY >= objectiu - 8,
            { objectiu, scrollY: desprésDelGest.scrollY }
        );

        // 4) Arribar a la TV des d'un vídeo que es veia en finestreta flotant.
        await page.evaluate(() => exitPlaylistMode());
        await page.evaluate(() => document.querySelector('.nav-item')?.click());
        await page.waitForTimeout(1200);
        await page.evaluate(() => document.querySelector('#videosGrid .video-card')?.click());
        await page.waitForTimeout(1800);
        await page.evaluate(() => document.querySelector('.play-overlay')?.click());
        await page.waitForTimeout(600);
        await page.evaluate(() => window.scrollTo(0, 1600));
        await page.waitForTimeout(900);
        const flotant = await llegirEstat(page);
        comprovar('Fora de la TV la finestreta flotant continua funcionant', flotant.flotant === true, {
            flotant: flotant.flotant,
        });

        await page.evaluate(() => document.querySelector('.nav-item')?.click());
        await page.waitForTimeout(1200);
        await engegarTVdeCategoria(page);
        const desDelFlotant = await seguirTransicio(page);
        const finalFlotant = await llegirEstat(page);
        comprovar(
            'En engegar la TV des de la finestreta flotant el vídeo torna al seu lloc',
            !desDelFlotant.flotantEnCapMoment &&
                finalFlotant.flotant === false &&
                Math.abs(desDelFlotant.pitjorDesfase) <= 4 &&
                desDelFlotant.pitjorScroll === 0,
            desDelFlotant
        );
        // 5) Pantalla completa: el vídeo següent hi ha de continuar.
        //    A partir d'aquí el reproductor és el succedani local, que sí que respon.
        // Playwright avalua les rutes en ordre invers al d'addició: el succedani de
        // l'embed s'ha de registrar DESPRÉS del bloqueig general perquè hi passi al davant.
        await page.unroute('**://*.youtube*.com/**');
        await page.route('**://*.youtube*.com/**', route => route.abort());
        await page.route('**://*.youtube*.com/embed/**', route =>
            route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: STUB_PLAYER })
        );

        await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#videosGrid .video-card', { state: 'attached', timeout: 30000 });
        await page.waitForTimeout(1500);
        // En recarregar, l'app pot restaurar la pàgina del reproductor: tornem a Inici
        // perquè hi hagi el botó TV de la categoria.
        await page.evaluate(() => {
            if (!document.getElementById('watchPage')?.classList.contains('hidden')) {
                document.querySelector('.nav-item')?.click();
            }
        });
        await page.waitForTimeout(1200);
        await engegarTVdeCategoria(page);
        await page.waitForSelector('#videoPlayer iframe', { timeout: 20000 });
        await page.waitForTimeout(1200);

        // L'usuari entra en pantalla completa des dels controls del reproductor (gest real).
        await page.frameLocator('#videoPlayer iframe').locator('#fsbtn').click();
        await page.waitForTimeout(700);
        // Marca per saber si l'iframe sobreviu o es recrea.
        await page.evaluate(() => {
            document.querySelector('#videoPlayer iframe')?.setAttribute('data-prova', 'original');
        });

        const llegirPantallaCompleta = () =>
            page.evaluate(() => {
                const player = document.getElementById('videoPlayer');
                const element = document.fullscreenElement;
                return {
                    enPantallaCompleta: Boolean(element) && (element === player || player?.contains(element)),
                    element: element ? element.id || element.tagName.toLowerCase() : null,
                    mateixIframe: document.querySelector('#videoPlayer iframe')?.dataset.prova === 'original',
                    titol: (document.getElementById('videoTitle')?.textContent || '').trim(),
                };
            });

        const abansDAcabar = await llegirPantallaCompleta();
        comprovar('El reproductor entra en pantalla completa', abansDAcabar.enPantallaCompleta, abansDAcabar);

        // El vídeo s'acaba de debò: l'estat 0 arriba des del reproductor.
        await page.evaluate(() => {
            document.querySelector('#videoPlayer iframe')?.contentWindow.postMessage('__end__', '*');
        });
        await page.waitForTimeout(2000);

        const desprésDAcabar = await llegirPantallaCompleta();
        const encadenats = await page
            .frameLocator('#videoPlayer iframe')
            .locator('#vid')
            .textContent()
            .catch(() => '');
        comprovar(
            'En acabar el vídeo la pantalla completa es manté, amb el mateix reproductor',
            desprésDAcabar.enPantallaCompleta && desprésDAcabar.mateixIframe,
            desprésDAcabar
        );
        comprovar(
            'El reproductor ha carregat el vídeo següent sense recrear-se',
            Boolean(encadenats) && encadenats !== abansDAcabar.titol,
            { videoAlReproductor: encadenats }
        );
        comprovar(
            "La pàgina de sota també s'ha actualitzat",
            desprésDAcabar.titol !== abansDAcabar.titol,
            { abans: abansDAcabar.titol.slice(0, 30), ara: desprésDAcabar.titol.slice(0, 30) }
        );

        // Xarxa de seguretat: el reproductor deixa d'atendre `loadVideoById`.
        await page.evaluate(() => {
            document.querySelector('#videoPlayer iframe')?.contentWindow.postMessage('__mute__', '*');
        });
        await page.waitForTimeout(2200);
        await page.evaluate(() => {
            document.querySelector('#videoPlayer iframe')?.contentWindow.postMessage('__end__', '*');
        });
        await page.waitForTimeout(4000);

        const desprésDelFallback = await llegirPantallaCompleta();
        comprovar(
            'Si el reproductor no respon, es recarrega sense sortir de la pantalla completa',
            desprésDelFallback.enPantallaCompleta && !desprésDelFallback.mateixIframe,
            desprésDelFallback
        );
        // 6) Programes creats per l'usuari: botó TV i televisió pròpia, encara que el
        //    canal sigui un mitjà, un digital o una entitat.
        await page.evaluate(() => {
            if (document.fullscreenElement) document.exitFullscreen?.();
        });
        await page.waitForTimeout(500);
        await page.evaluate(() => exitPlaylistMode());
        await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#videosGrid .video-card', { state: 'attached', timeout: 30000 });
        await page.waitForTimeout(1500);

        // Pàgina "Seguint" → pestanya "Programes"
        await page.evaluate(() => {
            document.querySelector('.nav-item[data-page="follow"], [data-page="follow"]')?.click();
        });
        await page.waitForTimeout(900);
        await page.evaluate(() => document.querySelector('[data-follow-tab="programes"]')?.click());
        await page.waitForTimeout(900);

        const targeta = await page.evaluate(() => {
            // L'app porta programes per defecte: cal la targeta del programa de prova.
            const card = document.querySelector('.follow-card--program[data-program-id="prog_test_pinyol"]');
            return {
                hiHaTargeta: Boolean(card),
                teBotoTV: Boolean(card?.querySelector('[data-context-tv="program"]')),
                esMitja: Boolean(
                    window.SegueixApp?.features?.segueixTV?.isNonYoutuber?.('UCOmWJETLyAlFrHkmccOQ-3w')
                ),
            };
        });
        comprovar(
            'El canal del programa és dels que la descoberta exclou (mitjans/digitals/entitats)',
            targeta.esMitja,
            { esMitja: targeta.esMitja }
        );
        comprovar('La targeta del programa mostra el botó TV', targeta.hiHaTargeta && targeta.teBotoTV, targeta);

        // El botó de la targeta engega la TV directament, sense obrir el perfil.
        await page.evaluate(() => {
            document
                .querySelector('.follow-card--program[data-program-id="prog_test_pinyol"] [data-context-tv="program"]')
                ?.click();
        });
        await page.waitForTimeout(4000);
        const desDeLaTargeta = await page.evaluate(() => ({
            modeTV: document.body.classList.contains('segueix-tv-playback'),
            alReproductor: !document.getElementById('watchPage')?.classList.contains('hidden'),
            perfilObert: !document.getElementById('channelPage')?.classList.contains('hidden'),
            nom: typeof activePlaylistName !== 'undefined' ? activePlaylistName : '',
        }));
        comprovar(
            'El botó de la targeta engega la TV del programa sense obrir el perfil',
            desDeLaTargeta.modeTV &&
                desDeLaTargeta.alReproductor &&
                !desDeLaTargeta.perfilObert &&
                desDeLaTargeta.nom === 'De pinyol vermell · TV',
            desDeLaTargeta
        );

        await page.evaluate(() => exitPlaylistMode());
        await page.waitForTimeout(300);

        // Perfil del programa: hi ha d'anar el botó del programa, no el del canal sencer.
        await page.evaluate(() => openProgramProfile('prog_test_pinyol'));
        await page.waitForTimeout(1500);
        const perfil = await page.evaluate(() => {
            const row = document.querySelector('.channel-profile-title-row');
            return {
                botoPrograma: row?.querySelector('[data-context-tv="program"]')?.dataset.contextValue || null,
                botoCanal: Boolean(row?.querySelector('[data-context-tv="channel"]')),
                nom: document.getElementById('channelProfileName')?.textContent || '',
            };
        });
        comprovar(
            'El perfil del programa mostra el botó TV del programa (i no el del canal)',
            perfil.botoPrograma === 'prog_test_pinyol' && !perfil.botoCanal,
            perfil
        );

        // Engegar la TV del programa.
        await page.evaluate(() => {
            document.querySelector('.channel-profile-title-row [data-context-tv="program"]')?.click();
        });
        // La cua inclou l'arxiu del canal, que es descarrega: s'espera que hi arribi.
        await page
            .waitForFunction(
                () => {
                    const cua = typeof activePlaylistQueue !== 'undefined' ? activePlaylistQueue : [];
                    const nom = typeof activePlaylistName !== 'undefined' ? activePlaylistName : '';
                    return nom === 'De pinyol vermell · TV' && cua.length >= 5;
                },
                { timeout: 20000 }
            )
            .catch(() => {});
        const tvPrograma = await page.evaluate(() => {
            // Les globals d'app.js són `let` al scope lèxic: no són propietats de window.
            const estat = window.SegueixApp?.state || {};
            const cuaGlobal = typeof activePlaylistQueue !== 'undefined' ? activePlaylistQueue : null;
            const cua = Array.isArray(cuaGlobal) ? cuaGlobal : estat.playlists?.activeQueue || [];
            const normalitza = text =>
                String(text || '')
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .toLowerCase();
            return {
                modeTV: document.body.classList.contains('segueix-tv-playback'),
                nom:
                    (typeof activePlaylistName !== 'undefined' ? activePlaylistName : '') ||
                    estat.playlists?.activePlaylistName ||
                    '',
                total: cua.length,
                totsDelPrograma: cua.every(video => normalitza(video?.title).includes('pinyol vermell')),
            };
        });
        comprovar(
            'La TV del programa s’engega amb els episodis del programa',
            tvPrograma.modeTV && tvPrograma.total >= 5 && tvPrograma.totsDelPrograma,
            tvPrograma
        );
    } catch (error) {
        console.log('❌ La verificació ha fallat:', error.message);
        correcte = false;
    }

    console.log(correcte ? '\n✅ Experiència TV correcta' : '\n❌ Hi ha comprovacions que fallen');

    await browser.close();
    server.close();
    process.exit(correcte ? 0 : 1);
})();
