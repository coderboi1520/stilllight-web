/// <reference types="vite/client" />
import './shell/gameplay.css';
import {gameplayLayout} from './render/gameplayLayout.ts';
import {GameplayHud} from './shell/gameplayHud.ts';
import {CLAUDE_VISUAL_BOARD} from './debug/claudeFixture.ts';
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
import {GameSession} from './session/session.ts';
import {SessionStore} from './session/storage.ts';
import {commission,COMMISSIONS,levelIndex} from './session/content.ts';
import {solve} from './session/solver.ts';
import {ShellViews,type Screen} from './shell/views.ts';
import {EventAudio,readSound,readMusic,SOUND_KEY,MUSIC_KEY,type AudioEvent} from './platform/audio.ts';
import {FeedbackCapability} from './platform/feedbackCapability.ts';
import {finishColors} from './session/catalog.ts';
import {buy,equip,claimAchievement,claimDaily,claimWeek,attend} from './session/product.ts';

// Do not suspend the entry module: production renderer chunks share its exports.
// A top-level await here deadlocks their dynamic imports after bundling.
async function start(){
let ready=false;
const host=document.querySelector<HTMLElement>('#pixi-host')!;
const board=document.querySelector<HTMLElement>('.board')!;
const query=new URLSearchParams(location.search);
const claudeFixture=import.meta.env.DEV&&query.get('fixture')==='claude';
const reference=import.meta.env.DEV&&(query.get('fixture')==='reference'||claudeFixture);
const store=new SessionStore({getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)});
let session=new GameSession(reference?undefined:store.load());
const shell=new ShellViews();
const initial=claudeFixture?CLAUDE_VISUAL_BOARD:reference?INITIAL:commission(session.id).board;
document.querySelector('.atelier')!.classList.toggle('reference',reference&&!claudeFixture);
const renderer=new StageRenderer(initial.length);
let model=reference?new StilllightModel(initial):session.model;
model.reducedMotion=!reference&&readReducedMotion();
const osMotion=matchMedia('(prefers-reduced-motion: reduce)');
let storedReduced=model.reducedMotion;let reducedMotionEnabled=storedReduced||osMotion.matches;model.reducedMotion=reducedMotionEnabled;
let hapticsEnabled=readHapticsEnabled();
const haptics=new HapticEngine(hapticsEnabled);
const contactFlights=new WeakSet<object>();
let completed=session.completed;
let soundEnabled=readSound(),musicEnabled=readMusic(),preferenceError:string|null=null;
const pendingPreferences=new Map<string,boolean>();
const audio=new EventAudio(soundEnabled,undefined,musicEnabled);
const feedback=new FeedbackCapability(audio,haptics);
const hud=new GameplayHud(document.querySelector<HTMLElement>('.atelier')!,{
 state:()=>({level:claudeFixture?12:levelIndex(session.id)+1,busy:model.busy||!!model.settleMotion,completed:session.completed,canUndo:model.canUndo(performance.now()),sound:soundEnabled,music:musicEnabled,vibration:hapticsEnabled,reduced:model.reducedMotion,osReduced:osMotion.matches}),
 run:name=>action(name==='restart-confirmed'?'restart':name,name==='restart-confirmed'),preference:name=>action(name),home:()=>navigate('home'),settingsOpened:()=>{shell.reopenStorage();storageMessage();feedback.haptic('uiClick');sound('ui');},invalidate:()=>invalidateScene()
});
osMotion.addEventListener('change',()=>{reducedMotionEnabled=storedReduced||osMotion.matches;model.reducedMotion=reducedMotionEnabled;refresh();updateControls();schedule();});
attend(session.product);
let restorationStarted:number|null=null;
const feedbackCounts={select:0,contact:0,invalid:0,complete:0,ui:0};
function sound(event:AudioEvent,now=performance.now()){if(!frameGate.isParity()&&!document.hidden){feedbackCounts[event]++;feedback.sound(event,now);}}
function storageMessage(){shell.storageError(preferenceError??store.error,store.recovery==='backup'?'Recover save':store.recovery==='new'?'Start a new save':'Retry saving');}
function save(){if(!reference){store.save(session.snapshot());storageMessage();}}
function refresh(){if(!reference||claudeFixture){syncGameplay();hud.setVisible(shell.screen==='game');}renderer.setPresentation('game');const colors=finishColors(session.product.equipped);renderer.setFinishes(colors.cap,colors.glass);document.querySelector('.atelier')!.classList.toggle('completed',session.completed);if(!reference){shell.update(session);storageMessage();}}
function adoptModel(){model=session.model;model.reducedMotion=reducedMotionEnabled;completed=session.completed;restorationStarted=null;rebuildGlassButtons();}
const status=document.querySelector<HTMLElement>('.status')!;
const control=(name:string)=>document.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)!;
const hits=document.querySelector<HTMLElement>('.hit-glasses')!;
let glassButtons:HTMLButtonElement[]=[];
function syncGameplay(){
 if(reference&&!claudeFixture)return;const layout=gameplayLayout(innerWidth,innerHeight,model.board.length);model.setPresentationGeometry(layout.profile);renderer.setGameplayLayout(layout);
 glassButtons.forEach((b,i)=>{const p=layout.homes[i],w=Math.max(44,layout.glassWidth*p.scale),h=156*layout.scale*p.scale;Object.assign(b.style,{left:(p.x-w/2)+'px',top:(p.y-8)+'px',width:w+'px',height:(h+16)+'px'});});hud.layout(layout.homes,layout.glassWidth);
}
function rebuildGlassButtons(){if(glassButtons.length===model.board.length)return;hits.replaceChildren();glassButtons=model.board.map((_,i)=>{const b=document.createElement('button');b.type='button';b.dataset.glass=String(i);const p=position(i);b.style.left=`${(p.x/W-.105)*100}%`;b.style.top=`${(p.y+SCENE_TOP_PADDING-8)/H*100}%`;hits.append(b);b.addEventListener('click',()=>choose(i));return b;});}
rebuildGlassButtons();
function updateControls(){
  hud.update();
  glassButtons.forEach((b,i)=>{const layers=model.board[i];b.setAttribute('aria-label',`Vessel ${i+1}, ${layers.length?`top to bottom: ${[...layers].reverse().map(c=>COLOR_NAMES[c]).join(', ')}`:'empty'}`);b.setAttribute('aria-pressed',String(model.selected===i));b.disabled=(!reference&&session.completed)||!model.isVesselAvailable(i);});
  control('hint').disabled=model.busy||!!model.settleMotion;
  control('undo').disabled=!model.canUndo(performance.now());
  if(!reference){document.querySelector('.move-count')!.textContent=`${model.moveCount} moves · ${session.hints} hints · 3★ target ${commission(session.id).target}`;shell.guide(session);}
  for(const [name,on] of [['sound',soundEnabled],['music',musicEnabled],['haptics',hapticsEnabled],['motion',model.reducedMotion]] as const){control(name).setAttribute('aria-pressed',String(on));control(name).querySelector('span')!.textContent=on?'On':'Off';}
}
let lastRenderedTime=performance.now();
let lastPresentedFrame:ReturnType<StilllightModel['sample']>|null=null;
const metrics={prep:[] as number[],render:[] as number[],intervals:[] as number[],last:0};

