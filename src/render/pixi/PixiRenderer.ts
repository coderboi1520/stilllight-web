import { Application,Assets,Container,Sprite,Texture } from 'pixi.js';
import { H,SCENE_TOP_PADDING,W } from '../../core/constants.ts';
import type {RenderFrame} from '../../core/RenderFrame.ts';
import {GlassView} from './GlassView.ts';
import {StreamView} from './StreamView.ts';
import {configureAssetDensity} from './assets.ts';
import {backdropLayout} from '../sceneBackdrop.ts';
import {restorationArtwork} from '../restoration.ts';
import {makeVesselNumbers,NUMBER_HEIGHT,NUMBER_WIDTH,vesselNumberLayout} from '../vesselNumbers.ts';
import {workbenchProps,type Presentation} from '../workbench.ts';
import {tintedArtwork} from '../tintedArtwork.ts';

export class PixiRenderer{
  readonly backend='webgl' as const;
  app=new Application();
  private scene=new Container();
  // Keep label textures out of glass batches so frozen redraws stay byte-exact.
  private numbers=new Container({isRenderGroup:true});
  private numberTextures:Texture[]=[];
  private glasses:GlassView[]|null=null;
  private streams:StreamView[]=[];
  private retiredViews:(GlassView|StreamView)[]=[];
  private initialized=false;
  private movingOrder='';
  private density=1;
  private capTint='#ffffff';
  private glassTint='#ffffff';
  setFinishes(cap:string,glass:string){this.capTint=cap;this.glassTint=glass;this.glasses?.forEach(g=>g.setFinishes(cap,glass));}
  private presentation:Presentation='game';
  private width=W;
  private height=H;
  setPresentation(mode:Presentation){this.presentation=mode;this.layoutScene();}
  private layoutScene(){this.scene.scale.set(this.width/W,this.presentation==='workbench'?this.width/W:this.height/H);this.scene.y=this.presentation==='workbench'?0:SCENE_TOP_PADDING*this.height/H;this.numbers.visible=this.presentation==='game';}
  private capTexture:Texture|null=null;
  private neutralCapTexture:Texture|null=null;
  private backdrop:Sprite|null=null;
  // Keep changing restoration textures outside the authored glass batches.
  private restoration=new Container({isRenderGroup:true});
  private restorationTextures:Texture[]=[];
  private restorationCount=-1;
  setRestoration(count:number,alpha=1){
    if(count!==this.restorationCount){
      this.restoration.removeChildren().forEach(c=>c.destroy());this.restorationTextures.forEach(t=>t.destroy(true));
      this.restorationTextures=[restorationArtwork(Math.max(0,count-1)),restorationArtwork(count,true)].map(c=>Texture.from(c));
      this.restoration.addChild(...this.restorationTextures.map(t=>new Sprite(t)));this.restorationCount=count;
    }
    if(this.restoration.children[1])this.restoration.children[1].alpha=alpha;
  }
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
    const capSource=new Image();capSource.src='/assets/pumpkin-cap.png';await capSource.decode();this.neutralCapTexture=Texture.from(tintedArtwork(capSource,'#ffffff',true));
    this.backdrop=new Sprite(await Assets.load<Texture>('/assets/moonlit-studio.png'));this.backdrop.tint='#aaaaaa';
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.backdrop,this.restoration,this.numbers,this.scene);
    this.numberTextures=makeVesselNumbers(this.vesselCount).map(canvas=>Texture.from(canvas));
    for(const texture of this.numberTextures){const number=new Sprite(texture);number.width=NUMBER_WIDTH;number.height=NUMBER_HEIGHT;this.numbers.addChild(number);}
    this.rebuildViews(false);
    this.app.canvas.addEventListener('webglcontextrestored',this.restoreHandler);
    this.initialized=true;
  }

  private rebuildViews(force:boolean){
    if(this.glasses&&!force)return;
    if(this.glasses){
      this.scene.removeChildren();
      this.retiredViews.push(...this.glasses);
      this.retiredViews.push(...this.streams);
    }
    if(!this.capTexture)throw new Error('Pumpkin cap texture unavailable');
    this.glasses=Array.from({length:this.vesselCount},()=>new GlassView(this.capTexture!,this.neutralCapTexture!));
    this.glasses.forEach(g=>g.setFinishes(this.capTint,this.glassTint));
    this.streams=Array.from({length:Math.floor(this.vesselCount/2)},()=>new StreamView());
    this.scene.addChild(...this.glasses.map(g=>g.root),...this.streams.map(s=>s.root));this.movingOrder='';
  }

  private destroyRetiredViews(){for(const view of this.retiredViews)view.destroy();this.retiredViews.length=0;}

  resize(width:number,height:number,density:number){
    const next=Math.max(1,Math.min(density||1,2));
    if(Math.abs(next-this.density)>1e-6){this.density=next;configureAssetDensity(next);this.rebuildViews(true);}
    this.app.renderer.resize(Math.max(1,width),Math.max(1,height),next);
    this.width=width;this.height=height;this.layoutScene();
    for(let i=0;i<this.numbers.children.length;i++){const p=vesselNumberLayout(i,width,height);this.numbers.children[i].position.set(p.x,p.y);}
    if(this.backdrop&&this.host){const layout=backdropLayout(this.host,width,height,this.backdrop.texture.width,this.backdrop.texture.height);this.backdrop.visible=!!layout;if(layout){this.backdrop.position.set(layout.x,layout.y);this.backdrop.width=layout.width;this.backdrop.height=layout.height;}}
    this.restoration.visible=this.backdrop?.visible??false;
    if(this.backdrop){this.restoration.position.copyFrom(this.backdrop.position);this.restoration.scale.set(this.backdrop.width/1024,this.backdrop.height/1536);}
  }

  private ensureDrawOrder(frame:RenderFrame){
    const movingOrder=frame.glasses.map(g=>g.moving?'1':'0').join('');
    if(this.movingOrder===movingOrder||!this.glasses)return;
    this.movingOrder=movingOrder;
    let order=0;
    for(let i=frame.glasses.length;i<this.glasses.length;i++)this.scene.setChildIndex(this.glasses[i].root,order++);
    for(let i=0;i<frame.glasses.length;i++)if(!frame.glasses[i].moving)this.scene.setChildIndex(this.glasses[i].root,order++);
    for(let i=0;i<frame.glasses.length;i++)if(frame.glasses[i].moving)this.scene.setChildIndex(this.glasses[i].root,order++);
    for(const stream of this.streams)this.scene.setChildIndex(stream.root,order++);
  }

  private ensureVesselCount(count:number){
    // Grow a bounded retained view pool. Shrinking active boards must not retire
    // meshes while Pixi is still holding their onRender callbacks. The model,
    // frame and semantic controls contain exactly the active vessel count.
    if(count>this.vesselCount&&this.glasses&&this.capTexture){
      while(this.glasses.length<count){const g=new GlassView(this.capTexture,this.neutralCapTexture!);g.setFinishes(this.capTint,this.glassTint);this.glasses.push(g);this.scene.addChild(g.root);}
      while(this.streams.length<Math.floor(count/2)){const stream=new StreamView();this.streams.push(stream);this.scene.addChild(stream.root);}
      this.vesselCount=count;this.movingOrder='';
    }
    if(this.numbers.children.length!==count){
      this.numbers.removeChildren().forEach(c=>c.destroy());this.numberTextures.forEach(t=>t.destroy(true));
      this.numberTextures=makeVesselNumbers(this.vesselCount).map(c=>Texture.from(c));
      this.numberTextures.forEach((texture,i)=>{const s=new Sprite(texture),p=vesselNumberLayout(i,this.width,this.height);s.width=NUMBER_WIDTH;s.height=NUMBER_HEIGHT;s.position.set(p.x,p.y);this.numbers.addChild(s);});
    }
  }
  render(frame:RenderFrame){
    if(!this.initialized||!this.glasses)return;
    this.ensureVesselCount(frame.glasses.length);
    for(let i=0;i<this.glasses.length;i++){this.glasses[i].root.visible=this.presentation==='game'&&i<frame.glasses.length;this.glasses[i].root.scale.set(1);if(i<frame.glasses.length)this.glasses[i].update(frame.glasses[i]);}
    if(this.presentation==='workbench'){
      for(const p of workbenchProps(frame)){const root=this.glasses[p.index].root;root.visible=true;root.position.set(p.x,p.y);root.scale.set(p.scale);}
      for(const stream of this.streams)stream.root.visible=false;
      this.app.renderer.render(this.app.stage);this.destroyRetiredViews();return;
    }
    this.ensureDrawOrder(frame);for(let i=0;i<this.streams.length;i++)this.streams[i].update(frame.streams[i]??null);this.app.renderer.render(this.app.stage);this.destroyRetiredViews();
  }

  destroy(){this.app.canvas?.removeEventListener('webglcontextrestored',this.restoreHandler);this.glasses?.forEach(view=>view.destroy());this.streams.forEach(view=>view.destroy());this.glasses=null;this.streams.length=0;this.destroyRetiredViews();try{this.app.destroy(true,{children:true});}catch{}for(const texture of this.numberTextures)texture.destroy(true);this.numberTextures.length=0;this.neutralCapTexture?.destroy(true);this.neutralCapTexture=null;this.initialized=false;}
}
