// Verificació en un navegador real de l'ordre d'Inici en tres blocs (2026-10-22).
//
// NO forma part de `npm test`: és una eina opt-in. Requisits: npm i --no-save playwright-core i un Chromium
// (CHROMIUM_PATH=/ruta/al/chrome si no és a la ubicació per defecte).
//
// Ús:  node tests/browser/verificar-ordre-inici.js
//      ORDRE_SHOTS=/ruta/captures node tests/browser/verificar-ordre-inici.js
//
// A 1280 px i a 390 px: qui és nou té «Tria el teu so» primer; amb historial, el teu («Torna-hi», «Les teves
// llistes»), ara mateix («Acabades de sortir», «Llista d'èxits», «En directe») i per descobrir («Fora del teu radar»,
// «A prop teu», «Tria el teu so»). «Les teves llistes» va dins la portada, «Crea una llista» hi funciona i en tornar
// d'un estil hi torna a ser.

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
const OUT = process.env.ORDRE_SHOTS || '';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const f = path.join(ROOT, u === '/' ? '/index.html' : u);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        res.writeHead(404);
        return res.end();
    }
    res.writeHead(200, {
        'content-type': f.endsWith('.js')
            ? 'application/javascript'
            : f.endsWith('.css')
              ? 'text/css'
              : f.endsWith('.json')
                ? 'application/json'
                : 'text/html',
    });
    fs.createReadStream(f).pipe(res);
});
let ok = true;
const check = (l, c, d) => {
    if (!c) ok = false;
    console.log(`${c ? '✅' : '❌'} ${l}`, d !== undefined ? JSON.stringify(d) : '');
};
const order = p =>
    p.evaluate(() =>
        [...document.querySelectorAll('#homePage .pt-sections > [data-pt-section]')]
            .filter(s => !s.hidden)
            .map(s => s.dataset.ptSection)
    );
(async () => {
    await new Promise(r => server.listen(Number(process.env.ORDRE_TEST_PORT || 8174), r));
    const b = await chromium.launch({ executablePath: CHROMIUM_PATH });
    for (const [w, h] of [
        [1280, 900],
        [390, 844],
    ]) {
        const ctx = await b.newContext({
            viewport: { width: w, height: h },
            isMobile: w < 800,
            hasTouch: w < 800,
            serviceWorkers: 'block',
        });
        await ctx.addInitScript(() => {
            try {
                localStorage.setItem(
                    'segueix_cookie_consent_v2',
                    JSON.stringify({
                        version: 1,
                        status: 'accepted',
                        source: 'test',
                        updatedAt: new Date().toISOString(),
                    })
                );
            } catch (_) {}
        });
        const p = await ctx.newPage();
        const errors = [];
        p.on('pageerror', e => errors.push(e.message));
        await p.route(/^https:\/\/i\.ytimg\.com/, r => r.continue());
        await p.route(/^https?:\/\/(?!localhost|i\.ytimg\.com)/, r => r.abort());
        await p.goto(`http://localhost:${Number(process.env.ORDRE_TEST_PORT || 8174)}/`);
        await p.waitForSelector('[data-pt-section="chart"]:not([hidden])', { timeout: 30000 });
        let seen = await order(p);
        check(
            `${w}: nou → «Tria el teu so» primer`,
            seen[0] === 'styles' && seen[1] === 'lead' && seen[2] === 'playlists',
            seen
        );
        // Amb historial i una llista
        await p.evaluate(() => {
            const songs = currentFeedVideos
                .filter(v => v.contentType === 'song' && !v.isShort)
                .slice(0, 6)
                .map((v, i) => ({ ...v, viewedAt: new Date(Date.now() - i * 60000).toISOString() }));
            localStorage.setItem('catube_history', JSON.stringify(songs));
            localStorage.setItem(
                'catube_playlists',
                JSON.stringify([
                    { id: 'pl_prova', name: 'Prova ordre', videos: songs.slice(0, 4), createdAt: Date.now() },
                ])
            );
        });
        await p.reload();
        await p.waitForSelector('[data-pt-section="chart"]:not([hidden])', { timeout: 30000 });
        seen = await order(p);
        const expected = ['lead', 'playlists', 'fresh', 'chart', 'live', 'radar', 'near', 'styles'].filter(k =>
            seen.includes(k)
        );
        check(
            `${w}: amb historial → el teu, ara mateix, per descobrir`,
            JSON.stringify(seen) === JSON.stringify(expected) && seen[0] === 'lead',
            seen
        );
        check(
            `${w}: la llista surt a «Les teves llistes»`,
            await p.evaluate(() => Boolean(document.querySelector('#homePlaylists [data-hp-play="pl_prova"]')))
        );
        check(
            `${w}: només hi ha una #homePlaylists`,
            await p.evaluate(() => document.querySelectorAll('#homePlaylists').length === 1)
        );
        const lead = await p.$('[data-pt-section="lead"]');
        await lead.scrollIntoViewIfNeeded();
        await p.waitForTimeout(800);
        if (OUT) await p.screenshot({ path: path.join(OUT, `ordre-inici-${w}.png`) });
        // Crea una llista des de la portada
        await p.click('#homePlaylists [data-hp-add]');
        await p.fill('#homePlaylists .hp-add-input', 'Nova des d’Inici');
        await p.click('#homePlaylists .hp-add-ok');
        await p.waitForTimeout(400);
        check(
            `${w}: «Crea una llista» funciona dins la portada`,
            await p.evaluate(() =>
                [...document.querySelectorAll('#homePlaylists .hp-name')].some(e => e.textContent.includes('Nova des'))
            )
        );
        // Vés a un estil i torna a Inici
        await p.evaluate(() => SegueixApp.features.shellNav?.openStyle?.('Pop'));
        await p.waitForTimeout(1500);
        check(
            `${w}: a un estil no hi ha «Les teves llistes»`,
            await p.evaluate(() => !document.querySelector('#homePlaylists'))
        );
        await p.evaluate(() =>
            document
                .querySelector('[data-pt-nav="home"], .nav-trigger[data-page="home"], [data-cat="Novetats"]')
                ?.click()
        );
        await p.waitForSelector('#homePlaylists [data-hp-play="pl_prova"]', { timeout: 15000 }).catch(() => {});
        check(
            `${w}: en tornar a Inici hi torna a ser`,
            await p.evaluate(() => Boolean(document.querySelector('#homePage .pt-sections > #homePlaylists'))),
            await order(p)
        );
        check(`${w}: sense errors de JS`, errors.length === 0, errors);
        await ctx.close();
    }
    await b.close();
    server.close();
    process.exit(ok ? 0 : 1);
})();
