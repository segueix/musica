# Pilot d'orígens: 30 artistes

Data de revisió: 2026-10-11.

> Actualització posterior: la [integració a les fitxes](ORIGENS_ARTISTES.md) ja publica 30 assignacions validades. L'editor ha confirmat València ciutat per a L'Ham de Foc i Al Tall; no queden casos pendents. Les xifres de la resta d'aquest document descriuen el resultat inicial del pilot; el JSON conté l'estat actual.

## Abast i resultat

Prova documental assistida per establir el criteri de la futura Ràdio a prop teu. No és encara un indexador automàtic ni modifica les fitxes públiques. Resultat: 22 propostes amb confiança alta, 7 mitjana i 1 baixa. La confiança es refereix a l'afirmació concreta (origen o vinculació), no a una precisió municipal garantida.

Les dades estructurades són a [origens-pilot-30.json](revisions/2026-10-11-origens-pilot-30.json). Totes les entrades continuen com a propostes, amb applied=false i coordenades pendents. Els identificadors de canal provenen del catàleg actiu; cal resoldre la identitat canònica abans d'estendre una assignació a altres canals Topic o oficials.

## Criteri per automatitzar-ho

1. Resoldre l'artista per identificadors del catàleg, Wikidata i MusicBrainz; el nom sol no és suficient.
2. Recollir candidats de les metadades i biografies. Naixement, residència, lloc de formació i vinculació artística són relacions diferents.
3. Extreure lloc, relació i evidència de cada font. La IA pot proposar l'extracció, però no aportar evidència de memòria. No deduir municipis d'un gentilici regional, d'una seu discogràfica ni d'un lloc de concert.
4. Assignar confiança alta a una afirmació explícita en font de l'artista, discogràfica o institució pertinent, o corroborada per dues fonts independents. Un únic mitjà o dada natal sola queda a revisió. Dos textos copiats no són fonts independents.
5. Resoldre cada lloc contra un identificador geogràfic estable. Conservar municipis, illes, territoris i múltiples localitats com a tipus diferents. Les coordenades del centre municipal són aproximades, mai una adreça personal.
6. Generar propostes revisables amb fonts, data i motiu. En el pilot no es publica automàticament cap assignació. En una fase posterior es podrien acceptar automàticament només les propostes inequívoces que superin les comprovacions, protegint sempre les correccions manuals.
7. Fer una càrrega inicial i després revisar artistes nous, sense origen o amb evidència canviada. Registrar els canvis i no sobreescriure una assignació manual.

## Presentació prevista a la fitxa

- **Origen: Mataró** quan l'origen estigui documentat.
- **Vinculat a: Cardona** quan la dada representi una vinculació artística.
- Mostrar tots els llocs pertinents d'un grup de procedència múltiple.
- Permetre consultar les fonts i proposar una correcció.
- Sense evidència suficient, no presentar una proposta dubtosa com a dada confirmada.

Per a la ràdio, una coincidència municipal permetrà calcular una distància aproximada després de geocodificar-la. Un territori ampli no s'ha de representar amb una distància municipal falsa. Caldrà decidir com incloure coincidències territorials i evitar duplicar artistes amb diversos llocs.

## Les 30 propostes

