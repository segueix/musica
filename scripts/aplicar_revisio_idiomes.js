'use strict';

// Revisió d'idioma de les cançons noves (data/revisio-idiomes.json). Vegeu scripts/lib/revisio_idiomes.js.
//   node scripts/aplicar_revisio_idiomes.js --llista                  cançons pendents (artista · títol · descripció)
//   node scripts/aplicar_revisio_idiomes.js --amaga=ID1,ID2 [--recupera=ID3] --dry-run  què faria
//   node scripts/aplicar_revisio_idiomes.js --amaga=ID1,ID2 [--recupera=ID3]
//       amaga aquestes pendents i totes les descartades (menys les recuperades) i buida el document
//   node scripts/aplicar_revisio_idiomes.js --inicia                  marca tot el feed actual com a revisat

const fs = require('fs');
const path = require('path');
const { emptyState, seedReviewed, applyReview, serializeState } = require('./lib/revisio_idiomes');

const ROOT = process.cwd();
const STATE_FILE = path.join(ROOT, 'data', 'revisio-idiomes.json');
const HIDDEN_FILE = path.join(ROOT, 'data', 'hidden-videos.json');
const FEED_FILE = path.join(ROOT, 'data', 'feed.json');

const readJson = (file, fallback) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback);
const arg = name => process.argv.find(item => item === `--${name}` || item.startsWith(`--${name}=`));
const dryRun = Boolean(arg('dry-run'));
const state = readJson(STATE_FILE, emptyState());

if (arg('inicia')) {
    const next = seedReviewed(state, readJson(FEED_FILE, { videos: [] }).videos);
    if (!dryRun) fs.writeFileSync(STATE_FILE, serializeState({ ...next, updatedAt: new Date().toISOString() }));
    console.log(`✅ ${next.revisades.length} cançons marcades com a revisades.`);
} else if (arg('amaga') !== undefined || arg('recupera') !== undefined) {
    const ids = name =>
        String(arg(name)?.split('=')[1] || '')
            .split(',')
            .map(id => id.trim())
            .filter(Boolean);
    const hidden = readJson(HIDDEN_FILE, { videoIds: [] });
    const result = applyReview(state, hidden, ids('amaga'), { rescueIds: ids('recupera') });
    if (result.unknown.length) {
        console.error(`❌ No són a les pendents: ${result.unknown.join(', ')}`);
        process.exit(1);
    }
    if (!dryRun) {
        fs.writeFileSync(HIDDEN_FILE, `${JSON.stringify(result.hidden, null, 2)}\n`);
        fs.writeFileSync(STATE_FILE, serializeState(result.state));
    }
    console.log(
        `${dryRun ? '🔎' : '✅'} ${result.hiddenCount} amagades, ${result.keptCount} pendents es queden (en català), ` +
            `${result.rescuedCount} descartades recuperades; document buit.`
    );
} else {
    const descartades = state.descartades || [];
    if (descartades.length) {
        console.log(`Descartades soles per l'idioma del títol (es poden recuperar amb --recupera=ID):`);
        descartades.forEach(item => console.log(`- ${item.id} · ${item.artista} · ${item.titol} [${item.motiu}]`));
        console.log('');
    }
    const pendents = state.pendents || [];
    pendents.forEach(item => {
        const descripcio = item.descripcio ? ` — ${item.descripcio}` : '';
        console.log(`- ${item.id} · ${item.artista} · ${item.titol}${descripcio}`);
    });
    console.log(
        `${pendents.length} cançons pendents de revisar i ${descartades.length} descartades (des de ${state.updatedAt || '—'}).`
    );
}
