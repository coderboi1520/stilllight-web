import { Container,Graphics,GraphicsContext,Sprite } from 'pixi.js';
import type {Texture} from 'pixi.js';
import type {GlassFrame} from '../../core/RenderFrame.ts';
import {COMPLETION_ACCENTS} from '../../core/constants.ts';
import {CAP_ART_SCALE,CAP_SOURCE_BOTTOM,CAP_SOURCE_SIZE} from '../capArtwork.ts';
import {LiquidView} from './LiquidView.ts';
import {makeBodyShadowTexture,makeGlassBaseTexture,makeGlassEdgeTexture,makeGlassRimTexture,makeGlowTexture,makeShineTexture} from './assets.ts';

function interiorGlassContext(){
  return new GraphicsContext()
    .moveTo(-33,0)
    .bezierCurveTo(-33,2.485,-18.225,4.5,0,4.5)
    .bezierCurveTo(18.225,4.5,33,2.485,33,0)
    .lineTo(33,130)
    .quadraticCurveTo(33,154,12,156)
    .lineTo(-12,156)
    .quadraticCurveTo(-33,154,-33,130)
    .closePath();
}

function openWallContext(){
  return new GraphicsContext()
    .moveTo(-33,0)
    .lineTo(-33,130)
    .quadraticCurveTo(-33,154,-12,156)
    .lineTo(12,156)
    .quadraticCurveTo(33,154,33,130)
    .lineTo(33,0);
}

function outline(wall:string,wallWidth:number,rim:string,rimWidth:number){
  const g=new Graphics(openWallContext());
  g.stroke({color:wall,width:wallWidth});
  g.ellipse(0,0,33,4.5).stroke({color:rim,width:rimWidth});
  return g;
}

function symbolContexts(){
  const diamond=new GraphicsContext().moveTo(0,-4).lineTo(4,0).lineTo(0,4).lineTo(-4,0).closePath().fill('#10212b');
  const circle=new GraphicsContext().circle(0,0,3).fill('#10212b');
  const waves=new GraphicsContext();for(const y of [-3,0,3])waves.moveTo(-5,y).bezierCurveTo(-2,y-3,2,y+3,5,y);waves.stroke({color:'#10212b',width:1.3});
  const star=new GraphicsContext().moveTo(0,-5).lineTo(1.4,-1.4).lineTo(5,0).lineTo(1.4,1.4).lineTo(0,5).lineTo(-1.4,1.4).lineTo(-5,0).lineTo(-1.4,-1.4).closePath().fill('#10212b');
  return[diamond,circle,waves,star];
}

export class GlassView{
  root=new Container();
  private shadowTexture=makeBodyShadowTexture();
  private shadow=new Sprite(this.shadowTexture);
  private body=new Graphics(interiorGlassContext());
  private clip=new Graphics(interiorGlassContext()).fill(0xffffff);
  private clipped=new Container();
  private liquid=new LiquidView();
  private baseTexture=makeGlassBaseTexture();
  private baseDepth=new Sprite(this.baseTexture);
  private reflectionTexture=makeShineTexture();
  private reflection=new Sprite(this.reflectionTexture);
  private edgeTexture=makeGlassEdgeTexture();
  private edgeHighlight=new Sprite(this.edgeTexture);
  private rimTexture=makeGlassRimTexture();
  private normalRim=new Sprite(this.rimTexture);
  private cap=new Container();
  private capBody=new Sprite();
  private particles:Graphics[]=[];
  private normal=new Graphics(openWallContext()).stroke({color:'#b9d8e66f',width:1.25});
  private selected=outline('#f5d38e',1.6,'#f9e1ae',1.8);
  private invalid=outline('#ff8e94',3,'#ffb0b5',1.4);
  private glows:{selected:Sprite;hintSource:Sprite;hintTarget:Sprite;invalid:Sprite};
  private glowList:Sprite[]=[];
  private ownedTextures:Texture[]=[this.shadowTexture,this.baseTexture,this.reflectionTexture,this.edgeTexture,this.rimTexture];
  private destroyed=false;
  private symbolShapes=symbolContexts();
  private symbols=Array.from({length:5},()=>new Graphics(this.symbolShapes[0]));

