# Rendiment del paquet estàtic — 16/10/2026

Aquest primer apartat documenta les millores preparades a la PR 146 abans del seu desplegament. La integració i el segon lot mòbil es documenten més avall. La revisió del tercer informe detecta una publicació duplicada que sobreescriu el paquet optimitzat; vegeu l’últim apartat abans d’interpretar les puntuacions públiques. El diagnòstic parteix dels dos informes PageSpeed aportats per l’usuari per a `https://segueix.github.io/musica/`, capturats el 16/10/2026 a les 12:27 CEST: mòbil 28 i escriptori 36. Aquests són resultats de la versió pública anterior, no del paquet optimitzat.

## Canvis

- L’observador de TV deixa de reaccionar a cada canvi d’icona o targeta de tota la pàgina. Només observa les transicions del mode TV i no llegeix el desplaçament fora d’aquest mode.
- Lucide només transforma els placeholders pendents dins del contenidor demanat. El paràmetre anterior `el` no limitava l’abast i recreava SVG ja dibuixats.
- La fusió del feed utilitza un Set d’identificadors en lloc d’una cerca lineal per cada cançó. La preparació del catàleg es divideix en lots de 40, cedint el fil entre lots. La neteja de títols reutilitza els noms d’artista preparats, amb memòria limitada a 2.048 entrades.
- Feed, filtres i taxonomia es descarreguen en paral·lel; els filtres s’apliquen abans de publicar les dades. L’historial ampli no bloqueja la portada.
- Es retira la pantalla d’introducció amb espera artificial. El registre del Service Worker comença en acabar l’arrencada, mantenint la política d’activació ajornada.
- Les lectures de dimensions de les fileres s’agrupen abans de les escriptures i s’ajornen les de seccions fora de pantalla. La barra inferior aprofita les dimensions del ResizeObserver.
- Les miniatures de targetes utilitzen resolucions adequades. Es retira el gran fons decoratiu dinàmic de la ràdio, que els informes identificaven com a LCP; es conserven les tres portades petites. La icona de 192 px deixa de contenir una imatge de 1.024 px.
- Els scripts clàssics es carreguen amb `defer`, respectant-ne l’ordre. Les peticions de fonts s’unifiquen, amb `display=optional` i càrrega no bloquejant.
- El build minifica JS/CSS sense canviar els noms globals i compacta JSON. Distribueix versions fixades de Lucide, LZ, Sortable i QR amb les llicències. Lucide inclou només les 164 icones referenciades; QR es carrega quan es demana, amb deduplicació i reintent.
- La portada llegeix una taxonomia compacta d’artistes generada durant el build. La base editorial completa es conserva per a les funcions que la necessiten.

## Mides comprovades

| Recurs | Paquet optimitzat |
| --- | ---: |
| Lucide, gzip | 9.757 bytes (l’informe anterior indicava aproximadament 90 KiB transferits) |
| Taxonomia inicial, gzip | 30.742 bytes |
| app.js, gzip | 87.736 bytes |
| styles.css, gzip | 22.867 bytes |
| portada.css, gzip | 21.111 bytes |
| icon-192.png | 17.725 bytes; abans 83.104 |

El paquet complet té 19.563 fitxers i 84.649.743 bytes. És el catàleg publicable complet, no la descàrrega inicial. Els valors gzip es calculen localment; la transferència real depèn de la compressió de l’allotjament.

## Mesura local comparable

Chromium 153, pantalla mòbil de 390 × 844, CPU alentida 4×, context nou, Service Worker desactivat i servidor local amb gzip. Imatges i fonts externes bloquejades en les dues versions; les biblioteques CDN de la base es resolen amb còpies locals de les mateixes versions. S’observa l’arrencada durant 9 segons. Per tant, aquesta prova compara el treball de JavaScript i la disposició de la pantalla; **no és Lighthouse, ni mesura el LCP públic o la xarxa mòbil real**.

