export {};

const oracle=document.querySelector<HTMLIFrameElement>('#oracle')!;
const candidate=document.querySelector<HTMLIFrameElement>('#candidate')!;
const statusEl=document.querySelector('#status')!;
const compareEl=document.querySelector('#compare')!;
const oState=document.querySelector('#oracleState')!;
const cState=document.querySelector('#candidateState')!;
const BASE=10000,POUR=1040,SELECT=300,INVALID=420,HINT=680,SETTLE=440;

const ready=()=>new Promise<void>(resolve=>{
  const tick=()=>{
    if((oracle.contentWindow as any)?.__STILLLIGHT_ORIGINAL_TWO_GLASS__&&(candidate.contentWindow as any)?.__STILLLIGHT_PIXI__)resolve();
    else setTimeout(tick,20);
  };
  tick();
});

function oracleAPI(){return(oracle.contentWindow as any).__STILLLIGHT_ORIGINAL_TWO_GLASS__;}
function clock(){return(oracle.contentWindow as any).__STILLLIGHT_CLOCK__;}
function pixi(){return(candidate.contentWindow as any).__STILLLIGHT_PIXI__;}
function sameState(a:unknown,b:unknown){return JSON.stringify(a)===JSON.stringify(b);}

function reset(){
  clock().set(BASE);
  oracleAPI().reset();
  clock().step(BASE);
  pixi().action('reset',BASE);
  pixi().step(BASE);
}

function step(t:number){
  clock().step(t);
  const frame=pixi().step(t);
  const oracleState=oracleAPI().state();
  const candidateState=pixi().state();
  const matches=sameState(oracleState,candidateState);
  compareEl.textContent=`oracle-exposed state comparison (board / selected / busy): ${matches?'PASS':'FAIL'}`;
  compareEl.className=matches?'pass':'fail';
  oState.textContent=JSON.stringify(oracleState,null,2);
  cState.textContent=JSON.stringify({oracleComparableState:candidateState,candidateRenderFrame:frame},null,2);
}

function show(name:string){
  reset();
  if(name==='idle'){step(BASE);return;}
  if(name==='selected'){clock().set(BASE);oracleAPI().choose(0);pixi().action('select',BASE);step(BASE+SELECT);return;}
  if(name==='hint'){clock().set(BASE);oracleAPI().hint();pixi().action('hint',BASE);step(BASE+HINT*.5);return;}
  if(name==='invalid'){clock().set(BASE);oracleAPI().invalid();pixi().action('invalid',BASE);step(BASE+INVALID*.5);return;}
  if(name.startsWith('pour')){const q=Number(name.slice(4))/100;clock().set(BASE);oracleAPI().pour();pixi().action('pour',BASE);step(BASE+POUR*q);return;}
  if(name==='settle'){clock().set(BASE);oracleAPI().pour();pixi().action('pour',BASE);step(BASE+POUR);step(BASE+POUR+SETTLE*.5);}
}

await ready();
statusEl.textContent='ready — live oracle exposes board / selected / busy only; candidate geometry is shown separately';
document.querySelectorAll<HTMLButtonElement>('[data-state]').forEach(b=>b.onclick=()=>show(b.dataset.state!));
show('idle');
