import { Container,MeshSimple,Sprite,Texture } from 'pixi.js';
import { COLORS } from '../../core/constants.ts';
import type {StreamFrame} from '../../core/RenderFrame.ts';
import {getCircleTexture,makeStreamHaloCapTexture,makeStreamHaloTexture} from './assets.ts';

const CURVE_SEGMENTS=32;
const CURVE_SAMPLES=CURVE_SEGMENTS+1;
const IMPACT_SEGMENTS=32;
const STREAM_HALO_SPAN=40;

class CurveStroke{
  root=new Container();
  private vertices=new Float32Array(CURVE_SAMPLES*4);
  private uvs=new Float32Array(CURVE_SAMPLES*4);
  private indices=new Uint32Array(CURVE_SEGMENTS*6);
  private mesh:MeshSimple;
  private startCap:Sprite;
  private endCap:Sprite;
  private width:number;

  constructor(width:number,texture=Texture.WHITE,capTexture=getCircleTexture(),capSize=width){
    this.width=width;
    for(let i=0;i<CURVE_SAMPLES;i++){
      const u=i/CURVE_SEGMENTS,o=i*4;
      this.uvs[o]=u;this.uvs[o+1]=0;this.uvs[o+2]=u;this.uvs[o+3]=1;
      if(i<CURVE_SEGMENTS){
        const q=i*6,a=i*2,b=a+1,c=a+2,d=a+3;
        this.indices.set([a,b,c,c,b,d],q);
      }
    }
    this.mesh=new MeshSimple({texture,vertices:this.vertices,uvs:this.uvs,indices:this.indices});
    this.mesh.autoUpdate=true;
    this.startCap=new Sprite(capTexture);
    this.endCap=new Sprite(capTexture);
    this.startCap.anchor.set(.5);
    this.endCap.anchor.set(.5);
    this.startCap.width=this.startCap.height=capSize;
    this.endCap.width=this.endCap.height=capSize;
    this.root.addChild(this.mesh,this.startCap,this.endCap);
  }

  update(center:Float64Array,normals:Float64Array,color:string,alpha:number){
    const half=this.width*.5;
    for(let i=0;i<CURVE_SAMPLES;i++){
      const p=i*2,o=i*4,x=center[p],y=center[p+1],nx=normals[p]*half,ny=normals[p+1]*half;
      this.vertices[o]=x+nx;this.vertices[o+1]=y+ny;
      this.vertices[o+2]=x-nx;this.vertices[o+3]=y-ny;
    }
    this.mesh.tint=color;
    this.mesh.alpha=alpha;
    this.startCap.tint=this.endCap.tint=color;
    this.startCap.alpha=this.endCap.alpha=alpha;
    this.startCap.position.set(center[0],center[1]);
    const end=(CURVE_SAMPLES-1)*2;
    this.endCap.position.set(center[end],center[end+1]);
  }
}

class ImpactRing{
  root=new Container();
  private vertices=new Float32Array((IMPACT_SEGMENTS+1)*4);
  private uvs=new Float32Array((IMPACT_SEGMENTS+1)*4);
  private indices=new Uint32Array(IMPACT_SEGMENTS*6);
  private mesh:MeshSimple;

  constructor(){
    for(let i=0;i<=IMPACT_SEGMENTS;i++){
      const u=i/IMPACT_SEGMENTS,o=i*4;
      this.uvs[o]=u;this.uvs[o+1]=0;this.uvs[o+2]=u;this.uvs[o+3]=1;
      if(i<IMPACT_SEGMENTS){
        const q=i*6,a=i*2,b=a+1,c=a+2,d=a+3;
        this.indices.set([a,b,c,c,b,d],q);
      }
    }
    this.mesh=new MeshSimple({texture:Texture.WHITE,vertices:this.vertices,uvs:this.uvs,indices:this.indices});
    this.mesh.autoUpdate=true;
    this.mesh.tint='#ffffff';
    this.root.addChild(this.mesh);
    this.root.visible=false;
  }

  update(x:number,y:number,impact:number){
    if(impact<=0){this.root.visible=false;return;}
    this.root.visible=true;
    this.root.position.set(x,y+1.5);
    const rx=9+impact*4,ry=2.2+impact,half=.6;
    const outerX=rx+half,outerY=ry+half,innerX=Math.max(0,rx-half),innerY=Math.max(0,ry-half);
    for(let i=0;i<=IMPACT_SEGMENTS;i++){
      const a=i/IMPACT_SEGMENTS*Math.PI*2,c=Math.cos(a),s=Math.sin(a),o=i*4;
      this.vertices[o]=c*outerX;this.vertices[o+1]=s*outerY;
      this.vertices[o+2]=c*innerX;this.vertices[o+3]=s*innerY;
    }
    this.mesh.alpha=.24*impact;
  }
}

export class StreamView{
  root=new Container();
  private center=new Float64Array(CURVE_SAMPLES*2);
  private normals=new Float64Array(CURVE_SAMPLES*2);
  private halo=new CurveStroke(STREAM_HALO_SPAN,makeStreamHaloTexture(),makeStreamHaloCapTexture(),STREAM_HALO_SPAN);
  private colorStroke=new CurveStroke(5.8);
  private core=new CurveStroke(1.8);
  private impact=new ImpactRing();

  constructor(){
    this.root.addChild(this.halo.root,this.colorStroke.root,this.core.root,this.impact.root);
    this.root.visible=false;
  }

  update(stream:StreamFrame|null){
    if(!stream?.visible){this.root.visible=false;return;}
    this.root.visible=true;
    const sx=stream.start.x,sy=stream.start.y,cx=stream.control.x,cy=stream.control.y,ex=stream.end.x,ey=stream.end.y;
    for(let i=0;i<CURVE_SAMPLES;i++){
      const t=i/CURVE_SEGMENTS,mt=1-t,p=i*2;
      this.center[p]=mt*mt*sx+2*mt*t*cx+t*t*ex;
      this.center[p+1]=mt*mt*sy+2*mt*t*cy+t*t*ey;
      const tx=2*mt*(cx-sx)+2*t*(ex-cx),ty=2*mt*(cy-sy)+2*t*(ey-cy),length=Math.hypot(tx,ty)||1;
      this.normals[p]=-ty/length;
      this.normals[p+1]=tx/length;
    }
    const color=COLORS[stream.color];
    this.halo.update(this.center,this.normals,color,stream.alpha);
    this.colorStroke.update(this.center,this.normals,color,stream.alpha);
    this.core.update(this.center,this.normals,'#ffffff',stream.alpha*.38);
    this.impact.update(stream.end.x,stream.end.y,stream.impact);
  }
}
