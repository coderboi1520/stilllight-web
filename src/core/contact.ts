import {GLASS_BOTTOM,GLASS_HALF_WIDTH,SURFACE_MAX_X,SURFACE_MIN_X,SURFACE_SAMPLES} from './constants.ts';
import type {GlassFrame,SurfaceContact} from './RenderFrame.ts';

const CONTACT_OFFSET=8;
const SAMPLE_STEP=(SURFACE_MAX_X-SURFACE_MIN_X)/(SURFACE_SAMPLES-1);

function heightAt(samples:Float64Array,x:number){
  const left=Math.max(0,Math.min(SURFACE_SAMPLES-2,Math.floor((x-SURFACE_MIN_X)/SAMPLE_STEP)));
  const a=left*2,b=a+2,f=(x-samples[a])/(samples[b]-samples[a]);
  return samples[a+1]+(samples[b+1]-samples[a+1])*f;
}

function interiorHalfWidth(y:number){
  if(y>=151)return Math.max(8,12+(156-y)*2-2);
  if(y>=143)return 22+(151-y)-2;
  if(y>=130)return 30+(143-y)*3/13-2;
  return GLASS_HALF_WIDTH-2;
}

export function prepareSurfaceContact(glass:GlassFrame,direction:number,out:SurfaceContact,worldX?:number){
  const top=glass.layers.at(-1),angle=glass.pose.angle+glass.relativeLiquidRotation,c=Math.cos(angle),s=Math.sin(angle);
  let x=-direction*CONTACT_OFFSET;
  let y=GLASS_BOTTOM,tx=1,ty=0;
  out.empty=!top;
  if(top)y=top.top;
  if(worldX!==undefined){
    x=(worldX-glass.pose.x+y*s)/c;
    if(top?.wavy&&top.surface)for(let i=0;i<5;i++){
      y=heightAt(top.surface,x);
      x=(worldX-glass.pose.x+y*s)/c;
    }
    const limit=interiorHalfWidth(y);
    x=Math.max(-limit,Math.min(limit,x));
  }
  if(top){
    if(top.wavy&&top.surface){
      const samples=top.surface,step=SAMPLE_STEP;
      const left=Math.max(0,Math.min(SURFACE_SAMPLES-2,Math.floor((x-SURFACE_MIN_X)/step)));
      const a=left*2,b=a+2,f=(x-samples[a])/(samples[b]-samples[a]);
      y=samples[a+1]+(samples[b+1]-samples[a+1])*f;
      tx=samples[b]-samples[a];ty=samples[b+1]-samples[a+1];
      const length=Math.hypot(tx,ty)||1;tx/=length;ty/=length;
    }
  }
  out.local.x=x;out.local.y=y;
  out.tangent.x=tx;out.tangent.y=ty;
  out.world.x=glass.pose.x+x*c-y*s;
  out.world.y=glass.pose.y+x*s+y*c;
  return out;
}
