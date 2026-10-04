import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {StilllightModel} from '../src/core/model.ts';
import {CAPACITY,POUR_MS,SETTLE_MS,UNDO_MS} from '../src/core/constants.ts';
import {isBottleComplete} from '../src/core/rules.ts';

const T=10000;
const at=(model:StilllightModel,now:number,index=1)=>({...model.sample(now).glasses[index].cap});

test('completion requires exactly full, nonempty, uniform logical layers',()=>{
  assert.equal(isBottleComplete([]),false);
  assert.equal(isBottleComplete([2,2,2]),false);
  assert.equal(isBottleComplete([2,2,2,3]),false);
  assert.equal(isBottleComplete(Array(CAPACITY).fill(2)),true);
});

test('cap enters once at pour handoff, contacts, rebounds, and reaches exact rest',()=>{
  const model=new StilllightModel();model.board=[[3],[3,3,3]];
  assert.equal(at(model,T).visible,false);
  assert.equal(model.startPour(T),true);
  assert.equal(at(model,T+POUR_MS-1).visible,false);
  model.sample(T+POUR_MS);model.advanceAfterFrame(T+POUR_MS);
  const started=T+POUR_MS;
  const first=at(model,started),early=at(model,started+40),middle=at(model,started+80),late=at(model,started+160),pre=at(model,started+200),contact=at(model,started+210),after=at(model,started+220),firstPeak=at(model,started+294),secondPeak=at(model,started+412),rest=at(model,started+450);
  assert.equal(first.visible,true);assert.equal(first.alpha,1);assert.ok(first.y<=rest.y-40);assert.equal(first.scaleX,1);
  assert.ok(middle.y-early.y>early.y-first.y,'fall accelerates');
  assert.ok(late.y>middle.y&&pre.y<rest.y,'base stays clear before impact');
  assert.equal(contact.y,rest.y);assert.ok(after.y<rest.y,'rebound follows contact');
  assert.ok(rest.y-firstPeak.y>=5&&rest.y-firstPeak.y<=8);
  assert.ok(rest.y-secondPeak.y>=1&&rest.y-secondPeak.y<=2.5);
  assert.ok(firstPeak.y<secondPeak.y,'first rebound exceeds second');
  for(let ms=0;ms<=450;ms+=5)assert.ok(at(model,started+ms).y<=rest.y+1e-9,'cap never penetrates the rim');
  assert.deepEqual(rest,{visible:true,alpha:1,y:rest.y,scaleX:1,scaleY:1,rotation:0});
  model.advanceAfterFrame(started+450);
  const later=at(model,started+800);
  assert.deepEqual(later,rest,'settled cap must not retrigger');
});

test('Undo removes a completed cap and reset clears an active cap motion',()=>{
  const model=new StilllightModel();model.board=[[3],[3,3,3]];
  assert.equal(model.startPour(T),true);
  model.sample(T+POUR_MS);model.advanceAfterFrame(T+POUR_MS);
  const undoAt=T+POUR_MS+SETTLE_MS;model.sample(undoAt);model.advanceAfterFrame(undoAt);
  assert.equal(model.undo(undoAt),true);
  assert.equal(at(model,undoAt).visible,true);
  assert.equal(model.sample(undoAt).glasses[1].completion.particles.some(p=>p.visible),false);
  const middle=at(model,undoAt+65);assert.ok(middle.y<at(model,undoAt).y);assert.ok(middle.alpha<1);
  assert.equal(at(model,undoAt+125).visible,false);
  model.reset();
  assert.equal(at(model,undoAt+126).visible,false);
  assert.equal(at(model,undoAt+1000).visible,false);
  assert.deepEqual(model.board,[[2,0,3],[3]]);
});

