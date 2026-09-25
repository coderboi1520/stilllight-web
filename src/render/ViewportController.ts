import { H,W } from '../core/constants.ts';

export type ViewportState={width:number;height:number;density:number;scale:number;backingWidth:number;backingHeight:number};
export function viewportState(width:number,height:number,dpr:number):ViewportState{const density=Math.max(1,Math.min(dpr||1,2)),w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));return{width:w,height:h,density,scale:Math.min(w/W,h/H),backingWidth:Math.round(w*density),backingHeight:Math.round(h*density)};}

export class ViewportController{
  private observer:ResizeObserver|null=null;
  private last='';
  private board:HTMLElement;
  private apply:(state:ViewportState)=>void;
  private invalidate:()=>void;
  constructor(board:HTMLElement,apply:(state:ViewportState)=>void,invalidate:()=>void){this.board=board;this.apply=apply;this.invalidate=invalidate;}
  start(){const sync=()=>this.sync();this.observer=new ResizeObserver(sync);this.observer.observe(this.board);window.addEventListener('resize',sync,{passive:true});this.sync();}
  sync(){const r=this.board.getBoundingClientRect(),state=viewportState(r.width,r.height,window.devicePixelRatio||1),key=`${state.width}x${state.height}@${state.density}`;if(key===this.last)return;this.last=key;this.apply(state);this.invalidate();}
  stop(){this.observer?.disconnect();this.observer=null;}
}
