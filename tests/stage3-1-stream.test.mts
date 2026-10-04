import test from 'node:test';
import assert from 'node:assert/strict';
import {StilllightModel} from '../src/core/model.ts';
import {POUR_MS,SETTLE_MS,STREAM_END,TRANSFER_END} from '../src/core/constants.ts';
import {pourDirection,pouringLip,streamControl} from '../src/core/geometry.ts';
import {CanvasRenderer} from '../src/render/CanvasRenderer.ts';

const T=10000;
const close=(actual:number,expected:number,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);

test('both pour directions and an empty receiver use one vertical lip-to-surface centerline',()=>{
  for(const [source,target,board] of [
    [0,1,[[3],[3]]],
    [1,0,[[3],[2,3]]],
    [0,1,[[3],[]]]
  ] as const){
    const model=new StilllightModel();model.board=board.map(glass=>[...glass]);
    model.choose(source,T);model.choose(target,T+1);
    const frame=model.sample(T+1+POUR_MS*.5),stream=frame.stream;
    assert.ok(stream);assert.equal(stream.reveal,1);
    const lip=pouringLip(frame.glasses[source].pose,pourDirection(source,target));
    close(stream.start.x,lip.x);close(stream.start.y,lip.y);
    close(stream.end.x,frame.glasses[target].contact.world.x);
    close(stream.end.y,frame.glasses[target].contact.world.y);
    assert.ok(stream.end.y>stream.start.y,'liquid falls downward');
    close(stream.start.x,stream.end.x);
    close(stream.control.x,stream.start.x);
    close(stream.control.y,(stream.start.y+stream.end.y)/2);
    assert.ok(stream.control.y>stream.start.y&&stream.control.y<stream.end.y);
    for(const t of [0,.1,.25,.5,.75,.9,1]){
      const u=1-t,x=u*u*stream.start.x+2*u*t*stream.control.x+t*t*stream.end.x;
      close(x,stream.start.x);
    }
    assert.deepEqual(streamControl(stream.start,stream.end,pourDirection(source,target)),stream.control);
    for(const p of [.276,.30,.69,.714]){
      const at=model.sample(T+1+POUR_MS*p),fall=at.stream;assert.ok(fall);
      const currentLip=pouringLip(at.glasses[source].pose,pourDirection(source,target));
      close(fall.start.x,currentLip.x);close(fall.end.x,at.glasses[target].contact.world.x);
      close(fall.start.x,fall.end.x);close(fall.control.x,fall.start.x);
      assert.ok(fall.end.y>fall.start.y);
    }
    if(board[target].length===0)assert.equal(model.sample(T+1+POUR_MS*.285).glasses[target].contact.empty,true);
    const committed=JSON.stringify(model.board);
    const tail=model.sample(T+1+POUR_MS*((TRANSFER_END+STREAM_END)/2));
    close(tail.metrics.transfer,1);assert.ok(tail.stream);assert.equal(JSON.stringify(model.board),committed);
  }
});

test('stream geometry at an explicit time is independent of sampling cadence',()=>{
  const run=(step:number)=>{
    const model=new StilllightModel();model.startPour(T);
    const at=T+POUR_MS*.55;
    for(let now=T;now<at;now+=step)model.sample(now);
    const stream=model.sample(at).stream;assert.ok(stream);
    return{start:{...stream.start},control:{...stream.control},end:{...stream.end}};
  };
  assert.deepEqual(run(1000/60),run(1000/90));
  assert.deepEqual(run(1000/60),run(1000/120));
});

test('Canvas consumes the same vertical control and endpoint geometry from the shared frame',()=>{
  const curves:{cx:number;ex:number}[]=[];
  const ctx={save(){},restore(){},translate(){},rotate(){},setTransform(){},clearRect(){},
    beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},fill(){},stroke(){},fillRect(){},fillText(){},ellipse(){},
    quadraticCurveTo(cx:number,_cy:number,ex:number){curves.push({cx,ex});},
    createLinearGradient(){return{addColorStop(){}};}
  };
  const previousDocument=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>ctx})} as any;
  try{
    const model=new StilllightModel();model.startPour(T);
    const frame=model.sample(T+POUR_MS*.5),stream=frame.stream;assert.ok(stream);
    new CanvasRenderer().render(frame);
    const streamCurves=curves.filter(curve=>curve.cx>100);
    assert.equal(streamCurves.length,2);
    for(const curve of streamCurves){close(curve.cx,stream.start.x);close(curve.ex,stream.end.x);}
    curves.length=0;
    model.sample(T+POUR_MS);model.advanceAfterFrame(T+POUR_MS);
    const undoAt=T+POUR_MS+SETTLE_MS+50;model.advanceAfterFrame(undoAt);assert.equal(model.undo(undoAt),true);
    new CanvasRenderer().render(model.sample(undoAt+260));
    assert.equal(curves.filter(curve=>curve.cx>100).length,0,'Canvas renders no Undo stream');
  }finally{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});
