// Verificació en navegador real del motor de selecció musical (ràdio, senyals d'escolta i preferències).
//
// NO forma part de `npm test`: és una eina opt-in, com verificar-portada.js. Requisits: playwright-core i
// un Chromium (CHROMIUM_PATH). Ús:  node tests/browser/verificar-seleccio.js
//
// Comprova amb el catàleg real i els scripts reals de l'app:
//   1) El motor és actiu i «La teva ràdio» genera una cua que compleix els límits (antigues, artista, duplicats).
//   2) Un únic observador del reproductor compta escoltes qualificades i finalitzacions amb progrés efectiu:
//      pausa, seek, fallada de xarxa i canvi de pàgina no compten; un salt manual ràpid suma un salt.
//   3) «Menys com aquesta» i «No em recomanis aquest artista» treuen el que toca de la cua, són reversibles
//      (Desfés) i persisteixen; els controls fan almenys 44 px.
//   4) Un cor fa que la cançó torni a «Torna-hi» amb la seva explicació.
//   5) La còpia de configuració fusiona les estadístiques sense duplicar-les en importar-les dues vegades.

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.SELECCIO_TEST_PORT || 8143);
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

async function novaPagina(browser, { width = 1440, height = 900 } = {}) {
    const mobile = width <= 768;
    const context = await browser.newContext({
        viewport: { width, height },
        isMobile: mobile,
        hasTouch: mobile,
        serviceWorkers: 'block',
    });
    await context.addInitScript(() => {
        if (localStorage.getItem('__seleccio_seed')) return;
        localStorage.setItem(
            'segueix_cookie_consent_v2',
            JSON.stringify({ version: 1, status: 'accepted', source: 'test', updatedAt: new Date().toISOString() })
        );
        localStorage.setItem('__seleccio_seed', '1');
    });
    const page = await context.newPage();
    await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, route =>
        /youtube(-nocookie)?\.com/.test(route.request().url())
            ? route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>embed</title>' })
            : route.abort()
    );
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    return { context, page, errors };
}

async function obrir(page) {
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
    await page.waitForTimeout(600);
}

// Envia al document els missatges que enviaria l'iframe de YouTube (mateix protocol que l'API real).
async function enviar(page, missatges) {
    await page.evaluate(list => {
        const frame = document.querySelector('#videoPlayer iframe');
        list.forEach(payload =>
            window.dispatchEvent(
                new MessageEvent('message', { data: JSON.stringify(payload), source: frame.contentWindow })
            )
        );
    }, missatges);
}
const estat = info => ({ event: 'onStateChange', info });
const temps = (currentTime, playerState = 1, duration = 200) => ({
    event: 'infoDelivery',
    info: { currentTime, playerState, duration },
});

