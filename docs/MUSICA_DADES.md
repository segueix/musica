# Base de dades de Segueix Música

La font canònica és `data/artistes-musica.json`. No cal mantenir un Excel paral·lel.

## Descoberta automàtica

`scripts/descobrir_artistes_musica.js` consulta Wikidata i combina dos senyals forts:

1. artistes amb català com a llengua nativa que, a més, Wikidata classifica com a músic, cantant o grup musical;
2. artistes vinculats com a intèrprets d'una obra catalogada en català.

El simple fet de parlar català no és suficient per entrar a la base, perquè generava massa falsos positius.

Per reduir falsos positius, el candidat ha de tenir un MusicBrainz Artist ID a Wikidata. Si Wikidata també té un YouTube Channel ID, s'incorpora directament.

L'Action `Descobrir artistes de música` s'executa els dilluns i també es pot executar manualment. No necessita cap clau de YouTube.

## Revisió editorial

Cada artista té `reviewStatus`:

- `pendent`: descobert automàticament, encara no validat;
- `aprovat`: acceptat per al projecte i `active: true`;
- `rebutjat`: exclòs i `active: false`.

L'automatisme conserva aquestes decisions.

La pàgina `admin-musica.html` permet filtrar, aprovar i rebutjar candidats. Els canvis queden temporalment al navegador i es poden exportar com a JSON o CSV. El JSON exportat està preparat per substituir `data/artistes-musica.json`.

## Revisió de noms i categories (`revisio-noms-artistes.html`)

Pàgina senzilla per repassar només els artistes **ben indexats** (amb canal de YouTube assignat i no rebutjats; ara 155): una fila per artista amb el **nom que es veu a l'app** (editable; per defecte el del canal de YouTube: «alfredgarcia», «AUXILI»…), les **categories** (botó «Edita», es poden triar-ne diverses de la taxonomia `data/music-genres.json`) i una columna **OK** per marcar els que ja estan bé. El que es fa es desa al navegador (`segueix_revisio_artistes_v1`) fins que es prem **«Descarrega la revisió»** (JSON; també hi ha CSV). No escriu res al repositori ni demana cap token. Els noms dels canals els llegeix de `js/channels-ca.json`.

Per aplicar el fitxer descarregat:

```bash
node scripts/aplicar_revisio_artistes.js revisio-artistes-AAAA-MM-DD.json --dry-run   # simula i ensenya què canviarà
node scripts/aplicar_revisio_artistes.js revisio-artistes-AAAA-MM-DD.json             # escriu data/artistes-musica.json
node scripts/validar_artistes_musica.js
```

Què fa en aplicar-lo (lògica a `js/revisio-artistes.js`, provada a `tests/revisio-artistes.test.js`): el **nom** es desa a `displayName` de l'artista (si torna a ser el del canal, s'esborra; `name` i `aliases`, els de la base d'artistes, no es toquen); les **categories** substitueixen `genres` i s'afegeix `genre:manual` a `sources` perquè `scripts/enriquir_generes_musica.js` no les trepitgi; l'**OK** es desa com a `revisioEditorial: { ok: true, at }`. No toca YouTube, MusicBrainz, l'enriquiment ni `reviewStatus`/`active`.

**Com es veu el nom a l'app:** `js/music-categories.js` llegeix `displayName` en carregar `data/artistes-musica.json` i el posa a `channelTitle` dels vídeos (`originalChannelTitle` conserva el de YouTube) i a `name` dels canals (`originalName`), a `cleanVideoTitle()` i `decorateChannel()`; `YouTubeAPI.withDisplayName()` ho fa a `feedChannels` i `getAllChannels()`. Així el canvi arriba a targetes, fitxa d'artista, cerca, ràdio, llistes, historial i m'agrades **sense regenerar el feed**, i la cerca continua trobant el nom antic (queda a `artists` del canal). El feed (`data/feed.json`) i els scripts continuen duent el nom de YouTube: les regles de `scripts/ocultar_titols_castella.js` (`channelTitle` exacte) no es veuen afectades.

## Revisió de vídeos ambigus

El classificador de contingut deixa a `data/music-content-review.json` els vídeos que no pot decidir (`contentType: "review"`). Mentre hi són, no surten a categories ni a Novetats. Per resoldre'ls, afegeix-los a `data/music-content-overrides.json` amb el tipus correcte (`song`, `live_song`, `album` o `other`) i una nota; el pipeline (`scripts/update_music_feed.js`) ho reaplica a cada generació. Per veure el resultat sense esperar el workflow:

```bash
node scripts/aplicar_revisio_manual_musical.js
```

## Any original i catàleg incremental

