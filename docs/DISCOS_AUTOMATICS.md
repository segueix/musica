# Discos automàtics als perfils

La fitxa s'obre amb una caràtula per disc identificat. En triar-ne un es veuen les pistes disponibles; «Discos» torna a la vista inicial i «Totes les cançons» restaura el repertori. Les peces sense assignació estan a «Altres cançons». La cerca continua funcionant sobre tot el repertori des de la vista Discos.

## Artistes actuals i incorporacions noves

`update_music_feed.js` ja executa `mergeAlbumCatalog()` abans d'eliminar les descripcions dels vídeos. El mateix procés s'aplica a qualsevol artista nou, sense un registre manual addicional i sense incrementar les consultes a YouTube.

1. Prioritat per als llançaments validats a `llancaments-musicals.json`, amb les pistes i l'ordre revisats.
2. Extracció del disc de les metadades Topic o d'una declaració explícita a la descripció oficial: `Album: …` o una frase de pertinença amb el títol del disc entre cometes. Una menció ambigua no s'utilitza.
3. Un disc inferit necessita dues cançons diferents. `pendingAlbums` conserva les troballes d'una sola cançó entre actualitzacions parcials; dos vídeos de la mateixa cançó no completen un disc.
4. Relació d'altres vídeos amb un disc només si coincideixen l'artista i el títol de manera única. Es treuen marques d'àudio/vídeo oficial i crèdits delimitats; es conserven directes, remescles i col·laboracions.
5. Es conserven les exclusions i els controls d'idioma existents. Una relació amb un disc no és una aprovació lingüística ni una autorització per incorporar pistes noves.

Un llançament verificat sense pistes disponibles té fitxa amb l'avís «Pistes pendents d'incorporar». No es pot reproduir fins que arriben les pistes. Els discos inferits sense cap pista disponible continuen amagats. Els recomptes corresponen a les pistes conegudes; no garanteixen una discografia completa.

## Reconstrucció sense xarxa

```sh
node scripts/reconstruir_discos_musica.js --dry-run
node scripts/reconstruir_discos_musica.js --evidence=docs/revisions/2026-10-14-discos-evidencies.json
```

L'script reutilitza feed, historial, catàleg anterior, ocults, restriccions i registre de llançaments. Les evidències opcionals només enriqueixen vídeos ja presents del mateix canal. No escriu el feed ni incorpora vídeos. No engega Actions ni altera els torns d'actualització.

La reconstrucció del 14/10 afegeix 280 relacions a 133 discos existents, dos discos inferits nous (*La nostra resposta* de Kòdul i *Despertem!* d'Eskassa Llibertat) i aplica el llançament ja validat *Flaires de Barcelunya* de Gato Pérez. Les deu pistes d'aquest últim continuen pendents del feed.

Sense metadades suficients no hi ha una agrupació automàtica fiable: es conserven les cançons sense disc i es poden afegir fonts verificades més endavant. La caràtula compartida, per si sola, no determina un disc.