  constructor(capTexture:Texture){
    this.capBody.texture=capTexture;
    this.capBody.position.set(-CAP_SOURCE_SIZE/2,-CAP_SOURCE_BOTTOM);
    this.cap.addChild(this.capBody);
    this.cap.scale.set(CAP_ART_SCALE);
    this.cap.visible=false;
    this.shadow.position.set(-90,-36);
    this.shadow.width=180;
    this.shadow.height=230;
    this.body.fill({color:'#102731',alpha:.18});
    for(const surface of [this.baseDepth,this.reflection,this.edgeHighlight]){
      surface.position.set(-34,0);
      surface.width=68;
      surface.height=158;
    }
    this.normalRim.position.set(-90,-36);
    this.normalRim.width=180;
    this.normalRim.height=230;
    const selectedTexture=makeGlowTexture('#f5d38e',2.4,16),hintSourceTexture=makeGlowTexture('#f5d38e',2.4,16),hintTargetTexture=makeGlowTexture('#83e0d4',2.4,16),invalidTexture=makeGlowTexture('#ff8e94',3,12);
    this.ownedTextures.push(selectedTexture,hintSourceTexture,hintTargetTexture,invalidTexture);
    this.glows={selected:new Sprite(selectedTexture),hintSource:new Sprite(hintSourceTexture),hintTarget:new Sprite(hintTargetTexture),invalid:new Sprite(invalidTexture)};
    this.glowList=[this.glows.selected,this.glows.hintSource,this.glows.hintTarget,this.glows.invalid];
    for(const g of this.glowList){
      g.position.set(-90,-36);
      g.width=180;
      g.height=230;
      g.visible=false;
    }
    this.clipped.addChild(this.liquid.root,this.baseDepth,this.reflection,this.edgeHighlight);
    this.clipped.mask=this.clip;
    for(let i=0;i<12;i++){const particle=i<8?new Graphics().circle(0,0,1.7).fill({color:0xffffff,alpha:.16}).circle(0,0,.75).fill(0xffffff):new Graphics().circle(0,0,1).stroke({color:0xffffff,width:.45});particle.visible=false;this.particles.push(particle);}
    this.root.addChild(this.shadow,this.body,this.clip,this.clipped,...this.glowList,this.normal,this.normalRim,this.selected,this.invalid,...this.symbols,this.cap,...this.particles);
    this.selected.visible=this.invalid.visible=false;
  }

  destroy(){
    if(this.destroyed)return;
    this.destroyed=true;
    this.liquid.destroy();
    this.root.destroy({children:true});
    for(const shape of this.symbolShapes)shape.destroy();
    for(const texture of this.ownedTextures)texture.destroy(true);
    this.ownedTextures.length=0;
  }

  update(frame:GlassFrame){
    this.root.position.set(frame.pose.x,frame.pose.y+frame.completion.recoilY);
    this.root.rotation=frame.pose.angle;
    this.cap.visible=frame.cap.visible;
    this.cap.position.set(0,frame.cap.y);
    this.cap.scale.set(CAP_ART_SCALE*frame.cap.scaleX,CAP_ART_SCALE*frame.cap.scaleY);
    this.cap.rotation=frame.cap.rotation;
    this.cap.alpha=frame.cap.alpha;
    for(let i=0;i<this.particles.length;i++){
      const particle=this.particles[i],state=frame.completion.particles[i];particle.visible=state.visible;
      if(!state.visible)continue;
      particle.position.set(state.x,state.y);particle.scale.set(state.radius);particle.alpha=state.alpha;
      particle.tint=state.bubble?'#e9f7ff':COMPLETION_ACCENTS[frame.completion.color];
    }
    this.reflection.x=-34+Math.max(-2,Math.min(2,-Math.sin(frame.pose.angle)*2));
    this.liquid.update(frame);
    for(let i=0;i<this.symbols.length;i++){
      const symbol=this.symbols[i],layer=frame.layers[i];symbol.visible=!!layer&&layer.amount>=.6&&Math.abs(frame.pose.angle)<.05;
      if(!symbol.visible)continue;
      symbol.context=this.symbolShapes[layer.color];
      const y=(layer.top+layer.bottom)/2,a=frame.relativeLiquidRotation;
      symbol.position.set(-y*Math.sin(a),y*Math.cos(a));symbol.rotation=a;
    }
    for(const g of this.glowList)g.visible=false;
    const normalVisible=!frame.invalid&&!frame.selected;
    this.normal.visible=normalVisible;
    this.normalRim.visible=normalVisible;
    this.selected.visible=frame.selected&&!frame.invalid;
    this.invalid.visible=frame.invalid;
    this.invalid.alpha=.65*frame.invalidStrength;
    this.glows.invalid.alpha=.55*frame.invalidStrength;
    this.glows.hintSource.alpha=this.glows.hintTarget.alpha=frame.hintStrength;
    if(frame.invalid)this.glows.invalid.visible=true;
    else if(frame.hintRole==='source')this.glows.hintSource.visible=true;
    else if(frame.hintRole==='target')this.glows.hintTarget.visible=true;
    else if(frame.selected)this.glows.selected.visible=true;
  }
}
