# Arquitectura actual de l'app (tancament fase 2)

## Ordre de càrrega de scripts
L'ordre de càrrega a `index.html` continua sent contractual i estable:

1. `js/config.js`
2. `js/youtube.js`
3. `js/data.js`
4. `Sortable` CDN
5. `js/core/segueix-app.js`
6. `js/core/state.js`
7. `js/core/dom-registry.js`
8. `js/utils/id-codecs.js`
9. `js/utils/config-feedback.js`
10. `js/features/navigation.js`
11. `js/features/library.js`
12. `js/features/feed.js`
13. `js/features/search.js`
14. `js/features/channel.js`
15. `js/features/player.js`
16. `js/features/shorts.js`
17. `js/features/support.js`
18. `js/features/shared-playlists.js`
19. `js/features/config-sync.js`
20. `js/app.js`

Dependències clau:
- `core/segueix-app.js` crea `window.SegueixApp`.
- `core/state.js` defineix estructura base de `SegueixApp.state`.
- `core/dom-registry.js` defineix `SegueixApp.dom.init()`.
- `features/*` publiquen APIs a `SegueixApp.features`.
- `app.js` actua com a façana/runtime principal: bootstrap, wiring i compatibilitat.

## Estat del runtime compartit

### `SegueixApp.state`
Estructura base actual (fase 2):
- `navigation`
- `feed`
- `channel`
- `playlists`
- `history`
- `search`
- `player`
- `shorts`

A `app.js` hi ha proxys bidireccionals per mantenir sincronització progressiva entre globals històrics i seccions de `SegueixApp.state`.

### `SegueixApp.dom`
`SegueixApp.dom.init()` registra refs de shell i pàgines principals (pages, grids, layout, library, history, modals) amb inicialització idempotent.

## Mòduls de feature (fase 2)

### Navegació i biblioteca
- `SegueixApp.features.navigation`
- `SegueixApp.features.library`

### Feed, cerca i canal
- `SegueixApp.features.feed`
- `SegueixApp.features.search`
- `SegueixApp.features.channel`

### Watch/player/shorts/suport
- `SegueixApp.features.player`
- `SegueixApp.features.shorts`
- `SegueixApp.features.support`

### Fluxos específics
- `SegueixApp.features.sharedPlaylists`
- `SegueixApp.features.configSync`

## Contracte actual `features` ↔ `app.js`
El patró dominant és:
1. Cada feature exposa `registerRuntime(...)` + API pública.
2. `app.js` conserva implementacions `*LegacyImpl` (lògica real estabilitzada).
3. `configureFeatureRuntimes()` injecta hooks legacy als mòduls.
4. Les funcions públiques d'`app.js` deleguen a `SegueixApp.features.*` per preservar compatibilitat de crides globals.

Aquest contracte evita canvis de comportament visibles mentre es redueix l'acoblament de `app.js`.

## Globals i wrappers que continuen vius
Encara existeixen per compatibilitat:
- Globals d'estat i refs DOM històriques dins `app.js`.
- Funcions globals cridades per HTML inline o fluxos antics (`showVideo`, `showVideoFromAPI`, `showHistory`, etc.).
- `SupportModule` com a wrapper de compatibilitat sobre la capa `features.support`.

## Límits actuals (honestos)
- `app.js` és més prim que a l'inici, però **encara no és només bootstrap**.
- Una part substancial de la lògica funcional segueix en `*LegacyImpl` dins `app.js` i no s'ha mogut físicament a mòduls.
- Això és deliberat per estabilitat de fase 2 i per no canviar UX/contractes.
