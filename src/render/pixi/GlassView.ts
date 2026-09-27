import { Container,Graphics,GraphicsContext,Sprite } from 'pixi.js';
import type {Texture} from 'pixi.js';
import type {GlassFrame} from '../../core/RenderFrame.ts';
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
  private cap=new Sprite();
  private capScale=1;
  private normal=new Graphics(openWallContext()).stroke({color:'#b9d8e66f',width:1.25});
  private selected=outline('#f5d38e',1.6,'#f9e1ae',1.8);
  private invalid=outline('#ff8e94',3,'#ffb0b5',1.4);
  private glows:{selected:Sprite;hintSource:Sprite;hintTarget:Sprite;invalid:Sprite};
  private glowList:Sprite[]=[];
  private ownedTextures:Texture[]=[this.shadowTexture,this.baseTexture,this.reflectionTexture,this.edgeTexture,this.rimTexture];
  private destroyed=false;

  constructor(capTexture:Texture){
    this.cap.texture=capTexture;
    this.cap.anchor.set(.5,1055/1254);
    this.capScale=110/capTexture.width;
    this.cap.scale.set(this.capScale);
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
    this.root.addChild(this.shadow,this.body,this.clip,this.clipped,...this.glowList,this.normal,this.normalRim,this.selected,this.invalid,this.cap);
    this.selected.visible=this.invalid.visible=false;
  }

  destroy(){
    if(this.destroyed)return;
    this.destroyed=true;
    this.liquid.destroy();
    this.root.destroy({children:true});
    for(const texture of this.ownedTextures)texture.destroy(true);
    this.ownedTextures.length=0;
  }

  update(frame:GlassFrame){
    this.root.position.set(frame.pose.x,frame.pose.y);
    this.root.rotation=frame.pose.angle;
    this.cap.visible=frame.cap.visible;
    this.cap.position.set(0,frame.cap.y);
    this.cap.scale.set(this.capScale*frame.cap.scaleX,this.capScale*frame.cap.scaleY);
    this.cap.rotation=frame.cap.rotation;
    this.cap.alpha=frame.cap.alpha;
    this.reflection.x=-34+Math.max(-2,Math.min(2,-Math.sin(frame.pose.angle)*2));
    this.liquid.update(frame);
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
