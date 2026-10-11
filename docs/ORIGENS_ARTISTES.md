# Origen i vinculació dels artistes

## Estat: 11 d'octubre de 2026

La fitxa mostra les assignacions validades de 329 artistes (491 canals oficials i Topic). En prémer la línia «Origen» o «Vinculat a» es despleguen el motiu i les fonts. Els perfils de programes i els artistes encara sense assignació no mostren la línia.

El [pilot inicial](ORIGENS_PILOT_30.md) tenia 22 casos documentats i 8 pendents. Una segona revisió ha validat Dusminguet, La Coixinera, Ebri Knight, Joan Miquel Oliver, Xarim Aresté i la vinculació de La Troba Kung-Fú amb la Garriga. Per a aquest últim, la biografia de Fourni Produccions a WOMEX documenta l'estudi propi a la Fournier; no afirmem que sigui el municipi de formació.

**L'Ham de Foc i Al Tall** tenen origen a **València ciutat**, confirmat per l'editor del catàleg el 11 d'octubre de 2026. És una correcció manual protegida (`assignmentSource: user-correction`, `locked: true`).

## Dades

`data/origens-artistes.json` és una font manual persistent, separada del feed generat:

- `artists`: assignació única per artista, relació `origin` o `associated`, llocs, fonts, explicació, data, estat i bloqueig manual.
- `channels`: canals oficials i Topic associats a l'artista del catàleg. En afegir canals cal ampliar aquest mapa després de confirmar la identitat.
- `places`: llocs normalitzats reutilitzables. Hi ha 136 poblacions amb identificador GeoNames i coordenades de referència del nucli o municipi; no són domicilis ni coordenades personals. La jerarquia administrativa del proveïdor no s'utilitza per assignar el municipi (pot tenir discrepàncies).
- Formentera i Mallorca es mantenen a escala d'illa; Camp de Tarragona, Camp de Túria i Montseny a escala territorial. També es documenten Vallès, Comtat, Alcoià, Horta Sud, Maresme, la Safor, la Vall d’Albaida, Baix Llobregat, Barcelonès i Catalunya Nord. Aquests quinze llocs territorials no tenen coordenades puntuals. Marala conserva les tres poblacions documentades.

Les coordenades provenen de **GeoNames, generalment via Open-Meteo**, amb atribució CC BY 4.0. Cada població desa la consulta d'origen i la data. Referències: <https://www.geonames.org/> i <https://open-meteo.com/en/docs/geocoding-api>.

Les dades estructurades del [pilot](revisions/2026-10-11-origens-pilot-30.json) indiquen les 30 assignacions aplicades, sense casos pendents. El catàleg de runtime només conté entrades `validated`.

## Interfície i manteniment

`js/features/artist-page.js` carrega el catàleg en obrir una fitxa, amb URL resolta per `appDataUrl`. El resultat es comparteix durant la sessió; si falla la xarxa es torna a provar en una visita posterior. La petició anterior no pot pintar dades sobre un altre artista. Les fonts admeten només HTTPS i els textos s'escapen abans d'inserir-los al DOM.

La informació queda dins la capçalera existent, amb desplegable natiu accessible per teclat i espai tàctil al mòbil. El catàleg es beneficia de la memòria cau de dades existent del service worker.

Les actualitzacions automàtiques futures han de generar propostes i respectar `locked: true`. No s'ha activat encara ni l'enriquiment automàtic de tot el catàleg ni la geolocalització de l'oient ni la ràdio per proximitat.

## Comprovacions

`tests/artist-origin.test.js` comprova identitat compartida, diversos municipis, territoris sense coordenades, ocultació de dades pendents, escapament, canvis ràpids de fitxa i recuperació després d'errors de xarxa. Les 169 proves disponibles en l'entorn local passen. El JS modificat passa ESLint; el lint global manté cinc errors previs en fitxers no modificats.

## Segon lot de 30 artistes (11 d'octubre de 2026)

Revisió assistida, amb 30 assignacions validades. Falç de Fetillera s'ha resolt posteriorment amb Barcelona, confirmat per l'editor del catàleg i protegit com a correcció manual. [Decisions i fonts del lot](revisions/2026-10-11-origens-lot-02.json). S'han prioritzat els artistes amb més cançons i directes al feed actual, sense confondre aquest recompte amb tota la discografia.

