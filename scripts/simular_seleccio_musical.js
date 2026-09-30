'use strict';

// Simulació reproduïble del motor de selecció musical sobre el catàleg REAL (data/feed.json).
// Els usuaris són sintètics: NO són dades de producció ni mesuren retenció ni satisfacció.
//
// Ús:  node scripts/simular_seleccio_musical.js            # informe per consola
//      node scripts/simular_seleccio_musical.js --write    # escriu docs/MUSICA_SELECCIO_SIMULACIO.md

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const NOW = Date.parse(process.env.SIM_NOW || '2026-09-30T12:00:00Z');
const RUNS = Number(process.env.SIM_RUNS || 80);
const WRITE = process.argv.includes('--write');

const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));

function load(file, extra = {}) {
  const sandbox = { console, Math, JSON, Set, Map, Date, Number, String, Array, Object, RegExp, Infinity, isFinite, parseInt, ...extra };
  sandbox.window = sandbox;
  sandbox.SegueixApp = sandbox.SegueixApp || { features: {}, state: {}, utils: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
  return sandbox;
}

const app = { features: {}, state: {}, utils: {} };
load('js/features/music-selection.js', { SegueixApp: app });
const helpers = load('js/utils/helpers.js', { YouTubeAPI: undefined });
const E = app.features.musicSelection;

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fold = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const feed = read('data/feed.json');
const classicNames = new Set(read('data/musica-classica.json').artistes.map(fold));
const classicChannels = new Set();
const identity = new Map();
read('data/artistes-musica.json').artists.forEach(artist => {
  (artist.youtube?.channels || []).forEach(channel => {
    if (classicNames.has(fold(artist.name))) classicChannels.add(channel.id);
    if (!identity.has(channel.id)) identity.set(channel.id, artist.wikidataId ? `wd:${artist.wikidataId}` : artist.musicbrainzId ? `mb:${artist.musicbrainzId}` : `n:${fold(artist.name)}`);
  });
});
const artistKeyOf = video => String(identity.get(video.channelId) || video.channelId || '').toLowerCase();
const songs = feed.videos.filter(v => ['song', 'live_song'].includes(v.contentType) && !v.isShort && (v.durationSeconds || 0) >= 60);
const isClassicArtist = video => classicChannels.has(video.channelId);
const ctx = E.createContext({
  videos: songs,
  now: NOW,
  artistKeyOf,
  isClassicArtist,
  stylesOf: video => (video.categories || []).map(x => x.toLowerCase()),
});
const tier = video => ctx.features.get(video.id).tier;

// ---------- «Abans»: política anterior (aproximació sense l'ordre de Música TV, que depèn del navegador) ----------
// Candidates per data de pujada, una per artista, limitClassicFrequency (1 de cada 5) i spreadVideosByArtist.
const legacyIsClassic = video => classicChannels.has(video.channelId) || NOW - Date.parse(video.publishedAt || 0) >= 8 * 365.25 * 86400000;
function legacyQueue(seed, rng, watched = new Set()) {
  const seen = new Set([artistKeyOf(seed)]);
  const unique = [];
  songs
    .filter(v => v.id !== seed.id && !watched.has(v.id))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) + (rng() - 0.5) * 60 * 86400000)
    .forEach(v => {
      const key = artistKeyOf(v);
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(v);
    });
  const limited = helpers.limitClassicFrequency(unique, { every: 5, isClassic: legacyIsClassic });
  return [seed, ...limited].slice(0, 40);
}

function engineQueue(seed, rng, signals) {
  const result = E.selectRadio({ ctx, candidates: songs.filter(v => v.id !== seed.id), seed, signals: signals || E.emptySignals(), mode: 'mix', rng });
  return { queue: [seed, ...result.queue], meta: result.meta };
}

// Mètriques d'una cua
function measure(queue) {
  const top = queue.slice(0, 20);
  const tiers = { recent: 0, mid: 0, historic: 0 };
  let consecutive = 0;
  top.forEach((video, i) => {
    tiers[tier(video)] += 1;
    if (i > 0 && tier(video) === 'historic' && tier(top[i - 1]) === 'historic') consecutive += 1;
  });
  const counts = new Map();
  top.forEach(video => counts.set(artistKeyOf(video), (counts.get(artistKeyOf(video)) || 0) + 1));
  return { tiers, consecutive, maxArtist: Math.max(...counts.values()), distinct: counts.size, n: top.length };
}

