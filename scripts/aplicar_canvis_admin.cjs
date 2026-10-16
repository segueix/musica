// Aplica un JSON editorial al checkout; no publica ni consulta serveis externs.
const fs = require('node:fs');
const path = require('node:path');
const model = require('../js/admin-changes.js');

function applyFile(root, patchFile, { dryRun = true } = {}) {
    const target = path.join(root, 'data/artistes-musica.json');
    const original = fs.readFileSync(target, 'utf8');
    if (fs.statSync(patchFile).size > 8 * 1024 * 1024) throw new Error('El fitxer supera 8 MB.');
    const patch = JSON.parse(fs.readFileSync(patchFile, 'utf8'));
    const taxonomy = JSON.parse(fs.readFileSync(path.join(root, 'data/music-genres.json'), 'utf8'));
    const next = model.clean(model.apply(JSON.parse(original), patch, taxonomy));
    if (!dryRun && patch.changes.length) {
        next.updatedAt = new Date().toISOString();
        const temp = target + `.admin-${process.pid}.tmp`;
        try {
            fs.writeFileSync(temp, JSON.stringify(next, null, 2) + '\n', { flag: 'wx' });
            if (fs.readFileSync(target, 'utf8') !== original) throw new Error('La base ha canviat durant l’aplicació.');
            fs.renameSync(temp, target);
        } finally { fs.rmSync(temp, { force: true }); }
    }
    return { changes: patch.changes.length, dryRun };
}
module.exports = { applyFile };
if (require.main === module) {
    try {
        const args = process.argv.slice(2);
        const file = args.find(arg => !arg.startsWith('--'));
        if (!file || args.some(arg => arg.startsWith('--') && !['--dry-run', '--apply'].includes(arg)) ||
            (args.includes('--dry-run') && args.includes('--apply'))) {
            throw new Error('Ús: node scripts/aplicar_canvis_admin.cjs fitxer.json [--dry-run | --apply]');
        }
        console.log(applyFile(path.resolve(__dirname, '..'), file, { dryRun: !args.includes('--apply') }));
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}
