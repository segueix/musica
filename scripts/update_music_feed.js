'use strict';

const fs = require('fs');
const path = require('path');
const { classifyMusicContent } = require('./lib/classificar_contingut_musical');
const { resolveChannelDisplayName, findNameOverride, loadNameOverrides } = require('./lib/nom_canal');

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
const VIDEOS_PER_CHANNEL = Math.max(1, Math.min(25, Number.parseInt(process.env.MUSIC_VIDEOS_PER_CHANNEL || '15', 10)));
const API = 'https://www.googleapis.com/youtube/v3';

const GROUPS = [
  { label:'Pop', genres:['Pop'] },
  { label:'Rock', genres:['Rock'] },
  { label:'Indie', genres:['Indie / Alternativa'] },
  { label:'Urbana', genres:['Urbana'] },
  { label:'Rap / Hip-hop', genres:['Rap / Hip-hop'] },
  { label:'Folk i arrel', genres:['Folk i arrel'] },
  { label:"Cançó d'autor", genres:["Cançó d'autor"] },
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
  return cleaned || String(fallback||'').trim();
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

function collectIndexedChannels(db){
  const byId=new Map();
  for(const artist of db.artists||[]){
    if(artist.reviewStatus==='rebutjat') continue;
    const categories=categoriesForGenres(artist.genres||[]);
    for(const ch of artist.youtube?.channels||[]){
      const id=String(ch?.id||'').trim();
      if(!/^UC[A-Za-z0-9_-]{22}$/.test(id)) continue;
      const prev=byId.get(id)||{id,artistNames:[],genres:[],categories:[],types:[],primary:false};
      prev.artistNames=unique([...prev.artistNames,artist.name]);
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

  for(const id of ids){
    const detail=channelDetails.get(id);
    const uploads=detail?.contentDetails?.relatedPlaylists?.uploads;
    if(!uploads){
      channelsWithoutUploads.push(id);
      continue;
    }
    try{
      const payload=await api('playlistItems',{
        part:'contentDetails',
        playlistId:uploads,
        maxResults:VIDEOS_PER_CHANNEL
      });
      playlistVideoIds.set(id,unique((payload.items||[]).map(x=>x.contentDetails?.videoId)));
    }catch(error){
      console.warn('⚠️ '+id+': '+error.message);
      playlistVideoIds.set(id,[]);
    }
  }

  const allVideoIds=unique([...playlistVideoIds.values()].flat());
  const detailsById=new Map();
  for(const batch of chunks(allVideoIds,50)){
    const payload=await api('videos',{
      part:'snippet,contentDetails,statistics,status',
      id:batch.join(',')
    });
    for(const item of payload.items||[]){
      item.durationSeconds=durationSeconds(item.contentDetails?.duration||'');
      detailsById.set(item.id,item);
    }
  }

  const channels={};
  const channelIndex=[];
  const videos=[];
  const review=[];
  const rejectedSamples=[];
  const channelsWithoutVideos=[];
  const channelsWithoutAcceptedMusic=[];
  const typeCounts={song:0,live_song:0,album:0,other:0,review:0};
  let publicVideoCount=0;
  let acceptedMusicCount=0;
  let categoryEligibleVideoCount=0;

  for(const id of ids){
    const meta=indexed.get(id);
    const detail=channelDetails.get(id);
    if(!detail) continue;
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
      if(!item || item.status?.privacyStatus!=='public') continue;
      channelPublicCount++;
      publicVideoCount++;

      const classification=classifyMusicContent({
        item,
        channelMeta:{...meta,channelTitle:rawChannelName}
      });
      typeCounts[classification.contentType]=(typeCounts[classification.contentType]||0)+1;

      const vs=item.snippet||{};
      const base={
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
  if(hiddenIds.size){
    for(let i=videos.length-1;i>=0;i--) if(hiddenIds.has(String(videos[i].id))) videos.splice(i,1);
  }
  videos.sort((a,b)=>(Date.parse(b.publishedAt||'')||0)-(Date.parse(a.publishedAt||'')||0));
  review.sort((a,b)=>(Date.parse(b.publishedAt||'')||0)-(Date.parse(a.publishedAt||'')||0));
  channelIndex.sort((a,b)=>a.name.localeCompare(b.name,'ca',{sensitivity:'base'}));
  const shortVideoCount=videos.filter(v=>v.isShort===true).length;
  const generatedAt=new Date().toISOString();

  fs.writeFileSync(FEED_FILE,JSON.stringify({generatedAt,channels,videos},null,2)+'\n');
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
  fs.writeFileSync(AUDIT_FILE,JSON.stringify({
    generatedAt,
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
