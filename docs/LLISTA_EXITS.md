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

**Des del 24/10/2026, la setmana va de dilluns a diumenge i la llista es regenera sola cada diumenge a la tarda**
(petició de l'usuari: la llista del 15 al 22 d'octubre encara sortia el 24). Ho fa l'acció **«Llista d'èxits
setmanal»** (`.github/workflows/llista-exits-setmanal.yml`, `13 17 * * 0` Europe/Madrid, també manual), que executa
`scripts/generar_llista_exits.js` i publica `data/llista-exits.json` i `data/llista-exits-base.json` amb
`publicar_dades.sh`; en acabar es torna a publicar la web («Publicar web estàtica Música» l'escolta). No fa servir cap
secret ni consulta YouTube: fa servir les visualitzacions del darrer feed diari (el de dissabte a les 20 h). El feed diari
ja no la fa.

`shouldPublish()` publica un diumenge si fa almenys cinc dies de l'anterior o, si un diumenge no s'ha pogut fer, en passar-ne
vuit. `chartWeek()` dona el període (`from` = dilluns, `to` = diumenge): mira el dia anterior, de manera que un diumenge a
la tarda o un dia entre setmana donen la setmana en curs i un dilluns, la que acaba de tancar. La llista del 19 al 25
d'octubre es va fer el dissabte 24 amb `--base-ref=5e1be6e1` (feed del dilluns 19); l'acció la torna a fer el diumenge
1 de novembre (del 26 d'octubre a l'1 de novembre).

Ordres manuals:

```bash
node scripts/generar_llista_exits.js --dry-run                # mostra la llista sense escriure res
node scripts/generar_llista_exits.js --force                  # la publica ara
node scripts/generar_llista_exits.js --base-ref=<commit>      # setmana anterior = feed d'aquell commit (git); conserva els moviments
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
primera vegada hi deixa una secció amagada i la substitueix quan arriba `data/llista-exits.json`. Les 40 cançons (dues
columnes a ≥ 900 px) fan scroll dins del marc blanc i la capçalera, fins a «Escolta-la», queda fixa a dalt (sense «Mostra les 40»). «Com es fa» és un botó rodó «i» al costat del títol (`[data-hc-info]`) que obre un quadre flotant (`#hcInfo`, penja de `.hc__title-row`; es tanca amb la ×, Esc o un clic fora). La secció va dins d'un **marc blanc** amb un degradat del color de fons de la configuració (`--color-background`): a dalt aclarit amb un 20 % de blanc i a baix el mateix color de la pàgina, on s'hi fon i les tres primeres porten una franja llima. Tocar una fila fa sonar la selecció «Llista d'èxits»
(`musicQueue.playSelection()`) a partir d'aquella cançó; en acabar continua com a ràdio de l'estil. Les cançons
d'artistes amagats no hi surten. CSS: bloc «Llista d'èxits setmanal» al final de `css/portada.css`.

Proves: `tests/llista-exits.test.js`; opt-in `node tests/browser/verificar-llista-exits.js` (amb `EXITS_SHOTS=` fa
captures).
