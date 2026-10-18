// Verificació en un navegador real de la fitxa d'artista (js/features/artist-page.js, redisseny 2026-10-16).
//
// NO forma part de `npm test`: és una eina opt-in, com verificar-artistes-categoria.js.
// Requisits (no són dependències del projecte):
//   npm i --no-save playwright-core sortablejs@1.15.6 lz-string@1.5.0
//   Un binari de Chromium (CHROMIUM_PATH=/ruta/al/chrome si no és a la ubicació per defecte)
//
// Ús:  node tests/browser/verificar-fitxa-artista.js
//      FITXA_SHOTS=/ruta/captures FITXA_CANAL=UC... node tests/browser/verificar-fitxa-artista.js
//
// Comprova, a 390 px i a 1280 px:
//   1) La foto de perfil ocupa tota la capçalera i el nom, les ràdios i compartir hi són al damunt.
//   2) La més escoltada és la cançó amb més visualitzacions; a l'ordinador va al costat de la capçalera.
//   3) La resta de cançons, per visualitzacions (#2, #3…), en quatre columnes a l'ordinador i una sola al mòbil (una
//      sota l'altra), totes amb un marc blanc fi, de caràtules quadrades iguals amb el
//      mínim espai, les dades al damunt (sense el nom del grup al títol), el play i la cua; cap disc, cap cerca, cap
//      text fora de les caràtules. Només dues capçaleres: «Novetats» (si n'hi ha) i, just després, «Les grans
//      cançons» amb un separador, que obre la #2 (2026-10-17).
//   4) La presentació és d'una línia i, si no hi cap, tocar-la la desplega.
//   5) El play d'una cançó engega una ràdio de l'artista que comença per aquella cançó.
//   6) La pàgina no es desborda i no hi ha errors de JavaScript.
// Les imatges de YouTube (i.ytimg.com, yt3.ggpht.com) es deixen carregar si hi ha xarxa (per a les captures).

const http = require('http');
const { execFileSync } = require('child_process');
const photoCache = new Map();
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
const PORT = Number(process.env.FITXA_TEST_PORT || 8149);
const OUT = process.env.FITXA_SHOTS || '';
const CHANNEL = process.env.FITXA_CANAL || 'UC--8TyZ2PM0NFHWXCzQrUqw'; // The Tyets
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
const readLib = file => {
    try {
        return fs.readFileSync(path.join(ROOT, 'node_modules', file), 'utf8');
    } catch (_) {
        return null;
    }
};
const sortable = readLib('sortablejs/Sortable.min.js');
const lz = readLib('lz-string/libs/lz-string.min.js');
let correcte = true;
const ok = (label, condition, detail) => {
    if (!condition) correcte = false;
    console.log(`${condition ? '✅' : '❌'} ${label}`, detail !== undefined ? JSON.stringify(detail) : '');
};

