'use strict';
// No corregeix ni ignora errors: només admet diagnòstics idèntics sobre HEAD sense l’alta.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {spawnSync,execFileSync} = require('node:child_process');
const root = process.cwd();
const baseline = '/tmp/musica-abans-altes';
if(!fs.existsSync(baseline)) {
 execFileSync('git',['worktree','add','--detach',baseline,'HEAD'],{stdio:'inherit'});
 fs.symlinkSync(path.join(root,'node_modules'),path.join(baseline,'node_modules'),'dir');
}
function run(cwd,output) {
 const result = spawnSync(process.execPath,[path.join(root,'node_modules/eslint/bin/eslint.js'),'js/**/*.js','--format','json','--output-file',output],{cwd,stdio:'inherit'});
 assert(!result.error && result.status !== null && result.status < 2,'Fallada de l’executor de lint');
 const items = JSON.parse(fs.readFileSync(output,'utf8'));
 return items.map(item => ({file:path.relative(cwd,item.filePath),messages:item.messages,errorCount:item.errorCount,warningCount:item.warningCount})).sort((a,b)=>a.file.localeCompare(b.file));
}
const current = run(root,'/tmp/pepet-lint-current.json');
const old = run(baseline,'/tmp/pepet-lint-baseline.json');
assert.deepEqual(current,old,'Els diagnòstics de lint han canviat amb l’alta');
const result = {files:current.length,errors:current.reduce((n,v)=>n+v.errorCount,0),warnings:current.reduce((n,v)=>n+v.warningCount,0),baselineCompared:true,newDiagnostics:0};
fs.writeFileSync('/tmp/pepet-lint-summary.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
