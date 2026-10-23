'use strict';

// Cloudflare serveix la mateixa pàgina HTML amb una adreça llegible, sense duplicar milers de fitxers.
function videoRoute(song) {
    const title = String(song.title || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100).replace(/-+$/, '') || 'canco';
    return `video/${title}/${song.id}/`;
}

function publicFile(route) {
    const video = /^video\/[a-z0-9-]+\/([A-Za-z0-9_-]{11})\/$/.exec(route);
    return video ? `compartir/canco/${video[1]}.html` : route + (!route || route.endsWith('/') ? 'index.html' : '');
}

function videoRewrite(base) {
    return `${base}video/:title/:id/ ${base}compartir/canco/:id 200`;
}

module.exports = { videoRoute, publicFile, videoRewrite };
