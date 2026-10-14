'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const vm = require('node:vm');
const read = p => JSON.parse(fs.readFileSync(p,'utf8'));
const write = (p,v) => fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const norm = s => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const digest = v => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const REPORT = 'docs/revisions/2026-10-14-ska2-alta.json';
const CONFIG = [
  {
    "name": "Oprimits",
    "slug": "oprimits",
    "territory": "Illes Balears",
    "place": "Mallorca",
    "placeId": "territory:mallorca",
    "placeAliases": [
      "Mallorca"
    ],
    "subcategory": "ska-punk",
    "facets": [
      "ska",
      "punk",
      "rock"
    ],
    "basis": "Formació mallorquina de ska, rock i reggae amb influència punk. Origen insular documentat pel mateix grup.",
    "source": "https://www.verkami.com/projects/3513-oprimits-seguim-endavant",
    "channels": [
      {
        "id": "UCF4BwKBwBRZIpylrvVqQmBQ",
        "ids": "rZV7LihcMhU",
        "external": {
          "rZV7LihcMhU": "UCf1CFHoZ7F177qxj9ZXrjkg"
        }
      }
    ],
    "lyricSources": {
      "rZV7LihcMhU": "https://www.ouvirmusica.com.br/oprimits/1242815/"
    },
    "aliases": []
  },
  {
    "name": "Skaparapid",
    "slug": "skaparapid",
    "territory": "País Valencià",
    "place": "València",
    "placeId": "geonames:2509954",
    "placeAliases": [
      "València"
    ],
    "subcategory": "ska-punk",
    "facets": [
      "ska",
      "punk"
    ],
    "basis": "Grup nascut a València al Kasal Popular; ska combatiu amb influència punk. Repertori multilingüe seleccionat per cançó.",
    "source": "https://open.spotify.com/artist/0KS8PpA5dt2xO2nGB7wMlS",
    "channels": [
      {
        "id": "UCLlsd1LOmkAMoqbSE36JBZg",
        "ids": "U8RvUBPOh-w k7pAyP6vRyQ c8kLZMaaxpQ voMVtKDgto4 csuFwPshrmE"
      }
    ],
    "lyricSources": {
      "U8RvUBPOh-w": "https://www.musica.com/letras.asp?letra=1053677",
      "k7pAyP6vRyQ": "https://www.musica.com/letras.asp?letra=1053706",
      "c8kLZMaaxpQ": "https://www.musica.com/letras.asp?letra=1054635",
      "voMVtKDgto4": "https://www.musica.com/letras.asp?letra=1054662",
      "csuFwPshrmE": "https://www.albumcancionyletra.com/letra/skaparapid/temps-perdut-50857"
    },
    "excluded": {
      "ylMypDE2ANk": "Frase en castellà: no compleix el criteri íntegrament en català.",
      "BX0XrZNyTVw": "Frase en castellà: no compleix el criteri íntegrament en català.",
      "WqBUlBHxCwI": "Final en castellà: no compleix el criteri íntegrament en català.",
      "LMuHaaNHxuQ": "Fragments en castellà a la lletra publicada; pendent de contrast amb l’enregistrament."
    },
    "aliases": []
  },
  {
    "name": "Es Reboster",
    "slug": "es-reboster",
    "territory": "Illes Balears",
    "place": "Santa Margalida",
    "placeAliases": [
      "Santa Margalida"
    ],
    "bounds": [
      39.65,
      39.8,
      3,
      3.2
    ],
    "subcategory": "ska-classic",
    "facets": [
      "ska",
      "reggae",
      "rock"
    ],
    "basis": "Banda nascuda a Santa Margalida amb base ska i reggae i influències pop-rock.",
    "source": "https://www.dbalears.cat/balears/cultura/2007/04/28/146584/es-reboster-presenta-sono-qui-musica-festiva-amb-lletres-de-pes.html",
    "channels": [
      {
        "id": "UCoEb3Xheb3cPwhNMFEhc_5g",
        "ids": "RauFHQdu0dU OkjLvp-hFPw rNKzMlPOj9U"
      }
    ],
    "lyricSources": {
      "RauFHQdu0dU": "https://www.youtube.com/watch?v=HLZRisGSnJY",
      "OkjLvp-hFPw": "https://www.youtube.com/watch?v=D2AU-ehbPqE"
    },
    "songSources": {
      "rNKzMlPOj9U": "https://angeletsdelaterra.com/public/les-angelets"
    },
    "aliases": []
  },
  {
    "name": "Maitips",
    "slug": "maitips",
    "territory": "Catalunya",
    "place": "Valls",
    "placeId": "geonames:3106492",
    "placeAliases": [
      "Valls"
    ],
    "subcategory": "reggae",
    "facets": [
      "reggae",
      "ska",
      "rock"
    ],
    "basis": "Grup de Valls amb arrels ska i evolució cap al reggae i el rock, segons la presentació del seu Bandcamp.",
    "source": "https://maitips.bandcamp.com/album/inventa-el-m-n",
    "channels": [
      {
        "id": "UCLOmT2Ut3zN8IFEtlSgUKmQ",
        "ids": "6Hr8olNd37U rVzp0C7d4P0 S9Ng3ED7gO8 u8Oqwz9a1MM hD90y2CLwR4 nqof8LP9Vpc oTI_JexoYwU aEZG1969Ev8 gmCHDuCQ6OE kYqxD0eJXiE 90ckY2sNHNU"
      }
    ],
    "lyricSources": {
      "6Hr8olNd37U": "https://maitips.bandcamp.com/album/inventa-el-m-n",
      "rVzp0C7d4P0": "https://maitips.bandcamp.com/album/inventa-el-m-n",
      "S9Ng3ED7gO8": "https://maitips.bandcamp.com/album/inventa-el-m-n",
      "u8Oqwz9a1MM": "https://maitips.bandcamp.com/album/inventa-el-m-n",
      "hD90y2CLwR4": "https://maitips.bandcamp.com/album/inventa-el-m-n",
      "nqof8LP9Vpc": "https://maitips.bandcamp.com/album/inventa-el-m-n",
      "oTI_JexoYwU": "https://maitips.bandcamp.com/album/inventa-el-m-n",
      "aEZG1969Ev8": "https://maitips.bandcamp.com/album/inventa-el-m-n",
      "gmCHDuCQ6OE": "https://maitips.bandcamp.com/album/inventa-el-m-n",
      "kYqxD0eJXiE": "https://maitips.bandcamp.com/album/inventa-el-m-n",
      "90ckY2sNHNU": "https://maitips.bandcamp.com/album/inventa-el-m-n"
    },
    "excluded": {
      "tRtRJE2ec-s": "Lletra en català i basc; exclosa pel criteri íntegrament en català."
    },
    "aliases": []
  }
];
const TARGETS = CONFIG.map(a=>a.name);
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
        const snapshot=read('docs/revisions/2026-10-14-ska2-'+a.slug+'.json');
        assert(!db.artists.some(x=>x.name===a.name),'Alta ja present: '+a.name);
        const place=await placeFor(a,origins);
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
                let v=found.videos.find(x=>x.id===id);
                if(c.external?.[id]) {
                    const ev=read('docs/revisions/2026-10-14-ska2-evidencies.json').videos.find(x=>x.id===id);
                    assert(ev?.snippet.channelId===c.external[id] && ev.snippet.description.includes('· '+a.name+' ·'),'Edició externa no acreditada');
                    v={id:ev.id,title:ev.snippet.title,embeddable:ev.status.embeddable,regionRestriction:ev.contentDetails.regionRestriction};
                }
                assert(v && v.embeddable && !v.regionRestriction?.blocked?.includes('ES') && (!v.regionRestriction?.allowed || v.regionRestriction.allowed.includes('ES')),'Vídeo no disponible: '+id);
                assert(!hidden.has(id) && !language.decisions?.some(d=>d.id===id&&d.accio==='amaga'),'Exclusió prèvia: '+id);
                if(!language.decisions.some(d=>d.id===id)) language.decisions.push({id,accio:'conserva',artista:a.name,titol:v.title,font:a.lyricSources[id]||a.songSources?.[id]||a.source,origen:REPORT,data:now,criteri:a.lyricSources[id]?'lletra-publicada':'seleccio-documental',lletraIntegraVerificada:!!a.lyricSources[id]});
                const decision={id,contentType:'song',title:v.title,note:'Edició discogràfica auto-generada seleccionada per ID. '+REPORT};
                const i=types.videos.findIndex(x=>x.id===id);
                if(i<0) types.videos.push(decision); else types.videos[i]={...types.videos[i],...decision};
            }
            allow.channels[c.id]={artist:a.name,allowedVideoIds:ids,allowedExternalVideos:c.external||{},acceptedMusicOnly:true,allowedContentTypes:['song'],note:'Només les peces de la selecció contrastada; novetats pendents de revisió. '+REPORT};
            origins.channels[c.id]=key; names.overrides[c.id]=a.name;
            channels.push({id:c.id,name:found.name,handle:found.handle,type:'topic',primary:channels.length===0});
            entry.channels.push({id:c.id,allowedVideoIds:ids,allowedExternalVideos:c.external||{}});
        }
        const selected=new Set(entry.channels.flatMap(c=>c.allowedVideoIds));
        language.pendents=(language.pendents||[]).filter(v=>!selected.has(v.id));
        for(const c of snapshot.channels) for(const v of c.videos) if(!selected.has(v.id)) {
            entry.notSelected.push({id:v.id,title:v.title,channelId:c.id,reason:a.excluded?.[v.id]||'Pendent de contrast lingüístic, format o duplicat; no publicat.'});
            if(a.channels.some(ch=>ch.id===c.id) && !language.pendents.some(p=>p.id===v.id)) language.pendents.push({id:v.id,artista:a.name,canalId:c.id,titol:v.title,tipus:'song',publicada:v.publishedAt.slice(0,10),afegida:now,descripcio:(a.excluded?.[v.id]||'No aprovat: manca contrast suficient de la peça o és una altra edició.')+' '+REPORT});
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
        for(const c of a.channels) for(const [id,uploader] of Object.entries(c.allowedExternalVideos||{})) {
            assert(all.some(v=>v.id===id && v.sourceChannelId===uploader),'Procedència externa perduda');
        }
        a.recordingsPublished=count; total+=count;
    }
    r.publication={checkedAt:new Date().toISOString(),artists:4,deferredArtists:0,recordings:total,status:'verified'};
    delete r.previousVideoIds;
    write(REPORT,r);
    console.log(JSON.stringify(r.publication));
}
(process.argv.includes('--verify')?Promise.resolve().then(verify):apply()).catch(e=>{console.error(e.stack);process.exitCode=1;});
