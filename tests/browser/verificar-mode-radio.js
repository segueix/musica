// Verificació en navegador real del mode de descoberta dins de cada ràdio: el selector (Els meus de sempre / Una mica
// de tot / Sorprèn-me) és a la capçalera, i en canviar-lo la llista pendent es renova d'immediat i es veu què ha canviat.
//
// NO forma part de `npm test`: és una eina opt-in. Requisits: playwright-core i un Chromium (CHROMIUM_PATH).
// Ús:  node tests/browser/verificar-mode-radio.js     (MUSICA_TEST_SHOTS=/ruta per desar captures)

const http = require('http');
const { ambGustRecent } = require('./gust-recent');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.MUSICA_TEST_PORT || 8148);
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.MUSICA_TEST_SHOTS || '';

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
        viewport: { width, height: 900 },
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
    await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, route =>
        /youtube(-nocookie)?\.com/.test(route.request().url())
            ? route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>embed</title>' })
            : route.abort()
    );
    page.on('pageerror', error => errors.push(error.message));
    return { context, page };
}

async function obrir(page) {
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
    await page.waitForTimeout(500);
}

// Historial de 30 cançons de 30 artistes diferents (i 6 seguits): n'hi ha prou perquè el mode es pugui aplicar (≥ 3
// coneguts) i perquè els límits per artista no n'amaguin l'efecte.
async function sembrarHistorial(page) {
    return page.evaluate(() => {
        const vistos = new Set();
        const songs = [];
        for (const video of currentFeedVideos) {
            if (video.contentType !== 'song' || video.isShort || !video.thumbnail || vistos.has(video.channelId))
                continue;
            vistos.add(video.channelId);
            songs.push(video);
            if (songs.length === 30) break;
        }
        const now = Date.now();
        const history = songs.map((video, index) => ({
            ...video,
            viewedAt: new Date(now - (index + 1) * 36e5).toISOString(),
        }));
        localStorage.setItem('catube_history', JSON.stringify(history));
        localStorage.setItem('catube_follows', JSON.stringify(songs.slice(0, 6).map(video => video.channelId)));
        return songs.map(video => video.channelId);
    });
}

