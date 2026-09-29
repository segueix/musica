'use strict';

const fs = require('fs');
const path = require('path');

const ARTISTS_FILE = path.join(process.cwd(), 'data', 'artistes-musica.json');
const VERIFIED_FILE = path.join(process.cwd(), 'data', 'youtube-verified-handles.json');
const CHANNELS_URL = 'https://www.googleapis.com/youtube/v3/channels';
const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;

function normalizeName(value) {
    return String(value || '').trim().toLocaleLowerCase('ca');
}

function normalizeHandle(value) {
    return String(value || '').trim().replace(/^@/, '').toLocaleLowerCase('ca');
}

async function apiJson(url, apiKey) {
    url.searchParams.set('key', apiKey);
    const response = await fetch(url);
    const body = await response.text();
    if (!response.ok) {
        throw new Error('YouTube API HTTP ' + response.status + ': ' + body.slice(0, 250));
    }
    return JSON.parse(body);
}

async function resolveChannel(entry, apiKey) {
    const url = new URL(CHANNELS_URL);
    url.searchParams.set('part', 'snippet');
    if (entry.channelId && CHANNEL_ID_RE.test(entry.channelId)) {
        url.searchParams.set('id', entry.channelId);
    } else if (entry.handle) {
        url.searchParams.set('forHandle', entry.handle);
    } else {
        return null;
    }
    const payload = await apiJson(url, apiKey);
    return payload.items?.[0] || null;
}

async function main() {
    const apiKey = process.env.YOUTUBE_API_KEY_SERVER;
    if (!apiKey) throw new Error('Falta YOUTUBE_API_KEY_SERVER.');

    const data = JSON.parse(fs.readFileSync(ARTISTS_FILE, 'utf8'));
    const verified = JSON.parse(fs.readFileSync(VERIFIED_FILE, 'utf8'));
    const byName = new Map(data.artists.map((artist) => [normalizeName(artist.name), artist]));
    let resolved = 0;
    let skipped = 0;
    let missing = 0;

    for (const entry of verified.channels || []) {
        const artist = byName.get(normalizeName(entry.artist));
        if (!artist) {
            console.warn('⚠️ Artista no trobat: ' + entry.artist);
            missing += 1;
            continue;
        }

        artist.youtube ||= { channels: [], candidates: [] };
        artist.youtube.channels ||= [];

        // Ja resolt = un canal amb ID vàlid que coincideix amb l'entrada verificada:
        // l'ID indicat, o el handle indicat (un handle verificat corregeix un ID erroni).
        const existing = artist.youtube.channels.filter((c) => CHANNEL_ID_RE.test(c.id || ''));
        const sameHandle = (c) => normalizeHandle(c.handle) && normalizeHandle(c.handle) === normalizeHandle(entry.handle);
        const alreadyResolved = entry.channelId
            ? existing.some((c) => c.id === entry.channelId)
            : existing.length > 0 && (!entry.handle || existing.some(sameHandle));
        if (alreadyResolved) {
            skipped += 1;
            continue;
        }

        const item = await resolveChannel(entry, apiKey);
        if (!item || !CHANNEL_ID_RE.test(item.id || '')) {
            console.warn('⚠️ No resolt: ' + entry.artist + ' (' + (entry.handle || entry.channelId || 'sense identificador') + ')');
            missing += 1;
            continue;
        }

        const customUrl = item.snippet?.customUrl || entry.handle || null;
        artist.youtube.channels = [{
            id: item.id,
            handle: customUrl,
            name: item.snippet?.title || null,
            type: entry.type || 'official',
            primary: entry.primary !== false
        }];
        artist.confidence = artist.confidence === 'pendent' ? 'alta' : artist.confidence;
        artist.sources = [...new Set([...(artist.sources || []), 'youtube:manual-verified'])];
        artist.lastChecked = new Date().toISOString();
        resolved += 1;
        console.log('✅ ' + entry.artist + ': ' + item.id + ' ' + (customUrl || ''));
    }

    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(ARTISTS_FILE, JSON.stringify(data, null, 2) + '\n');
    console.log('📊 Canals verificats: ' + resolved + ' resolts; ' + skipped + ' ja presents; ' + missing + ' pendents.');
}

if (require.main === module) {
    main().catch((error) => {
        console.error('❌ ' + (error.stack || error.message));
        process.exit(1);
    });
}
