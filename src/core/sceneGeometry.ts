import * as legacy from './geometry.ts';
import {GLASS_HALF_WIDTH,GLASS_HEIGHT} from './constants.ts';
import type {Point,Pose} from './geometry.ts';
export type SceneProfile={width:number;height:number;pixelScale:number;homes:{x:number;y:number;scale:number;row:number}[];selectMs:number;lift:number};
const point=():Point=>({x:0,y:0}),pose=():Pose=>({x:0,y:0,angle:0});
const CORNERS=[[-33,0],[33,0],[-33,156],[33,156]] as const;
function ease(t:number){t=legacy.clamp01(t);let lo=0,hi=1;for(let i=0;i<15;i++){const m=(lo+hi)/2,x=3*(1-m)*(1-m)*m*.16+3*(1-m)*m*m*.3+m*m*m;if(x<t)lo=m;else hi=m;}const u=(lo+hi)/2;return 1-Math.pow(1-u,3);}
export function sceneGeometry(profile?:SceneProfile){
 const localScale=(i:number)=>profile?.homes[i]?.scale??1;
 const position=(i:number,out:Point=point())=>{if(!profile)return legacy.position(i,out);out.x=profile.homes[i].x;out.y=profile.homes[i].y;return out;};
 const clamp=(x:number,y:number,angle:number,index:number,out:Pose)=>{
  if(!profile)return legacy.clampPose({x,y,angle},out);
  const s=localScale(index),c=Math.cos(angle),n=Math.sin(angle);let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const [a,b] of CORNERS){const px=x+s*(a*c-b*n),py=y+s*(a*n+b*c);minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);}out.x=x+Math.max(0,8-minX)-Math.max(0,maxX-(profile.width-8));out.y=y+Math.max(0,8-minY)-Math.max(0,maxY-(profile.height-8));out.angle=angle;return out;
 };
 const pourDirection=(a:number,b:number)=>{if(!profile)return legacy.pourDirection(a,b);const sx=position(a).x,tx=position(b).x;if(tx<profile.width/2-1e-8)return-1;if(tx>profile.width/2+1e-8)return 1;return sx!==tx?(sx<tx?1:-1):a<b?1:-1;};
 const selectedPose=(i:number,t=1,out:Pose=pose())=>{if(!profile)return legacy.selectedPose(i,t,out);position(i,out);out.y-=profile.lift*localScale(i)*ease(t);out.angle=0;return out;};
 const selectedPoseDerivative=(t:number,out:Pose=pose(),i=0)=>{if(!profile)return legacy.selectedPoseDerivative(t,out);out.x=out.angle=0;out.y=t>=1||t<0?0:-profile.lift*localScale(i)*(ease(Math.min(1,t+.0001))-ease(Math.max(0,t-.0001)))/.0002;return out;};
 const movingPose=(a:number,b:number,t:number,remaining:number,out:Pose=pose())=>{
  if(!profile)return legacy.movingPose(a,b,t,remaining,out);const home=position(a),dest=position(b),dir=pourDirection(a,b),p=legacy.clamp01(t),approach=legacy.smoother(p/.28),retreat=legacy.smoother((p-.72)/.28),presence=approach*(1-retreat),angle=dir*legacy.tiltForUnits(remaining)*legacy.smoother((p-.08)/.22)*(1-legacy.smoother((p-.69)/.21));
  const px=dest.x-dir*GLASS_HALF_WIDTH*localScale(a)*Math.cos(angle),py=dest.y-(profile.homes[a].row===profile.homes[b].row?82:135)*localScale(b),lift=profile.lift*localScale(a),sy=home.y-lift;
  return clamp(home.x+(px-home.x)*presence,sy+lift*retreat+(py-sy)*presence-9*Math.sin(Math.PI*approach)*(1-retreat),angle,a,out);
 };
 const invalidFeedbackPose=(i:number,t:number,d:number,out:Pose=pose())=>{if(!profile)return legacy.invalidFeedbackPose(i,t,d,out);const h=position(i),p=legacy.clamp01(t),v=p<.24?5*legacy.smoother(p/.24):p<.56?5-6.5*legacy.smoother((p-.24)/.32):-1.5*(1-legacy.smoother((p-.56)/.44));return clamp(h.x+d*v,h.y,d*.032*v/5,i,out);};
 const pouringLip=(p:Pose,d:number,out:Point=point(),index=0)=>{if(!profile)return legacy.pouringLip(p,d,out);const x=d*GLASS_HALF_WIDTH*localScale(index);out.x=p.x+x*Math.cos(p.angle);out.y=p.y+x*Math.sin(p.angle);return out;};
 return {position,pourDirection,selectedPose,selectedPoseDerivative,movingPose,invalidFeedbackPose,pouringLip,localScale,selectMs:profile?.selectMs??300,profile};
}
