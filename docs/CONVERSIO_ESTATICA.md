# Conversió de Música a web estàtica

Petició del 16/10/2026. La retirada de Drive i analítiques és la primera fase; no equival encara a tenir el repositori preparat per connectar-lo directament a Cloudflare Pages.

## Diagnòstic

- L’app és HTML/CSS/JavaScript i llegeix el catàleg, els arxius i la cerca des de JSON. El workflow actual de GitHub Pages ja exclou `functions` de l’artefacte.
- El mapa és propi (`artist-map.js`) i utilitza dades locals (`mapa-base.json`, `origens-artistes.json`, `proximitat-musical.json`). No cal substituir-lo per un servei de mapes.
- Encara existeixen middleware, rutes SEO d’artistes, vídeos i categories, sitemaps dinàmics i `/api/music-admin`. Si es connecta el repositori directament a Cloudflare, cal retirar o traslladar `functions` fora de l’arrel detectada; excloure-la només de la carpeta de sortida no és suficient.
- Les analítiques de Música apuntaven a `https://segueix.cat/api/music-analytics`, fora d’aquest repositori. Aquesta fase retira el client i la còpia local de l’API; no modifica el desplegament ni les dades històriques d’aquell altre projecte.

## Fases

| Fase | Feina | Criteri de finalització |
| --- | --- | --- |
| 1. Dades personals locals | Retirar Drive/OAuth, temporitzadors i analítiques. Oferir Descarregar .json i Importar .json. Actualitzar privacitat i memòria cau. | Implementada en aquesta proposta; proves de còpia entre dos emmagatzematges, validació, cancel·lació, falta d’espai i actualització de vista. |
| 2. Rutes i SEO estàtics | Generar abans de publicar les pàgines d’artistes, cançons i estils, metadades socials, canònics i sitemaps. Reutilitzar el generador de `compartir/`. Adaptar enllaços, rutes antigues, 404 i arrel de l’app al domini final. | Cada URL pública es pot obrir i recarregar en un servidor de fitxers sense Functions. Els robots reben les metadades al mateix HTML. |
| 3. Dependències del servidor | Retirar middleware i Functions després de substituir-ne les rutes. Adaptar l’administració musical perquè exporti canvis per aplicar-los al repositori. Revisar els camins alternatius de YouTube API al client. | Cap funció de la web pública necessita `/api/` propi, KV ni credencials al navegador. El catàleg públic prové només dels JSON generats. |
| 4. Actualització de dades i paquet | Conservar la ingesta de YouTube a GitHub, la passada diària de les 20 h Europe/Madrid i els torns 1/3/7 dies. Integrar generació estàtica, Service Worker i artefacte en una sola publicació. | Un catàleg nou produeix una publicació coherent sense cadenes addicionals d’Actions ni consultes a YouTube per visitant. |
| 5. Validació i rendiment | Provar cerca, artistes/discos, mapa, ràdios, llistes, reproducció, JSON, enllaços compartits i actualització d’una PWA antiga. Mesurar càrrega mòbil i corregir coll d’ampolla amb dades. | Web funcional sense backend propi; dades fresques i absència de peticions retirades. No es promet una puntuació PageSpeed sense mesurar-la. |
| 6. Cloudflare | Preparar un desplegament de prova amb l’artefacte estàtic; configurar domini, redireccions i memòria cau; comprovar que no es desplegui cap Function/Worker. Fer el canvi públic després de validar-lo. | Mateix funcionament al domini final i pla de retorn a la versió anterior. |

## Còpies JSON

Format `product: segueix-musica`, `v: 1`, amb data i camps musicals explícits. Inclou historial (fins al límit de 50 de l’app), m’agrada, seguits, llistes, categories, gustos, senyals musicals locals i opcions d’aspecte. No inclou credencials, consentiments, memòria cau ni la cua activa. No s’importa automàticament una còpia de l’app Segueix de YouTubers.

Importar substitueix les dades musicals després de validar-les i demanar confirmació. Si fallen les escriptures, es restaura l’estat anterior; només es pot alliberar memòria cau regenerable. La música no es recarrega. La preferència de YouTube es conserva al mateix aparell. Les còpies antigues a Drive no s’esborren remotament.

En canviar de domini, el navegador utilitza un emmagatzematge diferent: cal descarregar la còpia al domini antic i importar-la al nou. Això forma part de la migració.

## Verificació d’aquesta fase

- 64 proves dirigides superades: JSON, vista en viu, favorits, senyals locals, recuperació de reproducció, feed i exclusió del progrés local de les còpies.
- `npm run lint`: cinc errors preexistents, reproduïts abans del canvi, a `js/data.js` i `js/features/home-sections.js`; cap error nou.
- Dues proves d’integració antigues fallen també a la base: una exigeix un hash de SW literal de setembre i l’altra confon una referència inline a user-categories amb l’ordre dels scripts. No s’han modificat aquests casos aliens a la conversió.
- No s’ha executat la suite completa, ni la reproducció real de YouTube, ni un desplegament a Cloudflare.

## Referències d’allotjament

- https://developers.cloudflare.com/pages/framework-guides/deploy-anything/
- https://developers.cloudflare.com/pages/functions/get-started/ — `functions` es detecta a l’arrel del projecte, no només a la carpeta de sortida.

Una web estàtica continua necessitant xarxa per reproduir YouTube i obtenir els recursos externs que conservi. El que s’elimina és l’execució pròpia de servidor per atendre les visites.
