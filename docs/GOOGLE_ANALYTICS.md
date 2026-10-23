# Google Analytics retirat (23 d’octubre de 2026)

A petició de l’usuari, Música no carrega Google Analytics ni envia esdeveniments de visites. «Acceptar» autoritza només el reproductor de YouTube, sense caselles.

`js/google-analytics.js` es conserva com a migració local: fixa `ga-disable-G-4QED7E19C0` i elimina l’antiga clau de consentiment, també si havia estat acceptada. No injecta scripts, no fa peticions i no ofereix cap opció per reactivar l’analítica. Eliminar aquesta integració no esborra dades prèviament recollides al compte de Google.

La ràdio de proximitat calcula distàncies localment i no envia les coordenades GPS a Google. YouTube, miniatures i Google Fonts continuen comportant connexions amb Google: la IP i la ubicació aproximada que se’n pot deduir no es poden ocultar mantenint aquestes connexions. No presentar «Només necessàries» com una garantia de zero connexions amb Google.

Proves: `node --test scripts/test_google_analytics.cjs`.
