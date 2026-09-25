(function (window) {
    const app = window.SegueixApp || (window.SegueixApp = {});
    app.features = app.features || {};

    // ==================== ESTAT INTERN ====================
    const _supportData = { channels: null, loaded: false };

    const SUPPORT_ICONS = {
        patreon: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="14.5" cy="8.5" r="5.5"/><rect x="2" y="2" width="3" height="20"/></svg>',
        aixeta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 6v6l4 2"/></svg>',
        kofi: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
        buymeacoffee: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.216 6.415l-.132-.666c-.119-.598-.388-1.163-1.001-1.379-.197-.069-.42-.098-.57-.241-.152-.143-.196-.366-.231-.572-.065-.378-.125-.756-.192-1.133-.057-.325-.102-.69-.25-.987-.195-.4-.597-.634-.996-.788a5.723 5.723 0 00-.626-.194c-1-.263-2.05-.36-3.077-.416a25.834 25.834 0 00-3.7.062c-.915.083-1.88.184-2.75.5-.318.116-.646.256-.888.501-.297.302-.393.77-.177 1.146.154.267.415.456.692.58.36.162.737.284 1.123.366 1.075.238 2.189.331 3.287.37 1.218.05 2.437.01 3.65-.118.299-.033.598-.073.896-.12.298-.046.594-.104.884-.179.29-.075.672-.106.724-.467l.148-.952z"/><path d="M4 9h14l-1.9 11.5c-.1.6-.7 1.5-1.6 1.5H7.5c-.9 0-1.5-.9-1.6-1.5L4 9z"/><path d="M18.5 9H20c1.1 0 2 .9 2 2v1c0 1.1-.9 2-2 2h-1.8"/></svg>',
        paypal: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.076 21.337H2.47a.641.641 0 01-.633-.74L4.944 2.696a.781.781 0 01.771-.652h6.733c2.237 0 3.822.648 4.673 1.846.81 1.14.98 2.574.504 4.262-.58 2.064-1.628 3.559-3.118 4.445-1.429.849-3.279 1.28-5.498 1.28h-.893a.781.781 0 00-.77.652l-.876 5.508z"/></svg>',
        stripe: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/></svg>',
        tipeee: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
        bizum: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/></svg>',
        transferencia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20"/></svg>',
        youtube_membership: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 4-8 4z"/></svg>',
    };

    // ==================== FUNCIONS INTERNES ====================

    function getSupportMethods(channelId) {
        if (!_supportData.loaded || !_supportData.channels) return null;
        return _supportData.channels[channelId] || null;
    }

    function channelHasSupportImpl(channelId) {
        // isMitjansOrDigitalsChannel és una funció global definida a app.js
        if (typeof isMitjansOrDigitalsChannel === 'function' && isMitjansOrDigitalsChannel(channelId)) return false;
        const methods = getSupportMethods(channelId);
        return methods && methods.length > 0;
    }

    function getSupportIcon(type) {
        return SUPPORT_ICONS[type] || SUPPORT_ICONS.kofi;
    }

    function getSupportMethodDisplayUrl(method) {
        if (method.url) {
            try {
                const u = new URL(method.url);
                return u.hostname.replace('www.', '') + u.pathname.replace(/\/$/, '');
            } catch (_) {
                return method.url;
            }
        }
        if (method.value && method.type === 'bizum') {
            return method.value.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
        }
        if (method.value && method.type === 'transferencia') {
            return method.value.substring(0, 8) + '...' + method.value.substring(method.value.length - 4);
        }
        return method.value || '';
    }

    function renderSupportMethodItem(method) {
        const icon = getSupportIcon(method.type);
        const displayUrl = getSupportMethodDisplayUrl(method);
        const hasLink = !!method.url;

        const tag = hasLink ? 'a' : 'div';
        const linkAttrs = hasLink ? ' href="' + escapeHtml(method.url) + '" target="_blank" rel="noopener noreferrer"' : '';

        let actionHtml = '';
        if (hasLink) {
            actionHtml = '<span class="support-method-action go">Obre</span>';
        } else if (method.value) {
            actionHtml = '<button class="support-method-action copy" type="button" data-copy-value="' + escapeHtml(method.value) + '">Copiar</button>';
        }

        return '<' + tag + ' class="support-method-item"' + linkAttrs + '>' +
            '<div class="support-method-icon ' + method.type + '">' + icon + '</div>' +
            '<div class="support-method-info">' +
                '<div class="support-method-label">' + escapeHtml(method.label) + '</div>' +
                '<div class="support-method-detail">' + escapeHtml(displayUrl) + '</div>' +
            '</div>' +
            actionHtml +
        '</' + tag + '>';
    }

    function bindSupportButtonsInternal(container) {
        if (!container) return;
        container.querySelectorAll('.js-support-btn').forEach(function(btn) {
            if (btn.dataset.supportBound === 'true') return;
            btn.dataset.supportBound = 'true';
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                const chId = btn.dataset.supportChannel || '';
                const chName = btn.dataset.supportName || '';
                openModalImpl(chId, chName);
            });
        });
    }

    function closeSupportModalImpl(fromPopstate) {
        const overlay = document.getElementById('supportModal');
        if (!overlay) return;
        const wasActive = overlay.classList.contains('active');
        overlay.classList.remove('active');
        if (wasActive && !fromPopstate && history.state && history.state.modal === 'support') {
            suppressNextPopstateNavigation = true;
            history.back();
        }
    }

    // ==================== API PÚBLICA ====================

    async function loadImpl() {
        try {
            const supportUrl = 'data/support.json?t=' + Date.now();
            const response = await fetch(window.appDataUrl?.(supportUrl) || supportUrl, { cache: 'no-store' });
            if (!response.ok) return;
            const json = await response.json();
            _supportData.channels = json.channels || {};
            _supportData.loaded = true;
            console.log('Suport: ' + Object.keys(_supportData.channels).length + ' canals amb mètodes de suport carregats');
        } catch (e) {
            console.log('Suport: No s\'ha pogut carregar support.json');
        }
    }

    async function openModalImpl(channelId, channelName) {
        const overlay = document.getElementById('supportModal');
        const titleEl = document.getElementById('supportModalChannelName');
        const bodyEl = document.getElementById('supportModalBody');
        if (!overlay) return;

        if (titleEl) {
            titleEl.textContent = channelName ? 'Dona suport a ' + channelName : 'Dona suport!';
        }

        if (bodyEl) {
            if (!_supportData.loaded) {
                await loadImpl();
            }
            const methods = getSupportMethods(channelId);
            if (methods && methods.length > 0) {
                bodyEl.innerHTML = '<div class="support-methods-list">' +
                    methods.map(function(m) { return renderSupportMethodItem(m); }).join('') +
                '</div>';
                bodyEl.querySelectorAll('[data-copy-value]').forEach(function(btn) {
                    btn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        const value = btn.dataset.copyValue;
                        navigator.clipboard.writeText(value).then(function() {
                            btn.textContent = 'Copiat!';
                            btn.classList.add('copied');
                            setTimeout(function() {
                                btn.textContent = 'Copiar';
                                btn.classList.remove('copied');
                            }, 2000);
                        }).catch(function() {});
                    });
                });
            } else {
                bodyEl.innerHTML = '<p style="text-align:center;color:var(--color-text-secondary);padding:16px 0;">Encara no tenim informació de suport per aquest canal.</p>';
            }
        }

        const wasActive = overlay.classList.contains('active');
        overlay.classList.add('active');

        if (!wasActive) {
            history.pushState({ ...(history.state || {}), modal: 'support' }, '', window.location.href);
        }
        requestAnimationFrame(function() { refreshIcons(overlay); });
    }

    function renderChannelButtonImpl(channelId, channelName) {
        const wrap = document.getElementById('channelSupportBtn');
        if (!wrap) return;

        if (!channelHasSupportImpl(channelId)) {
            wrap.classList.add('hidden');
            wrap.innerHTML = '';
            return;
        }

        wrap.classList.remove('hidden');
        wrap.innerHTML =
            '<button class="channel-support-btn js-support-btn" type="button" data-support-channel="' + channelId + '" data-support-name="' + escapeHtml(channelName) + '">' +
                '<i data-lucide="heart"></i> Dona suport' +
            '</button>';
        refreshIcons(wrap);
        bindSupportButtonsInternal(wrap);
    }

    function getSidebarButtonHtmlImpl(channelId, channelName) {
        if (!channelHasSupportImpl(channelId)) return '';
        return '<button class="sidebar-support-btn js-support-btn" type="button" data-support-channel="' + channelId + '" data-support-name="' + escapeHtml(channelName) + '">' +
            '<i data-lucide="heart"></i> Dona suport' +
        '</button>';
    }

    function bindSidebarSupportButtonsImpl(container) {
        bindSupportButtonsInternal(container);
    }

    function initModalImpl() {
        const overlay = document.getElementById('supportModal');

        if (overlay) {
            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) { closeSupportModalImpl(); return; }
                if (e.target.closest('.modal-close')) { closeSupportModalImpl(); return; }
            });
        }

        document.addEventListener('click', function(e) {
            const btn = e.target.closest('.js-support-btn');
            if (!btn) return;
            e.stopPropagation();
            e.preventDefault();
            const chId = btn.dataset.supportChannel || '';
            const chName = btn.dataset.supportName || '';
            openModalImpl(chId, chName);
        });
    }

    // ==================== REGISTRE ====================
    app.features.support = {
        load: loadImpl,
        openModal: openModalImpl,
        renderChannelButton: renderChannelButtonImpl,
        getSidebarButtonHtml: getSidebarButtonHtmlImpl,
        bindSidebarSupportButtons: bindSidebarSupportButtonsImpl,
        initModal: initModalImpl,
        hasSupport: channelHasSupportImpl,
        closeSupportModal: closeSupportModalImpl,
        bindSupportButtons: bindSupportButtonsInternal,
        getSupportMethods: getSupportMethods
    };
})(window);
