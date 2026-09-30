// ==================== UTILITATS GLOBALS ====================
// Funcions pures sense dependències d'estat de l'aplicació.
// Carregat ABANS de app.js perquè tothom hi pugui accedir.

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function normalizeSearchText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function isMatch(text, query, forceExact = false) {
    if (!text || !query) return false;

    const normalizedQuery = String(query).trim();
    if (!normalizedQuery) return false;

    const hasQuotes = normalizedQuery.startsWith('"') && normalizedQuery.endsWith('"');
    const searchableText = normalizeSearchText(text);

    if (forceExact || hasQuotes) {
        const exactPhrase = hasQuotes ? normalizedQuery.slice(1, -1).trim() : normalizedQuery;
        const normalizedPhrase = normalizeSearchText(exactPhrase);
        if (!normalizedPhrase) return false;
        const escapedPhrase = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(escapedPhrase, 'i');
        return pattern.test(searchableText);
    } else {
        const normalizedTerm = normalizeSearchText(normalizedQuery);
        if (!normalizedTerm) return false;
        const escapedQuery = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`\\b${escapedQuery}\\b`, 'i');
        return pattern.test(searchableText);
    }
}

function getVideoDisplayDuration(video) {
    const durationSeconds = Number(video?.durationSeconds);
    if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
        const hours = Math.floor(durationSeconds / 3600);
        const minutes = Math.floor((durationSeconds % 3600) / 60);
        const seconds = durationSeconds % 60;
        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }

    const rawDuration = video?.duration || video?.contentDetails?.duration || '';
    if (!rawDuration || typeof rawDuration !== 'string') {
        return '';
    }
    if (!rawDuration.startsWith('PT')) {
        return rawDuration;
    }
    if (typeof YouTubeAPI?.parseDuration === 'function') {
        return YouTubeAPI.parseDuration(rawDuration);
    }
    const match = rawDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) {
        return '';
    }
    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Long-press per mòbil + dblclick per escriptori (eliminar categories)
function addLongPressOrDblClick(element, callback) {
    let pressTimer = null;
    let didLongPress = false;

    element.addEventListener('dblclick', e => {
        e.preventDefault();
        e.stopPropagation();
        callback(e);
    });

    element.addEventListener(
        'touchstart',
        e => {
            didLongPress = false;
            pressTimer = setTimeout(() => {
                didLongPress = true;
                if (navigator.vibrate) navigator.vibrate(30);
                callback(e);
            }, 500);
        },
        { passive: true }
    );

    element.addEventListener(
        'touchend',
        () => {
            clearTimeout(pressTimer);
        },
        { passive: true }
    );

    element.addEventListener(
        'touchmove',
        () => {
            clearTimeout(pressTimer);
        },
        { passive: true }
    );

    element.addEventListener(
        'touchcancel',
        () => {
            clearTimeout(pressTimer);
        },
        { passive: true }
    );
}

// Evita esborrats accidentals: calen 3 tocs/clics seguits per confirmar eliminació
function addTripleTapDeleteGuard(element, callback, options = {}) {
    if (!element || typeof callback !== 'function') {
        return;
    }

    const requiredTaps = Number.isFinite(options.requiredTaps) ? Math.max(2, Math.floor(options.requiredTaps)) : 3;
    const intervalMs = Number.isFinite(options.intervalMs) ? Math.max(250, Math.floor(options.intervalMs)) : 900;

    let tapCount = 0;
    let lastTapTs = 0;
    let resetTimer = null;

    const reset = () => {
        tapCount = 0;
        lastTapTs = 0;
        element.removeAttribute('data-delete-taps');
        if (resetTimer) {
            clearTimeout(resetTimer);
            resetTimer = null;
        }
    };

    const onTap = event => {
        const now = Date.now();
        if (now - lastTapTs > intervalMs) {
            tapCount = 0;
        }

        tapCount += 1;
        lastTapTs = now;
        element.setAttribute('data-delete-taps', String(tapCount));

        if (tapCount >= requiredTaps) {
            event.preventDefault();
            event.stopPropagation();
            reset();
            callback(event);
            return;
        }

        if (resetTimer) {
            clearTimeout(resetTimer);
        }
        resetTimer = setTimeout(reset, intervalMs);
    };

    element.addEventListener('click', onTap);
    element.addEventListener('touchmove', reset, { passive: true });
    element.addEventListener('touchcancel', reset, { passive: true });
    element.addEventListener('dragstart', reset, { passive: true });
}