async function main() {
    const server = await serve();
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] });
    try {
        const { context, page, errors } = await novaPagina(browser);
        await obrir(page);

        // 1) Motor actiu i cua que compleix els límits
        comprovar(
            'el motor de selecció i els senyals són actius',
            await page.evaluate(
                () => SegueixApp.features.musicSelection.isEnabled() && Boolean(SegueixApp.features.musicSignals)
            )
        );
        await page.click('#ptPlayBtn');
        await page.waitForFunction(() => document.querySelectorAll('#videoPlayer iframe').length === 1, null, {
            timeout: 15000,
        });
        const cua = await page.evaluate(() => {
            const sel = SegueixApp.features.musicSelection;
            const ctx = sel.getAppContext(currentFeedVideos);
            const queue = activePlaylistQueue.slice();
            const summary = sel.summarize(queue, ctx);
            return {
                length: queue.length,
                unique: new Set(queue.map(v => v.id)).size,
                consecutiveArtist: queue.filter(
                    (v, i) => i > 0 && getVideoArtistKey(v) === getVideoArtistKey(queue[i - 1])
                ).length,
                summary,
                meta: SegueixApp.features.musicQueue.getState().meta,
            };
        });
        comprovar(
            'la cua té cançons diferents i cap artista seguit',
            cua.unique === cua.length && cua.consecutiveArtist === 0,
            {
                length: cua.length,
            }
        );
        comprovar(
            'antigues: màxim 2 de les 20 primeres i mai seguides',
            cua.summary.historicTop <= 2 && cua.summary.consecutiveHistoric === 0,
            cua.summary.topEra
        );
        comprovar(
            'artista: màxim 2 a les 20 primeres i separació de 3',
            cua.summary.maxSameArtistTop <= 2 && (cua.summary.minArtistGap === null || cua.summary.minArtistGap >= 3),
            {
                gap: cua.summary.minArtistGap,
            }
        );
        comprovar('la ràdio declara que fa servir el motor', cua.meta.engine === 'v1', cua.meta.mode);

        // 2) Senyals d'escolta amb l'observador únic
        const primer = await page.evaluate(() => {
            const id = activePlaylistQueue[currentPlaylistIndex].id;
            document.getElementById('videoPlayer').dataset.playingVideoId = id;
            return id;
        });
        const stats = id =>
            page.evaluate(
                ([songId]) => {
                    return SegueixApp.features.musicSignals.getStats().songs[songId] || null;
                },
                [id]
            );

        await enviar(page, [estat(1), temps(0)]);
        // 20 s reproduint, pausa amb el temps quiet, seek endavant i xarxa: encara no hi ha escolta qualificada
        await enviar(
            page,
            Array.from({ length: 20 }, (_, i) => temps(i + 1))
        );
        await enviar(page, [
            estat(2),
            temps(20, 2),
            temps(20, 2),
            estat(1),
            temps(150),
            estat(3),
            temps(150, 3),
            temps(150, 3),
        ]);
        comprovar('pausa, seek i xarxa no compten com a escolta', !(await stats(primer)) || !(await stats(primer)).q);
        // Continua de veritat: 12 s més (32 s efectius)
        await enviar(
            page,
            Array.from({ length: 12 }, (_, i) => temps(151 + i))
        );
        const despres = await stats(primer);
        comprovar('30 s de progrés efectiu → escolta qualificada', despres && despres.q === 1, despres);
        await enviar(
            page,
            Array.from({ length: 12 }, (_, i) => temps(163 + i))
        );
        comprovar('no es compta dues vegades la mateixa sessió', (await stats(primer)).q === 1);

        // Salt manual ràpid: una altra cançó i «següent» abans de 20 s
        const segon = await page.evaluate(() => {
            const id = activePlaylistQueue[currentPlaylistIndex + 1].id;
            return id;
        });
        await page.evaluate(id => {
            document.getElementById('videoPlayer').dataset.playingVideoId = id;
        }, segon);
        await enviar(page, [estat(1), temps(0), temps(1), temps(2), temps(3), temps(4), temps(5)]);
        await page.evaluate(() => {
            const button = document.createElement('button');
            button.className = 'queue-next-button';
            document.body.appendChild(button);
            button.click();
            button.remove();
        });
        const tercer = await page.evaluate(() => activePlaylistQueue[currentPlaylistIndex + 2].id);
        await page.evaluate(id => {
            document.getElementById('videoPlayer').dataset.playingVideoId = id;
        }, tercer);
        await enviar(page, [estat(1), temps(0)]);
        const saltat = await stats(segon);
        comprovar(
            'un salt manual ràpid suma un salt (temporal, no una etiqueta)',
            saltat && saltat.s === 1 && !saltat.q,
            saltat
        );

        // El tancament de pàgina desa sense comptar rebuig
        await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
        const desat = await page.evaluate(() => JSON.parse(localStorage.getItem('catube_music_signals_v1') || 'null'));
        comprovar(
            'les estadístiques es desen (compactes) a localStorage',
            desat && desat.songs && desat.songs[primer].q === 1,
            {
                mida: JSON.stringify(desat).length,
            }
        );

        // 3) Preferències explícites a la cua
        const preferencies = await page.evaluate(() => {
            const host = document.createElement('div');
            host.id = 'provaCua';
            document.body.appendChild(host);
            SegueixApp.features.musicQueue.render(host);
            const item = host.querySelectorAll('.mq-list .mq-item')[2];
            const before = activePlaylistQueue.length;
            const target = activePlaylistQueue[currentPlaylistIndex + 3];
            item.querySelector('[data-mq-more]').click();
            const buttons = [...item.querySelectorAll('.mq-pref')].map(b => {
                const r = b.getBoundingClientRect();
                return { text: b.textContent, h: Math.round(r.height), visible: r.height > 0 };
            });
            item.querySelector('[data-mq-less]').click();
            return {
                before,
                after: activePlaylistQueue.length,
                removed: !activePlaylistQueue.some(v => v.id === target.id),
                id: target.id,
                buttons,
                stored: JSON.parse(localStorage.getItem('catube_music_prefs_v1')),
            };
        });
        // L'avís s'escriu amb un petit retard perquè els lectors de pantalla el tornin a anunciar
        await page.waitForTimeout(150);
        preferencies.toast = await page.evaluate(() => document.getElementById('ptToast')?.textContent || '');
        comprovar(
            '«Menys com aquesta» treu la cançó de la cua pendent',
            preferencies.removed && preferencies.after === preferencies.before - 1,
            {
                abans: preferencies.before,
                despres: preferencies.after,
            }
        );
        comprovar(
            'els controls de preferència fan ≥ 44 px d’alt',
            preferencies.buttons.length === 2 && preferencies.buttons.every(b => b.h >= 44),
            preferencies.buttons
        );
        comprovar(
            'l’avís ofereix «Desfés» i la preferència és persistent',
            /Desfés/.test(preferencies.toast) && preferencies.stored.lessLike[preferencies.id]?.on === true,
            preferencies.toast
        );
        await page.click('.pt-toast__action');
        comprovar(
            '«Desfés» és reversible',
            await page.evaluate(id => !SegueixApp.features.musicSignals.isLessLike(id), preferencies.id)
        );
        const artista = await page.evaluate(() => {
            const target = activePlaylistQueue[currentPlaylistIndex + 4];
            const key = getVideoArtistKey(target);
            SegueixApp.features.musicQueue.applyPreference(target, true);
            return {
                key,
                queda: activePlaylistQueue.slice(currentPlaylistIndex + 1).some(v => getVideoArtistKey(v) === key),
                bloquejat: SegueixApp.features.musicSignals.isArtistBlocked(key),
            };
        });
        comprovar(
            '«No em recomanis aquest artista» el treu de la cua i queda bloquejat',
            !artista.queda && artista.bloquejat,
            artista
        );
        // Una nova ràdio no el torna a programar
        const noTorna = await page.evaluate(key => {
            const seed = currentFeedVideos.find(
                v => getVideoArtistKey(v) !== key && v.contentType === 'song' && !v.isShort
            );
            let apareix = 0;
            for (let i = 0; i < 6; i++) {
                const queue = SegueixApp.features.musicQueue.buildQueue(seed, '');
                if (queue.slice(1).some(v => getVideoArtistKey(v) === key)) apareix += 1;
            }
            return apareix;
        }, artista.key);
        comprovar('les cues noves no programen l’artista bloquejat', noTorna === 0, noTorna);

        // 5) Fusió idempotent en importar la còpia
        const fusio = await page.evaluate(() => {
            const signals = SegueixApp.features.musicSignals;
            const key = signals.STATS_KEY;
            const raw = localStorage.getItem(key);
            const before = JSON.stringify(signals.getStats().songs);
            signals.importMerged(raw);
            signals.importMerged(raw);
            return { igual: JSON.stringify(signals.getStats().songs) === before };
        });
        comprovar('importar dues vegades les estadístiques no les duplica', fusio.igual);

        // 4) Un cor porta la cançó a «Torna-hi» amb explicació (context nou: la pàgina de vídeo no interfereix)
        const nova = await novaPagina(browser);
        await obrir(nova.page);
        const cor = await nova.page.evaluate(() => {
            const song = currentFeedVideos.find(v => v.contentType === 'song' && !v.isShort && v.thumbnail);
            localStorage.setItem(
                'catube_liked_videos',
                JSON.stringify([
                    { id: song.id, title: song.title, channelId: song.channelId, channelTitle: song.channelTitle },
                ])
            );
            return song.id;
        });
        await nova.page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
        await nova.page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
        await nova.page.waitForTimeout(600);
        const torna = await nova.page.evaluate(id => {
            const lead = document.querySelector('[data-pt-section="lead"]');
            return {
                titol: lead?.querySelector('h2')?.textContent || '',
                explicacio: lead?.textContent.includes('Una de les teves preferides') || false,
                cancons: [...(lead?.querySelectorAll('[data-pt-play]') || [])]
                    .map(el => el.dataset.ptPlay)
                    .includes(id),
            };
        }, cor);
        comprovar(
            '«Torna-hi» mostra la cançó amb cor i la seva explicació (encara que sigui a l’historial)',
            torna.explicacio && torna.cancons,
            torna
        );
        comprovar('sense errors de JavaScript (cor)', nova.errors.length === 0, nova.errors);

        // Tornar: la darrera ràdio s'ofereix però mai sona sola; continuar-la engega una cua nova amb un toc
        const abans = await nova.page.evaluate(() => {
            const song = currentFeedVideos.find(v => v.contentType === 'song' && !v.isShort && v.thumbnail);
            localStorage.setItem(
                'catube_last_radio',
                JSON.stringify({ id: song.id, title: song.title, category: '', at: Date.now() })
            );
            return { id: song.id, title: song.title };
        });
        await nova.page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
        await nova.page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
        await nova.page.waitForTimeout(800);
        const oferta = await nova.page.evaluate(() => {
            const button = document.getElementById('ptResumeBtn');
            const r = button.getBoundingClientRect();
            return {
                visible: !button.hidden && r.height > 0,
                text: button.textContent.trim(),
                h: Math.round(r.height),
                iframes: document.querySelectorAll('#videoPlayer iframe').length,
            };
        });
        comprovar(
            'en tornar s’ofereix continuar la ràdio sense que soni sola',
            oferta.visible && oferta.iframes === 0 && oferta.text.includes(abans.title.slice(0, 10)),
            oferta
        );
        comprovar('«Continua la ràdio» fa almenys 44 px', oferta.h >= 44, oferta.h);
        await nova.page.click('#ptResumeBtn');
        await nova.page.waitForFunction(() => document.querySelectorAll('#videoPlayer iframe').length === 1, null, {
            timeout: 15000,
        });
        const reprès = await nova.page.evaluate(() => ({
            radio: SegueixApp.features.musicQueue.getState().isRadio,
            longitud: activePlaylistQueue.length,
        }));
        comprovar('continuar engega una cua nova amb un toc', reprès.radio && reprès.longitud >= 12, reprès);

        // Rendiment amb la CPU frenada 4× (aproximació d'un mòbil de gamma mitjana)
        const client = await nova.context.newCDPSession(nova.page);
        await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        const mesurat = await nova.page.evaluate(() => {
            const t0 = performance.now();
            const ctx = SegueixApp.features.musicSelection.getAppContext(currentFeedVideos.slice());
            const t1 = performance.now();
            const seed = currentFeedVideos.find(v => v.contentType === 'song' && !v.isShort);
            SegueixApp.features.musicQueue.buildQueue(seed, '');
            const t2 = performance.now();
            SegueixApp.features.musicQueue.buildQueue(seed, '');
            const t3 = performance.now();
            return {
                context: Math.round(t1 - t0),
                cua: Math.round(t2 - t1),
                cuaAmbContext: Math.round(t3 - t2),
                videos: currentFeedVideos.length,
                ok: Boolean(ctx),
            };
        });
        console.log(
            `ℹ️  Rendiment (CPU 4× més lenta): context ${mesurat.context} ms (una vegada per feed), cua de 40 ${mesurat.cua} ms (${mesurat.cuaAmbContext} ms amb el context en cau), ${mesurat.videos} vídeos`
        );
        comprovar(
            'la selecció d’una cua triga menys de 400 ms amb la CPU frenada',
            mesurat.cuaAmbContext < 400 && mesurat.cua < 1500,
            mesurat
        );
        await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
        await nova.context.close();

        comprovar('sense errors de JavaScript', errors.length === 0, errors);
        await context.close();

        // Mòbil: controls de preferència accessibles
        const mobil = await novaPagina(browser, { width: 390, height: 800 });
        await obrir(mobil.page);
        await mobil.page.click('#ptPlayBtn');
        await mobil.page.waitForFunction(() => document.querySelectorAll('#videoPlayer iframe').length === 1, null, {
            timeout: 15000,
        });
        const mesura = await mobil.page.evaluate(() => {
            const host = document.createElement('div');
            document.body.appendChild(host);
            SegueixApp.features.musicQueue.render(host);
            const item = host.querySelector('.mq-list .mq-item');
            item.querySelector('[data-mq-more]').click();
            const rect = el => {
                const r = el.getBoundingClientRect();
                return [Math.round(r.width), Math.round(r.height)];
            };
            return {
                pref: [...item.querySelectorAll('.mq-pref')].map(rect),
                overflow: document.documentElement.scrollWidth - window.innerWidth,
            };
        });
        comprovar(
            'mòbil (390 px): controls ≥ 44 px i sense desbordament',
            mesura.pref.every(([w, h]) => h >= 44) && mesura.overflow <= 0,
            mesura
        );
        comprovar('mòbil: sense errors de JavaScript', mobil.errors.length === 0, mobil.errors);
        await mobil.context.close();
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\n✅ Selecció correcta' : '\n❌ Hi ha comprovacions fallides');
    process.exit(correcte ? 0 : 1);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
