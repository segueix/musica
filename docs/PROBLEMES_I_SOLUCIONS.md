# Base de Coneixement i Resolució de Problemes

> ATENCIÓ IA: Abans de proposar una solució a un nou bug, revisa les entrades d'aquest document per si hi ha patrons de fallada similars (especialment amb la memòria cau o la UI). Quan resolguis un problema complex, tens l'obligació d'afegir una nova entrada aquí seguint la plantilla.

## Plantilla d'entrada

## [Data] - [Títol breu del problema]
**Símptoma:**

**Causa Arrel:**

**Solució Implementada:**

**Fitxers Afectats:**

## [2026-10-01] - Filera lateral dels Shorts amb la mateixa resposta que el desplaçament vertical

**Símptoma:** El desplaçament horitzontal de les miniatures (fila de Shorts i historial) semblava més lent que el vertical.

**Causa Arrel:** Les dues files tenien `scroll-snap-type: x mandatory`: en deixar anar el gest el navegador havia d'acabar en un punt d'encaix obligatori. Aquest ajust final podia afegir una frenada perceptible.

**Solució Implementada:** Les dues files passen a `x proximity`, perquè l'encaix només s'apliqui prop d'una targeta; es manté el desplaçament natiu amb inèrcia i `scroll-behavior: auto`, sense interpolació de JavaScript. `overscroll-behavior-x: contain` evita que el moviment lateral es propagui fora de la fila. Els gestos verticals continuen movent la pàgina. El visor vertical i el seu reproductor no canvien.

**Validació:** `tests/browser/verificar-shorts-lateral.js` amb Chromium, gestos tàctils CDP, viewport 390×844, fila de Shorts i historial, moviment normal i reduït: els quatre casos donen 85 px laterals i 85 px verticals per al mateix recorregut de 100 px del dit; mantenen inèrcia, límits, independència dels eixos i clics (un arrossegament no obre una miniatura). És una verificació amb emulació mòbil, sense mesurar un telèfon físic.

**Fitxers Afectats:** `css/styles.css`, `tests/browser/verificar-shorts-lateral.js`, `sw.js` (hash regenerat amb `npm run sw:version`) i aquest document.

## [2026-10-01] - Desplaçament més fluid dels Shorts al mòbil

**Causa:** Cada `touchmove` escrivia directament al panell. Els gestos molt ràpids sense `touchmove` passaven per una navegació discreta amb bloqueig de 800 ms. Les animacions de retorn i de canvi deixaven temporitzadors vius: després de tancar/reobrir el visor o començar un altre gest, un callback anterior podia moure el panell o canviar l'índex. Els gestos horitzontals sense `touchmove` podien navegar.

**Solució:** `shorts.js` agrupa les posicions amb `requestAnimationFrame`, memoritza l'alçada al començament del gest i usa `translate3d`. En deixar anar, anul·la el frame pendent abans de l'aterratge; la distància i la velocitat recent decideixen el canvi i una durada de 120–240 ms. La roda i els gestos sense `touchmove` passen per la mateixa navegació animada, sense l'espera fixa de 800 ms. Hi ha un únic controlador cancel·lable d'animació (listener i temporitzador), netejat en tancar el visor; el destapat no afegeix 120 ms quan el vídeo ja sona. Es manté un sol iframe reutilitzat, amb `loadVideoById` dins del gest, el consentiment, la pausa per toc, el guard del ratolí emulat i la continuació de llistes mixtes. Els senyals de reproducció només es prenen de l'iframe dels Shorts.

**Validació:** `tests/shorts-scroll.test.js`: 13 proves de comportament; amb `shorts-polish.test.js`, 16 proves passen. `tests/browser/verificar-shorts-scroll.js`: Chromium amb gestos tàctils via CDP, viewport 390×844, animacions normals i moviment reduït; seguiment del dit, dos canvis consecutius, cancel·lació, pausa i reobertura passen sense errors de JavaScript. La prova usa un succedani de YouTube i no mesura el buffering de la xarxa ni el rendiment d'un telèfon físic. ESLint de `shorts.js`: cap error ni avís. La bateria general i el lint global continuen trobant errors previs en altres mòduls, reproduïts amb el codi original (incloent tests que exigeixen versions antigues fixes del service worker).

**Fitxers:** `js/features/shorts.js`, `css/styles.css`, `sw.js` (hash regenerat amb `npm run sw:version`), les dues proves noves i aquest document.

## [2026-10-01] - El play/pausa del reproductor (normal i flotant) sovint no reaccionava

**Símptoma:** Tocar o clicar per pausar/reprendre el vídeo, al reproductor gran i a la finestra flotant, sovint no feia res.

**Causa Arrel (reproduïda amb un succedani de l'embed, `tests/browser/verificar-play-pausa.js`):** (1) **Normal, tàctil:** `.queue-next-touch-layer` cobria tot el vídeo quan els controls eren amagats (`pointer-events: auto` a `(hover: none)`/`(pointer: coarse)`) i es menjava el primer toc (mostrava els controls i res més): el toc mai arribava al reproductor de YouTube. (2) **Botó propi** (`.queue-toggle-button`): decidia entre `playVideo` i `pauseVideo` segons `data-player-state`, que només s'actualitza amb `onStateChange` i pot ser `''` (després de canviar de vídeo), `3` (buffering) o desfasat: amb estat 3 enviava `playVideo` a un vídeo que ja volia sonar i «no passava res». A més, només existia si la cua tenia anterior/següent, i a la finestreta flotant feia 28–38 px. (3) **Flotant:** `.drag-surface` cobria tot el vídeo (menys un quadrant) i l'app **emulava** el play/pausa amb un toc (< 10 px i < 300 ms a escriptori; un `click` al mòbil): un toc una mica llarg o amb un tremolor ja no es comptava, i la barra de YouTube i el seu botó de pausa eren inaccessibles.

**Solució Implementada:** el play/pausa és **el del reproductor de YouTube** i res no el cobreix. `createQueueNextOverlay()` ja només té anterior, següent i finestra flotant (`.queue-controls` deixa el centre lliure per al botó de YouTube); fora `.queue-toggle-button`, `.queue-next-touch-layer` i `updateQueueToggleIcon`. **Finestra flotant:** la capa d'arrossegament és un mànec de 36 px a dalt (`.drag-handle-container`); la resta del vídeo rep tots els tocs. Al mòbil (≤ 768 px, ancorada a baix) no hi ha mànec i la barra de dalt (restaurar/tancar) és sempre visible (degradat, no enfosqueix el vídeo); restaurar/tancar tenen 44 px mínims i el tancar ja no depèn de Lucide. `makeDraggable()` només arrossega. **Controls de la cua en tàctil:** un toc al vídeo no arriba a la pàgina (iframe d'un altre origen), però en prendre-li el focus la finestra dispara `blur`: `initQueueNextOverlay()` mostra els controls 3 s i torna el focus a la pàgina (`window.focus(); iframe.blur()`) perquè el toc següent també es detecti; només amb `(pointer: coarse)` (a escriptori hi ha el ratolí i no es toca el focus, perquè l'espai de YouTube continuï pausant). **Ordres:** `playMainPlayer()` / `pauseMainPlayer()` (`sendMainPlayerCommand`) i `isMainPlayerPlaying()` (estat 1 **o 3**); la Media Session (pantalla de bloqueig) i `toggleMainPlayerPlayback()` (targeta «Ara sona» de la portada) les fan servir.

**Trampes conegudes:** (1) Qualsevol capa sobre un `<iframe>` de YouTube (per detectar tocs, arrossegar o fer de botó) es menja els tocs: si cal detectar-los sense cobrir el vídeo, fes servir el focus (`blur`) i no tornis a posar capes. (2) La detecció per `blur` s'ha comprovat en Chromium (tàctil i ratolí); en iOS Safari no s'ha pogut provar: si no es dispara, els controls de la cua surten igualment en pausa i uns segons després d'un canvi d'estat. (3) A la finestreta flotant d'escriptori ja no es pot arrossegar des del mig del vídeo: només pel mànec de dalt. (4) No es poden provar els tocs sobre l'embed real de YouTube des d'aquí: la verificació usa un succedani local.

**Fitxers Afectats:** `js/app.js`, `js/features/music-queue.js`, `css/styles.css`, `css/portada.css`, `sw.js`, `tests/player-controls.test.js`, `tests/browser/verificar-play-pausa.js`, `tests/browser/verificar-seleccio.js`.

## [2026-10-01] - Mode de descoberta dins de cada ràdio (i «A casa» passa a «Els meus de sempre»)

**Petició:** una expressió més personal que «A casa» i el selector del mode a cada ràdio, amb un canvi automàtic i visible de la llista.

**Solució Implementada:** `discovery.js` (`MODES`), `index.html` i els tests passen a «Els meus de sempre» (id intern `home`). `music-queue.js`: `modeSelectorHtml()` (radiogroup de tres botons dins `.mq-head`, `order: 5`), `setDiscoveryMode(mode)` (desa el mode, torna a fer `regenerate()` sense tocar la cançó que sona ni els afegits a mà, compta les cançons noves i en posa l'avís a `.mq-mode__hint`), `getAppliedMode()` i `radioMeta.requested` com a font del que marca el selector. CSS a `css/portada.css` (`.mq-mode*`, animació `mq-renew` amb `--i` per cançó). Proves: `tests/music-queue-selection.test.js` (mode dins de cada ràdio), `tests/music-queue-share.test.js` (CSS) i `tests/browser/verificar-mode-radio.js`.

**Trampes conegudes:** (1) `radioLabel` també porta el nom d'una ràdio de cerca (`Cerca «…»`): per distingir una selecció de debò cal mirar `searchRadio`. (2) El selector no ha de dir el mode global (el de la portada s'aplica a la ràdio següent): mostra `radioMeta.requested`, que els recàlculs silenciosos (cor, seguiment, ±) tornen a posar al mode global. (3) L'avís es posa directament al DOM després de `regenerate()` (`lastContainer`) perquè el nombre de cançons noves no es coneix fins que la cua s'ha tornat a triar; `render()` el torna a pintar si és vigent. (4) L'efecte del mode és suau (vegeu `docs/MUSICA_SELECCIO.md`): no s'ha tocat cap pes del motor. (5) Aquesta peça substitueix l'acord anterior de no mostrar el mode a la capçalera: el que no s'ha de tornar a posar és el text del mode enganxat al nom de la ràdio.

**Fitxers Afectats:** `js/features/discovery.js`, `js/features/music-queue.js`, `css/portada.css`, `index.html`, `sw.js`, tests, `CLAUDE.md`, `docs/MUSICA_SELECCIO.md`.

## [2026-10-01] - Artista nusar3000 eliminat

**Símptoma/Petició:** Treure l'artista nusar3000 (canal `UCEK-KX24tmXR1bDCfhE_hgw`, 14 vídeos al feed) de Segueix Música.

**Solució Implementada:** Com amb MARLENA (2026-09-29): a `data/artistes-musica.json` queda `rebutjat` (`active: false`, sense canals, nota «No tornar a resoldre @nusar3000»); fora de `data/youtube-verified-handles.json` (si no, el resolutor el tornaria a afegir); els 14 vídeos a `data/hidden-videos.json` (també filtra `update_music_feed.js`); la regla de títols en castellà de `scripts/ocultar_titols_castella.js` ja no cal. A més, perquè desaparegui de seguida i no calgui esperar el bot, el canal i els seus vídeos s'han tret directament de `data/feed.json` i `js/channels-ca.json` (el mateix resultat que donarà la propera generació; hi ha precedent al commit del canal «Subliminal»). Les auditories (`music-feed-audit.json`, `music-content-audit.json`, `music-content-review.json`) s'han ajustat a mà restant-hi els 14 vídeos (12 cançons, 1 àlbum, 1 revisió, 5 Shorts) perquè continuïn coherents amb el feed (`tests/music-content-overrides.test.js` ho comprova); els números exactes es refresquen amb la propera generació.

**Per tornar-lo a afegir:** canvia'n l'`reviewStatus`, torna a posar el canal a `youtube.channels` i a `youtube-verified-handles.json`, i treu-ne els IDs de `hidden-videos.json`.

**Fitxers Afectats:** `data/artistes-musica.json`, `data/youtube-verified-handles.json`, `data/hidden-videos.json`, `data/feed.json`, `js/channels-ca.json`, `data/music-*-audit.json`, `data/music-content-review.json`, `scripts/ocultar_titols_castella.js`.

## [2026-10-01] - El botó «Barreja» de la ràdio deixava una fila amb només «Barreja»

**Símptoma:** A la capçalera de la ràdio, el botó amb text «Barreja» (i «Obre a YouTube») s'embolcallava segons l'ample i, en alguns casos, quedava sol a una fila.

**Causa Arrel:** Eren dos botons de text de 99–190 px a la fila del títol, fora del grup de símbols del nom; amb poc espai (mòbil estret, columna lateral d'escriptori) un dels dos queia a la fila següent.

**Solució Implementada:** «Barreja» passa a ser només el símbol de barrejar (`.mq-shuffle[data-mq-regenerate]`, 44 px, amb `aria-label` i `title` «Barreja la ràdio: genera’n una de nova») dins `.mq-tools`, entre el «+» i el desar com a llista (`regenerateButtonHtml()`); només les ràdios el porten (una llista no es pot regenerar). Al capçal només queda «Obre a YouTube». Espais del grup de 8 a 6 px i xip amb 12 px de padding perquè xip + 4 símbols càpiguen a 390–393 px en una sola fila (a 360 px els símbols passen sencers a la fila de sota). Proves: `tests/music-queue-share.test.js` i `tests/browser/verificar-compartir.js`.

**Fitxers Afectats:** `js/features/music-queue.js`, `css/portada.css`, `sw.js`, `CLAUDE.md`, tests.

## [2026-10-01] - Cançons de Serrat en castellà que quedaven al feed

**Símptoma:** Al feed de Joan Manuel Serrat hi havia contingut en castellà: «Tarres (Actuación TVE)» (cançó), «Mediterráneo» (Short del 1975) i l'àlbum «Mediterráneo (ÁLBUM COMPLETO)».

**Causa Arrel:** «Tarres» va entrar al feed després de l'última passada d'`ocultar_titols_castella.js`; el Short i l'àlbum no són `song`/`live_song`, així que la regla per títols no els mira. A més, la regla `totes` de Serrat (excepte «Per al Meu Amic») hauria amagat «Paraules D'Amor», que és en català.

**Solució Implementada:** s'han revisat els 6 vídeos del feed de Serrat (el criteri és la lletra, no `defaultAudioLanguage`: «Paraules D'Amor» hi consta com a `es` i és en català). S'han afegit a `data/hidden-videos.json` `gd0MONP5lGs` (Tarres), `jo2_CypYeC0` (Short) i `-0pnXAl1Pko` (àlbum). Es conserven «Per al Meu Amic» i «Paraules D'Amor» (català) i el directe de VEVO (no és una cançó). L'excepció de la regla de Serrat inclou ara «Paraules d'Amor».

**Fitxers Afectats:** `data/hidden-videos.json`, `scripts/ocultar_titols_castella.js`, `tests/ocultar-titols-castella.test.js`.

---

## [2026-10-01] - Cançons que ofereixen subtítols en castellà al feed

**Símptoma:** Hi havia cançons que oferien subtítols en castellà/espanyol (Pau Vallvé, ZOO Posse, Xavi Sarrià, Dàmaris Gelabert, Kitsch…) i es volien fora del feed, també les que s'afegeixin més endavant.

**Causa Arrel:** No hi havia cap filtre per subtítols. A més, **no es poden llegir les pistes reals de subtítols de YouTube**: `captions.list` de l'API de dades només funciona amb OAuth del propietari, `contentDetails.caption` només diu si n'hi ha (cap idioma concret), `/api/timedtext?type=list` torna buit i la pàgina del vídeo respon HTTP 429 («google.com/sorry») des d'un servidor.

**Solució Implementada:** Detecció per **declaració** al títol o a la descripció (`scripts/lib/subtitols_castella.js`, `declaracio(video)` / `teSubtitolsCastella(video)`): una paraula de subtítols (subtítols, subtítulos, subtitles, untertitel, sous-titres, `sub`…) amb «castellà / castellano / español / espanyol / spanish» a la mateixa frase (fins a 90 caràcters, sense salt de línia), l'ordre invers («Spanish subtitles») o l'abreviatura enganxada a «sub» («SUB CAST», «Subs: ESP»). No compten els crèdits («Subtítols: Maria Puig»), les sales («CC Delicias»), «Castellers», «subscriu-te», «Subtítols disponibles en català i anglès» ni les negacions («sense subtítols en castellà», «without Spanish subtitles»). **Diari:** `update_music_feed.js` descarta aquests vídeos cada vegada que genera el feed (el workflow «Actualitzar feed musical» corre cada dia a les 08:37 UTC, i també si canvia el detector), així que les cançons noves hi queden filtrades sense cap llista manual. **Immediat:** `node scripts/ocultar_subtitols_castella.js [--dry-run]` (idempotent) afegeix els IDs del feed actual a `data/hidden-videos.json`, que el client aplica de seguida; s'hi van afegir 10 cançons (Lzh5bAoDJ4M, 0Q_6oFahpos, ckY7cq-XZNc, EnwWgoIM3Xc, f7dytPY8TNQ, 3AZq1c3Ub6g, -ISx80tGzgg, znBeuIqLOP8, kVbKTsaGNpo, misomiLbq6s). Proves: `tests/subtitols-castella.test.js`.

**Trampes conegudes:** (1) **Només detecta el que el vídeo declara**: una cançó que tingui pista de subtítols en castellà (manual o traduïda) sense dir-ho a la descripció no es detecta. Si cal més cobertura, la via fiable seria una llista manual per canal (com `ocultar_titols_castella.js`) o OAuth. (2) Els IDs de `hidden-videos.json` no es tornen a mostrar encara que l'artista canviï la descripció; per recuperar-ne una, treu-la d'aquest fitxer **i** corregeix la regla si és un fals positiu. (3) S'aplica a tot el feed musical, no només a `contentType: song` (n'hi havia una de `other`: una BSO). (4) Les cançons ja desades a l'historial, les llistes o els m'agrades d'un usuari no s'esborren d'allà.

**Fitxers Afectats:** `scripts/lib/subtitols_castella.js` (nou), `scripts/ocultar_subtitols_castella.js` (nou), `scripts/update_music_feed.js`, `data/hidden-videos.json`, `.github/workflows/actualitzar-feed-musica.yml`, `tests/subtitols-castella.test.js`, `CLAUDE.md`.

## [2026-09-30] - Al mòbil, després d'una ràdio o d'una llista sortien «Altres vídeos relacionats» (9.700 px de graella)

**Símptoma:** Al mòbil, sota la cua d'una ràdio o d'una llista hi havia «Altres vídeos relacionats» i una graella de 33 vídeos de l'artista (la pàgina feia 13.400 px), que es perdia en comptes d'acabar a l'última cançó.

**Causa Arrel:** L'amagada dels relacionats només existia a escriptori (`@media (min-width: 1025px)` de `styles.css`, només per a `.mq--radio`): el mòbil i la tauleta no tenien cap regla, i una llista en reproducció tampoc.

**Solució Implementada:** A `css/portada.css`, `@media (max-width: 1024px)`: `#watchPage:has(#playlistQueueContainer:not(.hidden) .mq)` amaga `.watch-sidebar`, `.extra-related-header`, `.extra-related-title` i `.extra-videos-grid`. `.mq` és la cua d'una ràdio **o** d'una llista (la TV té el seu panell i no pinta `.mq`), i `.hidden` fa que un vídeo sol (en sortir de la cua) recuperi els relacionats. A escriptori no s'ha tocat res. Prova: `tests/browser/verificar-relacionats.js` (390 i 820 px: ràdio, llista i vídeo sol; 1440 px: ràdio).

**Trampes conegudes:** (1) El mini-reproductor afegeix `56.25vw` de `padding-bottom` al `body` només quan s'activa (en fer scroll): una prova que baixi fins al final ha de tornar a baixar després d'activar-lo. (2) Els vídeos de l'artista continuen carregant-se al DOM (només s'amaguen); si mai pesa, no els pintis quan hi ha cua.

**Fitxers Afectats:** `css/portada.css`, `sw.js`, `tests/music-queue-share.test.js`, `tests/browser/verificar-relacionats.js`, `tests/browser/README.md`.

## [2026-09-30] - Compartir una ràdio o una llista: capçalera descompensada, QR de Segueix youtubers i enllaços a segueix.cat

**Símptoma:** (1) A la capçalera de la ràdio, «Ràdio» quedava centrat verticalment respecte a un grup «xip + «+» + desar» que s'embolcallava en dues files (en la columna lateral d'escriptori el nom s'aclaparava fins a 77 px i els símbols quedaven apilats). (2) Només les targetes de la biblioteca es podien compartir; ni la ràdio ni la llista que sona ni les targetes de la portada. (3) El QR era el de Segueix youtubers (fons blau fosc, «SEGUEIX» blanc i «!» vermell, logo antic) i els enllaços apuntaven a `segueix.cat`, que obre l'app de youtubers. (4) Compartir per WhatsApp enviava només un enllaç llarg.

**Causa Arrel:** (1) `.mq-head` centrava verticalment (`align-items: center`) i només passava el nom a una fila pròpia amb `@media (max-width: 768px)`, que mesura el viewport, no el panell: a 820–1440 px la ràdio viu en una columna estreta. (2) El botó existia només a `renderPlaylistsPage()` i cridava `shareSegueixPlaylist('<nom>')` amb el nom dins un atribut (un apòstrof al nom el trencava). (3) `SHARE_BASE_URL = 'https://segueix.cat/'` i `qr-share.js` heretats. (4) Un enllaç `?importData=` només pot mostrar al previsualitzador el que hi ha a l'HTML estàtic; a `segueix.github.io/musica/` no hi ha servidor que hi posi el nom, i **WhatsApp sempre escriu el text de l'enllaç** a la bombolla.

