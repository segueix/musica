# Refactorització `js/app.js` — Fase 2 (estat final honest)

## 1) Objectiu de fase 2 (recordatori)
Consolidar de forma **progressiva, reversible i conservadora**:
- estat compartit cap a `SegueixApp.state`,
- referències de DOM cap a `SegueixApp.dom`,
- responsabilitats funcionals cap a APIs de `SegueixApp.features.*`,

sense canviar UX visible, textos, claus de persistència ni contractes públics existents.

---

## 2) Què s'ha migrat realment a fase 2

### 2.1 Infra core
- `js/core/segueix-app.js`: namespace global.
- `js/core/state.js`: seccions base d'estat (`navigation`, `feed`, `channel`, `playlists`, `history`, `search`, `player`, `shorts`).
- `js/core/dom-registry.js`: `SegueixApp.dom.init()` idempotent amb registre de refs de shell/pàgines.

### 2.2 Capa de feature APIs
S'han creat APIs explícites a `SegueixApp.features.*` per dominis:
- `navigation`
- `library`
- `feed`
- `search`
- `channel`
- `player`
- `shorts`
- `support`
- `sharedPlaylists`
- `configSync`

### 2.3 Wiring i compatibilitat
- `index.html` carrega core+features abans d'`app.js`.
- `app.js` registra hooks via `configureFeatureRuntimes()`.
- les funcions públiques principals d'`app.js` deleguen a features.
- les implementacions actuals de comportament es mantenen majoritàriament com `*LegacyImpl`.

### 2.4 Estat reflectit
S'han ampliat proxys a `SegueixApp.state` (a més dels inicials), incloent camps de:
- feed (`currentData`, `renderer`),
- channel (`currentVideos`),
- search (`activeIndex`, `archiveIndexCache`),
- shorts (`currentShortIndex`, `currentShortsQueue`, `isNavigatingShort`, `shortModalScrollY`).

---

## 3) Què NO s'ha migrat (i per què)

No s'ha completat la migració física de lògica fora d'`app.js` en els dominis més sensibles:
- watch/player/mini-player,
- shorts,
- part de feed/search/channel,
- suport econòmic.

Motiu:
- aquestes peces tenen acoblament transversal alt (navegació, popstate, watch layout, cues, postMessage, modal/history state) i la fase 2 ha prioritzat estabilitat i reversibilitat.

En conseqüència, el patró dominant és **API modular + implementació legacy injectada per hooks**.

---

## 4) Contractes globals que continuen vius
Encara hi ha contractes globals actius i necessaris:
- funcions globals d'`app.js` invocables des d'HTML inline o fluxos antics,
- globals d'estat/DOM històrics dins `app.js`,
- `SupportModule` com a wrapper de compatibilitat,
- dependències temporals de `shared-playlists` sobre alguns helpers globals (`createVideoCardAPI`, `showVideoFromAPI`, `refreshIcons`, etc.).

Aquests contractes no s'han retirat per evitar regressions.

---

## 5) Riscos residuals (no amagats)
- Divergència potencial entre globals legacy i estat modular si els proxys no cobreixen futurs camps nous.
- Acoblament intern encara alt en `app.js` per volum de `*LegacyImpl`.
- Dependències implícites en fluxos de watch/player/shorts i suport.
- La retirada prematura de wrappers globals trencaria contractes antics.

---

## 6) Criteri de tancament de fase 2: veredicte honest

### Completa al 100%?
**No, no al 100%** en el sentit estricte de “`app.js` principalment bootstrap + wiring + compatibilitat” amb lògica funcional ja fora.

### Completa en mode conservador?
**Sí, substancialment completada** com a fase d'infra i encapsulació reversible:
- estructura `state`/`dom` consolidada,
- APIs per dominis creades,
- contracte de delegació establert,
- compatibilitat preservada.

Interpretació recomanada: fase 2 **quasi tancada** (infra + contractes), però amb deute tècnic explícit pendent de fase 3.

---

## 7) Possible fase 3 (sense executar-la ara)
1. Migració física gradual de `*LegacyImpl` cap als fitxers `js/features/*` corresponents.
2. Reducció controlada de wrappers globals només on no hi hagi crides externes.
3. Eliminació progressiva de globals duplicats un cop verificat l'ús exclusiu de `SegueixApp.state/dom`.
4. Consolidació final d'`app.js` com a bootstrap/wiring/compatibilitat mínima.
5. Només després d'això, valorar modularització més profunda (si escau).
