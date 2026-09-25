'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'data', 'artistes-musica.json');
const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;
const WIKIDATA_RE = /^Q\d+$/;
const MUSICBRAINZ_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONFIDENCE = new Set(['alta', 'mitjana', 'baixa', 'pendent']);
const CHANNEL_TYPES = new Set(['official', 'topic', 'label', 'other']);

function fail(message) {
    console.error(`❌ ${message}`);
    process.exitCode = 1;
}

function isStringArray(value) {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

let data;
try {
    data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (error) {
    console.error(`❌ No s'ha pogut llegir ${FILE}: ${error.message}`);
    process.exit(1);
}

if (data.schemaVersion !== 1) fail('schemaVersion ha de ser 1.');
if (!(data.updatedAt === null || typeof data.updatedAt === 'string')) fail('updatedAt ha de ser null o una data ISO.');
if (!Array.isArray(data.artists)) {
    fail('artists ha de ser un array.');
} else {
    const names = new Set();

    data.artists.forEach((artist, index) => {
        const where = `artists[${index}]`;
        if (!artist || typeof artist !== 'object' || Array.isArray(artist)) {
            fail(`${where} ha de ser un objecte.`);
            return;
        }

        if (typeof artist.name !== 'string' || !artist.name.trim()) {
            fail(`${where}.name és obligatori.`);
        } else {
            const normalized = artist.name.trim().toLocaleLowerCase('ca');
            if (names.has(normalized)) fail(`Artista duplicat: ${artist.name}`);
            names.add(normalized);
        }

        ['aliases', 'genres', 'territories', 'languages', 'sources'].forEach((field) => {
            if (!isStringArray(artist[field])) fail(`${where}.${field} ha de ser un array de textos.`);
        });

        if (!(artist.wikidataId === null || (typeof artist.wikidataId === 'string' && WIKIDATA_RE.test(artist.wikidataId)))) {
            fail(`${where}.wikidataId no és vàlid.`);
        }

        if (!(artist.musicbrainzId === null || (typeof artist.musicbrainzId === 'string' && MUSICBRAINZ_RE.test(artist.musicbrainzId)))) {
            fail(`${where}.musicbrainzId no és vàlid.`);
        }

        if (!CONFIDENCE.has(artist.confidence)) fail(`${where}.confidence no és vàlid.`);
        if (typeof artist.active !== 'boolean') fail(`${where}.active ha de ser booleà.`);
        if (!(artist.lastChecked === null || typeof artist.lastChecked === 'string')) fail(`${where}.lastChecked ha de ser null o una data ISO.`);
        if (typeof artist.notes !== 'string') fail(`${where}.notes ha de ser text.`);

        const channels = artist.youtube?.channels;
        if (!Array.isArray(channels)) {
            fail(`${where}.youtube.channels ha de ser un array.`);
            return;
        }

        let primaryCount = 0;
        channels.forEach((channel, channelIndex) => {
            const channelWhere = `${where}.youtube.channels[${channelIndex}]`;
            if (!CHANNEL_ID_RE.test(channel.id || '')) fail(`${channelWhere}.id no és un YouTube channel ID vàlid.`);
            if (!(channel.handle === null || (typeof channel.handle === 'string' && channel.handle.startsWith('@')))) {
                fail(`${channelWhere}.handle ha de ser null o començar per @.`);
            }
            if (!(channel.name === null || typeof channel.name === 'string')) fail(`${channelWhere}.name ha de ser null o text.`);
            if (!CHANNEL_TYPES.has(channel.type)) fail(`${channelWhere}.type no és vàlid.`);
            if (typeof channel.primary !== 'boolean') fail(`${channelWhere}.primary ha de ser booleà.`);
            if (channel.primary) primaryCount += 1;
        });

        if (primaryCount > 1) fail(`${where} té més d'un canal principal.`);
    });
}

if (!process.exitCode) {
    console.log(`✅ Base d'artistes vàlida: ${data.artists.length} artistes.`);
}
