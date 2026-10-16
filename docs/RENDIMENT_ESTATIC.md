# Rendiment del paquet estàtic — 16/10/2026

Aquest primer apartat documenta les millores preparades a la PR 146 abans del seu desplegament. La integració i el segon lot mòbil es documenten al final. El diagnòstic parteix dels dos informes PageSpeed aportats per l’usuari per a `https://segueix.github.io/musica/`, capturats el 16/10/2026 a les 12:27 CEST: mòbil 28 i escriptori 36. Aquests són resultats de la versió pública anterior, no del paquet optimitzat.

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
