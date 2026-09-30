// Verificació en navegador real de la cerca de Segueix Música (menú desplegable, pàgina de resultats i ràdio).
//
// NO forma part de `npm test`: és una eina opt-in, com verificar-seleccio.js. Requisits: playwright-core i
// un Chromium (CHROMIUM_PATH). Ús:  node tests/browser/verificar-cerca.js
//
// Comprova amb el catàleg real i els scripts reals de l'app:
//   1) El menú posa primer «Genera una ràdio», després Artistes i després Vídeos; s'omple de seguida (sense
//      esperar cap índex d'arxiu) i no parla de Canals ni d'Històric.
//   2) Cap resultat és soroll: totes les cançons coincideixen pel títol, l'artista o els crèdits (mai per la
//      descripció genèrica).
//   3) La pàgina de resultats té la ràdio a dalt de tot, després Artistes i després Vídeos; el títol no arrossega
//      el text de l'antic popover; no hi ha «Ja vistos», «Històric» ni accions de categoria personalitzada.
//   4) Fer diverses cerques seguides no acumula listeners: un clic en una cançó obre una sola reproducció.
//   5) «Genera una ràdio» (pàgina i menú) engega una ràdio només amb les cançons trobades, sense estil fix,
//      barrejant estils, amb el nom de la cerca; «Barreja» continua dins dels resultats.
//   6) Al mòbil (390 px): el menú no desborda, la fila de ràdio fa ≥ 44 px i funciona en tocar-la.

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CERCA_TEST_PORT || 8144);
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.CERCA_TEST_SHOTS || '';

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
        if (localStorage.getItem('__cerca_seed')) return;
        localStorage.setItem(
            'segueix_cookie_consent_v2',
            JSON.stringify({ version: 1, status: 'accepted', source: 'test', updatedAt: new Date().toISOString() })
        );
        localStorage.setItem('__cerca_seed', '1');
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
    await page.waitForTimeout(600);
}

