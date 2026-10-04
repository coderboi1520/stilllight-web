import test from 'node:test';
import assert from 'node:assert/strict';
import {StilllightModel} from '../src/core/model.ts';
import {HINT_ATTENTION_MS,INVALID_MS,POUR_MS,SELECT_MS,SETTLE_MS} from '../src/core/constants.ts';
import {snapshotFrame} from '../src/debug/snapshot.ts';
import {viewportState} from '../src/render/ViewportController.ts';
import {FrameGate} from '../src/runtime/FrameGate.ts';
import {selectBackend} from '../src/render/backendPolicy.ts';
import {CanvasRenderer} from '../src/render/CanvasRenderer.ts';
const T=10000;

test('authored durations are pinned independently of candidate timing math',()=>{assert.equal(POUR_MS,1040);assert.equal(SELECT_MS,300);assert.equal(INVALID_MS,420);assert.equal(SETTLE_MS,440);assert.equal(HINT_ATTENTION_MS,680);});

test('moving source suppresses hint emphasis while target hint remains valid',()=>{const m=new StilllightModel();m.hint(T);assert.equal(m.startPour(T+100),true);const frame=m.sample(T+150);assert.equal(frame.glasses[0].moving,true);assert.equal(frame.glasses[0].hintRole,null);assert.equal(frame.glasses[1].hintRole,'target');});

test('selection then hint then pour also suppresses moving-source hint after the target delay',()=>{const m=new StilllightModel();m.choose(0,T);m.hint(T+10);m.choose(1,T+20);const frame=m.sample(T+110);assert.equal(frame.glasses[0].moving,true);assert.equal(frame.glasses[0].hintRole,null);assert.equal(frame.glasses[1].hintRole,'target');});

test('selection then hint then reverse pour suppresses moving-target hint',()=>{const m=new StilllightModel();m.choose(1,T);m.hint(T+10);m.choose(0,T+20);const frame=m.sample(T+70);assert.equal(frame.glasses[1].moving,true);assert.equal(frame.glasses[1].hintRole,null);assert.equal(frame.glasses[0].hintRole,'source');});

test('hint expiry clears both hint roles',()=>{const m=new StilllightModel();m.hint(T);m.advanceAfterFrame(T+HINT_ATTENTION_MS);const frame=m.sample(T+HINT_ATTENTION_MS);assert.equal(frame.glasses[0].hintRole,null);assert.equal(frame.glasses[1].hintRole,null);});

test('warm samples reuse frame, glass, layer and surface storage while snapshots stay stable',()=>{const m=new StilllightModel();m.startPour(T);const a=m.sample(T+500),glass=a.glasses[0],layers=glass.layers,surface=layers.at(-1)?.surface;assert.ok(surface);const snap=snapshotFrame(a);const snapSurface=[...(snap.glasses[0].layers.at(-1)?.surface??[])];const b=m.sample(T+510);assert.strictEqual(a,b);assert.strictEqual(glass,b.glasses[0]);assert.strictEqual(layers,b.glasses[0].layers);assert.strictEqual(surface,b.glasses[0].layers.at(-1)?.surface);m.sample(T+600);assert.deepEqual(snap.glasses[0].layers.at(-1)?.surface,snapSurface);});

test('viewport coordination caps DPR and computes responsive backing stores',()=>{assert.deepEqual(viewportState(400,620,1),{width:400,height:620,density:1,scale:1,backingWidth:400,backingHeight:620});assert.deepEqual(viewportState(320,496,1.5),{width:320,height:496,density:1.5,scale:.8,backingWidth:480,backingHeight:744});assert.deepEqual(viewportState(300,465,3),{width:300,height:465,density:2,scale:.75,backingWidth:600,backingHeight:930});});

test('parity clock gate cancels production RAF and blocks contamination until exit',()=>{let requested=0,cancelled:number[]=[],ran:number[]=[];const callbacks=new Map<number,(t:number)=>void>();const gate=new FrameGate(cb=>{const id=++requested;callbacks.set(id,cb);return id;},id=>cancelled.push(id),t=>ran.push(t));assert.equal(gate.schedule(),true);assert.equal(gate.schedule(),false);gate.enterParity();assert.deepEqual(cancelled,[1]);callbacks.get(1)?.(101);assert.deepEqual(ran,[]);assert.equal(gate.schedule(),false);gate.exitParity();assert.equal(gate.schedule(),true);callbacks.get(2)?.(202);assert.deepEqual(ran,[202]);assert.equal(gate.isPending(),false);});