**Solució Implementada:** **Capçalera:** el panell és un contenidor (`.mq { container: mq / inline-size }`); títol, botons i nom s'alineen a la primera fila (`align-items: flex-start` + `line-height: 44px` al títol) i, amb menys de 640 px de panell (`@container mq`), el nom passa sencer a la fila de sota. Els símbols van dins `.mq-tools` (inline-flex, `flex: none`): mai un de sol a la fila de sota. Una llista en reproducció es titula «Llista» (no «Ràdio»). **Botó de compartir** (`[data-mq-share]`, mateixa icona `share-2`) a la ràdio, a la llista que sona (només si és una llista real de la biblioteca), a les targetes de «Les teves llistes» (`.hp-item` > `.hp-share`, fora del botó de reproduir) i a la biblioteca (ara per ID: `shareSegueixPlaylistById`). `musicQueue.getShareData()` dóna `{ type, name, ids, playlistId }`; app.js: `shareSegueixRadio()`, `_shareVideoList(type, name, items)`. **Enllaç:** `SHARE_BASE_URL = 'https://segueix.github.io/musica/'`; tipus de payload nou `radio` (una ràdio s'obre amb «Escolta-la» i sona tal com la van enviar; en comparteix les 30 primeres, `MAX_RADIO_SHARE_SONGS`). **Targeta** (`js/utils/share-card.js`, nou; UMD): imatge 1080 × 1350 amb la icona de Segueix Música, «SEGUEIX!» com l'obertura (Fraunces, «!» llima), adhesiu «RÀDIO» / «LLISTA DE REPRODUCCIÓ», el nom gran i un QR amb la icona al mig. `qr-share.js` reescrit: mostra la mateixa targeta i deixa descarregar-la, compartir-la o copiar l'enllaç. **WhatsApp:** «Compartir» envia **només la imatge** (`navigator.share({ files, title })`, sense `text` ni `url`): a la conversa es veu la icona, «Ràdio» o «Llista de reproducció» i el nom, sense cap enllaç escrit; «Només l'enllaç» envia l'URL amb el títol «Ràdio · nom». Sense suport per compartir fitxers (escriptori) cau a l'enllaç. **Previsualització d'enllaç:** `img/compartir.png` (1200 × 630, `scripts/generar_imatge_compartir.js`) a `og:image`/`twitter:image` d'`index.html`, i `functions/_middleware.js` genera «Ràdio · nom» / «Llista de reproducció · nom» amb aquesta imatge quan l'app és a Cloudflare Pages.

**Trampes conegudes:** (1) **Un enllaç enganxat a WhatsApp sempre mostra el seu text**: no es pot amagar. A `github.io` la previsualització és estàtica (icona i «Segueix Música»); només amb el middleware (Cloudflare) hi surt el nom. Per això «Compartir» envia la imatge. (2) **L'app canvia la ruta de la URL en reproduir (`/video/<títol>-<id>`)**: un `img/icon-512.png` relatiu deixa de trobar-se just quan es comparteix des del reproductor (i el QR es penjava sense error). `share-card.js` resol la icona respecte al seu propi `<script>` (`ICON_URL`) i qualsevol pas de dibuix té un límit de temps (`withTimeout`). Mai posis rutes d'imatge relatives a codi que s'executa des del reproductor. (3) **El QR ha de poder llegir-se des d'una pantalla**: mòduls d'un nombre enter de píxels (≥ 3; es genera a la mida en què es dibuixa, no es reescala), mòduls foscos sobre crema, correcció d'errors H/Q/M segons la longitud (`qrSettings`) i icona més petita com més llarg l'enllaç. Un enllaç de més de 1.900 caràcters (`MAX_QR_URL_LENGTH`, ~100 cançons) no hi cap: es comparteix només com a enllaç. La mida la dóna `qr._qr.getModuleCount()` (API privada de qr-code-styling@1.8.4, fixada a `index.html`; si canvia, hi ha un mínim de 380 px). (4) **Una imatge sense enllaç no s'obre d'un toc**: qui la rep l'ha d'escanejar (iOS i Google Lens llegeixen el QR d'una foto). Per això hi ha «Només l'enllaç». (5) `canvas` no pot fixar `font-variation-settings`: Fraunces s'hi dibuixa amb l'òptica automàtica (una mica més contrastada que a l'obertura). Les fonts es carreguen a la pàgina; `ensureFonts` espera com a màxim 1,5 s. (6) `og:url` d'`index.html` apunta a github.io (perquè Facebook no canonicalitzi cap a segueix.cat); `canonical`, JSON-LD i sitemaps encara són de `segueix.cat` (un test ho cobreix). (7) Les proves: `tests/share-card.test.js`, `tests/music-queue-share.test.js`, `tests/middleware-share.test.js` i, al navegador, `tests/browser/verificar-compartir.js` (llegeix el QR real de la targeta amb jsQR).

**Fitxers Afectats:** `js/utils/share-card.js` (nou), `js/utils/qr-share.js`, `js/utils/share-codecs.js`, `js/features/music-queue.js`, `js/features/home-playlists.js`, `js/app.js`, `css/portada.css`, `index.html`, `img/compartir.png` (nou), `scripts/generar_imatge_compartir.js` (nou), `functions/_middleware.js`, `sw.js`, `CLAUDE.md`, tests.

## [2026-09-30] - Els títols de les cançons portaven el nom de l'artista i «Videoclip Oficial»

**Símptoma:** Les targetes, la ràdio, la cerca, l'historial i el reproductor mostraven els títols de YouTube tal com venen: «Celobert - Ulls bruns (Videoclip oficial)», «La Fúmiga - LA PENÚLTIMA | Official Music Video». L'artista ja surt a part a cada targeta, així que es repetia, i les marques de videoclip/oficial eren soroll.

**Causa Arrel:** El feed (`data/feed.json`) conserva el títol original de YouTube i tota la UI pinta `video.title` tal qual (desenes de llocs). No hi havia cap neteja de títols.

**Solució Implementada:** Nou mòdul pur `js/song-title.js` (UMD, `window.SegueixSongTitle`; es carrega abans de `music-categories.js`): `cleanTitle(title, { artists })` i `cleanVideo(video, extraNames)`. Treu (1) parèntesis/claudàtors/claus que esmenten videoclip/vídeo/oficial (`(Videoclip Oficial)`, `[Official Audio]`, `(Lyric Video)`, `(Videolyric)`, `(Àudio oficial)`, `(oficial)`…), (2) un final o un fragment enmig de soroll (`| Official Music Video`, `- Videoclip Oficial`, `| VIDEOCLIP |`) i (3) el nom de l'artista al davant (`Artista - Cançó`, amb convidats, `Artista: Cançó`, `Artista "Cançó"`, `Artista 1991 - Cançó`) o al darrere (`Cançó - Artista (2026)`). Els noms de l'artista són el títol del canal, els de la base d'artistes (`artist.name`, àlies, `namesByChannel` a `music-categories.js`) i els del canal al feed (`artists`); `ArtistaVEVO` i `Artista - Topic` compten com l'artista. **Conservador:** no treu «video»/«oficial» enmig d'una frase, ni versions (`Live`, acústic, remix…), ni text descriptiu amb xifres («Xavier de Bétera a la Fira 2017 - Cançó»), ni un «dirigit per X», ni fragments amb parèntesis; si el resultat quedés buit es conserva el títol. El títol de YouTube queda a `video.originalTitle`. **On s'aplica:** `decorateVideo()` (feed, amb els noms del canal via `YouTubeAPI.artistNamesOf()`), el snapshot local del feed (`restoreFeedSnapshot`) i, en llegir, l'historial (`getHistoryItems`), les llistes (`library.getPlaylists`) i els m'agrades (`likes.getLikedVideos`): les cançons desades abans es mostren netes sense migrar res. `home-sections.isOfficialClip()` llegeix `originalTitle || title` (la fila «Videoclips oficials» depèn de la marca al títol). `shareVideo()` afegeix l'artista al missatge (`getShareLabel`: «Artista - Cançó»). Proves: `tests/song-title.test.js` (casos reals, invariants sobre tot `data/feed.json`: mai buit, mai més llarg, idempotent, cap claudàtor amb soroll) i `tests/browser/verificar-titols.js`.

**Trampes conegudes:** (1) **Qualsevol lògica que necessiti les marques del títol** (videoclip oficial, lyric, directe…) ha de llegir `video.originalTitle || video.title`: el títol que es mostra ja no les porta. (2) `music-selection.titleKeys` continua usant `video.title`: els marcadors de versió (live, acústic, remix…) es conserven, així que no cal tocar-lo. (3) El feed del servidor (`data/feed.json`, sitemaps, Open Graph de `functions/`) continua amb els títols originals: la neteja és només al client. (4) Els hashtags finals (`#cançonsinfantils`) i les frases de xarxes socials amb «videoclip» (`+500k al videoclip de YouTube!!`) no es toquen: només es treuen les marques en posició d'etiqueta. (5) Si una cançó sembla mal netejada, reprodueix-la amb `cleanTitle(originalTitle, { artists })` a la consola i afegeix el cas a `tests/song-title.test.js`.

**Fitxers Afectats:** `js/song-title.js` (nou), `js/music-categories.js`, `js/youtube.js`, `js/app.js`, `js/features/library.js`, `js/features/likes.js`, `js/features/home-sections.js`, `index.html`, `sw.js`, `CLAUDE.md`, tests.

## [2026-09-30] - «La teva música» era la biblioteca de Segueix youtubers: pestanyes, categories intel·ligents i programes

**Símptoma:** Entrar a «La teva música» mostrava dos botons (Historial, Artistes), dues pestanyes («Llistes» i «Categories Intel·ligents») i les llistes; l'historial i els artistes seguits no es veien. La pàgina d'Artistes tenia una pestanya «Programes» amb un botó «Crear programa», que no s'utilitza en aquesta versió de música.

**Causa Arrel:** La pàgina `#playlistsPage` venia del disseny de Segueix youtubers: `setActiveLibraryTab()` alternava entre llistes i `renderSmartCategoriesTab()`; «categoria intel·ligent» era una categoria personalitzada desada d'una cerca entre cometes (`markExactCategory`, `isExactCategory`, `EXACT_CATEGORIES_STORAGE_KEY`, `isQuotedChannelQuery`); `renderFollowPage()` tenia una branca `activeFollowTab === 'programes'` (`renderProgramesTab`, `_bindProgramGridEvents`, `openCreateProgramModal`…).

**Solució Implementada:** Nou mòdul directe `js/features/my-music.js` (model pur + HTML + esdeveniments) que pinta a `#myMusic`, per aquest ordre: **Historial** (les tres últimes cançons de costat —sense Shorts— amb quan s'han escoltat: «Fa 12 min», «Fa 3 h», «Ahir», «Fa 4 dies» o la data; al final un símbol d'expandir de 64 px que obre el detall per períodes «Última setmana / Últim mes / Últims 3 mesos / Tot l'historial», només els que afegeixen cançons, agrupat per dia i amb un màxim de 50 files; «Obre tot l'historial» porta a l'historial complet) i **Artistes** (només els seguits, en ordre alfabètic; «Descobreix-ne més» obre Artistes); a sota, **Llistes de reproducció** (`#playlistsList`, `#playlistNameInput` i `#createPlaylistBtn` de sempre, dins `#myMusicPlaylists`). `navigation.showPlaylists()` crida el hook `renderMyMusic` (app.js: `myMusic.render()` + `renderPlaylistsPage()`). Eliminat: pestanyes de biblioteca (`activeLibraryTab`, `setActiveLibraryTab`, `libraryTabs`, estat de navegació), `renderSmartCategoriesTab` i els seus handlers, tota la lògica de categoria exacta i el CSS `.library-tab*`/`.smart-category-*`; a Artistes, la pestanya Programes, el modal «Crear programa» (HTML, JS i CSS) i `renderProgramesTab`. `setActiveFollowTab()` només accepta `all` | `following` (una pestanya desada de «programes» torna a «Tots»). Proves: `tests/my-music.test.js` i `tests/browser/verificar-la-teva-musica.js`.

**Trampes conegudes:** (1) `addToHistory()` desa en diferit (`requestIdleCallback`) i no dispara cap esdeveniment: la pàgina es repinta en entrar-hi, no mentre és oberta. (2) Els elements de l'historial sense `viewedAt` van al final i no compten per als períodes. (3) La navegació té un antirebot de 500 ms (`navigateTo`): a les proves de navegador cal esperar entre dues navegacions. (4) `.mm-card__thumb` i `.mm-row__thumb` són a les llistes de caràtules amb imatge per defecte (`isVideoThumbnailImage`, app.js i player.js). (5) No s'ha tocat la resta del subsistema de programes (`getPrograms`, perfil de programa, TV de programes, programes per defecte a `storage.js`) ni les categories personalitzades ordinàries (xips, Radar): només deixen de ser accessibles des d'Artistes i de La teva música.

**Fitxers Afectats:** `js/features/my-music.js` (nou), `js/app.js`, `js/features/navigation.js`, `js/features/player.js`, `js/core/state.js`, `js/core/dom-registry.js`, `js/utils/storage.js`, `index.html`, `sw.js`, `css/portada.css`, `css/styles.css`, `CLAUDE.md`, tests.

## [2026-09-30] - La portada es repintava sobre els resultats d'una cerca després d'escoltar música o desar una llista

**Símptoma:** Després d'escoltar una cançó (o desar una llista) i fer una cerca, el títol deia «Resultats per: …» però la graella tornava a mostrar la portada (`.pt-sections`) al cap d'un instant, i els resultats desapareixien.

**Causa Arrel:** `navigateToSearchResults()` fa `showHome()` i escriu els resultats a `#videosGrid` de manera síncrona. `portada.js` observa la classe de `#homePage` amb un `MutationObserver` i, en tornar a ser visible, crida `refreshIfStale()`; si la `signature()` (historial, cors, seguits, llistes, darrera escolta) ha canviat des de l'últim pintat, `paint()` escrivia la portada a `state.container` (el mateix `#videosGrid`). El callback s'executa després del codi síncron de la cerca, així que trepitjava els resultats.

**Solució Implementada:** `refreshIfStale()` només repinta si el contenidor encara té la portada (`.pt-sections`); si la graella mostra una altra vista no la toca (en tornar a Inici, `renderVideos()` la pinta de nou). Comprovat a `tests/browser/verificar-cerca.js` (5c: escolta + llista desada i cerca, falla sense el canvi).

**Trampes conegudes:** (1) Qualsevol vista que pinti dins `#videosGrid` (cerca, etc.) ha de suposar que la portada és un observador actiu de `#homePage`/`#videoPlayer`. (2) `signature()` compta les llistes: desar una ràdio com a llista també la fa «vella».

**Fitxers Afectats:** `js/features/portada.js`, `tests/browser/verificar-cerca.js`.

## [2026-09-30] - A la capçalera de la ràdio sortia el nom del mode («Sorprèn-me») i no es podia desar la ràdio com a llista

**Símptoma:** Al costat del nom de la ràdio hi havia un text amb el mode de descoberta (p. ex. «· Sorprèn-me», només quan hi havia historial suficient) que no feia res, i la ràdio que t'agradava no es podia conservar: només es podia «Obrir a YouTube».

**Causa Arrel:** `render()` de `music-queue.js` calculava `modeLabel` i `radioNameHtml(modeLabel)` l'afegia com a `<span class="mq-mode">`. No hi havia cap camí de la cua cap a `catube_playlists`.

**Solució Implementada:** S'ha tret `modeLabel` i `.mq-mode`; al seu lloc hi ha el botó-símbol `[data-mq-save-list]` (llista amb «+», 44 px, al costat del nom en qualsevol ràdio: d'estil, general, cerca o selecció). `musicQueue.saveAsPlaylist()` desa tota la cua com a llista (`library.getPlaylists/savePlaylists`, format de `getPlaylistVideoData`, sense Shorts ni repetits), amb el nom de la ràdio (`playlistName()`; «Ràdio Pop (2)» si ja existeix); tornar-hi a prémer actualitza la mateixa llista (`savedListId`, que es reinicia a `launch`, `playSelection` i `startFromSearch`). `library.savePlaylists` dispara `segueix:playlists-changed`, així que «Les teves llistes» de la portada la mostra sense fer res més. Proves: `tests/music-queue-selection.test.js` («desar la ràdio com a llista…») i `tests/browser/verificar-seleccio.js` (1c i 4b).

**Trampes conegudes:** (1) `startFrom()` amb una cançó que ja és a la cua de la ràdio només salta a aquella cançó (no és una ràdio nova): `savedListId` es manté. (2) `isSavedList()` llegeix les llistes a cada repintat de la cua: no hi facis més feina. (3) Si es torna a mostrar el nom del mode, els tests `mq-mode`/«Sorprèn-me» fallen a propòsit; el mode ja es tria al selector de la portada.

**Fitxers Afectats:** `js/features/music-queue.js`, `css/portada.css`, `docs/MUSICA_SELECCIO.md`, `CLAUDE.md`, tests.

## [2026-09-30] - Cerca de Segueix Música: resultats amb soroll, herència de Segueix youtubers i cap ràdio a partir dels resultats

**Símptoma:** Buscar «pop» o «ovella» tornava desenes de cançons que només coincidien per la descripció; la pàgina mostrava «Canals» abans que res (amb «Subscriptors no disponibles»), una secció «Històric» i «Ja vistos», el títol arrossegava el text de l'antic popover de «Categoria personalitzada» i hi havia botons de guardar la cerca com a categoria, «Artistes», «Etiquetes» i «Compartir». El menú esperava fins a 650 ms un índex d'arxiu que ja no existeix. Cada cerca afegia un listener més a `#videosGrid`, que també pinta la portada: un clic obria el vídeo diverses vegades. No hi havia manera de convertir els resultats en una ràdio.

**Causa Arrel:** La cerca era la de Segueix youtubers: `performLocalSearch()` puntuava títol + descripció + etiquetes i barrejava `cachedAPIVideos` i el contingut estàtic; `performDualSearch()` esperava l'índex d'arxiu (`search_index_*.json`, inexistent); `navigateToSearchResults()` tenia un camí per a la cerca de l'API de YouTube (`searchVideosLegacyImpl`), separava «Ja vistos» i ordenava per `sortVideosByRoundRobin` (variar canals, no rellevància), i `renderSearchCategoryActions()` convertia cada cerca en una «categoria personalitzada». El listener de clics es registrava a `videosGrid` a cada cerca sense cap guarda.

**Solució Implementada:** Nou mòdul directe `js/features/search-results.js` (funcions pures + HTML): `buildModel(query, { channels, videos, ... })` retorna **primer artistes i després cançons**. Coincidència sense accents/ela geminada/apòstrofs; una cançó coincideix pel **títol, l'artista (i els seus àlies de la base d'artistes) i els crèdits** («Provided to YouTube: cançó · artista · col·laboradors»), mai per la descripció genèrica; les paraules han de ser senceres (l'última pot ser un principi: «mou te» ≠ «Moustaki … temps»); canals oficial i «Topic» d'un mateix artista surten com un sol artista (`artistKeyForChannel`); duplicats de la mateixa gravació fora (`titleKeys`/`isSameRecording` del motor de selecció); màxim 60 cançons. `app.js`: `buildSearchModel()` (només feed de música), menú síncron (120 ms de debounce, sense índex d'arxiu), `navigateToSearchResults()` reescrita (ràdio → Artistes → Vídeos), `bindSearchResults()` amb un sol listener per contenidor nou; eliminats `renderSearchCategoryActions`, `searchVideosLegacyImpl`, `fetchVideoDetails`, `renderSearchResults`, el popover `search-info` (JS i CSS) i el hook `searchVideos` de `search.js`. **Ràdio de cerca:** `musicQueue.startFromSearch(videos, { query })` (fila a dalt de tot del menú i botó gran a dalt de la pàgina): la primera cançó és la millor coincidència, la resta són les altres cançons trobades ordenades pel motor amb la política nova `policy: 'search'` (sense mescla d'antiguitat ni restricció d'estil; els estils es barregen tal com surten), amb el mateix ordre relaxat d'artistes. No té «+» d'estils, el nom és «Cerca: <consulta>», «Barreja» reutilitza el conjunt de resultats (si ja han sonat totes, torna a començar-les) i amagats/rebutjats (`− com aquesta`, artista bloquejat) queden fora. Tests: `tests/search-results.test.js`, `tests/music-queue-selection.test.js` (bloc «ràdio generada amb els resultats d'una cerca»), `tests/music-selection.test.js` (política `search`) i `tests/browser/verificar-cerca.js`.

**Trampes conegudes:** (1) `performLocalSearch()` continua existint (llistes per nom, categories personalitzades) però ara torna `{ channels, videos }` del model nou, sense límit. Les categories personalitzades, el Radar i l'índex d'arxiu (`loadSearchArchiveIndex`) són herència d'altres pantalles i no s'han tocat: ja no formen part de la cerca. (2) Els resultats de la pàgina són còpies (`{ ...video, score }`): no comparar per referència, sinó per `id`. (3) A `tests/browser/` cada fase ha d'obrir un context nou: l'app desa l'últim vídeo en tancar la pàgina i el reobre en tornar; anar de `/#…` a `/` és només un canvi de fragment i no recarrega. (4) Fora de la cerca, `index.html` encara enllaça `info-youtubers.html` (pàgines de suport/«Qui som» heretades).

**Fitxers Afectats:** `js/features/search-results.js` (nou), `js/features/search.js`, `js/features/music-queue.js`, `js/features/music-selection.js`, `js/app.js`, `js/youtube.js` (`artists` als canals), `css/portada.css`, `css/styles.css`, `index.html`, `sw.js`, `docs/MUSICA_SELECCIO.md`, `CLAUDE.md`, tests.

## [2026-09-30] - La ràdio d'un artista no respectava l'estil, es reanomenava a cada cançó i no es podien barrejar estils

**Símptoma:** Una ràdio engegada des d'una cançó (Inici, fitxa d'artista) era general i barrejava tots els estils; la capçalera deia «Basada en <artista de la cançó que sona>» i canviava a cada cançó; no hi havia manera de barrejar dos estils.