await renderer.init(host,()=>invalidateScene());

function draw(now=performance.now()){renderAt(now,true,true);}
const frameGate=new FrameGate(cb=>requestAnimationFrame(cb),id=>cancelAnimationFrame(id),draw);
function renderAt(now:number,advance:boolean,recordMetrics:boolean){
  const reveal=restorationStarted===null?1:model.reducedMotion?1:Math.min(1,Math.max(0,(now-restorationStarted)/900));
  renderer.setRestoration(reference?0:session.restorationCount,reveal);shell.reveal(reveal);
  if(recordMetrics){if(metrics.last)metrics.intervals.push(now-metrics.last);metrics.last=now;}
  const a=performance.now(),frame=model.sample(now),b=performance.now();renderer.render(frame);lastPresentedFrame=frame;const c=performance.now();lastRenderedTime=now;
  if(recordMetrics){metrics.prep.push(b-a);metrics.render.push(c-b);if(metrics.prep.length>600){metrics.prep.shift();metrics.render.shift();metrics.intervals.shift();}}
  if(advance){
    for(const flight of model.flights)if(!frameGate.isParity()&&!document.hidden&&shell.screen==='game'&&flight.kind==='pour'&&presentedPourContact(frame,model.reducedMotion,flight.id)&&!contactFlights.has(flight)){contactFlights.add(flight);feedback.haptic('pourContact',false,true);sound('contact',now);}
    const eventCount=model.eventCount,changed=model.advanceAfterFrame(now);
    if(!frameGate.isParity()&&!document.hidden&&shell.screen==='game'){
      const events=model.eventCount>eventCount?model.events.slice(-(model.eventCount-eventCount)):[];
      for(const event of events)if(event.startsWith('cap-contact:'))feedback.haptic('glassComplete',false,true);
      const solved=model.board.every(g=>!g.length||isBottleComplete(g));
      if(!solved)completed=false;
      if(solved&&!model.isAnimating()&&!completed&&session.finish()){completed=true;restorationStarted=session.isReplay?null:now;status.textContent='Level complete. Every color is settled.';feedback.haptic('levelComplete');sound('complete',now);save();refresh();if(restorationStarted!==null)shell.reveal(model.reducedMotion?1:0);viewport.sync();if(!hud.modalOpen)document.querySelector<HTMLButtonElement>('.result button')!.focus({preventScroll:true});}
      updateControls();
    }
    if(restorationStarted!==null&&(model.reducedMotion||now-restorationStarted>=900))restorationStarted=null;
    if(!frameGate.isParity()&&(model.isAnimating()||changed||restorationStarted!==null))schedule();
  }
  return frame;
}
function schedule(){if(!document.hidden&&(reference||shell.screen==='game'))frameGate.schedule();}
function invalidateScene(){if(frameGate.isParity()){if(lastPresentedFrame)renderer.render(lastPresentedFrame);return;}if(model.isAnimating())schedule();else renderer.render(model.sample(lastRenderedTime));}
function choose(i:number){
  if(!ready||frameGate.isParity()||hud.modalOpen||(!reference&&(shell.screen!=='game'||session.completed)))return;
  void feedback.unlock();const count=model.eventCount,moves=model.moveCount;model.choose(i,performance.now());
  if(model.eventCount>count){const event=model.events.at(-1)!;
    if(event.startsWith('selected:')){feedback.haptic('select');sound('select');status.textContent=`Vessel ${i+1} selected. Choose a destination.`;}
    else if(event.startsWith('invalid:')){feedback.haptic('reject');sound('invalid');status.textContent='Choose a matching top color or an empty vessel with space.';}
    else if(event.startsWith('pour-start:')){const flight=model.flights.at(-1)!;status.textContent=`Pouring ${flight.amount} ${COLOR_NAMES[flight.color]} ${flight.amount===1?'unit':'units'} into vessel ${i+1}.`;}
    else status.textContent='Selection cleared.';
  }
  if(model.moveCount!==moves)save();
  updateControls();schedule();
}
function action(name:string,confirmed=false){
  if(!ready||frameGate.isParity())return;
  void feedback.unlock();
  const now=performance.now();
  if(['hint','undo','restart'].includes(name)&&!reference&&(shell.screen!=='game'||session.completed))return;
  if(name==='hint'&&!model.busy&&!model.settleMotion){const result=solve(model.board);const pair=result.path[0];if(pair&&model.showHint(...pair,now)){session.hints++;glassButtons.forEach((b,i)=>b.dataset.hintSource=String(i===pair[0]));save();status.textContent=`Hint: vessel ${pair[0]+1} to vessel ${pair[1]+1}, a step toward settling every color.`;feedback.haptic('uiClick');sound('ui');}else status.textContent=result.kind==='unknown'?'Hint search reached its limit. Try a legal pour, Undo or Restart.':result.kind==='blocked'?'No solution from this board. Undo or Restart to recover.':'Every color is already settled.';}
  if(name==='undo'&&model.undo(now)){completed=false;session.completed=false;status.textContent='Previous pour restored.';feedback.haptic('uiClick');sound('ui');save();}
  if(name==='restart'){if(!confirmed&&!reference){hud.requestResetKey();return;}model.reset();model.showResetDip(now);session.completed=false;session.hints=0;completed=false;status.textContent='Commission restarted.';feedback.haptic('uiClick');sound('ui');save();}
  if(name==='haptics'){hapticsEnabled=!hapticsEnabled;haptics.setEnabled(hapticsEnabled);writeHapticsEnabled(hapticsEnabled);if(hapticsEnabled)feedback.haptic('toggleOn');}
  if(name==='motion'){storedReduced=!storedReduced;reducedMotionEnabled=storedReduced||osMotion.matches;model.reducedMotion=reducedMotionEnabled;writeReducedMotion(storedReduced);feedback.haptic('uiClick');}
  if(name==='sound'){soundEnabled=!soundEnabled;audio.setEnabled(soundEnabled);writePreference(SOUND_KEY,soundEnabled);if(soundEnabled)void feedback.unlock();}
  if(name==='music'){musicEnabled=!musicEnabled;audio.setMusicEnabled(musicEnabled);writePreference(MUSIC_KEY,musicEnabled);if(musicEnabled)void feedback.unlock();}
  if(name==='haptics')writePreference('stilllight.haptics.enabled',hapticsEnabled);
  if(name==='motion')writePreference('stilllight.motion.reduced',storedReduced);
  updateControls();refresh();schedule();
}
function writePreference(key:string,value:boolean){pendingPreferences.set(key,value);try{localStorage.setItem(key,String(value));pendingPreferences.delete(key);preferenceError=pendingPreferences.size?'A preference could not be saved. Retry saving when storage is available.':null;}catch{preferenceError='This preference works now but could not be saved. Storage is unavailable.';}}

