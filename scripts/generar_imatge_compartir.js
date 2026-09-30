#!/usr/bin/env node
// Genera img/compartir.png (1200×630): la imatge que es veu quan s'enganxa un enllaç de Segueix Música a
// WhatsApp, Telegram, Instagram, X... (etiquetes og:image / twitter:image de index.html).
//
// Ús: node scripts/generar_imatge_compartir.js
// Requereix Playwright amb Chromium (no és dependència del projecte: és un script de manteniment ocasional) i accés
// a Google Fonts per a Fraunces i Roboto. El PNG resultant es versiona: no cal regenerar-lo a cada canvi.
//
// La composició és centrada i sense res important als marges: WhatsApp i Telegram retallen la imatge a quadrat
// en les targetes petites, i així la icona i «Segueix!» hi continuen sortint sencers.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'img', 'compartir.png');

function loadPlaywright() {
    for (const name of ['playwright', 'playwright-core']) {
        try {
            return require(name);
        } catch (_error) {
            // prova la següent
        }
    }
    console.error('Falta Playwright (npm i -g playwright). No s’ha generat res.');
    process.exit(1);
}

function buildHtml(iconDataUri) {
    return `<!doctype html>
<html lang="ca"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Roboto:wght@600;900&display=swap">
<style>
  :root { --bg:#141615; --text:#F4F0E8; --accent:#D6ED84; --terra:#D98A70; }
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; background: var(--bg); position: relative;
         font-family: Roboto, Arial, sans-serif; }
  .lime { position:absolute; right:-110px; top:-150px; width:430px; height:430px; border-radius:50%; background:var(--accent); }
  .ring { position:absolute; left:-120px; bottom:-150px; width:400px; height:400px; border-radius:50%;
          border:46px solid var(--terra); }
  .dots { position:absolute; right:70px; bottom:60px; width:260px; height:170px;
          background-image: radial-gradient(circle, rgba(244,240,232,.16) 5px, transparent 6px);
          background-size: 34px 34px; }
  .col { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; }
  .icon { width:196px; height:196px; display:block; margin-bottom:6px; }
  h1 { font-family:Fraunces, Georgia, serif; font-weight:700; font-size:118px; line-height:1; color:var(--text); letter-spacing:0;
       font-optical-sizing:none; font-variation-settings:'opsz' 56; } /* el mateix traç que l'obertura de l'app (56 px) */
  h1 span { color:var(--accent); }
  .tag { margin-top:14px; font-weight:600; font-size:26px; letter-spacing:.35em; color:var(--terra); text-transform:uppercase; padding-left:.35em; }
  .sticker { margin-top:26px; display:inline-block; transform:rotate(-2.5deg); padding:14px 34px; border-radius:16px;
             background:var(--accent); color:var(--bg); font-weight:900; font-size:32px; letter-spacing:.12em; text-transform:uppercase;
             box-shadow: 9px 9px 0 var(--terra); }
</style></head>
<body>
  <div class="lime"></div><div class="ring"></div><div class="dots"></div>
  <div class="col">
    <img class="icon" src="${iconDataUri}" alt="">
    <h1>SEGUEIX<span>!</span></h1>
    <p class="tag">Música en català</p>
    <p class="sticker">La teva plaça musical</p>
  </div>
</body></html>`;
}

async function main() {
    const { chromium } = loadPlaywright();
    const icon = fs.readFileSync(path.join(ROOT, 'img', 'icon-512.png'));
    const iconDataUri = `data:image/png;base64,${icon.toString('base64')}`;

    const browser = await chromium.launch({
        executablePath: process.env.CHROMIUM_PATH || undefined,
        args: ['--no-sandbox'],
    });
    // SEGUEIX_IGNORA_HTTPS=1: darrere d'un servidor intermediari amb certificat propi (p. ex. entorns tancats)
    const page = await browser.newPage({
        viewport: { width: 1200, height: 630 },
        deviceScaleFactor: 1,
        ignoreHTTPSErrors: !!process.env.SEGUEIX_IGNORA_HTTPS,
    });
    await page.setContent(buildHtml(iconDataUri), { waitUntil: 'networkidle' });
    // Les fonts es baixen només quan es fan servir: les demanem explícitament abans de fer la captura
    await page.evaluate(() =>
        Promise.all([
            document.fonts.load('700 118px Fraunces', 'SEGUEIX!'),
            document.fonts.load('600 26px Roboto', 'MÚSICA EN CATALÀ'),
            document.fonts.load('900 32px Roboto', 'LA TEVA PLAÇA MUSICAL'),
        ]).then(() => document.fonts.ready)
    );
    const loaded = await page.evaluate(() =>
        [...document.fonts].some(font => font.family.includes('Fraunces') && font.status === 'loaded')
    );
    if (!loaded) console.warn('Avís: les fonts de Google no s’han carregat; la imatge usarà tipus de recanvi.');
    await page.screenshot({ path: OUTPUT, type: 'png' });
    await browser.close();
    console.log(`Imatge generada: ${path.relative(ROOT, OUTPUT)}`);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
