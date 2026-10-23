# Google Analytics de Segueix Música

Identificador: `G-4QED7E19C0`. Integració: `js/google-analytics.js`, carregada amb `defer` al shell d’`index.html`. El generador estàtic copia aquest shell i la carpeta `js`; funciona tant a GitHub Pages com al futur domini segueix.cat.

Al primer avís, «Acceptar» autoritza YouTube i Google Analytics amb un sol clic, sense caselles; «Només necessàries» rebutja tots dos. El text explica els dos serveis abans de decidir. A Configuració es poden canviar per separat. Sense una decisió prèvia, l’analítica està desactivada per defecte. Sense acceptació no es descarrega gtag.js. La retirada activa `ga-disable-G-4QED7E19C0`, també entre pestanyes. No exportar el consentiment amb les còpies musicals. Les cookies ja creades es poden eliminar des del navegador.

La visita inicial envia una URL sense consulta ni fragment i un títol fix. No s’afegeixen esdeveniments propis de reproducció ni de llistes. S’han desactivat Google Signals i la personalització publicitària en la configuració de l’etiqueta.

## Configuració del flux a Google Analytics

Desactivar **Mesurament millorat** al flux web per limitar aquesta integració a les visites inicials i l’activitat bàsica de GA4. Les opcions automàtiques de formularis, clics, vídeos, cerques i navegació per historial es gestionen a Google Analytics, no en aquest repositori. No activar-les sense revisar les dades que poden incloure (l’app comparteix llistes a la consulta de la URL). No s’ha modificat ni verificat el compte de Google Analytics des d’aquesta sessió.

Per verificar: acceptar l’analítica a la web publicada i consultar Temps real a GA4. Els bloquejadors poden impedir l’enviament. No s’envia cap visita de prova des de les proves automatitzades.

Proves locals sense dependències: `node --test scripts/test_google_analytics.cjs`. La publicació habitual executa la construcció i validació estàtiques; no cal cap workflow nou.
