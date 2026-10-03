'use strict';

// Oculta les cançons amb títol en castellà: n'afegeix els IDs a data/hidden-videos.json, que el
// client aplica a tot (feed, arxiu, cerques, ràdio) i que update_music_feed.js respecta en regenerar.
// Els títols es van revisar a mà (el depurador automàtic mira la descripció i dona molts falsos
// positius amb títols catalans). Per afegir-ne de nous, amplia REGLES i torna-ho a executar
// (idempotent). Ús: node scripts/ocultar_titols_castella.js [--dry-run]

const fs = require('fs');
const path = require('path');

const FEED_FILE = path.join(process.cwd(), 'data', 'feed.json');
const HIDDEN_FILE = path.join(process.cwd(), 'data', 'hidden-videos.json');

// canal (channelTitle) → { totes: true, excepte: /.../ } o { titols: /.../i }
const REGLES = {
    MARLENA: { totes: true },
    miquel: {
        titols: /Tu Forma de Amar|¡Es el rey|Machom[eé]n|espectro de Francisco|Isabel y Fernando|Luis, s[eé] fuerte|Mediterr[aá]neo|Mi bisabuelo/i,
    },
    'Joan Manuel Serrat': { totes: true, excepte: /Per al Meu Amic|Paraules d['’]Amor/i },
    'Umpah Pah': {
        titols: /Sin Jaleos|Circunspecci|Despu[eé]s|Sonrisita|Preludio del Adios|Sue[ñn]o Dormido|Dedo de la Llaga|Tocayo|Te Odio|Color de Higado|Gitanillo de Tiana|Con Premeditaci|Entre Tu y Yo|Un Compendio|Sed de Mal/i,
    },
    'Judit Neddermann': {
        titols: /canci[oó]n que me cura|d[oó]nde dormir|hace un tiempo|alegr\S{1,2}a de vivir|^Velas$|la respuesta|Siento Que Vuela|Como Un Amuleto|La Llave De La Alegr|Ll[eé]vame Contigo|Vivo Viva|^Canta$|^Luna$|^Celebrar$|Mendien Artean|Zure Ostean|Gorantza|Ahizpa|Neurean|Lamiak/i,
    },
    Ceaxe: { titols: /POR PRIMERA VEZ|PA SIEMPRE|TE ENCONTR|SE SIENTE|MUERO X ESA/i },
    SUU: {
        titols: /los d[ií]as como hoy|Me siento mejor|Si me est[aá]s rondando|[UÚ]limamente|Cantando goles|^Un poco|Uno de Septiembre|ENAMORADA DE LA MODA|DE TI PARA MI|CREO \(QUE TK|NOTA DE VOZ|Eres un temazo|Oj.{1,2}l.{1,2} \(|\bSoy \(|Algo de mi|Si no saltas|Todo lo que canto|Mi casa|No eres tan especial|S.{1,2}bete|Me gusta|A solas|Reinas|Tranq.{1,2}ilo|A tomar/i,
    },
    'Miki Nuñez': {
        titols: /M[aá]s De La Cuenta|- Suerte|- La Mitad|Entre Un Mill[oó]n|Dime Que No Duele|Viento Y Vida|Cel.{1,2}brate|Mi Lugar|Beberte Lento|Sin Noticias De Gurb|Eterno Verano|Coral Del Arrecife|10 Minutos|De Ida Y Vuelta|Me Vale|Todo Lo Que Llevo Dentro|La Venda|Prefiero/i,
    },
    alfredgarcia: {
        titols: /Siempre as[ií]|Las cosas sencillas|Llamas en el cielo|Mi Canci.{1,2}n \(Lyric|VOLVER A EMPEZAR|Si Alg.{1,2}n D.a|- Coraz.{1,2}n$|POR SI TE HACE FALTA|LO QUE PUEDO DAR|Los Espabilados|Que Nos Sigan Las Luces|Desde Que T.{1,2} Est.{1,2}s|Comunicado Oficial|De La Tierra Hasta Marte|Detr.{1,2}s de las c.{1,2}maras/i,
    },
    Sisa: { titols: /Hay mujeres|Te esperar[eé] el domingo/i },
    '31 FAM': {
        titols: /C[OÓ]MO ME DOLI[OÓ]|AMOR Y ODIO|CUANDO ME MIRAS|AS\S{1,2} ES LA VIDA|OBSESIONADO|NO LE DURA|SEPTIEMBRE/i,
    },
    CACTUS: { titols: /NOCHE LOCA|DIUEN X AH[IÍ]|FUEGO|NO OSAR.{1,2}AIS|CABRONA DE MI/i },
    Mushkaa: { titols: /LOS 15 \(PQ STAS TRISTE\)|Bello Bellaco|El Disfraz|Se[ñn]al de Respeto|Imperio/i },
    Sexenni: {
        titols: /Todas mis ex|Klk quieren|- Tengo \(|Mentalidad de Mero|Halc[oó]n Milenario|Antip[aá]nico/i,
    },
    'DAVEU))': { titols: /SUE[ÑN]OS DE CAMPE[OÓ]N|MI BRODA/i },
    Scorpio: { titols: /^Ya No \(/i },
    'BAYA BAYE': {
        titols: /CANIBALISMO HUMANO|DINERO Y VENENO|EL GATO NEGRO|DE TO LOS COLORS|PA QUE ME INVITAS|JUERGA Y REBELD|CUMBIA DEL PAPU/i,
    },
    'P.A.W.N. Gang': { titols: /MODO AVI[OÓ]N/i },
    Txarango: { titols: /BENDITA VIDA|Bendita la vida/i },
    elo: { titols: /De Casi Nada/i },
    'Joan Colomo': { titols: /Tus Pies|Enmienda a la totalidad/i },
    'Cristina Monllau': { titols: /Una Vez M[aá]s/i },
    'Joan Dausà': { titols: /GALLO ROJO|NUNCA ES TARDE/i },
    'Sandra Monfort': { titols: /Las Flores|Brillo de Luna|NI.{1,2}O REPTIL|Nana para Enzo/i },
    Triquell: { titols: /Basura/i },
    Julieta: {
        titols: /Bikini Rojo|Si tienes fr[ií]o|En la plaza|Sue[ñn]os|El mundo sin ti|En mi mente|En mi coche|T[uú] y yo|- Loba$/i,
    },
    Sangtraït: { titols: /Tentando a la Suerte/i },
    'Xavier de Bétera': { titols: /Vengo de moler morena|Fandango pide la ni[ñn]a/i },
    Ocults: { titols: /^Mi Carro|Barco de Rejilla/i },
    KOP: { titols: /c[aá]rceles en llamas|Desalojos son disturbios|Salta la Luna/i },
    'La Madam': { titols: /Habitada y Deshabitada|^Gozando|Prende Ese Fuego/i },
};

// Títols (o trossos del títol) sense distingir majúscules, amb límits de paraula que entenen els accents.
function llista(...titols) {
    const escapa = titol => titol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![\\p{L}\\p{N}])(?:${titols.map(escapa).join('|')})(?![\\p{L}\\p{N}])`, 'iu');
}

// Afegeix títols a la regla d'un canal (la crea si no n'hi ha). Les regles «totes» no es toquen.
function afegeix(canals, titols) {
    const nova = llista(...titols);
    for (const canal of [].concat(canals)) {
        const actual = REGLES[canal];
        if (actual?.totes) continue;
        const abans = actual?.titols;
        REGLES[canal] = { titols: abans ? { test: titol => abans.test(titol) || nova.test(titol) } : nova };
    }
}

// Revisió del 2026-10-02: artistes amb canal «Tema» (o amb cançons noves al feed). A petició de l'usuari s'amaguen
// les cançons en castellà i també les d'altres llengües (anglès, portuguès, gallec, italià, llatí, basc, japonès…).
// L'occità (aranès) i el català no s'amaguen. La clau és el channelTitle exacte (el canal oficial i el del Tema
// poden tenir noms diferents: s'hi posen tots dos).
afegeix('Txarango', [
    'Mr. Tambourine Man',
    'El Martillo',
    'Por Ambos Lados',
    'Camina Derechito',
    'Tom Dooley',
    'Atrévete a Vivir',
    '500 Millas',
    'Resiste y Grita',
    'La Vuelta al Mundo',
    'Volveremos',
    'Corazón Viajero',
    'Sueña Como un Niño',
]);
afegeix('Sílvia Comes', [
    'Canción de Aniversario',
    'El Cuento de los Dos Suicidas',
    'Faltando un Pedaco',
    'Carta de Amor',
    'Peeping Tom',
    'Para Estar Contigo',
    'Malest Cornifici Tuo Catulo',
    'Días D',
    'Después de Hablar',
    'Dije Mi Amor',
    'Como los Erizos',
    'Canción de los Caracoles',
    'Un Hombre Con Su Amor',
    'Bolero para Gil de Biedma',
    'En Retaguardia',
    'Nana a la Nena de la Pena',
    'Viene la Ausencia',
    'He Dormido',
    'Silencio de Nieve',
    'Todo Asusta',
    'Cuando Muera',
    'Cuando el Eco del Eco',
    'Versos Que Escribí Dormida',
    'Carta Canción',
    'Suceso',
    'Casida a una Casada',
    'Letanía',
]);
afegeix('Sílvia Pérez Cruz', [
    'Intro: la sed',
    'El golpe bajo',
    'Mar muerto',
    'El primer beso',
    'Sea Creature',
    'É triste viver sem seu amor',
    'Mañana',
    'Gallo Rojo',
    'Loca',
    'Tonada De Luna Llena',
    'La Tarde',
    'Debí Llorar',
    'Vete De Mí',
    'Ella Y Yo',
    'Qué Dirías De Mi',
    'Ya No Me Quieres',
    'Ayuda',
    'Salir distinto',
    'Mi última canción triste',
    'Pequeño Vals Vienés',
    'No Hay Tanto Pan',
    'Cerca De Tu Casa',
    'Nombrar es imposible',
    'Toda la vida, un día',
    'Barquito de papel',
    'Cucurrucucú Paloma',
    'Sólo Se Trata de Vivir',
    'La Nochera',
]);
afegeix('Ceaxe', [
    'SE REVELÓ',
    'POR LO NUESTRO',
    'DIME MI AMOR',
    'TE ARREPENTISTE',
    'CUANDO EL RESTO TE FALTE',
    'BAILA SOLA',
    'Tu y Yo',
    'Lo Que No Cumplimos',
    'PA TI',
    'PA TI II',
    'Jodido',
    'Tú',
    'Si Te Preguntan X Mi',
    'Nos Matamos',
    'Mírame de Nuevo',
    'Prometi',
]);
afegeix(
    ['ALBERT PLA', 'Albert Pla'],
    [
        'Mi voz',
        'El Mortadela',
        'Perdónenme',
        'Todo Me Va Bien',
        'Experiencia Religiosa',
        'Bombas en Madrid',
        'Pobre Muchacha',
        'Sufre Como Yo',
        'No Quise Hacerle Daño',
        'Mi Esqueleto',
        'Mujer Mala',
        'El Lado Mas Bestia de la Vida',
        'Añoro',
        "Salsa Pa'l Nene",
        'Soy Rebelde',
        'Que Mas Me Da Si Da O No Da',
        'Joaquin el Necio',
        'El Bar de la Esquina',
        'El Camion De La Basura',
        'Veintegenarios',
        'Enterrador De Cementerios',
        'Marcelino Arroyo Del Charco',
        'Mañana Lo Dejo',
        'La Dejo O No La Dejo',
        'El Gallo Eduardo Montenegro',
        'Carta Al Rey Melchor',
        'La Dama De La Guadaña',
        'Lola La Loca',
        'La Colilla',
        'La Diferencia',
        'Ciego',
        'Juerga Catalana',
        'Soñando',
        'Buscando',
        'Hongos',
        'Corazón',
    ]
);
afegeix(
    ['Miki Nuñez', 'Miki Núñez'],
    [
        'Encender Las Calles',
        'Los 7 Males',
        'La Escalera',
        'Ahora',
        'Mil Planes',
        'La Última Palabra',
        'Vivir Al 100',
        'La Cabaña',
        'Apaga La Luz',
        'Y Escribir',
        'Tanto Tiempo',
        'Nadie Se Salva',
        'Some Nights',
        'Hijos De La Tierra',
        'Promesas Que No Valen Nada',
        'Can We Dance',
        'El Patio',
        'Quédate En Madrid',
        'Alma Mía',
        'Trevo (Tu)',
        'Those little things',
        'Hero (Family of the Year)',
        'Mistletoe',
        'All of me',
        'Thinking out loud',
    ]
);
afegeix(
    ['alfredgarcia', 'Alfred García'],
    [
        'Contigo',
        'Just A Light',
        'Otra Liza',
        'Someday',
        'Jesus Gave Me Water',
        'Toro De Cristal',
        'Praia Dos Moinhos',
        'For So Long',
        'La Chica De Ayer',
        'Cicatriz',
        'Insurrección',
        'Amar Volar Al Invierno',
        'LET ME GO',
        'Amar Pelos Dois',
        'La Ciudad',
        'Himno Del Prat',
        'No Cuentes Conmigo',
        'Wonder',
        'Cuando Duermes',
        'Get It Together',
        "Don't Stop The Music",
        'Rock With You',
        'El Mismo Sol',
        'Sign Of The Times',
        'Vete De Mí',
        'Maldita Dulzura',
        'Todo Mi Amor Eres Tú',
        'Solo Si Es Contigo',
        'Everytime You Go Away',
        'City Of Stars',
        'Tu Canción',
    ]
);
afegeix('Jofre Bardagí', [
    'Señora',
    'Es caprichoso el azar',
    'Fiesta',
    'Hoy puede ser un gran día',
    'Cantares',
    'Aquellas pequeñas cosas',
    'Penélope',
    'Para la libertad',
    'Una mujer desnuda y en lo oscuro',
    'Mediterráneo',
]);
afegeix('Lídia Pujol', [
    'Me Quedaré Soltera',
    'Mi Querida España',
    'Ramito de Violetas',
    'Mi Primera Comunión',
    'Nada de Nada',
    'Sogna fiore mio',
    'Ad mortem festinamus',
    'El Cristo de los piojos',
    'Y una madre',
    'Stella splendens',
    'Polorum regina',
    'Que Despierte La Novia',
]);
afegeix('Dàmaris Gelabert', [
    'Los Meses del Año',
    'El Baile de Izquierda y Derecha',
    'Los Días de la Semana',
    'Las Estaciones',
    '¡A Recoger!',
]);
afegeix('Marina Rossell', [
    'De Que Hablas Habanera',
    'Yo Te Dire',
    'Grândola, vila morena',
    'Mi Soledad',
    'Y una Rosa Roja',
    'Había un Jardín',
    'El Meteco',
    'Va, pensiero',
    'La Bella Lola',
    'La Paloma',
    'Mi Madre Fue una Mulata',
    'Si Me Quieres Escribir',
]);
afegeix('Sopa de Cabra', [
    'Todo Lo Que Se',
    'El Sexo (Que Me Hace Feliz)',
    'Sin Hablar',
    'Mundo Infierno',
    'Cardíaco y Acabado',
    'Viviendo a Tu Alrededor',
]);
afegeix(
    ['Montse Castellà - Cantautora', 'Montse Castellà'],
    [
        'Flor de las Bellas Ciudades del Mundo',
        'A Orillas Del Río Ebro',
        '¿Quién mejor que tú?',
        'No hay poeta solitario',
    ]
);
afegeix('Joan Colomo', [
    'Solo se vive una vez',
    'Todo es tan jodidamente relativo',
    'El Nuevo Orden Cósmico',
    'Reses Sociales',
    'El abismo de uno mismo',
    'A diestro y siniestro',
    'Producto Interior Bruto',
]);
afegeix('Andreu Rifé', ['Sácate la Ternura', 'Mañana de Ayer, de Hoy', 'Crimen', 'Dos Rombos', 'Quién Fuera']);
afegeix('Buhos', [
    'Cerca de ti',
    'Today is the day',
    'Sweet Caroline',
    'La última y Nos Vamos',
    'Ha Sido Ramón',
    'Vuela Aunque Duela',
    'Se Acelera',
]);
afegeix('31 FAM', [
    'CONDENAO',
    'Por La Música',
    'TUVE SUERTE',
    'Te Gusto',
    'Mente de Loco',
    'Cuento',
    'ROMPE',
    'Se Lo Debo',
    'Sincero',
    'Sabor a Menta',
    'Tranquila',
    'EN LA WAVE',
    'A Letter 2 Grandma',
    'PURGATORY',
    'NO LOVE',
    'Make It Rain',
    'Rip Hoe',
    'Touchdown',
]);
afegeix('KOP', [
    'En el medio del ring',
    'Cicatrices',
    'A Gasolina',
    'No te rindas',
    'Desalojos',
    'Nuestros Barrios',
    'Freedom',
    'Golpe Radikal',
    'Utzi Bakean',
    'La Tormenta',
    'Tu Voz Estalla Dentro',
    "We're Not Angels",
    'La Lucha Continúa',
]);
afegeix('Manu Guix', [
    'Tiempo para creer',
    'Sueños de un lunático',
    'Para seguir en pie',
    'Garganta con arena',
    'En tres minutos',
    'La compañía de la fantasía',
    'Había una vez',
    'Noches De Amor',
    'Magicas Notas',
    'Greased Lightnin',
]);
afegeix('Adrià Puntí', [
    // Umpah-Pah · Triquiñuelas al óleo (1994) — disc en castellà
    'El Preludio del Adiós',
    'Entre Tu y Tu Yo',
    'Entre Tú y Yo',
    'El Gitanillo de Tiana',
    'El Dedo en la Llaga',
    'Con Premeditación y Alevosía',
    'Com Premeditación y Alevosía',
    'Sed de Mal',
    'Migajas de Almidón',
    'Sin Jaleos de Conciencia',
    'Peladilla Amarga',
    'Un Compendio en Mi Menor',
    'Testarudez',
    // Umpah-Pah · La columna de Simeón (1996) — disc en castellà
    'La Columna de Simeon',
    'La Columna de Simeón',
    'Barba Azul',
    'Tocayo',
    'Sueño Dormido',
    'Color de Higado',
    'Color de Hígado',
    'En Cuarentena',
    'Circunspección',
    'Sí',
    'Sonrisita Preñada',
    'Te Odio',
    'Vinculus Corruptus',
    'Después',
    // Col·laboracions publicades sota el nom d'Adrià Puntí
    'Rencillas por Pasión',
    'Sed de Vien',
]);
afegeix('Roger Mas', ['La Llorona', 'La Bien Pagá', 'Amore che vieni, amore che vai']);
afegeix('The Tyets', [
    'Let Me Alive',
    'BEBESITA',
    'Oye Mulata',
    'Vaticano',
    'Se Queda',
    'Me Escapé Con un Trompetista',
    'Bailoteo',
]);
afegeix('Brams', ['Two Girls', '¿Qué pone en tu DNI?', 'Rojo Separatista']);
afegeix('La Tour De Carol', ['ragazza spettacolare', 'A TODO TREN', "M'aider"]);
afegeix('Frans Cuspinera', ['Árbol Torcido', 'Siempre Contigo']);
afegeix(
    ['Baya Baye', 'BAYA BAYE'],
    ['Fin de Año', 'Orujo de Hierbas', 'Pa Ke Me Invitas', 'AS BESTAS', 'Hustle Hard', 'Flames', 'Tutto Passa']
);
afegeix('Flashy Ice Cream', ['Toda la noche', 'Forever Young', 'Aleluya']);
afegeix('Sara Roy', [
    'PARTE DE MÍ',
    'Una vez más',
    'Ni tú ni yo',
    'Desde la ventana',
    'Todo',
    'Jamás',
    'Tiempo',
    'Maybe',
    'Día de invierno',
]);
afegeix(['AYRYN', 'Ayryn'], ['Ya no lloro', 'Nada', 'Si tu te vas']);
afegeix('Pere Tapias', ['Oye José María', 'Moreno de la Fe']);
afegeix('Júlia Cruz', ['Para llegar']);
afegeix('Júlia Colom', ['Canta para seguir']);
afegeix('Gessamí Boada', [
    'Beautiful World',
    'Moving On',
    'Last Day on Earth',
    'Shivering Clouds',
    'Como ave pasajera',
    'Oh What a Night',
    'Beneath the Shady Water',
    'White Flowers',
    'Los Dos',
    'Whispering Leaves',
    'Unique',
    'Use Your Imagination',
    'Qué Más Da',
    'Constellations',
    'YA NO MÁS',
    'Love Is You',
    'In the Shadows of Your Mind',
    'Dust in the Sky',
    'Man in the Mirror',
    'Blah Blah Blah',
]);
afegeix('El Pony Pisador', [
    'Santianna',
    "Sam's gone away",
    'Lime Scurvy',
    'Paddy Lay Back',
    'Haul Away Joe',
    'Rolling in the Morning',
    'El Guisote del Tío Benito',
    'John Kanaka',
    "Don't Forget Your Old Shipmate",
    'Essequibo River',
    'Pass Around the Grog',
    'Pay Me My Money Down',
    'Roll the Woodpile Down',
    'Bully in the Alley',
    'Wellerman',
    'Whip Jamboree',
]);
afegeix('Dr. Calypso', [
    'The power of the latin soul',
    "Let's Try Again",
    'Mr. Happiness',
    'Live Together',
    'Reggae Lovers',
    'Keep On Walkin',
    'Slow Boat To Trinidad',
    'Special Girl',
    'Por Favor',
    'Tu Rostro',
    'Born to be alive',
]);
afegeix('Crim', [
    'Blue Blood, Red Sky',
    'Welcome My Enemy',
    'Castles Made Of Sand',
    'Our Father You Who Art In Hell',
    'Watch Your Back',
    'Eternal Cold',
    'Prince Of The Rodeo',
    'FREE FALLING',
    'PAPER BOATS',
    'A SONG AND A PROMISE',
    'Hard Bass Attack',
    'Bullfight',
]);
afegeix(
    ['Mishima', 'MISHIMA'],
    ['Lullaby of Barcelona', 'Del Montón', 'My Whole Life Crying', 'Every second', 'Hasta que lo miras']
);
afegeix(['GOSSOS', 'Gossos'], ['Doraemon No Uta', 'Club Tonight', 'Baby Only You', 'La calle 24']);
afegeix('Anaïs Vila', ['But We Are Still Here', 'The Calm']);
afegeix('The Demencials', ['El Fuego del Corazón', 'We Are', 'You Wondering Now', 'خالد']);
afegeix(['AUXILI', 'Auxili'], ['Rude Girl', 'Imposibles']);
afegeix('Siderland', ['La Vida Líquida', 'Let Me Love Ya']);
afegeix('Ebri Knight', [
    'VIENTOS DEL PUEBLO',
    'EL PARTISANO',
    'CANCIÓN DEL FRENTE UNIDO',
    'LA VOZ DORMIDA',
    'VIVA LA QUINTA BRIGADA',
    'Viva la Quinta Brigada',
    'El Pueblo Unido',
    'Campesino',
    'The Hills of Connemara',
    'Global Ice',
]);
afegeix('Toti Soler', ['Todos Os Sonhos do Mundo', 'El Corazón Es Agua']);
afegeix('Gertrudis', [
    'Carita De Rosa',
    'Bota Pa La Lambon',
    'Almejilla',
    'Al Sentir La Rumba',
    'Manos Arriba',
    'Oye',
    '5 minutillos',
    'Rúa da Raiña',
    'Rua de Raiña',
]);
// Mariona Escoda — exclusions editorials: Juno, Requiem i peces amb títol anglès del repertori acústic.
afegeix(['Mariona Escoda', 'Mariona Escoda - Topic'], ['Juno', 'Requiem', "Everybody's changing", 'Maniac']);
// Daveu — «Mi broda» exclosa a petició de l'usuari; el canal Tema es diu DAVEU.
afegeix(['DAVEU', 'DAVEU))'], ['MI BRODA']);

// Ven'nus — només català: s'exclouen les peces que barregen o fan servir altres llengües.
afegeix(["VEN'NUS", "Ven'nus"], [
    'Carmen se fue',
    'I JAZZ WANT MY G BACK',
    "It's So Hard To Be So Funny",
]);

afegeix('Sandra Bautista', [
    'Pandela',
    'Ni so que le pare',
    'Sentada en un meteorito',
    'Desamparada',
    'El último gol',
    'Vid amurallada',
    'Cupido contra Afrodita',
    'GRACIAS',
    'Mamma, rema',
    'Y si vuelve un general',
    'La noche de la ceguera',
    'Os narradores do cinema mudo',
    'Mirada felina',
    'CROWDFUNDING',
    'Crowdfunding',
    'La nada es para renacer',
    'Luna (ft Ferran Exceso',
    'Sydney de la Amazonia',
    'Silêncio',
    'Dejar sentirse ahogao',
    'Canta el cuco',
    'Un beso de esos',
    'Horas (Jorge Drexler)',
]);

// Revisió del 2026-10-02 (segona passada, a petició de l'usuari): Sílvia Pérez Cruz i Albert Pla.
afegeix('Sílvia Pérez Cruz', ['Chundwa', 'Gelando', 'Moreno', 'Capitana', 'Mechita', 'Verde', "Hymne A L'Amour"]);
afegeix(['ALBERT PLA', 'Albert Pla'], ['Pepe Botika', 'Alboraya', 'Así se hizo']);
afegeix(['alfredgarcia', 'Alfred García'], ['Mateo', '1997', 'Madrid', '2001', 'Londres', 'SEVILLA']);

// Revisió del 2026-10-03: Opció K-95. Es mantenen «Oi! You!» (Cap Oportunitat és íntegrament en català)
// i «Partisans». S'amaguen només les peces confirmades en anglès.
afegeix(['Opció K-95', 'Opcio K-95', 'Opció K-95 - Topic', 'Opcio K-95 - Topic'], [
    'A World To Win',
    'Kill The Bastards',
    'No more colours one army',
    'We must break our chains',
    "We're Free",
    'Nation of Oi!',
    'Working Class Hell',
]);

function esCastella(video) {
    const regla = REGLES[video.channelTitle];
    if (!regla) return false;
    if (!['song', 'live_song'].includes(video.contentType)) return false;
    const titol = String(video.title || '');
    if (regla.totes) return !(regla.excepte && regla.excepte.test(titol));
    return regla.titols.test(titol);
}

function main() {
    const dryRun = process.argv.includes('--dry-run');
    const feed = JSON.parse(fs.readFileSync(FEED_FILE, 'utf8'));
    const hidden = JSON.parse(fs.readFileSync(HIDDEN_FILE, 'utf8'));
    const ids = new Set((hidden.videoIds || []).map(String));
    const nous = (feed.videos || []).filter(esCastella).filter(video => !ids.has(String(video.id)));

    nous.forEach(video => console.log(`- ${video.id} · ${video.channelTitle} · ${video.title}`));
    console.log(`${dryRun ? '🔎' : '🙈'} ${nous.length} cançons en castellà${dryRun ? ' (simulació)' : ' ocultades'}.`);
    if (dryRun || nous.length === 0) return;

    hidden.videoIds = [...ids, ...nous.map(video => String(video.id))];
    fs.writeFileSync(HIDDEN_FILE, `${JSON.stringify(hidden, null, 2)}\n`);
}

if (require.main === module) main();
module.exports = { esCastella, REGLES };