**Causa Arrel:** `startFrom()` només feia servir la categoria de la fila clicada o la pàgina; a Novetats/Tot/fitxa d'artista la categoria quedava buida (ràdio general). La capçalera es calculava amb `current.channelTitle`. `radioCategory` era un sol text.

**Solució Implementada:** `startFrom()` cau a la categoria principal de l'artista (`primaryCategoryOf()` → `SegueixMusicCategories.primaryCategoryForChannel()`, primer gènere de la base d'artistes). `radioCategory` + `radioExtra` (estils sumats); `getCandidates()` accepta diversos estils; `selectRadio({ mix: { labels, tagOf } })` els reparteix a parts iguals. La capçalera mostra l'estil fix i un «+» amb selector (`addStyle`/`removeStyle`); sumar/treure regenera la part pendent conservant el que sona i els afegits a mà. Proves: `tests/music-queue-selection.test.js`, `tests/music-selection.test.js`, `tests/music-categories.test.js` i `tests/browser/verificar-seleccio.js`.

**Trampes conegudes:** (1) `escapeText()` depèn de `document.createElement`: els mocks de proves han de tenir `textContent`/`innerHTML`. (2) `css/portada.css`: els radis literals només poden ser 2/8/10/12–16 px (test `portada-assets`), per això els xips fan 16 px i no 999 px.

**Fitxers Afectats:** `js/features/music-queue.js`, `js/features/music-selection.js`, `js/music-categories.js`, `css/portada.css`, `docs/MUSICA_SELECCIO.md`, tests.

## [2026-09-30] - A la finestra flotant no es podia clicar «Omet l'anunci» de YouTube

**Símptoma:** Amb un anunci sonant a la finestra flotant, el botó «Omet l'anunci» (baix a la dreta del vídeo) no responia.

**Causa Arrel:** Sobre l'iframe hi ha capes a pantalla completa: `.drag-surface` (arrossegar i pausar/reprendre; `pointer-events: auto`), la capa de toc dels controls de cua (`.queue-next-touch-layer`, en tàctil) i `.mini-player-controls-overlay.visible` (amb `pointer-events: auto` durant 3 s en tocar o passar el ratolí). Cap clic no arribava al vídeo.

