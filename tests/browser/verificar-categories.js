// Verificació end-to-end de «Les teves categories» (js/features/user-categories.js) en un navegador real (Chromium).
//
// NO forma part de `npm test`: és una eina opt-in, com verificar-portada.js.
// Requisits (no són dependències del projecte):
//   npm i --no-save playwright-core sortablejs@1.15.6 lz-string@1.5.0
//   Un binari de Chromium (CHROMIUM_PATH=/ruta/al/chrome si no és a la ubicació per defecte)
//
// Ús:  node tests/browser/verificar-categories.js
//      CATEGORIES_SHOTS=/ruta/captures node tests/browser/verificar-categories.js
//
// Comprova (390 px, tàctil):
//   1) Crear una categoria des de «Tria el teu so» (un nom d'estil es rebutja) i que surti amb els estils.
//   2) Afegir-hi dos grups des de la fitxa de l'artista.
//   3) Reordenar amb el dit (mantenir premut i arrossegar, esdeveniments tàctils reals) i amb Alt + fletxa; l'ordre es
//      desa i passa a la barra d'estils.
//   4) La vista de la categoria (títol propi i cançons dels grups), la ràdio i el missatge de compartir amb el nom.
//   5) Obrir l'enllaç compartit en un altre navegador (1280 px): previsualització amb els grups, importar i veure-la a Inici.

const http = require('http');
const fs = require('fs');
const path = require('path');
let chromium;
try {
    ({ chromium } = require('playwright-core'));
} catch (_) {
    console.log('⏭️  playwright-core no instal·lat: verificació omesa.');
    process.exit(0);
}
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CATEGORIES_TEST_PORT || 8143);
const OUT = process.env.CATEGORIES_SHOTS || '';
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
};
const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const f = path.join(ROOT, u === '/' ? '/index.html' : u);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        res.writeHead(404);
        return res.end();
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
});
const libs = {
    sortablejs: (() => {
        try {
            return fs.readFileSync(ROOT + '/node_modules/sortablejs/Sortable.min.js', 'utf8');
        } catch (e) {
            console.log('⏭️  sortablejs no instal·lat: verificació omesa.');
            process.exit(0);
        }
    })(),
};
let lz = null;
try {
    lz = fs.readFileSync(ROOT + '/node_modules/lz-string/libs/lz-string.min.js', 'utf8');
} catch (e) {}
let correcte = true;
const ok = (l, c, d) => {
    if (!c) correcte = false;
    console.log(`${c ? '✅' : '❌'} ${l}`, d !== undefined ? JSON.stringify(d) : '');
};
async function newPage(browser, w, h, url = '/') {
    const mobile = w <= 768;
    const ctx = await browser.newContext({
        viewport: { width: w, height: h },
        isMobile: mobile,
        hasTouch: mobile,
        serviceWorkers: 'block',
    });
    await ctx.addInitScript(() => {
        if (localStorage.getItem('__s')) return;
        localStorage.setItem(
            'segueix_cookie_consent_v2',
            JSON.stringify({ version: 1, status: 'accepted', source: 'test', updatedAt: new Date().toISOString() })
        );
        localStorage.setItem('__s', '1');
        window.__shared = null;
        Object.defineProperty(navigator, 'share', {
            value: async d => {
                window.__shared = d;
            },
            configurable: true,
        });
        window.confirm = () => true;
    });
    const page = await ctx.newPage();
    await page.route(/^https?:\/\/(?!localhost)/, r => {
        const u = r.request().url();
        if (/sortablejs/.test(u))
            return r.fulfill({ status: 200, contentType: 'application/javascript', body: libs.sortablejs });
        if (/lz-string/.test(u) && lz)
            return r.fulfill({ status: 200, contentType: 'application/javascript', body: lz });
        if (/youtube/.test(u)) return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html>' });
        return r.abort();
    });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://localhost:${PORT}${url}`);
    await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
    await page.waitForTimeout(900);
    await page.evaluate(() => document.getElementById('intro-splash')?.remove());
    return { ctx, page, errors };
}
const labels = page =>
    page.evaluate(() =>
        [...document.querySelectorAll('#ptStyles .pt-style-cell:not([hidden]) [data-pt-style]')].map(
            b => b.dataset.ptStyle
        )
    );
