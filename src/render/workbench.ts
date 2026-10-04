import type {RenderFrame} from '../core/RenderFrame.ts';
export type Presentation='game'|'workbench';
// A static arrangement of existing frame objects. No frame/model mutation or new clock.
export function workbenchProps(frame:RenderFrame){
 const indices=frame.glasses.filter(g=>g.layers.some(l=>l.amount>0)).slice(0,3).map(g=>g.index);
 for(const g of frame.glasses){if(indices.length===3)break;if(!indices.includes(g.index))indices.push(g.index);}
 return indices.map((index,i)=>({index,x:[96,200,304][i],y:[52,32,59][i],scale:[.64,.82,.60][i]}));
}
