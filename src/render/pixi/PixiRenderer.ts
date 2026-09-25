import { Application,Container } from 'pixi.js';
import { H,W } from '../../core/constants.ts';
import type {RenderFrame} from '../../core/RenderFrame.ts';
import {GlassView} from './GlassView.ts';
import {StreamView} from './StreamView.ts';

export class PixiRenderer{
  app=new Application();
  private scene=new Container();
  private glasses=[new GlassView(),new GlassView()];
  private stream=new StreamView();
  private initialized=false;
  private movingIndex=-2;

  async init(host:HTMLElement){
    const density=Math.min(devicePixelRatio||1,2);
    await this.app.init({width:W,height:H,resolution:density,autoDensity:true,antialias:true,background:'#071219',preference:'webgl',autoStart:false,sharedTicker:false});
    this.app.ticker.stop();
    host.appendChild(this.app.canvas);
    this.scene.addChild(this.glasses[0].root,this.glasses[1].root,this.stream.root);
    this.app.stage.addChild(this.scene);
    this.initialized=true;
  }

  private ensureDrawOrder(movingIndex:number){
    if(this.movingIndex===movingIndex)return;
    this.movingIndex=movingIndex;
    if(movingIndex===0){
      this.scene.setChildIndex(this.glasses[1].root,0);
      this.scene.setChildIndex(this.glasses[0].root,1);
    }else{
      this.scene.setChildIndex(this.glasses[0].root,0);
      this.scene.setChildIndex(this.glasses[1].root,1);
    }
    this.scene.setChildIndex(this.stream.root,2);
  }

  render(frame:RenderFrame){
    if(!this.initialized)return;
    this.glasses[0].update(frame.glasses[0]);
    this.glasses[1].update(frame.glasses[1]);
    const movingIndex=frame.glasses[0].moving?0:frame.glasses[1].moving?1:-1;
    this.ensureDrawOrder(movingIndex);
    this.stream.update(frame.stream);
    this.app.renderer.render(this.app.stage);
  }
}
