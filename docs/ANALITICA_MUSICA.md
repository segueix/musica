# Analítica exclusiva de Segueix Música

Panell: https://segueix.github.io/musica/?analytics=1

Conserva el panell de Segueix: usuaris únics i recurrents, comptadors, evolució diària, dispositius, estils, períodes de 7/30/90 dies, interval personalitzat i PDF local. Les obertures de cançons no equivalen a escoltes completes. El panell no genera visites.

GitHub Pages només serveix fitxers estàtics. El client de Música envia els comptadors i consulta el resum a https://segueix.cat/api/music-analytics, desplegat des de segueix/Segueix. La mateixa implementació es conserva a functions/api/analytics.js d’aquest repositori per a un futur allotjament amb Functions.

El servidor fa servir exclusivament SEGUEIX_SYNC i el prefix music:analytics:v1:. No llegeix ni escriu analytics:v1: de Segueix ni fa servir el dataset compartit d’Analytics Engine. Les noves dades es recullen a partir d’aquest desplegament; no s’atribueixen les dades anteriors de Segueix a Música.

L’accés requereix MUSIC_ANALYTICS_ADMIN_TOKEN si està configurat; en cas contrari, el token administratiu ANALYTICS_ADMIN_TOKEN ja existent de Segueix. Cap token s’inclou al repositori. El navegador el conserva només a sessionStorage, amb una clau exclusiva de Música. Les peticions CORS només admeten el mateix origen del servidor i https://segueix.github.io, inclòs el preflight per Authorization i JSON.

L’identificador anònim del navegador té una clau local pròpia de Música i rota cada 90 dies. El servidor el transforma amb SHA-256. No es recullen IP, user-agent, textos de cerca ni IDs de cançons o artistes. Es conserva la preferència de desactivar l’analítica des de Configuració.

Verificació: tests/analytics.test.js (17 proves, inclosos CORS, autenticació i segregació de dades); al servidor, tests/music-analytics.test.js cobreix els mateixos contractes d’aïllament. No enviar esdeveniments ficticis a producció per provar el panell.
