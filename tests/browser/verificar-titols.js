// Verificació en navegador real dels títols nets: sense el nom de l'artista ni «videoclip / vídeo / oficial».
//
// NO forma part de `npm test`: és una eina opt-in, com verificar-cerca.js. Requisits: playwright-core i
// un Chromium (CHROMIUM_PATH). Ús:  node tests/browser/verificar-titols.js
//
// Comprova amb el catàleg real i els scripts reals de l'app:
//   1) El feed carregat porta els títols nets i l'original a `originalTitle`.
//   2) Es veuen nets a la portada, al menú i a la pàgina de cerca, a la cua de la ràdio i al reproductor.
//   3) Les cançons desades abans (historial, llistes i m'agrades amb el títol de YouTube) es mostren netes.
//   4) La fila «Videoclips oficials» continua detectant els videoclips pel títol original.

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.TITOLS_TEST_PORT || 8146);
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

async function novaPagina(browser, errors) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
    await context.addInitScript(() => {
        try {
            if (localStorage.getItem('__titols_seed')) return;
            localStorage.setItem(
                'segueix_cookie_consent_v2',
                JSON.stringify({ version: 1, status: 'accepted', source: 'test', updatedAt: new Date().toISOString() })
            );
            localStorage.setItem('__titols_seed', '1');
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

// Un títol és brut si porta una marca de videoclip/vídeo/oficial entre claudàtors o si comença amb el nom de l'artista
// seguit d'un separador («Artista - Cançó»).
const esBrut = `(titol, artista) => {
    const clau = /[(\\[{][^()\\[\\]{}]*(video|vídeo|oficial|official)[^()\\[\\]{}]*[)\\]}]/i;
    const text = String(titol).trim();
    const nom = String(artista || '').trim();
    const alDavant = nom.length >= 4 && text.toLowerCase().startsWith(nom.toLowerCase()) && /^\\s*[-–—|:·]\\s/.test(text.slice(nom.length));
    return clau.test(text) || alDavant;
}`;

async function main() {
    const server = await serve();
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] });
    try {
        const errors = [];
        let sessio = await novaPagina(browser, errors);
        let page = sessio.page;
        await obrir(page);

        // 1) El feed carregat
        const feed = await page.evaluate(brut => {
            const esBrut = eval(brut);
            const videos = YouTubeAPI.feedVideos;
            const canviats = videos.filter(v => v.originalTitle);
            return {
                total: videos.length,
                canviats: canviats.length,
                ambOriginal: canviats.every(v => typeof v.originalTitle === 'string' && v.originalTitle !== v.title),
                bruts: videos.filter(v => esBrut(v.title, v.channelTitle)).length,
                exemple: canviats[0] ? [canviats[0].originalTitle, canviats[0].title] : null,
                buits: videos.filter(v => !String(v.title).trim()).length,
            };
        }, esBrut);
        comprovar(
            'el feed porta els títols nets (i l’original a originalTitle)',
            feed.canviats > feed.total * 0.3 && feed.ambOriginal && feed.buits === 0 && feed.bruts < feed.total * 0.01,
            feed
        );

        // 2a) Portada
        const portada = await page.evaluate(brut => {
            const esBrut = eval(brut);
            const textos = [
                ...document.querySelectorAll(
                    '.pt-sections .pt-card__title, .pt-sections .pt-quick__title, .pt-sections .pt-feature__title'
                ),
            ].map(el => el.textContent.trim());
            return { n: textos.length, bruts: textos.filter(t => esBrut(t, '')).length, mostra: textos.slice(0, 4) };
        }, esBrut);
        comprovar(
            'la portada mostra els títols sense marques de videoclip/oficial',
            portada.n > 10 && portada.bruts === 0,
            portada
        );

        // 2b) Cerca: menú i pàgina de resultats
        await page.fill('.search-input', 'manel');
        await page.waitForSelector('#searchDropdown .search-result-item[data-result-type="video"]');
        const menu = await page.evaluate(brut => {
            const esBrut = eval(brut);
            const titols = [...document.querySelectorAll('#searchDropdown [data-result-type="video"] .title')].map(el =>
                el.textContent.trim()
            );
            return { n: titols.length, bruts: titols.filter(t => esBrut(t, '')).length, mostra: titols.slice(0, 3) };
        }, esBrut);
        comprovar('el menú de cerca mostra títols nets', menu.n > 0 && menu.bruts === 0, menu);
        await page.press('.search-input', 'Enter');
        await page.waitForSelector('#videosGrid [data-search-results] .video-card');
        const resultats = await page.evaluate(brut => {
            const esBrut = eval(brut);
            const cards = [...document.querySelectorAll('#videosGrid [data-search-results] .video-card')];
            const titols = cards.map(c => c.querySelector('.video-card-title')?.textContent.trim() || '');
            const artistes = cards.map(c => c.querySelector('.channel-name')?.textContent.trim() || '');
            return {
                n: cards.length,
                bruts: titols.filter((t, i) => esBrut(t, artistes[i])).length,
                ambArtista: artistes.filter(Boolean).length,
                mostra: titols.slice(0, 3),
            };
        }, esBrut);
        comprovar(
            'la pàgina de cerca mostra títols nets i l’artista a part',
            resultats.n > 5 && resultats.bruts === 0 && resultats.ambArtista === resultats.n,
            resultats
        );

        // 2c) Ràdio: cua i reproductor
        await page.click('.search-radio-btn');
        await page.waitForFunction(() => activePlaylistId === '__music_queue__', null, { timeout: 8000 });
        await page.waitForTimeout(600);
        const radio = await page.evaluate(brut => {
            const esBrut = eval(brut);
            const cua = activePlaylistQueue.map(v => v.title);
            const titol = document.getElementById('videoTitle')?.textContent.trim() || '';
            const primera = activePlaylistQueue[0];
            return {
                cua: cua.length,
                brutsCua: activePlaylistQueue.filter(v => esBrut(v.title, v.channelTitle)).length,
                titolReproductor: titol,
                esElNet: titol === primera.title,
                brutReproductor: esBrut(titol, primera.channelTitle),
                mq: [...document.querySelectorAll('.mq-title')].slice(0, 3).map(el => el.textContent.trim()),
            };
        }, esBrut);
        comprovar(
            'la ràdio i el reproductor mostren el títol net',
            radio.cua > 1 && radio.brutsCua === 0 && radio.esElNet && !radio.brutReproductor,
            radio
        );

        // 4) «Videoclips oficials» detecta pel títol original
        const clips = await page.evaluate(() => {
            const home = SegueixApp.features.homeSections;
            const videos = YouTubeAPI.feedVideos;
            const ambNet = videos.filter(v => home.isOfficialClip(v)).length;
            const ambOriginal = videos.filter(v =>
                home.isOfficialClip({ ...v, title: v.originalTitle || v.title, originalTitle: undefined })
            ).length;
            return { ambNet, ambOriginal };
        });
        comprovar(
            '«Videoclips oficials» continua detectant-los (pel títol original de YouTube)',
            clips.ambNet > 20 && clips.ambNet === clips.ambOriginal,
            clips
        );

        // Compartir: el missatge porta l'artista encara que el títol que es mostra ja no el tingui
        const compartit = await page.evaluate(async () => {
            const video = YouTubeAPI.feedVideos.find(v => v.originalTitle && v.contentType === 'song');
            let enviat = null;
            navigator.share = async dades => {
                enviat = dades;
            };
            await shareVideo({ id: video.id, title: video.title });
            return { titol: video.title, artista: video.channelTitle, enviat: enviat && enviat.title };
        });
        comprovar(
            'en compartir, el missatge porta «Artista - Cançó»',
            compartit.enviat === `${compartit.artista} - ${compartit.titol}` || compartit.enviat === compartit.titol,
            compartit
        );

        // 3) Cançons desades abans amb el títol de YouTube: historial, llistes i m'agrades es mostren netes
        await sessio.context.close();
        sessio = await novaPagina(browser, errors);
        page = sessio.page;
        await obrir(page);
        await page.evaluate(() => {
            const cancons = YouTubeAPI.feedVideos
                .filter(v => v.originalTitle && v.contentType === 'song' && !v.isShort && v.thumbnail)
                .slice(0, 8);
            const brut = v => ({
                id: v.id,
                title: v.originalTitle,
                thumbnail: v.thumbnail,
                channelId: v.channelId,
                channelTitle: v.channelTitle,
                source: 'api',
            });
            localStorage.setItem(
                'catube_history',
                JSON.stringify(
                    cancons
                        .slice(0, 5)
                        .map((v, i) => ({ ...brut(v), viewedAt: new Date(Date.now() - i * 3600e3).toISOString() }))
                )
            );
            localStorage.setItem(
                'catube_playlists',
                JSON.stringify([{ id: 'pl_1', name: 'Antiga', videos: cancons.slice(2, 8).map(brut) }])
            );
            localStorage.setItem('catube_liked_videos', JSON.stringify(cancons.slice(0, 3).map(brut)));
            window.__brutes = cancons.map(v => v.originalTitle);
        });
        await page.goto('about:blank');
        await obrir(page);
        await page.evaluate(() => document.querySelector('.nav-trigger[data-page="llistes"]').click());
        await page.waitForSelector('#playlistsPage:not(.hidden) .mm-card');
        await page.waitForTimeout(800);
        const desades = await page.evaluate(brut => {
            const esBrut = eval(brut);
            const textos = sel => [...document.querySelectorAll(sel)].map(el => el.textContent.trim());
            const historial = textos('.mm-card__title');
            const llistes = textos('#playlistsList .playlist-video-title');
            return {
                historial: historial.length,
                brutsHistorial: historial.filter(t => esBrut(t, '')).length,
                llistes: llistes.length,
                brutsLlistes: llistes.filter(t => esBrut(t, '')).length,
                likes: getLikedVideos().filter(v => esBrut(v.title, v.channelTitle)).length,
                mostra: [historial[0], llistes[0]],
            };
        }, esBrut);
        comprovar(
            'l’historial, les llistes i els m’agrades desats amb el títol de YouTube es mostren nets',
            desades.historial >= 3 &&
                desades.brutsHistorial === 0 &&
                desades.llistes >= 3 &&
                desades.brutsLlistes === 0 &&
                desades.likes === 0,
            desades
        );
        // I a la pàgina d'historial complet
        await page.waitForTimeout(700);
        await page.evaluate(() => document.querySelector('.nav-trigger[data-page="historial"]').click());
        await page.waitForSelector('#historyPage:not(.hidden) #historyGrid .video-card');
        const completa = await page.evaluate(brut => {
            const esBrut = eval(brut);
            const titols = [...document.querySelectorAll('#historyGrid .video-card-title')].map(el =>
                el.textContent.trim()
            );
            return { n: titols.length, bruts: titols.filter(t => esBrut(t, '')).length, mostra: titols.slice(0, 2) };
        }, esBrut);
        comprovar('l’historial complet mostra títols nets', completa.n >= 3 && completa.bruts === 0, completa);

        comprovar('cap error de JavaScript', errors.length === 0, errors);
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\n✅ Títols nets verificats.' : '\n❌ Hi ha comprovacions fallides.');
    process.exit(correcte ? 0 : 1);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
