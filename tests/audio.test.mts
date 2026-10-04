import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventAudio} from '../src/platform/audio.ts';
test('audio requires unlock, suppresses overlap bursts and independently mutes background and sound',async()=>{
 let count=0,resumes=0;
 const context={currentTime:0,state:'suspended',resume:async()=>{resumes++;},suspend:async()=>{},destination:{},createOscillator:()=>({type:'sine',frequency:{setValueAtTime(){}},connect(){},start(){count++;},stop(){},disconnect(){},onended:null}),createGain:()=>({gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}})};
 const a=new EventAudio(true,()=>context as unknown as AudioContext);
 a.play('select',0);assert.equal(count,0);await a.unlock();a.play('contact',10);a.play('contact',11);assert.equal(count,1);
 a.setBackground(true);a.play('complete',200);assert.equal(count,1);a.setBackground(false);a.setEnabled(false);a.play('ui',400);assert.equal(count,1);
 a.setEnabled(true);await a.unlock();a.play('complete',600);assert.equal(count,2);assert.ok(resumes>=1);
});
