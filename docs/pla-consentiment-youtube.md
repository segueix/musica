# Pla intern — desacoblament de YouTube i consentiment progressiu

## Objectiu

Definir un procés intern, executat per fases, per eliminar la dependència prematura amb YouTube abans del consentiment de l'usuari i reconstruir la reproducció de vídeos amb un flux progressiu, controlat des de la mateixa app i validat pas a pas.

Aquest document és intern i descriu el full de ruta de treball. Cada fase inclou:

- objectiu concret,
- accions d'implementació,
- comprovació obligatòria abans de passar a la fase següent,
- criteri de tancament.

## Principi rector

Abans del consentiment explícit per reproduir contingut extern:

- la web ha de poder navegar-se amb normalitat,
- la UI ha de continuar sent coherent i pròpia,
- no s'ha de carregar cap reproductor ni recurs de YouTube vinculat a la reproducció,
- no s'ha de permetre que YouTube mantingui la inèrcia actual d'entendre que pot carregar vídeos o cookies abans que l'usuari ho decideixi.

---

## Fase 1 — Trencar del tot el vincle inicial amb YouTube a nivell de cookies i càrrega automàtica

### Objectiu

Eliminar qualsevol vincle prematur entre la web i YouTube abans del consentiment, especialment tot allò que permeti que YouTube continuï operant com si ja tingués autorització implícita per carregar vídeos, cookies o recursos associats.

### Accions

1. Identificar tots els punts on la web carrega recursos de YouTube de manera directa o indirecta.
2. Localitzar qualsevol iframe, embed, script, URL d'imatges, preload, preconnect o navegació automàtica relacionada amb YouTube.
3. Tallar temporalment la càrrega automàtica del reproductor en qualsevol pantalla o ruta.
4. Evitar que la simple entrada a la web, a una fitxa o a una llista de vídeos generi cap connexió amb YouTube.
5. Revisar si hi ha persistència local de consentiments anteriors, estats del reproductor o senyals que facin que la web es comporti com si YouTube ja estigués autoritzat.
6. Si existeixen cookies, flags o persistències pròpies que reactiven el reproductor, redefinir-les o invalidar-les dins del nou model.

### Comprovació obligatòria

Abans de donar aquesta fase per bona, cal verificar manualment i tècnicament que:

- entrant a la web no es carrega cap iframe de YouTube,
- entrant a una llista de vídeos no es fa cap petició a dominis de YouTube associats a reproducció,
- obrint una fitxa de vídeo sense reproduir no s'activa el reproductor,
- no hi ha cap inicialització silenciosa que recuperi la relació anterior amb YouTube.

### Criteri de tancament

La fase queda tancada quan l'app pot mostrar contingut i navegar sense que YouTube intervingui abans d'una acció explícita de reproducció.

---

## Fase 2 — Separar visualització de contingut i reproducció real

### Objectiu

Fer que la web pugui mostrar vídeos com a contingut editorial intern, però sense convertir aquesta visualització en una reproducció ni en una càrrega del servei extern.

### Accions

1. Mantenir dins de la web totes les llistes, targetes, caràtules, títols i metadades.
2. Garantir que les caràtules i els elements previs es serveixin de manera interna o controlada, sense dependència directa de l'embed.
3. Assegurar que clicar una targeta o una caràtula sense consentiment no obre encara el reproductor.
4. Definir clarament el punt a partir del qual una acció es considera “voler reproduir” i no simplement “voler veure informació”.

### Comprovació obligatòria

- L'usuari pot navegar per vídeos i seccions sense reproducció automàtica.
- Les fitxes informatives es poden obrir sense carregar YouTube.
- El clic sobre una targeta sense consentiment no genera encara una reproducció real.

### Criteri de tancament

La web distingeix correctament entre navegar contingut i reproduir-lo.

---

## Fase 3 — Introduir un control de consentiment contextual i intern

### Objectiu

Substituir qualsevol dependència del navegador o del sistema per un control de consentiment propi de l'app, coherent amb el disseny visual.

### Accions

1. Crear un modal intern integrat dins la UI de l'app.
2. Fer que aquest modal aparegui només quan l'usuari intenta iniciar la reproducció d'un vídeo sense consentiment previ.
3. Redactar un missatge curt, clar i neutre que expliqui que cal activar el contingut extern per reproduir el vídeo.
4. Afegir com a mínim dues opcions: acceptar i continuar, o cancel·lar / ara no.
5. Evitar qualsevol popup del sistema, alert del navegador o canvi brusc de context.

### Comprovació obligatòria

- El modal apareix dins de la mateixa pàgina i amb el disseny de la web.
- Cap clic de reproducció sense consentiment carrega encara YouTube abans de confirmar.
- Si l'usuari tanca el modal o rebutja, continua a la mateixa pantalla sense trencar el flux.

### Criteri de tancament

La petició de consentiment es fa només quan cal i sempre des de la pròpia app.

---

## Fase 4 — Activar la reproducció només després d'una acceptació explícita

### Objectiu

Fer que YouTube només entri en joc després d'una decisió explícita i contextual de l'usuari.

### Accions

1. Quan l'usuari prem "acceptar i continuar", registrar la decisió en el model de consentiment nou.
2. Només després d'aquest pas carregar el reproductor o el recurs extern necessari.
3. Fer que la transició des del modal fins a la reproducció sigui fluida i coherent.
4. Garantir que el vídeo que l'usuari havia intentat veure sigui el primer que s'obri després de l'acceptació.

### Comprovació obligatòria

- Fins al clic d'acceptació no hi ha connexió amb YouTube.
- Després de l'acceptació es carrega correctament el vídeo seleccionat.
- El consentiment no fa fallar la navegació ni provoca salts estranys de pantalla.

