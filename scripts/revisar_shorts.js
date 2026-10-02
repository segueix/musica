const fs = require('fs');
const path = require('path');
const https = require('https');
const { serializeFeed } = require('./lib/aprimar_feed');

const OUTPUT_FEED_JSON = path.join(process.cwd(), 'data', 'feed.json');
// recent-feed.json i feed_updates.js són artefactes locals (fora de git): només
// s'actualitzen si existeixen al disc. La font de la veritat és data/feed.json.
const OUTPUT_RECENT_FEED_JSON = path.join(process.cwd(), 'data', 'recent-feed.json');
const OUTPUT_FEED_JS = path.join(process.cwd(), 'feed_updates.js');
// Registre persistent dels falsos Shorts detectats. És versionat a git perquè
// update_feed.js el torni a aplicar cada vegada que reconstrueix el feed.
const FALSE_SHORTS_JSON = path.join(process.cwd(), 'data', 'falsos-shorts.json');

// Finestra de vídeos a revisar (dies des de la publicació).
const REVIEW_DAYS = Math.max(1, Number.parseInt(process.env.SHORTS_REVIEW_DAYS ?? '31', 10));
// Dies abans de tornar a comprovar un vídeo ja verificat com a Short real.
const RECHECK_DAYS = Math.max(1, Number.parseInt(process.env.SHORTS_RECHECK_DAYS ?? '30', 10));
// Límit de peticions per execució, per no dependre de la tolerància de YouTube.
const MAX_CHECKS = Math.max(1, Number.parseInt(process.env.SHORTS_REVIEW_MAX ?? '250', 10));
const REQUEST_TIMEOUT_MS = 10000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fa una petició HEAD a la URL del short i comprova si YouTube ens redirigeix
 * a un reproductor de vídeo normal (/watch?v=)
 * Retorna 'short', 'fals' o 'desconegut' (error de xarxa/timeout: no concloent).
 */
const checkIsRealShort = (videoId) => {
    return new Promise((resolve) => {
        const options = {
            method: 'HEAD',
            headers: {
                // Afegim un User-Agent estàndard perquè YouTube no bloquegi la petició ràpidament
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
        };

        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            resolve(value);
        };

        const req = https.request(`https://www.youtube.com/shorts/${videoId}`, options, (res) => {
            res.resume();
            // Si és un 303 (o qualsevol 3xx) i la nova ubicació conté '/watch', NO és un Short
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                finish(res.headers.location.includes('/watch') ? 'fals' : 'short');
                return;
            }
            // 429/5xx: YouTube ens està limitant, no podem concloure res.
            if (res.statusCode === 429 || res.statusCode >= 500) {
                console.error(`   ⚠️ Resposta ${res.statusCode} de YouTube per ${videoId}: es deixa sense verificar.`);
                finish('desconegut');
                return;
            }
            // Si respon 200 OK (o 404: vídeo eliminat), el deixem com estava.
            finish('short');
        });

        req.setTimeout(REQUEST_TIMEOUT_MS, () => {
            console.error(`   ⚠️ Timeout comprovant ${videoId}.`);
            req.destroy();
            finish('desconegut');
        });

        req.on('error', (err) => {
            console.error(`   ⚠️ Error de xarxa comprovant ${videoId}: ${err.message}`);
            finish('desconegut'); // En cas de dubte, el deixem com estava per no trencar res
        });

        req.end();
    });
};

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadFalseShortsRegistry() {
    if (!fs.existsSync(FALSE_SHORTS_JSON)) {
        return { falseShorts: [], checked: {} };
    }
    try {
        const raw = readJson(FALSE_SHORTS_JSON);
        return {
            falseShorts: Array.isArray(raw.falseShorts) ? raw.falseShorts : [],
            checked: raw.checked && typeof raw.checked === 'object' ? raw.checked : {},
        };
    } catch (error) {
        console.error(`⚠️ ${path.basename(FALSE_SHORTS_JSON)} il·legible (${error.message}): es regenera de zero.`);
        return { falseShorts: [], checked: {} };
    }
}

/** Marca isShort=false a tots els vídeos que consten al registre. Retorna quants n'ha canviat. */
function applyOverrides(videos, falseShortIds) {
    let applied = 0;
    (Array.isArray(videos) ? videos : []).forEach((video) => {
        if (video && video.isShort === true && falseShortIds.has(video.id)) {
            video.isShort = false;
            applied += 1;
        }
    });
    return applied;
}

