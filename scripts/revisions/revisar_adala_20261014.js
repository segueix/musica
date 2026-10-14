'use strict';

// Revisió editorial d'Adala. No modifica el feed ni esborra l'arxiu:
// aplica el registre global d'ocultació i les regles persistents documentades.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

const CHANNEL = 'UC-JNcJrzWSw2RtL-3TqYoeQ';
const CHANNEL_NAMES = ['Adala', 'ADALA', 'Adala Music', 'Adala - Topic', 'Adala & The Same Song Band', 'Adala & The Cold December'];
const WORKS = [
    { title: 'Bala Perdida', ids: ['VC9stjzAqrk'], decision: 'exclusio-explicita-usuari', sources: ['https://www.musica.com/letras.asp?letra=2487136'] },
    { title: 'Look Inside', ids: ['CoAR05fVFI8'], decision: 'angles-documentat', sources: ['https://manoly.cat/adala-trista-i-clara-tur/'] },
    { title: 'Mediterranean Sea', ids: [], decision: 'lletra-anglesa-oficial', sources: ['https://lapanchitarecords.bandcamp.com/track/mediterranean-sea-feat-alex-bass'] },
    { title: 'November', ids: [], decision: 'lletra-anglesa-oficial', sources: ['https://lapanchitarecords.bandcamp.com/track/november-feat-kyne'] },
    { title: 'Cold in Paradise', ids: ['iR9oNlNoY2I'], decision: 'apartada-provisionalment-pendent-lletra-completa', sources: ['https://lapanchitarecords.bandcamp.com/track/cold-in-paradise'] },
    { title: 'December', ids: ['Wt36winFpGw'], decision: 'apartada-provisionalment-pendent-lletra-completa', sources: ['https://lapanchitarecords.bandcamp.com/album/adala-cel-la-panchita-records-2017-free-download'] },
    { title: 'What Can I Say', ids: ['jJ8an2o93pg'], decision: 'apartada-provisionalment-pendent-lletra-completa', sources: ['https://lapanchitarecords.bandcamp.com/track/what-can-i-say'] },
];
const REPORT = 'docs/revisions/2026-10-14-adala-resultat.json';
const RULES = 'scripts/ocultar_titols_castella.js';
const HIDDEN = 'data/hidden-videos.json';
const MARKER = '// Revisio editorial Adala 2026-10-14';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');

function ruleBlock() {
    const titles = WORKS.filter(work => work.title !== 'December').map(work => work.title);
    return `${MARKER}\n// Bala Perdida: peticio expressa. Tres peces queden apartades provisionalment\n// (Cold in Paradise, December, What Can I Say), sense afirmar que se n'ha verificat\n// tota la lletra. Mr. Fireman es conserva: catala principal amb tornada anglesa.\n// Vegeu docs/revisions/2026-10-14-adala-resultat.json.\nafegeix(${JSON.stringify(CHANNEL_NAMES)}, ${JSON.stringify(titles)});\n// December es un titol, pero tambe part del nom The Cold December:\n// no s'ha de bloquejar Il·legal ni altres peces pel nom de la banda.\nfor (const canal of ${JSON.stringify(CHANNEL_NAMES)}) {\n    const anteriorAdala = REGLES[canal].titols;\n    REGLES[canal].titols = {\n        test: titol => anteriorAdala.test(titol) || /^(?:0?3[\\s.)-]+)?December(?=\\s*(?:$|[\\[({|\\-–—]))/iu.test(\n            String(titol || '').trim().replace(/^Adala(?:\\s*&\\s*The\\s+(?:Cold\\s+December|Same\\s+Song\\s+Band))?\\s*[-–—:]\\s*/iu, '')\n        ),\n    };\n}\n\n`;
}

function collectVideos() {
    const files = ['data/feed.json', 'data/history-pool.json', 'data/historial-musical.json'];
    const archive = 'data/archive/channels';
    if (fs.existsSync(archive)) {
        for (const name of fs.readdirSync(archive)) if (name.endsWith('.json')) files.push(path.join(archive, name));
    }
    for (const name of fs.readdirSync('data')) if (/^search_index_.*\.json$/.test(name)) files.push(path.join('data', name));
    const videos = new Map();
    function visit(value) {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) { value.forEach(visit); return; }
        if (typeof value.id === 'string' && /^[\w-]{11}$/.test(value.id) && typeof value.title === 'string') {
            if (value.channelId === CHANNEL || CHANNEL_NAMES.includes(value.channelTitle) || /\badala\b/i.test(value.title)) {
                videos.set(value.id, { ...videos.get(value.id), ...value });
            }
        }
        Object.values(value).forEach(visit);
    }
    for (const file of files) if (fs.existsSync(file)) visit(read(file));
    return [...videos.values()];
}

