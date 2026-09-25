export const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function slugifyVideoTitle(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 96)
    .replace(/-+$/g, '');
}

export function videoKey(video) {
  const id = String(video?.id || '').trim();
  if (!VIDEO_ID_PATTERN.test(id)) return '';
  const slug = slugifyVideoTitle(video?.title) || 'video';
  return `${slug}-${id}`;
}

export function videoUrl(video, siteUrl = 'https://segueix.cat') {
  const key = videoKey(video);
  if (!key) return '';
  return `${String(siteUrl).replace(/\/$/, '')}/video/${encodeURIComponent(key)}`;
}

export function resolveVideoParam(param) {
  let raw = String(param || '').trim();
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // Conservem el valor original si l'URL no és decodificable.
  }

  if (VIDEO_ID_PATTERN.test(raw)) {
    return { videoId: raw, legacyId: true, raw };
  }

  const match = raw.match(/^.+-([A-Za-z0-9_-]{11})$/);
  if (!match) return { videoId: '', legacyId: false, raw };

  return { videoId: match[1], legacyId: false, raw };
}
