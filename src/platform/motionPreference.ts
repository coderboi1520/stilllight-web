const KEY='stilllight.motion.reduced';
export function readReducedMotion():boolean{
  try{const value=localStorage.getItem(KEY);if(value==='true')return true;if(value==='false')return false;}catch{}
  return typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
}
export function writeReducedMotion(value:boolean):void{try{localStorage.setItem(KEY,String(value));}catch{}}