function main() {
    const verifyOnly = process.argv.includes('--verify');
    let source = fs.readFileSync(RULES, 'utf8');
    if (!source.includes(MARKER)) {
        assert(!verifyOnly, 'Falta la regla persistent');
        const anchor = 'function esCastella(video) {';
        assert.equal(source.split(anchor).length, 2, 'El punt d\'insercio ha canviat');
        source = source.replace(anchor, ruleBlock() + anchor);
        fs.writeFileSync(RULES, source);
    }
    const { esCastella } = require(path.resolve(RULES));
    const excluded = new Set(WORKS.flatMap(work => work.ids));
    const videos = collectVideos();
    for (const video of videos) {
        if (esCastella({ ...video, channelTitle: 'Adala', contentType: 'song' })) excluded.add(video.id);
    }
    const hidden = read(HIDDEN);
    assert(Array.isArray(hidden.videoIds), 'Format de hidden-videos inesperat');
    const before = new Set(hidden.videoIds);
    const kept = ['osWNWB4e01w']; // Mr. Fireman: no se'n retira cap exclusio previa, pero no se n'afegeix.
    for (const id of kept) assert(!excluded.has(id), 'Fals positiu amb Mr. Fireman');
    const preservedTitles = ['Mr FireMan', 'Mr. Fireman', 'Dama', 'Drames', 'Quantes Pluges', 'Il·legal', 'Nomada', 'No Plou', 'Mateix Foc', 'La Dinastia de la Plata', 'AMOR, LLUITA I FAMÍLIA'];
    for (const title of preservedTitles) assert.equal(esCastella({ channelTitle: 'Adala', title, contentType: 'song' }), false, title);
    assert.equal(esCastella({ channelTitle: 'Adala', title: 'Adala & The Cold December - Il·legal', contentType: 'song' }), false);
    for (const work of WORKS) {
        for (const channelTitle of CHANNEL_NAMES) {
            assert(esCastella({ channelTitle, title: 'ADALA - ' + work.title, contentType: 'song' }), work.title);
        }
    }
    assert(esCastella({ channelTitle: 'Adala', title: '3  December - Adala [Cel LP]', contentType: 'song' }));
    if (verifyOnly) {
        for (const id of excluded) assert(before.has(id), 'Falta ocultar ' + id);
        console.log('Adala: regles, IDs actuals i preservacio verificats.');
        return;
    }
    hidden.videoIds = [...new Set([...hidden.videoIds, ...excluded])].sort();
    write(HIDDEN, hidden);
    // Test de regressio independent, sense alterar els tests d'altres artistes.
    const tests = `import { describe, it, expect } from 'vitest';\nimport { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);\nconst { esCastella } = require('../scripts/ocultar_titols_castella.js');\nconst { readFileSync } = require('node:fs');\nconst hidden = JSON.parse(readFileSync('data/hidden-videos.json', 'utf8'));\ndescribe('Adala: revisio editorial del 14-10-2026', () => {\n    it('oculta els IDs reals del feed i arxiu', () => {\n        for (const id of ${JSON.stringify([...excluded].sort())}) expect(hidden.videoIds).toContain(id);\n    });\n    it('bloqueja les obres seleccionades en totes les variants del canal', () => {\n        for (const channelTitle of ${JSON.stringify(CHANNEL_NAMES)}) {\n            for (const title of ${JSON.stringify(WORKS.map(work => work.title))}) {\n                for (const contentType of ['song', 'live_song']) expect(esCastella({channelTitle, title: 'ADALA - ' + title, contentType})).toBe(true);\n            }\n        }\n    });\n    it('conserva les peces catalanes i no confon December amb el nom de la banda', () => {\n        for (const title of ${JSON.stringify([...preservedTitles, 'Adala & The Cold December - Il·legal'])}) expect(esCastella({channelTitle:'Adala', title, contentType:'song'})).toBe(false);\n        expect(esCastella({channelTitle:'Adala', title:'3  December - Adala [Cel LP]', contentType:'song'})).toBe(true);\n        expect(esCastella({channelTitle:'Un altre artista', title:'December', contentType:'song'})).toBe(false);\n    });\n});\n`;
    fs.writeFileSync('tests/adala-idioma.test.js', tests);
    write(REPORT, {
        reviewedOn: '2026-10-14', artist: 'Adala', channelId: CHANNEL,
        criterion: 'Retirada explicita de Bala Perdida i peces angleses. Es conserva Mr. Fireman (catala principal). Tres peces es retiren provisionalment per revisio pendent; no es presenta el titol com a prova de la llengua.',
        works: WORKS, currentMatches: videos.filter(video => excluded.has(video.id)).map(video => ({ id: video.id, title: video.title, previouslyHidden: before.has(video.id) })),
        hiddenIds: [...excluded].sort(), newlyHiddenIds: [...excluded].filter(id => !before.has(id)).sort(),
        preserved: [{ id: 'osWNWB4e01w', title: 'Mr. Fireman', reason: 'Catala principal; tornada anglesa', source: 'https://www.acordscatala.cat/ca/adala/mr-fireman' }],
        feedEdited: false, archiveEdited: false,
    });
    console.log(JSON.stringify(read(REPORT), null, 2));
}

if (require.main === module) main();
module.exports = { CHANNEL, CHANNEL_NAMES, WORKS, ruleBlock };