| Artista | Text proposat | Precisió | Confiança |
|---|---|---|---|
| Dusminguet | Origen: la Garriga | municipi | mitjana |
| La Troba Kung-Fú | Vinculat a: la Garriga | municipi | baixa |
| La Coixinera | Origen: Mataró | municipi | mitjana |
| L'Ham de Foc | Origen: València | municipi | mitjana |
| Ebri Knight | Origen: Argentona | municipi | mitjana |
| Fetus | Origen: la Bisbal d'Empordà | municipi | alta |
| Mazoni | Origen: la Bisbal d'Empordà | municipi | alta |
| El Petit de Cal Eril | Origen: Guissona | municipi | alta |
| Quimi Portet | Vinculat a: Vic | municipi | alta |
| Joan Masdéu | Origen: Reus | municipi | alta |
| Joan Miquel Oliver | Origen: Sóller | municipi | mitjana |
| Xarim Aresté | Origen: Flix | municipi | mitjana |
| Tesa | Origen: Almussafes | municipi | alta |
| Feliu Ventura | Origen: Xàtiva | municipi | alta |
| Montse Castellà | Origen: Tortosa | municipi | alta |
| Tomeu Penya | Origen: Vilafranca de Bonany | municipi | alta |
| Júlia Colom | Origen: Valldemossa | municipi | alta |
| Caïm Riba | Origen: Formentera | illa | alta |
| Paul Fuster | Vinculat a: Cardona | municipi | alta |
| Marala | Vinculat a: Sant Cugat del Vallès · Palma · Pedreguer | multipoblacio | alta |
| Roba Estesa | Origen: Camp de Tarragona | territori | alta |
| Les Cruet | Vinculat a: Montseny | territori | alta |
| Anna Ferrer | Origen: Maó | municipi | alta |
| Sandra Bautista | Origen: Martorelles | municipi | alta |
| Frans Cuspinera | Origen: la Garriga | municipi | alta |
| Al Tall | Vinculat a: País Valencià | territori | mitjana |
| La Gossa Sorda | Origen: Pego | municipi | alta |
| Els Jóvens | Origen: Sant Vicent del Raspeig | municipi | alta |
| Rita Payés | Origen: Vilassar de Mar | municipi | alta |
| Peret | Origen: Mataró | municipi | alta |

## Evidència i excepcions

### Dusminguet

Formació del grup atribuïda a la Garriga; falta corroboració primària.

