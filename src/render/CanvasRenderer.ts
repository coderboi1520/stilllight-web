import { COLORS,H,W } from '../core/constants.ts';
import type {GlassFrame,LiquidLayerFrame,RenderFrame,StreamFrame} from '../core/RenderFrame.ts';

function closedGlassPath(ctx:CanvasRenderingContext2D){ctx.beginPath();ctx.moveTo(-33,0);ctx.lineTo(-33,130);ctx.quadraticCurveTo(-33,154,-12,156);ctx.lineTo(12,156);ctx.quadraticCurveTo(33,154,33,130);ctx.lineTo(33,0);ctx.closePath();}
function openGlassPath(ctx:CanvasRenderingContext2D){ctx.beginPath();ctx.moveTo(-33,0);ctx.lineTo(-33,130);ctx.quadraticCurveTo(-33,154,-12,156);ctx.lineTo(12,156);ctx.quadraticCurveTo(33,154,33,130);ctx.lineTo(33,0);}
function outline(ctx:CanvasRenderingContext2D,color:string,width:number,rim:string,rimWidth:number){ctx.strokeStyle=color;ctx.lineWidth=width;openGlassPath(ctx);ctx.stroke();ctx.beginPath();ctx.ellipse(0,0,33,4.5,0,0,Math.PI*2);ctx.strokeStyle=rim;ctx.lineWidth=rimWidth;ctx.stroke();}

export class CanvasRenderer{
  readonly backend='canvas' as const;
  private canvas=document.createElement('canvas');
  private ctx=this.canvas.getContext('2d')!;
  private width=W;
  private height=H;
  private density=1;

  async init(host:HTMLElement){this.canvas.setAttribute('aria-hidden','true');host.appendChild(this.canvas);}
  resize(width:number,height:number,density:number){this.width=Math.max(1,width);this.height=Math.max(1,height);this.density=Math.max(1,Math.min(density,2));this.canvas.width=Math.max(1,Math.round(this.width*this.density));this.canvas.height=Math.max(1,Math.round(this.height*this.density));this.canvas.style.width=`${this.width}px`;this.canvas.style.height=`${this.height}px`;}
  destroy(){this.canvas.remove();}

  private layer(ctx:CanvasRenderingContext2D,layer:LiquidLayerFrame){
    if(layer.amount<=.0001)return;
    ctx.fillStyle=COLORS[layer.color];
    if(layer.wavy&&layer.surface){ctx.beginPath();ctx.moveTo(layer.surface[0],layer.surface[1]);for(let i=1;i<layer.surface.length/2;i++)ctx.lineTo(layer.surface[i*2],layer.surface[i*2+1]);ctx.lineTo(layer.surface[layer.surface.length-2],layer.bottom+2);ctx.lineTo(layer.surface[0],layer.bottom+2);ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(255,255,255,.33)';ctx.lineWidth=1.45;ctx.beginPath();ctx.moveTo(layer.surface[0],layer.surface[1]);for(let i=1;i<layer.surface.length/2;i++)ctx.lineTo(layer.surface[i*2],layer.surface[i*2+1]);ctx.stroke();}
    else{ctx.fillRect(-220,layer.top,440,Math.max(.01,layer.bottom-layer.top+1));ctx.fillStyle='rgba(255,255,255,.247)';ctx.fillRect(-220,layer.top,440,1.4);}
  }

  private glass(frame:GlassFrame){
    const ctx=this.ctx;ctx.save();ctx.translate(frame.pose.x,frame.pose.y);ctx.rotate(frame.pose.angle);
    ctx.save();ctx.shadowColor='rgba(0,0,0,.8)';ctx.shadowBlur=7;ctx.fillStyle='rgba(12,31,42,.78)';closedGlassPath(ctx);ctx.fill();ctx.restore();
    ctx.fillStyle='rgba(12,31,42,.78)';closedGlassPath(ctx);ctx.fill();
    ctx.save();closedGlassPath(ctx);ctx.clip();ctx.rotate(frame.relativeLiquidRotation);for(const layer of frame.layers)this.layer(ctx,layer);ctx.restore();
    const glow=frame.invalid?'#ff8e94':frame.hintRole==='source'?'#f5d38e':frame.hintRole==='target'?'#83e0d4':frame.selected?'#f5d38e':null;
    if(glow){ctx.save();ctx.shadowColor=glow;ctx.shadowBlur=frame.invalid?12:16;outline(ctx,glow,frame.invalid?3:2.4,glow,frame.invalid?1.4:2.4);ctx.restore();}
    if(frame.invalid)outline(ctx,'#ff8e94',3,'#ffb0b5',1.4);else if(frame.selected)outline(ctx,'#f5d38e',1.6,'#f9e1ae',1.8);else outline(ctx,'rgba(200,225,237,.61)',1.6,'rgba(230,243,248,.78)',1.4);
    ctx.strokeStyle='rgba(255,255,255,.32)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-25,14);ctx.lineTo(-25,123);ctx.stroke();ctx.restore();
  }

  private stream(stream:StreamFrame|null){
    if(!stream?.visible)return;const ctx=this.ctx,color=COLORS[stream.color];
    ctx.save();ctx.globalAlpha=stream.alpha;ctx.strokeStyle=color;ctx.lineCap='round';ctx.lineWidth=5.8;ctx.shadowColor=color;ctx.shadowBlur=10;ctx.beginPath();ctx.moveTo(stream.start.x,stream.start.y);ctx.quadraticCurveTo(stream.control.x,stream.control.y,stream.end.x,stream.end.y);ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,255,255,.38)';ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(stream.start.x,stream.start.y);ctx.quadraticCurveTo(stream.control.x,stream.control.y,stream.end.x,stream.end.y);ctx.stroke();ctx.restore();
    if(stream.impact>0){ctx.save();ctx.globalAlpha=.24*stream.impact;ctx.strokeStyle='#fff';ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(stream.end.x,stream.end.y+1.5,9+stream.impact*4,2.2+stream.impact,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
  }

  render(frame:RenderFrame){
    const ctx=this.ctx,sx=this.width/W,sy=this.height/H;ctx.setTransform(this.density,0,0,this.density,0,0);ctx.clearRect(0,0,this.width,this.height);ctx.fillStyle='#071219';ctx.fillRect(0,0,this.width,this.height);ctx.setTransform(this.density*sx,0,0,this.density*sy,0,0);
    const moving=frame.glasses[0].moving?0:frame.glasses[1].moving?1:-1;if(moving===0){this.glass(frame.glasses[1]);this.glass(frame.glasses[0]);}else{this.glass(frame.glasses[0]);this.glass(frame.glasses[1]);}this.stream(frame.stream);
  }
}
