import { EDGE_MARGIN,GLASS_HALF_WIDTH,GLASS_HEIGHT,H,SELECT_LIFT,W } from './constants.ts';
export type Pose={x:number;y:number;angle:number}; export type Point={x:number;y:number};
const GLASS_CORNERS=[[-GLASS_HALF_WIDTH,0],[GLASS_HALF_WIDTH,0],[GLASS_HALF_WIDTH,GLASS_HEIGHT],[-GLASS_HALF_WIDTH,GLASS_HEIGHT]] as const;
const poseOut=():Pose=>({x:0,y:0,angle:0});
const pointOut=():Point=>({x:0,y:0});
export const position=(index:number,out:Point=pointOut())=>{out.x=80+(index%3)*120;out.y=130+Math.floor(index/3)*242;return out;};
export const clamp01=(v:number)=>Math.max(0,Math.min(1,v));
export const smooth=(v:number)=>{const t=clamp01(v);return t*t*(3-2*t)};
export const smoother=(v:number)=>{const t=clamp01(v);return t*t*t*(t*(t*6-15)+10)};
export const easeOutCubic=(v:number)=>1-Math.pow(1-clamp01(v),3);
export function transformedGlassCorners(pose:Pose,out:Point[]=[]){const c=Math.cos(pose.angle),s=Math.sin(pose.angle);for(let i=0;i<GLASS_CORNERS.length;i++){const [x,y]=GLASS_CORNERS[i],p=out[i]??(out[i]={x:0,y:0});p.x=pose.x+x*c-y*s;p.y=pose.y+x*s+y*c;}out.length=GLASS_CORNERS.length;return out;}
function clampXYZ(px:number,py:number,angle:number,out:Pose){const c=Math.cos(angle),s=Math.sin(angle);let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const [x,y] of GLASS_CORNERS){const tx=px+x*c-y*s,ty=py+x*s+y*c;if(tx<minX)minX=tx;if(tx>maxX)maxX=tx;if(ty<minY)minY=ty;if(ty>maxY)maxY=ty;}let x=px,y=py;if(minX<EDGE_MARGIN)x+=EDGE_MARGIN-minX;if(maxX>W-EDGE_MARGIN)x-=maxX-(W-EDGE_MARGIN);if(minY<EDGE_MARGIN)y+=EDGE_MARGIN-minY;if(maxY>H-EDGE_MARGIN)y-=maxY-(H-EDGE_MARGIN);out.x=x;out.y=y;out.angle=angle;return out;}
export function clampPose(pose:Pose,out:Pose=poseOut()):Pose{return clampXYZ(pose.x,pose.y,pose.angle,out);}
export function pourDirection(source:number,target:number){const sx=80+(source%3)*120,tx=80+(target%3)*120;if(tx<W/2)return-1;if(tx>W/2)return 1;if(sx!==tx)return sx<tx?1:-1;return source<target?1:-1;}
export const tiltForUnits=(remaining:number)=>Math.max(.78,Math.min(1.565,1.59-Math.max(0,remaining)*.19));
export function movingPose(source:number,target:number,progress:number,remaining:number,out:Pose=poseOut()):Pose{
  const hx=80+(source%3)*120,hy=130+Math.floor(source/3)*242,dx=80+(target%3)*120,dy=130+Math.floor(target/3)*242,direction=pourDirection(source,target),p=clamp01(progress);
  const approach=smoother(p/.28),retreat=smoother((p-.72)/.28),presence=approach*(1-retreat);
  const tiltIn=smoother((p-.08)/.22),tiltOut=smoother((p-.69)/.21),angle=direction*tiltForUnits(remaining)*tiltIn*(1-tiltOut);
  const lipOffsetX=direction*GLASS_HALF_WIDTH*Math.cos(angle),pourCenterX=dx-lipOffsetX,sameRow=Math.floor(source/3)===Math.floor(target/3),pourCenterY=dy-(sameRow?82:135);
  const startY=hy-SELECT_LIFT,travelArc=-9*Math.sin(Math.PI*approach)*(1-retreat);
  return clampXYZ(hx+(pourCenterX-hx)*presence,startY+SELECT_LIFT*retreat+(pourCenterY-startY)*presence+travelArc,angle,out);
}
export function selectedPose(index:number,progress=1,out:Pose=poseOut()):Pose{const x=80+(index%3)*120,y=130+Math.floor(index/3)*242,t=clamp01(progress),lift=SELECT_LIFT*easeOutCubic(t),settle=t<1?Math.sin(t*Math.PI*3.2)*1.8*(1-t):0;out.x=x;out.y=y-lift+settle;out.angle=0;return out;}
export function selectedPoseDerivative(progress:number,out:Pose=poseOut()):Pose{out.x=0;out.y=0;out.angle=0;if(progress<0||progress>=1)return out;const t=clamp01(progress),k=Math.PI*3.2,dLift=3*SELECT_LIFT*(1-t)*(1-t),dSettle=1.8*(k*Math.cos(k*t)*(1-t)-Math.sin(k*t));out.y=-dLift+dSettle;return out;}
export function invalidPose(index:number,progress:number,direction:number,out:Pose=poseOut()):Pose{const hx=80+(index%3)*120,hy=130+Math.floor(index/3)*242,p=clamp01(progress),env=Math.pow(1-p,1.35),osc=Math.sin(p*Math.PI*5.4),returnHome=smoother((p-.70)/.30);return clampXYZ(hx+direction*8.5*osc*env,hy-SELECT_LIFT*(1-returnHome)+1.2*Math.sin(p*Math.PI*2)*env,direction*.075*osc*env,out);}
export function invalidFeedbackPose(index:number,progress:number,direction:number,out:Pose=poseOut()):Pose{
  const hx=80+(index%3)*120,hy=130+Math.floor(index/3)*242,p=clamp01(progress);
  const deflection=p<.24?5*smoother(p/.24):p<.56?5-6.5*smoother((p-.24)/.32):-1.5*(1-smoother((p-.56)/.44));
  return clampXYZ(hx+direction*deflection,hy,direction*.032*deflection/5,out);
}
export function pouringLip(pose:Pose,direction:number,out:Point=pointOut()):Point{const localX=direction*GLASS_HALF_WIDTH;out.x=pose.x+localX*Math.cos(pose.angle);out.y=pose.y+localX*Math.sin(pose.angle);return out;}
export function streamControl(start:Point,end:Point,direction:number,out:Point=pointOut()):Point{out.x=(start.x+end.x)/2+direction*2.5;out.y=start.y+Math.max(16,(end.y-start.y)*.58);return out;}
