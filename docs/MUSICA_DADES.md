# Base de dades de Segueix Música

La font canònica és `data/artistes-musica.json`. No cal mantenir un Excel paral·lel.

## Descoberta automàtica

`scripts/descobrir_artistes_musica.js` consulta Wikidata i combina tres senyals:

1. artistes que declaren català entre les llengües;
2. artistes amb català com a llengua nativa;
3. artistes vinculats com a intèrprets d'una obra catalogada en català.

Per reduir falsos positius, el candidat ha de tenir un MusicBrainz Artist ID a Wikidata. Si Wikidata també té un YouTube Channel ID, s'incorpora directament.

L'Action `Descobrir artistes de música` s'executa els dilluns i també es pot executar manualment. No necessita cap clau de YouTube.

## Revisió editorial

Cada artista té `reviewStatus`:

- `pendent`: descobert automàticament, encara no validat;
- `aprovat`: acceptat per al projecte i `active: true`;
- `rebutjat`: exclòs i `active: false`.

L'automatisme conserva aquestes decisions.

La pàgina `admin-musica.html` permet filtrar, aprovar i rebutjar candidats. Els canvis queden temporalment al navegador i es poden exportar com a JSON o CSV. El JSON exportat està preparat per substituir `data/artistes-musica.json`.

## Ordres

```bash
npm run music:discover
npm run music:discover:dry
npm run music:validate
```

## Fonts externes

- Wikidata: identificadors i evidència de vinculació amb el català.
- MusicBrainz: identificador canònic de l'artista; l'enriquiment de relacions es pot afegir posteriorment.
- YouTube: encara no es consulta des d'aquest procés; només s'aprofiten IDs de canal ja presents a Wikidata.
