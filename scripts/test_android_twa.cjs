const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
test('l’app i el domini comparteixen paquet i certificat públic', () => {
    const config = JSON.parse(read('android/twa-manifest.json'));
    const links = JSON.parse(read('.well-known/assetlinks.json'));
    assert.equal(config.host, 'musica.segueix.cat');
    assert.equal(config.startUrl, '/');
    assert.equal(config.packageId, 'cat.segueix.musica');
    assert.equal(links[0].target.package_name, config.packageId);
    assert.deepEqual(links[0].relation, ['delegate_permission/common.handle_all_urls']);
    assert.match(links[0].target.sha256_cert_fingerprints[0], /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    assert.equal(config.fingerprints[0].value, links[0].target.sha256_cert_fingerprints[0]);
});
test('l’embolcall no afegeix permisos sensibles ni analítica', () => {
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    assert.doesNotMatch(manifest, /ACCESS_(?:FINE|COARSE|BACKGROUND)_LOCATION|RECORD_AUDIO|android.permission.CAMERA|POST_NOTIFICATIONS/);
    assert.doesNotMatch(read('android/app/build.gradle'), /firebase|play-services-analytics|appsflyer/i);
    assert.equal(JSON.parse(read('android/twa-manifest.json')).enableNotifications, false);
});
test('les claus privades i els resultats de compilació queden exclosos de git', () => {
    const ignore = read('android/.gitignore');
    for (const entry of ['keystore/', '*.jks', '*.keystore', '*.apk', '*.aab', 'local.properties']) assert.ok(ignore.includes(entry));
});
