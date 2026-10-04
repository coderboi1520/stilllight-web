import {StilllightModel} from '../core/model.ts';
import {validateModelState,type ModelState} from '../core/modelState.ts';
import {isBottleComplete} from '../core/rules.ts';
import {COMMISSIONS,commission} from './content.ts';
export type ActiveSession={id:string;state:ModelState;hints:number;completed:boolean};
export type SaveSnapshot={version:1;awarded:string[];active:ActiveSession|null};
const solved=(board:number[][])=>board.every(g=>!g.length||isBottleComplete(g));
export function validateSave(value:unknown):SaveSnapshot{
 const s=value as SaveSnapshot;if(!s||s.version!==1)throw Error('Unsupported save version');
 if(!Array.isArray(s.awarded)||s.awarded.length>COMMISSIONS.length||s.awarded.some((id,i)=>id!==COMMISSIONS[i].id))throw Error('Invalid restoration awards');
 if(s.active!==null){const a=s.active;if(!a||!Number.isInteger(a.hints)||a.hints<0||typeof a.completed!=='boolean')throw Error('Invalid active session');
  const c=commission(a.id),index=COMMISSIONS.indexOf(c);if(index>s.awarded.length)throw Error('Locked commission');
  validateModelState(a.state,c.board);
  if(a.completed&&(!solved(a.state.board)||!s.awarded.includes(a.id)))throw Error('Invalid completion');
 }
 return structuredClone(s);
}
export class GameSession{
 private data:SaveSnapshot;
 model:StilllightModel;
 id:string;
 isReplay=false;
 hints=0;
 completed=false;
 constructor(saved?:SaveSnapshot){
  this.data=saved?validateSave(saved):{version:1,awarded:[],active:null};
  this.id=this.data.active?.id??COMMISSIONS[Math.min(this.data.awarded.length,2)].id;
  this.model=new StilllightModel(commission(this.id).board);this.restoreActive();
 }
 private restoreActive(){const a=this.data.active;this.isReplay=false;this.id=a?.id??COMMISSIONS[Math.min(this.data.awarded.length,2)].id;this.model=new StilllightModel(commission(this.id).board);if(a)this.model.restoreState(a.state);this.hints=a?.hints??0;this.completed=a?.completed??false;}
 get awarded(){return [...this.data.awarded];}
 get hasActive(){return this.data.active!==null;}
 snapshot():SaveSnapshot{if(!this.isReplay&&this.data.active)this.data.active={id:this.id,state:this.model.exportState(),hints:this.hints,completed:this.completed};return structuredClone(this.data);}
 start(){if(!this.data.active)this.data.active={id:this.id,state:this.model.exportState(),hints:0,completed:false};}
 finish(){if(this.completed||this.model.isAnimating()||!solved(this.model.board))return false;
  this.completed=true;if(!this.isReplay&&!this.data.awarded.includes(this.id))this.data.awarded.push(this.id);return true;
 }
 next(){if(!this.completed)return; if(this.isReplay){this.home();return;}
  const index=COMMISSIONS.findIndex(c=>c.id===this.id);if(index===2){this.home();return;}
  this.id=COMMISSIONS[index+1].id;this.model=new StilllightModel(commission(this.id).board);this.hints=0;this.completed=false;this.data.active={id:this.id,state:this.model.exportState(),hints:0,completed:false};
 }
 replay(id:string){if(!this.data.awarded.includes(id))throw Error('Replay locked');this.snapshot();this.id=id;this.model=new StilllightModel(commission(id).board);this.hints=0;this.completed=false;this.isReplay=true;}
 home(){this.snapshot();this.restoreActive();}
 restart(){this.model.reset();this.completed=false;this.hints=0;}
}
