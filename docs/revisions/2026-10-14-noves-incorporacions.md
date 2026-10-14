# Revisió de les noves incorporacions — 14/10/2026

Petició de l’usuari: incorporar el disc català de Gato Pérez (confirmat: **Flaires de Barcelunya**), netejar els noms visibles i retirar «Mi Amigo José» de Repúblika Ska; revisar les incorporacions perquè no incloguin cançons en altres llengües.

## Flaires de Barcelunya

S’han contrastat les deu pistes del canal `UCxZhZaJrcH8nHdrKx4ij0sw` amb les publicacions de Parlophone Spain a YouTube. Totes indiquen el disc i el copyright EMI 1983. La [fitxa de La Fonoteca](https://lafonoteca.net/disco/flaires-de-barcelunya/) documenta explícitament el disc íntegrament en català: enregistrat el 1982, publicat el 1983. La [fitxa d’Enderrock](https://www.enderrock.cat/disc/4741/flaires-barcelunya) permet contrastar-ne les pistes, però data el treball el 1982; es conserva 1983 com a any de publicació.

L’edició, l’ordre i els IDs es desen a `data/llancaments-musicals.json`; s’amplia la selecció de títols del canal sense eliminar «Rumba de Barcelona». `discsVerificats` documenta l’aprovació lingüística dels deu IDs concrets. No s’aprova la resta del repertori de Gato Pérez.

No s’ha executat cap actualització de YouTube ni cap Action manual. Les pistes s’incorporaran al feed en el proper torn programat del canal; aquest commit prepara la selecció, no simula una ingestió completada.

## Noms visibles

Les 23 incorporacions tenen `displayName` amb el nom editorial del grup. Es conserven els noms originals dels canals per a identificació i regles. El netejador reconeix els crèdits `Topic`, `Tòpic`, `Tema`, `Oficial` i `Official`; també els crèdits compostos «Artista - Topic - Cançó» i «Cançó - Artista - Tema». Preserva un títol real com «Tema», les versions i les col·laboracions. Es renova la URL del script perquè el navegador carregui el canvi.

## Idiomes: resultat i límits

S’ha inventariat el feed de partida dels 23 artistes: **269 vídeos**. S’han llegit les descripcions públiques disponibles dels vídeos dels canals oficials, amb comprovacions addicionals de còpies Topic i fonts discogràfiques. No s’ha escoltat ni transcrit àudio. Un títol o un codi d’idioma no s’ha utilitzat com a prova.

Els lots `idiomes-codex/lot-0001` a `lot-0007` apliquen **100 decisions**: **40 conservacions** per lectura de la lletra completa, **13 exclusions** i **47 pendents** per proves insuficients. Hi ha **176 entrades addicionals dels lots encara sense examinar**, incloses peces fora del feed actual. Els lots queden oberts per continuar, sense aprovar aquestes entrades. La revisió no certifica que tot el repertori dels 23 artistes sigui català.

Les exclusions comprovades corresponen a:

| Artista | Peça | Llengua no catalana comprovada |
|---|---|---|
| Repúblika Ska | Mi Amigo José | Castellà |
| Trast | Soñaremos | Castellà |
| Trast | Somos lo que somos, amb Emon | Castellà i basc |
| Trast | De nit, amb La Raíz | Castellà |
| Ovella Xao | La canción del viajero | Castellà |
| Ovella Xao | El menda lerenda | Castellà |
| Ovella Xao | La companyia d’un porc espí | Anglès |
| Mascarats | Territori ocupat, amb Juantxo Skalari | Anglès |
| Mascarats | La vall dels alienats, amb Ezetaerre | Gallec |
| Atzembla | Quan tot es fa fosc, amb Esne Beltza | Basc |
| Terra Ferma Ska Band | Cada instant, amb Koers | Anglès |

Les fonts i els IDs precisos figuren als lots. Per «El menda lerenda», s’ha llegit també el fragment de lletra d’[Apple Music](https://music.apple.com/ru/song/el-menda-lerenda/1092843476?l=en-GB), identificant l’edició #PASTUREIG de 2016. La resta de proves de lletra són les descripcions publicades pels grups per als vídeos revisats.

Els 13 IDs inclouen dues publicacions de «De nit» i el vídeo del disc sencer «Un Brot de Llum»: el grup hi identifica «Cada instant» amb Koers a 7:27. S’afegeixen **9 còpies Topic de les mateixes edicions d’estudi** a `hidden-videos.json`, contrastant disc, artista, col·laboració, data i durada; correspondències documentades a `2026-10-14-versions-topic.json`. En total s’afegeixen **22 IDs ocults**. No s’estén aquesta equivalència a directes, remescles, instrumentals ni versions traduïdes.

La baixa explícita de «Mi Amigo José» incorpora també una regla persistent per als noms oficials i Topic/Tema de Repúblika Ska. Les altres exclusions són per ID. Atzembla, Mascarats, Repúblika Ska i Terra Ferma passen de confiança editorial a vigilància lingüística; les peces noves requeriran revisió individual. Aquesta vigilància no oculta automàticament els dubtes.

«Clara nit», «Mozzarella» i «Activa la bomba» es conserven després de llegir les lletres catalanes. La descripció de «Princepeses» inclou una traducció castellana: no es tracta aquesta traducció com a prova de castellà cantat i el cas continua pendent. La Bundu Band, diverses peces de Trast i les versions sense lletra accessible continuen pendents; no s’han retirat només pel títol.

L’inventari `2026-10-14-abast-noves-incorporacions.json` diferencia les exclusions (també les anteriors d’AlQuadrat), les lletres comprovades i els vídeos sense verificació individual en aquesta passada. Les lletres completes no es reprodueixen al repositori.

## Comprovacions

- Aplicació dels set lots validada amb `--dry-run` abans d’escriure.
- 39 proves del procés de revisió correctes; proves de categories, noms de canal, llançaments, seleccions i revisió d’idiomes correctes.
- Prova nova de baixa de Repúblika Ska correcta; manté «Entre llençols» i no afecta artistes homònims.
- Casos nous de neteja de títols correctes. El test global del feed sobre parèntesis detecta una fallada anterior amb `UNOFFICIAL RMX`: el netejador de la base `3712891` retorna exactament el mateix resultat. No es modifica aquesta indicació de versió.
- Les deu pistes de Gato són úniques, estan aprovades documentalment, no són ocultes i produeixen un àlbum ordenat de deu pistes.
- `npm run lint`: cinc errors previs a `js/data.js` i `js/features/home-sections.js`; SHA Git dels dos fitxers idèntic al de la base. Cap error al netejador modificat.

El canvi del navegador segueix la publicació automàtica existent. El registre editorial i les exclusions es desen a main; la disponibilitat efectiva del disc depèn de la ingestió programada, i la publicació web depèn del desplegament.
