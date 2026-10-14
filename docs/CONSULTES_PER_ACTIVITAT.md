# Consulta de canals de Música segons l’activitat

Petició del 14 d’octubre de 2026. Aplicació a `scripts/update_music_feed.js`, amb el calendari local de `scripts/lib/activitat-canals-musica.js`.

| Última publicació del canal | Freqüència de consulta |
| --- | --- |
| Fa menys d’un any | Cada dia |
| Entre un i tres anys, inclosos els límits | Cada tres dies |
| Fa més de tres anys | Cada set dies |
| Sense data fiable o canal nou | Cada dia fins a tenir una lectura fiable |

El tram de dos a tres anys no estava especificat; s’ha inclòs en el de tres dies. Les dates es comparen per dies de calendari a Europe/Madrid, amb anys naturals i tractament del 29 de febrer. No es confon l’any original del disc amb la data de publicació a YouTube.

## Funcionament

El workflow existent fa una sola passada diària a les 20 h de Madrid. Dins d’aquesta passada, només consulta els canals amb torn vençut. Aquesta petició substitueix el cron provisional de dies parells; els cinc manteniments complementaris continuen sense calendari automàtic. No s’ha creat cap workflow ni s’ha avançat cap ingesta per provar el canvi.

L’estat generat es desa a `data/music-channel-polling.json`, amb `latestPublishedAt`, `lastCheckedAt`, `intervalDays` i `nextCheckOn` per ID de canal. També registra l’última lectura completa dels Tema i un resum de canals consultats/ajornats/fallits. Es publica amb la resta de dades, també al workflow manual. El fitxer es crea en el primer torn ordinari: la primera execució consulta tots els canals per establir una base fiable; no es dedueix la inactivitat del feed musical filtrat.

L’activitat es pren de `contentDetails.videoPublishedAt` de la primera pàgina de pujades, abans de descartar vídeos per idioma, format, durada o selecció editorial. La data d’inserció a una llista no serveix. Les seleccions manuals continuen admetent exclusivament els vídeos revisats, però també comproven l’activitat del canal publicador. Una data absent, invàlida o futura manté la consulta diària. Un canal sense publicacions recents que torna a publicar passa a consulta diària quan se’n detecta la publicació.

Els canals ajornats no generen consultes de metadades, vídeos, pujades, pàgines profundes ni fonts de llançaments. Conserven fitxa, cançons, visualitzacions i revisions, amb els filtres editorials globals habituals. Una fallada de lectura conserva el repertori complet i no avança el torn; si fallen detalls de vídeos nous, el generador avorta i el workflow no publica. Les baixes continuen passant pel purgador sense API. L’estat d’un canal retirat desapareix en guardar el següent resultat.

La lectura completa d’un Tema es fa quan han passat almenys set dies, al primer torn de consulta del canal: amb un interval de tres dies, pot ser al novè dia. Es desa la data de lectura completa perquè un torn perdut no l’ajorni indefinidament. Els canals nous o `MUSIC_TOPIC_FULL_READ=1` mantenen la lectura completa; `MUSIC_TARGET_CHANNELS` força únicament els canals explícits. La discografia guardada continua governant els canals oficials i evitant duplicats quan un dels dos no es consulta aquell dia.

La freqüència és per canal de YouTube: si un artista té un canal oficial i un Tema, cadascun segueix la seva activitat real. Les visualitzacions del feed es renoven en consultar el canal; l’actualització separada de l’historial continua manual durant el mode d’estalvi.

## Comprovació i límits

`node --test scripts/test_activitat_musica.cjs scripts/test_workflow_quota.cjs`

Les proves natives executen el generador real sobre còpies temporals, amb respostes de YouTube simulades: límits, canvi d’hora, inicialització, reactivació, errors, preservació de més de cent cançons, Topic, seleccions manuals i absència de consultes als canals ajornats. Les proves Vitest rellevants de catàleg, quota, seleccions, llançaments i filtres també passen. No s’ha fet cap consulta real a YouTube.

GitHub pot retardar o perdre un esdeveniment programat; els torns vençuts es recuperen a la propera execució. L’estalvi real de minuts d’Actions i quota de YouTube s’ha de mesurar després de la primera inicialització: una passada diària té un cost fix encara que consulti menys canals. No es garanteix arribar a final d’octubre amb els minuts disponibles.