| Indicador | Fase 4 | Paquet final |
| --- | ---: | ---: |
| Suma del temps de cada tasca llarga per sobre de 50 ms | 5.856 ms | 2.481 ms (−58%) |
| Tasca més llarga | 3.541 ms | 903 ms |
| CLS observat | 0,237 | 0,034 |

Les repeticions intermèdies donaven aproximadament 2,3–2,7 segons de bloqueig. Encara hi ha tasques llargues en preparar i pintar el catàleg; no s’afirma que el bloqueig sigui zero ni que la puntuació arribi a 100. El FCP local final és de 664 ms davant de 332 ms a la base: aquesta prova no demostra una millora de totes les mètriques.

## Verificació

- 343 proves Vitest disponibles al checkout: 338 superades i 5 fallades reproduïdes a la base de fase 4. Afecten una etiqueta de navegació, un hash SW literal, una constant antiga de compartició, un títol del feed real i un detector d’ordre dels scripts. No s’han canviat dades editorials per fer passar una prova.
- 87 proves natives de quota i revisió superades; 11 YAML vàlids. Lint conserva els cinc errors anteriors de `data.js` i `home-sections.js`, sense errors nous.
- Instal·lació neta amb el lockfile, compilació i validació del paquet complet superades.
- Navegador sobre el paquet minificat: cerca d’Obeses, selecció de Rock i activació del botó de ràdio, navegació a Descobreix, descàrrega i importació del mateix JSON i càrrega real del QR local. Sense errors JavaScript, avisos d’icones o peticions a les API retirades. El QR no es demana en arrencar. La prova no reprodueix àudio de YouTube.
- El netejador de títols manté exactament el mateix resultat per als 6.604 vídeos del feed comparat.

## Construcció i següent comprovació pública

```sh
npm ci --ignore-scripts
node node_modules/esbuild/install.js
npm run build:static
npm run validate:static
```

Cal servir `_site/` per provar l’app: les biblioteques locals i la taxonomia es generen durant la construcció. No s’han de servir els fitxers font com si fossin el paquet acabat. El workflow fa aquesta instal·lació dins de l’única feina de publicació existent. Es mantenen calendari, torns, permisos i filtres de quota; no s’ha disparat cap Action.

Després de publicar aquesta branca, cal repetir PageSpeed mòbil/escriptori sobre la URL final i validar una actualització des d’una PWA antiga, la reproducció real i les rutes públiques. La migració a Cloudflare continua sent una fase separada.

## Segon lot: prioritat mòbil, després de publicar la PR 146

La PR 146 es va fusionar a `main` amb `1108c51754c381b645a5474da34cda23f97f0ed8`. El nou informe mòbil aportat per l’usuari, capturat el 16/10/2026 a les 13:14:55, ja mostra 58 punts, FCP 3,2 s, LCP 12,7 s, TBT 250 ms i CLS 0. L’usuari informa de 78 punts a l’ordinador; l’objectiu d’aquest segon lot és acostar-hi el mòbil, sense donar-ho per assolit abans de mesurar la versió publicada.

El candidat LCP identificat és el text de l’avís de consentiment, ocult fins que arriba i s’inicialitza el JavaScript de l’app. A més, continuaven baixant miniatures `maxresdefault` per a «Torna-hi», mosaics de llistes i retrats que utilitzen una coberta de vídeo.

Canvis del segon lot:

