// Verificació en navegador real de la compartició de ràdios i llistes: botó de compartir arreu, capçalera de la
// ràdio ben alineada, targeta (icona + «Segueix!» + tipus + nom + QR), enllaç cap a segueix.github.io/musica/ i
// importació d'una ràdio compartida.
//
// NO forma part de `npm test`: és una eina opt-in (com verificar-cerca.js). Requisits: playwright-core i un
// Chromium (CHROMIUM_PATH) i, per als QR, accés a jsDelivr (lz-string, qr-code-styling, jsQR) o el seu cache a
// MUSICA_TEST_LIBS. Ús:  node tests/browser/verificar-compartir.js
//   MUSICA_TEST_SHOTS=/ruta   desa captures i la targeta generada
//   MUSICA_TEST_FONTS=1       deixa passar Google Fonts (Fraunces/Roboto) per veure la targeta amb els tipus reals
//
// Comprova amb el catàleg real i els scripts reals de l'app:
//   1) Capçalera de la ràdio: «Ràdio» alineat amb els botons i el nom a 390/820/1280/1440/1920 px; símbols junts.
//   2) Botó de compartir a la ràdio, a la llista en reproducció, a les targetes de la portada i a la biblioteca.
//   3) «Compartir» envia només la imatge (sense text ni enllaç); «Només l'enllaç» envia un enllaç a
//      segueix.github.io/musica/ amb títol «Ràdio · nom» (o «Llista de reproducció · nom»).
//   4) La targeta és 1080×1350 amb els colors de marca i el QR es llegeix i porta l'enllaç exacte.
//   5) Una ràdio compartida s'obre i es posa a sonar; una llista amb apòstrof al nom es comparteix per ID.

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.MUSICA_TEST_PORT || 8146);
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.MUSICA_TEST_SHOTS || '';
const LIBS_DIR = process.env.MUSICA_TEST_LIBS || path.join(os.tmpdir(), 'musica-cdn-libs');
const FONTS = !!process.env.MUSICA_TEST_FONTS;
const SHARE_BASE = 'https://segueix.github.io/musica/';

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

// Llibreries del CDN: es baixen una vegada (curl, que respecta el proxy de l'entorn) i es serveixen des del cache.
const CDN_LIBS = [
    {
        re: /lz-string/,
        file: 'lz-string.js',
        url: 'https://cdn.jsdelivr.net/npm/lz-string@1.5.0/libs/lz-string.min.js',
    },
    {
        re: /qr-code-styling/,
        file: 'qr-code-styling.js',
        url: 'https://cdn.jsdelivr.net/npm/qr-code-styling@1.8.4/lib/qr-code-styling.js',
    },
    { re: /jsqr/i, file: 'jsqr.js', url: 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js' },
];

function llibreria(lib) {
    const file = path.join(LIBS_DIR, lib.file);
    if (!fs.existsSync(file) || fs.statSync(file).size < 1000) {
        fs.mkdirSync(LIBS_DIR, { recursive: true });
        try {
            fs.writeFileSync(
                file,
                execFileSync('curl', ['-sSL', '-m', '40', lib.url], { maxBuffer: 20 * 1024 * 1024 })
            );
        } catch (_) {
            return null;
        }
    }
    return fs.statSync(file).size > 1000 ? fs.readFileSync(file, 'utf8') : null;
}

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

async function novaPagina(browser, { width = 1440, height = 900, errors = [], libs = {} } = {}) {
    const mobile = width <= 768;
    const context = await browser.newContext({
        viewport: { width, height },
        isMobile: mobile,
        hasTouch: mobile,
        serviceWorkers: 'block',
        ignoreHTTPSErrors: FONTS,
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
    await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, route => {
        const url = route.request().url();
        const lib = CDN_LIBS.find(item => item.re.test(url));
        if (lib && libs[lib.file]) {
            return route.fulfill({ status: 200, contentType: 'application/javascript', body: libs[lib.file] });
        }
        if (FONTS && /fonts\.(googleapis|gstatic)\.com/.test(url)) return route.continue();
        if (/youtube(-nocookie)?\.com/.test(url)) {
            return route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: '<!doctype html><title>embed</title>',
            });
        }
        return route.abort();
    });
    page.on('pageerror', error => errors.push(error.message));
    return { context, page, errors };
}

