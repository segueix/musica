# CLAUDE.md — Guia per a agents IA (Claude Code / Codex)

## Què és Segueix!

PWA vanilla JS (sense bundler, sense TypeScript, sense framework) que agrega vídeos de YouTube de canals en català. Tota la UI és una SPA amb navegació per hash. El feed es carrega des de `data/feed.json` via fetch.

---

## Comandes

```bash
npm run lint          # ESLint — 0 errors, ~93 warnings (tots tolerats)
npm run lint:fix      # Auto-fix (var→let/const, prefer-const)
npm run format        # Prettier — formata tot
npm run format:check  # Verifica format sense modificar
npm test              # Vitest — 45 tests, ~250ms
npm run test:watch    # Watch mode
```

Abans de fer commit: `npm test && npm run lint`

## Regles generals

- **REGULACIÓ D'ERRORS (CRÍTICA):** Abans d'intentar diagnosticar o escriure codi per a qualsevol error relacionat amb la interfície, la memòria cau o l'API, **HAS DE LLEGIR** el fitxer `docs/PROBLEMES_I_SOLUCIONS.md` per buscar patrons similars. Si resol un problema complex, tens l'obligació d'actualitzar aquell document afegint-hi la teva solució.

---

## Estructura de fitxers

```
js/
├── core/
│   ├── segueix-app.js      # Crea window.SegueixApp = { state, dom, features, utils }
│   ├── state.js             # Inicialitza SegueixApp.state amb seccions nested
│   └── dom-registry.js      # Cache d'elements DOM via SegueixApp.dom.init()
├── utils/
│   ├── helpers.js           # Funcions pures globals (isMatch, getVideoDisplayDuration, batchRenderCards...)
│   ├── storage.js           # Constants localStorage + funcions cache (saveFeedCache, loadFeedCache...)
│   ├── id-codecs.js         # Encode/decode IDs ofuscats (SegueixApp.utils.idCodecs)
│   ├── share-codecs.js      # Enllaços de compartició (?importData=, base segueix.github.io/musica/)
│   ├── share-card.js        # Targeta de compartir: model pur + dibuix en canvas + QR amb la icona (UMD)
│   ├── qr-share.js          # Finestra del QR (mostra la targeta; descarrega/comparteix/copia)
│   └── config-feedback.js   # showConfigFeedback/hideConfigFeedback (DOM)
├── features/
│   ├── navigation.js        # Navegació SPA (IIFE + registerRuntime)
│   ├── library.js           # Playlists (IIFE + registerRuntime)
│   ├── feed.js              # Feed/categories (IIFE + registerRuntime)
│   ├── search.js            # Menú de cerca i índex d'arxiu (IIFE + registerRuntime)
│   ├── search-results.js    # Cerca: model pur (artistes primer, després cançons) + HTML del menú i de la pàgina
│   ├── channel.js           # Perfil canal (IIFE + registerRuntime)
│   ├── player.js            # Reproductor (IIFE + registerRuntime)
│   ├── shared-playlists.js  # Playlists compartides (IIFE + registerRuntime)
│   ├── config-sync.js       # Sync configuració (IIFE + registerRuntime)
│   ├── shorts.js            # Shorts — REFACTORITZAT (implementació directa, sense hooks)
│   ├── support.js           # Suport canals — REFACTORITZAT (implementació directa)
│   ├── likes.js             # Likes/favorits — REFACTORITZAT (implementació directa)
│   ├── discovery.js         # Descoberta (mode Els meus de sempre/Una mica de tot/Sorprèn-me, radar, Torna-hi) — funcions pures
│   ├── my-music.js          # «La teva música»: historial (3 últimes + períodes), artistes seguits (model pur + HTML)
│   ├── portada.js           # Portada «La teva plaça musical» (model pur + HTML + esdeveniments), pinta dins #videosGrid
│   ├── artist-page.js       # Fitxa d'artista: dues ràdios (artista / estil), presentació curta expandible (model pur + DOM)
│   ├── user-categories.js   # Les teves categories: categories pròpies de grups (portada, fitxa, ordre, compartir)
│   ├── alphabet-index.js    # Índex alfabètic de la pàgina d'artistes (lletres que es fan grans, arrossegar per saltar)
│   ├── category-artists.js  # Filera d'artistes d'una categoria sota la cançó destacada (scroll al mòbil, desplegable a l'ordinador)
│   ├── shell-nav.js         # Navegació lateral/inferior i avisos breus (toast)
│   ├── music-selection.js   # Motor de selecció musical compartit (funcions pures): antiguitat real, puntuació, restriccions
│   ├── music-signals.js     # Observador únic d'escolta, estadístiques i preferències («(+) com aquesta (−)»)
│   ├── music-queue.js       # Ràdio/cua: motor de selecció, mode de descoberta, «Afegeix a la cua», reproduir una selecció
│   └── home-playlists.js    # «Les teves llistes» de la portada (només a Inici: amagada als estils, categories i cerca)
├── config.js                # Constants CONFIG (branding, theme, features, layout, categories)
├── song-title.js            # Títols nets: treu l'artista i «videoclip / vídeo / oficial» (UMD, funcions pures)
├── youtube.js               # YouTubeAPI object — feed fetch, cache, parsers
├── data.js                  # VIDEOS[], CHANNELS[], formatViews(), formatDate()
├── channels-ca.json         # Mapatge canals
└── app.js                   # Runtime principal (~9.400 línies) — veure secció dedicada
css/
├── styles.css               # Full base (grans blocs; es manté)
└── portada.css              # Identitat de Segueix Música: tokens --pt-*, capçalera, navegació, portada (es carrega després de styles.css)
data/
├── feed.json                # Feed actiu (font principal de vídeos)
├── support.json             # Mètodes de suport per canal
├── archive/channels/        # ~100 fitxers JSON d'arxiu per canal
├── search_index_*.json      # Índexs de cerca híbrids (anys antics anuals, recents mensuals)
└── search_index_manifest.json # Manifest amb els fragments disponibles
scripts/
├── update_feed.js           # Actualitza feed des de YouTube API + Google Sheets
├── sincronitzar_tot.js      # Orquestrador de sincronització completa
├── generar_index_cerca.js   # Genera índexs de cerca des d'arxius
├── netejar_feed.js          # Valida i neteja feed
└── ...                      # Més scripts de manteniment
tests/
├── setup.js                 # loadScript() — carrega IIFEs globals en sandbox vm
├── helpers.test.js          # Tests isMatch, getVideoDisplayDuration, thumbnails
├── id-codecs.test.js        # Tests encode/decode roundtrip
└── likes.test.js            # Tests normalizeLikedVideo, isLiked, getLikedVideos
```

---

## Ordre de càrrega dels scripts (index.html)

L'ordre és **crític** — no es pot alterar sense trencar l'app:

1. `config.js` → `youtube.js` → `data.js` → Sortable.js (CDN)
2. `core/segueix-app.js` → `core/state.js` → `core/dom-registry.js`
3. `utils/helpers.js` → `utils/storage.js` → `utils/id-codecs.js` → `utils/config-feedback.js`
4. `features/navigation.js` → `features/library.js` → `features/feed.js` → ... (tots els features)
5. `app.js` — **sempre l'últim** (orquestra tot)

**Regla general:** core → utils → features → app.js. Dins de cada grup l'ordre importa menys, excepte que `segueix-app.js` ha d'anar primer de core.

---

## Patrons d'arquitectura

### Namespace global

```javascript
window.SegueixApp = {
    state: {},      // Estat centralitzat amb seccions (navigation, feed, channel, playlists, history, search, player, shorts)
    dom: {},        // Cache d'elements DOM (init() lazy)
    features: {},   // Mòduls feature (navigation, library, feed, search, channel, player, shorts, support, likes, ...)
    utils: {}       // Utilitats (idCodecs, configFeedback)
};
```

### Dos patrons de feature coexisteixen

#### Patró 1: IIFE + registerRuntime (majoria de features)

Usat per: `navigation`, `library`, `feed`, `search`, `channel`, `player`, `shared-playlists`, `config-sync`.

```javascript
(function (window) {
    const app = window.SegueixApp;
    const runtime = { hooks: {} };

    function registerRuntime(hooks = {}) { runtime.hooks = hooks; }

    // L'API pública delega a hooks injectats per app.js
    function doSomething(args) {
        return runtime.hooks.doSomethingImpl?.(args);
    }

    app.features.moduleName = { registerRuntime, doSomething };
})(window);
```

Les implementacions reals (`*LegacyImpl`) viuen a app.js i s'injecten via `configureFeatureRuntimes()` (línia ~9330 d'app.js).

#### Patró 2: Implementació directa (features refactoritzats)

Usat per: `shorts`, `support`, `likes`.

```javascript
(function (window) {
    const app = window.SegueixApp;

    // Implementació completa dins el mòdul — sense hooks
    function doSomething(args) { /* lògica real aquí */ }

    app.features.moduleName = { doSomething };
})(window);
```

A app.js queden **wrappers globals fins** per compatibilitat:
```javascript
function doSomething(args) { return SegueixApp.features.moduleName?.doSomething?.(args); }
```

**Si refactoritzes un feature:** segueix el patró 2 (directe). Mou la implementació al feature, deixa wrappers a app.js, elimina el `registerRuntime` corresponent de `configureFeatureRuntimes()`.

### State proxy bridge

`bridgeSegueixAppState()` (app.js línia ~90) crea `Object.defineProperty` getters/setters bidireccionals entre globals legacy (`let currentVideoId`) i el namespace nou (`SegueixApp.state.currentVideoId`). Ambdues formes d'accés funcionen i estan sincronitzades.

### Per què funcionen les referències creuades entre scripts