**Solució Implementada:** `css/portada.css`: amb `#videoPlayer.mini-player-active`, `.drag-surface` i `.queue-next-touch-layer` es retallen amb `clip-path` (la meitat dreta de la meitat inferior queda fora de la capa i el clic arriba a l'iframe) i la capa de restaurar/tancar mai captura clics fora dels seus botons. La resta de la finestra continua servint per arrossegar, pausar i mostrar controls. Comprovat amb `elementFromPoint` en escriptori i mòbil (`tests/browser/verificar-seleccio.js`). El mànec de redimensionar (20 × 20 px, només escriptori) es manté a la cantonada.

**Fitxers Afectats:** `css/portada.css`, `tests/browser/verificar-seleccio.js`.

## [2026-09-30] - La ràdio, el feed i la portada barrejaven massa música antiga, excloïen les cançons escoltades i no aprenien de l'escolta real

**Símptoma:** Amb 20 cançons actuals d'un mateix canal i 80 d'antigues de canals diferents, `limitClassicFrequency` deixava 4 antigues al top 20 però `spreadVideosByArtist` (que s'aplicava després) les augmentava a 10. Una cançó registrada a l'historial (encara que t'agradés molt) quedava fora per sempre de la ràdio i del feed personalitzat; la ràdio ignorava els artistes seguits (`segueixTV.rank` els exclou); «Acabades de sortir» presentava com a estrena reedicions Topic d'una gravació de fa 15 anys pujades ahir; obrir un vídeo comptava com a escolta.

**Causa Arrel:** Diverses ordenacions independents s'aplicaven en cascada (TV rank → mode de descoberta → `limitClassicFrequency` → `spreadVideosByArtist`), de manera que l'última desfeia els límits de l'anterior. L'antiguitat es deduïa només de la data de pujada. L'historial (`addToHistory`) no és un comptador d'escoltes i no hi havia cap mesura de progrés efectiu.

**Solució Implementada:** Un motor compartit (`js/features/music-selection.js`) amb una sola puntuació (gust 45 / actualitat 20 / popularitat 15 / rotació 10 / afinitat 10) i una sola selecció sota restriccions conjuntes aplicada al resultat final (`arrangeMusicList()` per a les llistes). Any original amb evidència al feed (`originalYear*`). Un únic observador del reproductor (`music-signals.js`) amb progrés efectiu, escolta qualificada (30 s), finalització (85 %), repeticions voluntàries i salts, preferències explícites reversibles i fusió idempotent en importar. La ràdio, «Recomanat per a tu», les files i «Torna-hi» hi estan connectats; `engine: 'legacy'` torna a la política anterior. Catàleg incremental al pipeline (repertori conservat i reverificat, pàgines profundes amb pressupost). Simulació sobre el catàleg real (100 llavors): 36 de cada 100 cues passaven de 2 antigues al top 20 amb la política anterior (aproximada); amb el motor, 0.

**Trampes conegudes:** (1) Els `Set`/arrays de les proves vénen d'un altre context: no facis servir `instanceof Set` al motor. (2) Un `keepNext` a `regenerate()` és el que evita canvis sobtats a la cua en donar un cor o seguir. (3) Un canvi de `getVideoArtistKey()` afecta totes les alternances d'artista (ara és la clau estable de la base d'artistes, no el canal). (4) Un únic artista en una categoria requereix el nivell 4 de relaxació (cançons seguides del mateix artista). (5) `getAppContext()` ha de construir el mapa de canals una sola vegada: fer-ho per vídeo va portar el context de 130 ms a 900 ms amb la CPU frenada.

**Fitxers Afectats:** `js/features/music-selection.js` (nou), `js/features/music-signals.js` (nou), `js/features/music-queue.js`, `js/features/portada.js`, `js/features/discovery.js`, `js/features/home-sections.js`, `js/features/tv-learning.js`, `js/features/config-sync.js`, `js/features/likes.js`, `js/features/shell-nav.js`, `js/utils/helpers.js`, `js/music-categories.js`, `js/app.js`, `scripts/update_music_feed.js`, `scripts/lib/any_original_musical.js`, `scripts/lib/cataleg_musical.js`, `data/musica-dates.json`, `docs/MUSICA_SELECCIO.md`, `docs/MUSICA_SELECCIO_SIMULACIO.md`, `tests/music-selection.test.js`, `tests/music-signals.test.js`, `tests/music-queue-selection.test.js`, `tests/cataleg-musical.test.js`, `tests/any-original.test.js`, `tests/browser/verificar-seleccio.js`.

## [2026-09-30] - Tots els vídeos d'una artista (Mar Pujol) quedaven en «revisió» i no sortien enlloc de l'app

**Símptoma:** Mar Pujol tenia el gènere correcte (Cançó d'autor) però cap dels seus 15 vídeos apareixia a categories, Novetats ni a la portada. A `data/feed.json` tots tenien `contentType: "review"`; el seu canal figurava a `channelsWithoutAcceptedMusic`.

**Causa Arrel:** El classificador (`scripts/lib/classificar_contingut_musical.js`) només accepta un vídeo sense marcador explícit si suma ≥75 punts. Els àudios d'una cantautora publicats al seu propi canal (`Mar Pujol - Ploranera (Audio)`) no són categoria YouTube Music, no tenen tags musicals i el marcador «(Audio)» sol no compta (només «official audio»): sumen 60 i queden a `review` per sempre. A més, dues cançons de 85 i 103 s quedaven marcades `isShort: true` per la regla ≤120 s, tot i que YouTube no les tracta com a Shorts (`/shorts/<id>` respon 303 cap a `/watch`), i el client amagava els Shorts de les seccions.

**Solució Implementada:**
1. **Decisions manuals persistents: `data/music-content-overrides.json`** (versionat, escrit a mà). Cada entrada `{id, contentType, title, note}` (tipus permesos: `song`, `live_song`, `album`, `other`; mai `review`). `scripts/update_music_feed.js` les aplica després del classificador (`applyContentOverride`, `scripts/lib/revisio_manual_musical.js`), de manera que manen a cada regeneració del feed i el vídeo surt de `music-content-review.json`. El workflow `actualitzar-feed-musica.yml` s'executa quan canvia aquest fitxer.
2. **`node scripts/aplicar_revisio_manual_musical.js`** aplica les mateixes decisions (i `falsos-shorts.json`) a `feed.json`, al fitxer de revisió i a les dues auditories sense YouTube API, per veure el canvi a l'instant. És idempotent i deixa el mateix resultat que la propera generació.
3. **Mar Pujol:** 12 `song`, 2 `album` (EP *Gelimar* i *Cançons de rebost* sencers: acceptats però, com la resta d'àlbums, no entren a les categories de cançons) i 1 `live_song` (*Pometes té el pomer*, sessió enregistrada en directe). `nXEXHnY7gnU` i `a2vY2W3yMRw` s'afegeixen a `data/falsos-shorts.json` després de comprovar la redirecció de YouTube.
4. **Per revisar un altre vídeo:** afegeix-lo a `music-content-overrides.json`, executa l'script d'aplicació i, si dura ≤120 s, comprova amb `curl -sI https://www.youtube.com/shorts/<id>` si respon 200 (Short real) o 303 (afegeix-lo a `falsos-shorts.json`).

**Nota:** Posteriorment el classificador va incorporar «(Audio)» com a marcador de cançó, així que els àudios nous d'aquest tipus ja no van a `review`. Les decisions manuals continuen manant (p. ex. `album` i `live_song`, que el classificador no distingeix).

**Fitxers Afectats:** `data/music-content-overrides.json` (nou), `scripts/lib/revisio_manual_musical.js` (nou), `scripts/aplicar_revisio_manual_musical.js` (nou), `scripts/update_music_feed.js`, `.github/workflows/actualitzar-feed-musica.yml`, `data/falsos-shorts.json`, `data/feed.json`, `data/music-content-review.json`, `data/music-content-audit.json`, `data/music-feed-audit.json`, `tests/music-content-overrides.test.js` (nou).
## [2026-09-30] - Nova portada «La teva plaça musical» (Segueix Música): trampes trobades

**Canvi:** Redisseny de la pàgina principal (vista «Novetats», que a la interfície és «Inici»). Fitxers nous: `js/features/discovery.js` (lògica pura de descoberta: mode A casa / Una mica de tot / Sorprèn-me, «Fora del teu radar», «Torna-hi», «Comença per aquí»), `js/features/portada.js` (model + HTML + esdeveniments), `js/features/shell-nav.js` (navegació lateral/inferior i avisos), `css/portada.css` (tokens i estils). La cua (`music-queue.js`) rep `startDiscovery`, `enqueue`, `playSelection` i el mode. La preferència es desa a `catube_discovery_mode` (viatja amb l'exportació/sincronització perquè copien tot el localStorage). La portada es pinta dins `#videosGrid`; l'entrada («Fes-la sonar», selector, destacat/«Ara sona») és HTML estàtic a `index.html` (`#portadaEntry`).

**Trampes que cal recordar:**
- **«Recomanat per a tu» retallava el feed.** `renderFeedLegacyImpl` deixa només vídeos ≥ 240 s quan el títol de la pàgina és «Recomanat per a tu» (el títol inicial de `#pageTitle`), de manera que a Inici quedaven 5-6 cançons. La portada fa la seva pròpia tria: `isRecommendedPage` és fals si hi ha `features.portada`.
- **Les variables de tema són inline.** `applyTheme()` (config.js) i `initBackgroundPicker()`/`initButtonColorPicker()` posen `--color-background`, `--color-text`, `--color-button-accent`... a `documentElement.style`, que guanya sobre qualsevol `:root` d'un full d'estils. La paleta per defecte es canvia a `CONFIG.theme` i a `BACKGROUND_COLORS[0]`/`BUTTON_COLORS[0]` (`storage.js`), no només a la CSS.
- **`backdrop-filter` crea un bloc contenidor per als `position: fixed`.** El desplegable de resultats de la cerca mòbil és `fixed`; amb `backdrop-filter` a `.app-header` es calculava respecte de la capçalera i quedava com una barra buida. A mòbil la capçalera és sòlida.
- **Un absolut dins un grid es calcula sobre l'àrea del grid**, no sobre el contenidor: la cerca oberta al mòbil (`.search.is-open`) ha de tenir `grid-area: 1 / 1 / 2 / -1`.
- **`document` tanca la cerca mòbil amb qualsevol clic fora del formulari** (app.js, `bindNavigationEvents`/`bindHomeEvents`). «Cerca» de la navegació inferior obre la cerca amb `setTimeout(..., 0)` perquè s'obri *després* d'aquest gestor.
- **`showHomeNovetatsLegacyImpl` decideix si recarrega mirant `videosGrid.children.length`.** Per això la portada pinta dins `#videosGrid` i no en un contenidor propi.
- **Sense feed, `loadVideosLegacyImpl` acaba a `renderStaticVideos([])`,** que buidava la graella sense dir res. Ara la portada hi pinta l'estat d'error amb «Torna-ho a provar» (i un rellotge de 15 s per si res no arriba a pintar).
- **El mini-reproductor mòbil és `fixed; bottom: 0 !important`:** perquè no es solapi amb la navegació inferior s'aixeca amb `body #videoPlayer.mini-player-active { bottom: calc(var(--pt-nav-h) + safe) !important }` i el `body` guanya un `padding-bottom` extra amb `:has(#videoPlayer.mini-player-active)`.
- **El botó flotant «Cookies» solapava el contingut i la navegació:** viu ara al peu de pàgina (i sempre a Configuració › Privacitat i YouTube).
- **La sincronització de tema `--header-height`** la fa `syncHeaderHeightVar()` amb un ResizeObserver: la capçalera d'una sola fila (mòbil) no requereix cap ajust.

**Verificació:** `tests/discovery.test.js`, `tests/portada.test.js`, `tests/music-queue-discovery.test.js`, `tests/portada-assets.test.js` (contrast real dels tokens, mides tàctils, ordre de scripts, precache del SW) i l'eina opt-in `node tests/browser/verificar-portada.js` (Chromium: desbordaments a 360/390/768/1440, zones tàctils, reproductor únic en canviar de secció, teclat, estat d'error).

**Fitxers Afectats:** `index.html`, `css/portada.css`, `js/features/discovery.js`, `js/features/portada.js`, `js/features/shell-nav.js`, `js/features/music-queue.js`, `js/features/home-playlists.js`, `js/features/category-selector.js`, `js/features/player.js` (fallback de miniatures), `js/app.js`, `js/config.js`, `js/utils/storage.js`, `manifest.json`, `sw.js`, `tests/section-seo.test.js`.

## [2026-09-29] - A la pàgina principal sortien vídeos no musicals (concerts, teasers, anuncis) d'un canal com Els Amics de les Arts

**Símptoma:** A Novetats, al hero i a les files de la pàgina principal apareixien vídeos que no són cançons ("Un concert com els d'abans", "La Mercè 2026", fragments de 47-55 s), tot i que el feed ja els marcava com `review`/`other`.

**Causa Arrel:** Hi ha un classificador a build time (`scripts/lib/classificar_contingut_musical.js`, cridat per `scripts/update_music_feed.js`) que escriu `contentType` (`song`, `live_song`, `album`, `review`, `other`) i `musicReason` a `data/feed.json`, i el client té `SegueixMusicCategories.isCategoryEligibleVideo()`. Però: (1) `YouTubeAPI.getPopularVideos()` (`js/youtube.js`) reconstruïa cada vídeo i **descartava `contentType`**, de manera que al client tot semblava "snapshot antic" i passava el filtre; (2) `filterVideosByCategory()` no aplicava el filtre a `Novetats`/`Tot`, només a les categories d'estil; (3) el classificador acceptava com a `song` fragments de 45-89 s amb només categoria Music + patró de títol.

**Solució Implementada:** `js/youtube.js` conserva `contentType`, `musicReason` i `description`. `filterVideosByCategory()` filtra `Novetats`/`Tot` amb `isCategoryEligibleVideo` (els Shorts hi passen). `isCategoryEligibleVideo` rebutja cançons de menys de 60 s. El classificador exigeix ≥60 s amb marcador explícit i ≥90 s per la via de puntuació (test afegit a `scripts/test_music_content_classifier.js`). Nota: `data/feed.json` es regenera amb el workflow `actualitzar-feed-musica.yml`; fins llavors el guard de 60 s del client cobreix els casos curts.

**Fitxers Afectats:** `js/youtube.js`, `js/app.js`, `js/music-categories.js`, `scripts/lib/classificar_contingut_musical.js`, `scripts/test_music_content_classifier.js`, `index.html` (també un `\n` literal que es veia com a text a la pàgina).

## [2026-09-18] - Els programes de l'usuari no tenien TV, i les TV es quedaven sense arxiu des del reproductor

**Context / Millora:** Es demanava el botó TV als programes que crea l'usuari i que en generessin la televisió encara que el canal sigui un mitjà, un digital o una entitat. Pel camí va aparèixer un error de fons que buidava qualsevol TV engegada des del reproductor.

**Causa Arrel:**

1. **Els programes no tenien TV pròpia.** El perfil d'un programa reaprofita la pàgina de canal, i `ensureChannelButton()` (`js/features/context-tv.js`) hi posava el botó del **canal sencer** — o cap, perquè s'amaga quan `isNonYoutuber()` diu que el canal és de mitjans, digitals o entitats, que és precisament el cas de molts programes (els per defecte inclouen *La Tertúlia Proscrita*, de Vilaweb). Aquella exclusió té sentit a la descoberta, on Segueix TV busca YouTubers; no en té cap en un programa que l'usuari s'ha creat expressament.
2. **Les TV es quedaven sense els vídeos d'arxiu.** `loadArchiveChannel()` resolia l'URL amb `new URL('data/archive/channels/<id>.json', document.baseURI)`. Mentre es mira un vídeo, l'app canvia l'URL a la ruta llegible (`/video/<slug>-<id>`), de manera que `document.baseURI` deixa de ser l'arrel i la petició anava a **`/video/data/archive/...` → 404**. Pitjor: `loadArchiveChannel()` memoritza el resultat, així que el `[]` del 404 es quedava al catxé per a la resta de la sessió. Mesurat amb Chromium: la TV del programa de prova passava de **12 episodis a 3** (només els del feed). El mateix patró afectava `data/feed.json`, `data/hidden-videos.json`, `js/channels-ca.json`, `data/support.json`, els índexs de cerca i els arxius de `youtube.js`.

**Solució Implementada:**
1. **`window.appDataUrl()` (`js/config.js`, el primer script que es carrega)**: resol qualsevol ruta de dades contra l'arrel de l'app, deduïda de l'`src` del propi `js/config.js` (`new URL('../', src)`), de manera que continua sent correcta si algun dia es torna a servir des d'un subdirectori. S'aplica a `js/youtube.js` (feed, vídeos ocults, canals de reserva, arxius de canal, índex i galledes d'arxiu), `js/app.js` (manifest i fragments de l'índex de cerca), `js/features/support.js`, `js/features/context-tv.js` i `js/features/segueix-tv.js`. Les crides són `window.appDataUrl?.(x) || x`, de manera que els sandbox dels tests i qualsevol ordre de càrrega continuen funcionant.
2. **`buildProgramQueue()` (`js/features/context-tv.js`)**: cua d'un programa = vídeos del canal (feed + arxiu) amb el nom del programa dins del títol, la mateixa regla que fa servir `openProgramProfile()`. **No** s'hi apliquen les exclusions de la descoberta ni el mínim de 180 s (`startPlaylist()` accepta `requireLongVideos: false`): si l'usuari s'ha creat el programa, el vol veure sencer. Només s'exclouen els Shorts.
3. **Botó TV als programes**: al perfil del programa (`ensureChannelButton()` detecta `channel-page--program-profile` i hi posa el botó del programa en comptes del canal) i a cada targeta de la pestanya *Programes* (`renderProgramesTab()`), a la cantonada lliure de la targeta. El clic el captura el listener de `context-tv.js`, que atura la propagació: engega la TV sense obrir el perfil.
4. **`currentProgramId` (`js/app.js`)**: estat nou, amb proxy a `SegueixApp.state`, perquè el botó sàpiga de quin programa és. S'omple a `openProgramProfile()` i es buida en obrir un canal normal.

**Com verificar-ho:** `node tests/browser/verificar-tv.js` crea un programa de prova d'Esports IB3 (categoria `mitjans` al feed) i comprova que el canal és dels que la descoberta exclou, que el botó TV surt a la targeta i al perfil, que el clic a la targeta engega la TV del programa sense obrir el perfil, i que la cua té els episodis del programa (12: 9 de l'arxiu i 3 del feed) **engegada des del reproductor**, que és on el 404 de `document.baseURI` la deixava en 3.

**Pendent conegut:** les imatges per defecte generades per JS (`img/icon-192.png`, `img/caratula.png` a `js/app.js` i `js/utils/helpers.js`) tenen el mateix problema de ruta relativa i es veuen trencades mentre l'URL és la llegible. `js/features/player.js` ja les escriu com a `/img/...`.

**Fitxers Afectats:** `js/config.js` (`appDataUrl`), `js/youtube.js`, `js/app.js` (`currentProgramId`, bridge d'estat, `openProgramProfile`, `renderProgramesTab`, índexs de cerca), `js/features/context-tv.js` (`buildProgramQueue`, `ensureChannelButton`, `startPlaylist`, `onContextButtonClick`, API pública), `js/features/segueix-tv.js`, `js/features/support.js`, `sw.js` (bump de versió per contingut), `tests/browser/verificar-tv.js`.

## [2026-09-18] - La TV sortia de la pantalla completa a cada canvi de vídeo

**Context / Millora:** Mirant una TV en pantalla completa, en acabar un vídeo el següent s'obria en finestra normal: calia tornar a entrar-hi a cada vídeo. Es demanava que la pantalla completa es mantingués segons com estigui mirant l'usuari — si hi és, el vídeo següent hi continua; si no, res no canvia.

**Causa Arrel:** Quan el reproductor de YouTube entra en pantalla completa, l'element que el navegador hi posa és l'`<iframe>` (o un descendent seu), i el canvi de vídeo el destrueix: `prepareWatchPlaybackPreview()` crida `resetInlineVideoSurface()`, que buida `#videoPlayer.innerHTML`. Destruir l'element en pantalla completa en fa sortir. La branca de `updatePlayerIframe()` que reaprofita l'iframe a escriptori no salva res, perquè per quan s'hi arriba l'iframe ja s'ha destruït.

**Comprovat amb Chromium** (les tres vies, amb un iframe que demana la pantalla completa com fa YouTube):

| Acció sobre l'iframe en pantalla completa | Es manté? |
|---|---|
| Canviar-ne el `src` | Sí (`fullscreenElement` continua sent l'iframe) |
| Destruir-lo i recrear-lo | **No** |
| `requestFullscreen()` del contenidor **sense gest de l'usuari** | Sí — mentre ja s'hi és, el navegador no en demana cap |
| Deixar-lo intacte i només enviar-li comandes | Sí |

**Solució Implementada:**
1. **`swapLivePlayerVideo()` (`js/app.js`)**: en pantalla completa el reproductor no es toca. Se li demana el vídeo nou amb l'API de l'iframe (`loadVideoById` per `postMessage`, que l'app ja fa servir: `enablejsapi=1` i el handshake de `setupYouTubeIframeMessaging()`), tal com encadena una llista de reproducció de YouTube. La resta de la pàgina (títol, canal, historial, cua, URL) s'actualitza igualment, així que en sortir de la pantalla completa tot està al dia.
2. **`loadVideoInSequence()`** decideix la ruta amb `canSwapLivePlayerVideo()`: només quan **s'està en pantalla completa**, hi ha un iframe viu de YouTube i hi ha consentiment. Fora d'aquest cas res no canvia: el camí normal ja va bé i mostra la caràtula del vídeo nou mentre carrega.
3. **Xarxa de seguretat**: si el reproductor no confirma la càrrega en 2,5 s (`LIVE_SWAP_TIMEOUT`), es recarrega de la manera normal, però abans `requestPlayerContainerFullscreen()` traspassa la pantalla completa de l'iframe a `#videoPlayer`, que no es destrueix. El traspàs és **asíncron** i cal esperar-ne la promesa: recrear l'iframe abans que acabi fa sortir de la pantalla completa igualment (era el motiu pel qual la primera versió fallava).
4. **`#videoPlayer:fullscreen` (`css/styles.css`)**: amb el contenidor en pantalla completa, els estils inline que el col·loquen damunt del seu forat guanyarien als del navegador i el vídeo quedaria en una cantonada. `updatePlayerPosition()` també surt aviat mentre s'hi és, i el gestor de `fullscreenchange` el torna a col·locar en sortir-ne.
5. **`shouldIgnoreDuplicateTVEnded()`**: encadenar fa que el reproductor emeti l'estat final del vídeo anterior amb un instant de retard; sense aquesta guarda (2 s) aquell `ended` es menjaria un vídeo de la cua.

**Com verificar-ho:** `node tests/browser/verificar-tv.js`. Com que YouTube no es pot carregar en un entorn de proves, el verificador serveix un **succedani local a la mateixa URL d'embed** que parla el mateix protocol de `postMessage` (handshake `listening`, `onStateChange`, `loadVideoById`) i té un botó que demana la pantalla completa com fa YouTube. Comprova que en acabar el vídeo la pantalla completa es manté **amb el mateix iframe** (no recreat), que el vídeo nou hi carrega, que la pàgina de sota s'actualitza i que la xarxa de seguretat tampoc no en surt.

**Fitxers Afectats:** `js/app.js` (`swapLivePlayerVideo`, `canSwapLivePlayerVideo`, `getLiveYouTubeIframe`, `isPlayerFullscreen`, `getPlayerFullscreenElement`, `requestPlayerContainerFullscreen`, `confirmLivePlayerSwap`, `cancelLiveSwapFallback`, `shouldIgnoreDuplicateTVEnded`, `loadVideoInSequence`, `showVideoFromAPILegacyImpl`, `handleYouTubeMessageLegacyImpl`, `updatePlayerPosition`, `resetInlineVideoSurface`, `focusTVPlayerViewport`, gestor de `fullscreenchange`), `css/styles.css`, `sw.js` (bump de versió per contingut), `tests/browser/verificar-tv.js`, `tests/browser/README.md`.

## [2026-09-18] - En obrir una TV el vídeo sortia surant i, en acabar, la vista es quedava lluny del reproductor

**Símptoma:** En engegar qualsevol de les tres TV (Segueix TV, TV de categoria, TV de canal) el vídeo apareixia "flotant": es veia un instant a dalt de tot, per damunt del header, i llavors lliscava fins al seu lloc. A més, en acabar un vídeo i encadenar el següent, la pàgina no es movia d'on era l'usuari, de manera que el vídeo nou començava fora de la vista.

**Causa Arrel:** Tres coses independents.

1. **`.video-player { transition: all 0.3s ease }`.** El reproductor no viu dins del flux: és un element posicionat a mà damunt del seu forat (`#videoPlaceholder`) per `updatePlayerPosition()`. Amb `transition: all`, **cada** escriptura de `top/left/width/height` s'animava 300 ms, així que en obrir un vídeo el reproductor lliscava des de `top: 0` (el valor per defecte, que el situa damunt del header) fins al forat. Mesurat amb Chromium (viewport 412x915, UA d'Android): **78 px de desfase** que trigaven ~400 ms a resoldre's, i un desfase residual de 8 px que ja no es corregia mai. L'animació només té sentit per a la finestreta flotant, que és per a qui es va escriure.
2. **El reproductor es feia visible abans de col·locar-lo.** `preparePlayerForPlayback()` posava `display: block` i deixava el posicionament per al `requestAnimationFrame` següent: hi havia un frame pintat amb el vídeo fora del seu forat.
3. **En TV, la posició de la pàgina no la governava ningú.** `showVideoFromAPI()`/`showVideo()` fan `window.scrollTo(0, 0)` al **final**, després de les crides a l'API; per evitar el salt tardà entre vídeos, `keepTVPosition` (2026-09-17) el saltava i deixava la vista on fos. El resultat era el contrari del que demana una TV: el vídeo nou arrencava mentre l'usuari mirava una altra part de la pàgina.

**Solució Implementada:**
1. **`css/spacing-polish.css`**: `body.segueix-tv-playback #videoPlayer:not(.mini-player-active) { transition: none; }`. La finestreta flotant conserva l'animació; el reproductor inline de la TV es veu de seguida al seu lloc.
2. **`preparePlayerForPlaybackLegacyImpl()`**: `updatePlayerPosition()` síncron just després de `display: block`, mantenint el `requestAnimationFrame` com a segona passada.
3. **Ancoratge de la vista (`focusTVPlayerViewport()` i companyia, `js/app.js`)**: `loadVideoInSequence()` el crida en engegar una TV i a cada canvi automàtic de vídeo. Treu la finestreta flotant si n'hi havia, porta la pàgina a dalt i, a cada frame, manté l'scroll a 0 i torna a enganxar el reproductor al seu forat mentre el layout s'assenta (transició de 280 ms del header, cua que es repinta, títol que canvia d'alçada). L'ancoratge s'allibera quan l'API de YouTube confirma que el vídeo nou ja s'està reproduint (estat 1, via `handleTVPlaybackStarted()`), quan l'usuari fa un gest d'scroll (`wheel`, `touchmove`, `keydown` — la seva decisió mana) o als 8 s. Després encara segueix el forat 900 ms més (`TV_VIEWPORT_SETTLE_MS`), perquè just després d'arrencar el layout encara es pot moure. `exitPlaylistMode()` l'atura.
4. **`keepTVPosition`** passa a ser només "mode TV": l'`scrollTo(0, 0)` tardà del final ja no s'executa mai en TV, perquè arribaria quan l'usuari ja pot haver baixat a la programació.
5. **`scripts/actualitzar_versio_sw.js`**: `EXTRA_ASSETS` incorpora `css/category-chips.css`, `css/spacing-polish.css` i `css/typography-polish.css`. S'injecten des de `navigation.js`, no són a `index.html` i, per tant, quedaven fora del hash: un canvi que només els toqués no bumpava `CACHE_VERSION` i els clients es quedaven amb la versió antiga (són cache-first).

**Com verificar-ho:** `node tests/browser/verificar-tv.js` (i `TV_TEST_DESKTOP=1` per a l'escriptori) comprova, en un Chromium real, que en engegar una TV i a cada canvi de vídeo el desfase respecte del forat no passa de 4 px, que la vista es queda a la part superior, que no apareix mai la finestreta flotant i que un gest d'scroll de l'usuari es respecta.

**Fitxers Afectats:** `js/app.js` (`focusTVPlayerViewport`, `releaseTVViewportHold`, `stopTVViewportHold`, `runTVViewportFrame`, `handleTVPlaybackStarted`, `isTVPlaybackMode`, `loadVideoInSequence`, `setMiniPlayerState`, `preparePlayerForPlaybackLegacyImpl`, `handleYouTubeMessageLegacyImpl`, `exitPlaylistMode`, `showVideoFromAPILegacyImpl`, `showVideoLegacyImpl`), `css/spacing-polish.css`, `scripts/actualitzar_versio_sw.js`, `sw.js` (bump de versió per contingut), `tests/browser/verificar-tv.js` (nou), `tests/browser/README.md`.

## [2026-08-15] - El workflow "Revisar Shorts" fallava a cada execució (exit 1 immediat)

**Símptoma:** L'acció `Revisar Shorts` (`.github/workflows/revisar_shorts.yml`) acabava en error cada dia, en pocs segons, amb el missatge `❌ Error: No s'han trobat els arxius feed.json o recent-feed.json`. Mai s'ha corregit cap fals Short des que existeix el workflow.

**Causa Arrel:** Dos problemes encadenats.

1. **Dependència d'un fitxer no versionat.** `scripts/revisar_shorts.js` exigia `data/feed.json` **i** `data/recent-feed.json`, i sortia amb `process.exit(1)` si en faltava cap. Però `data/recent-feed.json` és a `.gitignore` (artefacte local del pipeline, generat per `update_feed.js`): en un checkout net de GitHub Actions no existeix mai, així que el guard saltava sempre abans de fer cap comprovació.
2. **Les correccions no haurien sobreviscut igualment.** Encara que el script s'hagués executat, `update_feed.js` recalcula `isShort` a partir de la durada (`durationSeconds <= 120`) i sobreescriu les entrades del feed a cada reconstrucció (4 cops al dia via `actualitzador.yml`). Qualsevol correcció hauria durat com a molt fins a les 08:00 UTC següents.

**Solució Implementada:**
1. **`scripts/revisar_shorts.js`** treballa només amb `data/feed.json` (l'única font versionada) i reprodueix ell mateix la finestra de 31 dies que definia el `recent-feed`. `recent-feed.json` i `feed_updates.js` passen a ser opcionals: només s'actualitzen si ja existeixen al disc.
2. **Registre persistent `data/falsos-shorts.json`** (versionat) amb els IDs verificats com a falsos Shorts i la data de l'última comprovació de cadascun. El script el reaplica *sempre* al feed, no només quan detecta res nou.
3. **`applyFalseShortsOverrides()` a `scripts/update_feed.js`**: reaplica el registre just després de fusionar els vídeos, de manera que la reconstrucció del feed ja no desfà la revisió.
4. **Feina acotada:** només es comproven els Shorts no verificats en els últims 30 dies (`SHORTS_RECHECK_DAYS`), amb un màxim de 250 peticions per execució (`SHORTS_REVIEW_MAX`). Sense això calien ~1.300 peticions diàries a YouTube.
5. **Robustesa de la petició HEAD:** timeout de 10 s i tractament de `429`/`5xx` com a resultat *no concloent* (no es registra i es torna a intentar l'endemà) en comptes d'assumir que el vídeo és un Short vàlid.
6. **Workflow:** el commit es decideix amb `git diff --staged --quiet` (abans mirava també canvis no preparats), s'hi afegeix `data/falsos-shorts.json` i es fa `pull --rebase` abans del push per evitar carreres amb l'actualitzador.

**Fitxers Afectats:** `scripts/revisar_shorts.js`, `scripts/update_feed.js` (`applyFalseShortsOverrides`, `FALSE_SHORTS_JSON`), `.github/workflows/revisar_shorts.yml`, `data/falsos-shorts.json` (nou), `CLAUDE.md`.

## [2026-07-26] - El reproductor tapava el títol en obrir un vídeo al mòbil, i les icones del header no tornaven mai

**Símptoma:** A Android, en obrir un vídeo des del llistat, el reproductor apareixia "flotant" per damunt del títol del vídeo. A més, un cop amagada la filera d'icones del header (Inici, Llista, Historial, Configuració), fent scroll cap amunt fins al capdamunt no tornava a aparèixer.

**Causa Arrel:** Dos problemes independents.

1. **El reproductor es posicionava abans que el layout s'estabilitzés.** `#videoPlayer` no viu dins del flux: és un element posicionat a mà damunt del seu forat (`#videoPlaceholder`) per `updatePlayerPosition()`, que fins ara només es cridava en `scroll` i `resize`. En obrir la pàgina del vídeo al mòbil, `collapseMobileHeaderForWatchPage()` col·lapsa la filera d'icones amb una transició CSS de 280 ms: el forat puja ~68 px mentre la transició avança, però el reproductor ja s'havia col·locat al `requestAnimationFrame` inicial i s'hi quedava, solapant el títol, fins que l'usuari feia scroll (que és el que el tornava a alinear). Mesurat amb Chromium (viewport 412x915, UA d'Android): desfase de **68 px** i **29-56 px de solapament amb `#videoTitle`**. Per l'enllaç compartit (`?v=`) no passava, perquè allà la pàgina ja arrenca amb el header col·lapsat; només es reprodueix obrint el vídeo des del llistat.
2. **La filera d'icones no tenia manera de reaparèixer a dalt de tot.** `updateMobileHeaderOnScroll()` mostra la filera quan s'acumulen 24 px d'scroll cap amunt, i a la pàgina del reproductor se salta expressament la regla de "sempre visible a prop de dalt" (si no, no s'amagaria en obrir el vídeo). Però en arribar al capdamunt ja no queda recorregut per acumular aquests 24 px, i com que l'ancora es reinicia en canviar de direcció, la filera es quedava amagada indefinidament.

**Solució Implementada:**
1. **`observePlayerLayoutShifts()`** (`js/app.js`): un `ResizeObserver` sobre `#videoPlaceholder`, `.app-header` i `.watch-main`, més un `transitionend` del header, reposicionen el reproductor davant de qualsevol canvi de layout (transició del header, icones tardanes, fonts, barra d'URL del mòbil). Es força invalidant `_lastPlayerRect`, perquè el forat es pot moure sense canviar de mida. S'activa un sol cop des de `bootstrapApp()`.
2. **`updateMobileHeaderOnScroll()`**: a la pàgina del reproductor, si la filera és amagada i s'arriba a dalt (`y <= 60`) amb un gest cap amunt (`frameDelta < 0`), es mostra directament. Es demana el gest explícitament perquè en obrir el vídeo —que passa amb l'scroll a dalt i sense cap gest— continuï amagant-se.
3. **`exitMiniPlayerForNewVideo()`**: en obrir un vídeo, el reproductor mai hereta l'estat de finestreta flotant d'un vídeo anterior. S'exclou l'avanç automàtic de cua/llista (`isAutoPlayNavigating`), on el flotant ha de continuar.

La finestreta flotant en fer scroll cap avall es manté tal com era: és el comportament volgut.

**Fitxers Afectats:** `js/app.js` (`observePlayerLayoutShifts`, `updateMobileHeaderOnScroll`, `exitMiniPlayerForNewVideo`, `showVideoFromAPILegacyImpl`, `showVideoLegacyImpl`, `bootstrapApp`), `tests/browser/verificar-reproductor.js` (nou), `tests/browser/README.md`.

## [2026-07-26] - Alguns enllaços de vídeos compartits obrien la pàgina general (sobretot a Android)

**Símptoma:** En compartir un vídeo des de l'app, **alguns** enllaços no es "generaven bé": a WhatsApp/Telegram (Android) la previsualització mostrava el text i la imatge genèrics de la portada ("Segueix! - Els nostres YouTubers") i, en tocar-la, s'obria la pàgina general en comptes del vídeo. Altres vídeos es compartien perfectament.

**Causa Arrel:** Quatre problemes independents que se sumaven.

1. **El middleware de Cloudflare només coneixia el feed.** `functions/_middleware.js` buscava el vídeo a `data/feed.json` i, si no hi era, feia `return res` sense injectar cap meta. `feed.json` té ~4.900 vídeos, però l'arxiu en té ~19.600 més (els que es troben per cerca o són antics): per a tots aquests, la pàgina servia les meta estàtiques de l'`index.html`, que inclouen `og:url = https://segueix.cat/`. Aquest `og:url` és la URL canònica de la previsualització i és el que obren diverses apps d'Android → **pàgina general**. Verificat en producció: `?v=Jwj-SJMm93M` (al feed) injectava el títol correcte, mentre que `?v=CE0dp0bSxCM` i `?v=6Z-reIuixg0` ("Can Nyero (I) - Segueix.cat [CAT]", d'Aleix Galvany, maig del 2026, només a `data/search_index_2026_05.json`) retornaven les meta de la portada. **Com detectar-ho:** si `data/feed.json` no conté l'`id` del vídeo però `data/archive/` o `data/search_index_*` sí, l'enllaç patirà aquest problema.
2. **El paràmetre `t` estava duplicat amb dos significats.** `buildAppShareUrl()` hi escrivia `Date.now()` com a cache buster, però l'app llegeix `t` com el **segon d'inici** de reproducció (`?v=ID&t=SEGONS`). Cada enllaç compartit arribava, doncs, amb `start=1785500000000` a l'iframe de YouTube.
3. **Els watchdogs d'arrencada segrestaven l'enllaç.** `forceRecoverHomeFeed()` (timeout de 22 s del pipeline, watchdogs de 4,5 s i 9 s a iOS, o qualsevol error) cridava `showHomeNovetats()` sense mirar si hi havia un `?v=` pendent. A més, la ruta `?v=` era **la més lenta de totes**: feia `await loadSearchArchiveIndex()` (manifest + fins a 3 fragments d'índex, sense límit de temps) abans d'obrir el vídeo, tot i que `resolveInitialVideoForUrl()` ni tan sols consulta aquell índex i `showVideoFromAPI()` ja el carrega sol quan li cal. Amb xarxa mòbil lenta, la recuperació guanyava la cursa i deixava l'usuari al feed.
4. **El Service Worker no tenia fallback per a URLs amb query.** `networkFirst` desava i buscava cada navegació per URL completa: sense xarxa, `caches.match('/?v=ID')` no trobava mai el shell precachejat i retornava `Response.error()`. A més el cache creixia amb una còpia de l'HTML per cada enllaç obert.

**Solució Implementada:**
1. **`functions/_middleware.js`**: si el vídeo no és al feed es busca a l'**arxiu**, que en té el títol, la descripció i la caràtula reals. Com que els fitxers d'arxiu estan indexats per canal i de l'URL només en tenim l'id del vídeo, `lookupArchiveVideo()` fa servir l'índex de cerca (que mapa `i` → `c`): recorre els fragments del manifest del més nou al més antic i els descarta sense parsejar-los si el text ni tan sols conté l'id (un vídeo recent es resol amb 3 lectures; el pitjor cas, 36, són 2,8 MB d'assets locals). Només si el vídeo tampoc no és a l'arxiu es recorre a l'**oEmbed públic de YouTube** (dona títol i canal, però **no descripció**). La caràtula es resol amb `resolveOriginalThumbnail()`, que comprova per ordre `maxresdefault` → `sddefault` → `hqdefault` amb peticions `HEAD` (YouTube respon 404 a les mides que un vídeo no té); si el feed o l'arxiu ja diuen quina mida hi ha, es prova primer aquesta, i si és `hqdefault` no cal comprovar res. Tots dos resultats es desen a la cache del datacenter (`caches.default`, una setmana) perquè la resolució es pagui un sol cop per vídeo. La resolució de caràtula també s'aplica als vídeos del feed, on la miniatura guardada podia apuntar a una mida inexistent (previsualització sense imatge) o anunciar-se amb mides que no eren les seves. La compartició de llistes i d'historial també busca a l'arxiu el canal del primer vídeo, que abans queia sempre a l'avatar genèric. També es reescriu el `<title>` del document, s'escapen `&`, `<` i `>` a `escapeMeta()` (`?programName=` arribava sense escapar dins l'HTML injectat) i **no es llegeix el feed de 7 MB quan no hi ha cap paràmetre de compartició**.
2. **`js/utils/share-codecs.js`**: `buildAppShareUrl()` i `parseShareStartSeconds()` viuen aquí (amb tests). L'URL de compartició ja **no porta cache buster**, i la lectura de `t` ignora els valors superiors a 24 h, de manera que els enllaços antics amb un timestamp en mil·lisegons es reprodueixen des del principi en comptes de trencar-se.
3. **`js/app.js`**: el destí de l'enllaç compartit es memoritza en temps de parsing (`pendingDeepLinkVideo`), `forceRecoverHomeFeed()` mai porta al feed si hi ha un enllaç pendent (reintenta obrir el vídeo), i `openPendingDeepLinkVideo()` és idempotent, amb límit de 4 s a la resolució del vídeo i fallback al reproductor. S'ha eliminat l'`await loadSearchArchiveIndex()` de la ruta d'arrencada amb `?v=` (per a un vídeo del 2026 volien dir ~1,7 MB de fragments d'índex a sobre dels 6,9 MB del feed). A `showVideoFromAPI()`, la condició `!cachedVideo && searchArchiveIndexCache.length === 0` passa a ser només `!cachedVideo` amb límit de 5 s: comprovar que el catxé fos buit fallava quan una càrrega en curs ja hi havia deixat altres fragments, i el vídeo es quedava sense títol ni miniatura. `shareVideo()` també passa `title`/`text` al `navigator.share()`, com ja es feia amb llistes i categories (entrada del 2026-04-14).
4. **`sw.js`**: les navegacions es desen i es recuperen sempre sota la clau del shell (`SHELL_URL`), amb `ignoreSearch` com a segona xarxa de seguretat.
5. **`manifest.json`**: `start_url` apuntava a `https://segueix.github.io/Segueix/` (domini antic, origen diferent del de la web). Ara és relatiu (`./`) amb `scope` explícit, perquè la PWA instal·lada a Android obri els enllaços dins del seu àmbit.

**Fitxers Afectats:** `functions/_middleware.js`, `js/utils/share-codecs.js`, `js/app.js`, `sw.js`, `manifest.json`, `tests/share-codecs.test.js` (nou), `tests/middleware-share.test.js` (nou).

## [2026-07-24] - El botó de tancar del Short quedava visible quan els controls de YouTube ja s'havien amagat

**Context / Millora:** Al modal de Shorts, els controls natius de YouTube (entre ells el botó de pausa) es fonen sols uns segons després que el vídeo comenci a reproduir-se, però el botó de tancar (`#short-modal-close-btn`) es quedava sempre a la vista damunt del vídeo. Es demanava que s'amagués **alhora** que el botó de pausa i que només reaparegués **en fer clic/toc a la pantalla** — en particular, **navegar entre Shorts (lliscar o roda) no l'ha de tornar a mostrar**.

**Repte:** No es pot llegir la visibilitat dels controls interns de l'iframe de YouTube (origen creuat) ni hi ha cap botó de pausa propi (la pausa es fa tocant `#shortGestureOverlay` — veure l'entrada del ratolí emulat). Cal, doncs, **replicar-ne el cicle** amb els senyals que sí tenim: els esdeveniments `onStateChange` que ja rebem per `postMessage` i els gestos de l'overlay.

**Solució Implementada (`js/features/shorts.js`):**
1. **Helpers de visibilitat:** `showShortCloseBtn({ autoHide, delay })` / `hideShortCloseBtn()` / `clearShortCloseTimer()` commuten la classe `is-hidden` amb un únic temporitzador (`SHORT_CONTROLS_HIDE_MS` = 3000 ms, el mateix ordre de magnitud que el fos dels controls de YouTube).
2. **Reaparició NOMÉS per toc:** l'única via que el mostra un cop amagat és `toggleShortPlaybackImpl()`, que ja només s'executa quan `setupShortScroll` classifica el gest com a **tap** (moviment < 10 px i < 250 ms) — els lliscaments i la roda no hi passen. A més ajusta l'auto-amagat segons el nou estat: en pausar es queda visible, en reprendre torna a comptar. Important: la reaparició **no** es pot lligar a `pointerdown`/`mousedown` del panell, perquè aquests esdeveniments també es disparen al començament d'un swipe i el botó apareixeria en cada scroll entre Shorts.
3. **Ancoratge a la reproducció real (sense desamagar):** al listener de `bindShortPlaybackReveal`, `info === 1` crida `refreshShortCloseTimer()`, que **només reprograma** el compte enrere si el botó ja és visible; si estava amagat (p. ex. després de lliscar a un altre Short) s'hi queda. Per això `primeShortPlayback` **no** el mostra: canviar de Short no altera la visibilitat del botó.
4. **Obertura del modal:** `openShortModalImpl` sí que el mostra un cop (amb `SHORT_CONTROLS_LOAD_HIDE_MS` = 5000 ms, marge ampli que només fa de xarxa de seguretat si mai no arriba l'esdeveniment de reproducció, per no parpellejar en càrregues lentes).
5. **CSS (`css/styles.css`):** `.short-modal-close` guanya `transition` d'opacitat i `.short-modal-close.is-hidden` (`opacity:0; visibility:hidden; pointer-events:none`) perquè el fos sigui suau i el botó amagat no rebi clics. `closeShortModalImpl` neteja el temporitzador i el deixa visible per a la pròxima obertura.

**Fitxers Afectats:** `js/features/shorts.js` (helpers nous `showShortCloseBtn`/`hideShortCloseBtn`/`clearShortCloseTimer`/`refreshShortCloseTimer` i ganxos a `openShortModalImpl`, `bindShortPlaybackReveal`, `toggleShortPlaybackImpl`, `closeShortModalImpl`), `css/styles.css` (`.short-modal-close`, `.short-modal-close.is-hidden`), `sw.js` (bump de `CACHE_VERSION` per contingut via `npm run sw:version`), `docs/PROBLEMES_I_SOLUCIONS.md`.

## [2026-07-24] - El nou Short mostrava la caràtula estàtica en aterrar en comptes de reproduir-se

**Símptoma:** Amb la transició contínua de Shorts ja funcionant, en lliscar i aterrar al nou Short apareixia la **caràtula estàtica** (el pòster de tapat) durant un instant perceptible abans que el vídeo comencés; de vegades semblava que no s'iniciava sol la reproducció.

**Causa Arrel:** A la versió inicial de `commitSlide`, el vídeo del nou Short només es carregava (`loadShort` → `loadVideoById`) **dins del `transitionend`**, és a dir, ~280 ms després d'acabar el gest i **fora del context d'activació de l'usuari**. Això tenia dos efectes: (1) el buffering del nou vídeo no començava fins que el strip havia aterrat, de manera que el pòster de tapat es quedava a la vista mentre carregava; i (2) en executar-se `loadVideoById` de manera asíncrona i deslligada del gest tàctil, l'autoplay podia trigar o quedar aturat (comportament més sensible a iOS).

**Solució Implementada:**
1. **`loadShort` desacoblat** en dues parts: `primeShortPlayback(index)` (només carrega/reprodueix el vídeo a l'iframe; retorna `false` si cal consentiment) i `applyShortMeta(index)` (només UI: historial, títol, canal, accions, pòsters veïns). `loadShort` continua component-les per als camins no animats (obertura del modal, roda/teclat).
2. **Inici anticipat dins del gest:** a `commitSlide`, quan es confirma el desplaçament, es tapa el panell que marxa amb la caràtula del Short **actual** i s'inicia **ja** `primeShortPlayback(newIndex)` (encara dins del `touchend`, amb activació d'usuari). El vídeo va guanyant buffer i comença a reproduir-se **darrere del pòster mentre el strip llisca**, de manera que quan aterra ja s'està reproduint.
3. **Bloqueig de destapat durant el lliscament (`revealLocked`):** el listener de reproducció (`onStateChange` `info === 1`) marca `shortIsPlaying = true` però **no** destapa el pòster mentre `revealLocked` és cert (evita que el vídeo nou aparegui al panell que marxa). En aterrar (`finish`), es desbloqueja i, si el vídeo ja reprodueix, es destapa de seguida (120 ms); si no, ho fa el listener quan arribi `info === 1`, amb un *timeout* de recanvi.
4. **Compatibilitat:** el gate de consentiment es manté (si cal consentiment, s'actualitza l'índex i s'ensenya el diàleg sense animar); la resta de camins (obertura, roda, mode playlist, degradació sense strip) segueixen igual.

**Fitxers Afectats:** `js/features/shorts.js` (`primeShortPlayback`, `applyShortMeta`, `scheduleReveal`, `loadShort`, `commitSlide`, `bindShortPlaybackReveal`, `closeShortModalImpl`; flags `revealLocked`/`shortIsPlaying`), `sw.js` (bump de `CACHE_VERSION` per contingut), `docs/PROBLEMES_I_SOLUCIONS.md`.

## [2026-07-24] - Transició contínua (seguint el dit) entre Shorts al mòbil

**Context / Millora:** Al mòbil, en llliscar cap amunt/avall dins el modal de Shorts, el vídeo canviava de cop (l'iframe feia `loadVideoById` o canviava `src` al mateix lloc, sense cap moviment). Es demanava que el nou Short aparegués **gradualment i de forma contínua** seguint el dit, com fan TikTok/YouTube Shorts, per donar sensació de continuïtat.

**Repte (per què no és trivial):** Només hi ha **un** iframe de YouTube (reutilitzat via `loadVideoById` per mantenir la sessió i no trencar l'autoplay a iOS — veure entrades de consentiment/autoplay). No es poden apilar múltiples iframes de YouTube en viu (pes, polítiques d'autoplay). Cal, doncs, simular la continuïtat sense precarregar vídeos veïns.

**Solució Implementada (arquitectura de "strip de 3 panells"):**
1. **DOM (`index.html`):** dins de `#shortPlayerWrap` s'afegeix un `#shortStrip` amb tres `.short-pane` verticals — anterior (`top:-100%`), actual (`top:0`) i següent (`top:100%`). El panell central conté l'**iframe real** (`#short-iframe`, id intacte) més un pòster de tapat (`#shortPosterCurrent`); els panells veí mostren la **caràtula** (`#shortPosterPrev`/`#shortPosterNext`) del Short adjacent. El `#shortGestureOverlay` es manté com a fill directe del wrap (per sobre del strip) per capturar tots els gestos.
2. **CSS (`css/styles.css`):** `.short-strip` (`position:absolute; inset:0; transform:translateY(0)`) es mou amb `transform`; `.short-strip.is-sliding` afegeix la transició (280 ms). Els pòsters són `object-fit:cover` i `pointer-events:none` (perquè els gestos arribin a l'overlay). El pòster central té `z-index:2` per tapar l'iframe. Es respecta `prefers-reduced-motion`.
3. **Arrossegament (`js/features/shorts.js`, `setupShortScroll`):** `touchmove` (passiu) tradueix el strip seguint el dit (`translateY(dy)`), amb **axis-lock** (8px) per no confondre scroll vertical amb gestos horitzontals i **resistència rubber-band** als extrems (sense veí). A `touchend`, si la distància supera el llindar (`max(60px, 16% alçada)`) o és un *flick* ràpid, es confirma; si no, torna al centre (`springBack`).
4. **Confirmació (`commitSlide`):** anima el strip fins al panell veí (`±100%`); a `transitionend` (amb *timeout* de seguretat) **tapa el central amb el pòster del nou Short** (`coverWithPoster`), recol·loca el strip al centre sense animació i crida `loadShort()`. Com que el pòster central mostra la mateixa imatge que el panell veí que quedava centrat, el reajust és imperceptible i **tapa el canvi de vídeo dins l'iframe** (evita el *flash* del frame antic).
5. **Destapat del vídeo (`revealCurrentVideo` + `bindShortPlaybackReveal`):** el pòster central es fon quan el Short reporta reproducció (`onStateChange` `info === 1`) via un listener de `message`; hi ha un *timeout* de recanvi (650 ms en calent / 1400 ms en fred) per si no arriba l'esdeveniment.
6. **Compatibilitat preservada:** es manté el **guard de ratolí emulat** (entrada del mateix dia) intacte; el toc simple continua pausant (`toggleShortPlaybackImpl`), la roda (wheel) i el ratolí a l'escriptori mantenen la navegació discreta clàssica per llindar, i el **mode playlist** amb un element següent que no és Short continua tancant el modal i seguint amb `loadVideoInSequence()`. Si el `#shortStrip` no existeix (p. ex. HTML antic en memòria cau durant l'actualització del SW), es degrada a navegació directa sense animació.

**Fitxers Afectats:** `index.html` (estructura del strip), `css/styles.css` (`.short-strip`/`.short-pane`/`.short-pane-poster`), `js/features/shorts.js` (helpers del strip, `setupShortScroll` reescrit, `commitSlide`, `bindShortPlaybackReveal`, `loadShort` i `closeShortModalImpl` ampliats), `sw.js` (bump de `CACHE_VERSION` per contingut via `npm run sw:version`), `docs/PROBLEMES_I_SOLUCIONS.md`.

## [2026-07-24] - El botó/toc de pausa dels Shorts no funcionava a Android mòbil

**Símptoma:** A la versió mòbil (especialment Android), en tocar un Short per pausar-lo el vídeo no s'aturava: es pausava i es reprenia immediatament, de manera que la pausa per toc semblava no funcionar. A l'escriptori funcionava correctament.

**Causa Arrel:** Al modal de Shorts no hi ha un botó de pausa visible; la pausa s'aconsegueix tocant l'overlay de gestos (`#shortGestureOverlay`), que detecta un "tap" i crida `toggleShortPlaybackImpl()` (commuta `playVideo`/`pauseVideo` via `postMessage` a l'iframe de YouTube). A `setupShortScroll()` (js/features/shorts.js) es lligaven **alhora** els esdeveniments tàctils (`touchstart`/`touchend`, passius) i els de ratolí (`mousedown`/`mouseup`) al mateix overlay. Els navegadors mòbils, després d'un `touchend` **no cancel·lat**, disparen esdeveniments de ratolí **emulats** (`mousedown` → `mouseup`) uns ~300 ms més tard. Com que els listeners tàctils són `{ passive: true }` i no poden fer `preventDefault()`, aquests esdeveniments emulats s'emetien igualment. Resultat: un **sol toc** executava `toggleShortPlaybackImpl()` **dues vegades** — primer el `touchend` (pausa, `dataset.shortPaused='true'`) i tot seguit el `mouseup` emulat (reprèn, `dataset.shortPaused='false'`) — deixant el vídeo reproduint-se. A l'escriptori no hi ha esdeveniments tàctils, només el ratolí real, per això només es notava al mòbil.

**Solució Implementada:** A `setupShortScroll()` s'afegeix un guard temporal per ignorar els esdeveniments de ratolí emulats que arriben just després d'un toc:
1. Es manté un timestamp `lastTouchTime` que s'actualitza a `touchstart` i `touchend`.
2. Un helper `isEmulatedMouseEvent(e)` retorna `true` si l'esdeveniment és `mousedown`/`mouseup` i han passat menys de `EMULATED_MOUSE_WINDOW_MS` (700 ms) des de l'últim toc.
3. `handleStart` i `handleEnd` surten aviat (`return`) quan `isEmulatedMouseEvent(e)` és cert, de manera que al mòbil només compta el camí tàctil (una única commutació) i a l'escriptori (sense tocs) els esdeveniments de ratolí segueixen funcionant com sempre. Els tocs reals mai es filtren (només es filtren els esdeveniments de ratolí), per tant tocs successius per pausar/reprendre continuen funcionant.

**Fitxers Afectats:** `js/features/shorts.js` (funció `setupShortScroll`), `sw.js` (bump de `CACHE_VERSION` per contingut via `npm run sw:version`), `docs/PROBLEMES_I_SOLUCIONS.md`.

## [2026-09-29] - La pestanya normal no rebia mai les actualitzacions (només l'incògnit)

**Símptoma:** En una pestanya normal l'app es quedava a una versió antiga; en incògnit (sense SW previ) sí que es veia la nova. Sortia el punt vermell d'actualització però no feia res.

**Causa Arrel:** Des de 2026-04-14 el SW nou no fa `skipWaiting()` i queda *waiting* mentre hi hagi pestanyes obertes. `initAppUpdater()` només mostrava el badge (`#updateBadge`), però **cap codi enviava `SKIP_WAITING`**, ni el badge era clicable, ni es cridava mai `registration.update()`. Una pestanya que es manté oberta o restaurada no s'actualitzava mai.

**Solució Implementada:** `js/app.js` (`initAppUpdater`): registre amb `updateViaCache: 'none'`; si en obrir l'app ja hi ha un SW en espera s'activa de seguida (abans de cap interacció, així no reapareix el bug del refresc durant l'scroll); si la pàgina és en segon pla s'activa sola; si és visible es mostra el badge i el clic aplica l'actualització (`SKIP_WAITING` → `controllerchange` → reload); es força `registration.update()` en obrir, en tornar a la pestanya i cada 30 min.

**Fitxers Afectats:** `js/app.js`, `sw.js` (bump de versió per contingut).

## [2026-09-29] - Ràdio sense artistes repetits i feeds amb varietat

**Canvi:** La cua generada es diu ara **Ràdio**, té una sola cançó per artista (canal) i, si cal repetir per arribar al mínim, mai dues seguides. Sota el reproductor ja no surt "Resultats de la cerca: Cua" sinó vídeos de la mateixa categoria que el vídeo que sona. Els feeds passen per `spreadVideosByArtist()` (`js/utils/helpers.js`) perquè no hi hagi dos vídeos seguits del mateix grup.

**Fitxers Afectats:** `js/utils/helpers.js`, `js/features/music-queue.js`, `js/app.js` (`renderFeedLegacyImpl`, `renderCategoryVideosBelowLegacyImpl`, `renderPlaylistRelatedVideosLegacyImpl`), `tests/helpers.test.js`.

## [2026-09-29] - Files de la portada amb el mateix artista repetit

**Símptoma:** A les files per estil (Novetats, Cançó d'autor...) sortien 2 cançons seguides del mateix artista (CACTUS, Pau Riba, Xanguito).

**Causa Arrel:** `home-sections.js` usava `limitPerChannel(..., 2)`, que permetia 2 vídeos per canal i en respectava l'ordre per data, de manera que quedaven junts.

**Solució Implementada:** `pickVarietyRow()`: primer el vídeo més actual (o més escoltat) de CADA artista i només si la fila no s'omple es repeteix algun. Després `spreadVideosByArtist()` (`js/utils/helpers.js`) reparteix els artistes que queden en majoria perquè no quedin enganxats al final.

**Fitxers Afectats:** `js/features/home-sections.js`, `js/utils/helpers.js`, `tests/home-sections-variety.test.js`, `sw.js`.

## [2026-09-29] - El nom del canal era el handle en comptes del nom real

**Símptoma:** Canals que es mostraven com `elspetsoficial`, `discmedilaxnbusto`, `DemencialWeare`, `CrimPunkRock` o `KitschVideos` en lloc d'Els Pets, Lax'n'Busto, The Demencials, Crim o Kitsch.

**Causa Arrel:** `update_music_feed.js` usava el títol de YouTube (`snippet.title`) tal qual, i per a aquests canals el títol és literalment el handle. El nom real de l'artista (a `artistes-musica.json`) no s'aplicava mai.

**Solució Implementada:** `scripts/lib/nom_canal.js` (`resolveChannelDisplayName`): si el nom és una sola paraula que coincideix amb el handle (o comença per `@`) i el canal té un únic artista, s'usa el nom de l'artista. No toca noms reals amb espais (p. ex. "Lluís Llach"). S'aplica a `update_music_feed.js` i, per corregir ja les dades existents sense API, `node scripts/corregir_noms_canals.js` (idempotent) actualitza `feed.json` i `channels-ca.json`.

**Fitxers Afectats:** `scripts/lib/nom_canal.js`, `scripts/corregir_noms_canals.js`, `scripts/update_music_feed.js`, `data/feed.json`, `js/channels-ca.json`, `tests/nom-canal.test.js`.

## [2026-09-29] - Categories d'estil (Jazz, Rumba, Cançó d'autor, Hip hop) amb el mateix artista seguit

**Símptoma:** A les pàgines d'estil encara sortien dues cançons seguides del mateix artista, tot i tenir el reparteix al feed.

**Causa Arrel:** (1) `renderCategoryHistorySection()` (secció d'arxiu sota la llista) ordenava només per data, així que les tongades d'un artista quedaven juntes. (2) `renderVideos()` treu el hero de la llista (i els Shorts al mòbil) *després* del reparteix: en eliminar un element del mig podia quedar junt amb un altre de l'mateix artista, o el primer igual al hero. (3) La secció "Ja vistos" tampoc es repartia.

**Solució Implementada:** `spreadVideosByArtist()` s'aplica també a l'arxiu (finestra de 400, enllaçant amb l'últim vídeo del feed), a `renderVideos()` després de treure el hero (amb el seu artista com a `previousArtist`) i a "Ja vistos". Regla general: **qualsevol llista que es pinti s'ha de repartir en l'últim pas, després d'ordenar/filtrar/treure elements.**

**Fitxers Afectats:** `js/app.js` (`renderCategoryHistorySection`, `renderVideos`, `appendWatchedVideosSection`), `tests/helpers.test.js`, `sw.js`.

## [2026-09-29] - Portada: «Destacat per tu» i Novetats diferenciades de les categories

**Canvi:** La caixa del vídeo destacat de la portada té ara la capçalera **«Destacat per tu»** (abans «Destacat del moment/de la setmana»; `index.html` i `updateHero()`). A `home-sections.js`, «Últimes novetats» és una fila **gran** (`.home-section--large`, targetes de 300-460 px) i **cronològica pura**, mentre que les files d'estil s'ordenen per `styleScore()` (escoltes amb decaïment d'actualitat, semivida 30 dies) i un vídeo per artista. Així la portada no té totes les files amb el mateix aspecte i ordre.

**Nota per provar:** amb el feed local només queden pocs vídeos a Novetats després dels filtres; per veure la fila cal injectar vídeos a `homeSections.render()` (o esperar a tenir un feed recent).

**Fitxers Afectats:** `index.html`, `css/styles.css`, `js/app.js` (`updateHero`), `js/features/home-sections.js`, `tests/home-sections-variety.test.js`, `sw.js`.

## [2026-09-29] - Canal que es mostra amb el nom del handle (Pawn Gang / «PAWNGANG HUSTLAS»)

**Símptoma:** Un canal continua sortint amb el nom del handle encara que l'artista tingui un altre nom.

**Causa Arrel:** El nom mostrat és el títol de YouTube (`snippet.title`). Si el títol és el handle amb altra grafia (`PAWNGANG HUSTLAS` ↔ `@pawnganghustlas`), la regla automàtica de `nom_canal.js` no el pot canviar sense risc: només actua amb una sola paraula, perquè un nom real amb espais (`Lluís Llach` ↔ `@lluisllach`) és igual de "coincident".

**Solució Implementada:** Fitxer de correccions manuals **`data/noms-canals.json`** (`overrides`: ID de canal `UC...` o handle `@...` → nom a mostrar). Mana sobre qualsevol regla i s'aplica a `update_music_feed.js` (cada regeneració) i a `scripts/corregir_noms_canals.js` (dades ja generades, sense API). El workflow de feed musical també s'executa en canviar aquest fitxer. **Com fer-ho per a un canal nou:** afegeix una línia al fitxer i executa `node scripts/corregir_noms_canals.js`.

**Fitxers Afectats:** `data/noms-canals.json`, `scripts/lib/nom_canal.js`, `scripts/update_music_feed.js`, `scripts/corregir_noms_canals.js`, `.github/workflows/actualitzar-feed-musica.yml`, `data/feed.json`, `js/channels-ca.json`, `tests/nom-canal.test.js`.

## [2026-09-29] - Alta de 16 artistes de cançó d'autor / Nova Cançó amb els seus canals

**Canvi:** Afegits/actualitzats a `data/artistes-musica.json` (gènere manual `genre:manual` = «Cançó d'autor»; «Nova Cançó» i «Galàctic» es recullen a `notes`, no són gèneres de la taxonomia; Pau Riba també «Rock») i a `data/youtube-verified-handles.json`. Molts ja existien amb el nom llarg (Lluís Llach **i Grande**, Jaume Sisa **i Mestres**, Ovidi Montllor **i Mengual**, Pau Riba **i Romeva**, Roger Mas **i Solé**): el resolutor emparella per nom exacte, així que s'ha usat el nom de la BD. Amb ID (`UC...`) s'han escrit directament; amb handle queden pendents de resoldre l'ID amb l'API.

**Resolutor:** `scripts/resoldre_canals_verificats.js` abans saltava qualsevol artista que ja tingués un ID vàlid, de manera que un ID erroni no es corregia mai. Ara un canal es considera resolt només si coincideix amb l'ID indicat o amb el handle indicat; si no, es torna a resoldre i es substitueix (cas de Lluís Llach: `UCqkZBX…` → `UCRorZV…`; Marina Rossell i Cesk Freixas es validen per handle).

**Després de l'alta:** el workflow «Cercar canals YouTube» resol els handles (s'executa en fer push del fitxer de handles). Com que aquest commit el fa el bot amb `GITHUB_TOKEN`, **cal executar manualment «Actualitzar feed musical»** perquè el feed incorpori els vídeos.

**Fitxers Afectats:** `data/artistes-musica.json`, `data/youtube-verified-handles.json`, `scripts/resoldre_canals_verificats.js`.

## [2026-09-29] - Obrir la ràdio a YouTube Music amb el mateix ordre

**Canvi:** Botó **«YouTube Music»** al capçal de la ràdio (`music-queue.js`). Genera `https://music.youtube.com/watch_videos?video_ids=ID1,ID2,...` amb la cua actual (des de la cançó que sona fins al final, mateix ordre que la llista, arrossegaments inclosos; màx. 50 IDs) i l'obre en pestanya nova. YouTube crea una cua temporal (no queda desada al compte).

**Trampa evitada:** `window.open(url, '_blank', 'noopener')` retorna sempre `null`, de manera que un fallback `if (!opened) location.href = url` navegava també l'app. S'usa un `<a target="_blank" rel="noopener">` temporal dins del gest de l'usuari.

**Pendent de verificar en real:** no hem pogut provar que `music.youtube.com/watch_videos` (en lloc de `www.youtube.com/watch_videos`) conservi l'ordre; per canviar d'host només cal tocar `YTM_QUEUE_URL`.

**Fitxers Afectats:** `js/features/music-queue.js`, `css/styles.css`, `tests/music-queue-ytm.test.js`, `sw.js`.

## [2026-09-29] - Forçar que Chrome apliqui la versió nova (pestanya normal amb codi vell)

**Símptoma:** Després d'un desplegament la pestanya normal de Chrome (o la PWA) seguia amb el codi antic; només l'incògnit veia els canvis.

**Causa Arrel:** El SW nou quedava *waiting* (sense `skipWaiting`) i les pestanyes ja obertes tenien el codi vell, que no sap enviar `SKIP_WAITING`; la correcció del client (auto-aplicar, badge clicable) només l'executa qui ja té la versió nova, així que no arribava a qui més la necessitava.

**Solució Implementada:** `sw.js` fa `self.skipWaiting()` a l'`install` **només si `self.registration.active`** (és una actualització, no la primera instal·lació, on l'espera evita el refresc enmig de l'scroll de 2026-04-14). El `controllerchange` de les pestanyes velles ja recarregava si hi havia controller previ, així que s'actualitzen soles (una recàrrega). `initAppUpdater` (versió nova) ajorna la recàrrega mentre sona un vídeo i la fa en amagar la pestanya. Test: `tests/browser/verificar-sw.js` (5a/5b adaptats: s'aplica sola, una sola recàrrega; el comptador ara ignora iframes: abans un sol reload sumava 3 per les 3 frames).

**Nota:** Per a l'usuari que ja té un SW *waiting* d'una versió anterior, cal que Chrome descarregui aquest `sw.js` (ho fa en navegar/recarregar o cada ≤24 h); si no, tancar totes les pestanyes o *Application → Service Workers → Update*.

**Fitxers Afectats:** `sw.js`, `js/app.js` (`initAppUpdater`), `tests/browser/verificar-sw.js`, `CLAUDE.md`.

## [2026-09-29] - Canal equivocat: «Lluc» resolt a Loma Linda University Church

**Símptoma:** A la ràdio i al feed apareixien vídeos d'una església (LLUC | Church Services…) del canal Loma Linda University Church.

**Causa Arrel:** L'artista «Lluc» es va donar d'alta amb el handle `@lluc` (`youtube-verified-handles.json`), que a YouTube pertany a una església adventista. `resoldre_canals_verificats.js` el va resoldre sense cap validació semàntica.

**Solució Implementada:** L'artista queda `rebutjat` amb el canal buit i una nota; s'elimina l'entrada de `youtube-verified-handles.json` (si no, el resolutor la tornaria a afegir, ja que no mira `reviewStatus`); el canal i els seus vídeos desapareixen de `feed.json` i `channels-ca.json` en regenerar-se el feed (el workflow «Actualitzar feed musical» s'executa en fer push d'`artistes-musica.json`). **No s'editen a mà els fitxers generats en una branca:** el bot els actualitza cada poques hores a `main` i provoquen conflicte de merge a cada PR (va passar aquí tres cops). Si es vol l'artista Lluc real, cal trobar el seu canal i tornar-lo a donar d'alta amb l'ID `UC…` (no amb un handle ambigu).

**Fitxers Afectats:** `data/artistes-musica.json`, `data/youtube-verified-handles.json`, `data/feed.json`, `js/channels-ca.json`.

## [2026-09-29] - `music.youtube.com/watch_videos` no importa la llista

**Símptoma:** El botó obria YouTube Music però sense la cua (només l'app).

**Causa Arrel:** `watch_videos?video_ids=...` és una funció de `www.youtube.com` (crea una llista temporal `TL...`); `music.youtube.com` no la implementa i la ignora. La suposició de l'entrada anterior («Pendent de verificar») era errònia.

**Solució Implementada:** `YTM_QUEUE_URL` apunta a `https://www.youtube.com/watch_videos?video_ids=`. El botó passa a dir «Obre a YouTube»: obre la cua en l'ordre exacte i, amb «Desa», la llista queda a la biblioteca i es pot obrir des de YouTube Music. **Si es vol importar directament a YouTube Music** cal crear una llista real amb l'API de YouTube (OAuth + ~50 unitats de quota per vídeo).

**Fitxers Afectats:** `js/features/music-queue.js`, `tests/music-queue-ytm.test.js`.

## [2026-09-29] - Nom de la llista exportada a YouTube

**Canvi:** L'enllaç `watch_videos` porta `&title=` amb el nom de la llista: **«Llista <categoria>»** si la ràdio va néixer dins d'una categoria d'estil (`selectedCategory`, excloent vistes generals: Novetats, Tot, Descobreix, Seguint, Radar), si no **«Llista <primer grup>»** (canal de la cançó que sona) i, en una llista pròpia, «Llista <nom de la llista>». El nom també es copia al porta-retalls en prémer el botó. `music-queue.js` (`buildListName`, `radioCategory`).

**No verificat amb YouTube real:** no tenim confirmació que `watch_videos` accepti `title` (és un paràmetre no documentat); per això el nom es copia al porta-retalls, perquè en «Desar» només calgui enganxar-lo. Si YouTube l'ignora, l'única via garantida per posar nom és crear la llista amb l'API (OAuth).

**Fitxers Afectats:** `js/features/music-queue.js`, `tests/music-queue-ytm.test.js`, `sw.js`.

## [2026-09-29] - Vídeos que no són cançons (concert, pel·lícula, making-of) arribaven a vistes sense filtre

**Símptoma:** Del canal d'Els Amics de les Arts sortien «UN CONCERT COM ELS D'ABANS» (pel·lícula del concert), «ENCARA SOM AQUÍ (Una cançó basada en fets reals)» (explicació) i «FESTES DE LA MERCÈ» (55 s), tot i que el feed ja els classifica com `review`.

**Causa Arrel:** El filtre `isCategoryEligibleVideo` (només `song`/`live_song`) només s'aplicava a Novetats/Tot, a les categories d'estil i a les files de la portada. **No** passaven pel filtre: la vista **Seguint**, **Descobreix**, el **perfil del canal**, la branca sense categoria dels «vídeos relacionats» i la **ràdio** (`buildQueue`).

**Solució Implementada:** Helper `isSongOrShort()` (`app.js`) aplicat a Seguint, Descobreix, perfil de canal i relacionats; la ràdio filtra amb `isCategoryEligibleVideo`. Els Shorts i els vídeos sense `contentType` (canals afegits a mà, snapshots antics) hi passen. Al classificador (`scripts/lib/classificar_contingut_musical.js`) s'afegeixen a la descripció negativa «pel·lícula», «cortometratge», «short film» i «d'on surt la cançó». **Regla:** qualsevol vista nova que llisti vídeos ha de passar pel filtre de cançons.

**Fitxers Afectats:** `js/app.js`, `js/features/music-queue.js`, `scripts/lib/classificar_contingut_musical.js`, `sw.js`.

## [2026-09-29] - La ràdio d'una fila/categoria no era de la categoria (Cançó d'autor, etc.)

**Símptoma:** A la portada, en clicar una cançó de la fila «Cançó d'autor», la ràdio generada barrejava tots els estils.

**Causa Arrel:** (1) `startFrom()` només mirava `selectedCategory`, que a la portada és «Novetats» (vista general), així que no sabia de quina fila venia el clic. (2) Encara que hi hagués categoria, `buildQueue()` només en canviava el *nom* de la llista: els candidats eren tot el feed.

**Solució Implementada:** Les seccions de la portada porten `data-category`; un listener de clic en captura (`music-queue.js`) recorda la categoria de la fila clicada (`clickCategory`) i `startFrom()` la consumeix (si no, usa `selectedCategory` fora de vistes generals). `buildQueue(video, category)` filtra els candidats amb `matchesCategory()` (categories del vídeo o del canal al feed, `Pop / Rock` = Pop+Rock, categories personalitzades amb `matchesCustomCategory`). Si la categoria té menys de 2 cançons, cau a ràdio general perquè la reproducció no s'aturi. «Barreja» conserva la categoria (`radioCategory`). Verificat en Chromium: Cançó d'autor (20/20 de la categoria), Rap / Hip-hop (12/12), Jazz / Blues (12/12).

**Fitxers Afectats:** `js/features/music-queue.js`, `js/features/home-sections.js`, `sw.js`.

## [2026-09-29] - Escriptori: la finestra de la ràdio sobrepassava els botons del canal

**Símptoma:** Amb el reproductor obert a escriptori, el panell de la ràdio (a la dreta) baixava més enllà de l'última fila de botons de l'esquerra (Canal YouTube, comentaris...).

**Causa Arrel:** `#playlistQueueContainer` s'estenia sobre **5** files de la graella de `.watch-main`, però la 5a la ocupa la capçalera «Altres vídeos relacionats» (o el panell de programació de TV), i a més tenia una alçada pròpia (`max-height: 100vh - …`). Quedava 89 px més llarga, i 24 px més pel `margin-bottom` de `.channel-info`.

**Solució Implementada:** `css/styles.css` (escriptori, ≥1025 px): la cua abasta **4 files** (`grid-row: 1 / span 4`; 5 només si el panell de TV és visible), `align-self: stretch` + `contain: size` perquè no aporti alçada pròpia i s'estiri a l'àrea de la columna de l'esquerra, `margin-bottom: 24px` (= el de `.channel-info`) i `overflow-y: auto` amb el capçal de la ràdio enganxat a dalt (`position: sticky`). La capçalera de relacionats passa a ocupar les dues columnes (`.extra-related-header`). Mesurat en Chromium a 1100/1200/1440/1920 px: diferència 0 px entre el final de la cua i el del bloc del canal.

**Fitxers Afectats:** `css/styles.css`, `sw.js`.

## [2026-09-29] - Ràdio: escriptori sense relacionats i la llista es conserva amb la finestra flotant

**Canvi 1 (escriptori):** Amb una ràdio sonant no es mostren «Altres vídeos relacionats» ni els vídeos de l'artista (`.watch-sidebar`, `.extra-related-header`, `.extra-videos-grid`): CSS amb `#watchPage:has(#playlistQueueContainer:not(.hidden) .mq--radio)` (`css/styles.css`, ≥1025 px). `music-queue.js` afegeix la classe `mq--radio` quan la cua és la ràdio; a `app.js` tampoc es pinten (`renderPlaylistRelatedVideosLegacyImpl`, `showVideoFromAPILegacyImpl`).

**Canvi 2 (finestra flotant):** **Causa:** `showHome/showHistory/showPlaylists/showFollow` (navigation.js), `openChannelProfile` i `openProgramProfile` cridaven sempre `exitPlaylistMode()`, així que en navegar amb la ràdio en mini el vídeo seguia sonant però la cua es perdia (en expandir, sense llista; i sense avanç automàtic). **Solució:** `exitPlaylistModeForNavigation()` (app.js) no surt del mode llista si la finestra flotant és activa i no és TV; el hook de navegació hi apunta. Perquè l'avanç automàtic amb l'usuari en una altra secció no el porti a la pàgina del reproductor, `showVideoFromAPILegacyImpl` calcula `keepPage` (avanç automàtic + mini + watchPage amagada) i llavors no canvia de pàgina, no fa `pushState` ni `scrollTo`; la cançó nova es carrega a la finestreta. En tancar la finestreta fora de la pàgina del vídeo, se surt del mode llista. Verificat en Chromium: ràdio → flotant → portada (cua conservada) → següent (la portada continua visible, índex 1) → expandir (pàgina del vídeo amb la ràdio a la dreta, «Ràdio 2/40»).

**Nota:** `tests/browser/verificar-tv.js` ja fallava 4 comprovacions abans d'aquests canvis (entorn sense YouTube real); `verificar-reproductor.js` passa.

**Fitxers Afectats:** `js/app.js`, `js/features/music-queue.js`, `css/styles.css`, `sw.js`.

## [2026-09-29] - Cançons amb títol en castellà al feed

**Símptoma:** Apareixien cançons amb títol en castellà (MARLENA, Ceaxe, Umpah Pah, les actuacions de Serrat a TVE, etc.).

**Causa Arrel:** El feed musical (`update_music_feed.js`) no aplica cap filtre d'idioma; el depurador antic (`scripts/depurar_videos_catala.js`) mira també la **descripció** i marca com a castellà títols catalans (Pau Riba, Guillem Ramisa, Cesk Freixas...: 60 marcats, la majoria falsos positius), per això no es pot fer servir sense revisió.

**Solució Implementada:** Es van revisar a mà els 1.458 títols de cançons i `scripts/ocultar_titols_castella.js` (regles per canal, idempotent, `--dry-run`) n'afegeix 97 IDs a `data/hidden-videos.json`. El client ja el respecta a tot (feed, arxiu, cerques, ràdio) i `update_music_feed.js` ara també descarta els IDs ocults en regenerar el feed. **No s'ha tocat `feed.json`** (generat pel bot). Criteri: es conserven els títols catalans encara que l'artista sigui castellanoparlant o el títol tingui paraules compartides (p. ex. «Per al Meu Amic (Concierto…)» de Serrat, «AQUELLA NIT» de Ceaxe, els de miquel en català). Per ocultar-ne de nous, afegeix la regla a `REGLES` i executa el script.

**Fitxers Afectats:** `scripts/ocultar_titols_castella.js`, `scripts/update_music_feed.js`, `data/hidden-videos.json`, `tests/ocultar-titols-castella.test.js`.

## [2026-09-29] - Fora la barra anterior/play/següent sota el reproductor; MARLENA descartada

**Canvi 1:** Els controls anterior / play-pausa / següent ja són dins del reproductor, així que s'elimina la barra pròpia `#nowPlayingBar` (`music-queue.js`, `initTransport`; CSS `.now-playing-bar` / `.np-btn`). Es conserven els controls del sistema (Media Session). **Atenció a la graella d'escriptori:** la barra era una de les files que abasta la ràdio; ara la ràdio abasta **3 files** (reproductor, títol, canal; 4 si el panell de TV és visible). Verificat: final de la ràdio = final del bloc del canal (0 px de diferència) a 1200/1440/1920 px.

**Canvi 2:** MARLENA (repertori en castellà) queda `rebutjada` a `artistes-musica.json` amb el canal buit, sense l'entrada a `youtube-verified-handles.json` (si no, el resolutor la tornaria a afegir) i tots els seus vídeos a `hidden-videos.json`. El canal desapareix del feed i de `channels-ca.json` quan es regeneri (el push d'`artistes-musica.json` dispara «Actualitzar feed musical»).

**Fitxers Afectats:** `js/features/music-queue.js`, `css/styles.css`, `data/artistes-musica.json`, `data/youtube-verified-handles.json`, `data/hidden-videos.json`, `sw.js`.

## [2026-09-30] - Controls de la cua sobre el reproductor: grans, centrats i amb play/pausa

> **Actualització (2026-10-01):** el botó de play/pausa propi i la capa tàctil s'han tret (feien que el play/pausa no reaccionés); vegeu «El play/pausa del reproductor (normal i flotant) sovint no reaccionava». Queden anterior · següent · finestra flotant.

**Canvi:** El mini-control anterior/següent (a baix a l'esquerra, 48 px) passa a ser un grup **centrat** dins el reproductor: anterior · **play/pausa** · següent (72/92/72 px; 56/72 a mòbil; 34/44 a la finestreta flotant). `createQueueNextOverlay()` (`app.js`) + CSS `.queue-controls`. Visibilitat: amb el ratolí sobre el reproductor són **fixos** (`sticky`, sense temporitzador; `pointerenter`/`pointermove`); en marxar es queden ~3 s (`pointerleave`) i s'amaguen; en pausa són sempre visibles; en tàctil, el toc al vídeo els mostra 3 s. Només els botons capturen clics (el grup té `pointer-events: none`), així que la resta del vídeo continua responent a YouTube. La icona play/pausa segueix `data-player-state` (MutationObserver) i la classe `.queue-next-button` es conserva perquè analytics/tv-learning l'escolten.

**Limitació tècnica:** el ratolí sobre un `<iframe>` de YouTube no envia `mousemove` a la pàgina pare (només `pointerenter`/`pointerleave`), per això la lògica és «fix mentre és a sobre + 3 s en marxar» i no «3 s des de l'últim moviment».

**Verificat en Chromium:** amagats sense ratolí; visibles amb ratolí a sobre (i encara fixos 4 s després); 0,8 s després de marxar visibles; 3,8 s després amagats; centrats (0 px de desviació); «anterior» amagat a la primera cançó.

**Fitxers Afectats:** `js/app.js`, `css/styles.css`, `sw.js`.

## [2026-09-30] - Noms de grup sense «Oficial»

**Canvi:** El nom mostrat d'un grup no porta mai «Oficial»/«Official» (Aspencat, Buhos, Ginestà, KOP, Txarango). `stripOfficialWord()` a `scripts/lib/nom_canal.js`, aplicada a `cleanChannelDisplayName()` d'`update_music_feed.js` (cada regeneració del feed, per a `feed.json`, `channels-ca.json` i el `channelTitle` dels vídeos) i a `resoldre…` via `resolveChannelDisplayName`. Un nom que només fos «Oficial» es conserva. Les **correccions manuals** de `data/noms-canals.json` continuen manant. Els fitxers generats no s'editen a mà: el canvi arriba amb el proper «Actualitzar feed musical» (es dispara en fer push d'`update_music_feed.js`), o executant `node scripts/corregir_noms_canals.js` en local.

**Fitxers Afectats:** `scripts/lib/nom_canal.js`, `scripts/update_music_feed.js`, `tests/nom-canal.test.js`.

## [2026-09-30] - La música realment antiga sortia massa entre la dels darrers anys

**Símptoma:** Cançons de fa dècades (Nova Cançó, rock dels 80-90) apareixien amb la mateixa freqüència que les novetats.

**Causa Arrel:** `publishedAt` no serveix per detectar-les: el catàleg clàssic (Raimon, Llach, Ovidi, Serrat...) es va pujar fa poc (canals Topic), així que semblaven recents. Només el 7 % tenia 8+ anys per data.

**Solució Implementada:** «Antic» = artista de `data/musica-classica.json` (22 artistes, editable; nom d'`artistes-musica.json` sense accents/majúscules) **o** vídeo de fa 8+ anys (`anysAntic`). `SegueixMusicCategories.isClassicVideo()` (`js/music-categories.js`) i `limitClassicFrequency()` (`js/utils/helpers.js`): com a molt **1 de cada 5** és antic, conservant l'ordre de cada grup (els antics que sobren van al final). S'aplica a les llistes de categoria (`renderFeedLegacyImpl`), a les files de la portada (`pickVarietyRow`, a més de `CLASSIC_SCORE_FACTOR = 0.2` a `styleScore`) i a la ràdio (`buildQueue`: 1 de cada 5, o 1 de cada 2 si la cançó que sona ja és antiga). Amb el feed actual (23 % d'antigues) el top 20 d'una categoria en porta ~4. Per ajustar: canvia `every` o afegeix/treu artistes del JSON. **No afecta** l'arxiu de sota les categories (és antic per naturalesa).

**Fitxers Afectats:** `data/musica-classica.json`, `js/music-categories.js`, `js/utils/helpers.js`, `js/app.js`, `js/features/home-sections.js`, `js/features/music-queue.js`, `tests/helpers.test.js`, `tests/home-sections-variety.test.js`, `sw.js`.

## [2026-09-30] - Botó de finestra flotant dins dels controls del reproductor

**Canvi:** Al grup de controls sobre el reproductor (anterior · play/pausa · següent) s'hi afegeix el botó de **finestra flotant** (`.queue-mini-button`, la mateixa icona de quatre fletxes que el de sota el reproductor), a la dreta de «següent». Va en posició absoluta (`left: 100%`) perquè el play/pausa continuï exactament al centre; fa el 70 % de la mida dels altres, i s'amaga quan la finestreta ja és activa (té el seu propi botó d'expandir). En clicar-lo: `hideQueueNextOverlay()` + `setMiniPlayerState(true)`. Verificat en Chromium (centrat 0 px, la finestreta s'activa).

**Fitxers Afectats:** `js/app.js` (`createQueueNextOverlay`), `css/styles.css`, `sw.js`.

## [2026-09-30] - La ràdio no continuava sola amb la finestra flotant

**Símptoma:** Amb una ràdio en finestra flotant, en acabar la cançó la següent no arrencava.

**Causa Arrel:** En mode flotant `showVideoFromAPILegacyImpl` crida `queuePlayback()`, que (a diferència de `prepareWatchPlaybackPreview`, que rep `autoPlay`) només deixava preparat el placeholder i esperava un **clic** a `.play-overlay`, que queda amagat darrere la finestreta. `shouldAutoPlay` mai hi arribava.

**Solució Implementada:** `queuePlayback`/`queuePlaybackLegacyImpl` accepten `autoPlay`; si és avanç automàtic i YouTube està acceptat (`hasAcceptedYouTubeCookies()`), carreguen la cançó directament amb `loadNewVideoInMiniPlayer()`. Només la 1a crida de `showVideoFromAPI` porta `autoPlay` (la 2a, d'enriquiment amb l'API, no, per no recarregar l'iframe dues vegades). `keepPage` passa a ser «avanç automàtic amb finestra flotant» (abans només amb la pàgina del vídeo amagada): no canvia de pàgina ni fa `scrollTo`; si la pàgina del vídeo és visible s'actualitza la URL amb `replaceState`. Sense consentiment de YouTube continua demanant el clic (no es pot forçar). Verificat en Chromium (stub de `loadNewVideoInMiniPlayer`): amb la pàgina del vídeo i amb la portada, la cançó següent es carrega sola, la finestreta continua activa i l'scroll es manté.

**Fitxers Afectats:** `js/app.js`, `sw.js`.

## [2026-09-30] - Controls del reproductor més petits i play/pausa com el de YouTube

**Canvi:** `.queue-controls` (css/styles.css): anterior/següent passen de 72 a **42 px** (40 a mòbil, 28 a la finestreta) i el mini-botó de finestra flotant a 0,7×. El play/pausa deixa de ser un cercle blanc de 92 px i copia el **botó gran central de l'embed de YouTube**: rectangle **68×48 px**, cantonades de 12 px, fons `rgba(33,33,33,.8)` i vermell `#f00` en passar-hi el ratolí, icona blanca de 26 px, al centre exacte del reproductor, de manera que en pausa queda just a sobre del de YouTube i no es veuen dos botons.

**Suposició:** «el pause del reproductor original» s'ha interpretat com aquest botó central (no la barra de controls de baix, que és dins l'iframe i no es pot moure). Les mides/colors són les de la interfície pública de YouTube i **no s'han pogut comparar amb l'embed real** (aquí no es carrega YouTube): si no coincideix al mil·límetre, els valors són `--qc-main-w`, `--qc-main-h` i `border-radius` de `.queue-toggle-button`.

**Fitxers Afectats:** `css/styles.css`, `sw.js`.

## [2026-09-30] - Controls del reproductor: play/pausa rodó, centrat sempre i sense vermell

**Canvi:** Anterior/següent 50 px (44 a mòbil, 28 a la finestreta), play/pausa **rodó** de 66 px (58/38) amb anell blanc, fons fosc i **sense vermell** (en passar-hi el ratolí només s'enfosqueix). **Centrat:** `.queue-controls` és una graella `1fr · var(--qc-main) · 1fr` d'amplada simètrica; abans era un `flex` centrat, i quan «anterior» s'amagava (primera cançó) el grup es re-centrava i el play/pausa quedava desplaçat mitja mida de botó a la dreta. Ara «anterior» (columna 1, `justify-self: end`) i «següent» (columna 3, `start`) no mouen el del mig; el botó de finestra flotant continua fora de flux (`left: 100%`). Mesurat en Chromium: desviació 0 px del play/pausa respecte del centre del reproductor amb i sense «anterior». (Substitueix el rectangle 68×48 de l'entrada anterior.)

**Fitxers Afectats:** `css/styles.css`, `sw.js`.

## [2026-07-11] - Filera d'icones del header visible en obrir un vídeo al mòbil

**Símptoma:** Al mòbil, en clicar un vídeo del feed i obrir-se la pàgina del reproductor, la filera d'icones del header (Inici, Biblioteca, Historial, Segueix...) es mostrava a sobre del reproductor, ocupant espai vertical útil mentre l'usuari volia veure el vídeo.

**Causa Arrel:** La lògica d'amagar el header (`updateMobileHeaderOnScroll`) només s'activava en fer scroll cap avall, i tenia una regla de "sempre visible a prop de dalt" (`scrollY ≤ MOBILE_HEADER_HIDE_OFFSET`). Com que la pàgina del reproductor s'obre amb el reproductor a dalt de tot (scrollY petit), aquesta regla mantenia la filera d'icones sempre visible mentre es mirava el vídeo.

**Solució Implementada:**
1. **`collapseMobileHeaderForWatchPage()`**: nova funció que, al mòbil, afegeix la classe `nav-hidden` al `.app-header` en obrir la pàgina del reproductor. Es crida des dels dos punts d'entrada que mostren el `watchPage` (`showVideoFromAPILegacyImpl` i `openVideoFromUserGesture`), just després de `watchPage.classList.remove('hidden')`. Aplica un cooldown perquè cap scroll immediat (p. ex. el `scrollIntoView` del reproductor) torni a mostrar la filera de seguida.
2. **`updateMobileHeaderOnScroll()`**: la regla de "sempre visible a prop de dalt" ara se salta quan `watchPage` és visible (`onWatchPage`). Així la filera queda amagada mentre es mira el vídeo i només reapareix quan l'usuari fa scroll cap amunt (mecanisme d'histèresi ja existent), consistent amb el comportament del feed.
3. **`revealMobileHeaderNav()`**: nova funció cridada des de `handlePlayerVisibilityOnNavigation()` (chokepoint de totes les navegacions a Inici/Historial/Llistes/Segueix/Canal) que torna a mostrar la filera en sortir del reproductor, garantint que no quedi amagada si l'usuari hi era a dalt de tot (scrollY 0) i no es dispara cap esdeveniment d'scroll.

**Fitxers Afectats:** `js/app.js` (noves funcions `collapseMobileHeaderForWatchPage`, `revealMobileHeaderNav`; modificacions a `updateMobileHeaderOnScroll`, `handlePlayerVisibilityOnNavigation`, `showVideoFromAPILegacyImpl`, `openVideoFromUserGesture`), `sw.js` (bump de versió per contingut), `docs/PROBLEMES_I_SOLUCIONS.md`.

## [2026-07-11] - Botó de cerca enganxat a la marca "Segueix!" a la pàgina del reproductor (mòbil)

**Símptoma:** A la pàgina del reproductor al mòbil, el botó de cerca (la icona lila) quedava enganxat just a la dreta de la marca "Segueix!", deixant un gran espai buit a la resta de la filera superior. Amb la filera d'accions amagada mentre es mira el vídeo, la descompensació era molt evident.

**Causa Arrel:** Al mòbil el header és un grid `auto 1fr` amb la marca a la columna 1 i el `.search` (form flex, `width: 100%`) a la columna 2. Tot i tenir `justify-self: end`, el form ocupa tota l'amplada de la columna i el botó `.mobile-search-toggle` s'alinea a l'inici del flex (`flex-start`), de manera que queda enganxat a la marca. A la resta de pàgines la filera d'accions inferior dissimulava el desequilibri, però a la pàgina del reproductor (accions amagades) quedava a la vista.

**Solució Implementada:**
1. **Classe `watch-page-active` al `body`**: s'afegeix a `collapseMobileHeaderForWatchPage()` (en obrir el reproductor) i s'elimina a `revealMobileHeaderNav()` (en sortir-ne), reaprofitant els chokepoints ja existents. S'aplica independentment del viewport; el CSS només l'utilitza al mòbil.
2. **CSS (mòbil):** `body.watch-page-active .search:not(.is-open) { justify-content: flex-end; }` empeny el botó de cerca cap a la dreta, separat de la marca. La resta de pàgines (Inici, etc.) queden inalterades.

**Fitxers Afectats:** `js/app.js` (`collapseMobileHeaderForWatchPage`, `revealMobileHeaderNav`), `css/styles.css` (regla dins `@media (max-width: 768px)`), `sw.js` (bump de versió per contingut), `docs/PROBLEMES_I_SOLUCIONS.md`.

## [2026-07-11] - El Service Worker invalidava tot el cache de codi a cada sincronització de dades

**Símptoma:** Els clients tornaven a descarregar tot el codi estàtic (index.html, styles.css i els ~25 scripts, ~800KB) a cada obertura, i veien l'avís d'actualització diverses vegades al dia, tot i que el codi no havia canviat. El `CACHE_NAME` del SW anava per `mytube-v417` (~400 increments).

**Causa Arrel:** Dos problemes acoblats. (1) `scripts/sincronitzar_tot.js` incrementava `CACHE_NAME` (`mytube-vNNN`) a **cada** sincronització de dades (4-5/dia) per forçar la propagació de fitxers com `js/channels-ca.json`, `data/support.json` i `data/archive/**`, que queien al `cacheFirst` i sinó quedaven obsolets per sempre. Cada increment invalidava **tot** el cache, inclòs el codi que no havia canviat. (2) A més, el `fetch` marcava els `.js`/`.css` com a network-first amb `cache: 'reload'`, de manera que fins i tot sense bump es re-descarregaven a cada càrrega. El cache de codi es destruïa més ràpid del que s'amortitzava. Com a efecte secundari, el precache llistava només 10 fitxers (faltaven `js/core/`, `js/utils/`, `js/features/`), deixant l'app trencada offline després d'una activació nova.

**Solució Implementada:**
1. **Dos caches amb cicles de vida separats** a `sw.js`: `static-<hash>` (shell de codi, **cache-first**, versionat pel contingut real) i `data-v1` (dades de runtime, **mai versionat**; network-first per a feed/índexs, stale-while-revalidate per a la resta). Les dades ja no invaliden mai el codi.
2. **Versionat per contingut:** `scripts/actualitzar_versio_sw.js` (`npm run sw:version`) parseja `index.html`, regenera el bloc `AUTO-GENERAT` de precache i calcula `CACHE_VERSION` com a hash SHA-256 del contingut dels assets (excloent `sw.js` per evitar realimentació). La versió només canvia quan el codi canvia; idempotent.
3. **Precache complet:** els 25 scripts + CSS + HTML + manifest + icones + `caratula.png` (33 assets), corregint l'offline trencat.
4. **Migració automàtica:** l'`activate` esborra qualsevol cache que no sigui `static-<hash>` ni `data-v1`, migrant els clients de `mytube-vNNN` sol. Es conserva el no-`skipWaiting()` a install (bug de 2026-04-14) i el handler `SKIP_WAITING`.
5. Eliminat el bloc de bump de `sincronitzar_tot.js`; afegit un pas `sw:version` a `actualitzador.yml`.

**Fitxers Afectats:** `sw.js` (reescrit), `scripts/actualitzar_versio_sw.js` (nou), `scripts/sincronitzar_tot.js`, `.github/workflows/actualitzador.yml`, `package.json` (`sw:version`).

## [2026-04-14] - Tremolor del header al mòbil després d'amagar la filera d'icones

**Símptoma:** A la versió mòbil, quan l'usuari feia scroll i la filera d'icones superior s'amagava, en continuar desplaçant-se (o en aturar-se just després) la capçalera es posava a tremolar, alternant entre estat amagat i visible.

**Causa Arrel:** La lògica d'amagar/mostrar només comprovava el delta d'un sol esdeveniment d'scroll amb un llindar petit (6px). Quan la filera col·lapsava, la transició CSS sobre `max-height`/`padding`/`gap` provocava un layout-shift al document. En mòbil, aquest layout-shift combinat amb el moviment de la barra d'URL (Safari/Chrome mòbil) i amb micromoviments de scroll (rubber-band, momentum) generava esdeveniments d'scroll amb delta negatiu petit però superior al llindar, que tornaven a mostrar la filera; la reaparició provocava un nou layout-shift i la seqüència es tornava a repetir = tremolor visible.

**Solució Implementada:**
1. **Histèresi asimètrica amb ancora acumulativa** a `updateMobileHeaderOnScroll()`: es manté una `_headerScrollAnchorY` que es reinicia només quan la direcció d'scroll canvia. El llindar s'avalua sobre el desplaçament acumulat des de l'ancora, no sobre el delta d'un sol esdeveniment. Amagar requereix 10px cap avall; mostrar requereix 24px cap amunt (valor més alt perquè un micro-bounce no faci reaparèixer la filera).
2. **Cooldown de 350ms** (`MOBILE_HEADER_COOLDOWN_MS`) després de cada canvi d'estat: durant aquest temps s'ignoren els esdeveniments d'scroll, deixant acabar la transició CSS (280ms) i que el layout s'estabilitzi abans de reavaluar.
3. **Guard explícit a prop de dalt:** si `scrollY ≤ MOBILE_HEADER_HIDE_OFFSET` (60px) la filera sempre es mostra i es reinicia l'ancora, garantint que tornar al capdamunt deixa el header en estat net.

**Fitxers Afectats:** `js/app.js` (funció `updateMobileHeaderOnScroll` i constants associades).

## [2026-04-14] - L'enllaç de compartir categories/llistes mostrava "Segueix! - Els nostres YouTubers" a WhatsApp

**Símptoma:** En compartir una categoria personalitzada o intel·ligent (o una llista) via el botó natiu, WhatsApp mostrava el text "Segueix! - Els nostres YouTubers" al costat de l'enllaç, en lloc del nom de la categoria o llista. L'usuari esperava veure "Categoria: [Nom]" o "Llista: [Nom]" acompanyant l'URL.

**Causa Arrel:** La funció `_showShareOptionsModal()` cridava `navigator.share({ url: shareUrl })` passant només l'URL, sense cap `title` ni `text`. Quan WhatsApp/Telegram/etc. reben una compartició amb només URL, fan fetch de l'URL per obtenir les meta Open Graph per generar el preview. L'`index.html` de Segueix! té `<meta property="og:title" content="Segueix! - Els nostres YouTubers">`, i com que tots els enllaços de compartició apunten al mateix domini amb el mateix HTML, totes les previsualitzacions ensenyaven aquest títol genèric.

**Solució Implementada:** A `_showShareOptionsModal()`, construir un `shareText = "${typeLabel}: ${name}"` (p. ex. `"Categoria: Cuina"` o `"Llista: Favorits"`) i passar-lo com a `title` i `text` al `navigator.share()`. Això fa que el missatge precedit pel nom aparegui abans de l'URL i que WhatsApp l'usi com a text principal de la compartició, fins i tot si el preview Open Graph (controlat pel HTML del lloc) continua mostrant el títol genèric per sota.

**Fitxers Afectats:** `js/app.js` (funció `_showShareOptionsModal`).

## [2026-04-14] - Refresc espontani al mòbil en obrir l'app i fer una mica d'scroll

**Símptoma:** A la versió mòbil, en obrir l'aplicació i començar a fer scroll, l'app es refrescava sola al cap de pocs segons. L'usuari perdia la posició de scroll i veia el loader/splash una altra vegada.

**Causa Arrel:** Cadena d'auto-activació del Service Worker. `sw.js` cridava `self.skipWaiting()` dins de l'event `install` i `self.clients.claim()` dins de `activate`. Combinat amb el listener `controllerchange` a `app.js` (`initAppUpdater`), qualsevol activació d'un SW nou — incloent la primera presa de control del SW en una sessió "neta" — disparava `window.location.reload()`. Al mòbil la instal·lació/activació del SW és asíncrona i pot completar-se segons després de la càrrega inicial, just quan l'usuari està fent scroll, provocant el refresc aparent.

**Solució Implementada:**
1. **`sw.js`**: eliminat `self.skipWaiting()` de l'event `install`. El SW nou es queda en estat `waiting` fins que el client l'activi explícitament (via missatge `SKIP_WAITING`) o fins que es tanquin totes les pestanyes. `clients.claim()` es manté perquè és necessari per a la primera instal·lació quan encara no hi ha controller previ.
2. **`app.js` (`initAppUpdater`)**: capturada la variable `hadControllerOnLoad = Boolean(navigator.serviceWorker.controller)` abans de registrar el SW. El listener `controllerchange` només fa `window.location.reload()` si hi havia controller en carregar la pàgina (cas d'actualització real). Si no n'hi havia (primera instal·lació), només s'amaga el badge d'update sense recarregar.

**Fitxers Afectats:** `sw.js`, `js/app.js` (funció `initAppUpdater`).

## [2026-04-14] - Filera d'icones del header no s'amagava al fer scroll al mòbil

**Símptoma:** Al mòbil, la filera d'icones del header (Inici, Biblioteca, Historial, Segueix, Configuració, Afegeix YouTuber) ocupava permanentment una franja a sota de la cerca mentre l'usuari feia scroll, reduint l'espai útil per veure el feed.

**Causa Arrel:** No hi havia cap lògica d'scroll reactiu sobre el header. El header (`position: sticky`) sempre mostrava les dues fileres (marca+cerca i accions) fins i tot quan l'usuari volia veure contingut.

**Solució Implementada:**
1. **`js/app.js`**: nova funció `updateMobileHeaderOnScroll()` que afegeix/treu la classe `nav-hidden` al `.app-header` segons la direcció d'scroll. Integrada dins del rAF del listener de scroll existent (`bindCoreEvents`) per no afegir listeners addicionals. Paràmetres: llindar de 6px per evitar reaccions a tremolors, i offset mínim de 60px perquè no s'amagui abans que l'usuari surti de la capçalera. Si la cerca mòbil està oberta (`body.mobile-search-active`), la filera es manté visible. Només s'activa si `window.matchMedia('(max-width: 768px)').matches`.
2. **`css/styles.css`** (dins del `@media (max-width: 768px)`): la filera `.actions` té transició sobre `max-height`, `opacity`, `transform`, `margin` i `padding`. La classe `.app-header.nav-hidden .actions` aplica `max-height: 0; opacity: 0; transform: translateY(-8px); pointer-events: none;`. El header també col·lapsa el seu `row-gap`/`gap` i redueix el `padding-bottom` perquè no quedi un espai buit entre la cerca i el contingut.

**Fitxers Afectats:** `js/app.js` (nova funció `updateMobileHeaderOnScroll` i crida dins de `bindCoreEvents`), `css/styles.css` (regles dins del media query `(max-width: 768px)` per a `.actions` i `.app-header.nav-hidden`).

## [2026-03-17] - Interfície en blanc i perfils fantasma en obrir vídeos del feed
**Símptoma:** En clicar un vídeo de la portada, la pàgina de reproducció carregava el vídeo però la resta de la UI quedava en blanc. La barra lateral dreta mostrava el canal de l'últim vídeo vist.

**Causa Arrel:** Problema de desincronització d'estat ("cache miss") a `app.js`. L'aplicació només buscava les dades locals a l'array de cerques (`cachedAPIVideos`), ignorant els vídeos precarregats de la portada (`YouTubeAPI.feedVideos`). Com que la IA fallava, la funció s'aturava a mig camí.

**Solució Implementada:** 1. Netejar `.innerHTML` de la barra lateral dreta immediatament en obrir la pàgina. 2. Combinar tots els arrays de dades coneguts (`YouTubeAPI.feedVideos`, `currentFeedVideos` i `cachedAPIVideos`) en un de sol abans de buscar el vídeo a la memòria cau per evitar pantalles en blanc. 3. Forçar l'execució de `renderCategoryVideosBelow` independentment de si hi havia dades del canal o no.

**Fitxers Afectats:** `js/app.js` (dins de la funció `showVideoFromAPILegacyImpl`).

## [2026-03-17] - Vídeos vistos desapareixien del feed en Desktop; botó "Mostra'n més" innecessari

**Símptoma:** En Desktop, els vídeos ja vistos s'eliminaven completament del feed (igual que a mòbil), fent que el feed semblés buit si l'usuari havia vist molts vídeos. A més, les seccions d'Històric i Historial de categories personalitzades mostraven només 12 vídeos amb un botó "Mostra'n més" que en Desktop no calia perquè hi ha prou espai de pantalla.

**Causa Arrel:** La funció `renderFeedLegacyImpl()` aplicava `filterOutWatchedVideos()` indistintament en Desktop i mòbil, eliminant tots els vídeos vistos del feed. Les seccions d'Històric/Historial usaven sempre paginació amb `SECTION_INITIAL = 12` independentment de la mida de pantalla. No hi havia cap diferenciació de comportament entre Desktop i mòbil.

**Solució Implementada:**
1. **`renderFeedLegacyImpl()`**: Condicionat `filterOutWatchedVideos()` perquè només s'apliqui a mòbil (`!isDesktopView()`). En Desktop, tots els vídeos es passen al renderitzador.
2. **`renderVideos()`**: En Desktop, separa els vídeos en dos grups — nous (`freshVideos`) i ja vistos (`watchedVideos`). Els nous es mostren primer i els vistos s'afegeixen a la part inferior en una secció titulada "Ja vistos" via la nova funció `appendWatchedVideosSection()`. S'usa `maxVisible: 0` a `batchRenderCards` per evitar que l'infinite scroll intercali vídeos nous enmig de les seccions d'historial.
3. **`navigateToSearchResults()`**: Mateixa separació als resultats de cerca en Desktop — vídeos nous a dalt, "Ja vistos" a baix.
4. **`renderCategoryHistorySection()`**: En Desktop, mostra tots els vídeos directament (`showAll = isDesktopView()`) sense el botó "Mostra'n més". A mòbil manté la paginació original.
5. **Nova funció `appendWatchedVideosSection()`**: Crea un bloc HTML amb títol "Ja vistos", un grid de targetes, i configura els event listeners necessaris (clics, enllaços canal, icones, botons d'acció).

**Fitxers Afectats:** `js/app.js` (funcions `renderFeedLegacyImpl`, `renderVideos`, `navigateToSearchResults`, `renderCategoryHistorySection`, nova `appendWatchedVideosSection`).

## [2026-03-17] - La categoria activa quedava seleccionada durant una cerca, mostrant vídeos del feed barrejats

**Símptoma:** En fer una cerca (ex: "Barça"), els resultats apareixien correctament (vídeos relacionats + històric), però a sota també es mostraven vídeos de la categoria "Novetats" perquè el chip quedava actiu. Això confonia l'usuari, que esperava veure només resultats de cerca.

**Causa Arrel:** La funció `navigateToSearchResults()` (i `searchVideosLegacyImpl()`) no modificava `selectedCategory` ni desactivava els chips de la barra de categories. El chip "Novetats" (o qualsevol que estigués actiu) mantenia la classe `is-active`, donant a entendre que la cerca era un filtre dins d'aquella categoria. A més, si `renderFeed()` s'executava posteriorment, filtrava per la categoria activa i podia mesclar contingut.

**Solució Implementada:**
1. **`navigateToSearchResults()`**: Abans de mostrar els resultats, elimina `is-active` de tots els chips (`chipsBar.querySelectorAll('.chip.is-active')`) i posa `selectedCategory = null`. Cap categoria queda seleccionada durant la cerca.
2. **`searchVideosLegacyImpl()`**: Mateixa lògica de desselecció per al camí alternatiu via YouTube API.
3. **`filterVideosByCategory()`**: Afegit guard `!selectedCategory` al principi perquè retorni tots els vídeos si la categoria és `null`, evitant un `null.toLowerCase()` en cas que `renderFeed()` s'executés durant una cerca.
4. **Comportament post-cerca:** Quan l'usuari clica un chip de categoria, `selectedCategory` es reassigna normalment des de `chip.dataset.cat` i el feed es renderitza amb la categoria triada. No es guarda `null` a `localStorage`, per tant al recarregar l'app torna a la última categoria vàlida.

**Fitxers Afectats:** `js/app.js` (funcions `navigateToSearchResults`, `searchVideosLegacyImpl`, `filterVideosByCategory`).

## [2026-03-18] - Categories personalitzades no incorporaven vídeos de programes ni permetien gestionar-los des del modal
**Símptoma:** Els vídeos d'un programa assignat a una categoria personalitzada no apareixien al feed d'aquella categoria si el títol o la descripció del vídeo no contenien explícitament el nom de la categoria. A més, el modal de gestió de contingut de categoria només mostrava canals complets i no deixava veure ni eliminar els programes individuals associats a la categoria.

**Causa Arrel:** La funció `refreshCustomCategorySearch()` depenia principalment d'una cerca per paraula clau amb el nom de la categoria, de manera que ignorava vídeos publicats als canals dels programes quan aquests vídeos no mencionaven la categoria al text. Paral·lelament, `openManageCategoryYoutubersModal()` només consultava `getChannelsForCategory()` i no incorporava `getPrograms()` per resoldre les assignacions de categoria a nivell de programa.

**Solució Implementada:** 1. A `refreshCustomCategorySearch()`, mantenir el flux `stale-while-revalidate`, però afegir una recuperació proactiva dels vídeos dels canals explícitament assignats a la categoria i dels canals dels programes que tenen aquesta categoria mitjançant `YouTubeAPI.getChannelVideosWithHistory()`. 2. Fusionar aquests resultats amb la resta de fonts usant `mergeUniqueVideos()` i aplicar al final el filtre estricte `matchesCustomCategory()` per evitar falsos positius. 3. A `openManageCategoryYoutubersModal()`, incorporar els programes vinculats a la categoria, mostrar-los diferenciats amb l'etiqueta `(Programa)` i afegir l'acció `remove-category-program` per eliminar la categoria del programa via `updateProgram()`.

**Fitxers Afectats:** `js/app.js` (funcions `refreshCustomCategorySearch` i `openManageCategoryYoutubersModal`), `docs/PROBLEMES_I_SOLUCIONS.md`.

## [2026-03-18] - Ocultar vídeos puntuals sense editar manualment `data/feed.json`
**Símptoma:** Quan calia amagar uns quants vídeos concrets del feed, la solució més directa era eliminar-los de `data/feed.json`. Això era fràgil perquè el fitxer és la base canònica del feed i es regenera amb el pipeline; a més, qualsevol re-sync podia reintroduir els vídeos o generar conflictes de merge.

**Causa Arrel:** No existia cap mecanisme específic per excloure vídeos de manera declarativa. L'app assumia que tot el que hi havia a `data/feed.json`, als arxius de canal i als resultats de la API s'havia de mostrar, de manera que l'única alternativa era tocar la font principal de dades.

**Solució Implementada:** 1. Crear `data/hidden-videos.json` amb una llista `videoIds` per centralitzar els vídeos a ocultar. 2. Fer que `YouTubeAPI.loadFeed()` carregui aquesta llista abans de restaurar el snapshot o aplicar el feed, i encapsular la lògica en `loadHiddenVideos()`, `isVideoHidden()` i `filterHiddenVideos()`. 3. Aplicar el filtre no només al feed principal, sinó també al snapshot local, als arxius de canal, a l'històric antic, a les playlists obtingudes via API, als resultats de cerca i als detalls de vídeo, per evitar que un vídeo ocult reaparegui per una altra via. 4. Actualitzar el service worker perquè `data/hidden-videos.json` tingui estratègia `networkFirst` i canvi de versió de cache, assegurant que els canvis de la llista es propaguin ràpidament.

**Fitxers Afectats:** `data/hidden-videos.json`, `js/youtube.js`, `sw.js`, `docs/PROBLEMES_I_SOLUCIONS.md`.


## [2026-03-22] - Consentiment antic i autoplay ocult mantenien la inèrcia de YouTube abans del nou flux
**Símptoma:** Encara que es volgués evolucionar cap a un consentiment progressiu, la web mantenia una inèrcia antiga amb YouTube: preferències prèvies guardades, reproducció preparada abans d'entrar a la pàgina del vídeo i estat del reproductor que podia quedar viu entre intents. Això feia difícil garantir que la Fase 1 tallés del tot el vincle previ amb YouTube.

**Causa Arrel:** El consentiment es persistia a `segueix_cookie_consent_v1`, de manera que usuaris que ja havien acceptat mantenien l'autorització antiga sense passar pel flux nou. A més, `playThenNavigateLegacyImpl()` precarregava un iframe amb autoplay abans de completar la navegació a la pàgina del vídeo, i el reset en rebutjar cookies no netejava tota la sessió incrustada.

**Solució Implementada:** 1. Bump del storage key a `segueix_cookie_consent_v2` i neteja explícita de les claus antigues per obligar l'app a començar sense heretar consentiments previs. 2. Nova funció `clearEmbeddedYouTubeSession()` per esborrar payloads pendents, tallar l'autoplay latent i buidar el reproductor abans de qualsevol nou intent sense consentiment. 3. `playThenNavigateLegacyImpl()` deixa de crear l'iframe ocult abans d'hora i ara navega primer, deixant que la càrrega del reproductor depengui del flux de consentiment. 4. El reset dels Shorts també esborra l'iframe i l'estat del player per evitar que quedi una sessió incrustada reutilitzable.

**Fitxers Afectats:** `js/app.js`, `js/features/shorts.js`, `docs/PROBLEMES_I_SOLUCIONS.md`.

## [2026-04-08] - Caràtula per defecte per a vídeos sense coberta (reemplaça el placeholder gris de YouTube)
**Símptoma:** Alguns vídeos del feed (exemple: "95. Feim panades", id `PTcgV82jsKk`) mostraven el placeholder gris de YouTube (la icona d'una pantalla amb tres punts) en comptes d'una caràtula útil. Això feia que el feed es veiés trencat visualment.

**Causa Arrel:** YouTube té dos comportaments quan una caràtula no està disponible:
1. `sddefault.jpg` / `maxresdefault.jpg` retornen **HTTP 404** amb un cos JPEG petit (120×90) — dispara l'event `error` de la imatge.
2. `hqdefault.jpg` pot retornar **HTTP 200** però amb el mateix placeholder de 120×90 — NO dispara `error`, només `load`.

L'únic listener existent (al voltant de la línia 3200 d'`app.js`) només amagava la imatge amb `visibility: hidden` i només cobria els contenidors `.video-thumbnail`, `.hero-thumbnail` i `.video-placeholder`, deixant fora altres contenidors i classes com `.archive-video-thumb`, `.search-result-thumb`, `.sidebar-video-thumb`, `.playlist-video-thumb`, `.short-thumb`, `.related-thumbnail`, `.archive-video-thumb-wrap`, `.playlist-card-thumb` i `.smart-cat-thumb`.

**Solució Implementada:**
1. **Nova imatge `img/caratula.png`** — caràtula genèrica per a tots els vídeos sense coberta vàlida.
2. **`isVideoThumbnailImage(img)`** — helper que identifica si una `<img>` és una caràtula de vídeo, comprovant tant classes pròpies (`archive-video-thumb`, `search-result-thumb`, `sidebar-video-thumb`, `playlist-video-thumb`, `short-thumb`) com contenidors pare (`video-thumbnail`, `hero-thumbnail`, `video-placeholder`, `related-thumbnail`, `archive-video-thumb-wrap`, `playlist-card-thumb`, `smart-cat-thumb`).
3. **`applyDefaultVideoThumbnailFallback(img)`** — substitueix la `src` per `img/caratula.png` i marca la imatge amb `dataset.defaultThumbnailFallback = 'applied'` per evitar bucles infinits.
4. **Listener `error` global (fase de captura)** — reemplaça el comportament antic de `visibility: hidden` per la substitució a la caràtula per defecte. Gestiona els casos de 404 (p. ex. `sddefault.jpg` inexistent).
5. **Listener `load` global (fase de captura)** — detecta el placeholder gris de YouTube comparant `naturalWidth === 120 && naturalHeight === 90` quan la src prové de `ytimg.com`. Així cobrim el cas d'HTTP 200 amb cos placeholder.
6. **Service Worker**: `img/caratula.png` s'afegeix a `urlsToCache` i es fa bump de `CACHE_NAME` de `mytube-v25` a `mytube-v26` per garantir que es precaché la caràtula de fallback per a ús offline.

**Fitxers Afectats:** `js/app.js` (listeners globals i helpers nous), `sw.js` (precache + cache bump), `img/caratula.png` (nou asset), `docs/PROBLEMES_I_SOLUCIONS.md`.

## [2026-03-20] - Migració de `search_index_*` a model híbrid anual/mensual i guia de reversió
**Símptoma:** Per poder escalar la cerca històrica amb molts més canals, es va substituir el model d'un únic fitxer `search_index_YYYY.json` per any per un model híbrid: anys antics en fitxers anuals i anys recents en fitxers mensuals. Això també va introduir un manifest nou i un workflow manual per regenerar l'índex. Si cal desfer aquest canvi en un futur, cal tenir clar tot el que es va tocar perquè la reversió no deixi l'app en un estat inconsistent.

**Causa Arrel:** El model anual era senzill però poc flexible per créixer. La solució implementada va repartir els índexs recents per mes i va afegir una capa de descoberta (`data/search_index_manifest.json`) perquè el frontend sabés quins fragments carregar. Com que l'app i els workflows van quedar acoblats a aquest model híbrid, revertir només una part del canvi podria trencar la cerca/històric recent.

**Solució Implementada:**
1. **Generador híbrid a `scripts/generar_index_cerca.js`:** es van afegir `MANIFEST_PATH`, `MONTHLY_RECENT_YEARS` i `getBucketDescriptor(date)` per decidir si cada vídeo històric va a un bucket anual (`search_index_2024.json`) o mensual (`search_index_2026_03.json`). El generador ara esborra els antics `search_index_*.json`, reescriu tots els fragments i crea `data/search_index_manifest.json` amb la llista de buckets i el recompte de vídeos.
2. **Frontend de cerca a `js/app.js`:** es va substituir el seguiment d'anys carregats per seguiment de buckets (`loadedSearchArchiveBuckets`, `failedSearchArchiveBuckets`), es va afegir `loadSearchArchiveManifest()` per llegir el manifest i `loadSearchArchiveBucket()` per carregar fragments mensuals o anuals. `loadSearchArchiveIndexLegacyImpl()` ara intenta primer el manifest i, si no existeix, només fa fallback al patró anual antic. El cache de `localStorage` també es va migrar de `years` a `buckets`, mantenint compatibilitat cap enrere.
3. **Nous artefactes de dades:** es van eliminar fitxers antics com `data/search_index_2025.json` i `data/search_index_2026.json`, i es van crear shards mensuals (`data/search_index_2025_01.json` ... `data/search_index_2026_03.json`) més `data/search_index_manifest.json`.
4. **Workflows:**
   - `actualitzador.yml` es va ajustar perquè després de regenerar l'índex faci `git add -A data`, capturant també baixes d'índexs antics.
   - es va crear `.github/workflows/reindexar_search_index.yml`, un workflow manual amb `workflow_dispatch` que executa `npm run search:index:hybrid:rebuild`, commiteja i pusheja canvis a `data/`.
5. **Scripts npm i documentació:** a `package.json` es van afegir `search:index` i `search:index:hybrid:rebuild`; a `CLAUDE.md` es va documentar que `data/search_index_*.json` passa a ser híbrid i que existeix `data/search_index_manifest.json`.

**Guia de reversió (per dirigir Codex en un altre fil):**
1. **Tornar el generador al model anual simple:**
   - eliminar `MANIFEST_PATH`, `MONTHLY_RECENT_YEARS` i `getBucketDescriptor()` de `scripts/generar_index_cerca.js`.
   - tornar a agrupar sempre per any (`compactByYear`) i reescriure només `data/search_index_YYYY.json`.
   - deixar de generar `data/search_index_manifest.json`.
2. **Revertir el frontend a càrrega anual:**
   - a `js/app.js`, substituir `loadedSearchArchiveBuckets`/`failedSearchArchiveBuckets` per `loadedSearchArchiveYears`/`failedSearchArchiveYears`.
   - eliminar `searchArchiveManifestPromise`, `loadSearchArchiveManifest()` i `loadSearchArchiveBucket()`.
   - restaurar `loadYearIndex(year)` perquè torni a fer `fetch('data/search_index_${year}.json')`.
   - a `saveArchiveIndexCache()` / `loadArchiveIndexCache()`, tornar a guardar `years` en lloc de `buckets`.
3. **Regenerar els artefactes de dades anuals:**
   - esborrar `data/search_index_manifest.json`.
   - esborrar tots els shards mensuals `data/search_index_2025_*.json`, `data/search_index_2026_*.json`, etc.
   - recrear `data/search_index_2025.json`, `data/search_index_2026.json` i la resta anual amb el generador restaurat.
4. **Revertir automatitzacions:**
   - eliminar `.github/workflows/reindexar_search_index.yml` si ja no cal el workflow manual híbrid.
   - a `.github/workflows/actualitzador.yml`, revisar si es vol mantenir `git add -A data` o tornar a una estratègia més concreta per als índexs anuals.
   - eliminar de `package.json` els scripts `search:index` / `search:index:hybrid:rebuild` si no aporten valor en el model antic.
5. **Validació després de revertir:**
   - comprovar que tornen a existir `data/search_index_2025.json`, `data/search_index_2026.json`, etc.
   - comprovar que `data/search_index_manifest.json` ja no existeix.
   - verificar que la cerca històrica torna a funcionar carregant índexs anuals sense dependència del manifest.

**Fitxers Afectats:** `scripts/generar_index_cerca.js`, `js/app.js`, `.github/workflows/actualitzador.yml`, `.github/workflows/reindexar_search_index.yml`, `package.json`, `CLAUDE.md`, `data/search_index_manifest.json`, `data/search_index_2025_*.json`, `data/search_index_2026_*.json`, `docs/PROBLEMES_I_SOLUCIONS.md`.

### 🐛 Canals invisibles a la web tot i estar al Google Sheets i al feed

**Símptomes:**
- L'script de GitHub (`update_feed.js`) s'executa correctament i descarrega els vídeos de tots els canals nous.
- Els canals desapareixen o no s'afegeixen a la interfície de la web (només se'n mostren una part, ex. 112 de 178).
- A Cloudflare Pages els desplegaments fallen en 0 segons.

**Causa:**
Hi havia dos problemes independents:
1. **Desincronització de l'índex:** L'acció de GitHub actualitzava el `feed.json` (vídeos), però no executava `sincronitzar_tot.js`. Com que la web utilitza `js/channels-ca.json` com a font de la veritat per la pestanya de canals, la interfície llegia un llistat antic i no indexava els nous.
2. **Conflicte de compilació a Cloudflare:** En detectar un arxiu `package.json` a l'arrel, Cloudflare assumia que era un projecte de Node.js (Wrangler/Workers) i obria un assistent d'instal·lació interactiu que feia fallar el desplegament automàtic en un entorn sense interfície.

**Solució aplicada:**
1. **GitHub Actions:** S'ha afegit el pas `node scripts/sincronitzar_tot.js` a `.github/workflows/actualitzador.yml` immediatament després de generar el feed, i s'han afegit les ordres `git add -f js/channels-ca.json` i `git add -f sw.js` al commit automàtic perquè la web s'actualitzi i la memòria cau es trenqui per als usuaris.
2. **Cloudflare Pages:** S'ha modificat la configuració de construcció (Build Configuration) de Cloudflare deixant el *Framework preset* a `None` i configurant el *Build command* com a `exit 0` perquè ignori el `package.json` i publiqui els arxius estàtics directament des de l'arrel `/`.
