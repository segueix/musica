# Ràdios de temporada

Vigent des del 24 d'octubre de 2026 (petició de l'usuari). A Inici, al davant del bloc «ara mateix» (abans
d'«Acabades de sortir»), hi ha la targeta de la ràdio de l'època de l'any. La primera és la **«Ràdio de tardor»**, del
23 de setembre al 30 de novembre; la de Nadal (de l'1 de desembre al 6 de gener) s'hi afegirà igual.

## Què hi ha

| Fitxer | Què és |
| --- | --- |
| `data/radios-temporada.json` | Les ràdios: nom, període (`from` / `to` en «MM-DD»; pot passar de l'any), text, la selecció **manual** (`songs`, amb l'ID, la cançó i el grup temàtic) i els vídeos (`videos`, generats) |
| `scripts/generar_radios_temporada.js` | Escriu `videos` a partir del catàleg públic (`loadCatalog()`; amb `outsideCatalog`, l'excepció de més avall): les dades que l'app necessita per fer sonar cada cançó sense baixar l'arxiu de l'artista. `--check` només comprova que totes les cançons hi són. No consulta YouTube |
| `js/features/season-radio.js` | La targeta d'Inici (patró 2; `portada.js` crida `seasonRadio.cardHtml()`) i el botó «Engega la ràdio» |

En tocar «Engega la ràdio» sona una ràdio tancada amb aquelles cançons (`musicQueue.startCategoryRadio()`, com la d'una
categoria pròpia, amb el nom «Ràdio de tardor»): el motor les ordena segons el gust, «Barreja» es queda dins seu i,
quan s'acaben, torna a començar sense les darreres que han sonat. Els artistes i les cançons amagades no hi surten.

## Ràdio de tardor

122 cançons de 93 artistes, triades a mà, en set grups: els mesos i els colors de la tardor («Octubre del 24»,
«Novembre» d'Obrint Pas i d'Umpah-Pah, «Setembre» d'Els Pets, «Octubre» de Blaumut, «Tardor» de Clara Peya, «Les fulles
mortes» i «Claror de tardor» de Marina Rossell…), fulles i boira, **Castanyada, Tots Sants i bolets** («Agavé i les
castanyes», «Moniatos», «Tots Sants», «Boletaires» de Sisa, «Tocat del bolet», «Amic boletaire» de Panellet…), pluja i
tempesta («A fora plou», «Temps de pluja» de Serrat, «Plou al carrer» de Gossos, «Aquesta pluja» d'Antònia Font…), fred,
grisor i enyor, el vent i Xesco Boix.

- **Sense música infantil** (Ambauka, Mainasons, Dàmaris Gelabert…), **llevat de Xesco Boix** (petició de l'usuari:
  `allowInfantil`): «Bon vent ve», «A dins del bosc», «Sense vent» i «Plou i fa sol».
- **Excepció al catàleg públic** (`outsideCatalog`, petició de l'usuari del 24/10/2026, només per a aquesta ràdio):
  1. cançons que passen tots els filtres però queden fora pel límit de 21 per artista (`loadCatalog(root, { unlimited:
     true })`): «Novembre» d'Obrint Pas, «Temps de pluja» de Serrat…;
  2. pistes de les discografies «Tema» (`data/music-topic-catalog.json`), d'artistes de l'app, no amagades ni
     restringides i sense versions instrumentals, **només si l'artista és de confiança de llengua**
     (`data/artistes-vigilats-idioma.json`) **o és a `outsideCatalog.languageOk` amb el motiu** (Xesco Boix, «Plou i fa
     sol»). D'aquestes pistes no se sap si YouTube en permet la inserció (el feed no les ha consultades): si alguna no
     sona, cal treure-la de la llista.

## El fons

Un dibuix de fulles de tardor sobre marró clar (`img/fulles-tardor.svg`, un mosaic de 480 × 480 que es repeteix), **sense
caràtules**: omple tota la caixa a qualsevol mida (`.pt-season--tardor`, `background-repeat: repeat`). Un vel del mateix
marró (a l'esquerra a l'ordinador, a baix al mòbil) fa que el text fosc es llegeixi; el botó és marró fosc.

## Afegir o treure cançons

1. Edita `songs` de la ràdio a `data/radios-temporada.json` (l'ID de YouTube; `cancó` i `grup` només són per llegir-ho).
2. `node scripts/generar_radios_temporada.js` (avisa de les que no hi pot posar o són infantils).
3. `npx vitest run tests/radio-tardor.test.js`.

Una ràdio nova (Nadal) és una entrada més a `radios` amb el seu període. Fora de tots els períodes, Inici no mostra res.

Proves: `tests/radio-tardor.test.js`; opt-in `node tests/browser/verificar-radio-tardor.js` (amb `TARDOR_SHOTS=` fa
captures). CSS: bloc «Ràdio de temporada» al final de `css/portada.css`.
