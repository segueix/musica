# Conversió de Música a web estàtica

Petició del 16/10/2026. La retirada de Drive i analítiques és la primera fase; no equival encara a tenir el repositori preparat per connectar-lo directament a Cloudflare Pages.

## Diagnòstic

- L’app és HTML/CSS/JavaScript i llegeix el catàleg, els arxius i la cerca des de JSON. El workflow actual de GitHub Pages ja exclou `functions` de l’artefacte.
- El mapa és propi (`artist-map.js`) i utilitza dades locals (`mapa-base.json`, `origens-artistes.json`, `proximitat-musical.json`). No cal substituir-lo per un servei de mapes.
- Les fases 2 i 3 substitueixen les rutes i sitemaps dinàmics per fitxers generats i retiren les 38 Functions de l’arrel, incloent middleware i `/api/music-admin`. La fase 4 integra aquest paquet a la publicació; la validació funcional i la migració a Cloudflare continuen pendents.
- Les analítiques de Música apuntaven a `https://segueix.cat/api/music-analytics`, fora d’aquest repositori. Aquesta fase retira el client i la còpia local de l’API; no modifica el desplegament ni les dades històriques d’aquell altre projecte.

## Fases

| Fase | Feina | Criteri de finalització |
| --- | --- | --- |
| 1. Dades personals locals | Retirar Drive/OAuth, temporitzadors i analítiques. Oferir Descarregar .json i Importar .json. Actualitzar privacitat i memòria cau. | Implementada en aquesta proposta; proves de còpia entre dos emmagatzematges, validació, cancel·lació, falta d’espai i actualització de vista. |
| 2. Rutes i SEO estàtics | Generar abans de publicar les pàgines d’artistes, cançons i estils, metadades socials, canònics i sitemaps. Reutilitzar el generador de `compartir/`. Adaptar enllaços, rutes antigues, 404 i arrel de l’app al domini final. | Implementada en aquesta proposta: HTML i sitemaps generats localment. Publicació integrada a la fase 4. |
| 3. Dependències del servidor | Retirar middleware i Functions després de substituir-ne les rutes. Adaptar l’administració musical perquè exporti canvis per aplicar-los al repositori. Revisar els camins alternatius de YouTube API al client. | Implementada en aquesta proposta: sense Functions, panell local amb JSON i client que consulta només el catàleg publicat. |
| 4. Actualització de dades i paquet | Conservar la ingesta de YouTube a GitHub, la passada diària de les 20 h Europe/Madrid i els torns 1/3/7 dies. Integrar generació estàtica, Service Worker i artefacte en una sola publicació. | Implementada en aquesta proposta: construcció i validació d’un mateix checkout, seguida de la pujada i el desplegament en una sola feina. |
| 5. Validació i rendiment | Provar cerca, artistes/discos, mapa, ràdios, llistes, reproducció, JSON, enllaços compartits i actualització d’una PWA antiga. Mesurar càrrega mòbil i corregir coll d’ampolla amb dades. | Web funcional sense backend propi; dades fresques i absència de peticions retirades. No es promet una puntuació PageSpeed sense mesurar-la. |
| 6. Cloudflare | Preparar un desplegament de prova amb l’artefacte estàtic; configurar domini, redireccions i memòria cau; comprovar que no es desplegui cap Function/Worker. Fer el canvi públic després de validar-lo. | Mateix funcionament al domini final i pla de retorn a la versió anterior. |

## Còpies JSON

Format `product: segueix-musica`, `v: 1`, amb data i camps musicals explícits. Inclou historial (fins al límit de 50 de l’app), m’agrada, seguits, llistes, categories, gustos, senyals musicals locals i opcions d’aspecte. No inclou credencials, consentiments, memòria cau ni la cua activa. No s’importa automàticament una còpia de l’app Segueix de YouTubers.

Importar substitueix les dades musicals després de validar-les i demanar confirmació. Si fallen les escriptures, es restaura l’estat anterior; només es pot alliberar memòria cau regenerable. La música no es recarrega. La preferència de YouTube es conserva al mateix aparell. Les còpies antigues a Drive no s’esborren remotament.

En canviar de domini, el navegador utilitza un emmagatzematge diferent: cal descarregar la còpia al domini antic i importar-la al nou. Això forma part de la migració.

## Generació estàtica (fase 2)

Des d’un checkout complet amb les dades del catàleg:

```sh
npm run build:static
npm run build:static -- --site-url=https://musica.example/ --out=/tmp/musica-static
```

