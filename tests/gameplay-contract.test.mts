import test from 'node:test';
import assert from 'node:assert/strict';
import {StilllightModel} from '../src/core/model.ts';
import {gameplayLayout} from '../src/render/gameplayLayout.ts';
import {pour} from '../src/core/rules.ts';
import {solve} from '../src/session/solver.ts';

const mixed=[[2,0,3],[3]],finish=[[2,2,2],[2]];
function model(board=mixed){const m=new StilllightModel(board);m.setPresentationGeometry(gameplayLayout(390,844,board.length).profile);return m;}
function settle(m:StilllightModel,start:number,end=start+3000){for(let t=start;t<=end;t+=10){m.sample(t);m.advanceAfterFrame(t);}}
test('small portrait uses the full stage and puts two full-size glasses on the fixed stage line',()=>{
 for(const [w,h,glass] of [[320,568,70.4],[390,844,85.8],[430,932,94.6]]){
  const l=gameplayLayout(w,h,2);assert.equal(l.width,w);assert.ok(Math.abs(l.glassWidth-glass)<1e-8);
  assert.ok(Math.abs(l.homes[0].x-w*.31)<1e-8);assert.ok(Math.abs(l.homes[1].x-w*.69)<1e-8);
  for(const home of l.homes){assert.equal(home.scale,1);assert.ok(Math.abs(home.y+156*l.scale-h*.62)<1e-8);}
 }
});
test('three through eight vessels have centered disjoint hit geometry without changing demo content',()=>{
 for(const [w,h] of [[320,568],[390,844],[430,932],[768,1024]])for(let n=3;n<=8;n++){
  const l=gameplayLayout(w,h,n);assert.equal(l.homes.length,n);
  for(const row of new Set(l.homes.map(p=>p.row))){const homes=l.homes.filter(p=>p.row===row);assert.ok(Math.abs(homes.reduce((sum,p)=>sum+p.x,0)/homes.length-l.width/2)<1e-8);
   for(let i=0;i<homes.length;i++){const width=Math.max(44,l.glassWidth*homes[i].scale);assert.ok(homes[i].x-width/2>=0&&homes[i].x+width/2<=l.width);if(i)assert.ok(homes[i].x-homes[i-1].x>=width);}
  }
 }
});
test('fixed fixtures retain their truthful solver outcomes and maximal pour',()=>{
 assert.deepEqual(pour(mixed,0,1),{board:[[2,0],[3,3]],amount:1,color:3});assert.equal(pour(mixed,1,0)?.amount,1);
 assert.equal(solve(mixed).kind,'blocked');assert.deepEqual(solve(finish).path,[[0,1]]);
 assert.equal(pour([[0,0],[1,1]],0,1),null);
});
test('pour and Undo conserve every sampled visible unit and restore exact accepted history',()=>{
 const m=model(),initial=m.exportState();m.choose(0,0);m.choose(1,1);
 assert.deepEqual(m.board,[[2,0],[3,3]]);assert.equal(m.moveCount,1);
 for(let t=1;t<1481;t+=7){const f=m.sample(t);assert.ok(Math.abs(f.glasses.flatMap(g=>g.layers).reduce((sum,l)=>sum+l.amount,0)-4)<.005);m.advanceAfterFrame(t);}
 settle(m,1500,3000);assert.equal(m.undo(3001),true);
 for(let t=3001;t<=3521;t+=3){const f=m.sample(t);assert.ok(Math.abs(f.glasses.flatMap(g=>g.layers).reduce((sum,l)=>sum+l.amount,0)-4)<.005);m.advanceAfterFrame(t);}
 settle(m,3521,4000);assert.deepEqual(m.exportState(),initial);
});
test('Hint never modifies the board, and resetting a committed pour restores the fixture',()=>{
 const m=model(),initial=m.exportState();assert.equal(m.showHint(0,1,100),true);assert.deepEqual(m.exportState(),initial);
 m.choose(0,500);m.choose(1,501);m.sample(901);m.reset();assert.deepEqual(m.exportState(),initial);assert.equal(m.flights.length,0);
});
