// Verificació en un navegador real de la còpia JSON de Configuració (2026-10-24): importar SUMA la còpia a les
// dades de l'aparell i una exportació posterior ho porta tot.
//
// NO forma part de `npm test`: és una eina opt-in, com verificar-radio-tardor.js.
// Requisits (no són dependències del projecte):
//   npm i --no-save playwright-core
//   Un binari de Chromium (CHROMIUM_PATH=/ruta/al/chrome si no és a la ubicació per defecte)
//
// Ús:  node tests/browser/verificar-copia-json.js
//
// Comprova, a l'ordinador i al mòbil:
//   1) «Importar .json» demana confirmació dient que no s'esborrarà res i, després, a l'aparell hi ha l'historial,
//      els m'agrada, els seguits i les llistes d'abans més els de la còpia (la llista del mateix nom, ajuntada).
//   2) L'avís diu què s'ha sumat i «La teva música» mostra la cançó importada més recent.
//   3) «Descarregar .json» baixa una còpia amb tot: el que ja hi havia i l'importat.

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
let chromium;
try {
    ({ chromium } = require('playwright-core'));
} catch (_) {
    console.log('⏭️  playwright-core no instal·lat: verificació omesa.');
    process.exit(0);
}
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.COPIA_PORT || 8162);
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
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
let correcte = true;
const ok = (label, condition, detail) => {
    if (!condition) correcte = false;
    console.log(`${condition ? '✅' : '❌'} ${label}`, detail !== undefined ? JSON.stringify(detail) : '');
};

// Cinc cançons de cinc artistes diferents del feed: tres a l'aparell i dues a la còpia (més una que s'hi repeteix)
const feed = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/feed.json'), 'utf8')).videos;
const songs = [];
for (const video of feed) {
    if (video.contentType !== 'song' || video.isShort || songs.some(s => s.channelId === video.channelId)) continue;
    songs.push({ id: video.id, title: video.title, channelId: video.channelId, channelTitle: video.channelTitle });
    if (songs.length === 5) break;
}
const at = day => `2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`;
const DEVICE = {
    catube_history: [
        { ...songs[0], viewedAt: at(20) },
        { ...songs[1], viewedAt: at(19) },
        { ...songs[2], viewedAt: at(18) },
    ],
    catube_liked_videos: [songs[0]],
    catube_follows: [songs[0].channelId],
    catube_playlists: [{ id: 'pl_1', name: 'Estiu', videos: [songs[0]] }],
};
const BACKUP = {
    product: 'segueix-musica',
    v: 1,
    createdAt: at(22),
    data: {
        // La segona cançó de l'aparell hi torna a sonar més tard
        history: [
            { ...songs[3], viewedAt: at(23) },
            { ...songs[1], viewedAt: at(22) },
            { ...songs[4], viewedAt: at(17) },
        ],
        likes: [songs[3]],
        follows: [songs[3].channelId],
        playlists: [
            { id: 'pl_9', name: 'estiu', videos: [songs[3]] },
            { id: 'pl_8', name: 'Hivern', videos: [songs[4]] },
        ],
        categories: [],
        prefs: { v: 1, lessLike: {}, moreLike: {}, blocked: {} },
        stats: { v: 1, songs: {}, artists: {}, recent: [] },
        styles: [],
        mode: '',
        settings: {},
    },
};

