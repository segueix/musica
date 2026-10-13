'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { spawnSync, execFileSync } = require('node:child_process');
const root = process.cwd(), baseline = '/tmp/musica-baseline-cobertura', base = process.argv[2];
assert(/^[a-f0-9]{40}$/.test(base), 'Cal el SHA exacte de la base revisada');
execFileSync('git', ['worktree', 'add', '--detach', baseline, base], { stdio: 'inherit' });
fs.symlinkSync(path.join(root, 'node_modules'), path.join(baseline, 'node_modules'), 'dir');
function run(cwd, tool, args, output) {
    const r = spawnSync(process.execPath, [path.join(root, 'node_modules', tool), ...args], {cwd, stdio:'inherit'});
    assert(!r.error && r.status !== null && r.status < 2, 'Executor fallit');
    return JSON.parse(fs.readFileSync(output, 'utf8'));
}
function test(cwd, suffix) {
    const out = '/tmp/cobertura-tests-' + suffix + '.json';
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
    const out='/tmp/cobertura-lint-'+suffix+'.json';
    return run(cwd,'eslint/bin/eslint.js',['js/**/*.js','--format','json','--output-file',out],out)
        .filter(f=>f.messages.length).map(f=>({file:path.relative(cwd,f.filePath),messages:f.messages}))
        .sort((a,b)=>a.file.localeCompare(b.file));
}
const diagnostics=lint(root,'current');
assert.deepEqual(diagnostics,lint(baseline,'baseline'),'Regressió de lint');
const sandbox={SegueixApp:{features:{},utils:{},state:{}},console,localStorage:{getItem:()=>null}};
sandbox.window=sandbox;
for(const name of ['music-affinity-catalog','music-affinities','music-selection'])vm.runInNewContext(fs.readFileSync('js/features/'+name+'.js','utf8'),sandbox);
const A=sandbox.SegueixApp.features.musicAffinities,E=sandbox.SegueixApp.features.musicSelection;
const feed=JSON.parse(fs.readFileSync('data/feed.json','utf8'));
const oldFeed=JSON.parse(fs.readFileSync(path.join(baseline,'data/feed.json'),'utf8'));
const strip=v=>{const{categories,genres,...rest}=v;return rest;};
assert.deepEqual(feed.videos.map(strip),oldFeed.videos.map(strip),'El canvi ha alterat repertori o altres metadades');
const owner=new Map(A.profiles.flatMap(p=>p.channelIds.map(id=>[id,p.artist])));
const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const checks=[];
let knockoutsRadios=0,skaRadios=0;
for(const category of A.enabledCategories){
    const videos=feed.videos.filter(v=>v.categories?.includes(category)&&['song','live_song'].includes(v.contentType));
    if(videos.length<2)continue;
    const ctx=E.createContext({videos,now:Date.parse('2026-10-13T18:00:00Z'),artistKeyOf:v=>owner.get(v.channelId)||v.channelId});
    const seeds=A.profilesFor(category).map(p=>videos.find(v=>p.channelIds.includes(v.channelId))).filter(Boolean);
    for(const [index,seed] of seeds.entries()){
        const opts={ctx,seed,candidates:videos.filter(v=>v.id!==seed.id),category,count:39,signals:E.emptySignals()};
        const before=E.selectRadio({...opts,rng:rng(index+1),affinities:false});
        const after=E.selectRadio({...opts,rng:rng(index+1)});
        assert.equal(after.queue.length,before.queue.length,'Pèrdua de candidats: '+category);
        assert(after.queue.every(v=>v.categories.includes(category)),'Sortida de categoria');
        assert.equal(new Set([seed,...after.queue].map(v=>v.id)).size,after.queue.length+1,'Duplicat');
        if(category==='Ska / Reggae'&&owner.get(seed.channelId)!=='knocKouts'){
            skaRadios++;if(after.queue.some(v=>owner.get(v.channelId)==='knocKouts'))knockoutsRadios++;
        }
        checks.push({category,seed:owner.get(seed.channelId),songs:after.queue.length,
            artists:new Set([seed,...after.queue].map(v=>owner.get(v.channelId))).size});
    }
}
assert(knockoutsRadios>0,'Knockouts no entra en cap ràdio Ska simulada');
const report=JSON.parse(fs.readFileSync('data/music-affinity-coverage.json','utf8'));
Object.assign(report,{base,passedTests:current.numPassedTests,unchangedFailedTests:current.numFailedTests,newFailures:0,
    unchangedLintFiles:diagnostics.length,simulations:checks.length,skaRadios,knockoutsRadios,checks});
fs.writeFileSync('docs/revisions/2026-10-13-cobertura-afinitats.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,checks:undefined}));
