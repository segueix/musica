'use strict';

// Comprova la resposta pública, no només l’èxit d’upload/deploy. Sense credencials.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function checksFor(outDir) {
    const report = JSON.parse(fs.readFileSync(path.join(outDir, 'static-build.json'), 'utf8'));
    const base = new URL(report.baseUrl);
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || !base.pathname.endsWith('/')) {
        throw new Error('Destinació pública invàlida.');
    }
    if (!/^[a-f0-9]{40}$/.test(report.sourceCommit || '')) throw new Error('Falta SOURCE_COMMIT al paquet.');
    const paths = new Map([
        ['', 'index.html'], ['static-build.json', 'static-build.json'], ['sw.js', 'sw.js'],
        ['data/music-taxonomy.json', 'data/music-taxonomy.json'],
        ['js/vendor/qr-code-styling.js', 'js/vendor/qr-code-styling.js'],
    ]);
    // Conserva els paràmetres de versió que demana un navegador real.
    const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
    for (const tag of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
        const value = tag[0].match(/(?:src|href)\s*=\s*["']([^"']+)["']/i)?.[1];
        if (!value) continue;
        const url = new URL(value.replace(/&amp;/g, '&'), base);
        if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) continue;
        const relative = url.pathname.slice(base.pathname.length);
        if (/^(?:css\/(?:styles|portada)\.css|js\/app\.js|js\/vendor\/[\w-]+\.js)$/.test(relative)) {
            paths.set(relative + url.search, relative);
        }
    }
    return [...paths].map(([requestPath, file]) => ({
        url: new URL(requestPath, base).href,
        hash: digest(fs.readFileSync(path.join(outDir, file))),
    }));
}

async function verifyPublished(outDir, { fetchImpl = fetch, attempts = 3, pause = delay } = {}) {
    const checks = checksFor(outDir);
    if (!Number.isInteger(attempts) || attempts < 1 || attempts > 3) throw new Error('Entre 1 i 3 intents.');
    for (let attempt = 1; attempt <= attempts; attempt++) {
        const errors = [];
        // Com a màxim tres peticions simultànies, amb temps límit per petició.
        for (let i = 0; i < checks.length; i += 3) {
            await Promise.all(checks.slice(i, i + 3).map(async ({ url, hash }) => {
                try {
                    const response = await fetchImpl(url, {
                        headers: { 'Cache-Control': 'no-cache' },
                        redirect: 'error', signal: AbortSignal.timeout(10000),
                    });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    if (digest(Buffer.from(await response.arrayBuffer())) !== hash) {
                        throw new Error('contingut diferent del paquet (publicació antiga, incompleta o sobreescrita)');
                    }
                } catch (error) {
                    errors.push(`${url}: ${error.message}`);
                }
            }));
        }
        if (!errors.length) return { files: checks.length, attempts: attempt };
        if (attempt === attempts) throw new Error(`Publicació no verificada:\n${errors.join('\n')}`);
        await pause(5000);
    }
}

module.exports = { checksFor, verifyPublished };
if (require.main === module) {
    const out = process.argv.find(arg => arg.startsWith('--out='))?.slice(6) || path.join(__dirname, '../_site');
    verifyPublished(out).then(result => {
        console.log(`Publicació verificada: ${result.files} fitxers idèntics al paquet, ${result.attempts} intent(s).`);
    }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
