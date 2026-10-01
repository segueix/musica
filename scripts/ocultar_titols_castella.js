'use strict';

// Oculta cançons amb títol en castellà afegint-ne els IDs a data/hidden-videos.json.
// El client aplica aquesta llista a feed, cerques i ràdio, i update_music_feed.js la respecta
// en regeneracions futures.
//
// Mode històric/manual:
//   node scripts/ocultar_titols_castella.js [--dry-run]
// Mode específic Cançó d'autor (detecció conservadora només pel títol):
//   node scripts/ocultar_titols_castella.js --canco-autor [--dry-run]

const fs = require('fs');
const path = require('path');

const FEED_FILE = path.join(process.cwd(), 'data', 'feed.json');
const HIDDEN_FILE = path.join(process.cwd(), 'data', 'hidden-videos.json');

const REGLES = {
  MARLENA: { totes: true },
  miquel: { titols: /Tu Forma de Amar|¡Es el rey|Machom[eé]n|espectro de Francisco|Isabel y Fernando|Luis, s[eé] fuerte|Mediterr[aá]neo/i },
  'Joan Manuel Serrat': { totes: true, excepte: /Per al Meu Amic/i },
  'Umpah Pah': {
    titols: /Sin Jaleos|Circunspecci|Despu[eé]s|Sonrisita|Preludio del Adios|Sue[ñn]o Dormido|Dedo de la Llaga|Tocayo|Te Odio|Color de Higado|Gitanillo de Tiana/i,
  },
  'Judit Neddermann': { titols: /canci[oó]n que me cura|d[oó]nde dormir|hace un tiempo|alegr[ií]a de vivir|^Velas$|la respuesta/i },
  Ceaxe: { titols: /POR PRIMERA VEZ|PA SIEMPRE|TE ENCONTR|SE SIENTE|MUERO X ESA/i },
  SUU: { titols: /los d[ií]as como hoy|Me siento mejor|Si me est[aá]s rondando|[UÚ]limamente|Cantando goles|^Un poco|Uno de Septiembre/i },
  'Miki Nuñez': { titols: /M[aá]s De La Cuenta|- Suerte|- La Mitad|Entre Un Mill[oó]n|Dime Que No Duele/i },
  alfredgarcia: { titols: /Siempre as[ií]|Las cosas sencillas|Llamas en el cielo/i },
  Sisa: { titols: /Hay mujeres|Te esperar[eé] el domingo/i },
  '31 FAM': { titols: /C[OÓ]MO ME DOLI[OÓ]|AMOR Y ODIO/i },
  CACTUS: { titols: /NOCHE LOCA|DIUEN X AH[IÍ]/i },
  'BAYA BAYE': { titols: /JUERGA Y REBELD|CUMBIA DEL PAPU/i },
  'Txarango Oficial': { titols: /BENDITA VIDA/i },
  elo: { titols: /De Casi Nada/i },
  'Joan Colomo': { titols: /Tus Pies|Enmienda a la totalidad/i },
  'Cristina Monllau': { titols: /Una Vez M[aá]s/i },
  'Joan Dausà': { titols: /GALLO ROJO/i },
  'Sandra Monfort': { titols: /Las Flores|Brillo de Luna/i },
  Triquell: { titols: /Basura/i },
  Julieta: { titols: /Bikini Rojo/i },
  'Sangtraït': { titols: /Tentando a la Suerte/i },
  'Xavier de Bétera': { titols: /Vengo de moler morena|Fandango pide la ni[ñn]a/i },
  Ocults: { titols: /^Mi Carro|Barco de Rejilla/i },
  'KOP Oficial': { titols: /c[aá]rceles en llamas|Desalojos son disturbios|Salta la Luna/i },
  'La Madam': { titols: /Habitada y Deshabitada|^Gozando/i },
};

const MOTS_CA = new Set([
  'amb','els','les','als','aixo','aquest','aquesta','aquests','aquestes','aquell','aquella',
  'meu','meva','meus','meves','teu','teva','teus','teves','seu','seva','seus','seves',
  'mes','pero','que','avui','dema','ahir','mai','tornar','torno','torna','vull','vols','volem',
  'puc','pots','podem','tinc','tens','tenim','dona','dones','nen','nena','nens','nenes',
  'peto','petons','lluna','cami','camins','flors','ulls','peus','canço','cançons'
]);

const MOTS_ES = new Set([
  'con','sin','para','por','muy','como','cuando','donde','quien','quienes','porque','aunque',
  'pero','tambien','yo','usted','ustedes','mientras','hacia','desde','hasta','hay','hace',
  'otro','otra','otros','otras','algo','alguien','nadie','todo','toda','todos','todas',
  'mi','mis','tus','sus','contigo','conmigo','quiero','quieres','quiere','puedo','puedes',
  'puede','tengo','tienes','tiene','soy','eres','estoy','estas','vuelvo','vuelve','dime',
  'dame','dejame','vengo','siento','sientes','siente','esperare','hago','pensar'
]);

