const SHEET_CSV_URL = process.env.GOOGLE_SHEET_CSV_URL;

if (!SHEET_CSV_URL) {
    console.error('🚫 Error: Falta la URL de Google Sheets (GOOGLE_SHEET_CSV_URL) als Secrets.');
    process.exit(1);
}

const fs = require('fs');
const https = require('https');
const path = require('path');
const { writeJsonIfChanged } = require('./lib/escriure-json-si-canvia');

// La clau API es llegeix dels Secrets de GitHub per seguretat
const API_KEY = process.env.YOUTUBE_API_KEY;
const OUTPUT_FEED_JSON = path.join(process.cwd(), 'data', 'feed.json');
const OUTPUT_RECENT_FEED_JSON = path.join(process.cwd(), 'data', 'recent-feed.json');
const OUTPUT_ARCHIVE_DIR = path.join(process.cwd(), 'data', 'archive');
const OUTPUT_CHANNEL_ARCHIVE_DIR = path.join(OUTPUT_ARCHIVE_DIR, 'channels');
const OUTPUT_FEED_JS = 'feed_updates.js';
const OUTPUT_SUPPORT_JSON = path.join(process.cwd(), 'data', 'support.json');
// Falsos Shorts verificats per scripts/revisar_shorts.js: la durada diu que són
// Shorts, però YouTube els serveix com a vídeos normals.
const FALSE_SHORTS_JSON = path.join(process.cwd(), 'data', 'falsos-shorts.json');
const VIDEOS_PER_CHANNEL = Number.parseInt(process.env.VIDEOS_PER_CHANNEL ?? '50', 10);
const FETCH_PER_CHANNEL = Math.min(
    50,
    Math.max(1, Number.parseInt(process.env.YOUTUBE_FETCH_PER_CHANNEL ?? `${VIDEOS_PER_CHANNEL}`, 10))
);
const RECENT_FEED_LIMIT = Math.max(1, Number.parseInt(process.env.RECENT_FEED_LIMIT ?? '3000', 10));
const SAFETY_LIMIT_PER_CHANNEL = Math.max(1, Number.parseInt(process.env.SAFETY_LIMIT_PER_CHANNEL ?? '500', 10));
const CHANNEL_LIMITS = {
    youtuber: 15,
    entitat: 10,
    digitalMitja: 10
};
const BATCH_SIZE = 5;      // Process 5 channels at a time
const BATCH_DELAY = 2000;  // Wait 2 seconds between batches
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Funció per descarregar dades que sap seguir TOTES les redireccions (301, 302, 307, 308)
 */
const fetchData = (url) => {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        };

        https.get(url, options, (res) => {
            // Si el codi és 3xx (redirecció) i hi ha una nova ubicació, la seguim
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                console.log(`Redirecció detectada (${res.statusCode}). Seguint cap a: ${res.headers.location}`);
                return fetchData(res.headers.location).then(resolve).catch(reject);
            }

            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP ${res.statusCode} ${data.slice(0, 800)}`));
                }
                resolve(data);
            });
        }).on('error', (e) => reject(e));
    });
};

const fetchYouTubeData = async (url) => {
    const response = await fetch(url);

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`YouTube API HTTP ${response.status} Body: ${body.slice(0, 1200)}`);
    }

    const data = await response.json();
    return data;
};

/**
 * Converteix el contingut CSV en una llista d'objectes (canals)
 */
function parseCSV(csvText) {
    const cleanText = csvText.replace(/^\uFEFF/, ''); // Elimina BOM si n'hi ha
    const lines = cleanText.split(/\r?\n/).filter(line => line.trim() !== '');
    
    if (lines.length < 2) return [];

    let separator = ',';
    const firstLine = lines[0];
    // Detectem si el separador és coma o punt i coma
    if (firstLine.includes(';') && (firstLine.split(';').length > firstLine.split(',').length)) {
        separator = ';';
    }

    const headers = firstLine.split(separator).map(h => h.trim().toLowerCase());
    const normalizedHeaders = headers.map(header =>
        header.normalize('NFD').replace(/\p{Diacritic}/gu, '')
    );
    const idIdx = headers.indexOf('id');
    const nameIdx = headers.indexOf('name');
    const catIdx = headers.indexOf('category');
    const accumulateIdx = normalizedHeaders.indexOf('acumular historic?');
    const accumulateFallbackIdx = normalizedHeaders.indexOf('accumulate history?');
    const languageFilterIdx = normalizedHeaders.indexOf('filtre idioma');
    const liveIdx = headers.findIndex(header => header.toLowerCase() === 'directes');
    const shortsIdxCandidates = [
        'shorts',
        'indexar shorts?',
        'index shorts?',
        'shorts enabled',
        'activar shorts?'
    ];
    const shortsIdx = shortsIdxCandidates
        .map(candidate => normalizedHeaders.indexOf(candidate))
        .find(idx => idx >= 0);

    if (idIdx === -1) {
        console.error("❌ No s'ha trobat la columna 'ID'. Capçaleres detectades:", headers);
        return [];
    }

    const parseCategories = (value) => {
        if (!value) return [];
        return value.split(/[;,]/).map(c => c.trim()).filter(Boolean);
    };

    const parseShortsPreference = (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        if (!normalized) return true; // compatibilitat enrere: si no s'indica, s'indexen shorts
        if (['no', 'false', '0', 'off'].includes(normalized)) return false;
        if (['si', 'sí', 'yes', 'true', '1', 'on'].includes(normalized)) return true;
        return true;
    };

    const shouldIndexShortsByCategory = (categories) => {
        const normalizedCategories = (Array.isArray(categories) ? categories : [])
            .map(category => String(category || '')
                .normalize('NFD')
                .replace(/\p{Diacritic}/gu, '')
                .trim()
                .toLowerCase());
        const hasEntityOrMediaCategory = normalizedCategories.some(category => [
            'entitats',
            'entitat',
            'digitals',
            'digital',
            'mitjans',
            'mitja'
        ].includes(category));
        return !hasEntityOrMediaCategory;
    };

    return lines.slice(1).map(line => {
        const values = line.split(separator);
        const shouldAccumulateValue = values[accumulateIdx >= 0 ? accumulateIdx : accumulateFallbackIdx]?.trim().toLowerCase();
        const languageFilterValue = values[languageFilterIdx]?.trim().toLowerCase();
        const liveValue = values[liveIdx]?.trim().toLowerCase();
        const categories = parseCategories(values[catIdx]);
        const shortsCell = shortsIdx >= 0 ? values[shortsIdx] : '';
        const hasExplicitShortsPreference = String(shortsCell || '').trim() !== '';
        return {
            id: values[idIdx]?.trim(),
            name: values[nameIdx]?.trim(),
            categories,
            shouldAccumulate: shouldAccumulateValue === 'si',
            languageFilter: languageFilterValue === 'auto' ? 'auto' : '',
            checkLive: liveValue === 'auto',
            indexShorts: hasExplicitShortsPreference
                ? parseShortsPreference(shortsCell)
                : shouldIndexShortsByCategory(categories)
        };
    }).filter(c => c.id && c.id !== ''); 
}

/**
 * Converteix durada ISO 8601 a segons
 */
function isoDurationToSeconds(iso) {
    if (!iso) return 0;
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    const seconds = Number(match[3] || 0);
    return (hours * 3600) + (minutes * 60) + seconds;
}

function chunkArray(items, size) {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

function truncateText(text, maxLength = 300) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength).trim()}...`;
}

