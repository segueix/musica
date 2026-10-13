'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { spawnSync, execFileSync } = require('node:child_process');
const root = process.cwd(), baseline = '/tmp/musica-baseline-punk', base = process.argv[2];
assert(/^[a-f0-9]{40}$/.test(base), 'Cal el SHA exacte de la base revisada');
execFileSync('git', ['worktree', 'add', '--detach', baseline, base], { stdio: 'inherit' });
fs.symlinkSync(path.join(root, 'node_modules'), path.join(baseline, 'node_modules'), 'dir');
function run(cwd, tool, args, output) {
    const r = spawnSync(process.execPath, [path.join(root, 'node_modules', tool), ...args], {cwd, stdio:'inherit'});
    assert(!r.error && r.status !== null && r.status < 2, 'Executor fallit');
    return JSON.parse(fs.readFileSync(output, 'utf8'));
}
function test(cwd, suffix) {
    const out = '/tmp/punk-tests-' + suffix + '.json';
    return run(cwd, 'vitest/vitest.mjs', ['run','--reporter=json','--outputFile='+out], out);
}
function failures(report, cwd) {
    return report.testResults.flatMap(s => {
        const errors = s.assertionResults.filter(t => t.status === 'failed');
        assert(s.status !== 'failed' || errors.length, 'Error general de suite: '+s.name);
        return errors.map(t => ({suite:path.relative(cwd,s.name),test:t.fullName,
            messages:t.failureMessages.map(m => m.replace(/\u001b\[[0-9;]*m/g,'').split('\n')
                .filter(line => !/^\s+at\s/.test(line)).join('\n').split(cwd).join('<ROOT>'))}));
    }).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
const current = test(root,'current'), old = test(baseline,'baseline');
assert(current.numPassedTests > old.numPassedTests, 'Falten les proves noves');
assert.deepEqual(failures(current,root), failures(old,baseline), 'Regressió de proves');
function lint(cwd,suffix) {
    const out='/tmp/punk-lint-'+suffix+'.json';
    return run(cwd,'eslint/bin/eslint.js',['js/**/*.js','--format','json','--output-file',out],out)
        .filter(f=>f.messages.length).map(f=>({file:path.relative(cwd,f.filePath),messages:f.messages}))
        .sort((a,b)=>a.file.localeCompare(b.file));
}
const diagnostics=lint(root,'current');
assert.deepEqual(diagnostics,lint(baseline,'baseline'),'Regressió de lint');
const sandbox={SegueixApp:{features:{},utils:{},state:{}},console,localStorage:{getItem:()=>null}};
sandbox.window=sandbox;
for(const name of ['music-affinities','music-selection'])vm.runInNewContext(fs.readFileSync('js/features/'+name+'.js','utf8'),sandbox);
const A=sandbox.SegueixApp.features.musicAffinities, E=sandbox.SegueixApp.features.musicSelection;
const category='Punk';
const profiles=A.profilesFor(category);
const feed=JSON.parse(fs.readFileSync('data/feed.json','utf8'));
const ids=new Set(JSON.parse(fs.readFileSync('js/channels-ca.json','utf8')).channels.filter(c=>c.categories?.includes(category)).map(c=>c.id));
const artists=JSON.parse(fs.readFileSync('data/artistes-musica.json','utf8')).artists;
for(const profile of profiles){
    const owners=new Set();
    for(const id of profile.channelIds){
        const found=artists.filter(a=>a.youtube?.channels?.some(c=>c.id===id));
        assert.equal(found.length,1,'Identitat ambigua o absent: '+id);
        owners.add(found[0]);
    }
    assert.equal(owners.size,1,'Canals de diferents artistes: '+profile.artist);
}
const videos=feed.videos.filter(v=>ids.has(v.channelId)&&['song','live_song'].includes(v.contentType));
assert(videos.length>20,'No hi ha prou repertori per simular');
const artistKeyOf=v=>profiles.find(p=>p.channelIds.includes(v.channelId))?.artist||v.channelId;
const ctx=E.createContext({videos,now:Date.parse('2026-10-13T12:00:00Z'),artistKeyOf});
function rng(seed){let a=seed;return()=>{a=(Math.imul(a,1664525)+1013904223)>>>0;return a/4294967296;};}
const examples=[];
for(const p of profiles){
    const seed=videos.find(v=>p.channelIds.includes(v.channelId));if(!seed)continue;
    for(let n=1;n<=3;n++){
        const opts={ctx,seed,candidates:videos.filter(v=>v.id!==seed.id),category,count:20,signals:E.emptySignals()};
        const before=E.selectRadio({...opts,rng:rng(n),affinities:false}), after=E.selectRadio({...opts,rng:rng(n)});
        assert.equal(after.queue.length,before.queue.length,'Pèrdua de candidats');
        assert(after.queue.every(v=>ids.has(v.channelId)),'Sortida de categoria');
        assert.equal(new Set([seed,...after.queue].map(v=>v.id)).size,after.queue.length+1,'Duplicat');
        const metrics=result=>{const q=[seed,...result.queue];return{artists:new Set(q.map(artistKeyOf)).size,
            relaxedLevel:result.meta.relaxedLevel,affinity:q.slice(1).reduce((sum,v,i)=>sum+A.similarity(q[i],v),0)/result.queue.length};};
        examples.push({artist:p.artist,sample:n,before:metrics(before),after:metrics(after)});
    }
}
const avg=(side,key)=>examples.reduce((sum,x)=>sum+x[side][key],0)/examples.length;
const prior={SegueixApp:{features:{},utils:{},state:{}},console,localStorage:{getItem:()=>null}};
prior.window=prior;
for(const name of ['music-affinities','music-selection'])vm.runInNewContext(fs.readFileSync(path.join(baseline,'js/features/'+name+'.js'),'utf8'),prior);
const oldA=prior.SegueixApp.features.musicAffinities, oldE=prior.SegueixApp.features.musicSelection;
const unchangedSimulations = {};
for (const category of ['Ska / Reggae', 'Heavy / Metal']) {
    const oldProfiles = oldA.profilesFor(category);
    const comparable = list => JSON.stringify(list.map(({categories,...p})=>p));
    assert.equal(comparable(A.profilesFor(category)), comparable(oldProfiles), 'Canvi als perfils '+category);
    const ids = new Set(oldProfiles.flatMap(p=>p.channelIds));
    const videos = feed.videos.filter(v=>ids.has(v.channelId)&&['song','live_song'].includes(v.contentType));
    let checks=0;
    for(const p of oldProfiles){
        const seed=videos.find(v=>p.channelIds.includes(v.channelId));if(!seed)continue;
        const opts={seed,candidates:videos.filter(v=>v.id!==seed.id),category,count:20};
        const run=engine=>engine.selectRadio({...opts,ctx:engine.createContext({videos,now:Date.parse('2026-10-13T12:00:00Z')}),signals:engine.emptySignals(),rng:rng(42)}).queue.map(v=>v.id);
        assert.equal(JSON.stringify(run(E)),JSON.stringify(run(oldE)),'Regressió en una ràdio '+category);checks++;
    }
    assert(checks>0,'No s’ha comprovat '+category);
    unchangedSimulations[category]=checks;
}
const report={unchangedSimulations,base,checkedAt:new Date().toISOString(),profiles:profiles.length,catalogSongs:videos.length,
    profiledSongs:videos.filter(v=>A.profileOf(v)).length,passedTests:current.numPassedTests,
    unchangedFailedTests:current.numFailedTests,newFailures:0,lintFilesWithUnchangedDiagnostics:diagnostics.length,
    simulations:examples.length,before:{affinity:avg('before','affinity'),artists:avg('before','artists')},
    after:{affinity:avg('after','affinity'),artists:avg('after','artists')},
    caveat:'Afinitat editorial, no qualitat acústica comprovada amb escolta.',examples};
fs.writeFileSync('docs/revisions/2026-10-13-afinitats-punk.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,examples:undefined}));


