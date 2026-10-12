import { describe, it, expect } from 'vitest';
import { loadScript } from './setup.js';
import { readFileSync } from 'node:fs';
const api = loadScript('js/features/nearby-radio.js', { document: { addEventListener() {} } }).SegueixApp.features.nearbyRadio;
const point = (latitude, longitude = 2) => ({ latitude, longitude });
const place = (name, latitude, territory = 'Catalunya') => ({ name, type: 'municipality', territory, coordinates: point(latitude) });
const catalog = { places: { a: place('A', 41), b: place('B', 42), region: { name: 'Illa', type: 'island' } },
 channels: { official: 'artist:one', topic: 'artist:one', second: 'artist:two', regional: 'artist:three' },
 artists: { 'artist:one': { name: 'Primer', status: 'validated', placeIds: ['a'] }, 'artist:two': { name: 'Segon', status: 'validated', placeIds: ['b'] }, 'artist:three': { name: 'Tercer', status: 'validated', placeIds: ['region'] } } };
const references = { places: { capital: place('Capital', 41.5) }, references: { region: { placeIds: ['capital'] } } };
const videos = [{ id: 'one', channelId: 'official', contentType: 'song' }, { id: 'two', channelId: 'topic', contentType: 'song' }, { id: 'three', channelId: 'second', contentType: 'song' }, { id: 'four', channelId: 'regional', contentType: 'song' }];
const build = options => api.buildRows({ catalog, references, videos, origin: point(41), ...options });
describe('ràdio A prop teu', () => {
 it('calcula quilòmetres en línia recta i rebutja coordenades invàlides', () => {
  expect(api.distance(point(41), point(41))).toBe(0);
  expect(api.distance(point(41), point(42))).toBeCloseTo(111.195, 2);
  expect(api.distance(point(100), point(42))).toBe(Infinity);
 });
 it('agrupa oficial i Topic i ordena artistes per proximitat', () => {
  const rows = build();
  expect(rows.map(r => r.artist)).toEqual(['Primer', 'Tercer', 'Segon']);
  expect(rows).toHaveLength(3);
  expect(rows[1].location).toMatchObject({ name: 'Illa', reference: 'Capital', approximate: true });
 });
 it('escull la cançó segons el motor però no altera l’ordre geogràfic', () => {
  const rows = build({ rank: tracks => [...tracks].reverse() });
  expect(rows[0].video.id).toBe('two');
  expect(rows.map(r => r.artist)).toEqual(['Primer', 'Tercer', 'Segon']);
  expect(build({ avoidIds: new Set(['one']) })[0].video.id).toBe('two');
 });
 it('exclou Shorts, contingut no musical i artistes sense localització', () => {
  expect(build({ videos: [...videos.map(v => ({ ...v, isShort: true })), { id: 'x', channelId: 'official', contentType: 'album' }, { id: 'y', channelId: 'unknown' }] })).toEqual([]);
 });
 it('agafa el vincle més proper i no inventa ubicacions en zones sense referència', () => {
  expect(api.artistLocation({ placeIds: ['a', 'b'] }, point(42), catalog, references).name).toBe('B');
  expect(api.artistLocation({ placeIds: ['region'] }, point(42), catalog, { references: {} })).toBeNull();
 });
 it('la cerca manual admet els cinc territoris i rebutja altres zones i aeroports', () => {
  const base = { id: 1, name: 'Poble', latitude: 41, longitude: 2, feature_code: 'PPL' };
  for (const item of [{ country_code: 'ES', admin1_id: 3336901 }, { country_code: 'ES', admin1_id: 2593113 }, { country_code: 'ES', admin1_id: 2521383 }, { country_code: 'FR', admin2_id: 2984885 }, { country_code: 'AD' }]) expect(api.remotePlace({ ...base, ...item })).not.toBeNull();
  expect(api.remotePlace({ ...base, country_code: 'ES', admin1_id: 3117732 })).toBeNull();
  expect(api.remotePlace({ ...base, country_code: 'FR', admin2_id: 1 })).toBeNull();
  expect(api.remotePlace({ ...base, country_code: 'AD', feature_code: 'AIRP' })).toBeNull();
 });
 it('els lots consecutius de 20 no repeteixen artistes ni perden l’ordre', () => {
  const c = { places: {}, channels: {}, artists: {} }, v = [];
  for (let i = 0; i < 45; i++) { c.places[i] = place('P'+i, 40+i/100); c.channels[i] = 'a'+i; c.artists['a'+i] = { name: 'A'+i, status: 'validated', placeIds: [i] }; v.push({ id: 'v'+i, channelId: i }); }
  const rows = build({ catalog: c, videos: v, origin: point(40) });
  expect(rows.slice(0,20)).toHaveLength(20); expect(rows.slice(20,40)).toHaveLength(20);
  expect(new Set(rows.slice(0,40).map(r => r.artistId)).size).toBe(40);
  expect(rows.every((r,i) => !i || r.location.distance >= rows[i-1].location.distance)).toBe(true);
 });
 it('totes les zones editorials tenen capitals resolubles sense modificar els orígens', () => {
  const c = JSON.parse(readFileSync('data/origens-artistes.json'));
  const r = JSON.parse(readFileSync('data/proximitat-musical.json'));
  for (const [id, p] of Object.entries(c.places).filter(([,p]) => p.type !== 'municipality')) {
   expect(api.artistLocation({ placeIds: [id] }, point(41), c, r), p.name).not.toBeNull();
   expect(p.coordinates == null).toBe(true);
  }
 });
});
it('el reproductor conserva els 20 artistes i no els barreja en actualitzar gustos', () => {
 const calls = [];
 const ctx = loadScript('js/features/music-queue.js', {
  document: { readyState: 'loading', addEventListener() {}, body: { classList: { contains: () => false } } },
  isPlaylistMode: false, activePlaylistId: null, activePlaylistName: '', activePlaylistQueue: [], currentPlaylistIndex: 0,
  loadVideoInSequence: options => calls.push(options), clearEmbeddedYouTubeSession() {},
 });
 const queue = ctx.SegueixApp.features.musicQueue;
 const songs = Array.from({ length: 20 }, (_, i) => ({ id: `v${i}`, channelId: `c${i}`, contentType: 'song' }));
 expect(queue.playSelection(songs, 'A prop teu · la Garriga')).toBe(true);
 expect(ctx.activePlaylistQueue.map(v => v.id)).toEqual(songs.map(v => v.id));
 expect(calls[0].autoPlay).toBe(false);
 queue.regenerate({ keepNext: true }); queue.regenerate();
 expect(ctx.activePlaylistQueue.map(v => v.id)).toEqual(songs.map(v => v.id));
 expect(queue.playlistName()).toBe('A prop teu · la Garriga');
});
it('carrega el catàleg amb YouTubeAPI lexical encara que no existeixi a window', async () => {
 const { runInNewContext } = await import('node:vm');
 const source = readFileSync('js/features/nearby-radio.js', 'utf8');
 const start = source.indexOf('    async function load()');
 const code = source.slice(start, source.indexOf('    function localPlaces', start));
 const ctx = { window: {}, state: { catalog: {}, videos: [] }, app: { features: { musicQueue: { nearbyPool: list => list.filter(v => v.id !== 'blocked') } } } };
 runInNewContext(`const YouTubeAPI = { feedVideos: [{id:'hot'}, {id:'hidden'}], ensureStyleHistory: async () => [{id:'archive'}, {id:'blocked'}], filterHiddenVideos: list => list.filter(v => v.id !== 'hidden') };\n${code}`, ctx);
 await ctx.load();
 expect(ctx.state.videos.map(v => v.id)).toEqual(['hot', 'archive']);
});

