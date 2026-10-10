export class HoldConfirmation{
 armed=false;
 private keyAt=-Infinity;
 private timer:any=null;
 private ticks:any[]=[];
 private holding=false;
 private accept:()=>void;private now:()=>number;private later:(f:()=>void,ms:number)=>any;private clear:(id:any)=>void;private holdMs:number;private onTick:()=>void;
 constructor(accept:()=>void,now=()=>performance.now(),later:(f:()=>void,ms:number)=>any=(f,ms)=>setTimeout(f,ms),clear:(id:any)=>void=id=>clearTimeout(id),holdMs=800,onTick:()=>void=()=>{}){this.accept=accept;this.now=now;this.later=later;this.clear=clear;this.holdMs=holdMs;this.onTick=onTick;}
 press(){this.cancel();this.holding=true;this.ticks=[1/3,2/3].map(q=>this.later(()=>{if(this.holding)this.onTick();},this.holdMs*q));this.timer=this.later(()=>{if(!this.holding)return;this.timer=null;this.holding=false;this.accept();},this.holdMs);}
 release(){const early=this.holding;this.cancel();return early;}
 key(repeat=false){if(repeat)return false;const t=this.now();if(this.armed&&t-this.keyAt<=2000){this.cancel();this.accept();return true;}this.cancel();this.armed=true;this.keyAt=t;this.timer=this.later(()=>this.cancel(),2000);return false;}
 cancel(){if(this.timer!==null)this.clear(this.timer);for(const tick of this.ticks)this.clear(tick);this.ticks=[];this.timer=null;this.holding=false;this.armed=false;this.keyAt=-Infinity;}
}
