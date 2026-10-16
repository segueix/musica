// Pàgines HTML: reproducció només després d’un gest i recuperació de rutes antigues.
(function () {
    'use strict';
    const params = new URLSearchParams(window.location.search);
    const start = Number(params.get('t'));
    const startAt = Number.isInteger(start) && start > 0 && start <= 86400 ? start : 0;
    const appLink = document.querySelector('[data-app-video]');
    if (appLink && startAt) {
        const target = new URL(appLink.href);
        target.searchParams.set('t', String(startAt));
        appLink.href = target.href;
    }
    document.querySelector('[data-video-id]')?.addEventListener('click', event => {
        const button = event.currentTarget;
        const id = button.dataset.videoId;
        const container = document.querySelector('[data-static-player]');
        if (!container || !/^[A-Za-z0-9_-]{11}$/.test(id)) return;
        const frame = document.createElement('iframe');
        frame.title = document.querySelector('h1')?.textContent || 'Vídeo de YouTube';
        frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        frame.allowFullscreen = true;
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1${startAt ? `&start=${startAt}` : ''}`;
        container.replaceChildren(frame);
        button.hidden = true;
        frame.focus();
    });

    function continueTo(target) {
        const url = new URL(target, location.origin);
        if (url.origin !== location.origin) return;
        if (startAt) url.searchParams.set('t', String(startAt));
        url.hash = location.hash;
        location.replace(url.href);
    }
    const redirect = document.querySelector('[data-static-redirect]');
    if (redirect) continueTo(redirect.href);
    const recovery = document.querySelector('[data-static-recovery]');
    if (!recovery) return;
    const base = recovery.dataset.base;
    let route;
    try { route = decodeURIComponent(location.pathname.slice(base.length)).replace(/\/+$/, ''); } catch (_) { return; }
    if (!location.pathname.startsWith(base)) return;
    fetch(base + 'data/static-routes.json', { cache: 'no-cache' }).then(response => {
        if (!response.ok) throw new Error('No es poden consultar les rutes.');
        return response.json();
    }).then(routes => {
        let target = '';
        const video = /^video\/(?:.*-)?([A-Za-z0-9_-]{11})(?:\.html)?$/.exec(route);
        const artist = /^creador\/([^/]+)(?:\/index\.html)?$/.exec(route);
        if (video) target = routes.videos?.[video[1]] || '';
        else if (artist) target = routes.artists?.[artist[1]] || '';
        else target = routes.sections?.[route.replace(/\.html$/, '')] || '';
        if (target && !target.startsWith('/') && !target.includes('..')) continueTo(base + target);
    }).catch(() => { /* Es conserva el missatge 404 i l’enllaç per tornar a l’app. */ });
})();
