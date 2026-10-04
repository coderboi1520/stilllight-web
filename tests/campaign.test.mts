import {test} from 'node:test';
import assert from 'node:assert/strict';
import {COMMISSIONS,LEGACY_COMMISSIONS} from '../src/session/content.ts';
import {GameSession,validateSave} from '../src/session/session.ts';
import {pour,isBottleComplete} from '../src/core/rules.ts';
import {solve} from '../src/session/solver.ts';

const settle=(s:GameSession,t:number)=>{for(let n=t;n<t+4000;n+=80){s.model.sample(n);s.model.advanceAfterFrame(n);}};
function clear(s:GameSession){let t=0;for(const [a,b] of solve(s.model.board).path){s.model.choose(a,t);s.model.choose(b,t+1);settle(s,t);t+=4000;}assert.ok(s.finish());}
test('30 campaign boards have conserved colors and replayable legal solutions, with a real three-glass tutorial',()=>{
 assert.equal(COMMISSIONS.length,30);assert.equal(new Set(COMMISSIONS.map(c=>c.id)).size,30);
 assert.deepEqual(COMMISSIONS[0].board,[[0,0,1,1],[1,1,0,0],[]]);
 for(const c of COMMISSIONS){const quantities=c.board.flat().reduce((m,x)=>(m[x]=(m[x]??0)+1,m),{} as Record<number,number>);assert.ok(Object.values(quantities).every(n=>n===4),c.id);
 let board=c.board;const result=solve(board);assert.equal(result.kind,'solved',c.id);for(const [a,b] of result.path){const r=pour(board,a,b);assert.ok(r,c.id);board=r.board;}assert.ok(board.every(g=>!g.length||isBottleComplete(g)),c.id);}
});
test('actual v1 six-glass history migrates losslessly and returning players bypass new coaching',()=>{
 const board=[[0,0,1,1],[1,1,0,0],[],[],[],[]],r=pour(board,0,2)!;
 const state={board:r.board,history:[{source:0,target:2,color:r.color,amount:r.amount,beforeSource:board[0],beforeTarget:board[2],afterSource:r.board[0],afterTarget:r.board[2]}]};
 const s=new GameSession({version:1,awarded:[],active:{id:'ma-first-light',state,hints:2,completed:false}} as any);
 assert.equal(s.snapshot().version,2);assert.deepEqual(s.snapshot().active?.state,state);assert.equal((s as any).product.tutorialWaived,true);
 assert.ok(s.model.undo(0));settle(s,0);assert.deepEqual(s.model.board,board);
});
test('first-clear entitlement, best stars and campaign end survive replay/reload without duplicate grants',()=>{
 const s=new GameSession();s.start();clear(s);assert.equal((s as any).coins,25);assert.equal(s.finish(),false);assert.equal((s as any).stars(s.id),3);
 s.next();const active=s.snapshot().active;s.replay(COMMISSIONS[0].id);clear(s);assert.equal((s as any).coins,25);s.home();assert.deepEqual(s.snapshot().active,active);
 const reload=new GameSession(s.snapshot());while(reload.awarded.length<30){clear(reload);reload.next();}assert.equal((reload as any).campaignComplete,true);assert.equal((reload as any).coins,750);
 assert.doesNotThrow(()=>validateSave(reload.snapshot()));
});
test('legacy dense puzzle closes chapter one and migrated progress can continue beyond the compatibility unlock',()=>{
 assert.equal(COMMISSIONS[9].id,'ma-moon-in-glass');
 const s=new GameSession({version:1,awarded:['ma-first-light','ma-sill-reflection'],active:{id:'ma-moon-in-glass',state:{board:LEGACY_COMMISSIONS[2].board,history:[]},hints:0,completed:false}});
 clear(s);s.next();assert.equal(s.id,COMMISSIONS[10].id);assert.doesNotThrow(()=>validateSave(s.snapshot()));clear(s);s.next();assert.equal(s.id,COMMISSIONS[11].id);assert.doesNotThrow(()=>validateSave(s.snapshot()));
});
test('Journey starts the current new level as a campaign run with a real Next',()=>{const s=new GameSession();s.selectLevel(COMMISSIONS[0].id);assert.equal(s.isReplay,false);assert.equal(s.snapshot().active?.id,COMMISSIONS[0].id);clear(s);s.selectLevel(COMMISSIONS[1].id);assert.equal(s.isReplay,false);assert.equal(s.snapshot().active?.id,COMMISSIONS[1].id);assert.doesNotThrow(()=>validateSave(s.snapshot()));});
