# GitHub Actions: política d'estalvi de quota

Vigent des del 14 d'octubre de 2026. Substitueix els disparadors històrics descrits a CLAUDE.md i a la guia de revisió d'idiomes.

## Diagnòstic

El repositori tenia actualitzacions activades per canvis de dades i per finalització d'altres workflows. El feed ja arxivava, generava cerca i afinitats i aprimava les dades, però també activava feines independents d'arxiu, aprimament i auditoria. La publicació escoltava sis workflows i qualsevol canvi de `data/**` o `js/**`. L'actualitzador del Service Worker escoltava qualsevol branca tot i escriure a main. Algunes validacions es repetien en push, PR i fusió; la revisió d'idiomes també havia afegit una comparació permanent amb la base.

Lectura de GitHub del 14 d'octubre: 73 execucions creades entre 00.00 i 11.10 UTC (02.00–13.10 Europe/Madrid). Són execucions, no minuts facturats; no s'ha consultat el saldo de facturació i no es quantifica un estalvi de minuts sense mesurar-lo.

## Regla principal

Canviar artistes, canals, seleccions, idiomes, ocults, orígens o lots de revisió no inicia un runner, ni una ingesta de YouTube, ni una publicació per si mateix. Els nous grups i canvis del catàleg s'incorporen al torn diari de les 20 h Europe/Madrid. Les discografies Tema es rellegeixen senceres al primer torn de consulta després d'almenys set dies.

El cron del feed és únic: `0 20 * * *`, amb `timezone: Europe/Madrid`. La petició posterior del 14/10 substitueix el cron provisional de dies parells per aquesta passada diària, consultant només canals vençuts segons `docs/CONSULTES_PER_ACTIVITAT.md` (1/3/7 dies). GitHub gestiona el canvi d'hora; no s'engeguen dos runners per descartar-ne un. Les execucions programades poden retardar-se segons el servei de GitHub; no es promet puntualitat exacta.

## Workflows actius del sistema

| Feina | Quan s'executa |
| --- | --- |
| Actualitzar feed musical | Cada dia a les 20 h Europe/Madrid o petició manual expressa |
| Publicar web estàtica Música | Canvis de fitxers del sistema a main; després d'una actualització diària correcta o del manteniment manual explícit |
| Validar base musical | Una única feina per PR de codi/configuració del sistema a main, o manual |
| Revisar Shorts | Només manual durant l’estalvi d’octubre |
| Cercar canals YouTube | Només manual durant l’estalvi d’octubre |
| Descobrir artistes de música | Només manual durant l’estalvi d’octubre |
| Enriquir gèneres musicals | Només manual durant l’estalvi d’octubre |
| Actualitzar visualitzacions historial musical | Només manual durant l’estalvi d’octubre |
| Actualitzar feed només dels grups nous | Només petició manual expressa |
| Manteniment musical manual | Una tasca triada expressament: arxiu, afinitats, ocults, aprimament o auditoria |

Arxivament i afinitats es fan dins de l'actualització diària; l'aprimament ja forma part del generador. Service Worker, previsualitzacions i desplegament es fan dins de la mateixa feina de publicació. La fase 4 de la conversió estàtica genera i valida `_site/` a partir d’un únic checkout abans de pujar-lo, sense commits automàtics del publicador; els disparadors i la ingesta es conserven. No es creen cadenes posteriors d'arxiu, aprimament, auditoria o cobertura. L'auditoria consulta Wikidata i queda només manual, no s'ha convertit en una feina local diària.

Una PR només de dades no activa CI. Una PR de sistema passa una sola validació amb proves rellevants; s'anul·len les versions antigues d'aquella validació. Les comprovacions de dades també es mantenen abans de la ingesta programada. No hi ha comparació duplicada automàtica contra la base ni repetició de CI sobre main. No s'han modificat proteccions de branca.

Si una publicació de codi coincideix amb dades editorials ja fusionades, publicarà l'estat vigent de main. La política evita que les dades disparin una publicació; no manté dues versions independents del catàleg. No s'ha canviat la política de visibilitat de cançons pendents.

## Treball de ChatGPT/Codex

No crear workflows temporals per a un grup, un lot, extreure context, validar lletres ni executar proves que es poden fer a la sessió. No fer reintents o dispatch d'Actions per avançar actualitzacions de grups sense petició expressa. Les instruccions i els scripts de revisió sense API continuen operatius. No s'ha afegit cap API d'IA ni cap clau nova.

Els workflows puntuals i els duplicats s'han tret de `.github/workflows`. Una còpia íntegra i amb els mateixos blobs de la configuració anterior es conserva a `docs/actions-arxivades/2026-10-14/`. És només documentació històrica, no s'ha de restaurar a la carpeta activa. Els scripts d'incorporació i les dades dels grups es conserven.

## Comprovacions

`node --test scripts/test_workflow_quota.cjs scripts/test_revisio_codex.cjs scripts/test_activitat_musica.cjs scripts/test_abast_publicacio.cjs scripts/test_publicacio_estatica.cjs`

