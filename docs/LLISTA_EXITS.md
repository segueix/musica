# Llista d'èxits setmanal

Vigent des del 22 d'octubre de 2026. A Inici, després d'«Acabades de sortir», hi ha la **Llista d'èxits**: les 40
cançons en català de Segueix que més visualitzacions han guanyat a YouTube en una setmana.

## Com es calcula

- **Font:** les visualitzacions (`viewCount`) que el feed diari ja demana a YouTube. **No fa cap consulta més**: no
  gasta quota.
- **Fotografia setmanal:** `data/llista-exits-base.json` guarda, per a cada vídeo del feed, les visualitzacions i
  **l'hora real de la lectura** (`lastCheckedAt` del canal a `data/music-channel-polling.json`). Cada canal es consulta
  cada 1, 3 o 7 dies segons l'activitat (`docs/CONSULTES_PER_ACTIVITAT.md`), per això el creixement es divideix pel temps
  real entre les dues lectures i es porta a set dies (factor limitat entre 0,5 i 2). Si el canal no s'ha tornat a
  consultar des de la fotografia anterior, la cançó no hi entra aquella setmana (no s'inventa cap xifra).
- **Estrenes:** una cançó que no era a la fotografia anterior i s'ha publicat després compta totes les seves
  visualitzacions. Una cançó vella que acaba d'entrar al feed (canal nou) no hi entra fins a la setmana següent.
- **Una cançó, una entrada:** el videoclip, la pista del canal «Tema» i el directe d'una mateixa cançó d'un artista
  (mateixa clau de títol, `songKey()` de `scripts/lib/canal_tema.js`) **sumen junts**; la representa la versió que més ha
  crescut.
- **Regles:** com a màxim **3 cançons per artista**; un mínim de **100 visualitzacions** setmanals; **sense música
  infantil** (es reprodueix en bucle i ompliria la llista). Només entren les cançons del catàleg públic
  (`loadCatalog()` de `scripts/generar_web_estatica.cjs`: sense amagades, restringides, Shorts ni artistes rebutjats).
- **Moviments:** posició anterior, «Nova» (mai hi havia estat), «Torna» (hi havia estat les últimes 26 setmanes),
  millor posició i setmanes a la llista (`history` del fitxer base). La primera edició no en mostra.

## Quan es publica

`scripts/generar_llista_exits.js` s'executa cada dia dins «Actualitzar feed musical», després del feed i de l'arxiu,
amb `continue-on-error` (un error no impedeix publicar el feed). Només fa una llista nova **els divendres** (si fa
almenys cinc dies de l'anterior) o, si un divendres no s'ha pogut fer, en passar-ne vuit (`shouldPublish()`). Els altres
dies no escriu res. Els dos fitxers van al mateix commit de dades.

Ordres manuals:

```bash
node scripts/generar_llista_exits.js --dry-run                # mostra la llista sense escriure res
node scripts/generar_llista_exits.js --force                  # la publica ara
node scripts/generar_llista_exits.js --base-ref=<commit>      # setmana anterior = feed d'aquell commit (git)
LLISTA_MOSTRA=40 node scripts/generar_llista_exits.js --dry-run
```

La primera edició (22/10/2026) es va fer amb `--base-ref=c058bc04` (feed del 15/10). Si el fitxer base es perd, el
primer torn en desa un de nou i la llista torna a sortir al cap d'una setmana (o amb `--base-ref`).

## Fitxers

| Fitxer | Què és | Qui el llegeix |
| --- | --- | --- |
| `data/llista-exits.json` | La llista publicada: període, 40 entrades amb el vídeo, el creixement i els moviments | l'app (`js/features/hits-chart.js`) |
| `data/llista-exits-base.json` | Fotografia de la setmana anterior i historial de posicions | només l'script |
| `scripts/lib/llista_exits.js` | Lògica pura (fotografia, creixement, agrupació, moviments) | l'script i les proves |

## A l'app

`js/features/hits-chart.js` (patró 2): `portada.js` crida `hitsChart.cardHtml()` després d'«Acabades de sortir»; la
primera vegada hi deixa una secció amagada i la substitueix quan arriba `data/llista-exits.json`. Deu files (dues
columnes a ≥ 900 px), «Mostra les 40», «Com es fa» i «Escolta-la». Tocar una fila fa sonar la selecció «Llista d'èxits»
(`musicQueue.playSelection()`) a partir d'aquella cançó; en acabar continua com a ràdio de l'estil. Les cançons
d'artistes amagats no hi surten. CSS: bloc «Llista d'èxits setmanal» al final de `css/portada.css`.

Proves: `tests/llista-exits.test.js`; opt-in `node tests/browser/verificar-llista-exits.js` (amb `EXITS_SHOTS=` fa
captures).