- `update_music_feed.js` estampa `originalYear`, `originalDate`, `originalYearSource` i `originalYearConfidence` als vídeos del feed **només amb evidència**: «Released on» de la descripció automàtica (alta), «℗ AAAA» (mitjana) o una excepció verificada a `data/musica-dates.json` (alta, mana sobre la resta). Sense evidència no hi ha any. Per aplicar-ho al feed actual sense API: `node scripts/estampar_any_original.js`.
- El feed conserva el repertori que ja no cap a les darreres 50 pujades (els més populars de cada canal, fins a 100) i el torna a verificar a cada execució; només se'n va un vídeo confirmat com a privat o eliminat. Per als canals de `musica-classica.json` es consulten pàgines més profundes amb pressupost (`MUSIC_DEEP_PAGE_BUDGET`) i cursors a `data/music-catalog-state.json`.
- Detall i criteris: `docs/MUSICA_SELECCIO.md`.

## Ordres

```bash
npm run music:discover
npm run music:discover:dry
npm run music:validate
```

## Fonts externes

- Wikidata: identificadors i evidència de vinculació amb el català.
- MusicBrainz: identificador canònic de l'artista; l'enriquiment de relacions es pot afegir posteriorment.
- YouTube: encara no es consulta des d'aquest procés; només s'aprofiten IDs de canal ja presents a Wikidata.

## Enriquiment amb MusicBrainz

Després de la descoberta de Wikidata, `scripts/enriquir_artistes_musicbrainz.js` consulta només artistes sense YouTube ID.

- usa `/ws/2/artist/{MBID}?inc=url-rels&fmt=json`;
- manté 1,1 segons entre peticions;
- reintenta 429/503 amb espera progressiva;
- extreu directament IDs de URLs `/channel/UC...`;
- conserva `@handles` i altres URLs oficials a `youtube.candidates`;
- no torna a consultar un artista sense resultat fins passats 90 dies, excepte amb `--force`;
- ignora artistes rebutjats.

No necessita cap clau API de YouTube.

## Resolució amb YouTube Data API

`scripts/resoldre_canals_youtube.js` només treballa amb URLs ja conegudes:

- `@handle` → `channels.list?forHandle=...`;
- `/user/nom` → `channels.list?forUsername=...`.

Cada consulta usa `channels.list`, que costa 1 unitat de quota general. La clau només es llegeix des del secret `YOUTUBE_API_KEY_SERVER` de GitHub Actions i no s'escriu mai al repositori.

Les cerques generals per nom d'artista queden expressament fora d'aquesta fase.

## Cerca general de canals YouTube

Quan Wikidata i MusicBrainz no donen cap canal conegut, `scripts/cercar_canals_youtube.js` utilitza `search.list` només sobre artistes encara sense ID.

Proteccions de quota i qualitat:

- màxim 25 artistes per execució;
- màxim intern de 80 `search.list` per dia del Pacífic, deixant marge respecte del límit per defecte de 100;
- una sola pàgina de 3 canals per artista;
- els detalls dels 3 canals es consulten en un únic `channels.list`;
- cada artista queda marcat i no es torna a cercar abans de 30 dies;
- noms curts o genèrics no s'autoaccepten;
- només s'autoaccepten coincidències molt fortes de nom + handle o canals Topic inequívocs;
- la resta queda a `youtube.searchCandidates` per revisió editorial.

La tasca `Cercar canals YouTube` s'executa cada dia a les 08:17 UTC, després del reinici diari de quota de mitjanit PT.

## Taxonomia de gèneres

Segueix Música conserva dues capes:

- `genresRaw`: etiquetes originals recuperades de Wikidata i MusicBrainz;
- `genres`: categories normalitzades i pensades per navegar pel producte.

La taxonomia oficial és a `data/music-genres.json`. Un artista pot tenir més d'una categoria.

Categories actuals:

- Pop
- Rock
- Indie / Alternativa
- Urbana
- Rap / Hip-hop
- Electrònica
- Folk i arrel
- Cançó d'autor
- Ska / Reggae
- Punk
- Metal
- Rumba / Mestissatge
- Flamenc
- Jazz / Blues
- Funk / Soul / R&B
- Clàssica i contemporània
- Coral / Vocal
- Experimental / Avantguarda
- Infantil
- Altres

`Altres` no s'assigna automàticament: si una etiqueta no es pot normalitzar amb prou claredat, queda a `enrichment.genres.unmappedRaw` per revisió.

L'enriquiment usa Wikidata P136 i MusicBrainz `inc=genres`. MusicBrainz es torna a consultar com a màxim cada 90 dies, respectant el límit d'una petició per segon.

## Revisió de títols de cançons (`revisio-cancons.html`)

Llista totes les cançons publicades amb el títol que es veu a l'app, per editar-lo i baixar només els canvis (`revisio-cancons-AAAA-MM-DD.json`). `revisio-artistes.html` redirigeix a aquesta pàgina. Els canvis s'apliquen a mà (regla a `js/song-title.js` o excepció per vídeo); el feed no es toca.

