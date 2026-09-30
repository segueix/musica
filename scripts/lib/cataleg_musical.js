'use strict';

// Catàleg musical incremental. La recollida (pujades recents de cada canal) i el que veu l'usuari són
// processos diferents: aquí hi ha les peces pures perquè una fallada transitòria no esborri repertori vàlid,
// perquè les novetats s'afegeixin sense tornar a baixar-ho tot i perquè el repertori antic representatiu
// (per a artistes de la llista d'antics) s'enriqueixi amb un pressupost de quota acotat.
//
// Quota (YouTube Data API): playlistItems.list = 1 unitat per pàgina (50 vídeos); videos.list = 1 unitat per
// cada 50 identificadors. Tot el repertori conservat es torna a verificar en ~160 crides, molt per sota del
// límit diari; les pàgines profundes només es consulten per als canals demanats i dins del pressupost.

const DEFAULTS = Object.freeze({
  // Pàgines profundes per execució (total) i per canal (fins a maxPagesPerChannel * 50 vídeos).
  deepPageBudget: 24,
  maxPagesPerChannel: 5,
  // Vídeos antics conservats per canal: els més populars entre els acceptats com a cançó.
  deepKeep: 25,
  retainedKeep: 100
});

const isSongType = type => type === 'song' || type === 'live_song';

// Pàgines profundes a consultar aquesta execució: en ordre rotatiu (menys pàgines primer) dins del pressupost.
// state: { [channelId]: { next: string|null, pages: number, done: boolean } }
function planDeepPages(state, channelIds, { budget = DEFAULTS.deepPageBudget, maxPages = DEFAULTS.maxPagesPerChannel } = {}) {
  const pending = [];
  for (const channelId of channelIds) {
    const entry = state?.[channelId];
    // Una entrada sense `next` i no acabada és un canal que encara no té pàgina 2 registrada: no es pot continuar.
    if (!entry || entry.done || !entry.next || (entry.pages || 1) >= maxPages) continue;
    pending.push({ channelId, pageToken: entry.next, pages: entry.pages || 1 });
  }
  pending.sort((a, b) => a.pages - b.pages || a.channelId.localeCompare(b.channelId));
  return pending.slice(0, Math.max(0, budget));
}

// Registra el resultat d'una pàgina. Un token que caduca reinicia el canal (no es perd res del que ja hi ha).
function applyDeepResult(state, channelId, { ok, nextPageToken = null }, { maxPages = DEFAULTS.maxPagesPerChannel } = {}) {
  const entry = state[channelId] || { next: null, pages: 1, done: false };
  if (!ok) {
    state[channelId] = { next: null, pages: 1, done: false, restart: true };
    return state[channelId];
  }
  const pages = (entry.pages || 1) + 1;
  state[channelId] = {
    next: nextPageToken || null,
    pages,
    done: !nextPageToken || pages >= maxPages
  };
  return state[channelId];
}

// Primera pàgina d'un canal: en registra el token de continuació si encara no hi és.
function seedDeepState(state, channelId, nextPageToken) {
  if (state[channelId]) return state[channelId];
  state[channelId] = { next: nextPageToken || null, pages: 1, done: !nextPageToken };
  return state[channelId];
}

// D'entre els vídeos antics d'un canal, els més populars que són cançons acceptades.
// items: [{ id, viewCount, contentType }]
function selectDeepKeep(items, keep = DEFAULTS.deepKeep) {
  return items
    .filter(item => isSongType(item.contentType))
    .sort((a, b) => (Number(b.viewCount) || 0) - (Number(a.viewCount) || 0) || String(a.id).localeCompare(String(b.id)))
    .slice(0, keep)
    .map(item => item.id);
}

// Vídeos del feed anterior que ja no són a la finestra de pujades recents: es conserven (i es tornen a
// verificar) fins a `keep` per canal, els més populars. Sempre s'hi afegeixen tots els de la finestra actual.
function pickRetained(previousVideos, freshIds, keep = DEFAULTS.retainedKeep) {
  const fresh = freshIds instanceof Set ? freshIds : new Set(freshIds);
  return (previousVideos || [])
    .filter(video => video?.id && !fresh.has(video.id))
    .sort((a, b) => (Number(b.viewCount) || 0) - (Number(a.viewCount) || 0) || String(a.id).localeCompare(String(b.id)))
    .slice(0, keep);
}

// Un canal no resolt o una recollida fallida no pot deixar el canal sense repertori: es conserva el de l'anterior.
// Un vídeo només es retira si l'API el confirma com a privat/eliminat (no torna a la resposta o no és públic).
function verdict({ requested, returned, batchFailed }) {
  if (batchFailed) return 'unverified';
  if (!returned) return 'removed';
  return returned.status?.privacyStatus === 'public' ? 'kept' : 'removed';
}

module.exports = {
  DEFAULTS,
  planDeepPages,
  applyDeepResult,
  seedDeepState,
  selectDeepKeep,
  pickRetained,
  verdict
};
