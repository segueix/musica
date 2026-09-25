# Progrés d'indexació de Viasona

Aquest document resumeix l'estat de la incorporació progressiva de l'**Enciclopèdia de Viasona** a Segueix Música.

La font de control és `data/viasona-index.json`. La base principal continua sent `data/artistes-musica.json` i les exclusions es registren a `data/music-exclusions.json` i `docs/ARTISTES_EXCLOSOS.md`.

## Metodologia

1. Recollir artistes de Viasona per lots alfabètics.
2. Comprovar si ja existeixen a Segueix Música.
3. Revisar els nous candidats segons el criteri editorial del projecte.
4. Incorporar els acceptats a la base principal.
5. Incorporar els exclosos als dos registres d'exclusions.
6. Enriquir progressivament els acceptats amb YouTube, MusicBrainz, Wikidata, gènere i territori.

Els lots tenen un objectiu orientatiu de **50 artistes**. No cal completar totes les dades d'un artista per poder avançar al següent: primer es garanteix la cobertura del catàleg i després es fa l'enriquiment.

## Estat actual

- **Font:** Viasona — Enciclopèdia
- **Lletra en curs:** A
- **Lot en curs:** `A-01`
- **Objectiu del lot:** 50 artistes
- **Entrades descobertes al lot:** 8
- **Ja existien a Segueix Música:** 5
- **Nous pendents de revisió:** 3
- **Nous acceptats en aquest procés:** 0
- **Nous exclosos en aquest procés:** 0
- **Casos dubtosos:** 0

### A-01

| Artista / grup | Estat | Base principal |
|---|---|---|
| Al Tall | Ja indexat | Sí |
| Antònia Font | Ja indexat | Sí |
| Aspencat | Ja indexat | Sí |
| Atupa | Ja indexat | Sí |
| Auxili | Ja indexat | Sí |
| Aucell Cantaire | Pendent de revisió | No |
| Atzembla | Pendent de revisió | No |
| Anegats | Pendent de revisió | No |

## Lletres

| Lletra | Estat |
|---|---|
| A | 🔄 En curs — A-01: 8/50 |
| B–Z | ⏳ Pendents |

## Regla de continuació

La propera sessió ha de continuar des d'`A-01` sense tornar a començar la lletra A. Primer s'amplia el lot fins a 50 entrades verificables; després es passa a `A-02`.

Si una entrada ja existeix a `artistes-musica.json`, es marca com a `already-indexed`. Si és nova, queda `pending-review` fins que es decideixi `accepted`, `excluded` o `needs-review`.
