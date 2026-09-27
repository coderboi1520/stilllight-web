import test from 'node:test';
import assert from 'node:assert/strict';
import {StilllightModel} from '../src/core/model.ts';
import {prepareSurfaceContact} from '../src/core/contact.ts';
import {POUR_MS,STREAM_END,TRANSFER_END} from '../src/core/constants.ts';
import {snapshotFrame} from '../src/debug/snapshot.ts';
import {FrameGate} from '../src/runtime/FrameGate.ts';

const T=10000;
const close=(actual:number,expected:number,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);

test('both pour directions connect lip to final transformed sampled receiver surface',()=>{
  for(const [source,target] of [[0,1],[1,0]] as const){
    const model=new StilllightModel();model.choose(source,T);model.choose(target,T+90);
    const frame=model.sample(T+90+POUR_MS*.5),receiver=frame.glasses[target],stream=frame.stream;
    assert.ok(stream);assert.ok(receiver.response);assert.strictEqual(receiver.response.contact,receiver.contact);
    const {local,world,tangent}=receiver.contact;
    const sample=receiver.layers.at(-1)?.surface;assert.ok(sample);
    const left=Math.floor((local.x+220)/10),a=left*2,b=a+2,f=(local.x-sample[a])/(sample[b]-sample[a]);
    close(local.y,sample[a+1]+(sample[b+1]-sample[a+1])*f);
    const rotation=receiver.pose.angle+receiver.relativeLiquidRotation,c=Math.cos(rotation),s=Math.sin(rotation);
    close(world.x,receiver.pose.x+local.x*c-local.y*s);
    close(world.y,receiver.pose.y+local.x*s+local.y*c);
    close(Math.hypot(tangent.x,tangent.y),1);
    close(stream.end.x,world.x);close(stream.end.y,world.y);close(stream.reveal,1);
    close(stream.start.x,stream.end.x);
  }
});

test('flat and empty receiver contacts use the same final pose transform',()=>{
  const model=new StilllightModel(),glass=model.sample(T).glasses[1];
  const top=glass.layers.at(-1);assert.ok(top);top.wavy=false;
  prepareSurfaceContact(glass,1,glass.contact);
  assert.equal(glass.contact.empty,false);close(glass.contact.local.y,top.top);close(glass.contact.tangent.y,0);

  const empty=new StilllightModel();empty.board=[[3],[]];assert.equal(empty.startPour(T),true);
  const early=empty.sample(T+POUR_MS*.285),receiver=early.glasses[1],stream=early.stream;
  assert.ok(stream);assert.equal(receiver.layers.length,0);assert.equal(receiver.contact.empty,true);
  assert.ok(stream.reveal>0&&stream.reveal<1,'stream reveals outward from lip');
  close(stream.end.x,receiver.contact.world.x);close(stream.end.y,receiver.contact.world.y);
  const filled=empty.sample(T+POUR_MS*.5);assert.equal(filled.glasses[1].contact.empty,false);
  close(filled.stream!.end.y,filled.glasses[1].contact.world.y);
});

test('visual stream tail transfers no extra volume and receiver response decays once',()=>{
  const model=new StilllightModel();assert.equal(model.startPour(T),true);
  const logicalBoard=JSON.stringify(model.board);
  const at=(p:number)=>{const frame=model.sample(T+POUR_MS*p);return{transfer:frame.metrics.transfer,response:frame.glasses[1].response?.intensity??0,stream:frame.stream,width:frame.stream?.widthScale??0};};
  const levels=[.5,.55,.69,.70,.8,.9,1].map(at);
  assert.ok(levels[0].response>0);assert.ok(levels[1].response>levels[2].response);
  for(let i=2;i<levels.length-1;i++)assert.ok(levels[i].response>=levels[i+1].response,`response rises at ${i}`);
  close(levels[2].transfer,1);close(levels[3].transfer,1);close(levels[4].transfer,1);
  assert.ok(levels[3].stream,'draining stream remains visible after logical transfer');
  assert.ok(levels[3].width<levels[2].width,'draining tail thins');
  assert.equal(at(STREAM_END).stream,null);
  assert.equal(levels[4].stream,null);assert.ok(levels[4].response>0,'response continues into receiver recovery');
  close(levels.at(-1)!.response,0);assert.equal(JSON.stringify(model.board),logicalBoard);
  model.sample(T+POUR_MS);model.advanceAfterFrame(T+POUR_MS);
  model.sample(T+POUR_MS+440);model.advanceAfterFrame(T+POUR_MS+440);
  assert.equal(model.isAnimating(),false);
});

test('frame-observed pour completion preserves the borrowed contact and surface presentation',()=>{
  const model=new StilllightModel();model.startPour(T);
  const borrowed=model.sample(T+POUR_MS),frozen=snapshotFrame(borrowed);
  model.advanceAfterFrame(T+POUR_MS);
  assert.deepEqual(snapshotFrame(borrowed),frozen);
  assert.ok(model.settleMotion);
});

test('receiver recovery has a finite activity tail and leaves FrameGate idle',()=>{
  const model=new StilllightModel();model.startPour(T);
  let pending:((time:number)=>void)|null=null,requests=0;
  const gate=new FrameGate(callback=>{pending=callback;return++requests;},()=>{pending=null;},time=>{
    model.sample(time);const changed=model.advanceAfterFrame(time);
    if(model.isAnimating()||changed)gate.schedule();
  });
  gate.schedule();
  let last=T;
  for(let i=0;i<100&&pending;i++){
    const callback=pending;pending=null;last=T+i*1000/60;callback(last);
  }
  assert.equal(pending,null);assert.equal(gate.isPending(),false);assert.equal(model.isAnimating(),false);
  assert.ok(last>=T+POUR_MS+440&&last<T+POUR_MS+440+60,'only boundary-commit frames follow the finite tail');
});
