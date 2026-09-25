'use strict';

const fs = require('fs');
const path = require('path');

const API_KEY = process.env.YOUTUBE_API_KEY_SERVER || process.env.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error('❌ Falta YOUTUBE_API_KEY_SERVER.');
  process.exit(1);
}

const ARTISTS_FILE = path.join(process.cwd(), 'data', 'artistes-musica.json');
const FEED_FILE = path.join(process.cwd(), 'data', 'feed.json');
const CHANNELS_FILE = path.join(process.cwd(), 'js', 'channels-ca.json');
const AUDIT_FILE = path.join(process.cwd(), 'data', 'music-feed-audit.json');
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
    for(const item of payload.items||[]) detailsById.set(item.id,item);
  }

  const channels={};
  const channelIndex=[];
  const videos=[];
  const channelsWithoutVideos=[];

  for(const id of ids){
    const meta=indexed.get(id);
    const detail=channelDetails.get(id);
    if(!detail) continue;
    const snippet=detail.snippet||{};
    const categories=meta.categories||[];
    const channel={
      id,
      name:snippet.title || meta.artistNames[0] || id,
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

    let channelVideoCount=0;
    for(const videoId of playlistVideoIds.get(id)||[]){
      const item=detailsById.get(videoId);
      if(!item || item.status?.privacyStatus!=='public') continue;
      const vs=item.snippet||{};
      const duration=item.contentDetails?.duration||'';
      videos.push({
        id:item.id,
        title:vs.title||'',
        description:vs.description||'',
        thumbnail:bestThumb(vs),
        channelId:id,
        channelTitle:channel.name,
        publishedAt:vs.publishedAt||null,
        duration,
        durationSeconds:durationSeconds(duration),
        isShort:false,
        viewCount:Number(item.statistics?.viewCount||0),
        likeCount:Number(item.statistics?.likeCount||0),
        commentCount:Number(item.statistics?.commentCount||0),
        categories,
        genres:meta.genres,
        sourceChannelId:id,
        liveBroadcastContent:vs.liveBroadcastContent||'none'
      });
      channelVideoCount++;
    }
    if(channelVideoCount===0) channelsWithoutVideos.push(id);
  }

  videos.sort((a,b)=>(Date.parse(b.publishedAt||'')||0)-(Date.parse(a.publishedAt||'')||0));
  channelIndex.sort((a,b)=>a.name.localeCompare(b.name,'ca',{sensitivity:'base'}));
  const generatedAt=new Date().toISOString();

  fs.writeFileSync(FEED_FILE,JSON.stringify({generatedAt,channels,videos},null,2)+'\n');
  fs.writeFileSync(CHANNELS_FILE,JSON.stringify({updatedAt:generatedAt,channels:channelIndex},null,2)+'\n');
  fs.writeFileSync(AUDIT_FILE,JSON.stringify({
    generatedAt,
    indexedChannelCount:ids.length,
    resolvedChannelCount:channelDetails.size,
    feedChannelCount:Object.keys(channels).length,
    feedVideoCount:videos.length,
    unresolvedChannelIds:unresolved,
    channelsWithoutUploads,
    channelsWithoutVideos,
    allIndexedChannelsVisible:unresolved.length===0 && Object.keys(channels).length===ids.length
  },null,2)+'\n');

  console.log('✅ Feed musical:',Object.keys(channels).length,'canals,',videos.length,'vídeos.');
  if(unresolved.length) console.log('⚠️ IDs no resolts:',unresolved.join(', '));
  if(channelsWithoutVideos.length) console.log('ℹ️ Canals sense vídeos públics recents:',channelsWithoutVideos.length);
}

main().catch(error=>{console.error('❌',error.stack||error.message);process.exit(1);});
