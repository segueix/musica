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

    function getLikedVideos() {
        const stored = localStorage.getItem(LIKED_VIDEOS_STORAGE_KEY);
        if (!stored) {
            return [];
        }
        try {
            const parsed = JSON.parse(stored);
            return Array.isArray(parsed) ? parsed : [];
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
        const next = normalizedIds.map(id => existing.find(video => String(video.id) === id) || normalizeLikedVideo({ id }))
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
            viewCount: video.viewCount || video.views || 0
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
                    new CustomEvent('segueix:music-prefs-changed', { detail: { type: 'like', key: normalizedId, on: nowLiked } })
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

        const handleLike = (event) => {
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

        likeBadge._likeHandler = (event) => {
            if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') {
                return;
            }
            if (event.type === 'keydown') {
                event.preventDefault();
            }

            const ids = getLikedVideoIds();
            const wasLiked = ids.includes(normalizedId);
            const nextIds = wasLiked
                ? ids.filter(id => id !== normalizedId)
                : [...ids, normalizedId];
            setLikedVideoIds(nextIds);

            const isNowLiked = !wasLiked;
            likeBadge.classList.toggle('liked', isNowLiked);
            likeBadge.classList.toggle('is-liked', isNowLiked);
            likeBadge.setAttribute('aria-pressed', isNowLiked ? 'true' : 'false');

        };

        likeBadge.addEventListener('click', likeBadge._likeHandler);
        likeBadge.addEventListener('keydown', likeBadge._likeHandler);
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
        HEART_TOGGLE_SVG,
        PLAYLIST_ICON_SVG
    };
})(window);
