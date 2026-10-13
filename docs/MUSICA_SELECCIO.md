# Selecció musical: ràdio, feed, portada i aprenentatge

Segueix Música tria les cançons de la ràdio, del feed personalitzat i de la portada amb **un sol motor** i **un sol observador d'escolta**. Aquest document explica què fan, amb quins paràmetres i què **no** es pot afirmar.

> Els resultats numèrics d'aquest document i de `docs/MUSICA_SELECCIO_SIMULACIO.md` són de **simulació** (usuaris sintètics sobre el catàleg real). No són dades de producció i no mesuren retenció ni satisfacció.

## Fitxers

| Fitxer | Paper |
|---|---|
| `js/features/music-selection.js` | Motor: antiguitat real, puntuació, restriccions conjuntes, ràdio, feed, «Torna-hi». Funcions pures amb `now` i `rng` injectables |
| `js/features/music-signals.js` | Observador únic del reproductor, estadístiques compactes, preferències explícites, fusió amb la còpia de configuració |
| `js/features/music-queue.js` | Ràdio real: `buildQueue`, «La teva ràdio», regeneració, recàlcul segur, controls de preferència, ràdio d'una cerca (`startFromSearch`), desar la ràdio com a llista (`saveAsPlaylist`) |
| `js/features/search-results.js` | Cerca: model pur (artistes primer, després cançons) i HTML del menú i de la pàgina de resultats |
| `js/utils/helpers.js` | `arrangeMusicList()` (passada final de límits per a llistes), `isHistoricVideo()`, `getVideoArtistKey()` amb identitat d'artista |
| `js/music-categories.js` | `artistKeyForChannel()` (identitat persistent) i `isClassicArtistVideo()` |
| `js/features/portada.js` / `discovery.js` | «Torna-hi» amb preferides, «Acabades de sortir» només amb estrenes reals, explicacions |
| `scripts/lib/any_original_musical.js`, `scripts/estampar_any_original.js`, `data/musica-dates.json` | Any original amb evidència i excepcions verificades |
| `scripts/lib/cataleg_musical.js`, `scripts/update_music_feed.js`, `data/music-catalog-state.json` | Catàleg incremental i pàgines profundes amb pressupost |
| `scripts/simular_seleccio_musical.js` | Simulació reproduïble sobre `data/feed.json` |

Superfícies connectades: ràdio (`launch`/`regenerate`/`startDiscovery`), «Recomanat per a tu» (`rankRecommendedWithEngine` a `app.js`), llistes finals del feed i files d'estil (`arrangeMusicList`), «Torna-hi», «Acabades de sortir» i destacat de la portada. Música TV manté el seu propi ordre (`segueixTV.rank`); només comparteix l'observador d'aprenentatge.

## Antiguitat real de la música

`eraOf(video)` distingeix la **data de pujada** de la **data original**:

1. `originalYear` del feed (evidència): `Released on: AAAA-MM-DD` de la descripció automàtica de YouTube (confiança alta), `℗ AAAA` (mitjana) o una excepció verificada a `data/musica-dates.json` (alta, mana sobre la resta).
2. Sense any: artista de `data/musica-classica.json` → històrica amb confiança **baixa** (aproximació conservadora).
3. Sense res més: la data de pujada (confiança mitjana).
4. Sense data: mitjana, sense any (`null`). **No s'inventa cap any.**

| Antiguitat | Regla | Objectiu orientatiu |
|---|---|---|
| Recent | ≤ 24 mesos | 65 % |
| Mitjana | de 2 a 8 anys | 25 % |
| Històrica | > 8 anys o catàleg històric confirmat | 10 % |

Una **estrena** (`isNewRelease`) exigeix pujada dins de 90 dies, cap evidència d'una gravació antiga, no ser reedició i no ser només l'aproximació de la llista d'antics. Una gravació antiga pujada avui no és una estrena; una cançó nova verificada d'un artista veterà sí (via `originalYear` o excepció). El gènere «Clàssica» no és antiguitat.

Amb el catàleg actual: 1.282 de 3.991 cançons tenen any d'evidència i 854 són reedicions; de les 35 pujades dels darrers 30 dies, 16 són estrenes de debò.

## Puntuació

`score = 0,45 gust + 0,20 actualitat + 0,15 popularitat + 0,10 rotació + 0,10 afinitat − penalitzacions`