function navigate(name:string){
 if(!ready||frameGate.isParity())return;void feedback.unlock();sound('ui');feedback.haptic('uiClick');
 if(name==='memory'){shell.keepPlayingInMemory();status.textContent='Playing in memory. Open Settings to retry saving.';return;}
 if(name==='retry'){if(store.recovery==='new'&&!confirm('Start a new save? Unreadable save bytes stay preserved for recovery.'))return;for(const [k,v] of pendingPreferences)writePreference(k,v);store.save(session.snapshot(),true);storageMessage();return;}
 if(name==='play'){if(session.campaignComplete){shell.show('end');}else{session.home();session.start();adoptModel();shell.show('game');status.textContent=session.completed?'Level complete. Every color is settled.':'Sort each color into a full glass.';save();}}
 else if(name==='next'){const replay=session.isReplay,end=!replay&&levelIndex(session.id)===29;session.next();adoptModel();shell.show(end?'end':replay?(session.hasActive?'game':'home'):'game');status.textContent='Sort each color into a full glass.';save();}
 else if(name==='back'){shell.back();save();}
 else if(['home','settings','journey','shop','profile','journal','daily','help','about','privacy','terms','history','feedback','leaderboard','end'].includes(name)){
  if(shell.screen==='game'){model.restoreState(model.exportState());save();}
  if(name==='home'){session.home();adoptModel();}
  if(name==='daily')attend(session.product);
  shell.show(name as Screen);save();
 }
 refresh();updateControls();if(name!=='back')shell.focusScreen();viewport.sync();lastRenderedTime=performance.now();if(shell.screen==='game')renderAt(lastRenderedTime,false,false);schedule();
}
function selectLevel(id:string){if(!ready||frameGate.isParity()||!session.unlocked(id))return;if(shell.screen==='game')model.restoreState(model.exportState());session.selectLevel(id);adoptModel();shell.show('game');refresh();updateControls();viewport.sync();renderAt(performance.now(),false,false);save();schedule();}
async function command(name:string){
 if(name==='skip-guide'){session.product.tutorialDismissed=true;session.tutorialReplay=false;}
 if(name==='tutorial-replay'){session.replayTutorial();adoptModel();shell.show('game');}
 if(name==='replay-result'){const id=session.id;session.replay(id);adoptModel();shell.show('game');}
 if(name==='claim-week')claimWeek(session.product);
 if(name==='close-preview'){shell.closePreview();return;}
 if(name==='copy-feedback'){const text=(document.querySelector('#feedback-text') as HTMLTextAreaElement).value;try{await navigator.clipboard.writeText(`STILLLIGHT local candidate · level ${levelIndex(session.id)+1}\n${text}`);document.querySelector('.feedback-status')!.textContent='Copied. Share it with the owner when ready.';}catch{document.querySelector('.feedback-status')!.textContent='Copy is unavailable. Select the report text and copy it manually.';}return;}
 if(name==='reset-progress'){if(!confirm('Reset all STILLLIGHT levels, coins, cosmetics, profile and goals on this browser? Preferences and recovery evidence stay preserved. This is separate from restarting a level.'))return;session=new GameSession();attend(session.product);adoptModel();shell.show('home');store.save(session.snapshot(),true);}
 save();refresh();updateControls();viewport.sync();if(shell.screen==='game')renderAt(performance.now(),false,false);schedule();
}
document.querySelector('.atelier')!.addEventListener('click',e=>{
 const b=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!b||b.disabled||!ready||frameGate.isParity())return;
 if(b.dataset.action)action(b.dataset.action);
 if(b.dataset.nav)navigate(b.dataset.nav);
 if(b.dataset.command)void command(b.dataset.command);
 if(b.dataset.commission)selectLevel(b.dataset.commission);
 if(b.dataset.offer){shell.offer(b.dataset.offer);refresh();}
 if(b.dataset.preview)shell.preview(b.dataset.preview);
 let changed=false;
 if(b.dataset.buy)changed=buy(session.product,b.dataset.buy);
 if(b.dataset.equip)changed=equip(session.product,b.dataset.equip);
 if(b.dataset.avatar){session.product.avatar=b.dataset.avatar;changed=true;}
 if(b.dataset.achievement)changed=claimAchievement(session.product,b.dataset.achievement);
 if(b.dataset.daily)changed=claimDaily(session.product,Number(b.dataset.daily));
 if(changed){feedback.haptic('uiClick');sound('ui');save();refresh();updateControls();}
});
document.querySelector('.atelier')!.addEventListener('submit',e=>{if(!(e.target as HTMLElement).matches('.profile-form'))return;e.preventDefault();const input=document.querySelector<HTMLInputElement>('#profile-name')!;const name=input.value.trim().replace(/[<>\u0000-\u001f]/g,'').slice(0,24);if(!name){input.setCustomValidity('Choose a name of 1–24 characters.');input.reportValidity();return;}input.setCustomValidity('');session.product.name=name;save();refresh();});
window.addEventListener('keydown',e=>{if(e.key==='Escape'){const preview=document.querySelector<HTMLElement>('.preview-modal');if(preview&&!preview.hidden){shell.closePreview();return;}if(!['home','game','journey','shop','profile'].includes(shell.screen))navigate('back');}});

