import test from 'node:test';
import assert from 'node:assert/strict';
import {StilllightModel} from '../src/core/model.ts';
import {POUR_MS,SETTLE_MS,UNDO_MS} from '../src/core/constants.ts';
import {position} from '../src/core/geometry.ts';
import {snapshotFrame} from '../src/debug/snapshot.ts';

const T=10000;
const close=(actual:number,expected:number,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
const volume=(board:readonly (readonly number[])[])=>board.reduce((total,glass)=>total+glass.length,0);
const colors=(board:readonly (readonly number[])[])=>board.flat().sort((a,b)=>a-b);
const shown=(model:StilllightModel,now:number)=>model.sample(now).glasses.map(glass=>glass.layers.reduce((total,layer)=>total+layer.amount,0));
function move(model:StilllightModel,source:number,target:number,now:number){model.choose(source,now);model.choose(target,now+1);assert.ok(model.flight);return now+1;}
function finish(model:StilllightModel,started:number){model.sample(started+POUR_MS);model.advanceAfterFrame(started+POUR_MS);assert.equal(model.busy,false);}
function finishUndo(model:StilllightModel,started:number){model.sample(started+UNDO_MS);model.advanceAfterFrame(started+UNDO_MS);assert.equal(model.busy,false);}

test('successful moves create one bounded history entry while empty, invalid, and reset paths do not',()=>{
  const model=new StilllightModel(),events=model.events;
  assert.equal(model.undo(T),false);assert.equal(model.undoDepth,0);assert.strictEqual(model.events,events);
  const started=move(model,0,1,T);assert.equal(model.undoDepth,1);
  finish(model,started);
  model.choose(0,started+POUR_MS+10);model.choose(1,started+POUR_MS+11);
  assert.ok(model.invalidMotion);assert.equal(model.undoDepth,1);
  assert.equal(model.undo(started+POUR_MS+12),false);assert.equal(model.undoDepth,1);
  model.reset();assert.equal(model.undoDepth,0);assert.equal(model.undo(T+5000),false);

  const bounded=new StilllightModel();bounded.board=[[1],[]];
  for(let i=0;i<66;i++){
    const source=i%2,target=1-source,at=T+i*(POUR_MS+20);
    const start=move(bounded,source,target,at);finish(bounded,start);
  }
  assert.equal(bounded.undoDepth,64);
});

test('Undo restores exact layers and conserved colors for single, merged, partial, and both direction transfers',()=>{
  const scenarios:[number[][],number,number,number][]=[
    [[[2,0,3],[3]],0,1,1],
    [[[2,3,3],[3]],0,1,2],
    [[[3],[2,3,3]],1,0,2],
    [[[2,3,3],[3,3,3]],0,1,1],
    [[[3,3,3],[2,3,3]],1,0,1]
  ];
  for(const [board,source,target,amount] of scenarios){
    const model=new StilllightModel();model.board=board.map(glass=>[...glass]);
    const original=board.map(glass=>[...glass]),started=move(model,source,target,T);
    assert.equal(model.flight?.amount,amount);assert.equal(model.undoDepth,1);
    const after=model.board.map(glass=>[...glass]);
    assert.equal(volume(after),volume(original));assert.deepEqual(colors(after),colors(original));
    finish(model,started);
    const undoAt=started+POUR_MS+80;
    assert.equal(model.undo(undoAt),true);assert.equal(model.undoDepth,0);
    assert.deepEqual(model.board,original,'logical board commits once on accepted Undo');
    assert.deepEqual(model.sample(undoAt).board,original);
    assert.equal(model.flight?.source,target);assert.equal(model.flight?.target,source);
    assert.equal(model.flight?.amount,amount);assert.equal(model.flight?.kind,'undo');
    const atStart=shown(model,undoAt);close(atStart[target],after[target].length);close(atStart[source],after[source].length);
    const mid=undoAt+UNDO_MS*.5,midFrame=model.sample(mid),transfer=midFrame.metrics.transfer,atMid=shown(model,mid);
    close(atMid[target],after[target].length-amount*transfer);
    close(atMid[source],after[source].length+amount*transfer);
    close(atMid[0]+atMid[1],volume(original));
    const incoming=midFrame.glasses[source].layers.at(-1);
    assert.ok(incoming);assert.equal(incoming.color,model.flight?.color);
    close(incoming.amount,amount*transfer);
    const shownColors=new Map<number,number>();
    for(const glass of midFrame.glasses)for(const layer of glass.layers)shownColors.set(layer.color,(shownColors.get(layer.color)??0)+layer.amount);
    for(const color of new Set(colors(original)))close(shownColors.get(color)??0,original.flat().filter(value=>value===color).length);
    const atEnd=shown(model,undoAt+UNDO_MS);
    close(atEnd[source],original[source].length);close(atEnd[target],original[target].length);
    finishUndo(model,undoAt);
    assert.deepEqual(model.board,original);assert.deepEqual(colors(model.board),colors(original));
    assert.equal(model.undoDepth,0);
  }
});

test('Undo restores fill in place over 520 ms with no stream, vessel motion, or terminal fill speed',()=>{
  const model=new StilllightModel(),started=move(model,0,1,T);finish(model,started);
  const undoAt=started+POUR_MS+100;
  const before=model.sample(undoAt).glasses.map(glass=>({angle:glass.surfaceAngle,wave:glass.wave,phase:glass.phase}));
  assert.equal(model.undo(undoAt),true);
  assert.equal(UNDO_MS,520);
  let previousA=-Infinity,previousB=Infinity;
  for(const p of [0,.001,.05,.25,.5,.75,.95,.999,1]){
    const frame=model.sample(undoAt+UNDO_MS*p),amounts=shown(model,undoAt+UNDO_MS*p);
    assert.equal(frame.stream,null);assert.ok(frame.glasses.every(glass=>!glass.moving));
    for(const index of [0,1]){
      const home=position(index),pose=frame.glasses[index].pose;
      close(pose.x,home.x);close(pose.y,home.y);close(pose.angle,0);
    }
    assert.ok(amounts[0]>=previousA-1e-9,'previous source refills monotonically');
    assert.ok(amounts[1]<=previousB+1e-9,'previous destination drains monotonically');
    close(amounts[0]+amounts[1],4);
    previousA=amounts[0];previousB=amounts[1];
  }
  const atStart=shown(model,undoAt)[0],nearStart=shown(model,undoAt+UNDO_MS*.001)[0];
  const nearEnd=shown(model,undoAt+UNDO_MS*.999)[0],atEnd=shown(model,undoAt+UNDO_MS)[0];
  const middle=(shown(model,undoAt+UNDO_MS*.501)[0]-shown(model,undoAt+UNDO_MS*.499)[0])/(UNDO_MS*.002);
  assert.ok((nearStart-atStart)/(UNDO_MS*.001)<middle*.02);
  assert.ok((atEnd-nearEnd)/(UNDO_MS*.001)<middle*.02);
  const inherited=model.sample(undoAt).glasses;
  for(const index of [0,1]){close(inherited[index].surfaceAngle,before[index].angle);close(inherited[index].wave,before[index].wave);close(inherited[index].phase,before[index].phase);}
  const terminal=model.sample(undoAt+UNDO_MS).glasses.map(glass=>({angle:glass.surfaceAngle,wave:glass.wave,phase:glass.phase}));
  finishUndo(model,undoAt);
  assert.ok(model.settleMotion);assert.equal(model.isAnimating(),true);
  const handedOff=model.sample(undoAt+UNDO_MS).glasses;
  for(const index of [0,1]){close(handedOff[index].surfaceAngle,terminal[index].angle);close(handedOff[index].wave,terminal[index].wave);close(handedOff[index].phase,terminal[index].phase);assert.ok(handedOff[index].wave>0);}
  const restAt=undoAt+UNDO_MS+SETTLE_MS;
  model.sample(restAt);model.advanceAfterFrame(restAt);
  assert.equal(model.settleMotion,null);assert.equal(model.isAnimating(),false);
  const rest=model.sample(restAt);
  for(const glass of rest.glasses){close(glass.surfaceAngle,0);close(glass.wave,0);}
});

test('Undo gives refill and drain distinct bounded surface motion through the sampled top boundary',()=>{
  const model=new StilllightModel();model.board=[[2,3,3],[3]];
  const started=move(model,0,1,T);finish(model,started);
  const undoAt=started+POUR_MS+SETTLE_MS+100;
  model.advanceAfterFrame(undoAt);
  assert.equal(model.undo(undoAt),true);
  const first=snapshotFrame(model.sample(undoAt+UNDO_MS*.5));
  const again=snapshotFrame(model.sample(undoAt+UNDO_MS*.5));
  assert.deepEqual(again,first,'explicit timestamps produce the same presentation');
  const refill=first.glasses[0],drain=first.glasses[1];
  assert.ok(refill.wave>=1.2&&refill.wave<=1.8,`refill wave ${refill.wave}`);
  assert.ok(drain.wave>=.8&&drain.wave<=1.4,`drain wave ${drain.wave}`);
  assert.ok(refill.surfaceAngle*drain.surfaceAngle<0);
  assert.ok(Math.abs(refill.phase-drain.phase)>1);
  for(const glass of [refill,drain]){
    const top=glass.layers.at(-1);assert.ok(top?.surface);
    assert.ok(Math.abs(top.surface[1]-top.surface[Math.floor(top.surface.length/4)*2+1])>.1,'sampled surface is visibly moving');
  }
  for(const p of [0,.1,.2,.35,.5,.65,.8,.95,1]){
    const frame=model.sample(undoAt+UNDO_MS*p);
    assert.ok(frame.glasses[0].wave>=0&&frame.glasses[0].wave<=1.8);
    assert.ok(frame.glasses[1].wave>=0&&frame.glasses[1].wave<=1.4);
    assert.equal(frame.stream,null);
  }
});

test('busy Undo is ignored, blocks interactions, and repeated fresh Undo pops one move at a time',()=>{
  const model=new StilllightModel();model.board=[[1],[]];
  const first=move(model,0,1,T);
  assert.equal(model.undo(first+100),false);assert.equal(model.undoDepth,1);
  finish(model,first);
  const second=move(model,1,0,first+POUR_MS+20);finish(model,second);
  assert.equal(model.undoDepth,2);assert.deepEqual(model.board,[[1],[]]);
  const undoAt=second+POUR_MS+20;assert.equal(model.undo(undoAt),true);assert.equal(model.undoDepth,1);
  const eventCount=model.events.length;
  assert.equal(model.undo(undoAt+200),false);model.choose(0,undoAt+200);model.hint(undoAt+200);model.invalid(undoAt+200);
  assert.equal(model.startPour(undoAt+200),false);
  assert.equal(model.undoDepth,1);assert.equal(model.events.length,eventCount);
  assert.equal(model.selected,null);assert.equal(model.flight?.kind,'undo');
  finishUndo(model,undoAt);assert.deepEqual(model.board,[[],[1]]);assert.equal(model.undoDepth,1);
  const next=undoAt+UNDO_MS+20;assert.equal(model.undo(next),true);assert.equal(model.undoDepth,0);
  finishUndo(model,next);assert.deepEqual(model.board,[[1],[]]);
  assert.equal(model.undo(next+UNDO_MS+20),false);
  model.choose(0,next+UNDO_MS+30);assert.equal(model.selected,0,'interaction resumes after Undo gesture');
});

test('Undo validates current layers and preserves a borrowed manual frame until the next explicit sample',()=>{
  const model=new StilllightModel(),started=move(model,0,1,T);finish(model,started);
  const at=started+POUR_MS+50,borrowed=model.sample(at),frozen=snapshotFrame(borrowed);
  const expected=model.board.map(glass=>[...glass]);model.board[1][0]=99;
  assert.equal(model.undo(at),false);assert.equal(model.undoDepth,1);
  model.board=expected;
  assert.equal(model.undo(at),true);assert.deepEqual(snapshotFrame(borrowed),frozen);
  const next=snapshotFrame(model.sample(at));assert.equal(next.glasses[1].moving,false);assert.equal(next.stream,null);
  assert.deepEqual(next.board,[[2,0,3],[3]]);
});

test('Undo waits for home pose during a hint, then accepts a fresh input',()=>{
  const model=new StilllightModel(),started=move(model,0,1,T);finish(model,started);
  const hintAt=started+POUR_MS+20;model.hint(hintAt);
  const event=hintAt+115;
  assert.equal(model.undo(event),false);assert.equal(model.undoDepth,1);assert.ok(model.hintMotion);
  const at=hintAt+680;
  model.advanceAfterFrame(at);
  const before=model.sample(at).glasses.map(glass=>({angle:glass.surfaceAngle,wave:glass.wave,phase:glass.phase}));
  assert.equal(model.undo(at),true);
  const after=model.sample(at).glasses;
  for(const index of [0,1]){
    const home=position(index);close(after[index].pose.x,home.x);close(after[index].pose.y,home.y);
    close(after[index].surfaceAngle,before[index].angle);
    close(after[index].wave,before[index].wave);
    close(after[index].phase,before[index].phase);
  }
});