La sortida per defecte és `_site/`, exclosa de Git. El domini per defecte és `https://segueix.github.io/musica/`; `--site-url` o `SITE_URL` permeten indicar el domini final i una subcarpeta. Cal regenerar el paquet quan canvia aquesta URL. El generador no consulta YouTube ni altera les dades d’origen. Refusa substituir carpetes alienes i conserva la sortida anterior si falla la generació.

- Artistes: `creador/<slug>/`, amb àlies per identificador i canals vinculats al mateix artista editorial. No es fusionen noms homònims. El feed delimita el catàleg públic; el camp `active` de candidats no retira artistes que continuen al feed.
- Cançons: `compartir/canco/<id>.html`, reutilitzant les URLs compartides existents. L’HTML inclou títol, artista, metadades socials, canònic i dades estructurades. L’iframe de YouTube es crea només després de prémer el botó d’acceptació.
- Estils: 15 pàgines, més Novetats, Descobreix i l’índex d’artistes. Els botons obren el filtre corresponent de l’app amb `?style=`.
- Rutes antigues `/video/<slug>-<id>`: `404.html` consulta un mapa local i recupera només IDs públics coneguts, conservant `t` i el fragment. És una recuperació al client, no una redirecció HTTP 301. Les URLs canòniques tenen fitxer propi.
- `sitemap.xml`, `video-sitemap.xml` i `robots.txt`: generats amb el domini escollit, dividits en fitxers. Es recalcula també el hash del Service Worker sobre l’HTML de sortida.

El catàleg comprovat produeix 433 artistes (654 canals), 14.489 cançons, 15 estils i 2.561 pàgines compartides de ràdio. Els ocults, canals retirats, Shorts i vídeos fora de les restriccions editorials queden fora de les pàgines generades. Els recomptes canviaran amb les dades.

La sortida exclou `scripts` i el repositori ja no conté `functions`. La fase 4 adapta el workflow de publicació a aquest paquet. La proposta continua en esborrany, sense fusió ni desplegament.

## Administració i catàleg sense servidor (fase 3)

`admin-musica.html` és un editor públic de dades públiques: les modificacions són esborranys del navegador, sense capacitat d’escriure a GitHub. Ofereix descarregar i importar `canvis-artistes-musica.json` (`product: segueix-musica-admin`, `version: 1`), separat de la còpia personal de Música. La importació valida abans de demanar confirmació i no substitueix la vista si falla el desat local. Els esborranys del panell antic es conserven i es poden descarregar; no s’apliquen automàticament sobre una base nova.

El fitxer conté la fitxa original i només els camps editorials canviats, o una eliminació explícita. El model compartit `js/admin-changes.js` valida categories, estat, activació i canals. Una fitxa que ha canviat al repositori, una identitat ambigua o una operació repetida fan fallar tot el lot. Els canvis independents d’altres artistes es conserven; els gèneres editats porten `genre:manual` perquè l’enriquiment no els sobreescrigui.

Per aplicar un fitxer revisat en un checkout actualitzat:

```sh
node scripts/aplicar_canvis_admin.cjs canvis-artistes-musica.json --dry-run
node scripts/aplicar_canvis_admin.cjs canvis-artistes-musica.json --apply
```

Sense cap opció, només comprova. `--apply` escriu `data/artistes-musica.json` després de validar el lot complet; no fa commit, no publica ni dispara Actions o consultes de YouTube. Cal revisar el diff i integrar-lo pel procés habitual. Aprovar o eliminar aquí afecta la base editorial; el catàleg publicat canvia quan el procés de dades el regenera.

El client manté el nom intern `YouTubeAPI` per compatibilitat, però s’han retirat els endpoints de YouTube Data API, la configuració de claus i els mètodes remots obsolets. Feed, historial i arxius locals resolen les cançons; `data/video-channels.json`, generat durant el build, permet localitzar una cançó compartida que només sigui a l’arxiu sense consultar tots els canals. Ocults, Shorts i canals retirats no es resolen com a fitxes públiques. Les URLs de reproducció dins l’app conserven `?v=` en qualsevol domini. La reproducció continua utilitzant el reproductor de YouTube; la ingesta de dades als scripts conserva les seves credencials i el calendari habitual.

## Actualització i paquet publicable (fase 4)

