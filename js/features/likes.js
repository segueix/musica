(function (window) {
    const app = window.SegueixApp || (window.SegueixApp = {});
    app.features = app.features || {};

    // ==================== CONSTANTS ====================

    const LIKED_VIDEOS_STORAGE_KEY = 'catube_liked_videos';

    const HEART_TOGGLE_SVG = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" aria-hidden="true" focusable="false">
            <path d="M128 224s-96-54-96-118c0-36 28-58 56-58 24 0 40 18 40 18s16-18 40-18c28 0 56 22 56 58 0 64-96 118-96 118z"></path>
        </svg>
    `;

    const PLAYLIST_ICON_SVG = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-playlist" aria-hidden="true" focusable="false">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    `;

    // ==================== FUNCIONS INTERNES ====================

    // Les cançons desades abans de netejar els títols porten «Artista - Cançó (Videoclip Oficial)»: es neteja en llegir.
    const withCleanTitle = video => window.SegueixMusicCategories?.cleanVideoTitle?.(video) || video;

    function getLikedVideos() {
        const stored = localStorage.getItem(LIKED_VIDEOS_STORAGE_KEY);
        if (!stored) {
            return [];
        }
        try {
            const parsed = JSON.parse(stored);
            return Array.isArray(parsed) ? parsed.map(withCleanTitle) : [];
        } catch (error) {
            console.warn('No es pot llegir catube_liked_videos', error);
            return [];
        }
    }

    function setLikedVideos(videos) {
        localStorage.setItem(LIKED_VIDEOS_STORAGE_KEY, JSON.stringify(videos));
    }

    function getLikedVideoIds() {
        const stored = localStorage.getItem('user_liked_videos');
        const likedVideos = getLikedVideos();
        const storedIds = likedVideos.map(video => String(video.id));
        if (!stored) {
            return storedIds;
        }
        try {
            const parsed = JSON.parse(stored);
            const legacyIds = Array.isArray(parsed) ? parsed : [];
            return [...new Set([...legacyIds, ...storedIds])];
        } catch (error) {
            console.warn('No es pot llegir user_liked_videos', error);
            return storedIds;
        }
    }

    function setLikedVideoIds(ids) {
        const normalizedIds = [...new Set(ids.map(id => String(id)))];
        localStorage.setItem('user_liked_videos', JSON.stringify(normalizedIds));
        const existing = getLikedVideos();
        const next = normalizedIds
            .map(id => existing.find(video => String(video.id) === id) || normalizeLikedVideo({ id }))
            .filter(Boolean);
        setLikedVideos(next);
    }

    function isLikedImpl(videoId) {
        if (!videoId) {
            return false;
        }
        const normalizedId = String(videoId);
        return getLikedVideos().some(video => String(video.id) === normalizedId);
    }

    function normalizeLikedVideo(video) {
        if (!video) {
            return null;
        }
        return {
            id: video.id,
            title: video.title || video.snippet?.title || '',
            thumbnail: video.thumbnail || video.snippet?.thumbnails?.medium?.url || '',
            channelId: video.channelId || video.snippet?.channelId || '',
            channelTitle: video.channelTitle || video.channel?.name || video.snippet?.channelTitle || '',
            publishedAt: video.publishedAt || video.uploadDate || '',
            viewCount: video.viewCount || video.views || 0,
        };
    }

    function toggleLikeVideoImpl(video) {
        if (!video || video.id === undefined || video.id === null) {
            return false;
        }
        const likedVideos = getLikedVideos();
        const normalizedId = String(video.id);
        const existingIndex = likedVideos.findIndex(item => String(item.id) === normalizedId);
        let nowLiked = false;

        if (existingIndex !== -1) {
            likedVideos.splice(existingIndex, 1);
            nowLiked = false;
        } else {
            const normalizedVideo = normalizeLikedVideo(video);
            if (normalizedVideo) {
                likedVideos.unshift(normalizedVideo);
                nowLiked = true;
            }
        }

        // Diferir escriptura a localStorage fora del fil principal
        const likedCopy = [...likedVideos];
        (requestIdleCallback || setTimeout)(() => {
            setLikedVideos(likedCopy);
            setLikedVideoIds(likedCopy.map(item => String(item.id)));
            // El cor compta ja per a les decisions següents de la ràdio (music-queue / music-signals).
            try {
                window.dispatchEvent(
                    new CustomEvent('segueix:music-prefs-changed', {
                        detail: { type: 'like', key: normalizedId, on: nowLiked },
                    })
                );
            } catch (error) {
                // Entorn sense esdeveniments (proves)
            }
        });
        return nowLiked;
    }

    function updateLikeButtonStateImpl(button, liked) {
        if (!button) {
            return;
        }
        button.classList.toggle('is-liked', liked);
        button.setAttribute('aria-pressed', liked ? 'true' : 'false');
        const icon = button.querySelector('i');
        if (icon) {
            icon.classList.toggle('fas', liked);
            icon.classList.toggle('far', !liked);
        }
    }

    function bindLikeButtonImpl(container, video) {
        const likeButton = container.querySelector('#likeToggle');
        if (!likeButton || !video) {
            return;
        }
        if (likeButton.dataset.likeBound === 'true') {
            return;
        }
        likeButton.dataset.likeBound = 'true';
        const liked = isLikedImpl(video.id);
        updateLikeButtonStateImpl(likeButton, liked);

        const handleLike = event => {
            if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            const nowLiked = toggleLikeVideoImpl(video);
            updateLikeButtonStateImpl(likeButton, nowLiked);
        };

        likeButton.addEventListener('click', handleLike);
        likeButton.addEventListener('keydown', handleLike);
    }

    function setupLikeBadgeImpl(videoId) {
        const likeBadge = document.getElementById('likeToggle');
        if (!likeBadge) {
            return;
        }

        const normalizedId = String(videoId);

        likeBadge.setAttribute('role', 'button');
        likeBadge.dataset.videoId = normalizedId;

        const likedIds = getLikedVideoIds();
        const isLiked = likedIds.includes(normalizedId);
        likeBadge.classList.toggle('liked', isLiked);
        likeBadge.classList.toggle('is-liked', isLiked);
        likeBadge.setAttribute('aria-pressed', isLiked ? 'true' : 'false');

        if (likeBadge._likeHandler) {
            likeBadge.removeEventListener('click', likeBadge._likeHandler);
            likeBadge.removeEventListener('keydown', likeBadge._likeHandler);
        }

        likeBadge._likeHandler = event => {
            if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') {
                return;
            }
            if (event.type === 'keydown') {
                event.preventDefault();
            }

            const ids = getLikedVideoIds();
            const wasLiked = ids.includes(normalizedId);
            const nextIds = wasLiked ? ids.filter(id => id !== normalizedId) : [...ids, normalizedId];
            setLikedVideoIds(nextIds);

            const isNowLiked = !wasLiked;
            likeBadge.classList.toggle('liked', isNowLiked);
            likeBadge.classList.toggle('is-liked', isNowLiked);
            likeBadge.setAttribute('aria-pressed', isNowLiked ? 'true' : 'false');
            // El cor compta ja per a les decisions següents de la ràdio (i el cor de sobre el reproductor s'actualitza).
            try {
                window.dispatchEvent(
                    new CustomEvent('segueix:music-prefs-changed', {
                        detail: { type: 'like', key: normalizedId, on: isNowLiked },
                    })
                );
            } catch (error) {
                // Entorn sense esdeveniments (proves)
            }
        };

        likeBadge.addEventListener('click', likeBadge._likeHandler);
        likeBadge.addEventListener('keydown', likeBadge._likeHandler);
    }

    // ==================== COR SOBRE EL REPRODUCTOR ====================
    // Cor clicable a dalt a la dreta del reproductor: fa el mateix que el cor de sota (m'agrada) i compta per a
    // l'algorisme de la ràdio. Els dos cors es mantenen sincronitzats (el de sota es posa vermell).

    function findPlayingVideo(id) {
        const pools = [];
        try {
            if (typeof activePlaylistQueue !== 'undefined') pools.push(activePlaylistQueue);
            if (typeof currentFeedVideos !== 'undefined') pools.push(currentFeedVideos);
            if (typeof cachedAPIVideos !== 'undefined') pools.push(cachedAPIVideos);
        } catch (error) {
            // Globals d'app.js encara no disponibles
        }
        for (const pool of pools) {
            const found = (Array.isArray(pool) ? pool : []).find(video => String(video?.id) === id);
            if (found) return found;
        }
        try {
            if (typeof getHistoryVideoById === 'function') return getHistoryVideoById(id) || { id };
        } catch (error) {
            // Sense historial
        }
        return { id };
    }

    function paintPlayerHeart(button, liked) {
        button.classList.toggle('is-liked', liked);
        button.setAttribute('aria-pressed', liked ? 'true' : 'false');
        button.setAttribute('aria-label', liked ? 'Treu de les que t’agraden' : 'M’agrada');
        button.title = liked ? 'Treu de les que t’agraden' : 'M’agrada';
    }

    // Deixa el cor de sota el reproductor (#likeToggle) en vermell (o buit) segons l'estat.
    function syncUnderPlayerHeart(liked) {
        const under = document.getElementById('likeToggle');
        if (!under) return;
        under.classList.toggle('liked', liked);
        under.classList.toggle('is-liked', liked);
        under.setAttribute('aria-pressed', liked ? 'true' : 'false');
    }

    function initPlayerHeart() {
        const player = typeof document?.getElementById === 'function' ? document.getElementById('videoPlayer') : null;
        if (!player || typeof MutationObserver !== 'function' || player.dataset.playerHeartBound === 'true') return;
        player.dataset.playerHeartBound = 'true';

        const ensure = () => {
            const id = String(player.dataset.playingVideoId || '');
            let button = player.querySelector(':scope > .player-heart');
            if (!id || !player.querySelector('iframe')) {
                button?.remove();
                return;
            }
            if (!button) {
                button = document.createElement('button');
                button.type = 'button';
                button.className = 'player-heart';
                button.innerHTML = HEART_TOGGLE_SVG;
                button.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    const videoId = String(player.dataset.playingVideoId || '');
                    if (!videoId) return;
                    const nowLiked = toggleLikeVideoImpl(findPlayingVideo(videoId));
                    paintPlayerHeart(button, nowLiked);
                    syncUnderPlayerHeart(nowLiked);
                });
                player.appendChild(button);
            }
            const liked = isLikedImpl(id);
            paintPlayerHeart(button, liked);
            syncUnderPlayerHeart(liked);
        };

        new MutationObserver(ensure).observe(player, {
            childList: true,
            attributes: true,
            attributeFilter: ['data-playing-video-id'],
        });
        // Amb un sol vídeo (sense controls de cua) el cor surt en tocar/passar el ratolí i s'amaga als ~3 s,
        // com els controls de pausa/anterior/següent. Amb cua, el CSS l'acompanya amb els seus controls.
        let awakeTimer = 0;
        const wake = (sticky = false) => {
            player.classList.add('is-heart-awake');
            window.clearTimeout(awakeTimer);
            if (!sticky) awakeTimer = window.setTimeout(() => player.classList.remove('is-heart-awake'), 3000);
        };
        player.addEventListener('pointerdown', () => wake());
        player.addEventListener('pointerenter', event => event.pointerType === 'mouse' && wake(true));
        player.addEventListener('pointermove', event => event.pointerType === 'mouse' && wake(true));
        player.addEventListener('pointerleave', event => event.pointerType === 'mouse' && wake());

        // El cor de sota (o el d'una targeta) també actualitza el de sobre
        document.addEventListener('click', event => {
            if (event.target?.closest?.('#likeToggle, .like-action')) window.setTimeout(ensure, 60);
        });
        window.addEventListener('segueix:music-prefs-changed', event => {
            if (event?.detail?.type === 'like') ensure();
        });
        ensure();
    }

    if (typeof document !== 'undefined' && document.readyState) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initPlayerHeart, { once: true });
        } else initPlayerHeart();
    }

    // ==================== REGISTRE ====================
    app.features.likes = {
        getLikedVideoIds,
        setLikedVideoIds,
        getLikedVideos,
        setLikedVideos,
        isLiked: isLikedImpl,
        normalizeLikedVideo,
        toggleLikeVideo: toggleLikeVideoImpl,
        updateLikeButtonState: updateLikeButtonStateImpl,
        bindLikeButton: bindLikeButtonImpl,
        setupLikeBadge: setupLikeBadgeImpl,
        initPlayerHeart,
        HEART_TOGGLE_SVG,
        PLAYLIST_ICON_SVG,
    };
})(window);