### Criteri de tancament

La reproducció queda completament lligada a un consentiment explícit i verificable.

---

## Fase 5 — Persistir l'estat sense recuperar inèrcies antigues

### Objectiu

Guardar la decisió de l'usuari de forma controlada, evitant que es recuperin patrons antics o permisos implícits previs.

### Accions

1. Definir on i com es desa el consentiment dins del model nou.
2. Revisar quines claus locals antigues poden entrar en conflicte.
3. Migrar o invalidar els valors antics que facin que la reproducció es reactivi indegudament.
4. Garantir que, si l'usuari no ha acceptat, la web no reutilitza cap estat històric per saltar-se el nou flux.

### Comprovació obligatòria

- En una sessió nova sense consentiment, el flux continua bloquejant la reproducció.
- En una sessió amb consentiment acceptat, la reproducció funciona segons el model definit.
- Netejar dades antigues no reobre automàticament la connexió amb YouTube.

### Criteri de tancament

El sistema nou governa el comportament de manera consistent, sense dependència d'estats heretats.

---

## Fase 6 — Afegir opcions de revisió i canvi de preferències

### Objectiu

Permetre que l'usuari revisi i modifiqui la seva decisió sense haver de dependre d'un nou bloqueig d'entrada.

### Accions

1. Crear un punt d'accés visible des de configuració o privacitat.
2. Permetre activar o desactivar la funcionalitat externa des d'aquest espai.
3. Si l'usuari revoca l'acceptació, tornar immediatament al comportament sense reproducció automàtica.
4. Mantenir una explicació breu del que implica cada decisió.

### Comprovació obligatòria

- L'usuari pot canviar la preferència sense recarregar forçosament tota l'app.
- Revocar el consentiment impedeix noves reproduccions fins a una nova acceptació.
- El canvi no deixa la UI en un estat inconsistent.

### Criteri de tancament

El consentiment és reversible i gestionable des de dins de l'app.

---

## Fase 7 — Validació funcional completa del flux

### Objectiu

Comprovar de punta a punta que el model nou funciona tant en primera visita com en usos recurrents.

### Accions

1. Testar primera visita sense consentiment.
2. Testar clic a vídeo sense consentiment.
3. Testar acceptació contextual i reproducció immediata.
4. Testar rebuig i permanència dins de la web.
5. Testar revocació posterior.
6. Testar sessió nova amb i sense persistència.
7. Testar navegació entre llistes, fitxes i reproductor.

### Comprovació obligatòria

Cal validar aquests escenaris mínims:

- es pot entrar i navegar sense carregar YouTube,
- reproduir demana consentiment amb modal intern,
- rebutjar manté la navegació intacta,
- acceptar permet reproduir només a partir d'aquell moment,
- revocar torna a bloquejar les reproduccions futures.

### Criteri de tancament

Tot el recorregut d'usuari queda validat i no hi ha regressions visibles.

---

## Ordre de treball recomanat

1. Fase 1 — desacoblament total inicial.
2. Fase 2 — separació entre navegació i reproducció.
3. Fase 3 — modal intern de consentiment.
4. Fase 4 — activació contextual de reproducció.
5. Fase 5 — persistència neta del nou model.
6. Fase 6 — gestió posterior de preferències.
7. Fase 7 — validació integral.

## Seguiment d'execució

- [x] **Missatge 1 / Fase 1**: neteja de consentiments antics, eliminació de l'autoplay ocult i reset de sessions incrustades abans del nou flux.
- [x] **Missatge 2 / comprovació Fase 1**: verificat a nivell de codi que la navegació ja no precarrega l'iframe abans d'entrar a la pàgina del vídeo.
- [x] **Missatge 2 / inici Fase 2**: la pàgina de vídeo passa a mostrar primer una previsualització interna amb caràtula i acció de reproducció, separant visualització i playback real.
- [x] **Missatge 3 / Fase 3**: la reproducció contextual obre un modal intern de consentiment dins de la mateixa app, tant per vídeos com per Shorts, sense popups del sistema.
- [x] **Missatge 4 / Fase 4**: l'acceptació contextual ja reactiva exactament el vídeo o Short pendent, reutilitzant el nou estat de consentiment sense prerender ocult.
- [x] **Missatge 5 / Fase 5**: el consentiment es desa amb un registre estructurat i versionat, i els formats antics es normalitzen o s'invaliden per evitar recuperar inèrcies prèvies.
- [x] **Missatge 6 / Fase 6**: la preferència de YouTube es pot revisar i canviar des de la configuració de la mateixa app, amb estat visible i accions dedicades.
- [x] **Missatge 7 / Fase 7**: queda documentada la validació funcional completa del flux, amb escenaris mínims, comprovacions tècniques i criteri de tancament.
- [x] **Missatge extra / Fase nova**: reforç d'accessibilitat i robustesa del modal, amb restauració de focus, tancament per tecla `Escape` i estat accessible dels controls de preferències.

## Regla operativa per a les següents iteracions

No es començarà una fase nova sense haver fet la comprovació explícita de la fase anterior.

Cada iteració futura haurà d'incloure:

- acció concreta de desenvolupament,
- comprovació concreta de resultat,
- confirmació explícita abans de passar a la fase següent.

## Primera decisió ja fixada per aquest document

El primer pas del projecte serà aquest:

**esborrar totalment el vincle amb YouTube a nivell de cookies, càrrega automàtica i inèrcies prèvies de reproducció, per impedir que el servei continuï interpretant que pot activar vídeos abans d'un consentiment explícit dins del nou flux.**
