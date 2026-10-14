'use strict';

const fs = require('fs');
const path = require('path');
const { classifyMusicContent } = require('./lib/classificar_contingut_musical');
const { loadContentOverrides, applyContentOverride } = require('./lib/revisio_manual_musical');
const { normalizeVideoTitle, loadChannelVideoAllowlist, isChannelVideoAllowed, allowsSpanishSubtitles, isChannelVideoUploaderAllowed } = require('./lib/filtre_videos_canal');
const { parseManualDates, stampOriginalYear } = require('./lib/any_original_musical');
const catalog = require('./lib/cataleg_musical');
const polling = require('./lib/activitat-canals-musica');
const { teSubtitolsCastella } = require('./lib/subtitols_castella');
const { slimFeed, serializeFeed } = require('./lib/aprimar_feed');
const tema = require('./lib/canal_tema');
const revisioIdiomes = require('./lib/revisio_idiomes');
const albumsMusic = require('./lib/albums_musica');
const releasesMusic = require('./lib/llancaments_musicals');
const restriccions = require('./lib/restriccions_youtube');
const { REGLES: SPANISH_TITLE_RULES } = require('./ocultar_titols_castella');
const { resolveChannelDisplayName, findNameOverride, loadNameOverrides, stripOfficialWord } = require('./lib/nom_canal');

const API_KEY = process.env.YOUTUBE_API_KEY_SERVER || process.env.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error('❌ Falta YOUTUBE_API_KEY_SERVER.');
  process.exit(1);
}

const ARTISTS_FILE = path.join(process.cwd(), 'data', 'artistes-musica.json');
const FEED_FILE = path.join(process.cwd(), 'data', 'feed.json');
const CHANNELS_FILE = path.join(process.cwd(), 'js', 'channels-ca.json');
const CHANNEL_NAMES_FILE = path.join(process.cwd(), 'data', 'noms-canals.json');
const AUDIT_FILE = path.join(process.cwd(), 'data', 'music-feed-audit.json');
const CONTENT_AUDIT_FILE = path.join(process.cwd(), 'data', 'music-content-audit.json');
const REVIEW_FILE = path.join(process.cwd(), 'data', 'music-content-review.json');
const FALSE_SHORTS_FILE = path.join(process.cwd(), 'data', 'falsos-shorts.json');
const CONTENT_OVERRIDES_FILE = path.join(process.cwd(), 'data', 'music-content-overrides.json');
const CHANNEL_VIDEO_ALLOWLIST_FILE = path.join(process.cwd(), 'data', 'music-channel-video-allowlist.json');
const ORIGINAL_DATES_FILE = path.join(process.cwd(), 'data', 'musica-dates.json');
const CLASSIC_FILE = path.join(process.cwd(), 'data', 'musica-classica.json');
const CATALOG_STATE_FILE = path.join(process.cwd(), 'data', 'music-catalog-state.json');
const TOPIC_CATALOG_FILE = path.join(process.cwd(), 'data', 'music-topic-catalog.json');
// Pàgines (de 50) que es llegeixen de cada canal Tema: la discografia sencera fins a 500 pistes.
const TOPIC_MAX_PAGES = Math.max(1, Number.parseInt(process.env.MUSIC_TOPIC_MAX_PAGES || '10', 10));
// Només es consulten els canals vençuts segons la seva activitat. Les lectures completes dels Tema
// es reprenen al primer torn vençut després de TOPIC_FULL_DAYS, sense perdre torns ajornats.
const TOPIC_FULL_DAYS = Math.max(1, Number.parseInt(process.env.MUSIC_TOPIC_FULL_DAYS || '7', 10));
const TOPIC_FORCE_FULL_READ = process.env.MUSIC_TOPIC_FULL_READ === '1';
// Un vídeo del canal propi d'un artista amb Tema publicat fa menys d'aquests dies es manté encara que la cançó
// no sigui al Tema (el videoclip d'un senzill sol arribar abans que la distribuïdora la publiqui).
const TOPIC_GRACE_DAYS = 30;
// «audit»: només anota a data/music-topic-review.json què es trauria del canal propi (no ho aplica);
// «apply»: el Tema mana. Es passa a «apply» quan la revisió confirma que la discografia es llegeix bé.
const TOPIC_GOVERNANCE = process.env.MUSIC_TOPIC_GOVERNANCE === 'apply' ? 'apply' : 'audit';
const TOPIC_REVIEW_FILE = path.join(process.cwd(), 'data', 'music-topic-review.json');
// Cançons noves pendents de revisar l'idioma (les revisa un agent amb el vistiplau de l'usuari).
const LANGUAGE_REVIEW_FILE = path.join(process.cwd(), 'data', 'revisio-idiomes.json');
const ALBUMS_FILE = path.join(process.cwd(), 'data', 'albums-musica.json');
const RELEASES_FILE = path.join(process.cwd(), 'data', 'llancaments-musicals.json');
const RELEASES_STATE_FILE = path.join(process.cwd(), 'data', 'llancaments-estat.json');
const DEEP_PAGE_BUDGET = Math.max(0, Number.parseInt(process.env.MUSIC_DEEP_PAGE_BUDGET || String(catalog.DEFAULTS.deepPageBudget), 10));
const EXTRA_DEEP_CHANNELS = String(process.env.MUSIC_DEEP_CHANNELS || '').split(',').map(v=>v.trim()).filter(Boolean);
const VIDEOS_PER_CHANNEL = Math.max(1, Math.min(50, Number.parseInt(process.env.MUSIC_VIDEOS_PER_CHANNEL || '50', 10)));
const API = 'https://www.googleapis.com/youtube/v3';

const GROUPS = [
  { label:'Urban', genres:['Urbana'] },
  { label:'Pop', genres:['Pop'] },
  { label:'Rock', genres:['Rock'] },
  { label:"Cançó d'autor", genres:["Cançó d'autor"] },
  { label:'Indie', genres:['Indie / Alternativa'] },
  { label:'Rap / Hip-hop', genres:['Rap / Hip-hop'] },
  { label:'Folk i arrel', genres:['Folk i arrel'] },
  { label:'Electrònica', genres:['Electrònica'] },
  { label:'Ska / Reggae', genres:['Ska / Reggae'] },
  { label:'Rumba / Mestissatge', genres:['Rumba / Mestissatge'] },
  { label:'Punk', genres:['Punk'] },
  { label:'Heavy / Metal', genres:['Metal'] },
  { label:'Jazz / Blues', genres:['Jazz / Blues'] },
  { label:'Clàssica', genres:['Clàssica i contemporània','Coral / Vocal'] },
  { label:'Infantil', genres:['Infantil'] },
  { label:'Altres estils', genres:['Funk / Soul / R&B','Experimental / Avantguarda','Altres'] },
];

function unique(values){ return [...new Set((values||[]).map(v=>String(v||'').trim()).filter(Boolean))]; }
function cleanChannelDisplayName(value, fallback=''){
  const raw=String(value||fallback||'').trim();
  const cleaned=raw.replace(/\s*-\s*(?:topic|tòpic)\s*$/i,'').trim();
  // Mai «Oficial»/«Official» al nom del grup
  return stripOfficialWord(cleaned) || String(fallback||'').trim();
}
function chunks(items,size){ const out=[]; for(let i=0;i<items.length;i+=size) out.push(items.slice(i,i+size)); return out; }
function categoriesForGenres(genres){
  const set=new Set(genres||[]);
  return GROUPS.filter(g=>g.genres.some(x=>set.has(x))).map(g=>g.label);
}
function durationSeconds(iso){
  const m=String(iso||'').match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if(!m) return 0;
  return (Number(m[1]||0)*86400)+(Number(m[2]||0)*3600)+(Number(m[3]||0)*60)+Number(m[4]||0);
}

