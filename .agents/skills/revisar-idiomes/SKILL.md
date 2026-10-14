---
name: revisar-idiomes
description: Revisa lots de cançons pendents de llengua a Segueix Música des de ChatGPT/Codex, sense API d’IA. Activa aquesta rutina quan l’usuari demani validar pendents, revisar les següents cançons o continuar un lot. No s’aplica a revisions de títols ni a noves altes d’artistes.
---

# Revisió de llengua amb recerca dins la sessió

Llegeix `docs/REVISIO_AUTOMATICA_IDIOMES.md`. El script només organitza, valida l’estructura i aplica decisions; TU llegeixes les fonts i decideixes. No invoquis altres models ni una API externa des d’un script. No deleguis al nou workflow cap judici lingüístic: només executa proves.

## Seqüència

1. Llegeix la branca vigent i l’estat real: `node scripts/revisar_idiomes_codex.cjs estat`. Reprèn el lot obert amb `prepara --limit=50`; usa el límit o artista demanat. No preparis 1.587 entrades d’un sol cop.
2. Llegeix el JSON del lot a `docs/revisions/idiomes-codex/`. Treballa només en els IDs sense `applied`. Conserva intactes `items`, `applied` i la identitat del lot; escriu només `decisions`.
3. Recupera context local amb `context --id=VIDEO_ID`. El resum de `pendents` i les metadades locals no certifiquen ni integritat ni llengua.
4. Busca i OBRE les fonts amb les eines disponibles a la sessió: lletra oficial de la cançó, web d’artista/segell, Viasona o altra font contrastable. Respecta restriccions d’accés. Una font trobada però no llegida és insuficient. No simulis eines absents ni baixis àudio/subtítols amb serveis no autoritzats.
5. Identifica artista, versió, disc i col·laboracions. Llegeix tota la lletra abans de conservar per `lletra-completa`. Una frase inequívocament cantada en una altra llengua pot justificar `fragment-no-catala`; no són suficients crèdits, noms propis o anuncis. Per `disc-documentat`, la font ha d’acreditar la llengua de l’edició concreta i cada ID s’hi ha de correspondre. Per `instrumental-documentat`, cal prova positiva de la versió, no absència de text.
6. Registra al lot una decisió per cada entrada realment examinada, seguint els exemples de la guia. No hi copiïs la lletra. No afirmis haver llegit íntegrament una lletra en validar documentalment un disc. La reutilització exigeix una decisió estricta prèvia i prova del mateix enregistrament; mai només `obra`, artista o títol.
7. Executa `aplica --lot=LOT --dry-run`, revisa recompte/diff i aplica sense `--dry-run` quan l’usuari hagi demanat la revisió. No cal demanar autorització una segona vegada per a les decisions incloses en la petició. El script admet lots parcials: deixa sense decisió allò encara no examinat.
8. Conserva els dubtes com a `pendent`, amb el motiu concret. Es desen com a examinats però NO desapareixen de `data/revisio-idiomes.json`. Els lots posteriors no els repeteixen fins a `--reintenta` o un canvi d’identitat.
9. Valida la integració: prova que els IDs amagats estan filtrats del catàleg i de la cerca. No editis allowlists o canals bloquejats per esquivar decisions editorials. Conservar la llengua no incorpora automàticament un vídeo absent ni anul·la altres restriccions; si falta al feed, informa-ho i segueix el protocol existent d’ingestió només dins l’autorització de l’usuari. No gastis quota YouTube per revisar la llengua.
10. Executa proves, desa JSON/Markdown del lot juntament amb els fitxers editorials alterats, i comprova el commit/PR. Si hi ha canvis concurrents de main, rellegeix i reaplica sobre la cua vigent, mai sobreescriguis dades per la força. Conclou: examinades, conservades, amagades, dubtes, pendents reals i estat de publicació.

En una sessió només amb connector GitHub i sense checkout, llegeix els mateixos registres i aplica la mateixa estructura i invariants en una còpia de treball. Publica un commit coherent amb control de SHA; no inventis que has executat el script o les proves si no ho has pogut fer. Amb Codex i checkout, utilitza el script.

Una ordre «continua» només continua aquesta feina si el context la identifica; no s’ha d’executar una revisió musical en converses alienes. Cada nova passada necessita una sessió/tasca de l’agent: no hi ha cap agent nocturn ni execució indefinida activada per aquests fitxers.
