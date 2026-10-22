# Avisos de cançons pendents d’idioma

Petició editorial del 22/10/2026. El fil de notificacions és https://github.com/segueix/musica/issues/207.

## Activar els correus

1. Obre el fil #207 i prem **Subscribe**. Si ja diu **Unsubscribe**, la subscripció està activa.
2. A https://github.com/settings/notifications activa **Email** per a **Participating, @mentions and custom** (o l’opció equivalent de converses en què participes/que segueixes). També pots activar **On GitHub**.
3. Comprova el correu de notificació i que sigui una adreça verificada. Si hi ha un filtre de tipus d’activitat, inclou els comentaris d’incidències.
4. No cal activar totes les notificacions del repositori. Comprova que no el tinguis en mode **Ignore**.

La configuració personal del correu no es pot canviar des del repositori. Respondre a un correu afegeix un comentari a GitHub, però no aplica aprovacions ni eliminacions de cançons automàticament.

## Funcionament

El pas `avisar_pendents_idioma.cjs` corre després que la feina diària hagi publicat les dades correctament. Es conserva el calendari de les 20 h Europe/Madrid i els torns dels canals. Cap workflow nou, cap consulta addicional a YouTube, cap servei de correu ni clau nous: el bot de GitHub publica un comentari amb el permís `issues: write`.

`data/avisos-idiomes.json` identifica el repositori, la incidència i els 941 IDs que ja eren pendents en preparar el sistema. Aquests IDs són la línia de base: no s’envia un primer correu massiu. No s’ha d’esborrar aquesta llista per reiniciar l’avís.

Només es consideren pistes que continuen a `pendents`, corresponen a artistes vigilats i no estan ocultes. Els marcadors dels comentaris anteriors de `github-actions[bot]` eviten avisos repetits, inclosos reintents i reaparicions. Es consulten totes les pàgines de comentaris. Els comentaris d’altres usuaris no serveixen com a registre d’enviament.

S’envia com a màxim un comentari per passada, amb fins a 100 pistes i enllaços a YouTube. En un lot extraordinari més gran, la resta s’avisa en passades posteriors si continua pendent. Sense novetats no s’envia cap comentari. Es tracta d’entrades noves a la cua, no necessàriament de cançons acabades de publicar.

Una fallada de GitHub no escriu cap marca d’enviament local i no bloqueja la publicació del web. La passada següent torna a consultar els comentaris abans de decidir; no hi ha reintent immediat d’un POST ambigu. Els avisos pendents que ja s’hagin resolt no s’envien. No s’afirma que el correu s’hagi lliurat: depèn de la subscripció, de la configuració personal i del servei de GitHub.

Tancar la incidència pausa els avisos. Reobrir-la els reprèn. Cal conservar els comentaris del bot perquè constitueixen el registre de notificacions.

## Validació

`node --test scripts/test_avisos_idiomes.cjs scripts/test_workflow_quota.cjs`

`node scripts/avisar_pendents_idioma.cjs --dry-run` només mostra les candidates abans de consultar el registre remot; no fa peticions ni envia missatges.

Fonts: https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications i https://docs.github.com/en/rest/issues/comments.