- L’avís es mostra des de l’HTML inicial amb un script petit que llegeix la decisió existent. No canvia el text, les opcions ni les condicions de consentiment. No carrega YouTube. Conserva l’últim toc anterior a la inicialització i el transmet als controladors habituals quan estan preparats. Les decisions acceptada/rebutjada, inclosos els formats antics, continuen amagant l’avís; un valor invàlid o emmagatzematge inaccessible el mostren.
- El feed comença a descarregar-se amb `fetch`, `cache: no-store` i prioritat baixa mentre arriben els scripts. El client consumeix aquesta resposta una sola vegada; si falla, segueix el camí habitual de reintent/fallback. La taxonomia té una precàrrega `as=fetch`. Comprovada una sola petició del feed i conservada la política de frescor. El generador del SW exclou explícitament les precàrregues `as=fetch` del shell, mantenint dades i codi en caches diferents.
- Les cobertes de «Torna-hi» i de llistes utilitzen `mqdefault` i càrrega diferida; els retrats que fan servir vídeos utilitzen `hqdefault`. Les imatges d’altres proveïdors conserven la URL. La portada comprovada no demana cap `maxresdefault`.
- Música no ofereix Shorts, tot i conservar-ne HTML ocult antic. El nucli deixa d’injectar-ne el complement visual i, per tant, els seus observadors i les seves peticions. Això evita la petició sobrera a `/js/features/shorts-polish.js` fora de `/musica/` i, en un desplegament a l’arrel, la descàrrega redundant del feed que hauria provocat.

Comparació local amb Chromium 153, pantalla 390 × 844, CPU 4×, latència de 150 ms i límit de baixada de 200.000 bytes/s. Es compara el paquet de la PR 146 amb aquest lot, tots dos sobre un servidor limitat a `/musica/`, amb gzip, context nou, SW desactivat i imatges/fonts externes bloquejades:

| Indicador local | PR 146 | Segon lot |
| --- | ---: | ---: |
| LCP del text de consentiment | 4.128 ms | 824 ms |
| Inici de la petició del feed | 4.246 ms | 594 ms |
| Final de l’arrencada | 12.167 ms | 9.561 ms |
| Bloqueig acumulat observat | 1.771 ms | 1.442 ms |

No són valors Lighthouse ni comparables directament als 12,7 segons del PDF. Els errors d’imatge induïts per la prova provoquen fallback i moviments de layout; no s’utilitza aquest assaig per afirmar una millora de CLS, qualitat visual de les portades o transferència real d’imatges. No s’amaga contingut per manipular la mesura: el mateix avís es presenta abans i el catàleg també acaba abans.

Verificació del segon lot: 55 proves dirigides superades; bateria disponible de 357 proves (352 superades i les mateixes 5 fallades anteriors), 87 proves natives de quota/revisió i paquet complet validat. Lint conserva els cinc errors anteriors. Navegador: cerca, selecció de ràdio, Descobreix, exportació/importació JSON i QR sota demanda; sense errors JavaScript ni avisos d’icones. Prova específica bloquejant la descàrrega d’app.js: els tocs prematurs d’acceptar, rebutjar i informació es recuperen correctament, i un consentiment desat no torna a mostrar-se. No s’ha executat cap Action ni s’han canviat els workflows o la ingesta.

Després d’integrar i publicar aquest segon lot cal tornar a executar PageSpeed mòbil. Encara no es pot afirmar que hagi arribat a 78 punts.


## Tercer informe: la publicació per branca sobreescriu el paquet

Informe aportat: https://pagespeed.web.dev/analysis/https-segueix-github-io-musica/rlu6z5jxl6?form_factor=mobile, capturat el 16/10/2026 a les 14:09:52 CEST, Lighthouse 13.5.0, Moto G Power i Slow 4G.

| Indicador públic mòbil | Segon informe | Tercer informe |
| --- | ---: | ---: |
| Rendiment | 58 | 60 |
| FCP | 3,2 s | 3,8 s |
| LCP | 12,7 s | 12,1 s |
| TBT | 250 ms | 170 ms |
| CLS | 0 | 0 |

El tercer informe mostra Speed Index 6,3 s, accessibilitat 97, bones pràctiques 96 i SEO 100. El candidat LCP continua sent `p.cookie-banner__text`. El bloqueig millora, però el FCP empitjora; no s’atribueix causalitat a una única comparació. Els 78 punts d’escriptori són la referència comunicada per l’usuari, no una mesura nova feta aquí.

