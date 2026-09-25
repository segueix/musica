'use strict';

const fs = require('fs');
const path = require('path');

const OUTPUT = path.join(process.cwd(), 'data', 'artistes-musica.json');
const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';
const CATALAN = 'Q7026';
const USER_AGENT = 'Segueix-Musica/0.1 (https://github.com/segueix/musica)';

function argNumber(name, fallback) {
    const prefix = `--${name}=`;
    const found = process.argv.find((arg) => arg.startsWith(prefix));
    if (!found) return fallback;
    const value = Number.parseInt(found.slice(prefix.length), 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

const LIMIT = Math.min(argNumber('limit', 500), 2000);
const DRY_RUN = process.argv.includes('--dry-run');

function unique(values) {
    return [...new Set(values.filter(Boolean))];
}

function bindingValue(binding, key) {
    return binding?.[key]?.value || null;
}

function qidFromUri(uri) {
    const match = String(uri || '').match(/\/entity\/(Q\d+)$/);
    return match ? match[1] : null;
}

function normalizeChannelId(value) {
    const id = String(value || '').trim();
    return /^UC[A-Za-z0-9_-]{22}$/.test(id) ? id : null;
}

async function queryWikidata(where, evidence) {
    const query = `
SELECT DISTINCT ?artist ?artistLabel ?youtube ?musicbrainz WHERE {
  ?artist wdt:P434 ?musicbrainz.
  ${where}
  OPTIONAL { ?artist wdt:P2397 ?youtube. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ca,en". }
}
LIMIT ${LIMIT}
`;

    const url = new URL(WIKIDATA_ENDPOINT);
    url.searchParams.set('query', query);
    url.searchParams.set('format', 'json');

    const response = await fetch(url, {
        headers: {
            Accept: 'application/sparql-results+json',
            'User-Agent': USER_AGENT,
        },
    });

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Wikidata HTTP ${response.status}: ${text.slice(0, 500)}`);
    }

    const payload = await response.json();
    return (payload.results?.bindings || []).map((binding) => ({
        wikidataId: qidFromUri(bindingValue(binding, 'artist')),
        name: bindingValue(binding, 'artistLabel'),
        youtubeId: normalizeChannelId(bindingValue(binding, 'youtube')),
        musicbrainzId: bindingValue(binding, 'musicbrainz'),
        evidence,
    })).filter((item) => item.wikidataId && item.name);
}

async function discover() {
    const queries = [
        {
            evidence: 'wikidata:languages-spoken-catalan',
            where: `?artist wdt:P1412 wd:${CATALAN}.`,
        },
        {
            evidence: 'wikidata:native-language-catalan',
            where: `?artist wdt:P103 wd:${CATALAN}.`,
        },
        {
            evidence: 'wikidata:performed-catalan-work',
            where: `?work wdt:P407 wd:${CATALAN}; wdt:P175 ?artist.`,
        },
    ];

    const batches = [];
    for (const item of queries) {
        try {
            const rows = await queryWikidata(item.where, item.evidence);
            console.log(`🔎 ${item.evidence}: ${rows.length} resultats`);
            batches.push(...rows);
        } catch (error) {
            console.warn(`⚠️ Consulta fallida (${item.evidence}): ${error.message}`);
        }
    }

    if (batches.length === 0) {
        throw new Error('Cap consulta de Wikidata ha retornat resultats.');
    }

    return batches;
}

function loadDatabase() {
    if (!fs.existsSync(OUTPUT)) {
        return { schemaVersion: 1, updatedAt: null, artists: [] };
    }
    return JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
}

function newArtist(candidate, now) {
    const channels = candidate.youtubeId ? [{
        id: candidate.youtubeId,
        handle: null,
        name: null,
        type: 'official',
        primary: true,
    }] : [];

    return {
        name: candidate.name,
        aliases: [],
        genres: [],
        territories: [],
        languages: ['ca'],
        wikidataId: candidate.wikidataId,
        musicbrainzId: candidate.musicbrainzId || null,
        youtube: { channels },
        confidence: candidate.youtubeId ? 'alta' : 'pendent',
        reviewStatus: 'pendent',
        active: false,
        sources: unique([
            `https://www.wikidata.org/wiki/${candidate.wikidataId}`,
            candidate.evidence,
        ]),
        lastChecked: now,
        notes: '',
    };
}

function mergeCandidate(artist, candidate, now) {
    let changed = false;

    if (!artist.musicbrainzId && candidate.musicbrainzId) {
        artist.musicbrainzId = candidate.musicbrainzId;
        changed = true;
    }

    if (!artist.languages.includes('ca')) {
        artist.languages.push('ca');
        changed = true;
    }

    const sourceValues = [
        `https://www.wikidata.org/wiki/${candidate.wikidataId}`,
        candidate.evidence,
    ];
    for (const source of sourceValues) {
        if (source && !artist.sources.includes(source)) {
            artist.sources.push(source);
            changed = true;
        }
    }

    if (candidate.youtubeId && !artist.youtube.channels.some((channel) => channel.id === candidate.youtubeId)) {
        const hasPrimary = artist.youtube.channels.some((channel) => channel.primary);
        artist.youtube.channels.push({
            id: candidate.youtubeId,
            handle: null,
            name: null,
            type: 'official',
            primary: !hasPrimary,
        });
        changed = true;
    }

    if (artist.youtube.channels.length > 0 && artist.confidence === 'pendent') {
        artist.confidence = 'alta';
        changed = true;
    }

    if (changed) artist.lastChecked = now;
    return changed;
}

async function main() {
    const candidates = await discover();
    const data = loadDatabase();
    const now = new Date().toISOString();

    const byQid = new Map(data.artists.filter((artist) => artist.wikidataId).map((artist) => [artist.wikidataId, artist]));
    let created = 0;
    let updated = 0;

    for (const candidate of candidates) {
        const existing = byQid.get(candidate.wikidataId);
        if (!existing) {
            const artist = newArtist(candidate, now);
            data.artists.push(artist);
            byQid.set(candidate.wikidataId, artist);
            created += 1;
        } else if (mergeCandidate(existing, candidate, now)) {
            updated += 1;
        }
    }

    data.artists.sort((a, b) => a.name.localeCompare(b.name, 'ca', { sensitivity: 'base' }));

    if (created === 0 && updated === 0) {
        console.log(`✅ Sense canvis. Base actual: ${data.artists.length} artistes.`);
        return;
    }

    data.updatedAt = now;
    console.log(`✅ Descoberta: +${created} artistes, ${updated} actualitzats; total ${data.artists.length}.`);

    if (DRY_RUN) {
        console.log('🧪 Dry-run: no s’escriu cap fitxer.');
        return;
    }

    fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 2) + '\n');
}

main().catch((error) => {
    console.error(`❌ ${error.message}`);
    process.exit(1);
});
