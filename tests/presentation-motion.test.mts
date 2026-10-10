import test from 'node:test';
import assert from 'node:assert/strict';
import {StilllightModel} from '../src/core/model.ts';
import {gameplayLayout} from '../src/render/gameplayLayout.ts';
import {HoldConfirmation} from '../src/shell/holdConfirmation.ts';
import {HapticEngine} from '../src/platform/haptics.ts';
const make=()=>{const m=new StilllightModel([[2,0,3],[3]]);m.setPresentationGeometry(gameplayLayout(390,844,2).profile);return m;};
test('Reset requires the full hold, emits two progress ticks, and cancellation removes all pending feedback',()=>{
 let now=0,accepted=0;const ticks:number[]=[],jobs=new Map<number,{at:number;fn:()=>void}>();let id=0;
 const later=(fn:()=>void,ms:number)=>{jobs.set(++id,{at:now+ms,fn});return id;};
 const step=(to:number)=>{while(true){const next=[...jobs].sort((a,b)=>a[1].at-b[1].at).find(([,j])=>j.at<=to);if(!next)break;now=next[1].at;jobs.delete(next[0]);next[1].fn();}now=to;};
 const hold=new HoldConfirmation(()=>accepted++,()=>now,later,id=>jobs.delete(id),800,()=>ticks.push(now));
 hold.press();step(799);assert.equal(accepted,0);assert.equal(ticks.length,2);step(800);assert.equal(accepted,1);
 hold.press();step(1000);assert.equal(hold.release(),true);step(2000);assert.equal(accepted,1);assert.equal(ticks.length,2);
 assert.equal(hold.key(),false);now+=20;assert.equal(hold.key(true),false);now+=20;assert.equal(hold.key(),true);assert.equal(accepted,2);
});
test('Vibration OFF suppresses even forced switch feedback',()=>{
 const calls:string[]=[];const h=new HapticEngine(false,{perform:k=>{calls.push(k);}});h.trigger('toggleOff',true);h.trigger('undo',true);assert.deepEqual(calls,[]);
 h.setEnabled(true);h.trigger('undo');assert.deepEqual(calls,['undo']);h.setBackground(true);h.trigger('hint',true);assert.deepEqual(calls,['undo']);
});
test('repeated rejection haptics stay quiet for 800 milliseconds',()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'performance')!;let now=0;const calls:string[]=[];
 try{Object.defineProperty(globalThis,'performance',{value:{now:()=>now},configurable:true});const h=new HapticEngine(true,{perform:k=>{calls.push(k);}});h.trigger('reject');now=500;h.trigger('reject');assert.equal(calls.length,1);now=800;h.trigger('reject');assert.equal(calls.length,2);}finally{Object.defineProperty(globalThis,'performance',previous);}
});
test('already muted haptics do not dispatch idle cancellation calls on background transitions',()=>{
 const calls:string[]=[];const h=new HapticEngine(false,{perform:k=>{calls.push(k);},cancel:()=>{calls.push('cancel');}});h.setBackground(true);h.setEnabled(false);assert.deepEqual(calls,[]);
});
test('reduced-motion selection has a limited lift and a visible stationary pour stream',()=>{
 const m=make();m.reducedMotion=true;m.choose(0,0);const home=m.geometry.position(0);assert.ok(Math.abs(m.sample(120).glasses[0].pose.y-(home.y-8))<1e-6);
 m.choose(1,200);const f=m.sample(700);assert.equal(f.glasses[0].pose.angle,0);assert.ok(f.stream?.visible);assert.equal(f.stream?.reveal,1);
});
test('full-motion selection overshoots slightly and the stream detaches after cut-off without volume changes',()=>{
 const m=make();m.choose(0,0);const home=m.geometry.position(0);assert.ok(m.sample(130).glasses[0].pose.y<home.y-18.72);
 m.choose(1,300);const tail=m.sample(300+1040*.77);assert.ok(tail.stream?.visible);assert.ok(tail.stream!.release>0&&tail.stream!.release<1);
 assert.ok(Math.abs(tail.glasses.flatMap(g=>g.layers).reduce((sum,l)=>sum+l.amount,0)-4)<.005);
 const endpoints=structuredClone({start:tail.stream!.start,end:tail.stream!.end,control:tail.stream!.control});
 assert.deepEqual({start:m.sample(300+1040*.80).stream!.start,end:m.sample(300+1040*.80).stream!.end,control:m.sample(300+1040*.80).stream!.control},endpoints);
 assert.equal(m.sample(300+1040*.86).stream,null);
});
test('invalid feedback identifies the target and presses it back while preserving logical state',()=>{
 const m=new StilllightModel([[0],[1]]);m.setPresentationGeometry(gameplayLayout(390,844,2).profile);m.choose(0,0);m.choose(1,250);
 const before=m.exportState(),f=m.sample(460);assert.equal(f.glasses[0].invalidRole,'source');assert.equal(f.glasses[1].invalidRole,'target');assert.ok(f.glasses[1].pose.y>m.geometry.position(1).y+1);assert.deepEqual(m.exportState(),before);
});
test('Hint holds its route longer while leaving contents and history untouched',()=>{
 const m=make(),before=m.exportState();m.showHint(0,1,0);const f=m.sample(1800);assert.ok(f.glasses[0].hintStrength>=.55);assert.ok(f.glasses[1].hintStrength>=.55);
 m.advanceAfterFrame(2000);assert.ok(m.hintMotion);m.advanceAfterFrame(2400);assert.equal(m.hintMotion,null);assert.deepEqual(m.exportState(),before);
});
test('reset keeps only the sampled cap exit and surface impulse, with pristine logical contents',()=>{
 const m=new StilllightModel([[2,2,2],[2]]);m.setPresentationGeometry(gameplayLayout(390,844,2).profile);m.choose(0,0);m.choose(1,200);
 for(let t=200;t<2500;t+=10){m.sample(t);m.advanceAfterFrame(t);}assert.equal(m.sample(2500).glasses[1].cap.visible,true);
 m.reset(2500);assert.deepEqual(m.board,[[2,2,2],[2]]);assert.equal(m.moveCount,0);
 assert.equal(m.sample(2500).glasses[1].cap.visible,true);assert.ok(m.sample(2600).glasses[1].cap.alpha<1);assert.ok(m.sample(2650).glasses[0].wave>0);assert.equal(m.sample(2680).glasses[1].cap.visible,false);
});
test('pour droplets have bounded lifetimes, disappear on Reset, and are absent with reduced motion',()=>{
 const m=make();m.choose(0,0);m.choose(1,200);const frame=m.sample(540);
 assert.ok(frame.glasses.reduce((sum,g)=>sum+(g.droplets?.filter(p=>p.visible).length??0),0)>=3);
 m.reset();assert.equal(m.sample(800).glasses.flatMap(g=>g.droplets??[]).filter(p=>p.visible).length,0);
 m.reducedMotion=true;m.choose(0,900);m.choose(1,1100);assert.equal(m.sample(1440).glasses.flatMap(g=>g.droplets??[]).filter(p=>p.visible).length,0);
});
test('simultaneous multi-glass completion keeps the global decorative particle budget bounded',()=>{
 const m=new StilllightModel([[0,0,0],[0],[1,1,1],[1],[2,2,2],[2],[3,3,3],[3]]);m.setPresentationGeometry(gameplayLayout(390,844,8).profile);
 for(let i=0;i<8;i+=2){m.choose(i,0);m.choose(i+1,1);}for(let t=1;t<1300;t+=10){m.sample(t);m.advanceAfterFrame(t);}
 const f=m.sample(1300);assert.ok(f.glasses.reduce((sum,g)=>sum+g.completion.particles.filter(p=>p.visible).length+g.droplets.filter(p=>p.visible).length,0)<=24);
 assert.ok(Math.abs(f.glasses.flatMap(g=>g.layers).reduce((sum,l)=>sum+l.amount,0)-16)<.005);
});
test('detached stream geometry is stable when analytical frames are inspected out of chronological order',()=>{
 const m=make();m.choose(0,0);m.choose(1,200);const first=structuredClone(m.sample(200+1040*.78).stream);
 m.sample(200+1040*.6);const second=m.sample(200+1040*.78).stream;assert.deepEqual(second,first);
});
