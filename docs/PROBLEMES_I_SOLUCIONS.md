## [2026-10-12] - WhatsApp: l'enllaç d'una ràdio diu «Ràdio <nom>»

**Problema:** en compartir l'enllaç d'una ràdio a WhatsApp, la previsualització era la genèrica de l'app: el robot de WhatsApp llegeix les etiquetes Open Graph de l'HTML i no executa JavaScript, i `?importData=` apunta a `index.html`. GitHub Pages és estàtic: no hi ha cap manera de canviar l'`og:title` segons el paràmetre.

**Solució:** una pàgina estàtica per a cada nom de ràdio conegut, `compartir/radio/<slug>.html`, amb `og:title` «Ràdio <nom>» i un script que redirigeix a l'app amb el mateix `location.search` (el robot no el veu). Les genera `generar_pagines_compartir.js` (estils, ràdios generals, municipis de `data/municipis-radio.json`, llocs dels orígens i artistes; ~2.500 pàgines, ~4 MB) i deixa la llista a `compartir/radio/index.json`, que l'app llegeix en compartir (`resolveRadioShare()`). **Trampes:** (1) el títol i el slug s'han de calcular igual a l'app i al generador: el generador carrega `share-codecs.js` amb `vm` en lloc de copiar-ne la lògica; (2) el generador esborra tota la carpeta `compartir/` a cada execució, per això les ràdios es generen dins el mateix `generate()`; (3) el QR de la imatge no canvia (l'enllaç més llarg podia passar de `MAX_QR_URL_LENGTH`); (4) un nom sense pàgina va a la genèrica i el nom viatja en el text del missatge.

Warning: truncated output (original token count: 81021)
Total output lines: 1955

## [2026-10-12] - Compartir «A prop teu» amb la localitat triada

L'enllaç (`?importData=`, tipus `nearby`) no porta cançons sinó la localitat (nom, territori, coordenades del municipi a 3 decimals) i el tipus de ràdio: qui l'obre calcula els artistes amb el seu catàleg. Privacitat: només es pot compartir una localitat triada; la posició del GPS mai surt de l'aparell. **Trampes:** (1) l'enllaç es processa en arrencar, abans que el feed hagi carregat: `load()` espera `YouTubeAPI.feedLoaded` (fins a 20 s) o la llista sortiria buida; (2) el diàleg és un `<dialog>` modal a la capa superior, i la finestra de compartir (un `div` amb `z-index`) quedava a sota i no es podia tocar: `share()` tanca el diàleg abans d'obrir-la; (3) la localitat i el tipus rebuts no es desen: en tancar el diàleg es tornen a llegir els de l'usuari (`origin.shared`).

## [2026-10-12] - Mòbil: «Música» retallat a la marca de la capçalera

**Símptoma:** al mòbil la marca «Segueix! Música» sortia amb «Música» tallat a la dreta.

**Causa:** la lletra de la marca anava en `rem` per trams d'ample. Amb la mida de lletra més gran (la de la configuració canvia `font-size` de `<html>`; també la del sistema), el text creixia però l'espai de la marca (la columna entre el logo i la cerca, amb `overflow: hidden`) no: a 360–412 px «Música» sortia de la caixa. Amb la mida per defecte hi cabia amb 1 px de marge.

**Solució:** la lletra de la marca es calcula amb l'ample real del contenidor: `min(1.0625rem, calc((100cqi - 40px) / 7.9))` per al nom i `/ 7.8` per a «En català» (40 px = logo + marge). Comprovat a 320–430 px amb lletra de 16, 19 i 22 px: sempre queden ≥ 4 px de marge. Prova: `tests/contacte.test.js`.

## [2026-10-12] - «Acabades de sortir» canviava d'una vegada a l'altra

**Símptoma:** a vegades la fila mostrava les novetats més actuals i, més tard (o en tornar a obrir l'app), en faltaven algunes o n'hi entraven de més antigues.

**Causes:**
1. **La «destacada» invisible.** `buildModel()` triava una novetat destacada (`pickFeatured()`: puntua més un artista que ja coneixes o un videoclip) i la **treia** de la fila, però la portada ja no la pinta com a targeta (només n'agafa la caràtula per al collage de «La teva ràdio»). Com que depèn del gust, en escoltar música la destacada canviava i la cançó que faltava a la fila era una altra; sovint era justament la més nova.
2. **Dos camins de càrrega amb dades diferents.** `YouTubeAPI.getPopularVideos()` (el de cada dia: `loadVideosFromAPI`, i també la còpia de `catube_feed_v1`) copiava els vídeos camp per camp i **perdia `originalYear`**, `topicTrack`, `originalTitle`… Sense l'any original, `isNewRelease()` prenia per estrena qualsevol reedició pujada fa poc (amb el feed del 2026-10-12: 146 «estrenes» en lloc de 98). L'altre camí (`loadVideos()`, `YouTubeAPI.feedVideos`) sí que les tenia: la fila variava segons per on s'havia carregat.
3. **(Intencionat)** `filterOutWatchedVideos()` amaga de Novetats les cançons ja escoltades: en escoltar-ne una, n'entra una de més antiga.

**Solució:** la destacada ja no es «pren» (no es treu de cap fila) i `getPopularVideos()` conserva tots els camps (`...v`). Proves: `tests/portada.test.js` («Acabades de sortir» estable) i `tests/novetats-estables.test.js`. Després, a petició de l'usuari, la causa 3 també s'ha tret: a la portada (`selectedCategory === 'Novetats'` amb `portada`) `renderFeedLegacyImpl()` ja no crida `filterOutWatchedVideos()` (`keepWatchedNovetats`), i «Acabades de sortir» mostra sempre les estrenes més recents, escoltades o no. Les categories continuen amagant les escoltades.

## [2026-10-12] - «A prop teu»: caràtules amb distància i tipus de ràdio per popularitat

La targeta i la llista ara tenen caràtules (com «La teva ràdio» i la cua) amb els km. Les caràtules de la portada necessiten les dades (orígens + historial): `cardHtml()` és síncron, així que pinta el radar i programa `hydrateCard()`, que en acabar substitueix `[data-near-art]`; el resultat es guarda a `state.card` (zona + tipus) perquè els repintats de la portada el mostrin de seguida. **Trampa:** `hydrateCard()` fa servir `computeRows()`, que escriu a `state.rows`; si el diàleg és obert es restaura el que s'hi veu.

Tipus de ràdio: `rankByType()` ordena les cançons d'un artista per `viewCount` (desc. o asc.) o delega en el motor. «Joies amagades» evita els vídeos amb 0 visualitzacions si l'artista en té d'altres. En tancar el diàleg la targeta es torna a pintar (zona nova).

## [2026-10-12] - «A prop teu» més visible i usable; marca «Segueix! Música · En català»

**Problema:** la targeta «A prop teu» era una caixa de text al fons de la portada (després de tots els estils) i calia obrir el diàleg cada vegada, fins i tot amb la localitat desada. El diàleg sortia enganxat a dalt a l'esquerra (el `margin` del `<dialog>` quedava anul·lat pels estils globals), sense jerarquia i, al mòbil, amb els botons barrejats amb la llista.

**Solució:** la targeta va just després de «Comença per aquí», amb un radar decoratiu, i amb una localitat desada fa «Engega la ràdio» d'un toc (`quickPlay()`: carrega les dades, calcula les files amb `computeRows()` i crida `playSelection()` sense diàleg; si falla, obre el diàleg). El diàleg porta `position: fixed; inset: 0; margin: auto` explícits (centrat), és a pantalla completa al mòbil i té capçalera i botons fixos. **Trampa:** `renderRows()` i `status()` han de tolerar que el diàleg encara no existeixi (el camí d'un toc no el crea).

La marca torna a ser «Segueix! Música» amb «En català» a sota (colors de la pantalla d'espera). A 320 px no hi cap el logo amb el nom sencer: s'amaga el logo, no cap paraula.

## [2026-10-12] - Ràdio secundària «A prop teu»

Targeta sota «Tria el teu so», abans dels directes. Diàleg amb localitat manual o geolocalització puntual, sense radi: 20 artistes únics per proximitat, una pista de cadascun. «Altres cançons» conserva artistes i ordre; «20 artistes més» mostra el següent lot sense repetir. La selecció és revisable abans d’iniciar el reproductor (primer toc manual de YouTube conservat).

`nearby-radio.js` fa Haversine localment sobre els orígens validats i agrupa oficial/Topic per la identitat del registre d’orígens. El motor musical escull una pista de cada artista; abans es filtren ocults, bloquejats, rebutjats, Shorts, contingut no musical i vídeos ja detectats com a no disponibles. La cua manté l’ordre geogràfic en actualitzar gustos i no ofereix barreja automàtica; es pot renovar des del diàleg. La distància aproximada i la referència també es mostren a la cua.

`data/proximitat-musical.json` aporta referències a les 18 zones sense municipi. Les capitals no esdevenen l’origen real: els artistes conserven comarca/illa i es mostra «referència: …». Vallès utilitza Granollers, Sabadell i Terrassa (la més propera); Montseny utilitza Sant Celoni com a referència del Baix Montseny, sense atribuir una capital oficial al massís. No es modifica `origens-artistes.json`.

Cerca manual amb localitats conegudes i Open-Meteo/GeoNames, filtrada per identificadors territorials de Catalunya, País Valencià, Balears, Pirineus Orientals i Andorra. Es descarten aeroports i altres territoris. Errors de xarxa conserven resultats locals; respostes antigues no trepitgen una selecció nova. No cal que el poble tingui un artista indexat.

Privacitat: geolocalització només al clic, sense seguiment ni desar/enviar coordenades GPS. La preferència manual es desa amb clau local `segueix_nearby_manual_v1`, fora de la configuració sincronitzada. Una precisió pitjor de 10 km remet a la selecció manual. La consulta externa només envia el nom cercat. Proves amb els cinc territoris, distàncies, capitals, múltiples vincles, duplicats, lots i integració de cua.

## [2026-10-12] - Cercador a les llistes, marca i actualització amb vídeo flotant

Les llistes noves obren el cercador de cançons i les existents tenen «Afegeix cançons». La cerca local combina feed i historial musical filtrat, per títol/artista sense accents, exclou Shorts i contingut no musical i evita IDs duplicats. Les cançons afegides es marquen i es desen amb el mateix circuit de llistes i sincronització. Les respostes tardanes no modifiquen un altre modal.

«Sempre tinc sort» incorpora «Canvi automàtic de color de fons». La capçalera mostra «Descobreix música en català» a l’ordinador i «Música CAT» al mòbil, conservant el canvi al logo en amplades petites.

**Revisió del segon pla:** la pausa amb pestanya amagada és intencionada segons les polítiques de YouTube (https://developers.google.com/youtube/terms/developer-policies, apartat III.I.9). Es conserva l’excepció quan el vídeo és visible a la finestra flotant del sistema. S’ha detectat un conflicte: l’actualitzador del service worker podia activar-se i recarregar mentre aquesta finestra seguia oberta. Les tres vies automàtiques d’activació/recàrrega ara comproven que no hi hagi vídeo flotant; l’actualització explícita continua disponible. No s’afegeix reproducció amb pantalla apagada.

## [2026-10-12] - Llançaments prioritaris: pilot Anna Andreu

**Causa:** el catàleg només reconeixia descripcions «Provided to YouTube by». Els àudios oficials d’Anna Andreu indiquen «Àlbum», i les llistes també inclouen àlbums sencers i directes. Inferir-los només dels últims vídeos deixava discos incomplets.

**Correcció:** registre revisat `data/llancaments-musicals.json`, amb prioritat llançament > llista oficial > discografia contrastada > inferència. El pipeline recupera totes les pistes declarades, respecta les exclusions i les decisions manuals, agrupa variants oficial/Topic i conserva ordre, tipus i caràtula. La fitxa selecciona una versió disponible per pista i manté l’ordre del disc. Les llistes es comproven setmanalment amb paginació; les novetats queden pendents a `data/llancaments-estat.json`, sense incorporar contingut no revisat. Un error conserva l’última lectura.

**Pilot:** Anna Andreu: *Els Mals Costums*, *La mida* i *Vigília* (8 pistes cadascun), *Tots els cingles* (2 pistes catalanes disponibles; excloses les castellanes i la pista exclusiva física). Ordre i caràtules contrastats amb Hidden Track Records. Lladruc conserva els seus 12 vídeos, ara amb àlbum i senzill explícits. El vincle territorial vigent de Lladruc és Sabadell. No s’ha estès encara la revisió editorial a tots els artistes.

**Verificació:** proves de prioritat, agrupació, ocultació, paginació, memòria cau, errors, propietari de llista i delimitació dels canals. Les dades generades es publiquen exclusivament pel pipeline.

## [2026-10-12] - Categories amb artistes únics i alta de Lladruc

**Problema:** `summarizeStyles()` comptava els canals publicadors com si fossin artistes diferents; oficial i Topic duplicaven el nombre i les caràtules. Les rajoles de categories personals també comptaven els IDs desats sense agrupar-los.

**Correcció:** els dos recomptes fan servir `SegueixMusicCategories.artistKeyForChannel()`; mantenen el canal com a alternativa quan no hi ha una identitat coneguda. Cada artista compta una sola vegada a cada estil, amb una caràtula; les seleccions i canals de les categories personals es conserven íntegres. Es mantenen el filtre de cançons reproduïbles i l’ordre de novetat de les caràtules. Versions de les dues URLs de scripts actualitzades i service worker regenerat. Proves amb oficial + Topic, artistes amb diversos estils, caràtula absent al Topic i preservació dels IDs desats.

**Lladruc:** canal oficial `UCvab9QKJ1NEdMJObwZkA39A` (`@Lladrucband`), Punk, origen Vallès segons el canal i Linktree. Selecció tancada de les dotze pistes dels llançaments *Ho tornarem a fer* i *Som-hi nois*, amb parelles ID/canal distribuïdor verificades. Traçabilitat a `docs/revisions/2026-10-12-lladruc.json`. El feed i els discos es generen amb el pipeline ordinari.

## [2026-10-12] - Orígens revisats sense vincle al canal publicat

**Causa comprovada:** ASSAC! (Barcelona), The Cabrians (Mataró) i Pesta Porcina (Torelló) tenien fitxes validades a `artists` d’`origens-artistes.json`, però els tres IDs publicats faltaven a `channels`. La fitxa consulta per ID de canal, de manera que la població no es mostrava tot i existir.

**Correcció:** afegits els tres vincles als artistes ja revisats. Contrastats els 545 canals publicats amb els artistes, els llocs i el model real de la fitxa: 544 amb localització resoluble i Club Social Carme exclòs expressament. Cap discrepància entre el nom de l’artista del canal i l’assignació. La prova de cobertura de `tests/artist-origin.test.js` recorre tots els canals publicats, incloses les exclusions explícites; abans del canvi detecta ASSAC! sense localització.

## [2026-10-12] - La descoberta esborrava artistes verificats manualment

**Causa comprovada:** el commit `f515896b722080dffa630d94c01a5807f90166c0` (2026-10-05) va eliminar Anna Andreu, Guillem Ramisa i Paul Fuster. Les fitxes tenien canals verificats i fonts `manual-user-*` / `youtube:manual-verified`, però encara `reviewStatus: pendent`, `active: false` i notes buides. La poda de `descobrir_artistes_musica.js` només acceptava dues evidències de Wikidata i les considerava candidats febles. Les altres quatre baixes del mateix commit sí que responien al registre d’exclusions.

**Correcció:** `shouldKeepArtist()` preserva les incorporacions i verificacions manuals abans de descartar candidats febles. Les exclusions explícites continuen tenint prioritat. Prova de regressió amb els estats antics dels tres artistes, candidats automàtics i retirades explícites. Anna Andreu i Guillem Ramisa es restauren amb els mateixos canals i gèneres, ara aprovats. Paul Fuster ja s’havia reincorporat el 2026-10-06: es reforça la selecció de *Repte* als deu IDs exactes.

**Serrat, nova indicació de l’editor:** es retira només la seva exclusió global i es recupera `@joanmanuelserrat`, amb 87 pistes dels nou discos d’estudi en català de 1967–1989. Els llançaments apareixen al canal oficial, però el distribuïdor de les gravacions és `UCrUiOJEGdgQEh6Ol4tPLJNg`: `allowedExternalVideos` autoritza cada parella ID/canal sense obrir la resta del repertori. Les cinc pistes de menys de dos minuts són cançons completes, registrades com a falsos Shorts. La revisió d’idioma i l’any original queden fixats per ID. `albums_musica.js` respecta l’any verificat manualment en comptes de mostrar la reedició de 2000, també en discos ja catalogats.

**Verificació de la generació real:** `L’Olivera` es marcava `live_song` perquè el classificador trobava `live` dins d’`Olivera`; la selecció de discos d’estudi l’excloïa. Excepció manual `song` per a `HwdXKHxhyTI`, contrastada amb la pista Ariola del disc *Com ho fa el vent*. Es conserva el filtre només de discos i es regenera únicament Serrat.

**Traçabilitat:** `docs/revisions/2026-10-12-restauracio-artistes.json` conté les llistes originals, els títols, els anys i els IDs verificats. El feed i els índexs es regeneren pel workflow ordinari només per als canals afectats; no s’editen manualment. Orígens incorporats amb fonts: Anna Andreu (Sant Quirze del Vallès), Guillem Ramisa (Roda de Ter) i Serrat (Barcelona).

## [2026-10-09] - Directes: ràdio pròpia i sessions convidades a la discografia

**Petició:** clicar un directe engega una ràdio només de directes; les set sessions de Club Social Carme també són a la discografia dels artistes participants. Maria Jaume queda només a Pop.

**Implementació:** `music-queue.js` filtra els candidats per `live_song` abans de passar-los als dos motors. El filtre es conserva en ampliar una categoria, barrejar, canviar el mode, sumar estils i restaurar/continuar la ràdio. Clicar un directe d'una cua mixta en crea una de directes. Les seleccions explícites i els botons de ràdio general/artista mantenen el seu comportament. Si no hi ha un segon directe, no es genera una ràdio amb cançons d'estudi.

**Discografia:** cada sessió és una entrada a `albums-musica.json` amb `sourceChannelId` i els IDs exactes de les pistes. `getArtistVideosWithHistory()` incorpora només aquests vídeos convidats, manté el canal publicador i respecta els ocults. El catàleg es carrega una sola vegada i es comparteix amb la fitxa; `cleanAlbum()` conserva el canal d'origen en regenerar-lo. Canals oficial i Topic mostren la mateixa sessió.

**Categories:** la base d'artistes preval sobre els estils antics del feed/arxiu per als canals coneguts; es conserven les etiquetes pròpies. Així, treure un gènere no el recupera des del feed anterior.

**Proves:** `tests/club-social-carme.test.js`, `tests/albums-musica.test.js` i bloc de directes de `tests/music-queue-selection.test.js`. Validació de 451 artistes. Lint dels fitxers modificats sense errors; el lint general conserva cinc errors previs en `data.js` i `home-sections.js`.

## [2026-10-08] - Vídeos amb restricció d'edat o que no es poden incrustar

**Problema:** un vídeo amb restricció d'edat o que l'autor no deixa incrustar no sona al reproductor de l'app (YouTube demana obrir-lo a YouTube) i atura la ràdio. El generador ja rebia aquestes dades de l'API però no les mirava.

**Solució Implementada:** `scripts/lib/restriccions_youtube.js` + registre `data/videos-restringits.json`. El generador diari treu del feed els vídeos amb `ytRating: 'ytAgeRestricted'` o `embeddable: false` (dades que ja demanava: `contentDetails,status`); l'actualització setmanal de l'arxiu afegeix aquestes parts a la consulta de visualitzacions (mateix cost: 1 unitat per 50 vídeos). El client els amaga amb la llista d'ocults. Cap consulta nova a l'API.

**Trampes conegudes:** (1) El registre només es posa al dia amb els vídeos que s'acaben de consultar: un vídeo de l'arxiu restringit dimarts no s'amaga fins al diumenge. (2) Una segona comprovació setmanal de l'arxiu sí que gastaria quota (~140 unitats). (3) Sense la part `status` no es pot saber si és incrustable: no es marca. Prova: `tests/restriccions-youtube.test.js`.

## [2026-10-08] - Primera reproducció amb el botó natiu de YouTube

**Petició:** en seleccionar una caràtula, una fila de la cua, una llista o una ràdio, preparar el vídeo aturat i demanar el primer ▶ dins de YouTube. Després, controls propis actius i cançons següents automàtiques.

**Implementació:** les entrades manuals passen `autoPlay: false`; l'iframe es carrega amb `autoplay=0`, controls natius visibles i `data-awaiting-native-play`. Els dos reintents antics de `playVideo` i els controls del sistema respecten aquesta espera. Només un estat real `playing` del reproductor principal desbloqueja anterior/play/següent. La selecció manual crea un iframe nou per descartar avisos de l'anterior. El missatge va sota els controls, mai sobre el vídeo; a la finestra flotant s'amaga per no envair el reproductor. La continuació automàtica manté `loadVideoById` i els seus mecanismes de recuperació. Música TV conserva la seva entrada pròpia.

**Verificació:** 47 proves del reproductor/subscripció/inici natiu; lint dels fitxers modificats sense errors. El lint general manté cinc errors previs en `data.js` i `home-sections.js`. No s'ha pogut executar la prova visual: la descàrrega de Chromium retorna un arxiu invàlid. No s'ha validat amb YouTube real ni es certifica el recompte de visualitzacions.

## [2026-10-08] - En seguir artistes no sortia la proposta de subscripció (i «Segueix» de la fitxa d'artista no seguia)

**Problema:** l'usuari seguia artistes des de la ràdio i des de la fitxa d'artista i no li sortia la targeta «Subscriu-t'hi a YouTube».

**Causa Arrel:** (1) La regla «com a màxim una proposta al dia» (`shouldPrompt()`): després del primer artista no en sortia cap més. (2) A la fitxa d'artista, `#channelProfileFollowBtn` es reutilitza per a cada artista i `openChannelProfileLegacyImpl()` hi posa `followBound = 'false'`: `bindFollowButtons()` hi afegia un gestor de clic més a cada visita, i amb dues visites un toc seguia i deixava de seguir alhora (l'artista no quedava seguit). Ja passava abans.

**Solució Implementada:** (1) Una proposta per artista, sense límit diari. (2) `bindFollowButtons()` només posa un gestor per botó (`button._followClickBound`) i llegeix `data-follow-channel` en el moment del clic. A més, a petició de l'usuari, la fitxa de la cançó torna a tenir el botó «Canal Youtube» de sempre; el botó oficial de YouTube queda només a la targeta. Verificat en Chromium: tres artistes seguits des de la fitxa (obrint-la dues vegades) i dos des de la fitxa de la cançó amb una ràdio: tots queden seguits i a cadascun li surt la targeta. Prova: `tests/youtube-subscribe.test.js`.

## [2026-10-08] - Proposta de subscripció gran i centrada, i botó oficial de subscripció de YouTube

**Problema:** al mòbil, l'avís «Ara segueixes… Vols subscriure't també a YouTube?» era un avís petit a baix de tot.

**Solució Implementada:** (1) La proposta és una targeta pròpia (`#ytSubPrompt`) gran i centrada; `choosePromptPosition()` la col·loca al centre o a l'espai lliure que no toca el vídeo ni la barra de controls (normes de YouTube). (2) Botó oficial de subscripció de YouTube (`platform.js`, `gapi.ytsubscribe.render`) a la fitxa de la cançó i a la targeta, només amb YouTube acceptat; si no arriba, es queda l'enllaç `?sub_confirmation=1`.

**Trampes conegudes:** (1) `platform.js` posa estils en línia al contenidor que rep (`width: 450px; display: inline-block; margin: 0`): cal pintar-lo en una caixa interior perquè els estils propis (amagar, retallar, centrar) s'apliquin a la de fora. (2) Si el contenidor té `display: none` o 1 px d'ample, l'iframe neix amb 0 o 1 px i no es corregeix: mentre carrega es posa fora de la pantalla (`left: -10000px`). (3) L'enllaç `.btn-pill-red` té `display` propi: `[hidden]` necessita `display: none !important`. (4) Els esdeveniments del botó (`subscribe`) estan obsolets: no es pot saber si l'usuari s'ha subscrit. Verificat amb Chromium i xarxa real a 390 i 1280 px (botó de 85 px / 116 px amb recompte; targeta sense tocar vídeo ni controls) i bloquejant `apis.google.com` (queden els enllaços). Prova: `tests/youtube-subscribe.test.js`.

## [2026-10-07] - «Subscriu-t'hi a YouTube» i el botó «Segueix» de la fitxa de la cançó que no seguia

**Objectiu:** que els oients se subscriguin al canal oficial dels grups (benefici clar i durador per als artistes, encara que YouTube no compti les cançons encadenades).

**Solució Implementada:** `js/features/youtube-subscribe.js` (patró 2): botó «Subscriu-t'hi a YouTube» al canal oficial amb `?sub_confirmation=1` i proposta (avís breu) en seguir l'artista o al segon m'agrada, una vegada per artista i una al dia (`catube_yt_subscribe_prompts`).

**Problema trobat pel camí:** a la fitxa de la cançó, prémer «Segueix» (al costat del nom de l'artista) obria la fitxa de l'artista i **no el seguia**: `bindChannelLinks()` escolta en captura els clics a `.channel-link`, i el botó és a dins. Ara ignora els clics a `[data-follow-channel]`.

**Trampes conegudes:** (1) `YouTubeAPI` és un `const` global de `youtube.js`, no una propietat de `window`: des d'un mòdul cal `typeof YouTubeAPI !== 'undefined' ? YouTubeAPI : window.YouTubeAPI` (amb `window.YouTubeAPI` el grup de l'artista no es trobava i el missatge deia «aquest artista»). (2) A 390 px el text llarg feia sortir la fila de botons 3 px: per sota de 480 px es mostra «Subscriu-t'hi». (3) No es pot saber si l'usuari ja hi està subscrit sense OAuth de YouTube. Prova: `tests/youtube-subscribe.test.js`.

## [2026-10-07] - Finestra flotant d'escriptori: es mou des de la barra de controls, sense franja a sobre

**Objectiu:** l'usuari volia moure la finestra flotant des de qualsevol punt i treure la línia (franja de 36 px) de sobre.

**Limitació:** des del mateix vídeo no es pot: els clics de dins l'iframe de YouTube no arriben a la pàgina i caldria una capa al damunt, que les normes de YouTube no permeten (per això es va treure el 2026-10-05). L'usuari va triar la barra de controls.

**Solució Implementada:** (1) `portada.css` (bloc «Finestreta flotant: normes de YouTube»): `padding-top: 0`, `.video-embed-wrap` amb `inset: 0` i `.drag-handle-container` / `.mini-player-resize-handle` amagats a ≥ 769 px; `MINI_PLAYER_BAR_HEIGHT = 0` a `app.js`. (2) `initExternalPlayerControls()`: `pointerdown` a la barra flotant (`.is-floating`) fora dels botons mou `#videoPlayer` (dins la pantalla, deixant lloc a la barra; la barra el segueix amb `followPlayer`), amb `setPointerCapture` perquè no es perdi en passar per damunt de l'iframe. (3) Mànec `#playerResizeHandle` a l'extrem dret de la barra (`index.html`): canvia l'amplada (16:9, mínim `MINI_PLAYER_MIN_WIDTH`). Al mòbil no canvia res (la finestra va ancorada a baix).

**Proves:** `tests/finestreta-normes.test.js`; opt-in `node tests/browser/verificar-play-pausa.js` (arrossegar la barra, mida mínima, botons sense moure la finestra).

## [2026-10-07] - Android: un vel fosc amb un cercle que gira tapava la cançó que ja sonava

**Problema:** A Android, en una ràdio, la cançó sonava però tota la pantalla quedava coberta per un vel semitransparent amb el cercle de «carregant» (sense títol, amb «Altres vídeos relacionats» buit).

**Causa Arrel:** És la capa de càrrega `#loading` que `showVideoFromAPILegacyImpl()` posa en obrir cada cançó i que només treia **després** de l'API de YouTube (`getVideoDetails`). (1) Si la cançó no era a cap llista coneguda (`feedVideos`, `currentFeedVideos`, `cachedAPIVideos`, `styleHistoryVideos`), com les del pool d'historial de la ràdio (`history-pool.json`), abans s'esperava l'índex d'arxiu fins a 5 s. (2) `scheduleLoadingAutoHide()` només l'amagava sola a iOS: a Android es quedava fins que responia la xarxa. Amb el mateix reproductor (entrada següent) la cançó ja sona durant l'espera i el vel es fa evident.

**Solució Implementada:** (1) `allKnownVideos` inclou `activePlaylistQueue`: una cançó de la cua ja és coneguda i no s'espera l'índex. (2) Amb les dades conegudes (`cachedVideo`) es fa `hideLoading()` abans de l'enriquiment per l'API. (3) La capa s'amaga sola al cap de 4 s a tots els aparells. Reproduït en Chromium amb una cançó de la cua desconeguda i l'índex d'arxiu penjat (abans `#loading.active` al cap d'1 s; ara no).

**Trampes conegudes:** No posis cap espera de xarxa abans de `hideLoading()` quan ja es pot pintar la fitxa. Prova: `tests/autoplay-cua.test.js`.

## [2026-10-07] - La cua fa servir el mateix reproductor a tots els aparells i escolta onAutoplayBlocked

**Objectiu:** després de l'arranjament per a Apple (entrada següent), fer servir el mateix mètode a tots els aparells (canvi de cançó més ràpid, menys dades, un sol camí al codi) i detectar el bloqueig de la reproducció automàtica amb l'avís oficial de YouTube.

**Solució Implementada:** (1) `canKeepApplePlayer()` passa a ser `canKeepQueuePlayer()`, sense `isAppleDevice()`: qualsevol cua amb autoplay i la pàgina visible encadena amb `swapLivePlayerVideo()` (`loadVideoById`). **Interruptor** per tornar al mètode antic (un reproductor nou a cada cançó) sense tocar codi: `localStorage.catube_player_reuse = 'off'` (`isPlayerReuseEnabled()`). (2) L'iframe se subscriu a `onAutoplayBlocked` (`setupYouTubeIframeMessaging`); `handleYouTubeMessage` mostra l'avís (`#playerAutoplayHint`, ara «El navegador ha aturat…») i cancel·la la recàrrega de l'encadenat, que també quedaria bloquejada. (3) `watchAppleAutoplay()` es diu `watchAutoplay()`: la comprovació per temps (4 s) es manté només a Apple, per si l'avís no arriba.

**Trampes conegudes:** (1) YouTube no publica com decideix els anuncis ni si les cançons encadenades compten com a visualitzacions: per comparar, prova amb l'interruptor (anuncis en mode incògnit; font «Reproductor incrustat» a YouTube Studio dels artistes). (2) Mai s'ha d'intentar amagar, saltar o bloquejar anuncis. (3) No provat amb YouTube real. Prova: `tests/autoplay-cua.test.js`.

## [2026-10-07] - iPhone, iPad i Mac: la cançó següent de la cua no arrencava sola

**Problema:** A l'iPhone (i a Safari de l'iPad i el Mac), en acabar una cançó de la ràdio o d'una llista la següent quedava aturada: calia tocar play a cada cançó.

**Causa Arrel:** Safari no deixa sonar un reproductor nou sense un toc de l'usuari, i l'app en creava un a cada cançó (`prepareWatchPlaybackPreview()` buida `#videoPlayer` i hi posa un iframe amb `autoplay=1`). Els `playVideo` que s'envien després (en carregar i amb els estats 5 / -1) tampoc no compten com a toc.

**Solució Implementada (només aparells d'Apple, `isAppleDevice()` de `helpers.js`):** (1) **Mateix reproductor:** `loadVideoInSequence()` marca `keepLivePlayer` també quan `canKeepApplePlayer()` (Apple, autoplay, pàgina visible, iframe de YouTube viu i consentiment) i `showVideoFromAPI` fa servir `swapLivePlayerVideo()` (`loadVideoById` al mateix iframe, el que ja feien les TV a pantalla completa). Si el reproductor no respon en 2,5 s es recrea com abans (a la finestra flotant, amb `queuePlayback`). (2) **Avís:** `watchAppleAutoplay()` (a l'encadenat, a `prepareWatchPlaybackPreview` i `queuePlayback` amb autoplay) comprova al cap de 4 s si la cançó continua sense començar (estat `''`, `-1` o `5`) i, si és així, posa `.is-autoplay-blocked` a `#playerExternalControls`: el play parpelleja i surt `#playerAutoplayHint` («Toca el vídeo o ▶ per continuar») a sota dels botons, mai damunt del vídeo (a la barra petita de la finestra flotant només parpelleja). Desapareix quan sona.

**Trampes conegudes:** (1) No s'ha pogut provar amb un iPhone ni amb YouTube real (només proves estàtiques). (2) El play de la barra envia `playVideo` per `postMessage`, que Safari pot no comptar com a toc: per això l'avís diu també «toca el vídeo». (3) Amb la pestanya amagada no s'encadena res (regla del 2026-10-04): no s'hi ha tocat. (4) A Android, Windows i Linux no canvia res. Prova: `tests/autoplay-cua.test.js`.

## [2026-10-05] - Segona passada amb cerca i anàlisi de lletres

**Petició:** buscar artista i lletra de les 239 pendents i fer més descartes segons l’idioma.

**Resultat:** 22 exclusions dins les 239, 35 conservades i 182 pendents sense evidència suficient. S’afegeix l’exclusió correctiva de «Gratitud», de Still Ill: 23 IDs ocults nous en total.

**Aplicació:** només les 57 decisions resoltes passen a revisades. Es mantenen les 182 pendents, les 2 descartades automàtiques i totes les exclusions anteriors. El filtre existent d’ocults aplica els IDs; no s’edita el feed.

**Traçabilitat:** [registre amb cerques, decisions i fonts](revisions/2026-10-05-idiomes-lletres.json). Sense atribuir lletres d’homònims ni deduir l’idioma del títol. No s’han verificat íntegrament les 239 lletres.

## [2026-10-05] - Revisió completa de la cua d’idiomes

**Petició:** revisar totes les cançons pendents i eliminar les que no siguin en català.

**Resultat:** 221 IDs afegits a ocults; 1008 entrades conservades i 68 exclusions prèvies respectades. S’han repassat 1546 entrades, incloses les altes del bot durant la revisió. 249 casos no resolts es documenten sense marcar-los com a revisats; de l’estat vigent queden 239 pendents i 2 descartades automàtiques sense verificar. Es respecten totes les exclusions anteriors.

**Implementació:** fusió selectiva de l’estat actual de revisió, sense buidar globalment la cua ni editar manualment el feed. Les exclusions per ID s’apliquen a totes les fonts a través del filtre existent. No s’exclou cap artista sencer ni s’estén una exclusió a versions no contrastades.

**Traçabilitat:** [decisions, criteris i fonts](revisions/2026-10-05-idiomes.json). S’han contrastat lletres/descripcions disponibles i context de títol, disc i repertori; la revisió no implica haver escoltat íntegrament tots els vídeos.

## [2026-10-05] - Retirada d’Itaca Band, filtre de Stay Homas / La Pegatina i canal homònim de La Madam

**Petició:** retirar Itaca Band, conservar només el repertori català de Stay Homas i La Pegatina i eliminar el canal `UCCjTaOHQqmy0VD2vkZVxxoA` de La Madam.

**Solució:** Itaca Band queda rebutjat i exclòs de la descoberta; es retiren els dos canals. Per fer desaparèixer les fitxes immediatament, el feed només es neteja dels tres canals retirats (amb `serializeFeed()`); les exclusions de cançons per idioma es fan amb el registre d’ocults. S’eliminen les exclusions globals antigues de Stay Homas i La Pegatina perquè aquests artistes sí que es conserven. La llista per canal fixa també el repertori català verificat (11 cançons de Stay Homas i 4 de La Pegatina, amb les seves versions): una regeneració no pot omplir els buits amb altres peces no revisades. Per afegir nous títols catalans cal verificar la lletra i ampliar aquesta selecció; `+=` es conserva també com a títol simbòlic. Els títols revisats en altres llengües tenen regles permanents al canal oficial i Tema; els IDs s’han materialitzat des del feed, historial, arxiu i catàleg de pistes. «Del Revés», «Rade Blunner», «Tropical» i «Sonqueson» són castellanes encara que el títol pugui enganyar; «+=» és catalana. Es conserven les cançons catalanes amb expressions breus d’altres llengües; es retiren «Ara (Les Merdes II)» i «The Bright Side», amb versos sencers en anglès.

**Canals retirats:** `blocked: true` a `music-channel-video-allowlist.json` rebutja qualsevol vídeo del canal; la cerca i el resolutor de YouTube també descarten aquests IDs. La Madam s’exclou només per l’ID indicat, mai pel nom: el Topic barreja peces del grup català i d’un homònim castellà. No hi ha un segon ID assignat al repositori; es manté la fitxa catalana pendent del canal correcte. També es retira l’entrada de `youtube-verified-handles.json`, que el resolutor de verificats tornava a assignar, i aquest resolutor respecta els canals bloquejats i els artistes rebutjats. Stay Homas i La Pegatina incorporen els QID verificats (Q90712655 i Q1813924) perquè la descoberta per Wikidata actualitzi la fitxa existent i no creï duplicats.

**Verificació:** comprovació dels IDs ocults i de les cançons catalanes conservades; proves del filtre per canal i regles per títol. La suite general ja presentava errors abans del canvi.

## [2026-10-04] - Fora els Shorts de tota l'app
**Petició:** eliminar els Shorts del feed i de tota l'app.

**Solució Implementada:** (1) dades: `update_music_feed.js` treu tots els Shorts del feed (abans conservava els que coincidien amb una cançó del canal Tema) i `archivar_feed_musical.js` no en guarda a l'arxiu, al pool de ràdio ni a `historial-musical.json` (722 a l'arxiu); el workflow «Arxivar feed musical» els neteja en fusionar el canvi. (2) client: `YouTubeAPI.filterHiddenVideos()` descarta `isShort === true` a totes les fonts, de manera que no en surt cap encara que les dades publicades en portin. (3) interfície: fora la fila «Shorts» dels estils (`renderVideos`) i de la fitxa d'artista (`renderChannelVideos`), el filtre «Shorts» de l'historial (un filtre desat «Shorts» passa a «Tot») i els Shorts de l'historial antic; `isSongOrShort()` → `isSongVideo()`; textos de les galetes sense «Shorts».

