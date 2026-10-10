import './styles.css';
import './shell/gameplay.css';
import {StilllightModel} from './core/model.ts';
import {INITIAL,COMPLETION_ACCENTS,STREAM_START,STREAM_END} from './core/constants.ts';
import {isBottleComplete} from './core/rules.ts';
import {StageRenderer} from './render/StageRenderer.ts';
import {ViewportController} from './render/ViewportController.ts';
import {gameplayLayout} from './render/gameplayLayout.ts';
import {FrameGate} from './runtime/FrameGate.ts';
import {GameplayHud} from './shell/gameplayHud.ts';
import {GameplayInput} from './shell/gameplayInput.ts';
import {solve} from './session/solver.ts';
import {readSound,readMusic,SOUND_KEY,MUSIC_KEY,EventAudio,type AudioEvent} from './platform/audio.ts';
import {HapticEngine} from './platform/haptics.ts';
import {readHapticsEnabled,writeHapticsEnabled} from './platform/hapticsPreference.ts';
import {readReducedMotion,writeReducedMotion} from './platform/motionPreference.ts';
import {FeedbackCapability} from './platform/feedbackCapability.ts';
import {presentedPourContact} from './platform/presentedFeedback.ts';

// Preserve the two original demo fixtures and ordinary rules.
const MIXED_BOARD = INITIAL;
const FINISH_BOARD = [[2, 2, 2], [2]];
const mixed = new URLSearchParams(location.search).get('board') === 'mixed';
const startBoard = () => (mixed ? MIXED_BOARD : FINISH_BOARD).map(b => [...b]);

