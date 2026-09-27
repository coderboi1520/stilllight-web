import {GLASS_BOTTOM,SURFACE_MAX_X,SURFACE_MIN_X,SURFACE_SAMPLES} from './constants.ts';
import type {GlassFrame,SurfaceContact} from './RenderFrame.ts';

const CONTACT_OFFSET=8;

export function prepareSurfaceContact(glass:GlassFrame,direction:number,out:SurfaceContact){
  const x=-direction*CONTACT_OFFSET,top=glass.layers.at(-1);
  let y=GLASS_BOTTOM,tx=1,ty=0;
  out.empty=!top;
  if(top){
    y=top.top;
    if(top.wavy&&top.surface){
      const samples=top.surface,step=(SURFACE_MAX_X-SURFACE_MIN_X)/(SURFACE_SAMPLES-1);
      const left=Math.max(0,Math.min(SURFACE_SAMPLES-2,Math.floor((x-SURFACE_MIN_X)/step)));
      const a=left*2,b=a+2,f=(x-samples[a])/(samples[b]-samples[a]);
      y=samples[a+1]+(samples[b+1]-samples[a+1])*f;
      tx=samples[b]-samples[a];ty=samples[b+1]-samples[a+1];
      const length=Math.hypot(tx,ty)||1;tx/=length;ty/=length;
    }
  }
  out.local.x=x;out.local.y=y;
  out.tangent.x=tx;out.tangent.y=ty;
  const angle=glass.pose.angle+glass.relativeLiquidRotation,c=Math.cos(angle),s=Math.sin(angle);
  out.world.x=glass.pose.x+x*c-y*s;
  out.world.y=glass.pose.y+x*s+y*c;
  return out;
}
