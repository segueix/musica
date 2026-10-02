'use strict';

// Aprima els vídeos de data/feed.json abans d'escriure'l. El feed es baixa sencer a cada client i les descripcions de
// YouTube n'eren una part molt important del pes. El generador fa servir la descripció sencera abans d'aprimar
// (any original, subtítols, suport i classificació); al feed públic s'elimina completament.
// L'única dada derivada que necessita el client és topicTrack=true per detectar pistes «Provided to YouTube».

const DESCRIPTION_LIMIT = 300;
// Marca de descripció retallada: fa que aprimar sigui idempotent (no es torna a retallar).
const CUT_MARK = ' […]';
// Línies que cal conservar encara que siguin més avall: en surt l'any original (scripts/lib/any_original_musical.js).
const KEEP_LINE_RE = /Released on\s*:|℗/i;
const MAX_KEPT_LINES = 3;
const MAX_KEPT_LINE_LENGTH = 120;
// L'únic motiu del classificador que llegeix el client (home-sections.isOfficialClip).
const CLIENT_REASON_RE = /marcador expl[ií]cit/i;

function cutAtBoundary(text, limit) {
    const slice = text.slice(0, limit);
    const minimum = Math.floor(limit * 0.7);
    const newline = slice.lastIndexOf('\n');
    if (newline >= minimum) return slice.slice(0, newline).trimEnd();
    const space = slice.lastIndexOf(' ');
    if (space >= minimum) return slice.slice(0, space).trimEnd();
    return slice.trimEnd();
}

function shortDescription(value, limit = DESCRIPTION_LIMIT) {
    const text = String(value || '');
    if (text.length <= limit) return text;
    const marked = text.indexOf(CUT_MARK);
    if (marked !== -1 && marked <= limit) return text;
    const head = cutAtBoundary(text, limit - CUT_MARK.length);
    const kept = text
        .slice(head.length)
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && KEEP_LINE_RE.test(line))
        .slice(0, MAX_KEPT_LINES)
        .map(line => line.slice(0, MAX_KEPT_LINE_LENGTH));
    return [head + CUT_MARK, ...kept].join('\n');
}

function slimFeedVideo(video) {
    if (!video || typeof video !== 'object') return video;
    const slim = { ...video };
    const description = String(slim.description || '');
    if (/^\s*provided to youtube by/i.test(description)) slim.topicTrack = true;
    delete slim.description;
    if (slim.sourceChannelId && slim.sourceChannelId === slim.channelId) delete slim.sourceChannelId;
    if ('musicReason' in slim && !CLIENT_REASON_RE.test(String(slim.musicReason || ''))) delete slim.musicReason;
    if (!slim.liveBroadcastContent || slim.liveBroadcastContent === 'none') delete slim.liveBroadcastContent;
    if (!slim.defaultAudioLanguage) delete slim.defaultAudioLanguage;
    if (!slim.defaultLanguage) delete slim.defaultLanguage;
    return slim;
}

function slimFeed(feed) {
    return { ...feed, videos: (feed?.videos || []).map(slimFeedVideo) };
}

// JSON del feed amb un vídeo per línia: sense el sagnat de JSON.stringify(…, null, 2) (una cinquena part del pes)
// però amb diffs de git llegibles (cada vídeo que canvia és una línia).
function serializeFeed(feed) {
    const entries = Object.entries(feed || {}).map(([key, value]) => {
        if (key === 'videos' && Array.isArray(value)) {
            const lines = value.map(video => `    ${JSON.stringify(video)}`).join(',\n');
            return `  ${JSON.stringify(key)}: [${value.length ? `\n${lines}\n  ` : ''}]`;
        }
        return `  ${JSON.stringify(key)}: ${JSON.stringify(value, null, 2).replace(/\n/g, '\n  ')}`;
    });
    return `{\n${entries.join(',\n')}\n}\n`;
}

module.exports = { DESCRIPTION_LIMIT, CUT_MARK, shortDescription, slimFeedVideo, slimFeed, serializeFeed };