function isShortByDuration(seconds){
  const value=Number(seconds||0);
  return value>0 && value<=120;
}
function loadFalseShortRules(){
  if(!fs.existsSync(FALSE_SHORTS_FILE)) return { ids:new Set(), titleContains:[] };
  try{
    const registry=JSON.parse(fs.readFileSync(FALSE_SHORTS_FILE,'utf8'));
    const ids=new Set(Array.isArray(registry.falseShorts)?registry.falseShorts:[]);
    const titleContains=(Array.isArray(registry.falseShortTitleContains)?registry.falseShortTitleContains:[])
      .map(rule=>({
        channelId:String(rule?.channelId||'').trim(),
        contains:normalizeVideoTitle(rule?.contains||'')
      }))
      .filter(rule=>/^UC[A-Za-z0-9_-]{22}$/.test(rule.channelId) && rule.contains);
    return { ids, titleContains };
  }catch(error){
    console.warn('⚠️ No s’ha pogut llegir falsos-shorts.json:',error.message);
    return { ids:new Set(), titleContains:[] };
  }
}
function loadHiddenVideoIds(){
  try{
    const payload=JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','hidden-videos.json'),'utf8'));
    return new Set((Array.isArray(payload?.videoIds)?payload.videoIds:[]).map(id=>String(id||'').trim()).filter(Boolean));
  }catch(error){
    return new Set();
  }
}

function applyFalseShortsOverrides(videos){
  const rules=loadFalseShortRules();
  if(!rules.ids.size && !rules.titleContains.length) return 0;
  let applied=0;
  for(const video of videos||[]){
    if(video?.isShort!==true) continue;
    const normalizedTitle=normalizeVideoTitle(video.title||'');
    const titleMatch=rules.titleContains.some(rule=>
      rule.channelId===String(video.channelId||'') &&
      normalizedTitle.includes(rule.contains)
    );
    if(rules.ids.has(video.id) || titleMatch){
      video.isShort=false;
      applied++;
    }
  }
  if(applied) console.log('🔁 Reaplicades',applied,'correccions de falsos Shorts.');
  return applied;
}
function bestThumb(snippet){
  const t=snippet?.thumbnails||{};
  return t.maxres?.url || t.standard?.url || t.high?.url || t.medium?.url || t.default?.url || '';
}
async function api(resource, params){
  const url=new URL(API+'/'+resource);
  for(const [k,v] of Object.entries({...params,key:API_KEY})){
    if(v!==undefined && v!==null && v!=='') url.searchParams.set(k,String(v));
  }
  const res=await fetch(url);
  if(!res.ok){
    const body=await res.text().catch(()=> '');
    throw new Error(resource+' HTTP '+res.status+': '+body.slice(0,500));
  }
  return res.json();
}

function readJsonSafe(file,fallback){
  try{ return JSON.parse(fs.readFileSync(file,'utf8')); }catch(error){ return fallback; }
}
function foldName(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}
// Canals dels artistes de la llista d'antics: el seu repertori representatiu es busca més enllà de les darreres pujades.
function collectDeepChannels(db){
  const classic=new Set((readJsonSafe(CLASSIC_FILE,{}).artistes||[]).map(foldName));
  const out=new Set(EXTRA_DEEP_CHANNELS);
  for(const artist of db.artists||[]){
    if(artist.reviewStatus==='rebutjat' || !classic.has(foldName(artist.name))) continue;
    for(const ch of artist.youtube?.channels||[]) if(ch?.id && ch.type!=='topic') out.add(String(ch.id).trim());
  }
  return out;
}

function collectIndexedChannels(db){
  const byId=new Map();
  for(const artist of db.artists||[]){
    if(artist.reviewStatus==='rebutjat') continue;
    const categories=categoriesForGenres(artist.genres||[]);
    for(const ch of artist.youtube?.channels||[]){
      const id=String(ch?.id||'').trim();
      if(!/^UC[A-Za-z0-9_-]{22}$/.test(id)) continue;
      const prev=byId.get(id)||{id,artistNames:[],aliases:[],genres:[],categories:[],types:[],primary:false};
      prev.artistNames=unique([...prev.artistNames,artist.name]);
      prev.aliases=unique([...prev.aliases,artist.displayName,...(artist.aliases||[])]);
      prev.genres=unique([...prev.genres,...(artist.genres||[])]);
      prev.categories=unique([...prev.categories,...categories]);
      prev.types=unique([...prev.types,ch.type]);
      prev.primary=prev.primary || ch.primary===true;
      byId.set(id,prev);
    }
  }
  return byId;
}

