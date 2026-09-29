// App Principal

const SegueixApp = window.SegueixApp || (window.SegueixApp = {});
SegueixApp.state = SegueixApp.state || {};
SegueixApp.dom = SegueixApp.dom || {};
SegueixApp.features = SegueixApp.features || {};
SegueixApp.utils = SegueixApp.utils || {};

function ensureSegueixAppStateSections() {
    const currentState = SegueixApp.state && typeof SegueixApp.state === 'object' ? SegueixApp.state : {};
    SegueixApp.state = currentState;

    SegueixApp.state.navigation = SegueixApp.state.navigation || {};
    SegueixApp.state.feed = SegueixApp.state.feed || {};
    SegueixApp.state.channel = SegueixApp.state.channel || {};
    SegueixApp.state.playlists = SegueixApp.state.playlists || {};
    SegueixApp.state.history = SegueixApp.state.history || {};
    SegueixApp.state.search = SegueixApp.state.search || {};
    SegueixApp.state.player = SegueixApp.state.player || {};
    SegueixApp.state.shorts = SegueixApp.state.shorts || {};
}

// Elements del DOM
let sidebar, menuBtn, videosGrid, homePage, watchPage, loading, mainContent;
let historyPage, historyGrid, historyFilters, chipsBar;
let customCategoryModal, customCategoryInput, customCategoryAddBtn, customCategoryModalClose;
let isCustomCategoryModalScrollLocked = false;
let categoryKeywordsModal, categoryKeywordInput, categoryKeywordAddBtn, categoryKeywordsModalClose;
let categoryKeywordsModalName, categoryKeywordsList;
let categoryKeywordsCurrentCategory = null;
let isCategoryKeywordsModalScrollLocked = false;
let playlistsPage, playlistsList, playlistNameInput, createPlaylistBtn, smartCategoriesList, libraryTabs;
let activeLibraryTab = 'playlists';
let followPage, followGrid, followTabs;
let addYoutuberModal, createProgramModal;
let heroSection, heroTitle, heroDescription, heroImage, heroDuration, heroButton, heroEyebrow, heroChannel;
let pageTitle;
let backgroundModal, backgroundBtn, backgroundOptions, buttonColorOptions;
let currentColorDisplay, expandedColorPicker, closeExpandedColorPicker;
let currentButtonColorDisplay, expandedButtonColorPicker, closeExpandedButtonColorPicker;
let fontDecreaseBtn, fontIncreaseBtn, fontSizeDisplay;
let legalModal, legalModalCloseBtn;
let legalModalTriggerButtons = [];
let legalModalFocusTarget = null;
let playlistModal, playlistModalBody;
let videoPlayer, videoPlaceholder, placeholderImage;
let channelPage, channelVideosGrid;
let channelBackBtn, channelProfileAvatar, channelProfileName, channelProfileSubscribers;
let channelProfileHandle,
    channelProfileDescription,
    channelProfileTags,
    channelProfileFollowBtn,
    channelProfileHideBtn,
    channelProfileShareBtn;
let channelSearchInputDesktop, channelSearchInputMobile;
let currentChannelVideos = [];
let currentChannelShorts = [];
let currentChannelLongVideos = [];
let currentChannelId = '';
let currentChannelName = '';
let searchForm, searchInput, searchDropdown;
let mobileSearchToggle, mobileSearchOverlay;
let extraVideosGrid;
let currentVideoId = null;
let currentVideoSource = null;
let useYouTubeAPI = false;
let selectedCategory = localStorage.getItem(LAST_CATEGORY_STORAGE_KEY) || 'Novetats';
let historySelectedCategory = 'Novetats';
let historyFilterLiked = false;
let currentFeedVideos = [];
let lastRenderedFeedList = [];
let currentFeedData = null;
let currentFeedRenderer = null;
let activePlaylistVideo = null;
let activePlaylistQueue = [];
let currentPlaylistIndex = 0;
let activePlaylistId = null;
let activePlaylistName = '';
let isPlaylistNavigation = false;
let isPlaylistMode = false;
let isPlaylistListBound = false;
let isPlaylistQueueBound = false;
let playlistDragState = null;
let playlistQueueDragState = null;
let editingPlaylistId = null;
let isProgramProfileActive = false;
// Programa (creat per l'usuari) que s'està mirant al perfil, si n'hi ha cap. El necessita
// la TV de programa per saber de quins vídeos ha de fer la graella.
let currentProgramId = '';
let currentShortIndex = 0;
let currentShortsQueue = [];
let forcedShortsQueue = null;
let isNavigatingShort = false;
let shortModalScrollY = 0;
let segueixScrollYBeforeChannel = null;
let shortScrollHintTimer = null;
let youtubeMessageListenerInitialized = false;
let lastKnownPlayerTime = 0;
let shouldRestoreViewState = true;
let searchDropdownItems = [];
let searchDropdownActiveIndex = -1;
let searchDebounceTimeout = null;
let searchArchiveIndexCache = [];
let searchArchiveIndexPromise = null;
const loadedSearchArchiveBuckets = new Set();
const failedSearchArchiveBuckets = new Set();
let searchArchiveManifestPromise = null;
const archiveSearchVideoMap = new Map();
const NOVETATS_MAX_AGE_DAYS = 90;

function bridgeSegueixAppState() {
    ensureSegueixAppStateSections();

    const defineStateProxy = (key, getter, setter) => {
        Object.defineProperty(SegueixApp.state, key, {
            configurable: true,
            enumerable: true,
            get: getter,
            set: setter,
        });
    };

    const defineNestedStateProxy = (section, key, getter, setter) => {
        const targetSection = SegueixApp.state[section] || (SegueixApp.state[section] = {});
        Object.defineProperty(targetSection, key, {
            configurable: true,
            enumerable: true,
            get: getter,
            set: setter,
        });
    };

    defineStateProxy(
        'currentVideoId',
        () => currentVideoId,
        value => {
            currentVideoId = value;
        }
    );
    defineStateProxy(
        'currentVideoSource',
        () => currentVideoSource,
        value => {
            currentVideoSource = value;
        }
    );
    defineStateProxy(
        'selectedCategory',
        () => selectedCategory,
        value => {
            selectedCategory = value;
        }
    );
    defineStateProxy(
        'currentChannelId',
        () => currentChannelId,
        value => {
            currentChannelId = value;
        }
    );
    defineStateProxy(
        'currentProgramId',
        () => currentProgramId,
        value => {
            currentProgramId = value;
        }
    );
    defineStateProxy(
        'currentShortIndex',
        () => currentShortIndex,
        value => {
            currentShortIndex = value;
        }
    );
    defineStateProxy(
        'activePlaylistId',
        () => activePlaylistId,
        value => {
            activePlaylistId = value;
        }
    );

    // Mirall progressiu i conservador per seccions (fase 2.1)
    defineNestedStateProxy(
        'navigation',
        'selectedCategory',
        () => selectedCategory,
        value => {
            selectedCategory = value;
        }
    );
    defineNestedStateProxy(
        'navigation',
        'activeLibraryTab',
        () => activeLibraryTab,
        value => {
            activeLibraryTab = value;
        }
    );
    defineNestedStateProxy(
        'navigation',
        'activeFollowTab',
        () => activeFollowTab,
        value => {
            activeFollowTab = value;
        }
    );

    defineNestedStateProxy(
        'feed',
        'currentVideos',
        () => currentFeedVideos,
        value => {
            currentFeedVideos = value;
        }
    );
    defineNestedStateProxy(
        'feed',
        'lastRenderedList',
        () => lastRenderedFeedList,
        value => {
            lastRenderedFeedList = value;
        }
    );
    defineNestedStateProxy(
        'feed',
        'currentData',
        () => currentFeedData,
        value => {
            currentFeedData = value;
        }
    );
    defineNestedStateProxy(
        'feed',
        'renderer',
        () => currentFeedRenderer,
        value => {
            currentFeedRenderer = value;
        }
    );

    defineNestedStateProxy(
        'channel',
        'currentChannelId',
        () => currentChannelId,
        value => {
            currentChannelId = value;
        }
    );
    defineNestedStateProxy(
        'channel',
        'currentChannelName',
        () => currentChannelName,
        value => {
            currentChannelName = value;
        }
    );
    defineNestedStateProxy(
        'channel',
        'currentVideos',
        () => currentChannelVideos,
        value => {
            currentChannelVideos = value;
        }
    );

    defineNestedStateProxy(
        'playlists',
        'activePlaylistId',
        () => activePlaylistId,
        value => {
            activePlaylistId = value;
        }
    );

    defineNestedStateProxy(
        'history',
        'selectedCategory',
        () => historySelectedCategory,
        value => {
            historySelectedCategory = value;
        }
    );
    defineNestedStateProxy(
        'history',
        'filterLiked',
        () => historyFilterLiked,
        value => {
            historyFilterLiked = value;
        }
    );

    defineNestedStateProxy(
        'search',
        'dropdownItems',
        () => searchDropdownItems,
        value => {
            searchDropdownItems = value;
        }
    );
    defineNestedStateProxy(
        'search',
        'activeIndex',
        () => searchDropdownActiveIndex,
        value => {
            searchDropdownActiveIndex = value;
        }
    );
    defineNestedStateProxy(
        'search',
        'archiveIndexCache',
        () => searchArchiveIndexCache,
        value => {
            searchArchiveIndexCache = value;
        }
    );

    defineNestedStateProxy(
        'player',
        'currentVideoId',
        () => currentVideoId,
        value => {
            currentVideoId = value;
        }
    );
    defineNestedStateProxy(
        'player',
        'currentVideoSource',
        () => currentVideoSource,
        value => {
            currentVideoSource = value;
        }
    );

    defineNestedStateProxy(
        'shorts',
        'currentShortIndex',
        () => currentShortIndex,
        value => {
            currentShortIndex = value;
        }
    );
    defineNestedStateProxy(
        'shorts',
        'currentShortsQueue',
        () => currentShortsQueue,
        value => {
            currentShortsQueue = value;
        }
    );
    defineNestedStateProxy(
        'shorts',
        'isNavigatingShort',
        () => isNavigatingShort,
        value => {
            isNavigatingShort = value;
        }
    );
    defineNestedStateProxy(
        'shorts',
        'shortModalScrollY',
        () => shortModalScrollY,
        value => {
            shortModalScrollY = value;
        }
    );
}

bridgeSegueixAppState();

// Cerca d'arxiu: mini índex local i miniatures
function rememberArchiveSearchVideos(videos) {
    if (!Array.isArray(videos)) {
        return;
    }
    videos.forEach(video => {
        if (!video?.id) {
            return;
        }
        const normalizedId = String(video.id);
        const existing = archiveSearchVideoMap.get(normalizedId) || {};
        archiveSearchVideoMap.set(normalizedId, {
            ...existing,
            ...video,
            id: normalizedId,
            thumbnail: video.thumbnail || existing.thumbnail || buildArchiveThumbnail(video.id),
        });
    });
}

function getArchiveVideosForChannel(channelId) {
    const normalizedChannelId = String(channelId || '').trim();
    if (!normalizedChannelId || !Array.isArray(searchArchiveIndexCache)) {
        return [];
    }

    return searchArchiveIndexCache
        .filter(item => String(item?.c || '') === normalizedChannelId)
        .map(item => ({
            id: item?.i,
            title: item?.t || '',
            channelId: normalizedChannelId,
            channelTitle: getChannelNameById(normalizedChannelId),
            publishedAt: item?.d || '',
            thumbnail: buildArchiveThumbnail(item?.i),
            source: 'archive',
        }))
        .filter(video => video.id);
}
let activeSearchRequestId = 0;
let installPromptEvent = null;
let swRegistration = null;
let isSwRefreshing = false;
let loadingAutoHideTimer = null;
let loadingVisibleSince = 0;
const APP_VERSION = '2026.03.13.3';
const COOKIE_CONSENT_KEY = 'segueix_cookie_consent_v2';
const YOUTUBE_CONSENT_STORAGE_VERSION = 1;
const LEGACY_COOKIE_CONSENT_KEYS = ['segueix_cookie_consent_v1'];
let youtubeCookieConsentState = null;
let pendingYouTubePlayerPayload = null;
let legacyYouTubeConsentResetDone = false;
let youtubeConsentModalRequest = null;
let youtubeConsentModalFocusTarget = null;

function resetLegacyYouTubeConsentState() {
    if (legacyYouTubeConsentResetDone) {
        return;
    }

    legacyYouTubeConsentResetDone = true;

    try {
        LEGACY_COOKIE_CONSENT_KEYS.forEach(key => {
            localStorage.removeItem(key);
        });
    } catch (error) {
        console.warn("No s'han pogut netejar les preferències antigues de YouTube:", error);
    }
}

function buildYouTubeConsentStorageValue(state, { source = 'unknown' } = {}) {
    return JSON.stringify({
        version: YOUTUBE_CONSENT_STORAGE_VERSION,
        status: state,
        source,
        updatedAt: new Date().toISOString(),
    });
}

function parseYouTubeConsentStorageValue(rawValue) {
    if (!rawValue) {
        return { state: null, needsRewrite: false, source: 'empty' };
    }

    if (rawValue === 'accepted' || rawValue === 'rejected') {
        return { state: rawValue, needsRewrite: true, source: 'legacy-string' };
    }

    try {
        const parsed = JSON.parse(rawValue);
        if (parsed === 'accepted' || parsed === 'rejected') {
            return { state: parsed, needsRewrite: true, source: 'legacy-json-string' };
        }
        const parsedStatus = parsed?.status;
        if (parsedStatus === 'accepted' || parsedStatus === 'rejected') {
            const needsRewrite = parsed?.version !== YOUTUBE_CONSENT_STORAGE_VERSION || typeof parsed?.updatedAt !== 'string';
            return { state: parsedStatus, needsRewrite, source: parsed?.source || 'structured' };
        }
    } catch (error) {
        console.warn("No s'ha pogut interpretar l'estat de consentiment de YouTube:", error);
    }

    return { state: null, needsRewrite: true, source: 'invalid' };
}

function getStoredYouTubeCookieConsent() {
    if (youtubeCookieConsentState) {
        return youtubeCookieConsentState;
    }

    resetLegacyYouTubeConsentState();

    try {
        const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
        const parsedConsent = parseYouTubeConsentStorageValue(stored);
        youtubeCookieConsentState = parsedConsent.state;

        if (parsedConsent.needsRewrite) {
            if (parsedConsent.state) {
                localStorage.setItem(
                    COOKIE_CONSENT_KEY,
                    buildYouTubeConsentStorageValue(parsedConsent.state, { source: parsedConsent.source })
                );
            } else {
                localStorage.removeItem(COOKIE_CONSENT_KEY);
            }
        }
    } catch (error) {
        youtubeCookieConsentState = null;
    }

    return youtubeCookieConsentState;
}

function hasAcceptedYouTubeCookies() {
    return getStoredYouTubeCookieConsent() === 'accepted';
}

function getYouTubePremiumPreference() {
    return localStorage.getItem(YOUTUBE_PREMIUM_STORAGE_KEY) === 'true';
}

function setYouTubePremiumPreference(enabled) {
    localStorage.setItem(YOUTUBE_PREMIUM_STORAGE_KEY, String(Boolean(enabled)));
}

function initCaptionsToggle() {
    const toggle = document.getElementById('captionsCaToggle');
    if (!toggle) return;
    toggle.checked = isCatalanCaptionsEnabled();
    if (toggle.dataset.bound === 'true') return;
    toggle.dataset.bound = 'true';
    toggle.addEventListener('change', () => {
        try {
            localStorage.setItem(CAPTIONS_CA_STORAGE_KEY, String(toggle.checked));
        } catch (error) {
            // Sense emmagatzematge: l'opció només val per aquesta sessió
        }
    });
}

function syncYouTubePremiumToggle() {
    initCaptionsToggle();
    const premiumToggle = document.getElementById('youtubePremiumToggle');
    if (!premiumToggle) return;
    premiumToggle.checked = getYouTubePremiumPreference();
}

function initYouTubePremiumToggle() {
    const premiumToggle = document.getElementById('youtubePremiumToggle');
    if (!premiumToggle || premiumToggle.dataset.bound === 'true') {
        syncYouTubePremiumToggle();
        return;
    }

    premiumToggle.dataset.bound = 'true';
    syncYouTubePremiumToggle();
    premiumToggle.addEventListener('change', () => {
        setYouTubePremiumPreference(premiumToggle.checked);
    });
}

function setYouTubeCookieConsent(state, { source = 'unknown' } = {}) {
    youtubeCookieConsentState = state === 'accepted' ? 'accepted' : 'rejected';

    try {
        localStorage.setItem(
            COOKIE_CONSENT_KEY,
            buildYouTubeConsentStorageValue(youtubeCookieConsentState, { source })
        );
    } catch (error) {
        console.warn("No s'ha pogut desar el consentiment de cookies:", error);
    }

    updateCookieNoticeVisibility();
    updateYouTubeConsentSettingsUi();
}

function openCookieBanner() {
    const banner = document.getElementById('cookieBanner');
    const preferencesBtn = document.getElementById('cookiePreferencesBtn');
    if (!banner) {
        return;
    }

    banner.classList.remove('hidden');
    preferencesBtn?.classList.add('hidden');
}

function closeCookieBanner({ showPreferencesButton = false } = {}) {
    const banner = document.getElementById('cookieBanner');
    const preferencesBtn = document.getElementById('cookiePreferencesBtn');
    banner?.classList.add('hidden');
    if (showPreferencesButton) {
        preferencesBtn?.classList.remove('hidden');
    } else {
        preferencesBtn?.classList.add('hidden');
    }
}

function updateCookieNoticeVisibility() {
    const consent = getStoredYouTubeCookieConsent();
    if (consent === 'accepted') {
        closeCookieBanner({ showPreferencesButton: false });
        return;
    }

    clearEmbeddedYouTubeSession();

    if (consent === 'rejected') {
        closeCookieBanner({ showPreferencesButton: true });
        return;
    }

    openCookieBanner();
}

function getYouTubeConsentSettingsSummary() {
    const consent = getStoredYouTubeCookieConsent();

    if (consent === 'accepted') {
        return 'YouTube està activat per a la reproducció incrustada. Pots desactivar-lo aquí si prefereixes continuar navegant sense carregar el reproductor extern.';
    }

    if (consent === 'rejected') {
        return "YouTube està desactivat. Podràs continuar navegant per l'app, però els vídeos i Shorts no es reproduiran dins de Segueix! fins que el tornis a activar.";
    }

    return "Encara no has triat una preferència permanent per a la reproducció incrustada. Pots activar o deixar desactivat YouTube des d'aquí.";
}

function updateYouTubeConsentSettingsUi() {
    const summary = document.getElementById('youtubeConsentSettingsSummary');
    const enableBtn = document.getElementById('youtubeConsentEnableBtn');
    const disableBtn = document.getElementById('youtubeConsentDisableBtn');
    const consent = getStoredYouTubeCookieConsent();

    if (summary) {
        summary.textContent = getYouTubeConsentSettingsSummary();
    }

    if (enableBtn) {
        const isDisabled = consent === 'accepted';
        enableBtn.disabled = isDisabled;
        enableBtn.setAttribute('aria-disabled', isDisabled ? 'true' : 'false');
    }

    if (disableBtn) {
        const isDisabled = consent === 'rejected';
        disableBtn.disabled = isDisabled;
        disableBtn.setAttribute('aria-disabled', isDisabled ? 'true' : 'false');
    }
}

function openYouTubePreferencesPanel() {
    openBackgroundModal();
    requestAnimationFrame(() => {
        updateYouTubeConsentSettingsUi();
        document.getElementById('youtubeConsentSettingsSection')?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
        });
    });
}

function bindYouTubeConsentSettingsUi() {
    const section = document.getElementById('youtubeConsentSettingsSection');
    const enableBtn = document.getElementById('youtubeConsentEnableBtn');
    const disableBtn = document.getElementById('youtubeConsentDisableBtn');
    const infoBtn = document.getElementById('youtubeConsentInfoSettingsBtn');

    if (!section || section.dataset.bound === 'true') {
        return;
    }

    section.dataset.bound = 'true';

    enableBtn?.addEventListener('click', () => {
        openYouTubeConsentModal({
            title: 'Activar YouTube dins de Segueix!',
            text: "Si actives aquesta preferència, Segueix! podrà carregar el reproductor de YouTube quan vulguis veure vídeos o Shorts dins de l'app. Pots canviar-ho més endavant des d'aquesta mateixa pantalla.",
            acceptLabel: 'Activar YouTube',
            cancelLabel: 'Ara no',
            consentOnAccept: true,
            onAccept: () => updateYouTubeConsentSettingsUi(),
        });
    });

    disableBtn?.addEventListener('click', () => {
        clearEmbeddedYouTubeSession();
        setYouTubeCookieConsent('rejected', { source: 'settings-reject' });
        updateYouTubeConsentSettingsUi();
    });

    infoBtn?.addEventListener('click', () => {
        showCookieInfo();
    });

    updateYouTubeConsentSettingsUi();
}

function buildYouTubeWatchUrl(videoId) {
    return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId || '')}`;
}

function clearEmbeddedYouTubeSession() {
    pendingYouTubePlayerPayload = null;
    isAutoPlayNavigating = false;

    if (videoPlayer) {
        videoPlayer.style.opacity = '';
        videoPlayer.style.pointerEvents = '';
    }

    stopVideoPlayback();
    SegueixApp.features.shorts?.clearPendingShort?.();
}

function closeYouTubeConsentModal({ runCancel = false } = {}) {
    const modal = document.getElementById('youtubeConsentModal');
    if (!modal || modal.classList.contains('hidden')) {
        return;
    }

    const currentRequest = youtubeConsentModalRequest;
    const focusTarget = youtubeConsentModalFocusTarget;
    youtubeConsentModalRequest = null;
    youtubeConsentModalFocusTarget = null;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    unlockBodyScroll?.();

    if (focusTarget && typeof focusTarget.focus === 'function') {
        focusTarget.focus();
    }

    if (runCancel) {
        currentRequest?.onCancel?.();
    }
}

function openYouTubeConsentModal({ title, text, acceptLabel, cancelLabel, onAccept, onCancel, consentOnAccept = false } = {}) {
    const modal = document.getElementById('youtubeConsentModal');
    const titleEl = document.getElementById('youtubeConsentModalTitle');
    const textEl = document.getElementById('youtubeConsentModalText');
    const acceptBtn = document.getElementById('youtubeConsentModalAccept');
    const cancelBtn = document.getElementById('youtubeConsentModalCancel');

    if (!modal || !titleEl || !textEl || !acceptBtn || !cancelBtn) {
        onAccept?.();
        return;
    }

    youtubeConsentModalFocusTarget = document.activeElement || null;
    youtubeConsentModalRequest = { onAccept, onCancel, consentOnAccept };
    titleEl.textContent = title || 'Activa el contingut extern';
    textEl.textContent =
        text ||
        'Per continuar, cal activar el servei extern que utilitza YouTube per reproduir aquest contingut.';
    acceptBtn.textContent = acceptLabel || 'Accepta i continua';
    cancelBtn.textContent = cancelLabel || 'Ara no';

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    lockBodyScroll?.();
    acceptBtn.focus();
}

function requestYouTubePlaybackConsent(options = {}) {
    if (hasAcceptedYouTubeCookies()) {
        options.onAccept?.();
        return;
    }

    openYouTubeConsentModal({ ...options, consentOnAccept: true });
}

function bindYouTubeConsentModalUi() {
    const modal = document.getElementById('youtubeConsentModal');
    const acceptBtn = document.getElementById('youtubeConsentModalAccept');
    const cancelBtn = document.getElementById('youtubeConsentModalCancel');

    if (!modal || modal.dataset.bound === 'true') {
        return;
    }

    modal.dataset.bound = 'true';

    acceptBtn?.addEventListener('click', () => {
        const currentRequest = youtubeConsentModalRequest;
        closeYouTubeConsentModal();
        if (currentRequest?.consentOnAccept) {
            acceptYouTubeCookiesAndResume({ source: 'modal-consent' });
        }
        currentRequest?.onAccept?.();
    });

    cancelBtn?.addEventListener('click', () => {
        closeYouTubeConsentModal({ runCancel: true });
    });

    modal.querySelectorAll('[data-youtube-consent-close], #youtubeConsentModalClose').forEach(element => {
        element.addEventListener('click', () => {
            closeYouTubeConsentModal({ runCancel: true });
        });
    });

    modal.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeYouTubeConsentModal({ runCancel: true });
        }
    });
}

function renderYouTubeCookiePlaceholder(container, { title, text, watchUrl, acceptAction = '' } = {}) {
    if (!container) {
        return;
    }

    const safeWatchUrl = watchUrl || 'https://www.youtube.com/';
    const acceptAttr = acceptAction ? ` data-cookie-accept-action="${acceptAction}"` : '';

    container.innerHTML = `
        <div class="youtube-cookie-placeholder">
            <p class="youtube-cookie-placeholder__title">${escapeHtml(title || 'Activa el reproductor de YouTube')}</p>
            <p class="youtube-cookie-placeholder__text">${escapeHtml(
                text ||
                    "Per reproduir aquest contingut incrustat, cal el teu consentiment perquè YouTube pot utilitzar cookies o tractar dades relacionades amb la reproducció."
            )}</p>
            <div class="youtube-cookie-placeholder__actions">
                <button class="youtube-cookie-placeholder__button" type="button"${acceptAttr}>Accepta i reprodueix</button>
                <a class="youtube-cookie-placeholder__link" href="${safeWatchUrl}" target="_blank" rel="noopener noreferrer">
                    Obre a YouTube
                </a>
            </div>
        </div>
    `;
}

function acceptYouTubeCookiesAndResume({ resumePlayer = true, resumeShort = true, source = 'banner-accept' } = {}) {
    setYouTubeCookieConsent('accepted', { source });

    if (resumePlayer && pendingYouTubePlayerPayload) {
        const payload = pendingYouTubePlayerPayload;
        pendingYouTubePlayerPayload = null;
        updatePlayerIframe(payload);
        clearPlayOverlay();
        if (payload.thumbnail || payload.title) {
            preparePlayerForPlayback({
                thumbnail: payload.thumbnail || '',
                title: payload.title || '',
            });
        }
    }

    if (resumeShort && SegueixApp.features.shorts?.resumePendingShort) {
        SegueixApp.features.shorts.resumePendingShort();
    }
}

function showCookieInfo() {
    openYouTubeConsentModal({
        title: 'Com funciona el consentiment de YouTube',
        text: "Segueix! no carrega analítica pròpia, però quan entres al reproductor incrustat YouTube pot utilitzar cookies o altres identificadors relacionats amb la reproducció, la seguretat i el recompte de visualitzacions. Si l'actives, aquesta acceptació quedarà aplicada a partir d'ara per a tots els vídeos i Shorts incrustats de la plataforma fins que la canviïs a la configuració.",
        acceptLabel: 'Entesos',
        cancelLabel: 'Tancar',
    });
}

function bindCookieConsentUi() {
    const acceptBtn = document.getElementById('cookieAcceptBtn');
    const rejectBtn = document.getElementById('cookieRejectBtn');
    const infoBtn = document.getElementById('cookieInfoBtn');
    const preferencesBtn = document.getElementById('cookiePreferencesBtn');

    acceptBtn?.addEventListener('click', () => {
        acceptYouTubeCookiesAndResume({ source: 'banner-accept' });
    });

    rejectBtn?.addEventListener('click', () => {
        clearEmbeddedYouTubeSession();
        setYouTubeCookieConsent('rejected', { source: 'banner-reject' });
        if (videoPlayer) {
            renderYouTubeCookiePlaceholder(videoPlayer, {
                title: 'Has desactivat el reproductor incrustat',
                text: "Si més endavant vols tornar a reproduir vídeos dins de Segueix!, pots canviar aquesta preferència des del botó de cookies.",
                watchUrl: buildYouTubeWatchUrl(currentVideoId),
                acceptAction: 'player',
            });
        }
        SegueixApp.features.shorts?.clearPendingShort?.();
    });

    infoBtn?.addEventListener('click', showCookieInfo);
    preferencesBtn?.addEventListener('click', openYouTubePreferencesPanel);
    bindYouTubeConsentModalUi();

    document.addEventListener('click', event => {
        const acceptButton = event.target.closest('[data-cookie-accept-action]');
        if (!acceptButton) {
            return;
        }

        const action = acceptButton.dataset.cookieAcceptAction;
        acceptYouTubeCookiesAndResume({
            resumePlayer: action !== 'short',
            resumeShort: action !== 'player',
            source: `inline-${action || 'unknown'}`,
        });
    });

    updateCookieNoticeVisibility();
}

window.shouldLoadYouTubeEmbeds = hasAcceptedYouTubeCookies;
window.requestYouTubePlaybackConsent = requestYouTubePlaybackConsent;

function detectBootstrapProgressDeviceProfile() {
    const userAgent = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const maxTouchPoints = Number(navigator.maxTouchPoints || 0);
    const hardwareConcurrency = Number(navigator.hardwareConcurrency || 0);
    const memory = Number(navigator.deviceMemory || 0);

    const isIPhone = /iPhone/i.test(userAgent);
    const isIPad = /iPad/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
    const isAndroid = /Android/i.test(userAgent);
    const androidVersionMatch = userAgent.match(/Android\s(\d+)/i);
    const androidVersion = androidVersionMatch ? Number(androidVersionMatch[1]) : null;

    const isOldOrLimitedAndroid =
        isAndroid &&
        ((Number.isFinite(androidVersion) && androidVersion <= 9) ||
            (hardwareConcurrency > 0 && hardwareConcurrency <= 4) ||
            (memory > 0 && memory <= 4));

    const shouldShow = isIPhone || isIPad || isAndroid || isOldOrLimitedAndroid;

    return {
        shouldShow,
        isIPhone,
        isIPad,
        isAndroid,
        isOldOrLimitedAndroid,
    };
}

function resolveTelegramDownloadUrl(button) {
    if (!button) {
        return 'https://web.telegram.org/a/';
    }

    const userAgent = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const maxTouchPoints = Number(navigator.maxTouchPoints || 0);
    const isIPhone = /iPhone/i.test(userAgent);
    const isIPad = /iPad/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
    const isAndroid = /Android/i.test(userAgent);

    if (isAndroid) {
        return button.dataset.telegramAndroidUrl || 'https://play.google.com/store/apps/details?id=org.telegram.messenger';
    }

    if (isIPhone || isIPad) {
        return button.dataset.telegramIosUrl || 'https://apps.apple.com/app/telegram-messenger/id686449807';
    }

    return button.dataset.telegramDesktopUrl || 'https://web.telegram.org/a/';
}

function bindTelegramDownloadButtons(container = document) {
    container.querySelectorAll('.about-telegram-btn').forEach(button => {
        if (button.dataset.telegramBound === 'true') {
            return;
        }

        button.dataset.telegramBound = 'true';
        const url = resolveTelegramDownloadUrl(button);
        button.href = url;
        button.addEventListener('click', () => {
            button.href = resolveTelegramDownloadUrl(button);
        });
    });
}

function createBootstrapProgressOverlay(profile = {}) {
    if (!profile.shouldShow) {
        return null;
    }

    const existingOverlay = document.getElementById('bootstrapProgressOverlay');
    if (existingOverlay) {
        return existingOverlay;
    }

    const overlay = document.createElement('div');
    overlay.id = 'bootstrapProgressOverlay';
    overlay.className = 'bootstrap-progress-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = `
        <div class="bootstrap-progress-content">
            <h2 class="bootstrap-progress-title">Preparant Segueix...</h2>
            <p class="bootstrap-progress-message" id="bootstrapProgressMessage">Iniciant aplicació...</p>
            <div class="bootstrap-progress-track" aria-hidden="true">
                <div class="bootstrap-progress-bar" id="bootstrapProgressBar"></div>
            </div>
            <span class="bootstrap-progress-percent" id="bootstrapProgressPercent">0%</span>
        </div>
    `;

    document.body.appendChild(overlay);
    return overlay;
}

function updateBootstrapProgress(value, message) {
    const overlay = document.getElementById('bootstrapProgressOverlay');
    if (!overlay) {
        return;
    }

    const boundedValue = Math.max(0, Math.min(100, Number(value) || 0));
    const bar = overlay.querySelector('#bootstrapProgressBar');
    const percent = overlay.querySelector('#bootstrapProgressPercent');
    const messageEl = overlay.querySelector('#bootstrapProgressMessage');

    if (bar) {
        bar.style.width = `${boundedValue}%`;
    }
    if (percent) {
        percent.textContent = `${Math.round(boundedValue)}%`;
    }
    if (messageEl && message) {
        messageEl.textContent = message;
    }
}

function completeBootstrapProgressOverlay() {
    const overlay = document.getElementById('bootstrapProgressOverlay');
    if (!overlay) {
        return;
    }

    overlay.classList.add('bootstrap-progress-overlay--hidden');
    setTimeout(() => overlay.remove(), 320);
}

function withStartupTimeout(taskPromise, timeoutMs, timeoutLabel) {
    if (!taskPromise || typeof taskPromise.then !== 'function') {
        return Promise.resolve(taskPromise);
    }

    const timeout = Math.max(1, Number(timeoutMs) || 1);
    let timeoutId;

    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`Startup timeout: ${timeoutLabel}`));
        }, timeout);
    });

    return Promise.race([taskPromise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
    });
}

// ==================== ENLLAÇOS COMPARTITS (?v=) ====================
// Un enllaç compartit ha d'acabar SEMPRE al vídeo, mai al feed general.

// Llegeix el paràmetre `t` (segon d'inici) — implementació a utils/share-codecs.js.
// Si el mòdul no hi fos, el valor segur és 0 (reproduir des del principi).
function parseShareStartSeconds(rawValue) {
    return SegueixApp.utils?.shareCodecs?.parseShareStartSeconds?.(rawValue) ?? 0;
}

// El destí es memoritza en temps de parsing perquè els watchdogs de recuperació
// d'arrencada (forceRecoverHomeFeed) sàpiguen que hi ha un vídeo pendent abans que
// handleInitialUrlParams hagi arribat a executar-se.
let pendingDeepLinkVideo = (() => {
    try {
        const bootParams = new URLSearchParams(window.location.search);
        const bootVideoId = bootParams.get('v');
        if (!bootVideoId) {
            return null;
        }
        return { id: bootVideoId, startAt: parseShareStartSeconds(bootParams.get('t')) };
    } catch (error) {
        return null;
    }
})();
let deepLinkVideoHandled = false;

// Obre el vídeo d'un enllaç compartit. Idempotent i tolerant a errors: si alguna cosa
// falla, s'obre igualment el reproductor en comptes de deixar l'usuari al feed.
async function openPendingDeepLinkVideo() {
    if (!pendingDeepLinkVideo || deepLinkVideoHandled) {
        return;
    }
    const { id: videoId, startAt } = pendingDeepLinkVideo;
    deepLinkVideoHandled = true;

    try {
        let urlVideo = null;
        try {
            // Amb límit de temps: si el vídeo no és al feed local es consulta l'API, i
            // una xarxa lenta no pot deixar l'enllaç compartit sense obrir.
            urlVideo = await withStartupTimeout(resolveInitialVideoForUrl(videoId), 4000, 'deep link ?v=');
        } catch (error) {
            console.warn("No s'ha pogut resoldre el vídeo compartit, seguim amb el reproductor.", error);
        }

        if (urlVideo?.isShort) {
            const assignedCategory =
                getEffectiveCategory(urlVideo.channelId) || getVideoCategoryCandidates(urlVideo)[0] || null;
            const shortQueue = assignedCategory ? buildCategoryShortQueueForVideo(videoId, assignedCategory) : [];
            if (shortQueue.length > 0 && typeof SegueixApp.features.shorts?.openShortModalWithQueue === 'function') {
                SegueixApp.features.shorts.openShortModalWithQueue(videoId, shortQueue);
            } else {
                openShortModal(videoId);
            }
            return;
        }

        // showVideoFromAPI ja resol pel seu compte els vídeos d'arxiu (carrega l'índex
        // de cerca només si li cal), així que no cal bloquejar l'arrencada esperant-lo.
        if (useYouTubeAPI) {
            showVideoFromAPI(videoId, { startAt, replaceHistory: true });
        } else {
            showVideo(videoId, { startAt, replaceHistory: true });
        }
    } catch (error) {
        console.error('Error obrint el vídeo compartit, provem el reproductor directament.', error);
        try {
            showVideoFromAPI(videoId, { startAt, replaceHistory: true });
        } catch (fallbackError) {
            console.error('El reproductor tampoc ha pogut obrir el vídeo compartit.', fallbackError);
        }
    }
}

function forceRecoverHomeFeed(reason = 'unknown') {
    try {
        // Si s'ha arribat per un enllaç compartit, la recuperació no pot portar l'usuari
        // al feed general: el destí de l'enllaç mana. Reintentem obrir-lo.
        if (pendingDeepLinkVideo) {
            console.warn(`Startup recovery amb enllaç compartit pendent (${reason}): obrim el vídeo.`);
            hideLoading();
            openPendingDeepLinkVideo();
            return;
        }

        console.warn(`Startup recovery: forcem inici de feed (${reason}).`);
        hideLoading();
        SegueixApp.features.navigation?.setActiveNavItem?.('home');
        shouldRestoreViewState = false;
        requestAnimationFrame(() => {
            if (!isMiniPlayerActive()) {
                stopVideoPlayback();
            }
            showHomeNovetats();
        });
    } catch (error) {
        console.error('Startup recovery error:', error);
    }
}
let currentFontSize = null;
let userGridPreference = '4';
let userWatchGridPreference = '3';
let isAutoPlayNavigating = false;
let miniPlayerTimer = null;
let miniPlayerAutoActivatedByScroll = false;
const featuredVideoBySection = new Map();
const customCategorySearchCache = new Map();
const customCategorySearchInFlight = new Map();
const HYBRID_CATEGORY_SORT = new Set([
    'Cultura',
    'Diversió',
    'Actualitat',
    'Vida',
    'El Món',
    'Gaming',
    'Mitjans',
    'Entitats',
    'Digitals',
]);

// Cache de canals carregats de l'API
const cachedChannels = {};

// Cache de vídeos carregats de l'API (amb límit per evitar creixement descontrolat)
const cachedAPIVideos = [];
const CACHED_API_VIDEOS_MAX = 800;
let activeFollowTab = 'all';
let channelCategoryPickerCleanup = null;
let suppressNextPopstateNavigation = false;

function isAuxiliaryPageVisible() {
    return Boolean(
        (historyPage && !historyPage.classList.contains('hidden')) ||
        (playlistsPage && !playlistsPage.classList.contains('hidden')) ||
        (followPage && !followPage.classList.contains('hidden'))
    );
}

function showHomeNovetatsLegacyImpl() {
    // Si ja estem a Home amb Novetats i el grid té contingut, només mostrar la pàgina
    const alreadyHome =
        homePage &&
        !homePage.classList.contains('hidden') &&
        selectedCategory === 'Novetats' &&
        videosGrid &&
        videosGrid.children.length > 0;
    if (alreadyHome) {
        setActiveNavItem('home');
        showHome();
        return;
    }

    historyFilterLiked = false;
    selectedCategory = 'Novetats';
    localStorage.setItem(LAST_CATEGORY_STORAGE_KEY, selectedCategory);
    renderCategories();
    setActiveNavItem('home');
    showHome();
    if (useYouTubeAPI) {
        loadVideosFromAPI();
    } else {
        loadVideos();
    }
}

function showHomeNovetats() {
    return SegueixApp.features.feed?.showHomeNovetats?.();
}

function mergeChannelCategories(channel, categories) {
    if (!channel || !Array.isArray(categories) || categories.length === 0) {
        return;
    }
    channel.categories = [...new Set([...(channel.categories || []), ...categories])];
}

function resolveChannelAvatar(channelId, channelObj) {
    if (channelObj) {
        if (channelObj.avatar) return channelObj.avatar;
        if (channelObj.thumbnail) return channelObj.thumbnail;
        if (channelObj.snippet?.thumbnails?.medium?.url) return channelObj.snippet.thumbnails.medium.url;
        if (channelObj.snippet?.thumbnails?.default?.url) return channelObj.snippet.thumbnails.default.url;
    }

    const cached = cachedChannels[channelId];
    if (cached) {
        if (cached.thumbnail) return cached.thumbnail;
        if (cached.avatar) return cached.avatar;
    }

    const followAvatar = getFollowChannelAvatar(channelId);
    if (followAvatar) return followAvatar;

    return 'img/icon-192.png';
}

// Preferències de layout (home/watch)
function loadGridLayoutPreference() {
    const storedPreference = localStorage.getItem(GRID_LAYOUT_STORAGE_KEY);
    userGridPreference = storedPreference === '3' || storedPreference === '4' ? storedPreference : '4';
}

function loadWatchGridLayoutPreference() {
    const storedPreference = localStorage.getItem(WATCH_GRID_LAYOUT_STORAGE_KEY);
    userWatchGridPreference = storedPreference === '2' || storedPreference === '3' ? storedPreference : '3';
}

function updateGridLayoutControlState() {
    const controls = homePage?.querySelector('.grid-layout-controls');
    if (!controls) {
        return;
    }
    controls.querySelectorAll('[data-grid-layout]').forEach(button => {
        const isActive = button.dataset.gridLayout === userGridPreference;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
}

function applyGridLayoutPreference() {
    if (!videosGrid) {
        return;
    }
    videosGrid.classList.remove('cols-3', 'cols-4');
    if (userGridPreference === '3') {
        videosGrid.classList.add('cols-3');
    } else {
        videosGrid.classList.add('cols-4');
    }
    updateGridLayoutControlState();
}

function updateWatchGridLayoutControlState() {
    const controls = watchPage?.querySelector('.watch-grid-controls');
    if (!controls) {
        return;
    }
    controls.querySelectorAll('[data-watch-grid-layout]').forEach(button => {
        const isActive = button.dataset.watchGridLayout === userWatchGridPreference;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
}

function applyWatchGridLayoutPreference() {
    const extraContainer = extraVideosGrid || document.getElementById('extraVideosGrid');
    if (!extraContainer) {
        return;
    }
    extraContainer.classList.remove('cols-2', 'cols-3');
    if (userWatchGridPreference === '2') {
        extraContainer.classList.add('cols-2');
    } else {
        extraContainer.classList.add('cols-3');
    }
    updateWatchGridLayoutControlState();
}

function ensureGridLayoutControls() {
    if (!videosGrid || !homePage) {
        return;
    }
    let controls = homePage.querySelector('.grid-layout-controls');
    if (!controls) {
        const controlsMarkup = `
            <div class="grid-layout-controls" aria-label="Grid Layout Options">
                <button class="grid-layout-button" type="button" data-grid-layout="3" aria-pressed="false" aria-label="View 3 columns" title="3 Columns">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3" y="4" width="4" height="16" rx="1" />
                        <rect x="10" y="4" width="4" height="16" rx="1" />
                        <rect x="17" y="4" width="4" height="16" rx="1" />
                    </svg>
                </button>
                <button class="grid-layout-button" type="button" data-grid-layout="4" aria-pressed="false" aria-label="View 4 columns" title="4 Columns">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <rect x="2" y="4" width="3" height="16" rx="0.5" />
                        <rect x="7.5" y="4" width="3" height="16" rx="0.5" />
                        <rect x="13" y="4" width="3" height="16" rx="0.5" />
                        <rect x="18.5" y="4" width="3" height="16" rx="0.5" />
                    </svg>
                </button>
            </div>
        `;
        videosGrid.insertAdjacentHTML('beforebegin', controlsMarkup);
        controls = homePage.querySelector('.grid-layout-controls');
    }
    if (controls && controls.dataset.bound !== 'true') {
        controls.dataset.bound = 'true';
        controls.addEventListener('click', event => {
            const button = event.target.closest('[data-grid-layout]');
            if (!button) {
                return;
            }
            const preference = button.dataset.gridLayout;
            if (preference !== '3' && preference !== '4') {
                return;
            }
            userGridPreference = preference;
            localStorage.setItem(GRID_LAYOUT_STORAGE_KEY, userGridPreference);
            applyGridLayoutPreference();
        });
    }
    updateGridLayoutControlState();
}

function ensureWatchGridLayoutControls() {
    const extraContainer = extraVideosGrid || document.getElementById('extraVideosGrid');
    if (!extraContainer || !watchPage) {
        return;
    }

    const title = watchPage.querySelector('.extra-related-title');
    let header = watchPage.querySelector('.extra-related-header');

    if (!header && title) {
        header = document.createElement('div');
        header.className = 'extra-related-header';
        extraContainer.parentNode?.insertBefore(header, extraContainer);
        header.appendChild(title);
    } else if (header && title && title.parentNode !== header) {
        header.appendChild(title);
    }

    if (!header) {
        return;
    }

    let controls = header.querySelector('.watch-grid-controls');
    if (!controls) {
        const controlsMarkup = `
            <div class="watch-grid-controls" aria-label="Opcions de columnes">
                <button class="grid-layout-button" type="button" data-watch-grid-layout="2" aria-pressed="false" aria-label="Veure 2 columnes" title="2 Columnes">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="4" y="4" width="7" height="16" rx="1" />
                        <rect x="13" y="4" width="7" height="16" rx="1" />
                    </svg>
                </button>
                <button class="grid-layout-button" type="button" data-watch-grid-layout="3" aria-pressed="false" aria-label="Veure 3 columnes" title="3 Columnes">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3" y="4" width="4" height="16" rx="1" />
                        <rect x="10" y="4" width="4" height="16" rx="1" />
                        <rect x="17" y="4" width="4" height="16" rx="1" />
                    </svg>
                </button>
            </div>
        `;
        header.insertAdjacentHTML('beforeend', controlsMarkup);
        controls = header.querySelector('.watch-grid-controls');
    }

    if (controls && controls.dataset.bound !== 'true') {
        controls.dataset.bound = 'true';
        controls.addEventListener('click', event => {
            const button = event.target.closest('[data-watch-grid-layout]');
            if (!button) {
                return;
            }
            const preference = button.dataset.watchGridLayout;
            if (preference !== '2' && preference !== '3') {
                return;
            }
            userWatchGridPreference = preference;
            localStorage.setItem(WATCH_GRID_LAYOUT_STORAGE_KEY, userWatchGridPreference);
            applyWatchGridLayoutPreference();
        });
    }
    updateWatchGridLayoutControlState();
}

const DEFAULT_EXTRA_RELATED_TITLE = 'Altres vídeos relacionats';

function setExtraRelatedTitle(text) {
    if (!watchPage) {
        return;
    }
    const title = watchPage.querySelector('.extra-related-title');
    if (title) {
        title.textContent = text || DEFAULT_EXTRA_RELATED_TITLE;
    }
}

function getPlaylistSearchKeywords(playlistName) {
    return String(playlistName || '')
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2);
}

function getPlaylistSearchVideos(playlistName) {
    const trimmedName = String(playlistName || '').trim();
    if (!trimmedName) {
        return [];
    }

    const keywords = getPlaylistSearchKeywords(trimmedName);
    const queries = keywords.length > 0 ? keywords : [trimmedName.toLowerCase()];
    const videosMap = new Map();

    queries.forEach(query => {
        const results = performLocalSearch(query);
        if (!Array.isArray(results?.videos)) {
            return;
        }
        results.videos.forEach(video => {
            const normalizedId = String(video.id);
            const existing = videosMap.get(normalizedId);
            const score = Number.isFinite(video.score) ? video.score : 0;
            if (existing) {
                existing.score = (existing.score || 0) + score;
            } else {
                videosMap.set(normalizedId, { ...video, score });
            }
        });
    });

    return Array.from(videosMap.values())
        .filter(video => !video.isShort)
        .sort((a, b) => {
            if ((b.score || 0) !== (a.score || 0)) {
                return (b.score || 0) - (a.score || 0);
            }
            const viewA = a.viewCount ?? a.views ?? 0;
            const viewB = b.viewCount ?? b.views ?? 0;
            if (viewA !== viewB) {
                return viewB - viewA;
            }
            return (a.title || '').localeCompare(b.title || '', 'ca', { sensitivity: 'base' });
        });
}

// Seguiment de canals i estat dels botons
function getFollowedChannelIds() {
    const stored = localStorage.getItem(FOLLOW_STORAGE_KEY);
    if (!stored) {
        return [];
    }
    try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('No es pot llegir catube_follows', error);
        return [];
    }
}

function saveFollowedChannelIds(ids) {
    localStorage.setItem(FOLLOW_STORAGE_KEY, JSON.stringify(ids));
}

function getHiddenChannelIds() {
    const stored = localStorage.getItem(HIDDEN_CHANNELS_STORAGE_KEY);
    if (!stored) {
        return [];
    }
    try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('No es pot llegir catube_hidden_channels', error);
        return [];
    }
}

function saveHiddenChannelIds(ids) {
    localStorage.setItem(HIDDEN_CHANNELS_STORAGE_KEY, JSON.stringify(ids));
}

function isChannelHidden(channelId) {
    if (!channelId) {
        return false;
    }
    const normalizedId = String(channelId);
    return getHiddenChannelIds().some(id => String(id) === normalizedId);
}

function toggleHiddenChannel(channelId) {
    if (!channelId) {
        return false;
    }
    const normalizedId = String(channelId);
    const current = new Set(getHiddenChannelIds().map(id => String(id)));
    if (current.has(normalizedId)) {
        current.delete(normalizedId);
    } else {
        current.add(normalizedId);
    }
    const ids = Array.from(current);
    saveHiddenChannelIds(ids);
    return current.has(normalizedId);
}

function isChannelFollowed(channelId) {
    if (!channelId) {
        return false;
    }
    const normalizedId = String(channelId);
    return getFollowedChannelIds().some(id => String(id) === normalizedId);
}

function isMitjansOrDigitalsChannel(channelId) {
    if (!channelId) {
        return false;
    }
    const normalizedId = String(channelId);
    let feedCats = [];
    if (cachedChannels[normalizedId]?.categories) {
        feedCats = cachedChannels[normalizedId].categories;
    } else if (typeof YouTubeAPI !== 'undefined' && Array.isArray(YouTubeAPI.feedChannels)) {
        const feedChannel = YouTubeAPI.feedChannels.find(channel => String(channel.id) === normalizedId);
        if (feedChannel?.categories) {
            feedCats = feedChannel.categories;
        }
    }

    const customCats = getChannelCustomCategories(normalizedId);
    const allCats = [...feedCats, ...customCats];
    return allCats.some(cat => {
        const normalizedCat = String(cat).toLowerCase();
        return normalizedCat === 'mitjans' || normalizedCat === 'digitals' || normalizedCat === 'entitats';
    });
}

function toggleFollowChannelLegacyImpl(channelId) {
    if (!channelId) {
        return false;
    }
    const normalizedId = String(channelId);
    const current = new Set(getFollowedChannelIds().map(id => String(id)));
    if (current.has(normalizedId)) {
        current.delete(normalizedId);
    } else {
        current.add(normalizedId);
    }
    const ids = Array.from(current);
    saveFollowedChannelIds(ids);
    return current.has(normalizedId);
}

function updateFollowButtonState(button, channelId) {
    if (!button) {
        return;
    }
    const followed = isChannelFollowed(channelId);
    button.classList.toggle('is-followed', followed);
    button.setAttribute('aria-pressed', followed ? 'true' : 'false');
    button.setAttribute('aria-label', followed ? 'Deixa de seguir aquest canal' : 'Segueix aquest canal');
    button.textContent = followed ? 'Seguint' : 'Segueix';
}

function refreshFollowButtons(channelId) {
    document.querySelectorAll(`[data-follow-channel="${channelId}"]`).forEach(button => {
        updateFollowButtonState(button, channelId);
    });
}

function updateHideChannelButtonState(button, channelId) {
    if (!button) {
        return;
    }
    const hidden = isChannelHidden(channelId);
    button.classList.toggle('is-hidden', hidden);
    button.setAttribute('aria-pressed', hidden ? 'true' : 'false');
    button.setAttribute('title', hidden ? 'Torna a mostrar aquest canal' : 'Amaga aquest canal del feed');
    button.setAttribute('aria-label', hidden ? 'Torna a mostrar aquest canal' : 'Amaga aquest canal del feed');
}

function refreshHideChannelButtons(channelId) {
    document.querySelectorAll(`[data-hide-channel="${channelId}"]`).forEach(button => {
        updateHideChannelButtonState(button, channelId);
    });
}

function bindHideChannelButtons(container = document) {
    const buttons = container.querySelectorAll('[data-hide-channel]');
    buttons.forEach(button => {
        if (button.dataset.hideBound === 'true') {
            return;
        }
        button.dataset.hideBound = 'true';
        const channelId = button.dataset.hideChannel;
        updateHideChannelButtonState(button, channelId);
        button.addEventListener('click', event => {
            event.stopPropagation();
            event.preventDefault();
            const normalizedId = String(channelId || '');
            toggleHiddenChannel(normalizedId);
            updateHideChannelButtonState(button, normalizedId);
            requestAnimationFrame(() => {
                refreshHideChannelButtons(normalizedId);
                if (homePage && !homePage.classList.contains('hidden')) {
                    renderFeed();
                }
                if (currentChannelId && String(currentChannelId) === normalizedId) {
                    renderChannelVideos('');
                }
            });
        });
    });
}

function bindFollowButtons(container = document) {
    const buttons = container.querySelectorAll('[data-follow-channel]');
    buttons.forEach(button => {
        if (button.dataset.followBound === 'true') {
            return;
        }
        button.dataset.followBound = 'true';
        const channelId = button.dataset.followChannel;
        updateFollowButtonState(button, channelId);
        button.addEventListener('click', event => {
            event.stopPropagation();
            event.preventDefault();
            const normalizedId = String(channelId);
            const nowFollowed = toggleFollowChannel(normalizedId);
            // Feedback immediat al botó clicat
            updateFollowButtonState(button, normalizedId);
            // Diferir actualització de la resta de botons i DOM pesant
            requestAnimationFrame(() => {
                refreshFollowButtons(channelId);
                if (activeFollowTab === 'following' && !nowFollowed) {
                    const card = button.closest('.follow-card');
                    if (card) {
                        card.remove();
                    }
                    if (followGrid && followGrid.children.length === 0) {
                        renderFollowEmptyState();
                    }
                }
            });
        });
    });
}

function toggleFollowChannel(channelId) {
    return SegueixApp.features.channel?.toggleFollowChannel?.(channelId);
}

function getFollowChannelAvatar(channelId) {
    const cached = cachedChannels[channelId];
    if (cached?.thumbnail) {
        return cached.thumbnail;
    }
    return null;
}

// ==================== PROGRAMES ====================

// Normalitza text traient accents i unificant apòstrofs (per comparar títols de programes)
function normalizeProgramText(text) {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\u2018\u2019\u201A\u201B\u0060\u00B4]/g, "'")
        .toLowerCase();
}

// Comprova si un vídeo pertany a algun programa que tingui la categoria indicada
function videoBelongsToProgram(video, categoryName) {
    if (!video?.channelId) return false;
    const programs = getPrograms();
    const channelId = String(video.channelId);
    const catLower = categoryName.toLowerCase();
    const title = normalizeProgramText(video.title || '');

    return programs.some(prog => {
        if (String(prog.channelId) !== channelId) return false;
        const hasCat = (prog.customCategories || []).some(c => c.toLowerCase() === catLower);
        if (!hasCat) return false;
        // Només si el títol del vídeo conté el nom del programa
        const progNameNorm = normalizeProgramText(prog.name);
        return title.includes(progNameNorm);
    });
}

function getPrograms() {
    try {
        const raw = localStorage.getItem(PROGRAMS_STORAGE_KEY);
        const programs = safeParsePrograms(raw);
        return programs.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ca', { sensitivity: 'base' }));
    } catch (_) {
        return [];
    }
}

function savePrograms(programs) {
    try {
        localStorage.setItem(PROGRAMS_STORAGE_KEY, JSON.stringify(programs));
    } catch (_) {}
}

function createProgram(channelId, name, description) {
    const programs = getPrograms();
    const id = `prog_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const program = {
        id,
        channelId,
        name: name.trim(),
        description: (description || '').trim(),
        createdAt: Date.now(),
        customCategories: [],
    };
    programs.push(program);
    savePrograms(programs);
    return program;
}

function deleteProgram(programId) {
    const programs = getPrograms().filter(p => p.id !== programId);
    savePrograms(programs);
}

function getProgramById(programId) {
    return getPrograms().find(p => p.id === programId) || null;
}

function updateProgram(programId, updates) {
    const programs = getPrograms();
    const idx = programs.findIndex(p => p.id === programId);
    if (idx >= 0) {
        programs[idx] = { ...programs[idx], ...updates };
        savePrograms(programs);
    }
}

function getProgramsForVideo(video) {
    if (!video?.channelId) return [];

    const channelId = String(video.channelId);
    const title = normalizeProgramText(video.title || '');

    return getPrograms()
        .filter(program => {
            if (String(program.channelId) !== channelId) return false;
            const programNameNorm = normalizeProgramText(program.name || '');
            return Boolean(programNameNorm) && title.includes(programNameNorm);
        })
        .sort((a, b) => (b.name || '').length - (a.name || '').length);
}

function getPrimaryProgramForVideo(video) {
    return getProgramsForVideo(video)[0] || null;
}

function getProgramVideos(program) {
    if (!program?.channelId) return [];

    const normalizedChannelId = String(program.channelId);
    const programNameNorm = normalizeProgramText(program.name || '');
    const feedVideos = Array.isArray(YouTubeAPI?.feedVideos) ? YouTubeAPI.feedVideos : [];
    const archiveVideos = getArchiveVideosForChannel(normalizedChannelId);
    rememberArchiveSearchVideos(archiveVideos);
    const mergedById = new Map();

    [...feedVideos, ...cachedAPIVideos, ...archiveVideos].forEach(video => {
        if (!video?.id || video.isShort || String(video.channelId) !== normalizedChannelId) {
            return;
        }
        const normalizedTitle = normalizeProgramText(video.title || '');
        if (!programNameNorm || !normalizedTitle.includes(programNameNorm)) {
            return;
        }
        const normalizedId = String(video.id);
        if (!mergedById.has(normalizedId)) {
            mergedById.set(normalizedId, video);
        }
    });

    return Array.from(mergedById.values()).sort(
        (a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()
    );
}

function getWatchChannelInfoContext(channel, video) {
    const program = getPrimaryProgramForVideo(video);
    const channelName = channel?.title || channel?.name || '';

    return {
        program,
        channelName,
        displayName: program?.name || channelName,
        secondaryText: program ? `Programa de ${channelName}` : '',
        subscribersText: !program
            ? channel?.subscriberCount
                ? `${formatViews(channel.subscriberCount)} subscriptors`
                : 'Subscriptors ocults'
            : '',
    };
}

function buildWatchChannelInfoHtml(channel, avatar, watchUrl, video) {
    const info = getWatchChannelInfoContext(channel, video);
    const isMitjans = isMitjansOrDigitalsChannel(channel.id);
    const followButtonHtml = isMitjans
        ? ''
        : `
                            <button class="follow-btn-pill" type="button" data-follow-channel="${channel.id}" aria-pressed="false">
                                Segueix
                            </button>
                        `;
    const supportBtnDesktop =
        !info.program && channelHasSupport(channel.id)
            ? `<button class="btn-support-watch btn-support-watch--desktop js-support-btn" type="button" data-support-channel="${channel.id}" data-support-name="${escapeHtml(info.channelName || info.displayName)}"><svg viewBox="0 0 24 24" width="16" height="16" fill="#e74c3c" stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> Dona suport</button>`
            : '';
    const supportBtnMobile =
        !info.program && channelHasSupport(channel.id)
            ? `<button class="btn-support-watch btn-support-watch--mobile js-support-btn" type="button" data-support-channel="${channel.id}" data-support-name="${escapeHtml(info.channelName || info.displayName)}"><svg viewBox="0 0 24 24" width="14" height="14" fill="#e74c3c" stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> Dona suport</button>`
            : '';

    const hasSupportMobile = !info.program && channelHasSupport(channel.id);
    const channelActionRowHtml = hasSupportMobile ? `<div class="channel-action-row"></div>` : '';

    return `
        <div class="video-info-modern">
            <div class="channel-header-row">
                <div class="channel-identity-modern channel-link" data-channel-id="${channel.id}" ${info.program ? `data-program-id="${escapeHtml(info.program.id)}"` : ''}>
                    <img src="${avatar}" alt="${escapeHtml(info.displayName)}" class="channel-avatar-small">
                    <div class="channel-text-modern">
                        <h2 class="channel-name-modern">${escapeHtml(info.displayName)}</h2>
                        ${info.secondaryText ? `<span class="channel-program-context">${escapeHtml(info.secondaryText)}</span>` : ''}
                        ${info.subscribersText ? `<span class="channel-subs-modern">${info.subscribersText}</span>` : ''}
                    </div>
                </div>
                <div class="channel-actions-inline">
                    ${followButtonHtml}
                    ${supportBtnDesktop}
                    <button class="btn-heart" id="likeToggle" type="button" aria-label="M'agrada" aria-pressed="false">
                        <i data-lucide="heart"></i>
                    </button>
                </div>
            </div>
            ${channelActionRowHtml}
            <div class="video-metadata-bar">
                <div class="action-group action-group-left">
                    <a href="https://www.youtube.com/channel/${channel.id}" target="_blank" rel="noopener noreferrer" class="btn-pill-red">
                        Canal Youtube
                    </a>
                    ${supportBtnMobile}
                    <a href="${watchUrl}" target="_blank" rel="noopener noreferrer" class="btn-round-icon btn-comment-youtube--desktop" title="Comenta" aria-label="Comenta">
                        <i data-lucide="message-circle"></i>
                    </a>
                </div>
                <div class="action-group">
                    <a href="${watchUrl}" target="_blank" rel="noopener noreferrer" class="btn-round-icon btn-comment-youtube--mobile" title="Comenta" aria-label="Comenta">
                        <i data-lucide="message-circle"></i>
                    </a>
                    <button class="btn-round-icon" id="playlistBtn" title="Afegir a llista" aria-label="Afegir a llista">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                    <button class="btn-round-icon" id="shareBtn" title="Compartir" aria-label="Compartir">
                        <i data-lucide="share-2"></i>
                    </button>
                    <button class="btn-round-icon" id="miniPlayerToggle" type="button" title="Mini reproductor" aria-label="Mini reproductor">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <rect x="2" y="3" width="20" height="14" rx="2"></rect>
                            <rect x="4" y="12" width="6" height="4" rx="1" fill="white" stroke="none"></rect>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ==================== REPOSICIÓ DELS BOTONS DE CANAL EN MÒBIL ====================
// En mòbil, SI el canal té "Dona suport", es mouen els botons "Dona suport" i
// "Segueix" a una nova fila (.channel-action-row) sota la fila del canal:
// "Dona suport" alineat a l'esquerra i "Segueix" alineat a la dreta.
// Si el canal NO té suport, no es fa res: "Segueix" queda a la seva posició
// original dins channel-actions-inline (stacked amb el cor, a la dreta).
// En desktop els restaurem a les posicions canòniques generades al HTML.
function repositionSupportButton() {
    const videoInfoModern = document.querySelector('.video-info-modern');
    if (!videoInfoModern) return;

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const followBtn = videoInfoModern.querySelector('.follow-btn-pill');
    const supportBtnMobile = videoInfoModern.querySelector('.btn-support-watch--mobile');
    const channelActionRow = videoInfoModern.querySelector('.channel-action-row');
    const channelActionsInline = videoInfoModern.querySelector('.channel-actions-inline');
    const actionGroupLeft = videoInfoModern.querySelector('.action-group-left');

    // En mòbil amb suport: mou els dos botons a channel-action-row
    if (isMobile && supportBtnMobile && channelActionRow) {
        // Ordre DOM: suport primer (esquerra), segueix després (dreta)
        channelActionRow.appendChild(supportBtnMobile);
        if (followBtn) {
            channelActionRow.appendChild(followBtn);
        }
        return;
    }

    // Altrament: restaurar posicions canòniques
    // follow-btn-pill → channel-actions-inline (al principi)
    if (followBtn && channelActionsInline && !channelActionsInline.contains(followBtn)) {
        channelActionsInline.prepend(followBtn);
    }
    // btn-support-watch--mobile → action-group-left (just després del Canal YouTube)
    if (supportBtnMobile && actionGroupLeft && !actionGroupLeft.contains(supportBtnMobile)) {
        const canalBtn = actionGroupLeft.querySelector('.btn-pill-red');
        if (canalBtn) {
            canalBtn.after(supportBtnMobile);
        } else {
            actionGroupLeft.appendChild(supportBtnMobile);
        }
    }
}

// Listener global de resize — s'instal·la un sol cop i reacciona a canvis de viewport
let _repositionSupportRaf = null;
let _repositionSupportResizeBound = false;
function ensureRepositionSupportResizeListener() {
    if (_repositionSupportResizeBound) return;
    _repositionSupportResizeBound = true;
    window.addEventListener('resize', () => {
        if (_repositionSupportRaf) return;
        _repositionSupportRaf = requestAnimationFrame(() => {
            _repositionSupportRaf = null;
            repositionSupportButton();
            syncChannelProfileActionsLayout();
        });
    });
}

function openCreateProgramModal() {
    if (!createProgramModal) return;
    const wasActive = createProgramModal.classList.contains('active');
    createProgramModal.classList.add('active');
    if (!wasActive) {
        history.pushState({ ...(history.state || {}), modal: 'create-program' }, '', window.location.href);
    }
    // Netejar formulari
    const creatorSearch = document.getElementById('programCreatorSearch');
    const nameInput = document.getElementById('programNameInput');
    const descInput = document.getElementById('programDescriptionInput');
    const results = document.getElementById('programCreatorResults');
    const msg = document.getElementById('createProgramMessage');
    if (creatorSearch) {
        creatorSearch.value = '';
        creatorSearch.dataset.selectedChannelId = '';
        creatorSearch.style.display = '';
    }
    if (nameInput) nameInput.value = '';
    if (descInput) descInput.value = '';
    if (results) {
        results.innerHTML = '';
        results.classList.add('hidden');
    }
    if (msg) {
        msg.classList.add('hidden');
        msg.textContent = '';
    }
    // Eliminar selecció prèvia si existeix
    const prevSelected = createProgramModal.querySelector('.program-selected-creator');
    if (prevSelected) prevSelected.remove();

    setTimeout(() => {
        requestAnimationFrame(() => refreshIcons(createProgramModal));
    }, 50);
}

function closeCreateProgramModal(fromPopstate = false) {
    if (!createProgramModal) return;
    const wasActive = createProgramModal.classList.contains('active');
    createProgramModal.classList.remove('active');
    if (wasActive && !fromPopstate && history.state && history.state.modal === 'create-program') {
        suppressNextPopstateNavigation = true;
        history.back();
    }
}

function initCreateProgramModal() {
    createProgramModal = document.getElementById('createProgramModal');
    if (!createProgramModal) return;

    const closeBtn = document.getElementById('closeCreateProgramModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => closeCreateProgramModal());
    }
    createProgramModal.addEventListener('click', e => {
        if (e.target === createProgramModal) closeCreateProgramModal();
    });

    const creatorSearch = document.getElementById('programCreatorSearch');
    const resultsContainer = document.getElementById('programCreatorResults');
    const submitBtn = document.getElementById('createProgramSubmitBtn');

    // Cerca de creadors (només Youtubers, Mitjans, Entitats, Digitals)
    if (creatorSearch && resultsContainer) {
        let debounceTimer = null;
        creatorSearch.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            const query = creatorSearch.value.trim().toLowerCase();
            if (query.length < 2) {
                resultsContainer.classList.add('hidden');
                resultsContainer.innerHTML = '';
                return;
            }
            debounceTimer = setTimeout(() => {
                const allChannels = Array.isArray(YouTubeAPI?.getAllChannels?.()) ? YouTubeAPI.getAllChannels() : [];
                const filtered = allChannels
                    .filter(ch => {
                        const name = (ch.name || ch.title || '').toLowerCase();
                        const handle = (ch.handle || '').toLowerCase();
                        return name.includes(query) || handle.includes(query);
                    })
                    .slice(0, 15);

                if (filtered.length === 0) {
                    resultsContainer.innerHTML = '<div class="program-creator-item"><span>Cap resultat</span></div>';
                } else {
                    resultsContainer.innerHTML = filtered
                        .map(ch => {
                            const avatar = ch.avatar || ch.thumbnail || 'img/icon-192.png';
                            const name = escapeHtml(ch.name || ch.title || 'Canal');
                            return `<div class="program-creator-item" data-channel-id="${ch.id}">
                            <img src="${avatar}" alt="${name}" loading="lazy">
                            <span>${name}</span>
                        </div>`;
                        })
                        .join('');
                }
                resultsContainer.classList.remove('hidden');

                // Clicks als resultats
                resultsContainer.querySelectorAll('.program-creator-item[data-channel-id]').forEach(item => {
                    item.addEventListener('click', () => {
                        const chId = item.dataset.channelId;
                        const chName = item.querySelector('span')?.textContent || '';
                        const chAvatar = item.querySelector('img')?.src || 'img/icon-192.png';
                        selectProgramCreator(chId, chName, chAvatar);
                        resultsContainer.classList.add('hidden');
                    });
                });
            }, 200);
        });

        // Tancar resultats si es clica fora
        document.addEventListener('click', e => {
            if (!creatorSearch.contains(e.target) && !resultsContainer.contains(e.target)) {
                resultsContainer.classList.add('hidden');
            }
        });
    }

    // Botó crear
    if (submitBtn) {
        submitBtn.addEventListener('click', () => {
            const creatorSearch2 = document.getElementById('programCreatorSearch');
            const channelId = creatorSearch2?.dataset.selectedChannelId;
            const nameInput = document.getElementById('programNameInput');
            const descInput = document.getElementById('programDescriptionInput');
            const msg = document.getElementById('createProgramMessage');

            const name = (nameInput?.value || '').trim();
            if (!channelId) {
                if (msg) {
                    msg.textContent = 'Has de seleccionar un creador.';
                    msg.className = 'add-youtuber-message add-youtuber-message--error';
                    msg.classList.remove('hidden');
                }
                return;
            }
            if (!name) {
                if (msg) {
                    msg.textContent = 'Has de posar un nom al programa.';
                    msg.className = 'add-youtuber-message add-youtuber-message--error';
                    msg.classList.remove('hidden');
                }
                return;
            }

            createProgram(channelId, name, descInput?.value || '');
            if (msg) {
                msg.textContent = `Programa "${escapeHtml(name)}" creat!`;
                msg.className = 'add-youtuber-message add-youtuber-message--success';
                msg.classList.remove('hidden');
            }
            setTimeout(() => {
                closeCreateProgramModal();
                if (activeFollowTab === 'programes') {
                    renderFollowPage();
                }
            }, 800);
        });
    }
}

function selectProgramCreator(channelId, channelName, channelAvatar) {
    const creatorSearch = document.getElementById('programCreatorSearch');
    if (!creatorSearch) return;
    creatorSearch.dataset.selectedChannelId = channelId;
    creatorSearch.style.display = 'none';

    // Mostrar selecció
    const wrap = creatorSearch.closest('.program-creator-search-wrap');
    if (!wrap) return;
    const prevSelected = wrap.querySelector('.program-selected-creator');
    if (prevSelected) prevSelected.remove();

    const selectedDiv = document.createElement('div');
    selectedDiv.className = 'program-selected-creator';
    selectedDiv.innerHTML = `
        <img src="${channelAvatar}" alt="${escapeHtml(channelName)}">
        <span>${escapeHtml(channelName)}</span>
        <button type="button" aria-label="Canviar creador">&times;</button>
    `;
    wrap.appendChild(selectedDiv);

    selectedDiv.querySelector('button').addEventListener('click', () => {
        creatorSearch.dataset.selectedChannelId = '';
        creatorSearch.style.display = '';
        creatorSearch.value = '';
        selectedDiv.remove();
    });
}

async function openProgramProfile(programId) {
    const program = getProgramById(programId);
    if (!program) return;

    const channelId = program.channelId;
    if (!channelId) return;

    handlePlayerVisibilityOnNavigation();
    exitPlaylistMode();

    const normalizedId = String(channelId);
    const channels = Array.isArray(YouTubeAPI?.getAllChannels?.()) ? YouTubeAPI.getAllChannels() : [];
    const channel = channels.find(item => String(item.id) === normalizedId);

    if (!channelPage || !channelVideosGrid) return;

    if (mainContent) mainContent.classList.remove('hidden');
    if (historyPage) historyPage.classList.add('hidden');
    if (playlistsPage) playlistsPage.classList.add('hidden');
    if (followPage) followPage.classList.add('hidden');
    if (channelPage) channelPage.classList.add('hidden');
    if (chipsBar) chipsBar.classList.add('hidden');
    if (homePage) homePage.classList.add('hidden');
    if (watchPage) watchPage.classList.add('hidden');
    channelPage.classList.remove('hidden');
    isProgramProfileActive = true;
    currentProgramId = String(program.id || '');
    channelPage.classList.add('channel-page--program-profile');

    const channelAvatar =
        channel?.avatar || channel?.thumbnail || getFollowChannelAvatar(normalizedId) || 'img/icon-192.png';
    if (channelProfileAvatar) {
        channelProfileAvatar.src = channelAvatar;
        channelProfileAvatar.alt = program.name;
    }
    if (channelProfileName) {
        channelProfileName.textContent = program.name;
    }
    if (channelProfileHandle) {
        const handle = program.name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[\u2018\u2019\u201A\u201B\u0060\u00B4']/g, '')
            .replace(/[^a-zA-Z0-9]/g, '')
            .toLowerCase();
        channelProfileHandle.textContent = `@${handle}`;
        channelProfileHandle.classList.remove('hidden');
    }
    if (channelProfileSubscribers) {
        channelProfileSubscribers.textContent = '';
        channelProfileSubscribers.classList.add('hidden');
    }
    if (channelProfileDescription) {
        channelProfileDescription.textContent = program.description || '';
    }

    // Categories personalitzades del programa
    if (channelProfileTags) {
        renderProgramCategories(program);
    }

    // Amagar botó suport per programes, mostrar follow
    const channelSupportBtn = document.getElementById('channelSupportBtn');
    if (channelSupportBtn) channelSupportBtn.classList.add('hidden');
    if (channelProfileFollowBtn) {
        channelProfileFollowBtn.dataset.followChannel = normalizedId;
        channelProfileFollowBtn.dataset.followBound = 'false';
        channelProfileFollowBtn.classList.remove('hidden');
    }
    if (channelProfileHideBtn) {
        channelProfileHideBtn.dataset.hideChannel = normalizedId;
        channelProfileHideBtn.dataset.hideBound = 'false';
        channelProfileHideBtn.classList.add('hidden');
    }
    bindFollowButtons(channelPage);
    bindHideChannelButtons(channelPage);

    // Botó compartir
    if (channelProfileShareBtn) {
        channelProfileShareBtn.dataset.shareChannelId = normalizedId;
        channelProfileShareBtn.dataset.shareChannelName = encodeURIComponent(program.name);
        channelProfileShareBtn.dataset.shareChannelDescription = encodeURIComponent(program.description || '');
        channelProfileShareBtn.dataset.shareProgramName = encodeURIComponent(program.name);
        channelProfileShareBtn.dataset.shareProgramId = program.id;
    }
    syncChannelProfileActionsLayout();

    // Carregar vídeos del canal filtrats pel nom del programa (només títol)
    const channelVideos = await YouTubeAPI.getChannelVideosWithHistory(normalizedId);
    const programNameNorm = normalizeProgramText(program.name);
    const filteredVideos = (Array.isArray(channelVideos) ? channelVideos : []).filter(video => {
        const title = normalizeProgramText(video.title || '');
        return title.includes(programNameNorm);
    });
    currentChannelId = normalizedId;
    currentChannelName = program.name;
    currentChannelVideos = filteredVideos;
    currentChannelShorts = currentChannelVideos.filter(video => video.isShort);
    currentChannelLongVideos = currentChannelVideos.filter(video => !video.isShort);

    if (channelSearchInputDesktop) channelSearchInputDesktop.value = '';
    if (channelSearchInputMobile) channelSearchInputMobile.value = '';

    currentChannelVideos.forEach(video => {
        if (!cachedAPIVideos.find(v => String(v.id) === String(video.id))) {
            cachedAPIVideos.push(video);
        }
    });

    renderChannelVideos('');
    window.scrollTo(0, 0);
}

function syncChannelProfileActionsLayout() {
    if (!channelPage) return;
    const titleRow = channelPage.querySelector('.channel-profile-title-row');
    const infoRow = channelPage.querySelector('.channel-profile-info-row');
    const actions = channelPage.querySelector('.channel-profile-actions');
    if (!titleRow || !infoRow || !actions) return;

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const moveToInfoRow = isMobile;

    if (moveToInfoRow) {
        if (actions.parentElement !== infoRow) {
            const supportWrap = infoRow.querySelector('#channelSupportBtn');
            if (supportWrap) {
                infoRow.insertBefore(actions, supportWrap);
            } else {
                infoRow.appendChild(actions);
            }
        }
        return;
    }

    if (actions.parentElement !== titleRow) {
        titleRow.appendChild(actions);
    }
}

function renderProgramCategories(program) {
    if (!channelProfileTags) return;

    const customCats = Array.isArray(program.customCategories) ? program.customCategories : [];
    const assignedSet = new Set(customCats.map(c => c.toLowerCase()));

    // Obtenir categories personalitzades de l'usuari que no estiguin ja assignades
    const availableTags = getCustomTags()
        .filter(tag => !assignedSet.has(tag.toLowerCase()))
        .sort((a, b) => a.localeCompare(b));

    const addButtonHtml = `
        <button class="channel-category-add" type="button" data-action="add-program-category" aria-label="Afegir categoria">
            <span class="channel-category-add-plus" aria-hidden="true">+</span>
        </button>
    `;

    const customButtonsHtml = customCats
        .map(
            cat => `
        <button class="channel-category-btn channel-category-btn--custom" type="button" data-program-category="${escapeHtml(cat)}">${escapeHtml(cat)}</button>
    `
        )
        .join('');

    const pickerOptionsHtml =
        availableTags.length > 0
            ? availableTags
                  .map(
                      tag => `
            <button class="channel-category-option" type="button" data-program-category-option="${escapeHtml(tag)}">${escapeHtml(tag)}</button>
        `
                  )
                  .join('')
            : '<span class="channel-category-empty">No hi ha categories personalitzades.</span>';

    channelProfileTags.classList.remove('hidden');
    channelProfileTags.innerHTML = `
        <div class="channel-profile-categories">
            ${customButtonsHtml}
            ${addButtonHtml}
            <div class="channel-category-picker hidden" data-program-category-picker>
                ${pickerOptionsHtml}
            </div>
        </div>
    `;

    const addButton = channelProfileTags.querySelector('[data-action="add-program-category"]');
    const picker = channelProfileTags.querySelector('[data-program-category-picker]');

    if (addButton && picker) {
        addButton.addEventListener('click', event => {
            event.stopPropagation();
            const isOpen = !picker.classList.contains('hidden');
            picker.classList.toggle('hidden', isOpen);
            addButton.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
        });
    }

    // Seleccionar categoria del picker
    channelProfileTags.querySelectorAll('[data-program-category-option]').forEach(button => {
        button.addEventListener('click', () => {
            const selected = button.dataset.programCategoryOption;
            if (!selected) return;
            if (!program.customCategories) program.customCategories = [];
            if (!program.customCategories.includes(selected)) {
                program.customCategories.push(selected);
                updateProgram(program.id, { customCategories: program.customCategories });
                renderProgramCategories(program);
            }
        });
    });

    // Tancar picker si es clica fora
    const onDocClick = e => {
        if (!channelProfileTags.contains(e.target)) {
            picker?.classList.add('hidden');
            addButton?.setAttribute('aria-expanded', 'false');
        }
    };
    document.addEventListener('click', onDocClick);

    // Doble clic / long press per eliminar categories
    const customButtons = channelProfileTags.querySelectorAll('[data-program-category]');
    customButtons.forEach(button => {
        const cat = button.dataset.programCategory;
        button.style.cursor = 'pointer';
        addLongPressOrDblClick(button, () => {
            program.customCategories = (program.customCategories || []).filter(c => c !== cat);
            updateProgram(program.id, { customCategories: program.customCategories });
            renderProgramCategories(program);
        });
    });
}

function bindChannelLinks(container = document) {
    if (!container || container._channelLinksDelegated) {
        return;
    }
    container._channelLinksDelegated = true;

    container.addEventListener(
        'click',
        event => {
            const link = event.target.closest('.channel-link');
            if (!link || !container.contains(link)) {
                return;
            }

            const programId = String(link.dataset.programId || '').trim();
            if (programId) {
                event.preventDefault();
                event.stopPropagation();
                openProgramProfile(programId);
                return;
            }

            const channelId = String(link.dataset.channelId || '').trim();
            if (!channelId) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            openChannelProfile(channelId);
        },
        { capture: true }
    );
}

// Cache de l'índex d'arxiu en localStorage (evita fetch de 500-2000ms)
function saveArchiveIndexCache() {
    // Deferir i limitar mida per evitar congelacions llargues al fil principal
    const defer = typeof requestIdleCallback === 'function' ? cb => requestIdleCallback(cb) : cb => setTimeout(cb, 0);
    defer(() => {
        try {
            if (!searchArchiveIndexCache.length) return;
            const buckets = Array.from(loadedSearchArchiveBuckets);
            const items = searchArchiveIndexCache.slice(0, ARCHIVE_INDEX_CACHE_MAX_ITEMS);
            const payload = {
                items,
                buckets,
                ts: Date.now(),
                truncated: searchArchiveIndexCache.length > items.length,
            };
            const serialized = JSON.stringify(payload);
            if (serialized.length > ARCHIVE_INDEX_CACHE_MAX_CHARS) {
                return;
            }
            localStorage.setItem(ARCHIVE_INDEX_CACHE_KEY, serialized);
        } catch (_) {}
    }, 0);
}

function loadArchiveIndexCache() {
    try {
        const raw = localStorage.getItem(ARCHIVE_INDEX_CACHE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data || Date.now() - data.ts > ARCHIVE_INDEX_CACHE_TTL) {
            localStorage.removeItem(ARCHIVE_INDEX_CACHE_KEY);
            return false;
        }
        if (Array.isArray(data.items) && data.items.length > 0) {
            searchArchiveIndexCache = data.items;
            if (Array.isArray(data.buckets)) {
                data.buckets.forEach(bucket => loadedSearchArchiveBuckets.add(String(bucket)));
            } else if (Array.isArray(data.years)) {
                data.years.forEach(year => loadedSearchArchiveBuckets.add(String(year)));
            }
            return true;
        }
        return false;
    } catch (_) {
        return false;
    }
}

// Categories personalitzades i etiquetes
function normalizeCustomTag(tag) {
    if (!tag || typeof tag !== 'string') return '';
    return tag.trim().replace(/^"|"$/g, '');
}

function getStandardChipLabels() {
    const configLabels = Array.isArray(CONFIG?.categories)
        ? CONFIG.categories.map(cat => cat.name).filter(Boolean)
        : [];
    return ['Novetats', 'Descobreix', ...configLabels, 'Seguint'];
}

function isStandardCategory(tag) {
    const normalized = normalizeCustomTag(tag).toLowerCase();
    if (!normalized) {
        return false;
    }
    return getStandardChipLabels().some(label => label.toLowerCase() === normalized);
}
function getCustomTags() {
    const stored = localStorage.getItem(CUSTOM_TAGS_STORAGE_KEY);
    if (!stored) {
        return [];
    }
    try {
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.map(tag => normalizeCustomTag(tag)).filter(tag => tag);
    } catch (error) {
        console.warn('No es pot llegir catube_custom_tags', error);
        return [];
    }
}

function saveCustomTags(tags) {
    if (!Array.isArray(tags)) {
        return;
    }
    localStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(tags));
}

function addCustomTag(tag) {
    const normalized = normalizeCustomTag(tag);
    if (!normalized) {
        return null;
    }
    if (isStandardCategory(normalized)) {
        return normalized;
    }
    const tags = getCustomTags();
    const exists = tags.some(existing => existing.toLowerCase() === normalized.toLowerCase());
    if (exists) {
        return tags.find(existing => existing.toLowerCase() === normalized.toLowerCase()) || normalized;
    }
    const nextTags = [...tags, normalized];
    saveCustomTags(nextTags);

    const storedOrder = getStoredChipOrder();
    if (storedOrder && !storedOrder.some(value => value.toLowerCase() === normalized.toLowerCase())) {
        saveChipOrder([...storedOrder, normalized]);
    }
    return normalized;
}

// Cache en memòria per evitar localStorage.getItem + JSON.parse per cada vídeo
let _channelCustomCatsCache = null;

function _getChannelCustomCatsParsed() {
    if (_channelCustomCatsCache) return _channelCustomCatsCache;
    const stored = localStorage.getItem(CHANNEL_CUSTOM_CATEGORIES_KEY);
    if (!stored) {
        _channelCustomCatsCache = {};
        return _channelCustomCatsCache;
    }
    try {
        const parsed = JSON.parse(stored);
        _channelCustomCatsCache = parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        console.warn('No es pot llegir catube_channel_custom_categories', error);
        _channelCustomCatsCache = {};
    }
    return _channelCustomCatsCache;
}

function invalidateChannelCustomCatsCache() {
    _channelCustomCatsCache = null;
}

function getChannelCustomCategories(channelId) {
    if (!channelId) {
        return [];
    }
    const parsed = _getChannelCustomCatsParsed();
    const saved = parsed[String(channelId)];
    if (!Array.isArray(saved)) {
        return [];
    }
    return saved.map(tag => normalizeCustomTag(tag)).filter(tag => tag);
}

function saveChannelCustomCategories(channelId, categories) {
    if (!channelId) {
        return;
    }
    const stored = localStorage.getItem(CHANNEL_CUSTOM_CATEGORIES_KEY);
    let parsed = {};
    if (stored) {
        try {
            parsed = JSON.parse(stored) || {};
        } catch (error) {
            console.warn('No es pot llegir catube_channel_custom_categories', error);
            parsed = {};
        }
    }
    if (!Array.isArray(categories) || categories.length === 0) {
        delete parsed[String(channelId)];
    } else {
        parsed[String(channelId)] = categories;
    }
    localStorage.setItem(CHANNEL_CUSTOM_CATEGORIES_KEY, JSON.stringify(parsed));
    invalidateChannelCustomCatsCache();
}

function removeCategoryFromChannel(channelId, category) {
    const normalized = normalizeCustomTag(category);
    if (!normalized) return;
    const current = getChannelCustomCategories(channelId);
    const next = current.filter(c => c.toLowerCase() !== normalized.toLowerCase());
    saveChannelCustomCategories(channelId, next);
}

function addChannelCustomCategory(channelId, category) {
    if (!channelId) {
        return [];
    }
    const normalized = normalizeCustomTag(category);
    if (!normalized) {
        return getChannelCustomCategories(channelId);
    }
    const current = getChannelCustomCategories(channelId);
    const exists = current.some(item => item.toLowerCase() === normalized.toLowerCase());
    if (exists) {
        return current;
    }
    const next = [...current, normalized];
    saveChannelCustomCategories(channelId, next);
    return next;
}

function getChannelsForCategory(categoryName) {
    const normalized = normalizeCustomTag(categoryName);
    if (!normalized) {
        return [];
    }
    const stored = localStorage.getItem(CHANNEL_CUSTOM_CATEGORIES_KEY);
    if (!stored) {
        return [];
    }
    try {
        const parsed = JSON.parse(stored);
        if (!parsed || typeof parsed !== 'object') {
            return [];
        }
        const channelIds = [];
        for (const [channelId, categories] of Object.entries(parsed)) {
            if (
                Array.isArray(categories) &&
                categories.some(cat => normalizeCustomTag(cat)?.toLowerCase() === normalized.toLowerCase())
            ) {
                channelIds.push(channelId);
            }
        }
        return channelIds;
    } catch (error) {
        console.warn('No es pot llegir catube_channel_custom_categories', error);
        return [];
    }
}

// ==================== ETIQUETES DE CATEGORIA ====================
// Cada categoria personalitzada pot tenir paraules clau addicionals que amplien la cerca.
// Emmagatzemat com { "Viatge": ["Viatges", "Aventura"], ... }

let _categoryKeywordsCache = null;

function _getCategoryKeywordsParsed() {
    if (_categoryKeywordsCache) return _categoryKeywordsCache;
    const stored = localStorage.getItem(CATEGORY_KEYWORDS_STORAGE_KEY);
    if (!stored) {
        _categoryKeywordsCache = {};
        return _categoryKeywordsCache;
    }
    try {
        const parsed = JSON.parse(stored);
        _categoryKeywordsCache = parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        console.warn('No es pot llegir catube_category_keywords', error);
        _categoryKeywordsCache = {};
    }
    return _categoryKeywordsCache;
}

function invalidateCategoryKeywordsCache() {
    _categoryKeywordsCache = null;
}

function getCategoryKeywords(categoryName) {
    const normalized = normalizeCustomTag(categoryName);
    if (!normalized) return [];
    const parsed = _getCategoryKeywordsParsed();
    // Cercar per clau case-insensitive
    for (const [key, value] of Object.entries(parsed)) {
        if (key.toLowerCase() === normalized.toLowerCase() && Array.isArray(value)) {
            return value;
        }
    }
    return [];
}

function saveCategoryKeywords(categoryName, keywords) {
    const normalized = normalizeCustomTag(categoryName);
    if (!normalized) return;
    const stored = localStorage.getItem(CATEGORY_KEYWORDS_STORAGE_KEY);
    let parsed = {};
    if (stored) {
        try {
            parsed = JSON.parse(stored) || {};
        } catch (error) {
            parsed = {};
        }
    }
    // Eliminar claus duplicades case-insensitive
    for (const key of Object.keys(parsed)) {
        if (key.toLowerCase() === normalized.toLowerCase() && key !== normalized) {
            delete parsed[key];
        }
    }
    if (!Array.isArray(keywords) || keywords.length === 0) {
        delete parsed[normalized];
    } else {
        parsed[normalized] = keywords;
    }
    localStorage.setItem(CATEGORY_KEYWORDS_STORAGE_KEY, JSON.stringify(parsed));
    invalidateCategoryKeywordsCache();
}

function addCategoryKeyword(categoryName, keyword) {
    const normalizedCat = normalizeCustomTag(categoryName);
    const normalizedKw = String(keyword || '').trim();
    if (!normalizedCat || !normalizedKw) return [];
    const current = getCategoryKeywords(normalizedCat);
    const exists = current.some(kw => kw.toLowerCase() === normalizedKw.toLowerCase());
    if (exists) return current;
    const next = [...current, normalizedKw];
    saveCategoryKeywords(normalizedCat, next);
    return next;
}

function removeCategoryKeyword(categoryName, keyword) {
    const normalizedCat = normalizeCustomTag(categoryName);
    const normalizedKw = String(keyword || '')
        .trim()
        .toLowerCase();
    if (!normalizedCat || !normalizedKw) return [];
    const current = getCategoryKeywords(normalizedCat);
    const next = current.filter(kw => kw.toLowerCase() !== normalizedKw);
    saveCategoryKeywords(normalizedCat, next);
    return next;
}

function getCategoryLabel(category) {
    const normalized = normalizeCustomTag(category);
    if (!normalized) {
        return '';
    }
    const matched = Array.isArray(CONFIG?.categories)
        ? CONFIG.categories.find(
              cat =>
                  cat.id.toLowerCase() === normalized.toLowerCase() ||
                  cat.name.toLowerCase() === normalized.toLowerCase()
          )
        : null;
    return matched ? matched.name : normalized;
}

function renderChannelProfileCategories(channel, channelId) {
    if (!channelProfileTags) {
        return;
    }
    const baseCategories = Array.isArray(channel?.categories) ? channel.categories : [];
    const baseLabels = baseCategories.map(getCategoryLabel).filter(Boolean);
    const customAssignments = getChannelCustomCategories(channelId);
    const customEntries = customAssignments
        .map(tag => ({ tag, label: getCategoryLabel(tag) }))
        .filter(entry => entry.label);
    const seen = new Set();
    const uniqueBaseLabels = baseLabels.filter(label => {
        const key = label.toLowerCase();
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
    const uniqueCustomEntries = customEntries.filter(entry => {
        const key = entry.label.toLowerCase();
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });

    const addButtonHtml = `
        <button class="channel-category-add" type="button" data-action="add-channel-category" aria-label="Afegir categoria personalitzada">
            <span class="channel-category-add-plus" aria-hidden="true">+</span>
        </button>
    `;

    const baseButtonsHtml = uniqueBaseLabels
        .map(
            label => `
            <button class="channel-category-btn" type="button">${escapeHtml(label)}</button>
        `
        )
        .join('');

    const customButtonsHtml = uniqueCustomEntries
        .map(
            entry => `
            <button class="channel-category-btn channel-category-btn--custom" type="button" data-channel-category="${escapeHtml(entry.tag)}">${escapeHtml(entry.label)}</button>
        `
        )
        .join('');

    const availableCustomTags = getCustomTags()
        .filter(tag => !seen.has(tag.toLowerCase()))
        .sort((a, b) => a.localeCompare(b));

    const pickerOptionsHtml =
        availableCustomTags.length > 0
            ? availableCustomTags
                  .map(
                      tag => `
            <button class="channel-category-option" type="button" data-channel-category-option="${escapeHtml(tag)}">${escapeHtml(tag)}</button>
        `
                  )
                  .join('')
            : '<span class="channel-category-empty">No hi ha categories personalitzades.</span>';

    const shouldShowAdd = uniqueBaseLabels.length > 0 || availableCustomTags.length > 0;
    const addButtonFallback = shouldShowAdd ? addButtonHtml : '';

    channelProfileTags.classList.toggle(
        'hidden',
        uniqueBaseLabels.length === 0 && uniqueCustomEntries.length === 0 && !shouldShowAdd
    );
    channelProfileTags.innerHTML = `
        <div class="channel-profile-categories">
            ${baseButtonsHtml}
            ${customButtonsHtml}
            ${addButtonFallback}
            <div class="channel-category-picker hidden" data-channel-category-picker>
                ${pickerOptionsHtml}
            </div>
        </div>
    `;

    const addButton = channelProfileTags.querySelector('[data-action="add-channel-category"]');
    const picker = channelProfileTags.querySelector('[data-channel-category-picker]');
    const optionButtons = channelProfileTags.querySelectorAll('[data-channel-category-option]');
    const customButtons = channelProfileTags.querySelectorAll('.channel-category-btn--custom');
    const customCategories = getCustomTags();

    if (channelCategoryPickerCleanup) {
        channelCategoryPickerCleanup();
        channelCategoryPickerCleanup = null;
    }

    const closePicker = () => {
        picker?.classList.add('hidden');
        addButton?.setAttribute('aria-expanded', 'false');
    };

    addButton?.addEventListener('click', event => {
        event.stopPropagation();
        if (!picker) {
            return;
        }
        const isOpen = !picker.classList.contains('hidden');
        picker.classList.toggle('hidden', isOpen);
        addButton.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    });

    optionButtons.forEach(button => {
        button.addEventListener('click', () => {
            const selected = button.dataset.channelCategoryOption;
            if (!selected) {
                return;
            }
            addChannelCustomCategory(channelId, selected);
            renderChannelProfileCategories(channel, channelId);
        });
    });

    customButtons.forEach(button => {
        const tagValue = button.dataset.channelCategory || button.textContent;
        const normalizedTag = normalizeCustomTag(tagValue).toLowerCase();
        const isCustom = customCategories.some(cat => cat.toLowerCase() === normalizedTag);
        if (!isCustom) {
            return;
        }
        button.style.cursor = 'pointer';
        addLongPressOrDblClick(button, () => {
            removeCategoryFromChannel(channelId, tagValue);
            renderChannelProfileCategories(channel, channelId);

            if (selectedCategory && normalizeCustomTag(selectedCategory).toLowerCase() === normalizedTag) {
                updateFeed();
            }
        });
    });

    const onDocumentClick = event => {
        if (!channelProfileTags.contains(event.target)) {
            closePicker();
        }
    };
    document.addEventListener('click', onDocumentClick);
    channelCategoryPickerCleanup = () => {
        document.removeEventListener('click', onDocumentClick);
    };
}

function isCustomCategoryTag(tag) {
    const normalized = normalizeCustomTag(tag).toLowerCase();
    if (!normalized) {
        return false;
    }
    return getCustomTags().some(existing => existing.toLowerCase() === normalized);
}

function removeCustomTag(tag) {
    const normalized = normalizeCustomTag(tag);
    if (!normalized) {
        return false;
    }
    const tags = getCustomTags();
    const nextTags = tags.filter(existing => existing.toLowerCase() !== normalized.toLowerCase());
    if (nextTags.length === tags.length) {
        return false;
    }
    saveCustomTags(nextTags);
    unmarkExactCategory(normalized);

    const storedOrder = getStoredChipOrder();
    if (storedOrder) {
        saveChipOrder(storedOrder.filter(value => value.toLowerCase() !== normalized.toLowerCase()));
    }
    return true;
}

// Gestió de categories exactes (creades amb cerca entre cometes "")
function _getExactCategories() {
    const stored = localStorage.getItem(EXACT_CATEGORIES_STORAGE_KEY);
    if (!stored) return [];
    try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_e) {
        return [];
    }
}

function _saveExactCategories(list) {
    localStorage.setItem(EXACT_CATEGORIES_STORAGE_KEY, JSON.stringify(list));
}

function markExactCategory(categoryName) {
    const normalized = normalizeCustomTag(categoryName).toLowerCase();
    if (!normalized) return;
    const list = _getExactCategories();
    if (!list.some(c => c.toLowerCase() === normalized)) {
        list.push(normalized);
        _saveExactCategories(list);
    }
}

function unmarkExactCategory(categoryName) {
    const normalized = normalizeCustomTag(categoryName).toLowerCase();
    if (!normalized) return;
    const list = _getExactCategories().filter(c => c.toLowerCase() !== normalized);
    _saveExactCategories(list);
}

function isExactCategory(categoryName) {
    const normalized = normalizeCustomTag(categoryName).toLowerCase();
    if (!normalized) return false;
    return _getExactCategories().some(c => c.toLowerCase() === normalized);
}

function isCustomCategory(category) {
    const normalized = normalizeCustomTag(category).toLowerCase();
    if (!normalized) {
        return false;
    }
    return getCustomTags().some(tag => tag.toLowerCase() === normalized);
}

// Retorna els IDs de canals que pertanyen a categories personalitzades actives a la barra
function getRadarChannelIds() {
    const activeTags = getCustomTags();
    if (activeTags.length === 0) return new Set();

    const activeTagsLower = new Set(activeTags.map(t => t.toLowerCase()));
    const parsed = _getChannelCustomCatsParsed();
    const channelIds = new Set();

    for (const [channelId, cats] of Object.entries(parsed)) {
        if (!Array.isArray(cats)) continue;
        for (const cat of cats) {
            if (activeTagsLower.has(normalizeCustomTag(cat).toLowerCase())) {
                channelIds.add(String(channelId));
                break;
            }
        }
    }
    return channelIds;
}

// Retorna el nom de la categoria personalitzada activa més antiga a la qual pertany el vídeo.
// Primer mira les categories assignades al canal, després match per contingut.
function getRadarCategoryLabel(video) {
    if (!video) return '';
    const activeTags = getCustomTags();
    if (activeTags.length === 0) return '';

    // Primer: categories assignades explícitament al canal (en ordre d'antiguitat a la llista)
    const channelCats = getChannelCustomCategories(video.channelId);
    for (const tag of activeTags) {
        if (channelCats.some(c => c.toLowerCase() === tag.toLowerCase())) {
            return tag;
        }
    }

    // Segon: match per contingut amb la primera categoria activa que coincideixi
    for (const tag of activeTags) {
        if (matchesCustomCategory(video, tag)) {
            return tag;
        }
    }

    return '';
}

function initDefaultSmartCategories() {
    const defaultsVersion = localStorage.getItem(DEFAULTS_VERSION_KEY);
    const shouldApplyBaseDefaults = defaultsVersion !== DEFAULTS_VERSION_VALUE;
    const REMOVED_DEFAULT_CHANNEL = 'UCyVLnWkfIkgTjJWyy0UyrOA'; // Smile and Learn - Català
    const REMOVED_HISTORY_CHANNEL = '3cat_enguardia';
    const DEFAULT_SMART_CHANNEL_GROUPS = [
        {
            tag: '"Canal Jove"', // stored with quotes, displayed without
            channels: [
                'UCSkt3NKa-7ZQjxYX-bD_FJQ',
                'UCMs5RmZu4Wo1Lfa9jDzkoCg',
                'UC5Ha9G3Tp_17qcC38GPPvQg',
                'UCOzd_BhDxbQZ8Y2H1j9wOOg',
                'UC5ytRP5VNigPHovAY7kyicQ',
                'UCuo3iIQ9q2o2zZmXXvYLAIA',
                'UCPikYBuH-XamjDe1OuEiLfA',
                'UC5j3iZVh9Bzhxn-K7_yK2Tg',
                'UCQvIQnJGSDFX_IAiV9JuBew',
                'UCcOh4_iym9H-q5HSHjPg4Xw',
                'UCHnWdAPT4U0CRf0MO5XmJgA',
                'UC1IsIqLMItHMn-SgnKJBRWw',
                'UCPn1nFLeba3BIU5Q11tEpdQ',
                'UC-Z3S_8M0LEm3LiH7OiOjGQ',
                'UC53AwVEoOElXMqnWIL4IHxQ',
                'UCpLJg7CfwYyW3FwEw8zzz7A',
                'UC20UwprEN18WbrwKfUWhEiA',
                'UCWAzjo508NFMTM9eEFFUMIQ',
                'UCb22KyyPkBgIdh152eIde-g',
                'UCdhdwLMxd4rkWSfNG_YpwtA',
                'UCtX5eBKQNVj8nIB0Ug91LHg',
                'UCmTRE16YZcbXhk9E6K-5xXg',
                'UC_c_-MmcY2WpLpBiEETXurQ',
                'UC2Pjz1IOV2R--vdLZ5knByA',
                'UCTTi9_WFewXVPVzLQ6KWKvA',
                'UCTJc17mfpsBAhecR6Deqa6Q',
                'UC4VKqupdqDscpNAVFCQD82A',
                'UCt1RHgfqo1YtV4jr-ERVABA',
                'UCkMmYDF8zshYbtCdpTuhD8g',
                'UCpIbUrNLyrCOT7LFUVRalAA',
                'UCB70EgYO2FgbUrDrI2N-Tmg',
                'UCBLjBfA4uEI0oEJMFZF2VWQ',
                'UCT6zjlSDhV_OPmd7gpPy0iA',
            ]
        },
        {
            tag: '"Canal Història"',
            channels: [
                'UCH53ue1LvguXxuUzHs8KjKQ',
                'UCVG5bGyAHBJGkFsQHhfGIRA',
                'UCgwuoJvIn3nrsGDelo2TRKQ',
                'UCh5f2Kg8qn-8geGWcaZXmjQ',
                'UCduKvutWvgrYXgtOMRS_HQA',
                'UCAqn6wfzYkWxEtWh68-4_Lg',
                'UCbadONRV1kT_5HRDkNPltCw',
                'UCy7E2fO5_rYdwvv7fwHgYcQ',
                'UCbj8yTKaC_J0sG7LMUHLA7g',
                'UCG8PLZDn4IJSxrk3KZYxBAA',
                'UCnPoR0ScqvphypOaNabBOcA',
                'UCEpgMM-azFGKRQ8qD40rbwQ',
                'UCbtb5l7JPvFT5b1xbIc5evQ',
                'UCWeaRN1VL8-OJGz_ww10eWQ',
                'UCDKlDQJD-pJFFeEkRDDWqqw',
                'UCoyG_tJuhuRfctcifApZUgQ',
                'UCpzJVkP4rzuOYaUeGtARE4A',
                'UC5PzwRliQFe9y1E4pfToC9A',
            ]
        }
    ];

    if (shouldApplyBaseDefaults) {
        // Manté les dades de l'usuari i només injecta els defaults que faltin.
        try {
            const storedPrograms = localStorage.getItem(PROGRAMS_STORAGE_KEY);
            const mergedPrograms = mergeDefaultPrograms(storedPrograms);
            localStorage.setItem(PROGRAMS_STORAGE_KEY, JSON.stringify(mergedPrograms));
        } catch (_) {
            localStorage.setItem(PROGRAMS_STORAGE_KEY, JSON.stringify(mergeDefaultPrograms([])));
        }

        // Add tag to custom tags list
        try {
            const stored = localStorage.getItem(CUSTOM_TAGS_STORAGE_KEY);
            const existing = stored ? JSON.parse(stored) : [];
            const list = Array.isArray(existing) ? existing : [];

            for (const group of DEFAULT_SMART_CHANNEL_GROUPS) {
                const normalizedTag = normalizeCustomTag(group.tag).toLowerCase();
                const alreadyExists = list.some(t => normalizeCustomTag(t).toLowerCase() === normalizedTag);
                if (!alreadyExists) {
                    list.push(group.tag);
                }
            }

            localStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(list));
        } catch (e) {
            localStorage.setItem(
                CUSTOM_TAGS_STORAGE_KEY,
                JSON.stringify(DEFAULT_SMART_CHANNEL_GROUPS.map(group => group.tag))
            );
        }

        // Assign tag to each default channel
        try {
            const stored = localStorage.getItem(CHANNEL_CUSTOM_CATEGORIES_KEY);
            const existing = stored ? JSON.parse(stored) : {};
            const obj = existing && typeof existing === 'object' ? existing : {};

            for (const group of DEFAULT_SMART_CHANNEL_GROUPS) {
                const normalizedTag = normalizeCustomTag(group.tag).toLowerCase();
                for (const channelId of group.channels) {
                    const cats = Array.isArray(obj[channelId]) ? obj[channelId] : [];
                    const alreadyHas = cats.some(c => normalizeCustomTag(c).toLowerCase() === normalizedTag);
                    if (!alreadyHas) {
                        cats.push(group.tag);
                        obj[channelId] = cats;
                    }
                }
            }
            if (defaultsVersion === '2' && Array.isArray(obj[REMOVED_DEFAULT_CHANNEL])) {
                const canalJoveTag = normalizeCustomTag(DEFAULT_SMART_CHANNEL_GROUPS[0].tag).toLowerCase();
                const nextCats = obj[REMOVED_DEFAULT_CHANNEL].filter(c => normalizeCustomTag(c).toLowerCase() !== canalJoveTag);
                if (nextCats.length > 0) {
                    obj[REMOVED_DEFAULT_CHANNEL] = nextCats;
                } else {
                    delete obj[REMOVED_DEFAULT_CHANNEL];
                }
            }
            if (defaultsVersion === '5' && Array.isArray(obj[REMOVED_HISTORY_CHANNEL])) {
                const canalHistoriaTag = normalizeCustomTag(DEFAULT_SMART_CHANNEL_GROUPS[1].tag).toLowerCase();
                const nextCats = obj[REMOVED_HISTORY_CHANNEL].filter(c => normalizeCustomTag(c).toLowerCase() !== canalHistoriaTag);
                if (nextCats.length > 0) {
                    obj[REMOVED_HISTORY_CHANNEL] = nextCats;
                } else {
                    delete obj[REMOVED_HISTORY_CHANNEL];
                }
            }
            localStorage.setItem(CHANNEL_CUSTOM_CATEGORIES_KEY, JSON.stringify(obj));
        } catch (e) {
            const obj = {};
            for (const group of DEFAULT_SMART_CHANNEL_GROUPS) {
                for (const channelId of group.channels) {
                    obj[channelId] = [group.tag];
                }
            }
            localStorage.setItem(CHANNEL_CUSTOM_CATEGORIES_KEY, JSON.stringify(obj));
        }

        localStorage.setItem(DEFAULTS_VERSION_KEY, DEFAULTS_VERSION_VALUE);
    }
}

const SHARE_IMAGE_NAME = 'icon-512.png';

// Compartició (canals, categories i enllaços) — implementació a utils/share-codecs.js
function buildAppShareUrl(query = '', hash = '') {
    return SegueixApp.utils.shareCodecs.buildAppShareUrl(query, hash);
}

async function getShareImageFile() {
    try {
        const shareImageUrl = new URL(`img/${SHARE_IMAGE_NAME}`, window.location.href);
        const response = await fetch(shareImageUrl);
        if (!response.ok) {
            return null;
        }
        const blob = await response.blob();
        return new File([blob], SHARE_IMAGE_NAME, { type: blob.type || 'image/png' });
    } catch (error) {
        console.warn('Share image unavailable', error);
        return null;
    }
}

function buildShareText(type, label, url) {
    return `Segueix! Els nostres YouTubers.\n${type}: ${label}\n${url}`;
}

async function buildShareData(type, label, url, title = '') {
    const resolvedTitle = title || label || 'Segueix!';
    const text = buildShareText(type, label, url);
    const data = {
        title: resolvedTitle,
        text: `${type}: ${label}`,
        url,
    };
    const shareImage = await getShareImageFile();
    if (shareImage) {
        const files = [shareImage];
        if (!navigator.canShare || navigator.canShare({ files })) {
            data.files = files;
        }
    }
    return { data, text };
}

// Function to handle custom sharing logic
async function shareVideo(videoData) {
    const shareUrl = buildAppShareUrl(`v=${encodeURIComponent(videoData.id)}`);
    const copyText = shareUrl;

    if (navigator.share) {
        // Passem títol i text (com a les llistes i categories): si l'app receptora no pot
        // llegir les meta Open Graph, el missatge ja porta el nom del vídeo.
        const shareTitle = String(videoData.title || 'Segueix!').trim();
        navigator
            .share({ title: shareTitle, text: shareTitle, url: shareUrl })
            .catch(err => console.log('Share dismissed', err));
    } else {
        const existingModal = document.querySelector('.share-modal-overlay');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active share-modal-overlay';
        modal.innerHTML = `
            <div class="modal modal-small">
                <div class="modal-header">
                    <h2 class="modal-title" style="display:flex; align-items:center; gap:10px;"><img src="img/icon-192.png" width="32" height="32" alt="Segueix Logo"> Segueix!</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="modal-body" style="text-align:center; padding-top:0;">
                    <p class="modal-description" style="margin-bottom:20px;">
                        Comparteix el vídeo: <br><strong>${videoData.title}</strong>
                    </p>
                    <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                        <button class="hero-button" onclick="window.open('https://wa.me/?text=${encodeURIComponent(shareUrl)}', '_blank')">
                            <i data-lucide="message-circle" style="width:18px; display:inline-block; vertical-align:middle;"></i> WhatsApp
                        </button>
                        <button class="hero-button" style="background:#333; color:white;" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(copyText)}')); alert('Enllaç copiat!'); this.closest('.modal-overlay').remove();">
                            <i data-lucide="link" style="width:18px; display:inline-block; vertical-align:middle;"></i> Copiar Link
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        refreshIcons(modal);
    }
}

function resolveShareChannelData(channelId, fallback = {}) {
    const channels = Array.isArray(YouTubeAPI?.getAllChannels?.()) ? YouTubeAPI.getAllChannels() : [];
    const matchedChannel = channels.find(channelItem => String(channelItem.id) === String(channelId));
    const channelName = fallback.name || fallback.title || matchedChannel?.name || matchedChannel?.title || 'Canal';
    const channelDescription =
        fallback.description ||
        matchedChannel?.description ||
        matchedChannel?.about ||
        'No hi ha descripció disponible.';

    return {
        id: channelId,
        name: channelName,
        description: channelDescription,
    };
}

async function getChannelAvatarFile(channelId) {
    const avatarUrl = resolveChannelAvatar(channelId);
    if (!avatarUrl || avatarUrl === 'img/icon-192.png') return null;
    try {
        const response = await fetch(avatarUrl);
        if (!response.ok) return null;
        const blob = await response.blob();
        const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/jpeg' ? 'jpg' : 'png';
        return new File([blob], `avatar.${ext}`, { type: blob.type || 'image/png' });
    } catch (error) {
        console.warn('Channel avatar unavailable for share', error);
        return null;
    }
}

async function shareChannelProfile(channelId, fallback = {}) {
    const channelData = resolveShareChannelData(channelId, fallback);
    const isProgram = !!fallback.programName;
    const query = fallback.programId
        ? `program=${encodeURIComponent(fallback.programId)}&channel=${encodeURIComponent(channelData.id)}&programName=${encodeURIComponent(fallback.programName || '')}`
        : `channel=${encodeURIComponent(channelData.id)}`;
    const shareUrl = buildAppShareUrl(query, 'segueix');
    const copyText = shareUrl;

    if (navigator.share) {
        navigator.share({ url: shareUrl }).catch(err => console.log('Share dismissed', err));
    } else {
        const avatarUrl = resolveChannelAvatar(channelId);
        const shareLabel = isProgram ? 'el programa' : 'el canal';
        const existingModal = document.querySelector('.share-modal-overlay');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active share-modal-overlay';
        modal.innerHTML = `
            <div class="modal modal-small">
                <div class="modal-header">
                    <h2 class="modal-title" style="display:flex; align-items:center; gap:10px;"><img src="${avatarUrl}" width="32" height="32" alt="${escapeHtml(channelData.name)}" style="border-radius:50%;"> Segueix!</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="modal-body" style="text-align:center; padding-top:0;">
                    <p class="modal-description" style="margin-bottom:20px;">
                        Comparteix ${shareLabel}: <br><strong>${escapeHtml(channelData.name)}</strong>
                    </p>
                    <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                        <button class="hero-button" onclick="window.open('https://wa.me/?text=${encodeURIComponent(shareUrl)}', '_blank')">
                            <i data-lucide="message-circle" style="width:18px; display:inline-block; vertical-align:middle;"></i> WhatsApp
                        </button>
                        <button class="hero-button" style="background:#333; color:white;" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(copyText)}')); alert('Enllaç copiat!'); this.closest('.modal-overlay').remove();">
                            <i data-lucide="link" style="width:18px; display:inline-block; vertical-align:middle;"></i> Copiar Link
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        refreshIcons(modal);
    }
}

function scrollToChannelFollow() {
    if (!channelProfileFollowBtn) {
        return;
    }
    channelProfileFollowBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    channelProfileFollowBtn.focus({ preventScroll: true });
}

// Setup Event Listener for the Share Button
function setupShareButtons() {
    document.addEventListener('click', e => {
        const shareChannelBtn = e.target.closest('[data-share-channel-id]');
        if (shareChannelBtn) {
            e.stopPropagation();
            const channelId = shareChannelBtn.dataset.shareChannelId;
            const channelName = shareChannelBtn.dataset.shareChannelName
                ? decodeURIComponent(shareChannelBtn.dataset.shareChannelName)
                : '';
            const channelDescription = shareChannelBtn.dataset.shareChannelDescription
                ? decodeURIComponent(shareChannelBtn.dataset.shareChannelDescription)
                : '';
            const programName = shareChannelBtn.dataset.shareProgramName
                ? decodeURIComponent(shareChannelBtn.dataset.shareProgramName)
                : '';
            const programId = shareChannelBtn.dataset.shareProgramId || '';
            if (channelId) {
                shareChannelProfile(channelId, {
                    name: channelName,
                    description: channelDescription,
                    programName,
                    programId,
                });
            }
            return;
        }
        const btn = e.target.closest('#shareBtn');
        if (btn) {
            e.stopPropagation();
            const videoId = currentVideoId;
            // Fallback to get title if not passed directly
            const videoTitle = document.getElementById('videoTitle')
                ? document.getElementById('videoTitle').textContent
                : 'Vídeo';

            if (videoId) {
                shareVideo({ id: videoId, title: videoTitle });
            }
        }
    });
}

function initIntroSplash() {
    const splash = document.getElementById('intro-splash');
    if (!splash) {
        return;
    }
    const splashDisplayDurationMs = 2000;
    const splashFadeDurationMs = 500;
    setTimeout(() => {
        splash.classList.add('splash-hidden');
        setTimeout(() => {
            splash.remove();
        }, splashFadeDurationMs);
    }, splashDisplayDurationMs);
}

// Caràtula per defecte per als vídeos sense coberta carregable
const DEFAULT_VIDEO_THUMBNAIL_SRC = 'img/caratula.png';

// Detecta si una imatge és una caràtula de vídeo (tant pel seu contenidor com per classes pròpies)
function isVideoThumbnailImage(img) {
    if (!img || img.tagName !== 'IMG') return false;
    const imgThumbClasses = [
        'archive-video-thumb',
        'search-result-thumb',
        'sidebar-video-thumb',
        'playlist-video-thumb',
        'short-thumb',
    ];
    for (const cls of imgThumbClasses) {
        if (img.classList.contains(cls)) return true;
    }
    return Boolean(
        img.closest('.video-thumbnail') ||
            img.closest('.hero-thumbnail') ||
            img.closest('.video-placeholder') ||
            img.closest('.related-thumbnail') ||
            img.closest('.archive-video-thumb-wrap') ||
            img.closest('.playlist-card-thumb') ||
            img.closest('.smart-cat-thumb')
    );
}

// Substitueix la caràtula d'un vídeo per la imatge per defecte quan l'original no és vàlida
function applyDefaultVideoThumbnailFallback(img) {
    if (!img || img.dataset.defaultThumbnailFallback === 'applied') return;
    const currentSrc = img.getAttribute('src') || '';
    if (currentSrc.endsWith(DEFAULT_VIDEO_THUMBNAIL_SRC)) return;
    img.dataset.defaultThumbnailFallback = 'applied';
    img.src = DEFAULT_VIDEO_THUMBNAIL_SRC;
    img.style.visibility = '';
}

// Inicialitzar l'aplicació
// Captura errors 404 (p. ex. sddefault.jpg inexistent) i substitueix la src per la caràtula per defecte.
document.addEventListener(
    'error',
    e => {
        const img = e.target;
        if (isVideoThumbnailImage(img)) {
            applyDefaultVideoThumbnailFallback(img);
        }
    },
    true
);

// Captura el placeholder gris de YouTube (la imatge 120×90 amb pantalla i tres punts que es lliura amb HTTP 200
// quan la caràtula real no està disponible). Si una imatge de ytimg.com carrega amb aquestes dimensions, és el
// placeholder i la substituïm per la caràtula per defecte.
document.addEventListener(
    'load',
    e => {
        const img = e.target;
        if (!isVideoThumbnailImage(img)) return;
        const src = String(img.currentSrc || img.src || '');
        if (!src.includes('ytimg.com')) return;
        if (img.naturalWidth === 120 && img.naturalHeight === 90) {
            applyDefaultVideoThumbnailFallback(img);
        }
    },
    true
);

function shouldThrottleBackgroundWork() {
    // No penalitzem "mobile" per defecte: només reduïm càrrega en senyals reals de limitació.
    const lowCpu = Number(navigator.hardwareConcurrency || 0) > 0 && Number(navigator.hardwareConcurrency) <= 4;
    const lowMem = Number(navigator.deviceMemory || 0) > 0 && Number(navigator.deviceMemory) <= 4;
    const saveData = navigator.connection?.saveData === true;
    const effectiveType = String(navigator.connection?.effectiveType || '').toLowerCase();
    const verySlowNetwork = effectiveType === 'slow-2g' || effectiveType === '2g';
    return Boolean(lowCpu || lowMem || saveData || verySlowNetwork);
}

async function bootstrapApp() {
    const bootstrapProfile = detectBootstrapProgressDeviceProfile();
    createBootstrapProgressOverlay(bootstrapProfile);
    updateBootstrapProgress(10, 'Iniciant aplicació...');

    if (typeof SegueixApp.dom?.init === 'function') {
        SegueixApp.dom.init();
    }

    initDefaultSmartCategories();
    initIntroSplash();
    initElements();
    syncHeaderHeightVar();
    observePlayerLayoutShifts();
    initQueueNextOverlay();
    initAppUpdater();
    loadGridLayoutPreference();
    loadWatchGridLayoutPreference();
    applyGridLayoutPreference();
    applyWatchGridLayoutPreference();
    updateBootstrapProgress(35, 'Preparant interfície...');

    initEventListeners();
    initInfoPopovers();
    initInstallPrompt();
    setupShareButtons();
    initBackgroundModal();
    initLegalModal();
    initBackgroundPicker();
    initFontSizeControls();
    updateBootstrapProgress(50, "Configurant l'aplicació...");

    // Pre-carregar l'índex d'arxiu en segon pla (des de localStorage o fetch)
    // Limitador anti-congelació: en mòbil/dispositius limitats diferim més la càrrega
    // per prioritzar resposta de la UI (modals, taps i scroll).
    const archiveWarmupDelay = shouldThrottleBackgroundWork() ? 8000 : 2000;
    setTimeout(() => {
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(() => loadSearchArchiveIndex(), { timeout: 1200 });
        } else {
            loadSearchArchiveIndex();
        }
    }, archiveWarmupDelay);

    window.addEventListener('beforeunload', saveViewState);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            saveViewState();
        }
    });
    let saveViewStateTimer = null;
    window.addEventListener(
        'scroll',
        () => {
            if (saveViewStateTimer) return;
            saveViewStateTimer = setTimeout(() => {
                saveViewStateTimer = null;
                saveViewState();
            }, 500);
        },
        { passive: true }
    );

    updateBootstrapProgress(60, 'A punt per carregar contingut...');
}

function getCurrentVisiblePage() {
    if (watchPage && !watchPage.classList.contains('hidden')) return 'watch';
    if (historyPage && !historyPage.classList.contains('hidden')) return 'historial';
    if (playlistsPage && !playlistsPage.classList.contains('hidden')) return 'llistes';
    if (followPage && !followPage.classList.contains('hidden')) return 'segueix';
    if (channelPage && !channelPage.classList.contains('hidden')) return 'channel';
    return 'home';
}

function saveViewState() {
    try {
        const page = getCurrentVisiblePage();
        const isWatchPage = page === 'watch';
        const state = {
            page,
            selectedCategory,
            scrollY: window.scrollY || 0,
            historySelectedCategory,
            historyFilterLiked,
            activeFollowTab,
            activeLibraryTab,
            currentVideoId: isWatchPage ? currentVideoId || '' : '',
            currentVideoSource: isWatchPage ? currentVideoSource || '' : '',
            playbackSeconds: isWatchPage ? Math.max(0, Math.floor(lastKnownPlayerTime || 0)) : 0,
            ts: Date.now(),
        };
        sessionStorage.setItem(VIEW_STATE_STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
}

function loadSavedViewState() {
    try {
        const raw = sessionStorage.getItem(VIEW_STATE_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed;
    } catch (_) {
        return null;
    }
}

async function restoreSavedViewState() {
    if (!shouldRestoreViewState) return;
    const saved = loadSavedViewState();
    if (!saved) return;

    if (saved.selectedCategory) {
        selectedCategory = saved.selectedCategory;
        localStorage.setItem(LAST_CATEGORY_STORAGE_KEY, selectedCategory);
    }

    const page = saved.page || 'home';
    if (page === 'watch' && saved.currentVideoId) {
        const startAt = Number(saved.playbackSeconds || 0);
        const preferredSource = saved.currentVideoSource;
        const staticVideo = getVideoById(saved.currentVideoId);

        if (preferredSource === 'static') {
            if (staticVideo) {
                showVideo(saved.currentVideoId, { startAt, replaceHistory: true });
            } else {
                showHome();
                renderCategoryActions(getCategoryPageTitle(selectedCategory));
                renderFeed();
            }
        } else if (preferredSource === 'api') {
            await showVideoFromAPI(saved.currentVideoId, { startAt, replaceHistory: true });
        } else if (staticVideo) {
            showVideo(saved.currentVideoId, { startAt, replaceHistory: true });
        } else {
            await showVideoFromAPI(saved.currentVideoId, { startAt, replaceHistory: true });
        }
    } else if (page === 'historial' || page === 'history') {
        historySelectedCategory = saved.historySelectedCategory || 'Tot';
        historyFilterLiked = Boolean(saved.historyFilterLiked);
        showHistory();
    } else if (page === 'llistes' || page === 'playlists') {
        showPlaylists();
        if (saved.activeLibraryTab) {
            setActiveLibraryTab(saved.activeLibraryTab);
        }
    } else if (page === 'segueix' || page === 'follow') {
        showFollow(saved.activeFollowTab || 'all');
    } else {
        showHome();
        renderCategoryActions(getCategoryPageTitle(selectedCategory));
        renderFeed();
    }

    requestAnimationFrame(() => {
        window.scrollTo(0, Number(saved.scrollY || 0));
    });
}

async function handleInitialUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    shouldRestoreViewState =
        !urlParams.get('v') && !urlParams.get('channel') && !urlParams.get('program') && !urlParams.get('cat') && !urlParams.get('add_tag');
    const addTagParam = urlParams.get('add_tag');
    if (addTagParam) {
        const normalizedTag = normalizeCustomTag(addTagParam);
        if (normalizedTag) {
            if (isStandardCategory(normalizedTag)) {
                selectedCategory = normalizedTag;
                localStorage.setItem(LAST_CATEGORY_STORAGE_KEY, selectedCategory);
            } else {
                const addedTag = addCustomTag(normalizedTag);
                selectedCategory = addedTag || selectedCategory;
                localStorage.setItem(LAST_CATEGORY_STORAGE_KEY, selectedCategory);
            }
        }
        urlParams.delete('add_tag');
        const nextQuery = urlParams.toString();
        const newUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`;
        history.replaceState({}, '', newUrl);
    }
    // Paràmetre ?cat= antic (Google Sheets) — obsolet, mostrar avís
    if (urlParams.has('cat')) {
        urlParams.delete('cat');
        const nextCatQuery = urlParams.toString();
        history.replaceState(
            {},
            '',
            `${window.location.pathname}${nextCatQuery ? `?${nextCatQuery}` : ''}${window.location.hash || ''}`
        );
        const catModal = document.createElement('div');
        catModal.className = 'modal-overlay active';
        catModal.id = 'importCategoryModal';
        catModal.style.zIndex = '10000';
        catModal.innerHTML = `
            <div class="modal modal-small">
                <div class="modal-header">
                    <h2 class="modal-title">Enllaç obsolet</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="modal-body" style="text-align:center; padding: 30px 20px;">
                    <p style="margin-bottom:15px;">Aquest enllaç és d'un sistema antic que ja no està actiu.</p>
                    <p style="margin-bottom:20px; font-size:0.9rem; opacity:0.7;">Els nous enllaços de compartició generen un URL amb <code>?importData=</code> que funciona sense servidor.</p>
                    <button class="hero-button" onclick="this.closest('.modal-overlay').remove()">D'acord</button>
                </div>
            </div>
        `;
        document.body.appendChild(catModal);
        setTimeout(() => refreshIcons(catModal), 0);
    }
    initButtonColorPicker();
    initLuckyMode();
    loadCategories();
    renderPlaylistsPage();
    initYouTubeMessageListener();

    // Canal A — Detecció de ?importData= (compartició ràpida per URL comprimida)
    handleImportDataParam();

    updateBootstrapProgress(72, 'Connectant contingut...');
    // Inicialitzar YouTubeAPI (carregar canals catalans)
    try {
        await withStartupTimeout(YouTubeAPI.init(), 15000, 'YouTubeAPI.init');
    } catch (error) {
        console.warn('Startup: YouTubeAPI.init no ha respost a temps, seguim amb fallback.', error);
    }

    // Carregar vídeos (prioritza feed)
    const shouldUseApiFeed = Boolean(YouTubeAPI.feedLoaded && YouTubeAPI.feedVideos.length > 0);
    useYouTubeAPI = shouldUseApiFeed;
    try {
        if (shouldUseApiFeed) {
            await withStartupTimeout(loadVideosFromAPI(), 12000, 'loadVideosFromAPI');
        } else {
            await withStartupTimeout(loadVideos(), 12000, 'loadVideos');
        }
    } catch (error) {
        console.warn('Startup: càrrega inicial de vídeos bloquejada, activem fallback.', error);
        useYouTubeAPI = false;
        try {
            await withStartupTimeout(loadVideos(), 8000, 'loadVideos fallback');
        } catch (fallbackError) {
            console.error('Startup: fallback de vídeos també ha fallat.', fallbackError);
        }
    }

    updateBootstrapProgress(88, 'Aplicant vista inicial...');

    // Carregar vídeo des de URL si hi ha paràmetre ?v= (enllaç compartit)
    const videoParam = urlParams.get('v');
    if (videoParam) {
        // Sincronitzem el destí pendent amb el paràmetre actual (pot haver canviat si
        // s'ha reescrit l'URL durant l'arrencada) i l'obrim sense esperar res més.
        if (!deepLinkVideoHandled) {
            pendingDeepLinkVideo = {
                id: videoParam,
                startAt: parseShareStartSeconds(urlParams.get('t')),
            };
        }
        setTimeout(() => {
            openPendingDeepLinkVideo();
        }, 100);
    } else {
        await restoreSavedViewState();
    }

    const channelParam = urlParams.get('channel');
    const programParam = urlParams.get('program');
    const programNameParam = urlParams.get('programName');

    if (!videoParam && programParam) {
        setTimeout(() => {
            let program = getProgramById(programParam);

            // Si el programa no existeix localment, el creem amb les dades de l'URL
            if (!program && channelParam && programNameParam) {
                const normalizedName = normalizeProgramText(programNameParam);
                program = getPrograms().find(
                    p =>
                        String(p.channelId) === String(channelParam) &&
                        normalizeProgramText(p.name) === normalizedName
                );
                if (!program) {
                    program = createProgram(channelParam, programNameParam, '');
                }
            }

            if (program) {
                openProgramProfile(program.id);
                if (window.location.hash === '#segueix') {
                    setTimeout(scrollToChannelFollow, 150);
                }
            }
        }, 100);
    } else if (!videoParam && channelParam) {
        setTimeout(() => {
            openChannelProfile(channelParam);
            if (window.location.hash === '#segueix') {
                setTimeout(scrollToChannelFollow, 150);
            }
        }, 100);
    }

    // Inicialitzar icons
    refreshIcons();
    updateBootstrapProgress(100, 'Tot a punt!');
}

// ==================== ELEMENT INIT ====================
function initCoreElements() {
    const dom = SegueixApp.dom || {};
    const layout = dom.layout || {};

    sidebar = layout.sidebar || document.getElementById('sidebar');
    menuBtn = document.getElementById('menuBtn');
    mainContent = document.getElementById('mainContent');
    chipsBar = layout.chipsBar || document.querySelector('.chips-bar');
    // Restaurar chips des de cache per aparició instantània
    restoreChipsFromCache();
    loading = document.getElementById('loading');
    pageTitle = layout.pageTitle || document.getElementById('pageTitle');
    searchForm = document.querySelector('.search');
    searchInput = searchForm?.querySelector('.search-input') || null;
    mobileSearchToggle = searchForm?.querySelector('.mobile-search-toggle') || null;
    mobileSearchOverlay = document.querySelector('.mobile-search-overlay') || null;
}

function initHomeElements() {
    videosGrid = document.getElementById('videosGrid');
    homePage = document.getElementById('homePage');
    heroSection = document.getElementById('heroSection');
    heroTitle = document.getElementById('heroTitle');
    heroDescription = document.getElementById('heroDescription');
    heroImage = document.getElementById('heroImage');
    heroDuration = document.getElementById('heroDuration');
    heroButton = document.getElementById('heroButton');
    heroEyebrow = document.getElementById('heroEyebrow');
    heroChannel = document.getElementById('heroChannel');
}

function initWatchElements() {
    watchPage = document.getElementById('watchPage');
    videoPlayer = document.getElementById('videoPlayer');
    videoPlaceholder = document.getElementById('videoPlaceholder');
    placeholderImage = document.getElementById('placeholderImage');
    extraVideosGrid = document.getElementById('extraVideosGrid');
}

function initPlaylistElements() {
    playlistsPage = document.getElementById('playlistsPage');
    playlistsList = document.getElementById('playlistsList');
    playlistNameInput = document.getElementById('playlistNameInput');
    createPlaylistBtn = document.getElementById('createPlaylistBtn');
    smartCategoriesList = document.getElementById('smartCategoriesList');
    libraryTabs = document.getElementById('libraryTabs');
    playlistModal = document.getElementById('playlistModal');
    playlistModalBody = document.getElementById('playlistModalBody');

    if (smartCategoriesList) {
        smartCategoriesList.addEventListener('click', e => {
            const shareBtn = e.target.closest('.smart-cat-share-btn');
            if (shareBtn) {
                const categoryName = shareBtn.dataset.category;
                const channelIds = shareBtn.dataset.channels.split(',').map(decodeURIComponent).filter(Boolean);
                shareCategoryWithYoutubers(categoryName, channelIds);
                return;
            }
            const deleteBtn = e.target.closest('.smart-cat-delete-btn');
            if (deleteBtn) {
                const categoryName = deleteBtn.dataset.category;
                if (removeCustomTag(categoryName)) renderSmartCategoriesTab();
                return;
            }
            const removeBtn = e.target.closest('.smart-cat-channel-remove');
            if (removeBtn) {
                removeCategoryFromChannel(removeBtn.dataset.channelId, removeBtn.dataset.category);
                renderSmartCategoriesTab();
            }
        });
    }
}

function initChannelElements() {
    followPage = document.getElementById('followPage');
    followGrid = document.getElementById('followGrid');
    followTabs = document.getElementById('followTabs');
    addYoutuberModal = document.getElementById('addYoutuberModal');
    channelPage = document.getElementById('channelPage');
    channelVideosGrid = document.getElementById('channelVideosGrid');
    channelBackBtn = document.getElementById('channelBackBtn');
    channelProfileAvatar = document.getElementById('channelProfileAvatar');
    channelProfileName = document.getElementById('channelProfileName');
    channelProfileHandle = document.getElementById('channelProfileHandle');
    channelProfileSubscribers = document.getElementById('channelProfileSubscribers');
    channelProfileDescription = document.getElementById('channelProfileDescription');
    channelProfileTags = document.getElementById('channelProfileTags');
    channelProfileFollowBtn = document.getElementById('channelProfileFollowBtn');
    channelProfileHideBtn = document.getElementById('channelProfileHideBtn');
    channelProfileShareBtn = document.getElementById('channelProfileShareBtn');
    channelSearchInputDesktop = document.getElementById('channelSearchInputDesktop');
    channelSearchInputMobile = document.getElementById('channelSearchInputMobile');
}

function initHistoryElements() {
    historyPage = document.getElementById('historyPage');
    historyGrid = document.getElementById('historyGrid');
    historyFilters = document.getElementById('historyFilters');
}

function initConfigElements() {
    backgroundModal = document.getElementById('backgroundModal');
    backgroundBtn = document.getElementById('backgroundBtn');
    backgroundOptions = document.getElementById('backgroundOptions');
    buttonColorOptions = document.getElementById('buttonColorOptions');
    customCategoryModal = document.getElementById('customCategoryModal');
    customCategoryInput = document.getElementById('customCategoryInput');
    customCategoryAddBtn = document.getElementById('customCategoryAddBtn');
    customCategoryModalClose = document.getElementById('customCategoryModalClose');
    categoryKeywordsModal = document.getElementById('categoryKeywordsModal');
    categoryKeywordInput = document.getElementById('categoryKeywordInput');
    categoryKeywordAddBtn = document.getElementById('categoryKeywordAddBtn');
    categoryKeywordsModalClose = document.getElementById('categoryKeywordsModalClose');
    categoryKeywordsModalName = document.getElementById('categoryKeywordsModalName');
    categoryKeywordsList = document.getElementById('categoryKeywordsList');
    currentColorDisplay = document.getElementById('currentColorDisplay');
    expandedColorPicker = document.getElementById('expandedColorPicker');
    closeExpandedColorPicker = document.getElementById('closeExpandedColorPicker');
    currentButtonColorDisplay = document.getElementById('currentButtonColorDisplay');
    expandedButtonColorPicker = document.getElementById('expandedButtonColorPicker');
    closeExpandedButtonColorPicker = document.getElementById('closeExpandedButtonColorPicker');
    fontDecreaseBtn = document.getElementById('fontDecreaseBtn');
    fontIncreaseBtn = document.getElementById('fontIncreaseBtn');
    fontSizeDisplay = document.getElementById('fontSizeDisplay');
    legalModal = document.getElementById('legalModal');
    legalModalCloseBtn = document.getElementById('legalModalClose');
    legalModalTriggerButtons = Array.from(document.querySelectorAll('[data-open-legal-modal]'));
}

function openLegalModal() {
    if (!legalModal) return;
    legalModalFocusTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    legalModal.classList.add('active');
    legalModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
        legalModalCloseBtn?.focus();
        refreshIcons(legalModal);
    });
}

function closeLegalModal() {
    if (!legalModal) return;
    legalModal.classList.remove('active');
    legalModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    legalModalFocusTarget?.focus?.();
    legalModalFocusTarget = null;
}

function initLegalModal() {
    if (!legalModal || legalModal.dataset.bound === 'true') return;
    legalModal.dataset.bound = 'true';

    legalModalTriggerButtons.forEach(button => {
        button.addEventListener('click', openLegalModal);
    });

    legalModalCloseBtn?.addEventListener('click', closeLegalModal);
    legalModal.addEventListener('click', event => {
        if (event.target === legalModal) {
            closeLegalModal();
        }
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && legalModal.classList.contains('active')) {
            closeLegalModal();
        }
    });
}

// Inicialitzar elements del DOM
// Sincronitza --header-height amb l'alçada real del header (evita desajustos amb sticky).
// Important: la barra de categories (.chips-bar) s'enganxa just sota el header usant
// aquesta variable; si es desincronitza, apareix un buit entre el header i les categories
// pel qual es veuen els vídeos fent scroll. Per això fem servir un ResizeObserver i també
// escoltem canvis de fonts/icones per reaccionar a qualsevol re-layout del header.
function syncHeaderHeightVar() {
    const header = document.querySelector('.app-header');
    if (!header) return;
    const update = () => {
        // getBoundingClientRect() dona valors fraccionats; arrodonim cap avall perquè
        // la .chips-bar se situï lleugerament per sobre de la vora inferior real del
        // header i solapi qualsevol diferència de subpíxels (evitant així un fil visible).
        const rect = header.getBoundingClientRect();
        const h = Math.floor(rect.height);
        if (h > 0) {
            document.documentElement.style.setProperty('--header-height', h + 'px');
        }
    };
    update();

    // ResizeObserver: la millor manera de reaccionar a qualsevol canvi d'alçada
    // (icones Lucide renderitzades tard, cerca mòbil expandint-se, fonts carregades, etc.)
    if (typeof ResizeObserver === 'function') {
        const ro = new ResizeObserver(() => update());
        ro.observe(header);
    }

    // Re-calcular quan canvia la mida de la finestra (orientació, teclat, etc.)
    let resizeRaf = null;
    window.addEventListener('resize', () => {
        if (resizeRaf) return;
        resizeRaf = requestAnimationFrame(() => {
            resizeRaf = null;
            update();
        });
    });

    // Re-mesura quan les fonts acaben de carregar (pot canviar l'alçada del header).
    if (document.fonts && typeof document.fonts.ready?.then === 'function') {
        document.fonts.ready.then(() => update()).catch(() => {});
    }
}

function initElements() {
    initCoreElements();
    initHomeElements();
    initWatchElements();
    initPlaylistElements();
    initChannelElements();
    initCreateProgramModal();
    initHistoryElements();
    initConfigElements();
}

// ==================== EVENT BINDING ====================
function bindCoreEvents() {
    if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.toggle('open');
            } else {
                sidebar.classList.toggle('collapsed');
                document.body.classList.toggle('sidebar-collapsed');
            }
        });
    }

    document.addEventListener('click', e => {
        // Tancar cerca si es clica fora (tant si el dropdown és visible com si no)
        const searchIsOpen = searchForm?.classList.contains('is-open') || (searchDropdown && !searchDropdown.hidden);
        if (searchIsOpen) {
            const clickedInsideSearch = searchForm?.contains(e.target);
            if (!clickedInsideSearch) {
                hideSearchDropdown();
                closeMobileSearch();
            }
        }

        const chip = e.target.closest('.chip');
        if (chip && !chip.closest('#historyPage')) {
            if (chip.classList.contains('chip-add')) {
                openCustomCategoryModal();
                return;
            }
            selectedCategory = chip.dataset.cat || 'Tot';
            localStorage.setItem(LAST_CATEGORY_STORAGE_KEY, selectedCategory);
            document.querySelector('.chip.is-active')?.classList.remove('is-active');
            chip.classList.add('is-active');
            const basePath = window.location.pathname.replace(/\/index\.html$/, '/');
            history.pushState({}, '', basePath);
            if (!isMiniPlayerActive()) {
                stopVideoPlayback();
            }
            showHome();
            renderCategoryActions(getCategoryPageTitle(selectedCategory));
            // Diferir renderFeed al següent frame perquè el canvi de chip es pinti primer
            requestAnimationFrame(() => {
                renderFeed();
                if (isCustomCategory(selectedCategory)) {
                    const activeCategory = selectedCategory;
                    refreshCustomCategorySearch(activeCategory).then(() => {
                        if (selectedCategory === activeCategory) {
                            renderFeed();
                        }
                    });
                }
            });
            return;
        }

        if (window.innerWidth <= 768 && sidebar && menuBtn) {
            if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && playlistModal && !playlistModal.classList.contains('hidden')) {
            closePlaylistModal();
        }
        if (event.key === 'Escape' && customCategoryModal?.classList.contains('active')) {
            closeCustomCategoryModal();
        }
        if (event.key === 'Escape' && categoryKeywordsModal?.classList.contains('active')) {
            closeCategoryKeywordsModal();
        }
    });

    let _fullscreenCursorTimer = null;
    let _fullscreenMouseHandler = null;

    function _startFullscreenCursorHide() {
        const HIDE_DELAY = 3000;
        document.documentElement.classList.remove('fullscreen-cursor-hidden');
        clearTimeout(_fullscreenCursorTimer);
        _fullscreenCursorTimer = setTimeout(() => {
            document.documentElement.classList.add('fullscreen-cursor-hidden');
        }, HIDE_DELAY);
    }

    function _stopFullscreenCursorHide() {
        clearTimeout(_fullscreenCursorTimer);
        _fullscreenCursorTimer = null;
        document.documentElement.classList.remove('fullscreen-cursor-hidden');
        if (_fullscreenMouseHandler) {
            document.removeEventListener('mousemove', _fullscreenMouseHandler);
            _fullscreenMouseHandler = null;
        }
    }

    document.addEventListener('fullscreenchange', async () => {
        const shortModal = document.getElementById('short-modal');
        const isWatchingShort = shortModal && !shortModal.classList.contains('hidden');
        if (isWatchingShort) return;

        if (document.fullscreenElement) {
            if (screen.orientation && screen.orientation.lock) {
                try {
                    await screen.orientation.lock('landscape');
                } catch (err) {
                    console.log("No s'ha pogut bloquejar l'orientació:", err);
                }
            }
            _fullscreenMouseHandler = () => _startFullscreenCursorHide();
            document.addEventListener('mousemove', _fullscreenMouseHandler);
            _startFullscreenCursorHide();
        } else {
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock();
            }
            _stopFullscreenCursorHide();
            // El reproductor torna al seu forat: mentre s'era en pantalla completa,
            // updatePlayerPosition() no l'ha tocat i el forat pot haver-se mogut.
            requestAnimationFrame(() => {
                _lastPlayerRect = { top: 0, left: 0, width: 0, height: 0 };
                updatePlayerPosition();
                // En TV, en sortir-ne es recupera la vista al reproductor.
                focusTVPlayerViewport();
            });
        }
    });

    let rafResize = null;
    window.addEventListener(
        'resize',
        () => {
            if (rafResize) return;
            rafResize = requestAnimationFrame(() => {
                rafResize = null;
                if (isMiniPlayerActive()) {
                    updateMiniPlayerSize();
                } else {
                    updatePlayerPosition();
                }
            });
        },
        { passive: true }
    );

    let rafScroll = null;
    window.addEventListener(
        'scroll',
        () => {
            if (rafScroll) return;
            rafScroll = requestAnimationFrame(() => {
                rafScroll = null;
                if (!isMiniPlayerActive()) {
                    updatePlayerPosition();
                }
                handleMiniPlayerAutoOnScroll();
                updateMobileHeaderOnScroll();
                updateSegueixTVCategoriesOnScroll();
            });
        },
        { passive: true }
    );
}

// ================================================
// Amagar la filera d'icones del header al mòbil durant l'scroll cap avall
// i tornar-la a mostrar quan l'usuari fa scroll cap amunt.
//
// Per evitar tremolors (la capçalera trontollava quan el col·lapse de la
// filera provocava un layout-shift que, a la vegada, disparava nous
// esdeveniments d'scroll), apliquem dos mecanismes:
//   1. Histèresi asimètrica: cal un desplaçament cap avall clar per amagar,
//      però també un desplaçament cap amunt significatiu per tornar a
//      mostrar la filera (no qualsevol delta negatiu petit).
//   2. Cooldown: després de canviar d'estat (amagar/mostrar) ignorem
//      esdeveniments d'scroll durant uns ms perquè la transició CSS
//      acabi i el layout s'estabilitzi abans de tornar a avaluar.
// ================================================
const SEGUEIX_TV_CATEGORIES_HIDE_OFFSET = 60;
const SEGUEIX_TV_CATEGORIES_HIDE_DELTA = 16;
const SEGUEIX_TV_CATEGORIES_SHOW_DELTA = 16;
let _lastSegueixTVCategoryScrollY = Math.max(0, window.scrollY || 0);
let _segueixTVCategoryScrollAnchorY = _lastSegueixTVCategoryScrollY;
let _segueixTVCategoryScrollDirection = 0;

function resetSegueixTVCategoriesScrollState({ show = false } = {}) {
    const y = Math.max(0, window.scrollY || 0);
    _lastSegueixTVCategoryScrollY = y;
    _segueixTVCategoryScrollAnchorY = y;
    _segueixTVCategoryScrollDirection = 0;
    if (show) {
        (chipsBar || document.querySelector('.chips-bar.home-categories'))?.classList.remove('segueix-tv-scroll-hidden');
    }
}

function updateSegueixTVCategoriesOnScroll() {
    const categories = chipsBar || document.querySelector('.chips-bar.home-categories');
    if (!categories) return;

    const isSegueixTV =
        document.body.classList.contains('segueix-tv-playback') &&
        document.body.classList.contains('segueix-tv-active') &&
        Boolean(watchPage && !watchPage.classList.contains('hidden'));

    const y = Math.max(0, window.scrollY || 0);

    if (!isSegueixTV) {
        categories.classList.remove('segueix-tv-scroll-hidden');
        _lastSegueixTVCategoryScrollY = y;
        _segueixTVCategoryScrollAnchorY = y;
        _segueixTVCategoryScrollDirection = 0;
        return;
    }

    if (y <= SEGUEIX_TV_CATEGORIES_HIDE_OFFSET) {
        categories.classList.remove('segueix-tv-scroll-hidden');
        _lastSegueixTVCategoryScrollY = y;
        _segueixTVCategoryScrollAnchorY = y;
        _segueixTVCategoryScrollDirection = 0;
        return;
    }

    const frameDelta = y - _lastSegueixTVCategoryScrollY;
    const direction = frameDelta > 0 ? 1 : frameDelta < 0 ? -1 : 0;

    if (direction && direction !== _segueixTVCategoryScrollDirection) {
        _segueixTVCategoryScrollDirection = direction;
        _segueixTVCategoryScrollAnchorY = _lastSegueixTVCategoryScrollY;
    }

    const accumulated = y - _segueixTVCategoryScrollAnchorY;

    // El contingut puja (scroll cap avall): les categories desapareixen.
    if (direction > 0 && accumulated >= SEGUEIX_TV_CATEGORIES_HIDE_DELTA) {
        categories.classList.add('segueix-tv-scroll-hidden');
        _segueixTVCategoryScrollAnchorY = y;
    // L'usuari torna cap amunt: les categories reapareixen.
    } else if (direction < 0 && accumulated <= -SEGUEIX_TV_CATEGORIES_SHOW_DELTA) {
        categories.classList.remove('segueix-tv-scroll-hidden');
        _segueixTVCategoryScrollAnchorY = y;
    }

    _lastSegueixTVCategoryScrollY = y;
}

const MOBILE_HEADER_HIDE_DELTA = 10;      // px de scroll cap avall per amagar
const MOBILE_HEADER_SHOW_DELTA = 24;      // px de scroll cap amunt per mostrar
const MOBILE_HEADER_HIDE_OFFSET = 60;     // px de scroll mínim abans d'amagar
const MOBILE_HEADER_COOLDOWN_MS = 350;    // bloqueja canvis fins que acabi la transició
let _lastHeaderScrollY = 0;
let _headerScrollAnchorY = 0;             // ancora per acumular desplaçaments en la mateixa direcció
let _lastHeaderStateChangeAt = 0;
let _mobileHeaderMq = null;

function isMobileHeaderViewport() {
    if (!_mobileHeaderMq) {
        try {
            _mobileHeaderMq = window.matchMedia('(max-width: 768px)');
        } catch (_) {
            return false;
        }
    }
    return _mobileHeaderMq.matches;
}

function updateMobileHeaderOnScroll() {
    const header = document.querySelector('.app-header');
    if (!header) return;

    // Només apliquem el comportament d'amagar a la versió mòbil.
    if (!isMobileHeaderViewport()) {
        if (header.classList.contains('nav-hidden')) {
            header.classList.remove('nav-hidden');
        }
        _lastHeaderScrollY = window.scrollY || 0;
        _headerScrollAnchorY = _lastHeaderScrollY;
        return;
    }

    // Si la cerca mòbil està oberta, mantenim la filera visible perquè
    // l'usuari pugui arribar a tots els controls.
    if (document.body.classList.contains('mobile-search-active')) {
        header.classList.remove('nav-hidden');
        _lastHeaderScrollY = window.scrollY || 0;
        _headerScrollAnchorY = _lastHeaderScrollY;
        return;
    }

    const now = Date.now();
    // Durant el cooldown posterior a un canvi, no tornem a avaluar per evitar
    // que el layout-shift intermig torni a alternar la classe (trontollament).
    if (now - _lastHeaderStateChangeAt < MOBILE_HEADER_COOLDOWN_MS) {
        _lastHeaderScrollY = Math.max(0, window.scrollY || 0);
        return;
    }

    const y = Math.max(0, window.scrollY || 0);
    const frameDelta = y - _lastHeaderScrollY;
    _lastHeaderScrollY = y;

    // Reiniciem l'ancora quan la direcció canvia: així el llindar s'aplica
    // sobre el desplaçament acumulat en una mateixa direcció, no sobre el
    // delta d'un sol esdeveniment (més robust davant microscrolls).
    const isHidden = header.classList.contains('nav-hidden');
    const anchorDelta = y - _headerScrollAnchorY;

    if (frameDelta > 0 && anchorDelta < 0) {
        _headerScrollAnchorY = y;
    } else if (frameDelta < 0 && anchorDelta > 0) {
        _headerScrollAnchorY = y;
    }

    const accumulated = y - _headerScrollAnchorY;

    // A la pàgina del reproductor volem que la filera d'icones quedi amagada
    // mentre es mira el vídeo i només reaparegui quan l'usuari fa scroll cap
    // amunt. Per això saltem la regla de "sempre visible a prop de dalt".
    const onWatchPage = Boolean(watchPage && !watchPage.classList.contains('hidden'));

    // A la pàgina del reproductor, en arribar al capdamunt fent scroll cap amunt ja no
    // queda recorregut per acumular el llindar de MOBILE_HEADER_SHOW_DELTA: si no es
    // mostrés aquí, la filera es quedaria amagada per sempre. Es demana explícitament
    // que el gest sigui cap amunt (frameDelta < 0) perquè en obrir el vídeo, que passa
    // amb l'scroll a dalt i sense cap gest, la filera continuï amagant-se.
    if (onWatchPage && isHidden && frameDelta < 0 && y <= MOBILE_HEADER_HIDE_OFFSET) {
        header.classList.remove('nav-hidden');
        _lastHeaderStateChangeAt = now;
        _headerScrollAnchorY = y;
        return;
    }

    // A prop de dalt: sempre visible (excepte a la pàgina del reproductor).
    if (y <= MOBILE_HEADER_HIDE_OFFSET && !onWatchPage) {
        if (isHidden) {
            header.classList.remove('nav-hidden');
            _lastHeaderStateChangeAt = now;
        }
        _headerScrollAnchorY = y;
        return;
    }

    if (!isHidden && accumulated >= MOBILE_HEADER_HIDE_DELTA && y > MOBILE_HEADER_HIDE_OFFSET) {
        // scroll cap avall suficient: amagar
        header.classList.add('nav-hidden');
        _lastHeaderStateChangeAt = now;
        _headerScrollAnchorY = y;
    } else if (isHidden && accumulated <= -MOBILE_HEADER_SHOW_DELTA) {
        // scroll cap amunt suficient: mostrar
        header.classList.remove('nav-hidden');
        _lastHeaderStateChangeAt = now;
        _headerScrollAnchorY = y;
    }
}

// Al mòbil, en obrir la pàgina del reproductor amaguem la filera d'icones
// del header (Inici, Biblioteca, Historial...) perquè no ocupi espai mentre
// es mira el vídeo. Reapareixerà quan l'usuari faci scroll cap amunt
// (gestionat per updateMobileHeaderOnScroll, que a la pàgina del reproductor
// salta la regla de "sempre visible a prop de dalt").
function collapseMobileHeaderForWatchPage() {
    // Marca el body perquè el CSS pugui separar el botó de cerca de la marca
    // "Segueix!" a la pàgina del reproductor (independent del viewport; el
    // CSS només ho aplica al mòbil).
    document.body.classList.add('watch-page-active');
    if (!isMobileHeaderViewport()) return;
    const header = document.querySelector('.app-header');
    if (!header) return;
    header.classList.add('nav-hidden');
    _lastHeaderScrollY = Math.max(0, window.scrollY || 0);
    _headerScrollAnchorY = _lastHeaderScrollY;
    // Cooldown perquè qualsevol scroll immediat (p. ex. scrollIntoView del
    // reproductor) no torni a mostrar la filera de seguida.
    _lastHeaderStateChangeAt = Date.now();
}

// Torna a mostrar la filera d'icones del header. La cridem en sortir de la
// pàgina del reproductor perquè, si l'usuari hi era a dalt de tot (scrollY 0),
// pot no disparar-se cap esdeveniment d'scroll que la reveli sola.
function revealMobileHeaderNav() {
    // En sortir del reproductor deixem de separar el botó de cerca.
    document.body.classList.remove('watch-page-active');
    const header = document.querySelector('.app-header');
    if (!header) return;
    if (header.classList.contains('nav-hidden')) {
        header.classList.remove('nav-hidden');
    }
    _lastHeaderScrollY = Math.max(0, window.scrollY || 0);
    _headerScrollAnchorY = _lastHeaderScrollY;
}

function bindNavigationEvents() {
    const navItems = document.querySelectorAll('.nav-item');

    // Helper: feedback visual immediat + diferir renderitzat al següent frame
    let _navDebounceTimer = null;
    const _isMobile = window.matchMedia('(max-width: 768px)');
    function navigateTo(page) {
        // Debounce: evita múltiples taps ràpids que congelin la UI
        if (_navDebounceTimer) return;
        _navDebounceTimer = setTimeout(() => {
            _navDebounceTimer = null;
        }, 500);

        // Tancar cerca si estava oberta
        closeMobileSearch();

        document.querySelector('.nav-item.active')?.classList.remove('active');
        const matchingNav = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (matchingNav) matchingNav.classList.add('active');

        // Actualitzar nav-trigger actiu al header
        const prevTrigger = document.querySelector('.nav-trigger.active');
        const matchingTrigger = document.querySelector(`.nav-trigger[data-page="${page}"]`);

        // Mòbil: animació de càrrega de baix a dalt
        if (_isMobile.matches && matchingTrigger && matchingTrigger !== prevTrigger) {
            // Treure estat anterior
            if (prevTrigger) prevTrigger.classList.remove('active');
            document.querySelectorAll('.nav-trigger.nav-loading').forEach(t => t.classList.remove('nav-loading'));
            // Iniciar animació de càrrega
            matchingTrigger.classList.add('nav-loading');
            // Executar navegació i quan acabi, consolidar a active
            SegueixApp.features.navigation?.navigateToPage?.(page);
            // Esperar que l'animació acabi (450ms) per consolidar l'estat
            setTimeout(() => {
                matchingTrigger.classList.add('active');
                matchingTrigger.classList.remove('nav-loading');
            }, 450);
        } else {
            // Desktop: canvi instantani
            document.querySelectorAll('.nav-trigger.active').forEach(t => t.classList.remove('active'));
            if (matchingTrigger) matchingTrigger.classList.add('active');
            SegueixApp.features.navigation?.navigateToPage?.(page);
        }
    }

    navItems.forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            navigateTo(item.dataset.page);
        });
    });

    const navTriggers = document.querySelectorAll('.nav-trigger');
    navTriggers.forEach(trigger => {
        trigger.addEventListener('click', e => {
            e.preventDefault();
            navigateTo(trigger.dataset.page);
        });
    });

    if (libraryTabs) {
        libraryTabs.querySelectorAll('.library-tab').forEach(tab => {
            tab.addEventListener('click', event => {
                event.preventDefault();
                const tabId = tab.dataset.libraryTab;
                if (tabId) requestAnimationFrame(() => setActiveLibraryTab(tabId));
            });
        });
    }

    if (followTabs) {
        followTabs.querySelectorAll('.follow-tab').forEach(tab => {
            tab.addEventListener('click', event => {
                event.preventDefault();
                const tabId = tab.dataset.followTab;
                if (tabId) requestAnimationFrame(() => setActiveFollowTab(tabId));
            });
        });
    }

    const brandLink = document.querySelector('.brand');
    if (brandLink) {
        brandLink.addEventListener('click', e => {
            e.preventDefault();
            SegueixApp.features.navigation?.setActiveNavItem?.('home');
            const basePath = window.location.pathname.replace(/\/index\.html$/, '/');
            history.pushState({}, '', basePath);
            requestAnimationFrame(() => {
                if (!isMiniPlayerActive()) {
                    stopVideoPlayback();
                }
                showHomeNovetats();
            });
        });
    }
}

// Drag-to-delete: mantenir premut un chip personalitzat i arrossegar-lo
// cap a la part superior de la pantalla per eliminar-lo.
const DRAG_DELETE_THRESHOLD_Y = 15;
const DRAG_DELETE_ZONE_HEIGHT = 120;

function initDragToDelete(buttonEl, onDelete) {
    if (!buttonEl || buttonEl.dataset.dragDeleteBound === 'true') return;
    buttonEl.dataset.dragDeleteBound = 'true';

    let initialY = 0;
    let initialX = 0;
    let isDragging = false;
    let touchId = null;

    const getDropzone = () => document.getElementById('delete-dropzone');

    const cleanup = () => {
        const dz = getDropzone();
        if (dz) dz.classList.remove('visible', 'ready-to-delete');
        buttonEl.classList.remove('is-drag-delete');
        buttonEl.style.transform = '';
        isDragging = false;
        touchId = null;
    };

    buttonEl.addEventListener(
        'touchstart',
        e => {
            if (e.touches.length !== 1) return;
            const t = e.touches[0];
            initialY = t.clientY;
            initialX = t.clientX;
            touchId = t.identifier;
            isDragging = false;
        },
        { passive: true }
    );

    buttonEl.addEventListener(
        'touchmove',
        e => {
            const t = Array.from(e.touches).find(touch => touch.identifier === touchId);
            if (!t) return;
            const deltaY = initialY - t.clientY;
            const deltaX = Math.abs(t.clientX - initialX);

            // Activem el drag vertical només si el moviment és clarament cap amunt
            // i més vertical que horitzontal (evitem conflicte amb el scroll lateral)
            if (!isDragging && deltaY > DRAG_DELETE_THRESHOLD_Y && deltaY > deltaX) {
                isDragging = true;
                buttonEl.classList.add('is-drag-delete');
                const dz = getDropzone();
                if (dz) dz.classList.add('visible');
            }

            if (isDragging) {
                e.preventDefault();
                buttonEl.style.transform = `translateY(-${Math.max(0, deltaY)}px) scale(1.05)`;
                const dz = getDropzone();
                if (dz) {
                    if (t.clientY < DRAG_DELETE_ZONE_HEIGHT) {
                        dz.classList.add('ready-to-delete');
                    } else {
                        dz.classList.remove('ready-to-delete');
                    }
                }
            }
        },
        { passive: false }
    );

    const suppressNextClick = () => {
        const handler = ev => {
            ev.stopPropagation();
            ev.preventDefault();
            buttonEl.removeEventListener('click', handler, true);
        };
        buttonEl.addEventListener('click', handler, true);
        // Per si el click no arriba (cancel·lat), netejar al cap d'un moment
        setTimeout(() => buttonEl.removeEventListener('click', handler, true), 400);
    };

    const onTouchEnd = e => {
        if (!isDragging) {
            touchId = null;
            return;
        }
        const t = Array.from(e.changedTouches || []).find(touch => touch.identifier === touchId);
        const endY = t ? t.clientY : Number.POSITIVE_INFINITY;
        const dz = getDropzone();
        const dropped = endY < DRAG_DELETE_ZONE_HEIGHT && dz?.classList.contains('visible');
        cleanup();
        // Evitar que el touchend generi un click que seleccioni la categoria
        suppressNextClick();
        if (dropped && typeof onDelete === 'function') {
            onDelete();
        }
    };

    buttonEl.addEventListener('touchend', onTouchEnd);
    buttonEl.addEventListener('touchcancel', () => {
        const wasDragging = isDragging;
        cleanup();
        if (wasDragging) suppressNextClick();
    });
}

// Gestió unificada dels popovers d'informació (cerca + chips)
// Delegat a document per ser robust davant re-renders de DOM.
function initInfoPopovers() {
    if (window.__infoPopoversInited) return;
    window.__infoPopoversInited = true;

    const TRIGGER_SELECTOR =
        '[data-action="search-info"], [data-action="chips-info"], [data-action="radar-info"]';
    const CLOSE_SELECTOR = '[data-action="chips-info-close"], [data-action="radar-info-close"]';

    const POPOVER_SELECTOR = '.search-info-popover, .chip-info-popover, .radar-info-popover';
    const WRAP_SELECTOR = '.search-info-wrap, .chip-info-wrap, .radar-info-wrap';

    const mountPopoverToBody = popover => {
        if (!popover) return;
        const shouldMount =
            popover.classList?.contains('radar-info-popover') ||
            popover.classList?.contains('chip-info-popover') ||
            popover.classList?.contains('search-info-popover');
        if (!shouldMount) return;
        if (popover.__portalMounted) return;
        popover.__originParent = popover.parentNode;
        popover.__originNextSibling = popover.nextSibling;
        document.body.appendChild(popover);
        popover.__portalMounted = true;
    };

    const restorePopover = popover => {
        if (!popover) return;
        if (!popover.__portalMounted) return;
        const parent = popover.__originParent;
        const nextSibling = popover.__originNextSibling;
        popover.style.cssText = '';
        if (parent) {
            parent.insertBefore(popover, nextSibling || null);
        }
        popover.__portalMounted = false;
    };

    const closeAllPopovers = except => {
        document.querySelectorAll(POPOVER_SELECTOR).forEach(pop => {
            if (pop === except) return;
            if (!pop.hidden) {
                pop.hidden = true;
                const wrap = pop.closest(WRAP_SELECTOR);
                const trigger = wrap?.querySelector(TRIGGER_SELECTOR);
                trigger?.setAttribute('aria-expanded', 'false');
            }
            restorePopover(pop);
        });
    };

    // Posiciona popovers amb position:fixed perquè
    // no quedi tallat per contenidors amb overflow:hidden al desktop.
    // Al mòbil, es mantenen centrats via CSS.
    const positionFixedPopover = (popover, trigger) => {
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        const isSearchInfo = popover.classList.contains('search-info-popover');
        const isChipInfo = popover.classList.contains('chip-info-popover');
        const isRadarInfo = popover.classList.contains('radar-info-popover');
        if (!isSearchInfo && !isChipInfo && !isRadarInfo) return;

        if (isMobile) {
            popover.style.cssText = '';
            return;
        }

        const rect = trigger.getBoundingClientRect();
        const popWidth = Math.min(isRadarInfo ? 360 : 340, window.innerWidth - 32);
        let left = rect.right - popWidth;
        if (left < 16) left = 16;
        if (left + popWidth > window.innerWidth - 16) left = window.innerWidth - popWidth - 16;
        popover.style.position = 'fixed';
        popover.style.top = `${rect.bottom + 10}px`;
        popover.style.left = `${left}px`;
        popover.style.right = 'auto';
        popover.style.transform = 'none';
        popover.style.width = `${popWidth}px`;
    };

    document.addEventListener(
        'click',
        e => {
            const closeBtn = e.target.closest(CLOSE_SELECTOR);
            if (closeBtn) {
                e.preventDefault();
                e.stopPropagation();
                closeAllPopovers();
                return;
            }
            const trigger = e.target.closest(TRIGGER_SELECTOR);
            if (trigger) {
                e.preventDefault();
                e.stopPropagation();
                const wrap = trigger.closest(WRAP_SELECTOR);
                const popover = wrap?.querySelector(POPOVER_SELECTOR);
                if (!popover) return;
                const willOpen = popover.hidden;
                closeAllPopovers(willOpen ? popover : null);
                if (willOpen) {
                    mountPopoverToBody(popover);
                    positionFixedPopover(popover, trigger);
                }
                popover.hidden = !willOpen;
                trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
                if (!willOpen) {
                    restorePopover(popover);
                }
                return;
            }
            // Clic fora: tancar tots
            if (!e.target.closest(POPOVER_SELECTOR)) {
                closeAllPopovers();
            }
        },
        true
    );
}

function bindHomeEvents() {
    // Handler directe a chips-bar per resposta tàctil immediata (evita esperar bubbling a document)
    if (chipsBar) {
        let _chipDebounce = false;
        chipsBar.addEventListener('click', e => {
            // Ignorar clics sobre el botó d'informació (gestionat globalment)
            if (e.target.closest('.chip-info-wrap')) {
                e.stopPropagation();
                return;
            }
            const chip = e.target.closest('.chip');
            if (!chip || chip.closest('#historyPage')) return;
            e.stopPropagation();
            if (chip.classList.contains('chip-add')) {
                openCustomCategoryModal();
                return;
            }
            if (chip.classList.contains('chip-info')) {
                return;
            }
            // Debounce anti-congelació
            if (_chipDebounce) return;
            _chipDebounce = true;

            const previousCategory = selectedCategory;
            selectedCategory = chip.dataset.cat || 'Tot';
            localStorage.setItem(LAST_CATEGORY_STORAGE_KEY, selectedCategory);

            // Feedback visual immediat
            document.querySelector('.chip.is-active')?.classList.remove('is-active');
            document.querySelectorAll('.chip.chip-loading').forEach(c => c.classList.remove('chip-loading'));
            const isMobile = window.matchMedia('(max-width: 768px)').matches;
            if (isMobile) {
                chip.classList.add('chip-loading');
            } else {
                chip.classList.add('is-active');
            }

            saveChipsToCache();
            const basePath = window.location.pathname.replace(/\/index\.html$/, '/');
            // Guardar la categoria anterior a l'entrada actual del historial
            history.replaceState(
                { ...(history.state || {}), appPage: 'home', category: previousCategory },
                '',
                basePath
            );
            // Crear nova entrada amb la categoria nova
            history.pushState({ appPage: 'home', category: selectedCategory }, '', basePath);

            // Diferir el treball pesat per deixar l'animació córrer
            requestAnimationFrame(() => {
                setTimeout(() => {
                    if (!isMiniPlayerActive()) {
                        stopVideoPlayback();
                    }
                    showHome({ skipPushState: true });
                    renderCategoryActions(getCategoryPageTitle(selectedCategory));
                    renderFeed();

                    // Consolidar estat visual
                    chip.classList.remove('chip-loading');
                    chip.classList.add('is-active');
                    _chipDebounce = false;

                    if (isCustomCategory(selectedCategory)) {
                        const activeCategory = selectedCategory;
                        refreshCustomCategorySearch(activeCategory).then(() => {
                            if (selectedCategory === activeCategory) {
                                renderFeed();
                            }
                        });
                    }
                }, 0);
            });
        });
    }

    if (searchForm && searchInput) {
        ensureSearchDropdown();

        searchForm.addEventListener('submit', async e => {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (!query) {
                hideSearchDropdown();
                return;
            }
            await navigateToSearchResults(query);
        });

        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim();
            if (searchDebounceTimeout) {
                clearTimeout(searchDebounceTimeout);
            }
            if (!query) {
                hideSearchDropdown();
                return;
            }
            const requestId = ++activeSearchRequestId;
            searchDebounceTimeout = setTimeout(async () => {
                const results = await performDualSearch(query);
                if (requestId !== activeSearchRequestId || searchInput.value.trim() !== query) {
                    return;
                }
                showSearchDropdown(results);
            }, 300);
        });

        searchInput.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                hideSearchDropdown();
                if (isMobileView()) closeMobileSearch();
                return;
            }
            if (!searchDropdown || searchDropdown.hidden) {
                return;
            }
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                focusSearchDropdownItem(0);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                focusSearchDropdownItem(searchDropdownItems.length - 1);
            }
        });

        if (searchDropdown) {
            searchDropdown.addEventListener('click', event => {
                const item = event.target.closest('.search-result-item');
                if (!item) {
                    return;
                }
                handleSearchResultSelection(item);
            });

            searchDropdown.addEventListener('keydown', event => {
                if (!searchDropdownItems.length) {
                    return;
                }
                const currentIndex = searchDropdownItems.indexOf(document.activeElement);
                if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    focusSearchDropdownItem(currentIndex + 1);
                } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    focusSearchDropdownItem(currentIndex - 1);
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    hideSearchDropdown();
                    searchInput.focus();
                }
            });
        }
    }

    if (heroButton) {
        heroButton.addEventListener('click', () => {
            const videoId = heroSection?.dataset.videoId;
            const source = heroSection?.dataset.source;
            if (!videoId) return;
            openVideoFromUserGesture(videoId, source);
        });
    }

    const heroThumbnail = heroSection?.querySelector('.hero-thumbnail');
    if (heroThumbnail) {
        heroThumbnail.addEventListener('click', () => {
            const videoId = heroSection?.dataset.videoId;
            const source = heroSection?.dataset.source;
            if (!videoId) return;
            openVideoFromUserGesture(videoId, source);
        });
    }
}

function bindButtonInstant(button, action) {
    if (!button) return;

    // Per a pantalles tàctils: execució immediata i prevenció del click fantasma
    button.addEventListener(
        'touchend',
        e => {
            e.preventDefault();
            action(e);
        },
        { passive: false }
    );

    // Per a ratolí (escriptori)
    button.addEventListener('click', e => {
        action(e);
    });
}

function bindWatchEvents() {
    bindButtonInstant(backgroundBtn, openBackgroundModal);
}

function bindPlaylistEvents() {
    if (createPlaylistBtn) {
        createPlaylistBtn.addEventListener('click', () => {
            const name = playlistNameInput?.value?.trim();
            if (!name) return;
            createPlaylist(name);
            if (playlistNameInput) {
                playlistNameInput.value = '';
            }
            renderPlaylistsPage();
        });
    }

    if (playlistNameInput) {
        playlistNameInput.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                createPlaylistBtn?.click();
            }
        });
    }

    if (playlistModal) {
        const closeBtn = playlistModal.querySelector('.playlist-modal-close');
        const backdrop = playlistModal.querySelector('.playlist-modal-backdrop');
        closeBtn?.addEventListener('click', closePlaylistModal);
        backdrop?.addEventListener('click', closePlaylistModal);
    }
}

function bindHistoryEvents() {
    if (historyFilters) {
        historyFilters.addEventListener('click', event => {
            const chip = event.target.closest('.chip');
            if (!chip) return;
            event.stopPropagation();
            const historyCategory = chip.dataset.historyCat;
            if (chip.dataset.historyFilter === 'liked') {
                historyFilterLiked = !historyFilterLiked;
            } else if (historyCategory) {
                historySelectedCategory = historyCategory;
            }
            updateHistoryFilterUI();
            renderHistory();
        });
    }
}

function bindChannelEvents() {
    if (channelBackBtn) {
        channelBackBtn.addEventListener('click', event => {
            event.preventDefault();
            const scrollY = segueixScrollYBeforeChannel;
            segueixScrollYBeforeChannel = null;
            showFollow(activeFollowTab || 'all', scrollY !== null ? { scrollY } : {});
        });
    }

    const bindChannelSearchInput = input => {
        if (!input) return;
        input.addEventListener('input', event => {
            const query = event.target.value || '';
            if (channelSearchInputDesktop && channelSearchInputDesktop !== input)
                channelSearchInputDesktop.value = query;
            if (channelSearchInputMobile && channelSearchInputMobile !== input) channelSearchInputMobile.value = query;
            renderChannelVideos(query);
        });
    };
    bindChannelSearchInput(channelSearchInputDesktop);
    bindChannelSearchInput(channelSearchInputMobile);

    const addYoutuberBtn = document.getElementById('addYoutuberBtn');
    bindButtonInstant(addYoutuberBtn, openAddYoutuberModal);
    initAddYoutuberModal();
}

function bindConfigEvents() {
    if (customCategoryModal) {
        customCategoryModal.addEventListener('click', event => {
            if (event.target === customCategoryModal) {
                closeCustomCategoryModal();
            }
        });
    }

    if (customCategoryModalClose) {
        customCategoryModalClose.addEventListener('click', () => {
            closeCustomCategoryModal();
        });
        customCategoryModalClose.addEventListener(
            'touchend',
            event => {
                event.preventDefault();
                closeCustomCategoryModal();
            },
            { passive: false }
        );
    }

    if (customCategoryAddBtn) {
        customCategoryAddBtn.addEventListener('click', () => {
            handleCustomCategoryCreation();
        });
        customCategoryAddBtn.addEventListener(
            'touchend',
            event => {
                event.preventDefault();
                handleCustomCategoryCreation();
            },
            { passive: false }
        );
    }

    if (customCategoryInput) {
        customCategoryInput.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleCustomCategoryCreation();
            }
        });
    }

    // Modal d'etiquetes de categoria
    if (categoryKeywordsModal) {
        categoryKeywordsModal.addEventListener('click', event => {
            if (event.target === categoryKeywordsModal) {
                closeCategoryKeywordsModal();
            }
        });
    }

    if (categoryKeywordsModalClose) {
        categoryKeywordsModalClose.addEventListener('click', () => {
            closeCategoryKeywordsModal();
        });
        categoryKeywordsModalClose.addEventListener(
            'touchend',
            event => {
                event.preventDefault();
                closeCategoryKeywordsModal();
            },
            { passive: false }
        );
    }

    if (categoryKeywordAddBtn) {
        categoryKeywordAddBtn.addEventListener('click', () => {
            handleCategoryKeywordAdd();
        });
        categoryKeywordAddBtn.addEventListener(
            'touchend',
            event => {
                event.preventDefault();
                handleCategoryKeywordAdd();
            },
            { passive: false }
        );
    }

    if (categoryKeywordInput) {
        categoryKeywordInput.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleCategoryKeywordAdd();
            }
        });
    }
}

// Inicialitzar event listeners
function initEventListeners() {
    bindCoreEvents();
    bindNavigationEvents();
    bindChannelEvents();
    bindHomeEvents();
    bindMobileSearchEvents();
    bindWatchEvents();
    bindPlaylistEvents();
    bindHistoryEvents();
    bindConfigEvents();

    // Short modal: listeners tàctils (reemplaça onclick inline)
    const shortBackdrop = document.getElementById('short-modal-backdrop');
    const shortCloseBtn = document.getElementById('short-modal-close-btn');
    if (shortBackdrop) shortBackdrop.addEventListener('click', () => closeShortModal());
    if (shortCloseBtn) shortCloseBtn.addEventListener('click', () => closeShortModal());
}

async function initAppUpdater() {
    const updateBadge = document.getElementById('updateBadge');

    const showUpdateNotice = () => {
        if (updateBadge) {
            updateBadge.style.display = 'block';
        }
    };

    const hideUpdateNotice = () => {
        if (updateBadge) {
            updateBadge.style.display = 'none';
        }
    };

    refreshIcons();

    if (!('serviceWorker' in navigator)) {
        return;
    }

    try {
        // Capturem si el client ja estava controlat ABANS de registrar el SW.
        // Ens serveix per distingir:
        //   - Primera instal·lació (cap controller previ) → NO s'ha de recarregar
        //     mai, ni tan sols quan el SW prengui control via clients.claim(). Fer
        //     reload en aquest cas provoca el bug "al mòbil, obrir l'app i fer
        //     scroll la refresca" perquè el claim pot arribar mentre l'usuari
        //     ja està interactuant.
        //   - Actualització (ja hi havia controller) → el reload només ha de
        //     passar si l'usuari ha demanat explícitament l'actualització.
        const hadControllerOnLoad = Boolean(navigator.serviceWorker.controller);

        swRegistration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });

        // Activa el SW en espera: en prendre el control, 'controllerchange' recarrega la pàgina.
        const applyUpdate = () => {
            const waiting = swRegistration?.waiting;
            if (!waiting) return false;
            waiting.postMessage({ type: 'SKIP_WAITING' });
            return true;
        };

        // Un SW nou queda "en espera" mentre hi ha pestanyes obertes (la pestanya normal
        // en manté una d'antiga per sempre). Si l'usuari no hi està interactuant
        // (pàgina en segon pla) l'apliquem sense demanar res; si no, mostrem l'avís.
        const handleWaitingWorker = () => {
            if (!swRegistration?.waiting || !hadControllerOnLoad) return;
            if (document.visibilityState === 'hidden') {
                applyUpdate();
            } else {
                showUpdateNotice();
            }
        };

        const bindInstallingWorker = worker => {
            if (!worker) return;
            worker.addEventListener('statechange', () => {
                if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                    handleWaitingWorker();
                }
            });
        };

        bindInstallingWorker(swRegistration.installing);
        swRegistration.addEventListener('updatefound', () => {
            bindInstallingWorker(swRegistration.installing);
        });

        // Un SW ja en espera en obrir l'app (actualització baixada en una visita anterior):
        // s'aplica ara mateix, abans que l'usuari hi interactuï, perquè no quedi mai desfasada.
        if (swRegistration.waiting && hadControllerOnLoad) {
            applyUpdate();
        }

        // El badge d'actualització ara és clicable: aplica l'actualització.
        const updateBadgeButton = updateBadge?.closest('button');
        updateBadgeButton?.addEventListener(
            'click',
            event => {
                if (updateBadge.style.display === 'none' || !swRegistration?.waiting) return;
                event.preventDefault();
                event.stopImmediatePropagation();
                applyUpdate();
            },
            true
        );

        // Comprova si hi ha versió nova en tornar a la pestanya i cada 30 minuts.
        const checkForUpdate = () => {
            swRegistration?.update().catch(() => {});
        };
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                checkForUpdate();
                handleWaitingWorker();
            } else {
                handleWaitingWorker();
            }
        });
        setInterval(checkForUpdate, 30 * 60 * 1000);
        checkForUpdate();

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (isSwRefreshing) return;
            // Si no hi havia controller en carregar la pàgina, aquest canvi és
            // la primera presa de control del SW — no cal refrescar res.
            if (!hadControllerOnLoad) {
                hideUpdateNotice();
                return;
            }
            isSwRefreshing = true;
            hideUpdateNotice();
            window.location.reload();
        });
    } catch (error) {
        console.warn("No s'ha pogut registrar el Service Worker", error);
    }
}

function initInstallPrompt() {
    if (window.matchMedia('(display-mode: standalone)').matches) {
        return;
    }

    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        installPromptEvent = event;

        if (document.querySelector('.install-floating-btn')) {
            return;
        }

        const floatingBtn = document.createElement('button');
        floatingBtn.type = 'button';
        floatingBtn.className = 'install-floating-btn';
        floatingBtn.setAttribute('aria-label', 'Install App');
        floatingBtn.innerHTML = '<i data-lucide="download"></i><span>Install App</span>';
        document.body.appendChild(floatingBtn);

        refreshIcons(floatingBtn);

        requestAnimationFrame(() => {
            floatingBtn.classList.add('show');
        });

        const removeButton = () => {
            if (!floatingBtn.isConnected) {
                return;
            }
            floatingBtn.classList.remove('show');
            setTimeout(() => floatingBtn.remove(), 500);
        };

        const autoHideTimeout = setTimeout(removeButton, 5000);

        floatingBtn.addEventListener('click', () => {
            clearTimeout(autoHideTimeout);
            removeButton();

            if (!installPromptEvent) {
                return;
            }
            installPromptEvent.prompt();
            installPromptEvent = null;
        });
    });
}

// Inicialitzar modal de colors
// Personalització visual (fons, color de botons, mida de font)
function initBackgroundModal() {
    const closeModal = document.getElementById('closeBackgroundModal');

    if (!backgroundModal || !closeModal || !backgroundOptions) {
        console.warn('⚠️  Modal de color de fons no disponible');
        return;
    }

    closeModal.addEventListener('click', closeBackgroundModal);
    backgroundModal.addEventListener('click', e => {
        if (e.target === backgroundModal) closeBackgroundModal();
    });

    if (currentColorDisplay && expandedColorPicker) {
        currentColorDisplay.addEventListener('click', showExpandedColorPicker);
    }
    if (closeExpandedColorPicker && expandedColorPicker) {
        closeExpandedColorPicker.addEventListener('click', hideExpandedColorPicker);
    }

    const buttons = backgroundOptions.querySelectorAll('[data-color]');
    buttons.forEach(button => {
        const color = button.dataset.color;
        button.style.backgroundColor = color;
        button.addEventListener('click', () => applyBackgroundColor(color, true, true));
    });

    // Button color picker (expanded/collapsed)
    if (currentButtonColorDisplay && expandedButtonColorPicker) {
        currentButtonColorDisplay.addEventListener('click', showExpandedButtonColorPicker);
    }
    if (closeExpandedButtonColorPicker && expandedButtonColorPicker) {
        closeExpandedButtonColorPicker.addEventListener('click', hideExpandedButtonColorPicker);
    }

    bindYouTubeConsentSettingsUi();
    updateYouTubeConsentSettingsUi();
    initYouTubePremiumToggle();

    // Button color options
    if (buttonColorOptions) {
        const buttonBtns = buttonColorOptions.querySelectorAll('[data-color]');
        buttonBtns.forEach(button => {
            const color = button.dataset.color;
            button.style.backgroundColor = color;
            button.addEventListener('click', () => applyButtonColor(color, true, true));
        });
    }
}

// ==================== SEMPRE TINC SORT ====================
function initLuckyMode() {
    const toggle = document.getElementById('luckyToggle');
    if (!toggle) return;

    const isOn = localStorage.getItem(LUCKY_STORAGE_KEY) === 'true';
    toggle.checked = isOn;

    // Aplicar randomització si actiu (a cada càrrega de pàgina)
    if (isOn) {
        applyLuckyColors();
    }

    toggle.addEventListener('change', () => {
        const enabled = toggle.checked;
        localStorage.setItem(LUCKY_STORAGE_KEY, String(enabled));
        if (enabled) {
            applyLuckyColors();
        } else {
            // Restaurar colors guardats
            document.documentElement.style.removeProperty('--color-icon-accent');
            document.documentElement.style.removeProperty('--color-search-accent');
            initBackgroundPicker();
            initButtonColorPicker();
        }
    });
}

// Enfosquir un color hex per un factor (0.0 = negre, 1.0 = sense canvi)
function darkenHexColor(hex, factor) {
    const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
    const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
    const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function applyLuckyColors() {
    const randomBg = LUCKY_BG_COLORS[Math.floor(Math.random() * LUCKY_BG_COLORS.length)];
    const randomBtn = LUCKY_BTN_COLORS[Math.floor(Math.random() * LUCKY_BTN_COLORS.length)];

    // Escalat de colors: categories (base) → icones (2 tons fosc) → cerca (4 tons fosc)
    const iconColor = darkenHexColor(randomBtn, 0.7);
    const searchColor = darkenHexColor(randomBtn, 0.5);

    document.documentElement.style.setProperty('--color-background', randomBg);
    document.documentElement.style.setProperty('--color-button-accent', randomBtn);
    document.documentElement.style.setProperty('--color-icon-accent', iconColor);
    document.documentElement.style.setProperty('--color-search-accent', searchColor);

    if (currentColorDisplay) currentColorDisplay.style.backgroundColor = randomBg;
    if (currentButtonColorDisplay) currentButtonColorDisplay.style.backgroundColor = randomBtn;
}

function initBackgroundPicker() {
    const stored = localStorage.getItem(BACKGROUND_STORAGE_KEY);
    const initial = BACKGROUND_COLORS.includes(stored) ? stored : BACKGROUND_COLORS[0];
    applyBackgroundColor(initial, false);
}

function applyBackgroundColor(color, persist = true, collapsePicker = false) {
    if (!BACKGROUND_COLORS.includes(color)) {
        return;
    }
    document.documentElement.style.setProperty('--color-background', color);
    if (persist) {
        localStorage.setItem(BACKGROUND_STORAGE_KEY, color);
    }
    if (currentColorDisplay) {
        currentColorDisplay.style.backgroundColor = color;
    }
    if (backgroundOptions) {
        backgroundOptions.querySelector('[data-color].is-active')?.classList.remove('is-active');
        const activeBtn = backgroundOptions.querySelector(`[data-color="${CSS.escape(color)}"]`);
        if (activeBtn) {
            activeBtn.classList.add('is-active');
            activeBtn.setAttribute('aria-pressed', 'true');
        }
    }
    if (collapsePicker) {
        hideExpandedColorPicker();
    }
}

function showExpandedColorPicker() {
    if (!currentColorDisplay || !expandedColorPicker) {
        return;
    }
    currentColorDisplay.classList.add('hidden');
    expandedColorPicker.classList.remove('hidden');
}

function hideExpandedColorPicker() {
    if (!currentColorDisplay || !expandedColorPicker) {
        return;
    }
    expandedColorPicker.classList.add('hidden');
    currentColorDisplay.classList.remove('hidden');
}

function initFontSizeControls() {
    if (!fontDecreaseBtn || !fontIncreaseBtn || !fontSizeDisplay) {
        return;
    }
    const stored = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    const storedValue = stored ? Number.parseFloat(stored) : null;
    const computedValue = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize);
    currentFontSize = Number.isFinite(storedValue) ? storedValue : computedValue || 16;
    document.documentElement.style.fontSize = `${currentFontSize}px`;
    updateFontSizeDisplay();

    fontDecreaseBtn.addEventListener('click', () => adjustFontSize(-1));
    fontIncreaseBtn.addEventListener('click', () => adjustFontSize(1));
}

function adjustFontSize(delta) {
    const minSize = 12;
    const maxSize = 24;
    const nextSize = Math.min(maxSize, Math.max(minSize, (currentFontSize || 16) + delta));
    if (nextSize === currentFontSize) {
        return;
    }
    currentFontSize = nextSize;
    document.documentElement.style.fontSize = `${currentFontSize}px`;
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(currentFontSize));
    updateFontSizeDisplay();
}

function updateFontSizeDisplay() {
    if (!fontSizeDisplay) {
        return;
    }
    const size = currentFontSize || parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    fontSizeDisplay.textContent = `Font ${Math.round(size)}px`;
}

function initButtonColorPicker() {
    const stored = localStorage.getItem(BUTTON_COLOR_STORAGE_KEY);
    const initial = BUTTON_COLORS.includes(stored) ? stored : BUTTON_COLORS[0];
    applyButtonColor(initial, false);
}

function applyButtonColor(color, persist = true, collapsePicker = false) {
    if (!BUTTON_COLORS.includes(color)) return;
    document.documentElement.style.setProperty('--color-button-accent', color);
    if (persist) {
        localStorage.setItem(BUTTON_COLOR_STORAGE_KEY, color);
    }
    if (currentButtonColorDisplay) {
        currentButtonColorDisplay.style.backgroundColor = color;
    }
    if (buttonColorOptions) {
        buttonColorOptions.querySelector('[data-color].is-active')?.classList.remove('is-active');
        const activeBtn = buttonColorOptions.querySelector(`[data-color="${CSS.escape(color)}"]`);
        if (activeBtn) {
            activeBtn.classList.add('is-active');
            activeBtn.setAttribute('aria-pressed', 'true');
        }
    }
    if (collapsePicker) {
        hideExpandedButtonColorPicker();
    }
}

function showExpandedButtonColorPicker() {
    if (!currentButtonColorDisplay || !expandedButtonColorPicker) return;
    currentButtonColorDisplay.classList.add('hidden');
    expandedButtonColorPicker.classList.remove('hidden');
}

function hideExpandedButtonColorPicker() {
    if (!currentButtonColorDisplay || !expandedButtonColorPicker) return;
    expandedButtonColorPicker.classList.add('hidden');
    currentButtonColorDisplay.classList.remove('hidden');
}

function openBackgroundModal() {
    if (!backgroundModal) return;
    const wasActive = backgroundModal.classList.contains('active');
    backgroundModal.classList.add('active');
    syncYouTubePremiumToggle();
    if (!wasActive) {
        history.pushState({ ...(history.state || {}), modal: 'background' }, '', window.location.href);
    }
    hideExpandedColorPicker();
    hideExpandedButtonColorPicker();
    updateYouTubeConsentSettingsUi();
    // Deixa respirar el fil principal abans de parsejar SVGs
    setTimeout(() => {
        requestAnimationFrame(() => refreshIcons(backgroundModal));
    }, 50);
}

function closeBackgroundModal(fromPopstate = false) {
    if (!backgroundModal) return;
    const wasActive = backgroundModal.classList.contains('active');
    backgroundModal.classList.remove('active');
    if (wasActive && !fromPopstate && history.state && history.state.modal === 'background') {
        suppressNextPopstateNavigation = true;
        history.back();
    }
}

function openCustomCategoryModal() {
    if (!customCategoryModal) {
        return;
    }
    customCategoryModal.classList.add('active');
    customCategoryModal.setAttribute('aria-hidden', 'false');
    isCustomCategoryModalScrollLocked = !isMobileView();
    if (isCustomCategoryModalScrollLocked) {
        lockBodyScroll();
    }
    if (customCategoryInput) {
        customCategoryInput.value = '';
        requestAnimationFrame(() => {
            customCategoryInput.focus();
        });
    }
    requestAnimationFrame(() => refreshIcons(customCategoryModal));
}

function closeCustomCategoryModal() {
    if (!customCategoryModal) {
        return;
    }
    customCategoryModal.classList.remove('active');
    customCategoryModal.setAttribute('aria-hidden', 'true');
    if (isCustomCategoryModalScrollLocked) {
        unlockBodyScroll();
    }
    isCustomCategoryModalScrollLocked = false;
}

// ==================== MODAL ETIQUETES DE CATEGORIA ====================

function openCategoryKeywordsModal(categoryName) {
    if (!categoryKeywordsModal) return;
    const normalized = normalizeCustomTag(categoryName);
    if (!normalized) return;
    categoryKeywordsCurrentCategory = normalized;
    if (categoryKeywordsModalName) {
        categoryKeywordsModalName.textContent = `Etiquetes: ${normalized}`;
    }
    categoryKeywordsModal.classList.add('active');
    categoryKeywordsModal.setAttribute('aria-hidden', 'false');
    isCategoryKeywordsModalScrollLocked = !isMobileView();
    if (isCategoryKeywordsModalScrollLocked) {
        lockBodyScroll();
    }
    if (categoryKeywordInput) {
        categoryKeywordInput.value = '';
        requestAnimationFrame(() => categoryKeywordInput.focus());
    }
    renderCategoryKeywordsList();
    requestAnimationFrame(() => refreshIcons(categoryKeywordsModal));
}

function closeCategoryKeywordsModal() {
    if (!categoryKeywordsModal) return;
    const closingCategory = categoryKeywordsCurrentCategory;
    categoryKeywordsModal.classList.remove('active');
    categoryKeywordsModal.setAttribute('aria-hidden', 'true');
    if (isCategoryKeywordsModalScrollLocked) {
        unlockBodyScroll();
    }
    isCategoryKeywordsModalScrollLocked = false;
    categoryKeywordsCurrentCategory = null;
    // Refrescar la vista inline i el feed per reflectir els canvis d'etiquetes
    if (closingCategory) {
        renderInlineKeywords(closingCategory);
        if (typeof updateFeed === 'function') {
            updateFeed();
        }
    }
}

function renderCategoryKeywordsList() {
    if (!categoryKeywordsList || !categoryKeywordsCurrentCategory) return;
    const keywords = getCategoryKeywords(categoryKeywordsCurrentCategory);
    if (keywords.length === 0) {
        categoryKeywordsList.innerHTML =
            '<p style="color: var(--color-text-secondary); font-size: 0.85rem; margin: 0;">Cap etiqueta afegida encara.</p>';
        return;
    }
    categoryKeywordsList.innerHTML = keywords
        .map(
            kw => `
        <span class="category-keyword-chip">
            ${escapeHtml(kw)}
            <button class="keyword-remove" type="button" data-keyword="${escapeHtml(kw)}" aria-label="Eliminar ${escapeHtml(kw)}">✕</button>
        </span>
    `
        )
        .join('');

    categoryKeywordsList.querySelectorAll('.keyword-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const kw = btn.dataset.keyword;
            removeCategoryKeyword(categoryKeywordsCurrentCategory, kw);
            renderCategoryKeywordsList();
        });
    });
}

function handleCategoryKeywordAdd() {
    if (!categoryKeywordInput || !categoryKeywordsCurrentCategory) return;
    const value = categoryKeywordInput.value.trim();
    if (!value) return;
    addCategoryKeyword(categoryKeywordsCurrentCategory, value);
    categoryKeywordInput.value = '';
    categoryKeywordInput.focus();
    renderCategoryKeywordsList();
    // Actualitzar també la vista inline si existeix
    renderInlineKeywords(categoryKeywordsCurrentCategory);
}

// Renderitza etiquetes com a chips esborrables + input directament al feed
function renderInlineKeywords(categoryName) {
    const container = document.getElementById('categoryKeywordsInline');
    if (!container) return;
    const normalized = normalizeCustomTag(categoryName);
    // Amagar etiquetes a categories intel·ligents (creades amb cerca entre cometes "")
    if (!normalized || isExactCategory(normalized) || !isCustomCategory(normalized)) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }
    const keywords = getCategoryKeywords(normalized);
    const chipsHtml = keywords
        .map(
            kw => `
        <span class="category-keyword-chip">
            ${escapeHtml(kw)}
            <button class="keyword-remove" type="button" data-keyword="${escapeHtml(kw)}" aria-label="Eliminar ${escapeHtml(kw)}">✕</button>
        </span>
    `
        )
        .join('');

    container.innerHTML = `
        <div class="inline-keywords-row">
            ${chipsHtml}
            <span class="inline-keyword-add">
                <input class="inline-keyword-input" type="text" placeholder="+ etiqueta" autocomplete="off" aria-label="Afegir etiqueta">
            </span>
        </div>
    `;
    container.style.display = '';

    // Vincular eliminació de chips
    container.querySelectorAll('.keyword-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            removeCategoryKeyword(normalized, btn.dataset.keyword);
            renderInlineKeywords(normalized);
            updateFeed();
        });
    });

    // Vincular input per afegir etiquetes
    const inlineInput = container.querySelector('.inline-keyword-input');
    if (inlineInput) {
        inlineInput.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                const value = inlineInput.value.trim();
                if (!value) return;
                addCategoryKeyword(normalized, value);
                renderInlineKeywords(normalized);
                updateFeed();
            }
        });
    }
}

// Amagar etiquetes inline quan canvia la pàgina o la categoria
function hideInlineKeywords() {
    const container = document.getElementById('categoryKeywordsInline');
    if (container) {
        container.style.display = 'none';
        container.innerHTML = '';
    }
}

function handleCustomCategoryCreation() {
    if (!customCategoryInput) {
        return;
    }
    const rawValue = String(customCategoryInput.value || '').trim();
    const normalized = normalizeCustomTag(rawValue);
    if (!normalized) {
        return;
    }
    const addedTag = addCustomTag(normalized);
    if (!addedTag) {
        return;
    }
    // Marcar com a categoria exacta si l'usuari ha escrit entre cometes
    if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
        markExactCategory(normalized);
    }
    selectedCategory = addedTag;
    localStorage.setItem(LAST_CATEGORY_STORAGE_KEY, selectedCategory);
    setupChipsBarOrdering();
    closeCustomCategoryModal();

    const basePath = window.location.pathname.replace(/\/index\.html$/, '/');
    history.pushState({}, '', basePath);
    if (!isMiniPlayerActive()) {
        stopVideoPlayback();
    }
    showHome();
    renderCategoryActions(getCategoryPageTitle(selectedCategory));
    renderFeed();

    // Forçar selecció visual del chip creat
    if (chipsBar) {
        chipsBar.querySelectorAll('.chip.is-active').forEach(c => c.classList.remove('is-active'));
        const newChip = chipsBar.querySelector(`.chip[data-cat="${CSS.escape(addedTag)}"]`);
        if (newChip) {
            newChip.classList.add('is-active');
            newChip.setAttribute('aria-pressed', 'true');
            newChip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }

    if (isCustomCategory(selectedCategory)) {
        const activeCategory = selectedCategory;
        refreshCustomCategorySearch(activeCategory).then(() => {
            if (selectedCategory === activeCategory) {
                renderFeed();
            }
        });
    }
}

// Mostrar/amagar loading
// Estat de pàgina, capçalera hero i context del feed
function clearLoadingAutoHideTimer() {
    if (loadingAutoHideTimer) {
        clearTimeout(loadingAutoHideTimer);
        loadingAutoHideTimer = null;
    }
}

function scheduleLoadingAutoHide() {
    clearLoadingAutoHideTimer();

    if (!isIOSLikeDevice()) {
        return;
    }

    loadingAutoHideTimer = setTimeout(() => {
        if (!loading?.classList.contains('active')) {
            return;
        }

        const visibleForMs = Date.now() - loadingVisibleSince;
        console.warn(`Loading overlay auto-hidden on iOS after ${visibleForMs}ms.`);
        hideLoading();
    }, 4000);
}

function showLoading() {
    if (!loading) {
        return;
    }

    loadingVisibleSince = Date.now();
    loading.classList.add('active');
    scheduleLoadingAutoHide();
}

function hideLoading() {
    clearLoadingAutoHideTimer();

    if (!loading) {
        return;
    }

    loading.classList.remove('active');
    loadingVisibleSince = 0;
}

function setPageTitle(title) {
    if (pageTitle) {
        pageTitle.classList.remove('page-title--with-actions');
        pageTitle.dataset.title = title;
        pageTitle.textContent = title;
    }
    hideInlineKeywords();
}

function getCategoryPageTitle(category) {
    if (!category || category === 'Tot') {
        return 'Recomanat per a tu';
    }
    return category;
}

function getNewestVideoFromList(videos) {
    if (!Array.isArray(videos) || videos.length === 0) return null;

    return videos.reduce((latest, video) => {
        const dateValue = video.publishedAt || video.uploadDate || video.snippet?.publishedAt;
        const videoDate = dateValue ? new Date(dateValue) : null;
        if (!videoDate || Number.isNaN(videoDate.getTime())) return latest;
        if (!latest || videoDate > latest.date) {
            return { video, date: videoDate };
        }
        return latest;
    }, null);
}

function getMostViewedVideoFromList(videos) {
    if (!Array.isArray(videos) || videos.length === 0) return null;

    const toViewCount = video => {
        const raw = video?.viewCount ?? video?.views ?? video?.statistics?.viewCount ?? 0;
        if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
        if (typeof raw === 'string') {
            const normalized = raw.replace(/[^\d]/g, '');
            return normalized ? Number(normalized) : 0;
        }
        return 0;
    };

    return videos.reduce((best, video) => {
        const views = toViewCount(video);
        if (!best || views > best.views) {
            return { video, views };
        }
        return best;
    }, null);
}

function getHeroSectionKey() {
    return (pageTitle?.dataset?.title || pageTitle?.textContent || 'feed').trim();
}

function getFeaturedVideoForSection(videos, sectionKey) {
    if (!Array.isArray(videos) || videos.length === 0) {
        if (sectionKey) {
            featuredVideoBySection.delete(sectionKey);
        }
        return null;
    }

    const normalizedSection = sectionKey || 'feed';
    const usedIds = new Set();
    featuredVideoBySection.forEach((videoId, key) => {
        if (key !== normalizedSection) {
            usedIds.add(String(videoId));
        }
    });

    const watchedIds = getHistoryVideoIdSet();
    const available = videos.filter(video => {
        const videoId = String(video.id);
        if (usedIds.has(videoId)) {
            return false;
        }
        if (watchedIds.has(videoId)) {
            return false;
        }
        if (video.isShort === true) {
            return false;
        }
        const seconds = getVideoDurationSeconds(video);
        if (seconds === null || seconds < MIN_RECOMMENDED_SECONDS) {
            return false;
        }
        return true;
    });
    // A «Recomanat per a tu» la llista ja arriba ordenada pel recomanador.
    // El primer vídeo disponible és, per tant, el millor candidat per al Hero.
    if (normalizedSection === 'Recomanat per a tu' && available[0]) {
        featuredVideoBySection.set(normalizedSection, String(available[0].id));
        return available[0];
    }

    const newest = getNewestVideoFromList(available);
    if (newest?.video) {
        featuredVideoBySection.set(normalizedSection, String(newest.video.id));
        return newest.video;
    }

    featuredVideoBySection.delete(normalizedSection);
    return null;
}

function updateHero(video, source = 'static') {
    if (!heroSection || !video) {
        if (heroSection) {
            heroSection.classList.add('hidden');
        }
        return;
    }

    const title = video.title || video.snippet?.title || 'Vídeo destacat';
    const description = video.description || video.snippet?.description || '';
    const thumbnail =
        video.thumbnail ||
        video.snippet?.thumbnails?.maxres?.url ||
        video.snippet?.thumbnails?.standard?.url ||
        video.snippet?.thumbnails?.high?.url ||
        '';
    const duration = getVideoDisplayDuration(video);

    heroSection.classList.remove('hidden');
    heroSection.dataset.videoId = video.id;
    heroSection.dataset.source = source;
    heroTitle.textContent = title;
    heroDescription.textContent = description
        ? description.substring(0, 140) + (description.length > 140 ? '...' : '')
        : '';
    heroImage.style.visibility = '';
    heroImage.src = thumbnail;
    heroImage.alt = title;
    if (duration) {
        heroDuration.textContent = duration;
        heroDuration.classList.remove('hidden');
    } else {
        heroDuration.textContent = '';
        heroDuration.classList.add('hidden');
    }

    if (heroEyebrow) {
        heroEyebrow.textContent = source === 'api' ? 'Destacat del moment' : 'Destacat de la setmana';
    }

    if (heroChannel) {
        const channelName =
            video.channelTitle ||
            (typeof getChannelById === 'function' ? getChannelById(video.channelId)?.name : '') ||
            '';
        const channelId = video.channelId || '';
        heroChannel.innerHTML = channelName
            ? `<span class="channel-link" onclick="openChannelProfile('${channelId}'); event.stopPropagation();">${escapeHtml(channelName)}</span>`
            : '';
        heroChannel.classList.toggle('hidden', !channelName);
    }
}

function getChannelSearchMeta(channelId) {
    if (!channelId) {
        return { name: '', description: '' };
    }
    const normalizedId = String(channelId);
    const feedChannels = Array.isArray(YouTubeAPI?.feedChannels) ? YouTubeAPI.feedChannels : [];
    const feedChannel = feedChannels.find(channel => String(channel?.id) === normalizedId);
    const cached = cachedChannels[normalizedId] || cachedChannels[channelId] || {};
    const staticChannel = typeof getChannelById === 'function' ? getChannelById(channelId) : null;
    return {
        name: feedChannel?.name || feedChannel?.title || cached.name || cached.title || staticChannel?.name || '',
        description: feedChannel?.description || cached.description || staticChannel?.description || '',
    };
}

function getCustomCategorySearchKey(category) {
    const normalized = normalizeCustomTag(category);
    if (!normalized) {
        return '';
    }
    return normalized.toLowerCase();
}

function getCustomCategorySearchResults(category) {
    const key = getCustomCategorySearchKey(category);
    if (!key) {
        return [];
    }
    const cached = customCategorySearchCache.get(key);
    return Array.isArray(cached) ? cached : [];
}

function setCustomCategorySearchResults(category, videos) {
    const key = getCustomCategorySearchKey(category);
    if (!key) {
        return;
    }
    customCategorySearchCache.set(key, Array.isArray(videos) ? videos : []);
}

function setWatchVideoViewsText(viewsText = '', { hide = false } = {}) {
    const viewsEl = document.getElementById('videoViews');
    if (!viewsEl) {
        return;
    }
    viewsEl.textContent = hide ? '' : viewsText || '';
    viewsEl.classList.toggle('hidden', hide);
}

function mergeUniqueVideos(primary, secondary) {
    const seen = new Set();
    const merged = [];
    [...primary, ...secondary].forEach(video => {
        if (!video?.id) {
            return;
        }
        const key = String(video.id);
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        merged.push(video);
    });
    return merged;
}

function getVideoChannelNameForMatch(video) {
    const channelMeta = getChannelSearchMeta(video.channelId);
    return channelMeta.name || video.channelTitle || video.snippet?.channelTitle || '';
}

function isQuotedChannelQuery(videos, query) {
    const normalizedQuery = String(query || '').trim();
    const hasQuotes = normalizedQuery.startsWith('"') && normalizedQuery.endsWith('"');
    if (!hasQuotes) {
        return null;
    }
    const exactPhrase = normalizedQuery.slice(1, -1).trim().toLowerCase();
    if (!exactPhrase) {
        return null;
    }
    const hasChannelMatch = videos.some(
        video => getVideoChannelNameForMatch(video).trim().toLowerCase() === exactPhrase
    );
    return hasChannelMatch ? exactPhrase : null;
}

function matchesCustomCategory(video, categoryName) {
    // Comprovar si el vídeo pertany a un programa amb aquesta categoria
    if (videoBelongsToProgram(video, categoryName)) return true;

    const channelCustomCategories = getChannelCustomCategories(video.channelId);
    const hasChannelCategory = channelCustomCategories.some(cat => cat.toLowerCase() === categoryName.toLowerCase());

    if (hasChannelCategory) return true;

    // Si té espais, forcem el mode exacte per evitar parcials
    const forceExact = categoryName.includes(' ');

    const title = video.title || video.snippet?.title || '';
    const description = video.description || video.snippet?.description || '';
    const channelMeta = getChannelSearchMeta(video.channelId);
    const channelName = getVideoChannelNameForMatch(video);
    const channelDescription = channelMeta.description || '';
    const tagsValue = video.tags ?? video.snippet?.tags;
    const tags = Array.isArray(tagsValue) ? tagsValue : tagsValue ? [String(tagsValue)] : [];

    if (
        isMatch(title, categoryName, forceExact) ||
        isMatch(description, categoryName, forceExact) ||
        isMatch(channelName, categoryName, forceExact) ||
        isMatch(channelDescription, categoryName, forceExact)
    ) {
        return true;
    }

    if (tags.some(tag => isMatch(tag, categoryName, forceExact))) return true;

    // Comprovar etiquetes addicionals de la categoria
    const keywords = getCategoryKeywords(categoryName);
    for (const kw of keywords) {
        const kwExact = kw.includes(' ');
        if (
            isMatch(title, kw, kwExact) ||
            isMatch(description, kw, kwExact) ||
            isMatch(channelName, kw, kwExact) ||
            isMatch(channelDescription, kw, kwExact) ||
            tags.some(tag => isMatch(tag, kw, kwExact))
        ) {
            return true;
        }
    }

    return false;
}

async function refreshCustomCategorySearch(category) {
    const key = getCustomCategorySearchKey(category);
    if (!key) {
        return null;
    }
    if (customCategorySearchInFlight.has(key)) {
        return customCategorySearchInFlight.get(key);
    }

    // Stale-while-revalidate: mostra caché localStorage immediatament
    const cachedVideos = loadCategorySearchCache(key);
    if (cachedVideos?.length && !getCustomCategorySearchResults(category).length) {
        setCustomCategorySearchResults(key, cachedVideos);
    }

    const task = (async () => {
        const dualResults = await performDualSearch(key);
        const archiveVideos = Array.isArray(dualResults?.archiveVideos) ? dualResults.archiveVideos : [];

        let videos = mergeUniqueVideos(dualResults?.videos || [], archiveVideos);
        if (useYouTubeAPI && typeof YouTubeAPI?.searchVideos === 'function') {
            try {
                const result = await YouTubeAPI.searchVideos(key, CONFIG.layout.videosPerPage);
                if (!result?.error && Array.isArray(result.items)) {
                    videos = mergeUniqueVideos(result.items, archiveVideos);
                }
            } catch (error) {
                console.warn("No s'ha pogut refrescar la categoria amb API, es manté la cerca local/arxiu", error);
            }
        }

        // Cercar vídeos addicionals per cada etiqueta de la categoria
        const categoryKeywords = getCategoryKeywords(category);
        for (const kw of categoryKeywords) {
            try {
                const kwDual = await performDualSearch(kw);
                const kwArchive = Array.isArray(kwDual?.archiveVideos) ? kwDual.archiveVideos : [];
                videos = mergeUniqueVideos(videos, mergeUniqueVideos(kwDual?.videos || [], kwArchive));
                if (useYouTubeAPI && typeof YouTubeAPI?.searchVideos === 'function') {
                    const kwResult = await YouTubeAPI.searchVideos(kw, CONFIG.layout.videosPerPage);
                    if (!kwResult?.error && Array.isArray(kwResult.items)) {
                        videos = mergeUniqueVideos(videos, kwResult.items);
                    }
                }
            } catch (error) {
                console.warn(`No s'ha pogut cercar per l'etiqueta "${kw}"`, error);
            }
        }

        // Recuperar vídeos explícits pels canals i programes d'aquesta categoria
        if (useYouTubeAPI && typeof YouTubeAPI?.getChannelVideosWithHistory === 'function') {
            const rawCategoryName = String(category || '').trim();
            const normalizedCat = normalizeCustomTag(rawCategoryName).toLowerCase();

            // 1. Obtenir els IDs dels canals explícits d'aquesta categoria
            const channelsAssigned = getChannelsForCategory(rawCategoryName);

            // 2. Obtenir els IDs dels canals on hi hagi programes associats a aquesta categoria
            const programs = getPrograms();
            const programChannelIds = programs
                .filter(p => (p.customCategories || []).some(c => c.toLowerCase() === normalizedCat))
                .map(p => p.channelId);

            const allChannelIds = [...new Set([...channelsAssigned, ...programChannelIds])];

            for (const chId of allChannelIds) {
                try {
                    const chVideos = await YouTubeAPI.getChannelVideosWithHistory(chId);
                    if (Array.isArray(chVideos)) {
                        chVideos.forEach(v => {
                            if (!cachedAPIVideos.find(cv => String(cv.id) === String(v.id))) {
                                cachedAPIVideos.push(v);
                            }
                        });
                        videos = mergeUniqueVideos(videos, chVideos);
                    }
                } catch (e) {
                    console.warn(`No s'ha pogut carregar vídeos del canal ${chId}`, e);
                }
            }
        }

        // Filtratge estricte final perquè només quedin els que pertanyen al programa o canal
        videos = videos.filter(v => matchesCustomCategory(v, category));

        setCustomCategorySearchResults(key, videos);
        saveCategorySearchCache(key, videos);
        return videos;
    })();

    customCategorySearchInFlight.set(key, task);
    try {
        return await task;
    } finally {
        customCategorySearchInFlight.delete(key);
    }
}

function filterVideosByCategory(videos, feed) {
    const hiddenIds = new Set(getHiddenChannelIds().map(id => String(id)));
    const removeHiddenChannelVideos = list =>
        (Array.isArray(list) ? list : []).filter(video => !hiddenIds.has(String(video?.channelId || '')));
    const visibleVideos = removeHiddenChannelVideos(videos);

    if (!selectedCategory || selectedCategory === 'Tot' || selectedCategory === 'Novetats') {
        // Només cançons (song / live_song): fora entrevistes, concerts complets, teasers, etc.
        const music = window.SegueixMusicCategories;
        return music?.isCategoryEligibleVideo
            ? visibleVideos.filter(video => video.isShort || music.isCategoryEligibleVideo(video))
            : visibleVideos;
    }
    if (selectedCategory === 'Descobreix') {
        const followedIds = new Set(getFollowedChannelIds().map(id => String(id)));
        return visibleVideos.filter(video => {
            const channelId = String(video?.channelId || '');
            if (!channelId || followedIds.has(channelId)) return false;
            const music = window.SegueixMusicCategories;
            return !music?.isReady?.() || music.isMusicChannel(channelId);
        });
    }
    if (selectedCategory === 'Radar') {
        const activeTags = getCustomTags();
        if (activeTags.length === 0) return [];
        const radarChannels = getRadarChannelIds();
        return visibleVideos.filter(video => {
            // Inclou si el canal està assignat explícitament a una categoria activa
            if (radarChannels.has(String(video.channelId))) return true;
            // Inclou si el vídeo fa match per contingut amb qualsevol categoria activa
            return activeTags.some(tag => matchesCustomCategory(video, tag));
        });
    }
    if (isCustomCategory(selectedCategory)) {
        const rawCategoryName = String(selectedCategory || '').trim();
        const categoryName = normalizeCustomTag(rawCategoryName);
        if (!categoryName) {
            return visibleVideos;
        }

        const quotedChannelName = isQuotedChannelQuery(visibleVideos, rawCategoryName);
        if (quotedChannelName) {
            return visibleVideos.filter(
                video => getVideoChannelNameForMatch(video).trim().toLowerCase() === quotedChannelName
            );
        }

        const matched = visibleVideos.filter(video => matchesCustomCategory(video, rawCategoryName));
        const searchResults = getCustomCategorySearchResults(categoryName);
        const archiveMatches = searchArchiveVideos(rawCategoryName);
        rememberArchiveSearchVideos(archiveMatches);
        return removeHiddenChannelVideos(mergeUniqueVideos(searchResults, mergeUniqueVideos(archiveMatches, matched)));
    }
    if (selectedCategory === 'Seguint') {
        const followedIds = new Set(getFollowedChannelIds().map(id => String(id)));
        if (followedIds.size === 0) {
            return [];
        }
        return visibleVideos.filter(video => followedIds.has(String(video.channelId)));
    }
    if (!feed || !Array.isArray(feed.channels)) return visibleVideos;

    const map = new Map();
    feed.channels.forEach(channel => {
        const cats = Array.isArray(channel.categories) ? channel.categories : [];
        map.set(
            channel.id,
            cats.map(cat => String(cat).toLowerCase())
        );
    });

    const wanted = selectedCategory.toLowerCase();
    return visibleVideos.filter(video => {
        const music = window.SegueixMusicCategories;
        if (music?.isCategoryEligibleVideo && !music.isCategoryEligibleVideo(video)) return false;
        const cats = map.get(video.channelId) || [];
        return cats.includes(wanted);
    });
}

// Vídeos seguits d'un mateix canal quan n'ha publicat uns quants el mateix dia.
// A les categories personalitzades (p. ex. "Canal Jove") els vídeos d'una mateixa
// tongada surten agrupats de 2-3 en 2-3 i la resta queden intercalats.
const SAME_DAY_RUN_LIMIT = 3;

// Clau de dia local d'un vídeo ('' si no té data vàlida).
function getPublishedDayKey(video) {
    const timestamp = new Date(video?.publishedAt || video?.uploadDate || 0).getTime();
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        return '';
    }
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// Quants vídeos del començament de la llista comparteixen dia amb dayKey.
function countLeadingSameDay(channelVideos, dayKey) {
    if (!dayKey || !Array.isArray(channelVideos)) {
        return 0;
    }
    let count = 0;
    for (const video of channelVideos) {
        if (getPublishedDayKey(video) !== dayKey) break;
        count += 1;
    }
    return count;
}

// Quants vídeos seguits pot aportar ara mateix un canal: només s'agrupen les
// tongades de debò (prou vídeos del mateix dia), la resta van d'un en un.
function getSameDayRunLength(channelVideos, maxSameDayRun) {
    if (maxSameDayRun <= 1 || !Array.isArray(channelVideos) || channelVideos.length === 0) {
        return 1;
    }
    const sameDay = countLeadingSameDay(channelVideos, getPublishedDayKey(channelVideos[0]));
    return sameDay >= maxSameDayRun ? maxSameDayRun : 1;
}

function sortVideosByRoundRobin(videos, options = {}) {
    if (!Array.isArray(videos) || videos.length === 0) return [];

    // maxSameDayRun = 1 manté l'alternança estricta de canals (comportament clàssic).
    const maxSameDayRun = Math.max(1, Number(options.maxSameDayRun) || 1);

    const videosByChannel = {};
    videos.forEach(video => {
        const channelId = String(video?.channelId || '');
        if (!channelId) {
            return;
        }
        if (!videosByChannel[channelId]) {
            videosByChannel[channelId] = [];
        }
        videosByChannel[channelId].push(video);
    });

    const channelIds = Object.keys(videosByChannel);
    if (channelIds.length === 0) {
        return [...videos];
    }

    const toTimestamp = video => new Date(video?.publishedAt || video?.uploadDate || 0).getTime() || 0;

    channelIds.forEach(channelId => {
        videosByChannel[channelId].sort((a, b) => toTimestamp(b) - toTimestamp(a));
    });

    const sortedVideos = [];

    // Fase 1: una primera volta amb tots els canals per maximitzar la diversitat inicial.
    const firstPass = channelIds
        .filter(channelId => videosByChannel[channelId].length > 0)
        .sort((a, b) => toTimestamp(videosByChannel[b][0]) - toTimestamp(videosByChannel[a][0]));

    // Vídeos seguits del canal que s'acaba d'emetre (1 = cap agrupació).
    let lastRunLength = 0;

    firstPass.forEach(channelId => {
        const runLength = getSameDayRunLength(videosByChannel[channelId], maxSameDayRun);
        let emitted = 0;
        for (let i = 0; i < runLength; i++) {
            const nextVideo = videosByChannel[channelId].shift();
            if (!nextVideo) break;
            sortedVideos.push(nextVideo);
            emitted += 1;
        }
        if (emitted > 0) {
            lastRunLength = emitted;
        }
    });

    // Fase 2: prioritzar recència evitant dos canals consecutius quan hi ha alternatives.
    const lastVideo = sortedVideos[sortedVideos.length - 1];
    let lastChannelId = lastVideo?.channelId ? String(lastVideo.channelId) : null;
    let lastDayKey = lastVideo ? getPublishedDayKey(lastVideo) : '';
    // La tongada de la fase 1 ja s'ha emès sencera: el proper vídeo canvia de canal.
    let runQuota = lastRunLength;
    let sameChannelRun = lastRunLength;

    while (channelIds.some(channelId => videosByChannel[channelId].length > 0)) {
        const available = channelIds.filter(channelId => videosByChannel[channelId].length > 0);

        // Continuar amb el mateix canal si encara té vídeos del mateix dia i no s'ha
        // exhaurit la tongada. Si no, tornar a l'alternança per recència.
        const continuesRun =
            sameChannelRun > 0 &&
            sameChannelRun < runQuota &&
            lastChannelId &&
            videosByChannel[lastChannelId]?.length > 0 &&
            getPublishedDayKey(videosByChannel[lastChannelId][0]) === lastDayKey;

        let bestChannel;
        if (continuesRun) {
            bestChannel = lastChannelId;
        } else {
            const nonRepeated = available.filter(channelId => channelId !== lastChannelId);
            const candidates = nonRepeated.length > 0 ? nonRepeated : available;

            bestChannel = candidates.sort(
                (a, b) => toTimestamp(videosByChannel[b][0]) - toTimestamp(videosByChannel[a][0])
            )[0];
        }

        if (!bestChannel) {
            break;
        }

        if (!continuesRun) {
            runQuota = getSameDayRunLength(videosByChannel[bestChannel], maxSameDayRun);
        }

        const nextVideo = videosByChannel[bestChannel].shift();
        if (!nextVideo) {
            break;
        }

        sortedVideos.push(nextVideo);
        sameChannelRun = continuesRun ? sameChannelRun + 1 : 1;
        lastChannelId = String(bestChannel);
        lastDayKey = getPublishedDayKey(nextVideo);
    }

    return sortedVideos;
}

function applyRoundRobinByPopularity(videos) {
    if (!Array.isArray(videos) || videos.length === 0) return [];

    const byChannel = {};
    videos.forEach(video => {
        const channelId = video.channelId;
        if (!byChannel[channelId]) {
            byChannel[channelId] = [];
        }
        byChannel[channelId].push(video);
    });

    Object.values(byChannel).forEach(channelVideos => {
        channelVideos.sort((a, b) => {
            const viewsA = a.viewCount || a.views || 0;
            const viewsB = b.viewCount || b.views || 0;
            return viewsB - viewsA;
        });
    });

    const channelIds = Object.keys(byChannel).sort((a, b) => {
        const topA = byChannel[a][0]?.viewCount || byChannel[a][0]?.views || 0;
        const topB = byChannel[b][0]?.viewCount || byChannel[b][0]?.views || 0;
        return topB - topA;
    });

    const result = [];
    let remaining = Object.values(byChannel).reduce((sum, list) => sum + list.length, 0);
    let lastChannelId = null;
    let channelIndex = 0;

    while (remaining > 0) {
        let picked = false;
        for (let attempts = 0; attempts < channelIds.length; attempts++) {
            const id = channelIds[channelIndex];
            channelIndex = (channelIndex + 1) % channelIds.length;
            if (!byChannel[id]?.length) {
                continue;
            }
            if (id === lastChannelId) {
                if (byChannel[id].length === remaining) {
                    // Only this channel has videos left, allow consecutive placement.
                } else {
                    continue;
                }
            }
            result.push(byChannel[id].shift());
            remaining -= 1;
            lastChannelId = id;
            picked = true;
            break;
        }
        if (!picked) {
            const fallbackId = channelIds.find(id => byChannel[id]?.length);
            if (!fallbackId) {
                break;
            }
            result.push(byChannel[fallbackId].shift());
            remaining -= 1;
            lastChannelId = fallbackId;
            channelIndex = (channelIds.indexOf(fallbackId) + 1) % channelIds.length;
        }
    }

    return result;
}

function hybridCategorySort(videos) {
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;

    const hot = [];
    const rest = [];

    videos.forEach(video => {
        const age = now - new Date(video.publishedAt || video.uploadDate || 0).getTime();
        const views = video.viewCount || video.views || 0;

        if (age < oneWeek && views > 1000) {
            hot.push(video);
        } else {
            rest.push(video);
        }
    });

    const hotRoundRobin = applyRoundRobinByPopularity(hot);
    const restRoundRobin = sortVideosByRoundRobin(rest);
    const maxHot = Math.min(hotRoundRobin.length, 8);

    if (
        hotRoundRobin.length > 0 &&
        restRoundRobin.length > 0 &&
        hotRoundRobin[maxHot - 1]?.channelId === restRoundRobin[0]?.channelId
    ) {
        const nextIndex = restRoundRobin.findIndex(video => video.channelId !== hotRoundRobin[maxHot - 1]?.channelId);
        if (nextIndex > 0) {
            const rotated = restRoundRobin.splice(0, nextIndex);
            restRoundRobin.push(...rotated);
        }
    }

    return [...hotRoundRobin.slice(0, maxHot), ...restRoundRobin];
}

function applyRoundRobinByPopularity(videos) {
    if (!Array.isArray(videos) || videos.length === 0) return [];

    const byChannel = {};
    videos.forEach(video => {
        const channelId = video.channelId;
        if (!byChannel[channelId]) {
            byChannel[channelId] = [];
        }
        byChannel[channelId].push(video);
    });

    Object.values(byChannel).forEach(channelVideos => {
        channelVideos.sort((a, b) => {
            const viewsA = a.viewCount || a.views || 0;
            const viewsB = b.viewCount || b.views || 0;
            return viewsB - viewsA;
        });
    });

    const channelIds = Object.keys(byChannel).sort((a, b) => {
        const topA = byChannel[a][0]?.viewCount || byChannel[a][0]?.views || 0;
        const topB = byChannel[b][0]?.viewCount || byChannel[b][0]?.views || 0;
        return topB - topA;
    });

    const result = [];
    const maxVideos = Math.max(...Object.values(byChannel).map(v => v.length));

    for (let i = 0; i < maxVideos; i++) {
        channelIds.forEach(id => {
            if (byChannel[id][i]) {
                result.push(byChannel[id][i]);
            }
        });
    }

    return result;
}

function hybridCategorySort(videos) {
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;

    const hot = [];
    const rest = [];

    videos.forEach(video => {
        const age = now - new Date(video.publishedAt || video.uploadDate || 0).getTime();
        const views = video.viewCount || video.views || 0;

        if (age < oneWeek && views > 1000) {
            hot.push(video);
        } else {
            rest.push(video);
        }
    });

    const hotRoundRobin = applyRoundRobinByPopularity(hot);
    const restRoundRobin = sortVideosByRoundRobin(rest);
    const maxHot = Math.min(hotRoundRobin.length, 8);

    if (
        hotRoundRobin.length > 0 &&
        restRoundRobin.length > 0 &&
        hotRoundRobin[maxHot - 1]?.channelId === restRoundRobin[0]?.channelId
    ) {
        const nextIndex = restRoundRobin.findIndex(video => video.channelId !== hotRoundRobin[maxHot - 1]?.channelId);
        if (nextIndex > 0) {
            const rotated = restRoundRobin.splice(0, nextIndex);
            restRoundRobin.push(...rotated);
        }
    }

    return [...hotRoundRobin.slice(0, maxHot), ...restRoundRobin];
}

function getEffectiveCategory(channelId) {
    if (!channelId) return null;
    const excludedCategories = ['mitjans', 'digitals', 'entitats'];

    // 1. Mirar categories del feed
    const feedData = currentFeedData || getFeedDataForFilter();
    if (feedData?.channels) {
        const channel = feedData.channels.find(c => String(c.id) === String(channelId));
        if (channel && Array.isArray(channel.categories)) {
            const valid = channel.categories.find(cat => !excludedCategories.includes(String(cat).toLowerCase()));
            if (valid) return String(valid);
        }
    }

    // 2. Mirar categories del cache
    if (cachedChannels[channelId]?.categories) {
        const valid = cachedChannels[channelId].categories.find(
            cat => !excludedCategories.includes(String(cat).toLowerCase())
        );
        if (valid) return String(valid);
    }

    // 3. Mirar custom categories
    const customCats = getChannelCustomCategories(channelId);
    if (customCats.length > 0) {
        const valid = customCats.find(cat => !excludedCategories.includes(String(cat).toLowerCase()));
        if (valid) return String(valid);
    }

    return null;
}

function getVideoCategoryCandidates(video) {
    if (!video) return [];

    const all = [];
    if (Array.isArray(video.categories)) {
        all.push(...video.categories);
    }

    const channelId = String(video.channelId || video.snippet?.channelId || '');
    if (channelId) {
        const feedData = currentFeedData || getFeedDataForFilter();
        const feedChannel = Array.isArray(feedData?.channels)
            ? feedData.channels.find(c => String(c.id) === channelId)
            : null;
        if (Array.isArray(feedChannel?.categories)) {
            all.push(...feedChannel.categories);
        }
        if (Array.isArray(cachedChannels[channelId]?.categories)) {
            all.push(...cachedChannels[channelId].categories);
        }
        all.push(...getChannelCustomCategories(channelId));
    }

    return [...new Set(all.map(cat => String(cat || '').trim()).filter(Boolean))];
}

async function resolveInitialVideoForUrl(videoId) {
    const normalizedId = String(videoId || '').trim();
    if (!normalizedId) return null;

    const localCandidates = [
        ...(Array.isArray(currentFeedVideos) ? currentFeedVideos : []),
        ...(Array.isArray(cachedAPIVideos) ? cachedAPIVideos : []),
        ...(Array.isArray(YouTubeAPI?.feedVideos) ? YouTubeAPI.feedVideos : []),
    ];
    const localVideo = localCandidates.find(video => String(video?.id || '') === normalizedId);
    if (localVideo) {
        return localVideo;
    }

    if (useYouTubeAPI && typeof YouTubeAPI?.getVideoDetails === 'function') {
        const result = await YouTubeAPI.getVideoDetails(normalizedId);
        if (result?.video) {
            return result.video;
        }
    }

    return null;
}

function buildCategoryShortQueueForVideo(videoId, categoryName) {
    const normalizedId = String(videoId || '').trim();
    if (!normalizedId || !categoryName) return [];

    const wanted = String(categoryName).toLowerCase();
    const source = mergeUniqueVideos(
        Array.isArray(currentFeedVideos) ? currentFeedVideos : [],
        mergeUniqueVideos(
            Array.isArray(cachedAPIVideos) ? cachedAPIVideos : [],
            Array.isArray(YouTubeAPI?.feedVideos) ? YouTubeAPI.feedVideos : []
        )
    );

    const matchesCategory = (video) => {
        const cats = getVideoCategoryCandidates(video).map(cat => cat.toLowerCase());
        if (cats.includes(wanted)) return true;
        if (isCustomCategory(categoryName) && matchesCustomCategory(video, categoryName)) return true;
        return false;
    };

    const queue = source
        .filter(video => video?.isShort && String(video.id || '') !== normalizedId && matchesCategory(video))
        .sort(
            (a, b) =>
                new Date(b.publishedAt || b.snippet?.publishedAt || 0) -
                new Date(a.publishedAt || a.snippet?.publishedAt || 0)
        );

    const current = source.find(video => String(video?.id || '') === normalizedId);
    if (current?.isShort) {
        queue.unshift(current);
    }

    return queue.slice(0, 50);
}

function scoreRelatedVideos(videos, currentVideo) {
    if (!Array.isArray(videos) || videos.length === 0) return [];

    // Dades de personalització
    const followedIds = new Set(getFollowedChannelIds().map(id => String(id)));
    const likedVideos = getLikedVideos();
    const likedChannelCounts = {};
    likedVideos.forEach(v => {
        const chId = String(v.channelId || '');
        if (chId) likedChannelCounts[chId] = (likedChannelCounts[chId] || 0) + 1;
    });

    // Scoring per cada vídeo
    const scored = videos.map(video => {
        let score = 0;
        const chId = String(video.channelId || '');

        // +2 si el canal és seguit
        if (followedIds.has(chId)) score += 2;

        // +1 per cada like a vídeos d'aquest canal (màx +3)
        const likesForChannel = likedChannelCounts[chId] || 0;
        score += Math.min(likesForChannel, 3);

        return { video, score };
    });

    // Separar en dos grups: personalitzats (score > 0) i descoberta (score === 0)
    const personalized = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score);
    const discovery = scored.filter(s => s.score === 0);

    // Agafar vídeos personalitzats (màx 40% del total)
    const maxPersonalized = Math.floor(videos.length * 0.4);
    const topPersonalized = personalized.slice(0, maxPersonalized).map(s => s.video);
    const restPersonalized = personalized.slice(maxPersonalized).map(s => s.video);

    // La resta va en round-robin per diversitat
    const discoveryVideos = [...restPersonalized, ...discovery.map(s => s.video)];
    const roundRobinDiscovery = sortVideosByRoundRobin(discoveryVideos);

    // Intercalar: 2 personalitzats, 3 descoberta, repetir
    const result = [];
    let pIdx = 0,
        dIdx = 0;
    while (pIdx < topPersonalized.length || dIdx < roundRobinDiscovery.length) {
        for (let i = 0; i < 2 && pIdx < topPersonalized.length; i++) {
            result.push(topPersonalized[pIdx++]);
        }
        for (let i = 0; i < 3 && dIdx < roundRobinDiscovery.length; i++) {
            result.push(roundRobinDiscovery[dIdx++]);
        }
    }
    return result;
}

function getFeedDataForFilterLegacyImpl() {
    if (Array.isArray(YouTubeAPI?.feedChannels) && YouTubeAPI.feedChannels.length > 0) {
        return { channels: YouTubeAPI.feedChannels };
    }

    const cached = Object.values(cachedChannels || {});
    if (cached.length > 0) {
        return { channels: cached };
    }

    return null;
}

function setFeedContextLegacyImpl(videos, feedData, renderer) {
    currentFeedVideos = Array.isArray(videos) ? videos : [];
    currentFeedData = feedData;
    currentFeedRenderer = renderer;
    renderFeed();
}

function getFeedDataForFilter() {
    return SegueixApp.features.feed?.getFeedDataForFilter?.();
}

function setFeedContext(videos, feedData, renderer) {
    return SegueixApp.features.feed?.setFeedContext?.(videos, feedData, renderer);
}

const MIN_RECOMMENDED_SECONDS = 240;

function getVideoDurationSeconds(video) {
    if (!video) return null;

    const directSeconds = Number(video.durationSeconds);
    if (Number.isFinite(directSeconds)) {
        return directSeconds;
    }

    const durationValue = video.contentDetails?.duration || video.duration;
    if (!durationValue || typeof durationValue !== 'string') {
        return null;
    }

    if (durationValue.startsWith('PT')) {
        const match = durationValue.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
        if (!match) return null;
        const hours = parseInt(match[1] || '0', 10);
        const minutes = parseInt(match[2] || '0', 10);
        const seconds = parseInt(match[3] || '0', 10);
        return hours * 3600 + minutes * 60 + seconds;
    }

    const timeParts = durationValue.split(':').map(part => Number(part));
    if (timeParts.some(part => Number.isNaN(part))) {
        return null;
    }
    if (timeParts.length === 3) {
        const [hours, minutes, seconds] = timeParts;
        return hours * 3600 + minutes * 60 + seconds;
    }
    if (timeParts.length === 2) {
        const [minutes, seconds] = timeParts;
        return minutes * 60 + seconds;
    }

    return null;
}

function renderFeedLegacyImpl() {
    if (!currentFeedRenderer) return;
    if (isCustomCategory(selectedCategory)) {
        renderCategoryActions(getCategoryPageTitle(selectedCategory));
    }

    const isRecommendedPage = pageTitle?.textContent === 'Recomanat per a tu';
    let videosToFilter = currentFeedVideos;

    // Radar i categories personalitzades: cercar en TOTS els vídeos locals (Feed + Cached)
    if (selectedCategory === 'Radar' || isCustomCategory(selectedCategory)) {
        const uniqueVideosMap = new Map();

        // Add current feed videos
        if (Array.isArray(currentFeedVideos)) {
            currentFeedVideos.forEach(video => {
                if (video?.id) {
                    uniqueVideosMap.set(String(video.id), video);
                }
            });
        }

        // Add cached API videos (from previous searches)
        if (Array.isArray(cachedAPIVideos)) {
            cachedAPIVideos.forEach(video => {
                if (video?.id) {
                    uniqueVideosMap.set(String(video.id), video);
                }
            });
        }

        videosToFilter = Array.from(uniqueVideosMap.values());
    }

    let filtered = filterVideosByCategory(videosToFilter, currentFeedData);

    if (selectedCategory === 'Novetats' || selectedCategory === 'Tot' || selectedCategory === 'Radar') {
        // Pre-indexar canals del feed per O(1) lookup (en lloc de .find() per cada vídeo)
        const feedChannelMap = new Map();
        if (currentFeedData?.channels) {
            (Array.isArray(currentFeedData.channels) ? currentFeedData.channels : []).forEach(c => {
                if (c?.id) feedChannelMap.set(String(c.id), c);
            });
        }
        const hiddenCats = new Set(['mitjans', 'digitals', 'entitats']);

        // Al Radar, preparar termes de cerca per permetre vídeos d'entitats/digitals/mitjans
        // que facin match per títol amb categories personalitzades o etiquetes
        let radarSearchTerms = null;
        if (selectedCategory === 'Radar') {
            radarSearchTerms = [];
            const activeTags = getCustomTags();
            for (const tag of activeTags) {
                const normalized = normalizeCustomTag(tag);
                if (!normalized) continue;
                const exact = isExactCategory(normalized);
                radarSearchTerms.push({ term: normalized, forceExact: exact });
                const keywords = getCategoryKeywords(normalized);
                for (const kw of keywords) {
                    const kwTrimmed = kw.trim();
                    if (kwTrimmed) {
                        radarSearchTerms.push({ term: kwTrimmed, forceExact: kwTrimmed.includes(' ') });
                    }
                }
            }
        }

        filtered = filtered.filter(video => {
            const channelCats = getChannelCustomCategories(video.channelId);
            let feedCats = [];
            const feedChannel = feedChannelMap.get(String(video.channelId));
            if (feedChannel && Array.isArray(feedChannel.categories)) {
                feedCats = feedChannel.categories;
            } else if (cachedChannels[video.channelId]?.categories) {
                feedCats = cachedChannels[video.channelId].categories;
            }
            const isHidden =
                channelCats.some(cat => hiddenCats.has(String(cat).toLowerCase())) ||
                feedCats.some(cat => hiddenCats.has(String(cat).toLowerCase()));
            if (!isHidden) return true;

            // Al Radar, permetre vídeos d'entitats/digitals/mitjans si el títol
            // coincideix amb el nom o etiquetes d'alguna categoria personalitzada
            if (radarSearchTerms && radarSearchTerms.length > 0) {
                const title = video.title || video.snippet?.title || '';
                return radarSearchTerms.some(({ term, forceExact }) => isMatch(title, term, forceExact));
            }
            return false;
        });
    }

    if (selectedCategory === 'Novetats') {
        const now = Date.now();
        const maxAgeMs = NOVETATS_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
        filtered = filtered.filter(video => {
            const publishedAt = video?.publishedAt || video?.uploadDate || video?.snippet?.publishedAt;
            const publishedMs = new Date(publishedAt || '').getTime();
            if (!Number.isFinite(publishedMs) || publishedMs <= 0) {
                return false;
            }
            const ageMs = now - publishedMs;
            return ageMs >= 0 && ageMs <= maxAgeMs;
        });
    }

    // Filtrar vídeos ja vistos dels feeds
    filtered = filterOutWatchedVideos(filtered);

    if (isCustomCategory(selectedCategory)) {
        // A la llista principal d'una categoria personalitzada mostrem primer els vídeos actuals
        // (no arxiu/històric), i deixem els antics per a seccions inferiors.
        filtered = filtered.filter(video => resolveHistorySource(video) !== 'archive');
    }

    if (selectedCategory === 'Novetats' || selectedCategory === 'Radar' || isCustomCategory(selectedCategory)) {
        // A les categories personalitzades (p. ex. "Canal Jove") una tongada de vídeos
        // del mateix canal i el mateix dia surt agrupada de 2-3 en 2-3 en comptes
        // d'anar d'un en un; la resta continua intercalada amb els altres canals.
        filtered = sortVideosByRoundRobin(
            filtered,
            isCustomCategory(selectedCategory) ? { maxSameDayRun: SAME_DAY_RUN_LIMIT } : {}
        );
    } else if (HYBRID_CATEGORY_SORT.has(selectedCategory)) {
        filtered = hybridCategorySort(filtered);
    }

    if (isRecommendedPage) {
        filtered = filtered.filter(video => {
            const seconds = getVideoDurationSeconds(video);
            return seconds !== null && seconds >= MIN_RECOMMENDED_SECONDS;
        });

        // «Recomanat per a tu» deixa de ser només un filtre de durada:
        // combina afinitat, seguits, qualitat relativa i descoberta.
        try {
            const ranked = SegueixApp.features.smartFeed?.rank?.(filtered, {
                reason: 'home-recommended',
            });
            if (Array.isArray(ranked) && ranked.length === filtered.length) {
                filtered = ranked;
            }
        } catch (error) {
            console.warn('No s’ha pogut aplicar el feed intel·ligent:', error);
        }
    }

    if (selectedCategory !== 'Novetats' && selectedCategory !== 'Tot' && filtered.length === 0) {
        featuredVideoBySection.delete(getHeroSectionKey());
        updateHero(null);
        if (videosGrid) {
            if (selectedCategory === 'Radar') {
                videosGrid.innerHTML = `
                    <div class="empty-state empty-state-radar">
                        <p>Crea categories per veure aquí les novetats</p>
                        <button class="empty-state-plus" type="button" data-radar-add aria-label="Afegir una categoria">+</button>
                    </div>
                `;
                const addBtn = videosGrid.querySelector('[data-radar-add]');
                if (addBtn) {
                    addBtn.addEventListener('click', event => {
                        event.preventDefault();
                        openCustomCategoryModal();
                    });
                }
            } else if (isCustomCategoryTag(selectedCategory)) {
                videosGrid.innerHTML = `
                    <div class="empty-state empty-state-custom">
                        <button class="empty-state-action" type="button" data-follow-cta>
                            Afegeix aquesta categoria als teus YouTubers preferits
                        </button>
                        <button class="empty-state-plus" type="button" data-follow-cta aria-label="Afegir categoria a Segueix!">+</button>
                    </div>
                `;
                const followCtas = videosGrid.querySelectorAll('[data-follow-cta]');
                followCtas.forEach(followCta => {
                    followCta.addEventListener('click', event => {
                        event.preventDefault();
                        setActiveNavItem('segueix');
                        showFollow('all');
                    });
                });
            } else {
                videosGrid.innerHTML = `
                    <div class="empty-state">No hi ha vídeos per aquesta categoria.</div>
                `;
            }
        }
        return;
    }
    // Afegeix aquest bloc just abans de: lastRenderedFeedList = filtered;
    filtered = filtered.filter(video => {
        // Els shorts tenen la seva pròpia lògica, els mantenim
        if (video.isShort) return true;

        // Calculem els segons. Si és 0 (estrena/error) o null (privat/eliminat), el descartem
        const seconds = getVideoDurationSeconds(video);
        return seconds !== null && seconds > 0;
    });

    // Varietat: mai dues cançons seguides del mateix grup/artista.
    filtered = spreadVideosByArtist(filtered);

    lastRenderedFeedList = filtered;
    currentFeedRenderer(filtered);
}

// Secció de vídeos ja vistos (historial) a la part inferior en Desktop
function appendWatchedVideosSection(container, videos) {
    if (!container || !Array.isArray(videos) || videos.length === 0) return null;

    const wrapper = document.createElement('div');
    wrapper.className = 'category-history-wrapper category-watched-wrapper';
    wrapper.innerHTML = `
        <h2 class="category-history-title">Ja vistos</h2>
        <div class="videos-grid">${spreadVideosByArtist(videos).map(video => createVideoCardAPI(video)).join('')}</div>
    `;
    container.appendChild(wrapper);

    setupDelegatedVideoCardClicks(wrapper, 'api');
    bindChannelLinks(wrapper);
    refreshIcons(wrapper);
    setupVideoCardActionButtons(wrapper);
    return wrapper;
}

function renderCategoryHistorySection(categoryTag) {
    if (!videosGrid || !categoryTag) return;
    if (!Array.isArray(searchArchiveIndexCache) || searchArchiveIndexCache.length === 0) return;

    const feedVideoIds = new Set((lastRenderedFeedList || []).map(v => String(v.id)));
    const watchedIds = getHistoryVideoIdSet();
    const notInFeed = video => !feedVideoIds.has(String(video.id));

    let archiveCandidates = [];

    if (isCustomCategory(categoryTag)) {
        // Categories personalitzades: cercar per títol i resultats previs
        const rawTag = normalizeCustomTag(categoryTag);
        if (!rawTag) return;
        const forceExact = isExactCategory(rawTag);
        const isTitleMatch = video => {
            const title = video?.title || video?.snippet?.title || '';
            return isMatch(title, rawTag, forceExact);
        };

        const searchResults = getCustomCategorySearchResults(categoryTag);
        archiveCandidates = searchResults
            .filter(video => video && !video.isShort)
            .filter(video => resolveHistorySource(video) === 'archive')
            .filter(video => isTitleMatch(video));
    } else if (categoryTag === 'Seguint') {
        // Seguint: arxiu dels canals seguits
        const followedIds = new Set(getFollowedChannelIds().map(id => String(id)));
        if (followedIds.size === 0) return;
        archiveCandidates = searchArchiveIndexCache
            .filter(item => followedIds.has(String(item?.c || '')))
            .map(item => ({
                id: item?.i,
                title: item?.t || '',
                channelId: item?.c || '',
                channelTitle: getChannelNameById(item?.c),
                publishedAt: item?.d || '',
                thumbnail: buildArchiveThumbnail(item?.i),
                source: 'archive',
            }))
            .filter(video => video.id && !video.isShort);
    } else if (categoryTag === 'Radar') {
        // Radar: arxiu de canals assignats + vídeos que fan match per títol
        // amb el nom de les categories o les seves etiquetes
        const radarChannels = getRadarChannelIds();
        const activeTags = getCustomTags();

        // Construir llista de termes de cerca: noms de categories + etiquetes
        const searchTerms = [];
        for (const tag of activeTags) {
            const normalized = normalizeCustomTag(tag);
            if (!normalized) continue;
            const exact = isExactCategory(normalized);
            searchTerms.push({ term: normalized, forceExact: exact });
            const keywords = getCategoryKeywords(normalized);
            for (const kw of keywords) {
                const kwTrimmed = kw.trim();
                if (kwTrimmed) {
                    searchTerms.push({ term: kwTrimmed, forceExact: kwTrimmed.includes(' ') });
                }
            }
        }

        const matchesRadar = item => {
            // Match per canal assignat
            if (radarChannels.has(String(item?.c || ''))) return true;
            // Match per títol amb termes de categories i etiquetes
            const title = item?.t || '';
            return searchTerms.some(({ term, forceExact }) => isMatch(title, term, forceExact));
        };

        archiveCandidates = searchArchiveIndexCache
            .filter(matchesRadar)
            .map(item => ({
                id: item?.i,
                title: item?.t || '',
                channelId: item?.c || '',
                channelTitle: getChannelNameById(item?.c),
                publishedAt: item?.d || '',
                thumbnail: buildArchiveThumbnail(item?.i),
                source: 'archive',
            }))
            .filter(video => video.id);
    } else {
        // Categories estàndard (Música, Ciència, etc.): arxiu dels canals de la categoria
        const wanted = categoryTag.toLowerCase();
        const categoryChannelIds = new Set();
        if (currentFeedData?.channels) {
            (Array.isArray(currentFeedData.channels) ? currentFeedData.channels : []).forEach(c => {
                const cats = Array.isArray(c.categories) ? c.categories.map(cat => String(cat).toLowerCase()) : [];
                if (cats.includes(wanted)) {
                    categoryChannelIds.add(String(c.id));
                }
            });
        }
        if (categoryChannelIds.size === 0) return;
        archiveCandidates = searchArchiveIndexCache
            .filter(item => categoryChannelIds.has(String(item?.c || '')))
            .map(item => ({
                id: item?.i,
                title: item?.t || '',
                channelId: item?.c || '',
                channelTitle: getChannelNameById(item?.c),
                publishedAt: item?.d || '',
                thumbnail: buildArchiveThumbnail(item?.i),
                source: 'archive',
            }))
            .filter(video => video.id);
    }

    const historicByDate = archiveCandidates
        .filter(video => !watchedIds.has(String(video.id)))
        .filter(notInFeed)
        .sort((a, b) => {
            const dateA = new Date(a.publishedAt || a.uploadDate || 0).getTime();
            const dateB = new Date(b.publishedAt || b.uploadDate || 0).getTime();
            return dateB - dateA;
        });
    // Varietat: l'arxiu ordenat per data agrupa tongades del mateix artista; es reparteixen
    // (mantenint l'actualitat) i s'enllaça amb l'últim vídeo del feed que hi ha just a sobre.
    const lastFeedVideo = lastRenderedFeedList[lastRenderedFeedList.length - 1];
    const historicVideos = spreadVideosByArtist(historicByDate, {
        previousArtist: getVideoArtistKey(lastFeedVideo),
        window: 400,
    });

    if (historicVideos.length === 0) return;

    const SECTION_INITIAL = 12;
    const SECTION_LOAD_MORE = 12;

    // Delegació d'events per seccions d'arxiu (un sol listener per wrapper)
    const bindSectionDelegation = wrapper => {
        wrapper.addEventListener('click', event => {
            const playlistBtn = event.target.closest('.archive-playlist-action');
            if (playlistBtn) {
                event.stopPropagation();
                const payload = playlistBtn.dataset.playlistVideo;
                if (payload) openPlaylistModal(JSON.parse(decodeURIComponent(payload)));
                return;
            }
            if (event.target.closest('.channel-link')) return;
            const card = event.target.closest('.archive-video-card');
            if (card) openVideoFromUserGesture(card.dataset.videoId, 'api');
        });
        bindChannelLinks(wrapper);
        refreshIcons(wrapper);
    };

    // A Desktop, mostrar tots els vídeos directament sense botó "Mostra'n més"
    const showAll = isDesktopView();
    const initial = showAll ? historicVideos : historicVideos.slice(0, SECTION_INITIAL);
    let loaded = initial.length;

    const wrapper = document.createElement('div');
    wrapper.className = 'category-history-wrapper category-history-seamless';
    wrapper.innerHTML = `
        <div class="videos-grid archive-videos-grid">${initial.map(video => createArchiveVideoCard(video)).join('')}</div>
    `;
    videosGrid.appendChild(wrapper);

    const grid = wrapper.querySelector('.archive-videos-grid');
    bindSectionDelegation(wrapper);

    // Botó "Mostra'n més" només a mòbil
    if (!showAll && historicVideos.length > SECTION_INITIAL) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.type = 'button';
        loadMoreBtn.className = 'section-load-more-btn';
        loadMoreBtn.textContent = `Mostra'n més (${historicVideos.length - loaded})`;
        wrapper.appendChild(loadMoreBtn);

        loadMoreBtn.addEventListener('click', () => {
            const next = historicVideos.slice(loaded, loaded + SECTION_LOAD_MORE);
            if (next.length === 0) return;

            const fragment = document
                .createRange()
                .createContextualFragment(next.map(video => createArchiveVideoCard(video)).join(''));
            grid.appendChild(fragment);
            refreshIcons(grid);
            bindChannelLinks(grid);

            loaded += next.length;
            const remaining = historicVideos.length - loaded;
            if (remaining > 0) {
                loadMoreBtn.textContent = `Mostra'n més (${remaining})`;
            } else {
                loadMoreBtn.remove();
            }
        });
    }
}

// Carregar categories
function loadCategories() {
    if (!CONFIG.features.categories) return;

    const categoriesList = document.getElementById('categoriesList');
    categoriesList.innerHTML = CONFIG.categories
        .map(
            cat => `
        <a href="#" class="category-item" data-category="${cat.id}">
            <i data-lucide="${cat.icon}"></i>
            <span>${cat.name}</span>
        </a>
    `
        )
        .join('');

    // Event listeners per categories
    const categoryItems = document.querySelectorAll('.category-item');
    categoryItems.forEach(item => {
        item.addEventListener('click', async e => {
            e.preventDefault();
            // Treure classe active de tots els nav items i categories
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            document.querySelectorAll('.category-item').forEach(cat => cat.classList.remove('active'));
            item.classList.add('active');

            const categoryId = item.dataset.category;
            const basePath = window.location.pathname.replace(/\/index\.html$/, '/');
            history.pushState({}, '', basePath);
            showHome();
            if (useYouTubeAPI) {
                const category = CONFIG.categories.find(c => c.id === categoryId);
                selectedCategory = category ? category.name : 'Tot';
                localStorage.setItem(LAST_CATEGORY_STORAGE_KEY, selectedCategory);
                renderCategoryActions(category ? category.name : 'Categoria');
                renderFeed();
            } else {
                loadVideosByCategoryStatic(categoryId);
            }
        });
    });

    refreshIcons(categoriesList);
    setupChipsBarOrdering();
    setupVideoCardActionButtons();
}

function restoreChipsFromCache() {
    if (!chipsBar) return;
    const cached = localStorage.getItem(CHIPS_HTML_CACHE_KEY);
    if (!cached) return;
    try {
        const data = JSON.parse(cached);
        if (!data.html || !data.activeCategory) return;
        // Invalidar cache antic que no inclou el botó d'informació
        // o que no té la versió actual del text informatiu
        if (!data.html.includes('chip-info-wrap') || !data.html.includes('chips-info-v2')) {
            localStorage.removeItem(CHIPS_HTML_CACHE_KEY);
            return;
        }
        // Només restaurar si el chips-bar encara té el contingut HTML estàtic inicial
        // (no ha estat ja configurat per setupChipsBarOrdering)
        if (chipsBar.dataset.cacheRestored === 'true') return;
        chipsBar.innerHTML = data.html;
        // Actualitzar l'estat actiu segons la categoria seleccionada actual
        const active = selectedCategory || data.activeCategory;
        chipsBar.querySelectorAll('.chip').forEach(chip => {
            const isActive = chip.dataset.cat === active;
            chip.classList.toggle('is-active', isActive);
            chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        chipsBar.dataset.cacheRestored = 'true';
    } catch (e) {
        // Cache invàlid, ignorar
    }
}

function saveChipsToCache() {
    if (!chipsBar) return;
    const html = chipsBar.innerHTML;
    if (!html) return;
    try {
        localStorage.setItem(
            CHIPS_HTML_CACHE_KEY,
            JSON.stringify({
                html: html,
                activeCategory: selectedCategory,
                timestamp: Date.now(),
            })
        );
    } catch (e) {
        // Storage ple, ignorar
    }
}

function renderCategoriesLegacyImpl() {
    setupChipsBarOrdering();
}

function updateFeed() {
    renderFeed();
}

function setupChipsBarOrdering() {
    if (!chipsBar) {
        return;
    }

    const defaultChips = [
        ...getStandardChipLabels().map(label => ({
            label,
            value: label,
            isCustom: false,
        })),
        ...getCustomTags().map(tag => ({
            label: tag,
            value: tag,
            isCustom: true,
        })),
    ];

    if (defaultChips.length === 0) {
        return;
    }

    const storedOrder = getStoredChipOrder();
    const chipsByValue = new Map(defaultChips.map(chip => [chip.value, chip]));
    const orderedChips = [];

    if (storedOrder) {
        storedOrder.forEach(value => {
            const chip = chipsByValue.get(value);
            if (chip) {
                orderedChips.push(chip);
                chipsByValue.delete(value);
            }
        });
    }

    defaultChips.forEach(chip => {
        if (chipsByValue.has(chip.value)) {
            orderedChips.push(chip);
            chipsByValue.delete(chip.value);
        }
    });

    const activeValue = selectedCategory;
    chipsBar.innerHTML = '';
    const fixedChips = [];
    const sortableChips = orderedChips.filter(chip => !fixedChips.includes(chip.value));
    sortableChips.forEach(chip => {
        const button = document.createElement('button');
        button.type = 'button';

        // Determinem si és una cerca exacta (conté espais)
        const isExact = chip.isCustom && chip.value.includes(' ');

        button.className = chip.isCustom ? 'chip is-custom' : 'chip';
        if (isExact) button.classList.add('is-exact');

        button.dataset.cat = chip.value;
        button.textContent = chip.label;
        button.dataset.fixed = 'false';
        const isActive = chip.value === activeValue;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        if (chip.isCustom) {
            button.title = 'Arrossega amunt per eliminar (o toca 3 cops)';
            button.setAttribute('aria-label', `${chip.label}. Arrossega amunt per eliminar`);
            const deleteCategory = () => {
                deleteCustomCategoryGlobal(chip.value, { preserveChannelAssignments: true });
                selectedCategory = 'Novetats';
                localStorage.setItem(LAST_CATEGORY_STORAGE_KEY, selectedCategory);
                renderCategoryActions('Novetats');
                renderCategories();
                updateFeed();
            };
            addTripleTapDeleteGuard(button, deleteCategory);
            initDragToDelete(button, deleteCategory);

            // Botó × d'eliminació visible en hover (desktop) — alternativa pràctica
            // al drag-to-delete que entra en conflicte amb el drag de Sortable per
            // reordenar quan s'usa ratolí.
            const removeBtn = document.createElement('span');
            removeBtn.className = 'chip-delete-btn';
            removeBtn.setAttribute('role', 'button');
            removeBtn.setAttribute('aria-label', `Eliminar la categoria ${chip.label}`);
            removeBtn.title = 'Eliminar aquesta categoria';
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', ev => {
                ev.stopPropagation();
                ev.preventDefault();
                deleteCategory();
            });
            removeBtn.addEventListener('mousedown', ev => ev.stopPropagation());
            button.appendChild(removeBtn);
        }
        chipsBar.appendChild(button);
    });
    fixedChips.forEach(chipName => {
        const fixedChip = document.createElement('button');
        fixedChip.type = 'button';
        fixedChip.className = 'chip';
        fixedChip.dataset.cat = chipName;
        fixedChip.textContent = chipName;
        fixedChip.dataset.fixed = 'true';
        const isActive = chipName === activeValue;
        fixedChip.classList.toggle('is-active', isActive);
        fixedChip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        chipsBar.appendChild(fixedChip);
    });

    // Botó d'informació fix (no es pot moure) — explica com reordenar les categories
    const infoWrap = document.createElement('span');
    infoWrap.className = 'chip-info-wrap';
    infoWrap.dataset.fixed = 'true';
    infoWrap.dataset.version = 'chips-info-v2';
    infoWrap.innerHTML = `
        <button type="button" class="chip chip-info" data-fixed="true" data-action="chips-info" aria-label="Com funcionen les categories" aria-expanded="false">
            <span class="chip-info-icon" aria-hidden="true">i</span>
        </button>
        <div class="chip-info-popover" role="tooltip" hidden>
            <button type="button" class="chip-info-popover-close" data-action="chips-info-close" aria-label="Tancar">×</button>
            <p>Per <strong>reordenar</strong> les categories generals, deixa premut sobre la categoria i arrossega-la a la posició desitjada.</p>
            <p>Per <strong>eliminar-ne</strong> una: al mòbil, prem-la i mou-la cap amunt; a l'ordinador, passa-hi per sobre i clica la <strong>×</strong>.</p>
            <p>Les categories <strong>Entitats</strong>, <strong>Digitals</strong> i <strong>Mitjans</strong> són fixes i no es poden moure.</p>
        </div>
    `;
    chipsBar.appendChild(infoWrap);

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'chip chip-add';
    addButton.setAttribute('aria-label', 'Afegir una categoria personalitzada');
    addButton.innerHTML = '<span class="chip-add-plus" aria-hidden="true">+</span>';
    addButton.dataset.fixed = 'true';
    chipsBar.appendChild(addButton);

    saveChipOrder(getChipOrderFromDom());
    saveChipsToCache();

    bindMobileCounterScrollForChips();

    if (chipsBar.dataset.dragBound !== 'true' && typeof Sortable !== 'undefined') {
        chipsBar.dataset.dragBound = 'true';
        new Sortable(chipsBar, {
            animation: 150,
            delay: 400,
            delayOnTouchOnly: true,
            touchStartThreshold: 8,
            draggable: '.chip',
            filter: '.chip[data-fixed="true"], .chip-add, .chip-info-wrap',
            onStart: event => {
                if (window.innerWidth > 768) return;
                const original = event.originalEvent;
                const touch = original?.touches?.[0] || original?.changedTouches?.[0];
                const clientX = touch?.clientX ?? original?.clientX ?? event.item?.getBoundingClientRect?.().left ?? 0;
                chipsBar._mobileCounterDrag?.start(clientX);
            },
            onMove: event => {
                if (isFixedChip(event.related)) {
                    return false;
                }
                if (window.innerWidth <= 768) {
                    const original = event.originalEvent;
                    const touch = original?.touches?.[0] || original?.changedTouches?.[0];
                    const clientX = touch?.clientX ?? original?.clientX;
                    if (Number.isFinite(clientX)) {
                        chipsBar._mobileCounterDrag?.update(clientX);
                    }
                }
                return true;
            },
            onEnd: () => {
                chipsBar._mobileCounterDrag?.stop();
                saveChipOrder(getChipOrderFromDom());
                saveChipsToCache();
            },
            onUnchoose: () => {
                chipsBar._mobileCounterDrag?.stop();
            },
        });
    }
}

function bindMobileCounterScrollForChips() {
    if (!chipsBar) {
        return;
    }

    if (typeof chipsBar._mobileCounterScrollCleanup === 'function') {
        chipsBar._mobileCounterScrollCleanup();
    }

    let active = false;
    let lastX = 0;
    let targetScrollLeft = 0;
    let rafId = null;
    let direction = 0;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const getMaxScroll = () => Math.max(0, chipsBar.scrollWidth - chipsBar.clientWidth);

    const setDirection = nextDirection => {
        if (nextDirection === direction) return;
        direction = nextDirection;
        chipsBar.classList.toggle('chip-drag-direction-right', direction > 0);
        chipsBar.classList.toggle('chip-drag-direction-left', direction < 0);
    };

    const animate = () => {
        if (!active) {
            rafId = null;
            return;
        }

        const current = chipsBar.scrollLeft;
        const distance = targetScrollLeft - current;
        if (Math.abs(distance) < 0.5) {
            chipsBar.scrollLeft = targetScrollLeft;
            rafId = null;
            return;
        }

        chipsBar.scrollLeft = current + distance * 0.42;
        rafId = requestAnimationFrame(animate);
    };

    const ensureAnimation = () => {
        if (rafId === null) {
            rafId = requestAnimationFrame(animate);
        }
    };

    const startDrag = clientX => {
        if (window.innerWidth > 768) return;
        active = true;
        lastX = Number(clientX) || 0;
        targetScrollLeft = chipsBar.scrollLeft;
        direction = 0;
        chipsBar.classList.add('mobile-chip-dragging');
        chipsBar.classList.remove('chip-drag-direction-left', 'chip-drag-direction-right');
    };

    const updateDrag = clientX => {
        if (!active || !Number.isFinite(clientX)) return;

        const deltaX = clientX - lastX;
        if (Math.abs(deltaX) < 0.5) return;

        // El dit i l'etiqueta van en una direcció; les categories visibles
        // es desplacen en la contrària per obrir més espai de destinació.
        setDirection(deltaX > 0 ? 1 : -1);
        targetScrollLeft = clamp(
            targetScrollLeft + deltaX * 0.78,
            0,
            getMaxScroll()
        );
        lastX = clientX;
        ensureAnimation();
    };

    const stopDrag = () => {
        active = false;
        direction = 0;
        chipsBar.classList.remove(
            'mobile-chip-dragging',
            'chip-drag-direction-left',
            'chip-drag-direction-right'
        );
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    };

    const onTouchMove = event => {
        if (!active || !event.touches?.[0]) return;
        updateDrag(event.touches[0].clientX);
    };

    const onPointerMove = event => {
        if (!active || event.pointerType === 'touch') return;
        updateDrag(event.clientX);
    };

    // Capture ens permet seguir el dit encara que Sortable intercepte el moviment.
    document.addEventListener('touchmove', onTouchMove, { passive: true, capture: true });
    document.addEventListener('pointermove', onPointerMove, { passive: true, capture: true });
    document.addEventListener('touchend', stopDrag, { passive: true, capture: true });
    document.addEventListener('touchcancel', stopDrag, { passive: true, capture: true });
    document.addEventListener('pointerup', stopDrag, { passive: true, capture: true });
    document.addEventListener('pointercancel', stopDrag, { passive: true, capture: true });

    chipsBar._mobileCounterDrag = {
        start: startDrag,
        update: updateDrag,
        stop: stopDrag,
    };

    chipsBar._mobileCounterScrollCleanup = () => {
        stopDrag();
        document.removeEventListener('touchmove', onTouchMove, true);
        document.removeEventListener('pointermove', onPointerMove, true);
        document.removeEventListener('touchend', stopDrag, true);
        document.removeEventListener('touchcancel', stopDrag, true);
        document.removeEventListener('pointerup', stopDrag, true);
        document.removeEventListener('pointercancel', stopDrag, true);
        delete chipsBar._mobileCounterDrag;
    };
}

function getStoredChipOrder() {
    const stored = localStorage.getItem(CHIPS_ORDER_STORAGE_KEY);
    if (!stored) {
        return null;
    }
    try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : null;
    } catch (error) {
        console.warn('No es pot llegir catube_chip_order', error);
        return null;
    }
}

function saveChipOrder(order) {
    if (!Array.isArray(order)) {
        return;
    }
    localStorage.setItem(CHIPS_ORDER_STORAGE_KEY, JSON.stringify(order));
}

function getChipOrderFromDom() {
    if (!chipsBar) {
        return [];
    }
    return Array.from(chipsBar.querySelectorAll('.chip'))
        .filter(chip => !chip.classList.contains('chip-add') && !chip.classList.contains('chip-info'))
        .map(chip => chip.dataset.cat || chip.textContent.trim());
}

function isFixedChip(chip) {
    if (!chip) {
        return false;
    }
    const value = chip.dataset.cat || chip.textContent.trim();
    return (
        value === 'Mitjans' ||
        value === 'Digitals' ||
        value === 'Entitats' ||
        chip.classList.contains('chip-add') ||
        chip.classList.contains('chip-info')
    );
}

function activateCategory(category) {
    selectedCategory = category;
    localStorage.setItem(LAST_CATEGORY_STORAGE_KEY, selectedCategory);
    renderCategoryActions(getCategoryPageTitle(category));
    if (!chipsBar) {
        return;
    }
    chipsBar.querySelectorAll('.chip').forEach(chip => {
        const isActive = (chip.dataset.cat || chip.textContent.trim()) === category;
        chip.classList.toggle('is-active', isActive);
        chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
}

function setActiveNavItem(page) {
    const navigationFeature = SegueixApp.features.navigation;
    if (navigationFeature && typeof navigationFeature.setActiveNavItem === 'function') {
        return navigationFeature.setActiveNavItem(page);
    }
}

function renderFeed() {
    return SegueixApp.features.feed?.renderFeed?.();
}

function renderCategories() {
    return SegueixApp.features.feed?.renderCategories?.();
}

// ==================== CARREGAR VÍDEOS AMB API ====================

async function loadVideosFromAPI() {
    return SegueixApp.features.feed?.loadVideosFromAPI?.();
}

// Carregar vídeos populars des de l'API
async function loadVideosFromAPILegacyImpl() {
    setPageTitle('Recomanat per a tu');

    // Stale-while-revalidate: mostra la caché immediatament
    const cached = loadFeedCache();
    if (cached?.videos?.length) {
        Object.assign(cachedChannels, cached.channels || {});
        cached.videos.forEach(v => {
            if (v?.id && !cachedAPIVideos.find(x => x.id === v.id)) cachedAPIVideos.push(v);
        });
        setFeedContext(cached.videos, getFeedDataForFilter(), renderVideos);
    } else {
        showLoading();
    }

    const result = await YouTubeAPI.getPopularVideos(CONFIG.layout.videosPerPage);

    if (result.error) {
        console.error('Error:', result.error);
        hideLoading();
        if (!cached?.videos?.length) loadVideos(); // Fallback a dades estàtiques
        return;
    }

    result.items.forEach(video => {
        if (!cachedAPIVideos.find(v => v.id === video.id)) {
            cachedAPIVideos.push(video);
        }
        if (video.channelId) {
            if (!cachedChannels[video.channelId]) {
                cachedChannels[video.channelId] = {
                    id: video.channelId,
                    name: video.channelTitle,
                    thumbnail: video.channelThumbnail || null,
                    categories: [],
                };
            }
            mergeChannelCategories(cachedChannels[video.channelId], video.categories);
        }
    });

    saveFeedCache(result.items, cachedChannels);
    setFeedContext(result.items, getFeedDataForFilter(), renderVideos);
    hideLoading();
}

// Cerca global (local + arxiu) i dropdown
function ensureSearchDropdown() {
    return SegueixApp.features.search?.ensureSearchDropdown?.();
}

function ensureSearchDropdownLegacyImpl() {
    if (!searchForm) {
        return null;
    }
    if (searchDropdown) {
        return searchDropdown;
    }
    const dropdown = document.createElement('div');
    dropdown.className = 'search-dropdown';
    dropdown.id = 'searchDropdown';
    dropdown.setAttribute('role', 'listbox');
    dropdown.setAttribute('aria-label', 'Resultats de cerca');
    dropdown.setAttribute('aria-hidden', 'true');
    dropdown.hidden = true;
    searchForm.appendChild(dropdown);
    searchDropdown = dropdown;
    if (searchInput) {
        searchInput.setAttribute('aria-expanded', 'false');
        searchInput.setAttribute('aria-controls', dropdown.id);
        searchInput.setAttribute('aria-autocomplete', 'list');
    }
    return dropdown;
}

function getMatchScore(text, query) {
    const normalizedQuery = normalizeSearchText(query).trim();
    if (!text || !normalizedQuery) {
        return 0;
    }
    const normalizedText = normalizeSearchText(text);
    if (isMatch(normalizedText, normalizedQuery)) {
        return 3;
    }
    if (normalizedText.startsWith(normalizedQuery)) {
        return 2;
    }
    if (normalizedQuery.length > 3 && normalizedText.includes(normalizedQuery)) {
        return 1;
    }
    return 0;
}

function performLocalSearch(query) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
        return { channels: [], videos: [] };
    }

    const channelsMap = new Map();
    const feedChannels = Array.isArray(YouTubeAPI?.feedChannels) ? YouTubeAPI.feedChannels : [];
    feedChannels.forEach(channel => {
        if (!channel?.id) {
            return;
        }
        channelsMap.set(String(channel.id), {
            id: channel.id,
            name: channel.name || channel.title || '',
            avatar: channel.avatar || channel.thumbnail || '',
            subscriberCount: channel.subscriberCount ?? null,
        });
    });

    Object.values(cachedChannels || {}).forEach(channel => {
        if (!channel?.id) {
            return;
        }
        const normalizedId = String(channel.id);
        if (!channelsMap.has(normalizedId)) {
            channelsMap.set(normalizedId, {
                id: channel.id,
                name: channel.name || channel.title || '',
                avatar: channel.thumbnail || '',
                subscriberCount: channel.subscriberCount ?? null,
            });
        }
    });

    const channelResults = Array.from(channelsMap.values())
        .map(channel => ({
            ...channel,
            score: getMatchScore(channel.name, normalizedQuery),
        }))
        .filter(channel => channel.score > 0)
        .sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return (a.name || '').localeCompare(b.name || '', 'ca', { sensitivity: 'base' });
        });

    const videosMap = new Map();
    const feedVideos = Array.isArray(YouTubeAPI?.feedVideos) ? YouTubeAPI.feedVideos : [];
    feedVideos.forEach(video => {
        if (!video?.id) {
            return;
        }
        videosMap.set(String(video.id), { ...video, source: 'api' });
    });

    cachedAPIVideos.forEach(video => {
        if (!video?.id) {
            return;
        }
        const normalizedId = String(video.id);
        if (!videosMap.has(normalizedId)) {
            videosMap.set(normalizedId, { ...video, source: 'api' });
        }
    });

    if (videosMap.size === 0 && Array.isArray(VIDEOS)) {
        VIDEOS.forEach(video => {
            if (!video?.id) {
                return;
            }
            const channel = getChannelById(video.channelId);
            videosMap.set(String(video.id), {
                id: video.id,
                title: video.title,
                description: video.description || '',
                thumbnail: video.thumbnail,
                channelId: video.channelId,
                channelTitle: channel?.name || '',
                viewCount: video.views || 0,
                publishedAt: video.uploadDate,
                duration: video.duration,
                videoUrl: video.videoUrl,
                source: 'static',
            });
        });
    }

    const videoResults = Array.from(videosMap.values())
        .map(video => {
            const titleScore = getMatchScore(video.title, normalizedQuery);
            const descriptionScore = getMatchScore(video.description, normalizedQuery);
            const tagsValue = video.tags ?? video.snippet?.tags;
            const tags = Array.isArray(tagsValue) ? tagsValue : tagsValue ? [String(tagsValue)] : [];
            const tagScore = tags.reduce((total, tag) => total + getMatchScore(tag, normalizedQuery), 0);
            return {
                ...video,
                score: titleScore * 2 + descriptionScore + tagScore,
            };
        })
        .filter(video => video.score > 0 && !video.isShort)
        .sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            const viewA = a.viewCount ?? a.views ?? 0;
            const viewB = b.viewCount ?? b.views ?? 0;
            if (viewA !== viewB) {
                return viewB - viewA;
            }
            return (a.title || '').localeCompare(b.title || '', 'ca', { sensitivity: 'base' });
        });

    return { channels: channelResults, videos: videoResults };
}

async function loadSearchArchiveManifest() {
    if (searchArchiveManifestPromise) {
        return searchArchiveManifestPromise;
    }

    const manifestPath = 'data/search_index_manifest.json';
    searchArchiveManifestPromise = fetch(window.appDataUrl?.(manifestPath) || manifestPath, { cache: 'no-store' })
        .then(async response => {
            if (!response.ok) {
                return null;
            }
            const data = await response.json();
            return Array.isArray(data?.buckets) ? data : null;
        })
        .catch(() => null);

    return searchArchiveManifestPromise;
}

async function loadSearchArchiveBucket(bucketKey, fileName = '') {
    const normalizedBucketKey = String(bucketKey || '').trim();
    if (!normalizedBucketKey) {
        return searchArchiveIndexCache;
    }
    if (loadedSearchArchiveBuckets.has(normalizedBucketKey) || failedSearchArchiveBuckets.has(normalizedBucketKey)) {
        return searchArchiveIndexCache;
    }

    const safeFileName = String(fileName || '').trim();
    const indexPath = safeFileName ? `data/${safeFileName}` : `data/search_index_${normalizedBucketKey}.json`;
    try {
        const response = await fetch(window.appDataUrl?.(indexPath) || indexPath);
        if (!response.ok) {
            failedSearchArchiveBuckets.add(normalizedBucketKey);
            if (response.status !== 404) {
                console.warn(`No s'ha pogut carregar ${indexPath} (${response.status})`);
            }
            return searchArchiveIndexCache;
        }
        const data = await response.json();
        const list = Array.isArray(data) ? data : [];
        searchArchiveIndexCache.push(...list);
        loadedSearchArchiveBuckets.add(normalizedBucketKey);
        return searchArchiveIndexCache;
    } catch (error) {
        failedSearchArchiveBuckets.add(normalizedBucketKey);
        return searchArchiveIndexCache;
    }
}

async function loadSearchArchiveIndex() {
    return SegueixApp.features.search?.loadSearchArchiveIndex?.();
}

async function loadSearchArchiveIndexLegacyImpl() {
    // Restaurar des de localStorage si disponible (instantani, sense fetch)
    if (searchArchiveIndexCache.length === 0 && loadArchiveIndexCache()) {
        return searchArchiveIndexCache;
    }

    if (searchArchiveIndexPromise) {
        return searchArchiveIndexPromise;
    }

    const feedLatestYear = (() => {
        const feedYears = (Array.isArray(YouTubeAPI?.feedVideos) ? YouTubeAPI.feedVideos : [])
            .map(video => Number.parseInt(String(video?.publishedAt || '').slice(0, 4), 10))
            .filter(Number.isFinite);
        return feedYears.length > 0 ? Math.max(...feedYears) : new Date().getFullYear();
    })();
    const yearsToTry = (
        shouldThrottleBackgroundWork() ? [feedLatestYear] : [feedLatestYear, feedLatestYear - 1, feedLatestYear - 2]
    ).filter(year => Number.isFinite(year) && year >= 2006);

    searchArchiveIndexPromise = (async () => {
        const manifest = await loadSearchArchiveManifest();
        if (Array.isArray(manifest?.buckets) && manifest.buckets.length > 0) {
            const bucketsToLoad = manifest.buckets.filter(bucket => yearsToTry.includes(Number(bucket?.year)));
            for (const bucket of bucketsToLoad) {
                await loadSearchArchiveBucket(bucket?.key, bucket?.file);
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        } else {
            for (const year of yearsToTry) {
                await loadSearchArchiveBucket(year);
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        searchArchiveIndexCache.sort((a, b) => new Date(b?.d || 0).getTime() - new Date(a?.d || 0).getTime());
        saveArchiveIndexCache();
        return searchArchiveIndexCache;
    })().finally(() => {
        searchArchiveIndexPromise = null;
    });

    return searchArchiveIndexPromise;
}

function getChannelNameById(channelId) {
    const normalizedId = String(channelId || '');
    if (!normalizedId) {
        return 'Canal';
    }
    const feedChannel = Array.isArray(YouTubeAPI?.feedChannels)
        ? YouTubeAPI.feedChannels.find(channel => String(channel?.id) === normalizedId)
        : null;
    if (feedChannel?.name || feedChannel?.title) {
        return feedChannel.name || feedChannel.title;
    }
    const cached = cachedChannels?.[normalizedId];
    if (cached?.name || cached?.title) {
        return cached.name || cached.title;
    }
    const staticChannel = typeof getChannelById === 'function' ? getChannelById(normalizedId) : null;
    if (staticChannel?.name || staticChannel?.title) {
        return staticChannel.name || staticChannel.title;
    }
    return normalizedId;
}

function searchArchiveVideos(query) {
    return SegueixApp.features.search?.searchArchiveVideos?.(query);
}

function searchArchiveVideosLegacyImpl(query) {
    const normalizedQuery = String(query || '')
        .trim()
        .toLowerCase();
    if (!normalizedQuery || !Array.isArray(searchArchiveIndexCache)) {
        return [];
    }

    return searchArchiveIndexCache
        .map(item => {
            const title = item?.t || '';
            const score = getMatchScore(title, normalizedQuery);
            return {
                id: item?.i,
                title,
                channelId: item?.c || '',
                channelTitle: getChannelNameById(item?.c),
                publishedAt: item?.d || '',
                durationSeconds: Number(item?.s || 0),
                source: 'archive',
                score,
            };
        })
        .filter(video => video.id && video.score > 0)
        .sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime();
        });
}

async function performDualSearch(query) {
    const localResults = performLocalSearch(query);
    const trimmedQuery = String(query || '').trim();
    if (!trimmedQuery) {
        return { ...localResults, archiveVideos: [] };
    }

    // No bloquejar la UX de cerca: retornem resultats locals immediats i
    // només afegim arxiu si ja està disponible o carrega molt ràpid.
    let archiveVideos = [];
    try {
        const archiveReady =
            (Array.isArray(searchArchiveIndexCache) && searchArchiveIndexCache.length > 0) || loadArchiveIndexCache();

        if (archiveReady) {
            archiveVideos = searchArchiveVideos(trimmedQuery);
        } else {
            const ARCHIVE_SEARCH_BUDGET_MS = 650;
            await Promise.race([
                loadSearchArchiveIndex(),
                new Promise(resolve => setTimeout(resolve, ARCHIVE_SEARCH_BUDGET_MS)),
            ]);
            if (Array.isArray(searchArchiveIndexCache) && searchArchiveIndexCache.length > 0) {
                archiveVideos = searchArchiveVideos(trimmedQuery);
            }
        }
    } catch (_) {
        archiveVideos = [];
    }

    rememberArchiveSearchVideos(archiveVideos);
    return { ...localResults, archiveVideos };
}

function resetSearchDropdownNavigation() {
    searchDropdownItems.forEach(item => {
        item.classList.remove('is-active');
        item.setAttribute('aria-selected', 'false');
        item.setAttribute('tabindex', '-1');
    });
    searchDropdownItems = searchDropdown ? Array.from(searchDropdown.querySelectorAll('.search-result-item')) : [];
    searchDropdownItems.forEach(item => {
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', 'false');
        item.setAttribute('tabindex', '-1');
    });
    searchDropdownActiveIndex = -1;
}

function focusSearchDropdownItem(index) {
    if (!searchDropdownItems.length) {
        return;
    }
    const total = searchDropdownItems.length;
    const normalizedIndex = ((index % total) + total) % total;
    searchDropdownItems.forEach((item, itemIndex) => {
        const isActive = itemIndex === normalizedIndex;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-selected', isActive ? 'true' : 'false');
        item.setAttribute('tabindex', isActive ? '0' : '-1');
    });
    searchDropdownActiveIndex = normalizedIndex;
    searchDropdownItems[normalizedIndex].focus();
}

function showSearchDropdown(results) {
    return SegueixApp.features.search?.showSearchDropdown?.(results);
}

function showSearchDropdownLegacyImpl(results) {
    if (!searchDropdown || !searchInput) {
        return;
    }
    const channels = Array.isArray(results?.channels) ? results.channels.slice(0, 5) : [];
    const videos = Array.isArray(results?.videos) ? results.videos.slice(0, 8) : [];
    const archiveVideos = Array.isArray(results?.archiveVideos) ? results.archiveVideos.slice(0, 8) : [];

    if (channels.length === 0 && videos.length === 0 && archiveVideos.length === 0) {
        searchDropdown.innerHTML = `
            <div class="search-no-results" role="status">No s'han trobat resultats.</div>
        `;
    } else {
        const channelMarkup = channels.length
            ? `
            <div class="search-section" role="group" aria-label="Canals">
                <h4>Canals</h4>
                ${channels
                    .map(channel => {
                        const avatar = channel.avatar || getFollowChannelAvatar(channel.id) || 'img/icon-192.png';
                        const subscriberText =
                            channel.subscriberCount != null
                                ? `${formatViews(channel.subscriberCount)} subscriptors`
                                : 'Subscriptors no disponibles';
                        return `
                        <button type="button" class="search-result-item" data-result-type="channel" data-channel-id="${channel.id}">
                            <img class="search-result-avatar" src="${avatar}" alt="${escapeHtml(channel.name || 'Canal')}">
                            <div class="search-result-info">
                                <span class="name">${escapeHtml(channel.name || 'Canal')}</span>
                                <span class="meta">${subscriberText}</span>
                            </div>
                        </button>
                    `;
                    })
                    .join('')}
            </div>
        `
            : '';

        const videoMarkup = videos.length
            ? `
            <div class="search-section" role="group" aria-label="Vídeos">
                <h4>Vídeos</h4>
                ${videos
                    .map(video => {
                        const channelName = video.channelTitle || '';
                        const isArchiveVideo = video.source === 'archive';
                        const viewCount = video.viewCount ?? video.views ?? 0;
                        const archiveDateLabel = video.publishedAt ? formatDate(video.publishedAt) : 'Històric';
                        const meta = isArchiveVideo
                            ? channelName
                                ? `${escapeHtml(channelName)} • ${archiveDateLabel}`
                                : archiveDateLabel
                            : channelName
                              ? `${escapeHtml(channelName)} • ${formatViews(viewCount)} vis.`
                              : `${formatViews(viewCount)} vis.`;
                        const archiveClass = isArchiveVideo ? ' is-archive' : '';
                        return `
                        <button type="button" class="search-result-item${archiveClass}" data-result-type="video" data-video-id="${video.id}" data-video-source="${video.source || 'api'}">
                            <img class="search-result-thumb" src="${video.thumbnail}" alt="${escapeHtml(video.title)}">
                            <div class="search-result-info">
                                <span class="title">${escapeHtml(video.title)}</span>
                                <span class="meta">${meta}</span>
                            </div>
                        </button>
                    `;
                    })
                    .join('')}
            </div>
        `
            : '';

        const archiveMarkup = archiveVideos.length
            ? `
            <div class="search-section" role="group" aria-label="Històric">
                <h4>Històric</h4>
                ${archiveVideos
                    .map(video => {
                        const thumbnail = video.thumbnail || buildArchiveThumbnail(video.id);
                        const channelName = video.channelTitle || '';
                        const archiveDateLabel = video.publishedAt ? formatDate(video.publishedAt) : 'Històric';
                        const meta = channelName
                            ? `${escapeHtml(channelName)} • ${archiveDateLabel}`
                            : archiveDateLabel;
                        return `
                    <button type="button" class="search-result-item search-result-item--archive" data-result-type="video" data-video-id="${video.id}" data-video-source="archive">
                        <img class="search-result-thumb" src="${thumbnail}" alt="${escapeHtml(video.title)}" loading="lazy" decoding="async">
                        <div class="search-result-info">
                            <span class="title">${escapeHtml(video.title)}</span>
                            <span class="meta">${meta}</span>
                        </div>
                    </button>
                `;
                    })
                    .join('')}
            </div>
        `
            : '';

        searchDropdown.innerHTML = `
            ${channelMarkup}
            ${videoMarkup}
            ${archiveMarkup}
        `;
    }

    searchDropdown.hidden = false;
    searchDropdown.setAttribute('aria-hidden', 'false');
    searchDropdown.classList.add('is-visible');
    searchInput.setAttribute('aria-expanded', 'true');
    refreshIcons(searchDropdown);
    resetSearchDropdownNavigation();
}

function hideSearchDropdown() {
    return SegueixApp.features.search?.hideSearchDropdown?.();
}

function hideSearchDropdownLegacyImpl() {
    if (!searchDropdown || !searchInput) {
        return;
    }
    searchDropdown.hidden = true;
    searchDropdown.setAttribute('aria-hidden', 'true');
    searchDropdown.classList.remove('is-visible');
    searchInput.setAttribute('aria-expanded', 'false');
    searchDropdown.innerHTML = '';
    searchDropdownItems = [];
    searchDropdownActiveIndex = -1;
}

// ==================== MOBILE SEARCH ====================
function openMobileSearch() {
    if (!searchForm || !searchInput) return;
    searchForm.classList.add('is-open');
    if (mobileSearchOverlay) {
        mobileSearchOverlay.classList.add('is-visible');
        mobileSearchOverlay.setAttribute('aria-hidden', 'false');
    }
    requestAnimationFrame(() => searchInput.focus());
}

function closeMobileSearch() {
    if (!searchForm) return;
    searchForm.classList.remove('is-open');
    if (mobileSearchOverlay) {
        mobileSearchOverlay.classList.remove('is-visible');
        mobileSearchOverlay.setAttribute('aria-hidden', 'true');
    }
    hideSearchDropdown();
    if (searchInput) searchInput.value = '';
}

function bindMobileSearchEvents() {
    bindButtonInstant(mobileSearchToggle, e => {
        e.preventDefault();
        e.stopPropagation();
        openMobileSearch();
    });

    if (mobileSearchOverlay) {
        mobileSearchOverlay.addEventListener('click', () => {
            closeMobileSearch();
        });
    }
}

function handleSearchResultSelection(item) {
    if (!item) {
        return;
    }
    const resultType = item.dataset.resultType;
    if (resultType === 'channel') {
        const channelId = item.dataset.channelId;
        if (channelId) {
            openChannelProfile(channelId);
        }
    } else if (resultType === 'video') {
        const videoId = item.dataset.videoId;
        const source = item.dataset.videoSource;
        if (videoId) {
            openVideoFromUserGesture(videoId, source);
        }
    }
    hideSearchDropdown();
    if (isMobileView()) closeMobileSearch();
}

async function handleCategoryShare(categoryName) {
    const channelIds = getChannelsForCategory(categoryName);
    // Tant amb canals com sense, usem el nou flux de compartició per URL comprimida
    await shareCategoryWithYoutubers(categoryName, channelIds || []);
}

function openManageCategoryYoutubersModal(categoryName) {
    const normalizedCategory = normalizeCustomTag(categoryName);
    if (!normalizedCategory) {
        return;
    }

    const existingModal = document.getElementById('manageCategoryYoutubersModal');
    if (existingModal) existingModal.remove();

    const previousBodyOverflow = document.body.style.overflow;
    const feedChannelMap = new Map(
        (Array.isArray(YouTubeAPI?.getAllChannels?.()) ? YouTubeAPI.getAllChannels() : []).map(ch => [
            String(ch.id),
            ch,
        ])
    );

    const renderChannelRows = () => {
        const channelIds = getChannelsForCategory(normalizedCategory);
        // Obtenir també els programes que tenen aquesta categoria
        const categoryPrograms = getPrograms().filter(p =>
            (p.customCategories || []).some(c => c.toLowerCase() === normalizedCategory.toLowerCase())
        );

        if (channelIds.length === 0 && categoryPrograms.length === 0) {
            return '<div class="playlist-empty" data-role="empty-state">Aquesta categoria no té YouTubers ni programes assignats.</div>';
        }

        // Renderitzar canals normals
        const channelsHtml = channelIds
            .map(channelId => {
                const feedCh = feedChannelMap.get(String(channelId));
                const cachedChannel = cachedChannels?.[channelId] || {};
                const avatar =
                    feedCh?.avatar ||
                    feedCh?.thumbnail ||
                    resolveChannelAvatar(channelId, cachedChannel) ||
                    'img/icon-192.png';
                const name = feedCh?.name || cachedChannel?.name || channelId;

                return `
                <div class="smart-cat-channel-row" data-channel-id="${escapeHtml(channelId)}" style="display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:8px; min-width:0; width:100%;">
                    <img class="smart-cat-channel-avatar" src="${escapeHtml(avatar)}" alt="${escapeHtml(name)}" loading="lazy">
                    <span class="smart-cat-channel-name" style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(name)}</span>
                    <button class="smart-cat-channel-remove"
                            type="button"
                            data-action="remove-category-channel"
                            data-channel-id="${escapeHtml(channelId)}"
                            title="Eliminar ${escapeHtml(name)} d'aquesta categoria"
                            aria-label="Eliminar ${escapeHtml(name)}"
                            style="display:inline-flex; align-items:center; justify-content:center; flex:0 0 32px; width:32px; height:32px;">
                        <i data-lucide="minus"></i>
                    </button>
                </div>
            `;
            })
            .join('');

        // Renderitzar programes
        const programsHtml = categoryPrograms
            .map(prog => {
                const feedCh = feedChannelMap.get(String(prog.channelId));
                const avatar = feedCh?.avatar || feedCh?.thumbnail || 'img/icon-192.png';
                const displayName = `${prog.name} (Programa)`;

                return `
                <div class="smart-cat-channel-row" data-program-id="${escapeHtml(prog.id)}" style="display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:8px; min-width:0; width:100%;">
                    <img class="smart-cat-channel-avatar" src="${escapeHtml(avatar)}" alt="${escapeHtml(displayName)}" loading="lazy">
                    <span class="smart-cat-channel-name" style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color: var(--color-primary);">${escapeHtml(displayName)}</span>
                    <button class="smart-cat-channel-remove"
                            type="button"
                            data-action="remove-category-program"
                            data-program-id="${escapeHtml(prog.id)}"
                            title="Eliminar ${escapeHtml(displayName)} d'aquesta categoria"
                            aria-label="Eliminar ${escapeHtml(displayName)}"
                            style="display:inline-flex; align-items:center; justify-content:center; flex:0 0 32px; width:32px; height:32px;">
                        <i data-lucide="minus"></i>
                    </button>
                </div>
            `;
            })
            .join('');

        return `
            <div class="smart-cat-channels-list" data-role="channels-list" style="display:flex; flex-direction:column; gap:8px; max-height:min(52vh, 420px); overflow-y:auto; overflow-x:hidden; padding-right:2px;">
                ${channelsHtml}
                ${programsHtml}
            </div>
        `;
    };

    const modal = document.createElement('div');
    modal.id = 'manageCategoryYoutubersModal';
    modal.className = 'modal-overlay active';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.zIndex = '12000';
    modal.style.padding = '12px';
    modal.innerHTML = `
        <div class="modal modal-small" style="width:min(100%, 560px); max-height:calc(100vh - 24px); overflow:hidden; display:flex; flex-direction:column;">
            <div class="modal-header" style="position:sticky; top:0; z-index:1;">
                <h2 class="modal-title">Contingut de ${escapeHtml(normalizedCategory)}</h2>
                <button class="modal-close" type="button" data-action="close-modal" aria-label="Tancar">
                    <i data-lucide="x"></i>
                </button>
            </div>
            <div class="modal-body" style="display:flex; flex-direction:column; gap:12px; overflow:hidden;">
                ${renderChannelRows()}
                <button class="hero-button" type="button" data-action="assign-category" style="display:inline-flex; align-items:center; justify-content:center; gap:8px; width:100%; white-space:normal;">
                    <i data-lucide="plus-circle"></i>
                    <span>Assigna més contingut</span>
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const closeModal = () => {
        modal.remove();
        document.body.style.overflow = previousBodyOverflow;
    };

    const rerenderChannels = () => {
        const body = modal.querySelector('.modal-body');
        const assignButton = body?.querySelector('[data-action="assign-category"]');
        const oldList = body?.querySelector('[data-role="channels-list"], [data-role="empty-state"]');
        if (!body || !assignButton || !oldList) {
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.innerHTML = renderChannelRows();
        const nextList = wrapper.firstElementChild;
        if (!nextList) {
            return;
        }

        oldList.replaceWith(nextList);
        refreshIcons(wrapper);
    };

    modal.addEventListener('click', event => {
        const overlayTarget = event.target;
        if (overlayTarget === modal) {
            closeModal();
            return;
        }

        const actionTarget = event.target.closest('[data-action]');
        if (!actionTarget) {
            return;
        }

        const action = actionTarget.dataset.action;
        if (action === 'close-modal') {
            closeModal();
            return;
        }

        if (action === 'remove-category-channel') {
            const channelId = actionTarget.dataset.channelId;
            if (!channelId) {
                return;
            }
            removeCategoryFromChannel(channelId, normalizedCategory);
            rerenderChannels();
            updateFeed();
            return;
        }

        // Lògica per eliminar la categoria del programa
        if (action === 'remove-category-program') {
            const programId = actionTarget.dataset.programId;
            if (!programId) return;

            const program = getProgramById(programId);
            if (program) {
                const nextCats = (program.customCategories || []).filter(
                    c => c.toLowerCase() !== normalizedCategory.toLowerCase()
                );
                updateProgram(programId, { customCategories: nextCats });
                rerenderChannels();
                updateFeed();
            }
            return;
        }

        if (action === 'assign-category') {
            closeModal();
            setActiveNavItem('segueix');
            showFollow('all');
        }
    });

    refreshIcons(modal);
}

function renderSearchCategoryActions(query) {
    if (!pageTitle) {
        return;
    }
    const normalizedQuery = normalizeCustomTag(query);
    if (!normalizedQuery) {
        setPageTitle(`Resultats per: "${query}"`);
        return;
    }
    const isSaved = isCustomCategory(normalizedQuery);
    pageTitle.classList.add('page-title--with-actions');
    pageTitle.dataset.title = `Resultats per: "${normalizedQuery}"`;
    const toggleButtonHtml = isSaved
        ? ''
        : `
            <button class="btn-round-icon category-toggle" type="button" data-action="toggle-search-category" aria-label="Guardar">
                <i data-lucide="plus"></i>
            </button>
        `;
    const manageYoutubersHtml = isSaved
        ? `
            <button class="hero-button" type="button" data-action="manage-category-youtubers" style="padding: 6px 14px; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px; background-color: var(--color-surface-button); color: var(--color-text);">
                <i data-lucide="users" style="width: 16px; height: 16px;"></i> YouTubers
            </button>
        `
        : '';
    // Detectar si la cerca original és entre cometes (categoria intel·ligent)
    const rawQuery = String(query || '').trim();
    const isQuotedSearch = rawQuery.startsWith('"') && rawQuery.endsWith('"');
    // No mostrar etiquetes a categories intel·ligents (cerca entre cometes "")
    const keywordsButtonHtml =
        isSaved && !isQuotedSearch && !isExactCategory(normalizedQuery)
            ? `
            <button class="hero-button" type="button" data-action="manage-category-keywords" style="padding: 6px 14px; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px; background-color: var(--color-surface-button); color: var(--color-text);">
                <i data-lucide="tags" style="width: 16px; height: 16px;"></i> Etiquetes
            </button>
        `
            : '';

    pageTitle.innerHTML = `
        <span class="page-title__label">Resultats per:</span>
        <span class="page-title__query">"${escapeHtml(normalizedQuery)}"</span>
        <span class="page-title__actions">
            ${toggleButtonHtml}
            ${manageYoutubersHtml}
            ${keywordsButtonHtml}
            <span class="search-info-wrap">
                <button class="btn-round-icon search-info-btn" type="button" data-action="search-info" aria-label="Com funciona la cerca" aria-expanded="false">
                    <span class="chip-info-icon" aria-hidden="true">i</span>
                </button>
                <div class="search-info-popover" role="tooltip" hidden>
                    <p><strong>Categoria personalitzada:</strong> escriu una paraula sense cometes per veure tots els vídeos que la contenen.</p>
                    <p><strong>Categoria intel·ligent:</strong> escriu l'expressió entre cometes (per exemple <code>"Canal Jove"</code>) per limitar els resultats a aquesta frase exacta. Un cop guardada, si hi assignes els teus YouTubers només hi veuràs els vídeos d'aquests canals.</p>
                </div>
            </span>
            <button class="btn-round-icon search-category-share" type="button" data-action="share-search" aria-label="Compartir">
                <i data-lucide="share-2"></i>
            </button>
        </span>
    `;

    const toggleButton = pageTitle.querySelector('[data-action="toggle-search-category"]');
    const manageYoutubersButton = pageTitle.querySelector('[data-action="manage-category-youtubers"]');
    const keywordsButton = pageTitle.querySelector('[data-action="manage-category-keywords"]');
    const shareButton = pageTitle.querySelector('[data-action="share-search"]');

    toggleButton?.addEventListener('click', async () => {
        const savedTag = addCustomTag(normalizedQuery);
        if (!savedTag) {
            return;
        }
        // Marcar com a categoria exacta si la cerca original tenia cometes
        if (isQuotedSearch) {
            markExactCategory(normalizedQuery);
        }
        const dualResults = await performDualSearch(normalizedQuery);
        const seedVideos = mergeUniqueVideos(dualResults?.videos || [], dualResults?.archiveVideos || []);
        setCustomCategorySearchResults(normalizedQuery, seedVideos);
        setupChipsBarOrdering();
        renderSearchCategoryActions(query);
    });

    shareButton?.addEventListener('click', async () => {
        await handleCategoryShare(normalizedQuery);
    });

    manageYoutubersButton?.addEventListener('click', () => {
        openManageCategoryYoutubersModal(normalizedQuery);
    });

    keywordsButton?.addEventListener('click', () => {
        openCategoryKeywordsModal(normalizedQuery);
    });

    refreshIcons(pageTitle);
    renderInlineKeywords(normalizedQuery);
}

function renderCategoryActions(category) {
    if (!pageTitle) {
        return;
    }
    const normalizedCategory = normalizeCustomTag(category);
    // Cas especial: secció Radar → mostra un botó d'informació al costat del títol
    if (normalizedCategory === 'Radar') {
        pageTitle.classList.add('page-title--with-actions');
        pageTitle.dataset.title = 'Radar';
        pageTitle.innerHTML = `
            <span class="page-title__query">Radar</span>
            <span class="page-title__actions">
                <span class="radar-info-wrap">
                    <button type="button" class="btn-round-icon radar-info-btn" data-action="radar-info" aria-label="Què és el Radar?" aria-expanded="false">
                        <span class="chip-info-icon" aria-hidden="true">i</span>
                    </button>
                    <div class="radar-info-popover" role="tooltip" hidden>
                        <button type="button" class="chip-info-popover-close" data-action="radar-info-close" aria-label="Tancar">×</button>
                        <p>Quan deses una cerca com a <strong>categoria personalitzada</strong>, les paraules clau s'afegeixen automàticament al Radar, juntament amb els YouTubers que hi has vinculat.</p>
                        <p>Aquí hi trobaràs tots els <strong>vídeos nous</strong> de les teves temàtiques i creadors preferits, agrupats en un únic feed.</p>
                    </div>
                </span>
            </span>
        `;
        refreshIcons(pageTitle);
        hideInlineKeywords();
        return;
    }
    if (
        !normalizedCategory ||
        normalizedCategory === getCategoryPageTitle('Tot') ||
        normalizedCategory === 'Categoria' ||
        isStandardCategory(normalizedCategory)
    ) {
        setPageTitle(getCategoryPageTitle(category));
        return;
    }
    const isSaved = isCustomCategory(normalizedCategory);
    const toggleButtonHtml = isSaved
        ? ''
        : `
            <button class="btn-round-icon category-toggle" type="button" data-action="toggle-category" aria-label="Guardar">
                <i data-lucide="plus"></i>
            </button>
        `;
    const manageYoutubersHtml = isSaved
        ? `
            <button class="hero-button" type="button" data-action="manage-category-youtubers" style="padding: 6px 14px; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px; background-color: var(--color-surface-button); color: var(--color-text);">
                <i data-lucide="users" style="width: 16px; height: 16px;"></i> YouTubers
            </button>
        `
        : '';
    // No mostrar etiquetes a categories intel·ligents (creades amb cerca entre cometes "")
    const keywordsButtonHtml =
        isSaved && !isExactCategory(normalizedCategory)
            ? `
            <button class="hero-button" type="button" data-action="manage-category-keywords" style="padding: 6px 14px; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px; background-color: var(--color-surface-button); color: var(--color-text);">
                <i data-lucide="tags" style="width: 16px; height: 16px;"></i> Etiquetes
            </button>
        `
            : '';
    pageTitle.classList.add('page-title--with-actions');
    pageTitle.dataset.title = normalizedCategory;
    pageTitle.innerHTML = `
        <span class="page-title__query">${escapeHtml(normalizedCategory)}</span>
        <span class="page-title__actions">
            ${toggleButtonHtml}
            ${manageYoutubersHtml}
            ${keywordsButtonHtml}
            <button class="btn-round-icon search-category-share" type="button" data-action="share-category" aria-label="Compartir">
                <i data-lucide="share-2"></i>
            </button>
        </span>
    `;

    const toggleButton = pageTitle.querySelector('[data-action="toggle-category"]');
    const manageYoutubersButton = pageTitle.querySelector('[data-action="manage-category-youtubers"]');
    const keywordsButton = pageTitle.querySelector('[data-action="manage-category-keywords"]');
    const shareButton = pageTitle.querySelector('[data-action="share-category"]');

    toggleButton?.addEventListener('click', () => {
        const savedTag = addCustomTag(normalizedCategory);
        if (!savedTag) {
            return;
        }
        setupChipsBarOrdering();
        renderCategoryActions(normalizedCategory);
    });

    shareButton?.addEventListener('click', async () => {
        await handleCategoryShare(normalizedCategory);
    });

    manageYoutubersButton?.addEventListener('click', () => {
        openManageCategoryYoutubersModal(normalizedCategory);
    });

    keywordsButton?.addEventListener('click', () => {
        openCategoryKeywordsModal(normalizedCategory);
    });

    refreshIcons(pageTitle);
    renderInlineKeywords(normalizedCategory);
}

async function navigateToSearchResults(query) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
        return;
    }
    hideSearchDropdown();
    if (isMobileView()) {
        closeMobileSearch();
        document.body.classList.add('mobile-search-active');
    }
    if (searchInput) {
        searchInput.value = '';
    }

    // Desseleccionar totes les categories — cap chip actiu durant la cerca
    if (chipsBar) {
        chipsBar.querySelectorAll('.chip.is-active').forEach(c => c.classList.remove('is-active'));
    }
    selectedCategory = null;

    if (useYouTubeAPI && !YouTubeAPI?.feedLoaded) {
        searchVideos(trimmedQuery);
        return;
    }

    const results = await performDualSearch(trimmedQuery);
    showHome();
    renderSearchCategoryActions(trimmedQuery);
    featuredVideoBySection.delete(getHeroSectionKey());
    updateHero(null);

    if (!videosGrid) {
        return;
    }

    if (
        results.channels.length === 0 &&
        results.videos.length === 0 &&
        (!Array.isArray(results.archiveVideos) || results.archiveVideos.length === 0)
    ) {
        videosGrid.innerHTML = `
            <div class="search-error">
                <i data-lucide="search-x"></i>
                <p>No s'han trobat resultats locals.</p>
            </div>
        `;
        refreshIcons(videosGrid);
        return;
    }

    const channelSection = results.channels.length
        ? `
        <section class="search-results-section">
            <h2 class="search-results-title">Canals</h2>
            <div class="follow-grid search-channel-grid">
                ${results.channels
                    .map(channel => {
                        const avatar = channel.avatar || getFollowChannelAvatar(channel.id) || 'img/icon-192.png';
                        const isMitjans = isMitjansOrDigitalsChannel(channel.id);
                        const followButtonHtml = isMitjans
                            ? ''
                            : `
                            <button class="follow-toggle-btn" type="button" data-follow-channel="${channel.id}" aria-pressed="false">
                                Segueix
                            </button>
                        `;
                        return `
                        <div class="follow-card search-channel-card" data-channel-id="${channel.id}">
                            <div class="follow-avatar-wrap">
                                <img class="follow-avatar" src="${avatar}" alt="${escapeHtml(channel.name || 'Canal')}" loading="lazy">
                            </div>
                            <div class="follow-name">${escapeHtml(channel.name || 'Canal')}</div>
                            ${followButtonHtml}
                        </div>
                    `;
                    })
                    .join('')}
            </div>
        </section>
    `
        : '';

    const sortedSearchVideos = sortVideosByRoundRobin(results.videos);
    // A Desktop, separar vídeos ja vistos i mostrar-los a la part inferior
    let freshSearchVideos = sortedSearchVideos;
    let watchedSearchVideos = [];
    if (isDesktopView()) {
        const watchedIds = getHistoryVideoIdSet();
        if (watchedIds.size > 0) {
            freshSearchVideos = sortedSearchVideos.filter(video => !watchedIds.has(String(video.id)));
            watchedSearchVideos = sortedSearchVideos.filter(video => watchedIds.has(String(video.id)));
        }
    }
    const videoSection = freshSearchVideos.length
        ? `
        <section class="search-results-section">
            <h2 class="search-results-title">Vídeos</h2>
            <div class="videos-grid">
                ${freshSearchVideos.map(video => createVideoCardAPI(video)).join('')}
            </div>
        </section>
    `
        : '';
    const watchedSection = watchedSearchVideos.length
        ? `
        <section class="search-results-section">
            <h2 class="category-history-title">Ja vistos</h2>
            <div class="videos-grid">
                ${watchedSearchVideos.map(video => createVideoCardAPI(video)).join('')}
            </div>
        </section>
    `
        : '';

    const archiveVideos = Array.isArray(results.archiveVideos) ? results.archiveVideos.slice(0, 40) : [];
    const archiveSection = archiveVideos.length
        ? `
        <section class="search-results-section">
            <h2 class="search-results-title">Històric</h2>
            <div class="videos-grid archive-videos-grid">
                ${archiveVideos.map(video => createArchiveVideoCard(video)).join('')}
            </div>
        </section>
    `
        : '';

    videosGrid.innerHTML = `
        ${channelSection}
        ${videoSection}
        ${archiveSection}
        ${watchedSection}
    `;
    // Delegació única per tots els clics de resultats de cerca
    videosGrid.addEventListener('click', e => {
        // Accions de playlist en arxiu
        const playlistBtn = e.target.closest('.archive-playlist-action');
        if (playlistBtn) {
            e.stopPropagation();
            const payload = playlistBtn.dataset.playlistVideo;
            if (payload) openPlaylistModal(JSON.parse(decodeURIComponent(payload)));
            return;
        }
        // Ignorar follow buttons i channel links
        if (e.target.closest('[data-follow-channel], .channel-link')) return;
        // Channel cards
        const channelCard = e.target.closest('.search-channel-card');
        if (channelCard) {
            openChannelProfile(channelCard.dataset.channelId);
            return;
        }
        // Video cards i archive cards
        const card = e.target.closest('.video-card, .archive-video-card');
        if (card) {
            const videoId = card.dataset.videoId;
            if (!videoId) return;
            const video = sortedSearchVideos.find(item => String(item.id) === String(videoId));
            openVideoFromUserGesture(videoId, video?.source);
        }
    });

    bindFollowButtons(videosGrid);
    bindChannelLinks(videosGrid);

    refreshIcons(videosGrid);
    setupVideoCardActionButtons(videosGrid);
}

// Cercar vídeos
async function searchVideos(query) {
    return SegueixApp.features.search?.searchVideos?.(query);
}

async function searchVideosLegacyImpl(query) {
    showLoading();

    // Desseleccionar totes les categories — cap chip actiu durant la cerca
    if (chipsBar) {
        chipsBar.querySelectorAll('.chip.is-active').forEach(c => c.classList.remove('is-active'));
    }
    selectedCategory = null;

    renderSearchCategoryActions(query);
    showHome();

    const result = await YouTubeAPI.searchVideos(query, CONFIG.layout.videosPerPage);

    if (result.error) {
        hideLoading();
        featuredVideoBySection.delete(getHeroSectionKey());
        updateHero(null);
        // Mostrar missatge d'error
        videosGrid.innerHTML = `
            <div class="search-error">
                <i data-lucide="alert-circle"></i>
                <p>${result.error}</p>
            </div>
        `;
        refreshIcons(videosGrid);
        return;
    }

    if (result.items.length === 0) {
        featuredVideoBySection.delete(getHeroSectionKey());
        updateHero(null);
        videosGrid.innerHTML = `
            <div class="search-error">
                <i data-lucide="video-off"></i>
                <p>No s'han trobat vídeos per aquesta cerca.</p>
            </div>
        `;
        refreshIcons(videosGrid);
        hideLoading();
        return;
    }

    // Per cerques, obtenim més detalls dels vídeos
    const videoIds = result.items.map(v => v.id).join(',');
    const detailsResult = await fetchVideoDetails(videoIds);

    if (detailsResult.length > 0) {
        const filteredResults = detailsResult.filter(video => {
            if (video.isShort) {
                return false;
            }
            const seconds = getVideoDurationSeconds(video);
            return Number.isFinite(seconds) && seconds >= 180;
        });
        if (filteredResults.length > 0) {
            const sortedResults = sortVideosByRoundRobin(filteredResults);
            renderVideos(sortedResults);
        } else {
            featuredVideoBySection.delete(getHeroSectionKey());
            updateHero(null);
            videosGrid.innerHTML = `
                <div class="search-error">
                    <i data-lucide="video-off"></i>
                    <p>No s'han trobat vídeos per aquesta cerca.</p>
                </div>
            `;
            refreshIcons(videosGrid);
        }
    } else {
        featuredVideoBySection.delete(getHeroSectionKey());
        updateHero(null);
        videosGrid.innerHTML = `
            <div class="search-error">
                <i data-lucide="video-off"></i>
                <p>No s'han trobat vídeos per aquesta cerca.</p>
            </div>
        `;
        refreshIcons(videosGrid);
    }

    hideLoading();
}

// Obtenir detalls de múltiples vídeos
async function fetchVideoDetails(videoIds) {
    const apiKey = YouTubeAPI.getApiKey();
    if (!apiKey) return [];

    try {
        const response = await fetch(
            `${YouTubeAPI.BASE_URL}/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${apiKey}`
        );
        if (!response.ok) return [];

        const data = await response.json();
        return YouTubeAPI.transformVideoResults(data.items);
    } catch (error) {
        return [];
    }
}

// Renderitzar vídeos de l'API
// Render de targetes API i flux principal de vídeos
function renderVideos(videos) {
    ensureGridLayoutControls();
    applyGridLayoutPreference();
    // Guardar vídeos i canals a la cache amb Set per O(1) lookup
    const cachedIds = new Set(cachedAPIVideos.map(v => v.id));
    videos.forEach(video => {
        if (!cachedIds.has(video.id)) {
            cachedAPIVideos.push(video);
            cachedIds.add(video.id);
        }
        if (video.channelId) {
            if (!cachedChannels[video.channelId]) {
                cachedChannels[video.channelId] = {
                    id: video.channelId,
                    name: video.channelTitle,
                    thumbnail: video.channelThumbnail || null,
                    categories: [],
                };
            }
            mergeChannelCategories(cachedChannels[video.channelId], video.categories);
        }
    });
    // Podar cache si supera el límit (eliminar els més antics)
    if (cachedAPIVideos.length > CACHED_API_VIDEOS_MAX) {
        cachedAPIVideos.splice(0, cachedAPIVideos.length - CACHED_API_VIDEOS_MAX);
    }

    const featured = getFeaturedVideoForSection(videos, getHeroSectionKey());
    updateHero(featured, 'api');

    const listVideos = featured ? videos.filter(video => String(video.id) !== String(featured.id)) : videos;

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const shorts = isMobile ? listVideos.filter(video => video.isShort) : [];
    const normal = listVideos.filter(video => !video.isShort);

    // El hero surt de la llista (i els Shorts al mòbil): en treure elements del mig poden quedar
    // junts dos vídeos del mateix artista, o el primer igual que el hero. Es torna a repartir.
    let freshVideos = spreadVideosByArtist(normal, { previousArtist: getVideoArtistKey(featured) });

    const shortsSection =
        shorts.length > 0
            ? `
        <div class="shorts-section">
            <h2 class="shorts-title">Shorts</h2>
            <div class="shorts-row">
                ${shorts.map(video => createShortCard(video)).join('')}
            </div>
        </div>
    `
            : '';

    // Delegació d'events per video cards (1 listener en lloc de N)
    setupDelegatedVideoCardClicks(videosGrid, 'api');
    bindChannelLinks(videosGrid);

    // Pàgina principal (Novetats): seccions horitzontals en lloc de la graella plana
    if (
        selectedCategory === 'Novetats' &&
        SegueixApp.features.homeSections?.render(videosGrid, normal, {
            feed: currentFeedData,
            all: currentFeedVideos,
            prepend: shortsSection,
        })
    ) {
        if (_batchRenderAbort) _batchRenderAbort.aborted = true;
        refreshIcons(videosGrid);
        setupVideoCardActionButtons(videosGrid);
        return;
    }

    // Batch rendering: primeres 12 targetes immediates, resta en lots
    // A Desktop, mostrar tots els vídeos sense infinite scroll per evitar que
    // les seccions d'historial quedin intercalades amb els vídeos nous.
    const categoryAtRender = selectedCategory;
    batchRenderCards(videosGrid, freshVideos, createVideoCardAPI, {
        prepend: shortsSection,
        maxVisible: isDesktopView() ? 0 : FEED_PAGE_SIZE,
        onComplete: () => {
            refreshIcons(videosGrid);
            setupVideoCardActionButtons(videosGrid);
            if (
                selectedCategory === categoryAtRender &&
                categoryAtRender !== 'Tot' &&
                categoryAtRender !== 'Novetats'
            ) {
                renderCategoryHistorySection(categoryAtRender);
            }
        },
    });

    // Icones del primer lot
    requestAnimationFrame(() => refreshIcons(videosGrid));
}

// ==================== SHORTS (wrappers globals) ====================
// Implementació a js/features/shorts.js
function createShortCard(video) {
    return SegueixApp.features.shorts?.createShortCard?.(video) || '';
}
function openShortModal(videoId) {
    return SegueixApp.features.shorts?.openShortModal?.(videoId);
}
function openChannelShortModal(videoId, channelId) {
    return SegueixApp.features.shorts?.openChannelShortModal?.(videoId, channelId);
}
function toggleShortPlayback() {
    return SegueixApp.features.shorts?.toggleShortPlayback?.();
}
function closeShortModal() {
    return SegueixApp.features.shorts?.closeShortModal?.();
}
function navigateShort(direction) {
    return SegueixApp.features.shorts?.navigateShort?.(direction);
}

// ==================== LIKES (wrappers globals) ====================
// Implementació a js/features/likes.js
function getLikedVideoIds() {
    return SegueixApp.features.likes?.getLikedVideoIds?.() || [];
}
function setLikedVideoIds(ids) {
    return SegueixApp.features.likes?.setLikedVideoIds?.(ids);
}
function getLikedVideos() {
    return SegueixApp.features.likes?.getLikedVideos?.() || [];
}
function setLikedVideos(videos) {
    return SegueixApp.features.likes?.setLikedVideos?.(videos);
}
function isLiked(videoId) {
    return SegueixApp.features.likes?.isLiked?.(videoId) || false;
}
function normalizeLikedVideo(video) {
    return SegueixApp.features.likes?.normalizeLikedVideo?.(video) || null;
}
function toggleLikeVideo(video) {
    return SegueixApp.features.likes?.toggleLikeVideo?.(video) || false;
}
function updateLikeButtonState(button, liked) {
    return SegueixApp.features.likes?.updateLikeButtonState?.(button, liked);
}
function bindLikeButton(container, video) {
    return SegueixApp.features.likes?.bindLikeButton?.(container, video);
}
function setupLikeBadge(videoId) {
    return SegueixApp.features.likes?.setupLikeBadge?.(videoId);
}
const HEART_TOGGLE_SVG = SegueixApp.features.likes?.HEART_TOGGLE_SVG || '';
const PLAYLIST_ICON_SVG = SegueixApp.features.likes?.PLAYLIST_ICON_SVG || '';

// Playlists: CRUD, modal, cua i drag&drop
function getPlaylists() {
    const libraryFeature = SegueixApp.features.library;
    if (libraryFeature && typeof libraryFeature.getPlaylists === 'function') {
        return libraryFeature.getPlaylists();
    }
    return [];
}

function savePlaylists(playlists) {
    const libraryFeature = SegueixApp.features.library;
    if (libraryFeature && typeof libraryFeature.savePlaylists === 'function') {
        return libraryFeature.savePlaylists(playlists);
    }
}

function mergePlaylistVideoSnapshot(baseVideo, resolvedVideo) {
    if (!baseVideo && !resolvedVideo) return null;
    if (!baseVideo) return getPlaylistVideoData(resolvedVideo);
    if (!resolvedVideo) return baseVideo;

    const normalizedResolved = getPlaylistVideoData(resolvedVideo);
    return {
        ...baseVideo,
        ...normalizedResolved,
        id: baseVideo.id || normalizedResolved.id,
        source: baseVideo.source || normalizedResolved.source || 'api',
    };
}

async function hydratePlaylistVideos(videos) {
    if (!Array.isArray(videos) || videos.length === 0) {
        return [];
    }

    const dedupedVideos = [];
    const seenIds = new Set();
    videos.forEach(video => {
        const videoId = String(video?.id || '').trim();
        if (!videoId || seenIds.has(videoId)) {
            return;
        }
        seenIds.add(videoId);
        dedupedVideos.push(video);
    });

    const resolvedById = new Map();
    const cachedSources = [
        ...(Array.isArray(YouTubeAPI?.feedVideos) ? YouTubeAPI.feedVideos : []),
        ...(Array.isArray(cachedAPIVideos) ? cachedAPIVideos : []),
        ...(Array.isArray(window.cachedAPIVideos) ? window.cachedAPIVideos : []),
        ...(Array.isArray(window.VIDEOS) ? window.VIDEOS : []),
    ];

    cachedSources.forEach(video => {
        if (!video?.id) return;
        resolvedById.set(String(video.id), video);
    });

    const channelIds = new Set();
    dedupedVideos.forEach(video => {
        const id = String(video?.id || '');
        const resolved = resolvedById.get(id);
        const knownChannelId = video?.channelId || resolved?.channelId || resolved?.snippet?.channelId;
        if (knownChannelId) {
            channelIds.add(String(knownChannelId));
        }
    });

    if (channelIds.size > 0 && typeof YouTubeAPI?.getChannelVideosWithHistory === 'function') {
        await Promise.all(
            Array.from(channelIds).map(async channelId => {
                const historyVideos = await YouTubeAPI.getChannelVideosWithHistory(channelId);
                historyVideos.forEach(video => {
                    if (!video?.id) return;
                    const key = String(video.id);
                    if (!resolvedById.has(key)) {
                        resolvedById.set(key, video);
                    }
                });
            })
        );
    }

    return dedupedVideos
        .map(video => {
            const resolvedVideo = resolvedById.get(String(video.id));
            return mergePlaylistVideoSnapshot(video, resolvedVideo);
        })
        .filter(Boolean);
}

async function hydrateStoredPlaylist(playlistId) {
    if (!playlistId) return null;

    const playlists = getPlaylists();
    const playlistIndex = playlists.findIndex(item => item.id === playlistId);
    if (playlistIndex === -1) {
        return null;
    }

    const playlist = playlists[playlistIndex];
    const hydratedVideos = await hydratePlaylistVideos(playlist.videos || []);
    const changed = JSON.stringify(playlist.videos || []) !== JSON.stringify(hydratedVideos);
    const hydratedPlaylist = {
        ...playlist,
        videos: hydratedVideos,
    };

    if (changed) {
        playlists[playlistIndex] = hydratedPlaylist;
        savePlaylists(playlists);
    }

    return hydratedPlaylist;
}

function createPlaylist(name, video) {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const playlists = getPlaylists();
    const playlist = {
        id: `pl_${Date.now()}`,
        name: trimmedName,
        videos: [],
    };
    if (video) {
        playlist.videos.push(video);
    }
    playlists.push(playlist);
    savePlaylists(playlists);
}

function addVideoToPlaylist(playlistId, video) {
    const playlists = getPlaylists();
    const playlist = playlists.find(item => item.id === playlistId);
    if (!playlist) return;
    const exists = playlist.videos.some(item => String(item.id) === String(video.id));
    if (!exists) {
        playlist.videos.push(video);
    }
    savePlaylists(playlists);
    if (activePlaylistId === playlistId && isPlaylistMode) {
        activePlaylistQueue = playlist.videos;
        updatePlaylistModeBadge();
        renderPlaylistQueue();
    }
}

function removeVideoFromPlaylist(playlistId, videoId) {
    const playlists = getPlaylists();
    const playlist = playlists.find(item => item.id === playlistId);
    if (!playlist) return;
    const removedIndex = playlist.videos.findIndex(video => String(video.id) === String(videoId));
    playlist.videos = playlist.videos.filter(video => String(video.id) !== String(videoId));
    savePlaylists(playlists);
    if (activePlaylistId === playlistId) {
        activePlaylistQueue = playlist.videos;
        if (removedIndex !== -1) {
            if (removedIndex < currentPlaylistIndex) {
                currentPlaylistIndex = Math.max(currentPlaylistIndex - 1, 0);
            } else if (removedIndex === currentPlaylistIndex) {
                currentPlaylistIndex = Math.min(currentPlaylistIndex, activePlaylistQueue.length - 1);
            }
        }
        if (currentPlaylistIndex >= activePlaylistQueue.length) {
            currentPlaylistIndex = Math.max(activePlaylistQueue.length - 1, 0);
        }
        if (activePlaylistQueue.length === 0) {
            exitPlaylistMode();
        } else {
            updatePlaylistModeBadge();
            renderPlaylistQueue();
        }
    }
}

function reorderPlaylistVideos(playlistId, fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    const playlists = getPlaylists();
    const playlist = playlists.find(item => item.id === playlistId);
    if (!playlist) return;
    const videos = playlist.videos;
    if (!Array.isArray(videos)) return;
    if (fromIndex < 0 || fromIndex >= videos.length || toIndex < 0 || toIndex >= videos.length) {
        return;
    }
    const [moved] = videos.splice(fromIndex, 1);
    videos.splice(toIndex, 0, moved);
    savePlaylists(playlists);
    if (activePlaylistId === playlistId) {
        if (fromIndex === currentPlaylistIndex) {
            currentPlaylistIndex = toIndex;
        } else if (fromIndex < currentPlaylistIndex && toIndex >= currentPlaylistIndex) {
            currentPlaylistIndex = Math.max(currentPlaylistIndex - 1, 0);
        } else if (fromIndex > currentPlaylistIndex && toIndex <= currentPlaylistIndex) {
            currentPlaylistIndex = Math.min(currentPlaylistIndex + 1, videos.length - 1);
        }
        activePlaylistQueue = [...videos];
        updatePlaylistModeBadge();
        renderPlaylistQueue();
    }
}

function removePlaylist(playlistId) {
    const playlists = getPlaylists().filter(item => item.id !== playlistId);
    savePlaylists(playlists);
    if (activePlaylistId === playlistId) {
        exitPlaylistMode();
    }
}

function commitPlaylistRename(playlistId, nextName) {
    const playlists = getPlaylists();
    const playlist = playlists.find(item => item.id === playlistId);
    if (!playlist) return;
    const currentName = String(playlist.name || '').trim();
    const trimmed = String(nextName || '').trim();
    if (!trimmed || trimmed === currentName) return;
    playlist.name = trimmed;
    savePlaylists(playlists);
    if (activePlaylistId === playlistId) {
        activePlaylistName = trimmed;
        updatePlaylistModeBadge();
    }
}

function startPlaylistNameEdit(playlistId) {
    if (!playlistsList) return;
    if (editingPlaylistId && editingPlaylistId !== playlistId) {
        const activeInput = playlistsList.querySelector('.playlist-title-input[data-playlist-id="' + editingPlaylistId + '"]');
        activeInput?.blur();
    }

    const titleRow = playlistsList.querySelector('.playlist-card-title-row[data-playlist-id="' + playlistId + '"]');
    const titleText = titleRow?.querySelector('.playlist-card-title-text');
    if (!titleRow || !titleText) return;

    const currentName = titleText.dataset.playlistName || titleText.textContent || '';
    const safeName = escapeHtml(currentName);
    titleRow.innerHTML = `
        <input
            class="playlist-title-input"
            type="text"
            data-playlist-id="${playlistId}"
            value="${safeName}"
            aria-label="Nom de la llista"
        >
        <button class="btn-round-icon library-edit-btn library-edit-btn--inline"
                type="button"
                data-playlist-id="${playlistId}"
                title="Editar nom de la llista"
                aria-label="Editar nom de la llista">
            <i data-lucide="pencil"></i>
        </button>
    `;

    editingPlaylistId = playlistId;
    refreshIcons(titleRow);

    const input = titleRow.querySelector('.playlist-title-input');
    if (!input) return;

    const finishEdit = () => {
        if (!input.isConnected) return;
        commitPlaylistRename(playlistId, input.value);
        editingPlaylistId = null;
        renderPlaylistsPage();
    };

    input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            input.blur();
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            editingPlaylistId = null;
            renderPlaylistsPage();
        }
    });

    input.addEventListener('blur', finishEdit, { once: true });
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
}

function renamePlaylist(playlistId) {
    startPlaylistNameEdit(playlistId);
}

async function renderPlaylistsPageLegacyImpl() {
    if (!playlistsList) return;
    const storedPlaylists = getPlaylists();
    const playlists = await Promise.all(
        storedPlaylists.map(async playlist => {
            const hydrated = await hydrateStoredPlaylist(playlist.id);
            return hydrated || playlist;
        })
    );

    if (playlists.length === 0) {
        playlistsList.innerHTML = `<div class="playlist-empty">Encara no tens cap llista creada.</div>`;
        return;
    }

    const createPlaylistCard = list => {
        const firstVideo = list.videos[0];
        const thumbnail = firstVideo?.thumbnail || 'img/icon-512.png';
        const videoCount = list.videos.length;
        // Limitar vídeos visibles a 10 per defecte, la resta es pot expandir
        const visibleVideos = list.videos.slice(0, 10);
        const videosMarkup =
            visibleVideos.length > 0
                ? `
                <div class="playlist-video-list" data-playlist-id="${list.id}">
                    ${visibleVideos
                        .map(
                            (video, index) => `
                        <div class="playlist-video-row" draggable="true" data-playlist-id="${list.id}" data-video-index="${index}">
                            <span class="playlist-drag-handle" aria-hidden="true">
                                <i data-lucide="grip-vertical"></i>
                            </span>
                            <img class="playlist-video-thumb" src="${video.thumbnail || 'img/icon-192.png'}" alt="" loading="lazy">
                            <div class="playlist-video-title">${escapeHtml(video.title || 'Vídeo')}</div>
                            <button class="playlist-video-remove" type="button" data-playlist-id="${list.id}" data-video-id="${video.id}" aria-label="Eliminar vídeo">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    `
                        )
                        .join('')}
                </div>
            `
                : `<div class="playlist-video-empty">No hi ha vídeos a la llista.</div>`;
        return `
            <div class="playlist-card">
                <div class="playlist-card-thumb" onclick="startPlaylistPlayback('${list.id}')" title="Reproduir llista">
                    <img src="${thumbnail}" alt="${escapeHtml(list.name)}" loading="lazy">
                    <div class="playlist-play-btn" style="pointer-events:none;">
                        <i data-lucide="play" style="width:16px; height:16px; margin-right:4px;"></i> Reproduir
                    </div>
                    <button class="playlist-delete" type="button" data-playlist-id="${list.id}" aria-label="Esborrar llista" onclick="event.stopPropagation(); removePlaylist('${list.id}'); renderPlaylistsPage();">×</button>
                </div>
                <div class="playlist-card-body">
                    <div class="playlist-card-title-row" data-playlist-id="${list.id}">
                        <div class="playlist-card-title-text" data-playlist-name="${escapeHtml(list.name)}">${escapeHtml(list.name)}</div>
                        <button class="btn-round-icon library-edit-btn library-edit-btn--inline"
                                type="button"
                                onclick="event.stopPropagation(); renamePlaylist('${list.id}')"
                                title="Editar nom de la llista"
                                aria-label="Editar nom de la llista">
                            <i data-lucide="pencil"></i>
                        </button>
                    </div>
                    <button class="btn-round-icon library-share-btn"
                            onclick="event.stopPropagation(); shareSegueixPlaylist('${escapeHtml(list.name)}')"
                            title="Compartir llista">
                        <i data-lucide="share-2"></i>
                    </button>
                    <div class="playlist-card-meta">${videoCount} vídeos</div>
                    ${videosMarkup}
                </div>
            </div>
        `;
    };

    batchRenderCards(playlistsList, playlists, createPlaylistCard, {
        maxVisible: 0,
        onComplete: () => {
            bindPlaylistListInteractions();
            refreshIcons(playlistsList);
        },
    });

    // Primer lot d'icones + interaccions
    bindPlaylistListInteractions();
    requestAnimationFrame(() => refreshIcons(playlistsList));
}

async function renderPlaylistsPage() {
    const libraryFeature = SegueixApp.features.library;
    if (libraryFeature && typeof libraryFeature.renderPlaylistsPage === 'function') {
        return libraryFeature.renderPlaylistsPage();
    }
    return renderPlaylistsPageLegacyImpl();
}

async function renderFollowPage() {
    if (!followGrid) {
        return;
    }

    // Tab de programes
    if (activeFollowTab === 'programes') {
        renderProgramesTab();
        return;
    }

    followGrid.innerHTML = '<div class="empty-state">Carregant canals...</div>';

    const allChannels = Array.isArray(YouTubeAPI?.getAllChannels?.()) ? YouTubeAPI.getAllChannels() : [];

    if (!allChannels.length) {
        followGrid.innerHTML = '<div class="empty-state">No hi ha canals disponibles ara mateix.</div>';
        return;
    }

    const followedIds = new Set(getFollowedChannelIds().map(id => String(id)));
    const channels =
        activeFollowTab === 'following'
            ? allChannels.filter(channel => followedIds.has(String(channel.id)))
            : allChannels;

    if (channels.length === 0) {
        renderFollowEmptyState();
        return;
    }

    const preparedChannels = channels.map(channel => ({
        ...channel,
        name: channel.name || channel.title || '',
    }));
    const withFollowButton = [];
    const withoutFollowButton = [];
    preparedChannels.forEach(channel => {
        if (isMitjansOrDigitalsChannel(channel.id)) {
            withoutFollowButton.push(channel);
        } else {
            withFollowButton.push(channel);
        }
    });
    const byName = (a, b) => a.name.localeCompare(b.name, 'ca', { sensitivity: 'base' });
    withFollowButton.sort(byName);
    withoutFollowButton.sort(byName);
    const orderedChannels = [...withFollowButton, ...withoutFollowButton];

    followGrid.innerHTML = orderedChannels
        .map(channel => {
            const name = channel.name || 'Canal';
            const avatar =
                channel.avatar || channel.thumbnail || getFollowChannelAvatar(channel.id) || 'img/icon-192.png';
            const hasFollowButton = !isMitjansOrDigitalsChannel(channel.id);
            const followButtonHtml = hasFollowButton
                ? `
                <button class="follow-toggle-btn" type="button" data-follow-channel="${channel.id}" aria-pressed="false">
                    Segueix
                </button>
            `
                : '';
            return `
            <div class="follow-card" data-channel-id="${channel.id}">
                <button class="follow-hide-btn" type="button" data-hide-channel="${channel.id}" aria-pressed="false">
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M1.5 12s3.5-7 10.5-7 10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z"></path>
                        <circle cx="12" cy="12" r="3.5"></circle>
                    </svg>
                </button>
                <div class="follow-avatar-wrap">
                    <img class="follow-avatar" src="${avatar}" alt="${escapeHtml(name)}" loading="lazy">
                </div>
                <div class="follow-name">${escapeHtml(name)}</div>
                ${followButtonHtml}
            </div>
        `;
        })
        .join('');

    bindFollowButtons(followGrid);
    bindHideChannelButtons(followGrid);
    _bindFollowGridDelegated();
}

function renderProgramesTab() {
    if (!followGrid) return;
    const programs = getPrograms();
    const allChannels = Array.isArray(YouTubeAPI?.getAllChannels?.()) ? YouTubeAPI.getAllChannels() : [];
    const channelsById = {};
    allChannels.forEach(ch => {
        channelsById[String(ch.id)] = ch;
    });

    // Botó de crear programa
    const createBtnHtml = `
        <div class="follow-card follow-card--create-program" data-action="create-program">
            <div class="follow-avatar-wrap">
                <span style="font-size:2rem;color:var(--color-primary);">+</span>
            </div>
            <div class="follow-name">Crear programa</div>
        </div>
    `;

    if (programs.length === 0) {
        followGrid.innerHTML =
            createBtnHtml +
            '<div class="empty-state" style="grid-column:1/-1;">Encara no has creat cap programa.</div>';
        _bindProgramGridEvents();
        return;
    }

    const cardsHtml = programs
        .map(prog => {
            const channel = channelsById[String(prog.channelId)];
            const avatar = channel?.avatar || channel?.thumbnail || 'img/icon-192.png';
            const name = escapeHtml(prog.name);
            // El botó TV engega la televisió del programa (context-tv.js el captura sol).
            return `
            <div class="follow-card follow-card--program" data-program-id="${prog.id}">
                <button class="program-delete-btn" type="button" data-delete-program="${prog.id}" aria-label="Eliminar programa">Eliminar</button>
                <button class="context-tv-btn context-tv-btn--program-card" type="button"
                    data-context-tv="program" data-context-value="${prog.id}" data-context-name="${name}"
                    aria-label="Veure ${name} com a TV" title="Veure ${name} com a TV">
                    <span aria-hidden="true">TV</span>
                </button>
                <div class="follow-avatar-wrap">
                    <img class="follow-avatar" src="${avatar}" alt="${name}" loading="lazy">
                </div>
                <div class="follow-name">${name}</div>
                <div class="program-badge">${escapeHtml(channel?.name || '')}</div>
            </div>
        `;
        })
        .join('');

    followGrid.innerHTML = createBtnHtml + cardsHtml;
    _bindProgramGridEvents();
}

function _bindProgramGridEvents() {
    if (!followGrid) return;
    // Reset delegated flag per re-bind
    followGrid.dataset.delegated = 'false';
    followGrid.dataset.delegated = 'true';

    // Eliminar listeners anteriors i afegir nous
    const newGrid = followGrid.cloneNode(true);
    followGrid.parentNode.replaceChild(newGrid, followGrid);
    followGrid = newGrid;

    followGrid.addEventListener('click', event => {
        // Botó eliminar programa
        const deleteBtn = event.target.closest('[data-delete-program]');
        if (deleteBtn) {
            event.stopPropagation();
            const progId = deleteBtn.dataset.deleteProgram;
            deleteProgram(progId);
            renderProgramesTab();
            return;
        }
        // Botó crear programa
        const createCard = event.target.closest('[data-action="create-program"]');
        if (createCard) {
            openCreateProgramModal();
            return;
        }
        // Clic a programa
        const programCard = event.target.closest('[data-program-id]');
        if (programCard) {
            openProgramProfile(programCard.dataset.programId);
            return;
        }
        // Clic a canal normal (fallback)
        if (event.target.closest('[data-follow-channel], [data-hide-channel]')) return;
        const card = event.target.closest('.follow-card');
        if (card && card.dataset.channelId) {
            openChannelProfile(card.dataset.channelId);
        }
    });
}

// Listener delegat persistent per followGrid (1 sol listener en lloc de N)
function _bindFollowGridDelegated() {
    if (!followGrid || followGrid.dataset.delegated === 'true') return;
    followGrid.dataset.delegated = 'true';
    followGrid.addEventListener('click', event => {
        if (event.target.closest('[data-follow-channel], [data-hide-channel]')) return;
        const card = event.target.closest('.follow-card');
        if (card) {
            openChannelProfile(card.dataset.channelId);
        }
    });
}

function renderFollowEmptyState() {
    if (!followGrid) {
        return;
    }
    if (activeFollowTab === 'following') {
        followGrid.innerHTML = `
            <div class="empty-state">
                Encara no segueixes cap canal.
                <button class="follow-empty-link" type="button" data-follow-tab-link="all">Veure tots els canals</button>
            </div>
        `;
        const link = followGrid.querySelector('[data-follow-tab-link="all"]');
        if (link) {
            link.addEventListener('click', event => {
                event.preventDefault();
                setActiveFollowTab('all');
            });
        }
    } else {
        followGrid.innerHTML = '<div class="empty-state">No hi ha canals disponibles ara mateix.</div>';
    }
}

function setActiveFollowTab(tabId) {
    activeFollowTab = tabId;
    if (followTabs) {
        followTabs.querySelectorAll('.follow-tab').forEach(tab => {
            const isActive = tab.dataset.followTab === activeFollowTab;
            tab.classList.toggle('is-active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
    }
    renderFollowPage();
}

function playPlaylist(playlistId) {
    startPlaylistPlayback(playlistId);
}

async function startPlaylistPlayback(playlistId) {
    const playlist = await hydrateStoredPlaylist(playlistId);
    if (!playlist || !Array.isArray(playlist.videos) || playlist.videos.length === 0) {
        return;
    }
    isPlaylistMode = true;
    activePlaylistQueue = [...playlist.videos];
    currentPlaylistIndex = 0;
    activePlaylistId = playlist.id;
    activePlaylistName = playlist.name || 'Llista';
    loadVideoInSequence();
}

function loadVideoInSequence({ autoPlay = true } = {}) {
    if (!activePlaylistQueue.length || currentPlaylistIndex >= activePlaylistQueue.length) {
        exitPlaylistMode();
        return;
    }
    const video = activePlaylistQueue[currentPlaylistIndex];
    if (!video) {
        exitPlaylistMode();
        return;
    }
    isPlaylistMode = true;
    // En TV la vista queda ancorada a dalt —mai flotant— fins que el vídeo nou arrenca.
    focusTVPlayerViewport();
    // Si s'està mirant en pantalla completa, el vídeo següent hi continua: el reproductor
    // no es recrea, se li demana el vídeo nou (veure swapLivePlayerVideo).
    const keepLivePlayer = video.source !== 'static' && isTVPlaybackMode() && canSwapLivePlayerVideo();
    lastTVAdvanceAt = Date.now();
    // Per defecte les cues continuen amb autoplay. Algunes entrades (TV de categoria
    // i Segueix TV des del xip) poden demanar que només el primer vídeo quedi en pausa.
    isAutoPlayNavigating = autoPlay;
    updatePlaylistModeBadge();
    syncQueueNextOverlay();
    isPlaylistNavigation = true;
    if (video.isShort) {
        openShortModal(video.id);
        isPlaylistNavigation = false;
        return;
    }
    if (video.source === 'static') {
        showVideo(video.id);
    } else {
        showVideoFromAPI(video.id, keepLivePlayer ? { keepLivePlayer: true } : {});
    }
    isPlaylistNavigation = false;
}

function handlePlaylistVideoEnded() {
    if (!isPlaylistMode || activePlaylistQueue.length === 0) {
        return;
    }
    if (currentPlaylistIndex < activePlaylistQueue.length - 1) {
        currentPlaylistIndex += 1;
        loadVideoInSequence();
    } else {
        exitPlaylistMode({ showQueueMessage: true });
    }
}

let queueNextOverlayHideTimer = null;
let queueNextOverlayObserver = null;
let queueNextOverlaySyncFrame = null;

function hasQueueNextVideo() {
    if (!isPlaylistMode || !Array.isArray(activePlaylistQueue) || activePlaylistQueue.length < 2) {
        return false;
    }
    if (currentPlaylistIndex < 0 || currentPlaylistIndex >= activePlaylistQueue.length - 1) {
        return false;
    }
    const currentVideo = activePlaylistQueue[currentPlaylistIndex];
    return Boolean(currentVideo && !currentVideo.isShort);
}

function hasQueuePrevVideo() {
    if (!isPlaylistMode || !Array.isArray(activePlaylistQueue) || activePlaylistQueue.length < 2) {
        return false;
    }
    if (currentPlaylistIndex <= 0 || currentPlaylistIndex >= activePlaylistQueue.length) {
        return false;
    }
    const currentVideo = activePlaylistQueue[currentPlaylistIndex];
    return Boolean(currentVideo && !currentVideo.isShort);
}

// Hi ha algun control (anterior o següent) per mostrar sobre el reproductor.
function hasQueueNavigation() {
    return hasQueueNextVideo() || hasQueuePrevVideo();
}

// Mostra només els botons que tenen sentit (a la primera cançó no hi ha "anterior", a l'última no hi ha "següent").
function updateQueueOverlayButtons(overlay) {
    if (!overlay) return;
    const next = overlay.querySelector('.queue-next-button');
    const prev = overlay.querySelector('.queue-prev-button');
    if (next) next.hidden = !hasQueueNextVideo();
    if (prev) prev.hidden = !hasQueuePrevVideo();
}

function getQueueNextOverlay() {
    return videoPlayer?.querySelector('.queue-next-overlay') || null;
}

function clearQueueNextOverlayTimer() {
    if (!queueNextOverlayHideTimer) return;
    clearTimeout(queueNextOverlayHideTimer);
    queueNextOverlayHideTimer = null;
}

function hideQueueNextOverlay({ remove = false } = {}) {
    clearQueueNextOverlayTimer();
    const overlay = getQueueNextOverlay();
    if (!overlay) return;
    if (remove) {
        overlay.remove();
        return;
    }
    overlay.classList.remove('is-visible');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.querySelectorAll('.queue-next-button, .queue-prev-button').forEach(button => {
        button.tabIndex = -1;
    });
}

function isQueuePlayerPaused() {
    return videoPlayer?.dataset?.playerState === '2';
}

function showQueueNextOverlay({ duration = 3000 } = {}) {
    syncQueueNextOverlay();
    const overlay = getQueueNextOverlay();
    if (!overlay || !hasQueueNavigation()) return;

    clearQueueNextOverlayTimer();
    updateQueueOverlayButtons(overlay);
    overlay.classList.add('is-visible');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.querySelectorAll('.queue-next-button, .queue-prev-button').forEach(button => {
        button.tabIndex = 0;
    });

    // En pausa el control de següent queda sempre visible, com els controls del player.
    if (isQueuePlayerPaused()) return;

    queueNextOverlayHideTimer = setTimeout(() => {
        hideQueueNextOverlay();
    }, duration);
}

function advanceQueueFromOverlay(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (!hasQueueNextVideo()) {
        syncQueueNextOverlay();
        return;
    }

    currentPlaylistIndex += 1;
    hideQueueNextOverlay({ remove: true });
    loadVideoInSequence();
}

function goToPreviousFromOverlay(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (!hasQueuePrevVideo()) {
        syncQueueNextOverlay();
        return;
    }

    currentPlaylistIndex -= 1;
    hideQueueNextOverlay({ remove: true });
    loadVideoInSequence();
}

function createQueueNextOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'queue-next-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
        <div class="queue-next-touch-layer" aria-hidden="true"></div>
        <button class="queue-prev-button" type="button" aria-label="Vídeo anterior" title="Vídeo anterior" tabindex="-1">
            <span class="queue-prev-icon" aria-hidden="true"></span>
        </button>
        <button class="queue-next-button" type="button" aria-label="Vídeo següent" title="Vídeo següent" tabindex="-1">
            <span class="queue-next-icon" aria-hidden="true"></span>
        </button>
    `;

    const touchLayer = overlay.querySelector('.queue-next-touch-layer');
    touchLayer?.addEventListener('pointerdown', event => {
        event.preventDefault();
        event.stopPropagation();
        showQueueNextOverlay({ duration: 3000 });
    });

    overlay.querySelector('.queue-next-button')?.addEventListener('click', advanceQueueFromOverlay);
    overlay.querySelector('.queue-prev-button')?.addEventListener('click', goToPreviousFromOverlay);
    updateQueueOverlayButtons(overlay);
    return overlay;
}

function syncQueueNextOverlay() {
    if (!videoPlayer) return;

    if (!hasQueueNavigation()) {
        hideQueueNextOverlay({ remove: true });
        return;
    }

    if (!getQueueNextOverlay()) {
        videoPlayer.appendChild(createQueueNextOverlay());
    }
    updateQueueOverlayButtons(getQueueNextOverlay());
}

function scheduleQueueNextOverlaySync() {
    if (queueNextOverlaySyncFrame) return;
    queueNextOverlaySyncFrame = requestAnimationFrame(() => {
        queueNextOverlaySyncFrame = null;
        syncQueueNextOverlay();
    });
}

function initQueueNextOverlay() {
    if (!videoPlayer || queueNextOverlayObserver) return;

    queueNextOverlayObserver = new MutationObserver(scheduleQueueNextOverlaySync);
    queueNextOverlayObserver.observe(videoPlayer, { childList: true });

    videoPlayer.addEventListener('pointerenter', event => {
        if (event.pointerType === 'mouse' && hasQueueNavigation()) {
            showQueueNextOverlay({ duration: 10000 });
        }
    });

    videoPlayer.addEventListener('pointermove', event => {
        if (event.pointerType === 'mouse' && hasQueueNavigation()) {
            showQueueNextOverlay({ duration: 10000 });
        }
    });

    videoPlayer.addEventListener('focusin', event => {
        if (event.target?.closest?.('.queue-next-button, .queue-prev-button')) {
            showQueueNextOverlay({ duration: 10000 });
        }
    });

    syncQueueNextOverlay();
}

async function regenerateActiveTV(button) {
    if (!button || button.disabled) return;
    button.disabled = true;
    button.classList.add('is-refreshing');
    button.setAttribute('aria-busy', 'true');

    try {
        if (document.body.classList.contains('segueix-tv-active')) {
            await SegueixApp.features.segueixTV?.regeneratePlayback?.();
        } else {
            await SegueixApp.features.contextTV?.regenerateCurrentTV?.();
        }
    } catch (error) {
        console.warn('No s’ha pogut regenerar la TV:', error);
    } finally {
        button.disabled = false;
        button.classList.remove('is-refreshing');
        button.setAttribute('aria-busy', 'false');
    }
}

function createTVAlgorithmInfo() {
    const wrap = document.createElement('span');
    wrap.className = 'tv-algorithm-info-wrap';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tv-algorithm-info-button';
    button.setAttribute('aria-label', 'Com es crea aquesta TV?');
    button.setAttribute('title', 'Com es crea aquesta TV?');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<i data-lucide="info" aria-hidden="true"></i>';

    const summary = SegueixApp.features.tvLearning?.getSummary?.() || {};
    const samples = Math.max(0, Number(summary.samples) || 0);
    const learningState = samples >= 3
        ? `Ja hi ha <strong>${samples}</strong> reproduccions útils per personalitzar aquesta TV en aquest dispositiu.`
        : `L'aprenentatge personal començarà a influir després d'unes poques reproduccions completes o salts. Ara hi ha <strong>${samples}</strong> mostres útils.`;

    const popover = document.createElement('div');
    popover.className = 'radar-info-popover tv-algorithm-info-popover';
    popover.id = 'tvAlgorithmInfoPopover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'Com es crea una TV');
    popover.hidden = true;
    popover.innerHTML = `
        <button type="button" class="chip-info-popover-close" aria-label="Tancar">×</button>
        <h3>Com es crea una TV?</h3>
        <p><strong>1. Selecció inicial.</strong> Segueix TV busca vídeos llargs de creadors que encara no segueixes, evita canals amagats o exclosos de descoberta i combina el feed actual amb l'arxiu. Normalment exclou Shorts i vídeos de menys de 3 minuts. Les TV de categoria, canal o programa parteixen del context que has triat.</p>
        <p><strong>2. Qualitat del vídeo.</strong> No es premien només les visualitzacions totals: es compara cada vídeo amb el rendiment habitual del seu propi canal. També compten la taxa de m'agrada i comentaris per visualització, la velocitat de creixement, la recència i una prima suau quan YouTube identifica explícitament el català.</p>
        <p><strong>3. Afinitat personal.</strong> Els ❤️, les categories dels creadors que segueixes i les paraules de títols, etiquetes i descripcions que coincideixen amb contingut que t'ha agradat poden pujar la puntuació.</p>
        <p><strong>4. Aprenentatge local.</strong> Segueix aprèn del percentatge que mires: acabar aproximadament un 85% és un senyal fortament positiu; 60–85% és positiu; 35–60% és lleugerament positiu; saltar abans del 20% és negatiu; i prémer “següent” abans del 15% o dels primers 45 segons és un senyal negatiu fort. Només compta el temps amb la pàgina visible. Aprèn temes, categories i durades preferides. <strong>Aquest perfil queda només al teu dispositiu i no s'envia a cap servidor.</strong></p>
        <p><strong>5. TV viva.</strong> Durant la mateixa sessió es crea una intenció temporal més reactiva que el perfil històric. Quan acabes o saltes vídeos, Segueix pot reordenar la part futura de la cua immediatament. <strong>Mai canvia el vídeo actual ni “A continuació”</strong>: només adapta des del tercer vídeo en endavant. Aquesta intenció temporal perd força gradualment, amb una semivida aproximada de 45 minuts.</p>
        <p><strong>6. Ordre de la cua.</strong> Cada pas puntua també la transició: semblança temàtica amb el vídeo anterior, canvi de durada després de vídeos llargs i diversitat recent. La reordenació viva evita encadenar massa vídeos molt semblants i manté les restriccions de la TV original: una TV de categoria continua dins la categoria i una TV de canal o programa continua dins aquell canal o programa.</p>
        <p><strong>7. Descoberta.</strong> Aproximadament una de cada quatre posicions de Segueix TV ignora el perfil temporal de la sessió perquè continuïs descobrint contingut fora del que estàs mirant en aquell moment. També hi ha una variació controlada perquè regenerar la TV no produeixi sempre exactament la mateixa cua.</p>
        <p><strong>8. Vídeos ja vistos i regeneració.</strong> Els vídeos ja vistos reben una penalització. En regenerar, si hi ha prou alternatives, es procura evitar els canals de la programació anterior. Segueix TV també reserva aproximadament cada cinquena posició per donar espai a canals petits. En mode bucle, en acabar la cua la reproducció torna al principi.</p>
        <p class="tv-algorithm-learning-state">${learningState}</p>
    `;

    const close = () => {
        popover.hidden = true;
        button.setAttribute('aria-expanded', 'false');
    };
    const open = () => {
        popover.hidden = false;
        button.setAttribute('aria-expanded', 'true');
    };

    button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (popover.hidden) open();
        else close();
    });
    popover.querySelector('.chip-info-popover-close')?.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        close();
        button.focus();
    });
    popover.addEventListener('click', event => event.stopPropagation());

    wrap.append(button, popover);
    return wrap;
}

function updatePlaylistModeBadge() {
    const container = document.querySelector('.video-info');
    if (!container) {
        return;
    }
    const existing = document.getElementById('playlistModeBadge');
    if (!isPlaylistMode) {
        existing?.remove();
        return;
    }

    const badge = existing || document.createElement('div');
    badge.id = 'playlistModeBadge';
    badge.className = 'playlist-mode-badge';

    const position = activePlaylistQueue.length > 0 ? `${currentPlaylistIndex + 1}/${activePlaylistQueue.length}` : '';
    const isTVMode =
        activePlaylistId === '__segueix_tv_discovery__' &&
        document.body.classList.contains('segueix-tv-playback');

    badge.innerHTML = '';

    const label = document.createElement('span');
    label.className = 'playlist-mode-badge-label';
    label.textContent = `${isTVMode ? 'Mode bucle' : 'Mode llista'} · ${activePlaylistName} ${position}`.trim();
    badge.appendChild(label);

    if (isTVMode) {
        badge.appendChild(createTVAlgorithmInfo());

        const regenerateButton = document.createElement('button');
        regenerateButton.type = 'button';
        regenerateButton.className = 'tv-regenerate-button';
        regenerateButton.setAttribute('aria-label', 'Regenera aquesta TV');
        regenerateButton.setAttribute('title', 'Regenera aquesta TV');
        regenerateButton.innerHTML = '<i data-lucide="refresh-cw" aria-hidden="true"></i>';
        regenerateButton.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            regenerateActiveTV(regenerateButton);
        });
        badge.appendChild(regenerateButton);
    }

    if (!existing) {
        container.insertBefore(badge, container.firstChild);
    }
    refreshIcons(badge);
}
function exitPlaylistMode({ showQueueMessage = false } = {}) {
    stopTVViewportHold();
    isPlaylistMode = false;
    activePlaylistQueue = [];
    currentPlaylistIndex = 0;
    activePlaylistId = null;
    activePlaylistName = '';
    updatePlaylistModeBadge();
    syncQueueNextOverlay();
    const queueContainer = document.getElementById('playlistQueueContainer');
    const relatedContainer = document.getElementById('relatedVideos');

    if (queueContainer) {
        if (showQueueMessage) {
            queueContainer.innerHTML = '<div class="playlist-queue-title">No hi ha més vídeos en aquesta llista</div>';
            queueContainer.classList.remove('hidden');
        } else {
            queueContainer.innerHTML = '';
            queueContainer.classList.add('hidden');
        }
    }
    if (relatedContainer) {
        relatedContainer.style.display = 'block';
    }
}

function openPlaylistModal(video) {
    if (!playlistModal || !playlistModalBody) return;
    activePlaylistVideo = video;
    // Mostrar modal immediatament, diferir el renderitzat del contingut
    playlistModal.classList.remove('hidden');
    playlistModal.setAttribute('aria-hidden', 'false');
    lockBodyScroll();
    requestAnimationFrame(() => renderPlaylistModal());
}

function closePlaylistModal() {
    if (!playlistModal) return;
    playlistModal.classList.add('hidden');
    playlistModal.setAttribute('aria-hidden', 'true');
    unlockBodyScroll();
    activePlaylistVideo = null;
}

function renderPlaylistModal() {
    if (!playlistModalBody) return;
    const playlists = getPlaylists();

    const listSection =
        playlists.length > 0
            ? `
            <div class="playlist-modal-buttons">
                ${playlists
                    .map(
                        list => `
                    <button class="playlist-select-btn" type="button" data-playlist-id="${list.id}">
                        <span>${escapeHtml(list.name)}</span>
                        <span class="playlist-count-badge">${list.videos.length} vídeos</span>
                    </button>
                `
                    )
                    .join('')}
            </div>
        `
            : `<p class="modal-description" style="text-align:center; opacity:0.7;">No tens llistes creades.</p>`;

    playlistModalBody.innerHTML = `
        ${listSection}
        <div class="playlist-modal-create" style="margin-top:15px; padding-top:15px; border-top:1px solid rgba(255,255,255,0.1); display:flex; gap:10px;">
            <input class="playlist-input" type="text" id="playlistModalInput" placeholder="Nom nova llista..." autocomplete="off">
            <button class="playlist-create-btn" type="button" id="playlistModalCreateBtn">
                <span class="playlist-create-plus">+</span>
            </button>
        </div>
    `;

    playlistModalBody.querySelectorAll('.playlist-select-btn').forEach(button => {
        button.addEventListener('click', () => {
            if (activePlaylistVideo) {
                addVideoToPlaylist(button.dataset.playlistId, activePlaylistVideo);
                renderPlaylistsPage();
            }
            closePlaylistModal();
        });
    });

    const modalInput = playlistModalBody.querySelector('#playlistModalInput');
    const modalCreateBtn = playlistModalBody.querySelector('#playlistModalCreateBtn');
    const createAction = () => {
        const name = modalInput?.value?.trim();
        if (!name || !activePlaylistVideo) return;
        createPlaylist(name, activePlaylistVideo);
        renderPlaylistsPage();
        closePlaylistModal();
    };

    if (modalCreateBtn) modalCreateBtn.addEventListener('click', createAction);
    if (modalInput) {
        modalInput.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                createAction();
            }
        });
    }

    refreshIcons(playlistModalBody);
}

function getPlaylistVideoDataLegacyImpl(video) {
    const source = video.historySource || (video.videoUrl ? 'static' : 'api');
    return {
        id: video.id,
        title: video.title || video.snippet?.title || '',
        thumbnail: getPreferredThumbnail(video),
        channelTitle: video.channelTitle || video.snippet?.channelTitle || '',
        channelId: video.channelId || video.snippet?.channelId || '',
        duration: video.duration || video.contentDetails?.duration || '',
        source,
    };
}

function getPlaylistVideoData(video) {
    const libraryFeature = SegueixApp.features.library;
    if (libraryFeature && typeof libraryFeature.getPlaylistVideoData === 'function') {
        return libraryFeature.getPlaylistVideoData(video);
    }
    return getPlaylistVideoDataLegacyImpl(video);
}

function setupVideoCardActionButtons(container) {
    const root = container || document;
    root.querySelectorAll('.video-card .playlist-action').forEach(button => {
        if (button.dataset.actionBound === 'true') return;
        button.dataset.actionBound = 'true';
        button.addEventListener('click', event => {
            event.stopPropagation();
            const payload = button.dataset.playlistVideo;
            if (!payload) return;
            const video = JSON.parse(decodeURIComponent(payload));
            openPlaylistModal(video);
        });
    });

    root.querySelectorAll('.video-card .like-action').forEach(button => {
        if (button.dataset.likeBound === 'true') return;
        button.dataset.likeBound = 'true';
        button.addEventListener('click', event => {
            event.stopPropagation();
            const videoId = String(button.dataset.videoId || '');
            if (!videoId) return;
            let likeVideo = { id: videoId };
            if (button.dataset.likeVideo) {
                try {
                    likeVideo = JSON.parse(decodeURIComponent(button.dataset.likeVideo));
                } catch (error) {
                    console.warn('No es pot llegir el vídeo preferit', error);
                }
            }
            const nowLiked = toggleLikeVideo(likeVideo);
            button.classList.toggle('is-liked', nowLiked);
            button.setAttribute('aria-pressed', nowLiked ? 'true' : 'false');
        });
    });
}

// Delegació d'events per video cards — 1 listener en lloc de N per targeta
function setupDelegatedVideoCardClicks(container, defaultSource) {
    if (!container || container._videoCardDelegated) return;
    container._videoCardDelegated = true;
    container.addEventListener('click', e => {
        // Ignorar clics en accions (playlist, like, channel-link, etc.)
        if (
            e.target.closest(
                '.playlist-action, .like-action, .channel-link, [data-follow-channel], .archive-playlist-action, .delete-history-btn, [data-share-channel-id]'
            )
        )
            return;
        const card = e.target.closest('.video-card, .archive-video-card');
        if (!card) return;
        const videoId = card.dataset.videoId;
        if (!videoId) return;
        const source = card.dataset.videoSource || defaultSource;
        if (source === 'static') {
            playThenNavigate(videoId, 'static');
        } else {
            playThenNavigate(videoId, source || 'api');
        }
    });
}

// Reproductor principal, mini-player i control d'iframe
function isMiniPlayerActive() {
    return videoPlayer?.classList.contains('mini-player-active');
}

function setPlaceholderImage(thumbnail, title = '') {
    if (!placeholderImage) {
        return;
    }
    placeholderImage.src = thumbnail || '';
    placeholderImage.alt = title || '';
}

function setVideoTitleText(title) {
    const titleElement = document.getElementById('videoTitle');
    if (!titleElement) {
        return;
    }
    titleElement.textContent = title || '';
    updatePlaylistModeBadge();
}

function renderPlaylistQueue() {
    const queueContainer = document.getElementById('playlistQueueContainer');
    const relatedContainer = document.getElementById('relatedVideos');

    if (relatedContainer && window.innerWidth > 1024) {
        relatedContainer.style.display = 'block';
    }

    if (!queueContainer) return;

    if (!isPlaylistMode || activePlaylistQueue.length === 0) {
        queueContainer.classList.add('hidden');
        return;
    }

    queueContainer.classList.remove('hidden');

    // Cua estil Spotify (Ara sona / A continuació, reordenable): js/features/music-queue.js
    if (SegueixApp.features.musicQueue?.render?.(queueContainer)) {
        refreshIcons(queueContainer);
        return;
    }

    queueContainer.innerHTML = `
        <div class="playlist-queue-title">
            <span>Reprodueix: ${escapeHtml(activePlaylistName)}</span>
            <span style="font-size:0.85rem; opacity:0.7;">${currentPlaylistIndex + 1} / ${activePlaylistQueue.length}</span>
        </div>
        <div class="playlist-queue-list" data-playlist-id="${activePlaylistId}">
            ${activePlaylistQueue
                .map((video, index) => {
                    const isActive = index === currentPlaylistIndex;
                    return `
                <div class="playlist-queue-item${isActive ? ' is-active' : ''}" draggable="true"
                     data-playlist-index="${index}" onclick="playVideoFromPlaylistIndex(${index})">
                    <div class="playlist-queue-handle" aria-hidden="true">
                        <i data-lucide="grip-vertical"></i>
                    </div>
                    <div style="position:relative; flex-shrink:0;">
                        <img src="${video.thumbnail || 'img/icon-192.png'}" alt="">
                        ${isActive ? '<div style="position:absolute; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center;"><i data-lucide="bar-chart-2" style="color:white;"></i></div>' : ''}
                    </div>
                    <div class="playlist-queue-meta">
                        <div style="font-weight:600; font-size:0.9rem; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${escapeHtml(video.title)}
                        </div>
                        <div style="font-size:0.75rem; color:var(--color-text-secondary);">
                            ${escapeHtml(video.channelTitle || '')}
                        </div>
                    </div>
                    <div class="playlist-queue-actions">
                        <button class="playlist-queue-remove" type="button" data-video-id="${video.id}" aria-label="Eliminar vídeo">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>
            `;
                })
                .join('')}
        </div>
    `;

    bindPlaylistQueueInteractions();
    const activeItem = queueContainer.querySelector('.is-active');
    // La cua de TV no ha de desplaçar la pàgina ni arrossegar el reproductor.
    if (activeItem && activePlaylistId !== '__segueix_tv_discovery__') {
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    refreshIcons(queueContainer);
}

function playVideoFromPlaylistIndex(index) {
    if (index >= 0 && index < activePlaylistQueue.length) {
        currentPlaylistIndex = index;
        loadVideoInSequence();
    }
}

function bindPlaylistListInteractions() {
    if (!playlistsList || isPlaylistListBound) return;

    playlistsList.addEventListener('click', event => {
        const removeButton = event.target.closest('.playlist-video-remove');
        if (!removeButton) return;
        event.stopPropagation();
        removeVideoFromPlaylist(removeButton.dataset.playlistId, removeButton.dataset.videoId);
        renderPlaylistsPage();
    });

    playlistsList.addEventListener('dragstart', event => {
        const row = event.target.closest('.playlist-video-row');
        if (!row) return;
        playlistDragState = {
            playlistId: row.dataset.playlistId,
            fromIndex: Number(row.dataset.videoIndex),
        };
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', row.dataset.videoIndex);
        row.classList.add('is-dragging');
    });

    playlistsList.addEventListener('dragover', event => {
        const row = event.target.closest('.playlist-video-row');
        if (!row || !playlistDragState) return;
        if (row.dataset.playlistId !== playlistDragState.playlistId) return;
        event.preventDefault();
        row.classList.add('is-drag-over');
    });

    playlistsList.addEventListener('dragleave', event => {
        const row = event.target.closest('.playlist-video-row');
        if (row) row.classList.remove('is-drag-over');
    });

    playlistsList.addEventListener('drop', event => {
        const row = event.target.closest('.playlist-video-row');
        if (!row || !playlistDragState) return;
        if (row.dataset.playlistId !== playlistDragState.playlistId) return;
        event.preventDefault();
        row.classList.remove('is-drag-over');
        const toIndex = Number(row.dataset.videoIndex);
        reorderPlaylistVideos(playlistDragState.playlistId, playlistDragState.fromIndex, toIndex);
        playlistDragState = null;
        renderPlaylistsPage();
    });

    playlistsList.addEventListener('dragend', event => {
        const row = event.target.closest('.playlist-video-row');
        if (row) row.classList.remove('is-dragging');
        playlistsList
            .querySelectorAll('.playlist-video-row.is-drag-over')
            .forEach(item => item.classList.remove('is-drag-over'));
        playlistDragState = null;
    });

    isPlaylistListBound = true;
}

function bindPlaylistQueueInteractions() {
    const queueContainer = document.getElementById('playlistQueueContainer');
    if (!queueContainer || isPlaylistQueueBound) return;

    queueContainer.addEventListener(
        'click',
        event => {
            const removeButton = event.target.closest('.playlist-queue-remove');
            if (!removeButton) return;
            event.preventDefault();
            event.stopPropagation();
            if (!activePlaylistId) return;
            removeVideoFromPlaylist(activePlaylistId, removeButton.dataset.videoId);
        },
        true
    );

    queueContainer.addEventListener('dragstart', event => {
        const item = event.target.closest('.playlist-queue-item');
        if (!item) return;
        const list = queueContainer.querySelector('.playlist-queue-list');
        if (!list) return;
        playlistQueueDragState = {
            playlistId: list.dataset.playlistId,
            fromIndex: Number(item.dataset.playlistIndex),
        };
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', item.dataset.playlistIndex);
        item.classList.add('is-dragging');
    });

    queueContainer.addEventListener('dragover', event => {
        const item = event.target.closest('.playlist-queue-item');
        if (!item || !playlistQueueDragState) return;
        event.preventDefault();
        item.classList.add('is-drag-over');
    });

    queueContainer.addEventListener('dragleave', event => {
        const item = event.target.closest('.playlist-queue-item');
        if (item) item.classList.remove('is-drag-over');
    });

    queueContainer.addEventListener('drop', event => {
        const item = event.target.closest('.playlist-queue-item');
        if (!item || !playlistQueueDragState) return;
        event.preventDefault();
        item.classList.remove('is-drag-over');
        const toIndex = Number(item.dataset.playlistIndex);
        reorderPlaylistVideos(playlistQueueDragState.playlistId, playlistQueueDragState.fromIndex, toIndex);
        playlistQueueDragState = null;
    });

    queueContainer.addEventListener('dragend', event => {
        const item = event.target.closest('.playlist-queue-item');
        if (item) item.classList.remove('is-dragging');
        queueContainer
            .querySelectorAll('.playlist-queue-item.is-drag-over')
            .forEach(row => row.classList.remove('is-drag-over'));
        playlistQueueDragState = null;
    });

    isPlaylistQueueBound = true;
}

let _lastPlayerRect = { top: 0, left: 0, width: 0, height: 0 };
let _playerLayoutObserved = false;
function updatePlayerPosition() {
    if (!videoPlayer || !videoPlaceholder) {
        return;
    }
    if (isMiniPlayerActive()) {
        return;
    }
    // En pantalla completa la mida i la posició les governa el navegador.
    if (isPlayerFullscreen()) {
        return;
    }
    if (videoPlaceholder.classList.contains('hidden')) {
        return;
    }

    const rect = videoPlaceholder.getBoundingClientRect();
    const top = Math.round(rect.top + window.scrollY);
    const left = Math.round(rect.left + window.scrollX);
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);

    // Si el placeholder encara no té dimensions (race de layout), reintentar al següent frame
    if (width <= 0 || height <= 0) {
        requestAnimationFrame(updatePlayerPosition);
        return;
    }

    // Evitar escriptures d'estil si la posició no ha canviat
    if (
        _lastPlayerRect.top === top &&
        _lastPlayerRect.left === left &&
        _lastPlayerRect.width === width &&
        _lastPlayerRect.height === height
    ) {
        return;
    }
    _lastPlayerRect = { top, left, width, height };

    videoPlayer.style.top = `${top}px`;
    videoPlayer.style.left = `${left}px`;
    videoPlayer.style.width = `${width}px`;
    videoPlayer.style.height = `${height}px`;
}

// El reproductor és un element posicionat a mà damunt del seu forat (#videoPlaceholder),
// i fins ara només es reposicionava en fer scroll o resize. En obrir la pàgina del vídeo
// al mòbil, la filera d'icones del header es col·lapsa amb una transició CSS: el forat
// puja mentre la transició avança, el reproductor es queda on era i acaba surant per
// damunt del títol fins que l'usuari fa scroll. Amb un ResizeObserver sobre el forat i el
// header, i escoltant el final de la transició, el reproductor segueix qualsevol canvi de
// layout (icones tardanes, fonts, barra d'URL del mòbil...).
function observePlayerLayoutShifts() {
    if (!videoPlaceholder || _playerLayoutObserved) {
        return;
    }
    _playerLayoutObserved = true;

    const resync = () => {
        if (isMiniPlayerActive()) return;
        // Es força el recàlcul: el forat pot haver-se mogut sense canviar de mida.
        _lastPlayerRect = { top: 0, left: 0, width: 0, height: 0 };
        updatePlayerPosition();
    };

    if (typeof ResizeObserver === 'function') {
        const observer = new ResizeObserver(() => requestAnimationFrame(resync));
        observer.observe(videoPlaceholder);
        const header = document.querySelector('.app-header');
        if (header) observer.observe(header);
        const main = document.querySelector('#watchPage .watch-main');
        if (main) observer.observe(main);
    }

    const header = document.querySelector('.app-header');
    if (header) {
        header.addEventListener('transitionend', () => requestAnimationFrame(resync));
    }
}

// ==================== EXPERIÈNCIA TV: LA VISTA SEMPRE AL REPRODUCTOR ====================
// Les tres TV (Segueix TV, TV de categoria i TV de canal) comparteixen la cua
// `__segueix_tv_discovery__` i s'han de comportar com un televisor: en engegar-les i a
// cada canvi automàtic de vídeo, la imatge ha de quedar a la part superior i mai en
// finestreta flotant. El reproductor no viu dins del flux —és un element posicionat
// damunt del seu forat (#videoPlaceholder)—, de manera que mentre el layout s'assenta
// (la transició de 280 ms que col·lapsa la filera d'icones al mòbil, la cua que es torna
// a pintar, el títol que canvia d'alçada) es quedava desplaçat i semblava surar per
// damunt del header. Per això l'ancoratge fa dues coses a cada frame mentre dura la
// transició: mantenir la pàgina a dalt i tornar a enganxar el reproductor al seu forat.
// S'allibera quan el vídeo nou arrenca (estat 1 de l'API de YouTube), si l'usuari fa un
// gest d'scroll o si s'exhaureix l'espera.
const TV_DISCOVERY_PLAYLIST_ID = '__segueix_tv_discovery__';
// Marge màxim d'espera perquè el vídeo nou comenci a reproduir-se.
const TV_VIEWPORT_HOLD_TIMEOUT = 8000;
// Un cop alliberat l'ancoratge, el reproductor encara segueix el forat una estona: just
// després que el vídeo arrenqui, el header o les imatges tardanes encara el poden moure.
const TV_VIEWPORT_SETTLE_MS = 900;
let tvViewportHoldUntil = 0;
let tvViewportSettleUntil = 0;
let tvViewportRaf = null;
let tvViewportGesturesBound = false;

function isTVPlaybackMode() {
    return Boolean(isPlaylistMode && activePlaylistId === TV_DISCOVERY_PLAYLIST_ID);
}

function releaseTVViewportHold({ settle = true } = {}) {
    if (!tvViewportHoldUntil) {
        return;
    }
    tvViewportHoldUntil = 0;
    tvViewportSettleUntil = settle ? Date.now() + TV_VIEWPORT_SETTLE_MS : 0;
}

function stopTVViewportHold() {
    if (tvViewportRaf) {
        cancelAnimationFrame(tvViewportRaf);
    }
    tvViewportRaf = null;
    tvViewportHoldUntil = 0;
    tvViewportSettleUntil = 0;
}

// Qualsevol gest d'scroll mana per damunt de l'ancoratge: si l'usuari baixa a mirar la
// programació mentre carrega el vídeo següent, no se l'ha de tornar a pujar.
function bindTVViewportGestures() {
    if (tvViewportGesturesBound) {
        return;
    }
    tvViewportGesturesBound = true;
    const release = () => releaseTVViewportHold();
    ['wheel', 'touchmove', 'keydown'].forEach(type => {
        window.addEventListener(type, release, { passive: true, capture: true });
    });
}

function runTVViewportFrame() {
    tvViewportRaf = null;
    const now = Date.now();
    const onWatchPage = Boolean(watchPage && !watchPage.classList.contains('hidden'));

    if (!isTVPlaybackMode() || !onWatchPage) {
        stopTVViewportHold();
        return;
    }

    if (tvViewportHoldUntil) {
        if (now <= tvViewportHoldUntil) {
            if (Math.round(window.scrollY || 0) > 0) {
                window.scrollTo(0, 0);
            }
            updatePlayerPosition();
            tvViewportRaf = requestAnimationFrame(runTVViewportFrame);
            return;
        }
        // El vídeo no ha arrencat a temps: deixem anar la vista, però el reproductor
        // continua seguint el seu forat una estona més.
        releaseTVViewportHold();
    }

    if (tvViewportSettleUntil && now <= tvViewportSettleUntil) {
        updatePlayerPosition();
        tvViewportRaf = requestAnimationFrame(runTVViewportFrame);
        return;
    }

    tvViewportSettleUntil = 0;
}

// Porta la vista al reproductor en engegar una TV i a cada canvi automàtic de vídeo, i
// l'hi manté fins que el vídeo nou comença a reproduir-se.
function focusTVPlayerViewport() {
    if (!isTVPlaybackMode()) {
        return;
    }
    // En pantalla completa no hi ha res a ancorar: la pàgina no es veu. En sortir-ne,
    // el gestor de `fullscreenchange` torna a col·locar-ho tot.
    if (isPlayerFullscreen()) {
        return;
    }
    bindTVViewportGestures();
    // La finestreta flotant no forma part de l'experiència TV: la imatge es queda al seu
    // lloc, també quan s'arriba a la TV des d'un vídeo que ja s'estava veient flotant.
    if (isMiniPlayerActive()) {
        setMiniPlayerState(false, { trigger: 'tv-playback' });
    }
    window.scrollTo(0, 0);
    // El forat es pot haver mogut sense canviar de mida: cal forçar el recàlcul.
    _lastPlayerRect = { top: 0, left: 0, width: 0, height: 0 };
    tvViewportHoldUntil = Date.now() + TV_VIEWPORT_HOLD_TIMEOUT;
    tvViewportSettleUntil = 0;
    if (!tvViewportRaf) {
        tvViewportRaf = requestAnimationFrame(runTVViewportFrame);
    }
}

// ---------- Encadenar vídeos sense sortir de la pantalla completa ----------
// Quan el reproductor de YouTube entra en pantalla completa, l'element que el navegador
// hi posa és l'<iframe> (o un descendent seu). El canvi de vídeo normal el recrea —
// `prepareWatchPlaybackPreview()` buida #videoPlayer— i això treu l'usuari de la pantalla
// completa. Per encadenar el vídeo següent d'una TV sense sortir-ne, el reproductor no es
// toca: se li demana el vídeo nou amb l'API de l'iframe (`loadVideoById`), igual que fa
// una llista de reproducció de YouTube. Si no respon, es recarrega de la manera normal,
// però abans es traspassa la pantalla completa al contenidor (permès sense gest de
// l'usuari mentre ja s'hi és) perquè tampoc se'n surti.

// Temps d'espera perquè el reproductor confirmi que ha carregat el vídeo demanat.
const LIVE_SWAP_TIMEOUT = 2500;
// Un 'ended' que arribi just després d'encadenar és de l'anterior: saltaria un vídeo.
const TV_ENDED_GUARD_MS = 2000;
let liveSwapPending = null;
let liveSwapTimer = null;
let lastTVAdvanceAt = 0;

function getPlayerFullscreenElement() {
    const element = document.fullscreenElement || document.webkitFullscreenElement || null;
    if (!element || !videoPlayer) {
        return null;
    }
    return element === videoPlayer || videoPlayer.contains(element) ? element : null;
}

function isPlayerFullscreen() {
    return Boolean(getPlayerFullscreenElement());
}

function getLiveYouTubeIframe() {
    const iframe = videoPlayer?.querySelector('iframe');
    if (!iframe || !iframe.contentWindow || !isYouTubeEmbed(iframe.src)) {
        return null;
    }
    return iframe;
}

// Només s'encadena en calent quan cal de debò: en pantalla completa. Fora d'ella, el camí
// normal ja va bé i mostra la caràtula del vídeo nou mentre carrega.
function canSwapLivePlayerVideo() {
    return Boolean(isPlayerFullscreen() && getLiveYouTubeIframe() && hasAcceptedYouTubeCookies());
}

function cancelLiveSwapFallback() {
    if (liveSwapTimer) {
        clearTimeout(liveSwapTimer);
    }
    liveSwapTimer = null;
    liveSwapPending = null;
}

// El reproductor ha reaccionat (reproduint o carregant): l'encadenat en calent ha anat bé.
function confirmLivePlayerSwap() {
    if (!liveSwapPending) {
        return;
    }
    cancelLiveSwapFallback();
}

// Traspassa la pantalla completa de l'iframe al seu contenidor. Mentre ja s'hi és, el
// navegador no demana cap gest de l'usuari per canviar d'element. Retorna la promesa del
// traspàs, o null si no cal (o no es pot) fer-lo.
function requestPlayerContainerFullscreen() {
    if (!videoPlayer || !isPlayerFullscreen() || getPlayerFullscreenElement() === videoPlayer) {
        return null;
    }
    const demanar = videoPlayer.requestFullscreen || videoPlayer.webkitRequestFullscreen;
    if (typeof demanar !== 'function') {
        return null;
    }
    try {
        return Promise.resolve(demanar.call(videoPlayer));
    } catch (error) {
        console.warn("No s'ha pogut traspassar la pantalla completa al reproductor:", error);
        return null;
    }
}

function swapLivePlayerVideo({ videoId, startAt = 0, thumbnail = '', title = '' }) {
    const iframe = getLiveYouTubeIframe();
    const id = String(videoId || '').trim();
    if (!iframe || !id) {
        return false;
    }

    const safeStartAt = Math.max(0, Math.floor(Number(startAt) || 0));
    try {
        iframe.contentWindow.postMessage(
            JSON.stringify({
                event: 'command',
                func: 'loadVideoById',
                args: safeStartAt > 0 ? [id, safeStartAt] : [id],
            }),
            '*'
        );
    } catch (error) {
        console.warn("No s'ha pogut encadenar el vídeo dins del reproductor:", error);
        return false;
    }

    videoPlayer.dataset.playingVideoId = id;
    videoPlayer.dataset.playerState = '';
    // El forat continua darrere del reproductor: hi deixem la caràtula del vídeo nou per
    // si l'usuari surt de la pantalla completa mentre encara carrega.
    setPlaceholderImage(thumbnail, title);

    cancelLiveSwapFallback();
    liveSwapPending = { videoId: id, startAt: safeStartAt, thumbnail, title };
    liveSwapTimer = setTimeout(() => {
        const pendent = liveSwapPending;
        cancelLiveSwapFallback();
        if (!pendent || String(currentVideoId) !== pendent.videoId) {
            return;
        }
        const recarregar = () =>
            prepareWatchPlaybackPreview({
                videoId: pendent.videoId,
                source: 'api',
                startAt: pendent.startAt,
                thumbnail: pendent.thumbnail,
                title: pendent.title,
                autoPlay: true,
            });
        // El reproductor no ha respost: es carrega de la manera normal. Abans, la pantalla
        // completa passa al contenidor, que no es destrueix en recrear l'iframe. El traspàs
        // és asíncron i s'ha d'esperar: si l'iframe desapareix abans d'acabar, se'n surt.
        const traspas = requestPlayerContainerFullscreen();
        if (traspas) {
            traspas.then(recarregar, recarregar);
        } else {
            recarregar();
        }
    }, LIVE_SWAP_TIMEOUT);

    return true;
}

// Encadenar un vídeo fa que el reproductor emeti l'estat final del vídeo anterior amb un
// instant de retard; sense aquesta guarda, aquell 'ended' avançaria un segon vídeo.
function shouldIgnoreDuplicateTVEnded() {
    return Boolean(isTVPlaybackMode() && Date.now() - lastTVAdvanceAt < TV_ENDED_GUARD_MS);
}

// L'API de YouTube confirma que el vídeo nou ja s'està reproduint: fins aquí arribava
// l'espera amb la vista ancorada a dalt.
function handleTVPlaybackStarted() {
    if (!isTVPlaybackMode()) {
        return;
    }
    releaseTVViewportHold();
}

function updateMiniPlayerSize() {
    if (!videoPlayer) {
        return;
    }
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
        videoPlayer.style.width = '';
        videoPlayer.style.height = '';
        videoPlayer.style.top = '';
        videoPlayer.style.left = '';
        videoPlayer.style.bottom = '';
        videoPlayer.style.right = '';
        return;
    }
    const width = Math.min(360, window.innerWidth - 32);
    const height = Math.round((width * 9) / 16);
    videoPlayer.style.width = `${width}px`;
    videoPlayer.style.height = `${height}px`;
}

function clearPlayOverlay() {
    if (!videoPlaceholder) {
        return;
    }
    const overlay = videoPlaceholder.querySelector('.play-overlay');
    if (overlay) {
        overlay.remove();
    }
    videoPlaceholder.onclick = null;
}

function ensurePlayOverlay(onPlay) {
    if (!videoPlaceholder) {
        return;
    }
    let overlay = videoPlaceholder.querySelector('.play-overlay');
    if (!overlay) {
        overlay = document.createElement('button');
        overlay.type = 'button';
        overlay.className = 'play-overlay';
        overlay.setAttribute('aria-label', 'Reproduir vídeo');
        overlay.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M8 5v14l11-7z"></path>
            </svg>
        `;
        videoPlaceholder.appendChild(overlay);
    }

    if (overlay._playHandler) {
        overlay.removeEventListener('click', overlay._playHandler);
    }

    overlay._playHandler = event => {
        event.stopPropagation();
        onPlay();
    };

    overlay.addEventListener('click', overlay._playHandler);
    videoPlaceholder.onclick = onPlay;
}

function resetInlineVideoSurface() {
    if (!videoPlayer) {
        return;
    }

    cancelLiveSwapFallback();
    videoPlayer.innerHTML = '';
    videoPlayer.classList.remove('mini-player-active');
    videoPlayer.dataset.playerState = '';
    videoPlayer.dataset.playingVideoId = '';
    videoPlayer.style.display = 'none';
    videoPlayer.style.width = '';
    videoPlayer.style.height = '';
    videoPlayer.style.top = '';
    videoPlayer.style.left = '';
    videoPlayer.style.opacity = '';
    videoPlayer.style.pointerEvents = '';

    _lastPlayerRect = { top: 0, left: 0, width: 0, height: 0 };
}

function prepareWatchPlaybackPreview({ videoId, source, videoUrl, thumbnail, title, startAt = 0, autoPlay = false }) {
    if (!videoPlaceholder) {
        return;
    }

    resetInlineVideoSurface();
    videoPlaceholder.classList.remove('hidden');
    videoPlaceholder.classList.remove('is-placeholder-hidden');
    setPlaceholderImage(thumbnail, title);

    if (autoPlay && hasAcceptedYouTubeCookies()) {
        updatePlayerIframe({ source, videoId, videoUrl, startAt });
        clearPlayOverlay();
        preparePlayerForPlayback({ thumbnail, title });
        requestAnimationFrame(updatePlayerPosition);
        return;
    }

    ensurePlayOverlay(() => {
        if (hasAcceptedYouTubeCookies()) {
            updatePlayerIframe({ source, videoId, videoUrl, startAt });
            clearPlayOverlay();
            preparePlayerForPlayback({ thumbnail, title });
            return;
        }

        pendingYouTubePlayerPayload = { source, videoId, videoUrl, startAt, thumbnail, title };
        requestYouTubePlaybackConsent({
            title: 'Cal activar YouTube per reproduir el vídeo',
            text: "Ara ets al reproductor del vídeo dins de Segueix!. Si acceptes, YouTube podrà carregar el reproductor incrustat, comptar la reproducció i aquesta decisió quedarà activa a partir d'ara per a tots els vídeos i Shorts de la plataforma fins que la canviïs a la configuració.",
        });
    });
    requestAnimationFrame(updatePlayerPosition);
}

function queuePlayback({ videoId, source, videoUrl, thumbnail, title }) {
    return SegueixApp.features.player?.queuePlayback?.({ videoId, source, videoUrl, thumbnail, title });
}

function queuePlaybackLegacyImpl({ videoId, source, videoUrl, thumbnail, title }) {
    if (!videoPlaceholder) {
        return;
    }
    videoPlaceholder.classList.remove('hidden');
    videoPlaceholder.classList.remove('is-placeholder-hidden');
    setPlaceholderImage(thumbnail, title);
    ensurePlayOverlay(() => loadNewVideoInMiniPlayer(videoId, source, videoUrl, thumbnail, title));
}

function loadNewVideoInMiniPlayer(videoId, source, videoUrl, thumbnail, title) {
    if (!videoPlayer) {
        return;
    }
    updatePlayerIframe({ source, videoId, videoUrl });
    clearPlayOverlay();
    preparePlayerForPlayback({ thumbnail, title });
    setupMiniPlayerToggle();
}

function addAutoplayParam(url) {
    if (!url) {
        return url;
    }
    let newUrl = url;
    if (getYouTubePremiumPreference()) {
        newUrl = newUrl.replace('https://www.youtube-nocookie.com/embed/', 'https://www.youtube.com/embed/');
    } else {
        newUrl = newUrl.replace('https://www.youtube.com/embed/', 'https://www.youtube-nocookie.com/embed/');
    }
    if (isYouTubeEmbed(newUrl) && !newUrl.includes('enablejsapi=1')) {
        const origin = encodeURIComponent(window.location.origin || '');
        const separator = newUrl.includes('?') ? '&' : '?';
        newUrl = `${newUrl}${separator}enablejsapi=1&origin=${origin}`;
    }
    // Llengua catalana (interfície i subtítols) també per als vídeos estàtics
    const langParams = {
        hl: YouTubeAPI?.language || 'ca',
        cc_lang_pref: YouTubeAPI?.language || 'ca',
        cc_load_policy: isCatalanCaptionsEnabled() ? '1' : '0',
        gl: YouTubeAPI?.regionCode || 'AD',
    };
    Object.entries(langParams).forEach(([key, value]) => {
        if (!new RegExp(`[?&]${key}=`).test(newUrl)) {
            newUrl += `${newUrl.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(value)}`;
        }
    });
    if (!newUrl.includes('playsinline=1')) {
        const separator = newUrl.includes('?') ? '&' : '?';
        newUrl = `${newUrl}${separator}playsinline=1`;
    }
    if (!newUrl.includes('autoplay=1')) {
        const separator = newUrl.includes('?') ? '&' : '?';
        newUrl = `${newUrl}${separator}autoplay=1`;
    }
    // No forcem `mute=1` a iPhone/iPad: així l'usuari manté el so quan Safari permet
    // reproducció després del toc inicial. Si l'autoplay és bloquejat, és preferible això
    // abans que carregar sempre el vídeo mut.
    return newUrl;
}

function initYouTubeMessageListener() {
    return SegueixApp.features.player?.initYouTubeMessageListener?.();
}

function initYouTubeMessageListenerLegacyImpl() {
    if (youtubeMessageListenerInitialized) {
        return;
    }
    window.addEventListener('message', handleYouTubeMessage);
    youtubeMessageListenerInitialized = true;
}

function getDefaultVideoQuality() {
    const isMobile =
        /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) &&
        window.matchMedia('(max-width: 768px)').matches;
    return isMobile ? 'large' : 'hd720';
}

function suggestVideoQuality() {
    const iframe = videoPlayer?.querySelector('iframe');
    if (!iframe?.contentWindow) return;
    const quality = getDefaultVideoQuality();
    iframe.contentWindow.postMessage(
        JSON.stringify({
            event: 'command',
            func: 'setPlaybackQuality',
            args: [quality],
        }),
        '*'
    );
}

function handleYouTubeMessage(event) {
    return SegueixApp.features.player?.handleYouTubeMessage?.(event);
}

function handleYouTubeMessageLegacyImpl(event) {
    if (!event.origin || !/youtube\.com|youtube-nocookie\.com/.test(event.origin)) {
        return;
    }
    let payload = event.data;
    if (typeof payload === 'string') {
        try {
            payload = JSON.parse(payload);
        } catch (error) {
            return;
        }
    }
    // Guardem l'estat del reproductor (1 = Playing, 2 = Paused, etc.)
    if (payload?.event === 'onStateChange' && videoPlayer) {
        videoPlayer.dataset.playerState = payload.info;
        if (payload?.info === 2 && hasQueueNavigation()) {
            showQueueNextOverlay();
        } else if (payload?.info === 1) {
            const overlay = getQueueNextOverlay();
            if (overlay?.classList.contains('is-visible')) {
                showQueueNextOverlay({ duration: 10000 });
            }
        }
    }
    // Quan comença a reproduir-se (1 = Playing), suggerir qualitat
    if (payload?.event === 'onStateChange' && payload?.info === 1) {
        suggestVideoQuality();
        handleTVPlaybackStarted();
    }
    // Reproduint (1) o carregant (3): el vídeo encadenat en calent ha arrelat.
    if (payload?.event === 'onStateChange' && (payload?.info === 1 || payload?.info === 3)) {
        confirmLivePlayerSwap();
    }
    // A iOS, si l'autoplay falla el reproductor queda en estat "cued" (5) o
    // "unstarted" (-1). Reintenta playVideo per forçar la reproducció.
    if (payload?.event === 'onStateChange' && (payload?.info === 5 || payload?.info === -1)) {
        const playerIframe = videoPlayer?.querySelector('iframe');
        if (playerIframe?.contentWindow) {
            playerIframe.contentWindow.postMessage(
                JSON.stringify({
                    event: 'command',
                    func: 'playVideo',
                    args: [],
                }),
                '*'
            );
        }
        // També per l'iframe de shorts
        const shortIframe = document.getElementById('short-iframe');
        if (shortIframe?.contentWindow && shortIframe.src) {
            shortIframe.contentWindow.postMessage(
                JSON.stringify({
                    event: 'command',
                    func: 'playVideo',
                    args: [],
                }),
                '*'
            );
        }
    }
    if (payload?.event === 'onStateChange' && payload?.info === 0) {
        if (!shouldIgnoreDuplicateTVEnded()) {
            handlePlaylistVideoEnded();
        }
    }
    if (payload?.event === 'infoDelivery' && payload?.info?.currentTime != null) {
        lastKnownPlayerTime = Number(payload.info.currentTime) || 0;
    }
}

function isYouTubeEmbed(url) {
    if (!url) {
        return false;
    }
    return url.includes('youtube.com/embed') || url.includes('youtube-nocookie.com/embed');
}

function setupYouTubeIframeMessaging(iframe) {
    if (!iframe || !isYouTubeEmbed(iframe.src)) {
        return;
    }
    const sendListenerCommand = () => {
        if (!iframe.contentWindow) {
            return;
        }
        iframe.contentWindow.postMessage(
            JSON.stringify({
                event: 'listening',
                id: 'catube-player',
            }),
            '*'
        );
        iframe.contentWindow.postMessage(
            JSON.stringify({
                event: 'command',
                func: 'addEventListener',
                args: ['onStateChange'],
            }),
            '*'
        );
        iframe.contentWindow.postMessage(
            JSON.stringify({
                event: 'command',
                func: 'addEventListener',
                args: ['infoDelivery'],
            }),
            '*'
        );
        iframe.contentWindow.postMessage(
            JSON.stringify({
                event: 'command',
                func: 'getCurrentTime',
                args: [],
            }),
            '*'
        );
        // Suggerir qualitat per defecte: 480p mòbil, 720p escriptori
        iframe.contentWindow.postMessage(
            JSON.stringify({
                event: 'command',
                func: 'setPlaybackQuality',
                args: [getDefaultVideoQuality()],
            }),
            '*'
        );
        // A iOS Safari, autoplay=1 no sempre s'honora. Enviem playVideo explícit
        // perquè el reproductor iniciï la reproducció quan l'iframe està llest.
        iframe.contentWindow.postMessage(
            JSON.stringify({
                event: 'command',
                func: 'playVideo',
                args: [],
            }),
            '*'
        );
    };
    if (iframe._ytListener) {
        iframe.removeEventListener('load', iframe._ytListener);
    }
    iframe._ytListener = sendListenerCommand;
    iframe.addEventListener('load', sendListenerCommand);
    setTimeout(sendListenerCommand, 300);
}

function toggleMainPlayerPlayback() {
    if (!videoPlayer) return;
    const iframe = videoPlayer.querySelector('iframe');
    if (!iframe || !iframe.contentWindow) return;

    // Estat 1 vol dir "Playing". Si està sonant, pausem. Si no, play.
    const isPlaying = videoPlayer.dataset.playerState == '1';
    const command = isPlaying ? 'pauseVideo' : 'playVideo';

    iframe.contentWindow.postMessage(
        JSON.stringify({
            event: 'command',
            func: command,
            args: [],
        }),
        '*'
    );
}

function updatePlayerIframe({ source, videoId, videoUrl, startAt = 0 }) {
    return SegueixApp.features.player?.updatePlayerIframe?.({ source, videoId, videoUrl, startAt });
}

function updatePlayerIframeLegacyImpl({ source, videoId, videoUrl, startAt = 0 }) {
    if (!videoPlayer) {
        return;
    }
    if (!hasAcceptedYouTubeCookies()) {
        pendingYouTubePlayerPayload = { source, videoId, videoUrl, startAt };
        renderYouTubeCookiePlaceholder(videoPlayer, {
            title: 'Cal el teu consentiment per carregar YouTube',
            text: "Aquesta web incrusta vídeos de YouTube. Si acceptes, es carregarà el reproductor incrustat i YouTube podrà utilitzar cookies o altres identificadors relacionats amb la reproducció.",
            watchUrl: buildYouTubeWatchUrl(videoId),
            acceptAction: 'player',
        });
        return;
    }
    const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.matchMedia('(max-width: 768px)').matches;
    if (videoId) {
        videoPlayer.dataset.playingVideoId = videoId;
    }
    const safeStartAt = Math.max(0, Math.floor(Number(startAt) || 0));
    const iframeSrc =
        source === 'api' ? buildYoutubeEmbedUrl(videoId, { startAt: safeStartAt }) : addAutoplayParam(videoUrl);

    const existingIframe = videoPlayer.querySelector('iframe');
    if (!isMobile && existingIframe) {
        existingIframe.src = iframeSrc;
        existingIframe.id = 'catube-player';
        applyYouTubeIframePolicy(existingIframe);
        setupYouTubeIframeMessaging(existingIframe);
        return;
    }
    videoPlayer.innerHTML = `
        <div class="drag-handle-container" aria-hidden="true">
            <div class="drag-surface" style="position:absolute; inset:0; cursor:grab;"></div>
        </div>
        <div class="mini-player-controls-overlay" style="
            position: absolute; inset: 0; z-index: 2002; pointer-events: none;
            display: flex; justify-content: space-between; padding: 8px;
            transition: opacity 0.3s ease;
        ">
            <button class="expand-mini-player-btn" type="button" aria-label="Restaurar" style="pointer-events: auto; background: none; border: none; color: white;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="14" y1="10" x2="21" y2="3"></line><polyline points="21 10 21 3 14 3"></polyline>
                    <line x1="3" y1="21" x2="10" y2="14"></line><polyline points="3 14 3 21 10 21"></polyline>
                </svg>
            </button>
            <button class="close-mini-player-btn" type="button" aria-label="Tancar" style="pointer-events: auto; background: none; border: none; color: white;">
                <i data-lucide="x"></i>
            </button>
        </div>
        <div class="video-embed-wrap" style="position: absolute; inset: 0; z-index: 2000;">
            <iframe
                id="catube-player"
                src="${iframeSrc}"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen
                referrerpolicy="strict-origin-when-cross-origin">
            </iframe>
        </div>
        <div class="mini-player-resize-handle"></div>
    `;
    const newIframe = videoPlayer.querySelector('iframe');
    if (newIframe) {
        applyYouTubeIframePolicy(newIframe);
        setupYouTubeIframeMessaging(newIframe);
    }
    setupDragHandle();
    setupMiniPlayerUIControls();
    refreshIcons(videoPlayer);
    setupVideoCardActionButtons();
}

function makeDraggable(element, handle) {
    if (!element || !handle) {
        return;
    }

    if (handle._dragHandlers) {
        handle.removeEventListener('mousedown', handle._dragHandlers.onStart);
        handle.removeEventListener('touchstart', handle._dragHandlers.onStart);
        handle.removeEventListener('click', handle._dragHandlers.onClick);
    }

    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        handle.style.cursor = 'default';
        const onClick = () => {
            toggleMainPlayerPlayback();
        };
        handle._dragHandlers = { onClick };
        handle.addEventListener('click', onClick);
        return;
    }

    let startX;
    let startY;
    let initialLeft;
    let initialTop;
    let isDragging = false;
    let startTime = 0; // Per calcular si és un click ràpid
    let cachedWidth = 0;
    let cachedHeight = 0;

    const onMove = event => {
        if (!isDragging) {
            return;
        }
        const touch = event.type === 'touchmove' ? event.touches[0] : event;
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        const newLeft = Math.min(Math.max(0, initialLeft + dx), window.innerWidth - cachedWidth);
        const newTop = Math.min(Math.max(0, initialTop + dy), window.innerHeight - cachedHeight);

        requestAnimationFrame(() => {
            element.style.left = `${newLeft}px`;
            element.style.top = `${newTop}px`;
            element.style.bottom = 'auto';
            element.style.right = 'auto';
        });

        if (event.cancelable) {
            event.preventDefault();
        }
    };

    const onEnd = event => {
        isDragging = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchend', onEnd);
        document.removeEventListener('touchcancel', onEnd);
        element.style.transition = 'all 0.2s ease-out';

        // Detectar si ha sigut un click (poc moviment i poc temps)
        const touch = event.changedTouches ? event.changedTouches[0] : event;
        const endX = touch.clientX;
        const endY = touch.clientY;
        const dist = Math.hypot(endX - startX, endY - startY);
        const elapsed = Date.now() - startTime;

        if (dist < 10 && elapsed < 300) {
            toggleMainPlayerPlayback();
        }
    };

    const onStart = event => {
        const touch = event.type === 'touchstart' ? event.touches[0] : event;
        const rect = element.getBoundingClientRect();
        const offsetX = touch.clientX - rect.left;
        const offsetY = touch.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const distFromCenter = Math.hypot(offsetX - centerX, offsetY - centerY);
        if (distFromCenter < 40) {
            toggleMainPlayerPlayback();
            if (event.cancelable) {
                event.preventDefault();
            }
            return;
        }

        isDragging = true;
        startX = touch.clientX;
        startY = touch.clientY;
        startTime = Date.now(); // Guardem l'hora d'inici
        initialLeft = rect.left;
        initialTop = rect.top;
        cachedWidth = rect.width;
        cachedHeight = rect.height;

        element.style.transition = 'none';
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchend', onEnd, { passive: true });
        document.addEventListener('touchcancel', onEnd, { passive: true });

        if (event.cancelable) {
            event.preventDefault();
        }
    };

    handle._dragHandlers = { onStart };
    handle.addEventListener('mousedown', onStart);
    handle.addEventListener('touchstart', onStart, { passive: false });
}

function makeResizable(element, handle) {
    if (!element || !handle) {
        return;
    }

    if (handle._resizeHandlers) {
        handle.removeEventListener('mousedown', handle._resizeHandlers.onMouseDown);
    }

    let startX;
    let startWidth;

    const onMouseMove = event => {
        const newWidth = startWidth + (event.clientX - startX);
        if (newWidth > 200 && newWidth < window.innerWidth - 20) {
            element.style.width = `${newWidth}px`;
            element.style.height = `${Math.round((newWidth * 9) / 16)}px`;
        }
    };

    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    const onMouseDown = event => {
        event.preventDefault();
        event.stopPropagation();
        startX = event.clientX;
        startWidth = parseInt(document.defaultView.getComputedStyle(element).width, 10);

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    handle._resizeHandlers = { onMouseDown };
    handle.addEventListener('mousedown', onMouseDown);
}

function setupMiniPlayerUIControls() {
    if (!videoPlayer) {
        return;
    }
    const overlay = videoPlayer.querySelector('.mini-player-controls-overlay');
    if (!overlay) {
        return;
    }

    if (videoPlayer._miniPlayerUIHandlers) {
        videoPlayer.removeEventListener('touchstart', videoPlayer._miniPlayerUIHandlers.onInteraction);
        videoPlayer.removeEventListener('mousemove', videoPlayer._miniPlayerUIHandlers.onInteraction);
        videoPlayer.removeEventListener('mouseenter', videoPlayer._miniPlayerUIHandlers.onInteraction);
        videoPlayer.removeEventListener('mouseleave', videoPlayer._miniPlayerUIHandlers.onLeave);
    }

    const showControls = () => {
        showMiniPlayerControls(overlay);
    };

    videoPlayer._miniPlayerUIHandlers = {
        onInteraction: showControls,
        onLeave: () => {},
    };

    videoPlayer.addEventListener('touchstart', showControls, { passive: true });
    videoPlayer.addEventListener('mouseenter', showControls);
    videoPlayer.addEventListener('mousemove', showControls);
    showControls();
}

function showMiniPlayerControls(overlayElement) {
    const overlay = overlayElement || videoPlayer?.querySelector('.mini-player-controls-overlay');
    if (!overlay) {
        return;
    }

    overlay.classList.add('visible');

    clearTimeout(miniPlayerTimer);
    miniPlayerTimer = setTimeout(() => {
        overlay.classList.remove('visible');
    }, 3000);
}

function setupDragHandle() {
    const handle = videoPlayer?.querySelector('.drag-surface');
    if (!handle) {
        return;
    }
    makeDraggable(videoPlayer, handle);
    const resizeHandle = videoPlayer?.querySelector('.mini-player-resize-handle');
    if (resizeHandle) {
        if (isMiniPlayerActive()) {
            makeResizable(videoPlayer, resizeHandle);
        } else if (resizeHandle._resizeHandlers) {
            resizeHandle.removeEventListener('mousedown', resizeHandle._resizeHandlers.onMouseDown);
            delete resizeHandle._resizeHandlers;
        }
    }

    const closeButton = videoPlayer.querySelector('.close-mini-player-btn');
    const expandButton = videoPlayer.querySelector('.expand-mini-player-btn');
    if (!closeButton) {
        return;
    }

    const miniPlayerControls = [closeButton, expandButton].filter(Boolean);

    if (closeButton._closeHandlers) {
        closeButton.removeEventListener('click', closeButton._closeHandlers.onClose);
        closeButton.removeEventListener('mousedown', closeButton._closeHandlers.stopPropagation);
        closeButton.removeEventListener('touchstart', closeButton._closeHandlers.stopPropagation);
    }

    if (expandButton?._expandHandlers) {
        expandButton.removeEventListener('click', expandButton._expandHandlers.onExpand);
        expandButton.removeEventListener('mousedown', expandButton._expandHandlers.stopPropagation);
        expandButton.removeEventListener('touchstart', expandButton._expandHandlers.stopPropagation);
    }

    const stopPropagation = event => {
        event.stopPropagation();
    };

    const onClose = event => {
        event.preventDefault();
        event.stopPropagation();
        const isWatchPageVisible = watchPage && !watchPage.classList.contains('hidden');

        if (isWatchPageVisible) {
            if (videoPlayer) {
                videoPlayer.innerHTML = '';
                videoPlayer.style.display = 'none';
                videoPlayer.classList.remove('mini-player-active');
                videoPlayer.style.top = '';
                videoPlayer.style.left = '';
                videoPlayer.style.width = '';
                videoPlayer.style.height = '';
            }

            if (videoPlaceholder) {
                videoPlaceholder.classList.remove('hidden');
                videoPlaceholder.classList.remove('is-placeholder-hidden');
                ensurePlayOverlay(() => {
                    if (currentVideoId) {
                        if (useYouTubeAPI) {
                            showVideoFromAPI(currentVideoId);
                        } else {
                            showVideo(currentVideoId);
                        }
                    }
                });
            }
        } else {
            stopVideoPlayback();
        }
    };

    const onExpand = async event => {
        event.preventDefault();
        event.stopPropagation();
        const playingId = videoPlayer.dataset.playingVideoId;
        const currentPageId = currentVideoId;
        // Desactivar mini-player primer per restaurar la posició
        setMiniPlayerState(false);
        if (playingId && playingId !== currentPageId) {
            if (useYouTubeAPI) {
                await showVideoFromAPI(playingId);
            } else {
                showVideo(playingId);
            }
        }
    };

    closeButton._closeHandlers = { onClose, stopPropagation };
    closeButton.addEventListener('click', onClose);
    closeButton.addEventListener('mousedown', stopPropagation);
    closeButton.addEventListener('touchstart', stopPropagation, { passive: true });

    if (expandButton) {
        expandButton._expandHandlers = { onExpand, stopPropagation };
        expandButton.addEventListener('click', onExpand);
        expandButton.addEventListener('mousedown', stopPropagation);
        expandButton.addEventListener('touchstart', stopPropagation, { passive: true });
    }

    miniPlayerControls.forEach(control => {
        control.addEventListener('pointerdown', stopPropagation, { passive: true });
    });

    setupMiniPlayerUIControls();
}

function preparePlayerForPlayback({ thumbnail, title }) {
    return SegueixApp.features.player?.preparePlayerForPlayback?.({ thumbnail, title });
}

function preparePlayerForPlaybackLegacyImpl({ thumbnail, title }) {
    if (!videoPlayer) {
        return;
    }

    const miniActive = isMiniPlayerActive();

    if (!miniActive) {
        videoPlayer.classList.remove('mini-player-active');
        videoPlayer.style.width = '';
        videoPlayer.style.height = '';
        // Invalidar cache perquè updatePlayerPosition re-apliqui les dimensions
        _lastPlayerRect = { top: 0, left: 0, width: 0, height: 0 };
    }
    videoPlayer.style.display = 'block';

    if (videoPlaceholder) {
        videoPlaceholder.classList.remove('hidden');
        if (miniActive) {
            videoPlaceholder.classList.remove('is-placeholder-hidden');
        } else {
            videoPlaceholder.classList.add('is-placeholder-hidden');
            clearPlayOverlay();
        }
    }

    setPlaceholderImage(thumbnail, title);
    setupDragHandle();
    if (miniActive) {
        updateMiniPlayerSize();
    } else {
        // Es col·loca abans que el navegador pinti: esperant només al requestAnimationFrame
        // el reproductor es veia un frame a dalt de tot, fora del seu forat.
        updatePlayerPosition();
        requestAnimationFrame(updatePlayerPosition);
    }
}

function handlePlayerVisibilityOnNavigation() {
    // En sortir de la pàgina del reproductor tornem a mostrar la filera
    // d'icones del header (que amaguem al mòbil mentre es mira el vídeo).
    revealMobileHeaderNav();
    if (!videoPlayer) {
        return;
    }
    if (isMiniPlayerActive()) {
        videoPlayer.style.display = 'block';
        return;
    }
    stopVideoPlayback();
}

function updateMiniPlayerToggleIcon(isActive) {
    const miniToggle = document.getElementById('miniPlayerToggle');
    if (!miniToggle) {
        return;
    }
    miniToggle.disabled = isActive;
    miniToggle.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    miniToggle.setAttribute('aria-label', isActive ? 'Restaurar reproductor' : 'Mini reproductor');
    if (isActive) {
        miniToggle.innerHTML = `<i data-lucide="minimize-2"></i>`;
    } else {
        // Restaurar icona PiP original
        miniToggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"></rect><rect x="4" y="12" width="6" height="4" rx="1" fill="white" stroke="none"></rect></svg>`;
    }
    // Diferir refreshIcons i setupVideoCardActionButtons
    requestAnimationFrame(() => {
        if (isActive) refreshIcons(miniToggle);
        setupVideoCardActionButtons();
    });
}

function positionMiniPlayerBottomRight() {
    if (!videoPlayer) {
        return;
    }

    const miniPlayerMargin = 24;
    const width = parseFloat(videoPlayer.style.width) || videoPlayer.offsetWidth || 320;
    const height = parseFloat(videoPlayer.style.height) || videoPlayer.offsetHeight || Math.round((width * 9) / 16);

    videoPlayer.style.left = `${Math.max(miniPlayerMargin, window.innerWidth - width - miniPlayerMargin)}px`;
    videoPlayer.style.top = `${Math.max(miniPlayerMargin, window.innerHeight - height - miniPlayerMargin)}px`;
}

function setMiniPlayerState(isActive, options = {}) {
    if (!videoPlayer) {
        return;
    }
    // Totes les TV comparteixen aquesta cua i es mantenen al reproductor principal,
    // també durant l'scroll i els canvis automàtics de vídeo.
    if (isPlaylistMode && activePlaylistId === '__segueix_tv_discovery__') {
        isActive = false;
    }
    const trigger = options.trigger || 'manual';
    if (isActive) {
        miniPlayerAutoActivatedByScroll = trigger === 'auto-scroll';
    } else {
        miniPlayerAutoActivatedByScroll = false;
    }

    // Evitar efectes secundaris si l'estat no canvia
    const wasActive = isMiniPlayerActive();
    videoPlayer.classList.toggle('mini-player-active', isActive);

    if (wasActive === isActive) {
        // Només actualitzar la icona, no canviar visibilitat de pàgines
        updateMiniPlayerToggleIcon(isActive);
        return;
    }

    if (isActive) {
        if (videoPlaceholder) {
            videoPlaceholder.classList.remove('hidden');
            videoPlaceholder.classList.remove('is-placeholder-hidden');
        }
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (isMobile) {
            videoPlayer.style.width = '';
            videoPlayer.style.height = '';
            videoPlayer.style.left = '';
            videoPlayer.style.top = '';
            videoPlayer.style.bottom = '';
            videoPlayer.style.right = '';

            if (videoPlayer._miniPlayerMobileListener) {
                videoPlayer.removeEventListener('touchstart', videoPlayer._miniPlayerMobileListener);
            }
            videoPlayer._miniPlayerMobileListener = () => {
                showMiniPlayerControls();
            };
            videoPlayer.addEventListener('touchstart', videoPlayer._miniPlayerMobileListener, { passive: true });
            showMiniPlayerControls();
        } else {
            videoPlayer.style.removeProperty('top');
            videoPlayer.style.removeProperty('left');
            videoPlayer.style.removeProperty('bottom');
            videoPlayer.style.removeProperty('right');
            updateMiniPlayerSize();
            positionMiniPlayerBottomRight();
        }

        setupMiniPlayerUIControls();
    } else {
        if (mainContent) {
            mainContent.classList.remove('hidden');
        }
        if (historyPage) {
            historyPage.classList.add('hidden');
        }
        if (followPage) {
            followPage.classList.add('hidden');
        }
        if (chipsBar) {
            chipsBar.classList.add('hidden');
        }
        homePage.classList.add('hidden');
        watchPage.classList.remove('hidden');
        if (videoPlaceholder) {
            videoPlaceholder.classList.add('is-placeholder-hidden');
        }
        videoPlayer.style.width = '';
        videoPlayer.style.height = '';
        videoPlayer.style.left = '';
        videoPlayer.style.top = '';
        videoPlayer.style.bottom = '';
        videoPlayer.style.right = '';
        if (videoPlayer._miniPlayerMobileListener) {
            videoPlayer.removeEventListener('touchstart', videoPlayer._miniPlayerMobileListener);
            delete videoPlayer._miniPlayerMobileListener;
        }
        // Resetejar cache de posició per forçar recàlcul
        _lastPlayerRect = { top: 0, left: 0, width: 0, height: 0 };
        updatePlayerPosition();
        // En TV la vista ja s'ancora a dalt (focusTVPlayerViewport): un desplaçament
        // suau aquí competiria amb l'ancoratge i faria surar la imatge.
        if (videoPlaceholder && !isTVPlaybackMode()) {
            requestAnimationFrame(() => {
                videoPlaceholder.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
    }

    setupDragHandle();
    updateMiniPlayerToggleIcon(isActive);
}

function handleMiniPlayerAutoOnScroll() {
    if (!videoPlayer || !videoPlaceholder || !watchPage) {
        return;
    }
    if (watchPage.classList.contains('hidden') || videoPlayer.style.display === 'none') {
        return;
    }

    const isPlaying = videoPlayer.dataset.playerState === '1';
    const hasActiveIframe = Boolean(videoPlayer.querySelector('iframe'));
    if (!isPlaying && !hasActiveIframe) {
        return;
    }

    const placeholderRect = videoPlaceholder.getBoundingClientRect();
    const hasPlayerGoneAboveViewport = placeholderRect.bottom < 72;
    const hasPlayerReturnedToTop =
        placeholderRect.top <= 80 && placeholderRect.bottom >= Math.min(window.innerHeight * 0.35, 280);

    if (!isMiniPlayerActive() && hasPlayerGoneAboveViewport) {
        setMiniPlayerState(true, { trigger: 'auto-scroll' });
        return;
    }

    if (isMiniPlayerActive() && miniPlayerAutoActivatedByScroll && hasPlayerReturnedToTop) {
        setMiniPlayerState(false, { trigger: 'auto-scroll-restore' });
    }
}

// En obrir un vídeo el reproductor ha de sortir al seu lloc, mai flotant: si s'hereta
// l'estat de la finestreta d'un vídeo anterior, en obrir el següent el vídeo apareix
// enganxat a baix i tapant el títol. El mode flotant es reserva per a l'scroll cap avall
// (handleMiniPlayerAutoOnScroll) i per al botó de minimitzar. S'exclou l'avanç automàtic
// de cua/llista: allà el flotant ha de continuar mentre l'usuari navega.
function exitMiniPlayerForNewVideo() {
    if (!isMiniPlayerActive() || isAutoPlayNavigating) {
        return;
    }
    setMiniPlayerState(false, { trigger: 'new-video' });
}

function setupMiniPlayerToggle() {
    const miniToggle = document.getElementById('miniPlayerToggle');

    if (!miniToggle || !videoPlayer) {
        return;
    }

    if (miniToggle._miniHandler) {
        miniToggle.removeEventListener('click', miniToggle._miniHandler);
    }

    miniToggle._miniHandler = () => {
        const isActive = isMiniPlayerActive();
        setMiniPlayerState(!isActive);
    };

    miniToggle.addEventListener('click', miniToggle._miniHandler);
    setMiniPlayerState(isMiniPlayerActive());
}

// Renderitzar resultats de cerca (sense estadístiques)
// Resultats de cerca i targetes d'arxiu
function renderSearchResults(videos) {
    const featured = getFeaturedVideoForSection(videos, getHeroSectionKey());
    updateHero(featured, 'api');

    const likedIds = getLikedVideoIds();
    videosGrid.innerHTML = videos
        .map(video => {
            const isLiked = likedIds.includes(String(video.id));
            const duration = getVideoDisplayDuration(video);
            const payload = encodeURIComponent(JSON.stringify(getPlaylistVideoData(video)));
            return `
        <div class="video-card" data-video-id="${video.id}">
            <div class="video-thumbnail${video.isShort ? ' is-short' : ''}${video.source === 'archive' ? ' is-archive-source' : ''}">
                <img src="${video.thumbnail}" alt="${escapeHtml(video.title)}" loading="lazy">
                ${video.isShort ? '<span class="video-short-badge">SHORT</span>' : ''}
                ${duration ? `<span class="video-duration-badge">${duration}</span>` : ''}
            </div>
            <div class="video-details">
                <div class="video-info-container">
                    <div class="video-info-header">
                        <h3 class="video-card-title">${escapeHtml(video.title)}</h3>
                        <div class="video-card-actions">
                            <button class="video-action-btn like-action${isLiked ? ' is-liked' : ''}" type="button" data-video-id="${video.id}" aria-label="Preferit">
                                <i data-lucide="heart"></i>
                            </button>
                            <button class="video-action-btn playlist-action" type="button" data-playlist-video="${payload}" aria-label="Afegir a una llista">
                                ${PLAYLIST_ICON_SVG}
                            </button>
                        </div>
                    </div>
                    <div class="video-metadata">
                        <div class="channel-name channel-link" data-channel-id="${video.channelId}">${escapeHtml(video.channelTitle)}</div>
                        <div class="video-stats">
                            <!-- Si hi ha comptador de vistes, fes servir "vis." -->
                            <!-- Exemple si s'afegeix: <span>${formatViews(video.viewCount)} vis.</span> -->
                            <span>${formatDate(video.publishedAt)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
        })
        .join('');

    setupDelegatedVideoCardClicks(videosGrid, 'api');
    bindChannelLinks(videosGrid);

    refreshIcons(videosGrid);
    setupVideoCardActionButtons();
}

function createArchiveVideoCard(video) {
    const payload = encodeURIComponent(JSON.stringify(getPlaylistVideoData(video)));
    const thumbnail = video.thumbnail || buildArchiveThumbnail(video.id);
    const channelId = video.channelId || '';
    const duration = getVideoDisplayDuration(video);
    const radarLabel = getRadarCategoryLabel(video);
    return `
        <article class="archive-video-card" data-video-id="${video.id}">
            <div class="archive-video-thumb-wrap is-archive-source">
                <img class="archive-video-thumb" src="${thumbnail}" alt="${escapeHtml(video.title)}" loading="lazy" decoding="async">
                <span class="archive-history-badge" aria-label="Arxiu" title="Vídeo d'arxiu">
                    <i data-lucide="history"></i>
                </span>
                ${radarLabel ? `<span class="radar-category-label radar-category-label--top-right">${escapeHtml(radarLabel)}</span>` : ''}
                ${duration ? `<span class="video-duration-badge">${duration}</span>` : ''}
            </div>
            <div class="archive-video-info">
                <div class="archive-video-header">
                    <h3 class="archive-video-title">${escapeHtml(video.title)}</h3>
                    <button class="video-action-btn playlist-action archive-playlist-action" type="button" data-playlist-video="${payload}" aria-label="Afegir a una llista">
                        ${PLAYLIST_ICON_SVG}
                    </button>
                </div>
                <p class="archive-video-meta">
                    <span class="channel-link" data-channel-id="${escapeHtml(channelId)}">${escapeHtml(video.channelTitle || 'Canal')}</span>
                    <span>• ${formatDate(video.publishedAt)}</span>
                </p>
            </div>
        </article>
    `;
}

// Crear targeta de vídeo (API)
function createVideoCardAPI(video) {
    const payload = encodeURIComponent(JSON.stringify(getPlaylistVideoData(video)));
    const duration = getVideoDisplayDuration(video);
    const radarLabel = selectedCategory === 'Radar' ? getRadarCategoryLabel(video) : '';
    return `
        <div class="video-card" data-video-id="${video.id}">
            <div class="video-thumbnail${video.isShort ? ' is-short' : ''}${video.source === 'archive' ? ' is-archive-source' : ''}">
                <img src="${video.thumbnail}" alt="${escapeHtml(video.title)}" loading="lazy" decoding="async">
                ${video.isShort ? '<span class="video-short-badge">SHORT</span>' : ''}
                ${radarLabel ? `<span class="radar-category-label radar-category-label--top-right">${escapeHtml(radarLabel)}</span>` : ''}
                ${duration ? `<span class="video-duration-badge">${duration}</span>` : ''}
            </div>
            <div class="video-details">
                <div class="video-info-container">
                    <div class="video-info-header">
                        <h3 class="video-card-title">${escapeHtml(video.title)}</h3>
                        <div class="video-card-actions">
                            <button class="video-action-btn playlist-action" type="button" data-playlist-video="${payload}" aria-label="Afegir a una llista">
                                ${PLAYLIST_ICON_SVG}
                            </button>
                        </div>
                    </div>
                    <div class="video-metadata">
                        <div class="channel-name channel-link" data-channel-id="${video.channelId}">${escapeHtml(video.channelTitle)}</div>
                        <div class="video-stats">
                            ${
                                video.source === 'archive'
                                    ? `<span>${formatDate(video.publishedAt)}</span>`
                                    : `<i data-lucide="eye" style="width: 12px; height: 12px;"></i>
                            <span>${formatViews(video.viewCount || 0)} vis.</span>
                            <span>•</span>
                            <span>${formatDate(video.publishedAt)}</span>`
                            }
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderDesktopSidebar(channel, channelVideos, currentVideoId, options = {}) {
    const channelInfoContainer = document.getElementById('sidebarChannelInfo');
    const channelVideosContainer = document.getElementById('sidebarChannelVideos');

    if (!channelInfoContainer || !channelVideosContainer) {
        return;
    }

    const filteredVideos = channelVideos
        .filter(v => String(v.id) !== String(currentVideoId))
        .slice(0, WATCH_SIDEBAR_VIDEOS_LIMIT);

    const avatar = resolveChannelAvatar(channel.id, channel);
    const channelName = channel.title || channel.name || 'Canal';
    const displayName = options.program?.name || channelName;
    const description = options.program?.description || channel.description || 'Sense descripció disponible.';
    const subsText = options.program
        ? ''
        : channel.subscriberCount
          ? formatViews(channel.subscriberCount) + ' subscriptors'
          : '';
    const isMitjans = isMitjansOrDigitalsChannel(channel.id);
    const followButtonHtml =
        !options.program && !isMitjans
            ? `
            <button class="follow-channel-btn" type="button" data-follow-channel="${channel.id}" aria-pressed="false">
                Segueix
            </button>
        `
            : '';
    channelInfoContainer.innerHTML = `
        <div class="sidebar-channel-header channel-link ${options.program ? 'sidebar-channel-header--program' : ''}" data-channel-id="${options.program ? channel.id : channel.id}" ${options.program ? `data-program-id="${escapeHtml(options.program.id)}"` : ''}>
            <img class="sidebar-channel-avatar" src="${avatar}" alt="${escapeHtml(displayName)}">
            <div>
                <h3 class="sidebar-channel-name">${escapeHtml(displayName)}</h3>
                ${options.program ? `<div class="sidebar-channel-meta">Programa de ${escapeHtml(channelName)}</div>` : ''}
                ${subsText ? `<span class="sidebar-channel-subs">${subsText}</span>` : ''}
            </div>
        </div>
        <div class="sidebar-channel-description">${escapeHtml(description)}</div>
        <div class="sidebar-channel-actions">
            ${followButtonHtml}
            ${options.program ? '' : SupportModule.getSidebarButtonHtml(channel.id, channelName)}
            <button class="btn-round-icon sidebar-channel-share-btn" type="button" data-share-channel-id="${channel.id}" data-share-channel-name="${encodeURIComponent(displayName)}" data-share-channel-description="${encodeURIComponent(description)}" ${options.program ? `data-share-program-name="${encodeURIComponent(options.program.name)}" data-share-program-id="${escapeHtml(options.program.id)}"` : ''} title="${options.program ? 'Compartir programa' : 'Compartir canal'}">
                <i data-lucide="share-2"></i>
            </button>
        </div>
    `;

    if (!options.program) {
        SupportModule.bindSidebarSupportButtons(channelInfoContainer);
    }
    refreshIcons(channelInfoContainer);

    if (filteredVideos.length > 0) {
        channelVideosContainer.innerHTML = `
            <h4 class="sidebar-channel-videos-title">${options.program ? "Més vídeos d'aquest programa" : "Més vídeos d'aquest canal"}</h4>
            ${filteredVideos
                .map(
                    video => `
                <div class="sidebar-video-item" data-video-id="${video.id}">
                    <img class="sidebar-video-thumb" src="${video.thumbnail}" alt="${escapeHtml(video.title)}" loading="lazy">
                    <div class="sidebar-video-info">
                        <div class="sidebar-video-title">${escapeHtml(video.title)}</div>
                        <div class="sidebar-video-stats">
                            ${video.viewCount ? formatViews(video.viewCount) + ' vis.' : ''}
                            ${video.publishedAt ? (video.viewCount ? '• ' : '') + formatDate(video.publishedAt) : ''}
                        </div>
                    </div>
                </div>
            `
                )
                .join('')}
        `;
    } else {
        channelVideosContainer.innerHTML = `<p class="sidebar-channel-videos-title">${options.program ? "No hi ha més vídeos d'aquest programa." : "No hi ha més vídeos d'aquest canal."}</p>`;
    }

    bindFollowButtons(channelInfoContainer);
    bindChannelLinks(channelInfoContainer);
    channelVideosContainer.querySelectorAll('.sidebar-video-item').forEach(item => {
        item.addEventListener('click', () => {
            playThenNavigate(item.dataset.videoId, 'api');
        });
    });
}

function getStaticChannelVideos(channelId) {
    const localVideos = typeof VIDEOS !== 'undefined' && Array.isArray(VIDEOS) ? VIDEOS : [];
    return localVideos
        .filter(video => String(video.channelId) === String(channelId) && !video.isShort)
        .map(video => ({
            id: video.id,
            title: video.title,
            thumbnail: video.thumbnail || 'img/icon-192.png',
            channelId,
            channelTitle: getChannelNameById(channelId),
            viewCount: video.views,
            publishedAt: video.uploadDate,
        }));
}

function normalizeChannelArchiveVideos(videos, channelId) {
    const normalizedChannelId = String(channelId || '');
    if (!Array.isArray(videos)) {
        return [];
    }

    return videos
        .filter(video => {
            const videoChannelId = String(video.channelId || video.sourceChannelId || normalizedChannelId);
            return video?.id && videoChannelId === normalizedChannelId;
        })
        .map(video => ({
            ...video,
            id: String(video.id),
            channelId: normalizedChannelId,
            channelTitle: video.channelTitle || getChannelNameById(normalizedChannelId),
            thumbnail: video.thumbnail || buildArchiveThumbnail(video.id),
            source: video.source || 'archive',
        }));
}

function mergeSidebarChannelVideos(channelId, videoGroups) {
    const normalizedChannelId = String(channelId || '');
    const mergedById = new Map();

    videoGroups.flat().forEach(video => {
        if (!video?.id || video.isShort || String(video.channelId || '') !== normalizedChannelId) {
            return;
        }
        const normalizedId = String(video.id);
        if (!mergedById.has(normalizedId)) {
            mergedById.set(normalizedId, video);
        }
    });

    const mergedVideos = Array.from(mergedById.values()).sort(
        (a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()
    );

    mergedVideos.forEach(video => {
        if (!cachedAPIVideos.find(cached => String(cached.id) === String(video.id))) {
            cachedAPIVideos.push(video);
        }
    });

    return mergedVideos;
}

async function getFullChannelArchiveVideos(channelId) {
    const normalizedChannelId = String(channelId || '');
    if (!normalizedChannelId || typeof YouTubeAPI?.loadChannelArchiveVideos !== 'function') {
        return [];
    }

    try {
        const archiveVideos = await YouTubeAPI.loadChannelArchiveVideos(normalizedChannelId);
        const normalizedArchiveVideos = normalizeChannelArchiveVideos(archiveVideos, normalizedChannelId);
        rememberArchiveSearchVideos(normalizedArchiveVideos);
        return normalizedArchiveVideos;
    } catch (error) {
        console.warn("No s'ha pogut carregar l'històric del canal per a la barra lateral", error);
        return [];
    }
}

async function renderChannelSidebarFromApi(channelId, currentVideoId, channelResult, fallbackTitle = '') {
    if (!isDesktopView()) {
        return;
    }
    const channelList = Array.isArray(YouTubeAPI?.getAllChannels?.()) ? YouTubeAPI.getAllChannels() : [];
    const matchedChannel = channelList.find(channelItem => String(channelItem.id) === String(channelId));
    const channelData = matchedChannel
        ? { ...channelResult?.channel, ...matchedChannel }
        : channelResult?.channel || cachedChannels[channelId] || { id: channelId, title: fallbackTitle };
    const archiveIndexVideos = getArchiveVideosForChannel(channelId);
    rememberArchiveSearchVideos(archiveIndexVideos);
    const currentVideo =
        cachedAPIVideos.find(video => String(video.id) === String(currentVideoId)) ||
        (Array.isArray(YouTubeAPI?.feedVideos)
            ? YouTubeAPI.feedVideos.find(video => String(video.id) === String(currentVideoId))
            : null) ||
        archiveIndexVideos.find(video => String(video.id) === String(currentVideoId)) ||
        null;
    const matchedProgram = getPrimaryProgramForVideo(currentVideo);

    if (matchedProgram) {
        renderDesktopSidebar(channelData, getProgramVideos(matchedProgram), currentVideoId, {
            program: matchedProgram,
        });
        return;
    }

    const feedVideos = Array.isArray(YouTubeAPI?.feedVideos) ? YouTubeAPI.feedVideos : [];
    const feedAndApiVideos = [...feedVideos, ...cachedAPIVideos].filter(
        v => String(v.channelId) === String(channelId) && !v.isShort
    );
    const initialChannelVideos = mergeSidebarChannelVideos(channelId, [feedAndApiVideos, archiveIndexVideos]);
    renderDesktopSidebar(channelData, initialChannelVideos, currentVideoId);

    const fullArchiveVideos = await getFullChannelArchiveVideos(channelId);
    const stillCurrentVideo = String(SegueixApp?.state?.currentVideoId || '') === String(currentVideoId);
    if (!isDesktopView() || !stillCurrentVideo || fullArchiveVideos.length === 0) {
        return;
    }

    const channelVideos = mergeSidebarChannelVideos(channelId, [feedAndApiVideos, archiveIndexVideos, fullArchiveVideos]);
    renderDesktopSidebar(channelData, channelVideos, currentVideoId);
}

async function renderChannelSidebarFromStatic(channel, currentVideoId) {
    if (!isDesktopView() || !channel) {
        return;
    }
    const channelData = {
        ...channel,
        title: channel.name,
        subscriberCount: channel.subscribers,
        avatar: channel.avatar,
    };
    const staticVideos = getStaticChannelVideos(channel.id);
    const initialChannelVideos = mergeSidebarChannelVideos(channel.id, [staticVideos]);
    renderDesktopSidebar(channelData, initialChannelVideos, currentVideoId);

    const fullArchiveVideos = await getFullChannelArchiveVideos(channel.id);
    const stillCurrentVideo = String(SegueixApp?.state?.currentVideoId || '') === String(currentVideoId);
    if (!isDesktopView() || !stillCurrentVideo || fullArchiveVideos.length === 0) {
        return;
    }

    const channelVideos = mergeSidebarChannelVideos(channel.id, [staticVideos, fullArchiveVideos]);
    renderDesktopSidebar(channelData, channelVideos, currentVideoId);
}

function renderCategoryVideosBelow(currentChannelId, currentVideoId) {
    return SegueixApp.features.player?.renderCategoryVideosBelow?.(currentChannelId, currentVideoId);
}

function renderCategoryVideosBelowLegacyImpl(currentChannelId, currentVideoId) {
    const extraContainer = extraVideosGrid || document.getElementById('extraVideosGrid');
    if (!extraContainer) {
        return;
    }
    setExtraRelatedTitle(DEFAULT_EXTRA_RELATED_TITLE);

    const useListCategories = ['Novetats', 'Tot', 'Seguint'];
    const shouldUseList = useListCategories.includes(selectedCategory) || isCustomCategory(selectedCategory);

    let videos;

    if (shouldUseList && lastRenderedFeedList.length > 0) {
        // Trobar posició actual a la llista
        const currentIndex = lastRenderedFeedList.findIndex(v => String(v.id) === String(currentVideoId));

        // Obtenir vídeos restants de la llista (després del vídeo actual)
        let listVideos;
        if (currentIndex >= 0) {
            listVideos = lastRenderedFeedList.slice(currentIndex + 1);
        } else {
            listVideos = [...lastRenderedFeedList];
        }

        // Excloure shorts i el vídeo actual
        listVideos = listVideos.filter(v => String(v.id) !== String(currentVideoId) && !v.isShort);

        // Prioritzar per categoria principal del vídeo actual
        const mainCategory = getEffectiveCategory(currentChannelId);
        if (mainCategory) {
            const sameCat = [];
            const otherCat = [];
            listVideos.forEach(v => {
                const vCat = getEffectiveCategory(v.channelId);
                if (vCat && vCat.toLowerCase() === mainCategory.toLowerCase()) {
                    sameCat.push(v);
                } else {
                    otherCat.push(v);
                }
            });
            listVideos = [...sameCat, ...otherCat];
        }

        videos = listVideos;
    } else {
        // Comportament actual per categories estàndard
        const feedVideos = Array.isArray(currentFeedVideos) ? currentFeedVideos : [];
        const archiveChannelVideos = currentChannelId ? getArchiveVideosForChannel(currentChannelId) : [];
        const mergedVideos = new Map();
        [...feedVideos, ...cachedAPIVideos, ...archiveChannelVideos].forEach(video => {
            if (!video?.id || video.isShort) {
                return;
            }
            const normalizedId = String(video.id);
            if (!mergedVideos.has(normalizedId)) {
                mergedVideos.set(normalizedId, video);
            }
        });
        const allVideos = Array.from(mergedVideos.values());

        let effectiveCategory = null;
        if (selectedCategory && selectedCategory !== 'Novetats' && selectedCategory !== 'Tot') {
            effectiveCategory = selectedCategory;
        } else {
            effectiveCategory = getEffectiveCategory(currentChannelId);
        }

        if (effectiveCategory) {
            const originalCategory = selectedCategory;
            selectedCategory = effectiveCategory;
            videos = filterVideosByCategory(allVideos, currentFeedData);
            selectedCategory = originalCategory;
        } else {
            videos = [...allVideos];
        }

        // Excloure vídeo actual, canal actual, shorts
        videos = videos.filter(
            v =>
                String(v.channelId) !== String(currentChannelId) &&
                String(v.id) !== String(currentVideoId) &&
                !v.isShort
        );

        // Aplicar scoring personalitzat
        videos = scoreRelatedVideos(videos, { id: currentVideoId, channelId: currentChannelId });
    }

    if (videos.length === 0) {
        extraContainer.innerHTML = '<div class="empty-state">No hi ha més vídeos d\'aquesta categoria.</div>';
        return;
    }

    batchRenderCards(extraContainer, spreadVideosByArtist(videos), createVideoCardAPI, {
        onComplete: () => {
            ensureWatchGridLayoutControls();
            applyWatchGridLayoutPreference();
            setupDelegatedVideoCardClicks(extraContainer, 'api');
            bindChannelLinks(extraContainer);
            refreshIcons(extraContainer);
            setupVideoCardActionButtons(extraContainer);
        },
    });
}

async function renderPlaylistRelatedVideos(playlistName) {
    return SegueixApp.features.player?.renderPlaylistRelatedVideos?.(playlistName);
}

async function renderPlaylistRelatedVideosLegacyImpl(playlistName) {
    const extraContainer = extraVideosGrid || document.getElementById('extraVideosGrid');
    if (!extraContainer) {
        return;
    }
    // La ràdio (cua generada) no és una cerca: es mostren vídeos de la mateixa categoria
    // que el vídeo que sona, sense cap "resultat de cua".
    if (isPlaylistMode && activePlaylistId === '__music_queue__') {
        const playing = activePlaylistQueue[currentPlaylistIndex];
        renderCategoryVideosBelowLegacyImpl(playing?.channelId || null, playing?.id || currentVideoId);
        return;
    }
    const trimmedName = String(playlistName || '').trim();
    if (!trimmedName) {
        extraContainer.innerHTML = '<div class="empty-state">No hi ha vídeos relacionats.</div>';
        return;
    }

    setExtraRelatedTitle(`Resultats de la cerca: ${trimmedName}`);

    const videos = getPlaylistSearchVideos(trimmedName);

    if (videos.length === 0) {
        extraContainer.innerHTML = '<div class="empty-state">No hi ha vídeos relacionats.</div>';
        return;
    }

    batchRenderCards(extraContainer, videos, createVideoCardAPI, {
        onComplete: () => {
            ensureWatchGridLayoutControls();
            applyWatchGridLayoutPreference();
            setupDelegatedVideoCardClicks(extraContainer, 'api');
            bindChannelLinks(extraContainer);
            refreshIcons(extraContainer);
            setupVideoCardActionButtons(extraContainer);
        },
    });
}

// Mostrar vídeo des de l'API
async function showVideoFromAPI(videoId, options = {}) {
    return SegueixApp.features.player?.showVideoFromAPI?.(videoId, options);
}

async function showVideoFromAPILegacyImpl(videoId, options = {}) {
    // En TV la posició la governa l'ancoratge (focusTVPlayerViewport), que porta la
    // vista a dalt de seguida i l'hi manté: el window.scrollTo(0, 0) del final arribaria
    // tard —quan l'usuari ja pot haver baixat a la programació— i faria un salt.
    const keepTVPosition = isPlaylistNavigation && isPlaylistMode &&
        activePlaylistId === '__segueix_tv_discovery__';
    const keepSegueixTVCategoriesVisible =
        keepTVPosition && document.body.classList.contains('segueix-tv-active');
    exitMiniPlayerForNewVideo();
    const isMini = videoPlayer?.classList.contains('mini-player-active');
    if (!isPlaylistNavigation) {
        exitPlaylistMode();
    }
    currentVideoId = videoId;
    currentVideoSource = 'api';
    showLoading();

    // Actualitzar URL
    const startAt = Math.max(0, Math.floor(Number(options.startAt) || 0));
    const videoUrl = `?v=${videoId}${startAt > 0 ? `&t=${startAt}` : ''}`;
    if (options.replaceHistory) {
        history.replaceState({ videoId }, '', videoUrl);
    } else {
        history.pushState({ videoId }, '', videoUrl);
    }

    const launchedFromHistoryPage = Boolean(historyPage && !historyPage.classList.contains('hidden'));

    if (mainContent) {
        mainContent.classList.remove('hidden');
    }
    if (historyPage) {
        historyPage.classList.add('hidden');
    }
    if (playlistsPage) {
        playlistsPage.classList.add('hidden');
    }
    if (followPage) {
        followPage.classList.add('hidden');
    }
    if (channelPage) {
        channelPage.classList.add('hidden');
    }
    if (chipsBar) {
        chipsBar.classList.toggle('hidden', !keepSegueixTVCategoriesVisible);
        if (keepSegueixTVCategoriesVisible) {
            resetSegueixTVCategoriesScrollState({ show: true });
        }
    }
    homePage.classList.add('hidden');
    watchPage.classList.remove('hidden');
    collapseMobileHeaderForWatchPage();

    const sidebarChannelInfo = document.getElementById('sidebarChannelInfo');
    if (sidebarChannelInfo) {
        sidebarChannelInfo.innerHTML = '';
    }

    const sidebarChannelVideos = document.getElementById('sidebarChannelVideos');
    if (sidebarChannelVideos) {
        sidebarChannelVideos.innerHTML = '';
    }

    // 1. Renderitzat immediat des del catxé si està disponible
    const normalizedVideoId = String(videoId || '');

    // Construïm un array amb tots els vídeos coneguts per evitar pantalles en blanc
    const allKnownVideos = [
        ...(Array.isArray(YouTubeAPI?.feedVideos) ? YouTubeAPI.feedVideos : []),
        ...(Array.isArray(currentFeedVideos) ? currentFeedVideos : []),
        ...cachedAPIVideos,
    ];

    let cachedVideo = allKnownVideos.find(video => String(video?.id) === normalizedVideoId);
    let isArchivePlayback = cachedVideo?.source === 'archive';

    // Vídeo desconegut (arxiu, enllaç compartit d'un vídeo antic): cal l'índex d'arxiu
    // per saber-ne el títol i la miniatura. S'espera sempre —comprovar només que el
    // catxé estigui buit fallava si una càrrega en curs ja hi havia deixat altres
    // fragments— però amb límit de temps: el reproductor no pot quedar-hi bloquejat.
    if (!cachedVideo) {
        try {
            await withStartupTimeout(loadSearchArchiveIndex(), 5000, 'índex arxiu (reproductor)');
        } catch (error) {
            console.warn("L'índex d'arxiu no ha arribat a temps; obrim el vídeo igualment.", error);
        }
    }

    if (!cachedVideo) {
        const archiveVideoFromMap = archiveSearchVideoMap.get(normalizedVideoId);
        const archiveVideo = archiveVideoFromMap || getArchiveIndexVideoById(normalizedVideoId);
        if (archiveVideo) {
            rememberArchiveSearchVideos([archiveVideo]);
            cachedVideo = {
                id: String(archiveVideo.id),
                title: archiveVideo.title,
                thumbnail: archiveVideo.thumbnail || buildArchiveThumbnail(archiveVideo.id),
                channelId: archiveVideo.channelId || '',
                channelTitle: archiveVideo.channelTitle || getChannelNameById(archiveVideo.channelId),
                publishedAt: archiveVideo.publishedAt || '',
                viewCount: 0,
                source: 'archive',
            };
            cachedAPIVideos.push(cachedVideo);
            isArchivePlayback = true;
        }
    }

    if (!cachedVideo) {
        const historyVideo = getHistoryVideoById(normalizedVideoId);
        if (historyVideo) {
            cachedVideo = {
                ...historyVideo,
                id: String(historyVideo.id),
                thumbnail: historyVideo.thumbnail || buildArchiveThumbnail(historyVideo.id),
            };
            if (!cachedAPIVideos.find(video => String(video?.id) === normalizedVideoId)) {
                cachedAPIVideos.push(cachedVideo);
            }
            isArchivePlayback = cachedVideo?.source === 'archive' || cachedVideo?.historySource === 'archive';
        }
    }
    const shouldAutoPlay = isAutoPlayNavigating;
    if (isAutoPlayNavigating) {
        isAutoPlayNavigating = false;
    }

    // En pantalla completa el reproductor es manté viu i només canvia de vídeo: recrear
    // l'iframe en trauria l'usuari. La resta de la pàgina s'actualitza igualment.
    const swapped =
        options.keepLivePlayer === true &&
        canSwapLivePlayerVideo() &&
        swapLivePlayerVideo({
            videoId,
            startAt,
            thumbnail: cachedVideo?.thumbnail || '',
            title: cachedVideo?.title || '',
        });

    if (swapped) {
        // El reproductor ja té el vídeo nou: no es toca res més de la superfície.
    } else if (isMini) {
        queuePlayback({
            videoId,
            source: 'api',
            thumbnail: cachedVideo?.thumbnail || '',
            title: cachedVideo?.title || '',
        });
    } else {
        prepareWatchPlaybackPreview({
            videoId,
            source: 'api',
            startAt,
            thumbnail: cachedVideo?.thumbnail || '',
            title: cachedVideo?.title || '',
            autoPlay: shouldAutoPlay,
        });
    }
    if (cachedVideo) {
        addToHistory({
            ...cachedVideo,
            historySource: 'api',
        });
        setVideoTitleText(cachedVideo.title || '');
        document.getElementById('videoDate').textContent = cachedVideo.publishedAt
            ? formatDate(cachedVideo.publishedAt)
            : '';
        const showHistoryLabel = launchedFromHistoryPage || isArchivePlayback;
        setWatchVideoViewsText(
            showHistoryLabel ? 'Historial' : `${formatViews(cachedVideo.viewCount || 0)} visualitzacions`,
            { hide: !showHistoryLabel && isArchivePlayback && isDesktopView() }
        );

        const channelInfo = document.getElementById('channelInfo');
        if (channelInfo) {
            const cachedChannelTitle = cachedVideo.channelTitle || '';
            const channelList = Array.isArray(YouTubeAPI?.getAllChannels?.()) ? YouTubeAPI.getAllChannels() : [];
            const matchedChannel = channelList.find(
                channelItem => String(channelItem.id) === String(cachedVideo.channelId)
            );
            const cachedChannelAvatar = resolveChannelAvatar(
                cachedVideo.channelId,
                matchedChannel || { thumbnail: cachedVideo.channelThumbnail }
            );
            const channel = {
                id: cachedVideo.channelId || '',
                title: cachedChannelTitle,
                subscriberCount: matchedChannel?.subscriberCount,
            };
            const watchUrl = `https://www.youtube.com/watch?v=${cachedVideo.id || videoId}`;
            channelInfo.innerHTML = buildWatchChannelInfoHtml(channel, cachedChannelAvatar, watchUrl, cachedVideo);
            bindLikeButton(channelInfo, cachedVideo);
            setupMiniPlayerToggle();
            bindFollowButtons(channelInfo);
            bindChannelLinks(channelInfo);
            bindSupportButtons(channelInfo);
            repositionSupportButton();
            ensureRepositionSupportResizeListener();
            const playlistBtn = document.getElementById('playlistBtn');
            if (playlistBtn) {
                playlistBtn.addEventListener('click', () => {
                    openPlaylistModal(getPlaylistVideoData(cachedVideo));
                });
            }
        }
    }

    // 2. Enriquiment progressiu via API
    let video;
    let channelResult;
    try {
        const videoResult = await YouTubeAPI.getVideoDetails(videoId);

        if (videoResult.video) {
            video = videoResult.video;
            addToHistory({
                ...video,
                historySource: 'api',
            });
            if (isMini) {
                queuePlayback({
                    videoId,
                    source: 'api',
                    thumbnail: video.thumbnail,
                    title: video.title,
                });
            } else {
                setPlaceholderImage(video.thumbnail, video.title);
            }

            // 1. Actualitzar estadístiques principals
            setVideoTitleText(video.title);
            document.getElementById('videoDate').textContent = formatDate(video.publishedAt);
            const showHistoryLabel = launchedFromHistoryPage || isArchivePlayback;
            setWatchVideoViewsText(showHistoryLabel ? 'Historial' : `${formatViews(video.viewCount)} visualitzacions`, {
                hide: !showHistoryLabel && isArchivePlayback && isDesktopView(),
            });

            // Obtenir informació del canal
            channelResult = await YouTubeAPI.getChannelDetails(video.channelId);

            if (channelResult.channel) {
                const channel = channelResult.channel;
                const currentVideo = video;
                const channelInfo = document.getElementById('channelInfo');
                const watchUrl = `https://www.youtube.com/watch?v=${video.id || videoId}`;
                const channelList = Array.isArray(YouTubeAPI?.getAllChannels?.()) ? YouTubeAPI.getAllChannels() : [];
                const matchedChannel = channelList.find(
                    channelItem => String(channelItem.id) === String(currentVideo.channelId)
                );
                const channelAvatar = resolveChannelAvatar(channel.id, { ...channel, ...matchedChannel });
                channelInfo.innerHTML = buildWatchChannelInfoHtml(channel, channelAvatar, watchUrl, currentVideo);
                bindLikeButton(channelInfo, video);
                setupMiniPlayerToggle();
                bindFollowButtons(channelInfo);
                bindChannelLinks(channelInfo);
                bindSupportButtons(channelInfo);
                repositionSupportButton();
                ensureRepositionSupportResizeListener();
                const playlistBtn = document.getElementById('playlistBtn');
                if (playlistBtn) {
                    playlistBtn.addEventListener('click', () => {
                        openPlaylistModal(getPlaylistVideoData(video));
                    });
                }
            }
        }
    } catch (error) {
        console.warn("L'API ha fallat, però almenys es veu la info bàsica", error);
    }

    // Mostrar la pàgina immediatament, renderitzar vídeos relacionats de forma diferida
    if (!keepTVPosition) {
        window.scrollTo(0, 0);
    }
    hideLoading();
    refreshIcons(watchPage);

    // Diferir el renderitzat pesat (vídeos relacionats, sidebar) al següent frame
    // perquè el navegador pugui pintar la pàgina del vídeo primer
    const channelId = video?.channelId || cachedVideo?.channelId;
    requestAnimationFrame(() => {
        if (isPlaylistMode) {
            renderPlaylistQueue();
            if (channelId) {
                renderChannelSidebarFromApi(
                    channelId,
                    videoId,
                    channelResult,
                    video?.channelTitle || cachedVideo?.channelTitle || ''
                );
            }
            renderPlaylistRelatedVideos(activePlaylistName);
        } else if (CONFIG.features.recommendations) {
            if (channelId && isDesktopView()) {
                renderChannelSidebarFromApi(
                    channelId,
                    videoId,
                    channelResult,
                    video?.channelTitle || cachedVideo?.channelTitle || ''
                );
            }
            renderCategoryVideosBelow(channelId || null, videoId);
        }
        setupVideoCardActionButtons();
        saveViewState();
    });
}

// ==================== DADES ESTÀTIQUES (FALLBACK) ====================

// Carregar vídeos estàtics
function loadVideos() {
    return SegueixApp.features.feed?.loadVideos?.();
}

// Fallback estàtic (quan no hi ha API)
async function loadVideosLegacyImpl() {
    setPageTitle('Recomanat per a tu');

    if (Array.isArray(YouTubeAPI?.feedVideos) && YouTubeAPI.feedVideos.length > 0) {
        setFeedContext(YouTubeAPI.feedVideos, getFeedDataForFilter(), renderVideos);
        return;
    }

    // Reintent explícit del feed abans de caure al fallback buit.
    await YouTubeAPI.loadFeed();
    if (Array.isArray(YouTubeAPI?.feedVideos) && YouTubeAPI.feedVideos.length > 0) {
        setFeedContext(YouTubeAPI.feedVideos, getFeedDataForFilter(), renderVideos);
        return;
    }

    setFeedContext(VIDEOS, getFeedDataForFilter(), renderStaticVideos);
}

function renderStaticVideos(videos) {
    ensureGridLayoutControls();
    applyGridLayoutPreference();
    const featured = getFeaturedVideoForSection(videos, getHeroSectionKey());
    updateHero(featured, 'static');
    const listVideos = featured ? videos.filter(video => String(video.id) !== String(featured.id)) : videos;

    setupDelegatedVideoCardClicks(videosGrid, 'static');
    bindChannelLinks(videosGrid);

    batchRenderCards(videosGrid, listVideos, createVideoCard, {
        onComplete: () => {
            refreshIcons(videosGrid);
            setupVideoCardActionButtons(videosGrid);
        },
    });

    requestAnimationFrame(() => refreshIcons(videosGrid));
}

// Carregar vídeos per categoria (estàtic)
function loadVideosByCategoryStatic(categoryId) {
    ensureGridLayoutControls();
    applyGridLayoutPreference();
    const videos = getVideosByCategory(categoryId);
    const category = CONFIG.categories.find(c => c.id === categoryId);
    renderCategoryActions(category ? category.name : 'Categoria');
    const featured = getFeaturedVideoForSection(videos, getHeroSectionKey());
    updateHero(featured, 'static');
    const listVideos = featured ? videos.filter(video => String(video.id) !== String(featured.id)) : videos;

    setupDelegatedVideoCardClicks(videosGrid, 'static');
    bindChannelLinks(videosGrid);

    batchRenderCards(videosGrid, listVideos, createVideoCard, {
        onComplete: () => refreshIcons(videosGrid),
    });

    requestAnimationFrame(() => refreshIcons(videosGrid));
}

// Crear targeta de vídeo (estàtic)
function createVideoCard(video) {
    const channel = getChannelById(video.channelId);
    const payload = encodeURIComponent(JSON.stringify(getPlaylistVideoData(video)));

    return `
        <div class="video-card" data-video-id="${video.id}">
            <div class="video-thumbnail">
                <img src="${video.thumbnail}" alt="${video.title}" loading="lazy">
                <span class="video-duration-badge">${video.duration}</span>
            </div>
            <div class="video-details">
                <img src="${channel.avatar}" alt="${channel.name}" class="channel-avatar channel-link" data-channel-id="${channel.id}">
                <div class="video-info-container">
                    <div class="video-info-header">
                        <h3 class="video-card-title">${video.title}</h3>
                        <div class="video-card-actions">
                            <button class="video-action-btn playlist-action" type="button" data-playlist-video="${payload}" aria-label="Afegir a una llista">
                                ${PLAYLIST_ICON_SVG}
                            </button>
                        </div>
                    </div>
                    <div class="video-metadata">
                        <div class="channel-name channel-link" data-channel-id="${channel.id}">${channel.name}</div>
                        <div class="video-stats">
                            <i data-lucide="eye" style="width: 12px; height: 12px;"></i>
                            <span>${formatViews(video.views)} vis.</span>
                            <span>•</span>
                            <span>${formatDate(video.uploadDate)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function stopVideoPlayback() {
    if (videoPlayer) {
        videoPlayer.innerHTML = '';
        videoPlayer.classList.remove('mini-player-active');
        videoPlayer.style.display = 'none';
        videoPlayer.style.width = '';
        videoPlayer.style.height = '';
        videoPlayer.style.top = '';
        videoPlayer.style.left = '';
    }
    // Invalidar cache de posició perquè updatePlayerPosition torni a aplicar estils
    _lastPlayerRect = { top: 0, left: 0, width: 0, height: 0 };
    if (videoPlaceholder) {
        videoPlaceholder.classList.add('hidden');
        videoPlaceholder.classList.remove('is-placeholder-hidden');
    }
    if (placeholderImage) {
        placeholderImage.src = '';
        placeholderImage.alt = '';
    }
    currentVideoId = null;
    currentVideoSource = null;
}

// Mostrar pàgina principal
function showHome(options) {
    const navigationFeature = SegueixApp.features.navigation;
    if (navigationFeature && typeof navigationFeature.showHome === 'function') {
        return navigationFeature.showHome(options);
    }
}

// Reproduir i navegar: inicia la reproducció de l'iframe i després obre la pàgina del vídeo
function playThenNavigate(videoId, source) {
    // Cua de cançons amb l'ordenació de Música TV (js/features/music-queue.js)
    if (SegueixApp.features.musicQueue?.startFrom?.(videoId, source)) return;
    return SegueixApp.features.player?.playThenNavigate?.(videoId, source);
}

function openVideoFromUserGesture(videoId, source = 'api') {
    if (!videoId) {
        return;
    }

    const normalizedSource = source === 'static' ? 'static' : 'api';
    playThenNavigate(videoId, normalizedSource);
}

function playThenNavigateLegacyImpl(videoId, source) {
    clearEmbeddedYouTubeSession();
    isAutoPlayNavigating = true;

    // Fase 1: naveguem primer i només carregarem el reproductor
    // quan el flux de consentiment explícit ho permeti.
    if (source === 'api') {
        showVideoFromAPI(videoId);
    } else {
        showVideo(videoId);
    }
}

// Mostrar vídeo (estàtic)
function showVideo(videoId, options = {}) {
    return SegueixApp.features.player?.showVideo?.(videoId, options);
}

function showVideoLegacyImpl(videoId, options = {}) {
    // En TV la posició la governa l'ancoratge (focusTVPlayerViewport), que porta la
    // vista a dalt de seguida i l'hi manté: el window.scrollTo(0, 0) del final arribaria
    // tard —quan l'usuari ja pot haver baixat a la programació— i faria un salt.
    const keepTVPosition = isPlaylistNavigation && isPlaylistMode &&
        activePlaylistId === '__segueix_tv_discovery__';
    const keepSegueixTVCategoriesVisible =
        keepTVPosition && document.body.classList.contains('segueix-tv-active');
    exitMiniPlayerForNewVideo();
    const isMini = videoPlayer?.classList.contains('mini-player-active');
    if (!isPlaylistNavigation) {
        exitPlaylistMode();
    }
    currentVideoId = videoId;
    currentVideoSource = 'static';
    const video = getVideoById(videoId);
    if (!video) {
        return;
    }
    const channel = getChannelById(video.channelId);

    addToHistory({
        ...video,
        historySource: 'static',
    });

    const startAt = Math.max(0, Math.floor(Number(options.startAt) || 0));
    const videoUrlWithTime = `?v=${videoId}${startAt > 0 ? `&t=${startAt}` : ''}`;
    if (options.replaceHistory) {
        history.replaceState({ videoId }, '', videoUrlWithTime);
    } else {
        history.pushState({ videoId }, '', videoUrlWithTime);
    }

    const launchedFromHistoryPage = Boolean(historyPage && !historyPage.classList.contains('hidden'));

    if (mainContent) {
        mainContent.classList.remove('hidden');
    }
    if (historyPage) {
        historyPage.classList.add('hidden');
    }
    if (followPage) {
        followPage.classList.add('hidden');
    }
    if (channelPage) {
        channelPage.classList.add('hidden');
    }
    if (playlistsPage) {
        playlistsPage.classList.add('hidden');
    }
    if (chipsBar) {
        chipsBar.classList.toggle('hidden', !keepSegueixTVCategoriesVisible);
        if (keepSegueixTVCategoriesVisible) {
            resetSegueixTVCategoriesScrollState({ show: true });
        }
    }
    homePage.classList.add('hidden');
    watchPage.classList.remove('hidden');
    collapseMobileHeaderForWatchPage();

    const shouldAutoPlay = isAutoPlayNavigating;
    if (isAutoPlayNavigating) {
        isAutoPlayNavigating = false;
    }

    if (isMini) {
        queuePlayback({
            videoId,
            source: 'static',
            videoUrl: video.videoUrl,
            thumbnail: video.thumbnail,
            title: video.title,
        });
    } else {
        prepareWatchPlaybackPreview({
            videoId,
            source: 'static',
            videoUrl: video.videoUrl,
            startAt,
            thumbnail: video.thumbnail,
            title: video.title,
            autoPlay: shouldAutoPlay,
        });
    }

    // 1. Actualitzar estadístiques principals
    setVideoTitleText(video.title);
    document.getElementById('videoDate').textContent = formatDate(video.uploadDate);
    setWatchVideoViewsText(launchedFromHistoryPage ? 'Historial' : `${formatViews(video.views)} visualitzacions`, {
        hide: false,
    });

    // 2. Mostrar Likes
    const channelInfo = document.getElementById('channelInfo');
    const watchUrl = video.videoUrl
        ? video.videoUrl.replace('embed/', 'watch?v=')
        : `https://www.youtube.com/watch?v=${videoId}`;
    channelInfo.innerHTML = buildWatchChannelInfoHtml(channel, channel.avatar || 'img/icon-192.png', watchUrl, video);
    const likeVideoData = {
        ...video,
        channel: {
            id: channel.id,
            name: channel.name,
        },
    };
    bindLikeButton(channelInfo, likeVideoData);
    setupMiniPlayerToggle();
    bindFollowButtons(channelInfo);
    bindChannelLinks(channelInfo);
    bindSupportButtons(channelInfo);
    repositionSupportButton();
    ensureRepositionSupportResizeListener();
    const playlistBtn = document.getElementById('playlistBtn');
    if (playlistBtn) {
        playlistBtn.addEventListener('click', () => {
            openPlaylistModal(getPlaylistVideoData(video));
        });
    }

    if (isPlaylistMode) {
        renderPlaylistQueue();
        renderChannelSidebarFromStatic(channel, videoId);
        renderPlaylistRelatedVideos(activePlaylistName);
    } else if (CONFIG.features.recommendations) {
        loadRelatedVideos(videoId);
    }

    if (!keepTVPosition) {
        window.scrollTo(0, 0);
    }
    saveViewState();

    refreshIcons(watchPage);
}

// Historial i filtres de biblioteca — cache en memòria per evitar re-parse
let _historyItemsCache = null;
let _historyIdSetCache = null;

function invalidateHistoryCache() {
    _historyItemsCache = null;
    _historyIdSetCache = null;
}

function getHistoryItems() {
    if (_historyItemsCache) return _historyItemsCache;
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!stored) {
        _historyItemsCache = [];
        return _historyItemsCache;
    }
    try {
        const parsed = JSON.parse(stored);
        _historyItemsCache = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('No es pot llegir catube_history', error);
        _historyItemsCache = [];
    }
    return _historyItemsCache;
}

function saveHistoryItems(items) {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items));
    invalidateHistoryCache();
}

function getHistoryVideoIdSet() {
    if (_historyIdSetCache) return _historyIdSetCache;
    _historyIdSetCache = new Set(getHistoryItems().map(item => String(item.id)));
    return _historyIdSetCache;
}

function getHistoryVideoById(videoId) {
    const normalizedId = String(videoId || '');
    if (!normalizedId) {
        return null;
    }
    return getHistoryItems().find(item => String(item?.id) === normalizedId) || null;
}

function getArchiveIndexVideoById(videoId) {
    const normalizedId = String(videoId || '');
    if (!normalizedId || !Array.isArray(searchArchiveIndexCache)) {
        return null;
    }

    const indexItem = searchArchiveIndexCache.find(item => String(item?.i || '') === normalizedId);
    if (!indexItem) {
        return null;
    }

    return {
        id: normalizedId,
        title: indexItem?.t || '',
        channelId: indexItem?.c || '',
        channelTitle: getChannelNameById(indexItem?.c),
        publishedAt: indexItem?.d || '',
        durationSeconds: Number(indexItem?.s || 0),
        thumbnail: buildArchiveThumbnail(normalizedId),
        source: 'archive',
    };
}

function filterOutWatchedVideos(videos) {
    const watchedIds = getHistoryVideoIdSet();
    if (!Array.isArray(videos) || videos.length === 0 || watchedIds.size === 0) {
        return videos;
    }
    return videos.filter(video => !watchedIds.has(String(video.id)));
}

function addToHistory(video) {
    if (!video || video.id === undefined || video.id === null) {
        return;
    }

    // Diferir l'escriptura a localStorage per no bloquejar el fil principal
    // durant la resposta al toc de l'usuari
    const videoSnapshot = { ...video };
    const deferHistory =
        typeof requestIdleCallback === 'function' ? cb => requestIdleCallback(cb) : cb => setTimeout(cb, 0);
    deferHistory(() => {
        const history = getHistoryItems();
        const normalizedId = String(videoSnapshot.id);
        const existingIndex = history.findIndex(item => String(item.id) === normalizedId);

        if (existingIndex !== -1) {
            history.splice(existingIndex, 1);
        }

        const historyEntry = {
            ...videoSnapshot,
            viewedAt: new Date().toISOString(),
        };

        history.unshift(historyEntry);

        if (history.length > HISTORY_LIMIT) {
            history.length = HISTORY_LIMIT;
        }

        saveHistoryItems(history);
    });
}

function getStaticCategoryName(video) {
    const map = {
        1: 'Vida',
        2: 'Gaming',
        3: 'Cultura',
        4: 'El Món',
        5: 'Diversió',
    };
    return map[video.categoryId] || null;
}

function getHistoryVideoCategories(video) {
    if (!video) return [];
    if (Array.isArray(video.categories) && video.categories.length > 0) {
        return video.categories;
    }
    if (video.categoryName) {
        return [video.categoryName];
    }
    if (video.category) {
        return [video.category];
    }
    if (video.categoryId) {
        const mapped = getStaticCategoryName(video);
        return mapped ? [mapped] : [];
    }
    return [];
}

function getFilteredHistoryItems() {
    const history = getHistoryItems();
    const likedIds = getLikedVideoIds();
    let filtered = history;

    if (historyFilterLiked) {
        filtered = filtered.filter(video => likedIds.includes(String(video.id)));
    }

    if (historySelectedCategory === 'Shorts') {
        filtered = filtered.filter(video => video.isShort === true);
    } else {
        filtered = filtered.filter(video => !video.isShort);
        if (historySelectedCategory !== 'Tot') {
            const wanted = historySelectedCategory.toLowerCase();
            filtered = filtered.filter(video =>
                getHistoryVideoCategories(video).some(cat => String(cat).toLowerCase() === wanted)
            );
        }
    }

    return filtered;
}

function resolveHistorySource(video) {
    if (!video) return 'api';

    if (video.historySource) {
        return video.historySource;
    }

    if (video.source === 'archive') {
        return 'archive';
    }

    if (video.videoUrl) {
        return 'static';
    }

    const normalizedId = String(video.id || '');
    if (normalizedId && getVideoById(normalizedId)) {
        return 'static';
    }

    return 'api';
}

function updateHistoryFilterUI() {
    if (!historyFilters) return;

    historyFilters.querySelectorAll('[data-history-cat]').forEach(chip => {
        const isActive = chip.dataset.historyCat === historySelectedCategory;
        chip.classList.toggle('is-active', isActive);
        chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    const likedChip = historyFilters.querySelector('[data-history-filter="liked"]');
    if (likedChip) {
        likedChip.classList.toggle('is-active', historyFilterLiked);
        likedChip.setAttribute('aria-pressed', historyFilterLiked ? 'true' : 'false');
    }
}

function createHistoryCard(video) {
    const source = resolveHistorySource(video);
    const isShort = video.isShort;
    const isStatic = source === 'static';
    const channel = isStatic ? getChannelById(video.channelId) : null;
    const title = video.title || video.snippet?.title || '';
    const thumbnail =
        video.thumbnail ||
        video.snippet?.thumbnails?.maxres?.url ||
        video.snippet?.thumbnails?.standard?.url ||
        video.snippet?.thumbnails?.high?.url ||
        '';
    const duration = getVideoDisplayDuration(video);
    const channelTitle = video.channelTitle || channel?.name || '';
    const publishedAt = video.publishedAt || video.uploadDate || video.snippet?.publishedAt || '';
    const publishedAtLabel = publishedAt ? formatDate(publishedAt) : '';
    const views = video.viewCount || video.views || 0;
    const isArchive = source === 'archive';
    const payload = encodeURIComponent(JSON.stringify(getPlaylistVideoData(video)));
    const radarLabel = getRadarCategoryLabel(video);

    return `
        <div class="video-card" data-video-id="${video.id}" data-video-source="${source}">
            <div class="video-thumbnail${isShort ? ' is-short' : ''}">
                <img src="${thumbnail}" alt="${escapeHtml(title)}" loading="lazy">
                <button class="delete-history-btn" type="button" aria-label="Eliminar de l'historial" data-history-id="${video.id}">
                    <i data-lucide="x"></i>
                </button>
                <span class="history-indicator-badge" aria-label="Historial" title="Vídeo de l'historial">
                    <i data-lucide="history"></i>
                </span>
                ${radarLabel ? `<span class="radar-category-label radar-category-label--top-right">${escapeHtml(radarLabel)}</span>` : ''}
                ${isShort ? '<span class="video-short-badge">SHORT</span>' : ''}
                ${duration ? `<span class="video-duration-badge">${duration}</span>` : ''}
            </div>
            <div class="video-details">
                ${channel ? `<img src="${channel.avatar}" alt="${escapeHtml(channel.name)}" class="channel-avatar channel-link" data-channel-id="${channel.id}">` : ''}
                <div class="video-info-container">
                    <div class="video-info-header">
                        <h3 class="video-card-title">${escapeHtml(title)}</h3>
                        <div class="video-card-actions">
                            <button class="video-action-btn playlist-action" type="button" data-playlist-video="${payload}" aria-label="Afegir a una llista">
                                ${PLAYLIST_ICON_SVG}
                            </button>
                        </div>
                    </div>
                    <div class="video-metadata">
                        <div class="channel-name channel-link" data-channel-id="${video.channelId || channel?.id || ''}">
                            ${escapeHtml(channelTitle)}${isArchive && publishedAtLabel ? ` <span>• ${escapeHtml(publishedAtLabel)}</span>` : ''}
                        </div>
                        ${
                            isArchive
                                ? ''
                                : `<div class="video-stats">
                                <i data-lucide="eye" style="width: 12px; height: 12px;"></i>
                                <span>${formatViews(views)} vis.</span>
                                ${publishedAtLabel ? `<span>• ${escapeHtml(publishedAtLabel)}</span>` : ''}
                            </div>`
                        }
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderShortsHistoryCarousel(items) {
    const groups = new Map();
    items.forEach(video => {
        const viewedAt = video.viewedAt || video.publishedAt || video.uploadDate || '';
        const label = viewedAt ? formatDate(viewedAt) : 'Sense data';
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label).push(video);
    });

    let html = '';
    groups.forEach((videos, label) => {
        const carouselItems = videos
            .map(video => {
                const thumbnail =
                    video.thumbnail ||
                    video.snippet?.thumbnails?.maxres?.url ||
                    video.snippet?.thumbnails?.high?.url ||
                    video.snippet?.thumbnails?.medium?.url ||
                    '';
                const title = video.title || video.snippet?.title || '';
                return `
                <div class="short-history-item" data-video-id="${video.id}" role="button" tabindex="0" aria-label="${escapeHtml(title)}">
                    <button class="short-history-delete" type="button" aria-label="Eliminar de l'historial" data-history-id="${video.id}">×</button>
                    <img src="${thumbnail}" alt="${escapeHtml(title)}" loading="lazy">
                    <div class="short-history-item-title">${escapeHtml(title)}</div>
                </div>`;
            })
            .join('');
        html += `<h2 class="history-group-title">${escapeHtml(label)}</h2>
            <div class="shorts-history-carousel">${carouselItems}</div>`;
    });

    historyGrid.innerHTML = html;

    historyGrid.querySelectorAll('.short-history-item').forEach(item => {
        item.addEventListener('click', () => openShortModal(item.dataset.videoId));
    });

    historyGrid.querySelectorAll('.short-history-delete').forEach(btn => {
        btn.addEventListener('click', event => {
            event.stopPropagation();
            const targetId = btn.dataset.historyId;
            saveHistoryItems(getHistoryItems().filter(item => String(item.id) !== String(targetId)));
            renderHistory();
        });
    });
}

function renderHistory() {
    if (!historyGrid) return;

    const historyItems = getFilteredHistoryItems();
    const totalHistoryItems = getHistoryItems();
    // Ordenar amb dates pre-calculades per evitar crear Date a cada comparació
    historyItems.forEach(item => {
        item._sortTime = new Date(item.viewedAt || item.publishedAt || item.uploadDate || 0).getTime();
    });
    historyItems.sort((a, b) => b._sortTime - a._sortTime);

    if (historyItems.length === 0) {
        historyGrid.classList.remove('is-shorts');
        const message =
            totalHistoryItems.length === 0
                ? "Encara no hi ha vídeos a l'historial."
                : 'No hi ha vídeos que coincideixin amb aquests filtres.';
        historyGrid.innerHTML = `<div class="empty-state">${message}</div>`;
        return;
    }

    if (historySelectedCategory === 'Shorts') {
        historyGrid.classList.add('is-shorts');
        renderShortsHistoryCarousel(historyItems);
        refreshIcons(historyGrid);
        return;
    }

    historyGrid.classList.remove('is-shorts');

    // Pre-calcular headings per cada item
    let currentLabel = null;
    const itemsWithHeadings = historyItems.map(video => {
        const viewedAt = video.viewedAt || video.publishedAt || video.uploadDate || video.snippet?.publishedAt || '';
        const label = viewedAt ? formatDate(viewedAt) : 'Sense data';
        const heading = label !== currentLabel ? `<h2 class="history-group-title">${escapeHtml(label)}</h2>` : '';
        currentLabel = label;
        return { video, heading };
    });

    // Batch rendering per l'historial
    const createHistoryEntry = entry => `${entry.heading}${createHistoryCard(entry.video)}`;

    batchRenderCards(historyGrid, itemsWithHeadings, createHistoryEntry, {
        maxVisible: 0,
        onComplete: () => {
            refreshIcons(historyGrid);
        },
    });

    // Delegated event handler: 1 listener per tot el grid en lloc de N per targeta
    _bindHistoryGridDelegated();

    // Icones del primer lot
    requestAnimationFrame(() => {
        refreshIcons(historyGrid);
    });
}

// Listener delegat persistent per historyGrid (s'assigna una sola vegada)
function _bindHistoryGridDelegated() {
    if (!historyGrid || historyGrid.dataset.delegated === 'true') return;
    historyGrid.dataset.delegated = 'true';
    historyGrid.addEventListener('click', e => {
        // Botó d'eliminar
        const deleteBtn = e.target.closest('.delete-history-btn');
        if (deleteBtn) {
            e.stopPropagation();
            const targetId = deleteBtn.dataset.historyId;
            const items = getHistoryItems().filter(item => String(item.id) !== String(targetId));
            saveHistoryItems(items);
            renderHistory();
            return;
        }
        // Enllaç de canal
        const channelLink = e.target.closest('[data-channel-id]');
        if (channelLink && !e.target.closest('.video-card')) {
            return; // Deixar que bindChannelLinks ho gestioni
        }
        // Clic a targeta de vídeo
        const card = e.target.closest('.video-card');
        if (card) {
            const videoId = card.dataset.videoId;
            const source = card.dataset.videoSource;
            openVideoFromUserGesture(videoId, source);
        }
    });
    bindChannelLinks(historyGrid);
}

function showHistory() {
    const navigationFeature = SegueixApp.features.navigation;
    if (navigationFeature && typeof navigationFeature.showHistory === 'function') {
        return navigationFeature.showHistory();
    }
}

// Vistes de biblioteca (playlists, seguits, smart categories)
function setActiveLibraryTab(tabId) {
    activeLibraryTab = tabId;
    if (libraryTabs) {
        libraryTabs.querySelectorAll('.library-tab').forEach(tab => {
            tab.classList.toggle('is-active', tab.dataset.libraryTab === tabId);
        });
    }
    const panelPlaylists = document.getElementById('libraryTabPlaylists');
    const panelSmartCats = document.getElementById('libraryTabSmartCategories');
    if (panelPlaylists) panelPlaylists.classList.toggle('hidden', tabId !== 'playlists');
    if (panelSmartCats) panelSmartCats.classList.toggle('hidden', tabId !== 'smart-categories');

    if (tabId === 'smart-categories') {
        renderSmartCategoriesTab();
    } else {
        renderPlaylistsPage();
    }
}

function renderSmartCategoriesTab() {
    if (!smartCategoriesList) return;

    const allTags = getCustomTags();
    const channelCatsRaw = JSON.parse(localStorage.getItem(CHANNEL_CUSTOM_CATEGORIES_KEY) || '{}');

    const categoriesWithChannels = allTags
        .map(tag => {
            const channelIds = Object.entries(channelCatsRaw)
                .filter(([, cats]) => cats.some(c => normalizeCustomTag(String(c)).toLowerCase() === tag.toLowerCase()))
                .map(([id]) => id);
            return { tag, channelIds };
        })
        .filter(({ channelIds }) => channelIds.length > 0);

    if (categoriesWithChannels.length === 0) {
        smartCategoriesList.innerHTML =
            '<div class="playlist-empty">No tens cap categoria intel·ligent amb canals assignats.</div>';
        return;
    }

    // Mapa id→canal des de feedChannels (font amb avatar real)
    const feedChannelMap = new Map(
        (Array.isArray(YouTubeAPI?.getAllChannels?.()) ? YouTubeAPI.getAllChannels() : []).map(ch => [
            String(ch.id),
            ch,
        ])
    );

    smartCategoriesList.innerHTML = categoriesWithChannels
        .map(({ tag, channelIds }) => {
            // Portada: vídeo amb més visualitzacions entre tots els canals de la categoria
            const categoryVideos = (cachedAPIVideos || []).filter(v => channelIds.includes(String(v.channelId)));
            const topViewedResult = getMostViewedVideoFromList(categoryVideos);

            const fallbackFeedChannel = feedChannelMap.get(String(channelIds[0]));
            const fallbackAvatar =
                fallbackFeedChannel?.avatar ||
                fallbackFeedChannel?.thumbnail ||
                resolveChannelAvatar(channelIds[0], cachedChannels[channelIds[0]] || {}) ||
                'img/icon-192.png';
            const thumbUrl = escapeHtml(topViewedResult?.video?.thumbnail || fallbackAvatar);

            const channelsMarkup = channelIds
                .map(channelId => {
                    const feedCh = feedChannelMap.get(String(channelId));
                    const avatar =
                        feedCh?.avatar ||
                        feedCh?.thumbnail ||
                        resolveChannelAvatar(channelId, cachedChannels[channelId] || {}) ||
                        'img/icon-192.png';
                    const name = feedCh?.name || cachedChannels[channelId]?.name || channelId;
                    return `
                <div class="smart-cat-channel-row">
                    <img class="smart-cat-channel-avatar" src="${escapeHtml(avatar)}" alt="${escapeHtml(name)}" loading="lazy">
                    <span class="smart-cat-channel-name">${escapeHtml(name)}</span>
                    <button class="smart-cat-channel-remove"
                            data-category="${escapeHtml(tag)}"
                            data-channel-id="${escapeHtml(channelId)}"
                            title="Eliminar ${escapeHtml(name)} d'aquesta categoria"
                            aria-label="Eliminar ${escapeHtml(name)}">×</button>
                </div>`;
                })
                .join('');

            const count = channelIds.length;
            return `
            <div class="smart-category-card">
                <button class="smart-cat-delete-btn"
                        data-category="${escapeHtml(tag)}"
                        title="Eliminar categoria"
                        aria-label="Eliminar categoria ${escapeHtml(tag)}">×</button>
                <div class="smart-cat-thumb">
                    <img src="${thumbUrl}" alt="" loading="lazy">
                </div>
                <div class="smart-cat-body">
                    <div class="smart-category-name">${escapeHtml(tag)}</div>
                    <button class="btn-round-icon library-share-btn smart-cat-share-btn"
                            data-category="${escapeHtml(tag)}"
                            data-channels="${channelIds.map(encodeURIComponent).join(',')}"
                            title="Compartir categoria">
                        <i data-lucide="share-2"></i>
                    </button>
                    <div class="smart-category-meta">${count} canal${count !== 1 ? 's' : ''}</div>
                    <div class="smart-cat-channels-list">${channelsMarkup}</div>
                </div>
            </div>`;
        })
        .join('');

    refreshIcons(smartCategoriesList);
}

function showPlaylists() {
    const navigationFeature = SegueixApp.features.navigation;
    if (navigationFeature && typeof navigationFeature.showPlaylists === 'function') {
        return navigationFeature.showPlaylists();
    }
}

function showFollow(tab = 'all', options = {}) {
    const navigationFeature = SegueixApp.features.navigation;
    if (navigationFeature && typeof navigationFeature.showFollow === 'function') {
        return navigationFeature.showFollow(tab, options);
    }
}

function initAddYoutuberModal() {
    if (!addYoutuberModal) return;

    const closeBtn = document.getElementById('closeAddYoutuberModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeAddYoutuberModal);
    }
    addYoutuberModal.addEventListener('click', e => {
        if (e.target === addYoutuberModal) closeAddYoutuberModal();
    });

    const submitBtn = document.getElementById('addYoutuberSubmitBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitYoutuber);
    }
}

function openAddYoutuberModal() {
    if (!addYoutuberModal) return;
    const wasActive = addYoutuberModal.classList.contains('active');
    addYoutuberModal.classList.add('active');
    if (!wasActive) {
        history.pushState({ ...(history.state || {}), modal: 'add-youtuber' }, '', window.location.href);
    }
    // Deixa respirar el fil principal abans de parsejar SVGs
    setTimeout(() => {
        requestAnimationFrame(() => refreshIcons(addYoutuberModal));
    }, 50);
}

function stopAddYoutuberVideo() {
    const videoFrame = addYoutuberModal?.querySelector('.afegeix-youtuber iframe');
    if (!videoFrame) return;

    const videoSrc = videoFrame.getAttribute('src');
    videoFrame.setAttribute('src', '');
    videoFrame.setAttribute('src', videoSrc);
}

function closeAddYoutuberModal(fromPopstate = false) {
    if (!addYoutuberModal) return;
    const wasActive = addYoutuberModal.classList.contains('active');
    addYoutuberModal.classList.remove('active');
    if (wasActive) {
        stopAddYoutuberVideo();
    }
    if (wasActive && !fromPopstate && history.state && history.state.modal === 'add-youtuber') {
        suppressNextPopstateNavigation = true;
        history.back();
    }
}

function submitYoutuber() {
    const formUrl = CONFIG?.forms?.suggestYoutuberUrl;
    const messageDiv = document.getElementById('addYoutuberMessage');

    if (!formUrl) {
        if (messageDiv) {
            messageDiv.textContent = 'No s’ha configurat encara l’enllaç del formulari.';
            messageDiv.className = 'add-youtuber-message add-youtuber-message--error';
            messageDiv.classList.remove('hidden');
        }
        return;
    }

    if (messageDiv) {
        messageDiv.classList.add('hidden');
    }

    const userAgent = navigator.userAgent || '';
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isStandaloneDesktopApp = window.matchMedia('(display-mode: standalone)').matches && !isMobileDevice;

    if (isStandaloneDesktopApp) {
        closeAddYoutuberModal();
        window.location.assign(formUrl);
        return;
    }

    const newWindow = window.open(formUrl, '_blank', 'noopener,noreferrer');
    if (!newWindow) {
        window.location.href = formUrl;
        return;
    }

    closeAddYoutuberModal();
}

async function openChannelProfile(channelId) {
    return SegueixApp.features.channel?.openChannelProfile?.(channelId);
}

async function openChannelProfileLegacyImpl(channelId) {
    if (!channelId) {
        return;
    }
    // Guardar la posició de scroll si venim de la pàgina Segueix
    if (followPage && !followPage.classList.contains('hidden')) {
        segueixScrollYBeforeChannel = window.scrollY;
    } else {
        segueixScrollYBeforeChannel = null;
    }
    handlePlayerVisibilityOnNavigation();
    exitPlaylistMode();
    const normalizedId = String(channelId);
    const channels = Array.isArray(YouTubeAPI?.getAllChannels?.()) ? YouTubeAPI.getAllChannels() : [];
    const channel = channels.find(item => String(item.id) === normalizedId);
    if (!channelPage || !channelVideosGrid) {
        return;
    }

    if (mainContent) {
        mainContent.classList.remove('hidden');
    }
    if (historyPage) {
        historyPage.classList.add('hidden');
    }
    if (playlistsPage) {
        playlistsPage.classList.add('hidden');
    }
    if (followPage) {
        followPage.classList.add('hidden');
    }
    if (channelPage) {
        channelPage.classList.add('hidden');
    }
    if (chipsBar) {
        chipsBar.classList.add('hidden');
    }
    if (homePage) {
        homePage.classList.add('hidden');
    }
    if (watchPage) {
        watchPage.classList.add('hidden');
    }
    channelPage.classList.remove('hidden');
    isProgramProfileActive = false;
    currentProgramId = '';
    channelPage.classList.remove('channel-page--program-profile');

    const channelName = channel?.name || channel?.title || 'Canal';
    const channelAvatar =
        channel?.avatar || channel?.thumbnail || getFollowChannelAvatar(normalizedId) || 'img/icon-192.png';
    if (channelProfileAvatar) {
        channelProfileAvatar.src = channelAvatar;
        channelProfileAvatar.alt = channelName;
    }
    if (channelProfileName) {
        channelProfileName.textContent = channelName;
    }
    if (channelProfileHandle) {
        if (channel?.handle) {
            const cleanHandle = String(channel.handle).trim();
            const youtubeChannelUrl = cleanHandle.startsWith('@')
                ? `https://www.youtube.com/${cleanHandle}`
                : `https://www.youtube.com/channel/${normalizedId}`;
            channelProfileHandle.innerHTML = `<a href="${youtubeChannelUrl}" class="channel-profile-handle-link" target="_blank" rel="noopener noreferrer">${escapeHtml(cleanHandle)}</a>`;
            channelProfileHandle.classList.remove('hidden');
        } else {
            channelProfileHandle.innerHTML = '';
            channelProfileHandle.classList.add('hidden');
        }
    }
    if (channelProfileSubscribers) {
        if (channel?.subscriberCount) {
            channelProfileSubscribers.textContent = `${formatViews(channel.subscriberCount)} subscriptors`;
            channelProfileSubscribers.classList.remove('hidden');
        } else {
            channelProfileSubscribers.textContent = '';
            channelProfileSubscribers.classList.add('hidden');
        }
    }
    if (channelProfileDescription) {
        channelProfileDescription.textContent = channel?.description || 'No hi ha descripció disponible.';
    }
    if (channelProfileTags) {
        renderChannelProfileCategories(channel, normalizedId);
    }
    SupportModule.renderChannelButton(normalizedId, channelName);
    if (channelProfileFollowBtn) {
        channelProfileFollowBtn.dataset.followChannel = normalizedId;
        channelProfileFollowBtn.dataset.followBound = 'false';
        if (isMitjansOrDigitalsChannel(normalizedId)) {
            channelProfileFollowBtn.classList.add('hidden');
        } else {
            channelProfileFollowBtn.classList.remove('hidden');
        }
    }
    if (channelProfileHideBtn) {
        channelProfileHideBtn.dataset.hideChannel = normalizedId;
        channelProfileHideBtn.dataset.hideBound = 'false';
        channelProfileHideBtn.classList.remove('hidden');
    }
    if (channelProfileShareBtn) {
        channelProfileShareBtn.dataset.shareChannelId = normalizedId;
        channelProfileShareBtn.dataset.shareChannelName = encodeURIComponent(channelName);
        channelProfileShareBtn.dataset.shareChannelDescription = encodeURIComponent(
            channel?.description || 'No hi ha descripció disponible.'
        );
        delete channelProfileShareBtn.dataset.shareProgramName;
        delete channelProfileShareBtn.dataset.shareProgramId;
    }
    syncChannelProfileActionsLayout();
    bindFollowButtons(channelPage);
    bindHideChannelButtons(channelPage);

    const channelVideos = await YouTubeAPI.getChannelVideosWithHistory(normalizedId);
    currentChannelId = normalizedId;
    currentChannelName = channelName;
    currentChannelVideos = Array.isArray(channelVideos) ? channelVideos : [];
    currentChannelShorts = currentChannelVideos.filter(video => video.isShort);
    currentChannelLongVideos = currentChannelVideos.filter(video => !video.isShort);

    if (channelSearchInputDesktop) {
        channelSearchInputDesktop.value = '';
    }
    if (channelSearchInputMobile) {
        channelSearchInputMobile.value = '';
    }

    currentChannelVideos.forEach(video => {
        if (!cachedAPIVideos.find(v => String(v.id) === String(video.id))) {
            cachedAPIVideos.push(video);
        }
    });

    renderChannelVideos('');
    window.scrollTo(0, 0);
    if (window.location.hash === '#segueix') {
        setTimeout(scrollToChannelFollow, 150);
    }
}

// Pàgina de canal i llistats associats
function renderChannelVideos(query = '') {
    return SegueixApp.features.channel?.renderChannelVideos?.(query);
}

function renderChannelVideosLegacyImpl(query = '') {
    if (!channelVideosGrid) return;
    if (isChannelHidden(currentChannelId)) {
        channelVideosGrid.innerHTML = '<div class="empty-state">Has ocultat aquest canal del feed.</div>';
        return;
    }

    if (!Array.isArray(currentChannelVideos) || currentChannelVideos.length === 0) {
        channelVideosGrid.innerHTML = '<div class="empty-state">Encara no hi ha vídeos d\'aquest canal.</div>';
        return;
    }

    const normalizedQuery = String(query || '')
        .trim()
        .toLowerCase();
    const filterByQuery = video => {
        if (!normalizedQuery) return true;
        return (
            String(video?.title || '')
                .toLowerCase()
                .includes(normalizedQuery) ||
            String(video?.description || '')
                .toLowerCase()
                .includes(normalizedQuery)
        );
    };

    const filteredShorts = currentChannelShorts.filter(filterByQuery);
    const filteredLongVideos = currentChannelLongVideos.filter(filterByQuery);
    const isMobile = window.matchMedia('(max-width: 768px)').matches;

    if (normalizedQuery && filteredShorts.length === 0 && filteredLongVideos.length === 0) {
        channelVideosGrid.innerHTML = '<div class="empty-state">No s\'han trobat resultats dins d\'aquest canal.</div>';
        return;
    }

    if (!isMobile && filteredLongVideos.length === 0) {
        channelVideosGrid.innerHTML = normalizedQuery
            ? '<div class="empty-state">Aquesta cerca només retorna shorts en aquest canal.</div>'
            : '<div class="empty-state">Aquest canal només té shorts disponibles ara mateix.</div>';
        return;
    }

    const shortsSection =
        isMobile && filteredShorts.length > 0
            ? `
        <div class="shorts-section">
            <h2 class="shorts-title">Shorts</h2>
            <div class="shorts-row">
                ${filteredShorts
                    .map(
                        video => `
                    <button class="short-card" type="button" data-video-id="${video.id}" data-channel-id="${currentChannelId}">
                        <img class="short-thumb" src="${video.thumbnail}" alt="${escapeHtml(video.title)}" loading="lazy">
                        <div class="short-meta">
                            <div class="short-title">${escapeHtml(video.title)}</div>
                            <div class="short-channel">${escapeHtml(video.channelTitle || currentChannelName)}</div>
                        </div>
                    </button>
                `
                    )
                    .join('')}
            </div>
        </div>
    `
            : '';

    channelVideosGrid.innerHTML = `
        ${shortsSection}
        ${filteredLongVideos.map(video => createVideoCardAPI(video)).join('')}
    `;

    channelVideosGrid.querySelectorAll('.short-card').forEach(card => {
        card.addEventListener('click', event => {
            event.stopPropagation();
            openChannelShortModal(card.dataset.videoId, card.dataset.channelId);
        });
    });

    setupDelegatedVideoCardClicks(channelVideosGrid, 'api');
    bindChannelLinks(channelVideosGrid);

    refreshIcons(channelVideosGrid);
    setupVideoCardActionButtons(channelVideosGrid);
}

function mapStaticVideoToCardData(video) {
    const channel = getChannelById(video.channelId);
    return {
        id: video.id,
        title: video.title,
        thumbnail: video.thumbnail,
        duration: video.duration,
        isShort: video.isShort,
        channelId: video.channelId,
        channelTitle: channel?.name || '',
        viewCount: video.views,
        publishedAt: video.uploadDate,
        videoUrl: video.videoUrl,
    };
}
// Carregar vídeos relacionats (estàtic)
function loadRelatedVideos(currentVideoId) {
    return SegueixApp.features.player?.loadRelatedVideos?.(currentVideoId);
}

function loadRelatedVideosLegacyImpl(currentVideoId) {
    setExtraRelatedTitle(DEFAULT_EXTRA_RELATED_TITLE);
    const currentVideo = getVideoById(currentVideoId);
    const currentChannelId = currentVideo?.channelId;

    // Filtrar per categoria
    let relatedVideos = VIDEOS.filter(v => v.id !== parseInt(currentVideoId) && !v.isShort);

    // Filtrar estrictament per categoria del vídeo actual
    if (currentVideo?.categoryId) {
        relatedVideos = relatedVideos.filter(v => v.categoryId === currentVideo.categoryId);
    }

    // Excloure canal actual
    relatedVideos = relatedVideos.filter(v => String(v.channelId) !== String(currentChannelId));

    // Aplicar scoring personalitzat
    const mappedVideos = relatedVideos.map(v => mapStaticVideoToCardData(v));
    const scoredVideos = scoreRelatedVideos(mappedVideos, { id: currentVideoId, channelId: currentChannelId });

    // Mapeig invers per obtenir vídeos estàtics originals per al sidebar
    const scoredIds = scoredVideos.map(v => v.id);
    const staticById = {};
    VIDEOS.forEach(v => {
        staticById[v.id] = v;
    });
    const orderedStatic = scoredIds.map(id => staticById[id]).filter(Boolean);

    const sidebarLimit = 8;
    const sidebarVideos = orderedStatic.slice(0, sidebarLimit);
    const extraVideosData = scoredVideos.slice(sidebarLimit);

    const relatedContainer = document.getElementById('relatedVideos');
    const extraContainer = extraVideosGrid || document.getElementById('extraVideosGrid');

    relatedContainer.innerHTML = sidebarVideos
        .map(video => {
            const channel = getChannelById(video.channelId);
            return `
            <div class="related-video" data-video-id="${video.id}">
                <div class="related-thumbnail">
                    <img src="${video.thumbnail}" alt="${video.title}" loading="lazy">
                    <span class="video-duration">${video.duration}</span>
                </div>
                <div class="related-info">
                    <div class="related-title-text">${video.title}</div>
                    <div class="related-channel">${channel?.name || ''}</div>
                    <div class="related-stats">
                        ${formatViews(video.views)} vis. • ${formatDate(video.uploadDate)}
                    </div>
                </div>
            </div>
        `;
        })
        .join('');

    if (extraContainer && extraVideosData.length > 0) {
        batchRenderCards(extraContainer, extraVideosData, createVideoCardAPI, {
            onComplete: () => {
                ensureWatchGridLayoutControls();
                applyWatchGridLayoutPreference();
                setupDelegatedVideoCardClicks(extraContainer, 'static');
                bindChannelLinks(extraContainer);
                refreshIcons(extraContainer);
                setupVideoCardActionButtons(extraContainer);
            },
        });
    }

    const relatedVideoElements = document.querySelectorAll('.related-video');
    relatedVideoElements.forEach(element => {
        element.addEventListener('click', () => {
            const videoId = element.dataset.videoId;
            playThenNavigate(videoId, 'static');
        });
    });
}

// Gestionar navegació del navegador (back/forward)
window.addEventListener('popstate', e => {
    if (suppressNextPopstateNavigation) {
        suppressNextPopstateNavigation = false;
        return;
    }

    if (backgroundModal?.classList.contains('active')) {
        closeBackgroundModal(true);
        return;
    }

    if (addYoutuberModal?.classList.contains('active')) {
        closeAddYoutuberModal(true);
        return;
    }

    if (createProgramModal?.classList.contains('active')) {
        closeCreateProgramModal(true);
        return;
    }

    const supportOverlay = document.getElementById('supportModal');
    if (supportOverlay?.classList.contains('active')) {
        closeSupportModal(true);
        return;
    }

    if (isAuxiliaryPageVisible()) {
        showHomeNovetats();
        return;
    }

    if (e.state && e.state.videoId) {
        const popParams = new URLSearchParams(window.location.search);
        const popStartAt = parseShareStartSeconds(popParams.get('t'));
        if (useYouTubeAPI) {
            showVideoFromAPI(e.state.videoId, { startAt: popStartAt, replaceHistory: true });
        } else {
            showVideo(e.state.videoId, { startAt: popStartAt, replaceHistory: true });
        }
    } else if (e.state && e.state.category) {
        // Restaurar la categoria anterior al tornar enrere
        activateCategory(e.state.category);
        showHome({ skipPushState: true });
        if (useYouTubeAPI) {
            loadVideosFromAPI();
        } else {
            loadVideos();
        }
    } else {
        showHome({ skipPushState: true });
        if (useYouTubeAPI) {
            loadVideosFromAPI();
        } else {
            loadVideos();
        }
    }
});

// --- FUNCIONS PER COMPARTIR LLISTES (SEGUEIX) - VERSIÓ CORREGIDA ---

// Compartició de playlists (encoding + flux de recepció)
function randomLetter() {
    return SegueixApp.utils.idCodecs.randomLetter();
}

function encodePlaylistId(rowNumber) {
    return SegueixApp.utils.idCodecs.encodePlaylistId(rowNumber);
}

function decodePlaylistId(code) {
    return SegueixApp.utils.idCodecs.decodePlaylistId(code);
}

function encodeCategoryId(rowNumber) {
    return SegueixApp.utils.idCodecs.encodeCategoryId(rowNumber);
}

function decodeCategoryId(code) {
    return SegueixApp.utils.idCodecs.decodeCategoryId(code);
}

// Canal A — Compartició ràpida per URL comprimida (sense Google Sheets, sense servidor)

async function shareCategoryWithYoutubers(categoryName, channelIds) {
    const shareCodecs = SegueixApp.utils.shareCodecs;
    const payload = shareCodecs.buildImportPayload({
        type: 'category',
        name: categoryName,
        items: channelIds || [],
    });
    const shareUrl = shareCodecs.buildImportUrl(payload);

    if (!shareUrl) {
        alert("No s'ha pogut generar l'enllaç de compartició.");
        return;
    }

    _showShareOptionsModal('Categoria', categoryName, shareUrl, payload);
}

async function shareSegueixPlaylist(playlistName, videoIds) {
    let allPlaylists = [];
    try {
        const stored = localStorage.getItem('catube_playlists');
        allPlaylists = stored ? JSON.parse(stored) : [];
    } catch (err) {
        console.warn('[shareSegueixPlaylist] localStorage no disponible:', err);
        return alert('Compartició no disponible en mode incògnit.');
    }
    const targetPlaylist = allPlaylists.find(p => p.name === playlistName);

    const playlistVideos = Array.isArray(videoIds) && videoIds.length > 0 ? videoIds : targetPlaylist?.videos;

    if (!targetPlaylist || !Array.isArray(playlistVideos) || playlistVideos.length === 0) {
        return alert('Aquesta llista és buida o no existeix.');
    }

    const videoIdsOnly = playlistVideos.map(v => (typeof v === 'string' ? v : v.id)).filter(Boolean);

    const shareCodecs = SegueixApp.utils.shareCodecs;
    const payload = shareCodecs.buildImportPayload({
        type: 'playlist',
        name: playlistName,
        items: videoIdsOnly,
    });
    const shareUrl = shareCodecs.buildImportUrl(payload);

    if (!shareUrl) {
        alert("No s'ha pogut generar l'enllaç de compartició.");
        return;
    }

    // Caràtula representativa: hqdefault del primer vídeo (fallback img/caratula.png via onerror)
    const thumbnailUrl = videoIdsOnly[0] ? buildArchiveThumbnail(videoIdsOnly[0]) : '';

    // Mostrar modal amb opcions: Compartir + Generar QR
    _showShareOptionsModal('Llista', playlistName, shareUrl, { thumbnailUrl });
}

// Modal amb opcions de compartició: Compartir (link net) + Generar QR
async function _showShareOptionsModal(typeLabel, name, shareUrl, options = {}) {
    const thumbnailUrl = options && typeof options === 'object' ? options.thumbnailUrl || '' : '';
    const hasNativeShare = !!navigator.share;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.style.zIndex = '10000';
    modal.innerHTML = `
        <div class="modal modal-small">
            <div class="modal-header">
                <h2 class="modal-title" style="display:flex; align-items:center; gap:12px;">
                    Comparteix ${typeLabel.toLowerCase()}
                </h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                    <i data-lucide="x"></i>
                </button>
            </div>
            <div class="modal-body" style="text-align:center; padding: 20px;">
                ${
                    thumbnailUrl
                        ? `<img src="${escapeHtml(thumbnailUrl)}" alt="" style="width:180px; aspect-ratio:16/9; object-fit:cover; border-radius:12px; margin:0 auto 14px; display:block;" onerror="this.onerror=null; this.src='img/caratula.png';">`
                        : ''
                }
                <p style="font-size:1rem; font-weight:600; margin-bottom:16px;">${escapeHtml(name)}</p>
                <div style="display:flex; flex-direction:column; gap:14px; max-width:380px; margin:0 auto;">
                    <button class="hero-button" id="shareOptShare" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:14px; font-size:1.25rem; line-height:1.2; background:var(--color-button-accent); color:#ffffff;">
                        <i data-lucide="share-2"></i><span>Compartir</span>
                    </button>
                    <button class="hero-button" id="shareOptQr" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:14px; font-size:1.25rem; line-height:1.2; background:#ffffff; color:#1a1a2e;">
                        <i data-lucide="qr-code"></i><span>Generar QR</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    refreshIcons(modal);

    modal.addEventListener('click', e => {
        if (e.target === modal) modal.remove();
    });

    // Per evitar trencar la previsualització Open Graph en apps com WhatsApp,
    // la compartició nativa envia només URL + title (sense camp text).
    const shareText = `${typeLabel}: ${name}`;

    modal.querySelector('#shareOptShare').addEventListener('click', async () => {
        if (hasNativeShare) {
            try {
                await navigator.share({ title: shareText, url: shareUrl });
                modal.remove();
            } catch (_e) {
                /* cancelled per l'usuari */
            }
            return;
        }
        // Fallback desktop sense Web Share: copia només la URL (sense text addicional)
        try {
            await navigator.clipboard.writeText(shareUrl);
            const btn = modal.querySelector('#shareOptShare');
            btn.innerHTML = '<i data-lucide="check"></i><span>Enllaç copiat!</span>';
            btn.style.background = '#2ecc71';
            btn.style.color = '#fff';
            refreshIcons(btn);
        } catch (_err) {
            alert("No s'ha pogut copiar l'enllaç.");
        }
    });

    modal.querySelector('#shareOptQr').addEventListener('click', () => {
        modal.remove();
        const qrShare = SegueixApp.utils?.qrShare;
        if (qrShare) {
            const typeMap = { Llista: 'playlist', Categoria: 'category', Visualitzacions: 'history' };
            qrShare.showQrModal({ type: typeMap[typeLabel] || 'playlist', name: name, url: shareUrl });
        }
    });
}

function showManualShareModal(name, url, title = 'Comparteix la llista') {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal modal-small">
            <div class="modal-header">
                <h2 class="modal-title">${title}</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                    <i data-lucide="x"></i>
                </button>
            </div>
            <div class="modal-body" style="text-align:center; padding: 20px;">
                <p style="margin-bottom:15px;">Copia l'enllaç per enviar-lo per on vulguis:</p>
                <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px; word-break: break-all; font-family: monospace; font-size: 0.85rem; margin-bottom: 20px; user-select: all;">
                    ${url}
                </div>
                <button class="hero-button" id="copyBtn">
                    <i data-lucide="copy"></i> Copiar Enllaç
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    refreshIcons(modal);

    modal.querySelector('#copyBtn').onclick = function () {
        navigator.clipboard.writeText(url);
        this.innerHTML = '<i data-lucide="check"></i> Copiat!';
        refreshIcons(modal);
    };
}

// Canal A — Detecció i recepció de ?importData= (compartició ràpida per URL comprimida)
// Vista de recepció amb branding Segueix i importació funcional
function handleImportDataParam() {
    const params = new URLSearchParams(window.location.search);
    const importDataValue = params.get('importData');
    if (!importDataValue) return;

    // Elimina el paràmetre de la URL per no repetir la importació
    params.delete('importData');
    const nextQuery = params.toString();
    history.replaceState(
        {},
        '',
        `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`
    );

    const shareCodecs = SegueixApp.utils?.shareCodecs;
    if (!shareCodecs) {
        console.error('[importData] share-codecs no carregat');
        return;
    }

    const payload = shareCodecs.decodeImportPayload(importDataValue);
    if (!payload) {
        console.warn('[importData] Payload invàlid o no descomprimible');
        return;
    }

    console.log('[importData] Payload rebut:', payload);

    const typeLabels = { playlist: 'Llista', category: 'Categoria', history: 'Visualitzacions' };
    const typeLabel = typeLabels[payload.type] || payload.type;
    const itemCount = payload.items?.length || 0;

    // Previsualització dels elements
    let previewHtml = '';
    if (payload.type === 'playlist' && itemCount > 0) {
        previewHtml = `<p style="font-size:0.85rem; opacity:0.7; margin-bottom:12px;">${itemCount} vídeos</p>`;
    } else if (payload.type === 'category' && itemCount > 0) {
        previewHtml = `<p style="font-size:0.85rem; opacity:0.7; margin-bottom:12px;">${itemCount} YouTubers assignats</p>`;
    } else if (payload.type === 'history') {
        previewHtml = `<p style="font-size:0.85rem; opacity:0.7; margin-bottom:12px;">${itemCount} visualitzacions</p>`;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'importDataModal';
    modal.style.zIndex = '10000';
    modal.innerHTML = `
        <div class="modal modal-small">
            <div class="modal-header" style="text-align:center; padding:20px 20px 0;">
                <h2 class="modal-title" style="justify-content:center; font-size:1.2rem;">
                    <span style="color:#e94560; font-weight:900;">SEGUEIX!</span>
                </h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                    <i data-lucide="x"></i>
                </button>
            </div>
            <div class="modal-body" style="text-align:center; padding: 10px 20px 25px;">
                <p style="font-size:0.75rem; opacity:0.5; margin-bottom:12px;">Els nostres YouTubers</p>
                <p style="font-size:0.85rem; opacity:0.6; margin-bottom:4px;">${escapeHtml(typeLabel)}</p>
                <p style="font-size:1.15rem; font-weight:700; margin-bottom:8px;">${escapeHtml(payload.name || 'Sense nom')}</p>
                ${previewHtml}
                <div style="display:flex; gap:10px; justify-content:center; margin-top:16px;">
                    <button class="hero-button" id="importDataAcceptBtn">
                        <i data-lucide="download"></i> Importar
                    </button>
                    <button class="hero-button" id="importDataCancelBtn" style="background:rgba(255,255,255,0.15);">
                        Tancar
                    </button>
                </div>
                <div id="importDataResult" style="margin-top:12px;"></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => refreshIcons(modal), 0);

    modal.querySelector('#importDataCancelBtn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => {
        if (e.target === modal) modal.remove();
    });

    modal.querySelector('#importDataAcceptBtn').addEventListener('click', () => {
        const resultDiv = modal.querySelector('#importDataResult');
        try {
            _executeImportFromPayload(payload, resultDiv, modal);
        } catch (err) {
            resultDiv.innerHTML = `<p style="color:#ff6b6b; font-size:0.85rem;">Error: ${escapeHtml(err.message)}</p>`;
        }
    });
}

// Executa la importació real des d'un payload rebut per URL
function _executeImportFromPayload(payload, resultDiv, modal) {
    if (payload.type === 'playlist') {
        // Afegir la llista a les playlists existents (mode merge per defecte)
        const stored = localStorage.getItem('catube_playlists');
        const playlists = stored ? JSON.parse(stored) : [];

        const videoObjs = (payload.items || []).map(id => ({
            id: id,
            title: 'Vídeo ' + id,
            thumbnail: 'img/icon-192.png',
            channelTitle: '',
            source: 'shared',
        }));

        // Intentar hidratar amb vídeos coneguts
        const allKnownVideos = [
            ...(typeof YouTubeAPI !== 'undefined' && Array.isArray(YouTubeAPI.feedVideos) ? YouTubeAPI.feedVideos : []),
            ...(window.cachedAPIVideos || []),
            ...(window.VIDEOS || []),
        ];
        const hydratedVideos = videoObjs.map(v => {
            const found = allKnownVideos.find(kv => String(kv.id) === String(v.id));
            if (found) {
                return {
                    id: found.id,
                    title: found.title || v.title,
                    thumbnail: found.thumbnail || v.thumbnail,
                    channelTitle: found.channelTitle || '',
                    channelId: found.channelId || '',
                    source: 'shared',
                };
            }
            return v;
        });

        const newPlaylist = {
            id: 'pl_' + Date.now(),
            name: payload.name || 'Llista importada',
            videos: hydratedVideos,
        };

        // Anti-duplicats per nom
        const exists = playlists.find(p => p.name === newPlaylist.name);
        if (exists) {
            newPlaylist.name += ' (' + new Date().toLocaleDateString('ca-ES') + ')';
        }

        playlists.push(newPlaylist);
        localStorage.setItem('catube_playlists', JSON.stringify(playlists));

        resultDiv.innerHTML = `<p style="color:#2ecc71; font-size:0.9rem;">✔ Llista "${escapeHtml(newPlaylist.name)}" importada amb ${hydratedVideos.length} vídeos</p>`;
        _disableImportBtn(modal);
    } else if (payload.type === 'category') {
        const tagName = payload.name;
        if (!tagName) throw new Error('La categoria no té nom');

        // Afegir tag
        if (typeof addCustomTag === 'function') addCustomTag(tagName);

        // Assignar canals
        const channelIds = payload.items || [];
        for (const channelId of channelIds) {
            if (typeof addChannelCustomCategory === 'function') {
                addChannelCustomCategory(channelId, tagName);
            }
        }

        if (typeof setupChipsBarOrdering === 'function') setupChipsBarOrdering();

        resultDiv.innerHTML = `<p style="color:#2ecc71; font-size:0.9rem;">✔ Categoria "${escapeHtml(tagName)}" importada amb ${channelIds.length} YouTubers</p>`;
        _disableImportBtn(modal);
    } else if (payload.type === 'history') {
        const stored = localStorage.getItem('catube_history');
        const existing = stored ? JSON.parse(stored) : [];
        const existingIds = new Set(existing.map(e => e.id));
        let added = 0;

        for (const item of payload.items || []) {
            if (!existingIds.has(item.id)) {
                existing.push(item);
                existingIds.add(item.id);
                added++;
            }
        }

        localStorage.setItem('catube_history', JSON.stringify(existing));
        resultDiv.innerHTML = `<p style="color:#2ecc71; font-size:0.9rem;">✔ ${added} visualitzacions importades</p>`;
        _disableImportBtn(modal);
    } else {
        throw new Error('Tipus no reconegut: ' + payload.type);
    }
}

function _disableImportBtn(modal) {
    const btn = modal.querySelector('#importDataAcceptBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="check"></i> Importat';
        if (typeof refreshIcons === 'function') refreshIcons(btn);
    }
}

// Listener per DETECTAR llistes compartides (format antic ?list=)
async function handleSharedPlaylistUrlImport() {
    return SegueixApp.features.sharedPlaylists.handleUrlImport();
}

// Renderitzar la vista compartida
function renderSharedPlaylist(name, stringIds = '') {
    return SegueixApp.features.sharedPlaylists.renderSharedPlaylist(name, stringIds);
}

// Guardar llista importada
function saveImportedPlaylist(name, stringIds = '') {
    return SegueixApp.features.sharedPlaylists.saveImportedPlaylist(name, stringIds);
}

// =============================================
// CONFIG SYNC BETWEEN DEVICES
// =============================================

function encodeConfigId(rowNumber) {
    return SegueixApp.utils.idCodecs.encodeConfigId(rowNumber);
}

function decodeConfigId(code) {
    return SegueixApp.utils.idCodecs.decodeConfigId(code);
}

function showConfigFeedback(elementId, message, type) {
    return SegueixApp.utils.configFeedback.showConfigFeedback(elementId, message, type);
}

function hideConfigFeedback(elementId) {
    return SegueixApp.utils.configFeedback.hideConfigFeedback(elementId);
}

// =============================================
// SUPORT ECONÒMIC ALS YOUTUBERS (wrappers globals)
// Implementació a js/features/support.js
// =============================================

async function loadSupportData() {
    return SegueixApp.features.support?.load?.();
}
async function openSupportModal(channelId, channelName) {
    return SegueixApp.features.support?.openModal?.(channelId, channelName);
}
function renderSupportChannelButton(channelId, channelName) {
    return SegueixApp.features.support?.renderChannelButton?.(channelId, channelName);
}
function getSidebarSupportButtonHtml(channelId, channelName) {
    return SegueixApp.features.support?.getSidebarButtonHtml?.(channelId, channelName);
}
function bindSidebarSupportButtons(container) {
    return SegueixApp.features.support?.bindSidebarSupportButtons?.(container);
}
function initSupportModal() {
    return SegueixApp.features.support?.initModal?.();
}
function channelHasSupport(channelId) {
    return SegueixApp.features.support?.hasSupport?.(channelId) || false;
}
function closeSupportModal(fromPopstate) {
    return SegueixApp.features.support?.closeSupportModal?.(fromPopstate);
}
function bindSupportButtons(container) {
    return SegueixApp.features.support?.bindSupportButtons?.(container);
}
function getSupportMethods(channelId) {
    return SegueixApp.features.support?.getSupportMethods?.(channelId);
}

var SupportModule = {
    load: loadSupportData,
    initModal: initSupportModal,
    renderChannelButton: renderSupportChannelButton,
    getSidebarButtonHtml: getSidebarSupportButtonHtml,
    bindSidebarSupportButtons: bindSidebarSupportButtons,
    hasSupport: channelHasSupport,
    openModal: openSupportModal,
};

function configureFeatureRuntimes() {
    SegueixApp.features.navigation?.registerRuntime?.({
        handlePlayerVisibilityOnNavigation,
        exitPlaylistMode,
        isMiniPlayerActive,
        resetCurrentVideoState: () => {
            currentVideoId = null;
            currentVideoSource = null;
        },
        saveViewState,
        beforeShowHistory: () => {
            historySelectedCategory = 'Tot';
        },
        updateHistoryFilterUI,
        renderHistory,
        setActiveLibraryTab,
        getActiveLibraryTab: () => activeLibraryTab,
        setActiveFollowTab,
        showHomeNovetats,
    });

    SegueixApp.features.library?.registerRuntime?.({
        playlistStorageKey: PLAYLIST_STORAGE_KEY,
        hooks: {
            renderPlaylistsPageImpl: renderPlaylistsPageLegacyImpl,
            getPlaylistVideoDataImpl: getPlaylistVideoDataLegacyImpl,
        },
    });

    SegueixApp.features.feed?.registerRuntime?.({
        showHomeNovetatsImpl: showHomeNovetatsLegacyImpl,
        getFeedDataForFilterImpl: getFeedDataForFilterLegacyImpl,
        setFeedContextImpl: setFeedContextLegacyImpl,
        renderFeedImpl: renderFeedLegacyImpl,
        renderCategoriesImpl: renderCategoriesLegacyImpl,
        loadVideosFromAPIImpl: loadVideosFromAPILegacyImpl,
        loadVideosImpl: loadVideosLegacyImpl,
    });

    SegueixApp.features.search?.registerRuntime?.({
        ensureSearchDropdownImpl: ensureSearchDropdownLegacyImpl,
        loadSearchArchiveIndexImpl: loadSearchArchiveIndexLegacyImpl,
        searchArchiveVideosImpl: searchArchiveVideosLegacyImpl,
        showSearchDropdownImpl: showSearchDropdownLegacyImpl,
        hideSearchDropdownImpl: hideSearchDropdownLegacyImpl,
        searchVideosImpl: searchVideosLegacyImpl,
    });

    SegueixApp.features.channel?.registerRuntime?.({
        toggleFollowChannelImpl: toggleFollowChannelLegacyImpl,
        openChannelProfileImpl: openChannelProfileLegacyImpl,
        renderChannelVideosImpl: renderChannelVideosLegacyImpl,
    });

    SegueixApp.features.player?.registerRuntime?.({
        queuePlaybackImpl: queuePlaybackLegacyImpl,
        initYouTubeMessageListenerImpl: initYouTubeMessageListenerLegacyImpl,
        handleYouTubeMessageImpl: handleYouTubeMessageLegacyImpl,
        updatePlayerIframeImpl: updatePlayerIframeLegacyImpl,
        preparePlayerForPlaybackImpl: preparePlayerForPlaybackLegacyImpl,
        showVideoImpl: showVideoLegacyImpl,
        showVideoFromAPIImpl: showVideoFromAPILegacyImpl,
        playThenNavigateImpl: playThenNavigateLegacyImpl,
        loadRelatedVideosImpl: loadRelatedVideosLegacyImpl,
        renderCategoryVideosBelowImpl: renderCategoryVideosBelowLegacyImpl,
        renderPlaylistRelatedVideosImpl: renderPlaylistRelatedVideosLegacyImpl,
    });
}

configureFeatureRuntimes();

document.addEventListener('DOMContentLoaded', async () => {
    let startupCompleted = false;
    let recoveryTriggered = false;

    const triggerRecovery = reason => {
        if (recoveryTriggered) {
            return;
        }
        recoveryTriggered = true;
        forceRecoverHomeFeed(reason);
    };

    if (isIOSLikeDevice()) {
        setTimeout(() => {
            if (!startupCompleted) {
                triggerRecovery('ios-watchdog-4500ms');
            }
        }, 4500);

        setTimeout(() => {
            if (!startupCompleted) {
                triggerRecovery('ios-watchdog-9000ms');
            }
        }, 9000);
    }

    try {
        await withStartupTimeout(
            (async () => {
                await bootstrapApp();
                bindCookieConsentUi();
                bindTelegramDownloadButtons();
                SupportModule.initModal();
                await SupportModule.load();
                updateBootstrapProgress(66, 'Carregant dades...');
                await handleInitialUrlParams();
                await handleSharedPlaylistUrlImport();
                SegueixApp.features.configSync.register();
                SegueixApp.utils.backupCodecs.register();
                startupCompleted = true;
            })(),
            22000,
            'startup pipeline'
        );
    } catch (error) {
        console.error('Startup pipeline error:', error);
        triggerRecovery('startup-pipeline-error');
    } finally {
        updateBootstrapProgress(100, 'Tot a punt!');
        setTimeout(() => completeBootstrapProgressOverlay(), 180);
    }
});

