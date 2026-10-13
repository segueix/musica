'use strict';

// Revisió documental acotada: lletres oficials llegides, no detecció per llengua del títol.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { serializeFeed } = require('../lib/aprimar_feed');
const { serializeStyleHistory } = require('../lib/arxiu_musical');
const CHANNEL = 'UCg2Go1mJnKlXnMvy1VhlZTw';
const PREFIX = 'docs/revisions/2026-10-13-animal';
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const write = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n');
const unique = a => [...new Set(a)];
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const EXCLUDED = [
    {title:'Bam bam',language:'anglès',ids:['2fCmI1lebgI'],sourceId:'2fCmI1lebgI',evidence:'Close your eyes, open your mind'},
    {title:'Mil huellas',language:'castellà',ids:['OfNF7ynrPmI'],sourceId:'OfNF7ynrPmI',evidence:'Quiero vivir en tus defectos'},
    {title:'Todo lo que tengo',language:'castellà',ids:['O8pDDoHLjJ8','nCfN97003hQ'],sourceId:'O8pDDoHLjJ8',evidence:'Todo lo que tengo para darte'},
    {title:'Sabio sin razón',language:'castellà',ids:['Bk__T96E5Qg','rFHcSgEDjLs'],sourceId:'Bk__T96E5Qg',evidence:'Quiero sentir que mi alma vuela'},
];
const LYRICS_CA = ['VLy7GBX5Yu8','OitF4DuO3e0','jLHosn5la2Q','nDxBqt475FM','o36yDy-DDGY','tOgMTOAnm_g','2wIAG_AA4x4','izgjq2enqD4','4eydfjABwYk','B6rtx3_r1Zo','i5udQC67Hgs','eKqUkn9bqWo','W7D9m7qeKt8','rtlwyPlZNg0','BL1xS8FHF8k','Bly7DGty19o','DInEDH1EfuU','XYtr7l0jmSQ','QXzEmTggvyw','ZVVWM_DEjOo','6ZnwCG_Qn0s'];
const blocked = new Set(EXCLUDED.flatMap(w => w.ids));
const source = id => 'https://www.youtube.com/watch?v=' + id;
function catalog() {
    const feed = read('data/feed.json');
    const records = [...feed.videos];
    for (const f of fs.readdirSync('data/archive/channels').filter(f=>f.endsWith('.json'))) records.push(...read('data/archive/channels/'+f).videos);
    return records.sort((a,b)=>a.id.localeCompare(b.id));
}
function apply() {
    const now = new Date().toISOString();
    const discovery = read(PREFIX+'-inventari.json');
    const videos = new Map(discovery.youtube.map(v=>[v.id,v]));
    assert(!discovery.apiError && !discovery.incomplete, 'Cal una consulta completa del canal');
    const base = read('data/artistes-musica.json');
    const owner = base.artists.filter(a=>(a.youtube?.channels || []).some(c=>c.id===CHANNEL));
    assert.equal(owner.length,1);
    assert.equal(owner[0].name,'Animal');
    const before = catalog();
    const baseline = {records:before.filter(v=>!blocked.has(v.id)),files:Object.fromEntries(['data/artistes-musica.json','data/origens-artistes.json','js/channels-ca.json'].map(f=>[f,hash(fs.readFileSync(f))]))};
    write('/tmp/animal-baseline.json',baseline);
    const hidden = read('data/hidden-videos.json');
    const previous = new Set(hidden.videoIds);
    const language = read('data/revisio-idiomes.json');
    const report = {reviewedOn:'2026-10-13',channelId:CHANNEL,method:'Lectura de les lletres publicades al canal oficial; contrast documental de les versions ORIGENANIMAL. No s’ha fet escolta íntegra de tots els enregistraments. No es dedueix la llengua del títol.',youtubeVideosInspected:discovery.youtube.length,catalogBefore:before.filter(v=>v.channelId===CHANNEL).length,excluded:[],lyricsReviewed:[],requestsAlreadyPublished:discovery.requests};
    const addDecision = (id,action,font,note) => {
        const v=videos.get(id); assert(v && v.channelId===CHANNEL, 'Identitat no acreditada: '+id);
        if(action==='conserva') assert(!previous.has(id),'No es poden recuperar exclusions anteriors: '+id);
        language.decisions=(language.decisions || []).filter(d=>d.id!==id);
        language.decisions.push({id,accio:action,artista:'Animal',titol:v.title,font,origen:PREFIX+'-revisio.json',data:now,nota:note});
        language.revisades=unique([...(language.revisades || []),id]);
    };
    for(const work of EXCLUDED) {
        const original=videos.get(work.sourceId);
        assert(original?.channelId===CHANNEL && original.description.includes(work.evidence),'Evidència de lletra absent: '+work.title);
        for(const id of work.ids) {
            addDecision(id,'amaga',source(work.sourceId),id===work.sourceId?'Lletra oficial publicada contrastada.':'Exclusió anterior conservada; versió ORIGENANIMAL de la mateixa obra.');
            report.excluded.push({id,title:videos.get(id).title,work:work.title,language:work.language,source:source(work.sourceId),alreadyHidden:previous.has(id),wasIndexed:before.some(v=>v.id===id)});
        }
    }
    for(const id of LYRICS_CA) {
        addDecision(id,'conserva',source(id),'Lletra catalana publicada al vídeo oficial i llegida en aquesta revisió.');
        report.lyricsReviewed.push({id,title:videos.get(id).title,language:'català',source:source(id)});
    }
    hidden.videoIds=unique([...hidden.videoIds,...blocked]);
    hidden.updatedAt=now; write('data/hidden-videos.json',hidden);
    const reviewed=new Set(language.revisades);
    for(const k of ['pendents','descartades','acceptadesPerArtista']) language[k]=(language[k] || []).filter(v=>!reviewed.has(v.id));
    language.revisades.sort();
    language.updatedAt=now; write('data/revisio-idiomes.json',language);
    const allow=read('data/music-channel-video-allowlist.json');
    const rule=allow.channels[CHANNEL] || {};
    rule.deniedTitleContains=unique([...(rule.deniedTitleContains || []),...EXCLUDED.map(w=>w.title)]);
    rule.artist='Animal';
    rule.note='Quatre obres excloses per lletra oficial contrastada: Bam bam (anglès), Mil huellas, Todo lo que tengo i Sabio sin razón (castellà). No és una exclusió general del canal. Vegeu '+PREFIX+'-revisio.json';
    if(rule.allowedVideoIds) rule.allowedVideoIds=rule.allowedVideoIds.filter(id=>!blocked.has(id));
    allow.channels[CHANNEL]=rule; allow.updatedAt=now; write('data/music-channel-video-allowlist.json',allow);
    const watch=read('data/artistes-vigilats-idioma.json');
    const watched=watch.vigilats.find(a=>(a.canals || []).includes(CHANNEL));
    assert(watched,'Falta la vigilància prèvia d’Animal');
    watched.motiu='Repertori català amb quatre obres excloses en anglès/castellà. Les novetats i col·laboracions continuen subjectes a revisió. '+PREFIX+'-revisio.json';
    watched.fonts=unique([...(watched.fonts || []),...EXCLUDED.map(w=>source(w.sourceId))]);
    watch.updatedAt='2026-10-13'; write('data/artistes-vigilats-idioma.json',watch);
    const feed=read('data/feed.json');
    feed.videos=feed.videos.filter(v=>!blocked.has(v.id)); feed.generatedAt=now;
    fs.writeFileSync('data/feed.json',serializeFeed(feed));
    for(const f of ['data/history-pool.json','data/historial-musical.json',...fs.readdirSync('data/archive/channels').filter(f=>f.endsWith('.json')).map(f=>'data/archive/channels/'+f)]) {
        const d=read(f); const kept=d.videos.filter(v=>!blocked.has(v.id));
        if(kept.length===d.videos.length) continue;
        d.videos=kept; d.updatedAt=now;
        fs.writeFileSync(f,f.endsWith('/historial-musical.json')?serializeStyleHistory(kept,now):JSON.stringify(d));
    }
    const albums=read('data/albums-musica.json'); let albumChanged=false;
    for(const entry of Object.values(albums.artists || {})) for(const album of entry.albums || []) {
        const kept=(album.trackIds || []).filter(id=>!blocked.has(id));
        if(kept.length!==(album.trackIds || []).length) {album.trackIds=kept;albumChanged=true;}
        for(const group of album.trackGroups || []) group.videoIds=group.videoIds.filter(id=>!blocked.has(id));
        if(blocked.has(album.coverVideoId)) {album.coverVideoId=kept[0] || '';albumChanged=true;}
    }
    if(albumChanged) {albums.generatedAt=now;write('data/albums-musica.json',albums);}
    for(const f of ['data/music-content-audit.json','data/music-feed-audit.json']) {
        const audit=read(f);audit.publishedFeedVideoCount=feed.videos.length;write(f,audit);
    }
    report.newlyHidden=report.excluded.filter(v=>!v.alreadyHidden).length;
    report.removedFromCatalog=before.filter(v=>blocked.has(v.id)).length;
    report.catalogAfter=catalog().filter(v=>v.channelId===CHANNEL).length;
    report.remainingSongs=catalog().filter(v=>v.channelId===CHANNEL && ['song','live_song'].includes(v.contentType)).length;
    report.otherRecordings=discovery.youtube.filter(v=>!blocked.has(v.id) && !LYRICS_CA.includes(v.id)).map(v=>({id:v.id,title:v.title,note:'Sense nova exclusió. No es dona per escoltada ni per revisada íntegrament aquesta versió.'}));
    write(PREFIX+'-revisio.json',report);
    // Conserva la traçabilitat sense replicar lletres completes als documents del repositori.
    discovery.youtube=discovery.youtube.map(({description,...v})=>({...v,source:source(v.id),descriptionSha256:hash(description || '')}));
    write(PREFIX+'-inventari.json',discovery);
    fs.writeFileSync(PREFIX+'-inventari.md','# Inventari d’Animal\n\n'+discovery.youtube.map(v=>v.id+' | '+v.title+' | '+source(v.id)).join('\n')+'\n');
    console.log(JSON.stringify({newlyHidden:report.newlyHidden,removedFromCatalog:report.removedFromCatalog,remainingSongs:report.remainingSongs}));
}
function verify() {
    const baseline=read('/tmp/animal-baseline.json');
    assert.deepEqual(catalog(),baseline.records,'S’ha modificat repertori aliè a les sis exclusions');
    for(const [f,digest] of Object.entries(baseline.files)) assert.equal(hash(fs.readFileSync(f)),digest,'S’ha alterat '+f);
    const report=read(PREFIX+'-revisio.json');
    for(const id of blocked) {
        assert(read('data/hidden-videos.json').videoIds.includes(id));
        assert(!fs.existsSync('compartir/canco/'+id+'.html'),'Sobreviu la pàgina compartida: '+id);
    }
    for(const f of ['data/history-pool.json','data/historial-musical.json',...fs.readdirSync('data').filter(f=>/^search_index_.*\.json$/.test(f)).map(f=>'data/'+f)]) {
        const d=read(f); const text=JSON.stringify(d);
        for(const id of blocked) assert(!text.includes(id),'Sobreviu un ID exclòs a '+f);
    }
    report.verification={checkedAt:new Date().toISOString(),status:'passed',unrelatedCatalogUnchanged:true,sharedPagesAndSearchClean:true};
    write(PREFIX+'-revisio.json',report);
    fs.writeFileSync(PREFIX+'-revisio.md','# Revisió d’Animal\n\n'+
      report.youtubeVideosInspected+' vídeos del canal inspeccionats documentalment. '+report.lyricsReviewed.length+' enregistraments amb lletra catalana publicada contrastada.\n\n'+
      'Exclusió nova: Bam bam (anglès).\n\n'+
      'Exclusions anteriors confirmades: Mil huellas, Todo lo que tengo i Sabio sin razón (castellà); cinc enregistraments ja ocults.\n\n'+
      report.removedFromCatalog+' còpies retirades del catàleg/arxiu, inclosa Bam bam. Sis IDs bloquejats en total; '+report.remainingSongs+' enregistraments musicals d’Animal conservats.\n\n'+
      'Cap altra exclusió nova a les lletres revisades. Les versions sense lletra completa no es donen per escoltades.\n\n'+
      'S’han comprovat el feed, l’arxiu, les ràdios, l’índex de cerca i les pàgines compartides. La base d’artistes, els orígens i tot el repertori aliè a les exclusions es conserven sense canvis.\n');
    console.log('Verificació d’Animal superada; la resta del catàleg es conserva íntegra.');
}
if(require.main===module) (process.argv.includes('--verify')?verify:apply)();
module.exports={EXCLUDED,LYRICS_CA,CHANNEL};
