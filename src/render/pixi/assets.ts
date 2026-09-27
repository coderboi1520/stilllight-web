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

let assetDensity=Math.min(typeof devicePixelRatio==='number'&&devicePixelRatio>0?devicePixelRatio:1,2);
export function configureAssetDensity(density:number){
  const next=Math.max(1,Math.min(density||1,2));
  if(Math.abs(next-assetDensity)<1e-6)return false;
  assetDensity=next;
  return true;
}
function cappedDensity(){return assetDensity;}

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

export function makeLiquidDepthTexture(){
  const canvas=document.createElement('canvas');
  canvas.width=2;canvas.height=316;
  const ctx=canvas.getContext('2d')!;
  const depth=ctx.createLinearGradient(0,0,0,316);
  depth.addColorStop(0,'#ffffff');
  depth.addColorStop(1,'#dedede');
  ctx.fillStyle=depth;ctx.fillRect(0,0,2,316);
  return rawCanvasTexture(canvas);
}

function glassSurfaceTexture(draw:(ctx:CanvasRenderingContext2D)=>void){
  const canvas=document.createElement('canvas');
  canvas.width=136;
  canvas.height=316;
  const ctx=canvas.getContext('2d')!;
  ctx.scale(2,2);
  draw(ctx);
  return rawCanvasTexture(canvas);
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

export function makeGlassRimTexture(){
  return canvasTexture(ctx=>{
    ctx.lineCap='round';
    drawRim(ctx);
    ctx.strokeStyle='rgba(169,202,219,.34)';
    ctx.lineWidth=1.05;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0,0,33,4.5,0,0,Math.PI);
    ctx.strokeStyle='rgba(234,247,250,.62)';
    ctx.lineWidth=1.25;
    ctx.stroke();
  });
}

export function makeGlassBaseTexture(){
  return glassSurfaceTexture(ctx=>{
    const shade=ctx.createLinearGradient(0,118,0,158);
    shade.addColorStop(0,'rgba(4,16,22,0)');
    shade.addColorStop(.58,'rgba(4,16,22,.025)');
    shade.addColorStop(1,'rgba(4,16,22,.107)');
    ctx.fillStyle=shade;
    ctx.fillRect(0,118,68,40);

    ctx.save();
    ctx.translate(34,153);
    ctx.scale(1,.28);
    const lift=ctx.createRadialGradient(0,0,4,0,0,32);
    lift.addColorStop(0,'rgba(225,245,249,.045)');
    lift.addColorStop(.55,'rgba(225,245,249,.018)');
    lift.addColorStop(1,'rgba(225,245,249,0)');
    ctx.fillStyle=lift;
    ctx.fillRect(-34,-34,68,68);
    ctx.restore();
  });
}

export function makeGlassEdgeTexture(){
  return glassSurfaceTexture(ctx=>{
    const fade=ctx.createLinearGradient(0,23,0,111);
    fade.addColorStop(0,'rgba(242,251,255,0)');
    fade.addColorStop(.2,'rgba(242,251,255,.10)');
    fade.addColorStop(.5,'rgba(242,251,255,.22)');
    fade.addColorStop(.8,'rgba(242,251,255,.09)');
    fade.addColorStop(1,'rgba(242,251,255,0)');
    ctx.save();
    ctx.lineCap='round';
    ctx.strokeStyle=fade;
    ctx.lineWidth=1.25;
    ctx.shadowColor='rgba(232,248,253,.14)';
    ctx.shadowBlur=2.4;
    ctx.beginPath();
    ctx.moveTo(61,24);
    ctx.bezierCurveTo(62.7,46,63.2,76,61.4,110);
    ctx.stroke();
    ctx.restore();
  });
}

const STREAM_HALO_SPAN=40;
const STREAM_WIDTH=4.2;
const STREAM_BLUR=10;

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
  return rawCanvasTexture(canvas);
}

export function makeShineTexture(){
  return glassSurfaceTexture(ctx=>{
    ctx.save();
    ctx.translate(15,79);
    ctx.scale(.26,1);
    const g=ctx.createRadialGradient(0,0,0,0,0,70);
    g.addColorStop(0,'rgba(236,249,255,.157)');
    g.addColorStop(.34,'rgba(236,249,255,.101)');
    g.addColorStop(.72,'rgba(236,249,255,.028)');
    g.addColorStop(1,'rgba(236,249,255,0)');
    ctx.fillStyle=g;
    ctx.fillRect(-70,-70,140,140);
    ctx.restore();
  });
}