function aggregate(queues) {
  const total = { recent: 0, mid: 0, historic: 0, n: 0, distinct: 0, consecutive: 0, maxArtist: 0, maxHistoric: 0, over2: 0 };
  queues.forEach(queue => {
    const m = measure(queue);
    Object.keys(m.tiers).forEach(k => (total[k] += m.tiers[k]));
    total.n += m.n;
    total.distinct += m.distinct;
    total.consecutive += m.consecutive;
    total.maxArtist = Math.max(total.maxArtist, m.maxArtist);
    total.maxHistoric = Math.max(total.maxHistoric, m.tiers.historic);
    if (m.tiers.historic > 2) total.over2 += 1;
  });
  const pct = value => `${((100 * value) / total.n).toFixed(1)} %`;
  return {
    recent: pct(total.recent),
    mid: pct(total.mid),
    historic: pct(total.historic),
    distinct: (total.distinct / queues.length).toFixed(1),
    maxArtist: total.maxArtist,
    maxHistoric: total.maxHistoric,
    over2: `${total.over2}/${queues.length}`,
    consecutive: total.consecutive,
  };
}

const seeds = Array.from({ length: RUNS }, (_, i) => mulberry(1000 + i));
const pickSeed = rng => songs[Math.floor(rng() * songs.length)];

const lines = [];
const out = line => lines.push(line);
const table = (head, rows) => {
  out(`| ${head.join(' | ')} |`);
  out(`| ${head.map(() => '---').join(' | ')} |`);
  rows.forEach(row => out(`| ${row.join(' | ')} |`));
  out('');
};

out('# Simulació del motor de selecció musical');
out('');
out(`> Generat per \`node scripts/simular_seleccio_musical.js\` amb el catàleg de \`data/feed.json\` (${songs.length} cançons i directes elegibles de ${new Set(songs.map(artistKeyOf)).size} artistes), rellotge fixat a ${new Date(NOW).toISOString().slice(0, 10)} i ${RUNS} llavors fixes.`);
out('> **Són resultats de simulació amb usuaris sintètics sobre el catàleg real. No són dades de producció i no mesuren retenció ni satisfacció.** «Abans» és una aproximació de la política anterior (candidates per data de pujada, una per artista, 1 antiga de cada 5 i alternança d’artista) sense l’ordre de Música TV, que depèn del navegador.');
out('');

// 1) Catàleg
const catalogTiers = { recent: 0, mid: 0, historic: 0 };
songs.forEach(video => (catalogTiers[tier(video)] += 1));
const reissues = songs.filter(v => E.eraOf(v, { now: NOW, isClassicArtist }).isReissue);
out('## Catàleg');
out('');
table(['Antiguitat real', 'Cançons', 'Part'], [
  ['Darrers 24 mesos', catalogTiers.recent, `${((100 * catalogTiers.recent) / songs.length).toFixed(1)} %`],
  ['De 2 a 8 anys', catalogTiers.mid, `${((100 * catalogTiers.mid) / songs.length).toFixed(1)} %`],
  ['Més de 8 anys / catàleg històric confirmat', catalogTiers.historic, `${((100 * catalogTiers.historic) / songs.length).toFixed(1)} %`],
]);
const withYear = songs.filter(v => v.originalYear).length;
out(`Cançons amb any original d’evidència (\`Released on\`, ℗ o manual): ${withYear} de ${songs.length}. Reedicions (pujades més de 2 anys després de la gravació): ${reissues.length}.`);
out('');
const recentUploads = songs.filter(v => NOW - Date.parse(v.publishedAt) <= 30 * 86400000);
const genuinelyNew = recentUploads.filter(v => E.isNewRelease(v, { now: NOW, isClassicArtist }));
out(`Pujades dels darrers 30 dies: ${recentUploads.length}; d’aquestes, estrenes de debò segons el motor: ${genuinelyNew.length}. Per data de pujada, «Acabades de sortir» n’hauria presentat ${recentUploads.length} com a estrena.`);
out('');

// 2) Usuari nou
const before = aggregate(seeds.map(rng => legacyQueue(pickSeed(rng), rng)));
const afterQueues = seeds.map(rng => engineQueue(pickSeed(rng), rng).queue);
const after = aggregate(afterQueues);
out('## Usuari nou: 20 primeres cançons de la ràdio general');
out('');
table(['Mètrica', 'Abans (aproximació)', 'Després (motor)'], [
  ['Darrers 24 mesos', before.recent, after.recent],
  ['De 2 a 8 anys', before.mid, after.mid],
  ['Històriques', before.historic, after.historic],
  ['Cues amb més de 2 històriques a les 20 primeres', before.over2, after.over2],
  ['Màxim d’històriques a les 20 primeres', before.maxHistoric, after.maxHistoric],
  ['Parelles d’històriques seguides', before.consecutive, after.consecutive],
  ['Artistes diferents a les 20 primeres (mitjana)', before.distinct, after.distinct],
  ['Màxim de cançons d’un artista a les 20 primeres', before.maxArtist, after.maxArtist],
]);
out('Objectiu orientatiu: 65 / 25 / 10. Els límits (2 històriques i mai seguides) s’apliquen a la cua final.');
out('');
const sample = engineQueue(songs[Math.floor(mulberry(42)() * songs.length)], mulberry(43));
out('Mostra de cua (usuari nou, llavor 43; `R` recent, `M` mitjana, `H` històrica):');
out('');
sample.queue.slice(0, 15).forEach((video, i) => out(`${i + 1}. [${tier(video)[0].toUpperCase()}] ${video.channelTitle} — ${video.title.replace(/\|/g, '/').slice(0, 70)}`));
out('');

