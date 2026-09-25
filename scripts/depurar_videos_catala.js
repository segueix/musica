const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const FEED_PATH = path.join(DATA_DIR, 'feed.json');
const RECENT_FEED_PATH = path.join(DATA_DIR, 'recent-feed.json');
const ARCHIVE_CHANNELS_DIR = path.join(DATA_DIR, 'archive', 'channels');

const MARKERS_CA = [' amb ', ' els ', ' les ', ' i ', ' per ', ' això ', ' mateix ', " l'", " d'", " n'", ' què ', ' més ', ' també ', ' però '];
const MARKERS_ES = [' con ', ' los ', ' las ', ' y ', ' por ', ' eso ', ' mismo ', ' del ', ' que ', ' más ', ' también ', ' pero '];

function snippetOf(video) {
    return video?.snippet || video || {};
}

function videoTags(video) {
    const snippet = snippetOf(video);
    const tags = Array.isArray(snippet.tags)
        ? snippet.tags
        : (Array.isArray(video?.tags) ? video.tags : []);
    return tags.map(tag => String(tag || '').trim().toLowerCase()).filter(Boolean);
}

function hasExplicitCatTag(video) {
    return videoTags(video).includes('cat');
}

function countMarkers(text, markers) {
    return markers.reduce((count, marker) => count + (text.includes(marker) ? 1 : 0), 0);
}

function hasSpanishChars(text) {
    if (/á/i.test(text)) return true;
    if (/ñ/i.test(text)) return true;
    if (/[¿¡]/.test(text)) return true;
    if (/\b\w+\s+y\s+\w+\b/u.test(text)) return true;
    return false;
}

