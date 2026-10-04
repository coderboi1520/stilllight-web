import test from 'node:test';
import assert from 'node:assert/strict';
import {StilllightModel} from '../src/core/model.ts';
import {POUR_MS,SETTLE_MS,UNDO_MS} from '../src/core/constants.ts';
import {snapshotFrame} from '../src/debug/snapshot.ts';
import {pouringLip,pourDirection} from '../src/core/geometry.ts';
import {presentedPourContact} from '../src/platform/presentedFeedback.ts';

const initial=[[0,0],[],[1,1],[1],[2,2],[2]];
const accepted=[[],[0,0],[],[1,1,1],[],[2,2,2]];
const move=(m:StilllightModel,s:number,t:number,at:number)=>{m.choose(s,at-1);m.choose(t,at);};
const step=(m:StilllightModel,at:number)=>{m.sample(at);m.advanceAfterFrame(at);};
const total=(f:ReturnType<StilllightModel['sample']>)=>f.glasses.reduce((s,g)=>s+g.layers.reduce((n,l)=>n+l.amount,0),0);

test('three staggered disjoint pours conserve quantity and retain independent progression and mouths',()=>{
  const m=new StilllightModel(initial);
  move(m,0,1,100);move(m,2,3,200);move(m,4,5,300);
  assert.deepEqual(m.board,accepted);assert.equal(m.undoDepth,3);
  const f=snapshotFrame(m.sample(650));
  assert.equal(f.streams.length,3);assert.equal(new Set(f.streams.map(s=>s.id)).size,3);
  assert.deepEqual(f.streams.map(s=>[s.source,s.target]),[[0,1],[2,3],[4,5]]);
  assert.ok(f.glasses[1].layers.at(-1)!.amount>f.glasses[3].layers.at(-1)!.amount);
  assert.ok(f.glasses[3].layers.at(-1)!.amount>f.glasses[5].layers.at(-1)!.amount);
  for(const s of f.streams){
    assert.deepEqual(s.start,pouringLip(f.glasses[s.source].pose,pourDirection(s.source,s.target)));
    assert.deepEqual(s.end,f.glasses[s.target].contact.world);
  }
  for(const at of [300,500,650,900,1140,1240,1340])assert.ok(Math.abs(total(m.sample(at))-8)<1e-7);
  step(m,1140);assert.equal(m.flights.length,2);
  const remainder=snapshotFrame(m.sample(1150));
  assert.deepEqual(remainder.glasses[1].layers.map(l=>l.amount),[1,1]);
  assert.ok(remainder.glasses[2].moving&&remainder.glasses[4].moving);
  assert.equal(m.undo(1150),false);
});

test('busy pair reuse and invalid input leave active presentation intact; free input works',()=>{
  const m=new StilllightModel(initial);move(m,0,1,100);
  const before=snapshotFrame(m.sample(550)),board=structuredClone(m.board);
  for(const i of [0,1,-1,99,NaN])m.choose(i,550);
  assert.deepEqual(m.board,board);assert.deepEqual(snapshotFrame(m.sample(550)),before);
  m.hint(550);assert.equal(m.hintMotion,null);
  m.choose(2,550);assert.equal(m.selected,2);
  m.choose(4,560);assert.ok(m.invalidMotion);assert.deepEqual(m.board,board);
  const after=snapshotFrame(m.sample(570));
  assert.deepEqual(after.glasses[0],snapshotFrame(newFlightOnly(570)).glasses[0]);
  step(m,1000);move(m,2,3,1001);assert.equal(m.undoDepth,2);
  step(m,1140);assert.equal(m.isVesselAvailable(0),false,'surface recovery owns the pair');
  assert.equal(m.isVesselAvailable(4),true);
  m.choose(4,1200);step(m,1580);assert.equal(m.selected,4,'another flight ending preserves selection');
});

test('a free pair departs continuously while another pair shows invalid feedback',()=>{
  const m=new StilllightModel(initial);
  m.choose(2,0);m.choose(4,50);assert.ok(m.invalidMotion);
  m.choose(0,100);assert.equal(m.selected,0);
  const at=190,dt=.05;
  const previous={...m.sample(at-dt).glasses[0].pose},before={...m.sample(at).glasses[0].pose};
  m.choose(1,at);assert.equal(m.flights.length,1);
  const current={...m.sample(at).glasses[0].pose},after={...m.sample(at+dt).glasses[0].pose};
  assert.deepEqual(current,before);
  for(const key of ['x','y','angle'] as const){
    const incoming=(before[key]-previous[key])/dt,outgoing=(after[key]-current[key])/dt;
    assert.ok(Math.abs(incoming-outgoing)<(key==='angle'?.0002:.004),`${key} velocity discontinuity: ${incoming} -> ${outgoing}`);
  }
});
function newFlightOnly(at:number){const m=new StilllightModel(initial);move(m,0,1,100);return m.sample(at);}

