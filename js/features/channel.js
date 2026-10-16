(function (window) {
    const app = window.SegueixApp || (window.SegueixApp = {});
    app.features = app.features || {};

    const runtime = { hooks: {} };
    const creatorSeo = {
        slugByChannelId: new Map(),
        loadPromise: null,
        observer: null,
        scheduled: false,
    };

    const CREATOR_NAME_SELECTORS = [
        '.follow-name',
        '.channel-name',
        '.channel-name-large',
        '.channel-title',
        '.sidebar-channel-name',
        '.search-channel-name',
    ];

    function registerRuntime(hooks = {}) {
        runtime.hooks = hooks || {};
    }

    function toggleFollowChannel(channelId) {
        return runtime.hooks.toggleFollowChannelImpl?.(channelId);
    }

    async function openChannelProfile(channelId) {
        return runtime.hooks.openChannelProfileImpl?.(channelId);
    }

    function renderChannelVideos(query = '') {
        return runtime.hooks.renderChannelVideosImpl?.(query);
    }

    function hashChannelId(value) {
        let hash = 2166136261;
        for (const char of String(value || '')) {
            hash ^= char.charCodeAt(0);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36).padStart(7, '0').slice(0, 7);
    }

    function slugifyCreatorName(value) {
        return String(value || '')
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .replace(/-{2,}/g, '-')
            .slice(0, 72)
            .replace(/-+$/g, '');
    }

    function buildCreatorRecords(channels) {
        const uniqueById = new Map();
        for (const channel of Array.isArray(channels) ? channels : []) {
            const id = String(channel?.id || '').trim();
            if (!id || uniqueById.has(id)) continue;
            uniqueById.set(id, channel);
        }

        const prepared = [...uniqueById.entries()].map(([id, channel]) => {
            const name = String(channel?.name || '').trim() || 'Creador';
            const baseSlug = slugifyCreatorName(name) || `creador-${hashChannelId(id)}`;
            return { id, name, baseSlug };
        });

        const counts = new Map();
        for (const creator of prepared) {
            counts.set(creator.baseSlug, (counts.get(creator.baseSlug) || 0) + 1);
        }

        const used = new Set();
        return prepared.map((creator) => {
            let slug = creator.baseSlug;
            if ((counts.get(creator.baseSlug) || 0) > 1) {
                slug = `${creator.baseSlug}-${hashChannelId(creator.id)}`;
            }
            if (used.has(slug)) {
                slug = `${creator.baseSlug}-${hashChannelId(creator.id)}-${creator.id.slice(-4).toLowerCase()}`;
            }
            used.add(slug);
            return { id: creator.id, name: creator.name, slug };
        });
    }

    async function loadCreatorSlugMap() {
        if (creatorSeo.loadPromise) return creatorSeo.loadPromise;

        creatorSeo.loadPromise = fetch(window.appDataUrl?.('js/channels-ca.json') || '/js/channels-ca.json', {
            credentials: 'same-origin',
            cache: 'force-cache',
        })
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then((data) => {
                const records = buildCreatorRecords(data?.channels);
                creatorSeo.slugByChannelId = new Map(records.map((creator) => [creator.id, creator.slug]));
                return creatorSeo.slugByChannelId;
            })
            .catch(() => creatorSeo.slugByChannelId);

        return creatorSeo.loadPromise;
    }

    function creatorHref(channelId) {
        const normalizedId = String(channelId || '').trim();
        const base = app.utils?.appBasePath?.() || '/';
        if (!normalizedId) return `${base}creadors/`;
        const slug = creatorSeo.slugByChannelId.get(normalizedId);
        return `${base}creador/${encodeURIComponent(slug || normalizedId)}${window.SEGUEIX_STATIC_SITE ? '/' : ''}`;
    }

    function ensureSeoStyles() {
        if (document.getElementById('creatorSeoLinkStyles')) return;
        const style = document.createElement('style');
        style.id = 'creatorSeoLinkStyles';
        style.textContent = `
            .creator-seo-link { color: inherit; text-decoration: none; }
            .creator-seo-link:hover { text-decoration: underline; text-underline-offset: 0.15em; }
            .follow-name.creator-seo-link { display: block; }
            #channelProfileName > .creator-seo-link { color: inherit; text-decoration: none; }
        `;
        document.head.appendChild(style);
    }

    function replaceNameWithLink(element, channelId) {
        if (!element || !channelId) return null;
        const href = creatorHref(channelId);

        if (element.matches('a')) {
            element.href = href;
            element.classList.add('creator-seo-link', 'channel-link');
            element.dataset.seoChannelId = channelId;
            return element;
        }

        const link = document.createElement('a');
        for (const attr of element.attributes) {
            if (attr.name === 'id') continue;
            link.setAttribute(attr.name, attr.value);
        }
        link.classList.add('creator-seo-link', 'channel-link');
        link.href = href;
        link.dataset.seoChannelId = channelId;
        while (element.firstChild) link.appendChild(element.firstChild);
        element.replaceWith(link);
        return link;
    }

    function enhanceChannelCard(card) {
        if (!card?.querySelectorAll) return;
        const channelId = String(card.dataset?.channelId || card.getAttribute?.('data-channel-id') || '').trim();
        if (!channelId) return;

        for (const selector of CREATOR_NAME_SELECTORS) {
            card.querySelectorAll(selector).forEach((element) => replaceNameWithLink(element, channelId));
        }
    }

    function enhanceChannelProfileName() {
        const heading = document.getElementById('channelProfileName');
        if (!heading) return;

        const followButton = document.getElementById('channelProfileFollowBtn');
        const channelId = String(
            followButton?.dataset?.followChannel || app.state?.currentChannelId || app.state?.channel?.currentChannelId || ''
        ).trim();
        if (!channelId || !heading.textContent.trim()) return;

        const existingLink = heading.querySelector(':scope > a.creator-seo-link');
        if (existingLink) {
            existingLink.href = creatorHref(channelId);
            existingLink.dataset.seoChannelId = channelId;
            return;
        }

        const text = heading.textContent;
        heading.textContent = '';
        const link = document.createElement('a');
        link.className = 'creator-seo-link channel-link';
        link.href = creatorHref(channelId);
        link.dataset.seoChannelId = channelId;
        link.textContent = text;
        heading.appendChild(link);
    }

    function enhanceSeoLinks(root = document) {
        ensureSeoStyles();
        if (root?.matches?.('[data-channel-id]')) enhanceChannelCard(root);
        root?.querySelectorAll?.('[data-channel-id]').forEach(enhanceChannelCard);
        enhanceChannelProfileName();
    }

    function scheduleSeoEnhancement() {
        if (creatorSeo.scheduled) return;
        creatorSeo.scheduled = true;
        queueMicrotask(() => {
            creatorSeo.scheduled = false;
            enhanceSeoLinks(document);
        });
    }

    function startSeoEnhancer() {
        loadCreatorSlugMap().finally(() => {
            enhanceSeoLinks(document);
            if (creatorSeo.observer || !document.body) return;
            creatorSeo.observer = new MutationObserver(scheduleSeoEnhancement);
            creatorSeo.observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['data-channel-id', 'data-follow-channel'],
            });
        });
    }

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener(
            'click',
            (event) => {
                const link = event.target?.closest?.('a.creator-seo-link[data-seo-channel-id]');
                if (!link) return;
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

                const channelId = String(link.dataset.seoChannelId || '').trim();
                if (!channelId || typeof runtime.hooks.openChannelProfileImpl !== 'function') return;

                event.preventDefault();
                event.stopPropagation();
                openChannelProfile(channelId);
            },
            true
        );

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', startSeoEnhancer, { once: true });
        } else {
            startSeoEnhancer();
        }
    }

    app.features.channel = {
        registerRuntime,
        toggleFollowChannel,
        openChannelProfile,
        renderChannelVideos,
        slugifyCreatorName,
        buildCreatorRecords,
        creatorHref,
        enhanceSeoLinks,
    };
})(window);

