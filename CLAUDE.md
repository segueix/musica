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
│   ├── shell-nav.js         # Navegació lateral/inferior i avisos breus (toast)
│   ├── music-selection.js   # Motor de selecció musical compartit (funcions pures): antiguitat real, puntuació, restriccions
│   ├── music-signals.js     # Observador únic d'escolta, estadístiques i preferències («(+) com aquesta (−)»)
│   ├── music-queue.js       # Ràdio/cua: motor de selecció, mode de descoberta, «Afegeix a la cua», reproduir una selecció
│   └── home-playlists.js    # «Les teves llistes» de la portada
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
- A la capçalera de la ràdio, **«Barreja» és només un símbol** (`.mq-shuffle[data-mq-regenerate]`, amb `aria-label`) dins el grup `.mq-tools`, junt amb «+», desar i compartir: no hi tornis a posar la paraula ni el botó fora del grup (a mòbil quedava una fila amb només «Barreja»). Al capçal només queda «Obre a YouTube».
- Una cançó de l'historial **ja no** queda exclosa de la ràdio (tornen amb descans de 12 cançons i 60 min). Novetats i les categories continuen ocultant-les.
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

### Revisar cançons en castellà (2026-10-01)

**Prompt per a l'agent — quan et demanin «revisa el castellà», «elimina cançons en castellà» o similar (d'un artista, d'una categoria o de tot el feed):**

1. **Llegeix sempre `docs/ARTISTES_CASTELLA.md`** abans de res: és la llista d'artistes a qui ja hem amagat cançons en castellà o basc i on és més probable que en surtin de noves. Repassa'ls **tots**, encara que només et demanin una categoria, amb `node scripts/revisar_castella_vigilats.js [--since=AAAA-MM-DD] [--artista="Nom"]`.
2. Després repassa l'abast que t'hagin demanat (artista/categoria). Criteri: s'amaga només el que és **100 % en castellà o basc** (el títol i, si dubtes, la lletra/descripció; `defaultAudioLanguage` no és fiable). Es conserva el català, el mixt i els títols compartits.
3. Amaga amb una regla per canal a `REGLES` de `scripts/ocultar_titols_castella.js` (la clau és el `channelTitle` exacte) i `node scripts/ocultar_titols_castella.js`; per a casos puntuals (Short, àlbum…) afegeix l'ID a `data/hidden-videos.json`. No toquis `feed.json`.
4. **Actualitza `docs/ARTISTES_CASTELLA.md`**: artistes nous, recomptes, notes i la data de «Última revisió», i afegeix l'entrada a `docs/PROBLEMES_I_SOLUCIONS.md`. Si un artista apareix a la llista per primera vegada, afegeix-lo amb la primera columna `**Nom exacte al feed**`.
5. Digues a l'usuari quines cançons has amagat i quines dubtoses has deixat.

### Revisió d'artistes: noms i categories (2026-10-01)

- `revisio-artistes.html` (pàgina estàtica, sense token) deixa editar el **nom que es veu a l'app** i les **categories** dels artistes ben indexats (canal de YouTube assignat, no rebutjats) i marcar-los **OK**; baixa un document `revisio-artistes-AAAA-MM-DD.json`. **Quan l'usuari et passi aquest fitxer:** `node scripts/aplicar_revisio_artistes.js <fitxer> --dry-run`, ensenya-li què canviarà i, si ho confirma o ho demana, executa'l sense `--dry-run` i `node scripts/validar_artistes_musica.js`. La lògica és a `js/revisio-artistes.js` (`applyExport()`).
- **El nom editat és `displayName`** de l'artista a `data/artistes-musica.json` (no `name`, que és el de la base d'artistes). El client el posa a `channelTitle`/`channel.name` a `music-categories.js` (`cleanVideoTitle`, `decorateChannel`, `displayNameForChannel`) i a `YouTubeAPI.withDisplayName()`; el nom de YouTube queda a `originalChannelTitle`/`originalName`. **`feed.json` i els scripts continuen duent el nom de YouTube** (`channelTitle` exacte per a `REGLES` de `ocultar_titols_castella.js` i `docs/ARTISTES_CASTELLA.md`): no hi posis `displayName`. Les categories editades es marquen `genre:manual`. Detall: `docs/MUSICA_DADES.md` («Revisió de noms i categories»).

### Contacte i suggeriment d'artistes (2026-10-01)

- `#addYoutuberModal` («Suggereix un artista», botó `#addYoutuberBtn` amb icona de nota musical amb «+») porta, amb l'estil de `portada.css` (`.pt-contact*`): **formulari** (`#addYoutuberSubmitBtn` → `CONFIG.forms.suggestYoutuberUrl`), **Telegram** (`t.me/segueix`), **correu** (`info.segueix@gmail.com`), «Informació per a artistes» i els crèdits. No hi tornis a posar el vídeo de YouTube «Coneix-nos» ni Xiuxiuejar (eliminats, com les seves imatges). **Pendent:** `suggestYoutuberUrl` encara és el formulari antic de Segueix youtubers; cal substituir-lo pel nou (per grups de música). Prova: `tests/contacte.test.js`.

### Les cançons comencen de zero (2026-10-01)

- Tocar una cançó (portada, «Continua la ràdio», historial, ràdio, llistes) la fa començar **de zero**: `resolvePlaybackOptions()` (`player.js`) ja no reprèn el progrés desat de `catube_continue_watching_v1`. Només mana un temps explícit (`?t=` d'un enllaç compartit o `startAt > 0`). La restauració de la sessió en tornar a obrir l'app (`app.js`, `playbackSeconds`) és un altre camí i es manté. Prova: `tests/continue-watching.test.js`.

### Play/pausa del reproductor (2026-10-01)

- El play/pausa és **el del reproductor de YouTube**: no hi ha botó propi (`.queue-toggle-button` eliminat) ni cap capa que cobreixi el vídeo. Sobre l'iframe només hi ha anterior · següent · finestra flotant (`.queue-controls`, amb el centre lliure) i, a la finestreta flotant, un **mànec d'arrossegar de 36 px a dalt** (`.drag-handle-container`; al mòbil no hi és). **No tornis a posar capes sobre l'iframe** per detectar tocs ni per fer de botó: es mengen els tocs. Per detectar un toc en tàctil es fa servir el `blur` de la finestra (`initQueueNextOverlay`).
- Per reproduir/pausar des del codi (Media Session, targeta «Ara sona»): `playMainPlayer()` / `pauseMainPlayer()` (ordres explícites) o `toggleMainPlayerPlayback()` (estat 1 o 3 = sona). Verificació opt-in: `node tests/browser/verificar-play-pausa.js` (succedani d'embed); detall i trampes a `docs/PROBLEMES_I_SOLUCIONS.md` (2026-10-01).

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
- **Migració/actualització:** l'`activate` esborra qualsevol cache que no sigui `static-<hash>` ni `data-v1` (migra automàticament els clients de `mytube-vNNN`). `install` crida `skipWaiting()` **només si ja hi ha un SW actiu** (`self.registration.active`): així una actualització arriba també a les pestanyes velles (2026-09-29); a la primera instal·lació NO s'omet l'espera (bug de refresc, `docs/PROBLEMES_I_SOLUCIONS.md`, 2026-04-14). `app.js` (`initAppUpdater`) només recarrega si ja hi havia controller, i ajorna la recàrrega mentre sona un vídeo.
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
