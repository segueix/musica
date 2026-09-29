'use strict';

// Correcció del nom mostrat d'un canal quan YouTube en dona un que és només el handle
// (p. ex. títol "elspetsoficial" amb handle @elspetsoficial): s'usa el nom real de l'artista.

function normalizeToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^a-z0-9]/g, '');
}

// Un nom "és el handle" si és una sola paraula (un nom real acostuma a tenir espais) que
// coincideix amb el handle (ignorant @, majúscules, accents i símbols), o comença per @.
function isHandleName(name, handle) {
  const text = String(name || '').trim();
  const n = normalizeToken(text);
  if (!n) return false;
  if (text.startsWith('@')) return true;
  return !/\s/.test(text) && n === normalizeToken(handle);
}

// name: títol de YouTube · handle: customUrl · artistNames: artistes assignats al canal.
function resolveChannelDisplayName(name, handle, artistNames) {
  const raw = String(name || '').trim();
  const artists = Array.isArray(artistNames) ? artistNames.filter(Boolean) : [];
  // Només si el canal és d'un únic artista: amb diversos no sabem quin nom pertoca.
  if (artists.length !== 1) return raw || String(artists[0] || '').trim();
  const artist = String(artists[0]).trim();
  if (!raw) return artist;
  if (isHandleName(raw, handle) && normalizeToken(raw) !== normalizeToken(artist)) return artist;
  return raw;
}

module.exports = { normalizeToken, isHandleName, resolveChannelDisplayName };
