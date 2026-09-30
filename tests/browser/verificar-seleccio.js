// Verificació en navegador real del motor de selecció musical (ràdio, senyals d'escolta i preferències).
//
// NO forma part de `npm test`: és una eina opt-in, com verificar-portada.js. Requisits: playwright-core i
// un Chromium (CHROMIUM_PATH). Ús:  node tests/browser/verificar-seleccio.js
//
// Comprova amb el catàleg real i els scripts reals de l'app:
//   1) El motor és actiu i «La teva ràdio» genera una cua que compleix els límits (antigues, artista, duplicats).
//   2) Un únic observador del reproductor compta escoltes qualificades i finalitzacions amb progrés efectiu:
//      pausa, seek, fallada de xarxa i canvi de pàgina no compten; un salt manual ràpid suma un salt.
//   3) «(+) com aquesta (−)»: dos cercles de 44 px que compten per a l'algorisme, són excloents i reversibles
//      (Desfés) i persisteixen; el cor a dalt a la dreta del reproductor desa el m'agrada i deixa el de sota en vermell.
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

// Finestra flotant: la cantonada inferior dreta ha de ser del vídeo (per clicar «Omet l'anunci» de YouTube)
// i la resta de la finestra ha de continuar servint per arrossegar-la.
async function comprovarZonaLliure(page, etiqueta) {
    await page.evaluate(() => {
        setMiniPlayerState(true);
        // Simula el que fan els controls quan són visibles (toc/ratolí): no han de tapar la cantonada
        showQueueNextOverlay({ sticky: true });
        showMiniPlayerControls();
    });
    await page.waitForTimeout(500);
    const mesura = await page.evaluate(() => {
        const player = document.getElementById('videoPlayer');
        const r = player.getBoundingClientRect();
        const at = (fx, fy) => {
            const el = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
            return el ? el.id || (typeof el.className === 'string' ? el.className : el.tagName) : null;
        };
        return {
            mini: player.classList.contains('mini-player-active'),
            cantonada: [at(0.9, 0.9), at(0.75, 0.8), at(0.6, 0.7), at(0.95, 0.65)],
            arrossegar: [at(0.2, 0.9), at(0.7, 0.2), at(0.1, 0.5)],
        };
    });
    comprovar(
        `${etiqueta}: la cantonada inferior dreta de la finestra flotant és del vídeo (Omet l'anunci)`,
        mesura.mini && mesura.cantonada.every(id => id === 'catube-player'),
        mesura
    );
    comprovar(
        `${etiqueta}: la resta de la finestra continua servint per arrossegar`,
        mesura.arrossegar.every(id => /drag-surface/.test(id)),
        mesura.arrossegar
    );
}

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

        // 1b) Ràdio d'un artista: sempre de la seva categoria principal, amb un nom fix i «+» per barrejar un estil
        const estil = await page.evaluate(() => {
            const music = window.SegueixMusicCategories;
            const queueApi = SegueixApp.features.musicQueue;
            selectedCategory = 'Novetats';
            const song = currentFeedVideos.find(
                v => v.contentType === 'song' && !v.isShort && music.primaryCategoryForChannel(v.channelId) === 'Rock'
            );
            queueApi.startFrom(song.id, 'api');
            const state = queueApi.getState();
            const inCategory = video => {
                const own = Array.isArray(video.categories) ? video.categories : [];
                return own.some(name => String(name).toLowerCase() === 'rock');
            };
            const nameOf = () => {
                const host = document.createElement('div');
                queueApi.render(host);
                const html = host.innerHTML;
                const from = html.indexOf('<span class="mq-source');
                return html.slice(from, html.indexOf('<button type="button" class="mq-regenerate', from));
            };
            const first = nameOf();
            const names = [];
            for (let i = 0; i < 4; i++) {
                currentPlaylistIndex = Math.min(currentPlaylistIndex + 1, activePlaylistQueue.length - 1);
                names.push(nameOf() === first);
            }
            currentPlaylistIndex = 0;
            return {
                categories: state.categories,
                primary: music.primaryCategoryForChannel(song.channelId),
                totesDeLaCategoria: activePlaylistQueue.every(inCategory),
                longitud: activePlaylistQueue.length,
                nomFix: names.every(Boolean),
                nom: first
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim(),
            };
        });
        comprovar(
            'una ràdio d’un artista és de la seva categoria principal (i només d’ella)',
            estil.categories[0] === estil.primary && estil.totesDeLaCategoria && estil.longitud >= 12,
            estil
        );
        comprovar(
            'el nom de la ràdio és l’estil i no canvia amb la cançó que sona',
            estil.nomFix && /Rock/.test(estil.nom),
            estil.nom
        );

        const barreja = await page.evaluate(() => {
            const queueApi = SegueixApp.features.musicQueue;
            const host = document.createElement('div');
            host.id = 'provaEstils';
            document.body.appendChild(host);
            queueApi.render(host);
            const abans = {
                mes: Boolean(host.querySelector('[data-mq-add-style]')),
                selector: Boolean(host.querySelector('[data-mq-pick-style]')),
            };
            host.querySelector('[data-mq-add-style]').click();
            queueApi.render(host);
            const opcions = [...host.querySelectorAll('[data-mq-pick-style]')].map(b => b.dataset.mqPickStyle);
            const boto = host.querySelector('[data-mq-add-style]');
            const mida = boto.getBoundingClientRect();
            const rock = host.querySelector('[data-mq-pick-style="Rock"]');
            const escollit = 'Pop';
            const pop = host.querySelector(`[data-mq-pick-style="${escollit}"]`);
            pop.click();
            queueApi.render(host);
            const state = queueApi.getState();
            const auto = activePlaylistQueue.slice(1, 21);
            const conte = (video, name) =>
                (video.categories || []).some(x => String(x).toLowerCase() === name.toLowerCase());
            const nomHtml = host.innerHTML;
            return {
                abans,
                opcions,
                rockNoEsOfereix: !rock,
                midaBoto: [Math.round(mida.width), Math.round(mida.height)],
                categories: state.categories,
                soloRock: auto.filter(v => conte(v, 'Rock') && !conte(v, 'Pop')).length,
                soloPop: auto.filter(v => conte(v, 'Pop') && !conte(v, 'Rock')).length,
                totes: auto.every(v => conte(v, 'Rock') || conte(v, 'Pop')),
                nomPortaEls2: /Rock/.test(nomHtml) && /Pop/.test(nomHtml) && nomHtml.includes('data-mq-remove-style'),
                selectorTancat: !host.querySelector('[data-mq-pick-style]'),
            };
        });
        comprovar(
            'al costat del nom hi ha un «+» (≥ 44 px) que obre el selector amb els altres estils',
            barreja.abans.mes &&
                !barreja.abans.selector &&
                barreja.opcions.length >= 5 &&
                barreja.rockNoEsOfereix &&
                barreja.midaBoto[0] >= 44,
            { abans: barreja.abans, opcions: barreja.opcions, mida: barreja.midaBoto }
        );
        comprovar(
            'en escollir un estil la ràdio es regenera barrejant els dos (i el nom els porta)',
            barreja.categories.length === 2 &&
                barreja.soloRock >= 4 &&
                barreja.soloPop >= 4 &&
                barreja.totes &&
                barreja.nomPortaEls2 &&
                barreja.selectorTancat,
            barreja
        );
        // Torna a la ràdio general per continuar amb la resta de proves
        await page.evaluate(() => {
            document.getElementById('provaEstils')?.remove();
        });

        // 1c) El text del mode («Sorprèn-me»…) ja no és a la capçalera: hi ha el símbol de desar com a llista
        const capcalera = await page.evaluate(() => {
            const queueApi = SegueixApp.features.musicQueue;
            const host = document.createElement('div');
            document.body.appendChild(host);
            const resultat = {};
            for (const mode of ['home', 'mix', 'surprise']) {
                localStorage.setItem('catube_discovery_mode', mode);
                queueApi.regenerate();
                queueApi.render(host);
                const head = host.querySelector('.mq-head');
                const boto = host.querySelector('[data-mq-save-list]');
                const r = boto?.getBoundingClientRect();
                resultat[mode] = {
                    modeVisible: /Sorprèn-me|Una mica de tot|A casa/.test(head?.textContent || ''),
                    botoMida: r ? [Math.round(r.width), Math.round(r.height)] : null,
                    nom: boto?.getAttribute('aria-label') || '',
                    alCostatDelNom: Boolean(boto?.closest('.mq-source')),
                };
            }
            localStorage.setItem('catube_discovery_mode', 'mix');
            host.remove();
            return resultat;
        });
        comprovar(
            'a la capçalera de la ràdio no hi ha el nom del mode (Sorprèn-me…) sinó el símbol de desar com a llista (≥ 44 px)',
            Object.values(capcalera).every(
                item =>
                    !item.modeVisible &&
                    item.botoMida &&
                    item.botoMida[0] >= 44 &&
                    item.botoMida[1] >= 44 &&
                    item.alCostatDelNom &&
                    /Desa la ràdio com a llista/.test(item.nom)
            ),
            capcalera
        );

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

        // 3) «(+) com aquesta (−)» a la cua: dos cercles clicables que compten per a l'algorisme
        const preferencies = await page.evaluate(() => {
            const host = document.createElement('div');
            host.id = 'provaCua';
            document.body.appendChild(host);
            SegueixApp.features.musicQueue.render(host);
            const item = host.querySelectorAll('.mq-list .mq-item')[2];
            const before = activePlaylistQueue.length;
            const target = activePlaylistQueue[currentPlaylistIndex + 3];
            item.querySelector('[data-mq-more]').click();
            const cercles = [...item.querySelectorAll('.mq-circle')].map(b => {
                const r = b.getBoundingClientRect();
                const radi = getComputedStyle(b).borderTopLeftRadius;
                return { label: b.getAttribute('aria-label'), w: Math.round(r.width), h: Math.round(r.height), radi };
            });
            const text = item.querySelector('.mq-prefs').textContent.replace(/\s+/g, ' ').trim();
            item.querySelector('[data-mq-minus]').click();
            return {
                before,
                after: activePlaylistQueue.length,
                removed: !activePlaylistQueue.some(v => v.id === target.id),
                id: target.id,
                cercles,
                text,
                stored: JSON.parse(localStorage.getItem('catube_music_prefs_v1')),
            };
        });
        // L'avís s'escriu amb un petit retard perquè els lectors de pantalla el tornin a anunciar
        await page.waitForTimeout(150);
        preferencies.toast = await page.evaluate(() => document.getElementById('ptToast')?.textContent || '');
        comprovar(
            '«−» treu la cançó de la cua pendent',
            preferencies.removed && preferencies.after === preferencies.before - 1,
            { abans: preferencies.before, despres: preferencies.after }
        );
        comprovar(
            'hi ha un «+» i un «−» rodons de ≥ 44 px, amb el text «com aquesta»',
            preferencies.cercles.length === 2 &&
                preferencies.cercles.every(c => c.w >= 44 && c.h >= 44 && parseFloat(c.radi) >= 22) &&
                /com aquesta/.test(preferencies.text),
            preferencies
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
        // «+»: compta per a l'algorisme (gust de la cançó) i és excloent amb «−»
        const mes = await page.evaluate(() => {
            const signals = SegueixApp.features.musicSignals;
            const sel = SegueixApp.features.musicSelection;
            const host = document.getElementById('provaCua');
            const target = activePlaylistQueue[currentPlaylistIndex + 4];
            const index = activePlaylistQueue.indexOf(target);
            const before = sel.songTaste(String(target.id), signals.snapshot(), Date.now(), sel.getConfig());
            SegueixApp.features.musicQueue.render(host);
            host.querySelector(`[data-mq-plus="${index}"]`).click();
            const after = sel.songTaste(String(target.id), signals.snapshot(), Date.now(), sel.getConfig());
            // L'app repinta la cua real; aquí es repinta el contenidor de prova per veure l'estat premut
            SegueixApp.features.musicQueue.render(host);
            const premut = host.querySelector(`[data-mq-plus="${index}"]`).getAttribute('aria-pressed');
            SegueixApp.features.musicQueue.applyPreference(target, 'less');
            return {
                id: target.id,
                before,
                after,
                premut,
                moreQuedaOff: !signals.isMoreLike(target.id),
                lessOn: signals.isLessLike(target.id),
            };
        });
        comprovar('«+» puja el gust de la cançó i es veu premut', mes.after > mes.before && mes.premut === 'true', mes);
        comprovar('«+» i «−» són excloents', mes.moreQuedaOff && mes.lessOn, mes);
        comprovar(
            'ja no hi ha cap opció «No em recomanis aquest artista» a la cua',
            await page.evaluate(() => !document.getElementById('provaCua').textContent.includes('No em recomanis'))
        );

        // 3b) Cor a la línia central, tot a la dreta del reproductor: surt i desapareix amb els controls de pausa
        await page.evaluate(() => {
            const player = document.getElementById('videoPlayer');
            player.classList.remove('is-heart-awake');
            player.dataset.playerState = '1';
            player.querySelector('.queue-next-overlay')?.classList.remove('is-visible');
        });
        await page.waitForTimeout(400);
        const cor2 = await page.evaluate(() => {
            const player = document.getElementById('videoPlayer');
            const heart = player.querySelector(':scope > .player-heart');
            if (!heart) return { existeix: false };
            const p = player.getBoundingClientRect();
            const r = heart.getBoundingClientRect();
            const opacity = () => Number(getComputedStyle(heart).opacity);
            const amagat = opacity();
            player.dataset.playerState = '2';
            const enPausa = getComputedStyle(heart).pointerEvents;
            return {
                existeix: true,
                centreVertical: Math.round(r.top + r.height / 2 - (p.top + p.height / 2)),
                dreta: Math.round(p.right - r.right),
                mida: [Math.round(r.width), Math.round(r.height)],
                amagatEnMarxa: amagat,
                clicableEnPausa: enPausa === 'auto',
                id: player.dataset.playingVideoId,
            };
        });
        await page.waitForTimeout(300);
        const visiblePausa = await page.evaluate(() =>
            Number(getComputedStyle(document.querySelector('#videoPlayer .player-heart')).opacity)
        );
        await page.evaluate(() => {
            document.getElementById('videoPlayer').dataset.playerState = '1';
        });
        await page.waitForTimeout(300);
        const iAmagatDeNou = await page.evaluate(() =>
            Number(getComputedStyle(document.querySelector('#videoPlayer .player-heart')).opacity)
        );
        comprovar(
            'el cor és a la línia central, tot a la dreta, i fa ≥ 56 px',
            cor2.existeix &&
                Math.abs(cor2.centreVertical) <= 3 &&
                cor2.dreta >= 0 &&
                cor2.dreta <= 12 &&
                cor2.mida[0] >= 56,
            cor2
        );
        comprovar(
            'el cor s’amaga amb els controls (en marxa) i surt en pausa, i torna a amagar-se en reprendre',
            cor2.amagatEnMarxa === 0 && cor2.clicableEnPausa && visiblePausa === 1 && iAmagatDeNou === 0,
            { enMarxa: cor2.amagatEnMarxa, enPausa: visiblePausa, alReprendre: iAmagatDeNou }
        );
        await page.evaluate(() => {
            // El cor de sota (fitxa del vídeo) es crea igual que ho fa l'app; les icones de Lucide (CDN) no hi són
            // en aquesta prova, així que se li posa la mateixa icona SVG que fa servir el cor de la fitxa.
            let under = document.getElementById('likeToggle');
            if (!under) {
                under = document.createElement('button');
                under.id = 'likeToggle';
                under.className = 'btn-heart';
                document.body.appendChild(under);
            }
            under.innerHTML =
                '<svg viewBox="0 0 256 256"><path d="M128 224s-96-54-96-118c0-36 28-58 56-58 24 0 40 18 40 18s16-18 40-18c28 0 56 22 56 58 0 64-96 118-96 118z"></path></svg>';
            document.querySelector('#videoPlayer .player-heart').click();
        });
        await page.waitForTimeout(300);
        const liked = await page.evaluate(id => {
            const heart = document.querySelector('#videoPlayer .player-heart');
            const under = document.getElementById('likeToggle');
            const likedIds = JSON.parse(localStorage.getItem('catube_liked_videos') || '[]').map(v => String(v.id));
            return {
                guardat: likedIds.includes(String(id)),
                sobre: heart.classList.contains('is-liked'),
                sobreVermell: getComputedStyle(heart.querySelector('svg')).fill,
                sota: under.classList.contains('is-liked'),
                sotaVermell: getComputedStyle(under.querySelector('svg')).fill,
                snapshot: SegueixApp.features.musicSignals.snapshot().liked.has(String(id)),
            };
        }, cor2.id);
        comprovar(
            'el cor del reproductor desa el m’agrada, compta per a l’algorisme i posa el de sota en vermell',
            liked.guardat &&
                liked.sobre &&
                liked.sota &&
                liked.snapshot &&
                liked.sobreVermell === 'rgb(204, 0, 0)' &&
                liked.sotaVermell === 'rgb(204, 0, 0)',
            liked
        );
        await page.evaluate(() => document.querySelector('#videoPlayer .player-heart').click());
        await page.waitForTimeout(300);
        comprovar(
            'tornar-hi a prémer el treu (els dos cors queden buits)',
            await page.evaluate(
                () =>
                    !document.querySelector('#videoPlayer .player-heart').classList.contains('is-liked') &&
                    !document.getElementById('likeToggle').classList.contains('is-liked')
            )
        );

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

        // 4b) Desar la ràdio com a llista: surt a «Les teves llistes» i a la biblioteca i persisteix en recarregar
        const llistaDesada = await nova.page.evaluate(() => {
            const host = document.createElement('div');
            document.body.appendChild(host);
            SegueixApp.features.musicQueue.render(host);
            const boto = host.querySelector('[data-mq-save-list]');
            const abans = JSON.parse(localStorage.getItem('catube_playlists') || '[]').length;
            boto.click();
            const llistes = JSON.parse(localStorage.getItem('catube_playlists') || '[]');
            const llista = llistes[llistes.length - 1] || {};
            host.remove();
            return {
                abans,
                despres: llistes.length,
                id: llista.id,
                nom: llista.name,
                cancons: (llista.videos || []).length,
                ids: new Set((llista.videos || []).map(v => String(v.id))).size,
                cua: activePlaylistQueue.length,
                formatOk: (llista.videos || []).every(v => v.id && v.title && v.source),
            };
        });
        await nova.page.waitForTimeout(400);
        const avis = await nova.page.evaluate(() => ({
            text: document.getElementById('ptToast')?.textContent || '',
            visible: document.getElementById('ptToast')?.classList.contains('is-visible') || false,
            accio: document.querySelector('#ptToast .pt-toast__action')?.textContent || '',
        }));
        comprovar(
            'el símbol desa la ràdio sencera com a llista de reproducció (una sola llista, sense repetits)',
            llistaDesada.despres === llistaDesada.abans + 1 &&
                /^Ràdio|^La teva ràdio/.test(llistaDesada.nom) &&
                llistaDesada.cancons === llistaDesada.cua &&
                llistaDesada.ids === llistaDesada.cancons &&
                llistaDesada.formatOk,
            llistaDesada
        );
        comprovar(
            'un avís confirma que s’ha desat a les llistes i ofereix obrir-les',
            avis.visible && /desada a les teves llistes/.test(avis.text) && avis.accio === 'Obre',
            avis
        );
        const botoDesat = await nova.page.evaluate(() => {
            const host = document.createElement('div');
            document.body.appendChild(host);
            SegueixApp.features.musicQueue.render(host);
            const boto = host.querySelector('[data-mq-save-list]');
            const estat = { desada: boto.classList.contains('is-saved'), nom: boto.getAttribute('aria-label') };
            boto.click();
            const llistes = JSON.parse(localStorage.getItem('catube_playlists') || '[]');
            host.remove();
            return { ...estat, llistes: llistes.length };
        });
        comprovar(
            'el símbol mostra que ja és desada i tornar-hi a prémer actualitza la mateixa llista',
            botoDesat.desada &&
                /Ràdio desada com a llista/.test(botoDesat.nom) &&
                botoDesat.llistes === llistaDesada.despres,
            botoDesat
        );
        // «Les teves llistes» de la portada la mostra i la biblioteca també (en tocar «Obre» de l'avís)
        await nova.page.click('#ptToast .pt-toast__action').catch(() => {});
        await nova.page.waitForTimeout(800);
        const biblioteca = await nova.page.evaluate(id => {
            const nom = JSON.parse(localStorage.getItem('catube_playlists') || '[]').find(l => l.id === id)?.name || '';
            const visible = el => Boolean(el && el.getClientRects().length);
            return {
                nom,
                alPaginaDeLlistes: [...document.querySelectorAll('#playlistsPage *')].some(
                    el => visible(el) && el.children.length === 0 && el.textContent.trim() === nom
                ),
                alaPortada: Boolean(document.querySelector(`#homePlaylists [data-hp-play="${id}"]`)),
            };
        }, llistaDesada.id);
        comprovar(
            'la llista desada és a «Les teves llistes» de la portada i a la pàgina de llistes',
            biblioteca.alaPortada && biblioteca.alPaginaDeLlistes,
            biblioteca
        );
        comprovar('sense errors de JavaScript (desar com a llista)', nova.errors.length === 0, nova.errors);

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

        await comprovarZonaLliure(page, 'escriptori');
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
                pref: [...item.querySelectorAll('.mq-circle')].map(rect),
                overflow: document.documentElement.scrollWidth - window.innerWidth,
            };
        });
        comprovar(
            'mòbil (390 px): controls ≥ 44 px i sense desbordament',
            mesura.pref.length === 2 && mesura.pref.every(([w, h]) => h >= 44 && w >= 44) && mesura.overflow <= 0,
            mesura
        );
        // El cor de la dreta no tapa cap control (anterior, pausa, següent, finestra flotant) ni a 360 ni a 390 px
        for (const amplada of [360, 390]) {
            await mobil.page.setViewportSize({ width: amplada, height: 800 });
            await mobil.page.waitForTimeout(300);
            const solapa = await mobil.page.evaluate(() => {
                showQueueNextOverlay({ sticky: true });
                document.getElementById('videoPlayer').dataset.playerState = '2';
                const rect = selector => document.querySelector(selector).getBoundingClientRect();
                const heart = rect('.player-heart');
                const player = rect('#videoPlayer');
                const controls = [
                    '.queue-prev-button',
                    '.queue-toggle-button',
                    '.queue-next-button',
                    '.queue-mini-button',
                ].map(rect);
                return {
                    solapa: controls.some(
                        r =>
                            r.left < heart.right && r.right > heart.left && r.top < heart.bottom && r.bottom > heart.top
                    ),
                    mida: Math.round(heart.width),
                    dins: heart.right <= player.right + 0.5,
                    // (l'anterior és amagat a la primera cançó: només compten els botons visibles)
                    controlsMin: Math.round(
                        Math.min(
                            ...controls
                                .slice(0, 3)
                                .map(r => r.width)
                                .filter(w => w > 0)
                        )
                    ),
                };
            });
            comprovar(
                `mòbil (${amplada} px): el cor (≥ 44 px) no tapa cap control i els controls mantenen 44 px`,
                !solapa.solapa && solapa.mida >= 44 && solapa.dins && solapa.controlsMin >= 44,
                solapa
            );
        }
        await comprovarZonaLliure(mobil.page, 'mòbil (390 px)');
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
