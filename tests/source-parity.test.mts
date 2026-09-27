import test from 'node:test';
import assert from 'node:assert/strict';
import * as candidate from '../src/core/geometry.ts';
import * as oracle from '../reference/original/src/geometry.js';
import {pour as candidatePour} from '../src/core/rules.ts';
import {pour as oraclePour} from '../reference/original/src/puzzle.js';

const close=(a:number,b:number,t=1e-12)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const closePoint=(a:{x:number;y:number},b:{x:number;y:number})=>{close(a.x,b.x);close(a.y,b.y);};
const closePose=(a:{x:number;y:number;angle:number},b:{x:number;y:number;angle:number})=>{closePoint(a,b);close(a.angle,b.angle);};

test('unchanged geometry matches oracle while the stream retains its axis with a smaller Stage 3.1 bow',()=>{
  for(const i of [0,1])closePoint(candidate.position(i),oracle.position(i));
  for(const v of [-1,0,.03,.25,.5,.73,1,2]){
    close(candidate.clamp01(v),oracle.clamp01(v));
    close(candidate.smooth(v),oracle.smooth(v));
    close(candidate.smoother(v),oracle.smoother(v));
    close(candidate.easeOutCubic(v),oracle.easeOutCubic(v));
  }
  for(const remaining of [0,.25,1,2,3,4])close(candidate.tiltForUnits(remaining),oracle.tiltForUnits(remaining));
  for(const progress of [0,.05,.1,.22,.28,.5,.69,.7,.78,.9,1]){
    closePose(candidate.selectedPose(0,progress),oracle.selectedPose(0,progress));
    closePose(candidate.invalidPose(0,progress,1),oracle.invalidPose(0,progress,1));
  }
  const pose=candidate.movingPose(0,1,.5,2.4);
  closePoint(candidate.pouringLip(pose,1),oracle.pouringLip(pose,1));
  const start={x:121.2,y:88.4},end={x:200,y:116};
  const control=candidate.streamControl(start,end,1),original=oracle.streamControl(start,end,1);
  close(control.y,original.y);
  close(control.x,(start.x+end.x)/2+2.5);
  assert.ok(Math.abs(control.x-(start.x+end.x)/2)<Math.abs(original.x-(start.x+end.x)/2)/2);
  assert.equal(candidate.pourDirection(0,1),oracle.pourDirection(0,1));
});

test('candidate pour rules match untouched oracle rule on representative boards',()=>{
  const boards=[
    [[2,0,3],[3]],
    [[1,1,1],[1]],
    [[0,2],[1,1,1,1]],
    [[3,3,3,3],[]],
  ];
  for(const board of boards){
    for(const source of [0,1])for(const target of [0,1]){
      if(source===target)continue;
      assert.deepEqual(candidatePour(board.map(g=>[...g]),source,target),oraclePour(board.map(g=>[...g]),source,target));
    }
  }
});
