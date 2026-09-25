'use strict';

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(process.cwd(), 'data', 'artistes-musica.json');
const TAXONOMY_FILE = path.join(process.cwd(), 'data', 'music-genres.json');
const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';
const MUSICBRAINZ_BASE = 'https://musicbrainz.org/ws/2/artist';
const USER_AGENT = 'Segueix-Musica/0.3 (https://segueix.cat)';
const MB_DELAY_MS = 1100;
const MB_RECHECK_DAYS = 90;
const WIKIDATA_CHUNK = 80;
const FORCE = process.argv.includes('--force');
const DRY_RUN = process.argv.includes('--dry-run');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalize(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function unique(values) {
    const seen = new Set();
    const out = [];
    for (const value of values || []) {
        const text = String(value || '').trim();
        if (!text) continue;
        const key = normalize(text);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(text);
    }
    return out;
}

function daysSince(value) {
    if (!value) return Infinity;
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) return Infinity;
    return (Date.now() - time) / 86400000;
}

function qidFromUri(uri) {
    const match = String(uri || '').match(/\/entity\/(Q\d+)$/);
    return match ? match[1] : null;
}

function categoryLabels(taxonomy) {
    return taxonomy.categories.map((category) => category.label);
}

function mapRawGenres(rawGenres, taxonomy) {
    const labels = [];
    const matchedRaw = new Set();

    for (const category of taxonomy.categories) {
        if (category.id === 'altres') continue;
        let categoryMatched = false;

        for (const raw of rawGenres) {
            const normalizedRaw = normalize(raw);
            if (!normalizedRaw) continue;

            for (const alias of category.match || []) {
                const normalizedAlias = normalize(alias);
                if (!normalizedAlias) continue;
                const haystack = ' ' + normalizedRaw + ' ';
                const needle = ' ' + normalizedAlias + ' ';
                if (normalizedRaw === normalizedAlias || haystack.includes(needle)) {
                    categoryMatched = true;
                    matchedRaw.add(normalize(raw));
                    break;
                }
            }
        }

        if (categoryMatched) labels.push(category.label);
    }

    const unmappedRaw = rawGenres.filter((raw) => !matchedRaw.has(normalize(raw)));
    return { labels, unmappedRaw };
}

async function fetchWikidataChunk(qids) {
    if (!qids.length) return [];
    const values = qids.map((qid) => 'wd:' + qid).join(' ');
    const query = [
        'SELECT DISTINCT ?artist ?genre ?genreLabel WHERE {',
        '  VALUES ?artist { ' + values + ' }',
        '  ?artist wdt:P136 ?genre.',
        '  SERVICE wikibase:label { bd:serviceParam wikibase:language "ca,en,es". }',
        '}'
    ].join('\n');

    const url = new URL(WIKIDATA_ENDPOINT);
    url.searchParams.set('query', query);
    url.searchParams.set('format', 'json');

    const response = await fetch(url, {
        headers: {
            Accept: 'application/sparql-results+json',
            'User-Agent': USER_AGENT
        }
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error('Wikidata HTTP ' + response.status + ': ' + body.slice(0, 250));
    }

    const payload = await response.json();
    return (payload.results?.bindings || []).map((binding) => ({
        wikidataId: qidFromUri(binding.artist?.value),
        genre: binding.genreLabel?.value || binding.genre?.value || null
    })).filter((row) => row.wikidataId && row.genre);
}

async function fetchAllWikidataGenres(artists) {
    const qids = artists.map((artist) => artist.wikidataId).filter(Boolean);
    const byQid = new Map();

    for (let offset = 0; offset < qids.length; offset += WIKIDATA_CHUNK) {
        const chunk = qids.slice(offset, offset + WIKIDATA_CHUNK);
        const rows = await fetchWikidataChunk(chunk);
        for (const row of rows) {
            if (!byQid.has(row.wikidataId)) byQid.set(row.wikidataId, []);
            byQid.get(row.wikidataId).push(row.genre);
        }
    }

    for (const [qid, genres] of byQid.entries()) {
        byQid.set(qid, unique(genres));
    }
    return byQid;
}

async function fetchMusicBrainzGenres(mbid, attempt = 1) {
    const url = new URL(MUSICBRAINZ_BASE + '/' + encodeURIComponent(mbid));
    url.searchParams.set('inc', 'genres');
    url.searchParams.set('fmt', 'json');

    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
            'User-Agent': USER_AGENT
        }
    });

    if ((response.status === 429 || response.status === 503) && attempt <= 4) {
        const retryAfter = Number.parseInt(response.headers.get('retry-after') || '', 10);
        const delay = Number.isFinite(retryAfter)
            ? Math.max(retryAfter * 1000, MB_DELAY_MS)
            : Math.min(30000, 2000 * (2 ** (attempt - 1)));
        await wait(delay);
        return fetchMusicBrainzGenres(mbid, attempt + 1);
    }

    if (response.status === 404) return [];
    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error('MusicBrainz HTTP ' + response.status + ': ' + body.slice(0, 250));
    }

    const payload = await response.json();
    return unique((payload.genres || [])
        .filter((genre) => Number(genre.count || 0) > 0)
        .map((genre) => genre.name));
}

