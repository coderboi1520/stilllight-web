import {clone,isBottleComplete,pour} from '../core/rules.ts';
export type Pair=[number,number];
export type SolveResult={kind:'solved'|'blocked'|'unknown';path:Pair[];visited:number};
// Finite forward search, quotienting vessel permutations. Skipping a uniform
// vessel into empty space only removes symmetric states, not useful pours.
export function solve(initial:number[][],budget=60000):SolveResult{
 const key=(b:number[][])=>b.map(g=>g.join('')).sort().join('|');
 const queue:{board:number[][];path:Pair[]}[]=[{board:clone(initial),path:[]}],seen=new Set([key(initial)]);
 let index=0;
 while(index<queue.length){
  if(index>=budget)return{kind:'unknown',path:[],visited:index};
  const {board,path}=queue[index++];
  if(board.every(g=>!g.length||isBottleComplete(g)))return{kind:'solved',path,visited:index};
  for(let s=0;s<board.length;s++)for(let d=0;d<board.length;d++){
   const r=pour(board,s,d);if(!r)continue;
   if(!board[d].length&&board[s].every(c=>c===board[s][0]))continue;
   const k=key(r.board);if(seen.has(k))continue;seen.add(k);queue.push({board:r.board,path:[...path,[s,d]]});
  }
 }
 return{kind:'blocked',path:[],visited:index};
}
