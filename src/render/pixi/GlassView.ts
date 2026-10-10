import { Container,Graphics,GraphicsContext,Sprite } from 'pixi.js';
import type {Texture} from 'pixi.js';
import type {GlassFrame} from '../../core/RenderFrame.ts';
import {COMPLETION_ACCENTS,COLORS} from '../../core/constants.ts';
import {CAP_ART_SCALE,CAP_SOURCE_BOTTOM,CAP_SOURCE_SIZE} from '../capArtwork.ts';
import {LiquidView} from './LiquidView.ts';
import {makeBodyShadowTexture,makeGlassBaseTexture,makeGlassEdgeTexture,makeGlassRimTexture,makeGlowTexture,makeShineTexture,makeRadialTexture,makeLightColumnTexture,makeSweepTexture,releaseTexture} from './assets.ts';
const DROPLET_COLORS=COLORS.map(color=>`#${[1,3,5].map(i=>{const c=parseInt(color.slice(i,i+2),16);return Math.round(c+(255-c)*.35).toString(16).padStart(2,'0');}).join('')}`);

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
  private collarGlint=new Sprite();
  private sweepTexture=makeSweepTexture();
  private glintMask=new Sprite(this.sweepTexture);
  private radialTexture=makeRadialTexture();
  private halo=new Sprite(this.radialTexture);
  private caustic=new Sprite(this.radialTexture);
  private seatShadow=new Sprite(this.radialTexture);
  private columnTexture=makeLightColumnTexture();
  private column=new Sprite(this.columnTexture);
  private rimSense=new Graphics().moveTo(33,0).bezierCurveTo(33,2.485,18.225,4.5,0,4.5).bezierCurveTo(-18.225,4.5,-33,2.485,-33,0).stroke({color:'#ffffff',width:1.5});
  private particles:Graphics[]=[];
  private keyline=new Graphics(openWallContext()).stroke({color:'#040810',alpha:.45,width:3.2});
  private normal=new Graphics(openWallContext()).stroke({color:'#d9e9f0',alpha:.52,width:1.25});
  private selected=outline('#f1f6f8',2,'#ffffff',2);
  private invalid=outline('#FF9A8A',1.4,'#FF9A8A',1.4);
  private glows:{selected:Sprite;hintSource:Sprite;hintTarget:Sprite;invalid:Sprite};
  private glowList:Sprite[]=[];
  private ownedTextures:Texture[]=[this.shadowTexture,this.baseTexture,this.reflectionTexture,this.edgeTexture,this.rimTexture,this.radialTexture,this.columnTexture,this.sweepTexture];
  private destroyed=false;
  private originalCap:Texture;
  private neutralCap:Texture;
  private capTint='#ffffff';private glassTint='#ffffff';
  setFinishes(cap:string,glass:string){this.capTint=cap;this.glassTint=glass;this.applyFinishes(cap,glass);}
  private applyFinishes(cap:string,glass:string){this.capBody.texture=cap==='#ffffff'?this.originalCap:this.neutralCap;this.capBody.tint=cap;this.reflection.tint=glass;this.edgeHighlight.tint=glass;this.normalRim.tint=glass;}

  constructor(capTexture:Texture,neutralCap=capTexture){
    this.originalCap=capTexture;this.neutralCap=neutralCap;
    this.capBody.texture=capTexture;
    this.capBody.position.set(-CAP_SOURCE_SIZE/2,-CAP_SOURCE_BOTTOM);
    this.collarGlint.texture=this.originalCap;this.collarGlint.position.copyFrom(this.capBody.position);this.collarGlint.blendMode='add';this.glintMask.width=this.glintMask.height=CAP_SOURCE_SIZE*1.25;this.glintMask.rotation=.35;this.collarGlint.mask=this.glintMask;this.cap.addChild(this.capBody,this.collarGlint,this.glintMask);
    this.cap.scale.set(CAP_ART_SCALE);
    this.cap.visible=false;
    this.halo.position.set(-52.8,25.2);this.halo.width=this.halo.height=105.6;this.halo.blendMode='add';
    this.caustic.position.set(-43,161);this.caustic.width=86;this.caustic.height=14;this.caustic.blendMode='add';
    this.seatShadow.position.set(-26,11.5);this.seatShadow.width=52;this.seatShadow.height=7;this.seatShadow.tint='#000000';
    this.column.position.set(-34,0);this.column.width=68;this.column.height=156;
    this.shadow.position.set(-90,-36);
    this.shadow.width=180;
    this.shadow.height=230;
    this.body.fill({color:'#102731',alpha:.26});
    for(const surface of [this.baseDepth,this.reflection,this.edgeHighlight]){
      surface.position.set(-34,0);
      surface.width=68;
      surface.height=158;
    }
    this.normalRim.position.set(-90,-36);
    this.normalRim.width=180;
    this.normalRim.height=230;
    const selectedTexture=makeGlowTexture('#dfeaf1',2.4,20),hintSourceTexture=makeGlowTexture('#f2b24b',2.4,16),hintTargetTexture=makeGlowTexture('#bfd8e6',2.4,16),invalidTexture=makeGlowTexture('#FF9A8A',1.4,12);
    this.ownedTextures.push(selectedTexture,hintSourceTexture,hintTargetTexture,invalidTexture);
    this.glows={selected:new Sprite(selectedTexture),hintSource:new Sprite(hintSourceTexture),hintTarget:new Sprite(hintTargetTexture),invalid:new Sprite(invalidTexture)};
    this.glowList=[this.glows.selected,this.glows.hintSource,this.glows.hintTarget,this.glows.invalid];
    for(const g of this.glowList){
      g.position.set(-90,-36);
      g.width=180;
      g.height=230;
      g.visible=false;
    }
    this.clipped.addChild(this.liquid.root,this.baseDepth,this.reflection,this.edgeHighlight,this.seatShadow);
    this.clipped.mask=this.clip;
    for(let i=0;i<16;i++){const particle=i<8||i>=12?new Graphics().circle(0,0,1.7).fill({color:0xffffff,alpha:.16}).circle(0,0,.75).fill(0xffffff):new Graphics().circle(0,0,1).stroke({color:0xffffff,width:.45});particle.visible=false;this.particles.push(particle);}
    this.invalid.scale.set(71/66,161/156);this.invalid.y=-2.5;
    this.root.addChild(this.halo,this.caustic,this.column,this.shadow,this.body,this.keyline,this.clip,this.clipped,...this.glowList,this.normal,this.normalRim,this.rimSense,this.selected,this.invalid,this.cap,...this.particles);
    this.selected.visible=this.invalid.visible=false;
  }

  destroy(){
    if(this.destroyed)return;
    this.destroyed=true;
    this.liquid.destroy();
    this.root.destroy({children:true});
    for(const texture of this.ownedTextures)releaseTexture(texture);
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
    const age=frame.completionAge??1000,complete=frame.cap.visible,fill=frame.layers.reduce((sum,l)=>sum+l.amount,0);
    this.applyFinishes(complete?'#ffffff':this.capTint,complete?'#F0DCA0':this.glassTint);
    this.caustic.tint=COLORS[frame.layers.at(-1)?.color??0];this.caustic.alpha=complete?.22:.22*fill/4;this.caustic.visible=fill>0;this.caustic.width=86*(frame.selected?.88:1);
    this.column.alpha=.10*frame.selectionStrength;
    this.halo.tint=COMPLETION_ACCENTS[frame.layers.at(-1)?.color??0];this.halo.alpha=complete&&age>=0&&age<600?frame.reducedMotion?.16:.16+.29*(1-Math.min(1,age/600)):0;
    this.seatShadow.alpha=complete&&age>=0?.30*Math.min(1,age/90)*frame.cap.alpha:0;
    this.rimSense.visible=complete&&age<160;this.rimSense.alpha=age<0?1:1-Math.min(1,age/160);
    const glint=complete&&age>=0&&age<260&&!frame.reducedMotion?age/260:-1;this.collarGlint.visible=glint>=0;this.collarGlint.alpha=glint>=0?.55*Math.sin(Math.PI*glint):0;
    this.glintMask.visible=glint>=0;
    if(glint>=0)this.glintMask.position.set(-CAP_SOURCE_SIZE*.8+glint*CAP_SOURCE_SIZE*1.6,-CAP_SOURCE_BOTTOM-CAP_SOURCE_SIZE*.2);
    const completionParticles=frame.completion.particles.some(p=>p.visible);
    for(let i=0;i<this.particles.length;i++){
      const particle=this.particles[i],state=completionParticles?frame.completion.particles[i]:frame.droplets[i];particle.visible=!!state?.visible;
      if(!state?.visible)continue;
      particle.position.set(state.x,state.y);particle.scale.set(state.radius);particle.alpha=state.alpha;
      particle.tint=state.bubble?'#e9f7ff':completionParticles?COMPLETION_ACCENTS[frame.completion.color]:DROPLET_COLORS[state.color??0];
    }
    this.reflection.x=-34+Math.max(-2,Math.min(2,-Math.sin(frame.pose.angle)*2));
    this.liquid.update(frame);
    for(const g of this.glowList)g.visible=false;
    const normalVisible=!frame.invalid&&frame.selectionStrength<=0;
    this.normal.visible=normalVisible;
    this.normalRim.visible=normalVisible;
    this.selected.visible=frame.selectionStrength>0&&!frame.invalid;this.selected.alpha=frame.selectionStrength;
    this.invalid.visible=frame.invalid;
    this.invalid.alpha=(frame.invalidRole==='target'?.80:.45)*frame.invalidStrength;
    this.glows.invalid.alpha=.45*frame.invalidStrength;
    this.glows.hintSource.alpha=this.glows.hintTarget.alpha=frame.hintStrength;
    if(frame.invalid)this.glows.invalid.visible=true;
    else if(frame.hintRole==='source')this.glows.hintSource.visible=true;
    else if(frame.hintRole==='target')this.glows.hintTarget.visible=true;
    else if(frame.selectionStrength>0){this.glows.selected.visible=true;this.glows.selected.alpha=1.25*frame.selectionStrength;}
  }
}
