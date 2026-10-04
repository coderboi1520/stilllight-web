import {COMMISSIONS,ROOM,commission} from '../session/content.ts';
import type {GameSession} from '../session/session.ts';
import {restorationArtwork} from '../render/restoration.ts';
import {icon} from './icons.ts';
export type Screen='home'|'game'|'settings'|'commissions'|'journal';
export class ShellViews{
 screen:Screen='home';
 private origin:Screen='home';
 private returnFocus:HTMLElement|null=null;
 private root=document.querySelector<HTMLElement>('.atelier')!;
 private room=document.querySelector<HTMLElement>('.room-light')!;
 private count=-1;
 private storageMessage:string|null=null;
 private storageDismissed=false;
 constructor(){document.querySelectorAll<HTMLElement>('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon!));}
 show(screen:Screen){
  if(['settings','commissions','journal'].includes(screen)){this.origin=this.screen;this.returnFocus=document.activeElement as HTMLElement;}
  this.screen=screen;this.root.dataset.view=screen;
  if(screen==='settings')this.storageDismissed=false;
  document.querySelectorAll<HTMLElement>('[data-screen]').forEach(s=>s.hidden=s.dataset.screen!==screen);
  const board=document.querySelector<HTMLElement>('.board')!;
  document.querySelector(screen==='home'?'.home-props':'.game-slot')!.append(board);
  document.querySelector<HTMLElement>('.board')!.hidden=screen!=='game'&&screen!=='home';
  document.querySelector<HTMLElement>('.hit-glasses')!.hidden=screen!=='game';
  document.querySelector<HTMLElement>('[data-nav="home"]')!.hidden=screen!=='game';
  document.querySelector<HTMLElement>('[data-nav="settings"]')!.hidden=screen==='settings';
  document.querySelector<HTMLElement>('header h1')!.hidden=screen!=='game';
  document.querySelector<HTMLElement>('.instruction')!.hidden=screen!=='game';
  if(screen!=='home')document.querySelector<HTMLElement>(screen==='game'?'[data-glass="0"]':`[data-screen="${screen}"] button:not(:disabled)`)?.focus({preventScroll:true});
  else document.querySelector<HTMLElement>('[data-nav="play"]')?.focus({preventScroll:true});
 }
 back(){const target=this.screen==='settings'?this.origin:'home';this.show(target);if(this.returnFocus?.offsetParent)this.returnFocus.focus({preventScroll:true});}
 update(session:GameSession){
  const c=commission(session.id),count=session.awarded.length;
  this.root.classList.toggle('reduced',session.model.reducedMotion);
  document.querySelector('h1')!.textContent=this.screen==='game'?`${c.name}${session.isReplay?' · Replay':''}`:ROOM.name;
  document.querySelector('.instruction')!.textContent=this.screen==='game'?c.teaching:'';
  const finished=count===3&&session.completed,action=finished?'View restored room':session.hasActive?'Continue':'Play';
  const primary=document.querySelector<HTMLElement>('[data-nav="play"]')!;
  primary.setAttribute('aria-label',finished?action:`${action} ${c.name}`);
  primary.querySelector('.primary-label')!.textContent=finished?'Collection':action;
  primary.querySelector('.primary-commission')!.textContent=finished?'Moonlit Atelier restored':c.name;
  document.querySelector('.home-progress')!.textContent=finished?'3 of 3 complete':`Commission ${COMMISSIONS.indexOf(c)+1} of 3 · ${count} complete`;
  document.querySelector('.move-count')!.textContent=`${session.model.moveCount} ${session.model.moveCount===1?'move':'moves'} · ${session.hints} hints`;
  const result=document.querySelector<HTMLElement>('.result')!;result.hidden=!session.completed;
  document.querySelector<HTMLElement>('.controls')!.hidden=session.completed;
  result.querySelector('p')!.textContent=session.isReplay?`${c.name} settled again.`:`${c.name} settled. ${c.contribution}`;
  const index=COMMISSIONS.findIndex(x=>x.id===session.id);
  result.querySelector('button')!.textContent=session.isReplay?'Return Home':index===2?'View restored room':`Next · ${COMMISSIONS[index+1].name}`;
  const focusedId=(document.activeElement as HTMLElement)?.dataset.commission;
  const list=document.querySelector('.commission-list')!;list.replaceChildren();
  COMMISSIONS.forEach((c,i)=>{const b=document.createElement('button');b.type='button';b.dataset.commission=c.id;const done=session.awarded.includes(c.id),current=!done&&i===count;b.disabled=!done&&i>count;b.dataset.state=done?'completed':current?'current':'locked';b.setAttribute('aria-label',done?`Replay ${c.name} · Completed`:current?`${session.hasActive&&session.id===c.id?'Continue':'Play'} ${c.name} · Current`:`${c.name} · Locked`);b.innerHTML=`<span class="seal-number">${i+1}</span><span class="seal-name">${c.name}</span><small class="seal-state">${icon(done?'check':current?'play':'lock')}${done?'Completed':current?'Current':'Locked'}</small>`;list.append(b);if(focusedId===c.id&&this.screen==='commissions')b.focus({preventScroll:true});});
  document.querySelector('.journal-copy')!.textContent=count?`${count} of 3 commissions complete${count===3?' · Window restored.':'.'}`:'Complete First light to begin your collection.';
  const journal=document.querySelector('.journal-list')!;journal.replaceChildren();session.awarded.forEach(id=>{const li=document.createElement('li');li.textContent=commission(id).contribution;journal.append(li);});
  if(count!==this.count){this.count=count;const source=restorationArtwork(count);this.room.replaceChildren(...[restorationArtwork(Math.max(0,count-1)),restorationArtwork(count,true)].map(source=>{const copy=document.createElement('canvas');copy.width=1024;copy.height=1536;copy.getContext('2d')!.drawImage(source,0,0);return copy;}));document.querySelector<HTMLElement>('.journal-art')!.style.backgroundImage=`url(${source.toDataURL()}),url('/assets/moonlit-studio.png')`;}
  this.layout();
 }
 layout(){const r=this.root.getBoundingClientRect(),scale=Math.max(r.width/1024,r.height/1536);Object.assign(this.room.style,{width:`${1024*scale}px`,height:`${1536*scale}px`,left:`${(r.width-1024*scale)/2}px`,top:`${(r.height-1536*scale)/2}px`});}
 reveal(alpha:number){const last=this.room.querySelector<HTMLCanvasElement>('canvas:last-child');if(last)last.style.opacity=String(alpha);}
 storageError(message:string|null,label='Retry saving'){if(message!==this.storageMessage){this.storageMessage=message;this.storageDismissed=false;}const box=document.querySelector<HTMLElement>('.storage-error')!;box.hidden=!message||this.storageDismissed;box.querySelector('p')!.textContent=message??'';box.querySelector('button')!.textContent=label;}
 keepPlayingInMemory(){this.storageDismissed=true;document.querySelector<HTMLElement>('.storage-error')!.hidden=true;}
}
