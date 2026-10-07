import {loadAmbientMusic} from './music.ts';
export const SOUND_KEY='stilllight.sound.enabled';
export const MUSIC_KEY='stilllight.music.enabled';
function readEnabled(key:string){try{return localStorage.getItem(key)!=='false';}catch{return true;}}
export function readSound(){return readEnabled(SOUND_KEY);}
export function readMusic(){return readEnabled(MUSIC_KEY);}
export type AudioEvent='select'|'contact'|'invalid'|'complete'|'ui';
export class EventAudio{
 private context:AudioContext|null=null;
 private unlocked=false;
 private background=false;
 private disposed=false;
 private unlocking:Promise<void>|null=null;
 private pending:{event:AudioEvent;now:number}|null=null;
 private lastContact=-Infinity;
 private voices=new Set<OscillatorNode>();
 private soundBus:GainNode|null=null;
 private musicBus:GainNode|null=null;
 private musicBuffer:AudioBuffer|null=null;
 private musicLoading:Promise<AudioBuffer>|null=null;
 private musicSource:AudioBufferSourceNode|null=null;
 private musicStarted=0;
 private musicOffset=0;
 private enabled:boolean;
 private musicEnabled:boolean;
 private factory:()=>AudioContext;
 private musicLoader:typeof loadAmbientMusic;
 constructor(enabled:boolean,factory=()=>new AudioContext(),musicEnabled=false,musicLoader=loadAmbientMusic){this.enabled=enabled;this.factory=factory;this.musicEnabled=musicEnabled;this.musicLoader=musicLoader;}
 async unlock(){
  if(this.disposed||this.background||!this.enabled&&!this.musicEnabled)return;
  if(this.unlocking)return this.unlocking;
  try{
   const ctx=this.context??=this.factory();
   if(!this.soundBus){this.soundBus=ctx.createGain();this.soundBus.connect(ctx.destination);}this.setSoundGain();
   this.unlocking=(async()=>{
    try{
     await ctx.resume();
     // A mute/background transition can queue suspend while resume is pending.
     if(!this.disposed&&!this.background&&(this.enabled||this.musicEnabled)&&ctx.state==='suspended')await ctx.resume();
     this.unlocked=true;
     if(this.disposed||this.background||!this.enabled&&!this.musicEnabled){await ctx.suspend().catch(()=>{});this.pending=null;return;}
     const pending=this.pending;this.pending=null;if(pending)this.play(pending.event,pending.now);
     await this.startMusic();
    }catch{this.pending=null;}
   })();
   await this.unlocking;
  }catch{this.pending=null;}
  finally{this.unlocking=null;}
 }
 setEnabled(value:boolean){this.enabled=value;this.setSoundGain();if(!value){this.pending=null;this.stopVoices();}this.suspendIfMuted();}
 setMusicEnabled(value:boolean){this.musicEnabled=value;if(!value)this.stopMusic();else if(this.unlocked&&!this.background)void this.startMusic();this.suspendIfMuted();}
 setBackground(value:boolean){
  this.background=value;if(value){this.pending=null;this.stopVoices();void this.context?.suspend().catch(()=>{});}
  else if(this.unlocked)void this.unlock();
 }
 private setSoundGain(){if(this.soundBus&&this.context)this.soundBus.gain.setValueAtTime(this.enabled?1:0,this.context.currentTime);}
 private suspendIfMuted(){if(!this.enabled&&!this.musicEnabled)void this.context?.suspend().catch(()=>{});}
 private async startMusic(){
  const ctx=this.context;if(!ctx||!this.musicEnabled||this.background||this.disposed||this.musicSource)return;
  try{
   if(!this.musicBuffer){this.musicLoading??=this.musicLoader(ctx);try{this.musicBuffer=await this.musicLoading;}finally{this.musicLoading=null;}}
   if(this.disposed||!this.musicEnabled||this.background||this.context!==ctx||this.musicSource)return;
   if(!this.musicBus){this.musicBus=ctx.createGain();this.musicBus.connect(ctx.destination);}
   this.musicBus.gain.cancelScheduledValues(ctx.currentTime);this.musicBus.gain.setValueAtTime(0,ctx.currentTime);this.musicBus.gain.linearRampToValueAtTime(.32,ctx.currentTime+.3);
   const source=ctx.createBufferSource();source.buffer=this.musicBuffer;source.loop=true;source.connect(this.musicBus);
   source.start(0,this.musicOffset);this.musicStarted=ctx.currentTime;this.musicSource=source;
  }catch{this.stopMusic();}
 }
 private stopMusic(){
  if(!this.musicSource||!this.context)return;
  this.musicOffset=(this.musicOffset+this.context.currentTime-this.musicStarted)%(this.musicBuffer?.duration??32);
  try{this.musicSource.stop();}catch{}this.musicSource.disconnect();this.musicSource=null;
  this.musicBus?.gain.cancelScheduledValues(this.context.currentTime);this.musicBus?.gain.setValueAtTime(0,this.context.currentTime);
 }
 private stopVoices(){for(const osc of this.voices){try{osc.stop();}catch{}osc.disconnect();}this.voices.clear();}
 play(event:AudioEvent,now:number){
  if(!this.enabled||this.background||this.disposed)return;
  if(!this.unlocked||this.context?.state==='suspended'){if(this.unlocking)this.pending={event,now};return;}
  if(!this.context||!this.soundBus||this.voices.size>=3)return;
  if(event==='contact'&&now-this.lastContact<100)return;if(event==='contact')this.lastContact=now;
  try{
  const ctx=this.context,t=ctx.currentTime,duration=event==='complete'?.42:event==='contact'?.16:.075;
  const osc=ctx.createOscillator(),gain=ctx.createGain();this.voices.add(osc);
  osc.type=event==='invalid'?'triangle':'sine';osc.frequency.setValueAtTime(({select:510,contact:720,invalid:170,complete:880,ui:390})[event],t);
  gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(event==='complete'?.045:.028,t+.012);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
  osc.connect(gain);gain.connect(this.soundBus);osc.onended=()=>{this.voices.delete(osc);osc.disconnect();gain.disconnect();};osc.start(t);osc.stop(t+duration+.015);
  }catch{/* Optional feedback never interrupts a move. */}
 }
 async dispose(){this.disposed=true;this.pending=null;this.stopVoices();this.stopMusic();await this.context?.close().catch(()=>{});this.context=null;}
}