async function openArtist(browser, width, height) {
    const mobile = width <= 768;
    const ctx = await browser.newContext({
        viewport: { width, height },
        isMobile: mobile,
        hasTouch: mobile,
        serviceWorkers: 'block',
    });
    await ctx.addInitScript(() => {
        localStorage.setItem(
            'segueix_cookie_consent_v2',
            JSON.stringify({ version: 1, status: 'accepted', source: 'test', updatedAt: new Date().toISOString() })
        );
    });
    const page = await ctx.newPage();
    await page.route(/^https?:\/\/(?!localhost)/, route => {
        const url = route.request().url();
        if (/sortablejs/.test(url) && sortable)
            return route.fulfill({ status: 200, contentType: 'application/javascript', body: sortable });
        if (/lz-string/.test(url) && lz)
            return route.fulfill({ status: 200, contentType: 'application/javascript', body: lz });
        // Fotos de perfil (yt3): l'entorn de prova respon 429 al navegador si se'n demanen moltes. Es bloquegen les
        // petites (portada) i la gran de la capçalera (=s800) es baixa amb curl, que sí que hi arriba.
        if (/^https:\/\/yt3\.(ggpht|googleusercontent)\.com\//.test(url)) {
            if (!/=s800/.test(url)) return route.abort();
            try {
                if (!photoCache.has(url)) {
                    photoCache.set(url, execFileSync('curl', ['-sS', '--max-time', '15', url], { maxBuffer: 8e6 }));
                }
                return route.fulfill({ status: 200, contentType: 'image/jpeg', body: photoCache.get(url) });
            } catch (_) {
                return route.abort();
            }
        }
        // Caràtules (i.ytimg.com): es baixen des de Node i se serveixen com a imatge (si no, ORB les pot bloquejar)
        if (/^https:\/\/i\.ytimg\.com\//.test(url)) {
            return route
                .fetch()
                .then(response =>
                    route.fulfill({ response, headers: { ...response.headers(), 'content-type': 'image/jpeg' } })
                )
                .catch(() => route.abort());
        }
        return route.abort();
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on(
        'console',
        message => message.type() === 'error' && console.log('   consola:', message.text().slice(0, 160))
    );
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('.pt-sections .pt-section', { timeout: 30000 });
    await page.evaluate(() => document.getElementById('intro-splash')?.remove());
    await page.evaluate(id => window.openChannelProfile(id), CHANNEL);
    await page.waitForSelector('#apSongs:not([hidden]) .ap-card', { timeout: 20000 });
    await page.waitForTimeout(1200);
    return { ctx, page, errors };
}

const layout = page =>
    page.evaluate(() => {
        const rect = el => (el ? el.getBoundingClientRect().toJSON() : null);
        const hero = document.getElementById('apHero');
        const img = document.getElementById('channelProfileAvatar');
        const best = document.getElementById('apBest');
        const songs = [...document.querySelectorAll('#apSongs .ap-card')];
        const views = id => {
            const all = currentChannelLongVideos || [];
            return Number(all.find(video => String(video.id) === id)?.viewCount) || 0;
        };
        const ids = songs.map(row => row.querySelector('[data-ap-play]').dataset.apPlay);
        const maxViews = Math.max(
            ...(currentChannelLongVideos || []).filter(isSongVideo).map(v => Number(v.viewCount) || 0)
        );
        return {
            hero: rect(hero),
            img: rect(img),
            name: rect(document.getElementById('channelProfileName')),
            radio: rect(document.getElementById('apRadioArtist')),
            share: rect(document.getElementById('channelProfileShareBtn')),
            back: rect(document.getElementById('channelBackBtn')),
            youtube: rect(document.getElementById('apYoutubeBtn')),
            youtubeHref: document.getElementById('apYoutubeBtn')?.getAttribute('href') || '',
            best: rect(best),
            bestId: best.querySelector('[data-ap-play]')?.dataset.apPlay || '',
            bestViews: views(best.querySelector('[data-ap-play]')?.dataset.apPlay || ''),
            maxViews,
            songViews: ids.map(views),
            rowsWithPlay: songs.every(
                row => row.querySelector('[data-ap-play]') && row.querySelector('[data-ap-queue]')
            ),
            headings: [...document.querySelectorAll('#channelPage h2')]
                .filter(el => el.offsetParent)
                .map(el => el.textContent.trim()),
            ranks: songs.map(row => row.querySelector('.ap-card__rank')?.textContent.trim()),
            hitsSeparated: (() => {
                const head = document.getElementById('apHitsHead');
                const first = document.querySelector('#apSongs .ap-card');
                if (!head || head.hidden || !first) return false;
                const style = getComputedStyle(head);
                return (
                    parseFloat(style.borderTopWidth) >= 1 &&
                    head.getBoundingClientRect().bottom <= first.getBoundingClientRect().top + 1 &&
                    first.querySelector('.ap-card__rank')?.textContent.trim() === '#2'
                );
            })(),
            columns: new Set(songs.map(row => Math.round(row.getBoundingClientRect().left))).size,
            gap:
                songs.length > 1
                    ? Math.round(songs[1].getBoundingClientRect().left - songs[0].getBoundingClientRect().right)
                    : 0,
            sameSize: new Set(songs.map(row => Math.round(row.getBoundingClientRect().width))).size === 1,
            // El marc blanc és un senyal (2026-10-16): fix a «La més escoltada»; a la resta, només en passar-hi el ratolí
            framed: (() => {
                const best = getComputedStyle(document.querySelector('#apBest .ap-card__art'));
                const rest = [...document.querySelectorAll('#apSongs .ap-card__art')].slice(0, 6);
                return (
                    best.borderTopColor === 'rgb(255, 255, 255)' &&
                    rest.every(art => getComputedStyle(art).borderTopColor !== 'rgb(255, 255, 255)')
                );
            })(),
            rowGap:
                songs.length > 1
                    ? Math.round(songs[1].getBoundingClientRect().top - songs[0].getBoundingClientRect().bottom)
                    : 0,
            // El nom del grup no ha de sortir dins del títol
            titlesWithName: [...document.querySelectorAll('#apSongs .ap-card__title, #apBest .ap-card__title')]
                .map(el => el.textContent)
                .filter(title => title.toLowerCase().includes(currentChannelName.toLowerCase())),
            bioLines: (() => {
                const d = document.getElementById('channelProfileDescription');
                if (!d || !d.offsetParent) return 0;
                return Math.round(
                    (d.clientHeight -
                        parseFloat(getComputedStyle(d).paddingTop) -
                        parseFloat(getComputedStyle(d).paddingBottom)) /
                        parseFloat(getComputedStyle(d).lineHeight)
                );
            })(),
            bioExpandable: Boolean(document.querySelector('#channelProfileDescription.is-expandable')),
            bestRank: best.querySelector('.ap-card__rank')?.textContent.trim(),
            stats: document.getElementById('apStats').textContent,
            noSearch: !document.querySelector('#channelPage input[type="search"]'),
            bioInHero:
                !document.getElementById('apBio') || Boolean(document.getElementById('apBio').closest('#apHero')),
            catsInHero: Boolean(document.getElementById('apUserCats')?.closest('#apHero')),
            // Fora de la capçalera i de les caràtules només hi ha els títols de secció (i els botons de ràdio)
            looseText: [...document.querySelectorAll('#channelPage > :not(.ap-head) p:not([hidden])')]
                .filter(el => el.offsetParent && el.textContent.trim())
                .map(el => el.textContent.trim().slice(0, 40)),
            noAlbums: !document.getElementById('apAlbums') && !document.querySelector('#channelPage .ap-album-card'),
            cardRatio: (() => {
                const art = document.querySelector('#apSongs .ap-card__art');
                const r = art?.getBoundingClientRect();
                return r ? Math.round((r.width / r.height) * 100) / 100 : 0;
            })(),
            cardWidth: Math.round(document.querySelector('#apSongs .ap-card__art')?.getBoundingClientRect().width || 0),
            pageWidth: document.documentElement.scrollWidth,
            viewport: window.innerWidth,
        };
    });

const inside = (inner, outer) =>
    inner &&
    outer &&
    inner.left >= outer.left - 1 &&
    inner.right <= outer.right + 1 &&
    inner.top >= outer.top - 1 &&
    inner.bottom <= outer.bottom + 1;

async function check(browser, width, height, label) {
    const { ctx, page, errors } = await openArtist(browser, width, height);
    const info = await layout(page);
    // La capçalera i «La més escoltada» (#1) caben dins la pantalla i la #1 és quadrada al mòbil (2026-10-18: la
    // graella de dalt s'eixamplava fins al text més llarg i en sortien per la dreta)
    const caixes = await page.evaluate(() => {
        const box = selector => document.querySelector(selector)?.getBoundingClientRect().toJSON();
        return {
            vw: innerWidth,
            doc: document.documentElement.scrollWidth,
            hero: box('#apHero'),
            best: box('#apBest .ap-card'),
        };
    });
    ok(
        `${label}: la capçalera i la #1 no surten de la pantalla`,
        caixes.doc <= caixes.vw && caixes.hero.right <= caixes.vw && caixes.best.right <= caixes.vw,
        caixes
    );
    if (width <= 768) {
        ok(
            `${label}: la #1 és un rectangle vertical (4:5) de l'ample de la columna`,
            Math.abs(caixes.best.height - caixes.best.width * 1.25) < 2 &&
                Math.abs(caixes.best.width - caixes.hero.width) < 2,
            caixes.best
        );
    }
    ok(
        `${label}: la foto omple la capçalera`,
        Math.abs(info.img.width - info.hero.width) < 3 && Math.abs(info.img.height - info.hero.height) < 3,
        [info.img, info.hero]
    );
    ok(
        `${label}: nom, ràdio i compartir damunt la foto`,
        inside(info.name, info.hero) && inside(info.radio, info.hero) && inside(info.share, info.hero)
    );
    // Enrere, YouTube i compartir: sencers dins la foto, amb marge respecte de les vores
    const margin = (button, box) =>
        Math.min(button.left - box.left, box.right - button.right, button.top - box.top, box.bottom - button.bottom);
    ok(
        `${label}: enrere, YouTube i compartir sencers dins la foto (≥ 10 px de les vores)`,
        [info.back, info.youtube, info.share].every(button => button && margin(button, info.img) >= 10),
        [info.back, info.youtube, info.share].map(button => button && Math.round(margin(button, info.img)))
    );
    ok(
        `${label}: el botó «YouTube» obre el canal del grup`,
        /^https:\/\/www\.youtube\.com\/(@|channel\/)/.test(info.youtubeHref),
        info.youtubeHref
    );
    // Venint de «Artistes i grups» (#segueix) s'enfoca «Segueix»: la capçalera no s'ha de desplaçar per dins (la foto
    // desenfocada en sobresurt) ni amagar la part de dalt de la foto
    const pinned = await page.evaluate(() => {
        scrollToChannelFollow();
        document.getElementById('channelProfileFollowBtn').scrollIntoView({ block: 'end' });
        const hero = document.getElementById('apHero');
        const res = {
            scrollTop: hero.scrollTop,
            offset: Math.round(
                document.getElementById('channelProfileAvatar').getBoundingClientRect().top -
                    hero.getBoundingClientRect().top
            ),
        };
        window.scrollTo(0, 0);
        return res;
    });
    ok(
        `${label}: la foto de la capçalera no puja en enfocar «Segueix»`,
        pinned.scrollTop === 0 && pinned.offset >= 0,
        pinned
    );
    ok(
        `${label}: la més escoltada és la de més visualitzacions`,
        info.bestViews === info.maxViews && info.maxViews > 0,
        [info.bestViews, info.maxViews]
    );
    if (width >= 960)
        ok(
            `${label}: la més escoltada al costat de la capçalera`,
            info.best.left >= info.hero.right && Math.abs(info.best.top - info.hero.top) < 2,
            [info.best, info.hero]
        );
    else ok(`${label}: la més escoltada sota la capçalera`, info.best.top >= info.hero.bottom);
    ok(
        `${label}: cançons per visualitzacions`,
        info.songViews.every((v, i, list) => i === 0 || list[i - 1] >= v),
        info.songViews.slice(0, 8)
    );
    ok(`${label}: cada cançó té play i cua`, info.rowsWithPlay);
    ok(`${label}: caràtules quadrades i iguals`, Math.abs(info.cardRatio - 1) < 0.03 && info.sameSize, [
        info.cardRatio,
        info.cardWidth,
    ]);
    if (width >= 769) {
        const cols = width >= 1025 ? 4 : 3;
        ok(`${label}: ${cols} columnes amb el mínim espai`, info.columns === cols && info.gap <= 6, [
            info.columns,
            info.gap,
        ]);
    } else {
        ok(`${label}: una caràtula sota l'altra amb el mínim espai`, info.columns === 1 && info.rowGap <= 6, [
            info.columns,
            info.rowGap,
        ]);
    }
    ok(`${label}: marc blanc només a «La més escoltada» (la resta, sense marc en repòs)`, info.framed);
    ok(
        `${label}: numeració seguida (#1 la més escoltada, després #2, #3…)`,
        info.bestRank === '#1' && info.ranks.every((rank, i) => rank === `#${i + 2}`),
        [info.bestRank, ...info.ranks.slice(0, 5)]
    );
    ok(
        `${label}: capçaleres: «Novetats» i després «Les més escoltades» (o cap, si no hi ha novetats)`,
        info.headings.length === 0 ||
            (info.headings[0] === 'Novetats' &&
                info.headings[1] === 'Les més escoltades' &&
                info.headings.length === 2),
        info.headings
    );
    if (info.headings.length) {
        ok(
            `${label}: «Les més escoltades» té separador i va just abans de la #2`,
            info.hitsSeparated,
            info.hitsSeparated
        );
    }
    ok(`${label}: el nom del grup no surt dins dels títols`, info.titlesWithName.length === 0, info.titlesWithName);
    ok(`${label}: presentació d'una línia`, info.bioLines <= 1, info.bioLines);
    ok(`${label}: sense discos`, info.noAlbums);
    ok(`${label}: sense cerca de cançons`, info.noSearch);
    ok(`${label}: presentació i categories a la primera secció`, info.bioInHero && info.catsInHero);
    ok(`${label}: cap text explicatiu fora de les caràtules`, info.looseText.length === 0, info.looseText);
    ok(`${label}: la pàgina no es desborda`, info.pageWidth <= info.viewport, [info.pageWidth, info.viewport]);
    console.log(`   ${label}: ${info.stats}`);
    if (width >= 769) {
        // Ordinador: passar el ratolí per sobre d'una caràtula l'amplia una mica
        const card = '#apSongs .ap-card:nth-child(2)';
        const before = await page.$eval(card, el => el.getBoundingClientRect().width);
        await page.hover(card);
        await page.waitForTimeout(350);
        const after = await page.$eval(card, el => el.getBoundingClientRect().width);
        ok(`${label}: en passar-hi el ratolí, la caràtula s'amplia`, after > before * 1.02, [before, after]);
        const hoverFrame = await page.$eval(
            card,
            el => getComputedStyle(el.querySelector('.ap-card__art')).borderTopColor
        );
        ok(`${label}: en passar-hi el ratolí, apareix el marc blanc`, hoverFrame === 'rgb(255, 255, 255)', hoverFrame);
        // Les de les vores s'amplien cap a dins: #channelPage (contain: content) retallaria el marc blanc
        const last = width >= 1025 ? 4 : 3;
        for (const sel of [
            '#apSongs .ap-card:nth-child(1)',
            `#apSongs .ap-card:nth-child(${last})`,
            '#apBest .ap-card',
        ]) {
            await page.locator(sel).scrollIntoViewIfNeeded();
            await page.hover(sel);
            await page.waitForTimeout(350);
            const res = await page.evaluate(sel => {
                const box = document.querySelector(sel).getBoundingClientRect();
                const clip = document.getElementById('channelPage').getBoundingClientRect();
                return {
                    inside: box.left >= clip.left - 0.5 && box.right <= clip.right + 0.5 && box.top >= clip.top - 0.5,
                    box: [Math.round(box.left), Math.round(box.right), Math.round(box.top)],
                    clip: [Math.round(clip.left), Math.round(clip.right), Math.round(clip.top)],
                };
            }, sel);
            ok(`${label}: ${sel} ampliada no perd el marc`, res.inside, res);
        }
        await page.mouse.move(0, 0);
    }
    if (info.bioExpandable) {
        await page.click('#channelProfileDescription');
        const lines = await page.$eval('#channelProfileDescription', d =>
            Math.round(
                (d.clientHeight -
                    parseFloat(getComputedStyle(d).paddingTop) -
                    parseFloat(getComputedStyle(d).paddingBottom)) /
                    parseFloat(getComputedStyle(d).lineHeight)
            )
        );
        ok(`${label}: tocar la presentació la desplega sencera`, lines > 1, lines);
        await page.click('#channelProfileDescription');
    }
    if (OUT) {
        await page.screenshot({ path: path.join(OUT, `fitxa-${width}.png`) });
        await page.screenshot({ path: path.join(OUT, `fitxa-${width}-sencera.png`), fullPage: true });
        // El centre i la graella, amb les caràtules ja carregades (són lazy)
        for (const [id, name] of [['apSongs', 'cancons']]) {
            await page.evaluate(target => {
                const el = document.getElementById(target);
                window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 90);
            }, id);
            await page.waitForTimeout(1500);
            await page.screenshot({ path: path.join(OUT, `fitxa-${width}-${name}.png`) });
        }
        await page.evaluate(() => window.scrollTo(0, 0));
    }
    ok(`${label}: sense errors en obrir la fitxa`, errors.length === 0, errors);
    // Origen: el xip es desplega i porta «Ràdio d'aquí», que obre la ràdio «A prop teu» d'aquell lloc
    if (await page.isVisible('#apOrigin summary')) {
        await page.click('#apOrigin summary');
        const place = await page.$('#apOrigin [data-ap-place]');
        ok(`${label}: l'origen porta «Ràdio d'aquí»`, Boolean(place));
        if (place) {
            await place.click();
            await page.waitForSelector('dialog.near-dialog[open]', { timeout: 15000 }).catch(() => null);
            ok(`${label}: «Ràdio d'aquí» obre la ràdio del lloc`, await page.isVisible('dialog.near-dialog[open]'));
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }
    }
    // El play d'una cançó de la llista engega la ràdio de l'artista que hi comença
    const target = await page.$eval('#apSongs .ap-card:nth-child(3) [data-ap-play]', el => el.dataset.apPlay);
    await page.click('#apSongs .ap-card:nth-child(3) .ap-card__art');
    await page.waitForTimeout(800);
    const radio = await page.evaluate(() => ({
        first: String(activePlaylistQueue?.[0]?.id || ''),
        name: window.SegueixApp.features.musicQueue?.playlistName?.() || '',
        length: activePlaylistQueue?.length || 0,
    }));
    ok(
        `${label}: el play engega la ràdio per aquella cançó`,
        radio.first === target && radio.length > 1 && /^Ràdio de /.test(radio.name),
        radio
    );
    // A l'entorn de prova YouTube és bloquejat: l'iframe buit del reproductor dona «localStorage… Access is denied»
    // en engegar qualsevol ràdio (docs/PROBLEMES_I_SOLUCIONS.md; verificar-mapa.js també el filtra).
    const own = errors.filter(message => !/localStorage.*Access is denied/.test(message));
    ok(`${label}: sense errors`, own.length === 0, own);
    await ctx.close();
}

server.listen(PORT, async () => {
    const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
    try {
        await check(browser, 390, 844, 'mòbil');
        await check(browser, 1280, 900, 'ordinador');
    } finally {
        await browser.close();
        server.close();
    }
    console.log(correcte ? '\nTot correcte.' : '\nHi ha errors.');
    process.exit(correcte ? 0 : 1);
});
