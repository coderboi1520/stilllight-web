import test from 'node:test';
import assert from 'node:assert/strict';
import {StilllightModel} from '../src/core/model.ts';
import {INITIAL,POUR_MS,SETTLE_MS,UNDO_MS} from '../src/core/constants.ts';
import {canonicalArea,liquidLevel} from '../src/core/liquidMath.ts';

const T=40000;
const close=(actual:number,expected:number,tolerance=1e-4)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
const amountOf=(glass:{layers:{amount:number}[]})=>glass.layers.reduce((sum,layer)=>sum+layer.amount,0);
function move(model:StilllightModel,source:number,target:number,now:number){model.choose(source,now);model.choose(target,now+1);assert.ok(model.flight);return now+1;}
function finishPourAndSettle(model:StilllightModel,started:number){
  const poured=started+POUR_MS;model.sample(poured);model.advanceAfterFrame(poured);
  const settled=poured+SETTLE_MS;model.sample(settled);model.advanceAfterFrame(settled);return settled;
}

const PROFILE:[number,number][]=[[-33,130],[-30,143],[-22,151],[-12,156],[12,156],[22,151],[30,143],[33,130]];
const BREAKS=[-33,-30,-22,-20,-12,-10,0,10,12,20,22,30,33];
function bottomAt(x:number){for(let i=0;i<PROFILE.length-1;i++){const [ax,ay]=PROFILE[i],[bx,by]=PROFILE[i+1];if(x>=ax&&x<=bx){const t=(x-ax)/(bx-ax);return ay+(by-ay)*t;}}return 130;}
function surfaceAt(surface:Float64Array,x:number){const step=10,left=Math.max(0,Math.min(43,Math.floor((x+220)/step))),a=left*2,b=a+2,t=(x-surface[a])/(surface[b]-surface[a]);return surface[a+1]+(surface[b+1]-surface[a+1])*t;}
function positiveLinearArea(h0:number,h1:number,width:number){if(h0<=0&&h1<=0)return 0;if(h0>=0&&h1>=0)return(h0+h1)*width*.5;if(h0>0){const span=width*h0/(h0-h1);return h0*span*.5;}const span=width*h1/(h1-h0);return h1*span*.5;}
function presentedArea(surface:Float64Array){let area=0;for(let i=0;i<BREAKS.length-1;i++){const a=BREAKS[i],b=BREAKS[i+1],h0=bottomAt(a)-surfaceAt(surface,a),h1=bottomAt(b)-surfaceAt(surface,b);area+=positiveLinearArea(h0,h1,b-a);}return area;}
function assertAreaPreserved(glass:{layers:{amount:number;surface?:Float64Array}[]}){const top=glass.layers.at(-1);if(!top){close(amountOf(glass),0,1e-12);return;}assert.ok(top.surface);close(presentedArea(top.surface),canonicalArea(amountOf(glass)),.02);}
function assertLowerCanonical(glass:{relativeLiquidRotation:number;layers:{amount:number;bottom:number;top:number}[]},untouched:number){
  close(glass.relativeLiquidRotation,0,1e-12);
  let cumulative=0;
  for(let i=0;i<untouched;i++){
    const layer=glass.layers[i];assert.ok(layer);close(layer.amount,1,1e-12);
    if(i>0)close(layer.bottom,liquidLevel(cumulative,0));cumulative+=1;close(layer.top,liquidLevel(cumulative,0));
  }
}

