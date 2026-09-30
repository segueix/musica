# Selecció musical: ràdio, feed, portada i aprenentatge

Segueix Música tria les cançons de la ràdio, del feed personalitzat i de la portada amb **un sol motor** i **un sol observador d'escolta**. Aquest document explica què fan, amb quins paràmetres i què **no** es pot afirmar.

> Els resultats numèrics d'aquest document i de `docs/MUSICA_SELECCIO_SIMULACIO.md` són de **simulació** (usuaris sintètics sobre el catàleg real). No són dades de producció i no mesuren retenció ni satisfacció.

## Fitxers

| Fitxer | Paper |
|---|---|
| `js/features/music-selection.js` | Motor: antiguitat real, puntuació, restriccions conjuntes, ràdio, feed, «Torna-hi». Funcions pures amb `now` i `rng` injectables |
| `js/features/music-signals.js` | Observador únic del reproductor, estadístiques compactes, preferències explícites, fusió amb la còpia de configuració |
| `js/features/music-queue.js` | Ràdio real: `buildQueue`, «La teva ràdio», regeneració, recàlcul segur, controls de preferència |
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

Familiaritat (segon eix, compatible amb l'antiguitat): «A casa» 75/20/5, «Una mica de tot» 60/30/10, «Sorprèn-me» 25/45/30 (coneguda/descoberta afí/sorpresa). Sense almenys 3 artistes coneguts, la ràdio és variada i ho diu.

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
- **Cor sobre el reproductor**: botó rodó a dalt a la dreta del reproductor gran (`.player-heart`, `likes.js`). Fa el mateix que el cor de sota (`#likeToggle`): desa el m'agrada, compta per a l'algorisme i deixa el de sota en vermell; tots dos es mantenen sincronitzats. No es mostra a la finestreta flotant.

Un cor, un «+», un «−» o un seguiment compta ja per a les decisions següents: es recalcula **només** la part automàtica pendent després d'un punt segur (600 ms, sense arrossegament en curs), conservant la cançó actual, la següent ja anunciada i els afegits/reordenacions manuals.

## Catàleg i dades

`update_music_feed.js` manté el feed anterior com a base: el repertori que ja no cap a les últimes 50 pujades es conserva i **es torna a verificar** (`videos.list`, ~1 unitat per 50); només un vídeo que l'API confirma com a privat o eliminat se'n va, i una fallada transitòria (canal no resolt, lot fallit) no esborra res. Per als canals de la llista d'antics es consulten pàgines més profundes amb pressupost (`MUSIC_DEEP_PAGE_BUDGET`, 24 per execució, fins a 5 pàgines per canal, estat a `data/music-catalog-state.json`) i només se'n conserven les 25 cançons més populars per canal. Cap recomanació fa peticions a YouTube. Cadena: validar base → generar feed (amb any original) → reconstruir índex → un sol commit → versió del SW.

## Tornar a Segueix Música

La portada ofereix «La teva ràdio» i, si en hi ha una de recent (14 dies), «Continua la ràdio: <cançó>» (`catube_last_radio`: només la cançó inicial i la categoria; la cua es torna a generar amb el que ja saps). Cap dels dos botons sona sols en carregar: cal un toc. «Torna-hi» porta preferides i repeticions reals amb explicació; «Acabades de sortir» només amb estrenes reals; «Fora del teu radar» només amb artistes de música recent o mitjana; el que has rebutjat no surt a la portada.

## Rendiment

El context (antiguitat, popularitat, claus) es calcula una vegada per feed i es reutilitza (es descarta si canvia el feed, el dia o la configuració); els senyals es reconstrueixen només si canvia l'historial, els cors, els seguiments, les preferències o l'escolta. Les claus de gravació es calculen només per a les candidates. Mesurat en un Chromium amb la **CPU frenada 4×** (aproximació d'un mòbil de gamma mitjana, no un dispositiu real) amb 5.337 vídeos: context ≈ 130 ms (una vegada), cua de 40 ≈ 280–320 ms. En Node: context ≈ 50 ms, cua ≈ 25 ms.

## Configuració i marxa enrere

`CONFIG.musicSelection` (opcional a `js/config.js`) o `SegueixApp.features.musicSelection.setConfigOverrides({...})` canvien qualsevol llindar (`DEFAULTS` a `music-selection.js`). `localStorage.catube_selection_engine = 'legacy'` (o `engine: 'legacy'`) torna a la política anterior: l'historial exclou candidates, ordre de Música TV, `limitClassicFrequency` + `spreadVideosByArtist` i el smart feed.

## Verificació

- `npm test`: `tests/music-selection.test.js` (motor, 42 casos incloent simulació sobre el catàleg real), `tests/music-signals.test.js`, `tests/music-queue-selection.test.js`, `tests/cataleg-musical.test.js`, `tests/any-original.test.js`.
- `node scripts/simular_seleccio_musical.js --write` → `docs/MUSICA_SELECCIO_SIMULACIO.md`.
- Opt-in: `node tests/browser/verificar-seleccio.js` (ràdio real, observador amb missatges del reproductor, controls, cor a «Torna-hi», fusió), `verificar-portada.js`, `verificar-reproductor.js`, `verificar-sw.js`.

## Limitacions i pendent de mesurar

- Cap d'aquestes xifres és de producció. Caldria mesurar escoltes qualificades, salts repetits, cors, varietat i retorns; no s'ha mesurat retenció i no es pot afirmar que millori.
- `Released on`/℗ només existeix a les pistes Topic; als vídeos d'un canal oficial es fa servir la data de pujada.
- Sense snapshots de visualitzacions no hi ha «tendència recent»: la popularitat és acumulada i normalitzada.
- Música TV (`segueixTV.rank`) i les files de la portada per canal no fan servir la identitat d'artista.
- Els percentatges 65/25/10, els pesos i els descansos són punts de partida per validar.