// Gestió de no-scroll amb position: fixed (preserva posició de scroll)
let _noScrollY = 0;
function lockBodyScroll() {
    _noScrollY = window.scrollY || 0;
    document.body.style.top = `-${_noScrollY}px`;
    document.body.classList.add('no-scroll');
}
function unlockBodyScroll() {
    document.body.classList.remove('no-scroll');
    document.body.style.top = '';
    window.scrollTo(0, _noScrollY);
}

const DESKTOP_BREAKPOINT = 1024;

function isDesktopView() {
    return window.innerWidth > DESKTOP_BREAKPOINT;
}

function isMobileView() {
    return window.innerWidth <= 768;
}

function isAppleMobileDevice() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

function isIOSLikeDevice() {
    const userAgent = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const maxTouchPoints = Number(navigator.maxTouchPoints || 0);
    return /iPhone|iPad|iPod/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

function buildArchiveThumbnail(videoId) {
    const normalizedId = String(videoId || '').trim();
    if (!normalizedId) {
        return 'img/icon-192.png';
    }
    return `https://i.ytimg.com/vi/${encodeURIComponent(normalizedId)}/hqdefault.jpg`;
}

function getPreferredThumbnail(video) {
    return (
        video.thumbnail ||
        video.snippet?.thumbnails?.maxres?.url ||
        video.snippet?.thumbnails?.standard?.url ||
        video.snippet?.thumbnails?.high?.url ||
        video.snippet?.thumbnails?.medium?.url ||
        video.snippet?.thumbnails?.default?.url ||
        ''
    );
}

function isYouTubePremiumEnabled() {
    return localStorage.getItem(YOUTUBE_PREMIUM_STORAGE_KEY) === 'true';
}

function getYouTubeEmbedBaseUrl() {
    return isYouTubePremiumEnabled() ? 'https://www.youtube.com/embed/' : 'https://www.youtube-nocookie.com/embed/';
}

// Subtítols en català per defecte (opció de Configuració). Només es veuen si el vídeo en té.
function isCatalanCaptionsEnabled() {
    try {
        return localStorage.getItem(CAPTIONS_CA_STORAGE_KEY) === 'true';
    } catch (error) {
        return false;
    }
}

function applyYouTubeIframePolicy(iframe) {
    if (!iframe) return;

    const isPremium = isYouTubePremiumEnabled();
    iframe.setAttribute('referrerpolicy', isPremium ? 'origin-when-cross-origin' : 'strict-origin-when-cross-origin');
}

function buildYoutubeEmbedUrl(videoId, { startAt = 0 } = {}) {
    const safeStartAt = Math.max(0, Math.floor(Number(startAt) || 0));
    const params = new URLSearchParams({
        playsinline: '1',
        rel: '0',
        modestbranding: '1',
        autoplay: '1',
        enablejsapi: '1',
        origin: window.location.origin || '',
        hl: YouTubeAPI?.language || 'ca',
        cc_lang_pref: YouTubeAPI?.language || 'ca',
        cc_load_policy: isCatalanCaptionsEnabled() ? '1' : '0',
        gl: YouTubeAPI?.regionCode || 'AD',
    });

    if (safeStartAt > 0) {
        params.set('start', String(safeStartAt));
    }

    // A iPhone/iPad prioritzem mantenir l'àudio disponible.
    // Si Safari bloqueja l'autoplay, preferim que el vídeo requereixi toc abans que iniciar-lo mut.

    return `${getYouTubeEmbedBaseUrl()}${encodeURIComponent(videoId)}?${params.toString()}`;
}

// ==================== LUCIDE HELPER ====================
function refreshIcons(el) {
    if (typeof lucide === 'undefined') return;
    el ? lucide.createIcons({ el }) : lucide.createIcons();
}

// ==================== BATCH RENDERING ====================
// Renderitza elements en lots per no bloquejar el main thread
const BATCH_INITIAL = 12; // Primeres targetes visibles immediatament
const BATCH_SIZE = 20; // Lot incremental
const FEED_PAGE_SIZE = 32; // Màxim de targetes visibles abans de "Mostra'n més"

let _batchRenderAbort = null;

function batchRenderCards(container, items, createCardFn, options = {}) {
    // Avortar batch anterior si existeix
    if (_batchRenderAbort) {
        _batchRenderAbort.aborted = true;
    }
    const abort = { aborted: false };
    _batchRenderAbort = abort;

    const { prepend = '', onComplete = null, maxVisible = FEED_PAGE_SIZE } = options;

    // Limitar els ítems visibles inicialment
    const visibleItems = maxVisible > 0 ? items.slice(0, maxVisible) : items;
    const hiddenItems = maxVisible > 0 ? items.slice(maxVisible) : [];

    const initial = visibleItems.slice(0, BATCH_INITIAL);
    const rest = visibleItems.slice(BATCH_INITIAL);

    // Primer lot: immediat per feedback visual ràpid
    container.innerHTML = prepend + initial.map(createCardFn).join('');

    function finishBatch() {
        // Infinite scroll: carrega més vídeos quan l'usuari arriba al final
        if (hiddenItems.length > 0) {
            let totalLoaded = visibleItems.length;
            let loading = false;

            // Sentinella invisible al final del contenidor
            const sentinel = document.createElement('div');
            sentinel.className = 'feed-scroll-sentinel';
            sentinel.setAttribute('aria-hidden', 'true');
            container.appendChild(sentinel);

            const loadMore = () => {
                if (loading || abort.aborted) return;
                const next = items.slice(totalLoaded, totalLoaded + FEED_PAGE_SIZE);
                if (next.length === 0) {
                    observer.disconnect();
                    sentinel.remove();
                    return;
                }
                loading = true;
                sentinel.remove();

                const fragment = document.createRange().createContextualFragment(next.map(createCardFn).join(''));
                container.appendChild(fragment);
                totalLoaded += next.length;

                if (typeof refreshIcons === 'function') refreshIcons(container);

                if (totalLoaded < items.length) {
                    container.appendChild(sentinel);
                    loading = false;
                } else {
                    observer.disconnect();
                }
            };

            const observer = new IntersectionObserver(
                entries => {
                    if (entries[0].isIntersecting) loadMore();
                },
                { rootMargin: '0px 0px 400px 0px' }
            );

            observer.observe(sentinel);
        }
        onComplete?.();
    }

    if (rest.length === 0) {
        finishBatch();
        return;
    }

    // Lots incrementals sense bloquejar el main thread
    let offset = 0;
    function renderNextBatch() {
        if (abort.aborted) return;
        const batch = rest.slice(offset, offset + BATCH_SIZE);
        if (batch.length === 0) {
            finishBatch();
            return;
        }
        const fragment = document.createRange().createContextualFragment(batch.map(createCardFn).join(''));
        container.appendChild(fragment);
        offset += BATCH_SIZE;
        if (offset < rest.length) {
            if (typeof requestIdleCallback === 'function') {
                requestIdleCallback(() => renderNextBatch(), { timeout: 80 });
            } else {
                setTimeout(renderNextBatch, 16);
            }
        } else {
            finishBatch();
        }
    }

    // Defer primer batch addicional per deixar pintar el primer lot
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(() => renderNextBatch(), { timeout: 80 });
    } else {
        setTimeout(renderNextBatch, 16);
    }
}

