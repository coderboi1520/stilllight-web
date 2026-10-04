export const SOUND_KEY='stilllight.sound.enabled';
export function readSound(){try{return localStorage.getItem(SOUND_KEY)!=='false';}catch{return true;}}
export type AudioEvent='select'|'contact'|'invalid'|'complete'|'ui';
export class EventAudio{
 private context:AudioContext|null=null;
 private unlocked=false;
 private background=false;
 private lastContact=-Infinity;
 private voices=0;
 private enabled:boolean;
 private factory:()=>AudioContext;
 constructor(enabled:boolean,factory=()=>new AudioContext()){this.enabled=enabled;this.factory=factory;}
 async unlock(){if(!this.enabled||this.background)return;try{this.context??=this.factory();await this.context.resume();this.unlocked=true;}catch{}}
 setEnabled(value:boolean){this.enabled=value;if(!value)void this.context?.suspend().catch(()=>{});}
 setBackground(value:boolean){this.background=value;if(value)void this.context?.suspend().catch(()=>{});}
 play(event:AudioEvent,now:number){
  if(!this.enabled||!this.unlocked||this.background||!this.context||this.voices>=3)return;
  if(event==='contact'&&now-this.lastContact<100)return;if(event==='contact')this.lastContact=now;
  const ctx=this.context,t=ctx.currentTime,duration=event==='complete'?.42:event==='contact'?.16:.075;
  const osc=ctx.createOscillator(),gain=ctx.createGain();this.voices++;
  osc.type=event==='invalid'?'triangle':'sine';osc.frequency.setValueAtTime(({select:510,contact:720,invalid:170,complete:880,ui:390})[event],t);
  gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(event==='complete'?.045:.028,t+.012);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
  osc.connect(gain);gain.connect(ctx.destination);osc.onended=()=>{this.voices--;osc.disconnect();gain.disconnect();};osc.start(t);osc.stop(t+duration+.015);
 }
}
