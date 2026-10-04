import {CATALOG,DEFAULT_EQUIPPED,cosmetic,type Category} from './catalog.ts';
import {LEGACY_COMMISSIONS,commission,levelIndex} from './content.ts';
import {GOAL_TARGETS,localDate,validDate,weekKey,type Day} from './goals.ts';
export const AVATARS=['moon','star','lily','orbit'] as const;
export const ACHIEVEMENTS=[{id:'first',name:'First light',description:'Complete your first level',target:1,reward:15},{id:'chapter',name:'Window keeper',description:'Complete ten levels',target:10,reward:25},{id:'journey',name:'Constellation',description:'Complete all thirty levels',target:30,reward:50},{id:'explorer',name:'Night wanderer',description:'Explore ten different levels',target:10,reward:20}] as const;
export type ProductState={stars:Record<string,number>;bestMoves:Record<string,number>;owned:string[];equipped:Record<Category,string>;name:string;avatar:string;achievementClaims:string[];days:Record<string,Day>;attendance:string[];weeklyClaims:string[];tutorialDismissed:boolean;tutorialWaived:boolean;legacyUnlockThrough:number};
export function newProduct():ProductState{return{stars:{},bestMoves:{},owned:CATALOG.filter(c=>!c.price).map(c=>c.id),equipped:{...DEFAULT_EQUIPPED},name:'Moonkeeper',avatar:'moon',achievementClaims:[],days:{},attendance:[],weeklyClaims:[],tutorialDismissed:false,tutorialWaived:false,legacyUnlockThrough:0};}
export function goalProgress(p:ProductState,date:string){const d=p.days[date]??{played:[],cleared:[],claimed:[]};return[d.cleared.length,d.cleared.reduce((sum,id)=>sum+new Set(commission(id).board.flat()).size,0),d.played.length];}
export function achievementProgress(p:ProductState,id:string){return id==='explorer'?new Set(Object.values(p.days).flatMap(d=>d.played)).size:Object.keys(p.stars).length;}
export function balance(p:ProductState){return Object.keys(p.stars).length*25+Object.values(p.days).reduce((n,d)=>n+d.claimed.length*10,0)+p.weeklyClaims.length*15+p.achievementClaims.reduce((n,id)=>n+ACHIEVEMENTS.find(a=>a.id===id)!.reward,0)-p.owned.reduce((n,id)=>n+cosmetic(id).price,0);}
const unique=(a:unknown)=>Array.isArray(a)&&new Set(a).size===a.length;
export function validateProduct(value:unknown):ProductState{
 const p=value as ProductState;if(!p||typeof p!=='object')throw Error('Missing product state');
 if(!p.stars||!p.bestMoves||typeof p.stars!=='object'||typeof p.bestMoves!=='object')throw Error('Invalid scores');
 for(const [id,n] of Object.entries(p.stars)){const c=commission(id);if(!Number.isInteger(n)||n<1||n>3||n>1&&(!Number.isInteger(p.bestMoves[id])||p.bestMoves[id]>c.target+(n===2?3:0)))throw Error('Invalid stars');}
 for(const [id,n] of Object.entries(p.bestMoves)){if(!p.stars[id]||!Number.isInteger(n)||n<0||n>10000)throw Error('Invalid personal best');}
 if(!unique(p.owned)||p.owned.length>CATALOG.length||!p.equipped)throw Error('Invalid ownership');
 p.owned.forEach(cosmetic);for(const category of ['background','cap','glass'] as const)if(!p.owned.includes(p.equipped[category])||cosmetic(p.equipped[category]).category!==category)throw Error('Invalid equipped item');
 if(CATALOG.some(c=>!c.price&&!p.owned.includes(c.id)))throw Error('Default cosmetic missing');
 if(typeof p.name!=='string'||p.name.length<1||p.name.length>24||/[<>\u0000-\u001f]/.test(p.name)||!AVATARS.includes(p.avatar as any))throw Error('Invalid profile');
 if(typeof p.tutorialDismissed!=='boolean'||typeof p.tutorialWaived!=='boolean'||!Number.isInteger(p.legacyUnlockThrough)||p.legacyUnlockThrough<0||p.legacyUnlockThrough>10)throw Error('Invalid compatibility state');
 if(!p.days||Array.isArray(p.days)||typeof p.days!=='object'||Object.keys(p.days).length>3660||!unique(p.attendance)||!unique(p.weeklyClaims)||!unique(p.achievementClaims))throw Error('Invalid goals');
 for(const [date,d] of Object.entries(p.days)){if(!validDate(date)||!d||!unique(d.played)||!unique(d.cleared)||!unique(d.claimed))throw Error('Invalid goal date');d.played.forEach(commission);if(d.cleared.some(id=>!d.played.includes(id)||!p.stars[id]))throw Error('Invalid clear event');const progress=goalProgress(p,date);if(d.claimed.some(i=>!Number.isInteger(i)||i<0||i>2||progress[i]<GOAL_TARGETS[i]))throw Error('Unearned daily claim');}
 if(p.attendance.some(d=>!validDate(d)||!p.days[d]))throw Error('Invalid attendance');
 if(p.weeklyClaims.some(w=>!validDate(w)||weekKey(w)!==w||p.attendance.filter(d=>weekKey(d)===w).length<3))throw Error('Unearned weekly claim');
 if(p.achievementClaims.some(id=>{const a=ACHIEVEMENTS.find(a=>a.id===id);return !a||achievementProgress(p,id)<a.target;}))throw Error('Unearned achievement');
 if(balance(p)<0)throw Error('Unaffordable ownership');return structuredClone(p);
}
export function attend(p:ProductState,date=localDate()){if(!p.days[date])p.days[date]={played:[],cleared:[],claimed:[]};if(!p.attendance.includes(date))p.attendance.push(date);return p.days[date];}
export function playEvent(p:ProductState,id:string,date=localDate()){const d=attend(p,date);if(!d.played.includes(id))d.played.push(id);}
export function clearEvent(p:ProductState,id:string,moves:number,date=localDate()){playEvent(p,id,date);const d=p.days[date];if(!d.cleared.includes(id))d.cleared.push(id);const stars=moves<=commission(id).target?3:moves<=commission(id).target+3?2:1;p.stars[id]=Math.max(p.stars[id]??0,stars);p.bestMoves[id]=Math.min(p.bestMoves[id]??Infinity,moves);}
export function claimDaily(p:ProductState,index:number,date=localDate()){const d=attend(p,date);if(index<0||index>2||!Number.isInteger(index)||d.claimed.includes(index)||goalProgress(p,date)[index]<GOAL_TARGETS[index])return false;d.claimed.push(index);return true;}
export function claimWeek(p:ProductState,date=localDate()){const w=weekKey(date);if(p.weeklyClaims.includes(w)||p.attendance.filter(d=>weekKey(d)===w).length<3)return false;p.weeklyClaims.push(w);return true;}
export function claimAchievement(p:ProductState,id:string){const a=ACHIEVEMENTS.find(a=>a.id===id);if(!a||p.achievementClaims.includes(id)||achievementProgress(p,id)<a.target)return false;p.achievementClaims.push(id);return true;}
export function buy(p:ProductState,id:string){const c=cosmetic(id);if(p.owned.includes(id)||balance(p)<c.price)return false;p.owned.push(id);return true;}
export function equip(p:ProductState,id:string){const c=cosmetic(id);if(!p.owned.includes(id))return false;p.equipped[c.category]=id;return true;}
export function legacyProduct(awarded:string[],activeId?:string){const p=newProduct();p.tutorialWaived=true;p.legacyUnlockThrough=Math.max(awarded.length===3?10:levelIndex(LEGACY_COMMISSIONS[awarded.length].id),activeId?levelIndex(activeId):1);for(const id of awarded)p.stars[id]=1;return p;}
