# Estalvi provisional de GitHub Actions — octubre de 2026

Petició de l’usuari del 14 d’octubre de 2026: reduir primer els calendaris per preservar els 300 minuts restants del compte. Aquesta excepció preval sobre els horaris habituals descrits en altres documents.

## Configuració aplicada a musica

- `actualitzar-feed-musica.yml`: `0 20 2-30/2 * *`, zona `Europe/Madrid` (dies parells a les 20 h).
- A l’octubre pendent: 14, 16, 18, 20, 22, 24, 26, 28 i 30. Sense comprovador diari que arrenqui runners els dies que no toca.
- `revisar_shorts.yml`, `cercar-canals-youtube.yml`, `descobrir-musica.yml`, `enriquir-generes.yml` i `actualitzar-visualitzacions-historial.yml`: sense `schedule`; només `workflow_dispatch`.
- La publicació després d’una actualització correcta, la CI del sistema i els filtres que eviten accions per canvis de dades es conserven sense canvis.
- El cron de `scripts/lib/abast_feed.js` i les proves es mantenen alineats amb el YAML; un esdeveniment amb el cron diari anterior es rebutja.

No es canvien les dades, els filtres lingüístics, els scripts d’ingesta ni els permisos. Les ordres manuals continuen disponibles però només s’han d’executar per petició expressa. No s’ha executat cap ingesta ni creat cap workflow per provar aquest canvi.

## Durada i recuperació

Mode provisional pensat per al que queda d’octubre; revisar l’1 de novembre de 2026. **No hi ha reactivació automàtica**: el calendari reduït continua vigent fins que s’aprovi la recuperació. Això evita tornar a consumir quota sense comprovar-la. El cron de dies parells no és una garantia d’interval exacte de 48 hores al canvi de mes o d’hora.

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
