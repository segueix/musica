'use strict';

// Proves locals, sense dependències ni xarxa. El parseig d'aquí només cobreix
// la sintaxi restringida dels disparadors del repositori; no substitueix un validador YAML.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { decideScope, generalSchedule, madridOffsetHours } = require('./lib/abast_feed.js');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, '.github/workflows');
const read = name => fs.readFileSync(path.join(dir, name), 'utf8');
const approved = [
    'actualitzador.yml', 'actualitzar-feed-musica.yml', 'actualitzar-feed-nous-grups.yml',
    'actualitzar-visualitzacions-historial.yml', 'cercar-canals-youtube.yml', 'descobrir-musica.yml',
    'enriquir-generes.yml', 'manteniment-manual.yml', 'publicar-comparticio-musica.yml',
    'revisar_shorts.yml', 'validar-musica.yml',
].sort();
function onBlock(source) {
    const match = source.match(/^on:\s*\n([\s\S]*?)(?=^\S|$(?![\s\S]))/m);
    assert.ok(match, 'Falta el bloc on');
    return match[1];
}
function eventBlock(source, event) {
    const block = onBlock(source);
    const start = block.indexOf(`  ${event}:`);
    if (start < 0) return '';
    const tail = block.slice(start + 2 + event.length + 1);
    return tail.split(/\n(?=  [a-z_]+:)/)[0];
}
function patterns(source, event) {
    const block = eventBlock(source, event);
    const result = [...block.matchAll(/^      - '([^']+)'\s*$/gm)].map(x => x[1]);
    assert.ok(result.length, 'No s’han trobat els patrons de camí');
    return result;
}
function glob(pattern) {
    let out = '';
    for (let i = 0; i < pattern.length; i++) {
        if (pattern.slice(i, i + 3) === '**/') { out += '(?:.*/)?'; i += 2; }
        else if (pattern.slice(i, i + 2) === '**') { out += '.*'; i++; }
        else if (pattern[i] === '*') out += '[^/]*';
        else out += pattern[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp('^' + out + '$');
}
function selected(file, list) {
    let result = false;
    for (const p of list) {
        const negative = p.startsWith('!');
        if (glob(negative ? p.slice(1) : p).test(file)) result = !negative;
    }
    return result;
}

test('només queden els onze workflows del sistema aprovats', () => {
    assert.deepEqual(fs.readdirSync(dir).filter(n => /\.ya?ml$/.test(n)).sort(), approved);
});
for (const name of approved) {
    test(`${name}: no hi ha execucions redundants per branques o commits de dades`, () => {
        const source = read(name), triggers = onBlock(source);
        if (name !== 'publicar-comparticio-musica.yml') assert.doesNotMatch(triggers, /^  (push|workflow_run):/m);
        if (name !== 'validar-musica.yml') assert.doesNotMatch(triggers, /^  pull_request:/m);
        assert.match(source, /workflow_dispatch:/);
        assert.doesNotMatch(source, /OPENAI_API_KEY|api\.openai\.com|pull_request_target:/);
    });
}
test('el feed només té un cron local i conserva els torns dels Tema', () => {
    const s = read('actualitzar-feed-musica.yml');
    assert.equal((onBlock(s).match(/cron:/g) || []).length, 1);
    assert.match(s, /cron: "0 20 \* \* \*"\n\s+timezone: "Europe\/Madrid"/);
    assert.match(s, /MUSIC_TOPIC_FULL_DAYS: "7"/);
    assert.match(s, /if: github.ref == 'refs\/heads\/main'/);
    assert.match(s, /node scripts\/archivar_feed_musical.js/);
    assert.match(s, /node scripts\/generar_afinitats_musica.js --repair-catalog/);
    assert.match(s, /bash scripts\/publicar_dades.sh/);
    assert.doesNotMatch(s, /auditar_elegibilitat_musica|node scripts\/aprimar_feed.js/);
});
for (const date of ['2026-01-01', '2026-03-29', '2026-07-01', '2026-10-25', '2026-12-01']) {
    test(`cron local únic, inclosos canvis d’hora: ${date}`, () => {
        const now = new Date(date + 'T18:05:00Z');
        assert.ok([1, 2].includes(madridOffsetHours(now)));
        assert.equal(generalSchedule(now), '0 20 * * *');
        assert.equal(decideScope({ event: 'schedule', schedule: '0 20 * * *', now }).runApi, true);
        for (const schedule of ['', '0 20 2-30/2 * *', '0 18 * * *', '0 19 * * *']) {
            assert.equal(decideScope({ event: 'schedule', schedule, now }).runApi, false);
        }
    });
}
for (const event of ['push', 'workflow_run', 'pull_request', 'unknown']) {
    test(`${event}: altes, baixes i seleccions no consulten YouTube`, () => {
        const scope = decideScope({ event, added: ['UCnew'], reviewed: ['UCreview'], removed: ['UCold'] });
        assert.equal(scope.work, false); assert.equal(scope.runApi, false);
        assert.deepEqual(scope.targetIds, []); assert.deepEqual(scope.removed, ['UCold']);
    });
}
test('l’actualització expressament manual continua disponible', () => {
    assert.equal(decideScope({ event: 'workflow_dispatch' }).runApi, true);
});
const publisher = read('publicar-comparticio-musica.yml');
const validator = read('validar-musica.yml');
const publishPatterns = patterns(publisher, 'push');
const validatePatterns = patterns(validator, 'pull_request');
for (const file of [
    'data/artistes-musica.json', 'data/hidden-videos.json', 'data/revisio-idiomes.json',
    'data/music-channel-video-allowlist.json', 'data/feed.json', 'data/origens-artistes.json',
    'js/channels-ca.json', 'js/features/music-affinity-catalog.js',
    'docs/revisions/idiomes-codex/lot-0001.json', 'scripts/revisions/incorporar_grup.js',
]) {
    test(`editar ${file} no inicia publicació ni CI`, () => {
        assert.equal(selected(file, publishPatterns), false);
        assert.equal(selected(file, validatePatterns), false);
    });
}
for (const file of ['index.html', 'css/styles.css', 'js/app.js', 'js/features/player.js', 'sw.js', 'icons/logo.png']) {
    test(`un canvi del sistema sí publica: ${file}`, () => assert.equal(selected(file, publishPatterns), true));
}
test('publicació només sobre main i després d’actualitzacions correctes, mai audit/arxiu/afinitats', () => {
    assert.match(eventBlock(publisher, 'push'), /branches: \[main\]/);
    assert.match(eventBlock(publisher, 'workflow_run'), /branches: \[main\]/);
    assert.doesNotMatch(eventBlock(publisher, 'workflow_run'), /Arxivar|Auditar|afinitats|Service Worker/);
    assert.match(publisher, /workflow_run.conclusion == 'success'/);
    assert.match(publisher, /workflow_run.head_branch == 'main'/);
    assert.match(publisher, /node scripts\/actualitzar_versio_sw.js/);
    assert.match(publisher, /node scripts\/generar_pagines_compartir.js/);
    assert.doesNotMatch(publisher, /YOUTUBE_API_KEY|npm ci|npm test/);
});
test('una sola feina CI, cancel·lació de versions antigues i cap comparativa duplicada amb la base', () => {
    assert.match(validator, /cancel-in-progress: true/);
    assert.match(validator, /contents: read/);
    assert.doesNotMatch(validator, /matrix:|workflow_run:|secrets\./);
    assert.equal((validator.match(/runs-on:/g) || []).length, 1);
    assert.equal((validator.match(/npx vitest run/g) || []).length, 1);
});
test('durant l’estalvi només el feed conserva un calendari automàtic', () => {
    const scheduled = approved.filter(name => /^  schedule:/m.test(onBlock(read(name))));
    assert.deepEqual(scheduled, [
        'actualitzar-feed-musica.yml',
    ]);
});


test('la petició diària per canals substitueix els dies parells, sense activar manteniments', () => {
    assert.equal(generalSchedule(), '0 20 * * *');
    assert.equal(decideScope({ event: 'schedule', schedule: '0 20 2-30/2 * *' }).work, false);
    assert.match(read('actualitzar-feed-musica.yml'), /scripts\/test_activitat_musica.cjs/);
    assert.match(read('actualitzador.yml'), /data\/music-channel-polling.json/);
});
