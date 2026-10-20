const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/google-analytics.js'), 'utf8');
function setup(saved, blocked = false) {
    const scripts = [], events = {}, inputs = [0, 1].map(() => ({ addEventListener(name, fn) { this[name] = fn; } }));
    const reject = { addEventListener(name, fn) { this[name] = fn; } };
    const storage = new Map(saved ? [['segueix_google_analytics_consent_v1', saved]] : []);
    const window = { location: new URL('https://segueix.github.io/musica/?importData=PRIVATE#secret'),
        addEventListener(name, fn) { events[name] = fn; } };
    const document = { referrer: 'https://example.org/?secret=private',
        querySelectorAll: () => inputs, getElementById: () => reject,
        createElement: () => ({}), head: { appendChild: el => scripts.push(el) } };
    const localStorage = {
        getItem: key => { if (blocked) throw Error('blocked'); return storage.get(key); },
        setItem: (key, value) => { if (blocked) throw Error('blocked'); storage.set(key, value); },
    };
    vm.runInNewContext(source, { window, document, localStorage, URL });
    const toggle = value => { inputs[0].checked = value; inputs[0].change(); };
    return { window, scripts, inputs, events, reject, storage, toggle };
}
test('cap etiqueta sense consentiment, tampoc amb emmagatzematge bloquejat', () => {
    for (const ctx of [setup(), setup('rejected'), setup(null, true)]) {
        assert.equal(ctx.scripts.length, 0);
        assert.equal(ctx.window['ga-disable-G-4QED7E19C0'], true);
    }
});
test('acceptar carrega una sola etiqueta i retira consulta i fragment', () => {
    const ctx = setup(); ctx.toggle(true); ctx.toggle(true);
    assert.equal(ctx.scripts.length, 1);
    assert.equal(ctx.scripts[0].async, true);
    assert.match(ctx.scripts[0].src, /id=G-4QED7E19C0$/);
    const config = ctx.window.dataLayer.find(args => args[0] === 'config');
    assert.equal(config[2].page_location, 'https://segueix.github.io/musica/');
    assert.equal(config[2].page_referrer, 'https://example.org');
    assert.equal(ctx.inputs[1].checked, true);
    assert.equal(ctx.storage.get('segueix_google_analytics_consent_v1'), 'accepted');
});
test('rebuig i retirada en una altra pestanya aturen els enviaments', () => {
    const ctx = setup('accepted');
    assert.equal(ctx.scripts.length, 1);
    ctx.reject.click();
    assert.equal(ctx.window['ga-disable-G-4QED7E19C0'], true);
    assert.equal(ctx.inputs[1].checked, false);
    ctx.toggle(true);
    ctx.events.storage({ key: null, newValue: null });
    assert.equal(ctx.window['ga-disable-G-4QED7E19C0'], true);
    assert.equal(ctx.scripts.length, 1);
});
test('el shell i el precache inclouen la integració local, no la biblioteca externa', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    assert.match(html, /<script defer src="js\/google-analytics.js"><\/script>/);
    assert.equal((html.match(/data-google-analytics-consent/g) || []).length, 2);
    assert.match(sw, /'\.\/js\/google-analytics.js'/);
    assert.doesNotMatch(sw, /googletagmanager/);
});
