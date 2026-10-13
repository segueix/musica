'use strict';
// L'absència de dades externes no és una ordre editorial d'esborrar una classificació.
function preserveGenres(artist, mapped, allowed) {
    if ((artist.sources || []).includes('genre:manual')) return artist.genres || [];
    const next = mapped.filter(label => allowed.has(label));
    return next.length ? next : (artist.genres || []).filter(label => allowed.has(label));
}
module.exports = { preserveGenres };
