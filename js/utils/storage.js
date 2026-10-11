// ==================== CONSTANTS D'EMMAGATZEMATGE ====================
// Claus de localStorage i constants de configuració.
// Carregat ABANS de app.js perquè tothom hi pugui accedir.

// Claus principals
const LAST_CATEGORY_STORAGE_KEY = 'catube_last_category';
const VIEW_STATE_STORAGE_KEY = 'catube_view_state';
const HISTORY_STORAGE_KEY = 'catube_history';
const HISTORY_LIMIT = 50;
const PLAYLIST_STORAGE_KEY = 'catube_playlists';
const FOLLOW_STORAGE_KEY = 'catube_follows';
const HIDDEN_CHANNELS_STORAGE_KEY = 'catube_hidden_channels';
const CHIPS_ORDER_STORAGE_KEY = 'catube_chip_order';
const CUSTOM_TAGS_STORAGE_KEY = 'catube_custom_tags';
const GRID_LAYOUT_STORAGE_KEY = 'catube_grid_layout';
const WATCH_GRID_LAYOUT_STORAGE_KEY = 'catube_watch_grid_layout';
const CHANNEL_CUSTOM_CATEGORIES_KEY = 'catube_channel_custom_categories';
const CHIPS_HTML_CACHE_KEY = 'catube_chips_html_cache';
const PROGRAMS_STORAGE_KEY = 'catube_programs';
const CATEGORY_KEYWORDS_STORAGE_KEY = 'catube_category_keywords';
const DEFAULTS_VERSION_KEY = 'catube_defaults_v1';
const DEFAULTS_VERSION_VALUE = '10';
const WATCH_SIDEBAR_VIDEOS_LIMIT = 55;
const CONTINUE_WATCHING_STORAGE_KEY = 'catube_continue_watching_v1';
const CONTINUE_WATCHING_LIMIT = 30;
const CONTINUE_WATCHING_MIN_SECONDS = 30;
const CONTINUE_WATCHING_COMPLETE_RATIO = 0.95;

const DEFAULT_PROGRAMS = [
    {
        id: 'prog_mn0tv3bw_mlop',
        channelId: 'UC-Z3S_8M0LEm3LiH7OiOjGQ',
        name: 'A flor de pell',
        description: 'Vlog molt personal.',
        createdAt: 1774127763356,
        customCategories: []
    },
    {
        id: 'prog_mn0txcn8_yc55',
        channelId: 'UCaYXWVFYirJdDmprjozHdmA',
        name: "La Tertúlia Proscrita",
        description: "Tertúlia d'actualitat política de Vilaweb.",
        createdAt: 1774127868740,
        customCategories: []
    },
    {
        id: 'prog_mn0ty7em_jmtc',
        channelId: 'UCSfMEzJX9i4-3Xl6KFv3DAA',
        name: 'Polònia',
        description: "Programa de sàtira política del 3Cat.",
        createdAt: 1774127908606,
        customCategories: []
    }
];

