import {H,SCENE_TOP_PADDING,W} from '../core/constants.ts';
import {position} from '../core/geometry.ts';

// Keep the former DOM label's 12px text and hit-button-relative position.
// Bake once at capped DPR; both adapters draw it at a fixed CSS text size.
export const NUMBER_WIDTH=64,NUMBER_HEIGHT=32;
export function makeVesselNumbers(count:number):HTMLCanvasElement[]{
  if(count<=2)return []; // The compact development fixture has no labels.
  return Array.from({length:count},(_,i)=>{
    const canvas=document.createElement('canvas');canvas.width=NUMBER_WIDTH*2;canvas.height=NUMBER_HEIGHT*2;
    const ctx=canvas.getContext('2d')!;ctx.scale(2,2);
    ctx.font='12px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='alphabetic';
    ctx.fillStyle='#f3e4c4';ctx.shadowColor='#000';ctx.shadowOffsetY=2;ctx.shadowBlur=5;
    ctx.fillText(String(i+1),NUMBER_WIDTH/2,19);return canvas;
  });
}
export function vesselNumberLayout(index:number,width:number,height:number){
  const p=position(index);
  return {x:p.x*width/W-NUMBER_WIDTH/2,y:(p.y+SCENE_TOP_PADDING-8+H*.28)*height/H-8};
}
