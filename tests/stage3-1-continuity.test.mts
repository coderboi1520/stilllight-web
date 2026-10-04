import test from 'node:test';
import assert from 'node:assert/strict';
import {StilllightModel} from '../src/core/model.ts';
import {HINT_ATTENTION_MS,POUR_MS,SETTLE_MS} from '../src/core/constants.ts';
import {position} from '../src/core/geometry.ts';

const T=10000,DT=.05;
const close=(actual:number,expected:number,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
function pose(model:StilllightModel,now:number,index:number){const {x,y,angle}=model.sample(now).glasses[index].pose;return{x,y,angle};}
function surface(model:StilllightModel,now:number,index:number){const glass=model.sample(now).glasses[index];return{angle:glass.surfaceAngle,wave:glass.wave,phase:glass.phase};}

test('selection interrupting a two-vessel hint preserves both poses and partner velocity',()=>{
  const model=new StilllightModel();model.hint(T);
  const event=T+115,prior=[pose(model,event,0),pose(model,event,1)];
  const beforePartner=pose(model,event-DT,1);
  model.choose(0,event);assert.equal(model.hintMotion,null);
  for(const index of [0,1]){
    const current=pose(model,event,index);
    for(const key of ['x','y','angle'] as const)close(current[key],prior[index][key]);
  }
  const afterPartner=pose(model,event+DT,1);
  for(const key of ['x','y','angle'] as const){
    const incoming=(prior[1][key]-beforePartner[key])/DT,outgoing=(afterPartner[key]-prior[1][key])/DT;
    assert.ok(Math.abs(incoming-outgoing)<(key==='angle'?.0002:.004),`${key} velocity jumped`);
  }
  const home=position(1);
  assert.ok(Math.abs(pose(model,event+40,1).y-home.y)>.1,'partner returns over time');
  close(pose(model,event+160,1).y,home.y,1e-6);
  model.advanceAfterFrame(event+HINT_ATTENTION_MS);
  close(pose(model,event+HINT_ATTENTION_MS+1,1).y,home.y,1e-6);
});

test('invalid interruption clears shared hint only after the partner is captured',()=>{
  const model=new StilllightModel();model.board=[[1],[2]];model.hint(T);
  model.choose(0,T+115);
  model.hint(T+800);
  const event=T+920,before=pose(model,event,1);
  model.choose(1,event);
  assert.ok(model.invalidMotion);assert.equal(model.hintMotion,null);
  const at=pose(model,event,1);
  close(at.y,before.y);
  close(pose(model,event+160,1).y,position(1).y,1e-6);
});

test('free-vessel selection preserves another pair liquid recovery with cadence-independent continuation',()=>{
  const run=(step:number)=>{
    const model=new StilllightModel([[2,0,3],[3],[1],[]]);assert.equal(model.startPour(T),true);
    const finish=T+POUR_MS;model.sample(finish);model.advanceAfterFrame(finish);
    const event=finish+100;
    for(let at=finish;at<event;at+=step)model.sample(at);
    const before=surface(model,event,1),previous=surface(model,event-DT,1);
    assert.ok(before.wave>.9);
    model.choose(2,event);assert.equal(model.selected,2);
    const inherited=surface(model,event,1),after=surface(model,event+DT,1);
    for(const key of ['angle','wave','phase'] as const){
      close(inherited[key],before[key]);
      const incoming=(before[key]-previous[key])/DT,outgoing=(after[key]-inherited[key])/DT;
      assert.ok(Math.abs(incoming-outgoing)<.004,`${key} velocity jumped`);
    }
    assert.ok(surface(model,event+40,1).wave>0,'partner wave continues');
    const target=event+150;
    for(let at=event;at<target;at+=step)model.sample(at);
    const checkpoint=surface(model,target,1);
    const rest=surface(model,finish+SETTLE_MS,1);
    close(rest.angle,0);close(rest.wave,0);
    model.advanceAfterFrame(finish+SETTLE_MS);
    model.advanceAfterFrame(event+300);
    assert.equal(model.isAnimating(),false);
    return checkpoint;
  };
  const a=run(1000/60),b=run(1000/90),c=run(1000/120);
  for(const key of ['angle','wave','phase'] as const){close(a[key],b[key],1e-9);close(a[key],c[key],1e-9);}
});
