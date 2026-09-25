# Validació funcional — flux de consentiment progressiu de YouTube

## Objectiu

Validar de punta a punta el flux introduït en les fases 1-6, assegurant que:

- la navegació no depèn d'iframes precarregats,
- la reproducció només s'activa després d'un consentiment explícit,
- la preferència es pot revisar i canviar des de dins de l'app,
- els estats antics no reactiven comportaments heretats.

## Escenaris mínims a comprovar

### 1. Primera visita sense consentiment
- Entrar a l'app amb l'emmagatzematge local buit.
- Verificar que el banner és visible.
- Verificar que no hi ha reproducció automàtica.

**Resultat esperat:** es pot navegar, però no es carrega el reproductor de YouTube abans d'una acció explícita.

### 2. Obrir una fitxa de vídeo sense consentiment
- Clicar una targeta de vídeo des del feed o des d'una llista.
- Verificar que la pàgina del vídeo s'obre amb previsualització interna.
- Verificar que no hi ha iframe de YouTube actiu només per haver entrat a la fitxa.

**Resultat esperat:** la fitxa mostra caràtula i acció de reproducció, però el reproductor no es crea encara.

### 3. Intentar reproduir un vídeo sense consentiment
- Des de la fitxa del vídeo, clicar el botó de reproducció.
- Verificar que s'obre un modal intern de consentiment.

**Resultat esperat:** la reproducció queda bloquejada fins a una decisió explícita.

### 4. Acceptar el modal contextual
- Acceptar el consentiment des del modal contextual del vídeo.
- Verificar que es reprodueix exactament el vídeo pendent.

**Resultat esperat:** l'app desa el consentiment i reprèn la reproducció correcta sense salts de context.

### 5. Cancel·lar el modal contextual
- Tancar o cancel·lar el modal contextual sense acceptar.
- Verificar que l'usuari continua a la mateixa pantalla.

**Resultat esperat:** no hi ha reproducció i la navegació continua intacta.

### 6. Shorts sense consentiment
- Obrir un Short sense consentiment acceptat.
- Verificar que es mostra el mateix modal intern abans de carregar el reproductor.

**Resultat esperat:** el Short no crea iframe fins a l'acceptació.

### 7. Configuració interna de preferències
- Obrir Configuració.
- Revisar la secció "Privacitat i YouTube".
- Activar o desactivar YouTube des d'aquesta secció.

**Resultat esperat:** la preferència es reflecteix a la UI i es pot canviar sense dependre del banner inicial.

### 8. Persistència i formats antics
- Simular o revisar valors antics / simples al storage.
- Verificar que el format es normalitza al model estructurat actual.

**Resultat esperat:** no es recuperen autoritzacions implícites antigues i el storage queda sanejat.

### 9. Accessibilitat del modal i de les preferències
- Obrir el modal contextual amb teclat o lector de focus.
- Tancar-lo amb la tecla `Escape`.
- Verificar que el focus torna al control anterior i que els botons de preferències reflecteixen correctament l'estat actiu.

**Resultat esperat:** el flux continua sent usable sense ratolí i els controls exposen un estat coherent.

## Comprovacions tècniques executades en aquesta fase

### Validació automatitzada disponible al repositori
- `npm test`
- `node --check js/app.js && node --check js/features/shorts.js`

### Limitació coneguda del repositori
- `npm run lint` continua fallant per un error preexistent de parsing a `vitest.config.js` i per warnings històrics no relacionats amb aquest flux.

## Criteri de tancament de la fase

Aquesta fase es dona per tancada quan:

- el flux de vídeo i Shorts queda cobert pels escenaris anteriors,
- el consentiment es pot gestionar des del banner, des del modal contextual i des de la configuració,
- la persistència no reintrodueix comportaments antics,
- i la validació tècnica mínima del repositori continua passant sense regressions noves.
