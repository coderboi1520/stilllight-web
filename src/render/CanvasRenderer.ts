import type {gameplayLayout} from './gameplayLayout.ts';
import { COLORS,COMPLETION_ACCENTS,GLASS_BOTTOM,H,SCENE_TOP_PADDING,W } from '../core/constants.ts';
import type {GlassFrame,LiquidLayerFrame,RenderFrame,StreamFrame} from '../core/RenderFrame.ts';
import {CAP_ART_SCALE,CAP_ART_WIDTH,CAP_SOURCE_BOTTOM} from './capArtwork.ts';
import {backdropLayout} from './sceneBackdrop.ts';
import {restorationArtwork} from './restoration.ts';
import {drawInteriorGlassPath,makeGlassArtwork,makeRadialArtwork,makeSweepArtwork} from './glassMaterial.ts';
import {makeVesselNumbers,NUMBER_HEIGHT,NUMBER_WIDTH,vesselNumberLayout} from './vesselNumbers.ts';
import {workbenchProps,type Presentation} from './workbench.ts';
import {tintedArtwork} from './tintedArtwork.ts';

const DEPTH_COLORS=COLORS.map(color=>`#${[1,3,5].map(at=>Math.round(parseInt(color.slice(at,at+2),16)*.87).toString(16).padStart(2,'0')).join('')}`);

function openGlassPath(ctx:CanvasRenderingContext2D){ctx.beginPath();ctx.moveTo(-33,0);ctx.lineTo(-33,130);ctx.quadraticCurveTo(-33,154,-12,156);ctx.lineTo(12,156);ctx.quadraticCurveTo(33,154,33,130);ctx.lineTo(33,0);}
function outline(ctx:CanvasRenderingContext2D,color:string,width:number,rim:string,rimWidth:number){ctx.strokeStyle=color;ctx.lineWidth=width;openGlassPath(ctx);ctx.stroke();ctx.beginPath();ctx.ellipse(0,0,33,4.5,0,0,Math.PI*2);ctx.strokeStyle=rim;ctx.lineWidth=rimWidth;ctx.stroke();}

const DROPLET_COLORS=COLORS.map(color=>`#${[1,3,5].map(i=>{const c=parseInt(color.slice(i,i+2),16);return Math.round(c+(255-c)*.35).toString(16).padStart(2,'0');}).join('')}`);

export class CanvasRenderer{
  readonly backend='canvas' as const;
  private canvas=document.createElement('canvas');
  private ctx=this.canvas.getContext('2d')!;
  private glassArtwork=makeGlassArtwork();
  private radialArtwork=makeRadialArtwork();
  private sweepArtwork=makeSweepArtwork();
  private capGlint=document.createElement('canvas');
  constructor(){this.capGlint.width=this.capGlint.height=180;}
  get vesselNumbersVisible(){return !this.layout&&this.numbers.length>0;}
  private numbers:HTMLCanvasElement[]=[];
  private width=W;
  private height=H;
  private density=1;
  private capImage:HTMLImageElement|null=null;
  private backdropImage:HTMLImageElement|null=null;
  private backdrop:ReturnType<typeof backdropLayout>=null;
  private host:HTMLElement|null=null;
  private restoration=0;
  private restorationAlpha=1;
  private presentation:Presentation='game';
  private layout:ReturnType<typeof gameplayLayout>|null=null;
  setGameplayLayout(layout:ReturnType<typeof gameplayLayout>){this.layout=layout;}
  private capTint='#ffffff';
  private glassTint='#ffffff';
  setFinishes(cap:string,glass:string){this.capTint=cap;this.glassTint=glass;}
  setPresentation(mode:Presentation){this.presentation=mode;}
  setRestoration(count:number,alpha=1){this.restoration=count;this.restorationAlpha=alpha;}

  async init(host:HTMLElement){this.host=host;this.capImage=new Image();this.capImage.src='/assets/pumpkin-cap.png';this.backdropImage=new Image();this.backdropImage.src='/assets/moonlit-studio.png';await Promise.all([this.capImage.decode(),this.backdropImage.decode()]);this.canvas.setAttribute('aria-hidden','true');host.appendChild(this.canvas);}
  resize(width:number,height:number,density:number){this.width=Math.max(1,width);this.height=Math.max(1,height);this.density=Math.max(1,Math.min(density,2));this.canvas.width=Math.max(1,Math.round(this.width*this.density));this.canvas.height=Math.max(1,Math.round(this.height*this.density));this.canvas.style.width=`${this.width}px`;this.canvas.style.height=`${this.height}px`;if(this.host&&this.backdropImage)this.backdrop=backdropLayout(this.host,width,height,this.backdropImage.naturalWidth,this.backdropImage.naturalHeight);}
  destroy(){this.canvas.remove();}