function safeParsePrograms(rawValue) {
    if (!rawValue) return [];
    if (Array.isArray(rawValue)) return rawValue;
    try {
        const parsed = JSON.parse(rawValue);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function mergeDefaultPrograms(existingPrograms) {
    const current = safeParsePrograms(existingPrograms);
    const seen = new Set(current.map(program => program && program.id).filter(Boolean));
    const merged = [...current];

    for (const program of DEFAULT_PROGRAMS) {
        if (!seen.has(program.id)) {
            merged.push(program);
            seen.add(program.id);
        }
    }

    return merged;
}

// Neteja definitiva de categories heretades de Segueix que no pertanyen a Segueix Música.
function removeLegacyMusicCategories() {
    const migrationKey = 'catube_music_remove_legacy_channels_v1';
    if (localStorage.getItem(migrationKey) === '1') return;

    const normalize = value =>
        String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .replace(/^"(.*)"$/, '$1')
            .toLowerCase();

    const removed = new Set(['canal jove', 'canal historia']);
    const keep = value => !removed.has(normalize(value));

    try {
        const tags = JSON.parse(localStorage.getItem(CUSTOM_TAGS_STORAGE_KEY) || '[]');
        if (Array.isArray(tags)) {
            localStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(tags.filter(keep)));
        }
    } catch (_) {}

    try {
        const categories = JSON.parse(localStorage.getItem(CHANNEL_CUSTOM_CATEGORIES_KEY) || '{}');
        if (categories && typeof categories === 'object') {
            for (const [channelId, values] of Object.entries(categories)) {
                if (!Array.isArray(values)) continue;
                const filtered = values.filter(keep);
                if (filtered.length) categories[channelId] = filtered;
                else delete categories[channelId];
            }
            localStorage.setItem(CHANNEL_CUSTOM_CATEGORIES_KEY, JSON.stringify(categories));
        }
    } catch (_) {}

    try {
        const order = JSON.parse(localStorage.getItem(CHIPS_ORDER_STORAGE_KEY) || '[]');
        if (Array.isArray(order)) {
            localStorage.setItem(CHIPS_ORDER_STORAGE_KEY, JSON.stringify(order.filter(keep)));
        }
    } catch (_) {}

    for (const key of [CATEGORY_KEYWORDS_STORAGE_KEY]) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || '{}');
            if (Array.isArray(value)) {
                localStorage.setItem(key, JSON.stringify(value.filter(keep)));
            } else if (value && typeof value === 'object') {
                for (const name of Object.keys(value)) {
                    if (!keep(name)) delete value[name];
                }
                localStorage.setItem(key, JSON.stringify(value));
            }
        } catch (_) {}
    }

    localStorage.removeItem(CHIPS_HTML_CACHE_KEY);
    localStorage.setItem(migrationKey, '1');
}

removeLegacyMusicCategories();

// «Urbana» passa a dir-se «Urban» i va primer: es renomenen les preferències desades i es refà l'ordre dels xips
// (l'ordre desat es reescriu a cada render, i si no es buidés el nou ordre no arribaria mai).
function renameUrbanaCategory() {
    const migrationKey = 'catube_music_urban_v1';
    try {
        if (localStorage.getItem(migrationKey) === '1') return;
        const rename = value => (String(value || '').trim().toLowerCase() === 'urbana' ? 'Urban' : value);
        if (String(localStorage.getItem(LAST_CATEGORY_STORAGE_KEY) || '').toLowerCase() === 'urbana') {
            localStorage.setItem(LAST_CATEGORY_STORAGE_KEY, 'Urban');
        }
        const firstStyles = JSON.parse(localStorage.getItem('catube_first_styles') || 'null');
        if (Array.isArray(firstStyles)) {
            localStorage.setItem('catube_first_styles', JSON.stringify(firstStyles.map(rename)));
        }
        const lastRadio = JSON.parse(localStorage.getItem('catube_last_radio') || 'null');
        if (lastRadio && typeof lastRadio.category === 'string') {
            lastRadio.category = lastRadio.category.split('|').map(rename).join('|');
            localStorage.setItem('catube_last_radio', JSON.stringify(lastRadio));
        }
        localStorage.removeItem(CHIPS_ORDER_STORAGE_KEY);
        localStorage.removeItem(CHIPS_HTML_CACHE_KEY);
        localStorage.setItem(migrationKey, '1');
    } catch (_) {
        /* sense emmagatzematge: no hi ha res a migrar */
    }
}

renameUrbanaCategory();

// La preferència conjunta es conserva com dues preferències independents.
function splitPunkMetalPreferences() {
    const key = 'catube_split_punk_metal_v1';
    try {
        if (localStorage.getItem(key)) return;
        const expand = values => [...new Set(values.flatMap(value =>
            value === 'Punk / Metal' ? ['Punk', 'Heavy / Metal'] : [value]))];
        if (localStorage.getItem(LAST_CATEGORY_STORAGE_KEY) === 'Punk / Metal') {
            localStorage.setItem(LAST_CATEGORY_STORAGE_KEY, 'Novetats');
        }
        const view = JSON.parse(localStorage.getItem(VIEW_STATE_STORAGE_KEY) || 'null');
        if (view?.selectedCategory === 'Punk / Metal') {
            view.selectedCategory = 'Novetats';
            localStorage.setItem(VIEW_STATE_STORAGE_KEY, JSON.stringify(view));
        }
        const styles = JSON.parse(localStorage.getItem('catube_first_styles') || 'null');
        if (Array.isArray(styles)) localStorage.setItem('catube_first_styles', JSON.stringify(expand(styles)));
        const radio = JSON.parse(localStorage.getItem('catube_last_radio') || 'null');
        if (typeof radio?.category === 'string') {
            radio.category = expand(radio.category.split('|')).join('|');
            localStorage.setItem('catube_last_radio', JSON.stringify(radio));
        }
        localStorage.removeItem(CHIPS_ORDER_STORAGE_KEY);
        localStorage.removeItem(CHIPS_HTML_CACHE_KEY);
        localStorage.setItem(key, '1');
    } catch (_) { /* Emmagatzematge no disponible. */ }
}
splitPunkMetalPreferences();

