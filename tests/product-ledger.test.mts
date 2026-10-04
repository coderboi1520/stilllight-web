import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newProduct,clearEvent,playEvent,attend,balance,buy,equip,claimDaily,claimWeek,claimAchievement,validateProduct,goalProgress} from '../src/session/product.ts';
import {CATALOG} from '../src/session/catalog.ts';
import {COMMISSIONS} from '../src/session/content.ts';
import {localDate,weekKey} from '../src/session/goals.ts';
test('stars require a real recorded personal best for move-target awards',()=>{const p=newProduct();p.stars[COMMISSIONS[0].id]=3;assert.throws(()=>validateProduct(p));});
test('cosmetic purchase is affordable, once only, equipped only when owned and all defaults remain',()=>{
 const p=newProduct();assert.equal(buy(p,'glass-rose'),false);assert.equal(equip(p,'glass-rose'),false);
 for(const c of COMMISSIONS.slice(0,3))clearEvent(p,c.id,c.target,'2026-10-05');assert.equal(balance(p),75);
 assert.ok(buy(p,'glass-rose'));assert.equal(balance(p),15);assert.equal(buy(p,'glass-rose'),false);assert.ok(equip(p,'glass-rose'));assert.equal(p.equipped.glass,'glass-rose');assert.ok(equip(p,'glass-clear'));
 const copy=validateProduct(p);assert.deepEqual(copy,p);const forged=structuredClone(p);forged.owned.push('cap-jade');assert.throws(()=>validateProduct(forged));
 assert.equal(new Set(CATALOG.map(c=>c.category)).size,3);for(const category of ['background','cap','glass'])assert.equal(CATALOG.filter(c=>c.category===category).length,3);
});
test('daily unique-level events and claims deduplicate across replay, rollover and backward clock changes',()=>{
 const p=newProduct(),a=COMMISSIONS[0],b=COMMISSIONS[1];clearEvent(p,a.id,3,'2026-10-05');clearEvent(p,a.id,5,'2026-10-05');assert.deepEqual(goalProgress(p,'2026-10-05'),[1,2,1]);assert.equal(p.stars[a.id],3);assert.equal(p.bestMoves[a.id],3);
 assert.ok(claimDaily(p,0,'2026-10-05'));assert.equal(claimDaily(p,0,'2026-10-05'),false);assert.equal(claimDaily(p,1,'2026-10-05'),false);
 playEvent(p,b.id,'2026-10-05');assert.ok(claimDaily(p,2,'2026-10-05'));assert.equal(balance(p),45);
 assert.deepEqual(goalProgress(p,'2026-10-06'),[0,0,0]);attend(p,'2026-10-06');assert.equal(claimDaily(p,0,'2026-10-06'),false);assert.equal(claimDaily(p,0,'2026-10-05'),false);assert.doesNotThrow(()=>validateProduct(p));
});
test('forgiving weekly attendance counts distinct days without resetting across misses and weeks',()=>{
 const p=newProduct();for(const d of ['2026-10-05','2026-10-05','2026-10-07'])attend(p,d);assert.equal(claimWeek(p,'2026-10-07'),false);attend(p,'2026-10-11');assert.ok(claimWeek(p,'2026-10-11'));assert.equal(balance(p),15);assert.equal(claimWeek(p,'2026-10-05'),false);attend(p,'2026-10-12');assert.equal(claimWeek(p,'2026-10-12'),false);assert.equal(p.attendance.length,4);assert.equal(weekKey('2026-10-11'),'2026-10-05');assert.equal(localDate(new Date(2026,9,5,0,1)),'2026-10-05');assert.doesNotThrow(()=>validateProduct(p));
});
test('achievement claims are progress-based and once only; unearned claims and unknown IDs reject',()=>{const p=newProduct();assert.equal(claimAchievement(p,'first'),false);clearEvent(p,COMMISSIONS[0].id,3,'2026-10-05');assert.ok(claimAchievement(p,'first'));assert.equal(claimAchievement(p,'first'),false);assert.equal(balance(p),40);const bad=structuredClone(p);bad.achievementClaims.push('journey');assert.throws(()=>validateProduct(bad));});
