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
  miquel: { titols: /Tu Forma de Amar|¡Es el rey|Machom[eé]n|espectro de Francisco|Isabel y Fernando|Luis, s[eé] fuerte|Mediterr[aá]neo/i },
  'Joan Manuel Serrat': { totes: true, excepte: /Per al Meu Amic|Paraules d['’]Amor/i },
  'Umpah Pah': {
    titols: /Sin Jaleos|Circunspecci|Despu[eé]s|Sonrisita|Preludio del Adios|Sue[ñn]o Dormido|Dedo de la Llaga|Tocayo|Te Odio|Color de Higado|Gitanillo de Tiana/i,
  },
  'Judit Neddermann': {
    titols:
      /canci[oó]n que me cura|d[oó]nde dormir|hace un tiempo|alegr\S{1,2}a de vivir|^Velas$|la respuesta|Siento Que Vuela|Como Un Amuleto|La Llave De La Alegr|Ll[eé]vame Contigo|Vivo Viva|^Canta$|^Luna$|^Celebrar$|Mendien Artean|Zure Ostean|Gorantza|Ahizpa|Neurean|Lamiak/i,
  },
  Ceaxe: { titols: /POR PRIMERA VEZ|PA SIEMPRE|TE ENCONTR|SE SIENTE|MUERO X ESA/i },
  SUU: { titols: /los d[ií]as como hoy|Me siento mejor|Si me est[aá]s rondando|[UÚ]limamente|Cantando goles|^Un poco|Uno de Septiembre/i },
  'Miki Nuñez': { titols: /M[aá]s De La Cuenta|- Suerte|- La Mitad|Entre Un Mill[oó]n|Dime Que No Duele/i },
  alfredgarcia: { titols: /Siempre as[ií]|Las cosas sencillas|Llamas en el cielo/i },
  Sisa: { titols: /Hay mujeres|Te esperar[eé] el domingo/i },
  '31 FAM': { titols: /C[OÓ]MO ME DOLI[OÓ]|AMOR Y ODIO|CUANDO ME MIRAS|AS\S{1,2} ES LA VIDA|OBSESIONADO|NO LE DURA|SEPTIEMBRE/i },
  CACTUS: { titols: /NOCHE LOCA|DIUEN X AH[IÍ]/i },
  Mushkaa: { titols: /LOS 15 \(PQ STAS TRISTE\)|Bello Bellaco|El Disfraz|Se[ñn]al de Respeto|Imperio/i },
  Sexenni: {
    titols: /Todas mis ex|Klk quieren|- Tengo \(|Mentalidad de Mero|Halc[oó]n Milenario|Antip[aá]nico/i,
  },
  'DAVEU))': { titols: /SUE[ÑN]OS DE CAMPE[OÓ]N/i },
  Scorpio: { titols: /^Ya No \(/i },
  'BAYA BAYE': { titols: /CANIBALISMO HUMANO|DINERO Y VENENO|EL GATO NEGRO|DE TO LOS COLORS|PA QUE ME INVITAS|JUERGA Y REBELD|CUMBIA DEL PAPU/i },
  'P.A.W.N. Gang': { titols: /MODO AVI[OÓ]N/i },
  Txarango: { titols: /BENDITA VIDA/i },
  elo: { titols: /De Casi Nada/i },
  'Joan Colomo': { titols: /Tus Pies|Enmienda a la totalidad/i },
  'Cristina Monllau': { titols: /Una Vez M[aá]s/i },
  'Joan Dausà': { titols: /GALLO ROJO/i },
  'Sandra Monfort': { titols: /Las Flores|Brillo de Luna/i },
  Triquell: { titols: /Basura/i },
  Julieta: { titols: /Bikini Rojo|Si tienes fr[ií]o|En la plaza|Sue[ñn]os|El mundo sin ti|En mi mente|En mi coche|T[uú] y yo|- Loba$/i },
  'Sangtraït': { titols: /Tentando a la Suerte/i },
  'Xavier de Bétera': { titols: /Vengo de moler morena|Fandango pide la ni[ñn]a/i },
  Ocults: { titols: /^Mi Carro|Barco de Rejilla/i },
  KOP: { titols: /c[aá]rceles en llamas|Desalojos son disturbios|Salta la Luna/i },
  'La Madam': { titols: /Habitada y Deshabitada|^Gozando/i },
};

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
