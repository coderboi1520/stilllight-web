/// <reference types="vite/client" />
import './styles.css';
import { StilllightModel } from './core/model.ts';
import { StageRenderer } from './render/StageRenderer.ts';
import { ViewportController } from './render/ViewportController.ts';
import { HINT_ATTENTION_MS,INVALID_MS,POUR_MS,UNDO_MS,SELECT_MS,SETTLE_MS } from './core/constants.ts';
import { FrameGate } from './runtime/FrameGate.ts';
import { snapshotFrame } from './debug/snapshot.ts';
import {INITIAL,SCENE_TOP_PADDING,H,W} from './core/constants.ts';
import {ORDINARY_COMMISSION,COLOR_NAMES} from './core/ordinaryCommission.ts';
import {position} from './core/geometry.ts';
import {isBottleComplete} from './core/rules.ts';
import {HapticEngine} from './platform/haptics.ts';
import {readHapticsEnabled,writeHapticsEnabled} from './platform/hapticsPreference.ts';
import {readReducedMotion,writeReducedMotion} from './platform/motionPreference.ts';
import {presentedPourContact} from './platform/presentedFeedback.ts';

// Do not suspend the entry module: production renderer chunks share its exports.
// A top-level await here deadlocks their dynamic imports after bundling.
async function start(){
let ready=false;
const host=document.querySelector<HTMLElement>('#pixi-host')!;
const board=document.querySelector<HTMLElement>('.board')!;
const query=new URLSearchParams(location.search);
const reference=import.meta.env.DEV&&query.get('fixture')==='reference';
const initial=reference?INITIAL:ORDINARY_COMMISSION;
document.querySelector('.atelier')!.classList.toggle('reference',reference);
const renderer=new StageRenderer(initial.length);
const model=new StilllightModel(initial);
model.reducedMotion=!reference&&readReducedMotion();
let hapticsEnabled=readHapticsEnabled();
const haptics=new HapticEngine(hapticsEnabled);
const contactFlights=new WeakSet<object>();
let completed=false;
const status=document.querySelector<HTMLElement>('.status')!;
const control=(name:string)=>document.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)!;
const hits=document.querySelector<HTMLElement>('.hit-glasses')!;
const glassButtons=initial.map((_,i)=>{
  const b=document.createElement('button');b.type='button';b.dataset.glass=String(i);
  const p=position(i);b.style.left=`${(p.x/W-.105)*100}%`;b.style.top=`${(p.y+SCENE_TOP_PADDING-8)/H*100}%`;
  hits.append(b);b.addEventListener('click',()=>choose(i));return b;
});
function updateControls(){
  glassButtons.forEach((b,i)=>{const layers=model.board[i];b.setAttribute('aria-label',`Vessel ${i+1}, ${layers.length?`top to bottom: ${[...layers].reverse().map(c=>COLOR_NAMES[c]).join(', ')}`:'empty'}`);b.setAttribute('aria-pressed',String(model.selected===i));b.disabled=!model.isVesselAvailable(i);});
  control('hint').disabled=model.busy||!!model.settleMotion;
  control('undo').disabled=!model.canUndo(performance.now());
  for(const [name,on] of [['haptics',hapticsEnabled],['motion',model.reducedMotion]] as const){control(name).setAttribute('aria-pressed',String(on));control(name).querySelector('span')!.textContent=on?'On':'Off';}
}
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
  if(advance){
    for(const flight of model.flights)if(!frameGate.isParity()&&flight.kind==='pour'&&presentedPourContact(frame,model.reducedMotion,flight.id)&&!contactFlights.has(flight)){contactFlights.add(flight);haptics.trigger('pourContact',false,true);}
    const eventCount=model.eventCount,changed=model.advanceAfterFrame(now);
    if(!frameGate.isParity()){
      const events=model.eventCount>eventCount?model.events.slice(-(model.eventCount-eventCount)):[];
      for(const event of events)if(event.startsWith('cap-contact:'))haptics.trigger('glassComplete',false,true);
      const solved=model.board.every(g=>!g.length||isBottleComplete(g));
      if(!solved)completed=false;
      if(solved&&!model.isAnimating()&&!completed){completed=true;status.textContent='Commission complete. Every color is settled.';haptics.trigger('levelComplete');}
      updateControls();
    }
    if(!frameGate.isParity()&&(model.isAnimating()||changed))schedule();
  }
  return frame;
}
function schedule(){frameGate.schedule();}
function invalidateScene(){if(frameGate.isParity()){if(lastPresentedFrame)renderer.render(lastPresentedFrame);return;}if(model.isAnimating())schedule();else renderer.render(model.sample(lastRenderedTime));}
function choose(i:number){
  if(!ready||frameGate.isParity())return;
  const count=model.eventCount;model.choose(i,performance.now());
  if(model.eventCount>count){const event=model.events.at(-1)!;
    if(event.startsWith('selected:')){haptics.trigger('select');status.textContent=`Vessel ${i+1} selected. Choose a destination.`;}
    else if(event.startsWith('invalid:')){haptics.trigger('reject');status.textContent='Choose a matching top color or an empty vessel with space.';}
    else if(event.startsWith('pour-start:')){const flight=model.flights.at(-1)!;status.textContent=`Pouring ${flight.amount} ${COLOR_NAMES[flight.color]} ${flight.amount===1?'unit':'units'} into vessel ${i+1}.`;}
    else status.textContent='Selection cleared.';
  }
  updateControls();schedule();
}
function action(name:string){
  if(!ready||frameGate.isParity())return;
  const now=performance.now();
  if(name==='hint'){model.hint(now);if(model.hintMotion){status.textContent=`Hint: vessel ${model.hintMotion.source+1} to vessel ${model.hintMotion.target+1}.`;haptics.trigger('uiClick');}else status.textContent='No useful pour is available. Undo or restart to recover.';}
  if(name==='undo'&&model.undo(now)){completed=false;status.textContent='Previous pour restored.';haptics.trigger('uiClick');}
  if(name==='restart'){model.reset();completed=false;status.textContent='Commission restarted.';haptics.trigger('uiClick');}
  if(name==='haptics'){hapticsEnabled=!hapticsEnabled;haptics.setEnabled(hapticsEnabled);writeHapticsEnabled(hapticsEnabled);haptics.trigger(hapticsEnabled?'toggleOn':'toggleOff',true);}
  if(name==='motion'){model.reducedMotion=!model.reducedMotion;writeReducedMotion(model.reducedMotion);haptics.trigger('uiClick');}
  updateControls();schedule();
}