Pau Riba es vincula a Tiana; Dàmaris Gelabert, a Cardedeu; Blaumut i Angoixa, a Barcelona; Valtònyc, a sa Pobla i Sineu. Aquestes vinculacions no són una afirmació del lloc de naixement. Fades conserva Mallorca i Rapsodes el Camp de Túria, sense un punt municipal inventat. Les 30 assignacions anteriors i les correccions de València es conserven íntegrament.

No s'ha activat un procés automàtic per a nous artistes: aquesta passada és una revisió documental aplicada manualment. La ràdio per proximitat continua pendent.

## Tercer lot de 30 artistes (11 d'octubre de 2026)

S'han validat les 30 assignacions. Forja s'ha resolt posteriorment amb Terrassa, confirmat per l'editor del catàleg i protegit com a correcció manual. [Decisions i fonts del lot](revisions/2026-10-11-origens-lot-03.json).

Els Catarres conserven Aiguafreda i Centelles. El Diluvi es vincula a Castalla, amb membres d'altres poblacions de l'Alcoià; El Nota, a Cornellà de Llobregat; Isaak Aguilà, a Rubí per la seva trajectòria, distingint-la del naixement a Sabadell i la residència posterior a Reus. Antònia Font conserva Mallorca a escala d'illa. Marina Rossell queda assignada a Castellet i la Gornal, amb el nucli de la Gornal com a referència geogràfica explícita. La Ludwig Band queda assignada a Espolla, on l'entrevista situa els inicis i el primer estudi del projecte.

Falç de Fetillera queda assignat a Barcelona amb `assignmentSource: user-correction` i `locked: true`; el lot 02 conserva també el motiu de la decisió pendent anterior. Es preserven les 59 assignacions prèvies i les correccions de València ciutat.

## Quart lot de 30 artistes (11 d'octubre de 2026)

S'han validat 29 assignacions. Palau s'ha retirat temporalment per petició editorial després de detectar que tenia assignat el canal de Ferran Palau, tot i que la descripció correspon a un altre grup. Es preserva l'origen de Ferran Palau a Esparreguera. [Decisions i fonts del lot](revisions/2026-10-11-origens-lot-04.json).

Terratombats conserva Igualada, la Llacuna i Sant Vicenç dels Horts. Herba Negra es vincula al Camp de Túria i Cocentaina. Txarango es vincula a Sant Joan de les Abadesses, i Joan Isaac a Esplugues de Llobregat, sense confondre l'arrelament amb el lloc exacte de naixement. Astral Warrior es vincula a les Masies de Voltregà: les coordenades provenen directament de la divisió municipal de GeoNames i s'etiqueten com a referència municipal, no d'un nucli concret.

Forja queda assignat a Terrassa amb `assignmentSource: user-correction` i `locked: true`; el lot 03 conserva el motiu de la decisió pendent anterior. Es preserven íntegrament les 89 assignacions anteriors. No s'ha activat l'enriquiment automàtic ni la ràdio per proximitat.

## Següent grup: Bocc (11 d'octubre de 2026)

Bocc queda assignat a Barcelona, amb la biografia del grup a Bandcamp i la fitxa del festival CastellHell com a fonts. Era el següent grup pendent amb 20 cançons/directes al feed. [Decisió i fonts](revisions/2026-10-11-origen-bocc.json).

Palau s'ha eliminat del catàleg i de la llista de canals verificats, amb exclusió editorial temporal pel nom exacte. S'ha retirat també l'etiqueta incorrecta de les metadades del feed i de l'índex de canals. El canal, les cançons i l'origen de Ferran Palau es conserven íntegrament.

## Cinquè lot de 30 artistes (11 d’octubre de 2026)

S’han aplicat les 30 assignacions i es preserven íntegrament les 120 anteriors, incloses les correccions editorials. [Decisions i fonts del lot](revisions/2026-10-11-origens-lot-05.json). La priorització continua basada en cançons i directes presents al feed, no en tota la discografia.

26 artistes tenen una o més poblacions assignades. Hey Zuri conserva Canals, l’Alcúdia de Crespins i Llanera de Ranes; Boom Boom Fighters, Mataró i Girona. Lluís Llach es vincula a Verges per l’arrelament des de la infància, distingint-lo del naixement a Girona. Vicky l’Arròs es vincula a Barcelona segons la localitat publicada per l’artista.

La revisió inicial va mantenir quatre casos a escala territorial. Posteriorment, l’editor ha concretat Brot Bord a Cardedeu i Still Ill a Alella, i ha confirmat Cactus Troop al Comtat i l’Alcoià i Bèrnia a l’Horta Sud. Aquests dos últims conserven l’escala comarcal sense coordenades puntuals. Les assignacions són manuals i protegides; la ràdio per proximitat continua pendent.

