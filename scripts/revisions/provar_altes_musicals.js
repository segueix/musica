'use strict';
// Només tolera fallades amb el mateix test i el mateix missatge a HEAD sense altes.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {spawnSync, execFileSync} = require('node:child_process');
const root = process.cwd();
const output = '/tmp/tardor-blat-quinto-tests.json';
const baselineRoot = '/tmp/musica-abans-altes';
const baselineOutput = '/tmp/tardor-blat-quinto-baseline-tests.json';
function runTests(cwd, file, suites = []) {
    const result = spawnSync(process.execPath, [path.join(root,'node_modules/vitest/vitest.mjs'), 'run', ...suites, '--reporter=json', '--outputFile='+file], {cwd,stdio:'inherit'});
    if (result.error) throw result.error;
    if (!fs.existsSync(file)) throw new Error('Les proves no han generat l’informe: '+file);
    return {status:result.status, report:JSON.parse(fs.readFileSync(file,'utf8'))};
}
function failures(report, cwd) {
    const found = [];
    for (const suite of report.testResults || []) {
        const name = path.relative(cwd, suite.name);
        const assertions = (suite.assertionResults || []).filter(t=>t.status==='failed');
        for (const t of assertions) found.push({suite:name, test:t.fullName || t.title, messages:t.failureMessages || []});
        if (suite.status==='failed' && !assertions.length) found.push({suite:name, test:'[suite]', messages:[suite.message || 'Suite failed without assertions']});
    }
    return found;
}
function signature(failure) {
    // node_modules és un enllaç compartit: les traces de tots dos entorns poden
    // contenir tots dos camins. Es normalitzen les ubicacions, no les assercions.
    let message = failure.messages.join('\n').replace(/\u001b\[[0-9;]*m/g,'');
    for (const location of [baselineRoot, root]) message = message.split(location).join('<ROOT>');
    return JSON.stringify([failure.suite,failure.test,message]);
}
// Un error antic en un títol aliè no ha d’amagar un error nou de les altes.
const feed = JSON.parse(fs.readFileSync('data/feed.json','utf8'));
const report = JSON.parse(fs.readFileSync('docs/revisions/2026-10-12-tardor-blat-quinto.json','utf8'));
const {cleanTitle} = require('../../js/song-title.js');
for (const artist of report.artists) for (const channel of artist.channels) {
    const archiveFile = 'data/archive/channels/'+channel.id+'.json';
    const archive = fs.existsSync(archiveFile) ? JSON.parse(fs.readFileSync(archiveFile,'utf8')).videos : [];
    const metadata = feed.channels[channel.id] || {};
    for (const video of [...archive,...feed.videos.filter(v=>v.channelId===channel.id)]) {
        const title = cleanTitle(video.title,{artists:[video.channelTitle,metadata.name,artist.name].filter(Boolean)});
        assert(title.trim(),'Títol buit: '+video.id);
        assert(!/[([{][^()[\]{}]*(video|vídeo|oficial|official)[^()[\]{}]*[)\]}]/i.test(title),'Marca promocional en un títol nou: '+video.id+' '+title);
    }
}
const current = runTests(root, output);
const errors = failures(current.report, root);
for (const error of errors) console.error(JSON.stringify(error));
const result = {passedTests:current.report.numPassedTests,totalTests:current.report.numTotalTests,
    failedTests:current.report.numFailedTests,failures:errors,regressions:errors.length,baselineCompared:false,newTitles:'passed'};
if (current.status !== 0) {
    if (!errors.length) throw new Error('Error general de l’executor de proves: no és segur publicar.');
    const suites = [...new Set(errors.map(e=>e.suite))];
    execFileSync('git',['worktree','add','--detach',baselineRoot,'HEAD'],{stdio:'inherit'});
    fs.symlinkSync(path.join(root,'node_modules'),path.join(baselineRoot,'node_modules'),'dir');
    const baseline = runTests(baselineRoot, baselineOutput, suites);
    const baselineErrors = failures(baseline.report, baselineRoot);
    const known = new Set(baselineErrors.map(signature));
    const regressions = errors.filter(e=>!known.has(signature(e)));
    result.baselineCompared = true;
    result.baselineFailures = baselineErrors;
    result.regressions = regressions.length;
    console.log(JSON.stringify({baselineFailures:baselineErrors,regressions}));
}
const compact = e=>({suite:e.suite,test:e.test,reason:e.messages.join('\n').split('\n')[0]});
result.failures = result.failures.map(compact);
if (result.baselineFailures) result.baselineFailures = result.baselineFailures.map(compact);
fs.writeFileSync('/tmp/tardor-blat-quinto-validation.json',JSON.stringify(result,null,2)+'\n');
if (result.regressions) process.exitCode=1;
else console.log(JSON.stringify({passed:result.passedTests,unchangedFailures:result.failedTests,regressions:0}));
