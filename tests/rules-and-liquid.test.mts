import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalArea,liquidLevel,CANONICAL_AREAS,sampleSurface} from '../src/core/liquidMath.ts';
import {pour} from '../src/core/rules.ts';
const close=(a:number,b:number,t=1e-3)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
test('canonical integer areas are preserved',()=>{assert.deepEqual([...CANONICAL_AREAS],[0,2395,4573,6751,8929]);for(let i=0;i<=4;i++)assert.equal(canonicalArea(i),CANONICAL_AREAS[i]);assert.equal(canonicalArea(1.5),3484);});
test('21-iteration liquid levels match golden representative states',()=>{close(liquidLevel(1,0),115.00000476837158,1e-9);close(liquidLevel(2,0),82.00002765655518,1e-9);close(liquidLevel(2.5,.4),60.32950984794621,1e-9);close(liquidLevel(.5,-.7),103.74804476449499,1e-9);});
test('surface sampling is exactly 45 points from -220 to 220',()=>{const s=sampleSurface(82,2,1.25);assert.equal(s.length,90);assert.equal(s[0],-220);assert.equal(s[88],220);close(s[1],82+Math.sin(-220/17+1.25)*2,1e-12);});
test('pour moves matching contiguous top run only',()=>{const r=pour([[2,0,3],[3]],0,1);assert.ok(r);assert.equal(r.amount,1);assert.equal(r.color,3);assert.deepEqual(r.board,[[2,0],[3,3]]);});