window.addEventListener('keydown',e=>{
  if(e.repeat||hud.modalOpen||frameGate.isParity()||(!reference&&shell.screen!=='game')||(e.target instanceof HTMLElement&&e.target.matches('input,textarea,select,[contenteditable]')))return;
  const k=e.key.toLowerCase();
  if(k==='z'&&(e.ctrlKey||e.metaKey)){e.preventDefault();action('undo');return;}
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(/^[1-8]$/.test(k)&&Number(k)<=model.board.length)choose(Number(k)-1);
  const name=({h:'hint',u:'undo',r:'restart'} as Record<string,string>)[k];if(name)action(name);
  if(import.meta.env.DEV&&reference&&k==='c'){model.previewCompletedRight(performance.now());schedule();}
});

const viewport=new ViewportController(board,s=>{syncGameplay();renderer.resize(s.width,s.height,s.density);},invalidateScene);
if(!reference)shell.show('home');else shell.show('game');refresh();
viewport.start();
window.addEventListener('resize',()=>{shell.layout();syncGameplay();shell.guide(session);viewport.sync();invalidateScene();});
const unlockFeedback=()=>{if(ready&&!document.hidden&&!frameGate.isParity())void feedback.unlock();};
document.addEventListener('pointerdown',e=>{if(e.isTrusted&&e.isPrimary&&e.button===0)unlockFeedback();},{capture:true});
document.addEventListener('keydown',e=>{if(e.isTrusted&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey)unlockFeedback();},{capture:true});
window.addEventListener('pagehide',e=>{if(!frameGate.isParity())save();audio.setBackground(true);haptics.setBackground(true);if(!e.persisted)void audio.dispose();});
window.addEventListener('pageshow',()=>{audio.setBackground(document.hidden||frameGate.isParity());haptics.setBackground(document.hidden||frameGate.isParity());});
document.addEventListener('visibilitychange',()=>{audio.setBackground(document.hidden||frameGate.isParity());haptics.setBackground(document.hidden||frameGate.isParity());if(document.hidden){if(!frameGate.isParity())save();}else if(!frameGate.isParity()){attend(session.product);save();model.restoreState(model.exportState());refresh();renderAt(performance.now(),false,false);schedule();}});

