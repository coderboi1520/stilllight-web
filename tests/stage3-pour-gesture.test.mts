import test from 'node:test';
import assert from 'node:assert/strict';
import {StilllightModel} from '../src/core/model.ts';
import {POUR_MS,SELECT_LIFT,STREAM_END,STREAM_START,TRANSFER_END,TRANSFER_START} from '../src/core/constants.ts';
import {movingPose,position,tiltForUnits} from '../src/core/geometry.ts';

const T=10000;
const directions=[[0,1],[1,0]] as const;
const close=(actual:number,expected:number,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);

test('both pour directions tilt during approach and resolve at exact rest',()=>{
  for(const [source,target] of directions){
    const home=position(source),atStart=movingPose(source,target,0,3),early=movingPose(source,target,.09,3),approach=movingPose(source,target,.28,3),pour=movingPose(source,target,.30,3),atEnd=movingPose(source,target,1,3);
    close(atStart.x,home.x);close(atStart.y,home.y-SELECT_LIFT);close(atStart.angle,0);
    assert.ok(Math.abs(early.angle)>.0001,'tilt begins before travel ends');
    assert.ok(Math.abs(early.x-home.x)>1,'travel continues while tilt begins');
    assert.ok(Math.abs(approach.angle)>0,'tilt overlaps arrival');
    close(Math.abs(pour.angle),tiltForUnits(3),1e-6);
    close(atEnd.x,home.x);close(atEnd.y,home.y);close(atEnd.angle,0);
  }
});

test('vertical recovery has no late velocity kick and all pose velocity vanishes at landing',()=>{
  const step=1e-5;
  for(const [source,target] of directions){
    const before=movingPose(source,target,.78-step,3),at=movingPose(source,target,.78,3),after=movingPose(source,target,.78+step,3);
    const beforeVelocity=(at.y-before.y)/step,afterVelocity=(after.y-at.y)/step;
    assert.ok(Math.abs(afterVelocity-beforeVelocity)<1,'vertical velocity stays continuous through late recovery');
    const near=movingPose(source,target,1-.001,3),landed=movingPose(source,target,1,3);
    assert.ok(Math.abs((landed.x-near.x)/(.001*POUR_MS))<.002);
    assert.ok(Math.abs((landed.y-near.y)/(.001*POUR_MS))<.002);
    assert.ok(Math.abs((landed.angle-near.angle)/(.001*POUR_MS))<.00005);
  }
});

test('1040 ms transfer and stream windows remain unchanged through the authored gesture',()=>{
  close(POUR_MS,1040);close(TRANSFER_START,.30);close(TRANSFER_END,.69);close(STREAM_START,.275);close(STREAM_END,.715);
  for(const [source,target] of directions){
    const model=new StilllightModel();model.choose(source,T);model.choose(target,T+90);
    const start=T+90;
    close(model.sample(start+POUR_MS*TRANSFER_START).metrics.transfer,0);
    assert.equal(model.sample(start+POUR_MS*STREAM_START).stream,null);
    assert.ok(model.sample(start+POUR_MS*.5).stream);
    close(model.sample(start+POUR_MS*TRANSFER_END).metrics.transfer,1);
    assert.equal(model.sample(start+POUR_MS*STREAM_END).stream,null);
    close(model.sample(start+POUR_MS).metrics.pourProgress,1);
    assert.equal(model.sample(start+POUR_MS).glasses[source].moving,true);
  }
});

test('equivalent timestamps give the same presented pose at 60, 90 and 120 Hz in both directions',()=>{
  for(const [source,target] of directions){
    const run=(hz:number)=>{
      const model=new StilllightModel(),event=T+90,at=event+POUR_MS*.84;
      model.choose(source,T);
      for(let now=T;now<event;now+=1000/hz)model.sample(now);
      model.choose(target,event);
      for(let now=event;now<at;now+=1000/hz)model.sample(now);
      const {x,y,angle}=model.sample(at).glasses[source].pose;
      return{x,y,angle};
    };
    const a=run(60),b=run(90),c=run(120);
    for(const key of ['x','y','angle'] as const){close(a[key],b[key],1e-9);close(a[key],c[key],1e-9);}
  }
});
