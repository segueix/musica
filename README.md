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

Per revisar candidats visualment, obre `admin-musica.html`.

Consulta `docs/MUSICA_DADES.md` per als criteris i el flux editorial.

## Seguretat de quota

Els workflows heretats que consultaven YouTube continuen en mode manual fins que Música tingui claus i pipeline propis. El workflow setmanal de descoberta actual només consulta Wikidata.
