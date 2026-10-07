import test from 'node:test';
import assert from 'node:assert/strict';
import {EventAudio} from '../src/platform/audio.ts';
import {buildAmbientLoop} from '../src/platform/music.ts';

function audioFixture(){
 const counts={factories:0,tones:0,loops:0,stops:0,suspends:0,resumes:0};
 const param=()=>({value:1,setValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){},linearRampToValueAtTime(){}});
 const ctx={currentTime:0,state:'suspended',destination:{},
  resume:async()=>{counts.resumes++;ctx.state='running';},suspend:async()=>{counts.suspends++;ctx.state='suspended';},close:async()=>{ctx.state='closed';},
  createGain:()=>({gain:param(),connect(){},disconnect(){}}),
  createOscillator:()=>({frequency:param(),type:'sine',onended:null as null|(()=>void),connect(){},disconnect(){},start(){counts.tones++;},stop(){this.onended?.();}}),
  createBuffer:(_channels:number,length:number,rate:number)=>({duration:length/rate,getChannelData:()=>new Float32Array(length)}),
  createBufferSource:()=>({buffer:null,loop:false,connect(){},disconnect(){},start(){counts.loops++;},stop(){counts.stops++;}}),
 };
 return{ctx,counts,factory:()=>{counts.factories++;return ctx as unknown as AudioContext;}};
}
test('audio waits for activation, reuses one context/loop and keeps sound and music independent',async()=>{
 const f=audioFixture(),a=new EventAudio(true,f.factory,true,async()=>f.ctx.createBuffer(1,32*8000,8000) as unknown as AudioBuffer);
 a.play('select',0);assert.equal(f.counts.factories,0);
 await a.unlock();await a.unlock();assert.equal(f.counts.factories,1);assert.equal(f.counts.loops,1);
 a.setEnabled(false);a.play('select',100);assert.equal(f.counts.tones,0);assert.equal(f.ctx.state,'running');
 a.setEnabled(true);await a.unlock();a.setMusicEnabled(false);a.play('complete',300);
 assert.equal(f.counts.tones,1);assert.equal(f.counts.stops,1);assert.equal(f.ctx.state,'running');
 a.setMusicEnabled(true);await a.unlock();assert.equal(f.counts.loops,2);a.setBackground(true);a.play('ui',500);
 assert.equal(f.counts.tones,1);assert.equal(f.ctx.state,'suspended');
 a.setBackground(false);await a.unlock();assert.equal(f.ctx.state,'running');assert.equal(f.counts.loops,2);
 a.setMusicEnabled(false);a.setEnabled(false);assert.equal(f.ctx.state,'suspended');await a.dispose();assert.equal(f.ctx.state,'closed');
});
test('the first gesture sound is delivered after resume; backgrounding during resume prevents late playback',async()=>{
 const f=audioFixture();let resume!:()=>void;f.ctx.resume=()=>new Promise<void>(r=>{resume=()=>{f.ctx.state='running';r();};});
 const a=new EventAudio(true,f.factory);const pending=a.unlock();a.play('select',1);resume();await pending;assert.equal(f.counts.tones,1);
 f.ctx.state='suspended';const second=a.unlock();a.play('ui',200);a.setBackground(true);resume();await second;assert.equal(f.counts.tones,1);assert.equal(f.ctx.state,'suspended');
});
test('muted preferences never create audio and an unavailable audio backend cannot break input',async()=>{
 let factories=0;const a=new EventAudio(false,()=>{factories++;throw Error('unavailable');},false);
 await a.unlock();assert.equal(factories,0);a.setMusicEnabled(true);await assert.doesNotReject(a.unlock());assert.equal(factories,1);
 a.setMusicEnabled(false);a.setEnabled(true);await assert.doesNotReject(a.unlock());assert.equal(factories,2);
});
test('foreground restores a first activation interrupted by backgrounding without another user gesture',async()=>{
 const f=audioFixture();let resume!:()=>void;f.ctx.resume=()=>new Promise<void>(r=>{resume=()=>{f.ctx.state='running';r();};});
 const a=new EventAudio(true,f.factory);const first=a.unlock();a.setBackground(true);resume();await first;assert.equal(f.ctx.state,'suspended');
 f.ctx.resume=async()=>{f.ctx.state='running';};a.setBackground(false);await Promise.resolve();await Promise.resolve();assert.equal(f.ctx.state,'running');
});
test('original ambient loop contains finite audible samples with a bounded, continuous loop seam',()=>{
 const samples=buildAmbientLoop(8000);assert.equal(samples.length,32*8000);
 let peak=0,energy=0,largestStep=0;for(let i=0;i<samples.length;i++){assert.ok(Number.isFinite(samples[i]));peak=Math.max(peak,Math.abs(samples[i]));energy+=samples[i]**2;if(i)largestStep=Math.max(largestStep,Math.abs(samples[i]-samples[i-1]));}
 assert.ok(peak>0.01&&peak<1);assert.ok(Math.sqrt(energy/samples.length)>0.005);assert.ok(Math.abs(samples[0]-samples[samples.length-1])<=largestStep*1.5);
 assert.notDeepEqual(samples.slice(0,8000),samples.slice(8000,16000),'music changes over time rather than holding one tone');
});
