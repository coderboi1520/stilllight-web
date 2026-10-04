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
test('silent candidate boundary rejects audio unlock/play and haptic dispatch even with saved preferences',async()=>{const {FeedbackCapability}=await import('../src/platform/feedbackCapability.ts');let calls=0;const f=new FeedbackCapability({unlock:()=>{calls++;},play:()=>{calls++;}},{trigger:()=>{calls++;}});f.unlock();f.sound('select');f.haptic('select');assert.equal(calls,0);});
