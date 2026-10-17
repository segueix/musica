// Una sola regla per al paquet publicat i la fitxa: 21 populars + novetats de 12 mesos, sense duplicats.
(function (root, factory) {
    const policy = factory();
    if (typeof module === 'object' && module.exports) module.exports = policy;
    else root.SegueixCatalogPolicy = policy;
})(typeof window === 'object' ? window : globalThis, function () {
    'use strict';
    const POPULAR_LIMIT = 21;
    const stamp = value => Date.parse(String(value || '')) || 0;
    const views = video => Math.max(0, Number(video?.viewCount ?? video?.views) || 0);
    const isLive = video => String(video?.contentType || '').toLowerCase().replace(/-/g, '_') === 'live_song';
    const isSong = video => video?.id && !video.isShort &&
        !(Number(video.durationSeconds) > 0 && Number(video.durationSeconds) < 60) &&
        (!video.contentType || ['song', 'live_song'].includes(String(video.contentType).replace(/-/g, '_')));

    function anniversary(time) {
        const date = new Date(time);
        const month = date.getUTCMonth();
        date.setUTCFullYear(date.getUTCFullYear() + 1);
        if (date.getUTCMonth() !== month) date.setUTCDate(0); // 29 de febrer → 28 de febrer.
        return date.getTime();
    }

    function releaseTime(video) {
        const time = stamp(video?.originalDate || video?.publishedAt || video?.uploadDate);
        if (!time) return 0;
        // Una pujada recent no converteix una gravació antiga en una novetat.
        const year = Number(video.originalYear);
        return year > 1800 && year < new Date(time).getUTCFullYear() ? 0 : time;
    }

    function isRecent(video, now = Date.now()) {
        const time = releaseTime(video);
        return !isLive(video) && time > 0 && time <= now && now < anniversary(time);
    }

    function selectArtist(videos, { now = Date.now() } = {}) {
        const seen = new Set();
        const ranked = (Array.isArray(videos) ? videos : []).filter(video => {
            if (!isSong(video) || seen.has(String(video.id))) return false;
            seen.add(String(video.id));
            return true;
        }).map((video, index) => ({ video, index }))
            .sort((a, b) => views(b.video) - views(a.video) || String(a.video.id).localeCompare(String(b.video.id)))
            .map(item => item.video);
        const popular = ranked.slice(0, POPULAR_LIMIT);
        const recent = ranked.slice(POPULAR_LIMIT).filter(video => isRecent(video, now))
            .sort((a, b) => releaseTime(b) - releaseTime(a) || views(b) - views(a));
        const all = [...popular, ...recent];
        return { popular, recent, best: popular[0] || null, rest: popular.slice(1), all, total: all.length };
    }

    return { POPULAR_LIMIT, selectArtist, isRecent, releaseTime, anniversary, isLive, isSong };
});
