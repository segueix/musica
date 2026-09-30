'use strict';

// Any original d'una cançó a partir d'evidència fiable. Distingeix la data de pujada a YouTube
// (`publishedAt`) de la de la gravació/publicació musical: una pista Topic pujada ahir pot ser d'una
// reedició de fa quinze anys. Si no hi ha evidència, NO s'inventa cap any (el client fa servir la data
// de pujada o la llista d'artistes antics, amb la confiança corresponent).
//
// Fonts, de més a menys fiable:
//  1. `data/musica-dates.json` → `songs[videoId]`: excepció verificada manualment (confiança alta).
//  2. «Released on: AAAA-MM-DD» de la descripció automàtica de YouTube (pistes Topic; confiança alta).
//  3. «℗ AAAA» de la descripció automàtica (any de la gravació segons el segell; confiança mitjana).

const MIN_YEAR = 1900;

function validYear(year, currentYear) {
  return Number.isInteger(year) && year >= MIN_YEAR && year <= currentYear + 1;
}

function extractOriginalYear(description, { currentYear = new Date().getUTCFullYear() } = {}) {
  const text = String(description || '');
  const released = text.match(/Released on\s*:\s*(\d{4})(?:-(\d{2})-(\d{2}))?/i);
  if (released) {
    const year = Number(released[1]);
    if (validYear(year, currentYear)) {
      const date = released[2] ? `${released[1]}-${released[2]}-${released[3]}` : null;
      return { year, date, source: 'released-on', confidence: 'alta' };
    }
  }
  const pLine = text.match(/℗\s*(?:\(P\)\s*)?(\d{4})/);
  if (pLine) {
    const year = Number(pLine[1]);
    if (validYear(year, currentYear)) return { year, date: null, source: 'p-line', confidence: 'mitjana' };
  }
  return null;
}

// Excepcions verificades per cançó (data/musica-dates.json).
function parseManualDates(payload) {
  const map = new Map();
  const songs = payload && typeof payload.songs === 'object' && payload.songs ? payload.songs : {};
  const currentYear = new Date().getUTCFullYear();
  for (const [id, entry] of Object.entries(songs)) {
    const year = Number(entry?.year);
    if (!id || !validYear(year, currentYear)) continue;
    map.set(id, { year, date: entry?.date || null, source: 'manual', confidence: 'alta' });
  }
  return map;
}

// Afegeix (o retira) els camps d'any original d'un vídeo. Retorna true si el vídeo ha canviat.
function stampOriginalYear(video, manualDates) {
  const evidence = manualDates?.get?.(video.id) || extractOriginalYear(video.description);
  const before = [video.originalYear, video.originalDate, video.originalYearSource, video.originalYearConfidence].join('|');
  delete video.originalYear;
  delete video.originalDate;
  delete video.originalYearSource;
  delete video.originalYearConfidence;
  if (evidence) {
    video.originalYear = evidence.year;
    if (evidence.date) video.originalDate = evidence.date;
    video.originalYearSource = evidence.source;
    video.originalYearConfidence = evidence.confidence;
  }
  const after = [video.originalYear, video.originalDate, video.originalYearSource, video.originalYearConfidence].join('|');
  return before !== after;
}

module.exports = { extractOriginalYear, parseManualDates, stampOriginalYear };