function normalizeCategory(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .trim()
        .toLowerCase();
}

function getChannelTypeLimit(categories) {
    const normalized = Array.isArray(categories) ? categories.map(normalizeCategory) : [];
    if (normalized.includes('entitats') || normalized.includes('entitat')) {
        return CHANNEL_LIMITS.entitat;
    }
    if (normalized.includes('digitals') || normalized.includes('digital') || normalized.includes('mitjans') || normalized.includes('mitja')) {
        return CHANNEL_LIMITS.digitalMitja;
    }
    return CHANNEL_LIMITS.youtuber;
}

function mergeVideosById(existingVideos, incomingVideos) {
    const merged = new Map();
    if (Array.isArray(existingVideos)) {
        existingVideos.forEach((video) => {
            if (video?.id) merged.set(video.id, video);
        });
    }
    incomingVideos.forEach((video) => {
        if (video?.id) merged.set(video.id, video);
    });
    return Array.from(merged.values()).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

/**
 * Reaplica les correccions de falsos Shorts verificades per revisar_shorts.js.
 * Sense això, cada reconstrucció del feed tornaria a marcar isShort=true segons
 * la durada del vídeo i desfaria la revisió.
 */
function applyFalseShortsOverrides(videos) {
    if (!fs.existsSync(FALSE_SHORTS_JSON)) return 0;
    let falseShortIds;
    try {
        const registry = JSON.parse(fs.readFileSync(FALSE_SHORTS_JSON, 'utf8'));
        falseShortIds = new Set(Array.isArray(registry.falseShorts) ? registry.falseShorts : []);
    } catch (error) {
        console.warn(`⚠️ No s'ha pogut llegir ${FALSE_SHORTS_JSON}: ${error.message}`);
        return 0;
    }
    if (falseShortIds.size === 0) return 0;

    let applied = 0;
    videos.forEach((video) => {
        if (video?.isShort === true && falseShortIds.has(video.id)) {
            video.isShort = false;
            applied += 1;
        }
    });
    if (applied > 0) {
        console.log(`🔁 Reaplicades ${applied} correccions de falsos Shorts.`);
    }
    return applied;
}

function splitVideosForFeedAndArchive(videos, channelCategoriesById) {
    const videosByChannel = new Map();
    videos.forEach((video) => {
        const key = video.sourceChannelId || video.channelId || '';
        if (!key) {
            return;
        }
        if (!videosByChannel.has(key)) {
            videosByChannel.set(key, []);
        }
        videosByChannel.get(key).push(video);
    });

    const feedVideos = [];
    const archiveOverflowVideos = [];

    videosByChannel.forEach((entries, channelKey) => {
        const sorted = entries.slice().sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
        const categories = channelCategoriesById.get(channelKey) || [];
        const limit = getChannelTypeLimit(categories);
        feedVideos.push(...sorted.slice(0, limit));
        archiveOverflowVideos.push(...sorted.slice(limit));
    });

    feedVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    return { feedVideos, archiveOverflowVideos };
}

function getChannelArchivePath(channelId) {
    return path.join(OUTPUT_CHANNEL_ARCHIVE_DIR, `${channelId}.json`);
}

function countMarkerMatches(text, markers) {
    const markerSet = new Set(markers);
    return text
        .split(/[^\p{L}]+/u)
        .filter(Boolean)
        .reduce((count, word) => count + (markerSet.has(word) ? 1 : 0), 0);
}

const isCatalan = (video) => {
    const snippet = video?.snippet || video || {};

    // Obtenim els idiomes i els normalitzem a minúscules
    const audio = (snippet.defaultAudioLanguage || '').toLowerCase();
    const metaLang = (snippet.defaultLanguage || '').toLowerCase();

    // Marcadors lingüístics per heurística de text
    const markersCa = [' amb ', ' els ', ' les ', ' i ', ' per ', ' això ', ' mateix ', " l'", " d'", " n'", ' què ', ' més ', ' també ', ' però '];
    const markersEs = [' con ', ' los ', ' las ', ' y ', ' por ', ' eso ', ' mismo ', ' del ', ' que ', ' más ', ' también ', ' pero '];

    const countMarkers = (text, markers) => markers.reduce((count, m) => count + (text.includes(m) ? 1 : 0), 0);

    // Detecció de caràcters i paraules exclusius del català (no existeixen en castellà)
    // - ç/Ç (ce trencada)
    // - ny (dígraf català equivalent a la ñ castellana)
    // - accents oberts: à, è, ò
    // - l·l (ela geminada)
    // - apòstrofs: l', d', n', s', m', t' (contraccions catalanes)
    // - articles i preposicions: els, les, als, uns, unes (no existeixen en castellà)
    // Detecció de caràcters exclusius del castellà (no existeixen en català)
    // - á (accent tancat sobre a; en català seria à)
    // - ñ (en català s'usa ny)
    // - ¿ ¡ (signes d'interrogació/exclamació invertits)
    // - "paraula y paraula" (conjunció castellana; en català és 'i')
    const hasSpanishChars = (text) => {
        if (/á/i.test(text)) return true;
        if (/ñ/i.test(text)) return true;
        if (/[¿¡]/.test(text)) return true;
        if (/\b\w+\s+y\s+\w+\b/.test(text)) return true;
        return false;
    };

    const hasCatalanChars = (text) => {
        if (/ç/i.test(text)) return true;
        if (/ny/i.test(text)) return true;
        if (/[àèò]/i.test(text)) return true;
        if (/l·l/i.test(text)) return true;
        if (/[ldnstm]'/i.test(text)) return true;
        if (/\b(els|les|als|uns|unes)\b/i.test(text)) return true;
        if (/\b\w+\s+i\s+\w+\b/.test(text)) return true;
        return false;
    };

    // 1. Si l'àudio és explícitament Català, acceptem.
    if (audio.startsWith('ca')) {
        return true;
    }

    // 2. VETO AMB SEGONA OPORTUNITAT: Si l'àudio és explícitament NO català,
    // comprovem caràcters catalans i heurística de text abans de descartar.
    // YouTube sovint etiqueta vídeos catalans com a 'es' perquè no distingeix bé el català.
    if (audio.startsWith('es') || audio.startsWith('en') || audio.startsWith('fr')) {
        const text = `${snippet.title || ''} ${snippet.description || ''}`.toLowerCase();
        const catalan = hasCatalanChars(text);
        const spanish = hasSpanishChars(text);

        // Si té caràcters castellans i NO catalans, és castellà segur
        if (spanish && !catalan) return false;

        // Si té caràcters catalans (amb o sense castellans), és català
        if (catalan) return true;

        const scoreCa = countMarkers(text, markersCa);
        const scoreEs = countMarkers(text, markersEs);

        // Si el text té marcadors catalans suficients, és probablement català mal etiquetat
        if (scoreCa >= 3 && scoreCa > scoreEs) {
            return true;
        }

        return false;
    }

    // 3. Si l'àudio no ens diu res (és buit), llavors confiem en la llengua per defecte.
    if (metaLang.startsWith('ca')) {
        return true;
    }

    // 4. Si la llengua per defecte és no catalana, comprovem caràcters i heurística
    if (metaLang.startsWith('es') || metaLang.startsWith('en') || metaLang.startsWith('fr')) {
        const text = `${snippet.title || ''} ${snippet.description || ''}`.toLowerCase();
        const catalan = hasCatalanChars(text);
        const spanish = hasSpanishChars(text);

        if (spanish && !catalan) return false;
        if (catalan) return true;

        const scoreCa = countMarkers(text, markersCa);
        const scoreEs = countMarkers(text, markersEs);

        if (scoreCa >= 3 && scoreCa > scoreEs) {
            return true;
        }

        return false;
    }

    // 5. Heurística de text (Només si no tenim cap informació fiable a les etiquetes)
    const text = `${snippet.title || ''} ${snippet.description || ''}`.toLowerCase();
    const catalan = hasCatalanChars(text);
    const spanish = hasSpanishChars(text);

    // Si té caràcters castellans i NO catalans, descartem
    if (spanish && !catalan) return false;

    // Si té caràcters catalans, acceptem
    if (catalan) return true;

    const scoreCa = countMarkers(text, markersCa);
    const scoreEs = countMarkers(text, markersEs);

    // Si detectem més marcadors castellans que catalans, fora
    if (scoreEs > scoreCa && scoreEs > 1) {
        return false;
    }

    // Si guanya el català o hi ha empat tècnic, acceptem
    return true;
};

/**
 * Patrons de plataformes de suport econòmic per detectar a les descripcions.
 */
const SUPPORT_PATTERNS = [
    { type: 'patreon', label: 'Patreon', regex: /https?:\/\/(?:www\.)?patreon\.com\/[\w\-]+/gi, altRegex: /https?:\/\/[\w.\-]+\/patreon\b/gi },
    { type: 'aixeta', label: 'Aixeta', regex: /https?:\/\/[\w.\-]+\.aixeta\.cat[\w/\-?=&]*/gi },
    { type: 'kofi', label: 'Ko-fi', regex: /https?:\/\/(?:www\.)?ko-fi\.com\/[\w\-]+/gi },
    { type: 'buymeacoffee', label: 'Buy Me a Coffee', regex: /https?:\/\/(?:www\.)?buymeacoffee\.com\/[\w\-]+/gi },
    { type: 'paypal', label: 'PayPal', regex: /https?:\/\/(?:www\.)?paypal\.me\/[\w\-]+/gi, altRegex: /https?:\/\/(?:www\.)?paypal\.com\/donate[\w/\-?=&]*/gi },
    { type: 'stripe', label: 'Donatius', regex: /https?:\/\/[\w.\-]+\/donat(?:ius|iu|e|ions?)(?:[\w/\-?=&]*)?/gi },
    { type: 'tipeee', label: 'Tipeee', regex: /https?:\/\/(?:www\.)?(?:tipeeestream|tipeee)\.com\/[\w\-]+/gi },
    { type: 'bizum', label: 'Bizum', regex: /bizum[:\s]*(\+?34\s?)?(\d[\d\s]{7,})/gi },
    { type: 'transferencia', label: 'Transferència', regex: /\b(ES\d{2}\s?\d{4}\s?\d{4}\s?\d{2}\s?\d{10})\b/gi },
    { type: 'youtube_membership', label: 'Fes-te membre', regex: /https?:\/\/(?:www\.)?youtube\.com\/channel\/[\w\-]+\/join/gi, altRegex: /youtube\.com\/@[\w\-]+\/membership/gi },
];

function extractSupportFromText(text) {
    if (!text) return new Map();
    const results = new Map();
    for (const pattern of SUPPORT_PATTERNS) {
        const regexes = [pattern.regex];
        if (pattern.altRegex) regexes.push(pattern.altRegex);
        for (const regex of regexes) {
            regex.lastIndex = 0;
            let match;
            while ((match = regex.exec(text)) !== null) {
                if (!results.has(pattern.type)) results.set(pattern.type, new Set());
                let value = match[0].trim();
                if (pattern.type === 'bizum') {
                    const digits = text.substring(match.index, match.index + match[0].length + 20).replace(/bizum[:\s]*/i, '').match(/[\d\s]+/);
                    if (digits) { value = digits[0].replace(/\s/g, '').trim(); if (value.length < 9) continue; }
                }
                if (pattern.type === 'transferencia') value = value.replace(/\s/g, '');
                if (value.startsWith('http')) value = value.replace(/[.,;:!?)]+$/, '');
                results.get(pattern.type).add(value);
            }
        }
    }
    return results;
}

function extractSupportForChannels(feedVideos, archiveDir) {
    const channelData = new Map();

    const processVideo = (video, channelId) => {
        if (!channelId) return;
        if (!channelData.has(channelId)) channelData.set(channelId, { mentions: new Map(), videoCount: 0 });
        const entry = channelData.get(channelId);
        entry.videoCount++;
        const found = extractSupportFromText(video.description);
        for (const [type, values] of found) {
            if (!entry.mentions.has(type)) entry.mentions.set(type, new Map());
            const valueCounts = entry.mentions.get(type);
            for (const v of values) valueCounts.set(v, (valueCounts.get(v) || 0) + 1);
        }
    };

    feedVideos.forEach(video => processVideo(video, video.sourceChannelId || video.channelId));

    if (fs.existsSync(archiveDir)) {
        fs.readdirSync(archiveDir).filter(f => f.endsWith('.json')).forEach(file => {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(archiveDir, file), 'utf8'));
                const channelId = data.channelId || file.replace('.json', '');
                (Array.isArray(data.videos) ? data.videos : []).forEach(v => processVideo(v, channelId));
            } catch (_) {}
        });
    }

    const supportData = {};
    const priority = ['patreon', 'aixeta', 'kofi', 'buymeacoffee', 'youtube_membership', 'paypal', 'tipeee', 'stripe', 'bizum', 'transferencia'];

    for (const [channelId, data] of channelData) {
        const methods = [];
        for (const [type, valueCounts] of data.mentions) {
            let bestValue = null, bestCount = 0;
            for (const [value, count] of valueCounts) { if (count > bestCount) { bestValue = value; bestCount = count; } }
            if (bestValue && bestCount >= 2) {
                const pattern = SUPPORT_PATTERNS.find(p => p.type === type);
                const method = { type, label: pattern?.label || type };
                if (bestValue.startsWith('http')) method.url = bestValue; else method.value = bestValue;
                method.frequency = bestCount;
                methods.push(method);
            }
        }
        if (methods.length > 0) {
            methods.sort((a, b) => priority.indexOf(a.type) - priority.indexOf(b.type));
            supportData[channelId] = methods;
        }
    }
    return supportData;
}

