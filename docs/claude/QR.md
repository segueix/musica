# QR.md — Full de ruta per a Claude

## Estat de les fases

| Fase | Títol | Estat |
|------|-------|-------|
| 1 | Eliminar Google Sheets i preparar el nou canal de compartició ràpida per URL comprimida | ✅ Completada |
| 2 | Definir l'estructura JSON de còpia de seguretat per Llistes, Categories i Historial | ✅ Completada |
| 3 | Implementar exportació i importació JSON manuals amb modes Substituir i Afegir | ✅ Completada |
| 4 | Implementar generació de QR per Llistes i Categories amb branding Segueix i exportació PNG | ⏳ En espera de comprovació |
| 5 | Eliminar el sistema antic de PIN/número i deixar QR per Llistes, Categories d'usuari i Visualitzacions | ⏳ Pendent |

---

## Dependències detectades

### Fase 1

- `SEGUEIX_API_URL` estava definida a `js/config.js` i usada a 3 fitxers (`app.js`, `features/shared-playlists.js`, `features/config-sync.js`)
- `grecaptcha` / reCAPTCHA estava integrat a `shareCategoryWithYoutubers`, `shareSegueixPlaylist` i `submitYoutuber` (app.js) i a `generateConfig` (config-sync.js)
- `getOrCreateApiClientKey()` a `storage.js` s'usava com a identificador de client per a les crides a Google Sheets — conservada perquè pot tenir altres usos
- La UI del "codi numèric" (Generar/Enviar) estava a index.html dins la secció "Enviar configuració entre dispositius"
- El paràmetre `?cat=` feia un GET a `SEGUEIX_API_URL?type=category&id=`
- El paràmetre `?list=` feia un GET a `SEGUEIX_API_URL?id=`
- `submitYoutuber()` feia un POST a `SEGUEIX_API_URL` amb reCAPTCHA

### Fitxers modificats a la Fase 1

- `js/config.js` — eliminada `SEGUEIX_API_URL`
- `js/features/config-sync.js` — eliminades `generateConfig` i `importConfig` (Google Sheets); conservades `exportConfigManual`, `importConfigManual`, `clearAllData`
- `js/features/shared-playlists.js` — eliminada la crida a `SEGUEIX_API_URL?id=`; afegit missatge d'obsolescència per `?list=`
- `js/app.js` — eliminades `getSecurityCooldownMessage`, `shareCategoryWithYoutubers` (v. Google Sheets), `shareSegueixPlaylist` (v. Google Sheets), `submitYoutuber` (v. Google Sheets); substituïdes per versions basades en `share-codecs.js`; afegida `handleImportDataParam()`; substituït handler `?cat=` per avís d'obsolescència
- `js/utils/share-codecs.js` — creat nou (Canal A: `buildImportPayload`, `encodeImportPayload`, `decodeImportPayload`, `buildImportUrl`)
- `index.html` — eliminat reCAPTCHA script; afegit lz-string CDN; afegit `share-codecs.js`; substituïda la UI del codi numèric per text provisional

### Fitxers creats/modificats a la Fase 2

- `js/utils/backup-codecs.js` — creat nou (Canal B): `buildPlaylistsBackup`, `buildCategoriesBackup`, `buildHistoryBackup`, `validateBackup`
- `tests/backup-codecs.test.js` — 9 tests nous per validar les 3 estructures + validació
- `index.html` — afegit `backup-codecs.js` a l'ordre de càrrega

### Fitxers creats/modificats a la Fase 3

- `js/utils/backup-codecs.js` — ampliat amb: `exportPlaylists`, `exportCategories`, `exportHistory`, `importPlaylists`, `importCategories`, `importHistory`, `register`, `_showImportModeModal`, modal de selecció Substituir/Afegir, anti-duplicats
- `index.html` — substituïda la secció "Versió Manual" per botons separats d'exportar/importar Llistes, Categories, Historial
- `js/app.js` — afegit `SegueixApp.utils.backupCodecs.register()` al pipeline d'inicialització

### Fitxers creats/modificats a la Fase 4

- `js/utils/qr-share.js` — creat nou: `showQrModal` (modal QR amb branding), `_downloadQrAsPng` (exportació PNG composta), `sharePlaylistQr`, `shareCategoryQr`
- `js/app.js` — `handleImportDataParam()` ara mostra vista de recepció completa amb branding SEGUEIX + botó Importar funcional; `_showShareOptionsModal()` nou modal amb opcions Compartir/QR/Copiar; `shareCategoryWithYoutubers` i `shareSegueixPlaylist` ara deleguen al modal d'opcions; `handleCategoryShare` simplificat
- `index.html` — afegit `qr-code-styling` CDN + `qr-share.js`
- `js/utils/backup-codecs.js` — fix race condition `_pendingImportType`

