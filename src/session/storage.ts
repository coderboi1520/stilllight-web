import {validateSave,type SaveSnapshot} from './session.ts';
export const SAVE_KEY='stilllight.session.v1',BACKUP_KEY='stilllight.session.last-good.v1';
type StorageIO=Pick<Storage,'getItem'|'setItem'>;
export class SessionStore{
 error:string|null=null;
 recovery:'none'|'backup'|'new'='none';
 private io:StorageIO;
 private evidence:string|null=null;
 private readBlocked=false;
 constructor(io:StorageIO){this.io=io;}
 load():SaveSnapshot|undefined{
  try{
   const raw=this.io.getItem(SAVE_KEY);if(raw===null){const backup=this.io.getItem(BACKUP_KEY);if(backup){try{const state=validateSave(JSON.parse(backup));this.recovery='backup';this.error='Current save is missing. Last good progress is available for recovery.';return state;}catch{this.error='Last good save is unreadable. Its original bytes are preserved.';this.recovery='new';}}return;}
   try{return validateSave(JSON.parse(raw));}catch(e){this.evidence=raw;this.recovery='new';this.error=`Save needs recovery: ${(e as Error).message}. Original bytes are preserved.`;}
   const backup=this.io.getItem(BACKUP_KEY);if(backup){try{const s=validateSave(JSON.parse(backup));this.recovery='backup';this.error+=' Recovered last good progress in memory. Choose Recover save to resume saving.';return s;}catch{}}
   this.error+=' Playing in memory until you explicitly start a new save.';
  }catch{this.readBlocked=true;this.recovery='new';this.error='Storage unavailable: existing progress could not be read. Play in memory, then reload to recover it before choosing a new save.';}
 }
 save(snapshot:SaveSnapshot,acknowledgeRecovery=false):boolean{
  if(this.recovery!=='none'&&!acknowledgeRecovery)return false;
  try{
   const valid=JSON.stringify(validateSave(snapshot));
   const raw=this.io.getItem(SAVE_KEY);
   if(this.readBlocked&&raw!==null)this.evidence=raw;
   if(raw!==null){try{validateSave(JSON.parse(raw));}catch{this.evidence=raw;this.recovery='new';const backup=this.io.getItem(BACKUP_KEY);if(backup){try{validateSave(JSON.parse(backup));this.recovery='backup';}catch{}}this.error='Current save became unreadable. Original bytes are preserved; choose recovery before saving.';if(!acknowledgeRecovery)return false;}}
   // Preserve invalid current bytes before either valid slot can replace them.
   if(this.evidence!==null){this.io.setItem(`${SAVE_KEY}.evidence.${Date.now()}`,this.evidence);this.evidence=null;}
   // Preserve an invalid backup too, before the last-good slot is refreshed.
   const backup=this.io.getItem(BACKUP_KEY);if(backup!==null){if(this.readBlocked)this.io.setItem(`${BACKUP_KEY}.evidence.${Date.now()}`,backup);else try{validateSave(JSON.parse(backup));}catch{this.io.setItem(`${BACKUP_KEY}.evidence.${Date.now()}`,backup);}}
   this.io.setItem(SAVE_KEY,valid);this.io.setItem(BACKUP_KEY,valid);this.readBlocked=false;this.recovery='none';this.error=null;return true;
  }catch{this.error='Changes are kept in memory but could not be saved. Retry saving when storage is available.';return false;}
 }
}
