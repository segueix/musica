// Subscripció al canal oficial de YouTube de l'artista (2026-10-07).
// - L'enllaç «Subscriu-t'hi a YouTube» porta al canal OFICIAL (no al «Tema») amb `?sub_confirmation=1`: YouTube hi obre
//   de seguida el diàleg per confirmar la subscripció (al mòbil, a l'app de YouTube).
// - On hi ha canal oficial, s'hi carrega el botó oficial de subscripció de YouTube (platform.js, només amb YouTube
//   acceptat); si no arriba, es queda l'enllaç.
// - Quan l'usuari mostra interès (segueix l'artista a l'app o li fa m'agrada a una segona cançó), es proposa una sola
//   vegada per artista i com a màxim una al dia, amb una targeta gran i centrada (mai damunt del reproductor).
// Patró 2: implementació directa. La lògica pura (officialChannelId, shouldPrompt, …) es pot provar sense DOM.
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;

    const STORAGE_KEY = 'catube_yt_subscribe_prompts';
    const DAY_MS = 24 * 60 * 60 * 1000;
    // M'agrades de cançons d'un mateix artista a partir dels quals es proposa subscriure-s'hi
    const LIKES_TO_PROMPT = 2;

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
        if (official) return { url: subscribeUrl(official), subscribe: true, channelId: official };
        const id = String(channelId || '');
        return { url: id ? `https://www.youtube.com/channel/${encodeURIComponent(id)}` : '', subscribe: false };
    }

    // ---------- Botó oficial de subscripció de YouTube (widget de platform.js) ----------
    // https://developers.google.com/youtube/subscribe/reference — gapi.ytsubscribe.render(contenidor, paràmetres).
    // Només es carrega si l'usuari ha acceptat YouTube (com el reproductor) i, si no arriba o no es pinta, es queda
    // l'enllaç «Subscriu-t'hi a YouTube» (?sub_confirmation=1), que fa el mateix.
    const PLATFORM_SRC = 'https://apis.google.com/js/platform.js';
    const PLATFORM_TIMEOUT_MS = 6000;
    const WIDGET_TIMEOUT_MS = 4000;
    let platformPromise = null;

    function youtubeAllowed() {
        try {
            return typeof hasAcceptedYouTubeCookies === 'function' ? Boolean(hasAcceptedYouTubeCookies()) : false;
        } catch (error) {
            return false;
        }
    }

    function loadPlatform() {
        if (window.gapi?.ytsubscribe?.render) return Promise.resolve(window.gapi.ytsubscribe);
        if (platformPromise) return platformPromise;
        platformPromise = new Promise((resolve, reject) => {
            const doc = window.document;
            const started = Date.now();
            const script = doc.createElement('script');
            script.src = PLATFORM_SRC;
            script.async = true;
            script.onerror = () => reject(new Error('platform.js no carrega'));
            doc.head.appendChild(script);
            const wait = () => {
                if (window.gapi?.ytsubscribe?.render) return resolve(window.gapi.ytsubscribe);
                if (Date.now() - started > PLATFORM_TIMEOUT_MS) return reject(new Error('platform.js no respon'));
                window.setTimeout(wait, 100);
            };
            wait();
        }).catch(error => {
            platformPromise = null;
            throw error;
        });
        return platformPromise;
    }

    // Pinta el botó oficial dins `container`. Resol true si apareix (un iframe amb mida) i false si no.
    function renderWidget(container, channelId, { count = 'default' } = {}) {
        const id = String(channelId || '');
        if (!container || !/^UC[\w-]{10,}$/.test(id) || !youtubeAllowed()) return Promise.resolve(false);
        return loadPlatform()
            .then(
                api =>
                    new Promise(resolve => {
                        container.textContent = '';
                        api.render(container, { channelid: id, layout: 'default', count, theme: 'dark' });
                        // platform.js crea l'iframe amb 450 px d'ample i l'encongeix a la mida del botó quan carrega:
                        // s'espera aquest ajust (o 2,5 s des que apareix) perquè es pugui centrar i no empenyi la fila.
                        const started = Date.now();
                        let seenAt = 0;
                        const check = () => {
                            const frame = container.querySelector('iframe');
                            if (frame && frame.offsetHeight > 10 && frame.offsetWidth > 20) {
                                if (!seenAt) seenAt = Date.now();
                                if (frame.offsetWidth < 300 || Date.now() - seenAt > 2500) return resolve(true);
                            }
                            if (Date.now() - started > WIDGET_TIMEOUT_MS + 2500) return resolve(Boolean(seenAt));
                            window.setTimeout(check, 150);
                        };
                        check();
                    })
            )
            .catch(() => false);
    }

    // Fitxa de la cançó: on hi ha [data-yt-sub-widget], hi posa el botó oficial i amaga l'enllaç (si el botó arriba).
    function mountWidgets(root) {
        const scope = root || window.document;
        scope?.querySelectorAll?.('[data-yt-sub-widget]').forEach(slot => {
            if (slot.dataset.ytSubMounted === slot.dataset.ytSubWidget) return;
            slot.dataset.ytSubMounted = slot.dataset.ytSubWidget;
            const narrow = Boolean(window.matchMedia?.('(max-width: 480px)')?.matches);
            // platform.js posa estils en línia (450 px d'ample) al contenidor que rep: s'hi pinta una caixa interior
            const target = window.document.createElement('div');
            slot.textContent = '';
            slot.appendChild(target);
            renderWidget(target, slot.dataset.ytSubWidget, { count: narrow ? 'hidden' : 'default' }).then(ok => {
                if (!slot.isConnected) return;
                slot.classList.toggle('is-ready', ok);
                const link = slot.parentElement?.querySelector('[data-yt-subscribe]');
                if (link) link.hidden = ok;
            });
        });
    }

    // ---------- Proposta (targeta gran i centrada, mai damunt del reproductor) ----------
    const PROMPT_ID = 'ytSubPrompt';
    const PROMPT_MS = 20000;
    let promptTimer = null;

    function escapeText(value) {
        return String(value || '').replace(
            /[&<>"']/g,
            char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
        );
    }

    function closePrompt() {
        window.clearTimeout(promptTimer);
        const card = window.document.getElementById(PROMPT_ID);
        if (card) card.remove();
        window.removeEventListener('keydown', onPromptKey);
        window.removeEventListener('resize', placePrompt);
    }

    function onPromptKey(event) {
        if (event.key === 'Escape') closePrompt();
    }

    // Lloc de la targeta (pur): primer al centre de la pantalla; si hi tocaria el vídeo o els seus controls (YouTube no
    // permet res damunt del reproductor), al mig de l'espai de sota, de sobre, de la dreta o de l'esquerra d'aquests
    // obstacles; si no hi cap enlloc, a baix de tot. Mai sota la navegació inferior (`bottom`).
    function choosePromptPosition({ width: vw, bottom, card, obstacles = [] }) {
        const gap = 12;
        const w = Math.min(card.width, vw - 16);
        const h = card.height;
        const rects = obstacles.filter(r => r && r.right > r.left && r.bottom > r.top);
        const hits = (left, top) =>
            rects.some(r => left < r.right && left + w > r.left && top < r.bottom && top + h > r.top);
        const fits = (left, top) => left >= 8 && left + w <= vw - 8 && top >= 8 && top + h <= bottom - 8;
        const centerX = (vw - w) / 2;
        const middle = (from, to) => from + Math.max(0, (to - from - h) / 2);
        const candidates = [{ left: centerX, top: middle(0, bottom) }];
        if (rects.length) {
            const box = {
                top: Math.min(...rects.map(r => r.top)),
                bottom: Math.max(...rects.map(r => r.bottom)),
                left: Math.min(...rects.map(r => r.left)),
                right: Math.max(...rects.map(r => r.right)),
            };
            candidates.push(
                { left: centerX, top: middle(box.bottom + gap, bottom) },
                { left: centerX, top: middle(0, box.top - gap) - 0 },
                { left: box.right + gap + Math.max(0, (vw - box.right - gap - w) / 2), top: middle(0, bottom) },
                { left: Math.max(8, (box.left - gap - w) / 2), top: middle(0, bottom) }
            );
        }
        const found = candidates.find(c => fits(c.left, c.top) && !hits(c.left, c.top));
        const chosen = found || { left: centerX, top: Math.max(8, bottom - h - gap) };
        return { left: Math.round(chosen.left), top: Math.round(chosen.top), width: Math.round(w) };
    }

    function visibleRect(element) {
        if (!element || element.hidden || !element.getClientRects().length) return null;
        const r = element.getBoundingClientRect();
        if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.top >= window.innerHeight) return null;
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    }

    function placePrompt() {
        const doc = window.document;
        const card = doc.getElementById(PROMPT_ID);
        if (!card) return;
        const nav = doc.getElementById('ptBottomNav');
        const navRect = visibleRect(nav);
        const player = doc.getElementById('videoPlayer');
        const obstacles = [];
        if (player?.querySelector('iframe')) obstacles.push(visibleRect(player));
        obstacles.push(visibleRect(doc.getElementById('playerExternalControls')));
        const position = choosePromptPosition({
            width: window.innerWidth,
            bottom: navRect ? navRect.top : window.innerHeight,
            card: { width: card.offsetWidth, height: card.offsetHeight },
            obstacles,
        });
        card.style.left = `${position.left}px`;
        card.style.top = `${position.top}px`;
    }

    function propose(channelId, reason) {
        const artist = artistOf(channelId);
        if (!artist?.officialId) return false;
        const state = readState();
        if (!shouldPrompt(state, artist.key)) return false;
        const doc = window.document;
        if (!doc?.body) return false;
        writeState(markPrompted(state, artist.key));
        closePrompt();
        const name = artist.name || 'aquest artista';
        const title = reason === 'follow' ? `Ara segueixes ${name}` : `T'agrada ${name}?`;
        const text =
            reason === 'follow'
                ? "Vols subscriure-t'hi també a YouTube? Així veuràs les seves cançons noves i l'ajudes a créixer."
                : "Subscriu-t'hi a YouTube: no et perdràs res nou i l'ajudes a créixer.";
        const url = subscribeUrl(artist.officialId);
        const card = doc.createElement('section');
        card.id = PROMPT_ID;
        card.className = 'yt-sub-prompt';
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-modal', 'false');
        card.setAttribute('aria-labelledby', 'ytSubPromptTitle');
        card.innerHTML = `
            <button type="button" class="yt-sub-prompt__close" data-yt-sub-close aria-label="Tanca">×</button>
            <h2 class="yt-sub-prompt__title" id="ytSubPromptTitle">${escapeText(title)}</h2>
            <p class="yt-sub-prompt__text">${escapeText(text)}</p>
            <div class="yt-sub-prompt__actions">
                <div class="yt-sub-prompt__widget"><div data-yt-sub-prompt-widget></div></div>
                <a class="yt-sub-prompt__go" href="${escapeText(url)}" target="_blank" rel="noopener noreferrer" data-yt-sub-go>Subscriu-t'hi a YouTube</a>
                <button type="button" class="yt-sub-prompt__later" data-yt-sub-close>Ara no</button>
            </div>`;
        doc.body.appendChild(card);
        card.querySelectorAll('[data-yt-sub-close]').forEach(button => button.addEventListener('click', closePrompt));
        card.querySelector('[data-yt-sub-go]')?.addEventListener('click', () => window.setTimeout(closePrompt, 300));
        placePrompt();
        window.addEventListener('keydown', onPromptKey);
        window.addEventListener('resize', placePrompt);
        // Si el botó oficial de YouTube arriba, va a dalt i l'enllaç queda com a alternativa més discreta
        const slot = card.querySelector('[data-yt-sub-prompt-widget]');
        renderWidget(slot, artist.officialId, { count: 'hidden' }).then(ok => {
            if (!card.isConnected) return;
            card.classList.toggle('has-widget', ok);
            // Amb el botó oficial de YouTube, l'enllaç sobra (fa el mateix)
            const go = card.querySelector('[data-yt-sub-go]');
            if (go) go.hidden = ok;
            placePrompt();
        });
        promptTimer = window.setTimeout(closePrompt, PROMPT_MS);
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
        closePrompt,
        choosePromptPosition,
        renderWidget,
        mountWidgets,
    };
})(window);