La consola de l’informe registra HTTP 404 per `data/music-taxonomy.json` i les biblioteques `js/vendor/lucide.js`, `sortable.js` i `lz-string.js`. Detecta JS i CSS sense minificar: estalvi estimat de 115 KiB i 23 KiB respectivament. `app.js` transfereix 129,3 KiB, `styles.css` 34 KiB i `portada.css` 37,6 KiB, per sobre del paquet construït. Això invalida considerar aquest informe com una mesura del paquet optimitzat complet.

La configuració de Settings → Pages s’ha comprovat al navegador: **Source = Deploy from a branch, main, / (root)**. El darrer desplegament indicat és el workflow automàtic `pages build and deployment`. Per al mateix commit `0f9ce839769537625cbe152272f6529ce0be6490`:

- Publicador propi: https://github.com/segueix/musica/actions/runs/38898346140; desplegament optimitzat acabat a les 12:08:02 UTC.
- Publicador automàtic de branca: https://github.com/segueix/musica/actions/runs/38898345117; desplegament acabat a les 12:08:26 UTC, després del propi.

El segon sobreescriu el primer amb els fitxers font. El build local correcte i un workflow verd no garantien que la web pública conservés l’artefacte. `actions/configure-pages@v5` llegeix la configuració existent; no converteix automàticament un lloc existent al mode `workflow`.

Correcció preparada:

1. Abans d’instal·lar dependències, el publicador llegeix `build_type` amb el token existent i s’atura amb una instrucció clara si no és `workflow`. Només fa GET; no canvia configuració ni permisos.
2. La validació del paquet exigeix explícitament taxonomia i les quatre biblioteques locals, inclòs el QR carregat sota demanda.
3. Després de desplegar, `comprovar_publicacio_estatica.cjs` compara SHA-256 d’onze respostes públiques amb el paquet: portada, manifest amb commit, SW, taxonomia, biblioteques i JS/CSS principals. Conserva les queries de versió de l’HTML, rebutja 404, redireccions, HTML de fallback i bytes d’una versió diferent. No envia credencials a la web pública. Fins a tres intents, separats per cinc segons, dins de la mateixa feina per tolerar propagació curta.

**Pas de configuració pendent:** a Settings → Pages → Build and deployment → Source, seleccionar **GitHub Actions**. Després integrar aquesta correcció perquè la publicació de main construeixi i verifiqui `_site/`. No s’ha canviat la configuració ni disparat Actions en aquesta revisió. No cal crear un workflow nou, afegir un token, publicar fitxers generats al repositori ni reactivar cap calendari.

Verificació: 97 proves natives superades; 360 proves Vitest (355 superades i exactament les mateixes cinc fallades comparades amb la base). Lint idèntic al de la base, amb cinc errors ja coneguts. Generació i validació del catàleg complet superades. Les proves del comprovador simulen 404, fitxers font, commit antic, fallback HTML, error de xarxa i propagació; no es presenta aquesta simulació com una verificació del desplegament públic.

Un cop la comprovació pública passi, repetir PageSpeed mòbil. La prioritat següent serà el camí de renderització del text inicial; l’informe estima 310 ms de recursos bloquejants, 159 KiB d’imatges millorables, 89 KiB de JS no utilitzat i 59 KiB de CSS no utilitzat. Són diagnòstics del desplegament incorrecte, no estalvis demostrats sobre `_site/`. Les polítiques de cache de GitHub Pages i les imatges externes també condicionen la transferència; a Cloudflare s’haurà de publicar el mateix directori de sortida i comprovar de nou la resposta real.


## Quart lot: càrrega inicial després de corregir Pages