// Configuració visual
const BACKGROUND_STORAGE_KEY = 'catube_background_color';
const FONT_SIZE_STORAGE_KEY = 'catube_font_size';
const BACKGROUND_COLORS = [
    '#141615',
    '#121212',
    '#333333',
    '#3d3d3d',
    '#224262',
    '#33533d',
    '#5a3f29',
    '#513359'
];

const BUTTON_COLOR_STORAGE_KEY = 'catube_button_color';
// Color dels botons: fix (el de la marca). Ja no es tria a la configuració.
const BUTTON_COLORS = ['#2B302C'];

const LUCKY_STORAGE_KEY = 'catube_lucky_mode';
const YOUTUBE_PREMIUM_STORAGE_KEY = 'iutube_is_premium';
const CAPTIONS_CA_STORAGE_KEY = 'catube_captions_ca';

// Paleta ampliada de colors foscos per al mode "Sempre tinc sort"
const LUCKY_BG_COLORS = [
    '#333333', '#3d3d3d', '#224262', '#33533d', '#5a3f29', '#513359',
    '#2d2d44', '#3b2a2a', '#1e3a3a', '#3d3422', '#2a3d1e', '#44293d',
    '#1f2d3d', '#3d2d1f', '#2d1f3d', '#1f3d2d', '#3a2222', '#22333a'
];

// Identitat de client local
const API_CLIENT_KEY_STORAGE_KEY = 'catube_api_client_key';

