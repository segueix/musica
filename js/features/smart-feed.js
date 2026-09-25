(function (window) {
    'use strict';

    const app = window.SegueixApp || (window.SegueixApp = {});
    app.features = app.features || {};

    const MIX_PATTERN = [
        'affinity', 'affinity', 'followed', 'discovery', 'affinity',
        'discovery', 'affinity', 'followed', 'surprise', 'affinity',
    ];
    const TOP_CHANNEL_CAP = 2;
    const TOP_CHANNEL_WINDOW = 20;
    const MAX_TOPIC_TOKENS = 28;
    const STOPWORDS = new Set([
        'aixo', 'aquest', 'aquesta', 'aquests', 'aquestes', 'amb', 'avui', 'com', 'contra', 'dels', 'del', 'des',
        'els', 'entre', 'les', 'mes', 'més', 'molt', 'per', 'pel', 'pels', 'que', 'qui', 'sense', 'sobre', 'tot',
        'tots', 'totes', 'una', 'unes', 'uns', 'video', 'videos', 'the', 'and', 'for', 'from', 'this', 'with',
        'your', 'you', 'new', 'nou', 'nova'
    ]);

    let lastDiagnostics = null;

    function safeParse(key, fallback) {
        try {
            const parsed = JSON.parse(localStorage.getItem(key) || 'null');
            return parsed == null ? fallback : parsed;
        } catch {
            return fallback;
        }
    }

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }

    function videoId(video) {
        return String(video?.id || video?.videoId || video?.snippet?.resourceId?.videoId || '').trim();
    }

    function channelId(video) {
        return String(video?.channelId || video?.snippet?.channelId || '').trim();
    }

    function textTokens(value) {
        return normalizeText(value)
            .split(/[^a-z0-9à-ÿ]+/i)
            .map(token => token.trim())
            .filter(token => token.length > 2 && !STOPWORDS.has(token));
    }

    function videoTokens(video) {
        const tokens = new Set();
        const add = (value, max = MAX_TOPIC_TOKENS) => {
            for (const token of textTokens(value)) {
                tokens.add(token);
                if (tokens.size >= max) break;
            }
        };
        add(video?.title || video?.snippet?.title || '');
        const tags = video?.tags || video?.snippet?.tags;
        if (Array.isArray(tags)) tags.slice(0, 12).forEach(tag => add(tag));
        add(String(video?.description || video?.snippet?.description || '').slice(0, 420));
        return [...tokens].slice(0, MAX_TOPIC_TOKENS);
    }

    function videoCategories(video, customByChannel = {}) {
        const values = [
            ...(Array.isArray(video?.categories) ? video.categories : []),
            ...(Array.isArray(video?.customCategories) ? video.customCategories : []),
            ...(Array.isArray(video?.channelCategories) ? video.channelCategories : []),
            ...(Array.isArray(video?.snippet?.categories) ? video.snippet.categories : []),
            video?.category,
            video?.categoryName,
            video?.snippet?.category,
            ...(Array.isArray(customByChannel[channelId(video)]) ? customByChannel[channelId(video)] : []),
        ];
        return [...new Set(values.map(normalizeText).map(value => value.trim()).filter(Boolean))].slice(0, 8);
    }

    function numberStat(video, key) {
        const raw = video?.[key] ?? video?.statistics?.[key];
        if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
        if (typeof raw === 'string') {
            const normalized = raw.replace(/[^\d.]/g, '');
            const value = Number(normalized);
            return Number.isFinite(value) ? value : 0;
        }
        return 0;
    }

    function publishedMillis(video) {
        const value = video?.publishedAt || video?.uploadDate || video?.snippet?.publishedAt;
        const ms = new Date(value || 0).getTime();
        return Number.isFinite(ms) && ms > 0 ? ms : 0;
    }

    function ageDays(video) {
        const ms = publishedMillis(video);
        if (!ms) return Infinity;
        return Math.max(0, (Date.now() - ms) / 86400000);
    }

    function durationSeconds(video) {
        const direct = Number(video?.durationSeconds);
        if (Number.isFinite(direct) && direct > 0) return direct;
        const raw = String(video?.duration || video?.contentDetails?.duration || '');
        if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(raw)) {
            return raw.split(':').reduce((total, part) => total * 60 + Number(part), 0);
        }
        const match = raw.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
        if (!match) return 0;
        return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
    }

    function durationBucket(video) {
        const seconds = durationSeconds(video);
        if (!seconds) return '';
        if (seconds < 600) return 'curt';
        if (seconds < 1500) return 'mitja';
        if (seconds < 3000) return 'llarg';
        return 'molt-llarg';
    }

    function median(values) {
        const list = values.filter(Number.isFinite).sort((a, b) => a - b);
        if (!list.length) return 0;
        const middle = Math.floor(list.length / 2);
        return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2;
    }

    function engagementRate(video) {
        const views = numberStat(video, 'viewCount') || numberStat(video, 'views');
        const hasLikes = video?.likeCount != null || video?.statistics?.likeCount != null;
        const hasComments = video?.commentCount != null || video?.statistics?.commentCount != null;
        if (!views || (!hasLikes && !hasComments)) return null;
        const likes = numberStat(video, 'likeCount');
        const comments = numberStat(video, 'commentCount');
        return ((likes + comments * 2.2 + 1) / (views + 200)) * 1000;
    }

    function addWeight(map, key, amount) {
        if (!key || !Number.isFinite(amount) || amount === 0) return;
        map.set(key, (map.get(key) || 0) + amount);
    }

    function addVideoProfile(profile, video, weight) {
        videoTokens(video).slice(0, 18).forEach(token => addWeight(profile.topics, token, weight));
        videoCategories(video, profile.customByChannel).forEach(category => addWeight(profile.categories, category, weight));
        const id = channelId(video);
        if (id) addWeight(profile.channels, id, weight * 0.75);
        const bucket = durationBucket(video);
        if (bucket) addWeight(profile.durations, bucket, weight * 0.45);
    }

    function buildProfile(videos) {
        const followed = new Set(
            (safeParse('catube_follows', []) || []).map(String).filter(Boolean)
        );
        const liked = Array.isArray(safeParse('catube_liked_videos', []))
            ? safeParse('catube_liked_videos', [])
            : [];
        const history = Array.isArray(safeParse('catube_history', []))
            ? safeParse('catube_history', [])
            : [];
        const continueEntries = Array.isArray(safeParse('catube_continue_watching_v1', []))
            ? safeParse('catube_continue_watching_v1', [])
            : [];
        const customByChannelRaw = safeParse('catube_channel_custom_categories', {});
        const customByChannel = customByChannelRaw && typeof customByChannelRaw === 'object'
            ? customByChannelRaw
            : {};

        const profile = {
            followed,
            likedIds: new Set(liked.map(item => videoId(item)).filter(Boolean)),
            watchedIds: new Set(history.map(item => videoId(item)).filter(Boolean)),
            topics: new Map(),
            categories: new Map(),
            channels: new Map(),
            durations: new Map(),
            customByChannel,
        };

        followed.forEach(id => addWeight(profile.channels, id, 2.7));

        liked.forEach(item => addVideoProfile(profile, item, 3.0));

        const continueById = new Map(
            continueEntries
                .map(item => [String(item?.id || item?.videoId || ''), item])
                .filter(([id]) => id)
        );

        history.slice(0, 40).forEach((item, index) => {
            const recency = Math.exp(-index / 12);
            const progress = continueById.get(videoId(item));
            const ratio = progress && Number(progress.duration) > 0
                ? Math.max(0, Math.min(1, Number(progress.position) / Number(progress.duration)))
                : null;

            let weight = 0.32 + recency * 0.48;
            if (ratio != null && ratio >= 0.6) weight += 0.45;
            else if (ratio != null && ratio < 0.2) weight -= 0.28;
            addVideoProfile(profile, item, weight);
        });

        // Si un ❤️ antic només conserva l'ID, recuperem metadades del feed actual.
        const likedMissingMetadata = new Set(
            [...profile.likedIds].filter(id => !liked.some(item => videoId(item) === id && item?.title))
        );
        if (likedMissingMetadata.size) {
            videos.forEach(video => {
                if (likedMissingMetadata.has(videoId(video))) addVideoProfile(profile, video, 3.0);
            });
        }

        return profile;
    }

    function buildBaselines(videos) {
        const groups = new Map();
        videos.forEach(video => {
            const id = channelId(video);
            if (!id) return;
            if (!groups.has(id)) groups.set(id, []);
            groups.get(id).push(video);
        });

        const result = new Map();
        groups.forEach((items, id) => {
            const views = items.map(video => numberStat(video, 'viewCount') || numberStat(video, 'views')).filter(value => value > 0);
            const engagements = items.map(engagementRate).filter(value => value != null);
            result.set(id, {
                views: median(views),
                engagement: median(engagements),
            });
        });
        return result;
    }

    function weightedMatch(map, keys, cap) {
        const values = keys
            .map(key => Number(map.get(key)) || 0)
            .filter(value => value !== 0)
            .sort((a, b) => Math.abs(b) - Math.abs(a))
            .slice(0, 6);
        if (!values.length) return 0;
        const total = values.reduce((sum, value) => sum + value, 0);
        return Math.max(-cap, Math.min(cap, total / Math.sqrt(values.length)));
    }

    function profileAffinity(video, profile) {
        const topic = weightedMatch(profile.topics, videoTokens(video), 5.6);
        const category = weightedMatch(profile.categories, videoCategories(video, profile.customByChannel), 3.2);
        const channel = Math.max(-3.5, Math.min(4.2, Number(profile.channels.get(channelId(video))) || 0));
        const duration = Math.max(-1.2, Math.min(1.2, Number(profile.durations.get(durationBucket(video))) || 0));

        let learned = 0;
        try {
            const historical = Number(app.features.tvLearning?.affinityForVideo?.(video));
            if (Number.isFinite(historical)) learned += historical * 0.8;
            const session = Number(app.features.tvLearning?.sessionAffinityForVideo?.(video));
            if (Number.isFinite(session)) learned += session * 0.6;
        } catch {}

        return Math.max(-7, Math.min(11, topic * 0.9 + category * 0.8 + channel + duration + learned));
    }

    function qualityScore(video, baseline) {
        const views = numberStat(video, 'viewCount') || numberStat(video, 'views');
        let score = Math.log10(views + 1) * 0.32;

        if (views > 0 && baseline?.views > 0) {
            score += Math.max(-1.4, Math.min(3.2, Math.log2((views + 100) / (baseline.views + 100)) * 1.15));
        }

        const engagement = engagementRate(video);
        if (engagement != null && baseline?.engagement > 0) {
            score += Math.max(-1.1, Math.min(2.6, Math.log2((engagement + 0.1) / (baseline.engagement + 0.1)) * 0.9));
        }

        const days = ageDays(video);
        if (days <= 7) score += 1.65;
        else if (days <= 30) score += 1.05;
        else if (days <= 90) score += 0.55;
        else if (days <= 365) score += 0.15;

        return score;
    }

    function stableDailyVariation(video) {
        const day = Math.floor(Date.now() / 86400000);
        const value = `${videoId(video)}:${day}`;
        let hash = 2166136261;
        for (const char of value) {
            hash ^= char.charCodeAt(0);
            hash = Math.imul(hash, 16777619);
        }
        return ((hash >>> 0) / 4294967295 - 0.5) * 0.9;
    }

    function enrich(videos, profile) {
        const baselines = buildBaselines(videos);
        const items = videos.map((video, originalIndex) => {
            const id = channelId(video);
            const affinity = profileAffinity(video, profile);
            const quality = qualityScore(video, baselines.get(id));
            const followed = profile.followed.has(id);
            const familiar = (Number(profile.channels.get(id)) || 0) > 0.9;
            const variation = stableDailyVariation(video);

            return {
                video,
                originalIndex,
                channelId: id,
                affinity,
                quality,
                followed,
                familiar,
                overall: affinity * 1.05 + quality + variation,
                followedScore: (followed ? 4.5 : -8) + affinity * 0.7 + quality + variation,
                discoveryScore: (followed ? -5 : 1.4) + (familiar ? -1.2 : 0.8) + quality * 1.1 + affinity * 0.24 + variation,
                surpriseScore: (followed ? -5 : 1.2) + quality * 1.35 - Math.max(0, affinity) * 0.42 + variation * 1.5,
            };
        });

        return items;
    }

    function slotEligible(item, kind) {
        if (kind === 'followed') return item.followed;
        if (kind === 'discovery') return !item.followed;
        if (kind === 'surprise') return !item.followed && item.affinity < 3.2;
        return true;
    }

    function slotScore(item, kind, output, channelCounts) {
        let score =
            kind === 'followed' ? item.followedScore :
            kind === 'discovery' ? item.discoveryScore :
            kind === 'surprise' ? item.surpriseScore :
            item.overall;

        const last = output[output.length - 1];
        const previous = output[output.length - 2];
        if (last?.channelId && item.channelId === last.channelId) score -= 7;
        if (previous?.channelId && item.channelId === previous.channelId) score -= 1.4;

        const used = channelCounts.get(item.channelId) || 0;
        if (output.length < TOP_CHANNEL_WINDOW && used >= TOP_CHANNEL_CAP) score -= 9;
        else score -= used * 0.45;

        // En els slots d'afinitat no deixem que un vídeo fluix pugi només per tema.
        if (kind === 'affinity') score += item.quality * 0.3;
        return score;
    }

    function pickNext(remaining, kind, output, channelCounts) {
        let candidates = remaining
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => slotEligible(item, kind));

        if (!candidates.length) {
            candidates = remaining.map((item, index) => ({ item, index }));
        }

        if (output.length < TOP_CHANNEL_WINDOW) {
            const underCap = candidates.filter(({ item }) => (channelCounts.get(item.channelId) || 0) < TOP_CHANNEL_CAP);
            if (underCap.length) candidates = underCap;
        }

        const lastChannel = output[output.length - 1]?.channelId || '';
        if (lastChannel) {
            const nonRepeated = candidates.filter(({ item }) => item.channelId !== lastChannel);
            if (nonRepeated.length) candidates = nonRepeated;
        }

        let bestIndex = -1;
        let bestScore = -Infinity;
        candidates.forEach(({ item, index }) => {
            const score = slotScore(item, kind, output, channelCounts);
            if (score > bestScore) {
                bestScore = score;
                bestIndex = index;
            }
        });

        return bestIndex;
    }

    function rank(videos, options = {}) {
        const source = Array.isArray(videos)
            ? videos.filter(video => video && videoId(video))
            : [];
        if (source.length < 2) return source;

        const profile = buildProfile(source);
        const remaining = enrich(source, profile);
        const output = [];
        const channelCounts = new Map();
        const bucketCounts = { affinity: 0, followed: 0, discovery: 0, surprise: 0 };

        while (remaining.length) {
            const kind = MIX_PATTERN[output.length % MIX_PATTERN.length];
            const index = pickNext(remaining, kind, output, channelCounts);
            if (index < 0) break;

            const [selected] = remaining.splice(index, 1);
            output.push(selected);
            channelCounts.set(selected.channelId, (channelCounts.get(selected.channelId) || 0) + 1);
            bucketCounts[kind] += 1;
        }

        if (remaining.length) output.push(...remaining);

        lastDiagnostics = {
            sourceCount: source.length,
            followedChannels: profile.followed.size,
            likedVideos: profile.likedIds.size,
            historyVideos: profile.watchedIds.size,
            buckets: bucketCounts,
            firstTen: output.slice(0, 10).map(item => ({
                id: videoId(item.video),
                channelId: item.channelId,
                affinity: Math.round(item.affinity * 100) / 100,
                quality: Math.round(item.quality * 100) / 100,
                followed: item.followed,
            })),
            reason: options.reason || 'recommended-feed',
        };

        // Analítica agregada: només registra que el recomanador s'ha utilitzat,
        // mai els vídeos, canals ni el perfil que ha produït l'ordre.
        try {
            app.features.analytics?.track?.('smart_feed_rendered', {
                surface: 'home',
                category: 'tot',
            });
        } catch {}

        return output.map(item => item.video);
    }

    function getDiagnostics() {
        return lastDiagnostics ? JSON.parse(JSON.stringify(lastDiagnostics)) : null;
    }

    app.features.smartFeed = {
        rank,
        getDiagnostics,
        buildProfile,
        profileAffinity,
        qualityScore,
        videoTokens,
        videoCategories,
    };
})(window);
