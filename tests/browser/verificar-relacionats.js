// Verificació en navegador real: després d'una ràdio o d'una llista, al mòbil (i tauleta) no hi ha «Altres vídeos
// relacionats» ni vídeos de l'artista; un vídeo sol continua mostrant-los.
//
// NO forma part de `npm test`: és una eina opt-in. Requisits: playwright-core i un Chromium (CHROMIUM_PATH).
// Ús:  node tests/browser/verificar-relacionats.js

const http = require('http');
const { ambGustRecent } = require('./gust-recent');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.MUSICA_TEST_PORT || 8147);
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
        viewport: { width, height: 844 },
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
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
    await page.waitForTimeout(500);
    return { context, page };
}

// Una llista desada perquè aparegui a «Les teves llistes» de la portada
async function sembrarLlista(page) {
    await page.evaluate(() => {
        const songs = currentFeedVideos.filter(v => v.contentType === 'song' && !v.isShort && v.thumbnail).slice(0, 8);
        const videos = songs.map(v => ({
            id: v.id,
            title: v.title,
            thumbnail: v.thumbnail,
            channelTitle: v.channelTitle,
            channelId: v.channelId,
            source: 'api',
        }));
        localStorage.setItem('catube_playlists', JSON.stringify([{ id: 'pl_1', name: 'Per la tarda', videos }]));
        window.dispatchEvent(new Event('segueix:playlists-changed'));
    });
    await page.waitForSelector('.hp-card[data-hp-play="pl_1"]', { timeout: 8000 });
}

const relacionats = page =>
    page.evaluate(() => {
        const shown = selector =>
            [...document.querySelectorAll(selector)].some(el => getComputedStyle(el).display !== 'none');
        return {
            sidebar: shown('#watchPage .watch-sidebar'),
            titol: shown('#watchPage .extra-related-title'),
            capcalera: shown('#watchPage .extra-related-header'),
            graella: shown('#watchPage .extra-videos-grid'),
            cua: !!document.querySelector('#playlistQueueContainer:not(.hidden) .mq'),
            alcada: document.documentElement.scrollHeight,
        };
    });
const nadaRelacionat = r => !r.sidebar && !r.titol && !r.capcalera && !r.graella;

async function esperarCua(page) {
    await page.waitForSelector('#playlistQueueContainer:not(.hidden) .mq .mq-head', { timeout: 20000 });
    await page.waitForTimeout(1200);
}

async function main() {
    const server = await serve();
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] });
    const errors = [];
    try {
        for (const width of [390, 820]) {
            // Ràdio
            let { context, page } = await novaPagina(browser, width, errors);
            await ambGustRecent(page);
            await page.click('#ptPlayBtn');
            await esperarCua(page);
            const radio = await relacionats(page);
            comprovar(
                `${width} px: després d'una ràdio no hi ha vídeos relacionats ni vídeos de l'artista`,
                radio.cua && nadaRelacionat(radio) && radio.alcada < 6000,
                radio
            );

            // Un vídeo sol (fora de la ràdio) els continua mostrant
            await page.evaluate(() => {
                const song = currentFeedVideos.find(v => v.contentType === 'song' && !v.isShort);
                exitPlaylistMode();
                loadVideoInSequence(song.id, 'api');
            });
            await page.waitForFunction(
                () => !document.querySelector('#playlistQueueContainer:not(.hidden) .mq'),
                null,
                {
                    timeout: 15000,
                }
            );
            await page.waitForTimeout(1500);
            const sol = await relacionats(page);
            comprovar(
                `${width} px: un vídeo sol sí que mostra els relacionats`,
                !sol.cua && (sol.capcalera || sol.titol || sol.graella || sol.sidebar),
                sol
            );
            await context.close();

            // Llista de reproducció
            ({ context, page } = await novaPagina(browser, width, errors));
            await sembrarLlista(page);
            await page.click('.hp-card[data-hp-play="pl_1"]');
            await esperarCua(page);
            const llista = await relacionats(page);
            comprovar(
                `${width} px: després d'una llista tampoc`,
                llista.cua && nadaRelacionat(llista) && llista.alcada < 6000,
                llista
            );
            await context.close();
        }

        // Escriptori: la ràdio continua sense relacionats (regla existent) i no s'hi ha tocat
        const { context, page } = await novaPagina(browser, 1440, errors);
        await ambGustRecent(page);
        await page.click('#ptPlayBtn');
        await esperarCua(page);
        const escriptori = await relacionats(page);
        comprovar(
            '1440 px: a escriptori la ràdio continua sense relacionats',
            escriptori.cua && nadaRelacionat(escriptori),
            escriptori
        );
        await context.close();

        comprovar('cap error de pàgina', errors.length === 0, errors.slice(0, 3));
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\n✅ Relacionats verificats' : '\n❌ Hi ha comprovacions fallides');
    process.exit(correcte ? 0 : 1);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