// 3) Seguir / cor / Quico
const TYETS = 'UC--8TyZ2PM0NFHWXCzQrUqw';
const QUICO = 'UCerj0bWFVJdAmPWVti9Uhlw';
const runWith = (signals, runs = RUNS) => Array.from({ length: runs }, (_, i) => {
  const rng = mulberry(5000 + i);
  return engineQueue(pickSeed(rng), rng, signals).queue;
});
const base = E.emptySignals();
// Tres artistes actuals seguits (perquè hi hagi personalització sense inclinar-la cap a música antiga)
['Manel', 'Els Catarres', 'Buhos'].forEach(name => {
  const found = songs.find(v => v.channelTitle === name);
  if (found) base.followed.add(artistKeyOf(found));
});
const withFollow = E.emptySignals();
base.followed.forEach(key => withFollow.followed.add(key));
withFollow.followed.add(artistKeyOf({ channelId: TYETS }));
const tyetsKey = artistKeyOf({ channelId: TYETS });
// Presència d'un artista i màxim de cançons seves a les 20 primeres, sobre un conjunt de cues
const presenceKey = (queues, key) => {
  const withArtist = queues.filter(q => q.slice(0, 20).some(v => artistKeyOf(v) === key)).length;
  const most = Math.max(0, ...queues.map(q => q.slice(0, 20).filter(v => artistKeyOf(v) === key).length));
  return [`${((100 * withArtist) / queues.length).toFixed(1)} %`, most];
};
const noLikes = E.emptySignals();
const quico = songs.filter(v => v.channelId === QUICO);
const quicoKey = artistKeyOf({ channelId: QUICO });
const quicoTaste = E.emptySignals();
quicoTaste.followed.add(quicoKey);
quico.slice(0, 4).forEach(v => {
  quicoTaste.liked.add(v.id);
  quicoTaste.songs[v.id] = { q: 4, f: 3, r: 3, l: NOW - 3 * 86400000 };
});
const oneClick = E.emptySignals();
oneClick.songs[quico[0].id] = { h: 1, l: NOW - 86400000 };
oneClick.artists[quicoKey] = { h: 1 };
const pref = signals => E.eraPreference(ctx, signals, {});
const row = (label, queues, key, signals) => {
  const [presence, most] = presenceKey(queues, key);
  const p = pref(signals);
  return [label, presence, most, `${p.maxHistoricTop}${p.strong ? ' (preferència forta cap a música antiga)' : ''}`];
};
out('## Seguiments, cors i preferència per música antiga (usuaris sintètics)');
out('');
table(['Escenari', 'Cues amb l’artista a les 20 primeres', 'Màx. cançons seves a les 20 primeres', 'Històriques permeses (de 20)'], [
  row('The Tyets — sense seguir (3 altres artistes seguits)', runWith(base), tyetsKey, base),
  row('The Tyets — seguit', runWith(withFollow), tyetsKey, withFollow),
  row('Quico Pi de la Serra — usuari nou', runWith(noLikes), quicoKey, noLikes),
  row('Quico Pi de la Serra — un sol clic a l’historial', runWith(oneClick), quicoKey, oneClick),
  row('Quico Pi de la Serra — seguit + 4 cors i repeticions', runWith(quicoTaste), quicoKey, quicoTaste),
]);
out('Seguir un artista n’augmenta la presència però el límit d’artista es manté (segona columna). En un escenari amb un únic artista antic seguit, només amb senyals forts (seguiment, cors i repeticions voluntàries) s’amplia el cupo d’històriques; un sol clic a l’historial no el canvia.');
out('');

// 4) Cançons retornades
const pool = songs.filter(v => v.channelId !== QUICO).slice(0, 400);
const favorite = pool[7];
const returnSignals = E.emptySignals();
pool.slice(10, 13).forEach(v => returnSignals.followed.add(artistKeyOf(v)));
const frequencyOf = (signals, id) => {
  let hits = 0;
  for (let i = 0; i < RUNS; i++) {
    const rng = mulberry(7000 + i);
    if (engineQueue(pickSeed(rng), rng, signals).queue.slice(1, 21).some(v => v.id === id)) hits += 1;
  }
  return `${((100 * hits) / RUNS).toFixed(1)} %`;
};
const lowScore = songs
  .filter(v => !returnSignals.followed.has(artistKeyOf(v)))
  .map(v => ({ v, s: E.scoreOne(v, ctx, returnSignals, null, {}).score }))
  .sort((a, b) => a.s - b.s)[Math.floor(songs.length * 0.05)].v;
