import type {GameSession} from './session.ts';
import {TUTORIAL_ID} from './content.ts';
import {solve,type Pair} from './solver.ts';
import {pour} from '../core/rules.ts';
let cachedKey='',cachedPath:Pair[]=[];
export function tutorialGuide(session:GameSession):{target:number;text:string}|null{
 const m=session.model;if(session.id!==TUTORIAL_ID||session.completed||(m.busy||!!m.settleMotion)||!session.tutorialReplay&&(session.product.tutorialDismissed||session.product.tutorialWaived))return null;
 const key=JSON.stringify(m.board);if(key!==cachedKey){cachedKey=key;cachedPath=solve(m.board,10000).path;}
 const pair=cachedPath[0];if(!pair)return null;
 if(m.selected===null)return{target:pair[0],text:m.moveCount===0?'Tap this glass.':'Match the top color. Tap this glass.'};
 const candidate=cachedPath.find(([a,b])=>a===m.selected&&pour(m.board,a,b));
 if(candidate)return{target:candidate[1],text:m.board[candidate[1]].length?'Now tap the matching top color.':'Now tap the empty glass.'};
 for(let i=0;i<m.board.length;i++){const r=pour(m.board,m.selected,i);if(r&&solve(r.board,10000).kind==='solved')return{target:i,text:r.board[i].length===r.amount?'Now tap the empty glass.':'Now tap the matching top color.'};}
 return{target:pair[0],text:'Tap this glass to choose a helpful next move.'};
}
