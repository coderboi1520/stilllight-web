import test from 'node:test';
import assert from 'node:assert/strict';
import {StilllightModel} from '../src/core/model.ts';
import {POUR_MS,SETTLE_MS,UNDO_MS} from '../src/core/constants.ts';
import {position} from '../src/core/geometry.ts';
import {pour,isBottleComplete} from '../src/core/rules.ts';
import {ORDINARY_COMMISSION} from '../src/core/ordinaryCommission.ts';

const board=[[2,0,3],[3],[0,1,1,2],[2,3,0,1],[1,2,3,0],[]];
const finish=(m:StilllightModel,t:number)=>{m.sample(t);m.advanceAfterFrame(t);};
test('six-vessel model owns frames, exact multi-unit history and stationary Undo at any index',()=>{
  const initial=[[0,0,1,1],[],[2,2,2],[2],[3,3],[3,3]];
  const m=new StilllightModel(initial);
  assert.deepEqual(m.board,initial);
  assert.equal(m.sample(0).glasses.length,6);
  m.choose(4,100);m.choose(5,101);
  assert.equal(m.flight?.amount,2);
  assert.equal(m.undoDepth,1);
  for(const t of [101,450,650,1141]){
    const f=m.sample(t);
    assert.ok(Math.abs(f.glasses.reduce((sum,g)=>sum+g.layers.reduce((s,l)=>s+l.amount,0),0)-12)<1e-7);
    assert.ok(f.glasses.every(g=>Number.isFinite(g.pose.x)&&Number.isFinite(g.contact.world.y)));
  }
  finish(m,101+POUR_MS);finish(m,101+POUR_MS+SETTLE_MS);
  assert.ok(m.sample(1600).glasses[5].cap.visible);
  const u=2000;assert.equal(m.undo(u),true);assert.deepEqual(m.board,initial);
  for(const t of [u,u+260,u+420,u+UNDO_MS]){
    const f=m.sample(t);assert.equal(f.stream,null);
    for(const g of f.glasses){assert.deepEqual(g.pose,{...position(g.index),angle:0});}
    for(const i of [0,1,2,3])assert.equal(f.glasses[i].wave,0,'unrelated vessels remain at rest');
  }
  finish(m,u+UNDO_MS);finish(m,4000);
  m.choose(4,4100);m.choose(5,4101);finish(m,4101+POUR_MS);finish(m,6000);
  assert.equal(m.events.filter(e=>e==='cap-contact:5').length,2,'one contact for each completion, including re-entry');
  assert.ok(m.sample(6000).glasses[5].cap.visible);
  finish(m,6500);assert.equal(m.isAnimating(),false);
  m.reset();assert.deepEqual(m.board,initial);assert.equal(m.undoDepth,0);
});
test('Hint finds a useful legal current-board pair beyond the first two without mutation',()=>{
  const initial=[[0,0,0,0],[1,1,1,1],[2,3,3],[],[2],[3]];
  const m=new StilllightModel(initial);const before=structuredClone(m.board);
  m.hint(100);
  assert.ok(m.hintMotion);
  const h=m.hintMotion!;assert.ok(pour(m.board,h.source,h.target));
  assert.ok(h.source>=2);
  assert.ok(!isBottleComplete(m.board[h.source]));
  assert.deepEqual(m.board,before);assert.equal(m.undoDepth,0);
  finish(m,1000);assert.equal(m.isAnimating(),false);
});
test('invalid and rapid input preserve six-vessel state and clear every affected animation',()=>{
  const m=new StilllightModel(board);const before=structuredClone(m.board);
  m.choose(2,100);m.choose(3,101);assert.ok(m.invalidMotion);
  m.choose(5,102);assert.deepEqual(m.board,before);assert.equal(m.undoDepth,0);
  finish(m,1000);m.hint(1100);m.choose(4,1200);
  finish(m,2000);m.choose(4,2100);finish(m,3000);assert.equal(m.isAnimating(),false);
  m.choose(99,3100);assert.deepEqual(m.board,before);
});
test('Reduced Motion keeps exact accepted quantities and history with stationary presentation',()=>{
  const m=new StilllightModel([[0,3,3],[],[1],[1],[],[]]);m.reducedMotion=true;
  m.choose(0,100);m.choose(1,101);assert.equal(m.flight?.amount,2);
  const f=m.sample(621);assert.equal(f.stream,null);
  for(const g of f.glasses)assert.deepEqual(g.pose,{...position(g.index),angle:0});
  finish(m,1141);finish(m,2000);assert.equal(m.undo(2100),true);
  finish(m,2620);assert.deepEqual(m.board,[[0,3,3],[],[1],[1],[],[]]);
});
test('representative commission solves through real maximal pours and per-vessel completion once',()=>{
  const m=new StilllightModel(ORDINARY_COMMISSION);
  const solution=[[0,1],[4,0],[1,4],[4,1],[2,4],[3,2],[0,3],[3,0],[3,1],[4,3],[2,4],[0,2],[3,0]];
  let multi=false;
  for(const [i,[source,target]] of solution.entries()){
    const t=1000+i*2500;m.choose(source,t);m.choose(target,t+1);assert.ok(m.flight);multi ||= m.flight!.amount>1;
    finish(m,t+1041);finish(m,t+1251);finish(m,t+2300);
  }
  assert.ok(multi);assert.ok(m.board.every(g=>!g.length||isBottleComplete(g)));assert.equal(m.isAnimating(),false);
  const contacts=m.events.filter(e=>e.startsWith('cap-contact:'));assert.equal(new Set(contacts).size,contacts.length);
  assert.equal(m.undoDepth,13);
});
