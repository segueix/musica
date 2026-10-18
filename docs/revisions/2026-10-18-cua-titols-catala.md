# Cua d'idioma: acceptades pel títol en català (2026-10-18)

Petició de l'usuari: «Revisa la cua de 1619 i accepta les que tinguin títol en català».

- **Cua revisada:** 1.619 cançons pendents (les de la cua abans de la passada general, sense les ja amagades).
- **Mètode:** part del títol sense el nom de l'artista (`songPart()`); cada paraula es comprova amb hunspell (ca, es_ES, en_US). És català si té alguna paraula només catalana o una marca catalana (à, è, ò, ï, ü, ç, l·l, apòstrof) i cap paraula només castellana/anglesa ni marca estrangera (ñ, ¿, ¡, -ción…). Després, revisió manual: 165 títols catalans fets de paraules compartides (p. ex. «Sense tu», «Cada nit») s'hi han afegit i 18 (noms propis, títols en italià, anglès o francès) se n'han tret.
- **Acceptades (conserva):** 993, amb `criteri: 'titol-catala-autoritzat-usuari'` i `lletraIntegraVerificada: false` a `data/revisio-idiomes.json`. **No s'ha verificat la lletra.**
- **Continuen pendents:** 626 de la cua (279 amb paraules o marques estrangeres al títol, 347 amb títol neutre o dubtós: noms, paraules compartides, sigles).
- Llista completa (acceptades i les que resten, amb el motiu): `docs/revisions/2026-10-18-cua-titols-catala.json`.
