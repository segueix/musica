// Verificació en navegador real de la pàgina «La teva música»: historial (tres últimes cançons + expansió per
// dates), artistes seguits i llistes de reproducció; sense categories intel·ligents ni programes.
//
// NO forma part de `npm test`: és una eina opt-in, com verificar-cerca.js. Requisits: playwright-core i
// un Chromium (CHROMIUM_PATH). Ús:  node tests/browser/verificar-la-teva-musica.js
//
// Comprova amb el catàleg real i els scripts reals de l'app:
//   1) L'ordre de la pàgina: Historial, Artistes i Llistes de reproducció (i cap pestanya ni «Categories Intel·ligents»).
//   2) L'historial mostra les tres últimes cançons de costat, amb quan s'han escoltat, i al final un símbol
//      d'expandir (≥ 44 px) que obre el detall per períodes (setmana, mes...) i cada període amplia la llista.
//   3) «Obre tot l'historial» porta a l'historial complet i clicar una cançó la reprodueix.
//   4) Els artistes són només els que se segueixen; obren el seu perfil; «Descobreix-ne més» porta a Artistes,
//      que ja no té la pestanya Programes (i una pestanya desada de «programes» torna a «Tots»).
//   5) Les llistes es veuen a sota amb el formulari de crear-ne.
//   6) Sense dades hi ha missatges clars; al mòbil (390 px) no hi ha desbordament i el símbol continua arribable.

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.MUSICA_TEST_PORT || 8145);
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

async function novaPagina(browser, { width = 1440, height = 900, errors = [] } = {}) {
    const mobile = width <= 768;
    const context = await browser.newContext({
        viewport: { width, height },
        isMobile: mobile,
        hasTouch: mobile,
        serviceWorkers: 'block',
    });
    await context.addInitScript(() => {
        // about:blank (que s'usa per forçar una recàrrega real) no té emmagatzematge
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
    return { context, page, errors };
}

async function obrir(page) {
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
    await page.waitForTimeout(500);
}

// Historial de 10 cançons (fa 12 min, 3 h, ahir... fa més d'un any), 7 artistes seguits i 2 llistes.
async function sembrar(page) {
    return page.evaluate(() => {
        const songs = currentFeedVideos.filter(v => v.contentType === 'song' && !v.isShort && v.thumbnail).slice(0, 60);
        const now = Date.now();
        const fa = [
            12 * 60e3,
            3 * 3600e3,
            26 * 3600e3,
            3 * 864e5,
            6 * 864e5,
            12 * 864e5,
            25 * 864e5,
            50 * 864e5,
            100 * 864e5,
            400 * 864e5,
        ];
        const history = songs.slice(0, 10).map((v, i) => ({ ...v, viewedAt: new Date(now - fa[i]).toISOString() }));
        localStorage.setItem('catube_history', JSON.stringify(history));
        const ids = [...new Set(songs.map(v => v.channelId))].slice(0, 7);
        localStorage.setItem('catube_follows', JSON.stringify(ids));
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
                { id: 'pl_1', name: 'Per la tarda', videos: songs.slice(10, 16).map(snapshot) },
                { id: 'pl_2', name: 'Ràdio Pop', videos: songs.slice(20, 30).map(snapshot) },
            ])
        );
        return { ids, historyIds: history.map(v => String(v.id)) };
    });
}

async function anarALlistes(page) {
    await page.evaluate(() => document.querySelector('.nav-trigger[data-page="llistes"]').click());
    await page.waitForSelector('#playlistsPage:not(.hidden) .mm-section', { timeout: 8000 });
    await page.waitForTimeout(500);
}