Les funcions dels feature modules (carregats abans d'app.js) referencien globals definits a app.js. Això funciona perquè:
- `let`/`const` al top-level de `<script>` viuen a l'entorn lèxic global, compartit entre tots els scripts
- Les funcions dins IIFEs capturen la referència per closure, però la **resoluen en temps d'execució** (no de definició)
- Totes les funcions de features s'executen després de `DOMContentLoaded`, quan app.js ja ha carregat

**Restricció important:** Mai cridar funcions de features durant la fase de parsing del mòdul (fora d'event handlers o callbacks). Només són segures en temps d'execució (DOMContentLoaded, click handlers, etc.).

---

## Globals principals d'app.js

### Estat mutable (let)

| Variable | Descripció |
|---|---|
| `currentVideoId` | ID del vídeo reproduint-se |
| `currentFeedVideos` | Array de vídeos del feed actual |
| `cachedAPIVideos` | Cache de vídeos de la YouTube API |
| `selectedCategory` | Categoria activa (persistida a localStorage) |
| `cachedChannels` | Map de canals amb avatar/nom |
| `currentChannelId` / `currentChannelName` | Canal obert |
| `activePlaylistQueue` / `currentPlaylistIndex` | Cua de playlist activa |
| `currentShortsQueue` / `currentShortIndex` | Cua de shorts activa |
| `isPlaylistMode` | Mode reproducció de playlist |
| `shortModalScrollY` | Scroll Y guardat al obrir modal shorts |

### Funcions clau (definides a app.js, cridades des de features)

| Funció | Descripció |
|---|---|
| `filterVideosByCategory(videos, category)` | Filtra vídeos per categoria |
| `filterOutWatchedVideos(videos)` | Exclou vídeos ja vistos |
| `addToHistory(video)` | Afegeix vídeo a l'historial |
| `shareVideo(videoId, title)` | Obre diàleg de compartir |
| `loadVideoInSequence(videoId, source)` | Carrega vídeo al reproductor |
| `renderFeed()` | Renderitza el feed principal |
| `bootstrapApp()` | Inicialització completa de l'app |

---

## Convencions de codi

### Estil (Prettier)

- **Single quotes**, semicolons, 4 espais, trailing commas ES5, 120 chars max
- Template literals per HTML i URLs amb interpolació
- Comentaris en **català**

### ESLint

- `no-undef: off` — necessari perquè tots els scripts comparteixen scope global
- `no-var: warn` — migració gradual de var a let/const
- `eqeqeq: warn` — preferir `===` sobre `==`
- `no-console: warn` — permès `console.log`, `warn`, `error`
- Prefix `_` per variables intencionalment no usades

### Noms

- Variables/funcions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Claus localStorage: prefix `catube_` (ex: `catube_liked_videos`, `catube_history`)
- Features al namespace: `SegueixApp.features.nomFeature`
- Seccions d'app.js separades per comentaris `// ========== NOM SECCIÓ ==========`

---

## Tests

Framework: **Vitest**. Config: `vitest.config.js`.

### Com funciona el test setup

`tests/setup.js` exporta `loadScript(path, extraGlobals)` que:
1. Llegeix el fitxer .js font
2. L'executa dins un sandbox `vm.runInNewContext` amb globals simulats (window, localStorage, document, navigator...)
3. Retorna el sandbox — les funcions globals i `SegueixApp` hi són accessibles

Això permet testar IIFEs i funcions globals **sense canviar l'estructura del projecte**.

### Afegir un test nou

```javascript
import { describe, it, expect } from 'vitest';
import { loadScript } from './setup.js';

// Per funcions globals (helpers.js, etc.)
const ctx = loadScript('js/utils/helpers.js', { YouTubeAPI: undefined });
const myFunction = ctx.myFunction;

// Per features amb IIFE (likes.js, etc.)
const ctx2 = loadScript('js/features/likes.js', { localStorage: createMockLocalStorage() });
const likes = ctx2.SegueixApp.features.likes;
```

### Selecció musical (2026-09-30)

- La ràdio, «Recomanat per a tu», les files i «Torna-hi» fan servir `SegueixApp.features.musicSelection` amb els senyals de `musicSignals`. **No afegeixis una ordenació més** a un flux que ja passa pel motor: les restriccions d'antigues i d'artista s'apliquen al resultat final (`arrangeMusicList()` per a llistes). Ordre de scripts: `discovery.js` → `music-selection.js` → `music-signals.js` → `music-queue.js`.
- Tornar a la política anterior: `localStorage.catube_selection_engine = 'legacy'`. Tot el detall (paràmetres, senyals, limitacions) és a `docs/MUSICA_SELECCIO.md`; la simulació és a `docs/MUSICA_SELECCIO_SIMULACIO.md`.
- Una ràdio d'artista/categoria **sempre** és d'un estil (el de la fila/pàgina o la categoria principal de l'artista) i porta el nom fix de l'estil; el «+» del nom hi suma estils que es barregen a parts iguals (`radioCategory` + `radioExtra` a `music-queue.js`). Només «La teva ràdio» és general.
- Cada ràdio generada (general, d'estil i de cerca; no una selecció ni una llista) porta a la capçalera el **selector del mode de descoberta** (`.mq-mode`: «Els meus de sempre» / «Una mica de tot» / «Sorprèn-me», `musicQueue.setDiscoveryMode()`): en canviar-lo, la part pendent de la cua es torna a triar d'immediat amb el mode nou (sense tocar la cançó que sona ni el que s'hi ha afegit a mà), les cançons entren amb una animació i un avís diu quantes han canviat. El selector mostra el mode amb què s'ha generat la llista que es veu (`radioMeta.requested`), no el de la portada. El nom de la ràdio **no** porta el text del mode (abans «· Sorprèn-me»): hi ha el símbol «desa com a llista» (`[data-mq-save-list]`). `musicQueue.saveAsPlaylist()` desa tota la cua a `catube_playlists` (nom de la ràdio, «Ràdio Pop (2)» si ja existeix; tornar-hi a prémer actualitza la mateixa llista). No hi tornis a posar el text del mode: detall a `docs/MUSICA_SELECCIO.md` («Desar la ràdio com a llista»).
- **«Fora del meu radar» (2026-10-04)** és el quart mode del selector (`discovery.MODES`, id `new`): descoberta pura amb un **filtre dur** a `selectRadio()` (`isNewArtist()` + `discoveryPool()` de `music-selection.js`): només artistes sense cap rastre, un tema per artista, menys pes de popularitat i, només si no n'hi ha prou, artistes poc coneguts amb una nota. No s'aplica a ràdios de cerca/artista ni al feed «Recomanat per a tu» (hi val com «Sorprèn-me»). El selector és 2×2 (`.mq-mode__options`) i a la portada 4 columnes a ≥ 560 px. No hi tornis a posar tres opcions. **Cada mode és un botó amb un marc simple** (`1px`, `--pt-mode-line`; sense marc comú al grup) i **el triat canvia de color** (fons i marc llima), tant a la portada (`.pt-mode__opt`) com a la ràdio (`.mq-mode__opt`). Detall: `docs/MUSICA_SELECCIO.md` (««Fora del meu radar»: descoberta pura»).
- **Vista d'un estil (Pop, Rock…):** a dalt de tot, sota el nom, hi ha el botó **«Ràdio»** (`#pageTitle` amb `.page-title--style`, `renderStyleRadioHeader()` d'`app.js`; `[data-style-radio]` → `startGenreRadio()` → `musicQueue.startStyleRadio([estil])`). Surt a tots els estils de la barra, però no a Inici, Descobreix, Radar ni «Seguint» (`STYLE_RADIO_EXCLUDED_VIEWS`); les categories pròpies ja tenen el seu (`uc-page__radio`). No el treguis ni el posis dins la graella. Prova: `tests/radio-estil.test.js`.
- A la capçalera de la ràdio, **«Barreja» és només un símbol** (`.mq-shuffle[data-mq-regenerate]`, amb `aria-label`) dins el grup `.mq-tools`, junt amb «+», desar i compartir: no hi tornis a posar la paraula ni el botó fora del grup (a mòbil quedava una fila amb només «Barreja»). Al capçal només queda «Obre a YouTube».
- **Selector «Afegeix un estil» a l'ordinador (2026-10-05):** a ≥ 769 px, si és obert (`.mq-style-picker`) i l'usuari fa scroll **cap avall** més de 24 px per veure les cançons (dins la cua, ≥ 1025 px, o la pàgina, 769–1024 px), es **tanca sol** (`onQueueScroll()` → `closePickerKeepingScroll()` de `music-queue.js`: treu el selector sense repintar i compensa la seva alçada perquè les cançons no saltin; lògica pura `shouldClosePickerOnScroll()`). Al mòbil no es tanca. Proves: `tests/selector-estils-scroll.test.js`; opt-in `node tests/browser/verificar-selector-estils-scroll.js`.
- A la cua de la ràdio, la cançó que sona (`.mq-item.is-active`, «Ara sona») va **ressaltada** (fons i barra llima, títol gran en llima de fins a 2 línies i artista en blanc): a escriptori el títol i l'artista de sota el vídeo queden tallats i la cua és on sempre es veu què sona. Estil al final de `portada.css`; no el treguis.
- Una cançó de l'historial **ja no** queda exclosa de la ràdio (tornen amb descans de 12 cançons i 60 min). Novetats i les categories continuen ocultant-les.
- `runSelection()` no pot comparar cada candidata amb totes les ja triades (era quadràtic: entrar a un estil trigava segons al mòbil); les gravacions repetides es miren amb `recordingIndex()`. En tocar un estil, `showCategoryLoading()` posa un esquelet fins que `renderFeedAfterCategoryChange()` pinta la llista: no hi tornis a deixar veure la portada sense el seu estil. Detall: `docs/PROBLEMES_I_SOLUCIONS.md` (2026-10-04, «Salt visual en entrar a un estil»); prova `tests/canvi-estil.test.js`.
- Un vídeo pujat fa poc **no** és una estrena si té any original antic (`originalYear`) o és d'un artista de `musica-classica.json` sense any verificat (`data/musica-dates.json` per excepcions).

### Cerca de Segueix Música (2026-09-30)

- La cerca (menú i pàgina de resultats) és **només del feed de música** i passa per `buildSearchModel()` (app.js) → `SegueixApp.features.searchResults.buildModel()`: **primer artistes, després cançons**, coincidència pel títol, l'artista (i àlies) i els crèdits (mai per la descripció). No hi tornis a posar la cerca de l'API de YouTube, l'índex d'arxiu, «Ja vistos», canals/programes ni accions de categoria personalitzada (herència de Segueix youtubers, eliminada).
- **Estils:** la cerca també troba **categories i gèneres** (`rock`, `blues`, `hip hop`, `coral`, `cançó d'autor`…): `buildModel()` rep `genres` (`music.CATEGORY_GROUPS`) i `categoriesOfChannel`, i retorna `model.genres` (nom de la categoria i dels gèneres que agrupa). Surten entre els artistes i les cançons: al menú (`data-result-type="genre"`) i a la pàgina (`.search-genre-card`: obre la categoria — el xip de la barra d'estils — i un botó de ràdio d'estil amb `musicQueue.startStyleRadio([estil])`). Prova: `tests/search-results.test.js`.
- «Genera una ràdio amb aquests resultats» (a dalt de tot) crida `musicQueue.startFromSearch(model.songs, { query })`: ràdio amb les cançons trobades, **sense restricció d'estil** (`policy: 'search'` al motor), sense «+» d'estils; «Barreja» es queda dins dels resultats. Detall a `docs/MUSICA_SELECCIO.md` («Ràdio d'una cerca»).
- Els clics de la pàgina de resultats es lliguen al contenidor nou (`bindSearchResults`), mai a `#videosGrid`. Verificació opt-in: `node tests/browser/verificar-cerca.js`.

### Títols de cançó (2026-09-30)

- Els títols que es **mostren** no porten el nom de l'artista ni «videoclip / vídeo / oficial»: `js/song-title.js` (`SegueixSongTitle.cleanTitle/cleanVideo`) els neteja al carregar el feed (`decorateVideo`) i en llegir historial, llistes i m'agrades. El títol de YouTube és a `video.originalTitle`.
- **Si necessites les marques del títol** (videoclip oficial, lyric, directe…) llegeix `video.originalTitle || video.title` (com fa `home-sections.isOfficialClip`). Per compartir, usa `getShareLabel()` («Artista - Cançó»). Regles, casos i trampes: `docs/PROBLEMES_I_SOLUCIONS.md` (2026-09-30, «Els títols de les cançons»). Verificació opt-in: `node tests/browser/verificar-titols.js`.

### La teva música (2026-09-30)

- `#playlistsPage` es pinta per aquest ordre: **Historial** (tres últimes cançons amb quan s'han escoltat + símbol d'expandir per períodes), **Artistes** (només els seguits) i **Llistes de reproducció**. L'historial i els artistes els pinta `SegueixApp.features.myMusic.render()` a `#myMusic` (hook `renderMyMusic` de `navigation.showPlaylists()`); les llistes, `renderPlaylistsPage()`.
- **No existeixen** les pestanyes de biblioteca, les categories intel·ligents (categoria exacta per cometes) ni la pestanya/creació de programes a Artistes: no els hi tornis a posar. `setActiveFollowTab()` només accepta `all` | `following`. Verificació opt-in: `node tests/browser/verificar-la-teva-musica.js`.

### Cançons amb subtítols en castellà (2026-10-01)

- Les cançons que **declaren** subtítols en castellà/espanyol al títol o a la descripció no són al feed: `update_music_feed.js` les descarta a cada generació (el workflow «Actualitzar feed musical» corre cada dia) amb `scripts/lib/subtitols_castella.js`, i `node scripts/ocultar_subtitols_castella.js` n'afegeix les del feed actual a `data/hidden-videos.json`. No es poden llegir les pistes reals de YouTube (cal OAuth). Detall, regles i trampes: `docs/PROBLEMES_I_SOLUCIONS.md` (2026-10-01).

### Fitxa d'artista (2026-10-01)

- `#channelPage` (la fitxa d'artista; també l'usa el perfil de programa, que no té ràdios): barra superior `.ap-top` amb «enrere» i **dues ràdios** (`#apRadioArtist` «Ràdio de l'artista» i `#apRadioStyle` «Ràdio de l'estil»), capçalera `.ap-hero` amb el nom a l'esquerra i la **foto gran a la dreta** (`.channel-profile-avatar`, grid de `portada.css`), presentació `.ap-bio` (tres línies, `.is-collapsed`, «Llegeix-ne més») i «Cançons». Tot el JS és a `js/features/artist-page.js` (`showProfile()` i `setSongs()`, que crida `openChannelProfileLegacyImpl()`); no hi tornis a posar `syncChannelProfileActionsLayout()` movent botons (ara és buida: la col·locació és CSS) ni icones `data-lucide` (CDN) a la fitxa.
- **Ràdio de l'artista:** `musicQueue.startArtistRadio(cançons, { name, channelId })`: només cançons de l'artista, reutilitza la ràdio de cerca (`launchPoolRadio`, `policy: 'search'`: ordre del motor pel gust i mode de descoberta, es permeten cançons seguides del mateix artista, «Barreja» es queda dins seu). Nom «Ràdio de <artista>» (`searchRadio.artist`).
- **Ràdio de l'estil:** `musicQueue.startStyleRadio(estils)`: la ràdio d'estil de sempre (estils barrejats a parts iguals, antiguitat, un artista per vegada, descans, mode) amb **els estils de l'artista** (principal primer, màxim 3, sense «Altres estils» ni vistes generals: `artistStyles()`). Comença amb la cançó que tria el motor entre les d'aquells estils.
- Detall i trampes: `docs/PROBLEMES_I_SOLUCIONS.md` (2026-10-01, «Fitxa d'artista»). Proves: `tests/artist-page.test.js` i `tests/music-queue-selection.test.js`.

### Les teves categories (2026-10-04)

- L'usuari crea **categories pròpies de grups** (`js/features/user-categories.js`, patró 2): `catube_music_user_categories` = `[{ id, name, artists: [channelId] }]`. **No** fan servir `catube_custom_tags` / `catube_channel_custom_categories` (herència de Segueix youtubers: «Canal Jove», paraules clau…), que ja no surten a la barra d'estils.
- On surten: a **Inici, a «Tria el teu so» amb els estils** (rajola amb l'etiqueta «La teva», visible sense «Tots els estils», i la rajola «Crea una categoria» `[data-uc-create]`); a la **barra d'estils** (xip `.is-user-category`, `data-cat` = nom; «+ Afegeix una categoria» obre el diàleg nou); a la **fitxa d'artista** (`#apUserCats`, «Les teves categories»: tocar una categoria hi afegeix/treu el grup, «Nova categoria» la crea amb el grup). La vista d'una categoria (`filterVideosByCategory`) mostra les cançons dels seus grups, amb títol propi, **Ràdio** (`musicQueue.startCategoryRadio`, «Ràdio <nom>»), compartir i esborrar.
- Una categoria desa l'ID de la **fitxa** de l'artista: per a cançons i ràdio, expandeix-lo als canals del grup (`categoryChannelIds()`; oficial + «Tema»).
- **Compartir:** `shareUserCategory()` (app.js) → `?importData=` de tipus `category` (nom + ID de canal). El missatge porta **el nom de la categoria i els grups** (`shareMessage()`, `text` de `navigator.share`); «Generar QR» fa la targeta «Categoria · nom · N artistes». En obrir l'enllaç es desa com a categoria pròpia (`importShared()`, sense duplicar; «Nom (2)» si el nom ja és d'una altra) i surt a Inici.
- **Ordre manual a Inici (tàctil):** mantenir premuda una rajola de «Tria el teu so» (250 ms) i arrossegar-la (Sortable); també amb el ratolí o **Alt + fletxes**. Es desa a `catube_music_home_style_order` i `setHomeOrder()` el porta a l'ordre de la barra d'estils (`mergeOrder()`). Visibles sense desplegar: les 8 primeres + una per categoria pròpia (`arrangeTiles()`). **Totes les rajoles fan la mateixa mida** (2026-10-06: `grid-auto-rows: 1fr`, la rajola omple la cel·la, nom de 2 línies com a màxim i recompte d'1 línia alineat a baix; bloc «Tria el teu so: totes les rajoles fan el mateix» al final de `portada.css`).
- Proves: `tests/user-categories.test.js`; opt-in `node tests/browser/verificar-categories.js`. Detall i trampes: `docs/PROBLEMES_I_SOLUCIONS.md` (2026-10-04).

### Artistes de cada categoria (2026-10-05)

- A la vista d'un estil (Pop, Rock…; `isStyleRadioCategory()`) i d'una categoria pròpia, **just després de la cançó destacada** (`#heroSection`) hi ha la filera **«Artistes N»** (`#categoryArtists`, `js/features/category-artists.js`, patró 2): els perfils (foto rodona + nom) dels artistes de la categoria; tocar-ne un obre la fitxa (`openChannelProfile`). `syncCategoryArtists()` (app.js) la pinta després de `updateHero()` a `renderVideos()` / `renderStaticVideos()` i s'amaga a Inici, Descobreix, Radar, «Seguint», la cerca i les vistes buides.
- Quins artistes: els grups (`YouTubeAPI.getArtistGroups()`) amb la categoria a `categories` (estil) o amb algun canal a `categoryChannelIds()` (categoria pròpia), no amagats i amb alguna cançó al feed; primer els que hi tenen la categoria principal i després per nombre de cançons.
- **Mòbil (≤ 768 px): una sola filera amb scroll lateral**, sense botó. **Ordinador: una fila plegada** (`max-height: var(--ca-row-h)`, alçada mesurada pel JS) i, si n'hi ha més dels que hi caben, el botó **«Mostra'ls tots (N)» / «Mostra'n menys»** la desplega (`.ca__list.is-expanded`). Estil al final de `portada.css`. Proves: `tests/category-artists.test.js`; opt-in `node tests/browser/verificar-artistes-categoria.js`.

### Pàgina d'artistes: índex alfabètic (2026-10-04)

- A la dreta de la llista d'artistes (`#followPage`) hi ha una **columna de lletres** (`js/features/alphabet-index.js`, patró 2; `renderFollowPage()` crida `alphabetIndex.attach(followGrid)`): tocar-la o **arrossegar-hi el dit** porta als artistes de la lletra (amb una bombolla gran amb la lletra), i **en fer scroll la lletra dels artistes que es veuen es fa gran** (escala 2, les veïnes 1,5 i 1,2: `--az-scale`). L'ordre de la llista i la inicial de la barra comparteixen `alphabetIndex.sortKey()` / `compareNames()`: ignoren només els articles catalans inicials **El, Els, La, Les i L’** (també amb apòstrof recte), però conserven sempre el nom complet visible. Així «Els Amics de les Arts» va a A, «La Fúmiga» a F i «Els Pets» a P. Inicials sense accents; números i símbols a «#»; les lletres sense artistes, apagades. La columna penja de `<body>` (un pare amb transformació trencava el `position: fixed`) i el CSS l'amaga fora de la pàgina d'artistes (`body:has(#followPage.hidden)`). Proves: `tests/alphabet-index.test.js`.
- El botó «Artistes» de la capçalera (només al mòbil) va **sense marc** verd fluorescent, com la resta d'accessos de dalt.

### Revisió d'idioma de les cançons noves (2026-10-02)

**Prompt per a l'agent — quan et demanin «revisa les cançons noves», «revisa l'idioma» o similar:**

1. Cada generació del feed (`update_music_feed.js`, workflow diari) afegeix a `data/revisio-idiomes.json` les cançons que hi entren **per primera vegada**. Si el títol té una marca que el català no fa servir mai (ñ, ¿ ¡, á, -ción, ã õ â ê ô, un alfabet no llatí; sense mirar els noms d'artistes, les col·laboracions ni el que hi ha entre parèntesis: `detectNonCatalan()`), la cançó es **descarta sola** (surt del feed) però queda a `descartades` amb el motiu, per si ha estat un error. La resta van a `pendents` (id, artista, títol, extracte de la descripció o el disc, data). Les ja revisades (`revisades`) i les amagades no hi tornen. Mira-les amb `node scripts/aplicar_revisio_idiomes.js --llista` (fes `git pull` abans: el bot hi escriu cada dia).
2. Decideix l'idioma de **cada** cançó: títol, disc, artista i el que sàpigues de la cançó. Criteri de l'usuari (2026-10-02): **només es queda el català** (i l'occità/aranès, les instrumentals i els títols que són noms propis). S'amaga el castellà, el basc, l'anglès, el portuguès, el gallec, l'italià… Si dubtes, no l'amaguis: posa-la a la llista de dubtoses.
3. Revisa també les **descartades**: si alguna és en català (un nom de lloc com «Viñarock», un error d'escriptura com «Mai sabrás», una paraula estrangera en un títol català), proposa recuperar-la. **Ensenya a l'usuari** les pendents que amagaries (agrupades per artista, amb l'idioma), les dubtoses i les descartades que recuperaries, i **espera el seu vistiplau**. No apliquis res abans.
4. Amb el vistiplau: `node scripts/aplicar_revisio_idiomes.js --amaga=ID1,ID2,… --recupera=ID3,… --dry-run` i després sense `--dry-run`. Amaga les pendents triades i totes les descartades menys les recuperades (que tornen al feed a la propera generació) (`data/hidden-videos.json`: el client les filtra i el generador ja no les posa al feed; **no toquis `feed.json`**) i passa **totes** les pendents a revisades: la llista queda buida fins que n'entrin de noves.
5. Actualitza `docs/ARTISTES_CASTELLA.md` (artistes nous, recomptes, «Última revisió»). Si un artista té moltes cançons d'una altra llengua, proposa-li a l'usuari una regla per títols a `scripts/ocultar_titols_castella.js` (`afegeix()`): la generació la fa servir també per als canals Tema. Lògica pura: `scripts/lib/revisio_idiomes.js`; prova `tests/revisio-idiomes.test.js`.

### Revisar cançons en castellà (2026-10-01)

**Prompt per a l'agent — quan et demanin «revisa el castellà», «elimina cançons en castellà» o similar (d'un artista, d'una categoria o de tot el feed):**

1. **Llegeix sempre `docs/ARTISTES_CASTELLA.md`** abans de res: és la llista d'artistes a qui ja hem amagat cançons en castellà o basc i on és més probable que en surtin de noves. Repassa'ls **tots**, encara que només et demanin una categoria, amb `node scripts/revisar_castella_vigilats.js [--since=AAAA-MM-DD] [--artista="Nom"]`.
2. Després repassa l'abast que t'hagin demanat (artista/categoria). Criteri: s'amaga només el que és **100 % en castellà o basc** (el títol i, si dubtes, la lletra/descripció; `defaultAudioLanguage` no és fiable). Es conserva el català, el mixt i els títols compartits.
3. Amaga amb una regla per canal a `REGLES` de `scripts/ocultar_titols_castella.js` (la clau és el `channelTitle` exacte; per a una llista de títols, `afegeix(['canal oficial', 'canal Tema'], [títols])`, que hi posa límits de paraula i suma a la regla que ja hi hagi) i `node scripts/ocultar_titols_castella.js`; per a casos puntuals (Short, àlbum…) afegeix l'ID a `data/hidden-videos.json`. No toquis `feed.json`.
4. **Actualitza `docs/ARTISTES_CASTELLA.md`**: artistes nous, recomptes, notes i la data de «Última revisió», i afegeix l'entrada a `docs/PROBLEMES_I_SOLUCIONS.md`. Si un artista apareix a la llista per primera vegada, afegeix-lo amb la primera columna `**Nom exacte al feed**`.
5. Digues a l'usuari quines cançons has amagat i quines dubtoses has deixat.

### Actualitzador del feed i quota de YouTube (2026-10-06)

- **Actualització general només un cop al dia, a les 20 h de Madrid** (`actualitzar-feed-musica.yml`: crons `0 18` i `0 19` UTC; `decideScope()` de `scripts/lib/abast_feed.js` descarta el que no toca segons l'horari d'estiu/hivern). GitHub pot endarrerir els crons uns minuts. Manual: «Run workflow» (opció «discografia sencera» per als Tema).
- **Altes** de canals (workflow_run de «Validar base musical» / «Cercar canals YouTube»): només els canals nous (`MUSIC_TARGET_CHANNELS`). **Baixes:** `node scripts/purgar_canals_feed.js` les treu del feed, de l'arxiu (`data/archive/channels/<id>.json`, també els arxius de canals que ja no són a la base), del catàleg Tema, dels discos, de les revisions i de l'auditoria **sense cap crida a l'API**; després `archivar_feed_musical.js` refà l'historial dels estils i el pool. No hi tornis a posar una regeneració general per a una baixa (≈ 1.200 unitats). Lògica pura: `scripts/lib/purga_canals.js`.
- **Push:** només les revisions de dades (`music-channel-video-allowlist.json`, `falsos-shorts.json`) consulten YouTube, i només els canals afectats; un canvi de codi del generador espera a les 20 h.
- **Publicar:** `bash scripts/publicar_dades.sh "missatge" camins…` (tots els workflows del feed): si `git push` falla perquè main ha canviat, fa `git pull --rebase -X theirs` (en conflicte mana el fitxer acabat de generar) i ho torna a provar (4 intents). No hi tornis a posar un `git push origin HEAD:main` sol: es perdia el feed després de gastar la quota. Proves: `tests/quota-feed.test.js`. Detall: `docs/PROBLEMES_I_SOLUCIONS.md` (2026-10-06, «quota»).

### Mana el canal «Tema» (2026-10-02)

- Els canals «Artista - Tema» (Topic, `type: 'topic'` a `artistes-musica.json`) són la **discografia** de l'artista. `update_music_feed.js` en llegeix cada dia **només la primera pàgina** (50 pistes) i la **discografia sencera per torns** (fins a `MUSIC_TOPIC_MAX_PAGES` × 50 pistes; cada canal un dia de cada 7, `MUSIC_TOPIC_FULL_DAYS`, torn fix per ID: `topicReadTurn()` / `shouldReadFullTopic()`; un canal nou sense catàleg desat o `MUSIC_TOPIC_FULL_READ=1` el llegeixen sencer). Els altres dies la primera pàgina se suma a la discografia desada (`mergeTopicTracks()`) i les pistes que ja eren al feed es conserven (títols a `data/music-topic-catalog.json`, que el client no llegeix) i en posa al feed una pista per cançó: les 40 més escoltades i les de fa menys de 180 dies, sense les que ja tenen videoclip al canal propi. Una cançó amagada al canal propi (per ID a `hidden-videos.json` o per una regla **de títols** de `ocultar_titols_castella.js`; les regles «totes» no) tampoc no entra des del Tema. Lògica pura: `scripts/lib/canal_tema.js` (`songKey`, `governClassification`, `selectTopicTracks`); prova `tests/canal-tema.test.js`.
- **El Tema mana sobre el canal oficial** (només les cançons que també són al Tema, més Shorts, àlbums, decisions manuals, el que porta una marca de cançó publicada al títol — videoclip, lyric, àudio oficial, visualizer: `hasSongMarker()` — i el que s'ha publicat fa menys de 30 dies) **només on el Tema cobreix el 75 % de les cançons del canal oficial** (`minCoverage`; molts Tema només tenen els discos recents: Pau Riba 28 pistes, Inadaptats 15) amb `MUSIC_TOPIC_GOVERNANCE=apply` (variable del workflow, **activa des del 2026-10-02**; amb `audit` no canvia res). Què ha tret cada generació: `data/music-topic-review.json` (per recuperar una cançó, `data/music-content-overrides.json`); la cobertura per canal és a `topicCoverage` de `music-feed-audit.json`. Els títols es comparen amb `songKeys()` (cada tros del títol, entre cometes, sense número de pista ni col·laboracions) contra `topicKeys()`.
- **Tema no afegits** (homònims o dubtosos): Cactus Troop, Elo, Jaume Sisa i Mestres, miquel, Raimon, Scorpio, Suu (altres artistes amb el mateix nom), Manel (barrejat amb un artista vietnamita), ZOO (barrejat amb un grup indonesi), Llum, Maig, Fades (dubtosos), Subliminal (llista blanca), Palau (és el de Ferran Palau) i Joan Manuel Serrat (la regla «totes» del seu canal no es pot aplicar a la discografia: cal una llista de títols en castellà). Abans d'afegir-ne cap altre, comprova que les pistes són de l'artista. Detall: `docs/PROBLEMES_I_SOLUCIONS.md` (2026-10-02, «canals Tema»).

### Discos a la fitxa d'artista (2026-10-02)

- `data/albums-musica.json` és un índex **local i lazy-load**: només es descarrega quan s'obre una fitxa d'artista. No intervé a portada, categories, Novetats ni cerca.
- Font: descripcions de pistes Topic que **ja havia rebut** el generador (`Provided to YouTube by…`). Abans que `slimFeed()` elimini `description`, `scripts/lib/albums_musica.js` conserva nom del disc, any, una pista per construir la caràtula i els IDs de cançó. **No fa cap consulta API addicional.**
- Només es presenta com a «Disc» un llançament amb almenys **2 títols diferents**; els senzills i les cançons sense assignació fiable van a «Singles i altres».
- Un videoclip del canal oficial hereta el disc només si `artista + títol normalitzat` coincideix amb **un únic disc** Topic. Si és ambigu, no s'inventa cap relació.
- UI: `js/features/artist-page.js` pinta «Discos» amb caràtules; tocar un disc filtra la graella de cançons. `Totes` restaura el repertori. Fora de `#channelPage` no es mostra cap disc.

### Sense Shorts (2026-10-04)

- Segueix Música **no mostra cap Short**. `YouTubeAPI.filterHiddenVideos()` (per on passen feed, instantània local, pool de ràdio, historial dels estils, arxiu de la fitxa i cerca) descarta `isShort === true`; `update_music_feed.js` els treu tots del feed (abans es quedaven els que coincidien amb una cançó del Tema) i `archivar_feed_musical.js` no en guarda a l'arxiu ni al pool. Els **falsos Shorts** (`data/falsos-shorts.json`) es corregeixen abans i continuen com a cançons. A la interfície ja no hi ha la fila «Shorts» dels estils ni de la fitxa d'artista, ni el filtre «Shorts» de l'historial (`isSongOrShort()` ara és `isSongVideo()` i els exclou). `shorts.js` i la finestra `#short-modal` queden sense cap punt d'entrada. No hi tornis a posar Shorts. Prova: `tests/sense-shorts.test.js`.

### Feed calent + historial musical (2026-10-02)

- `data/feed.json` és el **catàleg calent**: conserva tots els vídeos dels últims **365 dies** i, per canal, les **12 cançons/directes antigues amb més visualitzacions**.
- La resta va a `data/archive/channels/<channelId>.json`, amb camps compactes (`id`, títol, artista/canal, data, `viewCount`, categories, tipus i durada). `YouTubeAPI.getChannelVideosWithHistory()` ja fusiona feed + arxiu quan s'obre la fitxa de l'artista; les miniatures de l'arxiu es deriven de l'ID.
- **Historial dins dels estils (2026-10-04):** `data/historial-musical.json` (generat per `archivar_feed_musical.js` i `update_music_history_views.js` amb `buildStyleHistory()` de `scripts/lib/arxiu_musical.js`: totes les cançons de l'arxiu, una per línia, amb visualitzacions i durada, sense nom de canal ni hora) es carrega en segon pla (`YouTubeAPI.ensureStyleHistory()`). En una vista d'estil, categoria pròpia o «Seguint» (`isStyleHistoryView()`), `mergeStyleHistory()` les afegeix a les del feed **abans** de filtrar, i el motor les ordena amb tot el conjunt (`rankRecommendedWithEngine()` + `arrangeMusicList()`): surten amb la mateixa targeta i les visualitzacions. **Ja no hi ha** la secció separada d'arxiu (`renderCategoryHistorySection`, `createArchiveVideoCard`, icona `archive-history-badge`): no la tornis a posar. Prova: `tests/estils-historial.test.js`.
- `data/history-pool.json` conserva només **6 clàssics per canal** per donar varietat a les ràdios. La portada/Novetats no el carreguen com a feed: `music-queue.js` l'afegeix només al conjunt de candidates de ràdio.
- `scripts/archivar_feed_musical.js` fa la separació **sense API** i `scripts/generar_index_cerca.js` ja indexa els arxius per canal.
- `scripts/update_music_history_views.js` actualitza **només `viewCount`** dels arxius en lots de 50 amb `videos.list`; workflow setmanal diumenge 09:23 UTC. No regenera canals ni el feed.
- Configuració: `MUSIC_HOT_DAYS` (365), `MUSIC_OLD_KEEP_PER_CHANNEL` (12), `MUSIC_HISTORY_POOL_PER_CHANNEL` (6).

### Feed aprimat (2026-10-02)

- `data/feed.json` s'escriu **aprimat** i amb **un vídeo per línia** (`scripts/lib/aprimar_feed.js`: `slimFeed()` + `serializeFeed()`). Des del 2026-10-02, **els vídeos del feed públic no porten `description`**: la descripció completa només s'utilitza dins `update_music_feed.js` abans d'escriure (idioma, subtítols, suport, any original, classificació). Si comença per «Provided to YouTube by…», es converteix en el booleà compacte `topicTrack:true`, que és el que usa el client per no confondre una pista Topic amb un videoclip. `musicReason` només es conserva si és «marcador explícit»; també s'eliminen `sourceChannelId` redundant i camps buits. **No tornis a escriure el feed amb `JSON.stringify(feed, null, 2)`**: qualsevol script que el reescrigui ha de fer servir `serializeFeed()`. L'aprimador nou s'aplica a l'actualització diària de les 20 h. Aplicar-ho sense API: `node scripts/aprimar_feed.js`. Prova: `tests/aprimar-feed.test.js`.

### Llengua declarada a YouTube (2026-10-02)

- Perquè hi hagi més anuncis en català, els artistes han de declarar el català com a llengua de l'àudio i del títol a YouTube Studio (o a la distribuïdora en els temes «Provided to YouTube»). L'app no ho pot canviar. `node scripts/informe_llengua_declarada.js` genera `docs/informes/llengua-declarada.csv` (una fila per cançó publicada sense català declarat, amb l'enllaç per editar-la) i la taula per artista de `docs/LLENGUA_DECLARADA.md`, que porta també el missatge per enviar als artistes. Català, aranès (`oc`) i instrumental (`zxx`) es consideren correctes. Prova: `tests/informe-llengua-declarada.test.js`.

### Revisió de títols de cançons (2026-10-01)

- `revisio-cancons.html` (la URL `revisio-artistes.html` hi redirigeix) llista **totes les cançons publicades** (mateix criteri que l'app: no ocultes, ni Shorts, ni estàtic, `isCategoryEligibleVideo`; ~4.900) amb el **títol tal com es veu a l'app** (`decorateVideo`, o sigui títol net i nom de l'artista), perquè l'usuari l'editi i baixi `revisio-cancons-AAAA-MM-DD.json` (només les editades: `id`, `artist`, `originalTitle` de YouTube, `currentTitle`, `title` nou). Cada fila té una casella **OK** (el títol ja està bé): amb el filtre per defecte «Pendents» la cançó desapareix de la llista (marques a `localStorage` `segueix_revisio_cancons_ok_v1`, i «Marca aquesta pàgina com a OK»); l'export només porta les editades (amb `ok`) i el recompte d'OK. Lògica pura a `js/revisio-cancons.js`; prova `tests/revisio-cancons.test.js`. **Quan l'usuari et passi el fitxer:** mira els casos; si responen a un patró, corregeix la regla a `js/song-title.js`; si són puntuals, cal un registre d'excepcions per vídeo (encara no existeix: crea'l, aplica'l a `decorateVideo` i documenta-ho). No toquis `feed.json`.
- La revisió d'artistes anterior (noms i categories) és a `revisio-noms-artistes.html`.

### Revisió d'artistes: noms i categories (2026-10-01)

- `revisio-noms-artistes.html` (abans `revisio-artistes.html`; pàgina estàtica, sense token) deixa editar el **nom que es veu a l'app** i les **categories** dels artistes ben indexats (canal de YouTube assignat, no rebutjats) i marcar-los **OK**; baixa un document `revisio-artistes-AAAA-MM-DD.json`. **Quan l'usuari et passi aquest fitxer:** `node scripts/aplicar_revisio_artistes.js <fitxer> --dry-run`, ensenya-li què canviarà i, si ho confirma o ho demana, executa'l sense `--dry-run` i `node scripts/validar_artistes_musica.js`. La lògica és a `js/revisio-artistes.js` (`applyExport()`).
- **El nom editat és `displayName`** de l'artista a `data/artistes-musica.json` (no `name`, que és el de la base d'artistes). El client el posa a `channelTitle`/`channel.name` a `music-categories.js` (`cleanVideoTitle`, `decorateChannel`, `displayNameForChannel`) i a `YouTubeAPI.withDisplayName()`; el nom de YouTube queda a `originalChannelTitle`/`originalName`. **`feed.json` i els scripts continuen duent el nom de YouTube** (`channelTitle` exacte per a `REGLES` de `ocultar_titols_castella.js` i `docs/ARTISTES_CASTELLA.md`): no hi posis `displayName`. Les categories editades es marquen `genre:manual`. Detall: `docs/MUSICA_DADES.md` («Revisió de noms i categories»).

### Contacte i suggeriment d'artistes (2026-10-01)

- **«Suggereix un artista o grup»** (2026-10-05) és un **enllaç directe al formulari de Google** (`<a id="addYoutuberBtn" href="…/viewform" target="_blank">` a la franja «Hi falta algú?» de la part superior de `#followPage`; `initSuggestFormLink()` d'`app.js` hi posa `CONFIG.forms.suggestYoutuberUrl` i, a l'app d'escriptori instal·lada, l'obre a la mateixa finestra). **Ja no hi ha `#addYoutuberModal`** ni el botó «Obre el formulari»: no els hi tornis a posar. La nota «Abans de suggerir…» i les fonts d'indexació (Llista.cat, ClapClap…, que eren de Segueix youtubers) s'han esborrat: no les hi tornis a posar. `shell-nav.js` (`suggest`) el clica. **«Informació per a artistes»** (`info-youtubers.html`, nom de fitxer històric; s'obre des del modal de contacte) és la pàgina per als músics: què és el projecte (**sense ànim de lucre, per beneficiar els músics i grups catalans**), **com compten les visualitzacions als seus canals de YouTube** (reproductor oficial, trànsit extern, YouTube decideix què compta i la monetització), **com funcionen els algorismes de les ràdios** (pesos 45/20/15/10/10, mix d'antiguitat 65/25/10, regles d'equitat, quatre modes de descoberta), com s'hi entra, què es veu i quan s'actualitza, consells, com entrar/amagar/sortir i privacitat. **Si canvies els pesos o les regles del motor (`music-selection.js`, `docs/MUSICA_SELECCIO.md`) o què es mostra, actualitza aquesta pàgina** (la prova `tests/contacte.test.js` comprova els pesos). No hi tornis a posar contingut de YouTubers (categories de vídeos, Radar, programes, Shorts al mòbil). **El contacte** (2026-10-05) és a un modal propi, `#contactModal`, que s'obre amb la icona **«@»** (`#contactBtn`) de la capçalera, abans de la configuració, a escriptori i a mòbil (`openContactModal()`, mateix patró que l'altre: entrada a l'historial `modal: 'contact'`, clic fora i Enrere el tanquen): **Telegram** (`t.me/segueix`), **correu** (`info.segueix@gmail.com`), «Informació per a artistes», «Encara no tens Telegram?» i els crèdits. El modal de contacte té l'estil de `portada.css` (`.pt-contact*`, `#contactModal`). No hi tornis a posar Telegram ni el correu a la franja de suggeriment. **Capçalera mòbil:** «Música» no va al costat del nom sinó **petit, a sota de «Segueix!» i alineat a la dreta: les dues paraules acaben a la mateixa vertical** (`.app-header .brand-tag` en absolut, `right: 0`; 2026-10-06). A l'ordinador continua al costat del nom. La marca (`.app-header .brand`) és un contenidor (`container-type: inline-size`): si no hi cap «Segueix!» (≤ 130 px, a 320 px d'ample) només queda el logo i «Música» passa a sobre el logo, a baix a la dreta (`.brand-mark__tag`); abans se solapava amb la icona de cerca. **Pantalla d'espera** (`#intro-splash`): «Segueix!», a sota «Música» (`.intro-splash-brand`, llima) i «En català». No hi tornis a posar el vídeo de YouTube «Coneix-nos» ni Xiuxiuejar (eliminats, com les seves imatges). La crida de la pàgina és la franja `.follow-suggest` (disc llima amb micròfon, «Hi falta algú?», botó llima; selectors `#followPage …` al final de `portada.css`, marge dret per a la columna de lletres). Si canvies el CSS amb HTML nou que en depèn, canvia el `?v=` de l'enllaç a `index.html` (2026-10-04: sortia sense estil per la memòria cau). `suggestYoutuberUrl` (`js/config.js`) és el formulari de Google propi de Segueix Música (2026-10-04), vinculat a un full de càlcul de respostes; l'enllaç ha de ser el públic (`/viewform`), no el d'edició. Prova: `tests/contacte.test.js`.

### Passar la música a un altre aparell (2026-10-06)

- Configuració → «Sincronitza amb Google Drive» substitueix tots els fitxers i codis de vinculació anteriors (2026-10-07). Mòduls `music-data.js`, `drive-sync-model.js`, `google-drive-sync.js`; credencial pública a `js/google-drive-config.js`. Només `drive.appdata`, tokens en memòria, metadades per compte, marques d’esborrat i un fitxer per aparell. Vegeu `docs/GOOGLE_DRIVE.md`. No restaureu la transferència de configuració/historial per fitxers, WhatsApp, QR o `/api/sync`. Compartir públicament una llista/categoria continua separat.
- **No hi ha «Exportar tot» ni «Importar tot»** (eliminats el 2026-10-06): exportaven tot el `localStorage`; no els hi tornis a posar. Detall: `docs/PROBLEMES_I_SOLUCIONS.md` (2026-10-06). Prova: `tests/music-transfer.test.js`.

### Botons d'icona i colors de la configuració (2026-10-02)

- Els símbols de la ràdio (`.mq-add-style`, `.mq-shuffle`, `.mq-save-list`, `.mq-share`, «Obre a YouTube») i els de sota el reproductor (`.btn-round-icon`: comentar, afegir a llista, compartir, mini reproductor; `.btn-heart`; «Canal YouTube» `.btn-pill-red`) tenen **la mateixa forma i colors**: **rodons** de 44 px (`border-radius: 50%`; «Canal YouTube» i «Obre a YouTube», en càpsula `--pt-radius-pill` com els xips de categoria), fons `--pt-surface-2`, vora `--pt-line`, text `--pt-text` i llima en passar-hi per sobre o en estat actiu (desada, m'agrada). Bloc «Botons d'icona unificats» al final de `portada.css`; no hi tornis a posar quadrats ni el vermell de YouTube. **El «+» només vol dir «afegir cançons a una llista»** (`#playlistBtn`): afegir un estil a la ràdio (`.mq-add-style`) fa servir la icona de dos cercles que es barregen (`ICONS.blend`); no hi tornis a posar el «+».
- La configuració **només deixa triar el color de fons** (i la mida de la font): no hi ha selector de color de botons. `initButtonColorPicker()` aplica sempre el color de la marca i esborra `catube_button_color`; «Sempre tinc sort» només sorteja el fons. Prova: `tests/botons-unificats.test.js`.

### Estil «Urban» (2026-10-02)

- La categoria «Urbana» es diu **«Urban»** i els estils van en aquest ordre a tota l'app: **Urban, Pop, Rock, Cançó d'autor**, Indie, Rap / Hip-hop, Folk i arrel, Electrònica… (`CATEGORY_GROUPS` de `music-categories.js`, `CONFIG.categories`, xips d'`index.html`, `discovery.js`, `home-sections.js`, `update_music_feed.js`). El **gènere** de la base d'artistes continua sent «Urbana» (`data/music-genres.json`, `artistes-musica.json`): «Urban» l'agrupa.
- El feed actual encara porta `categories: ['Urbana']` fins que es regeneri: `canonicalCategory()` (music-categories.js, també a `YouTubeAPI.normalizeCategories`) el tradueix a «Urban». `renameUrbanaCategory()` (storage.js, una vegada: `catube_music_urban_v1`) renomena la categoria desada, els estils de la primera vegada i la darrera ràdio, i buida l'ordre desat dels xips perquè arribi l'ordre nou. Prova: `tests/estil-urban.test.js`.

### Navegació lateral plegable (2026-10-03)

- La barra de l'esquerra (≥ 769 px: columna de 84 px a tauleta, 236 px a escriptori) es **plega i es desplega amb el botó de tres ratlles** `#sidebarToggle`, el primer de la capçalera (`index.html`, a l'esquerra del logo; **requadre blanc de vora fina** de 44 px (mida tàctil mínima) amb cantonades de 8 px, com el botó de menú de GitHub — no el tornis a posar sense vora; al mòbil no existeix, hi ha la navegació inferior). Plegada, la barra **llisca cap a fora** (`translateX(-100%)`, `visibility: hidden`: el teclat no hi entra) i el contingut ocupa tot l'ample. La preferència es recorda a `segueix_music_desktop_sidebar_collapsed`; amb la barra plegada el botó es veu en llima i `aria-expanded` / `aria-label` canvien (`initDesktopSidebarPreference()` a `app.js`).
- **Com funciona (portada.css, final):** `--pt-side-open` és l'ample desplegat (84 / 236 px; la barra el fa servir) i `--pt-side-w` és l'espai que ocupa ara (el padding del cos i el marge de la capçalera hi depenen). `body.sidebar-collapsed` el posa a 0. `--pt-side-w` és una propietat registrada (`@property`) perquè s'animi (0,28 s) i `body.sidebar-ready` activa la transició un cop pintat l'estat desat (en obrir l'app plegada no s'anima). **No posis `width` ni `margin-left` ad hoc a la barra ni al contingut:** tot ha de dependre de `--pt-side-w`.
- Eliminat el 2026-10-03: la fletxa ‹ › dins la barra (`#sidebarPinToggle`) i la «vista prèvia» en passar per sobre d'una franja de 12 px; el bloc de `styles.css` que hi afegia un marge extra (el contingut sortia desplaçat 240 px) i deixava la barra plegada amb 236 px d'ample buits. Verificació opt-in: `node tests/browser/verificar-barra-lateral.js`; estàtica: `tests/barra-lateral.test.js`.

### Enllaços del peu (2026-10-02)

- El peu (`.seo-footer-nav`) només porta **Artistes, Urban, Pop, Rock, Cançó d'autor, Indie i Folk i arrel**, amb rutes relatives dins l'app (`./?seccio=artistes`, `./?estil=Pop`…): l'app és a `segueix.github.io/musica/` i les rutes absolutes antigues (`/pop`, `/novetats`, `/musica-tv`…, funcions de segueix.cat) hi donaven 404. `shell-nav.js` intercepta el clic (`data-pt-style` → `openStyle()`, que clica el xip de l'estil; `data-pt-nav="artists"`) i, en obrir la URL directament, `openFromUrl()` hi porta quan els xips són a punt. No hi tornis a posar Novetats ni Música TV.

### Mode conducció (2026-10-02)

- Botó `#driveModeBtn` sota el reproductor (només ≤ 1024 px): `js/features/drive-mode.js` (patró 2, després de `system-player.js`) posa `body.drive-mode`: **pantalla negra amb només el reproductor de YouTube a dalt** (16:9, mínim 200 px d'ample, mida que demana YouTube) i **un sol botó, «Tanca el mode conducció»** (`#driveModeExit`). Cap altra informació ni control, per no distreure qui condueix. La pantalla no s'apaga (Screen Wake Lock, es torna a demanar en tornar a la pàgina), i es posa a pantalla completa si el navegador ho permet (a l'iPhone no).
- **No es tapa ni es mou el reproductor:** tot és CSS (`body.drive-mode *` amb `visibility: hidden` i el reproductor `fixed`, bloc «Mode conducció» al final de `portada.css`). Moure'l al DOM el faria recarregar, i tapar-lo incompliria les normes de YouTube. No hi posis títols, caràtules ni més botons. Verificació opt-in: `node tests/browser/verificar-mode-conduccio.js`.

### Controls del sistema i finestra flotant del sistema (2026-10-02)

- `js/features/system-player.js` (patró 2, després de `music-queue.js`) porta **tota la Media Session** (music-queue només hi delega amb `systemPlayer.update()`): títol, artista, ràdio (`musicQueue.playlistName()` si és una ràdio) i caràtules, `playbackState` (1 o 3 = sona), `setPositionState` amb la durada de la cançó, i les accions play / pausa / atura / endavant-enrere 10 s / saltar; **anterior i següent només si la cua en té** (sense gestor, el sistema amaga el botó). Es posa al dia amb un `MutationObserver` de `#videoPlayer` (`data-player-state`, `data-playing-video-id`) i, cada 5 s, amb els avisos del reproductor.
- **Ordinador: finestra flotant de la pàgina (2026-10-05, posterior):** el botó `#playerMiniBtn` **ja no obre la finestra del sistema**: a l'ordinador, com al mòbil, posa el reproductor a la **finestra flotant de dins la pàgina** (a baix a la dreta, amb `#playerExternalControls` enganxat a sota: anterior · play/pausa · següent · restaura · m'agrada · tanca). I si sona (o està en pausa) una cançó i es canvia de secció, `handlePlayerVisibilityOnNavigation()` la passa a la finestra flotant (`shouldFloatPlayerOnNavigation()`: només > 768 px, pàgina visible, amb iframe) en lloc d'aturar-la; el vídeo no es recarrega. Al mòbil, sortir del reproductor continua aturant-lo si no és a la finestra flotant. El paràgraf següent descriu la finestra del sistema, que ara no té cap botó que l'obri (`systemPlayer.openPip()` continua existint; el botó només la tanca si és oberta). Prova: `tests/finestra-flotant-escriptori.test.js`.
- **Finestra flotant del sistema** (Document Picture-in-Picture: Chrome i Edge d'escriptori i Chromebook; 2026-10-05): el botó de finestra flotant de la barra de controls (`#playerMiniBtn`) l'obre i hi **trasllada el VÍDEO de YouTube** (el node `#videoPlayer` sencer, a la caixa `.sp-video`), amb la cançó, la ràdio, la barra de temps, anterior / play-pausa / següent, «com aquesta» (+/−) i què ve després a sota (res no va damunt de l'iframe). Així l'usuari pot canviar de pestanya o de web i el vídeo continua **visible** (normes de YouTube). Mentre és oberta: a la pàgina el forat del reproductor diu «El vídeo sona a la finestra flotant» amb «Torna el vídeo aquí» (`#videoPipRestore`) i el botó `#playerMiniBtn` fa de «torna el vídeo a la pàgina»; `body.is-video-pip`. En tancar-la (X o «torna a la pestanya»: `pagehide`) el reproductor torna al seu lloc i es reprèn al segon on era; si l'usuari és en una altra pàgina de l'app, es queda a la finestreta de dins la pàgina (`setMiniPlayerState(true, { trigger: 'pip-closed' })`).
- **Com funciona (trampes):** moure un iframe el torna a carregar: `reloadAt()` hi posa `start=<segon>` i `autoplay=0|1` (si estava en pausa es torna a pausar). Els avisos de l'iframe (onStateChange, infoDelivery, final de cançó) arriben a la finestra, no a la pàgina: `forwardMessage()` els **reenvia a `window`** amb la mateixa font perquè `handleYouTubeMessage` (que comprova `event.source`) no noti res. Com que `document.getElementById('videoPlayer')` ja no el troba, qui necessiti el reproductor o el seu iframe ha de fer servir **`SegueixApp.utils.playerElement()`** (`app.state.playerHost` mentre és a la finestra; ja ho fan `music-signals.js`, `drive-mode.js` i `system-player.js`). `isVideoPipOpen()` (app.js / system-player) és l'única excepció a «amb la pestanya amagada es pausa YouTube»: amb el vídeo a la finestra no es pausa res, la cua avança sola, `isPersistentPlayerActive()` és cert (navegar no atura res) i no s'obre cap finestreta ni minimització per scroll; Media Session pot reprendre/saltar. Sense la finestra (pestanya amagada, Chrome minimitzat) `app.js` envia `pauseVideo` com abans. Si el navegador bloqueja l'autoplay a la finestra nova, cal prémer play un cop. **No s'ha pogut provar amb YouTube real** (només amb el succedani d'embed). Proves: `tests/system-player.test.js`, `tests/player-controls.test.js` i opt-in `node tests/browser/verificar-finestra-sistema.js` (les rutes del succedani són del context: la finestra és una altra pàgina del navegador).

### URL de l'app i recàrrega (2026-10-05)

- L'app és a **`segueix.github.io/musica/`**: qualsevol URL que escrigui amb `pushState` / `replaceState` ha de partir de **`SegueixApp.utils.appBasePath()`** (`core/segueix-app.js`; a `app.js`, `getAppBasePath()`), **mai de `/`** (és l'arrel del domini: 404). A GitHub Pages, en reproduir, la URL és **`/musica/?v=<id>`**: la ruta llegible `/video/<slug>-<id>` només s'escriu on un servidor la serveix (`supportsReadableVideoPaths()` de `player.js`: no a `*.github.io`). `404.html` torna a l'app qualsevol adreça de `/musica/` que no existeix (`/musica/video/…` → `?v=<id>`). No hi posis rutes d'imatge o de script que comencin per `/`. Detall i rutes antigues pendents: `docs/PROBLEMES_I_SOLUCIONS.md` (2026-10-05). Proves: `tests/player-readable-url.test.js`; opt-in `node tests/browser/verificar-recarrega.js`.

### Les cançons comencen de zero (2026-10-01)

- Tocar una cançó (portada, «Continua la ràdio», historial, ràdio, llistes) la fa començar **de zero**: `resolvePlaybackOptions()` (`player.js`) ja no reprèn el progrés desat de `catube_continue_watching_v1`. Només mana un temps explícit (`?t=` d'un enllaç compartit o `startAt > 0`). La restauració de la sessió en tornar a obrir l'app (`app.js`, `playbackSeconds`) és un altre camí i es manté. Prova: `tests/continue-watching.test.js`.

### Play/pausa i controls del reproductor (2026-10-03)

- **Res damunt de l'iframe de YouTube** (les normes de YouTube no permeten elements al davant del reproductor): ni botó propi, ni capa tàctil, ni controls de la cua (`syncQueueNextOverlay()` ja no crea `.queue-next-overlay` si hi ha la barra de sota; `initQueueNextOverlay()` i el cor de sobre el vídeo estan desactivats), ni **restaurar/tancar a la finestra flotant** (eliminats el 2026-10-03: ara són `closeMiniPlayer()` / `expandMiniPlayer()`, cridats des de la barra). A la finestreta flotant d'escriptori el **mànec d'arrossegar** (`.drag-handle-container`, 36 px) i la **cantonada de canviar la mida** van en una **franja a sobre del vídeo**, mai al damunt (al mòbil no hi són). **Mida mínima de YouTube (200 × 200 px; 2026-10-05):** a l'ordinador el vídeo flotant fa com a mínim 356 × 200 px (`MINI_PLAYER_MIN_WIDTH`, també en redimensionar) i al mòbil `max(200px, 56.25vw)` d'alçada. Bloc «Finestreta flotant: normes de YouTube» al final de `portada.css`; trampes a `docs/PROBLEMES_I_SOLUCIONS.md` (2026-10-05). No hi tornis a posar res damunt de l'iframe ni la deixis fer més petita.
- Els controls de l'app són a la **barra de sota el reproductor** `#playerExternalControls` (`index.html`, dins `.watch-main` sota `#videoPlaceholder`; `initExternalPlayerControls()` a `app.js`): anterior · play/pausa · següent · finestra flotant (canvia a «restaura») · m'agrada, amb icones SVG i l'estil dels botons d'icona de l'app (rodons, `--pt-surface-2`, vora `--pt-line`, llima en passar-hi per sobre o actiu; el play/pausa és el principal, en llima). Bloc «Controls sota el reproductor» al final de `portada.css`. No hi tornis a posar símbols de text (⏮ ▶ ♡) ni el cor vermell.
- **Finestra flotant:** la barra passa a `<body>` amb `.is-docked` (moure-la no toca l'iframe), hi apareix **«tanca»** (`#playerCloseBtn`) i el botó de finestra flotant fa de **«restaura»**. Al **mòbil (≤ 768 px)** va **petita (botons de 40–44 px) enganxada sota la finestra**, damunt de la navegació inferior; la finestra puja `--pec-dock-h` (52 px). A l'**escriptori** (`.is-floating`) segueix la finestra quan s'arrossega o es redimensiona (a sobre, `.is-above`, si no hi cap a sota; `positionMiniPlayerBottomRight()` ja deixa lloc a sota). En restaurar torna al seu lloc.
- La fila de sota el títol (`.video-metadata-bar`) **ja no porta cor ni botó de finestra flotant** (`#likeToggle` i `#miniPlayerToggle` eliminats el 2026-10-03): el m'agrada i la finestra flotant són els de la barra de controls (`#playerLikeBtn`, `#playerMiniBtn`, que també obre la finestra del sistema). No els hi tornis a posar. `--pt-nav-h` es mesura de la navegació real (`shell-nav.js`, `watchBottomNavHeight()`): quan «La teva música» ocupa dues línies la navegació fa més de 60 px i tapava la finestra.
- **Ràdio o llista que sona:** no hi ha cap línia «Mode llista · Ràdio 1/40» sota el reproductor (a mòbil empenyia la fila de botons sota la navegació). És una **etiqueta petita en llima** amb icona de ràdio o de llista (`#playlistModeChip`, `.queue-mode-chip`, «Ràdio · 1/40» / «Llista · 3/12»; nom sencer al `title`) al principi de la línia de data i visualitzacions, que no es parteix mai (`updatePlaylistModeChip()` a `app.js`, final de `portada.css`). Només les TV (mode bucle) conserven `#playlistModeBadge`. El reproductor quadrat ocupa tot l'ample (l'adaptació a l'alçada de la PR #70 es va desfer).
- **Fitxa de la cançó a escriptori i tauleta (≥ 769 px):** les línies de l'esquerra (reproductor, controls, títol, canal, fila de botons) van **enganxades** (bloc «Fitxa de la cançó… menys espai entre línies» al final de `portada.css`: uns 66 px menys de marges que abans) perquè la fila de botons hi càpiga en finestres baixes, i la **cua/ràdio de la dreta ocupa 4 files** (`grid-row: 1 / span 4` a `styles.css`: reproductor, `#playerExternalControls`, títol i canal) perquè acabi al mateix nivell que els botons de sota. Si hi afegeixes una fila nova a la columna de l'esquerra, suma-la a aquest `span` i dóna-li `grid-column: 1`. Verificació opt-in: `verificar-play-pausa.js` (escriptori).
- Per reproduir/pausar des del codi (barra, Media Session, targeta «Ara sona»): `playMainPlayer()` / `pauseMainPlayer()` (ordres explícites) o `toggleMainPlayerPlayback()` (estat 1 o 3 = sona). **`playMainPlayer()` / `pauseMainPlayer()` posen de seguida `data-player-state` a 1 / 2** (`requestPlayerState()`: el botó de play/pausa canvia en tocar-lo i el toc següent fa el contrari) i l'avís real de YouTube el confirma; durant 1,5 s (`PLAYER_STATE_PENDING_MS`) un avís que contradiu l'ordre (ja era en camí) s'ignora (`applyReportedPlayerState()`). L'estat també es llegeix de `infoDelivery` / `initialDelivery` (`playerState`), i **només dels avisos de l'iframe del reproductor principal** (`event.source`): el de Shorts en envia i queda viu en pausa. Abans, si l'`onStateChange` es perdia, el botó es quedava en «pausa» i cada toc tornava a pausar. No ho tornis a fer dependre només de l'avís. Verificació opt-in: `node tests/browser/verificar-play-pausa.js` (succedani d'embed); detall i trampes a `docs/PROBLEMES_I_SOLUCIONS.md` (2026-10-01 i 2026-10-03).

### Enrere / endavant amb una ràdio (2026-10-06)

- El `popstate` d'`app.js` crida primer `restoreVideoFromHistory()`: tornar a la cançó que sona (també a la finestra flotant) la restaura, i una cançó de la ràdio/llista que sona (o de la cua que `exitPlaylistModeForNavigation()` desa a `queueBeforeNavigation` en sortir-ne al mòbil) es reprodueix dins la cua (`loadVideoInSequence({ replaceHistory: true })`). **No hi tornis a carregar el vídeo sol directament**: es perdia la ràdio i es veia la fitxa antiga amb el reproductor buit i els relacionats. Proves: `tests/player-controls.test.js`; opt-in `node tests/browser/verificar-enrere-radio.js`.

### Cua als aparells d'Apple (2026-10-07)

- A iPhone, iPad i Mac (`isAppleDevice()`), la cançó següent d'una ràdio/llista es carrega **al mateix reproductor** (`canKeepApplePlayer()` → `swapLivePlayerVideo()`, `loadVideoById`): Safari no deixa sonar un iframe nou sense un toc. Si tot i així no arrenca en 4 s, `watchAppleAutoplay()` fa parpellejar el play i mostra `#playerAutoplayHint` dins `#playerExternalControls` (mai damunt del vídeo). A la resta d'aparells no canvia res. Detall: `docs/PROBLEMES_I_SOLUCIONS.md` (2026-10-07). Prova: `tests/autoplay-apple.test.js`.

### Ràdio i llistes: sense relacionats (2026-09-30)

- Després d'una ràdio o d'una llista (qualsevol cua `.mq` visible) **no es mostren** «Altres vídeos relacionats» ni els vídeos de l'artista: a escriptori (≥ 1025 px) per a la ràdio (`styles.css`) i a mòbil/tauleta (≤ 1024 px) per a ràdio i llistes (`portada.css`). Un vídeo sol sí que els té. No hi tornis a posar cap relacionat sota la cua. Verificació opt-in: `node tests/browser/verificar-relacionats.js`.

### Compartir ràdios i llistes (2026-09-30)

- Hi ha botó de compartir (`[data-mq-share]`, icona `share-2`) a la ràdio, a la llista que sona, a les targetes de «Les teves llistes» (`.hp-share`) i a la biblioteca. Tot passa per `_shareVideoList()` (app.js) → `_showShareOptionsModal()`; les llistes es comparteixen **per ID** (`shareSegueixPlaylistById`), mai posant el nom dins d'un atribut HTML.
- Els enllaços són `SHARE_BASE_URL = 'https://segueix.github.io/musica/'` (`share-codecs.js`); payload `radio` (30 primeres cançons) o `playlist`. **No hi tornis a posar `segueix.cat`** (és Segueix youtubers).
- «Compartir» envia **només una imatge** (targeta de `js/utils/share-card.js`: icona, «Segueix!» com l'obertura, «Ràdio» / «Llista de reproducció», nom i QR), sense text ni enllaç; «Només l'enllaç» envia l'URL amb el títol «Ràdio · nom». WhatsApp sempre escriu el text d'un enllaç: no el tornis a posar a la imatge ni al `text` del missatge.
- El QR es genera a la mida en què es dibuixa i amb mòduls d'un nombre enter de píxels; mòduls foscos sobre crema, icona al mig. No el reescalis. Per sobre de `MAX_QR_URL_LENGTH` no hi ha QR.
- Les imatges que carrega `share-card.js` es resolen respecte al seu `<script>` (l'app canvia la ruta de la URL en reproduir). Verificació opt-in: `node tests/browser/verificar-compartir.js`. Detall i trampes: `docs/PROBLEMES_I_SOLUCIONS.md` (2026-09-30, «Compartir una ràdio o una llista»).

### Portada de Segueix Música (2026-09-30)

- La vista «Novetats» és **Inici** (la interfície no diu «Novetats»; l'id intern es conserva). `renderVideos()` crida `SegueixApp.features.portada.render(videosGrid, videos, { feed, all })`; si no hi és, cau a `homeSections` i a la graella.
- **Entrada de la portada** (`#portadaEntry`): dues targetes amb imatge i un sol missatge cadascuna. **«Continua escoltant»** (`#ptFeature`, la pinta `continueHtml()` de `portada.js`): la cançó que sona (`Ara sona`, `.pt-feature--now`, botó «Continua» + pausa) o, si no sona res, la darrera ràdio (`.pt-feature--resume`, `#ptResumeBtn` «Continua la ràdio»; mai sona sola), amb la caràtula gran i borrosa de fons. **«La teva ràdio»** (`#ptRadio`, HTML estàtic): collage de tres caràtules (`radioCovers()`), el botó `#ptPlayBtn` («Engega la ràdio»; «Ràdio nova» i secundari si hi ha alguna cosa per continuar) i el selector de mode. **«La teva ràdio» no «comença de zero»:** el text diu de què està feta (`discovery.tasteSummary(recentTaste())`: «Feta amb el que has escoltat aquesta setmana (14 cançons), els teus m'agrades (5) i els artistes que segueixes (3)»; finestra 7 dies → 30 → tot l'historial; m'agrades i seguits no tenen data i sempre compten) i `musicQueue.startDiscovery()` n'agafa la **primera cançó** d'aquest gust segons el mode (`recentSeedPool()`: «Els meus de sempre» → els seus artistes; «Una mica de tot» → aquests + el seu estil; «Sorprèn-me» → el seu estil d'altres artistes); la resta de la cua la fa el motor de sempre. **La PRIMERA vegada** (sense historial, m'agrades ni seguits) la targeta no té selector de mode sinó **estils per triar** (`#ptFirst`, fins a 3, «Més estils» desplega la resta) amb el missatge «Només t'ho demanem aquesta primera vegada»; es desen a `catube_first_styles` i la ràdio és d'aquells estils mentre hi hagi menys de 3 artistes coneguts (`MIN_KNOWN_ARTISTS`); després ja no es torna a demanar (`#ptFirstReset` «Canvia els estils que vas triar» els esborra). Proves de navegador: `tests/browser/gust-recent.js` (`ambGustRecent(page)`) simula un gust recent abans de prémer `#ptPlayBtn`.
- **Caràtules de «La teva ràdio» a la versió web (≥ 769 px):** les tres caràtules (`.pt-radio__covers`) són **grans i centrades en vertical** a la dreta de la targeta (que a escriptori ocupa tot l'ample): la mida creix amb l'ample de la targeta (`--pt-cover: clamp(120px, 14cqw, 215px)`, unitats de contenidor; `.pt-radio` és un contenidor) i el cos de la targeta reserva el seu espai amb `padding-right` (2,28 mides + `--pt-cover-right`), de manera que mai no es solapen amb el text ni amb els estils de la primera vegada (que passen a dues files si cal). Bloc al final de `portada.css`; al mòbil no canvia res. No hi tornis a posar `top: 16px` ni mides fixes.
- **«La teva ràdio» amb la barra lateral oberta (2026-10-03):** `#homePage.is-portada` és un contenidor (`portada-page`): per sota de 1180 px d'àrea de contingut «Continua escoltant» i la ràdio van **una sota l'altra** (la ràdio amb tot l'ample); si la targeta fa menys de 900 px les caràtules són més petites (`clamp(72px, 15cqw, 104px)`, a dalt a la dreta) i **només l'etiqueta, el títol i el text** en reserven el lloc (el botó, el selector «Quant vols descobrir?» i els estils de la primera vegada ocupen tot l'ample). Les variables `--pt-cover*` es posen a `.pt-radio__body` i `.pt-radio__covers`, no a `.pt-radio` (una consulta de contenidor no estila el propi contenidor). Bloc «La teva ràdio» amb la barra lateral oberta» de `portada.css`; no hi tornis a posar un `padding-right` fix al cos de la targeta estreta.
- **«La teva ràdio» amb la barra lateral plegada (2026-10-04):** si la targeta fa ≥ 900 px, les caràtules (fins a 190 px, `clamp(120px, 12cqw, 190px)`) tenen el centre al **75 % de l'ample** (el mig de l'espai lliure a la dreta del text) i baixen un 8 % de la seva mida; el cos reserva `25cqw + 1,14 mides + 28 px`. Bloc «La teva ràdio» amb la barra lateral plegada» de `portada.css` (selectors `body.sidebar-collapsed`); prova a `tests/barra-lateral.test.js`.
- No hi tornis a posar el títol gran «Avui, què et ve de gust?», la targeta «Novetat» ni els cercles (+/−) a Inici (són a la cua de la ràdio). Detall: `docs/PROBLEMES_I_SOLUCIONS.md` (2026-10-01, «Entrada de la portada»).
- Paleta: `#141615` fons, `#202421` superfícies, `#F4F0E8` text, `#D6ED84` accent, `#D98A70` terracota. Els valors per defecte viuen a `js/config.js` (`CONFIG.theme`) i `js/utils/storage.js` perquè `applyTheme()` posa variables **inline**; els tokens propis són a `css/portada.css` (`--pt-*`).
- Preferència de descoberta: `catube_discovery_mode` (`home` | `mix` | `surprise`). S'aplica només en engegar o regenerar la cua.
- Verificació: `npm test` (tests de descoberta, portada i recursos) i, opt-in, `node tests/browser/verificar-portada.js`.
- Trampes conegudes: veure `docs/PROBLEMES_I_SOLUCIONS.md` (2026-09-30, «Nova portada»).

### Cobertura actual

| Fitxer | Funcions testades |
|---|---|
| `helpers.js` | isMatch, getVideoDisplayDuration, buildArchiveThumbnail, getPreferredThumbnail |
| `id-codecs.js` | encode/decode per Playlist, Category, Config (roundtrip) |
| `likes.js` | normalizeLikedVideo, getLikedVideos, setLikedVideos, isLiked, getLikedVideoIds |
| `discovery.js` | mode persistit, perfil, ordenació per mode, radar, Torna-hi, Comença per aquí, estils |
| `portada.js` | model de la portada, HTML de seccions i targetes, dates honestes, escapament |
| `music-queue.js` | «La teva ràdio», canvi de mode sense interrompre, afegir a la cua, reproduir selecció, ràdio d'una cerca, desar la ràdio com a llista |
| `song-title.js` | Títols nets: marques de videoclip/oficial, artista al davant/darrere, conservador, idempotent sobre tot el feed |
| `my-music.js` | Historial (tres últimes + períodes), artistes seguits, temps relatiu en català, HTML, no-herència |
| `share-card.js` | model (Ràdio / Llista de reproducció), tall de línies, ajust de mida, QR (correcció d'errors, contrast), marca |
| `music-queue.js` (compartir) | dades que es comparteixen, botó i grup de símbols, capçalera alineada (CSS) |
| `search-results.js` | Model de cerca (artistes primer), coincidències sense soroll, HTML del menú/pàgina, dedupe, no-herència |
| `music-selection.js` | antiguitat real, estrenes, puntuació, límits d'antigues/artista/descans, duplicats, preferència per música antiga, «Torna-hi» |
| `music-signals.js` | progrés efectiu, escolta qualificada, finalització, repeticions voluntàries, salts, fusió idempotent, migració feble |
| `scripts/lib/cataleg_musical.js`, `any_original_musical.js` | catàleg incremental, pàgines profundes, any original amb evidència |
| `portada.css` / `index.html` | contrast real dels tokens, cantonades 12–16 px, mides tàctils, ordre de scripts, precache |

---

## Service Worker

`sw.js` — **dos caches amb cicles de vida separats** (substitueix el vell `mytube-vNNN` que s'incrementava a cada sync):

- **`static-<hash>`** — shell de codi: `index.html`, `styles.css`, els ~25 scripts, `manifest.json`, icones i `caratula.png`. Versionat pel **contingut real** dels assets via `scripts/actualitzar_versio_sw.js` (`npm run sw:version`), que regenera el bloc `AUTO-GENERAT` de `sw.js`. Estratègia **cache-first**: el codi només es baixa quan canvia de debò.
- **`data-v1`** — dades de runtime, **mai versionat**. `feed.json`, `hidden-videos.json` i `search_index_*` són **network-first** (frescor + fallback offline); la resta de `data/**` i `js/channels-ca.json` són **stale-while-revalidate** (es renoven soles sense invalidar res).

- **Navegació (shell HTML):** network-first amb fallback al precache.
- **Altres orígens** (CDN, fonts, YouTube): no interceptats, els gestiona el navegador.
- `feed_updates.js` està **exclòs** del cache (artefacte de build, no usat en runtime).
- **Migració/actualització:** l'`activate` esborra qualsevol cache que no sigui `static-<hash>` ni `data-v1` (migra automàticament els clients de `mytube-vNNN`). **No tornis a posar `skipWaiting()` automàtic a `install`**: una versió nova ha de quedar `waiting` mentre l'app és visible. `app.js` (`initAppUpdater`) mostra l'avís d'actualització i només activa el SW quan la pàgina passa a segon pla o quan l'usuari ho demana explícitament. Un `controllerchange` inesperat amb la pàgina visible també ajorna qualsevol `reload` fins que quedi oculta. Aquesta regla evita el bug de recàrrega mentre es toca, es fa scroll o s'engega una cançó.
- **En canviar qualsevol asset estàtic** (JS/CSS/HTML/icones): executa `npm run sw:version` per refrescar `CACHE_VERSION`. El workflow `actualitzador.yml` també ho fa com a xarxa de seguretat abans de cada commit.

---

## Dependències externes (CDN)

| Llibreria | Ús |
|---|---|
| Lucide Icons 0.563.0 | Icones SVG (via `lucide.createIcons()`) |
| Sortable.js 1.15.6 | Drag & drop de categories/playlists |
| Google Fonts (Roboto 900) | Tipografia |
| YouTube IFrame API | Reproducció de vídeos |

---

## Fitxers generats (no editar manualment)

- `feed_updates.js` — generat per `scripts/update_feed.js` (al `.gitignore`, **no trackejat**: viu al disc però fora de git)
- `img/compartir.png` — imatge de les previsualitzacions d'enllaç (1200×630), generada per `scripts/generar_imatge_compartir.js` (Playwright + Google Fonts); **sí que és versionat** i només es regenera si canvia la marca
- `data/feed.json` — generat pel pipeline de sync
- `data/recent-feed.json` — feed reduït generat pel pipeline; al `.gitignore`, **no trackejat** ni llegit per cap client (només l'usen els scripts que el generen)
- `data/support.json` — generat per `scripts/extreure_suport.js`
- `data/archive/channels/*.json` — generats pel pipeline
- `data/search_index_*.json` — generats per `scripts/generar_index_cerca.js` (mode híbrid anual/mensual)
- `data/search_index_manifest.json` — manifest generat per `scripts/generar_index_cerca.js`
- `data/music-content-overrides.json` — decisions **manuals** (no generat) sobre el `contentType` de vídeos concrets: manen sobre el classificador i `scripts/update_music_feed.js` les reaplica a cada generació. `node scripts/aplicar_revisio_manual_musical.js` les aplica al feed actual sense API. Veure `docs/MUSICA_DADES.md`.
- `data/musica-dates.json` — excepcions **manuals** (verificades) de l'any original per vídeo; `originalYear*` del feed el genera `update_music_feed.js` amb `scripts/lib/any_original_musical.js`.
- `data/music-catalog-state.json` — cursors de les pàgines profundes de `update_music_feed.js` (generat).
- `data/falsos-shorts.json` — registre de falsos Shorts generat per `scripts/revisar_shorts.js` (workflow `revisar_shorts.yml`) i reaplicat per `scripts/update_feed.js`. **Sí que és versionat**: si es perd, les correccions de `isShort` es desfan a la propera reconstrucció del feed.

---

## Riscos i precaucions

1. **No moguis `<script>` tags** d'index.html sense entendre les dependències (veure "Ordre de càrrega")
2. **app.js és monolític** (~9.400 línies) — quan modifiquis, assegura't de cercar duplicats amb grep
3. **Funció duplicada coneguda:** `hybridCategorySort()` apareix dues vegades a app.js (~línia 3621 i ~3700)
4. **`let` globals a app.js** són accessibles des de features via scope chain — no convertir a `const` dins IIFE perquè trencaria la referència
5. **Cache del SW:** si afegeixes un script nou a index.html, considera si cal afegir-lo al precache de sw.js
6. **localStorage:** les claus amb prefix `catube_` són de l'app. `user_liked_videos` és legacy i es fusiona amb `catube_liked_videos`
7. **No hi ha build step** — els fitxers JS es serveixen tal qual. Qualsevol error de sintaxi trenca l'app sencera

