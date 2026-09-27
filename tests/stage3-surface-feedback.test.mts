import test from 'node:test';
import assert from 'node:assert/strict';
import {StilllightModel} from '../src/core/model.ts';
import {HINT_ATTENTION_MS,INVALID_MS,POUR_MS,SETTLE_MS} from '../src/core/constants.ts';
import {position} from '../src/core/geometry.ts';

const T=10000;
const close=(actual:number,expected:number,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
function surface(model:StilllightModel,now:number,index:number){const g=model.sample(now).glasses[index];return{angle:g.surfaceAngle,wave:g.wave,phase:g.phase,wavy:g.layers.at(-1)?.wavy};}

test('source and receiver carry one bounded surface state through transfer, recovery, and settling',()=>{
  const model=new StilllightModel();assert.equal(model.startPour(T),true);
  for(const p of [.30,.52,.69,.82,.94,1]){
    const source=surface(model,T+POUR_MS*p,0),receiver=surface(model,T+POUR_MS*p,1);
    assert.ok(source.wave>=0&&source.wave<=2,`source wave ${source.wave}`);
    assert.ok(receiver.wave>=0&&receiver.wave<=1.8,`receiver wave ${receiver.wave}`);
    assert.equal(source.wavy,true);assert.equal(receiver.wavy,true);
    if(p>=.82)assert.ok(receiver.wave>.9,'receiver follows through source recovery');
  }
  const finish=T+POUR_MS,before=[surface(model,finish,0),surface(model,finish,1)];
  model.advanceAfterFrame(finish);
  for(const index of [0,1]){
    const inherited=surface(model,finish,index);close(inherited.angle,before[index].angle);close(inherited.wave,before[index].wave);close(inherited.phase,before[index].phase);
    const mid=surface(model,finish+SETTLE_MS/2,index);
    assert.ok(Math.abs(mid.angle)<Math.abs(before[index].angle));
    assert.ok(mid.wave>0&&mid.wave<before[index].wave);
    close(mid.phase,before[index].phase+SETTLE_MS*.5*.018);
    const rest=surface(model,finish+SETTLE_MS,index);
    close(rest.angle,0);close(rest.wave,0);assert.equal(rest.wavy,true);
  }
  model.advanceAfterFrame(finish+SETTLE_MS);
  assert.equal(model.isAnimating(),false);
});

test('selection to pour inherits presented liquid and equivalent timestamps are cadence independent',()=>{
  const run=(step:number)=>{
    const model=new StilllightModel(),event=T+90;
    model.choose(0,T);
    for(let time=T;time<event;time+=step)model.sample(time);
    const before=surface(model,event,0);
    model.choose(1,event);
    const inherited=surface(model,event,0);
    close(inherited.angle,before.angle);close(inherited.wave,before.wave);close(inherited.phase,before.phase);
    for(let time=event;time<event+320;time+=step)model.sample(time);
    return surface(model,event+320,0);
  };
  const a=run(1000/60),b=run(1000/90),c=run(1000/120);
  for(const key of ['angle','wave','phase'] as const){close(a[key],b[key]);close(a[key],c[key]);}
});

test('flow, transfer end, and recovery boundaries do not reset surface state',()=>{
  const model=new StilllightModel();model.startPour(T);
  for(const p of [.30,.52,.69,.72,.82,1])for(const index of [0,1]){
    const a=surface(model,T+POUR_MS*(p-1e-7),index),b=surface(model,T+POUR_MS*p,index),c=surface(model,T+POUR_MS*(p+1e-7),index);
    assert.ok(Math.abs(a.angle-b.angle)<1e-5&&Math.abs(c.angle-b.angle)<1e-5,`angle jump at ${p}`);
    assert.ok(Math.abs(a.wave-b.wave)<1e-5&&Math.abs(c.wave-b.wave)<1e-5,`wave jump at ${p}`);
    assert.ok(Math.abs(a.phase-b.phase)<1e-5&&Math.abs(c.phase-b.phase)<1e-5,`phase jump at ${p}`);
  }
});

test('hint leads source to target with bounded motion and one fade inside 680 ms',()=>{
  const model=new StilllightModel();model.hint(T);const home0=position(0),home1=position(1);
  const at=(elapsed:number)=>{const f=model.sample(T+elapsed);return f.glasses.map(g=>({role:g.hintRole,strength:g.hintStrength,y:g.pose.y}));};
  assert.equal(at(35)[0].strength,.5);assert.equal(at(35)[1].strength,0);
  assert.equal(at(79)[1].role,null);close(at(115)[1].strength,.5);
  close(at(560)[0].strength,1);close(at(620)[0].strength,.5);close(at(HINT_ATTENTION_MS)[0].strength,0);
  for(const elapsed of [0,35,115,340,620,680]){
    const [source,target]=at(elapsed);assert.ok(Math.abs(source.y-home0.y)<=2);assert.ok(Math.abs(target.y-home1.y)<=2);
  }
  const events=model.events;model.hint(T+100);assert.strictEqual(model.events,events,'rapid hints do not stack');
  model.advanceAfterFrame(T+HINT_ATTENTION_MS);assert.equal(model.isAnimating(),false);
});

test('invalid cue has one 5-unit deflection, a smaller counter-motion, and exact return',()=>{
  const model=new StilllightModel(),home=position(0);model.invalid(T);
  const x=(p:number)=>model.sample(T+INVALID_MS*p).glasses[0].pose.x-home.x;
  close(x(0),0);close(x(.24),5,1e-6);close(x(.56),-1.5,1e-6);close(x(1),0,1e-6);
  const emphasized=model.sample(T+INVALID_MS*.24).glasses;assert.ok(emphasized[0].invalid&&emphasized[1].invalid);assert.ok(emphasized[0].invalidStrength>.6);
  model.advanceAfterFrame(T+INVALID_MS);assert.equal(model.isAnimating(),false);
});

test('invalid interrupts a hint continuously without resuming its cue afterward',()=>{
  const model=new StilllightModel();model.hint(T);
  const event=T+120,before=model.sample(event).glasses[0].pose.y;
  model.invalid(event);
  close(model.sample(event).glasses[0].pose.y,before);
  assert.equal(model.hintMotion,null);
  model.sample(event+INVALID_MS);model.advanceAfterFrame(event+INVALID_MS);
  const after=model.sample(event+INVALID_MS+1);
  assert.equal(after.glasses[0].hintRole,null);assert.equal(after.glasses[1].hintRole,null);
});
