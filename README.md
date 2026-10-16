# Segueix Música

Projecte independent derivat de Segueix per descobrir i reproduir música en català.

## Estat

La PWA conserva la base funcional de `segueix/Segueix`, però el feed i les dades editorials del projecte general s'han reinicialitzat.

La nova base canònica d'artistes és:

`data/artistes-musica.json`

Els candidats es poden descobrir automàticament des de Wikidata sense consumir quota de YouTube:

```bash
npm run music:discover
```

La base es valida amb:

```bash
npm run music:validate
```

Per revisar candidats visualment, obre `admin-musica.html`. Per revisar els títols de totes les cançons publicades, obre `revisio-cancons.html` (`revisio-artistes.html` hi redirigeix); la revisió de noms i categories d'artistes és a `revisio-noms-artistes.html` (veure `docs/MUSICA_DADES.md`).

Consulta `docs/MUSICA_DADES.md` per als criteris i el flux editorial.

## Seguretat de quota

Els workflows heretats que consultaven YouTube continuen en mode manual fins que Música tingui claus i pipeline propis. El workflow setmanal de descoberta actual només consulta Wikidata.


### Conversió estàtica (fases 1–3)

`npm run build:static` genera el paquet `_site/`. El client i el panell d’artistes funcionen amb JSON locals, sense Functions ni claus de YouTube Data API al navegador. L’administració descarrega canvis editorials per revisar i aplicar amb `node scripts/aplicar_canvis_admin.cjs fitxer.json --dry-run` i després `--apply`; descarregar no publica. La integració del paquet al workflow encara correspon a la fase 4. Vegeu `docs/CONVERSIO_ESTATICA.md`.
