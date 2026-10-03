import { Application,Assets,Container,Sprite } from 'pixi.js';
import type {Texture} from 'pixi.js';
import { H,SCENE_TOP_PADDING,W } from '../../core/constants.ts';
import type {RenderFrame} from '../../core/RenderFrame.ts';
import {GlassView} from './GlassView.ts';
import {StreamView} from './StreamView.ts';
import {configureAssetDensity} from './assets.ts';
import {backdropLayout} from '../sceneBackdrop.ts';

export class PixiRenderer{
  readonly backend='webgl' as const;
  app=new Application();
  private scene=new Container();
  private glasses:GlassView[]|null=null;
  private stream:StreamView|null=null;
  private retiredViews:(GlassView|StreamView)[]=[];
  private initialized=false;
  private movingIndex=-2;
  private density=1;
  private capTexture:Texture|null=null;
  private backdrop:Sprite|null=null;
  private host:HTMLElement|null=null;
  private onRestore:()=>void=()=>{};
  private restoreHandler=()=>{this.onRestore();};
  constructor(private vesselCount=2){}

  async init(host:HTMLElement,onRestore:()=>void){
    this.host=host;
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
    this.capTexture=await Assets.load<Texture>('/assets/pumpkin-cap.png');
    this.backdrop=new Sprite(await Assets.load<Texture>('/assets/moonlit-studio.png'));this.backdrop.tint='#aaaaaa';
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.backdrop,this.scene);
    this.rebuildViews(false);
    this.app.canvas.addEventListener('webglcontextrestored',this.restoreHandler);
    this.initialized=true;
  }

  private rebuildViews(force:boolean){
    if(this.glasses&&this.stream&&!force)return;
    if(this.glasses){
      this.scene.removeChildren();
      this.retiredViews.push(...this.glasses);
      if(this.stream)this.retiredViews.push(this.stream);
    }
    if(!this.capTexture)throw new Error('Pumpkin cap texture unavailable');
    this.glasses=Array.from({length:this.vesselCount},()=>new GlassView(this.capTexture!));this.stream=new StreamView();this.scene.addChild(...this.glasses.map(g=>g.root),this.stream.root);this.movingIndex=-2;
  }

  private destroyRetiredViews(){for(const view of this.retiredViews)view.destroy();this.retiredViews.length=0;}

  resize(width:number,height:number,density:number){
    const next=Math.max(1,Math.min(density||1,2));
    if(Math.abs(next-this.density)>1e-6){this.density=next;configureAssetDensity(next);this.rebuildViews(true);}
    this.app.renderer.resize(Math.max(1,width),Math.max(1,height),next);
    this.scene.scale.set(width/W,height/H);
    this.scene.y=SCENE_TOP_PADDING*height/H;
    if(this.backdrop&&this.host){const layout=backdropLayout(this.host,width,height,this.backdrop.texture.width,this.backdrop.texture.height);this.backdrop.visible=!!layout;if(layout){this.backdrop.position.set(layout.x,layout.y);this.backdrop.width=layout.width;this.backdrop.height=layout.height;}}
  }

  private ensureDrawOrder(movingIndex:number){
    if(this.movingIndex===movingIndex||!this.glasses||!this.stream)return;
    this.movingIndex=movingIndex;
    let order=0;
    for(let i=0;i<this.glasses.length;i++)if(i!==movingIndex)this.scene.setChildIndex(this.glasses[i].root,order++);
    if(movingIndex>=0)this.scene.setChildIndex(this.glasses[movingIndex].root,order);
    this.scene.setChildIndex(this.stream.root,this.glasses.length);
  }

  render(frame:RenderFrame){
    if(!this.initialized||!this.glasses||!this.stream)return;
    for(let i=0;i<this.glasses.length;i++)this.glasses[i].update(frame.glasses[i]);
    const movingIndex=frame.glasses.findIndex(g=>g.moving);this.ensureDrawOrder(movingIndex);this.stream.update(frame.stream);this.app.renderer.render(this.app.stage);this.destroyRetiredViews();
  }

  destroy(){this.app.canvas?.removeEventListener('webglcontextrestored',this.restoreHandler);this.glasses?.forEach(view=>view.destroy());this.stream?.destroy();this.glasses=null;this.stream=null;this.destroyRetiredViews();try{this.app.destroy(true,{children:true});}catch{}this.initialized=false;}
}
