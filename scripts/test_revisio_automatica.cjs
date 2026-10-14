'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const core = require('./lib/revisio_automatica');
const cli = require('./revisar_idiomes_automatic');
const now = '2026-10-14T12:00:00.000Z';
const entry = (id = 'aaaaaaaaaaa', artist = 'Artista') => ({ id, artista: artist, artistaId: artist,
    canalId: 'UC_EXEMPLE', titol: 'Cançó de prova', tipus: 'song', descripcio: 'resum' });
const description = ['LLETRA:', 'Aquest text de prova no pertany a cap cançó publicada.',
    'El vent imaginari passa entre les fulles de paper.',
    'La llum de la finestra acompanya aquesta prova.',
    'La tarda torna a començar al carrer inventat.',
    'Les paraules fictícies acaben en aquesta línia.'].join('\n');
const source = core.descriptionSource(entry(), { id: entry().id, channelId: entry().canalId, description });
const analysis = () => ({ videoId: entry().id, sameVersion: true, completeLyrics: true,
    conflict: false, instrumental: false, startLine: 2, endLine: 6,
    segments: [{ start: 2, end: 6, language: 'ca', quote: 'El vent imaginari passa entre les fulles de paper.' }] });

test('proposta catalana amb citació existent, mai validació aplicada', () => {
    const r = core.checkAnalysis(source, analysis());
    assert.equal(r.status, 'proposta-conservar');
    assert.equal(r.fullLyricsVerified, false);
    assert.equal(r.requiresHumanApproval, true);
    assert.ok(!JSON.stringify(r).includes('vent imaginari'));
});
test('rebutja una citació inventada', () => {
    const a = analysis(); a.segments[0].quote = 'Aquesta citació no existeix.';
    assert.equal(core.checkAnalysis(source, a).reason, 'citacio-no-existent');
});
test('no accepta un percentatge majoritari: llengua mixta proposa amagar', () => {
    const a = analysis(); a.segments = [{ start: 2, end: 3, language: 'ca', quote: 'El vent imaginari' },
        { start: 4, end: 6, language: 'other', quote: 'La llum de la finestra' }];
    assert.equal(core.checkAnalysis(source, a).status, 'proposta-amagar');
});
test('límit de la comprovació: verifica citacions, no certifica la detecció lingüística del model', () => {
    const a = analysis(); a.segments[0].language = 'es';
    assert.equal(core.checkAnalysis(source, a).requiresHumanApproval, true);
});
test('llengua desconeguda queda pendent', () => {
    const a = analysis(); a.segments[0].language = 'und';
    assert.equal(core.checkAnalysis(source, a).reason, 'llengua-ambigua');
});
test('lletra incompleta queda pendent', () => {
    assert.equal(core.checkAnalysis(source, { ...analysis(), completeLyrics: false }).status, 'pendent');
});
test('versió diferent queda pendent', () => {
    assert.equal(core.checkAnalysis(source, { ...analysis(), sameVersion: false }).status, 'pendent');
});
test('instrumental no s’infereix per absència de lletra', () => {
    assert.equal(core.checkAnalysis(source, { ...analysis(), instrumental: true }).reason, 'instrumental-no-demostrat');
});
test('cobertura incompleta és pendent', () => {
    const a = analysis(); a.segments[0].end = 3;
    assert.equal(core.checkAnalysis(source, a).reason, 'lletra-no-coberta');
});
test('segments solapats es rebutgen', () => {
    const a = analysis(); a.segments.push({ ...a.segments[0] });
    assert.equal(core.checkAnalysis(source, a).reason, 'segments-solapats');
});
test('identificador erroni del model es rebutja', () => {
    assert.equal(core.checkAnalysis(source, { ...analysis(), videoId: 'bbbbbbbbbbb' }).reason, 'identitat-no-confirmada');
});
test('un canal homònim no hereta identitat', () => {
    assert.equal(core.descriptionSource(entry(), { id: entry().id, channelId: 'ALTRE', description }), null);
});
test('no trunca descripcions per validar només el començament', () => {
    assert.equal(core.descriptionSource(entry(), { id: entry().id, channelId: entry().canalId, description: 'a'.repeat(14001) }), null);
});
test('Provided to YouTube no es considera lletra', () => {
    assert.equal(core.lyricCandidate({ text: 'Provided to YouTube\n' + description, lines: source.lines }), false);
});
test('confiança en artista no és prova documental', () => {
    assert.equal(core.documentaryEvidence(entry(), { decisions: [{ id: entry().id, accio: 'conserva',
        criteri: 'confianca-artista', font: 'https://example.org' }] }, {}), null);
});
test('mateix títol no reutilitza decisions de vídeos diferents', () => {
    assert.equal(core.documentaryEvidence(entry(), { decisions: [{ id: 'bbbbbbbbbbb', accio: 'conserva',
        titol: entry().titol, obra: 'Artista::Cançó de prova', reutilitza: true, font: 'https://example.org' }] }, {}), null);
});
test('un disc només aporta prova amb identificador explícit de l’edició', () => {
    const disc = { artista: 'Artista', accio: 'conserva', font: 'https://example.org/disc', videoIds: ['aaaaaaaaaaa'] };
    assert.equal(core.documentaryEvidence(entry(), {}, { discsVerificats: [disc] }).status, 'proposta-conservar');
    assert.equal(core.documentaryEvidence(entry('bbbbbbbbbbb'), {}, { discsVerificats: [disc] }), null);
});
test('decisions documentals contradictòries queden pendents', () => {
    const decisions = ['conserva', 'amaga'].map(accio => ({ id: entry().id, accio, font: 'https://example.org' }));
    assert.equal(core.documentaryEvidence(entry(), { decisions }, {}).reason, 'fonts-en-conflicte');
});
test('selecció alternada, sense duplicats i amb mida màxima', () => {
    const entries = [entry(), entry('bbbbbbbbbbb'), entry('ccccccccccc', 'B'), entry()];
    const selected = core.selectBatch(entries, {}, { limit: 2, now });
    assert.deepEqual(selected.map(x => x.artista), ['Artista', 'B']);
});
test('cache impedeix tornar a examinar la mateixa peça immediatament', () => {
    const e = core.selectBatch([entry()], {}, { limit: 1, now })[0];
    const cache = { items: { [e.id]: core.checkpoint({}, e, { status: 'pendent', reason: 'sense-proves' }, now) } };
    assert.equal(core.selectBatch([entry()], cache, { limit: 1, now }).length, 0);
    assert.equal(core.selectBatch([entry()], cache, { limit: 1, now, capabilities: 'nova-clau' }).length, 1);
});
test('màxim tres reintents editorials però no per manca de clau', () => {
    const e = { ...entry(), fingerprint: 'x' };
    const cache = { items: { [e.id]: { fingerprint: 'x', attempts: 2 } } };
    assert.equal(core.checkpoint(cache, e, { status: 'pendent', reason: 'sense-clau-ia' }, now).attempts, 2);
    assert.equal(core.checkpoint(cache, e, { status: 'pendent', reason: 'sense-proves' }, now).attempts, 3);
});
test('la CLI rebutja aplicacions i límits no vàlids', () => {
    for (const a of ['--apply', '--limit=101', '--limit=0', '--limit=NaN']) assert.throws(() => cli.options([a], {}));
});
test('cap font s’inventa a partir del text lliure d’una resposta', () => {
    assert.deepEqual(cli.searchSources({ output: [{ content: [{ text: 'https://inventada.example/' }] }] }), []);
});
test('no exporta URLs amb credencials ni tokens', () => {
    const response = { output: [{ action: { sources: [{ url: 'https://user:secret@example.org/' },
        { url: 'https://example.org/?token=secret' }, { url: 'https://example.org/valid' }] } }] };
    assert.deepEqual(cli.searchSources(response), ['https://example.org/valid']);
});
test('execució integral offline: informe i checkpoint; cap canvi al catàleg', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'idiomes-auto-'));
    try {
        fs.mkdirSync(path.join(root, 'data'));
        const inputs = {
            'revisio-idiomes.json': { updatedAt: now, pendents: [entry()], decisions: [] },
            'artistes-vigilats-idioma.json': { schemaVersion: 1, discsVerificats: [] },
            'hidden-videos.json': { videoIds: [] },
            'feed.json': { videos: [{ id: entry().id, channelId: entry().canalId, description }] },
        };
        for (const [name, value] of Object.entries(inputs)) fs.writeFileSync(path.join(root, 'data', name), JSON.stringify(value));
        const report = await cli.run({ root, args: ['--offline', '--limit=1'], env: {}, now });
        assert.equal(report.summary.applied, 0);
        assert.equal(report.summary.examined, 1);
        assert.equal(report.results[0].reason, 'sense-clau-ia');
        for (const [name, value] of Object.entries(inputs)) assert.equal(fs.readFileSync(path.join(root, 'data', name), 'utf8'), JSON.stringify(value));
        assert.ok(!fs.readFileSync(path.join(root, 'reports/idiomes-auto/latest.json'), 'utf8').includes('vent imaginari'));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
