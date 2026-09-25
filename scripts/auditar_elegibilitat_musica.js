'use strict';

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(process.cwd(), 'data', 'artistes-musica.json');
const OUT_FILE = path.join(process.cwd(), 'data', 'artistes-musica-audit.json');
const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'Segueix-Musica/0.5 (https://segueix.cat)';
const CHUNK = 45;

function qidFromUri(uri) {
  const m=String(uri||'').match(/\/entity\/(Q\d+)$/);
  return m?m[1]:null;
}
function unique(values){return [...new Set((values||[]).filter(Boolean))];}
function label(binding,key){return binding?.[key]?.value||null;}

async function queryChunk(qids){
  const values=qids.map(q=>'wd:'+q).join(' ');
  const query=[
    'SELECT DISTINCT ?artist ?instance ?instanceLabel ?occupation ?occupationLabel ?musicOccupation ?musicType WHERE {',
    '  VALUES ?artist { '+values+' }',
    '  OPTIONAL { ?artist wdt:P31 ?instance. }',
    '  OPTIONAL { ?artist wdt:P106 ?occupation. }',
    '  OPTIONAL {',
    '    ?artist wdt:P106 ?musicOccupation.',
    '    { ?musicOccupation wdt:P279* wd:Q639669. }',
    '    UNION { VALUES ?musicOccupation { wd:Q639669 wd:Q177220 wd:Q488205 wd:Q2252262 wd:Q36834 wd:Q753110 } }',
    '  }',
    '  OPTIONAL {',
    '    ?artist wdt:P31 ?musicType.',
    '    { ?musicType wdt:P279* wd:Q2088357. }',
    '    UNION { VALUES ?musicType { wd:Q2088357 wd:Q42998 wd:Q131186 wd:Q215380 } }',
    '  }',
    '  SERVICE wikibase:label { bd:serviceParam wikibase:language "ca,en,es". }',
    '}'
  ].join('\n');

  const url=new URL(WIKIDATA_ENDPOINT);
  url.searchParams.set('query',query);
  url.searchParams.set('format','json');
  const response=await fetch(url,{headers:{Accept:'application/sparql-results+json','User-Agent':USER_AGENT}});
  if(!response.ok){
    const body=await response.text().catch(()=> '');
    throw new Error('Wikidata HTTP '+response.status+': '+body.slice(0,300));
  }
  const payload=await response.json();
  return payload.results?.bindings||[];
}

async function main(){
  const db=JSON.parse(fs.readFileSync(DB_FILE,'utf8'));
  const targets=db.artists.filter(a=>!(a.genres||[]).length && a.reviewStatus!=='rebutjat' && a.wikidataId);
  const byQid=new Map(targets.map(a=>[a.wikidataId,{
    name:a.name,
    wikidataId:a.wikidataId,
    musicbrainzId:a.musicbrainzId,
    sources:a.sources||[],
    youtubeChannels:(a.youtube?.channels||[]).length,
    instances:[],
    occupations:[],
    musicOccupations:[],
    musicTypes:[],
    verdict:'revisar',
    reasons:[]
  }]));

  for(let i=0;i<targets.length;i+=CHUNK){
    const qids=targets.slice(i,i+CHUNK).map(a=>a.wikidataId);
    const rows=await queryChunk(qids);
    for(const b of rows){
      const qid=qidFromUri(label(b,'artist'));
      const row=byQid.get(qid);
      if(!row) continue;
      const instance=label(b,'instanceLabel');
      const occupation=label(b,'occupationLabel');
      const musicOccupation=label(b,'musicOccupation');
      const musicType=label(b,'musicType');
      if(instance) row.instances.push(instance);
      if(occupation) row.occupations.push(occupation);
      if(musicOccupation) row.musicOccupations.push(musicOccupation);
      if(musicType) row.musicTypes.push(musicType);
    }
  }

  for(const row of byQid.values()){
    row.instances=unique(row.instances);
    row.occupations=unique(row.occupations);
    row.musicOccupations=unique(row.musicOccupations);
    row.musicTypes=unique(row.musicTypes);

    if(row.musicOccupations.length || row.musicTypes.length){
      row.verdict='musical-clar';
      if(row.musicOccupations.length) row.reasons.push('Wikidata: ocupació musical explícita');
      if(row.musicTypes.length) row.reasons.push('Wikidata: tipus de conjunt/entitat musical');
    } else if(row.youtubeChannels>0){
      row.verdict='revisar';
      row.reasons.push('Té canal YouTube confirmat però Wikidata no mostra ocupació/tipus musical');
    } else if(row.sources.includes('wikidata:performed-catalan-work')){
      row.verdict='revisar';
      row.reasons.push('Consta com a intèrpret d’obra en català però sense ocupació/tipus musical explícit');
    } else {
      row.verdict='possible-fals-positiu';
      row.reasons.push('Sense ocupació/tipus musical explícit ni canal confirmat');
    }
  }

  const rows=[...byQid.values()].sort((a,b)=>a.name.localeCompare(b.name,'ca',{sensitivity:'base'}));
  const summary={
    total:rows.length,
    musicalClar:rows.filter(r=>r.verdict==='musical-clar').length,
    revisar:rows.filter(r=>r.verdict==='revisar').length,
    possibleFalsPositiu:rows.filter(r=>r.verdict==='possible-fals-positiu').length
  };
  fs.writeFileSync(OUT_FILE,JSON.stringify({generatedAt:new Date().toISOString(),summary,artists:rows},null,2)+'\n');
  console.log('✅ Auditoria: '+summary.musicalClar+' musicals clars, '+summary.revisar+' per revisar, '+summary.possibleFalsPositiu+' possibles falsos positius.');
}

main().catch(error=>{console.error('❌ '+(error.stack||error.message));process.exit(1);});
