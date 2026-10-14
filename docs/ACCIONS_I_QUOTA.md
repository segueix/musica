# GitHub Actions: política d'estalvi de quota

Vigent des del 14 d'octubre de 2026. Substitueix els disparadors històrics descrits a CLAUDE.md i a la guia de revisió d'idiomes.

## Diagnòstic

El repositori tenia actualitzacions activades per canvis de dades i per finalització d'altres workflows. El feed ja arxivava, generava cerca i afinitats i aprimava les dades, però també activava feines independents d'arxiu, aprimament i auditoria. La publicació escoltava sis workflows i qualsevol canvi de `data/**` o `js/**`. L'actualitzador del Service Worker escoltava qualsevol branca tot i escriure a main. Algunes validacions es repetien en push, PR i fusió; la revisió d'idiomes també havia afegit una comparació permanent amb la base.

Lectura de GitHub del 14 d'octubre: 73 execucions creades entre 00.00 i 11.10 UTC (02.00–13.10 Europe/Madrid). Són execucions, no minuts facturats; no s'ha consultat el saldo de facturació i no es quantifica un estalvi de minuts sense mesurar-lo.

## Regla principal

Canviar artistes, canals, seleccions, idiomes, ocults, orígens o lots de revisió no inicia un runner, ni una ingesta de YouTube, ni una publicació per si mateix. Els nous grups i canvis del catàleg s'incorporen al torn diari de les 20 h Europe/Madrid. Es mantenen els torns de set dies per a les discografies Tema.

El cron del feed és únic: `0 20 * * *`, amb `timezone: Europe/Madrid`. GitHub gestiona el canvi d'hora; no s'engeguen dos runners per descartar-ne un. Les execucions programades poden retardar-se segons el servei de GitHub; no es promet puntualitat exacta.

## Workflows actius del sistema

| Feina | Quan s'executa |
| --- | --- |
| Actualitzar feed musical | Cada dia a les 20 h Europe/Madrid o petició manual expressa |
| Publicar previsualitzacions Música | Canvis de fitxers del sistema a main; després d'una actualització diària correcta o del manteniment manual explícit |
| Validar base musical | Una única feina per PR de codi/configuració del sistema a main, o manual |
| Revisar Shorts | Cada dia a les 03.00 UTC; calendari preexistent |
| Cercar canals YouTube | Cada dia a les 08.17 UTC; calendari preexistent, sense activar el feed immediat |
| Descobrir artistes de música | Dilluns a les 04.17 UTC; calendari preexistent |
| Enriquir gèneres musicals | Diumenge a les 06.17 UTC; calendari preexistent |
| Actualitzar visualitzacions historial musical | Diumenge a les 09.23 UTC; calendari preexistent |
| Actualitzador feed musical (manual) | Només petició manual expressa |
| Actualitzar feed només dels grups nous | Només petició manual expressa |
| Manteniment musical manual | Una tasca triada expressament: arxiu, afinitats, ocults, aprimament o auditoria |

Arxivament i afinitats es fan dins de l'actualització diària; l'aprimament ja forma part del generador. Service Worker, previsualitzacions i desplegament es fan dins de la mateixa feina de publicació. No es creen cadenes posteriors d'arxiu, aprimament, auditoria o cobertura. L'auditoria consulta Wikidata i queda només manual, no s'ha convertit en una feina local diària.

Una PR només de dades no activa CI. Una PR de sistema passa una sola validació amb proves rellevants; s'anul·len les versions antigues d'aquella validació. Les comprovacions de dades també es mantenen abans de la ingesta programada. No hi ha comparació duplicada automàtica contra la base ni repetició de CI sobre main. No s'han modificat proteccions de branca.

Si una publicació de codi coincideix amb dades editorials ja fusionades, publicarà l'estat vigent de main. La política evita que les dades disparin una publicació; no manté dues versions independents del catàleg. No s'ha canviat la política de visibilitat de cançons pendents.

## Treball de ChatGPT/Codex

No crear workflows temporals per a un grup, un lot, extreure context, validar lletres ni executar proves que es poden fer a la sessió. No fer reintents o dispatch d'Actions per avançar actualitzacions de grups sense petició expressa. Les instruccions i els scripts de revisió sense API continuen operatius. No s'ha afegit cap API d'IA ni cap clau nova.

Els workflows puntuals i els duplicats s'han tret de `.github/workflows`. Una còpia íntegra i amb els mateixos blobs de la configuració anterior es conserva a `docs/actions-arxivades/2026-10-14/`. És només documentació històrica, no s'ha de restaurar a la carpeta activa. Els scripts d'incorporació i les dades dels grups es conserven.

## Comprovacions

`node --test scripts/test_workflow_quota.cjs scripts/test_revisio_codex.cjs`

Inclou calendari local, filtres per dades i interfície, permisos, absència de cascades, una sola feina CI i continuïtat de la revisió Codex. El test de disparadors utilitza un parser limitat: comprovar també que els YAML siguin vàlids abans de desar-los. Les proves Vitest del pipeline també s'executen en l'únic job de validació del sistema.

No es recupera la quota ja consumida, no s'esborren logs ni execucions anteriors i no s'engega el feed per comprovar aquesta configuració. Aquesta actuació no valida les 50 cançons ni genera el seu HTML; aquests treballs continuen separats.

Referències tècniques oficials: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows ; https://docs.github.com/en/billing/concepts/product-billing/github-actions