server.listen(PORT, async () => {
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
    const { ctx, page, errors } = await newPage(browser, 390, 844);
    // 1. crear des de la portada
    await page.click('[data-uc-create]');
    await page.fill('#ucCreateName', 'Pop');
    await page.click('.uc-dialog button[type=submit]');
    ok('nom d’estil rebutjat', await page.isVisible('#ucCreateError'), await page.textContent('#ucCreateError'));
    await page.fill('#ucCreateName', 'Festa major');
    await page.click('.uc-dialog button[type=submit]');
    await page.waitForTimeout(300);
    let l = await labels(page);
    ok('rajola nova visible amb els estils', l.includes('Festa major'), l);
    // 2. fitxa d’artista
    const ids = await page.evaluate(() =>
        YouTubeAPI.feedChannels
            .slice(0, 80)
            .filter(
                c => !YouTubeAPI.getArtistGroupForChannel(c.id) || YouTubeAPI.getArtistGroupForChannel(c.id).id === c.id
            )
            .filter(c => YouTubeAPI.feedVideos.filter(v => v.channelId === c.id && !v.isShort).length > 3)
            .slice(0, 2)
            .map(c => [c.id, c.name])
    );
    for (const [id] of ids) {
        await page.locator('[data-pt-nav="home"]:visible').first().click();
        await page.waitForTimeout(600);
        await page.evaluate(id => openChannelProfile(id), id);
        await page.waitForTimeout(1500);
        await page.click('#apUserCats [data-uc-toggle]');
        await page.waitForTimeout(200);
    }
    if (OUT) await page.screenshot({ path: path.join(OUT, 'f-artist.png') });
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('catube_music_user_categories')));
    ok('grups afegits a la categoria', stored[0].artists.length === 2, stored);
    // 3. portada i vista
    await page.locator('[data-pt-nav="home"]:visible').first().click();
    await page.waitForTimeout(800);
    await page.evaluate(() => document.querySelector('[data-pt-section="styles"]').scrollIntoView());
    await page.waitForTimeout(300);
    if (OUT) await page.screenshot({ path: path.join(OUT, 'f-home.png') });
    // 4. reordenar amb el dit (CDP touch: mantenir premut i arrossegar)
    l = await labels(page);
    const box = async lab =>
        page.evaluate(lab => {
            const r = [...document.querySelectorAll('#ptStyles [data-pt-style]')]
                .find(b => b.dataset.ptStyle === lab)
                .getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }, lab);
    const a = await box('Festa major'),
        b = await box(l[0]);
    const cdp = await ctx.newCDPSession(page);
    const t = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
    await t('touchStart', a);
    await page.waitForTimeout(450);
    for (let i = 1; i <= 12; i++) {
        await t('touchMove', { x: a.x + ((b.x - a.x) * i) / 12, y: a.y + ((b.y - a.y) * i) / 12 });
        await page.waitForTimeout(30);
    }
    await page.waitForTimeout(200);
    await t('touchEnd');
    await page.waitForTimeout(600);
    const l2 = await labels(page);
    ok('arrossegar amb el dit canvia l’ordre', l2[0] === 'Festa major', l2);
    ok(
        'ordre desat',
        (await page.evaluate(() => JSON.parse(localStorage.getItem('catube_music_home_style_order'))))?.[0] ===
            'Festa major'
    );
    ok(
        'ordre també a la barra d’estils',
        await page.evaluate(() => {
            const c = [...document.querySelectorAll('.chips-bar.home-categories .chip[data-cat]')].map(
                c => c.dataset.cat
            );
            return c.indexOf('Festa major') < c.indexOf('Urban');
        })
    );
    // teclat
    await page.focus('#ptStyles [data-pt-style="Festa major"]');
    await page.keyboard.press('Alt+ArrowRight');
    await page.waitForTimeout(200);
    const l3 = await labels(page);
    ok('Alt+fletxa mou la rajola', l3[1] === 'Festa major', l3.slice(0, 3));
    // 5. obrir la categoria
    await page.click('#ptStyles [data-pt-style="Festa major"]');
    await page.waitForTimeout(1500);
    ok(
        'vista de la categoria amb títol propi',
        await page.isVisible('.uc-page__name'),
        await page.textContent('#pageTitle, .page-title').catch(() => '')
    );
    const cards = await page.evaluate(() => document.querySelectorAll('#videosGrid [data-video-id]').length);
    ok('vista amb cançons dels grups', cards > 0, cards);
    if (OUT) await page.screenshot({ path: path.join(OUT, 'f-cat.png') });
    // 6. compartir
    await page.click('[data-uc-share]');
    await page.waitForTimeout(300);
    await page.click('#shareOptShare');
    await page.waitForTimeout(300);
    const shared = await page.evaluate(() => window.__shared);
    ok(
        'missatge amb el nom de la categoria',
        /Festa major/.test(shared?.text || '') && /Festa major/.test(shared?.title || ''),
        shared
    );
    await page.evaluate(() => document.querySelector('.modal-overlay')?.remove());
    // 7. ràdio
    await page.click('[data-uc-radio]');
    await page.waitForTimeout(1200);
    ok(
        'ràdio de la categoria',
        await page.evaluate(() => SegueixApp.features.musicQueue.playlistName?.() || ''),
        await page.evaluate(() => SegueixApp.features.musicQueue.playlistName?.() || '')
    );
    ok('sense errors de JS', errors.length === 0, errors);
    await ctx.close();
    // 8. importar en un altre navegador
    const u = new URL(shared.url);
    const imp = await newPage(browser, 1280, 900, '/?' + u.searchParams.toString());
    await imp.page.waitForSelector('#importDataModal', { timeout: 10000 });
    await imp.page.waitForTimeout(1500);
    if (OUT) await imp.page.screenshot({ path: path.join(OUT, 'f-preview.png') });
    const previ = await imp.page.textContent('#importDataArtists');
    ok('previsualització amb els noms dels grups', previ.split(',').length === 2 && !/UC[\w-]{20}/.test(previ), previ);
    await imp.page.click('#importDataAcceptBtn');
    await imp.page.waitForTimeout(500);
    const importades = await imp.page.evaluate(() =>
        SegueixApp.features.userCategories.list().map(c => c.name + ':' + c.artists.length)
    );
    ok('categoria importada', importades.includes('Festa major:2'), importades);
    await imp.page.evaluate(() => document.querySelector('#importDataModal')?.remove());
    await imp.page.waitForTimeout(300);
    ok('a la portada de qui la rep', (await labels(imp.page)).includes('Festa major'), await labels(imp.page));
    await imp.page.evaluate(() => document.querySelector('[data-pt-section="styles"]').scrollIntoView());
    await imp.page.waitForTimeout(300);
    if (OUT) await imp.page.screenshot({ path: path.join(OUT, 'f-import.png') });
    ok('sense errors (import)', imp.errors.length === 0, imp.errors);
    await browser.close();
    server.close();
    if (!correcte) {
        console.log('❌ Hi ha comprovacions que fallen');
        process.exit(1);
    }
    console.log('✅ Tot correcte');
});
