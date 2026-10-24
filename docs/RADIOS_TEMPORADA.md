# Ràdios de temporada

Vigent des del 24 d'octubre de 2026 (petició de l'usuari). A Inici, al davant del bloc «ara mateix» (abans
d'«Acabades de sortir»), hi ha la targeta de la ràdio de l'època de l'any. La primera és la **«Ràdio de tardor»**, del
23 de setembre al 30 de novembre; la de Nadal (de l'1 de desembre al 6 de gener) s'hi afegirà igual.

## Què hi ha

| Fitxer | Què és |
| --- | --- |
| `data/radios-temporada.json` | Les ràdios: nom, període (`from` / `to` en «MM-DD»; pot passar de l'any), text, la selecció **manual** (`songs`, amb l'ID, la cançó i el grup temàtic) i els vídeos (`videos`, generats) |
| `scripts/generar_radios_temporada.js` | Escriu `videos` a partir del catàleg públic (`loadCatalog()`): les dades que l'app necessita per fer sonar cada cançó sense baixar l'arxiu de l'artista. `--check` només comprova que totes les cançons hi són. No consulta YouTube |
| `js/features/season-radio.js` | La targeta d'Inici (patró 2; `portada.js` crida `seasonRadio.cardHtml()`) i el botó «Engega la ràdio» |

En tocar «Engega la ràdio» sona una ràdio tancada amb aquelles cançons (`musicQueue.startCategoryRadio()`, com la d'una
categoria pròpia, amb el nom «Ràdio de tardor»): el motor les ordena segons el gust, «Barreja» es queda dins seu i,
quan s'acaben, torna a començar sense les darreres que han sonat. Els artistes i les cançons amagades no hi surten.

## Ràdio de tardor

65 cançons de 60 artistes, triades a mà entre les del catàleg públic, en sis grups: els mesos i els colors de la tardor
(«Octubre del 24», «Novembre», «Darrer diumenge d'octubre», «Conte de tardor»…), fulles i boira, **Castanyada, Tots Sants
i bolets** («Agavé i les castanyes», «Moniatos», «Tots Sants», «Tocat del bolet»…), pluja i tempesta («A fora plou», «No
plou», «Plou», «Dies de pluja»), fred, grisor i enyor, i el vent.

- **Sense música infantil** (Ambauka, Mainasons, Dàmaris Gelabert…), **llevat de Xesco Boix** (petició de l'usuari:
  `allowInfantil`). Al catàleg públic no té cap cançó de castanyada; hi són «Bon vent ve» i «A dins del bosc».
- Fora del catàleg públic (el límit de 21 cançons per artista, `docs/CATALEG_21_NOVETATS.md`) n'hi ha més de tardor a
  les discografies dels canals «Tema»: «Plou i fa sol» de Xesco Boix, «Tardor», «Octubre», «Novembre» i «Boira» de Clara
  Peya, «Plou al carrer» de Gossos, «Aquesta pluja» d'Antònia Font, «La Castanyera» de Dàmaris Gelabert (infantil)… No
  hi entren: l'app només fa sonar el catàleg públic.

## Afegir o treure cançons

1. Edita `songs` de la ràdio a `data/radios-temporada.json` (l'ID de YouTube; `cancó` i `grup` només són per llegir-ho).
2. `node scripts/generar_radios_temporada.js` (avisa de les que no són al catàleg públic o són infantils).
3. `npx vitest run tests/radio-tardor.test.js`.

Una ràdio nova (Nadal) és una entrada més a `radios` amb el seu període. Fora de tots els períodes, Inici no mostra res.

Proves: `tests/radio-tardor.test.js`; opt-in `node tests/browser/verificar-radio-tardor.js` (amb `TARDOR_SHOTS=` fa
captures). CSS: bloc «Ràdio de temporada» al final de `css/portada.css`.