## Sisè lot de 30 artistes (11 d’octubre de 2026)

S’han revisat 30 artistes: 29 assignacions aplicades i PunkAIres pendent de confirmar població. No s’infereix l’origen pels títols de les cançons ni pel col·lectiu homònim Dràstik Punkaires. [Decisions, fonts i correccions editorials](revisions/2026-10-11-origens-lot-06.json).

Brot Bord queda a Cardedeu i Still Ill a Alella. Cactus Troop conserva el Comtat i l’Alcoià i Bèrnia l’Horta Sud, ara amb confirmació editorial. Les quatre entrades es protegeixen amb `assignmentSource: user-correction` i `locked: true`. Es preserven les altres 146 assignacions anteriors.

Xavi Sarrià es vincula a València per l’arrelament a Benimaclet, sense confondre’l amb el naixement a Barcelona. OKDW es vincula a Cubelles segons la presentació de Virts a la Universitat de Barcelona; Svetlana a Barcelona i All Crü a Sabadell segons les localitats publicades pels projectes. La ràdio per proximitat continua pendent.

## Setè lot de 30 artistes (11 d’octubre de 2026)

S’han aplicat 30 assignacions noves i s’han preservat íntegrament les 179 anteriors, incloses les correccions editorials. [Decisions i fonts](revisions/2026-10-11-origens-lot-07.json).

PunkAIres, que havia quedat pendent al sisè lot, s’ha retirat del catàleg i dels handles verificats per petició editorial. S’ha afegit a les exclusions permanents perquè les actualitzacions automàtiques no el reincorporin. El circuit de validació i purga retira el canal del feed i dels índexs derivats. La menció pendent del lot anterior es conserva només com a registre històric.

Batec conserva els dos municipis d’origen, Rubí i Almacelles. Da Souza queda a Mallorca i Autodestrucció vinculat al Montseny, sense coordenades puntuals. Amargor i Baixa Fidelitat queden vinculats a Barcelona i FP a Vic segons els perfils propis. Duble Buble s’assigna a l’Esquirol i Assot a Breda (la Selva). Coses s’assigna a Barcelona segons el relat de la formació de Jordi Fàbregas. La ràdio per proximitat continua pendent.
## Vuitè lot de 30 artistes (11 d’octubre de 2026)

S’han aplicat les 30 assignacions noves, corresponents a 32 canals, i s’han preservat íntegrament les 209 anteriors, incloses les correccions editorials. [Decisions i fonts](revisions/2026-10-11-origens-lot-08.json). Es mantenen el criteri de priorització per cançons i directes del feed i el bloqueig manual de totes les assignacions.

Icestorm s’assigna a Bigues i Riells del Fai, amb el nucli de Riells del Fai com a origen documentat per la biografia oficial i com a referència de coordenades. Nyandú s’assigna a Oristà i Pixamandúrries a Corçà, preservant respectivament la Torre d’Oristà i Casavells en els motius i les fonts. Les coordenades d’aquests dos municipis són les dels nuclis d’Oristà i Corçà, no les dels nuclis d’origen dels grups.

Pantaleó queda vinculat a Terrassa segons l’entrevista sobre els inicis del projecte, distingint aquesta vinculació de l’origen santcugatenc del seu impulsor. Vinnie Kairos es vincula a Arenys de Mar sense inferir-ne el lloc de naixement. Karda Fàstik s’assigna a Vic amb confiança mitjana, perquè la concreció municipal prové de la Viquipèdia; Enderrock en corrobora el context osonenc. Les altres 29 assignacions tenen confiança alta.

El registre suma 239 artistes, 380 canals i 113 poblacions, a més dels deu territoris que es conserven sense coordenades puntuals.

## Novè lot de 30 artistes (11 d’octubre de 2026)

S’han aplicat les 30 assignacions noves, corresponents a 40 canals, preservant íntegrament les 239 anteriors i totes les correccions editorials. [Decisions i fonts](revisions/2026-10-11-origens-lot-09.json).