- [Font 1](https://es.wikipedia.org/wiki/Dusminguet)

### La Troba Kung-Fú

Vincle del fundador amb la Garriga; no basta per establir origen del grup. Altres fonts indiquen Barcelona.

- [Font 1](https://www.womex.com/virtual/fourni_produccions/la_troba_kung_fu)
- [Font 2](https://es.wikipedia.org/wiki/La_Troba_Kung-F%C3%BA)

### La Coixinera

Enderrock identifica explícitament el grup com a mataroní.

- [Font 1](https://www.enderrock.cat/folksons/artista/2296/coixinera)

### L'Ham de Foc

Font enciclopèdica situa el grup a València; pendent corroborar municipi en biografia primària.

- [Font 1](https://ca.wikipedia.org/wiki/L%27Ham_de_Foc)

### Ebri Knight

El Temps situa el naixement de la banda a Argentona.

- [Font 1](https://www.eltemps.cat/article/13344/el-passamuntanyes-folk-debri-knight)

### Fetus

El líder explica l'elecció de músics de la Bisbal; el festival els integra en l'escena local.

- [Font 1](https://www.ara.cat/girona/bisbal-municipi-mes-musics-catalunya-concentracio_1_5028041.html)
- [Font 2](https://www.itacacultura.cat/ca/programacio/c/11917-liverpool-empordanes.html)

### Mazoni

Entrevista i programació del festival documenten la vinculació a l'escena bisbalenca.

- [Font 1](https://www.vilaweb.cat/noticies/entrevista-mazoni-banderes-per-daltonics/)
- [Font 2](https://www.itacacultura.cat/ca/programacio/c/11917-liverpool-empordanes.html)

### El Petit de Cal Eril

Entrevista sobre el projecte de Joan Pons a Guissona; RTVE situa el nom en la casa familiar.

- [Font 1](https://uniopagesos.cat/la-terra/joan-pons-dun-producte-valoro-que-sigui-autentic-i-amb-aixo-la-mongeta-del-ganxet-i-el-petit-de-cal-eril-som-identics/)
- [Font 2](https://www.rtve.es/rtve/20211027/petit-cal-eril-efecte-collins/2205801.shtml)

### Quimi Portet

El MMVV el presenta com a músic de Vic. Hi ha discrepància entre biografia i entrevista sobre el naixement; aquesta proposta només afirma vinculació artística.

- [Font 1](https://www.mmvv.cat/es/artista/quimi-portet/1560)
- [Font 2](https://www.quimiportet.cat/bio.html)
- [Font 3](https://www.elnacional.cat/es/cultura/quimi-portet-vecino-colegio_102084_102.html)

### Joan Masdéu

L'Ajuntament documenta origen i reconeixement local com a pregoner.

- [Font 1](https://www.reus.cat/noticia/joan-masdeu-pregoner-de-la-festa-major-de-sant-pere-2011)

### Joan Miquel Oliver

Biografies culturals indiquen Sóller; cal distingir dada natal i identificació artística.

- [Font 1](https://www.talentib.com/es/autor/joan-miquel-oliver/)
- [Font 2](https://www.cccb.org/ca/w/participants/joan-miquel-oliver)

### Xarim Aresté

Entrevista situa la primera banda a Flix i el vincle amb la Ribera d'Ebre.

- [Font 1](https://cadenaser.com/cataluna/2024/03/13/xarim-areste-cada-dia-es-una-mort-sercat/)

### Tesa

Entrevista identifica la rapera amb Almussafes, concordant amb el directori musical valencià.

- [Font 1](https://www.vilaweb.cat/noticies/entrevista-tesa-rural/)
- [Font 2](https://musicaenvalencia.es/artista/102/tesa)

### Feliu Ventura

Entrevistes documenten origen i identificació amb Xàtiva.

- [Font 1](https://beteve.cat/artic/feliu-ventura-convocatoria/)
- [Font 2](https://www.elcritic.cat/entrevistes/feliu-ventura-la-meva-generacio-queda-marcada-per-la-ratzia-de-garzon-el-92-i-assassinat-de-guillem-agullo-48232)

### Montse Castellà

Autodefinició explícita a la web oficial com a tortosina.

- [Font 1](https://www.montsecastella.cat/)

### Tomeu Penya

Biografia oficial i entrevista coincideixen en origen i identificació amb Vilafranca.

- [Font 1](https://tomeupenya.cat/bio/)
- [Font 2](https://www.enderrock.cat/noticia/23632/tomeu-penya-fet-ric-coneixements-sentiments-fent-agrada)

### Júlia Colom

La cantant explica que hi ha crescut i s'hi identifica explícitament.

- [Font 1](https://www.ara.cat/cultura/musica/julia-colom-miramar-radios-tractors-cantar_128_4764744.html)
- [Font 2](https://www.dbalears.cat/balears/cultura/2023/10/21/385971/julia-colom-souza-son-els-principals-guanyadors-dels-premis-enderrock-musica-balear.html)

### Caïm Riba

Entrevistes documenten origen i relació amb Formentera; no es proposa cap nucli concret.

- [Font 1](https://www.enderrock.cat/edr/numero8/noticia/54)
- [Font 2](https://www.poparb.cat/2014/cartell/caim-riba/)

### Paul Fuster

Residència i activitat creativa documentades a Cardona en diferents etapes; nascut als EUA.

- [Font 1](https://www.ara.cat/cultura/paul-fuster-musica-medicina-vibracional_1_1611058.html)
- [Font 2](https://www.rtve.es/play/noticias/20160614/escucha-exclusiva-go-between-nuevo-disco-paul-fuster/1358369.shtml)

### Marala

La discogràfica enumera tres localitats i una entrevista confirma els orígens de les integrants; conservar totes tres, amb context històric.

- [Font 1](https://www.ppf.cat/index.php/cat/artistes/marala)
- [Font 2](https://www.totsantcugat.cat/actualitat/cultura/selma-bruna-som-tres-dones-que-s-ho-passen-molt-be-fent-musica_200594102.html)

### Roba Estesa

La discogràfica situa el naixement del grup al Camp de Tarragona; no atribuir-lo a Tarragona ciutat.

- [Font 1](https://halleyrecords.com/artist/roba-estesa/)

### Les Cruet

Discogràfica i entrevista identifiquen l'entorn del Montseny; no demostren el municipi homònim.

- [Font 1](https://bankrobber.net/producto/eco-les-cruet-vinil/)
- [Font 2](https://directa.cat/si-no-noto-que-ploro-en-el-proces-creatiu-i-que-mho-crec-no-ho-puc-defensar-cap-a-fora/)

### Anna Ferrer

Entrevista biogràfica i informació del pregó documenten origen i vincle amb Maó.

- [Font 1](https://elperiodic.ad/entrevista/anna-ferrer-06-10-2022/)
- [Font 2](https://ib3.org/la-cantant-anna-ferrer-pregonera-2026-de-mao-shan-de-conservar-els-llocs-de-trobada)

### Sandra Bautista

Sona9 la identifica amb Martorelles i font municipal confirma la criança; no confondre amb Santa Maria de Martorelles.

- [Font 1](https://www.3cat.cat/3catinfo/el-concurs-18sona9-inicia-la-fase-final/noticia/2878907/)
- [Font 2](https://www.santamariademartorelles.cat/actualitat/noticies/1776-festival-guspira.html)

### Frans Cuspinera

Biografia de concurs i entrevista el situen com a cantant garriguenc.

- [Font 1](https://www.enderrock.cat/sons/grupssons2017/pagina3)
- [Font 2](https://www.totcerdanyola.cat/actualitat/cultura/frans-cuspinera-calella-em-va-fer-retrobar-la-meva-relacio-amb-la-musica_1953904102.html)

### Al Tall

La font consultada confirma identitat valenciana però no permet convertir-la en València municipi. Municipi pendent.

- [Font 1](https://www.3cat.cat/3catinfo/el-grup-valencia-al-tall-posa-punt-final-a-la-seva-carrera-artistica/noticia/1937892/)

### La Gossa Sorda

Ràdio Pego explicita que la formació va néixer a Pego; coincideix amb el directori musical.

- [Font 1](https://www.radiopego.com/quinto-romantic-dimoni-i-abril-acompanyaran-la-gossa-sorda-en-lultim-aquelarre/)
- [Font 2](https://www.musicaenvalencia.es/artista/342/la-gossa-sorda)

### Els Jóvens

L'IVC i entrevista als músics situen el nucli creatiu i naixement del projecte a Sant Vicent.

- [Font 1](https://ivc.gva.es/val/ivc-val/els-jovens-en-concert-v)
- [Font 2](https://revistasao.cat/pep-mirambell-dels-jovens-el-mes-important-que-ens-emportem-daquesta-experiencia-es-que-la-gent-ens-haja-rebut-amb-tant-dentusiasme/)

### Rita Payés

Entrevistes independents coincideixen en l'origen i identificació amb Vilassar de Mar.

- [Font 1](https://www.vogue.es/articulos/rita-payes-de-camino-al-camino-entrevista-musica)
- [Font 2](https://www.elperiodico.cat/oci-i-cultura/20221202/entrevista-rita-payes-com-la-piel-auditori-79444710)

### Peret

L'Ajuntament documenta origen i reconeixement com a fill predilecte.

- [Font 1](https://www.mataro.cat/ca/actualitat/noticies/2011/el-cantant-i-artista-mataroni-peret-sera-nomenat)

## Pas següent

Validar les vuit propostes amb confiança mitjana o baixa, normalitzar geogràficament les 22 documentades i integrar el camp d'origen a la fitxa. Després implementar l'enriquiment incremental i la selecció per proximitat. Aquest pilot no mesura encara la taxa d'encert d'un indexador automàtic.
