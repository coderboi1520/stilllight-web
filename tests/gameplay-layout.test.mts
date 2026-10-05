import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gameplayLayout} from '../src/render/gameplayLayout.ts';
import {sceneGeometry} from '../src/core/sceneGeometry.ts';
import {StilllightModel} from '../src/core/model.ts';
import {ORDINARY_COMMISSION} from '../src/core/ordinaryCommission.ts';
import {CLAUDE_VISUAL_BOARD} from '../src/debug/claudeFixture.ts';
import {solve} from '../src/session/solver.ts';
import {pour,isBottleComplete} from '../src/core/rules.ts';
test('eight-glass development reference has actual conserved solvable content, without campaign changes',()=>{const r=solve(CLAUDE_VISUAL_BOARD);assert.equal(r.kind,'solved');let board=CLAUDE_VISUAL_BOARD;for(const [a,b] of r.path)board=pour(board,a,b)!.board;assert.ok(board.every(g=>!g.length||isBottleComplete(g)));assert.deepEqual(CLAUDE_VISUAL_BOARD.flat().sort(),[0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3]);});
test('Claude layout balances real rows and keeps the genuine tutorial and exact eight-vessel fixture',()=>{
 for(const [vw,h] of [[320,568],[360,640],[375,667],[390,844],[430,932],[768,1024],[400,889],[450,1000],[400,778]])for(const n of [3,4,5,6,8]){
  const l=gameplayLayout(vw,h,n);assert.equal(l.width,Math.min(vw,h*.5,430));assert.equal(l.homes.length,n);
  for(const row of [0,1]){const points=l.homes.filter(p=>p.row===row);if(points.length)assert.ok(Math.abs(points.reduce((a,p)=>a+p.x,0)/points.length-l.width/2)<1e-8);}
  assert.ok(l.homes.every(p=>p.x-l.glassWidth*p.scale/2>=0&&p.x+l.glassWidth*p.scale/2<=l.width));
 }
 const e=gameplayLayout(430,932,8);assert.deepEqual(e.homes.slice(0,4).map(p=>Math.round(p.x/e.width*1000)/10),[15.5,38.5,61.5,84.5]);
});
test('live balanced geometry preserves concurrent volume, connected mouths and exact history Undo',()=>{
 const m=new StilllightModel(ORDINARY_COMMISSION),l=gameplayLayout(390,844,6);m.setPresentationGeometry(l.profile);const before=m.exportState();m.choose(0,1000);m.choose(1,1001);m.choose(2,1100);m.choose(5,1101);
 for(const t of [1250,1400,1550,1650]){const f=m.sample(t);assert.ok(Math.abs(f.glasses.flatMap(g=>g.layers).reduce((n,l)=>n+l.amount,0)-16)<1e-8);for(const stream of f.streams){const a=f.glasses[stream.source],direction=m.geometry.pourDirection(stream.source,stream.target),x=a.pose.x+direction*33*a.localScale!*Math.cos(a.pose.angle),y=a.pose.y+direction*33*a.localScale!*Math.sin(a.pose.angle);assert.ok(Math.abs(stream.start.x-x)<1e-7&&Math.abs(stream.start.y-y)<1e-7);assert.ok(Math.abs(f.glasses[stream.target].contact.local.x)<=33);}}
 for(const t of [2400,3000]){m.sample(t);m.advanceAfterFrame(t);}assert.equal(m.undoDepth,2);assert.equal(m.undo(3001),true);m.sample(4000);m.advanceAfterFrame(4000);m.sample(4500);m.advanceAfterFrame(4500);assert.equal(m.undo(4501),true);m.sample(5500);m.advanceAfterFrame(5500);assert.deepEqual(m.exportState(),before);
});
test('shared geometry keeps pouring mouth and real receiver surface in one coordinate space',()=>{
 const l=gameplayLayout(390,844,6),g=sceneGeometry(l.profile),s=g.movingPose(0,5,.5,2),mouth=g.pouringLip(s,g.pourDirection(0,5),undefined,0);
 assert.ok(Math.abs(mouth.x-g.position(5).x)<1e-8);assert.equal(g.localScale(0),.92);assert.equal(g.localScale(5),1);
 assert.equal(l.profile.selectMs,140);assert.equal(l.profile.lift,156*.12);
});

test('presentation feedback expires, cancels on reset, and Undo marks only its actual pair',()=>{
 const m=new StilllightModel(ORDINARY_COMMISSION),l=gameplayLayout(390,844,6);m.setPresentationGeometry(l.profile);const original=m.exportState();m.showResetDip(1000);
 const f=m.sample(1130);assert.ok(Math.abs((f.glasses[0].pose.y-m.geometry.position(0).y)*l.scale-6)<1e-8);assert.deepEqual(m.exportState(),original);
 m.sample(1500);m.advanceAfterFrame(1500);assert.equal(m.isAnimating(),false);m.choose(0,2000);m.choose(1,2150);m.sample(4000);m.advanceAfterFrame(4000);m.sample(5000);m.advanceAfterFrame(5000);assert.equal(m.undo(5001),true);
 assert.deepEqual(m.sample(5200).glasses.filter(g=>g.hintRole).map(g=>g.index),[0,1]);m.sample(5600);m.advanceAfterFrame(5600);assert.deepEqual(m.exportState(),original);assert.equal(m.isAnimating(),false);
 m.showHint(0,1,6000);assert.equal(m.sample(6000).glasses[0].hintStrength,0);assert.equal(m.sample(6200).glasses[0].hintStrength,1);assert.equal(m.sample(6700).glasses[0].hintStrength,.35);m.reset();m.reducedMotion=true;m.showResetDip(6000);assert.equal(m.isAnimating(),false);m.showHint(0,1,7000);assert.equal(m.sample(7200).glasses[0].hintStrength,.35);m.reset();assert.equal(m.isAnimating(),false);
});
