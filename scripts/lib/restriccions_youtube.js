'use strict';

// Vídeos que el reproductor incrustat no pot fer sonar: amb restricció d'edat (YouTube hi demana obrir-los a YouTube
// per confirmar l'edat) o que l'autor no deixa incrustar. Una ràdio que en topés un quedaria aturada.
//
// No gasta quota: les dades arriben amb les consultes `videos.list` que ja es fan (el generador diari demana
// `contentDetails,status`; l'actualització setmanal de l'arxiu hi afegeix aquestes parts, que no costen més: una
// consulta de fins a 50 vídeos és 1 unitat sigui quines siguin les parts).
//
// El registre és `data/videos-restringits.json`: { updatedAt, videos: { id: { motiu, detectat } } }. El client els
// amaga com els de `hidden-videos.json`; si YouTube treu la restricció, la propera comprovació els treu del registre.

const fs = require('fs');
const path = require('path');

const REGISTRY_FILE = path.join(__dirname, '..', '..', 'data', 'videos-restringits.json');

// '' si el vídeo es pot incrustar i no té restricció d'edat; si no, el motiu.
function restrictionReason(item) {
    if (item?.contentDetails?.contentRating?.ytRating === 'ytAgeRestricted') return 'edat';
    if (item?.status && item.status.embeddable === false) return 'no-incrustable';
    return '';
}

function normalizeRegistry(raw) {
    const videos = raw && typeof raw === 'object' && raw.videos && typeof raw.videos === 'object' ? raw.videos : {};
    return { updatedAt: String(raw?.updatedAt || ''), videos: { ...videos } };
}

// Actualitza el registre amb els vídeos acabats de consultar (només toca aquests: la resta no se sap si han canviat).
function updateRegistry(registry, items, today = new Date().toISOString().slice(0, 10)) {
    const current = normalizeRegistry(registry);
    const videos = { ...current.videos };
    const added = [];
    const removed = [];
    for (const item of items || []) {
        const id = String(item?.id || '').trim();
        if (!id) continue;
        const motiu = restrictionReason(item);
        if (motiu) {
            if (!videos[id]) added.push(id);
            videos[id] = { motiu, detectat: videos[id]?.detectat || today };
        } else if (videos[id]) {
            delete videos[id];
            removed.push(id);
        }
    }
    const sorted = Object.fromEntries(
        Object.keys(videos)
            .sort()
            .map(id => [id, videos[id]])
    );
    const changed = added.length > 0 || removed.length > 0;
    return {
        registry: { updatedAt: changed ? today : current.updatedAt || today, videos: sorted },
        added,
        removed,
        changed,
    };
}

function loadRegistry(file = REGISTRY_FILE) {
    try {
        return normalizeRegistry(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch (error) {
        return normalizeRegistry(null);
    }
}

function saveRegistry(registry, file = REGISTRY_FILE) {
    const ids = Object.keys(registry.videos || {});
    const lines = ids.map(id => `    ${JSON.stringify(id)}: ${JSON.stringify(registry.videos[id])}`);
    const body = `{\n  "updatedAt": ${JSON.stringify(registry.updatedAt || '')},\n  "videos": {${
        lines.length ? `\n${lines.join(',\n')}\n  ` : ''
    }}\n}\n`;
    fs.writeFileSync(file, body);
}

module.exports = { REGISTRY_FILE, restrictionReason, updateRegistry, loadRegistry, saveRegistry };
