# Artistes vigilats per cançons en castellà (i basc)

Llista dels artistes a qui **ja hem amagat cançons en castellà (o basc)**. Són els que més probablement en tornaran a
tenir quan el feed musical incorpori vídeos nous: cal repassar-los primer cada vegada que es demani «revisa el
castellà». Les cançons amagades són a `data/hidden-videos.json` (el client les filtra i `update_music_feed.js` les
descarta en regenerar el feed).

> Última revisió: 2026-10-02. Si afegeixes o treus un artista, actualitza la taula **i** la data.

## Com es fa servir

1. Mira les cançons visibles dels artistes d'aquesta llista (les més noves primer):
   ```bash
   node scripts/revisar_castella_vigilats.js                       # tots els artistes de la taula
   node scripts/revisar_castella_vigilats.js --since=2026-10-01     # només els vídeos publicats des d'aquesta data
   node scripts/revisar_castella_vigilats.js --artista="Sisa"       # un sol artista
   ```
2. Mira cada títol (i, si dubtes, la descripció: la lletra és el criteri, **no** `defaultAudioLanguage`, que és poc
   fiable). Amaga només el que és **100 % en castellà o basc**; conserva el català, el mixt i els títols que podrien
   ser de qualsevol llengua.
3. Amaga'ls: afegeix la regla de l'artista a `REGLES` de `scripts/ocultar_titols_castella.js` i executa
   `node scripts/ocultar_titols_castella.js` (o afegeix l'ID a `data/hidden-videos.json` si és un cas puntual: un
   Short, un àlbum, etc., que la regla no mira perquè només tracta `song`/`live_song`).
4. Actualitza aquesta taula (ocultes, motiu, notes), la data de dalt i `docs/PROBLEMES_I_SOLUCIONS.md`.
5. Comprova amb `node scripts/ocultar_titols_castella.js --dry-run` que no queda res pendent i amb
   `npx vitest run tests/ocultar-titols-castella.test.js`.

El script llegeix els artistes d'aquesta taula: **la primera columna ha de ser `**Nom exacte al feed**`** (el
`channelTitle`). Un artista que no és a la taula no es repassa. **Trampa:** les claus de `REGLES` també han de ser el
`channelTitle` exacte (un canal que canvia de nom, p. ex. «Txarango Oficial» → «Txarango», deixa la regla morta sense cap
avís).

## Cançó d'autor (títols castellans, 2026-10-01)

| Artista (nom al feed) | Ocultes | Notes |
| --- | --- | --- |
| **Joan Manuel Serrat** | 40 | Repertori majoritàriament castellà. Es mantenen «Per al Meu Amic» i «Paraules D'Amor» (català). «Tarres», el Short «Mediterráneo» i l'àlbum «Mediterráneo» amagats a mà. Excepcions a la regla: `Per al Meu Amic`, `Paraules d'Amor`. |
| **Pi de la Serra** | 36 | Barreja català i castellà: es revisa títol a títol. |
| **Sisa** | 31 | Barreja; la regla de l'script només cobreix «Hay mujeres» i «Te esperaré el domingo». |
| **Marina Rossell** | 15 | Barreja català i castellà. |
| **Anna Andreu** | 3 | |

## Urbana i pop (títol 100 % en castellà, 2026-10-01)

| Artista (nom al feed) | Ocultes | Notes |
| --- | --- | --- |
| **31 FAM** | 5 | Només els títols plenament castellans (CUANDO ME MIRAS, ASÍ ES LA VIDA, OBSESIONADO, NO LE DURA, SEPTIEMBRE) i els antics de la regla. Argot dubtós (AL CANTU, Un Bate) es manté. |
| **Julieta** | 8 | Canvia de llengua cançó a cançó; Tornado, Taxi i Bruna es mantenen (títol de qualsevol llengua). |
| **Sexenni** | 7 | Mescla català i castellà; s'amaguen només els títols castellans (Antipánico, Tengo, Mentalidad de Mero…). |
| **Mushkaa** | 6 | Habibi, Xarnega, Sembla Mentida… són catalans; Turra Malvada (dubtós) es manté. |
| **BAYA BAYE** | 5 | També publicat com «BAYA BAIE». Mixtape «Calers y Verí» en castellà. |
| **Scorpio** | 1 | «Ya No». |
| **DAVEU))** | 1 | «Sueños de campeón». |
| **P.A.W.N. Gang** | 1 | «Modo avión» (Yung Mare). |

