# Segueix Música

Projecte independent derivat de Segueix per descobrir i reproduir música en català.

## Estat inicial

La base funcional de `segueix/Segueix` s'ha clonat sense arrossegar el feed, l'arxiu històric ni els índexs del projecte general.

Els automatismes heretats que podien actualitzar dades o consumir quota s'han deixat temporalment en execució manual. No es reactivaran fins que Música tingui:

- base d'artistes pròpia;
- pipeline musical propi;
- projecte i clau de YouTube propis;
- desplegament propi.

## Base d'artistes

La font canònica és:

`data/artistes-musica.json`

L'estructura permet diversos canals de YouTube per artista i enllaços amb Wikidata i MusicBrainz.

Valida-la amb:

```bash
npm run music:validate
```

Consulta `docs/MUSICA_DADES.md` per a l'esquema i criteris.

## Aplicació

La resta de la PWA encara conserva la base funcional de Segueix i s'anirà adaptant progressivament al producte musical.
