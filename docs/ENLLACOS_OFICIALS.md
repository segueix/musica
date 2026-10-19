# Web oficial i Facebook a la fitxa d’artista

La fitxa mostra un únic enllaç al costat de YouTube: **Web oficial**, o **Facebook** quan no hi ha una web verificada. S’obre en una pestanya nova. Un artista pendent no mostra cap botó buit.

Les dades són a `data/origens-artistes.json`, dins de `artists[artistKey].officialLinks`. S’aprofiten el mapatge de canals i la càrrega del catàleg d’orígens: el canal oficial i el Tema comparteixen l’enllaç, sense més peticions ni APIs.

El Service Worker consulta aquest catàleg amb xarxa primer i còpia local si no hi ha connexió, per evitar que una còpia anterior a la incorporació dels enllaços amagui el botó durant tota la sessió.

## Com revisar i afegir un enllaç

1. Consultar les `sources` de l’origen, les fonts de `data/artistes-musica.json` i les descripcions revisades de YouTube.
2. Llegir el destí i contrastar identitat, repertori, població o canals. Un mitjà, una agència, una enciclopèdia o un homònim no són la web oficial.
3. Prioritzar una web pròpia llegible. Si no n’hi ha cap de verificable, contrastar el perfil oficial de Facebook. Una consulta bloquejada no demostra que una web hagi desaparegut.
4. Desar `url`, `status: "verified"`, `checkedOn` (AAAA-MM-DD), `method`, `sources` (URLs de l’evidència) i `basis` (justificació breu) sota `website` o `facebook`. No publicar candidats automàticament.
5. Per suspendre un enllaç, canviar l’estat a `pending` o `rejected`. El client només mostra `verified`, amb prioritat per `website`. No modificar la verificació de l’origen geogràfic per validar una web.
6. Executar `npm test -- tests/artist-official-links.test.js tests/artist-origin.test.js tests/artist-page.test.js` i `npm run lint`.

Les URLs han de ser HTTPS, sense credencials ni ports especials. Facebook ha de ser un perfil canònic, sense paràmetres de seguiment, publicacions, login ni botons de compartir. La interfície no mostra les metadades internes de revisió.

## Primera passada — 19 d’octubre de 2026

45 artistes: 43 webs i 2 Facebook. D’aquests, 43 ja tenen canals assignats (67 canals); Pau Alabajos i Mariona Sagarra conserven l’enllaç preparat per quan s’indexin, sense alterar-ne l’estat ni donar-los d’alta. S’han aprofitat webs directes identificables a les fonts existents. No és una cerca exhaustiva dels 529 artistes de la base; 479 identitats d’origen queden pendents d’enllaç.

El registre `docs/revisions/2026-10-19-enllacos-oficials.json` conserva els destins, l’evidència, els casos pendents i els problemes de consulta. Mainasons queda sense botó perquè el web llegit inclou promoció d’apostes aliena al projecte infantil. Els Facebook d’Aspencat i Borriana Big Band es contrasten amb les fonts existents i els perfils públics indexats; la lectura directa de Facebook està bloquejada i les webs històriques no s’han pogut consultar.

No s’afegeix cap workflow ni actualització diària. La revisió és editorial i manual. Quan es completi un altre lot, cal actualitzar les dades i conservar-ne les evidències al repositori.
