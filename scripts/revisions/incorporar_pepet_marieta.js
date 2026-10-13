'use strict';
// Alta editorial puntual. No descobreix ni aprova vídeos futurs pel nom o pel títol.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
process.chdir(path.resolve(__dirname, '../..'));
const NAME = 'Pepet i Marieta';
const OFFICIAL = 'UCT59tXHgcrnLCerfyEGDghw';
const TOPIC = 'UCPzFXRl5ozCmX7i4CjI3Odw';
const IDS = [TOPIC, OFFICIAL];
const DISCOVERY = 'docs/revisions/2026-10-13-artur-borriana-pepet-pepet.json';
const REPORT = 'docs/revisions/2026-10-13-pepet-marieta-alta.json';
const SUMMARY = 'docs/revisions/2026-10-13-pepet-marieta-alta.md';
const SOURCE = 'https://produccionssubmarines.com/artistes/pepet-i-marieta/';
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const write = (f, j) => fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\n');
const unique = a => [...new Set(a)];
const url = id => 'https://www.youtube.com/watch?v=' + id;
// Títol editorial, font de la lletra, IDs oficials, IDs Tema: fotografia tancada i revisada.
const ROWS = [
 ['Ses platges seran sempre nostres','nlMjxqiJ7kg','nlMjxqiJ7kg','vQa8eS6P9og'],
 ['La placeta de les iaies','EqlTVWyXfl8','EqlTVWyXfl8','G9atw_ivROY'],
 ['Sempre avant','flCY0DKy5J4','flCY0DKy5J4','x0WknSxdjkg'],
 ['Germà','ilVFZObqMRo','ilVFZObqMRo','jUjeYNPwGaU'],
 ['L’Onada','UkwIyD5fjnk','UkwIyD5fjnk','wmrF_tP2A18'],
 ['Rock Star','WZvBTT65CNw','WZvBTT65CNw','s0RxLBFbxBo'],
 ['Crida Yé!','j95nHIt41ZA','j95nHIt41ZA','naR3edJIS78'],
 ['No a la MAT','IjNZaTV2CMA','IjNZaTV2CMA','Ue5whrcVdxI'],
 ['Mallorca ets tu','5omLoKwA4Hc','5omLoKwA4Hc,Tv9DIG56ixM','6txO181HSdY'],
 ['La reina de la festa','xKYMphHBEnI','xKYMphHBEnI','pmFm0lS93GQ'],
 ['Molt més que un tros de mar','eYvoQQPJZhM','eYvoQQPJZhM','LWcIBtdklbc'],
 ['La sortida','uBbchqUF1us','uBbchqUF1us','LTmrUalriHI'],
 ['Ni amo ni senyor','Xu8lPgBmeJA','Xu8lPgBmeJA','Wza0mz7iOT0'],
 ['Tot anirà bé','wvG1KtBqHWw','wvG1KtBqHWw','6A6P1Z35E34'],
 ['Canta','hWs_xpkZJmQ','hWs_xpkZJmQ','SajV15PVcXA,3HbrrctUzdc'],
 ['Som l’Aplec','3iSU6DQx3yE','3iSU6DQx3yE,MRDgs9Mhcug','kpSgSvRybek'],
 ['Un Nadal diferent','5uhq5anByHk','5uhq5anByHk','MG1UpRedpys'],
 ['La vacuna','iIhtQZcIGRM','iIhtQZcIGRM','9cowSCaFxz0,I8U2ihiBJmI'],
 ['Somriu','5Ukdl7rkkqk','5Ukdl7rkkqk,oi5tLvJrdvg,abgkFc98sFQ','jacgfxlLEoE'],
 ['Me moles','mkgaH8Vyu9E','mkgaH8Vyu9E,1xswd_VyTDY','LMyoEAXOMm0'],
 ['Per Quinquennals','VsScHJlyIh4','VsScHJlyIh4','x8PF8LiTEnk'],
 ['Imperfectes','PPM7fJmWJjE','PPM7fJmWJjE','H0gfnq1VkWA'],
 ['Jubilat','Qw15QvqLfeo','Qw15QvqLfeo','pxsWLY6AI3Y'],
 ['Frontera','nyNihETl4mE','nyNihETl4mE,dTNQhSTKeP0','iotRPMpMuH0'],
 ['Súper guai','o1gBqpaDCtg','o1gBqpaDCtg,O035A9wvR-I','V0JfTgOYfuc,7jtu1kuW5tU,kBaX8CxBahM'],
 ['Junts','q_0ej7ADIDM','q_0ej7ADIDM','CKJPmixTU_w'],
 ['10 anys','DRhA3Z1TI74','DRhA3Z1TI74','BCuUGQDK7v4,6DkmamfrUEY'],
 ['Adéu','ZgKjqc1LH1Q','ZgKjqc1LH1Q,oo2jA-arV2s','DaOCpWRR_2c,PA31-x3h5TU'],
 ['L’amor és un amic','xlPNV9lRQDg','xlPNV9lRQDg','RntAqSroSAs'],
 ['La nineta dels meus ulls','GVMI9Swh64k','GVMI9Swh64k','zzxBHArzbus,e8PGF0hxofs'],
 ['Uoioio','eE3kTz2x7Is','eE3kTz2x7Is','LfRv6YBX5U4,nXTydfxqUik,ZTuOhhXVyLc'],
 ['Corre l’estiu','fiGE8DdHWBg','fiGE8DdHWBg','k2fkK8WFOJc'],
 ['Rumba del Sí','2nyVo7P_WMY','2nyVo7P_WMY','ixR3Zf9WZsQ'],
 ['No ho volem','SvJEMxT_vpc','SvJEMxT_vpc',''],
 ['La via','bzMzga2r9aQ','bzMzga2r9aQ,ar2Hs7JNw5g','FbSlQLhBgFQ,MIL3yJPfW8c,Bc6G7xijqEY'],
 ['Sí','yi-XW3V9xqI','yi-XW3V9xqI','gMBfa8y2cr4'],
 ['L’educació no es toca','tIHzwf4UTzs','tIHzwf4UTzs,rYq_dO4fj7A','-WOUHb5XWAM,XfXNaqvZlk8'],
 ['Tornar a ser infants','EC82d9B_Vo4','EC82d9B_Vo4',''],
 ['Ja ve’l Nadal','aQH0pQALvOY','aQH0pQALvOY',''],
];
const EXCLUDED = [
 {title:'El Polvito',source:'zQGzp-ulssE',ids:['zQGzp-ulssE','J67OkvNtx7w','q2LpxrLxRsw'],reason:'Tornada en castellà i estrofes en català.'},
 {title:'Viu',source:'mGhFypzh2OI',ids:['mGhFypzh2OI','9iluOEn8QWA'],reason:'Tornada en anglès i estrofes en català.'},
 {title:'La cova',source:'eVnC5K0vQjk',ids:['eVnC5K0vQjk','rnj7oKq0rZI'],reason:'La lletra oficial inclou estrofes en castellà, malgrat el títol català.'},
 {title:'Lo principal',source:'mXoZXoP0xEs',ids:['mXoZXoP0xEs','ZHqeM2hmWyg'],reason:'Lletra oficial en castellà.'},
 {title:'Pure Cocaine',source:'ewVVfSd7Wo8',ids:['ewVVfSd7Wo8','8msm2W2CrEc','O1Ii1fGz2po'],reason:'Lletra oficial en anglès.'},
 {title:'Vive tu sueño',source:'CMYkz5tGChk',ids:['CMYkz5tGChk','G4l8TtyX8hs','A1E3FknDVbc','-wc85okDNbg'],reason:'Lletra oficial en castellà.'},
 {title:'Que nos quiten lo bailao',source:'xFq1Wj3dWkQ',ids:['xFq1Wj3dWkQ','r0nmk54Ubhs','FFecJKeRAbA'],reason:'Tornada en castellà.'},
];
const csv = s => s.split(',').filter(Boolean);
const selected = ROWS.flatMap(([title,source,official,topic]) => [
 ...csv(official).map(id => ({id,channelId:OFFICIAL,title,source})),
 ...csv(topic).map(id => ({id,channelId:TOPIC,title,source})),
]);
const selectedIds = new Set(selected.map(v => v.id));
const excludedIds = new Set(EXCLUDED.flatMap(e => e.ids));
const LIVE = new Set(['5Ukdl7rkkqk','MRDgs9Mhcug','1xswd_VyTDY','oo2jA-arV2s']);
function evidence(v) {
 if(v.title === 'Ses platges seran sempre nostres') return 'Declaració de l’artista sobre la llengua i correspondència editorial; sense lletra íntegra publicada.';
 if(v.title === 'Somriu') return 'Lletra de la versió oficial del confinament i correspondència documental amb el repertori original; no s’ha escoltat cada versió.';
 return v.id === v.source ? 'Lectura de la lletra publicada a la descripció oficial.' : 'Correspondència editorial amb la mateixa obra i crèdits; font de lletra oficial indicada. No és una escolta individual.';
}
function assertSelection(discovery) {
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(DISCOVERY)).digest('hex'),'4957b9d26bbf082fa5f4e16d06b1f678428c6bb5bf2ee548a4f775697d6c3fb5','La fotografia de revisió ha canviat');
 assert.equal(selected.length,97);
 assert.equal(selectedIds.size,97,'IDs duplicats');
 const videos = new Map(discovery.channels.flatMap(c => c.videos).map(v => [v.id,v]));
 for(const c of discovery.channels) assert(c.complete,'Inventari incomplet');
 for(const v of selected) {
  const item = videos.get(v.id);
  assert(item && item.channelId === v.channelId && item.embeddable,'Identitat o inserció no verificades: '+v.id);
  const region = item.regionRestriction || {};
  assert(!region.blocked?.includes('ES') && (!region.allowed || region.allowed.includes('ES')),'Restricció territorial');
  assert(!excludedIds.has(v.id),'Una exclusió lingüística apareix a la selecció');
  assert(videos.get(v.source)?.description,'Falta la font documental');
 }
 for(const e of EXCLUDED) for(const id of e.ids) assert(videos.has(id),'Exclusió no identificada: '+id);
 return videos;
}
function apply() {
 const now = new Date().toISOString();
 const discovery = read(DISCOVERY);
 const videos = assertSelection(discovery);
 const base = read('data/artistes-musica.json');
 const origins = read('data/origens-artistes.json');
 const allow = read('data/music-channel-video-allowlist.json');
 const types = read('data/music-content-overrides.json');
 const watch = read('data/artistes-vigilats-idioma.json');
 const hidden = read('data/hidden-videos.json');
 const language = read('data/revisio-idiomes.json');
 const previous = base.artists.filter(a => a.name === NAME);
 assert.equal(previous.length,1,'Cal un registre canònic únic');
 const artist = previous[0];
 assert(artist.reviewStatus !== 'rebutjat','Hi ha una baixa editorial que cal respectar');
 assert((artist.youtube?.channels || []).every(c => IDS.includes(c.id)),'Canals previs no reconciliats');
 fs.writeFileSync('/tmp/pepet-base-before.json',JSON.stringify(base));
 fs.copyFileSync('js/channels-ca.json','/tmp/pepet-channels-before.json');
 const origin = origins.artists['artist:pepet-i-marieta'];
 assert(origin?.status === 'validated' && origin.placeIds.includes('geonames:3107305'),'Origen d’Ulldecona no validat');
 assert.equal(origins.places['geonames:3107305'].name.toLowerCase(),'ulldecona');
 const note = 'Selecció tancada de 97 enregistraments. Repertori multilingüe: les altres pistes i les novetats requereixen revisió. '+REPORT;
 Object.assign(artist,{displayName:NAME,genres:['Pop','Rumba / Mestissatge','Ska / Reggae'],territories:['Catalunya'],languages:['ca'],confidence:'alta',reviewStatus:'aprovat',active:true,lastChecked:'2026-10-13',notes:note,sources:unique([...(artist.sources || []),SOURCE,'https://www.youtube.com/@pepetimarieta','genre:manual',REPORT])});
 artist.youtube = {...artist.youtube,channels:IDS.map(id => {
  const c = discovery.channels.find(c => c.id === id);
  return {id,name:c.name,handle:c.handle,type:id === TOPIC ? 'topic' : 'official',primary:id === TOPIC};
 })};
 for(const id of IDS) {
  assert(!origins.channels[id] || origins.channels[id] === 'artist:pepet-i-marieta','Canal assignat a un altre artista');
  origins.channels[id] = 'artist:pepet-i-marieta';
  const before = allow.channels[id];
  assert(!before?.blocked && (!before?.allowedVideoIds || before.allowedVideoIds.every(i => selectedIds.has(i))),'Selecció prèvia diferent');
  allow.channels[id] = {artist:NAME,note,allowedVideoIds:selected.filter(v => v.channelId === id).map(v => v.id),acceptedMusicOnly:true,allowedContentTypes:['song','live_song']};
 }
 language.decisions ||= [];
 for(const v of selected) {
  const item = videos.get(v.id);
  assert(!hidden.videoIds.includes(v.id),'No es reobre un vídeo ocult: '+v.id);
  const old = language.decisions.find(d => d.id === v.id);
  assert(!old || old.accio !== 'amaga','Decisió prèvia incompatible');
  const type = {id:v.id,contentType:LIVE.has(v.id) ? 'live_song' : 'song',title:item.title,note:'Enregistrament complet de la selecció editorial. '+REPORT};
  const pos = types.videos.findIndex(t => t.id === v.id);
  if(pos < 0) types.videos.push(type); else types.videos[pos] = {...types.videos[pos],...type};
  if(!old) language.decisions.push({id:v.id,accio:'conserva',artista:NAME,titol:item.title,font:url(v.source),origen:REPORT,data:now,metode:evidence(v)});
 }
 for(const e of EXCLUDED) for(const id of e.ids) {
  language.decisions = language.decisions.filter(d => d.id !== id);
  language.decisions.push({id,accio:'amaga',artista:NAME,titol:videos.get(id).title,font:url(e.source),origen:REPORT,data:now,motiu:e.reason});
 }
 hidden.videoIds = unique([...hidden.videoIds,...excludedIds]);
 const reviewed = new Set([...selectedIds,...excludedIds]);
 language.revisades = unique([...(language.revisades || []),...reviewed]);
 for(const key of ['pendents','descartades','acceptadesPerArtista']) language[key] = (language[key] || []).filter(v => !reviewed.has(v.id));
 language.artistesPendents = (language.artistesPendents || []).filter(a => a.artista !== NAME);
 watch.vigilats = (watch.vigilats || []).filter(a => a.artista !== NAME);
 watch.vigilats.push({artista:NAME,aliases:['Pepet i marieta'],canals:IDS,motiu:'Té peces bilingües, castellanes i angleses. Només els enregistraments seleccionats entren al catàleg; no es dedueix l’idioma del títol.',fonts:[SOURCE,...EXCLUDED.map(e => url(e.source))]});
 watch.confianca = (watch.confianca || []).filter(a => (typeof a === 'string' ? a : a.artista) !== NAME);
 const files = {'data/artistes-musica.json':base,'data/origens-artistes.json':origins,'data/music-channel-video-allowlist.json':allow,'data/music-content-overrides.json':types,'data/artistes-vigilats-idioma.json':watch,'data/hidden-videos.json':hidden,'data/revisio-idiomes.json':language};
 for(const [file,data] of Object.entries(files)) {if('updatedAt' in data) data.updatedAt = now;write(file,data);}
 write(REPORT,{schemaVersion:1,reviewedOn:'2026-10-13',artist:NAME,origin:'Ulldecona',genres:artist.genres,selectedRecordings:selected.length,method:'Selecció documental: lletres oficials publicades quan existeixen i correspondència explícita entre edicions. Somriu i Ses platges tenen un grau de contrast diferent, anotat per enregistrament. No s’ha escoltat íntegrament la discografia.',channels:artist.youtube.channels,recordings:selected.map(v => ({...v,source:url(v.source),evidence:evidence(v)})),languageExclusions:EXCLUDED.map(e => ({...e,source:url(e.source)})),notSelected:discovery.channels.flatMap(c => c.videos).filter(v => !selectedIds.has(v.id) && !excludedIds.has(v.id)).map(v => ({id:v.id,channelId:v.channelId,title:v.title,status:'fora-seleccio',reason:'No revisat o no seleccionat en aquesta alta; no s’infereix la llengua només del títol.'})),preservedArtists:['Artur Àlvarez','Borriana Big Band']});
 console.log(JSON.stringify({artist:NAME,recordings:selected.length,channels:IDS,origin:'Ulldecona'}));
}
function verify() {
 const report = read(REPORT);
 const base = read('data/artistes-musica.json');
 const previous = read('/tmp/pepet-base-before.json');
 assert.deepEqual(base.artists.filter(a => a.name !== NAME),previous.artists.filter(a => a.name !== NAME),'Ha canviat un altre artista');
 const allChannels = read('js/channels-ca.json').channels;
 const beforeChannels = read('/tmp/pepet-channels-before.json').channels;
 for(const c of beforeChannels) assert(allChannels.some(n => n.id === c.id),'S’ha perdut un canal anterior: '+c.id);
 const artists = base.artists.filter(a => a.name === NAME);
 assert.equal(artists.length,1);
 assert(artists[0].active && artists[0].youtube.channels.find(c => c.primary).id === TOPIC);
 const feed = read('data/feed.json');
 const {cleanTitle} = require('../../js/song-title.js');
 const {loadChannelVideoAllowlist,isChannelVideoAllowed} = require('../lib/filtre_videos_canal');
 const rules = loadChannelVideoAllowlist('data/music-channel-video-allowlist.json');
 const published = new Map();
 const stats = [];
 for(const id of IDS) {
  const f = 'data/archive/channels/'+id+'.json';
  const archive = fs.existsSync(f) ? read(f).videos : [];
  const hot = feed.videos.filter(v => v.channelId === id);
  const merged = [...new Map([...archive,...hot].map(v => [v.id,v])).values()];
  assert(merged.length > 0,'Canal sense enregistraments');
  for(const v of merged) {
   assert(selectedIds.has(v.id) && !excludedIds.has(v.id) && !v.isShort,'Enregistrament no seleccionat');
   assert(['song','live_song'].includes(v.contentType),'Classificació no musical');
   const title = cleanTitle(v.title,{artists:[NAME,feed.channels[id]?.name,v.channelTitle].filter(Boolean)});
   assert(title.trim() && !/[([{][^()[\]{}]*(video|vídeo|oficial|official)[^()[\]{}]*[)\]}]/i.test(title),'Marca promocional en un títol nou: '+v.id+' '+title);
   published.set(v.id,v);
  }
  assert(fs.existsSync('compartir/artista/'+id+'.html'),'Falta pàgina compartida');
  stats.push({id,type:id === TOPIC ? 'topic' : 'official',hot:hot.length,archive:archive.length,recordings:merged.length});
 }
 for(const id of selectedIds) assert(published.has(id),'Falta un enregistrament seleccionat: '+id);
 for(const e of EXCLUDED) for(const id of e.ids) {
  assert(!published.has(id));
  const c = id === e.ids[0] ? OFFICIAL : TOPIC;
  assert(!isChannelVideoAllowed(rules,c,e.title,id),'Una exclusió torna a entrar');
 }
 for(const id of IDS) assert(!isChannelVideoAllowed(rules,id,'Cançó nova','abcdefghijk'),'La llista permet vídeos futurs');
 const tests = read('/tmp/tardor-blat-quinto-validation.json');
 assert.equal(tests.regressions,0,'No es publica amb regressions');
 report.publication = {checkedAt:new Date().toISOString(),status:'verified',recordings:published.size,channels:stats,tests:{passed:tests.passedTests,preexistingFailures:tests.failedTests,regressions:tests.regressions}};
 write(REPORT,report);
 fs.writeFileSync(SUMMARY,'# Alta de Pepet i Marieta\n\nOrigen: Ulldecona (Montsià).\n\nCategories: '+report.genres.join(', ')+'.\n\n'+published.size+' enregistraments publicats en dos canals agrupats: Tema principal i oficial complementari. El recompte inclou versions, videoclips i àudios; no són composicions úniques.\n\n'+stats.map(c => '- '+c.type+': '+c.recordings+' enregistraments ('+c.hot+' al feed i '+c.archive+' a l’arxiu).').join('\n')+'\n\nExclusions contrastades: '+EXCLUDED.map(e => e.title).join(', ')+'. Altres cançons, col·laboracions, fragments i promocions queden fora d’aquesta selecció, sense donar tota la discografia per revisada.\n\nLa cançó «Sí» es conserva: la descripció conté una traducció anglesa separada de la lletra original catalana. Un títol en català no acredita la llengua: «La cova» queda exclosa per estrofes en castellà.\n\n'+report.method+'\n\nCatàleg, arxiu, origen, pàgines compartides, restriccions i conservació dels artistes anteriors verificats. Artur Àlvarez i Borriana Big Band no s’han tornat a modificar.\n\nProves: '+tests.passedTests+' superades; '+tests.failedTests+' fallades preexistents reproduïdes; cap regressió nova.\n');
 console.log(JSON.stringify(report.publication));
}
if(require.main === module) {
 try {process.argv.includes('--verify') ? verify() : apply();} catch(e) {console.error(e.stack);process.exitCode=1;}
}
module.exports = {selected,EXCLUDED,IDS,assertSelection};
