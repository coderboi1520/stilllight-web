import test from 'node:test';import assert from 'node:assert/strict';
import {GameplayInput} from '../src/shell/gameplayInput.ts';
import {StilllightModel} from '../src/core/model.ts';import {gameplayLayout} from '../src/render/gameplayLayout.ts';
function fixture(board=[[2,0,3],[3]]){let now=0,blocked=false;const m=new StilllightModel(board);m.setPresentationGeometry(gameplayLayout(390,844,2).profile);
 const input=new GameplayInput(()=>({board:m.board,selected:m.selected,blocked,busy:m.busy||!!m.settleMotion,undoRunning:m.flights.some(f=>f.kind==='undo'),undoDepth:m.undoDepth,canUndo:m.canUndo(now),available:i=>m.isVesselAvailable(i)}),i=>m.choose(i,now),()=>m.undo(now),()=>{m.cancelHint(now);if(m.selected!==null)m.choose(m.selected,now);});
 const step=(to:number)=>{for(;now<=to;now+=10){m.sample(now);m.advanceAfterFrame(now);input.flush();}};return {m,input,step,setBlocked:()=>blocked=true};
}
test('one legal buffered tap selects once when a committed pour settles',()=>{const f=fixture();f.input.choose(0);f.input.choose(1);assert.equal(f.input.choose(0),'queued');f.step(1800);assert.equal(f.m.selected,0);assert.equal(f.m.moveCount,1);});
test('Reset or modal cancellation prevents a buffered tap from firing later',()=>{const f=fixture();f.input.choose(0);f.input.choose(1);f.input.choose(0);f.input.clear();f.m.reset();f.step(2000);assert.equal(f.m.selected,null);assert.equal(f.m.moveCount,0);});
test('illegal delayed targets and stale board revisions are rejected',()=>{const f=fixture();f.input.choose(0);f.input.choose(1);f.input.choose(0);f.m.reset();f.step(2000);assert.equal(f.m.selected,null);
 f.m.selected=0;f.setBlocked();assert.equal(f.input.choose(1),'rejected');assert.equal(f.input.undo(),'rejected');});
test('buffering a second Undo restores exactly the next chronological entry',()=>{const f=fixture([[2,2,2],[2]]);f.input.choose(0);f.input.choose(1);f.step(2000);f.input.choose(1);f.input.choose(0);f.step(4000);assert.equal(f.m.moveCount,2);assert.equal(f.input.undo(),'accepted');assert.equal(f.input.undo(),'queued');f.step(5500);assert.equal(f.m.moveCount,0);assert.deepEqual(f.m.board,[[2,2,2],[2]]);});
test('Undo first releases selection and restores history only once the glasses are stationary',()=>{const f=fixture();f.input.choose(0);f.input.choose(1);f.step(2000);f.input.choose(0);f.step(2150);assert.equal(f.input.undo(),'queued');assert.equal(f.m.moveCount,1);f.step(3200);assert.equal(f.m.moveCount,0);assert.deepEqual(f.m.board,[[2,0,3],[3]]);});
