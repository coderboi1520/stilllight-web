export type Day={played:string[];cleared:string[];claimed:number[]};
export const GOAL_LABELS=['Complete a level','Settle three full glasses','Explore two levels'];
export const GOAL_TARGETS=[1,3,2];
export function localDate(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function validDate(s:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(`${s}T12:00:00`);return Number.isFinite(+d)&&localDate(d)===s;}
export function weekKey(day:string){const d=new Date(`${day}T12:00:00`);d.setDate(d.getDate()-((d.getDay()+6)%7));return localDate(d);}
