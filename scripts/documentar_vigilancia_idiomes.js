'use strict';

const fs = require('fs');
const registry = JSON.parse(fs.readFileSync('data/artistes-vigilats-idioma.json', 'utf8'));
const cell = (value) =>
    String(value || '')
        .replace(/\|/g, '\\|')
        .replace(/\n/g, ' ');
const text = [
    '# Artistes vigilats per idioma',
    '',
    'Document generat de `data/artistes-vigilats-idioma.json`, l’única font operativa. No editeu la taula a mà.',
    '',
    `Actualitzat: ${registry.updatedAt}. ${registry.vigilats.length} entrades vigilades i ${registry.confianca.length} artistes de confiança editorial. Inclou antecedents sense canal actiu, per si es reincorporen.`,
    '',
    '## Política',
    '',
    '- Només les cançons noves dels artistes vigilats entren a `pendents`. Català, occità/aranès i instrumentals es poden conservar; les expressions breus no equivalen a estrofes en altres llengües.',
    '- La resta del catàleg classificat s’accepta per confiança en l’artista, registrada a `acceptadesPerArtista`. Això no certifica la lletra de cada cançó. Pot passar alguna excepció.',
    '- Un artista desconegut genera una sola entrada a `artistesPendents`, sense una cua per cadascuna de les seves cançons. Es classifica una vegada afegint-lo a `confianca` o `vigilats` amb els canals i àlies. La classificació no oculta contingut.',
    '- Els IDs de canal prevalen sobre els noms. Les assignacions oficial/Topic de la base d’artistes comparteixen política. Un ID desconegut no hereta confiança d’un homònim.',
    '- Els títols només aporten indicis: no generen exclusions automàtiques. Les exclusions editorials ja existents continuen vigents.',
    '- Les decisions per ID es conserven. Només amb font i `--mateixa-obra` es pot reutilitzar una decisió entre duplicats; remescles, directes, instrumentals i col·laboracions no hereten aquesta decisió pel títol. No s’ha activat reutilització massiva de les revisions antigues sense evidència suficient.',
    '- `discsVerificats` permet decisions d’un disc contrastat: `artista`, `titol`, `accio` (`conserva`/`amaga`), `font` i `videoIds` de les pistes comprovades. No s’infereix que tot un disc sigui català perquè el títol ho sembli.',
    '',
    '## Manteniment',
    '',
    'Quan aparegui una excepció, moveu l’artista de `confianca` a `vigilats` i indiqueu-ne el motiu i la font. En aplicar la política, les acceptacions per confiança es tornen a revisar, incloses les conservades fora del feed actiu. Les decisions explícites anteriors es mantenen. L’antic camp `revisades` es preserva com a llegat; no implica que les lletres fossin totes comprovades.',
    '',
    '```bash',
    'node scripts/documentar_vigilancia_idiomes.js',
    'node scripts/aplicar_revisio_idiomes.js --actualitza --dry-run',
    'node scripts/aplicar_revisio_idiomes.js --actualitza',
    'node scripts/aplicar_revisio_idiomes.js --llista',
    'node scripts/aplicar_revisio_idiomes.js --conserva=ID --amaga=ALTRE_ID --font=URL --dry-run',
    '```',
    '',
    'La revisió només resol els IDs indicats: la resta queda pendent. Afegiu `--mateixa-obra` exclusivament si la font permet aplicar la decisió a la mateixa obra sense canviar-ne llengua o versió. No marqueu una obra reutilitzable si té versions catalana/castellana amb el mateix títol. Cap ordre anterior consulta YouTube.',
    '',
    '## Registre de vigilància',
    '',
    '| Artista | Àlies | Canals oficials / Topic | Motiu | Fonts |',
    '| --- | --- | --- | --- | --- |',
    ...registry.vigilats.map(
        (a) =>
            `| ${cell(a.artista)} | ${cell(a.aliases.join(', '))} | ${a.canals.map((id) => '`' + id + '`').join(', ') || 'Sense canal assignat'} | ${cell(a.motiu)} | ${a.fonts.map((f) => '`' + f + '`').join(', ')} |`
    ),
    '',
].join('\n');
const file = 'docs/ARTISTES_VIGILATS_IDIOMA.md';
if (process.argv.includes('--check')) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) {
        console.error('Cal regenerar docs/ARTISTES_VIGILATS_IDIOMA.md');
        process.exitCode = 1;
    }
} else fs.writeFileSync(file, text);
