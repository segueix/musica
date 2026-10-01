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

## Revisió de noms i categories (`revisio-artistes.html`)

Pàgina senzilla per repassar només els artistes **ben indexats** (amb canal de YouTube assignat i no rebutjats; ara 155): una fila per artista amb el **nom** (editable), les **categories** (botó «Edita», es poden triar-ne diverses de la taxonomia `data/music-genres.json`) i una columna **OK** per marcar els que ja estan bé. El que es fa es desa al navegador (`segueix_revisio_artistes_v1`) fins que es prem **«Descarrega la revisió»** (JSON; també hi ha CSV per llegir-lo en un full de càlcul). No escriu res al repositori ni demana cap token.

Per aplicar el fitxer descarregat:

```bash
node scripts/aplicar_revisio_artistes.js revisio-artistes-AAAA-MM-DD.json --dry-run   # simula i ensenya què canviarà
node scripts/aplicar_revisio_artistes.js revisio-artistes-AAAA-MM-DD.json             # escriu data/artistes-musica.json
node scripts/validar_artistes_musica.js
```

Què fa en aplicar-lo (lògica a `js/revisio-artistes.js`, provada a `tests/revisio-artistes.test.js`): el **nom** nou substitueix `name` i l'anterior passa a `aliases`; les **categories** substitueixen `genres` i s'afegeix `genre:manual` a `sources` perquè `scripts/enriquir_generes_musica.js` no les trepitgi; l'**OK** es desa com a `revisioEditorial: { ok: true, at }` (camp permès a l'esquema). No toca YouTube, MusicBrainz, l'enriquiment ni `reviewStatus`/`active`.

**Compte:** el nom que es veu a l'app (targetes, fitxa, cerca) és el del canal de YouTube (`channel.name` del feed), no `artist.name`. Canviar-lo aquí només afecta l'app quan el pipeline fa servir `artist.name` com a nom a mostrar (cal una passada a `scripts/update_music_feed.js` en aplicar la revisió).

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