const MOTS_ES_FORTS = new Set([
  'hoy','manana','siempre','nunca','mujer','mujeres','hombre','hombres','nino','nina','ninos','ninas',
  'sueno','suenos','suerte','verdad','mentira','volver','fiesta','pueblo','blanco','blanca','negro',
  'negra','rojo','roja','cielo','tiempo','camino','caminos','flores','ojos','manos','libertad',
  'despedida','recuerdo','recuerdos','pequeno','pequena','pequenos','pequenas','locos','locas','pies',
  'bajitos','bajitas','senora','senor','cantares','vez','veces','corazon','corazones','cancion',
  'canciones','basura','brillo','carceles','desalojos','disturbios'
]);

function senseAccents(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^$()|[\]{}\\]/g, '\\$&');
}

function netejaTitol(title, channelTitle = '') {
  let out = String(title || '').trim();
  const canal = String(channelTitle || '').trim();
  if (canal) {
    out = out.replace(new RegExp('^' + escapeRegex(canal) + '\\s*[-–—:|]\\s*', 'i'), '').trim();
  }

  const soroll = /\s*(?:[-–—|]\s*)?(?:\(|\[)?\s*(?:official\s+(?:music\s+)?video|official\s+audio|video\s+oficial|vídeo\s+oficial|videoclip\s+oficial|audio\s+oficial|lyric\s+video|lyrics?|audio|live(?:\s+session)?|en\s+directo|en\s+directe|acoustic|acústic[oa]?)\s*(?:\)|\])?\s*$/iu;
  let anterior;
  do {
    anterior = out;
    out = out.replace(soroll, '').trim();
  } while (out !== anterior);
  return out;
}

function paraules(title) {
  return senseAccents(title)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function esTitolClaramentCastella(title, channelTitle = '') {
  const net = netejaTitol(title, channelTitle);
  if (!net) return false;

  if (/[¿¡ñá]/iu.test(net)) return true;

  const words = paraules(net);
  if (!words.length) return false;

  const ca = words.reduce((n, word) => n + (MOTS_CA.has(word) ? 1 : 0), 0)
    + (/[çàèò]|l·l/iu.test(net) ? 3 : 0)
    + (/\b\w*ny\w*\b/iu.test(net) ? 2 : 0)
    + (/\b[ldnstm]['’][\p{L}]/iu.test(net) ? 2 : 0);

  if (ca >= 2) return false;

  const strong = words.filter(word => MOTS_ES_FORTS.has(word)).length;
  const es = words.reduce((n, word) => n + (MOTS_ES.has(word) ? 1 : 0), 0);

  if (strong >= 1 && ca === 0) return true;
  if (es >= 2 && ca === 0) return true;
  if ((strong + es) >= 3 && ca <= 1) return true;
  return false;
}

function esCancoAutorCastella(video) {
  if (!['song', 'live_song'].includes(String(video?.contentType || '').toLowerCase())) return false;
  if (!Array.isArray(video?.categories) || !video.categories.includes("Cançó d'autor")) return false;
  return esTitolClaramentCastella(video.title, video.channelTitle);
}

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
  const cancoAutor = process.argv.includes('--canco-autor');
  const feed = JSON.parse(fs.readFileSync(FEED_FILE, 'utf8'));
  const hidden = JSON.parse(fs.readFileSync(HIDDEN_FILE, 'utf8'));
  const ids = new Set((hidden.videoIds || []).map(String));
  const detector = cancoAutor ? esCancoAutorCastella : esCastella;
  const nous = (feed.videos || []).filter(detector).filter(video => !ids.has(String(video.id)));

  nous.forEach(video => console.log('- ' + video.id + ' · ' + video.channelTitle + ' · ' + video.title));
  const ambit = cancoAutor ? " de Cançó d'autor" : '';
  console.log((dryRun ? '🔎' : '🙈') + ' ' + nous.length + ' cançons' + ambit + ' amb títol clarament castellà' + (dryRun ? ' (simulació)' : ' ocultades') + '.');
  if (dryRun || nous.length === 0) return;

  hidden.videoIds = [...ids, ...nous.map(video => String(video.id))];
  fs.writeFileSync(HIDDEN_FILE, JSON.stringify(hidden, null, 2) + '\n');
}

if (require.main === module) main();
module.exports = {
  esCastella,
  esCancoAutorCastella,
  esTitolClaramentCastella,
  netejaTitol,
  REGLES,
};
