import {Container,Graphics,MeshSimple,Sprite,Texture} from 'pixi.js';
import {COLORS,GLASS_BOTTOM,SURFACE_SAMPLES} from '../../core/constants.ts';
import type {GlassFrame,LiquidLayerFrame,ReceiverResponseFrame} from '../../core/RenderFrame.ts';
import {makeLiquidDepthTexture,releaseTexture} from './assets.ts';

const clampDepth=(y:number)=>Math.max(0,Math.min(1,y/GLASS_BOTTOM));

class LayerView{
  root=new Container();
  private flatVertices=new Float32Array(8);
  private flatUvs=new Float32Array(8);
  private flatFill:MeshSimple;
  private line=new Sprite(Texture.WHITE);
  private fillVertices=new Float32Array(SURFACE_SAMPLES*4);
  private lineVertices=new Float32Array(SURFACE_SAMPLES*4);
  private fillUvs=new Float32Array(SURFACE_SAMPLES*4);
  private lineUvs=new Float32Array(SURFACE_SAMPLES*4);
  private indices=new Uint32Array((SURFACE_SAMPLES-1)*6);
  private waveFill:MeshSimple;
  private waveLine:MeshSimple;
  private sideLight=new MeshSimple({texture:Texture.WHITE,vertices:new Float32Array(8),uvs:new Float32Array([0,0,0,1,1,0,1,1]),indices:new Uint32Array([0,1,2,2,1,3])});
  private sideShade=new MeshSimple({texture:Texture.WHITE,vertices:new Float32Array(8),uvs:new Float32Array([0,0,0,1,1,0,1,1]),indices:new Uint32Array([0,1,2,2,1,3])});

  constructor(depthTexture:Texture){
    this.flatFill=new MeshSimple({texture:depthTexture,vertices:this.flatVertices,uvs:this.flatUvs,indices:new Uint32Array([0,1,2,2,1,3])});
    for(let i=0;i<SURFACE_SAMPLES;i++){
      const u=i/(SURFACE_SAMPLES-1),o=i*4;
      this.fillUvs[o]=u;this.fillUvs[o+2]=u;
      this.lineUvs[o]=u;this.lineUvs[o+1]=0;this.lineUvs[o+2]=u;this.lineUvs[o+3]=1;
      if(i<SURFACE_SAMPLES-1){const q=i*6,a=i*2,b=a+1,c=a+2,d=a+3;this.indices.set([a,b,c,c,b,d],q);}
    }
    this.waveFill=new MeshSimple({texture:depthTexture,vertices:this.fillVertices,uvs:this.fillUvs,indices:this.indices});
    this.waveLine=new MeshSimple({texture:Texture.WHITE,vertices:this.lineVertices,uvs:this.lineUvs,indices:this.indices});
    this.flatFill.autoUpdate=this.waveFill.autoUpdate=this.waveLine.autoUpdate=true;
    this.line.tint='#ffffff';this.waveLine.tint='#ffffff';
    this.sideLight.tint='#ffffff';this.sideShade.tint='#000000';this.sideLight.alpha=this.sideShade.alpha=.16;
    this.root.addChild(this.flatFill,this.line,this.waveFill,this.waveLine,this.sideLight,this.sideShade);
  }

  destroy(){
    const flatGeometry=this.flatFill.geometry,fillGeometry=this.waveFill.geometry,lineGeometry=this.waveLine.geometry,lightGeometry=this.sideLight.geometry,shadeGeometry=this.sideShade.geometry;
    this.root.destroy({children:true});
    flatGeometry.destroy(true);fillGeometry.destroy(true);lineGeometry.destroy(true);lightGeometry.destroy(true);shadeGeometry.destroy(true);
  }

