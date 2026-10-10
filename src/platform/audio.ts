import {loadAmbientMusic} from './music.ts';
export const SOUND_KEY='stilllight.sound.enabled';
export const MUSIC_KEY='stilllight.music.enabled';
function readEnabled(key:string){try{return localStorage.getItem(key)!=='false';}catch{return true;}}
export function readSound(){return readEnabled(SOUND_KEY);}
export function readMusic(){return readEnabled(MUSIC_KEY);}
export type AudioEvent='select'|'deselect'|'contact'|'stream'|'invalid'|'glassComplete'|'complete'|'undo'|'hint'|'resetTick'|'resetConfirm'|'toggleOn'|'toggleOff'|'settingsOpen'|'settingsClose'|'ui';
export class EventAudio{
 private context:AudioContext|null=null;
 private unlocked=false;
 private background=false;
 private disposed=false;
 private unlocking:Promise<void>|null=null;
 private pending:{event:AudioEvent;now:number}|null=null;
 private lastContact=-Infinity;
 private voices=new Set<AudioScheduledSourceNode>();
 private streams=new Map<number,{source:AudioBufferSourceNode;gain:GainNode;filter:BiquadFilterNode}>();
 private noiseBuffer:AudioBuffer|null=null;
 private lastInvalid=-Infinity;
 private streamUnavailable=false;
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
 private stopVoices(){for(const osc of this.voices){try{osc.stop();}catch{}osc.disconnect();}this.voices.clear();this.streams.clear();}
 private noise(){
  if(this.noiseBuffer)return this.noiseBuffer;const ctx=this.context!;const buffer=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate),data=buffer.getChannelData(0);let seed=1520;
  for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}return this.noiseBuffer=buffer;
 }
 private tone(frequency:number,duration:number,peak:number,delay=0,type:OscillatorType='sine',to=frequency){
  const ctx=this.context!;if(this.voices.size>=6||!this.soundBus)return;const t=ctx.currentTime+delay,osc=ctx.createOscillator(),gain=ctx.createGain();this.voices.add(osc);
  osc.type=type;osc.frequency.setValueAtTime(frequency,t);if(to!==frequency)osc.frequency.linearRampToValueAtTime(to,t+duration);
  gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(peak,t+.012);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
  osc.connect(gain);gain.connect(this.soundBus);osc.onended=()=>{this.voices.delete(osc);osc.disconnect();gain.disconnect();};osc.start(t);osc.stop(t+duration+.015);
 }
 private noiseVoice(duration:number,peak:number,frequency:number,type:BiquadFilterType='bandpass',reverse=false){
  const ctx=this.context!;if(this.voices.size>=6||!this.soundBus)return;const t=ctx.currentTime,source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=this.noise();filter.type=type;filter.frequency.setValueAtTime(frequency,t);filter.Q.setValueAtTime(3,t);
  gain.gain.setValueAtTime(reverse?peak:.0001,t);if(!reverse)gain.gain.linearRampToValueAtTime(peak,t+.015);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);source.connect(filter);filter.connect(gain);gain.connect(this.soundBus);this.voices.add(source);
  source.onended=()=>{this.voices.delete(source);source.disconnect();filter.disconnect();gain.disconnect();};source.start(t);source.stop(t+duration+.015);
 }
 duckMusic(){const ctx=this.context;if(!ctx||!this.musicBus||!this.musicEnabled||this.background)return;const t=ctx.currentTime,g=this.musicBus.gain;g.cancelScheduledValues(t);g.setValueAtTime(.32,t);g.linearRampToValueAtTime(.25,t+.1);g.setValueAtTime(.25,t+1.5);g.linearRampToValueAtTime(.32,t+1.6);}
 syncStreams(flights:readonly {id:number;progress:number}[]){
  const ctx=this.context;if(!ctx||ctx.state!=='running'||this.streamUnavailable||!this.soundBus||!this.enabled||!this.unlocked||this.background||this.disposed)return;
  try{
  const alive=new Set(flights.map(f=>f.id));
  for(const [id,voice] of this.streams)if(!alive.has(id)){const t=ctx.currentTime;voice.gain.gain.cancelScheduledValues(t);voice.gain.gain.setValueAtTime(voice.gain.gain.value,t);voice.gain.gain.linearRampToValueAtTime(0,t+.14);voice.source.stop(t+.15);this.streams.delete(id);}
  for(const flight of flights){let voice=this.streams.get(flight.id);if(!voice&&this.voices.size<6){const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),t=ctx.currentTime;source.buffer=this.noise();source.loop=true;filter.type='bandpass';filter.Q.setValueAtTime(3,t);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.010,t+.04);source.connect(filter);filter.connect(gain);gain.connect(this.soundBus);voice={source,filter,gain};this.streams.set(flight.id,voice);this.voices.add(source);source.onended=()=>{this.voices.delete(source);if(this.streams.get(flight.id)?.source===source)this.streams.delete(flight.id);source.disconnect();filter.disconnect();gain.disconnect();};source.start(t);}
   voice?.filter.frequency.setValueAtTime(350+550*Math.max(0,Math.min(1,flight.progress)),ctx.currentTime);
  }
  }catch{this.streamUnavailable=true;this.stopVoices();}
 }
 play(event:AudioEvent,now:number){
  if(!this.enabled||this.background||this.disposed)return;
  if(!this.unlocked||this.context?.state==='suspended'){if(this.unlocking)this.pending={event,now};return;}
  if(!this.context||!this.soundBus||this.voices.size>=6)return;
  if(event==='contact'&&now-this.lastContact<100)return;if(event==='contact')this.lastContact=now;
  try{
  switch(event){
   case 'select':this.tone(510,.09,.030);this.tone(1020,.09,.030*10**(-10/20));break;
   case 'deselect':this.tone(420,.075,.018);break;
   case 'invalid':{const peak=now-this.lastInvalid<1200?.014:.024;this.lastInvalid=now;this.tone(170,.110,peak,0,'triangle');this.noiseVoice(.03,peak*.6,900);break;}
   case 'contact':this.tone(720,.16,.028,0,'sine',640);this.tone(1440,.16,.028*10**(-14/20));break;
   case 'glassComplete':this.tone(1320,.26,.034);this.tone(1980,.26,.034*10**(-9/20));this.tone(3640,.26,.034*10**(-14/20));break;
   case 'complete':this.tone(659,.42,.040);this.tone(880,.42,.042,.14);this.tone(1319,.42,.045,.28);break;
   case 'undo':this.tone(520,.22,.022,0,'sine',330);break;
   case 'hint':this.tone(784,.3,.020);this.tone(784,.3,.010,.12);break;
   case 'resetTick':this.tone(300,.04,.012);break;
   case 'resetConfirm':this.tone(196,.18,.032);this.tone(392,.18,.016);break;
   case 'toggleOn':this.tone(480,.07,.020);this.tone(720,.07,.020,.07);break;
   case 'toggleOff':this.tone(360,.08,.016);break;
   case 'settingsOpen':case 'settingsClose':this.noiseVoice(.12,.012,700,'lowpass',event==='settingsClose');this.tone(220,.08,.012);break;
   case 'ui':this.tone(390,.075,.028);break;
   case 'stream':break; // Sustained noise belongs to syncStreams' bounded flight lifecycle.
  }
  }catch{/* Optional feedback never interrupts a move. */}
 }
 async dispose(){this.disposed=true;this.pending=null;this.stopVoices();this.stopMusic();await this.context?.close().catch(()=>{});this.context=null;}
}
