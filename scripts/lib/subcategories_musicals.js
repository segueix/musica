'use strict';
const assert = require('node:assert/strict');

// Una decisió per artista. Les facets antigues només són evidència per a la migració,
// mai entrades múltiples ni punts addicionals al motor de ràdio.
function classifyProfiles(profiles, artists, taxonomy, origins, categoryGroups) {
    const definitions = taxonomy.subcategories;
    const byId = new Map(definitions.map(s => [s.id, s]));
    assert.equal(byId.size, definitions.length, 'Subcategories duplicades');
    assert.equal(taxonomy.minimumArtists, 5, 'El nucli editorial requereix cinc artistes');
    for (const s of definitions) {
        assert(categoryGroups.some(c => c.label === s.category), 'Categoria desconeguda: ' + s.category);
        for (const id of s.neighbours) {
            assert(byId.has(id) && byId.get(id).neighbours.includes(s.id), 'Veïnatge no simètric: ' + s.id);
        }
    }
    const canonical = new Map(artists.map(a => [a.name, a]));
    const result = profiles.map(p => {
        const artist = canonical.get(p.artist);
        const primary = categoryGroups.find(c => c.genres.includes(artist?.genres[0]))?.label || p.categories[0];
        const override = taxonomy.overrides[p.artist];
        const choices = definitions.filter(s => s.category === primary);
        const match = choices.filter(s => s.facets.some(f => p.facets.includes(f)))
            .sort((a, b) => a.priority - b.priority)[0];
        const fallback = choices.find(s => !s.facets.length) || choices[0];
        const selected = override ? byId.get(override.subcategory) : match || fallback;
        assert(selected && selected.category === primary, 'Subcategoria incompatible: ' + p.artist);
        const originEntries = Object.values(origins.artists).filter(a =>
            a.status === 'validated' && (a.name === p.artist || p.channelIds.some(id =>
                origins.channels[id] && origins.artists[origins.channels[id]] === a)));
        // Només municipis validats. No convertim una comarca o illa en una població fictícia.
        const places = [...new Set(originEntries.flatMap(a => a.placeIds || []))]
            .map(id => ({ id, ...origins.places[id] }))
            .filter(place => place.type === 'municipality' && Number.isFinite(place.coordinates?.latitude)
                && Number.isFinite(place.coordinates?.longitude))
            .map(place => ({ id: place.id, name: place.name, latitude: place.coordinates.latitude,
                longitude: place.coordinates.longitude }));
        return { ...p, primaryCategory: primary, subcategory: selected.id,
            subcategoryBasis: override ? 'editorial' : match ? 'documented-tags' : 'category-fallback',
            subcategorySources: override ? override.sources : p.sources,
            ...(override ? { subcategoryNote: override.basis } : {}), places };
    });
    return { profiles: result, subcategories: definitions.map(s => {
        const artists = result.filter(p => p.subcategory === s.id).map(p => p.artist);
        return { id: s.id, label: s.label, category: s.category, neighbours: s.neighbours,
            artistCount: artists.length, nucleus: artists.length >= taxonomy.minimumArtists, artists };
    }), minimumArtists: taxonomy.minimumArtists };
}

module.exports = { classifyProfiles };
