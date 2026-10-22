'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { candidates, notifiedIds, message, notify } = require('./avisar_pendents_idioma.cjs');
const registry = { schemaVersion: 1, vigilats: [{ artista: 'Grup', canals: ['UCwatched'] }], confianca: [{ artista: 'Altre', canals: ['UCtrusted'] }] };
const config = { schemaVersion: 1, repository: 'segueix/musica', issueNumber: 207, baselineVideoIds: ['BASELINE001'] };
const track = (id, canalId = 'UCwatched') => ({ id, canalId, artista: 'Grup', titol: 'Cançó', afegida: '2026-10-22' });
const state = { pendents: [track('BASELINE001'), track('NEWVIDEO001')] };
const input = { state, config, registry, hidden: { videoIds: [] }, token: 'fake-test-token', repository: config.repository };
const response = data => ({ ok: true, json: async () => data });
const botComment = ids => ({ user: { login: 'github-actions[bot]' }, body: `<!-- musica-idiomes-v1:${ids.join(',')} -->` });

test('el pas reutilitza el workflow existent després de publicar i no bloqueja el web', () => {
    const source = fs.readFileSync('.github/workflows/actualitzar-feed-musica.yml', 'utf8');
    assert.match(source, /issues: write/);
    assert(source.indexOf('node scripts/avisar_pendents_idioma.cjs') > source.indexOf('bash scripts/publicar_dades.sh'));
    const step = source.slice(source.indexOf('- name: Avisa de cançons'));
    assert.match(step, /continue-on-error: true/);
    assert.match(step, /if: steps.scope.outputs.work == 'true'/);
});

test('exclou la cua inicial, ocults, confiança, duplicats i IDs invàlids', () => {
    const state = { pendents: [track('BASELINE001'), track('HIDDEN00001'), track('TRUSTED0001', 'UCtrusted'), track('NEWVIDEO001'), track('NEWVIDEO001'), track('invalid')] };
    assert.deepEqual(candidates(state, config, registry, { videoIds: ['HIDDEN00001'] }).map(x => x.id), ['NEWVIDEO001']);
});
test('només reconeix marcadors del bot; una reaparició no repeteix l’avís', () => {
    const comments = [botComment(['NEWVIDEO001']), { user: { login: 'reader' }, body: '<!-- musica-idiomes-v1:OTHER000001 -->' }];
    const notified = notifiedIds(comments);
    assert.equal(notified.size, 1);
    assert.equal(candidates(state, config, registry, input.hidden, notified).length, 0);
});
test('sense novetats no consulta la xarxa', async () => {
    assert.deepEqual(await notify({ ...input, state: { pendents: [track('BASELINE001')] }, request: () => assert.fail('xarxa') }), { sent: 0 });
});
test('agrupa en un comentari i no repeteix en reexecutar', async () => {
    const comments = []; let posts = 0;
    const request = async (url, options) => {
        if (options.method === 'POST') { posts++; const body = JSON.parse(options.body).body; comments.push({ user: { login: 'github-actions[bot]' }, body }); return response({ id: 1 }); }
        return response(url.includes('/comments?') ? comments : { state: 'open' });
    };
    assert.equal((await notify({ ...input, request })).sent, 1);
    assert.equal((await notify({ ...input, request })).sent, 0);
    assert.equal(posts, 1);
    assert.match(comments[0].body, /watch\?v=NEWVIDEO001/);
});
test('llegeix totes les pàgines abans de decidir', async () => {
    const request = async (url, options) => {
        assert.notEqual(options.method, 'POST');
        if (url.includes('&page=1')) return response(Array.from({ length: 100 }, () => ({ body: 'comentari' })));
        if (url.includes('&page=2')) return response([botComment(['NEWVIDEO001'])]);
        return response({ state: 'open' });
    };
    assert.equal((await notify({ ...input, request })).sent, 0);
});
test('una incidència tancada pausa els avisos', async () => {
    assert.deepEqual(await notify({ ...input, request: async () => response({ state: 'closed' }) }), { sent: 0, paused: true });
});
test('un error de lectura no envia cap avís ni perd el pendent', async () => {
    await assert.rejects(notify({ ...input, request: async () => ({ ok: false, status: 403 }) }), /HTTP 403/);
    assert.equal(candidates(state, config, registry, input.hidden).length, 1);
});
test('un POST ambigu no es reintenta automàticament; la següent passada consulta el registre', async () => {
    let posts = 0;
    await assert.rejects(notify({ ...input, request: async (url, options) => {
        if (options.method === 'POST') { posts++; throw new Error('timeout'); }
        return response(url.includes('/comments?') ? [] : { state: 'open' });
    } }), /timeout/);
    assert.equal(posts, 1);
});
test('el text no permet mencions ni HTML injectat i el comentari té mida acotada', () => {
    const body = message(Array.from({ length: 100 }, () => ({ ...track('NEWVIDEO001'), artista: '@all <img>', titol: 'x'.repeat(5000) })), config.repository);
    assert.doesNotMatch(body, /@all|<img>/);
    assert(body.length < 60000);
});
test('rebutja repositoris diferents i una PR com a destinació', async () => {
    await assert.rejects(notify({ ...input, repository: 'other/repo' }), /Destinació/);
    await assert.rejects(notify({ ...input, request: async () => response({ state: 'open', pull_request: {} }) }), /no una PR/);
});
test('límit de 100 pistes per avís: la resta continua pendent', async () => {
    const state = { pendents: Array.from({ length: 101 }, (_, i) => track('ID' + String(i).padStart(9, '0'))) };
    let body;
    const result = await notify({ ...input, state, request: async (url, options) => {
        if (options.method === 'POST') { body = JSON.parse(options.body).body; return response({ id: 1 }); }
        return response(url.includes('/comments?') ? [] : { state: 'open' });
    } });
    assert.deepEqual(result, { sent: 100, remaining: 1 });
    assert.equal(candidates(state, config, registry, input.hidden, notifiedIds([{ user: { login: 'github-actions[bot]' }, body }])).length, 1);
});
