import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withVerificationHarness} from './browser-harness.mjs';

// Real native Web Audio graph, with an analyser on its output. Vibration is a
// recorded platform boundary here; a browser check cannot certify an actuator.
const probe=()=>{
 window.feedbackProbe={contexts:[],analysers:[],tones:[],loops:[],vibrations:[],raf:0};
 const ActualAudio=window.AudioContext;
 window.AudioContext=class extends ActualAudio{
  constructor(...args){
   super(...args);const p=window.feedbackProbe;p.contexts.push(this);
   const analyser=this.createAnalyser();analyser.fftSize=2048;analyser.connect(this.destination);p.analysers.push(analyser);
   const gain=this.createGain.bind(this);this.createGain=()=>{const node=gain(),connect=node.connect.bind(node);node.connect=destination=>connect(destination===this.destination?analyser:destination);return node;};
   const oscillator=this.createOscillator.bind(this);this.createOscillator=()=>{const node=oscillator(),start=node.start.bind(node);node.start=(...a)=>{p.tones.push({frequency:node.frequency.value});return start(...a);};return node;};
   const bufferSource=this.createBufferSource.bind(this);this.createBufferSource=()=>{const node=bufferSource(),record={started:false,stopped:false},start=node.start.bind(node),stop=node.stop.bind(node);p.loops.push(record);node.start=(...a)=>{record.started=true;record.duration=node.buffer?.duration;return start(...a);};node.stop=(...a)=>{record.stopped=true;return stop(...a);};return node;};
  }
 };
 navigator.vibrate=pattern=>{window.feedbackProbe.vibrations.push(pattern);return true;};
 const raf=requestAnimationFrame;window.requestAnimationFrame=fn=>{window.feedbackProbe.raf++;return raf(fn);};
};
const fallback=()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return ['webgl','webgl2'].includes(type)?null:get.call(this,type,...args);};};
const counts=page=>page.evaluate(()=>({contexts:window.feedbackProbe.contexts.length,tones:window.feedbackProbe.tones.length,music:window.feedbackProbe.loops.filter(x=>x.started&&!x.stopped).length,vibrations:window.feedbackProbe.vibrations.filter(x=>x!==0).length,state:window.feedbackProbe.contexts[0]?.state}));
const setSwitch=async(page,name,on)=>{const b=page.getByRole('switch',{name,exact:true});if(await b.getAttribute('aria-checked')!==String(on))await b.click();assert.equal(await b.getAttribute('aria-checked'),String(on));};
const open=page=>page.getByRole('button',{name:'Settings',exact:true}).click();
const close=async page=>{await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('.claude-settings').hidden);};
const settle=page=>page.waitForFunction(()=>!window.__STILLLIGHT_SESSION__.state().animating);
const signal=page=>page.evaluate(async()=>{let max=0;const analyser=window.feedbackProbe.analysers[0],values=new Float32Array(analyser.fftSize);for(let i=0;i<12;i++){await new Promise(r=>setTimeout(r,10));analyser.getFloatTimeDomainData(values);for(const sample of values)max=Math.max(max,Math.abs(sample));}return max;});

