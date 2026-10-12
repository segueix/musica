'use strict';
// Executa les proves sobre les dades preparades. Només tolera una fallada si
// el mateix test i el mateix missatge també fallen sobre HEAD sense les altes.
const fs = require('node:fs');
const path = require('node:path');
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
function signature(failure, cwd) {
    const message = failure.messages.join('\n').split(cwd).join('<ROOT>').replace(/\u001b\[[0-9;]*m/g,'');
    return JSON.stringify([failure.suite,failure.test,message]);
}
const current = runTests(root, output);
const errors = failures(current.report, root);
for (const error of errors) console.error(JSON.stringify(error));
const result = {passedTests:current.report.numPassedTests,totalTests:current.report.numTotalTests,
    failedTests:current.report.numFailedTests,failures:errors,regressions:errors.length,baselineCompared:false};
if (current.status !== 0) {
    if (!errors.length) throw new Error('Error general de l’executor de proves: no és segur publicar.');
    const suites = [...new Set(errors.map(e=>e.suite))];
    execFileSync('git',['worktree','add','--detach',baselineRoot,'HEAD'],{stdio:'inherit'});
    fs.symlinkSync(path.join(root,'node_modules'),path.join(baselineRoot,'node_modules'),'dir');
    const baseline = runTests(baselineRoot, baselineOutput, suites);
    const baselineErrors = failures(baseline.report, baselineRoot);
    const known = new Set(baselineErrors.map(e=>signature(e,baselineRoot)));
    const regressions = errors.filter(e=>!known.has(signature(e,root)));
    result.baselineCompared = true;
    result.baselineFailures = baselineErrors;
    result.regressions = regressions.length;
    console.log(JSON.stringify({baselineFailures:baselineErrors,regressions}));
}
fs.writeFileSync('/tmp/tardor-blat-quinto-validation.json',JSON.stringify(result,null,2)+'\n');
if (result.regressions) process.exitCode=1;
else console.log(JSON.stringify({passed:result.passedTests,unchangedFailures:result.failedTests,regressions:0}));
