import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StilllightModel} from '../src/core/model.ts';
import {COMMISSIONS} from '../src/session/content.ts';
import {solve} from '../src/session/solver.ts';
import {SessionStore,SAVE_KEY,BACKUP_KEY} from '../src/session/storage.ts';
import {GameSession} from '../src/session/session.ts';

const settle=(m:StilllightModel,t:number)=>{for(let n=t;n<t+4000;n+=80){m.sample(n);m.advanceAfterFrame(n);}};
test('accepted concurrent board and exact Undo history restore settled, rejecting foreign or forged history',()=>{
 const m=new StilllightModel(COMMISSIONS[2].board);m.choose(0,0);m.choose(1,1);m.choose(2,10);m.choose(5,11);
 const saved=m.exportState(),copy=new StilllightModel(COMMISSIONS[2].board);copy.restoreState(saved);
 assert.deepEqual(copy.board,[[2,0],[3,3],[0,1,1],[2,3,0,1],[1,2,3,0],[2]]);
 assert.equal(copy.busy,false);assert.equal(copy.undoDepth,2);assert.ok(copy.undo(0));settle(copy,0);assert.ok(copy.undo(4000));
 assert.deepEqual(copy.board,COMMISSIONS[2].board);
 assert.throws(()=>new StilllightModel(COMMISSIONS[0].board).restoreState(saved));
 const forged=structuredClone(saved);forged.history[0].amount=4;assert.throws(()=>copy.restoreState(forged));
 saved.board[0].push(3);assert.notDeepEqual(saved.board,m.board,'snapshot is copied');
});
test('three distinct commissions solve under actual maximal-pour rules; budget is unknown',()=>{
 for(const c of COMMISSIONS){const result=solve(c.board,100000);assert.equal(result.kind,'solved',c.id);
 const m=new StilllightModel(c.board);let t=0;for(const [s,d] of result.path){m.choose(s,t);m.choose(d,t+1);settle(m,t);t+=4000;}
 assert.ok(m.board.every(g=>!g.length||g.length===4&&g.every(x=>x===g[0])));}
 assert.equal(solve(COMMISSIONS[2].board,0).kind,'unknown');
});
test('persisted accepted path retains the existing 64-move Undo window and truthful move count',()=>{
 const m=new StilllightModel([[0],[],[],[],[],[]]);let t=0;
 for(let i=0;i<66;i++){m.choose(i%2,t);m.choose(1-i%2,t+1);settle(m,t);t+=4000;}
 const copy=new StilllightModel([[0],[],[],[],[],[]]);copy.restoreState(m.exportState());assert.equal(copy.undoDepth,64);assert.equal(copy.moveCount,66);
 assert.ok(copy.undo(t));settle(copy,t);assert.equal(copy.moveCount,65);assert.equal(copy.exportState().history.length,65);
});
test('last-good recovery preserves corrupt bytes and unrelated preferences; denied writes keep last good',()=>{
 const bytes=new Map<string,string>([['stilllight.haptics.enabled','false']]);let deny=false;
 const io={getItem:(k:string)=>bytes.get(k)??null,setItem:(k:string,v:string)=>{if(deny)throw Error('quota');bytes.set(k,v);}};
 const store=new SessionStore(io),session=new GameSession();session.start();assert.ok(store.save(session.snapshot()));
 const valid=bytes.get(SAVE_KEY)!;bytes.set(SAVE_KEY,'{broken');const read=new SessionStore(io);assert.ok(read.load());assert.match(read.error!,/recover/i);
 assert.equal(store.save(session.snapshot()),false,'external corrupt current bytes survive an outgoing pagehide save');assert.equal(bytes.get(SAVE_KEY),'{broken');
 assert.equal(bytes.get(SAVE_KEY),'{broken');assert.equal(bytes.get(BACKUP_KEY),valid);assert.equal(bytes.get('stilllight.haptics.enabled'),'false');
 assert.equal(read.save(session.snapshot()),false,'corrupt bytes require explicit recovery');assert.ok(read.save(session.snapshot(),true));assert.ok([...bytes.entries()].some(([k,v])=>k.includes('evidence')&&v==='{broken'));
 deny=true;assert.equal(read.save(session.snapshot()),false);assert.match(read.error!,/saved/i);assert.equal(bytes.get(BACKUP_KEY),valid);
 bytes.set(SAVE_KEY,JSON.stringify({version:999}));const old=new SessionStore(io);assert.ok(old.load());assert.match(old.error!,/version|recover/i);
});
test('unrecoverable versions cannot be replaced by lifecycle autosaves; explicit new save preserves evidence',()=>{
 const bytes=new Map([['stilllight.session.v1','{"version":999}']]);const store=new SessionStore({getItem:k=>bytes.get(k)??null,setItem:(k,v)=>{bytes.set(k,v);}});store.load();
 assert.equal(store.save(new GameSession().snapshot()),false);assert.equal(bytes.get(SAVE_KEY),'{"version":999}');
 assert.equal(store.recovery,'new');assert.equal(store.save(new GameSession().snapshot(),true),true);
 assert.ok([...bytes.values()].includes('{"version":999}'));
});
test('transient read denial cannot silently replace previously valid progress when access returns',()=>{
 const original=new GameSession();original.start();original.model.choose(0,0);original.model.choose(2,1);const raw=JSON.stringify(original.snapshot());
 const bytes=new Map([[SAVE_KEY,raw],[BACKUP_KEY,raw]]);let denied=true;
 const store=new SessionStore({getItem:k=>{if(denied)throw Error('denied');return bytes.get(k)??null;},setItem:(k,v)=>{bytes.set(k,v);}});store.load();denied=false;
 assert.equal(store.save(new GameSession().snapshot()),false);assert.equal(bytes.get(SAVE_KEY),raw);
 assert.equal(store.save(new GameSession().snapshot(),true),true);assert.ok([...bytes.entries()].some(([k,v])=>k.includes('.evidence.')&&v===raw));
});
test('completion awards once, reload retains result, Next is real, replay preserves active Continue',()=>{
 const s=new GameSession();s.start();let t=0;for(const [a,b] of solve(s.model.board).path){s.model.choose(a,t);s.model.choose(b,t+1);settle(s.model,t);t+=4000;}
 assert.ok(s.finish());assert.equal(s.finish(),false);assert.equal(s.snapshot().awarded.length,1);
 const reloaded=new GameSession(s.snapshot());assert.equal(reloaded.completed,true);reloaded.next();const active=reloaded.snapshot().active;
 reloaded.replay(COMMISSIONS[0].id);assert.equal(reloaded.isReplay,true);reloaded.home();assert.deepEqual(reloaded.snapshot().active,active);
 const bad=s.snapshot();bad.awarded=[COMMISSIONS[2].id];assert.throws(()=>new GameSession(bad));
});
