# Historial de revisions per idioma

> Des del 2026-10-12 la font operativa és `data/artistes-vigilats-idioma.json`, amb el document generat [Artistes vigilats per idioma](ARTISTES_VIGILATS_IDIOMA.md). Les taules de sota són històriques: no determinen qui entra a la cua. Només es revisen les cançons dels artistes vigilats; la confiança editorial es registra separadament. El títol ja no provoca descartaments automàtics. Les instruccions operatives actuals són al nou document.

Llista dels artistes a qui **ja hem amagat cançons en castellà (o basc)**. Són els que més probablement en tornaran a
tenir quan el feed musical incorpori vídeos nous: cal repassar-los primer cada vegada que es demani «revisa el
castellà». Les cançons amagades són a `data/hidden-videos.json` (el client les filtra i `update_music_feed.js` les
descarta en regenerar el feed).

> Última revisió: 2026-10-11. Si afegeixes o treus un artista, actualitza la taula **i** la data.

## Revisió de lletres de les 239 pendents (2026-10-05)

Cerca individual per artista i títol: **22 exclusions, 35 conservades i 182 encara pendents**. S’afegeix una 23a exclusió en rectificar «Gratitud», de Still Ill, conservada erròniament a la passada anterior: la lletra publicada pel grup és castellana. Les dues descartades automàtiques anteriors continuen sense verificar.

[Decisions, cerques i fonts per entrada](revisions/2026-10-05-idiomes-lletres.json). Les cerques no han proporcionat una lletra fiable per a les 182 pendents; no s’han marcat com a revisades. Les versions en directe inferides a partir de la lletra d’estudi s’identifiquen al registre.

| Artista (nom al feed) | Ocultes noves |
| --- | --- |
| **Adala** | 1 |
| **Boom Boom Fighters** | 1 |
| **Dusminguet** | 3 |
| **Joan Miquel Oliver** | 1 |
| **La Sra. Tomasa** | 1 |
| **La Troba Kung-Fú** | 1 |
| **Malson Atmosfèric** | 1 |
| **PUPIL·LES** | 3 |
| **Roba Estesa** | 2 |
| **Sabor de Gracia** | 1 |
| **Still Ill** | 7 |
| **Valtonyc** | 1 |

## Revisió de pendents (2026-10-05)

Repassades 1546 entrades: 1008 conservades, 221 exclusions noves per ID, 68 exclusions anteriors respectades i 249 casos sense evidència suficient. Inclou les 717 entrades incorporades durant la revisió. En tancar aquella passada quedaven 239 pendents i 2 descartades encara per verificar; la diferència correspon a entrades que el bot ja havia retirat del feed.

[Registre complet de decisions i fonts](revisions/2026-10-05-idiomes.json). La revisió contextual no s’ha presentat com una comprovació íntegra de totes les lletres. No s’han aprovat els casos dubtosos. Les exclusions són per vídeo per evitar afectar versions catalanes o instrumentals d’artistes homònims.

| Artista (nom al feed) | Ocultes noves | Criteri |
| --- | --- | --- |
| **9SON** | 3 | Vegeu el registre per ID, motiu i font. |
| **ACROS** | 40 | Vegeu el registre per ID, motiu i font. |
| **Adala** | 6 | Vegeu el registre per ID, motiu i font. |
| **AnimalGrup** | 5 | Vegeu el registre per ID, motiu i font. |
| **Dusminguet** | 1 | Vegeu el registre per ID, motiu i font. |
| **Itaca Band** | 4 | Vegeu el registre per ID, motiu i font. |
| **Josep Valtonyc** | 7 | Vegeu el registre per ID, motiu i font. |
| **La Banda del Yuyu** | 2 | Vegeu el registre per ID, motiu i font. |
| **La Pegatina** | 5 | Vegeu el registre per ID, motiu i font. |
| **La Sra. Tomasa** | 60 | Vegeu el registre per ID, motiu i font. |
| **Lluís Llach** | 1 | Vegeu el registre per ID, motiu i font. |
| **Mazoni** | 3 | Vegeu el registre per ID, motiu i font. |
| **Muyayo Rif** | 19 | Vegeu el registre per ID, motiu i font. |
| **PUPIL·LES** | 4 | Vegeu el registre per ID, motiu i font. |
| **Rapsodes** | 1 | Vegeu el registre per ID, motiu i font. |
| **Roba Estesa** | 6 | Vegeu el registre per ID, motiu i font. |
| **SABOR DE GRACIA** | 3 | Vegeu el registre per ID, motiu i font. |
| **STAY HOMAS** | 2 | Vegeu el registre per ID, motiu i font. |
| **Sabor de Gracia** | 25 | Vegeu el registre per ID, motiu i font. |
| **Still Ill** | 15 | Vegeu el registre per ID, motiu i font. |
| **Tesa** | 1 | Vegeu el registre per ID, motiu i font. |
| **Valtonyc** | 6 | Vegeu el registre per ID, motiu i font. |
| **XEIC** | 2 | Vegeu el registre per ID, motiu i font. |

