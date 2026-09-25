'use strict';

const fs = require('fs');
const path = require('path');

const OUTPUT = path.join(process.cwd(), 'data', 'artistes-musica.json');
const EXCLUSIONS_FILE = path.join(process.cwd(), 'data', 'music-exclusions.json');
const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';
const CATALAN = 'Q7026';
const USER_AGENT = 'Segueix-Musica/0.1 (https://github.com/segueix/musica)';
const PSEUDO_ARTIST_MBIDS = new Set(['89ad4ac3-39f7-470e-963a-56509c546377']);

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
            evidence: 'wikidata:native-language-catalan-musician',
            where: `
?artist wdt:P103 wd:${CATALAN}.
{
  ?artist wdt:P31 wd:Q215380.
}
UNION
{
  ?artist wdt:P106 ?occupation.
  VALUES ?occupation {
    wd:Q639669
    wd:Q177220
    wd:Q488205
    wd:Q2252262
    wd:Q36834
    wd:Q753110
  }
}
`,
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

function normalizeExclusionName(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .trim();
}

function loadExclusions() {
    if (!fs.existsSync(EXCLUSIONS_FILE)) return { qids: new Set(), names: new Set() };
    const data = JSON.parse(fs.readFileSync(EXCLUSIONS_FILE, 'utf8'));
    const qids = new Set();
    const names = new Set();
    for (const item of data.exclusions || []) {
        if (item.wikidataId) qids.add(item.wikidataId);
        for (const value of [item.name, ...(item.aliases || [])]) {
            const normalized = normalizeExclusionName(value);
            if (normalized) names.add(normalized);
        }
    }
    return { qids, names };
}

function isExcluded(exclusions, entity) {
    return exclusions.qids.has(entity?.wikidataId)
        || exclusions.names.has(normalizeExclusionName(entity?.name));
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
    const exclusions = loadExclusions();
    const now = new Date().toISOString();

    const byQid = new Map(data.artists.filter((artist) => artist.wikidataId).map((artist) => [artist.wikidataId, artist]));
    let created = 0;
    let updated = 0;

    for (const candidate of candidates) {
        if (PSEUDO_ARTIST_MBIDS.has(candidate.musicbrainzId)) continue;
        if (isExcluded(exclusions, candidate)) continue;
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

    const strongSources = new Set([
        'wikidata:native-language-catalan-musician',
        'wikidata:performed-catalan-work',
    ]);
    const beforePrune = data.artists.length;
    data.artists = data.artists.filter((artist) => {
        if (isExcluded(exclusions, artist)) return false;
        if (PSEUDO_ARTIST_MBIDS.has(artist.musicbrainzId) && artist.reviewStatus === 'pendent' && !artist.active) return false;
        if (artist.reviewStatus !== 'pendent' || artist.active || artist.notes) return true;
        const evidence = artist.sources.filter((source) => source.startsWith('wikidata:'));
        return evidence.some((source) => strongSources.has(source));
    });
    const pruned = beforePrune - data.artists.length;

    data.artists.sort((a, b) => a.name.localeCompare(b.name, 'ca', { sensitivity: 'base' }));

    if (created === 0 && updated === 0 && pruned === 0) {
        console.log(`✅ Sense canvis. Base actual: ${data.artists.length} artistes.`);
        return;
    }

    data.updatedAt = now;
    console.log(`✅ Descoberta: +${created} artistes, ${updated} actualitzats, -${pruned} candidats febles; total ${data.artists.length}.`);

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