async function main() {
    try {
        console.log('--- Iniciant revisió de falsos Shorts ---');

        if (!fs.existsSync(OUTPUT_FEED_JSON)) {
            console.error(`❌ Error: no s'ha trobat ${OUTPUT_FEED_JSON}`);
            process.exit(1);
        }

        const feed = readJson(OUTPUT_FEED_JSON);
        const feedVideos = Array.isArray(feed.videos) ? feed.videos : [];
        const registry = loadFalseShortsRegistry();
        const falseShortIds = new Set(registry.falseShorts);
        const checked = { ...registry.checked };

        const now = new Date();
        const reviewCutoff = new Date(now.getTime() - REVIEW_DAYS * 24 * 60 * 60 * 1000);
        const recheckCutoff = new Date(now.getTime() - RECHECK_DAYS * 24 * 60 * 60 * 1000);

        const candidates = feedVideos
            .filter((video) => video?.isShort === true && video.id)
            .filter((video) => {
                const published = new Date(video.publishedAt);
                return !Number.isNaN(published.getTime()) && published >= reviewCutoff;
            })
            .filter((video) => !falseShortIds.has(video.id))
            .filter((video) => {
                const lastCheck = checked[video.id] ? new Date(checked[video.id]) : null;
                return !lastCheck || Number.isNaN(lastCheck.getTime()) || lastCheck < recheckCutoff;
            })
            .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

        const pending = candidates.slice(0, MAX_CHECKS);
        console.log(
            `🔎 ${feedVideos.filter((v) => v?.isShort === true).length} Shorts al feed | ` +
                `${candidates.length} pendents de verificar (últims ${REVIEW_DAYS} dies) | ` +
                `${pending.length} es comprovaran ara.`
        );
        if (candidates.length > pending.length) {
            console.log(
                `ℹ️ Queden ${candidates.length - pending.length} vídeos per a la propera execució (límit ${MAX_CHECKS}).`
            );
        }
        console.log(`📋 ${falseShortIds.size} falsos Shorts ja coneguts al registre.`);

        let detected = 0;
        for (let i = 0; i < pending.length; i++) {
            const video = pending[i];
            const title = (video.title || '').substring(0, 40);
            console.log(`⏳ Comprovant [${i + 1}/${pending.length}]: ${video.id} - ${title}...`);

            const result = await checkIsRealShort(video.id);

            if (result === 'fals') {
                console.log("   🚫 FALS SHORT DETECTAT! S'actualitzarà a format horitzontal.");
                falseShortIds.add(video.id);
                checked[video.id] = now.toISOString();
                detected += 1;
            } else if (result === 'short') {
                console.log('   ✅ És un Short vàlid.');
                checked[video.id] = now.toISOString();
            }
            // 'desconegut': no es registra, es tornarà a intentar la propera execució.

            // Pausa de 2 segons per evitar rate-limits (Error 429) de YouTube
            if (i < pending.length - 1) {
                await wait(2000);
            }
        }

        // Reaplica SEMPRE el registre: update_feed.js reconstrueix el feed diverses
        // vegades al dia i pot tornar a marcar isShort=true segons la durada.
        const appliedToFeed = applyOverrides(feedVideos, falseShortIds);
        console.log(`📝 Correccions aplicades a feed.json: ${appliedToFeed} (${detected} detectades en aquesta execució).`);

        // Neteja d'entrades de vídeos que ja no són al feed, per no fer créixer el registre indefinidament.
        const feedIds = new Set(feedVideos.map((video) => video?.id).filter(Boolean));
        const prunedFalseShorts = [...falseShortIds].filter((id) => feedIds.has(id)).sort();
        const prunedChecked = {};
        Object.keys(checked)
            .filter((id) => feedIds.has(id))
            .sort()
            .forEach((id) => {
                prunedChecked[id] = checked[id];
            });

        fs.writeFileSync(
            FALSE_SHORTS_JSON,
            `${JSON.stringify(
                {
                    updatedAt: now.toISOString(),
                    falseShorts: prunedFalseShorts,
                    checked: prunedChecked,
                },
                null,
                2
            )}\n`
        );

        if (appliedToFeed > 0) {
            fs.writeFileSync(OUTPUT_FEED_JSON, serializeFeed(feed));
        }

        // Artefactes locals opcionals (no versionats): només si ja existeixen.
        if (fs.existsSync(OUTPUT_RECENT_FEED_JSON)) {
            try {
                const recentFeed = readJson(OUTPUT_RECENT_FEED_JSON);
                const appliedToRecent = applyOverrides(recentFeed.videos, falseShortIds);
                if (appliedToRecent > 0) {
                    fs.writeFileSync(OUTPUT_RECENT_FEED_JSON, JSON.stringify(recentFeed, null, 2));
                    fs.writeFileSync(
                        OUTPUT_FEED_JS,
                        `// Auto-generated by scripts/update_feed.js and corrected by revisar_shorts.js\nwindow.FEED_UPDATES = ${JSON.stringify(recentFeed.videos, null, 2)};\n`
                    );
                }
                console.log(`📝 Correccions aplicades a recent-feed.json: ${appliedToRecent}.`);
            } catch (error) {
                console.error(`⚠️ No s'ha pogut actualitzar recent-feed.json: ${error.message}`);
            }
        }

        if (detected > 0) {
            console.log(`🎉 S'han detectat ${detected} falsos Shorts nous!`);
        } else {
            console.log("👍 No s'ha detectat cap fals Short nou.");
        }
    } catch (error) {
        console.error('❌ Error en el procés de revisió:', error.message);
        process.exit(1);
    }
}

main();