- **Gust** (0..1): 45 % cançó, 40 % artista, 15 % estil. Cor: +0,7 a la cançó (i 0,15 a l'artista); seguir: 0,6 a l'artista; escoltes qualificades, finalitzades i **repeticions voluntàries** amb saturació logarítmica i decaïment (semivida 120 dies; els cors no decauen). L'historial és informació feble: fa «conegut» l'artista però no la cançó.
- **Actualitat**: 1 → 0,7 en els 24 mesos; 0,6 → 0,25 fins als 8 anys; 0,15 la històrica.
- **Popularitat**: percentil logarítmic dins del seu contingent d'antiguitat i, en part, del canal (per als artistes antics confirmats pesa més el canal: «clàssics populars dins del seu catàleg»). Sense visualitzacions és neutra (0,4), una novetat de < 30 dies no baixa de 0,5. Les visualitzacions acumulades **no** es presenten com a «tendència»: no hi ha snapshots comparables.
- **Rotació**: 1 − e^(−dies/7) si l'has escoltada; 0,8 si no; cau si l'artista ha sonat en 24 h.
- **Afinitat**: estil de la cançó inicial i de la sessió.
- **Penalitzacions**: salts manuals ràpids (≥ 2 de la cançó o ≥ 3 de l'artista, amb decaïment de 7 dies), exposició de les darreres 24 h, «Menys com aquesta» (lleu a l'artista).

Familiaritat (segon eix, compatible amb l'antiguitat): «Els meus de sempre» 75/20/5, «Una mica de tot» 60/30/10, «Sorprèn-me» 25/45/30 (coneguda/descoberta afí/sorpresa). Sense almenys 3 artistes coneguts, la ràdio és variada i ho diu.

## Restriccions sobre el resultat final

La selecció és voraç (una posició cada vegada, sobre un conjunt de treball de ≤ 260 candidates) i les restriccions s'apliquen **a la cua final**, comptant la cançó inicial, les ja sonades i els afegits a mà (`preceding`):

| Nivell | Separació d'artista | Màx. per artista (20 primeres) | Històriques (20 primeres) | Mateixa obra | Descans |
|---|---|---|---|---|---|
| 0 | 3 cançons | 2 | 2, mai seguides | una sola | 12 cançons i 60 min |
| 1 | 2 | 3 | 3 | una sola | 12 i 60 |
| 2 | 1 | 4 | 4 | permesa | 6 i 30 |
| 3 | 1 | sense límit | 5 i seguides | permesa | cap |
| 4 | 0 | sense límit | sense límit | permesa | cap |

Cada posició cau al primer nivell que té candidates; la cua **no s'omple** amb peces inadequades (pot quedar més curta que 40). Les 12 cançons de descans compten dins d'una sessió (3 h); passat això només mana el temps. Les decisions manuals de l'usuari, les llistes i els bucles triats expressament no estan subjectes a aquests límits.

- **Categories amb poca música actual**: es conserva la categoria, s'amplia el cupo d'històriques i es comunica («Aquesta selecció té poca música dels darrers anys…»). Si tot és d'un sol artista, s'accepten cançons seguides i s'avisa.
- **Preferència explícita per música antiga**: només amb senyals forts (seguits, cors i repeticions d'antics amb pes ≥ 6, prior de 10 %, sostre del 60 %); un sol clic no la canvia. Amplia el cupo d'històriques i, per sobre del 35 %, permet antigues seguides.
- **Ràdios de catàleg històric explícit** (`policy: 'historic'`) i les cerques directes no apliquen els percentatges.
- **Antiguitat i artistes antics**: dins del cupo d'històriques tenen un bonus (0,12) i més soroll (×3), perquè totes les peces representatives de la llista d'antics puguin sortir de tant en tant.

## Identitat d'artista i duplicats

- `getVideoArtistKey()` usa `SegueixMusicCategories.artistKeyForChannel()`: clau estable **Wikidata > MusicBrainz > nom normalitzat** de la base d'artistes; el canal oficial i el Topic d'un artista comparteixen clau. (Les files de la portada continuen agrupant per canal.)
- **Duplicats** (`isSameRecording`): mateix artista, mateix títol base (sense «Official video», «Audio»…), mateixos marcadors de versió i durada dins de ±3 % (mínim 4 s). Mai només pel títol. Directes, acústics, remixos i versions es conserven, però comparteixen **obra** i no s'encadenen (fins al nivell 2).

## Senyals d'escolta

Un únic observador (`music-signals.js`) escolta el reproductor per a ràdio, TV i reproducció normal; `tv-learning.js` en rep les sessions acabades (no crea un segon observador).

| Concepte | Regla |
|---|---|
| Progrés efectiu | Només avança amb el reproductor en marxa i salts de ≤ 3,5 s; seek, pausa, xarxa i autoplay bloquejat no compten |
| Escolta qualificada | 30 s, o el 50 % si la peça és més curta |
| Finalització | 85 % de la durada |
| Repetició voluntària | Escolta qualificada d'una cançó ja escoltada, triada per l'usuari (no venia d'un canvi automàtic ni d'un «següent») |
| Bucle / repintat | Una mateixa cançó no suma dues vegades dins de 30 min |
| Salt manual ràpid | «Següent»/«Anterior» o una altra cançó de la cua abans de 20 s o del 25 %; senyal temporal (decau) |
| Sessió | Cada reproducció té identificador i només acredita una vegada cada senyal |

Emmagatzematge (`localStorage`, viatja amb l'exportació/sincronització): `catube_music_signals_v1` (per cançó i artista: `q,f,r,s,l,sl,lq`, mesos de l'artista i les darreres 60 cançons; límits de 1.200 cançons, 400 artistes i 12 mesos) i `catube_music_prefs_v1` (preferències amb data i estat, per poder-les desfer i sincronitzar). En importar una còpia es **fusiona** (màxim per comptador i per data, la preferència més recent guanya): importar dues vegades no suma dues vegades. Els cors, seguiments i historial existents no es toquen; l'historial entra al snapshot com a informació feble (`h`), sense inventar reproduccions ni durades. Les escoltes de YouTube fora de Segueix Música no es poden inferir.

## Preferències explícites i cor

- **«(+) com aquesta (−)»**: dos cercles clicables (44 px) a la cua (botó ⋯; a «Ara sona» sempre visibles) i a «Ara sona» de la portada. Són **excloents** (activar-ne un desactiva l'altre), persistents (`catube_music_prefs_v1`, `moreLike`/`lessLike` amb data i estat), reversibles (tornar-hi a prémer o Desfés) i **compten per a l'algorisme**: «+» suma 0,5 al gust de la cançó (menys que un cor, 0,7), una mica a l'artista i punts d'estil, i la cançó surt a «Torna-hi» com «Has demanat més com aquesta»; «−» la treu de la part pendent i de les cues següents i penalitza lleument l'artista. «No em recomanis aquest artista» ja no és a la cua: es fa des del llistat d'artistes (l'API `blockArtist` continua existint).
- **Cor sobre el reproductor**: botó rodó (56 px; 46 px en mòbil estret) a la línia central del reproductor gran, **tot a la dreta** (`.player-heart`, `likes.js`, `css/portada.css`). Surt i desapareix amb els controls de pausa/anterior/següent (ratolí sobre el reproductor, en pausa i en tocar el vídeo; sense cua, amb el mateix criteri de ~3 s). Fa el mateix que el cor de sota (`#likeToggle`): desa el m'agrada, compta per a l'algorisme i deixa el de sota en vermell; tots dos van sincronitzats. En amplades ≤ 460 px els controls es compacten (botons de 44 px) perquè el cor no tapi el botó de finestra flotant. No es mostra a la finestreta flotant.

Un cor, un «+», un «−» o un seguiment compta ja per a les decisions següents: es recalcula **només** la part automàtica pendent després d'un punt segur (600 ms, sense arrossegament en curs), conservant la cançó actual, la següent ja anunciada i els afegits/reordenacions manuals.

## Catàleg i dades

`update_music_feed.js` manté el feed anterior com a base: el repertori que ja no cap a les últimes 50 pujades es conserva i **es torna a verificar** (`videos.list`, ~1 unitat per 50); només un vídeo que l'API confirma com a privat o eliminat se'n va, i una fallada transitòria (canal no resolt, lot fallit) no esborra res. Per als canals de la llista d'antics es consulten pàgines més profundes amb pressupost (`MUSIC_DEEP_PAGE_BUDGET`, 24 per execució, fins a 5 pàgines per canal, estat a `data/music-catalog-state.json`) i només se'n conserven les 25 cançons més populars per canal. Cap recomanació fa peticions a YouTube. Cadena: validar base → generar feed (amb any original) → reconstruir índex → un sol commit → versió del SW.

## Ràdios d'estil: categoria, nom fix i «+»

- **Sempre l'estil**: una ràdio engegada des d'una categoria (fila o pàgina d'estil) és d'aquella categoria; engegada des d'una cançó o un artista (Inici, fitxa d'artista, cerca…) és de la **categoria principal de l'artista**, és a dir, la del **primer gènere** de la base d'artistes (`SegueixMusicCategories.primaryCategoryForChannel()`; l'ordre de `categories` és el de la taxonomia, no el de prioritat de l'artista). Barrejar, regenerar i els recàlculs silenciosos conserven l'estil. Una selecció («Acabades de sortir»…) que es regenera passa a ser una ràdio de l'estil de la cançó que sona. Només «La teva ràdio» (general, personalitzada) no té categoria. Si l'estil té menys de 2 cançons, la ràdio passa a general i s'avisa.
- **Nom fix**: la capçalera de la cua mostra l'estil (o «Pop + Rock»; «La teva ràdio» a la general) i **no canvia amb la cançó que sona** (abans deia «Basada en <artista>»). El mode de descoberta surt com a text petit al costat.
- **«+»**: al costat del nom hi ha un cercle «+» (44 px) que obre un selector amb els estils que encara no hi són. En escollir-ne un, la part pendent de la ràdio es **regenera barrejant tots els estils a parts iguals** (`selectRadio({ mix })`: repartiment per estil amb `gain.style`, comptant el que ja hi ha a la cua; conserva la cançó que sona i els afegits a mà). Es poden sumar més estils; cada estil sumat té una × per treure'l (sempre en queda un). Sumar un estil a la ràdio general la converteix en una ràdio d'aquell estil. El nom de la llista de YouTube porta tots els estils («Llista Pop + Rock»).

## Desar la ràdio com a llista

A la capçalera de la ràdio, al costat del nom (abans hi havia el text del mode de descoberta, p. ex. «· Sorprèn-me»), hi ha un **símbol de llista amb un «+»** (cercle de 44 px, `data-mq-save-list`). `musicQueue.saveAsPlaylist()` desa **tota la ràdio** (el que ja ha sonat, el que sona i el que ve; sense Shorts ni repetits) com a llista de reproducció a `catube_playlists` amb el mateix format que «Afegeix a una llista» (`library.getPlaylistVideoData`) i dispara `segueix:playlists-changed`: surt de seguida a «Les teves llistes» de la portada i a la biblioteca.

- **Nom**: el de la ràdio, mai el de la cançó que sona: «Ràdio Pop», «Ràdio Pop + Rock», «La teva ràdio», «Cerca: nit» o el nom de la selecció («Acabades de sortir»). Si ja hi ha una llista amb aquest nom (d'una altra ràdio o de l'usuari) s'hi afegeix un número: «Ràdio Pop (2)». Mai es trepitja una llista existent.
- **Desada**: el símbol passa a una llista amb una marca (llima) i l'etiqueta diu que ja és desada. Tornar-hi a prémer **actualitza aquella mateixa llista** amb la cua actual (no en crea una altra); si l'usuari l'ha esborrada, en crea una de nova. Començar una altra ràdio (o una cerca, o una selecció) torna a «no desada».
- Un avís confirma «Llista «…» desada a les teves llistes.» amb l'acció «Obre» (porta a la biblioteca). Una llista de l'usuari que sona en mode llista no mostra el símbol (ja és una llista).
- El mode de descoberta segueix aplicant-se (selector de la portada i, des del 2026-10-01, també el de cada ràdio: vegeu «Mode de descoberta dins de cada ràdio»); només ha deixat de mostrar-se el seu nom enganxat al nom de la ràdio. Si no hi havia historial suficient, la nota explicativa continua sortint sota la capçalera.

## Mode de descoberta dins de cada ràdio

Cada ràdio generada (general, d'estil o de cerca) porta a la capçalera el selector **«Els meus de sempre» / «Una mica de tot» / «Sorprèn-me» / «Fora del meu radar»** (abans, el primer es deia «A casa»). Una selecció («Acabades de sortir») o una llista de l'usuari no en tenen: es reprodueixen tal com són.

- **Efecte immediat.** `musicQueue.setDiscoveryMode(mode)` desa el mode (`catube_discovery_mode`; la portada s'hi sincronitza) i torna a triar **només la part pendent** de la cua amb el mode nou: la cançó que sona i el que l'usuari hi ha afegit a mà es conserven. En una ràdio de cerca es reordenen les mateixes cançons trobades.
- **Es veu.** Les cançons pendents entren escalonades de dalt a baix (`.mq-list.is-renewed`, desactivat amb «moviment reduït») i una línia sota el selector diu «Ràdio adaptada a «Sorprèn-me»: 28 cançons noves a la llista.» durant uns 7 s. Si l'historial no arriba a 3 artistes coneguts, diu que el mode s'ha desat però la ràdio es manté variada.
- **El selector diu la veritat.** Marca el mode amb què s'ha generat la llista que es veu (`radioMeta.requested`), no el de la portada, que (com abans) s'aplica a la ràdio següent; prémer el mode ja aplicat no fa res.
- **L'efecte és suau.** El mode és un objectiu de repartiment coneguda/afí/sorpresa que corregeix la puntuació (`gain.familiarity` 0,5), i el gust de l'usuari pesa més. En una prova al navegador amb 30 artistes escoltats, «Els meus de sempre» va donar ~74 % d'artistes coneguts i «Sorprèn-me» ~58 % (objectius 75 % i 25 %); a la llista canvien unes 28–31 de 39 cançons, en part per la tria aleatòria. Cap d'aquestes xifres és de producció.

## «Fora del meu radar»: descoberta pura (2026-10-04)

Quart mode del selector (`discovery.MODES`, id `new`; també a la portada, `#ptRadio`). Serveix perquè la persona **descobreixi grups que potser ni sap que existeixen**, no per afinar el gust: a diferència de «Sorprèn-me» (25/45/30, sempre amb una part de coneguts), aquí hi ha un **filtre dur** a `selectRadio()` (`discoveryPool()` de `music-selection.js`).

- **Què és «nou».** `isNewArtist()`: l'artista no és seguit, no té cor, no s'ha escoltat de debò, no surt a l'historial feble (`h`) i **no té cap rastre** a `signals.artists` (un artista que l'usuari només ha saltat també queda fora: ja el va veure i no el va voler). Les cançons escoltades o amb cor d'un artista nou tampoc hi entren.
- **Prioritats del conjunt de treball (per nivells).** (1) Un sol tema per cada artista nou: com més grups diferents, millor. (2) La resta de cançons d'artistes nous (−0,25 de puntuació) només si no arriben a 12 artistes o a omplir la cua. (3) Només si encara no n'hi ha prou, artistes **poc coneguts** (ni seguits, ni amb cor, ni cap cançó escoltada; −0,5): la nota diu «Ja coneixes gairebé tots els artistes d'aquesta selecció…» (`meta.discover.relaxed`).
- **Menys èxits.** Es resta la meitat del pes de la popularitat (`cfg.discovery.popularityDamping` 0,5) perquè surtin també grups petits; l'antiguitat, el descans, l'estil i el repartiment per artista continuen manant. Entre els nous, els d'estils afins surten una mica més (`familiarity.new` 0 / 0,5 / 0,5).
- **On s'aplica.** Ràdio general («La teva ràdio», també la primera cançó: `recentSeedPool()`) i ràdios d'estil / de categoria (`policy: 'general'`). **No** en una ràdio de cerca ni en la d'un artista (el conjunt el tria l'usuari): allà s'aplica com «Sorprèn-me». El feed «Recomanat per a tu» (`rankFeed`) tampoc exclou res: tracta `new` com «Sorprèn-me». Amb poc historial (< 3 artistes coneguts) el mode també funciona (tot és nou) i no diu «falta historial».
- **Es veu.** L'avís sota el selector i la nota de la portada diuen «Ràdio de descoberta: N artistes que encara no has escoltat.» (`meta.discover.artists`).
- **Preferència global.** Com els altres modes es desa a `catube_discovery_mode`: mentre estigui triat, **cada ràdio general o d'estil** és de descoberta (també la que comença en tocar una cançó). El selector de cada ràdio permet tornar-hi a un altre mode.
- **Motor antic (`legacy`).** `PATTERNS.new = ['F']`: els nous primer i els coneguts només al final.
- Proves: `tests/music-selection.test.js` («mode «Fora del meu radar»»), `tests/music-queue-selection.test.js`, `tests/discovery.test.js`; opt-in `node tests/browser/verificar-mode-radio.js` (quatre opcions, 2×2 a la capçalera de la ràdio i a mòbil).

## Ràdio d'una cerca

La cerca (`js/features/search-results.js`) posa **primer els possibles artistes i després les cançons**, i a dalt de tot ofereix «Genera una ràdio amb aquests resultats» (fila del menú i botó de la pàgina de resultats). La ràdio es genera amb `musicQueue.startFromSearch(songs, { query })`:

- **El conjunt són els resultats** (fins a 60 cançons; les dels artistes trobats hi són perquè una cançó també coincideix pel nom de l'artista). No es filtra per categoria: **els estils es barregen** tal com surten. Queden fora els artistes amagats, els Shorts, el contingut estàtic i el que l'usuari ha rebutjat («− com aquesta», artista bloquejat).
- **Ordre**: la primera cançó és la millor coincidència; la resta les ordena el motor amb `policy: 'search'` (gust de l'usuari, artistes no seguits i sense repetir artista seguit si es pot; **sense** mescla d'antiguitat 65/25/10 ni límit de música antiga, perquè els resultats són el que l'usuari ha demanat). Totes les cançons trobades hi entren, encara que el motor en deixi alguna fora. Amb `engine: 'legacy'` s'ordenen per rellevància repartint artistes.
- **Nom i controls**: la capçalera diu «Cerca: <consulta> · estils barrejats»; no té «+» d'estils. «Barreja» (`regenerate`) reordena la part pendent **dins dels mateixos resultats**; si ja han sonat totes, torna a començar-les. Els recàlculs silenciosos (cor, seguiment, ± com aquesta) també es queden dins dels resultats. Obrir una cançó amb un clic normal torna a una ràdio d'estil.
- **Coincidències**: sense accents, ela geminada ni apòstrofs; títol, artista (i àlies de la base d'artistes) i crèdits de la descripció «Provided to YouTube», mai la resta de la descripció; les paraules han de ser senceres (l'última pot ser incompleta); canals oficial i «Topic» = un artista; duplicats de la mateixa gravació fora.

## Tornar a Segueix Música

La portada ofereix «La teva ràdio» i, si en hi ha una de recent (14 dies), «Continua la ràdio: <cançó>» (`catube_last_radio`: només la cançó inicial i la categoria; la cua es torna a generar amb el que ja saps). Cap dels dos botons sona sols en carregar: cal un toc. «Torna-hi» porta preferides i repeticions reals amb explicació; «Acabades de sortir» només amb estrenes reals; «Fora del teu radar» només amb artistes de música recent o mitjana; el que has rebutjat no surt a la portada.

## Rendiment

El context (antiguitat, popularitat, claus) es calcula una vegada per feed i es reutilitza (es descarta si canvia el feed, el dia o la configuració); els senyals es reconstrueixen només si canvia l'historial, els cors, els seguiments, les preferències o l'escolta. Les claus de gravació es calculen només per a les candidates. Mesurat en un Chromium amb la **CPU frenada 4×** (aproximació d'un mòbil de gamma mitjana, no un dispositiu real) amb 5.337 vídeos: context ≈ 130 ms (una vegada), cua de 40 ≈ 280–320 ms. En Node: context ≈ 50 ms, cua ≈ 25 ms.

## Configuració i marxa enrere

`CONFIG.musicSelection` (opcional a `js/config.js`) o `SegueixApp.features.musicSelection.setConfigOverrides({...})` canvien qualsevol llindar (`DEFAULTS` a `music-selection.js`). `localStorage.catube_selection_engine = 'legacy'` (o `engine: 'legacy'`) torna a la política anterior: l'historial exclou candidates, ordre de Música TV, `limitClassicFrequency` + `spreadVideosByArtist` i el smart feed.

## Verificació

- `npm test`: `tests/music-selection.test.js` (motor, 43 casos incloent simulació sobre el catàleg real i la política `search`), `tests/music-signals.test.js`, `tests/music-queue-selection.test.js` (inclou la ràdio de cerca), `tests/search-results.test.js`, `tests/cataleg-musical.test.js`, `tests/any-original.test.js`.
- `node scripts/simular_seleccio_musical.js --write` → `docs/MUSICA_SELECCIO_SIMULACIO.md`.
- Opt-in: `node tests/browser/verificar-seleccio.js` (ràdio real, observador amb missatges del reproductor, controls, cor a «Torna-hi», fusió), `verificar-cerca.js` (menú, pàgina i ràdio de cerca, escriptori i mòbil), `verificar-portada.js`, `verificar-reproductor.js`, `verificar-sw.js`.

## Limitacions i pendent de mesurar

- Cap d'aquestes xifres és de producció. Caldria mesurar escoltes qualificades, salts repetits, cors, varietat i retorns; no s'ha mesurat retenció i no es pot afirmar que millori.
- `Released on`/℗ només existeix a les pistes Topic; als vídeos d'un canal oficial es fa servir la data de pujada.
- Sense snapshots de visualitzacions no hi ha «tendència recent»: la popularitat és acumulada i normalitzada.
- Música TV (`segueixTV.rank`) i les files de la portada per canal no fan servir la identitat d'artista.
- Els percentatges 65/25/10, els pesos i els descansos són punts de partida per validar.



## Pilot d'afinitats Ska / Reggae (2026-10-13)

`js/features/music-affinities.js` és la font de perfils editorials: 14 artistes, 22 canals,
facetes documentades, fonts, confiança editorial i data de revisió. Les facetes són presència
documentada, no pesos acústics ni etiquetes certes de totes les gravacions. La confiança és
una decisió editorial conservadora, no una probabilitat estadística.

Només `selectRadio` amb categoria única exacta `Ska / Reggae`, política `general` i sense mescla
aplica l'ajust: 0,12 × [0,8 × (afinitat amb anterior − 0,5) + 0,2 × (afinitat amb inicial − 0,5)].
L'afinitat és Jaccard de facetes, atenuada cap a 0,5 per la confiança mínima dels dos perfils.
L'ajust queda entre −0,06 i +0,06 i actua DINS de la selecció sota restriccions; no reordena després.
Els pesos base 45/20/15/10/10 i els filtres de categoria continuen vigents. No afecta altres estils,
mescles, cerca, ràdio d'artista, llistes ni seleccions manuals. `affinities: false` permet comparar
amb el motor anterior. El pilot no garanteix una transició acústica: falta escolta humana.

La manca de perfil és neutral (0,5). Les versions live/directe/acústic/remix no hereten perfil;
`trackOverrides` reserva excepcions documentades per ID exacte, de moment buit. No s'inventen BPM,
energia, instrumentació o relacions personals. Les afinitats es calculen, sense base de dades externa
ni peticions en reproducció; el script es carrega abans del motor i entra al precache.

Canal pendent: `UC-N1gUYe6UmwHOSQAUPH2-A` mostra Mr.Freak Ska però té identitat canònica The Cabrians.
Es deixa neutral fins a resoldre la identitat. Brams només té rock documentat al perfil; no s'infereix
ska de totes les cançons per pertànyer a la categoria. Guaita'ls i Kayo Malayo tenen fonts secundàries
i confiança menor. L'expansió exigeix fonts i proves per categoria; no s'activen categories noves
automàticament en afegir perfils. El pool previ conserva el seu límit: les afinitats no poden recuperar
candidates descartades abans per la puntuació base.



## Ampliació a Heavy / Metal (2026-10-13)

S'activa el mateix ajust acotat exclusivament a la categoria única `Heavy / Metal`.
23 perfils cobreixen els 35 canals de la categoria. Cada perfil té fonts, data de revisió
i confiança editorial. `profilesFor(category)` separa les cohorts; els perfils Ska i els
seus càlculs es conserven. La llista `enabledCategories` requereix activació explícita.

Facetes: heavy, power, death i death melòdic, black, doom, sludge, grindcore i goregrind,
hardcore/crossover, folk i metal progressiu. Les etiquetes generals «metal» no puntuen
com una similitud compartida per tots. Subgèneres com goregrind inclouen també grindcore
per expressar el parentiu; això és normalització editorial, no anàlisi d'àudio.

Foscor i Forja han evolucionat estilísticament: perfil transversal i confiança reduïda,
pendent de refinament per llançament. Bestiari només incorpora hardcore documentat: no
s'infereix un subgènere concret de la seva descripció oberta. Avalot només heavy documentat
a Enderrock; es descarta el resultat de cerca de Bandcamp amb comentaris aliens i enllaç
no disponible. Pesta Porcina no es confon amb Metzina Porcina. Les fonts YouTube corresponen
a les descripcions oficials conservades a `js/channels-ca.json`. Els perfils no afegeixen
cançons ni alteren el filtre de llengua o l'elegibilitat de les ràdios.

Proves: afinitats entre subestils, separació d'artistes, neutralitat de versions i desconeguts,
no activació en mescles/cerca/llistes i invariància exacta dels perfils i resultats Ska.
Informe de simulacions sobre el feed: `docs/revisions/2026-10-13-afinitats-heavy.json`.
L'afinitat editorial mesurada no equival a qualitat acústica percebuda; queda pendent escolta humana.


## Ampliació a Punk (2026-10-13)

53 artistes i 70 canals revisats: 51 perfils amb subestils documentats i dos pendents
(Coça i Vàlius) amb afinitat neutral. Bestiari comparteix un únic perfil amb Heavy.
S'activa el mateix ajust màxim ±0,06 en ràdios de categoria única `Punk`.
Es distingeixen punk rock, pop punk, Oi!, hardcore, post-hardcore, emo, screamo,
folk punk, garage punk, crust i altres trets acreditats a les fonts de cada perfil.
No afegim una etiqueta genèrica punk a tots els perfils: amagaria les diferències.
`folk` i `traditional` són trets editorials de connexió, no mesures d'àudio.
La confiança de les noves assignacions és 0,8; les etiquetes d'un disc són una
aproximació al repertori, no una revisió acústica de cada cançó.

ASSAC!, Budellam, Mendra i Vàlius tenen canals compartits o homònims: el perfil
només s'aplica als IDs de vídeo ja aprovats al catàleg, separats per canal.
Els vídeos nous d'aquests canals requereixen revisió explícita del perfil.
Directes, acústics, remixos, subestils pendents i artistes desconeguts continuen
neutrals i elegibles. No es modifiquen el catàleg, les categories ni les mescles.

Les proves cobreixen les transicions, els canals compartits, la neutralitat,
la varietat i els modes exclosos. La validació completa compara les errades i
el lint amb la base exacta i comprova cues idèntiques per a Ska i Heavy.
Informe: `docs/revisions/2026-10-13-afinitats-punk.json`.

## Cobertura de tot el catàleg i relacions documentades (2026-10-13)

`music-affinity-catalog.js`, generat abans de carregar el motor, cobreix cada artista
musical indexat. Els 87 perfils detallats prevalen sobre el perfil general; Coça i
Vàlius tenen ara perfil bàsic Punk. La resta es basa en revisió documental (0,7),
gèneres originals del catàleg (0,55) o només categories (0,3). Aquest últim nivell
és cobertura bàsica, no una recerca de subestils ni una anàlisi acústica. El camp
`evidenceLevel` permet auditar aquesta diferència. No s'inventen vincles personals.

Les ràdios de qualsevol categoria única poden usar l'ajust acotat ±0,06. Les
mescles i altres modes mantenen la selecció anterior. Els vídeos desconeguts i
les versions sense revisió pròpia continuen neutrals i elegibles.

`data/music-affinity-review.json` documenta la recuperació de 53 classificacions
perdudes i tres vincles de membres compartits entre Knockouts i Dr. Calypso,
Skatalà i Frontpilsen. Cada vincle afegeix com a màxim 0,08 a la similitud editorial
(màxim 1), sempre després del filtre de categoria. No fa entrar Frontpilsen a Ska.
Les afinitats ajuden a ordenar; tenir perfil no garanteix aparèixer en cada ràdio.

El generador valida cobertura de tots els canals publicats, encara que el camp
`active` d'una fitxa antiga estigui desactualitzat. Club Social Carme és un programa
amb diversos artistes: no es tracta com un grup ni s'inventa un estil comú.
Els canals amb selecció restringida només hereten perfils als vídeos identificats;
si la regla antiga és per títol, es congelen els IDs ja publicats al feed.

`preservar_generes.js` evita esborrar gèneres quan la font externa retorna buit.
Les decisions revisades porten `genre:manual`. El workflow de cobertura regenera
els perfils en canviar la base o les seleccions i falla davant un artista sense
gènere. Les altes fetes per altres workflows amb GITHUB_TOKEN han d'executar també
`node scripts/generar_afinitats_musica.js --repair-catalog` abans de publicar, ja
que els commits del bot no disparen un segon workflow de GitHub Actions.
