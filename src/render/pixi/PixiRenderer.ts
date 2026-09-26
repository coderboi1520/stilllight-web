import { Application,Container } from 'pixi.js';
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
  private initialized=false;
  private movingIndex=-2;
  private density=1;
  private onRestore:()=>void=()=>{};
  private restoreHandler=()=>{this.rebuildViews(true);this.onRestore();};

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
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.scene);
    this.rebuildViews(false);
    this.app.canvas.addEventListener('webglcontextrestored',this.restoreHandler);
    this.initialized=true;
  }

  private rebuildViews(force:boolean){
    if(this.glasses&&this.stream&&!force)return;
    if(this.glasses){this.scene.removeChildren();this.glasses[0].root.destroy({children:true});this.glasses[1].root.destroy({children:true});this.stream?.root.destroy({children:true});}
    this.glasses=[new GlassView(),new GlassView()];this.stream=new StreamView();this.scene.addChild(this.glasses[0].root,this.glasses[1].root,this.stream.root);this.movingIndex=-2;
  }

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
    const movingIndex=frame.glasses[0].moving?0:frame.glasses[1].moving?1:-1;this.ensureDrawOrder(movingIndex);this.stream.update(frame.stream);this.app.renderer.render(this.app.stage);
  }

  destroy(){this.app.canvas?.removeEventListener('webglcontextrestored',this.restoreHandler);try{this.app.destroy(true,{children:true});}catch{}this.initialized=false;}
}
