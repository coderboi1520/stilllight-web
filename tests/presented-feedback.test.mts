import test from 'node:test';
import assert from 'node:assert/strict';
import {StilllightModel} from '../src/core/model.ts';
import {presentedPourContact} from '../src/platform/presentedFeedback.ts';
test('contact waits for a presented fully revealed stream and is absent after the contact window',()=>{
 const m=new StilllightModel();m.startPour(1000);
 for(const [p,want] of [[.27,false],[.285,false],[.31,true],[.5,true],[.75,false],[1,false]] as const)assert.equal(presentedPourContact(m.sample(1000+1040*p),false),want,`progress ${p}`);
});
test('stationary Reduced Motion contact follows presented transfer and does not fire on a skipped finished pour',()=>{
 const m=new StilllightModel();m.reducedMotion=true;m.startPour(1000);
 for(const [p,want] of [[.29,false],[.31,true],[.5,true],[.75,false],[1,false]] as const)assert.equal(presentedPourContact(m.sample(1000+1040*p),true),want,`progress ${p}`);
});