La PR 148 està integrada a `0a7dbd02c80158d4bb5399baccddb3ebc8b56a35`. S’ha comprovat al navegador que Source ja és GitHub Actions. La publicació 38902181567 supera la comprovació del paquet públic el 16/10/2026 a les 12:57:14 UTC.

Informe de les 14:57:52 CEST: https://pagespeed.web.dev/analysis/https-segueix-github-io-musica/c8v003hcm3?form_factor=mobile. Rendiment 63, FCP 3,2 s, LCP 11,8 s, TBT 110 ms, CLS 0 i Speed Index 6,5 s; bones pràctiques i SEO 100, accessibilitat 97. La latència del document supera l’auditoria amb resposta de servidor observada de 4 ms; no és el temps complet de navegació. `app.js` ja transfereix uns 88 KiB minificats. L’avís de consentiment continua sent el candidat LCP. La caràtula de reserva transfereix 430 KiB.

Canvis preparats:

- L’avís utilitza Arial local, amb síntesi i renderització explícites des del CSS inicial. Conserva el text, les opcions i el control de mida de lletra. No espera la font Roboto externa ni n’hereta un canvi tardà.
- Els retocs de categories, tipografia i espais s’inclouen a l’HTML font abans de la inicialització. El build combina els cinc fulls en `css/initial.css`, mantenint ordre de cascada i IDs perquè `navigation.js` no els torni a injectar. La query de versió es deriva del contingut. En el paquet, una sola petició CSS local substitueix les cinc anteriors (dues inicials i tres dinàmiques). Gzip: 46.403 → 44.518 bytes. El verificador públic comprova també el CSS combinat.
- Mateixa caràtula de reserva, mateixa resolució 1280 × 720, convertida a WebP qualitat 85: 439.705 → 42.774 bytes (−90,3%). Els dos camins de fallback del reproductor i el precache apunten a WebP; el PNG original es conserva. L’estalvi s’aplica quan es necessita aquesta imatge de reserva.
- El mapa i la vista d’afinitats només es descarreguen en obrir Descobreix. Un carregador de 709 bytes gzip ajorna 13.027 bytes gzip. Deduplica peticions i mostra un botó de reintent davant errors; una navegació durant la baixada no reobre la vista anterior. El mapa conserva el retorn i el zoom amb el mòdul real. Els dos recursos continuen al precache després de l’arrencada per conservar l’ús offline; no es canvia la política d’activació del SW.

Prova local amb la mateixa metodologia anterior (390 × 844, CPU 4×, latència 150 ms, baixada 200.000 bytes/s, gzip, fonts/imatges externes bloquejades i SW desactivat): arrencada 10.150 → 8.694 ms. En aquesta comparació el LCP local passa de 860 a 1.068 ms; **no demostra una millora d’LCP**. La font externa està bloquejada i no reprodueix el candidat tardà de PageSpeed. No es converteixen aquests números en punts Lighthouse. S’ha descartat l’experiment d’inserir tot el CSS dins de l’HTML; es conserva un recurs CSS cachejable.

Validació: 364 proves Vitest disponibles (359 correctes i exactament les mateixes cinc fallades de la base), 56 proves dirigides superades després dels ajustos, 98 proves natives i els cinc errors de lint anteriors, sense errors nous. Paquet complet construït i validat. Prova de navegador: un únic CSS local, cap descàrrega de mapa/afinitats abans d’obrir Descobreix, SVG del mapa i vista d’afinitats visibles, una petició per mòdul, cap PNG de reserva, cerca, selecció de ràdio, exportació/importació JSON i QR sota demanda; sense errors de JS ni avisos d’icones. Consentiment amb app.js bloquejat: acceptar, rebutjar, informació i decisió desada correctes. No es prova reproducció real d’àudio YouTube.

Aquest lot encara requereix integració i un nou PageSpeed públic. No modifica allotjament, permisos, workflows ni calendari d’ingesta; no s’ha disparat cap Action manualment.

