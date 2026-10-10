import {Container,MeshSimple,Texture} from 'pixi.js';
import {COLORS} from '../../core/constants.ts';
import type {StreamFrame} from '../../core/RenderFrame.ts';
import {makeStreamHaloTexture,releaseTexture} from './assets.ts';

const CURVE_SEGMENTS=32,CURVE_SAMPLES=CURVE_SEGMENTS+1;

function colorWidth(t:number){
  const s=t<.5?t*2:(t-.5)*2,e=s*s*(3-2*s);
  return t<.5?7-1.7*e:5.3+1.2*e;
}

class CurveStroke{
  root=new Container();
  private vertices=new Float32Array(CURVE_SAMPLES*4);
  private uvs=new Float32Array(CURVE_SAMPLES*4);
  private indices=new Uint32Array(CURVE_SEGMENTS*6);
  private mesh:MeshSimple;

  constructor(private kind:'halo'|'color'|'core',texture=Texture.WHITE){
    for(let i=0;i<CURVE_SAMPLES;i++){
      const u=i/CURVE_SEGMENTS,o=i*4;
      this.uvs[o]=u;this.uvs[o+1]=0;this.uvs[o+2]=u;this.uvs[o+3]=1;
      if(i<CURVE_SEGMENTS){const q=i*6,a=i*2,b=a+1,c=a+2,d=a+3;this.indices.set([a,b,c,c,b,d],q);}
    }
    this.mesh=new MeshSimple({texture,vertices:this.vertices,uvs:this.uvs,indices:this.indices});
    this.mesh.autoUpdate=true;
    this.root.addChild(this.mesh);
  }

  destroy(){const geometry=this.mesh.geometry;this.root.destroy({children:true});geometry.destroy(true);}

  update(center:Float64Array,normals:Float64Array,color:string,alpha:number,widthScale:number){
    for(let i=0;i<CURVE_SAMPLES;i++){
      const p=i*2,o=i*4,t=i/CURVE_SEGMENTS;
      const width=this.kind==='halo'?44:this.kind==='core'?1.6:colorWidth(t);
      const half=width*widthScale*.5,nx=normals[p]*half,ny=normals[p+1]*half;
      this.vertices[o]=center[p]+nx;this.vertices[o+1]=center[p+1]+ny;
      this.vertices[o+2]=center[p]-nx;this.vertices[o+3]=center[p+1]-ny;
    }
    this.mesh.tint=color;this.mesh.alpha=alpha;
  }
}

export class StreamView{
  root=new Container();
  private center=new Float64Array(CURVE_SAMPLES*2);
  private normals=new Float64Array(CURVE_SAMPLES*2);
  private haloTexture=makeStreamHaloTexture();
  private halo=new CurveStroke('halo',this.haloTexture);
  private colorStroke=new CurveStroke('color');
  private core=new CurveStroke('core');
  private destroyed=false;

  constructor(){this.root.addChild(this.halo.root,this.colorStroke.root,this.core.root);this.root.visible=false;}

  destroy(){
    if(this.destroyed)return;this.destroyed=true;
    this.halo.destroy();this.colorStroke.destroy();this.core.destroy();
    this.root.destroy();releaseTexture(this.haloTexture);
  }

  update(stream:StreamFrame|null){
    if(!stream?.visible){this.root.visible=false;return;}
    this.root.visible=true;
    const sx=stream.start.x,sy=stream.start.y,cx=stream.control.x,cy=stream.control.y,ex=stream.end.x,ey=stream.end.y;
    for(let i=0;i<CURVE_SAMPLES;i++){
      const t=stream.release+(stream.reveal-stream.release)*i/CURVE_SEGMENTS,mt=1-t,p=i*2;
      this.center[p]=mt*mt*sx+2*mt*t*cx+t*t*ex;
      this.center[p+1]=mt*mt*sy+2*mt*t*cy+t*t*ey;
      const tx=2*mt*(cx-sx)+2*t*(ex-cx),ty=2*mt*(cy-sy)+2*t*(ey-cy),length=Math.hypot(tx,ty)||1;
      this.normals[p]=-ty/length;this.normals[p+1]=tx/length;
    }
    const color=COLORS[stream.color];
    this.halo.update(this.center,this.normals,color,stream.alpha*.30,stream.widthScale);
    this.colorStroke.update(this.center,this.normals,color,stream.alpha,stream.widthScale);
    this.core.update(this.center,this.normals,'#ffffff',stream.alpha*.42,stream.widthScale);
  }
}
