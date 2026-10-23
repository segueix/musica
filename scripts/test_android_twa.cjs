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
test('Música i Segueix tenen declaracions Android vàlides dins de la mateixa app', () => {
    const config = JSON.parse(read('android/twa-manifest.json'));
    const strings = read('android/app/src/main/res/values/strings.xml');
    const statements = JSON.parse(strings.match(/<string name="assetStatements">([\s\S]*?)<\/string>/)[1].replace(/\\"/g, '"'));
    assert.deepEqual(statements.map(entry => entry.target.site), ['https://musica.segueix.cat', 'https://segueix.cat']);
    for (const entry of statements) {
        assert.equal(entry.target.namespace, 'web');
        assert.deepEqual(entry.relation, ['delegate_permission/common.handle_all_urls']);
    }
    assert.deepEqual(config.additionalTrustedOrigins, ['musica.segueix.cat', 'segueix.cat']);
    const origins = strings.match(/<string-array name="additional_trusted_origins">([\s\S]*?)<\/string-array>/)[1];
    assert.deepEqual([...origins.matchAll(/<item>(.*?)<\/item>/g)].map(match => match[1]), statements.map(entry => entry.target.site));
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    assert.match(manifest, /ADDITIONAL_TRUSTED_ORIGINS"\s+android:resource="@array\/additional_trusted_origins"/);
    assert.match(manifest, /android:host="segueix\.cat"/);
    const gradle = read('android/app/build.gradle');
    assert.match(gradle, new RegExp(`versionCode ${config.appVersionCode}\\b`));
    assert.ok(gradle.includes(`versionName "${config.appVersionName}"`));
    assert.ok(config.appVersionCode > 1, 'ha de poder actualitzar la primera APK');
});
test('les claus privades i els resultats de compilació queden exclosos de git', () => {
    const ignore = read('android/.gitignore');
    for (const entry of ['keystore/', '*.jks', '*.keystore', '*.apk', '*.aab', 'local.properties']) assert.ok(ignore.includes(entry));
});
