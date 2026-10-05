import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HoldConfirmation} from '../src/shell/holdConfirmation.ts';
test('hold accepts exactly once at 600ms, cancellation and repeated keyboard input cannot confirm',()=>{
 let now=0,accepted=0,task:(()=>void)|null=null;const h=new HoldConfirmation(()=>accepted++,()=>now,(f)=>{task=f;return 1;},()=>{task=null;});
 h.press();now=599;h.release();assert.equal(accepted,0);assert.equal(task,null);
 h.press();now=1199;task!();assert.equal(accepted,1);h.release();assert.equal(accepted,1);
 h.press();h.cancel();assert.equal(task,null);assert.equal(accepted,1);
 now=2000;h.key(false);h.key(true);assert.equal(accepted,1);now=3999;h.key(false);assert.equal(accepted,2);
 now=5000;h.key(false);now=7001;h.key(false);assert.equal(accepted,2);h.cancel();assert.equal(h.armed,false);
});
