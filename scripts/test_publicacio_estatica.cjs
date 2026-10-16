'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { checksFor, verifyPublished } = require('./comprovar_publicacio_estatica.cjs');

function fixture(t, baseUrl = 'https://example.test/musica/') {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'musica-publicada-'));
    t.after(() => fs.rmSync(out, { recursive: true, force: true }));
    const files = {
        'static-build.json': JSON.stringify({ baseUrl, sourceCommit: 'a'.repeat(40) }),
        'index.html': '<link href="css/styles.css?v=1&amp;theme=2"><link href="css/portada.css?v=3"><script src="js/app.js?v=4"></script><script src="js/vendor/lucide.js"></script><script src="js/vendor/lz-string.js"></script><script src="js/vendor/sortable.js"></script><script src="https://other.test/unrelated.js"></script>',
        'sw.js': 'worker', 'data/music-taxonomy.json': '{}',
        'js/vendor/qr-code-styling.js': 'qr', 'js/vendor/lucide.js': 'icons',
        'js/vendor/lz-string.js': 'lz', 'js/vendor/sortable.js': 'sort',
        'js/app.js': 'app', 'css/styles.css': 'base', 'css/portada.css': 'portada',
    };
    for (const [name, content] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(out, name)), { recursive: true });
        fs.writeFileSync(path.join(out, name), content);
    }
    const fetchImpl = async (value, options) => {
        const url = new URL(value);
        assert.equal(url.origin, new URL(baseUrl).origin);
        assert.ok(url.pathname.startsWith(new URL(baseUrl).pathname));
        assert.equal(options.headers.Authorization, undefined);
        assert.equal(options.headers['Cache-Control'], 'no-cache');
        assert.equal(options.redirect, 'error');
        assert.ok(options.signal);
        const file = url.pathname.slice(new URL(baseUrl).pathname.length) || 'index.html';
        return new Response(files[file], { status: files[file] === undefined ? 404 : 200 });
    };
    return { out, files, fetchImpl };
}

for (const base of ['https://example.test/', 'https://example.test/cat/musica/']) {
    test(`verifica bytes, base i paràmetres reals: ${base}`, async t => {
        const { out, fetchImpl } = fixture(t, base);
        assert.deepEqual(await verifyPublished(out, { fetchImpl }), { files: 11, attempts: 1 });
        assert.ok(checksFor(out).some(c => c.url === `${base}css/styles.css?v=1&theme=2`));
    });
}
for (const defect of ['404', 'raw', 'commit', 'html', 'network']) {
    test(`refusa una publicació incorrecta: ${defect}`, async t => {
        const { out, files, fetchImpl } = fixture(t);
        if (defect === '404') delete files['js/vendor/lucide.js'];
        if (defect === 'raw') files['js/app.js'] = 'codi font sense construir';
        if (defect === 'commit') files['static-build.json'] = files['static-build.json'].replace('a'.repeat(40), 'b'.repeat(40));
        if (defect === 'html') files['data/music-taxonomy.json'] = '<html>Fallback amb HTTP 200</html>';
        const request = defect === 'network' ? async () => { throw new Error('timeout'); } : fetchImpl;
        await assert.rejects(verifyPublished(out, { fetchImpl: request, attempts: 1 }), /Publicació no verificada/);
    });
}
test('tolera propagació curta, però limita els reintents dins la mateixa feina', async t => {
    const { out, fetchImpl } = fixture(t);
    let pauses = 0;
    const request = (...args) => pauses === 0 ? Promise.resolve(new Response('', { status: 404 })) : fetchImpl(...args);
    const pause = async ms => { assert.equal(ms, 5000); pauses++; };
    assert.deepEqual(await verifyPublished(out, { fetchImpl: request, pause }), { files: 11, attempts: 2 });
    pauses = 0;
    await assert.rejects(verifyPublished(out, { fetchImpl: async () => new Response('', { status: 404 }), pause }), /HTTP 404/);
    assert.equal(pauses, 2);
});
test('rebutja un paquet sense commit abans de consultar la xarxa', t => {
    const { out } = fixture(t);
    fs.writeFileSync(path.join(out, 'static-build.json'), JSON.stringify({ baseUrl: 'https://example.test/', sourceCommit: null }));
    assert.throws(() => checksFor(out), /SOURCE_COMMIT/);
});
test('comprova també el CSS inicial combinat amb els bytes reals', async t => {
    const { out, files, fetchImpl } = fixture(t);
    files['css/initial.css'] = 'initial';
    files['index.html'] += '<link rel="stylesheet" href="css/initial.css">';
    fs.writeFileSync(path.join(out, 'index.html'), files['index.html']);
    fs.writeFileSync(path.join(out, 'css/initial.css'), files['css/initial.css']);
    assert.equal((await verifyPublished(out, { fetchImpl })).files, 12);
    files['css/initial.css'] = 'antic';
    await assert.rejects(verifyPublished(out, { fetchImpl, attempts: 1 }), /initial\.css/);
});