async function obrir(page, query = '') {
    await page.goto(`http://localhost:${PORT}/${query}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
    await page.waitForTimeout(500);
}

// Dues llistes (una amb apòstrof al nom) i uns quants m'agrades mínims.
async function sembrar(page) {
    return page.evaluate(() => {
        const songs = currentFeedVideos.filter(v => v.contentType === 'song' && !v.isShort && v.thumbnail).slice(0, 60);
        const snapshot = v => ({
            id: v.id,
            title: v.title,
            thumbnail: v.thumbnail,
            channelTitle: v.channelTitle,
            channelId: v.channelId,
            source: 'api',
        });
        localStorage.setItem(
            'catube_playlists',
            JSON.stringify([
                { id: 'pl_1', name: 'Música d’estiu', videos: songs.slice(0, 6).map(snapshot) },
                { id: 'pl_2', name: "Per l'hora d'aixecar-se", videos: songs.slice(10, 18).map(snapshot) },
                {
                    id: 'pl_3',
                    name: 'Música per cantar a la dutxa quan no et sent ningú i fer-ho fort',
                    videos: songs.slice(20, 80).map(snapshot),
                },
            ])
        );
        return songs.slice(0, 6).map(v => String(v.id));
    });
}

async function engegarRadio(page) {
    await page.click('#ptPlayBtn');
    await page.waitForFunction(() => document.querySelectorAll('#videoPlayer iframe').length === 1, null, {
        timeout: 20000,
    });
    await page.waitForSelector('.mq--radio .mq-head', { timeout: 10000 });
    await page.waitForTimeout(600);
}

// Substitueix navigator.share/canShare per capturar què s'envia a l'app de destinació.
async function espiarCompartir(page, { suportFitxers = true } = {}) {
    await page.evaluate(suport => {
        window.__compartit = [];
        navigator.canShare = data => (data && data.files ? suport : true);
        navigator.share = async data => {
            const fitxers = (data.files || []).map(f => ({ name: f.name, type: f.type, size: f.size }));
            window.__compartit.push({ title: data.title, text: data.text, url: data.url, fitxers });
            window.__fitxerCompartit = data.files && data.files[0];
        };
    }, suportFitxers);
}

// Descodifica el QR de la targeta que l'app acaba de passar a navigator.share (window.__fitxerCompartit).
async function llegirTargeta(page, libs) {
    if (!libs['jsqr.js']) return null;
    if (!(await page.evaluate(() => typeof jsQR === 'function'))) await page.addScriptTag({ content: libs['jsqr.js'] });
    return page.evaluate(async () => {
        const bitmap = await createImageBitmap(window.__fitxerCompartit);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        const dades = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const resultat = jsQR(dades.data, dades.width, dades.height);
        return { w: bitmap.width, h: bitmap.height, qr: resultat ? resultat.data : null };
    });
}

const captura = async (page, nom, opcions = {}) => {
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${nom}.png`), ...opcions });
};

