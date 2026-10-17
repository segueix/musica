# Catàleg: 21 populars i novetats de 12 mesos

Petició del 17 d’octubre de 2026. Base de dades del commit `4457558f5748dd25b012ee7454f47b5db5ed8ffa`.

## Regla

- Es trien les 21 cançons amb més visualitzacions de cada artista. Oficial i Tema comparteixen límit; els homònims no es fusionen. Si té menys de 21 cançons, s’hi inclouen totes les elegibles.
- S’hi afegeixen les novetats de menys de 12 mesos que no estiguin entre aquestes 21, de la més recent a la més antiga. Quan una novetat entra al rànquing, deixa d’aparèixer a Novetats i ocupa la posició que li correspon. No es duplica ni crea una plaça 22 permanent.
- Una novetat fora del top caduca a l’aniversari de la publicació. Una cançó del top es conserva encara que sigui antiga. El 29 de febrer caduca el 28 de febrer de l’any següent.
- La data original completa preval sobre la de pujada a YouTube. Quan només se sap que l’any original és anterior al de la pujada, aquesta pujada no es presenta com a novetat. Sense evidència original s’utilitza la data de publicació disponible; no s’inventa una data musical.
- Els directes entren per visualitzacions dins del mateix top 21. No obtenen places addicionals per ser recents. Conserven el tipus `live_song`, que alimenta «En directe» i la ràdio de directes. Les actuacions en canals convidats només s’atribueixen amb els enllaços editorials existents.
- S’exclouen Shorts, contingut no musical, vídeos ocults/restringits i fragments de menys d’un minut, coherent amb l’elegibilitat de l’app. La unitat de recompte és un ID de vídeo únic; no es fusionen gravacions diferents només perquè comparteixen títol.

## Presentació i publicació

La fitxa manté la #1 al costat de la imatge de l’artista a l’ordinador i sota la capçalera al mòbil. Després mostra Novetats i les posicions #2–#21. Novetats desapareix quan és buida. Es conserven les caràtules, les columnes i els controls actuals.

La selecció es recalcula en cada generació estàtica amb les visualitzacions disponibles. El paquet publicat limita feed, historial, arxius per canal, pool de ràdio, índexs de cerca, pàgines de cançons, rutes i sitemaps. El fitxer d’ocults incorpora la selecció perquè el client rebutgi contingut de snapshots anteriors i novetats caducades; no afegeix una petició a l’arrencada.

Les dades mestres del repositori es conserven per poder recalcular el top en el futur. El límit és del catàleg públic, no una eliminació irreversible de l’arxiu editorial. Les metadades de discos es mantenen per resoldre actuacions convidades; no es recupera la interfície de discos.

La reserva de pistes Tema passa de 180 a 366 dies per cobrir un any complet, també en anys de traspàs; el filtre públic aplica l’aniversari exacte. No s’ha executat cap consulta a YouTube ni cap actualització manual. Les visualitzacions noves continuen arribant segons el calendari existent: les posicions no s’actualitzen en temps real.

## Recompte verificat

| Concepte | Total |
| --- | ---: |
| Artistes | 434 |
| Canals oficials/Tema | 655 |
| Cançons dels rànquings de popularitat | 6.606 |
| Novetats addicionals fora dels rànquings | 554 |
| **Cançons úniques al catàleg publicat** | **7.160** |
| Directes, inclosos en el total anterior | 199 |
| Fitxers del paquet estàtic complet | 12.225 |

El recompte anterior de pàgines era de 14.612 cançons. La reducció a 7.160 inclou aplicar els filtres de restriccions i durada que ja utilitza l’app. El total canviarà quan entrin publicacions, canviïn visualitzacions o caduquin novetats. El recompte de fitxers correspon al paquet de la web, no a la carpeta de desenvolupament amb dependències i historial git.

Proves automatitzades: límit compartit, promoció, caducitat, empats, homònims, directes, convidats, fitxa amb/sense novetats, fonts públiques, memòria cau i regeneració. Construcció completa i validació del paquet superades. La comprovació visual amb Chromium no s’ha pogut executar en aquesta sessió perquè la descàrrega del navegador no està disponible; no s’afirma una nova puntuació PageSpeed.
