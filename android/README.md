# Segueix per a Android: Música i vídeos

Versió: **1.1.0** (`versionCode=2`), paquet `cat.segueix.musica`.
Projecte generat amb **Bubblewrap 1.27.0**. Obre `https://musica.segueix.cat/`
com a Trusted Web Activity i inclou `https://segueix.cat` com a origen verificat.
El nom al mòbil és **Segueix**. S'obre a Música; els botons de la capçalera i els
gestos laterals existents permeten passar als vídeos de Segueix i tornar a Música
dins de la mateixa app. No són dues instal·lacions ni dues finestres.
Sense permisos natius de localització, notificacions,
càmera o micròfon; sense SDK d’analítica. El web conserva el seu funcionament i els
seus proveïdors externs: l’app no amaga la IP a YouTube.

## Instal·lació de prova

Instal·la l’APK signat en un Android 7 o posterior amb un navegador compatible
amb TWA actualitzat, com Chrome. Autoritza la instal·lació des de l’origen triat.
No cal un compte de desenvolupador ni publicar a Google Play per a aquesta prova.

La barra d’adreces només desapareix quan el navegador verifica
`/.well-known/assetlinks.json` a **tots dos dominis** amb el certificat de l’APK.
Sense verificació o sense suport TWA, s’obre una pestanya amb controls de navegador.
Sortir cap a altres dominis també pot mostrar aquests controls.

La versió 1.1.0 s'instal·la sobre la 1.0.0: conserva paquet i clau de signatura.
La còpia privada de recuperació anterior continua sent la correcta.

## Claus i actualitzacions

La clau privada NO forma part del repositori. El titular ha de conservar la còpia
privada de recuperació lliurada amb aquesta versió. No publicar el JKS ni la
contrasenya. La petjada pública del certificat és a `../.well-known/assetlinks.json`.

Les actualitzacions d’instal·lació directa han de conservar el paquet i la signatura,
i augmentar `appVersionCode`. Abans de publicar a Google Play, decidir la gestió de
Play App Signing: la signatura de Play pot diferir i caldrà afegir-ne la petjada a
`assetlinks.json` de tots dos dominis. No substituir aquesta clau de distribució directa sense planificar
la migració dels dispositius ja instal·lats.

## Compilar

Java 17, Android SDK (plataforma 36 i build-tools 35.0.0) i Node 18 o posterior.
La versió de Gradle queda fixada al wrapper del projecte. Les dependències Android
es resolen des de Google Maven i Maven Central.

1. Recuperar la clau privada a `android/keystore/segueix-musica.jks` (carpeta ignorada).
2. Des d’aquesta carpeta, executar `npx --package @bubblewrap/cli@1.27.0 bubblewrap build`.
3. Configurar les rutes locals de Java/SDK quan es demanin i introduir la contrasenya
   de la còpia privada. No incorporar-la als scripts ni a git.
4. Comprovar la signatura amb `apksigner verify --print-certs app-release-signed.apk`.
5. Distribuir l’APK signat; reservar `app-release-bundle.aab` per a Google Play.

El manifest de Bubblewrap és `twa-manifest.json`. El projecte Android generat és
versionat per poder-lo revisar. Si es regenera amb `bubblewrap update`, revisar el
canvi i conservar `mavenCentral()` en lloc de l’antic `jcenter()` de la plantilla.
`additionalTrustedOrigins` conté `segueix.cat` (sense esquema: la plantilla 1.27.0
hi afegeix `https://`). Conservar les declaracions de tots dos orígens a
`strings.xml`, l'entrada `ADDITIONAL_TRUSTED_ORIGINS` i el filtre d'enllaços de
`segueix.cat` a `AndroidManifest.xml`. La plantilla 1.27.0 pot generar diversos
arrays consecutius a `assetStatements`; ha de ser **un únic array JSON** amb els
dos objectes. `node --test scripts/test_android_twa.cjs` ho comprova des de l'arrel.

## Validació abans de distribuir

- Signatura vàlida de l’APK i concordança amb `assetlinks.json`.
- APK de release, no depurable, nom/icona i paquet correctes.
- Fitxer `assetlinks.json` públic per HTTPS, sense redireccions i amb tipus JSON.
- En un mòbil real: inici sense barra d’adreces, reproducció, canvi de cançó,
  ràdios, pas Música → Segueix → Música sense barra, navegació enrere, enllaços
  dels dos dominis i actualització sobre una instal·lació anterior.

Les proves de compilació no substitueixen la prova real al dispositiu. No s’ha
validat reproducció amb pantalla apagada ni s’afegeix aquesta prestació.
