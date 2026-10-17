'use strict';

const fs = require('node:fs');
const path = require('node:path');
const policy = require('../../js/catalog-policy.js');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function selectCatalog(catalog, { now = Date.now(), albums = null } = {}) {
    const candidates = new Map(catalog.artists.map(artist => [artist.id, []]));
    const byId = new Map(catalog.songs.map(song => [song.id, song]));
    for (const song of catalog.songs) candidates.get(catalog.artistByChannel.get(song.channelId).id).push(song);
    // Les actuacions en canals convidats només s'atribueixen amb l'enllaç editorial ja existent.
    for (const artist of catalog.artists) {
        const keys = new Set(artist.channelIds.map(id => albums?.channels?.[id]).filter(Boolean));
        for (const key of keys) for (const album of albums?.artists?.[key]?.albums || []) {
            if (!album.sourceChannelId || artist.channelIds.includes(album.sourceChannelId)) continue;
            for (const id of album.trackIds || []) {
                const song = byId.get(id);
                if (song?.channelId === album.sourceChannelId) candidates.get(artist.id).push(song);
            }
        }
    }
    const models = new Map();
    const popular = new Set();
    const recent = new Map();
    for (const [id, songs] of candidates) {
        const model = policy.selectArtist(songs, { now });
        models.set(id, model);
        model.popular.forEach(song => popular.add(song.id));
        model.recent.forEach(song => recent.set(song.id, policy.anniversary(policy.releaseTime(song))));
    }
    for (const id of popular) recent.delete(id);
    const songs = catalog.songs.filter(song => popular.has(song.id) || recent.has(song.id));
    return { ...catalog, songs, models, selection: {
        version: 1, popularLimit: policy.POPULAR_LIMIT,
        popularIds: [...popular].sort(), recentExpiry: Object.fromEntries([...recent].sort()),
    }, counts: { candidates: catalog.songs.length, popular: popular.size, recent: recent.size,
        live: songs.filter(policy.isLive).length, total: songs.length } };
}

// Retalla totes les fonts públiques, però conserva intactes les dades mestres del repositori per poder
// recalcular les 21 més vistes en publicacions futures. No consulta YouTube ni modifica fitxers d'origen.
function writePublicCatalog(root, out, catalog) {
    const write = (file, value) => {
        const target = path.join(out, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, JSON.stringify(value));
    };
    const selected = new Map(catalog.songs.map(song => [song.id, song]));
    const clean = song => { const { artist, ...video } = song; return video; };
    const feed = read(path.join(root, 'data/feed.json'));
    const originalFeedIds = new Set(feed.videos.map(video => video.id));
    const bestIds = new Set([...catalog.models.values()].map(model => model.best?.id).filter(Boolean));
    const feedSongs = catalog.songs.filter(song => originalFeedIds.has(song.id) || bestIds.has(song.id));
    const feedIds = new Set(feedSongs.map(song => song.id));
    const history = catalog.songs.filter(song => !feedIds.has(song.id));
    write('data/feed.json', { ...feed, videos: feedSongs.map(clean) });
    const hidden = read(path.join(root, 'data/hidden-videos.json'));
    write('data/hidden-videos.json', { ...hidden, catalogSelection: catalog.selection });
    for (const file of ['historial-musical.json', 'history-pool.json']) {
        const source = path.join(root, 'data', file);
        const payload = fs.existsSync(source) ? read(source) : {};
        write('data/' + file, { ...payload, perChannel: undefined, videos: history.map(clean) });
    }
    const archives = path.join(out, 'data/archive/channels');
    if (fs.existsSync(archives)) {
        for (const file of fs.readdirSync(archives).filter(file => file.endsWith('.json'))) {
            const payload = read(path.join(archives, file));
            write('data/archive/channels/' + file, { ...payload,
                videos: (payload.videos || []).filter(video => selected.has(video.id)).map(video => clean(selected.get(video.id))) });
        }
    }
    // Reconstrueix els fragments a partir de la selecció, també per a cançons que abans només eren al feed.
    const buckets = new Map();
    for (const song of history) {
        const year = Number(String(song.publishedAt || '').slice(0, 4));
        const key = Number.isFinite(year) && year > 1900 ? String(year) : 'sense-data';
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push({ i: song.id, t: song.title, c: song.channelId, d: song.publishedAt || '',
            s: Number(song.durationSeconds) || 0 });
    }
    const dataDir = path.join(out, 'data');
    for (const file of fs.readdirSync(dataDir).filter(file => /^search_index_(?!manifest).*\.json$/.test(file))) {
        fs.unlinkSync(path.join(dataDir, file));
    }
    const manifest = [];
    for (const [key, videos] of [...buckets].sort((a, b) => b[0].localeCompare(a[0]))) {
        const file = `search_index_${key}.json`;
        write('data/' + file, videos);
        manifest.push({ key, year: Number(key) || 0, month: null, granularity: 'year', file, itemCount: videos.length });
    }
    write('data/search_index_manifest.json', { strategy: { mode: 'catalog-selection' }, buckets: manifest });
    return { feed: feedSongs.length, history: history.length };
}

module.exports = { selectCatalog, writePublicCatalog };
