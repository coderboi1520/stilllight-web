import {pour} from '../core/rules.ts';
export type InputState={board:number[][];selected:number|null;blocked:boolean;busy:boolean;undoRunning:boolean;undoDepth:number;canUndo:boolean;available:(index:number)=>boolean};
export class GameplayInput{
 private state:()=>InputState;private applyChoose:(index:number)=>void;private applyUndo:()=>boolean;
 private pendingChoose:{index:number;key:string;selected:number|null}|null=null;
 private pendingUndo:string|null=null;
 private prepareUndo:()=>void;
 constructor(state:()=>InputState,choose:(index:number)=>void,undo:()=>boolean,prepareUndo:()=>void=()=>{}){this.state=state;this.applyChoose=choose;this.applyUndo=undo;this.prepareUndo=prepareUndo;}
 choose(index:number):'accepted'|'queued'|'rejected'{
  const s=this.state();if(s.blocked||!Number.isInteger(index)||!s.board[index])return 'rejected';
  this.pendingUndo=null;
  if(s.available(index)){this.pendingChoose=null;this.applyChoose(index);return 'accepted';}
  const legal=s.selected===index||s.selected===null?s.board[index].length>0:!!pour(s.board,s.selected,index);
  if(!s.busy||!legal)return 'rejected';this.pendingChoose={index,key:JSON.stringify(s.board),selected:s.selected};return 'queued';
 }
 undo():'accepted'|'queued'|'rejected'{
  const s=this.state();if(s.blocked||s.undoDepth===0)return 'rejected';
  if(s.canUndo){this.pendingUndo=null;return this.applyUndo()?'accepted':'rejected';}
  if(!s.undoRunning&&s.busy)return 'rejected';this.pendingUndo=JSON.stringify(s.board);if(!s.undoRunning)this.prepareUndo();return 'queued';
 }
 flush(){
  const s=this.state();if(s.blocked){this.clear();return;}const key=JSON.stringify(s.board);
  if(this.pendingUndo!==null){if(this.pendingUndo!==key||s.undoDepth===0)this.pendingUndo=null;else if(s.canUndo){this.pendingUndo=null;this.applyUndo();return;}}
  const choice=this.pendingChoose;if(!choice)return;
  if(choice.key!==key||choice.selected!==s.selected){this.pendingChoose=null;return;}
  if(s.available(choice.index)){this.pendingChoose=null;this.applyChoose(choice.index);}
 }
 clear(){this.pendingChoose=null;this.pendingUndo=null;}
}
