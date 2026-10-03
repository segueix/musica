# Verificacions en navegador

Eines **opt-in**, cap dins de `npm test`:

| Eina | Què verifica | Quan executar-la |
|---|---|---|
| `verificar-sw.js` | Service Worker: caches, offline, migració, avís d'actualització | Després de tocar `sw.js` o `scripts/actualitzar_versio_sw.js` |
| `verificar-reproductor.js` | Reproductor al mòbil: posició en obrir el vídeo, finestreta flotant i filera d'icones del header | Després de tocar el reproductor, `updatePlayerPosition()` o el comportament del header |
| `verificar-portada.js` | Portada «La teva plaça musical»: desbordaments a 360/390/768/1440 px, zones tàctils de 44 px, música a la primera pantalla, reproductor únic en canviar de secció, mode de descoberta, teclat, moviment reduït i estat d'error | Després de tocar `portada.js`, `discovery.js`, `shell-nav.js`, `portada.css` o la capçalera/navegació |
| `verificar-cerca.js` | Cerca: menú (ràdio → artistes → vídeos), pàgina de resultats, absència d'herència de youtubers, un sol listener, ràdio de cerca (pàgina i menú) i mòbil a 390 px | Després de tocar `search-results.js`, `search.js`, `navigateToSearchResults()`, `startFromSearch()` o el CSS `search-*` |
| `verificar-la-teva-musica.js` | La teva música: ordre Historial → Artistes → Llistes, tres cançons de costat amb temps, símbol d'expandir i períodes, artistes només seguits, Artistes sense Programes, buit i mòbil a 390 px | Després de tocar `my-music.js`, `showPlaylists()`, `renderFollowPage()` o el CSS `mm-*` |
| `verificar-titols.js` | Títols nets (sense artista ni videoclip/oficial) a portada, cerca, ràdio, reproductor, historial, llistes i m'agrades desats abans; «Videoclips oficials» pel títol original; compartir amb artista | Després de tocar `song-title.js`, `decorateVideo()` o la lectura de l'historial/llistes/likes |
| `verificar-compartir.js` | Compartir ràdios i llistes: «Ràdio» alineat amb els botons a 390/820/1280/1440/1920 px, botó de compartir arreu (ràdio, llista que sona, portada, biblioteca per ID), «Compartir» envia només una imatge 1080 × 1350, «Només l'enllaç» a segueix.github.io/musica/, QR de la targeta llegit amb jsQR (ràdio i llista de 60 cançons), importació d'una ràdio compartida. `MUSICA_TEST_FONTS=1` deixa passar Google Fonts | Després de tocar `share-card.js`, `qr-share.js`, `share-codecs.js`, `_showShareOptionsModal()`, la capçalera de la ràdio (`.mq-head`) o `home-playlists.js` |
| `verificar-relacionats.js` | Després d'una ràdio o d'una llista, al mòbil (390 px) i a la tauleta (820 px), no hi ha «Altres vídeos relacionats» ni vídeos de l'artista; un vídeo sol sí; a escriptori la ràdio continua sense | Després de tocar `#watchPage`, la cua (`.mq`) o les regles `extra-related-*` / `watch-sidebar` |
| `verificar-mode-radio.js` | Mode de descoberta dins de cada ràdio: selector a la capçalera (tres opcions, ≥ 44 px, «Els meus de sempre»), canvi automàtic de la part pendent sense tocar la cançó que sona ni els afegits a mà, animació i avís de quantes cançons han canviat, sincronia amb la portada, ràdio de cerca sí / selecció no, i mòbil a 390 px | Després de tocar `setDiscoveryMode()`, `modeSelectorHtml()`, `discovery.MODES` o el CSS `mq-mode*` |
| `verificar-play-pausa.js` | Play/pausa del reproductor normal i flotant (mòbil 390 i escriptori 1280 px) amb un succedani d'embed: res damunt del vídeo (tots els tocs arriben a l'iframe), el centre queda lliure, ordres explícites (buffering inclòs), barra de controls de sota (`#playerExternalControls`): play/pausa, «següent», enganxada sota la finestra flotant (ancorada al mòbil, seguint-la a l'escriptori en arrossegar), «restaura» i «tanca»; mànec de 36 px a escriptori / ancorada sense mànec al mòbil | Després de tocar `initExternalPlayerControls()`, `closeMiniPlayer()` / `expandMiniPlayer()`, `makeDraggable()`, `toggleMainPlayerPlayback()` o el CSS `player-external-*` / `drag-handle-container` |
| `verificar-finestra-sistema.js` | Controls del sistema i finestra flotant del sistema (Document Picture-in-Picture, escriptori 1280 px, succedani d'embed): la Media Session diu què sona, «Mini reproductor» obre la finestra del sistema (amb la ràdio, la cançó i què ve després) sense moure el reproductor de la pàgina, i anterior / play-pausa / següent / «com aquesta» funcionen des de la finestra. `MUSICA_TEST_SHOTS=/ruta` en desa una captura | Després de tocar `system-player.js`, la Media Session o els botons de finestra flotant |
| `verificar-tv.js` | Experiència TV: vista ancorada al reproductor, pantalla completa mantinguda entre vídeos i TV dels programes de l'usuari | Després de tocar les TV, `focusTVPlayerViewport()`, `swapLivePlayerVideo()`, `buildProgramQueue()` o el mode llista |

Totes comparteixen requisits (`playwright-core` + un Chromium) i s'ometen amb codi
de sortida 0 si `playwright-core` no està instal·lat.

```bash
node tests/browser/verificar-reproductor.js
```

Comprova, amb viewport i user-agent d'Android, que en obrir un vídeo des del llistat el
reproductor queda alineat amb el seu forat (no tapa el títol), que la filera d'icones del
header s'amaga en obrir el vídeo i torna en fer scroll cap amunt, i que la finestreta
flotant només apareix en fer scroll cap avall.

```bash
node tests/browser/verificar-tv.js                  # mòbil
TV_TEST_DESKTOP=1 node tests/browser/verificar-tv.js  # escriptori
```

Comprova que, en engegar una TV (Segueix TV, TV de categoria o TV de canal) i a cada
canvi automàtic de vídeo, la vista salta a la part superior i s'hi manté mentre s'espera
que el vídeo nou comenci, que el reproductor no sura mai per damunt del header ni queda
en finestreta flotant, i que un gest d'scroll de l'usuari mana per damunt de l'ancoratge.

L'última part comprova que, mirant en pantalla completa, el vídeo següent hi continua
sense recrear el reproductor. Com que YouTube no es pot carregar aquí, se serveix un
succedani local a la mateixa URL d'embed que parla el mateix protocol de `postMessage`
(handshake `listening`, `onStateChange`, `loadVideoById`).

El bloc final crea un programa de prova d'un canal de categoria `mitjans` i comprova que
té botó TV (a la targeta i al perfil) i que la seva televisió s'engega amb els episodis
del programa, inclosos els de l'arxiu del canal.

---

## Verificació del Service Worker en navegador

Eina **opt-in** per verificar `sw.js` end-to-end en un Chromium real. **No** forma part
de `npm test` (Vitest): el comportament del SW —migració de caches, offline, avís
d'actualització, stale-while-revalidate— només es pot comprovar de debò en un navegador
amb l'API de service workers.

## Requisits

No són dependències del projecte (per mantenir `npm install` lleuger):

```bash
npm i -D playwright-core      # client de Playwright; NO baixa navegadors
```

A més cal un binari de Chromium. Si no és a la ubicació per defecte de Playwright,
indica'l amb la variable `CHROMIUM_PATH`.

## Ús

```bash
node tests/browser/verificar-sw.js
# o amb ubicacions personalitzades:
CHROMIUM_PATH=/ruta/al/chrome SW_TEST_PORT=8130 node tests/browser/verificar-sw.js
```

Si `playwright-core` no està instal·lat, l'script s'omet amb codi de sortida 0 (no
falla). Amb tot instal·lat, surt amb codi 0 si tot passa, o 1 si alguna comprovació falla.

## Què comprova

Arrenca un servidor estàtic local (amb hooks en memòria per simular canvis, sense
tocar cap fitxer real) i, en un context de navegador net:

1. **Visita neta** — s'instal·la el SW; existeixen `static-<hash>` i `data-v1`, i
   `data-v1` conté `feed.json`.
2. **Precache complet** — el cache estàtic conté els ~25 scripts d'`index.html`
   (garanteix que l'app arrenca offline).
3. **Offline** — amb la xarxa tallada, l'app arrenca sencera des del cache.
4. **Migració** — un cache antic (`mytube-v417`) i l'`static-<hash>` vell s'eliminen
   a l'`activate` en desplegar una versió nova.
5. **Stale-while-revalidate** — en canviar una dada al servidor, el 1r load serveix
   la versió vella (stale) i el 2n ja serveix la nova.
6. **Actualització de codi** — en canviar `CACHE_VERSION`, apareix l'avís d'actualització
   de l'app i, en acceptar-lo, hi ha **una sola** recàrrega (sense bucle).
7. **Feed** — es carrega i renderitza amb normalitat.

## Quan executar-la

Després de qualsevol canvi a `sw.js` o a `scripts/actualitzar_versio_sw.js`.

```bash
node tests/browser/verificar-portada.js
PORTADA_SHOTS=/ruta/captures node tests/browser/verificar-portada.js   # desa una captura per amplada i estat
```

Comprova la portada amb i sense historial a 360, 390, 768 i 1440 px (seccions, cap desplaçament
lateral de la pàgina, controls tàctils de 44 × 44 px, música visible a la primera pantalla, navegació
inferior només a mòbil, res sona en carregar) i un recorregut complet a escriptori i mòbil: «Fes-la
sonar» engega una ràdio, hi ha un sol reproductor i canviar de secció no el recrea, canviar el mode no
interromp la cançó, «Afegeix a la cua» respecta l'ordre, en acabar una cançó continua la següent.
També verifica el teclat, el moviment reduït i l'estat d'error amb «Torna-ho a provar». Les peticions
externes s'avorten: no cal xarxa.
