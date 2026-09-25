import { spawn } from 'node:child_process';
import path from 'node:path';
const stages=[['verify:fast','verify:runtime'],['verify:runtime','verify:visual'],['verify:visual',null]];
const npmArgs=['run'];
const npmCli=path.join(path.dirname(process.execPath),'node_modules','npm','bin','npm-cli.js');
const run=name=>new Promise(resolve=>{const child=process.platform==='win32'?spawn(process.execPath,[npmCli,...npmArgs,name],{stdio:'inherit',windowsHide:true}):spawn('npm',[...npmArgs,name],{stdio:'inherit'});child.on('error',error=>resolve({code:1,error}));child.on('close',code=>resolve({code:code??1}));});
for(let i=0;i<stages.length;i++){const[name]=stages[i];console.log(`\n=== ${name} ===`);const result=await run(name);console.log(`${result.code===0?'PASS':'FAIL'} ${name}${result.error?`: ${result.error.message}`:''}`);if(result.code!==0){for(const[skipped]of stages.slice(i+1))console.log(`SKIPPED ${skipped}`);process.exitCode=1;break;}}
