> **Retirat el 16/10/2026.** Document històric: aquesta integració ja no forma part de Música. Vegeu `CONVERSIO_ESTATICA.md` i les còpies JSON locals de Configuració.

# Sincronització amb Google Drive

Implementada el 7 d’octubre de 2026. Substitueix la transferència de configuració i historial per fitxer, WhatsApp, QR i codis de vinculació. La compartició pública d’una llista o categoria continua sent independent.

## Activació del responsable

1. A Google Cloud Console, crea un projecte per a Segueix Música i activa **Google Drive API**.
2. A Google Auth Platform, configura Branding: Segueix Música, correu de suport, web `https://segueix.github.io/musica/` i privacitat `https://segueix.github.io/musica/privacitat.html`.
3. Configura Audience com a External, inicialment Testing, i afegeix els comptes que faran la prova.
4. A Data Access, afegeix només `https://www.googleapis.com/auth/drive.appdata` (no sensible). No demanis accés a tots els documents.
5. A Clients, crea un client OAuth de tipus Web application. Origen JavaScript autoritzat: `https://segueix.github.io`, sense `/musica/`. El flux de finestra emergent no necessita un URI de redirecció de l’app. Per provar en local afegeix l’origen amb el port exacte.
6. Copia l’identificador acabat en `.apps.googleusercontent.com` a `window.SEGUEIX_GOOGLE_DRIVE_CLIENT_ID` dins `js/google-drive-config.js`, publica i regenera el service worker (`npm run sw:version`). És un identificador públic; **no** hi posis cap client secret, token ni clau d’API.
7. Prova amb el mateix compte en dos aparells: afegir, sincronitzar, eliminar, tornar a sincronitzar a tots dos. Prova denegar el permís, cancel·lar la finestra i treballar sense connexió.
8. Per obrir-ho al públic, passa a producció i completa la verificació de marca/domini que Google demani. Els permisos no sensibles no impliquen la revisió dels permisos sensibles. Les proves estan limitades a 100 comptes i l’autorització de proves caduca als set dies.

Quan canviï el domini, afegeix-ne l’origen al mateix client/projecte i actualitza web/privacitat i verificació del domini. Mantenir el projecte conserva l’accés a l’appDataFolder existent; el localStorage del domini anterior no es trasllada automàticament. Primer sincronitza al domini antic i després connecta des del nou.

## Ús

A Configuració, «Connecta amb Google Drive» selecciona el compte i inicia la sessió. Mentre l’autorització temporal sigui vigent i l’app sigui visible i tingui xarxa:
- Els cors, seguits, llistes i preferències s’agrupen uns 10–15 segons després de l’últim canvi; si hi ha canvis continus, el cicle d’un minut també els envia.
- L’historial i les estadístiques es comproven aproximadament cada minut. Les estadístiques pendents es desen sense finalitzar la sessió d’escolta.
- La consulta de versions evita baixar còpies inalterades. No es puja el fitxer propi si el contingut és el mateix.
- En tornar a la pàgina o recuperar la xarxa, es reprèn el cicle pendent. Les peticions s’espaien progressivament davant d’errors (fins a 15 minuts).
- «Sincronitza» permet forçar un intent immediat.

El token només es conserva en memòria. Després de recarregar o quan caduca cal un toc a «Sincronitza» per renovar-lo. Cap temporitzador no obre finestres OAuth. Una renovació permanent sense gestos exigiria un flux de codi amb servidor i refresh tokens; no s’ha implementat en aquesta web estàtica.

Els canvis es desen i s’apliquen a la vista sense recarregar: cors, seguits, biblioteca, categories i preferències. Es conserva el reproductor i la cua activa; no es refà un formulari amb el focus. «Desconnecta» atura l’automatisme en aquell aparell i conserva les còpies locals i de Drive.

No hi ha una prova de 24 hores definida a l’app ni un canvi automàtic a producció. En Google OAuth Testing les autoritzacions de prova caduquen als set dies. Per obrir-ho al públic cal publicar l’app a Google Auth Platform → Audience i completar la verificació que Google demani. Això no elimina la caducitat del token temporal del navegador.

## Dades i conflictes

- Llista explícita: historial (la finestra de 50 cançons que conserva l’app), favorits, artistes seguits, llistes i ordre de cançons, categories pròpies, preferències i estadístiques musicals, estils inicials, mode de descoberta, color de fons, mida de font i ordre d’estils.
- No s’envien tokens, identificadors d’analítica, permisos de YouTube/analítica, memòria cau, posició de reproducció ni altres dades del navegador. Google allotja les dades; aquesta versió no afegeix xifratge d’extrem a extrem.
- Un JSON privat per aparell a `appDataFolder`, amb `appProperties.product=segueix-musica-drive-v1`. Es llegeixen totes les pàgines de resultats. Els aparells mai sobreescriuen el fitxer d’un altre; canvis simultanis convergeixen a les sincronitzacions següents. Les pestanyes del mateix navegador es coordinen amb Web Locks.
- Registres versionats per element, incloses marques d’esborrat. Un aparell desactualitzat no recupera un favorit eliminat que no hagi modificat. En modificar exactament el mateix element en dos llocs guanya la revisió més recent; els empats es resolen per identificador d’aparell. El rellotge local afecta els canvis encara no sincronitzats. La primera connexió combina les dades locals existents amb les de Drive.
- Estadístiques: màxim per comptador, com al sistema anterior, per evitar duplicar escoltes. No és un recompte exacte de sessions concurrents en aparells diferents. Les preferències +/− es conserven per entrada.
- El diari local separa l’estat conegut de la darrera base aplicada: permet recuperar-se d’un error de xarxa sense convertir en eliminacions les dades remotes encara no aplicades. Els canvis fets durant una petició es conserven; si són posteriors a l’enviament, viatgen a la següent sincronització.
- Esborrar dades locals conserva les metadades de Drive per transmetre les eliminacions a la sincronització següent. Esborrar totes les dades del navegador sí que perd aquesta memòria; per esborrar-ho a tot arreu cal eliminar també les dades ocultes de Drive i les còpies locals dels altres aparells.

## Verificació

Proves automàtiques de fusió, eliminacions, concurrència, idempotència, dades malmeses, privacitat, error d’escriptura, compte diferent, paginació i flux OAuth amb una API simulada. La verificació real amb Google requereix completar els passos d’activació: no es pot confirmar una autorització real sense un client OAuth configurat.

Fonts oficials: [token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [appDataFolder](https://developers.google.com/workspace/drive/api/guides/appdata), [verificació de marca](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification).

