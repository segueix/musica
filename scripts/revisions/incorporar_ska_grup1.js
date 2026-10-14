'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const vm = require('node:vm');
const read = p => JSON.parse(fs.readFileSync(p,'utf8'));
const write = (p,v) => fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const norm = s => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const digest = v => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const REPORT = 'docs/revisions/2026-10-14-ska1-alta.json';
const CONFIG = [
  {
    "name": "Agraviats",
    "slug": "agraviats",
    "aliases": [],
    "territory": "País Valencià",
    "place": "Borriol",
    "placeAliases": [
      "Borriol"
    ],
    "bounds": [
      40,
      40.2,
      -0.2,
      0.1
    ],
    "subcategory": "ska-punk",
    "facets": [
      "ska",
      "punk"
    ],
    "basis": "Origen a Borriol; ska amb influència punk i evolució cap al reggae, funk i swing.",
    "source": "https://www.verkami.com/projects/1857-torn-de-paraula-nou-disc-d-agraviats",
    "channels": [
      {
        "id": "UClM-LZwhDXymZaKrjGrDnzg",
        "ids": "Sho7hOWNW_I yQPMAX2OWhQ -b30iAfx-Pw QfkjJD83OtY OKBHuhYxSw0 XDw5LAW2xiU vI1CA9j4jTo"
      }
    ],
    "lyricSources": {
      "Sho7hOWNW_I": "https://mesdemil.bandcamp.com/album/agraviats-torn-de-paraula",
      "yQPMAX2OWhQ": "https://mesdemil.bandcamp.com/album/agraviats-torn-de-paraula",
      "-b30iAfx-Pw": "https://mesdemil.bandcamp.com/album/agraviats-torn-de-paraula",
      "QfkjJD83OtY": "https://mesdemil.bandcamp.com/album/agraviats-torn-de-paraula",
      "OKBHuhYxSw0": "https://mesdemil.bandcamp.com/album/agraviats-torn-de-paraula",
      "XDw5LAW2xiU": "https://mesdemil.bandcamp.com/album/agraviats-torn-de-paraula",
      "vI1CA9j4jTo": "https://mesdemil.bandcamp.com/album/agraviats-torn-de-paraula"
    }
  },
  {
    "name": "Dekrèpits",
    "slug": "dekrepits",
    "aliases": [
      "Dekrepits"
    ],
    "territory": "Catalunya",
    "place": "Empordà",
    "region": true,
    "subcategory": "ska-classic",
    "facets": [
      "ska",
      "folk"
    ],
    "basis": "Banda empordanesa de ska i reggae amb música tradicional i acordió. Es conserva l’origen comarcal, sense atribuir un municipi no contrastat.",
    "source": "https://medirflash.cat/dekrepits.cfm",
    "channels": [
      {
        "id": "UCKTrsy9eH-cD9geEnh2SB3w",
        "ids": "H_F5QTTG5xE"
      }
    ],
    "lyricSources": {},
    "songSources": {
      "H_F5QTTG5xE": "https://angeletsdelaterra.com/les-angelets"
    }
  },
  {
    "name": "Deskarats",
    "slug": "deskarats",
    "aliases": [],
    "territory": "Catalunya",
    "place": "Amer",
    "placeAliases": [
      "Amer"
    ],
    "bounds": [
      41.9,
      42.1,
      2.5,
      2.8
    ],
    "subcategory": "ska-revival",
    "facets": [
      "ska",
      "ska-revival"
    ],
    "basis": "Banda d’Amer; ska amb referents Skatalà, Madness i The Toasters, i evolució cap a guitarres rock.",
    "source": "https://www.enderrock.cat/noticia/6667/comenca-festival-deskarats",
    "channels": [
      {
        "id": "UCKPv-OAeyx3OeKgn48iPbUQ",
        "ids": "BmL8Mf2SnWo"
      },
      {
        "id": "UClrbmaOS1Mrd6tBAya40gaQ",
        "ids": "u7lyMT08YYQ zXnbiHQFbvw eTpBeUdLKGY mSay9qGMMZY F1lGuaFfPio jrC84QQKcK8 d5mTC9j_mhY OCMu6qAi3GM"
      }
    ],
    "lyricSources": {
      "BmL8Mf2SnWo": "https://www.coveralia.com/letras/dks-deskarats.php",
      "u7lyMT08YYQ": "https://www.culturacatalana.cat/deskarats-rude-boy-ska/",
      "zXnbiHQFbvw": "https://catalunyatot.blogspot.com/2014/03/",
      "eTpBeUdLKGY": "https://www.coveralia.com/letras/el-compte-enrere-deskarats.php",
      "mSay9qGMMZY": "https://www.coveralia.com/letras/escarabats-i-rates-deskarats.php",
      "F1lGuaFfPio": "https://www.coveralia.com/letras/fumar-tenia-un-preu-deskarats.php",
      "jrC84QQKcK8": "https://www.coveralia.com/letras/punt-i-a-part-deskarats.php",
      "d5mTC9j_mhY": "https://www.coveralia.com/letras/reacciona--deskarats.php",
      "OCMu6qAi3GM": "https://www.coveralia.com/letras/soc-aixi-deskarats.php"
    }
  }
];
const TARGETS = [...CONFIG.map(a=>a.name),'Ki Sap'];
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
        origins.places[id] = {name:a.place,type:'municipality',geonamesId:p.id,coordinates:{latitude:p.latitude,longitude:p.longitude,precision:'settlement_reference'},territory:a.territory,source:u.href,checkedOn:'2026-10-14'};
        return id;
    }
    throw Error('No es resol '+a.place);
}

