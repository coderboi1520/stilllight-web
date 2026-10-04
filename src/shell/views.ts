import {COMMISSIONS,CHAPTERS,commission,levelIndex} from '../session/content.ts';
import type {GameSession} from '../session/session.ts';
import {restorationArtwork} from '../render/restoration.ts';
import {tutorialGuide} from '../session/tutorial.ts';
import {position} from '../core/geometry.ts';
import {W,H,SCENE_TOP_PADDING} from '../core/constants.ts';
import {icon} from './icons.ts';
import {journeyPage,shopPage,profilePage,dailyPage,OFFERS} from './pages.ts';
import {cosmeticPreview} from './cosmeticPreview.ts';
import {cosmetic} from '../session/catalog.ts';
export type Screen='home'|'game'|'settings'|'journey'|'shop'|'profile'|'journal'|'daily'|'help'|'about'|'privacy'|'terms'|'history'|'leaderboard'|'offer'|'feedback'|'end';
export class ShellViews{
 screen:Screen='home';
 private trail:{screen:Screen;focus:HTMLElement|null}[]=[];
 private root=document.querySelector<HTMLElement>('.atelier')!;
 private room=document.querySelector<HTMLElement>('.room-light')!;
 private count=-1;
 private storageMessage:string|null=null;
 private storageDismissed=false;
 private previewFocus:HTMLElement|null=null;
 constructor(){document.querySelectorAll<HTMLElement>('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon!));}
 show(screen:Screen,record=true){
  if(screen!==this.screen&&record){if(['home','journey','shop','profile','game','end'].includes(screen))this.trail=[];else this.trail.push({screen:this.screen,focus:document.activeElement as HTMLElement});}
  this.screen=screen;this.root.dataset.view=screen;if(screen==='settings')this.storageDismissed=false;
  document.querySelectorAll<HTMLElement>('[data-screen]').forEach(s=>s.hidden=s.dataset.screen!==screen);
  document.querySelector<HTMLElement>('.game-slot')!.hidden=screen!=='game';
  document.querySelector<HTMLElement>('.board')!.hidden=screen!=='game';
  document.querySelector<HTMLElement>('[data-nav="home"]')!.hidden=screen!=='game';
  document.querySelector<HTMLElement>('header h1')!.hidden=screen!=='game';
  document.querySelector<HTMLElement>('.instruction')!.hidden=screen!=='game';
  document.querySelector<HTMLElement>('.dock')!.hidden=screen==='game';
  document.querySelector<HTMLElement>('.coin-balance')!.hidden=screen==='game';
  document.querySelector<HTMLElement>('header [data-nav="daily"]')!.hidden=screen==='game';
  document.querySelector<HTMLElement>('header [data-nav="settings"]')!.hidden=screen==='settings';
  this.focusScreen();
 }
 focusScreen(){document.querySelector<HTMLElement>(this.screen==='game'?'[data-glass="0"]':`[data-screen="${this.screen}"] button:not(:disabled)`)?.focus({preventScroll:true});}
 back(){const entry=this.trail.pop();this.show(entry?.screen??'home',false);if(entry?.focus?.isConnected&&entry.focus.offsetParent)entry.focus.focus({preventScroll:true});}
 update(session:GameSession){
  const c=commission(session.id),count=session.restorationCount;
  this.root.classList.toggle('reduced',session.model.reducedMotion);this.root.dataset.background=session.product.equipped.background;
  document.querySelector('h1')!.textContent=`Level ${levelIndex(c.id)+1} · ${c.name}${session.isReplay?' · Replay':''}`;
  document.querySelector('.instruction')!.textContent=c.teaching;
  const finished=session.campaignComplete,action=finished?'Explore':session.hasActive?'Continue':'Play';
  const primary=document.querySelector<HTMLElement>('[data-nav="play"]')!;primary.setAttribute('aria-label',finished?'Explore completed journey':`${action} level ${levelIndex(c.id)+1}, ${c.name}`);
  primary.querySelector('.primary-label')!.textContent=action;primary.querySelector('.primary-commission')!.textContent=finished?'Your thirty lights':`Level ${levelIndex(c.id)+1} · ${c.name}`;
  document.querySelector('.home-progress')!.textContent=finished?'Your journey is complete':`${CHAPTERS[c.chapter].name} · ${session.awarded.length}/30 complete`;
  document.querySelector('.coin-balance')!.textContent=`${session.coins} coins`;
  document.querySelector('.move-count')!.textContent=`${session.model.moveCount} moves · ${session.hints} hints · 3★ target ${c.target}`;
  const result=document.querySelector<HTMLElement>('.result')!;result.hidden=!session.completed;document.querySelector<HTMLElement>('.controls')!.hidden=session.completed;
  const chapterDone=COMMISSIONS.slice(c.chapter*10,c.chapter*10+10).every(x=>session.stars(x.id));
  result.querySelector('p')!.textContent=`${c.name} settled.${chapterDone?' '+CHAPTERS[c.chapter].payoff:''}`;
  result.querySelector('.result-stars')!.textContent='★'.repeat(session.stars(c.id))+'☆'.repeat(3-session.stars(c.id));result.querySelector('.result-stars')!.setAttribute('aria-label',`${session.stars(c.id)} stars`);
  result.querySelector('.result-reward')!.textContent=session.lastReward?`+${session.lastReward} coins · first clear`:'First-clear reward already saved · no replay coins';
  result.querySelector<HTMLButtonElement>('[data-nav="next"]')!.textContent=session.isReplay?'Return to campaign':levelIndex(c.id)===29?'View finished journey':`Next · Level ${levelIndex(c.id)+2}`;
  if(this.screen==='journey')document.querySelector('.commission-list')!.innerHTML=journeyPage(session);
  if(this.screen==='shop'){document.querySelector('.shop-content')!.innerHTML=shopPage(session);document.querySelectorAll<HTMLElement>('[data-preview-art]').forEach(e=>void cosmeticPreview(e,e.dataset.previewArt!));}
  if(this.screen==='profile')document.querySelector('.profile-content')!.innerHTML=profilePage(session);
  if(this.screen==='daily')document.querySelector('.daily-content')!.innerHTML=dailyPage(session);
  document.querySelector('.end-stats')!.textContent=`${session.awarded.length} levels cleared · ${Object.values(session.product.stars).reduce((a,b)=>a+b,0)} stars · ${session.coins} coins`;
  document.querySelector('.journal-copy')!.textContent=`${session.awarded.length}/30 lights earned · ${count}/3 original panes restored`;
  const journal=document.querySelector('.journal-list')!;journal.replaceChildren();session.awarded.filter(id=>id.startsWith('ma-')).forEach(id=>{const li=document.createElement('li');li.textContent=commission(id).contribution;journal.append(li);});
  document.querySelector('.chapter-album')!.innerHTML=CHAPTERS.map((ch,i)=>{const levels=COMMISSIONS.slice(i*10,i*10+10),done=levels.filter(c=>session.stars(c.id)).length;return `<article class="album-page chapter-${i}">${icon(i===0?'moon':i===1?'lily':'orbit')}<h3>${ch.name}</h3><p>${done}/10 lights · ${done===10?ch.payoff:'Keep gathering light.'}</p><div class="constellation" aria-label="${done} lights">${levels.map(c=>`<span class="${session.stars(c.id)?'earned':''}">✧</span>`).join('')}</div></article>`;}).join('');
  document.querySelectorAll<HTMLElement>('.dock button').forEach(b=>{b.setAttribute('aria-current',String(b.dataset.nav===this.screen));});
  if(count!==this.count){this.count=count;const source=restorationArtwork(count);this.room.replaceChildren(...[restorationArtwork(Math.max(0,count-1)),restorationArtwork(count,true)].map(source=>{const copy=document.createElement('canvas');copy.width=1024;copy.height=1536;copy.getContext('2d')!.drawImage(source,0,0);return copy;}));document.querySelector<HTMLElement>('.journal-art')!.style.backgroundImage=`url(${source.toDataURL()}),url('/assets/moonlit-studio.png')`;}
  this.guide(session);this.layout();
 }
 guide(session:GameSession){const guide=this.screen==='game'?tutorialGuide(session):null;const pointer=document.querySelector<HTMLElement>('.tutorial-pointer')!,copy=document.querySelector<HTMLElement>('.tutorial-copy')!;pointer.hidden=copy.hidden=!guide;if(guide){const p=position(guide.target);pointer.style.left=`${p.x/W*100}%`;pointer.style.top=`${(p.y+SCENE_TOP_PADDING+190)/H*100}%`;copy.querySelector('p')!.textContent=guide.text;}}
 offer(id:string){const o=OFFERS[id];if(!o)return;document.querySelector('.offer-title')!.textContent=o.title;document.querySelector('.offer-copy')!.textContent=o.copy;this.show('offer');}
 preview(id:string){const modal=document.querySelector<HTMLDialogElement>('.preview-modal');if(!modal)return;this.previewFocus=document.activeElement as HTMLElement;const c=cosmetic(id);modal.querySelector('h3')!.textContent=c.name;modal.querySelector('p')!.textContent=c.description;void cosmeticPreview(modal.querySelector('.preview-art')!,id);modal.hidden=false;modal.showModal();modal.querySelector<HTMLButtonElement>('button')!.focus();}
 closePreview(){const m=document.querySelector<HTMLDialogElement>('.preview-modal');if(m){m.close();m.hidden=true;}this.previewFocus?.focus();}
 layout(){const r=this.root.getBoundingClientRect(),scale=Math.max(r.width/1024,r.height/1536);Object.assign(this.room.style,{width:`${1024*scale}px`,height:`${1536*scale}px`,left:`${(r.width-1024*scale)/2}px`,top:`${(r.height-1536*scale)/2}px`});}
 reveal(alpha:number){const last=this.room.querySelector<HTMLCanvasElement>('canvas:last-child');if(last)last.style.opacity=String(alpha);}
 storageError(message:string|null,label='Retry saving'){if(message!==this.storageMessage){this.storageMessage=message;this.storageDismissed=false;}const box=document.querySelector<HTMLElement>('.storage-error')!;box.hidden=!message||this.storageDismissed;box.querySelector('p')!.textContent=message??'';box.querySelector('button')!.textContent=label;}
 keepPlayingInMemory(){this.storageDismissed=true;document.querySelector<HTMLElement>('.storage-error')!.hidden=true;}
}
