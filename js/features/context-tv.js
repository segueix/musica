(function (window) {
    'use strict';

    const app = window.SegueixApp || (window.SegueixApp = {});
    app.features = app.features || {};

    const TV_PLAYLIST_ID = '__segueix_tv_discovery__';
    const QUEUE_LIMIT = 30;
    const ARCHIVE_CHANNEL_LIMIT = 60;
    const MIN_SECONDS = 180;
    const archiveCache = new Map();
    let observer = null;
    let syncScheduled = false;
    let exitBridgeInstalled = false;
    let generationSeed = createGenerationSeed();
    let activeTVContext = null;

    function createGenerationSeed() {
        try {
            if (window.crypto?.getRandomValues) {
                const values = new Uint32Array(1);
                window.crypto.getRandomValues(values);
                return values[0] || Date.now();
            }
        } catch {}
        return (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    }

    function seededValue(value) {
        const text = `${generationSeed}:${String(value || '')}`;
        let hash = 2166136261;
        for (let index = 0; index < text.length; index += 1) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return ((hash >>> 0) % 1000000) / 1000000;
    }

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();
    }

    function channelId(video) {
        return String(video?.channelId || video?.snippet?.channelId || '').trim();
    }

    function viewCount(video) {
        const raw = video?.viewCount ?? video?.views ?? video?.statistics?.viewCount ?? 0;
        const value = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^\d]/g, ''));
        return Number.isFinite(value) && value > 0 ? value : 0;
    }

    function publishedTime(video) {
        const value = new Date(video?.publishedAt || video?.uploadDate || video?.date || 0).getTime();
        return Number.isFinite(value) ? value : 0;
    }

    function durationSeconds(video) {
        const direct = Number(video?.durationSeconds);
        if (Number.isFinite(direct) && direct > 0) return direct;
        const raw = String(video?.duration || video?.contentDetails?.duration || '');
        if (!raw.startsWith('PT')) return 0;
        const match = raw.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
        if (!match) return 0;
        return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
    }

    function isLongVideo(video) {
        if (!video?.id || video?.isShort) return false;
        const seconds = durationSeconds(video);
        return !seconds || seconds >= MIN_SECONDS;
    }

    function uniqueVideos(videos) {
        const map = new Map();
        (Array.isArray(videos) ? videos : []).forEach(video => {
            const id = String(video?.id || '').trim();
            if (!id) return;
            const existing = map.get(id);
            if (!existing) {
                map.set(id, video);
                return;
            }
            map.set(id, {
                ...existing,
                ...video,
                thumbnail: video.thumbnail || existing.thumbnail,
                channelId: channelId(video) || channelId(existing),
            });
        });
        return Array.from(map.values());
    }

    function sourceVideos() {
        return uniqueVideos([
            ...(Array.isArray(app.state?.feed?.lastRenderedList) ? app.state.feed.lastRenderedList : []),
            ...(Array.isArray(app.state?.feed?.currentVideos) ? app.state.feed.currentVideos : []),
            ...(Array.isArray(window.YouTubeAPI?.feedVideos) ? window.YouTubeAPI.feedVideos : []),
            ...(Array.isArray(window.VIDEOS) ? window.VIDEOS : []),
        ]);
    }

    function allKnownChannels() {
        const map = new Map();
        const sources = [
            app.state?.feed?.currentData?.channels,
            window.YouTubeAPI?.feedChannels,
            typeof window.YouTubeAPI?.getAllChannels === 'function' ? window.YouTubeAPI.getAllChannels() : null,
        ];
        sources.forEach(source => {
            if (!Array.isArray(source)) return;
            source.forEach(channel => {
                const id = String(channel?.id || channel?.channelId || '').trim();
                if (id && !map.has(id)) map.set(id, channel);
            });
        });
        return Array.from(map.values());
    }

    function getKnownChannel(id) {
        const normalizedId = String(id || '').trim();
        return allKnownChannels().find(channel => String(channel?.id || channel?.channelId || '') === normalizedId) || null;
    }

    function allChannelCategories(videoOrChannelId) {
        const video = typeof videoOrChannelId === 'object' && videoOrChannelId ? videoOrChannelId : null;
        const id = video ? channelId(video) : String(videoOrChannelId || '').trim();
        const values = [];

        if (video) {
            values.push(
                video.category,
                ...(Array.isArray(video.categories) ? video.categories : []),
                ...(Array.isArray(video.channelCategories) ? video.channelCategories : []),
                ...(Array.isArray(video.customCategories) ? video.customCategories : []),
                video.snippet?.category,
                ...(Array.isArray(video.snippet?.categories) ? video.snippet.categories : [])
            );
        }

        const channel = getKnownChannel(id);
        if (channel) {
            values.push(
                channel.category,
                ...(Array.isArray(channel.categories) ? channel.categories : []),
                ...(Array.isArray(channel.customCategories) ? channel.customCategories : [])
            );
        }

        try {
            if (id && typeof window.getChannelCustomCategories === 'function') {
                values.push(...(window.getChannelCustomCategories(id) || []));
            }
        } catch {}

        try {
            if (id && typeof window.getEffectiveCategory === 'function') {
                values.push(window.getEffectiveCategory(id));
            }
        } catch {}

        return [...new Set(values.filter(Boolean).map(normalizeText).filter(Boolean))];
    }

    function readArray(key) {
        try {
            const parsed = JSON.parse(localStorage.getItem(key) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function followedIds() {
        try {
            const ids = window.getFollowedChannelIds?.();
            if (Array.isArray(ids)) return ids.map(String).filter(Boolean);
        } catch {}
        return readArray('catube_follows')
            .map(item => (typeof item === 'string' ? item : item?.id || item?.channelId || ''))
            .map(String)
            .filter(Boolean);
    }

    function videoMatchesCategory(video, category) {
        const normalized = normalizeText(category);
        if (!normalized) return false;
        if (normalized === 'tot') return true;
        if (normalized === 'seguint') return new Set(followedIds()).has(channelId(video));
        return allChannelCategories(video).includes(normalized);
    }

    function channelMatchesCategory(id, category) {
        const normalized = normalizeText(category);
        if (!normalized) return false;
        if (normalized === 'tot') return true;
        if (normalized === 'seguint') return new Set(followedIds()).has(String(id));
        return allChannelCategories(String(id)).includes(normalized);
    }

    function learnedAffinity(video) {
        try {
            const value = Number(app.features.tvLearning?.affinityForVideo?.(video));
            return Number.isFinite(value) ? Math.max(-4.2, Math.min(4.2, value)) : 0;
        } catch {
            return 0;
        }
    }

    function contextualScore(video, salt = '') {
        const views = viewCount(video);
        const ageDays = publishedTime(video) ? Math.max(0, (Date.now() - publishedTime(video)) / 86400000) : 9999;
        let score = Math.log10(views + 1) * 1.45;
        if (ageDays <= 14) score += 2.2;
        else if (ageDays <= 90) score += 1.1;
        else if (ageDays <= 365) score += 0.4;
        // Les TV que l'usuari ha triat explícitament només reben una personalització suau.
        score += learnedAffinity(video) * 0.65;
        score += seededValue(`${salt}:${video?.id || ''}`) * 3.4;
        return score;
    }

    async function loadArchiveChannel(id) {
        const normalizedId = String(id || '').trim();
        if (!normalizedId) return [];
        if (archiveCache.has(normalizedId)) return archiveCache.get(normalizedId);

        const task = (async () => {
            try {
                const path = `data/archive/channels/${encodeURIComponent(normalizedId)}.json`;
                const url = window.appDataUrl?.(path) || new URL(path, document.baseURI);
                const response = await fetch(url, { cache: 'force-cache' });
                if (!response.ok) return [];
                const data = await response.json();
                return (Array.isArray(data?.videos) ? data.videos : [])
                    .filter(video => video?.id)
                    .map(video => ({
                        ...video,
                        channelId: video.channelId || normalizedId,
                        source: 'archive',
                        contextualTV: true,
                    }));
            } catch {
                return [];
            }
        })();

        archiveCache.set(normalizedId, task);
        return task;
    }

    function currentRenderedVideos() {
        return Array.isArray(app.state?.feed?.lastRenderedList) ? app.state.feed.lastRenderedList : [];
    }

    function isSpecialDynamicCategory(category) {
        return new Set(['novetats', 'radar']).has(normalizeText(category));
    }

    async function buildCategoryQueue(category) {
        generationSeed = createGenerationSeed();
        const rendered = currentRenderedVideos();
        let base = uniqueVideos(rendered.filter(isLongVideo));

        if (!base.length) {
            base = sourceVideos().filter(video => isLongVideo(video) && videoMatchesCategory(video, category));
        }

        if (!isSpecialDynamicCategory(category)) {
            const ids = new Set(base.map(channelId).filter(Boolean));
            allKnownChannels().forEach(channel => {
                const id = String(channel?.id || channel?.channelId || '').trim();
                if (id && channelMatchesCategory(id, category)) ids.add(id);
            });
            if (normalizeText(category) === 'seguint') followedIds().forEach(id => ids.add(String(id)));

            const archiveIds = Array.from(ids).slice(0, ARCHIVE_CHANNEL_LIMIT);
            const archives = (await Promise.all(archiveIds.map(loadArchiveChannel))).flat();
            base = uniqueVideos([
                ...base,
                ...archives.filter(video => isLongVideo(video) && videoMatchesCategory(video, category)),
                ...sourceVideos().filter(video => isLongVideo(video) && videoMatchesCategory(video, category)),
            ]);
        }

        const bestByChannel = new Map();
        base.forEach(video => {
            const id = channelId(video);
            if (!id) return;
            const score = contextualScore(video, `category:${category}`);
            const current = bestByChannel.get(id);
            if (!current || score > current.score) bestByChannel.set(id, { video, score });
        });

        return Array.from(bestByChannel.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, QUEUE_LIMIT)
            .map(item => item.video);
    }

    // Els programes són una tria explícita de l'usuari: un canal més el nom del programa
    // dins del títol. No s'hi apliquen les exclusions de la descoberta (mitjans, digitals,
    // entitats) ni el mínim de durada — si l'usuari s'ha creat el programa, el vol veure.
    function programTextNormalizer() {
        return typeof window.normalizeProgramText === 'function' ? window.normalizeProgramText : normalizeText;
    }

    function isPlayableVideo(video) {
        return Boolean(video?.id) && !video?.isShort;
    }

    function getProgram(programId) {
        const id = String(programId || '').trim();
        if (!id) return null;
        try {
            return window.getProgramById?.(id) || null;
        } catch {
            return null;
        }
    }

    async function buildProgramQueue(programId) {
        generationSeed = createGenerationSeed();
        const program = getProgram(programId);
        const channel = String(program?.channelId || '').trim();
        const normalitza = programTextNormalizer();
        const nameNorm = normalitza(String(program?.name || ''));
        if (!channel || !nameNorm) return [];

        const archive = await loadArchiveChannel(channel);
        const videos = uniqueVideos([
            ...sourceVideos().filter(video => channelId(video) === channel),
            ...archive,
        ]).filter(
            video =>
                isPlayableVideo(video) &&
                channelId(video) === channel &&
                normalitza(String(video.title || '')).includes(nameNorm)
        );

        return videos
            .map(video => ({ video, score: contextualScore(video, `program:${programId}`) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, QUEUE_LIMIT)
            .map(item => item.video);
    }

    async function buildChannelQueue(id) {
        generationSeed = createGenerationSeed();
        const normalizedId = String(id || '').trim();
        if (!normalizedId) return [];
        const archive = await loadArchiveChannel(normalizedId);
        const videos = uniqueVideos([
            ...sourceVideos().filter(video => channelId(video) === normalizedId),
            ...archive,
        ]).filter(video => isLongVideo(video) && channelId(video) === normalizedId);

        return videos
            .map(video => ({ video, score: contextualScore(video, `channel:${normalizedId}`) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, QUEUE_LIMIT)
            .map(item => item.video);
    }

    function startPlaylist(queue, name, { requireLongVideos = true, context = null } = {}) {
        const accepta = requireLongVideos ? isLongVideo : isPlayableVideo;
        const videos = uniqueVideos(queue).filter(accepta).slice(0, QUEUE_LIMIT);
        if (!videos.length || typeof loadVideoInSequence !== 'function') return false;

        if (document.body.classList.contains('segueix-tv-active')) {
            try { app.features.segueixTV?.leave?.(); } catch {}
        }
        if (context) activeTVContext = { ...context };
        isPlaylistMode = true;
        activePlaylistQueue = videos;
        currentPlaylistIndex = 0;
        activePlaylistId = TV_PLAYLIST_ID;
        activePlaylistName = name;
        document.body.classList.add('segueix-tv-playback');
        loadVideoInSequence({ autoPlay: false });
        return true;
    }

    function makeButton(kind, value, label) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'context-tv-btn';
        button.dataset.contextTv = kind;
        button.dataset.contextValue = value;
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
        button.innerHTML = '<span aria-hidden="true">TV</span>';
        return button;
    }

    function ensureCategoryButton() {
        document
            .querySelectorAll('[data-context-tv="category"]')
            .forEach(button => button.remove());
    }

    function activeProgramId() {
        const fromState = String(app.state?.currentProgramId || '').trim();
        if (fromState) return fromState;
        try {
            return String(window.currentProgramId || '').trim();
        } catch {
            return '';
        }
    }

    // El perfil d'un programa reaprofita la pàgina de canal: hi va el botó del programa,
    // no el del canal sencer.
    function activeProgramOnProfile() {
        const channelPage = document.getElementById('channelPage');
        if (!channelPage || channelPage.classList.contains('hidden')) return null;
        if (!channelPage.classList.contains('channel-page--program-profile')) return null;
        return getProgram(activeProgramId());
    }

    function ensureChannelButton() {
        document
            .querySelectorAll('[data-context-tv="channel"], [data-context-tv="program"]')
            .forEach(button => button.remove());
    }

    function scheduleSync() {
        if (syncScheduled) return;
        syncScheduled = true;
        requestAnimationFrame(() => {
            syncScheduled = false;
            ensureCategoryButton();
            ensureChannelButton();
        });
    }

    function installExitBridge() {
        if (exitBridgeInstalled || typeof exitPlaylistMode !== 'function') return;
        exitBridgeInstalled = true;
        const original = exitPlaylistMode;
        exitPlaylistMode = function () {
            document.body.classList.remove('segueix-tv-playback');
            activeTVContext = null;
            return original.apply(this, arguments);
        };
    }

    function installStyles() {
        if (!document.head || document.getElementById('contextTVStyles')) return;
        const style = document.createElement('style');
        style.id = 'contextTVStyles';
        style.textContent = `
            .context-tv-btn{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;min-width:34px;height:25px;margin-left:9px;padding:0 6px;border:1.5px solid currentColor;border-radius:6px;background:transparent;color:inherit;font:900 10px/1 Roboto,Arial,sans-serif;letter-spacing:.07em;vertical-align:middle;cursor:pointer;opacity:.88;transition:background .16s ease,color .16s ease,opacity .16s ease,transform .16s ease}
            .context-tv-btn:hover{background:#fff;color:#111;opacity:1}
            .context-tv-btn:active{transform:scale(.94)}
            .context-tv-btn:focus-visible{outline:2px solid #fff;outline-offset:2px}
            .context-tv-btn.is-loading{pointer-events:none;opacity:.55;animation:context-tv-pulse .7s ease-in-out infinite alternate}
            .page-title__actions .context-tv-btn{margin-left:0}
            .channel-profile-title-row>.context-tv-btn{margin-left:8px;margin-right:4px}
            /* A la graella de programes el botó viu a la cantonada lliure de la targeta
               (la de la dreta la té el botó d'eliminar). */
            .context-tv-btn--program-card{position:absolute;top:8px;left:8px;margin:0;z-index:2;opacity:1}

            .context-tv-btn[data-context-tv="category"]:not(.is-loading){animation:context-tv-category-glow 2.8s ease-in-out infinite}
            .context-tv-btn[data-context-tv="category"]:is(:hover,:focus-visible){animation:none;opacity:1;background:#fff;color:#111;box-shadow:0 0 12px rgba(255,255,255,.35)}
            @keyframes context-tv-category-glow{0%,100%{opacity:.72;box-shadow:0 0 0 rgba(255,255,255,0)}50%{opacity:1;box-shadow:0 0 10px rgba(255,255,255,.35)}}
            @media(prefers-reduced-motion:reduce){.context-tv-btn[data-context-tv="category"]:not(.is-loading),.context-tv-btn.is-loading{animation:none;opacity:1}}
            @keyframes context-tv-pulse{to{opacity:1}}
            @media(max-width:768px){.context-tv-btn{min-width:36px;height:27px;margin-left:7px}.channel-profile-title-row>.context-tv-btn{margin-left:6px}}
        `;
        document.head.appendChild(style);
    }

    async function onContextButtonClick(button) {
        if (!button || button.classList.contains('is-loading')) return;
        const kind = button.dataset.contextTv;
        const value = button.dataset.contextValue;
        if (!kind || !value) return;

        button.classList.add('is-loading');
        button.setAttribute('aria-busy', 'true');
        try {
            let queue = [];
            let name = '';
            let requireLongVideos = true;
            let startPaused = false;
            let context = null;
            if (kind === 'category') {
                queue = await buildCategoryQueue(value);
                name = value;
                startPaused = true;
                context = { kind, value, name: value, startPaused };
            } else if (kind === 'channel') {
                queue = await buildChannelQueue(value);
                name = `${button.dataset.contextName || 'YouTuber'} · TV`;
                context = { kind, value, name: button.dataset.contextName || 'YouTuber', startPaused };
            } else if (kind === 'program') {
                queue = await buildProgramQueue(value);
                name = `${getProgram(value)?.name || button.dataset.contextName || 'Programa'} · TV`;
                requireLongVideos = false;
                context = { kind, value, name: getProgram(value)?.name || button.dataset.contextName || 'Programa', startPaused };
            }
            startPlaylist(queue, name, { requireLongVideos, startPaused, context });
        } catch (error) {
            console.warn('No s’ha pogut generar la TV contextual:', error);
        } finally {
            button.classList.remove('is-loading');
            button.setAttribute('aria-busy', 'false');
        }
    }

    async function regenerateCurrentTV() {
        const context = activeTVContext;
        if (!context?.kind || !context?.value) return false;

        generationSeed = createGenerationSeed();
        let queue = [];
        let name = '';
        let requireLongVideos = true;
        const startPaused = Boolean(context.startPaused);

        if (context.kind === 'category') {
            queue = await buildCategoryQueue(context.value);
            name = context.value;
        } else if (context.kind === 'channel') {
            queue = await buildChannelQueue(context.value);
            name = `${context.name || 'YouTuber'} · TV`;
        } else if (context.kind === 'program') {
            queue = await buildProgramQueue(context.value);
            name = `${getProgram(context.value)?.name || context.name || 'Programa'} · TV`;
            requireLongVideos = false;
        }

        return startPlaylist(queue, name, { requireLongVideos, startPaused, context });
    }
    function installEvents() {
        document.addEventListener('click', event => {
            const button = event.target.closest('[data-context-tv]');
            if (!button) return;
            event.preventDefault();
            event.stopPropagation();
            onContextButtonClick(button);
        }, true);

        document.addEventListener('click', event => {
            if (event.target.closest('.chip[data-cat], .channel-link, [data-page]')) {
                scheduleSync();
                setTimeout(scheduleSync, 80);
            }
        }, true);
    }

    function init() {
        installStyles();
        installEvents();
        installExitBridge();
        scheduleSync();

        if (!observer && document.body) {
            observer = new MutationObserver(scheduleSync);
            observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        }

        app.features.contextTV = {
            buildCategoryQueue,
            buildChannelQueue,
            buildProgramQueue,
            startCategoryTV: async category =>
                startPlaylist(await buildCategoryQueue(category), `${category} · TV`, {
                    startPaused: true,
                    context: { kind: 'category', value: category, name: category, startPaused: true },
                }),
            startChannelTV: async (id, name = 'YouTuber') =>
                startPlaylist(await buildChannelQueue(id), `${name} · TV`, {
                    context: { kind: 'channel', value: id, name, startPaused: false },
                }),
            startProgramTV: async programId =>
                startPlaylist(
                    await buildProgramQueue(programId),
                    `${getProgram(programId)?.name || 'Programa'} · TV`,
                    {
                        requireLongVideos: false,
                        context: {
                            kind: 'program',
                            value: programId,
                            name: getProgram(programId)?.name || 'Programa',
                            startPaused: false,
                        },
                    }
                ),
            regenerateCurrentTV,
        };
    }

    function boot(attempt = 0) {
        if (!app.features.segueixTV || !document.getElementById('pageTitle')) {
            if (attempt < 160) setTimeout(() => boot(attempt + 1), 50);
            return;
        }
        init();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => boot(), { once: true });
    } else {
        boot();
    }
})(window);