// ========== VARIETAT PER ARTISTA ==========

// Clau d'artista d'un vídeo: el canal (grup) que el publica.
function getVideoArtistKey(video) {
    const channelId = video?.channelId || video?.snippet?.channelId || video?.sourceChannelId;
    // Identitat persistent de la base d'artistes: el canal oficial i el Topic d'un artista són el mateix.
    const identity =
        channelId && typeof window !== 'undefined' ? window.SegueixMusicCategories?.artistKeyForChannel?.(channelId) : '';
    const key = identity || channelId || video?.channelTitle || video?.snippet?.channelTitle;
    return String(key || '')
        .trim()
        .toLowerCase();
}

// Reordena la llista perquè no hi hagi dos vídeos seguits del mateix artista.
// Conserva l'ordre original tant com és possible: a cada posició pren el primer
// vídeo (dins una finestra de cerca) que no coincideix amb l'artista anterior.
// `previousArtist` permet enllaçar amb un element que ja hi ha just abans (p. ex. "Ara sona").
// Si no queda cap alternativa (tot és del mateix artista) es manté l'ordre.
function spreadVideosByArtist(videos, { previousArtist = '', window: lookahead = 60 } = {}) {
    if (!Array.isArray(videos) || videos.length < 2) return Array.isArray(videos) ? videos : [];
    const remaining = videos.slice();
    const counts = new Map();
    remaining.forEach(video => {
        const key = getVideoArtistKey(video);
        counts.set(key, (counts.get(key) || 0) + 1);
    });
    const result = [];
    let last = String(previousArtist || '')
        .trim()
        .toLowerCase();
    while (remaining.length > 0) {
        // Un artista amb més de la meitat del que queda s'ha de col·locar ara (si no, acabaria enganxat).
        let forced = null;
        counts.forEach((count, key) => {
            if (key && key !== last && count * 2 > remaining.length) forced = key;
        });
        let pick = -1;
        if (forced) pick = remaining.findIndex(video => getVideoArtistKey(video) === forced);
        if (pick < 0) {
            const limit = Math.min(remaining.length, lookahead);
            for (let i = 0; i < limit; i++) {
                const key = getVideoArtistKey(remaining[i]);
                if (!key || key !== last) {
                    pick = i;
                    break;
                }
            }
        }
        if (pick < 0) pick = 0;
        const [item] = remaining.splice(pick, 1);
        result.push(item);
        last = getVideoArtistKey(item);
        counts.set(last, counts.get(last) - 1);
    }
    return result;
}

