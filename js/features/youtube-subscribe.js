// Subscripció al canal oficial de YouTube de l'artista (2026-10-07).
// - L'enllaç «Subscriu-t'hi a YouTube» porta al canal OFICIAL (no al «Tema») amb `?sub_confirmation=1`: YouTube hi obre
//   de seguida el diàleg per confirmar la subscripció (al mòbil, a l'app de YouTube).
// - Quan l'usuari mostra interès (segueix l'artista a l'app o li fa m'agrada a una segona cançó), es proposa una sola
//   vegada per artista i com a màxim una al dia, amb un avís breu (mai damunt del reproductor).
// Patró 2: implementació directa. La lògica pura (officialChannelId, shouldPrompt, …) es pot provar sense DOM.
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;

    const STORAGE_KEY = 'catube_yt_subscribe_prompts';
    const DAY_MS = 24 * 60 * 60 * 1000;
    // M'agrades de cançons d'un mateix artista a partir dels quals es proposa subscriure-s'hi
    const LIKES_TO_PROMPT = 2;
    const TOAST_MS = 9000;

    // ---------- Lògica pura ----------

    function subscribeUrl(channelId) {
        const id = String(channelId || '').trim();
        if (!/^UC[\w-]{10,}$/.test(id)) return '';
        return `https://www.youtube.com/channel/${encodeURIComponent(id)}?sub_confirmation=1`;
    }

    // De tots els canals d'un artista, el canal oficial: primer l'oficial marcat com a principal, després qualsevol
    // oficial i, si no n'hi ha, un canal que no sigui «Tema» (subscriure's a un «Tema» no té gaire sentit). '' si
    // només en té de «Tema».
    function pickOfficialChannel(channelIds, metaOf) {
        const ids = (Array.isArray(channelIds) ? channelIds : []).map(String).filter(Boolean);
        const meta = id => (typeof metaOf === 'function' ? metaOf(id) : null) || {};
        const official = ids.filter(id => meta(id).type === 'official');
        return official.find(id => meta(id).primary) || official[0] || ids.find(id => meta(id).type !== 'topic') || '';
    }

    function normalizeState(raw) {
        const state = raw && typeof raw === 'object' ? raw : {};
        return {
            prompted: state.prompted && typeof state.prompted === 'object' ? { ...state.prompted } : {},
            lastAt: Number(state.lastAt) || 0,
        };
    }

    // Una proposta per artista (per sempre) i com a màxim una al dia.
    function shouldPrompt(state, artistKey, now = Date.now()) {
        const key = String(artistKey || '');
        if (!key) return false;
        const current = normalizeState(state);
        if (current.prompted[key]) return false;
        return now - current.lastAt >= DAY_MS;
    }

    function markPrompted(state, artistKey, now = Date.now()) {
        const current = normalizeState(state);
        current.prompted[String(artistKey)] = now;
        current.lastAt = now;
        return current;
    }

    function countArtistLikes(likedVideos, channelIds) {
        const ids = new Set((channelIds || []).map(String));
        return (Array.isArray(likedVideos) ? likedVideos : []).filter(video => ids.has(String(video?.channelId || '')))
            .length;
    }

    // ---------- Dades de l'app ----------

    function readState() {
        try {
            return normalizeState(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}'));
        } catch (error) {
            return normalizeState(null);
        }
    }

    function writeState(state) {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            // Sense emmagatzematge (navegació privada): la proposta podria tornar a sortir, no passa res
        }
    }

    function metaOf(id) {
        return window.SegueixMusicCategories?.artistChannelMeta?.(id) || null;
    }

    function artistOf(channelId) {
        const id = String(channelId || '');
        if (!id) return null;
        // YouTubeAPI és un `const` global de youtube.js: no és una propietat de window
        const api = typeof YouTubeAPI !== 'undefined' ? YouTubeAPI : window.YouTubeAPI;
        const group = api?.getArtistGroupForChannel?.(id) || null;
        const channelIds = group?.channelIds?.length ? group.channelIds.map(String) : [id];
        return {
            key: group?.artistKey || id,
            name: group?.name || '',
            channelIds,
            officialId: pickOfficialChannel(channelIds, metaOf),
        };
    }

    function officialChannelId(channelId) {
        return artistOf(channelId)?.officialId || '';
    }

    // Enllaç per al botó del canal: subscripció al canal oficial si n'hi ha; si no, el canal tal com és.
    function channelLink(channelId) {
        const official = officialChannelId(channelId);
        if (official) return { url: subscribeUrl(official), subscribe: true };
        const id = String(channelId || '');
        return { url: id ? `https://www.youtube.com/channel/${encodeURIComponent(id)}` : '', subscribe: false };
    }

    function openSubscribe(url) {
        if (!url) return;
        try {
            window.open(url, '_blank', 'noopener');
        } catch (error) {
            window.location.href = url;
        }
    }

    function propose(channelId, reason) {
        const artist = artistOf(channelId);
        if (!artist?.officialId) return false;
        const state = readState();
        if (!shouldPrompt(state, artist.key)) return false;
        const toast = app.features.shellNav?.toast;
        if (typeof toast !== 'function') return false;
        writeState(markPrompted(state, artist.key));
        const name = artist.name || 'aquest artista';
        const message =
            reason === 'follow'
                ? `Ara segueixes ${name}. Vols subscriure-t'hi també a YouTube?`
                : `T'agrada ${name}? Subscriu-t'hi a YouTube i no et perdis res nou.`;
        toast(message, {
            duration: TOAST_MS,
            action: { label: "Subscriu-t'hi", onClick: () => openSubscribe(subscribeUrl(artist.officialId)) },
        });
        return true;
    }

    // ---------- Disparadors ----------

    let followedBefore = null;

    function followedIds() {
        try {
            return new Set((typeof getFollowedChannelIds === 'function' ? getFollowedChannelIds() : []).map(String));
        } catch (error) {
            return new Set();
        }
    }

    function onPrefsChanged(event) {
        const detail = event?.detail || {};
        if (detail.type === 'follow') {
            const now = followedIds();
            const added = followedBefore ? [...now].filter(id => !followedBefore.has(id)) : [];
            followedBefore = now;
            if (added.length === 1) propose(added[0], 'follow');
            return;
        }
        if (detail.type === 'like' && detail.on) {
            const liked = app.features.likes?.getLikedVideos?.() || [];
            const video = liked.find(item => String(item?.id) === String(detail.key));
            if (!video?.channelId) return;
            const artist = artistOf(video.channelId);
            if (artist && countArtistLikes(liked, artist.channelIds) >= LIKES_TO_PROMPT) {
                propose(video.channelId, 'like');
            }
        }
    }

    function init() {
        followedBefore = followedIds();
        window.addEventListener?.('segueix:music-prefs-changed', onPrefsChanged);
    }

    if (window.document?.readyState === 'loading') {
        window.document.addEventListener('DOMContentLoaded', init, { once: true });
    } else if (window.document) {
        init();
    }

    app.features.youtubeSubscribe = {
        STORAGE_KEY,
        LIKES_TO_PROMPT,
        subscribeUrl,
        pickOfficialChannel,
        shouldPrompt,
        markPrompted,
        countArtistLikes,
        officialChannelId,
        channelLink,
        propose,
    };
})(window);
