export type RequestFrame=(cb:(time:number)=>void)=>number;
export type CancelFrame=(id:number)=>void;
export class FrameGate{
  private pending=false;
  private id=0;
  private parity=false;
  private request:RequestFrame;
  private cancel:CancelFrame;
  private run:(time:number)=>void;
  constructor(request:RequestFrame,cancel:CancelFrame,run:(time:number)=>void){this.request=request;this.cancel=cancel;this.run=run;}
  schedule(){if(this.parity||this.pending)return false;this.pending=true;this.id=this.request(time=>{this.pending=false;if(!this.parity)this.run(time);});return true;}
  enterParity(){if(this.parity)return;this.parity=true;if(this.pending)this.cancel(this.id);this.pending=false;}
  exitParity(){this.parity=false;}
  isParity(){return this.parity;}
  isPending(){return this.pending;}
}
