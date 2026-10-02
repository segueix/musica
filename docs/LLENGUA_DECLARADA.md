# Llengua declarada a YouTube (per tenir més anuncis en català)

A YouTube cada vídeo té dues llengües que l'artista pot declarar: la de **l'àudio** («Llengua del vídeo») i la del
**títol i la descripció**. Molts vídeos del catàleg no en tenen cap o en tenen una d'equivocada (sovint castellà o
anglès). Si estan ben declarades, YouTube i els anunciants que segmenten per llengua o pel context del vídeo tenen més
motius per mostrar-hi anuncis en català. **No ho garanteix**: la llengua dels anuncis també depèn de l'usuari i, sobretot,
de què hi hagi anunciants que paguin anuncis en català. Però és el que està a les mans dels artistes.

L'app no ho pot canviar: només ho pot fer cada artista des del seu compte (o la seva distribuïdora).

## Com es fa servir aquest document

1. Regenera l'informe amb el feed del dia: `node scripts/informe_llengua_declarada.js`. Actualitza la taula de sota i
   `docs/informes/llengua-declarada.csv` (una fila per cançó, amb l'enllaç directe a YouTube Studio).
2. Escriu a cada artista (Telegram `t.me/segueix`, correu o xarxes) amb el missatge de sota i la llista de les seves
   cançons (filtra el CSV per la columna `artista`).
3. Quan l'artista ho canviï, el proper feed ja ho portarà i l'artista sortirà de la taula en tornar a generar l'informe.

Es considera correcte: **català** (`ca`), **aranès** (`oc`) i **sense llengua** (`zxx`, instrumental). La columna
«Via distribuïdora» compta els temes publicats per una distribuïdora («Provided to YouTube by…», canals «- Topic»): en
aquests la llengua no es canvia a YouTube Studio sinó a la plataforma de la distribuïdora (DistroKid, CD Baby, The
Orchard…), en les metadades del llançament.

## Missatge per als artistes

> Hola! Som Segueix Música (segueix.github.io/musica), una app gratuïta que reuneix la música en català que hi ha a
> YouTube i on hi ha les vostres cançons.
>
> Us volem demanar un petit favor que us pot ajudar a vosaltres i a tot l'ecosistema: a YouTube, moltes de les vostres
> cançons no tenen declarat que són en **català**. Si ho indiqueu, YouTube les classifica millor (cerques, recomanacions)
> i els anunciants que volen anunciar-se en català les poden trobar.
>
> **Com es fa (2 minuts):**
>
> - **Per a les cançons que ja teniu penjades:** YouTube Studio → *Contingut* → obriu el vídeo → *Detalls* → *Mostra'n
>   més* → apartat *Llengua i certificació de subtítols* (*Language and captions certification*) → **Llengua del vídeo:
>   Català**, i a *Llengua del títol i de la descripció*, també **Català**. Deseu.
>   Si en teniu moltes, a *Contingut* podeu seleccionar-ne diverses i fer *Edita* per canviar-les de cop.
> - **Perquè les noves ja hi surtin:** YouTube Studio → *Configuració* → *Valors predeterminats de penjada* →
>   *Configuració avançada* → **Llengua del vídeo: Català** i **Llengua del títol i de la descripció: Català**.
> - **Si publiqueu amb una distribuïdora** (DistroKid, CD Baby, The Orchard…), indiqueu-hi el català com a llengua de
>   les lletres del llançament: és d'on YouTube treu la llengua dels temes de «- Topic».
>
> Us passem la llista de les cançons on falta, amb l'enllaç directe per editar cadascuna. Moltes gràcies!

## Estat actual

<!-- TAULA:INICI -->
_Generat el 2026-10-02 amb `node scripts/informe_llengua_declarada.js`: 3740 de 4900 cançons publicades tenen alguna llengua per corregir, de 132 artistes. Detall per cançó (amb l'enllaç a YouTube Studio): `docs/informes/llengua-declarada.csv`._

| Artista | Cançons per corregir | Sense català a l'àudio | Sense català al títol i la descripció | Via distribuïdora |
| --- | ---: | ---: | ---: | ---: |
| Companyia Elèctrica Dharma | 148 de 148 | 148 | 4 | 148 |
| Sau | 148 de 148 | 148 | 11 | 148 |
| Lluís Llach | 147 de 147 | 147 | 0 | 147 |
| Núria Feliu | 146 de 146 | 146 | 13 | 146 |
| Raimon | 141 de 141 | 141 | 11 | 141 |
| Sangtraït | 121 de 121 | 121 | 20 | 121 |
| Sisa | 113 de 113 | 113 | 13 | 113 |
| Whiskyn's | 100 de 100 | 100 | 54 | 100 |
| Marina Rossell | 99 de 109 | 43 | 92 | 0 |
| Ovidi Montllor | 93 de 93 | 93 | 9 | 93 |
| Carles Santos | 91 de 91 | 91 | 56 | 91 |
| Pau Riba | 90 de 90 | 90 | 34 | 90 |
| Els Pets | 86 de 86 | 86 | 11 | 50 |
| Inadaptats | 70 de 70 | 70 | 50 | 70 |
| Ocults | 57 de 57 | 57 | 24 | 57 |
| Quico Pi de la Serra | 52 de 52 | 52 | 18 | 52 |
| Ja t'ho diré | 50 de 50 | 50 | 9 | 50 |
| N'Gai N'Gai | 50 de 50 | 50 | 11 | 50 |
| Brams | 49 de 49 | 49 | 7 | 49 |
| Cesk Freixas | 49 de 49 | 49 | 15 | 49 |
| Xicu | 49 de 49 | 49 | 45 | 49 |
| Xanguito | 48 de 48 | 48 | 22 | 48 |
| Pastorets Rock | 45 de 45 | 45 | 1 | 0 |
| Xavier de Bétera | 45 de 45 | 45 | 2 | 0 |
| Duble Buble | 43 de 43 | 43 | 18 | 43 |
| Oques Grasses | 43 de 46 | 43 | 11 | 0 |
| Umpah-Pah | 43 de 43 | 43 | 36 | 43 |
| Fades | 38 de 38 | 38 | 9 | 38 |
| Paul Fuster | 38 de 38 | 38 | 36 | 38 |
| 31 FAM | 37 de 37 | 37 | 10 | 0 |
| Mishima | 34 de 41 | 34 | 4 | 0 |
| Flashy Ice Cream | 33 de 47 | 0 | 33 | 0 |
| Cactus | 32 de 35 | 32 | 0 | 0 |
| Xucu-pà | 32 de 32 | 32 | 10 | 32 |
| Gertrudis | 31 de 31 | 31 | 3 | 0 |
| Sara Roy | 31 de 34 | 31 | 14 | 0 |
| Guillem Ramisa | 30 de 30 | 30 | 4 | 30 |
| Júlia Colom | 29 de 29 | 29 | 3 | 0 |
| Triquell | 29 de 30 | 29 | 3 | 0 |
| La Madam | 28 de 28 | 28 | 18 | 28 |
| Aspencat | 27 de 28 | 27 | 1 | 0 |
| Svetlana | 27 de 31 | 27 | 0 | 0 |
| Alfred García | 26 de 26 | 26 | 21 | 0 |
| Anna Ferrer | 26 de 26 | 26 | 25 | 0 |
| Joan Dausà | 26 de 36 | 26 | 2 | 0 |
| Julieta | 26 de 28 | 23 | 14 | 0 |
| Kitsch | 25 de 30 | 21 | 10 | 0 |
| Judit Neddermann | 24 de 24 | 24 | 8 | 24 |
| Anna Andreu | 23 de 37 | 23 | 1 | 0 |
| Baya Baye | 23 de 37 | 13 | 19 | 0 |
| enMatu | 23 de 25 | 23 | 6 | 0 |
| Ernest Crusats | 23 de 24 | 23 | 1 | 0 |
| Mama Dousha | 23 de 47 | 23 | 0 | 0 |
| Sandra Monfort | 23 de 24 | 23 | 4 | 0 |
| Maria Jaume | 22 de 36 | 22 | 0 | 0 |
| Scorpio | 22 de 22 | 22 | 11 | 0 |
| Sopa de Cabra | 22 de 59 | 22 | 0 | 0 |
| Jo Jet i Maria Ribot | 21 de 31 | 21 | 0 | 0 |
| Miki Núñez | 21 de 21 | 21 | 13 | 0 |
| Gusset | 20 de 21 | 20 | 12 | 0 |
| Minibús intergalàctic | 20 de 20 | 20 | 0 | 0 |
| dani6ix & IZZKID | 18 de 32 | 18 | 0 | 0 |
| Hey Zuri | 18 de 18 | 18 | 0 | 0 |
| Lal'Ba | 18 de 21 | 18 | 0 | 0 |
| Mar Pujol | 18 de 18 | 18 | 1 | 0 |
| Senyor Oca | 18 de 18 | 14 | 18 | 0 |
| En Rick | 17 de 19 | 17 | 0 | 0 |
| Auxili | 16 de 32 | 16 | 0 | 0 |
| Figa Flawas | 16 de 38 | 5 | 11 | 0 |
| Lax'n'Busto | 16 de 16 | 16 | 11 | 0 |
| P.A.W.N. Gang | 16 de 46 | 0 | 16 | 0 |
| Ven'nus | 16 de 26 | 12 | 4 | 0 |
| Dan Peralbo i El Comboi | 15 de 15 | 15 | 0 | 0 |
| Orxata Sound System | 15 de 15 | 15 | 1 | 0 |
| Antònia Font | 14 de 15 | 14 | 2 | 0 |
| Cloe Riembau | 14 de 15 | 14 | 2 | 0 |
| Els Catarres | 14 de 41 | 14 | 0 | 0 |
| La Ludwig Band | 14 de 31 | 14 | 0 | 0 |
| Suu | 14 de 19 | 13 | 8 | 0 |
| Vittara | 14 de 14 | 14 | 0 | 0 |
| Bèrnia | 13 de 15 | 13 | 0 | 0 |
| Llum | 13 de 13 | 13 | 5 | 0 |
| Ouineta | 13 de 13 | 13 | 3 | 0 |
| Al·lèrgiques al Pol·len | 12 de 12 | 12 | 1 | 0 |
| Gossos | 12 de 12 | 12 | 3 | 0 |
| KOP | 12 de 12 | 12 | 1 | 0 |
| Maria del Mar Bonet | 12 de 13 | 12 | 2 | 0 |
| Mushkaa | 12 de 33 | 6 | 12 | 0 |
| Remei de Ca la Fresca | 12 de 15 | 12 | 0 | 0 |
| Mariona Escoda | 11 de 14 | 11 | 0 | 0 |
| okdw | 11 de 34 | 0 | 11 | 0 |
| Roger Mas | 11 de 13 | 11 | 2 | 0 |
| Au Rora | 10 de 10 | 10 | 5 | 0 |
| Cristina Monllau | 9 de 9 | 9 | 1 | 9 |
| Jofre Bardagí | 9 de 10 | 9 | 0 | 0 |
| L'arannà | 9 de 10 | 9 | 1 | 0 |
| Daveu | 8 de 8 | 8 | 4 | 0 |
| Orfeó Gracienc | 8 de 12 | 8 | 0 | 0 |
| Crim | 7 de 44 | 7 | 0 | 0 |
| Gavina.mp3 | 7 de 7 | 7 | 2 | 0 |
| Orella d'Ós | 7 de 10 | 7 | 0 | 0 |
| Ebri Knight | 6 de 36 | 3 | 4 | 0 |
| Pla Moguda | 6 de 6 | 6 | 0 | 0 |
| Celobert | 5 de 11 | 5 | 0 | 0 |
| Guineu | 5 de 21 | 5 | 0 | 0 |
| Joan Colomo | 5 de 6 | 5 | 2 | 0 |
| Subliminal | 5 de 5 | 5 | 0 | 0 |
| Elo | 4 de 4 | 4 | 0 | 0 |
| Pol Bordas | 4 de 38 | 1 | 3 | 0 |
| Renaldo & Clara | 4 de 26 | 4 | 0 | 0 |
| Alosa | 3 de 12 | 3 | 0 | 0 |
| Ayryn | 3 de 5 | 3 | 3 | 0 |
| Ceaxe | 3 de 4 | 3 | 1 | 0 |
| Derbi Junior | 3 de 3 | 3 | 0 | 0 |
| El Diluvi | 3 de 47 | 3 | 1 | 0 |
| La Fúmiga | 3 de 45 | 0 | 3 | 0 |
| Maig | 3 de 25 | 2 | 1 | 0 |
| miquel | 3 de 29 | 0 | 3 | 0 |
| Paula Montalbán | 3 de 7 | 3 | 3 | 0 |
| Feliu Ventura | 2 de 2 | 2 | 1 | 0 |
| Joan Manuel Serrat | 2 de 2 | 2 | 0 | 0 |
| Naina | 2 de 15 | 2 | 0 | 0 |
| Reïna | 2 de 9 | 2 | 0 | 0 |
| The Demencials | 2 de 4 | 2 | 0 | 0 |
| ZOO | 2 de 38 | 0 | 2 | 0 |
| Buhos | 1 de 5 | 0 | 1 | 0 |
| Dàmaris Gelabert | 1 de 22 | 1 | 0 | 0 |
| Júlia Cruz | 1 de 1 | 1 | 1 | 0 |
| La Mousse | 1 de 2 | 0 | 1 | 0 |
| Pau Vallvé | 1 de 8 | 0 | 1 | 0 |
| Sexenni | 1 de 39 | 1 | 0 | 0 |
| Sodi | 1 de 4 | 1 | 0 | 0 |
<!-- TAULA:FI -->
