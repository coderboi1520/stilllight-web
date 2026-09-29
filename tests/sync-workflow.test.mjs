import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const script=fileURLToPath(new URL('../Sync STILLLIGHT.cmd',import.meta.url));
const SHA='dd2cbbee3c6bbcc10ce2ccc6beffca96cb67e862';
function run(scenario){
  const dir=mkdtempSync(path.join(tmpdir(),'stilllight-sync-test-')),log=path.join(dir,'calls.txt');
  // All Git invocations are intercepted; these failure cases never change a real checkout.
  const responses=[
    ['rev-parse --show-toplevel',scenario==='wrong-root'?'D:/OTHER':'D:/STILLLIGHT'],
    ['remote get-url origin',scenario==='wrong-origin'?'https://github.com/other/project.git':'https://github.com/coderboi1520/stilllight-web.git'],
    ['status --porcelain --untracked-files=normal',scenario==='dirty'?' M user.txt':'',scenario==='status-failure'?1:0],
    ['status --porcelain',scenario==='dirty'?' M user.txt':'',scenario==='status-failure'?1:0],
    ['fetch origin','',scenario==='fetch-failure'?1:0],
    ['switch main','',scenario==='switch-failure'?1:0],
    ['pull --ff-only origin main','',scenario==='pull-failure'?1:0],
    ['rev-parse HEAD',scenario==='ahead'?'1111111111111111111111111111111111111111':SHA],
    ['rev-parse origin/main',SHA],
    ['status --short',''],['status --short --branch',''],['log -1 --oneline',`${SHA.slice(0,7)} main`]
  ];
  const stub=['@echo off','>>"%SYNC_TEST_LOG%" echo %*',...responses.map(([command,output,code=0])=>`if "%*"=="${command}" (\n${output?`echo ${output}\n`:''}exit /b ${code}\n)`),'exit /b 97'].join('\r\n');
  writeFileSync(path.join(dir,'git.cmd'),stub);
  try{
    const result=spawnSync(process.env.ComSpec||'cmd.exe',['/d','/s','/c',`""${script}""`],{
      cwd:path.dirname(script),encoding:'utf8',input:'\n',timeout:10000,windowsHide:true,windowsVerbatimArguments:true,
      env:{...process.env,PATH:`${dir};${process.env.PATH}`,SYNC_TEST_LOG:log}
    });
    assert.ifError(result.error);
    assert.ok(existsSync(log),result.stdout+result.stderr);
    const calls=readFileSync(log,'utf8').trim().split(/\r?\n/);
    return{...result,calls,output:result.stdout+result.stderr};
  }finally{
    assert.equal(path.dirname(path.resolve(dir)),path.resolve(tmpdir()));
    assert.ok(path.basename(dir).startsWith('stilllight-sync-test-'));
    rmSync(dir,{recursive:true,force:true});
  }
}
const windows={skip:process.platform!=='win32'};
test('Sync verifies the expected repository, updates main, and prints the exact remote SHA',windows,()=>{
  const result=run('clean');assert.equal(result.status,0,result.output);
  const ordered=['rev-parse --show-toplevel','remote get-url origin','fetch origin','switch main','pull --ff-only origin main','rev-parse HEAD','rev-parse origin/main'];
  let previous=-1;for(const command of ordered){const i=result.calls.indexOf(command);assert.ok(i>previous,`${command}: ${result.calls}`);previous=i;}
  assert.ok(result.output.includes(`Main SHA: ${SHA}`),result.output);
});
for(const scenario of ['dirty','wrong-root','wrong-origin','status-failure']){
  test(`Sync refuses ${scenario} before fetching or switching`,windows,()=>{
    const result=run(scenario);assert.notEqual(result.status,0,`${JSON.stringify(result.calls)}\n${result.output}`);
    assert.ok(!result.calls.includes('fetch origin'),result.calls.join('\n'));
    assert.ok(!result.calls.includes('switch main'));
  });
}
for(const [scenario,blocked] of [['fetch-failure','switch main'],['switch-failure','pull --ff-only origin main'],['pull-failure','rev-parse HEAD']]){
  test(`Sync stops after ${scenario} without proceeding`,windows,()=>{
    const result=run(scenario);assert.notEqual(result.status,0,result.output);assert.ok(!result.calls.includes(blocked));
  });
}
test('Sync rejects a clean local main ahead of origin/main',windows,()=>{
  const result=run('ahead');assert.notEqual(result.status,0,result.output);assert.match(result.output,/HEAD|origin\/main/i);
});
