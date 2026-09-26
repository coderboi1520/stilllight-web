import { H,W } from '../core/constants.ts';

export type ViewportState={width:number;height:number;density:number;scale:number;backingWidth:number;backingHeight:number};
export function viewportState(width:number,height:number,dpr:number):ViewportState{const density=Math.max(1,Math.min(dpr||1,2)),w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));return{width:w,height:h,density,scale:Math.min(w/W,h/H),backingWidth:Math.round(w*density),backingHeight:Math.round(h*density)};}

export class ViewportController{
  private observer:ResizeObserver|null=null;
  private dprQuery:MediaQueryList|null=null;
  private last='';
  private board:HTMLElement;
  private apply:(state:ViewportState)=>void;
  private invalidate:()=>void;
  private syncHandler=()=>this.sync();
  private dprHandler=()=>{this.bindDprWatcher();this.sync();};
  constructor(board:HTMLElement,apply:(state:ViewportState)=>void,invalidate:()=>void){this.board=board;this.apply=apply;this.invalidate=invalidate;}
  private bindDprWatcher(){this.dprQuery?.removeEventListener('change',this.dprHandler);const dpr=window.devicePixelRatio||1;this.dprQuery=window.matchMedia(`(resolution: ${dpr}dppx)`);this.dprQuery.addEventListener('change',this.dprHandler);}
  start(){this.observer=new ResizeObserver(this.syncHandler);this.observer.observe(this.board);window.addEventListener('resize',this.syncHandler,{passive:true});this.bindDprWatcher();this.sync();}
  sync(){const r=this.board.getBoundingClientRect(),state=viewportState(r.width,r.height,window.devicePixelRatio||1),key=`${state.width}x${state.height}@${state.density}`;if(key===this.last)return;this.last=key;this.apply(state);this.invalidate();}
  stop(){this.observer?.disconnect();this.observer=null;window.removeEventListener('resize',this.syncHandler);this.dprQuery?.removeEventListener('change',this.dprHandler);this.dprQuery=null;}
}
