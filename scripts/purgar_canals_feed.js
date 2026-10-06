#!/usr/bin/env node
'use strict';

// Treu del feed i de l'arxiu els canals que ja no són a data/artistes-musica.json, SENSE cap crida a l'API de
// YouTube (abans es regenerava el feed sencer, ≈ 1.200 unitats de quota, per treure un sol canal).
//
// Ús:  node scripts/purgar_canals_feed.js                 (baixes = canals del feed que no són a la base)
//      node scripts/purgar_canals_feed.js --canals=UC…,UC…  (només aquests, si encara no són a la base)
//      node scripts/purgar_canals_feed.js --dry-run
//
// Després cal `node scripts/archivar_feed_musical.js` (refà el feed calent, el pool de ràdio i l'historial dels
// estils a partir de l'arxiu) i `npm run search:index:hybrid:rebuild`, com fa el workflow «Actualitzar feed musical».

const fs = require('fs');
const path = require('path');
const { slimFeed, serializeFeed } = require('./lib/aprimar_feed');
const { activeChannelIds, removedChannelIds, purgeChannels } = require('./lib/purga_canals');

const ROOT = process.cwd();
const FILES = {
    artists: path.join(ROOT, 'data', 'artistes-musica.json'),
    feed: path.join(ROOT, 'data', 'feed.json'),
    channelIndex: path.join(ROOT, 'js', 'channels-ca.json'),
    review: path.join(ROOT, 'data', 'music-content-review.json'),
    topicReview: path.join(ROOT, 'data', 'music-topic-review.json'),
    topicCatalog: path.join(ROOT, 'data', 'music-topic-catalog.json'),
    catalogState: path.join(ROOT, 'data', 'music-catalog-state.json'),
    albums: path.join(ROOT, 'data', 'albums-musica.json'),
    audit: path.join(ROOT, 'data', 'music-feed-audit.json'),
};
const ARCHIVE_DIR = path.join(ROOT, 'data', 'archive', 'channels');

function readJson(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        return null;
    }
}

const json2 = value => JSON.stringify(value, null, 2) + '\n';

// Cada fitxer amb el mateix format que hi escriu update_music_feed.js
const WRITERS = {
    feed: value => serializeFeed(slimFeed(value)),
    channelIndex: json2,
    review: json2,
    topicReview: json2,
    topicCatalog: value =>
        `{\n  "updatedAt": ${JSON.stringify(value.updatedAt)},\n  "channels": {\n${Object.entries(value.channels || {})
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([id, entry]) => `    ${JSON.stringify(id)}: ${JSON.stringify(entry)}`)
            .join(',\n')}\n  }\n}\n`,
    catalogState: json2,
    albums: value => JSON.stringify(value),
    audit: json2,
};

function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const explicit = (args.find(arg => arg.startsWith('--canals=')) || '')
        .slice('--canals='.length)
        .split(',')
        .map(id => id.trim())
        .filter(Boolean);

    const db = readJson(FILES.artists);
    const data = Object.fromEntries(Object.keys(WRITERS).map(key => [key, readJson(FILES[key])]));
    if (!db || !data.feed) throw new Error('Falten data/artistes-musica.json o data/feed.json');

    const active = activeChannelIds(db);
    const archiveIds = fs.existsSync(ARCHIVE_DIR)
        ? fs
              .readdirSync(ARCHIVE_DIR)
              .filter(name => name.endsWith('.json'))
              .map(name => path.basename(name, '.json'))
        : [];
    const removed = explicit.length
        ? explicit.filter(id => !active.has(id))
        : removedChannelIds(data.feed, active, archiveIds);
    if (explicit.length && removed.length < explicit.length) {
        const stillActive = explicit.filter(id => active.has(id));
        console.warn('⚠️ Encara són a la base (no es treuen): ' + stillActive.join(', '));
    }
    if (!removed.length) {
        console.log('✅ Cap canal de baixa: no hi ha res a treure.');
        return;
    }

    const archiveName = id => {
        const archive = readJson(path.join(ARCHIVE_DIR, `${id}.json`));
        const video = archive?.videos?.[0];
        return video?.channelTitle || video?.artist || '';
    };
    const names = removed.map(id => `${data.feed.channels?.[id]?.name || archiveName(id) || '?'} (${id})`);
    const before = (data.feed.videos || []).length;
    const purged = purgeChannels(data, removed);
    if (purged.audit) {
        purged.audit.indexedChannelCount = active.size;
        purged.audit.allIndexedChannelsVisible = Object.keys(purged.feed.channels || {}).length === active.size;
    }
    const archives = removed.map(id => path.join(ARCHIVE_DIR, `${id}.json`)).filter(file => fs.existsSync(file));

    console.log(`🗑️ Canals de baixa: ${names.join(', ')}`);
    console.log(
        `   Feed: ${before} → ${purged.feed.videos.length} vídeos; arxius per esborrar: ${archives.length}` +
            (dryRun ? " (--dry-run: no s'escriu res)" : '')
    );
    if (dryRun) return;

    for (const [key, write] of Object.entries(WRITERS)) {
        if (!purged[key] || purged[key] === data[key]) continue;
        fs.writeFileSync(FILES[key], write(purged[key]));
    }
    archives.forEach(file => fs.unlinkSync(file));
    console.log('✅ Baixes aplicades sense cap crida a YouTube.');
}

try {
    main();
} catch (error) {
    console.error('❌ ' + (error.stack || error.message));
    process.exit(1);
}