async function main() {
    const libs = {};
    for (const lib of CDN_LIBS) libs[lib.file] = llibreria(lib);
    const senseLlibreries = CDN_LIBS.filter(lib => !libs[lib.file]).map(lib => lib.file);
    if (senseLlibreries.length)
        console.log(`⏭️  Sense ${senseLlibreries.join(', ')}: es ometen les comprovacions del QR.`);
    const hiHaQr = !!(libs['lz-string.js'] && libs['qr-code-styling.js']);

    const server = await serve();
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] });
    try {
        const errors = [];

        // 1) Capçalera de la ràdio a diferents amples
        for (const width of [390, 820, 1280, 1440, 1920]) {
            const { context, page } = await novaPagina(browser, { width, errors, libs });
            await obrir(page);
            await engegarRadio(page);
            const m = await page.evaluate(() => {
                const r = el => {
                    const b = el.getBoundingClientRect();
                    return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, w: b.width, h: b.height };
                };
                const centre = el => {
                    const b = r(el);
                    return (b.top + b.bottom) / 2;
                };
                const head = document.querySelector('.mq-head');
                const heading = head.querySelector('.mq-heading');
                const barreja = head.querySelector('[data-mq-regenerate]');
                const chip = head.querySelector('.mq-style');
                const tools = [...head.querySelectorAll('.mq-tools button')];
                const share = head.querySelector('[data-mq-share]');
                return {
                    headingVsBarreja: Math.abs(centre(heading) - centre(barreja)),
                    chipRow: r(chip).top,
                    headingRow: r(heading).top,
                    sameRowAsChip: Math.abs(centre(heading) - centre(chip)),
                    toolTops: tools.map(button => Math.round(r(button).top)),
                    toolSizes: tools.map(button => [Math.round(r(button).w), Math.round(r(button).h)]),
                    shareSize: share ? [Math.round(r(share).w), Math.round(r(share).h)] : null,
                    overflow: head.scrollWidth > head.clientWidth + 1,
                    pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
                    sourceBelow: r(head.querySelector('.mq-source')).top > r(heading).bottom - 4,
                    chipH: Math.round(r(chip).h),
                };
            });
            comprovar(
                `${width} px: «Ràdio» queda alineat amb els botons de la mateixa fila`,
                m.headingVsBarreja <= 3,
                m.headingVsBarreja
            );
            comprovar(
                `${width} px: els símbols (+, desar, compartir) són a la mateixa fila i fan ≥ 44 px`,
                new Set(m.toolTops).size === 1 && m.toolSizes.every(([w, h]) => w >= 44 && h >= 44) && !!m.shareSize,
                { tops: m.toolTops, sizes: m.toolSizes }
            );
            if (!m.sourceBelow) {
                comprovar(
                    `${width} px: si el nom cap a la mateixa fila, el títol queda alineat amb el xip del nom`,
                    m.sameRowAsChip <= 14,
                    m.sameRowAsChip
                );
            } else {
                comprovar(`${width} px: amb poc espai el nom passa sencer a la fila de sota`, true);
            }
            comprovar(`${width} px: sense desbordament`, !m.overflow && !m.pageOverflow, m);
            await captura(page, `compartir-capcalera-${width}`, {
                clip: await page.evaluate(() => {
                    const b = document.querySelector('.mq').getBoundingClientRect();
                    return {
                        x: Math.max(0, Math.round(b.left)),
                        y: Math.max(0, Math.round(b.top + window.scrollY)),
                        width: Math.round(b.width),
                        height: 260,
                    };
                }),
                fullPage: true,
            });
            await context.close();
        }

        // 2-4) Compartir des de la ràdio
        let sessio = await novaPagina(browser, { errors, libs });
        let page = sessio.page;
        await obrir(page);
        const idsLlista = await sembrar(page);
        await page.goto('about:blank');
        await obrir(page);

        // Targetes de la portada («Les teves llistes»)
        const portada = await page.evaluate(() => ({
            targetes: document.querySelectorAll('.hp-item').length,
            comparteix: [...document.querySelectorAll('.hp-share')].map(button => {
                const b = button.getBoundingClientRect();
                return { w: Math.round(b.width), h: Math.round(b.height), id: button.dataset.hpShare };
            }),
            niat: !!document.querySelector('.hp-card .hp-share, button button'),
        }));
        comprovar(
            'les targetes de «Les teves llistes» porten un botó de compartir (≥ 44 px) fora del botó de reproduir',
            portada.targetes === 3 &&
                portada.comparteix.length === 3 &&
                portada.comparteix.every(b => b.w >= 44 && b.h >= 44) &&
                !portada.niat,
            portada
        );

        await espiarCompartir(page);
        // Compartir una llista amb apòstrof al nom des de la portada (per ID)
        await page.click('.hp-share[data-hp-share="pl_1"]');
        await page.waitForSelector('#shareOptShare');
        const modalLlista = await page.evaluate(() => ({
            titol: document
                .querySelector('#shareOptShare')
                .closest('.modal')
                .querySelector('.modal-title')
                .textContent.trim(),
            botons: ['#shareOptShare', '#shareOptQr', '#shareOptLink'].map(s => !!document.querySelector(s)),
        }));
        comprovar(
            'la finestra de compartir una llista diu «Llista de reproducció» i té Compartir, QR i enllaç',
            /Comparteix llista de reproducció/i.test(modalLlista.titol) && modalLlista.botons.every(Boolean),
            modalLlista
        );
        await page.click('#shareOptLink');
        await page.waitForFunction(() => window.__compartit.length === 1);
        const enllacLlista = await page.evaluate(() => window.__compartit[0]);
        comprovar(
            '«Només l’enllaç» envia l’URL a segueix.github.io/musica/ amb el títol «Llista de reproducció · nom»',
            enllacLlista.url.startsWith(`${SHARE_BASE}?importData=`) &&
                enllacLlista.title === 'Llista de reproducció · Música d’estiu' &&
                !enllacLlista.fitxers.length,
            { title: enllacLlista.title, url: enllacLlista.url.slice(0, 60) }
        );
        if (libs['lz-string.js']) {
            const payload = await page.evaluate(url => {
                const valor = new URL(url).searchParams.get('importData');
                return SegueixApp.utils.shareCodecs.decodeImportPayload(valor);
            }, enllacLlista.url);
            comprovar(
                'l’enllaç de la llista porta les seves cançons',
                payload?.type === 'playlist' && payload.items.join() === idsLlista.join(),
                payload && { type: payload.type, name: payload.name, n: payload.items.length }
            );
        }

        // Biblioteca: targeta amb botó de compartir per ID (l'apòstrof ja no trenca res)
        await page.evaluate(() => document.querySelector('.nav-trigger[data-page="llistes"]').click());
        await page.waitForSelector('#playlistsPage:not(.hidden) .library-share-btn', { timeout: 8000 });
        await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(node => node.remove()));
        const botoBiblioteca = await page.evaluate(() =>
            [...document.querySelectorAll('.library-share-btn')].map(b => b.getAttribute('onclick'))
        );
        comprovar(
            'la biblioteca comparteix per ID (sense el nom dins d’un atribut)',
            botoBiblioteca.length === 3 && botoBiblioteca.every(c => /shareSegueixPlaylistById\('pl_\d'\)/.test(c)),
            botoBiblioteca
        );
        await page.evaluate(() => document.querySelectorAll('.library-share-btn')[1].click());
        await page.waitForSelector('#shareOptLink');
        await page.click('#shareOptLink');
        await page.waitForFunction(() => window.__compartit.length === 2);
        const segona = await page.evaluate(() => window.__compartit[1]);
        comprovar(
            'una llista amb apòstrofs al nom es comparteix correctament',
            segona.title === "Llista de reproducció · Per l'hora d'aixecar-se",
            segona.title
        );
        // Llista llarga (60 cançons, nom de tres línies): la targeta creix i el QR continua llegint-se
        await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(node => node.remove()));
        await page.evaluate(() => document.querySelectorAll('.library-share-btn')[2].click());
        await page.waitForSelector('#shareOptShare');
        await page.waitForTimeout(800);
        await page.click('#shareOptShare');
        await page.waitForFunction(() => window.__compartit.length === 3, null, { timeout: 20000 });
        const llarga = await llegirTargeta(page, libs);
        if (llarga) {
            const urlLlarga = await page.evaluate(() => {
                const llista = JSON.parse(localStorage.getItem('catube_playlists')).find(item => item.id === 'pl_3');
                const codecs = SegueixApp.utils.shareCodecs;
                return codecs.buildImportUrl(
                    codecs.buildImportPayload({
                        type: 'playlist',
                        name: llista.name,
                        items: llista.videos.map(v => v.id),
                    })
                );
            });
            comprovar(
                'una llista de 60 cançons: la targeta (1080 px d’ample) porta un QR que es llegeix amb l’enllaç exacte',
                llarga.w === 1080 && llarga.h >= 1350 && llarga.qr === urlLlarga,
                { w: llarga.w, h: llarga.h, coincideix: llarga.qr === urlLlarga, len: urlLlarga.length }
            );
        }
        await sessio.context.close();

        // Ràdio
        sessio = await novaPagina(browser, { errors, libs });
        page = sessio.page;
        await obrir(page);
        await engegarRadio(page);
        await espiarCompartir(page);
        const infoRadio = await page.evaluate(() => {
            const dades = SegueixApp.features.musicQueue.getShareData();
            return { type: dades.type, name: dades.name, n: dades.ids.length, primer: dades.ids[0] };
        });
        comprovar(
            'la ràdio té dades per compartir (tipus radio, nom i cançons)',
            infoRadio.type === 'radio' && infoRadio.name && infoRadio.n > 5,
            infoRadio
        );
        await page.click('[data-mq-share]');
        await page.waitForSelector('#shareOptShare');
        await page.waitForTimeout(1200);
        await captura(page, 'compartir-finestra-radio');

        await page.click('#shareOptShare');
        await page.waitForFunction(() => window.__compartit.length === 1, null, { timeout: 15000 });
        const imatge = await page.evaluate(async () => {
            const enviat = window.__compartit[0];
            const fitxer = window.__fitxerCompartit;
            const bitmap = await createImageBitmap(fitxer);
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0);
            const pixel = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data.slice(0, 3));
            const dades = ctx.getImageData(0, 0, canvas.width, canvas.height);
            return {
                enviat,
                w: bitmap.width,
                h: bitmap.height,
                fons: pixel(10, 700),
                llima: pixel(canvas.width - 100, 40),
                crema: pixel(120, 920),
                // Base64 perquè el node pugui desar i descodificar el QR
                png: await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result).split(',')[1]);
                    reader.readAsDataURL(fitxer);
                }),
                pixels: dades.data.length,
            };
        });
        comprovar(
            '«Compartir» envia només una imatge PNG (sense text ni enllaç) amb el títol «Ràdio · nom»',
            imatge.enviat.fitxers.length === 1 &&
                imatge.enviat.fitxers[0].type === 'image/png' &&
                /^segueix-radio-.+\.png$/.test(imatge.enviat.fitxers[0].name) &&
                !imatge.enviat.url &&
                !imatge.enviat.text &&
                imatge.enviat.title === `Ràdio · ${infoRadio.name}`,
            { ...imatge.enviat, fitxers: imatge.enviat.fitxers.map(f => f.name) }
        );
        comprovar(
            'la targeta fa 1080 × 1350 amb el fons, el llima i el crema de Segueix Música',
            imatge.w === 1080 &&
                imatge.h === 1350 &&
                imatge.fons.join() === '20,22,21' &&
                imatge.llima.join() === '214,237,132' &&
                imatge.crema.join() === '244,240,232',
            { w: imatge.w, h: imatge.h, fons: imatge.fons, llima: imatge.llima, crema: imatge.crema }
        );
        if (SHOTS) fs.writeFileSync(path.join(SHOTS, 'compartir-targeta-radio.png'), Buffer.from(imatge.png, 'base64'));

        // QR: es llegeix i porta l'enllaç exacte
        if (hiHaQr && libs['jsqr.js']) {
            await page.addScriptTag({ content: libs['jsqr.js'] });
            const qr = await page.evaluate(async base64 => {
                const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
                const bitmap = await createImageBitmap(blob);
                const canvas = document.createElement('canvas');
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(bitmap, 0, 0);
                const dades = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const resultat = jsQR(dades.data, dades.width, dades.height);
                return resultat ? resultat.data : null;
            }, imatge.png);
            comprovar(
                'el QR de la targeta es llegeix i obre segueix.github.io/musica/ amb la ràdio',
                typeof qr === 'string' && qr.startsWith(`${SHARE_BASE}?importData=`),
                qr && qr.slice(0, 70)
            );
            sessio.enllac = qr;
        }

        // «Només l'enllaç» de la ràdio
        await page.click('[data-mq-share]');
        await page.waitForSelector('#shareOptLink');
        await page.click('#shareOptLink');
        await page.waitForFunction(() => window.__compartit.length === 2);
        const enllacRadio = await page.evaluate(() => window.__compartit[1]);
        comprovar(
            '«Només l’enllaç» de la ràdio envia l’URL amb el títol «Ràdio · nom» (sense fitxers)',
            enllacRadio.url.startsWith(`${SHARE_BASE}?importData=`) &&
                enllacRadio.title === `Ràdio · ${infoRadio.name}` &&
                !enllacRadio.fitxers.length,
            { title: enllacRadio.title }
        );
        let payloadRadio = null;
        if (libs['lz-string.js']) {
            payloadRadio = await page.evaluate(url => {
                const valor = new URL(url).searchParams.get('importData');
                return SegueixApp.utils.shareCodecs.decodeImportPayload(valor);
            }, enllacRadio.url);
            comprovar(
                'l’enllaç de la ràdio és de tipus radio i porta les primeres 30 cançons de la cua',
                payloadRadio?.type === 'radio' && payloadRadio.items.length === Math.min(infoRadio.n, 30),
                payloadRadio && { type: payloadRadio.type, name: payloadRadio.name, n: payloadRadio.items.length }
            );
            if (sessio.enllac) {
                comprovar('el QR i l’enllaç coincideixen', sessio.enllac === enllacRadio.url);
            }
        }

        // «Generar QR»: la mateixa targeta, amb descarregar/compartir/copiar
        await page.click('[data-mq-share]');
        await page.waitForSelector('#shareOptQr');
        await page.click('#shareOptQr');
        await page.waitForSelector('#qrShareCard', { timeout: 20000 });
        const modalQr = await page.evaluate(() => {
            const img = document.querySelector('#qrShareCard');
            return {
                w: img.naturalWidth,
                h: img.naturalHeight,
                botons: ['#qrDownloadPng', '#qrSharePng', '#qrCopyLink'].map(s => {
                    const b = document.querySelector(s);
                    return !!b && !b.disabled;
                }),
                titol: document.querySelector('#qrShareModal .modal-title').textContent.trim(),
            };
        });
        comprovar(
            '«Generar QR» mostra la targeta (1080 × 1350) amb descarregar, compartir i copiar',
            modalQr.w === 1080 &&
                modalQr.h === 1350 &&
                modalQr.botons.every(Boolean) &&
                /^Ràdio · /.test(modalQr.titol),
            modalQr
        );
        await captura(page, 'compartir-qr-modal');

        // Sense menú d'imatges (escriptori): Compartir cau a l'enllaç
        await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(node => node.remove()));
        await espiarCompartir(page, { suportFitxers: false });
        await page.click('[data-mq-share]');
        await page.waitForSelector('#shareOptShare');
        await page.click('#shareOptShare');
        await page.waitForFunction(() => window.__compartit.length === 1, null, { timeout: 15000 });
        const retall = await page.evaluate(() => window.__compartit[0]);
        comprovar(
            'sense suport per compartir imatges, «Compartir» cau a l’enllaç amb títol',
            !!retall.url && retall.url.startsWith(SHARE_BASE) && !retall.fitxers.length,
            { title: retall.title }
        );

        // 5) Importació: una ràdio compartida s'obre i sona
        if (payloadRadio && libs['lz-string.js']) {
            await sessio.context.close();
            sessio = await novaPagina(browser, { errors, libs });
            page = sessio.page;
            const query = new URL(enllacRadio.url).search;
            await obrir(page, query);
            await page.waitForSelector('#importDataModal', { timeout: 15000 });
            const modalImport = await page.evaluate(() => ({
                text: document.querySelector('#importDataModal').textContent.replace(/\s+/g, ' ').trim(),
                accepta: document.querySelector('#importDataAcceptBtn').textContent.trim(),
            }));
            comprovar(
                'l’enllaç obre «Ràdio» amb el nom i el botó «Escolta-la»',
                /Ràdio/.test(modalImport.text) &&
                    modalImport.text.includes(payloadRadio.name) &&
                    modalImport.accepta === 'Escolta-la',
                modalImport
            );
            await captura(page, 'compartir-importar-radio');
            await page.click('#importDataAcceptBtn');
            await page.waitForSelector('.mq .mq-head', { timeout: 20000 });
            const sona = await page.evaluate(() => {
                const dades = SegueixApp.features.musicQueue.getShareData();
                return {
                    cua: dades?.ids.length,
                    encapcalament: document.querySelector('.mq-heading')?.textContent.trim(),
                    modal: !!document.querySelector('#importDataModal'),
                    iframes: document.querySelectorAll('#videoPlayer iframe').length,
                };
            });
            comprovar(
                '«Escolta-la» posa la ràdio compartida a sonar (cua amb les cançons, un sol reproductor)',
                sona.cua >= 1 && sona.encapcalament === 'Ràdio' && !sona.modal && sona.iframes === 1,
                sona
            );
        }
        await sessio.context.close();

        comprovar('cap error de pàgina', errors.length === 0, errors.slice(0, 3));
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\n✅ Compartició verificada' : '\n❌ Hi ha comprovacions fallides');
    process.exit(correcte ? 0 : 1);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