describe('«A prop teu» a la portada', () => {
 const store = {};
 const ls = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
 const card = () => loadScript('js/features/nearby-radio.js', { document: { addEventListener() {} }, localStorage: ls }).SegueixApp.features.nearbyRadio.cardHtml();
 it('sense localitat desada ofereix la ubicació i triar una localitat', () => {
  const html = card();
  expect(html).toContain('data-near-open="gps"');
  expect(html).toContain('data-near-open="search"');
  expect(html).not.toContain('data-near-quick');
 });
 it('amb una localitat desada la ràdio s’engega d’un toc i es pot canviar la ubicació', () => {
  store.segueix_nearby_manual_v1 = JSON.stringify({ name: 'Vic <b>', territory: 'Catalunya', coordinates: point(41.93) });
  const html = card();
  expect(html).toContain('data-near-quick');
  expect(html).toContain('La teva zona: <strong>Vic &lt;b&gt;</strong>');
  expect(html).toContain('Canvia la ubicació');
  delete store.segueix_nearby_manual_v1;
 });
 it('surt just després de «Comença per aquí», abans de les novetats', () => {
  const src = readFileSync('js/features/portada.js', 'utf8');
  const lead = src.indexOf('${model.lead ? leadHtml(model.lead)');
  const near = src.indexOf('nearbyRadio?.cardHtml?.()');
  const fresh = src.indexOf('${model.fresh ? freshHtml(');
  expect(lead).toBeLessThan(near);
  expect(near).toBeLessThan(fresh);
 });
 it('el diàleg és a pantalla completa al mòbil i té els botons fixos a baix', () => {
  const css = readFileSync('css/portada.css', 'utf8');
  const block = css.slice(css.indexOf('«A prop teu» (js/features/nearby-radio.js'));
  expect(block).toMatch(/\.near-dialog \{[\s\S]*?margin: auto;/);
  expect(block).toMatch(/@media \(max-width: 600px\) \{\s*\.near-dialog \{\s*width: 100vw;\s*height: 100dvh;/);
  expect(block).toMatch(/\.near-body \{[\s\S]*?overflow-y: auto;/);
 });
});

describe('tipus de ràdio «A prop teu»', () => {
 const tracks = [{ id: 'a', viewCount: 500 }, { id: 'b', viewCount: 20000 }, { id: 'c', viewCount: 0 }, { id: 'd', viewCount: 40 }];
 it('«Les més escoltades» posa la cançó amb més visualitzacions de cada artista', () => {
  expect(api.rankByType(tracks, 'popular')[0].id).toBe('b');
 });
 it('«Joies amagades» posa la menys escoltada amb alguna escolta', () => {
  expect(api.rankByType(tracks, 'hidden')[0].id).toBe('d');
  expect(api.rankByType([{ id: 'z', viewCount: 0 }], 'hidden')[0].id).toBe('z');
 });
 it('«Equilibrada» (i sense visualitzacions) delega en el motor', () => {
  const engine = list => [...list].reverse();
  expect(api.rankByType(tracks, 'mix', engine)[0].id).toBe('d');
  expect(api.rankByType([{ id: 'x' }, { id: 'y' }], 'popular', engine)[0].id).toBe('y');
 });
 it('l’ordre per distància no depèn del tipus', () => {
  const rows = build({ rank: list => api.rankByType(list, 'popular') });
  expect(rows.map(r => r.artist)).toEqual(['Primer', 'Tercer', 'Segon']);
 });
 it('la targeta porta el selector de tres tipus i les caràtules amb km', () => {
  const html = loadScript('js/features/nearby-radio.js', { document: { addEventListener() {} } }).SegueixApp.features.nearbyRadio.cardHtml();
  expect(html).toContain('Quina ràdio vols?');
  for (const label of ['Les més escoltades', 'Equilibrada', 'Joies amagades']) expect(html).toContain(label);
  const src = readFileSync('js/features/nearby-radio.js', 'utf8');
  expect(src).toContain('class="pt-near__km"');
  expect(src).toContain('class="near-row__cover"');
 });
});
