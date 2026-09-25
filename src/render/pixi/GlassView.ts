import { Container,Graphics,GraphicsContext,Sprite } from 'pixi.js';
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

function outline(wall:string,wallWidth:number,rim:string,rimWidth:number){
  const g=new Graphics(openWallContext());
  g.stroke({color:wall,width:wallWidth});
  g.ellipse(0,0,33,4.5).stroke({color:rim,width:rimWidth});
  return g;
}

export class GlassView{
  root=new Container();
  private shadow=new Sprite(makeBodyShadowTexture());
  private body=new Graphics(closedGlassContext());
  private clip=new Graphics(closedGlassContext()).fill(0xffffff);
  private clipped=new Container();
  private liquid=new LiquidView();
  private shine=new Sprite(makeShineTexture());
  private normal=outline('#c8e1ed9b',1.6,'#e6f3f8c7',1.4);
  private selected=outline('#f5d38e',1.6,'#f9e1ae',1.8);
  private invalid=outline('#ff8e94',3,'#ffb0b5',1.4);
  private highlight=new Graphics().moveTo(-25,14).lineTo(-25,123).stroke({color:'#ffffff52',width:2});
  private glows:{selected:Sprite;hintSource:Sprite;hintTarget:Sprite;invalid:Sprite};

  constructor(){
    this.shadow.position.set(-90,-36);
    this.shadow.width=180;
    this.shadow.height=230;
    this.body.fill({color:'#0c1f2a',alpha:.78});
    this.shine.position.set(-34,0);
    this.shine.width=68;
    this.shine.height=158;
    this.glows={
      selected:new Sprite(makeGlowTexture('#f5d38e',2.4,16)),
      hintSource:new Sprite(makeGlowTexture('#f5d38e',2.4,16)),
      hintTarget:new Sprite(makeGlowTexture('#83e0d4',2.4,16)),
      invalid:new Sprite(makeGlowTexture('#ff8e94',3,12)),
    };
    for(const g of Object.values(this.glows)){
      g.position.set(-90,-36);
      g.width=180;
      g.height=230;
      g.visible=false;
    }
    this.clipped.addChild(this.liquid.root,this.shine);
    this.clipped.mask=this.clip;
    this.root.addChild(this.shadow,this.body,this.clip,this.clipped,...Object.values(this.glows),this.normal,this.selected,this.invalid,this.highlight);
    this.selected.visible=this.invalid.visible=false;
  }

  update(frame:GlassFrame){
    this.root.position.set(frame.pose.x,frame.pose.y);
    this.root.rotation=frame.pose.angle;
    this.liquid.update(frame);
    for(const g of Object.values(this.glows))g.visible=false;
    this.normal.visible=!frame.invalid&&!frame.selected;
    this.selected.visible=frame.selected&&!frame.invalid;
    this.invalid.visible=frame.invalid;
    if(frame.invalid)this.glows.invalid.visible=true;
    else if(frame.hintRole==='source')this.glows.hintSource.visible=true;
    else if(frame.hintRole==='target')this.glows.hintTarget.visible=true;
    else if(frame.selected)this.glows.selected.visible=true;
  }
}
