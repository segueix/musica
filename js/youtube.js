// Catàleg estàtic de Música. YouTubeAPI conserva el nom per compatibilitat amb el client.

const FEED_URL = 'data/feed.json';
const HIDDEN_VIDEOS_URL = 'data/hidden-videos.json';
// Vídeos amb restricció d'edat o que no es poden incrustar (no sonarien al reproductor): els detecten el generador
// diari i l'actualització setmanal de l'arxiu (scripts/lib/restriccions_youtube.js) i s'amaguen com els ocults.
const RESTRICTED_VIDEOS_URL = 'data/videos-restringits.json';
const HISTORY_POOL_URL = 'data/history-pool.json';
// Totes les cançons de l'arxiu (scripts/lib/arxiu_musical.js: buildStyleHistory): la vista d'un estil les barreja amb
// les del feed abans d'ordenar-les amb el motor de selecció.
const STYLE_HISTORY_URL = 'data/historial-musical.json';
const CHANNELS_FALLBACK_URL = 'js/channels-ca.json';
const FEED_SNAPSHOT_KEY = 'iutube_feed_snapshot_v1';

const YouTubeAPI = {

    // Configuració de llengua
    language: 'ca',        // Català
    regionCode: 'AD',      // Andorra (per prioritzar contingut català)

    // Configuració de cache
    CACHE_DURATION: 2 * 60 * 60 * 1000, // 2 hores en mil·lisegons

    // Fallback de canals eliminat: feed.json i channels-ca.json ja cobreixen tots els canals.
    catalanChannels: [],

    // Canals carregats des del feed
    feedChannels: [],
    feedVideos: [],
    feedLoaded: false,
    historyPoolVideos: [],
    styleHistoryVideos: [],
    styleHistoryPromise: null,
    hiddenVideoIds: new Set(),
    channelArchiveCache: {},
    channelArchivePromises: {},
    legacyArchiveCache: null,

    // Paraules clau per detectar contingut català
    catalanKeywords: [
        "català", "catalana", "catalans", "catalanes",
        "catalunya", "catalonia",
        "barcelona", "girona", "tarragona", "lleida",
        "en català", "parlem", "benvinguts", "benvingudes",
        "avui", "d'avui", "som-hi", "endavant",
        "entrevista", "notícies", "informatiu"
    ],

    // Inicialitzar dades de canals catalans
    async init() {
        // Retira una credencial antiga sense llegir-la ni fer-la servir.
        try { localStorage.removeItem('youtube_api_key'); } catch (_) { /* Emmagatzematge no disponible. */ }

        // Carregar primer la taxonomia d'artistes perquè el feed ja neixi amb estils musicals.
        await window.SegueixMusicCategories?.init?.();

        // Intentar carregar el feed calent i després el petit pool històric de ràdio.
        await this.loadFeed();
        await this.loadHistoryPool();
        // L'historial dels estils es demana quan l'app ja és a punt, perquè el primer estil s'obri sense esperar.
        const idle = window.requestIdleCallback || (callback => setTimeout(callback, 1500));
        idle(() => this.ensureStyleHistory(), { timeout: 4000 });

        console.log(`iuTube: ${this.getAllChannels().length} canals configurats`);
        console.log(`iuTube: Cache configurat per ${this.CACHE_DURATION / 1000 / 60} minuts`);
    },

    // ==================== CARREGAR FEED ====================

    applyFeedPayload(feedData, response = null) {
        const feedGeneratedAt = feedData?.generatedAt
            || feedData?.meta?.generatedAt
            || response?.headers?.get?.('last-modified');
        this.handleFeedGeneratedAt(feedGeneratedAt);

        const feedItems = Array.isArray(feedData)
            ? feedData
            : (Array.isArray(feedData.items) ? feedData.items : (Array.isArray(feedData.videos) ? feedData.videos : []));

        const feedChannelsMap = feedData?.channels && typeof feedData.channels === 'object'
            ? feedData.channels
            : null;

        if (!Array.isArray(feedItems) || feedItems.length === 0) {
            return false;
        }

        // Categories de la base d'artistes i títol net (l'original queda a `originalTitle`)
        this.feedVideos = this.filterHiddenVideos(feedItems).map(video =>
            window.SegueixMusicCategories?.decorateVideo?.(video, this.artistNamesOf(feedChannelsMap?.[video.channelId])) || video
        );

        if (feedChannelsMap) {
            this.feedChannels = Object.entries(feedChannelsMap).map(([id, channel]) => this.withDisplayName({
                id,
                name: channel.name || '',
                avatar: channel.avatar || '',
                description: channel.description || '',
                handle: channel.handle || '',
                subscriberCount: channel.subscriberCount ?? null,
                // Noms de l'artista a la base d'artistes: la cerca hi troba «Alfred Garcia» pel canal «alfredgarcia»
                artists: Array.isArray(channel.artists) ? channel.artists : [],
                categories: this.normalizeCategories([
                    ...(channel.categories || []),
                    ...(window.SegueixMusicCategories?.categoriesForChannel?.(id) || [])
                ])
            }));
        } else {
            const channelsMap = {};
            this.feedVideos.forEach(video => {
                if (video.channelTitle && !channelsMap[video.channelTitle]) {
                    channelsMap[video.channelTitle] = {
                        id: video.channelId || null,
                        name: video.channelTitle,
                        avatar: '',
                        description: '',
                        handle: '',
                        subscriberCount: null,
                        categories: this.normalizeCategories(video.categories)
                    };
                }
            });
            this.feedChannels = Object.values(channelsMap);
        }

        this.feedLoaded = true;

        const lightweightSnapshot = {
            generatedAt: feedGeneratedAt || null,
            channels: this.feedChannels,
            // Guardem una mostra recent per recuperar la home en dispositius amb errors de xarxa/parsing
            videos: this.feedVideos.slice(0, 250)
        };
        try {
            localStorage.setItem(FEED_SNAPSHOT_KEY, JSON.stringify(lightweightSnapshot));
        } catch (error) {
            console.log("iuTube: No s'ha pogut guardar snapshot del feed:", error.message);
        }

        console.log(`iuTube: Carregats ${this.feedVideos.length} vídeos i ${this.feedChannels.length} canals des del feed`);
        return true;
    },

    // Nom a mostrar de l'artista (editat a revisio-artistes.html) en lloc del nom del canal de YouTube. El nom del canal
    // es conserva a `originalName` i a `artists`, perquè la cerca continuï trobant-lo.
    withDisplayName(channel) {
        const display = window.SegueixMusicCategories?.displayNameForChannel?.(channel?.id) || '';
        if (!display || channel.name === display) return channel;
        const original = channel.originalName || channel.name || '';
        return {
            ...channel,
            name: display,
            originalName: original,
            artists: [...new Set([...(Array.isArray(channel.artists) ? channel.artists : []), original].filter(Boolean))]
        };
    },

    // Noms de l'artista d'un canal del feed (nom del canal i noms de la base d'artistes).
    artistNamesOf(channel) {
        if (!channel) return [];
        return [channel.name, ...(Array.isArray(channel.artists) ? channel.artists : [])].filter(Boolean);
    },

    // Una sola identitat visual per artista, encara que tingui canal oficial, Topic o altres canals.
    // Internament conserva tots els channelIds.
    getArtistGroups(channels = null) {
        const source = Array.isArray(channels) ? channels : this.getAllChannels();
        const music = window.SegueixMusicCategories;
        const normalize = value => String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();

        const rank = channel => {
            const meta = music?.artistChannelMeta?.(channel?.id) || {};
            return (meta.primary ? 1000000 : 0)
                + (meta.type === 'official' ? 100000 : meta.type === 'topic' ? 0 : 10000)
                + (channel?.handle ? 1000 : 0)
                + Math.min(999, Math.log10(Math.max(1, Number(channel?.subscriberCount) || 1)) * 100);
        };

        const groups = new Map();
        for (const raw of source) {
            if (!raw?.id) continue;
            const channel = this.withDisplayName(raw);
            const id = String(channel.id);
            const fallbackName = channel.artists?.[0] || channel.name || channel.title || id;
            const key = music?.artistKeyForChannel?.(id) || 'n:' + normalize(fallbackName);
            const displayName =
                music?.artistDisplayNameForChannel?.(id)
                || channel.name
                || channel.title
                || fallbackName;
            const existing = groups.get(key);
            if (!existing) {
                groups.set(key, {
                    key,
                    channel,
                    rank: rank(channel),
                    name: displayName,
                    channelIds: [id],
                    categories: [...(channel.categories || [])],
                    artists: [...(channel.artists || [])],
                });
                continue;
            }
            if (!existing.channelIds.includes(id)) existing.channelIds.push(id);
            existing.categories = this.normalizeCategories([...(existing.categories || []), ...(channel.categories || [])]);
            existing.artists = [...new Set([...(existing.artists || []), ...(channel.artists || [])])];
            const currentRank = rank(channel);
            if (currentRank > existing.rank) {
                existing.channel = channel;
                existing.rank = currentRank;
            }
            const canonical = music?.artistDisplayNameForChannel?.(id);
            if (canonical) existing.name = canonical;
        }

        return [...groups.values()].map(group => ({
            ...group.channel,
            id: String(group.channel.id),
            name: group.name || group.channel.name || 'Artista',
            artistKey: group.key,
            channelIds: group.channelIds,
            categories: group.categories,
            artists: group.artists,
        }));
    },

    getArtistGroupForChannel(channelId) {
        const id = String(channelId || '');
        if (!id) return null;
        return this.getArtistGroups().find(group => (group.channelIds || [group.id]).some(item => String(item) === id)) || null;
    },

    restoreFeedSnapshot() {
        try {
            const raw = localStorage.getItem(FEED_SNAPSHOT_KEY);
            if (!raw) return false;
            const parsed = JSON.parse(raw);
            const channels = Array.isArray(parsed?.channels) ? parsed.channels : [];
            const videos = this.filterHiddenVideos(Array.isArray(parsed?.videos) ? parsed.videos : []);
            if (channels.length === 0 || videos.length === 0) return false;
            this.feedChannels = channels;
            // Un snapshot d'una versió anterior pot portar els títols sense netejar
            const names = new Map(channels.map(channel => [String(channel?.id), this.artistNamesOf(channel)]));
            this.feedVideos = videos.map(
                video => window.SegueixMusicCategories?.cleanVideoTitle?.(video, names.get(String(video?.channelId))) || video
            );
            this.feedLoaded = true;
            console.log(`iuTube: Feed recuperat des de snapshot local (${videos.length} vídeos)`);
            return true;
        } catch (error) {
            return false;
        }
    },

    async loadChannelsFallback() {
        if (Array.isArray(this.feedChannels) && this.feedChannels.length > 0) {
            return;
        }
        try {
            const channelsUrl = window.appDataUrl?.(CHANNELS_FALLBACK_URL) || CHANNELS_FALLBACK_URL;
            const response = await fetch(channelsUrl, { cache: 'default' });
            if (!response.ok) return;
            const payload = await response.json();
            const channels = Array.isArray(payload?.channels) ? payload.channels : [];
            if (channels.length === 0) return;
            this.feedChannels = channels.map((channel) => ({
                id: channel.id,
                name: channel.name || '',
                avatar: channel.avatar || '',
                description: channel.description || '',
                handle: channel.handle || '',
                subscriberCount: channel.subscriberCount ?? null,
                categories: this.normalizeCategories([
                    ...(Array.isArray(channel.categories) ? channel.categories : (channel.category ? [channel.category] : [])),
                    ...(window.SegueixMusicCategories?.categoriesForChannel?.(channel.id) || [])
                ])
            }));
            console.log(`iuTube: Carregats ${this.feedChannels.length} canals des de fallback local`);
        } catch (error) {
            console.log('iuTube: Error carregant fallback de canals:', error.message);
        }
    },

    // Carregar canals i vídeos des del feed
    async loadFeed() {
        await this.loadHiddenVideos();
        const restoredFromSnapshot = this.restoreFeedSnapshot();

        try {
            const feedUrl = window.appDataUrl?.(FEED_URL) || FEED_URL;
            const response = await fetch(feedUrl, { cache: 'no-store' });
            if (!response.ok) {
                console.log('iuTube: Feed no disponible, usant fallback local');
                if (!restoredFromSnapshot) {
                    await this.loadChannelsFallback();
                }
                return;
            }

            const feedData = await response.json();
            const applied = this.applyFeedPayload(feedData, response);
            if (!applied && !restoredFromSnapshot) {
                await this.loadChannelsFallback();
            }
        } catch (error) {
            console.log('iuTube: Error carregant el feed:', error.message);
            if (!restoredFromSnapshot) {
                await this.loadChannelsFallback();
            }
        }
    },

    async loadRestrictedVideoIds() {
        try {
            const url = window.appDataUrl?.(RESTRICTED_VIDEOS_URL) || RESTRICTED_VIDEOS_URL;
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) return [];
            const payload = await response.json();
            return payload?.videos && typeof payload.videos === 'object' ? Object.keys(payload.videos) : [];
        } catch (error) {
            return [];
        }
    },

    async loadHiddenVideos() {
        try {
            // Els dos fitxers es demanen alhora: l'arrencada no espera més
            const restrictedPromise = this.loadRestrictedVideoIds();
            const hiddenUrl = window.appDataUrl?.(HIDDEN_VIDEOS_URL) || HIDDEN_VIDEOS_URL;
            const response = await fetch(hiddenUrl, { cache: 'no-store' });
            if (!response.ok) {
                this.hiddenVideoIds = new Set(await restrictedPromise);
                return;
            }

            const payload = await response.json();
            const ids = Array.isArray(payload?.videoIds) ? payload.videoIds : [];
            const restricted = await restrictedPromise;
            this.hiddenVideoIds = new Set(
                [...ids, ...restricted]
                    .map((id) => String(id || '').trim())
                    .filter(Boolean)
            );
        } catch (error) {
            console.log('iuTube: No s\'ha pogut carregar la llista de vídeos ocults:', error.message);
            this.hiddenVideoIds = new Set();
        }
    },

    isVideoHidden(video) {
        const videoId = typeof video === 'string'
            ? video
            : (video?.id || video?.videoId || video?.id?.videoId || '');
        return this.hiddenVideoIds.has(String(videoId || ''));
    },

    // Fora els vídeos amagats i els Shorts: Segueix Música no en mostra cap (feed, historial, arxiu de la fitxa,
    // pool de ràdio, cerca). Totes les fonts de vídeos de l'app passen per aquí.
    filterHiddenVideos(videos) {
        if (!Array.isArray(videos) || videos.length === 0) {
            return Array.isArray(videos) ? videos : [];
        }
        return videos.filter((video) => video?.isShort !== true && !this.isVideoHidden(video));
    },

    hasKnownChannel(channelId) {
        const normalized = String(channelId || '');
        if (!normalized) return false;

        if (Array.isArray(this.feedChannels) && this.feedChannels.some(channel => String(channel?.id || '') === normalized)) {
            return true;
        }

        if (Array.isArray(this.feedVideos) && this.feedVideos.some(video => String(video?.channelId || '') === normalized)) {
            return true;
        }

        return false;
    },

    hydrateArchiveVideo(video, fallbackChannelId = '') {
        if (!video?.id) return video;
        const channelId = String(video.channelId || fallbackChannelId || '');
        const channel = this.feedChannels.find(item => String(item?.id || '') === channelId);
        const base = {
            ...video,
            channelId,
            channelTitle: video.channelTitle || channel?.name || '',
            thumbnail: video.thumbnail || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
            categories: this.normalizeCategories([
                ...(Array.isArray(video.categories) ? video.categories : []),
                ...(Array.isArray(channel?.categories) ? channel.categories : [])
            ])
        };
        return window.SegueixMusicCategories?.decorateVideo?.(base, channel?.artists || []) || base;
    },

    async loadHistoryPool() {
        try {
            const poolUrl = window.appDataUrl?.(HISTORY_POOL_URL) || HISTORY_POOL_URL;
            const response = await fetch(poolUrl, { cache: 'no-store' });
            if (!response.ok) {
                this.historyPoolVideos = [];
                return [];
            }
            const data = await response.json();
            const videos = this.filterHiddenVideos(Array.isArray(data?.videos) ? data.videos : []);
            this.historyPoolVideos = videos
                .map(video => this.hydrateArchiveVideo(video))
                .filter(video => video?.id && !video.isShort && ['song', 'live_song'].includes(video.contentType));
            console.log(`iuTube: ${this.historyPoolVideos.length} clàssics carregats al pool de ràdio`);
            return this.historyPoolVideos;
        } catch (error) {
            console.log('iuTube: Pool històric no disponible:', error.message);
            this.historyPoolVideos = [];
            return [];
        }
    },

    // Cançons de l'historial per als estils: es demanen una sola vegada (en segon pla en obrir l'app, o en obrir el
    // primer estil). Sense fitxer o sense xarxa, la vista d'estil continua amb les del feed.
    ensureStyleHistory() {
        if (this.styleHistoryPromise) return this.styleHistoryPromise;
        this.styleHistoryPromise = (async () => {
            try {
                const url = window.appDataUrl?.(STYLE_HISTORY_URL) || STYLE_HISTORY_URL;
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                const channels = new Map(this.feedChannels.map(channel => [String(channel?.id || ''), channel]));
                const feedIds = new Set((this.feedVideos || []).map(video => String(video?.id)));
                this.styleHistoryVideos = this.filterHiddenVideos(Array.isArray(data?.videos) ? data.videos : [])
                    .filter(video => video?.id && !feedIds.has(String(video.id)) && channels.has(String(video.channelId)))
                    .map(video => {
                        const channel = channels.get(String(video.channelId));
                        const base = {
                            ...video,
                            contentType: video.contentType || 'song',
                            channelTitle: channel?.name || '',
                            thumbnail: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
                            categories: this.normalizeCategories(Array.isArray(channel?.categories) ? channel.categories : []),
                        };
                        return window.SegueixMusicCategories?.decorateVideo?.(base, channel?.artists || []) || base;
                    });
                console.log(`iuTube: ${this.styleHistoryVideos.length} cançons de l'historial per als estils`);
            } catch (error) {
                console.log('iuTube: Historial dels estils no disponible:', error.message);
                this.styleHistoryVideos = [];
                this.styleHistoryPromise = null;
            }
            return this.styleHistoryVideos;
        })();
        return this.styleHistoryPromise;
    },

    getRadioPoolVideos() {
        const merged = new Map();
        [...(this.feedVideos || []), ...(this.historyPoolVideos || [])].forEach(video => {
            if (video?.id) merged.set(String(video.id), video);
        });
        return [...merged.values()];
    },

    async loadChannelArchiveVideos(channelId) {
        if (!channelId) return [];
        if (Object.prototype.hasOwnProperty.call(this.channelArchiveCache, channelId)) {
            return this.channelArchiveCache[channelId];
        }
        if (this.channelArchivePromises[channelId]) {
            return this.channelArchivePromises[channelId];
        }

        this.channelArchivePromises[channelId] = (async () => {
            try {
                const archiveUrl = `data/archive/channels/${encodeURIComponent(channelId)}.json?t=${Date.now()}`;
                const response = await fetch(window.appDataUrl?.(archiveUrl) || archiveUrl, { cache: 'no-store' });
                if (!response.ok) {
                    this.channelArchiveCache[channelId] = [];
                    return [];
                }
                const data = await response.json();
                const videos = this.filterHiddenVideos(Array.isArray(data?.videos) ? data.videos : [])
                    .map(video => this.hydrateArchiveVideo(video, channelId));
                this.channelArchiveCache[channelId] = videos;
                return videos;
            } catch (error) {
                console.log('iuTube: Error carregant arxiu per canal:', error.message);
                this.channelArchiveCache[channelId] = [];
                return [];
            } finally {
                delete this.channelArchivePromises[channelId];
            }
        })();

        return this.channelArchivePromises[channelId];
    },

    async loadLegacyArchiveVideosByChannel(channelId) {
        if (!channelId) return [];
        if (this.legacyArchiveCache === null) {
            this.legacyArchiveCache = {};
            try {
                const indexUrl = `data/archive/index.json?t=${Date.now()}`;
                const indexResponse = await fetch(window.appDataUrl?.(indexUrl) || indexUrl, { cache: 'no-store' });
                if (!indexResponse.ok) {
                    return [];
                }
                const indexData = await indexResponse.json();
                const buckets = Array.isArray(indexData?.buckets) ? indexData.buckets : [];
                for (const bucket of buckets) {
                    const fileName = typeof bucket === 'string' ? bucket : bucket?.file;
                    if (!fileName) continue;
                    const bucketUrl = `data/archive/${fileName}?t=${Date.now()}`;
                    const bucketRes = await fetch(window.appDataUrl?.(bucketUrl) || bucketUrl, { cache: 'no-store' });
                    if (!bucketRes.ok) continue;
                    const bucketData = await bucketRes.json();
                    const videos = Array.isArray(bucketData?.videos) ? bucketData.videos : [];
                    videos.forEach((video) => {
                        const key = String(video.channelId || video.sourceChannelId || '');
                        if (!key) return;
                        if (!Array.isArray(this.legacyArchiveCache[key])) {
                            this.legacyArchiveCache[key] = [];
                        }
                        if (!this.isVideoHidden(video)) {
                            this.legacyArchiveCache[key].push(video);
                        }
                    });
                }
            } catch (error) {
                console.log('iuTube: Històric antic no disponible:', error.message);
            }
        }

        return Array.isArray(this.legacyArchiveCache?.[channelId])
            ? this.legacyArchiveCache[channelId]
            : [];
    },

    async getChannelVideosWithHistory(channelId) {
        const normalized = String(channelId || '');
        if (!normalized) return [];

        const feedVideos = Array.isArray(this.feedVideos)
            ? this.feedVideos.filter((video) => String(video.channelId) === normalized)
            : [];

        if (feedVideos.length === 0 && !this.hasKnownChannel(normalized)) {
            return [];
        }

        const archiveVideos = await this.loadChannelArchiveVideos(normalized);
        const legacyVideos = await this.loadLegacyArchiveVideosByChannel(normalized);

        const mergedById = new Map();
        [...feedVideos, ...archiveVideos, ...legacyVideos].forEach((video) => {
            if (video?.id) {
                mergedById.set(String(video.id), video);
            }
        });

        return Array.from(mergedById.values())
            .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    },
    // Un sol catàleg compartit amb la fitxa: inclou directes publicats en canals convidats.
    async loadAlbumsCatalog() {
        if (!this.albumsCatalogPromise) {
            this.albumsCatalogPromise = (async () => {
                try {
                    const url = window.appDataUrl?.('data/albums-musica.json') || 'data/albums-musica.json';
                    const response = await fetch(url, { cache: 'no-store' });
                    return response.ok ? await response.json() : null;
                } catch (error) {
                    console.warn('Discos no disponibles:', error);
                    return null;
                }
            })();
        }
        return this.albumsCatalogPromise;
    },
    async getArtistVideosWithHistory(channelId) {
        const group = this.getArtistGroupForChannel(channelId);
        const channelIds = group?.channelIds?.length ? group.channelIds : [String(channelId || '')].filter(Boolean);
        const [lists, catalog] = await Promise.all([
            Promise.all(channelIds.map(id => this.getChannelVideosWithHistory(id))),
            this.loadAlbumsCatalog(),
        ]);
        const artist = catalog?.channels?.[String(channelId || '')];
        const albums = catalog?.artists?.[artist]?.albums || [];
        const externalIds = new Map();
        for (const album of albums) {
            const source = String(album.sourceChannelId || '');
            if (!source || channelIds.includes(source)) continue;
            if (!externalIds.has(source)) externalIds.set(source, new Set());
            (album.trackIds || []).forEach(id => externalIds.get(source).add(String(id)));
        }
        const guests = await Promise.all([...externalIds].map(async ([source, ids]) =>
            (await this.getChannelVideosWithHistory(source)).filter(video =>
                ids.has(String(video?.id)) && !video.isShort && !this.hiddenVideoIds.has(String(video.id))
            )
        ));
        const merged = new Map();
        [...lists, ...guests].flat().forEach(video => {
            if (video?.id) merged.set(String(video.id), video);
        });
        return [...merged.values()].sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
    },
    handleFeedGeneratedAt(feedGeneratedAt) {
        if (!feedGeneratedAt) {
            return;
        }
        const prev = localStorage.getItem('iutube_feed_generatedAt');
        if (prev !== feedGeneratedAt) {
            this.videoChannelIndexPromise = null;
            localStorage.setItem('iutube_feed_generatedAt', feedGeneratedAt);
            localStorage.removeItem('iutube_cache_catalan_videos');
            localStorage.removeItem('iutube_cache_feed_json');
        }
    },

    // Normalitzar categories (minúscules, sense espais extra)
    normalizeCategories(categories) {
        if (!categories) return [];
        // Noms antics («Urbana» → «Urban») abans de passar-los a minúscules
        const canonical = c => (window.SegueixMusicCategories?.canonicalCategory?.(c) ?? String(c)).trim().toLowerCase();
        if (typeof categories === 'string') {
            // Si és un string, separar per ;
            return categories.split(';').map(canonical).filter(c => c);
        }
        if (Array.isArray(categories)) {
            return categories.map(canonical).filter(c => c);
        }
        return [];
    },

    // ==================== CACHE ====================

    // Obtenir dades del cache
    getFromCache(key) {
        try {
            const cached = localStorage.getItem(`iutube_cache_${key}`);
            if (!cached) return null;

            const { data, timestamp } = JSON.parse(cached);
            const age = Date.now() - timestamp;

            if (age > this.CACHE_DURATION) {
                localStorage.removeItem(`iutube_cache_${key}`);
                return null;
            }

            console.log(`iuTube: Cache hit per "${key}" (${Math.round(age / 1000 / 60)} min)`);
            return data;
        } catch (e) {
            return null;
        }
    },

    // Guardar dades al cache
    saveToCache(key, data) {
        try {
            localStorage.setItem(`iutube_cache_${key}`, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
            console.log(`iuTube: Guardat al cache "${key}"`);
        } catch (e) {
            console.warn('iuTube: No s\'ha pogut guardar al cache:', e);
        }
    },

    // Netejar cache antic
    clearOldCache() {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('iutube_cache_'));
        keys.forEach(key => {
            try {
                const { timestamp } = JSON.parse(localStorage.getItem(key));
                if (Date.now() - timestamp > this.CACHE_DURATION) {
                    localStorage.removeItem(key);
                }
            } catch (e) {
                localStorage.removeItem(key);
            }
        });
    },

    // ==================== RESOLUCIÓ DE HANDLES ====================

    // Resoldre un handle (@username) o channel ID a un channel ID UC...
    async resolveChannelId(value) { const result = await this.getChannelDetails(value); return result.channel?.id || null; },

  // Vídeos per canal (configurable)
  VIDEOS_PER_CHANNEL: 50,

    // Vídeos inicials per canal (intercalats al principi)
    INITIAL_VIDEOS_PER_CHANNEL: 3,

    // Intercalar vídeos per evitar repeticions del mateix canal
    intercalateVideos(videos) {
        if (videos.length <= 1) return videos;

        const videosByChannel = {};
        videos.forEach(video => {
            const channelId = video.channelId;
            if (!videosByChannel[channelId]) {
                videosByChannel[channelId] = [];
            }
            videosByChannel[channelId].push(video);
        });

        const channelIds = Object.keys(videosByChannel);
        if (channelIds.length === 1) {
            return videos;
        }

        const result = [];

    // FASE 1: Intercalar els primers N vídeos de cada canal
    const initialVideos = {};
    const INITIAL_COUNT = Math.min(5, this.INITIAL_VIDEOS_PER_CHANNEL);
    channelIds.forEach(channelId => {
      initialVideos[channelId] = videosByChannel[channelId].splice(0, INITIAL_COUNT);
    });

        let hasMore = true;
        while (hasMore) {
            hasMore = false;
            const sortedChannels = channelIds
                .filter(id => initialVideos[id].length > 0)
                .sort((a, b) => {
                    const dateA = new Date(initialVideos[a][0].publishedAt);
                    const dateB = new Date(initialVideos[b][0].publishedAt);
                    return dateB - dateA;
                });

            for (const channelId of sortedChannels) {
                if (initialVideos[channelId].length > 0) {
                    result.push(initialVideos[channelId].shift());
                    hasMore = true;
                }
            }
        }

        // FASE 2: Afegir la resta de vídeos
        const remainingTotal = channelIds.reduce((sum, id) => sum + videosByChannel[id].length, 0);
        if (remainingTotal === 0) return result;

        const channelWeights = {};
        channelIds.forEach(channelId => {
            const count = videosByChannel[channelId].length;
            channelWeights[channelId] = count > 0 ? remainingTotal / count : 0;
        });

        let lastChannelId = result.length > 0 ? result[result.length - 1].channelId : null;

        while (channelIds.some(id => videosByChannel[id].length > 0)) {
            let bestChannel = null;
            let bestScore = -Infinity;

            for (const channelId of channelIds) {
                if (videosByChannel[channelId].length === 0) continue;

                if (channelId === lastChannelId && channelIds.filter(id => videosByChannel[id].length > 0).length > 1) {
                    continue;
                }

                const weight = channelWeights[channelId];
                const nextVideo = videosByChannel[channelId][0];
                const recency = new Date(nextVideo.publishedAt).getTime();
                const score = weight * 1000 + recency / 1000000000000;

                if (score > bestScore) {
                    bestScore = score;
                    bestChannel = channelId;
                }
            }

            if (!bestChannel) {
                bestChannel = channelIds.find(id => videosByChannel[id].length > 0);
            }

            if (bestChannel && videosByChannel[bestChannel].length > 0) {
                result.push(videosByChannel[bestChannel].shift());
                lastChannelId = bestChannel;
            } else {
                break;
            }
        }

        return result;
    },

    // Obtenir els canals del catàleg publicat
    getAllChannels() { return this.feedChannels.map(channel => this.withDisplayName(channel)); },

    // Obtenir vídeos per categoria (suporta múltiples categories per canal)
    getVideosByCategories(videos, categoryId) {
        const normalizedCategory = categoryId.toLowerCase();
        return videos.filter(video => {
            const music = window.SegueixMusicCategories;
            if (music?.isCategoryEligibleVideo && !music.isCategoryEligibleVideo(video)) return false;
            const categories = video.categories || [];
            return categories.some(cat => cat.toLowerCase() === normalizedCategory);
        });
    },

    // Comprovar si un text conté paraules clau catalanes
    containsCatalanKeywords(text) {
        if (!text) return false;
        const lowerText = text.toLowerCase();
        return this.catalanKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
    },

    // Filtrar vídeos per contingut català
    filterCatalanContent(videos) {
        const channelIds = this.getAllChannels().map(c => c.id);
        return videos.filter(video => {
            if (channelIds.includes(video.channelId)) return true;
            if (this.containsCatalanKeywords(video.title) ||
                this.containsCatalanKeywords(video.description)) return true;
            return false;
        });
    },

    // Obtenir data de fa X setmanes
    getDateWeeksAgo(weeks) {
        const date = new Date();
        date.setDate(date.getDate() - (weeks * 7));
        return date.toISOString();
    },

    // Cerca de compatibilitat: només cançons del feed publicat.
    async searchVideos(query, maxResults = 12) {
        const words = String(query || '').toLocaleLowerCase('ca').trim().split(/\s+/).filter(Boolean);
        const items = this.filterHiddenVideos(this.feedVideos).filter(video => words.every(word =>
            [video.title, video.channelTitle].join(' ').toLocaleLowerCase('ca').includes(word)));
        return { items: items.slice(0, maxResults), error: null, fromFeed: true };
    },

    // Obtenir vídeos del feed publicat
    async getPopularVideos(_maxResults = 12) {
    // PRIORITAT 1: Usar vídeos del feed si estan disponibles
    if (this.feedLoaded && this.feedVideos.length > 0) {
        console.log(`iuTube: Mostrant ${this.feedVideos.length} vídeos des de ${FEED_URL}`);

        // Transformar al format esperat
        // Es conserven TOTS els camps del feed (originalYear, topicTrack, originalTitle…): sense l'any original, una
        // reedició pujada fa poc passava per estrena en aquest camí i no a l'altre (loadVideos), i «Acabades de
        // sortir» canviava segons per on s'havia carregat la portada.
        const videos = this.feedVideos.map(v => ({
            ...v,
            id: v.id,
            title: v.title,
            thumbnail: v.thumbnail,
            channelId: v.channelId || null,
            channelTitle: v.channelTitle,
            publishedAt: v.publishedAt,
            duration: v.duration ? this.parseDuration(v.duration) : null,
            durationSeconds: v.durationSeconds || this.parseDurationSeconds(v.duration) || 0,
            isShort: v.isShort || false,
            viewCount: v.viewCount || 0,
            likeCount: v.likeCount || 0,
            commentCount: v.commentCount || 0,
            categories: v.categories || [],
            // Classificació del feed musical (song, live_song, review, other, album...)
            contentType: v.contentType || '',
            musicReason: v.musicReason || '',
            description: v.description || ''
        }));

    return { items: videos, error: null, fromFeed: true };
    }

    return { items: [], error: 'No s’ha pogut carregar el catàleg. Torna-ho a provar quan tinguis connexió.' };
},

    // Obtenir vídeos per categoria
    async getVideosByCategory(categoryId, maxResults = 12) {
        return { items: this.getVideosByCategories(this.filterHiddenVideos(this.feedVideos), categoryId).slice(0, maxResults), error: null, fromFeed: true };
    },

    // Obtenir detalls d'un vídeo
    async getVideoDetails(videoId) {
        const id = String(videoId || '');
        const absent = { video: null, error: 'Aquesta cançó no és al catàleg publicat.' };
        if (!/^[A-Za-z0-9_-]{11}$/.test(id) || this.isVideoHidden(id)) return absent;
        const publishedChannels = new Set(this.feedChannels.map(channel => channel.id));
        const find = () => this.filterHiddenVideos([
            ...this.feedVideos, ...this.styleHistoryVideos, ...this.historyPoolVideos,
            ...Object.values(this.channelArchiveCache).flat(),
        ]).find(video => video.id === id && publishedChannels.has(video.channelId));
        let video = find();
        if (!video) { await this.ensureStyleHistory(); video = find(); }
        if (!video) {
            // Índex generat amb les pàgines estàtiques; no consulta YouTube.
            try {
                if (!this.videoChannelIndexPromise) {
                    this.videoChannelIndexPromise = (async () => {
                    const file = 'data/video-channels.json';
                    const response = await fetch(window.appDataUrl?.(file) || file);
                    if (!response.ok) throw new Error('Índex no disponible');
                    return response.json();
                    })();
                }
                const channels = await this.videoChannelIndexPromise;
                const channelId = channels[id];
                if (typeof channelId === 'string' && publishedChannels.has(channelId)) {
                    await this.loadChannelArchiveVideos(channelId); video = find();
                }
            } catch (_) { this.videoChannelIndexPromise = null; }
        }
        return video ? { video: this.hydrateArchiveVideo(video), error: null, fromFeed: true } : absent;
    },

    // Obtenir informació del canal
    async getChannelDetails(channelId) {
        const value = String(channelId || '').toLocaleLowerCase('ca');
        const channel = this.feedChannels.find(item => String(item.id).toLocaleLowerCase('ca') === value ||
            (value.startsWith('@') && String(item.handle || '').toLocaleLowerCase('ca') === value));
        return channel ? { channel: { ...this.withDisplayName(channel), title: this.withDisplayName(channel).name }, error: null }
            : { channel: null, error: 'Aquest artista no és al catàleg publicat.' };
    },

    // Obtenir informació del canal per handle (@username)
    async getChannelByHandle(handle) { return this.getChannelDetails(String(handle || '').startsWith('@') ? handle : '@' + handle); },

    // Obtenir vídeos relacionats

    // Obtenir comentaris d'un vídeo

    // Obtenir categories de vídeos

    // Transformar resultats de cerca
    transformSearchResults(items) {
        if (!items) return [];
        return this.filterHiddenVideos(items.map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.maxres?.url || item.snippet.thumbnails.standard?.url || item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
            channelId: item.snippet.channelId,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
            categories: []
        })));
    },

    // Transformar resultats de vídeos amb estadístiques
    transformVideoResults(items) {
        if (!items) return [];
        return this.filterHiddenVideos(items.map(item => ({
            id: item.id,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.maxres?.url || item.snippet.thumbnails.standard?.url || item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
            channelId: item.snippet.channelId,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
            duration: this.parseDuration(item.contentDetails?.duration),
            isShort: this.isShortContent(item),
            viewCount: parseInt(item.statistics?.viewCount || 0),
            likeCount: parseInt(item.statistics?.likeCount || 0),
            commentCount: parseInt(item.statistics?.commentCount || 0),
            categories: []
        })));
    },

    // Transformar detalls d'un vídeo
    transformVideoDetails(item) {
        return {
            id: item.id,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.maxres?.url || item.snippet.thumbnails.standard?.url || item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
            channelId: item.snippet.channelId,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
            duration: this.parseDuration(item.contentDetails?.duration),
            isShort: this.isShortContent(item),
            viewCount: parseInt(item.statistics?.viewCount || 0),
            likeCount: parseInt(item.statistics?.likeCount || 0),
            commentCount: parseInt(item.statistics?.commentCount || 0),
            tags: item.snippet.tags || [],
            categories: []
        };
    },

    // Transformar detalls del canal
    transformChannelDetails(item) {
        return {
            id: item.id,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
            subscriberCount: parseInt(item.statistics?.subscriberCount || 0),
            videoCount: parseInt(item.statistics?.videoCount || 0),
            viewCount: parseInt(item.statistics?.viewCount || 0)
        };
    },

    // Transformar comentaris
    transformComments(items) {
        if (!items) return [];
        return items.map(item => {
            const comment = item.snippet.topLevelComment.snippet;
            return {
                id: item.id,
                authorName: comment.authorDisplayName,
                authorAvatar: comment.authorProfileImageUrl,
                text: comment.textDisplay,
                likeCount: comment.likeCount,
                publishedAt: comment.publishedAt
            };
        });
    },

    // Comprovar si un vídeo és Short (<= 180 segons)
    isShortVideo(isoDuration) {
        const seconds = this.parseDurationSeconds(isoDuration);
        if (seconds === null) return false;
        return seconds <= 180;
    },

    // Determinar si un vídeo és Short combinant durada i metadades
    isShortContent(item) {
        const seconds = this.parseDurationSeconds(item.contentDetails?.duration);
        if (seconds === null || seconds > 180) return false;

        const title = item.snippet?.title || '';
        const description = item.snippet?.description || '';
        const tags = Array.isArray(item.snippet?.tags) ? item.snippet.tags : [];
        const combinedText = `${title} ${description}`.toLowerCase();
        const tagSet = new Set(tags.map(tag => String(tag).toLowerCase()));

        const hasShortHashtag = /(^|\\s)#shorts?\\b/i.test(combinedText);
        const hasShortTag = tagSet.has('shorts') || tagSet.has('short');

        return hasShortHashtag || hasShortTag;
    },

    // Parsejar duració ISO 8601 a segons
    parseDurationSeconds(isoDuration) {
        if (!isoDuration) return null;

        const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return null;

        const hours = parseInt(match[1] || 0);
        const minutes = parseInt(match[2] || 0);
        const seconds = parseInt(match[3] || 0);

        return (hours * 3600) + (minutes * 60) + seconds;
    },

    // Parsejar duració ISO 8601 a format llegible
    parseDuration(isoDuration) {
        if (!isoDuration) return '0:00';

        const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return '0:00';

        const hours = parseInt(match[1] || 0);
        const minutes = parseInt(match[2] || 0);
        const seconds = parseInt(match[3] || 0);

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
};