async function check(browser, width, height, label) {
    const mobile = width <= 768;
    const ctx = await browser.newContext({
        viewport: { width, height },
        isMobile: mobile,
        hasTouch: mobile,
        serviceWorkers: 'block',
        acceptDownloads: true,
    });
    await ctx.addInitScript(device => {
        if (localStorage.getItem('catube_history')) return;
        localStorage.setItem(
            'segueix_cookie_consent_v2',
            JSON.stringify({ version: 1, status: 'accepted', source: 'test', updatedAt: new Date().toISOString() })
        );
        Object.entries(device).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
    }, DEVICE);
    const page = await ctx.newPage();
    await page.route(/^https?:\/\/(?!localhost)/, route => route.abort());
    const errors = [];
    page.on('pageerror', error => !/localStorage.*Access is denied/.test(error.message) && errors.push(error.message));
    const dialogs = [];
    page.on('dialog', dialog => {
        dialogs.push(dialog.message());
        dialog.accept();
    });
    await page.goto(`http://localhost:${PORT}/`);
    await page.evaluate(() => document.getElementById('intro-splash')?.remove());
    await page.waitForSelector('#homePage .pt-sections', { timeout: 30000 });
    await page.waitForTimeout(1500);

    const file = path.join(os.tmpdir(), `segueix-copia-${process.pid}-${width}.json`);
    fs.writeFileSync(file, JSON.stringify(BACKUP));
    await page.setInputFiles('#configManualFileInput', file);
    await page
        .waitForFunction(() => /sumada/.test(document.getElementById('configManualFeedback')?.textContent || ''), null, {
            timeout: 15000,
        })
        .catch(() => {});
    const after = await page.evaluate(() => {
        const read = key => JSON.parse(localStorage.getItem(key) || 'null');
        return {
            feedback: document.getElementById('configManualFeedback')?.textContent || '',
            history: (read('catube_history') || []).map(v => v.id),
            likes: (read('catube_liked_videos') || []).map(v => v.id),
            follows: read('catube_follows') || [],
            playlists: (read('catube_playlists') || []).map(p => [p.name, p.videos.map(v => v.id)]),
            live: typeof getHistoryItems === 'function' ? getHistoryItems().map(v => v.id) : [],
        };
    });
    ok(`${label}: la confirmació diu que no s'esborrarà res`, /No s’esborrarà res/.test(dialogs[0] || ''), dialogs);
    const expected = [songs[3].id, songs[1].id, songs[0].id, songs[2].id, songs[4].id];
    ok(`${label}: l'historial té el d'abans més el de la còpia, per data`, JSON.stringify(after.history) === JSON.stringify(expected), after.history);
    ok(`${label}: l'app ja el llegeix sumat (sense recarregar)`, JSON.stringify(after.live) === JSON.stringify(expected), after.live);
    ok(
        `${label}: m'agrada i seguits sumats`,
        JSON.stringify(after.likes) === JSON.stringify([songs[0].id, songs[3].id]) &&
            JSON.stringify(after.follows) === JSON.stringify([songs[0].channelId, songs[3].channelId]),
        { likes: after.likes, follows: after.follows }
    );
    ok(
        `${label}: la llista del mateix nom s'ajunta i la nova s'afegeix`,
        JSON.stringify(after.playlists) ===
            JSON.stringify([
                ['Estiu', [songs[0].id, songs[3].id]],
                ['Hivern', [songs[4].id]],
            ]),
        after.playlists
    );
    ok(`${label}: l'avís diu què s'ha sumat`, /2 cançons més a l’historial, 1 m’agrada, 1 artista seguit i 1 llista/.test(after.feedback), after.feedback);

    // «La teva música»: la primera caràtula de l'historial és la cançó importada més recent
    // Capçalera a l'ordinador; navegació inferior al mòbil
    await page
        .locator(mobile ? '.pt-nav-item[data-pt-nav="library"]:visible' : '.nav-trigger[data-page="llistes"]:visible')
        .first()
        .click();
    await page.waitForSelector('#myMusic .mm-card', { timeout: 10000 }).catch(() => {});
    const first = await page.evaluate(() => document.querySelector('#myMusic .mm-card')?.dataset.mmPlay || '');
    ok(`${label}: «La teva música» mostra primer la cançó importada més recent`, first === songs[3].id, first);

    // «Descarregar .json» des de Configuració: la còpia ho porta tot
    await page.click('#backgroundBtn');
    await page.waitForSelector('#exportConfigManualBtn', { state: 'visible', timeout: 10000 });
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#exportConfigManualBtn')]);
    const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    ok(
        `${label}: la còpia descarregada porta el que hi havia i l'importat`,
        JSON.stringify(exported.data.history.map(v => v.id)) === JSON.stringify(expected) &&
            exported.data.likes.length === 2 &&
            exported.data.follows.length === 2 &&
            exported.data.playlists.length === 2,
        {
            history: exported.data.history.length,
            likes: exported.data.likes.length,
            follows: exported.data.follows.length,
            playlists: exported.data.playlists.length,
        }
    );
    ok(`${label}: sense errors`, errors.length === 0, errors);
    fs.rmSync(file, { force: true });
    await ctx.close();
}

server.listen(PORT, async () => {
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
    try {
        await check(browser, 1280, 900, 'ordinador');
        await check(browser, 390, 844, 'mòbil');
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\nTot correcte.' : '\nHi ha errors.');
    process.exit(correcte ? 0 : 1);
});
