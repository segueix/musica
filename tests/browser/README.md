# Verificacions en navegador

Dues eines **opt-in**, cap de les dues dins de `npm test`:

| Eina | Què verifica | Quan executar-la |
|---|---|---|
| `verificar-sw.js` | Service Worker: caches, offline, migració, avís d'actualització | Després de tocar `sw.js` o `scripts/actualitzar_versio_sw.js` |
| `verificar-reproductor.js` | Reproductor al mòbil: posició en obrir el vídeo, finestreta flotant i filera d'icones del header | Després de tocar el reproductor, `updatePlayerPosition()` o el comportament del header |
| `verificar-tv.js` | Experiència TV: vista ancorada al reproductor, pantalla completa mantinguda entre vídeos i TV dels programes de l'usuari | Després de tocar les TV, `focusTVPlayerViewport()`, `swapLivePlayerVideo()`, `buildProgramQueue()` o el mode llista |

Totes tres comparteixen requisits (`playwright-core` + un Chromium) i s'ometen amb codi
de sortida 0 si `playwright-core` no està instal·lat.

```bash
node tests/browser/verificar-reproductor.js
```

Comprova, amb viewport i user-agent d'Android, que en obrir un vídeo des del llistat el
reproductor queda alineat amb el seu forat (no tapa el títol), que la filera d'icones del
header s'amaga en obrir el vídeo i torna en fer scroll cap amunt, i que la finestreta
flotant només apareix en fer scroll cap avall.

```bash
node tests/browser/verificar-tv.js                  # mòbil
TV_TEST_DESKTOP=1 node tests/browser/verificar-tv.js  # escriptori
```

Comprova que, en engegar una TV (Segueix TV, TV de categoria o TV de canal) i a cada
canvi automàtic de vídeo, la vista salta a la part superior i s'hi manté mentre s'espera
que el vídeo nou comenci, que el reproductor no sura mai per damunt del header ni queda
en finestreta flotant, i que un gest d'scroll de l'usuari mana per damunt de l'ancoratge.

L'última part comprova que, mirant en pantalla completa, el vídeo següent hi continua
sense recrear el reproductor. Com que YouTube no es pot carregar aquí, se serveix un
succedani local a la mateixa URL d'embed que parla el mateix protocol de `postMessage`
(handshake `listening`, `onStateChange`, `loadVideoById`).

El bloc final crea un programa de prova d'un canal de categoria `mitjans` i comprova que
té botó TV (a la targeta i al perfil) i que la seva televisió s'engega amb els episodis
del programa, inclosos els de l'arxiu del canal.

---

## Verificació del Service Worker en navegador

Eina **opt-in** per verificar `sw.js` end-to-end en un Chromium real. **No** forma part
de `npm test` (Vitest): el comportament del SW —migració de caches, offline, avís
d'actualització, stale-while-revalidate— només es pot comprovar de debò en un navegador
amb l'API de service workers.

## Requisits

No són dependències del projecte (per mantenir `npm install` lleuger):

```bash
npm i -D playwright-core      # client de Playwright; NO baixa navegadors
```

A més cal un binari de Chromium. Si no és a la ubicació per defecte de Playwright,
indica'l amb la variable `CHROMIUM_PATH`.

## Ús

```bash
node tests/browser/verificar-sw.js
# o amb ubicacions personalitzades:
CHROMIUM_PATH=/ruta/al/chrome SW_TEST_PORT=8130 node tests/browser/verificar-sw.js
```

Si `playwright-core` no està instal·lat, l'script s'omet amb codi de sortida 0 (no
falla). Amb tot instal·lat, surt amb codi 0 si tot passa, o 1 si alguna comprovació falla.

## Què comprova

Arrenca un servidor estàtic local (amb hooks en memòria per simular canvis, sense
tocar cap fitxer real) i, en un context de navegador net:

1. **Visita neta** — s'instal·la el SW; existeixen `static-<hash>` i `data-v1`, i
   `data-v1` conté `feed.json`.
2. **Precache complet** — el cache estàtic conté els ~25 scripts d'`index.html`
   (garanteix que l'app arrenca offline).
3. **Offline** — amb la xarxa tallada, l'app arrenca sencera des del cache.
4. **Migració** — un cache antic (`mytube-v417`) i l'`static-<hash>` vell s'eliminen
   a l'`activate` en desplegar una versió nova.
5. **Stale-while-revalidate** — en canviar una dada al servidor, el 1r load serveix
   la versió vella (stale) i el 2n ja serveix la nova.
6. **Actualització de codi** — en canviar `CACHE_VERSION`, apareix l'avís d'actualització
   de l'app i, en acceptar-lo, hi ha **una sola** recàrrega (sense bucle).
7. **Feed** — es carrega i renderitza amb normalitat.

## Quan executar-la

Després de qualsevol canvi a `sw.js` o a `scripts/actualitzar_versio_sw.js`.
