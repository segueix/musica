'use strict';

const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const { createHash } = require('node:crypto');

const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
});

// Llibreries del navegador a `vendor` (js/vendor): lz-string, Sortable, qr-code-styling i un lucide només amb les
// icones que apareixen al codi de `root`. El fa servir el paquet estàtic (_site) i també `npm run vendor:sync`, que
// les deixa al repositori perquè la web funcioni servida tal qual (p. ex. GitHub Pages des d'una branca).
function writeVendor(root, vendor) {
    fs.mkdirSync(vendor, { recursive: true });
    const packageRoot = name => path.dirname(require.resolve(`${name}/package.json`));
    for (const [name, relative, target] of [
        ['lz-string', 'libs/lz-string.min.js', 'lz-string.js'],
        ['sortablejs', 'Sortable.min.js', 'sortable.js'],
        ['qr-code-styling', 'lib/qr-code-styling.js', 'qr-code-styling.js'],
    ]) {
        fs.copyFileSync(path.join(packageRoot(name), relative), path.join(vendor, target));
    }
    // Conserva les icones que apareixen al codi, també en expressions condicionals.
    // El detector usa tot el JS i l’HTML, no només atributs data-lucide literals (sense js/vendor: el resultat no
    // depèn de les llibreries ja copiades).
    const vendorDir = path.join(root, 'js', 'vendor') + path.sep;
    const source = [...walk(path.join(root, 'js')).filter(file => !file.startsWith(vendorDir)), ...fs.readdirSync(root).filter(name => name.endsWith('.html')).map(name => path.join(root, name))]
        .filter(file => /\.(js|html)$/.test(file)).map(file => fs.readFileSync(file, 'utf8')).join('\n');
    const allIcons = require('lucide').icons;
    const requested = new Set([...source.matchAll(/['"`]([a-zA-Z][a-zA-Z0-9_-]*)['"`]/g)].map(match => {
        const camel = match[1].replace(/^([A-Z])|[\s_-]+(\w)/g, (_match, first, next) => next ? next.toUpperCase() : first.toLowerCase());
        return camel.charAt(0).toUpperCase() + camel.slice(1);
    }));
    const icons = Object.fromEntries(Object.entries(allIcons).filter(([name]) => requested.has(name) || source.includes(name)));
    const replace = path.join(packageRoot('lucide'), 'dist/esm/lucide/src/replaceElement.js');
    esbuild.buildSync({ stdin: { contents: `import replace from ${JSON.stringify(replace)};
        const icons=${JSON.stringify(icons)};
        window.lucide={icons,createIcons({root=document,attrs={},nameAttr='data-lucide'}={}) {
            Array.from(root.querySelectorAll('['+nameAttr+']')).forEach(el=>{
                if (el.tagName?.toLowerCase() !== 'svg') replace(el,{nameAttr,attrs,icons});
            });
        }};`, resolveDir: root }, bundle: true, minify: true, target: 'es2020',
        outfile: path.join(vendor, 'lucide.js'), legalComments: 'inline' });
    // Atribució de les llibreries distribuïdes, també amb sortida minificada.
    let licenses = '';
    for (const name of ['lucide', 'lz-string', 'sortablejs', 'qr-code-styling']) {
        const dir = packageRoot(name);
        const license = fs.readdirSync(dir).find(file => /^licen[sc]e(?:\.\w+)?$/i.test(file));
        if (license) licenses += `\n=== ${name} ===\n${fs.readFileSync(path.join(dir, license), 'utf8')}\n`;
    }
    fs.writeFileSync(path.join(vendor, 'LICENSES.txt'), licenses);
    return Object.keys(icons).length;
}

function optimize(root, out) {
    const editorialFile = path.join(out, 'data/artistes-musica.json');
    // Els retocs injectats després dels scripts alteraven el primer dibuix.
    // Una sola petició CSS, amb el mateix ordre de cascada i IDs per evitar reinjeccions.
    const htmlFile = path.join(out, 'index.html');
    let html = fs.readFileSync(htmlFile, 'utf8');
    const initialCss = ['styles.css', 'portada.css', 'category-chips.css', 'typography-polish.css', 'spacing-polish.css'];
    const tags = [...html.matchAll(/<link\b[^>]*>/gi)].map(match => match[0]);
    const cssTags = initialCss.map(name => tags.find(tag => tag.includes(`href="css/${name}`)));
    if (cssTags.every(Boolean)) {
        const css = initialCss.map(name => fs.readFileSync(path.join(out, 'css', name), 'utf8')).join('\n');
        const version = createHash('sha256').update(css).digest('hex').slice(0, 12);
        fs.writeFileSync(path.join(out, 'css/initial.css'), css);
        cssTags.forEach((tag, i) => {
            const id = tag.match(/\bid="([^"]+)"/)?.[1];
            html = html.replace(tag, i === 0
                ? `<link rel="stylesheet" href="css/initial.css?v=${version}">`
                : id ? `<meta id="${id}" name="segueix-bundled-style" content="css/initial.css">` : '');
        });
        fs.writeFileSync(htmlFile, html);
    }
    if (fs.existsSync(editorialFile)) {
        const editorial = JSON.parse(fs.readFileSync(editorialFile, 'utf8'));
        const artists = (editorial.artists || []).map(artist => ({
            name: artist.name, displayName: artist.displayName, aliases: artist.aliases,
            wikidataId: artist.wikidataId, musicbrainzId: artist.musicbrainzId,
            genres: artist.genres, reviewStatus: artist.reviewStatus,
            youtube: { channels: (artist.youtube?.channels || []).map(({ id, name, type, primary }) => ({ id, name, type, primary })) },
        }));
        fs.writeFileSync(path.join(out, 'data/music-taxonomy.json'), JSON.stringify({ artists }));
    }
    const iconCount = writeVendor(root, path.join(out, 'js/vendor'));

    let before = 0, after = 0;
    for (const file of [...walk(path.join(out, 'js')), ...walk(path.join(out, 'css')), ...walk(path.join(out, 'data'))]) {
        if (!/\.(js|css|json)$/.test(file)) continue;
        const source = fs.readFileSync(file, 'utf8');
        const ext = path.extname(file);
        // No rename de globals: els scripts clàssics comparteixen funcions entre fitxers.
        const result = ext === '.json' ? JSON.stringify(JSON.parse(source)) : esbuild.transformSync(source, {
            loader: ext === '.css' ? 'css' : 'js', minifyWhitespace: true, minifySyntax: true,
            minifyIdentifiers: false, target: 'es2020', legalComments: 'inline',
        }).code;
        before += Buffer.byteLength(source); after += Buffer.byteLength(result);
        fs.writeFileSync(file, result);
    }
    return { bytesBefore: before, bytesAfter: after, icons: iconCount };
}

module.exports = { optimize, writeVendor };