test('Undo waits through landing recovery then removes the cap from its presented pose',()=>{
  const model=new StilllightModel();model.board=[[3],[3,3,3]];
  model.startPour(T);model.sample(T+POUR_MS);model.advanceAfterFrame(T+POUR_MS);
  const landingAt=T+POUR_MS+40,before=at(model,landingAt);
  assert.equal(model.undo(landingAt),false);assert.equal(model.undoDepth,1);
  assert.deepEqual(at(model,landingAt),before);
  const undoAt=T+POUR_MS+SETTLE_MS;model.sample(undoAt);model.advanceAfterFrame(undoAt);
  const recovered=at(model,undoAt);assert.equal(model.undo(undoAt),true);
  assert.deepEqual(at(model,undoAt),recovered);
  assert.equal(at(model,undoAt+125).visible,false);
});

test('refined Undo clears completion effects and reaches idle before completing again',()=>{
  for(const delay of [SETTLE_MS,550,1000]){
    const model=new StilllightModel(),original=[[3],[3,3,3]];
    model.board=original.map(glass=>[...glass]);
    let started=T;
    for(let cycle=0;cycle<3;cycle++){
      assert.equal(model.startPour(started),true);
      const completed=started+POUR_MS;
      model.sample(completed);model.advanceAfterFrame(completed);
      assert.equal(at(model,completed).visible,true);
      const undoAt=completed+delay;
      model.sample(undoAt);model.advanceAfterFrame(undoAt);
      const before=at(model,undoAt);
      assert.equal(model.undo(undoAt),true);
      assert.deepEqual(model.board,original);
      assert.deepEqual(at(model,undoAt),before,'exit starts from presented cap pose');
      for(const elapsed of [0,65,125,260,420,520]){
        const frame=model.sample(undoAt+elapsed),glass=frame.glasses[1];
        assert.equal(frame.stream,null);
        assert.equal(glass.completion.recoilY,0);
        assert.equal(glass.completion.particles.some(p=>p.visible),false);
        if(elapsed>=125)assert.equal(glass.cap.visible,false);
        if(elapsed>=420)assert.equal(frame.metrics.transfer,1);
      }
      model.advanceAfterFrame(undoAt+UNDO_MS);
      assert.equal(model.busy,false);assert.equal(model.flight,null);
      assert.equal(model.settleMotion,null);assert.equal(model.isAnimating(),false);
      const rest=model.sample(undoAt+UNDO_MS);
      for(const glass of rest.glasses){assert.equal(glass.wave,0);assert.equal(glass.surfaceAngle,0);}
      assert.deepEqual(model.board,original);
      started=undoAt+UNDO_MS+1;
    }
  }
});

test('dev completed-right preview uses canonical board and the real landing transition',()=>{
  const model=new StilllightModel();
  assert.equal(model.startPour(T),true);
  model.previewCompletedRight(T+100);
  assert.deepEqual(model.board,[[2,0,3],[3,3,3,3]]);
  assert.deepEqual(model.sample(T+100).board,model.board);
  assert.equal(model.flight,null);assert.equal(model.busy,false);
  assert.equal(model.undoDepth,0);
  const drop=at(model,T+100),contact=at(model,T+310),rebound=at(model,T+394),rest=at(model,T+550);
  assert.equal(drop.visible,true);assert.equal(drop.alpha,1);assert.ok(drop.y<rest.y-40);
  assert.equal(contact.y,rest.y);assert.ok(rebound.y<rest.y-5);
  assert.deepEqual(rest,{visible:true,alpha:1,y:16,scaleX:1,scaleY:1,rotation:0});
  model.reset();
  assert.deepEqual(model.board,[[2,0,3],[3]]);
  assert.equal(at(model,T+351).visible,false);
});

