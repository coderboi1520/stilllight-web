import test from 'node:test';
import assert from 'node:assert/strict';
import {StilllightModel} from '../src/core/model.ts';
import {POUR_MS,SETTLE_MS,STREAM_END,TRANSFER_END} from '../src/core/constants.ts';
import {position,pourDirection,pouringLip} from '../src/core/geometry.ts';
import {snapshotFrame} from '../src/debug/snapshot.ts';

const T=10000;
const close=(actual:number,expected:number,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
const volume=(board:readonly (readonly number[])[])=>board.reduce((total,glass)=>total+glass.length,0);
const colors=(board:readonly (readonly number[])[])=>board.flat().sort((a,b)=>a-b);
const shown=(model:StilllightModel,now:number)=>model.sample(now).glasses.map(glass=>glass.layers.reduce((total,layer)=>total+layer.amount,0));
function move(model:StilllightModel,source:number,target:number,now:number){model.choose(source,now);model.choose(target,now+1);assert.ok(model.flight);return now+1;}
function finish(model:StilllightModel,started:number){model.sample(started+POUR_MS);model.advanceAfterFrame(started+POUR_MS);assert.equal(model.busy,false);}

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
    const mid=undoAt+POUR_MS*.5,midFrame=model.sample(mid),transfer=midFrame.metrics.transfer,atMid=shown(model,mid);
    close(atMid[target],after[target].length-amount*transfer);
    close(atMid[source],after[source].length+amount*transfer);
    close(atMid[0]+atMid[1],volume(original));
    const incoming=midFrame.glasses[source].layers.at(-1);
    assert.ok(incoming);assert.equal(incoming.color,model.flight?.color);
    close(incoming.amount,amount*transfer);
    const atEnd=shown(model,undoAt+POUR_MS);
    close(atEnd[source],original[source].length);close(atEnd[target],original[target].length);
    finish(model,undoAt);
    assert.deepEqual(model.board,original);assert.deepEqual(colors(model.board),colors(original));
    assert.equal(model.undoDepth,0);
  }
});

test('Undo uses the prior receiver as a downward pouring source and lands at exact home with finite recovery',()=>{
  const model=new StilllightModel(),started=move(model,0,1,T);finish(model,started);
  const undoAt=started+POUR_MS+100;
  assert.equal(model.undo(undoAt),true);
  const opening=model.sample(undoAt);
  for(const index of [0,1]){const home=position(index);close(opening.glasses[index].pose.x,home.x);close(opening.glasses[index].pose.y,home.y);close(opening.glasses[index].pose.angle,0);}
  const mid=model.sample(undoAt+POUR_MS*.5),stream=mid.stream;
  assert.ok(stream);assert.equal(mid.glasses[1].moving,true);assert.equal(mid.glasses[0].moving,false);
  const lip=pouringLip(mid.glasses[1].pose,pourDirection(1,0));
  close(stream.start.x,lip.x);close(stream.start.y,lip.y);
  close(stream.end.x,mid.glasses[0].contact.world.x);close(stream.end.y,mid.glasses[0].contact.world.y);
  assert.ok(stream.end.y>stream.start.y,'inverse stream still falls downward');
  const transferred=model.board.map(glass=>[...glass]);
  const tail=model.sample(undoAt+POUR_MS*((TRANSFER_END+STREAM_END)/2));
  close(tail.metrics.transfer,1);assert.ok(tail.stream);assert.deepEqual(model.board,transferred);
  const nearPoses=model.sample(undoAt+POUR_MS-.01).glasses.map(glass=>({...glass.pose}));
  const landed=model.sample(undoAt+POUR_MS);
  for(const index of [0,1]){
    const home=position(index),pose=landed.glasses[index].pose,near=nearPoses[index];
    close(pose.x,home.x);close(pose.y,home.y);close(pose.angle,0);
    assert.ok(Math.abs((home.x-near.x)/.01)<.002);
    assert.ok(Math.abs((home.y-near.y)/.01)<.002);
    assert.ok(Math.abs(near.angle/.01)<.00005);
  }
  finish(model,undoAt);
  const rest=model.sample(undoAt+POUR_MS+SETTLE_MS);
  for(const glass of rest.glasses){close(glass.surfaceAngle,0);close(glass.wave,0);}
  model.advanceAfterFrame(undoAt+POUR_MS+SETTLE_MS);assert.equal(model.isAnimating(),false);
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
  finish(model,undoAt);assert.deepEqual(model.board,[[],[1]]);assert.equal(model.undoDepth,1);
  const next=undoAt+POUR_MS+20;assert.equal(model.undo(next),true);assert.equal(model.undoDepth,0);
  finish(model,next);assert.deepEqual(model.board,[[1],[]]);
  assert.equal(model.undo(next+POUR_MS+20),false);
  model.choose(0,next+POUR_MS+30);assert.equal(model.selected,0,'interaction resumes after Undo gesture');
});

test('Undo validates current layers and preserves a borrowed manual frame until the next explicit sample',()=>{
  const model=new StilllightModel(),started=move(model,0,1,T);finish(model,started);
  const at=started+POUR_MS+50,borrowed=model.sample(at),frozen=snapshotFrame(borrowed);
  const expected=model.board.map(glass=>[...glass]);model.board[1][0]=99;
  assert.equal(model.undo(at),false);assert.equal(model.undoDepth,1);
  model.board=expected;
  assert.equal(model.undo(at),true);assert.deepEqual(snapshotFrame(borrowed),frozen);
  const next=snapshotFrame(model.sample(at));assert.equal(next.glasses[1].moving,true);
  assert.deepEqual(next.board,[[2,0,3],[3]]);
});

test('Undo inherits both presented vessel poses and surfaces while hint and settle are active',()=>{
  const model=new StilllightModel(),started=move(model,0,1,T);finish(model,started);
  const hintAt=started+POUR_MS+20;model.hint(hintAt);
  const event=hintAt+115;
  const before=model.sample(event).glasses.map(glass=>({pose:{...glass.pose},angle:glass.surfaceAngle,wave:glass.wave,phase:glass.phase}));
  assert.ok(before[0].wave>0&&before[1].wave>0);
  assert.equal(model.undo(event),true);assert.equal(model.hintMotion,null);assert.equal(model.settleMotion,null);
  const after=model.sample(event).glasses;
  for(const index of [0,1]){
    close(after[index].pose.x,before[index].pose.x);
    close(after[index].pose.y,before[index].pose.y);
    close(after[index].pose.angle,before[index].pose.angle);
    close(after[index].surfaceAngle,before[index].angle);
    close(after[index].wave,before[index].wave);
    close(after[index].phase,before[index].phase);
  }
});