Mainasons s’assigna a la Garriga, Tiger Menja Zebra a Granollers, Germà Negre a Banyoles, Mendra a Sant Feliu de Guíxols i Bars a Sabadell. Masvi queda vinculat a la Roca del Vallès segons la seva fitxa del Sona9. X-Fanekaes s’assigna a Montcada, a l’Horta Nord del País Valencià. El Pont d’Arcalís s’assigna a Soriguera, preservant l’explicació de Jordi Fàbregas sobre la trobada al pont on es va gestar el grup; les coordenades són una referència de la divisió municipal, no del pont.

Daltabaix conserva el Montseny a escala territorial. Bacora conserva la Safor i la Vall d’Albaida, sense coordenades puntuals: les dues fonts concordants no permeten corroborar la concreció a Crevillent d’un altre directori. Aquesta assignació i la del Grup de Folk tenen confiança mitjana. Les vinculacions de Vicens Martín Dream Big Band, Urbàlia Rurana i Les Testarudes no s’interpreten com l’origen comú de tots els integrants.

El registre suma 269 artistes, 420 canals, 118 municipis i 12 territoris. Dels 451 artistes del catàleg, en queden 182 sense assignació: 60 amb `active: true` i 122 amb `active: false`. Aquest estat és editorial del catàleg i no indica si el grup continua fent concerts. Les assignacions territorials compten com a revisades, encara que no concretin un municipi. El recompte és una fotografia del catàleg en aquesta revisió.

## Desè lot de 30 artistes (11 d’octubre de 2026)

S’han aplicat 30 assignacions noves, corresponents a 37 canals oficials i Topic, preservant íntegrament les 269 anteriors. [Decisions, fonts i casos ajornats](revisions/2026-10-11-origens-lot-10.json).

Herois de la Katalunya Interior s’assigna a Moià; Banda Neon queda vinculada a Figueres i Kiddi a la Roca del Vallès. El Pot Petit s’assigna a Castelló d’Empúries i Pep Puigdemont a Olot. Els Atrapasomnis queda vinculat a la Cellera de Ter segons la fitxa professional de la companyia, sense atribuir aquest origen a tots els músics. 2 Princeses Barbudes queda vinculat a Santa Maria de Merlès, pel nucli de Sant Pau de Pinós documentat al cens del Lluçanès; les coordenades són municipals.

La Tresca i la Verdesca s’assigna a Sant Adrià de Besòs: el trasllat posterior a Badalona i el primer concert a la Garriga es distingeixen del lloc de formació. Orquestra Mirasol conserva les vinculacions amb Barcelona i Sant Cugat del Vallès (Mira-sol). Trèvol conserva el Baix Llobregat, el Barcelonès i la Catalunya Nord a escala territorial; Coça conserva Mallorca, sense coordenades puntuals.

Els Bourbons i Electrotoylets continuen pendents de concretar l’atribució. ASSAC! té Barcelona documentada, però no s’ha aplicat a tot el canal compartit cerinobalzano: cal una correspondència per artista o vídeo. Aquests casos continuen inclosos en el recompte pendent.

El registre suma 299 artistes, 457 canals, 127 municipis i 15 territoris. Dels 451 artistes del catàleg, en queden 152 sense assignació aplicada: 30 amb `active: true` i 122 amb `active: false`. L’estat actiu és editorial del catàleg. Les assignacions territorials compten com a revisades. El recompte és una fotografia del catàleg en aquesta revisió.

## Onzè lot de 30 artistes (11 d’octubre de 2026)

S’apliquen 30 assignacions: 23 entrades actives i 7 inactives del catàleg. Es preserven les 299 assignacions anteriors. [Decisions i fonts](revisions/2026-10-11-origens-lot-11.json).

Saïm conserva Felanitx i Manacor; Solk, les vinculacions amb Reus, Tortosa i Vinaròs. Gato Pérez es vincula a Barcelona, Jordi Tonietti a Girona i Sau a Vilanova de Sau: no es confonen aquests arrelaments amb llocs de naixement o de primera formació. 2ES, identificat amb Edu Esteve, queda a Badalona.

Els canals compartits d’ASSAC!, The Cabrians i Pesta Porcina no reben un origen global; les seves procedències documentades requereixen una correspondència per artista o vídeo. Els Bourbons, Electrotoylets i Tornaveus continuen pendents d’aclariment. Club Social Carme és un cicle de directes, no un grup: continua al recompte brut pendent, però no se li atribueix l’origen dels intèrprets.

El registre suma 329 artistes, 491 canals, 136 municipis i 15 territoris. Queden 122 entrades sense assignació: 7 actives (6 artistes i el cicle Club Social Carme) i 115 inactives. Documentar els inactius no els reactiva.