---

## Regla de treball per a Claude

- Només executar una fase per vegada
- Al final de cada fase, aturar-se
- Al final de cada fase, indicar exactament què s'ha de comprovar a la interfície
- No avançar a la fase següent sense validació explícita de l'usuari
- Si es detecta una dependència no prevista, documentar-la aquí abans de tocar-la

---

## Objectiu general del projecte

Eliminar completament la dependència de Google Sheets i del sistema antic de generació de links/números remots, i substituir-la per dos canals separats:

- **Canal A: compartició ràpida per URL comprimida + QR**
- **Canal B: exportació/importació manual per fitxers JSON**

Això és important:

- Els QR no substitueixen els fitxers JSON
- Els fitxers JSON no substitueixen els QR
- Els QR s'han d'utilitzar per compartir ràpidament llistes, categories i visualitzacions recents
- Els JSON s'han d'utilitzar per còpia de seguretat, migració manual i restauració completa

---

## Arquitectura objectiu

### Canal A — Compartició ràpida

El sistema nou de compartició ràpida ha de:

- Construir un objecte de dades mínim
- Serialitzar-lo a JSON
- Comprimir-lo amb `lz-string`
- Posar-lo a la URL amb un paràmetre tipus `?importData=`
- Generar un QR a partir d'aquesta URL
- Permetre obrir el link directament sense servidor

Aquest canal servirà per:

- Llistes
- Categories personalitzades
- Categories intel·ligents
- Visualitzacions recents

### Canal B — Exportació/importació manual

El sistema de còpia de seguretat ha de:

- Exportar fitxers JSON separats
- Importar fitxers JSON separats
- Permetre `Substituir` o `Afegir`
- Evitar duplicats quan s'importa en mode `Afegir`

Fitxers esperats:

- `segueix-playlists.json`
- `segueix-categories.json`
- `segueix-history.json`

---

## Disseny obligatori del sistema QR

Cada QR generat ha de mostrar-se dins d'una peça visual compartible, no només com un codi cru.

Ordre visual obligatori:

- Logo/capçalera: `SEGUEIX! Els nostres YouTubers`
- Subtítol dinàmic segons el tipus:
  - `Llista: {Nom}`
  - `Categoria: {Nom}`
  - `Visualitzacions: {descriptor}`
- QR a sota
- Botó per desar com a PNG
- Opcionalment botó per compartir i copiar enllaç

El mateix branding s'ha de veure a la vista de recepció del link compartit.

---

## Disseny obligatori de la vista de recepció

Quan s'obri un enllaç amb `?importData=`:

- S'ha de mostrar la capçalera `SEGUEIX! Els nostres YouTubers`
- S'ha de mostrar el tipus i nom del contingut
- S'ha de previsualitzar què s'importarà
- S'ha d'oferir com a mínim un botó d'`Importar`
- No s'ha de limitar a un `console.log`

---

## Separació conceptual obligatòria dins el codi

- `importData` és per compartició ràpida i QR
- L'exportació/importació JSON massiva és un canal separat

---

# FASE 1 — Eliminar Google Sheets i preparar el nou canal de compartició ràpida per URL comprimida

## Objectiu

Fer desaparèixer tota la dependència de Google Sheets i del sistema actual de compartició remot. Preparar el nou sistema perquè la compartició ràpida funcioni amb dades incrustades a la URL, sense servidor.

## Fitxers a revisar

- `js/features/shared-playlists.js`
- `js/utils/id-codecs.js`
- Qualsevol fitxer on existeixi `SEGUEIX_API_URL`
- Qualsevol fitxer on es generin links per Google Sheets o per id remot
- Qualsevol fitxer d'UI on aparegui compartir amb número, compartir remotament o importar via id
- `app.js` o el punt d'entrada equivalent

## Tasques

- Auditar tot el flux actual de Google Sheets i documentar-lo breument
- Eliminar imports, constants, helpers, URLs, fetches i botons relacionats amb Google Sheets
- Substituir el sistema antic per una utilitat nova de compartició ràpida basada en URL comprimida
- Integrar `lz-string` de manera compatible amb Vanilla JS
- Crear `js/utils/share-codecs.js` amb:
  - `buildImportPayload(data)`
  - `encodeImportPayload(payload)`
  - `decodeImportPayload(value)`
  - `buildImportUrl(payload)`
- Generar URLs del tipus `https://.../?importData=...`
- Afegir listener de càrrega que detecti `importData`, el descomprimeixi, en validi el JSON i mostri el resultat provisionalment

## Comprovació obligatòria

