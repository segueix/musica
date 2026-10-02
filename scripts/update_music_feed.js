'use strict';

const fs = require('fs');
const path = require('path');
const { classifyMusicContent } = require('./lib/classificar_contingut_musical');
const { loadContentOverrides, applyContentOverride } = require('./lib/revisio_manual_musical');
const { loadChannelVideoAllowlist, isChannelVideoAllowed } = require('./lib/filtre_videos_canal');
const { parseManualDates, stampOriginalYear } = require('./lib/any_original_musical');
const catalog = require('./lib/cataleg_musical');
const { teSubtitolsCastella } = require('./lib/subtitols_castella');
const { slimFeed, serializeFeed } = require('./lib/aprimar_feed');
const tema = require('./lib/canal_tema');
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
// Un vídeo del canal propi d'un artista amb Tema publicat fa menys d'aquests dies es manté encara que la cançó
// no sigui al Tema (el videoclip d'un senzill sol arribar abans que la distribuïdora la publiqui).
const TOPIC_GRACE_DAYS = 30;
// «audit»: només anota a data/music-topic-review.json què es trauria del canal propi (no ho aplica);
// «apply»: el Tema mana. Es passa a «apply» quan la revisió confirma que la discografia es llegeix bé.
const TOPIC_GOVERNANCE = process.env.MUSIC_TOPIC_GOVERNANCE === 'apply' ? 'apply' : 'audit';
const TOPIC_REVIEW_FILE = path.join(process.cwd(), 'data', 'music-topic-review.json');
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
  { label:'Punk / Metal', genres:['Punk','Metal'] },
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
function loadFalseShortIds(){
  if(!fs.existsSync(FALSE_SHORTS_FILE)) return new Set();
  try{
    const registry=JSON.parse(fs.readFileSync(FALSE_SHORTS_FILE,'utf8'));
    return new Set(Array.isArray(registry.falseShorts)?registry.falseShorts:[]);
  }catch(error){
    console.warn('⚠️ No s’ha pogut llegir falsos-shorts.json:',error.message);
    return new Set();
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
  const falseShortIds=loadFalseShortIds();
  if(!falseShortIds.size) return 0;
  let applied=0;
  for(const video of videos||[]){
    if(video?.isShort===true && falseShortIds.has(video.id)){
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
  const db=JSON.parse(fs.readFileSync(ARTISTS_FILE,'utf8'));
  const indexed=collectIndexedChannels(db);
  const channelNameOverrides=loadNameOverrides(CHANNEL_NAMES_FILE);
  const ids=[...indexed.keys()];
  console.log('🎵 Canals indexats:',ids.length);

  const channelDetails=new Map();
  for(const batch of chunks(ids,50)){
    const payload=await api('channels',{
      part:'snippet,contentDetails,statistics',
      id:batch.join(',')
    });
    for(const item of payload.items||[]) channelDetails.set(item.id,item);
  }

  const unresolved=ids.filter(id=>!channelDetails.has(id));
  const playlistVideoIds=new Map();
  const channelsWithoutUploads=[];
  const uploadsByChannel=new Map();

  const contentOverrides=loadContentOverrides(CONTENT_OVERRIDES_FILE);
  if(contentOverrides.size) console.log('✍️ Revisions manuals de contingut:',contentOverrides.size);
  const channelVideoAllowlist=loadChannelVideoAllowlist(CHANNEL_VIDEO_ALLOWLIST_FILE);
  if(channelVideoAllowlist.size) console.log('🎯 Canals amb llista blanca de vídeos:',channelVideoAllowlist.size);

  // Catàleg incremental: el feed anterior és la base. Es conserva (i es torna a verificar) el repertori que ja
  // no cap a la finestra de pujades recents; només un vídeo confirmat com a privat/eliminat se'n va.
  const previousFeed=readJsonSafe(FEED_FILE,{channels:{},videos:[]});
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
  const topicIds=new Set(ids.filter(id=>indexed.get(id).types.includes('topic')));
  const topicTracksByChannel=new Map();
  const previousTopicCatalog=readJsonSafe(TOPIC_CATALOG_FILE,{channels:{}}).channels||{};

  for(const id of ids){
    const detail=channelDetails.get(id);
    const uploads=detail?.contentDetails?.relatedPlaylists?.uploads;
    if(!uploads){
      channelsWithoutUploads.push(id);
      continue;
    }
    uploadsByChannel.set(id,uploads);
    if(topicIds.has(id)){
      // Canal Tema: es llegeix la discografia sencera (títols per decidir què és cançó de l'artista).
      try{
        const tracks=[];
        let pageToken;
        for(let page=0;page<TOPIC_MAX_PAGES;page++){
          const payload=await api('playlistItems',{part:'snippet,contentDetails',playlistId:uploads,maxResults:50,pageToken});
          for(const item of payload.items||[]){
            const videoId=item.contentDetails?.videoId;
            if(videoId) tracks.push({id:videoId,title:item.snippet?.title||''});
          }
          pageToken=payload.nextPageToken;
          if(!pageToken) break;
        }
        topicTracksByChannel.set(id,tracks);
        freshIdsByChannel.set(id,unique(tracks.map(t=>t.id)));
      }catch(error){
        console.warn('⚠️ Tema '+id+': '+error.message);
        freshIdsByChannel.set(id,[]);
      }
      continue;
    }
    try{
      const payload=await api('playlistItems',{
        part:'contentDetails',
        playlistId:uploads,
        maxResults:VIDEOS_PER_CHANNEL
      });
      const fresh=unique((payload.items||[]).map(x=>x.contentDetails?.videoId));
      freshIdsByChannel.set(id,fresh);
      catalog.seedDeepState(deepState,id,payload.nextPageToken);
    }catch(error){
      // Fallada transitòria: no se n'esborra el repertori (es conserva el del feed anterior, verificat més avall).
      console.warn('⚠️ '+id+': '+error.message);
      freshIdsByChannel.set(id,[]);
    }
  }

  // Pàgines profundes (només canals de la llista d'antics), amb pressupost de quota acotat i rotatiu.
  let deepPagesFetched=0;
  for(const step of catalog.planDeepPages(deepState,[...deepChannels].filter(id=>uploadsByChannel.has(id)),{budget:DEEP_PAGE_BUDGET})){
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
    const fresh=new Set([...(freshIdsByChannel.get(id)||[]),...(deepIdsByChannel.get(id)||[])]);
    // Un Tema llegit sencer no necessita repertori conservat: només si la lectura ha fallat.
    if(topicIds.has(id) && topicTracksByChannel.has(id)){ retainedIdsByChannel.set(id,[]); continue; }
    retainedIdsByChannel.set(id,catalog.pickRetained(previousByChannel.get(id),fresh).map(v=>v.id));
  }
  const retainedSet=new Set([...retainedIdsByChannel.values()].flat());
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
    const meta=indexed.get(id);
    const raw=channelDetails.get(id)?.snippet?.title||'';
    return unique([...meta.artistNames,...meta.aliases,raw,cleanChannelDisplayName(raw)]);
  };
  // Discografia de cada artista (claus de cançó) a partir dels seus Tema.
  const topicCatalog={};
  const topicKeysByArtist=new Map();
  for(const id of topicIds){
    const tracks=topicTracksByChannel.get(id) || (previousTopicCatalog[id]?.tracks||[]).map(([videoId,title])=>({id:videoId,title}));
    if(!tracks.length) continue;
    topicCatalog[id]={name:cleanChannelDisplayName(channelDetails.get(id)?.snippet?.title||previousTopicCatalog[id]?.name||''),tracks:tracks.map(t=>[t.id,t.title])};
    const names=namesOfChannel(id);
    for(const artist of indexed.get(id).artistNames){
      const keys=topicKeysByArtist.get(artist)||new Set();
      for(const track of tracks){ const key=tema.songKey(track.title,names); if(key) keys.add(key); }
      topicKeysByArtist.set(artist,keys);
    }
  }
  // El Tema mana sobre el canal propi (oficial) quan tots els artistes del canal tenen discografia suficient.
  const governedKeysByChannel=new Map();
  for(const id of ids){
    const meta=indexed.get(id);
    if(topicIds.has(id) || !meta.types.includes('official')) continue;
    const sets=meta.artistNames.map(name=>topicKeysByArtist.get(name));
    if(!sets.length || sets.some(set=>!set || set.size<tema.DEFAULTS.minTopicTracks)) continue;
    governedKeysByChannel.set(id,new Set(sets.flatMap(set=>[...set])));
  }
  const graceMs=TOPIC_GRACE_DAYS*86400000;
  const generationTime=Date.now();
  function governed(classification,{channelId,videoId,title,durationSeconds:seconds,publishedAt}){
    const keys=governedKeysByChannel.get(channelId);
    if(!keys) return classification;
    const key=tema.songKey(title,namesOfChannel(channelId));
    const next=tema.governClassification(classification,{key,keys,overridden:contentOverrides.has(videoId),isShort:isShortByDuration(seconds)});
    const published=Date.parse(publishedAt||'')||0;
    if(next!==classification && next.contentType==='other' && published && generationTime-published<=graceMs) return classification;
    return next;
  }
  // Cançons que ja tenen videoclip al canal propi: la pista del Tema no hi entra.
  const coveredKeysByArtist=new Map();
  for(const [id] of governedKeysByChannel){
    const meta=indexed.get(id);
    const names=namesOfChannel(id);
    for(const videoId of unique([...(freshIdsByChannel.get(id)||[]),...(deepIdsByChannel.get(id)||[]),...(retainedIdsByChannel.get(id)||[])])){
      const item=detailsById.get(videoId);
      if(!item || item.status?.privacyStatus!=='public' || isShortByDuration(item.durationSeconds)) continue;
      const cls=governed(applyContentOverride(classifyMusicContent({item,channelMeta:{...meta,channelTitle:channelDetails.get(id)?.snippet?.title||''}}),contentOverrides.get(videoId)),
        {channelId:id,videoId,title:item.snippet?.title,durationSeconds:item.durationSeconds,publishedAt:item.snippet?.publishedAt});
      if(cls.contentType!=='song') continue;
      const key=tema.songKey(item.snippet?.title,names);
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
    const candidates=tracks.map(t=>detailsById.get(t.id)).filter(item=>item && item.status?.privacyStatus==='public' && !isShortByDuration(item.durationSeconds))
      .map(item=>({id:item.id,key:tema.songKey(item.snippet?.title,names),viewCount:Number(item.statistics?.viewCount||0),publishedAt:item.snippet?.publishedAt}));
    const selected=tema.selectTopicTracks(candidates,{coveredKeys:covered,now:generationTime});
    freshIdsByChannel.set(id,selected);
    topicStats.push({id,name:topicCatalog[id]?.name||'',tracks:tracks.length,selected:selected.length,withClip:covered.size});
  }

  for(const id of ids){
    const carriedIds=retainedIdsByChannel.get(id)||[];
    const keepDeep=(deepIdsByChannel.get(id)||[]).filter(videoId=>deepAllowed.has(videoId));
    playlistVideoIds.set(id,unique([...(freshIdsByChannel.get(id)||[]),...keepDeep,...carriedIds]));
  }

  const manualDates=fs.existsSync(ORIGINAL_DATES_FILE)?parseManualDates(JSON.parse(fs.readFileSync(ORIGINAL_DATES_FILE,'utf8'))):new Map();
  const channels={};
  const channelIndex=[];
  const videos=[];
  const review=[];
  const rejectedSamples=[];
  const channelsWithoutVideos=[];
  const channelsWithoutAcceptedMusic=[];
  const typeCounts={song:0,live_song:0,album:0,other:0,review:0};
  const governedCounts={};
  const topicReview=[];
  let publicVideoCount=0;
  let acceptedMusicCount=0;
  let categoryEligibleVideoCount=0;

  for(const id of ids){
    const meta=indexed.get(id);
    const detail=channelDetails.get(id);
    if(!detail){
      // Canal no resolt (possible fallada transitòria): es conserva el que ja hi havia al feed anterior.
      const before=previousByChannel.get(id)||[];
      if(previousFeed.channels?.[id] && before.length){
        channels[id]=previousFeed.channels[id];
        for(const v of before){
          videos.push(v);
          publicVideoCount++;
          typeCounts[v.contentType]=(typeCounts[v.contentType]||0)+1;
          if(['song','live_song','album'].includes(v.contentType)) acceptedMusicCount++;
          if(v.contentType==='song' || v.contentType==='live_song') categoryEligibleVideoCount++;
        }
      }
      continue;
    }
    const snippet=detail.snippet||{};
    const categories=meta.categories||[];
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
      avatar:bestThumb(snippet),
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

    for(const videoId of playlistVideoIds.get(id)||[]){
      const item=detailsById.get(videoId);
      // Repertori conservat que no s'ha pogut tornar a verificar (fallada transitòria de l'API): es queda com estava.
      const carried=!item && unverified.has(videoId) ? previousById.get(videoId) : null;
      const verdict=carried ? 'unverified' : catalog.verdict({requested:videoId,returned:item,batchFailed:false});
      if(verdict==='removed' || (!item && !carried)) continue;
      const candidateTitle=item?.snippet?.title || carried?.title || '';
      if(!isChannelVideoAllowed(channelVideoAllowlist,id,candidateTitle)) continue;
      channelPublicCount++;
      publicVideoCount++;

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
        topicReview.push({id:videoId,channelTitle:channel.name,title:item?.snippet?.title||carried?.title||'',from:classification.contentType,to:finalClassification.contentType});
        if(TOPIC_GOVERNANCE==='apply') classification=finalClassification;
      }
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
        sourceChannelId:id,
        liveBroadcastContent:vs.liveBroadcastContent||'none',
        // Llengua declarada pel canal: confirmació positiva per a scripts/depurar_videos_catala.js
        defaultAudioLanguage:vs.defaultAudioLanguage||'',
        defaultLanguage:vs.defaultLanguage||'',
        contentType:classification.contentType,
        musicConfidence:classification.confidence,
        musicReason:classification.reason
      };

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
  // Vídeos ocults manualment (p. ex. cançons amb títol en castellà): no entren al feed
  const hiddenIds=loadHiddenVideoIds();
  // Una cançó amagada al canal propi d'un artista (castellà...) tampoc no entra des del seu Tema: ni la que
  // coincideix amb una amagada per ID, ni la que compleix les regles per títol de scripts/ocultar_titols_castella.js.
  const artistsOfChannel=id=>indexed.get(id)?.artistNames||[];
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
    const key=tema.songKey(video.title,namesOfChannel(video.channelId));
    if(!key) continue;
    for(const artist of artistsOfChannel(video.channelId)) hiddenKeysByArtist.set(artist,new Set([...(hiddenKeysByArtist.get(artist)||[]),key]));
  }
  let topicHidden=0;
  const topicHiddenTitles=[];
  for(let i=videos.length-1;i>=0;i--){
    const video=videos[i];
    if(!topicIds.has(video.channelId)) continue;
    const artists=artistsOfChannel(video.channelId);
    const key=tema.songKey(video.title,namesOfChannel(video.channelId));
    const title=String(video.title||'');
    const byKey=Boolean(key) && artists.some(artist=>hiddenKeysByArtist.get(artist)?.has(key));
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
    if(teSubtitolsCastella(videos[i])){ videos.splice(i,1); withSpanishSubtitles++; }
  }
  if(withSpanishSubtitles) console.log(`🙈 ${withSpanishSubtitles} vídeos amb subtítols en castellà descartats`);
  videos.sort((a,b)=>(Date.parse(b.publishedAt||'')||0)-(Date.parse(a.publishedAt||'')||0));
  review.sort((a,b)=>(Date.parse(b.publishedAt||'')||0)-(Date.parse(a.publishedAt||'')||0));
  channelIndex.sort((a,b)=>a.name.localeCompare(b.name,'ca',{sensitivity:'base'}));
  const shortVideoCount=videos.filter(v=>v.isShort===true).length;
  const generatedAt=new Date().toISOString();

  // Aprimat (descripcions curtes, sense camps de depuració) i un vídeo per línia: el client se'l baixa sencer.
  // Abans s'han fet servir les descripcions senceres (any original i subtítols en castellà).
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
    retainedVideoCount:retainedSet.size,
    unverifiedVideoCount:unverified.size,
    deepPagesFetched,
    deepChannelCount:deepChannels.size,
    topicChannelCount:topicIds.size,
    governedChannelCount:governedKeysByChannel.size,
    topicGovernance:TOPIC_GOVERNANCE,
    governedReclassified:governedCounts,
    topicHiddenCount:topicHidden,
    topicChannels:topicStats.sort((a,b)=>a.name.localeCompare(b.name,'ca')),
    indexedChannelCount:ids.length,
    resolvedChannelCount:channelDetails.size,
    feedChannelCount:Object.keys(channels).length,
    rawPublicVideoCount:publicVideoCount,
    feedVideoCount:videos.length,
    acceptedMusicCount,
    categoryEligibleVideoCount,
    shortVideoCount,
    contentReviewCount:review.length,
    contentTypeCounts:typeCounts,
    unresolvedChannelIds:unresolved,
    channelsWithoutUploads,
    channelsWithoutVideos,
    channelsWithoutAcceptedMusic,
    allIndexedChannelsVisible:unresolved.length===0 && Object.keys(channels).length===ids.length
  },null,2)+'\n');

  console.log('✅ Feed musical:',Object.keys(channels).length,'canals,',videos.length,'vídeos públics conservats; ',categoryEligibleVideoCount,'cançons/directes elegibles per categories.');
  console.log('📱 Shorts detectats:',shortVideoCount);
  console.log('🧪 Revisió manual:',review.length,'vídeos ambigus.');
  console.log('📦 Tipus:',typeCounts);
}

main().catch(error=>{console.error('❌',error.stack||error.message);process.exit(1);});
