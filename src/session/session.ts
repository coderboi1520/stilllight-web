import {StilllightModel} from '../core/model.ts';
import {validateModelState,type ModelState} from '../core/modelState.ts';
import {isBottleComplete} from '../core/rules.ts';
import {COMMISSIONS,LEGACY_COMMISSIONS,TUTORIAL_ID,commission,levelIndex} from './content.ts';
import {newProduct,legacyProduct,validateProduct,balance,clearEvent,playEvent,type ProductState} from './product.ts';
export type ActiveSession={id:string;state:ModelState;hints:number;completed:boolean};
export type SaveSnapshot={version:2;awarded:string[];active:ActiveSession|null;product:ProductState};
type LegacySave={version:1;awarded:string[];active:ActiveSession|null};
const solved=(board:number[][])=>board.every(g=>!g.length||isBottleComplete(g));
function unlockIndex(p:ProductState){let i=p.tutorialWaived?1:0;while(i<30&&p.stars[COMMISSIONS[i].id])i++;return Math.min(29,Math.max(i,p.legacyUnlockThrough,...Object.keys(p.stars).map(id=>levelIndex(id)+1)));}
export function validateSave(value:unknown):SaveSnapshot{
 let s=value as SaveSnapshot;if(!s||![1,2].includes(s.version))throw Error('Unsupported save version');
 if((s as any).version===1){const old=s as unknown as LegacySave;if(!Array.isArray(old.awarded)||old.awarded.length>3||old.awarded.some((id,i)=>id!==LEGACY_COMMISSIONS[i].id))throw Error('Invalid restoration awards');
  if(old.active&&LEGACY_COMMISSIONS.findIndex(c=>c.id===old.active!.id)>old.awarded.length)throw Error('Locked legacy level');
  s={version:2,awarded:[...old.awarded],active:old.active,product:legacyProduct(old.awarded,old.active?.id)};
 }
 const p=validateProduct(s.product);
 if(!Array.isArray(s.awarded)||new Set(s.awarded).size!==s.awarded.length||s.awarded.length>30||s.awarded.some(id=>!p.stars[id])||Object.keys(p.stars).some(id=>!s.awarded.includes(id)))throw Error('Invalid clear awards');
 // A migrated save may have a waived tutorial; newer clears follow sequential unlocks.
 let previous=p.tutorialWaived?1:0;for(const id of s.awarded){const i=levelIndex(id);if(i>Math.max(previous,p.legacyUnlockThrough))throw Error('Locked award');previous=Math.max(previous,i+1);}
 if(s.active!==null){const a=s.active;if(!a||!Number.isInteger(a.hints)||a.hints<0||a.hints>10000||typeof a.completed!=='boolean')throw Error('Invalid active session');
  const c=commission(a.id);if(levelIndex(a.id)>unlockIndex(p)&&!p.stars[a.id])throw Error('Locked level');validateModelState(a.state,c.board);
  if(a.completed&&(!solved(a.state.board)||!s.awarded.includes(a.id)))throw Error('Invalid completion');
 }
 return structuredClone({...s,product:p});
}
export class GameSession{
 private data:SaveSnapshot;
 model:StilllightModel;
 id:string;
 isReplay=false;
 tutorialReplay=false;
 hints=0;
 completed=false;
 lastReward=0;
 constructor(saved?:SaveSnapshot|LegacySave){this.data=saved?validateSave(saved):{version:2,awarded:[],active:null,product:newProduct()};this.id=this.data.active?.id??COMMISSIONS[unlockIndex(this.data.product)].id;this.model=new StilllightModel(commission(this.id).board);this.restoreActive();}
 private restoreActive(){const a=this.data.active;this.isReplay=false;this.tutorialReplay=false;this.id=a?.id??COMMISSIONS[unlockIndex(this.product)].id;this.model=new StilllightModel(commission(this.id).board);if(a)this.model.restoreState(a.state);this.hints=a?.hints??0;this.completed=a?.completed??false;this.lastReward=0;}
 get product(){return this.data.product;}
 get coins(){return balance(this.product);}
 stars(id:string){return this.product.stars[id]??0;}
 get awarded(){return [...this.data.awarded];}
 get restorationCount(){return LEGACY_COMMISSIONS.filter(c=>this.data.awarded.includes(c.id)).length;}
 get campaignComplete(){return COMMISSIONS.every(c=>this.stars(c.id)||c.id===TUTORIAL_ID&&this.product.tutorialWaived);}
 get hasActive(){return this.data.active!==null;}
 unlocked(id:string){return this.stars(id)>0||levelIndex(id)<=unlockIndex(this.product);}
 snapshot():SaveSnapshot{if(!this.isReplay&&this.data.active)this.data.active={id:this.id,state:this.model.exportState(),hints:this.hints,completed:this.completed};return structuredClone(this.data);}
 start(){if(!this.data.active)this.data.active={id:this.id,state:this.model.exportState(),hints:0,completed:false};playEvent(this.product,this.id);}
 finish(){if(this.completed||this.model.isAnimating()||!solved(this.model.board))return false;this.completed=true;const fresh=!this.stars(this.id);clearEvent(this.product,this.id,this.model.moveCount);if(fresh)this.data.awarded.push(this.id);this.lastReward=fresh?25:0;return true;}
 next(){if(!this.completed)return;if(this.isReplay){this.home();return;}const index=levelIndex(this.id);if(index===29){this.home();return;}this.id=COMMISSIONS[index+1].id;this.model=new StilllightModel(commission(this.id).board);this.hints=0;this.completed=false;this.lastReward=0;this.data.active={id:this.id,state:this.model.exportState(),hints:0,completed:false};playEvent(this.product,this.id);}
 replay(id:string){if(!this.stars(id))throw Error('Replay locked');this.snapshot();this.id=id;this.model=new StilllightModel(commission(id).board);this.hints=0;this.completed=false;this.isReplay=true;this.lastReward=0;playEvent(this.product,id);}
 selectLevel(id:string){if(!this.unlocked(id))throw Error('Level locked');this.snapshot();if(this.stars(id)){this.replay(id);return;}if(this.data.active?.id===id){this.home();this.start();return;}if(!this.data.active||this.data.active.completed&&levelIndex(id)===unlockIndex(this.product)){this.id=id;this.model=new StilllightModel(commission(id).board);this.hints=0;this.completed=false;this.isReplay=false;this.tutorialReplay=false;this.lastReward=0;this.data.active={id,state:this.model.exportState(),hints:0,completed:false};this.start();return;}this.snapshot();this.id=id;this.model=new StilllightModel(commission(id).board);this.hints=0;this.completed=false;this.isReplay=true;this.lastReward=0;playEvent(this.product,id);}
 replayTutorial(){this.snapshot();this.id=TUTORIAL_ID;this.model=new StilllightModel(commission(this.id).board);this.hints=0;this.completed=false;this.isReplay=true;this.tutorialReplay=true;playEvent(this.product,this.id);}
 home(){this.snapshot();this.restoreActive();}
 restart(){this.model.reset();this.completed=false;this.hints=0;this.lastReward=0;}
}