document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(b=>b.addEventListener('click',()=>action(b.dataset.action!)));
window.addEventListener('keydown',e=>{
  if(e.repeat||frameGate.isParity()||(e.target instanceof HTMLElement&&e.target.matches('input,textarea,select,[contenteditable]')))return;
  const k=e.key.toLowerCase();
  if(k==='z'&&(e.ctrlKey||e.metaKey)){e.preventDefault();action('undo');return;}
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(/^[1-6]$/.test(k)&&Number(k)<=initial.length)choose(Number(k)-1);
  const name=({h:'hint',u:'undo',r:'restart'} as Record<string,string>)[k];if(name)action(name);
  if(import.meta.env.DEV&&reference&&k==='c'){model.previewCompletedRight(performance.now());schedule();}
});

const viewport=new ViewportController(board,s=>renderer.resize(s.width,s.height,s.density),invalidateScene);
viewport.start();

function enterParity(){if(frameGate.isParity())return;frameGate.enterParity();metrics.last=0;}
function exitParity(){if(!frameGate.isParity())return;frameGate.exitParity();lastRenderedTime=performance.now();renderAt(lastRenderedTime,false,false);if(model.isAnimating())schedule();}
function debugAction(action:'reset'|'select'|'hint'|'invalid'|'pour'|'undo',now:number){enterParity();if(action==='reset')model.reset();if(action==='select')model.choose(0,now);if(action==='hint')model.hint(now);if(action==='invalid')model.invalid(now);if(action==='pour')model.startPour(now);if(action==='undo')model.undo(now);}
let lastDebugFrame:ReturnType<typeof snapshotFrame>|null=null;
function debugStep(now:number){enterParity();const frame=model.sample(now);renderer.render(frame);lastPresentedFrame=frame;lastRenderedTime=now;lastDebugFrame=snapshotFrame(frame);model.advanceAfterFrame(now);return lastDebugFrame;}
function stats(values:number[]){if(!values.length)return{count:0,mean:0,p95:0,p99:0};const sorted=[...values].sort((a,b)=>a-b),pick=(q:number)=>sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*q))];return{count:values.length,mean:values.reduce((a,b)=>a+b,0)/values.length,p95:pick(.95),p99:pick(.99)};}
(window as any).__STILLLIGHT_PIXI__={action:debugAction,choose:(index:number,now:number)=>{enterParity();model.choose(index,now);},step:debugStep,enterParity,exitParity,isParity:()=>frameGate.isParity(),state:()=>({board:model.board.map(g=>[...g]),selected:model.selected,busy:model.busy}),lastFrame:()=>lastDebugFrame,backend:()=>renderer.backend,metrics:()=>({prep:stats(metrics.prep),render:stats(metrics.render),frameIntervals:stats(metrics.intervals)}),constants:{POUR_MS,UNDO_MS,SELECT_MS,INVALID_MS,SETTLE_MS,HINT_ATTENTION_MS}};

ready=true;updateControls();renderAt(lastRenderedTime,false,false);
}
void start();
