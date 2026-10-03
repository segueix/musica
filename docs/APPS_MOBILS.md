# Aplicacions mòbils — Segueix Música

## Android / Google Play

Estratègia recomanada: TWA (Trusted Web Activity) quan el domini definitiu pugui publicar Digital Asset Links a l'arrel de l'origen.

Identificador proposat: `cat.segueix.musica`.

La PWA ja disposa de manifest, icones 192/512, mode standalone i service worker. Per una TWA verificada cal publicar `/.well-known/assetlinks.json` al mateix origen de la web amb l'empremta SHA-256 de la clau de signatura de Google Play.

**Important:** si la web continua a `segueix.github.io/musica/`, `assetlinks.json` ha d'estar a `https://segueix.github.io/.well-known/assetlinks.json`, no dins de `/musica/`. Per això no es desa una empremta fictícia en aquest repositori.

Alternativa si no es pot controlar l'arrel del domini: contenidor Android amb WebView del sistema. YouTube permet els WebView proporcionats pel sistema, però s'han de mantenir totes les regles del reproductor.

## iOS / App Store

No s'ha de presentar una simple còpia WebView de la web: Apple pot rebutjar apps que no aportin funcionalitat per sobre d'un lloc web.

Base recomanada: app iOS amb `WKWebView` + integracions natives útils, per exemple:
- navegació i compartició natives;
- Universal Links;
- notificacions natives;
- integració amb controls/estat de l'app quan sigui compatible amb les polítiques de YouTube;
- preferències i estat de sessió ben integrats;
- tractament natiu de connexió, errors i obertura de YouTube.

No implementar reproducció de YouTube en segon pla ni descàrrega/offline fora de les funcions autoritzades per YouTube.

## Mateix producte, dues botigues

La web continua sent la font funcional principal. Android i iOS són contenidors/integracions de plataforma, de manera que la majoria de canvis de catàleg, feeds i interfície es publiquen una sola vegada.