## Judit Neddermann (castellà i basc, 2026-10-01)

| Artista (nom al feed) | Ocultes | Notes |
| --- | --- | --- |
| **Judit Neddermann** | 19 | Castellà: l'àlbum *Aire* i part de *LAR*. Basc: l'àlbum *Artean* (títols basc/català, duets amb artistes bascos; es poden recuperar). **Pendent de verificar:** «Esperar» (*LAR*). «misterio do som» és en gallec i es manté. |

## Artistes nous amb repertori en castellà (alta del 2026-10-02)

Artistes que s'han indexat el 2026-10-02 i que, segons la llista de l'usuari, tenen cançons en castellà. Encara no són
al feed: quan el workflow «Actualitzar feed musical» els incorpori, cal repassar-los amb
`node scripts/revisar_castella_vigilats.js --artista="Nom"` i amagar les cançons 100 % en castellà. El nom de la taula és
el `channelTitle` que tindran al feed (el de YouTube, sense «- Topic» ni «Oficial»).

| Artista (nom al feed) | Ocultes | Notes |
| --- | --- | --- |
| **Sandra Bautista** | 0 | Pendent de revisar quan entri al feed. |
| **Frans Cuspinera** | 0 | Pendent de revisar quan entri al feed (canal «Tema»). |
| **Manu Guix** | 0 | Pendent de revisar quan entri al feed («Manu Guix Oficial»). |
| **Sílvia Comes** | 0 | Pendent de revisar quan entri al feed (canal «Tema»). |
| **Lídia Pujol** | 0 | Pendent de revisar quan entri al feed (canal «Tema»). |
| **ALBERT PLA** | 0 | No marcat per l'usuari, però bona part del repertori d'Albert Pla és en castellà: revisar-lo. A l'app es mostra «Albert Pla» (`displayName`). |
| **Dr. Calypso** | 0 | No marcat per l'usuari; grup de ska amb temes en castellà: revisar-lo. |

## Subtítols en castellà (2026-10-01)

Cançons que declaren subtítols en castellà a la descripció (filtre automàtic diari `scripts/lib/subtitols_castella.js`).
No és que la cançó sigui en castellà: es treuen perquè ofereixen subtítols en aquesta llengua.

| Artista (nom al feed) | Ocultes | Notes |
| --- | --- | --- |
| **Kitsch** | 3 | |
| **Xavi Sarrià** | 2 | |
| **ZOO POSSE** | 2 | |
| **Dàmaris Gelabert** | 2 | |
| **PAU VALLVÉ** | 1 | |

## Primera passada per canal (2026-09-29)

Revisió a mà de 1.458 títols de cançons (`scripts/ocultar_titols_castella.js`). Els IDs són a `hidden-videos.json`, però
el feed s'ha regenerat des d'aleshores i **no es pot recuperar quants n'hi ha per artista** (uns 100 IDs en total). Es
vigilen amb la regla del script.

