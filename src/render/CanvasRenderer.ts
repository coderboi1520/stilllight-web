import { COLORS,GLASS_BOTTOM,H,W } from '../core/constants.ts';
import type {GlassFrame,LiquidLayerFrame,RenderFrame,StreamFrame} from '../core/RenderFrame.ts';

const DEPTH_COLORS=COLORS.map(color=>`#${[1,3,5].map(at=>Math.round(parseInt(color.slice(at,at+2),16)*.87).toString(16).padStart(2,'0')).join('')}`);

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
    const depth=ctx.createLinearGradient(0,0,0,GLASS_BOTTOM);depth.addColorStop(0,COLORS[layer.color]);depth.addColorStop(1,DEPTH_COLORS[layer.color]);ctx.fillStyle=depth;
    if(layer.wavy&&layer.surface){ctx.beginPath();ctx.moveTo(layer.surface[0],layer.surface[1]);for(let i=1;i<layer.surface.length/2;i++)ctx.lineTo(layer.surface[i*2],layer.surface[i*2+1]);ctx.lineTo(layer.surface[layer.surface.length-2],layer.bottom+2);ctx.lineTo(layer.surface[0],layer.bottom+2);ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(layer.surface[0],layer.surface[1]);for(let i=1;i<layer.surface.length/2;i++)ctx.lineTo(layer.surface[i*2],layer.surface[i*2+1]);ctx.stroke();}
    else{ctx.fillRect(-220,layer.top,440,Math.max(.01,layer.bottom-layer.top+1));ctx.fillStyle=layer.isTop?'rgba(255,255,255,.30)':'rgba(255,255,255,.21)';ctx.fillRect(-220,layer.top,440,layer.isTop?1.2:.9);}
  }

  private glass(frame:GlassFrame){
    const ctx=this.ctx;ctx.save();ctx.translate(frame.pose.x,frame.pose.y);ctx.rotate(frame.pose.angle);
    ctx.save();ctx.shadowColor='#000';ctx.shadowBlur=7;ctx.fillStyle='rgba(12,31,42,.78)';closedGlassPath(ctx);ctx.fill();ctx.restore();
    ctx.save();closedGlassPath(ctx);ctx.clip();
    ctx.save();ctx.rotate(frame.relativeLiquidRotation);for(const layer of frame.layers)this.layer(ctx,layer);
    if(frame.response){const {local,tangent}=frame.response.contact,intensity=frame.response.intensity;ctx.save();ctx.translate(local.x,local.y);ctx.rotate(Math.atan2(tangent.y,tangent.x));ctx.strokeStyle='#fff';ctx.lineWidth=.9;ctx.globalAlpha=.14*intensity;ctx.beginPath();ctx.ellipse(0,.6,frame.response.spread,2.1,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#fff';ctx.globalAlpha=.22*intensity;ctx.beginPath();ctx.ellipse(0,0,3.2,1.1,0,0,Math.PI*2);ctx.fill();ctx.restore();}
    ctx.restore();
    const shine=ctx.createLinearGradient(-34,0,34,0);shine.addColorStop(0,'#ffffff38');shine.addColorStop(.18,'#ffffff07');shine.addColorStop(.86,'#ffffff00');shine.addColorStop(1,'#ffffff34');ctx.fillStyle=shine;ctx.fillRect(-34,0,68,158);
    ctx.restore();
    const glow=frame.invalid?'#ff8e94':frame.hintRole==='source'?'#f5d38e':frame.hintRole==='target'?'#83e0d4':frame.selected?'#f5d38e':null;
    if(glow){ctx.save();ctx.globalAlpha=frame.invalid?.55*frame.invalidStrength:frame.hintRole?frame.hintStrength:1;ctx.shadowColor=glow;ctx.shadowBlur=frame.invalid?12:16;outline(ctx,glow,frame.invalid?3:2.4,glow,frame.invalid?3:2.4);ctx.restore();}
    if(frame.invalid){ctx.save();ctx.globalAlpha=.65*frame.invalidStrength;outline(ctx,'#ff8e94',3,'#ffb0b5',1.4);ctx.restore();}else if(frame.selected)outline(ctx,'#f5d38e',1.6,'#f9e1ae',1.8);else outline(ctx,'rgba(200,225,237,.61)',1.6,'rgba(230,243,248,.78)',1.4);
    ctx.strokeStyle='rgba(255,255,255,.32)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-25,14);ctx.lineTo(-25,123);ctx.stroke();ctx.restore();
  }

  private stream(stream:StreamFrame|null){
    if(!stream?.visible)return;const ctx=this.ctx,color=COLORS[stream.color];
    const reveal=stream.reveal,controlX=stream.start.x+(stream.control.x-stream.start.x)*reveal,controlY=stream.start.y+(stream.control.y-stream.start.y)*reveal;
    const nextX=stream.control.x+(stream.end.x-stream.control.x)*reveal,nextY=stream.control.y+(stream.end.y-stream.control.y)*reveal;
    const endX=controlX+(nextX-controlX)*reveal,endY=controlY+(nextY-controlY)*reveal;
    ctx.save();ctx.globalAlpha=stream.alpha;ctx.strokeStyle=color;ctx.lineCap='butt';ctx.lineWidth=4.2*stream.widthScale;ctx.shadowColor=color;ctx.shadowBlur=5;ctx.beginPath();ctx.moveTo(stream.start.x,stream.start.y);ctx.quadraticCurveTo(controlX,controlY,endX,endY);ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,255,255,.38)';ctx.lineWidth=1.15*stream.widthScale;ctx.beginPath();ctx.moveTo(stream.start.x,stream.start.y);ctx.quadraticCurveTo(controlX,controlY,endX,endY);ctx.stroke();ctx.restore();
  }

  render(frame:RenderFrame){
    const ctx=this.ctx,sx=this.width/W,sy=this.height/H;ctx.setTransform(this.density,0,0,this.density,0,0);ctx.clearRect(0,0,this.width,this.height);ctx.fillStyle='#071219';ctx.fillRect(0,0,this.width,this.height);ctx.setTransform(this.density*sx,0,0,this.density*sy,0,0);
    const moving=frame.glasses[0].moving?0:frame.glasses[1].moving?1:-1;if(moving===0){this.glass(frame.glasses[1]);this.glass(frame.glasses[0]);}else{this.glass(frame.glasses[0]);this.glass(frame.glasses[1]);}this.stream(frame.stream);
  }
}