**Trampes:** els falsos Shorts (cançons curtes marcades per error, `data/falsos-shorts.json`) es corregeixen abans del filtre i es queden com a cançons. `shorts.js` i `#short-modal` es mantenen però ja no tenen cap punt d'entrada (Segueix TV, enllaços antics a un Short: el vídeo no es troba entre els coneguts).

**Fitxers Afectats:** `scripts/update_music_feed.js`, `scripts/archivar_feed_musical.js`, `js/youtube.js`, `js/app.js`, `index.html`, `sw.js`, `tests/sense-shorts.test.js`.

## [2026-10-04] - «Validar base musical» en vermell: l'auditoria de contingut no quadrava (review 21 contra 425)
**Símptoma:** `tests/music-content-overrides.test.js` («l'auditoria de contingut és coherent…») fallava des del commit del bot `0c14be1` (feed del 2026-10-03 23:29): `typeCounts.review` era 21 i `music-content-review.json` en tenia 425. Els commits del bot no llancen la validació; es va veure en obrir la PR següent.

**Causa Arrel:** en mode incremental (`targetMode`, només alguns canals), `update_music_feed.js` comptava els tipus dels canals no llegits a partir del feed anterior, però conservava tota la seva llista de revisió. Des que el feed calent i l'historial van separats, la majoria de vídeos «per revisar» ja no són al feed (326 són a l'arxiu): la llista en tenia 425 i el recompte, 21.

**Solució Implementada:** en `targetMode`, els vídeos «review» dels canals no llegits es compten des de la llista de revisió conservada (i no des del feed); `rawPublicVideoCount` és la suma dels tipus. Les auditories publicades (`music-content-audit.json`, `music-feed-audit.json`) es van corregir amb el mateix criteri fins a la propera generació.

**Fitxers Afectats:** `scripts/update_music_feed.js`, `data/music-content-audit.json`, `data/music-feed-audit.json`.

