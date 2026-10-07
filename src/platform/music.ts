export const MUSIC_SECONDS=32;
export async function loadAmbientMusic(context:AudioContext):Promise<AudioBuffer>{
 const response=await fetch('/assets/moonlit-ambient.wav');
 if(!response.ok)throw new Error('Music is unavailable.');
 return context.decodeAudioData(await response.arrayBuffer());
}
// Original Moonlit Atelier score: four slow chords and sparse bell notes.
// Render once into a native looping buffer; playback has no JS timer or RAF.
export function buildAmbientLoop(sampleRate=22050):Float32Array{
 const samples=new Float32Array(MUSIC_SECONDS*sampleRate);
 const chords=[[45,52,59],[41,48,57],[48,55,62],[43,50,57]];
 const note=(midi:number,start:number,duration:number,volume:number,bell=false)=>{
  const frequency=440*2**((midi-69)/12),offset=Math.round(start*sampleRate),length=Math.round(duration*sampleRate);
  for(let i=0;i<length;i++){
   const t=i/sampleRate,phase=2*Math.PI*frequency*t;
   const envelope=bell?Math.min(1,t/.02)*Math.exp(-t*2.2)*(1-t/duration):Math.min(1,t/1.8)*Math.min(1,(duration-t)/3);
   const tone=bell?Math.sin(phase)*.8+Math.sin(phase*2)*.15:Math.sin(phase)*.8+Math.sin(phase*2)*.12;
   samples[(offset+i)%samples.length]+=tone*envelope*volume;
  }
 };
 chords.forEach((chord,bar)=>{
  for(const pitch of chord)note(pitch,bar*8,12,.035);
  [chord[1]+12,chord[2]+12,chord[0]+24,chord[2]+12].forEach((pitch,i)=>note(pitch,bar*8+i*2+.5,3,.025,true));
 });
 return samples;
}
