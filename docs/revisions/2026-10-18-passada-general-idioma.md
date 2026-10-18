# Passada general d'idioma pel títol — 2026-10-18

**Què és:** un triatge de totes les cançons publicades (feed: unes 6.700; i les de l'arxiu que surten a les fitxes d'artista), buscant títols en castellà, anglès, portuguès o altres llengües. **No és una verificació de la lletra:** el títol és només un indici (`CLAUDE.md`: «Mai amagueu una cançó només per la ñ, els accents o la llengua del títol»). **En aquesta passada no s'ha verificat cap lletra** (vegeu «Aplicat»).

**Com s'ha fet:** per a cada cançó publicada (no oculta ni restringida, sense decisió prèvia a `data/revisio-idiomes.json`), la part del títol que és la cançó (`songPart()`: sense l'artista, els parèntesis ni les col·laboracions) s'ha comparat amb llistes de paraules exclusives del castellà i de l'anglès i amb marques ortogràfiques (ñ, ¿¡, -ción, á, ã/õ, alfabets no llatins). Només es queden les que no tenen cap paraula o lletra catalana (ç, l·l, ny, «amb», «els», «per»…). Després s'han classificat a mà.

**Per què no s'ha verificat la lletra:** des d'aquest entorn YouTube demana un captcha (no es poden llegir les descripcions dels vídeos), el repositori no en guarda la descripció i la cerca web no troba les lletres d'aquestes cançons.

## Resum

- **186 candidates** (81 al feed i 105 a l'arxiu).
- **73 probables en una altra llengua:** títol complet en castellà, anglès o portuguès, o versió d'una cançó coneguda en una altra llengua.
- **72 en dubte:** títol en una altra llengua, però pot ser una cançó catalana (molts grups catalans posen títols en anglès) o una peça instrumental.
- **41 falsos positius probables:** el títol és català, la paraula és un préstec o és instrumental.
- No inclou la cua de revisió dels artistes vigilats (`pendents`: 1.653 cançons, la majoria amb títols catalans), que continua com estava.

## Aplicat (2026-10-18)

A petició de l'usuari («amaga-les totes»), **les 73 probables s'han amagat** (`data/hidden-videos.json`) amb una decisió `amaga` a `data/revisio-idiomes.json` (`criteri: titol-autoritzat-usuari`, `lletraIntegraVerificada: false`). Els 10 artistes «de confiança» que en tenien (Anna Ferrer, Blues de Picolat, El Nota, Exili a Elba, Glaucs, Ia & Batiste, Inadaptats, Ja t'ho diré, Paula Montalbán, Xesco Boix) han passat a **vigilats** i la resta del seu repertori ha entrat a la cua de revisió (no s'ha amagat). Per recuperar-ne una: treure l'ID de `data/hidden-videos.json` i canviar-ne la decisió a `conserva` a `data/revisio-idiomes.json` (`--recupera` de l'eina només accepta cançons que siguin a la cua). Les «en dubte» i els falsos positius no s'han tocat.

## Probables en una altra llengua (73)