## Stay Homas i La Pegatina (2026-10-05)

A petició de l’usuari es conserva el repertori català dels canals oficials i Tema, incloses les versions en directe. Les exclusions s’apliquen també a l’historial i al catàleg de pistes.

| Artista (nom al feed) | Ocultes | Notes |
| --- | --- | --- |
| **STAY HOMAS** | Per títol | Castellà, anglès i portuguès; «Rade Blunner», «Tropical» i «Del Revés» tenen lletra castellana. Es conserven «Espurna», «Xinu Xanu», «La Platja», «Petons», «Ho tornaria a fer», «La Nòria», «Les Merdes», «Ho sap tothom menys tu», «No tinc paraules», «No vull baixar» i «+=», amb les seves versions. |
| **Stay Homas** | Per títol | Mateix criteri al canal Tema. «Ara (Les Merdes II)» i «The Bright Side» es retiren pels versos sencers en anglès. |
| **Stay Homas - Topic** | Per títol | Àlies del canal Tema de Stay Homas. |
| **La Pegatina** | Per títol | Es conserven «Gat Rumberu», «La Meva Gent», «Que t’agradi veure’m» i «La guspira» del feed i historial actuals. «Sonqueson» i «Saber que tu» tenen lletra castellana. Les regles cobreixen també les versions del catàleg. |
| **La Pegatina - Topic** | Per títol | Àlies del canal Tema de La Pegatina. |
| **DAVEU** | 2 | Nom normalitzat del canal «DAVEU))», ja vigilat; mateixa regla. |

Itaca Band es retira íntegrament, amb tots dos canals. De La Madam només es bloqueja `UCCjTaOHQqmy0VD2vkZVxxoA`, sense excloure el grup català pel nom. Al repositori no hi ha cap altre canal de La Madam assignat: la fitxa es conserva pendent d’identificar el correcte.

## Cançons noves (des del 2026-10-02)

Les incorporacions segueixen la política del [registre únic](ARTISTES_VIGILATS_IDIOMA.md). Per llistar les cançons visibles dels artistes vigilats, inclosos els seus canals Topic:

```bash
node scripts/revisar_castella_vigilats.js
node scripts/revisar_castella_vigilats.js --artista="Sisa"
```