`publicar-comparticio-musica.yml` construeix `_site/` amb `npm run build:static`, executa `npm run validate:static`, puja exactament aquesta carpeta i la desplega. Tot passa dins de la mateixa feina i el mateix checkout de main. La URL pública prové de la configuració existent de GitHub Pages; no s’activa ni es canvia Pages des del workflow. `static-build.json` registra la URL, els recomptes i `SOURCE_COMMIT`, el SHA del checkout real.

El publicador ja no fa commits de les pàgines generades ni del SW, ni copia el repositori sencer. Només requereix lectura de contingut, a més dels permisos de Pages i OIDC per al desplegament. La generació utilitza Node i mòduls del repositori, sense instal·lar dependències ni consultar YouTube. La validació comprova rutes i sitemaps, índexs vídeo-canal, assets de la portada, hash del SW i absència de fitxers de servidor, desenvolupament o enllaços no publicables. Si falla, no es puja ni es desplega l’artefacte.

La ingesta, la passada de les 20 h Europe/Madrid, els torns 1/3/7 dies i el mínim de 7 dies dels Tema es conserven. Les dades soles no disparen CI ni publicació; s’incorporen després d’una actualització correcta o quan una publicació de codi pren l’estat vigent de main. No s’afegeixen workflows ni calendaris. Les proves estàtiques entren a la mateixa invocació Vitest de l’única feina CI, que continua ometent les PR en esborrany.

El SW desa cada pàgina d’artista, cançó o administració sota el seu propi camí. Només l’arrel i `index.html` comparteixen la còpia de la portada per als enllaços amb `?v=`. La migració del nom de cache retira còpies antigues potencialment contaminades. Els índexs generats de rutes i vídeo-canal es consulten primer a la xarxa, amb fallback local. Es conserva l’activació ajornada del SW per evitar interrupcions del reproductor. La validació amb una PWA antiga en un navegador real correspon a la fase 5.

Validació local del paquet, sense publicar:

```sh
npm run build:static
npm run validate:static
# Per a una destinació diferent, cal passar la mateixa SITE_URL a totes dues ordres.
# SOURCE_COMMIT és opcional localment; el workflow sempre l’assigna al SHA real.
```

## Verificació

- 64 proves dirigides superades: JSON, vista en viu, favorits, senyals locals, recuperació de reproducció, feed i exclusió del progrés local de les còpies.
- Fase 2: 89 proves dirigides superades en 12 fitxers, incloent generació estàtica, pàgines compartides, URLs del reproductor i regressions de la fase 1. Comprovats domini arrel/subcarpeta, escapament, filtres editorials, canònics, sitemaps, reconstrucció i conservació de la sortida davant errors. Generació completa del catàleg local superada.
- Fase 3: 112 proves dirigides superades en 16 fitxers. Inclou JSON editorial, conflictes i homònims, aplicació local, cancel·lació/falta d’espai, catàleg sense API, URLs recarregables i regressions de les fases anteriors. Generació completa i presència del panell i les seves dades comprovades. Les proves de les Functions retirades es substitueixen per les de generació i runtime estàtics.
- Fase 4: 128 proves dirigides en 17 fitxers i 85 proves natives de quota/revisió superades. Els 11 YAML són vàlids. Verificats domini/subcarpeta, reconstrucció amb una cançó retirada, rebuig de paquets trencats, dades fresques i separació de pàgines/portada offline. Construcció i validació del catàleg local superades. No s’ha disparat cap workflow.
- `npm run lint`: cinc errors preexistents, reproduïts abans del canvi, a `js/data.js` i `js/features/home-sections.js`; cap error nou.
- Dues proves d’integració antigues fallen també a la base: una exigeix un hash de SW literal de setembre i l’altra confon una referència inline a user-categories amb l’ordre dels scripts. No s’han modificat aquests casos aliens a la conversió.
- No s’ha executat la suite completa, ni la reproducció real de YouTube, ni un desplegament a Cloudflare. La comprovació visual al navegador queda pendent: no hi ha Chromium disponible i la descàrrega ha fallat. Les proves del runtime comproven clic, segon inicial, recuperació de rutes i rebuig de redireccions externes.

## Referències d’allotjament

- https://developers.cloudflare.com/pages/framework-guides/deploy-anything/
- https://developers.cloudflare.com/pages/functions/get-started/ — `functions` es detecta a l’arrel del projecte, no només a la carpeta de sortida.

Una web estàtica continua necessitant xarxa per reproduir YouTube i obtenir els recursos externs que conservi. El que s’elimina és l’execució pròpia de servidor per atendre les visites.