| Artista (nom al feed) | Ocultes | Notes |
| --- | --- | --- |
| **miquel** | 1 + n/d | Revisió del 2026-10-01: «Mi bisabuelo Jaume». **Dubtós, es manté:** «El toro Olé». |
| **Umpah Pah** | 4 + n/d | Revisió del 2026-10-01: Con premeditación y alevosía, Entre tu y yo, Un compendio en mi menor, Sed de mal. |
| **Ceaxe** | n/d | «AQUELLA NIT» és en català i es manté. |
| **Júlia Cruz** | 2 | Revisió del 2026-10-01: «El baile del querer» (castellà) i el cover «One Night Only» de Jennifer Hudson (anglès), amagats a mà a `hidden-videos.json`. Es manté «Enyor» (català). |
| **SUU** | 19 + n/d | Revisió del 2026-10-01: 19 títols castellans (Eres un temazo, Ojalá, Soy, Algo de mi, Mi casa, Súbete, A solas, Reinas, Tranqüilo, A tomar, Me gusta, Nota de voz, De ti para mí, Creo…). Es mantenen els catalans (Diuen, Tant de bo, Passen coses…) i els títols compartits (Natural, Laura, Boom, Pur, Karaoke, Material sensible, Postal barata). |
| **Miki Nuñez** | 15 + n/d | Revisió del 2026-10-01: Viento y vida, Celébrate, Mi lugar, Beberte lento, Sin noticias de Gurb, Eterno verano, Coral del arrecife, 10 minutos, De ida y vuelta, Me vale, Todo lo que llevo dentro, La venda (Eurovisió, 2 vídeos) i el cover «Prefiero». Es mantenen els catalans i les versions en altres llengües (Trevo, en portuguès). |
| **alfredgarcia** | 14 + n/d | Revisió del 2026-10-01: Mi canción, Corazón, Si algún día (3), Los Espabilados (2), Desde que tú estás, Volver a empezar, Por si te hace falta, Lo que puedo dar, Que nos sigan las luces, Comunicado oficial, De la tierra hasta Marte, «Detrás de las cámaras de Londres». **Dubtós, es manté:** «1997» (amb Niño de Elche). |
| **CACTUS** | 3 + n/d | Revisió del 2026-10-01: Fuego, No osaríais vestir mi piel, Cabrona de mí. Es mantenen els mixtos (Un besito ràndom, No sabia lo que fer). |
| **Txarango** | 2 | «BENDITA VIDA» i «Bendita la vida» (la regla duia el nom antic `Txarango Oficial` i no coincidia). |
| **elo** | n/d | |
| **Joan Colomo** | n/d | |
| **Cristina Monllau** | n/d | |
| **Joan Dausà** | 1 + n/d | Revisió del 2026-10-01: «Nunca es tarde». |
| **Sandra Monfort** | 3 + n/d | Revisió del 2026-10-01: Niño reptil ángel (2), Nana para Enzo. |
| **Triquell** | n/d | |
| **Sangtraït** | n/d | |
| **Xavier de Bétera** | n/d | |
| **Ocults** | n/d | Canal amb cançons de procedència diversa. |
| **KOP** | n/d | La regla duia el nom antic `KOP Oficial`; ara coincideix amb el `channelTitle` real. |
| **La Madam** | 1 + n/d | Revisió del 2026-10-01: «Prende ese fuego». |

## Artistes rebutjats del feed

Repertori en castellà: s'han tret sencers (canal fora de `data/artistes-musica.json`, vídeos a `hidden-videos.json`).
**No tornar-los a resoldre.** El script avisa si en surt cap cançó.

| Artista (nom al feed) | Ocultes | Notes |
| --- | --- | --- |
| **MARLENA** | n/d | `rebutjat` a `artistes-musica.json`; tots els vídeos ocults. |
| **nusar3000** | 14 | `rebutjat`, sense canal («No tornar a resoldre @nusar3000»). |

## Què no s'amaga

- Títols en català, anglès o mixtos, encara que l'artista sigui castellanoparlant.
- Paraules compartides (Tornado, Taxi, Minifalda, Frikis, Primavera, Celebrar si és d'un artista català…) quan no hi ha
  cap altra pista.
- Gallec, occità i la resta de llengües que no s'han demanat explícitament.