async function main() {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const taxonomy = JSON.parse(fs.readFileSync(TAXONOMY_FILE, 'utf8'));
    const allowedLabels = new Set(categoryLabels(taxonomy));

    for (const artist of data.artists) {
        artist.genres ||= [];
        artist.genresRaw ||= [];
        artist.enrichment ||= {};
        artist.enrichment.genres ||= {
            checkedAt: null,
            musicbrainzCheckedAt: null,
            wikidataRaw: [],
            musicbrainzRaw: [],
            unmappedRaw: [],
            status: 'pendent'
        };
    }

    console.log('🏷️ Wikidata: recuperant gèneres per ' + data.artists.length + ' artistes...');
    let wikidataMap = new Map();
    try {
        wikidataMap = await fetchAllWikidataGenres(data.artists);
    } catch (error) {
        console.warn('⚠️ Wikidata gèneres: ' + error.message);
    }

    let mbChecked = 0;
    let mbErrors = 0;
    const mbTargets = data.artists.filter((artist) => {
        if (artist.reviewStatus === 'rebutjat') return false;
        if (!artist.musicbrainzId) return false;
        const checkedAt = artist.enrichment?.genres?.musicbrainzCheckedAt;
        return FORCE || daysSince(checkedAt) >= MB_RECHECK_DAYS;
    });

    console.log('🎼 MusicBrainz: ' + mbTargets.length + ' artistes a revisar.');

    for (let index = 0; index < mbTargets.length; index += 1) {
        const artist = mbTargets[index];
        const state = artist.enrichment.genres;
        try {
            state.musicbrainzRaw = await fetchMusicBrainzGenres(artist.musicbrainzId);
            state.musicbrainzCheckedAt = new Date().toISOString();
            delete state.musicbrainzError;
            mbChecked += 1;
        } catch (error) {
            state.musicbrainzCheckedAt = new Date().toISOString();
            state.musicbrainzError = String(error.message || error).slice(0, 300);
            mbErrors += 1;
            console.warn('⚠️ ' + artist.name + ': ' + error.message);
        }
        if (index < mbTargets.length - 1) await wait(MB_DELAY_MS);
    }

    let mappedArtists = 0;
    let rawArtists = 0;
    let unmappedArtists = 0;

    for (const artist of data.artists) {
        const state = artist.enrichment.genres;
        state.wikidataRaw = unique(wikidataMap.get(artist.wikidataId) || state.wikidataRaw || []);

        const raw = unique([...(state.wikidataRaw || []), ...(state.musicbrainzRaw || [])]);
        artist.genresRaw = raw;
        const mapped = mapRawGenres(raw, taxonomy);
        state.unmappedRaw = mapped.unmappedRaw;
        state.checkedAt = new Date().toISOString();
        state.status = raw.length === 0
            ? 'sense-dades'
            : mapped.labels.length
                ? (mapped.unmappedRaw.length ? 'parcial' : 'classificat')
                : 'per-revisar';

        if (!(artist.sources || []).includes('genre:manual')) {
            artist.genres = mapped.labels.filter((label) => allowedLabels.has(label));
        }

        if (raw.length) rawArtists += 1;
        if (artist.genres.length) mappedArtists += 1;
        if (state.unmappedRaw.length) unmappedArtists += 1;
    }

    data.updatedAt = new Date().toISOString();
    console.log(
        '✅ Gèneres: ' + mappedArtists + ' artistes classificats; '
        + rawArtists + ' amb dades originals; '
        + unmappedArtists + ' amb alguna etiqueta per revisar; '
        + mbChecked + ' consultes MusicBrainz; '
        + mbErrors + ' errors.'
    );

    if (DRY_RUN) {
        console.log('🧪 Dry-run: no s’escriu cap fitxer.');
        return;
    }

    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2) + '\n');
}

module.exports = { normalize, mapRawGenres };

if (require.main === module) {
    main().catch((error) => {
        console.error('❌ ' + (error.stack || error.message));
        process.exit(1);
    });
}
