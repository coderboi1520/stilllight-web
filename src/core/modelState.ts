import {clone,pour} from './rules.ts';
export type MoveRecord={source:number;target:number;color:number;amount:number;beforeSource:readonly number[];beforeTarget:readonly number[];afterSource:readonly number[];afterTarget:readonly number[]};
export type ModelState={board:number[][];history:MoveRecord[]};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function validateModelState(value:unknown,initial:number[][]):ModelState{
 const s=value as ModelState;
 if(!s||!Array.isArray(s.board)||s.board.length!==initial.length||!Array.isArray(s.history)||s.history.length>10000)throw Error('Invalid board/history shape');
 if(s.board.some(g=>!Array.isArray(g)||g.length>4||g.some(c=>!Number.isInteger(c)||c<0||c>3)))throw Error('Invalid capacity or palette');
 let board=clone(initial);
 for(const entry of s.history){
  if(!entry||!Number.isInteger(entry.source)||!Number.isInteger(entry.target))throw Error('Invalid history index');
  const r=pour(board,entry.source,entry.target);
  if(!r||r.amount!==entry.amount||r.color!==entry.color||!same(board[entry.source],entry.beforeSource)||!same(board[entry.target],entry.beforeTarget)||!same(r.board[entry.source],entry.afterSource)||!same(r.board[entry.target],entry.afterTarget))throw Error('History does not belong to this commission');
  board=r.board;
 }
 if(!same(board,s.board))throw Error('Board conservation/history mismatch');
 return structuredClone(s);
}
