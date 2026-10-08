(function (window) {
    'use strict';

    const app = window.SegueixApp || (window.SegueixApp = {});
    app.features = app.features || {};

    const LABEL = 'Música TV';
    const TV_PLAYLIST_ID = '__segueix_tv_discovery__';
    const ARCHIVE_CHANNEL_LIMIT = 60;
    const RENDER_LIMIT = 30;
    const MIN_SECONDS = 180;
    const SMALL_CHANNEL_SLOT_EVERY = 5;
    const EXCLUDED_CHANNEL_CATEGORIES = new Set(['mitjans', 'digitals', 'entitats']);
    const EXCLUDED_DISCOVERY_CHANNEL_IDS = new Set([
        'UC5h-dMbHSH3tikTmTSnfGjQ', // Mainasons
        'UCh4gZwRHxIetWXbJnp0XefQ', // Dàmaris Gelabert
        'UCZqDq4Dl1ZxBQMlQgiEW5Kw', // El Pot Petit
    ]);
    const archiveCache = new Map();
    let runId = 0;
    let chipsObserver = null;
    let tvQueue = [];
    let loopBridgeInstalled = false;
    let gridClickBound = false;
    let titleActionsBound = false;
    let generationSeed = createGenerationSeed();

    const STOPWORDS = new Set([
        'amb', 'aquest', 'aquesta', 'aquests', 'aquestes', 'avui', 'com', 'dels', 'del', 'des', 'els', 'les',
        'una', 'unes', 'uns', 'per', 'pel', 'pels', 'que', 'qui', 'molt', 'mes', 'més', 'tot', 'tots', 'totes',
        'the', 'and', 'for', 'with', 'from', 'you', 'your', 'video', 'videos'
    ]);

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
        for (let i = 0; i < text.length; i += 1) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return ((hash >>> 0) % 1000000) / 1000000;
    }

    function installStyles() {
        if (!document.head || document.getElementById('segueixTVStyles')) return;
        const style = document.createElement('style');
        style.id = 'segueixTVStyles';
        style.textContent = `
            .segueix-tv-chip{
                width:max-content!important;min-width:124px!important;max-width:none!important;height:44px!important;min-height:44px!important;
                padding:10px 16px!important;border-radius:999px!important;gap:7px;display:inline-flex!important;
                align-items:center;justify-content:center;flex:0 0 auto!important;white-space:nowrap;overflow:visible!important;box-shadow:none;
                color:#fff;background:var(--color-button-accent);opacity:.95
            }
            .segueix-tv-chip:hover,.segueix-tv-chip.is-active{background:#fff!important;color:#0f0f0f!important;opacity:1}
            .segueix-tv-chip::before,.segueix-tv-chip::after{content:none!important;display:none!important}
            .segueix-tv-title-label{display:inline-flex;align-items:center;gap:6px;min-width:0}
            .segueix-tv-title-label .radar-info-wrap{display:inline-flex;align-items:center;flex:0 0 auto}
            .segueix-tv-title-label .radar-info-btn{width:26px;height:26px}
            .segueix-tv-refresh-btn svg{width:17px;height:17px}
            .segueix-tv-refresh-btn.is-refreshing svg{animation:segueix-tv-spin .7s linear infinite}
            @keyframes segueix-tv-spin{to{transform:rotate(360deg)}}
            body.segueix-tv-active #videosGrid .video-stats{display:none!important}
            body.segueix-tv-active #videosGrid .video-thumbnail,body.segueix-tv-active #heroSection .hero-thumbnail{position:relative}
            body.segueix-tv-active #heroSection .segueix-tv-badge{top:12px;right:12px}
            .segueix-tv-empty{grid-column:1/-1;padding:36px 16px;text-align:center;color:var(--color-text-secondary)}
            @media(max-width:768px){.segueix-tv-chip{min-width:120px!important;height:44px!important;min-height:44px!important;padding:10px 15px!important}.segueix-tv-badge{top:7px;right:7px}}
        `;
        document.head.appendChild(style);
    }

    function normalizeText(value) {
        return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }

    function normalizeCategory(value) {
        return normalizeText(value).trim();
    }

    function titleTokens(title) {
        return new Set(
            normalizeText(title)
                .split(/[^a-z0-9à-ÿ]+/i)
                .map(token => token.trim())
                .filter(token => token.length > 2 && !STOPWORDS.has(token))
        );
    }

    function readArray(key) {
        try {
            const parsed = JSON.parse(localStorage.getItem(key) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function likedVideos() {
        try {
            const liked = app.features.likes?.getLikedVideos?.();
            if (Array.isArray(liked)) return liked;
        } catch {}
        return readArray('catube_liked_videos');
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

    function watchedIds() {
        return new Set(readArray('catube_history').map(item => String(item?.id || item?.videoId || '')).filter(Boolean));
    }

    function hiddenIds() {
        try {
            const ids = window.getHiddenChannelIds?.();
            if (Array.isArray(ids)) return new Set(ids.map(String));
        } catch {}
        return new Set();
    }

    function channelId(video) {
        return String(video?.channelId || video?.snippet?.channelId || '');
    }

    function isDiscoveryExcluded(videoOrChannelId) {
        const id = typeof videoOrChannelId === 'object' && videoOrChannelId
            ? channelId(videoOrChannelId)
            : String(videoOrChannelId || '').trim();
        return Boolean(id && EXCLUDED_DISCOVERY_CHANNEL_IDS.has(id));
    }

    function viewCount(video) {
        const raw = video?.viewCount ?? video?.views ?? video?.statistics?.viewCount ?? 0;
        const value = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^\d]/g, ''));
        return Number.isFinite(value) && value > 0 ? value : 0;
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

    function numericStat(video, key) {
        const raw = video?.[key] ?? video?.statistics?.[key] ?? video?.snippet?.statistics?.[key] ?? 0;
        const value = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^\d.]/g, ''));
        return Number.isFinite(value) && value > 0 ? value : 0;
    }

    function publishedMillis(video) {
        const raw = video?.publishedAt || video?.uploadDate || video?.snippet?.publishedAt || '';
        const value = new Date(raw).getTime();
        return Number.isFinite(value) && value > 0 ? value : 0;
    }

    function ageDays(video) {
        const published = publishedMillis(video);
        return published ? Math.max(0, (Date.now() - published) / 86400000) : Infinity;
    }

    function engagementRate(video) {
        const views = viewCount(video);
        if (views <= 0) return 0;
        const likes = numericStat(video, 'likeCount');
        const comments = numericStat(video, 'commentCount');
        // Suavitzat perquè 2 likes sobre 10 visualitzacions no dominin la cua.
        return ((likes + comments * 2.2 + 1) / (views + 200)) * 1000;
    }

    function viewVelocity(video) {
        const views = viewCount(video);
        if (views <= 0) return 0;
        const days = ageDays(video);
        if (!Number.isFinite(days)) return 0;
        return views / Math.max(2, days);
    }

    function median(values) {
        const clean = (Array.isArray(values) ? values : [])
            .filter(value => Number.isFinite(value) && value >= 0)
            .sort((a, b) => a - b);
        if (!clean.length) return 0;
        const middle = Math.floor(clean.length / 2);
        return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
    }

    function topicTokens(video) {
        const tokens = new Set();
        const add = value => titleTokens(String(value || '')).forEach(token => tokens.add(token));
        add(video?.title || video?.snippet?.title);
        const tags = video?.tags || video?.snippet?.tags;
        if (Array.isArray(tags)) tags.slice(0, 16).forEach(add);
        add(String(video?.description || video?.snippet?.description || '').slice(0, 420));
        return tokens;
    }

    function topicSimilarity(a, b) {
        if (!a || !b) return 0;
        const left = topicTokens(a);
        const right = topicTokens(b);
        if (!left.size || !right.size) return 0;
        let overlap = 0;
        left.forEach(token => {
            if (right.has(token)) overlap += 1;
        });
        return overlap / Math.sqrt(left.size * right.size);
    }

    function languageBonus(video) {
        const audio = normalizeText(video?.defaultAudioLanguage || video?.snippet?.defaultAudioLanguage || '');
        const metadata = normalizeText(video?.defaultLanguage || video?.snippet?.defaultLanguage || '');
        if (audio === 'ca' || audio.startsWith('ca-')) return 0.9;
        if (metadata === 'ca' || metadata.startsWith('ca-')) return 0.55;
        return 0;
    }

    function behaviorAffinity(video) {
        try {
            const value = Number(app.features.tvLearning?.affinityForVideo?.(video));
            return Number.isFinite(value) ? Math.max(-4.2, Math.min(4.2, value)) : 0;
        } catch {
            return 0;
        }
    }

    function transitionScore(previous, candidate, recentCategories = []) {
        if (!previous || !candidate) return 0;
        let points = topicSimilarity(previous, candidate) * 4.2;

        const previousCategory = primaryCategory(previous);
        const candidateCategory = primaryCategory(candidate);
        if (previousCategory && candidateCategory && previousCategory === candidateCategory) points += 0.65;
        if (candidateCategory && recentCategories.includes(candidateCategory)) points -= 0.85;

        const previousDuration = durationSeconds(previous);
        const candidateDuration = durationSeconds(candidate);
        if (previousDuration > 0 && candidateDuration > 0) {
            if (previousDuration >= 2400) {
                if (candidateDuration >= 300 && candidateDuration <= 1200) points += 1.45;
                else if (candidateDuration >= 2400) points -= 1.6;
            } else if (previousDuration >= 1200) {
                if (candidateDuration >= 300 && candidateDuration <= 1800) points += 0.65;
                else if (candidateDuration >= 3000) points -= 0.75;
            } else if (previousDuration <= 600 && candidateDuration >= 3000) {
                points -= 0.85;
            }

            const ratio = Math.max(previousDuration, candidateDuration) / Math.max(1, Math.min(previousDuration, candidateDuration));
            if (ratio > 6) points -= 0.45;
        }

        return Math.max(-2.5, Math.min(4.5, points));
    }

    function sourceVideos() {
        const sources = [app.state?.feed?.currentVideos, window.YouTubeAPI?.feedVideos, window.VIDEOS];
        const map = new Map();
        sources.forEach(source => {
            if (!Array.isArray(source)) return;
            source.forEach(video => {
                const id = String(video?.id || '').trim();
                if (id && !map.has(id)) map.set(id, video);
            });
        });
        return Array.from(map.values());
    }

    function containsExcludedCategory(values) {
        return (Array.isArray(values) ? values : []).some(value => EXCLUDED_CHANNEL_CATEGORIES.has(normalizeCategory(value)));
    }

    function getKnownChannel(channelIdValue) {
        const id = String(channelIdValue || '').trim();
        if (!id) return null;
        const sources = [
            app.state?.feed?.currentData?.channels,
            window.YouTubeAPI?.feedChannels,
            typeof window.YouTubeAPI?.getAllChannels === 'function' ? window.YouTubeAPI.getAllChannels() : null,
        ];
        for (const source of sources) {
            if (!Array.isArray(source)) continue;
            const channel = source.find(item => String(item?.id || item?.channelId || '') === id);
            if (channel) return channel;
        }
        return null;
    }

    function channelCategories(videoOrChannelId) {
        const video = typeof videoOrChannelId === 'object' && videoOrChannelId ? videoOrChannelId : null;
        const id = video ? channelId(video) : String(videoOrChannelId || '').trim();
        const values = [];

        if (video) {
            values.push(
                ...(Array.isArray(video.categories) ? video.categories : []),
                ...(Array.isArray(video.channelCategories) ? video.channelCategories : []),
                ...(Array.isArray(video.customCategories) ? video.customCategories : []),
                ...(Array.isArray(video.snippet?.categories) ? video.snippet.categories : [])
            );
        }

        const channel = getKnownChannel(id);
        if (channel) {
            values.push(
                ...(Array.isArray(channel.categories) ? channel.categories : []),
                ...(Array.isArray(channel.customCategories) ? channel.customCategories : []),
                channel.category
            );
        }

        try {
            if (id && typeof window.getChannelCustomCategories === 'function') {
                values.push(...(window.getChannelCustomCategories(id) || []));
            }
        } catch {}

        return [...new Set(values
            .filter(Boolean)
            .map(normalizeCategory)
            .filter(category => category && !EXCLUDED_CHANNEL_CATEGORIES.has(category)))];
    }

    function isNonYoutuber(videoOrChannelId) {
        const video = typeof videoOrChannelId === 'object' && videoOrChannelId ? videoOrChannelId : null;
        const id = video ? channelId(video) : String(videoOrChannelId || '').trim();

        if (video) {
            const directCategories = [
                ...(Array.isArray(video.categories) ? video.categories : []),
                ...(Array.isArray(video.channelCategories) ? video.channelCategories : []),
                ...(Array.isArray(video.customCategories) ? video.customCategories : []),
                ...(Array.isArray(video.snippet?.categories) ? video.snippet.categories : []),
            ];
            if (containsExcludedCategory(directCategories)) return true;
        }

        try {
            if (id && typeof window.isMitjansOrDigitalsChannel === 'function' && window.isMitjansOrDigitalsChannel(id)) return true;
        } catch {}

        const channel = getKnownChannel(id);
        if (channel) {
            const categories = [
                ...(Array.isArray(channel.categories) ? channel.categories : []),
                ...(Array.isArray(channel.customCategories) ? channel.customCategories : []),
                channel.category,
            ].filter(Boolean);
            if (containsExcludedCategory(categories)) return true;
        }

        try {
            if (id && typeof window.getChannelCustomCategories === 'function') {
                if (containsExcludedCategory(window.getChannelCustomCategories(id))) return true;
            }
        } catch {}
        return false;
    }

    function buildFollowedCategoryWeights(followed) {
        const counts = new Map();
        followed.forEach(id => {
            if (!id || isNonYoutuber(id) || isDiscoveryExcluded(id)) return;
            channelCategories(id).forEach(category => counts.set(category, (counts.get(category) || 0) + 1));
        });
        return counts;
    }

    function categoryAffinity(videoOrChannelId, categoryWeights) {
        if (!categoryWeights?.size) return 0;
        return channelCategories(videoOrChannelId).reduce((sum, category) => {
            const count = categoryWeights.get(category) || 0;
            if (!count) return sum;
            return sum + Math.min(3.5, 0.45 + Math.max(0, count - 1) * 1.15);
        }, 0);
    }

    function primaryCategory(video) {
        return channelCategories(video)[0] || '';
    }

    function buildContext(videos) {
        const followed = new Set(followedIds());
        const categoryWeights = buildFollowedCategoryWeights(followed);
        const liked = likedVideos().filter(video => !isNonYoutuber(video) && !isDiscoveryExcluded(video));
        const likedChannelCounts = new Map();
        const likedTokens = new Set();

        liked.forEach(video => {
            const id = channelId(video);
            if (id) likedChannelCounts.set(id, (likedChannelCounts.get(id) || 0) + 1);
            topicTokens(video).forEach(token => likedTokens.add(token));
        });

        const byChannel = new Map();
        videos.forEach(video => {
            const id = channelId(video);
            const views = viewCount(video);
            if (!id || followed.has(id) || isNonYoutuber(video) || isDiscoveryExcluded(video) || views <= 0) return;
            const metrics = byChannel.get(id) || { views: [], engagement: [], velocityRecent: [], velocityAll: [] };
            metrics.views.push(views);
            metrics.engagement.push(engagementRate(video));
            const velocity = viewVelocity(video);
            if (velocity > 0) {
                metrics.velocityAll.push(velocity);
                if (ageDays(video) <= 365) metrics.velocityRecent.push(velocity);
            }
            byChannel.set(id, metrics);
        });

        const baselines = new Map();
        const engagementBaselines = new Map();
        const velocityBaselines = new Map();
        byChannel.forEach((metrics, id) => {
            baselines.set(id, median(metrics.views) || 1);
            engagementBaselines.set(id, median(metrics.engagement) || 0);
            velocityBaselines.set(id, median(metrics.velocityRecent.length ? metrics.velocityRecent : metrics.velocityAll) || 0);
        });

        return {
            followed,
            categoryWeights,
            likedChannelCounts,
            likedTokens,
            baselines,
            engagementBaselines,
            velocityBaselines,
            watched: watchedIds(),
            hidden: hiddenIds()
        };
    }

    function score(video, context) {
        const id = channelId(video);
        const views = viewCount(video);
        const baseline = context.baselines.get(id) || Math.max(views, 1);
        const relativeSuccess = Math.log2((views + 1) / (baseline + 1));
        let points = Math.log10(views + 1) * 1.25 + Math.max(-2, Math.min(5, relativeSuccess * 2.1));

        points += Math.min(7, (context.likedChannelCounts.get(id) || 0) * 2.3);
        let overlap = 0;
        topicTokens(video).forEach(token => {
            if (context.likedTokens.has(token)) overlap += 1;
        });
        points += Math.min(7, overlap * 1.35);
        points += Math.min(6, categoryAffinity(video, context.categoryWeights));

        const engagement = engagementRate(video);
        const engagementBaseline = context.engagementBaselines.get(id) || engagement || 0.1;
        const relativeEngagement = Math.log2((engagement + 0.1) / (engagementBaseline + 0.1));
        points += Math.max(-1.5, Math.min(4.2, relativeEngagement * 1.35));
        points += Math.min(1.4, Math.log10(engagement + 1) * 0.55);

        const days = ageDays(video);
        const velocity = viewVelocity(video);
        const velocityBaseline = context.velocityBaselines.get(id) || velocity || 1;
        if (Number.isFinite(days) && days <= 180 && velocity > 0) {
            const relativeVelocity = Math.log2((velocity + 0.1) / (velocityBaseline + 0.1));
            points += Math.max(-1, Math.min(3.4, relativeVelocity * 0.9));
        }

        if (Number.isFinite(days)) {
            if (days <= 14) points += 1.4;
            else if (days <= 90) points += 0.65;
        }

        points += languageBonus(video);
        points += behaviorAffinity(video);
        if (video?.source === 'archive') points += 0.8;
        if (context.watched.has(String(video?.id || ''))) points -= 12;

        // Variació controlada: cada generació canvia sense convertir-se en aleatòria.
        points += (seededValue(video?.id) - 0.5) * 2.6;
        return points;
    }

    function isEligible(video, context, relaxDuration = false) {
        const id = String(video?.id || '').trim();
        const ch = channelId(video);
        if (
            !id ||
            !ch ||
            context.hidden.has(ch) ||
            context.followed.has(ch) ||
            isNonYoutuber(video) ||
            isDiscoveryExcluded(video)
        ) return false;
        if (video?.isShort === true) return false;
        const duration = durationSeconds(video);
        if (!relaxDuration && duration > 0 && duration < MIN_SECONDS) return false;
        return true;
    }

    function buildChannelChoices(candidates, context) {
        const groups = new Map();
        candidates.forEach(video => {
            const id = channelId(video);
            if (!id) return;
            const values = groups.get(id) || [];
            values.push(video);
            groups.set(id, values);
        });

        return [...groups.entries()].map(([id, videos]) => {
            const ranked = videos
                .map(video => ({
                    video,
                    behavior: behaviorAffinity(video),
                    points: score(video, context),
                }))
                .sort((a, b) => b.points - a.points);
            const mostViewed = videos.reduce((best, video) => (
                !best || viewCount(video) > viewCount(best) ? video : best
            ), null);
            return {
                id,
                regular: ranked[0],
                mostViewed: mostViewed
                    ? {
                        video: mostViewed,
                        behavior: behaviorAffinity(mostViewed),
                        points: score(mostViewed, context),
                    }
                    : ranked[0],
                baseline: context.baselines.get(id) || 0,
                category: primaryCategory(ranked[0]?.video),
            };
        });
    }

    function rank(videos, { avoidChannels = null } = {}) {
        const unique = new Map();
        (Array.isArray(videos) ? videos : []).forEach(video => {
            const id = String(video?.id || '').trim();
            if (id && !unique.has(id)) unique.set(id, video);
        });
        const all = Array.from(unique.values());
        const context = buildContext(all);

        let candidates = all.filter(video => isEligible(video, context, false));
        const strictChannels = new Set(candidates.map(channelId)).size;
        if (strictChannels < RENDER_LIMIT) candidates = all.filter(video => isEligible(video, context, true));

        const choices = buildChannelChoices(candidates, context);
        const baselineValues = choices
            .map(choice => choice.baseline)
            .filter(value => Number.isFinite(value) && value > 0)
            .sort((a, b) => a - b);
        const smallCutoff = baselineValues.length
            ? baselineValues[Math.floor((baselineValues.length - 1) * 0.5)]
            : 0;

        const avoided = avoidChannels instanceof Set ? avoidChannels : new Set();
        const freshCount = choices.filter(choice => !avoided.has(choice.id)).length;
        const canAvoidPrevious = freshCount >= RENDER_LIMIT;
        const pickedChannels = new Set();
        const recentCategories = [];
        const result = [];

        function eligibleChoice(choice, { smallOnly = false } = {}) {
            if (!choice || pickedChannels.has(choice.id)) return false;
            if (canAvoidPrevious && avoided.has(choice.id)) return false;
            if (smallOnly && !(choice.baseline > 0 && choice.baseline <= smallCutoff)) return false;
            return true;
        }

        function choosePool({ smallOnly = false } = {}) {
            let pool = choices.filter(choice => eligibleChoice(choice, { smallOnly }));
            if (!pool.length && canAvoidPrevious) return null;
            if (!pool.length) {
                pool = choices.filter(choice => {
                    if (!choice || pickedChannels.has(choice.id)) return false;
                    if (smallOnly && !(choice.baseline > 0 && choice.baseline <= smallCutoff)) return false;
                    return true;
                });
            }
            if (!pool.length) return null;

            const previousVideo = result[result.length - 1] || null;
            const explorationSlot = result.length > 0 && (result.length + 1) % 4 === 0;
            return pool
                .map(choice => {
                    const item = smallOnly ? choice.mostViewed : choice.regular;
                    const freshnessBonus = avoided.has(choice.id) ? -6 : 0;
                    const channelVariation = (seededValue(`channel:${choice.id}`) - 0.5) * 2.4;
                    const flow = transitionScore(previousVideo, item?.video, recentCategories);
                    const learningAdjustment = explorationSlot ? -(Number(item?.behavior) || 0) : 0;
                    return {
                        choice,
                        item,
                        order: (item?.points || 0) + freshnessBonus + channelVariation + flow + learningAdjustment,
                    };
                })
                .sort((a, b) => b.order - a.order)[0];
        }

        while (result.length < RENDER_LIMIT && pickedChannels.size < choices.length) {
            const wantsSmallChannel = result.length > 0 && (result.length + 1) % SMALL_CHANNEL_SLOT_EVERY === 0;
            let selected = wantsSmallChannel ? choosePool({ smallOnly: true }) : null;
            if (!selected) selected = choosePool();
            if (!selected?.item?.video) break;

            const { choice, item } = selected;
            result.push({ ...item.video, segueixTV: true });
            pickedChannels.add(choice.id);
            if (choice.category) {
                recentCategories.push(choice.category);
                if (recentCategories.length > 2) recentCategories.shift();
            }
        }

        return result.slice(0, RENDER_LIMIT);
    }

    function archiveChannels(baseVideos) {
        const followed = new Set(followedIds());
        const categoryWeights = buildFollowedCategoryWeights(followed);
        const top = new Map();
        (Array.isArray(baseVideos) ? baseVideos : []).forEach(video => {
            const id = channelId(video);
            if (!id || followed.has(id) || isNonYoutuber(video) || isDiscoveryExcluded(video)) return;
            top.set(id, Math.max(top.get(id) || 0, viewCount(video)));
        });

        const likedDiscovery = likedVideos()
            .filter(video => !isNonYoutuber(video) && !isDiscoveryExcluded(video))
            .map(channelId)
            .filter(id => id && !followed.has(id));

        const discovery = Array.from(top.entries())
            .map(([id, views]) => ({
                id,
                order: categoryAffinity(id, categoryWeights) * 2.6
                    + Math.log10(views + 1)
                    + seededValue(`archive:${id}`) * 4.5,
            }))
            .sort((a, b) => b.order - a.order)
            .map(item => item.id);

        return [...new Set([...likedDiscovery, ...discovery])]
            .filter(id => id && !followed.has(id) && !isNonYoutuber(id) && !isDiscoveryExcluded(id))
            .slice(0, ARCHIVE_CHANNEL_LIMIT);
    }

    async function loadArchiveChannel(id) {
        const normalized = String(id || '').trim();
        const followed = new Set(followedIds());
        if (!normalized || followed.has(normalized) || isNonYoutuber(normalized) || isDiscoveryExcluded(normalized)) return [];
        if (archiveCache.has(normalized)) return archiveCache.get(normalized);

        const task = (async () => {
            try {
                const path = `data/archive/channels/${encodeURIComponent(normalized)}.json`;
                const url = window.appDataUrl?.(path) || new URL(path, document.baseURI);
                const response = await fetch(url, { cache: 'force-cache' });
                if (!response.ok) return [];
                const data = await response.json();
                return (Array.isArray(data?.videos) ? data.videos : [])
                    .filter(video => video?.id)
                    .map(video => ({ ...video, channelId: video.channelId || normalized, source: 'archive', segueixTV: true }))
                    .filter(video => !followed.has(channelId(video)) && !isNonYoutuber(video) && !isDiscoveryExcluded(video));
            } catch {
                return [];
            }
        })();
        archiveCache.set(normalized, task);
        return task;
    }

    async function loadArchive(baseVideos) {
        const groups = await Promise.all(archiveChannels(baseVideos).map(loadArchiveChannel));
        return groups.flat();
    }

    function renderTitle() {
        const pageTitle = document.getElementById('pageTitle');
        if (!pageTitle) return;
        pageTitle.classList.add('page-title--with-actions');
        pageTitle.dataset.title = LABEL;
        pageTitle.innerHTML = `
            <span class="segueix-tv-title-label">
                <span class="page-title__query">Música TV</span>
                <span class="radar-info-wrap">
                    <button type="button" class="btn-round-icon radar-info-btn" data-action="radar-info" aria-label="Què és Música TV?" aria-expanded="false" title="Què és Música TV?">
                        <span class="chip-info-icon" aria-hidden="true">i</span>
                    </button>
                    <div class="radar-info-popover" role="tooltip" hidden>
                        <button type="button" class="chip-info-popover-close" data-action="radar-info-close" aria-label="Tancar">×</button>
                        <p><strong>Música TV</strong> és una televisió de <strong>descoberta contínua</strong>: crea una programació de vídeos de creadors que encara no segueixes.</p>
                        <p>La selecció té en compte els teus <strong>❤️</strong>, les <strong>categories</strong>, l'èxit relatiu de cada vídeo dins del seu canal, la interacció i el que acostumes a mirar fins al final o saltar.</p>
                        <p>L'ordre també busca una <strong>seqüència més enganxosa</strong>: relaciona temes, alterna durades i evita una programació massa repetitiva. Una de cada quatre posicions conserva més descoberta. Prem <strong>↻</strong> per generar-ne una de nova.</p>
                    </div>
                </span>
            </span>
            <span class="page-title__actions">
                <button type="button" class="btn-round-icon radar-info-btn segueix-tv-refresh-btn" data-action="segueix-tv-refresh" aria-label="Genera una nova selecció de Música TV" title="Refresca Música TV">
                    <i data-lucide="refresh-cw" aria-hidden="true"></i>
                </button>
            </span>`;
    }

    function decorateCards() {
        document.querySelectorAll('.segueix-tv-badge').forEach(badge => badge.remove());
    }

    function render(videos) {
        if (app.state?.selectedCategory !== LABEL) return;
        tvQueue = Array.isArray(videos) ? videos.slice(0, RENDER_LIMIT) : [];
        const renderer = app.state?.feed?.renderer;
        const grid = document.getElementById('videosGrid');
        app.state.feed.lastRenderedList = tvQueue;
        if (typeof renderer === 'function' && tvQueue.length) {
            renderer(tvQueue);
        } else if (grid && !tvQueue.length) {
            grid.innerHTML = '<div class="segueix-tv-empty">Preparant nous creadors per descobrir…</div>';
        }
        requestAnimationFrame(() => {
            renderTitle();
            decorateCards();
            window.lucide?.createIcons?.();
        });
    }

    function setActiveChip() {
        const bar = document.querySelector('.chips-bar');
        if (!bar) return;
        bar.querySelectorAll('.chip').forEach(chip => {
            const active = chip.classList.contains('segueix-tv-chip');
            chip.classList.toggle('is-active', active);
            chip.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    }

    function startTVPlaylist(videoId) {
        const id = String(videoId || '').trim();
        if (!id || !tvQueue.length || typeof loadVideoInSequence !== 'function') return false;
        const clickedIndex = tvQueue.findIndex(video => String(video?.id || '') === id);
        if (clickedIndex < 0) return false;

        const rotated = [...tvQueue.slice(clickedIndex), ...tvQueue.slice(0, clickedIndex)];
        isPlaylistMode = true;
        activePlaylistQueue = rotated;
        currentPlaylistIndex = 0;
        activePlaylistId = TV_PLAYLIST_ID;
        activePlaylistName = 'Segueix';
        document.body.classList.add('segueix-tv-playback');
        try {
            app.features.analytics?.track?.('tv_start', {
                surface: 'tv',
                tvMode: 'segueix',
            });
        } catch {}
        loadVideoInSequence({ autoPlay: false });
        return true;
    }

    function installGridClickBridge() {
        if (gridClickBound) return;
        const grid = document.getElementById('videosGrid');
        if (!grid) return;
        gridClickBound = true;
        grid.addEventListener('click', event => {
            if (!document.body.classList.contains('segueix-tv-active')) return;
            if (event.target.closest('button, a, .channel-link, .video-action-btn, .playlist-action')) return;
            const card = event.target.closest('.video-card[data-video-id], [data-video-id].video-card');
            if (!card) return;
            const videoId = card.dataset.videoId;
            if (!videoId) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            startTVPlaylist(videoId);
        }, true);
    }

    function installLoopBridge() {
        if (loopBridgeInstalled || typeof handlePlaylistVideoEnded !== 'function') return;
        loopBridgeInstalled = true;
        const original = handlePlaylistVideoEnded;
        handlePlaylistVideoEnded = function () {
            if (
                typeof isPlaylistMode !== 'undefined' &&
                isPlaylistMode &&
                typeof activePlaylistId !== 'undefined' &&
                activePlaylistId === TV_PLAYLIST_ID &&
                Array.isArray(activePlaylistQueue) &&
                activePlaylistQueue.length > 0
            ) {
                currentPlaylistIndex = (currentPlaylistIndex + 1) % activePlaylistQueue.length;
                loadVideoInSequence();
                return;
            }
            return original.apply(this, arguments);
        };
    }

    function installTitleActions() {
        if (titleActionsBound) return;
        titleActionsBound = true;
        document.addEventListener('click', event => {
            const refreshButton = event.target.closest('[data-action="segueix-tv-refresh"]');
            if (!refreshButton || app.state?.selectedCategory !== LABEL) return;
            event.preventDefault();
            event.stopPropagation();
            refreshButton.classList.add('is-refreshing');
            refresh({ button: refreshButton });
        });
    }

    async function activate({ avoidChannels = null, skipImmediate = false, startPlayback = false } = {}) {
        const currentRun = ++runId;
        app.state.selectedCategory = LABEL;
        try { localStorage.setItem('catube_last_category', LABEL); } catch {}
        document.body.classList.add('segueix-tv-active');
        setActiveChip();
        renderTitle();
        installGridClickBridge();
        installLoopBridge();
        installTitleActions();
        window.lucide?.createIcons?.();

        let base = sourceVideos();
        if (!base.length && typeof window.YouTubeAPI?.loadFeed === 'function') {
            try { await window.YouTubeAPI.loadFeed(); } catch {}
            base = sourceVideos();
        }

        const immediate = rank(base, { avoidChannels });
        if (startPlayback && immediate.length) {
            render(immediate);
            startTVPlaylist(immediate[0].id, { startPaused: true });
            return;
        }
        if (!skipImmediate || immediate.length >= RENDER_LIMIT) render(immediate);

        const archive = await loadArchive(base);
        if (currentRun !== runId || app.state?.selectedCategory !== LABEL) return;
        const enriched = rank([...base, ...archive], { avoidChannels });
        const finalQueue = enriched.length ? enriched : immediate;
        render(finalQueue);
        if (startPlayback && finalQueue.length) {
            startTVPlaylist(finalQueue[0].id, { startPaused: true });
        }
    }

    async function refresh({ button = null, restartPlayback = false } = {}) {
        const previousChannels = new Set(tvQueue.map(channelId).filter(Boolean));
        generationSeed = createGenerationSeed();
        try {
            await activate({ avoidChannels: previousChannels, skipImmediate: true, startPlayback: restartPlayback });
        } finally {
            const currentButton = document.querySelector('[data-action="segueix-tv-refresh"]');
            (currentButton || button)?.classList.remove('is-refreshing');
        }
    }

    async function regeneratePlayback() {
        await refresh({ restartPlayback: true });
        return true;
    }
    function leave() {
        if (!document.body.classList.contains('segueix-tv-active')) return;
        runId += 1;
        document.body.classList.remove('segueix-tv-active');
        if (typeof activePlaylistId !== 'undefined' && activePlaylistId === TV_PLAYLIST_ID) {
            document.body.classList.remove('segueix-tv-playback');
            if (typeof exitPlaylistMode === 'function') exitPlaylistMode();
        }
    }

    function handleSegueixTVChipClick(event) {
        event.preventDefault();
        event.stopPropagation();
        activate({ startPlayback: true });
    }

    function ensureChip() {
        const bar = document.querySelector('.chips-bar.home-categories, .chips-bar');
        const radar = bar?.querySelector('.chip[data-cat="Radar"]');
        const novetats = bar?.querySelector('.chip[data-cat="Novetats"]');
        const anchor = radar || novetats;
        if (!bar || !anchor) return;

        let button = bar.querySelector('.segueix-tv-chip');
        if (!button) {
            button = document.createElement('button');
            button.type = 'button';
            button.className = 'chip segueix-tv-chip';
        }

        // El xip pot venir restaurat de la caché HTML. Per això normalitzem
        // sempre el contingut, els atributs i el listener, encara que ja existeixi.
        button.dataset.cat = LABEL;
        button.dataset.fixed = 'true';
        button.setAttribute('aria-label', LABEL);
        button.textContent = LABEL;
        button.removeEventListener('click', handleSegueixTVChipClick);
        button.addEventListener('click', handleSegueixTVChipClick);

        if (anchor.nextElementSibling !== button) anchor.after(button);

        const active = app.state?.selectedCategory === LABEL;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');

        // Persistim també la versió corregida perquè la propera arrencada
        // no torni a recuperar el marcatge antic.
        try { window.saveChipsToCache?.(); } catch {}
    }
    function init() {
        installStyles();
        const bar = document.querySelector('.chips-bar.home-categories, .chips-bar');
        if (!bar) return false;
        ensureChip();
        installGridClickBridge();
        installLoopBridge();
        installTitleActions();

        if (!chipsObserver) {
            let scheduled = false;
            chipsObserver = new MutationObserver(() => {
                if (scheduled) return;
                scheduled = true;
                queueMicrotask(() => {
                    scheduled = false;
                    ensureChip();
                });
            });
            chipsObserver.observe(bar, { childList: true });
        }

        bar.addEventListener('click', event => {
            const chip = event.target.closest('.chip[data-cat]');
            if (chip && !chip.classList.contains('segueix-tv-chip')) leave();
        }, true);
        document.addEventListener('click', event => {
            if (event.target.closest('.nav-trigger, .nav-item')) leave();
        }, true);

        if (app.state?.selectedCategory === LABEL) activate();
        return true;
    }

    function boot(attempt = 0) {
        const bridgedState = Object.getOwnPropertyDescriptor(app.state || {}, 'selectedCategory');
        if (!bridgedState?.set || !document.querySelector('.chips-bar')) {
            if (attempt < 120) setTimeout(() => boot(attempt + 1), 50);
            return;
        }
        init();
    }

    app.features.segueixTV = {
        activate,
        refresh,
        regeneratePlayback,
        leave,
        rank,
        isNonYoutuber,
        isDiscoveryExcluded,
        startTVPlaylist,
        channelCategories,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => boot(), { once: true });
    } else {
        boot();
    }
})(window);
