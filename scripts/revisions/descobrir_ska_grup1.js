'use strict';
// Consulta puntual de metadades públiques: no aprova ni incorpora cap enregistrament.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const OUT = 'docs/revisions/2026-10-14-ska1';
const norm = x => String(x || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const targets = [
{name:'Ki Sap',slug:'ki-sap',aliases:['Ki-Sap','Ki Sap Official'],queries:['"Ki Sap" "A vora barranc"','"Ki Sap" reggae','"Ki Sap" Topic']},
{name:'Dekrèpits',slug:'dekrepits',aliases:['Dekrepits','dekrepitsTV'],queries:['"Dekrepits" Boletaires'],known:['UC0YqrtTHYipbZsG119z2k7g','UCKTrsy9eH-cD9geEnh2SB3w']}
];
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
    const base = JSON.parse(fs.readFileSync('data/artistes-musica.json','utf8'));
    const origins = JSON.parse(fs.readFileSync('data/origens-artistes.json','utf8'));
    const report = {checkedAt:new Date().toISOString(),artists:[]};
    for(const t of targets) {
        const names = new Set([t.name,...t.aliases].map(norm));
        const matchesName = n => names.has(norm(n).replace(/ (topic|tema|oficial|official|music|musica|tv)$/,''));
        const existing = base.artists.filter(a => [a.name,a.displayName,...(a.aliases || [])].some(matchesName));
        const ids = new Set([...(t.known || []),...existing.flatMap(a => a.youtube?.channels || []).map(c=>c.id)]);
        const results = [];
        for(const q of t.queries) {
            const found = await api('search',{part:'snippet',type:'video',q,maxResults:15});
            for(const v of found.items || []) {
                results.push({id:v.id.videoId,title:v.snippet.title,channelId:v.snippet.channelId,channelTitle:v.snippet.channelTitle});
                if(matchesName(v.snippet.channelTitle)) ids.add(v.snippet.channelId);
            }
        }
        assert(ids.size <= 8,'Cal separar homònims abans de continuar: '+t.name);
        const channels = ids.size ? (await api('channels',{part:'snippet,contentDetails',id:[...ids].join(',')})).items || [] : [];
        const entry = {name:t.name,slug:t.slug,existing,existingOrigins:Object.entries(origins.artists).filter(([,a])=>matchesName(a.name)),searchResults:results,channels:[]};
        const summary = ['# '+t.name,'',JSON.stringify({existing,existingOrigins:entry.existingOrigins}), '', '## Resultats de cerca',...results.map(v=>JSON.stringify(v))];
        for(const c of channels) {
            const videos = [];
            let token;
            for(let page=0;page<12;page++) {
                const p = await api('playlistItems',{part:'contentDetails',playlistId:c.contentDetails.relatedPlaylists.uploads,maxResults:50,pageToken:token});
                const videoIds = (p.items || []).map(v=>v.contentDetails.videoId);
                if(videoIds.length) {
                    const details = await api('videos',{part:'snippet,contentDetails,status',id:videoIds.join(',')});
                    for(const v of details.items || []) videos.push({id:v.id,title:v.snippet.title,description:v.snippet.description,channelId:v.snippet.channelId,publishedAt:v.snippet.publishedAt,duration:v.contentDetails.duration,embeddable:v.status.embeddable,regionRestriction:v.contentDetails.regionRestriction || null});
                }
                token = p.nextPageToken;
                if(!token) break;
            }
            entry.channels.push({id:c.id,name:c.snippet.title,handle:c.snippet.customUrl || null,description:c.snippet.description,avatar:c.snippet.thumbnails?.high?.url || '',complete:!token,videos});
            summary.push('\n## '+c.id+' | '+c.snippet.title+' | '+(c.snippet.customUrl || '')+' | '+videos.length+' vídeos | complet: '+!token,'',c.snippet.description || '','');
            for(const v of videos) {
                const lines = v.description.split('\n').map(x=>x.trim()).filter(Boolean);
                const album = /^Provided to YouTube/i.test(lines[0] || '') ? lines[2] : '';
                summary.push(v.id+' | '+v.title+' | '+v.duration+' | '+album);
            }
        }
        fs.writeFileSync(OUT+'-'+t.slug+'.md',summary.join('\n')+'\n');
        fs.writeFileSync(OUT+'-'+t.slug+'.json',JSON.stringify(entry,null,2)+'\n');
        report.artists.push({name:t.name,channels:entry.channels.map(c=>({id:c.id,name:c.name,handle:c.handle,count:c.videos.length,complete:c.complete}))});
    }
    report.calls = calls;
    fs.writeFileSync(OUT+'-descoberta.json',JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
