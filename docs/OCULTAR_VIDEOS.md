# Com ocultar correctament vídeos i cançons

Aquest document defineix el procediment obligatori perquè una cançó desaparegui realment de l'app i no reaparegui en regeneracions futures.

## Fonts de dades

- `data/feed.json`: feed actiu que carrega l'app. **No s'ha d'editar manualment per ocultar vídeos.**
- `data/hidden-videos.json`: registre d'IDs de YouTube ocults. El client el carrega i filtra aquests vídeos del feed, cerques i ràdios. El generador també el respecta.
- `scripts/ocultar_titols_castella.js`: regles persistents per artista/canal i títol. Serveixen per detectar la cançó actual i impedir que torni a entrar.
- `data/archive/channels/*.json`: arxiu històric per canal; no és el mecanisme d'ocultació.

## Regla crítica

**Afegir un títol a `scripts/ocultar_titols_castella.js` NO és suficient per ocultar una cançó que ja és visible.**

Després de canviar una regla cal executar:

```bash
node scripts/ocultar_titols_castella.js
```

Això busca les coincidències actuals a `data/feed.json` i afegeix els seus IDs a `data/hidden-videos.json`.

Des d'octubre de 2026, el workflow `.github/workflows/aplicar-videos-ocults.yml` ho executa automàticament quan canvia `scripts/ocultar_titols_castella.js` a `main` i commiteja `hidden-videos.json` si cal.

## Procediment per ocultar una cançó

1. Confirma artista, títol i, si cal, canal oficial i canal Topic.
2. Si és una exclusió persistent per títol, afegeix-la amb `afegeix([...canals], [...titols])` a `scripts/ocultar_titols_castella.js`.
3. Afegeix o actualitza un test a `tests/ocultar-titols-castella.test.js`.
4. Executa `node scripts/ocultar_titols_castella.js` (localment) o comprova que el workflow automàtic hagi acabat bé.
5. Verifica que l'ID real hagi aparegut a `data/hidden-videos.json`.
6. Verifica a l'app publicada que la cançó ja no apareix al perfil de l'artista, feed, cerca ni ràdio.
7. No donis la tasca per acabada només perquè la regla existeix.

## Cas puntual per ID

Si només cal ocultar un vídeo concret i no es vol una regla de títol, afegeix directament el seu ID de YouTube a `data/hidden-videos.json`. Evita duplicats.

## Diagnòstic si encara apareix

Comprova, en aquest ordre:

1. L'ID del vídeo visible és a `data/hidden-videos.json`.
2. El navegador rep la versió nova de `data/hidden-videos.json`; el service worker tracta aquest fitxer com a network-first.
3. El vídeo no és una còpia diferent amb un altre ID (p. ex. canal oficial vs Topic).
4. La regla inclou el `channelTitle` exacte de totes les fonts rellevants.
5. El workflow `Aplicar vídeos ocults` ha acabat correctament.
6. La publicació de Cloudflare correspon al commit que conté el nou `hidden-videos.json`.

## Criteri de finalització

Una ocultació només es considera completada quan:
- existeix la regla persistent, si escau;
- els IDs de les còpies actualment visibles són a `data/hidden-videos.json`;
- els tests passen;
- la versió publicada ja no mostra els vídeos.

Això evita el problema de tenir una regla correcta al codi però continuar mostrant la cançó actual.
