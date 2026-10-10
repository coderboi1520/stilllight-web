import {smooth} from './geometry.ts';
import type {CapFrame,CompletionFrame} from './RenderFrame.ts';

export const CAP_ENTER_MS=450,CAP_EXIT_MS=180,CAP_SEAT_Y=16,CAP_FIRST_IMPACT_MS=210,COMPLETION_FX_MS=750;
const DROP_HEIGHT=45,GRAVITY=2*DROP_HEIGHT/(CAP_FIRST_IMPACT_MS/1000)**2,RESTITUTION=.4;
const IMPACT_VELOCITY=GRAVITY*CAP_FIRST_IMPACT_MS/1000;
const FIRST_BOUNCE_VELOCITY=IMPACT_VELOCITY*RESTITUTION,SECOND_BOUNCE_VELOCITY=FIRST_BOUNCE_VELOCITY*RESTITUTION;
const SECOND_CONTACT_MS=CAP_FIRST_IMPACT_MS+2000*FIRST_BOUNCE_VELOCITY/GRAVITY;
const FINAL_CONTACT_MS=SECOND_CONTACT_MS+2000*SECOND_BOUNCE_VELOCITY/GRAVITY;
const BUBBLE_X=[-17,-6,7,18],BUBBLE_Y=[72,92,58,105];
export type CapMotion={kind:'enter';started:number}|{kind:'exit';started:number;from:CapFrame};
export type CompletionMotion={impactAt:number;color:number;recorded:boolean};

export function completionWaveAt(motion:CompletionMotion|null,now:number){
  if(!motion)return 0;
  const t=now-motion.impactAt;
  return t<0||t>=500?0:1.8*Math.exp(-t/180)*(1-smooth((t-380)/120));
}

export function sampleCompletion(motion:CompletionMotion|null,now:number,out:CompletionFrame):CompletionFrame{
  out.recoilY=0;out.color=motion?.color??0;
  for(const p of out.particles)p.visible=false;
  if(!motion)return out;
  const t=now-motion.impactAt;
  if(t<0||t>=COMPLETION_FX_MS)return out;
  // A short critically damped displacement, peaked after the contact impulse.
  out.recoilY=t>=200?0:1.7*(t/35)*Math.exp(1-t/35)*(1-smooth((t-150)/50));
  const seconds=t/1000;
  for(let i=0;i<8;i++){
    const side=i%2?1:-1,lane=Math.floor(i/2),life=350+lane*80;
    if(t>=life)continue;
    const p=out.particles[i],q=t/life;
    p.visible=true;p.bubble=false;p.x=side*(8+lane*6+(18+lane*12)*seconds);
    p.y=-2+(lane%2)*3-(50+lane*15)*seconds+50*seconds*seconds;
    p.radius=1.25*(1.8+lane*.15)*(1-.55*q);p.alpha=.9*(1-q);
  }
  for(let i=0;i<4;i++){
    const life=430+i*55;
    if(t>=life)continue;
    const p=out.particles[8+i],q=t/life;
    p.visible=true;p.bubble=true;p.x=BUBBLE_X[i]+Math.sin(t*.013+i)*1.8;
    p.y=BUBBLE_Y[i]-(24+i*5)*seconds;
    p.radius=(1.5+i*.18)*(1-.35*q);p.alpha=.42*(1-q);
  }
  return out;
}

export function sampleCap(complete:boolean,motion:CapMotion|null,now:number,out:CapFrame):CapFrame{
  out.visible=complete;out.alpha=1;out.y=CAP_SEAT_Y;out.scaleX=1;out.scaleY=1;out.rotation=0;
  if(!motion)return out;
  const elapsed=Math.max(0,now-motion.started);
  if(motion.kind==='exit'){
    if(elapsed>=CAP_EXIT_MS){out.visible=false;return out;}
    const p=smooth(elapsed/CAP_EXIT_MS);
    out.visible=true;out.y=motion.from.y-9*p;out.scaleX=motion.from.scaleX*(1-.12*p);out.scaleY=motion.from.scaleY*(1-.12*p);out.rotation=motion.from.rotation*(1-p);out.alpha=motion.from.alpha*(1-p);
    return out;
  }
  out.visible=true;
  if(elapsed>=CAP_ENTER_MS)return out;
  // Gravity and both collision velocities are derived from the same impact speed.
  if(elapsed<CAP_FIRST_IMPACT_MS){const t=elapsed/1000;out.y=CAP_SEAT_Y-DROP_HEIGHT+.5*GRAVITY*t*t;}
  else if(elapsed<SECOND_CONTACT_MS){const t=(elapsed-CAP_FIRST_IMPACT_MS)/1000;out.y=CAP_SEAT_Y-FIRST_BOUNCE_VELOCITY*t+.5*GRAVITY*t*t;}
  else if(elapsed<FINAL_CONTACT_MS){const t=(elapsed-SECOND_CONTACT_MS)/1000;out.y=CAP_SEAT_Y-SECOND_BOUNCE_VELOCITY*t+.5*GRAVITY*t*t;}
  const afterContact=elapsed-CAP_FIRST_IMPACT_MS;
  if(afterContact>=0){
    if(afterContact<42){const pulse=Math.sin(Math.PI*afterContact/42);out.scaleX=1+.008*pulse;out.scaleY=1-.012*pulse;}
    out.rotation=IMPACT_VELOCITY*.00003*Math.sin(afterContact/35)*Math.exp(-afterContact/95)*(1-smooth((afterContact-150)/85));
  }
  return out;
}
