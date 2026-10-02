# Artistes vigilats per cançons en castellà (i basc)

Llista dels artistes a qui **ja hem amagat cançons en castellà (o basc)**. Són els que més probablement en tornaran a
tenir quan el feed musical incorpori vídeos nous: cal repassar-los primer cada vegada que es demani «revisa el
castellà». Les cançons amagades són a `data/hidden-videos.json` (el client les filtra i `update_music_feed.js` les
descarta en regenerar el feed).

> Última revisió: 2026-10-02. Si afegeixes o treus un artista, actualitza la taula **i** la data.

## Cançons noves (des del 2026-10-02)

Les cançons que entren al feed per primera vegada queden a `data/revisio-idiomes.json` fins que un agent les revisa
amb el vistiplau de l'usuari: vegeu «Revisió d'idioma de les cançons noves» a `CLAUDE.md`
(`node scripts/aplicar_revisio_idiomes.js --llista` / `--amaga=…`). Aquesta taula continua sent la llista d'artistes on
és més probable que n'apareguin.

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

## Castellà i altres llengües dels canals Tema (2026-10-02)

Revisió a mà de les cançons visibles de 46 artistes després d'afegir els canals «Tema». **A petició de l'usuari, en aquests
artistes s'amaguen també les cançons en altres llengües** (anglès, portuguès, gallec, italià, francès, llatí, basc,
japonès, àrab), no només el castellà. L'occità (aranès) i el català es mantenen, i també les instrumentals i els títols
que són noms propis. 472 cançons a `data/hidden-videos.json` amb `afegeix()` de `scripts/ocultar_titols_castella.js`
(llista de títols; el canal oficial i el Tema poden tenir noms diferents i hi són tots dos).