// ========== MÚSICA ANTIGA ==========

// La música realment antiga (artistes clàssics o vídeos de fa 8+ anys, veure
// SegueixMusicCategories.isClassicVideo) no ha de barrejar-se amb la dels darrers anys amb la mateixa
// freqüència: com a molt 1 de cada `every` elements. Conserva l'ordre relatiu de cada grup; quan es
// gasten els moderns, els antics que queden van al final.
function limitClassicFrequency(videos, { every = 5, isClassic = null } = {}) {
    if (!Array.isArray(videos) || videos.length < 2) return Array.isArray(videos) ? videos : [];
    const test =
        isClassic ||
        (typeof window !== 'undefined' && window.SegueixMusicCategories?.isClassicVideo
            ? video => window.SegueixMusicCategories.isClassicVideo(video)
            : () => false);
    const modern = [];
    const classic = [];
    videos.forEach(video => (test(video) ? classic : modern).push(video));
    if (classic.length === 0 || modern.length === 0) return videos;
    const gap = Math.max(1, every - 1);
    const result = [];
    let nextClassic = 0;
    modern.forEach((video, index) => {
        result.push(video);
        if ((index + 1) % gap === 0 && nextClassic < classic.length) result.push(classic[nextClassic++]);
    });
    return result.concat(classic.slice(nextClassic));
}

// ========== SELECCIÓ MUSICAL COMPARTIDA ==========

// Antiguitat real (evidència d'any original > llista d'artistes antics > data de pujada) amb el motor de
// selecció; sense el motor (o amb `engine: 'legacy'`) es manté el criteri anterior d'isClassicVideo().
function isHistoricVideo(video) {
    const selection = typeof window !== 'undefined' ? window.SegueixApp?.features?.musicSelection : null;
    if (selection?.isEnabled?.()) {
        try {
            const music = window.SegueixMusicCategories;
            return (
                selection.eraOf(video, {
                    isClassicArtist: music?.isClassicArtistVideo ? item => music.isClassicArtistVideo(item) : null,
                }).tier === 'historic'
            );
        } catch (error) {
            // Segueix amb el criteri anterior
        }
    }
    return Boolean(typeof window !== 'undefined' && window.SegueixMusicCategories?.isClassicVideo?.(video));
}

// Resultat FINAL d'una llista: límits d'antiguitat i d'artista aplicats una sola vegada, després de totes les
// altres ordenacions (una segona reordenació no els pot desfer). Sense el motor, l'alternança anterior.
function arrangeMusicList(videos, options = {}) {
    const list = Array.isArray(videos) ? videos : [];
    const selection = typeof window !== 'undefined' ? window.SegueixApp?.features?.musicSelection : null;
    if (selection?.isEnabled?.() && list.length > 1) {
        try {
            let feed = [];
            try {
                feed = typeof currentFeedVideos !== 'undefined' && Array.isArray(currentFeedVideos) ? currentFeedVideos : [];
            } catch (error) {
                feed = [];
            }
            const ctx = selection.getAppContext(feed.length ? feed : list);
            const signals = window.SegueixApp?.features?.musicSignals?.snapshot?.() || undefined;
            const preceding = options.previousVideo ? [options.previousVideo] : [];
            return selection.arrange(list, { ctx, signals, preceding });
        } catch (error) {
            console.warn('No s’ha pogut aplicar el motor de selecció:', error);
        }
    }
    return spreadVideosByArtist(limitClassicFrequency(list, { every: options.every || 5 }), {
        previousArtist: options.previousArtist || '',
    });
}
