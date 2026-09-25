export const CHANNEL_ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

function hashChannelId(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0').slice(0, 7);
}

export function slugifyCreatorName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 72)
    .replace(/-+$/g, '');
}

export function buildCreatorRecords(channels) {
  const uniqueById = new Map();
  for (const channel of Array.isArray(channels) ? channels : []) {
    const id = String(channel?.id || '').trim();
    if (!CHANNEL_ID_PATTERN.test(id) || uniqueById.has(id)) continue;
    uniqueById.set(id, channel);
  }

  const prepared = [...uniqueById.entries()].map(([id, channel]) => {
    const name = String(channel?.name || '').trim() || 'Creador';
    const baseSlug = slugifyCreatorName(name) || `creador-${hashChannelId(id)}`;
    return { ...channel, id, name, baseSlug };
  });

  const counts = new Map();
  for (const creator of prepared) {
    counts.set(creator.baseSlug, (counts.get(creator.baseSlug) || 0) + 1);
  }

  const used = new Set();
  return prepared.map((creator) => {
    let slug = creator.baseSlug;
    if ((counts.get(creator.baseSlug) || 0) > 1) {
      slug = `${creator.baseSlug}-${hashChannelId(creator.id)}`;
    }
    if (used.has(slug)) {
      slug = `${creator.baseSlug}-${hashChannelId(creator.id)}-${creator.id.slice(-4).toLowerCase()}`;
    }
    used.add(slug);
    const { baseSlug, ...record } = creator;
    return { ...record, slug };
  });
}

export function resolveCreatorParam(param, channels) {
  let raw = String(param || '').trim();
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // Mantenim el valor original si l'URL no és decodificable.
  }

  const creators = buildCreatorRecords(channels);
  const byId = creators.find((creator) => creator.id === raw);
  if (byId) return { creator: byId, legacyId: true, creators };

  const normalizedSlug = raw.toLowerCase();
  const bySlug = creators.find((creator) => creator.slug === normalizedSlug);
  return { creator: bySlug || null, legacyId: false, creators };
}

export function creatorUrl(creator, siteUrl = 'https://segueix.cat') {
  return `${String(siteUrl).replace(/\/$/, '')}/creador/${encodeURIComponent(creator.slug)}`;
}
