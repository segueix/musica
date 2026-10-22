#!/usr/bin/env node
'use strict';

// Llista d'èxits setmanal (docs/LLISTA_EXITS.md). S'executa cada dia dins «Actualitzar feed musical», després del
// feed i de l'arxiu, però només publica una llista nova els divendres: els altres dies no fa res. No consulta YouTube.
//
//   node scripts/generar_llista_exits.js                 torn normal (divendres)
//   node scripts/generar_llista_exits.js --force         publica ara, sigui quin sigui el dia
//   node scripts/generar_llista_exits.js --base-ref=REF  primera edició: la setmana anterior surt del feed de REF (git)
//   node scripts/generar_llista_exits.js --dry-run       mostra la llista sense escriure res

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { loadCatalog } = require('./generar_web_estatica.cjs');
const exits = require('./lib/llista_exits.js');

const ROOT = path.join(__dirname, '..');
const CHART_FILE = path.join(ROOT, 'data/llista-exits.json');
const BASE_FILE = path.join(ROOT, 'data/llista-exits-base.json');
const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const option = name =>
    args
        .find(arg => arg.startsWith(`--${name}=`))
        ?.split('=')
        .slice(1)
        .join('=') || '';

const readJson = (file, fallback = null) => {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return fallback;
    }
};
const fromGit = (ref, file) =>
    JSON.parse(execFileSync('git', ['show', `${ref}:${file}`], { cwd: ROOT, maxBuffer: 1 << 28 }));

function main() {
    const now = Date.now();
    const feed = readJson(path.join(ROOT, 'data/feed.json'));
    const polling = readJson(path.join(ROOT, 'data/music-channel-polling.json'), { channels: {} });
    if (!feed?.videos?.length) throw new Error('Sense feed: no es pot fer la llista d’èxits.');
    const current = exits.takeSnapshot(feed, polling, now);

    const baseRef = option('base-ref');
    const saved = readJson(BASE_FILE);
    const base = baseRef
        ? {
              ...exits.takeSnapshot(
                  fromGit(baseRef, 'data/feed.json'),
                  fromGit(baseRef, 'data/music-channel-polling.json'),
                  now
              ),
              history: {},
              chartAt: null,
          }
        : saved;

    if (!base?.videos) {
        // Primera vegada sense referència: es desa la fotografia i la llista surt d'aquí a una setmana.
        if (!flag('dry-run')) {
            fs.writeFileSync(BASE_FILE, exits.serializeBase({ ...current, history: {}, chartAt: current.takenAt }));
        }
        console.log('📸 Primera fotografia de visualitzacions desada: la llista d’èxits sortirà d’aquí a una setmana.');
        return;
    }
    if (!flag('force') && !baseRef && !exits.shouldPublish({ now, lastAt: base.chartAt || base.takenAt })) {
        console.log('⏭️  Avui no toca llista d’èxits (es publica els divendres).');
        return;
    }

    const catalog = loadCatalog(ROOT, { now });
    const songs = catalog.songs.map(song => {
        const artist = catalog.artistByChannel.get(song.channelId);
        return { ...song, artistId: artist?.id || song.channelId, artist: artist?.name || song.artist };
    });
    const previous = baseRef ? null : readJson(CHART_FILE);
    const { chart, history } = exits.buildChart({ songs, current, base, previous, history: base.history || {}, now });

    console.log(`🏆 Llista d'èxits del ${chart.from} al ${chart.to}: ${chart.size} cançons`);
    chart.entries.slice(0, Number(process.env.LLISTA_MOSTRA) || 10).forEach(entry => {
        console.log(
            `  ${String(entry.rank).padStart(2)}. ${entry.video.channelTitle} — ${entry.video.title} (+${entry.growth})`
        );
    });
    if (flag('dry-run')) return;
    fs.writeFileSync(CHART_FILE, exits.serializeChart(chart));
    fs.writeFileSync(BASE_FILE, exits.serializeBase({ ...current, history, chartAt: chart.generatedAt }));
}

main();
