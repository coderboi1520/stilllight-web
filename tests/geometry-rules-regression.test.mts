import test from 'node:test';
import assert from 'node:assert/strict';
import {position,clamp01,smooth,smoother,easeOutCubic,tiltForUnits,selectedPose,invalidFeedbackPose,pouringLip,streamControl,pourDirection} from '../src/core/geometry.ts';
import {pour} from '../src/core/rules.ts';
const close=(actual:number,want:number)=>assert.ok(Math.abs(actual-want)<1e-12,`${actual} != ${want}`);

test('six vessel positions and approach directions use fixed board coordinates',()=>{
  assert.deepEqual([0,1,2,3,4,5].map(i=>position(i)),[{x:80,y:130},{x:200,y:130},{x:320,y:130},{x:80,y:372},{x:200,y:372},{x:320,y:372}]);
  for(const [s,t,want] of [[0,1,1],[1,0,-1],[2,5,1],[5,2,1],[4,1,-1],[1,4,1]])assert.equal(pourDirection(s,t),want);
});
test('easing clamps endpoints and retains quarter/midpoint analytical values',()=>{
  for(const [v,c,s,ss,e] of [[-1,0,0,0,0],[0,0,0,0,0],[.25,.25,.15625,.103515625,.578125],[.5,.5,.5,.5,.875],[1,1,1,1,1],[2,1,1,1,1]]){
    close(clamp01(v),c);close(smooth(v),s);close(smoother(v),ss);close(easeOutCubic(v),e);
  }
  for(const [units,angle] of [[0,1.565],[.25,1.5425],[1,1.4],[2,1.21],[3,1.02],[4,.83]])close(tiltForUnits(units),angle);
});
test('selection, invalid recovery and rotated lips meet independently stated landmarks',()=>{
  assert.deepEqual(selectedPose(4,0),{x:200,y:372,angle:0});assert.deepEqual(selectedPose(4,1),{x:200,y:362,angle:0});
  close(selectedPose(0,.5).y,120.39404913533436);
  for(const p of [0,1]){const pose=invalidFeedbackPose(2,p,-1);close(pose.x,320);close(pose.y,130);close(pose.angle,0);}
  const lip=pouringLip({x:100,y:200,angle:Math.PI/2},1);close(lip.x,100);close(lip.y,233);
  const opposite=pouringLip({x:100,y:200,angle:Math.PI/2},-1);close(opposite.x,100);close(opposite.y,167);
  assert.deepEqual(streamControl({x:121.2,y:88.4},{x:121.2,y:116},1),{x:121.2,y:102.2});
});
test('maximal matching runs obey capacity, reject mismatches and never mutate input',()=>{
  const cases=[
    {board:[[2,0,3],[3]],s:0,t:1,want:{board:[[2,0],[3,3]],amount:1,color:3}},
    {board:[[1,1,1],[1]],s:0,t:1,want:{board:[[],[1,1,1,1]],amount:3,color:1}},
    {board:[[0,2],[1,1,1,1]],s:0,t:1,want:null},
    {board:[[3,3,3,3],[]],s:0,t:1,want:{board:[[],[3,3,3,3]],amount:4,color:3}},
    {board:[[2,3,3],[3,3,3]],s:0,t:1,want:{board:[[2,3],[3,3,3,3]],amount:1,color:3}},
    {board:[[1],[2]],s:0,t:1,want:null},
    {board:[[],[2]],s:0,t:1,want:null},
    {board:[[3],[3]],s:0,t:0,want:null},
    {board:[[3],[2,3,3]],s:1,t:0,want:{board:[[3,3,3],[2]],amount:2,color:3}}
  ];
  for(const {board,s,t,want} of cases){const before=structuredClone(board);assert.deepEqual(pour(board,s,t),want);assert.deepEqual(board,before);}
});