function hasCatalanChars(text) {
    if (/ç/i.test(text)) return true;
    if (/ny/i.test(text)) return true;
    if (/[àèò]/i.test(text)) return true;
    if (/l·l/i.test(text)) return true;
    if (/[ldnstm]'/i.test(text)) return true;
    if (/\b(els|les|als|uns|unes)\b/iu.test(text)) return true;
    if (/\b\w+\s+i\s+\w+\b/u.test(text)) return true;
    return false;
}

function hasCatalanQuestionOverride(title) {
    const normalizedTitle = String(title || '');
    return /[àèò]/i.test(normalizedTitle) || /['’]/u.test(normalizedTitle);
}

function classifyVideo(video) {
    const snippet = snippetOf(video);
    const title = String(snippet.title || video?.title || '');
    const description = String(snippet.description || video?.description || '');
    const audio = String(snippet.defaultAudioLanguage || video?.defaultAudioLanguage || '').toLowerCase();
    const metaLang = String(snippet.defaultLanguage || video?.defaultLanguage || '').toLowerCase();

    // Excepció explícita: l'etiqueta exacta "cat" sempre guanya.
    if (hasExplicitCatTag(video)) {
        return { keep: true, language: 'ca', reason: 'tag-cat' };
    }

    // Regla del signe ¿: si el títol també conté un accent obert català
    // (à, è, ò) o un apòstrof (recte o tipogràfic), el considerem català.
    // En qualsevol altre cas, l'interrogant invertit es considera castellà.
    if (title.includes('¿')) {
        if (hasCatalanQuestionOverride(title)) {
            return { keep: true, language: 'ca', reason: 'titol-cat-malgrat-interrogant-invertit' };
        }
        return { keep: false, language: 'es', reason: 'titol-interrogant-invertit' };
    }
    if (title.includes('¡')) {
        return { keep: false, language: 'es', reason: 'titol-exclamacio-invertida' };
    }

    const text = ` ${title} ${description} `.toLowerCase();
    const catalanChars = hasCatalanChars(text);
    const spanishChars = hasSpanishChars(text);
    const scoreCa = countMarkers(text, MARKERS_CA);
    const scoreEs = countMarkers(text, MARKERS_ES);

    // El text català té prioritat sobre metadades de YouTube, que sovint etiqueten
    // vídeos catalans com a "es". Això evita falsos positius destructius.
    if (catalanChars || (scoreCa >= 2 && scoreCa > scoreEs)) {
        return { keep: true, language: 'ca', reason: 'text-cat' };
    }

    // Evidència castellana explícita al text.
    if (spanishChars && !catalanChars) {
        return { keep: false, language: 'es', reason: 'text-castella' };
    }
    if (scoreEs >= 2 && scoreEs > scoreCa) {
        return { keep: false, language: 'es', reason: 'marcadors-es' };
    }

    // Metadades catalanes sí que serveixen com a confirmació positiva.
    if (audio.startsWith('ca')) {
        return { keep: true, language: 'ca', reason: 'audio-ca' };
    }
    if (metaLang.startsWith('ca')) {
        return { keep: true, language: 'ca', reason: 'meta-ca' };
    }

    // Una etiqueta "es" sola NO elimina res: YouTube confon massa sovint català i castellà.
    // Es conserva el vídeo si el text no dona prou evidència castellana.
    if (audio.startsWith('es') || metaLang.startsWith('es')) {
        return { keep: true, language: 'unknown', reason: 'meta-es-sense-evidencia' };
    }

    // Altres idiomes/ambigus també es conserven: aquest depurador elimina castellà
    // detectat amb confiança, no fa una purga cega per metadades.
    return { keep: true, language: 'unknown', reason: 'ambigu-conservat' };
}

function filterVideos(videos, sourceLabel, removed) {
    const kept = [];
    for (const video of Array.isArray(videos) ? videos : []) {
        const classification = classifyVideo(video);
        if (classification.keep) {
            kept.push(video);
            continue;
        }
        removed.push({
            id: String(video?.id || ''),
            title: String(video?.title || video?.snippet?.title || ''),
            channelId: String(video?.sourceChannelId || video?.channelId || video?.snippet?.channelId || ''),
            source: sourceLabel,
            language: classification.language,
            reason: classification.reason,
        });
    }
    return kept;
}

function processPayloadFile(filePath, label, dryRun, removed) {
    if (!fs.existsSync(filePath)) return { changed: false, removed: 0 };
    const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(payload?.videos)) return { changed: false, removed: 0 };

    const before = payload.videos.length;
    const kept = filterVideos(payload.videos, label, removed);
    const removedCount = before - kept.length;
    if (removedCount === 0) return { changed: false, removed: 0 };

    if (!dryRun) {
        payload.videos = kept;
        fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
    }
    return { changed: true, removed: removedCount };
}

function run({ dryRun = false } = {}) {
    const removed = [];
    let changedFiles = 0;
    let removedTotal = 0;

    for (const [filePath, label] of [
        [FEED_PATH, 'feed'],
        [RECENT_FEED_PATH, 'recent-feed'],
    ]) {
        const result = processPayloadFile(filePath, label, dryRun, removed);
        if (result.changed) changedFiles += 1;
        removedTotal += result.removed;
    }

    if (fs.existsSync(ARCHIVE_CHANNELS_DIR)) {
        const files = fs.readdirSync(ARCHIVE_CHANNELS_DIR)
            .filter(name => name.endsWith('.json'))
            .sort();
        for (const file of files) {
            const fullPath = path.join(ARCHIVE_CHANNELS_DIR, file);
            const result = processPayloadFile(fullPath, `archive/${file}`, dryRun, removed);
            if (result.changed) changedFiles += 1;
            removedTotal += result.removed;
        }
    }

    const uniqueRemoved = new Map();
    removed.forEach(item => {
        const key = item.id || `${item.source}:${item.title}`;
        if (!uniqueRemoved.has(key)) uniqueRemoved.set(key, item);
    });

    const unique = [...uniqueRemoved.values()];
    console.log(`${dryRun ? '🔎 Simulació' : '🧹 Depuració'} lingüística completada.`);
    console.log(`Fitxers afectats: ${changedFiles}`);
    console.log(`Entrades eliminades: ${removedTotal}`);
    console.log(`Vídeos únics eliminats: ${unique.length}`);

    unique.slice(0, 100).forEach(item => {
        console.log(`- [${item.reason}] ${item.id || 'sense-id'} · ${item.title}`);
    });
    if (unique.length > 100) {
        console.log(`… i ${unique.length - 100} vídeos més.`);
    }

    return { changedFiles, removedTotal, uniqueRemoved: unique };
}

if (require.main === module) {
    const dryRun = process.argv.includes('--dry-run');
    try {
        run({ dryRun });
    } catch (error) {
        console.error('❌ Error depurant vídeos per idioma:', error);
        process.exitCode = 1;
    }
}

module.exports = {
    classifyVideo,
    hasExplicitCatTag,
    hasCatalanQuestionOverride,
    run,
};
