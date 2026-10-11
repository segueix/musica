# Origen i vinculació dels artistes

## Estat: 11 d'octubre de 2026

La fitxa mostra les assignacions validades de 59 artistes (97 canals oficials i Topic). En prémer la línia «Origen» o «Vinculat a» es despleguen el motiu i les fonts. Els perfils de programes i els artistes encara sense assignació no mostren la línia.

El [pilot inicial](ORIGENS_PILOT_30.md) tenia 22 casos documentats i 8 pendents. Una segona revisió ha validat Dusminguet, La Coixinera, Ebri Knight, Joan Miquel Oliver, Xarim Aresté i la vinculació de La Troba Kung-Fú amb la Garriga. Per a aquest últim, la biografia de Fourni Produccions a WOMEX documenta l'estudi propi a la Fournier; no afirmem que sigui el municipi de formació.

**L'Ham de Foc i Al Tall** tenen origen a **València ciutat**, confirmat per l'editor del catàleg el 11 d'octubre de 2026. És una correcció manual protegida (`assignmentSource: user-correction`, `locked: true`).

## Dades

`data/origens-artistes.json` és una font manual persistent, separada del feed generat:

- `artists`: assignació única per artista, relació `origin` o `associated`, llocs, fonts, explicació, data, estat i bloqueig manual.
- `channels`: canals oficials i Topic associats a l'artista del catàleg. En afegir canals cal ampliar aquest mapa després de confirmar la identitat.
- `places`: llocs normalitzats reutilitzables. Hi ha 38 poblacions amb identificador GeoNames i coordenades de referència del nucli; no són domicilis ni coordenades personals. La jerarquia administrativa del proveïdor no s'utilitza per assignar el municipi (pot tenir discrepàncies).
- Formentera i Mallorca es mantenen a escala d'illa; Camp de Tarragona, Camp de Túria i Montseny a escala territorial. Aquests cinc llocs no tenen coordenades puntuals. Marala conserva les tres poblacions documentades.

Les coordenades provenen de **GeoNames, via Open-Meteo**, amb atribució CC BY 4.0. Cada població desa la consulta d'origen i la data. Referències: <https://www.geonames.org/> i <https://open-meteo.com/en/docs/geocoding-api>.

Les dades estructurades del [pilot](revisions/2026-10-11-origens-pilot-30.json) indiquen les 30 assignacions aplicades, sense casos pendents. El catàleg de runtime només conté entrades `validated`.

## Interfície i manteniment

`js/features/artist-page.js` carrega el catàleg en obrir una fitxa, amb URL resolta per `appDataUrl`. El resultat es comparteix durant la sessió; si falla la xarxa es torna a provar en una visita posterior. La petició anterior no pot pintar dades sobre un altre artista. Les fonts admeten només HTTPS i els textos s'escapen abans d'inserir-los al DOM.

La informació queda dins la capçalera existent, amb desplegable natiu accessible per teclat i espai tàctil al mòbil. El catàleg es beneficia de la memòria cau de dades existent del service worker.

Les actualitzacions automàtiques futures han de generar propostes i respectar `locked: true`. No s'ha activat encara ni l'enriquiment automàtic de tot el catàleg ni la geolocalització de l'oient ni la ràdio per proximitat.

## Comprovacions

`tests/artist-origin.test.js` comprova identitat compartida, diversos municipis, territoris sense coordenades, ocultació de dades pendents, escapament, canvis ràpids de fitxa i recuperació després d'errors de xarxa. Les 169 proves disponibles en l'entorn local passen. El JS modificat passa ESLint; el lint global manté cinc errors previs en fitxers no modificats.

## Segon lot de 30 artistes (11 d'octubre de 2026)

Revisió assistida, amb 29 assignacions validades i Falç de Fetillera pendent de població. [Decisions i fonts del lot](revisions/2026-10-11-origens-lot-02.json). S'han prioritzat els artistes amb més cançons i directes al feed actual, sense confondre aquest recompte amb tota la discografia.

Pau Riba es vincula a Tiana; Dàmaris Gelabert, a Cardedeu; Blaumut i Angoixa, a Barcelona; Valtònyc, a sa Pobla i Sineu. Aquestes vinculacions no són una afirmació del lloc de naixement. Fades conserva Mallorca i Rapsodes el Camp de Túria, sense un punt municipal inventat. Les 30 assignacions anteriors i les correccions de València es conserven íntegrament.

No s'ha activat un procés automàtic per a nous artistes: aquesta passada és una revisió documental aplicada manualment. La ràdio per proximitat continua pendent.
