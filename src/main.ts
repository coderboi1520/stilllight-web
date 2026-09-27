/// <reference types="vite/client" />
import './styles.css';
import { StilllightModel } from './core/model.ts';
import { StageRenderer } from './render/StageRenderer.ts';
import { ViewportController } from './render/ViewportController.ts';
import { HINT_ATTENTION_MS,INVALID_MS,POUR_MS,UNDO_MS,SELECT_MS,SETTLE_MS } from './core/constants.ts';
import { FrameGate } from './runtime/FrameGate.ts';
import { snapshotFrame } from './debug/snapshot.ts';

const host=document.querySelector<HTMLElement>('#pixi-host')!;
const board=document.querySelector<HTMLElement>('.board')!;
const renderer=new StageRenderer();
const model=new StilllightModel();
let lastRenderedTime=performance.now();
let lastPresentedFrame:ReturnType<StilllightModel['sample']>|null=null;
const metrics={prep:[] as number[],render:[] as number[],intervals:[] as number[],last:0};

await renderer.init(host,()=>invalidateScene());

function draw(now=performance.now()){renderAt(now,true,true);}
const frameGate=new FrameGate(cb=>requestAnimationFrame(cb),id=>cancelAnimationFrame(id),draw);
function renderAt(now:number,advance:boolean,recordMetrics:boolean){
  if(recordMetrics){if(metrics.last)metrics.intervals.push(now-metrics.last);metrics.last=now;}
  const a=performance.now(),frame=model.sample(now),b=performance.now();renderer.render(frame);lastPresentedFrame=frame;const c=performance.now();lastRenderedTime=now;
  if(recordMetrics){metrics.prep.push(b-a);metrics.render.push(c-b);if(metrics.prep.length>600){metrics.prep.shift();metrics.render.shift();metrics.intervals.shift();}}
  if(advance){const changed=model.advanceAfterFrame(now);if(!frameGate.isParity()&&(model.isAnimating()||changed))schedule();}
  return frame;
}
function schedule(){frameGate.schedule();}
function invalidateScene(){if(frameGate.isParity()){if(lastPresentedFrame)renderer.render(lastPresentedFrame);return;}if(model.isAnimating())schedule();else renderer.render(model.sample(lastRenderedTime));}
function choose(i:number){if(frameGate.isParity())return;model.choose(i,performance.now());schedule();}

document.querySelectorAll<HTMLButtonElement>('[data-glass]').forEach(b=>b.addEventListener('click',()=>choose(Number(b.dataset.glass))));
window.addEventListener('keydown',e=>{if(e.repeat||frameGate.isParity())return;const k=e.key.toLowerCase();if(import.meta.env.DEV&&k==='c'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){model.previewCompletedRight(performance.now());schedule();}if(k==='h'){model.hint(performance.now());schedule();}if(k==='i'){model.invalid(performance.now());schedule();}if(k==='r'){model.reset();schedule();}if(k==='p'){model.startPour(performance.now());schedule();}if(k==='u'||k==='z'&&(e.ctrlKey||e.metaKey)){if(k==='z')e.preventDefault();if(model.undo(performance.now()))schedule();}});

const viewport=new ViewportController(board,s=>renderer.resize(s.width,s.height,s.density),invalidateScene);
viewport.start();

function enterParity(){if(frameGate.isParity())return;frameGate.enterParity();metrics.last=0;}
function exitParity(){if(!frameGate.isParity())return;frameGate.exitParity();lastRenderedTime=performance.now();renderAt(lastRenderedTime,false,false);if(model.isAnimating())schedule();}
function debugAction(action:'reset'|'select'|'hint'|'invalid'|'pour'|'undo',now:number){enterParity();if(action==='reset')model.reset();if(action==='select')model.choose(0,now);if(action==='hint')model.hint(now);if(action==='invalid')model.invalid(now);if(action==='pour')model.startPour(now);if(action==='undo')model.undo(now);}
let lastDebugFrame:ReturnType<typeof snapshotFrame>|null=null;
function debugStep(now:number){enterParity();const frame=model.sample(now);renderer.render(frame);lastPresentedFrame=frame;lastRenderedTime=now;lastDebugFrame=snapshotFrame(frame);model.advanceAfterFrame(now);return lastDebugFrame;}
function stats(values:number[]){if(!values.length)return{count:0,mean:0,p95:0,p99:0};const sorted=[...values].sort((a,b)=>a-b),pick=(q:number)=>sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*q))];return{count:values.length,mean:values.reduce((a,b)=>a+b,0)/values.length,p95:pick(.95),p99:pick(.99)};}
(window as any).__STILLLIGHT_PIXI__={action:debugAction,step:debugStep,enterParity,exitParity,isParity:()=>frameGate.isParity(),state:()=>({board:model.board.map(g=>[...g]),selected:model.selected,busy:model.busy}),lastFrame:()=>lastDebugFrame,backend:()=>renderer.backend,metrics:()=>({prep:stats(metrics.prep),render:stats(metrics.render),frameIntervals:stats(metrics.intervals)}),constants:{POUR_MS,UNDO_MS,SELECT_MS,INVALID_MS,SETTLE_MS,HINT_ATTENTION_MS}};

renderAt(lastRenderedTime,false,false);