## Cinquè lot: regressió de bloqueig (2026-10-16)

Informe públic `ssrfaj7vqi`, 16/10 a les 15:19 CEST, després de publicar la PR 149 (`6e32508`):

| Mètrica mòbil | Informe anterior `c8v003hcm3` | Nou informe |
| --- | ---: | ---: |
| Rendiment | 63 | 45 |
| FCP | 3,2 s | 3,2 s |
| LCP | 11,8 s | 9,0 s |
| TBT | 110 ms | 730 ms |
| CLS | 0 | 0 |
| Speed Index | 6,5 s | 7,1 s |

El nou informe carrega `initial.css?v=a91bca60c70a`: és el paquet optimitzat. El principal empitjorament és CPU: JavaScript passa de 0,9 a 3,7 s, i hi ha una tasca de 1.408 ms atribuïda a `feed.js`. Aquest mòdul delega a `setFeedContext`/`renderFeed` d’app.js: l’atribució no significa que la descàrrega del JSON sigui la causa. L’LCP continua sent el text de l’avís, amb menys temps que abans. Dos informes no demostren quina part del canvi de CPU és variació del laboratori o conseqüència de l’última PR; no es culpa l’allotjament ni es retira el WebP, la càrrega sota demanda o el CSS només per la puntuació.

La traça local identifica, dins la tasca del feed, la construcció de cohorts de selecció i el model de files de la portada. Es preparen les cohorts en lots de 40, amb `scheduler.yield()` o temporitzador de reserva; el render reutilitza el context complet. La portada construeix el mateix model cedint el fil entre files. Un render pendent es descarta si una cerca, un estil o un render més recent ha ocupat la graella. Es reutilitza l’antiguitat calculada, incloent-hi la configuració del motor, sense canviar les regles editorials ni retallar el catàleg.

Comparativa local amb Chromium, CPU ×4, 150 ms, 200.000 bytes/s, 390×844, perfils nous, SW i peticions externes bloquejats; observació fins a 18 s després de DOMContentLoaded i mostreig de CPU activat:

| Mesura local | PR 149 | Correcció |
| --- | ---: | ---: |
| Tasca més llarga | 1.069 ms | 441 ms |
| Suma de bloqueig de tasques >50 ms | 1.855 ms | 1.343 ms |
| Crida síncrona `setFeedContext` | 922 ms | 148 ms |
| Primeres cançons al DOM de la portada | 9.132 ms | 9.377 ms |
| LCP local | 980 ms | 1.096 ms |

**Límit:** menys bloqueig (−28%) i una tasca màxima més curta (−59%), però la portada completa arriba 245 ms més tard en aquesta passada. No és un Lighthouse local ni una nova puntuació PageSpeed. L’esdeveniment `startup-ready` ja no equival al model de portada pintat; es mesura també l’aparició real de les cançons. Les fonts i imatges externes bloquejades fan que aquest LCP no serveixi per predir el públic. La correcció queda pendent de fusió, publicació i un nou informe amb el mateix perfil mòbil.

Verificació: 47 proves dirigides; suite completa 367/372 (les mateixes cinc fallades que la base 359/364); 98 proves natives aprovades. Lint conserva els cinc errors previs, cap de nou. Paquet complet construït i validat. Navegador mòbil: portada, selecció de Rock, cerca Obeses, Descobreix sota demanda, exportació/importació JSON i QR correctes, sense errors. No s’ha provat reproducció real de YouTube. Cap workflow afegit o executat manualment.

## Sisè lot: estabilitat de la portada (2026-10-16)

La PR 150 està integrada a `187e8e3`. L’informe `zzvsaqx34d` (15:38 CEST) arriba a **82 tant a mòbil com a ordinador**. Mòbil: FCP 1,2 s, LCP 3,2 s, TBT 80 ms, CLS 0,196. Ordinador: FCP/LCP 0,7 s, TBT 0 ms, CLS 0,325. El nou marge principal és el moviment durant la càrrega, especialment `videosGrid` i `homePlaylists`; l’auditoria també assenyala Roboto i Fraunces.