async function start(){
 const root=document.querySelector<HTMLElement>('.atelier')!,boardHost=document.querySelector<HTMLElement>('.board')!,stage=document.querySelector<HTMLElement>('#pixi-host')!,hits=document.querySelector<HTMLElement>('.hit-glasses')!,status=document.querySelector<HTMLElement>('.status')!,result=document.querySelector<HTMLElement>('.result')!,replay=document.querySelector<HTMLButtonElement>('#replay-demo')!;
 const model=new StilllightModel(startBoard());let completed=false,ready=false,lastTime=performance.now(),completionAt:number|null=null,replaying=false;
 let lastFrame:ReturnType<typeof model.sample>|null=null,timeline=0;const timers=new Set<ReturnType<typeof setTimeout>>();
 const systemMotion=matchMedia('(prefers-reduced-motion: reduce)');let userReduced=readReducedMotion();
 const refreshMotion=()=>{model.reducedMotion=userReduced||systemMotion.matches;};refreshMotion();
 let soundEnabled=readSound(),musicEnabled=readMusic(),vibrationEnabled=readHapticsEnabled();
 const audio=new EventAudio(soundEnabled,undefined,musicEnabled),haptics=new HapticEngine(vibrationEnabled),feedback=new FeedbackCapability(audio,haptics),notifiedContacts=new WeakSet<object>(),renderer=new StageRenderer(2);
 const sound=(event:AudioEvent,now=performance.now())=>{if(!document.hidden)feedback.sound(event,now);};
 const notify=(message:string)=>{status.textContent=message;};
 const allFinished=()=>model.board.every(g=>!g.length||isBottleComplete(g));
 const blocked=()=>!ready||completed||completionAt!==null||replaying||hud.modalOpen;
 const later=(fn:()=>void,ms:number)=>{const generation=timeline,id=setTimeout(()=>{timers.delete(id);if(generation===timeline)fn();},Math.max(0,ms));timers.add(id);};
 function clearCompletion(){timeline++;timers.forEach(clearTimeout);timers.clear();completionAt=null;root.classList.remove('settling','completed','replaying');result.getAnimations().forEach(a=>a.cancel());}
 function beginCompletion(impactAt:number){
  if(completionAt!==null||completed)return;completionAt=impactAt;input.clear();hud.cancelHintMotes();
  later(()=>root.classList.add('settling'),impactAt+180-performance.now());
  later(()=>{root.classList.add('completed');if(performance.now()-(impactAt+300)<150&&!document.hidden){sound('complete');audio.duckMusic();}},impactAt+300-performance.now());
  later(()=>root.classList.add('completion-light'),impactAt+500-performance.now());
 }
 function redraw(now=performance.now(),advance=true){
  if(!ready||document.hidden)return;const frame=model.sample(now);lastFrame=frame;renderer.render(frame);lastTime=now;
  audio.syncStreams(frame.flights.filter(f=>f.kind==='pour'&&f.progress>STREAM_START&&f.progress<STREAM_END).map(f=>({id:f.id,progress:(f.progress-STREAM_START)/(STREAM_END-STREAM_START)})));
  if(!advance)return;
  for(const flight of model.flights)if(flight.kind==='pour'&&!notifiedContacts.has(flight)&&presentedPourContact(frame,model.reducedMotion,flight.id)){notifiedContacts.add(flight);feedback.haptic('pourContact',false,true);sound('contact',now);}
  const oldCount=model.eventCount,changed=model.advanceAfterFrame(now);
  if(model.eventCount>oldCount)for(const event of model.events.slice(-(model.eventCount-oldCount)))if(event.startsWith('cap-contact:')){
   const index=Number(event.slice('cap-contact:'.length)),age=frame.glasses[index].completionAge??0;
   if(age<150){feedback.haptic('glassComplete',false,true);sound('glassComplete',now);}if(allFinished())beginCompletion(now-age);
  }
  if(!completed&&allFinished()&&!model.isAnimating()&&(completionAt===null||now>=completionAt+700)){
   completed=true;input.clear();result.hidden=false;root.classList.add('completed');replay.disabled=true;
   result.animate(model.reducedMotion?[{opacity:0},{opacity:1}]:[{opacity:0,transform:'translateY(24px)'},{opacity:1,transform:'none'}],{duration:model.reducedMotion?200:420,easing:'cubic-bezier(.16,1,.3,1)'});
   notify('Demo level complete.');feedback.haptic('levelComplete');later(()=>{replay.disabled=false;if(!hud.modalOpen)replay.focus({preventScroll:true});},model.reducedMotion?200:420);
  }
  input.flush();hud.update();if(model.isAnimating()||changed)gate.schedule();
 }
 const gate=new FrameGate(cb=>requestAnimationFrame(cb),id=>cancelAnimationFrame(id),time=>redraw(time));
 const schedule=()=>{if(!document.hidden&&ready)gate.schedule();};
 function invalidate(){if(!ready||document.hidden)return;lastFrame=model.sample(lastTime);renderer.render(lastFrame);}
 function resetGame(confirm=false){
  if(!ready)return;input.clear();clearCompletion();audio.syncStreams([]);hud.cancelHintMotes();replaying=false;model.reset(performance.now());completed=false;result.hidden=true;root.classList.remove('completion-light');replay.disabled=false;
  if(confirm){sound('resetConfirm');feedback.haptic('resetConfirm');}notify('Demo board restarted.');hud.update();schedule();
 }
 function applyChoose(index:number){
  if(blocked()||!model.isVesselAvailable(index))return;const now=performance.now();void feedback.unlock();hud.cancelHintMotes();model.cancelHint(now);const oldCount=model.eventCount;model.choose(index,now);
  if(model.eventCount>oldCount){const event=model.events.at(-1)??'';
   if(event.startsWith('selected:')){feedback.haptic('select');sound('select',now);notify(`Vessel ${index+1} selected.`);}
   else if(event.startsWith('invalid:')){feedback.haptic('reject');sound('invalid',now);notify('That pour is not allowed.');}
   else if(event.startsWith('pour-start:'))notify('Pour in progress.');else if(event==='selection-cleared'){sound('deselect',now);notify('Selection cleared.');}
  }hud.update();schedule();
 }
 function applyUndo(){const now=performance.now();if(blocked()||!model.undo(now))return false;hud.cancelHintMotes();sound('undo',now);feedback.haptic('undo');notify('Previous pour restored.');hud.update();schedule();return true;}
 const input=new GameplayInput(()=>({board:model.board,selected:model.selected,blocked:blocked(),busy:model.busy||!!model.settleMotion,undoRunning:model.flights.some(f=>f.kind==='undo'),undoDepth:model.undoDepth,canUndo:model.canUndo(performance.now()),available:i=>model.isVesselAvailable(i)}),applyChoose,applyUndo,()=>{const now=performance.now();model.cancelHint(now);hud.cancelHintMotes();if(model.selected!==null)model.choose(model.selected,now);schedule();});
 function choose(index:number){if(!ready)return;void feedback.unlock();const outcome=input.choose(index);if(outcome==='queued'){notify('Glass tap queued until the current motion settles.');schedule();}}
 function runAction(name:string):boolean{
  if(!ready||hud.modalOpen)return false;void feedback.unlock();const now=performance.now();
  if(name==='skip-notice'){if(completed||completionAt!==null)return false;sound('ui',now);return true;}if(name==='reset-tick'){sound('resetTick',now);feedback.haptic('resetTick');return true;}
  if(name==='restart-confirmed'){if(!model.moveCount||completed||completionAt!==null)return false;resetGame(true);return true;}if(blocked())return false;
  if(name==='undo'){const outcome=input.undo();if(outcome==='queued'){notify('Undo queued until the current restoration settles.');schedule();}return outcome!=='rejected';}
  if(name==='hint'){
   const solution=solve(model.board),pair=solution.path[0]??(mixed?[0,1] as [number,number]:undefined);
   if(!pair||!model.showHint(pair[0],pair[1],now)){notify('No legal pours remain. Undo or Reset can recover.');return false;}
   notify(solution.path.length?'Hint: highlighted route toward completion.':'Demo hint: legal pour only; mixed board is a visual fixture.');sound('hint',now);feedback.haptic('hint');hud.update();schedule();return true;
  }return false;
 }
 function setPreference(name:string){
  void feedback.unlock();let on=false;
  if(name==='sound'){soundEnabled=!soundEnabled;on=soundEnabled;audio.setEnabled(soundEnabled);try{localStorage.setItem(SOUND_KEY,String(soundEnabled));}catch{}if(soundEnabled)void feedback.unlock();}
  else if(name==='music'){musicEnabled=!musicEnabled;on=musicEnabled;audio.setMusicEnabled(musicEnabled);try{localStorage.setItem(MUSIC_KEY,String(musicEnabled));}catch{}if(musicEnabled)void feedback.unlock();}
  else if(name==='haptics'){vibrationEnabled=!vibrationEnabled;on=vibrationEnabled;haptics.setEnabled(vibrationEnabled);writeHapticsEnabled(vibrationEnabled);}
  else if(name==='motion'&&!systemMotion.matches){userReduced=!userReduced;on=!userReduced;writeReducedMotion(userReduced);refreshMotion();invalidate();schedule();}
  sound(on?'toggleOn':'toggleOff');feedback.haptic(on?'toggleOn':'toggleOff');hud.update();
 }
 const hud=new GameplayHud(root,{
  state:()=>({level:1,busy:model.busy||!!model.settleMotion||completionAt!==null,completed,settling:completionAt!==null,moved:model.moveCount>0,undoRunning:model.flights.some(f=>f.kind==='undo')&&model.undoDepth>0,canUndo:model.canUndo(performance.now())||model.undoDepth>0&&!model.busy&&!model.settleMotion,sound:soundEnabled,music:musicEnabled,vibration:vibrationEnabled,reduced:model.reducedMotion,osReduced:systemMotion.matches}),
  run:runAction,preference:setPreference,home:()=>{},invalidate,
  settingsOpened:()=>{input.clear();model.cancelHint(performance.now());void feedback.unlock();sound('settingsOpen');feedback.haptic('uiClick');schedule();},settingsClosed:()=>{sound('settingsClose');feedback.haptic('uiClick');}
 });
 const colorNames=['amber','rose','teal','violet'];
 const buttons=model.board.map((_,index)=>{const button=document.createElement('button');button.type='button';button.dataset.glass=String(index);button.addEventListener('click',()=>choose(index));hits.append(button);return button;});
 function syncLayout(){
  const layout=gameplayLayout(innerWidth,innerHeight,2);model.setPresentationGeometry(layout.profile);renderer.setGameplayLayout(layout);
  buttons.forEach((button,index)=>{const p=layout.homes[index],width=Math.max(44,layout.glassWidth*p.scale),height=156*layout.scale*p.scale;Object.assign(button.style,{left:p.x-width/2+'px',top:p.y-8+'px',width:width+'px',height:height+16+'px'});button.style.setProperty('--glass-width',layout.glassWidth*p.scale+'px');button.style.setProperty('--glass-height',height+'px');});hud.layout(layout.homes,layout.glassWidth);
 }
 function updateButtons(){
  const frame=lastFrame??model.sample(lastTime),shadows=root.querySelectorAll<HTMLElement>('.floor-shadows>span');
  root.classList.toggle('has-transient-particles',!!model.hintMotion||frame.glasses.some(g=>g.completion.particles.some(p=>p.visible)||g.droplets.some(p=>p.visible)));
  buttons.forEach((button,index)=>{button.disabled=completed||replaying;button.setAttribute('aria-disabled',String(blocked()||!model.isVesselAvailable(index)));button.setAttribute('aria-label',`Vessel ${index+1}, ${model.board[index].length} units${model.board[index].length?', top to bottom: '+[...model.board[index]].reverse().map(c=>colorNames[c]).join(', '):', empty'}`);button.setAttribute('aria-pressed',String(model.selected===index));button.dataset.selected=String(model.selected===index);button.dataset.capped=String(frame.glasses[index].cap.visible&&(frame.glasses[index].completionAge??1000)>=600);button.style.setProperty('--cap-color',COMPLETION_ACCENTS[model.board[index][0]??0]);button.dataset.hintSource=String(model.hintMotion?.source===index);button.dataset.hintTarget=String(model.hintMotion?.target===index);if(shadows[index])shadows[index].dataset.selected=String(model.selected===index);});
 }
 const originalUpdate=hud.update.bind(hud);hud.update=()=>{updateButtons();originalUpdate();};
 await renderer.init(stage,invalidate);renderer.setPresentation('game');renderer.setRestoration(0);hud.setVisible(true);
 const viewport=new ViewportController(boardHost,metrics=>{syncLayout();renderer.resize(metrics.width,metrics.height,metrics.density);invalidate();},invalidate);viewport.start();
 window.addEventListener('resize',()=>{syncLayout();viewport.sync();invalidate();});systemMotion.addEventListener('change',()=>{refreshMotion();hud.update();invalidate();schedule();});
 document.addEventListener('visibilitychange',()=>{audio.setBackground(document.hidden);haptics.setBackground(document.hidden);if(document.hidden)input.clear();else{invalidate();schedule();}});window.addEventListener('pagehide',()=>{input.clear();audio.setBackground(true);haptics.setBackground(true);});
 replay.addEventListener('click',()=>{if(replay.disabled||replaying)return;void feedback.unlock();sound('ui');feedback.haptic('uiClick');input.clear();clearCompletion();replaying=true;root.classList.add('replaying');replay.disabled=true;result.animate(model.reducedMotion?[{opacity:1},{opacity:0}]:[{transform:'none',opacity:1},{transform:'translateY(24px)',opacity:0}],{duration:model.reducedMotion?140:220,fill:'forwards',easing:'cubic-bezier(.5,0,.75,0)'});later(()=>{resetGame();buttons[0].focus({preventScroll:true});},model.reducedMotion?140:400);});
 window.addEventListener('keydown',event=>{if(event.repeat||hud.modalOpen||event.target instanceof HTMLInputElement)return;const key=event.key.toLowerCase();if(key==='1'||key==='2'){event.preventDefault();choose(Number(key)-1);}if(key==='h')hud.requestAction('hint');if(key==='u'||key==='z'&&(event.ctrlKey||event.metaKey)){event.preventDefault();hud.requestAction('undo');}if(key==='r')hud.requestResetKey();});
 ready=true;hud.update();notify(mixed?'Mixed-color visual fixture. Not a solvable level.':'Select the larger glass, then the smaller glass to pour.');redraw(performance.now(),false);
}
void start();