| Artista | Cançó | On és | Per què | Vídeo |
|---|---|---|---|---|
| 9Son | No Hay Mal que Cien Años Dure | feed | títol en castellà | [vsY73lpOFHs](https://www.youtube.com/watch?v=vsY73lpOFHs) |
| 9Son | Levanta el Fuego | feed | títol en castellà | [CB6KozdxiK0](https://www.youtube.com/watch?v=CB6KozdxiK0) |
| 9Son | Jugar a Ser Niños | feed | títol en castellà | [zTIz1RMqrIY](https://www.youtube.com/watch?v=zTIz1RMqrIY) |
| Albert Pla | ¿Os Acordáis? | arxiu | títol en castellà | [N02guDL60dc](https://www.youtube.com/watch?v=N02guDL60dc) |
| Albert Pla | Muñeca | arxiu | títol en castellà | [zxXHWrutMQU](https://www.youtube.com/watch?v=zxXHWrutMQU) |
| Albert Pla | Porque Quiero | arxiu | títol en castellà | [O_FBiC-soCY](https://www.youtube.com/watch?v=O_FBiC-soCY) |
| Anna Ferrer | Tres lágrimas - y Guillem Roma | feed | títol en castellà | [dbKOW6AK8Bk](https://www.youtube.com/watch?v=dbKOW6AK8Bk) |
| Anna Ferrer | Margarita y el mar | feed | títol en castellà | [i7UG7rqPCQg](https://www.youtube.com/watch?v=i7UG7rqPCQg) |
| Anna Ferrer | Son tus ojos dos puñales | feed | títol en castellà (copla) | [kcTJOKUadYY](https://www.youtube.com/watch?v=kcTJOKUadYY) |
| Anna Ferrer | El ángel | feed | títol en castellà | [-F6RC4_-gqU](https://www.youtube.com/watch?v=-F6RC4_-gqU) |
| Anna Ferrer | YO ME PREGUNTO | arxiu | títol en castellà | [legC-Qofoog](https://www.youtube.com/watch?v=legC-Qofoog) |
| Anna Ferrer | No ven más cien ojos | feed | títol en castellà | [QRLEUdPWKQQ](https://www.youtube.com/watch?v=QRLEUdPWKQQ) |
| Anna Ferrer | Yo me pregunto | arxiu | títol en castellà | [PL252-84B8E](https://www.youtube.com/watch?v=PL252-84B8E) |
| Anna Ferrer | EL ÁNGEL | arxiu | títol en castellà | [LOsBZ7RyLvY](https://www.youtube.com/watch?v=LOsBZ7RyLvY) |
| Anna Ferrer | Los panes los hijos | feed | títol en castellà | [iluP6xFQx5E](https://www.youtube.com/watch?v=iluP6xFQx5E) |
| Anna Ferrer | Son tus ojos dos puñales | arxiu | títol en castellà (copla) | [APhIvv1D-v4](https://www.youtube.com/watch?v=APhIvv1D-v4) |
| Blues de Picolat | Love In Vain | feed | estàndard de blues en anglès (Robert Johnson) | [iIlTz9hKHw0](https://www.youtube.com/watch?v=iIlTz9hKHw0) |
| Blues de Picolat | The sky is Crying | feed | estàndard de blues en anglès (Elmore James) | [9umkaar8Q_0](https://www.youtube.com/watch?v=9umkaar8Q_0) |
| Dr. Calypso | Now That We'Ve Found Love | arxiu | versió de Third World (anglès) | [D3fx-QEIl40](https://www.youtube.com/watch?v=D3fx-QEIl40) |
| Dusminguet | Como si nada | arxiu | títol en castellà | [_olL1QErpe8](https://www.youtube.com/watch?v=_olL1QErpe8) |
| El Nota | Rap para la Tuerka | feed | títol en castellà | [ixCRlEgE_nE](https://www.youtube.com/watch?v=ixCRlEgE_nE) |
| Enric Hernàez | Palabras para Júlia | arxiu | poema de Goytisolo (castellà) | [SjR646WRwUg](https://www.youtube.com/watch?v=SjR646WRwUg) |
| Enric Hernàez | Apesar de Você | arxiu | cançó de Chico Buarque (portuguès) | [-N3qhdQyNt4](https://www.youtube.com/watch?v=-N3qhdQyNt4) |
| Enric Hernàez | Grândola, Vila Morena | arxiu | cançó de Zeca Afonso (portuguès) | [eW35MHM4nKk](https://www.youtube.com/watch?v=eW35MHM4nKk) |
| Exili a Elba | Paul's Dream | feed | títol en anglès (tots els del grup ho són) | [nqXZ0MOeM-Y](https://www.youtube.com/watch?v=nqXZ0MOeM-Y) |
| Exili a Elba | Blood, Sweat and Asphalt | feed | títol en anglès (tots els del grup ho són) | [FYbBG_wUAMs](https://www.youtube.com/watch?v=FYbBG_wUAMs) |
| Exili a Elba | Like a Rolling Stone | arxiu | versió de Bob Dylan (anglès) | [OAJEy8D9Lmk](https://www.youtube.com/watch?v=OAJEy8D9Lmk) |
| Exili a Elba | Never Too Late | arxiu | títol en anglès (tots els del grup ho són) | [MYKth6_AmFY](https://www.youtube.com/watch?v=MYKth6_AmFY) |
| Exili a Elba | Everything Reminds You of Me | arxiu | títol en anglès (tots els del grup ho són) | [RpuPwLfYMxQ](https://www.youtube.com/watch?v=RpuPwLfYMxQ) |
| Exili a Elba | Now | arxiu | títol en anglès (tots els del grup ho són) | [29_JlD22hLs](https://www.youtube.com/watch?v=29_JlD22hLs) |
| Exili A Elba | Movin' like a train - - En viu a "La Nau" | arxiu | títol en anglès (tots els del grup ho són) | [9iYls09jTB0](https://www.youtube.com/watch?v=9iYls09jTB0) |
| Gerard Jacquet | Si Me Quieres Escribir | feed | cançó de la Guerra Civil en castellà | [K2lugcrjaqg](https://www.youtube.com/watch?v=K2lugcrjaqg) |
| Gertrudis | Niña India | arxiu | títol en castellà | [OMJjxnkpu3A](https://www.youtube.com/watch?v=OMJjxnkpu3A) |
| Gertrudis | Fresas Y Collares | arxiu | títol en castellà | [MRRXcXiy_yk](https://www.youtube.com/watch?v=MRRXcXiy_yk) |
| Glaucs | I'm Still Standing | arxiu | versió d’Elton John (anglès) | [Co_7iJwwEPc](https://www.youtube.com/watch?v=Co_7iJwwEPc) |
| Ia & Batiste | Desgracia Mía | arxiu | títol en castellà | [j9KXxKp_qy4](https://www.youtube.com/watch?v=j9KXxKp_qy4) |
| Inadaptats | No Más Extradiciones | arxiu | títol en castellà | [hlkKdaU2Y6w](https://www.youtube.com/watch?v=hlkKdaU2Y6w) |
| Ja T'ho Dire | Ojos De Acero | arxiu | títol en castellà | [np_RHPGmRAY](https://www.youtube.com/watch?v=np_RHPGmRAY) |
| Joan Dausà | Otra forma de vivir - Estrella Damm 2019 | feed | versió en castellà d’«Una altra manera de viure» | [CIPeqT59eAs](https://www.youtube.com/watch?v=CIPeqT59eAs) |
| Joan Dausà | Another Way of Living - Estrella Damm | arxiu | versió en anglès | [qEfjx8TkewQ](https://www.youtube.com/watch?v=qEfjx8TkewQ) |
| Joan Dausà | Andrea, Ya Nada Puede Ser | arxiu | títol en castellà | [Goed_LJfRwo](https://www.youtube.com/watch?v=Goed_LJfRwo) |
| Joan Dausà | Talking About You and Me | arxiu | títol en anglès | [FSVAKEbnIQg](https://www.youtube.com/watch?v=FSVAKEbnIQg) |
| KOP | Nunca Cambiaremos | arxiu | títol en castellà | [4lTjdbd4Big](https://www.youtube.com/watch?v=4lTjdbd4Big) |
| Lídia Pujol | Doña Estefaldina | arxiu | títol en castellà | [mDKnY-XIl8c](https://www.youtube.com/watch?v=mDKnY-XIl8c) |
| Lídia Pujol | Si No Fuera Porque | arxiu | títol en castellà | [SNEy59UrReA](https://www.youtube.com/watch?v=SNEy59UrReA) |
| Lídia Pujol | Con los Ojos en Paz | arxiu | títol en castellà | [I9TVNcwUmA4](https://www.youtube.com/watch?v=I9TVNcwUmA4) |
| Mariona Escoda | The prayer - Andrea Bocelli | feed | versió de «The Prayer» (anglès/italià) | [Mj72g66k21k](https://www.youtube.com/watch?v=Mj72g66k21k) |
| Mariona Escoda | Somebody to love | feed | versió de «Somebody to Love» (anglès) | [qGrjX9HOPTE](https://www.youtube.com/watch?v=qGrjX9HOPTE) |
| Miki Núñez | Friday I'm In Love | arxiu | versió de The Cure (anglès) | [wsCY7gDBjN4](https://www.youtube.com/watch?v=wsCY7gDBjN4) |
| miquel | Adán y Esteban | feed | títol en castellà | [zCGON2cm150](https://www.youtube.com/watch?v=zCGON2cm150) |
| Paula Montalban Gay | Me quedo contigo - Los Chunguitos | feed | versió de Los Chunguitos (castellà) | [HQhtHmLSV3Y](https://www.youtube.com/watch?v=HQhtHmLSV3Y) |
| Quico Pi de la Serra | Para encontrar el camino, hay que ser frágil y fuerte. No hay que temerle al destino, ni a la... | feed | títol: frase en castellà | [Q3LV5W_bK8I](https://www.youtube.com/watch?v=Q3LV5W_bK8I) |
| Rapsodes | Its my life | feed | versió d’una cançó en anglès | [ZmwTWmwiDds](https://www.youtube.com/watch?v=ZmwTWmwiDds) |
| Rapsodes | Somewhere over the rainbow | feed | versió de «Over the Rainbow» (anglès) | [6pfU5l0cdgg](https://www.youtube.com/watch?v=6pfU5l0cdgg) |
| Sílvia Pérez Cruz | The Man Who Sold The World | arxiu | versió de David Bowie (anglès) | [FKjPBF3mHYM](https://www.youtube.com/watch?v=FKjPBF3mHYM) |
| Sílvia Pérez Cruz | The Sound Of Silence | arxiu | versió de Simon & Garfunkel (anglès) | [iz0DBq9VsFg](https://www.youtube.com/watch?v=iz0DBq9VsFg) |
| Sílvia Pérez Cruz | Niño Mudo | arxiu | poema de Lorca (castellà) | [RlRfBH88Jho](https://www.youtube.com/watch?v=RlRfBH88Jho) |
| Sílvia Pérez Cruz | Carabelas Nada | arxiu | títol en castellà | [85vptASO2sA](https://www.youtube.com/watch?v=85vptASO2sA) |
| Still Ill | Life Goals | feed | títol en anglès (tots els del grup ho són) | [jUXpk7ui8GE](https://www.youtube.com/watch?v=jUXpk7ui8GE) |
| Still Ill | ALL OUT | arxiu | títol en anglès (tots els del grup ho són) | [O7nuhwFypIE](https://www.youtube.com/watch?v=O7nuhwFypIE) |
| Still Ill | Never Sleep | feed | títol en anglès (tots els del grup ho són) | [dblPN60zKHc](https://www.youtube.com/watch?v=dblPN60zKHc) |
| Still Ill | In the Blood | arxiu | títol en anglès (tots els del grup ho són) | [7cIpDY5SiPI](https://www.youtube.com/watch?v=7cIpDY5SiPI) |
| Still Ill | PAIN IN THINGS | arxiu | títol en anglès (tots els del grup ho són) | [UZx18DLq_IU](https://www.youtube.com/watch?v=UZx18DLq_IU) |
| Still Ill | DEFINITION OF A BASTARD | arxiu | títol en anglès (tots els del grup ho són) | [Ttra6rp4Kko](https://www.youtube.com/watch?v=Ttra6rp4Kko) |
| Still Ill | Black and Blue | arxiu | títol en anglès (tots els del grup ho són) | [rSYaVOqM4ys](https://www.youtube.com/watch?v=rSYaVOqM4ys) |
| Still Ill | Street Rat | feed | títol en anglès (tots els del grup ho són) | [tdAXV7o6fyk](https://www.youtube.com/watch?v=tdAXV7o6fyk) |
| Still Ill | The Path to Paradise | arxiu | títol en anglès (tots els del grup ho són) | [jLRCC-Z5t_A](https://www.youtube.com/watch?v=jLRCC-Z5t_A) |
| Tesa | You Send Me | arxiu | versió de Sam Cooke (anglès) | [TesLy3pPiN0](https://www.youtube.com/watch?v=TesLy3pPiN0) |
| Tomeu Penya | Convence A Tu Mamá | feed | títol: frase en castellà | [KMq_A8iizMs](https://www.youtube.com/watch?v=KMq_A8iizMs) |
| Trast | 10 No miramos atrás | feed | títol en castellà | [VfXUtdTNS4Q](https://www.youtube.com/watch?v=VfXUtdTNS4Q) |
| Umpah Pah | New Years Day | arxiu | versió de U2 (anglès) | [hwUvPbsGmPc](https://www.youtube.com/watch?v=hwUvPbsGmPc) |
| Xesco Boix | Hasta siempre | arxiu | cançó de Carlos Puebla (castellà) | [UTxEFZaAy74](https://www.youtube.com/watch?v=UTxEFZaAy74) |
| Xesco Boix | De las Dos Gallinitas | arxiu | títol en castellà | [Y5kJhEsm9Yo](https://www.youtube.com/watch?v=Y5kJhEsm9Yo) |

## En dubte (72)

| Artista | Cançó | On és | Per què | Vídeo |
|---|---|---|---|---|
| 31 FAM | Y.N.V. | arxiu | títol en una altra llengua; pot ser una cançó catalana | [39a_dk9PmNg](https://www.youtube.com/watch?v=39a_dk9PmNg) |
| Albert Pla | Demá | arxiu | títol en una altra llengua; pot ser una cançó catalana | [04ohtyzoJiE](https://www.youtube.com/watch?v=04ohtyzoJiE) |
| Alosa | Las alamedas | feed | títol en una altra llengua; pot ser una cançó catalana | [J_O1FpgePMU](https://www.youtube.com/watch?v=J_O1FpgePMU) |
| Anaïs Vila | Come Back And Dance | arxiu | títol en una altra llengua; pot ser una cançó catalana | [rT5tHj7i00k](https://www.youtube.com/watch?v=rT5tHj7i00k) |
| Antònia Font | Love Song | arxiu | títol en una altra llengua; pot ser una cançó catalana | [ffMTQznKbLQ](https://www.youtube.com/watch?v=ffMTQznKbLQ) |
| BATEC | Never Surrender | feed | títol en una altra llengua; pot ser una cançó catalana | [td-4-UjpF18](https://www.youtube.com/watch?v=td-4-UjpF18) |
| Baya Baye | Sons of Mgt | feed | títol en una altra llengua; pot ser una cançó catalana | [DcX4GMdOE3w](https://www.youtube.com/watch?v=DcX4GMdOE3w) |
| Baya Baye | Xinas y Manchas | arxiu | títol en una altra llengua; pot ser una cançó catalana | [BmReD8C8uUo](https://www.youtube.com/watch?v=BmReD8C8uUo) |
| BAYA BAYE | XINAS Y MANCHAS | arxiu | títol en una altra llengua; pot ser una cançó catalana | [uW1Rn80_YC4](https://www.youtube.com/watch?v=uW1Rn80_YC4) |
| Blaumut | Only You | arxiu | títol en una altra llengua; pot ser una cançó catalana | [70rbybhfDHM](https://www.youtube.com/watch?v=70rbybhfDHM) |
| Boom Boom Fighters | Young Veterans | arxiu | títol en una altra llengua; pot ser una cançó catalana | [lePmRrwxc6g](https://www.youtube.com/watch?v=lePmRrwxc6g) |
| Boom Boom Fighters | Party Tonight | arxiu | títol en una altra llengua; pot ser una cançó catalana | [BV2zgvdDyLU](https://www.youtube.com/watch?v=BV2zgvdDyLU) |
| Cloe Riembau | Cariñoso | feed | títol en una altra llengua; pot ser una cançó catalana | [NOV6-F-s6cc](https://www.youtube.com/watch?v=NOV6-F-s6cc) |
| Companyia Elèctrica Dharma | Capitán Trueno | arxiu | títol en una altra llengua; pot ser una cançó catalana | [TSWLA9g9m54](https://www.youtube.com/watch?v=TSWLA9g9m54) |
| Companyia Elèctrica Dharma | Capitán Trueno | arxiu | títol en una altra llengua; pot ser una cançó catalana | [3LNI5ayqNUg](https://www.youtube.com/watch?v=3LNI5ayqNUg) |
| Da Souza | Boca a boca | arxiu | títol en una altra llengua; pot ser una cançó catalana | [h5Ytqzjj-70](https://www.youtube.com/watch?v=h5Ytqzjj-70) |
| dani6ix & IZZKID | Far Away | feed | títol en una altra llengua; pot ser una cançó catalana | [QXFUklrHBVY](https://www.youtube.com/watch?v=QXFUklrHBVY) |
| Dr. Calypso | Plan 10: The Return... | feed | títol en una altra llengua; pot ser una cançó catalana | [2Mhtlzq9lzM](https://www.youtube.com/watch?v=2Mhtlzq9lzM) |
| Dr. Calypso | My Avocado | arxiu | títol en una altra llengua; pot ser una cançó catalana | [YOkE3NffAV8](https://www.youtube.com/watch?v=YOkE3NffAV8) |
| Dr. Calypso | Blow up the Bank | arxiu | títol en una altra llengua; pot ser una cançó catalana | [CpyJvxBU5Gs](https://www.youtube.com/watch?v=CpyJvxBU5Gs) |
| Dusminguet | Gran dubtá | feed | títol en una altra llengua; pot ser una cançó catalana | [L6fCzeuZzxc](https://www.youtube.com/watch?v=L6fCzeuZzxc) |
| el Diluvi | Flying to the moon - | arxiu | títol en una altra llengua; pot ser una cançó catalana | [YN7WLUXNjWA](https://www.youtube.com/watch?v=YN7WLUXNjWA) |
| el Diluvi | De boca en boca | arxiu | títol en una altra llengua; pot ser una cançó catalana | [jlpb-U5ySOs](https://www.youtube.com/watch?v=jlpb-U5ySOs) |
| El Diluvi | πr² | arxiu | títol en una altra llengua; pot ser una cançó catalana | [XhbdUE9tHCw](https://www.youtube.com/watch?v=XhbdUE9tHCw) |
| El Nota | Another Day | feed | títol en una altra llengua; pot ser una cançó catalana | [92nYvCPVf9Q](https://www.youtube.com/watch?v=92nYvCPVf9Q) |
| El Nota | W.Y.W.K.A.M | arxiu | títol en una altra llengua; pot ser una cançó catalana | [Bdq8-ugElqo](https://www.youtube.com/watch?v=Bdq8-ugElqo) |
| Els Miralls de Dylan | 13. SEÑOR | feed | títol en una altra llengua; pot ser una cançó catalana | [73pMC4eqVpY](https://www.youtube.com/watch?v=73pMC4eqVpY) |
| EN-BRUT | White Night | feed | títol en una altra llengua; pot ser una cançó catalana | [psDcqc94fRE](https://www.youtube.com/watch?v=psDcqc94fRE) |
| FADES | Love Me Better | feed | títol en una altra llengua; pot ser una cançó catalana | [BuONTnFzV3A](https://www.youtube.com/watch?v=BuONTnFzV3A) |
| Gossos | Sun Is Shining | arxiu | títol en una altra llengua; pot ser una cançó catalana | [is0LFxkoGlg](https://www.youtube.com/watch?v=is0LFxkoGlg) |
| Guillermina Motta | La ”moñito” | feed | títol en una altra llengua; pot ser una cançó catalana | [D5pcclQsEr4](https://www.youtube.com/watch?v=D5pcclQsEr4) |
| Hey Zuri | casino night | feed | títol en una altra llengua; pot ser una cançó catalana | [TT2lqGKkTv8](https://www.youtube.com/watch?v=TT2lqGKkTv8) |
| Inadaptats | ¡Bomba a Bomba! | arxiu | títol en una altra llengua; pot ser una cançó catalana | [GQFDLZ3bXGY](https://www.youtube.com/watch?v=GQFDLZ3bXGY) |
| Joan Dausà | Welcome to My Party | feed | títol en una altra llengua; pot ser una cançó catalana | [baMN3H7uZZ0](https://www.youtube.com/watch?v=baMN3H7uZZ0) |
| Joan Dausà | Diria Que Eres Tu | feed | títol en una altra llengua; pot ser una cançó catalana | [oaxm12ox_48](https://www.youtube.com/watch?v=oaxm12ox_48) |
| Joan Miquel Oliver | The tuning song | feed | títol en una altra llengua; pot ser una cançó catalana | [DD3plH5VxjM](https://www.youtube.com/watch?v=DD3plH5VxjM) |
| Joan Miquel Oliver | My Way | arxiu | títol en una altra llengua; pot ser una cançó catalana | [2F2vBz-NUFM](https://www.youtube.com/watch?v=2F2vBz-NUFM) |
| Kitsch | 2005 Live ElektroKàustic - Noche en directe al TMB | arxiu | títol en una altra llengua; pot ser una cançó catalana | [hn11Fdbh38o](https://www.youtube.com/watch?v=hn11Fdbh38o) |
| La Bundu Band | Fire, Freedom, Fighter | feed | títol en una altra llengua; pot ser una cançó catalana | [jOCbLTptTvU](https://www.youtube.com/watch?v=jOCbLTptTvU) |
| La Bundu Band | Fire, Freedom, Fighter | arxiu | títol en una altra llengua; pot ser una cançó catalana | [tlznCJWFgBQ](https://www.youtube.com/watch?v=tlznCJWFgBQ) |
| La Mousse | Good Morning Midnight | feed | títol en una altra llengua; pot ser una cançó catalana | [-j9ncWrwMYQ](https://www.youtube.com/watch?v=-j9ncWrwMYQ) |
| Les Testarudes | Where's My Car? | feed | títol en una altra llengua; pot ser una cançó catalana | [qtObAGRLHJs](https://www.youtube.com/watch?v=qtObAGRLHJs) |
| Lildami | Pussy Song | arxiu | títol en una altra llengua; pot ser una cançó catalana | [7mLrPCinSKQ](https://www.youtube.com/watch?v=7mLrPCinSKQ) |
| Lildami | Work Out | arxiu | títol en una altra llengua; pot ser una cançó catalana | [3hAs-4DiZx4](https://www.youtube.com/watch?v=3hAs-4DiZx4) |
| Maria Jaume | Hoteles sol y playa | feed | títol en una altra llengua; pot ser una cançó catalana | [UlT_TeQyYRI](https://www.youtube.com/watch?v=UlT_TeQyYRI) |
| Maria Jaume | Sant Domingo Forever | feed | títol en una altra llengua; pot ser una cançó catalana | [W6VeP5YD2NE](https://www.youtube.com/watch?v=W6VeP5YD2NE) |
| Marina Rossell | Mármara | arxiu | títol en una altra llengua; pot ser una cançó catalana | [5ljlcPJs9iw](https://www.youtube.com/watch?v=5ljlcPJs9iw) |
| Moto Clua | Magistic Friend | feed | títol en una altra llengua; pot ser una cançó catalana | [WVw0jKX7ybU](https://www.youtube.com/watch?v=WVw0jKX7ybU) |
| N'Gai N'Gai | Flor Metálica | arxiu | títol en una altra llengua; pot ser una cançó catalana | [hWhSbUkWPMA](https://www.youtube.com/watch?v=hWhSbUkWPMA) |
| N'Gai N'Gai | Flor Metálica | arxiu | títol en una altra llengua; pot ser una cançó catalana | [E4gcRbXzXz8](https://www.youtube.com/watch?v=E4gcRbXzXz8) |
| Opció K-95 | Oi! You! | feed | títol en una altra llengua; pot ser una cançó catalana | [-YgqeGIpL6M](https://www.youtube.com/watch?v=-YgqeGIpL6M) |
| Oques Grasses | IN THE NIGHT | feed | títol en una altra llengua; pot ser una cançó catalana | [mj1ycQOY77o](https://www.youtube.com/watch?v=mj1ycQOY77o) |
| Ouineta | Last Night | feed | títol en una altra llengua; pot ser una cançó catalana | [FzrNjN6Hpow](https://www.youtube.com/watch?v=FzrNjN6Hpow) |
| P.A.W.N. Gang | No Way | arxiu | títol en una altra llengua; pot ser una cançó catalana | [2pw2BJ-r4DU](https://www.youtube.com/watch?v=2pw2BJ-r4DU) |
| P.A.W.N. Gang | The Trap Man | arxiu | títol en una altra llengua; pot ser una cançó catalana | [Y0iMthaCe6A](https://www.youtube.com/watch?v=Y0iMthaCe6A) |
| P.A.W.N. Gang | PETRi ASS WHiTE NiGGAS | arxiu | títol en una altra llengua; pot ser una cançó catalana | [r3jdsE6UFDo](https://www.youtube.com/watch?v=r3jdsE6UFDo) |
| Pau Riba | Crisálida Encantada | feed | títol en una altra llengua; pot ser una cançó catalana | [Kv1XrwPGtaI](https://www.youtube.com/watch?v=Kv1XrwPGtaI) |
| Pegasus | Gritos y Susurros | feed | títol en una altra llengua; pot ser una cançó catalana | [Z6uf1tNqjyA](https://www.youtube.com/watch?v=Z6uf1tNqjyA) |
| Pegasus | Aristides y el Gato | feed | títol en una altra llengua; pot ser una cançó catalana | [nUFBf1hMxMQ](https://www.youtube.com/watch?v=nUFBf1hMxMQ) |
| Pere Tapias | Ladies And Gentleman | arxiu | títol en una altra llengua; pot ser una cançó catalana | [zNNbyD-FBGs](https://www.youtube.com/watch?v=zNNbyD-FBGs) |
| POOR TRÀMIT | "What you gonna do" | arxiu | títol en una altra llengua; pot ser una cançó catalana | [N9nxISGDw5U](https://www.youtube.com/watch?v=N9nxISGDw5U) |
| Quico Pi de la Serra | Blues my chauffeur | feed | títol en una altra llengua; pot ser una cançó catalana | [RHoRY02mgVA](https://www.youtube.com/watch?v=RHoRY02mgVA) |
| Quico Pi de la Serra | Hey hey baby | arxiu | títol en una altra llengua; pot ser una cançó catalana | [7CZQLoA3WcM](https://www.youtube.com/watch?v=7CZQLoA3WcM) |
| Quimi Portet | Oh My Love | feed | títol en una altra llengua; pot ser una cançó catalana | [PjDKzJfS_jQ](https://www.youtube.com/watch?v=PjDKzJfS_jQ) |
| Sílvia Comes | Bolero para Jaime Gil de Biedma | arxiu | títol en una altra llengua; pot ser una cançó catalana | [wnS0cTzHek0](https://www.youtube.com/watch?v=wnS0cTzHek0) |
| Skatalà | Lefa's Song | arxiu | títol en una altra llengua; pot ser una cançó catalana | [CnI6OKF1OKo](https://www.youtube.com/watch?v=CnI6OKF1OKo) |
| Smoking Souls | Wonderfull Life | arxiu | títol en una altra llengua; pot ser una cançó catalana | [SktRzUW_V14](https://www.youtube.com/watch?v=SktRzUW_V14) |
| Tashkenti | La Rosa de los Tiempos | feed | títol en una altra llengua; pot ser una cançó catalana | [JmiMwyp5y-o](https://www.youtube.com/watch?v=JmiMwyp5y-o) |
| Tashkenti | Night of Action | feed | títol en una altra llengua; pot ser una cançó catalana | [L7qmlax3jIY](https://www.youtube.com/watch?v=L7qmlax3jIY) |
| Teràpia de Shock | Good Bye | arxiu | títol en una altra llengua; pot ser una cançó catalana | [l5uIvOOsyK8](https://www.youtube.com/watch?v=l5uIvOOsyK8) |
| Vademecum FAM | Nu Drama - 07. Half Life | arxiu | títol en una altra llengua; pot ser una cançó catalana | [j7CAAY7dyZM](https://www.youtube.com/watch?v=j7CAAY7dyZM) |
| Xanguito | Uh baby, one more time | arxiu | títol en una altra llengua; pot ser una cançó catalana | [3t6JkUeL060](https://www.youtube.com/watch?v=3t6JkUeL060) |

<details><summary>Falsos positius probables (41)</summary>

| Artista | Cançó | On és | Per què | Vídeo |
|---|---|---|---|---|
| Adala | La Dinastia de la Plata - Rebel City Riddim | feed | el títol és català o la paraula és un préstec | [NqohQopQFbs](https://www.youtube.com/watch?v=NqohQopQFbs) |
| Agathe Catel | El Cant del mо́n_ | feed | títol català (una «o» ciríl·lica per error) | [z_bwDIfu0Zg](https://www.youtube.com/watch?v=z_bwDIfu0Zg) |
| Albert Fibla | Blue Tangos | feed | guitarrista (probablement instrumental) | [1ZewNGNjowI](https://www.youtube.com/watch?v=1ZewNGNjowI) |
| Al·lèrgiques al pol·len | Apocalypsis Now | feed | el títol és català o la paraula és un préstec | [N1-aU6iN1jk](https://www.youtube.com/watch?v=N1-aU6iN1jk) |
| BAYA BAYE | LA MARE KEM VA PARÍ // CALERS Y VERÍ THE MIXTAPE | feed | el títol és català o la paraula és un préstec | [CTawSXie0EQ](https://www.youtube.com/watch?v=CTawSXie0EQ) |
| BAYA BAYE | MALPARITS // CALERS Y VERÍ THE MIXTAPE | feed | el títol és català o la paraula és un préstec | [1_EI5SStzLY](https://www.youtube.com/watch?v=1_EI5SStzLY) |
| bernia | Viatge a la Moon Remix | feed | el títol és català o la paraula és un préstec | [fakBfCOV-YI](https://www.youtube.com/watch?v=fakBfCOV-YI) |
| Bèrnia | VIATGE A LA MOON | feed | el títol és català o la paraula és un préstec | [uW8raXqAR3g](https://www.youtube.com/watch?v=uW8raXqAR3g) |
| Cesk Freixas | A Miguel Hernández | arxiu | el títol és català o la paraula és un préstec | [VcAYssHDkGk](https://www.youtube.com/watch?v=VcAYssHDkGk) |
| Companyia Elèctrica Dharma | Catalonia Is Not Patagonia | arxiu | Dharma: sovint instrumental | [IfrQVpMhQmg](https://www.youtube.com/watch?v=IfrQVpMhQmg) |
| Companyia Elèctrica Dharma | Los 7 Gotx | arxiu | Dharma: sovint instrumental | [6kDI1QMGmz0](https://www.youtube.com/watch?v=6kDI1QMGmz0) |
| Companyia Elèctrica Dharma | Catalonia Is Not Patagonia | arxiu | Dharma: sovint instrumental | [rHbmVbpGcp8](https://www.youtube.com/watch?v=rHbmVbpGcp8) |
| Companyia Elèctrica Dharma | Los Set Goyts | arxiu | Dharma: sovint instrumental | [1gxh5hVXlB4](https://www.youtube.com/watch?v=1gxh5hVXlB4) |
| Companyia Elèctrica Dharma | Moros Y Cristians | arxiu | Dharma: sovint instrumental | [0RZQUKMTAO0](https://www.youtube.com/watch?v=0RZQUKMTAO0) |
| Doctor Prats | Loviu Baby | feed | el títol és català o la paraula és un préstec | [YMSN3PXaKm8](https://www.youtube.com/watch?v=YMSN3PXaKm8) |
| Els Jóvens | It girl meua | feed | el títol és català o la paraula és un préstec | [8E-VIKj-gQw](https://www.youtube.com/watch?v=8E-VIKj-gQw) |
| Els Pets | Blue tack | feed | el títol és català o la paraula és un préstec | [6m13nH_I4Uk](https://www.youtube.com/watch?v=6m13nH_I4Uk) |
| Figa Flawas | ES VEN | arxiu | el títol és català o la paraula és un préstec | [ZjmH3UfvvcU](https://www.youtube.com/watch?v=ZjmH3UfvvcU) |
| Gertrudis | Qué Bonica | arxiu | el títol és català o la paraula és un préstec | [QhjDRy2An0E](https://www.youtube.com/watch?v=QhjDRy2An0E) |
| Jordi Sabatés | Bolero para Chick y Lulu White | feed | peça de piano de jazz (probablement instrumental) | [PglPFnM-ZAE](https://www.youtube.com/watch?v=PglPFnM-ZAE) |
| KOP | BLACK BLOCK | feed | el títol és català o la paraula és un préstec | [OBXm3RSksCo](https://www.youtube.com/watch?v=OBXm3RSksCo) |
| La Bundu Band | Interludi, fire, freedom, fighter | arxiu | el títol és català o la paraula és un préstec | [PVl9Em6jR-8](https://www.youtube.com/watch?v=PVl9Em6jR-8) |
| Lladruc | Fem-los Volar | feed | el títol és català o la paraula és un préstec | [kVyoHF3wjzA](https://www.youtube.com/watch?v=kVyoHF3wjzA) |
| Malson Atmosfèric | Bambes (feat. Geri, Sangaku, Pol Bordas, Lil Geri, Quimo, Yung Rajola, Spxxn P, The Tyets, Yung... | feed | el títol és català o la paraula és un préstec | [Fs8tnfBrZBc](https://www.youtube.com/watch?v=Fs8tnfBrZBc) |
| Manel | Boy band al Teatre Grec | arxiu | el títol és català o la paraula és un préstec | [GgXRUz26bDc](https://www.youtube.com/watch?v=GgXRUz26bDc) |
| Manel | Boy band en directe a la sala APOLO | arxiu | el títol és català o la paraula és un préstec | [x8iXTHnamQ4](https://www.youtube.com/watch?v=x8iXTHnamQ4) |
| Maria Jaume | Es teus beSOS | feed | el títol és català o la paraula és un préstec | [aWl2kJ8iPkk](https://www.youtube.com/watch?v=aWl2kJ8iPkk) |
| Mazoni | Apocalipsi now | arxiu | el títol és català o la paraula és un préstec | [Zn-NqJ84iE8](https://www.youtube.com/watch?v=Zn-NqJ84iE8) |
| Mr.Freak Ska | The Cabrians - Vestit Aerostatic | feed | el títol és català o la paraula és un préstec | [PFPcb0S0d0c](https://www.youtube.com/watch?v=PFPcb0S0d0c) |
| Ocults | Qué Passa | arxiu | el títol és català o la paraula és un préstec | [aMNDgqekEuw](https://www.youtube.com/watch?v=aMNDgqekEuw) |
| Ocults | Fes-te Es Loco | arxiu | el títol és català o la paraula és un préstec | [Gek9BsaW860](https://www.youtube.com/watch?v=Gek9BsaW860) |
| Ovidi Montllor | Prediccions y Conformitats | arxiu | el títol és català o la paraula és un préstec | [EKYpdvy_wSI](https://www.youtube.com/watch?v=EKYpdvy_wSI) |
| Paula Montalban Gay | PAULA MONTALBÁN - 1. ABANS | feed | el títol és català o la paraula és un préstec | [OGP-pmgrzJY](https://www.youtube.com/watch?v=OGP-pmgrzJY) |
| Paula Montalban Gay | PAULA MONTALBÁN - 3. ERRORS | feed | el títol és català o la paraula és un préstec | [aFl035NzFA8](https://www.youtube.com/watch?v=aFl035NzFA8) |
| PUPIL·LES | MENJAR-TE LA BOCA | arxiu | el títol és català o la paraula és un préstec | [b3n-YA8mK5A](https://www.youtube.com/watch?v=b3n-YA8mK5A) |
| Ramon Muntaner | Balada de las estrelles | feed | el títol és català o la paraula és un préstec | [THK6dRKVffw](https://www.youtube.com/watch?v=THK6dRKVffw) |
| Rapsodes | PRESENTACIÓ DEL DISC 10/09/08 el loco - 09 fi de festa | arxiu | el títol és català o la paraula és un préstec | [01MEt7Ni_Eo](https://www.youtube.com/watch?v=01MEt7Ni_Eo) |
| Reggae Per Xics | La Girafa // -- The Penguins | feed | el títol és català o la paraula és un préstec | [XKd_pFNUgUc](https://www.youtube.com/watch?v=XKd_pFNUgUc) |
| Skatalà | Guns of Navarone | arxiu | estàndard d’ska instrumental | [sjZeg3HHoyY](https://www.youtube.com/watch?v=sjZeg3HHoyY) |
| Umpah Pah | La Nana de Betty Blue | arxiu | el títol és català o la paraula és un préstec | [vJIL1tICR24](https://www.youtube.com/watch?v=vJIL1tICR24) |
| xicu | VULL STAR SOL ! | arxiu | el títol és català o la paraula és un préstec | [Mqnvvq3UM-g](https://www.youtube.com/watch?v=Mqnvvq3UM-g) |

</details>