async function main() {
    try {
        console.log("--- Iniciant actualització des de Google Sheets ---");

        const masterVideosById = new Map();
        if (fs.existsSync(OUTPUT_FEED_JSON)) {
            const existingFeedRaw = fs.readFileSync(OUTPUT_FEED_JSON, 'utf8');
            const existingFeed = JSON.parse(existingFeedRaw);
            if (Array.isArray(existingFeed.videos)) {
                existingFeed.videos.forEach(video => {
                    if (video?.id) {
                        masterVideosById.set(video.id, video);
                    }
                });
            }
        }
        
        const csvContent = await fetchData(SHEET_CSV_URL);
        const channels = parseCSV(csvContent);
        
        if (channels.length === 0) {
            console.log("Dades rebudes (primeres 100 lletres):", csvContent.substring(0, 100));
            throw new Error("No s'han trobat canals vàlids. Revisa el format de l'Excel.");
        }

        console.log(`✅ S'han trobat ${channels.length} canals vàlids.`);

        let allPlaylistItems = [];
        const channelChunks = chunkArray(channels, BATCH_SIZE);
        console.log(`🔄 Starting processing in ${channelChunks.length} batches...`);

        for (let i = 0; i < channelChunks.length; i++) {
            const chunk = channelChunks[i];
            console.log(`   🔸 Processing batch ${i + 1}/${channelChunks.length}...`);

            const batchPromises = chunk.map(async (channel) => {
                try {
                    let uploadPlaylistId = '';
                    let resolvedChannelId = '';
                    
                    // Optimization: Convert UC ID to UU ID directly to save quota
                    if (channel.id.startsWith('UC')) {
                        uploadPlaylistId = channel.id.replace('UC', 'UU');
                        resolvedChannelId = channel.id;
                    } 
                    // Only fetch for Handles (@)
                    else if (channel.id.startsWith('@')) {
                        const hUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=${encodeURIComponent(channel.id)}&key=${API_KEY}`;
                        const hData = await fetchYouTubeData(hUrl);
                        if (hData.items?.length > 0) {
                            uploadPlaylistId = hData.items[0].contentDetails.relatedPlaylists.uploads;
                            resolvedChannelId = hData.items[0].id;
                        }
                    }

                    if (!uploadPlaylistId) {
                        console.warn(`⚠️ No playlist found for: ${channel.name || channel.id}`);
                        return null;
                    }

                    const maxResults = Math.min(FETCH_PER_CHANNEL, 50);
                    const vUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadPlaylistId}&maxResults=${maxResults}&key=${API_KEY}`;
                    const vData = await fetchYouTubeData(vUrl);
                    const items = vData.items || [];

                    if (channel.checkLive && resolvedChannelId) {
                        try {
                            const lUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${resolvedChannelId}&eventType=live&type=video&key=${API_KEY}`;
                            const lData = await fetchYouTubeData(lUrl);
                            const liveItem = lData.items?.[0];
                            if (liveItem?.id?.videoId) {
                                items.unshift({
                                    kind: 'youtube#playlistItem',
                                    snippet: {
                                        title: liveItem.snippet?.title || '',
                                        description: liveItem.snippet?.description || '',
                                        thumbnails: liveItem.snippet?.thumbnails || {},
                                        channelId: liveItem.snippet?.channelId || '',
                                        channelTitle: liveItem.snippet?.channelTitle || '',
                                        publishedAt: liveItem.snippet?.publishedAt || '',
                                        resourceId: {
                                            videoId: liveItem.id.videoId
                                        }
                                    }
                                });
                            }
                        } catch (err) {
                            console.error(`⚠️ Error buscant directe per ${channel.name || channel.id}:`, err.message);
                        }
                    }
                    
                    return { items, channelInfo: channel };

                } catch (err) {
                    console.error(`❌ Error processing channel ${channel.name || channel.id}:`, err.message);
                    return null;
                }
            });

            const batchResults = await Promise.all(batchPromises);
            
            batchResults.forEach(res => {
                if (res) allPlaylistItems.push(res);
            });

            if (i < channelChunks.length - 1) {
                await wait(BATCH_DELAY);
            }
        }
        
        // Rename 'results' to 'allPlaylistItems' in the subsequent code loop
        const results = allPlaylistItems;
        let baseVideos = [];
        let videoIdsForDetails = [];

        results.forEach(res => {
            if (res?.items) {
                res.items.forEach(item => {
                    const video = {
                        id: item.snippet.resourceId.videoId,
                        title: item.snippet.title,
                        description: item.snippet.description || '',
                        thumbnail: item.snippet.thumbnails.maxres?.url
                            || item.snippet.thumbnails.standard?.url
                            || item.snippet.thumbnails.high?.url
                            || item.snippet.thumbnails.medium?.url
                            || item.snippet.thumbnails.default?.url,
                        channelId: item.snippet.channelId,
                        channelTitle: item.snippet.channelTitle,
                        publishedAt: item.snippet.publishedAt,
                        categories: res.channelInfo.categories,
                        sourceChannelId: res.channelInfo.id,
                        duration: '',
                        durationSeconds: 0,
                        isShort: false,
                        viewCount: 0,
                        likeCount: 0,
                        commentCount: 0
                    };
                    baseVideos.push(video);
                    videoIdsForDetails.push(video.id);
                });
            }
        });

        let detailedVideos = [];
        if (videoIdsForDetails.length > 0) {
            console.log("Carregant duracions...");
            for (let i = 0; i < videoIdsForDetails.length; i += 50) {
                const chunk = videoIdsForDetails.slice(i, i + 50);
                const dUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${chunk.join(',')}&key=${API_KEY}`;
                const dData = await fetchYouTubeData(dUrl);
                if (dData.items) {
                    dData.items.forEach(v => {
                        const duration = v.contentDetails?.duration || '';
                        const durationSeconds = isoDurationToSeconds(duration);
                        detailedVideos.push({
                            id: v.id,
                            title: v.snippet?.title || '',
                            thumbnail: v.snippet?.thumbnails?.maxres?.url
                                || v.snippet?.thumbnails?.standard?.url
                                || v.snippet?.thumbnails?.high?.url
                                || v.snippet?.thumbnails?.medium?.url
                                || v.snippet?.thumbnails?.default?.url
                                || '',
                            channelId: v.snippet?.channelId || '',
                        channelTitle: v.snippet?.channelTitle || '',
                        publishedAt: v.snippet?.publishedAt || '',
                        description: v.snippet?.description || '',
                        defaultAudioLanguage: v.snippet?.defaultAudioLanguage || '',
                        defaultLanguage: v.snippet?.defaultLanguage || '',
                        tags: v.snippet?.tags || [],
                        duration,
                        durationSeconds,
                        isShort: durationSeconds > 0 && durationSeconds <= 120,
                            viewCount: Number(v.statistics?.viewCount || 0),
                            likeCount: Number(v.statistics?.likeCount || 0),
                            commentCount: Number(v.statistics?.commentCount || 0)
                        });
                    });
                }
            }
        }

        const detailsById = new Map(detailedVideos.map(video => [video.id, video]));
        
        // Utilitzem reduce en comptes de map per poder descartar els vídeos no vàlids
        const finalVideos = baseVideos.reduce((acc, video) => {
            const details = detailsById.get(video.id);
            
            // 1. Si NO tenim detalls, el vídeo és privat, ocult o eliminat. El descartem.
            if (!details) {
                console.log(`🚫 Vídeo ignorat (Privat/Eliminat): ${video.id}`);
                return acc;
            }
            
            const durationSeconds = Number(details.durationSeconds || 0);
            
            // 2. Si la durada és 0 (00:00), és una estrena no començada o vídeo trencat. El descartem.
            if (durationSeconds === 0) {
                console.log(`🚫 Vídeo ignorat (Durada 00:00): ${video.id} - ${details.title}`);
                return acc;
            }
            
            // Si és vàlid, l'afegim a la llista final
            acc.push({
                ...video,
                ...details,
                categories: video.categories,
                sourceChannelId: video.sourceChannelId,
                isShort: durationSeconds > 0 && durationSeconds <= 120
            });
            
            return acc;
        }, []);

        const videosByChannel = new Map();
        finalVideos.forEach((video) => {
            const key = video.sourceChannelId || video.channelId;
            if (!videosByChannel.has(key)) {
                videosByChannel.set(key, []);
            }
            videosByChannel.get(key).push(video);
        });

        channels.forEach((channel) => {
            const channelVideos = videosByChannel.get(channel.id) || [];
            console.log(`📺 Canal ${channel.name || channel.id}: ${channelVideos.length} vídeos nous.`);

            const filteredVideos = channel.languageFilter === 'auto'
                ? channelVideos.filter(video => {
                    const keep = isCatalan(video);
                    if (!keep) {
                        const languageCode = (video.defaultAudioLanguage || video.defaultLanguage || 'unknown').toLowerCase();
                        console.log(`🚫 Filtered out [lang=${languageCode}]: ${video.title || video.id}`);
                    }
                    return keep;
                })
                : channelVideos;
            const newestVideos = filteredVideos
                .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
                .slice(0, FETCH_PER_CHANNEL);

            if (channel.languageFilter === 'auto') {
                const idsToRemove = [];
                masterVideosById.forEach((video, id) => {
                    const sourceId = video.sourceChannelId || video.channelId;
                    if (sourceId === channel.id && !isCatalan(video)) {
                        idsToRemove.push(id);
                    }
                });
                if (idsToRemove.length > 0) {
                    idsToRemove.forEach(id => masterVideosById.delete(id));
                    console.log(`🧹 Canal ${channel.name || channel.id}: eliminats ${idsToRemove.length} vídeos antics no catalans per filtre auto.`);
                }
            }

            if (!channel.shouldAccumulate) {
                const idsToRemove = [];
                masterVideosById.forEach((video, id) => {
                    const sourceId = video.sourceChannelId || video.channelId;
                    if (sourceId === channel.id) {
                        idsToRemove.push(id);
                    }
                });
                idsToRemove.forEach(id => masterVideosById.delete(id));
            }

            newestVideos.forEach(video => {
                masterVideosById.set(video.id, video);
            });

            const channelEntries = [];
            masterVideosById.forEach(video => {
                const sourceId = video.sourceChannelId || video.channelId;
                if (sourceId === channel.id) {
                    channelEntries.push(video);
                }
            });
            channelEntries.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
            channelEntries.slice(SAFETY_LIMIT_PER_CHANNEL).forEach(video => {
                masterVideosById.delete(video.id);
            });

            console.log(`✅ Canal ${channel.name || channel.id}: ${Math.min(channelEntries.length, SAFETY_LIMIT_PER_CHANNEL)} vídeos totals.`);
        });

        const mergedFeedPayload = Array.from(masterVideosById.values())
            .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
        applyFalseShortsOverrides(mergedFeedPayload);
        const shortsIndexingByChannel = new Map(
            channels.map(channel => [channel.id, channel.indexShorts !== false])
        );
        const filteredMergedPayload = mergedFeedPayload.filter((video) => {
            if (!video?.isShort) {
                return true;
            }
            const sourceKey = video.sourceChannelId || video.channelId;
            if (!sourceKey) {
                return true;
            }
            return shortsIndexingByChannel.get(sourceKey) !== false;
        });
        const categoriesByChannelKey = new Map();
        channels.forEach(channel => {
            categoriesByChannelKey.set(channel.id, channel.categories || []);
        });
        filteredMergedPayload.forEach(video => {
            const channelKey = video.channelId || video.sourceChannelId;
            if (!channelKey || categoriesByChannelKey.has(channelKey)) return;
            categoriesByChannelKey.set(channelKey, video.categories || []);
        });

        const { feedVideos: feedPayload, archiveOverflowVideos } = splitVideosForFeedAndArchive(
            filteredMergedPayload,
            categoriesByChannelKey
        );
        const thirtyOneDaysAgo = new Date();
        thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
        const recentFeedPayload = feedPayload
            .filter((video) => new Date(video.publishedAt) >= thirtyOneDaysAgo)
            .slice(0, RECENT_FEED_LIMIT);
        const videosWithViews = feedPayload.filter(video => (video.viewCount || 0) > 0);
        console.log(`📊 Vídeos amb viewCount > 0: ${videosWithViews.length}/${feedPayload.length}`);
        videosWithViews.slice(0, 3).forEach(video => {
            console.log(`📈 ${video.id}: ${video.viewCount}`);
        });
        const channelIds = Array.from(new Set(feedPayload.map(video => video.channelId).filter(Boolean)));
        const channelMetadata = {};
        if (channelIds.length > 0) {
            console.log(`🔎 Carregant metadades per ${channelIds.length} canals...`);
            const channelChunks = chunkArray(channelIds, 50);
            for (const chunk of channelChunks) {
                const cUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${chunk.join(',')}&key=${API_KEY}`;
                const cData = await fetchYouTubeData(cUrl);
                if (Array.isArray(cData.items)) {
                    cData.items.forEach(item => {
                        const thumbnail = item.snippet?.thumbnails?.high?.url
                            || item.snippet?.thumbnails?.medium?.url
                            || '';
                        const customUrl = item.snippet?.customUrl || '';
                        const handle = customUrl
                            ? (customUrl.startsWith('@') ? customUrl : `@${customUrl}`)
                            : '';
                        const subscriberCount = Number(item.statistics?.subscriberCount || 0);
                        channelMetadata[item.id] = {
                            name: item.snippet?.title || '',
                            avatar: thumbnail,
                            description: truncateText(item.snippet?.description || ''),
                            handle,
                            subscriberCount
                        };
                    });
                }
            }
        }

        // Afegir canals configurats però sense vídeos (perquè apareguin a la Biblioteca)
        const allConfiguredIds = channels.map(ch => ch.id).filter(Boolean);
        const missingChannelIds = allConfiguredIds.filter(id => !channelMetadata[id]);
        if (missingChannelIds.length > 0) {
            console.log(`🔎 Carregant metadades per ${missingChannelIds.length} canals sense vídeos...`);
            const missingChunks = chunkArray(missingChannelIds, 50);
            for (const chunk of missingChunks) {
                const cUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${chunk.join(',')}&key=${API_KEY}`;
                const cData = await fetchYouTubeData(cUrl);
                if (Array.isArray(cData.items)) {
                    cData.items.forEach(item => {
                        const thumbnail = item.snippet?.thumbnails?.high?.url
                            || item.snippet?.thumbnails?.medium?.url
                            || '';
                        const customUrl = item.snippet?.customUrl || '';
                        const handle = customUrl
                            ? (customUrl.startsWith('@') ? customUrl : `@${customUrl}`)
                            : '';
                        channelMetadata[item.id] = {
                            name: item.snippet?.title || '',
                            avatar: thumbnail,
                            description: truncateText(item.snippet?.description || ''),
                            handle,
                            subscriberCount: Number(item.statistics?.subscriberCount || 0)
                        };
                    });
                }
            }
        }

        const categoriesBySourceId = new Map(
            channels.map(channel => [channel.id, channel.categories || []])
        );
        const categoriesByChannelId = new Map();
        feedPayload.forEach(video => {
            if (!video.channelId) return;
            const sourceCategories = categoriesBySourceId.get(video.sourceChannelId) || [];
            if (!categoriesByChannelId.has(video.channelId)) {
                categoriesByChannelId.set(video.channelId, new Set());
            }
            const bucket = categoriesByChannelId.get(video.channelId);
            sourceCategories.forEach(category => bucket.add(category));
        });

        Object.keys(channelMetadata).forEach(channelId => {
            const categories = Array.from(categoriesByChannelId.get(channelId) || []);
            if (categories.length > 0) {
                channelMetadata[channelId].categories = categories;
            }

            const isConfiguredInSheet = shortsIndexingByChannel.has(channelId);
            if (isConfiguredInSheet) {
                channelMetadata[channelId].indexShorts = shortsIndexingByChannel.get(channelId);
            }
        });

        // Canals sense vídeos: assignar categories directament del full de càlcul
        missingChannelIds.forEach(channelId => {
            if (!channelMetadata[channelId]) return;
            const cats = categoriesBySourceId.get(channelId) || [];
            if (cats.length > 0) {
                channelMetadata[channelId].categories = cats;
            }
        });

        Object.keys(channelMetadata).forEach(channelId => {
            const tagCounts = new Map();
            feedPayload.forEach(video => {
                if (video.channelId !== channelId) {
                    return;
                }
                const tags = Array.isArray(video.tags) ? video.tags : [];
                tags.forEach(tag => {
                    const normalizedTag = String(tag).trim();
                    if (!normalizedTag) {
                        return;
                    }
                    tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);
                });
            });
            const topTags = Array.from(tagCounts.entries())
                .sort((a, b) => {
                    if (b[1] !== a[1]) {
                        return b[1] - a[1];
                    }
                    return a[0].localeCompare(b[0]);
                })
                .slice(0, 10)
                .map(([tag]) => tag);
            channelMetadata[channelId].topTags = topTags;
        });

        // Extreure mètodes de suport econòmic de les descripcions
        console.log('💰 Extraient mètodes de suport econòmic...');
        const supportData = extractSupportForChannels(feedPayload, OUTPUT_CHANNEL_ARCHIVE_DIR);
        const supportChannelCount = Object.keys(supportData).length;
        console.log(`✅ ${supportChannelCount} canals amb mètodes de suport detectats.`);

        const dataDir = path.join(process.cwd(), 'data');
        fs.mkdirSync(dataDir, { recursive: true });

        // Escriure support.json
        fs.writeFileSync(OUTPUT_SUPPORT_JSON, JSON.stringify({
            generatedAt: new Date().toISOString(),
            channelCount: supportChannelCount,
            channels: supportData,
        }, null, 2));
        console.log(`📝 Support data escrit a: ${OUTPUT_SUPPORT_JSON}`);

        const feedOutput = {
            generatedAt: new Date().toISOString(),
            channels: channelMetadata,
            videos: feedPayload
        };
        const recentFeedOutput = {
            generatedAt: feedOutput.generatedAt,
            channels: channelMetadata,
            videos: recentFeedPayload
        };
        fs.writeFileSync(OUTPUT_FEED_JSON, JSON.stringify(feedOutput, null, 2));
        fs.writeFileSync(OUTPUT_RECENT_FEED_JSON, JSON.stringify(recentFeedOutput, null, 2));
        fs.writeFileSync(
            OUTPUT_FEED_JS,
            `// Auto-generated by scripts/update_feed.js\nwindow.FEED_UPDATES = ${JSON.stringify(recentFeedPayload, null, 2)};\n`
        );

        const archiveOverflowByChannel = new Map();
        archiveOverflowVideos.forEach((video) => {
            const channelKey = video.channelId || video.sourceChannelId;
            if (!channelKey) return;
            if (!archiveOverflowByChannel.has(channelKey)) {
                archiveOverflowByChannel.set(channelKey, []);
            }
            archiveOverflowByChannel.get(channelKey).push(video);
        });

        const channelsToWrite = [];
        const channelsWithArchiveUpdate = new Set();
        for (const [channelId, overflowVideos] of archiveOverflowByChannel.entries()) {
            const archivePath = getChannelArchivePath(channelId);
            let existingVideos = [];
            if (fs.existsSync(archivePath)) {
                try {
                    const archiveRaw = fs.readFileSync(archivePath, 'utf8');
                    const parsed = JSON.parse(archiveRaw);
                    existingVideos = Array.isArray(parsed.videos) ? parsed.videos : [];
                } catch (err) {
                    console.warn(`⚠️ Arxiu de canal invàlid (${archivePath}), es recrea.`, err.message);
                }
            }

            const mergedVideos = mergeVideosById(existingVideos, overflowVideos);
            const shouldIndexShorts = shortsIndexingByChannel.get(channelId) !== false;
            const normalizedMergedVideos = shouldIndexShorts
                ? mergedVideos
                : mergedVideos.filter(video => !video?.isShort);
            const channelConfig = channels.find(ch => ch.id === channelId);
            const languageFilteredVideos = channelConfig?.languageFilter === 'auto'
                ? normalizedMergedVideos.filter(video => isCatalan(video))
                : normalizedMergedVideos;
            channelsWithArchiveUpdate.add(channelId);
            if (languageFilteredVideos.length > 0) {
                channelsToWrite.push({ channelId, videos: languageFilteredVideos });
            } else if (fs.existsSync(archivePath)) {
                fs.unlinkSync(archivePath);
            }
        }

        channels
            .filter(channel => channel.languageFilter === 'auto' && !channelsWithArchiveUpdate.has(channel.id))
            .forEach((channel) => {
                const archivePath = getChannelArchivePath(channel.id);
                if (!fs.existsSync(archivePath)) {
                    return;
                }
                try {
                    const archiveRaw = fs.readFileSync(archivePath, 'utf8');
                    const parsed = JSON.parse(archiveRaw);
                    const existingVideos = Array.isArray(parsed.videos) ? parsed.videos : [];
                    const filteredArchiveVideos = existingVideos.filter(video => isCatalan(video));
                    if (filteredArchiveVideos.length === 0) {
                        fs.unlinkSync(archivePath);
                        console.log(`🧹 Arxiu netejat (${channel.name || channel.id}): eliminat per no tenir vídeos vàlids amb filtre auto.`);
                        return;
                    }
                    if (filteredArchiveVideos.length !== existingVideos.length) {
                        writeJsonIfChanged(archivePath, {
                            channelId: channel.id,
                            generatedAt: feedOutput.generatedAt,
                            videos: filteredArchiveVideos
                        });
                        console.log(`🧹 Arxiu netejat (${channel.name || channel.id}): ${existingVideos.length - filteredArchiveVideos.length} vídeos eliminats per filtre auto.`);
                    }
                } catch (err) {
                    console.warn(`⚠️ No s'ha pogut aplicar filtre idioma a l'arxiu ${archivePath}:`, err.message);
                }
            });

        if (channelsToWrite.length > 0) {
            fs.mkdirSync(OUTPUT_CHANNEL_ARCHIVE_DIR, { recursive: true });
            channelsToWrite.forEach(({ channelId, videos }) => {
                const archivePath = getChannelArchivePath(channelId);
                writeJsonIfChanged(archivePath, {
                    channelId,
                    generatedAt: feedOutput.generatedAt,
                    videos
                });
            });
        }

        console.log("Feed escrit a:", OUTPUT_FEED_JSON);
        console.log("Recent feed escrit a:", OUTPUT_RECENT_FEED_JSON);
        console.log("Existeix:", fs.existsSync(OUTPUT_FEED_JSON));
        console.log("Mida:", fs.statSync(OUTPUT_FEED_JSON).size);
        console.log(`📦 Recent feed limitat a ${recentFeedPayload.length}/${feedPayload.length} vídeos.`);
        console.log(`🧱 Feed principal limitat per tipus de canal (youtuber=${CHANNEL_LIMITS.youtuber}, entitat=${CHANNEL_LIMITS.entitat}, digital/mitjà=${CHANNEL_LIMITS.digitalMitja}) amb ${feedPayload.length} vídeos totals.`);
        console.log(`🗂️ Arxius per canal actualitzats sota ${OUTPUT_CHANNEL_ARCHIVE_DIR} (creació lazy només amb overflow).`);
        console.log(`🚀 Feed actualitzat correctament amb ${feedPayload.length} vídeos.`);

    } catch (error) {
        console.error("❌ Error en el procés:", error.message);
        process.exit(1);
    }
}

main();