async function captura(page, nom) {
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${nom}.png`) });
}

// Estructura del menú desplegable: seccions en ordre i files.
const llegirMenu = page =>
    page.evaluate(() => {
        const dropdown = document.getElementById('searchDropdown');
        const sections = Array.from(dropdown.querySelectorAll('.search-section')).map(section => ({
            nom: section.querySelector('h4')?.textContent || section.getAttribute('aria-label'),
            files: Array.from(section.querySelectorAll('.search-result-item')).map(item => ({
                tipus: item.dataset.resultType,
                text: item.querySelector('.name, .title')?.textContent || '',
                alcada: Math.round(item.getBoundingClientRect().height),
            })),
        }));
        const box = dropdown.getBoundingClientRect();
        return {
            visible: dropdown.classList.contains('is-visible'),
            sections,
            text: dropdown.textContent,
            dins: box.left >= 0 && box.right <= window.innerWidth + 0.5,
        };
    });

async function escriure(page, text) {
    await page.fill('.search-input', '');
    await page.fill('.search-input', text);
}

async function main() {
    const server = await serve();
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] });
    try {
        // Cada fase és un context nou: l'app desa l'últim vídeo en tancar la pàgina i el reobriria en tornar.
        const errors = [];
        let sessio = await novaPagina(browser, { errors });
        let page = sessio.page;
        const reiniciar = async () => {
            await sessio.context.close();
            sessio = await novaPagina(browser, { errors });
            page = sessio.page;
            await obrir(page);
        };
        await reiniciar();

        // 1) Menú: ràdio → artistes → vídeos, immediat i sense herència
        const abans = Date.now();
        await escriure(page, 'judit');
        await page.waitForSelector('#searchDropdown.is-visible .search-result-item', { timeout: 3000 });
        const temps = Date.now() - abans;
        const menu = await llegirMenu(page);
        const noms = menu.sections.map(section => section.nom);
        comprovar('el menú s’omple de seguida (sense esperar cap índex d’arxiu)', temps < 1000, { ms: temps });
        comprovar(
            'menú: primer la ràdio, després Artistes i després Vídeos',
            noms.slice(0, 3).join('|') === 'Ràdio|Artistes|Vídeos',
            noms
        );
        comprovar(
            'menú: la fila de ràdio és la primera i és una ràdio',
            menu.sections[0].files[0].tipus === 'radio',
            menu.sections[0]
        );
        comprovar(
            'menú: els artistes són artistes (un possible artista coincideix amb «judit»)',
            menu.sections[1].files.length > 0 && menu.sections[1].files.every(file => /judit/i.test(file.text)),
            menu.sections[1]
        );
        comprovar(
            'menú: sense «Canals», «Històric» ni subscriptors',
            !/Canals|Històric|ubscriptors/.test(menu.text),
            menu.text.slice(0, 120)
        );
        await captura(page, 'cerca-menu-escriptori');

        // 2) Cap resultat és soroll: títol, artista o crèdits (mai la descripció genèrica)
        const soroll = await page.evaluate(() => {
            const results = SegueixApp.features.searchResults;
            const feed = new Map(YouTubeAPI.feedVideos.map(video => [String(video.id), video]));
            const dolents = [];
            for (const query of ['judit', 'pop', 'amor', 'manel', 'mou-te', 'la fúmiga', 'nit']) {
                const model = buildSearchModel(query);
                const norm = results.normalize(query);
                const tokens = norm.split(' ');
                model.songs.forEach(song => {
                    const video = feed.get(String(song.id)) || song;
                    const text = ` ${results.normalize(`${video.title} ${video.channelTitle} ${results.creditsOf(video)}`)} `;
                    // Cada paraula ha de ser al títol/artista/crèdits (l'última pot ser un principi)
                    const ok =
                        tokens.every((token, index) =>
                            text.includes(index === tokens.length - 1 ? ` ${token}` : ` ${token} `)
                        ) || text.includes(norm);
                    if (!ok) dolents.push({ query, id: song.id, title: video.title, artist: video.channelTitle });
                });
            }
            return dolents;
        });
        comprovar(
            'cap cançó trobada és soroll (només títol, artista o crèdits)',
            soroll.length === 0,
            soroll.slice(0, 3)
        );

        // 3) Pàgina de resultats
        await page.press('.search-input', 'Enter');
        await page.waitForSelector('#videosGrid [data-search-results]', { timeout: 5000 });
        await page.waitForTimeout(300);
        const pagina = await page.evaluate(() => {
            const root = document.querySelector('#videosGrid [data-search-results]');
            const children = Array.from(root.children).map(el =>
                el.classList.contains('search-radio-bar') ? 'ràdio' : el.querySelector('h2')?.textContent || el.tagName
            );
            return {
                ordre: children,
                titol: document.getElementById('pageTitle').textContent.trim().replace(/\s+/g, ' '),
                text: root.textContent,
                seguir: root.querySelectorAll('.search-channel-card [data-follow-channel]').length,
                cards: root.querySelectorAll('.video-card').length,
                accions: document.querySelectorAll(
                    '[data-action="toggle-search-category"], [data-action="manage-category-youtubers"], [data-action="search-info"], .search-info-popover'
                ).length,
                radioAlcada: Math.round(root.querySelector('.search-radio-btn').getBoundingClientRect().height),
            };
        });
        comprovar(
            'pàgina: la ràdio és a dalt de tot, després Artistes i després Vídeos',
            pagina.ordre.join('|') === 'ràdio|Artistes|Vídeos',
            pagina.ordre
        );
        comprovar(
            'pàgina: el títol és net (sense el text de l’antic popover)',
            pagina.titol === 'Resultats per: "judit"',
            pagina.titol
        );
        comprovar(
            'pàgina: sense «Ja vistos», «Històric», «Canals» ni accions de categoria personalitzada',
            !/Ja vistos|Històric|Canals/.test(pagina.text) && pagina.accions === 0,
            pagina.accions
        );
        comprovar(
            'pàgina: els artistes tenen botó Segueix i hi ha targetes de vídeo',
            pagina.seguir > 0 && pagina.cards > 0,
            { seguir: pagina.seguir, cards: pagina.cards }
        );
        comprovar('pàgina: el botó de ràdio és tàctil (≥ 44 px)', pagina.radioAlcada >= 44, pagina.radioAlcada);
        await captura(page, 'cerca-pagina-escriptori');

        // 4) Sense listeners acumulats: un clic en una cançó = una sola reproducció
        for (const query of ['amor', 'manel', 'judit']) {
            await escriure(page, query);
            await page.press('.search-input', 'Enter');
            await page.waitForSelector('#videosGrid [data-search-results] .video-card', { timeout: 5000 });
        }
        await page.evaluate(() => {
            window.__startFromCalls = 0;
            const queue = SegueixApp.features.musicQueue;
            const original = queue.startFrom;
            queue.startFrom = (...args) => {
                window.__startFromCalls += 1;
                return original(...args);
            };
        });
        await page.click('#videosGrid [data-search-results] .video-card .video-thumbnail');
        await page.waitForTimeout(800);
        const crides = await page.evaluate(() => window.__startFromCalls);
        comprovar('després de tres cerques, un clic en una cançó l’obre una sola vegada', crides === 1, crides);

        // 5) Ràdio des de la pàgina de resultats (estils barrejats)
        await reiniciar();
        await escriure(page, 'amor');
        await page.press('.search-input', 'Enter');
        await page.waitForSelector('#videosGrid [data-search-results] .search-radio-btn', { timeout: 5000 });
        const trobades = await page.evaluate(() => buildSearchModel('amor').songs.map(song => String(song.id)));
        await page.click('.search-radio-btn');
        await page.waitForFunction(() => activePlaylistId === '__music_queue__', null, { timeout: 8000 });
        const radio = await page.evaluate(() => {
            const queue = SegueixApp.features.musicQueue;
            const state = queue.getState();
            const music = window.SegueixMusicCategories;
            const estils = new Set(
                activePlaylistQueue.map(video => music?.primaryCategoryForChannel?.(video.channelId) || 'n/d')
            );
            return {
                ids: activePlaylistQueue.map(video => String(video.id)),
                search: state.search,
                categories: state.categories,
                isRadio: state.isRadio,
                estils: Array.from(estils),
                nom: document.querySelector('.mq-source')?.textContent || '',
                primera: String(activePlaylistQueue[0]?.id),
            };
        });
        comprovar(
            'ràdio de cerca: només les cançons trobades',
            radio.ids.length > 1 &&
                radio.ids.every(id => trobades.includes(id)) &&
                new Set(radio.ids).size === radio.ids.length,
            { n: radio.ids.length, trobades: trobades.length }
        );
        comprovar('ràdio de cerca: comença per la millor coincidència', radio.primera === trobades[0], radio.primera);
        comprovar(
            'ràdio de cerca: sense estil fix i barrejant estils',
            radio.categories.length === 0 && radio.estils.length >= 2,
            radio.estils
        );
        comprovar(
            'ràdio de cerca: porta el nom de la cerca',
            radio.search === 'amor' && /Cerca: amor/.test(radio.nom),
            radio.nom
        );
        await page.evaluate(() => SegueixApp.features.musicQueue.regenerate());
        const barreja = await page.evaluate(() => activePlaylistQueue.map(video => String(video.id)));
        comprovar(
            '«Barreja» continua dins dels resultats',
            barreja.every(id => trobades.includes(id)),
            barreja.length
        );
        await captura(page, 'cerca-radio-escriptori');

        // 5b) Ràdio des del menú desplegable
        await reiniciar();
        await escriure(page, 'nit');
        await page.waitForSelector('#searchDropdown .search-radio-item', { timeout: 3000 });
        await page.click('#searchDropdown .search-radio-item');
        await page.waitForFunction(() => activePlaylistId === '__music_queue__', null, { timeout: 8000 });
        const delMenu = await page.evaluate(() => ({
            search: SegueixApp.features.musicQueue.getState().search,
            dropdownObert: document.getElementById('searchDropdown').classList.contains('is-visible'),
            n: activePlaylistQueue.length,
        }));
        comprovar(
            'ràdio des del menú: s’engega i el menú es tanca',
            delMenu.search === 'nit' && !delMenu.dropdownObert && delMenu.n > 1,
            delMenu
        );

        // 5c) Sense resultats: missatge clar i cap ràdio. La portada ha quedat «vella» (hi ha escoltes i una llista
        // nova des que es va pintar): en tornar a Inici es refaria a #videosGrid i trepitjaria els resultats.
        await page.evaluate(() => SegueixApp.features.musicQueue.saveAsPlaylist());
        await escriure(page, 'zzzzqxw');
        await page.press('.search-input', 'Enter');
        await page.waitForSelector('#videosGrid [data-search-results]', { timeout: 5000 });
        await page.waitForTimeout(1200);
        const buida = await page.evaluate(() => ({
            text: document.querySelector('#videosGrid [data-search-results]').textContent.replace(/\s+/g, ' ').trim(),
            radio: Boolean(document.querySelector('.search-radio-btn')),
        }));
        comprovar(
            'sense resultats: missatge clar i sense botó de ràdio',
            /No hem trobat cap artista ni cançó per «zzzzqxw»/.test(buida.text) && !buida.radio,
            buida.text.slice(0, 80)
        );

        comprovar('cap error de JavaScript a l’escriptori', errors.length === 0, errors);

        // 6) Mòbil
        const errorsMobil = [];
        let mobil = await novaPagina(browser, { width: 390, height: 844, errors: errorsMobil });
        await obrir(mobil.page);
        await mobil.page.click('.mobile-search-toggle');
        await mobil.page.waitForTimeout(300);
        await mobil.page.fill('.search-input', 'judit');
        await mobil.page.waitForSelector('#searchDropdown.is-visible .search-radio-item', { timeout: 3000 });
        const menuMobil = await llegirMenu(mobil.page);
        const alcadaRadio = menuMobil.sections[0].files[0].alcada;
        const desbordament = await mobil.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        comprovar(
            'mòbil: el menú és visible i no desborda l’amplada',
            menuMobil.visible && menuMobil.dins && desbordament <= 0,
            { desbordament }
        );
        comprovar(
            'mòbil: la fila de ràdio i les files fan ≥ 44 px',
            alcadaRadio >= 44 && menuMobil.sections.every(s => s.files.every(f => f.alcada >= 44)),
            menuMobil.sections.map(s => s.files.map(f => f.alcada))
        );
        await captura(mobil.page, 'cerca-menu-mobil');
        await mobil.page.tap('#searchDropdown .search-radio-item');
        await mobil.page.waitForFunction(() => activePlaylistId === '__music_queue__', null, { timeout: 8000 });
        comprovar(
            'mòbil: tocar la fila de ràdio engega la ràdio',
            await mobil.page.evaluate(() => SegueixApp.features.musicQueue.getState().search === 'judit')
        );
        // Pàgina de resultats al mòbil
        await mobil.context.close();
        mobil = await novaPagina(browser, { width: 390, height: 844, errors: errorsMobil });
        await obrir(mobil.page);
        await mobil.page.click('.mobile-search-toggle');
        await mobil.page.waitForTimeout(300);
        await mobil.page.fill('.search-input', 'manel');
        await mobil.page.press('.search-input', 'Enter');
        await mobil.page.waitForSelector('#videosGrid [data-search-results] .search-radio-btn', { timeout: 5000 });
        const desbordamentPagina = await mobil.page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth
        );
        comprovar('mòbil: la pàgina de resultats no desborda', desbordamentPagina <= 0, desbordamentPagina);
        await captura(mobil.page, 'cerca-pagina-mobil');
        comprovar('cap error de JavaScript al mòbil', errorsMobil.length === 0, errorsMobil);
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\n✅ Cerca verificada.' : '\n❌ Hi ha comprovacions fallides.');
    process.exit(correcte ? 0 : 1);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
