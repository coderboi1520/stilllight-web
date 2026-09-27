import test from 'node:test';
import assert from 'node:assert/strict';
import {StilllightModel} from '../src/core/model.ts';
import {POUR_MS,STREAM_END,TRANSFER_END} from '../src/core/constants.ts';
import {pourDirection,pouringLip,streamControl} from '../src/core/geometry.ts';

const T=10000;
const close=(actual:number,expected:number,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);

test('stream control is gravity dominant with a materially smaller bounded lateral bow',()=>{
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
    const lateral=stream.control.x-(stream.start.x+stream.end.x)/2;
    close(Math.abs(lateral),2.5);
    assert.ok(Math.abs(lateral)<3.5&&Math.abs(lateral)<7*.5,'bow is materially below the old 7-unit control bias');
    assert.ok(stream.control.y>stream.start.y&&stream.control.y<stream.end.y);
    assert.deepEqual(streamControl(stream.start,stream.end,pourDirection(source,target)),stream.control);
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
