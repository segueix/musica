'use strict';

// Aplica el document baixat de revisio-artistes.html a data/artistes-musica.json: noms a mostrar a l'app (`displayName`),
// categories (marcades com a manuals) i la marca «OK» (`revisioEditorial`). La lògica és a js/revisio-artistes.js.
// Ús: node scripts/aplicar_revisio_artistes.js revisio-artistes-AAAA-MM-DD.json [--dry-run]

const fs = require('fs');
const path = require('path');
const { applyExport } = require('../js/revisio-artistes.js');

const DB_FILE = path.join(__dirname, '..', 'data', 'artistes-musica.json');
const GENRES_FILE = path.join(__dirname, '..', 'data', 'music-genres.json');

function main() {
    const file = process.argv.slice(2).find(arg => !arg.startsWith('--'));
    const dryRun = process.argv.includes('--dry-run');
    if (!file) {
        console.error('Ús: node scripts/aplicar_revisio_artistes.js <revisio-artistes.json> [--dry-run]');
        process.exit(1);
    }
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const taxonomy = JSON.parse(fs.readFileSync(GENRES_FILE, 'utf8')).categories.map(category => category.label);
    const { db: next, report } = applyExport(db, doc, taxonomy);

    const print = (title, list) =>
        list.length && console.log(`\n${title} (${list.length}):\n${list.map(item => `  - ${item}`).join('\n')}`);
    print('✏️  Noms canviats', report.renamed);
    print('🏷️  Categories canviades', report.recategorized);
    print('⚠️  No trobats a la base', report.missing);
    print('⚠️  Avisos', report.invalid);
    console.log(`\n✅ Marques OK modificades: ${report.marked} · artistes sense canvis: ${report.unchanged}`);
    if (dryRun) return console.log('\n🔎 Simulació: no s’ha escrit res.');
    fs.writeFileSync(DB_FILE, `${JSON.stringify(next, null, 2)}\n`);
    console.log('\n💾 data/artistes-musica.json actualitzat. Executa «node scripts/validar_artistes_musica.js».');
}

if (require.main === module) main();
