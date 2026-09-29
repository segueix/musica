// Service Worker per PWA — dos caches amb cicles de vida separats:
//
//   · static-<hash>  Shell de codi (HTML, CSS, JS, manifest, icones). Versionat pel
//                    CONTINGUT real dels fitxers via scripts/actualitzar_versio_sw.js.
//                    Cache-first: resposta instantània, xarxa només quan hi ha versió
//                    nova de codi.
//   · data-v1        Dades de runtime (feed, índexs de cerca, arxiu, canals). MAI
//                    versionat. network-first per al feed/índexs (frescor + fallback
//                    offline); stale-while-revalidate per a la resta (es renova sol).
//
// Substitueix el sistema antic de "cache busting" que incrementava CACHE_NAME
// (mytube-vNNN) a CADA sincronització de dades, invalidant tot el cache de codi de
// tots els clients diverses vegades al dia encara que el codi no hagués canviat. Ara
// el cache de codi només canvia quan el codi canvia de debò, i les dades no invaliden
// mai el codi. L'activate elimina els caches antics (inclòs qualsevol mytube-vNNN),
// migrant els clients automàticament.

// === AUTO-GENERAT per scripts/actualitzar_versio_sw.js — NO EDITAR MANUALMENT ===
const CACHE_VERSION = '175747f24c3f';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './img/icon-192.png',
    './css/styles.css',
    './img/Xiuxiuajar_icona.png',
    './img/Telegram-icona.png',
    './js/config.js',
    './js/music-categories.js',
    './js/youtube.js',
    './js/data.js',
    './js/core/segueix-app.js',
    './js/core/state.js',
    './js/core/dom-registry.js',
    './js/utils/helpers.js',
    './js/utils/storage.js',
    './js/utils/id-codecs.js',
    './js/utils/share-codecs.js',
    './js/utils/backup-codecs.js',
    './js/utils/qr-share.js',
    './js/utils/config-feedback.js',
    './js/features/navigation.js',
    './js/features/library.js',
    './js/features/feed.js',
    './js/features/search.js',
    './js/features/channel.js',
    './js/features/player.js',
    './js/features/shorts.js',
    './js/features/support.js',
    './js/features/likes.js',
    './js/features/home-sections.js',
    './js/features/category-selector.js',
    './js/features/music-queue.js',
    './js/features/home-playlists.js',
    './js/features/shared-playlists.js',
    './js/features/config-sync.js',
    './js/features/analytics.js',
    './js/features/analytics-pdf.js',
    './js/features/analytics-admin.js',
    './js/app.js',
    './js/features/tv-learning.js',
    './js/features/smart-feed.js',
    './js/features/tv-live-queue.js',
    './js/features/tv-programming.js',
    './img/caratula.png',
    './js/features/segueix-tv.js',
    './js/features/context-tv.js',
    './js/features/tv-scroll-ui.js',
    './css/category-chips.css',
    './css/spacing-polish.css',
    './css/typography-polish.css',
];
// === FI BLOC AUTO-GENERAT ===

// La branca de preview necessita que el navegador detecti el SW nou encara que el
// hash autogenerat es normalitzi només en executar `npm run sw:version` abans del merge.
// Canviar aquest comentari força una nova instal·lació i refresca el mateix cache estàtic.
// Preview refresh: usuaris únics anònims d'analytics 2026-09-25.

const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DATA_CACHE = 'data-v1';

// Clau única del shell HTML per a totes les navegacions (amb query o sense).
const SHELL_URL = new URL('./index.html', self.location.href).toString();

// ==================== INSTALL ====================
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    // NOTA: NO cridem self.skipWaiting() aquí. Si el SW nou s'activés durant la
    // sessió, el `controllerchange` del client faria window.location.reload() enmig
    // de l'scroll de l'usuari (bug documentat a docs/PROBLEMES_I_SOLUCIONS.md,
    // 2026-04-14). El SW nou es queda en estat "waiting" fins que es tanquin totes
    // les pestanyes o el client enviï SKIP_WAITING explícitament.
});