test('first contact synchronizes bounded bottle recoil, area-preserving liquid wave, and finite particles',()=>{
  const model=new StilllightModel();model.previewCompletedRight(T);
  const before=model.sample(T+209).glasses[1];
  assert.equal(before.completion.recoilY,0);
  assert.equal(before.completion.particles.some(p=>p.visible),false);
  const impact=model.sample(T+210).glasses[1];
  assert.equal(impact.cap.y,16);
  assert.equal(impact.completion.particles.filter(p=>p.visible).length,12);
  model.advanceAfterFrame(T+210);model.advanceAfterFrame(T+220);
  assert.equal(model.events.filter(e=>e==='cap-contact:1').length,1);
  const frame=model.sample(T+250),glass=frame.glasses[1];
  assert.ok(glass.completion.recoilY>0&&glass.completion.recoilY<=2);
  assert.ok(glass.wave>=1&&glass.wave<=2.1);
  assert.deepEqual(frame.board[1],[3,3,3,3]);
  assert.equal(glass.layers.reduce((sum,layer)=>sum+layer.amount,0),4);
  const sampled=glass.layers.at(-1)!.surface!;
  const topAt=(x:number)=>{const i=Math.max(0,Math.min(43,Math.floor((x+220)/10))),a=i*2,t=(x-sampled[a])/(sampled[a+2]-sampled[a]);return sampled[a+1]+(sampled[a+3]-sampled[a+1])*t;};
  let area=0;for(let x=-33;x<33;x+=.1){const y=topAt(x+.05),bottom=Math.abs(x)<12?156:Math.abs(x)<22?156-(Math.abs(x)-12)*.5:Math.abs(x)<30?151-(Math.abs(x)-22):143-(Math.abs(x)-30)*13/3;area+=Math.max(0,bottom-y)*.1;}
  assert.ok(Math.abs(area-8929)<2,`visible liquid area ${area}`);
  const replay=glass.completion.particles.map(p=>({...p}));
  assert.deepEqual(model.sample(T+250).glasses[1].completion.particles,replay,'explicit time is cadence independent');
  const sparks=model.sample(T+310).glasses[1].completion.particles.slice(0,8);
  assert.ok(sparks.filter(p=>p.visible&&p.alpha>=.62&&p.radius>=1.5).length>=6,'rim accents stay readable after contact');
  model.sample(T+1000);model.advanceAfterFrame(T+1000);
  const done=model.sample(T+1000).glasses[1];
  assert.equal(done.completion.recoilY,0);assert.equal(done.completion.particles.some(p=>p.visible),false);
  assert.equal(model.isAnimating(),false);
  const interrupted=new StilllightModel();interrupted.previewCompletedRight(T);
  assert.equal(interrupted.sample(T+250).glasses[1].completion.particles.some(p=>p.visible),true);
  interrupted.reset();
  const cleared=interrupted.sample(T+251).glasses[1];
  assert.equal(cleared.cap.visible,false);assert.equal(cleared.completion.particles.some(p=>p.visible),false);
  assert.equal(cleared.wave,0);assert.equal(interrupted.isAnimating(),false);
});

test('dev preview leaves subsequent pour and Undo history valid',()=>{
  const model=new StilllightModel();model.previewCompletedRight(T);
  model.choose(1,T+300);model.choose(0,T+301);
  assert.ok(model.flight);assert.equal(model.undoDepth,1);
  const end=T+301+POUR_MS;model.sample(end);model.advanceAfterFrame(end);
  assert.equal(at(model,end,1).visible,false);
  const undoAt=end+SETTLE_MS;model.sample(undoAt);model.advanceAfterFrame(undoAt);
  assert.equal(model.undo(undoAt),true);
  assert.deepEqual(model.board,[[2,0,3],[3,3,3,3]]);
  model.sample(undoAt+UNDO_MS);model.advanceAfterFrame(undoAt+UNDO_MS);
  assert.equal(at(model,undoAt+UNDO_MS,1).visible,true);
});

test('renderers retain a glass-local pumpkin cap under one rigid body',()=>{
  const glass=fs.readFileSync(new URL('../src/render/pixi/GlassView.ts',import.meta.url),'utf8');
  const pixi=fs.readFileSync(new URL('../src/render/pixi/PixiRenderer.ts',import.meta.url),'utf8');
  const canvas=fs.readFileSync(new URL('../src/render/CanvasRenderer.ts',import.meta.url),'utf8');
  assert.match(glass,/private cap=new Container/);
  assert.match(glass,/this\.cap\.addChild\(this\.capBody\)/);
  assert.match(glass,/this\.root\.addChild\([^;]*this\.cap/);
  assert.doesNotMatch(glass.slice(glass.indexOf('  update(frame:GlassFrame)')),/new Sprite/);
  assert.match(pixi,/pumpkin-cap\.png/);
  assert.match(canvas,/pumpkin-cap\.png/);
});