- Que ja no s'obre ni s'utilitza Google Sheets enlloc
- Que compartir una llista o categoria genera una URL llarga amb `?importData=`
- Que en obrir aquesta URL, l'app pot descodificar el payload
- Que el projecte no té errors de consola derivats de dependències mortes

---

# FASE 2 — Definir l'estructura JSON de còpia de seguretat per Llistes, Categories i Historial

## Objectiu

Implementar els tres formats JSON separats per exportació/importació manual massiva.

## Tasques

- Crear utilitat per construir payloads d'exportació manual
- Definir tres tipus: `playlists`, `categories`, `history`
- Incloure metadades: `type`, `version`, `exportedAt`, `items`
- Definir estructura de categories intel·ligents vs personalitzades

## Formats mínims

### `segueix-playlists.json`

```json
{
  "type": "playlists",
  "version": 1,
  "exportedAt": "ISO_DATE",
  "items": []
}
```

### `segueix-categories.json`

```json
{
  "type": "categories",
  "version": 1,
  "exportedAt": "ISO_DATE",
  "items": []
}
```

Cada item de categories:

```json
{
  "id": "...",
  "kind": "custom | smart",
  "name": "...",
  "channels": [],
  "rules": {}
}
```

### `segueix-history.json`

```json
{
  "type": "history",
  "version": 1,
  "exportedAt": "ISO_DATE",
  "items": []
}
```

## Comprovació obligatòria

- Verificar que els tres formats tenen l'estructura correcta
- Verificar que cada format té metadades de versió i data
- Verificar que categories intel·ligents i personalitzades es poden distingir

---

# FASE 3 — Implementar exportació i importació JSON manuals amb modes Substituir i Afegir

## Objectiu

Afegir la capa completa d'exportació/importació manual per migració entre dispositius i còpies de seguretat.

## Tasques

- Crear botons separats per exportar Llistes, Categories i Historial
- Crear botons separats per importar Llistes, Categories i Historial
- Usar `FileReader` i `JSON.parse()`
- Oferir dos modes: `Substituir` i `Afegir`
- Implementar anti-duplicats:
  - Historial: ignorar `videoId` ja existents
  - Llistes: no duplicar per `id`, fallback per `name`
  - Categories: no duplicar per `id` i `name`

## Comprovació obligatòria

- Exportar una llista i reimportar-la
- Exportar una categoria i reimportar-la
- Exportar historial i provar `Afegir` sense duplicar visualitzacions
- Provar `Substituir` i comprovar que reemplaça l'estat anterior

---

# FASE 4 — Implementar generació de QR per Llistes i Categories amb branding Segueix i exportació PNG

## Objectiu

Crear la UI i la lògica per generar QR visuals compartibles per elements individuals.

## Requisits visuals

- Capçalera: `SEGUEIX! Els nostres YouTubers`
- Subtítol: `Llista: {Nom}` o `Categoria: {Nom}`
- QR a sota
- Botó `Descarregar imatge`

## Requisits tècnics

- Integrar llibreria compatible (`qr-code-styling` o equivalent)
- Configurar correcció d'errors alta
- QR amb URL `?importData=` de la Fase 1
- Modal o component flotant reutilitzable
- Imatge descarregable com a PNG
- Vista de recepció amb branding

## Comprovació obligatòria

- Generar QR d'una llista i comprovar el modal
- Generar QR d'una categoria i comprovar el modal
- Descarregar la imatge PNG
- Obrir o escanejar el QR i verificar vista de recepció amb branding + importació

---

# FASE 5 — Eliminar el sistema antic de PIN/número i deixar QR per Llistes, Categories d'usuari i Visualitzacions

## Objectiu

Tancar la migració substituint definitivament el sistema antic de codi numèric entre dispositius.

## Tasques

- Eliminar qualsevol rastre de PIN, número o identificador antic
- Afegir tres opcions QR:
  - `Generar QR — Llistes`
  - `Generar QR — Categories de l'usuari`
  - `Generar QR — Visualitzacions`
- Deixar a sota els botons manuals d'exportació/importació
- Limitar QR de visualitzacions als últims 25 vídeos
- Mostrar avís: `El QR només comparteix l'activitat recent. Per a tot l'historial, utilitza l'exportació d'arxius.`

## Comprovació final obligatòria

- Confirmar que ja no existeix cap PIN o número antic a la interfície
- Confirmar que hi ha tres opcions QR visibles
- Confirmar que el QR de visualitzacions només usa activitat recent
- Confirmar que l'export/import manual segueix visible i funcional

---

## Tancament

Quan totes les fases estiguin `✅ Completades`:

### Possibles millores futures

- Lectura de QR des de càmera
- Lectura de QR des d'imatge
- Refinament de categories intel·ligents
- Compressió o validació extra del payload
