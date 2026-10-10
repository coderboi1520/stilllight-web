import {gameplayGlyph as glyph} from './gameplayGlyphs.ts';
import {HoldConfirmation} from './holdConfirmation.ts';
export type HudState={level:number;busy:boolean;completed:boolean;settling:boolean;canUndo:boolean;moved:boolean;undoRunning:boolean;sound:boolean;music:boolean;vibration:boolean;reduced:boolean;osReduced:boolean};
export type HudBindings={state:()=>HudState;run:(name:string)=>boolean|void;preference:(name:string)=>void;home:()=>void;invalidate:()=>void;settingsOpened?:()=>void;settingsClosed?:()=>void};
const medallion=(name:string,label:string,large=false)=>`<button type="button" class="medallion ${large?'large':'medium'} role-${name}" data-hud="${name}" aria-label="${label}"><span class="bezel"></span><span class="knurl"></span><span class="lens"></span><span class="specular"></span><span class="tint-ring"></span><span class="hud-glyph">${glyph(name)}</span>${name==='hint'?'<span class="hint-badge" aria-hidden="true">∞</span>':''}${name==='restart'?'<svg class="hold-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="47" pathLength="1"/></svg>':''}${name!=='settings'?'<span class="hold-toast" role="status"></span>':''}</button>`;
const switchWindow=(name:string,label:string)=>`<button class="lancet ${name}" data-preference="${name}" type="button" role="switch" aria-checked="true" aria-label="${label}"${name!=='motion'?' aria-describedby="feedback-help"':''}><svg class="lancet-frame" viewBox="0 0 94 176" preserveAspectRatio="none" aria-hidden="true"><path d="M3 172V72C3 40 28 20 47 4C66 20 91 40 91 72V172Z"/></svg><span class="lancet-light"></span><span class="lancet-glyph">${glyph(name)}</span><span class="lancet-label">${label}</span><span class="moon-track"><span class="track-light"></span><span class="moon-orb"><span class="phase-shadow"></span></span><span class="bloom"></span></span><span class="switch-word">ON</span></button>`;
export class GameplayHud{
 modalOpen=false;
 private visible=false;
 private hud:HTMLElement;
 private panel:HTMLElement;
 private scrim:HTMLElement;
 private settings:HTMLButtonElement;
 private holds=new Map<string,HoldConfirmation>();
 private abort=new AbortController();
 private timers=new Set<ReturnType<typeof setTimeout>>();
 private savedFocus:HTMLElement|null=null;
 private transition=0;
 private closing=false;
 private openedComplete=false;
 private noticeSequence=0;
 private moteSequence=0;
 private feedbackTokens=new WeakMap<HTMLElement,Map<string,number>>();
 private bindings:HudBindings;
 private root:HTMLElement;
 constructor(root:HTMLElement,bindings:HudBindings){
  this.root=root;this.bindings=bindings;
  const content=document.createElement('div');content.className='claude-ui';content.hidden=true;content.innerHTML=`<div class="scene-scrim top-scrim"></div><div class="scene-scrim bottom-scrim"></div><div class="table-light"></div><div class="moon-breath"></div><div class="ambient-motes">${Array.from({length:12},(_,i)=>`<span style="--i:${i};--x:${22+i*4.8}%;--y:${12+(i*13)%30}%;--drift:${(i%2?1:-1)*(6+i)}px"></span>`).join('')}</div><div class="floor-shadows"></div><div class="game-hud"><div class="game-top"><div class="level-plaque" aria-label="Level"><svg viewBox="0 0 60 56" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="plaque-brass"><stop stop-color="#E6C98A"/><stop offset=".5" stop-color="#B8904F"/><stop offset="1" stop-color="#6E5226"/></linearGradient></defs><path d="M1 55V29C1 16 14 10 30 1C46 10 59 16 59 29V55Z" fill="rgba(8,16,26,.72)" stroke="url(#plaque-brass)" stroke-width="1.5"/></svg><span class="plaque-gem"></span><span class="plaque-label">LEVEL</span><span class="level-number">1</span></div>${medallion('settings','Settings')}</div><nav class="game-medallions" aria-label="Level controls"><svg class="brass-rail" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="rail-brass"><stop stop-color="#B8904F" stop-opacity="0"/><stop offset=".3" stop-color="#B8904F" stop-opacity=".35"/><stop offset=".7" stop-color="#B8904F" stop-opacity=".35"/><stop offset="1" stop-color="#B8904F" stop-opacity="0"/></linearGradient></defs><path d="M75 16H135C210 16 290 30 365 30Q500 50 635 30C710 30 790 16 865 16H925" stroke="url(#rail-brass)" stroke-width="1.25" vector-effect="non-scaling-stroke" fill="none"/><path d="m500 37 3 3-3 3-3-3Z" fill="#B8904F" opacity=".5"/></svg>${medallion('restart','Reset level')}${medallion('undo','Undo',true)}${medallion('hint','Hint',true)}${medallion('skip','Skip level — coming later')}</nav></div><div class="hint-motes"></div><div class="skip-notice" role="status" hidden>SKIP · COMING LATER</div><div class="casement-scrim" hidden></div><section class="claude-settings" role="dialog" aria-modal="true" aria-labelledby="casement-title" hidden><div class="casement-glass"></div><span class="rivet tl"></span><span class="rivet tr"></span><span class="rivet bl"></span><span class="rivet br"></span><span class="gem-latch"></span><h2 id="casement-title">SETTINGS</h2><button class="casement-close medallion mini" type="button" aria-label="Close settings"><span class="bezel"></span><span class="lens"></span><span class="hud-glyph">${glyph('close')}</span></button><div class="casement-shutters" aria-hidden="true"><span></span><span></span></div><div class="triptych">${switchWindow('sound','SOUND')}${switchWindow('haptics','VIBRATION')}${switchWindow('motion','MOTION')}</div><button class="music-toggle" data-preference="music" type="button" role="switch" aria-checked="true" aria-label="MUSIC"><span class="music-label">${glyph('music')}<span>MUSIC</span></span><span class="moon-track"><span class="track-light"></span><span class="moon-orb"><span class="phase-shadow"></span></span></span><span class="switch-word">ON</span></button><p id="feedback-help">Vibration works on supported devices.</p><button class="game-home-link" type="button">RESUME GAME</button></section>`;
  content.insertAdjacentHTML('afterbegin','<div class="moonbeam"></div><div class="window-glint"></div>');
  root.append(content);this.hud=content;this.panel=content.querySelector('.claude-settings')!;this.scrim=content.querySelector('.casement-scrim')!;this.settings=content.querySelector('[data-hud="settings"]')!;
  const listen=(el:EventTarget,type:string,fn:EventListener,options:AddEventListenerOptions={})=>el.addEventListener(type,fn,{...options,signal:this.abort.signal});
  content.querySelectorAll<HTMLButtonElement>('[data-hud]').forEach(b=>{
   const name=b.dataset.hud!;
   if(name==='restart'){
    const hold=new HoldConfirmation(()=>{b.classList.remove('holding');if(!this.eligible('restart'))return;this.feedback(b,'confirmed');bindings.run('restart-confirmed');this.cancelHintMotes();this.hud.querySelector<HTMLElement>('.skip-notice')!.hidden=true;this.hud.querySelectorAll('.hold-toast.shown').forEach(e=>e.classList.remove('shown'));},undefined,undefined,undefined,800,()=>{this.feedback(b,'hold-tick');bindings.run('reset-tick');});this.holds.set(name,hold);
    b.style.setProperty('--hold-ms','800ms');
    listen(b,'pointerdown',((e:PointerEvent)=>{if(e.button!==0||!e.isPrimary)return;e.preventDefault();if(!this.resetEligible(b))return;b.setPointerCapture(e.pointerId);hold.press();b.classList.add('holding');this.feedback(b,'pressed');}) as EventListener);
    listen(b,'pointermove',((e:PointerEvent)=>{if(!b.hasPointerCapture(e.pointerId))return;const r=b.getBoundingClientRect();if(e.clientX<r.left-2||e.clientX>r.right+2||e.clientY<r.top-2||e.clientY>r.bottom+2){hold.cancel();b.classList.remove('holding');}}) as EventListener);
    listen(b,'pointerup',()=>{if(hold.release())this.toast(b,'HOLD TO RESET');b.classList.remove('holding','pressed');this.feedback(b,'released');});
    for(const event of ['pointercancel','lostpointercapture'])listen(b,event,()=>{hold.cancel();b.classList.remove('holding','pressed');});
    listen(b,'keydown',((e:KeyboardEvent)=>{if(!['Enter',' '].includes(e.key))return;e.preventDefault();e.stopPropagation();if(e.repeat||!this.resetEligible(b))return;if(!hold.key())this.toast(b,'HOLD TO RESET');}) as EventListener);
    listen(b,'click',e=>{e.preventDefault();e.stopPropagation();});
   }else{
    listen(b,'click',e=>{e.stopPropagation();if(name==='settings'){this.modalOpen&&!this.closing?this.close():this.open();return;}if(name==='skip'){if(!this.visible||this.modalOpen||bindings.state().completed||bindings.state().settling)return;this.feedback(b,'released');this.notice();bindings.run('skip-notice');return;}if(!this.eligible(name)){this.feedback(b,'rejected');return;}const accepted=bindings.run(name);if(accepted===false){this.feedback(b,'rejected');if(name==='hint')this.toast(b,'NO POURS REMAIN',1600);return;}this.feedback(b,'activated');if(name==='hint')this.hintMotes();});
    listen(b,'pointerdown',()=>this.feedback(b,'pressed'));listen(b,'pointerup',()=>{b.classList.remove('pressed');this.feedback(b,'released');});listen(b,'pointercancel',()=>b.classList.remove('pressed'));
   }
   listen(b,'keyup',((e:KeyboardEvent)=>{if(['Enter',' '].includes(e.key))this.feedback(b,'released');}) as EventListener);
  });
  listen(this.panel.querySelector('.casement-close')!,'click',()=>this.close());listen(this.scrim,'click',()=>this.close());
  listen(this.panel.querySelector('.game-home-link')!,'click',()=>this.close());
  this.panel.querySelectorAll<HTMLButtonElement>('[data-preference]').forEach(b=>listen(b,'click',e=>{e.stopPropagation();if(b.getAttribute('aria-disabled')==='true')return;bindings.preference(b.dataset.preference!);this.update();this.feedback(b,'toggled');}));
  listen(window,'keydown',((e:KeyboardEvent)=>{
   if(!this.modalOpen)return;
   if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.close();return;}
   if(e.key==='Tab'){const a=[...this.panel.querySelectorAll<HTMLElement>('button:not([aria-disabled="true"])')],i=a.indexOf(document.activeElement as HTMLElement);e.preventDefault();a[(i+(e.shiftKey?-1:1)+a.length)%a.length]?.focus();}
   if(e.target instanceof Node&&!this.panel.contains(e.target))e.stopImmediatePropagation();
  }) as EventListener,{capture:true});
  listen(window,'blur',()=>this.cancelHolds());listen(document,'visibilitychange',()=>{root.classList.toggle('game-hidden',document.hidden);if(document.hidden){this.cancelHolds();this.cancelHintMotes();}});
 }
 private later(fn:()=>void,ms:number){const id=setTimeout(()=>{this.timers.delete(id);fn();},ms);this.timers.add(id);return id;}
 private token(el:HTMLElement,kind:string){let tokens=this.feedbackTokens.get(el);if(!tokens){tokens=new Map();this.feedbackTokens.set(el,tokens);}const token=(tokens.get(kind)??0)+1;tokens.set(kind,token);return token;}
 private feedback(el:HTMLElement,kind:string){const token=this.token(el,kind);el.classList.remove(kind);void el.offsetWidth;el.classList.add(kind);this.later(()=>{if(this.feedbackTokens.get(el)?.get(kind)===token)el.classList.remove(kind);},kind==='hold-tick'?80:700);}
 private eligible(name:string){const s=this.bindings.state();return this.visible&&!this.modalOpen&&!s.completed&&!s.settling&&(name==='undo'?s.canUndo||s.undoRunning:name==='hint'?!s.busy:name==='restart'?s.moved:true);}
 private resetEligible(b:HTMLElement){if(this.eligible('restart'))return true;if(this.visible&&!this.modalOpen&&!this.bindings.state().completed&&!this.bindings.state().moved){this.feedback(b,'rejected');this.toast(b,'ALREADY AT START');}return false;}
 private toast(b:HTMLElement,text:string,duration=1300){const t=b.querySelector<HTMLElement>('.hold-toast')!,token=this.token(t,'toast');t.textContent=text;t.classList.add('shown');this.later(()=>{if(this.feedbackTokens.get(t)?.get('toast')===token)t.classList.remove('shown');},duration);}
 private cancelHolds(){this.holds.forEach(h=>h.cancel());this.hud.querySelectorAll('.holding,.pressed').forEach(e=>e.classList.remove('holding','pressed'));}
 private notice(){const n=this.hud.querySelector<HTMLElement>('.skip-notice')!,sequence=++this.noticeSequence;n.hidden=false;this.later(()=>{if(sequence===this.noticeSequence)n.hidden=true;},1800);}
 requestResetKey(){const b=this.hud.querySelector<HTMLElement>('[data-hud="restart"]')!;if(!this.resetEligible(b))return;if(!this.holds.get('restart')!.key())this.toast(b,'HOLD TO RESET');}
 requestAction(name:'hint'|'undo'){this.hud.querySelector<HTMLButtonElement>(`[data-hud="${name}"]`)!.click();}
 cancelHintMotes(){this.moteSequence++;const el=this.hud.querySelector<HTMLElement>('.hint-motes')!;el.querySelectorAll('span').forEach(m=>m.getAnimations().forEach(a=>a.cancel()));el.replaceChildren();}
 private hintMotes(){
  this.cancelHintMotes();if(this.bindings.state().reduced)return;
  const source=this.root.querySelector<HTMLElement>('[data-hint-source="true"]'),target=this.root.querySelector<HTMLElement>('[data-hint-target="true"]');if(!source||!target)return;
  const a=source.getBoundingClientRect(),b=target.getBoundingClientRect(),r=this.root.getBoundingClientRect(),sx=a.x+a.width/2-r.x,sy=a.y+8-r.y,ex=b.x+b.width/2-r.x,ey=b.y+8-r.y,cx=(sx+ex)/2,cy=(sy+ey)/2-40;
  const el=this.hud.querySelector<HTMLElement>('.hint-motes')!;
  for(let i=0;i<3;i++){const mote=document.createElement('span');el.append(mote);const frames=Array.from({length:5},(_,k)=>{const t=k/4,u=1-t;return {transform:`translate(${u*u*sx+2*u*t*cx+t*t*ex}px,${u*u*sy+2*u*t*cy+t*t*ey}px)`,opacity:k===0||k===4?0:.8,backgroundColor:k<3?'#F2B24B':'#BFD8E6'};});mote.animate(frames,{duration:520,delay:i*90,easing:'ease-in-out',fill:'forwards'});}
  const sequence=this.moteSequence;this.later(()=>{if(sequence===this.moteSequence)this.cancelHintMotes();},800);
 }
 update(){
  const s=this.bindings.state();this.root.dataset.motion=s.reduced?'off':'on';this.root.classList.toggle('game-complete',s.completed);
  if(!s.moved||s.completed||s.settling)this.cancelHolds();
  const numeral=this.hud.querySelector<HTMLElement>('.level-number')!;if(numeral.textContent!==String(s.level)){numeral.textContent=String(s.level);this.feedback(numeral,'changed');}this.hud.querySelector('.level-plaque')!.setAttribute('aria-label',`Level ${s.level}`);
  for(const name of ['undo','hint','restart'])this.hud.querySelector(`[data-hud="${name}"]`)!.setAttribute('aria-disabled',String(!this.eligible(name)));
  this.hud.querySelector('[data-hud="hint"]')!.setAttribute('aria-description','Free unlimited hints');this.hud.querySelector('[data-hud="skip"]')!.setAttribute('aria-description','Level Skip is coming later. A tap opens a notice and does not change progress.');
  const vibrationSupported=typeof navigator.vibrate==='function';this.panel.querySelector<HTMLElement>('#feedback-help')!.hidden=vibrationSupported;
  for(const [name,on] of [['sound',s.sound],['music',s.music],['haptics',s.vibration],['motion',!s.reduced]] as const){const b=this.panel.querySelector<HTMLElement>(`[data-preference="${name}"]`)!;b.setAttribute('aria-checked',String(on));b.querySelector('.switch-word')!.textContent=name==='haptics'&&!vibrationSupported?'NOT SUPPORTED':on?'ON':'OFF';if(name==='haptics')b.setAttribute('aria-disabled',String(!vibrationSupported));if(name==='motion'){b.setAttribute('aria-disabled',String(s.osReduced));b.setAttribute('aria-description',s.osReduced?'Motion is off because your system requests reduced motion.':'Motion is available now.');}}
 }
 setVisible(on:boolean){if(on===this.visible)return;this.visible=on;this.hud.hidden=!on;document.body.classList.toggle('claude-game-visible',on);if(!on){this.cancelHolds();this.close(true);this.cancelHintMotes();}this.update();}
 layout(homes:{x:number;y:number;scale:number}[],glassWidth:number){const el=this.hud.querySelector<HTMLElement>('.floor-shadows')!;el.innerHTML=homes.map(p=>`<span style="left:${p.x}px;top:${p.y+156*glassWidth/66*p.scale+2}px;width:${glassWidth*.95*p.scale}px;height:${glassWidth*.14*p.scale}px"></span>`).join('');this.root.style.setProperty('--stage-top',`${Math.min(...homes.map(p=>p.y))}px`);}
 open(){
  if(!this.visible||this.modalOpen&&!this.closing)return;this.closing=false;this.cancelHolds();this.cancelHintMotes();this.bindings.settingsOpened?.();this.openedComplete=this.bindings.state().completed;this.modalOpen=true;const seq=++this.transition;this.savedFocus=this.settings;this.scrim.hidden=this.panel.hidden=false;this.settings.classList.add('settings-active');this.settings.tabIndex=-1;this.inert(true);this.update();
  this.panel.style.transform='none';const m=this.settings.getBoundingClientRect(),p=this.panel.getBoundingClientRect();
  const dx=m.x+m.width/2-p.x-p.width/2,dy=m.y+m.height/2-p.y-p.height/2,off=this.bindings.state().reduced;
  this.panel.getAnimations().forEach(a=>a.cancel());this.panel.animate(off?[{opacity:0},{opacity:1}]:[{transform:`translate(${dx}px,${dy}px) scale(.2)`,opacity:0},{opacity:1,offset:.42},{transform:'none',opacity:1}],{duration:off?140:380,easing:'cubic-bezier(.16,1,.3,1)'});
  this.scrim.getAnimations().forEach(a=>a.cancel());this.scrim.animate([{opacity:0},{opacity:1}],{duration:off?140:260,easing:'cubic-bezier(.16,1,.3,1)'});
  this.panel.classList.add('casement-open');this.panel.querySelector<HTMLButtonElement>('.casement-close')!.focus({preventScroll:true});this.later(()=>{if(seq===this.transition)this.bindings.invalidate();},600);
 }
 close(immediate=false){
  if(!this.modalOpen||this.closing&&!immediate)return;this.closing=true;const seq=++this.transition;this.cancelHolds();this.bindings.settingsClosed?.();this.settings.classList.remove('settings-active');this.panel.classList.remove('casement-open');if(!immediate&&!this.bindings.state().reduced)this.panel.querySelectorAll('.lancet').forEach(e=>e.animate([{opacity:1},{opacity:0}],{duration:90,easing:'cubic-bezier(.5,0,.75,0)'}));const off=this.bindings.state().reduced;
  const finish=()=>{if(seq!==this.transition)return;this.modalOpen=this.closing=false;this.settings.tabIndex=0;this.panel.hidden=this.scrim.hidden=true;this.inert(false);if(this.visible){const target=!this.openedComplete&&this.bindings.state().completed?this.root.querySelector<HTMLElement>('#replay-demo'):this.savedFocus?.isConnected&&this.savedFocus.offsetParent?this.savedFocus:this.settings;target?.focus({preventScroll:true});}this.update();};
  this.panel.getAnimations().forEach(a=>a.cancel());if(immediate){finish();return;}
  const m=this.settings.getBoundingClientRect(),p=this.panel.getBoundingClientRect(),dx=m.x+m.width/2-p.x-p.width/2,dy=m.y+m.height/2-p.y-p.height/2;
  this.panel.animate(off?[{opacity:1},{opacity:0}]:[{transform:'none',opacity:1},{opacity:1,offset:.38},{transform:`translate(${dx}px,${dy}px) scale(.2)`,opacity:0}],{duration:off?140:260,easing:'cubic-bezier(.5,0,.75,0)',fill:'forwards'});
  this.scrim.getAnimations().forEach(a=>a.cancel());this.scrim.animate([{opacity:1},{opacity:0}],{duration:off?140:220,fill:'forwards'});this.later(finish,off?140:260);
 }
 private inert(on:boolean){for(const selector of ['.game-slot','footer[data-screen="game"]','.game-medallions']){const e=this.root.querySelector<HTMLElement>(selector);if(e)e.inert=on;}this.root.classList.toggle('casement-is-open',on);}
 destroy(){this.close(true);this.abort.abort();this.cancelHolds();this.cancelHintMotes();this.timers.forEach(clearTimeout);this.timers.clear();this.hud.remove();}
}
