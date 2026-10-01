// Gestos tàctils en Chromium: DOM i CSS reals dels Shorts, amb un succedani
// de YouTube (aquesta prova no mesura la xarxa ni el buffering del servei).
// Opt-in: NODE_PATH=<playwright-core> CHROMIUM_PATH=<chromium> node tests/browser/verificar-shorts-scroll.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const ROOT = path.resolve(__dirname, '../..');

async function main() {
    const browser = await chromium.launch({
        executablePath: process.env.CHROMIUM_PATH,
        headless: true,
        args: ['--no-sandbox'],
    });
    try {
        for (const reducedMotion of ['no-preference', 'reduce']) {
            const context = await browser.newContext({
                viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion,
            });
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', route => route.fulfill({
                contentType: 'text/html',
                body: '<script>window.addEventListener("message", e => { let p; try { p = JSON.parse(e.data); } catch { return; } if (p.func === "loadVideoById" || p.func === "playVideo") parent.postMessage(JSON.stringify({event:"onStateChange",info:1}), "*"); });</script>',
            }));
            const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
            const start = html.indexOf('<div id="short-modal"');
            const end = html.indexOf('<div id="playlistModal"', start);
            const modal = html.slice(start, end);
            await page.goto('https://musica.test/');
            await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1">' + modal);
            await page.addStyleTag({ path: path.join(ROOT, 'css/styles.css') });
            await page.addStyleTag({ content: '#shortPlayerWrap{height:700px;max-height:700px}' });
            await page.evaluate(() => {
                Object.assign(window, {
                    SegueixApp: { features: {} },
                    currentShortsQueue: [], currentShortIndex: 0, currentPlaylistIndex: 0,
                    activePlaylistQueue: [], isPlaylistMode: false, isNavigatingShort: false,
                    shortScrollHintTimer: null, shortModalScrollY: 0,
                    lockBodyScroll() {}, unlockBodyScroll() {}, refreshIcons() {},
                    addToHistory() {}, applyYouTubeIframePolicy() {},
                    buildYoutubeEmbedUrl: id => 'https://www.youtube.com/embed/' + id,
                    getPreferredThumbnail: () => '',
                    __commands: [],
                });
                window.__queue = ['a', 'b', 'c', 'd'].map(id => ({ id, isShort: true, title: id }));
            });
            await page.addScriptTag({ path: path.join(ROOT, 'js/features/shorts.js') });
            await page.evaluate(() => {
                window.forcedShortsQueue = [...window.__queue];
                SegueixApp.features.shorts.openShortModal('a');
            });
            await page.waitForTimeout(100);
            const cdp = await context.newCDPSession(page);
            const box = await page.locator('#shortGestureOverlay').boundingBox();
            assert(box, 'Overlay tàctil visible');
            const x = box.x + box.width / 2;
            const y = box.y + box.height * 0.7;
            const send = (type, offset = 0) => cdp.send('Input.dispatchTouchEvent', {
                type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y: y + offset }],
            });
            await send('touchStart');
            await send('touchMove', -100);
            await page.waitForTimeout(35);
            const drag = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.getElementById('shortStrip')).transform).m42);
            assert(Math.abs(drag + 100) < 3, 'El panell segueix el dit');
            await send('touchMove', -180);
            await send('touchEnd');
            await page.waitForFunction(() => currentShortIndex === 1 && !isNavigatingShort);
            // Un segon gest després de l'aterratge no espera els antics 800 ms.
            await send('touchStart');
            await send('touchMove', -180);
            await send('touchEnd');
            await page.waitForFunction(() => currentShortIndex === 2 && !isNavigatingShort);
            await send('touchStart');
            await send('touchMove', -80);
            await send('touchCancel');
            await page.waitForTimeout(250);
            assert.equal(await page.evaluate(() => currentShortIndex), 2, 'Cancel·lar no navega');
            await send('touchStart');
            await send('touchEnd');
            assert.equal(await page.locator('#short-iframe').getAttribute('data-short-paused'), 'true', 'El toc pausa');
            await page.evaluate(() => {
                SegueixApp.features.shorts.navigateShort(1);
                SegueixApp.features.shorts.closeShortModal();
                forcedShortsQueue = [__queue[0]];
                SegueixApp.features.shorts.openShortModal('a');
            });
            await page.waitForTimeout(500);
            assert.equal(await page.evaluate(() => currentShortIndex), 0, 'Reobrir no rep callbacks antics');
            assert.deepEqual(errors, [], 'Cap error de JavaScript');
            console.log('✅ Gestos mòbils, pausa, cancel·lació i reobertura (' + reducedMotion + ')');
            await context.close();
        }
    } finally {
        await browser.close();
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