test('GPU availability selects WebGL and unavailability selects intentional Canvas fallback',()=>{assert.equal(selectBackend(true),'webgl');assert.equal(selectBackend(false),'canvas');});

test('Canvas composes each glass once, shines inside its unrotated clip, and uses authored invalid rim widths',()=>{
  const calls=[];const state={rotation:0,clipped:false,fillStyle:null,strokeStyle:null,lineWidth:1,shadowBlur:0,shadowColor:null};const stack=[];
  const ctx={...state,
    save(){stack.push({rotation:this.rotation,clipped:this.clipped,fillStyle:this.fillStyle,strokeStyle:this.strokeStyle,lineWidth:this.lineWidth,shadowBlur:this.shadowBlur,shadowColor:this.shadowColor});},
    restore(){Object.assign(this,stack.pop());},translate(){},rotate(angle){this.rotation+=angle;},setTransform(){this.rotation=0;},clearRect(){},
    beginPath(){this.path=null;},moveTo(){},lineTo(){},quadraticCurveTo(){},bezierCurveTo(){},scale(){},closePath(){},
    clip(){this.clipped=true;calls.push({kind:'clip'});},
    fill(){calls.push({kind:'fill',style:this.fillStyle,shadow:this.shadowColor,blur:this.shadowBlur});},
    fillRect(x,y,w,h){calls.push({kind:'fillRect',x,y,w,h,style:this.fillStyle,clipped:this.clipped,rotation:this.rotation});},
    drawImage(image,x,y,w,h){calls.push({kind:'image',image,x,y,w,h,clipped:this.clipped,rotation:this.rotation});},
    ellipse(){this.path='rim';},stroke(){calls.push({kind:'stroke',path:this.path,width:this.lineWidth,blur:this.shadowBlur});},
    createRadialGradient(...args){return this.createLinearGradient(...args);},
    createLinearGradient(...args){const gradient={args,stops:[],addColorStop(at,color){this.stops.push([at,color]);}};calls.push({kind:'gradient',gradient});return gradient;}
  };
  const originalDocument=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>ctx})};
  try{
    const renderer=new CanvasRenderer(),model=new StilllightModel();model.startPour(T);const frame=model.sample(T+500);calls.length=0;renderer.render(frame);
    const body=calls.filter(c=>c.kind==='fill'&&c.style==='rgba(16,39,49,.18)');assert.equal(body.length,2);
    assert.ok(!calls.some(c=>c.kind==='fill'&&c.style==='rgba(12,31,42,.78)'),'no opaque shadow body is painted over the backdrop');
    const firstBody=calls.findIndex(c=>c.kind==='fill'&&c.style==='rgba(16,39,49,.18)'),firstClip=calls.findIndex(c=>c.kind==='clip'),firstShine=calls.findIndex(c=>c.kind==='image'&&c.clipped),firstWall=calls.findIndex(c=>c.kind==='stroke'&&c.width===1.25);assert.ok(firstBody<firstClip&&firstClip<firstShine&&firstShine<firstWall);
    const shines=calls.filter(c=>c.kind==='image'&&c.clipped);assert.equal(shines.length,6,'base, reflection and edge each compose once per glass');
    for(const shine of shines){assert.deepEqual([shine.y,shine.w,shine.h],[0,68,158]);assert.equal(shine.clipped,true);}
    assert.ok(shines.slice(0,3).every(s=>s.rotation===frame.glasses[1].pose.angle));assert.ok(shines.slice(3).every(s=>s.rotation===frame.glasses[0].pose.angle));
    const artwork=shines.map(s=>s.image);calls.length=0;renderer.render(frame);assert.deepEqual(calls.filter(c=>c.kind==='image'&&c.clipped).map(s=>s.image),artwork,'artwork canvases are retained between frames');
    calls.length=0;model.reset();model.invalid(T+1000);renderer.render(model.sample(T+1100));
    const invalidRims=calls.filter(c=>c.kind==='stroke'&&c.path==='rim'&&c.blur===12);assert.equal(invalidRims.length,2);assert.ok(invalidRims.every(c=>c.width===3));
    assert.ok(calls.some(c=>c.kind==='stroke'&&c.path==='rim'&&c.blur===0&&c.width===1.4));
  }finally{if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;}
});
