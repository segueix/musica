'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { decidePublication } = require('./decidir_publicacio_estatica.cjs');
const sourceCommit = 'a'.repeat(40);
const baseUrl = 'https://example.test/musica/';
const now = Date.parse('2026-10-17T14:00:00Z');
const report = { sourceCommit, baseUrl, builtAt: '2026-10-17T12:00:00Z' };
const decide = (metadata = report, options = {}) => decidePublication({ sourceCommit, baseUrl, now,
    fetchImpl: async () => new Response(JSON.stringify(metadata)), ...options });

test('omet un commit idèntic publicat avui abans d’instal·lar dependències', async () => {
    assert.equal((await decide()).publish, false);
});
for (const [name, patch] of [
    ['commit diferent', { sourceCommit: 'b'.repeat(40) }],
    ['domini diferent', { baseUrl: 'https://other.test/' }],
    ['ahir', { builtAt: '2026-10-16T20:00:00Z' }],
    ['manifest antic', { builtAt: undefined }],
    ['data invàlida', { builtAt: 'invalid' }],
    ['data futura', { builtAt: '2026-10-17T15:00:00Z' }],
]) {
    test(`publica si hi ha ${name}`, async () => {
        assert.equal((await decide({ ...report, ...patch })).publish, true);
    });
}
for (const boundary of ['2026-07-01T22:00:00Z', '2026-12-01T23:00:00Z']) {
    test(`renova novetats quan canvia el dia de Madrid: ${boundary}`, async () => {
        const instant = Date.parse(boundary);
        assert.equal((await decide({ ...report, builtAt: new Date(instant - 1000).toISOString() }, { now: instant })).publish, true);
    });
}
test('normalitza la base i fa una única petició curta sense credencials ni redireccions', async () => {
    let count = 0;
    const result = await decide(report, { baseUrl: baseUrl.slice(0, -1), fetchImpl: async (url, options) => {
        count++;
        assert.equal(url.origin + url.pathname, baseUrl + 'static-build.json');
        assert.ok(url.searchParams.get('check'));
        assert.equal(options.headers.Authorization, undefined);
        assert.equal(options.headers['Cache-Control'], 'no-cache');
        assert.equal(options.redirect, 'error');
        assert.ok(options.signal);
        return new Response(JSON.stringify(report));
    } });
    assert.equal(result.publish, false); assert.equal(count, 1);
});
for (const fetchImpl of [
    async () => { throw new Error('timeout'); },
    async () => new Response('', { status: 404 }),
    async () => new Response('<html>error</html>'),
    async () => new Response('null'),
]) {
    test('un error de xarxa o manifest no bloqueja la publicació', async () => {
        assert.equal((await decide(report, { fetchImpl })).publish, true);
    });
}
test('manual i reintent forcen el desplegament sense consultar el manifest', async () => {
    assert.equal((await decide(report, { force: true, fetchImpl: () => assert.fail('No cal xarxa') })).publish, true);
});
test('rebutja metadades locals invàlides abans de consultar la xarxa', async () => {
    for (const options of [{ sourceCommit: 'invalid' }, { baseUrl: 'http://example.test/' },
        { baseUrl: 'https://user:password@example.test/' }, { baseUrl: baseUrl + '?key=secret' }]) {
        await assert.rejects(decide(report, { ...options, fetchImpl: () => assert.fail('No cal xarxa') }));
    }
});
