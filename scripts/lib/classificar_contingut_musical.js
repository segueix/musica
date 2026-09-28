'use strict';

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' +&/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsAny(text, terms) {
  return terms.some(term => text.includes(term));
}

const NEGATIVE_TERMS = [
  'entrevista', 'interview', 'podcast', 'podcast', 'making of', 'making-of',
  'behind the scenes', 'backstage', 'teaser', 'trailer', 'documental', 'documentary',
  'roda de premsa', 'press conference', 'q&a', 'preguntes i respostes',
  'preguntas y respuestas', 'anunci', 'announcement', 'promocio', 'promocion',
  'promo ', 'vlog', 'tour diary', 'diari de gira', 'diario de gira',
  'reaccio', 'reaction', 'challenge', 'tiktok', 'instagram live', 'stream complet',
  'stream completo', 'streaming complet', 'assaig', 'rehearsal', 'soundcheck'
];

const ALBUM_TERMS = [
  'full album', 'album complet', 'album completo', 'disc complet', 'disco completo',
  'full ep', 'ep complet', 'ep completo', 'mixtape completa', 'mixtape complet'
];

const SONG_MARKERS = [
  'official audio', 'audio oficial', 'official video', 'video oficial',
  'official music video', 'videoclip oficial', 'videoclip', 'lyric video',
  'lyrics video', 'video lyrics', 'visualizer', 'visualiser', 'official lyric',
  'single oficial', 'nou single', 'nuevo single', 'new single'
];

const LIVE_MARKERS = [
  'live', 'en directe', 'en directo', 'acoustic', 'acustic', 'acustico',
  'acustica', 'sessio', 'session', 'live session'
];

const MUSIC_TAG_TERMS = [
  'music', 'musica', 'song', 'canco', 'cancion', 'single', 'album', 'ep',
  'rock', 'pop', 'rap', 'hip hop', 'indie', 'folk', 'reggae', 'ska',
  'electronic', 'electronica', 'jazz', 'blues', 'metal', 'punk'
];

function looksLikeArtistTrackTitle(title, artistNames) {
  const normalizedTitle = normalize(title);
  if (!normalizedTitle) return false;
  if (/[\-–—:]/.test(String(title || ''))) return true;
  return (artistNames || []).some(name => {
    const n = normalize(name);
    return n.length >= 4 && (normalizedTitle.startsWith(n + ' ') || normalizedTitle.includes(' ' + n + ' '));
  });
}

function classifyMusicContent({ item, channelMeta }) {
  const snippet = item?.snippet || {};
  const title = String(snippet.title || '');
  const description = String(snippet.description || '');
  const tags = Array.isArray(snippet.tags) ? snippet.tags : [];
  const titleText = normalize(title);
  const descriptionText = normalize(description.slice(0, 1200));
  const tagText = normalize(tags.join(' '));
  const text = normalize([title, description.slice(0, 1200), tags.join(' ')].join(' '));
  const durationSeconds = Number(item?.durationSeconds || 0);
  const categoryId = String(snippet.categoryId || '');
  const channelTypes = new Set((channelMeta?.types || []).map(v => normalize(v)));
  const artistNames = channelMeta?.artistNames || [];

  const topicChannel = channelTypes.has('topic') || /\s-\s*topic$/i.test(String(channelMeta?.channelTitle || ''));
  const providedToYoutube = /provided to youtube by/i.test(description);
  const negativeTitle = containsAny(titleText, NEGATIVE_TERMS);
  const strongNegativeDescription = containsAny(descriptionText, [
    'entrevista', 'interview', 'podcast', 'making of', 'making-of',
    'behind the scenes', 'backstage', 'documental', 'documentary',
    'roda de premsa', 'press conference', 'q&a'
  ]);
  const albumMarker = containsAny(titleText, ALBUM_TERMS) || containsAny(tagText, ALBUM_TERMS);
  const songMarker = containsAny(titleText, SONG_MARKERS) || containsAny(tagText, SONG_MARKERS);
  const liveMarker = containsAny(titleText, LIVE_MARKERS);
  const musicCategory = categoryId === '10';
  const musicTags = tags.some(tag => containsAny(normalize(tag), MUSIC_TAG_TERMS));
  const titlePattern = looksLikeArtistTrackTitle(title, artistNames);

  if (albumMarker && durationSeconds >= 600 && !negativeTitle) {
    return { accepted: true, contentType: 'album', confidence: 0.98, reason: 'àlbum/EP complet identificat' };
  }

  if (topicChannel || providedToYoutube) {
    if (negativeTitle && !songMarker) {
      return { accepted: false, contentType: 'other', confidence: 0.95, reason: 'contingut no musical explícit' };
    }
    return {
      accepted: true,
      contentType: liveMarker && durationSeconds >= 60 && durationSeconds <= 900 ? 'live_song' : 'song',
      confidence: 0.99,
      reason: topicChannel ? 'canal Topic de YouTube' : 'Provided to YouTube by'
    };
  }

  if (negativeTitle) {
    return { accepted: false, contentType: 'other', confidence: 0.96, reason: 'títol d’entrevista/podcast/promoció o contingut auxiliar' };
  }

  if (songMarker && durationSeconds >= 45 && durationSeconds <= 900) {
    return {
      accepted: true,
      contentType: liveMarker ? 'live_song' : 'song',
      confidence: 0.98,
      reason: 'marcador explícit de cançó/videoclip'
    };
  }

  if (strongNegativeDescription) {
    return { accepted: false, contentType: 'other', confidence: 0.94, reason: 'descripció inequívoca de contingut no musical' };
  }

  if (liveMarker && durationSeconds > 900) {
    return { accepted: false, contentType: 'other', confidence: 0.9, reason: 'concert o sessió llarga, no una sola cançó' };
  }

  if (liveMarker && titlePattern && durationSeconds >= 60 && durationSeconds <= 900) {
    return {
      accepted: true,
      contentType: 'live_song',
      confidence: 0.92,
      reason: 'títol de cançó + versió en directe/acústica'
    };
  }

  let score = 0;
  const reasons = [];
  if (musicCategory) { score += 45; reasons.push('categoria Music de YouTube'); }
  if (musicTags) { score += 20; reasons.push('tags musicals'); }
  if (titlePattern) { score += 20; reasons.push('títol amb patró artista/cançó'); }
  if (durationSeconds >= 90 && durationSeconds <= 600) { score += 20; reasons.push('durada pròpia d’una cançó'); }
  else if (durationSeconds >= 45 && durationSeconds <= 900) { score += 10; reasons.push('durada compatible'); }
  if (liveMarker && durationSeconds >= 60 && durationSeconds <= 900) { score += 10; reasons.push('versió en directe/acústica'); }

  if (durationSeconds < 45) {
    return { accepted: false, contentType: 'other', confidence: 0.85, reason: 'massa curt: probable teaser/fragment' };
  }

  if (score >= 75) {
    return {
      accepted: true,
      contentType: liveMarker ? 'live_song' : 'song',
      confidence: Math.min(0.94, 0.65 + score / 300),
      reason: reasons.join(' + ')
    };
  }

  return {
    accepted: false,
    contentType: 'review',
    confidence: Math.min(0.79, 0.4 + score / 200),
    reason: reasons.length ? reasons.join(' + ') : 'sense senyals musicals suficients'
  };
}

module.exports = { classifyMusicContent, normalize };
