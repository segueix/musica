// Revisió editorial d'artistes: nom, categories i marca «OK». Funcions pures (UMD) que fan servir la pàgina
// revisio-artistes.html (editar i baixar el document) i el script scripts/aplicar_revisio_artistes.js (aplicar-lo a
// data/artistes-musica.json), i que es proven a tests/revisio-artistes.test.js.
//
// Flux: es edita a la pàgina → es baixa el document (JSON) → s'aplica amb `node scripts/aplicar_revisio_artistes.js`.
// «Ben indexat» = té almenys un canal de YouTube assignat (és el que fa que sonin al feed) i no està rebutjat.
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.SegueixRevisioArtistes = api;
})(typeof window !== 'undefined' ? window : null, function () {
    'use strict';

    const DOC_TYPE = 'revisio-artistes';
    const DOC_VERSION = 1;
    const MAX_NAME = 100;

    const text = value => String(value ?? '').trim();
    const lowerKey = value => text(value).toLocaleLowerCase('ca');
    const unique = list => [...new Set(list)];
    const sameList = (a, b) => JSON.stringify(a ?? []) === JSON.stringify(b ?? []);

    // Nom net: sense espais de més i amb un límit raonable.
    function cleanName(value) {
        return text(value).replace(/\s+/g, ' ').slice(0, MAX_NAME);
    }

    function channelsOf(artist) {
        return (Array.isArray(artist?.youtube?.channels) ? artist.youtube.channels : []).filter(channel => channel?.id);
    }

    // Té canal de YouTube i no està rebutjat.
    function isIndexed(artist) {
        return Boolean(artist) && artist.reviewStatus !== 'rebutjat' && channelsOf(artist).length > 0;
    }

    // Clau estable d'un artista (la mateixa que fa servir admin-musica.html).
    function artistKey(artist) {
        if (artist?.wikidataId) return `wikidata:${artist.wikidataId}`;
        const channel = channelsOf(artist)[0]?.id;
        if (channel) return `youtube:${channel}`;
        return `name:${lowerKey(artist?.name)}`;
    }

    function keysOf(artist) {
        const keys = [];
        if (artist?.wikidataId) keys.push(`wikidata:${artist.wikidataId}`);
        channelsOf(artist).forEach(channel => keys.push(`youtube:${channel.id}`));
        if (artist?.name) keys.push(`name:${lowerKey(artist.name)}`);
        return keys;
    }

    // Categories ordenades segons la taxonomia i sense les que no hi són.
    function normalizeGenres(genres, taxonomy) {
        const wanted = new Set((Array.isArray(genres) ? genres : []).map(text));
        return (Array.isArray(taxonomy) ? taxonomy : []).filter(label => wanted.has(label));
    }

    // Files de la pàgina: artistes ben indexats, en ordre alfabètic, amb l'esborrany (només els canvis) aplicat.
    // drafts: { [key]: { name?, genres?, ok? } }
    function buildRows(db, drafts = {}, taxonomy = []) {
        return (Array.isArray(db?.artists) ? db.artists : [])
            .filter(isIndexed)
            .map(artist => {
                const key = artistKey(artist);
                const draft = drafts[key] || {};
                const originalGenres = normalizeGenres(artist.genres, taxonomy);
                return {
                    key,
                    originalName: artist.name,
                    name: draft.name !== undefined ? cleanName(draft.name) : artist.name,
                    originalGenres,
                    genres: draft.genres !== undefined ? normalizeGenres(draft.genres, taxonomy) : originalGenres,
                    ok: draft.ok !== undefined ? Boolean(draft.ok) : Boolean(artist.revisioEditorial?.ok),
                    originalOk: Boolean(artist.revisioEditorial?.ok),
                };
            })
            .sort((a, b) => a.originalName.localeCompare(b.originalName, 'ca', { sensitivity: 'base' }));
    }

    function rowState(row) {
        return {
            nameChanged: row.name !== row.originalName,
            genresChanged: !sameList(row.genres, row.originalGenres),
            okChanged: row.ok !== row.originalOk,
        };
    }

    // Esborrany mínim d'una fila (només el que ha canviat) o null si no hi ha cap canvi.
    function draftOf(row) {
        const state = rowState(row);
        if (!state.nameChanged && !state.genresChanged && !state.okChanged) return null;
        const draft = {};
        if (state.nameChanged) draft.name = row.name;
        if (state.genresChanged) draft.genres = row.genres;
        if (state.okChanged) draft.ok = row.ok;
        return draft;
    }

    // Document que es baixa: totes les files (perquè també hi surtin els OK) amb què ha canviat en cada una.
    function buildExport(rows, meta = {}) {
        const now = meta.now || new Date().toISOString();
        return {
            type: DOC_TYPE,
            version: DOC_VERSION,
            exportedAt: now,
            baseUpdatedAt: meta.baseUpdatedAt || null,
            artists: rows.map(row => ({
                key: row.key,
                originalName: row.originalName,
                name: cleanName(row.name),
                genres: row.genres,
                ok: Boolean(row.ok),
                ...rowState(row),
            })),
        };
    }

    // Resum de la revisió per a la capçalera de la pàgina.
    function summarize(rows) {
        const states = rows.map(rowState);
        return {
            total: rows.length,
            ok: rows.filter(row => row.ok).length,
            renamed: states.filter(state => state.nameChanged).length,
            recategorized: states.filter(state => state.genresChanged).length,
            withoutGenres: rows.filter(row => row.genres.length === 0).length,
        };
    }

    // Aplica un document baixat a la base. No toca res més que nom (l'anterior passa a àlies), categories (i les
    // marca com a manuals perquè l'enriquiment automàtic no les trepitgi) i la marca `revisioEditorial`.
    // Retorna { db, report } sense modificar l'original.
    function applyExport(db, doc, taxonomy, now = new Date().toISOString()) {
        const report = { renamed: [], recategorized: [], marked: 0, unchanged: 0, missing: [], invalid: [] };
        if (doc?.type !== DOC_TYPE || !Array.isArray(doc.artists)) {
            report.invalid.push('El fitxer no és un document de revisió d’artistes.');
            return { db, report };
        }
        const next = JSON.parse(JSON.stringify(db));
        const byKey = new Map();
        (next.artists || []).forEach(artist =>
            keysOf(artist).forEach(key => !byKey.has(key) && byKey.set(key, artist))
        );
        const allowed = new Set(taxonomy);

        doc.artists.forEach(entry => {
            const artist = byKey.get(entry.key) || byKey.get(`name:${lowerKey(entry.originalName)}`);
            if (!artist) {
                report.missing.push(entry.originalName || entry.key);
                return;
            }
            let touched = false;

            const name = cleanName(entry.name);
            if (entry.nameChanged !== false && name && name !== artist.name) {
                const previous = artist.name;
                artist.aliases = unique(
                    [...(artist.aliases || []), previous].filter(alias => alias && lowerKey(alias) !== lowerKey(name))
                );
                artist.name = name;
                report.renamed.push(`${previous} → ${name}`);
                touched = true;
            } else if (entry.nameChanged && !name) {
                report.invalid.push(`${artist.name}: el nom nou és buit`);
            }

            if (Array.isArray(entry.genres) && entry.genresChanged !== false) {
                const unknown = entry.genres.filter(genre => !allowed.has(genre));
                if (unknown.length)
                    report.invalid.push(`${artist.name}: categories desconegudes (${unknown.join(', ')})`);
                const genres = normalizeGenres(entry.genres, taxonomy);
                if (!sameList(genres, artist.genres || [])) {
                    artist.genres = genres;
                    artist.sources = unique([...(artist.sources || []), 'genre:manual']);
                    report.recategorized.push(`${artist.name}: ${genres.join(', ') || '(cap)'}`);
                    touched = true;
                }
            }

            const ok = Boolean(entry.ok);
            const was = Boolean(artist.revisioEditorial?.ok);
            if (ok !== was) {
                if (ok) artist.revisioEditorial = { ok: true, at: now };
                else delete artist.revisioEditorial;
                report.marked += 1;
                touched = true;
            }
            if (!touched) report.unchanged += 1;
        });

        if (report.renamed.length || report.recategorized.length || report.marked) next.updatedAt = now;
        return { db: next, report };
    }

    return {
        DOC_TYPE,
        DOC_VERSION,
        cleanName,
        isIndexed,
        artistKey,
        keysOf,
        normalizeGenres,
        buildRows,
        rowState,
        draftOf,
        buildExport,
        summarize,
        applyExport,
    };
});