## [2026-10-04] - L'historial dins dels estils sortia a part, amb una icona i sense visualitzacions
**Símptoma:** en obrir un estil, les cançons antigues (arxiu/historial) sortien en un bloc a part, al final, amb una targeta diferent (icona blanca d'historial) i sense visualitzacions.

**Causa Arrel:** `renderCategoryHistorySection()` les afegia després de pintar la llista del feed, amb `createArchiveVideoCard()`, a partir de l'índex de cerca (`search_index_*`: només els 3 últims anys, sense visualitzacions ni tipus de contingut). A més, la vista d'un estil ordenava per data i el motor només hi aplicava els límits: encara que s'haguessin barrejat, totes les de l'historial (de fa més d'un any) haurien quedat al final.

**Solució Implementada:** fitxer compacte `data/historial-musical.json` (totes les cançons de l'arxiu: 4.261, ~800 KB, ~160 KB comprimit), generat per `archivar_feed_musical.js` i actualitzat amb les visualitzacions per `update_music_history_views.js` (el workflow setmanal ara també el desa). El client el carrega en segon pla (`YouTubeAPI.ensureStyleHistory()`, amb la mateixa hidratació que el feed: nom del canal, miniatura, estils, títol net). En una vista d'estil, categoria pròpia o «Seguint», `mergeStyleHistory()` l'afegeix a les cançons del feed abans de filtrar (les vistes en filtren les cançons ja escoltades com sempre) i `rankRecommendedWithEngine()` ordena tot el conjunt com «Recomanat per a tu» (gust, popularitat, antiguitat, mode de descoberta), i després `arrangeMusicList()`. Mateixa targeta que el feed (`createVideoCardAPI`, amb visualitzacions). Si l'historial encara no ha arribat en tocar l'estil, l'esquelet de càrrega espera fins a 2,5 s perquè la llista es pinti una sola vegada. Eliminades `renderCategoryHistorySection()` i `createArchiveVideoCard()`.

**Trampes:** les cançons de l'historial han de ser trobables en reproduir-les: són a `YouTubeAPI.styleHistoryVideos`, que s'ha afegit a les llistes de vídeos coneguts d'`openVideoFromUserGesture()` i companyia. L'ordre d'un estil ja no és cronològic: el fa el motor (pot variar una mica d'una visita a l'altra).

**Fitxers Afectats:** `scripts/lib/arxiu_musical.js`, `scripts/archivar_feed_musical.js`, `scripts/update_music_history_views.js`, `.github/workflows/actualitzar-visualitzacions-historial.yml`, `data/historial-musical.json`, `js/youtube.js`, `js/app.js`, `sw.js`, `tests/estils-historial.test.js`, `tests/canvi-estil.test.js`.

## [2026-10-04] - Salt visual en entrar a un estil (portada desfeta i «historial» abans de les cançons)
**Símptoma:** al mòbil, en tocar un estil (rajola de «Tria el teu so», selector «Estil» o peu), primer es veia una llista estranya, després cançons de l'historial i finalment la llista de cançons de l'estil.

**Causa Arrel:** dues coses juntes. (1) `portada.js` observa la barra d'estils i treu `is-portada` de `#homePage` en el mateix toc, però la graella encara tenia les seccions de la portada: el navegador pintava «Comença per aquí», «Torna-hi» (l'historial)… sense l'estil de portada, dins la graella de vídeos, amb la capçalera de l'estil anterior. (2) Aquest estat durava molt perquè `renderFeed()` → `arrangeMusicList()` → `musicSelection.arrange()` era quadràtic: a cada pas `runSelection()` comparava cada candidata amb **totes** les cançons ja triades (`usedRecordings.some(isSameRecording)`), ≈10⁸ comparacions per a ~1.500 cançons de Pop: ~0,8 s a l'ordinador, diversos segons al mòbil.

**Solució Implementada:**
- `music-selection.js`: `recordingIndex()` agrupa les gravacions ja triades per `recording` (isSameRecording() només pot ser cert entre claus amb el mateix `recording`), i en reordenacions de llistes (`keepAll`) el bucle s'atura a la primera candidata vàlida (mana l'ordre original: `base` decreix amb la posició). Resultat **idèntic** (comprovat amb totes les categories del feed, amb i sense senyals, i 45 ràdios amb `rng` fix) i 6–9 vegades més ràpid (tot el catàleg: 1,6 s → 0,2 s; Pop al navegador: 730 → 80 ms).
- `app.js`: els dos camins del clic d'un estil criden `showCategoryLoading()` en el mateix toc (esquelet de cançons `.cat-skeleton` a la graella, `#homePage.is-loading-category` amaga el contingut de la capçalera però en conserva l'espai, i s'avorta el render per lots/«scroll infinit» de la vista anterior) i `renderFeedAfterCategoryChange()` el treu quan la llista és a punt (`finally`). En tornar a Inici no hi ha esquelet.

**Trampes:** no tornis a posar comparacions «contra totes les triades» dins del bucle de `runSelection()`; si cal una restricció nova, indexa-la. L'esquelet només el treu `renderFeedAfterCategoryChange()`: si afegeixes un camí nou per canviar d'estil, fes-lo servir.

**Fitxers Afectats:** `js/features/music-selection.js`, `js/app.js`, `css/portada.css`, `sw.js`, `tests/canvi-estil.test.js`.

## [2026-10-04] - Les teves categories: categories pròpies de grups
**Símptoma / petició:** l'usuari no podia fer-se categories pròpies (p. ex. «Festa major») amb els grups que volgués, ni tenir-les a Inici amb els estils, ni compartir-les. La barra d'estils encara mostrava «Canal Jove» i «Canal Història», categories heretades de Segueix youtubers que `initDefaultSmartCategories()` injecta a `catube_custom_tags`, i «+ Afegeix una categoria» obria el modal antic de cerques per paraules clau.

**Solució Implementada:** mòdul nou `js/features/user-categories.js` (patró 2) amb dades pròpies a `catube_music_user_categories` (`[{ id, name, artists: [channelId] }]`), sense reutilitzar `catube_custom_tags` / `catube_channel_custom_categories`. Les categories surten a «Tria el teu so» (rajola amb «La teva» i una rajola «Crea una categoria»), a la barra d'estils (en lloc de les heretades) i a la fitxa de l'artista («Les teves categories»: tocar una categoria hi afegeix o en treu el grup; «Nova categoria» la crea amb el grup a dins). La vista d'una categoria té ràdio (`musicQueue.startCategoryRadio`, «Ràdio <nom>»), compartir i esborrar. L'enllaç de compartir és el `?importData=` de tipus `category` (nom + ID de canal) i el missatge porta el nom i els grups (`navigator.share` amb `text`). L'ordre de «Tria el teu so» es canvia mantenint premuda una rajola i arrossegant-la (Sortable, `delay` 250 ms només tàctil), amb el ratolí o amb Alt + fletxes; es desa a `catube_music_home_style_order` i es porta a l'ordre de la barra d'estils (`mergeOrder()`).

**Trampes:**
- Una fitxa d'artista pot agrupar diversos canals (oficial + «Tema», `YouTubeAPI.getArtistGroupForChannel()`): la categoria desa l'ID de la fitxa, i el filtre i la ràdio han d'expandir-lo a tots els `channelIds` del grup (`categoryChannelIds()` / `channelIdsOf()`). Sense això, un artista afegit des de la fitxa podia quedar sense cançons.
- L'enllaç només porta ID de canal i, en obrir-lo, el catàleg encara no és a punt: la previsualització posa els noms quan arriben (`fillImportCategoryArtists()`), no en el moment de pintar el modal.
- El nom d'una categoria no pot ser el d'un estil ni d'una vista (Inici, Novetats, Descobreix, Seguint…): la selecció de la vista va per nom (`selectedCategory`).

**Fitxers Afectats:** `js/features/user-categories.js`, `js/features/portada.js`, `js/features/artist-page.js`, `js/features/music-queue.js`, `js/app.js`, `js/utils/share-card.js`, `index.html`, `css/portada.css`, `sw.js`, `tests/user-categories.test.js`, `tests/browser/verificar-categories.js`.

## [2026-10-03] - Revisió d'idioma dels nous canals Oi!/Punk
**Símptoma:** en afegir els canals Topic d’Opció K-95 i Desperta Ferro, les pistes noves van entrar a `data/revisio-idiomes.json`; alguns títols anglesos d’Opció K-95 són realment cançons en anglès, mentre que títols anglesos de Desperta Ferro com «DF Crew» i «Supporters» tenen lletra catalana.

**Causa Arrel:** la revisió automàtica només detecta marques inequívocament no catalanes al títol; els títols anglesos sense caràcters especials necessiten comprovació editorial de la lletra.

**Solució Implementada:** verificació de lletres i fonts web. S’han ocultat 7 pistes angleses d’Opció K-95 i s’ha afegit una regla persistent perquè no tornin a entrar. Es mantenen «Oi! You!» (el disc *Cap Oportunitat* és íntegrament en català), «Partisans» i totes les 36 pistes pendents de Desperta Ferro. Pilseners no tenia cap pista pendent. La revisió s’ha tancat només per aquests tres artistes, sense buidar la resta de pendents del projecte.

**Fitxers Afectats:** `scripts/ocultar_titols_castella.js`, `data/hidden-videos.json`, `data/revisio-idiomes.json`, `docs/ARTISTES_CASTELLA.md`, `docs/PROBLEMES_I_SOLUCIONS.md`.

## [2026-10-03] - La reproducció automàtica s’atura al final de la cançó
**Símptoma:** el vídeo acaba però la ràdio o llista no passa a la cançó següent.

**Causa Arrel:** el commit `a0eee3c` va eliminar `updateRestartButton()` amb el botó «Comença de nou», però en va deixar quatre crides al seguiment del progrés. En arribar a `markCurrentProgressComplete()` es llançava `ReferenceError` abans que `handleYouTubeMessage()` delegués al gestor que avança la cua. També fallaven el desat del progrés i la detecció de directes. No ho causava la protecció dels estats de play/pausa.

**Solució Implementada:** eliminar les quatre crides residuals, mantenint el botó eliminat i els controls play/pausa actuals. Prova de regressió pel gestor públic amb dos vídeos consecutius, desat de progrés, pausa, represa i final: abans falla amb `ReferenceError`; després el gestor de la cua rep cada final. Regenerar el Service Worker perquè arribi el codi corregit.

**Fitxers Afectats:** `js/features/player.js`, `tests/continue-watching.test.js`, `sw.js`.

## [2026-10-02] - Artistes duplicats per canal oficial + Topic
**Símptoma:** la pàgina «Artistes» pintava una targeta per canal de YouTube. Un mateix artista apareixia dues o tres vegades (canal oficial, Topic i, en algun cas, un segon canal oficial), amb variants de majúscules o accents.

**Causa Arrel:** `renderFollowPage()` consumia directament `YouTubeAPI.getAllChannels()`, tot i que `music-categories.js` ja disposava d'una `artistKeyForChannel()` estable compartida pels canals del mateix artista.

**Solució Implementada:** `YouTubeAPI.getArtistGroups()` agrupa els canals per identitat d'artista i tria com a representant el canal `primary`, després l'oficial i finalment el Topic. El nom visible és el `displayName` editorial o el nom canònic de l'artista. «Artistes» i «La teva música» treballen amb aquests grups. La fitxa fusiona `getChannelVideosWithHistory()` de tots els `channelIds`, de manera que desapareix el duplicat visual sense perdre repertori. El seguiment existent de qualsevol canal membre continua fent que l'artista consti com a seguit.

**Fitxers Afectats:** `js/music-categories.js`, `js/youtube.js`, `js/app.js`, `js/features/my-music.js`, `tests/music-categories.test.js`, `tests/my-music.test.js`.

# Base de Coneixement i Resolució de Problemes

> ATENCIÓ IA: Abans de proposar una solució a un nou bug, revisa les entrades d'aquest document per si hi ha patrons de fallada similars (especialment amb la memòria cau o la UI). Quan resolguis un problema complex, tens l'obligació d'afegir una nova entrada aquí seguint la plantilla.

## Plantilla d'entrada

## [Data] - [Títol breu del problema]
**Símptoma:**

**Causa Arrel:**

**Solució Implementada:**

**Fitxers Afectats:**

## [2026-10-03] - Fitxa de la cançó (escriptori): botons de sota tallats i cua de la dreta més curta que la columna de l'esquerra
**Símptoma:** a escriptori, la fila de botons de sota el títol (afegir a llista, compartir, canal…) quedava tallada al peu de la finestra, i la finestra de la ràdio de la dreta acabava molt més amunt que aquests botons.

**Causa Arrel:** (1) La barra de controls `#playerExternalControls` es va afegir dins `.watch-main` com una fila nova de la graella (reproductor, **controls**, títol, canal), però la cua `#playlistQueueContainer` continuava amb `grid-row: 1 / span 3` i, amb `contain: size`, només arribava fins al títol: acabava uns 170 px abans que el canal. (2) Entre línies s'havien anat sumant uns 66 px de marges: 16 + 12 del reproductor als controls, 16 + 4 fins al títol, 8 de farciment del canal i 16 + 16 fins als botons.

**Solució Implementada:** `grid-row: 1 / span 4` (si els controls són a `<body>` amb la finestra flotant, la 4a fila és buida i la cua hi arriba igual) i `grid-column: 1` per als controls (`styles.css`). Bloc a `portada.css` (≥ 769 px) amb els marges mínims: reproductor sense marge inferior, controls amb `10px auto 6px`, títol, canal i botons enganxats. A 1251×730 la columna de l'esquerra baixa 67 px i la cua acaba a 853 px, a ran dels botons (845 + 8 de farciment). `verificar-play-pausa.js` ho comprova a escriptori; amb el CSS anterior la cua acabava a 751 i els botons a 914.

**Fitxers Afectats:** `css/styles.css`, `css/portada.css`, `tests/portada-assets.test.js`, `tests/browser/verificar-play-pausa.js`.

## [2026-10-03] - El botó de pausa de sota el reproductor no es convertia en play ni tornava a fer sonar
**Símptoma:** en prémer la pausa del botó gran de sota el reproductor, el vídeo s'aturava però el botó continuava mostrant la pausa; tornar-lo a prémer no feia sonar la cançó.

**Causa Arrel:** el botó mostra l'estat de `data-player-state`, que només s'actualitzava amb l'avís `onStateChange` del reproductor de YouTube, i `toggleMainPlayerPlayback()` decideix amb aquest estat. Si l'avís es perdia o arribava tard (passa amb el reproductor real; el succedani de les proves sempre l'enviava), l'estat es quedava a 1: el botó no canviava i cada toc tornava a enviar `pauseVideo`.

**Solució Implementada:** `playMainPlayer()` / `pauseMainPlayer()` posen l'estat que s'ha demanat (1 / 2) en enviar l'ordre; l'avís real el confirma o el corregeix quan arriba. A més, l'estat també es llegeix dels avisos `infoDelivery` / `initialDelivery` (`info.playerState`), de manera que no depèn d'un sol tipus de missatge. Dues trampes (revisió de Codex): (1) l'iframe de Shorts també envia `infoDelivery` i queda viu en pausa, així que només compten els avisos amb `event.source` igual a l'iframe del reproductor principal; (2) un avís amb l'estat d'abans de l'ordre pot arribar just després: durant 1,5 s (`PLAYER_STATE_PENDING_MS`) els avisos que contradiuen l'ordre pendent s'ignoren (`applyReportedPlayerState()`), i en carregar un iframe nou l'ordre pendent s'oblida. `verificar-play-pausa.js` descarta els avisos d'estat (a `SegueixApp.features.player.handleYouTubeMessage`; un `addEventListener` de captura a `window` no s'hi avança) i comprova pausa → play → pausa amb les ordres corresponents; amb el codi antic falla (pausa, pausa, pausa).

**Fitxers Afectats:** `js/app.js`, `tests/player-controls.test.js`, `tests/browser/verificar-play-pausa.js`.

## [2026-10-03] - Fila de botons de la fitxa de la cançó tallada per la navegació inferior (mòbil)
**Símptoma:** al mòbil, la fila de botons de sota el títol (afegir a llista, compartir, finestra flotant, comentar, «Canal YouTube») quedava a mitges sota la navegació inferior.

**Causa Arrel:** sota el reproductor quadrat (que ocupa tot l'ample) hi havia una línia pròpia «Mode llista · Ràdio 1/40» (`#playlistModeBadge`, 31 px + marge) abans del títol. Amb la zona del sistema a dalt, la pantalla útil (≈ 740 px) no hi arribava.

**Solució Implementada:** un primer intent (PR #70) feia el quadrat més petit segons l'alçada; l'usuari va preferir conservar-lo a tot l'ample i es va desfer. Ara la línia desapareix i la ràdio o la llista es diu amb una etiqueta petita en llima dins la línia de data i visualitzacions que ja hi havia (`updatePlaylistModeChip()`, `#playlistModeChip`, icona de ràdio o de llista + «Ràdio · 1/40»). La línia no es parteix: si no hi cap, s'escurcen les visualitzacions. Es guanyen ≈ 37 px; a 360×738 la fila acaba just damunt de la navegació. Les TV conserven el seu `#playlistModeBadge` amb la informació i el botó de regenerar.

**Fitxers Afectats:** `js/app.js`, `css/portada.css`, `tests/player-controls.test.js`, `tests/browser/verificar-play-pausa.js`.

## [2026-10-03] - Plegar la navegació lateral: la barra plegada ocupava l'espai i el contingut sortia desplaçat
**Símptoma:** el control per plegar la barra (una fletxa ‹ › penjada a la vora de la barra) no plegava res de debò: amb la barra «plegada» quedava una columna buida de 236 px, el contingut no s'estenia, i amb la barra oberta el contingut sortia 240 px desplaçat a la dreta.

**Causa Arrel:** el bloc afegit a `styles.css` posava `body.sidebar-collapsed .sidebar { width: 12px }` i `body:not(.sidebar-collapsed) .main-content { margin-left: var(--sidebar-width) }`, però la maquetació real de Segueix Música és a `portada.css`: la barra té `body .sidebar#sidebar { width: var(--pt-side-w) }` (l'id guanya en especificitat) i el cos fa `padding-left: var(--pt-side-w)`. La regla nova no es veia, i el marge s'afegia al padding que ja hi havia.

**Solució Implementada:** es parteix de l'ample que ja manava. `--pt-side-open` és l'ample desplegat i `--pt-side-w` l'espai que la barra ocupa ara; `body.sidebar-collapsed` el posa a 0 i el padding del cos i el marge de la capçalera s'hi adapten sols. `--pt-side-w` es registra amb `@property` per animar-lo (0,28 s); la barra conserva el seu ample i llisca amb `transform`, i plegada és `visibility: hidden` (res al teclat). El control passa a ser un botó de tres ratlles a la capçalera (`#sidebarToggle`, `aria-expanded`/`aria-label`), amb la preferència desada i sense animar en obrir l'app (`body.sidebar-ready`). S'ha tret la vista prèvia en passar per una franja de 12 px i el bloc de `styles.css`.

**Fitxers Afectats:** `index.html`, `css/portada.css`, `css/styles.css`, `js/app.js`, `tests/barra-lateral.test.js`, `tests/browser/verificar-barra-lateral.js`.

## [2026-10-03] - Restaurar i tancar damunt de la finestra flotant: contra les normes de YouTube
**Símptoma:** la finestra flotant portava dos botons (restaurar i tancar) i una franja enfosquida a dalt, damunt del vídeo de YouTube. La fila de sota el títol duplicava el m'agrada de la barra de controls.

**Causa Arrel:** les normes de l'API de YouTube (Developer Policies, funcionalitat mínima del reproductor incrustat) no permeten superposicions, marcs ni altres elements visuals al davant de cap part del reproductor, inclosos els seus controls. Els botons eren dins de `#videoPlayer` (`.mini-player-controls-overlay`). Si es treien sense més, a l'escriptori la finestra flotant no es podia restaurar ni tancar, perquè la barra de sota és dins `#watchPage`, que queda amagada.

**Solució Implementada:** fora `.mini-player-controls-overlay` de la plantilla del reproductor, i també `setupMiniPlayerUIControls()`, `showMiniPlayerControls()` i el CSS. La lògica és a `closeMiniPlayer()` i `expandMiniPlayer()` (que també fa servir el «Continua» de la portada). La barra `#playerExternalControls` té «tanca» (`#playerCloseBtn`, només amb la finestra flotant), i el botó de finestra flotant fa de «restaura». A l'escriptori, la barra segueix la finestra (`.is-floating`: observa el `style` de `#videoPlayer`, `transitionend` i `resize`) i `positionMiniPlayerBottomRight()` deixa 52 px a sota. També s'ha tret el cor de la fila de sota el títol (`#likeToggle`): `likes.js` ja tolera que no hi sigui. Encara són damunt del vídeo el mànec d'arrossegar de 36 px (transparent) i la cantonada de redimensionar de l'escriptori: si s'han de treure, arrossegar s'hauria de fer des de la barra.

**Fitxers Afectats:** `index.html`, `js/app.js`, `js/features/portada.js`, `css/styles.css`, `css/portada.css`, `tests/player-controls.test.js`, `tests/botons-unificats.test.js`, `tests/browser/verificar-play-pausa.js`.

## [2026-10-03] - Controls de sota el reproductor: estil de l'app i barra enganxada a la finestra flotant del mòbil
**Símptoma:** els controls nous de sota el reproductor (`#playerExternalControls`) eren símbols de text (⏮ ▶ ⏭ ▣ ♡), grans i amb el cor vermell, diferents de la resta de botons de l'app. Amb la finestra flotant ancorada a baix del mòbil no hi havia cap control (la barra és dins `#watchPage`, que s'amaga), i en pausa encara sortien anterior/següent damunt del vídeo. La navegació inferior, a més, tapava 8 px de la finestra flotant.

**Causa Arrel:** la barra es va afegir amb un estil propi a `styles.css`. `initQueueNextOverlay()` es va desactivar, però `showQueueNextOverlay()` (cridat en pausar) continuava creant `.queue-next-overlay` dins `#videoPlayer`. `--pt-nav-h` val 60 px fixos, i amb «La teva música» en dues línies la navegació en fa 68.

**Solució Implementada:** icones SVG a `index.html` (play i pausa, flotant i restaura, alternats per CSS amb `.is-playing` i `aria-pressed`) i bloc «Controls sota el reproductor» a `portada.css` amb els tokens de l'app (rodons, `--pt-surface-2`, `--pt-line`, llima en actiu; play/pausa principal en llima). `initExternalPlayerControls()` passa la barra a `<body>` amb `.is-docked` quan la finestra flotant és activa a ≤ 768 px (barra de 52 px, botons de 40–44 px, a `bottom: --pt-nav-h`) i la torna al seu lloc en restaurar; la finestra puja `--pec-dock-h`. `syncQueueNextOverlay()` no crea cap control damunt de l'iframe si existeix la barra. `shell-nav.js` mesura la navegació inferior (`ResizeObserver`) i posa `--pt-nav-h` a la seva alçada real.

**Fitxers Afectats:** `index.html`, `css/portada.css`, `css/styles.css`, `js/app.js`, `js/features/shell-nav.js`, `tests/browser/verificar-play-pausa.js`, `sw.js`.

## [2026-10-02] - Eliminar descripcions dels vídeos del feed públic
**Símptoma:** cada vídeo de `data/feed.json` encara portava fins a 300 caràcters de la descripció de YouTube, per exemple crèdits, enllaços i text promocional que l'app no mostra.

**Causa Arrel:** l'aprimador anterior retallava `description`, però la conservava perquè `home-sections.js` detectava amb «Provided to YouTube by…» les pistes Topic d'imatge fixa.

**Solució Implementada:** `slimFeedVideo()` deriva primer `topicTrack:true` quan la descripció comença per «Provided to YouTube by…» i després elimina completament `description` del vídeo públic. `home-sections.js` usa `topicTrack` (amb compatibilitat temporal amb feeds antics). La descripció completa continua disponible durant `update_music_feed.js` abans de l'aprimat per a idioma, subtítols, suport, any original i classificació. Les rutes SEO/compartició ja tenen textos de reserva basats en títol i artista si no hi ha descripció. El workflow d'actualització del feed vigila també `scripts/lib/aprimar_feed.js` i `tests/aprimar-feed.test.js`.

**Fitxers Afectats:** `scripts/lib/aprimar_feed.js`, `tests/aprimar-feed.test.js`, `js/features/home-sections.js`, `.github/workflows/actualitzar-feed-musica.yml`, `CLAUDE.md`.

## [2026-10-02] - L'app es recarregava sola mentre es tocava o s'engegava una cançó
**Símptoma:** al mòbil, poc després d'obrir Segueix Música, fer scroll, tocar la pantalla o seleccionar una cançó podia coincidir amb una recàrrega sobtada de tota l'app.

**Causa Arrel:** el Service Worker nou feia `skipWaiting()` automàticament quan ja n'hi havia un d'actiu. Això provocava un `controllerchange` en qualsevol moment. `initAppUpdater()` només ajornava el `reload` si el reproductor ja havia arribat exactament a `playerState === '1'`; quan una cançó s'acabava de tocar sovint encara era `buffering` (`3`) o el vídeo encara no havia començat, i la pàgina es recarregava igualment. El toc no causava el problema: només coincidia amb l'activació asíncrona del SW.

**Solució Implementada:**
- `sw.js`: cap actualització fa `skipWaiting()` automàtic durant `install`; el worker nou queda `waiting`.
- `initAppUpdater()`: mentre la pàgina és visible, una actualització només mostra l'avís; no s'activa ni recarrega.
- En passar l'app a segon pla, s'envia `SKIP_WAITING` i la recàrrega es pot fer sense interrompre l'ús.
- Si l'usuari prem explícitament l'avís d'actualització, sí que s'aplica al moment.
- Si per qualsevol motiu arriba un `controllerchange` inesperat mentre l'app és visible, el `reload` queda ajornat fins que la pàgina s'oculta.
- `tests/browser/verificar-sw.js` comprova que amb l'app visible una versió nova queda preparada, que scroll/toc no recarreguen i que l'actualització s'aplica després en segon pla sense bucle.

**Fitxers Afectats:** `sw.js`, `js/app.js` (`initAppUpdater`), `tests/browser/verificar-sw.js`, `CLAUDE.md`.

## [2026-10-02] - Mode conducció: pantalla negra sense distraccions
**Símptoma:** al mòbil, mentre es condueix, la pantalla s'apaga (i sense YouTube Premium la música s'atura) o es queda encesa amb tota l'app, que distreu i gasta bateria.

**Causa Arrel:** no hi havia cap vista mínima, i l'app no evitava que la pantalla s'apagués.

**Solució Implementada:** `js/features/drive-mode.js` i el bloc «Mode conducció» de `css/portada.css`. El botó `#driveModeBtn` (només ≤ 1024 px) posa `body.drive-mode`:
- fons negre pur (a les pantalles OLED no gasta) i, a dalt, només el reproductor de YouTube, a 16:9 i com a mínim 200 px d'ample;
- un sol botó, «Tanca el mode conducció»;
- `navigator.wakeLock.request('screen')`, que es torna a demanar a `visibilitychange`, i pantalla completa si el navegador ho permet.

**Trampes:**
- Tot és CSS: `visibility: hidden` a tot el `body` menys el reproductor, que passa a `fixed`. Moure l'iframe al DOM faria que YouTube el recarregués, i tapar-lo incompliria les normes de YouTube (el reproductor ha de ser visible).
- La lluentor no es pot controlar des d'una web.
- A l'iPhone, el Wake Lock dins l'app instal·lada (PWA) demana iOS 18.4 o posterior, i no hi ha pantalla completa per a pàgines.
- Comprovat amb Chromium i el succedani d'embed: `tests/browser/verificar-mode-conduccio.js`.

**Fitxers Afectats:** `js/features/drive-mode.js` (nou), `js/app.js` (botó), `index.html`, `css/portada.css`, `sw.js`, `tests/browser/verificar-mode-conduccio.js`, `CLAUDE.md`.

## [2026-10-02] - Revisió d'idioma de les cançons noves amb un LLM
**Símptoma:** cada vegada que entraven cançons noves (de canals Tema, pàgines profundes o novetats) calia repassar tot el feed per trobar-hi les que no són en català. Els detectors automàtics per títol fallen: «Tu», «Nada», «Loca», «Ara», «Corren» poden ser de qualsevol llengua, i l'idioma declarat a YouTube no és fiable.

**Causa Arrel:** no hi havia cap registre de què s'havia revisat i què era nou.

**Solució Implementada:** decisió de l'usuari: la revisió la fa un LLM, amb el seu vistiplau.
- `update_music_feed.js` afegeix a `data/revisio-idiomes.json` les cançons que entren per primera vegada (`scripts/lib/revisio_idiomes.js`: `updatePending()`; de les pistes Tema en guarda el disc).
- L'agent les revisa i les ensenya a l'usuari. Amb el vistiplau, `scripts/aplicar_revisio_idiomes.js --amaga=…` les amaga a `hidden-videos.json` i passa totes les pendents a `revisades`, de manera que no tornen a sortir.
- Punt de partida: les 7.998 cançons del feed del 2026-10-02 marcades com a revisades (`--inicia`), perquè ja s'havien revisat.
- **Descart automàtic:** si el títol té una marca que el català no fa servir mai (ñ, ¿ ¡, á, -ción, ã õ â ê ô, alfabet no llatí), la cançó surt del feed sola i queda a `descartades` amb el motiu. `detectNonCatalan()` no mira els noms dels artistes indexats, les col·laboracions (ft., amb, con, _feat.) ni el que hi ha entre parèntesis («(Operación Triunfo 2018)», «(Sábado Noche, TVE-1)»). Sobre el feed del 2026-10-02 (7.529 cançons visibles) n'hauria marcat 28. Unes 20 són en castellà o en italià (Anna Ferrer, «La Revolución» d'Inadaptats, «Capitán Trueno», òpera de Carles Santos); la resta són falsos positius que es recuperen amb `--recupera` (noms de lloc com «Viñarock», «A Miguel Hernández», errors d'escriptura com «Mai sabrás» i «Els Ápats», «Cariñoso [al català]», «¡¡¡dancebreak!!!»). Només s'aplica a les cançons noves.
- Instruccions per a l'agent: `CLAUDE.md`, «Revisió d'idioma de les cançons noves».

**Fitxers Afectats:** `scripts/lib/revisio_idiomes.js`, `scripts/aplicar_revisio_idiomes.js`, `scripts/update_music_feed.js`, `data/revisio-idiomes.json`, `tests/revisio-idiomes.test.js`, `.github/workflows/actualitzar-feed-musica.yml`, `CLAUDE.md`, `docs/ARTISTES_CASTELLA.md`.

## [2026-10-02] - Castellà i altres llengües als canals «Tema» nous
**Símptoma:** amb els canals «Tema» van entrar al feed les discografies senceres d'artistes bilingües. A Txarango, per exemple, «El Martillo», «Corazón Viajero» o «Sueña Como un Niño», quan el seu canal oficial és tot en català. També hi van entrar cançons en anglès, portuguès, gallec, italià, llatí, basc, japonès i àrab.

**Causa Arrel:** les regles de `scripts/ocultar_titols_castella.js` eren per canal i per títol. Els canals Tema són canals nous, de vegades amb un altre nom («Alfred García» en lloc d'«alfredgarcia», «Miki Núñez» en lloc de «Miki Nuñez»), i porten cançons que el canal oficial no tenia.

**Solució Implementada:** revisió a mà de les cançons visibles de 46 artistes, Sandra Bautista inclosa. A petició de l'usuari, en aquests artistes s'amaguen el castellà **i les altres llengües**; es mantenen el català, l'occità, les instrumentals i els títols que són noms propis. `afegeix(canals, títols)` crea o amplia la regla d'un o més canals amb una llista de títols. `llista()` hi posa límits de paraula que entenen els accents, perquè «Todo» no toqui «Tot» ni «Ara» toqui «Arabia». Les regles existents (Txarango, Ceaxe, 31 FAM, KOP…) es conserven i s'hi suma la llista nova. Com que la regla té `titols.test()`, la generació del feed també amaga la mateixa cançó des del Tema. Resultat: 472 cançons noves a `data/hidden-videos.json`; el detall per artista i els dubtosos que es mantenen són a `docs/ARTISTES_CASTELLA.md`.

**Fitxers Afectats:** `scripts/ocultar_titols_castella.js`, `data/hidden-videos.json`, `docs/ARTISTES_CASTELLA.md`, `tests/ocultar-titols-castella.test.js`, `CLAUDE.md`.

## [2026-10-02] - Canals «Tema»: la primera generació real i el llindar de cobertura
**Símptoma:** la primera generació real amb els Tema (9.711 vídeos, 8,0 MB) va funcionar, però en mode `audit` `music-topic-review.json` deia que el Tema trauria 1.084 vídeos dels canals oficials, molts d'ells cançons bones. El Tema de ZOO portava cançons d'un grup indonesi homònim.

**Causa Arrel:**
1. Molts Tema no tenen tota la discografia, sinó només els discos recents o distribuïts digitalment: Pau Riba 28 pistes (90 cançons al canal oficial), Inadaptats 15 (70), Dan Peralbo 13, Quico Pi de la Serra 27.
2. Els títols del canal oficial no coincidien: «Aina - Dan Peralbo i El Comboi», «AUXILI - 02. Si tu vols (Tresors, 2018)», «'El Calvari' d'Anna Andreu», «SODI Temps Afegit - Nou Single» (`cleanTitle()` s'emportava la cançó), «Ara (videoclip) Translúcid», «Tan a poc a poc (que me dorm)», «GOSSEJAR & AL·LÈRGIQUES AL POL·LEN», «arròs covat prod. Jan Aygua».
3. El Tema de ZOO barreja un grup indonesi (es veu al catàleg sencer: «Epilog: Yang Berpulang», «Halilintar»); el RSS (15 pistes) no ho mostrava.

**Solució Implementada:**
- `songKeys()` dona totes les claus possibles del títol: cada tros separat per « - », «|», «/», «:», «@»; el text entre cometes; el que hi ha abans del parèntesi; sense número de pista, «amb / feat. / & / prod.»; també a partir del títol de YouTube sense el nom de l'artista. `topicKeys()` dona la clau principal de la pista i la del parèntesi desfet. `matchedKey()` diu amb quina clau coincideix.
- El Tema només mana on cobreix el 75 % de les cançons del canal oficial (`minCoverage`). La cobertura de cada canal és a `topicCoverage` de `music-feed-audit.json`.
- Es conserva tot el que el títol diu que és una cançó publicada (`hasSongMarker()`: videoclip, lyric, àudio oficial, visualizer, videomood).
- Les pistes repetides (videoclip i pista del Tema) es treuen a tots els canals oficials, encara que el Tema no hi mani.
- Fora el Tema de ZOO.
- Mesurat amb el feed i els catàlegs reals: mana en 76 canals oficials i en trauria 161 vídeos. La majoria no són cançons (resums de gira, entrevistes, actuacions a gales i a la televisió, sessions de DJ, karaoke, les versions en castellà i en altres llengües de «Només tu» d'el Diluvi i de Manu Guix). Unes 25 són cançons que no són al Tema (enMatu, alguns directes de Marina Rossell, «El Jaume i la Laia» de Mishima); es poden recuperar a `data/music-content-overrides.json`.
- `MUSIC_TOPIC_GOVERNANCE` és ara una variable del workflow. **Activada (`apply`) el 2026-10-02**: la generació d'aquell dia en mode `audit` (74 canals) trauria 229 vídeos: 148 classificats com a cançó, 69 dubtosos (resums de concert, karaokes de Doctor Prats, «Concert en família» de Dàmaris Gelabert, programes de ràdio) i 12 directes. Per recuperar-ne un: `data/music-content-overrides.json` (una decisió manual mana sobre el Tema).
- `tests/song-title.test.js` («canvia una part important del feed») ja no compta les pistes «Provided to YouTube»: tenen el títol net i, amb els Tema, el percentatge baixava del 30 %.

**Fitxers Afectats:** `scripts/lib/canal_tema.js`, `scripts/update_music_feed.js`, `data/artistes-musica.json`, `.github/workflows/actualitzar-feed-musica.yml`, `tests/canal-tema.test.js`, `tests/song-title.test.js`.

## [2026-10-02] - Finestra flotant del sistema: la cançó següent no sonava amb Chrome minimitzat — SUBSTITUÏT
**Estat:** aquesta solució històrica de reproducció amb Chrome minimitzat ja no és vigent; des del 2026-10-04 la pestanya amagada pausa YouTube.

**Símptoma:** al Chromebook, amb la finestra flotant del sistema oberta i la de Segueix Música minimitzada, en acabar una cançó la finestra flotant mostrava la següent però no sonava fins que es tornava a obrir la finestra de Chrome.

**Causa Arrel:** a cada canvi de cançó, `loadVideoInSequence()` recreava l'iframe de YouTube (`prepareWatchPlaybackPreview()` buida `#videoPlayer`). Chrome no deixa engegar el so d'un reproductor nou en una pàgina que no es veu. Només la pantalla completa de les TV reutilitzava el reproductor.

**Solució Implementada:** `isPlaybackInBackground()` (`app.js`): la pàgina és amagada o la finestra del sistema és oberta (`systemPlayer.isPipOpen()`). En aquest cas, `canSwapLivePlayerVideo()` i `loadVideoInSequence()` fan servir `swapLivePlayerVideo()`: el mateix iframe rep `loadVideoById`, com una llista de reproducció de YouTube, que continua sonant en segon pla. Si el reproductor no respon en 2,5 s, es recrea com sempre. La guarda de l'«ended» endarrerit del vídeo anterior (abans només en mode TV) ara també s'aplica després d'aquest canvi (`lastLiveSwapAt`, 2 s): sense la guarda, saltaria una cançó. Amb la pàgina visible no canvia res. Prova: `tests/browser/verificar-finestra-sistema.js`, que comprova la finestra oberta, la pàgina amagada, l'«ended» repetit i la pàgina visible.

**Trampes:** una pàgina web no pot restaurar ni maximitzar la seva finestra (`window.focus()` demana un gest de l'usuari i no desfà el minimitzat). No es pot provar amb el YouTube real en aquest entorn; el succedani respon a `loadVideoById` amb els estats 3 i 1.

**Fitxers Afectats:** `js/app.js`, `tests/browser/verificar-finestra-sistema.js`, `sw.js`, `CLAUDE.md`.

## [2026-10-02] - Canals «Tema»: la discografia mana sobre el canal propi de l'artista
**Símptoma:** al canal propi dels artistes hi ha vídeos que el classificador accepta com a cançó i no ho són (Els Pets: «Entrevistes Això és espectacle», «Discussió lletra El meu veí de sota», «Old McDonald had a farm»), i molts artistes no tenien indexat el canal «Tema», on hi ha tots els discos (Maria Jaume: hi faltaven els llançaments).

**Causa Arrel:** el feed només llegia les 50 darreres pujades de cada canal i decidia «és cançó» pel títol i la durada. El canal «Artista - Tema» (Topic) de YouTube té la discografia editada, cançó per cançó, però no té videoclips, directes ni Shorts.

**Solució Implementada:**
- 114 canals Tema nous a `data/artistes-musica.json` (`type: 'topic'`, `primary: false`), comprovats un per un amb el RSS de YouTube (darreres 15 pistes, discos i crèdits) i els discos de MusicBrainz. N'hem deixat fora els homònims: Cactus (lo-fi i coreà), ELO (electrònica en anglès), Sisa (raper nord-americà), MIQUEL (techno), Raimon (raper nord-americà), Scorpio, SUU (piano per dormir), Manel (barrejat amb un artista vietnamita), i els dubtosos Llum, Maig i Fades. També Subliminal (llista blanca), Palau (el mateix Tema que Ferran Palau) i Serrat (vegeu les trampes).
- `update_music_feed.js` llegeix cada Tema sencer (`playlistItems` amb `snippet`, fins a 10 pàgines; unes 850 unitats de quota més al dia) i desa els títols a `data/music-topic-catalog.json`. Si un dia falla, es fa servir la discografia de l'anterior i el repertori conservat.
- `scripts/lib/canal_tema.js`:
  - `songKey()`: la mateixa clau per a «Els Pets - Bon dia (Videoclip Oficial)», «Bon dia - Remastered 2015», «Bon dia (Vic 1997)» i «Bon dia». Fa servir `cleanTitle()` de `js/song-title.js` i treu els parèntesis, el «feat.», el que hi ha després d'un « - » i les extensions de fitxer.
  - `selectTopicTracks()`: una pista per cançó (la més escoltada), sense les que ja tenen videoclip; les 40 més escoltades més les de fa menys de 180 dies.
  - `governClassification()`: al canal oficial, el que no és al Tema passa a `other`. No toca els Shorts, els àlbums, les decisions manuals ni el que fa menys de 30 dies que s'ha publicat.
- Una cançó amagada al canal propi (per ID, o per una regla de títols de `ocultar_titols_castella.js`) tampoc no entra des del Tema.
- **Mode `audit` per defecte** (`MUSIC_TOPIC_GOVERNANCE`): la reclassificació del canal oficial només s'anota a `data/music-topic-review.json`. No s'ha pogut provar amb l'API real; en una simulació amb discografies parcials (RSS) videoclips bons quedaven fora («Parla», «XL», «Soroll» d'Els Pets). Es passa a `apply` quan aquest fitxer confirmi que la discografia es llegeix sencera.

**Trampes:**
- Les regles «totes» de `ocultar_titols_castella.js` (Serrat, MARLENA) són sobre un canal concret i no s'apliquen al Tema: aplicades a la discografia de Serrat amagaven «Cançó de matinada» o «La plaça del Diamant». Per això el Tema de Serrat no s'ha afegit; cal convertir la seva regla en una llista de títols en castellà.
- Els Tema d'artistes bilingües (Albert Pla, Sílvia Pérez Cruz, Jofre Bardagí, Sandra Bautista, Marina Rossell, La Mousse, Gertrudis…) porten cançons en castellà que no tenen regla. Cal fer la revisió del castellà (`docs/ARTISTES_CASTELLA.md`) després de la primera generació.
- Un Tema amb el mateix nom que l'artista pot ser d'un altre artista, o barrejar-ne dos. Comprova-ho sempre abans d'afegir-lo.

**Fitxers Afectats:** `scripts/lib/canal_tema.js`, `scripts/update_music_feed.js`, `data/artistes-musica.json`, `.github/workflows/actualitzar-feed-musica.yml`, `tests/canal-tema.test.js`; fitxers generats nous: `data/music-topic-catalog.json` i `data/music-topic-review.json`.

## [2026-10-02] - El feed pesava massa per afegir-hi els canals «Tema»
**Símptoma:** `data/feed.json` feia 11,6 MB (1,9 MB comprimit) amb 7.539 vídeos i cada client el baixa i el processa sencer en obrir l'app. Afegir-hi els canals «Tema» dels artistes (milers de llançaments més) l'hauria portat cap als 15–17 MB.

**Causa Arrel:** el generador hi copiava la descripció sencera de YouTube (el 64 % del pes), el motiu del classificador (`musicReason`), `sourceChannelId` (sempre igual que `channelId`), camps buits (`liveBroadcastContent: 'none'`, llengües buides) i ho escrivia amb `JSON.stringify(…, null, 2)` (el sagnat era una cinquena part). El client només llegeix el principi de la descripció.

**Solució Implementada:** `scripts/lib/aprimar_feed.js` (`slimFeed`, `serializeFeed`) s'aplica en escriure el feed (`update_music_feed.js`, després d'haver fet servir la descripció sencera per a l'any original i els subtítols en castellà):
- descripció retallada a 300 caràcters per un salt de línia o un espai, amb la marca ` […]` (fa que sigui idempotent) i hi afegeix les línies `Released on:` i `℗` que quedin més avall, perquè `stampOriginalYear()` d'un vídeo conservat (`carried`) o d'`estampar_any_original.js` trobi el mateix any;
- `musicReason` només es conserva si és «marcador explícit…» (el llegeix `home-sections.isOfficialClip`); el motiu complet continua a `music-content-review.json` i a les mostres de l'auditoria;
- fora `sourceChannelId` quan és igual que `channelId` (el client fa `channelId || sourceChannelId`) i els camps buits;
- un vídeo per línia: sense sagnat i amb diffs de git llegibles.
Resultat amb el feed actual: 11,6 MB → 6,1 MB, i 1,94 MB → 0,95 MB comprimit; cap vídeo canvia d'any original ni de filtre de subtítols. `node scripts/aprimar_feed.js` ho aplica al feed sense API; els altres scripts que reescriuen el feed (`estampar_any_original`, `aplicar_revisio_manual_musical`, `corregir_noms_canals`, `revisar_shorts`) ja l'escriuen amb `serializeFeed`.

**Trampes:** no tornis a escriure el feed amb `JSON.stringify(feed, null, 2)`. Si un script nou necessita la descripció sencera, ha de treballar a `update_music_feed.js` abans d'aprimar (o demanar-la a l'API), no llegir-la de `feed.json`. `node scripts/ocultar_subtitols_castella.js` ara només veu les descripcions retallades: el filtre bo és el de la generació diària.

**Fitxers Afectats:** `scripts/lib/aprimar_feed.js`, `scripts/aprimar_feed.js`, `scripts/update_music_feed.js`, `scripts/estampar_any_original.js`, `scripts/aplicar_revisio_manual_musical.js`, `scripts/corregir_noms_canals.js`, `scripts/revisar_shorts.js`, `.github/workflows/actualitzar-feed-musica.yml`, `tests/aprimar-feed.test.js`, `data/feed.json`.

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

## [2026-10-01] - Pàgina per revisar noms i categories dels artistes (`revisio-artistes.html`)

**Necessitat:** Poder repassar amb calma el **nom que es veu a l'app** i les categories dels artistes ben indexats, marcar quins ja estan bé i passar el resultat per aplicar-lo, sense la pàgina d'administració completa (`admin-musica.html`, amb token, estats, YouTube ID, MusicBrainz…). La primera versió editava `artist.name` (el de la base d'artistes), que **l'app no mostra**: l'app mostra el nom del canal de YouTube («alfredgarcia»).

**Solució Implementada:** (1) **Pàgina:** `revisio-artistes.html` (155 artistes: els amb canal i no rebutjats) amb el nom que es veu a l'app editable (inicial: el del canal a `js/channels-ca.json`, o el `displayName` ja desat), categories (diàleg amb la taxonomia de `music-genres.json`), columna OK, cercador, filtres, recomptes i **desat automàtic al navegador**; «Descarrega la revisió» baixa un JSON (+ CSV). (2) **Aplicar:** `scripts/aplicar_revisio_artistes.js` (`--dry-run`): el nom va a `displayName` (si torna a ser el del canal, s'esborra), categories a `genres` amb `genre:manual`, OK a `revisioEditorial`; l'esquema (`additionalProperties: false`) accepta `displayName` i `revisioEditorial`. (3) **A l'app:** `music-categories.js` guarda `displayName` per canal i el posa a `channelTitle` dels vídeos (`cleanVideoTitle`, que també passa per historial, m'agrades i llistes) i a `name` dels canals (`decorateChannel`); `YouTubeAPI.withDisplayName()` ho fa a `feedChannels` i `getAllChannels()` i hi afegeix el nom antic a `artists` perquè la cerca el trobi. Comprovat a Chromium amb un nom de prova: canal, vídeos, fitxa, targetes de la fitxa, historial i cerca (pel nom nou i pel de YouTube). La lògica comuna és a `js/revisio-artistes.js` (UMD) i `tests/revisio-artistes.test.js` la prova, també amb les dades reals (un document sense canvis no modifica res).

**Trampes conegudes:** (1) **`feed.json` i els scripts continuen amb el nom de YouTube** a propòsit: les regles de `ocultar_titols_castella.js` i el llistat d'artistes vigilats van per `channelTitle` exacte; el canvi de nom és només del client. (2) El títol es neteja amb el nom de YouTube **abans** de posar el nom editat (`applyDisplayName` va al final de `cleanVideoTitle`); si no, un «alfredgarcia - Cançó» ja no perdria el prefix. (3) Les cançons desades abans a llistes poden dur `artistName` antic: `resolveArtistName()` dóna prioritat al nom registrat, que ja és el nou. (4) `scripts/enriquir_generes_musica.js` sobreescriu `genres` tret que `sources` inclogui `genre:manual`: l'aplicació ho afegeix (`admin-musica.html` no ho fa: les categories editades allà es poden perdre en el proper enriquiment). (5) L'esborrany és per navegador: «Esborra els canvis» el descarta. (6) La pàgina porta `noindex` però és pública, igual que les dades que carrega. (7) Un artista amb diversos canals mostra el mateix nom a tots.

**Fitxers Afectats:** `revisio-artistes.html`, `js/revisio-artistes.js`, `js/music-categories.js`, `js/youtube.js`, `scripts/aplicar_revisio_artistes.js`, `data/artistes-musica.schema.json`, `sw.js`, `docs/MUSICA_DADES.md`, `README.md`, `CLAUDE.md`, `tests/revisio-artistes.test.js`.

---

## [2026-10-01] - Júlia Cruz: cançons en castellà i en anglès

**Símptoma:** Al feed de Júlia Cruz (3 cançons) n'hi havia una en castellà («El baile del querer», del Cabal Musical del Taller de Músics) i una en anglès (el cover «One Night Only» de Jennifer Hudson).

**Solució Implementada:** Seguint el procediment de `CLAUDE.md` («Revisar cançons en castellà»): repàs dels artistes vigilats (`node scripts/revisar_castella_vigilats.js --since=2026-09-30`, només «Mou-te» de Judit Neddermann, en català) i de Júlia Cruz. Els dos IDs s'han afegit a mà a `data/hidden-videos.json` (casos puntuals; la regla de `ocultar_titols_castella.js` és per a títols castellans, no per a l'anglès). Es manté «Enyor». Júlia Cruz és a `docs/ARTISTES_CASTELLA.md`.

## [2026-10-01] - SUU i altres artistes vigilats: cançons en castellà noves

**Símptoma:** Al feed de SUU hi havia 19 cançons amb el títol en castellà (la regla antiga només en cobria 7 i, amb els títols tal com surten al feed —«Suu - Soy (Videolyric Oficial)»—, no en coincidia cap de les nou). Repassant la resta d'artistes de `docs/ARTISTES_CASTELLA.md` n'han sortit 43 més.

**Solució Implementada:** Seguint el procediment de `CLAUDE.md` («Revisar cançons en castellà»): `node scripts/revisar_castella_vigilats.js --artista="SUU"` (38 visibles) i revisió dels títols. **SUU (19 amagades):** Eres un temazo (2), Ojalá, Soy, Algo de mi, Si no saltas, Todo lo que canto, Mi casa, No eres tan especial, Súbete, Me gusta, A solas, Reinas, Tranqüilo, A tomar, Nota de voz, De ti para mí, Creo (que tk), Enamorada de la moda juvenil (versió de Radio Futura). Es mantenen els catalans i els títols compartits (Natural, Laura, Boom, Pur, Karaoke, Material sensible, Postal barata). **Resta d'artistes (43):** Miki Núñez 15, Alfred García 14, Umpah Pah 4, Sandra Monfort 3, CACTUS 3, i 1 de miquel, Joan Dausà, Txarango i La Madam (detall a la taula del document). Regles per canal a `REGLES` de `scripts/ocultar_titols_castella.js`; IDs a `data/hidden-videos.json`.

**Trampes conegudes:** (1) Els regex de `REGLES` s'apliquen al títol **brut** del feed (amb «Suu - …» i els accents poden venir descomposats): per això s'usa `.{1,2}` en lloc de `[aá]` en paraules amb accent. (2) Dubtosos que es mantenen: «1997» d'Alfred García amb Niño de Elche, «El toro Olé» de miquel i els títols que pertanyen a les dues llengües. «Mi broda» de DAVEU es va retirar posteriorment a petició de l'usuari (2026-10-02). (3) «Trevo (Tu)» de Miki Núñez és en portuguès: no es va demanar amagar-lo. (4) La revisió de la resta d'artistes s'ha fet **només pels títols** (heurística de paraules castellanes + criteri manual): una cançó amb títol català i lletra castellana continua al feed.

**Fitxers Afectats:** `scripts/ocultar_titols_castella.js`, `data/hidden-videos.json`, `docs/ARTISTES_CASTELLA.md`, `tests/ocultar-titols-castella.test.js`.

---

## [2026-10-01] - «La teva ràdio» semblava que començava de zero i no deia de què estava feta

**Símptoma:** La targeta deia «Barreja el que t'agrada amb música nova, sense parar» i la primera cançó la triava el motor entre tot el catàleg: no es veia que la ràdio partís del que l'usuari ha escoltat, agradat i seguit, ni què passava la primera vegada (sense cap dada).

**Solució Implementada:** (1) `discovery.recentTaste()` (pur): historial dels **últims 7 dies**; si en té menys de 3, l'últim mes; si encara menys, tot; més els m'agrades i els artistes seguits (sense data: sempre compten); retorna recomptes, claus d'artista, estils principals i `hasAny`. `discovery.tasteSummary()` el converteix en text: «Feta amb el que has escoltat aquesta setmana (14 cançons), els teus m'agrades (5) i els artistes que segueixes (3).». (2) `musicQueue.startDiscovery()` tria la **primera cançó** del gust recent segons el mode (`recentSeedPool()`: de sempre → els seus artistes; una mica de tot → ells + el seu estil; sorprèn-me → el seu estil d'altres artistes; amb < 5 cançons torna al conjunt ampli). (3) **Primera vegada** (`!hasAny`): la targeta ensenya els estils (`#ptFirst`: els 8 principals + «Més estils», fins a 3) amb «Només t'ho demanem aquesta primera vegada»; el selector de mode s'amaga; es desen a `catube_first_styles` (`discovery.setFirstStyles()`) i `startDiscovery()` fa una ràdio d'aquells estils (`startStyleRadio`) mentre hi hagi < 3 artistes coneguts; després la ràdio ja és del gust i no es torna a demanar. «Canvia els estils que vas triar» (`#ptFirstReset`) els esborra. Amb estils desats i poques dades el text diu «Feta amb els estils que vas triar: …».

**Trampes conegudes:** (1) Els m'agrades no tenen data (`likedAt` no existeix): la «darrera setmana» només val per a l'historial. (2) El botó de la ràdio és desactivat fins que es tria un estil (només a la primera vegada); les proves de navegador n'hi posen un gust recent amb `ambGustRecent(page)` (`tests/browser/gust-recent.js`, respecta un historial ja preparat). (3) Amb menys de 3 artistes coneguts manen els estils triats encara que hi hagi 1–2 escoltes; a partir de 3 passa al gust recent. (4) El conjunt d'estils triables surt de `SegueixMusicCategories.CATEGORY_GROUPS` sense «Altres estils». (5) La clau `catube_first_styles` viatja amb l'exportació (es copia tot el localStorage).

**Fitxers Afectats:** `js/features/discovery.js`, `js/features/music-queue.js`, `js/features/portada.js`, `index.html`, `css/portada.css`, `sw.js`, `CLAUDE.md`, `tests/discovery.test.js`, `tests/music-queue-discovery.test.js`, `tests/portada-entrada-mobil.test.js`, `tests/browser/gust-recent.js` (nou) i les proves de navegador que engeguen la ràdio.

---

## [2026-10-01] - Entrada de la portada: «La teva ràdio» i «Continua» no s'entenien i era massa carregada

**Símptoma:** A dalt de la portada hi havia un títol gran, un botó «La teva ràdio» sense explicació, a vegades un segon botó només de text («Continua la ràdio: <títol>»), el selector de mode, una targeta «Novetat» i, mentre sonava alguna cosa, una targeta «Ara sona» amb cercles (+/−) i «Regenera la cua». No quedava clar què feia cada botó ni que «Continua» i «La teva ràdio» eren coses diferents, i no hi havia gairebé imatge.

**Solució Implementada:** L'entrada són dues targetes. (1) **«Continua escoltant»** (`#ptFeature`, `continueHtml()`): la cançó que sona (`Ara sona`) o la darrera ràdio, amb la **caràtula** en gran i la mateixa caràtula borrosa de fons (`--pt-art`, degradat de carbó per al contrast), títol, artista (enllaç a la fitxa) i un únic botó principal. (2) **«La teva ràdio»** (`#ptRadio`, estàtica a `index.html`): collage de tres caràtules d'artistes diferents (`radioCovers()`), una frase que ho explica i el selector de mode **dins la mateixa targeta**, perquè es vegi que el mode és de la ràdio nova. Si hi ha alguna cosa per continuar, el text diu «O comença una ràdio nova…», el botó passa a «Ràdio nova» i és secundari (`pt-btn--ghost`); si no, «Engega la ràdio» és el principal. Es treuen el títol gran, la targeta «Novetat» (ja hi ha «Comença per aquí» i «Acabades de sortir») i els controls +/− i «Regenera la cua» de la portada (són a la cua de la ràdio). A escriptori les dues targetes van una al costat de l'altra quan hi ha res a continuar. Es recupera també l'alineació a l'esquerra de les eines de secció a mòbil (`.pt-head .pt-head__tools`).

**Trampes conegudes:** (1) `#ptPlayBtn` i `#ptResumeBtn` mantenen els ids perquè hi enllacen les proves de navegador (`verificar-seleccio.js` ara comprova el text de la targeta, no el del botó). (2) L'URL de la caràtula entra en un `style` (`cssUrl()` només n'accepta de segures: https/`//`/`img/`/`./` i escapa cometes i parèntesis). (3) El collage és decoratiu (`aria-hidden`): no vol dir que la ràdio hagi de sonar aquelles cançons; la primera la tria el motor en prémer. (4) El collage i el fons s'omplen en `updateEntry()` i només es repinten si canvia l'HTML.

**Fitxers Afectats:** `index.html`, `css/portada.css`, `js/features/portada.js`, `sw.js`, `tests/portada-entrada-mobil.test.js`, `tests/portada-assets.test.js`, `tests/mobile-card-tap.test.js`, `tests/browser/verificar-seleccio.js`, `CLAUDE.md`.

---

## [2026-10-01] - Fitxa d'artista: el «+» de categories personalitzades ja no hi és

**Símptoma:** Sota l'artista (i el programa) hi havia un botó rodó «+» que obria un selector per sumar-li categories personalitzades. A Segueix Música no n'hi ha cap ni es poden crear (herència de Segueix youtubers), així que el selector sempre deia «No hi ha categories personalitzades.» i el botó no feia res útil.

**Solució Implementada:** `renderChannelProfileCategories()` i `renderProgramCategories()` (app.js) només pinten les etiquetes (`<span class="channel-category-btn">`; les d'estil del feed i, si n'hi ha d'antigues, les assignades) i amaguen el contenidor si no n'hi ha. S'han tret el botó, el selector, el tancament en clicar fora (`channelCategoryPickerCleanup`) i el doble clic/pulsació llarga per esborrar-les, i el CSS corresponent (`.channel-category-add*`, `.channel-category-picker`, `.channel-category-option*`, `.channel-category-empty`). Prova: `tests/artist-page.test.js`.

**Trampes conegudes:** (1) No hi tornis a posar un «+» a la fitxa: les categories d'un artista vénen de la base d'artistes (`data/artistes-musica.json`) i la ràdio de l'estil les fa servir. (2) Les funcions `addChannelCustomCategory()` / `removeCategoryFromChannel()` continuen existint a app.js per a dades antigues i la importació; ja no tenen cap interfície a la fitxa.

**Fitxers Afectats:** `js/app.js`, `css/styles.css`, `css/portada.css`, `sw.js`, `tests/artist-page.test.js`.

---

## [2026-10-01] - Fitxa d'artista nova: foto gran, presentació curta i dues ràdios

**Símptoma:** La fitxa d'artista era herència de la fitxa de canal de YouTube: avatar petit a l'esquerra (a desktop el nom, «Segueix», ull, compartir i cercador en una sola fila), la descripció de YouTube **sencera** (sovint en castellà i de desenes de línies) abans de veure cap cançó, etiquetes amb un «+» blanc fora de la paleta i cap manera d'engegar una ràdio de l'artista.

**Solució Implementada:** (1) **HTML** (`index.html`, `#channelPage`): `.ap-top` (enrere + les dues ràdios), `.ap-hero` (nom a l'esquerra, foto a la dreta), `.ap-bio` (presentació plegada a tres línies amb `#apBioToggle`), estils, i «Cançons» amb el cercador. S'han mantingut tots els ids que fa servir `app.js`. (2) **CSS** (`css/portada.css`, final): grid `eyebrow/name/info/actions` + `photo` (foto de 104–232 px, circular, amb ombra), targeta amb degradat llima, ràdio de l'artista en llima i la de l'estil en contorn, mides tàctils de 44 px, etiquetes curtes de les ràdios a mòbil. (3) **`js/features/artist-page.js`** (nou, patró 2): funcions pures (`artistStyles`, `radiosModel`, `bioModel`) i DOM (`showProfile`, `setSongs`, mesura de la presentació, clics). (4) **`music-queue.js`**: `startArtistRadio()` (ràdio d'un conjunt tancat, refactor de `startFromSearch()` a `launchPoolRadio()`; `searchRadio` guarda `artist`) i `startStyleRadio()` (`launch()` amb els estils de l'artista). (5) `app.js`: crida `showProfile()`/`setSongs()`; `syncChannelProfileActionsLayout()` queda buida. Verificat amb Chromium a 360/390/1280 px.

**Trampes conegudes:** (1) El feed duu les categories d'alguns canals en minúscules («folk i arrel»): `artistStyles()` les porta al nom canònic de `SegueixMusicCategories.CATEGORY_GROUPS` (si no, la ràdio dir «folk i arrel»). (2) La presentació només mostra «Llegeix-ne més» si no hi cap (`scrollHeight > clientHeight`), es mesura després del primer frame i en canviar de mida; una presentació curta no en porta. (3) Una ràdio d'artista necessita ≥ 2 cançons i la d'estil ≥ 1 estil (si no, el botó és desactivat amb el motiu al `title`); mentre arriben les cançons del canal (`getChannelVideosWithHistory`) els dos són desactivats. (4) Un artista pot tenir centenars de cançons: el motor n'ordena fins a 500 (`ARTIST_RADIO_POOL`) i la cua en porta les primeres 60. (5) La presentació ve de YouTube (sovint en castellà): no es tradueix ni es filtra. (6) Un programa (`channel-page--program-profile`) amaga les ràdios i l'etiqueta «Artista». (7) Les icones d'enrere i compartir són SVG inline: amb lucide (CDN) bloquejat la fitxa quedava amb cercles buits.

**Fitxers Afectats:** `index.html`, `css/portada.css`, `js/features/artist-page.js` (nou), `js/features/music-queue.js`, `js/app.js`, `sw.js`, `CLAUDE.md`, `tests/artist-page.test.js` (nou), `tests/music-queue-selection.test.js`.

---

## [2026-10-01] - Mòbil: la part superior de la portada era confusa

**Símptoma:** A 390 px l'entrada de la portada ocupava més de la meitat de la primera pantalla (≈ 515 de 844 px) i no s'hi veia música: el títol «Avui, què et ve de gust?» es partia en dues línies amb l'altra meitat buida (`max-width: 16ch`), el botó «La teva ràdio» era a mitja amplada i flotava, el selector de mode apareixia sota amb el text d'ajuda i la targeta destacada era alta. A més, a les capçaleres de secció, «Reprodueix-ho» / «Veure-ho tot» baixaven a una fila pròpia però quedaven **tirats a la dreta** (`margin-left: auto`), desconnectats del títol.

**Solució Implementada:** `css/portada.css`, bloc `@media (max-width: 768px)` just abans de «Seccions» (només CSS, sense tocar l'HTML ni el JS): títol d'una línia (`font-size: clamp(1.5rem, 6.8vw, 1.9rem)`, sense `max-width`, `text-wrap: balance`); botó principal a tota l'amplada amb el selector enganxat a sota (marges de 12 px); llegenda i ajuda del selector més petites; targeta destacada més baixa (miniatura 34 %, títol 1 rem, botons a 8 px); gaps de 12 px. Les eines de secció s'alineen a l'esquerra (`.pt-head .pt-head__tools { margin-left: 0 }`, amb especificitat doble perquè la regla base és posterior al bloc). L'entrada passa a ≈ 450 px a 390 px (la targeta destacada acaba a ≈ 450 px) i «Comença per aquí» és a la primera pantalla.

**Trampes conegudes:** (1) Els controls tàctils continuen fent ≥ 44 px (`.pt-mode__opt span { min-height: 44px }` no s'ha tocat): `tests/browser/verificar-portada.js` ho comprova. (2) Una regla de mòbil situada **abans** de la regla base amb la mateixa especificitat perd: per això el `margin-left: 0` va amb `.pt-head .pt-head__tools`. (3) Per fer captures cal esperar que l'splash d'intro (`.intro-splash`) acabi; si no, hi surt el logotip «SEGUEIX!» enganxat al fons. (4) La capçalera (marca, cerca, artistes, configuració) no s'ha tocat; la cerca hi surt també a la navegació inferior («Cerca»).

**Fitxers Afectats:** `css/portada.css`, `sw.js`, `tests/portada-entrada-mobil.test.js`.

---

## [2026-10-01] - Llista d'artistes vigilats per castellà i prompt de revisió

**Símptoma:** Les cançons en castellà tornen a aparèixer cada vegada que el feed incorpora vídeos nous dels mateixos artistes, i no hi havia cap lloc que dixés quins artistes cal repassar primer ni com.

**Solució Implementada:** `docs/ARTISTES_CASTELLA.md` recull els 40 artistes a qui s'han amagat cançons (cançó d'autor, urbana, Judit Neddermann, subtítols en castellà, primera passada del 2026-09-29, artistes rebutjats) amb recomptes, motius i notes. `scripts/revisar_castella_vigilats.js` (només lectura) llegeix els noms de la taula i imprimeix les cançons visibles de cadascun, les més noves primer (`--since`, `--artista`). `CLAUDE.md` («Revisar cançons en castellà») porta el prompt per a l'agent: llegir sempre el document, repassar tots els artistes vigilats, amagar només el 100 % castellà/basc i actualitzar el document.

**Trampes conegudes:** (1) Els recomptes per artista de la primera passada (uns 100 IDs, 2026-09-29) són `n/d`: el feed s'ha regenerat i no es poden recuperar. (2) Les claus de `REGLES` han de ser el `channelTitle` exacte: `Txarango Oficial` i `KOP Oficial` eren noms antics i les regles estaven mortes (es va trobar «BENDITA VIDA» de Txarango visible); ara són `Txarango` i `KOP`. Un test (`tests/revisar-castella-vigilats.test.js`) comprova que tots els artistes amb regla són a la taula. (3) Un artista que no és a la taula no es repassa.

**Fitxers Afectats:** `docs/ARTISTES_CASTELLA.md` (nou), `scripts/revisar_castella_vigilats.js` (nou), `scripts/ocultar_titols_castella.js`, `data/hidden-videos.json`, `CLAUDE.md`, `tests/revisar-castella-vigilats.test.js` (nou).

---

## [2026-10-01] - Judit Neddermann: cançons en castellà i en basc

**Símptoma:** Al feed de Judit Neddermann hi havia cançons en castellà (l'àlbum *Aire* i part de *LAR*) i en basc (l'àlbum *Artean*).

**Solució Implementada:** Revisats els 44 vídeos del seu canal; 19 nous a `data/hidden-videos.json` amb la regla `Judit Neddermann` de `scripts/ocultar_titols_castella.js`. **Castellà (12):** la alegría de vivir, Siento Que Vuela (×2), Como Un Amuleto, La Llave De La Alegría (×2), Llévame Contigo (×2), Vivo Viva, Canta, Luna, Celebrar (*Aire* és el seu primer disc en castellà; la lletra de «Celebrar» també ho és). **Basc (7):** Mendien Artean, Zure Ostean / Després de tu, Gorantza / Amunt, Ahizpa / Germana, Neurean / La Meva Llengua (×2), Lamiak / Dones d'aigua.

**Trampes conegudes:** (1) Les cançons d'*Artean* tenen el títol en basc i en català (duets amb artistes bascos): s'han amagat totes perquè són bascos; per recuperar-ne alguna, treu-ne l'ID de `hidden-videos.json` i la paraula de la regla. (2) **No** s'ha tocat «Esperar» (*LAR*): no s'ha pogut verificar en quin idioma és. «misterio do som» és en gallec i no es va demanar. (3) `defaultAudioLanguage` no és fiable (Luna i Celebrar hi consten com `en`); el criteri ha estat l'àlbum i la lletra. (4) L'accent de «alegría» pot venir descomposat: la regla fa servir `alegr\S{1,2}a`.

**Fitxers Afectats:** `data/hidden-videos.json`, `scripts/ocultar_titols_castella.js`, `tests/ocultar-titols-castella.test.js`.

---

## [2026-10-01] - Mòbil: tocar qualsevol part d'una targeta de cançó la reprodueix

**Símptoma:** Al mòbil, tocar el nom de l'artista d'una targeta obria la fitxa de l'artista en lloc de reproduir la cançó; a la portada, a més, només la imatge i el títol reproduïen (la resta de la targeta no feia res). Les files de les llistes desades no reproduïen en tocar-les.

**Solució Implementada:** Només a ≤ 768 px (`isMobileView()`): (1) `bindChannelLinks()` (app.js), abans d'obrir res, mira si l'enllaç és dins un `.video-card`, `.archive-video-card` o `.playlist-video-row`; si és una targeta, reprodueix amb `playThenNavigate()` (font: `data-video-source` o la del contenidor, `_videoCardDefaultSource`); `setupDelegatedVideoCardClicks()` continua ignorant els `.channel-link` perquè no es reprodueixi dues vegades. (2) Portada (`onClick` de `portada.js`): després de «cua» i «desa», qualsevol toc dins `.pt-card[data-video-id]` / `.pt-feature[data-video-id]` reprodueix, abans de `[data-pt-artist]`. (3) Pàgina de llistes: tocar una fila (fora del botó d'eliminar) crida `startPlaylistPlayback(llista, índex)`, que ara admet un índex d'inici. A escriptori no canvia res: el nom de l'artista segueix obrint la fitxa.

**Trampes conegudes:** (1) Les accions (cua, desa, m'agrada, afegeix a llista, eliminar) han de continuar abans del toc genèric; per això a la portada la prova va després de `data-pt-queue`/`data-pt-save`. (2) Els retrats d'artista de la portada (`.pt-portrait`) no són targetes de cançó: el nom segueix obrint l'artista. (3) La ràdio i l'historial ja eren botons sencers. (4) Verificat amb Chromium a 390 i 1280 px (portada, graella de categoria i llista desada).

**Fitxers Afectats:** `js/app.js`, `js/features/portada.js`, `sw.js`, `tests/mobile-card-tap.test.js`.

---

## [2026-10-01] - Artista a cada cançó d'una llista, amb enllaç a la fitxa d'artista

**Símptoma:** Com que els títols que es mostren ja no porten el nom de l'artista (`song-title.js`), les cançons d'una llista de reproducció es veien només pel títol: no se sabia de qui eren i no es podia anar a la seva fitxa.

**Solució Implementada:** (1) `getPlaylistVideoDataLegacyImpl()` (app.js) desa a cada cançó `artistName`, resolt per `library.resolveArtistName()` (js/features/library.js, pur): el nom del canal registrat (el de la fitxa d'artista) i, si no n'hi ha, `channelTitle`. Hi passen totes les vies de desar (afegir a una llista, desar la ràdio, cançons noves a una llista existent). (2) Les llistes ja desades s'arreglen soles: `hydrateStoredPlaylist()` compara l'instantània i, si ha canviat, la torna a desar; `mergePlaylistVideoSnapshot()` també hi posa l'artista quan el vídeo ja no és a cap cau. (3) `renderPlaylistsPageLegacyImpl()` mostra sota el títol de cada cançó `renderPlaylistVideoArtist()`: un `.channel-link[data-channel-id]` que obre la fitxa (`bindChannelLinks(playlistsList)`), o text pla si no hi ha `channelId`.

**Trampes conegudes:** (1) La fila de la llista és `draggable`: l'enllaç és un `div role="link"`, no un `<a>`, perquè arrossegar-lo no obri res. (2) L'artista és el **canal** que publica el vídeo (com a `getVideoArtistKey`); en un col·laboratiu surt el canal, no tots els artistes. (3) La cua de la ràdio (`.mq-artist`) ja mostrava `channelTitle` i no s'ha tocat. (4) El canvi toca `css/styles.css` i `app.js`: calia `npm run sw:version`.

**Fitxers Afectats:** `js/app.js`, `js/features/library.js`, `css/styles.css`, `sw.js`, `tests/library-artist.test.js`.

---

## [2026-10-01] - Cançons amb títol 100 % en castellà a la categoria Urbana

**Símptoma:** A Urbana (la categoria amb més cançons de rap/trap/pop urbà) hi havia cançons amb el títol íntegrament en castellà (31 FAM, Julieta, Sexenni, Mushkaa, BAYA BAYE, Scorpio, DAVEU, Yung Mare).

**Solució Implementada:** Revisió a mà dels 642 títols de cançons d'Urbana (`categories` inclou «Urbana», `song`/`live_song`, no ocults). Criteri: s'oculta només si **tot** el títol és castellà. Es conserven els títols en català, en anglès, mixtos (p. ex. «Timón i Pumba», «Enamorada de tu»), paraules compartides (Tornado, Taxi, Minifalda, Frikis, «Un Bate») i argot o dialecte dubtós (AL CANTU, De Lao, Turra Malvada). Hi ha 34 cançons noves a `data/hidden-videos.json`, afegides amb regles per canal a `scripts/ocultar_titols_castella.js` (`31 FAM`, `Julieta`, `Mushkaa`, `Sexenni`, `DAVEU))`, `Scorpio`, `BAYA BAYE`, `P.A.W.N. Gang`). `defaultAudioLanguage` no s'ha fet servir: a Urbana és poc fiable.

**Trampes conegudes:** (1) Alguns títols porten l'accent descomposat (I + accent combinant): una regex amb `[IÍ]` no hi coincideix, per això «ASÍ ES LA VIDA» usa `AS\S{1,2}`. (2) Només s'ha mirat el títol, no la lletra: una cançó amb títol català i lletra castellana continua al feed. (3) No s'han revisat vídeos que no siguin `song`/`live_song`.

**Fitxers Afectats:** `data/hidden-videos.json`, `scripts/ocultar_titols_castella.js`, `tests/ocultar-titols-castella.test.js`.

---

## [2026-10-01] - Cançons de Serrat en castellà que quedaven al feed

**Símptoma:** Al feed de Joan Manuel Serrat hi havia contingut en castellà: «Tarres (Actuación TVE)» (cançó), «Mediterráneo» (Short del 1975) i l'àlbum «Mediterráneo (ÁLBUM COMPLETO)».

**Causa Arrel:** «Tarres» va entrar al feed després de l'última passada d'`ocultar_titols_castella.js`; el Short i l'àlbum no són `song`/`live_song`, així que la regla per títols no els mira. A més, la regla `totes` de Serrat (excepte «Per al Meu Amic») hauria amagat «Paraules D'Amor», que és en català.

**Solució Implementada:** s'han revisat els 6 vídeos del feed de Serrat (el criteri és la lletra, no `defaultAudioLanguage`: «Paraules D'Amor» hi consta com a `es` i és en català). S'han afegit a `data/hidden-videos.json` `gd0MONP5lGs` (Tarres), `jo2_CypYeC0` (Short) i `-0pnXAl1Pko` (àlbum). Es conserven «Per al Meu Amic» i «Paraules D'Amor» (català) i el directe de VEVO (no és una cançó). L'excepció de la regl…21021 tokens truncated…es-musica.json`) no s'aplicava mai.

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


### 🎵 Revisió d’idioma: Guillermina Motta, Pere Tàpias i La Trinca (2026-10-03)

**Problema:** la llengua indicada per YouTube i els detectors basats només en caràcters poden donar falsos positius, i alguns títols existeixen tant en una versió catalana com en una castellana.

**Solució aplicada:**
- s’han revisat els catàlegs Topic dels tres artistes i s’han afegit a `data/hidden-videos.json` les gravacions confirmades que no són en català;
- s’han creat regles persistents a `scripts/ocultar_titols_castella.js` per als títols inequívocs de Guillermina Motta i La Trinca;
- «Mama Caca», «Vade Retro» i «Flash Reagan» només es bloquegen per ID en les gravacions castellanes, per no eliminar versions catalanes amb el mateix títol;
- «La Patata» de La Trinca es conserva perquè la lletra és catalana;
- «La Moñito» de Guillermina Motta es recupera del descart automàtic: la ñ del títol és un fals positiu i la peça és catalana amb frases paròdiques;
- Pere Tàpias manté la regla de «Oye José María» i «Moreno de la Fe», i s’han ocultat també les gravacions duplicades/en directe d’aquesta darrera;
- no s’utilitza `defaultLanguage` / `defaultAudioLanguage` com a prova de llengua, perquè en aquests catàlegs etiqueta erròniament diverses peces catalanes.

**Fitxers afectats:** `data/hidden-videos.json`, `data/revisio-idiomes.json`, `scripts/ocultar_titols_castella.js`, `docs/ARTISTES_CASTELLA.md`, `docs/PROBLEMES_I_SOLUCIONS.md`.


## [2026-10-03] - La finestra mini de Chrome s'aturava en navegar per Segueix Música — SUBSTITUÏT

**Estat:** aquesta solució es va revertir l'endemà per no facilitar reproducció de YouTube en segon pla. La regla vigent és la secció següent.

**Símptoma:** amb la finestra flotant del sistema (Document Picture-in-Picture de Chrome/Edge) oberta, la música podia aturar-se o perdre la ràdio/llista en anar a Inici, Historial, La teva música, Artistes o un perfil, tot i que la finestra mini continuava oberta.

**Causa Arrel:** la navegació interna només considerava persistent la finestreta pròpia de Segueix Música (`isMiniPlayerActive()`). La finestra mini de Chrome no comptava com a reproductor persistent; per això `handlePlayerVisibilityOnNavigation()` podia executar `stopVideoPlayback()`, `exitPlaylistModeForNavigation()` podia buidar la cua i `navigation.js` podia esborrar l'estat de `currentVideoId`.

**Solució Implementada:** `isPersistentPlayerActive()` unifica els dos casos: finestreta interna o reproducció en segon pla/finestra del sistema (`isPlaybackInBackground()`). La navegació conserva l'iframe, l'estat del vídeo i la cua mentre la finestra mini de Chrome/Edge és oberta. Això complementa la protecció anterior que ja reutilitzava el mateix iframe per canviar de cançó quan Chrome estava minimitzat.

**Proves:** `tests/player-controls.test.js` comprova les tres proteccions de navegació i `tests/browser/verificar-finestra-sistema.js` navega a Historial amb la finestra del sistema oberta i verifica que l'iframe, la reproducció, la cua i la cançó actual es mantenen.

**Fitxers Afectats:** `js/app.js`, `tests/player-controls.test.js`, `tests/browser/verificar-finestra-sistema.js`, `sw.js`, `docs/PROBLEMES_I_SOLUCIONS.md`.


## [2026-10-04] - YouTube només reprodueix mentre el reproductor és visible

**Objectiu:** mantenir la navegació còmoda dins de Segueix Música sense crear una funció de reproducció de YouTube en segon pla.

**Solució Implementada:**
- quan la pestanya queda amagada o Chrome es minimitza (`document.visibilityState === 'hidden'`), s'envia `pauseVideo` al reproductor i es tanca Document Picture-in-Picture;
- Media Session no pot reprendre, anar a anterior/següent ni obrir la finestra del sistema mentre la pestanya és amagada;
- `handlePlaylistVideoEnded()` no avança automàticament la cua en segon pla i `loadVideoInSequence()` desactiva l'autoplay si la pàgina no és visible;
- `swapLivePlayerVideo()` ja no s'utilitza per sostenir àudio en segon pla: queda limitat a la pantalla completa visible;
- en navegar per Inici, Historial, La teva música, Artistes o perfils només es conserva la reproducció quan està activa la finestreta pròpia de Segueix Música, on el reproductor de YouTube continua visible;
- la finestra del sistema es tanca si una navegació interna faria desaparèixer el reproductor visible.

**Proves:** `tests/player-controls.test.js`, `tests/system-player.test.js` i `tests/browser/verificar-finestra-sistema.js`.

**Fitxers Afectats:** `js/app.js`, `js/features/system-player.js`, `tests/player-controls.test.js`, `tests/system-player.test.js`, `tests/browser/verificar-finestra-sistema.js`, `CLAUDE.md`, `sw.js`, `docs/PROBLEMES_I_SOLUCIONS.md`.


## [2026-10-03] - «La teva ràdio» no es veia bé amb la barra lateral oberta

**Símptoma:** a l'escriptori, amb la barra de l'esquerra desplegada i «Continua escoltant» al costat, la targeta de la ràdio quedava d'uns 450–770 px: el títol i el text es partien en moltes línies, les caràtules tapaven el botó «Ràdio nova» i el selector «Quant vols descobrir?» s'aixafava (opcions en 3–4 línies, «Sorprèn-me» tallat).

**Causa Arrel:** les caràtules (mínim 120 px) reservaven a la dreta ~380 px de `padding-right` a tot el cos de la targeta, pensat per a targetes de tot l'ample. En una targeta estreta quedaven uns 70–300 px per al text, el botó i el selector.

**Solució Implementada:** `#homePage.is-portada` és un contenidor; amb menys de 1180 px de contingut les dues targetes s'apilen. Si la targeta fa menys de 900 px, les caràtules són petites i només l'etiqueta, el títol i el text en reserven el lloc; el botó i el selector fan servir tot l'ample (`flex: 1 1 auto` al cos, que és dins un flex). Trampa: una consulta de contenidor no estila el propi contenidor, per això les variables `--pt-cover*` es posen als descendents.

**Proves:** `tests/portada-assets.test.js`; comprovat amb captures a 1920, 1536, 1366, 1100, 900 i 800 px (barra oberta i plegada).

**Fitxers Afectats:** `css/portada.css`, `tests/portada-assets.test.js`, `CLAUDE.md`, `sw.js`, `docs/PROBLEMES_I_SOLUCIONS.md`.

## [2026-10-04] - «Hi falta algú?» sortia sense estil a Artistes i grups

**Símptoma:** a la versió publicada, el bloc de suggeriment d'artistes de `#followPage` sortia com HTML cru: títol en Roboto gros, botó gris del navegador amb la icona enorme, cap fons.

**Causa:** el canvi que el va crear (`4b73725`) va afegir les regles a `css/portada.css` però no va canviar el `?v=` de l'enllaç a `index.html`. L'HTML (network-first) ja era el nou i el CSS sortia de la memòria cau (HTTP i `static-<hash>` del SW, que queda `waiting` mentre l'app és visible).

**Solució:** `?v=` nou a `portada.css` (una URL que cap memòria cau no té) i `npm run sw:version`. El bloc s'ha redissenyat com una franja integrada (disc llima amb micròfon, text, crida llima) amb selectors `#followPage …` perquè guanyin a les regles antigues de `#addYoutuberBtn` i `.follow-subtitle` de `styles.css`, i amb marge a la dreta (30 / 40 px) per no tocar la columna de lletres. **Regla:** si canvies `portada.css` o `styles.css` amb HTML nou que en depèn, canvia també el `?v=` de l'enllaç. Prova: `tests/contacte.test.js`.


## [2026-10-05] - La finestra flotant del sistema porta el vídeo (es pot canviar de pestanya amb el vídeo visible)

**Objectiu:** poder anar per altres pestanyes i webs sense perdre el vídeo, complint les normes de YouTube (no es pot reproduir en segon pla amb el reproductor amagat). Abans la finestra del sistema només portava controls i la pestanya amagada pausava la música.

**Solució:** `system-player.js` trasllada `#videoPlayer` (el node sencer) a la finestra Document Picture-in-Picture; mentre és oberta, el reproductor és visible i `isVideoPipOpen()` és l'única excepció a la pausa amb la pestanya amagada (`visibilitychange`, `handlePlaylistVideoEnded`, `loadVideoInSequence`, `isPersistentPlayerActive`). En tancar-la, el node torna a lloc (`pagehide`) i es reprèn al segon on era; si l'usuari és en una altra pàgina de l'app, queda a la finestreta de dins la pàgina.

**Trampes que ja han mossegat:**
- Moure un iframe el recarrega: cal `start=` i `autoplay=` a la URL (`withPlaybackParams`) i tornar a pausar si estava en pausa (l'app envia `playVideo` en cada càrrega).
- Els `postMessage` de l'iframe van al seu pare, que ara és la finestra flotant: es reenvien a `window` amb `MessageEvent` (mateixa `source`) perquè l'estat, el temps i el final de cançó arribin a l'app.
- `document.getElementById('videoPlayer')` retorna `null` mentre és a la finestra: fer servir `SegueixApp.utils.playerElement()`. Si no, `music-signals.js` deixa de comptar escoltes.
- Els estils de la pàgina no arriben a la finestra: `PIP_CSS` posa `#videoPlayer` a ple amb `!important` (hi queden estils en línia de la pàgina) i amaga tot el que no és `.video-embed-wrap`.
- A la pàgina `#watchPage` no té `hidden` quan s'és a Historial (l'amaga `#mainContent`): per saber si el forat és a la vista cal mirar `#videoPlaceholder.getClientRects()`.
- Proves en navegador: les rutes del succedani de YouTube han d'anar al **context**, no a la pàgina (la finestra és una altra pàgina).

**No verificat:** reproducció real de YouTube a la finestra (possible bloqueig d'autoplay o d'embed per referrer); caldrà provar-ho a Chrome.

**Proves:** `tests/system-player.test.js`, `tests/player-controls.test.js`, `node tests/browser/verificar-finestra-sistema.js`.


## [2026-10-05] Sabor de Gràcia: vídeos auxiliars i selecció de cinc cançons

El feed incloïa l’entrevista «Programa Signes del Temps-Entrevista exclusiva» (W-uxBzgiktg, 28 minuts), ja classificada com `other`, i aparicions com «CULTURAS 2 RTVE-SABOR DE GRACIA» i «PREMIS ENDERROCK 2025», classificades com `song`.

Causa comprovada: `update_music_feed.js` conserva els vídeos públics al feed i delega el filtre a les vistes, excepte quan el canal té `acceptedMusicOnly` o `allowedContentTypes`. A més, el classificador pot acceptar un títol del canal oficial que conté el nom de l’artista, un separador i una durada musical; altres casos acumulen punts per categoria Music, tags i durada. Són senyals de metadades, no una anàlisi de l’àudio. Que un vídeo sigui al feed no demostra que totes les vistes el mostrin: el perfil té també el filtre `isSongVideo`.

Correcció de catàleg demanada: només cinc enregistraments Topic (pCeWfNt-GCE, MZ0YjJC1XVM, FVhxEiH0QVQ, xAIMP0FnPJ8, 1fKzpw-KB0c). Llista blanca de títols exactes, tipus `song` i música acceptada; canal oficial retirat i bloquejat; 36 vídeos addicionals ocultats i arxius dels dos canals eliminats perquè el generador els reconstrueixi amb la selecció. No s’ha alterat globalment el classificador ni s’han retirat vídeos d’altres artistes.

## [2026-10-05] - La finestreta flotant no complia la mida mínima ni «res al damunt» de YouTube

**Símptoma (revisió de normes, no un error visible):** les normes de YouTube demanen que el vídeo inserit faci com a mínim **200 × 200 px** i que no hi hagi **cap element al davant** del reproductor (ni transparent). La finestreta de dins la pàgina:
- a l'ordinador es podia fer fins a 200 × 113 px amb la cantonada (`makeResizable()`), i el CSS per defecte (`.mini-player-active`, 320 px) feia 180 px d'alçada;
- al mòbil ocupa tot l'ample en 16:9: en una pantalla de 320 px feia 180 px d'alçada;
- el mànec d'arrossegar (`.drag-handle-container`, 36 px transparents) i la cantonada de canviar la mida (`.mini-player-resize-handle`, 20 × 20 px, on YouTube té la pantalla completa) eren **damunt del vídeo**.

**Solució:** ordinador: el mànec i la cantonada van en una **franja de 36 px a sobre del vídeo** (`padding-top` amb `box-sizing: content-box` a `#videoPlayer.mini-player-active`; l'alçada en línia que posa `app.js` continua sent la del vídeo) i el vídeo fa com a mínim **356 × 200 px** (`MINI_PLAYER_MIN_WIDTH`, també a `updateMiniPlayerSize()` i `makeResizable()`); `positionMiniPlayerBottomRight()` hi suma `MINI_PLAYER_BAR_HEIGHT`. Mòbil: `height: max(200px, 56.25vw)` (YouTube hi posa franges negres) i els espais reservats a `portada.css` fan servir el mateix valor. Bloc «Finestreta flotant: normes de YouTube» al final de `portada.css`.

**Trampa:** `#videoPlayer .video-embed-wrap` té `height: 100%` (`styles.css`): amb `inset: 36px 0 0 0` el vídeo baixava 36 px i **els controls de YouTube quedaven tallats per sota** (no es veia a les proves fins que es va mirar la caixa de l'iframe). Cal `height: auto !important` perquè mani `inset`. Al mòbil, la vora de dalt d'1 px es menjava 1 px del vídeo (199 px): `box-sizing: content-box`.

**Proves:** `node tests/browser/verificar-play-pausa.js` (vídeo ≥ 200 × 200, vídeo sencer dins la finestra, mànecs fora del vídeo, 320 px d'ample al mòbil, la cantonada no la deixa més petita de 356 × 200); `tests/finestreta-normes.test.js`.


## [2026-10-05] - Selecció de gravacions instrumentals de clàssica

Els canals de solistes i directors poden barrejar peces instrumentals, òpera, cors i entrevistes; els títols genèrics tampoc identifiquen una versió concreta. `allowedVideoIds` a `music-channel-video-allowlist.json` fixa les gravacions verificades, junt amb els títols exactes. El generador consulta directament aquests IDs, comprova el canal propietari retornat per YouTube i manté els filtres de privacitat, contingut i vídeos ocults. Això evita llegir discografies senceres o perdre peces seleccionades per la finestra de 50 pujades o les 40 més populars. Els canals sense aquesta propietat continuen amb el procés anterior.

Els moviments curts de discos Topic no són Shorts: els verificats figuren a `falsos-shorts.json`; la selecció Topic ara respecta aquest registre abans de descartar per durada, com ja feia la sortida final. Les peces revisades com a instrumentals es registren a `revisio-idiomes.json` perquè un títol estranger no les amagui. Crèdits, fonts i exclusions a `docs/REVISION_CLASSICA_2026-10-05.json`.

La selecció manual tampoc aplica la deduplicació de títols pop: «Nocturne No. 2» i «Nocturne No. 4», o concerts amb numeració diferent, són obres diferents. La prova amb respostes API simulades importa les 201 peces amb 7 consultes (2 de canals i 5 de vídeos), cap consulta de playlists i cap peça addicional.

## [2026-10-05] - En recarregar mentre sonava una cançó s'obria segueix.github.io (404) i no l'app

**Símptoma:** a `segueix.github.io/musica/`, si es recarregava la pàgina després d'engegar una cançó, el navegador anava a `segueix.github.io/video/<títol>-<id>` i es quedava en una pàgina d'error («es queda penjat»). Comprovat amb `curl`: `segueix.github.io/`, `segueix.github.io/video/…` i `segueix.github.io/musica/video/…` donen 404; només `segueix.github.io/musica/` dona 200.

**Causa:** herència de Segueix youtubers (`segueix.cat`, a l'arrel del domini i amb `functions/video/[videoKey].js` a Cloudflare). En reproduir, `player.js` (`syncReadableVideoUrl()`) canviava la URL a la ruta llegible **`/video/<slug>-<id>`, escrita des de l'arrel del domini**: a GitHub Pages queda fora de `/musica/`. A més, GitHub Pages no té cap servidor que sàpiga servir `/video/…`. En sortir del reproductor, `normalizeUrlAfterLeavingWatch()` també escrivia `/` (l'arrel del domini). Les URL de les seccions d'`app.js` (`basePath`) partien de la ruta actual, que podia ser la del vídeo.

**Solució:**
- `core/segueix-app.js`: `SegueixApp.utils.appBasePath()` = carpeta de l'app, treta de la ruta del seu propi `<script>` (`/musica/` a GitHub Pages, `/` a l'arrel d'un domini). Qualsevol URL que l'app escrigui amb `pushState` / `replaceState` ha de partir d'aquí.
- `player.js`: la ruta llegible **només s'escriu on un servidor la sap servir** (`supportsReadableVideoPaths()`: no a `*.github.io`) i sempre dins la carpeta de l'app (`${appBasePath()}video/…`). A GitHub Pages la URL es queda a **`/musica/?v=<id>`**, que `index.html` ja obre. En sortir del reproductor la URL torna a `/musica/` sense `?v=` ni `t=` (abans, amb `?v=`, una recàrrega a una secció reobria el vídeo). La caràtula per defecte també parteix de la carpeta de l'app (mai relativa: la URL canvia en reproduir).
- `app.js`: `getAppBasePath()` per a totes les URL de les seccions.
- `404.html` (nou): GitHub Pages el serveix per a qualsevol adreça de `/musica/` que no existeix; una ruta `/musica/video/<títol>-<id>` torna a l'app amb `?v=<id>` i la resta, a `/musica/`.

**No es pot arreglar des d'aquest repositori:** les pestanyes o l'historial que ja tinguin `segueix.github.io/video/…` (a l'arrel). Caldria un repositori `segueix/segueix.github.io` amb un `404.html` que hi redirigeixi.

**Pendent (no tocat):** altres rutes escrites des de l'arrel que a GitHub Pages donen 404 i, per tant, ara no es carreguen: `navigation.js` (`/css/category-chips.css`, `/css/typography-polish.css`, `/css/spacing-polish.css`, `/js/features/segueix-tv.js`, `context-tv.js`, `tv-scroll-ui.js`), `segueix-app.js` (`/js/features/shorts-polish.js`), `channel.js` (`/js/channels-ca.json`). Si s'arreglessin, començarien a carregar-se (canvi visible): decidir-ho abans.

**Proves:** `tests/player-readable-url.test.js` (GitHub Pages: `/musica/?v=<id>`; ruta llegible dins la carpeta), `tests/continue-watching-regressions.test.js`, i opt-in `node tests/browser/verificar-recarrega.js` (simula GitHub Pages amb `context.route`: recarregar torna a l'app amb la cançó, `/musica/video/…` passa pel 404.html, Inici deixa `/musica/`). Amb el codi d'abans, la prova mostra la URL `https://segueix.github.io/video/…` i la recàrrega no torna.

## [2026-10-05] - La PR sortia en vermell per «cerca» (Cercar canals YouTube) sense cap relació amb el canvi

**Símptoma:** la comprovació «cerca» de la PR fallava: `resoldre_canals_verificats.js` → `YouTube API HTTP 403 … exceeded your quota`.

**Causa:** (1) el workflow `cercar-canals-youtube.yml` s'executava en qualsevol `push` que toqués els seus fitxers, **de qualsevol branca**: una fusió de `main` a la branca de la PR hi portava canvis de `data/youtube-verified-handles.json` i el disparava. El job no prova la branca (fa `git reset --hard origin/main`), així que només podia fallar per causes externes. (2) La quota diària de l'API de YouTube (compartida per tots els workflows) era esgotada, i `resoldre_canals_verificats.js` sortia amb error (codi 1); `cercar_canals_youtube.js` ja s'aturava net.

**Solució:** el `push` del workflow només és a `main` (`branches: [main]`), i `resoldre_canals_verificats.js` reconeix la quota esgotada (`isQuotaError()`: 403 amb `quotaExceeded`/`limit`), s'atura, desa el que ja ha resolt i surt amb codi 0 (la propera execució diària, 08:17 UTC, continua). Qualsevol altre error de l'API continua fent fallar el job. Prova: `tests/resoldre-canals-quota.test.js`.


## [2026-10-05] - Retirada de Clàssica sense dependre de YouTube

L’usuari retira la categoria Clàssica i els seus 78 artistes. Els 76 canals queden bloquejats i registrats amb `channelIds` a `music-exclusions.json`. L’arxivador purga aquests canals del feed, del mapa de canals i dels arxius abans de reconstruir l’historial i l’índex. Això evita que l’arxiu recuperi gravacions retirades i permet completar les baixes encara que s’hagi esgotat la quota de YouTube. El workflow d’arxiu respon a canvis d’exclusions i comparteix `music-data-writer` amb els altres generadors. La llista `musica-classica.json` fa referència a música antiga per ponderar ràdios, no al gènere retirat, i es conserva.


## 2026-10-06 — Seleccions de tres pistes i actualització dels canals revisats

Pixamandúrries i Gra Fort només mostraven tres vídeos perquè `allowedVideoIds` era una selecció inicial tancada. El generador consulta directament aquests IDs i no descobreix la resta del canal. Ampliar només `allowedTitles` no serveix si no s’amplien també els IDs.

Revisió de l’inventari i evidències: `docs/REVISION_PIXAMANDURRIES_GRA_FORT_2026-10-06.json`. Les quatre peces curtes en català de L’any dels gossos retornen HTTP 303 des de `/shorts/ID` cap a `/watch?v=ID`; s’han registrat com a falsos Shorts. Sense aquest registre el filtre de durada les torna a descartar.

El workflow `actualitzar-feed-musica.yml` delimita ara els pushes de seleccions/falsos Shorts comparant els commits de l’esdeveniment. Consulta només els canals amb regles modificades o amb un fals Short afectat. Una revisió sense canvis efectius no consulta YouTube. Si no pot atribuir un fals Short a un canal, falla explícitament abans de consultar l’API; es pot fer la revisió general manual. Les execucions programades/manuals generals i l’acció manual de grups nous mantenen el seu abast. Proves: `tests/canals-revisats.test.js`.

## [2026-10-06] - S'acabava la quota de YouTube cada dia (actualitzador del feed musical)

**Símptoma:** la quota diària (10.000 unitats) s'esgotava i, algun dia, l'execució programada perdia la feina en publicar (`! [rejected] HEAD -> main (fetch first)`) després d'haver gastat la quota.

**Causes:**
1. **Una baixa regenerava tot el feed.** Si un canal sortia de `data/artistes-musica.json` (rebutjat, ID corregit), el pas «Detecta» deixava `MUSIC_TARGET_CHANNELS` buit per «purgar-lo»: es tornaven a llegir tots els canals (≈ 1.200 unitats) per treure'n un (p. ex. l'execució 37320080818, «🗑️ Canals eliminats: UCezETW2-gAMtXB98LGBweWQ»).
2. **La discografia sencera dels ~286 canals Tema cada dia** (fins a `MUSIC_TOPIC_MAX_PAGES` pàgines per canal): ≈ 390 unitats diàries que no canvien gairebé mai.
3. **Massa disparadors:** cron diari + cada canvi de codi del generador/detector + els workflow_run, cadascun una regeneració general.
4. **Publicació sense reintent:** `git push origin HEAD:main` fallava si main havia canviat durant la generació, i el feed es perdia.

**Solució:**
- `scripts/purgar_canals_feed.js` + `scripts/lib/purga_canals.js`: treu les baixes del feed, `channels-ca.json`, revisions, catàleg Tema, estat del catàleg, discos, auditoria i **arxiu** (també els arxius de canals que ja no són a la base i que continuaven alimentant `historial-musical.json` i `history-pool.json`: n'hi havia 5 d'IDs antics) sense API. Mateix format d'escriptura que el generador (`serializeFeed(slimFeed())`, catàleg Tema un canal per línia).
- Canals Tema per torns (`scripts/lib/canal_tema.js`: `topicReadTurn`, `shouldReadFullTopic`, `mergeTopicTracks`): primera pàgina cada dia + discografia sencera un dia de cada 7. Fora del torn es conserven les pistes que ja eren al feed (`partialTopicIds` → `pickRetained`). Simulació: una execució general passa de ≈ 1.168 a ≈ 778 unitats sense perdre cançons.
- `scripts/lib/abast_feed.js` (`decideScope`): general només a les 20 h de Madrid (dos crons UTC + comprovació de l'horari d'estiu), altes només dels canals nous, baixes sense API, push només per a revisions de dades.
- `scripts/publicar_dades.sh`: `git pull --rebase -X theirs` i reintent (4 vegades) abans de donar-se per vençut.

**Trampa en provar-ho:** `archivar_feed_musical.js` treballa sobre `path.resolve(__dirname, '..')`, no sobre el directori actual: per provar-lo en una còpia de les dades, copia-hi també `scripts/`. I no tallis la sortida de `purgar_canals_feed.js` amb `| head`: el SIGPIPE l'atura a mitja escriptura.

**Proves:** `tests/quota-feed.test.js`.



## [2026-10-06] - Transferir Música per WhatsApp des de GitHub Pages

La vinculació heretada apuntava a `/api/sync`, inexistent a GitHub Pages. A Configuració es substitueix per «Passa la teva música a un altre aparell»: enllaç comprimit amb `#music-transfer=` i confirmació explícita en destí. El mòdul captura i retira el fragment abans de l'arrencada; no crida cap API de sincronització. La base és la mateixa `SHARE_BASE_URL` de `share-codecs.js`, actualment `https://segueix.github.io/musica/`. Canviar-la quan es migri el domini.

El payload v1 `segueix-musica` usa una llista explícita de dades: historial, cors (incloent IDs legacy), seguits, llistes, categories musicals, preferències, estadístiques d'escolta, estils inicials i mode de descoberta. No exporta tokens, consentiments, identificadors analítics, caches, volum ni reproducció activa. S'eliminen metadades prescindibles (miniatures, descripcions); les miniatures importades es deriven de l'ID de YouTube. Historial actual: 50 cançons (`HISTORY_LIMIT`), sense augmentar-lo en aquest canvi.

La fusió conserva dades locals i és idempotent; llistes amb ID coincident i nom diferent es conserven separades amb un ID estable. Les estadístiques/preferències usen `mergeStats`/`mergePrefs`; si una escriptura falla es restauren els valors anteriors. Després de confirmar, es recarrega la pàgina per reinicialitzar els caches. L'usuari pot cancel·lar sense cap escriptura.

Límit propi d'enllaç: 8.000 caràcters (pressupost conservador, no una garantia universal de WhatsApp). Mai es retalla historial o llistes per fer-lo cabre: es proposa el fitxer JSON musical (màxim 2 MB en importació). L'enllaç és una còpia transferible, no una vinculació permanent, no caduca ni es pot revocar. No confondre el nou fitxer musical amb l'antic «Exportar tot» de configuració.

Verificació: `tests/music-transfer.test.js` cobreix exclusions de dades, validació, fragment, límits, fusió repetida, col·lisions, preferències, prototips i rollback per quota.


## [2026-10-06] - «Massa gran» amb una còpia de 42 kB: compartir el fitxer real

L'avís anterior corresponia al pressupost de 8.000 caràcters de l'enllaç comprimit, no a la mida admissible del fitxer. S'elimina la generació d'enllaços de la interfície i del mòdul; es conserva només la lectura dels enllaços antics. A Configuració, mòbil i ordinador mostren «Genera el fitxer», «Comparteix» i «Importa un fitxer», sense missatges ni seccions sobre límits d'enllaç.

`createFile()` genera `segueix-musica-copia.txt` amb contingut JSON versionat (`segueix-musica`, v1), i `navigator.share({files:[file], title: ...})` comparteix el fitxer real. Text pla s'admet en més menús natius de compartir que `application/json`; `navigator.canShare({files})` comprova la capacitat real. Importació compatible amb .txt, .json i BOM. La generació i importació de fitxers no passen pel còdec d'URL ni pel pressupost dels enllaços. No es retalla la còpia.

Quan el navegador permet compartir fitxers, «Genera» els prepara en memòria i «Comparteix» obre el selector natiu sense crear una descàrrega prèvia. Si el navegador d'escriptori no ofereix aquesta funció, «Genera» desa el fitxer i «Comparteix» obre WhatsApp Web: el text explica que cal adjuntar-lo com a document (una web no pot adjuntar un fitxer automàticament a WhatsApp Web). Cancel·lar el selector natiu no inicia aquest camí alternatiu.

Proves: còpia de més de 42 kB generada i reimportada sense pèrdues; fitxer real passat a Web Share, camí d'escriptori sense aquesta API, cancel·lació i compatibilitat amb JSON anteriors. Es mantenen les proves de fusió, idempotència i rollback.

## [2026-10-06] - Fitxer propi de Música, PNG de llistes i importació de TXT

Hi havia dos fluxos diferents: compartir ràdios/llistes generava una targeta PNG amb QR; la còpia musical de Configuració generava JSON dins un .txt. A més, «Importar tot» encara filtrava només .json i no reconeixia el payload musical. Ara les ràdios/llistes fan servir un diàleg de generar/compartir dades, sense PNG ni retallar la cua a 30 cançons. Només inclouen la llista compartida, mai l'historial personal.

El format és JSON v1 amb extensió `.segueixmusica` i MIME `application/vnd.segueix-musica+json`. El manifest registra exclusivament aquesta extensió; launchQueue passa el fitxer per la mateixa validació i confirmació d'importació. Requereix PWA instal·lada, navegador d'escriptori compatible i associació/permís del sistema. No és un format xifrat ni exclusiu i no es promet obertura directa a Android o des de WhatsApp.

Si Web Share rebutja l'extensió pròpia però accepta text, es comparteix la mateixa còpia com a `.segueixmusica.txt`. Tots dos selectors d'importació accepten .segueixmusica, .json i .txt, inclòs el fitxer .txt anterior amb BOM. «Importar tot» reconeix `product: segueix-musica` i mostra la confirmació musical abans d'escriure cap dada. El camí de configuracions antigues es conserva.

Proves: còpia >42 kB, fallback de compartició TXT, associació de fitxers amb confirmació i rebuig de dades corruptes, obertura múltiple explícita, 75 cançons de ràdio conservades, importació TXT des d'«Importar tot» sense sobreescriure storage abans de confirmar.

## [2026-10-06] - La còpia musical s'obre directament des de WhatsApp Web; fora «Exportar tot» i «Importar tot»

**Símptoma/Petició:** un fitxer adjunt a WhatsApp Web només es descarrega: no hi ha manera que obri Música. L'usuari volia que, des de WhatsApp Web, la còpia s'obrís directament a la web, i treure «Exportar tot» / «Importar tot» de Configuració.

**Causa Arrel:** el camí principal era el fitxer `.segueixmusica`. L'associació de fitxers (`launchQueue`) només funciona amb la PWA instal·lada en un ordinador compatible i mai des d'un adjunt de WhatsApp Web. L'enllaç de la primera versió s'havia abandonat pel límit de 8.000 caràcters, que era propi i no de WhatsApp.

**Solució Implementada:** `music-transfer.js` torna a fer de l'**enllaç** el camí principal: `buildLink()` → `https://segueix.github.io/musica/#musica=<LZString>` amb `+`→`~` i `$`→`_` (alguns xats tallen l'enllaç en aquests caràcters; `parseLink()` ho desfà i continua llegint `#music-transfer=`). Límit `MAX_LINK` = 60.000 caràcters (un missatge de WhatsApp n'admet 65.536); una còpia real de 26 kB fa uns 6.000 caràcters. En obrir l'enllaç, el fragment es captura i s'esborra abans de l'arrencada i surt la mateixa confirmació d'importació; en confirmar es recarrega a `appBasePath()` (abans anava sempre a github.io).
- **Configuració:** «Envia per WhatsApp» (llima), «Copia l'enllaç», «Desa el fitxer» i «Importa un fitxer». Cada botó recull les dades del moment (ja no hi ha el pas «Genera el fitxer»).
- **Envia per WhatsApp** (`sendToWhatsApp()`): al mòbil (`pointer: coarse`) menú natiu amb el text i l'enllaç; a l'ordinador `web.whatsapp.com/send?text=` amb el missatge escrit si l'adreça fa ≤ 7.000 caràcters (`MAX_PREFILL`: el paràmetre passa pel servidor de WhatsApp); si és més llarg, copia el missatge al porta-retalls i obre WhatsApp Web perquè s'enganxi. Si la còpia no cap en un enllaç, es comparteix com a fitxer (Web Share o descàrrega + WhatsApp Web), com abans.
- Les ràdios i llistes (`showListExport()`) fan servir els mateixos tres botons.
- **Eliminat:** «Exportar tot» / «Importar tot» (`exportConfigManual`, `importConfigManual`, `handleManualFileImport` de `config-sync.js` i `#configManualFileInput`). Exportaven tot el `localStorage` (també claus que no són de música). No els hi tornis a posar: la còpia musical i «Importa un fitxer» en fan la feina.

**Trampes:** (1) Copiar al porta-retalls s'ha de fer **abans** d'obrir la pestanya de WhatsApp (sense focus, `clipboard.writeText` falla). (2) Si el navegador bloqueja la finestra emergent, `#musicTransferWhatsAppFallback` apareix amb l'adreça. (3) LZString ve del CDN: sense ell no es pot llegir l'enllaç (surt l'error de còpia no vàlida).

**Proves:** `tests/music-transfer.test.js` (enllaç sense `+`/`$` i ida i tornada, WhatsApp Web amb el text, porta-retalls per a enllaços llargs, menú natiu al mòbil, cancel·lació, fitxer quan no cap, fragment nou retirat). Verificat també al Chromium: enllaç generat per l'app, obert en un altre context → confirmació → historial importat.

## [2026-10-06] - L'enllaç de música enviat per WhatsApp no es podia llegir

**Símptoma:** en obrir des de l'ordinador l'enllaç rebut per WhatsApp, Música deia «No s'ha pogut llegir l'enllaç. Demana una còpia nova.»

**Causa Arrel:** per evitar `+` i `$` (alfabet de LZString), l'enllaç els canviava per `~` i `_`. WhatsApp fa servir `_text_` per a la cursiva i `~text~` per al ratllat: en enviar-lo, prenia parells d'aquests caràcters com a format i els esborrava, i les dades quedaven malmeses.

**Solució Implementada:** `buildLink()` codifica `+` → `%2B` i `$` → `%24` (codificació d'URL estàndard, sense cap caràcter de format de WhatsApp: `_ ~ * \``). `parseLink()` fa `decodeURIComponent()` i continua acceptant `~`/`_` dels primers enllaços. Prova: `tests/music-transfer.test.js`.

**Trampa:** mai posis `_`, `~`, `*` ni `` ` `` en un enllaç que hagi de passar per WhatsApp. Un enllaç enviat per WhatsApp sempre es veu sencer al missatge: no es pot amagar sense un servei d'enllaços curts (i l'app és a GitHub Pages, sense servidor).

## [2026-10-06] - Enllaç massa llarg: s'envia una llista i els artistes, només amb identificadors

**Símptoma/Petició:** l'enllaç de «Passa la teva música» era massa llarg (al WhatsApp es veia un bloc de text). L'usuari vol enviar **una llista triada d'un desplegable i els artistes que segueix**, i prou: amb això, a l'altre aparell pot continuar escoltant i la ràdio ja coneix els seus artistes.

**Solució Implementada:** `music-transfer.js`: `selection(llista, ambArtistes)` fa la còpia només amb la llista triada (`catube_playlists`) i, si es marca, `catube_follows`; `compact()` deixa a l'enllaç només identificadors (cançons i canals) i el nom de la llista. Una llista de 25 cançons i 8 artistes: missatge de ≈ 1.080 caràcters (abans, 50 cançons de l'historial ja en feien 2.200, i tot plegat molts milers). En confirmar a l'altre aparell, `hydrate()` hi posa títol, artista, canal, durada i categories des de `catalogMap()` (feed, pool d'història i `ensureStyleHistory()`); una cançó que no hi sigui queda només amb l'ID (la miniatura es deriva de l'ID). `summary()` només diu el que hi ha («llista «Estiu» (25 cançons) · 8 artistes»). Eliminat «Desa el fitxer»; «Importa un fitxer» es manté per a les còpies antigues. La importació de còpies completes antigues (enllaços i fitxers) continua funcionant.

**Trampes:** (1) `catalogMap()` espera que el feed hagi carregat (fins a 10 s) abans de demanar `ensureStyleHistory()`: demanat abans, l'historial dels estils filtra per canals encara buits i queda buit tota la sessió. (2) El desplegable es refà en apropar-s'hi (`pointerenter`/`touchstart`/`focusin` de la secció) només si les llistes han canviat (signatura), i conserva la triada; «Cap llista» només es manté si l'ha triat l'usuari (`dataset.chosen`).

**Proves:** `tests/music-transfer.test.js` (selecció sense historial ni títols, avisos, títols del catàleg, desplegable, WhatsApp Web, porta-retalls, mòbil, cancel·lació). Verificat al Chromium amb el feed real: llista de 25 cançons i 8 artistes importada en un altre context amb els 25 títols i l'historial buit.

## [2026-10-06] - L'enllaç de música no feia res a l'ordinador amb l'app ja oberta

**Símptoma:** l'enllaç `#musica=…` rebut per WhatsApp no obria la confirmació d'importació a l'ordinador. Les dades de l'enllaç eren correctes (es descodificava: llista «Ràdio Cançó d'autor» amb els seus identificadors).

**Causa Arrel:** `music-transfer.js` només llegia el fragment en carregar la pàgina (`initialHash`). Si la pestanya o l'app instal·lada ja era oberta a `segueix.github.io/musica/`, obrir-hi l'enllaç només canvia el fragment (`#…`): no hi ha càrrega nova i no passava res. L'app instal·lada (PWA) que ja és oberta pot rebre l'adreça per `launchQueue` (`targetURL`), que només atenia fitxers.

**Solució Implementada:** `openLink()` comú; escolta `hashchange` (treu el fragment de l'adreça i obre la confirmació) i, a `launchQueue`, si no hi ha fitxers mira `launch.targetURL`. `showImport()` no torna a cridar `showModal()` si el diàleg ja és obert. Proves: `tests/music-transfer.test.js` («Obrir un enllaç amb l'app ja oberta»); verificat al Chromium navegant al fragment amb l'app ja carregada.

**Trampa:** un enllaç de WhatsApp sempre es veu escrit sencer al missatge; no es pot amagar sense un servei d'enllaços curts.

## [2026-10-06] - Cançons sense títol en importar una llista enviada per enllaç

**Símptoma:** en importar una llista («Ràdio Cançó d'autor», 31 cançons) algunes cançons arribaven trencades, sense títol.

**Causa Arrel:** l'enllaç només portava els identificadors i l'altre aparell en treia el títol del catàleg públic (feed, `history-pool.json`, `historial-musical.json`). 13 de les 31 cançons ja no hi eren: la majoria eren pistes de canals «Tema» que havien sortit del feed (cada dia només s'hi posa una part de la discografia, i no van a l'arxiu) i dues eren a `hidden-videos.json`. La llista desada sí que en tenia el títol.

**Solució Implementada:** `compact(payload, knownIds())`: una cançó que és al catàleg carregat de l'aparell que envia viatja només amb l'ID; una que no hi és viatja amb `{ id, title, channelTitle }` (els de la llista desada), i `hydrate()` no sobreescriu un títol que ja arriba. Si l'historial dels estils encara no s'ha carregat, simplement hi van més títols (l'enllaç és més llarg, mai trencat). A més, d'una llista o ràdio només s'envien les **50 primeres cançons** (`MAX_SHARE_SONGS`), en l'ordre en què sonen. Proves: `tests/music-transfer.test.js` («Cançons que ja no són al catàleg i límit de cançons»); verificat al Chromium (22 del catàleg + 3 fora del catàleg: les 25 amb títol).

## [2026-10-06] - Compartir una llista i compartir els artistes, per separat

**Petició:** separar l'enviament d'una llista del dels artistes que se segueixen (abans anaven junts, amb una casella).

**Solució Implementada:** dos blocs a «Passa la teva música a un altre aparell» (`index.html`, `.music-transfer-block`): «Una llista» (desplegable sense «Cap llista») i «Els artistes que segueixo (N)», cadascun amb «Envia per WhatsApp», «Copia l'enllaç» i el seu propi avís. `bindAction(botó, acció, artistes)` crida `selection(llista, false)` o `selection('', true)`; avisos propis: «No tens cap llista per enviar.» i «Encara no segueixes cap artista.». El missatge només diu el que s'envia («llista «Estiu» (25 cançons)» o «8 artistes»). Proves: `tests/music-transfer.test.js`; verificat al Chromium.

## [2026-10-06] - Enrere / endavant amb la ràdio sonant: fitxa antiga, sense ràdio i amb el reproductor buit

**Símptoma:** a l'ordinador i al mòbil, amb una ràdio sonant (sovint amb la finestra flotant), en tornar enrere i després endavant (o tornar a la cançó amb els botons del navegador o del mòbil), la vista es trencava: la fitxa d'un vídeo sol, amb el reproductor negre sense vídeo, «Altres vídeos relacionats» i sense la ràdio. També passava en prémer «enrere» per tornar a la cançó anterior de la ràdio.

**Causa Arrel:** el `popstate` d'`app.js` cridava `showVideoFromAPI(videoId)` per a qualsevol entrada `{ videoId }` de l'historial. Com que no era una navegació de cua (`isPlaylistNavigation` fals), `showVideoFromAPI` feia `exitPlaylistMode()` (buidava la cua) i `exitMiniPlayerForNewVideo()`, i pintava la fitxa d'un vídeo sol. Al mòbil, a més, sortir de la cançó ja havia aturat la ràdio (`exitPlaylistModeForNavigation()`, norma: al mòbil no es conserva fora de la finestra flotant) i no en quedava res per recuperar.

**Solució Implementada:** `restoreVideoFromHistory(videoId)` (app.js), cridada pel `popstate` abans de carregar el vídeo sol:
- si és la cançó que ja sona i hi ha iframe: si és a la finestra flotant, la restaura (`setMiniPlayerState(false)` + `collapseMobileHeaderForWatchPage()`); si la fitxa ja es veu, no fa res;
- si la cançó és a la ràdio/llista que sona, la reprodueix dins la cua (`currentPlaylistIndex` + `loadVideoInSequence({ replaceHistory: true })`, que ara accepta `replaceHistory` per no afegir entrades a l'historial);
- si no, i és a la cua desada en sortir-ne (`queueBeforeNavigation`, que desa `exitPlaylistModeForNavigation()` abans de buidar-la; s'esborra quan torna a sonar una cua), la recupera i hi reprodueix la cançó.
La TV (`__segueix_tv_discovery__`) no hi entra. El vídeo potser no arrenca sol al mòbil (el navegador no deixa reproduir sense un toc després d'enrere/endavant): cal prémer play.

**Proves:** `tests/player-controls.test.js` («enrere / endavant del navegador amb una ràdio o una llista») i opt-in `node tests/browser/verificar-enrere-radio.js` (1280 i 390 px: finestra flotant → enrere → endavant; enrere → endavant; següent → enrere → endavant). Amb el codi d'abans, les tres fallen.

## [2026-10-06] - Decisió final: un sol fitxer JSON amb tota la música

**Petició:** després de provar els enllaços (una llista, els artistes per separat), l'usuari prefereix **un sol JSON, que es pugui enviar i pujar, amb tot l'historial, els artistes que segueix i els m'agrada**.

**Solució Implementada:** a Configuració, «Passa la teva música a un altre aparell» només té «Envia el fitxer», «Desa el fitxer» i «Importa un fitxer». El fitxer és `segueix-musica-AAAA-MM-DD.json` (`application/json`) amb `collect()` (historial, m'agrada, seguits, llistes, categories, preferències, estadístiques, estils i mode). «Envia» fa servir Web Share amb el fitxer; Chrome per a Android no accepta `.json` al menú de compartir, així que `shareableFile()` el passa com a `.json.txt` (mateix contingut; la importació l'accepta). Sense Web Share de fitxers (ordinador), el desa i obre WhatsApp Web perquè s'hi adjunti. Cancel·lar el menú no fa res. La importació mostra el resum («llista «Estiu» (20 cançons) · 9 artistes · 30 cançons a l'historial · 12 m'agrada») i fusiona amb el que hi ha. Eliminats de Configuració el desplegable de llistes, el bloc d'artistes, `selection()` i `refreshListPicker()`. Es mantenen la lectura dels enllaços `#musica=` i l'enllaç de compartir una ràdio/llista.

**Proves:** `tests/music-transfer.test.js` («Un sol fitxer JSON amb tota la música»); verificat al Chromium: fitxer desat (30 + 12 + 9 + 1 llista, 6 kB) i importat en un altre context amb tot.


## [2026-10-07] - Drive substitueix els fitxers i els codis de vinculació

**Petició:** eliminar tot el sistema anterior de transferència de configuració i historial i preparar Google Drive. La configuració OAuth es farà després.

**Solució:** `music-data.js` recull només dades permeses; `drive-sync-model.js` fusiona registres i eliminacions; `google-drive-sync.js` gestiona OAuth i la carpeta privada de Drive. Un fitxer per aparell evita sobreescriptures concurrents. Les pestanyes es coordinen amb Web Locks. El diari local conserva la base real aplicada, separada dels canvis remots pendents, per recuperar-se d’errors de xarxa. Retirats `music-transfer.js`, `backup-codecs.js`, `/api/sync`, els handlers de fitxers PWA i la importació d’historial per URL. No s’esborren les dades musicals existents.

**Activació:** identificador públic a `js/google-drive-config.js`; buit mostra «pendent d’activació» sense carregar Google. Instruccions a `docs/GOOGLE_DRIVE.md` i política pública a `privacitat.html`. En arribar canvis es recarrega l’app: primer s’actualitza la memòria de `musicSignals` perquè no torni a desar estadístiques antigues.

**Proves:** models de fusió i eliminació, idempotència, llistes editades en dos equips, permisos, privacitat, errors, paginació i recuperació d’una escriptura fallida amb API simulada. La prova real OAuth queda pendent del client Google.

**Actualització en navegadors que ja tenien l’app oberta:** a la prova publicada, l’HTML nou es combinava amb `app.js?v=20261006-file-3` de la memòria cau i aquest intentava registrar `backupCodecs`, que ja s’havia retirat. Cal canviar també la versió de les URLs dels scripts modificats (`app.js`, `config-sync.js`, `music-signals.js` → `20261007-drive-1`), a més de regenerar el service worker. No n’hi ha prou de canviar només el hash del SW en una substitució de mòduls.

## [2026-10-07] - La primera sincronització amb Drive falla per falta d'espai local

**Símptoma real:** després d'autoritzar Google, Configuració mostra «No hi ha prou espai al navegador per aplicar la sincronització». El compte encara no queda vinculat.

**Causa identificada al codi:** les escriptures del dispositiu, del diari de fusió i de les dades compartien la quota de localStorage amb instantànies del feed i memòries cau de cerca. No hi havia cap recuperació de quota. La captura no permet mesurar quina clau omplia l'aparell; la regressió es reprodueix amb emmagatzematge de capacitat limitada.

**Solució:** `musicData.writeStorage()` reintenta una vegada després d'eliminar exclusivament caches regenerables (`catube_feed_v1`, `catube_archive_idx_v1`, `catube_chips_html_cache`, `iutube_feed_snapshot_v1`, `iutube_cache_*`, `catube_cat_*`). Conserva dades personals, posició de reproducció, consentiments, altres aplicacions i diaris de Drive. S'aplica tant a les metadades de connexió com a les dades musicals. No es neteja res en errors aliens a la quota. Les dades, el diari final i la data de sincronització es confirmen en el mateix lot; si falla, s'alliberen les escriptures parcials abans de restaurar-ne la còpia anterior, perquè les expansions no impedeixin recuperar les claus que s'havien reduït. Si les dades personals soles no hi caben, el procés s'atura amb la base pendent intacta per al reintent.

**Proves:** quota persistent abans de crear el dispositiu, al diari i en aplicar canvis remots; preservació de dades alienes, recuperació davant quota insuficient sense cache, error en confirmar el diari final i reintent, i SecurityError sense neteja. 47 proves relacionades superades. Versions de `music-data.js` i `google-drive-sync.js` a `20261007-space-1` per evitar barrejar mòduls antics amb els nous.

## [2026-10-07] - «Pendent d’activació» després d’una sincronització correcta

**Símptoma:** després de sincronitzar al mòbil i tornar a Configuració, apareixia que Google Drive estava pendent d’activació.

**Causa:** el missatge era text estàtic d’index.html. En recarregar l’app després d’aplicar dades remotes, `render()` recuperava el compte i la data, però només canviava el missatge si faltava el client OAuth. Amb el client configurat deixava el text inicial incorrecte.

**Solució:** HTML inicial sense diagnòstic d’activació. En registrar el panell es mostra «Compte connectat» si hi ha vinculació desada, o la invitació a connectar si no n’hi ha. Es reserva «pendent d’activació» per a l’absència real del client OAuth. També es refresca l’estat quan una altra pestanya canvia la vinculació, sense trepitjar una sincronització en curs. Els resultats i errors de l’operació actual es conserven; no s’afirma que les dades estan al dia només per tenir un compte vinculat. URL del mòdul versionada a `20261007-status-1`.

**Proves:** inici configurat sense compte, sincronització seguida d’una recàrrega amb el mateix emmagatzematge, recuperació de compte/data sense peticions automàtiques, errors posteriors conservats, desconnexió en una altra pestanya i estat sense client OAuth.

## [2026-10-07] - Un cor visible podia quedar fora de la sincronització

**Símptoma notificat:** un m’agrada del mòbil no apareix a l’ordinador després de sincronitzar i recarregar. No s’ha pogut inspeccionar l’emmagatzematge dels aparells de l’usuari.

**Error reproduït:** `likes.toggleLikeVideo()` retornava l’estat nou i pintava el cor, però ajornava l’escriptura amb `requestIdleCallback` sense termini. Si encara no s’havia executat en sincronitzar, Drive recollia les dades anteriors. A més, diversos clics seguits podien partir de la mateixa llista antiga, i un callback pendent podia sobreescriure favorits rebuts de Drive. Les proves carreguen el mòdul real de cors amb el callback inactiu pendent i simulen dos aparells; fallaven abans del canvi.

**Solució:** el cor es desa immediatament, abans de retornar l’estat visual i emetre l’esdeveniment dels gustos. La sincronització conserva també un resum local de l’operació completada (nombre d’aparells amb còpia i m’agrada resultants), visible amb el compte i la data després de recarregar. Serveix per diagnosticar si el problema notificat persisteix; no indica actualització automàtica. URLs de `likes.js` i `google-drive-sync.js` versionades.

**Proves:** afegir i treure un cor amb els callbacks inactius pendents, enviament a un segon aparell, diversos clics seguits, resum persistent després de recarregar. 67 proves relacionades superades. La confirmació sobre els aparells reals queda pendent.

## [2026-10-07] - Després de sincronitzar es perdia la ràdio en recarregar

**Símptoma:** Drive ja sincronitza, però en tornar al reproductor apareix la vista antiga de vídeo individual, amb l’espai de la ràdio buit.

**Causa:** la sincronització recarrega l’app quan aplica canvis. La URL `?v=` només conserva el vídeo; la cua i el context musical vivien en memòria. L’arrencada interpretava la URL com un enllaç independent, cridava `showVideoFromAPI()` i sortia del mode llista. L’estat local de vista tampoc desava la cua.

**Solució:** `musicQueue.captureSession/restoreSession` conserva la cua, l’índex i el context de ràdio (estils, nom, artista/cerca i mode) dins l’estat de sessió de la pestanya. En una recàrrega real de la mateixa cançó, l’arrencada recupera aquest estat abans d’obrir el vídeo individual i passa el segon desat a `loadVideoInSequence`. La còpia es llegeix al començament per evitar que una vista provisional la substitueixi. Es prepara en pausa. Les metadades dels vídeos de la cua recuperada tornen al catàleg en memòria perquè les cançons fora del feed mantinguin títol i artista.

**Límits:** la cua no viatja a Drive; un enllaç nou no recupera una cua antiga; les TV i les dades de sessió invàlides continuen pel camí anterior. Versions de `app.js` i `music-queue.js` actualitzades.

**Proves:** sessió nova amb la mateixa cua i segon; ràdio d’artista amb context; arrencada que sobreescriu temporalment la vista; enllaç nou, vídeo diferent, sessió malmesa i TV. Proves relacionades de reproducció, ràdios i Drive.

## [2026-10-07] - Sincronització automàtica agrupada i sense recàrrega

**Petició:** enviar i rebre canvis sense prémer el botó a cada operació ni interrompre la música.

**Solució:** monitor local cada 5 segons, actiu només amb token vigent, compte connectat, app visible i xarxa. Agrupa preferències uns 10 segons després de detectar l’últim canvi i consulta Drive cada minut; historial/estadístiques esperen aquest cicle. No hi ha finestres OAuth des de temporitzadors. Caducitat: avís per renovar amb un toc. Els errors provoquen espera progressiva fins a 15 minuts; la desconnexió talla les peticions. El monitor té exclusió pròpia i les escriptures mantenen Web Locks.

**Quota:** es demana `files.version` i es conserva en memòria la còpia validada de cada fitxer. Només es baixa una versió diferent; només es puja el fitxer propi quan ha canviat. Sense canvis, un cicle necessita habitualment dues peticions (compte i llistat de versions). Es buida la cache en renovar el token o canviar la vinculació.

**Aplicació en viu:** hook `refreshSynchronizedMusic` d’app.js; actualitza cors, seguits, pantalles de dades i preferències, però mai torna a carregar el vídeo ni la cua. `musicSignals.persistForSync()` desa els comptadors pendents sense cridar `flush()`, que finalitzaria la sessió. La transacció de dades/diari/compte i la recuperació de quota continuen actives. Els canvis locals durant una petició es conserven per al cicle següent.

**Proves:** rellotge simulat amb cicles reals de registre i OAuth, agrupació de cors, historial al minut, recepció d’un altre aparell, versions inalterades sense transferència, segon pla, absència de xarxa, desconnexió, caducitat sense finestres i espera davant 429. Hook real de vista: repinta cors i biblioteca sense canviar cua, posició ni pàgina; preserva formularis amb focus. Testing de Google: set dies d’autorització, cap prova de 24 hores implementada.

## [2026-10-11] - Una cançó no disponible aturava la ràdio

**Símptoma:** en arribar a un vídeo no disponible (exemple comunicat: «Gat Rumberu», de La Pegatina), la ràdio quedava aturada.

**Causa:** el reproductor escoltava onStateChange i onAutoplayBlocked però no onError.

**Solució:** subscripció a onError i validació de l’origen exacte i de l’iframe principal. Els errors 100, 101 i 150 marquen la cançó «No disponible» en memòria durant la sessió. La ràdio conserva una secció amb les cançons saltades i avança al cap de 800 ms. No es modifica el catàleg global: la disponibilitat pot dependre de l’usuari o del territori. Els errors transitoris/configuració i el bloqueig d’autoplay no marquen cançons. Es cancel·len els reintents pendents i el reproductor fallit no es reutilitza; els avisos duplicats i els ended d’un iframe antic no salten més cançons. Una navegació manual cancel·la l’avanç pendent. Al final de la cua es conserva l’avís sense regenerar ni tornar al principi. Es manté la política existent de preparar en pausa si la pestanya és oculta.

**Verificació:** 135 proves de ràdio, missatgeria, reproducció manual, controls i recàrrega superades; 12 cobreixen aquesta incidència amb YouTube simulat. No s’ha verificat la reproducció real de «Gat Rumberu». ESLint sense errors als fitxers modificats; el lint global manté cinc errors previs a data.js i home-sections.js.


## [2026-10-11] - Nom i caràtula en compartir artistes i cançons de Música

GitHub Pages no executa `functions/_middleware.js` i els robots socials no executen el JavaScript del client. Les URL amb `?v=` o `?channel=` rebien les meta genèriques. `buildEntityShareUrl()` genera ara `/musica/compartir/canco/ID.html` i `/musica/compartir/artista/ID.html`. El generador `scripts/generar_pagines_compartir.js` crea HTML amb Open Graph i Twitter, nom i imatge reals del feed i de l'arxiu, escapament de text i filtre de vídeos ocults/canals retirats. El navegador redirigeix a l'enllaç original de l'app; sense JavaScript hi ha un enllaç explícit. No hi ha meta refresh ni redirecció HTTP que facin perdre la previsualització.

El workflow `publicar-comparticio-musica.yml` regenera les pàgines, les desa a main i publica l'artefacte a Pages. També escolta la finalització dels generadors de dades: els commits de GITHUB_TOKEN no disparen un altre push workflow. Les pàgines es mantenen al repositori perquè els desplegaments estàtics habituals també les incloguin. No editar-les manualment. Els enllaços antics amb query continuen obrint el contingut, però només els nous tenen meta pròpies a GitHub Pages. Les apps poden conservar la previsualització a la seva memòria cau.

Proves: `tests/share-pages.test.js` (artista, cançó, arxiu, ocults, canals retirats, escapament, idempotència) i `tests/share-codecs.test.js`.


## [2026-10-11] - Separació de Punk i Heavy / Metal

La categoria conjunta desapareix dels xips, configuració, descoberta, portada i seccions SEO. Els gèneres interns continuen sent `Punk` i `Metal`; es mostren com `Punk` i `Heavy / Metal`. Ratpenat i Sota Terra queden a Punk; Bestiari conserva tots dos. La decoració del client elimina l'etiqueta conjunta dels feeds i arxius antics i aplica els gèneres actuals de cada artista. El generador de feed ja emet les noves categories.

Migració local: preferències inicials i darrera ràdio expandides als dos estils, vista antiga retornada a Inici, memòria cau i ordre de xips regenerats. Les sessions de ràdio antigues recuperen els dos estils separats. La ruta antiga /punk-metal redirigeix a /punk sense mantenir una tercera categoria. Analítica: codis separats per les noves visites; l'etiqueta anterior només es conserva per identificar dades històriques.

Verificació: taxonomia separada, decoració de vídeos d'arxiu, grup amb tots dos estils, migració idempotent i rutes SEO.


## [2026-10-11] - Origen a la fitxa: HTML nou amb JS antic

En verificar la primera publicació, la fitxa contenia `apOrigin` però quedava buit: el navegador conservava la URL anterior d'`artist-page.js`. Com en els casos de memòria cau descrits més amunt, s'han versionat les URLs del JS modificat i de `portada.css` a `20261011-origen-1`, a més de regenerar el service worker. Les dades viuen a `data/origens-artistes.json`; només es mostren assignacions validades i les respostes antigues no poden pintar un altre artista. Proves: `tests/artist-origin.test.js`.





## 2026-10-12 — Exclusions d’idioma incompletes als discos

Les regles per títol es materialitzaven només sobre el feed. Una obra exclosa podia tenir altres IDs al catàleg Topic o l’historial que no constaven a hidden-videos.json. En revisar Dusminguet, La Troba Kung-Fú i Gertrudis s’han encreuat les tres fonts i afegit 61 IDs al registre central, que aplica el client. No s’han editat dades generades. Les noves regles inclouen variants d’apòstrof/accent i l’àlies Topic de Gertrudis. Els remescles sense prova de veu i els títols sense lletra es deixen sense nova exclusió; aquesta actuació no certifica tot el repertori restant. Vegeu docs/revisions/2026-10-12-dusminguet-troba-gertrudis.json.



## 2026-10-12 — Cua d’idioma limitada als artistes vigilats

La cua creixia perquè tots els vídeos nous hi entraven i les marques ortogràfiques del títol produïen descartaments. La política central és ara `data/artistes-vigilats-idioma.json`, documentada a `docs/ARTISTES_VIGILATS_IDIOMA.md`. Agrupa IDs oficials/Topic i àlies; la resta del catàleg classificat passa per confiança editorial, registrada separadament de les revisions individuals. Un artista desconegut genera una alta pendent, no una revisió per cançó. Els descartaments antics passen a dubtes o confiança, mai a noves exclusions només pel títol. Els IDs ocults i les decisions prèvies es conserven.

`applyReview()` només resol els IDs explícits: abans aprovava tots els dubtes restants i amagava tots els descartaments ortogràfics. La memòria permet decisions per ID, obres explícitament reutilitzables amb font i discos amb pistes verificades; no hereta decisions a remescles/directes/col·laboracions per un títol net semblant. La confiança es pot revocar movent un artista a vigilància, sense esborrar decisions individuals. Les cues fora del feed actiu es preserven perquè una lectura parcial del catàleg no les resol.

Proves de migració, idempotència, homònims, Topic, exclusions i revisions parcials a `tests/revisio-idiomes.test.js`. Cap consulta a YouTube ni edició manual del feed.

## 2026-10-12 — «Música d'arreu»: un mapa que creix sol amb els grups nous

- **Demanda:** mapa dels Països Catalans amb la ubicació dels artistes, que s'hi vagin sumant grups a mesura que arriben dades.
- **Solució:** el mapa de base (`data/mapa-base.json`, generat un sol cop per `scripts/generar_mapa_base.js`) només porta els contorns i la **projecció**; els punts els calcula el client (`artist-map.js`, `buildModel()`) cada vegada amb `origens-artistes.json` + `YouTubeAPI.getArtistGroups()`. Validar un artista nou o afegir-ne el canal fa que surti sense tocar el mapa.
- **Trampes:**
  - Douglas-Peucker amb anells tancats: el primer i l'últim punt són iguals (longitud 0) i el camí sortia buit; amb longitud 0 cal fer servir la distància al punt.
  - Les comarques/illes (`territory:*`) no tenen coordenades: van a la capital de `proximitat-musical.json` → `references`, marcades com a aproximades.
  - Amb zoom (viewBox) els cercles es farien enormes: `transform: scale(calc(1 / var(--am-zoom)))` amb `transform-box: fill-box`; les vores amb `vector-effect: non-scaling-stroke`.
  - `show()` es crida a cada `renderVideos()`: només repinta si canvien els artistes (nombre de grups o canals amagats), si no es perdria el zoom i el lloc triat.
  - Un arrossegament per moure el mapa no ha de triar el punt on s'acaba: s'empassa el `click` següent.
  - Barcelona té un centenar d'artistes: al mòbil la llista del panell té scroll propi (`max-height: 55vh`).

## 2026-10-12 — Mapa d'artistes: dos dits, pantalla completa i dibuixar una zona

- **Un dit o dos?** A la pàgina, un dit ha de continuar fent scroll. `touch-action: pan-y` a l'SVG i un `touchmove` **no passiu** que fa `preventDefault()` quan hi ha dos dits: si els dos dits toquen abans de moure's, el navegador no comença l'scroll i el mapa es mou i s'apropa. A pantalla completa i en mode dibuix, `touch-action: none`.
- **`position: fixed` dins d'un pare transformat** queda relatiu al pare (sortia amb 6.000 px d'alçada i desplaçat). A pantalla completa el contenidor es mou a `<body>` i un comentari en guarda el lloc per tornar-lo.
- **El «click» després d'un gest:** després d'arrossegar, pessigar o dibuixar s'empassa el clic **només si cau dins l'SVG**; si no, també s'empassava el toc al botó de pantalla completa fet just després.
- **Pantalla completa amb «meet»:** l'SVG ocupa tota l'àrea i el viewBox hi cap amb franges; per passar de la pantalla a l'SVG cal tenir en compte l'escala i la franja (`fit()` / `clientToSvg()`), no el rectangle sencer.
- **Autoplay:** la ràdio d'una zona s'engega en acabar el traç. Les cançons es carreguen en entrar al mode dibuix perquè no hi hagi cap `await` entre el gest i la reproducció.
- A l'entorn de prova (YouTube bloquejat), engegar **qualsevol** ràdio al mòbil dona «Failed to read the 'localStorage' property… Access is denied»: és de l'iframe buit, no del mapa (`verificar-mapa.js` el filtra).

## 2026-10-12 — Descobreix: «Per afinitat» en lloc de la cançó destacada

- **«Recomanat per a tu» a Descobreix:** és el títol que posen `loadVideosFromAPILegacyImpl()` / `loadVideosLegacyImpl()` mentre carreguen, i es podia quedar. `setPageTitle()` el canvia per «Descobreix» quan la vista és Descobreix.
- **Treure la cançó destacada sense perdre-la:** amagar només `#heroSection` hauria tret la cançó de la llista (els renders filtren `featured`). `getFeaturedVideoForSection()` torna `null` a Descobreix i la cançó es queda a la graella.
- **Època d'un artista:** l'any de pujada a YouTube enganya (Lax'n'Busto sortia «Dels 10»). Es fa servir l'any original quan el feed el sap; amb només pujades anteriors al 2013 l'any serveix per comparar però no es mostra cap etiqueta d'època.
- **Prova al navegador:** `getHistoryItems()` té memòria cau (`_historyItemsCache`): després d'escriure `catube_history` cal posar-la a `null`.

## 2026-10-13 — Tornar al mapa després d'obrir un artista o una ràdio

- **Problema:** des del mapa de Descobreix, en obrir un artista i fer-ne una ràdio, «enrere» no tornava al mapa: el botó de la fitxa (`#channelBackBtn`) porta sempre a «Artistes i grups» (`showFollow()`), i la fitxa no deixa cap entrada a l'historial, de manera que l'enrere del sistema des de la fitxa sortia de Descobreix.
- **Solució:** `artist-map.js` (`rememberReturn({ push: true })`) desa on era el mapa (`SegueixApp.state.mapReturn`, desplaçament respecte al contenidor) i afegeix una entrada `{ category: 'Descobreix', mapReturn: true }`. El popstate de categoria ja torna a Descobreix; `syncArtistMap()` crida `restoreReturn()`, que fa scroll al mapa (torna a provar uns quants cops perquè la pàgina encara s'està pintant). `#channelBackBtn` fa `history.back()` quan l'entrada és del mapa. Si es va a una altra vista, `mapReturn` s'oblida (i caduca als 30 min).
- **Verificació:** `node tests/browser/verificar-mapa.js` («enrere des de la fitxa torna al mapa»).


## 2026-10-13 — Knockouts no entrava a cap ràdio Ska i altres artistes sense gènere

**Causa comprovada:** les 10 cançons i el canal de Knockouts tenien `categories: []`;
la fitxa conservava «Ska / Reggae» només a les notes. `getCandidates` les descartava
abans del càlcul d'afinitats. L'enriquidor substituïa els gèneres per una llista buida
quan no trobava etiquetes externes i no existia el marcador `genre:manual`.

**Correcció:** restauració documental de 60 artistes, preservació de gèneres previs
quan no hi ha dades noves, perfils de cobertura per a tots els artistes musicals
publicats i vincles de membres compartits Knockouts–Dr. Calypso/Skatalà/Frontpilsen.
El catàleg generat distingeix perfils detallats i bàsics; no interpreta absència de
recerca com a incompatibilitat. Club Social Carme conserva el tractament de programa.

**Verificació:** cobertura de cada canal, elegibilitat de les cançons de Knockouts,
restriccions de canals compartits, relacions simètriques, protecció de gèneres,
comparació amb la base de proves/lint i simulacions de totes les categories.



## 2026-10-13 — Igualtat entre artistes amb una única subcategoria

Les múltiples facets i el sorteig sobre pistes podien afavorir artistes amb més metadades o més repertori.
El catàleg d’afinitats ara té una categoria principal i una sola subcategoria per artista. El motor tria
primer l’artista i després la cançó, conserva tots els artistes al conjunt de treball i només retalla
pistes dins de cada grup (amb reintent complet si no pot omplir). Un mínim de cinc artistes elegibles
activa el nucli; els més petits incorporen subcategories veïnes. Els vincles de músics i municipis només
reforcen compatibilitats sonores. Les fonts i les classificacions pendents continuen visibles a l’informe.
No es canvia el feed, el repertori, la vigilància d’idiomes ni la quota de YouTube. Vegeu
`docs/MUSICA_SELECCIO.md` i `tests/music-subcategories.test.js`.


## [2026-10-14] — Ràdio d’estil des de la fitxa d’artista

El botó passa les cançons de la fitxa a `startStyleRadio` com a `seedVideos`. El motor tria la primera només entre aquestes; la resta continua amb els estils de l’artista. La ràdio es diu «Ràdio <cançó inicial>», amb el títol net, i conserva el nom en barrejar, desar, compartir i restaurar la sessió. Les ràdios obertes des d’un estil continuen portant el nom de l’estil. Sense cançons pròpies no s’engega una altra artista per substitució. Proves: `tests/music-queue-selection.test.js`.


## 2026-10-14 — Discos com a entrada del perfil i agrupació progressiva

La fitxa repetia totes les caràtules de les pistes sota els discos i amagava els llançaments verificats sense pistes carregades. Ara entra a la vista Discos; tocar-ne un mostra les cançons disponibles, «Totes les cançons» recupera el repertori i la cerca funciona també des de la vista inicial. Els llançaments verificats buits es mostren desactivats amb «Pistes pendents d’incorporar».

El motor compartit amb el torn del feed aprofita declaracions explícites de disc als canals oficials i metadades Topic. Conserva `pendingAlbums` entre torns fins a tenir dues cançons diferents; relaciona videoclips només per artista i títol inequívocs, conservant els marcadors de versions. No s’infereixen discos per imatges ni s’accepten llistes genèriques. Es respecten ocults i fonts editorials prioritàries. No es modifica el calendari ni es fan crides API addicionals.

Reconstrucció local: `node scripts/reconstruir_discos_musica.js --evidence=docs/revisions/2026-10-14-discos-evidencies.json`. El fitxer d’evidències conserva només fragments de metadades de vídeos ja existents; no valida idiomes ni afegeix pistes. El generador ordinari reutilitza directament les descripcions que ja rep. Detalls a `docs/DISCOS_AUTOMATICS.md`.

Proves: 35 comprovacions de catàleg, fitxa i llançaments; sintaxi i lint dels JS modificats sense errors. A la còpia local, la suite disponible passa 197 proves i falla en el cas preexistent «UNOFFICIAL RMX»; el lint general manté cinc errors previs. Tots dos s’han reproduït sobre la base. Les URLs dels assets modificats s’han versionat per evitar reutilitzar la interfície antiga.



## 2026-10-16 — Primera fase de web estàtica: dades locals i còpies JSON

Petició de retirar analítiques i sincronització amb Drive. S’han eliminat OAuth, el model i els temporitzadors de Drive, el client/panell/PDF d’analítica i la còpia de l’API del repositori. `config-backup.js` ofereix només descarregar i importar JSON, amb el model musical explícit de `music-data.js`, validació de producte/versió/estructura, límit de 8 MB i confirmació abans de substituir dades.

Es conserva la recuperació davant falta d’espai i l’aprenentatge local de les ràdios. La vista importada invalida també la memòria d’historial, refresca cors i biblioteca i conserva la cua i el reproductor. Els consentiments i les dades alienes no entren a la còpia. S’han actualitzat les URLs dels scripts, el precache i els textos de privacitat; les instruccions antigues de Drive queden marcades com a històriques.

64 proves dirigides superades. Lint: mateixos cinc errors previs de data.js/home-sections.js, comprovats contra la base. La suite completa no s’ha executat; dues comprovacions antigues de versió SW/ordre de scripts fallen igualment a la base. Aquesta fase no retira encara tot `functions` ni publica a Cloudflare. Fases i criteris a `docs/CONVERSIO_ESTATICA.md`.
