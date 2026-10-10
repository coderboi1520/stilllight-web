import { Texture } from 'pixi.js';
import {drawGlassGlow,drawBodyShadow,drawGlassRim,drawGlassBase,drawGlassEdge,drawGlassShine,makeSweepArtwork} from '../glassMaterial.ts';

let assetDensity=Math.min(typeof devicePixelRatio==='number'&&devicePixelRatio>0?devicePixelRatio:1,2);
const sharedTextures=new Map<string,{texture:Texture;references:number}>();
const textureKeys=new Map<Texture,string>();
function shared(key:string,create:()=>Texture){key=`${assetDensity}:${key}`;let entry=sharedTextures.get(key);if(!entry){entry={texture:create(),references:0};sharedTextures.set(key,entry);textureKeys.set(entry.texture,key);}entry.references++;return entry.texture;}
export function releaseTexture(texture:Texture){const key=textureKeys.get(texture);if(key===undefined){texture.destroy(true);return;}const entry=sharedTextures.get(key)!;if(--entry.references===0){sharedTextures.delete(key);textureKeys.delete(texture);texture.destroy(true);}}
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
 return shared('liquid-depth',()=>{
  const canvas=document.createElement('canvas');
  canvas.width=2;canvas.height=316;
  const ctx=canvas.getContext('2d')!;
  const depth=ctx.createLinearGradient(0,0,0,316);
  depth.addColorStop(0,'#ffffff');
  depth.addColorStop(1,'#dedede');
  ctx.fillStyle=depth;ctx.fillRect(0,0,2,316);
  return rawCanvasTexture(canvas);});
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

export function makeBodyShadowTexture(){return shared('body-shadow',()=>canvasTexture(drawBodyShadow));}
export function makeGlowTexture(color:string,width:number,blur:number,includeStroke=true){
  // Canvas shadowBlur is device-space rather than transform-scaled. Bake at the
  // the scene's capped DPR so logical glow coverage matches at 1x/2x.
  return shared(`glow:${color}:${width}:${blur}:${includeStroke}`,()=>canvasTexture(ctx=>drawGlassGlow(ctx,color,width,blur,includeStroke),cappedDensity()));
}

export function makeGlassRimTexture(){return shared('glass-rim',()=>canvasTexture(drawGlassRim));}
export function makeGlassBaseTexture(){return shared('glass-base',()=>glassSurfaceTexture(drawGlassBase));}
export function makeGlassEdgeTexture(){return shared('glass-edge',()=>glassSurfaceTexture(drawGlassEdge));}
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
 return shared('stream-halo',()=>{
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
  return rawCanvasTexture(canvas);});
}

export function makeShineTexture(){return shared('glass-shine',()=>glassSurfaceTexture(drawGlassShine));}
export function makeRadialTexture(){return shared('soft-radial',()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!,g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'#ffffff');g.addColorStop(.3,'#ffffffb3');g.addColorStop(1,'#ffffff00');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return rawCanvasTexture(canvas);});}
export function makeLightColumnTexture(){return shared('light-column',()=>glassSurfaceTexture(ctx=>{const g=ctx.createLinearGradient(0,0,0,156);g.addColorStop(0,'#ffffff');g.addColorStop(1,'#ffffff00');ctx.fillStyle=g;ctx.fillRect(14,0,40,156);}));}
export function makeSweepTexture(){return shared('collar-sweep',()=>rawCanvasTexture(makeSweepArtwork()));}
