import { Application,Assets,Container } from 'pixi.js';
import type {Texture} from 'pixi.js';
import { H,W } from '../../core/constants.ts';
import type {RenderFrame} from '../../core/RenderFrame.ts';
import {GlassView} from './GlassView.ts';
import {StreamView} from './StreamView.ts';
import {configureAssetDensity} from './assets.ts';

export class PixiRenderer{
  readonly backend='webgl' as const;
  app=new Application();
  private scene=new Container();
  private glasses:[GlassView,GlassView]|null=null;
  private stream:StreamView|null=null;
  private retiredViews:(GlassView|StreamView)[]=[];
  private initialized=false;
  private movingIndex=-2;
  private density=1;
  private capTexture:Texture|null=null;
  private onRestore:()=>void=()=>{};
  private restoreHandler=()=>{this.onRestore();};

  async init(host:HTMLElement,onRestore:()=>void){
    this.onRestore=onRestore;
    this.density=Math.min(devicePixelRatio||1,2);
    configureAssetDensity(this.density);
    await this.app.init({width:W,height:H,resolution:this.density,autoDensity:true,antialias:true,background:'#071219',preference:'webgl',autoStart:false,sharedTicker:false});
    this.app.ticker.stop();
    // Pixi accepts null here to detach its DOM event target, but v8.18's
    // TypeScript declaration narrows the parameter to HTMLElement.
    // @ts-expect-error intentional Pixi declaration/runtime mismatch
    this.app.renderer.events.setTargetElement(null);
    // This scene is rendered only through FrameGate. Pixi 8.18's renderer
    // scheduler otherwise keeps Ticker.system alive solely for periodic GC.
    this.app.renderer.gc.enabled=false;
    this.app.renderer.scheduler.destroy();
    this.capTexture=await Assets.load<Texture>('/assets/chicken-cap.png');
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.scene);
    this.rebuildViews(false);
    this.app.canvas.addEventListener('webglcontextrestored',this.restoreHandler);
    this.initialized=true;
  }

  private rebuildViews(force:boolean){
    if(this.glasses&&this.stream&&!force)return;
    if(this.glasses){
      this.scene.removeChildren();
      this.retiredViews.push(this.glasses[0],this.glasses[1]);
      if(this.stream)this.retiredViews.push(this.stream);
    }
    if(!this.capTexture)throw new Error('Chicken cap texture unavailable');
    this.glasses=[new GlassView(this.capTexture),new GlassView(this.capTexture)];this.stream=new StreamView();this.scene.addChild(this.glasses[0].root,this.glasses[1].root,this.stream.root);this.movingIndex=-2;
  }

  private destroyRetiredViews(){for(const view of this.retiredViews)view.destroy();this.retiredViews.length=0;}

  resize(width:number,height:number,density:number){
    const next=Math.max(1,Math.min(density||1,2));
    if(Math.abs(next-this.density)>1e-6){this.density=next;configureAssetDensity(next);this.rebuildViews(true);}
    this.app.renderer.resize(Math.max(1,width),Math.max(1,height),next);
    this.scene.scale.set(width/W,height/H);
  }

  private ensureDrawOrder(movingIndex:number){
    if(this.movingIndex===movingIndex||!this.glasses||!this.stream)return;
    this.movingIndex=movingIndex;
    if(movingIndex===0){this.scene.setChildIndex(this.glasses[1].root,0);this.scene.setChildIndex(this.glasses[0].root,1);}else{this.scene.setChildIndex(this.glasses[0].root,0);this.scene.setChildIndex(this.glasses[1].root,1);}
    this.scene.setChildIndex(this.stream.root,2);
  }

  render(frame:RenderFrame){
    if(!this.initialized||!this.glasses||!this.stream)return;
    this.glasses[0].update(frame.glasses[0]);this.glasses[1].update(frame.glasses[1]);
    const movingIndex=frame.glasses[0].moving?0:frame.glasses[1].moving?1:-1;this.ensureDrawOrder(movingIndex);this.stream.update(frame.stream);this.app.renderer.render(this.app.stage);this.destroyRetiredViews();
  }

  destroy(){this.app.canvas?.removeEventListener('webglcontextrestored',this.restoreHandler);this.glasses?.forEach(view=>view.destroy());this.stream?.destroy();this.glasses=null;this.stream=null;this.destroyRetiredViews();try{this.app.destroy(true,{children:true});}catch{}this.initialized=false;}
}
