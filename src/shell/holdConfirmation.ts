export class HoldConfirmation{
 armed=false;
 private keyAt=-Infinity;
 private timer:any=null;
 private holding=false;
 private accept:()=>void;private now:()=>number;private later:(f:()=>void,ms:number)=>any;private clear:(id:any)=>void;
 constructor(accept:()=>void,now=()=>performance.now(),later:(f:()=>void,ms:number)=>any=(f,ms)=>setTimeout(f,ms),clear:(id:any)=>void=id=>clearTimeout(id)){this.accept=accept;this.now=now;this.later=later;this.clear=clear;}
 press(){this.cancel();this.holding=true;this.timer=this.later(()=>{if(!this.holding)return;this.timer=null;this.holding=false;this.accept();},600);}
 release(){const early=this.holding;this.cancel();return early;}
 key(repeat=false){if(repeat)return false;const t=this.now();if(this.armed&&t-this.keyAt<=2000){this.cancel();this.accept();return true;}this.cancel();this.armed=true;this.keyAt=t;this.timer=this.later(()=>this.cancel(),2000);return false;}
 cancel(){if(this.timer!==null)this.clear(this.timer);this.timer=null;this.holding=false;this.armed=false;this.keyAt=-Infinity;}
}
