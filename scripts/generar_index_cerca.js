const fs = require('fs/promises');
const path = require('path');
const { writeJsonIfChangedAsync } = require('./lib/escriure-json-si-canvia');

const ROOT = path.resolve(__dirname, '..');
const FEED_PATH = path.join(ROOT, 'data', 'feed.json');
const ARCHIVE_DIR = path.join(ROOT, 'data', 'archive', 'channels');
const OUTPUT_DIR = path.join(ROOT, 'data');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'search_index_manifest.json');
const MONTHLY_RECENT_YEARS = Number.parseInt(process.env.SEARCH_INDEX_MONTHLY_RECENT_YEARS || '2', 10);

function getBucketDescriptor(date) {
    const year = date.getUTCFullYear();
    const nowYear = new Date().getUTCFullYear();
    const monthlyThresholdYear = nowYear - Math.max(1, MONTHLY_RECENT_YEARS) + 1;
    if (year >= monthlyThresholdYear) {
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        return {
            key: `${year}_${month}`,
            year,
            month: Number(month),
            granularity: 'month',
            fileName: `search_index_${year}_${month}.json`
        };
    }

    return {
        key: String(year),
        year,
        month: null,
        granularity: 'year',
        fileName: `search_index_${year}.json`
    };
}

async function readJson(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
}

function toCompactVideo(video, fallbackChannelId = '') {
    const id = video?.id;
    const title = video?.title;
    if (!id || !title) {
        return null;
    }

    return {
        i: String(id),
        t: String(title),
        c: String(video?.channelId || fallbackChannelId || ''),
        d: String(video?.publishedAt || ''),
        s: Number(video?.durationSeconds || 0)
    };
}

async function main() {
    const feed = await readJson(FEED_PATH);
    const feedVideos = Array.isArray(feed?.videos) ? feed.videos : [];
    const recentVideoIds = new Set(
        feedVideos
            .map(video => String(video?.id || ''))
            .filter(Boolean)
    );

    const archiveFiles = (await fs.readdir(ARCHIVE_DIR))
        .filter(file => file.endsWith('.json'));

    const compactByBucket = new Map();
    const seenArchiveIds = new Set();

    for (const fileName of archiveFiles) {
        const filePath = path.join(ARCHIVE_DIR, fileName);
        const archive = await readJson(filePath);
        const channelId = String(archive?.channelId || path.basename(fileName, '.json'));
        const videos = Array.isArray(archive?.videos) ? archive.videos : [];

        for (const video of videos) {
            const videoId = String(video?.id || '');
            if (!videoId || recentVideoIds.has(videoId) || seenArchiveIds.has(videoId)) {
                continue;
            }
            const compactVideo = toCompactVideo(video, channelId);
            if (!compactVideo) {
                continue;
            }
            const publishedAt = new Date(compactVideo.d || video?.d || 0);
            const year = publishedAt.getUTCFullYear();
            if (!Number.isFinite(year) || year <= 0) {
                continue;
            }
            const bucket = getBucketDescriptor(publishedAt);
            if (!compactByBucket.has(bucket.key)) {
                compactByBucket.set(bucket.key, { ...bucket, videos: [] });
            }
            compactByBucket.get(bucket.key).videos.push(compactVideo);
            seenArchiveIds.add(videoId);
        }
    }

    const existingFiles = (await fs.readdir(OUTPUT_DIR))
        .filter(file => /^search_index_(?!manifest).*\.json$/.test(file));

    const buckets = Array.from(compactByBucket.values()).sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return (b.month || 0) - (a.month || 0);
    });

    const manifest = {
        generatedAt: new Date().toISOString(),
        strategy: {
            mode: 'hybrid',
            monthlyRecentYears: Math.max(1, MONTHLY_RECENT_YEARS)
        },
        buckets: []
    };

    let totalVideos = 0;
    const writtenFileNames = new Set();

    for (const bucket of buckets) {
        const compact = bucket.videos || [];
        compact.sort((a, b) => new Date(b.d || 0).getTime() - new Date(a.d || 0).getTime());
        const outputPath = path.join(OUTPUT_DIR, bucket.fileName);
        // Els fragments no tenen timestamp: comparació byte a byte (ignoreKeys buit)
        // per escriure només quan el contingut canvia realment.
        await writeJsonIfChangedAsync(outputPath, compact, {
            indent: 0,
            trailingNewline: true,
            ignoreKeys: []
        });
        writtenFileNames.add(bucket.fileName);
        totalVideos += compact.length;
        manifest.buckets.push({
            key: bucket.key,
            year: bucket.year,
            month: bucket.month,
            granularity: bucket.granularity,
            file: bucket.fileName,
            itemCount: compact.length
        });
        console.log(`Índex de cerca generat (${bucket.key}): ${compact.length} vídeos -> data/${bucket.fileName}`);
    }

    // Elimina els fragments orfes (buckets que ja no existeixen) sense reescriure
    // els que no han canviat. Substitueix el patró "esborra-tot-i-reescriu".
    const orphanFiles = existingFiles.filter(file => !writtenFileNames.has(file));
    await Promise.all(orphanFiles.map(file => fs.unlink(path.join(OUTPUT_DIR, file))));

    await writeJsonIfChangedAsync(MANIFEST_PATH, manifest, {
        indent: 2,
        trailingNewline: true,
        ignoreKeys: ['generatedAt']
    });
    console.log(`Manifest generat: data/search_index_manifest.json (${manifest.buckets.length} fragments).`);
    console.log(`Total vídeos indexats: ${totalVideos} en ${buckets.length} fitxers.`);
}

main().catch(error => {
    console.error('Error generant índexs de cerca per any:', error);
    process.exitCode = 1;
});
