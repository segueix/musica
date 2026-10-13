'use strict';
// Alta editorial acotada. Sense descobriment ni aprovació automàtica de noves cançons.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
process.chdir(path.resolve(__dirname, '../..'));
const SELECT = 'docs/revisions/2026-10-13-la-iaia-seleccio.json';
const REPORT = 'docs/revisions/2026-10-13-la-iaia-alta.json';
const SUMMARY = 'docs/revisions/2026-10-13-la-iaia-alta.md';
const DISCOVERY = 'docs/revisions/2026-10-13-la-iaia-descoberta.json';
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const write = (f, j) => fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\n');
const norm = s => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const unique = a => [...new Set(a)];
const digest = o => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
const selection = () => {
    const s = read(SELECT);
    assert.equal(s.artists.length, 1);
    for (const a of s.artists) for (const c of a.channels) c.allowedVideoIds = c.ids ? c.ids.trim().split(/\s+/) : c.allowedVideoIds;
    return s;
};
function seconds(iso) {
    const m = String(iso || '').match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    return m ? +(m[1] || 0)*86400 + +(m[2] || 0)*3600 + +(m[3] || 0)*60 + +(m[4] || 0) : 0;
}
function technicalReason(v, channel) {
    if (!v || !/^[A-Za-z0-9_-]{11}$/.test(v.id) || v.channelId !== channel) return 'Identitat o editor no coincident';
    if (v.embeddable !== true) return 'Inserció no disponible';
    if (v.regionRestriction?.blocked?.includes('ES') || (v.regionRestriction?.allowed && !v.regionRestriction.allowed.includes('ES'))) return 'No disponible a Espanya';
    if (!seconds(v.duration) || seconds(v.duration) > 900) return 'Durada fora de la selecció de cançons';
    return null;
}
async function placeFor(a, origins) {
    const names = new Set(a.placeAliases.map(norm));
    let found = a.placeId ? [a.placeId, origins.places[a.placeId]] : Object.entries(origins.places).find(([, p]) => p.type === 'municipality' && names.has(norm(p.name)));
    if (found?.[1]) {assert(names.has(norm(found[1].name))); return found[0];}
    for (const name of a.placeAliases) {
        const u = new URL('https://geocoding-api.open-meteo.com/v1/search');
        for (const [k,v] of Object.entries({name,count:10,language:'ca',format:'json',countryCode:'ES'})) u.searchParams.set(k,String(v));
        const response = await fetch(u,{signal:AbortSignal.timeout(30000)});
        assert(response.ok, 'No es pot geocodificar '+a.place);
        const p = (await response.json()).results?.find(p => names.has(norm(p.name)) && p.country_code === 'ES' && /^PPL/.test(p.feature_code));
        if (!p) continue;
        const [south,north,west,east] = a.bounds;
        assert(p.latitude>south && p.latitude<north && p.longitude>west && p.longitude<east,'Coordenada fora del municipi esperat');
        const id = 'geonames:'+p.id;
        assert(!origins.places[id], 'Cal reconciliar el municipi existent');
        origins.places[id] = {name:a.place,type:'municipality',geonamesId:p.id,coordinates:{latitude:p.latitude,longitude:p.longitude,precision:'settlement_reference'},territory:a.territory,source:u.href,checkedOn:'2026-10-13'};
        return id;
    }
    throw Error('No es resol '+a.place);
}
async function apply() {
    const plan = selection(), snapshot = read(DISCOVERY), now = new Date().toISOString();
    const files = ['artistes-musica','origens-artistes','music-channel-video-allowlist','artistes-vigilats-idioma','music-content-overrides','noms-canals','revisio-idiomes','falsos-shorts','hidden-videos'];
    const [base,origins,allow,watch,types,names,language,shorts,hidden] = files.map(f=>read('data/'+f+'.json'));
    // El registre antic de La Iaia porta ara els canals del projecte solista.
    const mixed=base.artists.find(a=>a.name==='La Iaia' && a.displayName==='Ernest Crusats');
    if(mixed){
        assert(!mixed.active && mixed.reviewStatus==='pendent');
        assert(!base.artists.some(a=>a.name==='Ernest Crusats'));
        assert(mixed.youtube.channels.every(c=>['UCuH5h0CPXPIccfyvgZgF09w','UCl3RfIF60BFTx93il4D11nQ'].includes(c.id)));
        mixed.name='Ernest Crusats'; mixed.aliases=[];
        mixed.wikidataId=null; mixed.musicbrainzId=null;
        mixed.sources=mixed.sources.filter(s=>!s.includes('wikidata'));
        mixed.notes='Identitat solista separada de La Iaia segons noms i crèdits dels canals. Estat previ preservat. '+REPORT;
        delete mixed.enrichment; delete mixed.genresRaw;
        for(const c of mixed.youtube.channels)if(origins.channels[c.id]==='artist:la-iaia')delete origins.channels[c.id];
    }
    const releases=read('data/llancaments-musicals.json');
    const releaseIds=new Set(plan.releases.map(r=>r.id));
    releases.releases=[...releases.releases.filter(r=>!releaseIds.has(r.id)),...plan.releases];
    releases.reviewedOn='2026-10-13';
    write('data/llancaments-musicals.json',releases);
    const wantedNames = new Set(plan.artists.flatMap(a=>[a.name,...a.aliases]).map(norm));
    const isTarget = a => [a.name,a.displayName,...(a.aliases||[])].some(n=>wantedNames.has(norm(n)));
    const before = base.artists.filter(a=>!isTarget(a));
    const forbidden = new Map(plan.languageExclusions.flatMap(e=>e.ids.map(id=>[id,e])));
    const oldHidden = new Set(hidden.videoIds);
    const channelIds = plan.artists.flatMap(a=>a.channels.map(c=>c.id));
    assert.equal(unique(channelIds).length,1,'Canal indicat per l’usuari');
    const allAllowed = plan.artists.flatMap(a=>a.channels.flatMap(c=>c.allowedVideoIds));
    assert.equal(unique(allAllowed).length,allAllowed.length,'IDs duplicats en la selecció');
    for (const id of allAllowed) assert(!oldHidden.has(id) && !forbidden.has(id),'No es pot reobrir una exclusió: '+id);
    const result = {schemaVersion:1,reviewedOn:'2026-10-13',generatedAt:now,method:plan.method,artists:[],languageExclusions:plan.languageExclusions,preservedOtherArtists:before.length,preservedCanonicalHash:digest(before)};
    for (const config of plan.artists) {
        const source = snapshot.artists.find(a=>a.name===config.name);
        assert(source,'Manca descoberta: '+config.name);
        assert.equal(config.channels.filter(c=>c.primary).length,1);
        const aliases = new Set([config.name,...config.aliases].map(norm));
        const matches = base.artists.filter(a=>[a.name,a.displayName,...(a.aliases||[])].some(n=>aliases.has(norm(n))));
        assert(matches.length<=1,'Identitat duplicada: '+config.name);
        const artist = matches[0] || {wikidataId:null,musicbrainzId:null,aliases:[],sources:[],youtube:{channels:[]}};
        assert(artist.reviewStatus!=='rebutjat','Baixa anterior: '+config.name);
        const ids = config.channels.map(c=>c.id);
        assert((artist.youtube?.channels||[]).every(c=>ids.includes(c.id)),'Cal preservar altres canals existents');
        assert(!before.some(a=>(a.youtube?.channels||[]).some(c=>ids.includes(c.id))),'Canal d’una altra identitat');
        const originMatches = Object.entries(origins.artists).filter(([,a])=>aliases.has(norm(a.name)));
        assert(originMatches.length<=1,'Origen duplicat');
        const key = originMatches[0]?.[0] || config.key;
        const placeId = await placeFor(config,origins);
        const entry = {name:config.name,canonicalName:artist.name||config.name,place:config.place,territory:config.territory,genres:config.genres,note:config.note,sources:config.sources,channels:[],notSelected:[]};
        artist.name ||= config.name;
        artist.wikidataId='Q20103096'; artist.musicbrainzId='58ee88f1-1e69-447d-a0ef-3cfea08d7a04';
        Object.assign(artist,{displayName:config.name,aliases:unique([...(artist.aliases||[]),...config.aliases,config.name]),genres:config.genres,territories:[config.territory],languages:['ca'],sources:unique([...(artist.sources||[]),...config.sources,'genre:manual']),confidence:'alta',reviewStatus:'aprovat',active:true,lastChecked:'2026-10-13',notes:config.note+' '+REPORT});
        artist.youtube = {...artist.youtube,channels:[]};
        origins.artists[key] = {...origins.artists[key],name:config.name,status:'validated',relation:'origin',placeIds:[placeId],confidence:'alta',basis:config.basis,sources:[config.originSource],reviewedOn:'2026-10-13',assignmentSource:'manual-review',locked:true};
        for (const channel of config.channels) {
            const found = source.channels.find(c=>c.id===channel.id);
            assert(found?.complete,'Consulta incompleta: '+channel.id);
            assert(!origins.channels[channel.id] || origins.channels[channel.id]===key,'Origen atribuït a un altre artista');
            const byId = new Map(found.videos.map(v=>[v.id,v]));
            const accepted = [];
            for (const id of channel.allowedVideoIds) {
                const v = byId.get(id);
                assert(v,'Falta ID seleccionat: '+id);
                const reason = technicalReason(v,channel.id);
                if(reason){entry.notSelected.push({id,title:v.title,channelId:channel.id,reason});continue;}
                const old = (language.decisions||[]).find(d=>d.id===id);
                assert(old?.accio!=='amaga','Decisió anterior de baixa: '+id);
                const contentType = config.liveIds?.includes(id) ? 'live_song' : 'song';
                const decision = {id,contentType,title:v.title,note:'Enregistrament complet seleccionat per ID; editor verificat. '+REPORT};
                const i = types.videos.findIndex(x=>x.id===id);
                if(i<0)types.videos.push(decision);else types.videos[i]={...types.videos[i],...decision};
                language.decisions ||= [];
                const fullLyric = Boolean(config.lyricSources[id]);
                if(!old)language.decisions.push({id,accio:'conserva',artista:config.name,titol:v.title,font:config.lyricSources[id]||config.sources[0],origen:REPORT,data:now,criteri:fullLyric?'lletra-publicada':'indicacio-usuari',lletraIntegraVerificada:fullLyric});
                if(seconds(v.duration)<=120){shorts.falseShorts=unique([...(shorts.falseShorts||[]),id]);shorts.checked ||= {};shorts.checked[id]=now;}
                accepted.push(id);
            }
            assert(accepted.length,'Canal buit després de la comprovació tècnica');
            allow.channels[channel.id]={artist:config.name,note:config.note+' '+REPORT,allowedVideoIds:accepted,avatarVideoId:channel.avatarVideoId,acceptedMusicOnly:true,allowedContentTypes:['song','live_song']};
            origins.channels[channel.id]=key;
            names.overrides[channel.id]=config.name;
            artist.youtube.channels.push({id:found.id,handle:found.handle,name:found.name,type:channel.type,primary:channel.primary});
            entry.channels.push({id:channel.id,type:channel.type,primary:channel.primary,selected:accepted.length,allowedVideoIds:accepted,lyricVerified:accepted.filter(id=>config.lyricSources[id]).length});
        }
        if(!matches.length)base.artists.push(artist);
        const selected = new Set(entry.channels.flatMap(c=>c.allowedVideoIds));
        const rejected = new Set(entry.notSelected.map(v=>v.id));
        for(const c of source.channels)for(const v of c.videos)if(!selected.has(v.id)&&!rejected.has(v.id))entry.notSelected.push({id:v.id,title:v.title,channelId:c.id,reason:forbidden.get(v.id)?.reason||(plan.formatExclusions.includes(v.id)?'Promoció o fragment, no cançó completa.':plan.identityExclusions.includes(v.id)?'Homònim: no correspon a aquesta artista.':ids.includes(c.id)?'Pendent de contrast suficient de la llengua; no aprovat.':'Canal no atribuït a aquesta identitat.')});
        watch.vigilats=(watch.vigilats||[]).filter(a=>!aliases.has(norm(a.artista)));
        watch.vigilats.push({artista:config.name,aliases:unique([...config.aliases,artist.name,...artist.youtube.channels.map(c=>c.name)]),canals:ids,motiu:config.note,fonts:config.sources});
        watch.confianca=(watch.confianca||[]).filter(a=>!aliases.has(norm(typeof a==='string'?a:a.artista)));
        for(const item of entry.notSelected){
            if(!ids.includes(item.channelId)||forbidden.has(item.id)||plan.formatExclusions.includes(item.id)||plan.identityExclusions.includes(item.id))continue;
            const v=source.channels.flatMap(c=>c.videos).find(v=>v.id===item.id);
            language.pendents ||= [];
            if(!language.pendents.some(p=>p.id===item.id))language.pendents.push({id:item.id,artista:config.name,canalId:item.channelId,titol:item.title,descripcio:'Pendent de contrast lingüístic. '+REPORT,publicada:v.publishedAt.slice(0,10),afegida:now,artistaId:norm(config.name).replaceAll(' ',''),tipus:'song'});
        }
        result.artists.push(entry);
    }
    const snapshotVideos = new Map(snapshot.artists.flatMap(a=>a.channels.flatMap(c=>c.videos)).map(v=>[v.id,v]));
    for(const [id,e] of forbidden){
        const v=snapshotVideos.get(id);
        assert(v && channelIds.includes(v.channelId),'Exclusió fora dels canals seleccionats');
        const d={id,accio:'amaga',artista:e.artist,titol:v.title,font:e.source,origen:REPORT,data:now,criteri:'indicacio-usuari',lletraIntegraVerificada:false,motiu:e.reason};
        language.decisions=[...(language.decisions||[]).filter(x=>x.id!==id),d];
    }
    hidden.videoIds=unique([...hidden.videoIds,...forbidden.keys()]);
    language.pendents=(language.pendents||[]).filter(v=>!allAllowed.includes(v.id)&&!forbidden.has(v.id));
    assert.equal(digest(base.artists.filter(a=>!isTarget(a))),result.preservedCanonicalHash,'Artistes aliens modificats');
    for(const o of [base,origins,allow,types,language])o.updatedAt=now;
    watch.updatedAt='2026-10-13';
    for(let i=0;i<files.length;i++)write('data/'+files[i]+'.json',[base,origins,allow,watch,types,names,language,shorts,hidden][i]);
    write(REPORT,result);
    if(process.env.GITHUB_ENV)fs.appendFileSync(process.env.GITHUB_ENV,'MUSIC_TARGET_CHANNELS='+channelIds.join(',')+'\n');
    console.log(JSON.stringify(result.artists.map(a=>({name:a.name,selected:a.channels.reduce((n,c)=>n+c.selected,0)}))));
}
function verify(){
    const result=read(REPORT),base=read('data/artistes-musica.json'),feed=read('data/feed.json'),channels=read('js/channels-ca.json').channels,origins=read('data/origens-artistes.json'),hidden=new Set(read('data/hidden-videos.json').videoIds);
    const plan=selection(), wanted=new Set(plan.artists.flatMap(a=>[a.name,...a.aliases]).map(norm));
    assert.equal(digest(base.artists.filter(a=>![a.name,a.displayName,...(a.aliases||[])].some(n=>wanted.has(norm(n))))),result.preservedCanonicalHash);
    const {cleanTitle}=require('../../js/song-title.js');
    let total=0;
    for(const artist of result.artists){
        const canonical=base.artists.filter(a=>a.name===artist.canonicalName&&a.active&&a.reviewStatus==='aprovat');
        assert.equal(canonical.length,1);
        assert.equal(canonical[0].youtube.channels.filter(c=>c.primary).length,1);
        let count=0;
        for(const c of artist.channels){
            assert(channels.some(x=>x.id===c.id),'Canal sense publicar');
            assert.equal(origins.artists[origins.channels[c.id]].name,artist.name);
            const f='data/archive/channels/'+c.id+'.json',archive=fs.existsSync(f)?read(f).videos:[];
            const hot=feed.videos.filter(v=>v.channelId===c.id),all=[...new Map([...archive,...hot].map(v=>[v.id,v])).values()];
            assert(all.length>0,'Canal buit');
            assert(all.every(v=>c.allowedVideoIds.includes(v.id)&&!hidden.has(v.id)),'Vídeo fora de selecció');
            for(const v of all){const t=cleanTitle(v.title,{artists:[v.channelTitle,artist.name,feed.channels[c.id]?.name].filter(Boolean)});assert(t.trim());assert(!/[([{][^()[\]{}]*(video|vídeo|oficial|official)[^()[\]{}]*[)\]}]/i.test(t),'Títol sense netejar: '+v.id+' '+t);}
            const present=new Set(all.map(v=>v.id));
            c.publication={hot:hot.length,archive:archive.length,recordings:all.length,notPublished:c.allowedVideoIds.filter(id=>!present.has(id))};
            assert(fs.existsSync('compartir/artista/'+c.id+'.html'));
            count+=all.length;
        }
        artist.recordingsPublished=count;total+=count;
    }
    assert.equal(total,63,'Tot el repertori autoritzat ha de publicar-se');
    const albums=read('data/albums-musica.json').artists['La Iaia'].albums;
    assert.equal(albums.length,plan.releases.length);
    for(const r of plan.releases){const a=albums.find(a=>a.title===r.title);assert(a);assert.deepEqual([...a.trackIds].sort(),r.tracks.flatMap(t=>t.videos.map(v=>v.id)).sort());}
    result.releases=albums.map(a=>({title:a.title,year:a.year,type:a.type,tracks:a.trackGroups.length,recordings:a.trackIds.length}));
    const old=read('/tmp/la-iaia-channels-before.json').channels;
    for(const c of old){const after=channels.find(x=>x.id===c.id);assert(after,'Canal antic eliminat: '+c.name);assert.deepEqual([...(after.genres||[])].sort(),[...(c.genres||[])].sort(),'Gèneres previs modificats: '+c.name);}
    result.preservedPublishedChannels=old.length;
    assert(!channels.some(c=>c.id==='UC9zX7R05JQ1P30RGvtjHizQ'));
    result.publication={checkedAt:new Date().toISOString(),artists:1,channels:1,recordings:total,status:'verified'};
    result.validation=read('/tmp/tardor-blat-quinto-validation.json');
    result.lint=read('/tmp/pepet-lint-summary.json');
    write(REPORT,result);
    fs.writeFileSync(SUMMARY,'# La Iaia: alta verificada\n\n'+result.artists.map(a=>'- '+a.name+' — '+a.place+' — '+a.genres.join(', ')+': '+a.recordingsPublished+' enregistraments.').join('\n')+'\n\n'+total+' enregistraments; un artista i un canal Tema. Nou llançaments indexats amb totes les pistes i versions. El recompte inclou versions, no només composicions úniques.\n\n'+result.artists.map(a=>'## '+a.name+'\n'+a.note).join('\n\n')+'\n\n'+result.method+'\n\nProves: '+result.validation.passedTests+' superades; '+result.validation.failedTests+' fallades reproduïdes a la línia base; '+result.validation.regressions+' regressions. Lint: '+result.lint.newDiagnostics+' diagnòstics nous.\n');
    console.log(JSON.stringify(result.publication));
}
if(require.main===module)(process.argv.includes('--verify')?Promise.resolve().then(verify):apply()).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={technicalReason,seconds,REPORT};
