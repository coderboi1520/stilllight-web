import { Application,Assets,Container,Sprite,Texture } from 'pixi.js';
import { H,SCENE_TOP_PADDING,W } from '../../core/constants.ts';
import type {RenderFrame} from '../../core/RenderFrame.ts';
import {GlassView} from './GlassView.ts';
import {StreamView} from './StreamView.ts';
import {configureAssetDensity} from './assets.ts';
import {backdropLayout} from '../sceneBackdrop.ts';
import {restorationArtwork} from '../restoration.ts';
import {makeVesselNumbers,NUMBER_HEIGHT,NUMBER_WIDTH,vesselNumberLayout} from '../vesselNumbers.ts';

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
  private capTexture:Texture|null=null;
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
    this.glasses=Array.from({length:this.vesselCount},()=>new GlassView(this.capTexture!));
    this.streams=Array.from({length:Math.floor(this.vesselCount/2)},()=>new StreamView());
    this.scene.addChild(...this.glasses.map(g=>g.root),...this.streams.map(s=>s.root));this.movingOrder='';
  }

  private destroyRetiredViews(){for(const view of this.retiredViews)view.destroy();this.retiredViews.length=0;}

  resize(width:number,height:number,density:number){
    const next=Math.max(1,Math.min(density||1,2));
    if(Math.abs(next-this.density)>1e-6){this.density=next;configureAssetDensity(next);this.rebuildViews(true);}
    this.app.renderer.resize(Math.max(1,width),Math.max(1,height),next);
    this.scene.scale.set(width/W,height/H);
    this.scene.y=SCENE_TOP_PADDING*height/H;
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
    for(let i=0;i<this.glasses.length;i++)if(!frame.glasses[i].moving)this.scene.setChildIndex(this.glasses[i].root,order++);
    for(let i=0;i<this.glasses.length;i++)if(frame.glasses[i].moving)this.scene.setChildIndex(this.glasses[i].root,order++);
    for(const stream of this.streams)this.scene.setChildIndex(stream.root,order++);
  }

  render(frame:RenderFrame){
    if(!this.initialized||!this.glasses)return;
    for(let i=0;i<this.glasses.length;i++)this.glasses[i].update(frame.glasses[i]);
    this.ensureDrawOrder(frame);for(let i=0;i<this.streams.length;i++)this.streams[i].update(frame.streams[i]??null);this.app.renderer.render(this.app.stage);this.destroyRetiredViews();
  }

  destroy(){this.app.canvas?.removeEventListener('webglcontextrestored',this.restoreHandler);this.glasses?.forEach(view=>view.destroy());this.streams.forEach(view=>view.destroy());this.glasses=null;this.streams.length=0;this.destroyRetiredViews();try{this.app.destroy(true,{children:true});}catch{}for(const texture of this.numberTextures)texture.destroy(true);this.numberTextures.length=0;this.initialized=false;}
}