function enterParity(){if(frameGate.isParity())return;frameGate.enterParity();audio.setBackground(true);haptics.setBackground(true);document.querySelector('.atelier')!.classList.add('manual-frame');metrics.last=0;}
function exitParity(){if(!frameGate.isParity())return;frameGate.exitParity();audio.setBackground(document.hidden);haptics.setBackground(document.hidden);document.querySelector('.atelier')!.classList.remove('manual-frame');lastRenderedTime=performance.now();renderAt(lastRenderedTime,false,false);if(model.isAnimating())schedule();}
function debugAction(action:'reset'|'select'|'hint'|'invalid'|'pour'|'undo',now:number){enterParity();if(action==='reset')model.reset();if(action==='select')model.choose(0,now);if(action==='hint')model.hint(now);if(action==='invalid')model.invalid(now);if(action==='pour')model.startPour(now);if(action==='undo')model.undo(now);}
let lastDebugFrame:ReturnType<typeof snapshotFrame>|null=null;
function debugStep(now:number){enterParity();const frame=model.sample(now);renderer.render(frame);lastPresentedFrame=frame;lastRenderedTime=now;lastDebugFrame=snapshotFrame(frame);model.advanceAfterFrame(now);return lastDebugFrame;}
function stats(values:number[]){if(!values.length)return{count:0,mean:0,p95:0,p99:0};const sorted=[...values].sort((a,b)=>a-b),pick=(q:number)=>sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*q))];return{count:values.length,mean:values.reduce((a,b)=>a+b,0)/values.length,p95:pick(.95),p99:pick(.99)};}
(window as any).__STILLLIGHT_PIXI__={action:debugAction,choose:(index:number,now:number)=>{enterParity();model.choose(index,now);},step:debugStep,redraw:invalidateScene,enterParity,exitParity,isParity:()=>frameGate.isParity(),state:()=>({board:model.board.map(g=>[...g]),selected:model.selected,busy:model.busy}),lastFrame:()=>lastDebugFrame,backend:()=>renderer.backend,metrics:()=>({prep:stats(metrics.prep),render:stats(metrics.render),frameIntervals:stats(metrics.intervals)}),presentation:()=>({geometry:model.geometry.profile,numbersVisible:renderer.vesselNumbersVisible,hintMs:model.geometry.profile?(model.reducedMotion?1400:1600):HINT_ATTENTION_MS}),constants:{POUR_MS,UNDO_MS,SELECT_MS,INVALID_MS,SETTLE_MS,HINT_ATTENTION_MS}};
(window as any).__STILLLIGHT_SESSION__={state:()=>({board:model.board.map(g=>[...g]),selected:model.selected,busy:model.busy,animating:model.isAnimating(),restoring:restorationStarted!==null,completed:session.completed,replay:session.isReplay,screen:shell.screen,id:session.id,feedback:{...feedbackCounts}}),snapshot:()=>session.snapshot()};

ready=true;updateControls();renderAt(lastRenderedTime,false,false);save();
}
void start();
