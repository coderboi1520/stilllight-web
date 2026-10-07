import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameSession} from '../src/session/session.ts';
test('tutorial guidance follows real selection, settled moves, Undo and skip',async()=>{
 const {tutorialGuide}=await import('../src/session/tutorial.ts');const s=new GameSession();s.start();assert.equal(tutorialGuide(s)?.target,0);assert.equal(tutorialGuide(s)?.text,'Tap this glass.');
 s.model.choose(0,0);assert.equal(tutorialGuide(s)?.target,2);assert.equal(tutorialGuide(s)?.text,'Now tap the empty glass.');s.model.choose(2,1);assert.equal(tutorialGuide(s),null);
 for(let t=1;t<4000;t+=80){s.model.sample(t);s.model.advanceAfterFrame(t);}assert.equal(tutorialGuide(s)?.target,1);s.model.choose(1,4001);assert.equal(tutorialGuide(s)?.target,0);
 s.model.choose(0,4002);for(let t=4002;t<8000;t+=80){s.model.sample(t);s.model.advanceAfterFrame(t);}assert.ok(s.model.undo(8001));for(let t=8001;t<12000;t+=80){s.model.sample(t);s.model.advanceAfterFrame(t);}assert.equal(tutorialGuide(s)?.target,1);s.product.tutorialDismissed=true;assert.equal(tutorialGuide(s),null);
 const active=s.snapshot().active;s.replayTutorial();assert.equal(tutorialGuide(s)?.target,0);s.home();assert.deepEqual(s.snapshot().active,active);
});
test('authorized feedback boundary forwards audio unlock, sound and vibration to preference-aware engines',async()=>{const {FeedbackCapability}=await import('../src/platform/feedbackCapability.ts');const calls:string[]=[];const f=new FeedbackCapability({unlock:()=>{calls.push('unlock');},play:e=>{calls.push(e);}},{trigger:e=>{calls.push(e);}});f.unlock();f.sound('contact');f.haptic('pourContact');assert.deepEqual(calls,['unlock','contact','pourContact']);});
