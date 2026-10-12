'use strict';

// Revisió d'idioma de les cançons noves (data/revisio-idiomes.json). Vegeu scripts/lib/revisio_idiomes.js.
//   node scripts/aplicar_revisio_idiomes.js --llista                  cançons pendents (artista · títol · descripció)
//   node scripts/aplicar_revisio_idiomes.js --amaga=ID1,ID2 [--recupera=ID3] --dry-run  què faria
//   node scripts/aplicar_revisio_idiomes.js --amaga=ID1,ID2 [--recupera=ID3]
//       només aplica els IDs explícits; --conserva=ID marca les aprovades
//   node scripts/aplicar_revisio_idiomes.js --actualitza              aplica el registre sense consultar YouTube
//   --font=URL --mateixa-obra: reutilitza una decisió contrastada en duplicats sense marques de versió

const fs = require('fs');
const path = require('path');
const { emptyState, updatePending, applyReview, serializeState } = require('./lib/revisio_idiomes');

const ROOT = process.cwd();
const STATE_FILE = path.join(ROOT, 'data', 'revisio-idiomes.json');
const HIDDEN_FILE = path.join(ROOT, 'data', 'hidden-videos.json');
const FEED_FILE = path.join(ROOT, 'data', 'feed.json');

const readJson = (file, fallback) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback);
const arg = (name) => process.argv.find((item) => item === `--${name}` || item.startsWith(`--${name}=`));
const dryRun = Boolean(arg('dry-run'));
const state = readJson(STATE_FILE, emptyState());

if (arg('actualitza') || arg('inicia')) {
    const hidden = readJson(HIDDEN_FILE, { videoIds: [] });
    const result = updatePending(state, readJson(FEED_FILE, { videos: [] }).videos, {
        hiddenIds: new Set(hidden.videoIds),
    });
    if (!dryRun) {
        fs.writeFileSync(STATE_FILE, serializeState(result.state));
        if (result.discardedIds.size)
            fs.writeFileSync(
                HIDDEN_FILE,
                `${JSON.stringify({ ...hidden, videoIds: [...new Set([...hidden.videoIds, ...result.discardedIds])] }, null, 2)}\n`
            );
    }
    console.log(
        `${dryRun ? 'Simulació: ' : ''}${result.state.pendents.length} pendents; ${result.state.acceptadesPerArtista.length} acceptades per confiança editorial; ${result.state.artistesPendents.length} artistes nous per classificar. Cap lletra es dona per verificada per confiança.`
    );
} else if (arg('amaga') !== undefined || arg('recupera') !== undefined || arg('conserva') !== undefined) {
    const ids = (name) =>
        String(arg(name)?.split('=')[1] || '')
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean);
    const hidden = readJson(HIDDEN_FILE, { videoIds: [] });
    const result = applyReview(state, hidden, ids('amaga'), {
        rescueIds: ids('recupera'),
        keepIds: ids('conserva'),
        source: String(arg('font') || '').slice('--font='.length),
        reuseWorks: Boolean(arg('mateixa-obra')),
    });
    if (result.unknown.length) {
        console.error(`❌ No són a les pendents: ${result.unknown.join(', ')}`);
        process.exit(1);
    }
    if (!dryRun) {
        fs.writeFileSync(HIDDEN_FILE, `${JSON.stringify(result.hidden, null, 2)}\n`);
        fs.writeFileSync(STATE_FILE, serializeState(result.state));
    }
    console.log(
        `${dryRun ? '🔎' : '✅'} ${result.hiddenCount} amagades, ${result.keptCount} conservades, ` +
            `${result.rescuedCount} recuperades; ${result.state.pendents.length + result.state.descartades.length} dubtes encara pendents.`
    );
} else {
    const descartades = state.descartades || [];
    if (descartades.length) {
        console.log(`Descartaments antics encara sense migrar (no s’oculten sense una decisió explícita):`);
        descartades.forEach((item) => console.log(`- ${item.id} · ${item.artista} · ${item.titol} [${item.motiu}]`));
        console.log('');
    }
    const pendents = state.pendents || [];
    pendents.forEach((item) => {
        const descripcio = item.descripcio ? ` — ${item.descripcio}` : '';
        console.log(`- ${item.id} · ${item.artista} · ${item.titol}${descripcio}`);
    });
    console.log(
        `${pendents.length} cançons pendents, ${descartades.length} descartaments antics, ${(state.acceptadesPerArtista || []).length} acceptades per confiança i ${(state.artistesPendents || []).length} artistes per classificar (des de ${state.updatedAt || '—'}).`
    );
}
