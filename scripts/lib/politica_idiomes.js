'use strict';

// Identitat editorial: l'ID del canal mana; un homònim no hereta confiança pel nom.
const { cleanTitle } = require('../../js/song-title.js');

function nameKey(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/\s*-\s*(topic|tema)\s*$/i, '')
        .replace(/[^\p{L}\p{N}]/gu, '');
}

function createPolicy(registry, db = { artists: [] }) {
    if (registry?.schemaVersion !== 1 || !Array.isArray(registry.vigilats) || !Array.isArray(registry.confianca)) {
        throw new Error('Falta un registre vàlid d’artistes vigilats: no es pot aplicar confiança per defecte.');
    }
    const byName = new Map();
    const byChannel = new Map();
    function add(map, key, entry) {
        if (!key) return;
        const values = map.get(key) || [];
        if (!values.includes(entry)) values.push(entry);
        map.set(key, values);
    }
    // Un sol artista té prioritat de vigilància encara que comparteixi canal amb un de confiança.
    const entries = ['confianca', 'vigilats'].flatMap((mode) =>
        registry[mode].map((entry) => ({
            ...entry,
            mode,
            key: nameKey(entry.artista),
        }))
    );
    for (const entry of entries) {
        for (const name of [entry.artista, ...(entry.aliases || [])]) add(byName, nameKey(name), entry);
        for (const id of entry.canals || []) add(byChannel, id, entry);
    }
    for (const artist of db.artists || []) {
        if (artist.reviewStatus === 'rebutjat') continue;
        const matches = byName.get(nameKey(artist.name)) || [];
        // Un artista nou s'ha de classificar una vegada; no n'heretem l'estat per un àlies ambigu.
        const match = matches.find((entry) => entry.key === nameKey(artist.name)) || {
            mode: 'nou',
            key: nameKey(artist.name),
            artista: artist.name,
            aliases: artist.aliases || [],
        };
        for (const name of [artist.name, artist.displayName, ...(artist.aliases || [])])
            add(byName, nameKey(name), match);
        for (const channel of artist.youtube?.channels || []) {
            add(byChannel, channel.id, match);
            add(byName, nameKey(channel.name), match);
        }
    }
    function resolve(video) {
        const channelId = video.channelId || video.canalId;
        const matches = channelId ? byChannel.get(channelId) : byName.get(nameKey(video.channelTitle || video.artista));
        if (!matches?.length)
            return {
                mode: 'nou',
                key: channelId || nameKey(video.channelTitle || video.artista),
                artista: video.channelTitle || video.artista || 'Canal desconegut',
            };
        const watched = matches.find((entry) => entry.mode === 'vigilats');
        if (watched) return watched;
        if (matches.length !== 1)
            return {
                mode: 'nou',
                key: channelId || nameKey(video.channelTitle || video.artista),
                artista: video.channelTitle || video.artista,
            };
        return matches[0];
    }
    return { resolve, entries, discs: registry.discsVerificats || [] };
}

// Només reutilitzem una decisió sobre una obra sense marques de versió/collaboració.
// No s'eliminen accents, números ni subtítols: dues versions lingüístiques poden compartir un títol.
function recordingKey(video, artist) {
    if (!artist?.key || artist.mode === 'nou' || artist.canalCompartit) return '';
    const title = String(video.title || video.titol || '');
    if (
        /remix|\bmix\b|rework|\bdub\b|\bedit\b|\bcover\b|duet|instrumental|karaoke|ac[uú]stic|acoustic|\blive\b|directe|concierto|concert|versi[oó]|version|feat\.?|\bft\.?\s|featuring|\bamb\b|\bwith\b|\bcon\b|\s[&x+]\s/i.test(
            title
        )
    )
        return '';
    if (video.contentType === 'live_song') return '';
    const clean = cleanTitle(title, {
        artists: [artist.artista, ...(artist.aliases || []), video.channelTitle].filter(Boolean),
    });
    const key = clean.normalize('NFC').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
    return key ? `${artist.key}::${key}` : '';
}

module.exports = { nameKey, createPolicy, recordingKey };
