import test from 'node:test';
import assert from 'node:assert/strict';
import {StilllightModel} from '../src/core/model.ts';
import {DEPARTURE_BLEND_MS,DESELECT_RETURN_MS,POUR_MS} from '../src/core/constants.ts';
import {movingPose,position} from '../src/core/geometry.ts';

const T=10000;
const EPS=.05;
type SamplePose={x:number;y:number;angle:number};

function poseAt(model:StilllightModel,now:number,index=0):SamplePose{
  const {x,y,angle}=model.sample(now).glasses[index].pose;
  return{x,y,angle};
}
function assertPoseClose(actual:SamplePose,expected:SamplePose,tolerance=1e-7){
  assert.ok(Math.abs(actual.x-expected.x)<=tolerance,`x ${actual.x} != ${expected.x}`);
  assert.ok(Math.abs(actual.y-expected.y)<=tolerance,`y ${actual.y} != ${expected.y}`);
  assert.ok(Math.abs(actual.angle-expected.angle)<=tolerance,`angle ${actual.angle} != ${expected.angle}`);
}
function velocity(a:SamplePose,b:SamplePose,dt:number):SamplePose{return{x:(b.x-a.x)/dt,y:(b.y-a.y)/dt,angle:(b.angle-a.angle)/dt};}
function assertVelocityClose(actual:SamplePose,expected:SamplePose){
  assert.ok(Math.abs(actual.x-expected.x)<.004,`vx ${actual.x} != ${expected.x}`);
  assert.ok(Math.abs(actual.y-expected.y)<.004,`vy ${actual.y} != ${expected.y}`);
  assert.ok(Math.abs(actual.angle-expected.angle)<.0002,`va ${actual.angle} != ${expected.angle}`);
}

test('early destination inherits event-time selection pose and velocity then rejoins authored flight',()=>{
  const model=new StilllightModel();
  model.choose(0,T);
  const event=T+90;
  const beforePrev=poseAt(model,event-EPS),before=poseAt(model,event);
  const beforeVelocity=velocity(beforePrev,before,EPS);
  model.choose(1,event);
  const at=poseAt(model,event),after=poseAt(model,event+EPS);
  assertPoseClose(at,before);
  assertVelocityClose(velocity(at,after,EPS),beforeVelocity);
  const authored=movingPose(0,1,DEPARTURE_BLEND_MS/POUR_MS,3);
  assertPoseClose(poseAt(model,event+DEPARTURE_BLEND_MS),authored,1e-6);
});

test('unselected shortcut pour departs from displayed home pose before bounded correction expires',()=>{
  const model=new StilllightModel(),home=position(0);
  assert.equal(model.startPour(T),true);
  assertPoseClose(poseAt(model,T),{x:home.x,y:home.y,angle:0});
  const authored=movingPose(0,1,DEPARTURE_BLEND_MS/POUR_MS,3);
  assertPoseClose(poseAt(model,T+DEPARTURE_BLEND_MS),authored,1e-6);
});

test('visual deselection returns for 160 ms without locking another selection',()=>{
  const model=new StilllightModel();
  model.choose(0,T);
  const event=T+120,before=poseAt(model,event),home=position(0);
  model.choose(0,event);
  assert.equal(model.selected,null);
  assert.equal(model.isAnimating(),true);
  assertPoseClose(poseAt(model,event),before);
  model.choose(1,event+40);
  assert.equal(model.selected,1);
  assert.ok(Math.abs(poseAt(model,event+40,0).y-home.y)>.1);
  assertPoseClose(poseAt(model,event+DESELECT_RETURN_MS,0),{x:home.x,y:home.y,angle:0},1e-6);
});

test('invalid interruption inherits pose and velocity without mutating the borrowed presented frame',()=>{
  const model=new StilllightModel();
  model.choose(0,T);
  const event=T+80;
  const beforePrev=poseAt(model,event-EPS);
  const borrowed=model.sample(event),borrowedPose={...borrowed.glasses[0].pose},borrowedSelected=borrowed.glasses[0].selected;
  const beforeVelocity=velocity(beforePrev,borrowedPose,EPS);
  model.invalid(event);
  assert.deepEqual(borrowed.glasses[0].pose,borrowedPose);
  assert.equal(borrowed.glasses[0].selected,borrowedSelected);
  const at=poseAt(model,event),after=poseAt(model,event+EPS);
  assertPoseClose(at,borrowedPose);
  assertVelocityClose(velocity(at,after,EPS),beforeVelocity);
});

test('handoff result depends on event timestamps rather than sampling cadence',()=>{
  const run=(step:number)=>{
    const model=new StilllightModel(),event=T+90,target=event+100;
    model.choose(0,T);
    for(let now=T;now<event;now+=step)model.sample(now);
    model.choose(1,event);
    for(let now=event;now<target;now+=step)model.sample(now);
    return poseAt(model,target);
  };
  const at60=run(1000/60),at90=run(1000/90),at120=run(1000/120);
  assertPoseClose(at90,at60,1e-9);
  assertPoseClose(at120,at60,1e-9);
});
