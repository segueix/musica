'use strict';

const fs = require('node:fs');
const { createPolicy } = require('./lib/politica_idiomes');
const ID = /^[A-Za-z0-9_-]{11}$/;
const MARKER = /<!-- musica-idiomes-v1:([A-Za-z0-9_,\-]+) -->/g;

function notifiedIds(comments) {
    const ids = new Set();
    for (const comment of comments) {
        if (comment.user?.login !== 'github-actions[bot]') continue;
        for (const match of String(comment.body || '').matchAll(MARKER)) {
            for (const id of match[1].split(',')) if (ID.test(id)) ids.add(id);
        }
    }
    return ids;
}

function candidates(state, config, registry, hidden, notified = new Set()) {
    if (config.schemaVersion !== 1 || !Array.isArray(config.baselineVideoIds) || !Array.isArray(state.pendents)) {
        throw new Error('Configuració o cua d’avisos invàlida');
    }
    const excluded = new Set([...config.baselineVideoIds, ...hidden.videoIds, ...notified]);
    const policy = createPolicy(registry);
    const result = new Map();
    for (const item of state.pendents) {
        if (ID.test(item.id) && !excluded.has(item.id) && policy.resolve(item).mode === 'vigilats') {
            result.set(item.id, item);
        }
    }
    return [...result.values()].sort((a, b) => String(a.afegida || '').localeCompare(String(b.afegida || '')) || a.id.localeCompare(b.id));
}

function safeText(value, length = 160) {
    return String(value || '').replace(/[\r\n\t]+/g, ' ').slice(0, length)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/@/g, '@\u200b').replace(/[\\`*_\[\]~|]/g, '\\$&');
}

function message(items, repository, now = new Date()) {
    const date = new Intl.DateTimeFormat('ca-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short' }).format(now);
    return [
        `**${items.length} cançons noves pendents de revisió d’idioma** — ${date}`,
        '',
        ...items.map(item => `- **${safeText(item.artista, 80)}** · [${safeText(item.titol)}](https://www.youtube.com/watch?v=${item.id})`),
        '',
        'Són entrades noves a la cua; això no determina en quina llengua estan cantades. Algunes poden ser publicacions antigues acabades d’incorporar.',
        '',
        `Pots escoltar-les i indicar quines cal conservar o retirar. [Cua completa](https://github.com/${repository}/blob/main/data/revisio-idiomes.json). Respondre al correu publica un comentari aquí; no aplica cap decisió automàticament.`,
        '',
        `<!-- musica-idiomes-v1:${items.map(item => item.id).join(',')} -->`,
    ].join('\n');
}

async function notify({ state, config, registry, hidden, token, repository, request = fetch, now }) {
    if (repository !== config.repository || !/^[\w.-]+\/[\w.-]+$/.test(repository) || !Number.isSafeInteger(config.issueNumber) || config.issueNumber < 1) {
        throw new Error('Destinació d’avisos invàlida');
    }
    if (!candidates(state, config, registry, hidden).length) return { sent: 0 };
    if (!token) throw new Error('Falta GITHUB_TOKEN');
    const endpoint = `https://api.github.com/repos/${repository}/issues/${config.issueNumber}`;
    async function api(url, body) {
        const response = await request(url, {
            method: body ? 'POST' : 'GET',
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
            ...(body ? { body: JSON.stringify({ body }) } : {}),
            signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error(`GitHub ha rebutjat l’avís (HTTP ${response.status})`);
        return response.json();
    }
    const issue = await api(endpoint);
    if (issue.pull_request) throw new Error('La destinació ha de ser una incidència, no una PR');
    if (issue.state !== 'open') return { sent: 0, paused: true };
    const comments = [];
    for (let page = 1; ; page++) {
        const batch = await api(`${endpoint}/comments?per_page=100&page=${page}`);
        if (!Array.isArray(batch)) throw new Error('Resposta de comentaris invàlida');
        comments.push(...batch);
        if (batch.length < 100) break;
    }
    const unseen = candidates(state, config, registry, hidden, notifiedIds(comments));
    // Un sol comentari per passada, amb mida acotada; l’excés queda per a la següent.
    const items = unseen.slice(0, 100);
    if (!items.length) return { sent: 0 };
    await api(`${endpoint}/comments`, message(items, repository, now));
    return { sent: items.length, remaining: unseen.length - items.length };
}

async function main() {
    const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
    const input = {
        state: read('data/revisio-idiomes.json'), config: read('data/avisos-idiomes.json'),
        registry: read('data/artistes-vigilats-idioma.json'), hidden: read('data/hidden-videos.json'),
        repository: process.env.GITHUB_REPOSITORY, token: process.env.GITHUB_TOKEN,
    };
    if (process.argv.includes('--dry-run')) {
        console.log(`${candidates(input.state, input.config, input.registry, input.hidden).length} candidates abans de consultar els avisos ja enviats. Cap petició de xarxa.`);
        return;
    }
    const result = await notify(input);
    const summary = result.paused ? 'Avisos d’idioma pausats: incidència tancada.' : `Avisos d’idioma: ${result.sent} pistes notificades; ${result.remaining || 0} ajornades.`;
    console.log(summary);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { candidates, notifiedIds, message, notify };
