import { Container,Graphics,GraphicsContext,Sprite } from 'pixi.js';
import type {Texture} from 'pixi.js';
import type {GlassFrame} from '../../core/RenderFrame.ts';
import {LiquidView} from './LiquidView.ts';
import {makeBodyShadowTexture,makeGlowTexture,makeShineTexture} from './assets.ts';

function closedGlassContext(){
  return new GraphicsContext()
    .moveTo(-33,0)
    .lineTo(-33,130)
    .quadraticCurveTo(-33,154,-12,156)
    .lineTo(12,156)
    .quadraticCurveTo(33,154,33,130)
    .lineTo(33,0)
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

function rimArcContext(side:-1|1){
  return new GraphicsContext().moveTo(-33,0).quadraticCurveTo(0,side*9,33,0);
}

function baseArcContext(y:number,depth:number,halfWidth:number){
  return new GraphicsContext().moveTo(-halfWidth,y).quadraticCurveTo(0,y+depth,halfWidth,y);
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
  private body=new Graphics(closedGlassContext());
  private clip=new Graphics(closedGlassContext()).fill(0xffffff);
  private clipped=new Container();
  private liquid=new LiquidView();
  private reflectionTexture=makeShineTexture();
  private reflection=new Sprite(this.reflectionTexture);
  private normal=new Graphics(openWallContext()).stroke({color:'#b9d8e66f',width:1.25});
  private backRim=new Graphics(rimArcContext(-1)).stroke({color:'#a9cadb63',width:1.05});
  private frontRim=new Graphics(rimArcContext(1)).stroke({color:'#eaf7fab8',width:1.35});
  private baseShade=new Graphics(baseArcContext(146,10,25)).stroke({color:'#06141b5c',width:2.2});
  private baseHighlight=new Graphics(baseArcContext(151,5.5,17)).stroke({color:'#ddf5f968',width:1});
  private selected=outline('#f5d38e',1.6,'#f9e1ae',1.8);
  private invalid=outline('#ff8e94',3,'#ffb0b5',1.4);
  private edgeHighlight=new Graphics().moveTo(29,24).lineTo(29,104).stroke({color:'#f2fbff66',width:1});
  private glows:{selected:Sprite;hintSource:Sprite;hintTarget:Sprite;invalid:Sprite};
  private glowList:Sprite[]=[];
  private ownedTextures:Texture[]=[this.shadowTexture,this.reflectionTexture];
  private destroyed=false;

  constructor(){
    this.shadow.position.set(-90,-36);
    this.shadow.width=180;
    this.shadow.height=230;
    this.body.fill({color:'#102731',alpha:.18});
    this.reflection.position.set(-34,0);
    this.reflection.width=68;
    this.reflection.height=158;
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
    this.clipped.addChild(this.liquid.root,this.reflection);
    this.clipped.mask=this.clip;
    this.root.addChild(this.shadow,this.body,this.clip,this.clipped,this.baseShade,this.baseHighlight,...this.glowList,this.backRim,this.normal,this.frontRim,this.selected,this.invalid,this.edgeHighlight);
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
    this.reflection.x=-34+Math.max(-2,Math.min(2,-Math.sin(frame.pose.angle)*2));
    this.liquid.update(frame);
    for(const g of this.glowList)g.visible=false;
    this.normal.visible=!frame.invalid&&!frame.selected;
    this.selected.visible=frame.selected&&!frame.invalid;
    this.invalid.visible=frame.invalid;
    if(frame.invalid)this.glows.invalid.visible=true;
    else if(frame.hintRole==='source')this.glows.hintSource.visible=true;
    else if(frame.hintRole==='target')this.glows.hintTarget.visible=true;
    else if(frame.selected)this.glows.selected.visible=true;
  }
}
