# Simulació del motor de selecció musical

> Generat per `node scripts/simular_seleccio_musical.js` amb el catàleg de `data/feed.json` (3991 cançons i directes elegibles de 142 artistes), rellotge fixat a 2026-09-30 i 100 llavors fixes.
> **Són resultats de simulació amb usuaris sintètics sobre el catàleg real. No són dades de producció i no mesuren retenció ni satisfacció.** «Abans» és una aproximació de la política anterior (candidates per data de pujada, una per artista, 1 antiga de cada 5 i alternança d’artista) sense l’ordre de Música TV, que depèn del navegador.

## Catàleg

| Antiguitat real | Cançons | Part |
| --- | --- | --- |
| Darrers 24 mesos | 875 | 21.9 % |
| De 2 a 8 anys | 1800 | 45.1 % |
| Més de 8 anys / catàleg històric confirmat | 1316 | 33.0 % |

Cançons amb any original d’evidència (`Released on`, ℗ o manual): 1282 de 3991. Reedicions (pujades més de 2 anys després de la gravació): 854.

Pujades dels darrers 30 dies: 35; d’aquestes, estrenes de debò segons el motor: 16. Per data de pujada, «Acabades de sortir» n’hauria presentat 35 com a estrena.

## Usuari nou: 20 primeres cançons de la ràdio general

| Mètrica | Abans (aproximació) | Després (motor) |
| --- | --- | --- |
| Darrers 24 mesos | 86.1 % | 65.0 % |
| De 2 a 8 anys | 2.1 % | 25.0 % |
| Històriques | 11.8 % | 10.0 % |
| Cues amb més de 2 històriques a les 20 primeres | 36/100 | 0/100 |
| Màxim d’històriques a les 20 primeres | 3 | 2 |
| Parelles d’històriques seguides | 0 | 0 |
| Artistes diferents a les 20 primeres (mitjana) | 20.0 | 19.9 |
| Màxim de cançons d’un artista a les 20 primeres | 1 | 2 |

Objectiu orientatiu: 65 / 25 / 10. Els límits (2 històriques i mai seguides) s’apliquen a la cua final.

Mostra de cua (usuari nou, llavor 43; `R` recent, `M` mitjana, `H` històrica):

1. [M] Ernest Crusats — Ernest Crusats - FLORS A LA CARA
2. [R] La Fúmiga — La Fúmiga - GRÀCIES PER TANT / Official Music Video
3. [H] Whiskyn's — Isabel
4. [R] Ceaxe — 3ESTIUS - CEAXE
5. [R] Buhos — Buhos - Gràcies (Videoclip oficial) 
6. [R] Ginestà — GINESTÀ amb NIL MOLINER - Amb qui estaràs?
7. [M] Manel — Manel - La Jungla (videoclip oficial)
8. [R] Els Catarres — Els Catarres - DIUMENGE SENSE DRAMA (2026)
9. [H] Ocults — Com un Mallorquina
10. [R] Jo Jet i Maria Ribot — JJMR - ROSSINYOL (videoclip oficial)
11. [R] REMEI DE CA LA FRESCA — Remei de ca la Fresca - Aiguaneu/ La insurrecció que ve (directe al te
12. [M] Joan Dausà — PER NOSALTRES I ELS DE DALT - JOAN DAUSÀ
13. [R] Sexenni — Sexenni i Miki Núñez - Televisió (Videoclip Oficial)
14. [R] PLA MOGUDA — LA FATXA - PLA MOGUDA (Videoclip Oficial)
15. [R] alfredgarcia — Alfred García, Alvaro Soler - Estrella (Official)

## Seguiments, cors i preferència per música antiga (usuaris sintètics)

| Escenari | Cues amb l’artista a les 20 primeres | Màx. cançons seves a les 20 primeres | Històriques permeses (de 20) |
| --- | --- | --- | --- |
| The Tyets — sense seguir (3 altres artistes seguits) | 39.0 % | 2 | 2 |
| The Tyets — seguit | 100.0 % | 2 | 2 |
| Quico Pi de la Serra — usuari nou | 1.0 % | 1 | 2 |
| Quico Pi de la Serra — un sol clic a l’historial | 2.0 % | 1 | 2 |
| Quico Pi de la Serra — seguit + 4 cors i repeticions | 100.0 % | 2 | 12 (preferència forta cap a música antiga) |

Seguir un artista n’augmenta la presència però el límit d’artista es manté (segona columna). En un escenari amb un únic artista antic seguit, només amb senyals forts (seguiment, cors i repeticions voluntàries) s’amplia el cupo d’històriques; un sol clic a l’historial no el canvia.

## Cançons que retornen (una cançó concreta amb baixa puntuació de base, a l’historial des de fa 30 dies)

| Senyal | Probabilitat de sortir a les 20 primeres |
| --- | --- |
| Només a l’historial (visita antiga) | 0.0 % |
| Una escolta qualificada i finalitzada | 0.0 % |
| Cinc escoltes voluntàries qualificades | 67.0 % |
| Amb cor | 38.0 % |

Mostra de «Torna-hi» (senyals sintètics: cors i escoltes voluntàries):

- L’has tornat a triar: Pi de la Serra — La lluna blanca
- L’has tornat a triar: Ginestà — GINESTÀ amb NIL MOLINER - Amb qui estaràs?
- L’has tornat a triar: La Mousse — La Mousse - Cant De La Sirena (live)
- Una de les teves preferides: La Ludwig Band — La Ludwig Band al Festival Vida i al Canet Rock

## Categories amb poca música actual

| Categoria | Cançons al catàleg | Longitud de la cua | Recents/mitjanes/històriques (20 primeres) | Degradació |
| --- | --- | --- | --- | --- |
| Pop | 1939 | 40 | 13/5/2 | proporcions habituals |
| Jazz / Blues | 137 | 40 | 5/2/13 | ampliat amb catàleg històric i s’avisa |
| Clàssica | 41 | 40 | 0/0/20 | pocs artistes: cançons seguides del mateix artista i s’avisa |
| Cançó d'autor | 571 | 40 | 12/6/2 | proporcions habituals |
| Infantil | 24 | 24 | 0/4/16 | pocs artistes: cançons seguides del mateix artista i s’avisa |

## Rendiment (Node, no mòbil)

Selecció d’una cua de 40 sobre 3991 candidates: 23 ms de mitjana. El context (antiguitat, popularitat, claus de gravació) es calcula una vegada per feed.