test('presentation may finish in reverse acceptance order; Undo restores acceptance history exactly',()=>{
  const m=new StilllightModel(initial);
  // Explicit debug timestamps deliberately reverse finishing order.
  move(m,0,1,300);move(m,2,3,200);move(m,4,5,100);
  step(m,1140);assert.deepEqual(m.flights.map(f=>f.source),[0,2]);
  step(m,1240);step(m,1340);step(m,1780);step(m,3000);
  assert.equal(m.isAnimating(),false);
  assert.equal(m.undo(3100),true);assert.deepEqual(m.board,[[],[0,0],[],[1,1,1],[2,2],[2]]);
  step(m,3100+UNDO_MS);
  assert.equal(m.undo(3700),true);assert.deepEqual(m.board,[[],[0,0],[1,1],[1],[2,2],[2]]);
  step(m,3700+UNDO_MS);
  assert.equal(m.undo(4300),true);assert.deepEqual(m.board,initial);step(m,4820);
  assert.equal(m.undoDepth,0);assert.equal(m.isAnimating(),false);
});

test('each completed pair emits one cap event; reset clears all flights and late feedback',()=>{
  const m=new StilllightModel([[0,0],[0,0],[1,1],[1,1],[2,2],[2,2]]);
  move(m,0,1,100);move(m,2,3,200);move(m,4,5,300);
  step(m,1140);
  const first=snapshotFrame(m.sample(1140));
  assert.ok(first.glasses[1].cap.visible);assert.equal(first.glasses[3].cap.visible,false);assert.equal(first.glasses[5].cap.visible,false);
  step(m,1240);step(m,1340);step(m,2200);step(m,3000);
  assert.deepEqual(m.events.filter(e=>e.startsWith('cap-contact:')),['cap-contact:1','cap-contact:3','cap-contact:5']);
  for(const i of [1,3,5])assert.ok(m.sample(3000).glasses[i].cap.visible);
  m.reset();move(m,0,1,3100);move(m,2,3,3200);step(m,4140);m.reset();
  step(m,10000);const f=m.sample(10000);
  assert.equal(f.streams.length,0);assert.equal(m.flights.length,0);assert.equal(m.isAnimating(),false);
  assert.deepEqual(m.events,['reset']);assert.equal(m.undoDepth,0);
  assert.deepEqual(m.board,[[0,0],[0,0],[1,1],[1,1],[2,2],[2,2]]);
  assert.ok(f.glasses.every(g=>!g.cap.visible&&!g.completion.particles.some(p=>p.visible)));
});

test('presented contact belongs to its own flight and sampling never records feedback',()=>{
  for(const reduced of [false,true]){
    const m=new StilllightModel(initial);m.reducedMotion=reduced;
    move(m,0,1,100);move(m,2,3,400);
    const ids=m.flights.map(f=>f.id),count=m.eventCount;
    let f=m.sample(650);
    assert.equal(presentedPourContact(f,reduced,ids[0]),true);
    assert.equal(presentedPourContact(f,reduced,ids[1]),false);
    f=m.sample(800);
    assert.equal(presentedPourContact(f,reduced,ids[0]),true);
    assert.equal(presentedPourContact(f,reduced,ids[1]),true);
    assert.equal(m.eventCount,count);
    m.reset();move(m,0,1,1000);assert.ok(m.flights[0].id>ids[1]);
    assert.equal(presentedPourContact(m.sample(1550),reduced,ids[0]),false);
  }
});

test('Reduced Motion has concurrent quantity/history parity with deterministic borrowed frames',()=>{
  for(const reduced of [false,true]){
    const m=new StilllightModel(initial);m.reducedMotion=reduced;
    move(m,0,1,100);move(m,2,3,200);move(m,4,5,300);
    assert.deepEqual(m.board,accepted);assert.equal(m.undoDepth,3);
    const f=m.sample(650),snap=snapshotFrame(f),again=m.sample(650);
    assert.strictEqual(f,again);assert.deepEqual(snapshotFrame(again),snap);
    assert.ok(Math.abs(total(f)-8)<1e-7);
    if(reduced){assert.equal(f.streams.length,0);assert.ok(f.glasses.every(g=>!g.moving&&g.pose.angle===0));}
    step(m,1340);step(m,1340+SETTLE_MS);step(m,3000);assert.equal(m.isAnimating(),false);
    assert.equal(m.undo(3100),true);step(m,3620);
  }
});