const hearted = E.emptySignals();
returnSignals.followed.forEach(k => hearted.followed.add(k));
hearted.songs[lowScore.id] = { h: 1, l: NOW - 30 * 86400000 };
const heartedOn = E.emptySignals();
returnSignals.followed.forEach(k => heartedOn.followed.add(k));
heartedOn.songs[lowScore.id] = { h: 1, l: NOW - 30 * 86400000 };
heartedOn.liked.add(lowScore.id);
heartedOn.likedArtists[artistKeyOf(lowScore)] = 1;
const five = E.emptySignals();
returnSignals.followed.forEach(k => five.followed.add(k));
five.songs[lowScore.id] = { q: 5, f: 5, r: 4, l: NOW - 30 * 86400000 };
const one = E.emptySignals();
returnSignals.followed.forEach(k => one.followed.add(k));
one.songs[lowScore.id] = { q: 1, f: 1, r: 0, l: NOW - 30 * 86400000 };
out('## Cançons que retornen (una cançó concreta amb baixa puntuació de base, a l’historial des de fa 30 dies)');
out('');
table(['Senyal', 'Probabilitat de sortir a les 20 primeres'], [
  ['Només a l’historial (visita antiga)', frequencyOf(hearted, lowScore.id)],
  ['Una escolta qualificada i finalitzada', frequencyOf(one, lowScore.id)],
  ['Cinc escoltes voluntàries qualificades', frequencyOf(five, lowScore.id)],
  ['Amb cor', frequencyOf(heartedOn, lowScore.id)],
]);
void favorite;
const returnItems = E.pickReturn({ ctx, candidates: songs, signals: (() => {
  const s = E.emptySignals();
  songs.slice(20, 40).forEach((v, i) => {
    if (i % 3 === 0) s.liked.add(v.id);
    else s.songs[v.id] = { q: 2 + (i % 4), f: 1 + (i % 3), r: i % 3, l: NOW - (2 + i) * 86400000 };
  });
  return s;
})(), limit: 4, now: NOW, rng: mulberry(11) });
out('Mostra de «Torna-hi» (senyals sintètics: cors i escoltes voluntàries):');
out('');
returnItems.forEach(item => out(`- ${item.reason}: ${item.video.channelTitle} — ${item.video.title.replace(/\|/g, '/').slice(0, 60)}`));
out('');

// 5) Categories petites
out('## Categories amb poca música actual');
out('');
const rows = [];
['Pop', 'Jazz / Blues', 'Clàssica', "Cançó d'autor", 'Infantil'].forEach(category => {
  const candidates = songs.filter(v => (v.categories || []).includes(category));
  if (candidates.length < 5) return;
  const seedVideo = candidates[Math.floor(mulberry(3)() * candidates.length)];
  const result = E.selectRadio({ ctx, candidates: candidates.filter(v => v.id !== seedVideo.id), seed: seedVideo, signals: E.emptySignals(), rng: mulberry(9) });
  const q = [seedVideo, ...result.queue];
  const m = measure(q);
  const degradation =
    q.length < 2
      ? 'massa poques cançons: la ràdio passa a general i s’avisa'
      : result.meta.notes.some(n => /molt pocs artistes/.test(n))
        ? 'pocs artistes: cançons seguides del mateix artista i s’avisa'
        : result.meta.notes.some(n => /poca música/.test(n))
          ? 'ampliat amb catàleg històric i s’avisa'
          : 'proporcions habituals';
  rows.push([category, candidates.length, q.length, `${m.tiers.recent}/${m.tiers.mid}/${m.tiers.historic}`, degradation]);
});
table(['Categoria', 'Cançons al catàleg', 'Longitud de la cua', 'Recents/mitjanes/històriques (20 primeres)', 'Degradació'], rows);

// 6) Rendiment
const start = Date.now();
for (let i = 0; i < 10; i++) engineQueue(pickSeed(seeds[i]), seeds[i]);
out('## Rendiment (Node, no mòbil)');
out('');
out(`Selecció d’una cua de 40 sobre ${songs.length} candidates: ${((Date.now() - start) / 10).toFixed(0)} ms de mitjana. El context (antiguitat, popularitat, claus de gravació) es calcula una vegada per feed.`);
out('');

const report = lines.join('\n');
if (WRITE) {
  fs.writeFileSync(path.join(ROOT, 'docs', 'MUSICA_SELECCIO_SIMULACIO.md'), report);
  console.log('✅ docs/MUSICA_SELECCIO_SIMULACIO.md escrit.');
} else {
  console.log(report);
}
