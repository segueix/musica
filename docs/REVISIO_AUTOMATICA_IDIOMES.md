# Revisió automàtica d’idiomes

## Estat: primera fase, només informe

El procés examina fins a 100 vídeos pendents de `data/revisio-idiomes.json` per passada. No modifica aquest registre, els ocults, les llistes permeses, el feed ni la política d’artistes. No existeix `--apply`.

El comptador de pendents NO baixa amb una proposta. La prova inicial serveix per mesurar cobertura, errors i consum abans d’autoritzar aplicacions. Les propostes de la IA no es registren com a lletres verificades.

## Execució

A GitHub Actions: **Revisió automàtica d'idiomes (informe)** → **Run workflow** → límit `100`. També hi ha una execució diària a les 03.23 UTC quan aquest workflow és a la branca principal. Els canvis al motor executen una prova automàtica.

```sh
node --test scripts/test_revisio_automatica.cjs
node scripts/revisar_idiomes_automatic.js --limit=100
# Prova local sense connexions ni despesa externa:
node scripts/revisar_idiomes_automatic.js --limit=100 --offline
```

Els informes JSON i Markdown es desen a `reports/idiomes-auto/`, al resum de l’execució i a l’artefacte `revisio-idiomes-<run_id>`. No es fa cap commit automàtic. El workflow només té `contents: read` i no disposa de credencials Git persistents.

## Claus i límits

- `YOUTUBE_API_KEY_SERVER`: reutilitza la clau existent. Consulta `videos.list` en lots de 50 IDs; no fa cerques YouTube ni descarrega àudio/subtítols.
- `OPENAI_API_KEY`: secret d’Actions necessari per a l’anàlisi de lletres i la cerca externa. Si manca, l’informe ho indica i es manté la revisió documental/local. No s’intenta obtenir claus d’altres fitxers.
- Variable opcional `IDIOMES_AUTO_MODEL`: `gpt-4.1-mini` per defecte; cal que admeti Responses, sortida estructurada i web search.
- Variable opcional `IDIOMES_AUTO_WEB_SEARCH=0`: desactiva la cerca externa.
- Per passada: màxim 100 vídeos, 25 anàlisis IA, 10 cerques externes. Cada anàlisi rep com a màxim 14.000 caràcters de font i demana com a màxim 2.200 tokens de sortida; cada cerca té màxim una crida d’eina i 700 tokens de sortida.

Aquests són límits de consum, no una garantia de preu. Cal establir també els límits de despesa al proveïdor de l’API. Les claus mai es publiquen en informes. Les fonts es processen transitòriament; les peticions Responses porten `store:false`.

## Què fa

1. Selecciona una mostra alternant artistes i tipus de vídeo, sense repetir un ID en la mateixa passada.
2. Consulta decisions documentades sobre el mateix ID i seleccions de discos amb llista explícita d’IDs. Els conflictes queden pendents.
3. Recupera les descripcions completes de YouTube o del catàleg local. No tracta el resum de 160 caràcters de pendents com una lletra.
4. Quan hi ha indicis de lletra, demana una anàlisi estructurada. Comprova identificador, intervals, cobertura i existència literal de les citacions. Només proposa conservar un text classificat exclusivament en català; llengua desconeguda, versió incerta i fragment incomplet queden pendents.
5. Cerca fonts externes per als dubtes, amb límit de consultes. Només conserva URL retornades com a fonts/cites de l’eina de cerca; mai adreces inventades al text del model.
6. Desa progrés entre passades en una memòria cau que NO conté lletres. Espera entre reintents i limita a tres els intents editorials sense informació nova. Afegir les claus o canviar les dades/configuració invalida els resultats antics afectats.

## Límits de la primera fase

**Localitzar una font externa no és verificar-ne el text íntegre.** En aquesta fase, aquests casos continuen amb `externalEvidenceVerified:false` i queden pendents de contrast. No s’ha implementat un raspador massiu de Viasona ni de webs d’artistes, ni s’afirma que s’hagin llegit totes les lletres d’aquestes fonts. Una futura integració haurà de respectar els permisos d’accés i comprovar text, integritat i versió.

**El comprovador valida les citacions, no demostra que la classificació lingüística de la IA sigui correcta.** Per això totes les propostes IA porten `requiresHumanApproval:true` i `fullLyricsVerified:false`. Cal revisar la mostra abans d’activar qualsevol aplicació. No s’ha activat aprovació ni exclusió automàtica en producció.

No s’hereten decisions pel títol, pel nom de l’artista o només per `obra`. Aquest últim camp serveix per agrupar l’informe, no per certificar que dos vídeos contenen el mateix enregistrament. Directes, col·laboracions i versions lingüístiques no s’equiparen automàticament. La confiança editorial tampoc es transforma en verificació de lletra.

Una absència de lletra no acredita que una peça sigui instrumental. Una fallada de l’API, un vídeo no retornat, un pressupost esgotat o una clau absent no causen exclusions. Si falla l’API d’IA, s’aturen les consultes d’aquella passada per no insistir amb una configuració trencada.

Les memòries cau d’Actions poden caducar o eliminar-se: en aquest cas es poden repetir consultes, però no es perden decisions editorials perquè aquest procés no les modifica. Els artefactes es conserven 30 dies.

## Referències tècniques

- YouTube `videos.list`: https://developers.google.com/youtube/v3/docs/videos/list
- Responses i sortida estructurada: https://developers.openai.com/api/docs/guides/structured-outputs
- Cerca web i fonts: https://developers.openai.com/api/docs/guides/tools-web-search

## Proves

`node --test scripts/test_revisio_automatica.cjs`: proves sense xarxa amb textos sintètics, inclosa una execució integral que comprova que les dades originals continuen idèntiques. GitHub Actions executa també `npm test` i `npm run lint` en una feina independent.
