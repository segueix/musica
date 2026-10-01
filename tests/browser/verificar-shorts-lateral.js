// Desplaçament natiu de les miniatures dels Shorts (fila i historial).
// Gestos reals via CDP: rapidesa equivalent a l'scroll vertical de la pàgina,
// inèrcia, clics, límits i independència entre els eixos.
// Opt-in: NODE_PATH=<playwright-core> CHROMIUM_PATH=<chromium> node tests/browser/verificar-shorts-lateral.js
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright-core');
const ROOT = path.resolve(__dirname, '../..');

async function checkRow(browser, history, reducedMotion) {
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion,
    });
    try {
        const page = await context.newPage();
        const rowClass = history ? 'shorts-history-carousel' : 'shorts-row';
        const cardClass = history ? 'short-history-item' : 'short-card';
        const cards = Array.from({ length: 18 }, (_, i) =>
            '<button type="button" class="' + cardClass + '">' + (i + 1) + '</button>'
        ).join('');
        await page.setContent(
            '<meta name="viewport" content="width=device-width, initial-scale=1">' +
            '<main style="padding:24px 12px"><h2>Shorts</h2><div class="' + rowClass + '">' + cards +
            '</div><div style="height:1800px">Més contingut</div></main>'
        );
        await page.addStyleTag({ path: path.join(ROOT, 'css/styles.css') });
        await page.addStyleTag({ path: path.join(ROOT, 'css/portada.css') });
        await page.addStyleTag({ path: path.join(ROOT, 'css/spacing-polish.css') });
        await page.addStyleTag({
            content: '.short-history-item{height:196px} .short-card,.short-history-item{color:white;background:#234}',
        });
        await page.evaluate(() => {
            window.__taps = 0;
            document.querySelectorAll('button').forEach(button =>
                button.addEventListener('click', () => window.__taps++)
            );
        });
        const row = page.locator('.' + rowClass);
        const box = await row.boundingBox();
        assert(box, 'Fila visible');
        const x = box.x + box.width * 0.75;
        const y = box.y + Math.min(100, box.height / 2);
        const cdp = await context.newCDPSession(page);
        const send = (type, dx = 0, dy = 0) => cdp.send('Input.dispatchTouchEvent', {
            type,
            touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x: x + dx, y: y + dy }],
        });
        // Mateix recorregut i ritme a cada eix: resposta durant el gest, sense
        // esperar cap temporitzador ni cap animació després de deixar anar.
        await send('touchStart');
        await send('touchMove', -30);
        await page.waitForTimeout(35);
        await send('touchMove', -100);
        await page.waitForTimeout(35);
        const horizontal = await row.evaluate(el => el.scrollLeft);
        assert(horizontal >= 70 && horizontal <= 110, 'La fila segueix el dit sense retard');
        assert.equal(await page.evaluate(() => window.scrollY), 0, 'Un gest lateral no mou la pàgina');
        await send('touchCancel');
        await page.waitForTimeout(300);
        await row.evaluate(el => el.scrollLeft = 0);
        await send('touchStart');
        await send('touchMove', 0, -30);
        await page.waitForTimeout(35);
        await send('touchMove', 0, -100);
        await page.waitForTimeout(35);
        const vertical = await page.evaluate(() => window.scrollY);
        assert(Math.abs(horizontal - vertical) <= 20, 'Rapidesa de seguiment equivalent als dos eixos');
        assert.equal(await row.evaluate(el => el.scrollLeft), 0, 'Un gest vertical deixa quieta la fila');
        await send('touchCancel');
        await page.waitForTimeout(300);
        await page.evaluate(() => window.scrollTo(0, 0));
        // Un impuls conserva la inèrcia i travessa més d'una targeta.
        await send('touchStart');
        await send('touchMove', -20);
        await send('touchMove', -90);
        await send('touchMove', -160);
        const release = await row.evaluate(el => el.scrollLeft);
        await send('touchEnd');
        await page.waitForTimeout(220);
        const momentum = await row.evaluate(el => el.scrollLeft);
        assert(momentum > release + 20, 'La fila conserva la inèrcia del lliscament');
        assert.equal(await page.evaluate(() => window.__taps), 0, 'Arrossegar no obre una miniatura');
        await page.waitForTimeout(1000);
        await row.evaluate(el => el.scrollLeft = 0);
        await page.touchscreen.tap(box.x + 30, y);
        assert.equal(await page.evaluate(() => window.__taps), 1, 'Un toc continua obrint la miniatura');
        await row.evaluate(el => el.scrollLeft = el.scrollWidth);
        await send('touchStart');
        await send('touchMove', -100);
        await send('touchEnd');
        await page.waitForTimeout(250);
        const limit = await row.evaluate(el => ({
            left: el.scrollLeft, max: el.scrollWidth - el.clientWidth,
        }));
        assert(limit.left >= 0 && limit.left <= limit.max + 1, 'Respecta el límit de la fila');
        assert.equal(await page.evaluate(() => window.scrollX), 0, 'La pàgina no es desplaça lateralment');
        console.log('✅ ' + rowClass + ' (' + reducedMotion + '): lateral=' + horizontal +
            'px, vertical=' + vertical + 'px, inèrcia=' + Math.round(momentum - release) + 'px');
    } finally {
        await context.close();
    }
}

async function main() {
    const browser = await chromium.launch({
        executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--no-sandbox'],
    });
    try {
        for (const reducedMotion of ['no-preference', 'reduce']) {
            await checkRow(browser, false, reducedMotion);
            await checkRow(browser, true, reducedMotion);
        }
    } finally {
        await browser.close();
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
