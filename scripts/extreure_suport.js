/**
 * Script per extreure automàticament els mètodes de suport econòmic
 * dels youtubers a partir de les descripcions dels seus vídeos.
 *
 * Llegeix els arxius de canal (data/archive/channels/*.json) i el feed principal
 * (data/feed.json), busca patrons coneguts (Patreon, Aixeta, PayPal, Bizum, etc.)
 * i genera data/support.json amb els mètodes detectats per cada canal.
 *
 * Ús: node scripts/extreure_suport.js
 */

const fs = require('fs');
const path = require('path');

const FEED_JSON = path.join(process.cwd(), 'data', 'feed.json');
const ARCHIVE_DIR = path.join(process.cwd(), 'data', 'archive', 'channels');
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'support.json');

/**
 * Patrons de plataformes de suport econòmic.
 * Cada patró té un regex per detectar l'URL i un tipus identificador.
 */
const SUPPORT_PATTERNS = [
    {
        type: 'patreon',
        label: 'Patreon',
        // Captura patreon.com/xxx o dominis que redirigeixen a Patreon
        regex: /https?:\/\/(?:www\.)?patreon\.com\/[\w\-]+/gi,
        // També captures com arnauborras.com/patreon
        altRegex: /https?:\/\/[\w.\-]+\/patreon\b/gi,
    },
    {
        type: 'aixeta',
        label: 'Aixeta',
        regex: /https?:\/\/[\w.\-]+\.aixeta\.cat[\w/\-?=&]*/gi,
    },
    {
        type: 'kofi',
        label: 'Ko-fi',
        regex: /https?:\/\/(?:www\.)?ko-fi\.com\/[\w\-]+/gi,
    },
    {
        type: 'buymeacoffee',
        label: 'Buy Me a Coffee',
        regex: /https?:\/\/(?:www\.)?buymeacoffee\.com\/[\w\-]+/gi,
    },
    {
        type: 'paypal',
        label: 'PayPal',
        regex: /https?:\/\/(?:www\.)?paypal\.me\/[\w\-]+/gi,
        altRegex: /https?:\/\/(?:www\.)?paypal\.com\/donate[\w/\-?=&]*/gi,
    },
    {
        type: 'stripe',
        label: 'Donatius',
        // URLs personalitzades que contenen "donatius", "donatiu" o "donate"
        regex: /https?:\/\/[\w.\-]+\/donat(?:ius|iu|e|ions?)(?:[\w/\-?=&]*)?/gi,
    },
    {
        type: 'tipeee',
        label: 'Tipeee',
        regex: /https?:\/\/(?:www\.)?(?:tipeeestream|tipeee)\.com\/[\w\-]+/gi,
    },
    {
        type: 'bizum',
        label: 'Bizum',
        // Cerca "Bizum" seguit d'un número de telèfon (amb o sense separadors)
        regex: /bizum[:\s]*(\+?34\s?)?(\d[\d\s]{7,})/gi,
    },
    {
        type: 'transferencia',
        label: 'Transferència',
        // IBAN espanyol (ES + 22 dígits amb possibles espais)
        regex: /\b(ES\d{2}\s?\d{4}\s?\d{4}\s?\d{2}\s?\d{10})\b/gi,
    },
    {
        type: 'youtube_membership',
        label: 'Fes-te membre',
        regex: /https?:\/\/(?:www\.)?youtube\.com\/channel\/[\w\-]+\/join/gi,
        altRegex: /youtube\.com\/@[\w\-]+\/membership/gi,
    },
];

/**
 * Extreu URLs/valors de suport d'un text.
 * Retorna un Map<type, Set<value>> amb els resultats trobats.
 */
function extractSupportFromText(text) {
    if (!text) return new Map();
    const results = new Map();

    for (const pattern of SUPPORT_PATTERNS) {
        const regexes = [pattern.regex];
        if (pattern.altRegex) regexes.push(pattern.altRegex);

        for (const regex of regexes) {
            // Reiniciar el regex
            regex.lastIndex = 0;
            let match;
            while ((match = regex.exec(text)) !== null) {
                if (!results.has(pattern.type)) {
                    results.set(pattern.type, new Set());
                }

                let value = match[0].trim();

                // Per Bizum, extreure només el número net
                if (pattern.type === 'bizum') {
                    const digits = text.substring(match.index, match.index + match[0].length + 20)
                        .replace(/bizum[:\s]*/i, '')
                        .match(/[\d\s]+/);
                    if (digits) {
                        value = digits[0].replace(/\s/g, '').trim();
                        if (value.length < 9) continue;
                    }
                }

                // Per transferència, netejar espais
                if (pattern.type === 'transferencia') {
                    value = value.replace(/\s/g, '');
                }

                // Netejar URLs finals (treure puntuació final)
                if (value.startsWith('http')) {
                    value = value.replace(/[.,;:!?)]+$/, '');
                }

                results.get(pattern.type).add(value);
            }
        }
    }

    return results;
}

/**
 * Combina dos Map<type, Set<value>> en un sol.
 */
