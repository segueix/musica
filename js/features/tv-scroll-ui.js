(function (window) {
    'use strict';

    const document = window.document;
    if (!document || window.__segueixTVScrollUIInstalled) return;
    window.__segueixTVScrollUIInstalled = true;

    const desktopMq = window.matchMedia('(min-width: 1025px)');
    const mobileMq = window.matchMedia('(max-width: 768px)');
    const HEADER_HIDE_START = 72;
    const DIRECTION_DELTA = 7;

    let lastScrollY = 0;
    let rafPending = false;
    let playerObserver = null;

    function isTVPlayback() {
        return document.body?.classList.contains('segueix-tv-playback');
    }

    function getHeader() {
        return document.querySelector('.app-header');
    }

    function setDesktopHeaderHidden(hidden) {
        const header = getHeader();
        if (!header) return;

        if (!desktopMq.matches || !isTVPlayback()) {
            header.style.transform = '';
            header.style.opacity = '';
            header.style.pointerEvents = '';
            header.style.transition = '';
            header.style.willChange = '';
            return;
        }

        header.style.transition = 'transform 180ms ease, opacity 180ms ease';
        header.style.willChange = 'transform, opacity';
        header.style.transform = hidden ? 'translateY(calc(-100% - 8px))' : '';
        header.style.opacity = hidden ? '0' : '';
        header.style.pointerEvents = hidden ? 'none' : '';
    }

    function showDesktopHeader() {
        setDesktopHeaderHidden(false);
    }

    function syncMobileMiniPlayerControl() {
        const button = document.getElementById('miniPlayerToggle');
        if (!button) return;

        const shouldHide = isTVPlayback() && mobileMq.matches;
        if (shouldHide) {
            if (!button.dataset.tvOriginalDisplay) {
                button.dataset.tvOriginalDisplay = button.style.display || '__empty__';
            }
            button.style.display = 'none';
            button.setAttribute('aria-hidden', 'true');
            button.tabIndex = -1;
            return;
        }

        if (button.dataset.tvOriginalDisplay) {
            button.style.display = button.dataset.tvOriginalDisplay === '__empty__' ? '' : button.dataset.tvOriginalDisplay;
            delete button.dataset.tvOriginalDisplay;
        }
        button.removeAttribute('aria-hidden');
        button.removeAttribute('tabindex');
    }

    function keepMobilePlayerInline() {
        syncMobileMiniPlayerControl();
        if (!isTVPlayback() || !mobileMq.matches) return;

        const player = document.getElementById('videoPlayer');
        if (!player?.classList.contains('mini-player-active')) return;

        if (typeof window.setMiniPlayerState === 'function') {
            window.setMiniPlayerState(false, { trigger: 'tv-mobile-inline' });
        } else {
            player.classList.remove('mini-player-active');
            ['top', 'left', 'right', 'bottom', 'width', 'height'].forEach(property => {
                player.style[property] = '';
            });
        }

        window.requestAnimationFrame(() => {
            if (typeof window.updatePlayerPosition === 'function') {
                window.updatePlayerPosition();
            }
        });
    }

    function syncScrollUI() {
        rafPending = false;
        syncMobileMiniPlayerControl();

        if (!isTVPlayback()) {
            showDesktopHeader();
            lastScrollY = 0;
            return;
        }

        const y = Math.max(0, window.scrollY || 0);
        const delta = y - lastScrollY;

        if (mobileMq.matches) {
            showDesktopHeader();
            keepMobilePlayerInline();
            lastScrollY = y;
            return;
        }

        if (!desktopMq.matches) {
            showDesktopHeader();
            lastScrollY = y;
            return;
        }


        if (y <= HEADER_HIDE_START || delta <= -DIRECTION_DELTA) {
            setDesktopHeaderHidden(false);
        } else if (delta >= DIRECTION_DELTA) {
            setDesktopHeaderHidden(true);
        }

        lastScrollY = y;
    }

    function scheduleSync() {
        if (rafPending) return;
        rafPending = true;
        window.requestAnimationFrame(syncScrollUI);
    }

    function observePlayer() {
        const player = document.getElementById('videoPlayer');
        if (!player || playerObserver) return;
        playerObserver = new MutationObserver(() => {
            if (mobileMq.matches && isTVPlayback()) keepMobilePlayerInline();
        });
        playerObserver.observe(player, { attributes: true, attributeFilter: ['class'] });
    }

    window.addEventListener('scroll', scheduleSync, { passive: true });
    window.addEventListener('resize', scheduleSync, { passive: true });
    desktopMq.addEventListener?.('change', scheduleSync);
    mobileMq.addEventListener?.('change', scheduleSync);

    // Només ens interessa entrar/sortir del mode TV, no els milers de canvis
    // d’icones i targetes dins la portada. Un canvi aliè no programa cap frame.
    let wasTVPlayback = null;
    const bodyObserver = new MutationObserver(() => {
        const active = isTVPlayback();
        if (active === wasTVPlayback) return;
        wasTVPlayback = active;
        scheduleSync();
    });

    function init() {
        if (!document.body) return;
        bodyObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ['class'],
            // Sense subtree: les classes dels descendents no canvien el mode TV.
        });
        wasTVPlayback = isTVPlayback();
        observePlayer();
        scheduleSync();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})(window);