await withVerificationHarness({},async h=>{
 const dir=await h.artifactDir('feedback-integration'),report=[];
 for(const backend of ['webgl','canvas']){
  const {page,context,errors}=await h.newIsolatedPage({width:390,height:844,hasTouch:true,initScripts:[probe,...(backend==='canvas'?[fallback]:[])]});
  await h.goto(page);await page.waitForFunction(()=>!!window.__STILLLIGHT_SESSION__);assert.equal((await counts(page)).contexts,0,'no autoplay or audio allocation before interaction');
  await page.getByRole('button',{name:/^Play level/}).click();await page.waitForFunction(()=>window.feedbackProbe.loops.some(x=>x.started));
  assert.equal((await counts(page)).contexts,1);assert.equal((await counts(page)).music,1);assert.equal(await page.evaluate(()=>window.feedbackProbe.loops[0].duration),32);
  await page.waitForTimeout(350);const musicPeak=await signal(page);assert.ok(musicPeak>.0001,'music has a real audible signal');
  await page.locator('[data-glass="0"]').click();await page.locator('[data-glass="2"]').click();await settle(page);
  assert.ok(await page.evaluate(()=>window.feedbackProbe.vibrations.some(p=>Array.isArray(p)&&p.join(',')==='16,14,10')),'presented pour contact routes to vibration');
  await open(page);await page.waitForTimeout(650);await page.screenshot({path:`${dir}/${backend}-390x844-settings.png`});
  for(const [width,height] of [[320,568],[768,1024]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(100);
   const panel=await page.locator('.claude-settings').boundingBox(),music=await page.getByRole('switch',{name:'MUSIC',exact:true}).boundingBox();
   assert.ok(panel.x>=0&&panel.y>=0&&panel.x+panel.width<=width&&panel.y+panel.height<=height,'settings remain inside the viewport');assert.ok(music.width>=48&&music.height>=48,'Music has a full touch target');
   await page.screenshot({path:`${dir}/${backend}-${width}x${height}-settings.png`});
  }
  await page.setViewportSize({width:390,height:844});
  await setSwitch(page,'SOUND',false);await close(page);let before=await counts(page);await page.getByRole('button',{name:'Hint',exact:true}).click();
  assert.equal((await counts(page)).tones,before.tones,'Sound Off suppresses effects');assert.equal((await counts(page)).music,1,'Sound Off keeps music');
  await open(page);await setSwitch(page,'VIBRATION',false);await close(page);before=await counts(page);await page.getByRole('button',{name:'Hint',exact:true}).click();
  assert.equal((await counts(page)).vibrations,before.vibrations,'Vibration Off suppresses cues');
  await open(page);await setSwitch(page,'MUSIC',false);await page.waitForFunction(()=>window.feedbackProbe.contexts[0].state==='suspended');assert.equal((await counts(page)).music,0);
  await setSwitch(page,'SOUND',true);await page.waitForFunction(()=>window.feedbackProbe.contexts[0].state==='running');await close(page);
  before=await counts(page);await page.getByRole('button',{name:'Hint',exact:true}).click();const soundPeak=await signal(page);assert.ok((await counts(page)).tones>before.tones);assert.ok(soundPeak>.0001,'effects have a real audio signal with Music Off');assert.equal((await counts(page)).music,0);
  await open(page);await setSwitch(page,'VIBRATION',true);assert.ok((await counts(page)).vibrations>before.vibrations,'Vibration On produces confirmation');
  await setSwitch(page,'SOUND',false);await setSwitch(page,'VIBRATION',false);await setSwitch(page,'MUSIC',false);await close(page);
  await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:/^Continue /}).click();await open(page);
  for(const name of ['SOUND','VIBRATION','MUSIC'])assert.equal(await page.getByRole('switch',{name,exact:true}).getAttribute('aria-checked'),'false');assert.equal((await counts(page)).contexts,0,'all Off survives reload without creating an audio context');
  await setSwitch(page,'MUSIC',true);await page.waitForFunction(()=>window.feedbackProbe.loops.some(x=>x.started));assert.equal((await counts(page)).tones,0,'Music On leaves Sound Off');await close(page);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>window.feedbackProbe.contexts[0].state==='suspended');before=await counts(page);
  await page.evaluate(()=>document.querySelector('[data-hud="hint"]').click());assert.equal((await counts(page)).tones,before.tones);assert.equal((await counts(page)).vibrations,before.vibrations);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>window.feedbackProbe.contexts[0].state==='running');assert.equal((await counts(page)).music,1);assert.equal(await page.evaluate(()=>window.feedbackProbe.loops.length),1,'foreground does not duplicate the music loop');
  await open(page);await page.getByRole('button',{name:'Back to Home',exact:true}).click();await page.locator('header [data-nav="settings"]').click();
  for(const [name,on] of [['Sound effects',false],['Vibration',false],['Music',true]])assert.equal(await page.getByRole('button',{name,exact:true}).getAttribute('aria-pressed'),String(on));
  await page.getByRole('button',{name:'Music',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Music',exact:true}).getAttribute('aria-pressed'),'false');await page.getByRole('button',{name:'Music',exact:true}).click();
  await page.waitForTimeout(500);const idle=await page.evaluate(()=>window.feedbackProbe.raf);await page.waitForTimeout(450);assert.equal(await page.evaluate(()=>window.feedbackProbe.raf),idle,'music adds no idle game RAF');
  await page.evaluate(()=>window.__STILLLIGHT_PIXI__.enterParity());await page.waitForFunction(()=>window.feedbackProbe.contexts[0].state==='suspended');before=await counts(page);
  await page.evaluate(()=>{const game=window.__STILLLIGHT_PIXI__;game.action('reset',10000);game.choose(0,10000);game.choose(2,10001);game.step(10500);document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal((await counts(page)).state,'suspended');assert.equal((await counts(page)).tones,before.tones);assert.equal((await counts(page)).vibrations,before.vibrations,'manual sampling stays silent');await page.evaluate(()=>window.__STILLLIGHT_PIXI__.exitParity());await page.waitForFunction(()=>window.feedbackProbe.contexts[0].state==='running');assert.deepEqual(errors,[]);
  report.push({backend,result:'PASS',musicPeak,soundPeak,checks:'no autoplay; one native loop; live effects/contact vibration; independent On/Off; saved preferences; simulated background/foreground; shell controls; zero idle RAF'});
  console.log(`PASS ${backend}: real music/effects signal, vibration dispatch, independent preferences/reload, lifecycle, idle RAF`);await context.close();
 }
 const {page,context,errors}=await h.newIsolatedPage({initScripts:[()=>{Object.defineProperty(navigator,'vibrate',{configurable:true,value:undefined});localStorage.setItem('stilllight.sound.enabled','false');localStorage.setItem('stilllight.music.enabled','false');}]});
 await h.goto(page);await page.getByRole('button',{name:/^Play level/}).click();await page.locator('[data-glass="0"]').click();await page.locator('[data-glass="2"]').click();await settle(page);assert.equal(await page.evaluate(()=>window.__STILLLIGHT_SESSION__.snapshot().active.state.history.length),1);assert.deepEqual(errors,[]);await context.close();
 report.push({result:'PASS missing vibration API does not interrupt play; physical-device vibration pending'});
 await writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));
});