function mergeSupportMaps(target, source) {
    for (const [type, values] of source) {
        if (!target.has(type)) {
            target.set(type, new Set());
        }
        for (const v of values) {
            target.get(type).add(v);
        }
    }
    return target;
}

function main() {
    console.log('--- Extracció de mètodes de suport econòmic ---');

    const channelSupport = new Map(); // channelId -> { mentions: Map<type, Map<value, count>>, videoCount }
    let totalVideosAnalyzed = 0;

    // 1. Llegir feed principal
    if (fs.existsSync(FEED_JSON)) {
        const feed = JSON.parse(fs.readFileSync(FEED_JSON, 'utf8'));
        const videos = Array.isArray(feed.videos) ? feed.videos : [];
        console.log(`📄 Feed principal: ${videos.length} vídeos`);

        for (const video of videos) {
            const channelId = video.sourceChannelId || video.channelId;
            if (!channelId) continue;

            if (!channelSupport.has(channelId)) {
                channelSupport.set(channelId, { mentions: new Map(), videoCount: 0 });
            }
            const entry = channelSupport.get(channelId);
            entry.videoCount++;

            const found = extractSupportFromText(video.description);
            for (const [type, values] of found) {
                if (!entry.mentions.has(type)) {
                    entry.mentions.set(type, new Map());
                }
                const valueCounts = entry.mentions.get(type);
                for (const v of values) {
                    valueCounts.set(v, (valueCounts.get(v) || 0) + 1);
                }
            }
        }
        totalVideosAnalyzed += videos.length;
    }

    // 2. Llegir arxius de canal
    if (fs.existsSync(ARCHIVE_DIR)) {
        const archiveFiles = fs.readdirSync(ARCHIVE_DIR).filter(f => f.endsWith('.json'));
        console.log(`📦 Arxius de canal: ${archiveFiles.length} fitxers`);

        for (const file of archiveFiles) {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(ARCHIVE_DIR, file), 'utf8'));
                const channelId = data.channelId || file.replace('.json', '');
                const videos = Array.isArray(data.videos) ? data.videos : [];

                if (!channelSupport.has(channelId)) {
                    channelSupport.set(channelId, { mentions: new Map(), videoCount: 0 });
                }
                const entry = channelSupport.get(channelId);

                for (const video of videos) {
                    entry.videoCount++;
                    totalVideosAnalyzed++;

                    const found = extractSupportFromText(video.description);
                    for (const [type, values] of found) {
                        if (!entry.mentions.has(type)) {
                            entry.mentions.set(type, new Map());
                        }
                        const valueCounts = entry.mentions.get(type);
                        for (const v of values) {
                            valueCounts.set(v, (valueCounts.get(v) || 0) + 1);
                        }
                    }
                }
            } catch (err) {
                console.warn(`⚠️ Error llegint ${file}: ${err.message}`);
            }
        }
    }

    console.log(`\n📊 Total vídeos analitzats: ${totalVideosAnalyzed}`);
    console.log(`📺 Canals analitzats: ${channelSupport.size}`);

    // 3. Generar resultats finals
    // Només incloure mètodes que apareixen en almenys 2 vídeos o en >20% dels vídeos
    const supportData = {};
    let channelsWithSupport = 0;

    for (const [channelId, data] of channelSupport) {
        const methods = [];
        const threshold = Math.max(2, Math.floor(data.videoCount * 0.1));

        for (const [type, valueCounts] of data.mentions) {
            // Agafar el valor més freqüent per cada tipus
            let bestValue = null;
            let bestCount = 0;

            for (const [value, count] of valueCounts) {
                if (count > bestCount) {
                    bestValue = value;
                    bestCount = count;
                }
            }

            if (bestValue && bestCount >= Math.min(threshold, 2)) {
                const pattern = SUPPORT_PATTERNS.find(p => p.type === type);
                const method = {
                    type,
                    label: pattern?.label || type,
                };

                if (bestValue.startsWith('http')) {
                    method.url = bestValue;
                } else {
                    method.value = bestValue;
                }

                method.frequency = bestCount;
                methods.push(method);
            }
        }

        if (methods.length > 0) {
            // Ordenar: plataformes de subscripció primer, després donatius puntuals
            const priority = ['patreon', 'aixeta', 'kofi', 'buymeacoffee', 'youtube_membership', 'paypal', 'tipeee', 'stripe', 'bizum', 'transferencia'];
            methods.sort((a, b) => priority.indexOf(a.type) - priority.indexOf(b.type));

            supportData[channelId] = methods;
            channelsWithSupport++;
        }
    }

    // 4. Escriure resultat
    const output = {
        generatedAt: new Date().toISOString(),
        channelCount: channelsWithSupport,
        channels: supportData,
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`\n✅ ${channelsWithSupport} canals amb mètodes de suport detectats.`);
    console.log(`📝 Escrit a: ${OUTPUT_FILE}`);

    // 5. Mostrar resum
    for (const [channelId, methods] of Object.entries(supportData)) {
        const types = methods.map(m => m.label).join(', ');
        console.log(`   ${channelId}: ${types}`);
    }
}

main();