## Actualització manual només dels grups nous

Després d'afegir els artistes i els seus IDs de canal a `data/artistes-musica.json` i
desar-los a `main`, obre **Actions → Actualitzar feed només dels grups nous →
Run workflow** i selecciona `main`.

L'acció detecta els IDs vàlids de canals dels artistes no rebutjats que encara no
apareixen a `data/feed.json` (`channels`). Aquest és el criteri de «nou»: pendent
de la primera incorporació al feed, independentment de la data d'alta. Inclou
també els canals Tema acabats d'afegir. Un canal que ja consta al feed, encara que
no tingui cançons publicades, no es torna a consultar.

- Només consulta YouTube per aquests canals, amb `MUSIC_TARGET_CHANNELS`.
- Si no hi ha canals nous, acaba correctament sense API ni canvis de dades.
- Les baixes de canals no provoquen una actualització general.
- Manté els filtres musicals, les revisions d'idioma i la separació entre feed i
  historial; regenera l'índex de cerca i publica les dades en un sol commit.
- Comparteix `music-data-writer` amb l'actualitzador habitual i rellegeix `main`
  abans de detectar els canals, per evitar repetir altes ja processades.

El workflow habitual **Actualitzar feed musical** conserva l'actualització
general programada i manual. La nova acció només s'executa manualment i des de
`main`; no cal escriure noms ni IDs en prémer **Run workflow**.


## Selecció de 2ES (11 d’octubre de 2026)

L’editor aprova els nou vídeos del canal 2ES excepte **BYE BYE** (`lGT_JGeoULk`) i **It’s my time** (`GtDCepBTk7o`). Els onze estaven classificats com a `review` i arxivats. Les nou aprovacions es desen a `music-content-overrides.json`; les dues exclusions, també a `hidden-videos.json`. La classificació Urbana segueix la presentació del canal. No s’ha inferit l’idioma pels títols: s’ha aplicat la selecció explícita de l’editor.

`node scripts/revisions/2026-10-11-2es.js` reaplica la selecció, recupera les metadades de l’arxiu amb les funcions compartides del pipeline i publica les nou cançons al feed calent, on caben dins del límit de dotze antigues per canal. Retira les entrades de la cua de revisió i actualitza els recomptes. [Selecció completa](revisions/2026-10-11-2es.json).

## Grups ska de la llista de l’usuari (14 d’octubre de 2026)

`node scripts/revisions/incorporar_ska_grup4.js` dona d’alta els 15 grups de la llista que encara no eren a la base: AlQuadrat, Atzembla, CampikiPugui, Dring Dublé, El Veïnat, Eskassa Llibertat, Kalabranda, Kòdul, La Bundu Band, Mascarats, Ovella Xao, Repúblika Ska, Skafam, Terra Ferma Ska Band i Trast. Els altres de la llista (Aspencat, Brams, Deskarats, La Fúmiga, Maitips, Mr. Freak Ska, Obrint Pas, Oprimits, Panellet, Pastorets Rock, Skatalà, Xavi Sarrià) ja hi eren i no es toquen.

- **Canal Tema primer** (`primary: true`); l’oficial s’hi afegeix pels videoclips i `MUSIC_TOPIC_GOVERNANCE=apply` fa que el Tema hi mani. Els Tema s’han identificat per les pistes i els discos a YouTube Music: n’hi ha d’homònims que **no** s’han posat (`SkaFam Music - Tema`, txec; els «Trast - Tema» japonès, italià i txec; el segon «Mascarats - Tema», buit). De CampikiPugui i Skafam només el Tema (l’oficial són versions o no existeix).
- **Categoria** «Ska / Reggae» i una subcategoria que ja comparteixen altres grups (`ska-punk`, `ska-classic`, `reggae`).
- **Població** a `origens-artistes.json` (municipis nous: Arenys de Munt, Sallent, la Sénia, Montcada, Sant Quirze del Vallès). CampikiPugui només té comarca (la Selva, referència Santa Coloma de Farners a `proximitat-musical.json`); Trast, el Baix Llobregat; Dring Dublé és una vinculació (Sabadell, on es va gravar), no un origen.
- **Idioma:** AlQuadrat, Dring Dublé, La Bundu Band, Ovella Xao i Trast van a `vigilats` (hi ha cançons en castellà o el catàleg és poc documentat); la resta, a `confianca`.
- Les cançons arriben amb **Actions → Actualitzar feed només dels grups nous** (des de `main`) o amb l’actualització diària de les 20 h. Detall: [revisions/2026-10-14-ska4-alta.json](revisions/2026-10-14-ska4-alta.json).
