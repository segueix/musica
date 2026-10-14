'use strict';
// Consulta puntual de metadades públiques: no aprova ni incorpora cap enregistrament.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const OUT = 'docs/revisions/2026-10-14-ska2';
const norm = x => String(x || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const targets = [{"name":"Oprimits","slug":"oprimits","aliases":[],"queries":["\"Oprimits\" Topic","\"Oprimits\" música"]},{"name":"Skaparapid","slug":"skaparapid","aliases":[],"queries":["\"Skaparapid\" Topic","\"Skaparapid\" música"]},{"name":"Es Reboster","slug":"es-reboster","aliases":[],"queries":["\"Es Reboster\" Topic","\"Es Reboster\" música"]},{"name":"Maitips","slug":"maitips","aliases":[],"queries":["\"Maitips\" Topic","\"Maitips\" música"]}];
async function main() {
    const key = process.env.YOUTUBE_API_KEY_SERVER;
    assert(key, 'Falta la credencial de YouTube del projecte');
    let calls = 0;
    async function api(resource,args) {
        assert(++calls <= 150, 'Límit de consultes assolit');
        const u = new URL('https://www.googleapis.com/youtube/v3/'+resource);
        for(const [k,v] of Object.entries({...args,key})) if(v !== undefined) u.searchParams.set(k,String(v));
        const r = await fetch(u,{signal:AbortSignal.timeout(30000)});
        const j = await r.json();
        assert(r.ok, resource+': '+(j.error?.message || r.status));
        return j;
    }
    const ids='D2AU-ehbPqE,HLZRisGSnJY,rZV7LihcMhU,NhKPBq51wCc,smZoMUG5ohw,lpSKPXyyPtI';
    const videos=(await api('videos',{part:'snippet,contentDetails,status',id:ids})).items||[];
    const evidence={checkedAt:new Date().toISOString(),videos};
    evidence.channels=[];
    for(const c of (await api('channels',{part:'snippet,contentDetails',id:'UCRkcYFZB875HJysWmWSSexw'})).items||[]) {
        const p=await api('playlistItems',{part:'contentDetails',playlistId:c.contentDetails.relatedPlaylists.uploads,maxResults:50});
        const details=await api('videos',{part:'snippet,contentDetails,status',id:(p.items||[]).map(v=>v.contentDetails.videoId).join(',')});
        evidence.channels.push({id:c.id,name:c.snippet.title,handle:c.snippet.customUrl||null,description:c.snippet.description,complete:!p.nextPageToken,videos:details.items});
    }
    fs.writeFileSync(OUT+'-evidencies.json',JSON.stringify(evidence,null,2)+'\n');
    console.log(JSON.stringify({videos:videos.length,calls}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