async function main(){
  const readDate=new Date();
  const pollingState=polling.loadState(process.cwd());
  const db=JSON.parse(fs.readFileSync(ARTISTS_FILE,'utf8'));
  const allIndexed=collectIndexedChannels(db);
  const previousFeed=readJsonSafe(FEED_FILE,{channels:{},videos:[]});
  const requestedTargets=new Set(
    String(process.env.MUSIC_TARGET_CHANNELS || '')
      .split(',')
      .map(value=>value.trim())
      .filter(Boolean)
  );
  const targetMode=requestedTargets.size>0;
  const candidates=targetMode
    ? new Map([...allIndexed].filter(([id])=>requestedTargets.has(id)))
    : allIndexed;
  const indexed=new Map([...candidates].filter(([id,meta])=>
    targetMode || (TOPIC_FORCE_FULL_READ && meta.types.includes('topic')) || !previousFeed.channels?.[id]
      || polling.isDue(pollingState.channels[id],readDate)
  ));
  const channelNameOverrides=loadNameOverrides(CHANNEL_NAMES_FILE);
  const ids=[...indexed.keys()];

  if(targetMode && !ids.length){
    console.log('✅ Cap canal nou vàlid pendent; no es fa cap consulta a YouTube.');
    return;
  }

  console.log(
    targetMode
      ? '🆕 Canals nous a consultar: '+ids.length+' / '+allIndexed.size
      : '🎵 Canals a consultar: '+ids.length+' / '+allIndexed.size+'; la resta es conserva sense API'
  );

  const channelDetails=new Map();
  for(const batch of chunks(ids,50)){
    const payload=await api('channels',{
      part:'snippet,contentDetails,statistics',
      id:batch.join(',')
    });
    for(const item of payload.items||[]) channelDetails.set(item.id,item);
  }

  const unresolved=ids.filter(id=>!channelDetails.has(id));
  const failedChannels=new Set(unresolved);
  const pollResults=new Map();
  const playlistVideoIds=new Map();
  const channelsWithoutUploads=[];
  const uploadsByChannel=new Map();

  const contentOverrides=loadContentOverrides(CONTENT_OVERRIDES_FILE);
  const releasesRegistry=readJsonSafe(RELEASES_FILE,{releases:[]});
  const releaseIds=releasesMusic.idsByChannel(releasesRegistry,new Set(ids));
  const releasesState=await releasesMusic.refreshSources(releasesRegistry,
    readJsonSafe(RELEASES_STATE_FILE,{}),api,{activeIds:new Set(ids)});
  fs.writeFileSync(RELEASES_STATE_FILE,JSON.stringify(releasesState,null,2)+'\n');
  // Les pistes han estat verificades; una decisió manual anterior continua tenint prioritat.
  for(const videoIds of releaseIds.values()){
    for(const videoId of videoIds){
      if(!contentOverrides.has(videoId)) contentOverrides.set(videoId,{
        contentType:'song',note:'Pista de llançament oficial revisada',
      });
    }
  }
  if(contentOverrides.size) console.log('✍️ Revisions manuals de contingut:',contentOverrides.size);
  const channelVideoAllowlist=loadChannelVideoAllowlist(CHANNEL_VIDEO_ALLOWLIST_FILE);
  if(channelVideoAllowlist.size) console.log('🎯 Canals amb llista blanca de vídeos:',channelVideoAllowlist.size);

  // Catàleg incremental: els canals ajornats es conserven sense consultar YouTube.
  const previousChannelIndex=readJsonSafe(CHANNELS_FILE,{channels:[]}).channels||[];
  const previousReview=readJsonSafe(REVIEW_FILE,{videos:[]}).videos||[];
  const previousTopicReview=readJsonSafe(TOPIC_REVIEW_FILE,{videos:[]}).videos||[];
  const previousAudit=readJsonSafe(AUDIT_FILE,{});
  const targetIds=new Set(ids);
  const previousById=new Map((previousFeed.videos||[]).map(v=>[v.id,v]));
  const previousByChannel=new Map();
  for(const v of previousFeed.videos||[]){
    if(!previousByChannel.has(v.channelId)) previousByChannel.set(v.channelId,[]);
    previousByChannel.get(v.channelId).push(v);
  }
  const deepState=readJsonSafe(CATALOG_STATE_FILE,{channels:{}}).channels||{};
  const deepChannels=collectDeepChannels(db);
  const freshIdsByChannel=new Map();
  const deepIdsByChannel=new Map();
  // Canals Tema: discografia llegida en aquesta execució (o la de l'anterior si falla).
  const falseShortIds=loadFalseShortRules().ids;
  const topicIds=new Set(ids.filter(id=>indexed.get(id).types.includes('topic')));
  const topicTracksByChannel=new Map();
  const previousTopicCatalog=readJsonSafe(TOPIC_CATALOG_FILE,{channels:{}}).channels||{};
  // Tema dels quals avui només s'ha llegit la primera pàgina (la resta de la discografia és la desada)
  const partialTopicIds=new Set();

  for(const id of ids){
    const curated=channelVideoAllowlist.get(id)?.allowedVideoIds;
    const detail=channelDetails.get(id);
    const uploads=detail?.contentDetails?.relatedPlaylists?.uploads;
    if(!uploads){
      channelsWithoutUploads.push(id);
      failedChannels.add(id);
      continue;
    }
    // La selecció manual limita el repertori, no l'activitat real del canal publicador.
    if(curated){
      try{
        const payload=await api('playlistItems',{part:'contentDetails,status',playlistId:uploads,maxResults:50});
        pollResults.set(id,{latestPublishedAt:polling.latestPublication(payload.items,readDate)});
        freshIdsByChannel.set(id,[...curated]);
        if(topicIds.has(id)) topicTracksByChannel.set(id,[...curated].map(videoId=>({id:videoId,title:''})));
      }catch(error){
        failedChannels.add(id);
        console.warn('⚠️ Activitat de la selecció '+id+': '+error.message);
      }
      continue;
    }
    uploadsByChannel.set(id,uploads);
    if(topicIds.has(id)){
      // Canal Tema: lectura completa quan han passat set dies, al proper torn de consulta;
      // entre lectures completes només la primera pàgina i la discografia desada.
      const savedTracks=previousTopicCatalog[id]?.tracks||[];
      const fullRead=targetMode || TOPIC_FORCE_FULL_READ || !savedTracks.length
        || polling.fullTopicDue(pollingState.channels[id],readDate,TOPIC_FULL_DAYS);
      try{
        const tracks=[];
        let pageToken;
        let latestPublishedAt=null;
        for(let page=0;page<(fullRead?TOPIC_MAX_PAGES:1);page++){
          const payload=await api('playlistItems',{part:'snippet,contentDetails,status',playlistId:uploads,maxResults:50,pageToken});
          if(page===0) latestPublishedAt=polling.latestPublication(payload.items,readDate);
          for(const item of payload.items||[]){
            const videoId=item.contentDetails?.videoId;
            if(videoId) tracks.push({id:videoId,title:item.snippet?.title||''});
          }
          pageToken=payload.nextPageToken;
          if(!pageToken) break;
        }
        pollResults.set(id,{latestPublishedAt,fullTopic:fullRead});
        if(fullRead){
          topicTracksByChannel.set(id,tracks);
          freshIdsByChannel.set(id,unique(tracks.map(t=>t.id)));
        }else{
          // Només es verifiquen (videos.list) les pistes noves; la selecció anterior es conserva més avall.
          partialTopicIds.add(id);
          topicTracksByChannel.set(id,tema.mergeTopicTracks(tracks,savedTracks));
          freshIdsByChannel.set(id,unique(tracks.map(t=>t.id)));
        }
      }catch(error){
        console.warn('⚠️ Tema '+id+': '+error.message);
        failedChannels.add(id);
        freshIdsByChannel.set(id,[]);
      }
      continue;
    }
    try{
      const payload=await api('playlistItems',{
        part:'contentDetails,status',
        playlistId:uploads,
        maxResults:VIDEOS_PER_CHANNEL
      });
      const fresh=unique((payload.items||[]).map(x=>x.contentDetails?.videoId));
      pollResults.set(id,{latestPublishedAt:polling.latestPublication(payload.items,readDate)});
      freshIdsByChannel.set(id,fresh);
      catalog.seedDeepState(deepState,id,payload.nextPageToken);
    }catch(error){
      // Fallada transitòria: no se n'esborra el repertori (es conserva el del feed anterior, verificat més avall).
      console.warn('⚠️ '+id+': '+error.message);
      failedChannels.add(id);
      freshIdsByChannel.set(id,[]);
    }
  }

  // Pàgines profundes (només canals de la llista d'antics), amb pressupost de quota acotat i rotatiu.
  let deepPagesFetched=0;
  for(const step of catalog.planDeepPages(deepState,[...deepChannels].filter(id=>uploadsByChannel.has(id) && !failedChannels.has(id)),{budget:DEEP_PAGE_BUDGET})){
    try{
      const payload=await api('playlistItems',{
        part:'contentDetails',
        playlistId:uploadsByChannel.get(step.channelId),
        maxResults:50,
        pageToken:step.pageToken
      });
      deepPagesFetched++;
      const ids2=(payload.items||[]).map(x=>x.contentDetails?.videoId).filter(Boolean);
      deepIdsByChannel.set(step.channelId,unique([...(deepIdsByChannel.get(step.channelId)||[]),...ids2]));
      catalog.applyDeepResult(deepState,step.channelId,{ok:true,nextPageToken:payload.nextPageToken});
    }catch(error){
      console.warn('⚠️ Pàgina profunda '+step.channelId+': '+error.message);
      catalog.applyDeepResult(deepState,step.channelId,{ok:false});
    }
  }

  // Repertori conservat: vídeos del feed anterior fora de la finestra actual (els més populars de cada canal).
  const retainedIdsByChannel=new Map();
  for(const id of ids){
    if(failedChannels.has(id)) continue;
    const fresh=new Set([...(freshIdsByChannel.get(id)||[]),...(deepIdsByChannel.get(id)||[])]);
    // Un Tema llegit sencer no necessita repertori conservat: només si la lectura ha fallat. Si avui només se n'ha
    // llegit la primera pàgina, es conserva (i es torna a verificar) tota la selecció anterior del canal.
    if(partialTopicIds.has(id)){
      retainedIdsByChannel.set(id,catalog.pickRetained(previousByChannel.get(id),fresh,Infinity).map(v=>v.id));
      continue;
    }
    if(topicIds.has(id) && topicTracksByChannel.has(id)){ retainedIdsByChannel.set(id,[]); continue; }
    retainedIdsByChannel.set(id,catalog.pickRetained(previousByChannel.get(id),fresh).map(v=>v.id));
  }
  const retainedSet=new Set([...retainedIdsByChannel.values()].flat());
  for(const [id,videoIds] of releaseIds){
    if(failedChannels.has(id)) continue;
    freshIdsByChannel.set(id,unique([...(freshIdsByChannel.get(id)||[]),...videoIds]));
  }
  const allVideoIds=unique([
    ...[...freshIdsByChannel.values()].flat(),
    ...[...deepIdsByChannel.values()].flat(),
    ...retainedSet
  ]);
  const detailsById=new Map();
  const unverified=new Set();
  for(const batch of chunks(allVideoIds,50)){
    let payload;
    try{
      payload=await api('videos',{
        part:'snippet,contentDetails,statistics,status',
        id:batch.join(',')
      });
    }catch(error){
      // Si només hi ha repertori conservat, una fallada no el retira: es queda tal com estava.
      if(batch.some(id=>!retainedSet.has(id))) throw error;
      console.warn('⚠️ No s\'ha pogut verificar un lot de repertori conservat:',error.message);
      batch.forEach(id=>unverified.add(id));
      continue;
    }
    for(const item of payload.items||[]){
      item.durationSeconds=durationSeconds(item.contentDetails?.duration||'');
      detailsById.set(item.id,item);
    }
  }

  // Vídeos que el reproductor incrustat no pot fer sonar (restricció d'edat o no incrustables): fora del feed. Les
  // dades ja arriben amb aquesta consulta (contentDetails,status): no gasta quota. Registre per al client i l'arxiu:
  // data/videos-restringits.json (scripts/lib/restriccions_youtube.js).
  const restrictedUpdate=restriccions.updateRegistry(restriccions.loadRegistry(),[...detailsById.values()]);
  const restrictedIds=Object.keys(restrictedUpdate.registry.videos);
  restrictedIds.forEach(id=>detailsById.delete(id));
  if(restrictedUpdate.changed) restriccions.saveRegistry(restrictedUpdate.registry);
  if(restrictedUpdate.added.length || restrictedUpdate.removed.length){
    console.log(`🔞 Vídeos restringits: ${restrictedUpdate.added.length} nous, ${restrictedUpdate.removed.length} recuperats (${restrictedIds.length} en total).`);
  }

  // Completa els títols de la selecció manual amb les metadades verificades de YouTube.
  for(const [id,tracks] of topicTracksByChannel){
    if(channelVideoAllowlist.get(id)?.allowedVideoIds){
      topicTracksByChannel.set(id,tracks.filter(t=>isChannelVideoUploaderAllowed(channelVideoAllowlist,id,t.id,detailsById.get(t.id)?.snippet?.channelId))
        .map(t=>({id:t.id,title:detailsById.get(t.id).snippet.title})));
    }
  }

  // Vídeos antics més populars per canal profund (només cançons acceptades pel classificador).
  const deepAllowed=new Set();
  for(const [id,deepIds] of deepIdsByChannel){
    const meta=indexed.get(id);
    const known=new Set([...(freshIdsByChannel.get(id)||[]),...(retainedIdsByChannel.get(id)||[])]);
    const candidates=[];
    for(const videoId of deepIds){
      const item=detailsById.get(videoId);
      if(!item || known.has(videoId) || item.status?.privacyStatus!=='public') continue;
      const cls=applyContentOverride(classifyMusicContent({item,channelMeta:{...meta,channelTitle:channelDetails.get(id)?.snippet?.title||''}}),contentOverrides.get(videoId));
      candidates.push({id:videoId,viewCount:Number(item.statistics?.viewCount||0),contentType:item.durationSeconds>120?cls.contentType:'other'});
    }
    catalog.selectDeepKeep(candidates).forEach(videoId=>deepAllowed.add(videoId));
  }
  // ---------- Mana el canal Tema (scripts/lib/canal_tema.js) ----------
  const namesOfChannel=id=>{
    // En targetMode, `videos` conserva canals antics que no formen part d'`indexed`.
    // La identitat editorial ha de sortir sempre de la base completa per no fallar en filtres globals.
    const meta=allIndexed.get(id);
    const raw=channelDetails.get(id)?.snippet?.title||previousFeed.channels?.[id]?.name||'';
    return unique([...(meta?.artistNames||[]),...(meta?.aliases||[]),raw,cleanChannelDisplayName(raw)]);
  };
  // Discografia de cada artista (claus de cançó) a partir dels seus Tema.
  const topicCatalog=Object.fromEntries(Object.entries(previousTopicCatalog).filter(([id])=>allIndexed.has(id)));
  const topicKeysByArtist=new Map();

  // Reutilitzem la discografia Tema dels canals ajornats, sense consultar-los.
  {
    for(const [topicId,entry] of Object.entries(previousTopicCatalog)){
      if(topicIds.has(topicId)) continue; // Els canals consultats s'incorporen just a sota.
      const meta=allIndexed.get(topicId);
      if(!meta || !(entry?.tracks||[]).length) continue;
      const names=unique([...meta.artistNames,...meta.aliases,entry.name||'']);
      for(const artist of meta.artistNames){
        const keys=topicKeysByArtist.get(artist)||new Set();
        for(const [,title] of entry.tracks||[]) for(const key of tema.topicKeys(title,names)) keys.add(key);
        topicKeysByArtist.set(artist,keys);
      }
    }
  }
  for(const id of topicIds){
    const tracks=topicTracksByChannel.get(id) || (previousTopicCatalog[id]?.tracks||[]).map(([videoId,title])=>({id:videoId,title}));
    if(!tracks.length) continue;
    topicCatalog[id]={name:cleanChannelDisplayName(channelDetails.get(id)?.snippet?.title||previousTopicCatalog[id]?.name||''),tracks:tracks.map(t=>[t.id,t.title])};
    const names=namesOfChannel(id);
    for(const artist of indexed.get(id).artistNames){
      const keys=topicKeysByArtist.get(artist)||new Set();
      for(const track of tracks) for(const key of tema.topicKeys(track.title,names)) keys.add(key);
      topicKeysByArtist.set(artist,keys);
    }
  }
  // El Tema mana sobre el canal propi (oficial) quan tots els artistes del canal tenen discografia i hi és la
  // majoria de les seves cançons (minCoverage): molts Tema només tenen els discos recents.
  const channelVideoIds=id=>unique([...(freshIdsByChannel.get(id)||[]),...(deepIdsByChannel.get(id)||[]),...(retainedIdsByChannel.get(id)||[])]);
  const classifyItem=(id,item)=>applyContentOverride(classifyMusicContent({item,channelMeta:{...indexed.get(id),channelTitle:channelDetails.get(id)?.snippet?.title||''}}),contentOverrides.get(item.id));
  const governedKeysByChannel=new Map();
  const topicCoverage=[];
  for(const id of ids){
    const meta=indexed.get(id);
    if(topicIds.has(id) || !meta.types.includes('official')) continue;
    const sets=meta.artistNames.map(name=>topicKeysByArtist.get(name));
    if(!sets.length || sets.some(set=>!set || set.size<tema.DEFAULTS.minTopicTracks)) continue;
    const keys=new Set(sets.flatMap(set=>[...set]));
    const names=namesOfChannel(id);
    let songs=0;
    let matched=0;
    for(const videoId of channelVideoIds(id)){
      const item=detailsById.get(videoId);
      if(!item || item.status?.privacyStatus!=='public' || isShortByDuration(item.durationSeconds)) continue;
      if(!['song','live_song'].includes(classifyItem(id,item).contentType)) continue;
      songs++;
      if(tema.matchedKey(item.snippet?.title,names,keys)) matched++;
    }
    const coverage=songs ? matched/songs : 0;
    const governs=songs>0 && coverage>=tema.DEFAULTS.minCoverage;
    topicCoverage.push({id,name:cleanChannelDisplayName(channelDetails.get(id)?.snippet?.title||''),songs,matched,coverage:Number(coverage.toFixed(2)),governs});
    if(governs) governedKeysByChannel.set(id,keys);
  }
  const graceMs=TOPIC_GRACE_DAYS*86400000;
  const generationTime=Date.now();
  function governed(classification,{channelId,videoId,title,durationSeconds:seconds,publishedAt}){
    const keys=governedKeysByChannel.get(channelId);
    if(!keys) return classification;
    const key=tema.songKeys(title,namesOfChannel(channelId));
    const next=tema.governClassification(classification,{key,keys,overridden:contentOverrides.has(videoId),isShort:isShortByDuration(seconds),marked:tema.hasSongMarker(title)});
    const published=Date.parse(publishedAt||'')||0;
    if(next!==classification && next.contentType==='other' && published && generationTime-published<=graceMs) return classification;
    return next;
  }
  // Cançons que ja tenen videoclip al canal propi: la pista del Tema no hi entra.
  const coveredKeysByArtist=new Map();
  // Un canal oficial ajornat també evita duplicar el seu videoclip des del Tema consultat avui.
  for(const video of previousFeed.videos||[]){
    const meta=allIndexed.get(video.channelId);
    if(!meta?.types.includes('official') || (indexed.has(video.channelId) && !failedChannels.has(video.channelId))
      || video.contentType!=='song' || video.isShort) continue;
    const keys=new Set(meta.artistNames.flatMap(name=>[...(topicKeysByArtist.get(name)||[])]));
    const key=tema.matchedKey(video.title,namesOfChannel(video.channelId),keys);
    if(!key) continue;
    for(const name of meta.artistNames){
      const covered=coveredKeysByArtist.get(name)||new Set();
      covered.add(key);
      coveredKeysByArtist.set(name,covered);
    }
  }
  // Es mira a tots els canals oficials d'artistes amb Tema (encara que el Tema no hi mani): un videoclip que
  // coincideix amb una pista del Tema fa que la pista no hi entri repetida.
  for(const id of ids){
    const meta=indexed.get(id);
    if(topicIds.has(id) || !meta.types.includes('official')) continue;
    const keys=new Set(meta.artistNames.flatMap(name=>[...(topicKeysByArtist.get(name)||[])]));
    if(!keys.size) continue;
    const names=namesOfChannel(id);
    for(const videoId of channelVideoIds(id)){
      const item=detailsById.get(videoId);
      if(!item || item.status?.privacyStatus!=='public' || isShortByDuration(item.durationSeconds)) continue;
      const cls=governed(classifyItem(id,item),
        {channelId:id,videoId,title:item.snippet?.title,durationSeconds:item.durationSeconds,publishedAt:item.snippet?.publishedAt});
      if(cls.contentType!=='song') continue;
      const key=tema.matchedKey(item.snippet?.title,names,keys);
      if(!key) continue;
      for(const artist of meta.artistNames){
        const set=coveredKeysByArtist.get(artist)||new Set();
        set.add(key);
        coveredKeysByArtist.set(artist,set);
      }
    }
  }
  const topicStats=[];
  for(const id of topicIds){
    const tracks=topicTracksByChannel.get(id);
    if(!tracks) continue;
    const names=namesOfChannel(id);
    const covered=new Set(indexed.get(id).artistNames.flatMap(name=>[...(coveredKeysByArtist.get(name)||[])]));
    const candidates=tracks.map(t=>detailsById.get(t.id)).filter(item=>item && item.status?.privacyStatus==='public' && (!isShortByDuration(item.durationSeconds) || falseShortIds.has(item.id)))
      .map(item=>({id:item.id,key:tema.songKey(item.snippet?.title,names),keys:tema.topicKeys(item.snippet?.title,names),viewCount:Number(item.statistics?.viewCount||0),publishedAt:item.snippet?.publishedAt}));
    // En una selecció manual, cada ID és una gravació revisada: els números de moviment són significatius.
    const selected=channelVideoAllowlist.get(id)?.allowedVideoIds
      ? candidates.map(track=>track.id)
      : tema.selectTopicTracks(candidates,{coveredKeys:covered,now:generationTime});
    freshIdsByChannel.set(id,selected);
    topicStats.push({id,name:topicCatalog[id]?.name||'',tracks:tracks.length,selected:selected.length,withClip:covered.size});
  }

  for(const id of ids){
    const carriedIds=retainedIdsByChannel.get(id)||[];
    const keepDeep=(deepIdsByChannel.get(id)||[]).filter(videoId=>deepAllowed.has(videoId));
    playlistVideoIds.set(id,unique([...(freshIdsByChannel.get(id)||[]),...(releaseIds.get(id)||[]),...keepDeep,...carriedIds]));
  }

  const manualDates=fs.existsSync(ORIGINAL_DATES_FILE)?parseManualDates(JSON.parse(fs.readFileSync(ORIGINAL_DATES_FILE,'utf8'))):new Map();
  // Un canal ajornat o amb error conserva també la fitxa, la revisió i les estadístiques.
  failedChannels.forEach(id=>targetIds.delete(id));
  const preserve=id=>allIndexed.has(String(id||'')) && !targetIds.has(String(id||''));
  const channels=Object.fromEntries(Object.entries(previousFeed.channels||{}).filter(([id])=>preserve(id)));
  const channelIndex=previousChannelIndex.filter(channel=>preserve(channel?.id));
  const videos=(previousFeed.videos||[]).filter(video=>preserve(video?.channelId));
  const review=previousReview.filter(video=>preserve(video?.channelId));
  const rejectedSamples=[];
  const channelsWithoutVideos=[];
  const channelsWithoutAcceptedMusic=[];
  const typeCounts={song:0,live_song:0,album:0,other:0,review:0};
  const governedCounts={};
  const refreshedVideoIds=new Set([...targetIds].flatMap(id=>(previousByChannel.get(id)||[]).map(v=>v.id)));
  const topicReview=previousTopicReview.filter(video=>video.channelId
    ? preserve(video.channelId) : !refreshedVideoIds.has(video.id));
  let publicVideoCount=videos.length;
  let acceptedMusicCount=0;
  let categoryEligibleVideoCount=0;

  {
    // Els vídeos «per revisar» dels canals que no es tornen a llegir es compten des de la llista de revisió conservada,
    // no des del feed anterior: des que el feed calent i l'historial van separats, molts ja no són al feed i
    // l'auditoria deixava de quadrar (typeCounts.review 21 contra 425 a music-content-review.json).
    publicVideoCount=0;
    for(const video of videos){
      if(video.contentType==='review') continue;
      publicVideoCount++;
      typeCounts[video.contentType]=(typeCounts[video.contentType]||0)+1;
      if(['song','live_song','album'].includes(video.contentType)) acceptedMusicCount++;
      if(video.contentType==='song' || video.contentType==='live_song') categoryEligibleVideoCount++;
    }
    typeCounts.review+=review.length;
    publicVideoCount+=review.length;
  }

  for(const id of ids){
    if(failedChannels.has(id)) continue;
    const meta=indexed.get(id);
    const detail=channelDetails.get(id);
    const snippet=detail.snippet||{};
    const categories=meta.categories||[];
    const channelVideoRule=channelVideoAllowlist.get(id);
    const rawChannelName=snippet.title || meta.artistNames[0] || id;
    // Si el títol de YouTube és només el handle, s'aplica el nom real de l'artista.
    const displayChannelName=findNameOverride(channelNameOverrides,id,snippet.customUrl) || resolveChannelDisplayName(
      cleanChannelDisplayName(rawChannelName,meta.artistNames[0]||id),
      snippet.customUrl,
      meta.artistNames
    );
    const channel={
      id,
      name:displayChannelName,
      avatar:channelVideoRule?.avatarVideoId
        ? `https://i.ytimg.com/vi/${channelVideoRule.avatarVideoId}/hqdefault.jpg`
        : bestThumb(snippet),
      description:snippet.description || '',
      handle:snippet.customUrl || '',
      subscriberCount:Number(detail.statistics?.subscriberCount||0) || null,
      categories,
      genres:meta.genres,
      artists:meta.artistNames,
      type:meta.types[0] || 'other',
      primary:meta.primary
    };
    channels[id]={
      name:channel.name,
      avatar:channel.avatar,
      description:channel.description,
      handle:channel.handle,
      subscriberCount:channel.subscriberCount,
      categories:channel.categories,
      genres:channel.genres,
      artists:channel.artists
    };
    channelIndex.push(channel);

    let channelPublicCount=0;
    let channelAcceptedCount=0;
    let channelAvatarFromAllowedVideo=false;

    for(const videoId of playlistVideoIds.get(id)||[]){
      const item=detailsById.get(videoId);
      // Repertori conservat que no s'ha pogut tornar a verificar (fallada transitòria de l'API): es queda com estava.
      const carried=!item && unverified.has(videoId) ? previousById.get(videoId) : null;
      const verdict=carried ? 'unverified' : catalog.verdict({requested:videoId,returned:item,batchFailed:false});
      if(verdict==='removed' || (!item && !carried)) continue;
      const candidateTitle=item?.snippet?.title || carried?.title || '';
      if(!isChannelVideoAllowed(channelVideoAllowlist,id,candidateTitle,videoId)) continue;
      if(item && !isChannelVideoUploaderAllowed(channelVideoAllowlist,id,videoId,item.snippet?.channelId)) continue;

      // La decisió manual (data/music-content-overrides.json) preval sobre el classificador automàtic.
      let classification=carried
        ? applyContentOverride({
            accepted:['song','live_song','album'].includes(carried.contentType),
            contentType:carried.contentType||'review',
            confidence:carried.musicConfidence,
            reason:carried.musicReason
          },contentOverrides.get(videoId))
        : applyContentOverride(classifyMusicContent({
            item,
            channelMeta:{...meta,channelTitle:rawChannelName}
          }),contentOverrides.get(item.id));
      const finalClassification=governed(classification,{
        channelId:id,videoId,
        title:item?.snippet?.title||carried?.originalTitle||carried?.title||'',
        durationSeconds:item?.durationSeconds??carried?.durationSeconds,
        publishedAt:item?.snippet?.publishedAt||carried?.publishedAt
      });
      if(finalClassification!==classification){
        governedCounts[finalClassification.contentType]=(governedCounts[finalClassification.contentType]||0)+1;
        topicReview.push({id:videoId,channelId:id,channelTitle:channel.name,title:item?.snippet?.title||carried?.title||'',from:classification.contentType,to:finalClassification.contentType});
        if(TOPIC_GOVERNANCE==='apply') classification=finalClassification;
      }
      if(channelVideoRule?.acceptedMusicOnly && !classification.accepted) continue;
      if(
        channelVideoRule?.allowedContentTypes?.size &&
        !channelVideoRule.allowedContentTypes.has(classification.contentType)
      ) continue;
      channelPublicCount++;
      publicVideoCount++;
      typeCounts[classification.contentType]=(typeCounts[classification.contentType]||0)+1;

      const vs=item?.snippet||{};
      const base=carried ? {
        ...carried,
        channelTitle:channel.name,
        categories,
        genres:meta.genres,
        contentType:classification.contentType,
        musicConfidence:classification.confidence,
        musicReason:classification.reason
      } : {
        id:item.id,
        title:vs.title||'',
        description:vs.description||'',
        thumbnail:bestThumb(vs),
        channelId:id,
        channelTitle:channel.name,
        publishedAt:vs.publishedAt||null,
        duration:item.contentDetails?.duration||'',
        durationSeconds:item.durationSeconds,
        isShort:isShortByDuration(item.durationSeconds),
        viewCount:Number(item.statistics?.viewCount||0),
        likeCount:Number(item.statistics?.likeCount||0),
        commentCount:Number(item.statistics?.commentCount||0),
        categories,
        genres:meta.genres,
        sourceChannelId:vs.channelId||id,
        liveBroadcastContent:vs.liveBroadcastContent||'none',
        // Llengua declarada pel canal: confirmació positiva per a scripts/depurar_videos_catala.js
        defaultAudioLanguage:vs.defaultAudioLanguage||'',
        defaultLanguage:vs.defaultLanguage||'',
        contentType:classification.contentType,
        musicConfidence:classification.confidence,
        musicReason:classification.reason
      };

      const normalizedCandidateTitle = normalizeVideoTitle(candidateTitle);
      const avatarMatchesSpecificTitle = Boolean(
        channelVideoRule?.avatarFromAllowedTitle &&
        normalizedCandidateTitle === channelVideoRule.avatarFromAllowedTitle
      );
      const avatarMatchesFirstAllowed = Boolean(
        channelVideoRule?.avatarFromFirstAllowedVideo &&
        !channelVideoRule?.avatarFromAllowedTitle
      );
      if(
        !channelAvatarFromAllowedVideo &&
        !channelVideoRule?.avatarVideoId &&
        base.thumbnail &&
        (avatarMatchesSpecificTitle || avatarMatchesFirstAllowed)
      ){
        channel.avatar=base.thumbnail;
        channels[id].avatar=base.thumbnail;
        channelAvatarFromAllowedVideo=true;
      }

      // Any original només amb evidència (descripció automàtica o excepció manual); mai s'inventa.
      stampOriginalYear(base,manualDates);

      // Tots els vídeos públics es conserven al feed. La vista de categories
      // decideix després si són cançó o actuació en directe.
      videos.push(base);

      if(classification.accepted){
        acceptedMusicCount++;
        channelAcceptedCount++;
      }
      if(classification.contentType==='song' || classification.contentType==='live_song'){
        categoryEligibleVideoCount++;
      }

      if(classification.contentType==='review'){
        review.push({
          id:base.id,title:base.title,channelId:id,channelTitle:channel.name,
          durationSeconds:base.durationSeconds,publishedAt:base.publishedAt,
          musicConfidence:classification.confidence,musicReason:classification.reason,
          youtubeCategoryId:String(vs.categoryId||'')
        });
      } else if(!classification.accepted && rejectedSamples.length<120){
        rejectedSamples.push({
          id:base.id,title:base.title,channelTitle:channel.name,
          durationSeconds:base.durationSeconds,musicReason:classification.reason
        });
      }
    }

    if(channelPublicCount===0) channelsWithoutVideos.push(id);
    else if(channelAcceptedCount===0) channelsWithoutAcceptedMusic.push(id);
  }

  applyFalseShortsOverrides(videos);
  const artistsOfChannel=id=>allIndexed.get(id)?.artistNames||[];
  // Shorts: Segueix Música no en publica cap (2026-10-04). Abans es conservaven els que coincidien amb una cançó del
  // canal Tema; ara tots surten del feed. Els falsos Shorts (cançons curtes marcades per error) ja s'han corregit a
  // applyFalseShortsOverrides() i continuen al feed com a cançons.
  let shortBeforeCatalogFilter=0;
  const shortCatalogMatched=0;
  let shortCatalogRejected=0;
  for(let i=videos.length-1;i>=0;i--){
    if(videos[i]?.isShort!==true) continue;
    shortBeforeCatalogFilter++;
    videos.splice(i,1);
    shortCatalogRejected++;
  }
  console.log(`📱 Shorts descartats del feed: ${shortCatalogRejected}`);

  // Vídeos ocults manualment (p. ex. cançons amb títol en castellà): no entren al feed
  const hiddenIds=loadHiddenVideoIds();
  // Una cançó amagada al canal propi d'un artista (castellà...) tampoc no entra des del seu Tema: ni la que
  // coincideix amb una amagada per ID, ni la que compleix les regles per títol de scripts/ocultar_titols_castella.js.
  const rulesByArtist=new Map();
  for(const [ruleName,rule] of Object.entries(SPANISH_TITLE_RULES)){
    for(const id of ids){
      if(channels[id]?.name!==ruleName && channelDetails.get(id)?.snippet?.title!==ruleName) continue;
      for(const artist of artistsOfChannel(id)) rulesByArtist.set(artist,[...(rulesByArtist.get(artist)||[]),rule]);
    }
  }
  const hiddenKeysByArtist=new Map();
  for(const video of videos){
    if(!hiddenIds.has(String(video.id))) continue;
    const artistKeys=new Set(artistsOfChannel(video.channelId).flatMap(name=>[...(topicKeysByArtist.get(name)||[])]));
    const key=tema.matchedKey(video.title,namesOfChannel(video.channelId),artistKeys) || tema.songKey(video.title,namesOfChannel(video.channelId));
    if(!key) continue;
    for(const artist of artistsOfChannel(video.channelId)) hiddenKeysByArtist.set(artist,new Set([...(hiddenKeysByArtist.get(artist)||[]),key]));
  }
  let topicHidden=0;
  const topicHiddenTitles=[];
  for(let i=videos.length-1;i>=0;i--){
    const video=videos[i];
    if(!topicIds.has(video.channelId)) continue;
    const artists=artistsOfChannel(video.channelId);
    const keys=tema.topicKeys(video.title,namesOfChannel(video.channelId));
    const title=String(video.title||'');
    const byKey=keys.some(key=>artists.some(artist=>hiddenKeysByArtist.get(artist)?.has(key)));
    // Només les regles per títol: una regla «totes» és la decisió sobre un canal concret, no sobre la discografia.
    const byRule=artists.some(artist=>(rulesByArtist.get(artist)||[]).some(rule=>rule.titols && rule.titols.test(title)));
    if(byKey || byRule){ videos.splice(i,1); topicHidden++; topicHiddenTitles.push(`${video.channelTitle} · ${title}`); }
  }
  if(topicHidden) console.log(`🙈 ${topicHidden} pistes de canals Tema amagades com la mateixa cançó del canal propi`);
  if(hiddenIds.size){
    for(let i=videos.length-1;i>=0;i--) if(hiddenIds.has(String(videos[i].id))) videos.splice(i,1);
  }
  // Cançons que ofereixen subtítols en castellà (segons el títol o la descripció): no entren al feed. Es repeteix a
  // cada generació (cada dia), així que les cançons noves hi queden filtrades sense cap llista manual.
  let withSpanishSubtitles=0;
  for(let i=videos.length-1;i>=0;i--){
    if(teSubtitolsCastella(videos[i]) && !allowsSpanishSubtitles(channelVideoAllowlist,videos[i])){ videos.splice(i,1); withSpanishSubtitles++; }
  }
  if(withSpanishSubtitles) console.log(`🙈 ${withSpanishSubtitles} vídeos amb subtítols en castellà descartats`);
  // Només els artistes vigilats entren a revisió. Un títol sospitós no amaga cap cançó.
  const languagePolicy=revisioIdiomes.loadPolicy();
  const languageReview=revisioIdiomes.updatePending(readJsonSafe(LANGUAGE_REVIEW_FILE,revisioIdiomes.emptyState()),videos,{hiddenIds,policy:languagePolicy,namesOf:video=>namesOfChannel(video.channelId)});
  fs.writeFileSync(LANGUAGE_REVIEW_FILE,revisioIdiomes.serializeState(languageReview.state));
  // Exclusivament decisions editorials explícites reutilitzables, mai heurístiques de títol.
  if(languageReview.discardedIds.size){
    const hiddenFile=path.join(process.cwd(),'data','hidden-videos.json');
    const payload=readJsonSafe(hiddenFile,{videoIds:[]});
    for(const id of languageReview.discardedIds) hiddenIds.add(id);
    fs.writeFileSync(hiddenFile,JSON.stringify({...payload,videoIds:[...new Set([...(payload.videoIds||[]),...languageReview.discardedIds])]},null,2)+'\n');
    for(let i=videos.length-1;i>=0;i--) if(languageReview.discardedIds.has(String(videos[i].id))) videos.splice(i,1);
  }
  console.log(`🗣️ Revisió d'idioma: ${languageReview.state.pendents.length} pendents d’artistes vigilats, ${languageReview.trusted} acceptades per confiança editorial, ${languageReview.state.artistesPendents.length} artistes nous per classificar`);
  videos.sort((a,b)=>(Date.parse(b.publishedAt||'')||0)-(Date.parse(a.publishedAt||'')||0));
  review.sort((a,b)=>(Date.parse(b.publishedAt||'')||0)-(Date.parse(a.publishedAt||'')||0));
  channelIndex.sort((a,b)=>a.name.localeCompare(b.name,'ca',{sensitivity:'base'}));
  const shortVideoCount=videos.filter(v=>v.isShort===true).length;
  const shortCatalogFilter={before:shortBeforeCatalogFilter,matched:shortCatalogMatched,rejected:shortCatalogRejected};
  const generatedAt=new Date().toISOString();

  const mergedTopicCoverage=[
        ...(previousAudit.topicCoverage||[]).filter(entry=>preserve(entry?.id)),
        ...topicCoverage
      ];
  const mergedTopicStats=[
        ...(previousAudit.topicChannels||[]).filter(entry=>preserve(entry?.id)),
        ...topicStats
      ];
  const allTopicChannelCount=[...allIndexed.values()].filter(meta=>meta.types.includes('topic')).length;

  // Abans d'aprimar i eliminar les descripcions, conserva disc + caràtula amb les metadades Topic ja rebudes.
  // No fa cap crida addicional a YouTube: només transforma dades que aquesta mateixa execució ja té en memòria.
  const albumCatalog=albumsMusic.mergeAlbumCatalog(
    readJsonSafe(ALBUMS_FILE,{version:1,channels:{},artists:{}}),
    videos,
    channels,
    {hiddenIds,generatedAt}
  );
  releasesMusic.applyReleaseCatalog(albumCatalog,releasesRegistry,{channels,hiddenIds});
  fs.writeFileSync(ALBUMS_FILE,JSON.stringify(albumCatalog));
  const albumCount=Object.values(albumCatalog.artists||{}).reduce((sum,entry)=>sum+(entry.albums||[]).length,0);
  console.log('💿 Catàleg local de discos:',albumCount,'discos de',Object.keys(albumCatalog.artists||{}).length,'artistes.');

  // Aprimat (sense descripció pública dels vídeos) i un vídeo per línia.
  fs.writeFileSync(FEED_FILE,serializeFeed(slimFeed({generatedAt,channels,videos})));
  fs.writeFileSync(CHANNELS_FILE,JSON.stringify({updatedAt:generatedAt,channels:channelIndex},null,2)+'\n');
  fs.writeFileSync(REVIEW_FILE,JSON.stringify({generatedAt,count:review.length,videos:review},null,2)+'\n');
  fs.writeFileSync(CONTENT_AUDIT_FILE,JSON.stringify({
    generatedAt,
    rawPublicVideoCount:publicVideoCount,
    feedVideoCount:videos.length,
    acceptedMusicCount,
    categoryEligibleVideoCount,
    shortVideoCount,
    shortCatalogFilter,
    rejectedOrReviewCount:publicVideoCount-acceptedMusicCount,
    reviewCount:review.length,
    typeCounts,
    channelsWithoutAcceptedMusic,
    rejectedSamples
  },null,2)+'\n');
  fs.writeFileSync(TOPIC_REVIEW_FILE,JSON.stringify({
    generatedAt,
    mode:TOPIC_GOVERNANCE,
    reclassified:governedCounts,
    hiddenFromTopic:topicHiddenTitles.sort(),
    videos:topicReview.sort((a,b)=>a.channelTitle.localeCompare(b.channelTitle,'ca')||a.title.localeCompare(b.title,'ca'))
  },null,2)+'\n');
  // Discografia dels canals Tema (no la llegeix el client): base per decidir què és cançó si l'API falla un dia.
  fs.writeFileSync(TOPIC_CATALOG_FILE,`{\n  "updatedAt": ${JSON.stringify(generatedAt)},\n  "channels": {\n${Object.entries(topicCatalog).sort(([a],[b])=>a.localeCompare(b)).map(([id,entry])=>`    ${JSON.stringify(id)}: ${JSON.stringify(entry)}`).join(',\n')}\n  }\n}\n`);
  fs.writeFileSync(CATALOG_STATE_FILE,JSON.stringify({updatedAt:generatedAt,channels:deepState},null,2)+'\n');
  fs.writeFileSync(AUDIT_FILE,JSON.stringify({
    generatedAt,
    polling:{requested:ids.length,deferred:allIndexed.size-ids.length,failed:failedChannels.size},
    retainedVideoCount:retainedSet.size,
    unverifiedVideoCount:unverified.size,
    restrictedVideoCount:restrictedIds.length,
    restrictedVideosAdded:restrictedUpdate.added,
    deepPagesFetched,
    deepChannelCount:deepChannels.size,
    topicChannelCount:allTopicChannelCount,
    governedChannelCount:mergedTopicCoverage.filter(entry=>entry?.governs).length,
    topicCoverage:mergedTopicCoverage.sort((a,b)=>b.coverage-a.coverage||String(a.name||'').localeCompare(String(b.name||''),'ca')),
    topicGovernance:TOPIC_GOVERNANCE,
    governedReclassified:governedCounts,
    topicHiddenCount:topicHidden,
    topicChannels:mergedTopicStats.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ca')),
    indexedChannelCount:allIndexed.size,
    resolvedChannelCount:Object.keys(channels).length,
    feedChannelCount:Object.keys(channels).length,
    rawPublicVideoCount:publicVideoCount,
    feedVideoCount:videos.length,
    acceptedMusicCount,
    categoryEligibleVideoCount,
    shortVideoCount,
    shortCatalogFilter,
    contentReviewCount:review.length,
    contentTypeCounts:typeCounts,
    unresolvedChannelIds:unresolved,
    channelsWithoutUploads,
    channelsWithoutVideos,
    channelsWithoutAcceptedMusic,
    allIndexedChannelsVisible:Object.keys(channels).length===allIndexed.size
  },null,2)+'\n');

  // Només avança el torn després d'una lectura correcta i d'haver escrit el resultat.
  // Un error de videos.list sobre repertori conservat es reintenta al proper torn diari.
  const incompleteChannels=new Set([...unverified].map(id=>previousById.get(id)?.channelId));
  let checked=0;
  for(const [id,result] of pollResults){
    if(failedChannels.has(id) || incompleteChannels.has(id)) continue;
    polling.recordSuccess(pollingState,id,result,readDate);
    checked++;
  }
  polling.saveState(process.cwd(),pollingState,new Set(allIndexed.keys()),readDate,{
    indexed:allIndexed.size,requested:ids.length,checked,deferred:allIndexed.size-ids.length,
    failed:ids.length-checked,
  });

  console.log(
    targetMode ? '✅ Canals nous incorporats:' : '✅ Feed musical:',
    targetMode ? ids.length : Object.keys(channels).length,
    targetMode ? 'nous; feed total' : 'canals,',
    Object.keys(channels).length,'canals,',videos.length,'vídeos públics conservats; ',
    categoryEligibleVideoCount,'cançons/directes elegibles per categories.'
  );
  console.log('📱 Shorts detectats:',shortVideoCount);
  console.log('🧪 Revisió manual:',review.length,'vídeos ambigus.');
  console.log('📦 Tipus:',typeCounts);
}

main().catch(error=>{console.error('❌',error.stack||error.message);process.exit(1);});