const captura = async (page, nom) => {
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${nom}.png`), fullPage: true });
};

async function main() {
    const server = await serve();
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] });
    try {
        const errors = [];
        let sessio = await novaPagina(browser, { errors });
        let page = sessio.page;
        const reiniciar = async () => {
            await sessio.context.close();
            sessio = await novaPagina(browser, { errors });
            page = sessio.page;
            await obrir(page);
        };
        await obrir(page);
        const dades = await sembrar(page);
        // Recarrega amb les dades (nou context amb el mateix emmagatzematge no és possible: es recarrega la pàgina)
        await page.goto('about:blank');
        await obrir(page);

        // 1) Ordre de la pàgina
        await anarALlistes(page);
        const ordre = await page.evaluate(() => {
            const top = selector => document.querySelector(selector)?.getBoundingClientRect().top ?? null;
            const page = document.getElementById('playlistsPage');
            return {
                historial: top('#myMusic [data-mm-section="history"]'),
                artistes: top('#myMusic [data-mm-section="artists"]'),
                llistes: top('#myMusicPlaylists'),
                titols: [...page.querySelectorAll('.mm-title')].map(el => el.textContent.trim()),
                pestanyes: page.querySelectorAll('.library-tab, #libraryTabs').length,
                intelligent: /ntel·ligent/.test(page.textContent),
            };
        });
        comprovar(
            'l’ordre és Historial, Artistes i Llistes de reproducció',
            ordre.historial < ordre.artistes &&
                ordre.artistes < ordre.llistes &&
                ordre.titols.join('|') === 'Historial|Artistes|Llistes de reproducció',
            ordre
        );
        comprovar('no hi ha pestanyes ni «Categories Intel·ligents»', ordre.pestanyes === 0 && !ordre.intelligent);

        // 2) Les tres últimes cançons de costat, amb quan s'han escoltat, i el símbol d'expandir
        const historial = await page.evaluate(() => {
            const cards = [...document.querySelectorAll('.mm-history-row .mm-card')].map(card => {
                const r = card.getBoundingClientRect();
                return {
                    x: Math.round(r.left),
                    top: Math.round(r.top),
                    w: Math.round(r.width),
                    quan: card.querySelector('.mm-card__when')?.textContent.trim(),
                    titol: card.querySelector('.mm-card__title')?.textContent.trim(),
                };
            });
            const boto = document.querySelector('[data-mm-expand]');
            const b = boto.getBoundingClientRect();
            return {
                cards,
                boto: {
                    x: Math.round(b.left),
                    w: Math.round(b.width),
                    h: Math.round(b.height),
                    expanded: boto.getAttribute('aria-expanded'),
                    nom: boto.getAttribute('aria-label'),
                    text: boto.textContent.trim(),
                },
            };
        });
        comprovar(
            'l’historial mostra tres cançons de costat (mateixa línia) amb quan s’han escoltat',
            historial.cards.length === 3 &&
                historial.cards.every(c => c.top === historial.cards[0].top && c.w > 100) &&
                historial.cards[0].x < historial.cards[1].x &&
                historial.cards[1].x < historial.cards[2].x &&
                /^Fa \d+ min$/.test(historial.cards[0].quan) &&
                /^Fa \d+ h$/.test(historial.cards[1].quan) &&
                historial.cards[2].quan === 'Ahir',
            historial.cards.map(c => c.quan)
        );
        comprovar(
            'al final hi ha un símbol d’expandir (≥ 44 px, amb nom accessible i sense text) després de les cançons',
            historial.boto.x > historial.cards[2].x &&
                historial.boto.w >= 44 &&
                historial.boto.h >= 44 &&
                historial.boto.expanded === 'false' &&
                /Mostra més/.test(historial.boto.nom) &&
                historial.boto.text === '',
            historial.boto
        );
        await captura(page, 'la-teva-musica-escriptori');

        // Expandir: períodes clicables que amplien la llista (setmana, mes...)
        await page.click('[data-mm-expand]');
        await page.waitForSelector('#mmHistoryPanel .mm-range');
        const expandit = await page.evaluate(() => ({
            expanded: document.querySelector('[data-mm-expand]').getAttribute('aria-expanded'),
            periodes: [...document.querySelectorAll('.mm-range')].map(el => [
                el.dataset.mmRange,
                Number(el.querySelector('.mm-range__n').textContent),
                el.getAttribute('aria-pressed'),
            ]),
            files: document.querySelectorAll('.mm-row').length,
            dies: [...document.querySelectorAll('.mm-day')].map(el => el.textContent.trim()),
        }));
        comprovar(
            'el símbol expandeix l’historial per períodes (setmana per defecte) agrupat per dies',
            expandit.expanded === 'true' &&
                expandit.periodes[0][0] === 'week' &&
                expandit.periodes[0][2] === 'true' &&
                expandit.files === expandit.periodes[0][1] &&
                expandit.dies[0] === 'Avui' &&
                expandit.dies.includes('Ahir'),
            expandit
        );
        const files = {};
        for (const id of ['month', 'quarter', 'all']) {
            if (!(await page.$(`[data-mm-range="${id}"]`))) continue;
            await page.click(`[data-mm-range="${id}"]`);
            files[id] = await page.evaluate(() => document.querySelectorAll('.mm-row').length);
        }
        comprovar(
            'cada període amplia la llista fins a tot l’historial (10 cançons)',
            files.month > expandit.files &&
                files.all === 10 &&
                files.month <= (files.quarter || files.all) &&
                (files.quarter || files.all) <= files.all,
            { setmana: expandit.files, ...files }
        );
        await captura(page, 'la-teva-musica-expandit');
        await page.click('[data-mm-expand]');
        comprovar('tornar a prémer el símbol amaga l’historial', (await page.$$('.mm-row')).length === 0);

        // 5) Llistes de reproducció i formulari
        const llistes = await page.evaluate(() => ({
            targetes: document.querySelectorAll('#playlistsList .playlist-card').length,
            formulari: Boolean(
                document.querySelector('#myMusicPlaylists #playlistNameInput') &&
                document.querySelector('#myMusicPlaylists #createPlaylistBtn')
            ),
        }));
        comprovar(
            'a sota hi ha les llistes de reproducció i el formulari per crear-ne',
            llistes.targetes === 2 && llistes.formulari,
            llistes
        );

        // 4) Artistes: només els seguits; obren el perfil; Descobreix-ne més → Artistes sense Programes
        const artistes = await page.evaluate(ids => {
            const feed = new Map(YouTubeAPI.feedChannels.map(c => [String(c.id), c.name]));
            const mostrats = [...document.querySelectorAll('.mm-artist')].map(el => el.dataset.mmArtist);
            return {
                mostrats: mostrats.length,
                esperats: ids.filter(id => feed.has(String(id))).length,
                nomesSeguits: mostrats.every(id => ids.map(String).includes(id)),
                noSeguitAlFeed: YouTubeAPI.feedChannels.some(c => !ids.map(String).includes(String(c.id))),
                programes: /rograma/i.test(document.querySelector('[data-mm-section="artists"]').textContent),
                ordenats: mostrats
                    .map(id => feed.get(id))
                    .every(
                        (nom, i, llista) =>
                            i === 0 || llista[i - 1].localeCompare(nom, 'ca', { sensitivity: 'base' }) <= 0
                    ),
            };
        }, dades.ids);
        comprovar(
            'els artistes són només els que se segueixen (en ordre alfabètic), sense programes',
            artistes.mostrats === artistes.esperats &&
                artistes.mostrats > 0 &&
                artistes.nomesSeguits &&
                artistes.noSeguitAlFeed &&
                !artistes.programes &&
                artistes.ordenats,
            artistes
        );
        await page.click('.mm-artist');
        await page.waitForSelector('#channelPage:not(.hidden)', { timeout: 8000 });
        comprovar('clicar un artista obre el seu perfil', true);
        await reiniciar();
        await sembrar(page);
        await page.goto('about:blank');
        await obrir(page);
        await anarALlistes(page);
        await page.click('[data-mm-all-artists]');
        await page.waitForSelector('#followPage:not(.hidden)', { timeout: 8000 });
        const seguits = await page.evaluate(() => {
            const pestanyes = [...document.querySelectorAll('#followTabs .follow-tab')].map(el => el.dataset.followTab);
            setActiveFollowTab('programes');
            return {
                pestanyes,
                desada: activeFollowTab,
                text: /rograme/.test(document.getElementById('followPage').textContent),
            };
        });
        comprovar(
            'Descobreix-ne més porta a Artistes, que només té «Tots» i «Seguint» (una pestanya «programes» torna a «Tots»)',
            seguits.pestanyes.join('|') === 'all|following' && seguits.desada === 'all' && !seguits.text,
            seguits
        );

        // 3) Obre tot l'historial i reprodueix una cançó
        await reiniciar();
        await sembrar(page);
        await page.goto('about:blank');
        await obrir(page);
        await anarALlistes(page);
        await page.click('[data-mm-expand]');
        await page.click('[data-mm-open-history]');
        await page.waitForSelector('#historyPage:not(.hidden)', { timeout: 8000 });
        comprovar('«Obre tot l’historial» porta a l’historial complet', true);
        // La navegació té un antirebot de 500 ms contra tocs ràpids
        await page.waitForTimeout(700);
        await page.evaluate(() => document.querySelector('.nav-trigger[data-page="llistes"]').click());
        await page.waitForSelector('#playlistsPage:not(.hidden) .mm-card');
        await page.evaluate(() => {
            window.__startFrom = [];
            const queue = SegueixApp.features.musicQueue;
            const original = queue.startFrom;
            queue.startFrom = (...args) => {
                window.__startFrom.push(String(args[0]));
                return original(...args);
            };
        });
        const primera = await page.evaluate(() => document.querySelector('.mm-card').dataset.mmPlay);
        await page.click('.mm-card');
        await page.waitForTimeout(600);
        comprovar(
            'clicar una cançó de l’historial la reprodueix (una sola vegada)',
            (await page.evaluate(() => window.__startFrom)).join(',') === primera,
            primera
        );

        comprovar('cap error de JavaScript a l’escriptori', errors.length === 0, errors);

        // 6) Sense dades: missatges clars
        await reiniciar();
        await anarALlistes(page);
        const buit = await page.evaluate(() => ({
            historial: document.querySelector('[data-mm-section="history"]').textContent.replace(/\s+/g, ' ').trim(),
            artistes: document.querySelector('[data-mm-section="artists"]').textContent.replace(/\s+/g, ' ').trim(),
            simbol: Boolean(document.querySelector('[data-mm-expand]')),
            llistes: document.getElementById('playlistsList').textContent.replace(/\s+/g, ' ').trim(),
        }));
        comprovar(
            'sense dades: missatges clars a cada secció i cap símbol d’expandir',
            /Encara no has escoltat cap cançó/.test(buit.historial) &&
                /Encara no segueixes cap artista/.test(buit.artistes) &&
                /Descobreix artistes/.test(buit.artistes) &&
                !buit.simbol &&
                /Encara no tens cap llista/.test(buit.llistes),
            buit
        );

        // Mòbil
        const errorsMobil = [];
        const mobil = await novaPagina(browser, { width: 390, height: 844, errors: errorsMobil });
        await obrir(mobil.page);
        await sembrar(mobil.page);
        await mobil.page.goto('about:blank');
        await obrir(mobil.page);
        await anarALlistes(mobil.page);
        const mesura = await mobil.page.evaluate(() => {
            const fila = document.querySelector('.mm-history-row');
            const boto = document.querySelector('[data-mm-expand]').getBoundingClientRect();
            return {
                desbordament: document.documentElement.scrollWidth - window.innerWidth,
                filaDesplacable: fila.scrollWidth > fila.clientWidth,
                boto: [Math.round(boto.width), Math.round(boto.height)],
                artistes: [...document.querySelectorAll('.mm-artist')].every(
                    el => el.getBoundingClientRect().height >= 44
                ),
                rang: document.querySelector('[data-mm-expand]') !== null,
            };
        });
        comprovar(
            'mòbil: la pàgina no desborda i les cançons es recorren en horitzontal',
            mesura.desbordament <= 0 && mesura.filaDesplacable,
            mesura
        );
        // El símbol continua arribable: es desplaça la fila fins al final i es pot prémer
        await mobil.page.evaluate(() => {
            const fila = document.querySelector('.mm-history-row');
            fila.scrollLeft = fila.scrollWidth;
        });
        await mobil.page.waitForTimeout(200);
        await mobil.page.tap('[data-mm-expand]');
        await mobil.page.waitForSelector('#mmHistoryPanel .mm-range');
        const mobilExpandit = await mobil.page.evaluate(() => ({
            desbordament: document.documentElement.scrollWidth - window.innerWidth,
            periodes: [...document.querySelectorAll('.mm-range')].every(el => el.getBoundingClientRect().height >= 44),
            files: [...document.querySelectorAll('.mm-row')].every(el => el.getBoundingClientRect().height >= 44),
        }));
        comprovar(
            'mòbil: el símbol és arribable, expandeix sense desbordar i els controls fan ≥ 44 px',
            mobilExpandit.desbordament <= 0 &&
                mobilExpandit.periodes &&
                mobilExpandit.files &&
                mesura.boto[0] >= 44 &&
                mesura.boto[1] >= 44,
            { mesura: mesura.boto, mobilExpandit }
        );
        await captura(mobil.page, 'la-teva-musica-mobil');
        comprovar('cap error de JavaScript al mòbil', errorsMobil.length === 0, errorsMobil);
        await mobil.context.close();
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\n✅ La teva música verificada.' : '\n❌ Hi ha comprovacions fallides.');
    process.exit(correcte ? 0 : 1);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