async function apply() {
    const now=new Date().toISOString();
    const files=['artistes-musica','origens-artistes','music-channel-video-allowlist','artistes-vigilats-idioma','music-content-overrides','noms-canals','revisio-idiomes','music-subcategories','music-affinity-review'];
    const [db,origins,allow,watch,types,names,language,taxonomy,reviews]=files.map(f=>read('data/'+f+'.json'));
    const hidden=new Set(read('data/hidden-videos.json').videoIds);
    const other=db.artists.filter(a=>!TARGETS.includes(a.name));
    const oldFeed=read('data/feed.json');
    const result={reviewedAt:now,artists:[],deferredArtists:[],otherArtistsHash:digest(other),previousVideoIds:oldFeed.videos.filter(v=>!hidden.has(v.id)).map(v=>v.id),previouslyHiddenVideoIds:oldFeed.videos.filter(v=>hidden.has(v.id)).map(v=>v.id),
        method:'Selecció acotada per ID amb fonts lingüístiques i discogràfiques. Lletres publicades contrastades, sense afirmar escolta íntegra dels enregistraments. Canals Tema prioritaris; la resta del repertori requereix revisió.'};
    for(const a of CONFIG) {
        const snapshot=read('docs/revisions/2026-10-14-ska1-'+a.slug+'.json');
        assert(!db.artists.some(x=>x.name===a.name),'Alta ja present: '+a.name);
        let place;
        if(a.region) {
            place='territory:'+a.slug;
            origins.places[place]={name:a.place,type:'region',coordinates:null,territory:a.territory};
        } else place=await placeFor(a,origins);
        const key='artist:'+a.slug;
        origins.artists[key]={name:a.name,status:'validated',relation:'origin',placeIds:[place],confidence:'alta',basis:a.basis,sources:[a.source],reviewedOn:'2026-10-14',assignmentSource:'manual-review',locked:true};
        const channels=[];
        const entry={name:a.name,place:a.place,category:'Ska / Reggae',subcategory:a.subcategory,channels:[],notSelected:[]};
        for(const c of a.channels) {
            const found=snapshot.channels.find(x=>x.id===c.id);
            assert(found?.complete);
            assert(!other.some(x=>x.youtube?.channels?.some(y=>y.id===c.id)),'Canal aliè');
            const ids=c.ids.split(' ');
            for(const id of ids) {
                const v=found.videos.find(x=>x.id===id);
                assert(v && v.embeddable && !v.regionRestriction?.blocked?.includes('ES') && (!v.regionRestriction?.allowed || v.regionRestriction.allowed.includes('ES')),'Vídeo no disponible: '+id);
                assert(!hidden.has(id) && !language.decisions?.some(d=>d.id===id&&d.accio==='amaga'),'Exclusió prèvia: '+id);
                if(!language.decisions.some(d=>d.id===id)) language.decisions.push({id,accio:'conserva',artista:a.name,titol:v.title,font:a.lyricSources[id]||a.songSources?.[id]||a.source,origen:REPORT,data:now,criteri:a.lyricSources[id]?'lletra-publicada':'seleccio-documental',lletraIntegraVerificada:!!a.lyricSources[id]});
                const decision={id,contentType:'song',title:v.title,note:'Edició discogràfica del canal Tema, seleccionada per ID. '+REPORT};
                const i=types.videos.findIndex(x=>x.id===id);
                if(i<0) types.videos.push(decision); else types.videos[i]={...types.videos[i],...decision};
            }
            allow.channels[c.id]={artist:a.name,allowedVideoIds:ids,acceptedMusicOnly:true,allowedContentTypes:['song'],note:'Només les peces de la selecció contrastada; novetats pendents de revisió. '+REPORT};
            origins.channels[c.id]=key; names.overrides[c.id]=a.name;
            channels.push({id:c.id,name:found.name,handle:found.handle,type:'topic',primary:channels.length===0});
            entry.channels.push({id:c.id,allowedVideoIds:ids});
        }
        const selected=new Set(entry.channels.flatMap(c=>c.allowedVideoIds));
        language.pendents=(language.pendents||[]).filter(v=>!selected.has(v.id));
        for(const c of snapshot.channels) for(const v of c.videos) if(!selected.has(v.id)) {
            entry.notSelected.push({id:v.id,title:v.title,channelId:c.id,reason:'Pendent de contrast lingüístic o de format; no publicat.'});
            if(a.channels.some(ch=>ch.id===c.id) && !language.pendents.some(p=>p.id===v.id)) language.pendents.push({id:v.id,artista:a.name,canalId:c.id,titol:v.title,tipus:'song',publicada:v.publishedAt.slice(0,10),afegida:now,descripcio:'No aprovat: manca contrast suficient de la peça. '+REPORT});
        }
        db.artists.push({name:a.name,aliases:a.aliases,genres:['Ska / Reggae'],territories:[a.territory],languages:['ca'],wikidataId:null,musicbrainzId:null,youtube:{channels},confidence:'alta',reviewStatus:'aprovat',active:true,sources:[a.source,'genre:manual'],lastChecked:now,notes:a.basis+' Selecció parcial contrastada; no importació de tot el canal. '+REPORT});
        taxonomy.overrides[a.name]={subcategory:a.subcategory,basis:a.basis,sources:[a.source]};
        reviews.artists=reviews.artists.filter(x=>x.artist!==a.name);
        reviews.artists.push({artist:a.name,genres:['Ska / Reggae'],facets:a.facets,sources:[a.source],reviewedAt:'2026-10-14',confidence:0.9,method:'source-review'});
        watch.confianca=watch.confianca.filter(x=>(typeof x==='string'?x:x.artista)!==a.name);
        watch.vigilats=watch.vigilats.filter(x=>x.artista!==a.name);
        watch.vigilats.push({artista:a.name,aliases:a.aliases,canals:channels.map(c=>c.id),motiu:'Catàleg parcial: només IDs revisats. Altres idiomes, formats i novetats requereixen revisió.',fonts:[a.source,REPORT]});
        result.artists.push(entry);
    }
    const ki=read('docs/revisions/2026-10-14-ska1-ki-sap.json');
    assert(!db.artists.some(a=>a.name==='Ki Sap'));
    const note='Canal Tema i canals propis revisats. A vora barranc no localitzada als canals revisats; Al dia següent està fragmentada i Mira quina trola manca contrast lingüístic suficient. Cap pista aprovada.';
    const channels=ki.channels.map((c,i)=>({id:c.id,name:c.name,handle:c.handle,type:c.name.endsWith('Topic')?'topic':'official',primary:i===0}));
    db.artists.push({name:'Ki Sap',aliases:['Ki-Sap'],genres:['Ska / Reggae'],territories:['País Valencià'],languages:[],wikidataId:null,musicbrainzId:null,youtube:{channels},confidence:'alta',reviewStatus:'pendent',active:false,sources:['https://www.valenciaska.net/grup/ki-sap/','genre:manual'],lastChecked:now,notes:note+' '+REPORT});
    watch.vigilats=watch.vigilats.filter(a=>a.artista!=='Ki Sap');
    watch.vigilats.push({artista:'Ki Sap',aliases:['Ki-Sap'],canals:channels.map(c=>c.id),motiu:note,fonts:['https://www.valenciaska.net/grup/ki-sap/',REPORT]});
    for(const c of ki.channels) allow.channels[c.id]={artist:'Ki Sap',allowedVideoIds:[],acceptedMusicOnly:true,allowedContentTypes:['song'],note:note};
    result.deferredArtists.push({name:'Ki Sap',note,channels});
    db.updatedAt=now;
    files.forEach((f,i)=>write('data/'+f+'.json',[db,origins,allow,watch,types,names,language,taxonomy,reviews][i]));
    write(REPORT,result);
}
function verify() {
    const r=read(REPORT),db=read('data/artistes-musica.json'),feed=read('data/feed.json'),channels=read('js/channels-ca.json').channels;
    assert.equal(digest(db.artists.filter(a=>!TARGETS.includes(a.name))),r.otherArtistsHash,'Artistes aliens modificats');
    const all=[...feed.videos];
    for(const f of fs.readdirSync('data/archive/channels').filter(f=>f.endsWith('.json'))) all.push(...read('data/archive/channels/'+f).videos);
    const allIds=new Set(all.map(v=>v.id));
    const lost=r.previousVideoIds.filter(id=>!allIds.has(id));
    if(lost.length) {
        const hidden=new Set(read('data/hidden-videos.json').videoIds);
        const lang=read('data/revisio-idiomes.json');
        console.log(JSON.stringify({missingPreviousVideos:lost.map(id=>({id,hidden:hidden.has(id),decisions:lang.decisions.filter(d=>d.id===id)}))}));
    }
    assert(!lost.length,'Repertori previ perdut');
    const sandbox={window:{}};
    vm.runInNewContext(fs.readFileSync('js/features/music-affinity-catalog.js','utf8'),sandbox);
    const profiles=sandbox.window.SegueixMusicAffinityCatalog.profiles;
    let total=0;
    for(const a of r.artists) {
        let count=0;
        for(const c of a.channels) {
            assert.deepEqual(channels.find(x=>x.id===c.id)?.categories,['Ska / Reggae']);
            const videos=[...new Map(all.filter(v=>v.channelId===c.id).map(v=>[v.id,v])).values()];
            assert(videos.every(v=>c.allowedVideoIds.includes(v.id)),'Vídeo no seleccionat');
            assert.equal(videos.length,c.allowedVideoIds.length,'Selecció incompleta: '+a.name);
            assert(videos.every(v=>v.categories.includes('Ska / Reggae')));
            assert(fs.existsSync('compartir/artista/'+c.id+'.html'));
            count+=videos.length;
        }
        const p=profiles.find(p=>p.artist===a.name);
        assert(p && p.primaryCategory==='Ska / Reggae' && p.subcategory===a.subcategory,'Perfil incorrecte: '+a.name);
        a.recordingsPublished=count; total+=count;
    }
    const ki=db.artists.find(a=>a.name==='Ki Sap');
    assert(!ki.active && ki.reviewStatus==='pendent');
    assert(!channels.some(c=>ki.youtube.channels.some(k=>k.id===c.id)),'Ki Sap publicada sense selecció');
    r.publication={checkedAt:new Date().toISOString(),artists:3,deferredArtists:1,recordings:total,status:'verified'};
    delete r.previousVideoIds;
    write(REPORT,r);
    console.log(JSON.stringify(r.publication));
}
(process.argv.includes('--verify')?Promise.resolve().then(verify):apply()).catch(e=>{console.error(e.stack);process.exitCode=1;});
