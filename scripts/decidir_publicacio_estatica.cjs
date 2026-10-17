'use strict';

// Una consulta petita abans d'instal·lar dependències. Cap cache ni credencial pública.
const fs = require('node:fs');
const madridDate = value => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(value));

async function decidePublication({ baseUrl, sourceCommit, force = false, now = Date.now(), fetchImpl = fetch }) {
    const base = new URL(baseUrl);
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
        throw new Error('SITE_URL ha de ser una URL pública HTTPS sense credencials ni paràmetres.');
    }
    if (!base.pathname.endsWith('/')) base.pathname += '/';
    if (!/^[a-f0-9]{40}$/.test(sourceCommit || '')) throw new Error('SOURCE_COMMIT invàlid.');
    if (force) return { publish: true, reason: 'Publicació manual o reintent explícit.' };
    try {
        const url = new URL('static-build.json', base);
        url.searchParams.set('check', String(now));
        const response = await fetchImpl(url, {
            headers: { 'Cache-Control': 'no-cache' }, redirect: 'error', signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) throw new Error('Manifest no disponible.');
        const report = await response.json();
        const builtAt = Date.parse(report.builtAt);
        if (report.baseUrl === base.href && report.sourceCommit === sourceCommit &&
            Number.isFinite(builtAt) && builtAt <= now && madridDate(builtAt) === madridDate(now)) {
            return { publish: false, reason: 'Aquest commit ja està publicat avui; s’ometen instal·lació, build i desplegament.' };
        }
    } catch {
        // Un error de xarxa, JSON antic o redirecció mai no impedeix publicar.
    }
    // El dia següent es reconstrueix encara que main no canviï: les novetats caduquen.
    return { publish: true, reason: 'Cal publicar canvis o renovar el catàleg diari.' };
}

module.exports = { decidePublication };
if (require.main === module) {
    decidePublication({ baseUrl: process.env.SITE_URL, sourceCommit: process.env.SOURCE_COMMIT,
        force: process.env.FORCE_PUBLISH === 'true' }).then(result => {
        console.log(result.reason);
        if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `publish=${result.publish}\n`);
        if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, result.reason + '\n');
    }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
