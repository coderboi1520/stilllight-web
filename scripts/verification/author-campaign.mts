// Offline deterministic content authoring. No random runtime campaign or optimality claim.
import {writeFileSync} from 'node:fs';
import {solve} from '../../src/session/solver.ts';
import {ORDINARY_COMMISSION} from '../../src/core/ordinaryCommission.ts';
let seed=15202026;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const signature=(b:number[][])=>{let best='';const perm=(a:number[],used:number[])=>{if(!a.length){const k=b.map(g=>g.map(c=>used[c]).join('')).sort().join('|');if(!best||k<best)best=k;return;}for(const n of a)perm(a.filter(x=>x!==n),[...used,n]);};perm([0,1,2,3],[]);return best;};
const fixed=[[[0,0,1,1],[1,1,0,0],[]],[[0,0,1,1],[1,1,0,0],[],[],[],[]],[[0,0,1,1],[1,1,2,2],[2,2,0,0],[],[],[]],ORDINARY_COMMISSION];
const seen=new Set(fixed.map(signature));const entries=fixed.map(board=>({board,trace:solve(board).path}));
// Chapter one offers easier recovery after the inherited challenge; later chapters deepen interleaving.
for(let i=4;i<30;i++){
 const colors=i<7?2:i<15?3:4,min=i<7?4:i<10?5:i<15?7:i<20?9:i<25?11:13,max=min+3;
 let found=false;
 for(let attempt=0;attempt<4000;attempt++){
  const units=Array.from({length:colors*4},(_,k)=>Math.floor(k/4));for(let j=units.length-1;j>0;j--){const k=Math.floor(rand()*(j+1));[units[j],units[k]]=[units[k],units[j]];}
  const board=Array.from({length:colors+2},(_,k)=>k<colors?units.slice(k*4,k*4+4):[]),key=signature(board);if(seen.has(key))continue;
  const result=solve(board,18000);if(result.kind!=='solved'||result.path.length<min||result.path.length>max)continue;
  entries.push({board,trace:result.path});seen.add(key);found=true;break;
 }
 if(!found)throw Error(`No candidate ${i}`);
}
entries.splice(9,0,entries.splice(3,1)[0]);
writeFileSync('src/session/campaignBoards.ts',`// Authored deterministically offline; traces are legal completions, not claimed optimal targets.\nexport const CAMPAIGN_BOARDS=${JSON.stringify(entries,null,1)} as const;\n`);
writeFileSync('docs/progress/CAMPAIGN_SOLUTION_TRACES.json',JSON.stringify(entries.map((e,i)=>({level:i+1,id:i===0?'sl-first-ribbons':i===1?'ma-first-light':i===2?'ma-sill-reflection':i===9?'ma-moon-in-glass':`sl-${String(i+1).padStart(2,'0')}`,...e,moves:e.trace.length,searchBudget:i<3||i===9?60000:18000,claim:'legal completion trace; no mathematical optimality claim'})),null,2));
console.log(entries.map(e=>e.trace.length));
