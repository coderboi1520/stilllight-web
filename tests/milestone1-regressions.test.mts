import test from 'node:test';
import assert from 'node:assert/strict';
import {StilllightModel} from '../src/core/model.ts';
import {HINT_ATTENTION_MS,INVALID_MS,POUR_MS,SELECT_MS,SETTLE_MS} from '../src/core/constants.ts';
import {snapshotFrame} from '../src/debug/snapshot.ts';
import {viewportState} from '../src/render/ViewportController.ts';
import {FrameGate} from '../src/runtime/FrameGate.ts';
import {selectBackend} from '../src/render/backendPolicy.ts';
const T=10000;

test('authored durations are pinned independently of candidate timing math',()=>{assert.equal(POUR_MS,1040);assert.equal(SELECT_MS,300);assert.equal(INVALID_MS,420);assert.equal(SETTLE_MS,440);assert.equal(HINT_ATTENTION_MS,680);});

test('moving source suppresses hint emphasis while target hint remains valid',()=>{const m=new StilllightModel();m.hint(T);assert.equal(m.startPour(T+100),true);const frame=m.sample(T+150);assert.equal(frame.glasses[0].moving,true);assert.equal(frame.glasses[0].hintRole,null);assert.equal(frame.glasses[1].hintRole,'target');});

test('selection then hint then pour also suppresses moving-source hint',()=>{const m=new StilllightModel();m.choose(0,T);m.hint(T+10);m.choose(1,T+20);const frame=m.sample(T+70);assert.equal(frame.glasses[0].moving,true);assert.equal(frame.glasses[0].hintRole,null);assert.equal(frame.glasses[1].hintRole,'target');});

test('hint expiry clears both hint roles',()=>{const m=new StilllightModel();m.hint(T);m.advanceAfterFrame(T+HINT_ATTENTION_MS);const frame=m.sample(T+HINT_ATTENTION_MS);assert.equal(frame.glasses[0].hintRole,null);assert.equal(frame.glasses[1].hintRole,null);});

test('warm samples reuse frame, glass, layer and surface storage while snapshots stay stable',()=>{const m=new StilllightModel();m.startPour(T);const a=m.sample(T+500),glass=a.glasses[0],layers=glass.layers,surface=layers.at(-1)?.surface;assert.ok(surface);const snap=snapshotFrame(a);const snapSurface=[...(snap.glasses[0].layers.at(-1)?.surface??[])];const b=m.sample(T+510);assert.strictEqual(a,b);assert.strictEqual(glass,b.glasses[0]);assert.strictEqual(layers,b.glasses[0].layers);assert.strictEqual(surface,b.glasses[0].layers.at(-1)?.surface);m.sample(T+600);assert.deepEqual(snap.glasses[0].layers.at(-1)?.surface,snapSurface);});

test('viewport coordination caps DPR and computes responsive backing stores',()=>{assert.deepEqual(viewportState(400,620,1),{width:400,height:620,density:1,scale:1,backingWidth:400,backingHeight:620});assert.deepEqual(viewportState(320,496,1.5),{width:320,height:496,density:1.5,scale:.8,backingWidth:480,backingHeight:744});assert.deepEqual(viewportState(300,465,3),{width:300,height:465,density:2,scale:.75,backingWidth:600,backingHeight:930});});

test('parity clock gate cancels production RAF and blocks contamination until exit',()=>{let requested=0,cancelled:number[]=[],ran:number[]=[];const callbacks=new Map<number,(t:number)=>void>();const gate=new FrameGate(cb=>{const id=++requested;callbacks.set(id,cb);return id;},id=>cancelled.push(id),t=>ran.push(t));assert.equal(gate.schedule(),true);assert.equal(gate.schedule(),false);gate.enterParity();assert.deepEqual(cancelled,[1]);callbacks.get(1)?.(101);assert.deepEqual(ran,[]);assert.equal(gate.schedule(),false);gate.exitParity();assert.equal(gate.schedule(),true);callbacks.get(2)?.(202);assert.deepEqual(ran,[202]);assert.equal(gate.isPending(),false);});

test('GPU availability selects WebGL and unavailability selects intentional Canvas fallback',()=>{assert.equal(selectBackend(true),'webgl');assert.equal(selectBackend(false),'canvas');});