Inclou calendari local, filtres per dades i interfície, permisos, absència de cascades, una sola feina CI i continuïtat de la revisió Codex. El test de disparadors utilitza un parser limitat: comprovar també que els YAML siguin vàlids abans de desar-los. Les proves Vitest del pipeline també s'executen en l'únic job de validació del sistema.

No es recupera la quota ja consumida, no s'esborren logs ni execucions anteriors i no s'engega el feed per comprovar aquesta configuració. Aquesta actuació no valida les 50 cançons ni genera el seu HTML; aquests treballs continuen separats.

Referències tècniques oficials: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows ; https://docs.github.com/en/billing/concepts/product-billing/github-actions


## Revisió del 17 d’octubre de 2026

S'han revisat els onze YAML actius, els seus permisos, les cues i les 100 execucions més recents. El 16/10 UTC hi ha 62 execucions: 34 de `pages build and deployment`, 9 publicacions estàtiques per push, 16 validacions de PR (incloses les omeses), una ingesta programada, una manual i una publicació posterior a la manual. Els 34 casos `dynamic` són de la font de Pages, no pas 34 crons del feed. Els últims desplegaments propis passen la comprovació `build_type=workflow`; es conserva aquesta exigència. La lectura de configuració de Pages no està disponible al connector, i no s'ha modificat des d'aquesta revisió.

Organització resultant: **deu workflows, un únic cron**. En un dia sense canvis de codi ni ordres manuals: una ingesta selectiva i la seva publicació. Els grups amb publicacions de menys d'un any es consulten diàriament; la resta conserva els torns de tres/set dies. No s'ha canviat el calendari, ni les dades, ni els límits del catàleg.

- `actualitzador.yml` era una segona entrada manual que no arxivava ni regenerava la cerca i les afinitats. Es conserva a `docs/actions-arxivades/2026-10-17/`; s'ha d'utilitzar «Actualitzar feed musical → Run workflow», amb la mateixa opció de discografia sencera. No restaurar el duplicat.
- Les escriptures mantenen `music-data-writer`, amb `queue: max` i sense cancel·lació en curs. Així una ordre manual no substitueix un torn diari que ja espera. No augmenta el paral·lelisme: s'executen d'una en una; només hi ha un cron i les altres entrades són manuals.
- La publicació usa `music-pages`, una cua independent, amb una execució en curs i només la més recent pendent. Ja no pot desplaçar la ingesta. El checkout fixa un estat de main i no hi escriu; una ingesta que acaba després inicia la publicació següent.
- Abans d'instal·lar dependències, `decidir_publicacio_estatica.cjs` consulta el petit `static-build.json` públic. Si el commit i la URL coincideixen i s'ha construït el mateix dia de Madrid, omet instal·lació, build, artefacte i desplegament. L'endemà es reconstrueix per caducar novetats, encara que main no hagi canviat. Un manifest antic/incorrecte o un error de xarxa fa publicar; les ordres manuals i els reintents explícits forcen la publicació. Aquesta comprovació evita feina dins del runner, no l'existència de l'esdeveniment `workflow_run`.
- Les proves de codi són a l'únic job de la PR, també en passar d'esborrany a `ready_for_review`. Es conserven totes les proves que abans repetia el feed. La ingesta valida la base real i la cobertura però no instal·la dependències de desenvolupament ni repeteix Vitest. Els scripts de producció només requereixen Node i mòduls locals. Revisar Shorts tampoc necessita `npm ci`.
- Shorts i comptadors de l'historial queden limitats a main i a 15 minuts, i publiquen amb el helper de reintents existent. Tots els workflows tenen temps límit. L'artefacte Pages es reté un dia; es conserven el build, la validació i la comprovació pública en una única feina.

La revisió d'idiomes conté una prova antiga que exigia una cua d'artistes nous buida. La cua actual inclou Ernest Crusats: ara es comprova que aquests artistes continuïn pendents i que els seus canals tinguin mode `nou`, sense aprovar-los ni alterar cap dada editorial.

Mesura de referència: a l'execució manual 39027436603 (17/10), instal·lar dependències i repetir proves va ocupar 9 segons; la ingesta, 5 min 19 s. El volum principal continua sent la consulta de YouTube. No s'estima un estalvi mensual ni el saldo de quota a partir d'aquesta mostra. No s'ha llançat ni reintentat cap Action per provar aquests canvis.

Fonts de la configuració: [cues i concurrència](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#concurrency), [calendaris i tipus de PR](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows). Consultades el 17/10/2026; `timezone` i `queue: max` són opcions admeses. La cua màxima admet fins a 100 entrades pendents i no es pot combinar amb `cancel-in-progress: true`.


Validació local del canvi: 133 proves Node i 256 proves Vitest rellevants superades; les dues proves ajustades es van tornar a executar amb els seus fitxers complets (47/47). Els deu YAML es parsegen correctament, i s'han comprovat permisos, calendaris i límits. Build complet i validador estàtic correctes (12.225 fitxers, 7.160 cançons). `npm run lint` conserva els mateixos 58 errors i 715 avisos del punt de partida; cap fitxer de JS del client ha canviat. Els scripts modificats no tenen errors de lint. No s'ha alterat el catàleg ni el rendiment del client.
