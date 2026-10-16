// Actualitza el bloc AUTO-GENERAT de sw.js: la llista de precache (STATIC_ASSETS) i
// el CACHE_VERSION (hash del contingut real dels assets estàtics). Substitueix el
// vell "cache busting" que incrementava un número a cada sync. Aquí la versió només
// canvia quan el contingut d'un asset canvia, així que el cache de codi dels clients
// només s'invalida quan el codi canvia de debò.
//
// Ús: `node scripts/actualitzar_versio_sw.js` (o `npm run sw:version`). Idempotent:
// executar-lo dues vegades sense canvis no toca sw.js.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const INDEX_HTML = path.join(ROOT, 'index.html');
const SW_PATH = path.join(ROOT, 'sw.js');

// Assets de shell que sempre precachegem, encara que no siguin refs literals amb
// extensió a index.html.
const SHELL_ASSETS = ['./', './index.html'];
// Assets de runtime que no apareixen directament a index.html. Les TV i els fulls de
// retoc (spacing/typography) es carreguen dinàmicament des de navigation.js i han de
// formar part del hash/precache igualment: si no, un canvi que només els toqui no
// bumparia CACHE_VERSION i els clients es quedarien amb la versió antiga (cache-first).
const EXTRA_ASSETS = [
    './img/caratula.webp',
    './js/features/artist-map.js',
    './js/features/affinity.js',
    './js/features/segueix-tv.js',
    './js/features/context-tv.js',
    './js/features/tv-scroll-ui.js',
    './css/category-chips.css',
    './css/spacing-polish.css',
    './css/typography-polish.css',
];

const BEGIN = '// === AUTO-GENERAT per scripts/actualitzar_versio_sw.js — NO EDITAR MANUALMENT ===';
const END = '// === FI BLOC AUTO-GENERAT ===';

// Extensions d'assets estàtics locals que val la pena precachejar des d'index.html.
const STATIC_EXT = /\.(js|css|json|png|jpe?g|gif|svg|webp|ico)(\?.*)?$/i;

function normalizeRel(value) {
    let rel = value.trim();
    if (!rel) return null;
    // Descarta orígens externs, àncores, data URIs i mailto.
    if (/^(https?:)?\/\//.test(rel) || rel.startsWith('#') || rel.startsWith('data:') || rel.startsWith('mailto:')) {
        return null;
    }
    // Els query params només serveixen per cache-busting al navegador; al disc el fitxer
    // és el mateix. Sense retirar-los, app.js?v=... i altres assets quedaven fora del hash.
    rel = rel.split(/[?#]/, 1)[0];
    rel = rel.replace(/^\.\//, '').replace(/^\//, '');
    if (!rel) return null;
    return `./${rel}`;
}

function extractLocalAssets(html) {
    // Una precàrrega de dades accelera la primera visita, però no forma part del shell.
    // Feed i taxonomia han de conservar l’estratègia de dades i no versionar el cache de codi.
    html = html.replace(/<link\b(?=[^>]*\brel=["']preload["'])(?=[^>]*\bas=["']fetch["'])[^>]*>/gi, '');
    const found = [];
    const seen = new Set();
    const re = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
    let match;
    while ((match = re.exec(html)) !== null) {
        if (!STATIC_EXT.test(match[1])) continue;
        const rel = normalizeRel(match[1]);
        if (!rel || seen.has(rel)) continue;
        seen.add(rel);
        found.push(rel);
    }
    return found;
}

function toAbsolute(rel) {
    // './' representa l'arrel (index.html a efectes de contingut).
    const clean = rel === './' ? 'index.html' : rel.replace(/^\.\//, '');
    return path.join(ROOT, clean);
}

function main() {
    const html = fs.readFileSync(INDEX_HTML, 'utf8');

    const assets = [...SHELL_ASSETS];
    const pushIfNew = (rel) => {
        if (rel && !assets.includes(rel)) assets.push(rel);
    };
    extractLocalAssets(html).forEach(pushIfNew);
    EXTRA_ASSETS.forEach(pushIfNew);

    // Només precachegem fitxers que existeixen de debò (un 404 fa fallar l'install).
    const finalAssets = assets.filter((rel) => {
        if (rel === './') return true; // servit com index.html
        const exists = fs.existsSync(toAbsolute(rel));
        if (!exists) {
            console.warn(`⚠️  Ignorat (no existeix): ${rel}`);
        }
        return exists;
    });

    // Hash del contingut real dels fitxers (exclou sw.js per evitar realimentació:
    // escriure el hash dins sw.js canviaria sw.js i mai s'estabilitzaria). './' i
    // './index.html' apunten al mateix fitxer; dedupliquem per ruta absoluta.
    const uniqueFiles = Array.from(new Set(finalAssets.map(toAbsolute))).sort();
    const hasher = crypto.createHash('sha256');
    for (const abs of uniqueFiles) {
        hasher.update(path.relative(ROOT, abs));
        hasher.update('\0');
        hasher.update(fs.readFileSync(abs));
        hasher.update('\0');
    }
    const version = hasher.digest('hex').slice(0, 12);

    const block = [
        BEGIN,
        `const CACHE_VERSION = '${version}';`,
        'const STATIC_ASSETS = [',
        ...finalAssets.map((rel) => `    '${rel}',`),
        '];',
        END,
    ].join('\n');

    const sw = fs.readFileSync(SW_PATH, 'utf8');
    const blockRe = new RegExp(`${escapeRegex(BEGIN)}[\\s\\S]*?${escapeRegex(END)}`);
    if (!blockRe.test(sw)) {
        console.error('❌ No s\'ha trobat el bloc AUTO-GENERAT a sw.js. Avortant.');
        process.exit(1);
    }

    const updated = sw.replace(blockRe, block);
    if (updated === sw) {
        console.log(`✔️  sw.js ja al dia (CACHE_VERSION=${version}, ${finalAssets.length} assets). Sense canvis.`);
        return;
    }
    fs.writeFileSync(SW_PATH, updated);
    console.log(`🔄 sw.js actualitzat: CACHE_VERSION=${version}, ${finalAssets.length} assets de precache.`);
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main();

