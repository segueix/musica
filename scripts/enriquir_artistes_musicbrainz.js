'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'data', 'artistes-musica.json');
const BASE_URL = 'https://musicbrainz.org/ws/2/artist';
const USER_AGENT = 'Segueix-Musica/0.2 (https://segueix.cat)';
const REQUEST_DELAY_MS = 1100;
const RECHECK_DAYS = 90;
const FORCE = process.argv.includes('--force');
const DRY_RUN = process.argv.includes('--dry-run');
const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function unique(values) {
    return [...new Set(values.filter(Boolean))];
}

function daysSince(value) {
    if (!value) return Infinity;
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) return Infinity;
    return (Date.now() - time) / 86400000;
}

function parseYouTubeUrl(rawUrl) {
    let url;
    try {
        url = new URL(rawUrl);
    } catch (_) {
        return null;
    }

    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)) {
        return null;
    }

    const channelMatch = url.pathname.match(/\/channel\/(UC[A-Za-z0-9_-]{22})(?:\/|$)/);
    const handleMatch = url.pathname.match(/^\/@([^/?#]+)/);

    return {
        url: url.href,
        channelId: channelMatch?.[1] || null,
        handle: handleMatch ? `@${decodeURIComponent(handleMatch[1])}` : null,
    };
}

function relationKind(relation) {
    const type = String(relation?.type || '').toLowerCase();
    if (type === 'youtube') return 'youtube';
    if (type === 'youtube music') return 'youtube-music';
    if (type === 'video channel') return 'video-channel';
    return null;
}

function extractYouTubeRelations(payload) {
    const found = [];
    for (const relation of payload?.relations || []) {
        const kind = relationKind(relation);
        const resource = relation?.url?.resource;
        if (!kind || !resource) continue;
        const parsed = parseYouTubeUrl(resource);
        if (!parsed) continue;
        found.push({ ...parsed, relationType: kind });
    }

    const seen = new Set();
    return found.filter((item) => {
        const key = item.url;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

async function fetchMusicBrainzArtist(mbid, attempt = 1) {
    const url = `${BASE_URL}/${encodeURIComponent(mbid)}?inc=url-rels&fmt=json`;
    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
            'User-Agent': USER_AGENT,
        },
    });

    if ((response.status === 429 || response.status === 503) && attempt <= 4) {
        const retryAfter = Number.parseInt(response.headers.get('retry-after') || '', 10);
        const delay = Number.isFinite(retryAfter)
            ? Math.max(retryAfter * 1000, REQUEST_DELAY_MS)
            : Math.min(30000, 2000 * (2 ** (attempt - 1)));
        console.warn(`⚠️ MusicBrainz ${response.status}; reintent en ${Math.round(delay / 1000)} s.`);
        await wait(delay);
        return fetchMusicBrainzArtist(mbid, attempt + 1);
    }

    if (response.status === 404) return null;
    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`MusicBrainz HTTP ${response.status}: ${body.slice(0, 300)}`);
    }

    return response.json();
}

function ensureYouTubeState(artist) {
    artist.youtube ||= { channels: [] };
    artist.youtube.channels ||= [];
    artist.youtube.candidates ||= [];
    artist.enrichment ||= {};
    artist.enrichment.musicbrainz ||= {
        checkedAt: null,
        status: 'pendent',
    };
}

function addCandidate(artist, relation, now) {
    if (artist.youtube.candidates.some((candidate) => candidate.url === relation.url)) return false;
    artist.youtube.candidates.push({
        url: relation.url,
        handle: relation.handle,
        relationType: relation.relationType,
        source: 'musicbrainz',
        discoveredAt: now,
    });
    return true;
}

function addChannel(artist, relation) {
    if (!relation.channelId || !CHANNEL_ID_RE.test(relation.channelId)) return false;
    if (artist.youtube.channels.some((channel) => channel.id === relation.channelId)) return false;

    const hasPrimary = artist.youtube.channels.some((channel) => channel.primary);
    artist.youtube.channels.push({
        id: relation.channelId,
        handle: relation.handle,
        name: null,
        type: relation.relationType === 'youtube' ? 'official' : 'other',
        primary: !hasPrimary,
    });
    return true;
}

async function main() {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    const targets = data.artists.filter((artist) => {
        if (!artist.musicbrainzId) return false;
        if (artist.reviewStatus === 'rebutjat') return false;
        if (artist.youtube?.channels?.length) return false;
        const checkedAt = artist.enrichment?.musicbrainz?.checkedAt;
        return FORCE || daysSince(checkedAt) >= RECHECK_DAYS;
    });

    console.log(`🎵 MusicBrainz: ${targets.length} artistes pendents de revisar.`);
    let checked = 0;
    let directIds = 0;
    let candidates = 0;
    let errors = 0;
    let changed = false;

    for (let index = 0; index < targets.length; index += 1) {
        const artist = targets[index];
        ensureYouTubeState(artist);
        const now = new Date().toISOString();

        try {
            const payload = await fetchMusicBrainzArtist(artist.musicbrainzId);
            const relations = extractYouTubeRelations(payload);
            let artistChanged = false;

            for (const relation of relations) {
                if (relation.channelId) {
                    if (addChannel(artist, relation)) {
                        directIds += 1;
                        artistChanged = true;
                    }
                } else if (addCandidate(artist, relation, now)) {
                    candidates += 1;
                    artistChanged = true;
                }
            }

            artist.enrichment.musicbrainz.checkedAt = now;
            artist.enrichment.musicbrainz.status = relations.length ? 'trobat' : 'sense-youtube';
            artist.enrichment.musicbrainz.relationCount = relations.length;

            if (artist.youtube.channels.length) {
                artist.confidence = 'alta';
                artist.sources = unique([...artist.sources, 'musicbrainz:youtube']);
            } else if (relations.length) {
                artist.sources = unique([...artist.sources, 'musicbrainz:youtube-candidate']);
            }

            artist.lastChecked = now;
            checked += 1;
            changed = true;

            console.log(
                `[${index + 1}/${targets.length}] ${artist.name}: ${relations.length} URL YouTube, ` +
                `${artist.youtube.channels.length} ID directe.`
            );

            if (artistChanged) changed = true;
        } catch (error) {
            errors += 1;
            artist.enrichment.musicbrainz.checkedAt = now;
            artist.enrichment.musicbrainz.status = 'error';
            artist.enrichment.musicbrainz.error = String(error.message || error).slice(0, 300);
            changed = true;
            console.warn(`⚠️ ${artist.name}: ${error.message}`);
        }

        if (index < targets.length - 1) await wait(REQUEST_DELAY_MS);
    }

    if (!changed) {
        console.log('✅ MusicBrainz: no calia actualitzar cap artista.');
        return;
    }

    data.updatedAt = new Date().toISOString();
    console.log(
        `✅ MusicBrainz: ${checked} revisats, ${directIds} IDs directes, ` +
        `${candidates} URLs candidates, ${errors} errors.`
    );

    if (DRY_RUN) {
        console.log('🧪 Dry-run: no s’escriu cap fitxer.');
        return;
    }

    fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
}

main().catch((error) => {
    console.error(`❌ ${error.stack || error.message}`);
    process.exit(1);
});