Correcció:

- El selector inicial d’estils ja és a l’HTML, amb els estils secundaris plegats. Un script breu prepara la disposició abans de pintar segons historial, m’agrades, seguits i estils locals. No escriu preferències ni activa la reproducció. Els controls s’habiliten quan portada.js té els seus listeners.
- La reserva de càrrega ocupa com a mínim un plec de pantalla mentre hi ha l’esquelet. Les llistes i el peu ja no apareixen a mitja pàgina per després ser empesos pel catàleg. La reserva desapareix amb l’esquelet; no deixa un mínim permanent a la portada ni a les categories.
- Les declaracions WOFF2 de Roboto i Fraunces són al CSS inicial, amb `font-display: optional`, els mateixos pesos i cobertura Unicode. S’elimina la càrrega tardana del CSS de Google Fonts i es conserva el marcador que evita reinjectar-lo des de navigation.js. Els fitxers de font continuen al CDN de Google Fonts; si arriben tard, es conserva la font de reserva durant aquella visita.

Mesura local reproduïble sobre els paquets complets, CPU ×4 al mòbil (390×844) / ×1 a ordinador (1350×844), xarxa 150 ms i 200.000 bytes/s, perfils nous i SW bloquejat. Imatges externes bloquejades. En l’escenari de fonts, es serveixen WOFF2 reals descarregats de Google Fonts amb una demora controlada de 200 ms (500 ms per al CSS de Google de la base). S’observen 12 s després de DOMContentLoaded. **CLS és el màxim de les finestres de sessió de fins a 5 s amb separació màxima d’1 s entre salts; no la suma indiscriminada de tota la càrrega.**

| Mesura local amb fonts retardades | Base PR 150 | Correcció |
| --- | ---: | ---: |
| CLS mòbil | 0,1883 | 0 |
| CLS ordinador | 0,1338 | 0,00036 |
| Primeres cançons al DOM, mòbil | 8.845 ms | 8.855 ms |
| Primeres cançons al DOM, ordinador | 7.358 ms | 7.276 ms |
| LCP local mòbil | 956 ms | 1.260 ms |
| LCP local ordinador | 1.028 ms | 1.044 ms |

Amb les fonts bloquejades, el CLS mòbil baixa de 0,0734 a 0; l’ordinador, de 0,1338 a 0,00036. El petit moviment restant és de 3 px a la barra lateral. Les fonts opcionals poden introduir una espera inicial curta: en la passada mòbil amb fonts retardades el primer contingut/LCP arriba 304 ms més tard, mentre que les cançons arriben al mateix temps. Cal valorar-ho al PageSpeed publicat; no s’atribueix cap puntuació nova a aquests assaigs locals.

Verificació en navegador amb fonts reals ràpides: l’alçada de l’entrada es manté exactament entre HTML inicial i app preparada a mòbil i ordinador, amb primera visita, estils desats i usuaris amb seguits. «Més estils», selecció de Rock, cerca, Descobreix, exportació/importació JSON i QR funcionen, sense errors JS. Proves unitàries: dades buides/corruptes, storage bloquejat, historial/seguits/estils i equivalència de la disposició amb discovery/portada. S’actualitza la prova antiga que exigia ocultar el selector en l’HTML.

Suite completa: 377/382, les mateixes cinc fallades prèvies que la base 367/372; lint amb els mateixos cinc errors. 98 proves natives aprovades; paquet complet validat, 19.566 fitxers. Increment gzip de l’HTML +949 bytes i del CSS inicial +1.719 bytes, amb una petició de CSS extern menys. SW regenerat sense canviar-ne l’activació. Pendent de fusió, desplegament i PageSpeed públic; no s’han afegit ni executat manualment workflows.
