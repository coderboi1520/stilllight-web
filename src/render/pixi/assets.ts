import { Texture } from 'pixi.js';

function drawClosedGlassPath(ctx:CanvasRenderingContext2D){
  ctx.beginPath();
  ctx.moveTo(-33,0);
  ctx.lineTo(-33,130);
  ctx.quadraticCurveTo(-33,154,-12,156);
  ctx.lineTo(12,156);
  ctx.quadraticCurveTo(33,154,33,130);
  ctx.lineTo(33,0);
  ctx.closePath();
}

function drawOpenWallPath(ctx:CanvasRenderingContext2D){
  ctx.beginPath();
  ctx.moveTo(-33,0);
  ctx.lineTo(-33,130);
  ctx.quadraticCurveTo(-33,154,-12,156);
  ctx.lineTo(12,156);
  ctx.quadraticCurveTo(33,154,33,130);
  ctx.lineTo(33,0);
}

function drawRim(ctx:CanvasRenderingContext2D){
  ctx.beginPath();
  ctx.ellipse(0,0,33,4.5,0,0,Math.PI*2);
}

function cappedDensity(){
  return Math.min(typeof devicePixelRatio==='number'&&devicePixelRatio>0?devicePixelRatio:1,2);
}

function canvasTexture(draw:(ctx:CanvasRenderingContext2D)=>void,scale=2){
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(180*scale));
  canvas.height=Math.max(1,Math.round(230*scale));
  const ctx=canvas.getContext('2d')!;
  ctx.scale(scale,scale);
  ctx.translate(90,36);
  draw(ctx);
  const texture=Texture.from(canvas);
  texture.source.scaleMode='linear';
  return texture;
}

function rawCanvasTexture(canvas:HTMLCanvasElement){
  const texture=Texture.from(canvas);
  texture.source.scaleMode='linear';
  return texture;
}

let circleTexture:Texture|null=null;
export function getCircleTexture(){
  if(circleTexture)return circleTexture;
  const size=64,canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d')!;
  ctx.beginPath();
  ctx.arc(size/2,size/2,size/2,0,Math.PI*2);
  ctx.fillStyle='#fff';
  ctx.fill();
  circleTexture=rawCanvasTexture(canvas);
  return circleTexture;
}

export function makeBodyShadowTexture(){
  return canvasTexture(ctx=>{
    ctx.fillStyle='rgba(12,31,42,.78)';
    ctx.shadowColor='#000';
    ctx.shadowBlur=7;
    drawClosedGlassPath(ctx);
    ctx.fill();
    ctx.globalCompositeOperation='destination-out';
    ctx.shadowBlur=0;
    ctx.fillStyle='#fff';
    drawClosedGlassPath(ctx);
    ctx.fill();
  });
}

export function makeGlowTexture(color:string,width:number,blur:number){
  // Canvas shadowBlur is device-space rather than transform-scaled. Bake at the
  // same capped DPR as the live oracle so logical glow coverage matches at 1x/2x.
  return canvasTexture(ctx=>{
    ctx.strokeStyle=color;
    ctx.lineWidth=width;
    ctx.shadowColor=color;
    ctx.shadowBlur=blur;
    drawOpenWallPath(ctx);
    ctx.stroke();
    drawRim(ctx);
    ctx.stroke();
  },cappedDensity());
}

const STREAM_HALO_SPAN=40;
const STREAM_WIDTH=5.8;
const STREAM_BLUR=10;
let streamHaloTexture:Texture|null=null;
let streamHaloCapTexture:Texture|null=null;

function drawStreamShadowOnly(ctx:CanvasRenderingContext2D,drawCore:()=>void){
  ctx.strokeStyle='#fff';
  ctx.fillStyle='#fff';
  ctx.shadowColor='#fff';
  ctx.shadowBlur=STREAM_BLUR;
  drawCore();
  ctx.shadowBlur=0;
  ctx.globalCompositeOperation='destination-out';
  drawCore();
}

export function makeStreamHaloTexture(){
  if(streamHaloTexture)return streamHaloTexture;
  const density=cappedDensity();
  const work=document.createElement('canvas');
  const workSize=Math.max(1,Math.round(STREAM_HALO_SPAN*density));
  work.width=work.height=workSize;
  const workCtx=work.getContext('2d')!;
  workCtx.scale(density,density);
  drawStreamShadowOnly(workCtx,()=>{
    workCtx.beginPath();
    workCtx.moveTo(0,STREAM_HALO_SPAN*.5);
    workCtx.lineTo(STREAM_HALO_SPAN,STREAM_HALO_SPAN*.5);
    workCtx.lineWidth=STREAM_WIDTH;
    workCtx.lineCap='butt';
    workCtx.stroke();
  });

  // Sample a center slice, away from the work-canvas endpoints, so the mesh
  // gets the Canvas blur cross-section without endpoint/clipping variation.
  const canvas=document.createElement('canvas');
  const slice=Math.max(1,Math.round(2*density));
  canvas.width=Math.max(2,Math.round(4*density));
  canvas.height=workSize;
  const ctx=canvas.getContext('2d')!;
  ctx.drawImage(work,Math.floor((workSize-slice)*.5),0,slice,workSize,0,0,canvas.width,canvas.height);
  streamHaloTexture=rawCanvasTexture(canvas);
  return streamHaloTexture;
}

export function makeStreamHaloCapTexture(){
  if(streamHaloCapTexture)return streamHaloCapTexture;
  const density=cappedDensity();
  const canvas=document.createElement('canvas');
  const size=Math.max(1,Math.round(STREAM_HALO_SPAN*density));
  canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d')!;
  ctx.scale(density,density);
  drawStreamShadowOnly(ctx,()=>{
    ctx.beginPath();
    ctx.arc(STREAM_HALO_SPAN*.5,STREAM_HALO_SPAN*.5,STREAM_WIDTH*.5,0,Math.PI*2);
    ctx.fill();
  });
  streamHaloCapTexture=rawCanvasTexture(canvas);
  return streamHaloCapTexture;
}

export function makeShineTexture(){
  const canvas=document.createElement('canvas');
  canvas.width=136;
  canvas.height=316;
  const ctx=canvas.getContext('2d')!;
  ctx.scale(2,2);
  const g=ctx.createLinearGradient(0,0,68,0);
  g.addColorStop(0,'#ffffff38');
  g.addColorStop(.18,'#ffffff07');
  g.addColorStop(.86,'#ffffff00');
  g.addColorStop(1,'#ffffff34');
  ctx.fillStyle=g;
  ctx.fillRect(0,0,68,158);
  return rawCanvasTexture(canvas);
}
