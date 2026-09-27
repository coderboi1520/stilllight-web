import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {StilllightModel} from '../src/core/model.ts';
import {CAPACITY,POUR_MS,UNDO_MS} from '../src/core/constants.ts';
import {isBottleComplete} from '../src/core/rules.ts';

const T=10000;
const at=(model:StilllightModel,now:number,index=1)=>({...model.sample(now).glasses[index].cap});

test('completion requires exactly full, nonempty, uniform logical layers',()=>{
  assert.equal(isBottleComplete([]),false);
  assert.equal(isBottleComplete([2,2,2]),false);
  assert.equal(isBottleComplete([2,2,2,3]),false);
  assert.equal(isBottleComplete(Array(CAPACITY).fill(2)),true);
});

test('cap enters once at pour handoff, contacts, rebounds, and reaches exact rest',()=>{
  const model=new StilllightModel();model.board=[[3],[3,3,3]];
  assert.equal(at(model,T).visible,false);
  assert.equal(model.startPour(T),true);
  assert.equal(at(model,T+POUR_MS-1).visible,false);
  model.sample(T+POUR_MS);model.advanceAfterFrame(T+POUR_MS);
  const started=T+POUR_MS;
  const first=at(model,started),contact=at(model,started+85),compressed=at(model,started+145),rebound=at(model,started+195),rest=at(model,started+250);
  assert.equal(first.visible,true);assert.ok(first.y<rest.y-9);assert.ok(first.scaleX<1);assert.equal(first.alpha,0);
  assert.equal(contact.y,rest.y);
  assert.ok(compressed.scaleX>1&&compressed.scaleY<1);
  assert.ok(rebound.y<rest.y-1&&rebound.scaleX<1);
  assert.deepEqual(rest,{visible:true,alpha:1,y:rest.y,scaleX:1,scaleY:1,rotation:0});
  model.advanceAfterFrame(started+250);
  assert.equal(model.isAnimating(),true,'liquid settling may still own frames');
  const later=at(model,started+500);
  assert.deepEqual(later,rest,'settled cap must not retrigger');
});

test('Undo removes a completed cap and reset clears an active cap motion',()=>{
  const model=new StilllightModel();model.board=[[3],[3,3,3]];
  assert.equal(model.startPour(T),true);
  model.sample(T+POUR_MS);model.advanceAfterFrame(T+POUR_MS);
  const undoAt=T+POUR_MS+300;
  assert.equal(model.undo(undoAt),true);
  assert.equal(at(model,undoAt).visible,true);
  const middle=at(model,undoAt+65);assert.ok(middle.y<at(model,undoAt).y);assert.ok(middle.alpha<1);
  assert.equal(at(model,undoAt+125).visible,false);
  model.reset();
  assert.equal(at(model,undoAt+126).visible,false);
  assert.equal(at(model,undoAt+1000).visible,false);
  assert.deepEqual(model.board,[[2,0,3],[3]]);
});

test('Undo during landing begins removal from the presented cap pose',()=>{
  const model=new StilllightModel();model.board=[[3],[3,3,3]];
  model.startPour(T);model.sample(T+POUR_MS);model.advanceAfterFrame(T+POUR_MS);
  const undoAt=T+POUR_MS+40,before=at(model,undoAt);
  assert.equal(model.undo(undoAt),true);
  assert.deepEqual(at(model,undoAt),before);
  assert.equal(at(model,undoAt+125).visible,false);
});

test('renderers retain a glass-local cap and use the same PNG',()=>{
  const glass=fs.readFileSync(new URL('../src/render/pixi/GlassView.ts',import.meta.url),'utf8');
  const pixi=fs.readFileSync(new URL('../src/render/pixi/PixiRenderer.ts',import.meta.url),'utf8');
  const canvas=fs.readFileSync(new URL('../src/render/CanvasRenderer.ts',import.meta.url),'utf8');
  assert.match(glass,/private cap=new Sprite/);
  assert.match(glass,/this\.root\.addChild\([^;]*this\.cap/);
  assert.doesNotMatch(glass.slice(glass.indexOf('  update(frame:GlassFrame)')),/new Sprite/);
  assert.match(pixi,/chicken-cap\.png/);
  assert.match(canvas,/chicken-cap\.png/);
});