test('Undo preserves untouched canonical layer geometry and area at 0/25/50/75/100%',()=>{
  const model=new StilllightModel(),started=move(model,0,1,T),settled=finishPourAndSettle(model,started),undoAt=settled+50;
  assert.equal(model.undo(undoAt),true);
  for(const p of [0,.25,.5,.75,1]){
    const frame=model.sample(undoAt+UNDO_MS*p),left=frame.glasses[0],right=frame.glasses[1];
    assert.equal(frame.stream,null);assert.ok(left.wave>=0&&right.wave>=0);
    assertLowerCanonical(left,2);assertLowerCanonical(right,1);
    assertAreaPreserved(left);assertAreaPreserved(right);
    const transfer=frame.metrics.transfer,incoming=left.layers[2];
    if(transfer===0)assert.equal(incoming,undefined);else{assert.ok(incoming);close(incoming.amount,transfer,1e-12);}
    if(transfer<1){const outgoing=right.layers[1];assert.ok(outgoing);close(outgoing.amount,1-transfer,1e-12);}else assert.equal(right.layers.length,1);
  }
  model.sample(undoAt+UNDO_MS);model.advanceAfterFrame(undoAt+UNDO_MS);
  assert.ok(model.settleMotion);
  for(const p of [.25,.5,.75,1]){
    const at=undoAt+UNDO_MS+SETTLE_MS*p,frame=model.sample(at);
    assertLowerCanonical(frame.glasses[0],3);assertLowerCanonical(frame.glasses[1],1);
    assertAreaPreserved(frame.glasses[0]);assertAreaPreserved(frame.glasses[1]);
  }
});

test('multi-unit Undo preserves lower areas and reset immediately clears Undo presentation ownership',()=>{
  const model=new StilllightModel();model.board=[[2,3,3],[3]];
  const started=move(model,0,1,T),settled=finishPourAndSettle(model,started),undoAt=settled+50;
  assert.equal(model.flight,null);assert.equal(model.undo(undoAt),true);assert.equal(model.flight?.amount,2);
  for(const p of [0,.25,.5,.75,1]){
    const frame=model.sample(undoAt+UNDO_MS*p);
    assertLowerCanonical(frame.glasses[0],1);assertLowerCanonical(frame.glasses[1],1);
    assertAreaPreserved(frame.glasses[0]);assertAreaPreserved(frame.glasses[1]);
  }
  model.reset();
  const reset=model.sample(undoAt+UNDO_MS*.5+1);
  assert.deepEqual(model.board,INITIAL);assert.equal(model.flight,null);assert.equal(model.settleMotion,null);assert.equal(model.isAnimating(),false);
  assert.equal(reset.stream,null);
  for(const glass of reset.glasses){close(glass.surfaceAngle,0);close(glass.wave,0);close(glass.relativeLiquidRotation,0);assertAreaPreserved(glass);}
  assertLowerCanonical(reset.glasses[0],3);assertLowerCanonical(reset.glasses[1],1);
});


test('repeated Undo keeps the same canonical presentation invariant for each recorded transfer',()=>{
  const model=new StilllightModel();model.board=[[3],[]];
  const first=move(model,0,1,T),firstSettled=finishPourAndSettle(model,first);
  const second=move(model,1,0,firstSettled+50),secondSettled=finishPourAndSettle(model,second);
  for(let pass=0;pass<2;pass++){
    const undoAt=(pass===0?secondSettled:secondSettled+UNDO_MS+SETTLE_MS+100)+50;
    if(pass===1){model.sample(undoAt-50);model.advanceAfterFrame(undoAt-50);}
    assert.equal(model.undo(undoAt),true);
    for(const p of [0,.25,.5,.75,1]){
      const frame=model.sample(undoAt+UNDO_MS*p);
      for(const glass of frame.glasses){close(glass.relativeLiquidRotation,0,1e-12);assertAreaPreserved(glass);}
      close(amountOf(frame.glasses[0])+amountOf(frame.glasses[1]),1,1e-12);
    }
    model.sample(undoAt+UNDO_MS);model.advanceAfterFrame(undoAt+UNDO_MS);
    const settleEnd=undoAt+UNDO_MS+SETTLE_MS;model.sample(settleEnd);model.advanceAfterFrame(settleEnd);
  }
  assert.equal(model.undoDepth,0);
  assert.deepEqual(model.board,[[3],[]]);
});