  update(layer:LiquidLayerFrame,showBoundary=true,rimSense=false){
    this.root.visible=layer.amount>.0001;
    const color=COLORS[layer.color];this.flatFill.tint=this.waveFill.tint=color;
    const surfaceY=(x:number)=>{if(!layer.wavy||!layer.surface)return layer.top;const i=Math.max(0,Math.min(SURFACE_SAMPLES-2,Math.floor((x+220)/10))),p=i*2,t=(x-layer.surface[p])/(layer.surface[p+2]-layer.surface[p]);return layer.surface[p+1]+t*(layer.surface[p+3]-layer.surface[p+1]);};
    for(const [mesh,left,right] of [[this.sideLight,-33,-29.5],[this.sideShade,28,33]] as const){const vertices=mesh.geometry.getBuffer('aPosition');vertices.data.set([left,Math.min(layer.bottom,surfaceY(left)),left,layer.bottom,right,Math.min(layer.bottom,surfaceY(right)),right,layer.bottom]);vertices.update();}
    if(layer.wavy&&layer.surface){
      this.flatFill.visible=this.line.visible=false;this.waveFill.visible=this.waveLine.visible=true;
      const bottom=layer.bottom,bottomV=clampDepth(bottom),samples=layer.surface;
      for(let i=0;i<SURFACE_SAMPLES;i++){
        const x=samples[i*2],y=samples[i*2+1],o=i*4;
        this.fillVertices[o]=x;this.fillVertices[o+1]=y;
        this.fillVertices[o+2]=x;this.fillVertices[o+3]=bottom;
        this.fillUvs[o+1]=clampDepth(y);this.fillUvs[o+3]=bottomV;
        const p=i===0?0:(i-1)*2,n=i===SURFACE_SAMPLES-1?(SURFACE_SAMPLES-1)*2:(i+1)*2;
        const tx=samples[n]-samples[p],ty=samples[n+1]-samples[p+1],length=Math.hypot(tx,ty)||1;
        const ox=-ty/length*.9,oy=tx/length*.9;
        this.lineVertices[o]=x+ox;this.lineVertices[o+1]=y+oy;
        this.lineVertices[o+2]=x-ox;this.lineVertices[o+3]=y-oy;
      }
      this.waveFill.geometry.getBuffer('aUV').update();
      this.waveLine.alpha=rimSense?.8:.55;
    }else{
      this.waveFill.visible=this.waveLine.visible=false;this.flatFill.visible=true;this.line.visible=layer.isTop||showBoundary;
      const bottom=layer.bottom,top=layer.top,topV=clampDepth(top),bottomV=clampDepth(bottom);
      this.flatVertices[0]=-220;this.flatVertices[1]=top;this.flatVertices[2]=-220;this.flatVertices[3]=bottom;
      this.flatVertices[4]=220;this.flatVertices[5]=top;this.flatVertices[6]=220;this.flatVertices[7]=bottom;
      this.flatUvs[0]=0;this.flatUvs[1]=topV;this.flatUvs[2]=0;this.flatUvs[3]=bottomV;
      this.flatUvs[4]=1;this.flatUvs[5]=topV;this.flatUvs[6]=1;this.flatUvs[7]=bottomV;
      this.flatFill.geometry.getBuffer('aUV').update();
      this.line.x=-220;this.line.y=top;this.line.width=440;this.line.height=layer.isTop?1.5:1.1;
      this.line.alpha=layer.isTop?(rimSense?.8:.50):.24;
    }
  }
}

class ReceiverResponseView{
  contact=new Graphics().ellipse(0,0,5.5,1.6).fill({color:'#ffffff'});
  ripple=new Graphics().ellipse(0,0,7,2.1).stroke({color:'#ffffff',width:1.1});
  destroy(){this.contact.destroy();this.ripple.destroy();}
  update(response:ReceiverResponseFrame|null){
    this.contact.visible=this.ripple.visible=!!response;
    if(!response)return;
    const {local,tangent}=response.contact,angle=Math.atan2(tangent.y,tangent.x);
    this.contact.position.set(local.x,local.y);this.contact.rotation=angle;this.contact.alpha=.50*response.intensity;
    this.ripple.position.set(local.x,local.y+.6);this.ripple.rotation=angle;
    this.ripple.scale.set(response.spread/7,1);this.ripple.alpha=.30*response.intensity;
  }
}

export class LiquidView{
  root=new Container();
  private depthTexture=makeLiquidDepthTexture();
  private layers=Array.from({length:5},()=>new LayerView(this.depthTexture));
  private response=new ReceiverResponseView();
  constructor(){for(const layer of this.layers)this.root.addChild(layer.root);this.root.addChild(this.response.ripple,this.response.contact);}
  destroy(){for(const layer of this.layers)layer.destroy();this.response.destroy();this.root.destroy();releaseTexture(this.depthTexture);}
  update(frame:GlassFrame){
    this.root.rotation=frame.relativeLiquidRotation;
    for(let i=0;i<this.layers.length;i++){
      const layer=frame.layers[i];this.layers[i].root.visible=!!layer;
      if(layer){const next=frame.layers[i+1];this.layers[i].update(layer,!next||next.color!==layer.color,frame.cap.visible&&(frame.completionAge??1000)<160);}
    }
    this.response.update(frame.response);
  }
}
