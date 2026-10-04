import test from 'node:test';
import assert from 'node:assert/strict';
import {HapticEngine, type HapticBackend, type HapticKind} from '../src/platform/haptics.ts';

const kinds: HapticKind[] = ['select', 'uiClick', 'pourContact', 'reject', 'glassComplete', 'levelComplete', 'toggleOn', 'toggleOff'];

function withNow(run: (setNow: (value: number) => void) => void) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'performance');
  let now = 0;
  Object.defineProperty(globalThis, 'performance', {configurable: true, value: {now: () => now}});
  try { run(value => { now = value; }); }
  finally {
    if (original) Object.defineProperty(globalThis, 'performance', original);
    else Reflect.deleteProperty(globalThis, 'performance');
  }
}

test('routes each legacy semantic kind through the backend', () => {
  const calls: HapticKind[] = [];
  const backend: HapticBackend = {perform: kind => { calls.push(kind); }};
  const engine = new HapticEngine(true, backend);
  for (const kind of kinds) engine.trigger(kind);
  assert.deepEqual(calls, kinds);
});

test('disabled engines suppress normal triggers and allow explicit force', () => {
  const calls: HapticKind[] = [];
  const engine = new HapticEngine(false, {perform: kind => { calls.push(kind); }});
  engine.trigger('select');
  engine.trigger('uiClick', true);
  assert.deepEqual(calls, ['uiClick']);
  engine.setEnabled(true);
  engine.trigger('select');
  assert.deepEqual(calls, ['uiClick', 'select']);
});

test('throttles each kind independently and accepts events at the exact boundary', () => {
  withNow(setNow => {
    const calls: HapticKind[] = [];
    const engine = new HapticEngine(true, {perform: kind => { calls.push(kind); }});
    engine.trigger('select');
    setNow(25); engine.trigger('select');
    engine.trigger('uiClick');
    setNow(26); engine.trigger('select');
    assert.deepEqual(calls, ['select', 'uiClick', 'select']);
  });
});

test('distinct already-deduplicated presentation events survive the shared time throttle and respect Off',()=>{
  withNow(setNow=>{
    const calls:HapticKind[]=[];
    const engine=new HapticEngine(true,{perform:kind=>{calls.push(kind);}});
    engine.trigger('pourContact',false,true);setNow(20);engine.trigger('pourContact',false,true);
    engine.trigger('glassComplete',false,true);engine.trigger('glassComplete',false,true);
    assert.deepEqual(calls,['pourContact','pourContact','glassComplete','glassComplete']);
    engine.setEnabled(false);engine.trigger('pourContact',false,true);engine.trigger('glassComplete',false,true);
    assert.equal(calls.length,4);
  });
});

test('tolerates missing browser vibration support', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {}});
  try { assert.doesNotThrow(() => new HapticEngine(true).trigger('pourContact')); }
  finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
});

test('ignores synchronous backend throws and rejected backend promises', async () => {
  const engine = new HapticEngine(true, {perform: kind => {
    if (kind === 'select') throw new Error('backend unavailable');
    return Promise.reject(new Error('backend rejected'));
  }});
  assert.doesNotThrow(() => engine.trigger('select'));
  assert.doesNotThrow(() => engine.trigger('reject'));
  await new Promise(resolve => setImmediate(resolve));
});

test('browser fallback keeps each semantic pattern distinct and short', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const patterns: number[][] = [];
  Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {vibrate: (pattern: number | number[]) => { patterns.push(Array.isArray(pattern) ? pattern : [pattern]); return true; }}});
  try {
    const engine = new HapticEngine(true);
    for (const kind of kinds) engine.trigger(kind);
    assert.equal(patterns.length, kinds.length);
    assert.equal(new Set(patterns.map(pattern => pattern.join(','))).size, kinds.length);
    assert.ok(patterns.every(pattern => pattern.reduce((sum, duration) => sum + duration, 0) <= 100));
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
});
