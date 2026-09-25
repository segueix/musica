# Base de dades de Segueix Música

La font canònica d'artistes és `data/artistes-musica.json`.

## Principis

- Un artista pot tenir més d'un canal de YouTube (oficial, Topic, discogràfica o altres).
- Només hi pot haver un canal marcat com a `primary: true` per artista.
- L'artista i la llengua de cada peça són conceptes separats: ser a la base d'artistes no implica que tots els seus vídeos entrin al feed.
- `confidence` indica la confiança amb què hem relacionat l'artista amb les seves identitats externes.
- Wikidata i MusicBrainz serviran per automatitzar la descoberta inicial; YouTube completarà els casos que faltin.

## Camps principals

`name`: nom canònic de l'artista o grup.

`aliases`: variants del nom.

`genres`: gèneres musicals.

`territories`: territoris vinculats a l'artista.

`languages`: llengües habituals del repertori; no substitueix el filtre vídeo per vídeo.

`wikidataId` i `musicbrainzId`: identificadors externs.

`youtube.channels`: canals relacionats. Cada entrada inclou `id`, `handle`, `name`, `type` i `primary`.

`confidence`: `alta`, `mitjana`, `baixa` o `pendent`.

`sources`: fonts que justifiquen la identificació.

`lastChecked`: darrera verificació automàtica o manual.

## Validació

Executa:

```bash
npm run music:validate
```

També hi ha un workflow de GitHub que valida automàticament la base quan aquesta canvia. No utilitza cap API externa ni consumeix quota de YouTube.
