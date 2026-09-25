# Pla de refactorització conservadora de `js/app.js`

## Objectiu d'aquest document
Posar ordre a `js/app.js` sense canviar comportament visible, mantenint:
- mateixa UX i HTML renderitzat,
- mateixes claus de `localStorage`,
- mateixos noms de funcions públiques que la resta del codi ja utilitza,
- sense migrar encara a ES modules.

## 1) Mapa de responsabilitats actuals
`js/app.js` concentra gairebé tota la capa d'aplicació. Per blocs funcionals:

1. **Bootstrap i estat global**
   - Inicialització (`initElements`, `initEventListeners`, splash, install prompt).
   - Globals de navegació, pàgines, estat de player, estat de feeds i cerca.

2. **Preferències UI i personalització**
   - Layout home/watch (`GRID_LAYOUT_STORAGE_KEY`, `WATCH_GRID_LAYOUT_STORAGE_KEY`).
   - Colors de fons/botons i mida de font (`BACKGROUND_STORAGE_KEY`, `BUTTON_COLOR_STORAGE_KEY`, `FONT_SIZE_STORAGE_KEY`).

3. **Feed i categories**
   - Càrrega de categories, chips, ordenació de feed, hero i filtratge per categoria.
   - Cache de feed i cache de cerques per categories personalitzades.

4. **Cerca (local + arxiu)**
   - Dropdown de cerca, debounce, navegació amb teclat i resultats combinats.
   - Índex d'arxiu (`searchArchiveIndexCache`) i map de vídeo (`archiveSearchVideoMap`).

5. **Vídeos API + render**
   - Cerca/càrrega de vídeos via API.
   - Render de targetes i detall de vídeo.

6. **Shorts**
   - Interleaving per canal, modal de shorts, scroll intent, likes de shorts.

7. **Likes, historial i biblioteca**
   - Persistència de liked videos, historial, filtres i render d'historial.
   - Pestanyes de biblioteca, playlists i smart categories.

8. **Playlists i reproducció seqüencial**
   - CRUD de playlists, modal d'afegir, cua, reordenació i mode playlist.

9. **Player i mini-player**
   - Iframe YouTube, missatgeria postMessage, autoplay, controls, drag/resize.

10. **Seguiment de canals i pàgina de canal**
    - Follow/unfollow, tabs de seguiment, perfil de canal, cerca dins canal.

11. **Fallback estàtic**
    - Carrega/render estàtic quan no s'utilitza API.

12. **Compartició i sync**
    - Compartició de canals/categories/playlists.
    - Flux de recepció/deserialització i guardat.
    - Config sync entre dispositius.

## 2) Globals compartides (focus de risc)
Globals amb alt acoblament que s'han de tractar amb molta cura en extreure lògica:

- **DOM refs**: `homePage`, `watchPage`, `videosGrid`, `videoPlayer`, `channelPage`, etc.
- **Navegació/estat de pàgina**: `selectedCategory`, `currentVideoId`, `activeLibraryTab`, `activeFollowTab`.
- **Feed/cerca**: `currentFeedVideos`, `lastRenderedFeedList`, `currentFeedData`, `searchDropdownItems`, `searchArchiveIndexCache`.
- **Playlist/player**: `activePlaylistQueue`, `currentPlaylistIndex`, `isPlaylistMode`, `isAutoPlayNavigating`, `miniPlayerTimer`.
- **Shorts**: `currentShortsQueue`, `currentShortIndex`, `isNavigatingShort`.
- **Caches**: `cachedChannels`, `cachedAPIVideos`, `featuredVideoBySection`, `customCategorySearchCache`.
- **Persistència**: totes les claus `*_STORAGE_KEY` actuals (no renombrar).

## 3) Funcions candidates per extreure primer (sense canviar API pública)
Prioritat a funcions quasi-pures o amb dependències clares:

1. **Utils de text/dades**
   - `isMatch`, `getVideoDisplayDuration`, `escapeHtml`, helpers d'encoding de playlists/categories.

2. **Persistència localStorage encapsulada**
   - `getLikedVideoIds`/`setLikedVideoIds`, `getHistoryItems`/`saveHistoryItems`, `getPlaylists`/`savePlaylists`, follows.

3. **Cerca d'arxiu i normalització de resultats**
   - `buildArchiveThumbnail`, `rememberArchiveSearchVideos`, `getArchiveVideosForChannel`, `searchArchiveVideos`.

4. **Preferències de layout i tema**
   - `loadGridLayoutPreference`, `applyGridLayoutPreference`, controls de fons/botó/font.

5. **Render helpers de targetes**
   - `createVideoCardAPI`, `createArchiveVideoCard`, `createShortCard`, `createHistoryCard`.

## 4) Riscos de regressió
- **Ordre d'inicialització**: hi ha listeners que assumeixen refs DOM ja resoltes.
- **Dependències implícites globals**: moltes funcions llegeixen/modifiquen estat compartit sense paràmetres.
- **Sincronia API/UI**: la cerca i el feed combinen fonts asíncrones + cache.
- **Navegació i historial del browser**: `popstate`, modals i mini-player depenen de flags globals.
- **Playlists i drag&drop**: sensible a canvis d'identificadors, datasets i events delegats.
- **Persistència**: qualsevol canvi de shape de dades guardades pot trencar usuaris existents.
- **Duplicats interns detectats**: hi ha blocs d'algorisme de sorting repetits; tocar-los massa aviat pot alterar ordre visual.

## 5) Ordre recomanat de migració (fases)
1. **Fase 0 (actual)**: documentar + comments de secció (cap canvi funcional).
2. **Fase 1**: extreure helpers purs a un namespace intern (mateix fitxer inicialment).
3. **Fase 2**: encapsular accés a `localStorage` en mini-adapters mantenint signatures públiques.
4. **Fase 3**: separar render helpers (cards/listes) de la lògica de fetch/estat.
5. **Fase 4**: separar “state transitions” (playlist/shorts/player) de “DOM effects”.
6. **Fase 5**: només quan estigui estable, moure blocs a fitxers nous sense canviar API externa.

## Fitxers a tocar en passos següents (proposta)
- `js/app.js` (continua sent el punt d'entrada mentre es fa extracció progressiva).
- Possibles nous fitxers futurs (quan toqui):
  - `js/app/storage.js`
  - `js/app/search.js`
  - `js/app/render-cards.js`
  - `js/app/player.js`
  - `js/app/library.js`

> Nota: aquests fitxers nous **no** es creen en aquest prompt; només es proposen com a direcció de migració.