  private layer(ctx:CanvasRenderingContext2D,layer:LiquidLayerFrame,showBoundary=true,rimSense=false){
    if(layer.amount<=.0001)return;
    ctx.save();const depth=ctx.createLinearGradient(0,0,0,GLASS_BOTTOM);depth.addColorStop(0,COLORS[layer.color]);depth.addColorStop(1,DEPTH_COLORS[layer.color]);ctx.fillStyle=depth;
    if(layer.wavy&&layer.surface){ctx.beginPath();ctx.moveTo(layer.surface[0],layer.surface[1]);for(let i=1;i<layer.surface.length/2;i++)ctx.lineTo(layer.surface[i*2],layer.surface[i*2+1]);ctx.lineTo(layer.surface[layer.surface.length-2],layer.bottom+2);ctx.lineTo(layer.surface[0],layer.bottom+2);ctx.closePath();}
    else{ctx.beginPath();ctx.rect(-220,layer.top,440,Math.max(.01,layer.bottom-layer.top+1));}
    ctx.fill();ctx.save();ctx.clip();ctx.fillStyle='rgba(255,255,255,.16)';ctx.fillRect(-33,0,3.5,158);ctx.fillStyle='rgba(0,0,0,.16)';ctx.fillRect(28,0,5,158);ctx.restore();
    if(layer.wavy&&layer.surface){ctx.strokeStyle=rimSense?'rgba(255,255,255,.8)':'rgba(255,255,255,.55)';ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(layer.surface[0],layer.surface[1]);for(let i=1;i<layer.surface.length/2;i++)ctx.lineTo(layer.surface[i*2],layer.surface[i*2+1]);ctx.stroke();}
    else if(layer.isTop||showBoundary){ctx.fillStyle=layer.isTop?(rimSense?'rgba(255,255,255,.8)':'rgba(255,255,255,.50)'):'rgba(255,255,255,.24)';ctx.fillRect(-220,layer.top,440,layer.isTop?1.5:1.1);}ctx.restore();
  }

  private light(ctx:CanvasRenderingContext2D,x:number,y:number,width:number,height:number,color:string,alpha:number,add=false){ctx.save();ctx.globalAlpha=alpha;if(add)ctx.globalCompositeOperation='lighter';ctx.drawImage(tintedArtwork(this.radialArtwork,color),x,y,width,height);ctx.restore();}