function getOrCreateApiClientKey() {
    let key = localStorage.getItem(API_CLIENT_KEY_STORAGE_KEY);
    if (key) return key;
    key = `ck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(API_CLIENT_KEY_STORAGE_KEY, key);
    return key;
}

// ==================== CACHE DEL FEED ====================
const FEED_CACHE_KEY = 'catube_feed_v1';
const FEED_CACHE_TTL = 25 * 60 * 1000; // 25 minuts
const CAT_SEARCH_CACHE_PREFIX = 'catube_cat_';
const CAT_SEARCH_CACHE_TTL = 60 * 60 * 1000; // 1 hora
const ARCHIVE_INDEX_CACHE_KEY = 'catube_archive_idx_v1';
const ARCHIVE_INDEX_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hores
const ARCHIVE_INDEX_CACHE_MAX_ITEMS = 2500;
const ARCHIVE_INDEX_CACHE_MAX_CHARS = 900000; // ~0.9MB JSON màxim al localStorage

function saveFeedCache(videos, channels) {
    // Diferir serialització JSON + escriptura localStorage fora del fil principal
    const videosCopy = videos.slice(0, 80);
    const channelsCopy = { ...channels };
    (requestIdleCallback || setTimeout)(() => {
        try {
            localStorage.setItem(FEED_CACHE_KEY, JSON.stringify({
                videos: videosCopy,
                channels: channelsCopy,
                ts: Date.now()
            }));
        } catch (_) {}
    });
}

function loadFeedCache() {
    try {
        const raw = localStorage.getItem(FEED_CACHE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || Date.now() - data.ts > FEED_CACHE_TTL) return null;
        return data;
    } catch (_) { return null; }
}

function saveCategorySearchCache(key, videos) {
    const videosCopy = videos.slice(0, 60);
    (requestIdleCallback || setTimeout)(() => {
        try {
            localStorage.setItem(CAT_SEARCH_CACHE_PREFIX + key, JSON.stringify({
                videos: videosCopy,
                ts: Date.now()
            }));
        } catch (_) {}
    });
}

function loadCategorySearchCache(key) {
    try {
        const raw = localStorage.getItem(CAT_SEARCH_CACHE_PREFIX + key);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || Date.now() - data.ts > CAT_SEARCH_CACHE_TTL) return null;
        return Array.isArray(data.videos) ? data.videos : null;
    } catch (_) { return null; }
}

// ==================== CONTINUA MIRANT ====================
function normalizeContinueWatchingThumbnail(value) {
    const thumbnail = String(value || '').trim().slice(0, 1000);
    if (!thumbnail) return '';
    if (/^data:image\//i.test(thumbnail)) return thumbnail;
    if (/^blob:/i.test(thumbnail)) return '';

    const withoutQuery = thumbnail.split(/[?#]/, 1)[0];
    const hasImageExtension = /\.(?:png|jpe?g|webp|gif|svg)$/i.test(withoutQuery);
    const knownImageHost = /^https?:\/\/[^/]*(?:ytimg\.com|ggpht\.com|googleusercontent\.com)\//i.test(thumbnail);

    return hasImageExtension || knownImageHost ? thumbnail : '';
}

function normalizeContinueWatchingEntry(entry) {
    if (!entry || typeof entry !== 'object' || entry.isShort === true || entry.isLive === true) return null;

    const id = String(entry.id || entry.videoId || '').trim();
    const position = Math.max(0, Math.floor(Number(entry.position) || 0));
    const duration = Math.max(0, Math.floor(Number(entry.duration) || 0));
    const updatedAt = Number(entry.updatedAt) || 0;

    if (!id || position < CONTINUE_WATCHING_MIN_SECONDS || !updatedAt) return null;
    if (duration > 0 && position / duration >= CONTINUE_WATCHING_COMPLETE_RATIO) return null;

    return {
        id,
        position,
        duration,
        updatedAt,
        title: String(entry.title || '').trim().slice(0, 300),
        channel: String(entry.channel || entry.channelTitle || '').trim().slice(0, 200),
        thumbnail: normalizeContinueWatchingThumbnail(entry.thumbnail),
        source: entry.source === 'static' ? 'static' : 'api',
    };
}

function loadContinueWatchingEntries() {
    try {
        const raw = localStorage.getItem(CONTINUE_WATCHING_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        const source = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.entries) ? parsed.entries : [];
        const byId = new Map();

        source.forEach(rawEntry => {
            const entry = normalizeContinueWatchingEntry(rawEntry);
            if (!entry) return;

            if (!entry.thumbnail || !entry.title || !entry.channel) {
                const historyMetadata = getContinueWatchingHistoryMetadata(entry.id);
                if (!entry.thumbnail) entry.thumbnail = normalizeContinueWatchingThumbnail(historyMetadata.thumbnail);
                if (!entry.title) entry.title = String(historyMetadata.title || '').trim().slice(0, 300);
                if (!entry.channel) entry.channel = String(historyMetadata.channel || '').trim().slice(0, 200);
            }

            const previous = byId.get(entry.id);
            if (!previous || entry.updatedAt > previous.updatedAt) byId.set(entry.id, entry);
        });

        return Array.from(byId.values())
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, CONTINUE_WATCHING_LIMIT);
    } catch (_) {
        return [];
    }
}

function saveContinueWatchingEntries(entries) {
    try {
        const normalized = (Array.isArray(entries) ? entries : [])
            .map(normalizeContinueWatchingEntry)
            .filter(Boolean)
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, CONTINUE_WATCHING_LIMIT);
        localStorage.setItem(CONTINUE_WATCHING_STORAGE_KEY, JSON.stringify(normalized));
        return true;
    } catch (_) {
        return false;
    }
}

function getContinueWatchingEntry(videoId) {
    const id = String(videoId || '').trim();
    if (!id) return null;
    return loadContinueWatchingEntries().find(entry => entry.id === id) || null;
}

function getContinueWatchingHistoryMetadata(videoId) {
    const id = String(videoId || '').trim();
    if (!id) return {};
    try {
        const history = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
        if (!Array.isArray(history)) return {};
        const video = history.find(item => String(item?.id || '') === id);
        if (!video) return {};
        const liveStatus = video.liveBroadcastContent || video.snippet?.liveBroadcastContent || '';
        return {
            title: video.title || video.snippet?.title || '',
            channel: video.channelTitle || video.snippet?.channelTitle || video.channel || '',
            thumbnail:
                video.thumbnail ||
                video.thumbnailUrl ||
                video.thumbnails?.maxres?.url ||
                video.thumbnails?.high?.url ||
                video.thumbnails?.medium?.url ||
                video.snippet?.thumbnails?.maxres?.url ||
                video.snippet?.thumbnails?.high?.url ||
                video.snippet?.thumbnails?.medium?.url ||
                video.snippet?.thumbnails?.default?.url ||
                '',
            source: video.historySource === 'static' ? 'static' : 'api',
            isShort: video.isShort === true,
            isLive: video.isLive === true || liveStatus === 'live',
        };
    } catch (_) {
        return {};
    }
}

function removeContinueWatchingEntry(videoId) {
    const id = String(videoId || '').trim();
    if (!id) return false;
    const entries = loadContinueWatchingEntries();
    const next = entries.filter(entry => entry.id !== id);
    if (next.length === entries.length) return true;
    return saveContinueWatchingEntries(next);
}

function clearContinueWatchingEntries() {
    try {
        localStorage.removeItem(CONTINUE_WATCHING_STORAGE_KEY);
        return true;
    } catch (_) {
        return false;
    }
}

function upsertContinueWatchingEntry(rawEntry) {
    if (!rawEntry || typeof rawEntry !== 'object') return false;
    const id = String(rawEntry.id || rawEntry.videoId || '').trim();
    const position = Math.max(0, Math.floor(Number(rawEntry.position) || 0));
    const duration = Math.max(0, Math.floor(Number(rawEntry.duration) || 0));

    if (!id) return false;
    if (duration > 0 && position / duration >= CONTINUE_WATCHING_COMPLETE_RATIO) {
        return removeContinueWatchingEntry(id);
    }
    if (position < CONTINUE_WATCHING_MIN_SECONDS) return false;

    const existing = getContinueWatchingEntry(id) || {};
    const historyMetadata = getContinueWatchingHistoryMetadata(id);
    if (rawEntry.isShort === true || rawEntry.isLive === true || historyMetadata.isShort || historyMetadata.isLive) {
        removeContinueWatchingEntry(id);
        return false;
    }

    const entry = normalizeContinueWatchingEntry({
        ...existing,
        ...rawEntry,
        id,
        position,
        duration,
        updatedAt: Number(rawEntry.updatedAt) || Date.now(),
        title: rawEntry.title || existing.title || historyMetadata.title || '',
        channel: rawEntry.channel || rawEntry.channelTitle || existing.channel || historyMetadata.channel || '',
        thumbnail:
            normalizeContinueWatchingThumbnail(rawEntry.thumbnail) ||
            normalizeContinueWatchingThumbnail(historyMetadata.thumbnail) ||
            normalizeContinueWatchingThumbnail(existing.thumbnail) ||
            '',
        source: rawEntry.source || existing.source || historyMetadata.source || 'api',
    });
    if (!entry) return false;

    const next = loadContinueWatchingEntries().filter(item => item.id !== id);
    next.unshift(entry);
    return saveContinueWatchingEntries(next);
}

if (typeof window !== 'undefined') {
    window.SegueixApp = window.SegueixApp || {};
    window.SegueixApp.utils = window.SegueixApp.utils || {};
    window.SegueixApp.utils.continueWatchingStorage = {
        key: CONTINUE_WATCHING_STORAGE_KEY,
        limit: CONTINUE_WATCHING_LIMIT,
        minSeconds: CONTINUE_WATCHING_MIN_SECONDS,
        completeRatio: CONTINUE_WATCHING_COMPLETE_RATIO,
        normalizeEntry: normalizeContinueWatchingEntry,
        load: loadContinueWatchingEntries,
        save: saveContinueWatchingEntries,
        get: getContinueWatchingEntry,
        upsert: upsertContinueWatchingEntry,
        remove: removeContinueWatchingEntry,
        clear: clearContinueWatchingEntries,
    };
}