No deduïu l’idioma de la lletra només pel títol ni per `defaultAudioLanguage`. Respecteu l’abast demanat per l’usuari. Les exclusions editorials prèvies es conserven; les noves decisions han de tenir evidència. El castellà, basc i altres llengües, incloses estrofes substancials dins una peça mixta, queden exclosos segons el criteri actual; català, occità/aranès i instrumentals es conserven.

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
| **DAVEU))** | 2 | «Sueños de campeón» i «Mi broda» (eliminada de la reproducció general a petició de l'usuari). |
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
| **Mariona Escoda** | 1 | «Maniac (Acústic en directe)» identificada com a **anglès** (versió de Michael Sembello). ID `P6vnb8DQiSo` afegit directament a `hidden-videos.json` perquè desaparegui immediatament, a més de la regla persistent. |
| **Mariona Escoda - Topic** | 0 | Mateixa exclusió al canal Tema: «Maniac» (anglès). |
| **VEN'NUS** | 3 | Només català: s'exclouen «Carmen se fue» (català + castellà), «I Jazz Want My G Back» (català + anglès) i «It's So Hard To Be So Funny» (català + italià + anglès). «Tan Len» es manté perquè la lletra és en català. |
| **Ven'nus** | 3 | Mateixa regla persistent al canal Tema per evitar que les versions de les tres peces no íntegrament catalanes tornin a entrar. |
| **Txarango** | 12 | Castellà del canal Tema (El Martillo, Por Ambos Lados, Atrévete a Vivir, Corazón Viajero, Sueña Como un Niño…), «500 Millas», el popurri «Tom Dooley / Verde, Verde / Esta Es Tu Tierra» i «Mr. Tambourine Man» (anglès). El canal oficial és tot en català. **Dubtosos, es mantenen:** «Aguacero», «Son, Son, Son». |
| **Sandra Bautista** | 28 | Repertori majoritàriament castellà (Sentada en un meteorito, El último gol, Vid amurallada, GRACIAS…), italià («Mamma, rema»), gallec/portuguès («Os narradores do cinema mudo», «Silêncio») i els vídeos del micromecenatge. Revisió 2026-10-03: «Pandela» s'amaga perquè és una versió d'Andrea Parodi amb lletra no catalana; «Trapezista» queda confirmada en català. Es mantenen també Trencadís, Cartografia, Darrere el foc, Fidel al teu estil, La igualtat és la victòria, Ressona la immensitat, Mare, rema i La casa de les mil olors. |
| **Sílvia Comes** | 27 | Canal Tema: cançó en castellà (Canción de Aniversario, Cuando Muera, Bolero para Gil de Biedma…), «Peeping Tom» (anglès), «Faltando un Pedaco» (portuguès) i «Malest Cornifici Tuo Catulo» (llatí). Es manté «Amor Particular» (Llach). **Dubtosos, es mantenen:** «La Carabina», «La Locomotora». |
| **Sílvia Pérez Cruz** | 35 | Castellà (Mañana, Loca, Vete de mí, Toda la vida un día, Cucurrucucú Paloma…), portuguès («É triste viver sem seu amor») i anglès («Sea Creature»). Es mantenen els catalans (Mar de Na Catalina, Abissal, Ben poca cosa tens, El Cant dels Ocells, Abril 74…). Segona passada (2026-10-02, a petició de l'usuari): «Chundwa (Chacarera)», «Gelando», «Moreno», «Capitana», «Mechita», «Verde» i «Hymne à l'amour» (francès). **Dubtosos, es mantenen:** «Ai, Ai, Ai», «Iglesias», «21 de primavera». |
| **Ceaxe** | 16 | Revisió del 2026-10-02: 16 més del canal Tema (Dime mi amor, Baila sola, Pa ti…). Indicació posterior de l’editor (2026-10-23): es retiren «Mykonos» (`M4300so9eNo`, `DA_x1BxRQmM`), «EXCLUSIVAAA» (`XGSynJw9bzQ`) i «Como Siempre» (`IEPkQw3K6CU`). Es manté «NENA CATALANA». Ceaxe continua en vigilància al canal oficial i Tema. |
| **ALBERT PLA** | 7 | Canal oficial: Mi voz, El Mortadela, Perdónenme, Todo me va bien, Experiencia Religiosa, Bombas en Madrid i el making of «Así se hizo "El Mortadela"». |
| **Albert Pla** | 32 | Canal Tema: gairebé tot en castellà. Es mantenen els catalans (La Fada Dormilega, Dorm, Somiatruites, Sommis, Pipi). Segona passada (2026-10-02): «Pepe Botika» i «Alboraya». **Dubtosos, es mantenen:** «Primer Amor», «Lola». |
| **Miki Nuñez** | 7 | Revisió del 2026-10-02: «Mil Planes» i els covers en anglès i portuguès (Trevo, All of me, Hero, Mistletoe, Thinking out loud, Those little things). Es manté «Mil Ocells». |
| **Miki Núñez** | 18 | Canal Tema: castellà (Encender las calles, Ahora, Quédate en Madrid…) i anglès (Some Nights, Can We Dance). **Dubtós, es manté:** «Cucu-pido». |
| **alfredgarcia** | 19 | Revisió del 2026-10-02: castellà (Contigo, Toro de Cristal, Otra Liza…), anglès (Just A Light, Someday, For So Long, Let Me Go…) i portuguès (Praia dos Moinhos). Segona passada (2026-10-02, a petició de l'usuari): «Mateo» (2 vídeos), «2001», «1997» (amb Niño de Elche), «Londres» i «Sevilla» (BILBAO #1016Tour). **Dubtós, es manté:** «Estrella» (amb Alvaro Soler). |
| **Alfred García** | 22 | Canal Tema: castellà (Cuando duermes, Vete de mí, Tu canción…), anglès (City of Stars, Rock With You…) i portuguès («Amar pelos dois»). Segona passada (2026-10-02): «Madrid». Es mantenen «Barcelona», «1016», «360», «Harmonic Sketch #1». |
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
| **Opció K-95** | 7 | Revisió 2026-10-03 del canal Topic: anglès confirmat — «A World To Win», «Kill The Bastards», «No More Colours One Army», «We Must Break Our Chains», «We're Free», «Nation of Oi!» i «Working Class Hell». Es mantenen «Oi! You!» (Cap Oportunitat és íntegrament en català), «Partisans» i la resta de repertori català. |
| **Manu Guix** | 10 | Castellà (Tiempo para creer, Había una vez…) i les cançons de Grease en castellà i anglès. |
| **Adrià Puntí** | 12 | Cançons d'Umpah-Pah en castellà del canal Tema. Revisió 2026-10-03: amagades també «El Preludio del Adiós», «La Columna de Simeon», «Sueño Dormido (Al Fondo de un Abrevadero)» i «Sí»; la regla persistent ja les cobreix. |
| **Roger Mas** | 3 | «La Llorona», «La Bien Pagá» (castellà) i «Amore che vieni» (italià). Es manté l'occità. |
| **The Tyets** | 7 | Castellà (Bebesita, Oye Mulata, Se queda…) i anglès («Let Me Alive»). |
| **Brams** | 3 | «Two Girls», «¿Qué pone en tu DNI?», «Rojo Separatista». |
| **La Tour De Carol** | 3 | «ragazza spettacolare» (italià), «A TODO TREN» (castellà), «M'aider» (francès). |
| **Frans Cuspinera** | 2 | «Árbol Torcido», «Siempre Contigo». |
| **Baya Baye** | 6 | Canal Tema: castellà, gallec («As Bestas»), anglès i italià. |
| **Flashy Ice Cream** | 3 | «Toda la noche», «Forever Young», «Aleluya». |
| **Sara Roy** | 12 | Les cançons en castellà de (A)MAR i les acústiques, i «Maybe». |
| **Ayryn** | 3 | «Ya no lloro», «Nada», «Si tu te vas». **Dubtós, es manté:** «Cansada». |
| **Guillermina Motta** | 18 | Versions no catalanes del repertori en castellà/anglès («Cuando Sea Muy Vieja», «Yo en Amores Soy Muy Ligera», «Aquellos Tiempos del Cuplé», «Johnny Go Home»…). **Es conserva «La Moñito»**: el títol activa falsament el filtre per la ñ, però la peça és catalana amb frases paròdiques. També es conserva «Madame» (català). |
| **La Trinca** | 29 | Versions castellanes dels discos *Sinánimus Molestandi*, *¿Quesquesé se merdé?* i *Trinca, sexo y rocanrol*. «Mama Caca», «Vade Retro» i «Flash Reagan» es bloquegen per ID quan la versió castellana comparteix títol amb una catalana. **«La Patata» es conserva**: la lletra és catalana. |
| **Pere Tapias** | 2 | «Oye José María» i «Moreno de la Fe» (incloses les versions duplicades/en directe). Altres títols amb mots estrangers es conserven si no hi ha prova que la lletra no sigui catalana. |
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


## Noms de canal ja coberts per les regles

Àlies i artistes amb regles existents; s’hi afegeixen perquè la revisió automàtica també els repassi.

| Artista (nom al feed) | Ocultes | Notes |
| --- | --- | --- |
| **Opcio K-95** | Per títol | Regla existent a l’script; sense canvis d’exclusions en aquesta revisió. |
| **Opció K-95 - Topic** | Per títol | Regla existent a l’script; sense canvis d’exclusions en aquesta revisió. |
| **Opcio K-95 - Topic** | Per títol | Regla existent a l’script; sense canvis d’exclusions en aquesta revisió. |
| **Dusminguet** | Per títol | Regla existent a l’script; sense canvis d’exclusions en aquesta revisió. |
| **Dusminguet - Topic** | Per títol | Regla existent a l’script; sense canvis d’exclusions en aquesta revisió. |
| **La Troba Kung-Fú** | Per títol | Regla existent a l’script; sense canvis d’exclusions en aquesta revisió. |
| **La Troba Kung-Fú - Topic** | Per títol | Regla existent a l’script; sense canvis d’exclusions en aquesta revisió. |
| **Au Rora** | Per títol | Regla existent a l’script; sense canvis d’exclusions en aquesta revisió. |

## Altes dirigides (2026-10-07)

Regles preventives a `data/music-channel-video-allowlist.json`:

- Teràpia de Shock: s’exclouen «Sin Ti» i «Without You», versions castellana i anglesa de «Sense tu».
- Grup de Folk: canal multilingüe; només primera selecció de títols catalans identificats. Referència: https://www.enderrock.cat/disc/4765/festival-folk . La resta queda fora fins a revisió.
- Exili a Elba: «Red Right Hand» queda fora de la selecció catalana.

## Revisió 2026-10-11 — canals Tema de folk

- **La Coixinera:** selecció ampliada d’1 a 49 pistes del Tema (català i instrumental). Astoaren Kanta continua exclosa (basc). Nou pistes continuen pendents; no s’ha obert el canal indiscriminadament.
- **L’Ham de Foc:** revisió dels tres discos U, Cançó de dona i home i Cor de porc. Andarletto (`QY5wOLeAFhw`) exclosa per lletra en judeocastellà; regla persistent per títol al filtre del canal. Illes continua pendent de confirmar l’idioma o la condició instrumental.
- Revisió documental de discos, autories, repertori i lletres disponibles, no audició íntegra. [Decisions i fonts per pista](revisions/2026-10-11-folk-tema.json).



## Revisió 2026-10-12 — Dusminguet, La Troba Kung-Fú i Gertrudis

61 IDs nous exclosos (25 Dusminguet, 13 La Troba Kung-Fú, 23 Gertrudis), comptant versions i recopilatoris. La revisió cobreix l’inventari de 334 IDs dels tres artistes al feed, l’historial i el catàleg Topic, sense considerar verificades totes les peces que resten.

Noves obres excloses: Dusminguet — Jackeline/Jaqueline (francès), Habibi (àrab), La muralla (castellà), La dansa de l’imbècil (català/castellà), Rock & Roll (castellà/anglès); La Troba Kung-Fú — Oriente Miedo/Miede (castellà/català/anglès), Stop Blood i Shame Blues (català/anglès); Gertrudis — Pantalones i Mundo Uaka (castellà), Amor XXL (català/anglès). S’apliquen també els IDs de les exclusions ja documentades que faltaven al catàleg.

Es conserven els casos dubtosos i set remescles sense verificació de la veu. Gran dubtà, Disco jonki, Go, Calor calor, Rock Rumberu i Tontolava no s’exclouen pel títol. Registre amb IDs, fonts i limitacions: [revisió](revisions/2026-10-12-dusminguet-troba-gertrudis.json).