// ==================== ACTIVATE ====================
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== STATIC_CACHE && name !== DATA_CACHE)
                    .map((name) => {
                        console.log('Eliminant cache antic:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// ==================== MESSAGE ====================
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ==================== FETCH ====================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (!request?.url || !request.url.startsWith('http')) {
        return;
    }
    // Només gestionem GET; la resta (POST a APIs, etc.) passa a la xarxa.
    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);

    // Recursos d'altres orígens (CDN, fonts, YouTube): els gestiona el navegador.
    if (url.origin !== self.location.origin) {
        return;
    }

    const path = url.pathname;

    // feed_updates.js: artefacte de build, mai el cachegem.
    if (path.includes('feed_updates')) {
        return;
    }

    const isNavigate = request.mode === 'navigate' || path === '/' || path.endsWith('/index.html');
    const isNetworkFirstData = path.endsWith('/data/feed.json')
        || path.endsWith('/data/hidden-videos.json')
        || path.includes('/data/search_index_');
    const isSwrData = path.includes('/data/') || path.endsWith('/js/channels-ca.json');
    const isStaticCode = path.endsWith('.js') || path.endsWith('.css');

    if (isNavigate) {
        // El shell HTML: fresc si hi ha xarxa, fallback al precache si no.
        event.respondWith(navigationNetworkFirst(request));
    } else if (isNetworkFirstData) {
        event.respondWith(networkFirst(request, DATA_CACHE));
    } else if (isSwrData) {
        event.respondWith(staleWhileRevalidate(request, DATA_CACHE, event));
    } else if (isStaticCode) {
        event.respondWith(cacheFirst(request, STATIC_CACHE));
    } else {
        // manifest.json, icones i altres estàtics locals precachejats.
        event.respondWith(cacheFirst(request, STATIC_CACHE));
    }
});

// ==================== ESTRATÈGIES ====================

// Navegacions (shell HTML): xarxa primer, i tot es guarda/es recupera sota la clau del
// shell. Els enllaços compartits porten query (?v=ID), i si es cachegessin per URL
// completa el cache creixeria amb una còpia de l'HTML per enllaç i, sobretot, el
// fallback offline no trobaria mai res (caches.match respecta la query) i l'enllaç
// acabaria en error de xarxa en comptes d'obrir l'app.
async function navigationNetworkFirst(request) {
    try {
        const fetchRequest = new Request(request, { cache: 'reload' });
        const response = await fetch(fetchRequest);
        if (response && response.status === 200 && response.type === 'basic') {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(SHELL_URL, response.clone());
        }
        return response;
    } catch (error) {
        const cached =
            (await caches.match(SHELL_URL)) || (await caches.match(request, { ignoreSearch: true }));
        return cached || Response.error();
    }
}

// Xarxa primer; si falla, serveix la còpia cachejada. Per a shell i dades fresques.
async function networkFirst(request, cacheName) {
    try {
        const fetchRequest = new Request(request, { cache: 'reload' });
        const response = await fetch(fetchRequest);
        if (response && response.status === 200 && response.type === 'basic') {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await caches.match(request);
        return cached || Response.error();
    }
}

// Cache primer; si no hi és, xarxa i la desa. Per a codi estàtic (resposta instantània).
async function cacheFirst(request, cacheName) {
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
        const cache = await caches.open(cacheName);
        cache.put(request, response.clone());
    }
    return response;
}

// Serveix la còpia cachejada a l'instant i la refresca en segon pla. Per a dades que
// poden estar lleugerament obsoletes (canals, suport, arxiu) i s'han de renovar soles.
async function staleWhileRevalidate(request, cacheName, event) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    const networkPromise = fetch(request)
        .then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
                cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => null);
    if (event) {
        event.waitUntil(networkPromise);
    }
    // Si tenim còpia cachejada, la servim a l'instant (i revalidem en segon pla).
    if (cached) {
        return cached;
    }
    // Sense còpia: esperem la xarxa i, si també falla, retornem un error net (mai
    // undefined, que respondWith interpretaria com un error de xarxa genèric).
    const network = await networkPromise;
    return network || Response.error();
}