| Artista (nom al feed) | Ocultes | Notes |
| --- | --- | --- |
| **Txarango** | 12 | Castellà del canal Tema (El Martillo, Por Ambos Lados, Atrévete a Vivir, Corazón Viajero, Sueña Como un Niño…), «500 Millas», el popurri «Tom Dooley / Verde, Verde / Esta Es Tu Tierra» i «Mr. Tambourine Man» (anglès). El canal oficial és tot en català. **Dubtosos, es mantenen:** «Aguacero», «Son, Son, Son». |
| **Sandra Bautista** | 27 | Repertori majoritàriament castellà (Sentada en un meteorito, El último gol, Vid amurallada, GRACIAS…), italià («Mamma, rema»), gallec/portuguès («Os narradores do cinema mudo», «Silêncio») i els vídeos del micromecenatge. Es mantenen els catalans (Trencadís, Cartografia, Darrere el foc, La casa de les mil olors, Ressona la immensitat, «Mare, rema»). **Dubtosos, es mantenen:** «Pandela», «Trapezista». |
| **Sílvia Comes** | 27 | Canal Tema: cançó en castellà (Canción de Aniversario, Cuando Muera, Bolero para Gil de Biedma…), «Peeping Tom» (anglès), «Faltando un Pedaco» (portuguès) i «Malest Cornifici Tuo Catulo» (llatí). Es manté «Amor Particular» (Llach). **Dubtosos, es mantenen:** «La Carabina», «La Locomotora». |
| **Sílvia Pérez Cruz** | 28 | Castellà (Mañana, Loca, Vete de mí, Toda la vida un día, Cucurrucucú Paloma…), portuguès («É triste viver sem seu amor») i anglès («Sea Creature»). Es mantenen els catalans (Mar de Na Catalina, Abissal, Ben poca cosa tens, El Cant dels Ocells, Abril 74…). **Dubtosos, es mantenen:** «Chundwa», «Gelando», «Moreno», «Capitana», «Mechita», «Ai, Ai, Ai», «21 de primavera», «Verde», «Iglesias», «La flor». |
| **Ceaxe** | 16 | Revisió del 2026-10-02: 16 més del canal Tema (Dime mi amor, Baila sola, Pa ti…). Es mantenen «Mykonos», «EXCLUSIVAAA», «NENA CATALANA». |
| **ALBERT PLA** | 6 | Canal oficial: Mi voz, El Mortadela, Perdónenme, Todo me va bien, Experiencia Religiosa, Bombas en Madrid. |
| **Albert Pla** | 30 | Canal Tema: gairebé tot en castellà. Es mantenen els catalans (La Fada Dormilega, Dorm, Somiatruites, Sommis, Pipi). **Dubtosos, es mantenen:** «Pepe Botika», «Alboraya», «Primer Amor», «Lola». |
| **Miki Nuñez** | 7 | Revisió del 2026-10-02: «Mil Planes» i els covers en anglès i portuguès (Trevo, All of me, Hero, Mistletoe, Thinking out loud, Those little things). Es manté «Mil Ocells». |
| **Miki Núñez** | 18 | Canal Tema: castellà (Encender las calles, Ahora, Quédate en Madrid…) i anglès (Some Nights, Can We Dance). **Dubtós, es manté:** «Cucu-pido». |
| **alfredgarcia** | 13 | Revisió del 2026-10-02: castellà (Contigo, Toro de Cristal, Otra Liza…), anglès (Just A Light, Someday, For So Long, Let Me Go…) i portuguès (Praia dos Moinhos). **Dubtosos, es mantenen:** «Estrella» (amb Alvaro Soler), «1997», «2001», «Londres», «Sevilla». |
| **Alfred García** | 21 | Canal Tema: castellà (Cuando duermes, Vete de mí, Tu canción…), anglès (City of Stars, Rock With You…) i portuguès («Amar pelos dois»). Es mantenen «Barcelona», «Madrid», «1016», «360», «Harmonic Sketch #1». |
| **Jofre Bardagí** | 10 | Versions de Serrat i duets en castellà (Señora, Mediterráneo, Penélope…). **Dubtós, es manté:** «Menuda». |
| **Lídia Pujol** | 12 | Castellà (Me quedaré soltera, Mi querida España, Nada de nada…), italià («Sogna fiore mio») i llatí (Ad mortem festinamus, Stella splendens, Polorum regina). Es manté l'occità («Aqueres montanhes»). **Dubtosos, es mantenen:** «Il Somiatruites», «Beatriucomtessa De Dia». |
| **Dàmaris Gelabert** | 5 | Revisió del 2026-10-02: les versions en castellà (Los meses del año, Las estaciones…). |
| **Marina Rossell** | 13 | Revisió del 2026-10-02: castellà (habaneres, Moustaki en castellà), portuguès («Grândola, vila morena») i italià («Va, pensiero»). **Dubtosos, es mantenen:** «Lili Marleen», «Bella Ciao», «Wiegala», «Hiroshima», «Rosina». |
| **Sopa de Cabra** | 6 | Les cançons en castellà (Mundo Infierno, Sin Hablar, Viviendo a tu alrededor…). |
| **Montse Castellà** | 4 | Les cançons en castellà del canal Tema. |
| **Joan Colomo** | 7 | Revisió del 2026-10-02: 7 títols castellans més del canal Tema. |
| **Andreu Rifé** | 5 | Canal Tema: Sácate la ternura, Mañana de ayer de hoy, Crimen, Dos rombos, Quién fuera. |
| **Buhos** | 7 | Castellà (Cerca de ti, Vuela aunque duela…) i anglès (Today is the day, Sweet Caroline). |
| **31 FAM** | 18 | Revisió del 2026-10-02: castellà (Te gusto, Rompe, Sincero…) i anglès (Purgatory, No Love, Touchdown…). Es mantenen l'argot i els títols mixtos (Homies, Frosti Flakes, Bandolera, Vida Gris). |
| **KOP** | 14 | Revisió del 2026-10-02: castellà, anglès («Freedom», «We're Not Angels») i basc («Utzi Bakean»). |
| **Manu Guix** | 10 | Castellà (Tiempo para creer, Había una vez…) i les cançons de Grease en castellà i anglès. |
| **Adrià Puntí** | 8 | Les cançons d'Umpah-Pah en castellà del canal Tema (Tocayo, Barba Azul…). |
| **Roger Mas** | 3 | «La Llorona», «La Bien Pagá» (castellà) i «Amore che vieni» (italià). Es manté l'occità. |
| **The Tyets** | 7 | Castellà (Bebesita, Oye Mulata, Se queda…) i anglès («Let Me Alive»). |
| **Brams** | 3 | «Two Girls», «¿Qué pone en tu DNI?», «Rojo Separatista». |
| **La Tour De Carol** | 3 | «ragazza spettacolare» (italià), «A TODO TREN» (castellà), «M'aider» (francès). |
| **Frans Cuspinera** | 2 | «Árbol Torcido», «Siempre Contigo». |
| **Baya Baye** | 6 | Canal Tema: castellà, gallec («As Bestas»), anglès i italià. |
| **Flashy Ice Cream** | 3 | «Toda la noche», «Forever Young», «Aleluya». |
| **Sara Roy** | 12 | Les cançons en castellà de (A)MAR i les acústiques, i «Maybe». |
| **Ayryn** | 3 | «Ya no lloro», «Nada», «Si tu te vas». **Dubtós, es manté:** «Cansada». |
| **Pere Tapias** | 2 | «Oye José María», «Moreno de la Fe». |
| **Júlia Cruz** | 1 | Revisió del 2026-10-02: «Para llegar». |
| **Júlia Colom** | 1 | «Canta para seguir». |
| **Gessamí Boada** | 22 | Cançons en anglès i castellà. Es mantenen les catalanes (Surto de mi, Oreneta, Mirades, Un instant…). |
| **El Pony Pisador** | 16 | Cançons de mariners en anglès (Wellerman, Haul Away Joe…) i «El Guisote del Tío Benito». |
| **Dr. Calypso** | 11 | Cançons en anglès i castellà. Es mantenen les instrumentals (Mr. Farlops, Plan 10, Magreb Ska…). |
| **Crim** | 12 | Cançons i versions en anglès. |
| **MISHIMA** | 4 | Canal Tema: les primeres cançons en anglès i «Del Montón». |
| **Mishima** | 1 | «Hasta que lo miras». |
| **Gossos** | 4 | «Doraemon No Uta» (japonès), «Club Tonight», «Baby Only You», «La calle 24». |
| **Anaïs Vila** | 2 | «But We Are Still Here», «The Calm». |
| **The Demencials** | 4 | «El Fuego del Corazón», «We Are», «You Wondering Now» i un títol en àrab. **Dubtós, es manté:** «Difícil Caminar». |
| **Auxili** | 2 | «Rude Girl», «Imposibles». |
| **Siderland** | 2 | «La Vida Líquida», «Let Me Love Ya». |
| **Ebri Knight** | 10 | L'EP en castellà *La voz dormida* (El partisano, Vientos del pueblo…), «El Pueblo Unido», «Campesino» i les dues en anglès. |
| **Toti Soler** | 2 | «Todos os sonhos do mundo» (portuguès), «El corazón es agua». Es mantenen les instrumentals. |
| **Gertrudis** | 9 | Castellà (Carita de rosa, Almejilla, 5 minutillos…) i gallec («Rúa da Raiña»). **Dubtosos, es mantenen:** «Augurio», «Remedios», «Tontolava». |
| **Montse Castellà - Cantautora** | 0 | Canal oficial: la regla hi és per si en surten de noves. |
| **AYRYN** | 0 | Canal oficial (vegeu «Ayryn»). |
| **GOSSOS** | 0 | Canal oficial (vegeu «Gossos»). |
| **AUXILI** | 0 | Canal oficial (vegeu «Auxili»). |

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

- Títols en català, anglès o mixtos, encara que l'artista sigui castellanoparlant (llevat dels artistes de la secció del 2026-10-02, on l'anglès també s'amaga).
- Paraules compartides (Tornado, Taxi, Minifalda, Frikis, Primavera, Celebrar si és d'un artista català…) quan no hi ha
  cap altra pista.
- Gallec, occità i la resta de llengües que no s'han demanat explícitament. **Excepció:** als artistes de la secció «Castellà i altres llengües dels canals Tema (2026-10-02)» s'amaguen totes les llengües que no són el català ni l'occità.