const captura = async (page, nom) => {
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${nom}.png`) });
};

const estatRadio = page =>
    page.evaluate(() => {
        const queue = SegueixApp.features.musicQueue;
        return {
            actual: String(activePlaylistQueue[currentPlaylistIndex]?.id || ''),
            pendents: activePlaylistQueue.slice(currentPlaylistIndex + 1).map(item => String(item.id)),
            canals: activePlaylistQueue.slice(currentPlaylistIndex + 1).map(item => String(item.channelId)),
            aplicat: queue.getAppliedMode(),
            global: localStorage.getItem('catube_discovery_mode'),
        };
    });

const fraccioConeguda = (estat, coneguts) => estat.canals.filter(id => coneguts.has(id)).length / estat.canals.length;

async function main() {
    const server = await serve();
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] });
    const errors = [];
    try {
        // ---- Escriptori ----
        let { context, page } = await novaPagina(browser, 1440, errors);
        await obrir(page);
        const coneguts = new Set(await sembrarHistorial(page));
        await page.goto('about:blank');
        await obrir(page);
        await ambGustRecent(page);
        // «La teva ràdio» ja no té modes (2026-10-20): el selector es prova amb la ràdio d'un estil
        await page.evaluate(() => SegueixApp.features.musicQueue.startStyleRadio(['Pop']));
        await page.waitForSelector('.mq--radio .mq-head .mq-mode', { timeout: 20000 });
        await page.waitForTimeout(800);

        const selector = await page.evaluate(() => {
            const opcions = [...document.querySelectorAll('.mq-head .mq-mode [data-mq-mode]')].map(button => {
                const box = button.getBoundingClientRect();
                return {
                    id: button.dataset.mqMode,
                    text: button.textContent.trim(),
                    actiu: button.getAttribute('aria-checked'),
                    alt: Math.round(box.height),
                };
            });
            const head = document.querySelector('.mq-head');
            return {
                opcions,
                grup: document.querySelector('.mq-mode [role="radiogroup"]')?.getAttribute('aria-label'),
                aCapcalera: !!head.querySelector('.mq-mode'),
                hint: document.querySelector('.mq-mode__hint')?.textContent.trim(),
                aCasa: /A casa/.test(document.body.textContent),
            };
        });
        comprovar(
            'cada ràdio porta el selector de mode a la capçalera, amb les quatre opcions i «Una mica de tot» actiu',
            selector.aCapcalera &&
                selector.opcions.map(item => item.text).join('|') === 'Els meus de sempre|Una mica de tot|Sorprèn-me|Fora del meu radar' &&
                selector.opcions
                    .filter(item => item.actiu === 'true')
                    .map(item => item.id)
                    .join() === 'mix' &&
                selector.opcions.every(item => item.alt >= 44) &&
                selector.grup === 'Quant vols descobrir?' &&
                !selector.aCasa,
            selector
        );
        await captura(page, 'mode-radio-escriptori');

        const abans = await estatRadio(page);
        await page.evaluate(() => {
            // Una cançó afegida a mà abans de canviar de mode: ha de continuar a la cua
            const song = currentFeedVideos.find(
                video =>
                    video.contentType === 'song' &&
                    !video.isShort &&
                    !activePlaylistQueue.some(item => item.id === video.id)
            );
            window.__afegida = String(song.id);
            SegueixApp.features.musicQueue.enqueue(song);
        });
        await page.waitForTimeout(300);

        // «Sorprèn-me»
        await page.click('[data-mq-mode="surprise"]');
        await page.waitForSelector('[data-mq-mode="surprise"][aria-checked="true"]', { timeout: 5000 });
        const animacio = await page.evaluate(() => ({
            renovada: !!document.querySelector('.mq-list.is-renewed'),
            retard: [...document.querySelectorAll('.mq-list.is-renewed .mq-item')]
                .slice(0, 3)
                .map(item => item.style.getPropertyValue('--i')),
            estat: document.querySelector('.mq-mode__hint')?.textContent.trim(),
            focus: document.activeElement?.dataset?.mqMode,
        }));
        const sorpresa = await estatRadio(page);
        const canviades = sorpresa.pendents.filter(id => !abans.pendents.includes(id)).length;
        comprovar(
            'en canviar a «Sorprèn-me» la llista es renova d’immediat, sense tocar la cançó que sona',
            sorpresa.actual === abans.actual && canviades >= 8 && sorpresa.aplicat === 'surprise',
            { canviades, de: abans.pendents.length, aplicat: sorpresa.aplicat }
        );
        comprovar(
            'es veu: les cançons entren escalonades i un avís diu quantes han canviat (i en quin mode)',
            animacio.renovada &&
                animacio.retard.join() === '0,1,2' &&
                /Sorprèn-me/.test(animacio.estat) &&
                /cançons? noves?/.test(animacio.estat) &&
                animacio.focus === 'surprise',
            animacio
        );
        comprovar(
            'el mode queda desat',
            sorpresa.global === 'surprise',
            { global: sorpresa.global }
        );
        comprovar(
            'la cançó afegida a mà es manté a la cua',
            await page.evaluate(() => activePlaylistQueue.some(item => String(item.id) === window.__afegida))
        );
        await captura(page, 'mode-radio-sorpresa');

        // «Els meus de sempre» porta més música coneguda que «Sorprèn-me» (mitjana de diverses alternances: la tria té sort)
        const mitjana = valors => valors.reduce((suma, valor) => suma + valor, 0) / valors.length;
        const fCasa = [];
        const fSorpresa = [fraccioConeguda(sorpresa, coneguts)];
        const alternances = Number(process.env.MUSICA_ALTERNANCES || 6);
        for (let i = 0; i < alternances; i++) {
            await page.click('[data-mq-mode="home"]');
            await page.waitForSelector('[data-mq-mode="home"][aria-checked="true"]', { timeout: 5000 });
            fCasa.push(fraccioConeguda(await estatRadio(page), coneguts));
            if (i < alternances - 1) {
                await page.click('[data-mq-mode="surprise"]');
                await page.waitForSelector('[data-mq-mode="surprise"][aria-checked="true"]', { timeout: 5000 });
                fSorpresa.push(fraccioConeguda(await estatRadio(page), coneguts));
            }
        }
        comprovar(
            '«Els meus de sempre» porta més artistes coneguts que «Sorprèn-me» (l’efecte és suau: el gust de l’usuari pesa més)',
            (await estatRadio(page)).aplicat === 'home' && mitjana(fCasa) >= mitjana(fSorpresa) + 0.04,
            {
                casa: fCasa.map(valor => Math.round(valor * 100)),
                sorpresa: fSorpresa.map(valor => Math.round(valor * 100)),
            }
        );

        // Prémer l'opció ja activa no fa res
        const abansIgual = await estatRadio(page);
        await page.click('[data-mq-mode="home"]');
        await page.waitForTimeout(300);
        const despresIgual = await estatRadio(page);
        comprovar(
            'prémer el mode que ja s’aplica no canvia la llista',
            abansIgual.pendents.join() === despresIgual.pendents.join()
        );

        // Una selecció o una llista no tenen mode; una ràdio de cerca, sí
        await page.evaluate(() => {
            const songs = currentFeedVideos.filter(video => video.contentType === 'song' && !video.isShort).slice(0, 8);
            SegueixApp.features.musicQueue.playSelection(songs, 'Acabades de sortir');
        });
        await page.waitForSelector('.mq .mq-head', { timeout: 10000 });
        await page.waitForTimeout(600);
        comprovar(
            'una selecció («Acabades de sortir») no mostra el selector de mode',
            (await page.locator('.mq-mode').count()) === 0
        );
        await page.evaluate(() => {
            const songs = currentFeedVideos
                .filter(video => video.contentType === 'song' && !video.isShort)
                .slice(20, 50);
            SegueixApp.features.musicQueue.startFromSearch(songs, { query: 'prova' });
        });
        await page.waitForSelector('.mq--radio .mq-mode', { timeout: 10000 });
        const cerca = await page.evaluate(() => ({
            opcions: document.querySelectorAll('.mq-mode [data-mq-mode]').length,
            nom: document.querySelector('.mq-style')?.textContent.trim(),
        }));
        const abansCerca = await estatRadio(page);
        await page.click('[data-mq-mode="surprise"]');
        await page.waitForSelector('[data-mq-mode="surprise"][aria-checked="true"]', { timeout: 5000 });
        const despresCerca = await estatRadio(page);
        comprovar(
            'una ràdio de cerca té el selector i, en canviar-lo, reordena dins dels mateixos resultats',
            cerca.opcions === 4 &&
                /Cerca: prova/.test(cerca.nom) &&
                despresCerca.pendents.length > 0 &&
                despresCerca.pendents.every(id => abansCerca.pendents.includes(id) || id === despresCerca.actual) &&
                despresCerca.pendents.join() !== abansCerca.pendents.join(),
            { n: despresCerca.pendents.length }
        );
        await context.close();

        // ---- Mòbil ----
        ({ context, page } = await novaPagina(browser, 390, errors));
        await obrir(page);
        await sembrarHistorial(page);
        await page.goto('about:blank');
        await obrir(page);
        await ambGustRecent(page);
        // «La teva ràdio» ja no té modes (2026-10-20): el selector es prova amb la ràdio d'un estil
        await page.evaluate(() => SegueixApp.features.musicQueue.startStyleRadio(['Pop']));
        await page.waitForSelector('.mq--radio .mq-head .mq-mode', { timeout: 20000 });
        await page.waitForTimeout(800);
        await page.click('[data-mq-mode="surprise"]');
        await page.waitForSelector('[data-mq-mode="surprise"][aria-checked="true"]', { timeout: 5000 });
        const mobil = await page.evaluate(() => {
            const options = [...document.querySelectorAll('.mq-mode [data-mq-mode]')].map(button => {
                const box = button.getBoundingClientRect();
                return [Math.round(box.width), Math.round(box.height), button.scrollWidth > button.clientWidth + 1];
            });
            return {
                options,
                overflow: document.documentElement.scrollWidth > innerWidth + 1,
                capcalera: Math.round(document.querySelector('.mq-head').getBoundingClientRect().height),
            };
        });
        comprovar(
            'al mòbil (390 px) les quatre opcions caben, fan ≥ 44 px i no hi ha desbordament',
            mobil.options.length === 4 &&
                mobil.options.every(([w, h, tallat]) => w >= 80 && h >= 44 && !tallat) &&
                !mobil.overflow,
            mobil
        );
        await captura(page, 'mode-radio-mobil');
        await context.close();

        comprovar('cap error de pàgina', errors.length === 0, errors.slice(0, 3));
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\n✅ Mode de la ràdio verificat' : '\n❌ Hi ha comprovacions fallides');
    process.exit(correcte ? 0 : 1);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
