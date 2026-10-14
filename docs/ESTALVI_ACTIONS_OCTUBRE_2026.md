# Estalvi provisional de GitHub Actions — octubre de 2026

Petició de l’usuari del 14 d’octubre de 2026: reduir primer els calendaris per preservar els 300 minuts restants del compte. Més tard el mateix dia ha demanat consulta diària dels canals amb publicacions de menys d’un any, cada tres dies dels intermedis i setmanal dels de més de tres anys. Aquesta nova petició substitueix només el calendari del feed; detall a `CONSULTES_PER_ACTIVITAT.md`.

## Configuració aplicada a musica

- `actualitzar-feed-musica.yml`: `0 20 * * *`, zona `Europe/Madrid`. Una sola passada diària, amb consulta selectiva dels canals vençuts (1/3/7 dies).
- El cron anterior de dies parells (`0 20 2-30/2 * *`) queda substituït per la petició posterior. No s’afegeix cap workflow ni cap passada addicional el mateix dia.
- `revisar_shorts.yml`, `cercar-canals-youtube.yml`, `descobrir-musica.yml`, `enriquir-generes.yml` i `actualitzar-visualitzacions-historial.yml`: sense `schedule`; només `workflow_dispatch`.
- La publicació després d’una actualització correcta, la CI del sistema i els filtres que eviten accions per canvis de dades es conserven sense canvis.
- El cron de `scripts/lib/abast_feed.js` i les proves es mantenen alineats amb el YAML; un esdeveniment amb el cron de dies parells anterior es rebutja.

L’actualitzador tria els canals segons activitat i en desa el torn; els filtres lingüístics i els permisos es conserven. Les ordres manuals continuen disponibles però només s’han d’executar per petició expressa. No s’ha executat cap ingesta real ni creat cap workflow per provar aquest canvi. L’efecte net sobre els minuts d’Actions s’ha de mesurar: hi ha més passades, però menys canals a consultar després de la inicialització.

## Durada i recuperació

Mode provisional pensat per al que queda d’octubre; revisar l’1 de novembre de 2026. **No hi ha reactivació automàtica dels manteniments complementaris**. El feed segueix la nova freqüència selectiva demanada; els altres calendaris continuen desactivats fins que s’aprovi recuperar-los.

Calendaris anteriors (recuperar només els disparadors, no sobreescriure canvis posteriors):

| Workflow | Cron anterior | Zona |
| --- | --- | --- |
| `actualitzar-feed-musica.yml` | `0 20 * * *` | Europe/Madrid |
| `revisar_shorts.yml` | `0 3 * * *` | UTC |
| `cercar-canals-youtube.yml` | `17 8 * * *` | UTC |
| `descobrir-musica.yml` | `17 4 * * 1` | UTC |
| `enriquir-generes.yml` | `17 6 * * 0` | UTC |
| `actualitzar-visualitzacions-historial.yml` | `23 9 * * 0` | UTC |

En Música, restaurar també el cron del comprovador i les seves proves. No recuperar les cascades de workflows retirades anteriorment. Les previsualitzacions de Música continuen publicant-se després de cada actualització correcta. Les execucions manuals, canvis de codi, reintents i altres repositoris poden afegir consum; no es garanteix arribar a final de mes amb una quantitat fixa de minuts.
