// Verificació en navegador real: després d'una ràdio o d'una llista no hi ha «Altres vídeos relacionats» ni vídeos de
// l'artista, a cap mida; i un vídeo que s'obre sol (enllaç ?v=, showVideoFromAPI, una cançó de fora de la llista que
// sona) engega una ràdio: la fitxa antiga d'un vídeo sol ja no surt (2026-10-18).
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

            // Un vídeo que s'obre sol (fora de cap cua) també és una ràdio, sense relacionats
            await page.evaluate(() => {
                const song = currentFeedVideos.filter(v => v.contentType === 'song' && !v.isShort)[7];
                exitPlaylistMode();
                window.__solId = song.id;
                showVideoFromAPI(song.id);
            });
            await page.waitForFunction(() => activePlaylistQueue[0]?.id === window.__solId, null, { timeout: 15000 });
            await esperarCua(page);
            const sol = await relacionats(page);
            comprovar(
                `${width} px: un vídeo obert sol engega una ràdio que comença per ell, sense relacionats`,
                sol.cua && nadaRelacionat(sol),
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

            // Amb la llista sonant, una cançó de fora de la llista engega una ràdio (abans, la fitxa d'un vídeo sol)
            await page.evaluate(() => {
                const inList = new Set(activePlaylistQueue.map(v => v.id));
                const song = currentFeedVideos.filter(
                    v => v.contentType === 'song' && !v.isShort && !inList.has(v.id)
                )[3];
                window.__foraId = song.id;
                showVideoFromAPI(song.id);
            });
            await page.waitForFunction(() => activePlaylistQueue[0]?.id === window.__foraId, null, { timeout: 15000 });
            await esperarCua(page);
            const fora = await relacionats(page);
            const radioFora = await page.evaluate(() => activePlaylistId === '__music_queue__');
            comprovar(
                `${width} px: amb una llista sonant, una cançó de fora engega una ràdio sense relacionats`,
                radioFora && fora.cua && nadaRelacionat(fora),
                { radioFora, ...fora }
            );
            await context.close();
        }

        // Enllaç compartit d'una cançó (?v=): s'obre com a ràdio, a escriptori i al mòbil
        for (const width of [390, 1440]) {
            const { context, page } = await novaPagina(browser, width, errors);
            const id = await page.evaluate(
                () => currentFeedVideos.filter(v => v.contentType === 'song' && !v.isShort)[5].id
            );
            await page.goto(`http://localhost:${PORT}/?v=${id}`, { waitUntil: 'domcontentloaded' });
            await esperarCua(page);
            const enllac = await relacionats(page);
            const primera = await page.evaluate(() => activePlaylistQueue[0]?.id);
            comprovar(
                `${width} px: un enllaç ?v= s'obre com a ràdio que comença per la cançó, sense relacionats`,
                primera === id && enllac.cua && nadaRelacionat(enllac),
                { primera, id, ...enllac }
            );
            await context.close();
        }

        // Escriptori: una llista pròpia tampoc no mostra relacionats (abans només la ràdio els amagava)
        {
            const { context, page } = await novaPagina(browser, 1440, errors);
            await sembrarLlista(page);
            await page.click('.hp-card[data-hp-play="pl_1"]');
            await esperarCua(page);
            const llista = await relacionats(page);
            comprovar(
                '1440 px: una llista a escriptori, sense relacionats',
                llista.cua && nadaRelacionat(llista),
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