  private glass(frame:GlassFrame){
    const ctx=this.ctx,age=frame.completionAge??1000,complete=frame.cap.visible,fill=frame.layers.reduce((sum,l)=>sum+l.amount,0),glassTint=complete?'#F0DCA0':this.glassTint;
    ctx.save();ctx.translate(frame.pose.x,frame.pose.y+frame.completion.recoilY);ctx.rotate(frame.pose.angle);ctx.scale(frame.localScale??1,frame.localScale??1);
    if(complete&&age>=0&&age<600)this.light(ctx,-52.8,25.2,105.6,105.6,COMPLETION_ACCENTS[frame.layers.at(-1)?.color??0],frame.reducedMotion?.16:.16+.29*(1-age/600),true);
    if(fill>0)this.light(ctx,-43,161,86,14,COLORS[frame.layers.at(-1)!.color],complete?.22:.22*fill/4,true);
    if(frame.selectionStrength>0){ctx.save();ctx.globalAlpha=.10*frame.selectionStrength;const column=ctx.createLinearGradient(0,0,0,156);column.addColorStop(0,'#fff');column.addColorStop(1,'#fff0');ctx.fillStyle=column;ctx.fillRect(-20,0,40,156);ctx.restore();}
    ctx.drawImage(this.glassArtwork.shadow,-90,-36,180,230);ctx.fillStyle='rgba(16,39,49,.26)';drawInteriorGlassPath(ctx);ctx.fill();ctx.strokeStyle='rgba(4,8,16,.45)';ctx.lineWidth=3.2;openGlassPath(ctx);ctx.stroke();
    ctx.save();drawInteriorGlassPath(ctx);ctx.clip();ctx.save();ctx.rotate(frame.relativeLiquidRotation);
    for(let i=0;i<frame.layers.length;i++){const layer=frame.layers[i],next=frame.layers[i+1];this.layer(ctx,layer,!next||next.color!==layer.color,complete&&age<160);}
    if(frame.response){const {local,tangent}=frame.response.contact,intensity=frame.response.intensity;ctx.save();ctx.translate(local.x,local.y);ctx.rotate(Math.atan2(tangent.y,tangent.x));ctx.strokeStyle='#fff';ctx.lineWidth=1.1;ctx.globalAlpha=.30*intensity;ctx.beginPath();ctx.ellipse(0,.6,frame.response.spread,2.1,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#fff';ctx.globalAlpha=.50*intensity;ctx.beginPath();ctx.ellipse(0,0,5.5,1.6,0,0,Math.PI*2);ctx.fill();ctx.restore();}ctx.restore();
    ctx.drawImage(this.glassArtwork.base,-34,0,68,158);ctx.drawImage(tintedArtwork(this.glassArtwork.reflection,glassTint),-34+Math.max(-2,Math.min(2,-Math.sin(frame.pose.angle)*2)),0,68,158);ctx.drawImage(tintedArtwork(this.glassArtwork.edge,glassTint),-34,0,68,158);
    if(complete&&age>=0)this.light(ctx,-26,11.5,52,7,'#000000',.30*Math.min(1,age/90)*frame.cap.alpha);ctx.restore();
    const glow=frame.invalid?'#FF9A8A':frame.hintRole==='source'?'#f2b24b':frame.hintRole==='target'?'#bfd8e6':frame.selectionStrength>0?'#dfeaf1':null;
    if(glow){ctx.save();ctx.globalAlpha=frame.invalid?.45*frame.invalidStrength:frame.hintRole?frame.hintStrength:1.25*frame.selectionStrength;ctx.shadowColor=glow;ctx.shadowBlur=frame.invalid?12:frame.hintRole?16:20;outline(ctx,glow,2.4,glow,2.4);ctx.restore();}
    if(frame.invalid){ctx.save();ctx.translate(0,-2.5);ctx.scale(71/66,161/156);ctx.globalAlpha=(frame.invalidRole==='target'?.80:.45)*frame.invalidStrength;outline(ctx,'#FF9A8A',1.4,'#FF9A8A',1.4);ctx.restore();}
    else if(frame.selectionStrength>0){ctx.save();ctx.globalAlpha=frame.selectionStrength;outline(ctx,'#f1f6f8',2,'#ffffff',2);ctx.restore();}
    else{ctx.strokeStyle='rgba(217,233,240,.52)';ctx.lineWidth=1.25;openGlassPath(ctx);ctx.stroke();ctx.drawImage(tintedArtwork(this.glassArtwork.rim,glassTint),-90,-36,180,230);}
    if(complete&&age<160){ctx.save();ctx.globalAlpha=age<0?1:1-age/160;ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,0,33,4.5,0,0,Math.PI);ctx.stroke();ctx.restore();}
    if(complete&&this.capImage){ctx.save();ctx.translate(0,frame.cap.y);ctx.rotate(frame.cap.rotation);ctx.scale(frame.cap.scaleX,frame.cap.scaleY);ctx.globalAlpha=frame.cap.alpha;const capTint=complete?'#ffffff':this.capTint;ctx.drawImage(tintedArtwork(this.capImage,capTint,capTint!=='#ffffff'),-CAP_ART_WIDTH/2,-CAP_SOURCE_BOTTOM*CAP_ART_SCALE,CAP_ART_WIDTH,CAP_ART_WIDTH);
      if(age>=0&&age<260&&!frame.reducedMotion){const q=age/260,g=this.capGlint.getContext('2d')!;g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,180,180);g.globalCompositeOperation='source-over';g.drawImage(this.capImage,0,0,180,180);g.globalCompositeOperation='destination-in';g.save();g.translate(-180*.6+q*180*1.6,-36);g.rotate(.35);g.drawImage(this.sweepArtwork,0,0,225,225);g.restore();ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.55*Math.sin(Math.PI*q);ctx.drawImage(this.capGlint,-CAP_ART_WIDTH/2,-CAP_SOURCE_BOTTOM*CAP_ART_SCALE,CAP_ART_WIDTH,CAP_ART_WIDTH);ctx.restore();}ctx.restore();}
    for(const p of frame.completion.particles){if(!p.visible)continue;ctx.save();ctx.globalAlpha=p.alpha;ctx.strokeStyle=ctx.fillStyle=p.bubble?'#e9f7ff':COMPLETION_ACCENTS[frame.completion.color];ctx.lineWidth=.8;ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);if(p.bubble)ctx.stroke();else ctx.fill();ctx.restore();}
    for(const p of frame.droplets){if(!p.visible)continue;ctx.save();ctx.globalAlpha=p.alpha;ctx.fillStyle=DROPLET_COLORS[p.color??0];ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);ctx.fill();ctx.restore();}ctx.restore();
  }

  private stream(stream:StreamFrame|null){
    if(!stream?.visible)return;const ctx=this.ctx,color=COLORS[stream.color],points=32;
    const point=(fraction:number)=>{const t=stream.release+(stream.reveal-stream.release)*fraction,u=1-t;return{x:u*u*stream.start.x+2*u*t*stream.control.x+t*t*stream.end.x,y:u*u*stream.start.y+2*u*t*stream.control.y+t*t*stream.end.y};};
    const path=()=>{const p=point(0);ctx.beginPath();ctx.moveTo(p.x,p.y);for(let i=1;i<=points;i++){const p=point(i/points);ctx.lineTo(p.x,p.y);}};
    ctx.save();ctx.lineCap='butt';ctx.globalAlpha=stream.alpha*.30;ctx.strokeStyle=color;ctx.lineWidth=7*stream.widthScale;ctx.shadowColor=color;ctx.shadowBlur=10;path();ctx.stroke();ctx.shadowBlur=0;ctx.globalAlpha=stream.alpha;
    for(let i=1;i<=points;i++){const t=(i-.5)/points,s=t<.5?t*2:(t-.5)*2,e=s*s*(3-2*s),a=point((i-1)/points),b=point(i/points);ctx.lineWidth=(t<.5?7-1.7*e:5.3+1.2*e)*stream.widthScale;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
    ctx.globalAlpha=stream.alpha*.42;ctx.strokeStyle='#fff';ctx.lineWidth=1.6*stream.widthScale;path();ctx.stroke();ctx.restore();
  }

  render(frame:RenderFrame){
    const ctx=this.ctx,sx=this.width/W,sy=this.height/H;ctx.setTransform(this.density,0,0,this.density,0,0);ctx.clearRect(0,0,this.width,this.height);ctx.fillStyle='#071219';ctx.fillRect(0,0,this.width,this.height);
    if(this.backdrop&&this.backdropImage){const b=this.backdrop;ctx.drawImage(this.backdropImage,b.x,b.y,b.width,b.height);if(!this.layout){ctx.fillStyle='rgba(0,0,0,.333333)';ctx.fillRect(0,0,this.width,this.height);}ctx.drawImage(restorationArtwork(Math.max(0,this.restoration-1)),b.x,b.y,b.width,b.height);ctx.globalAlpha=this.restorationAlpha;ctx.drawImage(restorationArtwork(this.restoration,true),b.x,b.y,b.width,b.height);ctx.globalAlpha=1;}
    if(this.presentation==='workbench'){
      ctx.setTransform(this.density*sx,0,0,this.density*sx,0,0);
      for(const p of workbenchProps(frame)){const glass=frame.glasses[p.index];ctx.save();ctx.translate(p.x,p.y);ctx.scale(p.scale,p.scale);ctx.translate(-glass.pose.x,-glass.pose.y);this.glass(glass);ctx.restore();}return;
    }
    if(!this.layout&&frame.glasses.length>2&&this.numbers.length!==frame.glasses.length)this.numbers=makeVesselNumbers(frame.glasses.length);
    for(let i=0;!this.layout&&i<this.numbers.length;i++){const p=vesselNumberLayout(i,this.width,this.height);ctx.drawImage(this.numbers[i],p.x,p.y,NUMBER_WIDTH,NUMBER_HEIGHT);}
    ctx.setTransform(this.density*(this.layout?.scale??sx),0,0,this.density*(this.layout?.scale??sy),0,0);if(!this.layout)ctx.translate(0,SCENE_TOP_PADDING);
    for(const glass of frame.glasses)if(!glass.moving)this.glass(glass);
    for(const glass of frame.glasses)if(glass.moving)this.glass(glass);
    for(const stream of frame.streams)this.stream(stream);
  }
}
