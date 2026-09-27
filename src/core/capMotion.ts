import {smooth} from './geometry.ts';
import type {CapFrame} from './RenderFrame.ts';

export const CAP_ENTER_MS=250,CAP_EXIT_MS=125,CAP_SEAT_Y=1;
export type CapMotion={kind:'enter';started:number}|{kind:'exit';started:number;from:CapFrame};

export function sampleCap(complete:boolean,motion:CapMotion|null,now:number,out:CapFrame):CapFrame{
  out.visible=complete;out.alpha=1;out.y=CAP_SEAT_Y;out.scaleX=1;out.scaleY=1;out.rotation=0;
  if(!motion)return out;
  const elapsed=Math.max(0,now-motion.started);
  if(motion.kind==='exit'){
    if(elapsed>=CAP_EXIT_MS){out.visible=false;return out;}
    const p=smooth(elapsed/CAP_EXIT_MS);
    out.visible=true;out.y=motion.from.y-4*p;out.scaleX=motion.from.scaleX*(1-.07*p);out.scaleY=motion.from.scaleY*(1-.07*p);out.alpha=motion.from.alpha*(1-p);
    return out;
  }
  out.visible=true;
  if(elapsed>=CAP_ENTER_MS)return out;
  if(elapsed<=85){const p=elapsed/85,e=p*p;out.y=CAP_SEAT_Y-11*(1-e);out.scaleX=out.scaleY=.93+.07*e;out.alpha=smooth(elapsed/42);}
  else if(elapsed<=145){const p=smooth((elapsed-85)/60);out.y=CAP_SEAT_Y+p;out.scaleX=1+.022*p;out.scaleY=1-.022*p;}
  else if(elapsed<=195){const p=smooth((elapsed-145)/50);out.y=CAP_SEAT_Y+1-3*p;out.scaleX=1.022-.03*p;out.scaleY=.978+.032*p;}
  else{const p=smooth((elapsed-195)/55);out.y=CAP_SEAT_Y-2*(1-p);out.scaleX=.992+.008*p;out.scaleY=1.01-.01*p;}
  return out;
}
