# Revisió del 23 d’octubre de 2026

## Entrades noves

S'han examinat les 65 entrades afegides el 23/10/2026, amb context local, cerques i lectura de les fonts accessibles. Són entrades noves a la cua, no necessàriament estrenes del dia.

| Lot | Examinades | Conservades | Amagades | Pendents |
| --- | ---: | ---: | ---: | ---: |
| [lot-0011](idiomes-codex/lot-0011.json), Good Jan | 54 | 19 | 6 | 29 |
| [lot-0012](idiomes-codex/lot-0012.json), altres artistes | 11 | 2 | 3 | 6 |
| Total | 65 | 21 | 9 | 35 |

Les decisions s'han validat amb `aplica --dry-run` i aplicat amb `scripts/revisar_idiomes_codex.cjs`. Els JSON conserven fonts, dates, coincidència de versió, motius i estat anterior de cada ID. No s'hi han copiat lletres.

Els dubtes continuen a la cua: fonts bloquejades o sense lletra, transcripcions incompletes, remescles, directes i redireccions a altres edicions. Una fitxa de disc o un fragment del cercador no s'ha comptat com una lletra llegida. No s'ha escoltat àudio ni s'han descarregat transcripcions.

El lot 0012 agrupa les onze entrades del dia que no són de Good Jan; s'ha preparat amb l'esquema i les empremtes del gestor, perquè el selector ordinari no filtra per data. No se n'ha alterat cap identitat després de preparar-lo.

## Passada general

Auditoria estructural de tota la cua i de tots els lots, sense donar per verificades les lletres de les 1.376 entrades restants:

- Cap ID pendent invàlid o duplicat; cap duplicat al registre d'ocults.
- Cap ID simultàniament pendent i ocult, ni pendent i amb decisió editorial.
- Els lots 0001–0007 encara mostraven 176 entrades sense `applied`: 157 ja tenen una decisió editorial posterior i no són a la cua; 19 continuen pendents. S'han arxivat els set lots amb l'ordre `arxiva`, conservant íntegrament `items`, `decisions` i `applied`. Les 19 pendents queden disponibles per preparar lots vigents.
- S'han preservat totes les decisions i exclusions anteriors. La cua només ha perdut les 30 entrades resoltes en aquesta sessió; els 35 dubtes es mantenen.

Estat final: **1.376 pendents**, de les quals **78 examinades sense proves suficients** i **1.298 per examinar**. Cap lot obert obsolet. El tancament d'un lot no implica haver resolt els seus dubtes.

## Integració i proves

- Les 9 exclusions noves queden fora del catàleg calculat amb `loadCatalog()` i de la cerca executada amb `YouTubeAPI.searchVideos()` carregant el registre real d'ocults.
- 9 de les 21 cançons conservades són al catàleg actual; 12 no hi són. No s'han modificat allowlists, canals, feed, historial ni índexs, ni s'ha gastat quota de YouTube.
- `node --test scripts/test_revisio_codex.cjs`: superat.
- Proves específiques d'idiomes, cançons, catàleg i cerca: 70/70 superades.
- `npm run lint`: 0 errors, 180 avisos.
- `npm test`: 1.473 superades i 6 fallides. Les mateixes 6 fallades es reprodueixen en un worktree net del commit base `847d0d5a8edbce20b7adea1d9f023b4475930305`: origen d'Arjau; afinitats Ska/Reggae, Punk i Heavy/Metal; data «Avui»; prova de reproducció de llistes al mòbil. No s'ha modificat codi per tapar aquestes incidències.

Conservades absents del catàleg actual: `C3LH-c2BIxo`, `Ad0Q8Zwk_j8`, `ucnqscjctsk`, `EqB93sFUh-c`, `J-k1IiRxRBI`, `u6CHqHetk8o`, `LZVjt1DSjTU`, `rJbxJybKNAI`, `GAvOvMUUR7Y`, `K0t4R-3cADk`, `hG1AMcaKaa4`, `e-umVfIecVM`.

## Publicació

Aquest canvi és editorial. No s'ha iniciat ni reintentat cap Action ni cap desplegament. Integrar les decisions a main no significa que la web ja les hagi publicat: s'incorporaran amb la propera publicació ordinària segons la política de quota.

