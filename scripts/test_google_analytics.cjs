const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/google-analytics.js'), 'utf8');
const key = 'segueix_google_analytics_consent_v1';

test('retira autoritzacions antigues sense carregar ni enviar analítica', () => {
    for (const saved of [undefined, 'accepted', 'rejected']) {
        const storage = new Map(saved ? [[key, saved]] : []);
        const window = {};
        const forbidden = () => assert.fail('No es pot contactar amb Google Analytics');
        vm.runInNewContext(source, {
            window, fetch: forbidden, document: { createElement: forbidden },
            localStorage: { removeItem: name => storage.delete(name) },
        });
        assert.equal(window['ga-disable-G-4QED7E19C0'], true);
        assert.equal(storage.has(key), false);
        assert.equal(window.gtag, undefined);
        assert.equal(window.dataLayer, undefined);
    }
});

test('continua desactivada encara que l’emmagatzematge estigui bloquejat', () => {
    const window = {};
    vm.runInNewContext(source, {
        window, localStorage: { removeItem() { throw Error('blocked'); } },
    });
    assert.equal(window['ga-disable-G-4QED7E19C0'], true);
});

test('Acceptar no ofereix analítica ni caselles i es conserva la migració local', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    assert.match(html, /<script defer src="js\/google-analytics.js"><\/script>/);
    assert.doesNotMatch(html, /data-google-analytics-consent|googleAnalyticsSettingsSection|googletagmanager/);
    const banner = html.slice(html.indexOf('<div id="cookieBanner"'), html.indexOf('<script id="earlyCookieNotice"'));
    assert.doesNotMatch(banner, /type="checkbox"/);
    assert.match(banner, />Acceptar<\/button>/);
    assert.match(banner, /No utilitzem Google Analytics/);
    assert.match(sw, /'\.\/js\/google-analytics.js'/);
    assert.doesNotMatch(source, /gtag\(|googletagmanager|addEventListener/);
});
