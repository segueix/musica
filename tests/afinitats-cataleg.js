import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Els perfils d'afinitat detallats (js/features/music-affinities.js) són els de la revisió del 2026-10-13 i es
// conserven tal qual. Després, l'usuari ha passat alguns d'aquests artistes a una altra categoria (Txarango a
// Rumba / Mestissatge; la revisió d'una sola categoria del 2026-10-19, docs/revisions/2026-10-19-una-categoria.json, i
// la del 2026-10-20, docs/revisions/2026-10-20-categoria-unica-55.json): aquí mana el catàleg. Un canal d'un perfil que
// ja no és de la categoria només és correcte si el canvi és una decisió manual (`genre:manual` a
// data/artistes-musica.json) i el catàleg publicat (js/channels-ca.json) en porta exactament aquelles categories.
const require = createRequire(import.meta.url);
const { CATEGORY_GROUPS } = require('../js/music-categories.js');

export const catalogChannels = JSON.parse(readFileSync('js/channels-ca.json', 'utf8')).channels;
const artists = JSON.parse(readFileSync('data/artistes-musica.json', 'utf8')).artists;
const categoryOf = genres =>
    CATEGORY_GROUPS.filter(group => group.genres.some(genre => genres.includes(genre))).map(group => group.label);

// Canals dels perfils que ja no són de la categoria, amb les categories que hi hauria d'haver segons la base.
export function movedChannels(profiles, category) {
    const moved = [];
    for (const profile of profiles) {
        for (const id of profile.channelIds) {
            const channel = catalogChannels.find(item => item.id === id);
            if (channel?.categories.includes(category)) continue;
            const owner = artists.find(artist => artist.youtube?.channels?.some(item => item.id === id));
            moved.push({
                artist: profile.artist,
                id,
                categories: channel?.categories || null,
                manual: Boolean(owner?.sources?.includes('genre:manual')),
                expected: owner ? categoryOf(owner.genres || []) : null,
            });
        }
    }
    return moved;
}

// Cada canal mogut: decisió manual i catàleg al dia (un canal que ja no hi és, o un ID erroni, falla).
export function expectMovedByUser(expect, profiles, category) {
    const moved = movedChannels(profiles, category);
    for (const item of moved) {
        expect(item.manual, `${item.artist} · ${item.id}`).toBe(true);
        expect(item.categories, `${item.artist} · ${item.id}`).toEqual(item.expected);
    }
    return moved;
}
