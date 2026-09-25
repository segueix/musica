'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'data', 'artistes-musica.json');
const API_KEY = process.env.YOUTUBE_API_KEY_SERVER;
const API_URL = 'https://www.googleapis.com/youtube/v3/channels';
const DRY_RUN = process.argv.includes('--dry-run');
const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;

if (!API_KEY) {
    console.error('❌ Falta el secret YOUTUBE_API_KEY_SERVER.');
    process.exit(1);
}

function unique(values) {
    return [...new Set(values.filter(Boolean))];
}

function parseCandidate(candidate) {
    if (candidate?.handle && candidate.handle.startsWith('@')) {
        return { kind: 'handle', value: candidate.handle };
    }

    try {
        const url = new URL(candidate?.url || '');
        const handleMatch = url.pathname.match(/^\/@([^/?#]+)/);
        if (handleMatch) {
            return { kind: 'handle', value: `@${decodeURIComponent(handleMatch[1])}` };
        }

        const usernameMatch = url.pathname.match(/^\/user\/([^/?#]+)/i);
        if (usernameMatch) {
            return { kind: 'username', value: decodeURIComponent(usernameMatch[1]) };
        }
    } catch (_) {
        return null;
    }

    return null;
}

async function resolveChannel(target) {
    const url = new URL(API_URL);
    url.searchParams.set('part', 'id,snippet');
    if (target.kind === 'handle') {
        url.searchParams.set('forHandle', target.value);
    } else if (target.kind === 'username') {
        url.searchParams.set('forUsername', target.value);
    } else {
        return null;
    }
    url.searchParams.set('key', API_KEY);

    const response = await fetch(url);
    if (!response.ok) {
        const body = await response.text().catch(() => '');
        let reason = '';
        try {
            const parsed = JSON.parse(body);
            reason = parsed?.error?.errors?.[0]?.reason || parsed?.error?.message || '';
        } catch (_) {
            reason = body.slice(0, 180);
        }

        if (response.status === 403) {
            throw new Error(`YouTube API 403 (${reason || 'forbidden'}). Revisa la clau, l'API activada i les restriccions.`);
        }
        throw new Error(`YouTube API HTTP ${response.status} (${reason || 'error'}).`);
    }

    const payload = await response.json();
    const channel = payload.items?.[0];
    if (!channel?.id || !CHANNEL_ID_RE.test(channel.id)) return null;

    const customUrl = channel.snippet?.customUrl || null;
    return {
        id: channel.id,
        handle: customUrl && customUrl.startsWith('@') ? customUrl : null,
        name: channel.snippet?.title || null,
    };
}

async function main() {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    let calls = 0;
    let resolved = 0;
    let unsupported = 0;
    let notFound = 0;

    for (const artist of data.artists) {
        if (artist.reviewStatus === 'rebutjat') continue;
        if (artist.youtube?.channels?.length) continue;

        const candidates = artist.youtube?.candidates || [];
        for (const candidate of candidates) {
            const target = parseCandidate(candidate);
            if (!target) {
                unsupported += 1;
                continue;
            }

            calls += 1;
            const channel = await resolveChannel(target);
            if (!channel) {
                notFound += 1;
                console.log(`⚪ ${artist.name}: no resolt (${target.kind} ${target.value}).`);
                continue;
            }

            artist.youtube.channels.push({
                id: channel.id,
                handle: channel.handle,
                name: channel.name,
                type: 'official',
                primary: true,
            });
            artist.sources = unique([...artist.sources, 'youtube:channels-list']);
            artist.confidence = 'alta';
            artist.lastChecked = new Date().toISOString();
            resolved += 1;

            console.log(`✅ ${artist.name}: ${channel.id} (${channel.handle || channel.name || target.value}).`);
            break;
        }
    }

    console.log(
        `📊 YouTube: ${calls} consultes channels.list, ${resolved} resolts, ` +
        `${notFound} no trobats, ${unsupported} URLs no resolubles sense search.list.`
    );

    if (!resolved || DRY_RUN) {
        if (DRY_RUN) console.log('🧪 Dry-run: no s’escriu cap fitxer.');
        return;
    }

    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
}

main().catch((error) => {
    console.error(`❌ ${error.message}`);
    process.exit(1);
});
