(function (window) {
    const app = window.SegueixApp || (window.SegueixApp = {});
    app.features = app.features || {};

    // ==================== FUNCIONS INTERNES ====================

    function createShortCardImpl(video) {
        return `
            <button class="short-card" type="button" data-video-id="${video.id}" onclick="openShortModal('${video.id}')">
                <img class="short-thumb" src="${video.thumbnail}" alt="${escapeHtml(video.title)}" loading="lazy">
                <div class="short-meta">
                    <div class="short-title">${escapeHtml(video.title)}</div>
                    <div class="short-channel">${escapeHtml(video.channelTitle)}</div>
                </div>
            </button>
        `;
    }

    // Entrellaça shorts per minimitzar dos shorts consecutius del mateix canal.
    function interleaveShortsByChannel(shorts) {
        if (shorts.length <= 1) return shorts;

        const channelMap = new Map();
        for (const short of shorts) {
            const key = short.channelId || short.channelTitle || '_';
            if (!channelMap.has(key)) channelMap.set(key, []);
            channelMap.get(key).push(short);
        }

        const buckets = [...channelMap.values()];
        const result = [];
        let lastKey = null;

        while (buckets.length > 0) {
            buckets.sort((a, b) => b.length - a.length);
            let idx = 0;
            if (
                buckets.length > 1 &&
                (buckets[0][0].channelId || buckets[0][0].channelTitle || '_') === lastKey
            ) {
                idx = 1;
            }
            const short = buckets[idx].shift();
            result.push(short);
            lastKey = short.channelId || short.channelTitle || '_';
            if (buckets[idx].length === 0) buckets.splice(idx, 1);
        }

        return result;
    }

    // Shorts likes (localStorage)
    function getLikedShorts() {
        const stored = localStorage.getItem('catube_shorts_likes');
        if (!stored) return [];
        try {
            const parsed = JSON.parse(stored);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.warn('Invalid shorts likes stored value', error);
            return [];
        }
    }

    function isShortLiked(videoId) {
        return getLikedShorts().includes(String(videoId));
    }

    function toggleShortLike(video) {
        const videoId = typeof video === 'object' ? video.id : video;
        const likes = getLikedShorts();
        const id = String(videoId);
        const index = likes.indexOf(id);
        let isLiked = false;

        if (index === -1) {
            likes.push(id);
            isLiked = true;
        } else {
            likes.splice(index, 1);
        }

        const likesCopy = [...likes];
        (requestIdleCallback || setTimeout)(() => {
            localStorage.setItem('catube_shorts_likes', JSON.stringify(likesCopy));
        });
        return isLiked;
    }

    // Controla si l'iframe de shorts ja té un reproductor YouTube actiu.
    // Quan és true, podem usar loadVideoById en lloc de canviar iframe.src,
    // mantenint la sessió del player i evitant que iOS bloquegi l'autoplay.
    let shortsPlayerReady = false;
    let pendingShortIndex = null;

    function clearShortCookiePlaceholder() {
        const wrap = document.getElementById('shortPlayerWrap');
        wrap?.querySelector('.youtube-cookie-placeholder')?.remove();
    }

    // ==================== BOTÓ DE TANCAR (SINCRONITZAT AMB ELS CONTROLS DE YOUTUBE) ====================
    // El botó de tancar (X) segueix el mateix cicle de vida que el botó de pausa
    // natiu del reproductor de YouTube: apareix en obrir el modal i quan es toca la
    // pantalla, i s'amaga sol uns segons després que el vídeo s'estigui reproduint.
    // Mentre el Short està pausat es manté visible, com els controls del reproductor.
    // Navegar entre Shorts (lliscar, roda) NO el mostra: només el clic/toc.
    const SHORT_CONTROLS_HIDE_MS = 3000;
    // Marge més ampli en obrir el modal: el compte enrere bo es reprograma quan
    // arriba l'esdeveniment de reproducció; aquest només és la xarxa de seguretat
    // per si l'esdeveniment no arriba mai (evita que el botó parpellegi).
    const SHORT_CONTROLS_LOAD_HIDE_MS = 5000;
    let shortCloseHideTimer = null;

    function clearShortCloseTimer() {
        if (shortCloseHideTimer) {
            clearTimeout(shortCloseHideTimer);
            shortCloseHideTimer = null;
        }
    }

    function hideShortCloseBtn() {
        clearShortCloseTimer();
        document.getElementById('short-modal-close-btn')?.classList.add('is-hidden');
    }

    // Mostra el botó de tancar. Amb autoHide programa l'amagat automàtic (vídeo en
    // reproducció); sense autoHide el deixa visible indefinidament (vídeo pausat).
    function showShortCloseBtn({ autoHide = true, delay = SHORT_CONTROLS_HIDE_MS } = {}) {
        const btn = document.getElementById('short-modal-close-btn');
        if (!btn) return;
        clearShortCloseTimer();
        btn.classList.remove('is-hidden');
        if (!autoHide) return;
        shortCloseHideTimer = setTimeout(hideShortCloseBtn, delay);
    }

    // Reprograma el compte enrere sense treure el botó de l'amagatall: si ja està
    // amagat (p. ex. després de lliscar a un altre Short) s'hi queda fins al pròxim toc.
    function refreshShortCloseTimer() {
        const btn = document.getElementById('short-modal-close-btn');
        if (!btn || btn.classList.contains('is-hidden')) return;
        showShortCloseBtn();
    }

    // ==================== CONTINUÏTAT VISUAL (STRIP DE PANELLS) ====================
    // Estructura de 3 panells verticals (anterior / actual / següent) dins de
    // #shortPlayerWrap que permet arrossegar el contingut seguint el dit i revelar
    // gradualment el Short veí, com fan TikTok/YouTube Shorts. El panell central
    // conté l'iframe real; els panells veïns i el pòster del panell central mostren
    // la caràtula del Short mentre dura la transició, tapant el canvi de vídeo perquè
    // no es vegi cap salt.
    const SHORT_SLIDE_MS = 240;
    let cancelStripAnimation = null;
    let cancelShortGesture = null;
    let stripEls = null;
    let currentPosterTimer = null;
    // Bloqueja el destapat del pòster mentre el strip llisca (perquè el vídeo nou, que
    // ja s'inicia durant el gest, no aparegui al panell que marxa).
    let revealLocked = false;
    // El Short actual ja està reproduint-se (onStateChange info === 1)?
    let shortIsPlaying = false;

    function getStripEls() {
        if (stripEls && stripEls.strip && document.body.contains(stripEls.strip)) {
            return stripEls;
        }
        stripEls = {
            wrap: document.getElementById('shortPlayerWrap'),
            strip: document.getElementById('shortStrip'),
            posterPrev: document.getElementById('shortPosterPrev'),
            posterCurrent: document.getElementById('shortPosterCurrent'),
            posterNext: document.getElementById('shortPosterNext'),
        };
        return stripEls;
    }

    function shortPosterUrl(video) {
        if (!video) return '';
        const preferred = typeof getPreferredThumbnail === 'function' ? getPreferredThumbnail(video) : '';
        if (preferred) return preferred;
        if (video.id && typeof buildArchiveThumbnail === 'function') return buildArchiveThumbnail(video.id);
        return '';
    }

    function setPanelPoster(imgEl, video) {
        if (!imgEl) return;
        const src = shortPosterUrl(video);
        if (src) {
            if (imgEl.getAttribute('src') !== src) imgEl.src = src;
            imgEl.classList.remove('is-empty');
        } else {
            imgEl.removeAttribute('src');
            imgEl.classList.add('is-empty');
        }
    }

    // Actualitza els pòsters dels panells veïns (anterior i següent) segons l'índex.
    function updateNeighborPosters(index) {
        const els = getStripEls();
        if (!els.strip) return;
        setPanelPoster(els.posterPrev, currentShortsQueue[index - 1]);
        setPanelPoster(els.posterNext, currentShortsQueue[index + 1]);
    }

    // Tapa el panell central amb la caràtula del Short indicat (instantani, sense
    // transició) perquè el canvi de vídeo dins l'iframe no es vegi.
    function coverWithPoster(video) {
        const els = getStripEls();
        if (!els.posterCurrent) return;
        if (currentPosterTimer) {
            clearTimeout(currentPosterTimer);
            currentPosterTimer = null;
        }
        setPanelPoster(els.posterCurrent, video);
        els.posterCurrent.style.transition = 'none';
        els.posterCurrent.style.opacity = '1';
    }

    // Destapa el vídeo (fon el pòster central) quan el Short ja s'està reproduint.
    function revealCurrentVideo() {
        const els = getStripEls();
        if (!els.posterCurrent) return;
        if (currentPosterTimer) {
            clearTimeout(currentPosterTimer);
            currentPosterTimer = null;
        }
        els.posterCurrent.style.transition = 'opacity 0.22s ease';
        els.posterCurrent.style.opacity = '0';
    }

    // Recol·loca el strip al panell central sense animació.
    function resetStripPosition() {
        cancelStripAnimation?.();
        cancelShortGesture?.();
        const els = getStripEls();
        if (!els.strip) return;
        els.strip.classList.remove('is-sliding');
        els.strip.style.transform = 'translate3d(0, 0, 0)';
    }

    // Una sola animació viva: en tancar o reprendre un gest no queda cap callback
    // antic que recol·loqui el panell o canviï l'índex de la nova sessió.
    function animateStripTo(transform, duration, onFinish = () => {}) {
        const { strip } = getStripEls();
        if (!strip) return;
        cancelStripAnimation?.();
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const slideMs = reducedMotion ? 0 : duration;
        strip.style.setProperty('--short-slide-ms', `${slideMs}ms`);
        // Consolida l'últim frame del dit abans d'activar la transició. Aquesta lectura
        // es fa només en deixar anar, mai a cada touchmove.
        void strip.offsetWidth;
        const cancel = () => {
            clearTimeout(timer);
            strip.removeEventListener('transitionend', onEnd);
            strip.classList.remove('is-sliding');
            if (cancelStripAnimation === cancel) cancelStripAnimation = null;
        };
        const finish = () => {
            if (cancelStripAnimation !== cancel) return;
            cancel();
            onFinish();
        };
        const onEnd = (event) => {
            if (event.target === strip && event.propertyName === 'transform') finish();
        };
        cancelStripAnimation = cancel;
        strip.addEventListener('transitionend', onEnd);
        strip.classList.add('is-sliding');
        strip.style.transform = transform;
        const timer = setTimeout(finish, slideMs + 50);
    }

    // Carrega i reprodueix el vídeo del Short a l'iframe (NOMÉS reproducció, sense UI).
    // Retorna false si encara cal el consentiment de YouTube (deixa la petició en marxa).
    function primeShortPlayback(index) {
        if (index < 0 || index >= currentShortsQueue.length) return false;

        const short = currentShortsQueue[index];
        pendingShortIndex = index;
        if (typeof window.shouldLoadYouTubeEmbeds === 'function' && !window.shouldLoadYouTubeEmbeds()) {
            clearShortCookiePlaceholder();
            window.requestYouTubePlaybackConsent?.({
                title: 'Cal activar YouTube per veure aquest Short',
                text: "Ara ets al reproductor d'aquest Short dins de Segueix!. Si acceptes, YouTube podrà carregar el reproductor incrustat, comptar la reproducció i aquesta decisió quedarà activa a partir d'ara per a tots els vídeos i Shorts de la plataforma fins que la canviïs a la configuració.",
                onAccept: () => loadShort(index),
            });
            return false;
        }

        const iframe = document.getElementById('short-iframe');
        clearShortCookiePlaceholder();
        iframe.dataset.shortPaused = 'false';
        applyYouTubeIframePolicy(iframe);
        shortIsPlaying = false;

        // Si el reproductor ja està actiu, carreguem el vídeo via postMessage
        // (loadVideoById) per mantenir la sessió i que l'autoplay funcioni a iOS.
        if (shortsPlayerReady && iframe.contentWindow && iframe.src) {
            iframe.contentWindow.postMessage(
                JSON.stringify({ event: 'command', func: 'loadVideoById', args: [short.id] }),
                '*'
            );
        } else {
            // Primer short: creem l'iframe amb src complet
            const src = buildYoutubeEmbedUrl(short.id);
            iframe.src = src;
            shortsPlayerReady = false;

            const sendPlayCommand = () => {
                if (!iframe.contentWindow) return;
                iframe.contentWindow.postMessage(
                    JSON.stringify({ event: 'listening', id: 'short-iframe' }),
                    '*'
                );
                iframe.contentWindow.postMessage(
                    JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'] }),
                    '*'
                );
                iframe.contentWindow.postMessage(
                    JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
                    '*'
                );
                shortsPlayerReady = true;
            };
            if (iframe._shortPlayListener) {
                iframe.removeEventListener('load', iframe._shortPlayListener);
            }
            iframe._shortPlayListener = sendPlayCommand;
            iframe.addEventListener('load', sendPlayCommand);
            setTimeout(() => {
                if (!shortsPlayerReady) {
                    sendPlayCommand();
                }
            }, 2500);
        }

        return true;
    }

    // Actualitza tota la UI associada al Short (historial, títol, canal, accions i
    // pòsters veïns). No toca l'iframe.
    function applyShortMeta(index) {
        if (index < 0 || index >= currentShortsQueue.length) return;
        const short = currentShortsQueue[index];

        addToHistory({ ...short, isShort: true });

        const titleEl = document.getElementById('shortTitle');
        const channelEl = document.getElementById('shortChannel');
        if (titleEl) titleEl.textContent = short.title || '';
        if (channelEl) channelEl.textContent = short.channelTitle || '';

        const likeBtn = document.getElementById('shortLikeBtn');
        if (likeBtn) {
            if (isShortLiked(short.id)) {
                likeBtn.classList.add('liked');
            } else {
                likeBtn.classList.remove('liked');
            }

            likeBtn.onclick = (event) => {
                event.stopPropagation();
                event.preventDefault();
                const nowLiked = toggleShortLike(short.id);
                if (nowLiked) {
                    likeBtn.classList.add('liked');
                } else {
                    likeBtn.classList.remove('liked');
                }
            };
        }

        const shareBtn = document.getElementById('shortShareBtn');
        if (shareBtn) {
            shareBtn.onclick = (event) => {
                event.stopPropagation();
                event.preventDefault();
                shareVideo({
                    id: short.id,
                    title: short.title || 'Short',
                    channelTitle: short.channelTitle || ''
                });
            };
        }

        // Botó rodó del canal: mostra l'avatar i porta a la pàgina del canal dins de Segueix.
        const channelBtn = document.getElementById('shortChannelBtn');
        const channelAvatarImg = document.getElementById('shortChannelAvatar');
        if (channelBtn) {
            const channelId = short.channelId ? String(short.channelId) : '';
            if (channelId) {
                const channels = Array.isArray(YouTubeAPI?.getAllChannels?.())
                    ? YouTubeAPI.getAllChannels()
                    : [];
                const channelObj = channels.find((c) => String(c.id) === channelId) || null;
                if (channelAvatarImg) {
                    channelAvatarImg.src = resolveChannelAvatar(channelId, channelObj);
                    channelAvatarImg.alt = short.channelTitle || 'Canal';
                }
                channelBtn.setAttribute(
                    'aria-label',
                    short.channelTitle ? `Veure el canal ${short.channelTitle}` : 'Veure canal'
                );
                channelBtn.classList.remove('hidden');
                channelBtn.onclick = (event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    closeShortModalImpl();
                    openChannelProfile(channelId);
                };
            } else {
                channelBtn.classList.add('hidden');
                channelBtn.onclick = null;
            }
        }

        refreshIcons(document.getElementById('short-modal'));
        updateNeighborPosters(index);
    }

    // Programa destapar el vídeo (fon el pòster) com a xarxa de seguretat si no arriba
    // l'esdeveniment de reproducció (info === 1).
    function scheduleReveal(delay) {
        if (currentPosterTimer) clearTimeout(currentPosterTimer);
        currentPosterTimer = setTimeout(revealCurrentVideo, delay);
    }

    // Càrrega completa d'un Short (vídeo + UI): usada en obrir el modal i en la
    // navegació discreta (roda/teclat). La transició animada (commitSlide) crida
    // primeShortPlayback i applyShortMeta per separat per iniciar el vídeo abans.
    function loadShort(index) {
        if (index < 0 || index >= currentShortsQueue.length) return;
        coverWithPoster(currentShortsQueue[index]);
        if (!primeShortPlayback(index)) return;
        applyShortMeta(index);
        scheduleReveal(shortsPlayerReady ? 650 : 1400);
    }

    function handleScrollIntent(direction) {
        if (isNavigatingShort) return;
        if (direction === 1 || direction === -1) commitSlide(direction);
    }

    function triggerShortScrollHint() {
        const hint = document.getElementById('shortScrollHint');
        if (!hint) return;

        if (shortScrollHintTimer) {
            clearTimeout(shortScrollHintTimer);
            shortScrollHintTimer = null;
        }

        hint.classList.remove('blinking', 'fadeout');
        void hint.offsetWidth; // forçar reflow

        hint.classList.add('blinking');

        shortScrollHintTimer = setTimeout(() => {
            hint.classList.remove('blinking');
            hint.classList.add('fadeout');
            shortScrollHintTimer = setTimeout(() => {
                hint.classList.remove('fadeout');
                shortScrollHintTimer = null;
            }, 1000);
        }, 4000);
    }

    // Fon el pòster central quan el Short reporta que s'està reproduint (info === 1),
    // de manera que el vídeo es destapa just quan comença, no per temporitzador.
    let shortMessageBound = false;
    function bindShortPlaybackReveal() {
        if (shortMessageBound) return;
        shortMessageBound = true;
        window.addEventListener('message', (event) => {
            if (!event.origin || !/youtube(-nocookie)?\.com/.test(event.origin)) return;
            if (event.source !== document.getElementById('short-iframe')?.contentWindow) return;
            const modal = document.getElementById('short-modal');
            if (!modal || modal.classList.contains('hidden')) return;
            let data = event.data;
            if (typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                } catch (_error) {
                    return;
                }
            }
            if (data && data.event === 'onStateChange' && data.info === 1) {
                shortIsPlaying = true;
                // Si el botó de tancar és visible, compta els segons de l'amagat des de
                // l'inici real de la reproducció (desapareix amb el botó de pausa).
                refreshShortCloseTimer();
                // No destapem mentre el strip llisca: el pòster encara tapa el panell
                // que marxa. Un cop aterra (revealLocked = false) sí que es destapa.
                if (!revealLocked) revealCurrentVideo();
            }
        });
    }

    // Confirma la transició cap al Short veí: anima el strip fins al panell destí,
    // recol·loca el central darrere del pòster i carrega el nou vídeo.
    function commitSlide(direction, duration = SHORT_SLIDE_MS) {
        const els = getStripEls();
        const newIndex = currentShortIndex + direction;

        // Mode playlist: si el següent element no és un Short, replica el flux clàssic
        // (tanca el modal i continua la reproducció seqüencial al reproductor normal).
        if (isPlaylistMode && newIndex >= 0 && newIndex < currentShortsQueue.length) {
            const nextVideo = currentShortsQueue[newIndex];
            if (nextVideo && !nextVideo.isShort) {
                currentPlaylistIndex = newIndex;
                resetStripPosition();
                closeShortModalImpl();
                loadVideoInSequence();
                return;
            }
        }

        if (!(newIndex >= 0 && newIndex < currentShortsQueue.length)) {
            resetStripPosition();
            return;
        }

        const targetShort = currentShortsQueue[newIndex];

        // Sense strip (p. ex. HTML antic en memòria cau): navegació directa sense animació.
        if (!els.strip) {
            currentShortIndex = newIndex;
            if (isPlaylistMode) currentPlaylistIndex = newIndex;
            loadShort(currentShortIndex);
            return;
        }

        isNavigatingShort = true;
        revealLocked = true; // el pòster no s'ha de destapar mentre el strip llisca

        // Tapa el panell que marxa amb la caràtula del Short ACTUAL i inicia JA la
        // reproducció del nou Short (dins el context del gest, perquè l'autoplay a iOS
        // no es bloquegi i el vídeo vagi guanyant buffer). Així, quan el strip aterra,
        // el Short ja s'està reproduint en comptes de mostrar la caràtula estàtica.
        coverWithPoster(currentShortsQueue[currentShortIndex]);
        if (!primeShortPlayback(newIndex)) {
            // Consentiment pendent: actualitza l'índex perquè onAccept carregui coherent
            // i cancel·la l'animació (apareix el diàleg de consentiment).
            currentShortIndex = newIndex;
            if (isPlaylistMode) currentPlaylistIndex = newIndex;
            revealLocked = false;
            isNavigatingShort = false;
            resetStripPosition();
            return;
        }

        const finish = () => {
            // Tapa el panell central amb la caràtula del nou Short abans de recol·locar-lo,
            // de manera que el reajust al centre sigui imperceptible.
            coverWithPoster(targetShort);
            els.strip.classList.remove('is-sliding');
            els.strip.style.transform = 'translate3d(0, 0, 0)';

            currentShortIndex = newIndex;
            if (isPlaylistMode) currentPlaylistIndex = newIndex;
            // El vídeo ja s'ha iniciat al pas anterior; només cal actualitzar la UI.
            applyShortMeta(newIndex);

            revealLocked = false;
            // Si ja reprodueix, destapa de seguida; si encara no, el listener de
            // reproducció el destaparà (amb aquest timeout de recanvi).
            if (shortIsPlaying) revealCurrentVideo();
            else scheduleReveal(650);
            isNavigatingShort = false;
        };
        animateStripTo(`translate3d(0, ${direction < 0 ? '100%' : '-100%'}, 0)`, duration, finish);
    }

    function setupShortScroll() {
        const playerWrap = document.getElementById('shortPlayerWrap')
            || document.querySelector('.short-player-wrap');
        const gestureOverlay = document.getElementById('shortGestureOverlay');

        if (!playerWrap || !gestureOverlay || gestureOverlay.dataset.shortScrollBound === 'true') return;

        gestureOverlay.dataset.shortScrollBound = 'true';
        bindShortPlaybackReveal();

        let startY = 0;
        let startX = 0;
        let startTime = 0;
        let isDragging = false;
        let axisLocked = false;
        let isVerticalDrag = false;
        let gestureHeight = 1;
        let frameId = null;
        let pendingOffset = 0;
        let lastY = 0;
        let lastMoveAt = 0;
        let velocity = 0;
        let activeTouchId = null;
        // Timestamp de l'últim esdeveniment tàctil. Els navegadors mòbils (Android/iOS)
        // disparen esdeveniments de ratolí "emulats" (mousedown/mouseup) uns ~300ms
        // després d'un touchend no cancel·lat. Com que els listeners tàctils són passius
        // (no poden fer preventDefault), sense aquest guard un sol toc executava
        // toggleShortPlaybackImpl() dues vegades (touch + ratolí emulat): pausava i
        // reprenia el vídeo tot seguit, de manera que la pausa per toc semblava no
        // funcionar al mòbil. Ignorem els esdeveniments de ratolí just després d'un toc.
        let lastTouchTime = 0;
        const EMULATED_MOUSE_WINDOW_MS = 700;
        const AXIS_LOCK_PX = 8;
        const FLICK_MS = 320;
        const FLICK_DISTANCE = 40;
        const commitDistance = () => Math.max(60, gestureHeight * 0.16);

        const isEmulatedMouseEvent = (e) =>
            (e.type === 'mousedown' || e.type === 'mouseup') &&
            Date.now() - lastTouchTime < EMULATED_MOUSE_WINDOW_MS;

        const hasShortAt = (i) => i >= 0 && i < currentShortsQueue.length;

        // Aplica resistència (rubber-band) quan no hi ha Short veí en la direcció del gest.
        const withBoundaryResistance = (offset) => {
            if (offset < 0 && !hasShortAt(currentShortIndex + 1)) return offset * 0.28;
            if (offset > 0 && !hasShortAt(currentShortIndex - 1)) return offset * 0.28;
            return offset;
        };

        const setStripOffset = (offsetPx) => {
            const els = getStripEls();
            if (!els.strip) return;
            els.strip.style.transform = `translate3d(0, ${offsetPx}px, 0)`;
        };

        // Els mòbils poden enviar més touchmove que frames. Pinta només l'última
        // posició de cada frame i cancel·la'l abans d'iniciar l'animació d'aterratge.
        const flushOffset = () => {
            if (frameId !== null) window.cancelAnimationFrame(frameId);
            frameId = null;
            setStripOffset(pendingOffset);
        };
        const queueOffset = (offset) => {
            pendingOffset = withBoundaryResistance(Math.max(-gestureHeight, Math.min(gestureHeight, offset)));
            if (frameId !== null) return;
            frameId = window.requestAnimationFrame(() => {
                frameId = null;
                setStripOffset(pendingOffset);
            });
        };
        cancelShortGesture = () => {
            if (frameId !== null) window.cancelAnimationFrame(frameId);
            frameId = null;
            isDragging = false;
            activeTouchId = null;
        };

        const springBack = () => {
            const els = getStripEls();
            if (!els.strip) return;
            flushOffset();
            animateStripTo('translate3d(0, 0, 0)', 180);
        };

        const handleStart = (e) => {
            if (isEmulatedMouseEvent(e)) return;
            if (e.type === 'touchstart') lastTouchTime = Date.now();
            if (isNavigatingShort) return; // hi ha una transició en curs
            if (e.touches && e.touches.length !== 1) {
                cancelShortGesture();
                springBack();
                return;
            }
            // Una recuperació anterior no pot treure la classe de la nova animació.
            cancelStripAnimation?.();
            getStripEls().strip?.classList.remove('is-sliding');
            startY = e.touches ? e.touches[0].clientY : e.clientY;
            startX = e.touches ? e.touches[0].clientX : e.clientX;
            activeTouchId = e.touches ? e.touches[0].identifier : null;
            startTime = Date.now();
            gestureHeight = Math.max(1, playerWrap.clientHeight);
            pendingOffset = 0;
            lastY = startY;
            lastMoveAt = startTime;
            velocity = 0;
            isDragging = true;
            axisLocked = false;
            isVerticalDrag = false;
        };

        // El seguiment del dit només té sentit amb esdeveniments tàctils; a l'escriptori
        // la navegació es fa amb la roda (wheel) i el clic serveix per pausar.
        const handleMove = (e) => {
            if (!isDragging || !e.touches) return;
            if (e.touches.length !== 1) {
                cancelShortGesture();
                springBack();
                return;
            }
            const touch = Array.from(e.touches).find(item => item.identifier === activeTouchId);
            if (!touch) return;
            const y = touch.clientY;
            const x = touch.clientX;
            const now = Date.now();
            if (now > lastMoveAt) velocity = (y - lastY) / (now - lastMoveAt);
            lastY = y;
            lastMoveAt = now;
            const dy = y - startY;
            const dx = x - startX;
            if (!axisLocked) {
                if (Math.abs(dy) < AXIS_LOCK_PX && Math.abs(dx) < AXIS_LOCK_PX) return;
                axisLocked = true;
                isVerticalDrag = Math.abs(dy) >= Math.abs(dx);
            }
            if (!isVerticalDrag) return;
            queueOffset(dy);
        };

        const handleEnd = (e) => {
            if (e.type === 'touchend') lastTouchTime = Date.now();
            if (isEmulatedMouseEvent(e)) return;
            if (!isDragging) return;
            const touch = e.changedTouches
                ? Array.from(e.changedTouches).find(item => item.identifier === activeTouchId)
                : e;
            if (!touch) return;
            isDragging = false;

            const endY = touch.clientY;
            const endX = touch.clientX;
            const dy = endY - startY;
            const dx = endX - startX;
            const elapsed = Date.now() - startTime;
            const isTap = Math.abs(dy) < 10 && Math.abs(dx) < 10 && elapsed < 250;

            if (isTap && !axisLocked) {
                toggleShortPlaybackImpl();
                return;
            }
            if ((!isVerticalDrag && axisLocked) || Math.abs(dx) > Math.abs(dy)) {
                // Gest predominantment horitzontal: ignora'l i torna al centre.
                springBack();
                return;
            }
            if (!axisLocked) {
                // Sense seguiment del dit (ratolí a l'escriptori, o un toc molt ràpid
                // que no ha disparat touchmove): navegació discreta clàssica per llindar.
                if (dy < -50) {
                    commitSlide(1);
                } else if (dy > 50) {
                    commitSlide(-1);
                }
                return;
            }

            const distance = Math.abs(dy);
            const releaseVelocity = Date.now() - lastMoveAt <= 100 ? velocity : 0;
            const isFlick = (elapsed < FLICK_MS && distance > FLICK_DISTANCE)
                || (distance > 28 && Math.abs(releaseVelocity) > 0.45 && releaseVelocity * dy > 0);
            const shouldCommit = distance >= commitDistance() || isFlick;
            pendingOffset = withBoundaryResistance(Math.max(-gestureHeight, Math.min(gestureHeight, dy)));
            flushOffset();
            const remaining = Math.max(0, gestureHeight - Math.abs(pendingOffset));
            const slideMs = Math.max(120, Math.min(SHORT_SLIDE_MS, remaining / Math.max(2.5, Math.abs(releaseVelocity))));

            if (dy < 0 && shouldCommit && hasShortAt(currentShortIndex + 1)) {
                commitSlide(1, slideMs);
            } else if (dy > 0 && shouldCommit && hasShortAt(currentShortIndex - 1)) {
                commitSlide(-1, slideMs);
            } else {
                springBack();
            }
        };

        gestureOverlay.addEventListener('touchstart', handleStart, { passive: true });
        gestureOverlay.addEventListener('touchmove', handleMove, { passive: true });
        gestureOverlay.addEventListener('touchend', handleEnd, { passive: true });
        gestureOverlay.addEventListener('touchcancel', () => {
            if (isDragging) {
                cancelShortGesture();
                springBack();
            }
        }, { passive: true });
        gestureOverlay.addEventListener('mousedown', handleStart);
        gestureOverlay.addEventListener('mouseup', handleEnd);

        gestureOverlay.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (Math.abs(e.deltaY) < 1) return;
            const direction = e.deltaY > 0 ? 1 : -1;
            handleScrollIntent(direction);
        }, { passive: false });
    }

    // ==================== API PÚBLICA ====================

    function openShortModalImpl(videoId) {
        const modal = document.getElementById('short-modal');
        if (!modal) return;

        shortModalScrollY = window.scrollY || 0;
        lockBodyScroll();

        if (Array.isArray(forcedShortsQueue) && forcedShortsQueue.length > 0) {
            currentShortsQueue = [...forcedShortsQueue];
            const forcedIndex = currentShortsQueue.findIndex(v => String(v.id) === String(videoId));
            currentShortIndex = forcedIndex >= 0 ? forcedIndex : 0;
            forcedShortsQueue = null;
        } else if (isPlaylistMode && activePlaylistQueue.length > 0) {
            currentShortsQueue = activePlaylistQueue;
            currentShortIndex = currentPlaylistIndex;
        } else {
            let sourceVideos = currentFeedVideos;
            if (!sourceVideos || sourceVideos.length === 0) {
                sourceVideos = cachedAPIVideos;
            }

            let categoryFiltered = filterVideosByCategory(sourceVideos, currentFeedData);
            if (selectedCategory === 'Novetats' || selectedCategory === 'Tot') {
                categoryFiltered = categoryFiltered.filter(video => {
                    const channelCats = getChannelCustomCategories(video.channelId);
                    let feedCats = [];
                    if (currentFeedData?.channels) {
                        const ch = currentFeedData.channels.find(c => String(c.id) === String(video.channelId));
                        if (ch?.categories) feedCats = ch.categories;
                    } else if (cachedChannels[video.channelId]?.categories) {
                        feedCats = cachedChannels[video.channelId].categories;
                    }
                    return ![...channelCats, ...feedCats].some(c =>
                        ['mitjans', 'digitals', 'entitats'].includes(String(c).toLowerCase())
                    );
                });
            }

            currentShortsQueue = interleaveShortsByChannel(
                filterOutWatchedVideos(categoryFiltered.filter(v => v.isShort))
            );

            const currentVideoIdStr = String(videoId);
            if (!currentShortsQueue.find(v => String(v.id) === currentVideoIdStr)) {
                const video = categoryFiltered.find(v => String(v.id) === currentVideoIdStr)
                    || cachedAPIVideos.find(v => String(v.id) === currentVideoIdStr)
                    || { id: videoId, isShort: true, title: '', channelTitle: '' };
                currentShortsQueue.unshift(video);
            }

            if (currentShortsQueue.length === 0) {
                console.warn('No hi ha shorts disponibles');
                return;
            }

            currentShortIndex = currentShortsQueue.findIndex(v => String(v.id) === currentVideoIdStr);
            if (currentShortIndex === -1) currentShortIndex = 0;
        }

        const panel = modal.querySelector('.short-modal-panel');
        if (panel) {
            panel.classList.add('immersive');
        }

        loadShort(currentShortIndex);
        setupShortScroll();

        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');

        // En obrir el modal el botó de tancar es veu (com els controls de YouTube) i
        // s'amaga sol; a partir d'aquí només reapareix amb un clic/toc a la pantalla.
        showShortCloseBtn({ delay: SHORT_CONTROLS_LOAD_HIDE_MS });

        triggerShortScrollHint();

        refreshIcons(modal);
    }

    function openChannelShortModalImpl(videoId, channelId) {
        const normalizedChannelId = String(channelId || '');
        if (!normalizedChannelId) {
            openShortModalImpl(videoId);
            return;
        }

        const channelShorts = (Array.isArray(cachedAPIVideos) ? cachedAPIVideos : [])
            .filter(video => String(video.channelId || video.snippet?.channelId || '') === normalizedChannelId && video.isShort);
        const uniqueShortsMap = new Map();
        channelShorts.forEach((video) => {
            if (!video?.id) return;
            uniqueShortsMap.set(String(video.id), video);
        });

        const clickedId = String(videoId || '');
        if (clickedId && !uniqueShortsMap.has(clickedId)) {
            const fallbackVideo = (Array.isArray(cachedAPIVideos) ? cachedAPIVideos : []).find(v => String(v.id) === clickedId)
                || { id: videoId, isShort: true, channelId: normalizedChannelId, title: '', channelTitle: '' };
            uniqueShortsMap.set(clickedId, fallbackVideo);
        }

        forcedShortsQueue = Array.from(uniqueShortsMap.values())
            .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
        openShortModalImpl(videoId);
    }

    function openShortModalWithQueueImpl(videoId, queue) {
        if (Array.isArray(queue) && queue.length > 0) {
            const uniqueShortsMap = new Map();
            queue.forEach((video) => {
                if (!video?.id || !video.isShort) return;
                uniqueShortsMap.set(String(video.id), video);
            });

            const requestedId = String(videoId || '');
            if (requestedId && !uniqueShortsMap.has(requestedId)) {
                const fallbackVideo = (Array.isArray(cachedAPIVideos) ? cachedAPIVideos : []).find(v => String(v.id) === requestedId)
                    || { id: videoId, isShort: true, title: '', channelTitle: '' };
                uniqueShortsMap.set(requestedId, fallbackVideo);
            }

            forcedShortsQueue = Array.from(uniqueShortsMap.values())
                .sort((a, b) => new Date(b.publishedAt || b.snippet?.publishedAt || 0) - new Date(a.publishedAt || a.snippet?.publishedAt || 0));
        }

        openShortModalImpl(videoId);
    }

    function toggleShortPlaybackImpl() {
        const iframe = document.getElementById('short-iframe');
        if (!iframe || !iframe.contentWindow) return;
        const isPaused = iframe.dataset.shortPaused === 'true';
        const func = isPaused ? 'playVideo' : 'pauseVideo';
        iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func,
            args: []
        }), '*');
        iframe.dataset.shortPaused = isPaused ? 'false' : 'true';
        // En reprendre, el botó de tancar torna a amagar-se sol amb els controls;
        // en pausar es queda visible mentre duri la pausa.
        showShortCloseBtn({ autoHide: isPaused });
    }

    function closeShortModalImpl() {
        const modal = document.getElementById('short-modal');
        const iframe = document.getElementById('short-iframe');

        if (shortScrollHintTimer) {
            clearTimeout(shortScrollHintTimer);
            shortScrollHintTimer = null;
        }
        const hint = document.getElementById('shortScrollHint');
        if (hint) hint.classList.remove('blinking', 'fadeout');

        // Deixa el botó de tancar en estat visible per a la pròxima obertura.
        clearShortCloseTimer();
        document.getElementById('short-modal-close-btn')?.classList.remove('is-hidden');

        if (shortsPlayerReady && iframe.contentWindow) {
            // Si el reproductor està actiu, simplement el pausem.
            // NO esborrem el src ni posem shortsPlayerReady a false
            // per poder utilitzar loadVideoById a la següent obertura.
            iframe.contentWindow.postMessage(JSON.stringify({
                event: 'command',
                func: 'pauseVideo',
                args: []
            }), '*');
        } else {
            // Si no s'havia arribat a carregar, sí que netegem
            iframe.src = '';
            shortsPlayerReady = false;
        }
        clearShortCookiePlaceholder();
        resetStripPosition();
        if (currentPosterTimer) {
            clearTimeout(currentPosterTimer);
            currentPosterTimer = null;
        }
        revealLocked = false;
        shortIsPlaying = false;
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        unlockBodyScroll();

        currentShortIndex = 0;
        currentShortsQueue = [];
        isNavigatingShort = false;
        pendingShortIndex = null;
    }

    // ==================== REGISTRE ====================
    app.features.shorts = {
        openShortModal: openShortModalImpl,
        openShortModalWithQueue: openShortModalWithQueueImpl,
        openChannelShortModal: openChannelShortModalImpl,
        toggleShortPlayback: toggleShortPlaybackImpl,
        closeShortModal: closeShortModalImpl,
        createShortCard: createShortCardImpl,
        navigateShort: handleScrollIntent,
        resumePendingShort() {
            if (pendingShortIndex === null) return;
            const indexToResume = pendingShortIndex;
            pendingShortIndex = null;
            loadShort(indexToResume);
        },
        clearPendingShort() {
            pendingShortIndex = null;
            shortsPlayerReady = false;
            const iframe = document.getElementById('short-iframe');
            if (iframe) {
                iframe.src = '';
            }
            clearShortCookiePlaceholder();
        }
    };
})(window);
